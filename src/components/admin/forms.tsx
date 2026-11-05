'use client';

import { useState, type ReactNode } from 'react';
import { useAdmin } from './context';
import { Icon } from './Icon';
import { MediaPicker } from './MediaPicker';

export function TextField({
  label,
  value,
  onChange,
  max = 200,
  hint,
  rows,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  hint?: string;
  rows?: number;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {rows ? (
        <textarea rows={rows} maxLength={max} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type} maxLength={max} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function MediaField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="field">
      <span>{label}</span>
      <div className="media-field">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/media/${value}`} alt="" />
        ) : (
          <div className="media-empty">Image par défaut</div>
        )}
        <div className="stack">
          <button type="button" className="a-btn" onClick={() => setOpen(true)}>
            Choisir
          </button>
          {value ? (
            <button type="button" className="a-link" onClick={() => onChange(null)}>
              Revenir à l’image par défaut
            </button>
          ) : null}
        </div>
      </div>
      {hint ? <small>{hint}</small> : null}
      {open ? (
        <MediaPicker
          onClose={() => setOpen(false)}
          onPick={(item) => {
            onChange(item.id);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

/** Suite d'images de la médiathèque, avec légende facultative. */
export function MediaListField({
  label,
  items,
  onChange,
  captions = false,
  max = 12,
  hint,
}: {
  label: string;
  items: { mediaId: string; caption: string }[];
  onChange: (items: { mediaId: string; caption: string }[]) => void;
  captions?: boolean;
  max?: number;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const move = (i: number, delta: number) => {
    const next = [...items];
    const [row] = next.splice(i, 1);
    if (!row) return;
    next.splice(i + delta, 0, row);
    onChange(next);
  };
  return (
    <div className="field">
      <span>{label}</span>
      <ul className="media-list">
        {items.map((item, i) => (
          <li key={item.mediaId}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/media/${item.mediaId}`} alt="" />
            {captions ? (
              <input
                aria-label="Légende"
                maxLength={160}
                value={item.caption}
                onChange={(e) => onChange(items.map((row, j) => (j === i ? { ...row, caption: e.target.value } : row)))}
              />
            ) : null}
            <span className="repeat-tools">
              <button type="button" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)}>
                <Icon name="up" size={16} />
              </button>
              <button type="button" aria-label="Descendre" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                <Icon name="down" size={16} />
              </button>
              <button type="button" aria-label="Retirer" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Icon name="x" size={16} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      {items.length < max ? (
        <button type="button" className="a-btn" onClick={() => setOpen(true)}>
          Ajouter une image
        </button>
      ) : null}
      {hint ? <small>{hint}</small> : null}
      {open ? (
        <MediaPicker
          onClose={() => setOpen(false)}
          onPick={(picked) => {
            if (!items.some((row) => row.mediaId === picked.id)) {
              onChange([...items, { mediaId: picked.id, caption: picked.alt }]);
            }
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

/** Liste éditable : ajouter, retirer, réordonner. */
export function Repeater<T>({
  items,
  onChange,
  blank,
  render,
  title,
  addLabel,
  max = 24,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  blank: () => T;
  render: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  title: (item: T, index: number) => string;
  addLabel: string;
  max?: number;
}) {
  const move = (i: number, delta: number) => {
    const next = [...items];
    const [row] = next.splice(i, 1);
    if (row === undefined) return;
    next.splice(i + delta, 0, row);
    onChange(next);
  };
  return (
    <div className="repeater">
      {items.map((item, i) => (
        <details key={i} className="repeat-item">
          <summary>
            <span>{title(item, i) || `Élément ${i + 1}`}</span>
            <span className="repeat-tools">
              <button type="button" aria-label="Monter" disabled={i === 0} onClick={(e) => { e.preventDefault(); move(i, -1); }}>
                <Icon name="up" size={16} />
              </button>
              <button type="button" aria-label="Descendre" disabled={i === items.length - 1} onClick={(e) => { e.preventDefault(); move(i, 1); }}>
                <Icon name="down" size={16} />
              </button>
              <button
                type="button"
                aria-label="Retirer"
                onClick={(e) => {
                  e.preventDefault();
                  onChange(items.filter((_, j) => j !== i));
                }}
              >
                <Icon name="x" size={16} />
              </button>
            </span>
          </summary>
          <div className="repeat-body">
            {render(item, (patch) => onChange(items.map((row, j) => (j === i ? { ...row, ...patch } : row))))}
          </div>
        </details>
      ))}
      {items.length < max ? (
        <button type="button" className="a-btn" onClick={() => onChange([...items, blank()])}>
          {addLabel}
        </button>
      ) : null}
    </div>
  );
}

export function useSettingForm<T>(key: string, initial: T) {
  const { api, run } = useAdmin();
  const [data, setData] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (next: T) => {
    setData(next);
    setDirty(true);
  };
  const save = async () => {
    setSaving(true);
    const ok = await run(async () => {
      await api(`/api/admin/settings/${key}`, { method: 'PUT', body: data });
    }, 'Enregistré : le site est à jour.');
    if (ok) setDirty(false);
    setSaving(false);
  };
  return { data, set, save, dirty, saving };
}

export function SaveBar({
  dirty,
  saving,
  onSave,
  preview = '/',
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  preview?: string;
}) {
  return (
    <div className="savebar">
      <span>{dirty ? 'Modifications non enregistrées' : 'Tout est enregistré'}</span>
      <a className="a-btn" href={preview} target="_blank" rel="noopener">
        Voir le site
      </a>
      <button type="button" className="a-btn a-btn-primary" disabled={!dirty || saving} onClick={onSave}>
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  );
}

export function PageHead({ title, text }: { title: string; text?: string }) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {text ? <p>{text}</p> : null}
    </header>
  );
}
