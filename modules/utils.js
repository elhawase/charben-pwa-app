/**
 * UTILS.JS — Fonctions utilitaires pures (flatten, CSV, export)
 * Scierie Charben — Extraits depuis data-tables.js
 * ZERO DOM, ZERO side effects — pures transformations de données
 */
'use strict';

/* ─────────────────────────────────────────────
   flattenOrderRow — aplatit OF imbriqué
   Extrait: data-tables.js lignes 302-313
   ───────────────────────────────────────────── */

window._utils_flattenOrderRow = function(o) {
  var flat = {};
  for (var k in o) {
    var v = o[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (var k2 in v) flat[k + '.' + k2] = v[k2];
    } else {
      flat[k] = v;
    }
  }
  return flat;
};

/* ─────────────────────────────────────────────
   unflattenRow — reconstruit objets imbriqués
   Extrait: data-tables.js lignes 317-334
   ───────────────────────────────────────────── */

window._utils_unflattenRow = function(row) {
  if (!row || typeof row !== 'object') return row;
  var out = {};
  Object.keys(row).forEach(function(k) {
    if (k.indexOf('.') > 0) {
      var parts = k.split('.');
      var target = out;
      for (var i = 0; i < parts.length - 1; i++) {
        if (typeof target[parts[i]] !== 'object' || target[parts[i]] === null || Array.isArray(target[parts[i]])) target[parts[i]] = {};
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = row[k];
    } else {
      out[k] = row[k];
    }
  });
  return out;
};

/* ─────────────────────────────────────────────
   humanizeKey — nom de champ lisible
   Extrait: data-tables.js ligne 390
   ───────────────────────────────────────────── */

window._utils_humanizeKey = function(k) {
  return (window.DATA_FIELD_LABELS && window.DATA_FIELD_LABELS[k]) || k;
};

/* ─────────────────────────────────────────────
   dataCellValue — formatage valeur cellule
   Extrait: data-tables.js ligne 397
   ───────────────────────────────────────────── */

window._utils_dataCellValue = function(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '✓' : '✕';
  if (typeof v === 'object') {
    if (Array.isArray(v)) return v.length ? v.length + ' éléments' : '—';
    return JSON.stringify(v);
  }
  return String(v);
};

/* ─────────────────────────────────────────────
   csvCell — échappement cellule CSV
   Extrait: data-tables.js ligne 539
   ───────────────────────────────────────────── */

window._utils_csvCell = function(v) {
  if (v === null || v === undefined) return '';
  var s = String(v);
  if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
};

/* ─────────────────────────────────────────────
   dataXmlEscape — échappement XML
   Extrait: data-tables.js ligne 568
   ───────────────────────────────────────────── */

window._utils_dataXmlEscape = function(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

/* ─────────────────────────────────────────────
   downloadBlob — téléchargement blob
   Extrait: data-tables.js ligne 577
   ───────────────────────────────────────────── */

window._utils_downloadBlob = function(content, filename, mime) {
  var blob = new Blob([content], { type: mime || 'text/plain' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/* ─────────────────────────────────────────────
   parseCsv — parser CSV
   Extrait: data-tables.js ligne 641
   ───────────────────────────────────────────── */

window._utils_parseCsv = function(text, cols) {
  var lines = text.split(/\r?\n/).filter(function(l) { return l.trim(); });
  if (lines.length < 2) return [];
  var headers = window._utils_splitCsvLine(lines[0]);
  return lines.slice(1).map(function(line) {
    var vals = window._utils_splitCsvLine(line);
    var row = {};
    headers.forEach(function(h, i) {
      var col = cols ? cols.find(function(c) { return c.k === h; }) : null;
      var key = col ? col.k : h;
      row[key] = window._utils_cleanCsvCell(vals[i] || '');
    });
    return row;
  });
};

/* ─────────────────────────────────────────────
   splitCsvLine — découpe ligne CSV
   Extrait: data-tables.js ligne 683
   ───────────────────────────────────────────── */

window._utils_splitCsvLine = function(line) {
  var result = [];
  var current = '';
  var inQuote = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
};

/* ─────────────────────────────────────────────
   cleanCsvCell — nettoyage cellule
   Extrait: data-tables.js ligne 705
   ───────────────────────────────────────────── */

window._utils_cleanCsvCell = function(v) {
  if (!v) return '';
  return v.trim();
};

/* ─── FICHE SHELL HELPER (DRY) ─── */
function ficheShell(opts) {
  var variant = opts.variant || 'flux';
  var id = opts.id || '';
  var title = opts.title || '';
  var content = opts.content || '';
  var extraClass = opts.extraClass || '';
  var headerExtra = opts.headerExtra || '';
  if (variant === 'a1') {
    return '<div class="card" style="margin-top:12px;padding:0;overflow:hidden;">'
      + '<details id="' + id + '" class="fiche-a1 ' + extraClass + '">'
      + '<summary class="fiche-summary" style="cursor:pointer;padding:10px 14px;font-size:13px;font-weight:700;user-select:none;display:flex;justify-content:space-between;align-items:center;">'
      + '<span>' + title + '</span><span class="fiche-chevron" style="font-size:11px;color:var(--text-muted);">▼</span></summary>'
      + '<div style="padding:0 14px 12px;">' + content + '</div></details></div>';
  }
  return '<details class="flux-fiche ' + extraClass + '" style="margin-top:10px;width:100%;max-width:100%;padding:0;background:var(--bg-card, rgba(255,255,255,.04));border:1px solid var(--border-color);border-radius:12px;overflow:hidden;">'
    + '<summary class="fiche-summary" style="cursor:pointer;padding:10px 12px;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">'
    + '<span style="font-size:12px;font-weight:700;">📋 ' + title + '</span>'
    + '<span class="fiche-chevron" style="font-size:12px;color:var(--text-muted);transition:transform .2s;">▾</span>'
    + '</summary>'
    + '<div style="padding:0 12px 12px;">' + (headerExtra ? '<div>' + headerExtra + '</div>' : '') + content + '</div></details>';
}

/* ─────────────────────────────────────────────
   EXPORT GLOBAL
   ───────────────────────────────────────────── */

window.utils = {
  flattenOrderRow: window._utils_flattenOrderRow,
  unflattenRow: window._utils_unflattenRow,
  humanizeKey: window._utils_humanizeKey,
  dataCellValue: window._utils_dataCellValue,
  csvCell: window._utils_csvCell,
  dataXmlEscape: window._utils_dataXmlEscape,
  downloadBlob: window._utils_downloadBlob,
  parseCsv: window._utils_parseCsv,
  splitCsvLine: window._utils_splitCsvLine,
  cleanCsvCell: window._utils_cleanCsvCell
};
