"""Lecture des fichiers build/frises/*.txt (format décrit en tête de 01-france.txt)."""
import glob
import io
import os
import re

ICI = os.path.dirname(os.path.abspath(__file__))
FICHIERS = sorted(glob.glob(os.path.join(ICI, 'frises', '*.txt')))

DATE = re.compile(r'^~?(\d{1,4})(?:-(\d{2}))?(?:-(\d{2}))?$')


def verifier_date(texte, lieu):
    if not texte:
        return
    if not DATE.match(texte):
        raise ValueError('%s : date invalide « %s »' % (lieu, texte))


def champs(ligne, n):
    parts = [p.strip() for p in ligne.split('|')]
    while len(parts) < n:
        parts.append('')
    return parts[:n]


def lire():
    frises = []
    frise = None
    periode = None
    voie = None
    titre = ''
    for fichier in FICHIERS:
        for num, brut in enumerate(io.open(fichier, encoding='utf-8').read().splitlines(), 1):
            lieu = '%s:%d' % (os.path.basename(fichier), num)
            ligne = brut.strip()
            if not ligne or ligne.startswith('#'):
                continue
            if ligne.startswith('@ '):
                frise = {'id': ligne[2:].strip(), 'voies': [], 'periodes': [], 'mandats': []}
                frises.append(frise)
                periode = None
                voie = None
                titre = ''
                continue
            if frise is None:
                raise ValueError(lieu + ' : ligne avant la première frise')
            if ligne.startswith('% '):
                pid, nom, debut, fin, couleur, note = champs(ligne[2:], 6)
                verifier_date(debut, lieu)
                verifier_date(fin, lieu)
                periode = {'id': pid, 'nom': nom, 'debut': debut, 'fin': fin, 'couleur': couleur, 'note': note}
                frise['periodes'].append(periode)
                voie = frise['voies'][0]['id'] if frise['voies'] else None
                titre = ''
                continue
            if ligne[0] in '=!>' and ligne[1:2] == ' ':
                inst = ligne[0] != '='
                ev = None
                if ligne[0] == '>':
                    ev, debut, fin, nom, note = champs(ligne[2:], 5)
                    q, t = '-', ''
                    if not re.match(r'^[a-z][a-z0-9-]*$', ev):
                        raise ValueError('%s : identifiant d’événement invalide « %s »' % (lieu, ev))
                elif inst:
                    q, debut, fin, nom, note = champs(ligne[2:], 5)
                    t = ''
                else:
                    q, debut, fin, nom, t, note = champs(ligne[2:], 6)
                if not re.match(r'^(Q\d+|-)$', q):
                    raise ValueError('%s : identifiant non résolu « %s »' % (lieu, q))
                verifier_date(debut, lieu)
                verifier_date(fin, lieu)
                if not debut:
                    raise ValueError(lieu + ' : date de début manquante')
                if periode is None:
                    raise ValueError(lieu + ' : personne hors de toute période')
                frise['mandats'].append({
                    'q': q, 'debut': debut, 'fin': fin, 'nom': nom, 'titre': t or titre,
                    'note': note, 'voie': voie, 'periode': periode['id'], 'inst': inst, 'lieu': lieu, 'ev': ev,
                })
                continue
            m = re.match(r'^([a-z-]+):\s*(.*)$', ligne)
            if not m:
                raise ValueError('%s : ligne incomprise « %s »' % (lieu, ligne[:50]))
            cle, val = m.group(1), m.group(2).strip()
            if cle == 'voie':
                if '|' in val:
                    vid, vnom = champs(val, 2)
                    frise['voies'].append({'id': vid, 'nom': vnom})
                    # déclarée dans une période, la voie devient la voie courante
                    if voie is None or periode is not None:
                        voie = vid
                else:
                    if val not in [v['id'] for v in frise['voies']]:
                        raise ValueError('%s : voie inconnue « %s »' % (lieu, val))
                    voie = val
            elif cle == 'titre' and periode is not None:
                titre = val
            elif cle in ('nom', 'titre', 'groupe', 'couleur'):
                frise[cle] = val
            else:
                raise ValueError('%s : champ inconnu « %s »' % (lieu, cle))
    for f in frises:
        for m in f['mandats']:
            if m['voie'] is None:
                raise ValueError(m['lieu'] + ' : aucune voie')
    return frises


def identifiants(frises):
    ids = []
    for f in frises:
        for m in f['mandats']:
            if m['q'] != '-' and m['q'] not in ids:
                ids.append(m['q'])
    return ids


if __name__ == '__main__':
    fr = lire()
    for f in fr:
        print('%-14s %3d périodes %4d mandats  voies %s' % (f['id'], len(f['periodes']), len(f['mandats']), [v['id'] for v in f['voies']]))
    print(len(identifiants(fr)), 'identifiants distincts')
