'use strict';
/*
 * La fiche d'un personnage : état civil, mandats et voisins, repères datés,
 * famille, contemporains, résumé de Wikipédia, crédits.
 */
(function (racine) {

  const { h, icone } = Outils;
  const { portrait, annees, teinte, majuscule, cadre } = Communs;

  function datesVie(p) {
    if (!p.naissance && !p.mort) return '';
    const a = p.naissance ? Dates.anneeTexte(p.naissance) : '?';
    const b = p.mort ? Dates.anneeTexte(p.mort) : (p.humain ? '' : '');
    return b ? a + ' – ' + b : (p.humain && p.naissance ? 'né' + (feminin(p) ? 'e' : '') + ' en ' + a : a);
  }

  function feminin(p) {
    return /reine|impératrice|chancelière|présidente|dame/i.test(p.desc || '') || /^(Marie|Élisabeth|Anne|Victoria|Jeanne|Mathilde|Angela|Sabine)\b/.test(p.nom);
  }

  function membre(role, m) {
    const dates = m.n || m.m ? ' ' : '';
    const texte = h('div', { class: 'texte' },
      h('div', { class: 'role' }, role),
      h('div', { class: 'nom' }, m.nom),
      h('div', { class: 'dates' }, [m.n ? Dates.anneeTexte(m.n) : '', m.m ? Dates.anneeTexte(m.m) : ''].filter(Boolean).join(' – ') + (m.debut ? ' · mariage ' + Dates.lireAvecPreposition(m.debut).replace(/^le /, 'le ') : '')));
    if (m.app) return h('a', { class: 'membre', href: '#/p/' + m.q }, portrait(m.q), texte, icone('droite', 'fleche'));
    return h('div', { class: 'membre' }, h('span', { class: 'portrait portrait-vide', style: { width: '36px', height: '36px' } }, icone('personne')), texte, dates ? null : null);
  }

  function voisins(m) {
    const bloc = h('div', { class: 'voisins' });
    const prec = m.precedent, suiv = m.suivant;
    const lien = (x, sens) => {
      if (!x) return h('span', { style: { flex: 1 } });
      const el = h(x.q !== '-' ? 'a' : 'div', { class: sens, href: x.q !== '-' ? '#/p/' + x.q : null },
        sens === 'precedent' ? icone('gauche') : null,
        h('div', { class: 'texte' }, h('div', { class: 'sens' }, sens === 'precedent' ? 'Avant' : 'Après'), h('div', { class: 'qui' }, x.nom), h('div', { class: 'petit discret' }, annees(x))),
        sens === 'suivant' ? icone('droite') : null);
      return el;
    };
    bloc.appendChild(lien(prec, 'precedent'));
    bloc.appendChild(lien(suiv, 'suivant'));
    return bloc;
  }

  function reperes(q, p, mandats) {
    const liste = [];
    const fem = feminin(p);
    if (p.naissance) liste.push({ d: p.naissance, cls: 'vie', t: 'Naissance' + (p.lieu_naissance ? ', ' + lieu(p.lieu_naissance) : '') });
    for (const c of p.conjoints) if (c.debut) liste.push({ d: c.debut, cls: 'famille', t: 'Mariage avec ' + c.nom, q: c.app ? c.q : null });
    for (const m of mandats) {
      const f = Donnees.frise(m.frise);
      liste.push({ d: m.debut, cls: 'mandat', teinte: teinte(m), t: (m.inst ? '' : 'Devient ') + m.titre + (mandats.length > 1 ? ' (' + cadre(m) + ')' : '') + (m.note ? ' — ' + m.note : ''), frise: m });
      if (m.fin) liste.push({ d: m.fin, cls: 'mandat', teinte: teinte(m), t: 'Fin : ' + m.titre, fin: true });
    }
    for (const e of p.evenements) liste.push({ d: e.date, cls: 'evenement', t: majuscule(e.nom) });
    const dejaTitres = new Set(mandats.map((m) => Outils.normaliser(m.titre)));
    let nbFonctions = 0;
    for (const fo of p.fonctions) {
      if (dejaTitres.has(Outils.normaliser(fo.nom))) continue;
      if (nbFonctions++ >= 10) break;
      liste.push({ d: fo.debut, cls: 'fonction', t: majuscule(fo.nom) + (fo.fin ? ' (jusqu’en ' + Dates.anneeTexte(fo.fin) + ')' : '') });
    }
    if (p.mort) {
      let t = 'Mort' + (fem ? 'e' : '') + (p.lieu_mort ? ', ' + lieu(p.lieu_mort) : '');
      const causes = (p.maniere_mort || []).concat(p.cause_mort || []).filter((c) => !/mort naturelle|natural causes/i.test(c));
      if (causes.length) t += ' — ' + causes.slice(0, 2).join(', ');
      if (p.naissance) {
        const a = Dates.age(p.naissance, p.mort);
        if (a != null) t += ' — à ' + a + ' ans';
      }
      liste.push({ d: p.mort, cls: 'vie', t });
      if (p.sepulture) liste.push({ d: p.mort, cls: 'vie-sep', t: 'Inhumation : ' + p.sepulture, apres: true });
    }
    liste.sort((a, b) => {
      const ka = Dates.cle(a.d) + (a.fin ? '1' : a.apres ? '2' : '0'), kb = Dates.cle(b.d) + (b.fin ? '1' : b.apres ? '2' : '0');
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    // les doublons exacts (deux fonctions Wikidata identiques)
    const vus = new Set();
    const ul = h('ul', { class: 'reperes' });
    for (const r of liste) {
      const k = r.d + '|' + r.t;
      if (vus.has(k)) continue;
      vus.add(k);
      const li = h('li', { class: r.cls, style: r.teinte ? { '--teinte': r.teinte } : null },
        h('div', { class: 'quand' }, majuscule(Dates.lireAvecPreposition(r.d))),
        h('div', { class: 'quoi' }, r.q ? h('a', { class: 'renvoi', href: '#/p/' + r.q }, r.t) : r.t));
      ul.appendChild(li);
    }
    return ul;
  }

  function lieu(l) { return /^(château|basilique|cathédrale|abbaye|palais|hôtel|église|monastère)/i.test(l) ? 'au ' + l.replace(/^(château|palais|hôtel|monastère)/i, (x) => x.toLowerCase()) : 'à ' + l; }

  function contemporains(q, mandats) {
    if (!mandats.length) return null;
    const principal = mandats.slice().sort((a, b) => (Dates.nombre(b.fin, true) || 2100) - Dates.nombre(b.debut) - ((Dates.nombre(a.fin, true) || 2100) - Dates.nombre(a.debut)))[0];
    const debut = Dates.nombre(principal.debut), fin = principal.fin ? Dates.nombre(principal.fin, true) : new Date().getFullYear();
    const milieu = Math.floor((debut + fin) / 2);
    const cle = String(milieu).padStart(4, '0') + '-07-01';
    const grille = h('div', { class: 'contemporains' });
    for (const l of Donnees.tableau(cle)) {
      const m = l.mandats.find((x) => x.q !== q) || null;
      if (!m || l.mandats.some((x) => x.q === q)) continue;
      grille.appendChild(h(m.q !== '-' ? 'a' : 'div', { class: 'contemporain', href: m.q !== '-' ? '#/p/' + m.q : null, style: { '--teinte': teinte(m) } },
        m.inst ? null : portrait(m.q),
        h('div', { class: 'texte' }, h('div', { class: 'cadre' }, cadre(m)), h('div', { class: 'nom' }, m.nom), h('div', { class: 'petit discret' }, annees(m)))));
    }
    if (!grille.children.length) return null;
    return h('section', null, h('h3', { class: 'titre-section' }, 'À la même époque', h('span', { class: 'discret' }, 'en ' + milieu)), grille);
  }

  function visionneuse(q, p) {
    const url = Donnees.urlImage(q);
    if (!url) return;
    const v = h('div', { class: 'visionneuse', role: 'dialog', 'aria-label': 'Portrait' });
    const fermer = () => { v.remove(); App.surRetour = null; };
    v.appendChild(h('button', { type: 'button', class: 'bouton-icone', 'aria-label': 'Fermer', onclick: fermer }, icone('fermer')));
    v.appendChild(h('img', { src: url, alt: 'Portrait de ' + p.nom }));
    v.appendChild(h('p', { class: 'credit' }, creditTexte(p)));
    v.addEventListener('click', (e) => { if (e.target === v) fermer(); });
    document.body.appendChild(v);
    App.surRetour = fermer;
  }

  function creditTexte(p) {
    const c = p.portrait;
    if (!c) return '';
    const lic = { pd: 'domaine public', cc0: 'CC0', lo: 'Licence Ouverte', ogl: 'Open Government Licence' }[c.licence] || c.licence.toUpperCase();
    return 'Image : ' + (c.auteur ? c.auteur + ', ' : '') + lic + ', via Wikimedia Commons.';
  }

  function dessiner(zone, params) {
    const q = params.id;
    const p = Donnees.personne(q);
    if (!p) { zone.appendChild(h('p', { class: 'page' }, 'Fiche introuvable.')); return { titre: 'Histoires' }; }
    const mandats = Donnees.mandatsDe(q);
    const page = h('div', { class: 'page' });

    // En-tête
    const url = Donnees.urlImage(q);
    const image = url
      ? h('img', { class: 'grand-portrait', src: url, alt: 'Portrait de ' + p.nom, onclick: () => visionneuse(q, p) })
      : h('div', { class: 'grand-portrait vide' }, icone(p.humain ? 'personne' : 'couronne'));
    const entete = h('div', { class: 'texte' });
    entete.appendChild(h('h2', null, p.nom));
    const principal = mandats[0];
    if (principal) {
      const titres = [];
      for (const m of mandats) {
        const t = majuscule(m.titre) + ' (' + annees(m) + ')';
        if (!titres.includes(t)) titres.push(t);
      }
      entete.appendChild(h('div', { class: 'fonction-principale' }, titres.slice(0, 3).join(' · ')));
    } else if (p.desc) {
      entete.appendChild(h('div', { class: 'fonction-principale' }, majuscule(p.desc)));
    }
    if (p.humain) {
      const vie = [];
      if (p.naissance) vie.push('Né' + (feminin(p) ? 'e' : '') + ' ' + Dates.lireAvecPreposition(p.naissance) + (p.lieu_naissance ? ' ' + lieu(p.lieu_naissance) : ''));
      if (p.mort) {
        let m = 'mort' + (feminin(p) ? 'e' : '') + ' ' + Dates.lireAvecPreposition(p.mort) + (p.lieu_mort ? ' ' + lieu(p.lieu_mort) : '');
        if (p.naissance) { const a = Dates.age(p.naissance, p.mort); if (a != null) m += ' (' + a + ' ans)'; }
        vie.push(m);
      } else if (p.naissance) {
        const a = Dates.age(p.naissance);
        if (a != null && a < 110) vie.push(a + ' ans');
      }
      if (vie.length) entete.appendChild(h('div', { class: 'vie' }, vie.join(' · ')));
    }
    const puces = h('div', { class: 'puces' });
    const vues = new Set();
    for (const m of mandats) {
      const per = Donnees.periode(m);
      const k = m.frise + ':' + m.periode;
      if (vues.has(k)) continue;
      vues.add(k);
      puces.appendChild(h('a', { class: 'puce', href: '#/frise/' + m.frise + '?date=' + m.debut, style: { '--teinte': per.couleur } }, Donnees.frise(m.frise).nom + ' · ' + per.nom));
    }
    for (const ma of (p.maison || []).slice(0, 2)) puces.appendChild(h('span', { class: 'puce puce-claire' }, majuscule(ma)));
    entete.appendChild(puces);
    page.appendChild(h('div', { class: 'fiche-entete' }, image, entete));

    // Mandats et voisins
    if (mandats.length) {
      const sec = h('section');
      sec.appendChild(h('h3', { class: 'titre-section' }, mandats.length > 1 ? 'En fonction' : 'En fonction'));
      for (const m of mandats) {
        const f = Donnees.frise(m.frise), per = Donnees.periode(m);
        const d = Dates.duree(m.debut, m.fin, { finInclusive: true });
        sec.appendChild(h('div', { class: 'mandat-ligne', style: { '--teinte': teinte(m) } }, h('span', { class: 'pastille' }),
          h('div', { class: 'texte' },
            h('div', { class: 'fonction' }, majuscule(m.titre)),
            h('div', { class: 'cadre' }, cadre(m) + ' · ' + per.nom),
            h('div', { class: 'petit' }, majuscule(Communs.datesCompletes(m)) + (d ? ' — ' + d : '')),
            m.note ? h('div', { class: 'petit discret' }, m.note) : null),
          h('a', { class: 'bouton-icone', href: '#/frise/' + f.id + '?date=' + m.debut, 'aria-label': 'Voir sur la frise', title: 'Voir sur la frise' }, icone('frise'))));
        sec.appendChild(voisins(m));
      }
      page.appendChild(sec);
    }

    // Repères
    const rep = reperes(q, p, mandats);
    if (rep.children.length) page.appendChild(h('section', null, h('h3', { class: 'titre-section' }, 'Repères'), rep));

    // Famille
    if (p.humain && (p.pere || p.mere || p.conjoints.length || p.enfants.length)) {
      const fam = h('div', { class: 'famille' });
      if (p.pere) fam.appendChild(membre('Père', p.pere));
      if (p.mere) fam.appendChild(membre('Mère', p.mere));
      const fem = feminin(p);
      p.conjoints.forEach((c, i) => fam.appendChild(membre((fem ? 'Époux' : 'Épouse') + (p.conjoints.length > 1 ? ' ' + (i + 1) : ''), c)));
      const enfants = p.enfants;
      const titreEnfants = enfants.length ? h('div', { class: 'etiquette', style: { margin: '10px 0 2px' } }, Outils.pluriel(enfants.length, 'enfant')) : null;
      if (titreEnfants) fam.appendChild(titreEnfants);
      let nb = 0;
      const plus = h('button', { type: 'button', class: 'bouton-discret', hidden: true }, 'Tous les enfants');
      for (const e of enfants) {
        const el = membre('Enfant', e);
        if (nb++ >= 6 && !e.app) { el.hidden = true; el.classList.add('cache'); plus.hidden = false; }
        fam.appendChild(el);
      }
      plus.addEventListener('click', () => { fam.querySelectorAll('.cache').forEach((el) => { el.hidden = false; }); plus.remove(); });
      fam.appendChild(plus);
      page.appendChild(h('section', null, h('h3', { class: 'titre-section' }, 'Famille', h('span', { class: 'discret' }, 'les noms dorés ont leur fiche')), fam));
    }

    // Croisades
    if (p.croisades && p.croisades.length) {
      const sec = h('section');
      sec.appendChild(h('h3', { class: 'titre-section' }, 'Croisades', h('span', { class: 'discret' }, p.croisades.some((c) => c.camp === 'musulman') ? 'du côté musulman' : 'du côté chrétien')));
      for (const part of p.croisades) {
        const c = Donnees.croisade(part.id);
        if (!c) continue;
        sec.appendChild(h('a', { class: 'carte carte-lien carte-frise', href: '#/c/' + c.id, style: { '--teinte': '#9b2335' } },
          h('div', { class: 'bande' }),
          h('div', { class: 'corps' }, h('p', { class: 'carte-titre' }, c.nom), h('p', { class: 'discret petit' }, Dates.anneeTexte(c.debut) + ' – ' + Dates.anneeTexte(c.fin) + ' · ' + majuscule(part.role))),
          icone('droite', 'fleche')));
      }
      page.appendChild(sec);
    }

    // Contemporains
    const ct = contemporains(q, mandats);
    if (ct) page.appendChild(ct);

    // Résumé
    const sec = h('section');
    sec.appendChild(h('h3', { class: 'titre-section' }, 'En quelques mots', h('span', { class: 'discret' }, 'd’après Wikipédia')));
    if (p.texte) {
      const r = h('div', { class: 'resume' });
      for (const para of p.texte.split('\n')) r.appendChild(h('p', null, para));
      sec.appendChild(r);
    } else {
      sec.appendChild(h('p', { class: 'discret' }, p.desc ? majuscule(p.desc) + '.' : 'Pas de résumé disponible.'));
    }
    const liens = h('div', { class: 'liens-ext' });
    if (p.wp) liens.appendChild(h('a', { class: 'bouton-discret', href: 'https://fr.wikipedia.org/wiki/' + encodeURIComponent(p.wp.replace(/ /g, '_')), target: '_blank', rel: 'noopener noreferrer' }, icone('externe'), 'Lire sur Wikipédia'));
    liens.appendChild(h('a', { class: 'bouton-discret', href: 'https://www.wikidata.org/wiki/' + q, target: '_blank', rel: 'noopener noreferrer' }, icone('externe'), 'Wikidata'));
    sec.appendChild(liens);
    const credits = [];
    if (p.texte) credits.push('Texte : extrait de l’article « ' + p.wp + ' » de Wikipédia en français, licence CC BY-SA 4.0.');
    if (p.portrait) credits.push(creditTexte(p) + (p.portrait.page ? ' ' : ''));
    credits.push('Dates et filiations : Wikidata (CC0).');
    sec.appendChild(h('p', { class: 'credit', style: { marginTop: '12px' } }, credits.join(' '), p.portrait && p.portrait.page ? h('a', { class: 'renvoi', href: p.portrait.page, target: '_blank', rel: 'noopener noreferrer' }, 'Source de l’image') : null));
    page.appendChild(sec);

    zone.appendChild(page);
    return { titre: p.nom, sous: principal ? majuscule(principal.titre) : (p.desc || ''), couleur: principal ? teinte(principal) : null };
  }

  racine.VueFiche = { dessiner };

})(window);
