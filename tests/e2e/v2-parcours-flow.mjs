// V2-CONSOLIDATION — parcours complet sur téléphone (390 px, horloge simulée, données FICTIVES) :
// création d'un profil → profil sportif incomplet (informations manquantes, accès direct) → complété (poids actuel,
// poids cible) → apparition de « Générer ma demande » → demande (profil, poids, durée maximale, démarche) → pesée depuis
// Progression et correction depuis le profil (sans doublon) → sauvegarde / restauration sans perte → ancien profil
// non obligé de tout recommencer → import de la réponse complète de ChatGPT → démarrage de la séance.
// node tests/e2e/v2-parcours-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const db = (fn, arg) => page.evaluate(fn, arg);
const coach = '.pm-coach-section';
const openFold = async title => { const d = page.locator('details.pm-fold', { has: page.locator('summary', { hasText: new RegExp('^' + title + '$') }) }); if (!(await d.evaluate(x => x.open))) await d.locator('summary').click(); return d; };
const goProfil = async () => { await page.click('.nav-btn[data-go="profil"]'); await page.waitForSelector(coach + ' h3'); };
const weights = id => db(async id => (await (await import('./js/weights.js')).listBodyWeights(id)).map(w => [w.date, w.kg]).sort(), id);
const setting = (id, k) => db(async ([id, k]) => (await import('./storage.js')).getSetting(id, k, null), [id, k]);
const saveSport = async f => { await f.locator('.pm-coach-status').evaluate(p => { p.dataset.state = ''; p.textContent = ''; }); await f.locator('button:has-text("Enregistrer mon profil sportif")').click(); await f.locator('.pm-coach-status[data-state="ok"]').waitFor(); };
const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
let alex, prompt;

console.log('V2 · parcours : création → profil → demande → import → séance');
await step('1 · mardi 10 novembre 2026 : création du profil « Alex fictif »', async () => {
  await page.clock.install({ time: new Date(2026, 10, 10, 10, 0, 0) });
  await page.goto(srv.url);
  await page.click('#create-profile'); await page.fill('#new-profile-name', 'Alex fictif'); await page.click('#create-profile-submit');
  await page.waitForFunction(() => /^p-/.test(document.documentElement.dataset.pmProfile || ''));
  alex = await db(() => document.documentElement.dataset.pmProfile);
});

await step('2 · profil incomplet : informations manquantes listées, génération absente', async () => {
  await goProfil();
  await page.waitForSelector(coach + ' .pm-coach-missing');
  const t = await page.locator(coach).innerText();
  for (const want of ['objectif principal', 'niveau d’expérience', 'nombre de séances par semaine', 'jours disponibles', 'durée maximale par séance']) assert.ok(t.includes('Compléter : ' + want), want);
  assert.equal(await page.locator(coach + ' button:has-text("Générer ma demande")').count(), 0);
  const order = await page.evaluate(() => [...document.querySelectorAll('[data-page="profil"] .pm-profile-section')].map(x => x.querySelector('h3, summary')?.textContent));
  assert.ok(order.indexOf('Mon profil sportif') < order.indexOf('Préparer mon programme avec ChatGPT') && order.indexOf('Mes machines') < order.indexOf('Préparer mon programme avec ChatGPT'), 'profil, machines, puis demande');
});

await step('3 · accès direct : « Compléter : niveau d’expérience » ouvre le profil sportif sur le champ', async () => {
  await page.click(coach + ' button:has-text("Compléter : niveau d’expérience")');
  await page.waitForFunction(() => document.querySelector('.pm-sport-fold')?.open && document.activeElement?.id === 'pm-sport-level');
});

await step('4 · profil partiel enregistré : seules les informations encore manquantes sont listées', async () => {
  const f = await openFold('Mon profil sportif');
  await f.getByLabel('Objectif principal').selectOption('Force');
  await f.getByLabel('Niveau d’expérience').selectOption('debutant');
  await saveSport(f);
  await page.waitForFunction(() => { const t = document.querySelector('.pm-coach-section')?.innerText || ''; return !t.includes('Compléter : niveau') && t.includes('Compléter : jours disponibles'); });
  assert.equal(await page.locator(coach + ' button:has-text("Compléter : objectif principal")').count(), 0);
});

await step('5 · profil complété (poids actuel 80,4, poids cible 75) → « Générer ma demande » apparaît ; mensurations et santé facultatives', async () => {
  const f = await openFold('Mon profil sportif');
  await f.locator('label.pm-check', { hasText: /^\s*Endurance$/ }).locator('input').check();
  await f.getByLabel('Séances par semaine').selectOption('3');
  for (const d of ['Lundi', 'Mardi', 'Jeudi', 'Samedi']) await f.locator('label.pm-check', { hasText: new RegExp('^\\s*' + d + '$') }).locator('input').check();
  await f.getByLabel('Durée maximale par séance').selectOption('120');
  assert.match(await f.innerText(), /pas une durée à remplir/);
  assert.match(await f.innerText(), /Aucune pesée enregistrée/);
  await f.locator('#pm-sport-weight').fill('80,4');
  await f.locator('#pm-sport-target').fill('75');
  assert.equal(await noOverflow(), true, 'sans débordement (390 px)');
  await saveSport(f);
  assert.match(await f.locator('.pm-coach-status').innerText(), /Pesée enregistrée : 80,4 kg/);
  await page.waitForSelector(coach + ' button:has-text("Générer ma demande")');
  assert.equal(await page.locator(coach + ' .pm-coach-missing').count(), 0);
  const s = await setting(alex, 'coach.profile');
  assert.deepEqual([s.mainGoal, s.goals, s.level, s.frequency, s.days, s.durationMin, s.targetWeightKg, s.health], ['Force', ['Endurance'], 'debutant', 3, ['lundi', 'mardi', 'jeudi', 'samedi'], 120, 75, '']);
  assert.deepEqual(await weights(alex), [['2026-11-10', 80.4]], 'une pesée datée, dans le système de pesées existant');
});

await step('6 · demande : profil transmis, poids et cible, durée MAXIMALE, démarche scientifique, justification + JSON strict', async () => {
  await page.click(coach + ' button:has-text("Générer ma demande")');
  await page.waitForSelector('.pm-coach-out:not([hidden])');
  prompt = await page.inputValue('.pm-coach-out');
  for (const want of ['Objectif principal : Force', 'Objectifs secondaires : Endurance', 'Niveau d’expérience : Débutant', 'Séances souhaitées par semaine : 3', 'Jours disponibles : lundi, mardi, jeudi, samedi',
    'Durée MAXIMALE disponible par séance : 120 min', 'une séance de 50 min est parfaitement acceptable', 'Poids : 80,4 kg (dernière mesure le 10 novembre 2026)', 'Poids cible (objectif personnel, ni obligation médicale ni promesse de résultat',
    'N’invente JAMAIS de référence', 'justification courte de tes choix sportifs (3 à 5 lignes', 'programs contient UNE seule clé : "' + alex + '"']) assert.ok(prompt.includes(want), 'attendu : ' + want);
});

await step('7 · pesée depuis Progression (79,8), puis poids actuel modifié depuis le profil (79,5) : correction du jour, sans doublon', async () => {
  await page.click('.nav-btn[data-go="progres"]');
  await page.getByLabel('Poids en kg').fill('79,8');
  await page.getByLabel('Date de la mesure').fill('2026-11-09');
  await page.click('.pm-weight-form button');
  await page.waitForFunction(async id => (await (await import('./js/weights.js')).listBodyWeights(id)).length === 2, alex);
  await goProfil();
  const f = await openFold('Mon profil sportif');
  assert.equal(await f.locator('#pm-sport-weight').inputValue(), '80,4', 'dernière mesure connue (la plus récente)');
  await f.locator('#pm-sport-weight').fill('79,5');
  await saveSport(f);
  assert.match(await f.locator('.pm-coach-status').innerText(), /Pesée du jour corrigée : 79,5 kg/);
  assert.deepEqual(await weights(alex), [['2026-11-09', 79.8], ['2026-11-10', 79.5]]);
  await saveSport(f); // nouvel enregistrement sans changement : aucune pesée de plus
  assert.deepEqual(await weights(alex), [['2026-11-09', 79.8], ['2026-11-10', 79.5]]);
  await page.click('.nav-btn[data-go="progres"]');
  await page.waitForSelector('[data-page="progres"] .pm-weight-line:has-text("79,5 kg")');
});

await step('8 · poids cible supprimé (facultatif), puis remis ; sauvegarde / restauration sans perte', async () => {
  await goProfil();
  const f = await openFold('Mon profil sportif');
  await f.locator('#pm-sport-target').fill('');
  await saveSport(f);
  assert.equal((await setting(alex, 'coach.profile')).targetWeightKg, null);
  await f.locator('#pm-sport-target').fill('76');
  await saveSport(f);
  const r = await db(async id => {
    const B = await import('./js/backup.js'); const S = await import('./storage.js');
    const snap = async () => { const d = await S.exportProfileData(id); delete d.exportedAt; return d; };
    const before = await snap();
    const backup = B.parseBackupText((await B.createBackupFile(id)).text);
    await B.restoreBackup(id, backup, 'replace');
    const after = await snap();
    return { same: JSON.stringify(after.data.weights) === JSON.stringify(before.data.weights) && JSON.stringify(after.data.settings) === JSON.stringify(before.data.settings), target: (await S.getSetting(id, 'coach.profile', null)).targetWeightKg, w: after.data.weights.length };
  }, alex);
  assert.deepEqual(r, { same: true, target: 76, w: 2 });
});

await step('9 · ancien profil (un seul objectif, sans objectif principal) : demande disponible sans tout recommencer', async () => {
  const old = await db(async () => {
    const P = await import('./js/profiles.js'); const S = await import('./storage.js');
    const p = await P.createProfile({ name: 'Ancien fictif', color: 'sauge' });
    await S.saveSetting(p.id, 'coach.profile', { goals: ['Endurance'], level: 'confirme', frequency: 2, days: ['mardi', 'jeudi'], durationMin: 45, updatedAt: '2026-10-01T10:00:00.000Z', history: [] });
    return p.id;
  });
  await page.evaluate(id => document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: id } })), old);
  await page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, old);
  await goProfil();
  await page.waitForSelector(coach + ' button:has-text("Générer ma demande")');
  assert.equal(await page.locator('#pm-sport-mainGoal').inputValue(), 'Endurance', 'objectif principal identifié');
  await page.evaluate(id => document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: id } })), alex);
  await page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, alex);
});

await step('10 · modification d’un profil existant (2 séances) : demande toujours disponible, régénérée', async () => {
  await goProfil();
  const f = await openFold('Mon profil sportif');
  await f.getByLabel('Séances par semaine').selectOption('2');
  await saveSport(f);
  await page.click(coach + ' button:has-text("Générer ma demande")');
  await page.waitForFunction(() => document.querySelector('.pm-coach-out')?.value.includes('Séances souhaitées par semaine : 2'));
  const hist = (await setting(alex, 'coach.profile')).history.map(h => h.field);
  assert.ok(hist.includes('frequency') && hist.includes('targetWeightKg'), 'changements mémorisés');
});

await step('11 · import de la réponse COMPLÈTE de ChatGPT (justification + JSON) → accueil → séance démarrée', async () => {
  const program = { schemaVersion: 1, weekStart: '2026-11-09', programs: { [alex]: { days: [{ id: 'mardi', name: 'Force fictive', activities: [
    { type: 'warmup', name: 'Vélo assis', durationMinutes: 5 },
    { type: 'strength', machineId: 'leg-press', shared: false, restSeconds: 150, sets: [{ kg: 60, reps: 5 }, { kg: 60, reps: 5 }] },
    { type: 'cardio', name: 'Rameur', durationMinutes: 10 }] }] } } };
  await page.click(coach + ' button:has-text("Importer la réponse de ChatGPT")');
  await page.waitForSelector('.pm-import[open]');
  await page.fill('.pm-textarea', 'Force en priorité, peu de volume.\nEndurance en complément.\nDurée estimée environ 30 min, sous ton maximum de 120 min.\n\n```json\n' + JSON.stringify(program, null, 2) + '\n```');
  await page.click('.pm-action-verify');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  await page.click('.pm-action-save');
  await page.waitForFunction(async id => !!(await (await import('./storage.js')).getProgram(id, '2026-11-09')), alex);
  await page.click('.nav-btn[data-go="accueil"]');
  await page.waitForSelector('[data-page="accueil"] .pm-next-card h3:has-text("Séance du jour")');
  await page.click('.pm-next-card .pm-play');
  await page.waitForSelector('#pm-workout-screen:not([hidden])');
  await page.click('#pm-workout-screen .pm-validate:has-text("Fait")');
  await page.click('#pm-workout-screen .pm-validate:has-text("Machine suivante")');
  await page.waitForSelector('#pm-current-kg');
  assert.equal(await page.inputValue('#pm-current-kg'), '60', 'jamais faite : charge du programme');
  assert.equal(await page.locator('.pm-last-load').count(), 0);
  assert.equal(await noOverflow(), true);
});

await step('aucune erreur JavaScript', async () => { assert.deepEqual(errors, []); });

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
