/**
 * WIP-MANAGER.JS — Produits semi-finis (WIP : Work In Progress)
 * Remplace l'ancien drying-manager.js (supprimé le 05/10/2026). Gère les pièces issues du sciage en attente de séchage.
 * Globals: wipProducts, rawMaterials, orders, finishedGoods, saveToStorage, fsSave,
 *          addAuditLog, showModal, showToast, escapeHtml, genGrumeScanCode,
 *          pfScanCodeTaken, dryingShrinkByEssence, pfTypeFromDims,
 *          StockManager, TransactionLogger, EventBus, renderLucide
 */
'use strict';

var WIP_STORAGE_KEY = 'charben_wip';
var WIP_FS_KEY = 'wip';

/* ─────────────────────────────────────────────
   nextWipCode — génération code monotone SF-YYYY-NNN
   ───────────────────────────────────────────── */
function nextWipCode() {
  var y = new Date().getFullYear();
  var prefix = 'SF-' + y + '-';
  var maxN = 0;
  var re = /^SF-(\d{4})-(\d+)$/;
  (typeof wipProducts !== 'undefined' ? wipProducts : []).forEach(function(p) {
    if (!p || !p.ref) return;
    var m = String(p.ref).trim().match(re);
    if (m) {
      var n = parseInt(m[2], 10);
      if (n > maxN) maxN = n;
    }
  });
  var c;
  try { c = parseInt(localStorage.getItem('charben_wip_counter') || '0', 10); } catch (e) { c = 0; }
  if (!c || isNaN(c)) c = 0;
  if (c > maxN) maxN = c;
  var next = maxN + 1;
  var code = prefix + String(next).padStart(3, '0');
  while ((typeof wipProducts !== 'undefined' ? wipProducts : []).some(function(p) { return String(p.ref || '') === code; })) {
    next += 1;
    code = prefix + String(next).padStart(3, '0');
  }
  try { localStorage.setItem('charben_wip_counter', String(next)); } catch (e) {}
  return code;
}

/* ─────────────────────────────────────────────
   addWipProduct — formulaire d'ajout
   ───────────────────────────────────────────── */
window._wipManager_addWipProduct = function() {
  var type = document.getElementById('wipType').value;
  var essence = document.getElementById('wipEssence').value;
  var ep = parseFloat(document.getElementById('wipEp').value);
  var larg = parseFloat(document.getElementById('wipLarg').value);
  var longueur = parseFloat(document.getElementById('wipLong').value);
  var qte = parseInt(document.getElementById('wipQte').value, 10) || 0;
  var ofNum = (document.getElementById('wipOf').value || '').trim();
  var msgEl = document.getElementById('wipMsg');
  if (!ep || !larg || !longueur || !qte) {
    msgEl.innerHTML = '<span style="color:var(--danger);">Remplissez épaisseur, largeur, longueur et quantité.</span>';
    return;
  }
  var ref = nextWipCode();
  var volume = (ep / 1000) * (larg / 1000) * longueur * qte;
  volume = +volume.toFixed(4);
  var item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    ref: ref, type: type, essence: essence,
    epaisseur: ep, largeur: larg, longueur: longueur,
    qte: qte, volume: volume,
    ofNum: ofNum, grumeCode: '',
    statut: 'EN_WIP',
    createdAt: new Date().toISOString()
  };
  wipProducts.unshift(item);
  saveToStorage(WIP_STORAGE_KEY, wipProducts);
  if (typeof fsSave === 'function') fsSave(WIP_FS_KEY, wipProducts);
  addAuditLog('Produit semi-fini enregistré: ' + ref + ' (' + type + ' ' + essence + ' ' + ep + 'x' + larg + 'mm L=' + longueur + 'm × ' + qte + ' = ' + volume + ' m³)');
  msgEl.innerHTML = '<span style="color:var(--success);">SF ' + escapeHtml(ref) + ' enregistré (' + qte + ' pièces, ' + volume + ' m³)</span>';
  document.getElementById('wipEp').value = '';
  document.getElementById('wipLarg').value = '';
  document.getElementById('wipLong').value = '';
  document.getElementById('wipQte').value = '';
  document.getElementById('wipVolumePreview').textContent = '—';
  renderWipList();
};

/* ─────────────────────────────────────────────
   previewWipVolume — calcul volume temps réel
   ───────────────────────────────────────────── */
window._wipManager_previewVolume = function() {
  var ep = parseFloat(document.getElementById('wipEp').value) || 0;
  var larg = parseFloat(document.getElementById('wipLarg').value) || 0;
  var longueur = parseFloat(document.getElementById('wipLong').value) || 0;
  var qte = parseInt(document.getElementById('wipQte').value, 10) || 1;
  var el = document.getElementById('wipVolumePreview');
  if (el) {
    if (ep > 0 && larg > 0 && longueur > 0) {
      var vol = (ep / 1000) * (larg / 1000) * longueur * qte;
      el.textContent = vol.toFixed(4);
    } else {
      el.textContent = '—';
    }
  }
};

/* ─────────────────────────────────────────────
   toggleWipStatus — DESACTIVÉ (opération de séchage retirée)
   ───────────────────────────────────────────── */
window._wipManager_toggleWipStatus = function(id) {
  showToast('Opération de séchage désactivée', 'info');
};

/* ─────────────────────────────────────────────
   retraitSechage — fraction de retrait au séchage pour une essence.
   PHASE P3 : priorité à la base (EssenceAPI → GET /essences, champ
   essence.retrait_sechage) ; repli sur la carte locale dryingShrinkByEssence
   (data.js) quand l'API est indisponible ou l'essence absente du référentiel.
   Normalise casse + accents, alias (oak→chene, épicéa→spruce, pine→pin),
   repli other ; 0 si aucune source ne fournit de taux.
   ───────────────────────────────────────────── */
window._wipManager_retraitSechage = function(essence) {
  if (typeof EssenceAPI !== 'undefined' && typeof EssenceAPI.retraitSechage === 'function') {
    try {
      var fromDb = EssenceAPI.retraitSechage(essence);
      if (fromDb !== null && fromDb !== undefined) return fromDb;
    } catch (e) { errLog('wip-manager', 'EssenceAPI.retraitSechage', e, 'warn'); }
  }
  var map = (typeof dryingShrinkByEssence !== 'undefined') ? dryingShrinkByEssence : null;
  if (!map) return 0;
  var k = String(essence == null ? '' : essence).toLowerCase().trim();
  if (typeof k.normalize === 'function') k = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (k === 'oak') k = 'chene';
  else if (k === 'epicea' || k === 'sapin') k = 'spruce';
  else if (k === 'pine') k = 'pin';
  var r = parseFloat(map[k]);
  if (!(r >= 0)) r = parseFloat(map.other);
  return (r >= 0) ? r : 0;
};

/* ─────────────────────────────────────────────
   transferWipToPf — transférer un SF vers stock PF
   DÉCISION CEO 08/10/2026 : le volume entrant en PF subit le retrait de
   séchage — volume PF = volume WIP × (1 − r), dimensions inchangées.
   ───────────────────────────────────────────── */
window._wipManager_transferWipToPf = function(id) {
  var p = wipProducts.find(function(x) { return x.id === id; });
  if (!p) { showToast('Produit introuvable', 'warning'); return; }
  if (p.statut === 'TRANSFERE') { showToast('Déjà transféré', 'warning'); return; }
  var retrait = window._wipManager_retraitSechage(p.essence);
  var volApresRetrait = +(p.volume * (1 - retrait)).toFixed(4);
  var msgRetrait = retrait > 0
    ? ' → ' + volApresRetrait + ' m³ après retrait de ' + Math.round(retrait * 100) + ' %' : '';
  showModal('Transférer SF "' + escapeHtml(p.ref) + '" vers le stock PF ?', p.qte + ' pièce(s) (' + p.volume + ' m³' + msgRetrait + ') seront entrées au stock des produits finis.', '📦', function() {
    var unitVol = (p.epaisseur > 0 && p.largeur > 0 && p.longueur > 0) ? +((p.epaisseur / 1000) * (p.largeur / 1000) * (p.longueur / 1000)).toFixed(6) : 0;
    var unitVolSec = +(unitVol * (1 - retrait)).toFixed(6);
    var qtySec = p.qte;
    var type = (typeof pfTypeFromDims === 'function') ? pfTypeFromDims(p.epaisseur, p.largeur) : (p.type || 'Planche');
    for (var k = 0; k < qtySec; k++) {
      var sc = genGrumeScanCode();
      for (var tries2 = 0; tries2 < 20 && pfScanCodeTaken(sc); tries2++) sc = genGrumeScanCode();
      finishedGoods.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + k,
        code: null, type: type, essence: p.essence,
        epaisseur: p.epaisseur, largeur: p.largeur, longueur: p.longueur, qte: 1, volume: unitVolSec,
        scanCode: sc,
        statut: 'EN_STOCK', sfRef: p.ref, ofNum: p.ofNum,
        origine: 'WIP', createdAt: new Date().toISOString()
      });
    }
    p.statut = 'TRANSFERE';
    p.transferredAt = new Date().toISOString();
    saveToStorage(WIP_STORAGE_KEY, wipProducts);
    if (typeof fsSave === 'function') fsSave(WIP_FS_KEY, wipProducts);
    saveToStorage('charben_stock', finishedGoods);
    if (typeof fsSave === 'function') fsSave('stock', finishedGoods);
    addAuditLog('SF ' + p.ref + ' transféré vers stock PF (' + qtySec + ' pcs' + (retrait > 0 ? ', retrait ' + Math.round(retrait * 100) + ' %' : '') + ')');
    if (typeof StockManager !== 'undefined' && typeof TransactionLogger !== 'undefined') {
      try {
        TransactionLogger.log({ type: 'transfer_to_pf', details: { sf_ref: p.ref, of_num: p.ofNum, items_transferred: qtySec, retrait_sechage: retrait, volume_pf_m3: +(unitVolSec * qtySec).toFixed(4) } });
      } catch (e) { errLog('wip-manager', 'Stock tracking transferWipToPf', e, 'warn'); }
    }
    if (typeof EventBus !== 'undefined' && typeof EventBus.publish === 'function') {
      try {
        EventBus.publish(EventBus.Topics.STOCK_CHANGED, { type: 'transfer_to_pf', sfRef: p.ref, timestamp: Date.now() });
      } catch (e) { errLog('wip-manager', 'EventBus transferWipToPf', e, 'warn'); }
    }
    renderWipList();
    if (typeof renderProduitsFinis === 'function') renderProduitsFinis();
    showToast('SF transféré vers stock PF', 'success');
  });
};

/* ─────────────────────────────────────────────
   deleteWipProduct — supprimer un SF
   ───────────────────────────────────────────── */
window._wipManager_deleteWipProduct = function(id) {
  var p = wipProducts.find(function(x) { return x.id === id; });
  showModal('Supprimer le SF "' + (p ? p.ref : '') + '" ?', 'Cette action est irréversible.', '🗑️', function() {
    wipProducts = wipProducts.filter(function(x) { return x.id !== id; });
    saveToStorage(WIP_STORAGE_KEY, wipProducts);
    if (typeof fsSave === 'function') fsSave(WIP_FS_KEY, wipProducts);
    addAuditLog('Produit semi-fini supprimé: ' + (p ? p.ref : ''));
    renderWipList();
    showToast('SF supprimé', 'info');
  });
};

/* ─────────────────────────────────────────────
   createWipFromOf — import des semi-items d'un OF réalisé
   ───────────────────────────────────────────── */
window._wipManager_createWipFromOf = function() {
  var sel = document.getElementById('wipOfImport');
  if (!sel || !sel.value) { showToast('Sélectionnez un OF', 'warning'); return; }
  var o = orders.find(function(x) { return x.orderNum === sel.value; });
  if (!o || !o.semiItems || !o.semiItems.length) { showToast('Cet OF n\'a pas de produits semi-finis', 'warning'); return; }
  var count = 0;
  o.semiItems.forEach(function(it) {
    if (!it || !it.item || (it.qty || 0) <= 0) return;
    var ep = it.dims ? (it.dims.ep || 0) : 0;
    var larg = it.dims ? (it.dims.b || 0) : 0;
    var longueur = parseFloat(o.pieceLength) || 0;
    var ref = nextWipCode();
    var unitVol = (ep > 0 && larg > 0 && longueur > 0) ? +((ep / 1000) * (larg / 1000) * (longueur / 1000)).toFixed(6) : 0;
    var item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + count,
      ref: ref, type: (it.item || 'SF'), essence: o.essence || 'Pin',
      epaisseur: ep, largeur: larg, longueur: longueur,
      qte: it.qty || 0, volume: +(unitVol * (it.qty || 0)).toFixed(4),
      ofNum: o.orderNum || '', grumeCode: '',
      statut: 'EN_WIP',
      createdAt: new Date().toISOString()
    };
    wipProducts.unshift(item);
    count++;
  });
  if (count > 0) {
    saveToStorage(WIP_STORAGE_KEY, wipProducts);
    if (typeof fsSave === 'function') fsSave(WIP_FS_KEY, wipProducts);
    addAuditLog('Import ' + count + ' SF depuis OF ' + o.orderNum);
    renderWipList();
    showToast(count + ' produits semi-finis importés depuis ' + o.orderNum, 'success');
    sel.value = '';
  }
};

/* ─────────────────────────────────────────────
   renderWipList — inventaire des produits semi-finis
   ───────────────────────────────────────────── */
window._wipManager_renderWipList = function() {
  var el = document.getElementById('wipList');
  if (!el) return;
  var filterEl = document.getElementById('wipFilterStatus');
  var searchEl = document.getElementById('wipFilterSearch');
  var filter = filterEl ? filterEl.value : 'all';
  var search = searchEl ? searchEl.value.trim().toLowerCase() : '';
  var items = wipProducts;
  if (filter !== 'all') items = items.filter(function(p) { return p.statut === filter; });
  if (search) items = items.filter(function(p) {
    return (p.ref || '').toLowerCase().indexOf(search) !== -1
      || (p.essence || '').toLowerCase().indexOf(search) !== -1
      || (p.type || '').toLowerCase().indexOf(search) !== -1
      || (p.ofNum || '').toLowerCase().indexOf(search) !== -1;
  });
  if (items.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">Aucun produit semi-fini</div></div>';
    return;
  }
  var html = '<div class="dt-table dt-table-full"><div class="dt-head dt-head-full">'
    + '<span>Réf</span><span>Type</span><span>Essence</span><span>Dimensions</span><span>Qté</span><span>Volume</span><span>Statut</span><span style="text-align:right;">⋮</span>'
    + '</div>';
  var statusLabels = { 'EN_WIP': 'En WIP', 'TRANSFERE': 'Transféré PF' };
  var statusClasses = { 'EN_WIP': 'badge-drying', 'TRANSFERE': 'badge-done' };
  items.forEach(function(p) {
    html += '<div class="dt-row">';
    html += '<span class="mp-dt-ref"><b>' + escapeHtml(p.ref) + '</b>';
    if (p.ofNum) html += '<div style="font-size:10px;color:var(--text-muted);">OF ' + escapeHtml(p.ofNum) + '</div>';
    html += '</span>';
    html += '<span class="mp-dt-type">' + escapeHtml(p.type || '—') + '</span>';
    html += '<span class="mp-dt-type">' + escapeHtml(p.essence || '—') + '</span>';
    html += '<span style="font-size:11px;">' + (p.epaisseur || 0) + '×' + (p.largeur || 0) + 'mm · ' + (p.longueur || 0) + 'm</span>';
    html += '<span style="font-weight:700;">' + (p.qte || 0) + ' pcs</span>';
    html += '<span class="mp-dt-vol" style="font-weight:600;">' + (p.volume || 0) + ' m³</span>';
    html += '<span class="mp-dt-stat"><span class="badge ' + (statusClasses[p.statut] || 'badge-drying') + '">' + (statusLabels[p.statut] || p.statut) + '</span></span>';
    html += '<span class="mp-dt-actions" style="text-align:right;white-space:nowrap;">';
    if (p.statut === 'EN_WIP') {
      html += '<button class="btn btn-sm btn-primary" onclick="transferWipToPf(\'' + p.id + '\')" title="Transférer vers PF">' + MI('inventory', 'mi-sm') + ' PF</button> ';
    }
    html += '<button class="btn btn-sm btn-danger" onclick="deleteWipProduct(\'' + p.id + '\')" data-perm="sechage:delete" title="Supprimer">' + MI('delete', 'mi-sm') + '</button>';
    html += '</span></div>';
  });
  html += '</div>';
  el.innerHTML = html;
};

/* ─────────────────────────────────────────────
   renderWipOfSelect — peuple le select OF pour import
   ───────────────────────────────────────────── */
window._wipManager_renderWipOfSelect = function() {
  var sel = document.getElementById('wipOfImport');
  if (!sel) return;
  var choices = orders.filter(function(o) { return o.status === 'realise' && o.semiItems && o.semiItems.length; });
  sel.innerHTML = '<option value="">— Aucun OF —</option>' + choices.map(function(x) {
    return '<option value="' + escapeHtml(x.orderNum) + '">' + escapeHtml(x.orderNum) + ' — ' + escapeHtml(x.essence || '') + ' (' + x.semiItems.length + ' réf)</option>';
  }).join('');
};

/* ─────────────────────────────────────────────
   MATRICE DE SCIAGE — dimensions standard H×B
   Colonnes B (mm) : 75 100 125 150 175 200 225 250
   Lignes H (mm) : 16 19 25 32 38 44 47 50 63 75
   Chaque cellule : qté déjà sciée temps réel (SB / CC / SB-CC)
   ───────────────────────────────────────────── */
var WIP_MATRIX_HEIGHTS_DEFAULT = [16, 19, 25, 32, 38, 44, 47, 50, 63, 75];
var WIP_MATRIX_WIDTHS_DEFAULT = [75, 100, 125, 150, 175, 200, 225, 250];

window._wipManager_renderWipMatrix = function() {
  var el = document.getElementById('wipMatrix');
  if (!el) return;
  var essFilter = (document.getElementById('wipMatrixEssence') || {}).value || 'all';

  var cellQty = {};   /* key ep+'x'+b → { qty, cc: nbCC, sb: nbSB } */
  var totalPieces = 0;
  var totalM3 = 0;
  var activeOfs = 0;

  orders.forEach(function(o) {
    if (!o || !o.orderNum || o.status === 'annule') return;
    var line = dashboardRenderer.ofLine(o);
    var launched = [];
    try { launched = lineLaunchedForOf(line, o.orderNum) || []; } catch (e) {}
    if (!launched.length) return;
    var launchedCount = launched.length;
    activeOfs++;
    var ess = o.essence || 'Pin';
    if (essFilter !== 'all' && ess !== essFilter) return;
    var base = JSON.parse(JSON.stringify(o));
    base.producedQty = 1;
    base.qty = 1;
    var piecesPerGrume = buildOfSemiItems(base, { perGrume: true });
    piecesPerGrume.forEach(function(it) {
      if (!it || !it.dims) return;
      var ep = it.dims.ep || 0;
      var b = it.dims.b || 0;
      var isCtr = !!it.dims.central;
      var qty = Math.round((it.qty || 0) * launchedCount);
      var key = ep + 'x' + b;
      if (!cellQty[key]) cellQty[key] = { qty: 0, cc: 0, sb: 0, gamme: gammeClass(ess, ep, b) || null };
      cellQty[key].qty += qty;
      if (isCtr) cellQty[key].cc += qty; else cellQty[key].sb += qty;
      totalPieces += qty;
      totalM3 += (it.volume || 0) * qty;
    });
  });

  /* KPI summary */
  var kpiEl = document.getElementById('wipMatrixKpi');
  if (kpiEl) {
    kpiEl.innerHTML = ''
      + '<div class="kd-sf-rag-lab"><span class="kd-lp-yk-val" style="font-size:16px;">' + totalPieces + '</span> pcs sciés</div>'
      + '<div class="kd-sf-rag-lab"><span class="kd-lp-yk-val" style="font-size:16px;">' + totalM3.toFixed(2) + '</span> m³ WIP</div>'
      + '<div class="kd-sf-rag-lab"><span class="kd-lp-yk-val" style="font-size:16px;">' + activeOfs + '</span> OF actifs</div>';
  }

  if (!Object.keys(cellQty).length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">Aucune grume lancée — la matrice se remplit en temps réel dès le sciage</div></div>';
    return;
  }

  /* ── Matrice dynamique : inclure les largeurs réelles des OF ── */
  var actualHeights = {};
  var actualWidths = {};
  WIP_MATRIX_HEIGHTS_DEFAULT.forEach(function(h) { actualHeights[h] = true; });
  WIP_MATRIX_WIDTHS_DEFAULT.forEach(function(b) { actualWidths[b] = true; });
  Object.keys(cellQty).forEach(function(key) {
    var parts = key.split('x');
    var h = parseInt(parts[0], 10);
    var b = parseInt(parts[1], 10);
    if (h) actualHeights[h] = true;
    if (b) actualWidths[b] = true;
  });
  var heights = Object.keys(actualHeights).map(Number).sort(function(a, b) { return a - b; });
  var widths = Object.keys(actualWidths).map(Number).sort(function(a, b) { return a - b; });

  function cellClass(gamme) {
    if (gamme === 'SB') return 'wip-mx-sb';
    if (gamme === 'CC') return 'wip-mx-cc';
    if (gamme === 'SB/CC') return 'wip-mx-both';
    return 'wip-mx-off';
  }

  var html = '<table class="wip-mx-table">';
  html += '<thead><tr><th class="wip-mx-corner">H\\B (mm)</th>';
  widths.forEach(function(b) { html += '<th>' + b + '</th>'; });
  html += '</tr></thead><tbody>';
  heights.forEach(function(h) {
    html += '<tr><th class="wip-mx-rowh">' + h + '</th>';
    widths.forEach(function(b) {
      var key = h + 'x' + b;
      var c = cellQty[key];
      var gamme = c ? c.gamme : gammeClass('Pin', h, b) || null;
      var gammeLabel = gamme === 'SB/CC' ? 'SB/CC' : (gamme || '—');
      if (c) {
        html += '<td class="' + cellClass(gamme) + (gamme === 'SB/CC' ? ' wip-mx-hot' : '') + '">'
          + '<b>' + c.qty + '</b><i>' + gammeLabel + '</i></td>';
      } else {
        html += '<td class="wip-mx-off"><span class="wip-mx-dash">' + (gamme ? '0' : '·') + '</span><i>' + (gamme || '&nbsp;') + '</i></td>';
      }
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  html += '<div class="wip-mx-legend">'
    + '<span><i class="wip-mx-dot wip-mx-cc"></i> CC (Centre)</span>'
    + '<span><i class="wip-mx-dot wip-mx-sb"></i> SB (Side Board)</span>'
    + '<span><i class="wip-mx-dot wip-mx-both"></i> SB/CC (mixte)</span>'
    + '<span><i class="wip-mx-dot wip-mx-off"></i> Hors gamme</span>'
    + '</div>';
  el.innerHTML = html;
};

/* ─────────────────────────────────────────────
   EXPORT GLOBAL
   ───────────────────────────────────────────── */
window.wipManager = {
  addWipProduct: window._wipManager_addWipProduct,
  previewVolume: window._wipManager_previewVolume,
  toggleWipStatus: window._wipManager_toggleWipStatus,
  transferWipToPf: window._wipManager_transferWipToPf,
  retraitSechage: window._wipManager_retraitSechage,
  deleteWipProduct: window._wipManager_deleteWipProduct,
  createWipFromOf: window._wipManager_createWipFromOf,
  renderWipList: window._wipManager_renderWipList,
  renderWipOfSelect: window._wipManager_renderWipOfSelect,
  renderWipMatrix: window._wipManager_renderWipMatrix
};
