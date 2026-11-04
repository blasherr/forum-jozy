import type { Collection } from '@/db/schema';

export interface CollectionInfo {
  key: Collection;
  label: string;
  singular: string;
  path: string;
  base: string;
  sortable: boolean;
}

/** Description des modules éditables : le panel se construit à partir de cette table. */
export const COLLECTION_INFO: Record<string, CollectionInfo> = {
  reglement: { key: 'rules', label: 'Règlement', singular: 'chapitre', path: 'reglement', base: '/reglement', sortable: true },
  guide: { key: 'guide', label: 'Guide', singular: 'tutoriel', path: 'guide', base: '/guide', sortable: true },
  'patch-notes': { key: 'patchnotes', label: 'Patch-notes', singular: 'patch-note', path: 'patch-notes', base: '/patch-notes', sortable: false },
  histoire: { key: 'lore', label: 'Histoire', singular: 'archive', path: 'histoire', base: '/histoire', sortable: true },
  pages: { key: 'pages', label: 'Pages libres', singular: 'page', path: 'pages', base: '/p', sortable: true },
};

export const infoFor = (collection: Collection): CollectionInfo =>
  Object.values(COLLECTION_INFO).find((c) => c.key === collection) ?? COLLECTION_INFO.pages!;

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  editor: 'Rédacteur',
};

export const AUDIT_LABELS: Record<string, string> = {
  'auth.login': 'Connexion réussie',
  'auth.logout': 'Déconnexion',
  'auth.failed': 'Échec de connexion',
  'auth.mfa_failed': 'Code 2FA refusé',
  'auth.recovery_used': 'Code de secours utilisé',
  'auth.sudo': 'Mot de passe reconfirmé',
  'account.password': 'Mot de passe changé',
  'account.profile': 'Profil modifié',
  'account.2fa_enabled': '2FA activée',
  'account.2fa_disabled': '2FA désactivée',
  'account.recovery_regenerated': 'Codes de secours renouvelés',
  'account.sessions_revoked': 'Sessions fermées',
  'setting.update': 'Réglage modifié',
  'setting.restore': 'Réglage restauré',
  'nav.update': 'Navigation modifiée',
  'entry.create': 'Contenu créé',
  'entry.update': 'Contenu modifié',
  'entry.delete': 'Contenu supprimé',
  'entry.restore': 'Version restaurée',
  'entry.reorder': 'Ordre modifié',
  'media.upload': 'Image envoyée',
  'media.update': 'Image modifiée',
  'media.delete': 'Image supprimée',
  'user.create': 'Compte créé',
  'user.update': 'Compte modifié',
  'user.delete': 'Compte supprimé',
  'backup.export': 'Sauvegarde exportée',
};
