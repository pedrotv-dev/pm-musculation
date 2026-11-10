// Un processus, un navigateur et une origine locale neufs par parcours. Aucun retry masquant un échec.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../..', import.meta.url));
const suites = {
  core: ['pierre-flow', 'demo-flow', 'data-flow', 'offline-flow', 'update-flow', 'css-update-flow', 'isolation-flow', 'jeu-flow', 'nav-flow', 'retours-flow', 'rest-audio-race-flow', 'v2-profiles-flow', 'v2-tabs-flow', 'v2-workout-target-flow', 'v2-history-target-flow', 'v2-workout-draft-flow', 'v2-set-integrity-flow', 'v2-fix4-flow', 'v2-fix5-flow', 'v2-fix6-flow', 'v2-fix7-flow', 'v2-fix8-flow', 'v2-fix9-flow', 'v2-profile-create-flow', 'v2-qa9-flow', 'v2-complete-flow', 'v2-charges-flow', 'v2-home-flow'],
  mobile: ['v1-mobile-flow', 'v1-m1-mobile-flow', 'history-edit-flow', 'v1-ux2-flow', 'demo-tools-flow', 'v1-ui1-flow', 'v2-parcours-flow', 'v2-recette-flow'],
  audits: ['audit-faults', 'audit-a11y', 'audit-ui'],
  offline: ['offline-flow']
};
const args = process.argv.slice(2);
let suite = 'all', repeat = 1;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--suite') suite = args[++i];
  else if (args[i] === '--repeat') repeat = Number(args[++i]);
  else throw new Error('Argument inconnu : ' + args[i]);
}
if (suite !== 'all' && !suites[suite]) throw new Error('Suite inconnue : ' + suite);
if (!Number.isInteger(repeat) || repeat < 1 || repeat > 20) throw new Error('Répétitions attendues : 1 à 20.');
const flows = suite === 'all' ? [...suites.core, ...suites.mobile, ...suites.audits] : suites[suite];
const artifacts = path.join(root, 'artifacts/e2e', suite + '-' + Date.now());
fs.mkdirSync(artifacts, { recursive: true });
const results = [];
for (let iteration = 1; iteration <= repeat; iteration++) for (const flow of flows) {
  const dir = path.join(artifacts, flow + '-' + iteration);
  fs.mkdirSync(dir, { recursive: true });
  console.log('\n=== ' + flow + ' · passage ' + iteration + '/' + repeat + ' ===');
  const start = Date.now();
  const result = await new Promise(resolve => {
    const log = fs.createWriteStream(path.join(dir, 'output.log'));
    const child = spawn(process.execPath, [path.join(root, 'tests/e2e/execute.mjs'), flow], {
      cwd: root, env: { ...process.env, E2E_ARTIFACT_DIR: dir }, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe']
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === 'win32') child.kill('SIGKILL');
      else { try { process.kill(-child.pid, 'SIGKILL'); } catch (_) { /* déjà terminé */ } }
    }, 240000);
    const emit = stream => data => { stream.write(data); log.write(data); };
    child.stdout.on('data', emit(process.stdout)); child.stderr.on('data', emit(process.stderr));
    child.on('error', e => { log.write(String(e)); });
    child.on('close', (code, signal) => { clearTimeout(timer); log.end(); resolve({ flow, iteration, code, signal, timedOut, elapsedMs: Date.now() - start }); });
  });
  results.push(result);
  fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify(results, null, 2) + '\n');
}
const failed = results.filter(r => r.code !== 0 || r.timedOut);
console.log('\nParcours : ' + (results.length - failed.length) + '/' + results.length + ' réussis. Diagnostics : ' + path.relative(root, artifacts));
process.exitCode = failed.length ? 1 : 0;
