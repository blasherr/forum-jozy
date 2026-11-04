import { headingIds } from '@/lib/richtext/headings';
import { docToText } from '@/lib/richtext/validate';
import type { PublicEntry } from './queries';

export interface SearchHit {
  entry: PublicEntry;
  anchor: string | null;
  heading: string | null;
  snippet: string;
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/’/g, "'")
    .toLowerCase();

/**
 * Recherche en mémoire, sans SQL : la saisie de l'utilisateur n'atteint jamais la base.
 * On ne garde que des comparaisons de chaînes, donc ni injection ni ReDoS.
 */
export function searchEntries(entries: PublicEntry[], query: string, limit = 40): SearchHit[] {
  const needle = normalize(query.trim().slice(0, 80));
  if (needle.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const entry of entries) {
    const ids = headingIds(entry.body.content);
    let anchor: string | null = null;
    let heading: string | null = null;
    for (const block of entry.body.content) {
      if (block.type === 'heading') {
        anchor = ids.get(block) ?? null;
        heading = docToText(block);
      }
      const text = docToText(block).replace(/\s+/g, ' ').trim();
      const at = normalize(text).indexOf(needle);
      if (at < 0) continue;
      const start = Math.max(0, at - 70);
      const end = Math.min(text.length, at + needle.length + 110);
      hits.push({
        entry,
        anchor,
        heading,
        snippet: `${start > 0 ? '… ' : ''}${text.slice(start, end)}${end < text.length ? ' …' : ''}`,
      });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}
