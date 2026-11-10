/**
 * PM Musculation — profils (source unique). V2-PROF1 : registre dynamique, local (IndexedDB), sans serveur.
 *
 * - Profils historiques `pierre` et `manon` : identifiants conservés à vie, connus dès le démarrage (comportement V1
 *   immédiat, même avant la lecture du registre), identité visuelle inchangée (bleu / violet).
 * - Nouveaux profils : identifiant interne unique et stable (indépendant du nom), créés / modifiés / supprimés par
 *   l'API ci-dessous. Leur fiche vit dans le registre de storage.js ; leurs données utilisent les mêmes magasins,
 *   séparées par identifiant, exactement comme Pierre et Manon.
 * - `demo` : profil fictif en mémoire, jamais dans le registre, jamais écrit dans IndexedDB.
 *
 * Aucun parcours d'interface n'est ajouté ici (création, sélection, suppression) : l'API est prête pour l'intégration
 * des écrans ASCENT/KORV. Événement `pm:profiles-changed` (detail : {reason, id}) après chaque modification du registre.
 */
import { ENV } from './env.js';
import {
  LEGACY_PROFILE_IDS, isValidProfileId, knownProfileIds, deletedLegacyIds, loadProfileRegistry, migrateProfileRegistry, countProfileRows,
  addProfileRecord, updateProfileRecord, deleteProfileAndData, onProfileGone, restoreAsNewProfile
} from '../storage.js';

export const DEMO_PROFILE_ID = 'demo';
/** Profils historiques (compatibilité V1). */
export const REAL_PROFILES = LEGACY_PROFILE_IDS;
/** Compatibilité V1 : profils historiques + démo. Pour la liste complète, utiliser listProfiles(). */
export const ALL_PROFILES = Object.freeze([...LEGACY_PROFILE_IDS, DEMO_PROFILE_ID]);

/** Couleurs autorisées (palette ASCENT existante). Pierre = bleu, Manon = violet, inchangés. */
export const PROFILE_COLORS = Object.freeze({
  bleu: Object.freeze({ theme: 'Bleu', accent: '#48a1ff', rgb: '72, 161, 255' }),
  violet: Object.freeze({ theme: 'Violet', accent: '#bd8aff', rgb: '189, 138, 255' }),
  turquoise: Object.freeze({ theme: 'Turquoise', accent: '#14e6c7', rgb: '20, 230, 199' }),
  sauge: Object.freeze({ theme: 'Sauge', accent: '#b9f08a', rgb: '185, 240, 138' }),
  ambre: Object.freeze({ theme: 'Ambre', accent: '#ffc58f', rgb: '255, 197, 143' })
});

/** Informations d'affichage historiques (compatibilité V1 ; pour un profil quelconque : getProfileInfo). */
export const PROFILE_INFO = Object.freeze({
  pierre: Object.freeze({ name: 'Pierre', goal: 'Prise de muscle, force et endurance', short: 'Prise de muscle', ...PROFILE_COLORS.bleu }),
  manon: Object.freeze({ name: 'Manon', goal: 'Perte de graisse et renforcement musculaire', short: 'Renforcement', ...PROFILE_COLORS.violet }),
  demo: Object.freeze({ name: 'Démo', goal: 'Explorer sans enregistrer', short: 'Explorer sans enregistrer', theme: 'Violet démo', accent: '#c2a1ef', rgb: '194, 161, 239' })
});
const LEGACY_COLOR = Object.freeze({ pierre: 'bleu', manon: 'violet' });

export const PROFILE_STORAGE_KEY = 'pm-musculation:profile:v2' + ENV.suffix; // production : clé inchangée
export const NAME_MAX = 40;
export const GOAL_MAX = 120;

// ---------------------------------------------------------------- vérifications synchrones (utilisées partout)

/** Vrai profil (données en IndexedDB) : historique, ou présent dans le registre chargé. Jamais `demo`. */
export const isRealProfile = id => id !== DEMO_PROFILE_ID && knownProfileIds().indexOf(id) !== -1;
/** Profil connu : vrai profil ou `demo`. */
export const isKnownProfile = id => id === DEMO_PROFILE_ID || isRealProfile(id);
export const isLegacyProfile = id => LEGACY_PROFILE_IDS.indexOf(id) !== -1;

// ---------------------------------------------------------------- registre en mémoire

const cache = new Map(); // id -> fiche du registre
const emit = (reason, id) => {
  if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    try { document.dispatchEvent(new CustomEvent('pm:profiles-changed', { detail: { reason, id } })); } catch (_) { /* sans effet */ }
  }
};

// ---------------------------------------------------------------- synchronisation entre onglets
// 1. Garantie : storage.js revérifie le registre DANS chaque transaction d'écriture (aucune écriture possible dans un
//    profil supprimé, même avec un registre périmé). Un refus retire le profil de cet onglet et l'annonce ici.
// 2. Confort : les autres onglets sont prévenus (BroadcastChannel) et relisent le registre ; au retour sur l'onglet,
//    le registre est aussi relu (navigateurs sans BroadcastChannel, onglet endormi).
const channel = (() => {
  try {
    if (typeof BroadcastChannel !== 'function') return null;
    const c = new BroadcastChannel(PROFILE_STORAGE_KEY + ':registre'); // aperçu isolé : le suffixe est déjà dans la clé
    if (typeof c.unref === 'function') c.unref(); // Node (tests) : le canal ne retient pas le processus ; sans effet en navigateur
    return c;
  } catch (_) { return null; }
})();
/** Annonce locale + aux autres onglets (jamais renvoyé par un onglet qui ne fait que relire). */
const announce = (reason, id) => {
  emit(reason, id);
  try { if (channel) channel.postMessage({ reason, id }); } catch (_) { /* onglet seul */ }
};
onProfileGone(id => { cache.delete(id); emit('deleted', id); }); // écriture refusée : profil supprimé ailleurs
if (channel) channel.onmessage = () => { if (ready) refreshProfiles().catch(() => {}); };
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => { if (ready && document.visibilityState === 'visible') refreshProfiles().catch(() => {}); });
}
const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Fiche historique (identité V1) pour la migration. */
function legacyRecord(id, createdAt) {
  const info = PROFILE_INFO[id];
  return { id, name: info.name, goal: info.goal, color: LEGACY_COLOR[id], createdAt, updatedAt: createdAt, origin: 'legacy', schemaVersion: 1, extra: {} };
}

/** Informations d'affichage d'un profil (nom, objectif, couleur) : registre, sinon identité historique. */
export function getProfileInfo(id) {
  if (id === DEMO_PROFILE_ID) return { id, ...PROFILE_INFO.demo };
  const rec = cache.get(id);
  if (rec) {
    const color = PROFILE_COLORS[rec.color] || PROFILE_COLORS.bleu;
    const base = PROFILE_INFO[id] || {};
    return { id, name: rec.name, goal: rec.goal, short: base.short || rec.goal, color: rec.color, ...color };
  }
  if (PROFILE_INFO[id]) return { id, color: LEGACY_COLOR[id], ...PROFILE_INFO[id] };
  return null;
}

// ---------------------------------------------------------------- démarrage : migration puis lecture

let ready = null;
let lastError = null;
let migrated = false;
const fill = profiles => { cache.clear(); for (const p of profiles) cache.set(p.id, p); };

/**
 * Écrit le registre (meta + fiches historiques), une seule transaction, idempotente, sans écrasement.
 * V2-UX-FINALISATION : seuls les profils historiques qui ont DES DONNÉES sur cet appareil (installation V1) reçoivent
 * une fiche ; jamais un profil historique supprimé volontairement. Installation neuve : aucun profil précréé.
 */
async function migrateNow() {
  const now = new Date().toISOString();
  const gone = new Set(deletedLegacyIds());
  const withData = [];
  for (const id of LEGACY_PROFILE_IDS) if (!gone.has(id) && !cache.has(id) && await countProfileRows([id]) > 0) withData.push(id);
  const res = await migrateProfileRegistry(withData.map(id => legacyRecord(id, now)), { now });
  fill(res.profiles);
  migrated = true;
  if (res.added.length) announce('migrated', null);
  return res;
}

/**
 * Démarrage, une seule fois par page : lecture du registre (aucune écriture). La migration n'ÉCRIT que si
 * l'installation est une installation V1 avec des données (Pierre ou Manon) et sans registre : leurs fiches sont
 * ajoutées, leurs données jamais touchées. Installation neuve, ou démo seule : rien n'est écrit (comportement V1).
 * En cas d'échec : aucune donnée touchée, profils historiques utilisables (comportement V1).
 * @returns {Promise<{ok:boolean, profiles:object[], added:string[], migrated:boolean, error:Error|null}>}
 */
export function initProfiles() {
  if (ready) return ready;
  ready = (async () => {
    try {
      const reg = await loadProfileRegistry();
      fill(reg.profiles);
      let added = [];
      // Registre déjà écrit : il fait foi (un profil historique absent a été supprimé ou n'a jamais existé ici : jamais
      // réinscrit). Sans registre : installation V1 avec données → fiches des profils historiques qui ont des données.
      if (reg.meta) migrated = true;
      else if (await countProfileRows(LEGACY_PROFILE_IDS) > 0) added = (await migrateNow()).added;
      lastError = null;
      return { ok: true, profiles: listProfilesSync(), added, migrated, error: null };
    } catch (error) {
      lastError = error;
      return { ok: false, profiles: listProfilesSync(), added: [], migrated, error };
    }
  })();
  return ready;
}
/** Registre écrit (avant toute création ou modification) : migration si elle n'a pas encore eu lieu. */
async function ensureRegistry() {
  const r = await initProfiles();
  if (!r.ok) throw r.error || new Error('Registre des profils indisponible.');
  if (!migrated) await migrateNow();
}
/** Promesse du démarrage (migration + lecture). */
export const profilesReady = () => initProfiles();
/** Dernière erreur de migration / lecture (null si tout va bien). */
export const profilesError = () => lastError;

/**
 * Relit le registre (autre onglet, restauration…). Les profils disparus sont annoncés « deleted » (l'application
 * quitte le profil actif s'il en fait partie), puis « refreshed » (identité à jour). Aucune écriture.
 */
export async function refreshProfiles() {
  await initProfiles();
  const before = new Map(cache);
  const { profiles } = await loadProfileRegistry();
  cache.clear();
  for (const p of profiles) cache.set(p.id, p);
  for (const id of before.keys()) if (!cache.has(id)) emit('deleted', id);
  emit('refreshed', null);
  return listProfilesSync();
}

function listProfilesSync() {
  const order = id => (isLegacyProfile(id) ? LEGACY_PROFILE_IDS.indexOf(id) : 10);
  // V2-UX-FINALISATION : uniquement les profils inscrits au registre (Pierre et Manon seulement s'ils y figurent)
  const ids = new Set([...cache.keys()].filter(id => isRealProfile(id)));
  return [...ids].map(id => {
    const rec = cache.get(id);
    return { ...rec, legacy: isLegacyProfile(id), ...pick(getProfileInfo(id)) };
  }).sort((a, b) => order(a.id) - order(b.id) || String(a.createdAt).localeCompare(String(b.createdAt)));
}
const pick = info => ({ accent: info.accent, rgb: info.rgb, theme: info.theme });

/**
 * Profil proposé à l'utilisateur (écran de choix, ouverture automatique) : inscrit au registre, ou la démo. Pierre et
 * Manon n'en font partie que s'ils sont inscrits (installation V1 migrée) ; jamais sur une installation neuve.
 */
export const isListedProfile = id => id === DEMO_PROFILE_ID || (cache.has(id) && isRealProfile(id));
/** Tous les vrais profils inscrits (historiques d'abord, puis par date de création). La démo n'y figure jamais. */
export async function listProfiles() { await initProfiles(); return listProfilesSync(); }
/** Fiche d'un profil, ou null. */
export async function getProfile(id) { await initProfiles(); return listProfilesSync().find(p => p.id === id) || null; }

// ---------------------------------------------------------------- création, modification, suppression

function checkFields({ name, goal, color }, { partial = false } = {}) {
  const out = {};
  if (!partial || name !== undefined) {
    const n = clean(name, NAME_MAX + 1);
    if (!n) throw new Error('Le nom est obligatoire.');
    if (n.length > NAME_MAX) throw new Error('Nom trop long (' + NAME_MAX + ' caractères maximum).');
    out.name = n;
  }
  if (!partial || goal !== undefined) {
    const g = clean(goal, GOAL_MAX + 1);
    if (g.length > GOAL_MAX) throw new Error('Objectif trop long (' + GOAL_MAX + ' caractères maximum).');
    out.goal = g;
  }
  if (!partial || color !== undefined) {
    if (!Object.prototype.hasOwnProperty.call(PROFILE_COLORS, color)) throw new Error('Couleur non autorisée.');
    out.color = color;
  }
  return out;
}
/** Identifiant interne : jamais dérivé du nom (un changement de nom ne le modifie pas). */
export function newProfileId(now = Date.now()) {
  const rand = (typeof crypto !== 'undefined' && crypto.getRandomValues)
    ? [...crypto.getRandomValues(new Uint8Array(4))].map(b => b.toString(16).padStart(2, '0')).join('')
    : Math.random().toString(16).slice(2, 10).padEnd(8, '0');
  return 'p-' + now.toString(36) + '-' + rand;
}

/**
 * Crée un profil. @param {{name:string, goal?:string, color:string, extra?:object}} input
 * @returns {Promise<object>} la fiche créée (id, name, goal, color, createdAt, updatedAt, origin:'user', extra)
 */
export async function createProfile(input = {}) {
  await ensureRegistry();
  const fields = checkFields({ name: input.name, goal: input.goal ?? '', color: input.color });
  const now = new Date().toISOString();
  const extra = input.extra && typeof input.extra === 'object' && !Array.isArray(input.extra) ? JSON.parse(JSON.stringify(input.extra)) : {};
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = newProfileId();
    if (!isValidProfileId(id) || isKnownProfile(id)) continue;
    const rec = { id, ...fields, createdAt: now, updatedAt: now, origin: 'user', schemaVersion: 1, extra };
    try { await addProfileRecord(rec); }
    catch (error) { if (/existe déjà/.test(error.message)) continue; throw error; }
    cache.set(id, rec);
    announce('created', id);
    return { ...rec };
  }
  throw new Error('Création du profil impossible : réessaie.');
}

/** Modifie nom, objectif, couleur ou `extra` d'un profil. L'identifiant et la date de création ne changent jamais. */
export async function updateProfile(id, patch = {}) {
  await ensureRegistry();
  if (!isRealProfile(id)) throw new Error('Profil inconnu.');
  const fields = checkFields(patch, { partial: true });
  const extra = patch.extra && typeof patch.extra === 'object' && !Array.isArray(patch.extra) ? JSON.parse(JSON.stringify(patch.extra)) : undefined;
  const next = await updateProfileRecord(id, cur => ({ ...cur, ...fields, ...(extra ? { extra } : {}), id: cur.id, createdAt: cur.createdAt, updatedAt: new Date().toISOString() }));
  cache.set(id, next);
  announce('updated', id);
  return { ...next };
}

/**
 * Supprime un profil SUPPLÉMENTAIRE et toutes ses données. API explicite : `confirm` doit répéter l'identifiant
 * (l'interface future demandera une confirmation et proposera une sauvegarde avant). Refusé pour Pierre, Manon et
 * la démo, et jamais pendant la migration (attend sa fin). Aucune autre donnée n'est touchée.
 */
export async function deleteProfile(id, { confirm } = {}) {
  await initProfiles();
  if (id === DEMO_PROFILE_ID) throw new Error('Ce profil ne peut pas être supprimé.');
  if (!isRealProfile(id)) throw new Error('Profil inconnu.');
  if (confirm !== id) throw new Error('Confirmation de suppression manquante.');
  const counts = await deleteProfileAndData(id);
  cache.delete(id);
  try { if (typeof localStorage !== 'undefined' && localStorage.getItem(PROFILE_STORAGE_KEY) === id) localStorage.removeItem(PROFILE_STORAGE_KEY); } catch (_) { /* stockage local bloqué */ }
  announce('deleted', id);
  return counts;
}

/** Fiche du registre (copie) d'un profil chargé, ou null. Synchrone. */
export function profileRecord(id) { const r = cache.get(id); return r ? { ...r, extra: { ...(r.extra || {}) } } : null; }

/**
 * Réinscrit sur cet appareil un profil venu d'une sauvegarde (autre appareil, ou profil supprimé ici), avec SON
 * identifiant, ET restaure ses données : UNE transaction (storage.restoreAsNewProfile), tout ou rien. Refus si
 * l'identifiant est déjà connu, historique ou démo (jamais d'écrasement, jamais de doublon). Le cache et l'annonce
 * « created » n'interviennent qu'APRÈS la validation : un échec ne laisse ni fiche, ni donnée, ni annonce.
 * Utilisé par backup.restoreBackupAsNewProfile.
 */
export async function adoptRestoredProfile(meta = {}, backup) {
  await ensureRegistry();
  const id = meta.id;
  const refused = () => new Error('Ce profil existe déjà sur cet appareil ou son identifiant est invalide.');
  // Profil historique supprimé ici : restauration possible depuis sa sauvegarde (jamais s'il est encore inscrit)
  if (!isValidProfileId(id) || cache.has(id) || (isKnownProfile(id) && !isLegacyProfile(id))) throw refused();
  const color = Object.prototype.hasOwnProperty.call(PROFILE_COLORS, meta.color) ? meta.color : 'turquoise';
  const fields = checkFields({ name: meta.name || id, goal: meta.goal ?? '', color });
  const now = new Date().toISOString();
  const rec = { id, ...fields, createdAt: typeof meta.createdAt === 'string' ? meta.createdAt : now, updatedAt: now, origin: 'restored', schemaVersion: 1,
    extra: meta.extra && typeof meta.extra === 'object' && !Array.isArray(meta.extra) ? JSON.parse(JSON.stringify(meta.extra)) : {} };
  try { await restoreAsNewProfile(rec, backup); }
  catch (error) { throw /existe déjà/.test(String(error?.message)) ? refused() : error; }
  cache.set(id, rec);
  announce('created', id);
  return { ...rec };
}

// ---------------------------------------------------------------- sélection (pour l'interface future)

/** Dernier profil utilisé sur cet appareil (ou null). */
export function lastUsedProfile() {
  try { const v = typeof localStorage !== 'undefined' ? localStorage.getItem(PROFILE_STORAGE_KEY) : null; return v && isKnownProfile(v) ? v : null; }
  catch (_) { return null; }
}
/** Demande à l'application d'ouvrir ce profil (même chemin que les boutons actuels ; mémorisé comme dernier profil). */
export function selectProfile(id) {
  if (!isKnownProfile(id)) throw new Error('Profil inconnu.');
  document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: id } }));
}
