/**
 * OF-MANAGER.JS — Gestion des Ordres de Fabrication
 * Scierie Charben — Extraits depuis app.js
 * Constantes globales (MAX_LOG_WIDTH etc.) restent dans firebase-core.js
 * Globals: orders, orderCounter, rawMaterials, dryingBatches, finishedGoods,
 *          StockManager, EventBus, InvenTreePatterns, TransactionLogger
 */
'use strict';

/* ─────────────────────────────────────────────
   createOfFromSpec — crée un OF depuis une spec
   Extrait: app.js lignes 8485-8602
   ───────────────────────────────────────────── */

window._ofManager_createOfFromSpec = function(line) {
  var laterals = line.laterals || [];
  var logWidth = parseFloat(line.logWidth);
  var central = parseFloat(line.central);
  if (!logWidth || logWidth <= 0 || !central || central <= 0) return null;
  if (logWidth > MAX_LOG_WIDTH) return null;
  var central2 = (line.central2 && parseFloat(line.central2) > 0) ? parseFloat(line.central2) : 0;
  var sumSingle = central + central2 + laterals.reduce(function(a, b) { return a + b; }, 0);
  var sumDouble = sumSingle * 2;
  var ccCount = central2 > 0 ? 2 : 1;
  var pieceCount = ccCount + laterals.length;
  var machine = line.machine || line.line || 'A';
  var isDebit = machine === 'A1' || machine === 'B1';
  var effectiveMaxBlades = isDebit ? 17 : MAX_BLADES;
  var diskCount = 2 * pieceCount + 1;
  if (diskCount > effectiveMaxBlades) return null;
  var diskTotal = diskCount * DISK_THICKNESS;
  var totalConsumed = sumDouble + diskTotal;
  var chute = +(logWidth - totalConsumed).toFixed(2);
  if (chute < 0) return null;
  orderCounter++;
  var orderNum = 'OF-' + String(orderCounter).padStart(4, '0');
  var now = new Date();
  var order = {
    orderNum: orderNum,
    date: now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
          now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    line: dashboardRenderer.ofLine(line),
    machine: line.machine || (line.line || 'A'),
    logWidth: logWidth,
    central: central,
    central2: (line.central2 && parseFloat(line.central2) > 0) ? parseFloat(line.central2) : null,
    laterals: laterals.slice(),
    pieceCount: pieceCount,
    diskCount: diskCount,
    totalConsumed: totalConsumed,
    chute: chute,
    ppId: line.id,
    clientName: line.clientName || '',
    reference: line.reference || '',
    status: 'engage',
    wood: line.wood || '',
    essence: (line.essence && GAMME_ESSENCES[line.essence]) ? line.essence : 'spruce',
    centerWidth: (line.centerWidth && parseFloat(line.centerWidth) > 0) ? line.centerWidth : ((line.ccLargeurs && line.ccLargeurs.length && parseFloat(line.ccLargeurs[0]) > 0) ? line.ccLargeurs[0] : null),
    lateralWidths: (line.lateralWidths && line.lateralWidths.length) ? line.lateralWidths.slice() : ((line.sbLargeurs && line.sbLargeurs.length) ? line.sbLargeurs.slice() : []),
    length: line.length || null,
    qty: line.qty || null,
    plannedDate: line.date || null,
    notes: line.notes || '',
    margin: line.margin || null,
    dosses: line.dosses || null,
    thickness: line.thickness || 0
  };
  /* ── Chute → volume de dosses (m³) : chute(mm) × longueur(m) × épaisseur dosse(mm).
        DÉCISION CEO 08/10/2026 — o.chute reste une LARGEUR en mm (inchangé) ;
        o.chuteVolM3 = 0 si la plan n'a pas de longueur (aucune conversion possible). ── */
  var chuteLongueurM = parseFloat(line.length) || 0;
  var chuteEpDosse = (line.dosses && parseFloat(line.dosses.epaisseur) > 0)
    ? parseFloat(line.dosses.epaisseur) : DISK_THICKNESS;
  order.chuteVolM3 = (chute > 0 && chuteLongueurM > 0)
    ? +((chute / 1000) * chuteLongueurM * (chuteEpDosse / 1000)).toFixed(6)
    : 0;
  /* ── Résolution largeurs standard si absentes (gamme) ── */
  if (order.centerWidth == null && typeof resolveOfWidths === 'function') {
    try {
      var rw = resolveOfWidths(order) || {};
      if (rw.centerWidth > 0) order.centerWidth = rw.centerWidth;
      if (!order.lateralWidths.length && rw.lateralWidths && rw.lateralWidths.length) order.lateralWidths = rw.lateralWidths;
      if (order.central2 && parseFloat(order.central2) > 0 && rw.centerWidth > 0) {
        order.ccWidths = [rw.centerWidth, rw.centerWidth];
      }
    } catch (e) { errLog('of-manager', 'resolveOfWidths', e, 'warn'); }
  }
  // Allocation auto (OpenWES task pattern)
  if (typeof TaskAllocator !== 'undefined') {
    try {
      var allocation = TaskAllocator.allocate({
        id: order.id,
        orderNum: order.orderNum,
        logWidth: logWidth,
        central: central,
        laterals: laterals,
        essence: order.essence,
        grumeDiametre: line.grumeDiametre || null,
        urgent: line.urgent,
        plannedDate: line.date,
        status: 'engage'
      });
      order.allocation = allocation;
      order.assigned_line = allocation.assigned_line;
      order.assigned_poste = allocation.assigned_poste;
      order.priority = allocation.priority;
      order.estimated_time_min = allocation.estimated_time_min;
      if (allocation.assigned_poste) {
        order.machine = allocation.assigned_poste;
        order.line = allocation.assigned_line;
      }
    } catch (e) { errLog('of-manager', 'Allocation auto createOf', e, 'warn'); }
  }
  orders.unshift(order);
  setLineOrder(order.line, order);
  safeSave(STORAGE_KEYS.orders, orders);
  safeSave(STORAGE_KEYS.counter, orderCounter);
  fsSave('orders', orders);
  // INVENTREE PATTERN: BuildOrder tracking
  if (typeof StockManager !== 'undefined' && typeof TransactionLogger !== 'undefined') {
    try {
      var boRef = InvenTreePatterns.generateOfReference(order.assigned_poste || order.line || 'A1');
      var posteKey = (order.assigned_poste || order.line || 'A1').toUpperCase();
      var locationMap = StockManager.LOCATIONS.ATELIER.children;
      var locId = (locationMap[posteKey] && locationMap[posteKey].id) || StockManager.LOCATIONS.ATELIER.id;
      var bo = StockManager.createBuildOrder({
        reference: boRef,
        output_part_id: 'sf_' + order.orderNum,
        output_quantity: order.pieceCount || 1,
        location_id: locId,
        notes: order.notes || '',
        scheduled_start: Date.now()
      });
      TransactionLogger.log({
        type: 'build_order_created',
        build_order_id: bo.id,
        part_id: bo.output_part_id,
        details: { reference: boRef, order_num: order.orderNum, line: order.line, allocation: order.assigned_poste }
      });
    } catch (e) { errLog('of-manager', 'Stock tracking createOf', e, 'warn'); }
  }
  // EVENT BUS: of.created
  if (typeof EventBus !== 'undefined' && typeof EventBus.publish === 'function') {
    try {
      EventBus.publish(EventBus.Topics.OF_CREATED, {
        orderNum: order.orderNum,
        assigned_poste: order.assigned_poste || order.line,
        priority: order.priority,
        timestamp: Date.now()
      });
    } catch (e) { errLog('of-manager', 'EventBus publish createOf', e, 'warn'); }
  }
  return orderNum;
};

/* ─────────────────────────────────────────────
   buildOfSemiItems — construit les items semi-finis
   Extrait: app.js lignes 3148-3179
   Pure computation — no DOM, no side effects
   ───────────────────────────────────────────── */

window._ofManager_buildOfSemiItems = function(o, opts) {
  var items = [];
  if (!o) return items;
  var ess = o.essence || 'Pin';
  var q;
  if (opts && opts.perGrume) {
    q = 1;
  } else {
    var pg = parseInt(o.producedGrumes, 10);
    q = (pg > 0) ? pg : (parseInt(o.qty, 10) > 0 ? parseInt(o.qty, 10) : 1);
  }
  var L = parseFloat(o.pieceLength) || 0;
  function vol(ep, b) {
    return (L > 0 && ep > 0 && b > 0) ? +((ep / 1000) * (b / 1000) * (L / 1000)).toFixed(6) : 0;
  }
  /* Largeurs standard (gamme) — NE JAMAIS retomber sur logWidth (largeur brute de grume).
     resolveOfWidths renvoie la largeur standard de la gamme si centre/latéraux absents. */
  var resolved = null;
  try {
    if (typeof resolveOfWidths === 'function') resolved = resolveOfWidths(o) || null;
  } catch (e) { resolved = null; }
  /* ── Persister les largeurs résolues sur l'OF (cohérence fiche/matrice/WIP) ── */
  if (resolved && o.orderNum) {
    var cwNum = parseFloat(resolved.centerWidth);
    if (cwNum > 0 && (o.centerWidth == null || parseFloat(o.centerWidth) !== cwNum)) {
      o.centerWidth = cwNum;
    }
    if (Array.isArray(resolved.lateralWidths) && resolved.lateralWidths.length) {
      var needsWrite = !Array.isArray(o.lateralWidths) || o.lateralWidths.length !== resolved.lateralWidths.length;
      if (!needsWrite) {
        for (var ri = 0; ri < resolved.lateralWidths.length; ri++) {
          if (parseFloat(resolved.lateralWidths[ri]) !== parseFloat(o.lateralWidths[ri])) { needsWrite = true; break; }
        }
      }
      if (needsWrite) o.lateralWidths = resolved.lateralWidths.slice();
    }
    try {
      safeSave(STORAGE_KEYS.orders, orders);
      if (typeof fsSave === 'function') fsSave('orders', orders);
    } catch (e) {}
  }
  var laterals = o.laterals || [];
  var widths = [];
  if (resolved && Array.isArray(resolved.lateralWidths) && resolved.lateralWidths.length) widths = resolved.lateralWidths.slice();
  if (!widths.length && Array.isArray(o.lateralWidths)) widths = o.lateralWidths.slice();
  var latQtyMult = (o.lateralQtyMult || 2);
  var ctrQtyMult = (o.centerQtyMult || 1);
  laterals.forEach(function(ep, i) {
    var b = parseFloat(widths[i]) > 0 ? widths[i] : '';
    if (!b) return;
    var gamme = gammeClass(ess, ep, b);
    var horsGamme = !gamme;
    items.push({ item: sfCode(ess, ep, b), qty: latQtyMult * q, uom: 'pcs', dims: { ep: ep, b: b, central: false }, longueur: L, volume: vol(ep, b), machine: sfMachinePath(ess, ep, b, false), horsGamme: horsGamme });
  });
  var cw = '';
  if (resolved && parseFloat(resolved.centerWidth) > 0) cw = resolved.centerWidth;
  else if (parseFloat(o.centerWidth) > 0) cw = o.centerWidth;
  if (cw) {
    var gammeCtr = gammeClass(ess, o.central, cw);
    items.push({ item: sfCode(ess, o.central, cw), qty: ctrQtyMult * q, uom: 'pcs', dims: { ep: o.central, b: cw, central: true }, longueur: L, volume: vol(o.central, cw), machine: sfMachinePath(ess, o.central, cw, true), horsGamme: !gammeCtr });
  }
  /* ── CC secondaire (central2) ── */
  if (o.central2 && parseFloat(o.central2) > 0) {
    var cw2 = (o.ccWidths && o.ccWidths.length > 1) ? o.ccWidths[1] : cw;
    if (cw2) {
      var gammeCtr2 = gammeClass(ess, o.central2, cw2);
      items.push({ item: sfCode(ess, o.central2, cw2), qty: ctrQtyMult * q, uom: 'pcs', dims: { ep: o.central2, b: cw2, central: true }, longueur: L, volume: vol(o.central2, cw2), machine: sfMachinePath(ess, o.central2, cw2, true), horsGamme: !gammeCtr2 });
    }
  }
  var dosses = o.dosses || null;
  if (dosses && dosses.count > 0) {
    var dEp = dosses.epaisseur || DISK_THICKNESS;
    var dLarg = dosses.largeur || cw || '';
    if (dLarg) {
      var dQty = Math.max(1, parseInt(dosses.count, 10) || 1) * q;
      var gammeD = gammeClass(ess, dEp, dLarg);
      items.push({ item: sfCode(ess, dEp, dLarg), qty: dQty, uom: 'pcs', dims: { ep: dEp, b: dLarg, central: false, dosse: true }, longueur: L, volume: vol(dEp, dLarg), machine: sfMachinePath(ess, dEp, dLarg, false), horsGamme: !gammeD, isDosse: true });
    }
  }
  return items;
};

/* ─────────────────────────────────────────────
   sciagePiecesPerGrume — pièces par machine pour 1 grume
   Retourne { A1, A2, A3, A4 } selon config OF (producedQty=1)
   Utilisé par validateGrumeA1 (compteurs) et renderWipMatrix (matrice)
   ───────────────────────────────────────────── */

window._ofManager_sciagePiecesPerGrume = function(o) {
  var res = { A1: 0, A2: 0, A3: 0, A4: 0 };
  if (!o) return res;
  try {
    var clone = JSON.parse(JSON.stringify(o));
    clone.producedQty = 1;
    clone.qty = 1;
    clone.producedGrumes = 1;
    var items = window._ofManager_buildOfSemiItems(clone, { perGrume: true });
    items.forEach(function(it) {
      if (!it || !it.qty) return;
      var qty = it.qty;
      if (it.isDosse) { res.A4 += qty; res.A1 += qty; return; }
      var m = it.machine === 'A2' ? 'A2' : 'A3';
      res[m] += qty;
      res.A1 += qty;
    });
    } catch (e) { errLog('of-manager', 'sciagePiecesPerGrume', e, 'warn'); }
  return res;
};

/* ─────────────────────────────────────────────
   ofPostSciageOutput — post-traitement sciage
   Extrait: app.js lignes 2891-3030
   ───────────────────────────────────────────── */

window._ofManager_ofPostSciageOutput = function(o) {
  if (!o || o.semiPosted || !o.orderNum) return;
  var line = dashboardRenderer.ofLine(o);
  var launched = lineLaunchedForOf(line, o.orderNum) || [];
  launched.forEach(function(l) {
    var mp = rawMaterials.find(function(m) { return m.code === l.code; });
    if (mp && mp.statut === 'EN_COURSE') {
      mp.statut = 'CONSOMME';
      mp.consumedAt = new Date().toISOString();
    }
  });
  if (!o.pieceLength) {
    /* BORNAGE : la pièce est coupée sur la plus PETITE grume lancée — produire
       plus long que la grume la plus courte sortirait plus que la grume ne
       contient. Une pieceLength explicite sur l'OF n'est jamais réécrite
       (l'alarme d'invariant en dépend). */
    var grumeL = 0;
    launched.forEach(function(l) {
      var gl = parseFloat(l.longueur) || 0;
      if (gl > 0 && (grumeL === 0 || gl < grumeL)) grumeL = gl;
    });
    if (grumeL === 0) {
      launched.forEach(function(l) {
        var gm = rawMaterials.find(function(x) { return x.code === l.code; });
        var gl = gm ? (parseFloat(gm.longueur) || 0) : 0;
        if (gl > 0 && (grumeL === 0 || gl < grumeL)) grumeL = gl;
      });
    }
    if (grumeL > 0) o.pieceLength = Math.round(grumeL * 1000);
  }
  var items = window._ofManager_buildOfSemiItems(o);
  if (items.length) {
    o.semiItems = items;
  }
  o.semiPosted = true;
  saveToStorage('charben_raw', rawMaterials);
  fsSave('raw', rawMaterials);
  saveLineLaunch();
  safeSave(STORAGE_KEYS.orders, orders);
  fsSave('orders', orders);
  addAuditLog('OF ' + o.orderNum + ' réalisé — ' + (items.length ? items.length + ' référence(s) semi-finie(s) > WIP' : 'aucune sortie semi-finie'));
  /* ── Import automatique des produits semi-finis dans wipProducts ── */
  /* P0 — le chemin canonique est importGrumeToWip : c'est le seul qui lie la pièce à sa
     grume (grumeCode) et qui alimente le registre des mouvements. On délègue donc d'abord
     chaque grume lancée non encore importée. L'écriture agrégée historique n'est atteinte
     que si aucune grume n'est disponible — ses lignes porteront alors sansLienGrume:true
     et la fiche affichera « rattachement indisponible ». */
  var grumesRestantes = (launched || []).map(function(l) { return l && l.code; })
    .filter(function(c) { return c && (!o._importedGrumes || o._importedGrumes.indexOf(c) === -1); });
  var delegues = 0;
  if (typeof window._ofManager_importGrumeToWip === 'function') {
    grumesRestantes.forEach(function(code) {
      try {
        window._ofManager_importGrumeToWip(o, code);
        if (o._importedGrumes && o._importedGrumes.indexOf(code) !== -1) delegues++;
      } catch (e) {
        errLog('of-manager', 'ofPostSciageOutput', 'délégation grume ' + code + ' : ' + (e && e.message), 'warn');
      }
    });
  }
  if (items.length && delegues === 0 && typeof wipProducts !== 'undefined') {
    /* Dédup: exclure les grumes déjà importées via importGrumeToWip (per-grume) */
    var imported = (o._importedGrumes && o._importedGrumes.length) ? new Set(o._importedGrumes) : null;
    var wipCount = 0;
    items.forEach(function(it) {
      if (!it || !it.item || (it.qty || 0) <= 0) return;
      var ep = it.dims ? (it.dims.ep || 0) : 0;
      var larg = it.dims ? (it.dims.b || 0) : 0;
      var longueur = parseFloat(o.pieceLength) || 0;
      var ref = 'SF-' + Date.now().toString(36).slice(-4) + wipCount;
      var unitVol = (ep > 0 && larg > 0 && longueur > 0) ? +((ep / 1000) * (larg / 1000) * (longueur / 1000)).toFixed(6) : 0;
      /* Skip si une entrée WIP identique (même OF + même ép×larg) existe déjà */
      if (imported) {
        var key = ep + 'x' + larg;
        var alreadyInWip = wipProducts.some(function(w) {
          return w.ofNum === o.orderNum && (w.epaisseur || 0) === ep && (w.largeur || 0) === larg && w.statut === 'EN_WIP';
        });
        if (alreadyInWip) return;
      }
      wipProducts.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + wipCount,
        ref: ref, type: (it.item || 'SF'), essence: o.essence || 'Pin',
        epaisseur: ep, largeur: larg, longueur: longueur,
        qte: it.qty || 0, volume: +(unitVol * (it.qty || 0)).toFixed(4),
        ofNum: o.orderNum || '', grumeCode: '',
        line: line, machine: line + (it.isDosse ? '4' : String(it.machine || '2').slice(-1)),
        isDosse: !!it.isDosse, sansLienGrume: true,
        statut: 'EN_WIP',
        createdAt: new Date().toISOString()
      });
      wipCount++;
    });
    if (wipCount > 0) {
      saveToStorage('charben_wip', wipProducts);
      if (typeof fsSave === 'function') fsSave('wip', wipProducts);
    }
  }
  // INVENTREE PATTERN: Stock transactions + WIP tracking
  if (typeof StockManager !== 'undefined' && typeof TransactionLogger !== 'undefined') {
    try {
      var totalMpM3 = 0;
      var totalWipM3 = 0;
      launched.forEach(function(l) {
        var gm = rawMaterials.find(function(x) { return x.code === l.code; });
        if (gm) {
          var grumeVol = parseFloat(gm.volume) || 0;
          totalMpM3 += grumeVol;
          TransactionLogger.log({
            type: 'stock_consumed',
            stock_item_id: gm.code,
            quantity: 1,
            volume: grumeVol,
            details: {
              order_num: o.orderNum, grume_code: gm.code,
              diameter: gm.diametre, essence: gm.essence,
              volume_m3: grumeVol, length_m: gm.longueur || null
            }
          });
        }
      });
      if (items.length) {
        items.forEach(function(item) {
          var batch = InvenTreePatterns.generateBatchNumber('SF');
          var sfVol = ((item.volume || 0) * (item.qty || 0));
          totalWipM3 += sfVol;
          TransactionLogger.log({
            type: 'stock_added',
            part_id: item.item,
            quantity: item.qty,
            volume: sfVol,
            details: { order_num: o.orderNum, batch: batch, dims: item.dims, volume_unit: item.volume, volume_total_m3: sfVol }
          });
        });
      }
      if (typeof InvenTreePatterns !== 'undefined' && typeof InvenTreePatterns.generateOfReference === 'function') {
        try {
          var boRef = InvenTreePatterns.generateOfReference(o.assigned_poste || o.line || 'A1');
          var boOrders = JSON.parse(localStorage.getItem('charben_build_orders') || '[]');
          var bo = boOrders.find(function(x) { return x.reference === boRef; });
          if (bo) {
            bo.inputs = launched.map(function(l) {
              var gm = rawMaterials.find(function(x) { return x.code === l.code; });
              return gm ? {
                part_id: gm.code, stock_item_id: gm.code,
                quantity: 1, volume_m3: parseFloat(gm.volume) || 0,
                diameter: gm.diametre, essence: gm.essence
              } : { part_id: l.code, quantity: 1, volume_m3: 0 };
            });
            bo.outputs = items.map(function(it) {
              var vol = (it.volume || 0) * (it.qty || 0);
              return { part_id: it.item, quantity: it.qty, volume_m3: vol, dims: it.dims };
            });
            bo.completed_at = Date.now();
            bo.total_input_volume = totalMpM3;
            bo.total_output_volume = totalWipM3;
            bo.yield_pct = totalMpM3 > 0 ? +((totalWipM3 / totalMpM3) * 100).toFixed(1) : 0;
            localStorage.setItem('charben_build_orders', JSON.stringify(boOrders));
          }
        } catch (e) { errLog('of-manager', 'BuildOrder linkage ofPostSciage', e, 'warn'); }
      }
      o.mp_volume_m3 = totalMpM3;
      o.wip_volume_m3 = totalWipM3;
      TransactionLogger.log({
        type: 'build_order_completed',
        details: {
          order_num: o.orderNum, mp_consumed: launched.length,
          wip_created: items.length, mp_volume_m3: totalMpM3,
          wip_volume_m3: totalWipM3,
          yield_pct: totalMpM3 > 0 ? +((totalWipM3 / totalMpM3) * 100).toFixed(1) : 0
        }
      });
    } catch (e) { errLog('of-manager', 'Stock tracking ofPostSciage', e, 'warn'); }
  }
  // EVENT BUS
  if (typeof EventBus !== 'undefined' && typeof EventBus.publish === 'function') {
    try {
      EventBus.publish(EventBus.Topics.OF_COMPLETED, {
        orderNum: o.orderNum,
        mp_consumed: launched.length,
        wip_created: items.length,
        timestamp: Date.now()
      });
      EventBus.publish(EventBus.Topics.STOCK_CHANGED, {
        type: 'of_completed',
        orderNum: o.orderNum,
        timestamp: Date.now()
      });
    } catch (e) { errLog('of-manager', 'EventBus publish ofPostSciage', e, 'warn'); }
  }
/* ── Rafraîchir la matrice WIP temps réel ── */
if (typeof renderWipMatrix === 'function') renderWipMatrix();
};

/* ─────────────────────────────────────────────
   SUPPRIMÉ le 05/10/2026 — `_ofManager_transferDryLotToPf` (85 lignes)

   Code mort, et pas anodin : c'était un DOUXIÈME exemplaire du transfert
   lot de séchage → stock PF,distinct de celui qui fait réellement le travail.

   Pourquoi mort : le séchage a été absorbé par les produits semi-finis en
   migration V7. `dryingBatches` est désormais un tableau vide en permanence
   (data.js le déclare en dur, data-v7.js le neutralise par alias), donc
   `dryingBatches.find(...)` renvoyait toujours `undefined` et la fonction
   sortait sur son premier `if` — sans jamais rien transférer.

   Pourquoi l'UI n'a rien vu : `module-aliases.js` ne l'exportait nulle part,
   et rebascule les quatre noms globals sur l'implémentation WIP :
       window.transferDryLotToPf = window.transferWipToPf = wipManager.transferWipToPf;
   Le seul point d'appel de l'ancien code était un bloc commenté dans
   `ofPostSciageOutput` (« AUTO SÉCHAGE — DÉSACTIVÉ »).

   On le supprime parce que deux implémentations d'une même étape métier sont
   précisément ce qui a fait perdre du temps sur l'audit de persistance du
   05/10/2026 : on croyait le transfert PF cassé, il ne l'était pas.
   ───────────────────────────────────────────── */

/* ─────────────────────────────────────────────
   EXPORT GLOBAL — wrappers compatibles
   ───────────────────────────────────────────── */

/* ─────────────────────────────────────────────
   soldeChute — la perte de lame d'UNE grume, par soustraction
   `chutesVolume()` déduit l'aire perdue du pavage de la section. C'est une
   MESURE, pas un solde : l'entrée du bilan vient du stock (`gm.volume`, 4
   décimales) alors que les sorties sont recalculées en
   épaisseur × largeur × longueur. Les deux grandeurs diffèrent toujours
   légèrement, et cette différence fuyait du bilan (0,0001 m³ observé sur la
   ligne B). La chute impute ce résidu : c'est la seule valeur qui rend
   l'invariant `entrant = utile + pertes` exact.
   Un solde négatif n'est pas corrigé : il signale une découpe qui sort plus que
   la grume entrée, et doit rester visible.
   ───────────────────────────────────────────── */

window._ofManager_soldeChute = function soldeChute(grumeVol, volumesSortants) {
  function r4(n) { return +parseFloat(n).toFixed(4); }
  var entrant = parseFloat(grumeVol) || 0;
  var sorties = 0;
  if (Array.isArray(volumesSortants)) {
    for (var i = 0; i < volumesSortants.length; i++) {
      var v = parseFloat(volumesSortants[i]);
      if (isFinite(v)) sorties += v;
    }
  }
  return r4(entrant - r4(sorties));
};

window._ofManager_importGrumeToWip = function(o, grumeCode) {
  if (!o || !grumeCode) return;
  if (!o._importedGrumes) o._importedGrumes = [];
  if (o._importedGrumes.indexOf(grumeCode) !== -1) return;
  if (typeof wipProducts === 'undefined') return;
  var MM = (typeof window !== 'undefined') ? window.mouvementsManager : null;
  if (!MM || typeof MM.enregistrer !== 'function') {
    errLog('of-manager', 'importGrumeToWip', 'module mouvements-manager absent — registre non alimenté', 'warn');
  }
  var gm = rawMaterials.find(function(x) { return x.code === grumeCode; });
  var L = 0;
  if (o.pieceLength) { L = parseFloat(o.pieceLength); }
  else if (gm) { L = (parseFloat(gm.longueur) || 0) * 1000; }
  if (!o.pieceLength && L > 0) o.pieceLength = Math.round(L);
  var base = JSON.parse(JSON.stringify(o));
  base.producedQty = 1;
  base.qty = 1;
  /* Cohérence essence: si la grume a une essence renseignée différente de l'OF,
     construire les items avec l'essence de la grume (gammes propres) */
  var gEssNorm = String(rawMaterials.find(function(x) { return x.code === grumeCode; }) ? rawMaterials.find(function(x) { return x.code === grumeCode; }).essence : '').trim().toLowerCase();
  if (gEssNorm === 'pin' || gEssNorm === 'pine') gEssNorm = 'pin';
  else if (gEssNorm === 'épicéa' || gEssNorm === 'spruce' || gEssNorm === 'epicea') gEssNorm = 'spruce';
  else gEssNorm = '';
  if (gEssNorm) {
    var ofEssNorm = String(o.essence || 'spruce').toLowerCase();
    if (ofEssNorm === 'pin' || ofEssNorm === 'pine') ofEssNorm = 'pin';
    else if (ofEssNorm === 'spruce' || ofEssNorm === 'épicéa') ofEssNorm = 'spruce';
    else ofEssNorm = '';
    if (gEssNorm !== ofEssNorm) base.essence = gEssNorm;
  }
  var items = window._ofManager_buildOfSemiItems(base, { perGrume: true });
  if (!items.length) {
    errLog('of-manager', 'importGrumeToWip', 'Aucun item pour OF ' + o.orderNum + ' — vérifiez centre/lateraux/gamme', 'warn');
    return;
  }
  /* ── Registre des mouvements : une ligne immuable par opération ── */
  var ofLigne = (typeof dashboardRenderer !== 'undefined' && typeof dashboardRenderer.ofLine === 'function')
    ? dashboardRenderer.ofLine(o) : 'A';
  var mouvements = [];
  var grumeVol = gm ? (parseFloat(gm.volume) || 0) : 0;
  var grumeDia = gm ? (parseFloat(gm.diametre) || 0) : 0;
  var grumeEss = gm ? (gm.essence || '') : (o.essence || '');
  var grumeLongM = gm ? (parseFloat(gm.longueur) || 0) : 0;
  if (grumeVol > 0 && MM && typeof MM.poste === 'function') {
    mouvements.push({
      ofNum: o.orderNum || '', machine: MM.poste(ofLigne, 'A1'),
      grumeCode: grumeCode, grumeDia: grumeDia, grumeEss: grumeEss, grumeVol: grumeVol,
      longueurM: grumeLongM,
      nature: 'GRUME_ENTREE', item: '', qty: 1, volume: grumeVol, stock: 'CONSOMME'
    });
  }
  var wipCount = 0;
  var sortiesVol = 0;   /* cumul des volumes, chacun déjà arrondi à 4 décimales */
  items.forEach(function(it) {
    if (!it || !it.item || (it.qty || 0) <= 0) return;
    var ep = it.dims ? (it.dims.ep || 0) : 0;
    var larg = it.dims ? (it.dims.b || 0) : 0;
    if (ep <= 0 || larg <= 0) return;
    var longueur = L > 0 ? Math.round(L) : 0;
    var ref = 'SF-' + Date.now().toString(36).slice(-4) + wipCount;
    var unitVol = (ep > 0 && larg > 0 && longueur > 0) ? +((ep / 1000) * (larg / 1000) * (longueur / 1000)).toFixed(6) : 0;
    var volumeTotal = +(unitVol * (it.qty || 0)).toFixed(4);
    sortiesVol = +((sortiesVol + volumeTotal).toFixed(4));
    /* Poste émetteur : les dosses sortent de A4, les autres de A2 ou A3.
       sfMachinePath() renvoie 'A2'/'A3' en dur — poste() remet le préfixe de ligne,
       sinon un OF de la ligne B serait imputé à B3 pour une pièce faite en A3. */
    var estDosse = !!it.isDosse;
    var poste = (MM && typeof MM.poste === 'function')
      ? MM.poste(ofLigne, estDosse ? 'A4' : it.machine)
      : ofLigne + (estDosse ? '4' : String(it.machine || '2').slice(-1));
    wipProducts.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + wipCount,
      ref: ref, type: (it.item || 'SF'), essence: o.essence || 'Pin',
      epaisseur: ep, largeur: larg, longueur: longueur,
      qte: it.qty || 0, volume: volumeTotal,
      ofNum: o.orderNum || '', grumeCode: grumeCode,
      line: ofLigne, machine: poste, isDosse: estDosse,
      statut: 'EN_WIP',
      createdAt: new Date().toISOString()
    });
    /* ── Écriture du registre : SEMI_FINI ou DOSSE ── */
    if (MM && typeof MM.enregistrer === 'function') {
      mouvements.push({
        ofNum: o.orderNum || '', machine: poste,
        grumeCode: grumeCode, grumeDia: grumeDia, grumeEss: grumeEss, grumeVol: grumeVol,
        nature: estDosse ? 'DOSSE' : 'SEMI_FINI',
        item: it.item, epaisseur: ep, largeur: larg, longueur: longueur,
        qty: it.qty || 0, volume: volumeTotal, stock: 'WIP'
      });
    }
    wipCount++;
  });
  /* ── Pertes de lame : le SOLDE de la grume, pas une formule.
        `chutesVolume()` déduisait la perte du pavage de la section ; il reste
        exporté par le registre mais n'est plus appelé ici. La ligne écrite est
        la soustraction — sans elle le bilan ne boucle pas. ── */
  var soldeChute = window._ofManager_soldeChute(grumeVol, [sortiesVol]);
  if (grumeVol > 0 && soldeChute > 0 && MM && typeof MM.poste === 'function') {
    mouvements.push({
      ofNum: o.orderNum || '', machine: MM.poste(ofLigne, 'A1'),
      grumeCode: grumeCode, grumeDia: grumeDia, grumeEss: grumeEss, grumeVol: grumeVol,
      nature: 'CHUTE', item: '', qty: 0, volume: soldeChute, stock: 'PERTE'
    });
  }
  if (wipCount > 0) {
    saveToStorage('charben_wip', wipProducts);
    if (typeof fsSave === 'function') fsSave('wip', wipProducts);
  }
  if (mouvements.length && MM && typeof MM.enregistrer === 'function') {
    var ajoutes = MM.enregistrer(mouvements, ofLigne);
    if (ajoutes > 0) {
      addAuditLog('OF ' + o.orderNum + ' — ' + ajoutes + ' mouvement(s) enregistré(s) pour la grume ' + grumeCode);
    }
  }
  o._importedGrumes.push(grumeCode);
  safeSave(STORAGE_KEYS.orders, orders);
  fsSave('orders', orders);
  if (typeof renderWipList === 'function') renderWipList();
  /* Rafraîchissement KPI après ÉCRITURE du registre : le canal canonique
     (importGrumeToWip) est l'unique point d'alimentation de mouvementsManager.
     La grille « Analyse de production » vit désormais dans la vue Traçabilité
     (trace-api.js → renderTraceProduction), rafraîchie à l'ouverture/polling de
     l'écran ; on rafraîchit aussi le KPI dashboard par sécurité (null-safe : no-op
     si l'élément dashboard n'existe pas / onglet non affiché). */
  if (typeof renderDashboardKPIs === 'function') renderDashboardKPIs();
};

window.ofManager = {
  createOfFromSpec: window._ofManager_createOfFromSpec,
  buildOfSemiItems: window._ofManager_buildOfSemiItems,
  sciagePiecesPerGrume: window._ofManager_sciagePiecesPerGrume,
  ofPostSciageOutput: window._ofManager_ofPostSciageOutput,
  importGrumeToWip: window._ofManager_importGrumeToWip
};
