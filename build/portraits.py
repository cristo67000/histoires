"""
Étape 4 — les portraits : l'image Wikidata (P18) de chaque personne, prise sur
Wikimedia Commons si sa licence le permet, réduite et écrite en WebP dans img/.

    python build/portraits.py             télécharge ce qui manque, écrit build/.atelier/portraits.json
    python build/portraits.py --verifier  ne télécharge rien

Licences acceptées : domaine public, CC0, CC BY, CC BY-SA (toutes versions) —
l'application affiche l'auteur et la licence sous chaque image. Tout le reste
est refusé (la personne reste sans portrait). Les originaux sont gardés dans
build/.sources-images/ (hors du dépôt) : une seconde passe ne retélécharge rien.
Une image peut être remplacée ou écartée par build/portraits-choix.txt
(lignes « Qxxx: Nom_de_fichier_Commons.jpg » ou « Qxxx: - »).
"""
import hashlib
import io
import json
import os
import re
import sys
import urllib.parse

from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wd import obtenir

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
ENTREE = os.path.join(ICI, '.atelier', 'wikidata.json')
SORTIE = os.path.join(ICI, '.atelier', 'portraits.json')
CHOIX = os.path.join(ICI, 'portraits-choix.txt')
ORIGINAUX = os.path.join(ICI, '.sources-images')
DOSSIER_IMG = os.path.join(RACINE, 'img')
API = 'https://commons.wikimedia.org/w/api.php'
LARGEUR_SOURCE = 800
LARGEUR = 320
HAUTEUR_MAX = 420
QUALITE = 68


def nettoyer(html):
    texte = re.sub(r'<[^>]+>', ' ', str(html or ''))
    texte = texte.replace('&amp;', '&').replace('&quot;', '"').replace('&#39;', "'").replace('&nbsp;', ' ')
    return re.sub(r'\s+', ' ', texte).strip()


def informations(titre):
    p = {'action': 'query', 'titles': 'File:' + titre, 'prop': 'imageinfo', 'redirects': '1',
         'iiprop': 'url|size|extmetadata|sha1|mime', 'iiurlwidth': str(LARGEUR_SOURCE), 'format': 'json'}
    r = json.loads(obtenir(API + '?' + urllib.parse.urlencode(p)))
    fiche = list(r['query']['pages'].values())[0]
    if 'imageinfo' not in fiche:
        return None
    ii = fiche['imageinfo'][0]
    em = ii.get('extmetadata', {})
    return {
        'titre': fiche['title'][len('File:'):],
        'url': ii['url'], 'vignette': ii.get('thumburl'), 'w': ii['width'], 'h': ii['height'],
        'sha1': ii.get('sha1'), 'mime': ii.get('mime'),
        'page': ii.get('descriptionurl'),
        'licence': nettoyer(em.get('LicenseShortName', {}).get('value')),
        'licence_code': nettoyer(em.get('License', {}).get('value')).lower(),
        'licence_url': nettoyer(em.get('LicenseUrl', {}).get('value')),
        'auteur': nettoyer(em.get('Artist', {}).get('value'))[:160],
        'credit': nettoyer(em.get('Credit', {}).get('value'))[:160],
        'date': nettoyer(em.get('DateTimeOriginal', {}).get('value'))[:60],
    }


def libre(info):
    """Domaine public, CC0, CC BY ou CC BY-SA. Pas de NC, pas de ND, pas de GFDL seule."""
    code = info['licence_code']
    lic = info['licence'].lower()
    if code in ('cc0', 'pd') or code.startswith('pd-') or lic.startswith('public domain') or lic == 'cc0':
        return 'pd' if code != 'cc0' and 'cc0' not in lic else 'cc0'
    if lic == 'no restrictions':      # Flickr Commons, Internet Archive : « no known copyright restrictions »
        return 'pd'
    if lic.startswith('licence ouverte') or lic.startswith('etalab'):
        return 'lo'
    if lic.startswith('ogl'):
        return 'ogl'
    m = re.match(r'^cc-by(-sa)?-(\d\.\d)', code)
    if m:
        return 'cc-by' + (m.group(1) or '') + ' ' + m.group(2)
    m = re.match(r'^cc by(-sa)? (\d\.\d)', lic)
    if m:
        return 'cc-by' + (m.group(1) or '') + ' ' + m.group(2)
    return None


def original(info):
    os.makedirs(ORIGINAUX, exist_ok=True)
    cle = info['sha1'] or hashlib.sha1(info['titre'].encode('utf-8')).hexdigest()
    chemin = os.path.join(ORIGINAUX, cle + '.bin')
    if os.path.exists(chemin):
        return chemin
    url = info['vignette'] if info['w'] > LARGEUR_SOURCE and info.get('vignette') else info['url']
    if (info.get('mime') or '') in ('image/svg+xml', 'image/tiff', 'application/pdf') and info.get('vignette'):
        url = info['vignette']
    with open(chemin, 'wb') as f:
        f.write(obtenir(url))
    return chemin


def convertir(chemin, sortie):
    with Image.open(chemin) as im:
        im.load()
        im = ImageOps.exif_transpose(im)
        if im.mode in ('P', 'LA', 'RGBA') or 'transparency' in im.info:
            fond = Image.new('RGB', im.size, (245, 240, 230))
            im = im.convert('RGBA')
            fond.paste(im, mask=im.split()[3])
            im = fond
        else:
            im = im.convert('RGB')
        # un portrait très allongé est recadré par le haut (le visage est en haut)
        if im.height > im.width * HAUTEUR_MAX / LARGEUR:
            im = im.crop((0, 0, im.width, round(im.width * HAUTEUR_MAX / LARGEUR)))
        if im.width > LARGEUR:
            im = im.resize((LARGEUR, round(im.height * LARGEUR / im.width)), Image.LANCZOS)
        im.save(sortie, 'WEBP', quality=QUALITE, method=6)
        return im.width, im.height


def lire_choix():
    choix = {}
    if os.path.exists(CHOIX):
        for ligne in io.open(CHOIX, encoding='utf-8'):
            m = re.match(r'^(Q\d+):\s*(.+?)\s*$', ligne)
            if m:
                choix[m.group(1)] = m.group(2)
    return choix


def main():
    verifier = '--verifier' in sys.argv
    d = json.load(io.open(ENTREE, encoding='utf-8'))
    personnes = d['personnes']
    choix = lire_choix()
    precedent = {}
    if os.path.exists(SORTIE):
        precedent = json.load(io.open(SORTIE, encoding='utf-8'))
    os.makedirs(DOSSIER_IMG, exist_ok=True)
    resultat = {}
    refus = []
    n = 0
    total = len(personnes)
    for q, p in personnes.items():
        n += 1
        titre = choix.get(q, p.get('image'))
        if not titre or titre == '-':
            continue
        titre = titre.replace('_', ' ')
        fichier = os.path.join(DOSSIER_IMG, q + '.webp')
        prec = precedent.get(q)
        if prec and prec.get('source') == titre and os.path.exists(fichier):
            resultat[q] = prec
            continue
        if verifier:
            print('manque', q, titre)
            continue
        try:
            info = informations(titre)
        except Exception as e:
            print('erreur', q, titre, e)
            continue
        if not info:
            print('introuvable', q, titre)
            continue
        lic = libre(info)
        if not lic:
            refus.append((q, titre, info['licence'] or info['licence_code']))
            continue
        try:
            chemin = original(info)
            w, h = convertir(chemin, fichier)
        except Exception as e:
            print('conversion impossible', q, titre, e)
            continue
        resultat[q] = {
            'source': titre, 'w': w, 'h': h, 'licence': lic, 'licence_libelle': info['licence'],
            'licence_url': info['licence_url'], 'auteur': info['auteur'], 'page': info['page'], 'date': info['date'],
        }
        print('%d/%d %s %s (%s)' % (n, total, q, titre[:50], lic))
        with io.open(SORTIE, 'w', encoding='utf-8') as f:
            json.dump(resultat, f, ensure_ascii=False, indent=1)
    with io.open(SORTIE, 'w', encoding='utf-8') as f:
        json.dump(resultat, f, ensure_ascii=False, indent=1)
    print(len(resultat), 'portraits ;', len(refus), 'refusés pour licence')
    for r in refus:
        print('  refusé', *r)


if __name__ == '__main__':
    main()
