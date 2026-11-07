/**
 * PM Musculation — la mélodie qui sonne à la fin du repos, même écran verrouillé (utilisée par js/rest-audio.js).
 * Fichier destiné à être REMPLAÇABLE (voir docs/chatgpt/02-sons.md) sans toucher au reste.
 *
 * Contrat : `melodySamples()` retourne un Uint8Array d'échantillons 8 bits NON signés (128 = silence), mono, à `MELODY_RATE` Hz,
 * d'une durée de 1,5 s MAXIMUM. Crête recommandée : 128 ± 110 au plus. Fondu de 5 à 10 ms au début et à la fin de chaque note
 * (pas de claquement). Fonction pure : aucun accès au navigateur, testable sous Node.
 */
export const MELODY_RATE = 8000;
export const MELODY_MAX_SECONDS = 1.5;

const BEEP_HZ = 880, BEEP_S = 0.2, GAP_S = 0.14, BEEPS = 3, TAIL_S = 0.4;

/** Version actuelle : trois bips. */
export function melodySamples() {
  const beep = Math.round(BEEP_S * MELODY_RATE), gap = Math.round(GAP_S * MELODY_RATE), tail = Math.round(TAIL_S * MELODY_RATE);
  const out = new Uint8Array(BEEPS * (beep + gap) + tail).fill(128);
  const ramp = Math.round(0.008 * MELODY_RATE);
  for (let b = 0; b < BEEPS; b++) {
    const start = b * (beep + gap);
    for (let i = 0; i < beep; i++) {
      const env = Math.min(1, i / ramp, (beep - i) / ramp);
      out[start + i] = 128 + Math.round(Math.sin(2 * Math.PI * BEEP_HZ * i / MELODY_RATE) * 100 * env);
    }
  }
  return out;
}
