// V2-COMPLETE — recette globale sur téléphone (Chromium 390 px puis 320 px, vraie base IndexedDB, données FICTIVES) :
// premier lancement → création d'un profil → profil sportif → machines → demande pour ChatGPT → import d'un JSON
// fictif valide (vérifié, avec avertissements) → séance → séries → fin de séance → historique → nouveau bilan →
// modification du programme (remplacement confirmé) → export → suppression → restauration → rechargement →
// vérification de toutes les données ; second profil indépendant ; séance libre ; démo inchangée.
// node tests/e2e/v2-complete-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const screen = '#pm-workout-screen';
const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const db = (fn, arg) => page.evaluate(fn, arg);
const active = () => page.evaluate(() => document.documentElement.dataset.pmProfile);
const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const openFold = async title => { const d = page.locator('details.pm-fold', { has: page.locator('summary', { hasText: new RegExp('^' + title + '$') }) }); if (!(await d.evaluate(x => x.open))) await d.locator('summary').click(); return d; };
const goProfil = async () => { await page.click('.nav-btn[data-go="profil"]'); await page.waitForSelector('h3:has-text("Préparer mon programme avec ChatGPT")'); };
const toSelect = async () => { await page.click('#switch-profile'); await page.waitForSelector('#screen-select:not([hidden])'); };
const settingOf = (profile, key) => db(async ([p, k]) => (await import('./storage.js')).getSetting(p, k, null), [profile, key]);
let alex, today, week, programJson, backupText;

function program(id, weekStart, dayId, { dayName = 'Haut du corps fictif', withUnavailable = true } = {}) {
  const acts = [
    { type: 'warmup', name: 'Vélo assis', durationMinutes: 5, level: 6 },
    { type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 60, sets: [{ kg: 30, reps: 10 }, { kg: 30, reps: 10 }] },
    { type: 'strength', machineId: 'seated-row', shared: false, restSeconds: 60, sets: [{ kg: 25, reps: 12 }] }
  ];
  if (withUnavailable) acts.push({ type: 'strength', machineId: 'leg-press', shared: false, restSeconds: 90, sets: [{ kg: 60, reps: 10 }] });
  acts.push({ type: 'cardio', name: 'Rameur', durationMinutes: 10 });
  return { schemaVersion: 1, weekStart, programs: { [id]: { days: [{ id: dayId, name: dayName, activities: acts }] } } };
}

console.log('V2-COMPLETE · recette globale');
await step('1-2 · premier lancement, création du profil « Alex fictif » (ouvert automatiquement)', async () => {
  await page.goto(srv.url);
  await page.waitForSelector('#screen-select:not([hidden])');
  await page.click('#create-profile');
  await page.fill('#new-profile-name', 'Alex fictif');
  await page.click('#create-profile-submit');
  await page.waitForFunction(() => /^p-/.test(document.documentElement.dataset.pmProfile || ''));
  alex = await active();
  ({ today, week } = await db(async () => { const P = await import('./js/programs.js'); const d = new Date(); const p = n => String(n).padStart(2, '0'); return { today: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()), week: P.mondayOf(d) }; }));
});

await step('3 · profil sportif (objectifs, niveau, disponibilités, intensité, fatigue, restrictions, santé non partagée)', async () => {
  await goProfil();
  const f = await openFold('Mon profil sportif');
  for (const g of ['Prise de muscle', 'Force']) await f.locator('label.pm-check', { hasText: new RegExp('^\\s*' + g + '$') }).locator('input').check();
  await f.getByLabel('Niveau d’expérience').selectOption('intermediaire');
  await f.getByLabel('Séances par semaine').selectOption('3');
  for (const d of ['Lundi', 'Mercredi', 'Vendredi']) await f.locator('label.pm-check', { hasText: new RegExp('^\\s*' + d + '$') }).locator('input').check();
  await f.getByLabel('Durée d’une séance').selectOption('60');
  await f.getByLabel('Difficulté souhaitée (RPE)').selectOption('soutenue');
  await f.getByLabel('Fatigue actuelle').selectOption('2');
  await f.getByLabel('Mouvements ou exercices à éviter').fill('Flexions profondes du genou (fictif)');
  await f.getByLabel('Tour de taille (cm)').fill('82,5');
  await f.getByLabel('Informations de santé', { exact: true }).fill('Ancienne entorse fictive');
  assert.equal(await noOverflow(), true, 'formulaire sans débordement (390 px)');
  await f.locator('button:has-text("Enregistrer mon profil sportif")').click();
  await f.locator('.pm-coach-status[data-state="ok"]').waitFor();
  const s = await settingOf(alex, 'coach.profile');
  assert.deepEqual([s.goals, s.level, s.frequency, s.days, s.durationMin, s.intensity, s.fatigue, s.measures.waistCm, s.healthInBilan], [['Prise de muscle', 'Force'], 'intermediaire', 3, ['lundi', 'mercredi', 'vendredi'], 60, 'soutenue', 2, 82.5, false]);
});

await step('3b · profil sportif : jours incohérents refusés, rien n’est écrit', async () => {
  const f = await openFold('Mon profil sportif');
  await f.getByLabel('Séances par semaine').selectOption('5');
  await f.locator('button:has-text("Enregistrer mon profil sportif")').click();
  await f.locator('.pm-coach-status[data-state="error"]').waitFor();
  assert.equal((await settingOf(alex, 'coach.profile')).frequency, 3, 'valeur enregistrée inchangée');
  await f.getByLabel('Séances par semaine').selectOption('3');
});

await step('4 · machines : Leg Press indisponible, Calf Press à éviter', async () => {
  const f = await openFold('Mes machines');
  await f.locator('label.pm-check', { hasText: 'Toutes les machines' }).locator('input').uncheck();
  await f.getByLabel('Disponible : Leg Press', { exact: true }).uncheck();
  await f.getByLabel('À éviter : Calf Press', { exact: true }).check();
  await f.locator('button:has-text("Enregistrer mes machines")').click();
  await f.locator('.pm-coach-status[data-state="ok"]').waitFor();
  const g = await settingOf(alex, 'coach.gym');
  assert.equal(g.available.includes('leg-press'), false);
  assert.ok(g.available.includes('chest-press'));
  assert.deepEqual(g.avoid, ['calf-press']);
});

await step('5 · demande pour ChatGPT : profil, machines, disponibilités, format JSON ; aucune donnée inventée', async () => {
  await page.getByLabel('Semaine à préparer').selectOption(week);
  await page.click('button:has-text("Générer ma demande")');
  await page.waitForSelector('.pm-coach-out:not([hidden])');
  const t = await page.inputValue('.pm-coach-out');
  for (const want of ['Pour : Alex fictif', 'identifiant dans l’application : ' + alex, 'weekStart = "' + week + '"', 'Objectifs : Prise de muscle, Force', 'Jours disponibles : lundi, mercredi, vendredi',
    'Durée souhaitée d’une séance : 60 min', 'Mouvements ou exercices à éviter : Flexions profondes du genou (fictif)', 'Machines à éviter : Calf Press (calf-press)', 'tour de taille 82,5 cm',
    'Poids : non renseigné', 'Santé : non communiquée', 'programs contient UNE seule clé : "' + alex + '"', 'aucun programme importé']) assert.ok(t.includes(want), 'attendu : ' + want);
  assert.equal(/^- leg-press — /m.test(t), false, 'machine indisponible absente de la liste utilisable');
  assert.equal(t.includes('entorse'), false, 'santé non partagée');
  await page.click('button:has-text("Copier")');
  await page.waitForSelector('.pm-coach-status:has-text("Copi")');
});

await step('6-7 · import du JSON fictif : vérifié, avertissement (Leg Press indisponible), puis enregistré', async () => {
  const dayId = DAYS[(new Date().getDay() + 6) % 7];
  programJson = program(alex, week, dayId);
  await page.click('button:has-text("Importer la réponse de ChatGPT")');
  await page.waitForSelector('.pm-import[open]');
  await page.fill('.pm-textarea', JSON.stringify(programJson));
  await page.click('.pm-action-verify');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  assert.match(await page.locator('#pm-import-feedback').innerText(), /Leg Press n’est pas dans tes machines disponibles/);
  await page.click('.pm-action-save');
  await page.waitForFunction(async ([id, w]) => !!(await (await import('./storage.js')).getProgram(id, w)), [alex, week]);
});

await step('8-10 · séance : échauffement, séries validées, fin de séance avec ressenti et remarque', async () => {
  await page.click('.nav-btn[data-go="accueil"]');
  await page.click('.pm-next-card .pm-play');
  await page.waitForSelector(screen + ':not([hidden])');
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  await page.click(screen + ' .pm-validate:has-text("Machine suivante")');
  await page.waitForSelector('#pm-current-kg');
  await page.fill('#pm-current-kg', '32,5'); await page.locator('#pm-current-kg').blur();
  await page.click('#pm-validate-set');
  await page.waitForFunction(async id => { const s = await (await import('./js/workouts.js')).getResumableWorkout(id); return s.activities[1].sets[0].done; }, alex);
  await page.click('#pm-validate-set');
  await page.waitForFunction(async id => { const s = await (await import('./js/workouts.js')).getResumableWorkout(id); return s.activities[1].sets[1].done; }, alex);
  await page.evaluate(() => [...document.querySelectorAll('#pm-workout-screen .pm-footer button')].find(x => /Terminer/.test(x.textContent)).click());
  await page.waitForSelector(screen + ' .pm-textarea-note');
  await page.click('.pm-feeling[data-v="4"]');
  await page.fill('.pm-textarea-note', 'Bonne séance fictive');
  await page.locator('.pm-textarea-note').blur();
  await page.waitForFunction(() => document.querySelector('#pm-save-state')?.dataset.state === 'ok');
  await page.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await page.click('.pm-modal .pm-modal-btn:has-text("Terminer en partielle")');
  await page.waitForFunction(async id => (await (await import('./js/workouts.js')).listWorkouts(id)).some(s => s.status === 'partial'), alex);
  const s = (await db(async id => (await import('./js/workouts.js')).listWorkouts(id), alex))[0];
  assert.deepEqual([s.activities[1].sets[0].kg, s.activities[1].sets[0].done, s.feedback.note, s.feedback.feeling], [32.5, true, 'Bonne séance fictive', 4]);
});

await step('11 · historique : la séance apparaît', async () => {
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pm:back-workout')));
  await page.waitForSelector(screen + '[hidden]', { state: 'attached' });
  await page.click('.nav-btn[data-go="seances"]'); await page.click('.pm-subtab[data-go="historique"]');
  await page.waitForSelector('.pm-history-card');
  assert.match(await page.locator('.pm-history-card').first().innerText(), /Haut du corps fictif/);
});

await step('12 · nouveau bilan : la séance, la charge et le ressenti réels sont repris', async () => {
  await goProfil();
  await page.getByLabel('Semaine à préparer').selectOption(await db(async w => (await import('./js/stats.js')).addDays(w, 7), week));
  await page.click('button:has-text("Générer ma demande")');
  await page.waitForSelector('.pm-coach-out:not([hidden])');
  const t = await page.inputValue('.pm-coach-out');
  assert.match(t, /Chest Press \(chest-press\) : dernière fois .* 32,5 kg × 10/);
  assert.match(t, /1 faite\(s\) \(0 complète\(s\), 1 partielle\(s\)\)/);
  assert.match(t, /ressenti moyen 4\/5/);
});

await step('13 · modification du programme de la semaine : remplacement seulement après confirmation', async () => {
  const dayId = DAYS[(new Date().getDay() + 6) % 7];
  const updated = program(alex, week, dayId, { dayName: 'Haut du corps modifié', withUnavailable: false });
  await page.click('.nav-btn[data-go="seances"]'); await page.click('.pm-subtab[data-go="programme"]');
  if (!(await page.locator('.pm-import[open]').count())) await page.click('.pm-import summary');
  await page.fill('.pm-textarea', JSON.stringify(updated));
  await page.click('.pm-action-verify');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  await page.click('.pm-action-save');
  await page.waitForSelector('.pm-modal:has-text("Remplacer le programme")');
  await page.click('.pm-modal .pm-modal-btn:has-text("Annuler")');
  await page.waitForTimeout(300);
  assert.equal((await db(async ([id, w]) => (await import('./storage.js')).getProgram(id, w), [alex, week])).days[0].name, 'Haut du corps fictif', 'refus : programme conservé');
  await page.click('.pm-action-save');
  await page.click('.pm-modal .pm-modal-btn:has-text("Remplacer")');
  await page.waitForFunction(async ([id, w]) => (await (await import('./storage.js')).getProgram(id, w))?.days[0].name === 'Haut du corps modifié', [alex, week]);
  assert.equal((await db(async id => (await import('./js/workouts.js')).listWorkouts(id), alex)).length, 1, 'séance conservée');
});

await step('14 · export du profil (sauvegarde complète, fiche jointe)', async () => {
  backupText = await db(async id => (await (await import('./js/backup.js')).createBackupFile(id)).text, alex);
  const b = JSON.parse(backupText);
  assert.equal(b.profileId, alex); assert.equal(b.profile.name, 'Alex fictif');
  assert.ok(b.data.settings.some(r => r.key === 'coach.profile') && b.data.settings.some(r => r.key === 'coach.gym'), 'profil sportif et machines inclus');
});

await step('15 · suppression du profil (double confirmation) puis restauration depuis le fichier, sur l’écran de choix', async () => {
  await goProfil();
  const f = await openFold('Mon profil');
  await f.locator('button:has-text("Supprimer ce profil")').click();
  await page.click('.pm-modal .pm-modal-btn:has-text("Supprimer")');
  await page.click('.pm-modal .pm-modal-btn:has-text("Supprimer définitivement")');
  await page.waitForSelector('#screen-select:not([hidden])');
  assert.equal(await db(async id => (await import('./storage.js')).countProfileRows([id]), alex), 0);
  await page.setInputFiles('#import-profile-file', { name: 'alex.json', mimeType: 'application/json', buffer: Buffer.from(backupText) });
  await page.click('.pm-modal .pm-modal-btn:has-text("Importer")');
  await page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, alex);
});

await step('16-17 · rechargement : toutes les données vérifiées dans IndexedDB et à l’écran', async () => {
  await page.reload();
  await page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, alex);
  const r = await db(async ([id, w]) => {
    const W = await import('./js/workouts.js'); const S = await import('./storage.js');
    const s = (await W.listWorkouts(id))[0];
    return { sessions: (await W.listWorkouts(id)).length, kg: s.activities[1].sets[0].kg, note: s.feedback.note, program: (await S.getProgram(id, w))?.days[0].name,
      sport: (await S.getSetting(id, 'coach.profile', null))?.goals, avoid: (await S.getSetting(id, 'coach.gym', null))?.avoid };
  }, [alex, week]);
  assert.deepEqual(r, { sessions: 1, kg: 32.5, note: 'Bonne séance fictive', program: 'Haut du corps modifié', sport: ['Prise de muscle', 'Force'], avoid: ['calf-press'] });
  await page.waitForSelector('.pm-hero-title:has-text("Salut Alex fictif")');
});

await step('conflit d’import : sauvegarde d’un profil déjà présent → Annuler (rien), puis Fusionner (aucun doublon)', async () => {
  await toSelect();
  await page.setInputFiles('#import-profile-file', { name: 'alex.json', mimeType: 'application/json', buffer: Buffer.from(backupText) });
  await page.waitForSelector('.pm-modal:has-text("Ce profil existe déjà")');
  await page.click('.pm-modal .pm-modal-btn:has-text("Annuler")');
  await page.waitForSelector('#import-profile-status:has-text("rien n’a été modifié")');
  await page.setInputFiles('#import-profile-file', { name: 'alex.json', mimeType: 'application/json', buffer: Buffer.from(backupText) });
  await page.click('.pm-modal .pm-modal-btn:has-text("Fusionner")');
  await page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, alex);
  const r = await db(async id => ({ sessions: (await (await import('./js/workouts.js')).listWorkouts(id)).length, profiles: (await (await import('./storage.js')).loadProfileRegistry()).profiles.filter(p => p.id === id).length }), alex);
  assert.deepEqual(r, { sessions: 1, profiles: 1 });
});

await step('second profil « Sam fictif » : indépendant (vide), séance libre, Alex inchangé', async () => {
  const alexBefore = await db(async id => { const d = await (await import('./storage.js')).exportProfileData(id); delete d.exportedAt; return JSON.stringify(d); }, alex);
  await toSelect();
  await page.click('#create-profile');
  await page.fill('#new-profile-name', 'Sam fictif');
  await page.click('#create-profile-submit');
  await page.waitForFunction(id => /^p-/.test(document.documentElement.dataset.pmProfile || '') && document.documentElement.dataset.pmProfile !== id, alex);
  const sam = await active();
  await page.waitForSelector('[data-page="accueil"] h3:has-text("Aucun programme cette semaine")');
  await page.click('button:has-text("Séance libre")');
  await page.waitForSelector(screen + ':not([hidden])');
  await page.click(screen + ' button:has-text("Ajouter une machine")');
  await page.locator('.pm-modal select').selectOption('arm-curl');
  await page.click('.pm-modal .pm-modal-btn:has-text("Ajouter")');
  await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id))?.activities.length === 1, sam);
  await page.click(screen + ' .pm-list-main');
  await page.click('#pm-validate-set');
  await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id)).activities[0].sets[0].done, sam);
  await goProfil().catch(() => {});
  const r = await db(async id => { const S = await import('./storage.js'); return { sport: await S.getSetting(id, 'coach.profile', null), programs: (await S.listPrograms(id)).length }; }, sam);
  assert.deepEqual(r, { sport: null, programs: 0 }, 'Sam démarre vide');
  const alexAfter = await db(async id => { const d = await (await import('./storage.js')).exportProfileData(id); delete d.exportedAt; return JSON.stringify(d); }, alex);
  assert.equal(alexAfter, alexBefore, 'Alex inchangé');
});

await step('démo : fonctionne, rien en base ; profil sportif Démo en mémoire seulement', async () => {
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: 'demo' } })));
  await page.waitForFunction(() => document.documentElement.dataset.pmProfile === 'demo');
  await goProfil();
  await page.click('button:has-text("Générer ma demande")');
  await page.waitForSelector('.pm-coach-out:not([hidden])');
  assert.equal(await db(async () => (await import('./storage.js')).countProfileRows(['demo'])), 0);
});

await step('affichage 320 px : profil (sections ouvertes) et écran de choix sans débordement', async () => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.evaluate(id => document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: id } })), alex);
  await goProfil();
  for (const t of ['Mon profil', 'Mon profil sportif', 'Mes machines']) await openFold(t);
  assert.equal(await noOverflow(), true, 'profil 320 px');
  await toSelect();
  assert.equal(await noOverflow(), true, 'choix 320 px');
});

await step('aucune erreur JavaScript inattendue', async () => {
  assert.deepEqual(errors, []);
});

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
