// V2-RECETTE-1 — utilisation quotidienne, uniquement par l'interface (Chromium, téléphone 390 px, horloge simulée,
// données FICTIVES) : première utilisation → séance réelle (plusieurs machines, cardio, repos, machine occupée, reprise
// après fermeture, fin partielle) → vendredi (dernières charges) → semaine suivante → séance libre → deuxième profil
// orienté endurance → sauvegardes individuelles → hors connexion → bilan et programme suivant.
// node tests/e2e/v2-recette-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
let page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const external = []; // aucune requête hors de l'application locale (aucun transfert de données)
context.on('request', r => { if (!r.url().startsWith(srv.url.replace(/\/pm-musculation\/$/, '')) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
const screen = '#pm-workout-screen';
const home = '[data-page="accueil"]';
const db = (fn, arg) => page.evaluate(fn, arg);
const text = sel => page.locator(sel).innerText();
const coach = '.pm-coach-section';
const openFold = async title => { const d = page.locator('details.pm-fold', { has: page.locator('summary', { hasText: new RegExp('^' + title + '$') }) }); if (!(await d.evaluate(x => x.open))) await d.locator('summary').click(); return d; };
// LOT 1 : profil sportif et machines dans Réglages (⚙︎) ; « Préparer mon programme avec ChatGPT » dans l'onglet Programme
const goProfil = async () => { await page.click('.pm-settings-btn[data-go="profil"]'); await page.waitForSelector('[data-page="profil"] .pm-sport-fold'); };
const goCoach = async () => { await page.click('.nav-btn[data-go="programme"]'); await page.waitForSelector('[data-page="programme"] ' + coach + ' h3'); };
const saveSport = async f => { await f.locator('.pm-coach-status').first().evaluate(p => { p.dataset.state = ''; p.textContent = ''; }); await f.locator('button:has-text("Enregistrer mon profil sportif")').click(); await f.locator('.pm-coach-status[data-state="ok"]').first().waitFor(); };
const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const open = id => db(async id => (await import('./js/workouts.js')).getResumableWorkout(id), id);
const sessions = id => db(async id => (await (await import('./js/workouts.js')).listWorkouts(id)), id);
const sets = async (id, machineId) => (await open(id)).activities.find(a => a.machineId === machineId).sets.map(x => [x.kg, x.reps, x.done]);
const doneCount = async id => (await open(id)).activities.reduce((t, a) => t + (a.sets || []).filter(x => x.done).length, 0);
const at = (d, h = 10) => new Date(2026, 10, d, h, 0, 0);
// Coupure réseau volontaire (hors connexion) ou redémarrage demandé : les requêtes interrompues pendant cette fenêtre
// (icône du manifeste, chargements annulés par le rechargement) ne sont pas des erreurs de l'application. Les erreurs
// JavaScript, de console et HTTP restent toutes vérifiées.
const networkCut = async fn => { const n = errors.length; try { await fn(); } finally { for (let i = errors.length - 1; i >= n; i--) if (errors[i].startsWith('requestfailed: ')) errors.splice(i, 1); } };
const title = () => page.locator(screen + ' h2').first().innerText();
let alex, sam, programAlex, mondayId;

// Programme fictif réaliste (lundi / mercredi / vendredi), au format exact demandé à ChatGPT.
const weekA = (id, weekStart) => ({ schemaVersion: 1, weekStart, programs: { [id]: { days: [
  { id: 'lundi', name: 'Bas du corps', activities: [
    { type: 'warmup', name: 'Vélo assis', durationMinutes: 5, level: 6 },
    { type: 'strength', machineId: 'leg-press', shared: false, restSeconds: 60, sets: [{ kg: 30, reps: 12 }, { kg: 45, reps: 12 }, { kg: 45, reps: 12 }] },
    { type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 60, sets: [{ kg: 20, reps: 10 }, { kg: 20, reps: 10 }] },
    { type: 'strength', machineId: 'seated-row', shared: false, restSeconds: 60, sets: [{ kg: 25, reps: 12 }, { kg: 25, reps: 12 }] },
    { type: 'cardio', name: 'Rameur', durationMinutes: 10 }] },
  { id: 'mercredi', name: 'Haut du corps', activities: [
    { type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 90, sets: [{ kg: 22.5, reps: 10 }] }] },
  { id: 'vendredi', name: 'Corps entier', activities: [
    { type: 'warmup', name: 'Vélo assis', durationMinutes: 5 },
    { type: 'strength', machineId: 'leg-press', shared: false, restSeconds: 60, sets: [{ kg: 30, reps: 12 }, { kg: 45, reps: 12 }, { kg: 45, reps: 12 }] },
    { type: 'cardio', name: 'Rameur', durationMinutes: 8 }] }] } } });
const reply = p => 'Programme centré sur la prise de muscle, 3 séances sous 60 min.\nVolume modéré la première semaine.\nHypothèse : pas de douleur.\n\n```json\n' + JSON.stringify(p, null, 2) + '\n```\n';
const importReply = async text => {
  await page.click('.nav-btn[data-go="programme"]');
  if (!(await page.locator('.pm-import').evaluate(d => d.open))) await page.click('.pm-import summary');
  await page.fill('.pm-textarea', text);
  await page.click('.pm-action-verify');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  await page.click('.pm-action-save');
};
const finish = async (feeling, note, partial) => {
  await page.click(screen + ' .pm-footer button:has-text("Terminer")');
  await page.waitForSelector(screen + ' h2:has-text("Récapitulatif")');
  await page.click(screen + ' .pm-feeling:has-text("' + feeling + '")');
  await page.fill(screen + ' .pm-textarea-note', note);
  await page.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  if (partial) await page.click('.pm-modal .pm-modal-btn:has-text("Terminer en partielle")');
  await page.waitForSelector(screen + ' .pm-done-icon');
  await page.locator('.pm-levelup-overlay .pm-primary').click({ timeout: 1500 }).catch(() => {});
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('pm:back-workout')));
};
const validate = async (id, kg, reps) => {
  if (kg !== undefined) { await page.fill('#pm-current-kg', String(kg).replace('.', ',')); }
  if (reps !== undefined) { await page.fill('#pm-current-reps', String(reps)); }
  const n = await doneCount(id);
  await page.click('#pm-validate-set');
  await page.waitForFunction(async ([id, n]) => (await (await import('./js/workouts.js')).getResumableWorkout(id)).activities.reduce((t, a) => t + (a.sets || []).filter(x => x.done).length, 0) === n + 1, [id, n]);
};
const next = async () => { await page.click(screen + ' .pm-validate:has-text("Machine suivante")'); };

console.log('V2-RECETTE-1 · utilisation quotidienne');

// ------------------------------------------------------------------ 1. première utilisation
await step('1.1 lundi 9 novembre : création du profil « Alex fictif » depuis l’écran de choix', async () => {
  await page.clock.install({ time: at(9, 9) });
  await page.goto(srv.url);
  await page.waitForSelector('#screen-select:not([hidden])');
  await page.click('#create-profile'); await page.fill('#new-profile-name', 'Alex fictif'); await page.click('#create-profile-submit');
  await page.waitForFunction(() => /^p-/.test(document.documentElement.dataset.pmProfile || ''));
  alex = await db(() => document.documentElement.dataset.pmProfile);
  await page.waitForSelector(home + ' h3:has-text("Aucun programme cette semaine"), ' + home + ' h3:has-text("Ta semaine en 30 secondes")');
});

await step('1.2 profil sportif incomplet : la génération ChatGPT n’apparaît pas, ce qui manque est listé', async () => {
  await goCoach();
  await page.waitForSelector(coach + ' .pm-coach-missing');
  assert.equal(await page.locator(coach + ' button:has-text("Copier ma demande")').count(), 0);
  await goProfil();
});

await step('1.3 profil sportif, poids actuel et poids cible ; machines de la salle', async () => {
  const f = await openFold('Mon profil sportif');
  await f.getByLabel('Objectif principal').selectOption('Prise de muscle');
  await f.locator('label.pm-check', { hasText: /^\s*Remise en forme$/ }).locator('input').check();
  await f.getByLabel('Niveau d’expérience').selectOption('debutant');
  await f.getByLabel('Séances par semaine').selectOption('3');
  for (const d of ['Lundi', 'Mercredi', 'Vendredi']) await f.locator('label.pm-check', { hasText: new RegExp('^\\s*' + d + '$') }).locator('input').check();
  await f.getByLabel('Durée maximale par séance').selectOption('60');
  await f.getByLabel('Fatigue actuelle').selectOption('3');
  await f.locator('#pm-sport-weight').fill('78,6');
  await f.locator('#pm-sport-target').fill('82');
  assert.equal(await page.evaluate(() => document.getElementById('pm-sport-weight').inputMode), 'decimal', 'clavier numérique');
  await saveSport(f);
  assert.match(await f.locator('.pm-coach-status').first().innerText(), /Pesée enregistrée : 78,6 kg/);
  const g = await openFold('Mes machines');
  await g.getByLabel('À éviter : Calf Press', { exact: true }).check();
  await g.locator('button:has-text("Enregistrer mes machines")').click();
  await g.locator('.pm-coach-status[data-state="ok"]').waitFor();
  assert.equal(await noOverflow(), true);
});

await step('1.4 « Copier ma demande » apparaît ; génération et copie', async () => {
  await goCoach();
  await page.waitForSelector(coach + ' button:has-text("Copier ma demande")');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.getByLabel('Semaine à préparer').selectOption('2026-11-09');
  await page.click(coach + ' button:has-text("Copier ma demande")');
  await page.waitForSelector('.pm-coach-out:not([hidden])');
  const t = await page.inputValue('.pm-coach-out');
  for (const want of ['Objectif principal : Prise de muscle', 'Poids : 78,6 kg', 'Poids cible', 'Durée MAXIMALE disponible par séance : 60 min', 'Machines à éviter : Calf Press']) assert.ok(t.includes(want), want);
  await page.click(coach + ' button:has-text("Copier")');
  await page.waitForSelector('.pm-coach-status:has-text("Cop")');
});

await step('1.5 import de la réponse complète (semaine en cours) → accueil : « Séance du jour »', async () => {
  programAlex = weekA(alex, '2026-11-09');
  await page.click(coach + ' button:has-text("Coller la réponse de ChatGPT")');
  await page.waitForSelector('.pm-import[open]');
  await page.fill('.pm-textarea', reply(programAlex));
  await page.click('.pm-action-verify');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  assert.match(await text('.pm-preview'), /Durée estimée : environ \d+ min/);
  await page.click('.pm-action-save');
  await page.waitForFunction(async id => !!(await (await import('./storage.js')).getProgram(id, '2026-11-09')), alex);
  await page.click('.nav-btn[data-go="accueil"]');
  await page.waitForSelector(home + ' .pm-next-card h3:has-text("Séance du jour")');
  assert.match(await text(home + ' .pm-next-card'), /Bas du corps/);
});

// ------------------------------------------------------------------ 2. séance réelle
await step('2.1 démarrage : échauffement (durée réelle) puis Leg Press à la charge du programme (jamais faite)', async () => {
  await page.click(home + ' .pm-next-card .pm-play');
  await page.waitForSelector(screen + ':not([hidden])');
  await page.locator(screen + ' .pm-field input').first().fill('6');
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  await next();
  await page.waitForSelector('#pm-current-kg');
  assert.match(await title(), /Leg Press/);
  assert.equal(await page.inputValue('#pm-current-kg'), '30');
  assert.equal(await page.locator('.pm-last-load').count(), 0);
  assert.equal(await page.evaluate(() => document.getElementById('pm-current-reps').inputMode), 'numeric');
  mondayId = (await open(alex)).id;
});

await step('2.2 série 1 validée (30) : repos automatique lancé ; « +15 s » puis « Ignorer »', async () => {
  await validate(alex);
  await page.waitForSelector('.pm-rest-ui:not([hidden])');
  const before = await text('.pm-rest-time');
  await page.click('.pm-rest-actions button:has-text("+15")');
  await page.waitForFunction(b => document.querySelector('.pm-rest-time').innerText !== b, before);
  await page.locator('.pm-rest-actions button:visible', { hasText: /Ignorer|Arrêter/ }).first().click();
});

await step('2.3 séries 2 et 3 à 80 kg (charge réelle) ; − / + sur les répétitions', async () => {
  await validate(alex, 80, 12);
  await page.fill('#pm-current-kg', '80');
  await page.locator('#pm-current-reps').fill('11');
  await page.locator('.pm-stepper', { has: page.locator('#pm-current-reps') }).locator('button').last().click();
  assert.equal(await page.inputValue('#pm-current-reps'), '12', '« + » : 11 → 12');
  await page.locator('.pm-stepper', { has: page.locator('#pm-current-reps') }).locator('button').first().click();
  await page.locator('.pm-stepper', { has: page.locator('#pm-current-reps') }).locator('button').first().click();
  assert.equal(await page.inputValue('#pm-current-reps'), '10');
  await validate(alex);
  assert.deepEqual(await sets(alex, 'leg-press'), [[30, 12, true], [80, 12, true], [80, 10, true]]);
});

await step('2.4 machine occupée (Chest Press) : reportée ; Seated Row faite (1 série) ; fermeture de l’application', async () => {
  await next();
  await page.waitForFunction(() => /Chest Press/.test(document.querySelector('#pm-workout-screen h2')?.innerText || ''));
  await page.click(screen + ' button:has-text("Machine occupée")');
  await page.waitForFunction(() => /Seated Row/i.test(document.querySelector('#pm-workout-screen h2')?.innerText || ''));
  await validate(alex, 27.5, 12);
  await page.fill('#pm-current-kg', '27,5'); // saisie en cours, pas encore validée
  await page.waitForTimeout(700);
  await page.close(); // fermeture brutale de l'application
  page = await context.newPage(); page.setDefaultTimeout(15000); watch(page, errors);
  await page.goto(srv.url);
  await page.waitForSelector(home + ' .pm-home-card:has-text("Séance en cours")');
  assert.match(await text(home + ' .pm-home-card'), /4 séries enregistrées/);
});
await step('2.5 reprise après fermeture : séries validées intactes, saisie non validée retrouvée, machine reportée signalée', async () => {
  await page.click(home + ' .pm-home-card .pm-validate:has-text("Reprendre")');
  if (await page.locator('.pm-modal').count()) await page.click('.pm-modal .pm-primary');
  await page.waitForSelector('#pm-current-kg');
  assert.match(await title(), /Seated Row/i);
  assert.equal(await page.inputValue('#pm-current-kg'), '27,5', 'brouillon retrouvé');
  assert.deepEqual(await sets(alex, 'leg-press'), [[30, 12, true], [80, 12, true], [80, 10, true]], 'aucune série validée perdue');
  assert.match(await text(screen), /reportée/);
  await validate(alex);
});

await step('2.6 retour à la machine reportée ; repos en mode manuel (« Lancer le repos »)', async () => {
  await page.click(screen + ' .pm-footer button:has-text("Machines")');
  await page.click(screen + ' .pm-list-main:has-text("Chest Press")');
  await page.click(screen + ' button:has-text("Y revenir maintenant")');
  await page.waitForSelector('#pm-current-kg');
  await page.selectOption('#pm-rest-mode', 'manual').catch(() => {});
  if (!(await page.locator('#pm-rest-mode').isVisible().catch(() => false))) {
    await page.evaluate(async id => (await import('./js/rest-timer.js')).setRestConfig(id, { mode: 'manual' }), alex);
  }
  await validate(alex, 22.5, 10);
  await page.waitForSelector('.pm-rest-actions button:has-text("Lancer le repos"):visible');
  await page.click('.pm-rest-actions button:has-text("Lancer le repos")');
  await page.waitForSelector('.pm-rest-ui[data-state="running"]');
  await page.locator('.pm-rest-actions button:visible', { hasText: /Arrêter/ }).first().click();
  await page.evaluate(async id => (await import('./js/rest-timer.js')).setRestConfig(id, { mode: 'auto' }), alex);
});

await step('2.7 fin de séance PARTIELLE (cardio non fait) avec ressenti et remarque ; historique et progression', async () => {
  await finish('Bien', 'Leg Press plus facile que prévu (fictif)', true);
  const s = (await sessions(alex)).find(x => x.id === mondayId);
  assert.equal(s.status, 'partial');
  assert.deepEqual([s.feedback.feeling, s.feedback.note], [4, 'Leg Press plus facile que prévu (fictif)']);
  const done = s.activities.filter(a => a.type === 'strength').map(a => a.sets.filter(x => x.done).length);
  assert.deepEqual(done, [3, 1, 2], 'Leg Press 3, Chest Press 1, Seated Row 2');
  await page.click('.nav-btn[data-go="progres"]');
  await page.click('[data-go="historique"]');
  await page.waitForSelector('.pm-history-card');
  assert.match(await text('[data-page="historique"]'), /Partielle/);
  await page.click('.nav-btn[data-go="progres"]');
  await page.waitForSelector('[data-page="progres"] h3:has-text("Vue d’ensemble")');
  assert.match(await text('[data-page="progres"]'), /78,6 kg/);
  await page.reload();
  const again = (await sessions(alex)).find(x => x.id === mondayId);
  assert.deepEqual(again.activities.filter(a => a.type === 'strength').map(a => a.sets.filter(x => x.done).length), [3, 1, 2], 'après rechargement');
});

// ------------------------------------------------------------------ 3. adaptation entre deux séances
await step('3.1 mercredi : séance manquée (rien n’est fait) ; vendredi 13 : séance du jour', async () => {
  await page.clock.setSystemTime(at(13));
  await page.reload();
  await page.waitForSelector(home + ' .pm-next-card h3:has-text("Séance du jour")');
  assert.match(await text(home + ' .pm-next-card'), /Corps entier/);
});

await step('3.2 vendredi : Leg Press préremplie 45 / 80 / 80 (dernière charge réelle), échauffement distinct, rien de validé', async () => {
  await page.click(home + ' .pm-next-card .pm-play');
  await page.waitForSelector(screen + ':not([hidden])');
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  await next();
  await page.waitForSelector('#pm-current-kg');
  assert.match(await text('.pm-last-load-text'), /^Dernière fois : 80 kg × 12/);
  assert.deepEqual(await sets(alex, 'leg-press'), [[45, 12, false], [80, 12, false], [80, 12, false]]);
  assert.match(await text('.pm-current-plan'), /Objectif du programme : 30 kg × 12/);
  const plan = await db(async id => (await (await import('./storage.js')).getProgram(id, '2026-11-09')).days.find(d => d.id === 'vendredi').activities[1].sets.map(x => x.kg), alex);
  assert.deepEqual(plan, [30, 45, 45], 'programme JSON original inchangé');
});

await step('3.3 charges modifiables : 45 validés, 80 validés, 82,5 saisis et validés ; séance COMPLÈTE', async () => {
  await validate(alex);
  await page.locator('.pm-rest-actions button:visible', { hasText: /Ignorer|Arrêter/ }).first().click().catch(() => {});
  await validate(alex);
  await validate(alex, 82.5);
  await next();
  await page.waitForFunction(() => /Rameur/.test(document.querySelector('#pm-workout-screen h2')?.innerText || ''));
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  await finish('Très bien', 'Bonne séance fictive', false);
  const fri = (await sessions(alex)).find(s => s.dayId === 'vendredi');
  assert.equal(fri.status, 'completed');
  assert.deepEqual(fri.activities.find(a => a.machineId === 'leg-press').sets.map(x => [x.kg, x.done]), [[45, true], [80, true], [82.5, true]]);
  assert.deepEqual(fri.activities.find(a => a.machineId === 'leg-press').planned.sets.map(x => x.kg), [30, 45, 45], 'objectif du programme conservé dans la séance');
  const mon = (await sessions(alex)).find(s => s.id === mondayId);
  assert.deepEqual(mon.activities.find(a => a.machineId === 'leg-press').sets.map(x => x.kg), [30, 80, 80], 'séance du lundi inchangée');
});

await step('3.4 semaine suivante : programme importé à l’avance (« Programme prêt »), puis lundi 16 : 82,5 kg préremplis', async () => {
  await importReply(reply(weekA(alex, '2026-11-16')));
  await page.waitForFunction(async id => !!(await (await import('./storage.js')).getProgram(id, '2026-11-16')), alex);
  await page.clock.setSystemTime(at(14));
  await page.reload();
  // samedi : plus de séance prévue cette semaine → prochaine séance dans le programme enregistré + rattrapage du mercredi manqué
  await page.waitForSelector(home + ' h3:has-text("Prochaine séance : semaine du 16 novembre")');
  await page.waitForSelector(home + ' .pm-next-card h3:has-text("Rattraper une séance de cette semaine")');
  assert.match(await text(home + ' .pm-next-card'), /Haut du corps/);
  await page.clock.setSystemTime(at(16));
  await page.reload();
  await page.waitForSelector(home + ' .pm-next-card h3:has-text("Séance du jour")');
  await page.click(home + ' .pm-next-card .pm-play');
  await page.waitForSelector(screen + ':not([hidden])');
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  await next();
  await page.waitForSelector('#pm-current-kg');
  assert.match(await text('.pm-last-load-text'), /^Dernière fois : 82,5 kg × 12/);
  assert.deepEqual(await sets(alex, 'leg-press'), [[45, 12, false], [82.5, 12, false], [82.5, 12, false]]);
  await page.click('button:has-text("Revenir à la charge du programme")');
  await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id)).activities[1].sets[1].kg === 45, alex);
  await page.click('button:has-text("Reprendre mes dernières charges")');
  await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id)).activities[1].sets[1].kg === 82.5, alex);
  await validate(alex); await validate(alex);
  await page.locator('.pm-rest-actions button:visible', { hasText: /Ignorer|Arrêter/ }).first().click().catch(() => {});
  await finish('Correct', 'Fatigue en fin de séance (fictif)', true);
});

await step('3.5 séance libre : Leg Press ajoutée avec la dernière charge réelle (82,5), modifiable', async () => {
  await page.click('.nav-btn[data-go="accueil"]');
  await page.click(home + ' button:has-text("Séance libre")');
  await page.waitForSelector(screen + ' button:has-text("Ajouter une machine")');
  await page.click(screen + ' button:has-text("Ajouter une machine")');
  await page.locator('.pm-modal select').selectOption('leg-press');
  const vals = await page.evaluate(() => [...document.querySelectorAll('.pm-modal .pm-input')].map(i => i.value));
  assert.deepEqual(vals.slice(1, 3), ['82,5', '12']);
  await page.locator('.pm-modal .pm-input').nth(1).fill('85');
  await page.click('.pm-modal .pm-modal-btn:has-text("Ajouter")');
  await page.waitForFunction(async id => (await (await import('./js/workouts.js')).getResumableWorkout(id))?.activities.some(a => a.machineId === 'leg-press'), alex);
  await page.click(screen + ' .pm-list-main:has-text("Leg Press")').catch(() => {});
  await page.waitForSelector('#pm-current-kg');
  assert.equal(await page.inputValue('#pm-current-kg'), '85');
  await validate(alex);
  await finish('Bien', 'Séance libre fictive', true);
});

// ------------------------------------------------------------------ 4. deux profils indépendants (deux téléphones)
const weekB = (id, weekStart) => ({ schemaVersion: 1, weekStart, programs: { [id]: { days: [
  { id: 'lundi', name: 'Endurance fictive', activities: [
    { type: 'cardio', name: 'Rameur', durationMinutes: 25 },
    { type: 'strength', machineId: 'leg-press', shared: false, restSeconds: 45, sets: [{ kg: 20, reps: 15 }, { kg: 20, reps: 15 }] }] }] } } });
let alexSnap;
await step('4.1 deuxième profil « Sam fictif » (endurance, perte de graisse) : profil sportif et poids propres', async () => {
  alexSnap = await db(async id => { const d = await (await import('./storage.js')).exportProfileData(id); delete d.exportedAt; return JSON.stringify(d); }, alex);
  await page.click('#switch-profile');
  await page.waitForSelector('#screen-select:not([hidden])');
  await page.click('#create-profile'); await page.fill('#new-profile-name', 'Sam fictif'); await page.click('#create-profile-submit');
  await page.waitForFunction(id => /^p-/.test(document.documentElement.dataset.pmProfile || '') && document.documentElement.dataset.pmProfile !== id, alex);
  sam = await db(() => document.documentElement.dataset.pmProfile);
  await page.waitForSelector(home + ' h3:has-text("Aucun programme cette semaine"), ' + home + ' h3:has-text("Ta semaine en 30 secondes")');
  await goProfil();
  const f = await openFold('Mon profil sportif');
  await f.getByLabel('Objectif principal').selectOption('Endurance');
  await f.locator('label.pm-check', { hasText: /^\s*Perte de graisse$/ }).locator('input').check();
  await f.getByLabel('Niveau d’expérience').selectOption('intermediaire');
  await f.getByLabel('Séances par semaine').selectOption('2');
  for (const d of ['Lundi', 'Jeudi']) await f.locator('label.pm-check', { hasText: new RegExp('^\\s*' + d + '$') }).locator('input').check();
  await f.getByLabel('Durée maximale par séance').selectOption('45');
  await f.getByLabel('Fatigue actuelle').selectOption('4');
  await f.locator('#pm-sport-weight').fill('64,2');
  await saveSport(f);
  await goCoach();
  await page.waitForSelector(coach + ' button:has-text("Copier ma demande")');
});

await step('4.2 Sam : programme différent, séance faite ; aucune référence de charge venant d’Alex', async () => {
  await importReply(reply(weekB(sam, '2026-11-16')));
  await page.click('.pm-modal:has-text("Programme incomplet") .pm-modal-btn:has-text("Importer quand même")'); // V2-EVOLUTION-1 : moins de séances que la fréquence du profil → exception explicite
  await page.waitForFunction(async id => !!(await (await import('./storage.js')).getProgram(id, '2026-11-16')), sam);
  await page.click('.nav-btn[data-go="accueil"]');
  await page.click(home + ' .pm-next-card .pm-play');
  await page.waitForSelector(screen + ':not([hidden])');
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  await next();
  await page.waitForSelector('#pm-current-kg');
  assert.equal(await page.inputValue('#pm-current-kg'), '20', 'charge du programme de Sam');
  assert.equal(await page.locator('.pm-last-load').count(), 0, 'les 80 kg d’Alex ne sont jamais proposés à Sam');
  await validate(sam, 25); await validate(sam, 25);
  await finish('Correct', 'Cardio difficile (fictif)', false);
});

await step('4.3 historiques, poids, programmes et charges séparés ; Alex strictement inchangé', async () => {
  const r = await db(async ([a, b]) => {
    const W = await import('./js/workouts.js'); const WT = await import('./js/weights.js'); const S = await import('./storage.js');
    return { sa: (await W.listWorkouts(a)).length, sb: (await W.listWorkouts(b)).length, wa: (await WT.listBodyWeights(a)).map(w => w.kg), wb: (await WT.listBodyWeights(b)).map(w => w.kg),
      pa: (await S.getProgram(a, '2026-11-16')).days.map(d => d.name), pb: (await S.getProgram(b, '2026-11-16')).days.map(d => d.name) };
  }, [alex, sam]);
  assert.deepEqual(r, { sa: 4, sb: 1, wa: [78.6], wb: [64.2], pa: ['Bas du corps', 'Haut du corps', 'Corps entier'], pb: ['Endurance fictive'] });
  const now = await db(async id => { const d = await (await import('./storage.js')).exportProfileData(id); delete d.exportedAt; return JSON.stringify(d); }, alex);
  assert.equal(now, alexSnap, 'aucune donnée d’Alex modifiée par Sam');
});

let samFile;
await step('4.4 sauvegarde individuelle de Sam (fichier), restauration « Remplacer tout » ; refus dans le profil d’Alex', async () => {
  await goProfil();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-page="profil"] button:has-text("Sauvegarder maintenant")')]);
  samFile = await dl.path();
  assert.match(dl.suggestedFilename(), /\.json$/);
  await db(async id => (await import('./js/weights.js')).addBodyWeight(id, 63.9, '2026-11-16'), sam);
  await page.setInputFiles('input[aria-label="Fichier de sauvegarde à restaurer"]', samFile);
  await page.click('button:has-text("Restaurer ce fichier")');
  await page.click('.pm-modal .pm-modal-btn:has-text("Remplacer tout")');
  await page.click('.pm-modal .pm-modal-btn:has-text("Remplacer")');
  await page.waitForFunction(async id => (await (await import('./js/weights.js')).listBodyWeights(id)).length === 1, sam);
  assert.equal((await sessions(sam)).length, 1, 'séance de Sam restaurée');
  await page.evaluate(id => document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: id } })), alex);
  await page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, alex);
  await goProfil();
  await page.setInputFiles('input[aria-label="Fichier de sauvegarde à restaurer"]', samFile);
  await page.click('button:has-text("Restaurer ce fichier")');
  await page.waitForSelector('[data-page="profil"] p:has-text("Restauration impossible")');
  const now = await db(async id => { const d = await (await import('./storage.js')).exportProfileData(id); delete d.exportedAt; return JSON.stringify(d); }, alex);
  assert.equal(now, alexSnap, 'la sauvegarde de Sam ne touche jamais Alex');
});

// ------------------------------------------------------------------ 5. mobile et hors ligne
await step('5.1 petit écran (320 px) : aucun débordement, boutons de validation ≥ 44 px, champs numériques', async () => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const tab of ['accueil', 'programme', 'progres', 'historique', 'profil']) {
    await page.click({ historique: '.pm-subtab', profil: '.pm-settings-btn' }[tab] ? ({ historique: '.pm-subtab', profil: '.pm-settings-btn' }[tab] + '[data-go="' + tab + '"]') : '.nav-btn[data-go="' + tab + '"]');
    await page.waitForTimeout(300);
    assert.equal(await noOverflow(), true, 'onglet ' + tab);
  }
  await page.click('.nav-btn[data-go="accueil"]');
  await page.click(home + ' button:has-text("Séance libre")');
  await page.click(screen + ' button:has-text("Ajouter une machine")');
  await page.locator('.pm-modal select').selectOption('chest-press');
  await page.click('.pm-modal .pm-modal-btn:has-text("Ajouter")');
  await page.click(screen + ' .pm-list-main:has-text("Chest Press")').catch(() => {});
  await page.waitForSelector('#pm-current-kg');
  assert.equal(await noOverflow(), true, 'écran de séance');
  const h = await page.evaluate(() => [document.getElementById('pm-validate-set'), ...document.querySelectorAll('.pm-stepper button')].map(b => Math.round(b.getBoundingClientRect().height)));
  assert.ok(h.every(x => x >= 44), 'zones tactiles : ' + h.join(', '));
  const box = await page.locator('#pm-validate-set').boundingBox();
  assert.ok(box.y + box.height <= 640, 'bouton de validation visible sans défiler');
});

await step('5.2 arrière-plan pendant un repos : au retour, le chrono a avancé et la séance est intacte', async () => {
  await validate(alex);
  await page.waitForSelector('.pm-rest-ui[data-state="running"]');
  const before = await text('.pm-rest-time');
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.runFor(20000);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(b => document.querySelector('.pm-rest-time')?.innerText !== b, before);
  assert.equal(await doneCount(alex), 1);
});

await step('5.3 hors connexion (après chargement complet) : rechargement, reprise, série validée et conservée', async () => {
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active);
  await networkCut(async () => {
    await context.setOffline(true);
    await page.reload();
    await page.click(home + ' .pm-home-card .pm-validate:has-text("Reprendre")');
    if (await page.locator('.pm-modal').count()) await page.click('.pm-modal .pm-primary');
    await page.waitForSelector('#pm-current-kg');
    await validate(alex);
    await context.setOffline(false);
    await page.reload();
  });
  assert.equal(await doneCount(alex), 2, 'séries enregistrées hors connexion conservées');
});

await step('5.4 mise à jour PWA pendant la séance : jamais proposée en séance ; après la séance, données conservées', async () => {
  await page.click(home + ' .pm-home-card .pm-validate:has-text("Reprendre")');
  if (await page.locator('.pm-modal').count()) await page.click('.pm-modal .pm-primary');
  await page.waitForSelector('#pm-current-kg');
  srv.setSwVersion('9999.01.01-recette1');
  await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
  await page.waitForTimeout(2500);
  assert.equal(await page.locator('.pm-modal:has-text("Mise à jour installée")').count(), 0, 'pas d’interruption de la séance');
  await validate(alex);
  await finish('Bien', 'Séance hors ligne fictive', false);
  await page.waitForSelector('.pm-modal:has-text("Mise à jour installée")');
  await networkCut(() => Promise.all([page.waitForEvent('load'), page.click('.pm-modal-btn:has-text("Redémarrer l’application")')]));
  srv.setSwVersion(null);
  const n = (await sessions(alex)).length;
  assert.equal(n, 5, 'toutes les séances d’Alex conservées après la mise à jour (lundi, vendredi, lundi suivant, 2 séances libres)');
  const last = (await sessions(alex)).find(x => x.feedback?.note === 'Séance hors ligne fictive');
  assert.equal(last.activities[0].sets.filter(x => x.done).length, 3);
});

// ------------------------------------------------------------------ 6. bilan et programme suivant
await step('6.1 Alex : demande pour la semaine du 23 novembre — performances, ressentis, séance manquée, fatigue, poids, jours, durée', async () => {
  await goProfil();
  const f = await openFold('Mon profil sportif');
  await f.getByLabel('Fatigue actuelle').selectOption('4');
  await saveSport(f);
  await goCoach();
  await page.getByLabel('Semaine à préparer').selectOption('2026-11-23');
  await page.click(coach + ' button:has-text("Copier ma demande")');
  await page.waitForSelector('.pm-coach-out:not([hidden])');
  const t = await page.inputValue('.pm-coach-out');
  for (const want of ['Leg Press (leg-press) : dernière fois', '82,5 kg', 'séries validées la dernière fois', 'non faites : mercredi', 'SEMAINE INCOMPLÈTE', 'ressenti moyen',
    'Fatigue actuelle : Fatigué(e)', 'fatigue : Normale → Fatigué(e)', 'Poids : 78,6 kg', 'Poids cible', '82 kg', 'Jours disponibles : lundi, mercredi, vendredi',
    'Durée MAXIMALE disponible par séance : 60 min', 'Objectif principal : Prise de muscle', 'N’invente JAMAIS de référence', 'PAS une grille',
    'Rameur', 'Fatigue en fin de séance (fictif)']) assert.ok(t.includes(want), 'attendu : ' + want);
  const example = JSON.parse(t.slice(t.lastIndexOf('{\n  "schemaVersion"')));
  assert.equal(example.weekStart, '2026-11-23');
  const ok = await db(async ([id, ex]) => { const P = await import('./js/programs.js'); return (await P.prepareProgramImport(id, JSON.stringify(ex), { knownMachineIds: (await (await import('./js/catalog.js')).loadCatalog()).list.map(m => m.id) })).weekStart; }, [alex, example]);
  assert.equal(ok, '2026-11-23', 'le format demandé est importable tel quel');
});

await step('6.2 Sam (endurance) : orientation différente, alimentation, durée 45 min, aucun poids cible inventé', async () => {
  await page.evaluate(id => document.dispatchEvent(new CustomEvent('pm:select-profile', { detail: { profile: id } })), sam);
  await page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, sam);
  await goCoach();
  await page.getByLabel('Semaine à préparer').selectOption('2026-11-23');
  await page.click(coach + ' button:has-text("Copier ma demande")');
  await page.waitForSelector('.pm-coach-out:not([hidden])');
  const t = await page.inputValue('.pm-coach-out');
  for (const want of ['Objectif principal : Endurance — priorité à la capacité cardio-respiratoire', 'Objectif secondaire : Perte de graisse', 'levier principal est l’alimentation',
    'Durée MAXIMALE disponible par séance : 45 min', 'Jours disponibles : lundi, jeudi', 'Poids : 64,2 kg', 'Fatigue actuelle : Fatigué(e)', 'Rameur : 16 novembre 2026 — 25 min']) assert.ok(t.includes(want), 'attendu : ' + want);
  assert.equal(t.includes('Poids cible'), false);
  assert.equal(t.includes('Alex fictif') || t.includes(alex), false, 'aucune donnée d’Alex dans la demande de Sam');
});

await step('aucune requête vers l’extérieur (aucun transfert de données) ; aucune erreur JavaScript', async () => {
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
});

//@@TAIL
const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
