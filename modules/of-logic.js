/**
 * OF-LOGIC.JS — Logique métier pure (calculs, validation, rendement)
 * Scierie Charben — Extraits depuis app.js
 * ZERO DOM, ZERO side effects, ZERO innerHTML
 * Globals: GAMME_ESSENCES, MACHINE_SPECS, DISK_THICKNESS, MAX_LOG_WIDTH, MAX_BLADES
 */
'use strict';

/* ─────────────────────────────────────────────
   gammeClass — classe SB/CC/sans gamme
   Extrait: app.js ligne 3985
   ───────────────────────────────────────────── */

window._ofLogic_gammeClass = function(essence, h, b) {
  var data = (GAMME_ESSENCES[essence] || GAMME_ESSENCES.spruce).data;
  var row = data[h];
  if (!row) return null;
  var sb = row.sb.indexOf(b) >= 0;
  var cc = row.cc.indexOf(b) >= 0;
  if (sb && cc) return 'SB/CC';
  if (sb) return 'SB';
  if (cc) return 'CC';
  return null;
};

/* ─────────────────────────────────────────────
   sfCode — code semi-fini
   Extrait: app.js ligne 3074
   ───────────────────────────────────────────── */

window._ofLogic_sfCode = function(essence, ep, b) {
  var gamme = window._ofLogic_gammeClass(essence, ep, b);
  var suffix = '';
  if (gamme === 'SB/CC') suffix = '-SBCC';
  else if (gamme) suffix = '-' + gamme;
  return 'SF-' + (essence || 'Bois') + suffix + '-' + (ep || '?') + 'x' + (b || '?') + 'mm';
};

/* ─────────────────────────────────────────────
   sfMachinePath — machine affectée (A2/A3)
   Extrait: app.js ligne 3082
   ───────────────────────────────────────────── */

window._ofLogic_sfMachinePath = function(essence, ep, b, isCenter) {
  if (isCenter) return 'A2';
  var gamme = window._ofLogic_gammeClass(essence, ep, b);
  if (gamme === 'SB' || gamme === 'SB/CC') return 'A3';
  if (gamme === 'CC') return 'A2';
  return 'A3';
};

/* ─────────────────────────────────────────────
   pfTypeFromDims — type produit fini
   Extrait: app.js ligne 3090
   ───────────────────────────────────────────── */

window._ofLogic_pfTypeFromDims = function(ep, larg) {
  if (!ep || !larg) return 'Inconnu';
  var full = window._ofLogic_pieceDesignation(ep, larg);
  return full ? full.split(' ')[0] : 'Planche';
};

/* ─────────────────────────────────────────────
   pieceDesignation — dénomination AFNOR
   Extrait: app.js ligne 4007
   ───────────────────────────────────────────── */

window._ofLogic_pieceDesignation = function(h, b) {
  var H = Number(h), B = Number(b);
  if (!H || !B || H <= 0 || B <= 0) return '';
  var r = B / H;
  var side = Math.max(H, B);
  if (r <= 1.3) {
    if (side > 120) return 'Poutre ' + H + '×' + B;
    if (side <= 50) return 'Carrelet ' + H + '×' + B;
    if (Math.min(H, B) >= 40) return 'Chevron ' + H + '×' + B;
    return 'Avivé ' + H + '×' + B;
  }
  if (r >= 2 && r <= 3.5) {
    if (H >= 70) return 'Madrier ' + H + '×' + B;
    if (H >= 50) return 'Bastaing ' + H + '×' + B;
    if (H >= 32) return 'Demi-bastaing ' + H + '×' + B;
    if (H >= 25) return 'Frise ' + H + '×' + B;
    return 'Solivette ' + H + '×' + B;
  }
  if (r > 3.5) {
    if (H <= 22) return 'Volige ' + H + '×' + B;
    if (H <= 40) return 'Planche ' + H + '×' + B;
    return 'Plateau ' + H + '×' + B;
  }
  return 'Avivé ' + H + '×' + B;
};

/* ─────────────────────────────────────────────
   usableWidth — largeur utilisable (hors marge)
   Extrait: app.js ligne 4033
   ───────────────────────────────────────────── */

window._ofLogic_usableWidth = function(logWidth, margin) {
  var m = Math.max(0, parseFloat(margin) || 0);
  return Math.max(0, logWidth - 2 * m);
};

/* ─────────────────────────────────────────────
   validateGammePieces — validation gamme
   Extrait: app.js lignes 85-112
   ───────────────────────────────────────────── */

window._ofLogic_validateGammePieces = function(essence, central, centerWidth, laterals, lateralWidths) {
  var data = (GAMME_ESSENCES[essence] || GAMME_ESSENCES.spruce).data;
  var blocked = [];
  var warnings = [];
  var infos = [];
  function checkPiece(name, h, b) {
    if (!b || b <= 0) {
      blocked.push('Largeur (B) obligatoire pour A2/A3 : ' + name + ' ' + (h || '') + 'mm.');
      return;
    }
    if (!(h in data)) {
      warnings.push(h + '×' + b + ' hors gamme standard (non bloquant).');
      infos.push({ h: h, b: b, cls: 'hors-gamme' });
      return;
    }
    var cls = window._ofLogic_gammeClass(essence, h, b);
    if (!cls) {
      blocked.push(h + '×' + b + ' non disponible en ' + ((GAMME_ESSENCES[essence] && GAMME_ESSENCES[essence].label) || essence) + ' (SB/CC).');
    } else {
      infos.push({ h: h, b: b, cls: cls });
    }
  }
  checkPiece('Centre', central, centerWidth);
  laterals.forEach(function(h, i) {
    checkPiece('Latérale ' + (i + 1), h, lateralWidths[i]);
  });
  return { blocked: blocked, warnings: warnings, infos: infos };
};

/* ─────────────────────────────────────────────
   resolveOfWidths — résolution largeurs OF
   Extrait: app.js lignes 1211-1239
   ───────────────────────────────────────────── */

window._ofLogic_resolveOfWidths = function(o) {
  var ess = o.essence || 'spruce';
  var data = (GAMME_ESSENCES[ess] || GAMME_ESSENCES.spruce).data;
  var cw = parseFloat(o.centerWidth) || 0;
  if (!cw || cw <= 0) {
    var cKey = parseFloat(o.central);
    var cRow = data[cKey];
    if (!cRow || !(cRow.cc && cRow.cc.length)) {
      var allCcKeys = Object.keys(data).map(Number).filter(function(k) { return data[k].cc && data[k].cc.length; }).sort(function(a, b) { return Math.abs(a - cKey) - Math.abs(b - cKey); });
      cRow = allCcKeys.length ? data[allCcKeys[0]] : null;
    }
    if (cRow && cRow.cc && cRow.cc.length) cw = cRow.cc[0];
    else if (o.ccLargeurs && o.ccLargeurs.length) cw = parseFloat(o.ccLargeurs[0]) || 0;
  }
  var lws = (o.lateralWidths && o.lateralWidths.length) ? o.lateralWidths.slice() : [];
  if (!lws.length && o.sbLargeurs && o.sbLargeurs.length) lws = o.sbLargeurs.slice();
  (o.laterals || []).forEach(function(h, i) {
    if (i < lws.length && parseFloat(lws[i]) > 0) return;
    var key = parseFloat(h);
    var row = data[key];
    if (!row || !(row.sb && row.sb.length)) {
      var allSbKeys = Object.keys(data).map(Number).filter(function(k) { return data[k].sb && data[k].sb.length; }).sort(function(a, b) { return Math.abs(a - key) - Math.abs(b - key); });
      row = allSbKeys.length ? data[allSbKeys[0]] : null;
    }
    if (row && row.sb && row.sb.length) lws[i] = row.sb[0];
    else lws[i] = '';
  });
  return { centerWidth: cw, lateralWidths: lws };
};

/* ─────────────────────────────────────────────
   ccMachineInfo — calcul CC (centre centrales)
   Extrait: app.js lignes 1241-1274
   ───────────────────────────────────────────── */

window._ofLogic_ccMachineInfo = function(o) {
  var H = parseFloat(o.central);
  var resolved = window._ofLogic_resolveOfWidths(o);
  var B = parseFloat(resolved.centerWidth);
  if (!H || H <= 0) return null;
  var margin = o.margin ? parseFloat(o.margin) : 0;
  var usable = Math.max(0, o.logWidth - 2 * margin);
  if (!B || B <= 0) return { h: H, b: null, n: 0, extraB: null, chute: 0, margin: margin, usableW: +usable.toFixed(1) };
  var n = Math.floor(usable / (B + DISK_THICKNESS));
  if (n < 1) return { h: H, b: B, n: 0, extraB: null, chute: o.logWidth, margin: margin, usableW: +usable.toFixed(1) };
  var used = n * B + (n - 1) * DISK_THICKNESS;
  var rest = usable - used;
  var extraB = null;
  var gammeData = (GAMME_ESSENCES[o.essence] || GAMME_ESSENCES.spruce).data;
  var row = gammeData[H];
  if (row && row.cc && row.cc.length) {
    if (rest >= 20) {
      var cands = row.cc.slice().filter(function(w) { return w < B && w <= rest - DISK_THICKNESS; }).sort(function(a, b) { return b - a; });
      if (cands.length) { extraB = cands[0]; used += DISK_THICKNESS + extraB; }
    } else if (n >= 2) {
      var space = usable - (n - 1) * B - (n - 2) * DISK_THICKNESS - DISK_THICKNESS;
      var cands2 = row.cc.slice().filter(function(w) { return w < B && w <= space; }).sort(function(a, b) { return b - a; });
      if (cands2.length) { extraB = cands2[0]; n = n - 1; used = n * B + n * DISK_THICKNESS + extraB; }
    }
  }
  return { h: H, b: B, n: n, extraB: extraB, chute: +(o.logWidth - used).toFixed(1), margin: margin, usableW: +usable.toFixed(1) };
};

/* ─────────────────────────────────────────────
   sbMachineInfo — calcul SB (latérales)
   Extrait: app.js lignes 1276-1290
   ───────────────────────────────────────────── */

window._ofLogic_sbMachineInfo = function(o) {
  var laterals = o.laterals || [];
  var resolved = window._ofLogic_resolveOfWidths(o);
  var lw = resolved.lateralWidths || [];
  var margin = o.margin ? parseFloat(o.margin) : 0;
  var usable = Math.max(0, o.logWidth - 2 * margin);
  return laterals.map(function(h, i) {
    var B = parseFloat(lw[i]);
    if (!B || B <= 0) return { h: h, b: null, n: 0, chute: 0, margin: margin, usableW: +usable.toFixed(1) };
    var n = Math.floor(usable / (B + DISK_THICKNESS));
    if (n < 1) return { h: h, b: B, n: 0, chute: o.logWidth, margin: margin, usableW: +usable.toFixed(1) };
    var used = n * B + (n - 1) * DISK_THICKNESS;
    return { h: h, b: B, n: n, chute: +(o.logWidth - used).toFixed(1), margin: margin, usableW: +usable.toFixed(1) };
  });
};

/* ─────────────────────────────────────────────
   needsForCombos — besoins cales
   Extrait: app.js ligne 1292
   ───────────────────────────────────────────── */

window._ofLogic_needsForCombos = function(combos, mult) {
  var needs = {};
  combos.forEach(function(arr) {
    var counts = comboToCounts(arr);
    Object.keys(counts).forEach(function(size) {
      needs[size] = (needs[size] || 0) + counts[size] * mult;
    });
  });
  return needs;
};

/* ─────────────────────────────────────────────
   shortagesOf — pénuries cales
   Extrait: app.js ligne 1303
   ───────────────────────────────────────────── */

window._ofLogic_shortagesOf = function(needs, machine) {
  return Object.keys(needs).filter(function(s) { return stockDispoFor(machine, s).total < needs[s]; });
};

/* ─────────────────────────────────────────────
   EXPORT GLOBAL — wrappers compatibles
   ───────────────────────────────────────────── */

window.ofLogic = {
  gammeClass: window._ofLogic_gammeClass,
  sfCode: window._ofLogic_sfCode,
  sfMachinePath: window._ofLogic_sfMachinePath,
  pfTypeFromDims: window._ofLogic_pfTypeFromDims,
  pieceDesignation: window._ofLogic_pieceDesignation,
  usableWidth: window._ofLogic_usableWidth,
  validateGammePieces: window._ofLogic_validateGammePieces,
  resolveOfWidths: window._ofLogic_resolveOfWidths,
  ccMachineInfo: window._ofLogic_ccMachineInfo,
  sbMachineInfo: window._ofLogic_sbMachineInfo,
  needsForCombos: window._ofLogic_needsForCombos,
  shortagesOf: window._ofLogic_shortagesOf
};
