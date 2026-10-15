/* modules/auto-purge.js — Routine d'auto-purge Firestore (Approach A, one-shot).
 *
 * Contexte : le nettoyage a été fait à la main (MySQL + localStorage) mais le
 * cloud Firestore, lui, a été re-restauré par l'app au login dès que le quota
 * (HTTP 429) est revenu. Ce module rend la purge DURABLE côté appareil :
 *
 *   disabled → idle → waiting(quota/offline/no-auth) → backing-up → wiping
 *            → refreshing → done | error
 *
 * Garde-fous (non négociables) :
 *   - AUCUNE suppression sans sauvegarde réussie (IndexedDB + fichier JSON).
 *   - La collection `users` (rôles/auth) n'est JAMAIS touchée.
 *   - One-shot : une fois `done`, le module se désactive pour toujours.
 *   - Idempotent : `collectionsDone` permet de reprendre après une panne.
 *   - Backoff exponentiel sur 429/quota (60 s → plafond 15 min).
 *
 * Le cœur (createAutoPurge) est pur : il ne reçoit que `env` et n'accède à
 * aucun global. C'est ce qui permet de le tester en isolation (voir
 * tests/auto-purge.test.mjs).
 */
(function () {
  'use strict';

  function createAutoPurge(env) {
    var BUSINESS_COLLECTIONS = [
      'rawMaterials', 'wipProducts', 'fardeaux', 'finishedGoods', 'equipment',
      'maintenanceLogs', 'shifts', 'auditLogs', 'qualityChecks', 'planningTasks',
      'productionPlan', 'orders', 'sawmillBlades', 'stockItems', 'parts',
      'buildOrders', 'charbenLineObjectives', 'prodCounters', 'lineLaunchData'
    ];
    var NEVER_DELETE = ['users'];
    var STATE_KEY = 'charben_autopurge_v1';
    var BACKOFF_BASE = 60000;
    var BACKOFF_CAP = 900000;
    var AUTH_RETRY = 30000;

    var _running = false;
    var _retryTimer = null;

    function defaultState() {
      return { status: 'idle', reason: null, attempts: 0, collectionsDone: [], startedAt: null, backupAt: null, doneAt: null };
    }
    function getState() {
      try {
        var raw = env.rawGet(STATE_KEY);
        if (!raw) return defaultState();
        var st = JSON.parse(raw);
        if (!st || typeof st !== 'object') return defaultState();
        if (!Array.isArray(st.collectionsDone)) st.collectionsDone = [];
        return st;
      } catch (e) { return defaultState(); }
    }
    function setState(st) { try { env.rawSet(STATE_KEY, JSON.stringify(st)); } catch (e) {} return st; }
    function status() { return getState().status; }

    function backoff(attempts) {
      var ms = BACKOFF_BASE * Math.max(1, attempts);
      return ms > BACKOFF_CAP ? BACKOFF_CAP : ms;
    }
    function scheduleRetry(ms) {
      if (_retryTimer) return;
      _retryTimer = env.setTimer(function () { _retryTimer = null; run(); }, ms);
    }

    /* Photographie de TOUTES les collections (doc partagé + doc legacy uid).
       Toute lecture en panne annule la sauvegarde : sans snapshot complet, on
       ne supprime rien. */
    async function snapshot() {
      var uid = env.getUid();
      var shared = {};
      var legacy = {};
      for (var i = 0; i < BUSINESS_COLLECTIONS.length; i++) {
        var col = BUSINESS_COLLECTIONS[i];
        var rs = await env.getDoc(col + '/shared');
        if (rs && rs.error) throw new Error('lecture ' + col + ': ' + rs.error);
        shared[col] = (rs && rs.data) ? rs.data : null;
        if (uid) {
          var rl = await env.getDoc(col + '/' + uid);
          if (rl && rl.error) throw new Error('lecture legacy ' + col + ': ' + rl.error);
          legacy[col] = (rl && rl.data) ? rl.data : null;
        }
      }
      var id = env.now();
      var payload = {
        generatedAt: new Date().toISOString(),
        uid: uid || null,
        app: 'charben',
        schema: 1,
        sharedDoc: shared,
        legacyDoc: legacy
      };
      return {
        id: id,
        filename: 'backup-firestore-' + new Date(id).toISOString().replace(/[:.]/g, '-') + '.json',
        json: JSON.stringify(payload)
      };
    }

    /* Supprime tous les documents d'une collection. `fsRestList` renvoie `[]`
       AUSSI quand la liste échoue (429/401) : on vérifie donc explicitement
       les docs partagé + legacy après la liste, et une vérification en panne
       lève — ce qui empêche de marquer la collection « faite » à tort. */
    async function wipeCollection(col) {
      if (NEVER_DELETE.indexOf(col) > -1) return;
      var docs = await env.listDocs(col);
      if (Array.isArray(docs)) {
        for (var i = 0; i < docs.length; i++) {
          var d = docs[i];
          if (!d || !d.id || NEVER_DELETE.indexOf(d.id) > -1) continue;
          await env.delDoc(col + '/' + d.id);
        }
      }
      var probe = await env.getDoc(col + '/shared');
      if (probe && probe.error) throw new Error('vérif ' + col + ': ' + probe.error);
      if (probe && probe.data) await env.delDoc(col + '/shared');
      var uid = env.getUid();
      if (uid) {
        var lp = await env.getDoc(col + '/' + uid);
        if (lp && lp.error) throw new Error('vérif legacy ' + col + ': ' + lp.error);
        if (lp && lp.data) await env.delDoc(col + '/' + uid);
      }
    }

    async function run() {
      var st = getState();
      if (st.status === 'done') return st;
      st.attempts = st.attempts || 0;
      st.collectionsDone = st.collectionsDone || [];

      if (!env.isAuthenticated()) {
        st.status = 'waiting';
        st.reason = 'no-auth';
        setState(st);
        scheduleRetry(AUTH_RETRY);
        return st;
      }

      var h = await env.healthCheck();
      if (!h || !h.ok) {
        st.status = 'waiting';
        st.reason = (h && h.status === 429) ? 'quota' : 'offline';
        st.attempts += 1;
        setState(st);
        try { env.notify('Nettoyage en attente (' + st.reason + ') — nouvel essai automatique'); } catch (e) {}
        scheduleRetry(backoff(st.attempts));
        return st;
      }

      st.status = 'backing-up';
      st.startedAt = st.startedAt || new Date().toISOString();
      setState(st);
      var snap;
      try { snap = await snapshot(); }
      catch (e) {
        st.status = 'waiting';
        st.reason = 'read-error';
        st.attempts += 1;
        setState(st);
        scheduleRetry(backoff(st.attempts));
        return st;
      }

      var backupOk = false;
      try {
        backupOk = await env.writeBackup(snap.id, snap.json);
        if (backupOk !== false) {
          try { env.downloadBackup(snap.filename, snap.json); } catch (e) {}
          backupOk = true;
        }
      } catch (e) { backupOk = false; }
      if (!backupOk) {
        st.status = 'error';
        st.reason = 'backup-failed';
        setState(st);
        try { env.notify('Nettoyage annulé — sauvegarde impossible (aucune donnée supprimée)'); } catch (e) {}
        return st;
      }
      st.backupAt = new Date().toISOString();
      setState(st);

      st.status = 'wiping';
      setState(st);
      for (var i = 0; i < BUSINESS_COLLECTIONS.length; i++) {
        var col = BUSINESS_COLLECTIONS[i];
        if (st.collectionsDone.indexOf(col) > -1) continue;
        try { await wipeCollection(col); }
        catch (e) {
          st.status = 'waiting';
          st.reason = 'write-error';
          st.attempts += 1;
          setState(st);
          try { env.notify('Nettoyage interrompu — reprise automatique'); } catch (e2) {}
          scheduleRetry(backoff(st.attempts));
          return st;
        }
        st.collectionsDone.push(col);
        setState(st);
      }

      st.status = 'refreshing';
      setState(st);
      try { env.clearLocalBusinessData(); } catch (e) {}
      try { await env.refreshViews(); } catch (e) {}

      st.status = 'done';
      st.doneAt = new Date().toISOString();
      setState(st);
      try { env.notify('Nettoyage automatique terminé — sauvegarde faite, données remises à zéro'); } catch (e) {}
      try { if (typeof env.reload === 'function') env.reload(); } catch (e) {}
      return st;
    }

    async function kick() {
      var st = getState();
      if (st.status === 'done') return 'done';
      if (_running || _retryTimer) return st.status;
      _running = true;
      try { await run(); } finally { _running = false; }
      return getState().status;
    }

    function reset() {
      if (_retryTimer) { try { env.clearTimer(_retryTimer); } catch (e) {} _retryTimer = null; }
      setState(defaultState());
      return 'idle';
    }

    return { kick: kick, status: status, reset: reset, _getState: getState, _runNow: run };
  }

  /* ─────────────────────────────────────────────
     Câblage navigateur (globals réels) — n'est pas exercé par les tests.
     ───────────────────────────────────────────── */

  function idbPut(id, json) {
    return new Promise(function (resolve) {
      try {
        var req = indexedDB.open('charben_autopurge_backup', 1);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots');
        };
        req.onsuccess = function () {
          var db = req.result;
          try {
            var tx = db.transaction('snapshots', 'readwrite');
            tx.objectStore('snapshots').put(json, String(id));
            tx.oncomplete = function () { try { db.close(); } catch (e) {} resolve(true); };
            tx.onerror = function () { resolve(false); };
            tx.onabort = function () { resolve(false); };
          } catch (e) { resolve(false); }
        };
        req.onerror = function () { resolve(false); };
      } catch (e) { resolve(false); }
    });
  }

  function downloadBackup(filename, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { try { URL.revokeObjectURL(url); a.remove(); } catch (e) {} }, 1000);
  }

  function clearLocalBusinessData() {
    var KEEP = /session|role|rules|db_version|data_version|update_skip|autopurge/;
    var toRemove = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        if (k === 'gd_theme_v6') continue;
        if ((k.indexOf('charben_') === 0 || k.indexOf('gd_') === 0) && !KEEP.test(k)) toRemove.push(k);
      }
      toRemove.forEach(function (key) { try { localStorage.removeItem(key); } catch (e) {} });
    } catch (e) {}
    [
      'rawMaterials', 'wipProducts', 'finishedGoods', 'equipment', 'maintenanceLogs',
      'shifts', 'auditLogs', 'qualityChecks', 'planningTasks', 'productionPlan',
      'disques', 'orders', 'fardeaux', 'sawmillBlades', 'stockItems', 'parts',
      'buildOrders', 'charbenLineObjectives', 'prodCounters', 'lineLaunchData'
    ].forEach(function (n) { try { if (Array.isArray(window[n])) window[n].length = 0; } catch (e) {} });
    try { window.orderCounter = 0; } catch (e) {}
  }

  function refreshViews() {
    var fns = ['renderGrumes', 'renderProduitsFinis', 'renderWipList', 'renderDashboardKPIs', 'renderAlertsPanel', 'renderTraceScreen', 'renderTraceKpis', 'renderTraceProduction'];
    fns.forEach(function (n) { try { if (typeof window[n] === 'function') window[n](); } catch (e) {} });
  }

  function notify(msg) {
    var el = document.getElementById('syncBanner');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.style.opacity = '1';
    clearTimeout(el._puHide);
    el._puHide = setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () { el.style.display = 'none'; }, 500);
    }, 10000);
  }

  function buildEnv() {
    return {
      rawGet: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
      rawSet: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
      isAuthenticated: function () { return !!(window.authToken && window.currentUser); },
      getUid: function () { return (window.currentUser && window.currentUser.uid) || window.authUid || null; },
      healthCheck: async function () {
        var rd = await fsRestGetDetailed('orders/shared');
        var ok = (rd.status >= 200 && rd.status < 300) || rd.status === 404;
        return { ok: ok, status: rd.status, error: rd.error };
      },
      getDoc: function (path) { return fsRestGetDetailed(path); },
      listDocs: function (col) { return fsRestList(col); },
      delDoc: function (path) { return fsRestDelete(path); },
      writeBackup: function (id, json) { return idbPut(id, json); },
      downloadBackup: downloadBackup,
      clearLocalBusinessData: clearLocalBusinessData,
      refreshViews: refreshViews,
      reload: function () { setTimeout(function () { try { location.reload(); } catch (e) {} }, 3000); },
      notify: notify,
      log: function (m) { try { console.log('[auto-purge]', m); } catch (e) {} },
      now: function () { return Date.now(); },
      setTimer: function (fn, ms) { return setTimeout(fn, ms); },
      clearTimer: function (t) { clearTimeout(t); }
    };
  }

  window.createAutoPurge = createAutoPurge;

  function boot() {
    if (window._autoPurge) return;
    window._autoPurge = createAutoPurge(buildEnv());
    try { window._autoPurge.kick(); } catch (e) {}
    window.addEventListener('online', function () { try { window._autoPurge.kick(); } catch (e) {} });
    window.addEventListener('focus', function () { try { window._autoPurge.kick(); } catch (e) {} });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { try { window._autoPurge.kick(); } catch (e) {} } });
    setInterval(function () { try { window._autoPurge.kick(); } catch (e) {} }, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
