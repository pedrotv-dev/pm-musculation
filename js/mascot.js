/**
 * PM Musculation — la mascotte : un EMPLACEMENT prêt à recevoir ses dessins, avec un petit personnage de repli intégré.
 *
 * Contrat pour les images (à déposer dans assets/mascot/, puis lister dans assets/mascot/index.json → { "available": [...] }) :
 *   stage-<N>.svg | stage-<N>.png                 N = 0…11 : une évolution par palier de titre (voir TITLES dans js/gamification.js)
 *   stage-<N>-<humeur>.svg | .png                 facultatif ; humeurs : idle, happy, cheer, sleepy, levelup
 * Sans image, le personnage intégré (une boule souriante) s'affiche : l'application est toujours complète.
 * L'animation vient du CSS (`.pm-mascot[data-mood=…]` dans css/jeu.css) et respecte prefers-reduced-motion.
 */
export const MOODS = Object.freeze(['idle', 'happy', 'cheer', 'sleepy', 'levelup']);
let loading = null;
function loadAvailable() {
  if (!loading) {
    loading = fetch(new URL('../assets/mascot/index.json', import.meta.url).href)
      .then(r => (r.ok ? r.json() : { available: [] }))
      .then(j => new Set(Array.isArray(j.available) ? j.available : []))
      .catch(() => new Set());
  }
  return loading;
}
const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.append(...kids);
  return n;
}
/** Personnage de repli : boule turquoise, yeux et bouche selon l'humeur. */
function fallback(mood) {
  const root = svg('svg', { viewBox: '0 0 100 100', role: 'img', 'aria-hidden': 'true', class: 'pm-mascot-art' });
  root.append(svg('ellipse', { cx: 50, cy: 92, rx: 26, ry: 4, class: 'pm-mascot-shadow' }), svg('circle', { cx: 50, cy: 52, r: 36, class: 'pm-mascot-body' }));
  if (mood === 'sleepy') root.append(svg('path', { d: 'M33 50 q5 4 10 0 M57 50 q5 4 10 0', class: 'pm-mascot-line' }));
  else root.append(svg('circle', { cx: 38, cy: 48, r: 5, class: 'pm-mascot-eye' }), svg('circle', { cx: 62, cy: 48, r: 5, class: 'pm-mascot-eye' }));
  const mouth = { idle: 'M40 64 q10 8 20 0', happy: 'M36 62 q14 16 28 0', cheer: 'M38 62 q12 20 24 0 z', sleepy: 'M44 68 h12', levelup: 'M36 60 q14 20 28 0 z' }[mood] || 'M40 64 q10 8 20 0';
  root.append(svg('path', { d: mouth, class: mood === 'cheer' || mood === 'levelup' ? 'pm-mascot-mouth-open' : 'pm-mascot-line' }));
  if (mood === 'cheer' || mood === 'levelup') root.append(svg('path', { d: 'M16 56 L6 38 M84 56 L94 38', class: 'pm-mascot-line' }));
  if (mood === 'levelup') root.append(svg('path', { d: 'M50 6 l3 7 7 1 -5 5 1 7 -6 -4 -6 4 1 -7 -5 -5 7 -1 z', class: 'pm-mascot-star' }));
  return root;
}
/**
 * Élément mascotte. Retourne tout de suite (personnage de repli), puis remplace par l'image si elle existe.
 * @param {{mood?: string, stage?: number, size?: 'sm'|'md'|'lg'}} [o]
 */
export function renderMascot({ mood = 'idle', stage = 0, size = 'md' } = {}) {
  const m = MOODS.includes(mood) ? mood : 'idle';
  const wrap = document.createElement('div');
  wrap.className = 'pm-mascot pm-mascot-' + size;
  wrap.dataset.mood = m; wrap.dataset.stage = String(stage);
  wrap.append(fallback(m));
  loadAvailable().then(available => {
    const name = ['svg', 'png'].flatMap(ext => [`stage-${stage}-${m}.${ext}`, `stage-${stage}.${ext}`]).find(f => available.has(f));
    if (!name) return;
    const img = document.createElement('img');
    img.alt = ''; img.decoding = 'async'; img.className = 'pm-mascot-art';
    img.addEventListener('load', () => wrap.replaceChildren(img), { once: true });
    img.src = new URL('../assets/mascot/' + name, import.meta.url).href; // si le fichier manque : on garde le repli
  });
  return wrap;
}

const LINES = Object.freeze({
  new: ['Bienvenue. La première séance pose la base.', 'On commence quand tu veux.', 'Un premier pas, puis le suivant.'],
  idle: ['Prêt quand tu l’es.', 'Une séance de plus, une base plus solide.', 'La régularité fait le travail.', 'Échauffement d’abord, le reste suit.'],
  streak: ['Semaines enchaînées : la régularité paie.', 'Belle constance.', 'Tu tiens le rythme.'],
  rest: ['Une semaine off ne compte pas : on repart tranquillement.', 'Reprendre, c’est déjà progresser.'],
  done: ['Séance validée.', 'Bon travail. Pense à t’hydrater et à t’étirer.', 'Chaque série compte.'],
  partial: ['Séance partielle enregistrée : tout ce que tu as fait compte.', 'Mieux vaut une séance partielle que pas de séance.'],
  levelup: ['Niveau supérieur.', 'Nouveau palier atteint.'],
  record: ['Nouveau record.', 'Record battu : la progression est là.']
});
/** Une réplique de la mascotte pour un contexte (new, idle, streak, rest, done, partial, levelup, record) ; stable pour un `seed` donné. */
export function mascotLine(context, seed = '') {
  const list = LINES[context] || LINES.idle;
  let h = 7; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}
