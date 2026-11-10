/**
 * PM Musculation V2-EVOLUTION-1 — Profil : « Gérer mes profils » (renommer, supprimer, masquer) et « Importer
 * l'historique d'un autre profil » (sauvegarde JSON d'un ancien profil → profil choisi). Tout reste sur l'appareil.
 */
import { el, btn, add, dialog, confirmDialog, toast, formatDateFr } from './dom.js';
import { listProfiles, getProfileInfo, isRealProfile, isLegacyProfile, updateProfile, deleteProfile, NAME_MAX } from './profiles.js';
import { getResumableWorkout } from './workouts.js';
import { parseBackupText, planHistoryTransfer, applyHistoryTransfer, runBackup } from './backup.js';
import { GAME_START } from './gamification.js';

const root = document.documentElement;
const status = () => { const p = el('p', 'pm-coach-status'); p.setAttribute('role', 'status'); return p; };
const say = (p, text, kind = '') => { p.textContent = text; p.dataset.state = kind; };
const fold = (title, intro) => {
  const box = el('details', 'panel pm-profile-section pm-fold'); box.append(el('summary', 'pm-fold-title', title));
  if (intro) box.append(el('p', 'pm-muted', intro)); return box;
};
const nameOf = id => (getProfileInfo(id) || {}).name || id;
const dataChanged = profile => document.dispatchEvent(new CustomEvent('pm:data-changed', { detail: { profile } }));

// ---------------------------------------------------------------- gérer mes profils

/** Renommer : dialogue avec le nom actuel. */
async function rename(p, st) {
  const input = el('input', 'pm-input'); input.type = 'text'; input.value = p.name; input.maxLength = NAME_MAX; input.setAttribute('aria-label', 'Nouveau nom');
  const pick = await dialog({ title: 'Renommer « ' + p.name + ' »', message: 'Les données du profil ne changent pas.', content: input,
    choices: [{ label: 'Annuler', value: null }, { label: 'Renommer', value: 'ok', kind: 'primary' }] });
  if (pick !== 'ok') return false;
  try { await updateProfile(p.id, { name: input.value }); say(st, 'Profil renommé ✓', 'ok'); return true; }
  catch (e) { say(st, (e.message || 'Renommage impossible.') + ' Rien n’a été modifié.', 'error'); return false; }
}
/** Supprimer un profil créé : jamais pendant une séance ouverte ; sauvegarde proposée ; double confirmation. */
async function remove(p, st) {
  const open = await getResumableWorkout(p.id).catch(() => null);
  if (open) { say(st, '« ' + p.name + ' » a une séance en cours : termine-la ou arrête-la avant de supprimer ce profil.', 'error'); return false; }
  const pick = await dialog({ title: 'Supprimer « ' + p.name + ' »', message: 'Supprimer ce profil et TOUTES ses données (programmes, séances, poids, réglages) de ce téléphone ? Les autres profils ne sont pas touchés.',
    choices: [{ label: 'Annuler', value: null }, { label: 'Sauvegarder d’abord', value: 'backup', kind: 'primary' }, { label: 'Supprimer', value: 'delete', kind: 'danger' }] });
  if (pick === 'backup') {
    try { const r = await runBackup(p.id); say(st, r.how === 'cancelled' ? 'Sauvegarde annulée : rien n’a été supprimé.' : 'Sauvegarde faite. Appuie de nouveau sur « Supprimer » pour continuer.', r.how === 'cancelled' ? '' : 'ok'); }
    catch (e) { say(st, 'Sauvegarde impossible : ' + (e.message || e) + ' Rien n’a été supprimé.', 'error'); }
    return false;
  }
  if (pick !== 'delete') return false;
  if (!(await confirmDialog('Dernière confirmation : supprimer définitivement « ' + p.name + ' » et ses données ?', { title: 'Irréversible', ok: 'Supprimer définitivement', danger: true }))) return false;
  try { await deleteProfile(p.id, { confirm: p.id }); toast('Profil supprimé'); say(st, '« ' + p.name + ' » supprimé.', 'ok'); return true; }
  catch (e) { say(st, 'Suppression impossible : ' + (e.message || e) + ' Les données sont conservées.', 'error'); return false; }
}
/** Masquer / réafficher sur l'écran de choix (profils historiques protégés compris) : aucune donnée touchée. */
async function toggleHidden(p, st) {
  const hidden = !(p.extra && p.extra.hidden);
  try { await updateProfile(p.id, { extra: { ...(p.extra || {}), hidden } }); say(st, hidden ? '« ' + p.name + ' » est masqué sur l’écran de choix (données conservées).' : '« ' + p.name + ' » est de nouveau affiché.', 'ok'); return true; }
  catch (e) { say(st, (e.message || 'Modification impossible.') + ' Rien n’a été modifié.', 'error'); return false; }
}

export async function manageProfilesSection(current) {
  const box = fold('Gérer mes profils', 'Profils enregistrés sur ce téléphone. Renomme ou supprime les profils que tu as créés ; les profils historiques Pierre et Manon sont protégés : tu peux seulement les masquer de l’écran de choix (leurs données restent).');
  box.classList.add('pm-manage-profiles');
  const list = el('ul', 'pm-manage-list');
  const st = status();
  const draw = async () => {
    const profiles = (await listProfiles().catch(() => [])).filter(p => isRealProfile(p.id));
    list.replaceChildren(...profiles.map(p => {
      const li = el('li', 'pm-manage-row');
      const tags = [p.id === root.dataset.pmProfile ? 'profil ouvert' : '', isLegacyProfile(p.id) ? 'historique protégé' : '', p.extra && p.extra.hidden ? 'masqué' : ''].filter(Boolean);
      const head = el('div', 'pm-manage-head');
      add(head, el('strong', '', p.name), el('span', 'pm-muted pm-manage-tags', tags.join(' · ')));
      const actions = el('div', 'pm-row-actions');
      const after = async ok => { if (ok) await draw(); };
      if (!isLegacyProfile(p.id)) {
        actions.append(btn('Renommer', 'pm-secondary', async () => after(await rename(p, st))));
        const del = btn('Supprimer', 'pm-warning', async () => after(await remove(p, st)));
        del.setAttribute('aria-label', 'Supprimer le profil ' + p.name);
        actions.append(del);
      }
      actions.append(btn(p.extra && p.extra.hidden ? 'Afficher sur l’écran de choix' : 'Masquer de l’écran de choix', 'pm-link', async () => after(await toggleHidden(p, st))));
      li.append(head, actions);
      li.dataset.profile = p.id;
      return li;
    }));
  };
  await draw();
  add(box, list, st);
  return box;
}

// ---------------------------------------------------------------- importer l'historique d'un autre profil

export async function historyImportSection(current) {
  const box = fold('Importer l’historique d’un autre profil', 'Ajoute à un profil les séances terminées ou partielles et les pesées d’une sauvegarde PM Musculation, même si elle vient d’un autre profil (ancien profil, autre téléphone). Rien n’est remplacé ; les programmes, objectifs et réglages ne sont pas importés.');
  box.classList.add('pm-history-import');
  const file = el('input'); file.type = 'file'; file.accept = '.json,application/json'; file.setAttribute('aria-label', 'Sauvegarde dont importer l’historique');
  const dest = el('select', 'pm-select'); dest.setAttribute('aria-label', 'Profil de destination');
  for (const p of (await listProfiles().catch(() => [])).filter(x => isRealProfile(x.id))) {
    const o = document.createElement('option'); o.value = p.id; o.textContent = p.name + (p.id === current ? ' (profil ouvert)' : ''); dest.append(o);
  }
  if (isRealProfile(current)) dest.value = current;
  const summary = el('div', 'pm-history-import-summary'); summary.hidden = true;
  const st = status();
  let backup = null, plan = null;
  const reset = () => { plan = null; summary.hidden = true; summary.replaceChildren(); go.disabled = true; };
  const analyse = btn('Analyser la sauvegarde', 'pm-secondary', async () => {
    reset();
    try {
      const f = file.files && file.files[0];
      if (!f) throw new Error('Choisis d’abord un fichier de sauvegarde.');
      backup = parseBackupText(await f.text());
      plan = await planHistoryTransfer(backup, dest.value);
      const srcName = (backup.profile && backup.profile.name) || (getProfileInfo(backup.profileId) || {}).name || backup.profileId;
      const lines = [
        'Sauvegarde de « ' + srcName + ' » (' + backup.profileId + ')' + (backup.exportedAt ? ', faite le ' + formatDateFr(backup.exportedAt.slice(0, 10)) : '') + '.',
        'Trouvé : ' + plan.found.sessions + ' séance(s) terminée(s) ou partielle(s)' + (plan.first ? ' (du ' + formatDateFr(plan.first) + ' au ' + formatDateFr(plan.last) + ')' : '') + ', ' + plan.found.weights + ' pesée(s).',
        'À importer dans « ' + nameOf(dest.value) + ' » : ' + plan.sessions.length + ' séance(s), ' + plan.weights.length + ' pesée(s).'
      ];
      if (plan.skipped.sessions || plan.skipped.weights) lines.push('Déjà présentes, ignorées : ' + plan.skipped.sessions + ' séance(s), ' + plan.skipped.weights + ' pesée(s).');
      if (plan.found.open) lines.push('Séances non terminées ignorées : ' + plan.found.open + '.');
      if (plan.sessions.some(s => s.date < GAME_START)) lines.push('Les séances d’avant le ' + formatDateFr(GAME_START) + ' restent dans l’historique, les statistiques et le bilan, mais ne donnent ni XP, ni niveau, ni succès.');
      lines.push('Non importés : programmes, objectifs, profil sportif et réglages.');
      summary.replaceChildren(...lines.map(t => el('p', 'pm-muted', t)));
      summary.hidden = false;
      go.disabled = !plan.sessions.length && !plan.weights.length;
      if (go.disabled) say(st, 'Rien à importer : tout est déjà présent dans ce profil.', 'ok');
    } catch (e) { say(st, 'Analyse impossible : ' + (e.message || e), 'error'); }
  });
  const go = btn('Importer l’historique', 'pm-validate', async () => {
    if (!backup || !plan) return;
    const target = dest.value;
    if (!(await confirmDialog('Ajouter ' + plan.sessions.length + ' séance(s) et ' + plan.weights.length + ' pesée(s) à « ' + nameOf(target) + ' » ? Rien d’existant n’est modifié.', { title: 'Importer l’historique', ok: 'Importer' }))) return;
    go.disabled = true;
    try {
      const fresh = await planHistoryTransfer(backup, target); // relu juste avant l'écriture : jamais de doublon
      const r = await applyHistoryTransfer(fresh);
      say(st, 'Historique importé dans « ' + nameOf(target) + ' » : ' + r.sessions + ' séance(s), ' + r.weights + ' pesée(s).', 'ok');
      toast('Historique importé');
      dataChanged(target);
      reset();
    } catch (e) { say(st, 'Import impossible : ' + (e.message || e) + ' Rien n’a été ajouté.', 'error'); go.disabled = false; }
  });
  go.disabled = true;
  file.addEventListener('change', reset);
  dest.addEventListener('change', reset);
  const destField = el('div', 'pm-coach-field'); const l = el('label', 'pm-coach-label', 'Profil de destination'); dest.id = 'pm-history-dest'; l.htmlFor = dest.id; destField.append(l, dest);
  add(box, file, destField, add(el('div', 'pm-row-actions'), analyse, go), summary, st);
  return box;
}
