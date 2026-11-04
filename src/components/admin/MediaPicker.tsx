'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useAdmin } from './context';

export interface MediaItem {
  id: string;
  filename: string;
  alt: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
}

export function useUpload() {
  const { api } = useAdmin();
  return async (file: File, alt = ''): Promise<MediaItem> => {
    const res = await api<{ id: string; url: string; width: number; height: number }>('/api/admin/media', {
      raw: file,
      headers: {
        'X-File-Name': encodeURIComponent(file.name),
        'X-File-Alt': encodeURIComponent(alt),
      },
    });
    return { ...res, filename: file.name, alt, bytes: file.size };
  };
}

export function MediaPicker({
  onPick,
  onClose,
}: {
  onPick: (item: MediaItem) => void;
  onClose: () => void;
}) {
  const { api, run } = useAdmin();
  const upload = useUpload();
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void run(async () => {
      const data = await api<{ media: MediaItem[] }>('/api/admin/media');
      setItems(data.media);
    });
  }, [api, run]);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await run(async () => {
      onPick(await upload(file));
    });
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Choisir une image">
      <div className="modal-card modal-wide">
        <div className="modal-head">
          <h2>Médiathèque</h2>
          <div className="modal-head-actions">
            <button type="button" className="a-btn a-btn-primary" onClick={() => input.current?.click()}>
              Envoyer une image
            </button>
            <button type="button" className="a-btn" onClick={onClose}>
              Fermer
            </button>
          </div>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />
        </div>
        {items === null ? (
          <p>Chargement…</p>
        ) : items.length === 0 ? (
          <p>Aucune image pour l’instant.</p>
        ) : (
          <ul className="media-grid">
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onPick(item)} title={item.filename}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={item.alt} loading="lazy" />
                  <span>{item.filename}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
