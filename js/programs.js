/**
 * PM Musculation V2 — module Programmes.
 * Module ES, sans dependance ni appel reseau.
 *
 * Stockage : reutilise UNIQUEMENT saveProgram / getProgram / listPrograms de storage.js
 * (storage.js reste a la racine du depot ; il n'est pas deplace).
 * Les performances (seances, poids) vivent dans d'autres stores : ce module ne les lit
 * ni ne les modifie, y compris lors du remplacement d'une machine.
 * Le moteur ne reorganise JAMAIS les jours ni les activites : l'ordre du JSON est conserve.
 *
 * Format de reference :
 * {
 *   "schemaVersion": 1,
 *   "weekStart": "2026-11-09",                       // un lundi, AAAA-MM-JJ
 *   "programs": {
 *     "pierre": { "days": [ { "id": "lundi", "name": "Pecs", "activities": [
 *       { "type": "warmup",   "name": "Rameur", "durationSeconds": 300 },
 *       { "type": "strength", "machineId": "chest-press", "shared": false,
 *         "sets": [ { "kg": 40, "reps": 10 }, { "kg": 45, "reps": 8 } ], "restSeconds": 90 },
 *       { "type": "cardio",   "name": "Velo", "durationMinutes": 15 }
 *     ] } ] },
 *     "manon": { ... }
 *   }
 * }
 */

import { saveProgram, getProgram, listPrograms } from '../storage.js';

const PROGRAM_SCHEMA_VERSION = 1;

const PROFILES = ['pierre', 'manon'];
const ACTIVITY_TYPES = ['warmup', 'strength', 'cardio'];
const MAX_FILE_BYTES = 1024 * 1024;
const DAY_IDS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MAX_DAYS = DAY_IDS.length;
const MACHINE_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Erreur d'importation ; `errors` liste tous les problemes trouves (messages francais). */
export class ProgramImportError extends Error {
  constructor(message, errors = [message], code = 'INVALID_PROGRAM') {
    super(message);
    this.name = 'ProgramImportError';
    this.code = code;
    this.errors = errors;
  }
}

// ---------------------------------------------------------------- dates

function pad(n) { return String(n).padStart(2, '0'); }

/** Lundi (AAAA-MM-JJ, heure LOCALE) de la semaine contenant `date`. */
export function mondayOf(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** true si `value` est une date calendaire reelle au format AAAA-MM-JJ. */
function isRealDate(value) {
  const m = typeof value === 'string' ? DATE_RE.exec(value) : null;
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

function isMonday(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1;
}

/** 'active' (semaine en cours, des le lundi), 'upcoming' (a venir) ou 'past'. */
export function getProgramStatus(weekStart, date = new Date()) {
  const current = mondayOf(date);
  if (weekStart === current) return 'active';
  return weekStart > current ? 'upcoming' : 'past';
}

// ---------------------------------------------------------------- lecture de la source

/** Texte JSON (colle ou fichier) -> objet. Tolere un BOM. */
export function parseProgramJson(text) {
  if (typeof text !== 'string') throw new ProgramImportError('Le contenu doit etre du texte JSON.');
  const clean = text.replace(/^﻿/, '').trim();
  if (!clean) throw new ProgramImportError('Le texte JSON est vide.');
  if (clean.length > MAX_FILE_BYTES) throw new ProgramImportError('Fichier trop volumineux (max 1 Mo).');
  try { return JSON.parse(clean); }
  catch (error) { throw new ProgramImportError(`JSON invalide : ${error.message}`); }
}

/** Fichier (File/Blob choisi dans l'interface) -> objet. */
export async function readProgramFile(file) {
  if (!file || typeof file.text !== 'function') throw new ProgramImportError('Aucun fichier fourni.');
  if (file.size > MAX_FILE_BYTES) throw new ProgramImportError('Fichier trop volumineux (max 1 Mo).');
  return parseProgramJson(await file.text());
}

async function toObject(source) {
  if (typeof source === 'string') return parseProgramJson(source);
  if (source && typeof source.text === 'function') return readProgramFile(source);
  if (source && typeof source === 'object') return source;
  throw new ProgramImportError('Source inconnue : fournir un fichier, un texte JSON ou un objet.');
}

// ---------------------------------------------------------------- validation

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string' && v.trim() !== '';
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const isPos = v => typeof v === 'number' && Number.isFinite(v) && v > 0;

function checkActivity(a, where, errors, machines) {
  if (!isObj(a)) { errors.push(`${where} : activite invalide.`); return; }
  if (!ACTIVITY_TYPES.includes(a.type)) {
    errors.push(`${where} : type inconnu (${ACTIVITY_TYPES.join(', ')}).`);
    return;
  }
  if (a.name !== undefined && !isStr(a.name)) errors.push(`${where} : name doit etre un texte non vide.`);
  for (const f of ['durationSeconds', 'durationMinutes']) {
    if (a[f] !== undefined && !isPos(a[f])) errors.push(`${where} : ${f} doit etre un nombre positif.`);
  }
  if (a.type !== 'strength') return;

  if (!isStr(a.machineId) || !MACHINE_ID.test(a.machineId)) {
    errors.push(`${where} : machineId absent ou invalide.`);
  } else {
    machines.add(a.machineId);
  }
  if (typeof a.shared !== 'boolean') errors.push(`${where} : shared doit etre true ou false.`);
  if (!isInt(a.restSeconds, 0, 3600)) errors.push(`${where} : restSeconds doit etre un entier entre 0 et 3600.`);
  if (!Array.isArray(a.sets) || a.sets.length === 0 || a.sets.length > 20) {
    errors.push(`${where} : sets doit contenir de 1 a 20 series.`);
    return;
  }
  a.sets.forEach((s, i) => {
    if (!isObj(s) || typeof s.kg !== 'number' || !Number.isFinite(s.kg) || s.kg < 0 || s.kg > 1000) {
      errors.push(`${where}, serie ${i + 1} : kg doit etre un nombre entre 0 et 1000.`);
    }
    if (!isObj(s) || !isInt(s.reps, 1, 1000)) {
      errors.push(`${where}, serie ${i + 1} : reps doit etre un entier positif.`);
    }
  });
}

/** Valide le programme d'UN profil ; ajoute ses erreurs dans `errors`. Retourne ses machineId. */
function checkProfileProgram(program, label, errors) {
  const machines = new Set();
  if (!isObj(program) || !Array.isArray(program.days)) {
    errors.push(`${label} : "days" doit etre une liste.`);
    return machines;
  }
  if (program.days.length === 0 || program.days.length > MAX_DAYS) {
    errors.push(`${label} : entre 1 et ${MAX_DAYS} jours attendus.`);
  }
  const ids = new Set();
  program.days.forEach((day, i) => {
    const dl = `${label}, jour ${i + 1}`;
    if (!isObj(day)) { errors.push(`${dl} : jour invalide.`); return; }
    if (!DAY_IDS.includes(day.id)) errors.push(`${dl} : id "${day.id}" invalide (${DAY_IDS.join(', ')}).`);
    else if (ids.has(day.id)) errors.push(`${dl} : id "${day.id}" en double.`);
    else ids.add(day.id);
    if (day.name !== undefined && !isStr(day.name)) errors.push(`${dl} : name doit etre un texte non vide.`);
    if (!Array.isArray(day.activities) || day.activities.length === 0) {
      errors.push(`${dl} : activities doit etre une liste non vide.`);
      return;
    }
    day.activities.forEach((a, j) => checkActivity(a, `${dl}, activite ${j + 1}`, errors, machines));
  });
  return machines;
}

function knownSet(knownMachineIds) {
  return knownMachineIds == null ? null : new Set(knownMachineIds);
}

/**
 * Valide un fichier complet (sans rien enregistrer).
 * Les erreurs de l'AUTRE profil ne bloquent pas (avertissements) : seul `profileId` compte.
 * `knownMachineIds` (tableau ou Set) : catalogue de l'interface ; omis => pas de controle d'inconnues.
 * @returns {{ok:boolean, errors:string[], warnings:string[], unknownMachines:string[]}}
 */
export function validateProgramFile(data, { profileId, knownMachineIds } = {}) {
  const errors = [];
  const warnings = [];
  let unknownMachines = [];

  if (!isObj(data)) return { ok: false, errors: ['Le fichier doit contenir un objet JSON.'], warnings, unknownMachines };
  if (data.schemaVersion !== PROGRAM_SCHEMA_VERSION) {
    errors.push(`schemaVersion doit valoir ${PROGRAM_SCHEMA_VERSION}.`);
  }
  if (!isRealDate(data.weekStart)) {
    errors.push('weekStart doit etre une date reelle au format AAAA-MM-JJ.');
  } else if (!isMonday(data.weekStart)) {
    errors.push(`weekStart (${data.weekStart}) doit etre un lundi.`);
  }
  if (!isObj(data.programs)) {
    errors.push('"programs" doit contenir les profils pierre et/ou manon.');
    return { ok: false, errors, warnings, unknownMachines };
  }
  if (profileId !== undefined && !PROFILES.includes(profileId)) {
    errors.push('Profil actif inconnu : selectionner Pierre ou Manon.');
  }
  for (const key of Object.keys(data.programs)) {
    if (!PROFILES.includes(key)) warnings.push(`Profil "${key}" inconnu : ignore.`);
  }

  const known = knownSet(knownMachineIds);
  for (const id of PROFILES) {
    if (!(id in data.programs)) {
      if (id === profileId) errors.push(`Aucun programme pour le profil actif (${id}) dans ce fichier.`);
      continue;
    }
    const local = [];
    const machines = checkProfileProgram(data.programs[id], `Programme ${id}`, local);
    if (id === profileId) errors.push(...local);
    else warnings.push(...local.map(m => `(autre profil, ignore) ${m}`));
    if (id === profileId && known) {
      unknownMachines = [...machines].filter(m => !known.has(m));
    }
  }
  return { ok: errors.length === 0, errors, warnings, unknownMachines };
}

// ---------------------------------------------------------------- importation

/**
 * Valide et prepare l'enregistrement du profil actif, SANS ecrire (apercu / tests).
 * Ne lance PAS d'erreur pour les machines inconnues : elles sont listees dans `unknownMachines`
 * pour que l'interface propose un remplacement.
 * `machineReplacements` : { idInconnu: idDuCatalogue } applique au programme avant le controle ;
 * chaque cible doit appartenir a `knownMachineIds` (si fourni). L'ordre des activites ne change pas.
 * @returns {Promise<{weekStart, program, unknownMachines, usedMachines, warnings, status}>}
 * @throws {ProgramImportError}
 */
export async function prepareProgramImport(profileId, source, { knownMachineIds, machineReplacements, date } = {}) {
  const data = await toObject(source);
  const report = validateProgramFile(data, { profileId, knownMachineIds });
  if (!report.ok) {
    throw new ProgramImportError(`Programme refuse (${report.errors.length} probleme(s)).`, report.errors);
  }
  const days = JSON.parse(JSON.stringify(data.programs[profileId].days)); // copie, ordre intact
  const known = knownSet(knownMachineIds);
  const replacements = [];

  if (machineReplacements != null) {
    if (!isObj(machineReplacements)) throw new ProgramImportError('machineReplacements doit etre un objet {ancien: nouveau}.');
    const used = collectMachines({ days });
    const problems = [];
    for (const [from, to] of Object.entries(machineReplacements)) {
      if (!used.has(from)) problems.push(`Remplacement : la machine "${from}" n'est pas dans ce programme.`);
      else if (!isStr(to) || !MACHINE_ID.test(to)) problems.push(`Remplacement de "${from}" : identifiant cible invalide.`);
      else if (known && !known.has(to)) problems.push(`Remplacement de "${from}" : "${to}" n'est pas dans le catalogue.`);
    }
    if (problems.length) throw new ProgramImportError(`Remplacements refuses (${problems.length}).`, problems, 'INVALID_REPLACEMENT');
    const at = new Date().toISOString();
    for (const day of days) {
      for (const a of day.activities) {
        if (a.type === 'strength' && Object.prototype.hasOwnProperty.call(machineReplacements, a.machineId)) a.machineId = machineReplacements[a.machineId];
      }
    }
    for (const [from, to] of Object.entries(machineReplacements)) replacements.push({ from, to, at });
  }

  const usedMachines = [...collectMachines({ days })];
  return {
    weekStart: data.weekStart,
    program: {
      schemaVersion: PROGRAM_SCHEMA_VERSION,
      weekStart: data.weekStart,
      profileId,
      importedAt: new Date().toISOString(),
      days,
      replacements
    },
    unknownMachines: known ? usedMachines.filter(m => !known.has(m)) : [],
    usedMachines,
    warnings: report.warnings,
    status: getProgramStatus(data.weekStart, date)
  };
}

/**
 * Importe un fichier / texte colle / objet et n'enregistre QUE le profil actif.
 * - Une importation REMPLACE directement le programme existant de la meme semaine
 *   (les seances enregistrees ne sont jamais touchees).
 * - Si `knownMachineIds` est fourni, l'importation definitive est refusee (code 'UNKNOWN_MACHINES',
 *   liste dans `error.unknownMachines`) tant qu'il reste des machines hors catalogue :
 *   utiliser prepareProgramImport pour l'apercu, puis repasser `machineReplacements`.
 * @returns {Promise<{weekStart, program, unknownMachines, usedMachines, warnings, status}>}
 */
export async function importProgram(profileId, source, options = {}) {
  const prepared = await prepareProgramImport(profileId, source, options);
  if (prepared.unknownMachines.length) {
    const err = new ProgramImportError(
      `Machines inconnues : ${prepared.unknownMachines.join(', ')}. Les remplacer avant d'importer.`,
      prepared.unknownMachines.map(m => `Machine inconnue : ${m}`),
      'UNKNOWN_MACHINES'
    );
    err.unknownMachines = prepared.unknownMachines;
    throw err;
  }
  await saveProgram(profileId, prepared.weekStart, prepared.program);
  return prepared;
}

// ---------------------------------------------------------------- lecture / activation

/**
 * Programme actif : celui dont le lundi est celui de la semaine de `date` (aujourd'hui par defaut).
 * L'activation est automatique des le lundi prevu ; aucune ecriture n'est necessaire.
 * Retourne null s'il n'y a pas de programme cette semaine (pas de repli silencieux).
 * @returns {Promise<{weekStart, status:'active', program}|null>}
 */
export async function getActiveProgram(profileId, date = new Date()) {
  const weekStart = mondayOf(date);
  const program = await getProgram(profileId, weekStart);
  return program ? { weekStart, status: 'active', program } : null;
}

/** Semaines enregistrees, de la plus recente a la plus ancienne, avec leur statut. */
export async function listProgramWeeks(profileId, date = new Date()) {
  const rows = await listPrograms(profileId);
  return rows.map(r => ({
    weekStart: r.weekStart,
    updatedAt: r.updatedAt,
    status: getProgramStatus(r.weekStart, date)
  }));
}

// ---------------------------------------------------------------- machines inconnues

function collectMachines(program) {
  const ids = new Set();
  for (const day of program.days) {
    for (const a of day.activities) if (a.type === 'strength') ids.add(a.machineId);
  }
  return ids;
}

/** Machines d'un programme enregistre absentes du catalogue fourni. */
export async function getUnknownMachines(profileId, weekStart, knownMachineIds) {
  const program = await getProgram(profileId, weekStart);
  if (!program) throw new ProgramImportError('Programme introuvable pour cette semaine.', undefined, 'NOT_FOUND');
  const known = new Set(knownMachineIds || []);
  return [...collectMachines(program)].filter(id => !known.has(id));
}

/**
 * Remplace une machine par une autre dans un programme enregistre (ex. machine inconnue).
 * `knownMachineIds` (optionnel) : la cible doit appartenir au catalogue.
 * Ne change ni l'ordre ni les series/charges ; les performances (seances) ne sont pas touchees.
 * @returns {Promise<{weekStart, replaced:number}>} nombre d'activites modifiees
 */
export async function replaceMachine(profileId, weekStart, fromId, toId, knownMachineIds) {
  if (!isStr(fromId) || !isStr(toId) || !MACHINE_ID.test(toId) ||
      (knownMachineIds != null && !new Set(knownMachineIds).has(toId))) {
    throw new ProgramImportError('Identifiants de machine invalides.', undefined, 'INVALID_MACHINE');
  }
  const program = await getProgram(profileId, weekStart);
  if (!program) throw new ProgramImportError('Programme introuvable pour cette semaine.', undefined, 'NOT_FOUND');
  let replaced = 0;
  for (const day of program.days) {
    for (const a of day.activities) {
      if (a.type === 'strength' && a.machineId === fromId) { a.machineId = toId; replaced++; }
    }
  }
  if (replaced === 0) throw new ProgramImportError(`Machine "${fromId}" absente de ce programme.`, undefined, 'NOT_FOUND');
  program.replacements = [...(program.replacements || []), { from: fromId, to: toId, at: new Date().toISOString() }];
  await saveProgram(profileId, weekStart, program);
  return { weekStart, replaced };
}
