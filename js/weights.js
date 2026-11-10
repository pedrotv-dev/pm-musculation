/**
 * PM Musculation — poids corporel. Vrais profils : storage.js (saveWeight / listWeights / deleteWeight).
 * Profil demo : memoire uniquement (jeu de js/demo-fixtures.js), jamais IndexedDB.
 * Mesure : { id, kg, date: 'AAAA-MM-JJ' }.
 */
import { saveWeight, listWeights as storageList, deleteWeight } from '../storage.js';
import { isRealProfile } from './profiles.js';

let demo = null;

async function demoStore() {
  if (!demo) {
    const { buildDemoFixtures } = await import('./demo-fixtures.js');
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const monday = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - ((prev.getDay() + 6) % 7));
    const iso = monday.getFullYear() + '-' + String(monday.getMonth() + 1).padStart(2, '0') + '-' + String(monday.getDate()).padStart(2, '0');
    demo = JSON.parse(JSON.stringify(buildDemoFixtures({ lastWeekStart: iso, closeInterrupted: true }).weights));
  }
  return demo;
}
export function resetDemoWeights() { demo = null; }

function check(kg, date) {
  if (typeof kg !== 'number' || !Number.isFinite(kg) || kg < 20 || kg > 400) throw new Error('Poids invalide : entre 20 et 400 kg.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date invalide.');
}
const newId = date => 'w-' + date + '-' + Date.now().toString(36) + Math.random().toString(16).slice(2, 6);

/** Mesures du profil, la plus recente d'abord. */
export async function listBodyWeights(profileId) {
  if (profileId === 'demo') return (await demoStore()).slice().sort((a, b) => b.date.localeCompare(a.date));
  if (!isRealProfile(profileId)) return [];
  const rows = await storageList(profileId);
  return rows.map(r => ({ id: r.id, ...r.data })).map(m => ({ id: m.id, kg: m.kg, date: m.date || '' }));
}
export async function addBodyWeight(profileId, kg, date) {
  check(kg, date);
  const m = { id: newId(date), kg: Math.round(kg * 10) / 10, date };
  // mesure identique déjà enregistrée (même date, même poids) : aucun doublon
  const same = (await listBodyWeights(profileId)).find(x => x.date === date && x.kg === m.kg);
  if (same) return same;
  if (profileId === 'demo') { (await demoStore()).push(m); return m; }
  if (!isRealProfile(profileId)) throw new Error('Profil inconnu.');
  await saveWeight(profileId, m);
  return m;
}
/**
 * Poids actuel (profil sportif, V2) : une mesure datée par jour. S'il existe déjà une mesure à cette date, elle est
 * corrigée (même identifiant) au lieu d'en créer une seconde ; sinon une mesure est ajoutée. Valeur identique à la
 * dernière mesure du jour : rien n'est écrit. Les mesures des autres jours ne sont jamais touchées.
 * @returns {Promise<{measure:object, change:'added'|'updated'|'unchanged'}>}
 */
export async function recordBodyWeight(profileId, kg, date) {
  check(kg, date);
  const value = Math.round(kg * 10) / 10;
  const today = (await listBodyWeights(profileId)).filter(x => x.date === date).sort((a, b) => b.id.localeCompare(a.id)); // la plus récente d'abord
  if (today.some(x => x.kg === value)) return { measure: today.find(x => x.kg === value), change: 'unchanged' };
  if (!today.length) return { measure: await addBodyWeight(profileId, value, date), change: 'added' };
  const m = { id: today[0].id, kg: value, date };
  if (profileId === 'demo') { const d = await demoStore(); const i = d.findIndex(x => x.id === m.id); if (i >= 0) d[i] = m; return { measure: m, change: 'updated' }; }
  if (!isRealProfile(profileId)) throw new Error('Profil inconnu.');
  await saveWeight(profileId, m);
  return { measure: m, change: 'updated' };
}
export async function removeBodyWeight(profileId, id) {
  if (profileId === 'demo') { const d = await demoStore(); const i = d.findIndex(x => x.id === id); if (i >= 0) d.splice(i, 1); return; }
  if (!isRealProfile(profileId)) throw new Error('Profil inconnu.');
  await deleteWeight(profileId, id);
}
