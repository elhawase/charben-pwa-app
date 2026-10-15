/**
 * UI-RENDERER.JS — Rendus des listes et dashboards
 * Scierie Charben — Extraits depuis app.js
 * Globals: rawMaterials, finishedGoods, orders, dryingBatches,
 *          escapeHtml, saveToStorage, fsSave, addAuditLog,
 *          ensureGrumeScanCodes, ensurePfScanCodes,
 *          renderStockTable, renderOrdersList, renderDashboardKPIs,
 *          renderDisquesAll, renderGammePin, updateProcOfInfo,
 *          updateSyncBanner, renderMiscSettings, renderAccountCard,
 *          renderUserList, renderShifts, renderAuditLogs,
 *          renderQualityList, renderPlanningList, renderProdPlanList,
 *          renderAlertsPanel, renderUpcomingTasksPanel, renderPlanningRate,
 *          ensureFardeauxScanCodes, renderFardeauxList, ensureGrumeScanCodes
 */
'use strict';

function _uiEssKey(v) {
  if (typeof window.grumeEssKey === 'function') return window.grumeEssKey(v);
  try { return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); }
  catch (e) { return String(v || '').toLowerCase(); }
}
function _uiEssEq(a, b) { return _uiEssKey(a) === _uiEssKey(b); }
function _uiFmtVol(v) {
  if (typeof window.fmtVol === 'function') return window.fmtVol(v);
  if (v === null || v === undefined || isNaN(Number(v))) return '—';
  return Number(v).toFixed(4);
}
function _uiRefillEssenceSelect() {
  var el = document.getElementById('gdsMpFilterEssence');
  if (!el) return;
  var prev = el.value;
  var labels = [];
  var byKey = {};
  function add(lab) {
    if (lab === null || lab === undefined || String(lab) === '') return;
    var k = _uiEssKey(lab);
    if (byKey[k]) return;
    byKey[k] = true;
    labels.push(String(lab));
  }
  add('Pin'); add('Épicéa'); add('Chêne');
  var i, r;
  for (i = 0; i < rawMaterials.length; i++) { r = rawMaterials[i]; if (r) add(r.essence); }
  var html = '<option value="all">Toutes essences</option>';
  for (i = 0; i < labels.length; i++) {
    var v = labels[i];
    html += '<option value="' + String(v).replace(/"/g, '&quot;') + '">' + escapeHtml(v) + '</option>';
  }
  el.innerHTML = html;
  var chosen = 'all';
  var opts = el.options;
  for (i = 0; i < opts.length; i++) { if (_uiEssEq(opts[i].value, prev)) { chosen = opts[i].value; break; } }
  el.value = chosen;
}

/* ─────────────────────────────────────────────
   renderGrumesStats — KPI grumes (MP)
   Extrait: app.js lignes 4910-4933
   ───────────────────────────────────────────── */

window._uiRenderer_renderGrumesStats = function(essenceFilter, statutFilter) {
  var el = document.getElementById('gdsMpStats');
  if (!el) return;
  var list = rawMaterials;
  if (essenceFilter && essenceFilter !== 'all') list = list.filter(function(r) { return _uiEssEq(r.essence, essenceFilter); });
  if (statutFilter && statutFilter !== 'all') list = list.filter(function(r) { return r.statut === statutFilter; });
  var totalVol = list.reduce(function(a, r) { return a + (r.volume || 0); }, 0);
  var dispo = list.filter(function(r) { return r.statut === 'EN_STOCK'; });
  var dispoVol = dispo.reduce(function(a, r) { return a + (r.volume || 0); }, 0);
  var value = list.reduce(function(a, r) { return a + ((r.volume || 0) * (r.prixM3 || 0)); }, 0);
  var byEss = {};
  list.forEach(function(r) { byEss[r.essence] = (byEss[r.essence] || 0) + (r.volume || 0); });
  var essStr = Object.keys(byEss).map(function(k) { return escapeHtml(k) + ' ' + byEss[k].toFixed(2) + ' m³'; }).join(' · ');
  var badge = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:12px;">';
  badge += '<span class="badge badge-stock">Disponible</span><span class="badge badge-maintenance">Affectée / sciage</span><span class="badge badge-consumed">Sciée</span></div>';
  el.innerHTML = '<div class="kpi-grid-v2" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:10px;">'
    + '<div class="kpi-card-v2"><div class="kpi-value">' + list.length + '</div><div class="kpi-label">Grumes</div></div>'
    + '<div class="kpi-card-v2"><div class="kpi-value">' + totalVol.toFixed(2) + '</div><div class="kpi-label">m³ total</div></div>'
    + '<div class="kpi-card-v2"><div class="kpi-value">' + dispoVol.toFixed(2) + '</div><div class="kpi-label">m³ dispo</div></div>'
    + (value ? '<div class="kpi-card-v2"><div class="kpi-value">' + value.toFixed(0) + '</div><div class="kpi-label">Valeur (DA)</div></div>' : '')
    + '</div>'
    + (essStr ? '<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">Par essence : <strong>' + essStr + '</strong></div>' : '')
    + badge;
};

/* ─────────────────────────────────────────────
   renderGrumes — liste matières premières
   Extrait: app.js lignes 4935-4992
   ───────────────────────────────────────────── */

window._uiRenderer_renderGrumes = function() {
  ensureGrumeScanCodes();
  var el = document.getElementById('gdsMpList');
  if (!el) return;
  _uiRefillEssenceSelect();
  var filter = (document.getElementById('gdsMpFilter').value || '').toLowerCase();
  var essFilter = document.getElementById('gdsMpFilterEssence').value;
  var stEl = document.getElementById('gdsMpFilterStatut');
  var stFilter = stEl ? stEl.value : 'all';
  var items = rawMaterials;
  if (essFilter !== 'all') items = items.filter(function(r) { return _uiEssEq(r.essence, essFilter); });
  if (stFilter !== 'all') items = items.filter(function(r) { return r.statut === stFilter; });
  if (filter) items = items.filter(function(r) { return r.code.toLowerCase().includes(filter) || r.essence.toLowerCase().includes(filter) || String(r.fournisseur || '').toLowerCase().includes(filter); });
  window._uiRenderer_renderGrumesStats(essFilter, stFilter);
  if (items.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🪵</div><div class="empty-state-text">Aucune grume en stock</div></div>';
    return;
  }
  items = items.slice().sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
  var html = '<div class="dt-table dt-table-full"><div class="dt-head dt-head-full">'
    + '<span>Date</span>'
    + '<span>Réf</span>'
    + '<span>Type</span>'
    + '<span>Longueur</span>'
    + '<span>Diamètre</span>'
    + '<span>Volume</span>'
    + '<span>Autres</span>'
    + '<span>Statut</span>'
    + '<span>Consommée</span>'
    + '<span style="text-align:right;">⋮</span></div>';
  items.forEach(function(r) {
    var statutClass = r.statut === 'EN_STOCK' ? 'badge-stock' : (r.statut === 'EN_COURSE' ? 'badge-maintenance' : 'badge-consumed');
    var statutLabel = r.statut === 'EN_STOCK' ? 'Disponible' : (r.statut === 'EN_COURSE' ? 'Affectée / sciage' : 'Sciée');
    var autres = [];
    if (r.fournisseur) autres.push('🏭 ' + escapeHtml(r.fournisseur));
    if (r.origine) autres.push('📍 ' + escapeHtml(r.origine));
    if (r.qualite && r.qualite !== 'Auto') autres.push('Q° ' + escapeHtml(r.qualite));
    if (r.prixM3) autres.push((r.volume * r.prixM3).toFixed(0) + ' DA');
    if (!autres.length) autres.push('—');
    var consDate = r.consumedAt ? grumeFmtDate(r.consumedAt) : '—';
    html += '<div class="dt-row">'
      + '<span class="mp-dt-date">' + grumeFmtDate(r.createdAt) + '</span>'
      + '<span class="mp-dt-ref" style="font-weight:600;font-size:12px;">' + escapeHtml(r.code) + '</span>'
      + '<span class="mp-dt-type">' + escapeHtml(r.essence) + '</span>'
      + '<span class="mp-dt-long">' + r.longueur + ' m</span>'
      + '<span class="mp-dt-dia">Ø ' + r.diametre + ' cm</span>'
      + '<span class="mp-dt-vol">' + _uiFmtVol(r.volume) + ' m³</span>'
      + '<span class="mp-dt-autres" style="font-size:11px;color:var(--text-muted);">' + autres.join(' · ') + '</span>'
      + '<span class="mp-dt-stat"><span class="' + statutClass + '">' + statutLabel + '</span></span>'
      + '<span class="mp-dt-cons">' + consDate + '</span>'
      + '<span class="mp-dt-actions" style="text-align:right;white-space:nowrap;">'
      + '<button class="btn btn-sm btn-secondary" onclick="openGrumeQrModal(\'' + r.id + '\')" title="QR réception / sciage" data-perm="grumes:scan" style="padding:4px 8px;font-size:11px;">▦</button>'
      + (r.statut === 'EN_STOCK' ? '<button class="btn btn-sm btn-secondary" onclick="consommerGrume(\'' + r.id + '\')" title="Consommer au sciage" data-perm="sciage:start" style="padding:4px 8px;font-size:11px;">🪚</button>' : '')
      + '<button class="btn btn-sm btn-danger" onclick="deleteGrume(\'' + r.id + '\')" data-perm="grumes:delete" style="padding:4px 8px;font-size:11px;">✕</button>'
      + '</span></div>';
  });
  html += '</div>';
  el.innerHTML = html;
  if (typeof applyPermissionGuard === 'function') applyPermissionGuard();
};

/* ─────────────────────────────────────────────
   renderProduitsFinis — liste produits finis
   Extrait: app.js lignes 5446-5487
   ───────────────────────────────────────────── */

window._uiRenderer_renderProduitsFinis = function() {
  ensurePfScanCodes();
  var el = document.getElementById('gdsPfList');
  if (!el) return;
  var filter = (document.getElementById('gdsPfFilter').value || '').toLowerCase();
  var typeFilter = document.getElementById('gdsPfFilterType').value;
  var essEl = document.getElementById('gdsPfFilterEssence');
  var essFilter = essEl ? essEl.value : 'all';
  var items = finishedGoods;
  if (typeFilter !== 'all') items = items.filter(function(f) { return f.type === typeFilter; });
  if (essFilter !== 'all') items = items.filter(function(f) { return f.essence === essFilter; });
  if (filter) items = items.filter(function(f) {
    return (f.type || '').toLowerCase().includes(filter) || (f.essence || '').toLowerCase().includes(filter)
      || (f.code || '').toLowerCase().includes(filter) || String(f.sfRef || '').toLowerCase().includes(filter);
  });
  window._uiRenderer_renderPfRecap();
  if (items.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">Stock vide</div></div>';
    return;
  }
  var html = '<div class="dt-table dt-table-full"><div class="dt-head dt-head-full">'
    + '<span>Produit</span><span>Dimensions (mm)</span><span>Qté dispo</span><span>Statut</span><span style="text-align:right;">⋮</span>'
    + '</div>';
  items.forEach(function(f) {
    var dispo = (f.qte || 0) - (f.qteExpedie || 0);
    var statutClass = f.statut === 'EN_STOCK' ? 'badge-stock' : (f.statut === 'PARTIEL' ? 'badge-maintenance' : 'badge-consumed');
    var statutLabel = f.statut === 'EN_STOCK' ? 'En stock' : (f.statut === 'PARTIEL' ? 'Partiel' : 'Expédié');
    html += '<div class="dt-row">';
    html += '<span class="mp-dt-type"><b>' + escapeHtml(f.type) + ' — ' + escapeHtml(f.essence) + '</b>' + (f.code ? ' <span style="font-size:10px;color:var(--text-muted);">' + escapeHtml(f.code) + '</span>' : '') + '</span>';
    html += '<span class="mp-dt-long">' + f.epaisseur + ' × ' + f.largeur + ' × ' + f.longueur + ' mm'
      + (f.sfRef ? ' <span style="color:var(--text-muted);font-size:10px;">via ' + escapeHtml(f.sfRef) + '</span>' : '')
      + (f.batchNum ? ' <span style="color:var(--text-muted);font-size:10px;">lot ' + escapeHtml(f.batchNum) + '</span>' : '') + '</span>';
    html += '<span class="mp-dt-vol" style="font-weight:600;">' + dispo + '/' + f.qte + ' pcs' + (f.volume ? ' — ' + f.volume + ' m³' : '') + '</span>';
    html += '<span class="mp-dt-stat"><span class="' + statutClass + '">' + statutLabel + '</span></span>';
    html += '<span class="mp-dt-actions" style="text-align:right;white-space:nowrap;">';
    html += '<button class="btn btn-sm btn-ghost" onclick="openPfQrModal(\'' + f.id + '\')" title="QR pièce vrac" data-perm="stock_pf:view">▦</button> ';
    if (dispo > 0) html += '<button class="btn btn-sm btn-secondary" onclick="expedierProduitFini(\'' + f.id + '\')" data-perm="transfert_pf:add" style="padding:4px 8px;font-size:11px;" title="Expédier">🚚</button> ';
    html += '<button class="btn btn-sm btn-danger" onclick="deleteProduitFini(\'' + f.id + '\')" data-perm="stock_pf:delete" style="padding:4px 8px;font-size:11px;">✕</button>';
    html += '</span></div>';
  });
  html += '</div>';
  el.innerHTML = html;
  if (typeof applyPermissionGuard === 'function') applyPermissionGuard();
};

/* ─────────────────────────────────────────────
   renderPfRecap — récapitulatif PF
   Extrait: app.js lignes 5489-5505
   ───────────────────────────────────────────── */

window._uiRenderer_renderPfRecap = function() {
  var el = document.getElementById('gdsPfRecap');
  if (!el) return;
  var total = finishedGoods.reduce(function(a, f) { return a + (f.qte || 0); }, 0);
  var dispo = finishedGoods.reduce(function(a, f) { return a + ((f.qte || 0) - (f.qteExpedie || 0)); }, 0);
  var exped = total - dispo;
  var vol = finishedGoods.reduce(function(a, f) { return a + (f.volume || 0); }, 0);
  var byType = {};
  finishedGoods.forEach(function(f) { byType[f.type] = (byType[f.type] || 0) + ((f.qte || 0) - (f.qteExpedie || 0)); });
  var typeStr = Object.keys(byType).map(function(k) { return escapeHtml(k) + ' ' + byType[k] + ' pcs'; }).join(' · ');
  el.innerHTML = '<div class="kpi-grid-v2" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:10px;">'
    + '<div class="kpi-card-v2"><div class="kpi-value">' + dispo + '</div><div class="kpi-label">pcs dispo</div></div>'
    + '<div class="kpi-card-v2"><div class="kpi-value">' + exped + '</div><div class="kpi-label">pcs expédiés</div></div>'
    + '<div class="kpi-card-v2"><div class="kpi-value">' + vol.toFixed(2) + '</div><div class="kpi-label">m³ stock</div></div>'
    + '</div>'
    + (typeStr ? '<div style="font-size:11px;color:var(--text-muted);">Par type : <strong>' + typeStr + '</strong></div>' : '');
};

/* ─────────────────────────────────────────────
   renderAll — rendu initial tous écrans
   Extrait: app.js lignes 8973-8996
   ───────────────────────────────────────────── */

window._uiRenderer_renderAll = function() {
  renderStockTable();
  renderOrdersList();
  renderDashboardKPIs();
  renderDisquesAll();
  renderGammePin();
  updateProcOfInfo('A');
  updateProcOfInfo('B');
  updateSyncBanner();
  renderMiscSettings();
  renderAccountCard();
  renderUserList();
  renderShifts();
  renderAuditLogs();
  renderQualityList();
  renderPlanningList();
  renderProdPlanList();
  renderAlertsPanel();
  renderUpcomingTasksPanel();
  renderPlanningRate();
  ensureFardeauxScanCodes();
  if (typeof renderFardeauxList === 'function') renderFardeauxList();
  if (typeof renderGrumes === 'function') ensureGrumeScanCodes();
};

/* ─────────────────────────────────────────────
   EXPORT GLOBAL — wrappers compatibles
   ───────────────────────────────────────────── */

window.uiRenderer = {
  renderGrumesStats: window._uiRenderer_renderGrumesStats,
  renderGrumes: window._uiRenderer_renderGrumes,
  renderProduitsFinis: window._uiRenderer_renderProduitsFinis,
  renderPfRecap: window._uiRenderer_renderPfRecap,
  renderAll: window._uiRenderer_renderAll
};
