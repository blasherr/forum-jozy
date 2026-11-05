import 'server-only';
import { cookies } from 'next/headers';
import { env } from '@/env';
import { DESIGNS, type Design } from './schemas';

/** Même règle que la session : en ligne, le préfixe __Host- interdit qu'un sous-domaine pose ce cookie. */
const cookieName = () => (env.isProd ? '__Host-nf_design' : 'nf_design');

const base = () => ({ httpOnly: true, secure: env.isProd, sameSite: 'lax' as const, path: '/' });

export function isDesign(value: string | undefined): value is Design {
  return DESIGNS.some((d) => d === value);
}

/** La valeur vient du navigateur : elle ne sert que si elle figure dans la liste fermée des designs. */
export async function readDesignPreview(): Promise<Design | null> {
  const value = (await cookies()).get(cookieName())?.value;
  return isDesign(value) ? value : null;
}

export async function startDesignPreview(design: Design) {
  (await cookies()).set({ name: cookieName(), value: design, ...base(), maxAge: 8 * 3600 });
}

export async function stopDesignPreview() {
  (await cookies()).set({ name: cookieName(), value: '', ...base(), maxAge: 0 });
}
