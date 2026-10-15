/**
 * ORDERS-RENDERER.JS — OF (ordres de fabrication) : rendu, PDF.
 * Stratégie sûre : copies EXACTES pour les fonctions autonomes,
 * passthrough pour renderOrdersList (trop couplée aux helpers de app.js).
 * Globals: escapeHtml, showToast, orders, renderOrderPDF
 */
'use strict';

/* ─────────────────────────────────────────────
   renderOrderPDF — HTML PDF d'un OF (copie EXACTE)
   Extrait EXACT: app.js lignes 2677-2741
   ───────────────────────────────────────────── */

window._ordersRenderer_renderOrderPDF = function(o) {
  var logoSrc = 'header-logo.png';
  var latStr = (o.laterals && o.laterals.length) ? o.laterals.join(' + ') + 'mm' : '—';
  var latWStr = (o.lateralWidths && o.lateralWidths.length) ? o.lateralWidths.join(' + ') + 'mm' : '—';
  var chuteClass = o.chute > 20 ? 'color:#d97706;' : 'color:#059669;';
  var clientLine = o.client ? '<div class="of-row"><span class="of-label">Client</span><span class="of-val">' + escapeHtml(o.client) + '</span></div>' : '';
  var refLine = o.reference ? '<div class="of-row"><span class="of-label">Référence</span><span class="of-val">' + escapeHtml(o.reference) + '</span></div>' : '';
  var qtyLine = o.qty ? '<div class="of-row"><span class="of-label">Quantité</span><span class="of-val">' + escapeHtml(String(o.qty)) + '</span></div>' : '';
  var producedLine = o.producedQty ? '<div class="of-row"><span class="of-label">Qté produite</span><span class="of-val">' + escapeHtml(String(o.producedQty)) + '</span></div>' : '';
  var fgLine = o.fgWarehouse ? '<div class="of-row"><span class="of-label">Magasin PF</span><span class="of-val">' + escapeHtml(o.fgWarehouse) + '</span></div>' : '';
  var wipLine = o.wipWarehouse ? '<div class="of-row"><span class="of-label">Magasin en-cours</span><span class="of-val">' + escapeHtml(o.wipWarehouse) + '</span></div>' : '';
  var startLine = o.plannedStart ? '<div class="of-row"><span class="of-label">Début prévu</span><span class="of-val">' + escapeHtml(o.plannedStart) + '</span></div>' : '';
  var endLine = o.plannedEnd ? '<div class="of-row"><span class="of-label">Fin prévue</span><span class="of-val">' + escapeHtml(o.plannedEnd) + '</span></div>' : '';
  var statusLine = o.status ? '<div class="of-row"><span class="of-label">Statut</span><span class="of-val">' + escapeHtml(o.status) + '</span></div>' : '';
  var notesLine = o.remarks ? '<div class="of-row"><span class="of-label">Remarques</span><span class="of-val" style="font-style:italic;">' + escapeHtml(o.remarks) + '</span></div>' : '';
  var essenceLabel = o.essence || o.wood || 'Pin';
  var css = '@media print{body{margin:0!important;}.of-print-only{display:block!important;}.of-no-print{display:none!important;}}';
  css += '.of-page{width:210mm;min-height:297mm;padding:18mm 15mm;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;margin:0 auto;background:#fff;box-sizing:border-box;}';
  css += '.of-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #059669;padding-bottom:10px;margin-bottom:14px;}';
  css += '.of-logo{height:42px;width:auto;}.of-title-block{text-align:right;}';
  css += '.of-title{font-size:22px;font-weight:800;color:#059669;letter-spacing:0.5px;}';
  css += '.of-sub{font-size:11px;color:#666;margin-top:2px;}';
  css += '.of-section{margin-bottom:12px;}.of-section-title{font-size:13px;font-weight:700;color:#059669;border-bottom:1px solid #d1d5db;padding-bottom:3px;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;}';
  css += '.of-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;}';
  css += '.of-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dotted #e5e7eb;font-size:12px;}';
  css += '.of-label{color:#666;font-weight:600;}.of-val{font-weight:700;text-align:right;}';
  css += '.of-table{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px;}';
  css += '.of-table th{background:#059669;color:#fff;padding:6px 8px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;}';
  css += '.of-table td{padding:5px 8px;border-bottom:1px solid #e5e7eb;}';
  css += '.of-table tr:nth-child(even){background:#f0fdf4;}';
  css += '.of-footer{margin-top:24px;border-top:2px solid #059669;padding-top:10px;display:flex;justify-content:space-between;font-size:11px;color:#666;}';
  css += '.of-sign-box{width:140px;border-bottom:1px solid #999;text-align:center;padding-top:40px;font-size:10px;color:#999;}';
  css += '.of-chute-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:700;font-size:12px;' + chuteClass + 'background:#fef3c7;}';
  return '<style>' + css + '</style>'
    + '<div class="of-page">'
    + '<div class="of-header">'
    + '<img class="of-logo" src="' + logoSrc + '" alt="Charben">'
    + '<div class="of-title-block"><div class="of-title">ORDRE DE FABRICATION</div>'
    + '<div class="of-sub">' + escapeHtml(o.orderNum) + ' — Ligne ' + escapeHtml(o.line || 'A') + '</div>'
    + '<div class="of-sub">' + escapeHtml(o.date || '—') + '</div></div></div>'
    + '<div class="of-section"><div class="of-section-title">Débit</div><div class="of-grid">'
    + '<div class="of-row"><span class="of-label">Grume</span><span class="of-val">' + escapeHtml(o.logWidth) + 'mm</span></div>'
    + '<div class="of-row"><span class="of-label">Essence</span><span class="of-val">' + escapeHtml(essenceLabel) + '</span></div>'
    + '<div class="of-row"><span class="of-label">Central</span><span class="of-val">' + escapeHtml(o.central) + 'mm</span></div>'
    + '<div class="of-row"><span class="of-label">Largeur centrale</span><span class="of-val">' + escapeHtml(o.centerWidth || '—') + 'mm</span></div>'
    + '<div class="of-row"><span class="of-label">Latéraux</span><span class="of-val">' + latStr + '</span></div>'
    + '<div class="of-row"><span class="of-label">Largeur latéraux</span><span class="of-val">' + latWStr + '</span></div>'
    + '<div class="of-row"><span class="of-label">Marge sécurité</span><span class="of-val">' + escapeHtml(String(o.margin || '—')) + 'mm</span></div>'
    + '</div></div>'
    + '<div class="of-section"><div class="of-section-title">Résultat</div><div class="of-grid">'
    + '<div class="of-row"><span class="of-label">Pièces</span><span class="of-val">' + escapeHtml(String(o.pieceCount || '—')) + '</span></div>'
    + '<div class="of-row"><span class="of-label">Disques</span><span class="of-val">' + escapeHtml(String(o.diskCount || '—')) + '</span></div>'
    + '<div class="of-row"><span class="of-label">Consommé</span><span class="of-val">' + escapeHtml(String(o.totalConsumed || '—')) + 'mm</span></div>'
    + '<div class="of-row"><span class="of-label">Chute</span><span class="of-val"><span class="of-chute-badge">' + escapeHtml(String(o.chute || '—')) + 'mm</span></span></div>'
    + '</div></div>'
    + statusLine + clientLine + refLine + qtyLine + producedLine + fgLine + wipLine + startLine + endLine + notesLine
    + '<div class="of-section of-print-only"><div class="of-section-title">Vérifications</div><div class="of-grid">'
    + '<div class="of-row"><span class="of-label">Opérateur</span><span class="of-val">________________</span></div>'
    + '<div class="of-row"><span class="of-label">Contrôleur</span><span class="of-val">________________</span></div>'
    + '</div></div>'
    + '<div class="of-footer of-print-only">'
    + '<div>Charben Industrie — SARL</div>'
    + '<div class="of-sign-box">Signature</div></div>'
    + '</div>';
};

/* ─────────────────────────────────────────────
   exportOrderPDF — ouverture viewer PDF (copie EXACTE)
   Extrait EXACT: app.js lignes 2743-2750
   ───────────────────────────────────────────── */

window._ordersRenderer_exportOrderPDF = function(idx) {
  if (idx < 0 || idx >= orders.length) { showToast('OF introuvable', 'error'); return; }
  var html = renderOrderPDF(orders[idx]);
  var title = 'OF ' + (orders[idx].orderNum || '');
  document.getElementById('pdfViewerTitle').textContent = title;
  document.getElementById('pdfViewerBody').innerHTML = html;
  document.getElementById('pdfViewerOverlay').classList.add('open');
};

/* ─────────────────────────────────────────────
   renderOrdersList — passthrough (couplé aux helpers app.js)
   ───────────────────────────────────────────── */

// Exact copy from app.js
window._ordersRenderer_renderOrdersList = function() {
  const container = document.getElementById('ordersList');
  const countEl = document.getElementById('ordersHistoryCount');
  if (!container) return;
  if (countEl) countEl.textContent = '· ' + orders.length + ' OF';
  let repaired = false;
  orders.forEach(function(o) {
    if (o && typeof o.status !== 'string') { o.status = 'engage'; repaired = true; }
  });
  if (repaired) { safeSave(STORAGE_KEYS.orders, orders); fsSave('orders', orders); }
  renderSavedQueries();
  const list = sortedOrders(filteredOrders());
  const bulkBar = document.getElementById('ordersBulkBar');

  if (bulkBar) {
    const sel = ofSelected.size;
    if (sel > 0) {
      bulkBar.style.display = 'flex';
      bulkBar.innerHTML = '<span class="bulk-label">' + sel + ' sélectionnée(s)</span>'
        + '<button class="btn btn-sm btn-danger" onclick="deleteSelectedOrders()">Supprimer</button>'
        + '<button class="btn btn-sm btn-ghost" onclick="clearOrderSelection()">Annuler</button>';
    } else {
      bulkBar.style.display = 'none';
      bulkBar.innerHTML = '';
    }
  }
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">' + escapeHtml(ofFilterText.trim() ? 'Aucun OF ne correspond à votre recherche' : 'Aucune commande validée pour la ligne ' + ofActiveLine) + '</div></div>';
    return;
  }

  function ppForOf(o) {
    if (o.ppId) { var pp = productionPlan.find(function(p) { return p.id === o.ppId; }); if (pp) return pp; }
    return productionPlan.find(function(p) { return p.ofNum === o.orderNum; }) || null;
  }

  var allSelected = list.length > 0 && list.every(function(o) { return ofSelected.has(o.orderNum); });

  var toolbar = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center;">'
    + '<span style="font-size:11px;color:var(--text-muted);">' + list.length + ' OF</span>'
    + '</div>';

  var head = '<div class="dt-head dt-head-full">'
    + '<input type="checkbox" class="dt-checkbox" ' + (allSelected ? 'checked' : '') + ' onclick="ofToggleSelectAll()" aria-label="Tout sélectionner">'
    + '<span>' + ofSortBtn('OF', 'orderNum') + '</span>'
    + '<span class="dt-col-date">' + ofSortBtn('Date', 'date') + '</span>'
    + '<span>' + ofSortBtn('Ligne', 'line') + '</span>'
    + '<span>' + ofSortBtn('Grume', 'logWidth') + '</span>'
    + '<span class="dt-col-client">Client</span>'
    + '<span class="dt-col-ref">Réf.</span>'
    + '<span class="dt-col-status">' + ofSortBtn('Statut', 'status') + '</span>'
    + '<span class="dt-col-disks">Qté</span>'
    + '<span class="dt-col-disks">Prod.</span>'
    + '<span class="dt-col-disks">Disq.</span>'
    + '<span class="dt-col-consumed">Cons.</span>'
    + '<span class="dt-col-status">' + ofSortBtn('Chute', 'chute') + '</span>'
    + '<span class="dt-col-notes">Notes</span>'
    + '<span style="text-align:right;">⋮</span>'
    + '</div>';

  var rows = list.map(function(o) {
    var num = escapeHtml(o.orderNum);
    var date = escapeHtml(o.date);
    var lat = (o.laterals && o.laterals.length) ? escapeHtml(o.laterals.join(', ')) + 'mm' : '—';
    var selected = ofSelected.has(o.orderNum) ? ' selected' : '';
    var realIdx = orders.indexOf(o);
    var pp = ppForOf(o);
    var clientName = o.clientName || (pp ? pp.clientName : '') || '';
    var ref = o.reference || (pp ? pp.reference : '') || '';
    var diskCount = o.diskCount || 0;
    var consumed = o.totalConsumed || 0;
    var chute = o.chute || 0;
    var notes = o.remarks || (pp ? pp.notes : '') || '';
    var chuteClass = chute > 20 ? 'status-warning' : 'status-success';
    var statusLabel = o.status === 'draft' ? 'Brouillon' : (o.status === 'engage' ? 'En cours' : (o.status === 'realise' ? 'Réalisé' : (o.status === 'annule' ? 'Annulé' : (o.status ? escapeHtml(o.status) : 'En cours'))));
    var statusBadge = o.status === 'realise' ? 'status-success' : (o.status === 'engage' ? 'status-processing' : (o.status === 'annule' ? 'status-cancelled' : (o.status ? 'status-pending' : 'status-processing')));

    return '<div class="dt-row' + selected + '" onclick="setOrderAsRef(' + realIdx + ')">'
      + '<input type="checkbox" class="dt-checkbox" ' + (selected ? 'checked' : '') + ' onclick="event.stopPropagation();ofToggleSelect(' + realIdx + ')" aria-label="Sélectionner ' + num + '">'
      + '<span style="font-weight:700;">' + num + '<span style="display:block;font-size:10px;color:var(--text-muted);font-weight:400;">' + escapeHtml(o.central) + 'mm · ' + lat + '</span></span>'
      + '<span class="dt-col-date" style="font-size:11px;color:var(--text-secondary);">' + date + '</span>'
      + '<span style="font-size:12px;font-weight:600;">L' + escapeHtml(dashboardRenderer.ofLine(o)) + '</span>'
      + '<span>' + escapeHtml(o.logWidth) + 'mm</span>'
      + '<span class="dt-col-client" style="font-size:12px;">' + (escapeHtml(clientName) || '—') + '</span>'
      + '<span class="dt-col-ref" style="font-size:12px;font-weight:600;">' + (escapeHtml(ref) || '—') + '</span>'
      + '<span class="dt-col-status"><span class="status-badge ' + statusBadge + '">' + statusLabel + '</span></span>'
      + '<span class="dt-col-disks" style="font-size:12px;font-weight:700;text-align:center;">' + (o.qty || '—') + '</span>'
      + '<span class="dt-col-disks" style="font-size:12px;font-weight:700;text-align:center;">' + (o.producedQty || '—') + '</span>'
      + '<span class="dt-col-disks" style="font-size:12px;font-weight:700;text-align:center;">' + diskCount + '</span>'
      + '<span class="dt-col-consumed" style="font-size:12px;text-align:center;">' + consumed + '</span>'
      + '<span class="dt-col-status"><span class="status-badge ' + chuteClass + '">' + chute + 'mm</span></span>'
      + '<span class="dt-col-notes" style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100px;" title="' + escapeHtml(notes) + '">' + (escapeHtml(notes).substring(0, 20) || '—') + '</span>'
      + '<span style="text-align:right;white-space:nowrap;">'
      + '<button class="btn btn-sm btn-primary" onclick="event.stopPropagation();exportOrderPDF(' + realIdx + ')" title="PDF">🖨</button>'
      + '</span></div>';
  }).join('');

  container.innerHTML = toolbar + '<div class="dt-table dt-table-full">' + head + rows + '</div>';
}

/* ─────────────────────────────────────────────
   EXPORT GLOBAL
   ───────────────────────────────────────────── */

window.ordersRenderer = {
  renderOrderPDF: window._ordersRenderer_renderOrderPDF,
  exportOrderPDF: window._ordersRenderer_exportOrderPDF,
  renderOrdersList: window._ordersRenderer_renderOrdersList
};