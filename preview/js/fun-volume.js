/**
 * PM Musculation — comparaisons idiotes du volume soulevé, affichées en fin de séance.
 * Volume = somme des (charge × répétitions). Chaque objet a un poids (kg, approximatif et assumé) et deux
 * formulations : `one` (avec article, pour 1) et `many` (sans nombre, pour 2 et plus).
 * Aucun appel réseau ; le choix est déterministe (même séance = mêmes blagues) et « Une autre ! » fait défiler les suivantes.
 */
export const FUN_ITEMS = Object.freeze([
  { kg: 0.25, one: 'une baguette de pain (tradition)', many: 'baguettes de pain' },
  { kg: 8, one: 'un chat obèse qui te juge', many: 'chats obèses qui te jugent' },
  { kg: 9, one: 'un pack de 6 bouteilles d’eau', many: 'packs de 6 bouteilles d’eau' },
  { kg: 30, one: 'un labrador qui ne veut pas rentrer', many: 'labradors qui ne veulent pas rentrer' },
  { kg: 35, one: 'un sac de ciment de 35 kg', many: 'sacs de ciment de 35 kg' },
  { kg: 70, one: 'une machine à laver, tambour plein', many: 'machines à laver, tambour plein' },
  { kg: 80, one: 'ta grande tante avec son sac à main', many: 'grandes tantes avec leur sac à main' },
  { kg: 110, one: 'un panda géant en pleine sieste', many: 'pandas géants en pleine sieste' },
  { kg: 120, one: 'un scooter 125 avec son casque', many: 'scooters 125 avec leur casque' },
  { kg: 130, one: 'un frigo américain (vide, heureusement)', many: 'frigos américains (vides, heureusement)' },
  { kg: 190, one: 'un lion adulte qui n’est pas content', many: 'lions adultes qui ne sont pas contents' },
  { kg: 250, one: 'un piano droit, sans le pianiste', many: 'pianos droits, sans le pianiste' },
  { kg: 300, one: 'une grosse moto avec son plein fait', many: 'grosses motos avec leur plein fait' },
  { kg: 450, one: 'un ours polaire (très poli)', many: 'ours polaires (très polis)' },
  { kg: 500, one: 'un cheval de trait', many: 'chevaux de trait' },
  { kg: 580, one: 'un piano à queue et son pianiste', many: 'pianos à queue avec leur pianiste' },
  { kg: 700, one: 'une vache normande', many: 'vaches normandes' },
  { kg: 880, one: 'une Twingo avec le coffre plein de courses', many: 'Twingo avec le coffre plein de courses' },
  { kg: 1025, one: 'une Clio 2 avec ta grande tante dedans', many: 'Clio 2 avec chacune une grande tante dedans' },
  { kg: 1200, one: 'une girafe (debout, évidemment)', many: 'girafes (debout, évidemment)' },
  { kg: 1500, one: 'un hippopotame de mauvaise humeur', many: 'hippopotames de mauvaise humeur' },
  { kg: 2300, one: 'un rhinocéros blanc', many: 'rhinocéros blancs' },
  { kg: 3500, one: 'un camping-car chargé jusqu’au toit', many: 'camping-cars chargés jusqu’au toit' },
  { kg: 5500, one: 'un éléphant d’Afrique', many: 'éléphants d’Afrique' },
  { kg: 8000, one: 'un tyrannosaure grandeur nature', many: 'tyrannosaures grandeur nature' },
  { kg: 13000, one: 'un bus de ville avec les passagers qui râlent', many: 'bus de ville avec les passagers qui râlent' },
  { kg: 24000, one: 'un conteneur de 20 pieds plein à craquer', many: 'conteneurs de 20 pieds pleins à craquer' },
  { kg: 30000, one: 'une baleine à bosse', many: 'baleines à bosse' },
  { kg: 41000, one: 'un Boeing 737 sans les valises', many: 'Boeing 737 sans les valises' },
  { kg: 68000, one: 'une motrice de TGV', many: 'motrices de TGV' },
  { kg: 204000, one: 'la statue de la Liberté (sans le socle)', many: 'statues de la Liberté (sans le socle)' },
  { kg: 10100000, one: 'la tour Eiffel, touristes non compris', many: 'tours Eiffel, touristes non compris' }
]);

const SENTENCES = Object.freeze([
  p => `Tu as soulevé ${p}.`,
  p => `Aujourd’hui, tu as bougé ${p}.`,
  p => `Ça fait ${p}.`,
  p => `Tes muscles disent : « ${p}, c’est noté. »`,
  p => `Information inutile mais vraie : ${p}.`,
  p => `En clair : ${p}.`
]);

const nf = n => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

function rng(seed) { // mulberry32 : petit générateur déterministe
  let t = seed >>> 0;
  return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
function hash(text) { let h = 2166136261; for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** « 3 Clio 2 avec chacune une grande tante dedans » ou « une Clio 2 avec ta grande tante dedans ». */
export function describe(item, n) { return n === 1 ? item.one : nf(n) + ' ' + item.many; }

/**
 * Comparaisons pour un volume (kg). `seed` (ex. identifiant de séance) rend le choix stable.
 * @returns {string[]} phrases, la plus drôle d'abord ; tableau vide si le volume est nul.
 */
export function funComparisons(volumeKg, seed = '', max = 6) {
  const v = Number(volumeKg);
  if (!Number.isFinite(v) || v <= 0) return [];
  const rand = rng(hash(seed) ^ Math.round(v));
  const options = [];
  for (const item of FUN_ITEMS) {
    const n = Math.round(v / item.kg);
    if (n >= 1 && n <= 25) options.push({ item, n, spread: Math.abs(Math.log(v / (item.kg * n))) });
  }
  // priorité aux comparaisons « justes » (peu d'écart), mais l'ordre reste varié
  options.sort((a, b) => a.spread - b.spread + (rand() - 0.5) * 0.6);
  const out = [];
  const start = Math.floor(rand() * SENTENCES.length);
  options.slice(0, max).forEach((o, i) => out.push(SENTENCES[(start + i) % SENTENCES.length](describe(o.item, o.n))));
  return out;
}
