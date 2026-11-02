'use strict';
/*
 * Une croisade : dates, résumé, chefs chrétiens et musulmans (fiches), les
 * souverains en place au départ, la chronologie, le bilan.
 */
(function (racine) {

  const { h, icone } = Outils;
  const { portrait, annees, teinte, majuscule, cadre } = Communs;

  function chef(p) {
    const fiche = Donnees.personne(p.q);
    const mandats = Donnees.mandatsDe(p.q);
    const dates = fiche && (fiche.naissance || fiche.mort) ? [fiche.naissance ? Dates.anneeTexte(fiche.naissance) : '?', fiche.mort ? Dates.anneeTexte(fiche.mort) : ''].join(' – ') : '';
    return h('a', { class: 'membre', href: '#/p/' + p.q, style: mandats[0] ? { '--teinte': teinte(mandats[0]) } : null },
      portrait(p.q),
      h('div', { class: 'texte' }, h('div', { class: 'nom' }, p.nom), h('div', { class: 'dates' }, majuscule(p.role) + (dates ? ' · ' + dates : ''))),
      icone('droite', 'fleche'));
  }

  function enPlace(c) {
    const cle = Dates.cle(c.debut);
    const grille = h('div', { class: 'contemporains' });
    for (const l of Donnees.tableau(cle)) {
      if (l.frise.id === 'croisades') continue;
      const m = l.mandats[0];
      if (!m || m.inst) continue;
      grille.appendChild(h('a', { class: 'contemporain', href: '#/p/' + m.q, style: { '--teinte': teinte(m) } },
        portrait(m.q), h('div', { class: 'texte' }, h('div', { class: 'cadre' }, cadre(m)), h('div', { class: 'nom' }, m.nom), h('div', { class: 'petit discret' }, annees(m)))));
    }
    return grille;
  }

  function dessiner(zone, params) {
    const c = Donnees.croisade(params.id);
    if (!c) { zone.appendChild(h('p', { class: 'page' }, 'Croisade introuvable.')); return { titre: 'Histoires' }; }
    const page = h('div', { class: 'page' });
    const liste = Donnees.croisades;
    const i = liste.indexOf(c);

    page.appendChild(h('div', { class: 'entete-croisade' },
      h('div', { class: 'etiquette' }, 'Croisade · ' + Dates.anneeTexte(c.debut) + ' – ' + Dates.anneeTexte(c.fin)),
      h('h2', null, c.nom),
      h('p', { class: 'sous-titre-croisade' }, c.sousTitre),
      h('div', { class: 'puces' }, h('a', { class: 'puce', href: '#/frise/croisades?date=' + c.debut, style: { '--teinte': '#9b2335' } }, 'Voir sur la frise'),
        h('a', { class: 'puce puce-claire', href: '#/date/' + c.debut }, 'Qui est en place en ' + Dates.anneeTexte(c.debut)))));

    const resume = h('div', { class: 'resume' });
    for (const p of c.resume) resume.appendChild(h('p', null, p));
    page.appendChild(resume);

    const chretiens = h('div', { class: 'famille' });
    for (const p of c.chretiens) chretiens.appendChild(chef(p));
    page.appendChild(h('section', null, h('h3', { class: 'titre-section' }, 'Du côté chrétien', h('span', { class: 'discret' }, Outils.pluriel(c.chretiens.length, 'chef'))), chretiens));

    if (c.musulmans.length) {
      const musulmans = h('div', { class: 'famille' });
      for (const p of c.musulmans) musulmans.appendChild(chef(p));
      page.appendChild(h('section', null, h('h3', { class: 'titre-section' }, 'Du côté musulman', h('span', { class: 'discret' }, Outils.pluriel(c.musulmans.length, 'chef'))), musulmans));
    }

    const ul = h('ul', { class: 'reperes' });
    for (const r of c.reperes) {
      const cls = /mort|tué|meurt|noie|assassin|décapit|exécut/i.test(r.fait) ? 'vie' : (/prise|tomb|capitul|rend|sac |chute|s’effondre|évacu/i.test(r.fait) ? 'mandat' : 'evenement');
      ul.appendChild(h('li', { class: cls, style: { '--teinte': '#9b2335' } }, h('div', { class: 'quand' }, majuscule(Dates.lireAvecPreposition(r.date))), h('div', { class: 'quoi' }, r.fait)));
    }
    page.appendChild(h('section', null, h('h3', { class: 'titre-section' }, 'Chronologie', h('span', { class: 'discret' }, 'sièges, batailles, traités, morts')), ul));

    if (c.bilan.length) {
      const b = h('div', { class: 'resume' });
      for (const p of c.bilan) b.appendChild(h('p', null, p));
      page.appendChild(h('section', null, h('h3', { class: 'titre-section' }, 'Et après'), b));
    }

    page.appendChild(h('section', null, h('h3', { class: 'titre-section' }, 'En place au départ', h('span', { class: 'discret' }, 'en ' + Dates.anneeTexte(c.debut))), enPlace(c)));

    const voisins = h('div', { class: 'voisins' });
    const prec = liste[i - 1], suiv = liste[i + 1];
    voisins.appendChild(prec ? h('a', { class: 'precedent', href: '#/c/' + prec.id }, icone('gauche'), h('div', { class: 'texte' }, h('div', { class: 'sens' }, 'Avant'), h('div', { class: 'qui' }, prec.nom), h('div', { class: 'petit discret' }, Dates.anneeTexte(prec.debut) + ' – ' + Dates.anneeTexte(prec.fin)))) : h('span', { style: { flex: 1 } }));
    voisins.appendChild(suiv ? h('a', { class: 'suivant', href: '#/c/' + suiv.id }, h('div', { class: 'texte' }, h('div', { class: 'sens' }, 'Après'), h('div', { class: 'qui' }, suiv.nom), h('div', { class: 'petit discret' }, Dates.anneeTexte(suiv.debut) + ' – ' + Dates.anneeTexte(suiv.fin))), icone('droite')) : h('span', { style: { flex: 1 } }));
    page.appendChild(voisins);
    page.appendChild(h('p', { class: 'credit', style: { marginTop: '14px' } }, 'Texte original de l’application ; dates d’après les chroniques et les travaux de référence (Grousset, Runciman, Riley-Smith, Flori).'));

    zone.appendChild(page);
    return { titre: c.nom, sous: Dates.anneeTexte(c.debut) + ' – ' + Dates.anneeTexte(c.fin) };
  }

  /* La liste des croisades, pour l'accueil. */
  function cartes() {
    const bloc = h('div');
    for (const c of Donnees.croisades) {
      bloc.appendChild(h('a', { class: 'carte carte-lien carte-frise', href: '#/c/' + c.id, style: { '--teinte': '#9b2335' } },
        h('div', { class: 'bande' }),
        h('div', { class: 'corps' }, h('p', { class: 'carte-titre' }, c.nom), h('p', { class: 'discret petit' }, Dates.anneeTexte(c.debut) + ' – ' + Dates.anneeTexte(c.fin) + ' · ' + c.sousTitre)),
        icone('droite', 'fleche')));
    }
    return bloc;
  }

  racine.VueCroisade = { dessiner, cartes };

})(window);
