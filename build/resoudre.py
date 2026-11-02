"""
Résout les « ?Nom » des fichiers build/frises/*.txt en identifiants Wikidata.

    python build/resoudre.py            affiche les candidats de chaque nom (à relire)
    python build/resoudre.py --ecrire   remplace les noms dont le premier candidat est retenu
                                        d'après build/.atelier/resolutions.txt (lignes « nom => Qxxx »)

On ne devine rien tout seul : chaque remplacement passe par resolutions.txt,
relu à la main (l'appariement automatique se trompe souvent : voir Arcanes).
"""
import glob
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wd import chercher

ICI = os.path.dirname(os.path.abspath(__file__))
FRISES = sorted(glob.glob(os.path.join(ICI, 'frises', '*.txt')))
RESOLUTIONS = os.path.join(ICI, '.atelier', 'resolutions.txt')


def lire_resolutions():
    r = {}
    if os.path.exists(RESOLUTIONS):
        for ligne in io.open(RESOLUTIONS, encoding='utf-8'):
            if '=>' in ligne:
                nom, q = ligne.split('=>', 1)
                r[nom.strip()] = q.strip()
    return r


def main():
    ecrire = '--ecrire' in sys.argv
    resolutions = lire_resolutions()
    noms = []
    for f in FRISES:
        for ligne in io.open(f, encoding='utf-8'):
            m = re.match(r'^[=!] \?([^|]+)\|', ligne)
            if m:
                nom = m.group(1).strip()
                if nom not in noms:
                    noms.append(nom)
    if ecrire:
        for f in FRISES:
            texte = io.open(f, encoding='utf-8').read()
            neuf = texte
            for nom, q in resolutions.items():
                neuf = neuf.replace('?' + nom + ' |', q + ' |')
            if neuf != texte:
                io.open(f, 'w', encoding='utf-8', newline='\n').write(neuf)
                print('écrit', os.path.basename(f))
        restants = [n for n in noms if n not in resolutions]
        print('non résolus :', len(restants))
        for n in restants:
            print('  ', n)
        return
    for nom in noms:
        if nom in resolutions:
            continue
        print('##', nom)
        for q, label, desc in chercher(nom, n=5):
            print('   %-12s %-45s %s' % (q, (label or '')[:45], desc[:80]))


if __name__ == '__main__':
    main()
