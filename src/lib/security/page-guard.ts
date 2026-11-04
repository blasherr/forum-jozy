import 'server-only';
import { forbidden, redirect } from 'next/navigation';
import { env } from '@/env';
import { hasRole, type Role } from './guard';
import { getAuth, type AuthContext } from './session';

/**
 * Contrôle à placer en tête de chaque page du panel. Les routes /api le font déjà
 * pour les écritures ; ici on empêche aussi la simple lecture des pages.
 */
export async function requirePage(min: Role = 'editor', opts: { account?: boolean } = {}): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect('/connexion');
  if (!opts.account) {
    if (auth.user.mustChangePassword || (env.require2fa && !auth.user.totpEnabled)) redirect('/admin/compte');
  }
  if (!hasRole(auth.user.role, min)) redirect('/admin');
  return auth;
}

export { forbidden };
