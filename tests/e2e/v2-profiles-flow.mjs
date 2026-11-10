// V2-PROF1 — socle multi-profils dans le navigateur réel : installation V1 avec données → mise à jour → migration
// automatique sans perte ; profil créé par l'API, sélectionné, utilisé, isolé ; redémarrage ; hors ligne ; suppression ;
// démo inchangée. Données FICTIVES, origine locale neuve. node tests/e2e/v2-profiles-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, exampleProgram, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser, context } = await launch();
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = watch(page);

/** Export complet d'un profil (sans l'horodatage d'export) : preuve que ses données n'ont pas bougé. */
const exportOf = id => page.evaluate(async id => {
  const S = await import('./storage.js'); const d = await S.exportProfileData(id); delete d.exportedAt; return JSON.stringify(d);
}, id);
const registry = () => page.evaluate(async () => {
  const S = await import('./storage.js'); const r = await S.loadProfileRegistry();
  return { meta: !!r.meta, ids: r.profiles.map(p => p.id).sort() };
});
const rowsOf = ids => page.evaluate(async ids => (await import('./storage.js')).countProfileRows(ids), ids);
/** Programme d'exemple ; pour un profil créé, son contenu est placé sous SON identifiant (clé du fichier). */
const programFor = id => { const p = exampleProgram(); if (id && !p.programs[id]) p.programs = { [id]: p.programs.pierre }; return p; };
const importViaUi = async id => {
  await page.click('.nav-btn[data-go="programme"]');
  await page.click('.pm-import summary');
  await page.fill('.pm-textarea', JSON.stringify(programFor(id)));
  await page.click('.pm-action-verify');
  await page.waitForSelector('.pm-action-save:not([disabled])');
  await page.click('.pm-action-save');
  await page.waitForSelector('.pm-start-workout');
};

let pierreBefore, manonBefore, extra;

console.log('V2-PROF1 · multi-profils');
await step('installation « V1 » : Pierre importe un programme, poids de Pierre et Manon ; aucun registre écrit', async () => {
  await page.goto(srv.url);
  await page.click('[data-select-profile="pierre"]');
  await importViaUi();
  await page.evaluate(async () => {
    const { addBodyWeight } = await import('./js/weights.js');
    await addBodyWeight('pierre', 81.4, '2026-11-02'); await addBodyWeight('manon', 58.2, '2026-11-03');
  });
  assert.deepEqual(await registry(), { meta: false, ids: [] }, 'démarrage sans écriture de registre');
  pierreBefore = await exportOf('pierre'); manonBefore = await exportOf('manon');
  assert.ok(pierreBefore.includes('81.4') && manonBefore.includes('58.2'));
});

await step('mise à jour / redémarrage : migration automatique, Pierre rouvert, données identiques, identité inchangée', async () => {
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.pmProfile === 'pierre');
  await page.waitForFunction(async () => (await (await import('./storage.js')).loadProfileRegistry()).meta);
  assert.deepEqual(await registry(), { meta: true, ids: ['manon', 'pierre'] });
  assert.equal(await exportOf('pierre'), pierreBefore);
  assert.equal(await exportOf('manon'), manonBefore);
  assert.equal(await page.locator('#switch-profile').getAttribute('aria-label'), 'Changer de profil (Pierre)');
  assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--accent')), '#48a1ff');
  await page.waitForSelector('.pm-home-card');
});

await step('migration rejouée (nouveau redémarrage) : rien d’ajouté, rien de modifié', async () => {
  const before = await page.evaluate(async () => JSON.stringify((await (await import('./storage.js')).loadProfileRegistry())));
  await page.reload(); await page.waitForFunction(() => document.documentElement.dataset.pmProfile === 'pierre');
  const after = await page.evaluate(async () => JSON.stringify((await (await import('./storage.js')).loadProfileRegistry())));
  assert.equal(after, before);
  assert.equal(await exportOf('pierre'), pierreBefore);
});

await step('profil créé par l’API puis sélectionné : même chemin que les boutons, identité appliquée', async () => {
  extra = await page.evaluate(async () => {
    const P = await import('./js/profiles.js');
    const p = await P.createProfile({ name: 'Camille fictive', goal: 'Cardio', color: 'turquoise' });
    P.selectProfile(p.id); return p.id;
  });
  assert.match(extra, /^p-[a-z0-9]+-[0-9a-f]{8}$/);
  await page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, extra);
  assert.equal(await page.locator('#switch-profile').getAttribute('aria-label'), 'Changer de profil (Camille fictive)');
  assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--accent')), '#14e6c7');
  await page.waitForSelector('.pm-hero-title:has-text("Salut Camille fictive")');
  await page.waitForSelector('[data-page="accueil"] h3:has-text("Aucun programme cette semaine"), [data-page="accueil"] h3:has-text("Ta semaine en 30 secondes")');
});

await step('nouveau profil : import d’un programme et poids, isolés ; Pierre et Manon intacts', async () => {
  await importViaUi(extra);
  assert.ok(await page.evaluate(async id => !!(await (await import('./js/programs.js')).getActiveProgram(id)), extra), 'programme actif du profil créé');
  await page.evaluate(async id => (await import('./js/weights.js')).addBodyWeight(id, 66.6, '2026-11-04'), extra);
  const mine = await exportOf(extra);
  assert.ok(mine.includes('66.6') && !mine.includes('81.4'));
  assert.equal(await exportOf('pierre'), pierreBefore);
  assert.equal(await exportOf('manon'), manonBefore);
});

await step('renommage : identifiant inchangé, nom affiché à jour sans recharger', async () => {
  await page.evaluate(async id => (await import('./js/profiles.js')).updateProfile(id, { name: 'Camille renommée' }), extra);
  await page.waitForFunction(() => document.querySelector('#switch-profile').getAttribute('aria-label') === 'Changer de profil (Camille renommée)');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.pmProfile), extra);
});

await step('redémarrage puis hors ligne : le dernier profil utilisé (créé) est rouvert avec ses données', async () => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, extra);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(id => document.documentElement.dataset.pmProfile === id, extra);
  await page.waitForSelector('.pm-hero-title:has-text("Salut Camille renommée")');
  await page.waitForSelector('.pm-next-card');
  assert.ok((await exportOf(extra)).includes('66.6'));
  await context.setOffline(false);
});

await step('suppression (API, confirmation explicite) : retour au choix du profil, ses données seules effacées', async () => {
  await assert.rejects(page.evaluate(async id => (await import('./js/profiles.js')).deleteProfile(id), extra), /Confirmation/);
  await assert.rejects(page.evaluate(async () => (await import('./js/profiles.js')).deleteProfile('pierre', { confirm: 'pierre' })), /ne peut pas/);
  await page.evaluate(async id => (await import('./js/profiles.js')).deleteProfile(id, { confirm: id }), extra);
  await page.waitForSelector('#screen-select:not([hidden])');
  assert.equal(await rowsOf([extra]), 0);
  assert.deepEqual(await registry(), { meta: true, ids: ['manon', 'pierre'] });
  assert.equal(await exportOf('pierre'), pierreBefore);
  assert.equal(await exportOf('manon'), manonBefore);
  await page.reload();
  await page.waitForSelector('#screen-select:not([hidden])');
});

await step('restauration d’un profil absent : tout ou rien (échec pendant l’import → ni fiche, ni donnée, ni annonce) ; puis réussite', async () => {
  const r = await page.evaluate(async () => {
    const Bk = await import('./js/backup.js'); const S = await import('./storage.js');
    const id = 'p-restau-atomique';
    const events = [];
    document.addEventListener('pm:profiles-changed', e => events.push(e.detail.reason + ':' + e.detail.id));
    const registryBefore = JSON.stringify((await S.loadProfileRegistry()).profiles.map(p => p.id).sort());
    const pierreBefore = JSON.stringify((await S.exportProfileData('pierre')).data);
    const backup = { format: 'pm-musculation-backup', schemaVersion: 1, profileId: id, profile: { id, name: 'Restauré fictif', color: 'ambre' },
      data: { programs: [], sessions: [], settings: [{ profileId: id, key: 'rest', value: 1 }],
        weights: [{ profileId: id, id: 'w1', data: { id: 'w1', kg: 61 } }, { profileId: id, id: 'w2', data: { id: 'w2', kg: 62, impossible: () => 0 } }] } };
    let failure = null;
    try { await Bk.restoreBackupAsNewProfile(backup); } catch (e) { failure = e.name || e.message; }
    const after = {
      failure, events: [...events],
      registry: JSON.stringify((await S.loadProfileRegistry()).profiles.map(p => p.id).sort()) === registryBefore,
      rows: await S.countProfileRows([id]),
      pierre: JSON.stringify((await S.exportProfileData('pierre')).data) === pierreBefore
    };
    delete backup.data.weights[1].data.impossible; // sauvegarde corrigée : la restauration réussit, une seule annonce
    await Bk.restoreBackupAsNewProfile(backup);
    after.retry = { rows: await S.countProfileRows([id]), events: [...events] };
    await (await import('./js/profiles.js')).deleteProfile(id, { confirm: id });
    return after;
  });
  assert.ok(r.failure, 'échec attendu');
  assert.deepEqual(r.events, [], 'aucune annonce : ' + JSON.stringify(r.events));
  assert.equal(r.registry, true, 'aucune fiche inscrite');
  assert.equal(r.rows, 0, 'aucune donnée');
  assert.equal(r.pierre, true);
  assert.equal(r.retry.rows, 3);
  assert.deepEqual(r.retry.events, ['created:p-restau-atomique']);
});

await step('démo : fonctionne comme avant, rien d’écrit en base, registre inchangé', async () => {
  const before = await page.evaluate(async () => JSON.stringify((await (await import('./storage.js')).loadProfileRegistry())));
  await page.click('[data-select-profile="demo"]'); await page.waitForSelector('.pm-home-card');
  await page.click('.nav-btn[data-go="progres"]'); await page.click('.pm-subtab[data-go="historique"]');
  await page.waitForSelector('.pm-history-card');
  assert.equal(await rowsOf(['demo']), 0);
  assert.equal(await page.evaluate(async () => JSON.stringify((await (await import('./storage.js')).loadProfileRegistry()))), before);
  assert.equal(await exportOf('pierre'), pierreBefore);
});

await step('aucune erreur JavaScript', async () => { assert.deepEqual(errors, []); });

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
