/**
 * PM Musculation — mode exploration avec donnees fictives, sans IndexedDB.
 * L'utilisateur peut consulter les ecrans, les statistiques et les seances exemple.
 */
import { demoSessions, demoStats, demoWeights, demoRecords } from './demo-data.js';

const body = document.documentElement;
const home = document.querySelector('[data-page="accueil"]');
const history = document.querySelector('[data-page="historique"]');
const progress = document.querySelector('[data-page="progres"]');
const original = {
  home: home.innerHTML,
  history: history.innerHTML,
  progress: progress.innerHTML
};
const formatDate = s => {
  const [y,m,d] = s.split('-');
  return d + '/' + m + '/' + y;
};
const create = (tag, cls, text) => {
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  if (text != null) x.textContent = String(text);
  return x;
};
function demoTag() { return create('span','tag','DONNÉES FICTIVES · DÉMO'); }
function card(title) {
  const x = create('article','panel');
  x.append(create('h3','',title));
  return x;
}
function statsCard() {
  const box = card('Vue d’ensemble');
  const grid = create('div','pm-demo-stats');
  [
    [demoStats.sessions,'Séances'],
    [demoStats.completed,'Terminées'],
    [demoStats.totalSets,'Séries réalisées'],
    [Math.round(demoStats.totalMinutes / 60 * 10) / 10 + ' h','Temps cumulé']
  ].forEach(([v,label])=>{
    const stat = create('div','pm-demo-stat');
    stat.append(create('strong','',v),create('span','',label));
    grid.append(stat);
  });
  box.append(grid);
  return box;
}
function sessionRow(s) {
  const item = create('div','pm-demo-session');
  const click = create('button','pm-demo-session-button');
  click.type = 'button';
  click.setAttribute('aria-expanded','false');
  const left = create('span','');
  left.append(create('strong','',s.name),create('small','',formatDate(s.date)));
  const right = create('span','pm-demo-session-meta',
    (s.status === 'completed' ? 'Terminée' : 'Partielle') + ' · ' + s.duration + ' min');
  click.append(left,right);
  const details = create('div','pm-demo-session-details');
  details.hidden = true;
  details.append(
    create('p','',s.sets + ' séries enregistrées'),
    create('p','',s.volume.toLocaleString('fr-FR') + ' kg de volume estimé'),
    create('p','pm-muted','Exemple fictif : aucune série n’est enregistrée dans ton historique.')
  );
  click.addEventListener('click',()=>{
    details.hidden = !details.hidden;
    click.setAttribute('aria-expanded',String(!details.hidden));
  });
  item.append(click,details);
  return item;
}
function chart() {
  const box = card('Évolution du poids · exemple');
  const chart = create('div','pm-demo-weight-chart');
  const min = Math.min(...demoWeights.map(w=>w.kg)) - 1;
  const max = Math.max(...demoWeights.map(w=>w.kg)) + 0.6;
  demoWeights.forEach(w=>{
    const column = create('div','pm-demo-weight-col');
    const val = create('strong','',w.kg.toFixed(1));
    const bar = create('div','pm-demo-weight-bar');
    bar.style.height = Math.round(35 + (w.kg-min)/(max-min)*96) + 'px';
    const label = create('span','',w.date.slice(5).replace('-','/'));
    column.append(val,bar,label);
    chart.append(column);
  });
  box.append(chart,create('p','pm-muted','Valeurs fictives : ce graphique illustre uniquement l’interface.'));
  return box;
}
function recordsCard() {
  const box = card('Records personnels · exemple');
  const list = create('div','pm-demo-records');
  demoRecords.forEach(r=>{
    const row = create('div','pm-demo-record');
    row.append(create('span','',r.name),create('strong','',r.before + ' → ' + r.after + ' ' + r.unit));
    list.append(row);
  });
  box.append(list);
  return box;
}
function demoHome() {
  home.replaceChildren();
  home.append(create('div','eyebrow','Mode exploration'),create('h2','','Bienvenue dans PM Musculation'));
  const note = create('p','description',
    'Découvre les programmes, l’historique et les progrès avec des exemples déjà remplis.');
  home.append(note);
  const badge = create('p','pm-demo-banner');
  badge.append(demoTag(), document.createTextNode(' Aucune donnée de cette démo ne sera ajoutée à Pierre ou Manon.'));
  home.append(badge,statsCard());
  const panel = card('Ce que tu peux explorer');
  const list = create('ul','pm-demo-guide');
  ['Programme : cinq journées et leurs séries',
   'Historique : dix séances fictives, dont une partielle',
   'Progrès : graphiques et records exemples',
   'Profil : changer pour Pierre ou Manon sans importer les données démo']
    .forEach(s=>list.append(create('li','',s)));
  panel.append(list); home.append(panel);
}
function demoHistory() {
  history.replaceChildren();
  history.append(create('div','eyebrow','Mode exploration'),create('h2','','Historique des séances'));
  history.append(create('p','description','Dix séances fictives, consultables sans enregistrer de résultats.'));
  const p = card('Séances récentes');
  [...demoSessions].reverse().forEach(s=>p.append(sessionRow(s)));
  history.append(p);
}
function demoProgress() {
  progress.replaceChildren();
  progress.append(create('div','eyebrow','Mode exploration'),create('h2','','Mes progrès'),
    create('p','description','Aperçu des statistiques et graphiques avec des exemples fictifs.'),
    chart(), recordsCard());
}
function update(profile) {
  if (profile === 'demo') {
    body.classList.add('pm-demo-mode');
    demoHome(); demoHistory(); demoProgress();
  } else {
    body.classList.remove('pm-demo-mode');
    home.innerHTML = original.home;
    history.innerHTML = original.history;
    progress.innerHTML = original.progress;
    // Retablit les boutons de navigation remplacés par innerHTML.
    home.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click',()=>{
      document.querySelector('.nav-btn[data-go="'+button.dataset.go+'"]')?.click();
    }));
  }
}
document.addEventListener('pm:profile-changed', e => update(e.detail.profile));
update(body.dataset.pmProfile || (()=>{try{return localStorage.getItem('pm-musculation:profile:v2');}catch(_){return null;}})());
