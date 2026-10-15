/**
 * data-v7.js — Tables unifiées V7 (modèle métier scierie)
 * CharbenAPK — 2026-09-23
 *
 * 7 tables, chacune avec trace (traçabilité InvenTree).
 * Modèle: OF = pattern coupe, Cut = sorties sciage liées par ID.
 *
 * Charge APRES data.js, AVANT app.js.
 */
'use strict';

/* ═══════════════════════════════════════════════
   CLÉS V7
   ═══════════════════════════════════════════════ */
var V7_KEYS = {
  mp: 'charben_mp',
  of: 'charben_of_v7',
  cut: 'charben_cut_v7',
  wip: 'charben_wip_v7',
  pf: 'charben_pf_v7',
  equipment: 'charben_equip_v7',
  production: 'charben_prod_v7',
  system: 'charben_sys_v7'
};

/* ═══════════════════════════════════════════════
   ANCIENNES CLÉS À NETTOYER
   ═══════════════════════════════════════════════ */
var OLD_KEYS = [
  'charben_raw', 'gd_orders_v6', 'gd_counter_v6', 'charben_wip',
  'charben_stock', 'charben_equip', 'charben_maint', 'charben_disques',
  'charben_disques_regul', 'gd_cales_regul_v6', 'gd_cales_machines_v6',
  'charben_prod_counters', 'charben_line_launch', 'charben_prodplan',
  'charben_planning', 'charben_of_history', 'charben_audit', 'charben_shifts',
  'charben_fardeaux', 'charben_qc', 'charben_cqp_grades', 'charben_cqp_wood',
  'charben_cqp_trace', 'charben_cqp_stress', 'charben_cqp_byproducts',
  'charben_cqp_blades', 'charben_stock_transactions',
  'gd_stock_v6', 'gd_theme_v6', 'gd_notepad_v6', 'gd_saved_queries_v6'
];

function cleanOldKeys() {
  var v = parseInt(localStorage.getItem('charben_data_version') || '0', 10);
  if (v >= 8) return;
  var cleaned = 0;
  OLD_KEYS.forEach(function(k) {
    if (localStorage.getItem(k) !== null) {
      localStorage.removeItem(k);
      cleaned++;
    }
  });
  localStorage.setItem('charben_data_version', '8');
  if (cleaned > 0) errLog('v7', 'cleanOldKeys', cleaned + ' anciennes cl\u00e9s nettoy\u00e9es', 'info');
}

/* ═══════════════════════════════════════════════
   TABLES V7 — Chargement
   ═══════════════════════════════════════════════ */

/* 1. MP — Grumes reçues */
var mp = loadFromStorage(V7_KEYS.mp, []);

/* 2. OF — Ordres de fabrication (pattern de coupe) */
var ofOrders = loadFromStorage(V7_KEYS.of, []);

/* 3. CUT — Sorties de sciage (liées à OF + grume) */
var cuts = loadFromStorage(V7_KEYS.cut, []);

/* 4. WIP — Semi-finis (liés à Cut) */
var wip = loadFromStorage(V7_KEYS.wip, []);

/* 5. PF — Produits finis (liés à WIP) */
var pf = loadFromStorage(V7_KEYS.pf, []);

/* ═══════════════════════════════════════════════
   NETTOYAGE DES DONNÉES
   ═══════════════════════════════════════════════ */
function cleanTableData() {
  var changed = false;

  /* MP: supprimer doublons par code, entrées vides */
  if (mp.length) {
    var seen = {};
    var before = mp.length;
    mp = mp.filter(function(g) {
      if (!g || !g.code) return false;
      if (seen[g.code]) return false;
      seen[g.code] = true;
      return true;
    });
    if (mp.length !== before) { changed = true; errLog('v7', 'cleanMP', 'MP: ' + before + ' \u2192 ' + mp.length, 'info'); }
  }

  /* WIP: supprimer doublons par ref, entrées sans ref ou qte=0 */
  if (wip.length) {
    var seenW = {};
    var beforeW = wip.length;
    wip = wip.filter(function(w) {
      if (!w || !w.ref) return false;
      if (seenW[w.ref]) return false;
      if ((w.qte || 0) <= 0) return false;
      seenW[w.ref] = true;
      return true;
    });
    if (wip.length !== beforeW) { changed = true; errLog('v7', 'cleanWIP', 'WIP: ' + beforeW + ' \u2192 ' + wip.length, 'info'); }
  }

  /* PF: supprimer doublons par code, entrées sans code ou qte=0 */
  if (pf.length) {
    var seenP = {};
    var beforeP = pf.length;
    pf = pf.filter(function(p) {
      if (!p || !p.code) return false;
      if (seenP[p.code]) return false;
      if ((p.qte || 0) <= 0) return false;
      seenP[p.code] = true;
      return true;
    });
    if (pf.length !== beforeP) { changed = true; errLog('v7', 'cleanPF', 'PF: ' + beforeP + ' \u2192 ' + pf.length, 'info'); }
  }

  if (changed) {
    v7Save('mp');
    v7Save('wip');
    v7Save('pf');
    errLog('v7', 'cleanDone', 'Donn\u00e9es nettoy\u00e9es \u2713', 'info');
  }
}

/* 6. Equipment — Machines + lames + cales + maintenance
   ⚠ Variable nommée v7Equip et NON `equipment` : data.js déclare déjà un
   global `equipment` (tableau de machines, clé charben_equip). Les deux
   scripts étant des <script defer>, data-v7.js s'exécute APRÈS et écrasait
   window.equipment avec cet objet V7 — cassant renderEquipList, le pull
   Firestore et le type de charben_equip_v7. */
var v7Equip = loadFromStorage(V7_KEYS.equipment, {
  machines: [], lames: [], cales: {}, maintenance: [], regul: []
});
if (Array.isArray(v7Equip)) v7Equip = { machines: v7Equip, lames: [], cales: {}, maintenance: [], regul: [] };
if (!v7Equip.machines) v7Equip.machines = [];
if (!v7Equip.lames) v7Equip.lames = [];
if (!v7Equip.cales) v7Equip.cales = {};
if (!v7Equip.maintenance) v7Equip.maintenance = [];
if (!v7Equip.regul) v7Equip.regul = [];

/* 7. System — Audit + shifts */
var sys = loadFromStorage(V7_KEYS.system, { audit: [], shifts: [], config: {} });
if (Array.isArray(sys)) sys = { audit: sys, shifts: [], config: {} };
if (!sys.audit) sys.audit = [];
if (!sys.shifts) sys.shifts = [];

/* ═══════════════════════════════════════════════
   UTILITAIRES
   ═══════════════════════════════════════════════ */
function v7Save(key) {
  var dataMap = {
    mp: mp, of: ofOrders, cut: cuts, wip: wip, pf: pf,
    equipment: v7Equip, production: null, system: sys
  };
  var lsKey = V7_KEYS[key] || key;
  saveToStorage(lsKey, dataMap[key] !== undefined ? dataMap[key] : []);
  if (typeof fsSave === 'function') fsSave(key, dataMap[key] || []);
}

function ensureTrace(item, defaults) {
  if (!item) return item;
  if (!item.trace) {
    item.trace = {
      batchCode: item.ref || item.code || item.id || '',
      origin: defaults.origin || 'unknown',
      history: defaults.history || []
    };
  }
  if (!item.trace.history) item.trace.history = [];
  return item;
}

function traceAction(item, action, details) {
  if (!item || !item.trace) return;
  item.trace.history.push({
    ts: new Date().toISOString(),
    action: action,
    by: (typeof currentUser !== 'undefined' && currentUser && currentUser.uid) ? currentUser.uid : 'system',
    details: details || {}
  });
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ═══════════════════════════════════════════════
   MIGRATION V7 — Anciennes données → nouvelles tables
   ═══════════════════════════════════════════════ */
function migrateV7() {
  var v = parseInt(localStorage.getItem('charben_data_version') || '0', 10);
  if (v >= 8) return;

  /* ── MP ── */
  if (!mp.length) {
    var raw = loadFromStorage('charben_raw', []);
    if (raw.length) {
      mp = raw.map(function(g) { return ensureTrace(g, { origin: 'supplier' }); });
      v7Save('mp');
      errLog('v7', 'migrateMP', 'MP: ' + mp.length, 'info');
    }
  }

  /* ── OF ── */
  if (!ofOrders.length) {
    var oldOrders = loadFromStorage('gd_orders_v6', []);
    if (!oldOrders.length) oldOrders = loadFromStorage('charben_orders_v7', []);
    if (oldOrders.length) {
      ofOrders = oldOrders.map(function(o) {
        var of = ensureTrace(o, { origin: 'planning' });
        of.pattern = {
          central: { thickness: parseFloat(o.central) || 0, count: (o.central2 && parseFloat(o.central2) > 0) ? 2 : 1 },
          central2: (o.central2 && parseFloat(o.central2) > 0) ? { thickness: parseFloat(o.central2), count: 1 } : null,
          laterals: (o.laterals || []).map(function(lat) { return { thickness: parseFloat(lat) || 0, count: 2 }; }),
          dosses: o.dosses ? { thickness: o.dosses.epaisseur || 4, count: o.dosses.count || 2 } : { thickness: 4, count: 2 }
        };
        of.resolvedWidths = {
          centerWidth: parseFloat(o.centerWidth) || 0,
          lateralWidths: (o.lateralWidths || []).map(function(w) { return parseFloat(w) || 0; }),
          ccWidths: (o.ccWidths || []).map(function(w) { return parseFloat(w) || 0; })
        };
        of.history = loadFromStorage('charben_of_history', []).filter(function(h) { return h.orderNum === o.orderNum; });
        return of;
      });
      v7Save('of');
      errLog('v7', 'migrateOF', 'OF: ' + ofOrders.length, 'info');
    }
  }

  /* ── WIP ── */
  if (!wip.length) {
    var oldWip = loadFromStorage('charben_wip', []);
    if (!oldWip.length) oldWip = loadFromStorage('charben_wip_v7', []);
    if (oldWip.length) {
      wip = oldWip.map(function(w) { return ensureTrace(w, { origin: 'sciage' }); });
      v7Save('wip');
      errLog('v7', 'migrateWIP', 'WIP: ' + wip.length, 'info');
    }
  }

  /* ── PF ── */
  if (!pf.length) {
    var oldPf = loadFromStorage('charben_stock', []);
    if (!oldPf.length) oldPf = loadFromStorage('charben_pf', []);
    if (oldPf.length) {
      pf = oldPf.map(function(p) { return ensureTrace(p, { origin: 'wip' }); });
      v7Save('pf');
      errLog('v7', 'migratePF', 'PF: ' + pf.length, 'info');
    }
  }

  /* ── Equipment ── */
  if (!v7Equip.machines.length) {
    var oldEquip = loadFromStorage('charben_equip', []);
    var oldDisques = loadFromStorage('charben_disques', null);
    var oldMaint = loadFromStorage('charben_maint', []);
    if (oldEquip.length || oldDisques) {
      v7Equip.machines = oldEquip.map(function(m) { return ensureTrace(m, { origin: 'config' }); });
      v7Equip.lames = (oldDisques && oldDisques.blades) ? oldDisques.blades : (Array.isArray(oldDisques) ? oldDisques : []);
      v7Equip.maintenance = oldMaint.map(function(m) { return ensureTrace(m, { origin: 'maintenance' }); });
      v7Save('equipment');
      errLog('v7', 'migrateEquip', 'Equipment: ' + v7Equip.machines.length + ' machines', 'info');
    }
  }

  /* ── System ── */
  if (!sys.audit.length) {
    var oldAudit = loadFromStorage('charben_audit', []);
    var oldShifts = loadFromStorage('charben_shifts', []);
    if (oldAudit.length || oldShifts.length) {
      sys.audit = oldAudit.map(function(a) { return ensureTrace(a, { origin: 'audit' }); });
      sys.shifts = oldShifts;
      v7Save('system');
      errLog('v7', 'migrateSys', 'System: ' + sys.audit.length + ' audits', 'info');
    }
  }

  localStorage.setItem('charben_data_version', '8');
  errLog('v7', 'migrate', 'Migration v8 termin\u00e9e \u2713', 'info');

  /* Nettoyage APRÈS migration */
  cleanOldKeys();
}

/* ═══════════════════════════════════════════════
   ALIASES DE COMPATIBILITÉ
   ═══════════════════════════════════════════════ */
function setupV7Aliases() {
  /* Aliases de compat — si une redéfinition échoue (propriété non-configurable),
     on ignore : le code moderne utilise mp/ofOrders/etc directement. */
  function safeAlias(name, getter, setter) {
    try {
      Object.defineProperty(window, name, { get: getter, set: setter || function() {}, configurable: true });
    } catch (e) { /* alias deja en place, non bloquant */ }
  }
  /* rawMaterials → mp */
  safeAlias('rawMaterials', function() { return mp; }, function(v) { mp = v; });
  /* orders → ofOrders (compat) */
  safeAlias('orders', function() { return ofOrders; }, function(v) { ofOrders = v; });
  /* orderCounter */
  safeAlias('orderCounter', function() { var max = 0; ofOrders.forEach(function(o) { var m = String(o.orderNum || '').match(/(\d+)$/); if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; } }); return max; });
  /* wipProducts → wip */
  safeAlias('wipProducts', function() { return wip; }, function(v) { wip = v; });
  /* finishedGoods → pf */
  safeAlias('finishedGoods', function() { return pf; }, function(v) { pf = v; });
  /* equipment → v7Equip.machines
     Le payload Firestore peut être le tableau machines OU l'objet V7 complet
     {machines,lames,maintenance,cales} : on extrait dans les deux cas. */
  safeAlias('equipment', function() { return v7Equip.machines; }, function(v) {
    if (v && !Array.isArray(v) && Array.isArray(v.machines)) v7Equip.machines = v.machines;
    else if (Array.isArray(v)) v7Equip.machines = v;
    else if (v && typeof v === 'object') v7Equip = v;
  });
  /* disques → v7Equip.lames */
  safeAlias('disques', function() { return { blades: v7Equip.lames }; }, function(v) { if (v && v.blades) v7Equip.lames = v.blades; else if (Array.isArray(v)) v7Equip.lames = v; });
  /* maintenanceLogs → v7Equip.maintenance */
  safeAlias('maintenanceLogs', function() { return v7Equip.maintenance; }, function(v) { v7Equip.maintenance = v; });
  /* calesMachines → v7Equip.cales */
  safeAlias('calesMachines', function() { return v7Equip.cales; }, function(v) { v7Equip.cales = v; });
  /* productionPlan → compat (map to ofOrders) */
  safeAlias('productionPlan', function() { return ofOrders; });
  /* planningTasks → compat */
  safeAlias('planningTasks', function() { return []; });
  /* prodCounters → compat */
  safeAlias('prodCounters', function() { return {}; });
  /* lineLaunch → compat */
  safeAlias('lineLaunch', function() { return {}; });
  /* auditLogs → sys.audit */
  safeAlias('auditLogs', function() { return sys.audit; }, function(v) { sys.audit = v; });
  /* shifts → sys.shifts */
  safeAlias('shifts', function() { return sys.shifts; }, function(v) { sys.shifts = v; });
  /* fardeaux → compat */
  safeAlias('fardeaux', function() { return []; });
  /* dryingBatches → compat */
  if (typeof dryingBatches !== 'undefined') {
    safeAlias('dryingBatches', function() { return []; });
  }
  errLog('v7', 'aliases', 'Aliases activ\u00e9s \u2713', 'info');
}

/* ═══════════════════════════════════════════════
   HOOKS — Redirect anciennes clés → V7
   ═══════════════════════════════════════════════ */
/* Redirection 1:1 — chaque clé legacy possède SA propre clé V7.
   AVANT (BUG) : charben_equip, charben_maint, charben_disques,
   charben_disques_regul, gd_cales_regul_v6 et gd_cales_machines_v6 pointaient
   TOUTES sur charben_equip_v7. Dernier écrivain gagne -> machines, maintenance
   et lames se détruisaient mutuellement. Idem charben_prod_v7 (4 clés) et
   charben_sys_v7 (2 clés). On ne redirige plus que si la cible est unique. */
var V7_KEY_REDIRECT = {
  'charben_raw': 'charben_mp',
  'charben_wip': 'charben_wip_v7',
  'charben_stock': 'charben_pf_v7',
  'charben_equip': 'charben_equip_v7',
  'charben_maint': 'charben_maint_v7',
  'charben_disques': 'charben_disques_v7',
  'charben_disques_regul': 'charben_disques_regul_v7',
  'gd_cales_regul_v6': 'charben_cales_regul_v7',
  'gd_cales_machines_v6': 'charben_cales_machines_v7',
  'charben_prod_counters': 'charben_prod_counters_v7',
  'charben_line_launch': 'charben_line_launch_v7',
  'charben_prodplan': 'charben_prodplan_v7',
  'charben_planning': 'charben_planning_v7',
  'charben_audit': 'charben_audit_v7',
  'charben_shifts': 'charben_shifts_v7',
  'gd_orders_v6': 'charben_of_v7'
};
/* Firestore : on NE redirige plus maint/disques vers 'equipment'.
   Les seules cibles qui existent vraiment dans FS_COLLECTIONS sont 'wip' et
   'equipment' ; la redirection de maint/disques y faisait ecrire la
   maintenance et les lames DANS le doc equipment, et empechait
   clearPendingSync() de purger la file offline (appelee avec 'equipment'
   alors que l'enregistrement est cle 'maint'/'disques'). */
var V7_FS_REDIRECT = {
  'wip': 'wip'
};
(function hookStorage() {
  if (typeof window._saveToStorageOrig === 'undefined' && typeof saveToStorage === 'function') {
    window._saveToStorageOrig = saveToStorage;
    window.saveToStorage = function(key, data) { window._saveToStorageOrig(V7_KEY_REDIRECT[key] || key, data); };
  }
  if (typeof window._fsSaveOrig === 'undefined' && typeof fsSave === 'function') {
    window._fsSaveOrig = fsSave;
    /* V7_FS_REDIRECT mappe vers des noms de CLÉS LOCALSTORAGE V7, qui
       n'existent PAS dans FS_COLLECTIONS (Firestore). Sans ce garde-fou,
       fsSave('raw') -> fsSave('mp') -> FS_COLLECTIONS['mp'] undefined ->
       early return SILENCIEUX : rien n'est jamais écrit sur Firestore, et
       le poll 15s réécrase en boucle toute mutation locale (stock qui
       revient à sa valeur par défaut, grumes consommées qui réapparaissent).
       On ne redirige donc que si la collection cible existe vraiment. */
    window.fsSave = function(key, data) {
      /* Ferd-fou F-04 (log-only) : un dataset > 1 MiB sera REJETÉ par Firestore
         et rejoué en boucle par sync-manager. Le rendre visible maintenant
         permet de diagnostiquer avant que le sharding (firestore-pages.js)
         remplace le doc unique {col}/shared par des pages bornées. */
      if (typeof window.__FSPAGES__ !== 'undefined') {
        try {
          var bytes = window.__FSPAGES__.estimateDocBytes(data);
          if (bytes > window.__FSPAGES__.HARD_LIMIT_BYTES) {
            errLog('fspages', 'fsSave-size-guard',
              'Collection "' + key + '": ' + bytes + ' octets > 1 MiB (limite Firestore) — rejet + rejeu en boucle attendus. Sharding F-04 requis.', 'error');
          } else if (bytes > Math.floor(window.__FSPAGES__.HARD_LIMIT_BYTES * 0.9)) {
            errLog('fspages', 'fsSave-size-guard',
              'Collection "' + key + '": ' + bytes + ' octets — proche de la limite 1 MiB, printer le sharding F-04.', 'warn');
          }
        } catch (e) {}
      }
      var target = V7_FS_REDIRECT[key];
      if (target && typeof FS_COLLECTIONS !== 'undefined' && FS_COLLECTIONS[target]) {
        return window._fsSaveOrig(target, data);
      }
      return window._fsSaveOrig(key, data);
    };
  }
})();

/* ═══════════════════════════════════════════════
   DATA ACCESS (DA) — Interface propre
   ═══════════════════════════════════════════════ */
var DA = {
  /* MP */
  getMp: function() { return mp; },
  getGrume: function(code) { return mp.find(function(g) { return g.code === code || g.scanCode === code; }); },
  addGrume: function(g) { g = ensureTrace(g, { origin: 'supplier' }); mp.unshift(g); v7Save('mp'); },

  /* OF */
  getOf: function() { return ofOrders; },
  getOfByNum: function(num) { return ofOrders.find(function(o) { return o.orderNum === num; }); },
  addOf: function(o) { o = ensureTrace(o, { origin: 'planning' }); ofOrders.unshift(o); v7Save('of'); },

  /* CUT */
  getCuts: function() { return cuts; },
  getCutsByOf: function(ofId) { return cuts.filter(function(c) { return c.ofId === ofId; }); },
  getCutsByGrume: function(grumeCode) { return cuts.filter(function(c) { return c.grumeCode === grumeCode; }); },
  addCut: function(c) { c = ensureTrace(c, { origin: 'sciage' }); cuts.unshift(c); v7Save('cut'); },

  /* WIP */
  getWip: function() { return wip; },
  getWipByCut: function(cutId) { return wip.filter(function(w) { return w.cutId === cutId; }); },
  addWip: function(item) { item = ensureTrace(item, { origin: 'sciage' }); wip.unshift(item); v7Save('wip'); },

  /* PF */
  getPf: function() { return pf; },
  addPf: function(item) { item = ensureTrace(item, { origin: 'wip' }); pf.unshift(item); v7Save('pf'); },

  /* Equipment */
  getEquipment: function() { return v7Equip; },
  saveEquipment: function() { v7Save('equipment'); },

  /* System */
  getSystem: function() { return sys; },
  addAudit: function(entry) { sys.audit.unshift(entry); v7Save('system'); },
  saveSystem: function() { v7Save('system'); },

  /* Trace */
  ensureTrace: ensureTrace,
  traceAction: traceAction,
  genId: genId,

  /* Version */
  version: 8,
  isMigrated: function() { return parseInt(localStorage.getItem('charben_data_version') || '0', 10) >= 8; }
};
