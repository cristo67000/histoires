'use strict';
/* Réglages, installation, à propos. */
(function (racine) {

  const { h, icone } = Outils;

  function segments(valeurs, actuel, surChoix) {
    const bloc = h('div', { class: 'segments' });
    for (const [v, libelle] of valeurs) {
      bloc.appendChild(h('button', { type: 'button', class: v === actuel ? 'actif' : '', onclick: () => {
        surChoix(v);
        bloc.querySelectorAll('button').forEach((b, i) => b.classList.toggle('actif', valeurs[i][0] === v));
      } }, libelle));
    }
    return bloc;
  }

  function dessiner(zone) {
    const page = h('div', { class: 'page' });

    // Apparence
    const carte = h('div', { class: 'carte' });
    carte.appendChild(h('p', { class: 'carte-titre' }, 'Apparence'));
    carte.appendChild(h('div', { class: 'option' }, h('div', null, h('div', { class: 'libelle' }, 'Thème'), h('div', { class: 'explication' }, 'Clair, sombre, ou comme le système.')),
      segments([['auto', 'Auto'], ['clair', 'Clair'], ['sombre', 'Sombre']], Reglages.lire('theme', 'auto'), (v) => { Reglages.ecrire('theme', v); Reglages.appliquerTheme(); })));
    page.appendChild(carte);

    // Images hors ligne
    const img = h('div', { class: 'carte' });
    img.appendChild(h('p', { class: 'carte-titre' }, 'Portraits hors ligne'));
    const etat = h('div', { class: 'explication' });
    const jauge = h('div', { class: 'jauge' }, h('div'));
    const bouton = h('button', { type: 'button', class: 'bouton-discret', onclick: () => Images.completer(true) }, icone('telecharger'), 'Tout télécharger');
    function montrer(e) {
      if (!e.possible) { etat.textContent = 'Ce navigateur ne garde pas d’images hors ligne.'; bouton.hidden = true; return; }
      etat.textContent = e.enCours ? 'Téléchargement : ' + e.fait + ' sur ' + e.total + '…' : (e.restantes ? e.fait + ' portraits sur ' + e.total + ' sont gardés hors ligne.' : 'Les ' + e.total + ' portraits sont gardés hors ligne.');
      jauge.firstChild.style.width = (e.total ? Math.round(100 * e.fait / e.total) : 0) + '%';
      bouton.hidden = e.enCours || !e.restantes;
    }
    Images.surChangement(montrer);
    montrer(Images.etat());
    img.appendChild(h('div', { class: 'option' }, h('div', { style: { flex: 1 } }, h('div', { class: 'libelle' }, 'Les portraits se rangent en arrière-plan'), etat, jauge)));
    img.appendChild(h('div', { class: 'option' }, h('div', null, h('div', { class: 'libelle' }, 'En arrière-plan'), h('div', { class: 'explication' }, 'Sans Wi-Fi, les portraits pèsent une douzaine de mégaoctets.')),
      segments([['auto', 'Oui'], ['non', 'Non']], Reglages.lire('imagesHorsLigne', 'auto'), (v) => { Reglages.ecrire('imagesHorsLigne', v); if (v === 'auto') Images.completer(); else Images.arreter(); })));
    img.appendChild(h('div', { style: { marginTop: '8px' } }, bouton));
    page.appendChild(img);

    // Installation
    const inst = h('div', { class: 'carte' });
    inst.appendChild(h('p', { class: 'carte-titre' }, 'Installer Histoires'));
    const zoneInst = h('div');
    Installer.dessinerInstallation(inst, zoneInst);
    inst.appendChild(zoneInst);
    page.appendChild(inst);

    // Partage
    const part = h('div', { class: 'carte' });
    part.appendChild(h('p', { class: 'carte-titre' }, 'Partager'));
    const zonePart = h('div');
    Installer.dessinerPartage(zonePart);
    part.appendChild(zonePart);
    page.appendChild(part);

    // Version
    const ver = h('div', { class: 'carte' });
    ver.appendChild(h('p', { class: 'carte-titre' }, 'Version'));
    const texteVer = h('div', { class: 'explication' }, 'Version ' + (MiseAJour.version || document.querySelector('meta[name="application-version"]').content) + '.');
    const bVer = h('button', { type: 'button', class: 'bouton-discret', onclick: async () => {
      bVer.disabled = true;
      const r = await MiseAJour.verifier(true);
      const messages = { prete: 'Une mise à jour est prête : touchez « Mettre à jour ».', 'en-cours': 'Une nouvelle version arrive…', 'a-jour': 'Vous avez la dernière version.', echec: 'Impossible de vérifier (pas de réseau ?).', 'sans-service-worker': 'Pas de service worker ici.' };
      Communs.toast(messages[r] || r);
      bVer.disabled = false;
    } }, 'Vérifier les mises à jour');
    ver.appendChild(h('div', { class: 'option' }, h('div', null, h('div', { class: 'libelle' }, 'Histoires'), texteVer), bVer));
    page.appendChild(ver);

    // À propos
    const apropos = h('div', { class: 'carte' });
    apropos.appendChild(h('p', { class: 'carte-titre' }, 'À propos'));
    apropos.appendChild(h('p', null, 'Histoires met côte à côte, sur des frises lisibles au téléphone, les souverains de France, d’Angleterre et d’Allemagne, les papes, et les grands maîtres des ordres du Temple, de l’Hôpital, Teutonique et du Grand Orient de France. Chaque personnage a sa fiche ; une date donne tous ceux qui étaient en place.'));
    apropos.appendChild(h('p', null, h('strong', null, 'Sources.'), ' Les listes ont été établies à la main d’après les listes de référence, puis chaque personnage a été rattaché à Wikidata, d’où viennent les dates, lieux, filiations et mariages (licence CC0). Les résumés sont les introductions des articles de Wikipédia en français (licence CC BY-SA 4.0), reproduites avec un lien vers l’article. Les portraits viennent de Wikimedia Commons : seules les images du domaine public ou sous licence libre avec attribution ont été retenues, et chaque fiche cite l’auteur et la licence.'));
    apropos.appendChild(h('p', null, h('strong', null, 'Limites.'), ' Les dates anciennes sont souvent approximatives ou traditionnelles (premiers papes, Mérovingiens). Les filiations de Wikidata peuvent être incomplètes. Une erreur ? Écrivez à ', h('a', { class: 'renvoi', href: 'mailto:cristo67apps@gmail.com' }, 'cristo67apps@gmail.com'), '.'));
    apropos.appendChild(h('p', null, h('strong', null, 'Vie privée.'), ' L’application fonctionne hors ligne, sans compte, sans publicité ni mesure d’audience ; elle ne contacte aucun serveur en dehors de ses propres fichiers. ', h('a', { class: 'renvoi', href: 'confidentialite.html' }, 'Politique de confidentialité'), '.'));
    page.appendChild(apropos);

    zone.appendChild(page);
    return { titre: 'Réglages', sous: 'apparence, hors ligne, à propos' };
  }

  racine.VueReglages = { dessiner };

})(window);
