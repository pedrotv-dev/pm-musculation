/**
 * PM Musculation V3 — requête IA COURTE (phase 2). Le moteur (program-engine.js) calcule toute la semaine ; l'IA ne reçoit
 * que ce plan + un résumé, et renvoie de PETITS ajustements en JSON. Le code vérifie chaque ajustement et refuse tout ce
 * qui sort des règles (machine inconnue ou à éviter, saut de charge trop grand, séance vidée…). Sans réponse valable,
 * le plan calculé reste tel quel : l'application ne dépend jamais de l'IA.
 *
 * Transport injectable : `mockGemini` (simulation locale, sans réseau) aujourd'hui ; Firebase AI Logic (Gemini) ensuite.
 */
import { siblingsOf } from './program-engine.js';
import { lastPerformance } from './last-loads.js';


export const AI_VERSION = 1;
export const MAX_ADJUSTMENTS = 8;
const ACTIONS = ['kg', 'reps', 'sets', 'replace', 'remove'];

/** Schéma de réponse imposé à Gemini (responseSchema, sortie JSON stricte). */
export const AI_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    adjustments: { type: 'array', maxItems: MAX_ADJUSTMENTS, items: { type: 'object', properties: {
      day: { type: 'string' }, machineId: { type: 'string' }, action: { type: 'string', enum: ACTIONS },
      value: { type: 'number' }, replaceWith: { type: 'string' }, reason: { type: 'string' } }, required: ['day', 'machineId', 'action', 'reason'] } },
    advice: { type: 'string' }
  },
  required: ['adjustments', 'advice']
});

const SYSTEM = [
  'Tu es coach de musculation. Le plan de la semaine est DÉJÀ calculé par l’application selon des sources publiées',
  '(ACSM 2009 sur la progression en musculation, Schoenfeld 2016 et 2017 sur la fréquence et le volume, Singer 2024 sur les repos, OMS 2020).',
  'Ne réécris pas le plan et n’invente rien : propose au plus ' + MAX_ADJUSTMENTS + ' ajustements, UNIQUEMENT pour respecter',
  'une contrainte, un mouvement à éviter ou une préférence ÉCRITS par l’utilisateur dans « profil », ou une recommandation',
  'établie de ces sources. Aucun avis médical : en cas de douleur, conseille de consulter un professionnel de santé.',
  'Actions : kg (un seul cran), reps, sets (1 à 6), replace (machine de la liste « machines »), remove.',
  'Pour chacun, une raison courte en français qui cite la contrainte de l’utilisateur ou la source.',
  '« advice » : 2 phrases maximum, tutoiement. Si rien n’est justifié : adjustments vide. Réponds UNIQUEMENT en JSON selon le schéma.'
].join(' ');

/**
 * Requête compacte : plan calculé + résumé utile (aucune donnée de santé sauf accord du profil).
 * @returns {{system:string, prompt:string, schema:object, bytes:number}}
 */
export function buildAiRequest({ sport = {}, plan = [], program, profileId, sessions = [], catalog = [], gym = {} }) {
  const days = program.programs[profileId].days;
  const usable = catalog.filter(m => !m.deprecated && m.kind === 'strength' && !(gym.avoid || []).includes(m.id) && (gym.available == null || gym.available.includes(m.id)));
  const recent = {};
  for (const id of new Set(plan.map(p => p.machineId))) {
    const p = lastPerformance(sessions, id);
    if (p) recent[id] = { kg: p.kg, reps: p.reps, date: p.date, ...(feelOf(sessions, id) ? { feel: feelOf(sessions, id) } : {}) };
  }
  const payload = {
    profil: compact({ objectif: sport.mainGoal, niveau: sport.level, intensite: sport.intensity, fatigue: sport.fatigue, sommeil: sport.sleep,
      contraintes: sport.constraints, eviter: sport.avoid, preferences: sport.preferences, ...(sport.healthInBilan && sport.health ? { sante: sport.health } : {}) }),
    semaine: program.weekStart,
    plan: days.map(d => ({ jour: d.id, nom: d.name, ex: d.activities.filter(a => a.type === 'strength').map(a => [a.machineId, a.sets.length, a.sets[0].reps, a.sets[0].kg]) })),
    recent,
    machines: usable.map(m => m.id)
  };
  const prompt = 'Plan et résumé (ex = [machine, séries, reps, kg]) :\n' + JSON.stringify(payload);
  const names = Object.fromEntries(catalog.map(m => [m.id, m.name]));
  return { system: SYSTEM, prompt, schema: AI_RESPONSE_SCHEMA, names, bytes: new TextEncoder().encode(SYSTEM + prompt).length };
}
const compact = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)));
const feelOf = (sessions, id) => {
  for (const s of [...sessions].sort((a, b) => String(b.date).localeCompare(String(a.date)))) {
    const a = (s.activities || []).find(x => x.machineId === id && x.feel); if (a) return a.feel;
  }
  return null;
};

/**
 * Vérifie et applique les ajustements. Ne modifie jamais `program` (copie).
 * @returns {{ program:object, applied:object[], rejected:{adj:object, why:string}[], advice:string }}
 */
export function applyAiAdjustments(program, response, { profileId, catalog = [], gym = {} }) {
  const out = JSON.parse(JSON.stringify(program));
  const applied = [], rejected = [];
  const reject = (adj, why) => rejected.push({ adj, why });
  if (!response || typeof response !== 'object' || !Array.isArray(response.adjustments)) {
    return { program: out, applied, rejected: [{ adj: null, why: 'Réponse illisible : plan calculé conservé.' }], advice: '' };
  }
  const byId = new Map(catalog.filter(m => !m.deprecated).map(m => [m.id, m]));
  const usable = id => byId.get(id)?.kind === 'strength' && !(gym.avoid || []).includes(id) && (gym.available == null || gym.available.includes(id));
  const days = out.programs[profileId].days;
  for (const adj of response.adjustments.slice(0, MAX_ADJUSTMENTS)) {
    if (!adj || !ACTIONS.includes(adj.action)) { reject(adj, 'action inconnue'); continue; }
    const day = days.find(d => d.id === adj.day);
    const act = day?.activities.find(a => a.type === 'strength' && a.machineId === adj.machineId);
    if (!act) { reject(adj, 'exercice absent du plan'); continue; }
    const v = Number(adj.value);
    if (adj.action === 'kg') {
      const cur = act.sets[0].kg;
      const max = Math.max(5, cur * 0.1); // un cran : 10 % (5 kg minimum)
      if (!(cur > 0)) { reject(adj, 'charge encore inconnue : jamais inventée, elle se trouve à la première séance'); continue; }
      if (!Number.isFinite(v) || v < 0 || v > 1000 || Math.abs(v - cur) > max) { reject(adj, 'saut de charge trop grand'); continue; }
      act.sets.forEach(s => { s.kg = Math.round(v * 100) / 100; });
    } else if (adj.action === 'reps') {
      if (!Number.isInteger(v) || v < 1 || v > 30) { reject(adj, 'répétitions hors limites (1 à 30)'); continue; }
      act.sets.forEach(s => { s.reps = v; });
    } else if (adj.action === 'sets') {
      if (!Number.isInteger(v) || v < 1 || v > 6) { reject(adj, 'séries hors limites (1 à 6)'); continue; }
      const model = act.sets[0];
      act.sets = Array.from({ length: v }, () => ({ ...model }));
    } else if (adj.action === 'replace') {
      if (!usable(adj.replaceWith)) { reject(adj, 'machine de remplacement inconnue, indisponible ou à éviter'); continue; }
      if (day.activities.some(a => a.machineId === adj.replaceWith)) { reject(adj, 'machine déjà dans la séance'); continue; }
      const sib = siblingsOf(act.machineId).includes(adj.replaceWith);
      act.machineId = adj.replaceWith;
      if (!sib) act.sets.forEach(s => { s.kg = 0; }); // autre machine : charge à trouver (jamais inventée)
    } else if (adj.action === 'remove') {
      if (day.activities.filter(a => a.type === 'strength').length <= 2) { reject(adj, 'séance trop courte pour retirer un exercice'); continue; }
      day.activities = day.activities.filter(a => a !== act);
    }
    applied.push(adj);
  }
  const advice = typeof response.advice === 'string' ? response.advice.slice(0, 400) : '';
  return { program: out, applied, rejected, advice };
}

/** Appel : transport injecté (mock ou Firebase) ; toute erreur → plan calculé conservé. */
export async function askCoach(request, { transport }) {
  try { return { ok: true, response: await transport(request) }; }
  catch (e) { return { ok: false, response: null, error: String(e.message || e) }; }
}

/**
 * SIMULATION de Gemini (aucun réseau) : réagit au résumé comme le ferait un coach, avec des règles simples.
 * Sert aux tests et à l'aperçu ; remplacé par le vrai Gemini (Firebase AI Logic) en phase 2 bis.
 */
export async function mockGemini(request) {
  const data = JSON.parse(request.prompt.slice(request.prompt.indexOf('{')));
  const p = data.profil || {}, adj = [];
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const said = norm((p.contraintes || '') + ' ' + (p.eviter || '') + ' ' + (p.preferences || ''));
  const names = request.names || {};
  // seul cas traité : une machine NOMMÉE par l'utilisateur comme à éviter → remplacée par une machine voisine
  // disponible, sinon retirée (jamais de règle inventée sur la fatigue, les articulations, etc.)
  for (const d of data.plan) for (const [id] of d.ex) {
    const n = norm(names[id] || id.replace(/-/g, ' '));
    if (!said.includes(n)) continue;
    const alt = siblingsOf(id).find(x => data.machines.includes(x) && !d.ex.some(([y]) => y === x));
    adj.push(alt ? { day: d.jour, machineId: id, action: 'replace', replaceWith: alt, reason: 'Tu as indiqué vouloir éviter ' + (names[id] || id) + ' : machine voisine à la place.' }
      : { day: d.jour, machineId: id, action: 'remove', reason: 'Tu as indiqué vouloir éviter ' + (names[id] || id) + '.' });
  }
  const pain = /douleur|mal au|blessure/.test(said);
  return {
    adjustments: adj.slice(0, MAX_ADJUSTMENTS),
    advice: (adj.length ? 'Plan ajusté à ce que tu as indiqué. ' : 'Plan conforme, rien à modifier. ')
      + (pain ? 'Tu signales une douleur : demande l’avis d’un professionnel de santé avant de charger.' : 'Vise la régularité : au moins 2 séances de renforcement par semaine (OMS).')
  };
}
