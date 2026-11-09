// Son de fin de repos : course entre le petit son silencieux d'« amorçage » (premier geste) et le démarrage d'un repos.
// Le son du repos ne doit jamais être coupé par la fin tardive de l'amorçage, et aucune lecture ne doit être interrompue
// en cours de chargement (requête « blob: » annulée). Vrai module js/rest-audio.js.  node tests/e2e/rest-audio-race-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const errors = [];

console.log('Son de repos : amorçage puis repos immédiat');
for (const offline of [false, true]) {
  await step(`${offline ? 'hors ligne' : 'en ligne'} · amorçage puis repos (écart de 0 à 57 ms, 20 essais) : son du repos intact, aucune lecture interrompue`, async () => {
    const results = [];
    for (let i = 0; i < 20; i++) {
      const context = await browser.newContext();
      // journal des éléments audio créés par l'application
      await context.addInitScript(() => {
        const Real = window.Audio;
        window.__audios = [];
        window.Audio = function (...args) { const a = new Real(...args); window.__audios.push(a); return a; };
        window.Audio.prototype = Real.prototype;
      });
      const page = await context.newPage();
      const failed = [];
      // hors ligne sans cache installé, l'icône de la notification ne peut pas se charger : seules les erreurs JavaScript comptent
      if (offline) page.on('pageerror', e => errors.push('pageerror: ' + e.message)); else watch(page, errors);
      page.on('requestfailed', r => { if (r.url().startsWith('blob:')) failed.push(r.failure()?.errorText || '?'); });
      await page.goto(srv.url);                      // aucun clic : l'amorçage est déclenché par le test lui-même
      if (offline) await context.setOffline(true);
      const r = await page.evaluate(async gap => {
        const R = await import('./js/rest-audio.js');
        R.unlockRestAudio();                                                  // premier geste : amorçage
        await new Promise(res => setTimeout(res, gap));
        const endsAt = Date.now() + 90000;
        R.syncRestAudio({ status: 'running', endsAt });                       // repos lancé aussitôt
        await new Promise(res => setTimeout(res, 600));                       // l'amorçage a eu le temps de se terminer
        const a = window.__audios[0];
        return { src: a ? a.getAttribute('src') : null, paused: a ? a.paused : null };
      }, i * 3);
      results.push({ gap: i * 3, failed: failed.length, ...r });
      await context.close();
    }
    const broken = results.filter(x => x.failed || !x.src || !x.src.startsWith('blob:'));
    assert.deepEqual(broken, [], 'essais en échec : ' + JSON.stringify(broken));
  });
}
await step('aucune erreur JavaScript', async () => { assert.deepEqual(errors, []); });

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
