import { NextResponse } from 'next/server';
import { db, dbReady } from '@/db/client';
import { siteVersion } from '@/db/schema';

/**
 * Numéro de version du contenu, interrogé par les pages ouvertes pour se mettre à jour.
 * Réponse minuscule, sans donnée sensible ; un seul accès base par seconde et par instance,
 * quel que soit le nombre de visiteurs.
 */
const store = globalThis as unknown as { __nfVersion?: { at: number; value: { v: number; t: number } } };

export async function GET() {
  const now = Date.now();
  let value = store.__nfVersion?.value;
  if (!value || now - (store.__nfVersion?.at ?? 0) > 1000) {
    await dbReady();
    const rows = await db.select().from(siteVersion).limit(1);
    value = { v: rows[0]?.content ?? 0, t: rows[0]?.theme ?? 0 };
    store.__nfVersion = { at: now, value };
  }
  return NextResponse.json(value, { headers: { 'Cache-Control': 'no-store' } });
}
