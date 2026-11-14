/**
 * PM Musculation — langue de l'interface (français ou anglais). L'application est écrite en français ; en anglais, chaque
 * texte affiché (et placeholder, aria-label, title, alt) est remplacé à la volée d'après i18n/en.json
 * ({ "texte FR": "texte EN" }, produit par tools/i18n-extract.mjs puis traduit). Texte sans traduction : reste en français.
 * Choix : réglage global de l'appareil (pas par profil), langue du téléphone par défaut. Changer de langue recharge la page.
 */
const KEY = 'pm-lang';
export const LANGS = [['fr', 'Français'], ['en', 'English']];

/** Langue choisie, sinon celle du téléphone (anglais seulement si le téléphone n'est pas en français). */
export function getLang() {
  let v = null;
  try { v = localStorage.getItem(KEY); } catch (_) { /* stockage indisponible */ }
  if (v === 'fr' || v === 'en') return v;
  const nav = (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || 'fr';
  return /^fr\b/i.test(nav) ? 'fr' : 'en';
}
export function setLang(lang) {
  if (lang !== 'fr' && lang !== 'en') return;
  try { localStorage.setItem(KEY, lang); } catch (_) { /* stockage indisponible */ }
  if (lang !== current) location.reload();
}
const current = getLang();

// ------------------------------------------------------------------ traduction (fonctions pures, testées sous Node)

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Traducteur : correspondance exacte d'abord, sinon remplacement des morceaux connus (les plus longs d'abord, jamais au
 * milieu d'un mot) : « Série 2 / 3 » se traduit avec l'entrée « Série ».
 */
export function makeTranslator(dict) {
  const map = new Map(Object.entries(dict || {}).filter(([k, v]) => k && typeof v === 'string' && v.trim() && v !== k));
  const parts = [...map.keys()].filter(k => k.trim().length >= 3).sort((a, b) => b.length - a.length);
  const re = parts.length ? new RegExp('(?<![A-Za-zÀ-ÿ])(?:' + parts.map(esc).join('|') + ')(?![A-Za-zÀ-ÿ])', 'g') : null;
  return text => {
    if (!text) return text;
    const t = text.trim();
    if (!t || !/[A-Za-zÀ-ÿ]/.test(t)) return text;
    if (map.has(t)) return text.replace(t, map.get(t));
    if (!re) return text;
    return text.replace(re, m => map.get(m) ?? m);
  };
}

// ------------------------------------------------------------------ application au document (navigateur, anglais seulement)

const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
function start(tr) {
  const done = new WeakMap(); // nœud → dernière valeur écrite (évite de retraduire sa propre écriture)
  const text = n => {
    if (done.get(n) === n.nodeValue) return;
    const p = n.parentNode?.nodeName;
    if (p === 'SCRIPT' || p === 'STYLE' || p === 'TEXTAREA') return;
    const v = tr(n.nodeValue);
    if (v !== n.nodeValue) n.nodeValue = v;
    done.set(n, n.nodeValue);
  };
  const attrs = e => {
    for (const a of ATTRS) {
      const old = e.getAttribute?.(a);
      if (!old) continue;
      const v = tr(old);
      if (v !== old) e.setAttribute(a, v);
    }
  };
  const walk = root => {
    if (root.nodeType === 3) { text(root); return; }
    if (root.nodeType !== 1) return;
    attrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) (n.nodeType === 3 ? text(n) : attrs(n));
  };
  walk(document.body);
  document.title = tr(document.title);
  new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') text(m.target);
      else if (m.type === 'attributes') attrs(m.target);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  // boîtes natives : alert / confirm / prompt
  for (const f of ['alert', 'confirm', 'prompt']) { const o = window[f]; if (typeof o === 'function') window[f] = (msg, ...r) => o.call(window, tr(String(msg ?? '')), ...r); }
}

if (typeof document !== 'undefined') {
  document.documentElement.lang = current;
  if (current === 'en') {
    fetch(new URL('../i18n/en.json', import.meta.url).href).then(r => (r.ok ? r.json() : {})).catch(() => ({}))
      .then(dict => { const go = () => start(makeTranslator(dict)); if (document.body) go(); else document.addEventListener('DOMContentLoaded', go); });
  }
  // sélecteurs de langue (premier écran, Réglages) : <select data-pm-lang>
  const bind = () => document.querySelectorAll('select[data-pm-lang]').forEach(s => {
    if (s.dataset.bound) return;
    s.dataset.bound = '1'; s.value = current;
    s.addEventListener('change', () => setLang(s.value));
  });
  new MutationObserver(bind).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState !== 'loading') bind(); else document.addEventListener('DOMContentLoaded', bind);
}
