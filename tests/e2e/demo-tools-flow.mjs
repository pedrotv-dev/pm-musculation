// V1-DEV1 — « Outils de test » du profil Démo : aperçus (Mode A), simulation réelle (Mode B), isolation des profils,
// à 320×568, 375×667 et 390×844.  node tests/e2e/demo-tools-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';
import { fixedClock } from '../helpers/fixed-clock.mjs';

// La séance en cours de la Démo suit le programme du JOUR (capacité d'une montée de niveau) : jour de référence fixe
// (vendredi), le temps continue de s'écouler. Résultat identique quel que soit le jour réel.
const REFERENCE_DAY = process.env.DEMO_TEST_NOW || '2026-11-13T18:00:00';

const SIZES = [[320, 568], [375, 667], [390, 844]];
const srv = await serve();
const { browser } = await launch();
const tools = '.pm-demo-tools';
const preview = '.pm-demo-preview';

for (const [w, h] of SIZES) {
  console.log(`\n${w}×${h}`);
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  await context.addInitScript(fixedClock, REFERENCE_DAY);
  // journal des animations réellement lancées (js/effets.js passe par Element.animate)
  await context.addInitScript(() => {
    window.__anims = [];
    const a = Element.prototype.animate;
    Element.prototype.animate = function (...args) { window.__anims.push(String(this.className || this.tagName)); return a.apply(this, args); };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = watch(page);
  const anims = () => page.evaluate(() => window.__anims.splice(0));
  const demoSnapshot = () => page.evaluate(async () => JSON.stringify(await (await import('./js/workouts.js')).listWorkouts('demo')));
  const idbProfiles = () => page.evaluate(async () => {
    const dbs = (await indexedDB.databases()).map(d => d.name).filter(n => /^pm-musculation/.test(n));
    const out = {};
    for (const name of dbs) {
      const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      for (const store of db.objectStoreNames) {
        const rows = await new Promise(res => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => res([]); });
        for (const row of rows) { const p = row.profileId || (Array.isArray(row.key) ? row.key[0] : '?'); out[p] = (out[p] || 0) + 1; }
      }
      db.close();
    }
    return out;
  });
  const openTools = async () => {
    await page.click('.nav-btn[data-go="profil"]');
    await page.waitForSelector(tools);
    if (!(await page.locator(tools).evaluate(d => d.open))) await page.click(tools + ' > summary');
  };
  const closePreview = async () => { await page.click(preview + ' button:has-text("Fermer l’aperçu")'); await page.waitForSelector(preview, { state: 'detached' }); };

  await page.goto(srv.url);
  const exportOf = p => page.evaluate(async p => { const d = await (await import('./storage.js')).exportProfileData(p); delete d.exportedAt; return JSON.stringify(d); }, p);
  let realBefore;

  await step(`préparation : historiques préexistants pour Pierre et Manon (séances terminées en base) (${w} px)`, async () => {
    await page.click('[data-select-profile="pierre"]');
    await page.waitForSelector('.nav-btn[data-go="accueil"]');
    await page.evaluate(async () => {
      const { importProgram } = await import('./js/programs.js'); const W = await import('./js/workouts.js');
      const src = { schemaVersion: 1, weekStart: '2026-11-09', programs: {} };
      for (const p of ['pierre', 'manon']) src.programs[p] = { days: [{ id: 'mardi', name: 'Réel ' + p, activities: [
        { type: 'strength', machineId: 'chest-press', shared: false, restSeconds: 90, sets: [{ kg: 40, reps: 10 }, { kg: 42.5, reps: 8 }] }] }] };
      for (const p of ['pierre', 'manon']) {
        await importProgram(p, src);
        const s = await W.startWorkout(p, { now: new Date(2026, 10, 10, 10) });
        for (const sid of ['s1', 's2']) await W.logSet(p, s.id, 'a1', sid, { kg: 41, reps: 9 });
        await W.finishWorkout(p, s.id, 'completed', { now: new Date(2026, 10, 10, 10, 40) });
      }
    });
    realBefore = { pierre: await exportOf('pierre'), manon: await exportOf('manon') };
    assert.match(realBefore.pierre, /Réel pierre/); assert.match(realBefore.manon, /Réel manon/);
    await page.click('#switch-profile');
  });

  await step(`isolation : aucun « Outils de test » pour Pierre ni Manon (${w} px)`, async () => {
    for (const p of ['pierre', 'manon']) {
      await page.click('[data-select-profile="' + p + '"]');
      await page.click('.nav-btn[data-go="profil"]');
      await page.waitForSelector('[data-page="profil"] .pm-profile-section');
      assert.equal(await page.locator(tools).count(), 0, p);
      assert.equal(await page.locator('text=Outils de test').count(), 0, p);
      await page.click('#switch-profile');
    }
  });

  await step(`isolation : les fonctions refusent d'agir hors Démo, sans rien écrire (${w} px)`, async () => {
    await page.click('[data-select-profile="pierre"]');
    await page.waitForSelector('.nav-btn[data-go="accueil"]');
    const r = await page.evaluate(async () => {
      const t = await import('./js/demo-tools.js');
      const res = { section: t.demoToolsSection() === null };
      try { await t.prepareDemoSession({ complete: true, record: true, levelUp: true }); res.prepare = 'exécuté !'; } catch (e) { res.prepare = e.name; }
      res.pierre = (await (await import('./js/workouts.js')).listWorkouts('pierre')).length;
      return res;
    });
    assert.deepEqual(r, { section: true, prepare: 'NotDemo', pierre: 1 }); // sa séance réelle, intacte
    await page.click('#switch-profile');
  });

  await step(`Démo : section repliée, commandes accessibles (nom, 44 px, champs 16 px), pas de débordement (${w} px)`, async () => {
    await page.click('[data-select-profile="demo"]');
    await page.waitForSelector('.pm-home-card');
    await openTools();
    const r = await page.evaluate(sel => {
      const out = [];
      for (const e of document.querySelectorAll(sel + ' button, ' + sel + ' select, ' + sel + ' input, ' + sel + ' summary')) {
        const b = e.getBoundingClientRect(), name = (e.getAttribute('aria-label') || e.closest('label')?.textContent || e.textContent || '').trim();
        if (!name) out.push('sans nom : ' + e.tagName);
        if (e.type !== 'checkbox' && (b.height < 44 || b.width < 44)) out.push('petit : ' + name.slice(0, 30) + ' ' + Math.round(b.width) + '×' + Math.round(b.height));
        if (e.tagName === 'SELECT' && parseFloat(getComputedStyle(e).fontSize) < 16) out.push('zoom iOS : ' + name.slice(0, 30));
        if (b.right > innerWidth + 0.5) out.push('hors écran : ' + name.slice(0, 30));
      }
      if (document.documentElement.scrollWidth > innerWidth + 1) out.push('page qui déborde');
      return out;
    }, tools);
    assert.deepEqual(r, []);
  });

  const before = await demoSnapshot();

  await step(`Mode A · gain d’XP (3 variantes) et barre d’XP animée (${w} px)`, async () => {
    for (const [g, f] of [['80', '0.1'], ['150', '0.5'], ['400', '0.9']]) {
      await page.selectOption(tools + ' .pm-demo-field:has-text("Gain d’XP") select', g);
      await page.selectOption(tools + ' .pm-demo-field:has-text("Barre d’XP") select', f);
      await anims();
      await page.click(tools + ' button:has-text("Voir le gain d’XP")');
      await page.waitForSelector(preview + ' .pm-reward');
      assert.match(await page.locator(preview + ' .pm-reward-xp').innerText(), new RegExp('\\+' + g + ' XP'));
      await page.waitForTimeout(250);
      assert.ok((await anims()).some(c => /pm-xp-fill/.test(c)), 'barre d’XP non animée');
      if (await page.locator('.pm-levelup-overlay').count()) await page.click('.pm-levelup-overlay button:has-text("Parfait")');
      await closePreview();
    }
  });

  await step(`Mode A · « Niveau supérieur » au niveau choisi, Korv et hexagone animés, « Parfait ! » ferme (${w} px)`, async () => {
    for (const L of ['2', '21', '40']) {
      await page.selectOption(tools + ' .pm-demo-field:has-text("Niveau atteint") select', L);
      await anims();
      await page.click(tools + ' button:has-text("Voir « Niveau supérieur »")');
      await page.waitForSelector('.pm-levelup-overlay');
      assert.equal(await page.locator('.pm-levelup-overlay .pm-hex-value').innerText(), L);
      await page.waitForTimeout(250);
      const a = await anims();
      assert.ok(a.some(c => /pm-levelup-hex/.test(c)) && a.some(c => /pm-levelup-korv/.test(c)), 'animations niveau : ' + a);
      const box = await page.locator('.pm-levelup-overlay .pm-modal').boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= w + 0.5, 'plein écran hors largeur');
      await page.click('.pm-levelup-overlay button:has-text("Parfait")');
      await page.waitForSelector('.pm-levelup-overlay', { state: 'detached' });
      await closePreview();
    }
  });

  await step(`Mode A · déblocage d’un grade : « Nouveau grade » annoncé (${w} px)`, async () => {
    await page.selectOption(tools + ' .pm-demo-field:has-text("Nouveau grade") select', '13');
    await page.click(tools + ' button:has-text("Voir le déblocage du grade")');
    await page.waitForSelector('.pm-levelup-overlay');
    assert.match(await page.locator('.pm-levelup-overlay').innerText(), /Nouveau grade : Expert/);
    await page.click('.pm-levelup-overlay button:has-text("Parfait")');
    await closePreview();
  });

  await step(`Mode A · nouvelle médaille : pictogramme choisi, carte « Nouveau badge ! » animée (${w} px)`, async () => {
    for (const id of ['tonne', 'good-feeling', 'streak-8']) {
      await page.selectOption(tools + ' .pm-demo-field:has-text("Médaille") select', id);
      await anims();
      await page.click(tools + ' button:has-text("Voir la nouvelle médaille")');
      await page.waitForSelector(preview + ' .pm-reward-badge');
      assert.equal(await page.locator(preview + ' .pm-reward-badge .pm-medal-ico').getAttribute('data-badge'), id);
      assert.equal(await page.locator(preview + ' .pm-demo-medal-preview .pm-medal-ico').getAttribute('data-badge'), id);
      await page.waitForTimeout(250);
      assert.ok((await anims()).some(c => /pm-reward-badge/.test(c)));
      await closePreview();
    }
  });

  await step(`Mode A · nouveau record : machine choisie, carte animée (${w} px)`, async () => {
    await page.selectOption(tools + ' .pm-demo-field:has-text("Machine du record") select', 'leg-press');
    await anims();
    await page.click(tools + ' button:has-text("Voir le nouveau record")');
    await page.waitForSelector(preview + ' .pm-reward-record');
    assert.match(await page.locator(preview + ' .pm-reward-record').innerText(), /Leg Press/);
    await page.waitForTimeout(250);
    assert.ok((await anims()).some(c => /pm-reward-record/.test(c)));
    await closePreview();
  });

  await step(`Mode A · fin de séance complète puis partielle (bandeau, récompense, passage de niveau en option) (${w} px)`, async () => {
    await page.selectOption(tools + ' .pm-demo-field:has-text("Fin de séance") select', 'complete');
    await page.locator(tools + ' .pm-demo-check:has-text("avec passage de niveau")').first().locator('input').check();
    await page.click(tools + ' button:has-text("Voir la récompense de fin de séance")');
    await page.waitForSelector('.pm-levelup-overlay');
    assert.match(await page.locator(preview + ' .pm-done-hero h2').innerText(), /Séance terminée/);
    await page.click('.pm-levelup-overlay button:has-text("Parfait")');
    await closePreview();
    await page.selectOption(tools + ' .pm-demo-field:has-text("Fin de séance") select', 'partial');
    await page.locator(tools + ' .pm-demo-check:has-text("avec passage de niveau")').first().locator('input').uncheck();
    await page.click(tools + ' button:has-text("Voir la récompense de fin de séance")');
    await page.waitForSelector(preview + ' .pm-done-hero');
    assert.match(await page.locator(preview + ' .pm-done-hero h2').innerText(), /Séance partielle enregistrée/);
    assert.match(await page.locator(preview + ' .pm-reward').innerText(), /Fin de séance\s*\+25/);
    assert.equal(await page.locator('.pm-levelup-overlay').count(), 0);
    await closePreview();
  });

  await step(`Mode A · aucune donnée modifiée (séances Démo identiques, rien en IndexedDB pour Démo) (${w} px)`, async () => {
    assert.equal(await demoSnapshot(), before);
    assert.equal((await idbProfiles()).demo, undefined);
  });

  await step(`garde-fou à chaque action : profil changé sous le menu affiché → refus, aucun aperçu (${w} px)`, async () => {
    await page.evaluate(() => { document.documentElement.dataset.pmProfile = 'pierre'; });
    await page.click(tools + ' button:has-text("Voir le gain d’XP")');
    await page.waitForTimeout(300);
    await page.waitForSelector('.pm-modal:has-text("Simulation non lancée")');
    assert.equal(await page.locator(preview).count(), 0);
    assert.match(await page.locator('.pm-modal').innerText(), /réservés au profil Démo/);
    await page.click('.pm-modal .pm-primary');
    await page.evaluate(() => { document.documentElement.dataset.pmProfile = 'demo'; });
  });

  await step(`Mode B · séance fictive complète (record, niveau, « Séance au top ») : vrai récapitulatif puis vraie récompense (${w} px)`, async () => {
    const lvl = await page.evaluate(async () => (await import('./js/gamification.js')).computeProgress(await (await import('./js/workouts.js')).listWorkouts('demo')).level);
    await page.selectOption(tools + ' .pm-demo-field:has-text("Issue") select', 'complete');
    await page.locator(tools + ' .pm-demo-check:has-text("Ressenti 5 sur 5") input').check();
    await page.click(tools + ' button:has-text("Préparer la séance fictive")');
    await page.waitForSelector('.pm-recap-feedback');
    assert.equal(await page.locator('.pm-feeling[data-v="5"].pm-on').count(), 1);
    await page.click('.pm-validate:has-text("Valider ma séance")');
    await page.waitForSelector('.pm-levelup-overlay'); // séance complète : pas de confirmation, le plein écran arrive
    assert.equal(await page.locator('.pm-levelup-overlay .pm-hex-value').innerText(), String(lvl + 1));
    await page.click('.pm-levelup-overlay button:has-text("Parfait")');
    const reward = await page.locator('#pm-workout-screen .pm-reward').innerText();
    assert.match(await page.locator('#pm-workout-screen .pm-done-hero h2').innerText(), /Séance terminée/);
    assert.match(reward, /Nouveau record !/); assert.match(reward, /Séance au top/);
    await page.click('#pm-workout-screen button:has-text("Continuer")');
    await page.waitForFunction(l => new RegExp('Niveau ' + (l + 1)).test(document.querySelector('.pm-home-card, .pm-level-strip, [data-page="accueil"]')?.innerText || ''), lvl);
  });

  const demoLevel = () => page.evaluate(async () => (await import('./js/gamification.js')).computeProgress(await (await import('./js/workouts.js')).listWorkouts('demo')).level);
  const openCount = () => page.evaluate(async () => (await (await import('./js/workouts.js')).listWorkouts('demo')).filter(s => s.status === 'in_progress').length);

  await step(`Mode B · 2e simulation complète avec montée (double clic : une seule préparation), ≤ 20 séries par machine (${w} px)`, async () => {
    const lvl = await demoLevel();
    await openTools();
    await page.selectOption(tools + ' .pm-demo-field:has-text("Issue") select', 'complete');
    await page.locator(tools + ' button:has-text("Préparer la séance fictive")').dblclick();
    await page.waitForSelector('.pm-recap-feedback');
    assert.equal(await page.locator('.pm-modal:has-text("déjà en cours")').count(), 0); // le 2e clic n'a rien lancé (bouton désactivé)
    const sets = await page.evaluate(async () => (await (await import('./js/workouts.js')).listWorkouts('demo')).find(s => s.status === 'in_progress').activities.map(a => (a.sets || []).length));
    assert.ok(Math.max(...sets) <= 20, String(sets));
    await page.click('.pm-validate:has-text("Valider ma séance")');
    await page.waitForSelector('.pm-levelup-overlay');
    assert.equal(await page.locator('.pm-levelup-overlay .pm-hex-value').innerText(), String(lvl + 1));
    await page.click('.pm-levelup-overlay button:has-text("Parfait")');
    await page.click('#pm-workout-screen button:has-text("Continuer")');
    assert.equal(await demoLevel(), lvl + 1);
  });

  await step(`Mode B · 3e montée impossible : message clair, aucun récapitulatif, rien de modifié, menu réutilisable (${w} px)`, async () => {
    const before = await demoSnapshot();
    await openTools();
    await page.click(tools + ' button:has-text("Préparer la séance fictive")');
    await page.waitForSelector('.pm-modal:has-text("Simulation non lancée")');
    const msg = await page.locator('.pm-modal').innerText();
    assert.match(msg, /Montée de niveau impossible/); assert.match(msg, /20 séries par machine/); assert.match(msg, /Rien n’a été modifié/);
    await page.click('.pm-modal .pm-primary');
    assert.equal(await page.locator('.pm-recap-feedback').count(), 0);
    assert.equal(await demoSnapshot(), before);
    assert.equal(await openCount(), 0);
    assert.equal(await page.locator(tools + ' button:has-text("Préparer la séance fictive")').isEnabled(), true);
  });

  await step(`Mode B · séance fictive partielle : vraie confirmation puis « Séance partielle enregistrée » (${w} px)`, async () => {
    await openTools();
    await page.selectOption(tools + ' .pm-demo-field:has-text("Issue") select', 'partial');
    await page.locator(tools + ' .pm-demo-check:has-text("avec passage de niveau") >> nth=1').locator('input').uncheck();
    await page.click(tools + ' button:has-text("Préparer la séance fictive")');
    await page.waitForSelector('.pm-recap-feedback');
    await page.click('.pm-validate:has-text("Valider ma séance")');
    await page.waitForSelector('.pm-modal:has-text("Séance partielle")');
    await page.click('.pm-modal .pm-primary');
    await page.waitForSelector('#pm-workout-screen .pm-done-hero');
    assert.match(await page.locator('#pm-workout-screen .pm-done-hero h2').innerText(), /Séance partielle enregistrée/);
    if (await page.locator('.pm-levelup-overlay').count()) await page.click('.pm-levelup-overlay button:has-text("Parfait")');
    await page.click('#pm-workout-screen button:has-text("Continuer")');
  });

  await step(`Mode B · données en mémoire Démo uniquement : rien en IndexedDB pour Démo, historiques de Pierre et Manon identiques (${w} px)`, async () => {
    const idb = await idbProfiles();
    assert.equal(idb.demo, undefined, JSON.stringify(idb));
    const n = await page.evaluate(async () => { const w = await import('./js/workouts.js'); return [(await w.listWorkouts('pierre')).length, (await w.listWorkouts('manon')).length]; });
    assert.deepEqual(n, [1, 1]);
    assert.equal(await exportOf('pierre'), realBefore.pierre, 'Pierre modifié');
    assert.equal(await exportOf('manon'), realBefore.manon, 'Manon modifiée');
  });

  await step(`A · profil changé juste après l’application : « appliquée », aucun récapitulatif ouvert sur Pierre (${w} px)`, async () => {
    await openTools();
    const r = await page.evaluate(async () => {
      const t = await import('./js/demo-tools.js');
      const res = await t.prepareDemoSession({ complete: true }, { afterCommit: () => { document.documentElement.dataset.pmProfile = 'pierre'; } });
      await new Promise(f => setTimeout(f, 400));
      const out = { applied: res.applied, opened: res.opened, workoutVisible: !document.getElementById('pm-workout-screen').hidden };
      document.documentElement.dataset.pmProfile = 'demo';
      return out;
    });
    assert.deepEqual(r, { applied: true, opened: false, workoutVisible: false });
    assert.equal(await page.locator('.pm-modal:has-text("Simulation non lancée")').count(), 0);
  });

  await step(`« Réinitialiser la démo » : retour à l’état de départ (niveau, séances) (${w} px)`, async () => {
    await openTools();
    await page.click('[data-page="profil"] button:has-text("Réinitialiser la démo")');
    await page.click('.pm-modal .pm-primary');
    await page.waitForFunction(async () => { const w = await import('./js/workouts.js'); return (await w.listWorkouts('demo')).length === 30; });
    const lvl = await page.evaluate(async () => (await import('./js/gamification.js')).computeProgress(await (await import('./js/workouts.js')).listWorkouts('demo')).level);
    assert.equal(lvl, 12);
  });

  await step(`aucune erreur JavaScript, aucun débordement (${w} px)`, async () => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
  });
  await context.close();
}

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
