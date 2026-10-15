/**
 * EQUIPMENT-MANAGER.JS — Équipements, maintenance, disques.
 * Copies EXACTES des fonctions pures ; passthrough pour les gros renders.
 * Globals: equipment, disques, machinesWithDisque logic interne, saveDisques
 */
'use strict';

/* ─────────────────────────────────────────────
   Fonctions pures disques — copies EXACTES
   Extrait EXACT: app.js lignes 6421-6464
   ───────────────────────────────────────────── */

window._equipmentManager_disqueStockRestant = function(d) {
  return Math.max(0, (d.stockTotal || 0) - (d.enService || 0));
};

window._equipmentManager_disqueById = function(id) {
  return disques.find(function(d) { return d.id === id; });
};

function _eqList() {
  return Array.isArray(equipment) ? equipment : ((equipment && equipment.list) || []);
}

window._equipmentManager_machinesWithDisque = function(id) {
  return _eqList().filter(function(m) { return m.type === 'machine' && m.disque === id; });
};

window._equipmentManager_disqueLineCounts = function(id) {
  var m = _eqList().filter(function(x) { return x.type === 'machine' && x.disque === id; });
  var A = 0, B = 0, names = [];
  m.forEach(function(x) {
    var l = String(x.line || '');
    if (l === '1') A++; else if (l === '2') B++;
    names.push(String(x.name || x.id));
  });
  return { A: A, B: B, total: m.length, names: names };
};

window._equipmentManager_syncDisquesFromMachines = function(doSave) {
  var changed = false;
  var equipmentList = Array.isArray(equipment) ? equipment : (equipment && equipment.list) || [];
  disques.forEach(function(d) {
    var n = equipmentList.filter(function(x) { return x.type === 'machine' && x.disque === d.id; }).length;
    if ((d.enService || 0) !== n) { d.enService = n; changed = true; }
  });
  if (doSave && changed) saveDisques();
  return changed;
};

window._equipmentManager_disqueTypeLabel = function(t) {
  return t === 'principale' ? 'Principale' : 'Secondaire';
};

window._equipmentManager_disqueStatus = function(d) {
  var rest = window._equipmentManager_disqueStockRestant(d);
  if (rest <= 0) return { cls: 'badge-broken', label: 'Épuisé' };
  if (rest <= (d.seuilAlerte || 0)) return { cls: 'badge-maintenance', label: 'Stock bas' };
  if ((d.totalMeters || 0) >= (d.seuilMeters || 999999)) return { cls: 'badge-maintenance', label: 'Usure max' };
  return { cls: 'badge-active', label: 'Disponible' };
};

/* ─────────────────────────────────────────────
   Gros renders — passthrough (couplés app.js)
   ───────────────────────────────────────────── */

// Exact copy from app.js
window._equipmentManager_renderEquipList = function() {
  const el = document.getElementById('equipList');
  const filterEl = document.getElementById('eqFilter');
  const filter = ((filterEl && filterEl.value) || '').toLowerCase();
  const typeFilterEl = document.getElementById('eqFilterType');
  const typeFilter = (typeFilterEl && typeFilterEl.value) || 'all';
  let items = Array.isArray(equipment) ? equipment : (equipment && Array.isArray(equipment.machines) ? equipment.machines : (equipment && equipment.list) || []);
  if (!el) return;
  if (typeFilter !== 'all') items = items.filter(e => e.type === typeFilter);
  if (filter) items = items.filter(e => (e.name || '').toLowerCase().includes(filter));
  const typeLabels = { lame:'Lame', machine:'Machine', outil:'Outil' };
  const statusLabels = { actif:'Actif', maintenance:'Maintenance', hors_service:'Hors service' };
  const badgeClasses = { actif:'badge-active', maintenance:'badge-maintenance', hors_service:'badge-broken' };
  if (items.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">' + MI('construction','mi-xl mi-muted') + '</div><div class="empty-state-text">Aucun \u00e9quipement</div></div>';
    return;
  }
  let html = '<div class="dt-table dt-table-full"><div class="dt-head dt-head-full">'
    + '<span>Équipement</span><span>Installé</span><span>🪚 Disque monté</span><span>Statut</span><span style="text-align:right;">⋮</span>'
    + '</div>';
  items.forEach(function(eq) {
    html += '<div class="dt-row">';
    html += '<span class="mp-dt-type"><b>' + escapeHtml(eq.name || '') + '</b><br><span style="font-size:10px;color:var(--text-muted);">' + escapeHtml(typeLabels[eq.type] || eq.type || '') + ' — Ligne ' + escapeHtml(eq.line || '') + '</span></span>';
    html += '<span class="mp-dt-date">' + (eq.installDate ? escapeHtml(eq.installDate) : '<span style="color:var(--text-muted);">—</span>') + '</span>';
    if (eq.type === 'machine') {
      var mounted = disqueById(eq.disque);
      html += '<span class="mp-dt-autres">';
      html += '<select class="form-input" onchange="setMachineDisque(\'' + eq.id + '\', this.value)" style="font-size:11px;padding:4px 6px;">';
      html += '<option value="">— Aucun —</option>';
      disques.forEach(function(d) {
        html += '<option value="' + d.id + '"' + (eq.disque === d.id ? ' selected' : '') + '>' + escapeHtml(d.ref) + ' (' + disqueStockRestant(d) + ' dispo)</option>';
      });
      html += '</select>';
      if (mounted) {
        var lc = disqueLineCounts(eq.disque);
        html += '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">' + escapeHtml(mounted.ref) + ' — restant: <b>' + disqueStockRestant(mounted) + '</b> · A ' + lc.A + ' + B ' + lc.B + '</div>';
      }
      html += '</span>';
    } else {
      html += '<span class="mp-dt-autres" style="color:var(--text-muted);">—</span>';
    }
    html += '<span class="mp-dt-stat"><span class="badge ' + (badgeClasses[eq.status] || '') + '">' + escapeHtml(statusLabels[eq.status] || eq.status || '') + '</span></span>';
    html += '<span class="mp-dt-actions" style="text-align:right;white-space:nowrap;">';
    html += '<button class="btn btn-sm btn-secondary" onclick="toggleEquipStatus(\'' + eq.id + '\')" title="Changer \u00e9tat">' + MI('swap_horiz','mi-sm') + '</button> ';
    html += '<button class="btn btn-sm btn-danger" onclick="deleteEquipment(\'' + eq.id + '\')" data-perm="reglages:delete" title="Supprimer">' + MI('delete','mi-sm') + '</button>';
    html += '</span></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}
window._equipmentManager_renderMaintList = function() { if (typeof renderMaintList === 'function') return renderMaintList(); };
window._equipmentManager_renderDisquesAll = function() { if (typeof renderDisquesAll === 'function') return renderDisquesAll(); };
window._equipmentManager_disquesRegulLabel = function(d) { if (typeof disquesRegulLabel === 'function') return disquesRegulLabel(d); };
window._equipmentManager_disquesRegulApply = function() { if (typeof disquesRegulApply === 'function') return disquesRegulApply(); };

/* ─────────────────────────────────────────────
   EXPORT GLOBAL
   ───────────────────────────────────────────── */

window.equipmentManager = {
  disqueStockRestant: window._equipmentManager_disqueStockRestant,
  disqueById: window._equipmentManager_disqueById,
  machinesWithDisque: window._equipmentManager_machinesWithDisque,
  disqueLineCounts: window._equipmentManager_disqueLineCounts,
  syncDisquesFromMachines: window._equipmentManager_syncDisquesFromMachines,
  disqueTypeLabel: window._equipmentManager_disqueTypeLabel,
  disqueStatus: window._equipmentManager_disqueStatus,
  renderEquipList: window._equipmentManager_renderEquipList,
  renderMaintList: window._equipmentManager_renderMaintList,
  renderDisquesAll: window._equipmentManager_renderDisquesAll,
  disquesRegulLabel: window._equipmentManager_disquesRegulLabel,
  disquesRegulApply: window._equipmentManager_disquesRegulApply
};