'use strict';
/*
 * Les données : frises (voies, périodes, mandats) et fiches des personnes,
 * chargées depuis data/, indexées, et interrogées par date.
 *
 * Un « mandat » est le passage d'une personne (ou d'une institution) dans une
 * voie d'une frise, entre deux dates. Une personne peut avoir plusieurs
 * mandats, dans une même frise (Napoléon, de Gaulle) ou dans plusieurs
 * (Charlemagne, roi des Francs et empereur ; Hitler, chef de l'État et
 * chancelier).
 */
(function (racine) {

  const { cle } = Dates;

  let frises = [];
  let parFrise = {};
  let personnes = {};
  let mandatsParPersonne = {};
  let tousMandats = [];
  let precache = {};

  async function charger() {
    const [f, p, pc] = await Promise.all([
      fetch('data/frises.json').then((r) => r.json()),
      fetch('data/personnes.json').then((r) => r.json()),
      fetch('data/precache.json').then((r) => r.json()).catch(() => ({})),
    ]);
    frises = f;
    personnes = p;
    precache = pc;
    indexer();
  }

  function indexer() {
    parFrise = {};
    mandatsParPersonne = {};
    tousMandats = [];
    for (const frise of frises) {
      parFrise[frise.id] = frise;
      frise.parPeriode = {};
      for (const p of frise.periodes) frise.parPeriode[p.id] = p;
      frise.parVoie = {};
      for (const v of frise.voies) frise.parVoie[v.id] = v;
      frise.mandats.forEach((m, i) => {
        m.frise = frise.id;
        m.index = i;
        m.cleDebut = cle(m.debut);
        m.cleFin = m.fin ? cle(m.fin, true) : '9999-99-99';
        m.id = frise.id + ':' + i;
        if (m.q !== '-') (mandatsParPersonne[m.q] = mandatsParPersonne[m.q] || []).push(m);
        tousMandats.push(m);
      });
      // Dans chaque voie, l'ordre chronologique donne prédécesseur et successeur.
      for (const v of frise.voies) {
        const liste = frise.mandats.filter((m) => m.voie === v.id);
        liste.forEach((m, i) => {
          m.precedent = liste[i - 1] || null;
          m.suivant = liste[i + 1] || null;
          m.rang = i;
        });
      }
    }
    for (const liste of Object.values(mandatsParPersonne)) {
      liste.sort((a, b) => (a.cleDebut < b.cleDebut ? -1 : a.cleDebut > b.cleDebut ? 1 : 0));
    }
  }

  function frise(id) { return parFrise[id] || null; }
  function personne(q) { return personnes[q] || null; }
  function mandatsDe(q) { return mandatsParPersonne[q] || []; }
  function periode(m) { return parFrise[m.frise].parPeriode[m.periode]; }
  function voie(m) { return parFrise[m.frise].parVoie[m.voie]; }

  function groupe(nom) { return frises.filter((f) => f.groupe === nom); }

  /* Les mandats d'une frise (ou d'une voie) en place à une date (clé). */
  function enPlace(friseId, dateCle, voieId) {
    const f = parFrise[friseId];
    if (!f) return [];
    return f.mandats.filter((m) => (!voieId || m.voie === voieId) && m.cleDebut <= dateCle && m.cleFin >= dateCle);
  }

  /* Pour chaque frise et chaque voie, qui est en place à cette date ; une
   * voie sans titulaire (vacance, interrègne) donne une entrée vide, avec le
   * mandat précédent et le suivant pour dire d'où l'on vient. */
  function tableau(dateCle) {
    const lignes = [];
    for (const f of frises) {
      for (const v of f.voies) {
        const actifs = enPlace(f.id, dateCle, v.id);
        const liste = f.mandats.filter((m) => m.voie === v.id);
        const avant = liste.filter((m) => m.cleFin < dateCle).pop() || null;
        const apres = liste.find((m) => m.cleDebut > dateCle) || null;
        if (!actifs.length) {
          if (!avant) continue;                       // la voie n'existe pas encore
          if (!apres && v !== f.voies[0]) continue;   // une voie secondaire éteinte (obédience d'Avignon)
          // une série finie depuis plus de cinquante ans (le Temple après 1314) ne vaut plus une ligne
          if (!apres && parseInt(dateCle, 10) - parseInt(avant.cleFin, 10) > 50) continue;
        }
        lignes.push({ frise: f, voie: v, mandats: actifs, avant, apres });
      }
    }
    return lignes;
  }

  /* La prochaine (ou la précédente) date où quelque chose change, toutes
   * frises confondues : un début ou une fin de mandat. */
  function changement(dateCle, sens) {
    let meilleur = null;
    for (const m of tousMandats) {
      for (const c of [m.cleDebut, m.fin ? cle(m.fin) : null]) {
        if (!c) continue;
        if (sens > 0 && c > dateCle && (!meilleur || c < meilleur)) meilleur = c;
        if (sens < 0 && c < dateCle && (!meilleur || c > meilleur)) meilleur = c;
      }
    }
    return meilleur;
  }

  /* Bornes de l'ensemble des frises : première et dernière année. */
  function bornes(liste) {
    let min = Infinity, max = -Infinity;
    for (const f of liste || frises) {
      for (const m of f.mandats) {
        const a = Dates.annee(m.debut), b = m.fin ? Dates.annee(m.fin) : new Date().getFullYear();
        if (a < min) min = a;
        if (b > max) max = b;
      }
    }
    return { min, max };
  }

  function rechercher(texte, limite) {
    const q = Outils.normaliser(texte);
    if (q.length < 2) return [];
    const mots = q.split(' ').filter(Boolean);
    const resultats = [];
    for (const [id, p] of Object.entries(personnes)) {
      const r = p.recherche || '';
      let score = 0;
      if (r.startsWith(q)) score = 3;
      else if (mots.every((m) => r.includes(m))) score = r.split(' ').some((w) => w.startsWith(mots[0])) ? 2 : 1;
      if (score) resultats.push({ q: id, p, score });
    }
    resultats.sort((a, b) => b.score - a.score || (a.p.nom < b.p.nom ? -1 : 1));
    return resultats.slice(0, limite || 40);
  }

  function auHasard() {
    const ids = Object.keys(personnes).filter((q) => personnes[q].humain);
    return ids[Math.floor(Math.random() * ids.length)];
  }

  function urlImage(q) {
    const chemin = 'img/' + q + '.webp';
    const v = precache[chemin];
    return v ? chemin + '?v=' + v : null;
  }

  racine.Donnees = {
    charger, frise, personne, mandatsDe, periode, voie, groupe, enPlace, tableau, changement, bornes, rechercher, auHasard, urlImage,
    get frises() { return frises; },
    get personnes() { return personnes; },
    get precache() { return precache; },
  };

})(window);
