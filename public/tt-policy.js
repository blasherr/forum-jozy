// Politique Trusted Types du site public : seuls nos propres fichiers de build peuvent être chargés
// comme script. Aucune création de HTML ni de code n'est autorisée : ces écritures restent bloquées.
if (window.trustedTypes && !window.trustedTypes.defaultPolicy) {
  window.trustedTypes.createPolicy('default', {
    createScriptURL: function (value) {
      var url = new URL(value, location.origin);
      if (url.origin === location.origin && url.pathname.indexOf('/_next/static/') === 0) return value;
      throw new TypeError('Script refusé par la politique du site.');
    },
  });
}
