'use strict';
/* Une date : qui est en place, frise par frise. */
(function (racine) {

  const { h, icone } = Outils;

  const MIN_AN = 30;

  function dessiner(zone, params) {
    const page = h('div', { class: 'page' });
    let cle = params.id || Dates.aujourdhui();
    const maxAn = new Date().getFullYear();

    const champAn = h('input', { type: 'number', min: MIN_AN, max: maxAn, inputmode: 'numeric', 'aria-label': 'Année' });
    const champMois = h('select', { 'aria-label': 'Mois' }, h('option', { value: '' }, '— mois —'));
    Dates.MOIS.forEach((m, i) => champMois.appendChild(h('option', { value: String(i + 1).padStart(2, '0') }, m)));
    const champJour = h('select', { 'aria-label': 'Jour' }, h('option', { value: '' }, '— jour —'));
    for (let j = 1; j <= 31; j++) champJour.appendChild(h('option', { value: String(j).padStart(2, '0') }, j));

    const resultats = h('div');
    const lue = h('h2', { class: 'date-lue' });
    const sousLue = h('p', { class: 'discret' });

    function depuisChamps() {
      let an = parseInt(champAn.value, 10);
      if (isNaN(an)) return;
      an = Math.min(maxAn, Math.max(MIN_AN, an));
      let c = String(an).padStart(4, '0');
      if (champMois.value) {
        c += '-' + champMois.value;
        if (champJour.value) c += '-' + champJour.value;
      } else champJour.value = '';
      cle = c;
      App.remplacer('#/date/' + cle);
      afficher();
    }
    for (const el of [champMois, champJour]) el.addEventListener('change', depuisChamps);
    champAn.addEventListener('change', depuisChamps);
    champAn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { depuisChamps(); champAn.blur(); } });

    function decaler(ans) {
      const p = Dates.analyser(cle);
      const an = Math.min(maxAn, Math.max(MIN_AN, p.annee + ans));
      cle = String(an).padStart(4, '0') + (p.mois ? '-' + String(p.mois).padStart(2, '0') : '') + (p.jour ? '-' + String(p.jour).padStart(2, '0') : '');
      App.remplacer('#/date/' + cle);
      afficher();
    }

    function changement(sens) {
      const c = Donnees.changement(Dates.cle(cle, sens < 0), sens);
      if (!c) return;
      cle = c.replace(/-01-01$/, '').replace(/-12-31$/, '');
      App.remplacer('#/date/' + cle);
      afficher();
    }

    function afficher() {
      const p = Dates.analyser(cle);
      champAn.value = p.annee;
      champMois.value = p.mois ? String(p.mois).padStart(2, '0') : '';
      champJour.value = p.jour ? String(p.jour).padStart(2, '0') : '';
      const precis = Dates.cle(cle);
      lue.textContent = (p.jour ? 'Le ' : 'En ') + Dates.lire(cle);
      sousLue.textContent = p.jour ? Dates.siecle(p.annee) : (p.mois ? Dates.siecle(p.annee) + ' — dates au mois près' : Dates.siecle(p.annee) + ' — à l’année près : plusieurs titulaires peuvent se succéder dans l’année');
      resultats.textContent = '';
      const lignes = Donnees.tableau(precis);
      for (const groupe of [['souverains', 'Souverains et chefs d’État'], ['croisades', 'Croisades'], ['ordres', 'Ordres et obédiences']]) {
        const part = lignes.filter((l) => l.frise.groupe === groupe[0]);
        if (!part.length) continue;
        resultats.appendChild(h('h3', { class: 'titre-section' }, groupe[1]));
        for (const l of part) {
          if (l.mandats.length) {
            for (const m of l.mandats) resultats.appendChild(Communs.carteTitulaire(m, { date: precis }));
          } else {
            resultats.appendChild(Communs.vacance(l, precis));
          }
        }
      }
      if (!lignes.length) resultats.appendChild(h('p', { class: 'discret' }, 'Aucune frise ne commence avant cette date.'));
      resultats.appendChild(h('div', { class: 'outils-accueil', style: { marginTop: '16px' } },
        h('a', { class: 'bouton-discret', href: '#/comparer?date=' + cle }, icone('comparer'), 'Voir sur les frises')));
    }

    page.appendChild(h('div', { class: 'formulaire-date' },
      h('label', null, 'Année', champAn), h('label', null, 'Mois', champMois), h('label', null, 'Jour', champJour)));
    page.appendChild(h('div', { class: 'pas-date' },
      h('button', { type: 'button', onclick: () => changement(-1), title: 'Changement précédent', 'aria-label': 'Changement précédent' }, icone('gauche'), 'préc.'),
      h('button', { type: 'button', onclick: () => decaler(-10) }, '−10'),
      h('button', { type: 'button', onclick: () => decaler(-1) }, '−1'),
      h('button', { type: 'button', onclick: () => decaler(1) }, '+1'),
      h('button', { type: 'button', onclick: () => decaler(10) }, '+10'),
      h('button', { type: 'button', onclick: () => changement(1), title: 'Changement suivant', 'aria-label': 'Changement suivant' }, 'suiv.', icone('droite'))));
    page.appendChild(h('p', { class: 'discret petit', style: { marginTop: '-4px' } }, '« préc. » et « suiv. » sautent au changement de titulaire le plus proche, toutes frises confondues ; −10, −1, +1, +10 : en années.'));
    page.appendChild(lue);
    page.appendChild(sousLue);
    page.appendChild(resultats);
    afficher();
    zone.appendChild(page);
    return { titre: 'À cette date', sous: 'qui est en place ?' };
  }

  racine.VueDate = { dessiner };

})(window);
