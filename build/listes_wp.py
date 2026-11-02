"""Récupère le wikitexte de listes de Wikipédia (atelier, pour relecture)."""
import io
import json
import os
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wd import obtenir

ATELIER = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.atelier', 'wp')
os.makedirs(ATELIER, exist_ok=True)

PAGES = [
    'Liste des grands maîtres de l\'ordre de Saint-Jean de Jérusalem',
    'Liste des grands maîtres de l\'ordre Teutonique',
    'Liste des grands maîtres du Grand Orient de France',
    'Grand Orient de France',
    'Liste des monarques de France',
    'Liste des souverains du Saint-Empire',
    'Liste des papes',
    'Liste des antipapes',
    'Liste des monarques d\'Angleterre',
    'Liste des monarques britanniques',
    'Liste des chanceliers d\'Allemagne',
    'Liste des présidents de l\'Allemagne',
    'Liste des chefs d\'État de la République démocratique allemande',
    'Liste des maîtres de l\'ordre du Temple',
    'Liste des rois des Francs',
]


def wikitexte(titre):
    p = {'action': 'parse', 'page': titre, 'prop': 'wikitext', 'format': 'json', 'redirects': '1'}
    d = json.loads(obtenir('https://fr.wikipedia.org/w/api.php?' + urllib.parse.urlencode(p)))
    if 'error' in d:
        return None
    return d['parse']['wikitext']['*']


for titre in PAGES:
    t = wikitexte(titre)
    nom = titre.replace('/', '-').replace("'", '') + '.txt'
    if t is None:
        print('absent :', titre)
        continue
    with io.open(os.path.join(ATELIER, nom), 'w', encoding='utf-8') as f:
        f.write(t)
    print('%6d  %s' % (len(t), titre))
