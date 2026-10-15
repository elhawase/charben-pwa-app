/**
 * OFFLINE-QUEUE.JS — File d'attente Firestore (Dexie/IndexedDB)
 * Scierie Charben — Garantie zéro perte de données.
 * Toute écriture fsSave qui échoue (réseau coupé, erreur transitoire)
 * est persistée dans IndexedDB (Dexie) et rejouée au retour en ligne
 * avec fusion par ID (mergeById) pour ne jamais écraser les données
 * des autres appareils.
 * Prérequis : vendor/dexie.min.js chargé avant ce fichier.
 * Globals exportés : window._offlineQueue, window._syncMergeById
 */
(function() {
  'use strict';

  var DB_NAME = 'charben_offline_queue';
  var SQ = null;

  /* Map collectionKey -> clé localStorage (miroir de FS_COLLECTIONS / storage).
     ⚠ Toute divergence avec la carte canonique realtime-sync.js:SYNC_MAP casse la
     file offline : readCurrentArray() retombe alors sur le snapshot périmé et
     flushPendingSync() pousse une version ancienne au lieu de l'array courante —
     exactement la perte de données que ce fichier promet d'empêcher.
     orders = charben_orders_v6 (et NON charben_orders, clé pré-v6 qui n'existe
     plus). Le test rules-unites.test.mjs compare les deux cartes. */
  var STORAGE_MAP = {
    raw: 'charben_raw',
    wip: 'charben_wip',
    stock: 'charben_stock',
    equip: 'charben_equip',
    maint: 'charben_maint',
    shifts: 'charben_shifts',
    audit: 'charben_audit',
    qc: 'charben_qc',
    planning: 'charben_planning',
    prod: 'charben_prodplan',
    disques: 'charben_disques',
    orders: 'charben_orders_v6',
    fardeaux: 'charben_fardeaux'
  };

  var MAX_FLUSH_RECORDS = 500;

  function keyOf(item) {
    if (!item) return null;
    if (item.id != null && item.id !== '') return String(item.id);
    if (item.orderNum != null && item.orderNum !== '') return String(item.orderNum);
    if (item.code != null && item.code !== '') return String(item.code);
    if (item.reference != null && item.reference !== '') return String(item.reference);
    try { return JSON.stringify(item); } catch (e) { return null; }
  }

  /* Fusion par ID : garde les éléments locaux ET ceux des autres
     appareils. En cas d'ID identique, le local (dernier auteur) gagne.
     Collections objet (prodCounters, lineLaunch) : pas de fusion par ID,
     on renvoie le local tel quel — sinon .forEach leve une TypeError. */
  function mergeById(localArr, remoteArr) {
    if (!Array.isArray(localArr) || !Array.isArray(remoteArr)) return localArr;
    var map = {};
    (localArr || []).forEach(function(it) {
      var k = keyOf(it);
      if (k != null) map[k] = it;
    });
    (remoteArr || []).forEach(function(it) {
      var k = keyOf(it);
      if (k != null && !map[k]) map[k] = it;
    });
    return Object.keys(map).map(function(k) { return map[k]; });
  }

  /* `currentUser` est un `let` global (firebase-core.js), donc un binding
     LEXICAL du scope global — ce n'est PAS une propriété de `window`.
     `window.currentUser` vaut donc TOUJOURS undefined, et toutes les gardes
     basées dessus sortaient immédiatement : la file offline n'était jamais
     purgée. `typeof` ne lève pas de ReferenceError même si la déclaration
     n'a pas encore été évaluée, donc cette lecture est sûre quel que soit
     l'ordre de chargement des scripts. */
  function isAuthenticated() {
    try { return typeof currentUser !== 'undefined' && !!currentUser; }
    catch (e) { return false; }
  }

  function openDB() {
    if (SQ) return SQ;
    try {
      if (typeof Dexie === 'undefined') return null;
      SQ = new Dexie(DB_NAME);
      SQ.version(1).stores({ pending: 'collectionKey' });
      return SQ;
    } catch (e) {
        errLog('offline-queue', 'init', e.message, 'warn');
      return null;
    }
  }

  function readCurrentArray(collectionKey, fallback) {
    try {
      var sk = STORAGE_MAP[collectionKey];
      if (sk) {
        var raw = localStorage.getItem(sk);
        if (raw) {
          var arr = JSON.parse(raw);
          if (Array.isArray(arr)) return arr;
        }
      }
    } catch (e) {}
    return fallback;
  }

  function markPendingSync(collectionKey, snapshot) {
    var db = openDB();
    if (!db) return;
    try {
      db.pending.put({
        collectionKey: collectionKey,
        snapshot: snapshot || null,
        stamp: new Date().toISOString(),
        attempts: 0
      });
    } catch (e) {
      errLog('offline-queue', 'markPendingSync', e.message, 'warn');
    }
  }

  function clearPendingSync(collectionKey) {
    var db = openDB();
    if (!db) return;
    try { db.pending.delete(collectionKey); } catch (e) {}
  }

  function countPending() {
    var db = openDB();
    if (!db) return Promise.resolve(0);
    try { return db.pending.count(); } catch (e) { return Promise.resolve(0); }
  }

  var _flushing = false;
  function flushPendingSync() {
    var db = openDB();
    if (!db || _flushing) return Promise.resolve();
    _flushing = true;
    return db.pending.toCollection().limit(MAX_FLUSH_RECORDS).toArray()
      .then(function(records) {
        var chain = Promise.resolve();
        records.forEach(function(rec) {
          chain = chain.then(function() {
            if (!window.fsSave || !isAuthenticated()) return;
            var arr = readCurrentArray(rec.collectionKey, rec.snapshot);
            return window.fsSave(rec.collectionKey, Array.isArray(arr) ? arr : []);
          }).catch(function() {});
        });
        return chain;
      })
      .then(function() { _flushing = false; })
      .catch(function() { _flushing = false; });
  }

  function onOnline() {
    if (typeof showToast === 'function') showToast('Connexion rétablie — synchronisation...', 'success');
    if (!isAuthenticated()) return;
    setTimeout(flushPendingSync, 800);
  }

  function onOffline() {
    if (typeof showToast === 'function') showToast('Mode hors-ligne — les données seront synchronisées à la reconnexion', 'warning');
  }

  function onLoad() {
    if (isAuthenticated()) setTimeout(flushPendingSync, 300);
  }

  /* FLUSH PÉRIODIQUE — Flush incomplet jusqu'ici : il n'était déclenché que par
     l'événement 'online' et au DOMContentLoaded. Or à ce moment currentUser
     n'est pas encore défini (auth asynchrone) et la garde
     `if (!window.currentUser) return;` de chaque enregistrement sortait
     immédiatement. Un enregistrement marqué APRÈS le flush de sync-manager
     restait donc en attente jusqu'au prochain rechargement de l'app — c'est
     pour ça que des records restaient bloqués en base.
     Le timer est RÉARMÉ en fin de tick (pas de setInterval) pour ne jamais
     chevaucher deux flush, et il ne fait rien si la file est vide, si l'app
     est hors-ligne ou si l'utilisateur n'est pas connecté. */
  var FLUSH_INTERVAL_MS = 30000;
  var _flushTimer = null;

  function scheduleFlush() {
    if (_flushTimer) return;
    _flushTimer = setTimeout(function() {
      _flushTimer = null;
      var offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
      if (offline || !isAuthenticated()) { scheduleFlush(); return; }
      countPending().then(function(n) {
        if (n > 0) flushPendingSync();
        scheduleFlush();
      }, function () { scheduleFlush(); });
    }, FLUSH_INTERVAL_MS);
  }

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onLoad);
  } else {
    setTimeout(onLoad, 0);
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  }

  /* Capacitor : reflush à la reprise de l'app (flux #1060/#8068) */
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    try {
      window.Capacitor.Plugins.App.addListener('appStateChange', function(state) {
        if (state && state.isActive) onOnline();
      });
    } catch (e) {}
  }

  /* Démarre la boucle de secours (une seule instance par session). */
  scheduleFlush();

  window._syncMergeById = mergeById;
  window._offlineQueue = {
    markPendingSync: markPendingSync,
    clearPendingSync: clearPendingSync,
    flushPendingSync: flushPendingSync,
    countPending: countPending,
    scheduleFlush: scheduleFlush
  };
})();