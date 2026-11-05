import type { Metadata, Viewport } from 'next';
import {
  Abril_Fatface,
  Anton,
  Barlow,
  Barlow_Condensed,
  Cormorant_Garamond,
  Courier_Prime,
  EB_Garamond,
  Ewert,
  Holtwood_One_SC,
  IM_Fell_English,
  La_Belle_Aurore,
  Inter,
  Libre_Caslon_Text,
  Old_Standard_TT,
  Playfair_Display,
  Rye,
  Sancreek,
  Smokum,
  Mrs_Saint_Delafield,
} from 'next/font/google';
import type { ReactNode } from 'react';
import '@/styles/base.css';

// Les polices sont embarquées au build : aucune requête vers Google depuis le navigateur.
const rye = Rye({ weight: '400', subsets: ['latin'], variable: '--font-rye', display: 'swap' });
const sancreek = Sancreek({ weight: '400', subsets: ['latin'], variable: '--font-sancreek', display: 'swap', preload: false });
const ewert = Ewert({ weight: '400', subsets: ['latin'], variable: '--font-ewert', display: 'swap', preload: false });
const smokum = Smokum({ weight: '400', subsets: ['latin'], variable: '--font-smokum', display: 'swap', preload: false });
const holtwood = Holtwood_One_SC({ weight: '400', subsets: ['latin'], variable: '--font-holtwood', display: 'swap', preload: false });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });
const fell = IM_Fell_English({ weight: '400', style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-fell', display: 'swap', preload: false });
const caslon = Libre_Caslon_Text({ weight: ['400', '700'], style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-caslon', display: 'swap' });
const oldstandard = Old_Standard_TT({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-oldstandard', display: 'swap', preload: false });
const garamond = EB_Garamond({ subsets: ['latin'], variable: '--font-garamond', display: 'swap', preload: false });
const mono = Courier_Prime({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-mono', display: 'swap', preload: false });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap', preload: false });
const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-anton', display: 'swap', preload: false });
const barlow = Barlow({ weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-barlow', display: 'swap', preload: false });
const barlowCondensed = Barlow_Condensed({ weight: ['500', '600', '700'], subsets: ['latin'], variable: '--font-barlow-condensed', display: 'swap', preload: false });
const abril = Abril_Fatface({ weight: '400', subsets: ['latin'], variable: '--font-abril', display: 'swap', preload: false });
const cormorant = Cormorant_Garamond({ weight: ['500', '600', '700'], style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-cormorant', display: 'swap', preload: false });
const aurore = La_Belle_Aurore({ weight: '400', subsets: ['latin'], variable: '--font-aurore', display: 'swap', preload: false });
const plume = Mrs_Saint_Delafield({ weight: '400', subsets: ['latin'], variable: '--font-plume', display: 'swap', preload: false });

const fonts = [rye, sancreek, ewert, smokum, holtwood, playfair, fell, caslon, oldstandard, garamond, mono, plume, inter, anton, barlow, barlowCondensed, abril, cormorant, aurore]
  .map((f) => f.variable)
  .join(' ');

/**
 * Chaque page lit la base et reçoit un nonce CSP par requête : rien ne doit être figé au build.
 * `next build` n'a ainsi besoin ni de la base ni des secrets, ce qui est le cas sur Vercel.
 */
export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  themeColor: '#0f0a07',
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_ORIGIN || 'http://localhost:3000'),
  referrer: 'strict-origin-when-cross-origin',
  formatDetection: { telephone: false, email: false, address: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={fonts} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
