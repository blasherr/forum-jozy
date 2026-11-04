import type { SettingsMap } from './schemas';

/** Captures du jeu importées dans la médiathèque au premier lancement. */
const photo = (n: number) => `00000000-0000-4000-8000-00000000001${n}`;

const doc = (...paragraphs: string[]) => ({
  type: 'doc' as const,
  content: paragraphs.map((text) => ({ type: 'paragraph' as const, content: [{ type: 'text' as const, text }] })),
});

/** Contenu de départ : tout ce qui est ici se modifie ensuite depuis le panel. */
export const DEFAULT_SETTINGS: SettingsMap = {
  site: {
    name: 'New Frontier RP',
    shortName: 'New Frontier',
    tagline: 'Serveur RedM RolePlay — Louisiane, 1847',
    description:
      'New Frontier RP, serveur RedM francophone : une expérience RolePlay immersive, cohérente et agréable pour tous, dans la Louisiane de 1847.',
    logoMediaId: null,
    loader: {
      enabled: true,
      images: [photo(1), photo(4), photo(7), photo(5)],
      tips: [
        'Appuyez sur Y pour changer la portée de votre voix.',
        'Alt + clic droit sur un PNJ permet d’obtenir la rumeur en cours.',
        'F9 ouvre le mode photo.',
        'X à côté d’une chaise ou d’un lit permet de s’asseoir ou de s’allonger.',
        'Désactivez le vocal en jeu : la voix passe par TeamSpeak et SaltyChat.',
        'Le RP ne doit jamais servir de prétexte pour humilier ou mettre mal à l’aise un joueur.',
        'Les conflits RP doivent rester en RP.',
        'Selon les rumeurs, Strawberry serait déjà tombée entre des mains mexicaines.',
      ],
    },
    server: {
      connectLabel: 'Serveur RedM',
      connectCommand: 'connect https://newfrontier.glife.fr/',
      teamspeakLabel: 'Serveur TeamSpeak',
      teamspeakAddress: 'ts.newfrontier-rp.fr',
    },
    footer: {
      motto: 'Son avenir reste à écrire.',
      legal:
        'New Frontier RP est un serveur communautaire indépendant, sans lien avec Rockstar Games ni Take-Two Interactive.',
      links: [
        { label: 'Règlement', href: '/reglement' },
        { label: 'Avant de se connecter', href: '/guide/avant-de-se-connecter' },
        { label: 'Discords officiels', href: '/discord' },
      ],
    },
  },
  home: {
    order: ['intro', 'board', 'pillars', 'gallery', 'chronicle', 'join', 'gazette', 'vote'],
    hero: {
      kicker: 'Louisiane — Anno 1847',
      title: 'New Frontier',
      subtitle:
        'Son avenir reste à écrire, et ce sont désormais ses habitants qui façonneront son histoire.',
      scene: 'video',
      slides: [photo(4), photo(7), photo(3), photo(5), photo(2)],
      buttons: [
        { label: 'Rejoindre le serveur', href: '/guide/avant-de-se-connecter', variant: 'primary' },
        { label: 'Lire le règlement', href: '/reglement', variant: 'secondary' },
      ],
    },
    intro: {
      kicker: 'Avis à la population',
      title: 'Bienvenue sur New Frontier RP',
      body: doc(
        'Notre objectif est de proposer une expérience RolePlay immersive, cohérente et agréable pour tous. Tout ce dont vous aurez besoin se retrouve ici.',
        'En 1845, les richesses se concentrent entre les mains des puissants, tandis que les habitants subissent les inégalités et la dureté des autorités. Les terres reculées abritent fugitifs et trafiquants, alors que le froid et la sécheresse rendent certaines régions presque inhabitables. Les blessures de la guerre restent vives, et les récits de trésors cachés, d’accords secrets et de malédictions entretiennent les mystères de ces terres.',
        'Après un conflit entre les Américains et les peuples autochtones, un traité de paix a été signé dans l’intérêt des nations. Cependant, les décisions des autorités n’ont pas fait l’unanimité et les tensions se sont aggravées. Malgré ces divisions, la Louisiane se relève et se reconstruit.',
      ),
    },
    board: {
      kicker: 'Sommaire',
      title: 'Les registres de la frontière',
      intro: 'Tout ce qu’il faut savoir avant de prendre la route, classé par registre.',
    },
    pillars: {
      kicker: 'Les chemins possibles',
      title: 'Quelle vie mènerez-vous ?',
      items: [
        {
          title: 'Forces de l’ordre',
          text: 'Shérifs et U.S. Marshals bâtissent un roleplay cohérent, durable et équilibré, où chaque camp garde ses chances.',
          href: '/reglement/sherifs',
          seal: 'gold',
        },
        {
          title: 'Corps médical',
          text: 'Médecins de tous grades soignent, enquêtent sur les blessures et tiennent le secret médical.',
          href: '/reglement/medecins',
          seal: 'blue',
        },
        {
          title: 'Entreprises',
          text: 'Patrons et employés font vivre l’économie : embauches, livraisons, marchés, registres et rivalités.',
          href: '/reglement/entreprises',
          seal: 'black',
        },
        {
          title: 'Illégal',
          text: 'Bandes officielles, groupes indépendants ou loups solitaires : braquages, cambriolages et conséquences assumées.',
          href: '/reglement/illegal',
          seal: 'red',
        },
        {
          title: 'Peuples natifs',
          text: 'L’Ambarino reste la propriété exclusive du peuple Shunkaha. Ses lois relèvent du Conseil de Big Wolf.',
          href: '/histoire/les-natifs',
          seal: 'green',
        },
      ],
    },
    gallery: {
      kicker: 'Vu sur le serveur',
      title: 'Carnet de voyage',
      items: [
        { mediaId: photo(1), caption: 'Le saloon du Bastille, à Saint Denis' },
        { mediaId: photo(5), caption: 'Les pics de l’Ambarino' },
        { mediaId: photo(7), caption: 'Une ville au bord du lac' },
        { mediaId: photo(3), caption: 'Sous les nuages du nord' },
        { mediaId: photo(6), caption: 'Un hameau pris par la tempête' },
        { mediaId: photo(4), caption: 'Un campement au pied des sommets' },
      ],
    },
    chronicle: {
      kicker: 'Chronique',
      title: 'Ce qui s’est passé en Louisiane',
      image: photo(5),
      items: [
        {
          year: '1815',
          title: 'Gouvernance d’Edward Fontenot',
          text: 'La Louisiane connaît la paix et la prospérité. Mais sa santé décline, et la question de sa succession commence à inquiéter le territoire.',
        },
        {
          year: '1831',
          title: 'Silas Whitlock prend la relève',
          text: 'Un souffle moderne pour certains, la misère pour d’autres : la Louisiane sombre dans une chute économique dès 1832.',
        },
        {
          year: '1843',
          title: 'Coup d’État',
          text: 'Whitlock est arrêté sans échange de tirs, puis disparaît. Quelques semaines plus tard, Charles Blackwood, un inconnu, est installé au pouvoir.',
        },
        {
          year: '1845',
          title: 'La résistance des peuples natifs',
          text: 'Unies sous l’impulsion du Grand Chef Big Wolf, plusieurs tribus défendent l’Ambarino, l’un des derniers territoires échappant au contrôle américain.',
        },
        {
          year: '1846',
          title: 'Le traité de paix',
          text: 'Après l’attaque de Rhodes et une prise d’otage à Blackwater, le traité reconnaît l’Ambarino comme américain, mais propriété exclusive du peuple natif signataire.',
        },
        {
          year: '1847',
          title: 'Une nouvelle ère',
          text: 'Blackwood disparaît mystérieusement. Des forces mexicaines approchent des frontières et, selon les rumeurs, Strawberry serait déjà tombée.',
        },
      ],
    },
    join: {
      kicker: 'Prendre la route',
      title: 'Trois étapes avant de partir',
      steps: [
        {
          title: 'Préparez RedM',
          text: 'Une minute suffit pour activer l’extension de la OneSync dans le fichier CitizenFX.ini.',
          href: '/guide/extension-de-la-onesync',
          linkLabel: 'Suivre le tutoriel',
        },
        {
          title: 'Installez la voix',
          text: 'TeamSpeak et SaltyChat sont indispensables : le vocal en jeu doit être désactivé.',
          href: '/guide/teamspeak-et-saltychat',
          linkLabel: 'Installer TeamSpeak & SaltyChat',
        },
        {
          title: 'Connectez-vous',
          text: 'Ouvrez RedM, appuyez sur F8 et collez la commande de connexion ci-dessous.',
          href: '/guide/connexion',
          linkLabel: 'Toutes les adresses',
        },
      ],
    },
    gazette: { kicker: 'Dernières dépêches', title: 'La Gazette', count: 3 },
    vote: {
      kicker: 'Avis de recherche',
      title: 'On recherche votre voix',
      text: 'Chaque vote fait connaître New Frontier à de nouveaux voyageurs. Un clic, et la frontière s’agrandit.',
      buttonLabel: 'Voter pour New Frontier',
      href: 'https://top-serveurs.net/rdr/vote/new-frontier-rp',
      note: 'Vote gratuit sur Top Serveurs',
      image: null,
    },
  },
  pages: {
    histoire: {
      kicker: 'Archives de Louisiane',
      title: 'L’Histoire',
      subtitle: 'De la gouvernance d’Edward Fontenot à l’ère trouble de 1847.',
      seoDescription: 'Le lore de New Frontier RP : chronologie de la Louisiane et histoire des peuples natifs.',
      image: photo(6),
    },
    reglement: {
      kicker: 'Code de la frontière',
      title: 'Le Règlement',
      subtitle:
        'En rejoignant le serveur, vous vous engagez à suivre et respecter les règles qui suivent.',
      seoDescription: 'Le règlement complet de New Frontier RP : bases, médecins, entreprises, shérifs et illégal.',
      image: photo(1),
    },
    guide: {
      kicker: 'Almanach du voyageur',
      title: 'Le Guide',
      subtitle: 'Avant de se connecter, puis pour bien vivre en jeu : tous les tutoriels.',
      seoDescription: 'Guide de connexion à New Frontier RP : OneSync, TeamSpeak, SaltyChat et touches utiles.',
      image: photo(4),
    },
    patchnotes: {
      kicker: 'Journal officiel du serveur',
      title: 'La Gazette de la Frontière',
      subtitle: 'Correctifs, nouveautés et ajustements, numéro après numéro.',
      seoDescription: 'Les patch-notes de New Frontier RP : correctifs, nouveautés et équilibrages.',
      image: photo(7),
    },
    discord: {
      kicker: 'Bureau de poste',
      title: 'Discords officiels',
      subtitle:
        'Chaque métier et chaque univers possède son propre serveur Discord. Rejoignez celui qui correspond à votre personnage.',
      seoDescription: 'Les serveurs Discord officiels de New Frontier RP : illégal, service public, entreprises et natifs.',
      image: photo(2),
    },
    connexion: {
      kicker: 'Accès réservé',
      title: 'Connexion',
      subtitle: 'Réservé à l’équipe du serveur.',
      seoDescription: '',
      image: null,
    },
  },
  discord: {
    note: 'Merci de ne rejoindre que le Discord correspondant à votre rôle. Cela permet de garder des échanges organisés et une immersion de qualité pour l’ensemble de la communauté.',
    cards: [
      {
        title: 'Illégal',
        description: 'Bandes, groupes et activités en marge de la loi.',
        href: 'https://discord.gg/RDvuC277pz',
        buttonLabel: 'Rejoindre le Discord',
        seal: 'red',
      },
      {
        title: 'Service public',
        description: 'Shérifs, marshals, médecins et administrations.',
        href: 'https://discord.gg/QAYygqNq2m',
        buttonLabel: 'Rejoindre le Discord',
        seal: 'gold',
      },
      {
        title: 'Entreprise',
        description: 'Réservé aux patrons et co-patrons uniquement.',
        href: 'https://discord.gg/kUqsE4ESY',
        buttonLabel: 'Rejoindre le Discord',
        seal: 'black',
      },
      {
        title: 'Natif',
        description: 'Le peuple de l’Ambarino et ses alliés.',
        href: 'https://discord.gg/a2nNARtSZp',
        buttonLabel: 'Rejoindre le Discord',
        seal: 'green',
      },
    ],
  },
  theme: {
    colors: {
      blood: '#8e1a14',
      gold: '#c79a3b',
      ink: '#17100a',
      paper: '#ece0c6',
      night: '#0f0a07',
    },
    fonts: { display: 'rye', heading: 'playfair', body: 'caslon' },
    paper: 'paper-light',
    dust: true,
    backgroundMediaId: null,
  },
};

export const DEFAULT_NAV = [
  { label: 'Accueil', href: '/' },
  { label: 'Histoire', href: '/histoire' },
  { label: 'Règlement', href: '/reglement' },
  { label: 'Guide', href: '/guide' },
  { label: 'Patch-notes', href: '/patch-notes' },
  { label: 'Discord', href: '/discord' },
  { label: 'Connexion', href: '/connexion' },
];
