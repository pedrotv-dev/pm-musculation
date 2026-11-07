/**
 * PM Musculation — réglages des machines de cardio (inclinaison, vitesse, niveau).
 * Facultatifs, valables pour l'échauffement ET le cardio. Dans le programme : `incline` (%), `speed`, `level`.
 * Dans la séance (`actual`) : les mêmes clés, avec la durée réelle `durationMinutes`.
 * `speed` : km/h sur un tapis ; sinon la valeur affichée par la machine (ex. marches par minute sur l'escalier).
 */
export const CARDIO_METRICS = Object.freeze([
  { key: 'incline', label: 'inclinaison', unit: '%', max: 40, integer: false },
  { key: 'speed', label: 'vitesse', unit: 'km/h', max: 60, integer: false },
  { key: 'level', label: 'niveau', unit: '', max: 100, integer: true }
]);

const isNum = v => typeof v === 'number' && Number.isFinite(v);

/** Erreur de validation d'une valeur de réglage (null si correcte ou absente). */
export function metricError(metric, value) {
  if (value === undefined || value === null) return null;
  if (!isNum(value) || value < 0 || value > metric.max || (metric.integer && !Number.isInteger(value))) {
    return `${metric.label} doit être ${metric.integer ? 'un entier' : 'un nombre'} entre 0 et ${metric.max}.`;
  }
  return null;
}

/** Garde seulement les réglages valides ; lève une Error(message) sinon. */
export function cleanMetrics(src) {
  const out = {};
  for (const m of CARDIO_METRICS) {
    if (!src || src[m.key] === undefined || src[m.key] === null) continue;
    const err = metricError(m, src[m.key]);
    if (err) throw new Error(err.charAt(0).toUpperCase() + err.slice(1));
    out[m.key] = src[m.key];
  }
  return out;
}

const fmt = n => String(Math.round(n * 100) / 100).replace('.', ',');

/** « inclinaison 5 % · vitesse 6 km/h · niveau 3 » (chaîne vide s'il n'y a rien). `unitSpeed` : false hors tapis. */
export function metricsText(src, { speedUnit = true } = {}) {
  if (!src) return '';
  return CARDIO_METRICS.filter(m => isNum(src[m.key])).map(m => {
    const unit = m.key === 'speed' && !speedUnit ? '' : m.unit;
    return m.label + ' ' + fmt(src[m.key]) + (unit ? ' ' + unit : '');
  }).join(' · ');
}

/** Réglages réels de la séance (sinon ceux du programme). */
export function metricsOf(a) {
  const out = {};
  for (const m of CARDIO_METRICS) {
    const v = a?.actual && isNum(a.actual[m.key]) ? a.actual[m.key] : (isNum(a?.planned?.[m.key]) ? a.planned[m.key] : undefined);
    if (v !== undefined) out[m.key] = v;
  }
  return out;
}
