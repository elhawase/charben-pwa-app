/* ============================================================
   OF LIST MANAGER — Filtrage, tri, sélection, export, PDF
   Extrait de app.js — Phase 2A découpage
   Charge APRÈS app.js (utilise orders, renderOrdersList…)
   ============================================================ */

/* ─── Filtrage ─── */
function switchOfLine(line) {
  ofActiveLine = line;
  document.getElementById('ofLineBtnA').classList.toggle('active', line === 'A');
  document.getElementById('ofLineBtnB').classList.toggle('active', line === 'B');
  renderOrdersList();
  syncToAllTabs();
}

function ofSetFilter(value) {
  ofFilterText = value;
  renderOrdersList();
}

function setOfStatusFilter(status) {
  ofStatusFilter = status;
  var bar = document.getElementById('statusFilterBar');
  if (bar) {
    bar.querySelectorAll('.status-chip').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-status') === status);
    });
  }
  renderOrdersList();
}

function filteredOrders() {
  var lineList = lineOrders(ofActiveLine);
  if (!ofFilterText.trim() && !ofStatusFilter) return lineList;
  var q = ofFilterText.trim().toLowerCase();
  return lineList.filter(function(o) {
    if (ofStatusFilter && o.status !== ofStatusFilter) return false;
    if (!q) return true;
    return (o.orderNum || '').toLowerCase().indexOf(q) >= 0 ||
      (o.date || '').toLowerCase().indexOf(q) >= 0 ||
      (o.client || '').toLowerCase().indexOf(q) >= 0 ||
      (o.reference || '').toLowerCase().indexOf(q) >= 0 ||
      (o.remarks || '').toLowerCase().indexOf(q) >= 0;
  });
}

function sortedOrders(list) {
  if (!ofSortField) return list.slice();
  var dir = ofSortDir === 'asc' ? 1 : -1;
  return list.slice().sort(function(a, b) {
    var va, vb;
    if (ofSortField === 'date') {
      va = Date.parse(a.date.replace(' ', 'T'));
      vb = Date.parse(b.date.replace(' ', 'T'));
      if (isNaN(va) || isNaN(vb)) return dir * String(a.date || '').localeCompare(String(b.date || ''));
    } else if (ofSortField === 'orderNum') {
      return dir * String(a.orderNum || '').localeCompare(String(b.orderNum || ''), 'fr', { numeric: true });
    } else {
      va = a[ofSortField];
      vb = b[ofSortField];
    }
    if (va == null) return 1;
    if (vb == null) return -1;
    return dir * (va > vb ? 1 : va < vb ? -1 : 0);
  });
}

function ofToggleSort(field) {
  if (ofSortField === field) {
    ofSortDir = ofSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    ofSortField = field;
    ofSortDir = 'asc';
  }
  renderOrdersList();
}

function ofSortIcon(field) {
  if (ofSortField !== field) return '<i data-lucide="chevrons-up-down" style="width:12px;height:12px;"></i>';
  return ofSortDir === 'asc'
    ? '<i data-lucide="arrow-up" style="width:12px;height:12px;"></i>'
    : '<i data-lucide="arrow-down" style="width:12px;height:12px;"></i>';
}

function ofSortBtn(label, field) {
  return '<button type="button" class="dt-sort-btn ' + (ofSortField === field ? 'sorted' : '') + '" onclick="ofToggleSort(\'' + field + '\')">' + escapeHtml(label) + ' ' + ofSortIcon(field) + '</button>';
}

/* ─── Requêtes sauvegardées ─── */
function renderSavedQueries() {
  var box = document.getElementById('savedQueriesBox');
  if (!box) return;
  if (!ofSavedQueries.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = 'flex';
  box.innerHTML = '<span class="sq-label"><i data-lucide="bookmark" style="width:12px;height:12px;"></i> Favoris :</span>'
    + ofSavedQueries.map(function(q, i) {
        return '<span class="sq-chip' + (q.text === ofFilterText ? ' active' : '') + '" onclick="applySavedQuery(' + i + ')">'
        + escapeHtml(q.name)
        + '<button type="button" class="sq-chip-del" onclick="event.stopPropagation();deleteSavedQuery(' + i + ')" aria-label="Supprimer">×</button>'
        + '</span>';
    }).join('');
  renderLucide();
}

function saveCurrentQuery() {
  var q = ofFilterText.trim();
  if (!q) { showToast('Saisissez d\'abord un filtre.', 'warning'); return; }
  var name = q.length > 22 ? q.slice(0, 22) + '…' : q;
  if (ofSavedQueries.some(function(x) { return x.name === name; })) {
    showToast('Ce filtre est déjà dans vos favoris.', 'error'); return;
  }
  ofSavedQueries.push({ name: name, text: q });
  safeSave(STORAGE_KEYS.savedQueries, ofSavedQueries);
  renderSavedQueries();
  showToast('Filtre enregistré.', 'success');
}

function applySavedQuery(i) {
  var q = ofSavedQueries[i];
  if (!q) return;
  var input = document.getElementById('ordersSearch');
  if (input) input.value = q.text;
  ofSetFilter(q.text);
}

function deleteSavedQuery(i) {
  var q = ofSavedQueries[i];
  if (!q) return;
  showModal('Supprimer le filtre', 'Retirer « ' + q.name + ' » des favoris ?', '🗑️', function() {
    ofSavedQueries.splice(i, 1);
    safeSave(STORAGE_KEYS.savedQueries, ofSavedQueries);
    renderSavedQueries();
    showToast('Filtre supprimé.', 'info');
  });
}

/* ─── Sélection ─── */
function ofToggleSelect(realIdx) {
  var o = orders[realIdx];
  if (!o) return;
  if (ofSelected.has(o.orderNum)) ofSelected.delete(o.orderNum);
  else ofSelected.add(o.orderNum);
  renderOrdersList();
}

function ofToggleSelectAll() {
  var list = sortedOrders(filteredOrders());
  var allSelected = list.length > 0 && list.every(function(o) { return ofSelected.has(o.orderNum); });
  list.forEach(function(o) { allSelected ? ofSelected.delete(o.orderNum) : ofSelected.add(o.orderNum); });
  renderOrdersList();
}

function clearOrderSelection() {
  ofSelected.clear();
  renderOrdersList();
}

function deleteSelectedOrders() {
  if (ofSelected.size === 0) return;
  showModal('Supprimer', 'Supprimer ' + ofSelected.size + ' commande(s) ?', '🗑️', function() {
    var removedNums = new Set(ofSelected);
    orders = orders.filter(function(o) { return !removedNums.has(o.orderNum); });
    ofSelected.clear();
    if (currentOrderA && removedNums.has(currentOrderA.orderNum)) currentOrderA = bestOrderForLine('A');
    if (currentOrderB && removedNums.has(currentOrderB.orderNum)) currentOrderB = bestOrderForLine('B');
    safeSave(STORAGE_KEYS.orders, orders);
    fsSave('orders', orders);
    renderOrdersList();
    syncToAllTabs();
    showToast('Commande(s) supprimée(s)', 'warning');
  });
}

/* ─── Export ─── */
function exportSelectedOrders(format) {
  if (ofSelected.size === 0) return;
  var selected = orders.filter(function(o) { return ofSelected.has(o.orderNum); });
  var now = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    var csv = 'Type,Ref,Date,Grume,Centrale,Laterales,Disques,Consommé,Chute\n';
    selected.forEach(function(o) { csv += 'OF,"' + o.orderNum + '","' + o.date + '",' + o.logWidth + ',' + o.central + ',"' + (o.laterals||[]).join(';') + '",' + o.diskCount + ',' + o.totalConsumed + ',' + o.chute + '\n'; });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'selection-OF-' + now + '.csv';
    a.click(); URL.revokeObjectURL(a.href);
    showToast('CSV exporté (' + selected.length + ' OF)', 'success');
  } else {
    var data = { version: '6.1', date: now, orders: selected };
    var a2 = document.createElement('a');
    a2.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a2.download = 'selection-OF-' + now + '.json';
    a2.click(); URL.revokeObjectURL(a2.href);
    showToast('JSON exporté (' + selected.length + ' OF)', 'success');
  }
}

function exportSelectedExcel() {
  if (ofSelected.size === 0) return;
  var selected = orders.filter(function(o) { return ofSelected.has(o.orderNum); });
  var esc = escapeXml;
  var rows = '';
  selected.forEach(function(o) {
    rows += '<Row><Cell><Data ss:Type="String">' + esc(o.orderNum) + '</Data></Cell>'
      + '<Cell><Data ss:Type="String">' + esc(o.date) + '</Data></Cell>'
      + '<Cell><Data ss:Type="String">' + esc(dashboardRenderer.ofLine(o)) + '</Data></Cell>'
      + '<Cell><Data ss:Type="Number">' + (o.logWidth || 0) + '</Data></Cell>'
      + '<Cell><Data ss:Type="Number">' + (o.central || 0) + '</Data></Cell>'
      + '<Cell><Data ss:Type="String">' + esc((o.laterals || []).join(', ')) + '</Data></Cell>'
      + '<Cell><Data ss:Type="Number">' + (o.pieceCount || 0) + '</Data></Cell>'
      + '<Cell><Data ss:Type="Number">' + (o.diskCount || 0) + '</Data></Cell>'
      + '<Cell><Data ss:Type="Number">' + (o.totalConsumed || 0) + '</Data></Cell>'
      + '<Cell><Data ss:Type="Number">' + (o.chute || 0) + '</Data></Cell></Row>';
  });
  var content = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<?mso-application progid="Excel.Sheet"?>\n'
    + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Selection"><Table>'
    + '<Row><Cell><Data ss:Type="String">N° OF</Data></Cell><Cell><Data ss:Type="String">Date</Data></Cell><Cell><Data ss:Type="String">Ligne</Data></Cell><Cell><Data ss:Type="String">Grume (mm)</Data></Cell><Cell><Data ss:Type="String">Centre (mm)</Data></Cell><Cell><Data ss:Type="String">Latérales (mm)</Data></Cell><Cell><Data ss:Type="String">Pieces</Data></Cell><Cell><Data ss:Type="String">Disques</Data></Cell><Cell><Data ss:Type="String">Consommé (mm)</Data></Cell><Cell><Data ss:Type="String">Chute (mm)</Data></Cell></Row>'
    + rows + '</Table></Worksheet></Workbook>';
  var filename = 'selection-OF-' + new Date().toISOString().slice(0,10) + '.xls';
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
    try {
      window.Capacitor.Plugins.Filesystem.writeFile({ path: filename, data: content, directory: 'DOCUMENTS', encoding: 'UTF8', recursive: true })
        .then(function() { showToast('Excel sauvegardé : ' + filename, 'success'); })
        .catch(function() { downloadExcelFallback(content, filename); });
      return;
    } catch (e) { /* fallback */ }
  }
  downloadExcelFallback(content, filename);
}

/* ─── PDF OF ─── */
function renderOrderPDF(o) {
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
  css += '.of-title{font-size:22px;font-weight:800;color:#059669;}';
  css += '.of-sub{font-size:11px;color:#666;margin-top:2px;}';
  css += '.of-section{margin-bottom:12px;}.of-section-title{font-size:13px;font-weight:700;color:#059669;border-bottom:1px solid #d1d5db;padding-bottom:3px;margin-bottom:8px;text-transform:uppercase;}';
  css += '.of-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;}';
  css += '.of-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dotted #e5e7eb;font-size:12px;}';
  css += '.of-label{color:#666;font-weight:600;}.of-val{font-weight:700;text-align:right;}';
  css += '.of-chute-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:700;font-size:12px;' + chuteClass + 'background:#fef3c7;}';
  return '<style>' + css + '</style>'
    + '<div class="of-page">'
    + '<div class="of-header"><img class="of-logo" src="' + logoSrc + '" alt="Charben">'
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
    + '</div>';
}

function exportOrderPDF(idx) {
  if (idx < 0 || idx >= orders.length) { showToast('OF introuvable', 'error'); return; }
  var html = renderOrderPDF(orders[idx]);
  document.getElementById('pdfViewerTitle').textContent = 'OF ' + (orders[idx].orderNum || '');
  document.getElementById('pdfViewerBody').innerHTML = html;
  document.getElementById('pdfViewerOverlay').classList.add('open');
}

/* ─── Gestion OF ─── */
function setOrderAsRef(idx) {
  if (idx >= 0 && idx < orders.length) {
    var o = orders[idx];
    var ofLine = dashboardRenderer.ofLine(o);
    setLineOrder(ofLine, o);
    if (ofLine === ofActiveLine) syncToAllTabs();
    showToast(o.orderNum + ' sélectionné (ligne ' + ofLine + ')', 'info');
  }
}

function logOfChange(orderNum, field, oldVal, newVal) {
  if (oldVal === newVal) return;
  ofHistory.unshift({
    ts: new Date().toISOString(), orderNum: orderNum, field: field,
    oldVal: oldVal == null ? '' : String(oldVal), newVal: newVal == null ? '' : String(newVal),
    user: currentUser ? currentUser.email : 'system'
  });
  if (ofHistory.length > 500) ofHistory = ofHistory.slice(0, 500);
  localStorage.setItem('charben_of_history', JSON.stringify(ofHistory));
}

function ofYieldStats(o) {
  var res = { mpM3: 0, wipM3: 0, pct: null, L: parseFloat(o.pieceLength) || 0, pieces: 0 };
  if (!o) return res;
  var launched = lineLaunchedForOf(dashboardRenderer.ofLine(o), o.orderNum) || [];
  launched.forEach(function(l) {
    var gm = rawMaterials.find(function(x) { return x.code === l.code; });
    if (gm) res.mpM3 += parseFloat(gm.volume) || 0;
  });
  (o.semiItems || []).forEach(function(it) {
    res.pieces += it.qty || 0;
    res.wipM3 += (it.qty || 0) * (it.volume || 0);
  });
  res.mpM3 = +res.mpM3.toFixed(3);
  res.wipM3 = +res.wipM3.toFixed(3);
  if (res.mpM3 > 0) res.pct = +((res.wipM3 / res.mpM3) * 100).toFixed(1);
  return res;
}

function viewOfHistory(orderNum) {
  if (!orderNum) return;
  var list = ofHistory.filter(function(h) { return h.orderNum === orderNum; }).slice(0, 50);
  var html = '<div class="card" style="padding:14px;max-height:60vh;overflow-y:auto;">';
  if (!list.length) {
    html += '<div style="font-size:12px;color:var(--text-muted);">Aucune modification enregistrée.</div>';
  } else {
    html += '<div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">' + list.length + ' modification(s)</div>';
    list.forEach(function(h) {
      var d = new Date(h.ts);
      var dt = d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      var label = h.field === 'status' ? 'Statut' : h.field === 'qty' ? 'Quantité' : h.field === 'producedQty' ? 'Qté produite' : h.field;
      html += '<div style="font-size:12px;padding:6px 0;border-bottom:1px solid var(--border-color);">'
        + '<div style="display:flex;justify-content:space-between;"><strong>' + escapeHtml(label) + '</strong><span style="color:var(--text-muted);font-size:10px;">' + escapeHtml(dt) + '</span></div>'
        + '<div style="color:var(--text-muted);">' + escapeHtml(h.oldVal || '—') + ' → <strong>' + escapeHtml(h.newVal || '—') + '</strong></div></div>';
    });
  }
  html += '</div>';
  document.getElementById('ofDetailTitle').textContent = 'Historique OF ' + orderNum;
  document.getElementById('ofDetailBody').innerHTML = html;
  document.getElementById('ofDetailActions').style.display = 'none';
}
