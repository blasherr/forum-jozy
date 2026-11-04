import { desc } from 'drizzle-orm';
import { PageHead } from '@/components/admin/forms';
import { db } from '@/db/client';
import { auditLog } from '@/db/schema';
import { AUDIT_LABELS } from '@/lib/content/labels';
import { formatDateTime } from '@/lib/format';
import { requirePage } from '@/lib/security/page-guard';

export default async function AdminAudit() {
  await requirePage('admin');
  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.at)).limit(300);
  return (
    <div className="page">
      <PageHead
        title="Journal d’audit"
        text="Connexions et modifications des 300 derniers évènements. Ce journal ne peut être ni modifié ni effacé depuis le panel."
      />
      <section className="panel panel-flush">
        <table className="a-table a-table-rows">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Action</th>
              <th scope="col">Compte</th>
              <th scope="col">Cible</th>
              <th scope="col">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.action.includes('failed') ? 'row-warn' : ''}>
                <td>{formatDateTime(row.at)}</td>
                <td>{AUDIT_LABELS[row.action] ?? row.action}</td>
                <td>{row.userEmail ?? '—'}</td>
                <td className="cell-clip">{row.target ?? ''}</td>
                <td>{row.ip && row.ip !== 'direct' ? row.ip : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
