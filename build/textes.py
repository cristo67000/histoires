"""
Étape 3 — le résumé de chaque fiche : l'introduction de l'article de Wikipédia
en français (texte sous licence CC BY-SA, crédité dans l'application).

    python build/textes.py        écrit build/.atelier/textes.json

Sans article en français, on garde la description de Wikidata seule.
"""
import io
import json
import os
import re
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wd import obtenir

ICI = os.path.dirname(os.path.abspath(__file__))
ENTREE = os.path.join(ICI, '.atelier', 'wikidata.json')
SORTIE = os.path.join(ICI, '.atelier', 'textes.json')
API = 'https://fr.wikipedia.org/w/api.php'
MAXI = 2600


def extraits(titres):
    p = {'action': 'query', 'prop': 'extracts', 'exintro': '1', 'explaintext': '1', 'exlimit': '20',
         'titles': '|'.join(titres), 'redirects': '1', 'format': 'json', 'formatversion': '2'}
    d = json.loads(obtenir(API, donnees=urllib.parse.urlencode(p).encode()))
    out = {}
    if 'query' not in d:
        print('réponse sans query :', str(d)[:200])
        if len(titres) > 1:
            for t in titres:
                out.update(extraits([t]))
        return out
    renommes = {}
    for r in d['query'].get('redirects', []) + d['query'].get('normalized', []):
        renommes[r['to']] = r['from']
    for page in d['query']['pages']:
        t = page['title']
        orig = renommes.get(t, t)
        out[orig] = (t, page.get('extract', ''))
    return out


def nettoyer(texte):
    texte = texte.replace(' ', ' ')
    # prononciations entre crochets, notes « [1] », titres de section
    texte = re.sub(r'\[[^\]]{1,40}\]', '', texte)
    texte = re.sub(r'\n==+[^=]+==+\n', '\n', texte)
    paras = [p.strip() for p in texte.split('\n') if p.strip()]
    texte = '\n'.join(paras)
    texte = re.sub(r' +', ' ', texte)
    texte = re.sub(r' ([,.;:!?])', r'\1', texte)
    if len(texte) > MAXI:
        coupe = texte[:MAXI]
        point = max(coupe.rfind('. '), coupe.rfind('.\n'))
        if point > MAXI * 0.6:
            texte = coupe[:point + 1]
        else:
            texte = coupe.rsplit(' ', 1)[0] + '…'
    return texte


def main():
    d = json.load(io.open(ENTREE, encoding='utf-8'))
    personnes = d['personnes']
    titres = {}
    for q, p in personnes.items():
        if p.get('wp'):
            titres.setdefault(p['wp'], []).append(q)
    resultat = {}
    if os.path.exists(SORTIE) and '--tout' not in sys.argv:
        resultat = json.load(io.open(SORTIE, encoding='utf-8'))
    liste = [t for t, qs in titres.items() if any(q not in resultat for q in qs)]
    print(len(liste), 'articles à lire')
    for i in range(0, len(liste), 20):
        lot = liste[i:i + 20]
        for titre, (titre_final, texte) in extraits(lot).items():
            for q in titres.get(titre, []):
                resultat[q] = {'titre': titre_final, 'texte': nettoyer(texte)}
        print('%d/%d' % (min(i + 20, len(liste)), len(liste)), end='\r')
    print()
    manquants = [q for q in titres.values() for q in q if q not in resultat]
    print('sans extrait :', len(manquants), manquants[:10])
    vides = [q for q, r in resultat.items() if len(r['texte']) < 80]
    print('extraits très courts :', len(vides), vides[:10])
    with io.open(SORTIE, 'w', encoding='utf-8') as f:
        json.dump(resultat, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
