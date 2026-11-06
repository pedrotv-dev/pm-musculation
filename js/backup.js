/**
 * PM Musculation — sauvegardes JSON par profil, restauration (remplacer / fusionner), export CSV.
 * S'appuie sur exportProfileData / restoreProfileData de storage.js (transactions atomiques).
 * Le profil « demo » n'est jamais sauvegarde ni restaure.
 */
import { exportProfileData, restoreProfileData } from '../storage.js';

export const BACKUP_FORMAT = 'pm-musculation-backup';
const PROFILES = ['pierre', 'manon'];
const stamp = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

function realProfile(profileId) {
  if (PROFILES.indexOf(profileId) === -1) throw new Error('Les sauvegardes ne concernent que Pierre et Manon.');
  return profileId;
}
/** Resume affichable d'une sauvegarde. */
export function describeBackup(backup) {
  const d = backup.data || {};
  return {
    profileId: backup.profileId, exportedAt: backup.exportedAt || null, schemaVersion: backup.schemaVersion,
    programs: (d.programs || []).length, sessions: (d.sessions || []).length, weights: (d.weights || []).length, settings: (d.settings || []).length,
    lastSessionDate: (d.sessions || []).map(r => r.data && r.data.date).filter(Boolean).sort().pop() || null
  };
}
/** Texte JSON -> sauvegarde verifiee (structure, format, profil connu). Leve une erreur lisible sinon. */
export function parseBackupText(text) {
  let backup;
  try { backup = JSON.parse(String(text).replace(/^﻿/, '')); }
  catch (_) { throw new Error('Ce fichier n’est pas un JSON valide.'); }
  if (!backup || typeof backup !== 'object' || backup.format !== BACKUP_FORMAT) throw new Error('Ce fichier n’est pas une sauvegarde PM Musculation.');
  if (PROFILES.indexOf(backup.profileId) === -1) throw new Error('Profil de la sauvegarde inconnu.');
  if (backup.schemaVersion !== 1) throw new Error('Version de sauvegarde non prise en charge (' + backup.schemaVersion + ').');
  const d = backup.data;
  if (!d || typeof d !== 'object') throw new Error('Sauvegarde sans données.');
  for (const k of ['programs', 'sessions', 'weights', 'settings']) {
    if (!Array.isArray(d[k])) throw new Error('Section de sauvegarde invalide : ' + k + '.');
  }
  return backup;
}
/** Sauvegarde complete d'un profil : { filename, text, summary }. */
export async function createBackupFile(profileId) {
  realProfile(profileId);
  const backup = await exportProfileData(profileId);
  return { filename: 'pm-musculation-' + profileId + '-' + stamp() + '.json', text: JSON.stringify(backup, null, 1), summary: describeBackup(backup) };
}
/** Restaure dans le profil ACTIF uniquement ; mode 'replace' ou 'merge'. */
export async function restoreBackup(profileId, backup, mode) {
  realProfile(profileId);
  if (backup.profileId !== profileId) throw new Error('Cette sauvegarde appartient à ' + backup.profileId + ' : elle ne peut pas être restaurée dans le profil ' + profileId + '.');
  await restoreProfileData(profileId, backup, mode);
}
/** Efface TOUTES les donnees du profil (remplacement par une sauvegarde vide). */
export async function clearProfileData(profileId) {
  realProfile(profileId);
  await restoreProfileData(profileId, {
    format: BACKUP_FORMAT, schemaVersion: 1, profileId, exportedAt: new Date().toISOString(),
    data: { programs: [], sessions: [], weights: [], settings: [] }
  }, 'replace');
}
/** Donnees d'un autre profil lues depuis un fichier, en MEMOIRE (bilan commun) : { profileId, sessions, weights, programs }. */
export function backupToPerson(backup) {
  const d = backup.data;
  return {
    profileId: backup.profileId,
    sessions: d.sessions.map(r => r.data).filter(Boolean),
    weights: d.weights.map(r => r.data).filter(Boolean),
    programs: d.programs.map(r => r.data).filter(Boolean)
  };
}
const csv = v => { const s = String(v ?? ''); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
/** Export des resultats : une ligne par serie validee / activite (CSV a point-virgule, ouvrable dans Excel). */
export function resultsCsv(sessions, names = new Map()) {
  const rows = [['date', 'seance', 'statut', 'activite', 'type', 'serie', 'charge_kg', 'repetitions', 'validee', 'duree_min', 'objectif_kg', 'objectif_reps']];
  for (const s of sessions.slice().sort((a, b) => (a.date + a.startedAt).localeCompare(b.date + b.startedAt))) {
    for (const key of s.order) {
      const a = s.activities.find(x => x.key === key); if (!a) continue;
      const label = a.type === 'strength' ? (names.get(a.machineId) || a.machineId) : a.name || a.type;
      if (a.type === 'strength') {
        a.sets.forEach((x, i) => { const p = a.planned?.sets?.[Math.min(i, (a.planned.sets.length || 1) - 1)]; rows.push([s.date, s.dayName || s.dayId, s.status, label, a.type, i + 1, x.kg, x.reps, x.done ? 'oui' : 'non', '', p ? p.kg : '', p ? p.reps : '']); });
      } else rows.push([s.date, s.dayName || s.dayId, s.status, label, a.type, '', '', '', a.status === 'done' ? 'oui' : 'non', a.actual?.durationMinutes ?? '', '', '']);
    }
  }
  return '﻿' + rows.map(r => r.map(csv).join(';')).join('\n') + '\n';
}
/** Telecharge ou partage un fichier texte (feuille de partage sur mobile si disponible). @returns {Promise<'shared'|'downloaded'>} */
export async function saveTextFile(filename, text, mime = 'application/json') {
  const file = typeof File === 'function' ? new File([text], filename, { type: mime }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
    try { await navigator.share({ files: [file], title: filename }); return 'shared'; }
    catch (error) { if (error && error.name === 'AbortError') return 'shared'; /* sinon : telechargement classique */ }
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}
