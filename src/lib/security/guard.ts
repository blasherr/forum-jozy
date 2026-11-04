import 'server-only';
import type { NextRequest, NextResponse } from 'next/server';
import { env } from '@/env';
import { assertSameOrigin, errorResponse, HttpError } from './request';
import { hit } from './ratelimit';
import { getAuth, verifyCsrf, type AuthContext } from './session';

export type Role = 'owner' | 'admin' | 'editor';

const RANK: Record<Role, number> = { editor: 1, admin: 2, owner: 3 };

export const hasRole = (role: Role, min: Role): boolean => RANK[role] >= RANK[min];

interface RouteOptions {
  /** Rôle minimum. */
  role?: Role;
  /** Exige une ré-saisie récente du mot de passe (10 min). */
  sudo?: boolean;
  /** Reste accessible pendant le changement de mot de passe imposé ou l'enrôlement 2FA. */
  account?: boolean;
}

type Handler<P> = (ctx: AuthContext & { req: NextRequest; params: P }) => Promise<NextResponse> | NextResponse;

/**
 * Point de passage unique de toutes les routes du panel.
 * L'autorisation est vérifiée ici, dans la route, et jamais seulement dans le proxy
 * (leçon de CVE-2025-29927 : un proxy contourné ne doit rien ouvrir).
 */
export function adminRoute<P = Record<string, never>>(options: RouteOptions, handler: Handler<P>) {
  return async (req: NextRequest, route: { params: Promise<P> }): Promise<NextResponse> => {
    try {
      const mutating = !['GET', 'HEAD'].includes(req.method);
      if (mutating) assertSameOrigin(req);

      const auth = await getAuth();
      if (!auth) throw new HttpError(401, 'unauthorized', 'Connexion requise.');

      if (mutating) {
        if (!verifyCsrf(auth.session.idHash, req.headers.get('x-csrf-token'))) {
          throw new HttpError(403, 'csrf', 'Jeton de sécurité invalide. Rechargez la page.');
        }
        const limit = await hit('admin-write', auth.user.id, 240, 60_000);
        if (!limit.allowed) {
          throw new HttpError(429, 'rate_limited', 'Trop de requêtes.', { 'Retry-After': String(limit.retryAfter) });
        }
      }

      if (!options.account) {
        if (auth.user.mustChangePassword) {
          throw new HttpError(403, 'password_change_required', 'Changez d’abord votre mot de passe.');
        }
        if (env.require2fa && !auth.user.totpEnabled) {
          throw new HttpError(403, 'mfa_required', 'Activez d’abord la double authentification.');
        }
      }

      if (options.role && !hasRole(auth.user.role, options.role)) {
        throw new HttpError(403, 'forbidden', 'Droits insuffisants.');
      }
      if (options.sudo && auth.session.sudoUntil <= Date.now()) {
        throw new HttpError(403, 'sudo_required', 'Confirmez votre mot de passe.');
      }

      const params = route?.params ? await route.params : ({} as P);
      return await handler({ ...auth, req, params });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
