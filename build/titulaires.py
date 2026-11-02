"""
Étape 1 — les titulaires de chaque fonction, d'après Wikidata (P39 « fonction »
avec ses qualificatifs de début et de fin). Écrit build/.atelier/titulaires.json,
un brouillon à relire : les listes finales sont fixées dans build/frises.txt.

    python build/titulaires.py
"""
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wd import sparql

ICI = os.path.dirname(os.path.abspath(__file__))
ATELIER = os.path.join(ICI, '.atelier')
os.makedirs(ATELIER, exist_ok=True)

FONCTIONS = {
    # France
    'Q22923081': 'roi des Francs',
    'Q18384454': 'roi de France',
    'Q3439798': 'roi de France et de Navarre',
    'Q5373953': 'empereur des Français',
    'Q1131971': 'Premier consul',
    'Q191954': 'président de la République française',
    'Q19018293': "chef de l'État français",
    'Q23004974': 'président du GPRF',
    # Angleterre / Royaume-Uni
    'Q18810062': "monarque d'Angleterre",
    'Q110324075': 'monarque de Grande-Bretagne',
    'Q9134365': 'monarque du Royaume-Uni',
    'Q42913053': 'lord-protecteur',
    # Saint-Empire / Allemagne
    'Q181765': 'empereur romain germanique',
    'Q782985': 'roi des Romains',
    'Q24004130': 'roi de Germanie',
    'Q501503': 'empereur allemand',
    'Q157740': 'président du Reich',
    'Q25223': 'président fédéral',
    'Q56022': "chancelier d'Allemagne",
    'Q7050658': 'chancelier du Reich',
    'Q7618907': 'chancelier impérial',
    'Q29034484': 'chancelier du Reich (Weimar)',
    'Q4970706': 'chancelier fédéral',
    # Papes
    'Q19546': 'pape',
    'Q172748': 'antipape',
    # Ordres
    'Q22673588': 'grand maître du Temple',
    'Q15974902': 'grand maître de Saint-Jean',
    'Q20671815': 'grand maître de Malte',
    'Q9373006': 'grand maître teutonique',
    'Q20722965': 'grand maître du GODF',
}

REQUETE = """
SELECT ?p ?pLabel ?pDescription ?debut ?fin ?ordinal ?avant ?apres ?nature ?rang ?de WHERE {
  ?p p:P39 ?st . ?st ps:P39 wd:%s .
  ?st wikibase:rank ?rang .
  OPTIONAL { ?st pq:P580 ?debut }
  OPTIONAL { ?st pq:P582 ?fin }
  OPTIONAL { ?st pq:P1545 ?ordinal }
  OPTIONAL { ?st pq:P1365 ?avant }
  OPTIONAL { ?st pq:P1366 ?apres }
  OPTIONAL { ?st pq:P5102 ?nature }
  OPTIONAL { ?st pq:P642 ?de }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en,de". }
}
"""


def main():
    tout = {}
    for qid, nom in FONCTIONS.items():
        lignes = sparql(REQUETE % qid)
        lignes.sort(key=lambda l: l.get('debut', '9999'))
        tout[qid] = {'nom': nom, 'titulaires': lignes}
        print('%-40s %3d' % (nom, len(lignes)))
    with io.open(os.path.join(ATELIER, 'titulaires.json'), 'w', encoding='utf-8') as f:
        json.dump(tout, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
