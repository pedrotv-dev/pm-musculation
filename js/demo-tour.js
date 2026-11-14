/**
 * PM Musculation — guide du mode Démo : bulles pas à pas qui montrent les zones de l'écran (accueil, puis écran de
 * séance à la première ouverture). Uniquement sur le profil Démo ; « Passer » ferme le guide, « Revoir le guide »
 * (bandeau de l'accueil démo) le relance. Mémorisé pour la durée de l'onglet (sessionStorage), jamais en base.
 */
const ACCUEIL = [
  { sel: '.pm-hero', text: 'Bienvenue dans la démo ! Tout est fictif : teste librement, rien n’est enregistré. Je te fais visiter en quelques bulles.' },
  { sel: '.pm-home-main', text: 'Ta séance du jour (ou celle en cours). Un appui et tu es à la salle : une machine par écran.' },
  { sel: '.pm-level-card', text: 'Chaque séance rapporte de l’XP : niveaux, succès et records perso arrivent tout seuls.' },
  { sel: '.pm-week-card', text: 'Ma semaine : tes repères santé (2 jours de renforcement, 150 min d’activité, OMS 2020).' },
  { sel: '.nav-btn[data-go="programme"]', text: 'Programme : la semaine est calculée pour toi (règles sourcées), ou crée-la toi-même.' },
  { sel: '.nav-btn[data-go="progres"]', text: 'Progression : historique, courbes de charge, records et volume.' },
  { sel: '#open-settings', text: 'Réglages : profil sportif, tes machines, chrono de repos, sons, langue.' },
  { sel: '.pm-home-main .pm-validate', text: 'À toi : ouvre la séance pour essayer l’écran de séance. D’autres bulles t’y attendent.' }
];
const SEANCE = [
  { sel: '.pm-current-set', text: 'La série en cours : ajuste la charge et les répétitions avec − / + (ou tape la valeur).' },
  { sel: '#pm-validate-set', text: 'Valide la série : le chrono de repos démarre tout seul et continue même si tu changes de machine.' },
  { sel: '.pm-quick-actions', text: 'Machine prise ? « Machine occupée » la repousse à la fin. Tu peux aussi ajouter une série.' },
  { sel: '.pm-dots', text: 'Ta progression dans la séance : touche un point pour aller à une machine.' },
  { sel: '.pm-footer', text: '« Machines » pour changer l’ordre, « Pause », puis « Terminer » pour le récap et l’XP.' }
];
const TOURS = { accueil: ACCUEIL, seance: SEANCE };
const seenKey = name => 'pm-demo-tour-' + name;
const seen = name => { try { return sessionStorage.getItem(seenKey(name)) === '1'; } catch (_) { return false; } };
const markSeen = name => { try { sessionStorage.setItem(seenKey(name), '1'); } catch (_) { /* stockage indisponible */ } };
const isDemo = () => document.documentElement.dataset.pmProfile === 'demo';
const visible = e => !!e && e.getClientRects().length > 0 && !e.closest('[hidden]');

let active = null;

/** Lance un guide (`accueil` ou `seance`). `force` : même déjà vu. */
export function startTour(name, { force = false } = {}) {
  if (!isDemo() || active || (!force && seen(name))) return;
  if (navigator.webdriver && !window.__pmTourTest) return; // tests automatisés : guide seulement s'ils le demandent
  const steps = TOURS[name].filter(s => visible(document.querySelector(s.sel)));
  if (!steps.length) return;
  markSeen(name);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.createElement('div'); root.className = 'pm-tour'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Guide de la démo');
  const spot = document.createElement('div'); spot.className = 'pm-tour-spot';
  const bubble = document.createElement('div'); bubble.className = 'pm-tour-bubble';
  const count = document.createElement('p'); count.className = 'pm-tour-count';
  const text = document.createElement('p'); text.className = 'pm-tour-text'; text.setAttribute('aria-live', 'polite');
  const actions = document.createElement('div'); actions.className = 'pm-tour-actions';
  const skip = document.createElement('button'); skip.type = 'button'; skip.className = 'pm-link pm-tour-skip'; skip.textContent = 'Passer';
  const next = document.createElement('button'); next.type = 'button'; next.className = 'pm-validate pm-tour-next';
  actions.append(skip, next); bubble.append(count, text, actions); root.append(spot, bubble);
  document.body.append(root);
  let i = 0;
  const place = () => {
    if (!root.isConnected || !steps[i]) return; // guide fermé entre-temps (repositionnement différé)
    const el = document.querySelector(steps[i].sel);
    if (!visible(el)) return;
    const r = el.getBoundingClientRect(), pad = 6;
    Object.assign(spot.style, { top: (r.top - pad) + 'px', left: (r.left - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
    const bh = bubble.offsetHeight, vh = innerHeight;
    const below = r.bottom + 12 + bh < vh - 8;
    bubble.style.top = Math.max(8, below ? r.bottom + 12 : r.top - 12 - bh) + 'px';
  };
  const show = () => {
    const el = document.querySelector(steps[i].sel);
    count.textContent = 'Guide · ' + (i + 1) + ' / ' + steps.length;
    text.textContent = steps[i].text;
    next.textContent = i === steps.length - 1 ? 'Compris !' : 'Suivant';
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    place(); setTimeout(place, reduce ? 0 : 350); setTimeout(place, reduce ? 0 : 800); // fin du défilement doux
    next.focus({ preventScroll: true });
  };
  const close = () => { removeEventListener('resize', place); removeEventListener('scroll', place, true); document.removeEventListener('keydown', key); root.remove(); active = null; };
  const key = e => { if (e.key === 'Escape') close(); };
  next.addEventListener('click', () => { if (++i >= steps.length) close(); else show(); });
  skip.addEventListener('click', close);
  addEventListener('resize', place); addEventListener('scroll', place, true); document.addEventListener('keydown', key);
  active = { close };
  show();
}
export const closeTour = () => active?.close();

if (typeof document !== 'undefined') {
  // accueil de la démo : au choix du profil Démo (après le premier rendu)
  document.addEventListener('pm:profile-changed', e => {
    if (e.detail?.profile !== 'demo') { closeTour(); return; }
    setTimeout(() => startTour('accueil'), 700);
  });
  // écran de séance de la démo : à la première ouverture
  document.addEventListener('pm:workout-open', e => {
    if (e.detail?.profile !== 'demo') return;
    closeTour();
    setTimeout(() => startTour('seance'), 500);
  });
  // « Revoir le guide » (bandeau démo de l'accueil)
  document.addEventListener('click', e => { if (e.target.closest?.('.pm-tour-replay')) startTour('accueil', { force: true }); });
}
