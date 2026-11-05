/**
 * Politique Trusted Types du site public : seuls nos propres fichiers de build peuvent être chargés
 * comme script. Aucune création de HTML ni de code n'est autorisée : ces écritures restent bloquées.
 *
 * Elle vit ici et non dans une balise <script> de la mise en page : Next.js exécute ce fichier avant
 * toute hydratation, y compris sur la page d'erreur minimale envoyée avec un statut 404, qui ne contient
 * pas la mise en page. Sans cela, une page introuvable restait blanche en production.
 */
interface TrustedTypesApi {
  defaultPolicy: unknown;
  createPolicy(name: string, rules: { createScriptURL(value: string): string }): unknown;
}

const trustedTypes = (window as Window & { trustedTypes?: TrustedTypesApi }).trustedTypes;

if (trustedTypes && !trustedTypes.defaultPolicy) {
  trustedTypes.createPolicy('default', {
    createScriptURL(value) {
      const url = new URL(value, window.location.origin);
      if (url.origin === window.location.origin && url.pathname.startsWith('/_next/static/')) return value;
      throw new TypeError('Script refusé par la politique du site.');
    },
  });
}
