import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/site/LoginForm';
import { Ornament, Seal } from '@/components/site/parts';
import { getSetting } from '@/lib/content/queries';
import { getAuth, getPendingAuth } from '@/lib/security/session';

export const metadata: Metadata = { title: 'Connexion', robots: { index: false, follow: false } };

export default async function LoginPage() {
  const [auth, pending, pages] = await Promise.all([getAuth(), getPendingAuth(), getSetting('pages')]);
  if (auth) redirect('/admin');
  const header = pages.connexion;
  return (
    <div className="login-page">
      <section className="login paper">
        <Seal color="black" className="login-seal" size={110} />
        {header.kicker ? <p className="kicker">{header.kicker}</p> : null}
        <h1>{header.title}</h1>
        <Ornament />
        {header.subtitle ? <p className="login-sub">{header.subtitle}</p> : null}
        <LoginForm needsCode={Boolean(pending)} />
      </section>
    </div>
  );
}
