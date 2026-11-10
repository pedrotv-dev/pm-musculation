// Son de fin de repos : course entre le petit son silencieux d'« amorçage » (premier geste) et le démarrage d'un repos.
// Le son du repos ne doit jamais être coupé par la fin tardive de l'amorçage, et aucune lecture ne doit être interrompue
// en cours de chargement (requête « blob: » annulée). Vrai module js/rest-audio.js, amorçage par un VRAI geste (clic
// souris Playwright, donc activation utilisateur réelle du navigateur, via les écouteurs de l'application).
//
// Pour chaque essai, on exige : fichier de repos présent (source « blob: »), lecteur PAS en pause, position de lecture qui
// PROGRESSE réellement entre deux mesures, aucune requête « blob: » annulée.
// LIMITE : ce test prouve que Chromium lit le fichier (lecteur actif, position qui avance) ; il ne peut pas certifier
// qu'un son est physiquement audible (volume, sortie audio, haut-parleur) ni le comportement de Safari sur iPhone.
// node tests/e2e/rest-audio-race-flow.mjs
import assert from 'node:assert/strict';
import { serve, launch, watch, step, summary } from './lib.mjs';

const srv = await serve();
const { browser } = await launch();
const errors = [];
const TRIES = 20;

console.log('Son de repos : amorçage (vrai geste) puis repos immédiat');
for (const offline of [false, true]) {
  await step(`${offline ? 'hors ligne' : 'en ligne'} · vrai geste puis repos (0 à ${(TRIES - 1) * 3} ms plus tard, ${TRIES} essais) : son du repos présent, en lecture, qui progresse ; aucune lecture interrompue`, async () => {
    const results = [];
    for (let i = 0; i < TRIES; i++) {
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
      await page.goto(srv.url);
      await page.waitForFunction(() => document.querySelector('[data-select-profile]'));
      if (offline) await context.setOffline(true);
      // Le repos est programmé DANS le geste : l'application amorce l'audio au « pointerdown » (ses écouteurs), ce repos part
      // `gap` ms après le « click » du MÊME geste réel. L'écart amorçage → repos est donc maîtrisé (0 à 57 ms).
      await page.evaluate(async gap => {
        const R = await import('./js/rest-audio.js');                                  // même module que l'application
        window.__rest = new Promise(done => document.addEventListener('click', () => setTimeout(() => {
          const endsAt = Date.now() + 90000;
          R.syncRestAudio({ status: 'running', endsAt });                              // repos lancé pendant / après l'amorçage
          done();
        }, gap), { once: true, capture: true }));
      }, i * 3);
      await page.mouse.click(2, 2);                                                    // VRAI geste utilisateur
      const r = await page.evaluate(async () => {
        const sleep = ms => new Promise(res => setTimeout(res, ms));
        await window.__rest;
        await sleep(600);                                                              // l'amorçage a eu le temps de se terminer
        const a = window.__audios[0];
        if (!a) return { audio: false };
        const t1 = a.currentTime;
        await sleep(500);
        return { audio: true, src: a.getAttribute('src'), paused: a.paused, ended: a.ended, t1, t2: a.currentTime, activated: navigator.userActivation ? navigator.userActivation.hasBeenActive : null };
      });
      results.push({ gap: i * 3, failed, ...r });
      await context.close();
    }
    const broken = results.filter(x =>
      !x.audio ||                                      // aucun lecteur
      x.failed.length ||                               // requête blob: annulée
      !x.src || !x.src.startsWith('blob:') ||          // fichier de repos absent
      x.paused || x.ended ||                           // lecteur arrêté
      !(x.t2 > x.t1));                                 // la lecture ne progresse pas
    assert.equal(results.every(x => x.activated !== false), true, 'le clic doit donner une activation utilisateur réelle');
    assert.deepEqual(broken, [], 'essais en échec : ' + JSON.stringify(broken));
  });
}
await step('aucune erreur JavaScript', async () => { assert.deepEqual(errors, []); });

const failed = summary();
await browser.close(); srv.close();
process.exit(failed ? 1 : 0);
