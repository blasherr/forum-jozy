import { and, count, desc, eq, gt } from 'drizzle-orm';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/admin/Icon';
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
    canAudit ? db.select().from(auditLog).orderBy(desc(auditLog.at)).limit(7) : [],
  ]);
  const n = (key: string) => counts.find((c) => c.collection === key)?.n ?? 0;

  const tiles: { label: string; value: number; href: string; icon: IconName }[] = [
    { label: 'Chapitres du règlement', value: n('rules'), href: '/admin/contenu/reglement', icon: 'scale' },
    { label: 'Tutoriels du guide', value: n('guide'), href: '/admin/contenu/guide', icon: 'book' },
    { label: 'Patch-notes publiés', value: n('patchnotes'), href: '/admin/contenu/patch-notes', icon: 'news' },
    { label: 'Images', value: mediaCount[0]?.n ?? 0, href: '/admin/medias', icon: 'image' },
  ];

  const actions: { label: string; text: string; href: string; icon: IconName }[] = [
    { label: 'Écrire un patch-note', text: 'Publier les nouveautés du serveur', href: '/admin/contenu/patch-notes/nouveau', icon: 'news' },
    { label: 'Modifier l’accueil', text: 'Bandeau, présentation, vote', href: '/admin/accueil', icon: 'layout' },
    { label: 'Modifier le règlement', text: 'Chapitres et articles', href: '/admin/contenu/reglement', icon: 'scale' },
    { label: 'Liens Discord', text: 'Boutons et invitations', href: '/admin/discord', icon: 'chat' },
  ];

  return (
    <div className="page">
      <header className="page-head page-head-row">
        <div>
          <h1>Bonjour {user.name}</h1>
          <p>Voici l’état de votre site aujourd’hui.</p>
        </div>
        <Link className="a-btn a-btn-primary" href="/admin/contenu/patch-notes/nouveau">
          <Icon name="plus" size={16} />
          Nouveau patch-note
        </Link>
      </header>

      {!user.totpEnabled ? (
        <div className="alert">
          <Icon name="alert" />
          <div>
            <strong>Double authentification désactivée</strong>
            <p>Un mot de passe seul ne suffit pas à protéger le site.</p>
          </div>
          <Link href="/admin/compte" className="a-btn">
            Activer
          </Link>
        </div>
      ) : null}

      <ul className="tiles">
        {tiles.map((tile) => (
          <li key={tile.href}>
            <Link href={tile.href} className="tile">
              <span className="tile-icon">
                <Icon name={tile.icon} size={20} />
              </span>
              <strong>{tile.value}</strong>
              <span>{tile.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid-main">
        <div>
          <section className="panel">
            <h2>Actions rapides</h2>
            <ul className="quick">
              {actions.map((a) => (
                <li key={a.href}>
                  <Link href={a.href}>
                    <span className="tile-icon">
                      <Icon name={a.icon} size={18} />
                    </span>
                    <span>
                      <strong>{a.label}</strong>
                      <small>{a.text}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {canAudit ? (
            <section className="panel">
              <div className="panel-head">
                <h2>Activité récente</h2>
                <Link className="a-link" href="/admin/journal">
                  Tout voir
                </Link>
              </div>
              {recent.length === 0 ? (
                <p className="hint">Rien pour l’instant.</p>
              ) : (
                <ul className="feed">
                  {recent.map((row) => (
                    <li key={row.id}>
                      <span>{AUDIT_LABELS[row.action] ?? row.action}</span>
                      <small>
                        {row.userEmail ?? 'Inconnu'} · {formatDateTime(row.at)}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>

        <aside>
          <section className="panel">
            <h2>Sécurité</h2>
            <ul className="checks">
              <li className={user.totpEnabled ? 'ok' : 'warn'}>
                <Icon name={user.totpEnabled ? 'shield-check' : 'shield'} />
                <span>
                  <strong>Double authentification</strong>
                  <small>{user.totpEnabled ? 'Activée' : 'À activer'}</small>
                </span>
              </li>
              {canAudit ? (
                <li className={(failed[0]?.n ?? 0) > 20 ? 'warn' : 'ok'}>
                  <Icon name="clock" />
                  <span>
                    <strong>{failed[0]?.n ?? 0} connexion(s) refusée(s)</strong>
                    <small>Dernières 24 heures</small>
                  </span>
                </li>
              ) : null}
              <li className={env.isProd ? 'ok' : 'warn'}>
                <Icon name="eye" />
                <span>
                  <strong>{env.isProd ? 'Production' : 'Mode développement'}</strong>
                  <small>{env.isProd ? 'Site en ligne' : 'Version locale, pas en ligne'}</small>
                </span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
