"""Petits outils Wikidata partagés par les scripts de construction."""
import json
import sys
import time
import urllib.parse
import urllib.request

AGENT = {'User-Agent': 'HistoiresApp/0.1 (https://cristo67000.github.io/histoires/; cristo67apps@gmail.com)'}
sys.stdout.reconfigure(encoding='utf-8')


def obtenir(url, essais=5, donnees=None):
    for essai in range(essais):
        try:
            req = urllib.request.Request(url, headers=AGENT, data=donnees)
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except Exception as e:
            if essai == essais - 1:
                raise
            time.sleep(4 + 6 * essai)


def sparql(requete):
    url = 'https://query.wikidata.org/sparql'
    corps = urllib.parse.urlencode({'format': 'json', 'query': requete}).encode()
    d = json.loads(obtenir(url, donnees=corps))
    lignes = []
    for b in d['results']['bindings']:
        ligne = {}
        for k, v in b.items():
            val = v['value']
            if v['type'] == 'uri' and val.startswith('http://www.wikidata.org/entity/'):
                val = val.rsplit('/', 1)[1]
            ligne[k] = val
        lignes.append(ligne)
    return lignes


def chercher(texte, langue='fr', n=8):
    p = {'action': 'wbsearchentities', 'search': texte, 'language': langue, 'uselang': 'fr',
         'format': 'json', 'limit': str(n), 'type': 'item'}
    d = json.loads(obtenir('https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode(p)))
    return [(e['id'], e.get('label'), e.get('description', '')) for e in d.get('search', [])]


def entites(ids, props='labels|descriptions|claims|sitelinks', langues='fr|en|de'):
    """Lit des entités par lots de 50."""
    ids = list(ids)
    resultat = {}
    for i in range(0, len(ids), 50):
        lot = ids[i:i + 50]
        p = {'action': 'wbgetentities', 'ids': '|'.join(lot), 'props': props, 'languages': langues,
             'format': 'json'}
        d = json.loads(obtenir('https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode(p)))
        resultat.update(d.get('entities', {}))
    return resultat


if __name__ == '__main__':
    for t in sys.argv[1:]:
        print('##', t)
        for e in chercher(t):
            print('  ', e[0], '—', e[1], '—', e[2][:90])
