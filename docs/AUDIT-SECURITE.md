# Audit de sécurité : site New Frontier RP

Audit réalisé le 4 novembre 2026 sur la version locale du site, en build de production.

## Résumé

| Contrôle | Résultat |
| --- | --- |
| Faille critique ou élevée trouvée | Aucune |
| Failles moyennes et faibles trouvées | 12 par les deux relectures indépendantes, toutes corrigées |
| Défauts trouvés par les tests réels | 3, tous corrigés (voir plus bas) |
| Attaques automatisées (`npm run pentest`) | 186 contrôles sur 186 réussis |
| Tests unitaires (`npm test`) | 71 sur 71 réussis |
| Dépendances (`npm audit`) | 0 vulnérabilité connue, versions figées |
| Règlement et histoire importés | 8 299 mots comparés au GitBook, aucun manquant |

**Ce que cet audit n'est pas.** C'est un audit du code et de l'application, mené en local. Il ne remplace pas un test
d'intrusion par un tiers sur le site en ligne, et il ne couvre ni l'hébergement, ni le DNS, ni le pare-feu, ni la sécurité
des postes et des comptes de l'équipe. Aucun système ne peut être garanti inviolable : ce rapport décrit ce qui a été
vérifié, pas une absence absolue de risque.

## Méthode

1. Veille sur les failles récentes de Next.js et React, jusqu'à l'avis du 3 novembre 2026.
2. Tests automatisés de 15 familles d'attaques contre le site réel (`scripts/pentest.mjs`).
3. Deux relectures indépendantes du code : l'une sur l'authentification et les accès, l'autre sur les injections.
   Chaque résultat a été revérifié dans le code avant correction.
4. Contrôle dans un vrai navigateur, en production, avec écoute des violations de la politique de sécurité.

## Failles trouvées et corrigées

| Gravité | Problème | Correction |
| --- | --- | --- |
| Moyenne | Une session ouverte avant l'activation de la 2FA gardait ses droits, et une session volée pouvait enrôler son propre téléphone | Sessions fermées à l'activation et à la désactivation, mot de passe exigé pour commencer |
| Moyenne | Un tiers pouvait bloquer le compte propriétaire avec de mauvais mots de passe | Verrouillage strict supprimé, plafonds par IP et par couple IP/compte, remise à zéro en cas de succès |
| Moyenne | Sans en-tête d'IP fiable, tous les visiteurs partageaient un seul compteur | Le serveur refuse de démarrer en production sans `TRUSTED_IP_HEADER` |
| Moyenne | Un compte rédacteur compromis pouvait saturer le site avec des documents géants | Listes sans le corps des documents, quotas par module, documents limités à 1 Mo |
| Faible | Un cookie volé restait valide après un changement de mot de passe | Toutes les sessions sont fermées, nouveau jeton |
| Faible | Rotation d'adresses IPv6 pour contourner les limites | Compteur appliqué au bloc /64 |
| Faible | Un compte existant se trahissait par le temps de réponse | Traitement identique des échecs |
| Faible | Un rédacteur voyait un extrait du journal d'audit | Réservé aux administrateurs |
| Faible | Effacement détourné : 41 enregistrements successifs purgeaient l'original | Aucune version de moins de 30 jours n'est purgée, une version toutes les 5 minutes en rafale |
| Faible | Le blocage des Server Actions ne couvrait pas les chemins exclus du proxy | Le proxy couvre tout sauf `/_next/static/` |
| Faible | Liens `redm://` et `ts3server://` sans contrainte : un rédacteur pouvait envoyer un joueur vers un serveur piégé | Schémas retirés |
| Faible | Les blocs de code échappaient aux limites de taille | Mêmes limites que le reste du texte |

Trouvés par les tests réels :

| Problème | Correction |
| --- | --- |
| La CSP renforcée des images était écrasée par le proxy | Le proxy applique `default-src 'none'; sandbox` sur `/media/` |
| Trusted Types bloquait le chargement de scripts légitimes de Next | Politique limitée aux fichiers de `/_next/static/` (`src/instrumentation-client.ts`), 0 violation constatée en navigation |
| Pages 404 blanches en production : la page d'erreur minimale de Next ne contenait pas la politique Trusted Types | Politique déplacée dans `src/instrumentation-client.ts`, exécutée avant l'hydratation sur toutes les pages |
| Zod testait `new Function()` au démarrage du panel, signalé par la CSP | `z.config({ jitless: true })`, plus aucune violation sur le panel |
| Aperçu des designs par lien | Réservé aux comptes connectés, liste fermée côté serveur, cookie `HttpOnly`, `SameSite=Lax`, `__Host-` en ligne ; valeur ignorée si elle n'est pas dans la liste |
| Une session partielle restait utilisable pour l'aperçu des brouillons | L'aperçu passe par le même contrôle que le panel |

## Protections en place

**Injections.** Le texte enrichi n'est jamais du HTML : c'est un arbre JSON reconstruit depuis une liste blanche, puis affiché
par React. Il n'y a aucun `dangerouslySetInnerHTML`. Les couleurs, polices et tailles sont des clés d'une liste fermée, jamais du
CSS libre. Toutes les requêtes SQL passent par des paramètres liés. Tous les schémas de données refusent les champs inattendus.

**Navigateur.** CSP sans `unsafe-inline` ni `unsafe-eval`, avec nonce unique par requête et `strict-dynamic`. Trusted Types sur
le site public. Médias limités au site (`media-src 'self'`). HSTS, COOP, COEP, CORP, protection contre l'intégration dans une
page tierce.

**Connexion.** Argon2id (64 Mio, 3 passes) avec poivre conservé hors de la base. 2FA TOTP obligatoire en production, code non
rejouable, codes de secours à usage unique, secret chiffré en AES-256-GCM. Mot de passe redemandé pour les actions sensibles.
Aucun compte par défaut, aucune inscription publique, aucun « mot de passe oublié » par e-mail.

**Sessions.** Jeton aléatoire de 256 bits dont seule l'empreinte est stockée. Cookie `__Host-`, HttpOnly, Secure, SameSite=Strict.
Expiration après 30 minutes d'inactivité et 12 heures au total. Le cookie ne vaut que pour le navigateur qui l'a reçu.

**Requêtes.** Vérification de l'origine, de Fetch Metadata et d'un jeton CSRF lié à la session. Corps de requête bornés en taille,
même si l'en-tête `Content-Length` ment. Droits vérifiés dans chaque route, jamais seulement dans le proxy.

**Images.** Signature réelle du fichier contrôlée, SVG et autres formats bloqués, image entièrement réencodée : les métadonnées et
tout contenu caché disparaissent. Le fichier envoyé n'est jamais celui qui est servi.

**Failles récentes de Next.js et React.** Next.js 16.4.5, publié le 3 novembre 2026, et React 19.3.1, avec les correctifs connus à
cette date. Pas de Server Actions, pas de `use cache`, optimiseur d'images coupé, pas de SVG, pas de runtime Edge : les fonctions
visées par ces failles ne sont pas utilisées.

**Chaîne d'approvisionnement.** Versions exactes, fichier de verrouillage, scripts d'installation désactivés (`ignore-scripts`).

**Traçabilité.** Journal des connexions et des modifications, non modifiable depuis le panel. Historique des versions de chaque
contenu, avec restauration.

## Risques résiduels

- **Blocage temporaire d'un compte.** Plus de 200 essais en une heure depuis de nombreuses adresses bloquent la connexion à ce
  compte, même avec le bon mot de passe. `npm run admin:reset` lève le blocage. C'est un choix : un verrouillage plus dur serait
  plus facile à détourner.
- **Panel sans Trusted Types.** L'éditeur en a besoin pour le copier-coller. La CSP stricte reste active dans le panel.
- **Base de données non chiffrée sur le disque.** Les mots de passe et secrets 2FA y sont protégés, mais pas les contenus. Protégez
  l'accès au serveur et aux sauvegardes.
- **Déni de service réseau.** Hors du périmètre de l'application : à traiter par l'hébergeur, Cloudflare ou le pare-feu Vercel.
- **Compte administrateur compromis.** Un administrateur malveillant peut modifier le site. Le journal permet de le voir et
  l'historique de revenir en arrière. Il ne peut en revanche pas injecter de code.
- **Mises à jour.** Next.js publie souvent des correctifs : la sécurité constatée ici vaut à la date du rapport.

## À faire avant la mise en ligne

1. Générer de nouveaux secrets, propres à la production, et les conserver hors du dépôt.
2. Créer le compte propriétaire avec `npm run admin:create`, puis activer la 2FA et ranger les codes de secours.
3. Mettre le site derrière HTTPS et renseigner `TRUSTED_IP_HEADER`. Node ne doit pas être joignable directement.
4. Ne jamais déployer `.env.local`, `.dev-admin.txt` ni `data/`.
5. Sauvegarder `data/site.db` et les secrets `PASSWORD_PEPPER` et `ENCRYPTION_KEY`.
6. Activer une protection réseau (Cloudflare ou pare-feu Vercel).
7. Relancer `npm run audit:deps` chaque mois et mettre Next.js à jour dès qu'un avis de sécurité paraît.

## Rejouer l'audit

```bash
npm test
npm run audit:deps
npm run build
```

Puis, avec le compte de test local :

```bash
APP_ORIGIN=http://localhost:3100 REQUIRE_2FA=false TRUSTED_IP_HEADER=x-real-ip npx next start -p 3100
```

```bash
TARGET=http://localhost:3100 npm run pentest
```

Le script refuse de viser autre chose que localhost.

## Sources

- [Avis de sécurité de Next.js](https://github.com/vercel/next.js/security/advisories)
- [Next.js May 2026 security release](https://vercel.com/changelog/next-js-may-2026-security-release)
- [Next.js Security Update (October 2026)](https://dev.to/kunalvohra/nextjs-security-update-october-2026-cve-2026-96889-the-use-cache-rce-and-how-to-fix-your-app-4o2p)
