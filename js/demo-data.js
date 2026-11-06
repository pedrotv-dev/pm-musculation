/**
 * PM Musculation V2 — donnees fictives pour le mode demonstration.
 * Exclusivement en memoire : jamais importees dans IndexedDB.
 */
const workout = (id, name, activities) => ({ id, name, activities });
const lift = (machineId, kg, reps, count=3, restSeconds=90, shared=true) => ({
  type:'strength', machineId, shared, restSeconds,
  sets: Array.from({length:count}, () => ({kg,reps}))
});
const warmup = (name, durationMinutes) => ({type:'warmup',name,durationMinutes});
const cardio = (name, durationMinutes) => ({type:'cardio',name,durationMinutes});
export const demoProgram = Object.freeze({
  schemaVersion:1,
  weekStart:'2026-11-02',
  profileId:'demo',
  days:[
    workout('lundi','Jambes & mollets',[
      warmup('Vélo assis',10),
      lift('leg-press',73,12),
      lift('leg-extension',39,12),
      lift('seated-leg-curl',39,12),
      lift('calf-press',52,15),
      cardio('Tapis de course',12)
    ]),
    workout('mardi','Haut du corps',[
      warmup('Vélo assis',10),
      lift('lat-pulldown',41,10),
      lift('chest-press',27,10),
      lift('seated-row',52,12),
      lift('shoulder-press',25,10),
      cardio('Vélo elliptique',12)
    ]),
    workout('mercredi','Cardio & abdominaux',[
      warmup('Tapis de course',10),
      lift('abdominal',45,15),
      lift('rotary-torso',41,12),
      cardio('Vélo assis',20)
    ]),
    workout('jeudi','Full body',[
      warmup('Rameur',8),
      lift('leg-press',66,12,2),
      lift('lat-pulldown',36,12,2),
      lift('chest-press',25,12,2),
      lift('seated-row',45,12,2),
      cardio('Tapis de course',10)
    ]),
    workout('vendredi','Renforcement complet',[
      warmup('Vélo assis',10),
      lift('leg-press',73,10),
      lift('chest-press',27,12),
      lift('seated-leg-curl',39,12),
      lift('abdominal',45,15),
      cardio('Vélo elliptique',15)
    ])
  ]
});
export const demoSessions = [
  {id:'demo-1',date:'2026-10-19',day:'lundi',name:'Jambes & mollets',status:'completed',duration:58,sets:12,volume:3028},
  {id:'demo-2',date:'2026-10-20',day:'mardi',name:'Haut du corps',status:'completed',duration:64,sets:15,volume:2710},
  {id:'demo-3',date:'2026-10-22',day:'jeudi',name:'Full body',status:'completed',duration:49,sets:8,volume:1930},
  {id:'demo-4',date:'2026-10-26',day:'lundi',name:'Jambes & mollets',status:'completed',duration:59,sets:12,volume:3230},
  {id:'demo-5',date:'2026-10-27',day:'mardi',name:'Haut du corps',status:'completed',duration:66,sets:15,volume:2895},
  {id:'demo-6',date:'2026-10-28',day:'mercredi',name:'Cardio & abdominaux',status:'completed',duration:47,sets:6,volume:1135},
  {id:'demo-7',date:'2026-10-29',day:'jeudi',name:'Full body',status:'partial',duration:37,sets:5,volume:1270},
  {id:'demo-8',date:'2026-11-02',day:'lundi',name:'Jambes & mollets',status:'completed',duration:61,sets:12,volume:3542},
  {id:'demo-9',date:'2026-11-03',day:'mardi',name:'Haut du corps',status:'completed',duration:62,sets:15,volume:3090},
  {id:'demo-10',date:'2026-11-04',day:'mercredi',name:'Cardio & abdominaux',status:'completed',duration:45,sets:6,volume:1225}
];
export const demoWeights = [
  {date:'2026-09-14',kg:68.7},
  {date:'2026-09-28',kg:69.1},
  {date:'2026-10-12',kg:69.6},
  {date:'2026-10-26',kg:70.0},
  {date:'2026-11-02',kg:70.3}
];
export const demoRecords = [
  {name:'Leg Press',before:66,after:73,unit:'kg'},
  {name:'Seated Row',before:45,after:59,unit:'kg'},
  {name:'Chest Press',before:25,after:32,unit:'kg'}
];
export const demoStats = {
  sessions: demoSessions.length,
  completed: demoSessions.filter(s=>s.status==='completed').length,
  totalMinutes: demoSessions.reduce((sum,s)=>sum+s.duration,0),
  totalSets: demoSessions.reduce((sum,s)=>sum+s.sets,0)
};
