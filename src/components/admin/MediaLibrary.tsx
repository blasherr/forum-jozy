'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { useAdmin } from './context';
import { PageHead } from './forms';
import { useUpload, type MediaItem } from './MediaPicker';

export function MediaLibrary({ initial }: { initial: MediaItem[] }) {
  const { api, run, role } = useAdmin();
  const upload = useUpload();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    setBusy(true);
    for (const file of files) {
      await run(async () => {
        const item = await upload(file);
        setItems((list) => [item, ...list]);
      }, `${file.name} envoyé.`);
    }
    setBusy(false);
  }

  async function saveAlt(item: MediaItem, alt: string) {
    if (alt === item.alt) return;
    await run(async () => {
      await api(`/api/admin/media/${item.id}`, { method: 'PATCH', body: { alt } });
      setItems((list) => list.map((m) => (m.id === item.id ? { ...m, alt } : m)));
    }, 'Description enregistrée.');
  }

  async function remove(item: MediaItem) {
    if (!window.confirm(`Supprimer ${item.filename} ? Les pages qui l’utilisent n’afficheront plus l’image.`)) return;
    await run(async () => {
      await api(`/api/admin/media/${item.id}`, { method: 'DELETE' });
      setItems((list) => list.filter((m) => m.id !== item.id));
    }, 'Image supprimée.');
  }

  return (
    <div className="page">
      <PageHead
        title="Médiathèque"
        text="JPEG, PNG ou WebP, 8 Mo maximum. Chaque image est réencodée à l’envoi : les données cachées et la position GPS sont retirées."
      />
      <p>
        <button type="button" className="a-btn a-btn-primary" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Envoi en cours…' : 'Envoyer des images'}
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={onFiles} />
      </p>
      <ul className="media-library">
        {items.map((item) => (
          <li key={item.id} className="panel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt={item.alt} loading="lazy" />
            <p className="media-name">{item.filename}</p>
            <p className="hint">
              {item.width} × {item.height} · {Math.round(item.bytes / 1024)} Ko
            </p>
            <label className="field">
              <span>Description</span>
              <input defaultValue={item.alt} maxLength={300} onBlur={(e) => saveAlt(item, e.target.value)} />
            </label>
            {role !== 'editor' ? (
              <button type="button" className="a-link" onClick={() => remove(item)}>
                Supprimer
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
