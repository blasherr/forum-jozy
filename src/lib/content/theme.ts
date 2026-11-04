import type { ThemeSettings } from './schemas';

const FONT_VARS: Record<string, string> = {
  rye: '--font-rye',
  sancreek: '--font-sancreek',
  ewert: '--font-ewert',
  smokum: '--font-smokum',
  holtwood: '--font-holtwood',
  playfair: '--font-playfair',
  fell: '--font-fell',
  caslon: '--font-caslon',
  oldstandard: '--font-oldstandard',
  garamond: '--font-garamond',
};

const UUID = /^[0-9a-f-]{36}$/;

/**
 * Feuille de style du thème. Elle est construite uniquement à partir de valeurs déjà validées
 * (hex stricts, clés d'énumération, UUID) puis servie avec le nonce de la CSP :
 * aucune chaîne libre ne peut atteindre le CSS.
 */
export function themeCss(theme: ThemeSettings): string {
  const { colors, fonts, paper, backgroundMediaId } = theme;
  const hex = (v: string) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : '#000000');
  const font = (key: string) => `var(${FONT_VARS[key] ?? '--font-fell'})`;
  const tile = ['paper', 'paper-light', 'paper-aged'].includes(paper) ? paper : 'paper';
  const bg = backgroundMediaId && UUID.test(backgroundMediaId) ? `url(/media/${backgroundMediaId})` : 'none';
  const sheetBg = tile === 'paper-light' ? '#f0e6d1' : tile === 'paper' ? '#e8dcc1' : '#dccaa4';
  return `:root{--blood:${hex(colors.blood)};--gold:${hex(colors.gold)};--ink:${hex(colors.ink)};--paper:${hex(colors.paper)};--night:${hex(colors.night)};--f-display:${font(fonts.display)};--f-heading:${font(fonts.heading)};--f-body:${font(fonts.body)};--tex-paper:url(/textures/${tile}.webp);--tex-sheet:url(/textures/sheet-${tile}.webp);--sheet-bg:${sheetBg};--custom-bg:${bg}}`;
}
