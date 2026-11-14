/**
 * PM Musculation — Réglages (icône ⚙︎, page « profil ») : mon profil, séance et chrono, profils, données, à propos.
 * LOT 1 : les sections existantes sont regroupées en 5 rubriques ; « Préparer ma semaine » est dans Programme.
 */
import { LANGS } from './i18n.js';
import { getRestConfig, setRestConfig, stopRest } from './rest-timer.js';
import { listWorkouts, resetDemoWorkouts } from './workouts.js';
import { resetDemoWeights } from './weights.js';
import { createBackupFile, parseBackupText, describeBackup, restoreBackup, clearProfileData, resultsCsv, saveTextFile, getBackupStatus, runBackup } from './backup.js';
import { loadCatalog } from './catalog.js';
import { demoToolsSection } from './demo-tools.js';
import { korvGuide } from './jeu-ui.js';
import { isRealProfile as real, isKnownProfile, getProfileInfo } from './profiles.js';
import { APP_VERSION } from './version.js';
import { getUiSettings, setUiSettings } from './ui-settings.js';
import { isWakeLockSupported } from './wakelock.js';
import { identitySection, sportSection, gymSection } from './coach-ui.js';
import { manageProfilesSection, historyImportSection } from './profiles-ui.js';
import { el, btn, clear, add, dialog, confirmDialog, toast, fmtNum, parseNum, formatDateFr } from './dom.js';

const root = document.documentElement;
const page = document.querySelector('[data-page="profil"]');
// Nom et objectif d'un profil (registre V2-PROF1 ; Pierre et Manon : textes historiques). Profil inconnu sur cet appareil (sauvegarde d'un autre appareil) : son identifiant comme nom.
function person(id) {
  if (id === 'demo') return { name: 'Démo', goal: '' };
  const info = getProfileInfo(id);
  if (!info) return { name: String(id), goal: '' };
  return { name: info.name, goal: String(info.goal || '').replace(/^./, c => c.toLowerCase()) };
}
const S = { notice: '', rev: 0 };
const emitData = profile => document.dispatchEvent(new CustomEvent('pm:data-changed', { detail: { profile } }));

function section(title, intro, ...children) {
  const box = el('article', 'panel pm-profile-section');
  box.append(el('h3', '', title));
  if (intro) box.append(el('p', 'pm-muted', intro));
  box.append(...children);
  return box;
}
function readFile(input) {
  return new Promise((resolve, reject) => {
    const f = input.files && input.files[0];
    if (!f) return reject(new Error('Aucun fichier choisi.'));
    const r = new FileReader();
    r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    r.readAsText(f);
  });
}

function chronoSection(profile, config) {
  const mode = el('select', 'pm-select'); mode.setAttribute('aria-label', 'Mode du chronomètre');
  [['auto', 'Automatique : démarre après chaque série validée'], ['manual', 'Manuel : bouton « Lancer le repos »'], ['off', 'Désactivé']]
    .forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; mode.append(o); });
  mode.value = config.mode;
  const num = (label, value) => {
    const wrap = el('label', 'pm-field'); wrap.append(el('span', 'pm-field-name', label));
    const i = el('input', 'pm-input'); i.type = 'text'; i.inputMode = 'numeric'; i.value = String(value); wrap.append(i); return { wrap, i };
  };
  const dflt = num('Repos par défaut (secondes)', config.defaultSeconds), step = num('Pas des boutons + / − (secondes)', config.stepSeconds);
  const chk = (label, key) => {
    const l = el('label', 'pm-check'); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = config[key];
    c.addEventListener('change', () => save({ [key]: c.checked })); l.append(c, document.createTextNode(' ' + label)); return l;
  };
  const save = async patch => {
    const r = await setRestConfig(profile, patch);
    if (r.error) toast('Réglage refusé : ' + r.error);
    else toast('Réglage enregistré', { duration: 1500 });
  };
  mode.addEventListener('change', () => save({ mode: mode.value }));
  dflt.i.addEventListener('change', () => { const v = parseNum(dflt.i.value); if (Number.isInteger(v)) save({ defaultSeconds: v }); else toast('Nombre entier attendu.'); });
  step.i.addEventListener('change', () => { const v = parseNum(step.i.value); if (Number.isInteger(v)) save({ stepSeconds: v }); else toast('Nombre entier attendu.'); });
  const grid = el('div', 'pm-grid-2'); grid.append(dflt.wrap, step.wrap);
  return section('Chronomètre de récupération', 'Réglages propres à ce profil. Le temps de repos de chaque machine vient du programme.', mode, grid,
    chk('Son à la fin du repos', 'sound'), chk('Vibration (si disponible)', 'vibrate'));
}

function usageSection(profile, ui) {
  const row = (label, hint, key, available = true) => {
    const wrap = el('div', 'pm-profile-option');
    const l = el('label', 'pm-check');
    const c = document.createElement('input'); c.type = 'checkbox'; c.checked = available && ui[key]; c.disabled = !available;
    c.addEventListener('change', async () => {
      const r = await setUiSettings(profile, { [key]: c.checked });
      if (r.error) { c.checked = !c.checked; toast(r.error); } else toast(c.checked ? 'Activé' : 'Désactivé', { duration: 1200 });
    });
    l.append(c, document.createTextNode(' ' + label));
    wrap.append(l, el('p', 'pm-muted', hint));
    return wrap;
  };
  return section('Pendant une séance', 'Réglages d’usage, propres à ce profil.',
    row('Garder l’écran allumé pendant l’entraînement', isWakeLockSupported()
      ? 'L’écran ne s’éteint pas tant que la séance est en cours sur l’écran de séance (libéré en pause, à la fin et quand l’application passe en arrière-plan). Tant que l’écran reste allumé, aucun son n’est joué pendant le repos : ta musique n’est pas baissée.'
      : 'Non disponible sur ce navigateur : l’écran s’éteindra selon les réglages du téléphone.', 'keepAwake', isWakeLockSupported()),
    row('Alerte de fin de repos, écran verrouillé', 'Joue un son pendant le repos (silence, puis bips à la fin) pour sonner même téléphone verrouillé. Sur iPhone, ce son met en PAUSE ta musique (YouTube Music, Spotify…) pendant chaque repos et iOS ne la relance pas : décoche si tu écoutes de la musique. Décoché : écran allumé, les bips baissent la musique un instant sans la couper.', 'lockAlert'),
    row('Bouton retour du téléphone', 'Revient d’un niveau dans l’application (ferme un dialogue, retourne à la machine, à l’accueil…) au lieu de la quitter. À l’accueil, « retour » quitte normalement.', 'backButton'));
}

function effectsSection(profile, ui) {
  const row = (label, hint, key) => {
    const wrap = el('div', 'pm-profile-option');
    const l = el('label', 'pm-check');
    const c = document.createElement('input'); c.type = 'checkbox'; c.checked = ui[key];
    c.addEventListener('change', async () => {
      const r = await setUiSettings(profile, { [key]: c.checked });
      if (r.error) { c.checked = !c.checked; toast(r.error); } else toast(c.checked ? 'Activé' : 'Désactivé', { duration: 1200 });
    });
    l.append(c, document.createTextNode(' ' + label));
    wrap.append(l, el('p', 'pm-muted', hint));
    return wrap;
  };
  return section('Ambiance', 'Animations et sons de l’application, propres à ce profil. Tout peut être coupé.',
    langField(),
    row('Animations', 'Effets visuels (confettis, pulsations…). Elles se coupent aussi toutes seules si ton téléphone est réglé sur « réduire les animations ».', 'animations'),
    row('Petits bruitages', 'Sons discrets quand tu valides une série, annules, termines une machine…', 'sfx'),
    row('Jingles', 'Petites mélodies pour une séance terminée, un niveau gagné, un succès, un record.', 'jingles'));
}

/** Langue de l'interface (tout l'appareil) : js/i18n.js lie le <select data-pm-lang> et recharge la page. */
function langField() {
  const sel = el('select', 'pm-select'); sel.id = 'pm-settings-lang'; sel.dataset.pmLang = '';
  for (const [v, l] of LANGS) sel.append(new Option(l, v));
  const lab = el('label', 'pm-coach-label', 'Langue · Language'); lab.htmlFor = sel.id;
  return add(el('div', 'pm-coach-field'), lab, sel);
}

function backupSection(profile) {
  if (!real(profile)) return section('Sauvegardes', 'Le mode démo n’a rien à sauvegarder : ses données sont fictives et restent en mémoire.');
  const status = el('p', 'pm-muted', S.notice);
  const last = el('p', 'pm-muted', 'Dernière sauvegarde : …');
  getBackupStatus(profile).then(st => {
    last.textContent = st && st.at ? 'Dernière sauvegarde : ' + formatDateFr(st.at.slice(0, 10)) + ' (' + st.sessions + ' séance(s) à ce moment-là)' : 'Dernière sauvegarde : jamais — pense à en faire une.';
  });
  const dl = btn('Sauvegarder maintenant', 'pm-validate', async () => {
    try {
      const f = await runBackup(profile);
      if (f.how === 'cancelled') { status.textContent = 'Sauvegarde annulée.'; return; }
      status.textContent = 'Sauvegarde ' + (f.how === 'shared' ? 'partagée' : 'téléchargée') + ' : ' + f.summary.sessions + ' séance(s), ' + f.summary.weights + ' mesure(s) de poids, ' + f.summary.programs + ' programme(s). Garde ce fichier dans un endroit sûr (Fichiers, Drive, e-mail…).';
      last.textContent = 'Dernière sauvegarde : aujourd’hui (' + f.summary.sessions + ' séance(s) à ce moment-là)';
    } catch (e) { status.textContent = 'Échec : ' + (e.message || e); }
  });
  const csv = btn('Exporter mes résultats (CSV)', 'pm-secondary', async () => {
    try {
      const [rows, cat] = await Promise.all([listWorkouts(profile), loadCatalog()]);
      const names = new Map([...cat.byId].map(([id, m]) => [id, m.name]));
      const how = await saveTextFile('pm-musculation-' + profile + '-resultats.csv', resultsCsv(rows, names), 'text/csv');
      status.textContent = how === 'cancelled' ? 'Export annulé.' : rows.length + ' séance(s) exportée(s).';
    } catch (e) { status.textContent = 'Échec : ' + (e.message || e); }
  });
  const file = el('input'); file.type = 'file'; file.accept = '.json,application/json'; file.setAttribute('aria-label', 'Fichier de sauvegarde à restaurer');
  const restore = btn('Restaurer ce fichier', 'pm-secondary', async () => {
    try {
      const backup = parseBackupText(await readFile(file));
      if (backup.profileId !== profile) throw new Error('Cette sauvegarde est celle de ' + person(backup.profileId).name + ' : elle ne peut pas être restaurée dans le profil ' + person(profile).name + '.');
      const d = describeBackup(backup);
      const pick = await dialog({
        title: 'Restaurer la sauvegarde',
        message: 'Sauvegarde du ' + (d.exportedAt ? formatDateFr(d.exportedAt.slice(0, 10)) : '?') + ' : ' + d.sessions + ' séance(s), ' + d.weights + ' mesure(s), ' + d.programs + ' programme(s).',
        choices: [{ label: 'Annuler', value: null }, { label: 'Fusionner (garder l’existant)', value: 'merge', kind: 'primary' }, { label: 'Remplacer tout', value: 'replace', kind: 'danger' }]
      });
      if (!pick) return;
      if (pick === 'replace' && !(await confirmDialog('Remplacer TOUTES les données de ' + person(profile).name + ' par celles du fichier ? Les données actuelles de ce profil seront perdues.', { title: 'Remplacer les données', ok: 'Remplacer', danger: true }))) return;
      await restoreBackup(profile, backup, pick);
      file.value = '';
      S.notice = 'Restauration terminée (' + (pick === 'merge' ? 'fusion' : 'remplacement') + ') : ' + d.sessions + ' séance(s) dans le fichier.';
      status.textContent = S.notice;
      toast('Sauvegarde restaurée'); emitData(profile);
    } catch (e) { status.textContent = 'Restauration impossible : ' + (e.message || e); }
  });
  const fileLine = el('div', 'pm-file-line'); add(fileLine, file, restore);
  return section('Sauvegardes', 'Tes données restent sur cet appareil. Fais une sauvegarde régulièrement et avant tout changement de téléphone.',
    last, dl, add(el('div', 'pm-row-actions'), csv), fileLine, status);
}

function localDataSection(profile) {
  const info = el('p', 'pm-muted', 'Vérification du stockage…');
  (async () => {
    try {
      const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null;
      const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
      info.textContent = 'Stockage protégé : ' + (persisted === null ? 'inconnu' : persisted ? 'oui' : 'non (le navigateur peut effacer les données si l’appareil manque de place)') +
        (est && est.usage !== undefined ? ' · ' + fmtNum(est.usage / 1024) + ' Ko utilisés' : '') + '.';
    } catch (_) { info.textContent = 'Stockage : état indisponible.'; }
  })();
  const persist = btn('Protéger les données', 'pm-secondary', async () => {
    try { const ok = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; toast(ok ? 'Stockage protégé ✓' : 'Le navigateur n’a pas accordé la protection : fais des sauvegardes.'); } catch (_) { toast('Non disponible.'); }
  });
  const kids = [info, persist];
  if (real(profile)) {
    kids.push(btn('Effacer toutes les données de ' + person(profile).name, 'pm-warning pm-block', async () => {
      if (!(await confirmDialog('Effacer définitivement programmes, séances, poids et réglages de ' + person(profile).name + ' sur cet appareil ? Fais d’abord une sauvegarde. L’autre profil n’est pas touché.', { title: 'Effacer les données', ok: 'Continuer', danger: true }))) return;
      if (!(await confirmDialog('Dernière confirmation : tout effacer pour ' + person(profile).name + ' ?', { title: 'Irréversible', ok: 'Tout effacer', danger: true }))) return;
      try { await clearProfileData(profile); toast('Données effacées'); emitData(profile); } catch (e) { toast(e.message || 'Échec.'); }
    }));
  }
  return section('Données locales', 'Tout est stocké sur cet appareil (aucun compte, aucun serveur).', ...kids);
}

function demoSection(profile) {
  if (profile === 'demo') {
    const tools = demoToolsSection(); // « Outils de test » : profil Démo uniquement (revérifié à chaque action)
    return section('Mode démo', 'Données fictives, enregistrées uniquement en mémoire. Ne touche jamais aux profils de Pierre et Manon.',
      ...(tools ? [tools] : []),
      btn('Réinitialiser la démo', 'pm-secondary', async () => {
        if (!(await confirmDialog('Remettre la démo dans son état de départ ?', { ok: 'Réinitialiser' }))) return;
        resetDemoWeights(); await stopRest('demo').catch(() => {}); await resetDemoWorkouts();
        toast('Démo réinitialisée'); emitData('demo');
      }),
      btn('Quitter la démo', 'pm-secondary pm-block', () => document.getElementById('switch-profile')?.click()));
  }
  return section('Mode démo', 'Teste toute l’application avec de fausses données, sans toucher aux vraies.',
    btn('Explorer la démo', 'pm-secondary', () => {
      document.getElementById('switch-profile')?.click();
      setTimeout(() => document.querySelector('[data-select-profile="demo"]')?.click(), 0);
    }));
}

async function render() {
  const profile = root.dataset.pmProfile, mine = ++S.rev;
  if (!isKnownProfile(profile)) return;
  const config = await getRestConfig(profile);
  const ui = await getUiSettings(profile);
  const [sport, gym] = await Promise.all([sportSection(profile), gymSection(profile)]); // V2 : profil sportif et salle
  const [manage, transfer] = profile === 'demo' ? [null, null] : await Promise.all([manageProfilesSection(profile), historyImportSection(profile)]); // V2-EVOLUTION-1
  if (mine !== S.rev || root.dataset.pmProfile !== profile) return;
  clear(page);
  const head = section('', '');
  head.replaceChildren(el('h3', '', person(profile).name), el('p', 'pm-muted', profile === 'demo' ? 'Mode démo — données fictives' : person(profile).goal.replace(/^./, c => c.toUpperCase())),
    btn('Changer de profil', 'pm-secondary', () => document.getElementById('switch-profile')?.click()));
  const identity = identitySection(profile);
  const group = (title, ...children) => { const g = el('section', 'pm-settings-group'); g.append(el('h3', 'pm-settings-group-title', title), ...children.filter(Boolean)); return g; };
  const about = section('À propos', null, el('p', 'pm-muted', 'PM Musculation · version ' + APP_VERSION + ' · fonctionne hors connexion après installation.'));
  add(page, el('div', 'eyebrow', 'Mon espace'), el('h2', '', 'Réglages'),
    group('Mon profil', head, identity, sport, gym, section('Mes charges', 'Charges et répétitions que tu connais déjà, par groupe musculaire. Elles servent de point de départ (jamais comptées comme une séance).',
      btn('Modifier mes charges', 'pm-secondary', () => document.dispatchEvent(new CustomEvent('pm:open-declared-loads', { detail: { from: 'profil' } }))))),
    group('Séance et chrono', chronoSection(profile, config), usageSection(profile, ui), effectsSection(profile, ui)),
    ...(manage || transfer ? [group('Profils', manage, transfer)] : []),
    group('Données', backupSection(profile), localDataSection(profile), demoSection(profile)),
    group('À propos', korvGuide(profile), about));
  const update = btn('Rechercher une mise à jour', 'pm-secondary', async () => {
    try {
      const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
      if (!reg) { toast('Mises à jour automatiques indisponibles dans ce navigateur.'); return; }
      await reg.update();
      if (reg.waiting) document.dispatchEvent(new CustomEvent('pm:update-ready'));
      else toast('Vérification faite : tu as la dernière version (ou elle s’installe en arrière-plan).');
    } catch (_) { toast('Vérification impossible hors connexion.'); }
  });
  about.append(update);
  document.dispatchEvent(new CustomEvent('pm:settings-rendered', { detail: { profile } }));
}

// Optimisation : l'onglet masqué ne se reconstruit pas ; il se met à jour à l'ouverture (clic sur son onglet)
const refresh = () => render().catch(console.error);
const reload = () => { if (!page.hidden) refresh(); };
document.addEventListener('pm:profile-changed', () => { S.notice = ''; reload(); });
document.addEventListener('pm:data-changed', e => { if (e.detail?.source !== 'profiles-ui') reload(); });
document.addEventListener('pm:profiles-changed', e => { if (e.detail?.id === root.dataset.pmProfile && e.detail?.reason === 'updated') reload(); });
document.addEventListener('click', e => { if (e.target.closest?.('[data-go="profil"]')) refresh(); });
