/* ============================================================
   PDF EXPORT — Diagram zoom, plan A4, viewer, share
   Extrait de app.js — Phase 2A découpage
   Charge APRÈS app.js (utilise lastPatternInfo, getCombination…)
   ============================================================ */

function openDiagramZoom() {
  if (!lastPatternInfo) return;
  var info = lastPatternInfo;
  var body = document.getElementById('diagramZoomBody');
  var bigDiagram = buildSettingsDiagram(info.center, info.laterals, info.outerRings, true, info.central2);
  var zoomMachine = info.line ? info.line + '1' : null;
  var lateralDetailRows = info.laterals.map(function(l, i) {
    return '<tr><td>Cale latérale' + (info.hasSide2 ? (i === 0 ? ' principale' : ' secondaire (exception)') : '') + '</td><td>' + getCombination(l, zoomMachine) + ' mm</td></tr>';
  }).join('');
  var N = info.laterals.length;
  var cc2 = (parseFloat(info.central2) > 0) ? parseFloat(info.central2) : 0;
  var diskCount = 2 * (N + 1) + 1 + (cc2 > 0 ? 2 : 0);
  var lateralsSum = info.laterals.reduce(function(a, b) { return a + b; }, 0);
  var totalMm = Math.round(2 * info.center + 2 * cc2 + 2 * lateralsSum + 2 * info.outerRings + diskCount * DISK_THICKNESS);
  var stockRows = Object.entries(info.totalNeeded)
    .sort(function(a, b) { return b[0] - a[0]; })
    .map(function(entry) {
      var size = entry[0], needed = entry[1];
      var dis = stockDispoFor(info.line ? info.line + '1' : null, size);
      var ok = dis.total >= needed;
      return '<tr><td>Cale ' + size + 'mm</td><td style="color:' + (ok ? 'inherit' : 'var(--danger)') + ';">besoin ' + needed + ' / dispo ' + dis.total + ' (kit ' + dis.kit + ' + magasin ' + dis.magasin + ') ' + (ok ? '✅' : '⚠️') + '</td></tr>';
    }).join('');
  body.innerHTML = bigDiagram
    + '<table class="zoom-detail-table">'
    + '<tr><td>Modèle</td><td>' + escapeHtml(info.pKey) + '</td></tr>'
    + '<tr><td>Cale centre</td><td>' + getCombination(info.center, zoomMachine) + ' mm</td></tr>'
    + (cc2 > 0 ? '<tr><td>Cale CC secondaire</td><td>' + getCombination(cc2, zoomMachine) + ' mm</td></tr>' : '')
    + lateralDetailRows
    + '<tr><td>Cale de complément</td><td>' + getCombination(info.outerRings, zoomMachine) + ' mm</td></tr>'
    + '<tr><td>Nombre de disques</td><td>' + diskCount + ' × ' + DISK_THICKNESS + 'mm</td></tr>'
    + '<tr class="highlight"><td>Largeur totale de l\'arbre</td><td>' + totalMm + ' mm</td></tr>'
    + '</table>'
    + '<h4 style="margin-top:18px;font-size:13px;color:var(--text-secondary);">Consommation de stock (les 2 côtés)</h4>'
    + '<table class="zoom-detail-table">' + stockRows + '</table>'
    + (info.shortages.length ? '<div class="warning-box" style="margin-top:12px;">' + shortageDetail(info.totalNeeded, info.line ? info.line + '1' : null, info.shortages) + '</div>' : '');
  document.getElementById('diagramZoomOverlay').classList.add('open');
  var headerLogo = document.querySelector('.header-logo');
  var printLogo = document.getElementById('zoomPrintLogo');
  if (headerLogo && printLogo) printLogo.src = headerLogo.src;
  document.getElementById('zoomPrintDate').textContent = escapeHtml(info.pKey) + ' • ' + new Date().toLocaleDateString('fr-FR') + ' • SARL Charben Industrie';
}

function closeDiagramZoom() {
  document.getElementById('diagramZoomOverlay').classList.remove('open');
}

function printZoomDiagram() {
  document.body.classList.add('print-zoom-mode');
  window.print();
}

window.addEventListener('afterprint', function() {
  document.body.classList.remove('print-zoom-mode');
});

function exportToPDF() {
  var bodyEl = document.getElementById('diagramZoomBody');
  if (!bodyEl) { showToast('Aucun plan à exporter', 'error'); return; }
  showToast('Préparation du plan...', 'info');
  var svgEl = bodyEl.querySelector('svg');
  if (!svgEl) { showToast('Aucun SVG trouvé', 'error'); return; }
  var clone = svgEl.cloneNode(true);
  var svgW = parseInt(clone.getAttribute('width')) || 320;
  var svgH = parseInt(clone.getAttribute('height')) || 200;
  clone.setAttribute('width', svgW);
  clone.setAttribute('height', svgH);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  var allRects = clone.querySelectorAll('rect[fill^="url("]');
  allRects.forEach(function(r) {
    var patId = r.getAttribute('fill').replace(/url\(#/, '').replace(/\)/, '');
    var pat = clone.querySelector('#' + patId);
    if (pat) {
      var ln = pat.querySelector('line');
      if (ln) { var stroke = ln.getAttribute('stroke') || '#888'; r.setAttribute('fill', stroke.replace(/44$/, '')); }
      else { r.setAttribute('fill', '#d4b896'); }
    }
  });
  var svgData = new XMLSerializer().serializeToString(clone);
  var svgBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  var canvas = document.createElement('canvas');
  var A4_W = 2480, A4_H = 3508;
  canvas.width = A4_W; canvas.height = A4_H;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, A4_W, A4_H);
  var img = new Image();
  img.crossOrigin = 'anonymous';
  var loadTimeout = setTimeout(function() { showToast('Timeout du rendu', 'error'); }, 10000);
  img.onload = function() {
    clearTimeout(loadTimeout);
    var info = lastPatternInfo;
    var N2 = info ? info.laterals.length : 1;
    var diskCount2 = 2 * (N2 + 1) + 1;
    var lateralsSum2 = info ? info.laterals.reduce(function(a, b) { return a + b; }, 0) : 0;
    var totalMm2 = info ? Math.round(2 * info.center + 2 * lateralsSum2 + 2 * info.outerRings + diskCount2 * DISK_THICKNESS) : 0;
    var pad = 80, y = pad, ROW_H = 52;
    var FTitle = 'bold 52px Arial, sans-serif', FSub = '28px Arial, sans-serif', FH2 = 'bold 38px Arial, sans-serif';
    var FRowL = '30px Arial, sans-serif', FRowR = 'bold 34px Arial, sans-serif', FSmall = '26px Arial, sans-serif';
    ctx.fillStyle = '#1f2937'; ctx.fillRect(0, 0, A4_W, 130);
    ctx.fillStyle = '#ffffff'; ctx.font = FTitle; ctx.textAlign = 'center';
    ctx.fillText('PLAN TECHNIQUE — ARBRE DE DECOUPES 560mm', A4_W / 2, 60);
    ctx.font = FSub; ctx.fillStyle = '#d1d5db';
    var dateStr = info ? (info.pKey + ' • ' + new Date().toLocaleDateString('fr-FR') + ' • SARL Charben Industrie') : new Date().toLocaleDateString('fr-FR');
    ctx.fillText(dateStr, A4_W / 2, 100);
    y = 160; ctx.fillStyle = '#374151'; ctx.font = FH2; ctx.textAlign = 'left';
    ctx.fillText('REPARTITION SUR L\'ARBRE', pad, y); y += 20;
    var svgScale = (A4_W - pad * 2) / svgW;
    var svgDrawH = svgH * svgScale;
    ctx.drawImage(img, pad, y, A4_W - pad * 2, svgDrawH); y += svgDrawH + 40;
    if (info) {
      ctx.fillStyle = '#374151'; ctx.font = FH2; ctx.textAlign = 'left';
      ctx.fillText('FICHE DE REGLAGE', pad, y); y += 15;
      var rows = [['Modele', info.pKey], ['Cale centre', getCombination(info.center, info.line ? info.line + '1' : null) + ' mm']];
      info.laterals.forEach(function(l, i) { rows.push(['Cale laterale' + (info.hasSide2 ? (i === 0 ? ' principale' : ' secondaire') : ''), getCombination(l, info.line ? info.line + '1' : null) + ' mm']); });
      rows.push(['Cale de complement', getCombination(info.outerRings, info.line ? info.line + '1' : null) + ' mm']);
      rows.push(['Nombre de disques', diskCount2 + ' x ' + DISK_THICKNESS + 'mm']);
      rows.push(['Largeur totale', totalMm2 + ' mm']);
      y += 10;
      rows.forEach(function(r, ri) {
        var ry = y + ri * ROW_H;
        ctx.fillStyle = ri % 2 === 0 ? '#f3f0eb' : '#ffffff';
        ctx.fillRect(pad, ry - 36, A4_W - pad * 2, ROW_H);
        ctx.strokeStyle = '#e5e0d8'; ctx.lineWidth = 1;
        ctx.strokeRect(pad, ry - 36, A4_W - pad * 2, ROW_H);
        ctx.fillStyle = '#6b5a4e'; ctx.textAlign = 'left'; ctx.font = FRowL;
        ctx.fillText(r[0], pad + 16, ry - 6);
        ctx.fillStyle = '#1f2937'; ctx.font = FRowR; ctx.textAlign = 'right';
        ctx.fillText(r[1], A4_W - pad - 16, ry - 6);
      });
      y += rows.length * ROW_H + 30;
      ctx.fillStyle = '#374151'; ctx.font = FH2; ctx.textAlign = 'left';
      ctx.fillText('CONSOMMATION DE STOCK (les 2 cotes)', pad, y); y += 15;
      var stockEntries = Object.entries(info.totalNeeded).sort(function(a, b) { return b[0] - a[0]; });
      y += 10;
      stockEntries.forEach(function(entry, ri) {
        var size = entry[0], needed = entry[1];
        var avail = stockDispoFor(info.line ? info.line + '1' : null, size).total;
        var ok = avail >= needed;
        var ry = y + ri * ROW_H;
        ctx.fillStyle = ri % 2 === 0 ? '#f3f0eb' : '#ffffff';
        ctx.fillRect(pad, ry - 36, A4_W - pad * 2, ROW_H);
        ctx.strokeStyle = '#e5e0d8'; ctx.lineWidth = 1;
        ctx.strokeRect(pad, ry - 36, A4_W - pad * 2, ROW_H);
        ctx.fillStyle = '#6b5a4e'; ctx.textAlign = 'left'; ctx.font = FRowL;
        ctx.fillText('Cale ' + size + 'mm', pad + 16, ry - 6);
        ctx.fillStyle = ok ? '#1f2937' : '#b64435'; ctx.font = FRowR; ctx.textAlign = 'right';
        ctx.fillText('besoin ' + needed + ' / stock ' + avail + (ok ? ' OK' : ' !!'), A4_W - pad - 16, ry - 6);
      });
      y += stockEntries.length * ROW_H + 30;
      if (info.shortages.length) { ctx.fillStyle = '#b64435'; ctx.font = FRowR; ctx.textAlign = 'left'; ctx.fillText('Stock insuffisant pour au moins une taille.', pad, y); }
    }
    ctx.fillStyle = '#f9fafb'; ctx.fillRect(0, A4_H - 70, A4_W, 70);
    ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(0, A4_H - 70); ctx.lineTo(A4_W, A4_H - 70); ctx.stroke();
    ctx.fillStyle = '#6b7280'; ctx.font = FSmall;
    ctx.textAlign = 'left'; ctx.fillText('SARL Charben Industrie', pad, A4_H - 35);
    ctx.textAlign = 'right'; ctx.fillText(new Date().toLocaleDateString('fr-FR') + ' — Plan A4 portrait', A4_W - pad, A4_H - 35);
    var imgData = canvas.toDataURL('image/png');
    _lastPdfDataUri = imgData;
    var fileName = 'Plan_Arbre_560mm_' + new Date().toISOString().slice(0, 10) + '.png';
    var a = document.createElement('a');
    a.href = imgData; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast('Plan enregistré dans Téléchargements', 'success');
    openPdfViewer(imgData);
  };
  img.onerror = function() { clearTimeout(loadTimeout); showToast('Erreur lors du rendu du plan', 'error'); };
  img.src = svgBase64;
}

function openPdfViewer(dataUri) {
  var body = document.getElementById('pdfViewerBody');
  body.innerHTML = '<img src="' + dataUri + '" style="max-width:100%;height:auto;" />';
  document.getElementById('pdfViewerOverlay').classList.add('open');
  document.getElementById('pdfViewerTitle').textContent = 'Plan Arbre 560mm — Portrait';
}

function closePdfViewer() {
  document.getElementById('pdfViewerOverlay').classList.remove('open');
  document.getElementById('pdfViewerBody').innerHTML = '';
}

function sharePDF() {
  if (_lastPdfDataUri) {
    var a = document.createElement('a');
    a.href = _lastPdfDataUri;
    a.download = 'Plan_Arbre_560mm_' + new Date().toISOString().slice(0, 10) + '.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast('Plan téléchargé', 'success');
  } else {
    showToast('Aucun plan à partager', 'error');
  }
}
