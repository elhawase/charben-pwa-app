/**
 * MIGRATIONS.JS — Versionnement des collections localStorage
 * Pattern inspiré de Liquibase (OpenWES)
 * Adapte les données existantes quand le code évolue.
 * À charger en PREMIER dans index.html.
 * Date: 2026-09-11
 */

'use strict';

const CHARBEN_DB_VERSION_KEY = 'charben_db_version';
const CHARBEN_CURRENT_DB_VERSION = 2;

const STORAGE_KEYS_DEFAULT = [
  'charben_orders',
  'charben_grumes',
  'charben_semi',
  'charben_pf',
  'charben_qc',
  'charben_planning',
  'charben_prodplan',
  'charben_drylots'
];

// Migrations: { versionCible: [fn, fn, ...] }
// Chaque fn reçoit la version précédente (readonly)
const CHARBEN_MIGRATIONS = {

  // v0 → v1 : premières collections du système stock (InvenTree pattern)
  1: [
    function ensureStockCollections() {
      if (!localStorage.getItem('charben_stock')) localStorage.setItem('charben_stock', '[]');
      if (!localStorage.getItem('charben_parts')) localStorage.setItem('charben_parts', '[]');
      if (!localStorage.getItem('charben_build_orders')) localStorage.setItem('charben_build_orders', '[]');
      if (!localStorage.getItem('charben_stock_transactions')) localStorage.setItem('charben_stock_transactions', '[]');
    },
    function ensureDoneStockKeysExist() {
      // S'assure que les séquenceurs existent (pattern InvenTree)
      const now = new Date();
      const today = now.toISOString().slice(0, 10).replace(/-/g, '');
      const prefixes = ['GR', 'SF', 'PF', 'OF', 'GEN', 'ITEM'];
      prefixes.forEach(function(p) {
        const key = 'charben_batch_seq_' + today + '_' + p;
        if (!localStorage.getItem(key)) localStorage.setItem(key, '0');
      });
      if (!localStorage.getItem('charben_serial_seq_ITEM')) localStorage.setItem('charben_serial_seq_ITEM', '0');
    },
    function ensureEventsCollection() {
      if (!localStorage.getItem('charben_events')) localStorage.setItem('charben_events', '[]');
    },
    function ensureRulesCollection() {
      if (!localStorage.getItem('charben_rules_v1')) localStorage.setItem('charben_rules_v1', 'null');
    }
  ],

  // v1 → v2 : Séchage → Produits Semi-Finis (WIP)
  2: [
    function migrateDryingToWip() {
      // Archiver les anciens lots de séchage
      var oldDry = localStorage.getItem('charben_dry');
      if (oldDry && oldDry !== '[]') {
        localStorage.setItem('charben_dry_archived', oldDry);
        localStorage.removeItem('charben_dry');
        errLog('migrations', 'v1to2', 'charben_dry archiv\u00e9 \u2192 charben_dry_archived', 'info');
      }
      // Initialiser charben_wip si absent
      if (!localStorage.getItem('charben_wip')) {
        localStorage.setItem('charben_wip', '[]');
      }
      // Initialiser le compteur WIP
      if (!localStorage.getItem('charben_wip_counter')) {
        localStorage.setItem('charben_wip_counter', '0');
      }
    }
  ]

};

/**
 * Lance les migrations si nécessaire.
 * À appeler au chargement (avant toute lecture de données).
 */
function runMigrations() {
  var current = parseInt(localStorage.getItem(CHARBEN_DB_VERSION_KEY) || '0', 10);
  if (isNaN(current)) current = 0;
  if (current >= CHARBEN_CURRENT_DB_VERSION) return current;

  errLog('migrations', 'run', 'v' + current + ' \u2192 v' + CHARBEN_CURRENT_DB_VERSION, 'info');

  for (var target = current + 1; target <= CHARBEN_CURRENT_DB_VERSION; target++) {
    var steps = CHARBEN_MIGRATIONS[target];
    if (!steps) { localStorage.setItem(CHARBEN_DB_VERSION_KEY, String(target)); continue; }
    steps.forEach(function(fn, idx) {
      try {
        fn();
        errLog('migrations', 'step', 'v' + target + ' \u00e9tape ' + (idx + 1) + '/' + steps.length + ' OK', 'info');
      } catch (e) {
        // Une migration ne doit PAS bloquer le lancement de l'app.
        errLog('migrations', 'v' + target + ' étape ' + (idx + 1) + ' ÉCHEC', e, 'error');
      }
    });
    localStorage.setItem(CHARBEN_DB_VERSION_KEY, String(target));
  }

  return CHARBEN_CURRENT_DB_VERSION;
}

// Détection auto au chargement
(function initMigrations() {
  if (typeof document !== 'undefined' && document.readyState) {
    runMigrations();
  } else {
    runMigrations(); // Node/test
  }
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runMigrations, CHARBEN_CURRENT_DB_VERSION };
} else if (typeof window !== 'undefined') {
  window.Migrations = { run: runMigrations, version: CHARBEN_CURRENT_DB_VERSION };
}