/**
 * YIELD-HELPERS.JS — Yield calculations, fiche generation, pattern diagrams.
 * Copies EXACTES de app.js. NO DOM dependencies.
 */
'use strict';

window._yieldHelpers_getLateralValues = function() {
  const values = [];
  for (let i = 0; i < lateralCount; i++) {
    const input = document.getElementById(`lat${i}`);
    if (input && input.value) {
      const val = parseFloat(input.value);
      if (!isNaN(val) && val > 0) values.push(val);
    }
  }
  return values;
}

window._yieldHelpers_getLateralWidths = function() {
  const values = [];
  for (let i = 0; i < lateralCount; i++) {
    const input = document.getElementById(`latW${i}`);
    if (input && input.value) {
      const val = parseFloat(input.value);
      if (!isNaN(val) && val > 0) values.push(val);
    }
  }
  return values;
}

window._yieldHelpers_buildMachineStockFicheHtml = function(line, n) {
  var o = getLineOrder(line);
  if (!o) return '';
  var machine = line + n;
  var spec = MACHINE_SPECS[machine] || null;
  var launched = (typeof lineLaunchedForOf === 'function') ? lineLaunchedForOf(line, o.orderNum) : [];
  var nbGrumes = launched.filter(function(l) { return l.validatedAt; }).length;
  var longueur = o.pieceLength ? (o.pieceLength / 1000) : '?';
  var grumeLen = 0;
  launched.forEach(function(l) { var gl = parseFloat(l.longueur) || 0; if (gl > grumeLen) grumeLen = gl; });
  if (grumeLen > 0 && longueur === '?') longueur = grumeLen; // eslint-disable-line no-useless-assignment -- la valeur initiale est lue dans la condition
  var laterals = o.laterals || [];
  var COLORS = { CC: '#3b82f6', SB: '#10b981', DOSSE: '#f59e0b' };
  var rows = '';

  if (n === '2') {
    var nbCC = (o.ccQtyPerGrume || 1);
    var ccInfo = (typeof ccMachineInfo === 'function') ? ccMachineInfo(o) : null;
    var cw = (ccInfo && ccInfo.b) ? ccInfo.b : (o.centerWidth || o.logWidth || '');
    var nbCCCuts = ccInfo ? ccInfo.n : nbCC;
    rows += '<tr style="background:' + COLORS.CC + '10;border-left:3px solid ' + COLORS.CC + ';">'
      + '<td style="color:' + COLORS.CC + ';font-weight:700;">CC CENTRAL ' + escapeHtml(String(o.central)) + '×' + escapeHtml(String(cw)) + '</td>'
      + '<td>Ép. <b>' + o.central + 'mm</b> · Larg. <b>' + cw + 'mm</b></td>'
      + '<td>× <b>' + (nbCCCuts * nbGrumes) + '</b></td>'
      + '</tr>';
    if (o.central2 && parseFloat(o.central2) > 0) {
      var cc2Label = o.central2;
      var cc2Width = cw;
      rows += '<tr style="background:' + COLORS.CC + '08;border-left:3px solid ' + COLORS.CC + ';">'
        + '<td style="color:' + COLORS.CC + ';font-weight:700;">CC SECONDAIRE ' + escapeHtml(String(cc2Label)) + '×' + escapeHtml(String(cc2Width)) + '</td>'
        + '<td>Ép. <b>' + o.central2 + 'mm</b> · Larg. <b>' + cc2Width + 'mm</b></td>'
        + '<td>× <b>' + (nbCCCuts * nbGrumes) + '</b></td>'
        + '</tr>';
    } else if (ccInfo && ccInfo.extraB) {
      rows += '<tr style="background:' + COLORS.CC + '08;border-left:3px solid ' + COLORS.CC + ';">'
        + '<td style="color:' + COLORS.CC + ';font-weight:700;">CC SECONDAIRE ' + escapeHtml(String(ccInfo.extraB)) + '×' + escapeHtml(String(o.central)) + '</td>'
        + '<td>Ép. <b>' + o.central + 'mm</b> · Larg. <b>' + ccInfo.extraB + 'mm</b></td>'
        + '<td>× <b>' + (1 * nbGrumes) + '</b></td>'
        + '</tr>';
    }
  } else if (n === '3') {
    var sbInfos = (typeof sbMachineInfo === 'function') ? sbMachineInfo(o) : [];
    var sbLabels = ['SB CENTRAL', 'SB SECONDAIRE', 'SB 3', 'SB 4'];
    var nbSB = (o.lateralQtyMult || 2);
    if (sbInfos.length) {
      sbInfos.forEach(function(si, i) {
        var b = si.b || '?';
        var label = i < sbLabels.length ? sbLabels[i] : 'SB ' + (i + 1);
        rows += '<tr style="background:' + COLORS.SB + '10;border-left:3px solid ' + COLORS.SB + ';">'
          + '<td style="color:' + COLORS.SB + ';font-weight:700;">' + escapeHtml(label) + ' ' + escapeHtml(String(si.h)) + '×' + escapeHtml(String(b)) + '</td>'
          + '<td>Ép. <b>' + si.h + 'mm</b> · Larg. <b>' + b + 'mm</b></td>'
          + '<td>× <b>' + (si.n * nbSB * nbGrumes) + '</b></td>'
          + '</tr>';
      });
    } else {
      var lw = o.lateralWidths || [];
      laterals.forEach(function(lat, i) {
        var b = lw[i] || '?';
        var label = i < sbLabels.length ? sbLabels[i] : 'SB ' + (i + 1);
        rows += '<tr style="background:' + COLORS.SB + '10;border-left:3px solid ' + COLORS.SB + ';">'
          + '<td style="color:' + COLORS.SB + ';font-weight:700;">' + escapeHtml(label) + ' ' + escapeHtml(String(lat)) + '×' + escapeHtml(String(b)) + '</td>'
          + '<td>Ép. <b>' + lat + 'mm</b> · Larg. <b>' + b + 'mm</b></td>'
          + '<td>× <b>' + (nbSB * nbGrumes) + '</b></td>'
          + '</tr>';
      });
    }
  } else if (n === '4') {
    var chute = o.chute || 0;
    if (chute > 0) {
      var nbDosses = (o.dosses && o.dosses.count) ? o.dosses.count : 2;
      var dosseEp = (o.dosses && o.dosses.epaisseur) ? o.dosses.epaisseur : DISK_THICKNESS;
      var dosseLarg = +(chute / nbDosses).toFixed(1);
      rows += '<tr style="background:' + COLORS.DOSSE + '10;border-left:3px solid ' + COLORS.DOSSE + ';">'
        + '<td style="color:' + COLORS.DOSSE + ';font-weight:700;">Dosses ' + dosseEp + '×' + dosseLarg + '</td>'
        + '<td>Ép. <b>' + dosseEp + 'mm</b> · Larg. <b>' + dosseLarg + 'mm</b></td>'
        + '<td>× <b>' + (nbDosses * nbGrumes) + '</b></td>'
        + '</tr>';
    }
  }

  if (!rows) return '';

  var uid = 'ficheStock_' + machine + '_' + (o.orderNum || '').replace(/[^a-zA-Z0-9]/g, '_');
  var html = '<div class="card" style="margin-top:12px;padding:0;overflow:hidden;">'
    + '<details id="' + uid + '" class="fiche-a1">'
    + '<summary class="fiche-summary" style="cursor:pointer;padding:10px 14px;font-size:13px;font-weight:700;user-select:none;display:flex;justify-content:space-between;align-items:center;">'
    + '<span>📋 Fiche de stock ' + machine + ' — ' + escapeHtml(o.orderNum) + (nbGrumes ? ' (' + nbGrumes + ' grume(s))' : '') + '</span>'
    + '<span class="fiche-chevron" style="font-size:11px;color:var(--text-muted);">▼</span>'
    + '</summary>'
    + '<div style="padding:0 14px 12px;">';
  if (spec) {
    html += '<div style="font-size:10px;color:var(--text-muted);line-height:1.6;margin-bottom:6px;">'
      + 'Ouverture <b>' + spec.openingW + '×' + spec.openingH + 'mm</b> · Axe max <b>' + spec.arbor + 'mm</b>'
      + (spec.axes > 1 ? ' · ' + spec.axes + ' axes parallèles' : '')
      + '</div>';
  }
  if (o.essence && GAMME_ESSENCES[o.essence]) {
    html += '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;">Essence : <b>' + escapeHtml(GAMME_ESSENCES[o.essence].label) + '</b> · grume initiale : <b>' + escapeHtml(String(o.logWidth)) + 'mm</b></div>';
  }
  html += '<table class="result-table" style="width:100%;border-collapse:collapse;font-size:11px;">'
    + '<thead><tr style="border-bottom:2px solid var(--border-color);">'
    + '<th style="text-align:left;padding:6px 4px;">Découpe ' + machine + '</th>'
    + '<th style="text-align:left;padding:6px 4px;">Dimensions</th>'
    + '<th style="text-align:left;padding:6px 4px;">Qté totale</th>'
    + '</tr></thead><tbody>'
    + rows
    + '</tbody></table>'
    + '</div></details></div>';

  return html;
}

/* ─────────────────────────────────────────────
   rendementMFColor — couleur du rendement VOLUMIQUE (manœuvre de sciage)

   Le rendement matière (MF = volume semi-finis / volume grumes) est un
   rendement volumique, typiquement 20-40 %. Les seuils de section (80/60,
   ~90 % d'occupation de largeur) ne s'y appliquent PAS : ils afficheraient
   rouge en permanence. Barème validé (Plan S2) : vert > 25 %, orange 20-25 %,
   rouge < 20 %. Le taux de section garde ses propres seuils 80/60.
   ───────────────────────────────────────────── */
window._yieldHelpers_rendementMFColor = function rendementMFColor(pct) {
  var v = parseFloat(pct);
  if (!isFinite(v)) return '#ef4444';
  if (v > 25) return '#10b981';
  if (v >= 20) return '#f59e0b';
  return '#ef4444';
};

window._yieldHelpers_buildYieldFicheHtml = function(o) {
  if (!o || !o.logWidth) return '';
  var line = dashboardRenderer.ofLine(o);
  var launched = (typeof lineLaunchedForOf === 'function') ? lineLaunchedForOf(line, o.orderNum) : [];
  var sumSingle = o.central + (o.laterals || []).reduce(function(a, b) { return a + b; }, 0);
  var sumDouble = sumSingle * 2;
  var diskCount = o.diskCount || (2 * (1 + (o.laterals || []).length) + 1);
  var diskTotal = diskCount * DISK_THICKNESS;
  var totalConsumed = sumDouble + diskTotal;

  var rows = '';
  var nbLancees = 0;
  var totalGrumeM3 = 0;
  var totalSFM3 = 0;
  (o.semiItems || []).forEach(function(it) { totalSFM3 += (it.volume || 0) * (it.qty || 0); });

  if (launched.length) {
    launched.forEach(function(l, i) {
      var g = (typeof rawMaterials !== 'undefined' ? rawMaterials : []).find(function(x) { return x.code === l.code; });
      var gw = g ? (g.diametre || 0) * 10 : (l.widthMm || 0);
      var gLen = l.longueur || (g ? (g.longueur || 0) : 0);
      var gM3 = g ? (parseFloat(g.volume) || 0) : 0;
      totalGrumeM3 += gM3;
      var chute = +(gw - totalConsumed).toFixed(2); if (chute < 0) chute = 0;
      var rendement = gw > 0 ? +((totalConsumed / gw) * 100).toFixed(1) : 0;
      var dossesPct = gw > 0 ? +((chute / gw) * 100).toFixed(1) : 0;
      var perDosse = chute > 0 ? +(chute / 2).toFixed(1) : 0;
      var validation = l.validatedAt ? '<span style="color:#10b981;">✅</span>' : '<span style="color:#f59e0b;">⏳</span>';
      nbLancees++;
      var rendColor = rendement >= 80 ? '#10b981' : rendement >= 60 ? '#f59e0b' : '#ef4444';
      rows += '<tr>'
        + '<td style="text-align:center;">' + (i + 1) + '</td>'
        + '<td style="font-weight:700;">' + escapeHtml(l.code || '—') + '</td>'
        + '<td>Ø' + gw + 'mm</td>'
        + '<td>' + (gLen > 0 ? gLen + ' m' : '—') + '</td>'
        + '<td>' + o.central + '×2=' + (o.central * 2) + '</td>'
        + '<td>' + (o.laterals || []).map(function(x){ return x + '×2=' + (x * 2); }).join(', ') + '</td>'
        + '<td>' + diskCount + '×' + DISK_THICKNESS + '=' + diskTotal + '</td>'
        + '<td style="font-weight:700;">' + totalConsumed + 'mm</td>'
        + '<td>' + gM3.toFixed(3) + ' m³</td>'
        + '<td>' + chute + 'mm</td>'
        + '<td>2×' + perDosse + 'mm</td>'
        + '<td style="font-weight:700;color:' + rendColor + ';">' + rendement + '%</td>'
        + '<td>' + dossesPct + '%</td>'
        + '<td>' + validation + '</td>'
        + '</tr>';
    });
  }

  var rendementMF = totalGrumeM3 > 0 && totalSFM3 > 0 ? ((totalSFM3 / totalGrumeM3) * 100).toFixed(1) : '—';

  var html = '<details class="yield-fiche" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border-color);">'
    + '<summary style="cursor:pointer;padding:10px 14px;font-size:13px;font-weight:700;list-style:none;">📊 Détail du rendement — ' + o.orderNum + '</summary>'
    + '<div style="padding:0 14px 12px;">'
    + '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;">'
    + 'Centre: <b>' + o.central + 'mm</b> · '
    + 'Latérale(s): <b>' + (o.laterals || []).join(', ') + 'mm</b> · '
    + 'Disques: <b>' + diskCount + ' × ' + DISK_THICKNESS + 'mm = ' + diskTotal + 'mm</b> · '
    + 'Total consommé: <b>' + totalConsumed + 'mm</b>'
    + '</div>';

  if (nbLancees > 0) {
    html += '<div style="overflow-x:auto;">'
      + '<table class="result-table" style="width:100%;border-collapse:collapse;font-size:11px;">'
      + '<thead><tr style="border-bottom:2px solid var(--border-color);">'
      + '<th style="padding:6px 4px;">#</th>'
      + '<th style="padding:6px 4px;text-align:left;">Code grume</th>'
      + '<th style="padding:6px 4px;">Ø</th>'
      + '<th style="padding:6px 4px;">Longueur</th>'
      + '<th style="padding:6px 4px;">Centre</th>'
      + '<th style="padding:6px 4px;">Lat.</th>'
      + '<th style="padding:6px 4px;">Disques</th>'
      + '<th style="padding:6px 4px;">Consommé</th>'
      + '<th style="padding:6px 4px;">Volume</th>'
      + '<th style="padding:6px 4px;">Chute</th>'
      + '<th style="padding:6px 4px;">Dosses</th>'
      + '<th style="padding:6px 4px;">Rendement</th>'
      + '<th style="padding:6px 4px;">Dosses %</th>'
      + '<th style="padding:6px 4px;">Statut</th>'
      + '</tr></thead><tbody>'
      + rows
      + '</tbody></table></div>';
    if (rendementMF !== '—') {
      html += '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:8px;font-size:11px;">'
        + '<span>MP consommé: <b>' + totalGrumeM3.toFixed(3) + ' m³</b></span>'
        + '<span>SF produit: <b>' + totalSFM3.toFixed(4) + ' m³</b></span>'
        + '<span style="font-weight:700;color:' + window._yieldHelpers_rendementMFColor(rendementMF) + ';">Rendement réel: ' + rendementMF + '%</span>'
        + '</div>';
    }
  } else {
    html += '<div style="font-size:12px;color:var(--text-muted);padding:10px 0;">Aucune grume lancée sur cet OF.</div>';
  }

  html += '</div></details>';
  return html;
}

window._yieldHelpers_buildYieldUnifiedTable = function(o) {
  if (!o || !o.logWidth) return '';
  var line = dashboardRenderer.ofLine(o);
  var launched = (typeof lineLaunchedForOf === 'function') ? lineLaunchedForOf(line, o.orderNum) : [];
  
  // Calculs de base
  var sumSingle = o.central + (o.laterals || []).reduce(function(a, b) { return a + b; }, 0);
  var sumDouble = sumSingle * 2;
  var diskCount = 2 * (1 + (o.laterals || []).length) + 1;
  var diskTotal = diskCount * DISK_THICKNESS;
  var totalConsumed = sumDouble + diskTotal;
  
  // Largeur réelle de la dernière grume lancée
  var lastLaunched = launched.length > 0 ? launched[launched.length - 1] : null;
  var g = lastLaunched ? rawMaterials.find(function(x) { return x.code === lastLaunched.code; }) : null;
  var realWidthMm = g ? (g.diametre || 0) * 10 : (lastLaunched ? (lastLaunched.widthMm || 0) : 0);
  var effectiveLogWidth = realWidthMm > 0 ? realWidthMm : o.logWidth;
  var chute = +(effectiveLogWidth - totalConsumed).toFixed(2);
  if (chute < 0) chute = 0;
  var rendement = effectiveLogWidth > 0 ? +((totalConsumed / effectiveLogWidth) * 100).toFixed(1) : 0;
  var dossesPct = effectiveLogWidth > 0 ? +((chute / effectiveLogWidth) * 100).toFixed(1) : 0;
  var perDosse = chute > 0 ? +(chute / 2).toFixed(1) : 0;
  
  // Volume grume
  var gM3 = g ? (parseFloat(g.volume) || 0) : 0;
  var totalSFM3 = 0;
  (o.semiItems || []).forEach(function(it) { totalSFM3 += (it.volume || 0) * (it.qty || 0); });
  var rendementMF = gM3 > 0 && totalSFM3 > 0 ? ((totalSFM3 / gM3) * 100).toFixed(1) : '—';
  
  var html = '<div class="card no-print" style="margin-top:12px;padding:14px;">'
    + '<div style="font-size:13px;font-weight:700;margin-bottom:10px;">📊 Détail du rendement — ' + o.orderNum + '</div>'
    + '<table class="result-table" style="width:100%;border-collapse:collapse;font-size:12px;">'
    + '<tbody>'
    // Grume lancée
    + '<tr><td style="font-weight:700;padding:6px 8px;background:var(--glass-bg);">🪵 Grume lancée</td>'
    + '<td style="padding:6px 8px;"><b>' + (lastLaunched ? escapeHtml(lastLaunched.code) : '—') + '</b> — Ø' + effectiveLogWidth + 'mm' + (gM3 > 0 ? ' — ' + gM3.toFixed(3) + ' m³' : '') + '</td></tr>'
    // Épaisseurs découpées
    + '<tr><td style="font-weight:700;padding:6px 8px;background:var(--glass-bg);">🔹 Centre (CC)</td>'
    + '<td style="padding:6px 8px;">' + o.central + 'mm × 2 = <b>' + (o.central * 2) + 'mm</b></td></tr>'
    + (o.laterals || []).map(function(lat, i) {
      return '<tr><td style="font-weight:700;padding:6px 8px;background:var(--glass-bg);">🔹 Latérale ' + (i + 1) + ' (SB)</td>'
        + '<td style="padding:6px 8px;">' + lat + 'mm × 2 = <b>' + (lat * 2) + 'mm</b></td></tr>';
    }).join('')
    // Disques
    + '<tr><td style="font-weight:700;padding:6px 8px;background:var(--glass-bg);">⚙️ Disques</td>'
    + '<td style="padding:6px 8px;">' + diskCount + ' × ' + DISK_THICKNESS + 'mm = <b>' + diskTotal + 'mm</b></td></tr>'
    // Total consommé
    + '<tr><td style="font-weight:700;padding:6px 8px;background:var(--glass-bg);">✅ Total consommé</td>'
    + '<td style="padding:6px 8px;"><b>' + totalConsumed + 'mm</b></td></tr>'
    // Chute
    + '<tr><td style="font-weight:700;padding:6px 8px;background:var(--glass-bg);">📐 Chute totale</td>'
    + '<td style="padding:6px 8px;"><b>' + chute + 'mm</b> (' + effectiveLogWidth + ' − ' + totalConsumed + ')</td></tr>'
    // Dosses A4
    + (chute > 0 ? '<tr><td style="font-weight:700;padding:6px 8px;background:rgba(16,185,129,0.1);">♻️ Dosses récupérables (A4)</td>'
      + '<td style="padding:6px 8px;"><b>2 dosse(s) × ' + perDosse + 'mm</b> — Ép. ' + DISK_THICKNESS + 'mm — Larg. ≈' + perDosse + 'mm</td></tr>'
      : '<tr><td style="font-weight:700;padding:6px 8px;background:rgba(16,185,129,0.1);">♻️ Dosses récupérables (A4)</td>'
      + '<td style="padding:6px 8px;">Aucune (chute = 0)</td></tr>')
    // Rendement
    + '<tr><td style="font-weight:700;padding:6px 8px;background:rgba(59,130,246,0.1);">📊 Rendement (pièces)</td>'
    + '<td style="padding:6px 8px;"><b style="font-size:14px;color:' + (rendement >= 80 ? '#10b981' : rendement >= 60 ? '#f59e0b' : '#ef4444') + ';">' + rendement + '%</b></td></tr>'
    // Rendement dosses
    + (chute > 0 ? '<tr><td style="font-weight:700;padding:6px 8px;background:rgba(16,185,129,0.1);">♻️ Récupération dosses (A4)</td>'
      + '<td style="padding:6px 8px;"><b style="font-size:14px;color:#10b981;">' + dossesPct + '%</b></td></tr>'
      : '')
    // Rendement MF
    + (rendementMF !== '—' ? '<tr><td style="font-weight:700;padding:6px 8px;background:var(--glass-bg);">🏭 Rendement matière (MF)</td>'
      + '<td style="padding:6px 8px;"><b style="font-size:14px;color:' + window._yieldHelpers_rendementMFColor(rendementMF) + ';">' + rendementMF + '%</b></td></tr>'
      : '')
    + '</tbody></table>'
    + '</div>';
  
  return html;
}

window._yieldHelpers_buildYieldGrumeLaunchedTable = function(o) {
  if (!o || !o.orderNum) return '';
  var line = dashboardRenderer.ofLine(o);
  var launched = (typeof lineLaunchedForOf === 'function') ? lineLaunchedForOf(line, o.orderNum) : [];
  if (!launched.length) return '';
  var rows = '';
  var totalGrumeM3 = 0;
  var totalSFCount = (o.semiItems || []).length;
  var totalSFM3 = 0;
  (o.semiItems || []).forEach(function(it) { totalSFM3 += (it.volume || 0) * (it.qty || 0); });
  launched.forEach(function(l, i) {
    var g = (typeof rawMaterials !== 'undefined' ? rawMaterials : []).find(function(x) { return x.code === l.code; });
    var gw = g ? (g.diametre || 0) * 10 : (l.widthMm || 0);
    var gLen = l.longueur || (g ? (g.longueur || 0) : 0);
    var gM3 = g ? (parseFloat(g.volume) || 0) : 0;
    totalGrumeM3 += gM3;
    var ratio = (gM3 > 0 && totalSFM3 > 0) ? ((totalSFM3 / (totalGrumeM3 || 1)) * 100).toFixed(1) : '—';
    var validation = l.validatedAt ? '<span style="color:#10b981;">✅</span>' : '<span style="color:#f59e0b;">⏳</span>';
    rows += '<tr>'
      + '<td style="font-size:11px;">' + (i + 1) + '</td>'
      + '<td style="font-size:11px;"><b>' + escapeHtml(l.code || '—') + '</b></td>'
      + '<td style="font-size:11px;">Ø' + gw + 'mm</td>'
      + '<td style="font-size:11px;">' + (gLen > 0 ? gLen + ' m' : '—') + '</td>'
      + '<td style="font-size:11px;">' + (gM3 > 0 ? gM3.toFixed(3) + ' m³' : '—') + '</td>'
      + '<td style="font-size:11px;">' + validation + '</td>'
      + '</tr>';
  });
  var rendementMF = totalGrumeM3 > 0 && totalSFM3 > 0
    ? ((totalSFM3 / totalGrumeM3) * 100).toFixed(1)
    : '—';
  return '<details class="card no-print" style="margin-top:12px;padding:0;overflow:hidden;">'
    + '<summary style="cursor:pointer;padding:10px 14px;font-size:12px;font-weight:700;list-style:none;">🪵 Rendement par grume lancée · ' + launched.length + ' grume(s)</summary>'
    + '<div style="padding:0 14px 12px;overflow-x:auto;">'
    + '<table class="result-table" style="width:100%;border-collapse:collapse;font-size:11px;">'
    + '<thead><tr style="border-bottom:2px solid var(--border-color);">'
    + '<th style="text-align:left;padding:6px 8px;">#</th>'
    + '<th style="text-align:left;padding:6px 8px;">Code</th>'
    + '<th style="text-align:left;padding:6px 8px;">Diamètre</th>'
    + '<th style="text-align:left;padding:6px 8px;">Longueur</th>'
    + '<th style="text-align:left;padding:6px 8px;">Volume grume</th>'
    + '<th style="text-align:left;padding:6px 8px;">Statut</th>'
    + '</tr></thead><tbody>' + rows + '</tbody></table>'
    + '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:8px;font-size:11px;">'
    + '<span>Volume MP consommé : <b>' + totalGrumeM3.toFixed(3) + ' m³</b></span>'
    + '<span>Volume SF produit : <b>' + totalSFM3.toFixed(4) + ' m³</b></span>'
        + '<span style="font-weight:700;color:' + (rendementMF !== '—' ? window._yieldHelpers_rendementMFColor(rendementMF) : '#ef4444') + ';">Rendement réel MF : ' + rendementMF + '%</span>'
    + '</div>'
    + '</div></details>';
}

window._yieldHelpers_buildYieldDiagram = function(o, chuteGauche, chuteDroite) {
  const logW = o.logWidth;
  const centre = o.central;
  const laterals = o.laterals;

  const SVG_H = 240;
  const BAR_Y = 78;
  const BAR_H = 56;
  const SCALE = Math.min(0.65, 600 / logW);
  const DISK_PX = Math.max(DISK_THICKNESS * SCALE, 8);
  const GAP = 3.5;

  const centrePx = Math.max(centre * SCALE, 28);
  const lateralsPx = laterals.map(l => Math.max(l * SCALE, 18));
  const chuteGauchePx = Math.max(chuteGauche * SCALE, 12);
  const chuteDroitePx = Math.max(chuteDroite * SCALE, 12);

  function buildSegments(isRight) {
    const segs = [];
    let xPos = isRight ? DISK_PX + GAP : -(DISK_PX + GAP);
    segs.push({ type: 'board', label: `${centre}`, w: centrePx, x: isRight ? xPos : xPos - centrePx, color: '#a86e36', stroke: '#7d4f1f', idx: 'C' });
    xPos = isRight ? xPos + centrePx + GAP : xPos - centrePx - GAP;
    segs.push({ type: 'disk', w: DISK_PX, x: isRight ? xPos : xPos - DISK_PX });
    xPos = isRight ? xPos + DISK_PX + GAP : xPos - DISK_PX - GAP;
    laterals.forEach((lat, i) => {
      const col = i % 2 === 0 ? '#c98f52' : '#4a8a4f';
      const stk = i % 2 === 0 ? '#8a5a2a' : '#2d5a30';
      segs.push({ type: 'board', label: `${lat}`, w: lateralsPx[i], x: isRight ? xPos : xPos - lateralsPx[i], color: col, stroke: stk, idx: `L${i+1}` });
      xPos = isRight ? xPos + lateralsPx[i] + GAP : xPos - lateralsPx[i] - GAP;
      segs.push({ type: 'disk', w: DISK_PX, x: isRight ? xPos : xPos - DISK_PX });
      xPos = isRight ? xPos + DISK_PX + GAP : xPos - DISK_PX - GAP;
    });
    const chuteVal = isRight ? chuteDroite : chuteGauche;
    const chutePxSide = isRight ? chuteDroitePx : chuteGauchePx;
    segs.push({ type: 'waste', label: `${chuteVal.toFixed(1)}`, w: chutePxSide, x: isRight ? xPos : xPos - chutePxSide, idx: 'CH' });
    return segs;
  }

  const rightSegs = buildSegments(true);
  const leftSegs = buildSegments(false);

  const rightExtent = rightSegs[rightSegs.length - 1].x + rightSegs[rightSegs.length - 1].w;
  const leftExtent = leftSegs[leftSegs.length - 1].x;
  const totalContentW = rightExtent - leftExtent;
  const OFFSET_X = -leftExtent + 50;
  const TOTAL_W = totalContentW + 100;
  const AXIS_X = totalContentW / 2 + 50;

  let rects = '';
  let callouts = [];

  function drawSeg(seg) {
    const sx = seg.x + OFFSET_X;
    const isSmall = seg.w < 36;
    if (seg.type === 'disk') {
      rects += `<rect x="${sx}" y="${BAR_Y}" width="${seg.w}" height="${BAR_H}" fill="#374151" rx="2"/>`;
      rects += `<line x1="${sx + seg.w/2}" y1="${BAR_Y}" x2="${sx + seg.w/2}" y2="${BAR_Y + BAR_H}" stroke="#555" stroke-width="0.5" stroke-dasharray="2,2"/>`;
    } else if (seg.type === 'waste') {
      rects += `<rect x="${sx}" y="${BAR_Y}" width="${seg.w}" height="${BAR_H}" fill="#b6602b" rx="4" stroke="#8a4419" stroke-width="1.2"/>`;
      rects += `<defs><pattern id="hatchW${seg.idx}" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="6" stroke="#8a441955" stroke-width="1"/></pattern></defs>`;
      rects += `<rect x="${sx}" y="${BAR_Y}" width="${seg.w}" height="${BAR_H}" fill="url(#hatchW${seg.idx})" rx="4"/>`;
      if (isSmall) {
        callouts.push(`<line x1="${sx + seg.w/2}" y1="${BAR_Y + BAR_H + 4}" x2="${sx + seg.w/2}" y2="${BAR_Y + BAR_H + 30}" stroke="#8a4419" stroke-width="0.8"/>`);
        callouts.push(`<text x="${sx + seg.w/2}" y="${BAR_Y + BAR_H + 40}" text-anchor="middle" font-size="10" fill="#8a4419" font-weight="700" font-family="Inter,sans-serif">${escapeHtml(seg.label)}mm</text>`);
      } else {
        rects += `<text x="${sx + seg.w/2}" y="${BAR_Y + BAR_H/2 + 4}" text-anchor="middle" font-size="11.5" fill="#fff" font-weight="700" font-family="Inter,sans-serif">${escapeHtml(seg.label)}mm</text>`;
      }
    } else {
      rects += `<rect x="${sx}" y="${BAR_Y}" width="${seg.w}" height="${BAR_H}" rx="5" fill="${seg.color}" stroke="${seg.stroke}" stroke-width="1.2"/>`;
      if (isSmall) {
        const side = sx + seg.w/2 < AXIS_X ? -1 : 1;
        const cx = side < 0 ? sx : sx + seg.w;
        const tx = cx + side * 7;
        callouts.push(`<line x1="${cx}" y1="${BAR_Y + BAR_H/2}" x2="${tx}" y2="${BAR_Y + BAR_H + 22}" stroke="${seg.stroke}" stroke-width="0.9"/>`);
        callouts.push(`<circle cx="${cx}" cy="${BAR_Y + BAR_H/2}" r="2" fill="${seg.stroke}"/>`);
        callouts.push(`<text x="${tx}" y="${BAR_Y + BAR_H + 32}" text-anchor="${side < 0 ? 'end' : 'start'}" font-size="10" fill="${seg.stroke}" font-weight="700" font-family="Inter,sans-serif">${escapeHtml(seg.label)}mm [${escapeHtml(seg.idx)}]</text>`);
      } else {
        rects += `<text x="${sx + seg.w/2}" y="${BAR_Y + BAR_H/2 - 2}" text-anchor="middle" font-size="12" fill="white" font-weight="700" font-family="Inter,sans-serif">${escapeHtml(seg.label)}mm</text>`;
        rects += `<text x="${sx + seg.w/2}" y="${BAR_Y + BAR_H/2 + 13}" text-anchor="middle" font-size="9.5" fill="rgba(255,255,255,0.75)" font-family="Inter,sans-serif">[${escapeHtml(seg.idx)}]</text>`;
      }
    }
  }

  rects += `<rect x="${AXIS_X - DISK_PX/2}" y="${BAR_Y}" width="${DISK_PX}" height="${BAR_H}" fill="#374151" rx="2"/>`;
  rects += `<line x1="${AXIS_X}" y1="${BAR_Y}" x2="${AXIS_X}" y2="${BAR_Y + BAR_H}" stroke="#555" stroke-width="0.5" stroke-dasharray="2,2"/>`;
  rightSegs.forEach(drawSeg);
  leftSegs.forEach(drawSeg);

  const axisLine = `
    <line x1="${AXIS_X}" y1="30" x2="${AXIS_X}" y2="${BAR_Y - 4}" stroke="#4a8a4f" stroke-width="2.5" stroke-dasharray="6,4"/>
    <circle cx="${AXIS_X}" cy="22" r="4" fill="#4a8a4f" stroke="#2d5a30" stroke-width="1"/>
    <text x="${AXIS_X}" y="14" text-anchor="middle" font-size="12" fill="#4a8a4f" font-weight="800" font-family="Inter,sans-serif" letter-spacing="0.06em">AXE 0</text>`;

  const labels = `
    <text x="${OFFSET_X + leftExtent + chuteGauchePx/2}" y="${BAR_Y - 12}" text-anchor="middle" font-size="12" fill="#6b7280" font-weight="700" font-family="Inter,sans-serif" letter-spacing="0.08em">GAUCHE</text>
    <text x="${OFFSET_X + rightExtent - chuteDroitePx/2}" y="${BAR_Y - 12}" text-anchor="middle" font-size="12" fill="#6b7280" font-weight="700" font-family="Inter,sans-serif" letter-spacing="0.08em">DROITE</text>`;

  const dimY = BAR_Y + BAR_H + 54;
  const dimLines = `
    <line x1="${OFFSET_X + leftExtent}" y1="${BAR_Y + BAR_H + 5}" x2="${OFFSET_X + leftExtent}" y2="${dimY + 2}" stroke="#9ca3af" stroke-width="0.8"/>
    <line x1="${OFFSET_X + rightExtent}" y1="${BAR_Y + BAR_H + 5}" x2="${OFFSET_X + rightExtent}" y2="${dimY + 2}" stroke="#9ca3af" stroke-width="0.8"/>
    <line x1="${OFFSET_X + leftExtent}" y1="${dimY}" x2="${OFFSET_X + rightExtent}" y2="${dimY}" stroke="#9ca3af" stroke-width="1.2"/>
    <path d="M${OFFSET_X + leftExtent} ${dimY} l5 -3 l0 6 z" fill="#9ca3af"/>
    <path d="M${OFFSET_X + rightExtent} ${dimY} l-5 -3 l0 6 z" fill="#9ca3af"/>`;

  const infoLine = `<text x="${AXIS_X}" y="${dimY + 14}" text-anchor="middle" font-size="12.5" fill="#b6602b" font-weight="800" font-family="Inter,sans-serif">Grume ${logW}mm</text>`;
  const chuteLine = `<text x="${AXIS_X}" y="${dimY + 27}" text-anchor="middle" font-size="10.5" fill="#6b7280" font-family="Inter,sans-serif">Chute gauche : ${chuteGauche}mm  |  Chute droite : ${chuteDroite}mm</text>`;

  return `
    <div class="diagram-container">
      <div class="diagram-header">Vue miroir — Repartition reelle gauche / droite</div>
      <div class="diagram-body">
        <svg width="${TOTAL_W}" height="${SVG_H}" viewBox="0 0 ${TOTAL_W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg">
          ${axisLine}
          ${labels}
          ${rects}
          ${callouts.join('')}
          ${dimLines}
          ${infoLine}
          ${chuteLine}
        </svg>
      </div>
      <div class="diagram-footer">
        <span class="legend-item"><span class="legend-dot" style="background:#a86e36;"></span>Planche centrale</span>
        <span class="legend-item"><span class="legend-dot" style="background:#c98f52;"></span>Lat. principale</span>
        <span class="legend-item"><span class="legend-dot" style="background:#4a8a4f;"></span>Lat. secondaire</span>
        <span class="legend-item"><span class="legend-dot" style="background:#374151;"></span>Disque ${DISK_THICKNESS}mm</span>
        <span class="legend-item"><span class="legend-dot" style="background:#b6602b;"></span>Chute</span>
      </div>
    </div>`;
}

window._yieldHelpers_procCalculatePattern = function(line) {
  const o = getLineOrder(line);
  const store = line === 'A' ? (lastPatternA = null) : (lastPatternB = null);
  if (!o) {
    renderLigne(line);
    return;
  }
  const center = parseFloat(o.central);
  const center2 = (parseFloat(o.central2) > 0) ? parseFloat(o.central2) : 0;
  const laterals = (o.laterals || []).map(parseFloat).filter(function(v) { return !isNaN(v) && v > 0; });
  if (isNaN(center) || center <= 0 || laterals.length === 0) {
    renderLigne(line);
    return;
  }
  const hasSide2 = laterals.length > 1;
  const N = laterals.length;
  /* Un anneau = une lame. Le CC secondaire est un anneau RÉEL :
     il coûte une lame de plus ET sa largeur dans l'arbre. */
  const diskBudget = (N + 1) + (center2 > 0 ? 1 : 0);
  const spaceForRings = 280 - (diskBudget * DISK_THICKNESS) - (DISK_THICKNESS / 2);
  const lateralsSum = laterals.reduce(function(a, b) { return a + b; }, 0);
  const outerRings = spaceForRings - center - center2 - lateralsSum;
  const pat = { center: center, central2: center2, laterals: laterals, outerRings: outerRings, hasSide2: hasSide2 };
  if (outerRings < 0) {
    pat.invalid = true;
    pat.warning = 'Dimensions de l\'OF dépassent la capacité de l\'arbre (280mm).';
    if (line === 'A') lastPatternA = pat; else lastPatternB = pat;
    renderLigne(line);
    return;
  }

  const ccCombos = [comboArray(center, line + '1')];
  if (center2 > 0) ccCombos.push(comboArray(center2, line + '1'));
  const combos = ccCombos.concat(laterals.map(function(l) { return comboArray(l, line + '1'); })).concat([comboArray(outerRings, line + '1')]);
  const totalNeeded = {};
  combos.forEach(function(combo) {
    const counts = comboToCounts(combo);
    Object.keys(counts).forEach(function(size) {
      totalNeeded[size] = (totalNeeded[size] || 0) + counts[size] * 2 * ARBORS_PER_SAW;
    });
  });
  const shortages = shortagesOf(totalNeeded, line + '1');
  pat.line = line;
  pat.totalNeeded = totalNeeded;
  pat.shortages = shortages;
  pat.orderNum = o.orderNum;
  pat.logWidth = o.logWidth;

  lastInstallNeeds = totalNeeded;
  lastInstallMachine = line + '1';
  lastPatternInfo = pat;
  if (line === 'A') { lastInstallNeedsA = totalNeeded; lastPatternA = pat; }
  else { lastInstallNeedsB = totalNeeded; lastPatternB = pat; }
  renderStockTable();
  renderLigne(line);
  renderDashboardKPIs();
}

window._yieldHelpers_buildPatternFicheHtml = function(line) {
  const pat = line === 'A' ? lastPatternA : lastPatternB;
  if (!pat) return '';
  if (pat.invalid) {
    return '<div class="warning-box" style="margin-top:10px;">⚠️ ' + escapeHtml(pat.warning) + '</div>';
  }
  const o = getLineOrder(line);
  const lateralRows = pat.laterals.map(function(l, i) {
    return '<tr><td>Cale latérale' + (pat.hasSide2 ? (i === 0 ? ' principale' : ' secondaire (exception)') : '') + '</td><td><b>' + getCombination(l, line + '1') + ' mm</b></td></tr>';
  }).join('');
  let html = '<details class="flux-fiche" style="margin-top:10px;width:100%;max-width:100%;padding:0;background:var(--bg-card, rgba(255,255,255,.04));border:1px solid var(--border-color);border-radius:12px;overflow:hidden;">';
  html += '<summary class="fiche-summary" style="cursor:pointer;padding:10px 12px;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">';
  html += '<span style="font-size:12px;font-weight:700;">📋 Fiche de réglage — ' + line + '1' + (o ? ' · ' + escapeHtml(o.orderNum) : '') + '</span>';
  html += '<span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
  html += '<span style="font-size:10px;font-weight:700;color:var(--brand-green, #2d6a4f);background:rgba(5,150,105,.1);border:1px solid rgba(5,150,105,.3);padding:2px 7px;border-radius:999px;white-space:nowrap;">× 2 arbres</span>';
  html += '<span class="fiche-chevron" style="font-size:12px;color:var(--text-muted);transition:transform .2s;">▾</span>';
  html += '</span>';
  html += '</summary>';
  html += '<div style="padding:0 12px 12px;">';
  html += '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;">' + new Date().toLocaleDateString('fr-FR') + ' · ' + (o && o.logWidth ? 'Grume ' + o.logWidth + 'mm' : 'Générée auto depuis l\'OF en cours') + '</div>';
  html += '<table class="result-table">' +
    '<tr><td>Cale centre</td><td><b>' + getCombination(pat.center, line + '1') + ' mm</b></td></tr>' +
    lateralRows +
    '<tr><td>Complément</td><td><b>' + getCombination(pat.outerRings, line + '1') + ' mm</b></td></tr>' +
    '</table>';
  html += buildSettingsDiagram(pat.center, pat.laterals, pat.outerRings, false, pat.central2);
  html += buildYieldFicheHtml(o);
  html += '</div></details>';
  return html;
}

window._yieldHelpers_procConfirmInstallation = function(line) {
  const pat = line === 'A' ? lastPatternA : lastPatternB;
  if (!pat || !pat.totalNeeded) return;
  lastInstallNeeds = pat.totalNeeded;
  lastInstallMachine = line + '1';
  confirmInstallation(line);
}

window._yieldHelpers_buildMachineFicheShell = function(line, machine, title, rowsHtml, diagramSvg, needs, warnsHtml) {
  var o = getLineOrder(line);
  var shortages = needs ? shortagesOf(needs, machine) : [];
  var spec = MACHINE_SPECS[machine] || null;
  var headerExtra = '';
  if (spec) {
    headerExtra = '<div style="font-size:10px;color:var(--text-muted);line-height:1.6;margin-bottom:6px;">'
      + 'Ouverture <b>' + spec.openingW + '×' + spec.openingH + 'mm</b> · Axe max <b>' + spec.arbor + 'mm</b>' + (spec.axes > 1 ? ' · ' + spec.axes + ' axes parallèles' : '')
      + '</div>';
  }
  if (o && o.essence && GAMME_ESSENCES[o.essence]) {
    headerExtra += '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;">Essence : <b>' + escapeHtml(GAMME_ESSENCES[o.essence].label) + '</b> · largeur initiale (A1) : <b>' + escapeHtml(String(o.logWidth)) + 'mm</b></div>';
  }
  var content = rowsHtml;
  if (warnsHtml) content += warnsHtml;
  if (diagramSvg) content += '<div class="diagram-container" style="margin-top:8px;"><div class="diagram-body" style="overflow-x:auto;">' + diagramSvg + '</div></div>';
  if (shortages.length) content += '<div class="warning-box" style="margin-top:8px;">' + shortageDetail(needs, machine, shortages) + '</div>';
  else if (needs && Object.keys(needs).length) {
    content += '<table class="result-table" style="margin-top:6px;">'
      + '<thead><tr><th>Taille</th><th>Besoin</th><th>Dispo (kit+mag)</th><th>Écart</th></tr></thead><tbody>';
    Object.keys(needs).sort(function(a, b) { return b - a; }).forEach(function(size) {
      var need = needs[size];
      var dis = stockDispoFor(machine, size);
      content += '<tr><td>' + size + ' mm</td><td><b>' + need + '</b></td><td>' + dis.total + ' <span style="color:var(--text-muted);font-size:10px;">(kit ' + dis.kit + ' + mag ' + dis.magasin + ')</span></td>'
        + '<td><span class="badge badge-stock">OK</span></td></tr>';
    });
    content += '</tbody></table>';
  }
  return ficheShell({ variant: 'flux', title: machine + ' — ' + title + (o ? ' · ' + escapeHtml(o.orderNum) : ''), content: content, headerExtra: headerExtra });
}

window._yieldHelpers_buildExcelContent = function() {
  const headers = ['N° OF', 'Date', 'Ligne', 'Client', 'Référence', 'Quantité', 'Qté produite', 'Statut', 'Magasin PF', 'Magasin WIP', 'Début prévu', 'Fin prévue', 'Grume (mm)', 'Centre (mm)', 'Latérales (mm)', 'Pieces', 'Disques', 'Consommé (mm)', 'Chute (mm)', 'Remarques'];
  const esc = escapeXml;
  let rows = '';
  orders.forEach(function(o) {
    rows += '<Row><Cell><Data ss:Type="String">' + esc(o.orderNum) + '</Data></Cell>'
      + '<Cell><Data ss:Type="String">' + esc(o.date) + '</Data></Cell>'
      + '<Cell><Data ss:Type="String">' + esc(dashboardRenderer.ofLine(o)) + '</Data></Cell>'
      + '<Cell><Data ss:Type="String">' + esc(o.client || '') + '</Data></Cell>'
      + '<Cell><Data ss:Type="String">' + esc(o.reference || '') + '</Data></Cell>'
      + '<Cell><Data ss:Type="Number">' + (o.qty || 0) + '</Data></Cell>'
      + '<Cell><Data ss:Type="Number">' + (o.producedQty || 0) + '</Data></Cell>'
      + '<Cell><Data ss:Type="String">' + esc(o.status || '') + '</Data></Cell>'
      + '<Cell><Data ss:Type="String">' + esc(o.fgWarehouse || '') + '</Data></Cell>'
      + '<Cell><Data ss:Type="String">' + esc(o.wipWarehouse || '') + '</Data></Cell>'
      + '<Cell><Data ss:Type="String">' + esc(o.plannedStart || '') + '</Data></Cell>'
      + '<Cell><Data ss:Type="String">' + esc(o.plannedEnd || '') + '</Data></Cell>'
      + '<Cell><Data ss:Type="Number">' + (o.logWidth || 0) + '</Data></Cell>'
      + '<Cell><Data ss:Type="Number">' + (o.central || 0) + '</Data></Cell>'
      + '<Cell><Data ss:Type="String">' + esc((o.laterals || []).join(', ')) + '</Data></Cell>'
      + '<Cell><Data ss:Type="Number">' + (o.pieceCount || 0) + '</Data></Cell>'
      + '<Cell><Data ss:Type="Number">' + (o.diskCount || 0) + '</Data></Cell>'
      + '<Cell><Data ss:Type="Number">' + (o.totalConsumed || 0) + '</Data></Cell>'
      + '<Cell><Data ss:Type="Number">' + (o.chute || 0) + '</Data></Cell>'
      + '<Cell><Data ss:Type="String">' + esc(o.remarks || '') + '</Data></Cell></Row>';
  });
  const headerCells = headers.map(function(h) {
    return '<Cell ss:StyleID="hdr"><Data ss:Type="String">' + esc(h) + '</Data></Cell>';
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<?mso-application progid="Excel.Sheet"?>'
    + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" '
    + 'xmlns:o="urn:schemas-microsoft-com:office:office" '
    + 'xmlns:x="urn:schemas-microsoft-com:office:excel" '
    + 'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" '
    + 'xmlns:html="http://www.w3.org/TR/REC-html40">'
    + '<Styles><Style ss:ID="hdr"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2D5A30" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style></Styles>'
    + '<Worksheet ss:Name="Historique OF"><Table>'
    + '<Row>' + headerCells + '</Row>' + rows
    + '</Table></Worksheet></Workbook>';
}

window._yieldHelpers_buildGrumeFluxBlock = function(line) {
  var o = getLineOrder(line);
  var html = '<div class="flux-grume" style="border:1px solid var(--border-color);border-radius:12px;padding:8px 10px;background:var(--bg-card, rgba(255,255,255,.04));">';
  html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
  html += '<div class="flux-pill" style="margin:0;"><i data-lucide="tree-pine" style="width:14px;height:14px;"></i> Grume</div>';
  html += '<div style="font-size:11px;color:var(--text-muted);flex:1;" id="grumeOfLabel' + line + '">' +
    (o ? ('OF <b>' + escapeHtml(o.orderNum || '') + '</b>') : 'Aucun OF en cours') + '</div>';
  html += '</div>';
  html += '<div style="margin-top:10px;padding:10px;background:var(--bg-secondary);border-radius:10px;border:1px solid var(--border-color);position:relative;">';
  html += '<div style="font-size:11px;font-weight:700;margin-bottom:6px;">🚀 Saisie / scan grume (' + line + '1)</div>';
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
  html += '<input id="grumeScanInput' + line + '" class="form-input" style="flex:1;min-width:140px;" placeholder="Taper la réf ou cliquer pour voir la liste…" onfocus="showGrumeQuickList(\'' + line + '\')" oninput="filterGrumeQuickList(\'' + line + '\')" onkeydown="if(event.key===\'Enter\')saisieGrumeRef(\'' + line + '\')">';
  html += '<button class="btn btn-sm btn-success" onclick="saisieGrumeRef(\'' + line + '\')">✅ Lancer</button>';
  html += '<button class="btn btn-sm btn-primary" onclick="toggleGrumeCamScan(\'' + line + '\')">📷 Scanner</button>';
  html += '</div>';
  html += '<div id="grumeQuickList' + line + '" class="grume-quick-list" style="display:none;"></div>';
  html += '<div id="grumeCamScan' + line + '" style="display:none;margin-top:8px;position:relative;">';
  html += '<video id="grumeCamVideo' + line + '" playsinline muted style="width:100%;max-height:350px;border-radius:10px;background:#000;"></video>';
  html += '<div id="grumeCamStatus' + line + '" style="font-size:11px;margin-top:6px;color:var(--text-muted);">Démarrage de la caméra…</div>';
  html += '</div>';
  html += '<div id="grumeScanMsg' + line + '" style="font-size:11px;margin-top:6px;"></div>';
  html += '</div>';
  html += '</div>';
  return html;
}

window._yieldHelpers_buildPlanHelp = function(p, mode, data) {
  p.help = [];
  p.warnings = [];
  const latMax = p.laterals.length ? Math.max.apply(null, p.laterals.map(function(l) { return l.h; })) : 0;
  if (latMax > 0 && p.centralH > latMax) {
    p.help.push('✅ Règle CC > SB respectée : centre ' + p.centralH + 'mm plus épais que les latérales ' + latMax + 'mm.');
  } else {
    p.help.push('⚠️ Règle CC > SB : le centre (' + p.centralH + 'mm) doit rester plus épais que les latérales (' + latMax + 'mm).');
  }
  if (p.margin > 0) {
    p.help.push('🛡️ Marge de sécurité ' + p.margin + 'mm × 2 : flancs non sciés de la grume protégés (largeur utile ' + p.usableW + 'mm).');
  }
  if (p.ccB2) {
    p.help.push('💡 Rationalisation CC : le reste est valorisé en 1 × ' + p.ccB2 + 'mm (' + p.ccB2Design + ') par pièce — déchet évité.');
  }
  p.help.push('📐 Rendement : ' + p.yieldPct + '% · chute totale ' + p.chute + 'mm (récupérée par la machine dosses A4).');
  const stackCC = p.nCC * p.centralB + (p.nCC - 1) * DISK_THICKNESS;
  if (p.centralH <= MACHINE_SPECS.A2.openingH && stackCC <= MACHINE_SPECS.A2.arbor) {
    p.help.push('⚙️ A2 (Scie CC) : ' + p.centralH + 'mm ≤ ouverture 140mm et ' + stackCC + 'mm ≤ axe 800mm ✓');
  }
  let sbOk = true;
  p.laterals.forEach(function(l) {
    const stk = l.n * l.b + (l.n - 1) * DISK_THICKNESS;
    if (l.h > MACHINE_SPECS.A3.openingH || stk > MACHINE_SPECS.A3.arbor) sbOk = false;
  });
  if (sbOk && p.laterals.length) {
    p.help.push('⚙️ A3 (Déligneuse SB) : planches ' + p.laterals.map(function(l) { return l.h + 'mm'; }).join(', ') + ' ≤ ouverture 55mm, délignage des flaches ✓');
  }
  const ccNeeds = needsForCombos([comboArray(p.centralB, 'A2')], p.nCC);
  const latNeeds = {};
  p.laterals.forEach(function(l) {
    for (let k = 0; k < l.n; k++) {
      const counts = comboToCounts(comboArray(l.b, 'A3'));
      Object.keys(counts).forEach(function(sz) { latNeeds[sz] = (latNeeds[sz] || 0) + counts[sz]; });
    }
  });
  const ccShort = shortagesOf(ccNeeds, 'A2');
  const latShort = shortagesOf(latNeeds, 'A3');
  if (ccShort.length) p.warnings.push('⚠️ Stock cales A2 : manque ' + ccShort.join(', ') + 'mm pour le montage CC.');
  if (latShort.length) p.warnings.push('⚠️ Stock cales A3 : manque ' + latShort.join(', ') + 'mm pour le montage SB.');
  if (!ccShort.length && !latShort.length) p.help.push('📦 Stock cales suffisant pour ce plan ✓');
  const rem = p.usableW - p.ccUsed;
  if (rem >= 1.5 * p.centralB && p.nCC < 7) {
    p.help.push('💡 Perfectionnement : ' + rem.toFixed(0) + 'mm de largeur utile restent — essayez B centre = ' + p.centralB + 'mm avec une pièce de plus, ou B supérieur.');
  } else if (p.ccChute > 20) {
    p.help.push('💡 Perfectionnement : chute CC de ' + p.ccChute + 'mm — une largeur B légèrement différente peut l\u2019absorber.');
  }
  if (p.margin > 0 && p.chute > 40) {
    p.help.push('💡 Perfectionnement : chute élevée — vous pouvez réduire la marge (' + p.margin + 'mm) si les flancs sont réguliers.');
  }
  if (p.margin === 0) {
    p.help.push('💡 Sécurité : activez une marge de ' + DEFAULT_SAFETY_MARGIN + 'mm par côté pour ne pas toucher les flancs non sciés.');
  }
  if (mode === 'madrier' && p.ccDesign.indexOf('Madrier') === 0) {
    p.help.push('🏗️ Madrier ' + p.centralH + '×' + p.centralB + ' : rapport ' + Math.round(p.centralB / p.centralH * 10) / 10 + ' (norme 2 à 3) ✓');
  }
  if (p.laterals.length === 0 && Object.keys(data).some(function(h) { return h < p.centralH && (data[h].sb || []).length; })) {
    p.help.push('💡 Perfectionnement : ajoutez une latérale pour valoriser les flancs de la grume.');
  }
}

window._yieldHelpers_buildMesuresDecoupesBlock = function(ligne) {
  var o = getLineOrder(ligne);
  var nums = ['1', '2', '3', '4'];
  var labels = { '1': 'A' + ligne + '1 · Premier sciage', '2': 'A' + ligne + '2 · Calibrage CC', '3': 'A' + ligne + '3 · Déligneuse SB', '4': 'A' + ligne + '4 · Récup dosses' };
  var html = '<div class="card" style="margin:6px 0;border:1px solid var(--border-color);border-radius:12px;padding:12px;">';
  html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">';
  html += '<span style="font-weight:800;font-size:13px;">📐 Détails mesures de découpes — ligne ' + ligne + '</span>';
  html += '</div>';
  if (!o) {
    html += '<div style="font-size:12px;color:var(--text-muted);">Aucun OF en cours — les mesures dépendent de la commande validée sur la ligne ' + ligne + '.</div>';
    html += '</div>';
    return html;
  }
  nums.forEach(function(n) {
    var m = ligne + n;
    var d = mesuresMachine(ligne, m);
    var stKey = 'charben_machine_status_' + ligne + '_' + m;
    /* Même traduction que la fiche machine : sans cela le badge afficherait
       encore « En fonctionnement » ou « Panne » après le changement de
       vocabulaire, et l'opérateur verrait deux langues sur la même ligne. */
    var st = loadFromStorage(stKey, 'En marche');
    if (typeof window !== 'undefined' && typeof window._machineState_statut === 'function') {
      st = window._machineState_statut(st);
    }
    html += '<div style="display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:10px;background:var(--bg-secondary, rgba(255,255,255,.03));border:1px solid var(--border-color);margin-bottom:6px;flex-wrap:wrap;">';
    html += '<span style="font-weight:800;font-size:12px;min-width:150px;">' + escapeHtml(labels[n]) + '</span>';
    html += '<span style="flex:1;font-size:12px;color:var(--text-secondary);min-width:180px;">' + escapeHtml(d.comment) + '</span>';
    html += '<span class="badge badge-stock" style="font-size:10px;">' + escapeHtml(st) + '</span>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

window._yieldHelpers_getTrendData = function(arr, key) {
  if (!arr || arr.length === 0) return { current: 0, previous: 0, trend: 'neutral', pct: 0 };
  var now = new Date();
  var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  var current = arr.filter(function(item) { return new Date(item.createdAt || item.date || now) >= weekAgo; }).length;
  var prevWeek = arr.filter(function(item) {
    var d = new Date(item.createdAt || item.date || now);
    return d >= new Date(weekAgo.getTime() - 7 * 86400000) && d < weekAgo;
  }).length;
  if (prevWeek === 0) return { current: current, previous: prevWeek, trend: current > 0 ? 'up' : 'neutral', pct: 0 };
  var pct = Math.round(((current - prevWeek) / prevWeek) * 100);
  return { current: current, previous: prevWeek, trend: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral', pct: Math.abs(pct) };
}

/* --- GRUME QUICK LIST (dropdown au clic sur le champ de saisie) --- */

window._yieldHelpers_showGrumeQuickList = function(line) {
  var panel = document.getElementById('grumeQuickList' + line);
  if (!panel) return;
  var input = document.getElementById('grumeScanInput' + line);
  var q = input ? input.value.trim().toUpperCase() : '';
  var o = getLineOrder(line);
  var ofWmin = o ? (parseFloat(o.logWidthMin) || 0) : 0;
  var ofWmax = o ? (parseFloat(o.logWidthMax) || parseFloat(o.logWidth) || ofWmin) : 0;
  var avail = rawMaterials.filter(function(g) {
    if (g.statut !== 'EN_STOCK') return false;
    if (q.length === 1) return g.code.charAt(0).toUpperCase() === q;
    if (q.length > 1) return g.code.toUpperCase().indexOf(q) !== -1;
    return true;
  });
  avail.sort(function(a, b) {
    var gwA = grumeWidthMm(a), gwB = grumeWidthMm(b);
    var okA = (ofWmin && gwA < ofWmin) ? 1 : (ofWmax && gwA > ofWmax) ? 2 : 0;
    var okB = (ofWmin && gwB < ofWmin) ? 1 : (ofWmax && gwB > ofWmax) ? 2 : 0;
    if (okA !== okB) return okA - okB;
    return a.code < b.code ? -1 : 1;
  });
  var total = rawMaterials.filter(function(g) { return g.statut === 'EN_STOCK'; }).length;
  var html = '<div class="grume-quick-list-header">' + total + ' grume(s) disponible(s)' + (q ? ' — filtre' : '') + '</div>';
  if (!avail.length) {
    html += '<div class="grume-quick-list-empty">Aucune grume ne correspond</div>';
  }
  avail.forEach(function(g, i) {
    var gw = grumeWidthMm(g);
    var inRange = (!ofWmin || gw >= ofWmin) && (!ofWmax || gw <= ofWmax);
    var tag = inRange ? '<span class="grume-tag-ok">✓</span>' : '<span class="grume-tag-ko">⚠</span>';
    var extra = (typeof window._yieldHelpers_buildGrumeQuickExtra === 'function')
      ? window._yieldHelpers_buildGrumeQuickExtra(gw, o)
      : { classBadgeHtml: '', capacityHtml: '' };
    /* F-01 (XSS) : aucun identifiant (g.id) ni la ligne ne sont injectés dans le
       HTML. escapeHtml() passe par textContent→innerHTML et n'échappe PAS les
       guillemets — il est donc inapte à sécuriser un attribut. On ne pose qu'un
       INDEX numérique (sûr par construction) ; la vraie valeur est restituée via
       la closure de l'écouteur, hors HTML, donc non forgeable. */
    html += '<div class="grume-quick-item" data-idx="' + i + '">' +
      tag +
      '<span class="grume-quick-code">' + escapeHtml(g.code) + '</span>' +
      '<span class="grume-quick-info">' + escapeHtml(g.essence) + ' · Ø' + escapeHtml(String(g.diametre)) + 'cm · ' + gw + 'mm' +
      (extra.classBadgeHtml ? ' ' + extra.classBadgeHtml : '') + '</span>' +
      (ofWmax ? '<span class="grume-quick-range">' + (inRange ? '✅' : '⚠️') + '</span>' : '') +
      extra.capacityHtml +
      '</div>';
  });
  panel.innerHTML = html;
  panel.style.display = 'block';
  var items = (panel.querySelectorAll ? panel.querySelectorAll('.grume-quick-item') : []);
  Array.prototype.forEach.call(items, function(el) {
    el.addEventListener('click', function() {
      var g = avail[parseInt(el.getAttribute('data-idx'), 10)];
      if (g) window._yieldHelpers_selectGrumeFromList(line, g.id);
    });
  });
  document.addEventListener('click', function closeGrumeList(e) {
    var wrap = panel.parentElement;
    if (wrap && !wrap.contains(e.target)) {
      panel.style.display = 'none';
      document.removeEventListener('click', closeGrumeList);
    }
  });
};

window._yieldHelpers_filterGrumeQuickList = function(line) {
  showGrumeQuickList(line);
};

/* Badge de classe C1/C2/C3 + capacité géométrique CC/SB pour le flux opérateur.
   Porté depuis l'ancien launcher (grumes-manager) vers la liste rapide active.
   Pur : aucune écriture DOM — utilisable en tests unitaires. */
window._yieldHelpers_buildGrumeQuickExtra = function(gw, of) {
  var classHtml = '';
  var capacityHtml = '';
  var ce = (typeof cuttingEngine !== 'undefined') ? cuttingEngine : (typeof window !== 'undefined' ? window.cuttingEngine : null);
  if (ce && typeof ce.classerGrume === 'function') {
    var cls = ce.classerGrume(gw);
    if (cls && cls.ok) {
      classHtml = '<span class="badge badge-stock" title="' + escapeHtml(cls.label) + '">' + cls.classe + '</span>';
    } else {
      classHtml = '<span class="badge badge-maintenance" title="Hors 250–560 mm">!</span>';
    }
  }
  if (ce && typeof ce.largeursPlan === 'function') {
    var plan = ce.largeursPlan(gw, of);
    if (plan) {
      var bits = [];
      (plan.cc || []).forEach(function(c) { bits.push('CC ' + c.ep + '→' + c.max + 'mm'); });
      (plan.sb || []).forEach(function(s) { bits.push('SB ' + s.ep + '→' + s.max + 'mm'); });
      if (bits.length) {
        capacityHtml = '<span class="grume-quick-cap" style="flex-basis:100%;font-size:10.5px;color:var(--text-muted);">Capacité Ø' + gw + 'mm : ' + bits.join(' · ') + '</span>';
      }
    }
  }
  return { classBadgeHtml: classHtml, capacityHtml: capacityHtml };
};

window._yieldHelpers_selectGrumeFromList = function(line, grumeId) {
  var g = rawMaterials.find(function(x) { return x.id === grumeId; });
  if (!g) return;
  var input = document.getElementById('grumeScanInput' + line);
  if (input) input.value = g.code;
  var panel = document.getElementById('grumeQuickList' + line);
  if (panel) panel.style.display = 'none';
  saisieGrumeRef(line);
};

/* --- EXPORT GLOBAL --- */

window.yieldHelpers = {
  getLateralValues: window._yieldHelpers_getLateralValues,
  getLateralWidths: window._yieldHelpers_getLateralWidths,
  buildMachineStockFicheHtml: window._yieldHelpers_buildMachineStockFicheHtml,
  buildYieldFicheHtml: window._yieldHelpers_buildYieldFicheHtml,
  rendementMFColor: window._yieldHelpers_rendementMFColor,
  buildYieldUnifiedTable: window._yieldHelpers_buildYieldUnifiedTable,
  buildYieldGrumeLaunchedTable: window._yieldHelpers_buildYieldGrumeLaunchedTable,
  buildYieldDiagram: window._yieldHelpers_buildYieldDiagram,
  procCalculatePattern: window._yieldHelpers_procCalculatePattern,
  buildPatternFicheHtml: window._yieldHelpers_buildPatternFicheHtml,
  procConfirmInstallation: window._yieldHelpers_procConfirmInstallation,
  buildMachineFicheShell: window._yieldHelpers_buildMachineFicheShell,
  buildExcelContent: window._yieldHelpers_buildExcelContent,
  buildGrumeFluxBlock: window._yieldHelpers_buildGrumeFluxBlock,
  buildPlanHelp: window._yieldHelpers_buildPlanHelp,
  buildMesuresDecoupesBlock: window._yieldHelpers_buildMesuresDecoupesBlock,
  showGrumeQuickList: window._yieldHelpers_showGrumeQuickList,
  filterGrumeQuickList: window._yieldHelpers_filterGrumeQuickList,
  buildGrumeQuickExtra: window._yieldHelpers_buildGrumeQuickExtra,
  selectGrumeFromList: window._yieldHelpers_selectGrumeFromList,
  getTrendData: window._yieldHelpers_getTrendData
};
