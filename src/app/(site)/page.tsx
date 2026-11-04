import Link from 'next/link';
import type { ReactNode } from 'react';
import { RichText } from '@/components/RichText';
import { CopyButton } from '@/components/site/CopyButton';
import { Fireflies } from '@/components/site/Fireflies';
import { HeroSlides } from '@/components/site/HeroSlides';
import { HeroVideo } from '@/components/site/HeroVideo';
import { Ornament, Seal, SectionTitle, SmartLink } from '@/components/site/parts';
import { getSetting, listSummaries, type EntrySummary } from '@/lib/content/queries';
import type { DiscordSettings, HomeSettings, SiteSettings } from '@/lib/content/schemas';
import { formatDate, plural, roman } from '@/lib/format';

type Home = HomeSettings;

function Hero({ hero, site, dust }: { hero: Home['hero']; site: SiteSettings; dust: boolean }) {
  const video = hero.scene === 'video';
  const photos = hero.scene === 'photos' && hero.slides.length > 0;
  const base = `/art/${hero.scene === 'mountains' ? 'mountains' : 'bayou'}`;
  const bayou = !video && !photos && hero.scene !== 'mountains';
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className={`hero-stage ${video ? 'hero-stage-video' : ''}`} aria-hidden="true">
        {video ? (
          <HeroVideo />
        ) : photos ? (
          <HeroSlides ids={hero.slides} />
        ) : (
          <picture>
            <source media="(max-width: 960px)" srcSet={`${base}-960.webp`} type="image/webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hero-scene" src={`${base}.webp`} alt="" fetchPriority="high" width={1920} height={1080} />
          </picture>
        )}
        {dust && bayou ? <span className="hero-lantern" /> : null}
      </div>
      <div className="hero-shade" aria-hidden="true" />
      {dust && !video ? (
        <>
          <div className="hero-fog hero-fog-a" aria-hidden="true" />
          <div className="hero-fog hero-fog-b" aria-hidden="true" />
          {bayou ? <Fireflies /> : null}
        </>
      ) : null}

      <div className="hero-copy">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hero-mark" src="/brand/nf-mark.webp" alt="" width={974} height={737} />
        {hero.kicker ? <p className="hero-kicker">{hero.kicker}</p> : null}
        <h1 id="hero-title">{hero.title}</h1>
        <Ornament />
        {hero.subtitle ? <p className="hero-sub">{hero.subtitle}</p> : null}
        <div className="hero-actions">
          {hero.buttons.map((b) => (
            <SmartLink key={b.label} href={b.href} className={`btn btn-${b.variant}`}>
              {b.label}
            </SmartLink>
          ))}
        </div>
      </div>

      <div className="hero-ticket paper paper-thin">
        <span className="hero-ticket-label">{site.server.connectLabel}</span>
        <code>{site.server.connectCommand}</code>
        <CopyButton text={site.server.connectCommand} />
      </div>
    </section>
  );
}

function Intro({ data }: { data: Home['intro'] }) {
  return (
    <section className="band">
      <article className="broadside paper">
        <div className="broadside-head">
          {data.kicker ? <p className="kicker">{data.kicker}</p> : null}
          <h2>{data.title}</h2>
          <Ornament />
        </div>
        <RichText doc={data.body} className="rich-columns rich-dropcap" />
      </article>
    </section>
  );
}

interface BoardRow {
  title: string;
  text: string;
  href: string;
  count: string;
  updated?: number | null;
}

function Board({ data, rows }: { data: Home['board']; rows: BoardRow[] }) {
  return (
    <section className="band">
      <article className="ledger paper">
        <header className="ledger-head">
          {data.kicker ? <p className="kicker">{data.kicker}</p> : null}
          <h2>{data.title}</h2>
          {data.intro ? <p className="ledger-intro">{data.intro}</p> : null}
        </header>
        <div className="ledger-cols" aria-hidden="true">
          <span>N°</span>
          <span>Registre</span>
          <span>Contenu</span>
        </div>
        <ol className="board">
          {rows.map((row, i) => (
            <li key={row.href}>
              <Link href={row.href} prefetch className="board-row">
                <span className="board-num" aria-hidden="true">
                  {roman(i + 1)}
                </span>
                <span className="board-main">
                  <span className="board-title">{row.title}</span>
                  <span className="board-text">{row.text}</span>
                </span>
                <span className="board-meta">
                  <span>{row.count}</span>
                  {row.updated ? <span>{formatDate(row.updated)}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </article>
    </section>
  );
}

function Pillars({ data }: { data: Home['pillars'] }) {
  return (
    <section className="band">
      <div className="wrap">
        <SectionTitle kicker={data.kicker} title={data.title} tone="light" />
        <ul className="pillars">
          {data.items.map((item) => (
            <li key={item.title} className="pillar paper paper-aged paper-thin">
              <Seal color={item.seal} className="pillar-seal" />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              {item.href ? (
                <SmartLink href={item.href} className="link-ink">
                  En savoir plus
                </SmartLink>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Gallery({ data }: { data: Home['gallery'] }) {
  if (data.items.length === 0) return null;
  return (
    <section className="band">
      <div className="wrap">
        <SectionTitle kicker={data.kicker} title={data.title} tone="light" />
        <ul className="prints">
          {data.items.map((item) => (
            <li key={item.mediaId}>
              <figure className="print paper paper-thin">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/media/${item.mediaId}`} alt={item.caption} loading="lazy" decoding="async" />
                {item.caption ? <figcaption>{item.caption}</figcaption> : null}
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Chronicle({ data }: { data: Home['chronicle'] }) {
  return (
    <section className="band chronicle">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {data.image ? <img className="band-img" src={`/media/${data.image}`} alt="" loading="lazy" /> : null}
      <div className="wrap">
        <SectionTitle kicker={data.kicker} title={data.title} tone="light" />
        <ol className="chronicle-list">
          {data.items.map((item) => (
            <li key={`${item.year}-${item.title}`}>
              <span className="chronicle-year">{item.year}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>
        <p className="center">
          <Link href="/histoire" prefetch className="btn btn-brass">
            Lire toute l’histoire
          </Link>
        </p>
      </div>
    </section>
  );
}

function Join({ data, site }: { data: Home['join']; site: SiteSettings }) {
  return (
    <section className="band">
      <div className="sheet paper join">
        <div className="sheet-head">
          {data.kicker ? <p className="kicker">{data.kicker}</p> : null}
          <h2>{data.title}</h2>
          <Ornament />
        </div>
        <ol className="steps">
          {data.steps.map((step, i) => (
            <li key={step.title}>
              <span className="step-num" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              {step.href ? (
                <SmartLink href={step.href} className="link-ink">
                  {step.linkLabel || 'En savoir plus'}
                </SmartLink>
              ) : null}
            </li>
          ))}
        </ol>
        <dl className="address address-paper">
          <div>
            <dt>{site.server.connectLabel}</dt>
            <dd>
              <code>{site.server.connectCommand}</code>
              <CopyButton text={site.server.connectCommand} />
            </dd>
          </div>
          <div>
            <dt>{site.server.teamspeakLabel}</dt>
            <dd>
              <code>{site.server.teamspeakAddress}</code>
              <CopyButton text={site.server.teamspeakAddress} />
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function Gazette({ data, notes }: { data: Home['gazette']; notes: EntrySummary[] }) {
  if (notes.length === 0) return null;
  return (
    <section className="band">
      <div className="wrap">
        <SectionTitle kicker={data.kicker} title={data.title} tone="light" />
        <ul className="clippings">
          {notes.slice(0, data.count).map((note) => (
            <li key={note.id}>
              <Link href={`/patch-notes/${note.slug}`} prefetch className="clipping paper paper-thin">
                <time dateTime={new Date(note.publishedAt ?? note.createdAt).toISOString()}>
                  {formatDate(note.publishedAt ?? note.createdAt)}
                </time>
                <h3>{note.title}</h3>
                <p>{note.summary}</p>
                <span className="link-ink">Lire la dépêche</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Vote({ data }: { data: Home['vote'] }) {
  return (
    <section className="vote" aria-labelledby="vote-title">
      <div className="poster">
        <span className="poster-nail poster-nail-a" aria-hidden="true" />
        <span className="poster-nail poster-nail-b" aria-hidden="true" />
        <div className="poster-body paper paper-aged">
          <p className="poster-kicker">{data.kicker}</p>
          <h2 id="vote-title">{data.title}</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="poster-art"
            src={data.image ? `/media/${data.image}` : '/brand/nf-banner.webp'}
            alt=""
            loading="lazy"
            width={640}
            height={386}
          />
          <p className="poster-text">{data.text}</p>
          <SmartLink href={data.href} className="btn btn-primary btn-huge">
            {data.buttonLabel}
          </SmartLink>
          {data.note ? <p className="poster-note">{data.note}</p> : null}
          <Seal color="red" className="poster-seal" size={132} />
        </div>
      </div>
    </section>
  );
}

function boardRows(
  rules: EntrySummary[],
  guide: EntrySummary[],
  notes: EntrySummary[],
  lore: EntrySummary[],
  discord: DiscordSettings,
  pages: Awaited<ReturnType<typeof getSetting<'pages'>>>,
): BoardRow[] {
  const latest = (list: EntrySummary[]) => Math.max(0, ...list.map((e) => e.updatedAt));
  return [
    { title: pages.reglement.title, text: pages.reglement.subtitle, href: '/reglement', count: plural(rules.length, 'chapitre', 'chapitres'), updated: latest(rules) },
    { title: pages.guide.title, text: pages.guide.subtitle, href: '/guide', count: plural(guide.length, 'tutoriel', 'tutoriels'), updated: latest(guide) },
    { title: pages.patchnotes.title, text: pages.patchnotes.subtitle, href: '/patch-notes', count: plural(notes.length, 'numéro', 'numéros'), updated: notes[0]?.publishedAt ?? null },
    { title: pages.histoire.title, text: pages.histoire.subtitle, href: '/histoire', count: plural(lore.length, 'archive', 'archives'), updated: latest(lore) },
    { title: pages.discord.title, text: 'Illégal, service public, entreprise et natif : un Discord par univers.', href: '/discord', count: plural(discord.cards.length, 'serveur', 'serveurs') },
  ];
}

export default async function HomePage() {
  const [home, site, theme, pages, discord, rules, guide, notes, lore] = await Promise.all([
    getSetting('home'),
    getSetting('site'),
    getSetting('theme'),
    getSetting('pages'),
    getSetting('discord'),
    listSummaries('rules'),
    listSummaries('guide'),
    listSummaries('patchnotes'),
    listSummaries('lore'),
  ]);

  const sections: Record<Home['order'][number], ReactNode> = {
    intro: <Intro data={home.intro} />,
    board: <Board data={home.board} rows={boardRows(rules, guide, notes, lore, discord, pages)} />,
    pillars: <Pillars data={home.pillars} />,
    gallery: <Gallery data={home.gallery} />,
    chronicle: <Chronicle data={home.chronicle} />,
    join: <Join data={home.join} site={site} />,
    gazette: <Gazette data={home.gazette} notes={notes} />,
    vote: <Vote data={home.vote} />,
  };

  return (
    <>
      <Hero hero={home.hero} site={site} dust={theme.dust} />
      {home.order.map((key) => (
        <div key={key}>{sections[key]}</div>
      ))}
    </>
  );
}
