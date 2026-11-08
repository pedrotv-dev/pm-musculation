/**
 * PM Musculation — réglages d'usage par profil (écran allumé pendant une séance, bouton retour du téléphone).
 * Stockés avec saveSetting / getSetting de storage.js (clé « ui.settings »), donc inclus dans les sauvegardes.
 * Profil « demo » : mémoire seulement. Ne rejette jamais : en cas d'erreur, valeurs par défaut.
 */
import { saveSetting, getSetting } from '../storage.js';
import { isRealProfile } from './profiles.js';

const KEY = 'ui.settings';
export const UI_DEFAULTS = Object.freeze({ keepAwake: true, backButton: true, lockAlert: true, animations: true, sfx: true, jingles: true });
const cache = new Map();

function sanitize(raw) {
  const s = { ...UI_DEFAULTS };
  if (raw && typeof raw === 'object') for (const k of Object.keys(UI_DEFAULTS)) if (typeof raw[k] === 'boolean') s[k] = raw[k];
  return s;
}
/** Dernière valeur connue, sans accès à la base (défauts tant que rien n'est chargé). */
export function peekUiSettings(profileId) { return { ...(cache.get(profileId) || UI_DEFAULTS) }; }

/** @returns {Promise<{keepAwake, backButton, lockAlert, animations, sfx, jingles} (booléens)>} */
export async function getUiSettings(profileId) {
  if (!isRealProfile(profileId)) return peekUiSettings(profileId);
  try { const s = sanitize(await getSetting(profileId, KEY, null)); cache.set(profileId, s); return { ...s }; }
  catch (_) { return peekUiSettings(profileId); }
}
/** Modifie un ou plusieurs réglages (booléens). @returns {Promise<{settings, error:string|null}>} */
export async function setUiSettings(profileId, patch) {
  const current = await getUiSettings(profileId);
  if (!patch || typeof patch !== 'object' || Object.keys(patch).some(k => !(k in UI_DEFAULTS) || typeof patch[k] !== 'boolean')) {
    return { settings: current, error: 'Réglage invalide.' };
  }
  const next = sanitize({ ...current, ...patch });
  cache.set(profileId, next);
  let error = null;
  if (isRealProfile(profileId)) { try { await saveSetting(profileId, KEY, next); } catch (e) { error = 'Réglage non enregistré (stockage indisponible).'; } }
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('pm:settings-changed', { detail: { profile: profileId, settings: next } }));
  return { settings: { ...next }, error };
}
