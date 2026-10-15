/**
 * QC-MANAGER.JS — Contrôle Qualité (inspections).
 * Copies EXACTES des fonctions autonomes.
 * Le module CQP a été retiré : il n'avait ni écran, ni route, ni icône
 * atteignable — uniquement du code mort, dont 4 renderers qui se recalls
 * eux-mêmes (alias sur window) et partaient en RangeError.
 * Globals: qualityChecks, escapeHtml, safeSave, fsSave,
 *          renderAlertsPanel, renderQualityList, showToast
 */
'use strict';

/* ─────────────────────────────────────────────
   Labels QC — copies EXACTES (pures)
   Extrait EXACT: app.js lignes 7547-7558
   ───────────────────────────────────────────── */

window._qcManager_getQCTypeLabel = function(t) {
  var m = { matiere_premiere: 'Matière première', sechage: 'Sortie séchage', produit_fin: 'Produit fini', machine: 'Équipement' };
  return m[t] || t;
};

window._qcManager_getQCResultLabel = function(r) {
  var m = { conforme: 'Conforme', non_conforme: 'Non conforme', a_retoucher: 'À retoucher' };
  return m[r] || r;
};

window._qcManager_getQCSeverityLabel = function(s) {
  var m = { mineur: 'Mineur', moyen: 'Moyen', majeur: 'Majeur', critique: 'Critique' };
  return m[s] || s;
};

/* ─────────────────────────────────────────────
   saveQualityChecks / deleteQualityCheck — EXACTES
   Extrait EXACT: app.js lignes 7536-7545
   ───────────────────────────────────────────── */

window._qcManager_saveQualityChecks = function() { safeSave('charben_qc', qualityChecks); };

window._qcManager_deleteQualityCheck = function(id) {
  qualityChecks = qualityChecks.filter(function(q) { return q.id !== id; });
  saveQualityChecks();
  renderQualityList();
  renderAlertsPanel();
  fsSave('qc', qualityChecks);
};

/* ─────────────────────────────────────────────
   renderQualityList — copie EXACTE
   Extrait EXACT: app.js lignes 7560-7586
   ───────────────────────────────────────────── */

window._qcManager_renderQualityList = function() {
  var el = document.getElementById('qualityList');
  if (!el) return;
  var filter = document.getElementById('qcFilterResult') ? document.getElementById('qcFilterResult').value : 'all';
  var items = qualityChecks.slice().reverse();
  if (filter !== 'all') items = items.filter(function(q) { return q.result === filter; });

  if (items.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">Aucune inspection enregistrée</div></div>';
    return;
  }
  var html = '<div class="dt-table dt-table-full"><div class="dt-head dt-head-full">'
    + '<span>Produit</span><span>Type / Résultat</span><span>Gravité</span><span style="text-align:right;">⋮</span>'
    + '</div>';
  items.forEach(function(q) {
    var statusClass = q.result === 'conforme' ? 'pass' : q.result === 'non_conforme' ? 'fail' : 'pending';
    var sevColor = q.severity === 'critique' ? 'var(--danger)' : q.severity === 'majeur' ? 'var(--warning)' : 'var(--text-muted)';
    html += '<div class="dt-row" style="border-left:3px solid ' + (q.result === 'conforme' ? 'var(--success)' : q.result === 'non_conforme' ? 'var(--danger)' : 'var(--text-muted)') + ';">';
    html += '<span class="mp-dt-type"><b>' + escapeHtml(q.product || '') + '</b></span>';
    html += '<span class="mp-dt-autres">' + escapeHtml(getQCTypeLabel(q.type)) + ' — <b>' + escapeHtml(getQCResultLabel(q.result)) + '</b></span>';
    html += '<span class="mp-dt-cons" style="font-weight:600;color:' + sevColor + ';">' + escapeHtml(getQCSeverityLabel(q.severity)) + '</span>';
    html += '<span class="mp-dt-actions" style="text-align:right;"><button onclick="deleteQualityCheck(\'' + q.id + '\')" style="background:none;border:none;color:var(--danger);font-size:14px;cursor:pointer;padding:4px;">✕</button></span>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
};


/* ─────────────────────────────────────────────
   EXPORT GLOBAL
   ───────────────────────────────────────────── */

window.qcManager = {
  getQCTypeLabel: window._qcManager_getQCTypeLabel,
  getQCResultLabel: window._qcManager_getQCResultLabel,
  getQCSeverityLabel: window._qcManager_getQCSeverityLabel,
  saveQualityChecks: window._qcManager_saveQualityChecks,
  deleteQualityCheck: window._qcManager_deleteQualityCheck,
  renderQualityList: window._qcManager_renderQualityList
};