/**
 * PM Musculation V2 — stockage local (IndexedDB).
 * Module ES, sans dependance ni appel reseau.
 *
 * Les programmes (objectifs) et les seances (resultats reels) sont independants.
 * Les operations d'ecriture ne se terminent qu'apres COMMIT de la transaction.
 * Ce fichier ne modifie pas l'interface : il sera branche au moteur plus tard.
 */

import { ENV } from './js/env.js';

// Production : 'pm-musculation-v2' (inchangé). Aperçu : 'pm-musculation-v2-preview' (base distincte, voir js/env.js).
const DB_NAME = 'pm-musculation-v2' + ENV.suffix;
const DB_VERSION = 1; // schéma IndexedDB ET version du format de sauvegarde : inchangés par le registre multi-profils
const STORES = ['programs', 'sessions', 'weights', 'settings'];
let opening = null;

// ---------------------------------------------------------------- profils (V2-PROF1)
// Profils historiques : identifiants conservés à vie, connus dès le démarrage (comportement V1 immédiat).
export const LEGACY_PROFILE_IDS = Object.freeze(['pierre', 'manon']);
// Identifiant d'un profil : minuscules, chiffres, tirets ; 2 à 40 caractères ; jamais « demo » (profil fictif en mémoire).
export const PROFILE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;
// Registre des profils : lignes du magasin `settings` sous ce pseudo-profil RÉSERVÉ (« ~ » est impossible dans un
// identifiant valide). Aucune nouvelle base, aucun changement de schéma, aucune version de base à monter.
// Ces lignes ne sortent jamais dans l'export, la restauration ou l'effacement d'un profil (tous filtrés par profileId).
const REGISTRY = '~registry';
const META_KEY = 'meta';
const profileKey = id => 'profile:' + id;
// Profils autorisés pour les lectures / écritures : les historiques + ceux du registre une fois chargé.
// Valeur = « époque » de la fiche (jeton tiré à l'inscription du profil) ; null pour Pierre et Manon (jamais supprimés).
// Ce n'est qu'un CACHE par onglet : chaque écriture d'un profil supplémentaire est revérifiée dans le registre, DANS sa
// propre transaction (voir guardedWrite), donc un onglet au registre périmé ne peut jamais écrire dans un profil
// supprimé ailleurs, ni dans un profil supprimé puis restauré (nouvelle époque).
const knownProfiles = new Map(LEGACY_PROFILE_IDS.map(id => [id, null]));
// Inscriptions RETIRÉES dans cet onglet : profil vu ici avec une époque qui a disparu (supprimé, ou supprimé puis
// réinscrit). Jusqu'au rechargement de la page, cet onglet n'adopte JAMAIS silencieusement la nouvelle inscription du
// même identifiant (ses opérations en file appartiennent à l'ancienne). Seule une inscription faite ICI (création,
// restauration) la réautorise.
const retired = new Set();
const goneListeners = new Set();
const newEpoch = () => (typeof crypto !== 'undefined' && crypto.getRandomValues)
  ? [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('')
  : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export const isValidProfileId = id => typeof id === 'string' && PROFILE_ID_PATTERN.test(id) && id !== 'demo';

function validProfile(profileId) {
  if (!knownProfiles.has(profileId)) {
    throw new Error('Profil inconnu : selectionner un profil existant.');
  }
  return profileId;
}
/** Profils actuellement autorisés (historiques + registre chargé). */
export function knownProfileIds() { return [...knownProfiles.keys()]; }
/**
 * Prévient quand une écriture a été refusée parce que le profil n'existe plus (supprimé dans un autre onglet ou
 * remplacé par une restauration). Le profil est déjà retiré de la liste autorisée de CET onglet. Renvoie le désabonnement.
 */
export function onProfileGone(listener) { goneListeners.add(listener); return () => goneListeners.delete(listener); }
function profileGone(profileId) {
  knownProfiles.delete(profileId);
  retired.add(profileId);
  for (const listener of [...goneListeners]) { try { listener(profileId); } catch (_) { /* un écouteur ne bloque pas le refus */ } }
  const error = new Error('Ce profil a été supprimé (dans une autre fenêtre ou un autre onglet) : rien n\'a été enregistré.');
  error.code = 'PROFILE_DELETED';
  error.profileId = profileId;
  return error;
}

function nonempty(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} doit etre une chaine non vide.`);
  }
  return value;
}

function objectValue(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} doit etre un objet.`);
  }
  return value;
}

function dbUnavailable() {
  return new Error('Stockage local IndexedDB indisponible. Ne pas poursuivre sans sauvegarde.');
}

function createMissingStores(db) {
  for (const name of STORES) {
    if (db.objectStoreNames.contains(name)) continue;
    let keyPath;
    if (name === 'programs') keyPath = ['profileId', 'weekStart'];
    else if (name === 'settings') keyPath = ['profileId', 'key'];
    else keyPath = ['profileId', 'id'];
    const store = db.createObjectStore(name, { keyPath });
    store.createIndex('byProfile', 'profileId', { unique: false });
  }
}

/**
 * Ouvre la base et la cree au premier lancement. Aucune donnee V1 n'est migree.
 * Auto-reparation : si la base existe sans l'un des magasins attendus (base creee a vide par un autre outil),
 * elle est rouverte avec la version suivante pour creer les magasins manquants, sans toucher aux donnees presentes.
 */
export function openStorage() {
  if (opening) return opening;
  if (!('indexedDB' in globalThis)) return Promise.reject(dbUnavailable());

  const open = version => new Promise((resolve, reject) => {
    let request;
    // sans version : ouvre la base existante telle quelle (v1, ou v2 apres une reparation) ; une base neuve est creee en v1
    try { request = version ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME); }
    catch (error) { reject(error); return; }
    request.onupgradeneeded = () => createMissingStores(request.result);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error || dbUnavailable());
    request.onblocked = () => reject(new Error('Base de donnees bloquee par une autre fenetre.'));
  });

  opening = open(0).then(db => {
    if (STORES.every(name => db.objectStoreNames.contains(name))) return db;
    const next = db.version + 1;
    db.close();
    return open(next);
  }).catch(error => {
    opening = null;
    throw error;
  });
  return opening;
}

/**
 * Transaction : resultats resolus SEULEMENT sur tx.oncomplete.
 * En cas d'echec, erreur remontee ; l'application ne doit pas afficher « Sauvegarde ».
 */
async function transaction(storeNames, mode, queue) {
  const db = await openStorage();
  return new Promise((resolve, reject) => {
    let tx;
    try { tx = db.transaction(storeNames, mode); }
    catch (error) { reject(error); return; }

    let result;
    let failure = null;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure || tx.error || new Error('Enregistrement annule.'));
    tx.onerror = () => { failure ||= tx.error; };

    try {
      const request = queue(tx);
      if (request) {
        request.onsuccess = () => { result = request.result; };
      }
    } catch (error) {
      failure = error;
      try { tx.abort(); } catch (_) { reject(error); }
    }
  });
}

function getRecord(store, key) {
  return transaction([store], 'readonly', tx => tx.objectStore(store).get(key));
}

/**
 * ÉCRITURE D'UN PROFIL, toujours par ici (jamais putRecord / transaction directement).
 * Pour un profil supplémentaire, la transaction inclut `settings` et relit la fiche du registre AVANT d'écrire : si
 * elle a disparu (profil supprimé) ou si son époque a changé (supprimé puis restauré), tout est annulé (code
 * PROFILE_DELETED) et rien n'est écrit. La suppression (deleteProfileAndData) prend les 4 magasins en readwrite : les
 * deux transactions se recouvrent, IndexedDB les exécute l'une APRÈS l'autre, y compris entre onglets. Une écriture
 * engagée avant la suppression est donc effacée avec le profil ; une écriture postérieure est refusée. Jamais d'orphelin.
 * `run(tx, setResult, fail)` est appelé une fois la vérification faite (immédiatement pour Pierre et Manon).
 */
async function guardedWrite(profileId, storeNames, run) {
  validProfile(profileId);
  const legacy = LEGACY_PROFILE_IDS.includes(profileId);
  const expected = knownProfiles.get(profileId) ?? '';
  const names = legacy || storeNames.includes('settings') ? storeNames : [...storeNames, 'settings'];
  const db = await openStorage();
  return new Promise((resolve, reject) => {
    let tx;
    try { tx = db.transaction(names, 'readwrite'); }
    catch (error) { reject(error); return; }
    let result;
    let failure = null;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure || tx.error || new Error('Enregistrement annule.'));
    tx.onerror = () => { failure ||= tx.error; };
    const fail = error => {
      failure = error;
      try { tx.abort(); } catch (_) { reject(error); }
    };
    const go = () => {
      try { run(tx, value => { result = value; }, fail); }
      catch (error) { fail(error); }
    };
    if (legacy) { go(); return; }
    try {
      const check = tx.objectStore('settings').get([REGISTRY, profileKey(profileId)]);
      check.onsuccess = () => {
        const row = check.result;
        if (!row || (row.epoch ?? '') !== expected) { fail(profileGone(profileId)); return; }
        go();
      };
    } catch (error) { fail(error); }
  });
}
/** Écriture simple (put) d'une ligne d'un profil, gardée. */
function putFor(profileId, store, record) {
  return guardedWrite(profileId, [store], (tx, setResult) => {
    const request = tx.objectStore(store).put(record);
    request.onsuccess = () => setResult(request.result);
  });
}
/** Suppression d'une ligne d'un profil, gardée. */
function deleteFor(profileId, store, key) {
  return guardedWrite(profileId, [store], tx => { tx.objectStore(store).delete(key); });
}

async function recordsFor(profileId, store) {
  validProfile(profileId);
  return transaction([store], 'readonly', tx =>
    tx.objectStore(store).index('byProfile').getAll(IDBKeyRange.only(profileId))
  );
}

// PROGRAMMES : une semaine par profil ; jamais fusionnes avec les resultats.
export function saveProgram(profileId, weekStart, program) {
  validProfile(profileId);
  nonempty(weekStart, 'Date du lundi');
  objectValue(program, 'Programme');
  return putFor(profileId, 'programs', {
    profileId, weekStart, data: program, updatedAt: new Date().toISOString()
  });
}

export async function getProgram(profileId, weekStart) {
  validProfile(profileId);
  nonempty(weekStart, 'Date du lundi');
  const record = await getRecord('programs', [profileId, weekStart]);
  return record?.data ?? null;
}

export async function listPrograms(profileId) {
  const records = await recordsFor(profileId, 'programs');
  return records.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

// SEANCES : data est une photo complete de l'etat actuel de la seance.
// L'appelant met a jour l'etat a chaque serie, puis attend cette promesse.
// Exemples de status : 'in_progress', 'paused', 'completed', 'partial'.
export function saveSession(profileId, session) {
  validProfile(profileId);
  objectValue(session, 'Seance');
  nonempty(session.id, 'Identifiant de seance');
  nonempty(session.status, 'Etat de seance');
  return putFor(profileId, 'sessions', {
    profileId, id: session.id, status: session.status,
    data: session, updatedAt: new Date().toISOString()
  });
}

export async function getSession(profileId, sessionId) {
  validProfile(profileId);
  nonempty(sessionId, 'Identifiant de seance');
  const record = await getRecord('sessions', [profileId, sessionId]);
  return record?.data ?? null;
}

export async function listSessions(profileId) {
  const records = await recordsFor(profileId, 'sessions');
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getUnfinishedSessions(profileId) {
  const records = await listSessions(profileId);
  return records.filter(r => r.status === 'in_progress' || r.status === 'paused');
}

export function deleteSession(profileId, sessionId) {
  validProfile(profileId);
  nonempty(sessionId, 'Identifiant de seance');
  // La confirmation visuelle de suppression est geree par l'interface.
  return deleteFor(profileId, 'sessions', [profileId, sessionId]);
}

// SEANCES — operations ATOMIQUES (une seule transaction IndexedDB readwrite).
// Les transactions readwrite sur un meme store sont serialisees par IndexedDB, y compris entre
// plusieurs onglets / instances : lecture, verification et ecriture ne peuvent pas s'entrecouper.

/** Execute `run(store, setResult, fail)` dans une transaction readwrite sur `sessions` (gardée : profil existant). */
function sessionsTransaction(profileId, run) {
  return guardedWrite(profileId, ['sessions'], (tx, setResult, fail) => run(tx.objectStore('sessions'), setResult, fail));
}

function sessionRecord(profileId, session) {
  return {
    profileId, id: session.id, status: session.status,
    data: session, updatedAt: new Date().toISOString()
  };
}

/**
 * Lit la seance, appelle `updater(donneesActuelles | null)` DANS la meme transaction, puis ecrit
 * le resultat. `updater` doit etre synchrone. S'il leve une erreur, rien n'est ecrit et la promesse
 * est rejetee avec cette erreur. S'il retourne undefined, rien n'est ecrit. La promesse n'est
 * resolue qu'apres COMMIT et retourne l'objet enregistre.
 */
export function updateSession(profileId, sessionId, updater) {
  validProfile(profileId);
  nonempty(sessionId, 'Identifiant de seance');
  if (typeof updater !== 'function') throw new TypeError('updater doit etre une fonction.');
  return sessionsTransaction(profileId, (store, setResult, fail) => {
    const request = store.get([profileId, sessionId]);
    request.onsuccess = () => {
      try {
        const record = request.result;
        const next = updater(record ? record.data : null);
        if (next === undefined) { setResult(record ? record.data : null); return; }
        objectValue(next, 'Seance');
        if (next.id !== sessionId) throw new Error('L\'identifiant de seance ne peut pas changer.');
        nonempty(next.status, 'Etat de seance');
        store.put(sessionRecord(profileId, next));
        setResult(next);
      } catch (error) { fail(error); }
    };
  });
}

/**
 * Cree une seance seulement s'il n'existe AUCUNE seance ouverte (in_progress ou paused) pour ce profil,
 * verification et ecriture dans la meme transaction : deux onglets ne peuvent pas en creer deux.
 * Sinon rejette avec une erreur de code 'SESSION_IN_PROGRESS' portant `sessionId`.
 */
export function createSessionIfNoneOpen(profileId, session) {
  validProfile(profileId);
  objectValue(session, 'Seance');
  nonempty(session.id, 'Identifiant de seance');
  nonempty(session.status, 'Etat de seance');
  return sessionsTransaction(profileId, (store, setResult, fail) => {
    const request = store.index('byProfile').getAll(IDBKeyRange.only(profileId));
    request.onsuccess = () => {
      try {
        const rows = request.result;
        const open = rows.find(r => r.status === 'in_progress' || r.status === 'paused');
        if (open) {
          const error = new Error('Une seance est deja en cours pour ce profil.');
          error.code = 'SESSION_IN_PROGRESS';
          error.sessionId = open.id;
          throw error;
        }
        if (rows.some(r => r.id === session.id)) throw new Error('Identifiant de seance deja utilise.');
        store.put(sessionRecord(profileId, session));
        setResult(session);
      } catch (error) { fail(error); }
    };
  });
}

/** Supprime une seance apres `check(donnees)` execute dans la meme transaction (leve pour refuser). */
export function deleteSessionIf(profileId, sessionId, check) {
  validProfile(profileId);
  nonempty(sessionId, 'Identifiant de seance');
  if (typeof check !== 'function') throw new TypeError('check doit etre une fonction.');
  return sessionsTransaction(profileId, (store, setResult, fail) => {
    const request = store.get([profileId, sessionId]);
    request.onsuccess = () => {
      try {
        check(request.result ? request.result.data : null);
        if (request.result) store.delete([profileId, sessionId]);
      } catch (error) { fail(error); }
    };
  });
}

// MESURES DE POIDS : un identifiant unique par saisie ; historique preserve.
export function saveWeight(profileId, measurement) {
  validProfile(profileId);
  objectValue(measurement, 'Mesure de poids');
  nonempty(measurement.id, 'Identifiant de mesure');
  if (!Number.isFinite(measurement.kg) || measurement.kg <= 0) {
    throw new RangeError('Le poids doit etre un nombre positif (kg).');
  }
  return putFor(profileId, 'weights', {
    profileId, id: measurement.id,
    data: measurement, updatedAt: new Date().toISOString()
  });
}

export function deleteWeight(profileId, id) {
  validProfile(profileId);
  nonempty(id, 'Identifiant de mesure');
  return deleteFor(profileId, 'weights', [profileId, id]);
}

export async function listWeights(profileId) {
  const records = await recordsFor(profileId, 'weights');
  return records.sort((a, b) => (b.data.date || b.updatedAt).localeCompare(a.data.date || a.updatedAt));
}

// REGLAGES : chronometre, alertes, etc., propres a chaque profil.
export function saveSetting(profileId, key, value) {
  validProfile(profileId);
  nonempty(key, 'Nom du reglage');
  return putFor(profileId, 'settings', { profileId, key, value });
}

export async function getSetting(profileId, key, defaultValue = null) {
  validProfile(profileId);
  nonempty(key, 'Nom du reglage');
  const record = await getRecord('settings', [profileId, key]);
  return record ? record.value : defaultValue;
}

/** Prepare les donnees exportables d'UN SEUL profil (sans telecharger de fichier). */
export async function exportProfileData(profileId) {
  validProfile(profileId);
  const [programs, sessions, weights, settings] = await Promise.all(
    STORES.map(name => recordsFor(profileId, name))
  );
  return {
    format: 'pm-musculation-backup',
    schemaVersion: DB_VERSION,
    profileId,
    exportedAt: new Date().toISOString(),
    data: { programs, sessions, weights, settings }
  };
}

const KEY_FIELDS = { programs: 'weekStart', sessions: 'id', weights: 'id', settings: 'key' };
/**
 * Ligne prête à écrire depuis une sauvegarde : une séance restaurée est une NOUVELLE incarnation (FIX7) ; son jeton
 * `gen` est toujours tiré ici, jamais repris du fichier. Les autres champs (révision comprise) restent ceux du fichier.
 * La sauvegarde d'origine n'est jamais modifiée.
 */
function restoredRow(name, row) {
  if (name !== 'sessions' || !row.data || typeof row.data !== 'object') return row;
  return { ...row, data: { ...row.data, gen: newEpoch() } };
}
/** Vérifie le contenu d'une sauvegarde d'UN profil (format, version, propriétaire de chaque ligne). Aucune écriture. */
function checkBackup(profileId, backup) {
  objectValue(backup, 'Sauvegarde');
  if (backup.format !== 'pm-musculation-backup' ||
      backup.schemaVersion !== DB_VERSION || backup.profileId !== profileId) {
    throw new Error('Sauvegarde incompatible ou appartenant a un autre profil.');
  }
  objectValue(backup.data, 'Contenu de sauvegarde');
  for (const name of STORES) {
    const rows = backup.data[name];
    if (!Array.isArray(rows)) throw new Error(`Section de sauvegarde invalide : ${name}.`);
    for (const row of rows) {
      objectValue(row, name);
      if (row.profileId !== profileId || typeof row[KEY_FIELDS[name]] !== 'string' ||
          !row[KEY_FIELDS[name]].trim()) {
        throw new Error(`Donnee invalide ou mauvais profil dans ${name}.`);
      }
      if (name === 'programs' || name === 'sessions' || name === 'weights') {
        objectValue(row.data, `Donnee ${name}`);
      }
    }
  }
}

/**
 * Restauration atomique d'un profil :
 *  - 'replace' : supprime ses donnees actuelles puis restaure celles du fichier.
 *  - 'merge'   : ajoute seulement les cles absentes, sans ecraser les existantes.
 * Jamais de modification de l'autre profil.
 * Le dialogue de confirmation et la lecture du fichier sont geres ailleurs.
 */
export async function restoreProfileData(profileId, backup, mode) {
  validProfile(profileId);
  checkBackup(profileId, backup);
  if (mode !== 'replace' && mode !== 'merge') {
    throw new Error('Choisir explicitement replace ou merge.');
  }
  const keyFields = KEY_FIELDS;

  // Gardée comme toute écriture : un profil supprimé entre-temps n'est jamais « ressuscité » par une restauration.
  return guardedWrite(profileId, STORES, (tx, setResult, abortWith) => {
    function writeBackup() {
      try {
        for (const name of STORES) {
          const store = tx.objectStore(name);
          for (const source of backup.data[name]) {
            const row = restoredRow(name, source);
            if (mode === 'replace') {
              store.put(row);
            } else {
              const key = [profileId, row[keyFields[name]]];
              const request = store.get(key);
              request.onsuccess = () => {
                if (request.result === undefined) {
                  try { store.add(row); } catch (error) { abortWith(error); }
                }
              };
            }
          }
        }
      } catch (error) { abortWith(error); }
    }

    if (mode === 'merge') { writeBackup(); return; }

    // Suppression ciblant UNIQUEMENT les cles du profil concerne.
    // Les insertions attendent la fin des quatre parcours de curseurs.
    let pending = STORES.length;
    try {
      for (const name of STORES) {
        const index = tx.objectStore(name).index('byProfile');
        const request = index.openCursor(IDBKeyRange.only(profileId));
        request.onsuccess = () => {
          try {
            const cursor = request.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else if (--pending === 0) {
              writeBackup();
            }
          } catch (error) { abortWith(error); }
        };
      }
    } catch (error) { abortWith(error); }
  });
}

// ---------------------------------------------------------------- registre des profils (V2-PROF1)

function registryRows(tx) {
  return tx.objectStore('settings').index('byProfile').getAll(IDBKeyRange.only(REGISTRY));
}
function applyRegistry(rows) {
  const valid = rows.filter(r => r.key.startsWith('profile:') && r.value && isValidProfileId(r.value.id));
  const next = new Map(valid.filter(r => !LEGACY_PROFILE_IDS.includes(r.value.id)).map(r => [r.value.id, r.epoch ?? '']));
  // inscription connue ici qui a disparu ou changé d'époque : retirée pour cet onglet
  for (const [id, epoch] of knownProfiles) if (epoch !== null && next.get(id) !== epoch) retired.add(id);
  knownProfiles.clear();
  for (const id of LEGACY_PROFILE_IDS) knownProfiles.set(id, null);
  for (const [id, epoch] of next) if (!retired.has(id)) knownProfiles.set(id, epoch);
}
/** Fiches lisibles par CET onglet : historiques + inscriptions autorisées (jamais une inscription retirée ici). */
function readRegistry(rows) {
  const meta = rows.find(r => r.key === META_KEY);
  const profiles = rows.filter(r => r.key.startsWith('profile:') && r.value && isValidProfileId(r.value.id) && knownProfiles.has(r.value.id)).map(r => ({ ...r.value }));
  return { meta: meta ? { ...meta.value } : null, profiles };
}

/** Nombre de lignes de données (programmes, séances, poids, réglages) des profils donnés. Lecture seule. */
export async function countProfileRows(ids) {
  let n = 0;
  for (const id of ids) {
    for (const name of STORES) {
      const rows = await transaction([name], 'readonly', tx => tx.objectStore(name).index('byProfile').getAll(IDBKeyRange.only(id)));
      n += (rows || []).length;
    }
  }
  return n;
}

/** Lit le registre (sans rien écrire) et met à jour la liste des profils autorisés. */
export async function loadProfileRegistry() {
  const rows = await transaction(['settings'], 'readonly', tx => registryRows(tx));
  applyRegistry(rows || []);
  return readRegistry(rows || []);
}

/**
 * Migration du registre, en UNE transaction : ajoute les fiches manquantes (`records`, profils historiques) et la
 * ligne `meta`. N'écrase JAMAIS une fiche existante, ne lit ni n'écrit aucune donnée de profil. Idempotente ; une
 * interruption annule toute la transaction (rien d'écrit), la migration est alors simplement rejouée.
 * @returns {{meta:object, profiles:object[], added:string[]}}
 */
export async function migrateProfileRegistry(records, { now = new Date().toISOString(), registryVersion = 1 } = {}) {
  // Réservée aux profils HISTORIQUES : un profil supplémentaire ne s'inscrit que par addProfileRecord ou
  // restoreAsNewProfile (époque tirée, jamais de fiche sans époque). Refus avant toute transaction.
  if (!Array.isArray(records)) throw new Error('Fiches de profil invalides.');
  for (const r of records) {
    if (!isValidProfileId(r?.id)) throw new Error('Fiche de profil invalide.');
    if (!LEGACY_PROFILE_IDS.includes(r.id)) throw new Error('La migration ne concerne que les profils historiques (Pierre et Manon).');
  }
  const db = await openStorage();
  return new Promise((resolve, reject) => {
    let tx;
    try { tx = db.transaction(['settings'], 'readwrite'); } catch (error) { reject(error); return; }
    let rows = null, added = [], failure = null;
    tx.oncomplete = () => { applyRegistry(rows); resolve({ ...readRegistry(rows), added }); };
    tx.onerror = () => { failure ||= tx.error; };
    tx.onabort = () => reject(failure || tx.error || new Error('Migration du registre annulée.'));
    try {
      const store = tx.objectStore('settings');
      const request = registryRows(tx);
      request.onsuccess = () => {
        try {
          rows = request.result || [];
          const have = new Set(rows.filter(r => r.key.startsWith('profile:')).map(r => r.key));
          for (const rec of records) {
            if (have.has(profileKey(rec.id))) continue; // déjà migré : jamais écrasé
            const row = { profileId: REGISTRY, key: profileKey(rec.id), value: { ...rec } };
            store.put(row); rows.push(row); added.push(rec.id);
          }
          const meta = rows.find(r => r.key === META_KEY);
          if (!meta || meta.value?.registryVersion !== registryVersion) {
            const row = { profileId: REGISTRY, key: META_KEY, value: { registryVersion, migratedAt: meta?.value?.migratedAt || now, updatedAt: now } };
            store.put(row);
            if (meta) rows.splice(rows.indexOf(meta), 1, row); else rows.push(row);
          }
        } catch (error) { failure = error; try { tx.abort(); } catch (_) { reject(error); } }
      };
    } catch (error) { failure = error; try { tx.abort(); } catch (_) { reject(error); } }
  });
}

/**
 * Ajoute une fiche de profil ; refuse si l'identifiant existe déjà (aucun écrasement). Chaque inscription reçoit une
 * nouvelle époque : un profil supprimé puis restauré avec le même identifiant n'accepte pas les écritures d'un onglet
 * resté sur l'ancienne inscription.
 */
export function addProfileRecord(record) {
  if (!isValidProfileId(record?.id) || LEGACY_PROFILE_IDS.includes(record.id)) throw new Error('Identifiant de profil invalide.');
  const epoch = newEpoch();
  return transaction(['settings'], 'readwrite', tx => {
    const store = tx.objectStore('settings');
    const request = store.get([REGISTRY, profileKey(record.id)]);
    request.onsuccess = () => {
      if (request.result) { tx.abort(); return; }
      store.put({ profileId: REGISTRY, key: profileKey(record.id), value: { ...record }, epoch });
    };
    return null;
  }).then(() => { retired.delete(record.id); knownProfiles.set(record.id, epoch); return { ...record }; },
    error => { throw error && /abort|annul/i.test(String(error.message || error)) ? new Error('Ce profil existe déjà.') : error; });
}

/**
 * Restaure un profil ABSENT de cet appareil (sauvegarde d'un autre appareil, ou profil supprimé) : vérification de son
 * absence, inscription de sa fiche avec une NOUVELLE époque et import de ses données, en UNE transaction sur les quatre
 * magasins. Tout ou rien : un échec (fiche déjà présente, donnée refusée, interruption) annule l'ensemble, aucune fiche
 * ni donnée ne reste. Les lignes résiduelles éventuelles de cet identifiant sont effacées avant l'import (jamais de
 * mélange). Le profil n'est autorisé dans cet onglet qu'après la validation (commit) de la transaction.
 */
export async function restoreAsNewProfile(record, backup) {
  if (!isValidProfileId(record?.id) || LEGACY_PROFILE_IDS.includes(record.id)) throw new Error('Identifiant de profil invalide.');
  const id = record.id;
  checkBackup(id, backup);
  const epoch = newEpoch();
  const db = await openStorage();
  await new Promise((resolve, reject) => {
    let tx;
    try { tx = db.transaction(STORES, 'readwrite'); } catch (error) { reject(error); return; }
    let failure = null;
    tx.oncomplete = () => resolve();
    tx.onerror = () => { failure ||= tx.error; };
    tx.onabort = () => reject(failure || tx.error || new Error('Restauration annulée.'));
    const fail = error => { failure = error; try { tx.abort(); } catch (_) { reject(error); } };
    const write = () => {
      try { for (const name of STORES) for (const row of backup.data[name]) tx.objectStore(name).put(restoredRow(name, row)); }
      catch (error) { fail(error); }
    };
    try {
      const reg = tx.objectStore('settings').get([REGISTRY, profileKey(id)]);
      reg.onsuccess = () => {
        try {
          if (reg.result) { fail(new Error('Ce profil existe déjà.')); return; }
          tx.objectStore('settings').put({ profileId: REGISTRY, key: profileKey(id), value: { ...record }, epoch });
          let pending = STORES.length;
          for (const name of STORES) {
            const request = tx.objectStore(name).index('byProfile').openCursor(IDBKeyRange.only(id));
            request.onsuccess = () => {
              try {
                const cursor = request.result;
                if (cursor) { cursor.delete(); cursor.continue(); } else if (--pending === 0) write();
              } catch (error) { fail(error); }
            };
          }
        } catch (error) { fail(error); }
      };
    } catch (error) { fail(error); }
  });
  retired.delete(id);
  knownProfiles.set(id, epoch);
  return { ...record };
}

/**
 * Modifie une fiche existante, dans UNE transaction gardée (comme toute écriture) : pour un profil supplémentaire, la
 * fiche doit exister ET porter l'époque connue de cet onglet, sinon PROFILE_DELETED et rien n'est modifié (un onglet
 * resté sur une ancienne inscription ne touche jamais la nouvelle). `change(copie)` renvoie la fiche suivante.
 */
export async function updateProfileRecord(id, change) {
  if (!isValidProfileId(id)) throw new Error('Identifiant de profil invalide.');
  let next = null;
  await guardedWrite(id, ['settings'], (tx, setResult, fail) => {
    const store = tx.objectStore('settings');
    const request = store.get([REGISTRY, profileKey(id)]);
    request.onsuccess = () => {
      try {
        if (!request.result) { fail(new Error('Profil introuvable ou modification invalide.')); return; }
        next = change({ ...request.result.value });
        if (!next || next.id !== id) { fail(new Error('Profil introuvable ou modification invalide.')); return; }
        store.put({ ...request.result, value: next }); // époque conservée : renommer ne change pas l'inscription
      } catch (error) { fail(error); }
    };
  });
  return { ...next };
}

/**
 * Supprime UN profil supplémentaire : sa fiche ET toutes ses données (programmes, séances, poids, réglages),
 * en UNE transaction ciblée sur son identifiant (index byProfile). Jamais les profils historiques ni la démo.
 * @returns {{programs:number, sessions:number, weights:number, settings:number}} lignes supprimées
 */
export async function deleteProfileAndData(id) {
  if (!isValidProfileId(id) || LEGACY_PROFILE_IDS.includes(id)) throw new Error('Ce profil ne peut pas être supprimé.');
  const counts = { programs: 0, sessions: 0, weights: 0, settings: 0 };
  // Gardée : la fiche doit exister avec l'époque connue de cet onglet (sinon PROFILE_DELETED, rien n'est supprimé).
  await guardedWrite(id, STORES, (tx, setResult, fail) => {
    for (const name of STORES) {
      const request = tx.objectStore(name).index('byProfile').openCursor(IDBKeyRange.only(id));
      request.onsuccess = () => {
        try {
          const cursor = request.result;
          if (cursor) { counts[name]++; cursor.delete(); cursor.continue(); }
        } catch (error) { fail(error); }
      };
    }
    tx.objectStore('settings').delete([REGISTRY, profileKey(id)]);
  });
  knownProfiles.delete(id);
  retired.add(id);
  return counts;
}
