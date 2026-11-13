/**
 * PM Musculation V3 — configuration de l'IA (Gemini via Firebase AI Logic).
 * Tant que FIREBASE_CONFIG est vide, l'application utilise la SIMULATION locale (mockGemini) : aucun appel réseau.
 * La configuration web Firebase (apiKey, authDomain, projectId, appId) n'est pas un secret : elle sera ajoutée ici
 * quand le projet Firebase sera créé (offre gratuite Spark + Gemini Developer API).
 */
import { mockGemini } from './coach-ai.js';

export const FIREBASE_CONFIG = null;
export const AI_MODE = FIREBASE_CONFIG ? 'gemini' : 'simulation';
/** Transport de la requête IA : simulation locale tant que Firebase n'est pas configuré. */
export const aiTransport = () => mockGemini;
