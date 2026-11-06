/**
 * PM Musculation — poids corporel. Vrais profils : storage.js (saveWeight / listWeights / deleteWeight).
 * Profil demo : memoire uniquement (jeu de js/demo-fixtures.js), jamais IndexedDB.
 * Mesure : { id, kg, date: 'AAAA-MM-JJ' }.
 */
import { saveWeight, listWeights as storageList, deleteWeight } from '../storage.js';

const PROFILES = ['pierre', 'manon'];
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
  if (PROFILES.indexOf(profileId) === -1) return [];
  const rows = await storageList(profileId);
  return rows.map(r => ({ id: r.id, ...r.data })).map(m => ({ id: m.id, kg: m.kg, date: m.date || '' }));
}
export async function addBodyWeight(profileId, kg, date) {
  check(kg, date);
  const m = { id: newId(date), kg: Math.round(kg * 10) / 10, date };
  if (profileId === 'demo') { (await demoStore()).push(m); return m; }
  if (PROFILES.indexOf(profileId) === -1) throw new Error('Profil inconnu.');
  await saveWeight(profileId, m);
  return m;
}
export async function removeBodyWeight(profileId, id) {
  if (profileId === 'demo') { const d = await demoStore(); const i = d.findIndex(x => x.id === id); if (i >= 0) d.splice(i, 1); return; }
  if (PROFILES.indexOf(profileId) === -1) throw new Error('Profil inconnu.');
  await deleteWeight(profileId, id);
}
