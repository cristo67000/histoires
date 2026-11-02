'use strict';
/*
 * Une frise : ses voies côte à côte sur l'échelle de temps (voir echelle.js),
 * le rail des périodes, la règle des années, et un raccourci par siècle.
 * Ou, en mode liste, ses mandats rangés par période.
 */
(function (racine) {

  const { h, icone } = Outils;
  const { portrait, annees, teinte, majuscule } = Communs;

  const ZOOMS = [2, 4, 8];
  const MINIMUM = 54;

  function intervalles(mandats) {
    const maintenant = new Date().getFullYear() + 0.85;
    return mandats.map((m) => {
      const debut = Dates.nombre(m.debut);
      let fin = m.fin ? Dates.nombre(m.fin, true) : maintenant;
      if (fin < debut + 0.03) fin = debut + 0.03;
      return { m, debut, fin };
    });
  }

  /* Dessine des voies sur une échelle commune. Rend la zone. `compact` pour
   * la vue côte à côte. */
  function dessinerZone(frises, options) {
    const o = Object.assign({ pxParAn: 4, minimum: MINIMUM, compact: false, dateMarquee: null }, options || {});
    const tous = [];
    for (const f of frises) tous.push(...intervalles(f.mandats));
    const echelle = Echelle.construire(tous, { pxParAn: o.pxParAn, minimum: o.minimum });
    const zone = h('div', { class: 'zone-frise', style: { height: echelle.hauteur + 'px' } });

    // La règle
    const regle = h('div', { class: 'regle' });
    for (const g of Echelle.graduations(echelle, o.compact ? 40 : 44)) {
      regle.appendChild(h('span', { class: 'grad' + (g.siecle ? ' siecle' : ''), style: { top: g.y + 'px' } }, Dates.anneeTexte(String(g.annee))));
    }
    regle.addEventListener('click', (e) => {
      const r = regle.getBoundingClientRect();
      const an = Math.round(echelle.t(e.clientY - r.top));
      App.aller('#/date/' + String(Math.max(1, an)).padStart(4, '0'));
    });
    zone.appendChild(regle);

    // Le rail des périodes (une frise seule)
    if (frises.length === 1 && !o.compact) {
      const rail = h('div', { class: 'rail-periodes' });
      const f = frises[0];
      for (const p of f.periodes) {
        if (p.voie && p.voie !== f.voies[0].id) continue;  // une période d'une voie secondaire (obédience d'Avignon)
        const y1 = echelle.y(Dates.nombre(p.debut));
        const y2 = p.fin ? echelle.y(Dates.nombre(p.fin, true)) : echelle.hauteur;
        const hauteur = Math.max(10, y2 - y1 - 3);
        const libelle = p.nom + ' · ' + Dates.anneeTexte(p.debut) + (p.fin ? ' – ' + Dates.anneeTexte(p.fin) : ' – aujourd’hui') + (p.note ? ' · ' + p.note : '');
        rail.appendChild(h('button', {
          type: 'button', class: 'periode' + (hauteur < 90 ? ' courte' : ''), title: libelle, 'aria-label': libelle,
          style: { top: y1 + 'px', height: hauteur + 'px', '--teinte': p.couleur },
          onclick: () => Communs.toast(libelle),
        }, p.nom));
      }
      zone.appendChild(rail);
    }

    // Les voies
    const voies = h('div', { class: 'voies' });
    for (const f of frises) {
      for (const v of f.voies) {
        const col = h('div', { class: 'voie', style: { '--teinte-frise': f.couleur } });
        col.appendChild(h('div', { class: 'voie-titre', title: f.nom + ' · ' + v.nom }, frises.length > 1 ? (f.voies.length > 1 ? v.nom : f.nom) : (f.voies.length > 1 ? v.nom : '')));
        const liste = Echelle.colonnes(intervalles(f.mandats.filter((m) => m.voie === v.id)));
        for (const it of liste) {
          const m = it.m;
          const y1 = echelle.y(it.debut), y2 = echelle.y(it.fin);
          const hauteur = y2 - y1 - 3;
          const largeur = 100 / it.nb;
          const classes = ['bloc'];
          if (m.inst) classes.push('institution');
          if (o.compact || it.nb > 1) classes.push('compact');
          if (hauteur < 46) classes.push('court');
          if (o.compact && hauteur < 34) classes.push('minuscule');
          if (it.nb > 2 && hauteur >= 44) classes.push('etroit');
          else if (it.nb > 2) classes.push('minuscule');
          const corps = h('div', { class: 'texte' }, h('div', { class: 'nom' }, m.nom), h('div', { class: 'dates' }, annees(m)));
          const large = window.innerWidth >= 600 || f.voies.length === 1;
          if (!o.compact && large && hauteur >= (f.voies.length > 1 ? 110 : 64)) {
            corps.appendChild(h('div', { class: 'fonction' }, majuscule(m.titre)));
            if (m.note && hauteur >= 92) corps.appendChild(h('div', { class: 'note' }, m.note));
          }
          const bloc = h('button', {
            type: 'button', class: classes.join(' '), 'data-mandat': m.id,
            style: { top: y1 + 'px', height: hauteur + 'px', left: (it.col * largeur) + '%', width: 'calc(' + largeur + '% - ' + (it.nb > 1 ? 3 : 0) + 'px)', '--teinte': teinte(m) },
            onclick: () => { if (m.q !== '-') App.aller('#/p/' + m.q); else Communs.toast(m.nom + (m.note ? ' — ' + m.note : '')); },
          }, (!o.compact && large && hauteur >= 60 && it.nb <= 2 && !m.inst) ? portrait(m.q) : null, corps);
          col.appendChild(bloc);
        }
        voies.appendChild(col);
      }
    }
    zone.appendChild(voies);

    if (o.dateMarquee) {
      const y = echelle.y(Dates.nombre(o.dateMarquee));
      zone.appendChild(h('div', { class: 'ligne-date', style: { top: y + 'px' } }, h('span', null, Dates.lire(o.dateMarquee))));
      zone._yMarque = y;
    }
    zone._echelle = echelle;
    return zone;
  }

  /* Le raccourci par siècle, fixé à droite. */
  function sauts(echelle, conteneur) {
    const bloc = h('nav', { class: 'sauts', 'aria-label': 'Aller à un siècle' });
    const premier = Math.ceil(echelle.debut / 100) * 100;
    const boutons = [];
    for (let a = premier; a < echelle.fin; a += 100) {
      const b = h('button', { type: 'button', onclick: () => {
        const y = conteneur.getBoundingClientRect().top + window.scrollY + echelle.y(a) - 130;
        window.scrollTo({ top: y, behavior: 'smooth' });
      } }, Dates.romain(a / 100 + 1) + 'ᵉ');
      b._annee = a;
      boutons.push(b);
      bloc.appendChild(b);
    }
    if (boutons.length > 18) {
      // trop de siècles pour l'écran : un sur deux
      boutons.forEach((b, i) => { if (i % 2 === 1) b.hidden = true; });
    }
    bloc._boutons = boutons;
    return bloc;
  }

  function surligner(nav, echelle, conteneur) {
    const haut = window.scrollY + 140 - (conteneur.getBoundingClientRect().top + window.scrollY);
    const an = echelle.t(Math.max(0, haut));
    for (const b of nav._boutons) b.classList.toggle('actif', an >= b._annee && an < b._annee + 100);
  }

  function dessinerListe(f) {
    const liste = h('div', { class: 'liste-frise' });
    for (const p of f.periodes) {
      const mandats = f.mandats.filter((m) => m.periode === p.id);
      if (!mandats.length) continue;
      liste.appendChild(h('div', { class: 'entete-periode', style: { '--teinte': p.couleur } }, h('span', { class: 'pastille' }),
        h('h3', null, p.nom), h('span', { class: 'discret' }, Dates.anneeTexte(p.debut) + ' – ' + (p.fin ? Dates.anneeTexte(p.fin) : 'aujourd’hui'))));
      if (p.note) liste.appendChild(h('p', { class: 'discret petit', style: { margin: '-4px 4px 8px 26px' } }, p.note));
      for (const m of mandats) {
        const d = Dates.duree(m.debut, m.fin, { finInclusive: true });
        liste.appendChild(h('button', { type: 'button', class: 'rangee', style: { '--teinte': teinte(m) },
          onclick: () => { if (m.q !== '-') App.aller('#/p/' + m.q); } },
          m.inst ? portrait(null) : portrait(m.q),
          h('div', { class: 'texte' }, h('div', { class: 'nom' }, m.nom), h('div', { class: 'dates' }, annees(m) + (f.voies.length > 1 ? ' · ' + Donnees.voie(m).nom : '')),
            h('div', { class: 'fonction' }, majuscule(m.titre) + (m.note ? ' — ' + m.note : ''))),
          h('div', { class: 'duree' }, d)));
      }
    }
    return liste;
  }

  function dessiner(zone, params) {
    const f = Donnees.frise(params.id);
    if (!f) { zone.appendChild(h('p', { class: 'page' }, 'Frise inconnue.')); return { titre: 'Histoires' }; }
    const page = h('div', { class: 'page-large' });
    let mode = Reglages.lire('mode.' + f.id, 'frise');
    let zoom = Reglages.lire('zoom.' + f.id, 1);
    const date = params.date || null;

    const barre = h('div', { class: 'barre-frise' });
    const corps = h('div');
    let nav = null;
    let surScroll = null;

    function redessiner() {
      corps.textContent = '';
      if (nav) { nav.remove(); nav = null; }
      if (surScroll) { window.removeEventListener('scroll', surScroll); surScroll = null; }
      barre.textContent = '';
      const bListe = h('button', { type: 'button', class: 'bouton-icone', 'aria-label': mode === 'frise' ? 'Afficher en liste' : 'Afficher la frise', onclick: () => {
        mode = mode === 'frise' ? 'liste' : 'frise'; Reglages.ecrire('mode.' + f.id, mode); redessiner();
      } }, icone(mode === 'frise' ? 'liste' : 'frise'));
      barre.appendChild(bListe);
      for (const p of f.periodes.slice(0, 40)) {
        barre.appendChild(h('button', { type: 'button', class: 'puce puce-claire', style: { '--teinte': p.couleur }, onclick: () => allerPeriode(p) }, p.nom));
      }
      barre.appendChild(h('span', { class: 'espace' }));
      if (mode === 'frise') {
        barre.appendChild(h('button', { type: 'button', class: 'bouton-icone', 'aria-label': 'Resserrer', disabled: zoom === 0, onclick: () => { zoom = Math.max(0, zoom - 1); Reglages.ecrire('zoom.' + f.id, zoom); redessiner(); } }, icone('moins')));
        barre.appendChild(h('button', { type: 'button', class: 'bouton-icone', 'aria-label': 'Étirer', disabled: zoom === ZOOMS.length - 1, onclick: () => { zoom = Math.min(ZOOMS.length - 1, zoom + 1); Reglages.ecrire('zoom.' + f.id, zoom); redessiner(); } }, icone('plus')));
        const z = dessinerZone([f], { pxParAn: ZOOMS[zoom], dateMarquee: date });
        corps.appendChild(z);
        nav = sauts(z._echelle, z);
        document.body.appendChild(nav);
        surScroll = () => surligner(nav, z._echelle, z);
        window.addEventListener('scroll', surScroll, { passive: true });
        requestAnimationFrame(() => {
          if (z._yMarque != null) window.scrollTo({ top: z.getBoundingClientRect().top + window.scrollY + z._yMarque - 200 });
          surScroll();
        });
      } else {
        corps.appendChild(dessinerListe(f));
      }
    }

    function allerPeriode(p) {
      if (mode === 'frise') {
        const z = corps.firstChild;
        const y = z.getBoundingClientRect().top + window.scrollY + z._echelle.y(Dates.nombre(p.debut)) - 130;
        window.scrollTo({ top: y, behavior: 'smooth' });
      } else {
        const entetes = corps.querySelectorAll('.entete-periode');
        const i = f.periodes.indexOf(p);
        if (entetes[i]) entetes[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    redessiner();
    page.appendChild(barre);
    page.appendChild(corps);
    zone.appendChild(page);
    return {
      titre: f.nom, sous: f.titre, couleur: f.couleur,
      quitter: () => { if (nav) nav.remove(); if (surScroll) window.removeEventListener('scroll', surScroll); },
    };
  }

  racine.VueFrise = { dessiner, dessinerZone, ZOOMS };

})(window);
