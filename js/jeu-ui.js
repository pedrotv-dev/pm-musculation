/**
 * PM Musculation — éléments d'interface du « jeu » : niveau, succès, classements personnels, récompense de séance.
 * Pur affichage : toute la logique est dans js/gamification.js (calculée depuis l'historique, sans stockage).
 * Aucun classement entre profils : chaque personne ne se mesure qu'à elle-même.
 */
import { el, add, fmtNum } from './dom.js';
import { renderMascot, mascotLine } from './mascot.js';
import { XP } from './gamification.js';

const longStart = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); };
const shortDate = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);
const plural = (n, one, many) => n + ' ' + (n > 1 ? many : one);

function xpBar(level, { before } = {}) {
  const track = el('div', 'pm-xp-track');
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', 'Progression vers le niveau ' + (level.level + 1));
  track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', String(level.need)); track.setAttribute('aria-valuenow', String(level.into));
  const fill = el('div', 'pm-xp-fill');
  fill.style.width = Math.round(level.progress * 100) + '%';
  if (before !== undefined) fill.dataset.from = String(Math.round(before * 100));
  track.append(fill);
  return track;
}

/** Carte « Mon niveau » : mascotte, niveau, titre, barre d'XP, série de semaines. */
export function levelCard(p, { seed = '', context } = {}) {
  const card = el('article', 'panel pm-level-card');
  const streak = p.streak.current;
  const ctx = context || (p.totals.sessions === 0 ? 'new' : streak >= 2 ? 'streak' : !p.streak.thisWeekDone && streak === 0 ? 'rest' : 'idle');
  const mood = p.totals.sessions === 0 ? 'idle' : streak >= 2 ? 'happy' : streak === 0 ? 'sleepy' : 'idle';
  const head = el('div', 'pm-level-head');
  const text = el('div', 'pm-level-text');
  add(text, el('span', 'tag', 'Niveau ' + p.level), el('h3', '', p.title),
    el('p', 'pm-muted', fmtNum(p.into) + ' / ' + fmtNum(p.need) + ' XP avant le niveau ' + (p.level + 1)));
  add(head, renderMascot({ mood, stage: p.stage, size: 'md' }), text);
  card.append(head, xpBar(p));
  const line = el('p', 'pm-mascot-line-text', '« ' + mascotLine(ctx, seed + p.level) + ' »');
  card.append(line);
  if (p.notStarted) card.append(el('p', 'pm-muted pm-streak', 'Ta progression démarre le ' + longStart(p.startDate) + ' : tes séances d’avant restent dans ton historique et tes records.'));
  if (streak > 0) card.append(el('p', 'pm-muted pm-streak', 'Série : ' + plural(streak, 'semaine', 'semaines') + ' de suite' +
    (p.streak.thisWeekDone ? ' — cette semaine est déjà validée.' : ' — fais une séance cette semaine pour la garder.')));
  return card;
}

/** Grille des succès (débloqués en couleur, les autres grisés avec leur condition). */
export function badgesPanel(p) {
  const box = el('article', 'panel pm-badges-panel');
  add(box, el('h3', '', 'Succès · ' + p.unlockedCount + ' / ' + p.badges.length));
  const grid = el('ul', 'pm-badges');
  for (const b of p.badges) {
    const li = el('li', 'pm-badge-tile' + (b.unlocked ? ' pm-unlocked' : ''));
    add(li, el('span', 'pm-badge-name', b.unlocked ? b.name : '???'), el('span', 'pm-badge-desc', b.unlocked ? b.desc + ' · ' + shortDate(b.date) : 'À débloquer : ' + b.desc));
    grid.append(li);
  }
  box.append(grid);
  return box;
}

/** Classements PERSONNELS (toi contre toi). `name(id)` : nom d'une machine. */
export function rankingsPanel(p, name) {
  const box = el('article', 'panel pm-rankings');
  add(box, el('h3', '', 'Mes classements'), el('p', 'pm-muted', 'Toi contre toi : aucun classement entre profils.'));
  const block = (title, rows, empty) => {
    box.append(el('h4', 'pm-rank-title', title));
    if (!rows.length) { box.append(el('p', 'pm-muted', empty)); return; }
    const list = el('ol', 'pm-rank-list');
    rows.forEach(r => list.append(add(el('li'), el('span', '', r[0]), el('span', 'pm-rank-value', r[1]))));
    box.append(list);
  };
  const r = p.rankings;
  block('Mes meilleures semaines', r.bestWeeks.map(w => ['Semaine du ' + shortDate(w.weekStart), fmtNum(w.volumeKg) + ' kg · ' + plural(w.sessions, 'séance', 'séances')]), 'Pas encore de semaine à classer.');
  block('Mes séances les plus lourdes', r.heaviestSessions.map(s => [shortDate(s.date) + ' · ' + s.dayName, fmtNum(s.volumeKg) + ' kg']), 'Pas encore de séance à classer.');
  block('Mes machines qui progressent le plus', r.risingMachines.map(m => [name(m.machineId), '+' + m.gainPercent + ' % (' + fmtNum(m.firstKg) + ' → ' + fmtNum(m.bestKg) + ' kg)']), 'Il faut au moins deux séances sur une machine.');
  return box;
}

/** Comment gagner de l'XP (repliable). */
export function howPanel() {
  const box = el('details', 'panel pm-how');
  box.append(el('summary', '', 'Comment gagner de l’XP ?'));
  const list = el('ul', 'list');
  [['Série validée', '+' + XP.perSet], ['Minute de cardio ou d’échauffement', '+' + XP.perCardioMinute + ' (60 min max par activité)'],
   ['Séance complète', '+' + XP.completed], ['Séance partielle', '+' + XP.partial], ['Record de charge battu', '+' + XP.record + ' (une fois par machine et par séance)']]
    .forEach(([a, b]) => list.append(add(el('li'), el('span', '', a), el('span', '', b))));
  box.append(list, el('p', 'pm-muted', 'Tout est calculé depuis ton historique : corriger ou supprimer une séance met ton niveau à jour. Une semaine sans séance ne fait jamais perdre de niveau.'));
  return box;
}

/** Récompense affichée à la fin d'une séance (planche ASCENT). `reward` vient de rewardFor(). */
export function rewardCard(reward, name) {
  const card = el('section', 'pm-reward');
  card.setAttribute('aria-label', 'Récompense de la séance');
  const up = reward.leveledUp, after = reward.after;
  card.append(el('p', 'pm-reward-xp', '+' + fmtNum(reward.xp) + ' XP'));
  // niveau actuel → barre → niveau suivant
  const levels = el('div', 'pm-reward-levels');
  const mid = el('div', 'pm-reward-mid');
  add(mid, xpBar(after, { before: reward.before.level === after.level ? reward.before.progress : 0 }), el('p', 'pm-reward-xpcount', fmtNum(after.into) + ' / ' + fmtNum(after.need) + ' XP'));
  add(levels, levelHex(after.level, { size: 'sm', label: 'Niveau actuel : ' + after.level }), mid, levelHex(after.level + 1, { size: 'sm', label: 'Niveau suivant : ' + (after.level + 1) }));
  card.append(levels);
  card.append(el('p', 'pm-muted pm-reward-level' + (up ? ' pm-levelup' : ''), up
    ? 'Niveau ' + reward.levelBefore + ' → niveau ' + reward.levelAfter + ' : ' + after.title + ' !'
    : 'Niveau ' + after.level + ' · ' + after.title));
  // détail des XP
  const parts = [['Séries validées', reward.parts.sets], ['Cardio', reward.parts.cardio], ['Fin de séance', reward.parts.finish], ['Records', reward.parts.records]].filter(x => x[1] > 0);
  const list = el('ul', 'pm-reward-parts');
  parts.forEach(([l, v]) => list.append(add(el('li'), el('span', '', l), el('span', '', '+' + fmtNum(v)))));
  card.append(list);
  // cartes « Nouveau badge ! » et « Nouveau record ! »
  if (reward.newBadges.length || reward.records.length) {
    const cards = el('div', 'pm-reward-cards');
    reward.newBadges.forEach(x => {
      const c = el('article', 'pm-reward-card pm-reward-badge');
      add(c, el('p', 'pm-reward-card-kicker', 'Nouveau badge !'), add(el('div', 'pm-badge-hex'), el('span', '', '★')), el('strong', '', x.name), el('span', 'pm-muted', x.desc));
      cards.append(c);
    });
    reward.records.forEach(r => {
      const c = el('article', 'pm-reward-card pm-reward-record');
      add(c, el('p', 'pm-reward-card-kicker', 'Nouveau record !'), el('strong', 'pm-reward-record-kg', fmtNum(r.kg) + ' kg'),
        el('span', 'pm-muted', name(r.machineId)), el('span', 'pm-reward-gain', '+' + fmtNum(Math.round((r.kg - r.previous) * 100) / 100) + ' kg'));
      cards.append(c);
    });
    card.append(cards);
  }
  // Korv
  const korv = el('div', 'pm-reward-korv');
  const bubble = el('div', 'pm-korv-bubble');
  add(bubble, el('span', 'pm-korv-name', 'Korv'), el('p', 'pm-korv-line', '« ' + mascotLine(up ? 'levelup' : reward.records.length ? 'record' : 'done', String(reward.xp)) + ' »'));
  add(korv, renderMascot({ mood: up ? 'levelup' : reward.records.length ? 'cheer' : 'happy', stage: after.stage, size: 'md' }), bubble);
  card.append(korv);
  return card;
}

/** Contenu du plein écran « Niveau supérieur » (planche ASCENT) ; affiché par dialog() avec le bouton « Parfait ! ». */
export function levelUpContent(reward) {
  const box = el('div', 'pm-levelup');
  const korv = el('div', 'pm-levelup-korv');
  const img = el('img'); img.alt = ''; img.decoding = 'async'; img.width = 640; img.height = 800;
  img.addEventListener('error', () => korv.replaceChildren(renderMascot({ mood: 'levelup', stage: reward.after.stage, size: 'lg' })), { once: true });
  img.src = new URL('../assets/ascent/korv-accueil-motive.webp', import.meta.url).href;
  korv.append(img);
  const hex = el('div', 'pm-levelup-hex');
  hex.append(levelHex(reward.levelAfter, { size: 'lg', label: 'Niveau ' + reward.levelAfter }));
  const lines = el('ul', 'pm-levelup-lines');
  const line = (ico, text) => lines.append(add(el('li'), el('span', 'pm-levelup-ico', ico), el('span', '', text)));
  line('↑', '+' + fmtNum(reward.xp) + ' XP cette séance');
  if (reward.after.stage !== reward.before.stage) line('★', 'Nouveau grade : ' + reward.after.title);
  else line('★', 'Grade : ' + reward.after.title);
  if (reward.newBadges.length) line('✓', reward.newBadges.length + (reward.newBadges.length > 1 ? ' succès débloqués' : ' succès débloqué'));
  line('⚑', 'Prochain palier : niveau ' + (reward.levelAfter + 1) + ' dans ' + fmtNum(reward.after.need - reward.after.into) + ' XP');
  add(box, korv, hex, lines);
  return box;
}

/** Hexagone de niveau (« NIV. 18 »), comme sur la planche ASCENT. */
export function levelHex(level, { size = 'md', label = 'Niveau ' + level } = {}) {
  const hex = el('div', 'pm-hex pm-hex-' + size);
  hex.setAttribute('role', 'img'); hex.setAttribute('aria-label', label);
  const inner = el('div', 'pm-hex-inner');
  add(inner, el('span', 'pm-hex-label', 'NIV.'), el('strong', 'pm-hex-value', String(level)));
  hex.append(inner);
  return hex;
}

/** Accueil : salut, Korv en grand à droite, bulle de Korv, sur le décor montagne. */
export function homeHero(p, { name, seed = '', demo = false } = {}) {
  const hero = el('section', 'pm-hero');
  hero.setAttribute('aria-label', 'Bienvenue');
  const streak = p.streak.current;
  const ctx = p.totals.sessions === 0 ? 'new' : streak >= 2 ? 'streak' : !p.streak.thisWeekDone && streak === 0 ? 'rest' : 'idle';
  const mood = p.totals.sessions === 0 ? 'idle' : streak >= 2 ? 'happy' : 'idle';
  const text = el('div', 'pm-hero-text');
  const h = el('h2', 'pm-hero-title', 'Salut ' + name + ' ');
  const wave = el('span', 'pm-hero-wave', '👋'); wave.setAttribute('aria-hidden', 'true'); h.append(wave);
  add(text, h, el('p', 'pm-hero-sub', demo ? 'Mode démo : tout est fictif et reste en mémoire.' : 'Prêt à continuer l’ascension ?'));
  // Korv grand format (assets/ascent/korv-accueil-*.webp) ; si l'image manque : la mascotte habituelle
  const variant = streak >= 2 ? 'heureux' : streak === 1 && !p.streak.thisWeekDone ? 'motive' : 'neutre';
  const korv = el('div', 'pm-hero-korv');
  korv.dataset.mood = variant;
  const img = el('img');
  img.alt = ''; img.decoding = 'async'; img.width = 640; img.height = 800;
  img.addEventListener('error', () => korv.replaceChildren(renderMascot({ mood, stage: p.stage, size: 'xl' })), { once: true });
  img.src = new URL('../assets/ascent/korv-accueil-' + variant + '.webp', import.meta.url).href;
  korv.append(img);
  const bubble = el('div', 'pm-korv-bubble');
  add(bubble, el('span', 'pm-korv-name', 'Korv'), el('p', 'pm-korv-line', '« ' + mascotLine(ctx, seed + p.level) + ' »'));
  add(hero, text, korv, bubble);
  return hero;
}

/** Accueil : bandeau de niveau (hexagone, niveau, barre d'XP). */
export function levelStrip(p) {
  const card = el('article', 'panel pm-level-card pm-level-strip');
  const body = el('div', 'pm-level-body');
  const top = el('div', 'pm-level-top');
  add(top, el('strong', 'pm-level-name', 'Niveau ' + p.level), el('span', 'pm-level-next', 'Niv. ' + (p.level + 1)));
  add(body, top, xpBar(p), el('p', 'pm-level-xp', fmtNum(p.into) + ' / ' + fmtNum(p.need) + ' XP · ' + p.title));
  add(card, levelHex(p.level), body);
  if (p.notStarted) card.append(el('p', 'pm-muted pm-level-note', 'Ta progression démarre le ' + longStart(p.startDate) + ' : tes séances d’avant restent dans ton historique et tes records.'));
  else if (p.streak.current > 0) card.append(el('p', 'pm-muted pm-level-note', 'Série : ' + plural(p.streak.current, 'semaine', 'semaines') + ' de suite' +
    (p.streak.thisWeekDone ? ' — cette semaine est déjà validée.' : ' — fais une séance cette semaine pour la garder.')));
  return card;
}
