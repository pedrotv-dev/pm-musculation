/**
 * PM Musculation — profils (source unique). `pierre` et `manon` sont de vrais espaces de données ;
 * `demo` est un espace fictif en mémoire (jamais écrit dans IndexedDB).
 */
export const REAL_PROFILES = Object.freeze(['pierre', 'manon']);
export const ALL_PROFILES = Object.freeze(['pierre', 'manon', 'demo']);
export const PROFILE_INFO = Object.freeze({
  pierre: Object.freeze({ name: 'Pierre', goal: 'Prise de muscle, force et endurance', short: 'Prise de muscle', theme: 'Bleu', accent: '#48a1ff', rgb: '72, 161, 255' }),
  manon: Object.freeze({ name: 'Manon', goal: 'Perte de graisse et renforcement musculaire', short: 'Renforcement', theme: 'Violet', accent: '#bd8aff', rgb: '189, 138, 255' }),
  demo: Object.freeze({ name: 'Démo', goal: 'Explorer sans enregistrer', short: 'Explorer sans enregistrer', theme: 'Violet démo', accent: '#c2a1ef', rgb: '194, 161, 239' })
});
import { ENV } from './env.js';
export const PROFILE_STORAGE_KEY = 'pm-musculation:profile:v2' + ENV.suffix; // production : clé inchangée
export const isRealProfile = id => REAL_PROFILES.indexOf(id) !== -1;
export const isKnownProfile = id => ALL_PROFILES.indexOf(id) !== -1;
