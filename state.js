/* ============================================================
 * state.js - globals d'état UI/cache/session (ex-app.js)
 * Chargé APRÈS data.js et AVANT auth.js/app.js.
 * Dépendances: loadFromStorage, STORAGE_KEYS (firebase-core.js)
 * ============================================================ */

/* --- Journal d'erreurs (ex-app.js L9124, avant jamais déclaré) --- */
var _errorLog = [];

/* --- Édition OF en cours (ex-app.js L2761) --- */
var currentEditOrderIdx = null;

/* --- Modal fallback (ex-app.js L3181) --- */
var formModalFallbackIntent = null;

/* --- Scanner caméra grumes (ex-app.js L3652) --- */
var camScanState = { line: null, stream: null, raf: null, lastPayload: '' };

/* --- QR scan alphabet (ex-app.js L4753) --- */
var _qrScanAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/* --- Clé seuil séchage auto (ex-app.js L4999) --- */
var DRY_AUTO_THRESHOLD_KEY = 'charben_wip_threshold';

/* --- Compteur codes fardeaux (ex-app.js L5560) --- */
var _fardeauCounter = 0;

/* --- État formulaire fardeau (ex-app.js L5748) --- */
var fardeauFormState = { linesFx: 0, batchId: null };

/* --- Scanner caméra fardeaux (ex-app.js L6109) --- */
var frdScanState = { stream: null, raf: null, active: false };

/* --- Filtre tâches Kapat (ex-app.js L7280) --- */
var kdTaskFilter = 'toutes';

/* --- Calculs de coûts (ex-app.js L8785) --- */
var costings = loadFromStorage('charben_costings', []);

/* --- Enregistrements EUDR (ex-app.js L8850) --- */
var eudrRecords = loadFromStorage('charben_eudr', []);

/* --- Export namespace --- */
window.stateManager = {
  get errorLog() { return _errorLog; },
  resetErrorLog: function() { _errorLog = []; },
  getCurrentEditOrderIdx: function() { return currentEditOrderIdx; },
  setCurrentEditOrderIdx: function(v) { currentEditOrderIdx = v; },
  getKdTaskFilter: function() { return kdTaskFilter; },
  setKdTaskFilter: function(v) { kdTaskFilter = v; },
  getFardeauFormState: function() { return fardeauFormState; },
  getFrdScanState: function() { return frdScanState; },
  getCamScanState: function() { return camScanState; }
};