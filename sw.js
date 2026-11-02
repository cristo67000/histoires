'use strict';
/*
 * Service worker d'Histoires.
 *
 * La coquille — pages, styles, scripts, données, icônes — tient en un seul
 * bloc rangé dans un cache propre à la version : « cache d'abord », et hors
 * ligne dès le premier lancement.
 *
 * Les portraits (img/) vont dans un cache à part, « histoires-images », qui
 * survit aux versions : servis depuis ce cache s'ils y sont, sinon pris au
 * réseau et rangés au passage. js/images.js le complète en arrière-plan.
 *
 * Une version suivante se prépare dans un autre cache et ne prend la main
 * qu'au feu vert de js/miseajour.js (le bandeau « Mettre à jour »).
 */

const VERSION = 'v1.0.0';
const COQUILLE = 'histoires-coquille-' + VERSION;
const IMAGES = 'histoires-images';

const FICHIERS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/theme.css',
  'css/app.css',
  'js/outils.js',
  'js/reglages.js',
  'js/donnees.js',
  'js/echelle.js',
  'js/images.js',
  'js/vues/communs.js',
  'js/vues/accueil.js',
  'js/vues/frise.js',
  'js/vues/comparer.js',
  'js/vues/date.js',
  'js/vues/fiche.js',
  'js/vues/recherche.js',
  'js/vues/reglages.js',
  'js/miseajour.js',
  'js/installer.js',
  'js/app.js',
  'data/frises.json',
  'data/personnes.json',
  'data/precache.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

/* `cache: 'reload'` court-circuite le cache du navigateur, pas celui du relais
 * de GitHub Pages, qui garde un fichier dix minutes : une adresse que personne
 * n'a encore demandée est forcément fraîche. */
const MARQUE = '?coquille=' + encodeURIComponent(VERSION);

async function installerLaCoquille(cache) {
  const manques = [];
  await Promise.all(FICHIERS.map(async (url) => {
    try {
      const reponse = await fetch(new Request(url + MARQUE, { cache: 'reload' }));
      if (!reponse.ok) { manques.push(url + ' : ' + reponse.status); return; }
      await cache.put(url, reponse);
    } catch (erreur) {
      manques.push(url + ' : ' + (erreur && erreur.message ? erreur.message : erreur));
    }
  }));
  if (manques.length) throw new Error('coquille incomplète — ' + manques.join(', '));
  const page = await cache.match('index.html');
  const html = page ? await page.text() : '';
  if (html.indexOf('name="application-version" content="' + VERSION + '"') === -1) {
    throw new Error('index.html n’est pas de la version ' + VERSION);
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(COQUILLE);
    try {
      await installerLaCoquille(cache);
    } catch (erreur) {
      await caches.delete(COQUILLE);
      throw erreur;
    }
    // Pas de skipWaiting() : la nouvelle version attend le feu vert du bandeau.
  })());
});

self.addEventListener('message', (e) => {
  const message = e.data || {};
  if (message.type === 'passer-devant') self.skipWaiting();
  if (message.type === 'version' && e.ports && e.ports[0]) e.ports[0].postMessage({ version: VERSION });
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const nom of await caches.keys()) {
      if (nom.startsWith('histoires-coquille-') && nom !== COQUILLE) await caches.delete(nom);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (/\/img\/[^/]+\.webp$/.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(IMAGES);
      const enCache = await cache.match(e.request);
      if (enCache) return enCache;
      const reponse = await fetch(e.request);
      if (reponse.ok) cache.put(e.request, reponse.clone());
      return reponse;
    })());
    return;
  }

  /* Le cache de cette version, et lui seul. Ce qui n'y est pas va au réseau
   * sans rien laisser dans le cache. Une navigation hors ligne, ou un réseau
   * qui répond mal (portail captif, erreur 5xx), retombe sur la page. */
  e.respondWith((async () => {
    const coquille = await caches.open(COQUILLE);
    const enCache = await coquille.match(e.request, { ignoreSearch: true, ignoreVary: true });
    if (enCache) return enCache;
    try {
      const reponse = await fetch(e.request);
      if (!reponse.ok && e.request.mode === 'navigate') {
        const accueil = await coquille.match('index.html');
        if (accueil) return accueil;
      }
      return reponse;
    } catch (erreur) {
      if (e.request.mode === 'navigate') {
        const accueil = await coquille.match('index.html');
        if (accueil) return accueil;
      }
      throw erreur;
    }
  })());
});
