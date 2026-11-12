'use strict';
/*
 * Une frise, ou plusieurs côte à côte : la « planche ».
 *
 * La planche est un cadre qui défile dans les deux sens, comme une feuille de
 * tableur. Trois choses n'y bougent pas :
 *
 *   l'en-tête de chaque colonne   le nom de la frise (ou de la voie), sur sa
 *                                 couleur, et la dynastie qu'on a sous les yeux ;
 *   la règle des années           à gauche ;
 *   le rail des périodes          à côté de la règle, pour une frise seule.
 *
 * Deux zooms indépendants : la hauteur (pixels par an) et la largeur des
 * colonnes. Boutons en bas à droite, pincement à deux doigts (horizontal :
 * largeur ; vertical : hauteur ; en diagonale : les deux), Ctrl + molette.
 * Une colonne n'est jamais plus étroite que la largeur choisie : quand
 * plusieurs règnes se chevauchent (partages mérovingiens, rois et reines de
 * Jérusalem), la colonne s'élargit et l'on fait glisser la planche, plutôt que
 * d'écraser les noms.
 */
(function (racine) {

  const { h, icone } = Outils;
  const { portrait, annees, teinte, majuscule } = Communs;

  const HAUTEURS = [2, 4, 8, 14];            // pixels par an, une frise
  const HAUTEURS_COTE = [1.2, 2.5, 5, 9];    // côte à côte
  const LARGEURS = [104, 136, 176, 232];     // largeur minimale d'une colonne
  const ENTETE = 48;
  const positions = new Map();               // où l'on en était, par planche

  function intervalles(mandats) {
    const maintenant = new Date().getFullYear() + 0.85;
    return mandats.map((m) => {
      const debut = Dates.nombre(m.debut);
      let fin = m.fin ? Dates.nombre(m.fin, true) : maintenant;
      if (fin < debut + 0.03) fin = debut + 0.03;
      return { m, debut, fin };
    });
  }

  function ouvrir(m) {
    if (m.ev) App.aller('#/c/' + m.ev);
    else if (m.q !== '-') App.aller('#/p/' + m.q);
    else Communs.toast(m.nom + (m.note ? ' — ' + m.note : ''));
  }

  /* frises : les frises à montrer (une ou plusieurs).
   * options : cle (réglages et position), cote (côte à côte), dateMarquee,
   * reprendre (revenir où l'on était). */
  function creerPlanche(frises, options) {
    const o = Object.assign({ cle: 'frise', cote: false, dateMarquee: null, reprendre: false }, options || {});
    const hauteurs = o.cote ? HAUTEURS_COTE : HAUTEURS;
    const minimum = o.cote ? 46 : 56;
    let zh = Math.min(hauteurs.length - 1, Reglages.lire('zoomH.' + o.cle, 1));
    let zl = Math.min(LARGEURS.length - 1, Reglages.lire('zoomL.' + o.cle, o.cote ? 0 : 1));
    const el = h('div', { class: 'planche' + (o.cote ? ' cote' : ''), tabindex: '0', 'aria-label': 'Frise : faites glisser pour la parcourir' });
    let echelle = null;
    let marque = o.dateMarquee || null;   // la date surlignée, « AAAA[-MM[-JJ]] », ou une période « début_fin »
    let colonnes = [];       // { frise, voie, sousTitre }
    let image = false;

    // ── Les commandes flottantes ────────────────────────────────────────────
    const bHm = h('button', { type: 'button', 'aria-label': 'Resserrer le temps', onclick: () => changer(-1, 0) }, icone('moins'));
    const bHp = h('button', { type: 'button', 'aria-label': 'Étirer le temps', onclick: () => changer(1, 0) }, icone('plus'));
    const bLm = h('button', { type: 'button', 'aria-label': 'Colonnes plus étroites', onclick: () => changer(0, -1) }, icone('moins'));
    const bLp = h('button', { type: 'button', 'aria-label': 'Colonnes plus larges', onclick: () => changer(0, 1) }, icone('plus'));
    const zoomeur = h('div', { class: 'zoomeur', role: 'group', 'aria-label': 'Zoom' },
      h('div', { class: 'rang' }, icone('hauteur', 'axe'), bHm, bHp),
      h('div', { class: 'rang' }, icone('largeur', 'axe'), bLm, bLp));
    const sauts = h('nav', { class: 'sauts', 'aria-label': 'Aller à un siècle' });

    function boutons() {
      bHm.disabled = zh === 0; bHp.disabled = zh === hauteurs.length - 1;
      bLm.disabled = zl === 0; bLp.disabled = zl === LARGEURS.length - 1;
    }

    function position() {
      if (!echelle) return null;
      return {
        annee: echelle.t(el.scrollTop + (el.clientHeight - ENTETE) / 2),
        fx: el.scrollWidth > el.clientWidth ? (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth : 0,
      };
    }

    function replacer(p) {
      if (!p) return;
      el.scrollTop = Math.max(0, echelle.y(p.annee) - (el.clientHeight - ENTETE) / 2);
      el.scrollLeft = p.fx ? Math.max(0, p.fx * el.scrollWidth - el.clientWidth / 2) : 0;
    }

    function changer(dh, dl) {
      const zh2 = Math.max(0, Math.min(hauteurs.length - 1, zh + dh));
      const zl2 = Math.max(0, Math.min(LARGEURS.length - 1, zl + dl));
      if (zh2 === zh && zl2 === zl) return;
      const p = position();
      zh = zh2; zl = zl2;
      Reglages.ecrire('zoomH.' + o.cle, zh);
      Reglages.ecrire('zoomL.' + o.cle, zl);
      dessiner();
      replacer(p);
      suivre();
    }

    // ── Le dessin ───────────────────────────────────────────────────────────
    function dessiner() {
      el.textContent = '';
      const tous = [];
      for (const f of frises) tous.push(...intervalles(f.mandats));
      echelle = Echelle.construire(tous, { pxParAn: hauteurs[zh], minimum });
      const seule = frises.length === 1;
      const regleL = 50;
      const railL = seule ? 24 : 0;
      const ecart = 6;

      // les voies et leur largeur
      const voies = [];
      for (const f of frises) {
        for (const v of f.voies) {
          const liste = Echelle.colonnes(intervalles(f.mandats.filter((m) => m.voie === v.id)));
          if (!liste.length) continue;
          /* La colonne s'élargit quand des règnes se chevauchent, mais sans
           * démesure : côte à côte, une fois et demie au plus (sinon on ne
           * voit plus qu'une frise) ; seule, trois fois. */
          const max = liste.reduce((n, it) => Math.max(n, it.nb), 1);
          const nb = o.cote ? (max >= 3 ? 1.5 : max === 2 ? 1.25 : 1) : Math.min(max, 3);
          voies.push({ f, v, liste, nb });
        }
      }
      let col = LARGEURS[zl];
      const dispo = (el.clientWidth || racine.innerWidth) - regleL - railL - ecart;
      const total = voies.reduce((s, x) => s + x.nb * col + ecart, 0);
      if (total < dispo) col = Math.floor(col * dispo / total);
      const largeurTotale = regleL + railL + voies.reduce((s, x) => s + x.nb * col + ecart, 0) + ecart;

      const contenu = h('div', { class: 'planche-contenu', style: { width: largeurTotale + 'px' } });

      // en-têtes figés
      const entetes = h('div', { class: 'planche-entetes', style: { height: ENTETE + 'px' } });
      entetes.appendChild(h('button', { type: 'button', class: 'coin', title: 'Choisir une date', 'aria-label': 'Choisir une date',
        style: { width: (regleL + railL) + 'px' }, onclick: () => { champ.focus(); champ.select(); } }, icone('recherche'), 'ans'));
      colonnes = [];
      for (const x of voies) {
        const titre = seule ? (x.f.voies.length > 1 ? x.v.nom : x.f.nom) : (x.f.voies.length > 1 && voies.filter((y) => y.f === x.f).length > 1 ? x.f.nom + ' · ' + x.v.nom : x.f.nom);
        const sous = h('div', { class: 'sous' });
        entetes.appendChild(h('div', { class: 'entete-voie', style: { width: (x.nb * col) + 'px', marginRight: ecart + 'px', '--teinte': x.f.couleur } },
          h('div', { class: 'titre' }, titre), sous));
        colonnes.push({ f: x.f, v: x.v, sous });
      }
      contenu.appendChild(entetes);

      const corps = h('div', { class: 'planche-corps', style: { height: echelle.hauteur + 'px' } });

      // la règle, figée à gauche
      const regle = h('div', { class: 'regle', style: { width: regleL + 'px' } });
      for (const g of Echelle.graduations(echelle, 44)) {
        regle.appendChild(h('span', { class: 'grad' + (g.siecle ? ' siecle' : ''), style: { top: g.y + 'px' } }, Dates.anneeTexte(String(g.annee))));
      }
      regle.addEventListener('click', (e) => {
        const r = regle.getBoundingClientRect();
        const an = Math.floor(echelle.t(e.clientY - r.top));
        marquer(String(Math.max(1, an)).padStart(4, '0'), 1);
      });
      corps.appendChild(regle);

      // le rail des périodes (une frise seule)
      if (seule) {
        const f = frises[0];
        const rail = h('div', { class: 'rail-periodes', style: { width: railL + 'px', left: regleL + 'px' } });
        for (const p of f.periodes) {
          if (p.voie && p.voie !== f.voies[0].id) continue;
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
        corps.appendChild(rail);
      }

      // les colonnes
      const cleMarque = marque ? [Dates.cle(parties()[0]), Dates.cle(parties()[1], true)] : null;
      for (const x of voies) {
        const largeurVoie = x.nb * col;
        const voie = h('div', { class: 'voie', style: { width: largeurVoie + 'px', marginRight: ecart + 'px' } });
        for (const it of x.liste) {
          const m = it.m;
          const y1 = echelle.y(it.debut), y2 = echelle.y(it.fin);
          const hauteur = Math.max(20, y2 - y1 - 3);
          const largeur = largeurVoie / it.nb;
          const court = hauteur < 62;
          const classes = ['bloc'];
          if (m.inst) classes.push('institution');
          if (court) classes.push('court');
          if (cleMarque && m.cleDebut <= cleMarque[1] && m.cleFin >= cleMarque[0]) classes.push('actif');
          // trop étroit pour un nom à l'horizontale : on l'écrit de haut en bas
          const etroit = largeur < 78 && hauteur >= 90;
          if (etroit) classes.push('etroit');
          const corpsBloc = h('div', { class: 'texte' });
          if (court || etroit) {
            corpsBloc.appendChild(h('div', { class: 'nom' }, m.nom, h('span', { class: 'dates' }, ' ' + annees(m))));
          } else {
            corpsBloc.appendChild(h('div', { class: 'nom' }, m.nom));
            corpsBloc.appendChild(h('div', { class: 'dates' }, annees(m)));
            if (!o.cote && hauteur >= 96 && m.titre) corpsBloc.appendChild(h('div', { class: 'fonction' }, majuscule(m.titre)));
            if (!o.cote && hauteur >= 150 && m.note) corpsBloc.appendChild(h('div', { class: 'note' }, m.note));
          }
          const avecPortrait = !m.inst && hauteur >= 62 && largeur >= (o.cote ? 170 : 150);
          voie.appendChild(h('button', {
            type: 'button', class: classes.join(' '), 'data-mandat': m.id,
            title: m.nom + ' · ' + annees(m) + (m.titre ? ' · ' + m.titre : ''),
            style: { top: y1 + 'px', height: hauteur + 'px', left: (it.col * largeur) + 'px', width: (largeur - (it.nb > 1 ? 3 : 0)) + 'px', '--teinte': teinte(m) },
            onclick: () => ouvrir(m),
          }, avecPortrait ? portrait(m.q) : null, corpsBloc));
        }
        corps.appendChild(voie);
      }

      if (marque) {
        const b = bornesMarque();
        const y1 = echelle.y(b[0]), y2 = echelle.y(b[1]);
        corps.appendChild(h('div', { class: 'bande-date', style: { top: y1 + 'px', height: Math.max(4, y2 - y1) + 'px' } }, h('span', { style: { left: (regleL + railL + 6) + 'px' } }, libelleMarque())));
      }
      contenu.appendChild(corps);
      el.appendChild(contenu);

      // le raccourci par siècle
      sauts.textContent = '';
      const premier = Math.ceil(echelle.debut / 100) * 100;
      const liste = [];
      for (let a = premier; a < echelle.fin; a += 100) {
        const b = h('button', { type: 'button', onclick: () => allerAnnee(a) }, Dates.romain(a / 100 + 1) + 'ᵉ');
        b._annee = a;
        liste.push(b);
        sauts.appendChild(b);
      }
      if (liste.length > 16) liste.forEach((b, i) => { if (i % 2 === 1) b.hidden = true; });
      sauts._boutons = liste;
      boutons();
    }

    /* L'intervalle surligné : l'année entière, le mois, ou le jour. */
    function parties() {
      const i = marque.indexOf('_');
      return i === -1 ? [marque, marque] : [marque.slice(0, i), marque.slice(i + 1)];
    }
    function bornesMarque() {
      const [a, b] = parties();
      const p = Dates.analyser(b);
      const d = Dates.nombre(b);
      return [Dates.nombre(a), p.jour ? d + 1 / 365 : p.mois ? d + 1 / 12 : d + 1];
    }
    function libelleMarque() {
      const [a, b] = parties();
      return a === b ? Dates.lire(a) : Dates.lire(a) + ' – ' + Dates.lire(b);
    }
    /* Se place sur le bandeau : au milieu s'il tient à l'écran, sinon à son début. */
    function sePlacer() {
      const b = bornesMarque();
      const y1 = echelle.y(b[0]), y2 = echelle.y(b[1]);
      const vu = el.clientHeight - ENTETE;
      el.scrollTop = Math.max(0, y2 - y1 > vu - 60 ? y1 - 40 : (y1 + y2) / 2 - vu / 2);
    }

    /* Surligne une date et s'y place. `zoom` : crans de hauteur à ajouter. */
    function marquer(date, zoom) {
      marque = date;
      if (date && zoom) {
        zh = Math.min(hauteurs.length - 1, zh + zoom);
        Reglages.ecrire('zoomH.' + o.cle, zh);
      }
      const fx = position();
      dessiner();
      if (date) {
        sePlacer();
        if (fx && fx.fx) el.scrollLeft = Math.max(0, fx.fx * el.scrollWidth - el.clientWidth / 2);
      } else replacer(fx);
      suivre();
      majBarre();
      if (o.surDate) o.surDate(date);
    }

    /* « 1515 », « 1789-07-14 », « 14/07/1789 », « 07/1789 » → clé de date. */
    function lireSaisie(texte) {
      const brut = texte.trim();
      // une période : « 1516-1519 », « 1516 – 1519 », « 1516 à 1519 », « 14/07/1789 – 27/07/1794 »
      let per = /^([0-9]{3,4})[ ]*-[ ]*([0-9]{3,4})$/.exec(brut) || /^(.+?)[ ]*(?:–|—|[ ]à[ ]|[ ]au[ ]|[.][.])[ ]*(.+)$/.exec(brut);
      if (per) {
        const a = lireUne(per[1]), b = lireUne(per[2]);
        if (!a || !b) return null;
        if (a === b) return a;
        return Dates.cle(a) <= Dates.cle(b) ? a + '_' + b : b + '_' + a;
      }
      return lireUne(brut);
    }
    function lireUne(texte) {
      const t = texte.trim().replace(/[ .]/g, '/').replace(/-/g, '/');
      let m = /^([0-9]{1,4})$/.exec(t);
      if (m) return m[1].padStart(4, '0');
      m = /^([0-9]{1,4})[/]([0-9]{1,2})(?:[/]([0-9]{1,2}))?$/.exec(t);
      if (m && parseInt(m[1], 10) > 31) return m[1].padStart(4, '0') + '-' + m[2].padStart(2, '0') + (m[3] ? '-' + m[3].padStart(2, '0') : '');
      m = /^(?:([0-9]{1,2})[/])?([0-9]{1,2})[/]([0-9]{1,4})$/.exec(t);
      if (m) return m[3].padStart(4, '0') + '-' + m[2].padStart(2, '0') + (m[1] ? '-' + m[1].padStart(2, '0') : '');
      return null;
    }

    // ── La barre de date ────────────────────────────────────────────────────
    const champ = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: '1515, 14/07/1789 ou 1516-1519', 'aria-label': 'Année, date ou période à surligner' });
    const actions = h('div', { class: 'actions' });
    function valable(d) {
      const p = Dates.analyser(d);
      return p && p.annee >= 1 && p.annee <= new Date().getFullYear() && !(p.mois && (p.mois < 1 || p.mois > 12)) && !(p.jour && (p.jour < 1 || p.jour > 31));
    }
    function valider() {
      const d = lireSaisie(champ.value);
      if (!d || !d.split('_').every(valable)) {
        Communs.toast('Entrez une année (1515), une date (14/07/1789) ou une période (1516-1519).');
        return;
      }
      champ.blur();
      marquer(d, zh < 2 ? 2 - zh : 0);
    }
    champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); valider(); } });
    const barre = h('div', { class: 'barre-date' },
      h('div', { class: 'saisie' }, icone('calendrier', 'discret'), champ, h('button', { type: 'button', class: 'aller', onclick: valider }, 'Aller')),
      actions);
    function majBarre() {
      actions.textContent = '';
      if (!marque) { champ.value = ''; return; }
      const ecrit = (d) => {
        const p = Dates.analyser(d);
        return p.jour ? String(p.jour).padStart(2, '0') + '/' + String(p.mois).padStart(2, '0') + '/' + p.annee : p.mois ? String(p.mois).padStart(2, '0') + '/' + p.annee : String(p.annee);
      };
      const [a, b] = parties();
      champ.value = a === b ? ecrit(a) : (/^[0-9]+$/.test(a + b) ? ecrit(a) + '-' + ecrit(b) : ecrit(a) + ' – ' + ecrit(b));
      actions.appendChild(h('span', { class: 'lue' }, libelleMarque()));
      if (!o.toutes) actions.appendChild(h('a', { class: 'puce', href: '#/comparer?date=' + marque + '&toutes=1' }, icone('comparer'), 'Toutes les frises'));
      actions.appendChild(h('a', { class: 'puce puce-claire', href: '#/date/' + a }, a === b ? 'Qui est en place ?' : 'En place en ' + Dates.anneeTexte(a) + ' ?'));
      actions.appendChild(h('button', { type: 'button', class: 'puce puce-claire', 'aria-label': 'Retirer la date', onclick: () => marquer(null) }, icone('fermer')));
    }
    majBarre();

    function allerAnnee(a, doux) {
      el.scrollTo({ top: Math.max(0, echelle.y(a) - 10), behavior: doux === false ? 'auto' : 'smooth' });
    }

    /* Ce qui suit le défilement : le siècle allumé, et sous chaque titre de
     * colonne la période (dynastie, régime) qu'on a en haut de l'écran. */
    function suivre() {
      image = false;
      if (!echelle) return;
      const an = echelle.t(el.scrollTop + 14);
      for (const b of sauts._boutons || []) b.classList.toggle('actif', an >= b._annee && an < b._annee + 100);
      for (const c of colonnes) {
        let nom = '';
        for (const p of c.f.periodes) {
          if ((p.voie || c.f.voies[0].id) !== c.v.id) continue;
          const d = Dates.nombre(p.debut), f = p.fin ? Dates.nombre(p.fin, true) : 9999;
          if (an >= d - 0.5 && an <= f) nom = p.nom;
        }
        const texte = nom ? nom + ' · ' + Math.round(an) : String(Math.round(an));
        if (c.sous.textContent !== texte) c.sous.textContent = texte;
      }
    }
    el.addEventListener('scroll', () => { if (!image) { image = true; requestAnimationFrame(suivre); } }, { passive: true });

    // ── Pincement et Ctrl + molette ─────────────────────────────────────────
    let pince = null;
    function ecartDoigts(e) {
      const a = e.touches[0], b = e.touches[1];
      return { dx: Math.abs(a.clientX - b.clientX), dy: Math.abs(a.clientY - b.clientY) };
    }
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) { const d = ecartDoigts(e); pince = { dx: d.dx, dy: d.dy, fait: false }; }
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (!pince || e.touches.length !== 2) return;
      e.preventDefault();
      if (pince.fait) return;
      const d = ecartDoigts(e);
      const avant = Math.hypot(pince.dx, pince.dy), apres = Math.hypot(d.dx, d.dy);
      if (avant < 20) return;
      const r = apres / avant;
      if (r > 1.3 || r < 0.77) {
        const sens = r > 1 ? 1 : -1;
        const horizontal = pince.dx > pince.dy * 1.7, vertical = pince.dy > pince.dx * 1.7;
        changer(horizontal ? 0 : sens, vertical ? 0 : sens);
        pince = { dx: d.dx, dy: d.dy, fait: false };   // on peut continuer à écarter
      }
    }, { passive: false });
    el.addEventListener('touchend', (e) => { if (e.touches.length < 2) pince = null; }, { passive: true });
    el.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      changer(e.deltaY < 0 ? 1 : -1, e.shiftKey ? (e.deltaY < 0 ? 1 : -1) : 0);
    }, { passive: false });

    // ── La taille du cadre : tout ce qui reste d'écran ──────────────────────
    function ajuster() {
      const haut = el.getBoundingClientRect().top;
      const nav = document.getElementById('nav');
      const bas = nav ? nav.offsetHeight : 0;
      el.style.height = Math.max(260, racine.innerHeight - haut - bas) + 'px';
    }
    function surTaille() { const p = position(); ajuster(); dessiner(); replacer(p); suivre(); }

    /* À appeler une fois la planche dans la page. */
    function installer() {
      document.getElementById('vue').classList.add('plein');
      document.body.appendChild(zoomeur);
      document.body.appendChild(sauts);
      racine.scrollTo(0, 0);
      ajuster();
      dessiner();
      const ancienne = positions.get(o.cle);
      if (marque && !(o.reprendre && ancienne)) {
        sePlacer();
      } else if (ancienne && (o.reprendre || o.garder)) {
        replacer(ancienne);
      }
      suivre();
      racine.addEventListener('resize', surTaille);
    }

    function quitter() {
      const p = position();
      if (p) positions.set(o.cle, p);
      zoomeur.remove();
      sauts.remove();
      racine.removeEventListener('resize', surTaille);
      const vue = document.getElementById('vue');
      if (vue) vue.classList.remove('plein');
    }

    return { el, barre, installer, quitter, allerAnnee, position, marquer, get date() { return marque; } };
  }

  // ── La vue liste ──────────────────────────────────────────────────────────
  function dessinerListe(f) {
    const liste = h('div', { class: 'liste-frise' });
    for (const p of f.periodes) {
      const mandats = f.mandats.filter((m) => m.periode === p.id);
      if (!mandats.length) continue;
      liste.appendChild(h('div', { class: 'entete-periode', style: { '--teinte': p.couleur } }, h('span', { class: 'pastille' }),
        h('h3', null, p.nom), h('span', { class: 'discret' }, Dates.anneeTexte(p.debut) + ' – ' + (p.fin ? Dates.anneeTexte(p.fin) : 'aujourd’hui'))));
      if (p.note) liste.appendChild(h('p', { class: 'discret petit note-periode' }, p.note));
      for (const m of mandats) {
        const d = Dates.duree(m.debut, m.fin, { finInclusive: true });
        liste.appendChild(h('button', { type: 'button', class: 'rangee', style: { '--teinte': teinte(m) }, onclick: () => ouvrir(m) },
          m.inst ? portrait(null) : portrait(m.q),
          h('div', { class: 'texte' }, h('div', { class: 'nom' }, m.nom), h('div', { class: 'dates' }, annees(m) + (f.voies.length > 1 ? ' · ' + Donnees.voie(m).nom : '')),
            h('div', { class: 'fonction' }, majuscule(m.titre) + (m.note ? ' — ' + m.note : ''))),
          h('div', { class: 'duree' }, d)));
      }
    }
    return liste;
  }

  // ── La vue d'une frise ────────────────────────────────────────────────────
  function dessiner(zone, params) {
    const f = Donnees.frise(params.id);
    if (!f) { zone.appendChild(h('p', { class: 'page' }, 'Frise inconnue.')); return { titre: 'Histoires' }; }
    const page = h('div', { class: 'page-large' });
    let mode = Reglages.lire('mode.' + f.id, 'frise');
    const barre = h('div', { class: 'barre-frise' });
    const corps = h('div');
    let planche = null;
    let premiere = true;
    let date = params.date || null;

    function allerPeriode(p) {
      if (planche) planche.allerAnnee(Dates.nombre(p.debut));
      else {
        const entetes = corps.querySelectorAll('.entete-periode');
        const visibles = f.periodes.filter((x) => f.mandats.some((m) => m.periode === x.id));
        const i = visibles.indexOf(p);
        if (entetes[i]) entetes[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    function redessiner() {
      if (planche) { planche.quitter(); planche = null; }
      corps.textContent = '';
      barre.textContent = '';
      barre.appendChild(h('button', { type: 'button', class: 'bouton-icone', 'aria-label': mode === 'frise' ? 'Afficher en liste' : 'Afficher la frise', onclick: () => {
        mode = mode === 'frise' ? 'liste' : 'frise'; Reglages.ecrire('mode.' + f.id, mode); redessiner();
      } }, icone(mode === 'frise' ? 'liste' : 'frise')));
      for (const p of f.periodes) {
        barre.appendChild(h('button', { type: 'button', class: 'puce puce-claire', style: { '--teinte': p.couleur }, onclick: () => allerPeriode(p) }, p.nom));
      }
      if (mode === 'frise') {
        planche = creerPlanche([f], { cle: 'frise.' + f.id, dateMarquee: date, reprendre: !!params.retour, garder: !premiere,
          surDate: (d) => { date = d; App.remplacer('#/frise/' + f.id + (d ? '?date=' + d : '')); } });
        corps.appendChild(planche.barre);
        corps.appendChild(planche.el);
        if (corps.isConnected) planche.installer();
      } else {
        corps.appendChild(dessinerListe(f));
      }
      premiere = false;
    }

    redessiner();
    page.appendChild(barre);
    page.appendChild(corps);
    zone.appendChild(page);
    if (planche) planche.installer();
    return { titre: f.nom, sous: f.titre, couleur: f.couleur, quitter: () => { if (planche) planche.quitter(); } };
  }

  racine.VueFrise = { dessiner, creerPlanche };

})(window);
