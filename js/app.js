'use strict';
/*
 * L'application : routes (#/…), barre de titre, navigation, démarrage.
 *
 *   #/                    accueil
 *   #/frise/<id>?date=…   une frise
 *   #/comparer?date=…     plusieurs frises côte à côte
 *   #/date/<AAAA[-MM[-JJ]]> qui est en place à cette date
 *   #/p/<Q…>              la fiche d'un personnage
 *   #/recherche           chercher un nom
 *   #/reglages            réglages, installation, à propos
 */
(function (racine) {

  const { h } = Outils;
  const VUES = {
    '': () => VueAccueil, frise: () => VueFrise, comparer: () => VueComparer, date: () => VueDate,
    p: () => VueFiche, c: () => VueCroisade, recherche: () => VueRecherche, reglages: () => VueReglages,
  };
  const defilements = new Map();
  let routeCourante = null;
  let vueCourante = null;
  let profondeur = 0;
  let retourAttendu = false;

  function analyser(hash) {
    const brut = (hash || '').replace(/^#\/?/, '');
    const [chemin, requete] = brut.split('?');
    const parts = chemin.split('/').filter(Boolean);
    const params = {};
    if (requete) for (const [k, v] of new URLSearchParams(requete)) params[k] = v;
    return { nom: parts[0] || '', id: parts[1] ? decodeURIComponent(parts[1]) : null, params, cle: brut };
  }

  function rendre() {
    const route = analyser(location.hash);
    if (routeCourante) defilements.set(routeCourante.cle, window.scrollY);
    if (vueCourante && vueCourante.quitter) vueCourante.quitter();
    App.surRetour = null;
    const v = document.getElementById('visionneuse-ouverte');
    if (v) v.remove();
    const zone = document.getElementById('vue');
    zone.textContent = '';
    const fabrique = VUES[route.nom] || VUES[''];
    const vue = fabrique();
    const infos = vue.dessiner(zone, Object.assign({ id: route.id }, route.params)) || {};
    vueCourante = infos;
    routeCourante = route;
    document.getElementById('titre-texte').textContent = infos.titre || 'Histoires';
    document.getElementById('sous-titre').textContent = infos.sous || '';
    document.getElementById('b-retour').hidden = route.nom === '';
    document.getElementById('logo-barre').hidden = route.nom !== '';
    document.title = (infos.titre && infos.titre !== 'Histoires' ? infos.titre + ' — ' : '') + 'Histoires';
    for (const a of document.querySelectorAll('#nav a')) a.classList.toggle('actif', a.dataset.route === route.nom || (a.dataset.route === 'date' && route.nom === 'date'));
    const y = retourAttendu ? defilements.get(route.cle) : undefined;
    retourAttendu = false;
    window.scrollTo({ top: y || 0 });
  }

  function aller(hash) {
    if (location.hash === hash) { rendre(); return; }
    profondeur++;
    location.hash = hash;
  }

  function remplacer(hash) {
    history.replaceState(null, '', hash);
    if (routeCourante) routeCourante.cle = analyser(hash).cle;
  }

  function retour() {
    if (App.surRetour) { App.surRetour(); return; }
    if (profondeur > 0) { profondeur--; retourAttendu = true; history.back(); }
    else aller('#/');
  }

  racine.addEventListener('hashchange', () => {
    if (App.surRetour) { App.surRetour(); }
    rendre();
  });
  racine.addEventListener('popstate', () => { /* hashchange suit */ });

  async function demarrer() {
    Reglages.appliquerTheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', Reglages.appliquerTheme);
    document.getElementById('b-retour').addEventListener('click', retour);
    try {
      await Donnees.charger();
    } catch (e) {
      document.querySelector('#demarrage p').textContent = 'Les données n’ont pas pu être chargées. Vérifiez le réseau, puis rouvrez l’application.';
      return;
    }
    document.getElementById('demarrage').classList.add('cache');
    rendre();
    if ('serviceWorker' in navigator && !/[?&]sans-sw/.test(location.search)) {
      try {
        const inscription = await navigator.serviceWorker.register('sw.js');
        MiseAJour.surveiller(inscription);
      } catch (e) { /* hors ligne au premier lancement, ou protocole file: */ }
    }
    try {
      await Images.inventaire();
      Images.completer();
    } catch (e) { /* pas de cache */ }
  }

  racine.App = { aller, remplacer, retour, rendre, surRetour: null };
  racine.addEventListener('DOMContentLoaded', demarrer);

})(window);
