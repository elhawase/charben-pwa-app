/* ─── STORAGE HELPERS (definis ici, chargés avant app.js) ─── */
function safeSave(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Save error:', e.message);
    return false;
  }
}

function loadFromStorage(key, defaultValue) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Erreur sauvegarde localStorage:', key, e);
  }
}

/* ─── NETWORK LAYER — 3 fallbacks: CapacitorHttp → fetch → XHR ─── */
function hasCapacitorHttp() {
  try { return !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp); } catch(e) { return false; }
}

/* Budget 5 req/s par origine. AVANT : rejet dur au 6e appel dans la seconde,
   ce qui faisait echouer les ~14 fsSave simultanes du login (tous enregistres
   en file offline, jamais rejoues car flushPendingSync ne se declenche qu'au
   'online' ou au prochain chargement). MAINTENANT : file d'attente par origine
   — la requete attend son tour au lieu d'echouer. */
var _reqTimestamps = {};
var _originChains = {};
var MAX_REQ_PER_SEC = 5;

/* Delai (ms) avant la prochaine requete pour rester sous MAX_REQ_PER_SEC. */
function _waitForSlot(origin) {
  if (!origin) return 0;
  var now = Date.now();
  var log = _reqTimestamps[origin] || [];
  log = log.filter(function(t) { return now - t < 1000; });
  _reqTimestamps[origin] = log;
  if (log.length < MAX_REQ_PER_SEC) return 0;
  return Math.max(0, 1000 - (now - log[0])) + 5;
}

function _netRequestNow(method, url, headers, body) {
  return new Promise(function(resolve, reject) {
    var timeout = setTimeout(function() { reject(new Error('Timeout 15s')); }, 15000);

    /* App Check : attacher le jeton natif aux origines Google (Firestore REST,
       refresh token securisé). Jamais journalisé (confinement CEO 09/10/2026). */
    if (_appCheckToken &&
        (url.indexOf('firestore.googleapis.com') !== -1 ||
         url.indexOf('securetoken.googleapis.com') !== -1 ||
         url.indexOf('identitytoolkit.googleapis.com') !== -1)) {
      headers = headers || {};
      if (!headers['X-Firebase-AppCheck']) headers['X-Firebase-AppCheck'] = _appCheckToken;
    }

    if (hasCapacitorHttp()) {
      var opts = { url: url, method: method, headers: headers || {} };
      if (body) opts.data = body;
      /* Garde-fou : si le plugin CapacitorHttp reste suspendu (certains ROM
         Android), son callback n'arrive jamais et la promesse de netRequest
         rejette au bout de 15 s SANS basculer sur fetch/XHR → les lectures
         Firestore (users/{uid} → rôle) échouent en silence sur l'appareil.
         Ce watchdog force la cascade netRequestFallback après 8 s. Un
         callback tardif du plugin est alors ignoré (st.done). */
      var acSt = { done: false };
      var acWatchdog = setTimeout(function() {
        if (acSt.done) return;
        acSt.done = true;
        netRequestFallback(method, url, headers, body, resolve, reject, timeout);
      }, 8000);
      window.Capacitor.Plugins.CapacitorHttp.request(opts).then(function(res) {
        if (acSt.done) return;
        acSt.done = true;
        clearTimeout(acWatchdog);
        clearTimeout(timeout);
        resolve({ status: res.status, data: typeof res.data === 'string' ? JSON.parse(res.data) : res.data, ok: res.status >= 200 && res.status < 300, raw: res });
      }).catch(function(e) {
        if (acSt.done) return;
        acSt.done = true;
        clearTimeout(acWatchdog);
        clearTimeout(timeout);
        netRequestFallback(method, url, headers, body, resolve, reject, timeout);
      });
    } else {
      netRequestFallback(method, url, headers, body, resolve, reject, timeout);
    }
  });
}

/* File d'attente par origine : chaque requete attend que la precedente se
   termine ET qu'un creneau soit libre (< MAX_REQ_PER_SEC sur la fenetre glissante).
   La chaine est volontairement "avalee" (_originChains) pour qu'un echec ne
   bloque pas les requetes suivantes ; l'erreur est nee propagatee au caller. */
function netRequest(method, url, headers, body) {
  var origin = url.replace(/^(https?:\/\/[^\/]+).*/, '$1'); // eslint-disable-line no-useless-escape -- le \/ est necessaire dans un regex literal
  var prev = _originChains[origin] || Promise.resolve();
  var run = prev.then(function() {
    var wait = _waitForSlot(origin);
    return new Promise(function(r) { setTimeout(r, wait); });
  }).then(function() {
    if (origin) {
      if (!_reqTimestamps[origin]) _reqTimestamps[origin] = [];
      _reqTimestamps[origin].push(Date.now());
    }
    return _netRequestNow(method, url, headers, body);
  });
  _originChains[origin] = run.then(function() {}, function() {});
  return run;
}

function netRequestFallback(method, url, headers, body, resolve, reject, timeout) {
  clearTimeout(timeout);
  timeout = setTimeout(function() { reject(new Error('Timeout 15s fallback')); }, 15000);

  try {
    var opts = { method: method, headers: headers || {}, mode: 'cors', cache: 'no-store' };
    if (body) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    fetch(url, opts).then(function(res) {
      clearTimeout(timeout);
      res.json().then(function(data) {
        resolve({ status: res.status, data: data, ok: res.ok });
      }).catch(function() {
        resolve({ status: res.status, data: null, ok: res.ok });
      });
    }).catch(function() {
      clearTimeout(timeout);
      netRequestXHR(method, url, headers, body, resolve, reject);
    });
  } catch(e) {
    clearTimeout(timeout);
    netRequestXHR(method, url, headers, body, resolve, reject);
  }
}

function netRequestXHR(method, url, headers, body, resolve, reject) {
  var xhr = new XMLHttpRequest();
  xhr.timeout = 15000;
  xhr.open(method, url, true);
  if (headers) { for (var k in headers) { if (Object.prototype.hasOwnProperty.call(headers, k)) xhr.setRequestHeader(k, headers[k]); } }
  xhr.onload = function() {
    try { var d = JSON.parse(xhr.responseText); resolve({ status: xhr.status, data: d, ok: xhr.status >= 200 && xhr.status < 300 }); }
    catch(e) { resolve({ status: xhr.status, data: null, ok: xhr.status >= 200 && xhr.status < 300 }); }
  };
  xhr.onerror = function() { reject(new Error('XHR network error')); };
  xhr.ontimeout = function() { reject(new Error('XHR timeout')); };
  xhr.send(body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null);
}

var netDebug = [];

/* ─── APP CHECK — attestation native (Play Integrity / Debug) ───
   L'app parle à Firestore par 2 chemins : REST (fsRest*) et SDK compat
   (firebase-app-check-compat chargé par index.html). Le jeton natif du
   plugin @capacitor-firebase/app-check est attaché aux deux :
     - REST : en-tête `X-Firebase-AppCheck` injecté par netRequest()
     - SDK  : custom provider sur firebase.appCheck().activate()
   Hors Capacitor (boucle dev Chrome) : rien à attester, l'app reste
   fonctionnelle — aucune règle bloquante tant que l'enforcement console
   n'est pas activé, et le jeton n'est JAMAIS journalisé.
   Rédaction en cloud : exception CEO explicitée le 09/10/2026
   (pipeline local qwen7b/qwen3b non fonctionnel pour l'exécution). */
var _appCheckToken = null;
var _appCheckExpiry = 0;
var _appCheckTimer = null;
var APP_CHECK_PLUGIN = 'FirebaseAppCheck';
/* Décision CEO 09/10/2026 — distribution interne sideload (hors Play Store) :
   Play Integrity risquerait d'attester "unverified" les tablettes non installées
   via Play. Le jeton natif passe donc par le provider DEBUG (jeton par tablette,
   enregistré une fois en console, 100% stable — jamais bloquant) ; l'enforcement
   console est en mode AUDIT (et non Enforce) tant que le terrain n'est pas validé.
   Passer APP_CHECK_DEBUG=false le jour où l'app passe par Play Store. */
var APP_CHECK_DEBUG = true;

function _capAppCheckPlugin() {
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform &&
        window.Capacitor.isNativePlatform() &&
        window.Capacitor.Plugins && window.Capacitor.Plugins[APP_CHECK_PLUGIN]) {
      return window.Capacitor.Plugins[APP_CHECK_PLUGIN];
    }
  } catch (e) {}
  return null;
}

function _scheduleAppCheckRefresh() {
  if (_appCheckTimer) { clearTimeout(_appCheckTimer); _appCheckTimer = null; }
  var delay = _appCheckExpiry
    ? Math.max(60000, _appCheckExpiry - Date.now() - 60000)
    : (30 * 60 * 1000);
  _appCheckTimer = setTimeout(function() { _refreshAppCheckToken(false); }, delay);
}

async function _refreshAppCheckToken(force) {
  var p = _capAppCheckPlugin();
  if (!p) return null;
  try {
    var r = await p.getToken({ forceRefresh: !!force });
    if (!r || !r.token) return null;
    _appCheckToken = r.token;
    _appCheckExpiry = (r.expireTimeMillis && r.expireTimeMillis > 0) ? r.expireTimeMillis : 0;
    _scheduleAppCheckRefresh();
    return _appCheckToken;
  } catch (e) {
    /* Attestation indisponible (google-services.json absent, attestation
       refusée, émulateur) : dégradation transparente, sync offline. */
    return null;
  }
}

/* Activer le jeton natif sur les deux chemins Firestore. Non bloquant. */
async function initAppCheck() {
  var p = _capAppCheckPlugin();
  if (!p) return;
  try {
    await p.initialize({ isTokenAutoRefreshEnabled: true, debug: !!APP_CHECK_DEBUG });
    var tok = await _refreshAppCheckToken(true);
    if (!tok) return;
    var ac = null;
    try { ac = window.firebase && window.firebase.appCheck && window.firebase.appCheck(); } catch (e2) {}
    if (ac && typeof ac.activate === 'function') {
      try {
        ac.activate({
          getToken: function() {
            return p.getToken({ forceRefresh: false }).then(function(r) {
              if (!r || !r.token) throw new Error('jeton App Check indisponible');
              return { token: r.token, expireTimeMillis: r.expireTimeMillis || 0 };
            });
          }
        }, true);
      } catch (e3) {}
    }
  } catch (e) {}
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { initAppCheck(); });
} else {
  initAppCheck();
}

/* ─── REST API LAYER ─── */
let authToken = null;
let authRefreshToken = null;
let authUid = null;
const FS_REST = 'https://firestore.googleapis.com/v1/projects/charben-apk/databases/(default)/documents';

function valToFS(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valToFS) } };
  if (typeof v === 'object') return { mapValue: { fields: objToFS(v) } };
  return { stringValue: String(v) };
}
function objToFS(obj) { var f = {}; for (var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) f[k] = valToFS(obj[k]); } return f; }
function fsToVal(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(fsToVal);
  if (v.mapValue) return fsToObj(v.mapValue.fields || {});
  return null;
}
function fsToObj(fields) { var o = {}; for (var k in fields) { if (Object.prototype.hasOwnProperty.call(fields, k)) o[k] = fsToVal(fields[k]); } return o; }

async function refreshAuthToken() {
  if (!authRefreshToken) return false;
  try {
    var res = await netRequest('POST', 'https://securetoken.googleapis.com/v1/token?key=' + firebaseConfig.apiKey, { 'Content-Type': 'application/json' }, { grant_type: 'refresh_token', refresh_token: authRefreshToken });
    var data = res.data;
    if (data && data.id_token) { authToken = data.id_token; authRefreshToken = data.refresh_token; return true; }
    return false;
  } catch (e) { return false; }
}

async function fsRestGet(path, retry) {
  if (!authToken) return null;
  if (retry === undefined) retry = true;
  try {
    var res = await netRequest('GET', FS_REST + '/' + path, { 'Authorization': 'Bearer ' + authToken });
    if (res.status === 401 && retry) { if (await refreshAuthToken()) return fsRestGet(path, false); return null; }
    if (res.status === 404) return null;
    if (!res.ok) { console.warn('Firestore GET ' + path + ' failed: ' + res.status); return null; }
    return res.data && res.data.fields ? fsToObj(res.data.fields) : null;
  } catch (e) { console.warn('Firestore GET error:', e.message); return null; }
}

/* ─────────────────────────────────────────────
   fsRestGetDetailed — distingue le 404 (document absent) d'une PANNE.

   fsRestGet renvoie `null` dans les deux cas, et cette confusion est
   destructrice : un `null` lu comme « cloud vide » fait sauter la fusion
   par ID, et le fsRestSet qui suit RÉÉCRIT le document entier. Un simple
   coupure réseau ou un token expiré suffit alors à effacer ce que les
   autres appareils ont écrit.

   Contrats :
     status 404, error null  → le document n'existe pas (création sûre)
     error non vide         → état INCONNU : ne jamais écraser
     error null             → lecture réussie, `data` est l'objet
   ───────────────────────────────────────────── */
async function fsRestGetDetailed(path, retry) {
  if (!authToken) return { status: 0, data: null, error: 'token absent' };
  if (retry === undefined) retry = true;
  try {
    var res = await netRequest('GET', FS_REST + '/' + path, { 'Authorization': 'Bearer ' + authToken });
    if (res.status === 401) {
      if (retry && await refreshAuthToken()) return fsRestGetDetailed(path, false);
      return { status: 401, data: null, error: '401 non rafraîchi' };
    }
    if (res.status === 404) return { status: 404, data: null, error: null };
    if (!res.ok) return { status: res.status, data: null, error: 'HTTP ' + res.status };
    return { status: res.status, data: (res.data && res.data.fields) ? fsToObj(res.data.fields) : null, error: null };
  } catch (e) {
    return { status: 0, data: null, error: String((e && e.message) || e) };
  }
}

async function fsRestSet(path, data) {
  if (!authToken) throw new Error('Not authenticated');
  var fields = objToFS(data);
  /* PATCH sans updateMask = create-or-replace : fonctionne sur documents
     existants ET nouveaux. Avec updateMask, Firestore échoue silencieusement
     sur les docs inexistants (collections créées à la volée). PUT n'est pas
     supporté par l'API REST Firestore (404). */
  var url = FS_REST + '/' + path;
  var res = await netRequest('PATCH', url, { 'Authorization': 'Bearer ' + authToken, 'Content-Type': 'application/json' }, { fields: fields });
  if (res.status === 401) { if (await refreshAuthToken()) { await fsRestSet(path, data); return; } throw new Error('Auth expired'); }
  if (!res.ok) throw new Error('Firestore SET failed: ' + res.status);
}

async function fsRestDelete(path) {
  if (!authToken) throw new Error('Not authenticated');
  var res = await netRequest('DELETE', FS_REST + '/' + path, { 'Authorization': 'Bearer ' + authToken });
  if (!res.ok && res.status !== 404) throw new Error('Firestore DELETE failed: ' + res.status);
}

async function fsRestList(collection) {
  if (!authToken) return [];
  try {
    var res = await netRequest('GET', FS_REST + '/' + collection, { 'Authorization': 'Bearer ' + authToken });
    if (res.status === 401) { if (await refreshAuthToken()) return fsRestList(collection); return []; }
    if (!res.ok) return [];
    var data = res.data;
    if (!data || !data.documents) return [];
    return data.documents.map(function(doc) {
      var id = doc.name.split('/').pop();
      return { id: id, data: doc.fields ? fsToObj(doc.fields) : {} };
    });
  } catch (e) { console.warn('Firestore list error:', e.message); return []; }
}

async function fsRestAdd(collection, data) {
  if (!authToken) throw new Error('Not authenticated');
  var fields = objToFS(data);
  var res = await netRequest('POST', FS_REST + '/' + collection, { 'Authorization': 'Bearer ' + authToken, 'Content-Type': 'application/json' }, { fields: fields });
  if (!res.ok) throw new Error('Firestore ADD failed: ' + res.status);
  var doc = res.data;
  return doc && doc.name ? doc.name.split('/').pop() : null;
}

function saveSession() {
  try {
    if (authRefreshToken && authUid) {
      localStorage.setItem('charben_session', JSON.stringify({ refreshToken: authRefreshToken, uid: authUid }));
    }
  } catch (e) {}
}
function clearSession() {
  try { localStorage.removeItem('charben_session'); } catch (e) {}
}

const DISK_THICKNESS = 4;
const ARBORS_PER_SAW = 2;
const MAX_LOG_WIDTH = 560;
const MAX_BLADES = 7;
const PATTERNS = {
  P340: { center: 63, side: 34 },
  P400: { center: 90, side: 45 }
};
const STOCK_DEFAULT = { 90: 4, 63: 8, 45: 4, 34: 6, 20: 4, 15: 9, 10: 6, 5: 6, 3: 24, 1: 18 };
const CALES_MACHINES_DEFAULT = {
  'A1-B1': {},
  'A2-B2': { 25: 8, 20: 24, 15: 27, 10: 27, 5: 17 },
  'A3-B3': { 20: 4, 15: 34, 10: 19, 5: 16, 1: 24 },
  'A4-B4': { 20: 12, 15: 12, 10: 8, 1: 22 }
};

const STORAGE_KEYS = {
  stock: 'gd_stock_v6',
  orders: 'gd_orders_v6',
  counter: 'gd_counter_v6',
  theme: 'gd_theme_v6',
  notepad: 'gd_notepad_v6',
  savedQueries: 'gd_saved_queries_v6',
  calesMachines: 'gd_cales_machines_v6',
  calesRegul: 'gd_cales_regul_v6',
  disquesRegul: 'charben_disques_regul'
};

/* ═══════════════════════════════════════════════
   FIRESTORE SYNC LAYER
   Sync temps réel pour tous les modules.
   Sauvegarde locale (localStorage) + Firestore.
   ═══════════════════════════════════════════════ */
const FS_COLLECTIONS = {
  raw: 'rawMaterials',
  wip: 'wipProducts',
  fardeaux: 'fardeaux',
  stock: 'finishedGoods',
  equip: 'equipment',
  maint: 'maintenanceLogs',
  shifts: 'shifts',
  audit: 'auditLogs',
  qc: 'qualityChecks',
  planning: 'planningTasks',
  prod: 'productionPlan',
  orders: 'orders',
  disques: 'sawmillBlades',
  stockItems: 'stockItems',
  parts: 'parts',
  buildOrders: 'buildOrders',
  lineObj: 'charbenLineObjectives',
  prodCounters: 'prodCounters',
  lineLaunch: 'lineLaunchData'
};

/* ─────────────────────────────────────────────
   FS_PULL_ONLY — collection ÉCRITES mais jamais RELUES

   `parts`, `stockItems` et `buildOrders` sont sauvegardées par stock-manager.js
   (fsSave) et hydratees au demarrage par loadParts()/loadStock()/
   loadBuildOrders() — mais uniquement depuis le localStorage de l'appareil.
   Elles n'etaient dans aucune paire de loadAllFromFirestore() : sur un appareil
   neuf ou apres reinstallation, elles revenaient VIDES alors que le cloud
   Possède les données. C'est le même défaut que `mouvements`, mais l'inverse :
   la sortie cloud existait, seul le retour manquait.

   Elles sont traitees separement des `pairs` parce que leur etat local n'est pas
   un tableau global (pas de variable `parts` / `stockItems` / `buildOrders`) :
   elles vivent uniquement dans localStorage et sont lues a la volee par
   of-tracking.js, inventree-patterns.js et of-manager.js.
   ───────────────────────────────────────────── */
const FS_PULL_ONLY = {
  stockItems: 'charben_stock_items',
  parts: 'charben_parts',
  buildOrders: 'charben_build_orders'
};

/* Document partage pour que TOUS les profils connectes
   synchronisent la meme etat (donnees communes, pas par utilisateur) */
const SYNC_DOC = 'shared';

async function fsSave(collectionKey, data) {
  if (!currentUser || !authToken) return;
  var colName = FS_COLLECTIONS[collectionKey];
  /* Clé inconnue = ÉCHEC SILENCIEUX. C'est la cause racine de toute une famille de
     bugs « les données reviennent en arrière » : rien n'atteint le cloud, et le
     poll réécrase ensuite la mutation locale. Trois collection en ont souffert
     (`mp`, `mouvements`, `dry`). On refuse l'envoi, mais on le DIT — un silent
     return est indétectable en production. Vérifié par tests/persistance-integrite. */
  if (!colName) {
    if (typeof errLog === 'function') {
      errLog('firebase-core', 'fsSave',
        "clé Firestore inconnue : '" + collectionKey + "' — rien n'a été envoyé au cloud", 'error');
    }
    return;
  }
  /* FIX: marquer l'écriture AVANT les appels réseau pour que le garde-fou
     anti-poll de 20s protège les mutations locales même si l'écriture
     échoue (rate-limit, timeout). Sans ca, le poll 15s de fsSubscribe
     écrase les changements non persistés. */
  fsMarkLocalWrite(collectionKey);
  var payload = data;
  try {
    /* MERGE PUSH : réconcilier avec le remote (doc partagé) par ID avant
       d'écrire, pour ne JAMAIS écraser les éléments des autres appareils.
       Le local (dernier auteur) gagne en cas de même ID.

       On lit le cloud avec fsRestGetDetailed, PAS avec fsRestGet : ce dernier
       renvoie null pour un 404 ET pour une panne réseau / un 401 non
       rafraîchi. Traiter une panne comme « cloud vide » faisait sauter la
       fusion, et l'écriture suivante REMPLAÇAIT le document entier — c'est-à-
       dire la perte des données des autres appareils. État inconnu => on
       n'écrit pas : le throw tombe dans le catch ci-dessous, qui met en file
       offline et rejoue au retour du réseau. Rien n'est perdu, rien n'est
       écrasé. */
    if (typeof window._syncMergeById === 'function') {
      var rd = await fsRestGetDetailed(colName + '/' + SYNC_DOC);
      if (rd.status === 404) {
        payload = data; /* premier enregistrement : il n'y a rien à fusionner */
      } else if (rd.error) {
        if (typeof errLog === 'function') {
          errLog('firebase-core', 'fsSave',
            "état du cloud INCONNU pour '" + collectionKey + "' (" + rd.error +
            ") — écriture DIFFÉRÉE, aucun écrasement", 'warn');
        }
        throw new Error('cloud illisible (' + rd.error + ') — écriture différée');
      } else {
        var remoteItems = (rd.data && Array.isArray(rd.data.items)) ? rd.data.items : [];
        payload = window._syncMergeById(data, remoteItems);
      }
    }
    await fsRestSet(colName + '/' + SYNC_DOC, { items: payload, updatedAt: new Date().toISOString() });
    /* Serveur a confirmé -> plus d'écriture locale en attente */
    _fsDirty[collectionKey] = false;
    /* Confirmation serveur OK -> purge de la file pour cette collection */
    if (window._offlineQueue && window._offlineQueue.clearPendingSync) {
      try { window._offlineQueue.clearPendingSync(collectionKey); } catch (e2) {}
    }
  } catch (e) {
    console.warn('Firestore save error [' + collectionKey + ']:', e.message);
    /* Échec -> on NE perd PAS la donnée : mise en file (IndexedDB),
       rejouée au retour en ligne par flushPendingSync(). */
    if (window._offlineQueue && window._offlineQueue.markPendingSync) {
      try { window._offlineQueue.markPendingSync(collectionKey, payload); } catch (e3) {}
    }
  }
}

async function fsLoad(collectionKey) {
  if (!currentUser || !authToken) return null;
  var colName = FS_COLLECTIONS[collectionKey];
  if (!colName) return null;
  try {
    var doc = await fsRestGet(colName + '/' + SYNC_DOC);
    if (doc && doc.items) return doc.items;
  } catch (e) {
    console.warn('Firestore load error [' + collectionKey + ']:', e.message);
  }
  return null;
}

/* Lit le doc partage complet (avec updatedAt) pour comparaison de fraicheur */
async function fsLoadRaw(collectionKey) {
  if (!currentUser || !authToken) return null;
  var colName = FS_COLLECTIONS[collectionKey];
  if (!colName) return null;
  try {
    return await fsRestGet(colName + '/' + SYNC_DOC);
  } catch (e) {
    console.warn('Firestore raw load error [' + collectionKey + ']:', e.message);
  }
  return null;
}

/* Lit l'ancien doc per-utilisateur (legacy, avant le partage) pour reconcilier
   les ecritures faites par des appareils encore sur l'ancienne version */
async function fsLoadLegacy(collectionKey) {
  if (!currentUser || !authToken) return null;
  var colName = FS_COLLECTIONS[collectionKey];
  if (!colName) return null;
  try {
    var doc = await fsRestGet(colName + '/' + currentUser.uid);
    if (doc && doc.items) return doc;
  } catch (e) {
    console.warn('Firestore legacy load error [' + collectionKey + ']:', e.message);
  }
  return null;
}

var fsPollIntervals = {};
var _fsLastWriteAt = {}; // track per-collection last local write time
var _fsLastRemoteUpd = {}; // track per-collection last remote updatedAt (skip si inchangé)
var _fsDirty = {}; // true tant qu'une écriture locale n'est pas confirmée serveur

/** Marquer une écriture locale pour éviter l'écrasement par le prochain poll */
function fsMarkLocalWrite(collectionKey) {
  _fsLastWriteAt[collectionKey] = Date.now();
  _fsDirty[collectionKey] = true;
}

function fsSubscribe(collectionKey, localArray, renderFn, storageKey) {
  if (!currentUser || !authToken) return;
  if (fsPollIntervals[collectionKey]) clearInterval(fsPollIntervals[collectionKey]);
  var doPoll = async function() {
    try {
      var doc = await fsRestGet(FS_COLLECTIONS[collectionKey] + '/' + SYNC_DOC);
      if (doc && doc.items) {
        var remoteUpd = doc.updatedAt || '';
        var localWriteAt = _fsLastWriteAt[collectionKey] || 0;
        /* FIX: Si le remote n'a pas changé depuis le dernier poll,
           pas besoin de fusionner — on évite d'écraser les mutations
           locales inutilement (réduit le nombre de re-renders et
           protège contre les écrasements après le garde-fou 20s). */
        if (remoteUpd && _fsLastRemoteUpd[collectionKey] === remoteUpd) {
          return;
        }
        _fsLastRemoteUpd[collectionKey] = remoteUpd;
        // Ne PAS écraser les changements locaux récents (< 20s) sauf si remote est strictement plus récent
        if (localWriteAt && (Date.now() - localWriteAt) < 20000 && remoteUpd && new Date(remoteUpd).getTime() < localWriteAt) {
          return; // remote est plus vieux que notre écriture locale → skip
        }
        var remote = doc.items;
        var localStr = JSON.stringify(localArray);
        var remoteStr = JSON.stringify(remote);
        if (localStr !== remoteStr) {
          // Sauvegarder la position de scroll avant le re-render
          var scrollY = window.scrollY || document.documentElement.scrollTop;
          var activeEl = document.activeElement;
          var activeId = activeEl ? activeEl.id : null;
          
          /* Merge au lieu d'écraser — UNIQUEMENT si cette collection porte
             une écriture locale non confirmée (_fsDirty). Le local gagne alors
             en cas d'ID identique, sinon on Restore le remote (comportement
             nominal multi-appareils : le dernier écrivain gagne côté serveur).
             Sans ce merge, le poll 15s écrasait toute mutation locale non
             persistée (consommation d'une grume dont le fsSave a échoué) et
             le stock revenait à sa valeur par défaut. */
          if (_fsDirty[collectionKey] && typeof window._syncMergeById === 'function') {
            var merged = window._syncMergeById(localArray, remote);
            localArray.length = 0;
            merged.forEach(function(item) { localArray.push(item); });
          } else {
            localArray.length = 0;
            remote.forEach(function(item) { localArray.push(item); });
          }
          saveToStorage(storageKey, localArray);
          if (renderFn) renderFn();
          _fsLastWriteAt[collectionKey] = Date.now();
          
          // Restaurer la position de scroll et le focus (silent update)
          window.scrollTo(0, scrollY);
          if (activeId) {
            var el = document.getElementById(activeId);
            if (el) el.focus();
          }
          // NE PAS afficher la bannière de sync (mode silencieux)
        }
      }
    } catch (e) {}
  };
  doPoll();
  fsPollIntervals[collectionKey] = setInterval(doPoll, 15000);
}

function fsUnsubscribeAll() {
  Object.keys(fsPollIntervals).forEach(function(key) {
    if (fsPollIntervals[key]) { clearInterval(fsPollIntervals[key]); delete fsPollIntervals[key]; }
  });
}

/** Afficher une notification discrète de synchronisation */
function _updateSyncBanner(msg) {
  var el = document.getElementById('syncBanner');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.style.opacity = '1';
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(function() {
    el.style.opacity = '0';
    setTimeout(function() { el.style.display = 'none'; }, 500);
  }, 2500);
}

async function syncAllToFirestore() {
  if (!currentUser) return;
  const pairs = [
    ['raw', rawMaterials, 'charben_raw'],
    ['wip', wipProducts, 'charben_wip'],
    ['stock', finishedGoods, 'charben_stock'],
    ['equip', equipment, 'charben_equip'],
    ['maint', maintenanceLogs, 'charben_maint'],
    ['shifts', shifts, 'charben_shifts'],
    ['audit', auditLogs, 'charben_audit'],
    ['qc', qualityChecks, 'charben_qc'],
    ['planning', planningTasks, 'charben_planning'],
    ['prod', productionPlan, 'charben_prodplan'],
    ['disques', disques, 'charben_disques']
  ];
  for (let i = 0; i < pairs.length; i++) {
    await fsSave(pairs[i][0], pairs[i][1]);
  }
}

async function loadAllFromFirestore() {
  if (!currentUser) return;
  const pairs = [
    ['raw', rawMaterials, 'charben_raw', renderGrumes],
    ['wip', wipProducts, 'charben_wip', renderWipList],
    ['stock', finishedGoods, 'charben_stock', renderProduitsFinis],
    ['equip', equipment, 'charben_equip', renderEquipList],
    ['maint', maintenanceLogs, 'charben_maint', renderMaintList],
    ['shifts', shifts, 'charben_shifts', renderShifts],
    ['audit', auditLogs, 'charben_audit', renderAuditLogs],
    ['qc', qualityChecks, 'charben_qc', null],
    ['planning', planningTasks, 'charben_planning', renderPlanningList],
    ['prod', productionPlan, 'charben_prodplan', renderProdPlanList],
    ['disques', disques, 'charben_disques', renderDisquesAll]
  ];
  for (let i = 0; i < pairs.length; i++) {
    const colKey = pairs[i][0];
    const local = pairs[i][1];
    const shared = await fsLoadRaw(colKey);
    const sharedItems = (shared && Array.isArray(shared.items)) ? shared.items : null;
    const sharedUpd = (shared && shared.updatedAt) ? shared.updatedAt : '';

    /* Reconciliation legacy : si mon ancien doc per-uid est plus recent que
       le doc partage, il etait ecrit par un appareil sur l'ancienne version
       -> on le pousse vers shared pour que tous les profils voient les memes donnees */
    const legacy = await fsLoadLegacy(colKey);
    if (legacy && Array.isArray(legacy.items) && legacy.items.length > 0) {
      const legacyUpd = legacy.updatedAt || '';
      if (!sharedUpd || legacyUpd > sharedUpd) {
        await fsSave(colKey, legacy.items);
        local.length = 0;
        legacy.items.forEach(function(item) { local.push(item); });
        saveToStorage(pairs[i][2], local);
        try { if (pairs[i][3]) pairs[i][3](); } catch (re) { console.warn('[sync] render ' + colKey + ' failed:', re.message); }
        continue;
      }
    }

    if (sharedItems && sharedItems.length > 0) {
      if (local.length === 0) {
        local.length = 0;
        sharedItems.forEach(function(item) { local.push(item); });
        saveToStorage(pairs[i][2], local);
        try { if (pairs[i][3]) pairs[i][3](); } catch (re) { console.warn('[sync] render ' + colKey + ' failed:', re.message); }
      } else if (typeof window._syncMergeById === 'function') {
        /* MERGE PULL : le local a des saisies (offline éventuellement)
           ET le serveur a des données -> fusion par ID, le local gagne
           en cas de doublon. Puis on re-pousse pour réconcilier le cloud. */
        var mergedPull = window._syncMergeById(local, sharedItems);
        var localBeforePull = local.length;
        local.length = 0;
        mergedPull.forEach(function(item) { local.push(item); });
        saveToStorage(pairs[i][2], local);
        try { if (pairs[i][3]) pairs[i][3](); } catch (re) { console.warn('[sync] render ' + colKey + ' failed:', re.message); }
        if (mergedPull.length > sharedItems.length || localBeforePull !== mergedPull.length) {
          await fsSave(colKey, local);
        }
      }
    } else if (local.length > 0) {
      await fsSave(colKey, local);
    }
  }
  if (typeof syncDisquesFromMachines === 'function') syncDisquesFromMachines(true);
  await pullFsPullOnlyCollections();
}

/* Redescente cloud → localStorage pour FS_PULL_ONLY.
   Règles, dans cet ordre de priorité :
   1. le cloud vide ou injoignable ne jamaIs écrase le local (donnée hors ligne) ;
   2. le local gagne sur le cloud en cas d'ID identique (comme les `pairs`) ;
   3. si le local est vide, on adopte le cloud — c'est le cas d'un appareil neuf ;
   4. si la fusion a ajouté des éléments, on re-pousse pour converger le cloud. */
async function pullFsPullOnlyCollections() {
  if (!currentUser) return;
  var keys = Object.keys(FS_PULL_ONLY);
  for (var i = 0; i < keys.length; i++) {
    var colKey = keys[i];
    var storageKey = FS_PULL_ONLY[colKey];
    var local = [];
    try {
      var raw = localStorage.getItem(storageKey);
      var parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) local = parsed;
    } catch (e) { local = []; }

/* Lecture avec statut : `fsLoadRaw` confondait 404 et panne. Traiter une
       panne comme « cloud vide » nous ferait pousser le local par-dessus des
       données distantes intactes — exactement la perte qu'on cherche à
       éviter. Cloud illisible => on garde le local, on passe au suivant. */
    var rd = await fsRestGetDetailed(FS_COLLECTIONS[colKey] + '/' + SYNC_DOC);
    if (rd.error) {
      if (typeof errLog === 'function') {
    errLog('firebase-core', 'pullFsPullOnly',
          "cloud illisible pour '" + colKey + "' (" + rd.error + ") — local conservé", 'warn');
      }
      continue;
    }
    var remote = (rd.data && Array.isArray(rd.data.items)) ? rd.data.items : [];

    if (remote.length === 0) {
      /* Cloud CONFIRMÉ vide (404 ou items:[]) : le local devient la vérité. */
      if (local.length > 0) await fsSave(colKey, local);
      continue;
    }
    if (local.length === 0) {
      try { localStorage.setItem(storageKey, JSON.stringify(remote)); }
      catch (e) {
        if (typeof errLog === 'function') {
          errLog('firebase-core', 'pullFsPullOnly',
            "quota dépassé en écrivant '" + storageKey + "' (" + remote.length + ' éléments)', 'warn');
        }
      }
      continue;
    }
    if (typeof window._syncMergeById !== 'function') continue;
    var merged = window._syncMergeById(local, remote);
    if (merged.length === local.length) continue;
    try { localStorage.setItem(storageKey, JSON.stringify(merged)); }
    catch (e) {
      if (typeof errLog === 'function') {
        errLog('firebase-core', 'pullFsPullOnly',
          "quota dépassé en fusionnant '" + storageKey + "'", 'warn');
      }
      continue;
    }
    await fsSave(colKey, merged);
  }
}

async function mergeOrdersFromFirestore() {
  if (!currentUser) return;
  try {
    const remote = await fsLoad('orders');
    if (!remote || remote.length === 0) {
      if (orders.length > 0) fsSave('orders', orders);
      return;
    }
    const localBefore = JSON.stringify(orders);
    const map = {};
    orders.forEach(function(o) { if (o && o.orderNum) map[o.orderNum] = o; });
    remote.forEach(function(o) { if (o && o.orderNum && !map[o.orderNum]) map[o.orderNum] = o; });
    const merged = Object.keys(map).map(function(k) { return map[k]; });
    orders = merged;
    safeSave(STORAGE_KEYS.orders, orders);
    const maxNum = orders.reduce(function(m, o) {
      const n = parseInt(String(o.orderNum).replace(/\D/g, ''), 10);
      return isNaN(n) ? m : Math.max(m, n);
    }, 0);
    if (maxNum >= orderCounter) {
      orderCounter = maxNum;
      safeSave(STORAGE_KEYS.counter, orderCounter);
    }
    currentOrderA = bestOrderForLine('A');
    currentOrderB = bestOrderForLine('B');
    const afterMerge = JSON.stringify(orders);
    // Pousser vers le cloud si le local a changé (pull) OU si le cloud
    // est plus petit que le merge (des OF existent localement mais pas
    // dans le doc partagé) — sinon le cloud reste avec un sous-ensemble
    // et les appareils neufs ne reçoivent jamais les OF.
    const cloudMissing = merged.length > remote.length;
    if (localBefore !== afterMerge || cloudMissing) {
      fsSave('orders', orders);
      fsMarkLocalWrite('orders');
      // Sauvegarder la position de scroll avant le re-render
      var scrollY = window.scrollY || document.documentElement.scrollTop;
      var activeEl = document.activeElement;
      var activeId = activeEl ? activeEl.id : null;
      
      renderAll();
      syncToAllTabs();
      
      // Restaurer la position de scroll et le focus (silent update)
      window.scrollTo(0, scrollY);
      if (activeId) {
        var el = document.getElementById(activeId);
        if (el) el.focus();
      }
      // NE PAS afficher la bannière de sync (mode silencieux)
    }
  } catch (e) {
    console.warn('Merge orders error:', e.message);
  }
}

/* ROLE_PERMISSIONS supprimé — voir modules/permissions.js */

let currentUser = null;
let currentRole = null;

var STOCK = loadFromStorage(STORAGE_KEYS.stock, { ...STOCK_DEFAULT });
var calesMachines = loadFromStorage(STORAGE_KEYS.calesMachines, JSON.parse(JSON.stringify(CALES_MACHINES_DEFAULT)));
var orders = loadFromStorage(STORAGE_KEYS.orders, []);
var orderCounter = loadFromStorage(STORAGE_KEYS.counter, 0);
var ofActiveLine = 'A';
/* Ligne canonique d'un OF : le champ `line` peut porter un poste de machine
   (A1/A2/A3, B1/B2). On ne retient que la lettre de la ligne. */
function orderLine(o) {
  if (!o) return 'A';
  return String(o.line || 'A').charAt(0).toUpperCase() || 'A';
}
let currentOrderA = orders.length > 0 ? orders.find(o => orderLine(o) === 'A') || null : null;
let currentOrderB = orders.length > 0 ? orders.find(o => orderLine(o) === 'B') || null : null;
let lateralCount = 1;
let pendingConfirmCallback = null;

function lineOrders(line) {
  return orders.filter(o => orderLine(o) === line);
}
function getLineOrder(line) {
  return line === 'B' ? currentOrderB : currentOrderA;
}
function setLineOrder(line, order) {
  if (line === 'B') currentOrderB = order; else currentOrderA = order;
}
/* Sélectionner l'OF actif par ligne : prioriser en_cours/brouillon,
   sinon prendre le plus récent (numéro le plus haut). L'ancien [0]
   prenait le premier élément du tableau — qui dépend de l'ordre
   d'insertion (localStorage vs Firestore) et diffère par appareil. */
function bestOrderForLine(ln) {
  var lineOfs = lineOrders(ln);
  if (!lineOfs.length) return null;
  var active = lineOfs.filter(function(o) { return o.status === 'en_cours' || o.status === 'brouillon'; });
  if (active.length) {
    return active.reduce(function(best, o) {
      var n = parseInt(String(o.orderNum).replace(/\D/g, ''), 10);
      var b = parseInt(String(best.orderNum).replace(/\D/g, ''), 10);
      return (isNaN(n) || n < b) ? best : o;
    }, active[0]);
  }
  return lineOfs.reduce(function(best, o) {
    var n = parseInt(String(o.orderNum).replace(/\D/g, ''), 10);
    var b = parseInt(String(best.orderNum).replace(/\D/g, ''), 10);
    return (isNaN(n) || n < b) ? best : o;
  }, lineOfs[0]);
}
function getActiveOrder() {
  return getLineOrder(ofActiveLine);
}

