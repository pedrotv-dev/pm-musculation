/**
 * PM Musculation — sauvegardes JSON par profil, restauration (remplacer / fusionner), export CSV.
 * S'appuie sur exportProfileData / restoreProfileData de storage.js (transactions atomiques).
 * Le profil « demo » n'est jamais sauvegarde ni restaure.
 */
import { exportProfileData, restoreProfileData, saveSetting, getSetting } from '../storage.js';
import { plannedIndex, SIDE_LABEL } from './machine-rules.js';
import { isRealProfile, isKnownProfile, profileRecord, adoptProfile, forgetAdoptedProfile } from './profiles.js';
import { isValidProfileId } from '../storage.js';

export const BACKUP_FORMAT = 'pm-musculation-backup';
const stamp = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

function realProfile(profileId) {
  if (!isRealProfile(profileId)) throw new Error('Les sauvegardes ne concernent que les vrais profils (Pierre et Manon, ou un profil créé), pas la démo.');
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
  if (!isValidProfileId(backup.profileId)) throw new Error('Profil de la sauvegarde inconnu.'); // profil d'un autre appareil possible : la restauration vérifie la destination
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
  // V2-PROF1 : fiche du profil jointe (champ supplémentaire, ignoré par les versions précédentes : compatibles)
  const rec = profileRecord(profileId);
  if (rec) backup.profile = { id: rec.id, name: rec.name, goal: rec.goal, color: rec.color, createdAt: rec.createdAt, extra: rec.extra || {} };
  return { filename: 'pm-musculation-' + profileId + '-' + stamp() + '.json', text: JSON.stringify(backup, null, 1), summary: describeBackup(backup) };
}
/** Restaure dans le profil ACTIF uniquement ; mode 'replace' ou 'merge'. */
export async function restoreBackup(profileId, backup, mode) {
  realProfile(profileId);
  if (backup.profileId !== profileId) throw new Error('Cette sauvegarde appartient à ' + backup.profileId + ' : elle ne peut pas être restaurée dans le profil ' + profileId + '.');
  await restoreProfileData(profileId, backup, mode);
}
/**
 * Restaure la sauvegarde d'un profil ABSENT de cet appareil (autre appareil, ou profil supprimé) sous SON identifiant :
 * inscription dans le registre (fiche jointe à la sauvegarde), puis restauration de ses données. Refusé si le profil
 * existe déjà ici (utiliser restoreBackup, qui exige le profil actif = profil du fichier) : aucun doublon, aucun
 * mélange. Si la restauration échoue, l'inscription est annulée.
 * @returns {Promise<object>} la fiche du profil inscrit
 */
export async function restoreBackupAsNewProfile(backup) {
  if (!backup || backup.format !== BACKUP_FORMAT) throw new Error('Ce fichier n’est pas une sauvegarde PM Musculation.');
  if (isKnownProfile(backup.profileId)) throw new Error('Ce profil existe déjà sur cet appareil : ouvre-le puis restaure sa sauvegarde depuis son espace.');
  const meta = { ...(backup.profile && typeof backup.profile === 'object' ? backup.profile : {}), id: backup.profileId };
  const rec = await adoptProfile(meta);
  try { await restoreProfileData(rec.id, backup, 'replace'); }
  catch (error) { await forgetAdoptedProfile(rec.id).catch(() => {}); throw error; }
  return rec;
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
  const rows = [['date', 'seance', 'statut', 'activite', 'type', 'serie', 'charge_kg', 'repetitions', 'validee', 'duree_min', 'objectif_kg', 'objectif_reps', 'cote', 'inclinaison', 'vitesse', 'niveau']];
  for (const s of sessions.slice().sort((a, b) => (a.date + a.startedAt).localeCompare(b.date + b.startedAt))) {
    for (const key of s.order) {
      const a = s.activities.find(x => x.key === key); if (!a) continue;
      const label = a.type === 'strength' ? (names.get(a.machineId) || a.machineId) : a.name || a.type;
      if (a.type === 'strength') {
        a.sets.forEach((x, i) => { const p = a.planned?.sets?.[Math.min(plannedIndex(i, a.perSide), (a.planned.sets.length || 1) - 1)]; rows.push([s.date, s.dayName || s.dayId, s.status, label, a.type, i + 1, x.kg, x.reps, x.done ? 'oui' : 'non', '', p ? p.kg : '', p ? p.reps : '', x.side ? SIDE_LABEL[x.side].toLowerCase() : '', '', '', '']); });
      } else rows.push([s.date, s.dayName || s.dayId, s.status, label, a.type, '', '', '', a.status === 'done' ? 'oui' : 'non', a.actual?.durationMinutes ?? '', '', '', '', a.actual?.incline ?? '', a.actual?.speed ?? '', a.actual?.level ?? '']);
    }
  }
  return '﻿' + rows.map(r => r.map(csv).join(';')).join('\n') + '\n';
}
/**
 * Partage (feuille de partage mobile : Fichiers, iCloud Drive, Google Drive, e-mail, messagerie…) ou telecharge
 * un ou plusieurs fichiers : [{ filename, text, mime? }]. @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
async function saveFiles(list) {
  const files = typeof File === 'function' ? list.map(f => new File([f.text], f.filename, { type: f.mime || 'application/json' })) : [];
  if (files.length && navigator.canShare && navigator.canShare({ files }) && navigator.share) {
    try { await navigator.share({ files, title: list[0].filename }); return 'shared'; }
    catch (error) { if (error && error.name === 'AbortError') return 'cancelled'; /* sinon : telechargement classique */ }
  }
  for (const f of list) {
    const url = URL.createObjectURL(new Blob([f.text], { type: f.mime || 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = f.filename; a.rel = 'noopener';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  return 'downloaded';
}
/** Un seul fichier. @returns {Promise<'shared'|'downloaded'|'cancelled'>} */
export function saveTextFile(filename, text, mime = 'application/json') { return saveFiles([{ filename, text, mime }]); }

// ---------------------------------------------------------------- rappel de sauvegarde (reglage du profil, via storage.js)

const LAST_KEY = 'backup.last';
/** Derniere sauvegarde du profil : { at: ISO, sessions: nombre de seances a ce moment-la, how } ou null. */
export async function getBackupStatus(profileId) {
  if (!isRealProfile(profileId)) return null;
  try { return await getSetting(profileId, LAST_KEY, null); } catch (_) { return null; }
}
export async function markBackupDone(profileId, { sessions = 0, how = 'manual', now = new Date() } = {}) {
  realProfile(profileId);
  await saveSetting(profileId, LAST_KEY, { at: now.toISOString(), sessions, how });
}
/**
 * Faut-il rappeler de sauvegarder ? Oui s'il y a des seances et : jamais sauvegarde, ou 3 nouvelles seances
 * depuis la derniere sauvegarde, ou 7 jours et au moins 1 nouvelle seance. Fonction pure.
 * @returns {{due:boolean, never:boolean, daysSince:number|null, newSessions:number}}
 */
export function backupAdvice(status, sessionCount, now = new Date()) {
  if (!sessionCount) return { due: false, never: !status, daysSince: null, newSessions: 0 };
  if (!status || !status.at) return { due: true, never: true, daysSince: null, newSessions: sessionCount };
  const daysSince = Math.floor((now.getTime() - Date.parse(status.at)) / 86400000);
  const newSessions = Math.max(0, sessionCount - (status.sessions || 0));
  return { due: newSessions >= 3 || (daysSince >= 7 && newSessions >= 1), never: false, daysSince, newSessions };
}
/** Sauvegarde en un geste : cree le fichier, le partage / telecharge, et memorise la date si ce n'est pas annule. */
export async function runBackup(profileId, { extraFiles = [] } = {}) {
  const f = await createBackupFile(profileId);
  const how = await saveFiles([{ filename: f.filename, text: f.text }, ...extraFiles]);
  if (how !== 'cancelled') await markBackupDone(profileId, { sessions: f.summary.sessions, how });
  return { ...f, how };
}
