'use strict';
/* L'accueil : la date, les frises, les ordres. */
(function (racine) {

  const { h, icone } = Outils;
  const { portrait } = Communs;

  const EXEMPLES = [['1066', 'Hastings'], ['1307', 'Chute du Temple'], ['1515', 'Marignan'], ['1789', 'Révolution'], ['1871', 'Commune'], ['1945', 'Libération']];

  function carteFrise(f) {
    const aujourdhui = Dates.aujourdhui();
    const actifs = Donnees.enPlace(f.id, aujourdhui, f.voies[0].id);
    const dernier = actifs[0] || f.mandats[f.mandats.length - 1];
    const b = Donnees.bornes([f]);
    const nb = new Set(f.mandats.filter((m) => !m.inst).map((m) => m.q)).size;
    const corps = h('div', { class: 'corps' },
      h('p', { class: 'carte-titre' }, f.nom),
      h('p', { class: 'discret petit' }, f.titre),
      h('p', { class: 'discret petit' }, Outils.pluriel(nb, 'personnage') + ' · ' + Dates.anneeTexte(String(b.min)) + ' – ' + (actifs.length ? 'aujourd’hui' : b.max)));
    if (dernier) {
      corps.appendChild(h('div', { class: 'actuel' }, portrait(dernier.inst ? null : dernier.q),
        h('span', null, (actifs.length ? 'Aujourd’hui : ' : 'Dernier : ') + dernier.nom)));
    }
    return h('a', { class: 'carte carte-lien carte-frise', href: '#/frise/' + f.id, style: { '--teinte': f.couleur } },
      h('div', { class: 'bande' }), corps, icone('droite', 'fleche'));
  }

  function dessiner(zone) {
    const page = h('div', { class: 'page' });
    const champ = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'Une année, par exemple 1515', 'aria-label': 'Année' });
    const aller = () => {
      const v = champ.value.trim();
      const m = /^(\d{1,4})(?:[-/.](\d{1,2}))?(?:[-/.](\d{1,2}))?$/.exec(v);
      if (!m) { Communs.toast('Entrez une année, comme 1515, ou une date, comme 1515-09-13.'); return; }
      let cle = m[1].padStart(4, '0');
      if (m[2]) cle += '-' + m[2].padStart(2, '0');
      if (m[3]) cle += '-' + m[3].padStart(2, '0');
      App.aller('#/date/' + cle);
    };
    champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') aller(); });
    const exemples = h('div', { class: 'exemples' });
    for (const [an, nom] of EXEMPLES) exemples.appendChild(h('button', { type: 'button', onclick: () => App.aller('#/date/' + an) }, an + ' · ' + nom));
    exemples.appendChild(h('button', { type: 'button', onclick: () => App.aller('#/date/' + Dates.aujourdhui()) }, 'Aujourd’hui'));
    page.appendChild(h('section', { class: 'heros' },
      h('h2', null, 'Qui régnait en… ?'),
      h('p', null, 'Rois, empereurs, présidents, chanceliers, papes et grands maîtres : entrez une date, voyez qui était en place.'),
      h('div', { class: 'saisie-date' }, champ, h('button', { type: 'button', onclick: aller }, 'Voir')),
      exemples));

    const carteInstallation = Installer.carteAccueil();
    if (carteInstallation) page.appendChild(carteInstallation);

    page.appendChild(h('div', { class: 'outils-accueil' },
      h('a', { class: 'bouton-discret', href: '#/comparer' }, icone('comparer'), 'Frises côte à côte'),
      h('button', { type: 'button', class: 'bouton-discret', onclick: () => App.aller('#/p/' + Donnees.auHasard()) }, icone('hasard'), 'Un personnage au hasard')));

    page.appendChild(h('h2', { class: 'titre-section' }, 'Souverains et chefs d’État', h('span', { class: 'discret' }, 'France, Angleterre, Allemagne, papauté')));
    for (const f of Donnees.groupe('souverains')) page.appendChild(carteFrise(f));
    page.appendChild(h('h2', { class: 'titre-section' }, 'Ordres et obédiences', h('span', { class: 'discret' }, 'grands maîtres')));
    for (const f of Donnees.groupe('ordres')) page.appendChild(carteFrise(f));

    page.appendChild(h('p', { class: 'discret petit', style: { marginTop: '18px' } },
      'Dates et filiations : Wikidata. Résumés : Wikipédia en français (CC BY-SA). Portraits : Wikimedia Commons, crédités sur chaque fiche. ',
      h('a', { class: 'renvoi', href: '#/reglages' }, 'À propos')));
    zone.appendChild(page);
    return { titre: 'Histoires', sous: 'frises des souverains, papes et grands maîtres' };
  }

  racine.VueAccueil = { dessiner };

})(window);
