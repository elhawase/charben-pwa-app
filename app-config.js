/* app-config.js — Configuration de production CharbenAPK (éditable à la main).
   Fichier NON généré (contrairement à app-version.js).
   Définit les constantes d'environnement exposées sur window/globalThis.

   CHARBEN_VERSION_URL : URL du manifeste de version (version.json) consulté par
   version-check.js pour détecter les mises à jour. Sert de source de vérité en
   production (sous-domaine Hostinger app.charben-industrie.com). Si absent,
   version-check.js retombe sur <API_BASE>/version.json puis './version.json'. */
(function () {
  var CONFIG = {
    VERSION_URL: 'https://app.charben-industrie.com/version.json'
  };
  if (typeof window !== 'undefined') {
    window.CHARBEN_VERSION_URL = CONFIG.VERSION_URL;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.CHARBEN_VERSION_URL = CONFIG.VERSION_URL;
  }
})();
