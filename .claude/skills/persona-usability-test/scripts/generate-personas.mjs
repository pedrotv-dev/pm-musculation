#!/usr/bin/env node
// Usage: node generate-personas.mjs [N=100] [--seed S]
const args = process.argv.slice(2);
const n = parseInt(args.find(a => /^\d+$/.test(a)) ?? '100', 10);
const si = args.indexOf('--seed');
let s = si >= 0 ? parseInt(args[si + 1], 10) : 42;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = a => a[Math.floor(rnd() * a.length)];

const jobs = ['infirmier·ère','agriculteur·rice','étudiant·e','cadre','retraité·e','ouvrier·ère','enseignant·e','chauffeur·se','développeur·se','vendeur·se','artisan·e','sans emploi','coach sportif','comptable','serveur·se','aide-soignant·e'];
const tech = ['débutant (peur de se tromper)','moyen','à l\'aise','expert'];
const devices = [
  { name: 'iPhone SE', viewport: { width: 375, height: 667 }, touch: true },
  { name: 'iPhone 14', viewport: { width: 390, height: 844 }, touch: true },
  { name: 'Android milieu de gamme', viewport: { width: 360, height: 800 }, touch: true },
  { name: 'iPad', viewport: { width: 820, height: 1180 }, touch: true },
  { name: 'Ordinateur portable', viewport: { width: 1366, height: 768 }, touch: false },
];
const access = ['aucun','aucun','aucun','vue faible (texte agrandi)','daltonisme','tremblements / motricité réduite','lecteur d\'écran','une seule main disponible'];
const network = ['normal','normal','4G lente','hors ligne en cours de séance'];
const context = ['à la salle, mains moites, pressé·e','chez soi, au calme','dans les transports','entre deux séries, distrait·e','première découverte, sans explication'];
const langue = ['français courant','français courant','français courant','français difficile (langue maternelle autre)'];

const out = Array.from({ length: n }, (_, i) => {
  const dev = pick(devices);
  return {
    id: 'p' + String(i + 1).padStart(3, '0'),
    age: 16 + Math.floor(rnd() * 64),
    job: pick(jobs),
    techLevel: pick(tech),
    sportExperience: pick(['jamais fait de muscu','débutant','régulier','confirmé']),
    device: dev.name, viewport: dev.viewport, hasTouch: dev.touch,
    accessibility: pick(access),
    network: pick(network),
    context: pick(context),
    language: pick(langue),
  };
});
console.log(JSON.stringify(out, null, 2));
