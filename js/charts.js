/** PM Musculation — graphiques SVG simples, sans bibliotheque. */
const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const k of Object.keys(attrs)) n.setAttribute(k, attrs[k]);
  if (text !== undefined) n.textContent = text;
  return n;
};
const fmt = n => (Math.round(n * 10) / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 });

function frame(width, height, title) {
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': title, class: 'pm-chart' });
  svg.append(s('title', {}, title));
  return svg;
}
/** Courbe : points [{label, value}] (ordre chronologique). */
export function lineChart(points, { title = 'Graphique', unit = '' } = {}) {
  const w = 320, h = 160, pl = 38, pr = 10, pt = 14, pb = 26;
  const svg = frame(w, h, title);
  if (!points.length) return svg;
  const values = points.map(p => p.value);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.12; min -= pad; max += pad;
  const x = i => pl + (points.length === 1 ? (w - pl - pr) / 2 : (i * (w - pl - pr)) / (points.length - 1));
  const y = v => pt + (h - pt - pb) * (1 - (v - min) / (max - min));
  for (const v of [min + pad, (min + max) / 2, max - pad]) {
    svg.append(s('line', { x1: pl, x2: w - pr, y1: y(v), y2: y(v), class: 'pm-grid' }), s('text', { x: pl - 5, y: y(v) + 4, class: 'pm-axis', 'text-anchor': 'end' }, fmt(v)));
  }
  svg.append(s('polyline', { points: points.map((p, i) => x(i) + ',' + y(p.value)).join(' '), class: 'pm-line', fill: 'none' }));
  points.forEach((p, i) => svg.append(s('circle', { cx: x(i), cy: y(p.value), r: 3.5, class: 'pm-dot-c' }, undefined)));
  svg.append(s('text', { x: pl, y: h - 6, class: 'pm-axis' }, points[0].label), s('text', { x: w - pr, y: h - 6, class: 'pm-axis', 'text-anchor': 'end' }, points[points.length - 1].label));
  if (unit) svg.append(s('text', { x: w - pr, y: 10, class: 'pm-axis', 'text-anchor': 'end' }, unit));
  return svg;
}
/** Barres : [{label, value}]. */
export function barChart(rows, { title = 'Graphique', unit = '' } = {}) {
  const w = 320, h = 140, pl = 8, pr = 8, pt = 18, pb = 22;
  const svg = frame(w, h, title);
  if (!rows.length) return svg;
  const max = Math.max(1, ...rows.map(r => r.value));
  const slot = (w - pl - pr) / rows.length, bw = Math.min(30, slot * 0.62);
  rows.forEach((r, i) => {
    const bh = (h - pt - pb) * (r.value / max), x = pl + i * slot + (slot - bw) / 2, y = h - pb - bh;
    svg.append(s('rect', { x, y, width: bw, height: Math.max(bh, r.value ? 1 : 0), rx: 4, class: 'pm-bar' }),
      s('text', { x: x + bw / 2, y: y - 4, class: 'pm-axis', 'text-anchor': 'middle' }, fmt(r.value)),
      s('text', { x: x + bw / 2, y: h - 6, class: 'pm-axis', 'text-anchor': 'middle' }, r.label));
  });
  if (unit) svg.append(s('text', { x: w - pr, y: 10, class: 'pm-axis', 'text-anchor': 'end' }, unit));
  return svg;
}
