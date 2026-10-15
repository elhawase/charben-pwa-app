/**
 * SCIAGE-LOGIC.JS — Cœur calcul sciage : cales, volume, machines, gamme.
 * Copies EXACTES de app.js. Globals: STOCK, calesMachines, CALES_PAIR_KEYS,
 * CALES_PAIR_NAMES, orders, disques, DISK_THICKNESS, GAMME_ESSENCES, GAMME_ESSENCE_KEY
 */
'use strict';

window._sciageLogic_comboArray = function(target, machine) {
  let res = [], rem = target;
  for (const r of getRingSizes(machine)) while (rem >= r) { res.push(r); rem -= r; }
  return res;
}

window._sciageLogic_getRingSizes = function(machine) {
  var set = {};
  Object.keys(STOCK).forEach(function(k) { set[k] = 1; });
  if (machine) Object.keys(machineKit(machine)).forEach(function(k) { set[k] = 1; });
  return Object.keys(set).map(Number).sort(function(a, b) { return b - a; });
}

window._sciageLogic_getCombination = function(target, machine) {
  const arr = comboArray(target, machine);
  return arr.length > 0 ? arr.join(' + ') : '0';
}

window._sciageLogic_comboToCounts = function(arr) {
  return arr.reduce((c, v) => { c[v] = (c[v] || 0) + 1; return c; }, {});
}

window._sciageLogic_calcVolumeGrume = function(diamCm, lengthM) {
  const r = (diamCm / 100) / 2;
  return parseFloat((Math.PI * r * r * lengthM).toFixed(4));
}

/* ── Species-Aware : profils essence (rendement attendu & coefficient de sciage).
   Charben distingue deux familles :
     · résineux locaux    : Pin (pin), Épicéa (spruce)
     · feuillus tropicaux : Ekki (ekki), Azobé (azobe)
   `retraitPct` = retrait de séchage (%) aligné sur essence.retrait_sechage / GAMME_ESSENCES.
   `coefSciage` = rendement sciage attendu (volume PF / volume grume), PROVISOIRE — à valider
   métier avant tout usage décisionnel. N'affecte JAMAIS le volume géométrique facturé, qui
   reste le cylindre petit-bout de calcVolumeGrume() (cohérence factures & historique). ── */
window._sciageLogic_ESSENCE_PROFILES = {
  pin:    { famille: 'resineux', retraitPct: 6.0, coefSciage: 0.60 },
  spruce: { famille: 'resineux', retraitPct: 5.0, coefSciage: 0.58 },
  ekki:   { famille: 'tropical', retraitPct: 8.0, coefSciage: 0.52 },
  azobe:  { famille: 'tropical', retraitPct: 9.0, coefSciage: 0.50 },
  other:  { famille: 'inconnu',  retraitPct: 5.0, coefSciage: 0.55 }
};

window._sciageLogic_essenceProfile = function(essence) {
  var P = window._sciageLogic_ESSENCE_PROFILES;
  var raw = String(essence == null ? '' : essence).trim().toLowerCase();
  /* Normalise les libellés UI (fr) vers les clés de profil. */
  var alias = {
    'pin': 'pin', 'pins': 'pin', 'pin maritime': 'pin',
    'épicéa': 'spruce', 'epicea': 'spruce', 'spruce': 'spruce', 'épicéa commun': 'spruce',
    'ekki': 'ekki', 'azobé': 'azobe', 'azobe': 'azobe'
  };
  var key = alias[raw] || (P[raw] ? raw : 'other');
  var p = P[key] || P.other;
  return { key: key, famille: p.famille, retraitPct: p.retraitPct, coefSciage: p.coefSciage };
}

window._sciageLogic_grumeWidthMm = function(g) {
  return Math.round((g.diametre || 0) * 10);
}

window._sciageLogic_discGapForMachine = function(machine) {
  var o = activeOfForMachine(machine);
  if (!o) return { need: 0, available: 0, gap: 0 };
  var laterals = (o.laterals || []).length;
  var pieceCount = 1 + laterals;
  var need = 2 * pieceCount + 1;
  var available = disques.reduce(function(s, d) { return s + (((d.locations || {})[machine]) || 0); }, 0);
  return { need: need, available: available, gap: available - need };
}

window._sciageLogic_caleGapForPair = function(pairKey) {
  var machines = pairKey.split('-');
  var o = activeOfForMachine(machines[0]) || activeOfForMachine(machines[1]);
  if (!o || !o.central) return { need: 0, available: 0, gap: 0 };
  var machine = machines[0] + '1';
  var laterals = (o.laterals || []).map(parseFloat).filter(function(v) { return !isNaN(v) && v > 0; });
  var center = parseFloat(o.central);
  var spaceForRings = 280 - ((laterals.length + 1) * DISK_THICKNESS) - (DISK_THICKNESS / 2);
  var lateralsSum = laterals.reduce(function(a, b) { return a + b; }, 0);
  var outerRings = Math.max(0, spaceForRings - center - lateralsSum);
  var combos = [comboArray(center, machine)].concat(laterals.map(function(l) { return comboArray(l, machine); })).concat([comboArray(outerRings, machine)]);
  var needs = needsForCombos(combos, 1);
  var needTotal = Object.keys(needs).reduce(function(s, k) { return s + needs[k]; }, 0);
  var kit = calesMachines[pairKey] || {};
  var kitTotal = Object.keys(kit).reduce(function(s, k) { return s + (kit[k] || 0); }, 0);
  var magTotal = Object.keys(STOCK).reduce(function(s, k) { return s + (STOCK[k] || 0); }, 0);
  var available = kitTotal + magTotal;
  return { need: needTotal, available: available, gap: available - needTotal, details: needs };
}

window._sciageLogic_machineKitKey = function(machine) {
  return 'A' + machine.charAt(1) + '-B' + machine.charAt(1);
}

window._sciageLogic_machineKit = function(machine) {
  var key = machineKitKey(machine);
  if (!calesMachines[key]) calesMachines[key] = {};
  return calesMachines[key];
}

window._sciageLogic_stockDispoFor = function(machine, size) {
  var kit = machine ? (machineKit(machine)[size] || 0) : 0;
  var mag = STOCK[size] || 0;
  return { kit: kit, magasin: mag, total: kit + mag };
}

window._sciageLogic_activeOfForMachine = function(machine) {
  return orders.find(function(o) {
    return o.assigned_poste === machine && (o.status === 'engage' || o.status === 'en_cours');
  }) || null;
}

window._sciageLogic_calesAllSizes = function() {
  var set = {};
  Object.keys(STOCK).forEach(function(s) { set[s] = true; });
  CALES_PAIR_KEYS.forEach(function(k) {
    Object.keys(calesMachines[k] || {}).forEach(function(s) { set[s] = true; });
  });
  return Object.keys(set).map(Number).sort(function(a, b) { return b - a; });
}

window._sciageLogic_caleListTotal = function(needs) {
  return Object.keys(needs || {}).reduce(function(s, k) { return s + needs[k]; }, 0);
}

window._sciageLogic_calesPairName = function(k) { return CALES_PAIR_NAMES[k] || ''; }

window._sciageLogic_calesPairShort = function(k) { return k.split('-').join(' + '); }

window._sciageLogic_calesRegulTargetKeys = function() {
  return CALES_PAIR_KEYS.concat(['MAGASIN']);
}

window._sciageLogic_calesRegulTargetLabel = function(key) {
  if (key === 'MAGASIN') return '🏬 Magasin';
  var pn = calesPairName(key);
  return calesPairShort(key) + (pn ? ' · ' + pn : '');
}

window._sciageLogic_gammeEssence = function() {
  const saved = loadFromStorage(GAMME_ESSENCE_KEY, 'spruce');
  return GAMME_ESSENCES[saved] ? saved : 'spruce';
}

window._sciageLogic_mesuresMachine = function(line, m) {
  var o = getLineOrder(line);
  var d = { comment: '' };
  var cw = o ? (o.centerWidth ? String(o.centerWidth) : '—') : '—';
  var cH = o ? (o.central ? String(o.central) : '—') : '—';
  var lats = o && o.laterals && o.laterals.length ? o.laterals.join(' × ') : '';
  var lws = o && o.lateralWidths && o.lateralWidths.length ? o.lateralWidths.map(function(w) { return w + ' mm'; }).join(' · ') : '';
  var n = m.slice(1);
  if (n === '1') {
    d.comment = lats
      ? 'Débit grume ' + (o ? (String(o.logWidth || '—') + ' mm') : '—') + ' → Centre ' + cH + '×' + cw + ' · Latérales ' + lws
      : 'Débit grume ' + (o ? (String(o.logWidth || '—') + ' mm') : '—') + ' → Centre ' + cH + '×' + cw;
  } else if (n === '2') {
    d.comment = 'Calibrage CC — cible centre : ' + cw + ' mm' + (lws ? ' · latérales à rejoindre : ' + lws : '');
  } else if (n === '3') {
    d.comment = 'Déligneuse SB — alignement sur largeurs latérales : ' + (lws || '—');
  } else if (n === '4') {
    d.comment = 'Récupération dosses — lister les dosses pour recyclage / voliges';
  }
  return d;
}

/* --- EXPORT GLOBAL --- */

window.sciageLogic = {
  comboArray: window._sciageLogic_comboArray,
  getRingSizes: window._sciageLogic_getRingSizes,
  getCombination: window._sciageLogic_getCombination,
  comboToCounts: window._sciageLogic_comboToCounts,
  calcVolumeGrume: window._sciageLogic_calcVolumeGrume,
  ESSENCE_PROFILES: window._sciageLogic_ESSENCE_PROFILES,
  essenceProfile: window._sciageLogic_essenceProfile,
  grumeWidthMm: window._sciageLogic_grumeWidthMm,
  discGapForMachine: window._sciageLogic_discGapForMachine,
  caleGapForPair: window._sciageLogic_caleGapForPair,
  machineKitKey: window._sciageLogic_machineKitKey,
  machineKit: window._sciageLogic_machineKit,
  stockDispoFor: window._sciageLogic_stockDispoFor,
  activeOfForMachine: window._sciageLogic_activeOfForMachine,
  calesAllSizes: window._sciageLogic_calesAllSizes,
  caleListTotal: window._sciageLogic_caleListTotal,
  calesPairName: window._sciageLogic_calesPairName,
  calesPairShort: window._sciageLogic_calesPairShort,
  calesRegulTargetKeys: window._sciageLogic_calesRegulTargetKeys,
  calesRegulTargetLabel: window._sciageLogic_calesRegulTargetLabel,
  gammeEssence: window._sciageLogic_gammeEssence,
  mesuresMachine: window._sciageLogic_mesuresMachine
};
