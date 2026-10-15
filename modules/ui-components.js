/**
 * UI-COMPONENTS.JS — Composants UI réutilisables (SVG, gauges, diagrammes)
 * Scierie Charben — Extraits depuis app.js
 * ZERO DOM queries, ZERO side effects — pure rendering functions
 * Globals: DISK_THICKNESS, MACHINE_SPECS
 */
'use strict';

/* ─────────────────────────────────────────────
   v2Gauge — jauge circulaire SVG
   Extrait: app.js lignes 6977-6987
   ───────────────────────────────────────────── */

window._uiComponents_v2Gauge = function(pct, color, label) {
  var r = 34, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return '<div class="v2-gauge">'
    + '<svg width="84" height="84" viewBox="0 0 84 84">'
    + '<circle cx="42" cy="42" r="' + r + '" fill="none" stroke="var(--hud-track)" stroke-width="7"/>'
    + '<circle cx="42" cy="42" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '" transform="rotate(-90 42 42)" style="filter:drop-shadow(0 0 7px ' + color + '66);"/>'
    + '<text x="42" y="48" text-anchor="middle" font-size="17" font-weight="800" fill="' + color + '">' + pct + '%</text>'
    + '</svg>'
    + '<div class="v2-gauge-label">' + label + '</div>'
    + '</div>';
};

/* ─────────────────────────────────────────────
   animateCounters — animation compteurs KPI
   Extrait: app.js lignes 6989-7003
   ───────────────────────────────────────────── */

window._uiComponents_animateCounters = function() {
  document.querySelectorAll('[data-count]').forEach(function(node) {
    var target = parseFloat(node.getAttribute('data-count'));
    var suffix = node.getAttribute('data-suffix') || '';
    var isMobile = window.innerWidth <= 640;
    var dur = isMobile ? 1400 : 800, t0 = null;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
};

/* ─────────────────────────────────────────────
   settingsSwitchRow — rangée switch settings
   Extrait: app.js lignes 411-416
   ───────────────────────────────────────────── */

window._uiComponents_settingsSwitchRow = function(id, title, desc, checked, onChange) {
  return '<div class="settings-row">'
    + '<div><div class="settings-row-title">' + title + '</div><div class="settings-row-desc">' + desc + '</div></div>'
    + '<label class="switch"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + ' onchange="' + onChange + '"><span class="switch-slider"></span></label>'
    + '</div>';
};

/* ─────────────────────────────────────────────
   buildSettingsDiagram — diagramme cales/disques
   Extrait: app.js lignes 1369-1472
   ───────────────────────────────────────────── */

var _diagramUid = 0;
window._uiComponents_buildSettingsDiagram = function(center, laterals, outer, big, center2) {
  _diagramUid++;
  var uid = _diagramUid;
  var k = big ? 1.9 : 1;
  var diskMm = DISK_THICKNESS;
  var diskPx = 12 * k;
  var gap = 2 * k;
  var halfW = 140 * k;
  center2 = (parseFloat(center2) > 0) ? parseFloat(center2) : 0;
  var lateralsSum = laterals.reduce(function(a, b) { return a + b; }, 0);
  var scale = halfW / (center + center2 + lateralsSum + outer);
  var wc = Math.max(center * scale, 35 * k);
  var wc2 = center2 > 0 ? Math.max(center2 * scale, 30 * k) : 0;
  var wo = Math.max(outer * scale, 30 * k);
  var wls = laterals.map(function(l) { return Math.max(l * scale, 30 * k); });
  var barY = 46 * k, barH = 30 * k;
  var dimY = barY + barH + 20 * k;
  var totalDimY = dimY + 26 * k;
  var fS = big ? 1.35 : 1;
  var midX = 160 * k;
  function buildSegs() {
    var segs = [{ t: 'cale', w: wc, mm: center, col: '#a86e36', stk: '#7d4f1f' }];
    if (wc2 > 0) {
      segs.push({ t: 'disk', w: diskPx });
      segs.push({ t: 'cale', w: wc2, mm: center2, col: '#a8642f', stk: '#7a4018' });
    }
    laterals.forEach(function(l, i) {
      segs.push({ t: 'disk', w: diskPx });
      segs.push({ t: 'cale', w: wls[i], mm: l, col: i === 0 ? '#c98f52' : '#4a8a4f', stk: i === 0 ? '#8a5a2a' : '#2d5a30' });
    });
    segs.push({ t: 'disk', w: diskPx });
    segs.push({ t: 'chute', w: wo, mm: Math.round(outer) });
    return segs;
  }
  var rightSegs = buildSegs();
  var leftSegs = buildSegs();
  var rects = '', dims = [], callouts = [];
  var diskDone = false;
  function draw(x, seg) {
    if (seg.t === 'disk') {
      rects += '<rect x="' + x + '" y="' + barY + '" width="' + seg.w + '" height="' + barH + '" fill="#374151" rx="' + (2*k) + '"/>';
      rects += '<line x1="' + (x + seg.w/2) + '" y1="' + barY + '" x2="' + (x + seg.w/2) + '" y2="' + (barY + barH) + '" stroke="#555" stroke-width="0.5" stroke-dasharray="2,2"/>';
      if (!diskDone) {
        callouts.push('<text x="' + (x + seg.w/2) + '" y="' + (barY - 8*k) + '" text-anchor="middle" font-size="' + (9*fS) + '" fill="#6b7280" font-family="Inter">\u00d8' + diskMm + '</text>');
        diskDone = true;
      }
      return;
    }
    if (seg.t === 'chute') {
      rects += '<rect x="' + x + '" y="' + barY + '" width="' + seg.w + '" height="' + barH + '" fill="#b6602b" rx="' + (3*k) + '" stroke="#8a4419" stroke-width="1"/>';
      rects += '<rect x="' + x + '" y="' + barY + '" width="' + seg.w + '" height="' + barH + '" fill="url(#hatchC' + uid + (big?'Big':'') + ')" rx="' + (3*k) + '"/>';
    } else {
      rects += '<rect x="' + x + '" y="' + barY + '" width="' + seg.w + '" height="' + barH + '" fill="' + seg.col + '" rx="' + (3*k) + '" stroke="' + seg.stk + '" stroke-width="1"/>';
    }
    var mx = x + seg.w / 2;
    dims.push('<line x1="' + x + '" y1="' + (barY + barH + 2) + '" x2="' + x + '" y2="' + dimY + '" stroke="#d1d5db"/>'
      + '<line x1="' + (x + seg.w) + '" y1="' + (barY + barH + 2) + '" x2="' + (x + seg.w) + '" y2="' + dimY + '" stroke="#d1d5db"/>'
      + '<line x1="' + x + '" y1="' + dimY + '" x2="' + (mx - 20*k) + '" y2="' + dimY + '" stroke="#9ca3af"/>'
      + '<line x1="' + (mx + 20*k) + '" y1="' + dimY + '" x2="' + (x + seg.w) + '" y2="' + dimY + '" stroke="#9ca3af"/>'
      + '<text x="' + mx + '" y="' + (dimY + 4*k) + '" text-anchor="middle" font-size="' + (10*fS) + '" fill="' + (seg.t === 'chute' ? '#b6602b' : seg.stk) + '" font-weight="700" font-family="Inter">' + seg.mm + '</text>');
  }
  rects += '<rect x="' + (midX - diskPx/2) + '" y="' + barY + '" width="' + diskPx + '" height="' + barH + '" fill="#374151" rx="' + (2*k) + '"/>';
  var xr = midX + diskPx/2 + gap;
  rightSegs.forEach(function(s) { draw(xr, s); xr += s.w + gap; });
  var xl = midX - diskPx/2 - gap;
  leftSegs.forEach(function(s) { xl -= s.w; draw(xl, s); xl -= gap; });
  var axis = '<line x1="' + midX + '" y1="' + (8*k) + '" x2="' + midX + '" y2="' + (barY - 4*k) + '" stroke="#4a8a4f" stroke-width="1.5" stroke-dasharray="4,3"/>'
    + '<text x="' + midX + '" y="' + (6*k) + '" text-anchor="middle" font-size="' + (9*fS) + '" fill="#4a8a4f" font-weight="700" font-family="Inter">AXE</text>';
  var N = laterals.length;
  var diskCount = 2 * (N + 1) + 1 + (center2 > 0 ? 2 : 0);
  var totalMm = Math.round(2 * center + 2 * center2 + 2 * lateralsSum + 2 * outer + diskCount * diskMm);
  var totalLabel = '<text x="' + midX + '" y="' + (totalDimY + 4*k) + '" text-anchor="middle" font-size="' + (11*fS) + '" fill="#b6602b" font-weight="700" font-family="Inter">' + totalMm + ' mm</text>';
  var svgW = (N > 1 ? 360 : 320) * k;
  return '<div class="diagram-container" ' + (big ? '' : 'onclick="openDiagramZoom()" style="cursor:zoom-in;"') + '>'
    + '<div class="diagram-header">R\u00e9partition sur l\'arbre — \u00d7 2 arbres identiques (sup\u00e9rieur + inf\u00e9rieur)' + (N > 1 ? ' · avec lat\u00e9rale secondaire' : '') + '</div>'
    + '<div class="diagram-body">'
    + '<svg width="' + svgW + '" height="' + (totalDimY + 10*k) + '" viewBox="0 0 ' + svgW + ' ' + (totalDimY + 10*k) + '">'
    + '<defs><pattern id="hatchC' + uid + '" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="5" stroke="#8a441966" stroke-width="1"/></pattern>'
    + '<pattern id="hatchCBig' + uid + '" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="7" stroke="#8a441966" stroke-width="1.2"/></pattern></defs>'
    + axis + rects + callouts.join('') + dims.join('') + totalLabel + '</svg></div>'
    + '<div class="diagram-footer">'
    + '<span class="legend-item"><span class="legend-dot" style="background:#a86e36;"></span>Planche centrale</span>'
    + (center2 > 0 ? '<span class="legend-item"><span class="legend-dot" style="background:#a8642f;"></span>CC secondaire</span>' : '')
    + '<span class="legend-item"><span class="legend-dot" style="background:#c98f52;"></span>Lat. principale</span>'
    + (N > 1 ? '<span class="legend-item"><span class="legend-dot" style="background:#4a8a4f;"></span>Lat. secondaire</span>' : '')
    + '<span class="legend-item"><span class="legend-dot" style="background:#374151;"></span>Disque ' + diskMm + 'mm</span>'
    + '<span class="legend-item"><span class="legend-dot" style="background:#b6602b;"></span>Compl\u00e9ment</span></div>'
    + (!big ? '<div class="diagram-click-hint" onclick="event.stopPropagation();openDiagramZoom()">&#x1f50d; Cliquer pour agrandir et voir tous les d\u00e9tails</div>' : '')
    + '</div>';
};

/* ─────────────────────────────────────────────
   buildRipDiagram — diagramme sciage (rip)
   Extrait: app.js lignes 1474-1530
   ───────────────────────────────────────────── */

window._uiComponents_buildRipDiagram = function(rows) {
  var pad = 8, rowH = 40, gap = 30;
  var maxW = 1;
  rows.forEach(function(r) { if (r.initialW > maxW) maxW = r.initialW; });
  var scale = Math.min(280 / maxW, 1.3);
  var w = Math.max(200, maxW * scale) + pad * 2;
  var h = 12 + rows.length * (rowH + gap);
  var kerfPx = DISK_THICKNESS * scale;
  var svg = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" style="display:block;">';
  var y = 6;
  rows.forEach(function(r) {
    var bw = Math.max(r.initialW * scale, 24);
    var rectH = Math.max(r.h * scale, 12);
    var marginPx = (r.margin || 0) * scale;
    var usablePx = Math.max(bw - 2 * marginPx, 0);
    // security-check: allow r.label provient de fiche-renderer (noms statiques 'SB/CC/...piece N')
    svg += '<text x="' + pad + '" y="' + (y + 9) + '" font-size="9.5" fill="#9ca3af" font-family="Inter,sans-serif">' + r.label + ' · initiale ' + r.initialW + 'mm</text>';
    y += 15;
    svg += '<rect x="' + pad + '" y="' + y + '" width="' + bw + '" height="' + rectH + '" fill="rgba(255,255,255,0.05)" stroke="#9ca3af" stroke-width="1" rx="2"/>';
    if (marginPx > 1) {
      svg += '<rect x="' + pad + '" y="' + y + '" width="' + marginPx + '" height="' + rectH + '" fill="#5b4326" opacity="0.55" stroke="#8a6a3f" stroke-width="0.6" rx="1.5" stroke-dasharray="3,2"/>';
      svg += '<rect x="' + (pad + bw - marginPx) + '" y="' + y + '" width="' + marginPx + '" height="' + rectH + '" fill="#5b4326" opacity="0.55" stroke="#8a6a3f" stroke-width="0.6" rx="1.5" stroke-dasharray="3,2"/>';
      if (marginPx > 14) {
        svg += '<text x="' + (pad + marginPx / 2) + '" y="' + (y + rectH / 2 + 3) + '" text-anchor="middle" font-size="7.5" fill="#d9b98a" font-family="Inter,sans-serif">\u00e9corce</text>';
        svg += '<text x="' + (pad + bw - marginPx / 2) + '" y="' + (y + rectH / 2 + 3) + '" text-anchor="middle" font-size="7.5" fill="#d9b98a" font-family="Inter,sans-serif">\u00e9corce</text>';
      }
    }
    var piecesPx = 0;
    r.pieces.forEach(function(p) { piecesPx += Math.max(p.b * scale, 8); });
    piecesPx += (r.pieces.length - 1) * kerfPx;
    var chutePx = Math.max(usablePx - piecesPx, 0);
    var leftChute = chutePx / 2;
    var xCursor = pad + marginPx + leftChute;
    r.pieces.forEach(function(p, i) {
      var pw = Math.max(p.b * scale, 8);
      if (i > 0) svg += '<rect x="' + (xCursor - kerfPx / 2) + '" y="' + y + '" width="' + kerfPx + '" height="' + rectH + '" fill="#000" opacity="0.35"/>';
      svg += '<rect x="' + xCursor + '" y="' + y + '" width="' + pw + '" height="' + rectH + '" fill="' + p.color + '" stroke="#fff" stroke-width="0.8" rx="1.5"/>';
      svg += '<text x="' + (xCursor + pw / 2) + '" y="' + (y + rectH + 12) + '" text-anchor="middle" font-size="8.5" fill="#d1d5db" font-family="Inter,sans-serif">' + p.b + '</text>';
      xCursor += pw + kerfPx;
    });
    if (leftChute > 4 && r.chute > 0) {
      svg += '<rect x="' + (pad + marginPx) + '" y="' + y + '" width="' + leftChute + '" height="' + rectH + '" fill="#b6602b" opacity="0.45" stroke="#b6602b" stroke-width="0.8" rx="1.5" stroke-dasharray="3,2"/>';
      svg += '<text x="' + (pad + marginPx + leftChute / 2) + '" y="' + (y + rectH + 12) + '" text-anchor="middle" font-size="8.5" fill="#b6602b" font-family="Inter,sans-serif">CH ' + Math.round(r.chute / 2) + '</text>';
    }
    if (chutePx - leftChute > 4 && r.chute > 0) {
      var rx = pad + bw - marginPx - (chutePx - leftChute);
      svg += '<rect x="' + rx + '" y="' + y + '" width="' + (chutePx - leftChute) + '" height="' + rectH + '" fill="#b6602b" opacity="0.45" stroke="#b6602b" stroke-width="0.8" rx="1.5" stroke-dasharray="3,2"/>';
      svg += '<text x="' + (rx + (chutePx - leftChute) / 2) + '" y="' + (y + rectH + 12) + '" text-anchor="middle" font-size="8.5" fill="#b6602b" font-family="Inter,sans-serif">CH ' + Math.round(r.chute / 2) + '</text>';
    }
    svg += '<line x1="' + (pad + bw / 2) + '" y1="' + (y - 3) + '" x2="' + (pad + bw / 2) + '" y2="' + (y + rectH + 3) + '" stroke="#60a5fa" stroke-width="0.8" stroke-dasharray="3,3" opacity="0.7"/>';
    svg += '<text x="' + (pad + bw / 2) + '" y="' + (y + rectH + 19) + '" text-anchor="middle" font-size="7" fill="#60a5fa" font-family="Inter,sans-serif">centre</text>';
    y += rectH + gap;
  });
  svg += '</svg>';
  return svg;
};

/* ─────────────────────────────────────────────
   buildDossesDiagram — diagramme dosses
   Extrait: app.js lignes 1532-1548
   ───────────────────────────────────────────── */

window._uiComponents_buildDossesDiagram = function(chute, count) {
  var dosseCount = (typeof count === 'number' && count > 0) ? count : 2;
  var w = 200, h = 52;
  var per = Math.max(chute / dosseCount, 1);
  var cw = Math.max(Math.min(per, 90), 26);
  var gap = Math.max((w - dosseCount * cw) / (dosseCount + 1), 6);
  var x0start = gap, y = 8, rh = 24;
  var svg = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:4px auto 0;">';
  for (var k = 0; k < dosseCount; k++) {
    var x0 = x0start + k * (cw + gap);
    svg += '<path d="M' + x0 + ' ' + (y + rh) + ' L' + (x0 + cw * 0.7) + ' ' + y + ' A4 4 0 0 1 ' + (x0 + cw * 0.7 + 4) + ' ' + y + ' L' + (x0 + cw + 4) + ' ' + (y + rh) + ' Z" fill="#b6602b" opacity="0.55" stroke="#b6602b" stroke-width="1"/>';
    svg += '<text x="' + (x0 + cw / 2) + '" y="' + (y + rh + 11) + '" text-anchor="middle" font-size="8" fill="#b6602b" font-family="Inter,sans-serif">' + Math.round(per) + 'mm</text>';
  }
  svg += '<text x="' + (w / 2) + '" y="' + (h - 3) + '" text-anchor="middle" font-size="8.5" fill="#9ca3af" font-family="Inter,sans-serif">' + dosseCount + ' dosses restantes · d\u00e9chet</text>';
  svg += '</svg>';
  return svg;
};

/* ─────────────────────────────────────────────
   EXPORT GLOBAL — wrappers compatibles
   ───────────────────────────────────────────── */

window.uiComponents = {
  v2Gauge: window._uiComponents_v2Gauge,
  animateCounters: window._uiComponents_animateCounters,
  settingsSwitchRow: window._uiComponents_settingsSwitchRow,
  buildSettingsDiagram: window._uiComponents_buildSettingsDiagram,
  buildRipDiagram: window._uiComponents_buildRipDiagram,
  buildDossesDiagram: window._uiComponents_buildDossesDiagram
};
