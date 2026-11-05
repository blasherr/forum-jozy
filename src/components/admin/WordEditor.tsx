'use client';

import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CALLOUTS,
  FONT_CHOICES,
  FONT_SIZES,
  HIGHLIGHT_COLORS,
  INK_COLORS,
} from '@/lib/richtext/palette';
import type { RichDoc } from '@/lib/richtext/types';
import { safeHref } from '@/lib/richtext/url';
import { Alignment, Callout, FontChoice, HighlightColor, InkColor, SizedImage, SizeChoice } from './extensions';
import { Icon } from './Icon';
import { MediaPicker } from './MediaPicker';

function Btn({
  editor,
  title,
  active,
  disabled,
  onClick,
  children,
  className = '',
}: {
  editor: Editor;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: (chain: ReturnType<Editor['chain']>) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      className={`rb ${active ? 'rb-on' : ''} ${className}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onClick(editor.chain().focus())}
    >
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ribbon-group" role="group" aria-label={label}>
      <div className="ribbon-tools">{children}</div>
      <span className="ribbon-label">{label}</span>
    </div>
  );
}

function Swatches({
  title,
  icon,
  colors,
  current,
  onPick,
  onClear,
}: {
  title: string;
  icon: ReactNode;
  colors: readonly { key: string; label: string; hex: string }[];
  current: string | null;
  onPick: (key: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as globalThis.Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="swatches" ref={box}>
      <button
        type="button"
        className="rb"
        title={title}
        aria-label={title}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(!open)}
      >
        {icon}
      </button>
      {open ? (
        <div className="swatches-pop">
          <div className="swatches-grid">
            {colors.map((c) => (
              <button
                key={c.key}
                type="button"
                title={c.label}
                aria-label={c.label}
                className={`swatch swatch-${c.key} ${current === c.key ? 'swatch-on' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(c.key);
                  setOpen(false);
                }}
              />
            ))}
          </div>
          <button
            type="button"
            className="swatch-clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onClear();
              setOpen(false);
            }}
          >
            Aucune couleur
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LinkDialog({
  initial,
  onSave,
  onRemove,
  onClose,
}: {
  initial: string;
  onSave: (href: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="link-title">
      <form
        className="modal-card"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const href = safeHref(value);
          if (!href) return setError('Lien refusé : utilisez https://, mailto: ou /page.');
          return onSave(href);
        }}
      >
        <h2 id="link-title">Insérer un lien</h2>
        <label className="field">
          <span>Adresse</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus placeholder="https://… ou /reglement" maxLength={2048} />
        </label>
        {error ? <p className="field-error">{error}</p> : null}
        <div className="modal-actions">
          {initial ? (
            <button type="button" className="a-btn a-btn-danger" onClick={onRemove}>
              Retirer le lien
            </button>
          ) : null}
          <button type="button" className="a-btn" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="a-btn a-btn-primary">
            Appliquer
          </button>
        </div>
      </form>
    </div>
  );
}

function Ribbon({ editor }: { editor: Editor }) {
  const [tab, setTab] = useState<'home' | 'insert' | 'table'>('home');
  const [dialog, setDialog] = useState<'link' | 'image' | null>(null);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      link: e.isActive('link'),
      table: e.isActive('table'),
      left: !e.isActive({ textAlign: 'center' }) && !e.isActive({ textAlign: 'right' }) && !e.isActive({ textAlign: 'justify' }),
      center: e.isActive({ textAlign: 'center' }),
      right: e.isActive({ textAlign: 'right' }),
      justify: e.isActive({ textAlign: 'justify' }),
      style: e.isActive('heading', { level: 2 })
        ? 'h2'
        : e.isActive('heading', { level: 3 })
          ? 'h3'
          : e.isActive('heading', { level: 4 })
            ? 'h4'
            : 'p',
      font: (e.getAttributes('fontChoice').font as string | undefined) ?? '',
      size: (e.getAttributes('sizeChoice').size as string | undefined) ?? '',
      ink: (e.getAttributes('inkColor').color as string | undefined) ?? null,
      hl: (e.getAttributes('highlightColor').color as string | undefined) ?? null,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      href: (e.getAttributes('link').href as string | undefined) ?? '',
    }),
  });

  useEffect(() => {
    if (s.table) setTab('table');
    else setTab((t) => (t === 'table' ? 'home' : t));
  }, [s.table]);

  function setStyle(value: string) {
    const chain = editor.chain().focus();
    if (value === 'p') chain.setParagraph().run();
    else chain.setHeading({ level: Number(value.slice(1)) as 2 | 3 | 4 }).run();
  }

  return (
    <div className="ribbon">
      <div className="ribbon-tabs" role="tablist" aria-label="Onglets de l’éditeur">
        <button type="button" role="tab" aria-selected={tab === 'home'} onClick={() => setTab('home')}>
          Accueil
        </button>
        <button type="button" role="tab" aria-selected={tab === 'insert'} onClick={() => setTab('insert')}>
          Insertion
        </button>
        {s.table ? (
          <button type="button" role="tab" aria-selected={tab === 'table'} onClick={() => setTab('table')}>
            Tableau
          </button>
        ) : null}
      </div>

      {tab === 'home' ? (
        <div className="ribbon-body">
          <Group label="Annuler">
            <Btn editor={editor} title="Annuler (Ctrl+Z)" disabled={!s.canUndo} onClick={(c) => c.undo().run()}>
              <Icon name="undo" />
            </Btn>
            <Btn editor={editor} title="Rétablir (Ctrl+Y)" disabled={!s.canRedo} onClick={(c) => c.redo().run()}>
              <Icon name="redo" />
            </Btn>
          </Group>

          <Group label="Police">
            <div className="ribbon-rows">
              <div className="ribbon-row">
                <select
                  aria-label="Police"
                  className="rs rs-font"
                  value={s.font}
                  onChange={(e) =>
                    e.target.value
                      ? editor.chain().focus().setMark('fontChoice', { font: e.target.value }).run()
                      : editor.chain().focus().unsetMark('fontChoice').run()
                  }
                >
                  <option value="">Police du site</option>
                  {FONT_CHOICES.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Taille"
                  className="rs rs-size"
                  value={s.size}
                  onChange={(e) =>
                    e.target.value
                      ? editor.chain().focus().setMark('sizeChoice', { size: e.target.value }).run()
                      : editor.chain().focus().unsetMark('sizeChoice').run()
                  }
                >
                  <option value="">Taille</option>
                  {FONT_SIZES.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ribbon-row">
                <Btn editor={editor} title="Gras (Ctrl+B)" active={s.bold} onClick={(c) => c.toggleBold().run()} className="rb-b">
                  G
                </Btn>
                <Btn editor={editor} title="Italique (Ctrl+I)" active={s.italic} onClick={(c) => c.toggleItalic().run()} className="rb-i">
                  I
                </Btn>
                <Btn editor={editor} title="Souligné (Ctrl+U)" active={s.underline} onClick={(c) => c.toggleUnderline().run()} className="rb-u">
                  S
                </Btn>
                <Btn editor={editor} title="Barré" active={s.strike} onClick={(c) => c.toggleStrike().run()} className="rb-s">
                  abc
                </Btn>
                <Swatches
                  title="Couleur du texte"
                  icon={<span className="rb-ink">A</span>}
                  colors={INK_COLORS}
                  current={s.ink}
                  onPick={(color) => editor.chain().focus().setMark('inkColor', { color }).run()}
                  onClear={() => editor.chain().focus().unsetMark('inkColor').run()}
                />
                <Swatches
                  title="Surlignage"
                  icon={<span className="rb-hl">ab</span>}
                  colors={HIGHLIGHT_COLORS}
                  current={s.hl}
                  onPick={(color) => editor.chain().focus().setMark('highlightColor', { color }).run()}
                  onClear={() => editor.chain().focus().unsetMark('highlightColor').run()}
                />
                <Btn editor={editor} title="Effacer la mise en forme" onClick={(c) => c.unsetAllMarks().clearNodes().run()}>
                  <Icon name="eraser" />
                </Btn>
              </div>
            </div>
          </Group>

          <Group label="Paragraphe">
            <div className="ribbon-rows">
              <div className="ribbon-row">
                <Btn editor={editor} title="Liste à puces" active={s.bullet} onClick={(c) => c.toggleBulletList().run()}>
                  <Icon name="list" />
                </Btn>
                <Btn editor={editor} title="Liste numérotée" active={s.ordered} onClick={(c) => c.toggleOrderedList().run()}>
                  <Icon name="list-ol" />
                </Btn>
                <Btn editor={editor} title="Diminuer le retrait" onClick={(c) => c.liftListItem('listItem').run()}>
                  <Icon name="outdent" />
                </Btn>
                <Btn editor={editor} title="Augmenter le retrait" onClick={(c) => c.sinkListItem('listItem').run()}>
                  <Icon name="indent" />
                </Btn>
                <Btn editor={editor} title="Citation" active={s.quote} onClick={(c) => c.toggleBlockquote().run()}>
                  <Icon name="quote" />
                </Btn>
              </div>
              <div className="ribbon-row">
                <Btn editor={editor} title="Aligner à gauche" active={s.left} onClick={(c) => c.setAlignment('left').run()}>
                  <Icon name="align-left" />
                </Btn>
                <Btn editor={editor} title="Centrer" active={s.center} onClick={(c) => c.setAlignment('center').run()}>
                  <Icon name="align-center" />
                </Btn>
                <Btn editor={editor} title="Aligner à droite" active={s.right} onClick={(c) => c.setAlignment('right').run()}>
                  <Icon name="align-right" />
                </Btn>
                <Btn editor={editor} title="Justifier" active={s.justify} onClick={(c) => c.setAlignment('justify').run()}>
                  <Icon name="align-justify" />
                </Btn>
              </div>
            </div>
          </Group>

          <Group label="Styles">
            <div className="style-gallery">
              {[
                ['p', 'Normal', 'sg-p'],
                ['h2', 'Titre 1', 'sg-h2'],
                ['h3', 'Titre 2', 'sg-h3'],
                ['h4', 'Titre 3', 'sg-h4'],
              ].map(([value, label, cls]) => (
                <button
                  key={value}
                  type="button"
                  className={`sg ${cls} ${s.style === value ? 'sg-on' : ''}`}
                  aria-pressed={s.style === value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setStyle(value as string)}
                >
                  {label}
                </button>
              ))}
            </div>
          </Group>
        </div>
      ) : null}

      {tab === 'insert' ? (
        <div className="ribbon-body">
          <Group label="Illustrations">
            <button type="button" className="rb-large" onClick={() => setDialog('image')}>
              <Icon name="image" size={20} />
              Image
            </button>
          </Group>
          <Group label="Tableaux">
            <Btn
              editor={editor}
              title="Insérer un tableau"
              className="rb-large"
              onClick={(c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            >
              <Icon name="table" size={20} />
              Tableau
            </Btn>
          </Group>
          <Group label="Liens">
            <button type="button" className={`rb-large ${s.link ? 'rb-on' : ''}`} onClick={() => setDialog('link')}>
              <Icon name="link" size={20} />
              Lien
            </button>
          </Group>
          <Group label="Encarts">
            {CALLOUTS.map((c) => (
              <Btn
                key={c.key}
                editor={editor}
                title={`Encart ${c.label}`}
                className={`rb-call rb-call-${c.key}`}
                onClick={(chain) => chain.toggleWrap('callout', { variant: c.key }).run()}
              >
                {c.label}
              </Btn>
            ))}
          </Group>
          <Group label="Divers">
            <Btn editor={editor} title="Bloc à copier (commande, adresse)" active={s.codeBlock} onClick={(c) => c.toggleCodeBlock().run()}>
              <Icon name="code" />
            </Btn>
            <Btn editor={editor} title="Code dans le texte" active={s.code} onClick={(c) => c.toggleCode().run()}>
              <Icon name="note" />
            </Btn>
            <Btn editor={editor} title="Séparateur" onClick={(c) => c.setHorizontalRule().run()}>
              <Icon name="minus" />
            </Btn>
            <Btn editor={editor} title="Saut de ligne (Maj+Entrée)" onClick={(c) => c.setHardBreak().run()}>
              <Icon name="return" />
            </Btn>
          </Group>
        </div>
      ) : null}

      {tab === 'table' ? (
        <div className="ribbon-body">
          <Group label="Lignes">
            <Btn editor={editor} title="Ligne au-dessus" onClick={(c) => c.addRowBefore().run()}>
              Au-dessus
            </Btn>
            <Btn editor={editor} title="Ligne en dessous" onClick={(c) => c.addRowAfter().run()}>
              En dessous
            </Btn>
            <Btn editor={editor} title="Supprimer la ligne" onClick={(c) => c.deleteRow().run()}>
              <Icon name="trash" size={16} />
            </Btn>
          </Group>
          <Group label="Colonnes">
            <Btn editor={editor} title="Colonne à gauche" onClick={(c) => c.addColumnBefore().run()}>
              À gauche
            </Btn>
            <Btn editor={editor} title="Colonne à droite" onClick={(c) => c.addColumnAfter().run()}>
              À droite
            </Btn>
            <Btn editor={editor} title="Supprimer la colonne" onClick={(c) => c.deleteColumn().run()}>
              <Icon name="trash" size={16} />
            </Btn>
          </Group>
          <Group label="Cellules">
            <Btn editor={editor} title="Fusionner ou scinder" onClick={(c) => c.mergeOrSplit().run()}>
              Fusionner
            </Btn>
            <Btn editor={editor} title="Cellule d’en-tête" onClick={(c) => c.toggleHeaderCell().run()}>
              En-tête
            </Btn>
          </Group>
          <Group label="Tableau">
            <Btn editor={editor} title="Supprimer le tableau" onClick={(c) => c.deleteTable().run()}>
              Supprimer
            </Btn>
          </Group>
        </div>
      ) : null}

      {dialog === 'link' ? (
        <LinkDialog
          initial={s.href}
          onClose={() => setDialog(null)}
          onRemove={() => {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            setDialog(null);
          }}
          onSave={(href) => {
            const chain = editor.chain().focus().extendMarkRange('link');
            if (editor.state.selection.empty && !s.link) {
              chain.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
            } else {
              chain.setLink({ href }).run();
            }
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === 'image' ? (
        <MediaPicker
          onClose={() => setDialog(null)}
          onPick={(item) => {
            editor
              .chain()
              .focus()
              .insertContent({ type: 'image', attrs: { src: item.url, alt: item.alt, size: 'large' } })
              .run();
            setDialog(null);
          }}
        />
      ) : null}
    </div>
  );
}

const ZOOMS = [80, 90, 100, 110, 125, 150];

export function WordEditor({
  value,
  onChange,
  compact = false,
}: {
  value: RichDoc;
  onChange: (doc: RichDoc) => void;
  compact?: boolean;
}) {
  const [zoom, setZoom] = useState(100);
  const latest = useRef(onChange);
  latest.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    injectCSS: false,
    enableInputRules: true,
    editorProps: { attributes: { class: 'rich word-page', spellcheck: 'true', lang: 'fr' } },
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: null },
          isAllowedUri: (url) => safeHref(url) !== null,
        },
      }),
      Alignment,
      InkColor,
      HighlightColor,
      FontChoice,
      SizeChoice,
      SizedImage,
      Callout,
      Table.configure({ resizable: false, allowTableNodeSelection: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: 'Commencez à écrire…' }),
      CharacterCount,
    ],
    content: value,
    onUpdate: ({ editor: e }) => latest.current(e.getJSON() as RichDoc),
  });

  const stats = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? { words: e.storage.characterCount.words() as number, chars: e.storage.characterCount.characters() as number }
        : { words: 0, chars: 0 },
  });

  if (!editor) return <div className="word word-loading">Ouverture du document…</div>;

  return (
    <div className={`word ${compact ? 'word-compact' : ''}`}>
      <Ribbon editor={editor} />
      <div className="word-desk">
        <div className={`word-sheet zoom-${zoom}`}>
          <EditorContent editor={editor} />
        </div>
      </div>
      <div className="word-status">
        <span>{stats?.words ?? 0} mots</span>
        <span>{stats?.chars ?? 0} caractères</span>
        <label className="word-zoom">
          Zoom
          <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
            {ZOOMS.map((z) => (
              <option key={z} value={z}>
                {z} %
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
