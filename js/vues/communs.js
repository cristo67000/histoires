'use strict';
/* Morceaux d'interface partagés par les vues. */
(function (racine) {

  const { h, icone } = Outils;

  /* Le portrait d'une personne : l'image si elle existe, sinon une silhouette. */
  function portrait(q, classe) {
    const url = q && q !== '-' ? Donnees.urlImage(q) : null;
    const p = q && q !== '-' ? Donnees.personne(q) : null;
    if (url) {
      return h('img', { class: 'portrait ' + (classe || ''), src: url, alt: '', loading: 'lazy', decoding: 'async', width: 56, height: 56 });
    }
    return h('span', { class: 'portrait portrait-vide ' + (classe || ''), 'aria-hidden': 'true' }, icone(p && p.humain === false ? 'couronne' : 'personne'));
  }

  /* « 1643 – 1715 », « 2017 – aujourd'hui », « 613 ». */
  function annees(m) {
    const a = Dates.anneeTexte(m.debut);
    if (!m.fin) return 'depuis ' + a;
    const b = Dates.anneeTexte(m.fin);
    return a === b ? a : a + ' – ' + b;
  }

  function datesCompletes(m) {
    const a = Dates.lire(m.debut);
    if (!m.fin) return 'depuis ' + Dates.lireAvecPreposition(m.debut).replace(/^(le|en) /, '$1 ');
    return 'du ' + a + ' au ' + Dates.lire(m.fin);
  }

  function teinte(m) {
    const p = Donnees.periode(m);
    return p ? p.couleur : Donnees.frise(m.frise).couleur;
  }

  function majuscule(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; }

  function cadre(m) {
    const f = Donnees.frise(m.frise);
    const v = Donnees.voie(m);
    return f.voies.length > 1 ? f.nom + ' · ' + v.nom : f.nom;
  }

  function lienFiche(m) { return m.q === '-' ? null : '#/p/' + m.q; }

  /* La carte d'un titulaire (vue Date, accueil). `date` : la clé de la date
   * regardée, pour « depuis … ». */
  function carteTitulaire(m, options) {
    const o = options || {};
    const p = m.q !== '-' ? Donnees.personne(m.q) : null;
    const per = Donnees.periode(m);
    const f = Donnees.frise(m.frise);
    const corps = h('div', { class: 'corps' });
    corps.appendChild(h('div', { class: 'cadre' }, o.cadre || cadre(m)));
    corps.appendChild(h('div', { class: 'nom' }, m.nom));
    corps.appendChild(h('div', { class: 'fonction' }, majuscule(m.titre) + (per ? ' · ' + per.nom : '')));
    if (o.date) {
      const morceaux = [];
      morceaux.push('depuis ' + Dates.lireAvecPreposition(m.debut).replace(/^(le|en) /, '$1 '));
      const d = Dates.duree(m.debut, o.date);
      if (d && !/jours?$/.test(d)) morceaux.push(d + ' en fonction');
      if (p && p.naissance) {
        const a = Dates.age(p.naissance, o.date);
        if (a != null && a < 110) morceaux.push(a + ' ans');
      }
      corps.appendChild(h('div', { class: 'depuis' }, morceaux.filter(Boolean).join(' · ')));
    } else {
      corps.appendChild(h('div', { class: 'depuis' }, annees(m)));
    }
    const el = h(m.inst ? 'div' : 'a', {
      class: 'carte carte-lien carte-titulaire' + (m.inst ? ' vacance' : ''),
      href: lienFiche(m), style: { '--teinte': teinte(m), '--teinte-frise': f.couleur },
    }, portrait(m.inst ? null : m.q), corps, m.inst ? null : icone('droite', 'fleche discret'));
    return el;
  }

  function vacance(ligne, date) {
    const corps = h('div', { class: 'corps' });
    corps.appendChild(h('div', { class: 'cadre' }, ligne.frise.voies.length > 1 ? ligne.frise.nom + ' · ' + ligne.voie.nom : ligne.frise.nom));
    corps.appendChild(h('div', { class: 'nom' }, ligne.apres ? 'Vacance' : 'Fin de la série'));
    const details = [];
    if (ligne.avant) details.push('après ' + ligne.avant.nom + ' (' + Dates.anneeTexte(ligne.avant.fin) + ')');
    if (ligne.apres) details.push('avant ' + ligne.apres.nom + ' (' + Dates.anneeTexte(ligne.apres.debut) + ')');
    corps.appendChild(h('div', { class: 'fonction discret' }, details.join(', ')));
    return h('div', { class: 'carte carte-titulaire vacance', style: { '--teinte': ligne.frise.couleur } }, portrait(null), corps);
  }

  function toast(texte) {
    let t = document.getElementById('toast');
    if (!t) {
      t = h('div', { id: 'toast', role: 'status' });
      document.body.appendChild(t);
    }
    t.textContent = texte;
    t.classList.add('visible');
    clearTimeout(t._minuteur);
    t._minuteur = setTimeout(() => t.classList.remove('visible'), 2600);
  }

  racine.Communs = { portrait, annees, datesCompletes, teinte, cadre, carteTitulaire, vacance, lienFiche, majuscule, toast };

})(window);
