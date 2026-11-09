#!/usr/bin/env node
// Usage: node aggregate.mjs <results-dir> [personas.json]
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.argv[2];
const personas = process.argv[3] && existsSync(process.argv[3]) ? Object.fromEntries(JSON.parse(readFileSync(process.argv[3], 'utf8')).map(p => [p.id, p])) : {};
const files = readdirSync(dir).filter(f => f.endsWith('.json'));
const issues = new Map(); const tasks = new Map();
for (const f of files) {
  const r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  for (const t of r.tasks ?? []) {
    const s = tasks.get(t.task) ?? { success: 0, struggle: 0, fail: 0 };
    s[t.outcome] = (s[t.outcome] ?? 0) + 1; tasks.set(t.task, s);
    for (const i of t.issues ?? []) {
      const e = issues.get(i.key) ?? { key: i.key, personas: new Set(), sev: 0, what: i.what, quotes: [], shots: [], segs: {} };
      e.personas.add(r.personaId); e.sev += i.severity ?? 1;
      if (e.quotes.length < 3 && i.quote) e.quotes.push(`« ${i.quote} » (${r.personaId})`);
      if (e.shots.length < 2 && i.screenshot) e.shots.push(i.screenshot);
      const p = personas[r.personaId];
      if (p) for (const k of [p.techLevel, p.device, p.accessibility]) e.segs[k] = (e.segs[k] ?? 0) + 1;
      issues.set(i.key, e);
    }
  }
}
const ranked = [...issues.values()].sort((a, b) => b.sev - a.sev);
const L = [];
L.push(`# Rapport de test utilisateur simulé\n`);
L.push(`> ${files.length} testeurs simulés (agents IA), pas de vraies personnes : à compléter par un test humain.\n`);
L.push(`## Réussite par tâche\n`, `| Tâche | Réussi | Avec difficulté | Échec |`, `|---|---|---|---|`);
for (const [t, s] of tasks) L.push(`| ${t} | ${s.success ?? 0} | ${s.struggle ?? 0} | ${s.fail ?? 0} |`);
L.push(`\n## Top 5 à corriger\n`);
ranked.slice(0, 5).forEach((e, i) => {
  L.push(`### ${i + 1}. ${e.key} — ${e.personas.size} testeurs (score ${e.sev})`, e.what ?? '');
  const segs = Object.entries(e.segs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} (${v})`).join(', ');
  if (segs) L.push(`Segments les plus touchés : ${segs}`);
  e.quotes.forEach(q => L.push(`- ${q}`)); e.shots.forEach(s => L.push(`- capture : ${s}`)); L.push('');
});
L.push(`## Tous les problèmes\n`);
for (const e of ranked) L.push(`- **${e.key}** : ${e.personas.size} testeurs, score ${e.sev}`);
console.log(L.join('\n'));
