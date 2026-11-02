# Histoires — frises des souverains, papes et grands maîtres

Application web hors ligne (PWA) qui met sur des frises chronologiques lisibles
au téléphone :

- **France** : rois des Francs et de France, empereurs, présidents (481 → aujourd’hui) ;
- **Angleterre** : souverains d’Angleterre puis du Royaume-Uni (871 → aujourd’hui) ;
- **Allemagne** : rois de Germanie et empereurs du Saint-Empire, empereurs allemands,
  présidents, chefs d’État de la RDA, et les chanceliers (843 → aujourd’hui) ;
- **Papes** : les 267 papes, avec la papauté d’Avignon et l’obédience d’Avignon et de Pise
  du Grand Schisme ;
- **Ordres** : maîtres du Temple, grands maîtres de l’Hôpital (Saint-Jean, Rhodes, Malte),
  de l’ordre Teutonique et du Grand Orient de France.

Chaque personnage a sa fiche : dates et lieux, mandats avec prédécesseur et successeur,
repères datés, famille (parents, conjoints, enfants — cliquables quand ils ont leur fiche),
contemporains dans les autres frises, résumé d’après Wikipédia, portrait crédité.
Une date donne tous ceux qui étaient en place ce jour-là.

En ligne : <https://cristo67000.github.io/histoires/>

## Dossier

    index.html, sw.js, manifest.webmanifest, css/, js/   l’application (zéro build)
    data/frises.json                                      frises : voies, périodes, mandats
    data/personnes.json                                   fiches
    data/precache.json                                    portraits, avec leur empreinte
    img/Q….webp                                           portraits (320 px de large)
    build/frises/*.txt                                    LES LISTES, écrites à la main (format en tête de 01-france.txt)
    build/                                                scripts de construction (Python 3.11, Pillow)

## Reconstruire les données

    python build/titulaires.py        brouillon Wikidata des titulaires (atelier, pour relecture)
    python build/resoudre.py          propose des identifiants pour les « ?Nom » des frises
    python build/personnes.py         fiches Wikidata pour tous les identifiants des frises
    python build/textes.py            introductions de Wikipédia en français
    python build/portraits.py         portraits de Commons (licences libres seulement) → img/
    python build/construire.py        assemble data/ ; échoue à la moindre incohérence
    node build/essais.mjs             épreuves (coquille, données, échelle, requêtes par date)

Les fichiers intermédiaires vont dans `build/.atelier/` et `build/.sources-images/`
(hors du dépôt). Pour remplacer ou écarter un portrait : `build/portraits-choix.txt`
(`Qxxx: Nom_de_fichier.jpg` ou `Qxxx: -`), puis `portraits.py` et `construire.py`.

## Développement

Serveur local sans cache : configuration `histoires` du `.claude/launch.json` du dossier
parent (port 8240), ou `node -e "import('./build/serveur_local.mjs').then(m => m.demarrerServeur(8240))"`.
Ouvrir `index.html?sans-sw` pour travailler sans le service worker.

À chaque version : `VERSION` dans `sw.js` et `application-version` dans `index.html`, ensemble.

## Sources et licences

- Listes : établies à la main d’après les listes de référence (Wikipédia), vérifiées une à une.
- Dates, lieux, filiations, images : [Wikidata](https://www.wikidata.org/) (CC0).
- Résumés : [Wikipédia en français](https://fr.wikipedia.org/) (CC BY-SA 4.0), avec lien vers l’article.
- Portraits : [Wikimedia Commons](https://commons.wikimedia.org/), domaine public ou licence libre
  avec attribution (CC BY, CC BY-SA, Licence Ouverte, OGL) ; auteur et licence sur chaque fiche.
- Code de l’application : © 2026, tous droits réservés.
