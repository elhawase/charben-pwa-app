/**
 * FARDEAUX-RENDERER.JS — Fardeaux (lots de séchage) : codes, QR, fiches, forms.
 * Copies EXACTES des fonctions pures ; passthrough pour les gros renders.
 * Globals: fardeaux, _fardeauCounter, _qrScanAlphabet, finishedGoods, dryingBatches
 */
'use strict';

/* ─────────────────────────────────────────────
   Fonctions pures fardeaux — copies EXACTES
   Extrait EXACT: app.js lignes 5513-5609, 5622-5659, 5663-5677, 6211-6217
   ───────────────────────────────────────────── */

window._fardeauxRenderer_fardeauxSave = function() {
  if (typeof fardeaux === 'undefined') return;
  var localOk = true;
  try {
    localStorage.setItem('charben_fardeaux', JSON.stringify(fardeaux));
  } catch (e) {
    localOk = false;
    errLog('fardeaux', 'save localStorage', e, 'error');
  }
  if (typeof fsSave === 'function') {
    try {
      if (typeof FS_COLLECTIONS !== 'undefined' && !FS_COLLECTIONS.fardeaux) {
        FS_COLLECTIONS.fardeaux = 'fardeaux';
      }
      fsSave('fardeaux', fardeaux);
    } catch (e) {
      errLog('fardeaux', 'save firestore', e, 'error');
    }
  }
  /* Un echec d'ecriture local est le seul cas critique : le fardeau
     existe en memoire mais sera perdu au redemarrage. */
  if (!localOk) {
    errUser('Fardeau non enregistré sur l\'appareil. Rechargez avant de continuer.', 'Fardeaux');
  }
};

window._fardeauxRenderer_genFardeauCode = function() {
  var year = new Date().getFullYear();
  var existing = (typeof fardeaux !== 'undefined' ? fardeaux : []).filter(function(f) {
    return f.code && String(f.code).indexOf('FRD-' + year) === 0;
  });
  var maxNum = 0;
  existing.forEach(function(f) {
    var n = parseInt(String(f.code).replace('FRD-' + year + '-', ''), 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  });
  maxNum = Math.max(maxNum, _fardeauCounter);
  _fardeauCounter = maxNum + 1;
  return 'FRD-' + year + '-' + String(maxNum + 1).padStart(3, '0');
};

window._fardeauxRenderer_fardeauScanCodeTaken = function(code) {
  code = String(code || '').toUpperCase();
  if (!code) return true;
  var inFrs = (typeof fardeaux !== 'undefined' ? fardeaux : []).some(function(f) {
    return f.scanCode === code || String(f.code || '').toUpperCase() === code;
  });
  if (inFrs) return true;
  if (typeof grumeScanCodeTaken === 'function' && grumeScanCodeTaken(code)) return true;
  return (typeof finishedGoods !== 'undefined' ? finishedGoods : []).some(function(f) {
    return f.scanCode === code;
  });
};

window._fardeauxRenderer_genFardeauScanCode = function() {
  var out = '';
  for (var i = 0; i < 10; i++) out += _qrScanAlphabet.charAt(Math.floor(Math.random() * _qrScanAlphabet.length));
  return out;
};

window._fardeauxRenderer_ensureFardeauxScanCodes = function() {
  if (typeof fardeaux === 'undefined') return false;
  var changed = false;
  fardeaux.forEach(function(f) {
    if (!f.scanCode) {
      var code = window._fardeauxRenderer_genFardeauScanCode();
      for (var tries = 0; tries < 20 && window._fardeauxRenderer_fardeauScanCodeTaken(code); tries++) code = window._fardeauxRenderer_genFardeauScanCode();
      f.scanCode = code;
      changed = true;
    }
  });
  if (changed) window._fardeauxRenderer_fardeauxSave();
  return changed;
};

window._fardeauxRenderer_closeFardeauDetailModal = function() {
  var modal = document.getElementById('fardeauDetailModal');
  if (modal) modal.classList.remove('open');
};

window._fardeauxRenderer_fardeauQrPayload = function(f) {
  if (!f) return '';
  if (!String(f.scanCode || '').trim()) window._fardeauxRenderer_ensureFardeauxScanCodes();
  var sec = String(f.scanCode || '').trim() || f.code || '';
  return JSON.stringify({
    t: 'FRD',
    ref: sec,
    c: f.code || '',
    ess: f.essence || '',
    n: (f.items || []).reduce(function(a, it) { return a + (it.qty || 0); }, 0),
    v: (f.volumeTotal != null) ? +f.volumeTotal.toFixed(3) : 0,
    date: (f.sortieSechageAt || f.createdAt || '').slice(0, 10)
  });
};

window._fardeauxRenderer_findFardeauByRef = function(ref) {
  if (!ref) return null;
  var up = String(ref).toUpperCase().trim();
  return (typeof fardeaux !== 'undefined' ? fardeaux : []).find(function(f) {
    return String(f.scanCode || '').toUpperCase() === up || String(f.code || '').toUpperCase() === up;
  }) || null;
};

window._fardeauxRenderer_fardeauFormLiveTotals = function() {
  var data = fardeauFormCollect();
  var elP = document.getElementById('fardeauTotalPieces');
  var elV = document.getElementById('fardeauTotalVol');
  if (elP) elP.textContent = data.nbPieces;
  if (elV) elV.textContent = data.volumeTotal.toFixed(4);
};

/* ─────────────────────────────────────────────
   Gros renders / interactions — passthrough (couplés app.js)
   ───────────────────────────────────────────── */

// Exact copy from app.js
window._fardeauxRenderer_openFardeauDetail = function(id) {
  ensureFardeauxScanCodes();
  var f = (typeof fardeaux !== 'undefined' ? fardeaux : []).find(function(x) { return x.id === id; });
  if (!f) return;
  if (typeof FS_COLLECTIONS !== 'undefined' && !FS_COLLECTIONS.fardeaux) FS_COLLECTIONS.fardeaux = 'fardeaux';
  var modal = document.getElementById('fardeauDetailModal');
  if (!modal) return;
  document.getElementById('fardeauDetailTitle').textContent = 'Fiche fardeau · ' + f.code;
  var body = document.getElementById('fardeauDetailBody');
  var nbPieces = (f.items || []).reduce(function(a, it) { return a + (it.qty || 0); }, 0);
  var vol = (f.volumeTotal != null) ? f.volumeTotal : ((f.items || []).reduce(function(a, it) { return a + (it.volume || 0); }, 0));
  var statutBadge = f.statut === 'VENDU'
    ? '<span class="badge badge-consumed">Vendu</span>'
    : '<span class="badge badge-stock">En stock</span>';
  var rows = (f.items || []).map(function(it) {
    return '<tr><td style="padding:6px 4px;">' + escapeHtml(it.item || '—') + '</td>'
      + '<td style="padding:6px 4px;text-align:center;">' + (it.qty || 0) + ' pcs</td>'
      + '<td style="padding:6px 4px;text-align:right;">' + ((it.volume || 0)).toFixed(4) + ' m³</td></tr>';
  }).join('');
  body.innerHTML =
    '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px;">'
    + '<div class="kpi-card-v2" style="flex:1;min-width:100px;"><div class="kpi-value">' + escapeHtml(f.code || '—') + '</div><div class="kpi-label">Réf fardeau</div></div>'
    + '<div class="kpi-card-v2" style="flex:1;min-width:100px;"><div class="kpi-value">' + escapeHtml(f.essence || '—') + '</div><div class="kpi-label">Essence</div></div>'
    + '</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin-bottom:10px;">'
    + statutBadge
    + '<span class="badge badge-info">' + nbPieces + ' pièces</span>'
    + '<span class="badge badge-maintenance">' + vol.toFixed(3) + ' m³</span>'
    + (f.batchNum ? '<span class="badge badge-stock">Lot ' + escapeHtml(f.batchNum) + '</span>' : '')
    + '</div>'
    + '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Sortie séchage : <strong>' + (f.sortieSechageAt ? grumeFmtDate(f.sortieSechageAt) : '—') + '</strong> · Créé : <strong>' + grumeFmtDate(f.createdAt || f.date || '') + '</strong></div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="border-bottom:1px solid var(--glass-border);"><th style="padding:6px 4px;text-align:left;">Référence SF</th><th style="padding:6px 4px;text-align:center;">Quantité</th><th style="padding:6px 4px;text-align:right;">Volume</th></tr></thead><tbody>' + rows + '</tbody></table>'
    + (f.statut === 'VENDU'
      ? '<div style="margin-top:12px;padding:10px;border-radius:var(--radius-sm);background:var(--glass-bg);border:1px solid var(--glass-border);font-size:12px;">🚚 Vendu à <strong>' + escapeHtml(f.client || '—') + '</strong>' + (f.bl ? ' · BL <strong>' + escapeHtml(f.bl) + '</strong>' : '') + ' · le ' + grumeFmtDate(f.venduAt || '') + '</div>'
      : '');
  var actions = document.getElementById('fardeauDetailActions');
  actions.style.display = 'flex';
  actions.innerHTML = '<button class="btn btn-primary" onclick="openFardeauQrModal(\'' + f.id + '\')">▦ QR fardeau</button>'
    + '<button class="btn btn-secondary" onclick="closeFardeauDetailModal()">Fermer</button>';
  modal.classList.add('open');
  if (typeof renderLucide === 'function') renderLucide();
}
window._fardeauxRenderer_fardeauQrDataUrl = function(id) { if (typeof fardeauQrDataUrl === 'function') return fardeauQrDataUrl(id); };
window._fardeauxRenderer_openFardeauQrModal = function(id) { if (typeof openFardeauQrModal === 'function') return openFardeauQrModal(id); };
window._fardeauxRenderer_printFardeauLabel = function(id) { if (typeof printFardeauLabel === 'function') return printFardeauLabel(id); };
window._fardeauxRenderer_fardeauFormAddLine = function() { if (typeof fardeauFormAddLine === 'function') return fardeauFormAddLine(); };
window._fardeauxRenderer_fardeauFormDelLine = function(btn) { if (typeof fardeauFormDelLine === 'function') return fardeauFormDelLine(btn); };
window._fardeauxRenderer_fardeauFormRefillSelects = function(sel) { if (typeof fardeauFormRefillSelects === 'function') return fardeauFormRefillSelects(sel); };
window._fardeauxRenderer_showFardeauForm = function(batchId) { if (typeof showFardeauForm === 'function') return showFardeauForm(batchId); };
window._fardeauxRenderer_fardeauFormChangeBatch = function() { if (typeof fardeauFormChangeBatch === 'function') return fardeauFormChangeBatch(); };
window._fardeauxRenderer_fardeauFormCollect = function() { if (typeof fardeauFormCollect === 'function') return fardeauFormCollect(); };
window._fardeauxRenderer_saveFardeauFromForm = function() { if (typeof saveFardeauFromForm === 'function') return saveFardeauFromForm(); };
window._fardeauxRenderer_vendreFardeau = function(id) { if (typeof vendreFardeau === 'function') return vendreFardeau(id); };
window._fardeauxRenderer_deleteFardeau = function(id) { if (typeof deleteFardeau === 'function') return deleteFardeau(id); };
window._fardeauxRenderer_renderFrdRecap = function() { if (typeof renderFrdRecap === 'function') return renderFrdRecap(); };
window._fardeauxRenderer_renderFardeauxList = function() { if (typeof renderFardeauxList === 'function') return renderFardeauxList(); };
window._fardeauxRenderer_openFardeauScanner = function() { if (typeof openFardeauScanner === 'function') return openFardeauScanner(); };
window._fardeauxRenderer_startFardeauCamScan = function() { if (typeof startFardeauCamScan === 'function') return startFardeauCamScan(); };
window._fardeauxRenderer_stopFardeauCamScan = function() { if (typeof stopFardeauCamScan === 'function') return stopFardeauCamScan(); };

/* ─────────────────────────────────────────────
   EXPORT GLOBAL
   ───────────────────────────────────────────── */

window.fardeauxRenderer = {
  fardeauxSave: window._fardeauxRenderer_fardeauxSave,
  genFardeauCode: window._fardeauxRenderer_genFardeauCode,
  fardeauScanCodeTaken: window._fardeauxRenderer_fardeauScanCodeTaken,
  genFardeauScanCode: window._fardeauxRenderer_genFardeauScanCode,
  ensureFardeauxScanCodes: window._fardeauxRenderer_ensureFardeauxScanCodes,
  closeFardeauDetailModal: window._fardeauxRenderer_closeFardeauDetailModal,
  fardeauQrPayload: window._fardeauxRenderer_fardeauQrPayload,
  findFardeauByRef: window._fardeauxRenderer_findFardeauByRef,
  fardeauFormLiveTotals: window._fardeauxRenderer_fardeauFormLiveTotals,
  openFardeauDetail: window._fardeauxRenderer_openFardeauDetail,
  fardeauQrDataUrl: window._fardeauxRenderer_fardeauQrDataUrl,
  openFardeauQrModal: window._fardeauxRenderer_openFardeauQrModal,
  printFardeauLabel: window._fardeauxRenderer_printFardeauLabel,
  fardeauFormAddLine: window._fardeauxRenderer_fardeauFormAddLine,
  fardeauFormDelLine: window._fardeauxRenderer_fardeauFormDelLine,
  fardeauFormRefillSelects: window._fardeauxRenderer_fardeauFormRefillSelects,
  showFardeauForm: window._fardeauxRenderer_showFardeauForm,
  fardeauFormChangeBatch: window._fardeauxRenderer_fardeauFormChangeBatch,
  fardeauFormCollect: window._fardeauxRenderer_fardeauFormCollect,
  saveFardeauFromForm: window._fardeauxRenderer_saveFardeauFromForm,
  vendreFardeau: window._fardeauxRenderer_vendreFardeau,
  deleteFardeau: window._fardeauxRenderer_deleteFardeau,
  renderFrdRecap: window._fardeauxRenderer_renderFrdRecap,
  renderFardeauxList: window._fardeauxRenderer_renderFardeauxList,
  openFardeauScanner: window._fardeauxRenderer_openFardeauScanner,
  startFardeauCamScan: window._fardeauxRenderer_startFardeauCamScan,
  stopFardeauCamScan: window._fardeauxRenderer_stopFardeauCamScan
};