/* ============================================================
   REPORT GENERATOR — Rapport de traçabilité PDF A4 (maison)
   - ReportModel     : périodes (journalier / semaine ISO / mensuel),
                       filtrage et agrégation par atelier — fonctions pures testables.
   - ReportGenerator : rendu canvas A4 (2480x3508), writer PDF 1 page
                       (JPEG embarqué, 0 dépendance), téléchargement + partage natif.
   Charge APRÈS trace-api.js (lit TraceAPI.rows() au moment de l'appel).
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  var g = root || (typeof globalThis !== 'undefined' ? globalThis : this);
  if (g) {
    g.ReportModel = api.ReportModel;
    g.ReportGenerator = api.ReportGenerator;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function num(v) { var n = Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; }

  /* ───────── Dates ───────── */
  function parseAnyDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    var s = String(v).trim();
    if (!s || s === '—') return null;
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  function dateKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  function isoWeekOf(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var dayNum = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - dayNum);
    var year = d.getFullYear();
    var yearStart = new Date(year, 0, 1);
    var week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { week: week, year: year };
  }
  function mondayOfIsoWeek(year, week) {
    var d = new Date(year, 0, 4);
    var dayNum = d.getDay() || 7;
    d.setDate(d.getDate() - (dayNum - 1) + (week - 1) * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /* ───────── Périodes ───────── */
  function buildRange(mode, opts) {
    opts = opts || {};
    var now = new Date();
    if (mode === 'weekly') {
      var iw = isoWeekOf(now);
      var wy = opts.year != null ? Number(opts.year) : iw.year;
      var ww = opts.week != null ? Number(opts.week) : iw.week;
      var monday = mondayOfIsoWeek(wy, ww);
      var wend = new Date(monday.getTime() + 7 * 86400000 - 1);
      return { mode: 'weekly', start: monday.getTime(), end: wend.getTime(), startDate: monday, endDate: wend, label: 'Semaine S' + pad2(ww) + ' / ' + wy, key: 'S' + pad2(ww) + '-' + wy };
    }
    if (mode === 'monthly') {
      var my = opts.year != null ? Number(opts.year) : now.getFullYear();
      var mm = opts.month != null ? Number(opts.month) : (now.getMonth() + 1);
      var mstart = new Date(my, mm - 1, 1, 0, 0, 0, 0);
      var mend = new Date(my, mm, 0, 23, 59, 59, 999);
      return { mode: 'monthly', start: mstart.getTime(), end: mend.getTime(), startDate: mstart, endDate: mend, label: MONTHS_FR[mm - 1] + ' ' + my, key: 'M' + pad2(mm) + '-' + my };
    }
    /* journalier (défaut) */
    var base = opts.date ? (parseAnyDate(opts.date) || now) : now;
    var dstart = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
    var dend = new Date(dstart.getTime() + 86400000 - 1);
    return { mode: 'daily', start: dstart.getTime(), end: dend.getTime(), startDate: dstart, endDate: dend, label: 'Journée du ' + pad2(dstart.getDate()) + '/' + pad2(dstart.getMonth() + 1) + '/' + dstart.getFullYear(), key: 'J' + dateKey(dstart) };
  }

  function inRange(dateVal, range) {
    var d = parseAnyDate(dateVal);
    if (!d || !range) return false;
    var t = d.getTime();
    return t >= range.start && t <= range.end;
  }
  function filterRows(rows, field, range) {
    return (rows || []).filter(function (r) { return r && inRange(r[field], range); });
  }
  function sumBy(rows, field) {
    var s = 0;
    (rows || []).forEach(function (r) { if (r) s += num(r[field]); });
    return s;
  }

  /* ───────── Agrégation par atelier (ligne A / B / —) ───────── */
  function aggregateAteliers(articles, ofs) {
    var ofById = {};
    (ofs || []).forEach(function (o) { if (o && o.of_id != null) ofById[o.of_id] = o; });
    var lines = {};
    function bucket(line) {
      var k = (line == null || line === '') ? '—' : String(line);
      if (!lines[k]) lines[k] = { line: k, ofIds: {}, nbArticles: 0, pieces: 0, volume: 0, consumed: 0 };
      return lines[k];
    }
    (articles || []).forEach(function (a) {
      if (!a) return;
      var of = a.ordre_fabrication_id != null ? ofById[a.ordre_fabrication_id] : null;
      var b = bucket(of ? of.ligne : '—');
      b.nbArticles += 1;
      b.pieces += num(a.quantite);
      b.volume += num(a.volume_m3);
      if (of && of.of_id != null) b.ofIds[of.of_id] = of;
    });
    Object.keys(lines).forEach(function (k) {
      var b = lines[k];
      var ids = Object.keys(b.ofIds);
      b.nbOf = ids.length;
      ids.forEach(function (id) { b.consumed += num(b.ofIds[id].volume_grumes_m3); });
      b.rendement = b.consumed > 0 ? (b.volume / b.consumed) * 100 : 0;
      delete b.ofIds;
    });
    return lines;
  }

  /* ───────── Rapport consolidé ───────── */
  function buildReport(input, range) {
    input = input || {};
    var grumes = input.grumes || [];
    var articles = input.articles || [];
    var ofs = input.ofs || [];
    var lots = input.lots || [];
    var fardeaux = input.fardeaux || [];

    var pGrumes = filterRows(grumes, 'cree_le', range);
    var pArt = filterRows(articles, 'cree_le', range);
    var pLots = filterRows(lots, 'date_debut', range);
    var pFard = filterRows(fardeaux, 'date_vente', range);
    if (!pFard.length) pFard = filterRows(fardeaux, 'date_sortie_sechage', range);

    var pfStock = pArt.filter(function (a) { return String(a.statut || '').toLowerCase().indexOf('stock') >= 0; });
    var lines = aggregateAteliers(pArt, ofs);
    var lineKeys = Object.keys(lines).sort();

    var totalPieces = sumBy(pArt, 'quantite');
    var totalVolume = sumBy(pArt, 'volume_m3');
    var totalConsumed = 0;
    lineKeys.forEach(function (k) { totalConsumed += num(lines[k].consumed); });

    return {
      range: range,
      generatedAt: new Date(),
      title: 'Rapport de traçabilité',
      synthese: {
        grumesRecues: { count: pGrumes.length, volume: sumBy(pGrumes, 'volume_m3') },
        production: { count: pArt.length, pieces: totalPieces, volume: totalVolume },
        pfEnStock: { count: pfStock.length, volume: sumBy(pfStock, 'volume_m3') },
        lotsOuverts: { count: pLots.length },
        fardeauxSortis: { count: pFard.length, volume: sumBy(pFard, 'volume_m3') },
        pertes: Math.max(0, totalConsumed - totalVolume),
        rendement: totalConsumed > 0 ? (totalVolume / totalConsumed) * 100 : 0
      },
      ateliers: lineKeys.map(function (k) {
        var b = lines[k];
        return { line: b.line, nbOf: b.nbOf, nbArticles: b.nbArticles, pieces: b.pieces, volume: b.volume, consumed: b.consumed, rendement: b.rendement };
      }),
      totals: { nbArticles: pArt.length, pieces: totalPieces, volume: totalVolume, consumed: totalConsumed, rendement: totalConsumed > 0 ? (totalVolume / totalConsumed) * 100 : 0 }
    };
  }

  function collectFromTraceAPI() {
    var T = (typeof TraceAPI !== 'undefined' && TraceAPI) ? TraceAPI : (typeof window !== 'undefined' ? window.TraceAPI : null);
    if (!T) return null;
    return {
      grumes: T.rows('grumes') || [],
      articles: T.rows('articles') || [],
      ofs: T.rows('of') || [],
      lots: T.rows('lots') || [],
      fardeaux: T.rows('fardeaux') || []
    };
  }

  /* ───────── Formatage FR ───────── */
  function fmtVol(v) { return num(v).toFixed(3).replace('.', ','); }
  function fmtInt(v) { return String(Math.round(num(v))).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function fmtPct(v, d) { d = (d == null ? 1 : d); var n = Math.round(num(v) * Math.pow(10, d)) / Math.pow(10, d); return n.toFixed(d).replace('.', ',') + ' %'; }

  /* ───────── Writer PDF minimal — 1 page, JPEG embarqué ─────────
     PDF 1.4 valide, objet par objet, xref correcte. Pure (testable). */
  function buildPdf(jpegBytes, imgW, imgH) {
    var jpeg = jpegBytes instanceof Uint8Array ? jpegBytes : new Uint8Array(jpegBytes || []);
    var W = imgW | 0, H = imgH | 0;
    var PDFW = '595.28', PDFH = '841.89';
    function enc(str) { var a = new Uint8Array(str.length); for (var i = 0; i < str.length; i++) a[i] = str.charCodeAt(i) & 0xff; return a; }
    function pad10(n) { var s = String(n); while (s.length < 10) s = '0' + s; return s; }

    var contentBytes = enc('q\n' + PDFW + ' 0 0 ' + PDFH + ' 0 0 cm\n/Im0 Do\nQ\n');
    var obj1 = enc('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    var obj2 = enc('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    var obj3 = enc('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PDFW + ' ' + PDFH + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n');
    var obj4head = enc('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + W + ' /Height ' + H + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n');
    var obj4tail = enc('\nendstream\nendobj\n');
    var obj5head = enc('5 0 obj\n<< /Length ' + contentBytes.length + ' >>\nstream\n');
    var obj5tail = enc('\nendstream\nendobj\n');

    var header = enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    var parts = [header];
    var offsets = [0, 0, 0, 0, 0, 0];
    var pos = header.length;
    function push(a) { parts.push(a); pos += a.length; }
    offsets[1] = pos; push(obj1);
    offsets[2] = pos; push(obj2);
    offsets[3] = pos; push(obj3);
    offsets[4] = pos; push(obj4head); push(jpeg); push(obj4tail);
    offsets[5] = pos; push(obj5head); push(contentBytes); push(obj5tail);
    var xrefPos = pos;
    var xref = 'xref\n0 6\n0000000000 65535 f \n';
    for (var i = 1; i <= 5; i++) xref += pad10(offsets[i]) + ' 00000 n \n';
    xref += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n';
    push(enc(xref));

    var total = 0; parts.forEach(function (p) { total += p.length; });
    var out = new Uint8Array(total); var o = 0;
    parts.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
  }

  /* ───────── Rendu canvas A4 ───────── */
  var PALETTE = { ink: '#0f172a', slate: '#1e293b', muted: '#64748b', faint: '#94a3b8', line: '#e2e8f0', bg: '#ffffff', soft: '#f8fafc', accent: '#0d9488', accentSoft: '#ccfbf1', warn: '#b45309' };

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function renderCanvas(report, logoImg) {
    var W = 2480, H = 3508;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    var M = 140, contentW = W - M * 2;
    var P = PALETTE;
    var y = 0;

    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';

    /* En-tête */
    ctx.fillStyle = P.ink; ctx.fillRect(0, 0, W, 320);
    ctx.fillStyle = P.accent; ctx.fillRect(0, 312, W, 8);
    var tx = M;
    if (logoImg && logoImg.width) {
      try { ctx.drawImage(logoImg, M, 70, 180, 180); tx = M + 210; } catch (e) { tx = M; }
    } else {
      ctx.fillStyle = P.accent; ctx.fillRect(M, 70, 180, 180);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 110px Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('C', M + 90, 164);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      tx = M + 210;
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 66px Arial, sans-serif';
    ctx.fillText('RAPPORT DE TRAÇABILITÉ', tx, 150);
    ctx.fillStyle = '#cbd5e1'; ctx.font = '38px Arial, sans-serif';
    ctx.fillText(report.range.label, tx, 215);
    ctx.fillStyle = P.accent; ctx.font = 'bold 32px Arial, sans-serif';
    ctx.fillText('SARL CHARBEN INDUSTRIE', tx, 272);
    ctx.textAlign = 'right'; ctx.fillStyle = '#94a3b8'; ctx.font = '30px Arial, sans-serif';
    ctx.fillText('Édité le ' + report.generatedAt.toLocaleDateString('fr-FR') + ' à ' + report.generatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), W - M, 272);
    ctx.textAlign = 'left';

    y = 400;
    function sectionTitle(t) {
      ctx.fillStyle = P.accent; ctx.fillRect(M, y - 36, 12, 48);
      ctx.fillStyle = P.ink; ctx.font = 'bold 42px Arial, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(t, M + 32, y);
      ctx.strokeStyle = P.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(M, y + 22); ctx.lineTo(W - M, y + 22); ctx.stroke();
      y += 76;
    }
    function statCard(x, top, w, h, label, value, sub) {
      ctx.fillStyle = P.soft; roundRect(ctx, x, top, w, h, 18); ctx.fill();
      ctx.strokeStyle = P.line; ctx.lineWidth = 2; roundRect(ctx, x, top, w, h, 18); ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = P.muted; ctx.font = 'bold 24px Arial, sans-serif';
      ctx.fillText(label.toUpperCase(), x + 34, top + 62);
      ctx.fillStyle = P.ink; ctx.font = 'bold 56px Arial, sans-serif';
      ctx.fillText(value, x + 34, top + 142);
      ctx.fillStyle = P.faint; ctx.font = '26px Arial, sans-serif';
      ctx.fillText(sub, x + 34, top + 184);
    }

    /* Bloc 1 — Synthèse globale (hero rendement + 4 cartes) */
    sectionTitle('Synthèse globale — Production & matières');
    var heroH = 270, heroTop = y;
    ctx.fillStyle = P.ink; roundRect(ctx, M, heroTop, contentW, heroH, 20); ctx.fill();
    ctx.fillStyle = P.accent; ctx.fillRect(M, heroTop, 14, heroH);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillText('RENDEMENT MATIÈRE GLOBAL', M + 48, heroTop + 72);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 118px Arial, sans-serif';
    ctx.fillText(fmtPct(report.synthese.rendement), M + 44, heroTop + 200);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fca5a5'; ctx.font = 'bold 42px Arial, sans-serif';
    ctx.fillText('Pertes : ' + fmtVol(report.synthese.pertes) + ' m³', M + contentW - 44, heroTop + 96);
    ctx.fillStyle = '#cbd5e1'; ctx.font = '32px Arial, sans-serif';
    ctx.fillText('Volume produit : ' + fmtVol(report.totals.volume) + ' m³', M + contentW - 44, heroTop + 165);
    ctx.fillText('Grumes consommées : ' + fmtVol(report.totals.consumed) + ' m³', M + contentW - 44, heroTop + 220);
    ctx.textAlign = 'left';
    y += heroH + 40;

    var gap = 30, nCards = 4, cardH = 214;
    var cardW = (contentW - gap * (nCards - 1)) / nCards;
    var cards = [
      ['Grumes reçues', fmtInt(report.synthese.grumesRecues.count), fmtVol(report.synthese.grumesRecues.volume) + ' m³'],
      ['Production', fmtInt(report.synthese.production.pieces) + ' pcs', fmtVol(report.synthese.production.volume) + ' m³'],
      ['PF en stock', fmtInt(report.synthese.pfEnStock.count), fmtVol(report.synthese.pfEnStock.volume) + ' m³'],
      ['Fardeaux sortis', fmtInt(report.synthese.fardeauxSortis.count), fmtVol(report.synthese.fardeauxSortis.volume) + ' m³']
    ];
    cards.forEach(function (c, i) { statCard(M + i * (cardW + gap), y, cardW, cardH, c[0], c[1], c[2]); });
    y += cardH + 74;

    /* Bloc 2 — Récapitulatif par atelier + totaux */
    sectionTitle('Récapitulatif par atelier');
    var cols = [
      { t: 'Ligne', w: 0.16, align: 'left' },
      { t: 'Nb OF', w: 0.12, align: 'right' },
      { t: 'Pièces', w: 0.15, align: 'right' },
      { t: 'Volume (m³)', w: 0.17, align: 'right' },
      { t: 'Grumes cons. (m³)', w: 0.22, align: 'right' },
      { t: 'Rendement', w: 0.18, align: 'right' }
    ];
    var rowH = 82;
    var rows = report.ateliers.map(function (a) {
      var name = a.line === '—' ? 'Non affecté' : ('Ligne ' + a.line);
      return [name, fmtInt(a.nbOf), fmtInt(a.pieces), fmtVol(a.volume), fmtVol(a.consumed), fmtPct(a.rendement)];
    });
    if (!rows.length) rows.push(['Aucune donnée sur la période', '—', '—', '—', '—', '—']);
    rows.push(['TOTAL', '—', fmtInt(report.totals.pieces), fmtVol(report.totals.volume), fmtVol(report.totals.consumed), fmtPct(report.totals.rendement)]);

    /* En-tête de table */
    ctx.fillStyle = P.ink; ctx.fillRect(M, y, contentW, rowH);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px Arial, sans-serif';
    var cx = M;
    cols.forEach(function (c) {
      var cw = contentW * c.w;
      if (c.align === 'right') { ctx.textAlign = 'right'; ctx.fillText(c.t, cx + cw - 26, y + rowH * 0.66); }
      else { ctx.textAlign = 'left'; ctx.fillText(c.t, cx + 26, y + rowH * 0.66); }
      cx += cw;
    });
    y += rowH;

    rows.forEach(function (r, ri) {
      var isTotal = (ri === rows.length - 1);
      ctx.fillStyle = isTotal ? P.accentSoft : (ri % 2 ? P.soft : '#ffffff');
      ctx.fillRect(M, y, contentW, rowH);
      ctx.strokeStyle = P.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(M, y + rowH); ctx.lineTo(M + contentW, y + rowH); ctx.stroke();
      var cx2 = M;
      cols.forEach(function (c, ci) {
        var cw = contentW * c.w;
        var val = String(r[ci] == null ? '' : r[ci]);
        ctx.font = (isTotal ? 'bold ' : '') + '30px Arial, sans-serif';
        ctx.fillStyle = isTotal ? P.ink : P.slate;
        if (c.align === 'right') { ctx.textAlign = 'right'; ctx.fillText(val, cx2 + cw - 26, y + rowH * 0.66); }
        else { ctx.textAlign = 'left'; ctx.fillText(val, cx2 + 26, y + rowH * 0.66); }
        cx2 += cw;
      });
      y += rowH;
    });

    /* Pied de page */
    ctx.strokeStyle = P.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(M, H - 130); ctx.lineTo(W - M, H - 130); ctx.stroke();
    ctx.fillStyle = P.muted; ctx.font = '26px Arial, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('SARL Charben Industrie — Gestion des Découpes', M, H - 74);
    ctx.textAlign = 'right';
    ctx.fillText('Rapport de traçabilité — ' + report.range.label, W - M, H - 74);
    ctx.textAlign = 'left';

    return cv;
  }

  /* ───────── Encodage image / sauvegarde ───────── */
  function canvasToJpegBytes(canvas) {
    var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    var b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    var bin = (typeof atob === 'function') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function bytesToBase64(bytes) {
    var CHUNK = 0x8000, out = '';
    for (var i = 0; i < bytes.length; i += CHUNK) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(out);
  }
  function toast(msg, type) {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') window.showToast(msg, type || 'info');
  }
  function loadLogo(cb) {
    try {
      if (typeof Image === 'undefined') { cb(null); return; }
      var img = new Image();
      img.onload = function () { cb(img); };
      img.onerror = function () { cb(null); };
      img.src = 'header-logo.png';
    } catch (e) { cb(null); }
  }
  function downloadFallback(bytes, filename) {
    var blob = new Blob([bytes], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 4000);
    toast('Rapport PDF généré : ' + filename, 'success');
  }
  function savePdf(bytes, filename) {
    var cap = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) ? window.Capacitor.Plugins.Filesystem : null;
    if (cap) {
      try {
        cap.writeFile({ path: filename, data: bytesToBase64(bytes), directory: 'DOCUMENTS', encoding: 'base64', recursive: true })
          .then(function () { toast('Rapport PDF enregistré : ' + filename, 'success'); })
          .catch(function () { downloadFallback(bytes, filename); });
        return;
      } catch (e) { downloadFallback(bytes, filename); return; }
    }
    downloadFallback(bytes, filename);
  }
  function generate(mode, opts) {
    if (typeof document === 'undefined') return null;
    var input = collectFromTraceAPI();
    if (!input) { toast('Traçabilité indisponible — synchronisez la base.', 'error'); return null; }
    var range = buildRange(mode || 'daily', opts || {});
    var report = buildReport(input, range);
    var result = { range: range, report: report };
    loadLogo(function (logo) {
      try {
        var canvas = renderCanvas(report, logo);
        var jpeg = canvasToJpegBytes(canvas);
        var pdf = buildPdf(jpeg, canvas.width, canvas.height);
        savePdf(pdf, 'Rapport_Tracabilite_' + range.key + '.pdf');
      } catch (e) { toast('Échec de génération du rapport', 'error'); }
    });
    return result;
  }
  function generateFromForm() {
    if (typeof document === 'undefined') return;
    function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
    var mode = val('traceReportMode') || 'daily';
    var opts = {};
    if (mode === 'daily') { opts.date = val('traceReportDate'); }
    else if (mode === 'weekly') { opts.week = Number(val('traceReportWeek')); opts.year = Number(val('traceReportYear')); }
    else if (mode === 'monthly') { opts.month = Number(val('traceReportMonth')); opts.year = Number(val('traceReportYear')); }
    generate(mode, opts);
  }

  /* Aligne la visibilité des champs sur le mode + pré-remplit les valeurs par défaut. */
  function syncForm() {
    if (typeof document === 'undefined') return;
    var modeEl = document.getElementById('traceReportMode');
    if (!modeEl) return;
    var mode = modeEl.value || 'daily';
    var now = new Date();
    function show(wrapId, inputId, on, val) {
      var wrap = document.getElementById(wrapId);
      if (wrap) wrap.hidden = !on;
      var el = document.getElementById(inputId);
      if (el && on && val != null && el.value === '') el.value = val;
    }
    var dateEl = document.getElementById('traceReportDate');
    if (dateEl && dateEl.value === '') dateEl.value = dateKey(now);
    var iw = isoWeekOf(now);
    show('traceReportDateWrap', 'traceReportDate', mode === 'daily');
    show('traceReportWeekWrap', 'traceReportWeek', mode === 'weekly', iw.week);
    show('traceReportMonthWrap', 'traceReportMonth', mode === 'monthly', now.getMonth() + 1);
    show('traceReportYearWrap', 'traceReportYear', mode === 'weekly' || mode === 'monthly', (mode === 'weekly' ? iw.year : now.getFullYear()));
  }
  try {
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncForm);
      else syncForm();
    }
  } catch (e) {}

  return {
    ReportModel: {
      MONTHS_FR: MONTHS_FR, pad2: pad2, num: num,
      parseAnyDate: parseAnyDate, dateKey: dateKey,
      isoWeekOf: isoWeekOf, mondayOfIsoWeek: mondayOfIsoWeek,
      buildRange: buildRange, inRange: inRange, filterRows: filterRows, sumBy: sumBy,
      aggregateAteliers: aggregateAteliers, buildReport: buildReport, collectFromTraceAPI: collectFromTraceAPI,
      fmtVol: fmtVol, fmtInt: fmtInt, fmtPct: fmtPct
    },
    ReportGenerator: {
      buildPdf: buildPdf,
      renderCanvas: renderCanvas,
      canvasToJpegBytes: canvasToJpegBytes,
      bytesToBase64: bytesToBase64,
      generate: generate,
      generateFromForm: generateFromForm,
      syncForm: syncForm,
      savePdf: savePdf,
      PALETTE: PALETTE
    }
  };
});
