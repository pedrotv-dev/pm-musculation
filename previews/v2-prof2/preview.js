/* Prototype autonome : aucun import du moteur ou des données de l'application. */
(() => {
'use strict';
const screen = document.querySelector('#screen');
const goals = ['Prise de muscle','Perte de graisse','Renforcement','Force','Remise en forme'];
const days = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const gear = ['Salle','Machines guidées','Poids libres','Maison','Aucun matériel'];
const profiles = [{name:'Pierre',accent:'bleu',kind:'pierre'},{name:'Manon',accent:'violet',kind:'manon'},{name:'Démo',accent:'violet',kind:'demo'},{name:'Alex',accent:'bleu',kind:'new',example:true}];
let active = 0, step = 0, tab = 'Profil', error = '';
let draft = fresh();
function fresh() { return {name:'',accent:'bleu',goal:'',frequency:'',days:[],duration:'',gear:[]}; }
function esc(s) { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function korv(text,mood='stage-0') { return `<aside class="korv"><img src="../../assets/mascot/${mood}.png" alt="Korv"><p>${text}</p></aside>`; }
function options(values,key,multi=false,hints=[]) {
return `<div class="options ${key==='accent'?'two':''} ${key==='days'?'days':''}">${values.map((value,i)=>`<label class="option"><input type="${multi?'checkbox':'radio'}" name="${key}" value="${esc(value)}" ${(multi?draft[key].includes(value):draft[key]===value)?'checked':''}><span>${esc(value)}${hints[i]?`<small>${hints[i]}</small>`:''}</span></label>`).join('')}</div>`;
}
function heading(kicker,title,desc) { return `<p class="eyebrow">${kicker}</p><h1 tabindex="-1">${title}</h1><p class="description">${desc}</p>`; }
function nav() {
document.querySelector('.bottom-nav-inner').innerHTML=['Accueil','Séances','Progression','Profil'].map((t,i)=>`<button class="nav-btn ${tab===t?'active':''}" data-tab="${t}" ${tab===t?'aria-current="page"':''}><svg aria-hidden="true"><use href="../../assets/ascent/icones.svg#ico-${['accueil','seances','progression','profil'][i]}"/></svg>${t}</button>`).join('');
}
function render(focus=true) {
nav();
if(tab!=='Profil') {
screen.innerHTML=heading('Aperçu · '+esc(profiles[active].name),tab,'Ce profil fictif n’a pas encore de programme.')+`<section class="panel empty"><h3>Tout commence par votre profil</h3><p>Vous pourrez préparer un programme avec ChatGPT plus tard, puis l’importer après validation.</p><button class="primary" data-action="profiles">Choisir un profil</button></section>`;
} else if(step===0) {
screen.innerHTML=heading('Votre espace','Qui s’entraîne aujourd’hui ?','Chaque profil garde son propre rythme. Choisissez un espace ou créez le vôtre.')+korv('Bienvenue ! On prépare votre profil en cinq petites étapes.')+`<div class="choice-grid" aria-label="Profils fictifs">${profiles.map((p,i)=>`<button class="choice ${p.kind}" data-profile="${i}" aria-pressed="${active===i}"><span class="initial">${esc(p.name.slice(0,1))}</span><strong>${esc(p.name)}</strong><span>${active===i?'✓ Profil actif':p.example?'Exemple de nouveau profil':p.kind==='demo'?'Découvrir sans engagement':'Choisir ce profil'}</span></button>`).join('')}</div><p class="notice small-muted" role="status">Profil actif : ${esc(profiles[active].name)} · sélection fictive</p><button class="primary" data-action="start">${draft.name?'Reprendre mon brouillon':'Créer un profil'}</button><p class="footnote">Vos essais disparaissent à la fermeture ou au rechargement.</p>`;
} else if(step===6) {
screen.innerHTML=`<section class="panel confirm"><img src="../../assets/mascot/stage-0-cheer.png" alt="Korv vous encourage"><p class="eyebrow">Profil prêt · simulation</p><h1 tabindex="-1">Bienvenue, ${esc(profiles[active].name)} !</h1><p class="description">Votre espace est prêt pour la suite.</p><p>Aucun programme n’est encore associé à ce profil. Vous pourrez en préparer un avec ChatGPT plus tard. Rien n’est généré automatiquement ici.</p><button class="primary" data-action="profiles">Voir mes profils</button><p class="footnote">Profil fictif créé uniquement pour cet aperçu.</p></section>`;
} else {
const titles=['Faisons connaissance','Votre cap, à votre rythme','Une place dans votre semaine','Avec quoi vous entraînez-vous ?','Tout vous ressemble ?'];
const desc=['Un prénom ou un pseudo suffit.','Choisissez votre priorité du moment.','Des repères modifiables plus tard.','Plusieurs choix sont possibles.','Vérifiez vos choix avant de créer votre espace.'];
let body='';
if(step===1) body=`<label class="field" for="name">Nom ou pseudo</label><input id="name" name="name" type="text" autocomplete="nickname" inputmode="text" enterkeyhint="next" maxlength="24" value="${esc(draft.name)}" aria-describedby="name-help${error?' form-error':''}" ${error?'aria-invalid="true"':''}><p id="name-help" class="small-muted">Entre 2 et 24 caractères. Aucun nom complet requis.</p><fieldset class="notice"><legend>Votre accent</legend>${options(['bleu','violet'],'accent',false,['Bleu de Pierre','Violet de Manon'])}</fieldset><div class="profile-preview ${draft.accent==='violet'?'violet':''}"><span class="avatar" id="avatar">${esc(draft.name.trim().slice(0,1)||'?')}</span><div id="live-preview"><strong>${esc(draft.name.trim()||'Votre pseudo')}</strong><p class="small-muted">Aperçu de votre profil</p></div></div>`;
if(step===2) body=`<fieldset><legend>Objectif principal</legend>${options(goals,'goal',false,['Développer sa musculature','Faire évoluer sa composition corporelle','Se sentir plus solide au quotidien','Progresser sur les charges','Reprendre progressivement'])}</fieldset>`;
if(step===3) body=`<label class="field" for="frequency">Séances par semaine</label><select id="frequency" name="frequency"><option value="">Choisir une fréquence</option>${[1,2,3,4,5,6,7].map(n=>`<option ${draft.frequency===String(n)?'selected':''} value="${n}">${n} séance${n>1?'s':''}</option>`).join('')}</select><fieldset class="notice"><legend>Jours envisagés · facultatif</legend><p class="small-muted">Vous pouvez décider plus tard. Si renseignés, choisissez autant de jours que de séances.</p>${options(days,'days',true)}</fieldset><label class="field" for="duration">Durée d’une séance</label><select id="duration" name="duration"><option value="">Choisir une durée</option>${['20 min','30 min','45 min','60 min','75 min','90 min'].map(v=>`<option ${draft.duration===v?'selected':''}>${v}</option>`).join('')}</select>`;
if(step===4) body=`<fieldset><legend>Votre environnement et votre matériel</legend>${options(gear,'gear',true,['Accès à une salle de sport','Appareils qui guident le mouvement','Haltères, barres…','Entraînement à domicile','Au poids du corps'])}</fieldset><p class="small-muted">« Aucun matériel » peut être associé à « Maison », mais exclut salle, machines et poids libres. Ces choix ne créent aucun programme.</p>`;
if(step===5) body=`<div class="profile-preview ${draft.accent==='violet'?'violet':''}"><span class="avatar">${esc(draft.name.slice(0,1))}</span><strong>${esc(draft.name)}</strong></div><dl><dt>Accent</dt><dd>${esc(draft.accent)}</dd><dt>Objectif</dt><dd>${esc(draft.goal)}</dd><dt>Votre rythme</dt><dd>${draft.frequency} séance(s) / semaine · ${esc(draft.duration)}</dd><dt>Jours envisagés</dt><dd>${esc(draft.days.join(', ')||'À définir plus tard')}</dd><dt>Matériel</dt><dd>${esc(draft.gear.join(', '))}</dd></dl>${korv('Un bon départ : un rythme qui vous convient.','stage-0-happy')}<p class="small-muted">La création du profil ne génère pas de programme. ChatGPT pourra vous aider à le préparer plus tard.</p>`;
screen.innerHTML=heading('Créer un profil · étape '+step+' sur 5',titles[step-1],desc[step-1])+`<ol class="step-track" aria-label="Étape ${step} sur 5">${titles.map((t,i)=>`<li class="${i<step?'done':''}" aria-label="${i+1}. ${t}"></li>`).join('')}</ol><form novalidate><section class="panel">${body}<div id="form-error" class="error" role="alert" tabindex="-1" ${error?'':'hidden'}>${esc(error)}</div></section><div class="actions"><button class="secondary" type="button" data-action="back">Retour</button><button class="primary" type="submit">${step===5?'Créer mon profil':'Continuer'}</button></div></form><p class="footnote">Brouillon conservé pendant cet essai uniquement.</p>`;
screen.querySelector('form').addEventListener('submit',next);
}
if(focus) {screen.querySelector('h1')?.focus(); window.scrollTo(0,0);}
}
function validate() {
const n=draft.name.trim();
if(step===1) {
if(n.length<2||n.length>24||/[\u0000-\u001f\u007f]/.test(n)) return 'Saisissez un nom ou pseudo de 2 à 24 caractères.';
if(profiles.some(p=>p.name.toLocaleLowerCase('fr')===n.toLocaleLowerCase('fr'))) return 'Ce nom existe déjà dans cet aperçu. Choisissez un autre pseudo.';
}
if(step===2&&!draft.goal) return 'Choisissez votre objectif principal pour continuer.';
if(step===3) {
if(!draft.frequency||!draft.duration) return 'Choisissez le nombre de séances et leur durée.';
if(draft.days.length&&draft.days.length!==Number(draft.frequency)) return 'Choisissez autant de jours que de séances, ou laissez les jours à définir.';
}
if(step===4&&!draft.gear.length) return 'Choisissez au moins un environnement ou « Aucun matériel ».';
return '';
}
function next(e) {
e.preventDefault(); error=validate();
if(error) {render(false); screen.querySelector('#form-error').focus(); return;}
if(step===1) draft.name=draft.name.trim();
if(step===5) {profiles.push({name:draft.name,accent:draft.accent,kind:draft.accent==='violet'?'manon':'pierre'}); active=profiles.length-1; draft=fresh();}
step++; render();
}
screen.addEventListener('input',e=>{
if(e.target.name==='name') {
draft.name=e.target.value;
screen.querySelector('#avatar').textContent=draft.name.trim().slice(0,1)||'?';
screen.querySelector('#live-preview strong').textContent=draft.name.trim()||'Votre pseudo';
}
});
screen.addEventListener('change',e=>{
const {name,value,checked}=e.target;
if(!name||name==='name') return;
if(error) { error=''; const alert=screen.querySelector('#form-error'); if(alert) {alert.hidden=true;alert.textContent='';} screen.querySelector('[aria-invalid]')?.removeAttribute('aria-invalid'); }
if(['days','gear'].includes(name)) {
draft[name]=checked?[...draft[name],value]:draft[name].filter(v=>v!==value);
if(name==='gear'&&checked) {
if(value==='Aucun matériel') draft.gear=draft.gear.filter(v=>!['Salle','Machines guidées','Poids libres'].includes(v));
if(['Salle','Machines guidées','Poids libres'].includes(value)) draft.gear=draft.gear.filter(v=>v!=='Aucun matériel');
screen.querySelectorAll('[name=gear]').forEach(i=>i.checked=draft.gear.includes(i.value));
}
} else draft[name]=value;
if(name==='accent') screen.querySelector('.profile-preview').classList.toggle('violet',value==='violet');
});
screen.addEventListener('click',e=>{
const button=e.target.closest('button'); if(!button)return;
if(button.dataset.profile!==undefined) {active=Number(button.dataset.profile); render(false);return;}
const action=button.dataset.action; if(!action)return;
error='';
if(action==='start')step=1;
if(action==='back')step--;
if(action==='profiles'){step=0;tab='Profil';}
render();
});
document.querySelector('nav').addEventListener('click',e=>{
const button=e.target.closest('[data-tab]'); if(!button)return;
tab=button.dataset.tab; error=''; render();
});
render(false);
})();
