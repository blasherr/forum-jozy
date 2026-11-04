/**
 * Exécuté une fois au démarrage du serveur : une configuration dangereuse (secret manquant,
 * origine en http, en-tête d'IP absent en production) arrête tout de suite le lancement,
 * au lieu d'apparaître à la première tentative de connexion.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { env } = await import('@/env');
    void env.APP_ORIGIN;
  }
}
