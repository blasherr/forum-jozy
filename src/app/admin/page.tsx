import { and, count, desc, eq, gt } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { auditLog, entries, media } from '@/db/schema';
import { env } from '@/env';
import { AUDIT_LABELS } from '@/lib/content/labels';
import { formatDateTime } from '@/lib/format';
import { hasRole } from '@/lib/security/guard';
import { requirePage } from '@/lib/security/page-guard';

export default async function Dashboard() {
  const { user } = await requirePage();
  const since = Date.now() - 24 * 3600 * 1000;
  // Le journal est réservé aux administrateurs, y compris son extrait sur le tableau de bord.
  const canAudit = hasRole(user.role, 'admin');
  const [counts, mediaCount, failed, recent] = await Promise.all([
    db.select({ collection: entries.collection, n: count() }).from(entries).groupBy(entries.collection),
    db.select({ n: count() }).from(media),
    canAudit
      ? db
          .select({ n: count() })
          .from(auditLog)
          .where(and(eq(auditLog.action, 'auth.failed'), gt(auditLog.at, since)))
      : [],
    canAudit ? db.select().from(auditLog).orderBy(desc(auditLog.at)).limit(8) : [],
  ]);
  const n = (key: string) => counts.find((c) => c.collection === key)?.n ?? 0;

  const tiles = [
    { label: 'Chapitres du règlement', value: n('rules'), href: '/admin/contenu/reglement' },
    { label: 'Tutoriels', value: n('guide'), href: '/admin/contenu/guide' },
    { label: 'Patch-notes', value: n('patchnotes'), href: '/admin/contenu/patch-notes' },
    { label: 'Images', value: mediaCount[0]?.n ?? 0, href: '/admin/medias' },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <h1>Bonjour {user.name}</h1>
        <p>Tout ce qui est visible sur le site se modifie depuis ce panel.</p>
      </header>

      {!user.totpEnabled ? (
        <p className="alert">
          La double authentification n’est pas activée sur votre compte.{' '}
          <Link href="/admin/compte">Activez-la maintenant</Link> : un mot de passe seul ne suffit pas à protéger le site.
        </p>
      ) : null}
      {!env.isProd ? <p className="alert alert-soft">Mode développement : ne pas utiliser ces réglages en ligne.</p> : null}

      <ul className="tiles">
        {tiles.map((tile) => (
          <li key={tile.href}>
            <Link href={tile.href} className="tile">
              <strong>{tile.value}</strong>
              <span>{tile.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid-2">
        <section className="panel">
          <h2>Publier rapidement</h2>
          <div className="stack">
            <Link className="a-btn a-btn-primary" href="/admin/contenu/patch-notes/nouveau">
              Rédiger un patch-note
            </Link>
            <Link className="a-btn" href="/admin/accueil">
              Modifier la page d’accueil
            </Link>
            <Link className="a-btn" href="/admin/contenu/reglement">
              Modifier le règlement
            </Link>
          </div>
        </section>
        {canAudit ? (
          <section className="panel">
            <h2>Dernières 24 heures</h2>
            <p className="big-number">{failed[0]?.n ?? 0}</p>
            <p className="hint">tentative(s) de connexion refusée(s)</p>
          </section>
        ) : null}
      </div>

      {canAudit ? (
        <section className="panel">
          <h2>Activité récente</h2>
          {recent.length === 0 ? (
            <p className="hint">Rien pour l’instant.</p>
          ) : (
            <table className="a-table">
            <tbody>
              {recent.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.at)}</td>
                  <td>{AUDIT_LABELS[row.action] ?? row.action}</td>
                  <td>{row.userEmail ?? '—'}</td>
                </tr>
              ))}
            </tbody>
            </table>
          )}
        </section>
      ) : null}
    </div>
  );
}
