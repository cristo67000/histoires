"""
Étape 2 — la fiche de chaque personne, d'après Wikidata.

    python build/personnes.py          lit les frises, interroge Wikidata, écrit build/.atelier/wikidata.json

Pour chaque identifiant des frises : libellé et description en français,
naissance et mort (date, lieu), parents, conjoints (avec dates de mariage),
enfants, maison/dynastie, cause de la mort, image (P18), titre de l'article
de Wikipédia en français, événements datés (P793) et conflits (P607).
Puis, pour les personnes liées (conjoints, enfants, parents) : libellé et
dates seulement.
"""
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wd import entites
from lire_frises import lire, identifiants

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, '.atelier', 'wikidata.json')


def valeur(snak):
    if snak.get('snaktype') != 'value':
        return None
    return snak['datavalue']['value']


def temps(v):
    """'+1643-05-14T00:00:00Z' précision 11 → '1643-05-14' ; 10 → '1643-05' ; 9 → '1643' ; moins → '~1640'."""
    if not v:
        return None
    t = v['time']
    p = v.get('precision', 11)
    signe = '-' if t.startswith('-') else ''
    an, mois, jour = t[1:].split('T')[0].split('-')
    an = str(int(an))
    if p >= 11:
        return signe + '%s-%s-%s' % (an, mois, jour)
    if p == 10:
        return signe + '%s-%s' % (an, mois)
    if p == 9:
        return signe + an
    return '~' + signe + an


def premier(claims, prop, genre='temps'):
    for st in claims.get(prop, []):
        if st.get('rank') == 'deprecated':
            continue
        v = valeur(st['mainsnak'])
        if v is None:
            continue
        if genre == 'temps':
            return temps(v)
        if genre == 'item':
            return v['id']
        if genre == 'texte':
            return v
    return None


def items(claims, prop):
    out = []
    for st in claims.get(prop, []):
        if st.get('rank') == 'deprecated':
            continue
        v = valeur(st['mainsnak'])
        if v and isinstance(v, dict) and v.get('id') and v['id'] not in out:
            out.append(v['id'])
    return out


def qualificatif(st, prop):
    q = st.get('qualifiers', {}).get(prop)
    if not q:
        return None
    v = valeur(q[0])
    return temps(v) if v else None


def extraire(ent):
    c = ent.get('claims', {})
    lab = ent.get('labels', {})
    desc = ent.get('descriptions', {})
    conjoints = []
    for st in c.get('P26', []):
        if st.get('rank') == 'deprecated':
            continue
        v = valeur(st['mainsnak'])
        if not v:
            continue
        conjoints.append({'q': v['id'], 'debut': qualificatif(st, 'P580'), 'fin': qualificatif(st, 'P582')})
    evenements = []
    for st in c.get('P793', []):
        v = valeur(st['mainsnak'])
        if not v:
            continue
        evenements.append({'q': v['id'], 'date': qualificatif(st, 'P585') or qualificatif(st, 'P580')})
    fonctions = []
    for st in c.get('P39', []):
        if st.get('rank') == 'deprecated':
            continue
        v = valeur(st['mainsnak'])
        if not v:
            continue
        fonctions.append({'q': v['id'], 'debut': qualificatif(st, 'P580'), 'fin': qualificatif(st, 'P582')})
    return {
        'nom': lab.get('fr', lab.get('en', lab.get('de', {}))).get('value'),
        'nom_en': lab.get('en', {}).get('value'),
        'desc': desc.get('fr', {}).get('value'),
        'humain': 'Q5' in items(c, 'P31'),
        'naissance': premier(c, 'P569'),
        'mort': premier(c, 'P570'),
        'lieu_naissance': premier(c, 'P19', 'item'),
        'lieu_mort': premier(c, 'P20', 'item'),
        'cause_mort': items(c, 'P509'),
        'maniere_mort': items(c, 'P1196'),
        'sepulture': premier(c, 'P119', 'item'),
        'pere': premier(c, 'P22', 'item'),
        'mere': premier(c, 'P25', 'item'),
        'conjoints': conjoints,
        'enfants': items(c, 'P40'),
        'maison': items(c, 'P53'),
        'image': premier(c, 'P18', 'texte'),
        'blason': premier(c, 'P94', 'texte'),
        'evenements': evenements,
        'fonctions': fonctions,
        'conflits': items(c, 'P607'),
        'wp': ent.get('sitelinks', {}).get('frwiki', {}).get('title'),
        'wp_en': ent.get('sitelinks', {}).get('enwiki', {}).get('title'),
        'wp_de': ent.get('sitelinks', {}).get('dewiki', {}).get('title'),
    }


def main():
    frises = lire()
    ids = identifiants(frises)
    print(len(ids), 'personnes et institutions')
    brut = entites(ids)
    personnes = {}
    for q in ids:
        if q not in brut or 'missing' in brut[q]:
            print('absent :', q)
            continue
        personnes[q] = extraire(brut[q])
    # entités liées : conjoints, enfants, parents, lieux, maisons, causes, événements, fonctions, conflits
    lies = set()
    for p in personnes.values():
        for cj in p['conjoints']:
            lies.add(cj['q'])
        lies.update(p['enfants'])
        for k in ('pere', 'mere', 'lieu_naissance', 'lieu_mort', 'sepulture'):
            if p[k]:
                lies.add(p[k])
        lies.update(p['maison'])
        lies.update(p['cause_mort'])
        lies.update(p['maniere_mort'])
        lies.update(p['conflits'])
        for e in p['evenements']:
            lies.add(e['q'])
        for f in p['fonctions']:
            lies.add(f['q'])
    lies -= set(personnes)
    print(len(lies), 'entités liées')
    brut_lies = entites(sorted(lies), props='labels|claims', langues='fr|en|de')
    liees = {}
    for q, ent in brut_lies.items():
        if 'missing' in ent:
            continue
        c = ent.get('claims', {})
        lab = ent.get('labels', {})
        liees[q] = {
            'nom': lab.get('fr', lab.get('en', lab.get('de', {}))).get('value'),
            'fr': 'fr' in lab,
            'naissance': premier(c, 'P569'),
            'mort': premier(c, 'P570'),
            'humain': 'Q5' in items(c, 'P31'),
        }
    with io.open(SORTIE, 'w', encoding='utf-8') as f:
        json.dump({'personnes': personnes, 'liees': liees}, f, ensure_ascii=False, indent=1)
    sans_wp = [q for q, p in personnes.items() if not p['wp']]
    sans_img = [q for q, p in personnes.items() if not p['image']]
    print('sans article fr :', len(sans_wp), ' sans image :', len(sans_img))


if __name__ == '__main__':
    main()
