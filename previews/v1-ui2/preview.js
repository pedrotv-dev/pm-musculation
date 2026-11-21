// Aperçus autonomes : pas d'import d'app, de profils, de stockage ou de service worker.
import { el, add, btn } from '../../js/dom.js';
const root = document.querySelector('#preview');
const asset = p => '../../assets/' + p;
const link = (label, hash, cls = 'secondary') => {
  const a = el('a', cls, label); a.href = hash; return a;
};
const panel = (title, ...children) => add(el('article', 'panel'), el('h3', '', title), ...children);
const list = rows => add(el('ul', 'list'), ...rows.map(([a,b]) => add(el('li', 'ui2-list'), el('span', '', a), el('span', '', b))));
const image = (src, cls, alt = '') => { const i = el('img', cls); i.src = asset(src); i.alt = alt; return i; };
function controls(view) {
  return add(el('div', 'ui2-actions'), link('Tous les aperçus', '#'), btn('Voir ' + (view.empty ? 'l’exemple rempli' : 'l’état sans historique'), 'secondary', () => {
    location.hash = '#' + view.name + (view.empty ? '' : '-vide');
  }));
}
function exercise(view) {
  root.append(controls(view), el('div', 'eyebrow', 'Séances · Fiche exercice'), el('h1', 'ui2-heading', 'Chest Press'));
  const intro = panel('Repères de l’exercice', add(el('div', 'ui2-head'), image('machines/chest-press.png', 'ui2-photo', 'Machine Chest Press du catalogue'),
    add(el('div'), el('span', 'tag', 'Musculation'), el('p', 'small-muted', 'Pectoraux · Chest Press'))),
    el('p', 'pm-muted', 'Fiche de consultation avant l’entraînement. Aucun réglage ni résultat n’est enregistré ici.'));
  root.append(intro, panel('Dans la séance prévue', el('p', 'pm-muted', 'Exemple · Haut du corps · mardi 3 novembre'),
    list([['3 séries', '40 kg × 10 reps'], ['Repos prévu', '90 s']])));
  root.append(panel('Dernière réalisation', view.empty
    ? add(el('div', 'empty'), el('h3', '', 'Pas encore d’historique'), el('p', '', 'Les séries réalisées apparaîtront ici après une première séance enregistrée.'))
    : add(el('div'), el('p', 'pm-muted', 'Exemple · 27 octobre 2026'), list([['Série 1', '37,5 kg × 10'], ['Série 2', '37,5 kg × 10'], ['Série 3', '37,5 kg × 9']]))));
  root.append(el('p', 'small-muted', 'Les valeurs prévues et réalisées restent distinctes. Cette fiche ne démarre pas de séance.'), link('Retour aux aperçus', '#', 'secondary ui2-full'));
}
function success(view) {
  root.append(controls(view), el('div', 'eyebrow', 'Progression · Détail du succès'), el('h1', 'ui2-heading', 'Habitué'));
  const ico = el('span', 'pm-medal-ico'); ico.dataset.badge = 'five-sessions';
  const medal = add(el('span', 'pm-medal pm-medal-lg pm-medal-locked'), image('ascent/hexagone-niveau.svg', 'pm-medal-frame'), ico);
  medal.setAttribute('aria-hidden', 'true');
  const count = view.empty ? 0 : 3;
  const progress = add(el('div', 'pm-xp-track'), el('div', 'pm-xp-fill ' + (view.empty ? 'ui2-fill-empty' : 'ui2-fill')));
  progress.setAttribute('role','progressbar'); progress.setAttribute('aria-valuemin','0'); progress.setAttribute('aria-valuemax','5'); progress.setAttribute('aria-valuenow',String(count));
  progress.setAttribute('aria-label', count + ' séances sur 5 pour le succès Habitué');
  root.append(panel('5 séances terminées', add(el('div', 'ui2-head'), medal, add(el('div'), el('span', 'tag', 'À débloquer'), el('p', 'small-muted', count + ' / 5 séances'))), progress,
    el('p', 'pm-muted', 'Les séances complètes et partielles comptent, comme dans la progression actuelle. Aucun délai imposé.')));
  root.append(panel('Séances qui contribuent', view.empty
    ? add(el('div', 'empty'), el('h3', '', 'Ton premier pas reste à venir'), el('p', '', 'Une séance enregistrée commencera à remplir ce succès.'))
    : list([['20 octobre · Haut du corps', 'Complète'], ['23 octobre · Jambes', 'Partielle'], ['27 octobre · Haut du corps', 'Complète']])));
  root.append(panel('Comment ce succès évolue', el('p', 'pm-muted', 'Il se calcule depuis les séances enregistrées. Une correction ou une suppression met le compteur à jour. Il n’ajoute pas d’XP à lui seul.')));
  root.append(add(el('aside', 'panel ui2-guide'), image('mascot/stage-0.png', '', 'Korv'), el('p', 'pm-mascot-line-text', 'À ton rythme : aucune date limite pour ce palier.')),
    link('Retour aux aperçus', '#', 'secondary ui2-full'));
}
function render() {
  root.replaceChildren();
  const name = location.hash.slice(1);
  if (!name) {
    root.append(el('div', 'eyebrow', 'MASTER · V1-UI2'), el('h1', '', 'Deux vues complémentaires'), el('p', 'description', 'Propositions visuelles à valider. Elles ne sont pas intégrées à l’application.'),
      panel('Fiche exercice', el('p', '', 'Prévu et dernière réalisation, hors du parcours de séance.'), link('Ouvrir la fiche', '#exercice', 'primary')),
      panel('Détail d’un succès', el('p', '', 'Condition et séances contributrices du palier Habitué.'), link('Ouvrir le succès', '#succes', 'primary')));
  } else {
    const view = { name: name.startsWith('succes') ? 'succes' : 'exercice', empty: name.endsWith('-vide') };
    (view.name === 'succes' ? success : exercise)(view);
  }
  document.querySelectorAll('.nav-btn').forEach(b => { const active = b.dataset.go === (name.startsWith('succes') ? 'progres' : name ? 'seances' : 'accueil'); b.classList.toggle('active',active); if(active) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  const h = root.querySelector('h1'); h.tabIndex = -1; h.focus({ preventScroll:true }); window.scrollTo(0,0);
}
window.addEventListener('hashchange', render);
render();
