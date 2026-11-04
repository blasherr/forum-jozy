import type { NextRequest } from 'next/server';
import { login, loginSchema } from '@/lib/security/auth';
import { assertSameOrigin, errorResponse, json, readJson } from '@/lib/security/request';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { email, password } = await readJson(req, loginSchema, 2048);
    const { mfa } = await login(req, email, password);
    return json({ ok: true, mfa });
  } catch (error) {
    return errorResponse(error);
  }
}
