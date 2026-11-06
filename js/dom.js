/**
 * PM Musculation — petits utilitaires d'interface partages (aucune dependance).
 * Dialogues et notifications maison : window.confirm / alert sont peu fiables dans une PWA iPhone.
 */
export const el = (tag, cls = '', text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = String(text);
  return n;
};
export const btn = (label, cls = '', fn) => {
  const b = el('button', cls, label);
  b.type = 'button';
  if (fn) b.addEventListener('click', fn);
  return b;
};
export const clear = n => { n.replaceChildren(); return n; };
export const add = (parent, ...children) => { parent.append(...children); return parent; };

/** « 1 h 05 », « 42 min ». */
export function formatMinutes(min) {
  const m = Math.max(0, Math.round(min || 0));
  return m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') : m + ' min';
}
/** Secondes -> « mm:ss » ou « h:mm:ss ». */
export function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = String(m).padStart(2, '0'), rr = String(r).padStart(2, '0');
  return h ? h + ':' + mm + ':' + rr : mm + ':' + rr;
}
/** Nombre -> texte francais (virgule), sans zeros inutiles. */
export function fmtNum(n) {
  return (Math.round(n * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}
/** Texte saisi (« 42,5 ») -> nombre ou NaN. */
export function parseNum(text) {
  const t = String(text).trim().replace(',', '.');
  return t === '' ? NaN : Number(t);
}
export function formatDateFr(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}
export function localISODate(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

let modalRoot = null;
function root() {
  if (!modalRoot) {
    modalRoot = el('div', 'pm-modal-root');
    modalRoot.setAttribute('role', 'presentation');
    document.body.append(modalRoot);
  }
  return modalRoot;
}

/**
 * Boite de dialogue. `choices` : [{ label, value, kind: 'primary'|'danger'|'' }]. Retourne la valeur choisie,
 * ou `null` (Echap, clic a l'exterieur, ou choix « cancel »). `content` : noeud facultatif insere sous le message.
 */
export function dialog({ title, message, choices, content }) {
  return new Promise(resolve => {
    const overlay = el('div', 'pm-modal-overlay');
    const box = el('div', 'pm-modal');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    if (title) { box.setAttribute('aria-label', title); box.append(el('h3', 'pm-modal-title', title)); }
    if (message) box.append(el('p', 'pm-modal-message', message));
    if (content) box.append(content);
    const row = el('div', 'pm-modal-actions');
    const close = value => { overlay.remove(); document.removeEventListener('keydown', onKey, true); resolve(value); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
    (choices || [{ label: 'OK', value: true, kind: 'primary' }]).forEach(c => {
      row.append(btn(c.label, 'pm-modal-btn' + (c.kind ? ' pm-' + c.kind : ''), () => close(c.value)));
    });
    box.append(row);
    overlay.append(box);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    document.addEventListener('keydown', onKey, true);
    root().append(overlay);
    const first = box.querySelector('.pm-primary, .pm-danger, button');
    if (first) first.focus();
  });
}
/** Confirmation oui / non. */
export async function confirmDialog(message, { title = 'Confirmer', ok = 'Confirmer', cancel = 'Annuler', danger = false } = {}) {
  return (await dialog({ title, message, choices: [
    { label: cancel, value: false }, { label: ok, value: true, kind: danger ? 'danger' : 'primary' }
  ] })) === true;
}

let toastNode = null, toastTimer = null;
/** Message temporaire en haut de l'ecran, avec une action facultative (ex. « Annuler »). */
export function toast(message, { actionLabel, onAction, duration = 4000 } = {}) {
  if (!toastNode) {
    toastNode = el('div', 'pm-toast');
    toastNode.setAttribute('role', 'status');
    document.body.append(toastNode);
  }
  clearTimeout(toastTimer);
  toastNode.replaceChildren(el('span', 'pm-toast-text', message));
  const hide = () => { toastNode.hidden = true; };
  if (actionLabel) {
    toastNode.append(btn(actionLabel, 'pm-toast-action', () => { hide(); clearTimeout(toastTimer); if (onAction) onAction(); }));
  }
  toastNode.hidden = false;
  toastTimer = setTimeout(hide, duration);
  return { dismiss: () => { clearTimeout(toastTimer); hide(); } };
}
