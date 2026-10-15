/**
 * ESSENCE-API.JS — Référentiel essences Charben (LOCAL)
 * Couche P3 : alimente le retrait de séchage (essence.retrait_sechage)
 * depuis un référentiel local, avec repli sur la carte dryingShrinkByEssence.
 * Plus aucun appel réseau (ancien GET /essences de l'API 3002 retiré).
 * Exposé en globalThis.EssenceAPI.
 */
(function () {
  'use strict';
  var g = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : {});
  if (typeof window === 'undefined' && typeof g.window === 'undefined') g.window = g;

  var CACHE_KEY = 'charben_essences_cache_v1';
  var STALE_MS = 0;

  var memCache = {};
  var store = { rows: [], meta: {} };

  /* Référentiel local des essences (retrait de séchage par défaut).
     Le détail par essence peut être surchargé par dryingShrinkByEssence (data.js). */
  var REFERENTIEL = [
    { code: 'PIN', nom: 'Pin', retrait_sechage: 0.06 },
    { code: 'EPICEA', nom: 'Épicéa', retrait_sechage: 0.05 },
    { code: 'CHENE', nom: 'Chêne', retrait_sechage: 0.06 }
  ];

  function cacheBackend() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (e) {}
    return {
      getItem: function (k) { return (k in memCache) ? memCache[k] : null; },
      setItem: function (k, v) { memCache[k] = String(v); }
    };
  }

  function readCache() {
    try { return JSON.parse(cacheBackend().getItem(CACHE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }

  function writeCache(list) {
    try {
      var c = readCache();
      c.rows = list; c.at = Date.now();
      cacheBackend().setItem(CACHE_KEY, JSON.stringify(c));
    } catch (e) {}
  }

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function retrait(v) { return Math.round(num(v) * 1000) / 1000; }

  function normEssence(x) {
    x = x || {};
    return {
      essence_id: x.essence_id, code: String(x.code || '').toUpperCase(),
      nom: x.nom || x.code || '—',
      retrait_sechage: retrait(x.retrait_sechage),
      rang: num(x.rang), actif: x.actif === true || x.actif === 1
    };
  }

  /* Normalisation clé sans accents + minuscules — même vocabulaire que wip-manager. */
  function normKey(s) {
    var k = String(s == null ? '' : s).toLowerCase().trim();
    if (typeof k.normalize === 'function') k = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return k;
  }

  /* Alias vers le code référentiel (ascii_bin : PIN / EPICEA / CHENE).
     Toute clé métier app → code base. Pas de ligne fourre-tout : inconnu → null. */
  var ALIASES = {
    pine: 'PIN', pin: 'PIN', 'pin (pin maritime)': 'PIN',
    spruce: 'EPICEA', sapin: 'EPICEA', 'epicea': 'EPICEA', 'epicea (sapin de norway)': 'EPICEA',
    oak: 'CHENE', chene: 'CHENE'
  };

  function resolve(raw) {
    var k = normKey(raw);
    if (!k) return null;
    if (ALIASES[k]) return ALIASES[k];
    var exact = store.rows.find(function (e) { return normKey(e.code) === k; });
    if (exact) return exact.code;
    var prefix = store.rows.find(function (e) { return k.indexOf(normKey(e.code)) === 0; });
    return prefix ? prefix.code : null;
  }

  /* Carte locale (data.js) — repli strictement offline/essence absente de la base. */
  function localMap() {
    return (typeof dryingShrinkByEssence !== 'undefined') ? dryingShrinkByEssence : null;
  }

  /* Taux de retrait pour une essence. Priorité : base → carte locale → null. */
  function retraitSechage(raw) {
    var code = resolve(raw);
    if (code) {
      var row = store.rows.find(function (e) { return e.code === code; });
      if (row) return row.retrait_sechage;
    }
    var map = localMap();
    if (map) {
      var k = normKey(raw);
      var v = parseFloat(map[k]);
      if (!(v >= 0)) v = parseFloat(map.other);
      if (v >= 0) return retrait(v);
    }
    return null;
  }

  function setMeta(source, error) {
    store.meta = { source: source, at: Date.now(), error: error || null, count: store.rows.length };
  }

  /* Référentiel local — remplace l'ancien GET /essences (API 3002). */
  function localEssences() {
    var map = localMap();
    return REFERENTIEL.map(function (e) {
      var r = e.retrait_sechage;
      if (map) {
        var v = parseFloat(map[normKey(e.code)]);
        if (v >= 0) r = v;
      }
      return { essence_id: e.code, code: e.code, nom: e.nom, retrait_sechage: r, rang: 0, actif: true };
    });
  }

  function load(force) {
    var fresh = store.meta.source === 'local' && (Date.now() - store.meta.at) < STALE_MS;
    if (!force && store.rows.length && fresh) return Promise.resolve({ ok: true, source: 'local', count: store.rows.length });
    return Promise.resolve().then(function () {
      var out = [];
      var items = localEssences();
      for (var i = 0; i < items.length; i++) out.push(normEssence(items[i]));
      store.rows = out;
      setMeta('local', null);
      writeCache(out);
      return { ok: true, source: 'local', count: out.length };
    }).catch(function (err) {
      var c = readCache();
      var msg = String((err && err.message) || err);
      if (c.rows && c.rows.length) {
        store.rows = c.rows.map(normEssence);
        setMeta('offline', msg);
        return { ok: false, source: 'offline', count: store.rows.length, error: msg };
      }
      store.rows = store.rows || [];
      setMeta('offline', msg);
      return { ok: false, source: 'offline', count: store.rows.length, error: msg };
    });
  }

  function ensure() { return load(false); }
  function get(raw) {
    var code = resolve(raw);
    if (!code) return null;
    return store.rows.find(function (e) { return e.code === code; }) || null;
  }
  function all() { return store.rows.slice(); }

  var api = {
    load: load, ensure: ensure, retraitSechage: retraitSechage,
    get: get, all: all, rows: all, status: function () { return store.meta; },
    CACHE_KEY: CACHE_KEY
  };

  g.EssenceAPI = api;
  if (typeof window !== 'undefined') window.EssenceAPI = api;
})();