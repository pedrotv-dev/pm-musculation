// Diagnostics de tests uniquement : aucun accès à un profil navigateur personnel.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const name = path.basename(process.argv[1] || 'browser', '.mjs');
const dir = path.resolve(process.env.E2E_ARTIFACT_DIR || path.join(root, 'artifacts/e2e', name + '-' + Date.now()));
const contexts = new Set();
const browsers = new Set();
let nextContext = 0, nextPage = 0, nextFailure = 0;
fs.mkdirSync(dir, { recursive: true });
const log = (event, detail = {}) => fs.appendFileSync(path.join(dir, 'events.jsonl'), JSON.stringify({ time: new Date().toISOString(), event, ...detail }) + '\n');
log('environment', { node: process.version, platform: process.platform, sha: process.env.GITHUB_SHA || null });

// Ne jamais accepter une URL publique comme cible de navigation, même par erreur de configuration.
export function assertLocalURL(url) {
  const parsed = new URL(String(url));
  if (!['http:', 'https:'].includes(parsed.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) {
    throw new Error('Navigation E2E refusée hors du serveur local : ' + parsed.origin);
  }
}

async function bounded(fn) {
  let timer;
  try { return await Promise.race([fn(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Diagnostic expiré')), 2500); })]); }
  finally { clearTimeout(timer); }
}

export async function checkpoint(page, label) {
  try {
    const state = await bounded(() => page.evaluate(async () => ({
      url: location.href, online: navigator.onLine, profile: document.documentElement.dataset.pmProfile || null,
      saveState: document.querySelector('#pm-save-state')?.getAttribute('data-state') || null,
      controller: navigator.serviceWorker.controller?.scriptURL || null,
      registrations: await Promise.all((await navigator.serviceWorker.getRegistrations()).map(async r => ({
        scope: r.scope, active: r.active?.state, waiting: r.waiting?.state, installing: r.installing?.state
      }))),
      caches: await Promise.all((await caches.keys()).map(async name => ({ name, entries: (await (await caches.open(name)).keys()).length }))),
      databases: indexedDB.databases ? await indexedDB.databases() : []
    })));
    log('checkpoint', { label, state });
  } catch (e) { log('diagnostic-error', { label, message: String(e) }); }
}

export const diagnostics = {
  async instrument(browser) {
    browsers.add(browser);
    log('browser', { version: browser.version() });
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async options => {
      if (options?.storageState) throw new Error('État navigateur externe interdit dans les tests.');
      const context = await newContext(options);
      const id = ++nextContext;
      contexts.add(context);
      context.setDefaultTimeout(15000);
      context.setDefaultNavigationTimeout(20000);
      // Ne pas router les requêtes : Playwright désactiverait alors le cache HTTP.
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      context.on('serviceworker', worker => log('serviceworker', { context: id, url: worker.url() }));
      context.on('page', page => {
        const pageId = ++nextPage;
        const goto = page.goto.bind(page);
        page.goto = (url, options) => { assertLocalURL(url); return goto(url, options); };
        page.on('pageerror', e => log('pageerror', { page: pageId, stack: e.stack || String(e) }));
        page.on('console', m => log('console', { page: pageId, type: m.type(), text: m.text().slice(0, 4000) }));
        page.on('requestfailed', r => log('requestfailed', { page: pageId, url: r.url(), failure: r.failure() }));
        page.on('response', r => {
          if (r.status() >= 400) log('http-error', { page: pageId, status: r.status(), url: r.url() });
        });
        page.on('framenavigated', f => { if (f === page.mainFrame()) log('navigation', { page: pageId, url: f.url() }); });
      });
      let finalized = false;
      context.finishDiagnostics = async () => {
        if (finalized) return;
        finalized = true;
        for (const page of context.pages()) await checkpoint(page, 'context-' + id + '-close');
        try { await context.tracing.stop({ path: path.join(dir, 'context-' + id + '-trace.zip') }); }
        catch (e) { log('trace-error', { context: id, message: String(e) }); }
      };
      const close = context.close.bind(context);
      context.close = async (...args) => {
        try { await context.finishDiagnostics(); return await close(...args); }
        finally { contexts.delete(context); }
      };
      return context;
    };
    const close = browser.close.bind(browser);
    browser.close = async (...args) => {
      for (const context of [...contexts]) await context.close();
      try { return await close(...args); }
      finally { browsers.delete(browser); }
    };
  },
  async shutdown() {
    for (const browser of [...browsers]) await browser.close();
  },
  async failure(label, error) {
    const id = ++nextFailure;
    log('failure', { label, stack: error?.stack || String(error) });
    for (const context of contexts) for (const [i, page] of context.pages().entries()) {
      const file = path.join(dir, 'failure-' + id + '-page-' + (++nextPage) + '-' + i);
      await checkpoint(page, label);
      try { await page.screenshot({ path: file + '.png', fullPage: true, timeout: 2500 }); } catch (_) { /* page déjà fermée */ }
      try { fs.writeFileSync(file + '.html', await bounded(() => page.content())); } catch (_) { /* diagnostic uniquement */ }
    }
  }
};

// Un échec hors de step() reste fatal ; son journal n'est pas perdu.
process.on('uncaughtExceptionMonitor', error => log('uncaught', { stack: error.stack || String(error) }));
