/**
 * REALTIME-SYNC.JS — Listeners Firestore temps réel via onSnapshot
 * Scierie Charben — Zéro latence entre appareils.
 * Nécessite : Firebase SDK (compat) chargé AVANT ce fichier.
 * Globals : firebase (SDK), firebaseConfig, firebaseCore (config),
 *           authToken, currentUser, SAFE_SAVE (function)
 * ────────────────────────────────────────────────────────────────
 * Remplace le polling (30s) par des listeners push temps réel.
 * Chaque écriture d'un appareil → notification instantanée sur tous les autres.
 */
(function() {
  'use strict';

  var _db = null;
  var _listeners = {};
  var _stateRefs = {};
  var _initialized = false;
  var _callbacks = {};

  /* ── Map collectionKey → { firestore: 'collectionName', local: varName, storage: key } ── */
  var SYNC_MAP = {
    raw:         { firestore: 'rawMaterials',    storage: 'charben_raw',       js: 'rawMaterials' },
    orders:      { firestore: 'orders',           storage: 'charben_orders_v6', js: 'orders' },
    wip:         { firestore: 'wipProducts',      storage: 'charben_wip',       js: 'wipProducts' },
    stock:       { firestore: 'finishedGoods',    storage: 'charben_stock',     js: 'finishedGoods' },
    equip:       { firestore: 'equipment',        storage: 'charben_equip',     js: 'equipment' },
    maint:       { firestore: 'maintenanceLogs',  storage: 'charben_maint',     js: 'maintenanceLogs' },
    shifts:      { firestore: 'shifts',           storage: 'charben_shifts',    js: 'shifts' },
    audit:       { firestore: 'auditLogs',        storage: 'charben_audit',     js: 'auditLogs' },
    qc:          { firestore: 'qualityChecks',    storage: 'charben_qc',        js: 'qualityChecks' },
    planning:    { firestore: 'planningTasks',    storage: 'charben_planning',  js: 'planningTasks' },
    prod:        { firestore: 'productionPlan',   storage: 'charben_prodplan',  js: 'productionPlan' },
    disques:     { firestore: 'sawmillBlades',    storage: 'charben_disques',   js: 'disques' },
    fardeaux:    { firestore: 'fardeaux',          storage: 'charben_fardeaux',  js: 'fardeaux' },
    prodCounters:{ firestore: 'prodCounters',      storage: 'charben_prod_counters', js: 'prodCounters' },
    lineLaunch:  { firestore: 'lineLaunchData',    storage: 'charben_line_launch', js: 'lineLaunch' }
  };

  /**
   * Initialiser Firebase + démarrer les listeners
   */
  function initRealtimeSync(token) {
    if (_initialized) return;
    if (typeof firebase === 'undefined' || !firebase.initializeApp) {
      errLog('realtime', 'init', 'Firebase SDK not loaded', 'warn');
      return;
    }
    try {
      firebase.initializeApp(firebaseConfig);
      /* ── App Check : protection anti-appels hors APK ──
         reCAPTCHA v3 (compatible Capacitor WebView).
         ⚠ La cle DOIT etre une vraie cle reCAPTCHA v3 (Console Firebase
         > App Check > reCAPTCHA). Tant que le placeholder est present,
         l'activation est SKIPPEE : un token invalide ferait echouer
         TOUTES les lectures/ecritures Firestore si App Check est
         enforce dans la Console. */
      var APPCHECK_SITE_KEY = 'RECAPTCHA_V3_SITE_KEY_A_REMPLACER';
      try {
        if (typeof firebase.appCheck === 'undefined') {
          errLog('realtime', 'AppCheck', 'SDK app-check non charge', 'warn');
        } else if (APPCHECK_SITE_KEY.indexOf('A_REMPLACER') !== -1) {
          errLog('realtime', 'AppCheck', 'cle placeholder -> App Check desactive (non bloquant)', 'info');
        } else {
          firebase.appCheck().activate(APPCHECK_SITE_KEY, true);
          errLog('realtime', 'AppCheck', 'reCAPTCHA v3 active', 'info');
        }
      } catch (acErr) {
        errLog('realtime', 'AppCheck', 'indisponible: ' + (acErr.message || acErr), 'warn');
      }
      /* ── Performance Monitoring : métriques réseau + erreurs ── */
      try {
        if (typeof firebase.performance !== 'undefined') {
          var perf = firebase.performance();
          errLog('realtime', 'PerfMon', 'initialisee (network traces actifs)', 'info');
        }
      } catch (perfErr) {
        errLog('realtime', 'PerfMon', 'indisponible: ' + (perfErr.message || perfErr), 'warn');
      }
      _db = firebase.firestore();
      _initialized = true;
      errLog('realtime', 'init', 'Firebase initialized', 'info');
    } catch (e) {
      if (e.code === 'app/duplicate-app') {
        _db = firebase.firestore();
        _initialized = true;
      } else {
        errLog('realtime', 'Init error', e.message, 'error');
        return;
      }
    }
  }

  /**
   * Démarrer un listener temps réel pour une collection
   *
   * F-04 (sharding) : on écoute UNE requête sur les documents `pg_*`
   * (`pg_meta` + `pg_00000..`). Si `pg_meta` existe, la série est reconstruite
   * depuis les pages (triées par id = seq). Sinon — mode legacy — on bascule
   * sur l'ancien document unique `{col}/shared`. Les payloads NON tableaux
   * (prodCounters, lineLaunch) restent sur le chemin legacy inchangé.
   */
  function startListener(key) {
    if (!_db) return;
    var config = SYNC_MAP[key];
    if (!config) return;

    var collectionRef = _db.collection(config.firestore);
    var state = { metaSeq: null, pages: [], pageOrder: {}, legacy: null };

    /* module pagination (chargé avant firebase-core.js) */
    var FSP = (typeof window.__FSPAGES__ !== 'undefined') ? window.__FSPAGES__ : null;

    function pageId(i) {
      return FSP ? FSP.docIdFor(i) : ('pg_' + String(i).padStart(5, '0'));
    }

    function apply(items) {
      var jsArr = window[config.js];
      if (typeof jsArr === 'undefined') return;

      var localStr = JSON.stringify(jsArr);
      var remoteStr = JSON.stringify(items);

      if (localStr !== remoteStr) {
        /* Sauvegarder la position de scroll avant le re-render */
        var scrollY = window.scrollY || document.documentElement.scrollTop;
        var activeEl = document.activeElement;
        var activeId = activeEl ? activeEl.id : null;

        var applied;
        if (Array.isArray(items)) {
          applied = items;
          if (Array.isArray(jsArr)) {
            jsArr.length = 0;
            items.forEach(function(item) { jsArr.push(item); });
            applied = jsArr;
          } else {
            try { window[config.js] = items.slice(); } catch (e) {}
            applied = window[config.js];
          }
        } else if (items && typeof items === 'object') {
          try { window[config.js] = items; } catch (e) {}
          applied = window[config.js];
        } else {
          applied = jsArr;
        }

        try { localStorage.setItem(config.storage, JSON.stringify(applied)); } catch (e) {}

        var renderFn = _callbacks[key];
        if (typeof renderFn === 'function') {
          try { renderFn(); } catch (e) { errLog('realtime', 'Render ' + key, e, 'warn'); }
        }

        window.scrollTo(0, scrollY);
        if (activeId) {
          var el = document.getElementById(activeId);
          if (el) el.focus();
        }

        errLog('realtime', 'sync', 'Synced ' + key + ': ' + (Array.isArray(items) ? items.length : (items ? Object.keys(items).length : 0)) + ' items', 'info');
      }
    }

    /* Dataset courant = pages si la série paginée existe, sinon legacy. */
    function resolveAndApply() {
      if (state.metaSeq !== null && Array.isArray(state.pages)) {
        var pages = state.pages
          .filter(function(p) { return p && p.items && p.seq !== null && p.seq < state.metaSeq; })
          .sort(function(a, b) { return a.seq - b.seq; });
        if (FSP) {
          apply(FSP.joinPages(pages));
        } else if (pages.length > 0) {
          var out = [];
          pages.forEach(function(p) { out = out.concat(p.items); });
          apply(out);
        } else {
          apply([]);
        }
      } else if (state.legacy !== null) {
        apply(state.legacy);
      }
    }

    /* ── Requête principale : tous les documents `pg_*` de la collection ── */
    var rangeQuery = _db.collection(config.firestore)
      .orderBy(firebase.firestore.FieldPath.documentId())
      .startAt('pg_')
      .endAt('pg_\uf8ff');

    try {
      var unsubscribePages = rangeQuery.onSnapshot(function(snapshot) {
        var metaSeq = null;
        var pages = [];
        var order = {};
        snapshot.docs.forEach(function(doc) {
          var id = doc.id;
          var data = doc.data() || {};
          if (id === 'pg_meta') {
            var n = data.seqCount;
            if (typeof n === 'number') metaSeq = n;
          } else if (id.indexOf('pg_') === 0 && typeof data.items !== 'undefined') {
            var seq = parseInt(id.slice(3), 10);
            if (!isNaN(seq)) pages.push({ seq: seq, items: data.items });
          }
        });
        state.metaSeq = metaSeq;
        state.pages = pages;
        resolveAndApply();
      }, function(err) {
        errLog('realtime', 'Pages snapshot ' + key, err, 'warn');
      });
      _listeners[key] = unsubscribePages;

      /* ── Listeners de repli legacy : doc unique `shared` (pré-sharding) ── */
      var legacyRef = collectionRef.doc('shared');
      var unsubscribeLegacy = legacyRef.onSnapshot(function(doc) {
        if (!doc.exists) { state.legacy = null; resolveAndApply(); return; }
        var data = doc.data();
        if (!data || typeof data.items === 'undefined' || data.items === null) { state.legacy = null; resolveAndApply(); return; }
        state.legacy = data.items;
        resolveAndApply();
      }, function(err) {
        errLog('realtime', 'Legacy snapshot ' + key, err, 'warn');
      });
      _stateRefs[key] = { stop: function() { try { unsubscribeLegacy(); } catch (e) {} } };
    } catch (e) {
      errLog('realtime', 'Listener ' + key, e, 'warn');
    }
  }

  /**
   * Arrêter un listener
   */
  function stopListener(key) {
    if (_listeners[key]) {
      _listeners[key]();
      delete _listeners[key];
    }
    if (_stateRefs[key]) {
      try { _stateRefs[key].stop(); } catch (e) {}
      delete _stateRefs[key];
    }
  }

  /**
   * Arrêter tous les listeners
   */
  function stopAll() {
    Object.keys(_listeners).forEach(function(key) {
      try { _listeners[key](); } catch (e) {}
    });
    _listeners = {};
    Object.keys(_stateRefs).forEach(function(key) {
      try { _stateRefs[key].stop(); } catch (e) {}
    });
    _stateRefs = {};
  }

  /**
   * Enregistrer un callback de rendu pour une collection
   */
  function setRenderCallback(key, fn) {
    _callbacks[key] = fn;
  }

  /**
   * Vérifier l'état des listeners
   */
  function status() {
    return {
      initialized: _initialized,
      listeners: Object.keys(_listeners),
      db: !!_db
    };
  }

  /* ── Exports ── */
  window.realtimeSync = {
    init: initRealtimeSync,
    startListener: startListener,
    stopListener: stopListener,
    stopAll: stopAll,
    setRenderCallback: setRenderCallback,
    status: status
  };
})();
