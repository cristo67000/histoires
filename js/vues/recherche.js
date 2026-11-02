'use strict';
/* Chercher un personnage par son nom. */
(function (racine) {

  const { h, icone } = Outils;
  const { portrait, annees, majuscule } = Communs;

  function dessiner(zone, params) {
    const page = h('div', { class: 'page' });
    const champ = h('input', { type: 'search', placeholder: 'Un nom : Louis XIV, Barberousse, Molay…', 'aria-label': 'Rechercher', autocomplete: 'off', value: params.q || '' });
    const liste = h('div', { style: { marginTop: '12px' } });

    function chercher() {
      liste.textContent = '';
      const texte = champ.value.trim();
      if (texte.length < 2) {
        liste.appendChild(h('p', { class: 'discret' }, 'Tapez au moins deux lettres. La recherche ignore les accents.'));
        return;
      }
      const res = Donnees.rechercher(texte);
      if (!res.length) { liste.appendChild(h('p', { class: 'discret' }, 'Personne ne porte ce nom dans les frises.')); return; }
      for (const r of res) {
        const mandats = Donnees.mandatsDe(r.q);
        const m = mandats[0];
        const detail = m ? majuscule(m.titre) + ' · ' + annees(m) + ' · ' + Donnees.frise(m.frise).nom : (r.p.desc || '');
        liste.appendChild(h('button', { type: 'button', class: 'resultat', onclick: () => App.aller('#/p/' + r.q) },
          portrait(r.q), h('div', { class: 'texte' }, h('div', { class: 'nom' }, r.p.nom), h('div', { class: 'detail' }, detail)), icone('droite', 'discret')));
      }
    }
    champ.addEventListener('input', chercher);
    page.appendChild(h('div', { class: 'champ-recherche' }, icone('recherche', 'discret'), champ));
    page.appendChild(liste);
    chercher();
    zone.appendChild(page);
    setTimeout(() => { if (!params.q) champ.focus(); }, 50);
    return { titre: 'Rechercher', sous: Object.keys(Donnees.personnes).length + ' personnages' };
  }

  racine.VueRecherche = { dessiner };

})(window);
