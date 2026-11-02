"""
Étape 5 — assemble les données de l'application.

    python build/construire.py

Lit build/frises/*.txt, build/.atelier/wikidata.json, textes.json et
portraits.json, vérifie la cohérence et écrit :

    data/frises.json      les frises : voies, périodes, mandats
    data/personnes.json   les fiches : état civil, famille, repères, résumé, portrait
    data/precache.json    la liste des images à ranger hors ligne, avec leur empreinte

Le script échoue (code 1) à la première incohérence : identifiant inconnu,
date mal formée, période sans mandat, mandat hors de sa période.
"""
import hashlib
import io
import json
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lire_frises import lire, identifiants

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
ATELIER = os.path.join(ICI, '.atelier')
DATA = os.path.join(RACINE, 'data')
IMG = os.path.join(RACINE, 'img')

sys.stdout.reconfigure(encoding='utf-8')
erreurs = []


def erreur(m):
    erreurs.append(m)


def an(date):
    if not date:
        return None
    return int(re.match(r'^~?(-?\d+)', date).group(1))


def cle_tri(date):
    """'1643-05-14' → '1643-05-14', '1643' → '1643-00-00' (comparaison de chaînes)."""
    if not date:
        return '9999-99-99'
    d = date.lstrip('~')
    m = re.match(r'^(-?\d+)(?:-(\d\d))?(?:-(\d\d))?', d)
    if not m:
        return '9999-99-99'
    annee = int(m.group(1))
    if annee < 0:
        return '-%04d-%s-%s' % (10000 + annee, m.group(2) or '00', m.group(3) or '00')
    return '%04d-%s-%s' % (annee, m.group(2) or '00', m.group(3) or '00')


def normaliser(texte):
    t = unicodedata.normalize('NFKD', texte or '')
    t = ''.join(c for c in t if not unicodedata.combining(c))
    t = t.replace('Æ', 'AE').replace('æ', 'ae').replace('Œ', 'OE').replace('œ', 'oe').replace('ß', 'ss')
    return re.sub(r'[^a-z0-9 ]+', ' ', t.lower()).strip()


def nom_lie(q, liees, personnes_app):
    """Un proche : son nom, ses dates, et s'il a une fiche dans l'application."""
    if q in personnes_app:
        p = personnes_app[q]
        return {'q': q, 'nom': p['nom'], 'n': p.get('naissance'), 'm': p.get('mort'), 'app': True}
    l = liees.get(q)
    if not l or not l.get('nom'):
        return None
    return {'q': q, 'nom': l['nom'], 'n': l.get('naissance'), 'm': l.get('mort')}


def libelle(q, liees):
    l = liees.get(q)
    return l['nom'] if l and l.get('nom') else None


def main():
    frises = lire()
    wd = json.load(io.open(os.path.join(ATELIER, 'wikidata.json'), encoding='utf-8'))
    textes = json.load(io.open(os.path.join(ATELIER, 'textes.json'), encoding='utf-8'))
    portraits = json.load(io.open(os.path.join(ATELIER, 'portraits.json'), encoding='utf-8'))
    personnes_wd = wd['personnes']
    liees = wd['liees']
    ids = identifiants(frises)

    # ── Frises ──────────────────────────────────────────────────────────
    sortie_frises = []
    for f in frises:
        for cle in ('nom', 'titre', 'groupe', 'couleur'):
            if not f.get(cle):
                erreur('frise %s : « %s » manquant' % (f['id'], cle))
        periodes = {p['id']: p for p in f['periodes']}
        mandats = []
        for m in f['mandats']:
            if m['q'] != '-' and m['q'] not in personnes_wd:
                erreur('%s : %s absent de wikidata.json' % (m['lieu'], m['q']))
            p = periodes[m['periode']]
            if an(m['debut']) < an(p['debut']) - 1 or (p['fin'] and an(m['debut']) > an(p['fin']) + 1):
                erreur('%s : début %s hors de la période %s (%s–%s)' % (m['lieu'], m['debut'], p['id'], p['debut'], p['fin']))
            if m['fin'] and cle_tri(m['fin']) < cle_tri(m['debut']):
                erreur('%s : fin avant début' % m['lieu'])
            mandats.append({
                'q': m['q'], 'nom': m['nom'], 'debut': m['debut'], 'fin': m['fin'] or None,
                'titre': m['titre'], 'note': m['note'] or None, 'voie': m['voie'], 'periode': m['periode'],
                'inst': m['inst'] or None,
            })
        mandats.sort(key=lambda m: (cle_tri(m['debut']), cle_tri(m['fin'])))
        for p in f['periodes']:
            siens = [m for m in mandats if m['periode'] == p['id']]
            if not siens:
                erreur('frise %s : période %s sans mandat' % (f['id'], p['id']))
            else:
                p['voie'] = siens[0]['voie']
        sortie_frises.append({
            'id': f['id'], 'nom': f['nom'], 'titre': f['titre'], 'groupe': f['groupe'], 'couleur': f['couleur'],
            'voies': f['voies'],
            'periodes': [{'id': p['id'], 'nom': p['nom'], 'debut': p['debut'], 'fin': p['fin'] or None,
                          'couleur': p['couleur'], 'note': p['note'] or None, 'voie': p.get('voie')} for p in f['periodes']],
            'mandats': mandats,
        })

    # ── Personnes ───────────────────────────────────────────────────────
    sortie_personnes = {}
    for q in ids:
        p = personnes_wd.get(q)
        if not p:
            continue
        nom_app = None
        for f in frises:
            for m in f['mandats']:
                if m['q'] == q:
                    nom_app = nom_app or m['nom']
        texte = textes.get(q, {})
        portrait = portraits.get(q)
        fiche = {
            'nom': nom_app or p['nom'],
            'wd': p['nom'],
            'desc': p.get('desc'),
            'humain': p.get('humain', True),
            'naissance': p.get('naissance'), 'mort': p.get('mort'),
            'lieu_naissance': libelle(p['lieu_naissance'], liees) if p.get('lieu_naissance') else None,
            'lieu_mort': libelle(p['lieu_mort'], liees) if p.get('lieu_mort') else None,
            'sepulture': libelle(p['sepulture'], liees) if p.get('sepulture') else None,
            'cause_mort': [libelle(c, liees) for c in p.get('cause_mort', []) if libelle(c, liees)],
            'maniere_mort': [libelle(c, liees) for c in p.get('maniere_mort', []) if libelle(c, liees)],
            'maison': [libelle(c, liees) for c in p.get('maison', []) if libelle(c, liees)],
            'pere': nom_lie(p['pere'], liees, personnes_wd) if p.get('pere') else None,
            'mere': nom_lie(p['mere'], liees, personnes_wd) if p.get('mere') else None,
            'conjoints': [], 'enfants': [],
            'evenements': [], 'fonctions': [], 'conflits': [],
            'texte': texte.get('texte') or None,
            'wp': texte.get('titre') or p.get('wp'),
            'portrait': None,
            'recherche': normaliser((nom_app or '') + ' ' + (p['nom'] or '') + ' ' + (p.get('nom_en') or '')),
        }
        if fiche['pere'] and fiche['pere'].get('app'):
            fiche['pere']['nom'] = sortie_nom(fiche['pere']['q'], frises) or fiche['pere']['nom']
        if fiche['mere'] and fiche['mere'].get('app'):
            fiche['mere']['nom'] = sortie_nom(fiche['mere']['q'], frises) or fiche['mere']['nom']
        for cj in p.get('conjoints', []):
            n = nom_lie(cj['q'], liees, personnes_wd)
            if not n:
                continue
            if n.get('app'):
                n['nom'] = sortie_nom(cj['q'], frises) or n['nom']
            if cj.get('debut'):
                n['debut'] = cj['debut']
            if cj.get('fin'):
                n['fin'] = cj['fin']
            fiche['conjoints'].append(n)
        fiche['conjoints'].sort(key=lambda c: cle_tri(c.get('debut')) if c.get('debut') else cle_tri(c.get('n')))
        for e in p.get('enfants', []):
            n = nom_lie(e, liees, personnes_wd)
            if not n:
                continue
            if n.get('app'):
                n['nom'] = sortie_nom(e, frises) or n['nom']
            fiche['enfants'].append(n)
        fiche['enfants'].sort(key=lambda c: cle_tri(c.get('n')))
        for e in p.get('evenements', []):
            l = libelle(e['q'], liees)
            if l and e.get('date'):
                fiche['evenements'].append({'nom': l, 'date': e['date']})
        for fo in p.get('fonctions', []):
            l = libelle(fo['q'], liees)
            if l and fo.get('debut'):
                fiche['fonctions'].append({'nom': l, 'debut': fo['debut'], 'fin': fo.get('fin')})
        fiche['fonctions'].sort(key=lambda x: cle_tri(x['debut']))
        fiche['conflits'] = [libelle(c, liees) for c in p.get('conflits', []) if libelle(c, liees)][:8]
        if portrait:
            fiche['portrait'] = {
                'w': portrait['w'], 'h': portrait['h'], 'licence': portrait['licence'],
                'auteur': portrait.get('auteur') or None, 'page': portrait.get('page'),
                'licence_url': portrait.get('licence_url') or None,
            }
        sortie_personnes[q] = fiche

    if erreurs:
        for e in erreurs:
            print('ERREUR', e)
        sys.exit(1)

    os.makedirs(DATA, exist_ok=True)
    with io.open(os.path.join(DATA, 'frises.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(sortie_frises, f, ensure_ascii=False, separators=(',', ':'))
    with io.open(os.path.join(DATA, 'personnes.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(sortie_personnes, f, ensure_ascii=False, separators=(',', ':'))
    precache = {}
    for q, fiche in sortie_personnes.items():
        if fiche['portrait']:
            chemin = os.path.join(IMG, q + '.webp')
            if not os.path.exists(chemin):
                print('ERREUR image manquante', chemin)
                sys.exit(1)
            precache['img/' + q + '.webp'] = hashlib.sha256(open(chemin, 'rb').read()).hexdigest()[:12]
    with io.open(os.path.join(DATA, 'precache.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(precache, f, ensure_ascii=False, separators=(',', ':'))
    nb_m = sum(len(f['mandats']) for f in sortie_frises)
    taille = sum(os.path.getsize(os.path.join(IMG, k[4:])) for k in precache)
    print('%d frises, %d mandats, %d fiches, %d avec résumé, %d portraits (%.1f Mo)' % (
        len(sortie_frises), nb_m, len(sortie_personnes),
        sum(1 for p in sortie_personnes.values() if p['texte']), len(precache), taille / 1e6))
    for nom in ('frises.json', 'personnes.json'):
        print('  data/%s : %d Ko' % (nom, os.path.getsize(os.path.join(DATA, nom)) // 1024))


_noms = None


def sortie_nom(q, frises):
    global _noms
    if _noms is None:
        _noms = {}
        for f in frises:
            for m in f['mandats']:
                _noms.setdefault(m['q'], m['nom'])
    return _noms.get(q)


if __name__ == '__main__':
    main()
