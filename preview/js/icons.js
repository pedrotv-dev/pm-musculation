/**
 * PM Musculation — icônes ASCENT (livraison 3 : assets/ascent/icones.svg, 18 symboles en currentColor).
 * Le sprite est un fichier du précache : <use> le lit hors ligne via le service worker.
 */
export const SPRITE = 'assets/ascent/icones.svg';
export const ICONS = ['accueil', 'seances', 'progression', 'profil', 'reglages', 'calendrier', 'lecture', 'valider',
  'drapeau', 'cadeau', 'plus', 'moins', 'chevron', 'passer', 'machine-occupee', 'record', 'trophee', 'feuille'];
const NS = 'http://www.w3.org/2000/svg';

/** <svg class="pm-ico"><use href="assets/ascent/icones.svg#ico-…"/></svg>, décoratif (aria-hidden). */
export function icon(name, cls = 'pm-ico') {
  if (!ICONS.includes(name)) throw new Error('Icône inconnue : ' + name);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', SPRITE + '#ico-' + name);
  svg.append(use);
  return svg;
}
/** Ajoute l'icône devant le texte d'un bouton (le texte reste le nom accessible). */
export function withIcon(node, name) {
  node.prepend(icon(name));
  node.classList.add('pm-has-ico');
  return node;
}
