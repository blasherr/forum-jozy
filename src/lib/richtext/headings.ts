import type { Block, RichDoc } from './types';
import { docToText, slugify } from './validate';

export interface HeadingRef {
  id: string;
  text: string;
  level: number;
}

/** Calcule les ancres des titres. Le sommaire et le rendu partagent ce calcul : elles correspondent toujours. */
export function extractHeadings(doc: RichDoc): HeadingRef[] {
  const seen = new Map<string, number>();
  const out: HeadingRef[] = [];
  for (const block of doc.content) {
    if (block.type !== 'heading') continue;
    const text = docToText(block).trim();
    if (!text) continue;
    const base = slugify(text) || 'section';
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.push({ id: n === 0 ? base : `${base}-${n + 1}`, text, level: block.attrs.level });
  }
  return out;
}

export function headingIds(blocks: Block[]): Map<Block, string> {
  const refs = extractHeadings({ type: 'doc', content: blocks });
  const map = new Map<Block, string>();
  let i = 0;
  for (const block of blocks) {
    if (block.type === 'heading' && docToText(block).trim()) {
      const ref = refs[i];
      if (ref) map.set(block, ref.id);
      i += 1;
    }
  }
  return map;
}
