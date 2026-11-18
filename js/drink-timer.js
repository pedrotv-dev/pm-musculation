/**
 * PM Musculation — décompte du distributeur de boisson de la salle (ex. Yanga) : un appui quand on se sert, un petit
 * chrono discret dans la barre de séance, un son quand on peut se resservir. Durée réglable (Réglages → Séance et chrono),
 * 20 min par défaut, 0 = bouton masqué. Réglage de l'appareil (localStorage), comme la langue ; fin mémorisée pour
 * survivre à une fermeture de l'appli. Aucune donnée de séance n'est touchée.
 */
import { el, formatClock, dialog, toast } from './dom.js';
import { playEndChime } from './rest-audio.js';
import { fx } from './fx.js';

const MIN_KEY = 'pm-drink-min', END_KEY = 'pm-drink-end';
export const DRINK_MINUTES = Object.freeze([0, 10, 15, 20, 25, 30, 45, 60]);
const read = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const write = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, String(v)); } catch (_) { /* stockage indisponible */ } };

/** Durée réglée en minutes (20 par défaut ; 0 = désactivé). */
export function getDrinkMinutes() {
  const v = Number(read(MIN_KEY));
  return read(MIN_KEY) !== null && DRINK_MINUTES.includes(v) ? v : 20;
}
export function setDrinkMinutes(min) { if (DRINK_MINUTES.includes(Number(min))) { write(MIN_KEY, Number(min)); refresh(); } }
/** Fin du décompte en cours (ms) ou null. */
export function drinkEndsAt() { const v = Number(read(END_KEY)); return v > 0 ? v : null; }
export function startDrink(now = Date.now()) { write(END_KEY, now + getDrinkMinutes() * 60000); refresh(); }
export function stopDrink() { write(END_KEY, null); refresh(); }

const label = () => {
  const end = drinkEndsAt();
  return end ? '🥤 ' + formatClock(Math.max(0, Math.round((end - Date.now()) / 1000))) : '🥤';
};
function refresh() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.pm-drink').forEach(b => {
    b.hidden = !getDrinkMinutes();
    b.textContent = label();
    b.dataset.running = drinkEndsAt() ? '1' : '';
  });
}

/** Bouton discret de la barre de séance : lance le décompte ; pendant le décompte, propose de le relancer ou l'arrêter. */
export function drinkButton() {
  const b = el('button', 'pm-icon-btn pm-drink'); b.type = 'button';
  b.title = 'Décompte boisson : appuie quand tu te sers au distributeur';
  b.setAttribute('aria-label', 'Décompte boisson');
  b.addEventListener('click', async () => {
    if (!drinkEndsAt()) { startDrink(); toast('Décompte boisson lancé : ' + getDrinkMinutes() + ' min', { duration: 1800 }); return; }
    const pick = await dialog({ title: 'Décompte boisson', message: 'Encore ' + label().slice(3) + ' avant de pouvoir te resservir.',
      choices: [{ label: 'Annuler', value: null }, { label: 'Arrêter', value: 'stop' }, { label: 'Relancer ' + getDrinkMinutes() + ' min', value: 'restart', kind: 'primary' }] });
    if (pick === 'stop') stopDrink();
    if (pick === 'restart') startDrink();
  });
  b.hidden = !getDrinkMinutes(); b.textContent = label(); b.dataset.running = drinkEndsAt() ? '1' : '';
  return b;
}

if (typeof document !== 'undefined') {
  setInterval(() => {
    const end = drinkEndsAt();
    if (end && Date.now() >= end) {
      stopDrink();
      if (!playEndChime()) fx('rest-end');
      try { navigator.vibrate?.([130, 80, 130]); } catch (_) { /* non pris en charge */ }
      toast('🥤 Tu peux te resservir au distributeur', { duration: 5000 });
      return;
    }
    if (end) refresh();
  }, 1000);
}
