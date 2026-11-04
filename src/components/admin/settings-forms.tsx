'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';
import type { NavItem } from '@/db/schema';
import {
  FONT_OPTIONS,
  HOME_SECTIONS,
  SEALS,
  type DiscordSettings,
  type HomeSettings,
  type PagesSettings,
  type SiteSettings,
  type ThemeSettings,
} from '@/lib/content/schemas';
import type { RichDoc } from '@/lib/richtext/types';
import { useAdmin } from './context';
import {
  CheckField,
  MediaField,
  MediaListField,
  PageHead,
  Repeater,
  SaveBar,
  SelectField,
  TextField,
  useSettingForm,
} from './forms';

const WordEditor = dynamic(() => import('./WordEditor').then((m) => m.WordEditor), {
  ssr: false,
  loading: () => <div className="word word-loading">Ouverture du document…</div>,
});

const SEAL_OPTIONS: { value: (typeof SEALS)[number]; label: string }[] = [
  { value: 'red', label: 'Sceau rouge' },
  { value: 'gold', label: 'Sceau or' },
  { value: 'green', label: 'Sceau vert' },
  { value: 'blue', label: 'Sceau bleu' },
  { value: 'black', label: 'Sceau noir' },
];

const SECTION_LABELS: Record<(typeof HOME_SECTIONS)[number], string> = {
  intro: 'Présentation',
  board: 'Sommaire des registres',
  pillars: 'Les chemins possibles',
  gallery: 'Carnet de voyage (captures)',
  chronicle: 'Chronique',
  join: 'Rejoindre le serveur',
  gazette: 'Dernières dépêches',
  vote: 'Affiche de vote',
};

export function HomeForm({ initial }: { initial: HomeSettings }) {
  const { data, set, save, dirty, saving } = useSettingForm('home', initial);
  const [tab, setTab] = useState('hero');
  const patch = <K extends keyof HomeSettings>(key: K, value: Partial<HomeSettings[K]>) =>
    set({ ...data, [key]: { ...data[key], ...value } });
  const onIntro = useCallback(
    (body: RichDoc) => set({ ...data, intro: { ...data.intro, body } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  const toggle = (key: (typeof HOME_SECTIONS)[number]) =>
    set({
      ...data,
      order: data.order.includes(key) ? data.order.filter((k) => k !== key) : [...data.order, key],
    });
  const shift = (key: (typeof HOME_SECTIONS)[number], delta: number) => {
    const next = [...data.order];
    const at = next.indexOf(key);
    next.splice(at, 1);
    next.splice(at + delta, 0, key);
    set({ ...data, order: next });
  };

  const tabs = [
    ['hero', 'Bandeau'],
    ['order', 'Ordre des sections'],
    ['intro', 'Présentation'],
    ['board', 'Sommaire'],
    ['pillars', 'Chemins'],
    ['gallery', 'Galerie'],
    ['chronicle', 'Chronique'],
    ['join', 'Rejoindre'],
    ['gazette', 'Dépêches'],
    ['vote', 'Vote'],
  ];

  return (
    <div className="page">
      <PageHead title="Page d’accueil" text="Chaque bloc de la première page, dans l’ordre où il s’affiche." />
      <div className="tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key as string)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'hero' ? (
        <section className="panel">
          <TextField label="Surtitre" value={data.hero.kicker} max={120} onChange={(kicker) => patch('hero', { kicker })} />
          <TextField label="Titre principal" value={data.hero.title} max={80} onChange={(title) => patch('hero', { title })} />
          <TextField label="Phrase d’accroche" rows={3} value={data.hero.subtitle} max={500} onChange={(subtitle) => patch('hero', { subtitle })} />
          <SelectField
            label="Décor"
            value={data.hero.scene}
            options={[
              { value: 'video', label: 'Vidéo en boucle (cheminée)' },
              { value: 'photos', label: 'Diaporama de captures' },
              { value: 'bayou', label: 'Bayou de Louisiane (illustration)' },
              { value: 'mountains', label: 'Montagnes de l’Ambarino (illustration)' },
            ]}
            onChange={(scene) => patch('hero', { scene })}
          />
          <MediaListField
            label="Images du diaporama"
            max={8}
            items={data.hero.slides.map((mediaId) => ({ mediaId, caption: '' }))}
            onChange={(items) => patch('hero', { slides: items.map((i) => i.mediaId) })}
            hint="Une capture en jeu de 1920 px de large convient parfaitement. Une seule image : pas de fondu."
          />
          <h3>Boutons</h3>
          <Repeater
            items={data.hero.buttons}
            max={3}
            addLabel="Ajouter un bouton"
            title={(b) => b.label}
            blank={() => ({ label: 'Nouveau bouton', href: '/', variant: 'secondary' as const })}
            onChange={(buttons) => patch('hero', { buttons })}
            render={(b, update) => (
              <>
                <TextField label="Libellé" value={b.label} max={60} onChange={(label) => update({ label })} />
                <TextField label="Lien" value={b.href} max={2048} onChange={(href) => update({ href })} />
                <SelectField
                  label="Style"
                  value={b.variant}
                  options={[
                    { value: 'primary', label: 'Plaque rouge (principal)' },
                    { value: 'brass', label: 'Plaque de laiton' },
                    { value: 'secondary', label: 'Plaque de fer (secondaire)' },
                  ]}
                  onChange={(variant) => update({ variant })}
                />
              </>
            )}
          />
        </section>
      ) : null}

      {tab === 'order' ? (
        <section className="panel">
          <p className="hint">Cochez les sections à afficher et réglez leur ordre.</p>
          <ul className="order-list">
            {data.order.map((key, i) => (
              <li key={key}>
                <CheckField label={SECTION_LABELS[key]} checked onChange={() => toggle(key)} />
                <span className="repeat-tools">
                  <button type="button" aria-label="Monter" disabled={i === 0} onClick={() => shift(key, -1)}>
                    ▲
                  </button>
                  <button type="button" aria-label="Descendre" disabled={i === data.order.length - 1} onClick={() => shift(key, 1)}>
                    ▼
                  </button>
                </span>
              </li>
            ))}
            {HOME_SECTIONS.filter((key) => !data.order.includes(key)).map((key) => (
              <li key={key}>
                <CheckField label={SECTION_LABELS[key]} checked={false} onChange={() => toggle(key)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === 'intro' ? (
        <section className="panel">
          <TextField label="Surtitre" value={data.intro.kicker} max={120} onChange={(kicker) => patch('intro', { kicker })} />
          <TextField label="Titre" value={data.intro.title} max={160} onChange={(title) => patch('intro', { title })} />
          <div className="field">
            <span>Texte</span>
            <WordEditor value={initial.intro.body} onChange={onIntro} compact />
          </div>
        </section>
      ) : null}

      {tab === 'board' ? (
        <section className="panel">
          <TextField label="Surtitre" value={data.board.kicker} max={120} onChange={(kicker) => patch('board', { kicker })} />
          <TextField label="Titre" value={data.board.title} max={160} onChange={(title) => patch('board', { title })} />
          <TextField label="Introduction" rows={2} value={data.board.intro} max={400} onChange={(intro) => patch('board', { intro })} />
        </section>
      ) : null}

      {tab === 'pillars' ? (
        <section className="panel">
          <TextField label="Surtitre" value={data.pillars.kicker} max={120} onChange={(kicker) => patch('pillars', { kicker })} />
          <TextField label="Titre" value={data.pillars.title} max={160} onChange={(title) => patch('pillars', { title })} />
          <Repeater
            items={data.pillars.items}
            max={9}
            addLabel="Ajouter une carte"
            title={(c) => c.title}
            blank={() => ({ title: 'Nouvelle carte', text: '', href: '', seal: 'red' as const })}
            onChange={(items) => patch('pillars', { items })}
            render={(c, update) => (
              <>
                <TextField label="Titre" value={c.title} max={80} onChange={(title) => update({ title })} />
                <TextField label="Texte" rows={3} value={c.text} max={500} onChange={(text) => update({ text })} />
                <TextField label="Lien" value={c.href} max={2048} onChange={(href) => update({ href })} />
                <SelectField label="Sceau" value={c.seal} options={SEAL_OPTIONS} onChange={(seal) => update({ seal })} />
              </>
            )}
          />
        </section>
      ) : null}

      {tab === 'gallery' ? (
        <section className="panel">
          <TextField label="Surtitre" value={data.gallery.kicker} max={120} onChange={(kicker) => patch('gallery', { kicker })} />
          <TextField label="Titre" value={data.gallery.title} max={160} onChange={(title) => patch('gallery', { title })} />
          <MediaListField label="Images" captions items={data.gallery.items} onChange={(items) => patch('gallery', { items })} />
        </section>
      ) : null}

      {tab === 'chronicle' ? (
        <section className="panel">
          <TextField label="Surtitre" value={data.chronicle.kicker} max={120} onChange={(kicker) => patch('chronicle', { kicker })} />
          <TextField label="Titre" value={data.chronicle.title} max={160} onChange={(title) => patch('chronicle', { title })} />
          <MediaField label="Image de fond" value={data.chronicle.image} onChange={(image) => patch('chronicle', { image })} />
          <Repeater
            items={data.chronicle.items}
            addLabel="Ajouter un évènement"
            title={(c) => `${c.year} — ${c.title}`}
            blank={() => ({ year: '1847', title: 'Nouvel évènement', text: '' })}
            onChange={(items) => patch('chronicle', { items })}
            render={(c, update) => (
              <>
                <TextField label="Année" value={c.year} max={20} onChange={(year) => update({ year })} />
                <TextField label="Titre" value={c.title} max={120} onChange={(title) => update({ title })} />
                <TextField label="Texte" rows={3} value={c.text} max={600} onChange={(text) => update({ text })} />
              </>
            )}
          />
        </section>
      ) : null}

      {tab === 'join' ? (
        <section className="panel">
          <TextField label="Surtitre" value={data.join.kicker} max={120} onChange={(kicker) => patch('join', { kicker })} />
          <TextField label="Titre" value={data.join.title} max={160} onChange={(title) => patch('join', { title })} />
          <Repeater
            items={data.join.steps}
            max={6}
            addLabel="Ajouter une étape"
            title={(s) => s.title}
            blank={() => ({ title: 'Nouvelle étape', text: '', href: '', linkLabel: '' })}
            onChange={(steps) => patch('join', { steps })}
            render={(s, update) => (
              <>
                <TextField label="Titre" value={s.title} max={80} onChange={(title) => update({ title })} />
                <TextField label="Texte" rows={2} value={s.text} max={400} onChange={(text) => update({ text })} />
                <TextField label="Lien" value={s.href} max={2048} onChange={(href) => update({ href })} />
                <TextField label="Texte du lien" value={s.linkLabel} max={60} onChange={(linkLabel) => update({ linkLabel })} />
              </>
            )}
          />
        </section>
      ) : null}

      {tab === 'gazette' ? (
        <section className="panel">
          <TextField label="Surtitre" value={data.gazette.kicker} max={120} onChange={(kicker) => patch('gazette', { kicker })} />
          <TextField label="Titre" value={data.gazette.title} max={160} onChange={(title) => patch('gazette', { title })} />
          <label className="field">
            <span>Nombre de dépêches affichées</span>
            <input
              type="number"
              min={1}
              max={6}
              value={data.gazette.count}
              onChange={(e) => patch('gazette', { count: Math.min(6, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </label>
        </section>
      ) : null}

      {tab === 'vote' ? (
        <section className="panel">
          <TextField label="Surtitre de l’affiche" value={data.vote.kicker} max={120} onChange={(kicker) => patch('vote', { kicker })} />
          <TextField label="Titre" value={data.vote.title} max={120} onChange={(title) => patch('vote', { title })} />
          <TextField label="Texte" rows={3} value={data.vote.text} max={500} onChange={(text) => patch('vote', { text })} />
          <TextField label="Texte du bouton" value={data.vote.buttonLabel} max={60} onChange={(buttonLabel) => patch('vote', { buttonLabel })} />
          <TextField label="Lien de vote" value={data.vote.href} max={2048} onChange={(href) => patch('vote', { href })} />
          <TextField label="Note sous le bouton" value={data.vote.note} max={200} onChange={(note) => patch('vote', { note })} />
          <MediaField label="Image de l’affiche" value={data.vote.image} onChange={(image) => patch('vote', { image })} hint="Par défaut : la bannière du serveur." />
        </section>
      ) : null}

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}

export function IdentityForm({ initial }: { initial: SiteSettings }) {
  const { data, set, save, dirty, saving } = useSettingForm('site', initial);
  const server = (p: Partial<SiteSettings['server']>) => set({ ...data, server: { ...data.server, ...p } });
  const footer = (p: Partial<SiteSettings['footer']>) => set({ ...data, footer: { ...data.footer, ...p } });
  return (
    <div className="page">
      <PageHead title="Identité et adresses" text="Nom du serveur, adresses de connexion et pied de page." />
      <section className="panel">
        <h2>Identité</h2>
        <TextField label="Nom complet" value={data.name} max={80} onChange={(name) => set({ ...data, name })} />
        <TextField label="Nom court (barre de menu)" value={data.shortName} max={30} onChange={(shortName) => set({ ...data, shortName })} />
        <TextField label="Accroche (onglet du navigateur)" value={data.tagline} max={160} onChange={(tagline) => set({ ...data, tagline })} />
        <TextField label="Description (Google et partages)" rows={3} value={data.description} max={300} onChange={(description) => set({ ...data, description })} />
        <MediaField label="Logo" value={data.logoMediaId} onChange={(logoMediaId) => set({ ...data, logoMediaId })} hint="Par défaut : le sceau NF." />
      </section>
      <section className="panel">
        <h2>Écran de chargement</h2>
        <CheckField
          label="Afficher un écran de chargement entre les pages"
          checked={data.loader.enabled}
          onChange={(enabled) => set({ ...data, loader: { ...data.loader, enabled } })}
        />
        <MediaListField
          label="Images de fond"
          max={8}
          items={data.loader.images.map((mediaId) => ({ mediaId, caption: '' }))}
          onChange={(items) => set({ ...data, loader: { ...data.loader, images: items.map((i) => i.mediaId) } })}
        />
        <TextField
          label="Astuces affichées"
          rows={8}
          max={4000}
          hint="Une astuce par ligne, 24 maximum."
          value={data.loader.tips.join('\n')}
          onChange={(value) => set({ ...data, loader: { ...data.loader, tips: value.split('\n').slice(0, 24) } })}
        />
      </section>
      <section className="panel">
        <h2>Adresses de connexion</h2>
        <TextField label="Nom du serveur RedM" value={data.server.connectLabel} max={60} onChange={(connectLabel) => server({ connectLabel })} />
        <TextField label="Commande de connexion" value={data.server.connectCommand} onChange={(connectCommand) => server({ connectCommand })} />
        <TextField label="Nom du serveur TeamSpeak" value={data.server.teamspeakLabel} max={60} onChange={(teamspeakLabel) => server({ teamspeakLabel })} />
        <TextField label="Adresse TeamSpeak" value={data.server.teamspeakAddress} onChange={(teamspeakAddress) => server({ teamspeakAddress })} />
      </section>
      <section className="panel">
        <h2>Pied de page</h2>
        <TextField label="Devise" value={data.footer.motto} onChange={(motto) => footer({ motto })} />
        <TextField label="Mention légale" rows={3} value={data.footer.legal} max={400} onChange={(legal) => footer({ legal })} />
        <Repeater
          items={data.footer.links}
          max={12}
          addLabel="Ajouter un lien"
          title={(l) => l.label}
          blank={() => ({ label: 'Nouveau lien', href: '/' })}
          onChange={(links) => footer({ links })}
          render={(l, update) => (
            <>
              <TextField label="Libellé" value={l.label} max={60} onChange={(label) => update({ label })} />
              <TextField label="Lien" value={l.href} max={2048} onChange={(href) => update({ href })} />
            </>
          )}
        />
      </section>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}

const PAGE_LABELS: [keyof PagesSettings, string, string][] = [
  ['histoire', 'Histoire', '/histoire'],
  ['reglement', 'Règlement', '/reglement'],
  ['guide', 'Guide', '/guide'],
  ['patchnotes', 'Patch-notes', '/patch-notes'],
  ['discord', 'Discords', '/discord'],
  ['connexion', 'Connexion', '/connexion'],
];

export function PagesForm({ initial }: { initial: PagesSettings }) {
  const { data, set, save, dirty, saving } = useSettingForm('pages', initial);
  return (
    <div className="page">
      <PageHead title="Titres des pages" text="Le grand titre, le surtitre et l’introduction de chaque rubrique." />
      {PAGE_LABELS.map(([key, label]) => (
        <section className="panel" key={key}>
          <h2>{label}</h2>
          <TextField label="Surtitre" value={data[key].kicker} max={120} onChange={(kicker) => set({ ...data, [key]: { ...data[key], kicker } })} />
          <TextField label="Titre" value={data[key].title} max={120} onChange={(title) => set({ ...data, [key]: { ...data[key], title } })} />
          <TextField label="Introduction" rows={2} value={data[key].subtitle} max={500} onChange={(subtitle) => set({ ...data, [key]: { ...data[key], subtitle } })} />
          <TextField label="Description pour Google" rows={2} value={data[key].seoDescription} max={300} onChange={(seoDescription) => set({ ...data, [key]: { ...data[key], seoDescription } })} />
          {key !== 'connexion' && key !== 'patchnotes' ? (
            <MediaField label="Image d’en-tête" value={data[key].image} onChange={(image) => set({ ...data, [key]: { ...data[key], image } })} />
          ) : null}
        </section>
      ))}
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}

export function DiscordForm({ initial }: { initial: DiscordSettings }) {
  const { data, set, save, dirty, saving } = useSettingForm('discord', initial);
  return (
    <div className="page">
      <PageHead title="Discords officiels" text="Les boutons et liens de la page Discord." />
      <section className="panel">
        <Repeater
          items={data.cards}
          max={16}
          addLabel="Ajouter un Discord"
          title={(c) => c.title}
          blank={() => ({ title: 'Nouveau Discord', description: '', href: 'https://discord.gg/', buttonLabel: 'Rejoindre le Discord', seal: 'red' as const })}
          onChange={(cards) => set({ ...data, cards })}
          render={(c, update) => (
            <>
              <TextField label="Nom" value={c.title} max={80} onChange={(title) => update({ title })} />
              <TextField label="Description" rows={2} value={c.description} max={300} onChange={(description) => update({ description })} />
              <TextField label="Lien d’invitation" value={c.href} max={2048} onChange={(href) => update({ href })} />
              <TextField label="Texte du bouton" value={c.buttonLabel} max={60} onChange={(buttonLabel) => update({ buttonLabel })} />
              <SelectField label="Sceau" value={c.seal} options={SEAL_OPTIONS} onChange={(seal) => update({ seal })} />
            </>
          )}
        />
      </section>
      <section className="panel">
        <TextField label="Avertissement sous les cartes" rows={3} value={data.note} max={500} onChange={(note) => set({ ...data, note })} />
      </section>
      <SaveBar dirty={dirty} saving={saving} onSave={save} preview="/discord" />
    </div>
  );
}

const FONT_LABELS: Record<string, string> = {
  rye: 'Rye (western)',
  sancreek: 'Sancreek (affiche)',
  ewert: 'Ewert (ornée)',
  smokum: 'Smokum',
  holtwood: 'Holtwood (bois)',
  playfair: 'Playfair (presse)',
  fell: 'Fell English (ancien)',
  caslon: 'Caslon',
  oldstandard: 'Old Standard',
  garamond: 'Garamond',
};

const COLOR_FIELDS: [keyof ThemeSettings['colors'], string][] = [
  ['blood', 'Rouge principal'],
  ['gold', 'Or (titres sur fond sombre)'],
  ['ink', 'Encre (texte sur papier)'],
  ['paper', 'Papier'],
  ['night', 'Fond général'],
];

export function ThemeForm({ initial, defaults }: { initial: ThemeSettings; defaults: ThemeSettings }) {
  const { data, set, save, dirty, saving } = useSettingForm('theme', initial);
  const options = useMemo(
    () => ({
      display: FONT_OPTIONS.display.map((value) => ({ value, label: FONT_LABELS[value] ?? value })),
      heading: FONT_OPTIONS.heading.map((value) => ({ value, label: FONT_LABELS[value] ?? value })),
      body: FONT_OPTIONS.body.map((value) => ({ value, label: FONT_LABELS[value] ?? value })),
    }),
    [],
  );
  return (
    <div className="page">
      <PageHead title="Apparence" text="Couleurs, polices et matières de tout le site." />
      <section className="panel">
        <h2>Couleurs</h2>
        <div className="colors">
          {COLOR_FIELDS.map(([key, label]) => (
            <label key={key} className="color-field">
              <input
                type="color"
                value={data.colors[key]}
                onChange={(e) => set({ ...data, colors: { ...data.colors, [key]: e.target.value } })}
              />
              <span>{label}</span>
              <code>{data.colors[key]}</code>
            </label>
          ))}
        </div>
        <button type="button" className="a-link" onClick={() => set({ ...data, colors: defaults.colors })}>
          Revenir aux couleurs d’origine
        </button>
      </section>
      <section className="panel">
        <h2>Polices</h2>
        <SelectField label="Grands titres" value={data.fonts.display} options={options.display} onChange={(display) => set({ ...data, fonts: { ...data.fonts, display } })} />
        <SelectField label="Sous-titres" value={data.fonts.heading} options={options.heading} onChange={(heading) => set({ ...data, fonts: { ...data.fonts, heading } })} />
        <SelectField label="Texte courant" value={data.fonts.body} options={options.body} onChange={(body) => set({ ...data, fonts: { ...data.fonts, body } })} />
      </section>
      <section className="panel">
        <h2>Matières</h2>
        <SelectField
          label="Papier"
          value={data.paper}
          options={[
            { value: 'paper', label: 'Vélin' },
            { value: 'paper-light', label: 'Papier clair' },
            { value: 'paper-aged', label: 'Papier vieilli' },
          ]}
          onChange={(paper) => set({ ...data, paper })}
        />
        <MediaField label="Fond de page" value={data.backgroundMediaId} onChange={(backgroundMediaId) => set({ ...data, backgroundMediaId })} hint="Par défaut : bois sombre." />
        <CheckField label="Brume et lucioles animées sur le bandeau d’accueil" checked={data.dust} onChange={(dust) => set({ ...data, dust })} />
      </section>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}

type NavRow = Pick<NavItem, 'label' | 'href' | 'visible' | 'newTab'> & { id?: string };

export function NavForm({ initial }: { initial: NavRow[] }) {
  const { api, run } = useAdmin();
  const [items, setItems] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const update = (next: NavRow[]) => {
    setItems(next);
    setDirty(true);
  };
  async function save() {
    setSaving(true);
    const ok = await run(async () => {
      await api('/api/admin/nav', { method: 'PUT', body: { items } });
    }, 'Menu enregistré.');
    if (ok) setDirty(false);
    setSaving(false);
  }
  return (
    <div className="page">
      <PageHead title="Menu du site" text="Les entrées de la barre de navigation, dans l’ordre." />
      <section className="panel">
        <Repeater
          items={items}
          max={16}
          addLabel="Ajouter une entrée"
          title={(n) => `${n.label}${n.visible ? '' : ' (masqué)'}`}
          blank={() => ({ label: 'Nouvelle entrée', href: '/', visible: true, newTab: false })}
          onChange={update}
          render={(n, patch) => (
            <>
              <TextField label="Libellé" value={n.label} max={40} onChange={(label) => patch({ label })} />
              <TextField label="Lien" value={n.href} max={2048} onChange={(href) => patch({ href })} />
              <CheckField label="Visible dans le menu" checked={n.visible} onChange={(visible) => patch({ visible })} />
              <CheckField label="Ouvrir dans un nouvel onglet" checked={n.newTab} onChange={(newTab) => patch({ newTab })} />
            </>
          )}
        />
      </section>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </div>
  );
}
