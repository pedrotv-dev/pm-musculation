/**
 * PM Musculation V2 — stockage local (IndexedDB).
 * Module ES, sans dependance ni appel reseau.
 *
 * Les programmes (objectifs) et les seances (resultats reels) sont independants.
 * Les operations d'ecriture ne se terminent qu'apres COMMIT de la transaction.
 * Ce fichier ne modifie pas l'interface : il sera branche au moteur plus tard.
 */

const DB_NAME = 'pm-musculation-v2';
const DB_VERSION = 1;
const PROFILE_IDS = new Set(['pierre', 'manon']);
const STORES = ['programs', 'sessions', 'weights', 'settings'];
let opening = null;

function validProfile(profileId) {
  if (!PROFILE_IDS.has(profileId)) {
    throw new Error('Profil inconnu : selectionner Pierre ou Manon.');
  }
  return profileId;
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

/** Ouvre la base et la cree au premier lancement. Aucune donnee V1 n'est migree. */
export function openStorage() {
  if (opening) return opening;
  if (!('indexedDB' in globalThis)) return Promise.reject(dbUnavailable());

  opening = new Promise((resolve, reject) => {
    let request;
    try { request = indexedDB.open(DB_NAME, DB_VERSION); }
    catch (error) { reject(error); return; }

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (db.objectStoreNames.contains(name)) continue;
        let keyPath;
        if (name === 'programs') keyPath = ['profileId', 'weekStart'];
        else if (name === 'settings') keyPath = ['profileId', 'key'];
        else keyPath = ['profileId', 'id'];
        const store = db.createObjectStore(name, { keyPath });
        store.createIndex('byProfile', 'profileId', { unique: false });
      }
    };
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

function putRecord(store, record) {
  return transaction([store], 'readwrite', tx => tx.objectStore(store).put(record));
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
  return putRecord('programs', {
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
  return putRecord('sessions', {
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
  return transaction(['sessions'], 'readwrite', tx =>
    tx.objectStore('sessions').delete([profileId, sessionId])
  );
}

// MESURES DE POIDS : un identifiant unique par saisie ; historique preserve.
export function saveWeight(profileId, measurement) {
  validProfile(profileId);
  objectValue(measurement, 'Mesure de poids');
  nonempty(measurement.id, 'Identifiant de mesure');
  if (!Number.isFinite(measurement.kg) || measurement.kg <= 0) {
    throw new RangeError('Le poids doit etre un nombre positif (kg).');
  }
  return putRecord('weights', {
    profileId, id: measurement.id,
    data: measurement, updatedAt: new Date().toISOString()
  });
}

export async function listWeights(profileId) {
  const records = await recordsFor(profileId, 'weights');
  return records.sort((a, b) => (b.data.date || b.updatedAt).localeCompare(a.data.date || a.updatedAt));
}

// REGLAGES : chronometre, alertes, etc., propres a chaque profil.
export function saveSetting(profileId, key, value) {
  validProfile(profileId);
  nonempty(key, 'Nom du reglage');
  return putRecord('settings', { profileId, key, value });
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

/**
 * Restauration atomique d'un profil :
 *  - 'replace' : supprime ses donnees actuelles puis restaure celles du fichier.
 *  - 'merge'   : ajoute seulement les cles absentes, sans ecraser les existantes.
 * Jamais de modification de l'autre profil.
 * Le dialogue de confirmation et la lecture du fichier sont geres ailleurs.
 */
export async function restoreProfileData(profileId, backup, mode) {
  validProfile(profileId);
  objectValue(backup, 'Sauvegarde');
  if (backup.format !== 'pm-musculation-backup' ||
      backup.schemaVersion !== DB_VERSION || backup.profileId !== profileId) {
    throw new Error('Sauvegarde incompatible ou appartenant a un autre profil.');
  }
  if (mode !== 'replace' && mode !== 'merge') {
    throw new Error('Choisir explicitement replace ou merge.');
  }
  objectValue(backup.data, 'Contenu de sauvegarde');

  const keyFields = { programs: 'weekStart', sessions: 'id', weights: 'id', settings: 'key' };
  for (const name of STORES) {
    const rows = backup.data[name];
    if (!Array.isArray(rows)) throw new Error(`Section de sauvegarde invalide : ${name}.`);
    for (const row of rows) {
      objectValue(row, name);
      if (row.profileId !== profileId || typeof row[keyFields[name]] !== 'string' ||
          !row[keyFields[name]].trim()) {
        throw new Error(`Donnee invalide ou mauvais profil dans ${name}.`);
      }
      if (name === 'programs' || name === 'sessions' || name === 'weights') {
        objectValue(row.data, `Donnee ${name}`);
      }
    }
  }

  const db = await openStorage();
  return new Promise((resolve, reject) => {
    let tx;
    try { tx = db.transaction(STORES, 'readwrite'); }
    catch (error) { reject(error); return; }
    let failure = null;
    tx.oncomplete = () => resolve();
    tx.onerror = () => { failure ||= tx.error; };
    tx.onabort = () => reject(failure || tx.error || new Error('Restauration annulee.'));

    function abortWith(error) {
      failure = error;
      try { tx.abort(); } catch (_) { reject(error); }
    }
    function writeBackup() {
      try {
        for (const name of STORES) {
          const store = tx.objectStore(name);
          for (const row of backup.data[name]) {
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
