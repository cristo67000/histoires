'use strict';
/* Plusieurs frises côte à côte, sur la même planche (voir frise.js). */
(function (racine) {

  const { h } = Outils;

  function dessiner(zone, params) {
    const page = h('div', { class: 'page-large comparer' });
    let choisies = Reglages.lire('comparer.frises', ['france', 'angleterre', 'allemagne', 'papes']);
    /* « Toutes les frises » à une date : tout est coché pour cette visite,
     * sans toucher au choix enregistré. */
    let toutes = params.toutes === '1';
    if (toutes) choisies = Donnees.frises.map((f) => f.id);
    let toutesVoies = Reglages.lire('comparer.toutesVoies', false);
    let date = params.date || null;

    const choix = h('div', { class: 'choix-frises' });
    const corps = h('div');
    let planche = null;
    let premiere = true;

    function adresse() { App.remplacer('#/comparer' + (date ? '?date=' + date + (toutes ? '&toutes=1' : '') : (toutes ? '?toutes=1' : ''))); }

    function redessiner() {
      if (planche) { planche.quitter(); planche = null; }
      choix.textContent = '';
      for (const f of Donnees.frises) {
        const actif = choisies.includes(f.id);
        choix.appendChild(h('button', { type: 'button', class: actif ? 'actif' : '', style: { '--teinte': f.couleur }, 'aria-pressed': actif ? 'true' : 'false', onclick: () => {
          if (actif) { if (choisies.length === 1) return; choisies = choisies.filter((x) => x !== f.id); }
          else choisies = Donnees.frises.map((x) => x.id).filter((id) => choisies.includes(id) || id === f.id);
          if (toutes) { toutes = false; adresse(); }
          Reglages.ecrire('comparer.frises', choisies);
          redessiner();
        } }, f.nom));
      }
      choix.appendChild(h('button', { type: 'button', class: 'voies-toutes' + (toutesVoies ? ' actif' : ''), 'aria-pressed': toutesVoies ? 'true' : 'false', onclick: () => {
        toutesVoies = !toutesVoies; Reglages.ecrire('comparer.toutesVoies', toutesVoies); redessiner();
      } }, toutesVoies ? 'Toutes les voies' : '+ chanceliers, Avignon…'));

      corps.textContent = '';
      let frises = choisies.map((id) => Donnees.frise(id)).filter(Boolean);
      /* Papes et califes commencent des siècles avant les autres ; avec d'autres
       * frises, on commence où commence la plus ancienne de celles-ci. */
      const anciennes = ['papes', 'islam'];
      const autres = frises.filter((f) => !anciennes.includes(f.id));
      if (autres.length && frises.length > autres.length) {
        const debut = Dates.cle(String(Donnees.bornes(autres).min));
        frises = frises.map((f) => !anciennes.includes(f.id) ? f : Object.assign({}, f, { mandats: f.mandats.filter((m) => m.cleFin >= debut) }));
      }
      if (!toutesVoies) {
        frises = frises.map((f) => f.voies.length === 1 ? f : Object.assign({}, f, { voies: f.voies.slice(0, 1), mandats: f.mandats.filter((m) => m.voie === f.voies[0].id) }));
      }
      planche = VueFrise.creerPlanche(frises, { cle: 'comparer', cote: true, toutes: frises.length === Donnees.frises.length, dateMarquee: date,
        reprendre: !!params.retour, garder: !premiere, surDate: (d) => { date = d; adresse(); } });
      corps.appendChild(planche.barre);
      corps.appendChild(planche.el);
      if (corps.isConnected) planche.installer();
      premiere = false;
    }

    redessiner();
    page.appendChild(choix);
    page.appendChild(corps);
    zone.appendChild(page);
    planche.installer();
    return { titre: 'Côte à côte', sous: 'glissez, pincez, touchez un nom', quitter: () => { if (planche) planche.quitter(); } };
  }

  racine.VueComparer = { dessiner };

})(window);
