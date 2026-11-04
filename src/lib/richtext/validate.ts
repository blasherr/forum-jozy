import { ALIGNMENTS, CALLOUTS, FONT_CHOICES, FONT_SIZES, HIGHLIGHT_COLORS, IMAGE_SIZES, INK_COLORS } from './palette';
import type { Block, Inline, ListItem, Mark, RichDoc, TableCell, TableRow, TextNode } from './types';
import { safeHref, safeImageSrc } from './url';

/**
 * Le texte enrichi n'est JAMAIS du HTML : c'est un arbre JSON reconstruit ici, champ par champ,
 * à partir d'une liste blanche, puis affiché par React (tout est échappé).
 * Une balise, un attribut `onerror` ou un `style` n'ont tout simplement nulle part où exister :
 * les XSS stockées et les mXSS sont impossibles par construction, pas seulement filtrées.
 */

const MAX_DEPTH = 12;
const MAX_NODES = 20_000;
const MAX_TEXT = 400_000;
const MAX_MARKS = 8;

export class RichTextError extends Error {}

const fail = (message: string): never => {
  throw new RichTextError(message);
};

const keys = <T extends readonly { key: string }[]>(list: T) => new Set(list.map((i) => i.key));
const INKS = keys(INK_COLORS);
const HIGHLIGHTS = keys(HIGHLIGHT_COLORS);
const FONTS = keys(FONT_CHOICES);
const SIZES = keys(FONT_SIZES);
const VARIANTS = keys(CALLOUTS);
const ALIGN = new Set<string>(ALIGNMENTS);
const IMG = new Set<string>(IMAGE_SIZES);

interface Budget {
  nodes: number;
  text: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail('contenu invalide');
  return value as unknown[];
}

function attrsOf(node: Record<string, unknown>): Record<string, unknown> {
  return isRecord(node.attrs) ? node.attrs : {};
}

function cleanMark(raw: unknown): Mark | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') return fail('marque invalide');
  const attrs = attrsOf(raw);
  switch (raw.type) {
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike':
    case 'code':
      return { type: raw.type };
    case 'link': {
      const href = safeHref(attrs.href);
      // Un lien dangereux n'annule pas le document : la marque disparaît, le texte reste.
      return href ? { type: 'link', attrs: { href } } : null;
    }
    case 'inkColor':
      return typeof attrs.color === 'string' && INKS.has(attrs.color)
        ? ({ type: 'inkColor', attrs: { color: attrs.color } } as Mark)
        : null;
    case 'highlightColor':
      return typeof attrs.color === 'string' && HIGHLIGHTS.has(attrs.color)
        ? ({ type: 'highlightColor', attrs: { color: attrs.color } } as Mark)
        : null;
    case 'fontChoice':
      return typeof attrs.font === 'string' && FONTS.has(attrs.font)
        ? ({ type: 'fontChoice', attrs: { font: attrs.font } } as Mark)
        : null;
    case 'sizeChoice':
      return typeof attrs.size === 'string' && SIZES.has(attrs.size)
        ? ({ type: 'sizeChoice', attrs: { size: attrs.size } } as Mark)
        : null;
    default:
      return fail(`marque interdite : ${raw.type.slice(0, 32)}`);
  }
}

function cleanText(raw: Record<string, unknown>, budget: Budget): TextNode {
  if (typeof raw.text !== 'string' || raw.text.length === 0) fail('texte invalide');
  const text = raw.text as string;
  budget.text += text.length;
  if (budget.text > MAX_TEXT) fail('document trop long');
  const marks = asArray(raw.marks)
    .slice(0, MAX_MARKS)
    .map(cleanMark)
    .filter((m): m is Mark => m !== null);
  return marks.length > 0 ? { type: 'text', text, marks } : { type: 'text', text };
}

function cleanInline(content: unknown, budget: Budget): Inline[] {
  const out: Inline[] = [];
  for (const raw of asArray(content)) {
    if (!isRecord(raw)) fail('nœud invalide');
    const node = raw as Record<string, unknown>;
    tick(budget);
    if (node.type === 'text') out.push(cleanText(node, budget));
    else if (node.type === 'hardBreak') out.push({ type: 'hardBreak' });
    else fail('nœud en ligne interdit');
  }
  return out;
}

function tick(budget: Budget) {
  budget.nodes += 1;
  if (budget.nodes > MAX_NODES) fail('document trop volumineux');
}

function align(attrs: Record<string, unknown>) {
  return typeof attrs.textAlign === 'string' && ALIGN.has(attrs.textAlign) && attrs.textAlign !== 'left'
    ? (attrs.textAlign as 'center')
    : undefined;
}

function cleanItems(content: unknown, budget: Budget, depth: number): ListItem[] {
  return asArray(content).map((raw) => {
    if (!isRecord(raw) || raw.type !== 'listItem') return fail('élément de liste invalide');
    tick(budget);
    return { type: 'listItem' as const, content: cleanBlocks(raw.content, budget, depth + 1) };
  });
}

function span(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 1 && n <= 20 ? n : undefined;
}

function cleanCell(raw: unknown, budget: Budget, depth: number): TableCell {
  if (!isRecord(raw) || (raw.type !== 'tableCell' && raw.type !== 'tableHeader')) return fail('cellule invalide');
  tick(budget);
  const attrs = attrsOf(raw);
  const colspan = span(attrs.colspan);
  const rowspan = span(attrs.rowspan);
  const cell: TableCell = { type: raw.type, content: cleanBlocks(raw.content, budget, depth + 1) };
  if (colspan || rowspan) cell.attrs = { ...(colspan && { colspan }), ...(rowspan && { rowspan }) };
  return cell;
}

function cleanRows(content: unknown, budget: Budget, depth: number): TableRow[] {
  return asArray(content).map((raw) => {
    if (!isRecord(raw) || raw.type !== 'tableRow') return fail('ligne invalide');
    tick(budget);
    return { type: 'tableRow' as const, content: asArray(raw.content).map((c) => cleanCell(c, budget, depth)) };
  });
}

function cleanBlock(raw: unknown, budget: Budget, depth: number): Block | null {
  if (depth > MAX_DEPTH) fail('document trop imbriqué');
  if (!isRecord(raw) || typeof raw.type !== 'string') return fail('bloc invalide');
  tick(budget);
  const attrs = attrsOf(raw);
  switch (raw.type) {
    case 'paragraph': {
      const textAlign = align(attrs);
      const content = cleanInline(raw.content, budget);
      return {
        type: 'paragraph',
        ...(textAlign && { attrs: { textAlign } }),
        ...(content.length > 0 && { content }),
      };
    }
    case 'heading': {
      const level = Number(attrs.level);
      if (level !== 2 && level !== 3 && level !== 4) return fail('niveau de titre invalide');
      const textAlign = align(attrs);
      const content = cleanInline(raw.content, budget);
      return {
        type: 'heading',
        attrs: { level, ...(textAlign && { textAlign }) },
        ...(content.length > 0 && { content }),
      };
    }
    case 'codeBlock': {
      const content = asArray(raw.content).map((c) => {
        if (!isRecord(c) || c.type !== 'text' || typeof c.text !== 'string' || c.text.length === 0) {
          return fail('code invalide');
        }
        tick(budget);
        budget.text += c.text.length;
        if (budget.text > MAX_TEXT) fail('document trop long');
        return { type: 'text' as const, text: c.text };
      });
      return { type: 'codeBlock', ...(content.length > 0 && { content }) };
    }
    case 'horizontalRule':
      return { type: 'horizontalRule' };
    case 'image': {
      const src = safeImageSrc(attrs.src);
      if (!src) return null;
      const alt = typeof attrs.alt === 'string' ? attrs.alt.slice(0, 300) : '';
      const size = typeof attrs.size === 'string' && IMG.has(attrs.size) ? attrs.size : 'large';
      return { type: 'image', attrs: { src, alt, size: size as 'large' } };
    }
    case 'bulletList':
      return { type: 'bulletList', content: cleanItems(raw.content, budget, depth) };
    case 'orderedList': {
      const start = Number(attrs.start);
      const valid = Number.isInteger(start) && start > 1 && start < 100_000;
      return {
        type: 'orderedList',
        ...(valid && { attrs: { start } }),
        content: cleanItems(raw.content, budget, depth),
      };
    }
    case 'blockquote':
      return { type: 'blockquote', content: cleanBlocks(raw.content, budget, depth + 1) };
    case 'callout': {
      const variant = typeof attrs.variant === 'string' && VARIANTS.has(attrs.variant) ? attrs.variant : 'note';
      return { type: 'callout', attrs: { variant: variant as 'note' }, content: cleanBlocks(raw.content, budget, depth + 1) };
    }
    case 'table':
      return { type: 'table', content: cleanRows(raw.content, budget, depth) };
    default:
      return fail(`bloc interdit : ${raw.type.slice(0, 32)}`);
  }
}

function cleanBlocks(content: unknown, budget: Budget, depth: number): Block[] {
  return asArray(content)
    .map((b) => cleanBlock(b, budget, depth))
    .filter((b): b is Block => b !== null);
}

/** Reconstruit un document sûr. Tout champ non prévu est perdu ; tout type inconnu est refusé. */
export function sanitizeDoc(input: unknown): RichDoc {
  if (!isRecord(input) || input.type !== 'doc') fail('document invalide');
  const raw = input as Record<string, unknown>;
  const budget: Budget = { nodes: 0, text: 0 };
  const content = cleanBlocks(raw.content, budget, 0);
  return { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] };
}

/** Texte brut d'un document (recherche, compteur de mots, description). */
export function docToText(doc: RichDoc | Block | Inline): string {
  const node = doc as { type: string; text?: string; content?: unknown[] };
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return ' ';
  const children = (node.content ?? []) as (Block | Inline)[];
  const inner = children.map(docToText);
  const blockSeparated = ['doc', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'callout', 'table', 'tableRow'];
  return inner.join(blockSeparated.includes(node.type) ? '\n' : '');
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
