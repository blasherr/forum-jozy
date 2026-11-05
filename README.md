# New Frontier RP : site officiel

Site du serveur RedM New Frontier : accueil, histoire, règlement, guide, patch-notes, Discords
et panel d'administration complet. Tout ce qui est visible se modifie depuis le panel.

## Démarrer en local

Node.js 22 ou plus récent.

```bash
npm ci
npm run setup
npm run admin:create
npm run dev
```

Puis ouvrez <http://localhost:3000>. Le panel est sur `/connexion`.

- `npm run setup` crée `.env.local` avec des secrets aléatoires, la base et le contenu de départ.
- `npm run admin:create` crée le compte propriétaire. **Il n'existe aucun compte par défaut.**

## Mettre en ligne

Le site a besoin de Node.js et d'une base. Deux options, le code est le même.

### Option 1 : VPS (le plus simple pour garder la base sur votre machine)

1. Copiez le projet **sans** `.env.local` ni `data/`.
2. Créez un `.env.production.local` sur le serveur, avec **de nouveaux secrets** :

   ```
   DATABASE_URL=file:./data/site.db
   APP_ORIGIN=https://votre-domaine.fr
   SESSION_SECRET=...
   PASSWORD_PEPPER=...
   ENCRYPTION_KEY=...
   TRUSTED_IP_HEADER=x-real-ip
   ```

   Générez chaque secret avec :

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

3. Lancez :

   ```bash
   npm ci
   npm run setup
   npm run admin:create
   npm run build
   npm start
   ```

4. Placez Nginx ou Caddy devant, en HTTPS. `TRUSTED_IP_HEADER` est obligatoire : le serveur refuse de démarrer sans.
   Node ne doit écouter que sur la machine (`npm start -- -H 127.0.0.1`), sinon l'en-tête devient forgeable.

   ```nginx
   proxy_set_header Host $host;
   proxy_set_header X-Real-IP $remote_addr;
   client_max_body_size 10m;
   ```

5. Sauvegardez `data/site.db` régulièrement.

### Option 2 : Vercel + Turso

Vercel n'a pas de disque permanent : la base doit être chez [Turso](https://turso.tech) (compatible SQLite).

1. Créez une base Turso et récupérez son URL et son jeton.
2. Créez un fichier `.env.vercel` à la racine (ignoré par Git), avec **de nouveaux secrets** :

   ```
   DATABASE_URL=libsql://votre-base.turso.io
   DATABASE_AUTH_TOKEN=...
   APP_ORIGIN=https://votre-projet.vercel.app
   SESSION_SECRET=...
   PASSWORD_PEPPER=...
   ENCRYPTION_KEY=...
   TRUSTED_IP_HEADER=x-vercel-forwarded-for
   ```

3. Depuis votre poste, remplissez la base et créez le compte propriétaire :

   ```bash
   npm run setup:prod
   npm run admin:create:prod
   ```

4. Dans Vercel, importez ce fichier (**Settings → Environment Variables → Import .env**), puis relancez un déploiement.

Le build n'a besoin ni de la base ni des secrets, mais le site refuse de démarrer sans ces variables.
Vercel limite les requêtes à 4,5 Mo : une image plus lourde doit être réduite avant l'envoi dans la médiathèque.

## Sauvegarder les secrets

`PASSWORD_PEPPER` et `ENCRYPTION_KEY` doivent être conservés précieusement. S'ils sont perdus, les mots de passe
et la double authentification ne fonctionnent plus (`npm run admin:reset` permet de reprendre la main).

## Accès perdu

Il n'y a volontairement pas de « mot de passe oublié » par e-mail. Depuis le serveur :

```bash
npm run admin:reset
```

## Commandes utiles

| Commande | Effet |
| --- | --- |
| `npm test` | Tests unitaires de sécurité |
| `npm run pentest` | Attaques automatisées contre le site local (voir `docs/AUDIT-SECURITE.md`) |
| `npm run audit:deps` | Vulnérabilités connues des dépendances |
| `npm run typecheck` | Vérification des types |

## Images

- **Captures du jeu** : importées dans la médiathèque au premier lancement (`src/db/seed-data/img`). Diaporama, galerie et
  en-têtes de pages se changent dans le panel.
- **Vidéo d'accueil** : `public/video`, préparée par `scripts/art/hero-video.sh` (son supprimé, incrustations recadrées, boucle
  sans coupure). Pour la changer : relancez ce script sur une nouvelle capture. Le choix entre vidéo, diaporama et illustration
  se fait dans **Panel → Page d'accueil → Bandeau**.
- **Matières** (papier, plaques, sceaux, brume) : générées par `scripts/art/*.py`, aucune image tierce.
- **Logos** : `image/logo1.png` (carré), `logo2.png` (icône) et `logo3.png` (bannière) sont déclinés dans `public/brand` par
  `python scripts/art/brand.py public/brand`. Ce script en extrait aussi les lettres NF, reprises par les sceaux de cire
  (`python scripts/art/textures.py public/textures --seals`). Le logo de la barre du haut se change aussi dans
  **Panel → Identité et adresses → Logo**.

## Écran de chargement

Affiché entre les pages pendant environ 0,8 seconde, y compris avec Retour et les flèches du navigateur. Images, astuces et
activation se règlent dans **Panel → Identité et adresses → Écran de chargement**.

## Mises à jour en direct

Chaque enregistrement dans le panel apparaît en 2 à 3 secondes sur toutes les pages ouvertes, sans rechargement ni perte
de position (`src/components/site/LiveUpdates.tsx`). Un changement de thème recharge la page, car la feuille de style est
protégée par la CSP.

## Sécurité

Voir [docs/AUDIT-SECURITE.md](docs/AUDIT-SECURITE.md).

## Designs du site

Sept designs sont fournis : Panel > Apparence pour les comparer (aperçu réservé à ce navigateur, rien n'est publié) puis en choisir un.

| Design | Principe |
| --- | --- |
| Bureau 1847 | Papier ancien, bois sombre, plaques rivetées (`src/styles/site.css`). Enregistré dans Git sous l'étiquette `design-bureau-1847`. |
| Le Saloon, Avis de recherche, Carnet de route | Matières réelles (`src/styles/designs-real.css`). |
| Sang & Cendre, La Gazette, Cinéma | Directions graphiques (`src/styles/designs.css`). |

Les matières de `public/textures/real/` viennent de photos de [Poly Haven](https://polyhaven.com) et d'[ambientCG](https://ambientcg.com), en licence CC0. Les objets (laiton, planches, cuir cousu, cachets, papier déchiré, carnet) sont rendus avec une vraie lumière dans Blender :

```bash
python -I scripts/art/real_compose.py <dossier des photos> <dossier de rendu>
blender -b --python scripts/art/real_render.py -- <dossier de rendu>/jobs.json
python -I scripts/art/real_finish.py <dossier de rendu>/out
```
