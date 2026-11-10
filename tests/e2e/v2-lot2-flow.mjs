// V2-UX LOT 2 — premier lancement et assistant « Préparer ma semaine » (Chromium 390 px, horloge simulée, données FICTIVES) :
// David (nouvel utilisateur qui connaît la musculation) : création → « Ta semaine en 30 secondes » (5 choix) → Accueil
// « Préparer ma semaine » → ① Copier ma demande → ② Coller la réponse (presse-papiers) → ③ aperçu → Importer → séance du jour.
// Puis : semaine bientôt finie → « Préparer la semaine prochaine ». Aucune requête externe ; Pierre et Manon jamais touchés.
// node tests/e2e/v2-lot2-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(srv.url).origin });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);
const external = [];
page.on('request', r => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && !['127.0.0.1', 'localhost'].includes(u.hostname)) external.push(r.url()); }); // blob: (sons locaux) exclus
const db = (fn, arg) => page.evaluate(fn, arg);
const home = '[data-page="accueil"]', screen = '#pm-workout-screen', coach = '[data-page="programme"] .pm-coach-section';
const qs = home + ' .pm-quick-start';
const noOverflow = () => db(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const setting = (id, k) => db(async ([id, k]) => (await import('./storage.js')).getSetting(id, k, null), [id, k]);
const chip = (legend, label) => page.locator(qs + ' fieldset', { has: page.locator('legend', { hasText: legend }) }).locator('label.pm-qs-chip', { hasText: new RegExp('^\\s*' + label + '\\s*$') });
let david, prompt;

const reply = (id, weekStart, days) => 'Voici ton programme : 2 séances complètes, charges réelles.\nProgression prudente.\n\n```json\n' + JSON.stringify({ schemaVersion: 1, weekStart, programs: { [id]: { days: days.map(d => ({ id: d, name: 'Séance ' + d + ' fictive', activities: [
  { type: 'warmup', name: 'Vélo assis', durationMinutes: 5 },
  { type: 'strength', machineId: 'leg-press', shared: false, restSeconds: 90, sets: [{ kg: 70, reps: 8 }, { kg: 70, reps: 8 }] },
  { type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 90, sets: [{ kg: 40, reps: 8 }] }] })) } } }, null, 2) + '\n```\n';

console.log('V2-UX · LOT 2 + FINALISATION : installation vierge, inscription guidée, premier accueil, « Préparer ma semaine »');
const ob = '#screen-onboarding:not([hidden]) .pm-onboarding';
const obChip = label => page.click(ob + ' label.pm-qs-chip:has(span:text-is("' + label + '"))');
const obNext = () => page.click(ob + ' button:has-text("Suivant")');
const obTitle = () => page.locator(ob + ' #pm-ob-title').innerText();
await step('installation vierge : « Bienvenue sur PM Musculation », Créer mon profil + mode Démo, AUCUN profil précréé', async () => {
  await page.clock.install({ time: new Date(2026, 10, 10, 10, 0, 0) }); // mardi 10 novembre 2026
  await page.goto(srv.url);
  assert.equal(await page.locator('#select-title').innerText(), 'Bienvenue sur PM Musculation');
  for (const id of ['pierre', 'manon']) assert.equal(await page.locator('[data-select-profile="' + id + '"]').isVisible(), false, id + ' absent');
  assert.equal(await page.locator('[data-user-profile]').count(), 0);
  assert.equal(await page.locator('#create-profile').innerText(), '+ Créer mon profil');
  assert.match(await page.locator('[data-select-profile="demo"]').innerText(), /Essayer le mode Démo/);
  assert.doesNotMatch(await page.locator('body').innerText(), /Pierre|Manon/, 'aucun nom personnel affiché');
  assert.equal(await db(async () => (await import('./storage.js')).countProfileRows(['pierre', 'manon'])), 0);
  assert.equal(await noOverflow(), true);
});

await step('étape 1 (prénom) puis inscription guidée : pas d’Accueil ni de barre tant que l’obligatoire manque', async () => {
  await page.click('#create-profile'); await page.fill('#new-profile-name', 'David fictif'); await page.click('#create-profile-submit');
  await page.waitForFunction(() => /^p-/.test(document.documentElement.dataset.pmProfile || ''));
  david = await db(() => document.documentElement.dataset.pmProfile);
  await page.waitForSelector(ob);
  assert.equal(await obTitle(), 'Ton objectif principal');
  assert.match(await page.locator(ob + ' .eyebrow').innerText(), /ÉTAPE 2 \/ 7/i);
  for (const sel of ['#bottom-nav', '#open-settings', '[data-page="accueil"]']) assert.equal(await page.locator(sel).isVisible(), false, sel + ' masqué');
  assert.ok(await page.locator(ob + ' .pm-mascot').count() === 1, 'Korv présent (ASCENT)');
});

await step('validation : « Suivant » sans choix → message, rien d’enregistré ; « Retour » vers le prénom (corrigeable)', async () => {
  await obNext();
  await page.waitForSelector(ob + ' .pm-coach-status:has-text("Choisis un objectif")');
  assert.equal(await setting(david, 'coach.profile'), null);
  await page.click(ob + ' button:has-text("Retour")');
  await page.waitForSelector(ob + ' #pm-ob-name');
  assert.equal(await page.inputValue('#pm-ob-name'), 'David fictif');
  await page.fill('#pm-ob-name', 'David F. fictif'); await obNext();
  await page.waitForFunction(() => /David F\. fictif/.test(document.getElementById('switch-profile').innerText));
  assert.equal(await obTitle(), 'Ton objectif principal');
});

await step('objectif (Force), ancienneté (Moins de 3 mois) ; inscription INTERROMPUE (rechargement) → reprise à la bonne étape', async () => {
  await obChip('Force'); await obNext();
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("ancienneté")');
  await obChip('Moins de 3 mois'); await obNext();
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("intensité")');
  await page.reload();
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("intensité")');
  assert.equal(await page.locator('#bottom-nav').isVisible(), false);
  const s = await setting(david, 'coach.profile');
  assert.deepEqual([s.mainGoal, s.seniority, s.level], ['Force', 'lt3m', 'debutant'], 'étapes terminées enregistrées');
});

await step('intensité Hard avec 3 mois d’ancienneté, mardi + jeudi (fréquence 2, réductible), 75 min', async () => {
  await obChip('Hard / élevée — RPE 8-9 (1 à 2 en réserve)'); await obNext();
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("jours")');
  await obChip('Mar'); await obChip('Jeu');
  assert.equal(await page.inputValue('#pm-ob-freq'), '2', 'séances = jours cochés');
  assert.deepEqual(await page.locator('#pm-ob-freq option').allInnerTexts(), ['1 (parmi ces jours)', '2 (un par jour coché)']);
  for (const c of await page.locator(ob + ' label.pm-qs-chip').all()) { const b = await c.boundingBox(); assert.ok(b.height >= 44, 'pastille ≥ 44 px'); }
  await obNext();
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("Durée")');
  assert.match(await page.locator(ob).innerText(), /une limite, pas une durée à remplir/);
  await obChip('75 min'); await obNext();
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("facultatif")');
});

await step('dernière étape FACULTATIVE : poids et contrainte renseignés → « Terminer » → premier Accueil', async () => {
  assert.equal(await page.locator(ob + ' button:has-text("Passer cette étape")').count(), 1);
  await page.fill('#pm-ob-weight', '72,5');
  await page.fill('#pm-ob-constraints', 'Épaule droite fragile (fictif)');
  await page.click(ob + ' button:has-text("Terminer")');
  await page.waitForSelector(home + ' .pm-welcome-card');
  const s = await setting(david, 'coach.profile');
  assert.deepEqual([s.mainGoal, s.seniority, s.intensity, s.days, s.frequency, s.durationMin, s.constraints], ['Force', 'lt3m', 'elevee', ['mardi', 'jeudi'], 2, 75, 'Épaule droite fragile (fictif)']);
  assert.deepEqual(await db(async id => (await (await import('./js/weights.js')).listBodyWeights(id)).map(w => w.kg), david), [72.5]);
  assert.equal(await page.locator('#bottom-nav').isVisible(), true);
  assert.equal(await page.locator('#screen-onboarding').isVisible(), false);
});

await step('premier Accueil : trois possibilités DANS L’ORDRE (séance libre, mes charges, programme ChatGPT), visibles sans défiler', async () => {
  const opts = (await page.locator(home + ' .pm-welcome-card .pm-welcome-opt strong').allInnerTexts());
  assert.deepEqual(opts, ['Une séance libre', 'Mes charges', 'Mon programme']);
  const btns = await page.locator(home + ' .pm-welcome-card button').allInnerTexts();
  assert.deepEqual(btns, ['Commencer une séance libre', 'Renseigner mes charges', 'Préparer mon programme avec ChatGPT']);
  assert.ok((await page.locator(home + ' .pm-welcome-card').boundingBox()).y < 844);
  assert.equal(await page.locator(home + ' .pm-progress-home').count(), 0, 'pas de chiffres à zéro pour un nouveau profil');
  await page.reload(); await page.waitForSelector(home + ' .pm-welcome-card');
  assert.equal(await page.locator('#screen-onboarding').isVisible(), false, 'jamais redemandé après la fin');
});

await step('« Préparer mon programme avec ChatGPT » : assistant en 3 étapes, semaine EN COURS proposée (aucun programme)', async () => {
  await page.click(home + ' .pm-welcome-card button:has-text("Préparer mon programme avec ChatGPT")');
  await page.waitForSelector(coach + ' button:has-text("Copier ma demande")');
  assert.equal(await page.inputValue(coach + ' select'), '2026-11-09', 'semaine en cours sans programme');
  const t = await page.locator(coach).innerText();
  for (const want of ['Préparer ma semaine', 'Copie ta demande', 'Ouvrir ChatGPT', 'Coller la réponse de ChatGPT', 'Importer ce programme']) assert.ok(t.includes(want), want);
  assert.equal(await page.getAttribute(coach + ' a.pm-coach-open', 'href'), 'https://chatgpt.com/');
  assert.equal(await page.getAttribute(coach + ' a.pm-coach-open', 'target'), '_blank');
});

await step('① « Copier ma demande » : rédigée ET copiée en un appui (profil, Hard RPE 8-9, 2 séances exigées)', async () => {
  await page.click(coach + ' button:has-text("Copier ma demande")');
  await page.waitForSelector(coach + ' .pm-coach-status:has-text("Demande copiée")');
  prompt = await page.inputValue('.pm-coach-out');
  assert.equal(await db(() => navigator.clipboard.readText()), prompt, 'demande dans le presse-papiers');
  for (const want of ['Objectif principal : Force', 'Ancienneté en musculation : Moins de 3 mois', 'HARD — RPE 8 à 9', 'Ne réduis PAS toutes les charges', 'Prépare EXACTEMENT 2 séances', 'mardi, jeudi', '75 min', 'Épaule droite fragile (fictif)', '"weekStart": "2026-11-09"']) assert.ok(prompt.includes(want), want);
});

await step('② « Coller » avec la demande encore copiée : refus clair, cadre d’import ouvert, rien d’importé', async () => {
  await page.click(coach + ' button:has-text("Coller la réponse de ChatGPT")');
  await page.waitForSelector(coach + ' .pm-coach-status:has-text("contient encore ta demande")');
  assert.equal(await page.locator('.pm-import').evaluate(d => d.open), true);
  assert.equal(await page.inputValue('.pm-textarea'), '');
});

await step('② réponse de ChatGPT copiée → « Coller » : vérifiée automatiquement ; ③ « Importer ce programme » → séance du jour', async () => {
  await db(t => navigator.clipboard.writeText(t), reply(david, '2026-11-09', ['mardi', 'jeudi']));
  await page.click(coach + ' button:has-text("Coller la réponse de ChatGPT")');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  assert.match(await page.locator('#pm-import-feedback').innerText(), /Programme vérifié/);
  await page.click('.pm-action-save');
  await page.waitForFunction(async id => !!(await (await import('./storage.js')).getProgram(id, '2026-11-09')), david);
  await page.click('.nav-btn[data-go="accueil"]');
  await page.waitForSelector(home + ' .pm-next-card h3:has-text("Séance du jour")');
  const card = await page.locator(home + ' .pm-next-card').boundingBox();
  assert.ok(card.y < 844, 'séance du jour visible sans défiler');
});

await step('séance faite avec les charges du programme, puis Progression affichée sur l’accueil', async () => {
  await page.click(home + ' .pm-next-card .pm-play');
  await page.click(screen + ' .pm-validate:has-text("Fait")');
  await page.click(screen + ' .pm-validate:has-text("Machine suivante")');
  await page.waitForSelector('#pm-current-kg');
  assert.equal(await page.inputValue('#pm-current-kg'), '70');
  await page.click('#pm-validate-set'); await page.waitForTimeout(200);
  await page.click(screen + ' .pm-footer button:has-text("Terminer")');
  await page.waitForSelector(screen + ' h2:has-text("Récapitulatif")');
  await page.click(screen + ' .pm-validate:has-text("Valider ma séance")');
  await page.click('.pm-modal .pm-primary');
  await page.waitForSelector(screen + ' .pm-done-icon');
  await page.locator('.pm-levelup-overlay .pm-primary').click({ timeout: 1500 }).catch(() => {});
  await page.click(screen + ' button:has-text("Voir l’historique")');
  await page.click('.nav-btn[data-go="accueil"]');
  await page.waitForSelector(home + ' .pm-progress-home');
});

await step('samedi 14 novembre : « Préparer la semaine prochaine » → assistant sur la semaine du 16 novembre', async () => {
  await page.clock.setFixedTime(new Date(2026, 10, 14, 10, 0, 0));
  await page.reload(); await page.waitForSelector(home + ' .pm-next-week');
  await page.click(home + ' .pm-next-week button:has-text("Préparer la semaine du 16 novembre")');
  await page.waitForSelector(coach + ' button:has-text("Copier ma demande")');
  assert.equal(await page.inputValue(coach + ' select'), '2026-11-16');
  await page.click(coach + ' button:has-text("Copier ma demande")');
  await page.waitForSelector(coach + ' .pm-coach-status:has-text("Demande copiée")');
  const t = await page.inputValue('.pm-coach-out');
  assert.ok(t.includes('"weekStart": "2026-11-16"') && t.includes('Leg Press'), 'semaine suivante et dernières charges');
});

await step('Réglages : le profil sportif contient les choix rapides ; « Préparer ma semaine → » ramène à l’assistant', async () => {
  await page.click('#open-settings');
  const f = page.locator('.pm-sport-fold'); if (!(await f.evaluate(d => d.open))) await f.locator('summary').click();
  assert.equal(await page.inputValue('#pm-sport-mainGoal'), 'Force');
  assert.equal(await page.inputValue('#pm-sport-seniority'), 'lt3m', 'ancienneté modifiable dans Réglages');
  await f.locator('.pm-to-coach').click();
  await page.waitForSelector(coach + ' button:has-text("Copier ma demande")');
});

await step('second profil : étape facultative PASSÉE (rien de bloquant) → premier Accueil ; séance libre immédiatement possible', async () => {
  await page.click('#switch-profile');
  assert.equal(await page.locator('#select-title').innerText(), 'Choisis ton profil');
  await page.click('#create-profile'); await page.fill('#new-profile-name', 'Eve fictive'); await page.click('#create-profile-submit');
  await page.waitForSelector(ob);
  await obChip('Remise en forme'); await obNext();
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("ancienneté")'); await obChip('Plus d’un an'); await obNext();
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("intensité")'); await obNext(); // « Soutenue » préchoisie
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("jours")'); await obChip('Lun'); await obChip('Mer'); await obChip('Ven');
  await page.selectOption('#pm-ob-freq', '2'); await obNext(); // moins de séances que de jours disponibles
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("Durée")'); await obChip('45 min'); await obNext();
  await page.waitForSelector(ob + ' #pm-ob-title:has-text("facultatif")');
  await page.click(ob + ' button:has-text("Passer cette étape")');
  await page.waitForSelector(home + ' .pm-welcome-card');
  const eve = await db(() => document.documentElement.dataset.pmProfile);
  const s = await setting(eve, 'coach.profile');
  assert.deepEqual([s.mainGoal, s.seniority, s.level, s.intensity, s.days, s.frequency, s.durationMin, s.constraints], ['Remise en forme', 'gt1y', 'confirme', 'soutenue', ['lundi', 'mercredi', 'vendredi'], 2, 45, '']);
  await page.click(home + ' .pm-welcome-card button:has-text("Commencer une séance libre")');
  await page.waitForSelector(screen + ':not([hidden]) button:has-text("Ajouter une machine")');
});

await step('320 px sans débordement ; aucune requête externe ; Pierre et Manon intacts ; aucune erreur JS', async () => {
  await page.reload(); await page.waitForSelector('#bottom-nav:not([hidden])'); // séance libre d'Eve laissée en cours (reprise possible)
  await page.setViewportSize({ width: 320, height: 640 });
  await page.click('.nav-btn[data-go="programme"]'); assert.equal(await noOverflow(), true);
  await page.click('.nav-btn[data-go="accueil"]'); assert.equal(await noOverflow(), true);
  assert.deepEqual(external, []);
  assert.equal(await db(async () => (await import('./storage.js')).countProfileRows(['pierre', 'manon'])), 0);
  assert.deepEqual(errors, []);
});

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
