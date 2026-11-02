/*
 * Épreuves d'Histoires, sans navigateur.
 *
 *   node build/essais.mjs
 *
 * 1. La coquille : sw.js liste exactement ce que index.html charge (plus les
 *    données et les icônes), tout existe, les versions concordent.
 * 2. Les données : chaque mandat renvoie à une fiche, les voies sont dans
 *    l'ordre, pas de « ? » ni de chaîne vide, les portraits annoncés existent.
 * 3. L'échelle : monotone, minimum respecté, colonnes sans chevauchement.
 * 4. Les requêtes par date, avec des dates dont on connaît la réponse.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let reussites = 0, echecs = 0;
function ok(cond, message) {
  if (cond) reussites++; else { echecs++; console.log('  ÉCHEC', message); }
}
function lire(f) { return fs.readFileSync(path.join(RACINE, f), 'utf8'); }

// ── 1. Coquille ───────────────────────────────────────────────────────────
console.log('coquille');
const index = lire('index.html');
const sw = lire('sw.js');
const charges = [...index.matchAll(/(?:src|href)="([^"#?]+)"/g)].map((m) => m[1]).filter((u) => !/^https?:|^mailto:/.test(u));
const listes = [...sw.matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]);
for (const u of charges) ok(listes.includes(u), 'sw.js n’annonce pas ' + u);
for (const u of listes) {
  if (u === './') continue;
  ok(fs.existsSync(path.join(RACINE, u)), 'fichier annoncé absent : ' + u);
}
const vIndex = /application-version" content="([^"]+)"/.exec(index)[1];
const vSw = /const VERSION = '([^']+)'/.exec(sw)[1];
ok(vIndex === vSw, 'versions : index ' + vIndex + ' / sw ' + vSw);
for (const f of ['data/frises.json', 'data/personnes.json', 'data/precache.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apercu-1200x630.png', 'confidentialite.html', '.nojekyll']) {
  ok(fs.existsSync(path.join(RACINE, f)), 'manque ' + f);
}
// aucun \u littéral dangereux ni caractère de contrôle dans les scripts
for (const f of listes.filter((u) => /\.(js|css|html)$/.test(u))) {
  const t = lire(f);
  ok(!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(t), 'caractère de contrôle dans ' + f);
}

// ── Les modules du navigateur, dans un bac à sable ─────────────────────────
const bac = { window: {}, document: { addEventListener() {}, createElement() { return {}; } }, console, matchMedia: () => ({ matches: false, addEventListener() {} }) };
bac.window = bac;
bac.localStorage = { getItem: () => null, setItem() {} };
bac.navigator = {};
bac.fetch = async (u) => ({ json: async () => JSON.parse(lire(u)) });
vm.createContext(bac);
for (const f of ['js/outils.js', 'js/reglages.js', 'js/donnees.js', 'js/echelle.js']) vm.runInContext(lire(f), bac, { filename: f });
await bac.Donnees.charger();
const { Dates, Echelle, Donnees } = bac;

// ── 2. Données ────────────────────────────────────────────────────────────
console.log('données');
const frises = JSON.parse(lire('data/frises.json'));
const personnes = JSON.parse(lire('data/personnes.json'));
const precache = JSON.parse(lire('data/precache.json'));
ok(frises.length === 10, 'dix frises');
const croisades = JSON.parse(lire('data/croisades.json'));
ok(croisades.length === 12, 'douze croisades');
for (const c of croisades) {
  ok(c.resume.length && c.reperes.length >= 7 && c.chretiens.length, 'croisade ' + c.id + ' incomplète');
  for (const p of c.chretiens.concat(c.musulmans)) ok(personnes[p.q], 'croisade ' + c.id + ' : ' + p.q + ' sans fiche');
  for (let i = 1; i < c.reperes.length; i++) ok(c.reperes[i].date.replace('~', '').padStart(4, '0') >= c.reperes[i - 1].date.replace('~', '').padStart(4, '0').slice(0, c.reperes[i].date.length), c.id + ' : repères dans le désordre vers ' + c.reperes[i].date);
}
ok(personnes.Q346.croisades.map((c) => c.id).join(',') === 'albigeois,septieme,huitieme', 'Louis IX : Albigeois, septième, huitième');
ok(personnes.Q8581.croisades.some((c) => c.id === 'troisieme' && c.camp === 'musulman'), 'Saladin du côté musulman de la troisième croisade');
for (const f of frises) for (const m of f.mandats) if (m.ev) ok(croisades.some((c) => c.id === m.ev), 'événement inconnu ' + m.ev);
for (const f of frises) {
  for (const v of f.voies) {
    const liste = f.mandats.filter((m) => m.voie === v.id);
    ok(liste.length > 0, f.id + ' voie ' + v.id + ' vide');
    for (let i = 1; i < liste.length; i++) {
      ok(Dates.cle(liste[i].debut) >= Dates.cle(liste[i - 1].debut), f.id + ' : ' + liste[i].nom + ' avant ' + liste[i - 1].nom);
    }
  }
  for (const m of f.mandats) {
    ok(m.q === '-' || personnes[m.q], f.id + ' : fiche absente ' + m.q + ' (' + m.nom + ')');
    ok(m.nom && (m.titre || m.inst), f.id + ' : nom ou titre vide pour ' + m.q);
    ok(/^~?\d{1,4}(-\d\d){0,2}$/.test(m.debut), f.id + ' : début ' + m.debut);
    ok(f.periodes.some((p) => p.id === m.periode), f.id + ' : période ' + m.periode);
  }
}
let nbPortraits = 0;
for (const [q, p] of Object.entries(personnes)) {
  ok(p.nom && p.recherche, 'fiche ' + q + ' sans nom');
  if (p.portrait) {
    nbPortraits++;
    ok(precache['img/' + q + '.webp'], 'portrait non pré-caché ' + q);
    ok(fs.existsSync(path.join(RACINE, 'img', q + '.webp')), 'image absente ' + q);
  }
}
ok(nbPortraits === Object.keys(precache).length, 'precache = portraits');
ok(Object.keys(personnes).length > 800, 'plus de 800 fiches');
ok(personnes.Q7742 && personnes.Q7742.naissance === '1638-09-05', 'Louis XIV né le 5 septembre 1638');
ok(personnes.Q7742.pere && personnes.Q7742.pere.app, 'Louis XIII, père de Louis XIV, a sa fiche');



console.log('échelle et requêtes');
ok(Dates.cle('1643-05-14') === '1643-05-14' && Dates.cle('613', true) === '0613-12-31' && Dates.cle('~250') === '0250-01-01', 'clés de dates');
ok(Dates.lire('1643-05-14') === '14 mai 1643' && Dates.lire('1643-05-01') === '1ᵉʳ mai 1643' && Dates.lire('~250') === 'vers 250', 'lecture des dates');
ok(Dates.duree('1643-05-14', '1715-09-01') === '72 ans' && Dates.duree('1316-11-15', '1316-11-20') === '5 jours', 'durées');
ok(Dates.age('1638-09-05', '1715-09-01') === 76, 'âge de Louis XIV');
ok(Dates.siecle(1515) === 'XVIᵉ siècle' && Dates.siecle(100) === 'Iᵉʳ siècle' && Dates.siecle(2026) === 'XXIᵉ siècle', 'siècles');

const inter = [{ debut: 1000, fin: 1010 }, { debut: 1010, fin: 1010.02 }, { debut: 1010.02, fin: 1100 }, { debut: 1050, fin: 1060 }];
const e = Echelle.construire(inter, { pxParAn: 2, minimum: 40 });
ok(e.y(1010) < e.y(1010.02) && e.y(1010.02) - e.y(1010) >= 39.9, 'un mandat de sept jours a sa hauteur minimale');
ok(e.y(1100) - e.y(1010.02) >= 179, 'un long mandat garde sa proportion');
let mono = true;
for (let t = 999; t < 1101; t += 0.5) if (e.y(t + 0.5) < e.y(t)) mono = false;
ok(mono, 'échelle monotone');
ok(Math.abs(e.t(e.y(1055)) - 1055) < 0.01, 'inverse de l’échelle');
const grads = Echelle.graduations(e, 40);
ok(grads.some((g) => g.annee === 1100) && grads.every((g, i) => i === 0 || g.y - grads[i - 1].y >= 24), 'graduations espacées');
const cols = Echelle.colonnes([{ debut: 511.9, fin: 558 }, { debut: 511.9, fin: 561 }, { debut: 481, fin: 511.9 }, { debut: 600, fin: 610 }]);
ok(cols.find((c) => c.debut === 481).nb === 1 && cols.find((c) => c.fin === 558).nb === 2 && cols.find((c) => c.debut === 600).nb === 1, 'colonnes : Clovis seul, ses fils à deux');

const attendu = {
  '1515-09-13': { france: 'François Ier', angleterre: 'Henri VIII', allemagne: 'Maximilien Ier', papes: 'Léon X', hospitaliers: 'Fabrizio del Carretto', teutoniques: 'Albert de Brandebourg' },
  '1307-10-13': { france: 'Philippe IV le Bel', papes: 'Clément V', templiers: 'Jacques de Molay', angleterre: 'Édouard II', allemagne: 'Albert Ier de Habsbourg' },
  '1066-10-14': { angleterre: 'Harold II Godwinson', france: 'Philippe Ier', allemagne: 'Henri IV', papes: 'Alexandre II' },
  '1815-06-18': { france: 'Napoléon Ier', angleterre: 'George III', papes: 'Pie VII' },
  '1933-01-30': { allemagne: 'Paul von Hindenburg', france: 'Albert Lebrun', papes: 'Pie XI', 'grand-orient': 'Arthur Groussier' },
  '1945-05-01': { allemagne: 'Karl Dönitz', france: 'Charles de Gaulle' },
  '2024-01-01': { france: 'Emmanuel Macron', angleterre: 'Charles III', allemagne: 'Frank-Walter Steinmeier', papes: 'François', hospitaliers: 'John Dunlap', teutoniques: 'Frank Bayard', 'grand-orient': 'Guillaume Trichard' },
  '0800-12-25': { france: 'Charlemagne', papes: 'Léon III', islam: 'Haroun ar-Rachid' },
  '1187-07-04': { islam: 'An-Nasir', croisades: 'Guy de Lusignan' },
  '1453-05-29': { islam: 'Al-Qaim' },
  '0732-10-25': { islam: 'Hicham', france: 'Thierry IV' },
};
for (const [date, reponses] of Object.entries(attendu)) {
  for (const [frise, nom] of Object.entries(reponses)) {
    const f = Donnees.frise(frise);
    const actifs = Donnees.enPlace(frise, date, f.voies[0].id);
    ok(actifs.some((m) => m.nom === nom), date + ' ' + frise + ' : attendu ' + nom + ', trouvé ' + actifs.map((m) => m.nom).join(', '));
  }
}
ok(Donnees.enPlace('allemagne', '1933-01-30', 'chancelier').some((m) => m.nom === 'Adolf Hitler'), 'Hitler chancelier le 30 janvier 1933');
ok(Donnees.enPlace('allemagne', '1871-05-10', 'chancelier').some((m) => m.nom === 'Otto von Bismarck'), 'Bismarck chancelier en 1871');
ok(Donnees.enPlace('papes', '1400-01-01', 'avignon').some((m) => m.nom === 'Benoît XIII'), 'Benoît XIII à Avignon en 1400');
ok(Donnees.enPlace('islam', '1187-07-04', 'egypte').some((m) => m.nom === 'Saladin'), 'Saladin sultan à Hattin');
ok(Donnees.enPlace('islam', '1453-05-29', 'sultans').some((m) => m.nom === 'Mehmed II'), 'Mehmed II prend Constantinople');
ok(Donnees.enPlace('islam', '1250-03-01', 'egypte').some((m) => m.nom === 'Turanshah'), 'Turanshah face à saint Louis');
ok(Donnees.enPlace('croisades', '1190-06-10', 'expeditions').some((m) => m.ev === 'troisieme'), 'troisième croisade en cours en 1190');
ok(Donnees.tableau('1099-07-15').some((l) => l.frise.id === 'croisades' && l.mandats.some((m) => m.ev === 'premiere')), 'tableau de 1099 : première croisade');
ok(Donnees.croisade('septieme').chretiens.some((p) => p.q === 'Q346' && p.nom === 'Louis IX (Saint Louis)'), 'Louis IX nommé dans la septième');
ok(Donnees.changement('1715-01-01', 1) === '1715-09-01', 'prochain changement après le 1er janvier 1715 : mort de Louis XIV');
const tableau = Donnees.tableau('1515-09-13');
ok(tableau.length === 9 && tableau.every((l) => l.mandats.length), 'tableau de 1515 : neuf lignes (trois pour l’islam), toutes pourvues');
const vacances = Donnees.tableau('1741-01-01').filter((l) => !l.mandats.length);
ok(vacances.length === 1 && vacances[0].frise.id === 'allemagne', 'vacance en 1741 : le trône impérial seulement');
ok(Donnees.tableau('1330-01-01').some((l) => l.frise.id === 'templiers' && !l.mandats.length), 'en 1330, le Temple disparu depuis peu a encore sa ligne');
ok(!Donnees.tableau('2024-01-01').some((l) => l.frise.id === 'templiers'), 'en 2024, plus de ligne pour le Temple');
ok(Donnees.rechercher('barberousse')[0].p.nom === 'Frédéric Ier Barberousse', 'recherche sans accent');
ok(Donnees.rechercher('molay')[0].q === 'Q208215', 'recherche Molay');
const l14 = Donnees.mandatsDe('Q7742')[0];
ok(l14.precedent.nom === 'Louis XIII' && l14.suivant.nom === 'Louis XV', 'voisins de Louis XIV');

console.log('\n' + reussites + ' réussites, ' + echecs + ' échecs');
process.exit(echecs ? 1 : 0);
