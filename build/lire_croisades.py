"""Lecture des fiches build/croisades/*.txt (format décrit en tête de 01-premiere.txt)."""
import glob
import io
import os
import re

ICI = os.path.dirname(os.path.abspath(__file__))
FICHIERS = sorted(glob.glob(os.path.join(ICI, 'croisades', '*.txt')))
DATE = re.compile(r'^~?(\d{1,4})(?:-(\d{2}))?(?:-(\d{2}))?$')


def lire():
    fiches = []
    fiche = None
    for fichier in FICHIERS:
        for num, brut in enumerate(io.open(fichier, encoding='utf-8').read().splitlines(), 1):
            lieu = '%s:%d' % (os.path.basename(fichier), num)
            ligne = brut.strip()
            if not ligne or ligne.startswith('#'):
                continue
            if ligne.startswith('@ '):
                fiche = {'id': ligne[2:].strip(), 'resume': [], 'chretiens': [], 'musulmans': [], 'reperes': [], 'bilan': [], 'lieu': lieu}
                fiches.append(fiche)
                continue
            if fiche is None:
                raise ValueError(lieu + ' : ligne avant « @ »')
            if ligne.startswith('= '):
                d, _, fait = ligne[2:].partition('|')
                d, fait = d.strip(), fait.strip()
                if not DATE.match(d) or not fait:
                    raise ValueError(lieu + ' : repère mal formé')
                fiche['reperes'].append({'date': d, 'fait': fait})
                continue
            m = re.match(r'^([a-z-]+):\s*(.*)$', ligne)
            if not m:
                raise ValueError('%s : ligne incomprise « %s »' % (lieu, ligne[:50]))
            cle, val = m.group(1), m.group(2).strip()
            if cle in ('nom', 'sous-titre'):
                fiche[cle] = val
            elif cle == 'dates':
                debut, _, fin = val.partition('|')
                fiche['debut'], fiche['fin'] = debut.strip(), fin.strip()
                for d in (fiche['debut'], fiche['fin']):
                    if not DATE.match(d):
                        raise ValueError(lieu + ' : date invalide ' + d)
            elif cle in ('resume', 'bilan'):
                fiche[cle].append(val)
            elif cle in ('chretien', 'musulman'):
                q, _, role = val.partition('|')
                q, role = q.strip(), role.strip()
                if not re.match(r'^Q\d+$', q):
                    raise ValueError('%s : identifiant non résolu « %s »' % (lieu, q))
                fiche['chretiens' if cle == 'chretien' else 'musulmans'].append({'q': q, 'role': role})
            else:
                raise ValueError('%s : champ inconnu « %s »' % (lieu, cle))
    for f in fiches:
        for cle in ('nom', 'sous-titre', 'debut', 'fin'):
            if not f.get(cle):
                raise ValueError(f['lieu'] + ' : « ' + cle + ' » manquant')
        if not f['resume'] or not f['reperes']:
            raise ValueError(f['lieu'] + ' : résumé ou repères manquants')
    return fiches


def identifiants(fiches):
    ids = []
    for f in fiches:
        for p in f['chretiens'] + f['musulmans']:
            if p['q'] not in ids:
                ids.append(p['q'])
    return ids


if __name__ == '__main__':
    fs = lire()
    for f in fs:
        print('%-10s %-40s %3d repères %3d chefs' % (f['id'], f['nom'][:40], len(f['reperes']), len(f['chretiens']) + len(f['musulmans'])))
    print(len(identifiants(fs)), 'identifiants')
