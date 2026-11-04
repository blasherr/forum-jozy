'use client';

import { useAdmin } from './context';
import { PageHead } from './forms';

export function BackupPanel() {
  const { api, run } = useAdmin();

  async function download() {
    await run(async () => {
      const data = await api('/api/admin/backup');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `new-frontier-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }, 'Sauvegarde téléchargée.');
  }

  return (
    <div className="page">
      <PageHead
        title="Sauvegarde"
        text="Un fichier avec tous les textes, le menu et les réglages. Il ne contient ni comptes, ni mots de passe, ni images."
      />
      <section className="panel">
        <button type="button" className="a-btn a-btn-primary" onClick={download}>
          Télécharger la sauvegarde
        </button>
        <p className="hint">Votre mot de passe vous sera redemandé.</p>
      </section>
    </div>
  );
}
