/* app-version.js — GÉNÉRÉ par scripts/version-bump.js. NE PAS ÉDITER À LA MAIN.
   Source unique : package.json "version", synchronisée avec build.gradle
   (versionName == version, versionCode entier croissant).
   Expose window.APP_VERSION = { code, name } pour la vérification de mise à jour. */
(function () {
  var v = { code: 7, name: '1.3.0' };
  if (typeof window !== 'undefined') { window.APP_VERSION = v; }
  if (typeof globalThis !== 'undefined') { globalThis.APP_VERSION = v; }
})();
