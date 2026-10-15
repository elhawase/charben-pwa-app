/* ============================================================
 * data.js - variables globales metier (rawMaterials, disques, stock,
 * planning, etc.) - charge AVANT core.js et app.js
 * Doit etre charge APRES firebase-core.js (loadFromStorage, STORAGE_KEYS)
 * ============================================================ */

/* ─── Robustesse utils (Cycle 2) ─── */
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
function asyncSafe(fn) {
  return fn().catch(function(err) {
    console.error('[asyncSafe]', err);
    if (_errorLog) _errorLog.push({ t: Date.now(), m: 'asyncSafe: ' + (err.message || err).slice(0, 150) });
    if (typeof showToast === 'function') showToast('Erreur : ' + (err.message || 'inconnue').slice(0, 80), 'error');
  });
}
function tryOnce(name, fn) {
  try { return fn(); } catch(e) { console.error('[tryOnce:' + name + ']', e); if (typeof showToast === 'function') showToast(name + ' : erreur', 'error'); return null; }
}
/* --- bloc 1 (ligne 760) --- */
let lastInstallNeeds = null;

/* --- bloc 2 (ligne 761) --- */
let lastInstallMachine = null;

/* --- bloc 3 (ligne 762) --- */
let lastInstallNeedsA = null;

/* --- bloc 4 (ligne 763) --- */
let lastInstallNeedsB = null;

/* --- bloc 5 (ligne 764) --- */
let lastPatternInfo = null;

/* --- bloc 6 (ligne 765) --- */
let lastPatternA = null;

/* --- bloc 7 (ligne 766) --- */
let lastPatternB = null;

/* --- bloc 8 (ligne 881) --- */
let lastSlotInstall = null;

/* --- bloc 9 (ligne 883) --- */
const MACHINE_SPECS = {
  A2: { name: 'Scie CC', openingW: 880, openingH: 140, arbor: 800, axes: 1 },
  B2: { name: 'Scie CC', openingW: 880, openingH: 140, arbor: 800, axes: 1 },
  A3: { name: 'D\u00e9ligneuse SB', openingW: 560, openingH: 55, arbor: 460, axes: 1 },
  B3: { name: 'D\u00e9ligneuse SB', openingW: 560, openingH: 55, arbor: 460, axes: 1 },
  A4: { name: 'D\u00e9coupe dosses', openingW: 220, openingH: 160, arbor: 130, axes: 2 },
  B4: { name: 'D\u00e9coupe dosses', openingW: 220, openingH: 160, arbor: 130, axes: 2 }
};

/* --- bloc 10 (ligne 1419) --- */
var _lastPdfDataUri = null;

/* --- bloc 11 (ligne 1645) --- */
let stockFilterText = '';

/* --- bloc 12 (ligne 1710) --- */
const CALES_PAIR_KEYS = ['A1-B1', 'A2-B2', 'A3-B3', 'A4-B4'];

/* --- bloc 13 (ligne 1711) --- */
const CALES_PAIR_NAMES = {
  'A1-B1': 'Débit de la grume — découpe épaisseurs selon l\'OF',
  'A2-B2': 'Scie CC — découpe largeurs des pièces centrales',
  'A3-B3': 'Déligneuse SB — découpe largeurs des planches latérales',
  'A4-B4': 'Machine de découpe des dosses — recyclage max'
};

/* --- bloc 14 (ligne 1829) --- */
var calesRegulLogs = loadFromStorage(STORAGE_KEYS.calesRegul, []);

/* --- bloc 15 (ligne 1932) --- */
let ofSortField = 'date';

/* --- bloc 16 (ligne 1933) --- */
let ofSortDir = 'desc';

/* --- bloc 17 (ligne 1934) --- */
let ofFilterText = '';
let ofStatusFilter = '';

/* --- bloc 18 (ligne 1935) --- */
let ofSelected = new Set();

/* --- bloc 19 (ligne 1944) --- */
let ofSavedQueries = loadFromStorage(STORAGE_KEYS.savedQueries, []);

/* --- bloc 20 (ligne 2358) --- */
let activeTool = null;

/* --- bloc 21 (ligne 2383) --- */
let sciExpr = '';

/* --- bloc 22 (ligne 2384) --- */
let sciDegMode = true;

/* --- bloc 23 (ligne 2555) --- */
let timerRunning = false;

/* --- bloc 24 (ligne 2556) --- */
let timerStartTs = 0;

/* --- bloc 25 (ligne 2557) --- */
let timerElapsed = 0;

/* --- bloc 26 (ligne 2558) --- */
let timerInterval = null;

/* --- bloc 27 (ligne 2559) --- */
let timerLapCount = 0;

/* --- bloc 28 (ligne 2634) --- */
var prodCounters = loadFromStorage('charben_prod_counters', { 
  ligneA: {A1:0, A2:0, A3:0, A4:0}, 
  ligneB: {B1:0, B2:0, B3:0, B4:0} 
});

/* --- bloc 29 (ligne 2655) --- */
const LINE_LAUNCH_KEY = 'charben_line_launch';

/* --- bloc 30 (ligne 2656) --- */
const LAUNCH_WIDTH_TOLERANCE = 15;

/* --- bloc 31 (ligne 2657) --- */
var lineLaunch = loadFromStorage(LINE_LAUNCH_KEY, {});

/* --- bloc 32 (ligne 2724) --- */
var launcherSel = {};

/* --- bloc 33 (ligne 2868) --- */
const GAMME_PIN_WIDTHS = [75, 100, 125, 150, 175, 200, 225, 250];

/* --- bloc 34 (ligne 2869) --- */
const GAMME_PIN = {
  16: { sb: [75, 100, 125], cc: [] },
  19: { sb: [75, 100, 125, 150], cc: [] },
  25: { sb: [75, 100, 125, 150, 175, 200, 225], cc: [] },
  32: { sb: [100, 125, 150, 175, 200, 225], cc: [100, 125, 150, 175, 200, 225] },
  38: { sb: [100, 125, 150, 175, 200, 225], cc: [100, 125, 150, 175, 200, 225] },
  44: { sb: [], cc: [100, 125, 150] },
  47: { sb: [], cc: [100, 125, 150, 200, 225] },
  50: { sb: [], cc: [100, 125, 150, 175, 200, 225, 250] },
  63: { sb: [], cc: [100, 125, 150, 175, 200, 225] },
  75: { sb: [], cc: [100, 125, 150, 175, 200, 225] }
};

/* --- bloc 35 (ligne 2881) --- */
const GAMME_SPRUCE = {
  16: { sb: [75, 100], cc: [] },
  19: { sb: [75, 100, 125], cc: [] },
  22: { sb: [75, 100, 125, 150, 175, 200], cc: [] },
  25: { sb: [100, 125, 150], cc: [] },
  32: { sb: [100, 125, 150, 175, 200, 225], cc: [125, 150, 175, 200, 225] },
  38: { sb: [], cc: [100, 125, 150, 175, 200, 225] },
  44: { sb: [], cc: [100, 125, 150, 175, 200] },
  47: { sb: [], cc: [100, 125, 150, 175, 200, 225, 250] },
  50: { sb: [], cc: [100, 125, 150, 175, 200, 225, 250] },
  63: { sb: [], cc: [125, 150, 175, 200, 225] },
  75: { sb: [], cc: [150, 175, 200, 225, 250] }
};

/* --- bloc 36 (ligne 2894) --- */
const GAMME_ESSENCES = {
  pin: { label: 'Pin (Pine)', data: GAMME_PIN },
  spruce: { label: 'Épicéa (Spruce)', data: GAMME_SPRUCE }
};

/* --- Retrait séchage (bois vert → sec) par essence, en fraction ---
   Aligné sur essence.retrait_sechage (001_essence.sql) :
   PIN 0.060 · EPICEA 0.050 · CHENE 0.060 (other = défaut colonne 0.050) --- */
const dryingShrinkByEssence = {
  pin: 0.06,
  spruce: 0.05,
  chene: 0.06,
  cedar: 0.04,
  eucalyptus: 0.07,
  poplar: 0.05,
  other: 0.05
};

/* --- bloc 37 (ligne 2898) --- */
const GAMME_ESSENCE_KEY = 'charben_gamme_essence';

/* --- bloc 38 (ligne 2925) --- */
const DEFAULT_SAFETY_MARGIN = 10;

/* --- bloc 39 (ligne 2958) --- */
let lastSuggestions = [];

/* --- bloc 40 (ligne 3451) --- */
var rawMaterials = loadFromStorage('charben_raw', []);

/* --- bloc 41 (ligne 3550) — dryingBatches déplacé → wipProducts (produits semi-finis) --- */
var dryingBatches = [];
var wipProducts = loadFromStorage('charben_wip', []);

/* --- bloc 42 (ligne 3659) --- */
var finishedGoods = loadFromStorage('charben_stock', []);

/* --- bloc 49 (ligne 3751) --- */
var equipment = loadFromStorage('charben_equip', []);

/* --- bloc 50 (ligne 3752) --- */
var maintenanceLogs = loadFromStorage('charben_maint', []);

/* --- bloc 51 (ligne 3929) --- */
const DISQUES_LOCATIONS = ['En Stock', 'A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];

/* --- bloc 52 (ligne 3930) --- */
const DISQUES_MACHINES = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];

/* --- bloc 53 (ligne 3931) --- */
const MACHINE_SLOT_NAMES = {
  A1: 'Débit de la grume — découpe épaisseurs selon l\'OF (ex. 2 CC + 2 SB)',
  B1: 'Débit de la grume — découpe épaisseurs selon l\'OF (ex. 2 CC + 2 SB)',
  A2: 'Scie CC — découpe largeurs des pièces centrales (ex. madrier 125 + chevron 10)',
  B2: 'Scie CC — découpe largeurs des pièces centrales (ex. madrier 125 + chevron 10)',
  A3: 'D\u00e9ligneuse SB — découpe largeurs des planches lat\u00e9rales (semi-finis)',
  B3: 'D\u00e9ligneuse SB — découpe largeurs des planches lat\u00e9rales (semi-finis)',
  A4: 'Machine de d\u00e9coupe des dosses — param\u00e8tres sp\u00e9ciaux (recyclage max)',
  B4: 'Machine de d\u00e9coupe des dosses — param\u00e8tres sp\u00e9ciaux (recyclage max)'
};

/* --- bloc 54 (ligne 3945) --- */
const DISQUES_SEED = [
  {
    id: 'disq650', ref: '650 x 5,6 x 4,5 x 100 x 48T+8P', type: 'principale', diametre: 650,
    stockTotal: 16, enService: 0, locations: { 'En Stock': 6, A1: 0, A2: 0, A3: 0, A4: 10, B1: 0, B2: 0, B3: 0, B4: 0 },
    seuilAlerte: 2, seuilMeters: 50000, totalMeters: 0, lastSharpening: '', usages: [], createdAt: new Date().toISOString()
  },
  {
    id: 'disq355a', ref: '355 x 3,4 x 2,7 x 30 x (70) x 40+4', type: 'secondaire', diametre: 355,
    stockTotal: 14, enService: 0, locations: { 'En Stock': 0, A1: 4, A2: 0, A3: 0, A4: 0, B1: 4, B2: 0, B3: 0, B4: 6 },
    seuilAlerte: 2, seuilMeters: 40000, totalMeters: 0, lastSharpening: '', usages: [], createdAt: new Date().toISOString()
  },
  {
    id: 'disq210', ref: '210 x 2,6 x 2,1 x 50 x 30+3', type: 'secondaire', diametre: 210,
    stockTotal: 21, enService: 0, locations: { 'En Stock': 0, A1: 0, A2: 2, A3: 0, A4: 0, B1: 0, B2: 3, B3: 0, B4: 16 },
    seuilAlerte: 3, seuilMeters: 40000, totalMeters: 0, lastSharpening: '', usages: [], createdAt: new Date().toISOString()
  },
  {
    id: 'disq355b', ref: '355 x 3,4 x 2,7 x 30 x (50) x 36+4', type: 'secondaire', diametre: 355,
    stockTotal: 8, enService: 0, locations: { 'En Stock': 0, A1: 0, A2: 0, A3: 2, A4: 0, B1: 0, B2: 0, B3: 2, B4: 4 },
    seuilAlerte: 2, seuilMeters: 40000, totalMeters: 0, lastSharpening: '', usages: [], createdAt: new Date().toISOString()
  }
];

/* --- bloc 55 (ligne 3968) --- */
var disques = loadFromStorage('charben_disques', null);

/* --- bloc 56 (ligne 4125) --- */
var currentEquipTab = 'machines';

/* --- bloc 57 (ligne 4449) --- */
var disquesRegulLogs = loadFromStorage(STORAGE_KEYS.disquesRegul, []);

/* --- bloc 58 (ligne 4527) --- */
var shifts = loadFromStorage('charben_shifts', []);

/* --- bloc 59 (ligne 4528) --- */
var auditLogs = loadFromStorage('charben_audit', []);

/* --- bloc 60 (ligne 4642) --- */
var qualityChecks = JSON.parse(localStorage.getItem('charben_qc') || '[]');

/* --- bloc 61 (ligne 4643) --- */
var planningTasks = JSON.parse(localStorage.getItem('charben_planning') || '[]');

/* --- bloc 64 (ligne 4646) --- */
var productionPlan = JSON.parse(localStorage.getItem('charben_prodplan') || '[]');

/* --- bloc 65 (ligne 4647) --- */
var ppSelected = {};

/* --- bloc 66b (ligne ~5480) --- */
var fardeaux;
try { fardeaux = JSON.parse(localStorage.getItem('charben_fardeaux') || '[]'); } catch (e) { fardeaux = []; }
if (!Array.isArray(fardeaux)) fardeaux = [];

/* --- bloc 67 (ligne 6060) --- */
var ofHistory = JSON.parse(localStorage.getItem('charben_of_history') || '[]');

/* --- bloc auto-completion clients (MODULE 8 planning) --- */
var clientAutoCtx = {};
var _xlsxPromise = null;

/* --- bloc 68 (ligne 6238) --- */
var emojiObserver = null;
