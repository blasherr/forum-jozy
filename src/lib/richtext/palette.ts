/**
 * Choix proposés dans l'éditeur. Le contenu ne stocke QUE ces clés, jamais de CSS libre :
 * aucune injection de style n'est possible, et la CSP peut rester stricte sans `unsafe-inline`.
 */
export const INK_COLORS = [
  { key: 'ink', label: 'Encre noire', hex: '#1c140d' },
  { key: 'sepia', label: 'Sépia', hex: '#4a3220' },
  { key: 'umber', label: 'Terre d’ombre', hex: '#6b4a2f' },
  { key: 'blood', label: 'Sang séché', hex: '#7a1712' },
  { key: 'crimson', label: 'Carmin', hex: '#a51d1d' },
  { key: 'rust', label: 'Rouille', hex: '#a4431c' },
  { key: 'ochre', label: 'Ocre', hex: '#a86f13' },
  { key: 'gold', label: 'Or vieilli', hex: '#8f6c1d' },
  { key: 'olive', label: 'Olive', hex: '#5c5a24' },
  { key: 'forest', label: 'Sapin', hex: '#2f4a2b' },
  { key: 'teal', label: 'Vert-de-gris', hex: '#24524f' },
  { key: 'navy', label: 'Bleu de Prusse', hex: '#1f3350' },
  { key: 'indigo', label: 'Indigo', hex: '#3b2f5e' },
  { key: 'plum', label: 'Lie de vin', hex: '#5b2440' },
  { key: 'slate', label: 'Ardoise', hex: '#4a4a48' },
  { key: 'bone', label: 'Ivoire', hex: '#efe3c8' },
] as const;

export const HIGHLIGHT_COLORS = [
  { key: 'straw', label: 'Paille', hex: '#ecd98a' },
  { key: 'peach', label: 'Pêche', hex: '#eebb8e' },
  { key: 'rose', label: 'Rose fané', hex: '#e6a9a0' },
  { key: 'sage', label: 'Sauge', hex: '#bccb9b' },
  { key: 'sky', label: 'Ciel', hex: '#b1c7cf' },
  { key: 'lilac', label: 'Lilas', hex: '#c8b7d6' },
  { key: 'ash', label: 'Cendre', hex: '#c9c2b4' },
] as const;

export const FONT_CHOICES = [
  { key: 'fell', label: 'Fell English (texte)' },
  { key: 'caslon', label: 'Caslon (texte)' },
  { key: 'playfair', label: 'Playfair (titrage)' },
  { key: 'rye', label: 'Rye (western)' },
  { key: 'sancreek', label: 'Sancreek (affiche)' },
  { key: 'plume', label: 'Plume (manuscrit)' },
  { key: 'mono', label: 'Machine (code)' },
] as const;

export const FONT_SIZES = [
  { key: 'xs', label: '11' },
  { key: 'sm', label: '13' },
  { key: 'md', label: '15' },
  { key: 'lg', label: '18' },
  { key: 'xl', label: '22' },
  { key: 'xxl', label: '28' },
  { key: 'xxxl', label: '36' },
] as const;

export const CALLOUTS = [
  { key: 'note', label: 'Note' },
  { key: 'warning', label: 'Attention' },
  { key: 'danger', label: 'Important' },
  { key: 'success', label: 'Terminé' },
] as const;

export const IMAGE_SIZES = ['small', 'medium', 'large', 'full'] as const;
export const ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const;

export type InkKey = (typeof INK_COLORS)[number]['key'];
export type HighlightKey = (typeof HIGHLIGHT_COLORS)[number]['key'];
export type FontKey = (typeof FONT_CHOICES)[number]['key'];
export type SizeKey = (typeof FONT_SIZES)[number]['key'];
export type CalloutKey = (typeof CALLOUTS)[number]['key'];
export type ImageSize = (typeof IMAGE_SIZES)[number];
export type Alignment = (typeof ALIGNMENTS)[number];
