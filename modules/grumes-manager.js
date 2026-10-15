/**
 * GRUMES-MANAGER.JS — Grumes: scan QR, lancement, recherche, caméra.
 * Copies EXACTES. Globals: rawMaterials, camScanState, lineLaunch,
 * LAUNCH_WIDTH_TOLERANCE, LINE_LAUNCH_KEY, _qrScanAlphabet, escapeHtml
 * Calls externes: showToast, renderLigne, renderLucide, renderGrumes,
 * addAuditLog, getLineOrder, fsSave, saveToStorage, launchGrumeByRef
 */
'use strict';

window._grumesManager_grumeDaysAge = function(r) {
  try {
    var d = new Date(r.createdAt || r.date || Date.now());
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  } catch (e) { return 0; }
}

window._grumesManager_genGrumeScanCode = function() {
  var out = '';
  for (var i = 0; i < 10; i++) {
    out += _qrScanAlphabet.charAt(Math.floor(Math.random() * _qrScanAlphabet.length));
  }
  return out;
}

window._grumesManager_grumeScanCodeTaken = function(code) {
  code = String(code || '').toUpperCase();
  if (!code) return true;
  return rawMaterials.some(function(g) {
    return g.scanCode === code || String(g.code || '').toUpperCase() === code;
  });
}

window._grumesManager_grumeQrPayload = function(g) {
  if (!g) return '';
  if (!String(g.scanCode || '').trim()) ensureGrumeScanCodes();
  var sec = String(g.scanCode || '').trim() || g.code || '';
  return JSON.stringify({
    t: 'GR',
    ref: sec,
    ess: g.essence || '',
    d: g.diametre || 0,
    l: g.longueur || 0,
    v: g.volume || 0,
    date: (g.createdAt || '').slice(0, 10)
  });
}

window._grumesManager_parseQrPayload = function(data) {
  try {
    var o = JSON.parse(data);
    if (o && o.t === 'GR' && o.ref) return { ref: String(o.ref), essence: o.ess, diametre: o.d, longueur: o.l };
  } catch (e) {}
  return { ref: String(data || '').trim(), essence: null };
}

window._grumesManager_drawGrumeQr = function(canvas, payload, cellSize) {
  if (!canvas || !window.qrcode) return false;
  try {
    var qr = qrcode(0, 'M');
    qr.addData(payload || '');
    qr.make();
    var size = qr.getModuleCount();
    var cs = cellSize || Math.max(4, Math.round(220 / size));
    canvas.width = size * cs;
    canvas.height = size * cs;
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
    canvas.style.imageRendering = 'pixelated';
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(c * cs, r * cs, cs, cs);
      }
    }
    return true;
  } catch (e) {
    errLog('grumes-manager', 'QR generation', e, 'error');
    return false;
  }
}

window._grumesManager_grumeFmtDate = function(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2);
}

window._grumesManager_lineLaunchState = function(line) {
  if (!lineLaunch[line]) lineLaunch[line] = { launched: [] };
  return lineLaunch[line];
}

window._grumesManager_saveLineLaunch = function() {
  saveToStorage(LINE_LAUNCH_KEY, lineLaunch);
  if (typeof fsSave === 'function') fsSave('lineLaunch', lineLaunch);
}

window._grumesManager_lineLaunchedForOf = function(line, ofNum) {
  return (lineLaunchState(line).launched || []).filter(function(l) { return l.ofNum === ofNum; });
}

/* Gate cutting-engine (étape 3) — classe + largeurs + bilan AVANT de lancer la
   grume. Renvoie true si l'on peut continuer. Silencieux si le module est absent
   (compat tests / chargement partiel). */
window._grumesManager_gateDecoupe = function(line, g, o) {
  if (typeof cuttingEngine === 'undefined' || !cuttingEngine || typeof cuttingEngine.evaluerGrume !== 'function') return true;
  var ev = cuttingEngine.evaluerGrume(g, o);
  if (ev && ev.ok) return true;
  var resume = (ev && ev.resume) || ('Découpe refusée pour ' + (g && g.code));
  if (typeof addAuditLog === 'function') addAuditLog('Lancement bloqué cutting-engine ' + line + ': ' + (g && g.code) + ' — ' + resume);
  showToast(resume, 'error');
  return false;
};

window._grumesManager_launchGrume = function(line, grumeId) {
  var g = rawMaterials.find(function(x) { return x.id === grumeId; });
  if (!g) return;
  var o = getLineOrder(line);
  if (!o) { showToast('Aucun OF en cours pour la ligne ' + line, 'warning'); return; }
  // === GARDE-FOU ESSENCE (Pin vs Épicéa) ===
  // L'essence de la grume doit correspondre à celle de l'OF (keys gamme: pin/spruce vs labels grume: Pin/Épicéa)
  var ofEssKey = String(o.essence || 'spruce').toLowerCase();
  if (ofEssKey === 'pin') ofEssKey = 'pin';
  else if (ofEssKey === 'pine') ofEssKey = 'pin';
  else ofEssKey = 'spruce';
  var gEssNorm = String(g.essence || '').trim().toLowerCase();
  if (gEssNorm === 'pin' || gEssNorm === 'pine') gEssNorm = 'pin';
  else if (gEssNorm === '\u00e9pic\u00e9a' || gEssNorm === 'spruce' || gEssNorm === 'epicea') gEssNorm = 'spruce';
  else gEssNorm = '';
  if (gEssNorm && gEssNorm !== ofEssKey) {
    addAuditLog('Lancement bloqué essence: ' + g.code + ' (' + g.essence + ') ≠ OF ' + o.orderNum + ' (' + ofEssKey + ')');
    showToast('Essence incompatible : grume ' + g.essence + ' ≠ OF ' + o.orderNum + ' (' + ofEssKey + ')', 'error');
    return;
  }
  // === GARDE-FOU DIAMÈTRE PLAGE (A1/B1) ===
  // La grume doit être dans la plage [logWidthMin → logWidthMax] du motif
  var ofWmin = parseFloat(o.logWidthMin) || 0;
  var ofWmax = parseFloat(o.logWidthMax) || parseFloat(o.logWidth) || ofWmin;
  var gw = grumeWidthMm(g);
  if (ofWmax && gw > ofWmax) {
    addAuditLog('Lancement bloqué garde-fou diamètre: ' + g.code + ' Ø' + gw + 'mm > Ø max OF ' + o.orderNum + ' ' + ofWmax + 'mm');
    showToast('Garde-fou diamètre : grume Ø' + gw + 'mm > Ø max ' + ofWmax + 'mm — dépasse la capacité de l\'OF', 'error');
    return;
  }
  if (ofWmin && gw < ofWmin) {
    addAuditLog('Lancement bloqué garde-fou diamètre: ' + g.code + ' Ø' + gw + 'mm < Ø min motif ' + o.orderNum + ' ' + ofWmin + 'mm');
    showToast('Garde-fou diamètre : grume Ø' + gw + 'mm < Ø min requis ' + ofWmin + 'mm — pièces impossibles à débitter', 'error');
    return;
  }
  // === GATE CUTTING-ENGINE (classe C1/C2/C3 + bilan matière) ===
  if (!window._grumesManager_gateDecoupe(line, g, o)) return;
  var dGrume = parseFloat(g.diametre) || 0;
  var st = lineLaunchState(line);
  var launchId = 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  st.launched.push({
    id: launchId,
    code: g.code, widthMm: grumeWidthMm(g), diametreCm: dGrume || null,
    longueur: g.longueur || 0, ofNum: o.orderNum || '',
    launchedAt: new Date().toISOString(), validatedAt: null
  });
  g.statut = 'EN_COURSE';
  g.launchedAt = new Date().toISOString();
  var ofModifie = false;
  if (!o.pieceLength && (parseFloat(g.longueur) || 0) > 0) {
    o.pieceLength = Math.round(parseFloat(g.longueur) * 1000);
    ofModifie = true;
  }
  // Le diamètre de la grume n'est connu qu'ici : à la création de l'OF il n'y a
  // pas encore de matière. Sans ce relevé, aucune OF ne portera de diamètre et
  // la prévision de stock ne pourra que lire un bucket « 65 cm » inventé.
  if (!o.grumeDiametre && dGrume > 0) {
    o.grumeDiametre = dGrume;
    ofModifie = true;
  }
  if (ofModifie) {
    if (typeof safeSave === 'function') safeSave(STORAGE_KEYS.orders, orders);
    if (typeof fsSave === 'function') fsSave('orders', orders);
  }
  saveToStorage('charben_raw', rawMaterials);
  fsSave('raw', rawMaterials);
  saveLineLaunch();
  if (typeof validateGrumeA1 === 'function') {
    try { validateGrumeA1(line, g.code); } catch (e) { errLog('grumes-manager', 'Validation A1', e, 'warn'); }
  }
  addAuditLog('Grume lanc\u00e9e ligne ' + line + ' (OF ' + (o.orderNum || '') + '): ' + g.code + ' ' + grumeWidthMm(g) + 'mm L=' + (g.longueur || '?') + 'm');
  renderLigne(line);
  renderLucide();
  renderGrumes();
  renderDashboardKPIs();
  if (typeof renderWipMatrix === 'function') renderWipMatrix();
  showToast('Grume lanc\u00e9e : ' + g.code, 'success');
}

window._grumesManager_confirmGrumeSelection = function(line) {
  var id = launcherSel[line];
  if (!id) { showToast('Sélectionnez une grume dans la liste', 'warning'); return; }
  var g = rawMaterials.find(function(x) { return x.id === id; });
  if (!g) return;
  var o = getLineOrder(line);
  if (!o) { launchGrume(line, id); return; }
  var ofWmin = parseFloat(o.logWidthMin) || 0;
  var ofWmax = parseFloat(o.logWidthMax) || parseFloat(o.logWidth) || 0;
  var gw = grumeWidthMm(g);
  if (ofWmin && gw < ofWmin) {
    showToast('Grume trop étroite : ' + gw + 'mm < Ø min motif ' + ofWmin + 'mm', 'error');
    return;
  }
  if (ofWmax && gw > ofWmax) {
    showToast('Grume trop large : ' + gw + 'mm > Ø max OF ' + ofWmax + 'mm', 'error');
    return;
  }
  launchGrume(line, id);
  launcherSel[line] = null;
}

window._grumesManager_selectGrumeForLine = function(line, grumeId) {
  launcherSel[line] = (launcherSel[line] === grumeId) ? null : grumeId;
  renderGrumeLauncherResults(line);
}

window._grumesManager_grumeSearchWidth = function(line) {
  renderGrumeLauncherResults(line);
}

window._grumesManager_grumeSearchInput = function(line) {
  renderGrumeLauncherResults(line);
}

window._grumesManager_stopGrumeCamScan = function() {
  if (camScanState.raf) { cancelAnimationFrame(camScanState.raf); camScanState.raf = null; }
  if (camScanState.stream) {
    camScanState.stream.getTracks().forEach(function(t) { t.stop(); });
    camScanState.stream = null;
  }
  camScanState.line = null;
}

window._grumesManager_saisieGrumeRef = function(line) {
  var input = document.getElementById('grumeScanInput' + line);
  var ref = input ? input.value : '';
  if (launchGrumeByRef(line, ref)) stopGrumeCamScan();
}

window._grumesManager_scanQrLoop = function(line, video, status) {
  var repeater = function() {
    if (!video || video.readyState < 2 || !camScanState.raf || camScanState.line !== line) return;
    try {
      var w = video.videoWidth, h = video.videoHeight;
      if (w > 0 && h > 0 && video.getContext) {
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, w, h);
        var imageData = ctx.getImageData(0, 0, w, h);
        var code = window.jsQR && jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
        if (code && code.data && code.data !== camScanState.lastPayload) {
          camScanState.lastPayload = code.data;
          if (status) status.innerHTML = '<span style="font-size:11px;">QR détecté : <b>' + escapeHtml(code.data.slice(0, 40)) + '</b>…</span>';
          var parsed = parseQrPayload(code.data);
          var ok = launchGrumeByRef(line, parsed.ref || code.data);
          if (ok) { stopGrumeCamScan(); return; }
        }
      }
    } catch (e) {}
    camScanState.raf = requestAnimationFrame(repeater);
  };
  camScanState.raf = requestAnimationFrame(repeater);
}

window._grumesManager_launchGrumeByRef = function(line, ref) {
  var code = String(ref || '').trim();
  if (!code) { showToast('Saisissez ou scannez une réf grume', 'warning'); return false; }
  var up = code.toUpperCase();
  var g = rawMaterials.find(function(x) { return x.scanCode === up || (x.code && x.code.toUpperCase() === up); });
  if (!g) {
    showToast('Aucune grume ' + code + ' — vérifiez la réf (voir onglet MP)', 'error');
    return false;
  }
  if (g.statut !== 'EN_STOCK') {
    showToast('Grume ' + g.code + ' déjà ' + (g.statut || 'engagée'), 'error');
    return false;
  }
  var o = getLineOrder(line);
  if (!o) { showToast('Aucun OF en cours pour la ligne ' + line, 'warning'); return false; }
  var ofWmin = parseFloat(o.logWidthMin) || 0;
  var ofWmax = parseFloat(o.logWidthMax) || parseFloat(o.logWidth) || 0;
  var gw = grumeWidthMm(g);
  if (ofWmax && gw > ofWmax) {
    showToast('Grume trop large : ' + gw + 'mm > Ø max OF ' + ofWmax + 'mm', 'error');
    return false;
  }
  if (ofWmin && gw < ofWmin) {
    showToast('Grume trop étroite : ' + gw + 'mm < Ø min motif ' + ofWmin + 'mm', 'error');
    return false;
  }
  stopGrumeCamScan();
  var modal = document.getElementById('confirmModal');
  document.getElementById('modalIcon').innerHTML = MI('play_circle', 'mi-lg mi-green');
  document.getElementById('modalTitle').textContent = 'Lancer cette grume ?';
  var ofLabel = o.orderNum || '—';
  var ofDetail = o.reference ? ' · ' + escapeHtml(o.reference) : '';
  document.getElementById('modalMessage').innerHTML = '<div style="text-align:left;font-size:12.5px;line-height:1.8;">' +
    '<b>' + escapeHtml(g.code) + '</b> — ' + escapeHtml(g.essence || '—') + '<br>' +
    'Ø ' + (g.diametre || '—') + ' cm · ' + gw + ' mm sciés · L=' + (g.longueur || '—') + ' m<br>' +
    'Ligne <b>' + line + '</b> · OF <b>' + escapeHtml(ofLabel) + '</b>' + ofDetail +
    '<div style="margin-top:6px;font-size:11px;color:var(--text-muted);">La longueur de la grume (' + (g.longueur || '—') + ' m) déterminera la longueur des pièces sciées. La grume passera en cours de sciage (EN_COURSE).</div></div>';
  var okBtn = document.getElementById('modalOkBtn');
  var cancelBtn = document.getElementById('modalCancelBtn');
  okBtn.textContent = 'Lancer';
  okBtn.classList.remove('btn-danger');
  okBtn.classList.add('btn-primary');
  cancelBtn.textContent = 'Annuler';
  pendingConfirmCallback = function() {
    launchGrume(line, g.id);
    var input = document.getElementById('grumeScanInput' + line);
    if (input) input.value = '';
    var msg = document.getElementById('grumeScanMsg' + line);
    if (msg) msg.innerHTML = '<span style="color:var(--green,#10b981);font-size:11px;">' + MI('check_circle','mi-sm mi-green') + ' ' + escapeHtml(g.code) + ' lanc\u00e9e sur la ligne ' + line + ' \u2192 sciage en cours</span>';
  };
  modal.classList.add('open');
  return false;
}

window._grumesManager_ensureGrumeScanCodes = function() {
  if (typeof rawMaterials === 'undefined') return false;
  var changed = false;
  rawMaterials.forEach(function(g) {
    if (!g.scanCode) {
      var code = genGrumeScanCode();
      for (var tries = 0; tries < 20 && grumeScanCodeTaken(code); tries++) code = genGrumeScanCode();
      g.scanCode = code;
      changed = true;
    }
  });
  if (changed) {
    try { saveToStorage('charben_raw', rawMaterials); } catch (e) {}
    try { fsSave('raw', rawMaterials); } catch (e) {}
  }
  return changed;
}

window._grumesManager_renderGrumeLauncherResults = function(line) {
  var panel = document.getElementById('grumeResults' + line);
  if (!panel) return;
  var o = getLineOrder(line);
  var ofWmin = o ? (parseFloat(o.logWidthMin) || 0) : 0;
  var ofWmax = o ? (parseFloat(o.logWidthMax) || parseFloat(o.logWidth) || ofWmin) : 0;
  var ofW = ofWmax;
  var q = ((document.getElementById('grumeSearchText' + line) || {}).value || '').trim();
  var wf = ((document.getElementById('grumeSearchWidth' + line) || {}).value || '').trim();
  var avail = rawMaterials.filter(function(g) {
    if (g.statut !== 'EN_STOCK') return false;
    if (q.length === 1) {
      if (g.code.charAt(0).toUpperCase() !== q.toUpperCase()) return false;
    } else if (q.length > 1) {
      if (g.code.toUpperCase().indexOf(q.toUpperCase()) === -1) return false;
    }
    if (wf) {
      var gw = grumeWidthMm(g);
      if ((gw + 'mm') !== wf) return false;
    }
    return true;
  });
  avail.sort(function(a, b) {
    var gwA = grumeWidthMm(a), gwB = grumeWidthMm(b);
    var okA = (ofWmin && gwA < ofWmin) ? 1 : (ofWmax && gwA > ofWmax) ? 2 : 0;
    var okB = (ofWmin && gwB < ofWmin) ? 1 : (ofWmax && gwB > ofWmax) ? 2 : 0;
    if (okA !== okB) return okA - okB;
    var da = Math.abs(gwA - (ofWmin + ofWmax) / 2), db = Math.abs(gwB - (ofWmin + ofWmax) / 2);
    if (da === db) return (a.code < b.code ? -1 : 1);
    return da - db;
  });
  var sel = launcherSel[line];
  var html = '<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">' + avail.length + ' grume(s) trouv\u00e9e(s)' + (q || wf ? ' — filtre actif' : '') + '</div>';
  if (!avail.length) {
    html += '<div style="padding:12px;text-align:center;font-size:12px;color:var(--text-muted);border:1px dashed var(--border-color);border-radius:8px;">Aucune grume ne correspond \u00e0 la recherche</div>';
  }
  avail.forEach(function(g) {
    var gw = grumeWidthMm(g);
    var inRange = (!ofWmin || gw >= ofWmin) && (!ofWmax || gw <= ofWmax);
    var isSel = sel === g.id;
    var rangeLabel = ofWmin && ofWmax && ofWmin !== ofWmax ? ofWmin + '–' + ofWmax : (ofWmax || ofWmin || '—');
    /* Classe C1/C2/C3 (cutting-engine) — visible à l'opérateur dès la sélection. */
    var clsBadge = '';
    if (typeof cuttingEngine !== 'undefined' && cuttingEngine && typeof cuttingEngine.classerGrume === 'function') {
      var cls = cuttingEngine.classerGrume(gw);
      if (cls && cls.ok) clsBadge = '<span class="badge badge-stock" title="' + escapeHtml(cls.label) + '">' + cls.classe + '</span>';
      else clsBadge = '<span class="badge badge-maintenance" title="Hors 250–560 mm">!</span>';
    }
    var planHtml = '';
    if (isSel && o && typeof cuttingEngine !== 'undefined' && cuttingEngine && typeof cuttingEngine.largeursPlan === 'function') {
      var Lp = cuttingEngine.largeursPlan(gw, o);
      var bits = [];
      (Lp.cc || []).forEach(function(c) { bits.push('CC ' + c.ep + '→' + c.max + 'mm'); });
      (Lp.sb || []).forEach(function(s) { bits.push('SB ' + s.ep + '→' + s.max + 'mm'); });
      if (bits.length) planHtml = '<div style="flex-basis:100%;font-size:10.5px;color:var(--text-muted);">Capacité Ø' + gw + 'mm : ' + bits.join(' · ') + '</div>';
    }
    html += '<div class="grume-result' + (isSel ? ' selected' : '') + '" onclick="selectGrumeForLine(\'' + line + '\',\'' + g.id + '\')">' +
      '<span class="grume-radio">' + (isSel ? '\u2713' : '') + '</span>' +
      '<span style="min-width:70px;"><b>' + escapeHtml(g.code) + '</b></span>' +
      '<span style="flex:1;font-size:11px;">' + escapeHtml(g.essence) + ' · Ø' + g.diametre + 'cm → <b>' + gw + 'mm</b></span>' +
      clsBadge +
      (inRange ? '<span class="badge badge-stock">\u2705 dans ' + rangeLabel + 'mm</span>' : '<span class="badge badge-maintenance">\u26a0\ufe0f hors ' + rangeLabel + 'mm</span>') +
      planHtml +
      '</div>';
  });
  panel.innerHTML = html;
  var btn = document.getElementById('grumeConfirmBtn' + line);
  if (btn) btn.disabled = !sel;
}

/* --- EXPORT GLOBAL --- */

window.grumesManager = {
  grumeDaysAge: window._grumesManager_grumeDaysAge,
  genGrumeScanCode: window._grumesManager_genGrumeScanCode,
  grumeScanCodeTaken: window._grumesManager_grumeScanCodeTaken,
  grumeQrPayload: window._grumesManager_grumeQrPayload,
  parseQrPayload: window._grumesManager_parseQrPayload,
  drawGrumeQr: window._grumesManager_drawGrumeQr,
  grumeFmtDate: window._grumesManager_grumeFmtDate,
  lineLaunchState: window._grumesManager_lineLaunchState,
  saveLineLaunch: window._grumesManager_saveLineLaunch,
  lineLaunchedForOf: window._grumesManager_lineLaunchedForOf,
  launchGrume: window._grumesManager_launchGrume,
  confirmGrumeSelection: window._grumesManager_confirmGrumeSelection,
  selectGrumeForLine: window._grumesManager_selectGrumeForLine,
  grumeSearchWidth: window._grumesManager_grumeSearchWidth,
  grumeSearchInput: window._grumesManager_grumeSearchInput,
  stopGrumeCamScan: window._grumesManager_stopGrumeCamScan,
  saisieGrumeRef: window._grumesManager_saisieGrumeRef,
  scanQrLoop: window._grumesManager_scanQrLoop,
  launchGrumeByRef: window._grumesManager_launchGrumeByRef,
  ensureGrumeScanCodes: window._grumesManager_ensureGrumeScanCodes,
  renderGrumeLauncherResults: window._grumesManager_renderGrumeLauncherResults
};
