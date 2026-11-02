'use strict';
/* Les réglages, dans localStorage, sous une seule clé. */
(function (racine) {
  const CLE = 'histoires.reglages';
  let valeurs = {};
  try { valeurs = JSON.parse(localStorage.getItem(CLE) || '{}') || {}; } catch (e) { valeurs = {}; }

  function lire(nom, defaut) { return nom in valeurs ? valeurs[nom] : defaut; }
  function ecrire(nom, valeur) {
    valeurs[nom] = valeur;
    try { localStorage.setItem(CLE, JSON.stringify(valeurs)); } catch (e) { /* stockage plein ou interdit */ }
  }

  function appliquerTheme() {
    const t = lire('theme', 'auto');
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const sombre = t === 'sombre' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
      meta.content = sombre ? '#16141a' : '#f4efe6';
    }
  }

  racine.Reglages = { lire, ecrire, appliquerTheme };
})(window);
