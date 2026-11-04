/**
 * Convertit le règlement GitBook (.md) en documents du site.
 * Ne sert qu'une fois : le résultat est écrit dans src/db/seed-data/content.json.
 * Usage : tsx scripts/import-gitbook.ts <dossier des .md>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { marked, type Token, type Tokens } from 'marked';
import type { Block, Inline, ListItem, Mark, RichDoc, TableCell } from '../src/lib/richtext/types';
import { sanitizeDoc, slugify } from '../src/lib/richtext/validate';

const dir = process.argv[2];
if (!dir) throw new Error('Dossier source manquant');

function cleanSource(raw: string): string {
  return raw
    .replace(/^> For the complete documentation index.*$/m, '')
    .replace(/&#x20;/g, ' ')
    .replace(/\n---\s*$/g, '\n')
    .replace(/<figure>.*?<\/figure>/gs, '')
    .replace(/:([a-z_]|\\_)+:\s?/g, '')
    .replace(/\\_/g, '_');
}

const unescape = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '’')
    .replace(/\s+\n/g, '\n');

function inline(tokens: Token[] | undefined, marks: Mark[] = []): Inline[] {
  const out: Inline[] = [];
  const pushText = (raw: string) => {
    const text = unescape(raw);
    if (text.length === 0) return;
    const last = out[out.length - 1];
    const same = last?.type === 'text' && JSON.stringify(last.marks ?? []) === JSON.stringify(marks);
    if (same && last?.type === 'text') last.text += text;
    else out.push({ type: 'text', text, ...(marks.length > 0 && { marks }) });
  };
  for (const t of tokens ?? []) {
    switch (t.type) {
      case 'strong':
        out.push(...inline((t as Tokens.Strong).tokens, [...marks, { type: 'bold' }]));
        break;
      case 'em':
        out.push(...inline((t as Tokens.Em).tokens, [...marks, { type: 'italic' }]));
        break;
      case 'del':
        out.push(...inline((t as Tokens.Del).tokens, [...marks, { type: 'strike' }]));
        break;
      case 'codespan':
        out.push({ type: 'text', text: unescape((t as Tokens.Codespan).text), marks: [...marks, { type: 'code' }] });
        break;
      case 'link': {
        const link = t as Tokens.Link;
        out.push(...inline(link.tokens, [...marks, { type: 'link', attrs: { href: link.href } }]));
        break;
      }
      case 'br':
        out.push({ type: 'hardBreak' });
        break;
      case 'html':
        if (/<br\s*\/?>/i.test((t as Tokens.HTML).raw)) out.push({ type: 'hardBreak' });
        break;
      case 'text': {
        const tt = t as Tokens.Text;
        if (tt.tokens && tt.tokens.length > 0) out.push(...inline(tt.tokens, marks));
        else pushText(tt.text);
        break;
      }
      case 'escape':
        pushText((t as Tokens.Escape).text);
        break;
      default:
        pushText((t as { raw: string }).raw);
    }
  }
  // Pas de saut de ligne ni d'espace résiduel en bout de paragraphe.
  while (out.length > 0) {
    const last = out[out.length - 1];
    if (last?.type === 'hardBreak') {
      out.pop();
      continue;
    }
    if (last?.type === 'text' && last.text.trim() === '') {
      out.pop();
      continue;
    }
    if (last?.type === 'text') last.text = last.text.trimEnd();
    break;
  }
  return out;
}

function listItems(list: Tokens.List): ListItem[] {
  return list.items.map((item) => {
    const content: Block[] = [];
    for (const tok of item.tokens) {
      if (tok.type === 'text' || tok.type === 'paragraph') {
        const c = inline((tok as Tokens.Text).tokens ?? [tok]);
        if (c.length > 0) content.push({ type: 'paragraph', content: c });
      } else if (tok.type === 'list') {
        content.push(block(tok as Tokens.List)!);
      }
    }
    if (content.length === 0) content.push({ type: 'paragraph' });
    return { type: 'listItem', content };
  });
}

function block(token: Token): Block | null {
  switch (token.type) {
    case 'heading': {
      const t = token as Tokens.Heading;
      const level = t.depth <= 2 ? 2 : t.depth === 3 ? 3 : 3;
      const content = inline(t.tokens).map((n) =>
        n.type === 'text' && n.marks ? { ...n, marks: n.marks.filter((m) => m.type !== 'bold') } : n,
      );
      return content.length > 0 ? { type: 'heading', attrs: { level: level as 2 | 3 }, content } : null;
    }
    case 'paragraph': {
      const content = inline((token as Tokens.Paragraph).tokens);
      return content.length > 0 ? { type: 'paragraph', content } : null;
    }
    case 'list': {
      const l = token as Tokens.List;
      return l.ordered
        ? {
            type: 'orderedList',
            ...(typeof l.start === 'number' && l.start > 1 && { attrs: { start: l.start } }),
            content: listItems(l),
          }
        : { type: 'bulletList', content: listItems(l) };
    }
    case 'code':
      return { type: 'codeBlock', content: [{ type: 'text', text: (token as Tokens.Code).text }] };
    case 'hr':
      return { type: 'horizontalRule' };
    case 'blockquote':
      return { type: 'blockquote', content: blocks((token as Tokens.Blockquote).tokens) };
    default:
      return null;
  }
}

const blocks = (tokens: Token[]): Block[] => tokens.map(block).filter((b): b is Block => b !== null);

function convert(file: string): { title: string; summary: string; body: RichDoc } {
  const source = cleanSource(readFileSync(path.join(dir!, file), 'utf8'));
  const tokens = marked.lexer(source);
  const h1Index = tokens.findIndex((t) => t.type === 'heading' && (t as Tokens.Heading).depth === 1);
  const title = h1Index >= 0 ? (tokens[h1Index] as Tokens.Heading).text : file;
  const rest = tokens.filter((_, i) => i !== h1Index);
  const body = sanitizeDoc({ type: 'doc', content: blocks(rest) });
  const first = body.content.find((b) => b.type === 'paragraph');
  const summary =
    first?.type === 'paragraph'
      ? (first.content ?? []).map((n) => (n.type === 'text' ? n.text : ' ')).join('').slice(0, 300)
      : '';
  return { title, summary, body };
}

// --- petits constructeurs pour les tutoriels, recomposés depuis vos captures Discord ---
const t = (text: string, ...marks: Mark['type'][]): Inline => ({
  type: 'text',
  text,
  ...(marks.length > 0 && { marks: marks.map((m) => ({ type: m })) as Mark[] }),
});
const p = (...content: (Inline | string)[]): Block => ({
  type: 'paragraph',
  content: content.map((c) => (typeof c === 'string' ? t(c) : c)),
});
const h = (level: 2 | 3, text: string): Block => ({ type: 'heading', attrs: { level }, content: [t(text)] });
const code = (text: string): Block => ({ type: 'codeBlock', content: [{ type: 'text', text }] });
const ol = (...items: Block[][]): Block => ({
  type: 'orderedList',
  content: items.map((content) => ({ type: 'listItem', content })),
});
const ul = (...items: (Inline | string)[][]): Block => ({
  type: 'bulletList',
  content: items.map((c) => ({ type: 'listItem', content: [p(...c)] })),
});
const callout = (variant: 'note' | 'warning' | 'danger' | 'success', ...content: Block[]): Block => ({
  type: 'callout',
  attrs: { variant },
  content,
});
const link = (text: string, href: string): Inline => ({
  type: 'text',
  text,
  marks: [{ type: 'link', attrs: { href } }],
});
const table = (head: string[], rows: (string | Inline[])[][]): Block => {
  const cell = (type: TableCell['type'], c: string | Inline[]): TableCell => ({
    type,
    content: [{ type: 'paragraph', content: typeof c === 'string' ? [t(c)] : c }],
  });
  return {
    type: 'table',
    content: [
      { type: 'tableRow', content: head.map((c) => cell('tableHeader', c)) },
      ...rows.map((r) => ({ type: 'tableRow' as const, content: r.map((c) => cell('tableCell', c)) })),
    ],
  };
};

const doc = (...content: Block[]): RichDoc => sanitizeDoc({ type: 'doc', content });

const guide = [
  {
    slug: 'avant-de-se-connecter',
    title: 'Avant de se connecter',
    summary: 'Le B.A.-BA pour rejoindre New Frontier : les adresses et les réglages à faire une fois pour toutes.',
    category: 'Bien démarrer',
    body: doc(
      p('Quatre choses à faire avant votre première connexion. Comptez cinq minutes en tout.'),
      h(2, 'Adresse du serveur RedM'),
      p('Ouvrez RedM, appuyez sur ', t('F8', 'bold'), ' pour ouvrir la console, puis collez :'),
      code('connect https://newfrontier.glife.fr/'),
      h(2, 'Adresse du serveur TeamSpeak'),
      code('ts.newfrontier-rp.fr'),
      callout('warning', p(t('Désactivez le chat en jeu', 'bold'), ' dans les paramètres de votre jeu, ainsi que le ', t('vocal en jeu', 'bold'), '. La voix passe par TeamSpeak et SaltyChat.')),
      h(2, 'La suite des réglages'),
      ul(
        [link('Activer l’extension de la OneSync', '/guide/extension-de-la-onesync'), ' : à faire une seule fois.'],
        [link('Installer TeamSpeak et SaltyChat', '/guide/teamspeak-et-saltychat'), ' : indispensable pour parler en jeu.'],
        [link('Découvrir les touches utiles', '/guide/touches-utiles'), ' : à garder sous la main.'],
      ),
    ),
  },
  {
    slug: 'connexion',
    title: 'Adresses de connexion',
    summary: 'L’adresse du serveur RedM et celle du serveur TeamSpeak.',
    category: 'Bien démarrer',
    body: doc(
      h(2, 'Serveur RedM'),
      code('connect https://newfrontier.glife.fr/'),
      h(2, 'Serveur TeamSpeak'),
      code('ts.newfrontier-rp.fr'),
      p('Aucun mot de passe n’est requis.'),
    ),
  },
  {
    slug: 'extension-de-la-onesync',
    title: 'Extension de la OneSync',
    summary: 'La manipulation prend moins d’une minute et permet de profiter de l’extension de la OneSync.',
    category: 'Bien démarrer',
    body: doc(
      callout('danger', p(t('Important', 'bold'), ' : la manipulation prend moins d’une minute. Ne modifiez aucune autre ligne du fichier CitizenFX.ini.')),
      ol(
        [p('Fermez complètement RedM et faites ', t('Windows + R', 'bold'), ', puis copiez/collez :'), code('%localappdata%\\RedM\\RedM.app')],
        [p('Ouvrez le fichier ', t('CitizenFX.ini', 'code'), ' avec le Bloc-notes.')],
        [p('Sous la ligne ', t('[Game]', 'code'), ', ajoutez :'), code('UpdateChannel=specific/feature/redm-physical-player-extension'), p('Si une ligne ', t('UpdateChannel=', 'code'), ' est déjà présente, remplacez-la simplement par celle-ci.')],
        [p('Faites ', t('Ctrl + S', 'bold'), ' pour enregistrer, fermez le fichier puis relancez RedM.')],
      ),
      callout('success', p(t('C’est terminé !', 'bold'), ' Merci à tous pour votre compréhension et bon jeu !')),
    ),
  },
  {
    slug: 'teamspeak-et-saltychat',
    title: 'TeamSpeak & SaltyChat',
    summary: 'Installer TeamSpeak puis le plug-in SaltyChat pour la voix en jeu.',
    category: 'Bien démarrer',
    body: doc(
      h(2, 'Installation de TeamSpeak'),
      p('Téléchargez TeamSpeak via ce lien : ', link('teamspeak.com/en/downloads', 'https://teamspeak.com/en/downloads?product=ts3')),
      p('Lancez l’installation et suivez les étapes. Pour information, l’installation d’Overwolf n’est pas nécessaire.'),
      p('Une fois TeamSpeak installé, ', t('fermez totalement l’application', 'bold'), ' et vérifiez dans le gestionnaire de tâches qu’elle ne soit pas restée en arrière-plan.'),
      callout('warning', p(t('Attention', 'bold'), ' : si vous laissez TeamSpeak ouvert, vous ne pourrez pas correctement installer le plug-in SaltyChat.')),
      h(2, 'Installation de SaltyChat'),
      p('Téléchargez SaltyChat via ce lien : ', link('saltyhub.net/saltychat', 'https://saltyhub.net/saltychat')),
      p('Lancez l’installation et validez le règlement.'),
      h(2, 'Finalisation de l’installation'),
      p('Réouvrez TeamSpeak, puis :'),
      ul(
        ['Dans ', t('Outils', 'bold'), ' → ', t('Compléments', 'bold'), ', vérifiez que SaltyChat soit bien installé en version 4.1.0 et qu’il soit indiqué comme étant « Activé ».'],
        ['Activez le Push-to-talk dans ', t('Outils', 'bold'), ' → ', t('Options', 'bold'), ' → ', t('Capturer', 'bold'), '.'],
        ['Désactivez les bruits de TS dans ', t('Outils', 'bold'), ' → ', t('Options', 'bold'), ' → ', t('Notifications', 'bold'), ' : sélectionnez « Sounds deactivated » dans le menu déroulant.'],
        ['Connectez-vous dans ', t('Connexions', 'bold'), ' → ', t('Se connecter', 'bold'), ' avec l’adresse ci-dessous (aucun mot de passe requis).'],
      ),
      code('ts.newfrontier-rp.fr'),
      p('Pour rappel, la touche pour changer la portée de voix en jeu est ', t('Y', 'bold'), ' (voir le ', link('guide des touches utiles', '/guide/touches-utiles'), ').'),
      callout('danger', p(t('Pensez à désactiver le vocal en jeu', 'bold'), ' dans les paramètres de votre jeu.')),
    ),
  },
  {
    slug: 'touches-utiles',
    title: 'Touches utiles en jeu',
    summary: 'Inventaire, animations, portée de voix, menus : toutes les touches à connaître.',
    category: 'En jeu',
    body: doc(
      h(2, 'Au clavier'),
      table(
        ['Touche', 'Action'],
        [
          [[t('I', 'bold')], 'Inventaire'],
          [[t('W', 'bold')], 'Menu animations et démarches'],
          [[t('X', 'bold')], 'Annuler une animation du menu W en cours'],
          [[t('X à côté d’une chaise ou d’un lit', 'bold')], 'S’asseoir / s’allonger (ne pas fermer le bandeau)'],
          [[t('X + touche directionnelle', 'bold')], 'Changer de panel de raccourcis'],
          [[t('X dans le vide', 'bold')], 'Peut ouvrir le menu de scénario contextuel (scénarios avec l’environnement)'],
          [[t('X + molette souris', 'bold')], 'Changer la vitesse de déplacement'],
          [[t('Y', 'bold')], 'Portée de voix'],
          [[t('J', 'bold')], 'Ragdoll'],
          [[t('K', 'bold')], 'Lever les mains'],
          [[t('N', 'bold')], 'Push-to-talk par défaut (modifiable dans les paramètres vocaux du jeu)'],
          [[t('F1', 'bold')], 'Menu vêtements & skin'],
          [[t('F2', 'bold')], 'Menu artisanat'],
          [[t('F9', 'bold')], 'Mode photo'],
        ],
      ),
      h(2, 'Alt + clic droit'),
      table(
        ['Sur…', 'Permet de…'],
        [
          [[t('Votre personnage', 'bold')], 'Diverses options (santé, vêtements, refresh personnage, etc.)'],
          [[t('Un autre personnage', 'bold')], 'Interagir avec les autres joueurs (donner de l’argent, etc.)'],
          [[t('Un objet ou une porte', 'bold')], 'Ouvrir les options d’interaction avec les objets'],
          [[t('Un PNJ', 'bold')], 'Obtenir la rumeur en cours'],
        ],
      ),
    ),
  },
  {
    slug: 'volume-des-instruments',
    title: 'Volume des instruments',
    summary: 'Baisser le son des instruments de musique uniquement pour vous.',
    category: 'En jeu',
    body: doc(
      p('Si le son des ', t('instruments de musique est trop fort', 'bold'), ' de votre côté, vous pouvez le régler indépendamment du reste du jeu.'),
      p('Ouvrez le ', t('mélangeur de volume Windows', 'bold'), ' et baissez simplement le volume de ', t('Chromium', 'bold'), ' (ligne « RedM Chromium subprocess »).'),
      { type: 'image', attrs: { src: '/media/00000000-0000-4000-8000-000000000001', alt: 'Clic droit sur l’icône de son de Windows, puis Ouvrir le mélangeur de volume', size: 'small' } },
      { type: 'image', attrs: { src: '/media/00000000-0000-4000-8000-000000000002', alt: 'Dans le mélangeur, le curseur de RedM Chromium subprocess baissé à 15', size: 'large' } },
      p('Cela vous permettra de réduire le son des instruments ', t('uniquement pour vous', 'bold'), ', sans modifier le volume général de RedM.'),
    ),
  },
];

const patchnotes = [
  {
    slug: 'patch-note-25-octobre-2026',
    title: 'Patch Note — New Frontier',
    summary: 'Tableau de service, registre des ventes par employé, peines en jours, cambriolages plus payants et export des magasins généraux.',
    author: 'Kono',
    publishedAt: Date.UTC(2026, 9, 25, 17, 42),
    body: doc(
      h(2, 'Correctifs & améliorations'),
      ul(
        [t('Récolte des plantes', 'bold'), ' : les plantes à cueillir sont mieux réparties dans les zones où plusieurs secteurs se chevauchent.'],
        [t('Connexion', 'bold'), ' : fix d’une cause de « connection timed out » pendant les chargements lents lié à Rob Plantes.'],
      ),
      h(2, 'MDT & forces de l’ordre'),
      ul(
        [t('Registres', 'bold'), ' : possibilité d’archiver les registres en lecture seule, selon le grade.'],
        [t('Rapports d’arrestation', 'bold'), ' : les peines peuvent désormais être renseignées en minutes, en heures ou en jours. Possibilité de lister les éléments ', t('saisis', 'bold'), ' : armes, munitions, objets, argent et biens.'],
        [t('Affiches', 'bold'), ' : tous les shérifs peuvent désormais retirer une affiche des panneaux.'],
      ),
      h(2, 'Activités illégales'),
      ul(
        [t('Cambriolages', 'bold'), ' : les cambriolages permettent de trouver du butin un peu plus souvent. Le crochet est désormais bien consommé lors de son utilisation.'],
        [t('Braquages', 'bold'), ' : les braquages des magasins généraux rapportent davantage.'],
        [t('Horaires', 'bold'), ' : les plages horaires de certaines activités ont été ajustées.'],
      ),
      h(2, 'Commerces & métiers'),
      ul(
        [t('Tableau de service', 'bold'), ' : le patron peut désormais installer une ardoise devant son commerce. Elle permet de consulter qui est présent, en déplacement ou absent, avec des notes et les événements à venir. Chaque employé peut également mettre à jour sa ligne à distance via ', t('ALT + clic sur soi-même', 'bold'), '.'],
        [t('Registre des ventes par employé', 'bold'), ' : chaque vente indique désormais l’employé qui l’a réalisée. Un récapitulatif des ventes par employé est disponible. Les écritures manuelles peuvent désormais être supprimées.'],
        [t('Journal des mouvements', 'bold'), ' : possibilité de consulter qui a déposé ou récupéré du stock. Les dépôts et retraits d’argent dans la caisse sont également enregistrés.'],
        [t('Export des magasins généraux', 'bold'), ' : le prix de rachat diminue par paliers au fil de la semaine. Remise à zéro chaque ', t('lundi', 'bold'), '.'],
      ),
    ),
  },
];

const rulesFiles: [string, string][] = [
  ['reglement_les-bases.md', 'les-bases'],
  ['reglement_medecins.md', 'medecins'],
  ['reglement_entreprises.md', 'entreprises'],
  ['reglement_sherifs.md', 'sherifs'],
  ['reglement_illegal.md', 'illegal'],
];
const loreFiles: [string, string][] = [
  ['lore_dans-les-grandes-lignes.md', 'dans-les-grandes-lignes'],
  ['lore_evenements-chronologiques.md', 'evenements-chronologiques'],
  ['lore_les-natifs.md', 'les-natifs'],
];

const rules = rulesFiles.map(([file, slug]) => ({ slug, ...convert(file) }));
const lore = loreFiles.map(([file, slug]) => ({ slug, ...convert(file) }));

const output = { rules, lore, guide, patchnotes };
writeFileSync('src/db/seed-data/content.json', JSON.stringify(output, null, 1));
const count = (d: RichDoc) => JSON.stringify(d).length;
for (const e of [...rules, ...lore, ...guide]) console.log(e.slug.padEnd(30), e.title.padEnd(34), count(e.body));
console.log('slugs ok', slugify('Évènements chronologiques'));
