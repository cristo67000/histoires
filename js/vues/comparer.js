'use strict';
/* Plusieurs frises côte à côte, sur la même échelle. */
(function (racine) {

  const { h, icone } = Outils;
  const ZOOMS = [1.2, 2.5, 5];

  function dessiner(zone, params) {
    const page = h('div', { class: 'page-large comparer' });
    let choisies = Reglages.lire('comparer.frises', ['france', 'angleterre', 'allemagne', 'papes']);
    let zoom = Reglages.lire('comparer.zoom', 1);
    let toutesVoies = Reglages.lire('comparer.toutesVoies', false);
    const date = params.date || null;

    const choix = h('div', { class: 'choix-frises' });
    const barre = h('div', { class: 'barre-frise' });
    const corps = h('div');

    function redessiner() {
      choix.textContent = '';
      for (const f of Donnees.frises) {
        const actif = choisies.includes(f.id);
        choix.appendChild(h('button', { type: 'button', class: actif ? 'actif' : '', style: { '--teinte': f.couleur }, 'aria-pressed': actif ? 'true' : 'false', onclick: () => {
          if (actif) { if (choisies.length === 1) return; choisies = choisies.filter((x) => x !== f.id); }
          else choisies = Donnees.frises.map((x) => x.id).filter((id) => choisies.includes(id) || id === f.id);
          Reglages.ecrire('comparer.frises', choisies);
          redessiner();
        } }, f.nom));
      }
      barre.textContent = '';
      barre.appendChild(h('button', { type: 'button', class: 'puce puce-claire' + (toutesVoies ? ' actif' : ''), 'aria-pressed': toutesVoies ? 'true' : 'false', onclick: () => {
        toutesVoies = !toutesVoies; Reglages.ecrire('comparer.toutesVoies', toutesVoies); redessiner();
      } }, toutesVoies ? 'Toutes les voies' : 'Voies principales'));
      barre.appendChild(h('span', { class: 'discret petit', style: { padding: '0 6px', whiteSpace: 'nowrap' } }, 'Un nom ouvre sa fiche, la règle une date.'));
      barre.appendChild(h('span', { class: 'espace' }));
      barre.appendChild(h('button', { type: 'button', class: 'bouton-icone', 'aria-label': 'Resserrer', disabled: zoom === 0, onclick: () => { zoom = Math.max(0, zoom - 1); Reglages.ecrire('comparer.zoom', zoom); redessiner(); } }, icone('moins')));
      barre.appendChild(h('button', { type: 'button', class: 'bouton-icone', 'aria-label': 'Étirer', disabled: zoom === ZOOMS.length - 1, onclick: () => { zoom = Math.min(ZOOMS.length - 1, zoom + 1); Reglages.ecrire('comparer.zoom', zoom); redessiner(); } }, icone('plus')));
      corps.textContent = '';
      let frises = choisies.map((id) => Donnees.frise(id)).filter(Boolean);
      /* Les papes commencent en l'an 33 ; seuls avec d'autres frises, on
       * coupe leurs premiers siècles pour commencer où les autres commencent. */
      const autres = frises.filter((f) => f.id !== 'papes');
      if (autres.length && frises.length > autres.length) {
        const debut = Dates.cle(String(Donnees.bornes(autres).min));
        frises = frises.map((f) => f.id !== 'papes' ? f : Object.assign({}, f, { mandats: f.mandats.filter((m) => m.cleFin >= debut) }));
      }
      if (!toutesVoies) {
        frises = frises.map((f) => f.voies.length === 1 ? f : Object.assign({}, f, { voies: f.voies.slice(0, 1), mandats: f.mandats.filter((m) => m.voie === f.voies[0].id) }));
      }
      const z = VueFrise.dessinerZone(frises, { pxParAn: ZOOMS[zoom], minimum: 30, compact: true, dateMarquee: date });
      corps.appendChild(z);
      if (z._yMarque != null) requestAnimationFrame(() => window.scrollTo({ top: z.getBoundingClientRect().top + window.scrollY + z._yMarque - 200 }));
    }

    redessiner();
    page.appendChild(choix);
    page.appendChild(barre);
    page.appendChild(corps);
    zone.appendChild(page);
    return { titre: 'Côte à côte', sous: 'les frises sur une même échelle' };
  }

  racine.VueComparer = { dessiner };

})(window);
