import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import {
  Courier_Prime,
  EB_Garamond,
  Ewert,
  Holtwood_One_SC,
  IM_Fell_English,
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
const plume = Mrs_Saint_Delafield({ weight: '400', subsets: ['latin'], variable: '--font-plume', display: 'swap', preload: false });

const fonts = [rye, sancreek, ewert, smokum, holtwood, playfair, fell, caslon, oldstandard, garamond, mono, plume]
  .map((f) => f.variable)
  .join(' ');

export const viewport: Viewport = {
  themeColor: '#0f0a07',
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_ORIGIN || 'http://localhost:3000'),
  referrer: 'strict-origin-when-cross-origin',
  formatDetection: { telephone: false, email: false, address: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="fr" className={fonts} data-scroll-behavior="smooth">
      <head>
        {/* Doit s'exécuter avant tout autre script : voir public/tt-policy.js */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/tt-policy.js" nonce={nonce} />
      </head>
      <body>{children}</body>
    </html>
  );
}
