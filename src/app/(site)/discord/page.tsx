import type { Metadata } from 'next';
import { PageHeader, Seal, SmartLink } from '@/components/site/parts';
import { getSetting } from '@/lib/content/queries';

export async function generateMetadata(): Promise<Metadata> {
  const { discord } = await getSetting('pages');
  return { title: discord.title, description: discord.seoDescription };
}

export default async function DiscordPage() {
  const [pages, discord] = await Promise.all([getSetting('pages'), getSetting('discord')]);
  return (
    <>
      <PageHeader {...pages.discord} />
      <div className="wrap">
        <ul className="letters">
          {discord.cards.map((card) => (
            <li key={card.title} className="letter paper paper-aged paper-thin">
              <div className="letter-flap" aria-hidden="true" />
              <Seal color={card.seal} className="letter-seal" size={118} />
              <div className="letter-body">
                <h2>{card.title}</h2>
                <p>{card.description}</p>
                <SmartLink href={card.href} className="btn btn-primary">
                  {card.buttonLabel}
                </SmartLink>
              </div>
            </li>
          ))}
        </ul>
        {discord.note ? <p className="notice">{discord.note}</p> : null}
      </div>
    </>
  );
}
