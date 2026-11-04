import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/content/queries';

/** RFC 9116 : indique aux chercheurs comment signaler une faille. */
export async function GET() {
  const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
  const site = await getSetting('site');
  const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
  const body = [
    `# ${site.name}`,
    `Contact: ${origin}/discord`,
    `Expires: ${expires}`,
    'Preferred-Languages: fr, en',
    `Canonical: ${origin}/.well-known/security.txt`,
    '',
  ].join('\n');
  return new NextResponse(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
