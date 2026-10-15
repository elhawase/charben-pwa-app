/* ============================================================
   MODULE F: FARDEAUX (bundles) — stock prêt commercialisation
   Extrait de app.js — Phase 2A découpage
   Charge APRÈS app.js (utilise fardeaux, wipProducts…)
   ============================================================ */

async function loadFardeauxFromFirestore() {
  if (typeof fardeaux === 'undefined') return;
  if (typeof FS_COLLECTIONS !== 'undefined' && !FS_COLLECTIONS.fardeaux) FS_COLLECTIONS.fardeaux = 'fardeaux';
  try {
    var shared = await fsLoadRaw('fardeaux');
    var sharedItems = (shared && Array.isArray(shared.items)) ? shared.items : null;
    var sharedUpd = (shared && shared.updatedAt) ? shared.updatedAt : '';
    var legacy = await fsLoadLegacy('fardeaux');
    if (legacy && Array.isArray(legacy.items) && legacy.items.length > 0) {
      var legacyUpd = legacy.updatedAt || '';
      if (!sharedUpd || legacyUpd > sharedUpd) {
        await fsSave('fardeaux', legacy.items);
        fardeaux.length = 0;
        legacy.items.forEach(function(item) { fardeaux.push(item); });
        try { localStorage.setItem('charben_fardeaux', JSON.stringify(fardeaux)); } catch (e) {}
        if (typeof renderFardeauxList === 'function') renderFardeauxList();
        return;
      }
    }
    if (sharedItems && sharedItems.length > 0) {
      if (fardeaux.length === 0) {
        fardeaux.length = 0;
        sharedItems.forEach(function(item) { fardeaux.push(item); });
        try { localStorage.setItem('charben_fardeaux', JSON.stringify(fardeaux)); } catch (e) {}
        if (typeof renderFardeauxList === 'function') renderFardeauxList();
      }
    } else {
      await fsSave('fardeaux', fardeaux);
    }
  } catch (e) {
    errLog('fardeaux-manager', 'firestore load', e.message, 'warn');
  }
}

/* --- QR fardeau --- */

function fardeauQrDataUrl(id) {
  if (!window.qrcode) return '';
  var f = (typeof fardeaux !== 'undefined' ? fardeaux : []).find(function(x) { return x.id === id; });
  if (!f) return '';
  var payload = fardeauQrPayload(f);
  var qr = qrcode(0, 'M');
  qr.addData(payload);
  qr.make();
  var size = qr.getModuleCount();
  var cs = Math.max(4, Math.round(200 / size));
  var cv = document.createElement('canvas');
  cv.width = size * cs; cv.height = size * cs;
  var ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#000000';
  for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) if (qr.isDark(r, c)) ctx.fillRect(c * cs, r * cs, cs, cs);
  return cv.toDataURL('image/png');
}

function openFardeauQrModal(id) {
  ensureFardeauxScanCodes();
  var f = (typeof fardeaux !== 'undefined' ? fardeaux : []).find(function(x) { return x.id === id; });
  if (!f) return;
  var modal = document.getElementById('qrModal');
  if (!modal) return;
  document.getElementById('qrModalTitle').textContent = 'QR · ' + f.code;
  document.getElementById('qrModalRef').textContent = f.code;
  var nbPieces = (f.items || []).reduce(function(a, it) { return a + (it.qty || 0); }, 0);
  var vol = (f.volumeTotal != null) ? f.volumeTotal : 0;
  var info = document.getElementById('qrModalInfo');
  info.innerHTML = '<b>' + escapeHtml(f.essence || '') + '</b> · ' + nbPieces + ' pièces · ' + vol.toFixed(3) + ' m³ · '
    + (f.statut === 'VENDU' ? '<span class="badge badge-consumed">Vendu</span>' : '<span class="badge badge-stock">En stock</span>');
  var sub = document.getElementById('qrModalRef').nextElementSibling;
  if (sub) sub.textContent = 'Scanner ce QR (écran Produits Finis) pour ouvrir la fiche du fardeau';
  var canvas = document.getElementById('qrModalCanvas');
  drawGrumeQr(canvas, fardeauQrPayload(f));
  document.getElementById('qrModalPrint').onclick = function() { printFardeauLabel(id); };
  modal.classList.add('open');
  renderLucide();
}

function printFardeauLabel(id) {
  var f = (typeof fardeaux !== 'undefined' ? fardeaux : []).find(function(x) { return x.id === id; });
  if (!f) return;
  var dataUrl = fardeauQrDataUrl(id);
  var win = window.open('', '_blank', 'width=400,height=300');
  if (!win) { showToast('Autorisez les popups pour imprimer', 'warning'); return; }
  var nbPieces = (f.items || []).reduce(function(a, it) { return a + (it.qty || 0); }, 0);
  var vol = (f.volumeTotal != null) ? f.volumeTotal : 0;
  var contenu = (f.items || []).map(function(it) { return escapeHtml(it.item || '—') + ' ×' + (it.qty || 0); }).join(' · ');
  win.document.write('<html><head><title>Label ' + escapeHtml(f.code) + '</title>');
  win.document.write('<style>body{font-family:Arial,sans-serif;text-align:center;padding:16px;}.sarl{font-size:11px;color:#666;letter-spacing:1px;}.ref{font-size:26px;font-weight:800;margin:6px 0;}.info{font-size:13px;color:#333;margin:4px 0;}.ess{font-size:12px;color:#444;}@media print{ .noprint{display:none;} }</style></head><body>');
  win.document.write('<div class="sarl">SARL CHARBEN INDUSTRIE — PRODUITS FINIS</div>');
  win.document.write('<div class="ref">' + escapeHtml(f.code) + '</div>');
  win.document.write('<div class="info">' + escapeHtml(f.essence || '') + ' · ' + nbPieces + ' pièces · ' + vol.toFixed(3) + ' m³</div>');
  if (contenu) win.document.write('<div class="ess" style="font-size:11px;">' + contenu + '</div>');
  if (f.batchNum) win.document.write('<div class="ess">Lot séchage : ' + escapeHtml(f.batchNum) + '</div>');
  win.document.write('<img src="' + dataUrl + '" style="width:180px;height:180px;margin-top:8px;">');
  win.document.write('<div class="ess">Scanner ce QR pour ouvrir la fiche fardeau</div>');
  win.document.write('<div class="noprint" style="margin-top:14px;"><button onclick="window.print()" style="padding:8px 22px;font-size:14px;">Imprimer</button></div>');
  win.document.write('</body></html>');
  win.document.close();
}

/* --- Formulaire création fardeau --- */

function fardeauFormAddLine() {
  var cont = document.getElementById('fardeauLines');
  if (!cont) return;
  fardeauFormState.linesFx++;
  var row = document.createElement('div');
  row.className = 'fardeau-line';
  row.style.cssText = 'display:grid;grid-template-columns:1fr 80px 42px;gap:6px;margin-bottom:6px;align-items:center;';
  row.innerHTML = '<select class="form-input" style="font-size:12px;padding:7px;"><option value="">— Choisir une réf SF —</option></select>'
    + '<input type="number" class="form-input" style="font-size:12px;padding:7px;text-align:center;" placeholder="Qté" min="1" value="1" oninput="fardeauFormLiveTotals()">'
    + '<button type="button" class="btn btn-sm btn-danger" style="padding:4px;font-size:12px;" onclick="fardeauFormDelLine(this)">' + MI('close','mi-sm') + '</button>';
  cont.appendChild(row);
  fardeauFormRefillSelects(row.querySelector('select'));
}

function fardeauFormDelLine(btn) {
  var cont = document.getElementById('fardeauLines');
  if (cont && cont.children.length > 1) {
    var row = btn.closest('.fardeau-line');
    if (row) row.remove();
  }
}

function fardeauFormRefillSelects(sel) {
  if (!sel) {
    var cont = document.getElementById('fardeauLines');
    if (!cont) return;
    var sels = cont.querySelectorAll('select');
    sels.forEach(function(s) { if (s.options.length <= 1) fardeauFormRefillSelects(s); });
    return;
  }
  var current = sel.value;
  var unique = {};
  var src = (typeof wipProducts !== 'undefined' ? wipProducts : []).slice();
  var selectedBatch = (typeof fardeauFormState !== 'undefined' && fardeauFormState.batchId)
    ? src.find(function(b) { return b.id === fardeauFormState.batchId; }) : null;
  var pool = selectedBatch && selectedBatch.sfItems ? selectedBatch.sfItems : [];
  if (pool && pool.length) {
    pool.forEach(function(it) { if (it && it.item) unique[it.item] = (unique[it.item] || 0) + (it.qty || 0); });
  }
  if (!Object.keys(unique).length) {
    (typeof finishedGoods !== 'undefined' ? finishedGoods : []).slice().sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); }).forEach(function(f) {
      if (f.sfRef && !unique[f.sfRef]) unique[f.sfRef] = 1;
    });
  }
  var html = '<option value="">— Choisir une réf SF —</option>';
  Object.keys(unique).forEach(function(r) { html += '<option value="' + escapeHtml(r) + '">' + escapeHtml(r) + '</option>'; });
  sel.innerHTML = html;
  if (current) sel.value = current;
}

function showFardeauForm(batchId) {
  if (typeof FS_COLLECTIONS !== 'undefined' && !FS_COLLECTIONS.fardeaux) FS_COLLECTIONS.fardeaux = 'fardeaux';
  fardeauFormState.batchId = batchId || null;
  fardeauFormState.linesFx = 0;
  var modal = document.getElementById('fardeauModal');
  if (!modal) return;
  document.getElementById('fardeauModalTitle').textContent = batchId ? 'Fardeau — sortie de séchage' : 'Nouveau fardeau';
  var batch = null;
  if (batchId && typeof wipProducts !== 'undefined') {
    batch = wipProducts.find(function(b) { return b.id === batchId; });
  }
  if (batch && !(batch.sfItems && batch.sfItems.length)) {
    showToast('Ce lot n\'a pas d\'articles semi-finis à fardeler', 'warning');
    return;
  }
  var body = document.getElementById('fardeauModalBody');
  var essenceOpts = batch
    ? '<option value="' + escapeHtml(batch.species || batch.essence || '') + '">' + escapeHtml(batch.species || batch.essence || '') + '</option>'
    : '<option value="">—</option>' + ['Pin', 'Épicéa'].map(function(e) { return '<option>' + e + '</option>'; }).join('');
  body.innerHTML =
    '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">'
    + (batch
      ? 'Création d\'un fardeau à partir du lot de séchage <b>' + escapeHtml(batch.batchNum || '') + '</b> (OF ' + escapeHtml(batch.ofNum || (batch.notes || '—')) + ').'
      : 'Groupe manuel de pièces : un fardeau regroupe les quantités choisies pour chacune des références ci-dessous.')
    + '</div>'
    + (batch
      ? '<div class="form-group"><label class="form-label">Lot source</label><input type="text" class="form-input" value="' + escapeHtml(batch.batchNum || '') + '" disabled></div>'
      : '<div class="form-group"><label class="form-label">Lot source (optionnel)</label><select class="form-input" id="fardeauBatchSel" onchange="fardeauFormChangeBatch()"><option value="">Sans lot — pièces libres</option>'
        + (typeof wipProducts !== 'undefined' ? wipProducts.filter(function(b) { return b.statut === 'EN_WIP'; }).map(function(b) { return '<option value="' + b.id + '">' + escapeHtml(b.ref || b.id) + (b.qte ? ' (' + b.qte + ' pcs)' : '') + '</option>'; }).join('') : '')
        + '</select></div>')
    + '<div class="form-group"><label class="form-label">Essence</label><select class="form-input" id="fardeauEssence">' + essenceOpts + '</select></div>'
    + '<div class="form-group"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
    + '<label class="form-label" style="margin:0;">Pièces du fardeau (réf SF + quantité)</label>'
    + '<button class="btn btn-sm btn-secondary" onclick="fardeauFormAddLine()" style="padding:4px 8px;font-size:11px;">＋ Ajouter</button>'
    + '</div><div id="fardeauLines"></div></div>'
    + '<div style="padding:10px;background:var(--glass-bg);backdrop-filter:blur(4px);border-radius:var(--radius-sm);font-size:13px;text-align:center;margin-bottom:10px;border:1px solid var(--glass-border);">'
    + 'Total : <strong id="fardeauTotalPieces">0</strong> pièces · <strong id="fardeauTotalVol">0.0000</strong> m³</div>';
  var actions = document.getElementById('fardeauModalActions');
  actions.style.display = 'flex';
  actions.innerHTML = '<button class="btn btn-secondary" onclick="closeFardeauModal()">Annuler</button>'
    + '<button class="btn btn-primary" onclick="saveFardeauFromForm()">Créer le fardeau</button>';
  modal.classList.add('open');
  if (batch) {
    batch.sfItems.forEach(function(it) {
      if (!it || !it.item) return;
      fardeauFormState.linesFx++;
      var cont = document.getElementById('fardeauLines');
      if (!cont) return;
      var row = document.createElement('div');
      row.className = 'fardeau-line';
      row.style.cssText = 'display:grid;grid-template-columns:1fr 80px 42px;gap:6px;margin-bottom:6px;align-items:center;';
      row.innerHTML = '<select class="form-input" style="font-size:12px;padding:7px;"><option>' + escapeHtml(it.item) + '</option></select>'
        + '<input type="number" class="form-input" style="font-size:12px;padding:7px;text-align:center;" min="0" value="' + Math.max(0, it.qty || 0) + '" oninput="fardeauFormLiveTotals()">'
        + '<button type="button" class="btn btn-sm btn-danger" style="padding:4px;font-size:12px;" onclick="fardeauFormDelLine(this)">' + MI('close','mi-sm') + '</button>';
      cont.appendChild(row);
    });
    if (document.getElementById('fardeauEssence')) {
      document.getElementById('fardeauEssence').value = batch.species || batch.essence || '';
    }
  }
  fardeauFormLiveTotals();
  if (typeof renderLucide === 'function') renderLucide();
}

function closeFardeauModal() {
  var modal = document.getElementById('fardeauModal');
  if (modal) modal.classList.remove('open');
}

function fardeauFormChangeBatch() {
  var sel = document.getElementById('fardeauBatchSel');
  if (!sel) return;
  showFardeauForm(sel.value);
}

function fardeauFormCollect() {
  var lines = document.querySelectorAll('#fardeauLines .fardeau-line');
  var items = [];
  var nbTot = 0, volTot = 0;
  lines.forEach(function(row) {
    var sel = row.querySelector('select');
    var qtyInput = row.querySelector('input[type="number"]');
    var r = sel ? (sel.value || '').trim() : '';
    var qty = qtyInput ? (parseInt(qtyInput.value, 10) || 0) : 0;
    if (!r || qty <= 0) return;
    var ep = 0, larg = 0, long = 0;
    var src = (typeof wipProducts !== 'undefined' ? wipProducts : []).slice();
    var batch = fardeauFormState.batchId ? src.find(function(b) { return b.id === fardeauFormState.batchId; }) : null;
    var it = batch && batch.sfItems ? batch.sfItems.find(function(x) { return x.item === r; }) : null;
    if (it) {
      ep = it.ep || 0; larg = it.larg || 0;
      var ofNum = batch.ofNum || (batch.notes || '');
      var of = (typeof orders !== 'undefined' ? orders : []).find(function(x) { return x.orderNum === ofNum; });
      long = (of && parseFloat(of.pieceLength)) || 0;
      if (!(long > 0)) {
        var pfL = (typeof finishedGoods !== 'undefined' ? finishedGoods : []).find(function(x) { return x.sfRef === r; });
        if (pfL) long = parseFloat(pfL.longueur) || 0;
      }
    } else {
      var pf = (typeof finishedGoods !== 'undefined' ? finishedGoods : []).find(function(x) { return x.sfRef === r || x.code === r; });
      if (pf) { ep = pf.epaisseur || 0; larg = pf.largeur || 0; long = pf.longueur || 0; }
    }
    var unitVol = (ep > 0 && larg > 0 && long > 0) ? +((ep / 1000) * (larg / 1000) * (long / 1000)).toFixed(6) : 0;
    items.push({ item: r, qty: qty, ep: ep, larg: larg, longueur: long, volume: unitVol });
    nbTot += qty;
    volTot += +(unitVol * qty).toFixed(6);
  });
  return { items: items, nbPieces: nbTot, volumeTotal: +volTot.toFixed(4) };
}

function saveFardeauFromForm() {
  if (typeof fardeaux === 'undefined' || typeof fardeauxSave !== 'function') return;
  var essence = document.getElementById('fardeauEssence');
  if (!essence) return;
  var data = fardeauFormCollect();
  if (!data.items.length) { showToast('Ajoutez au moins une pièce au fardeau', 'warning'); return; }
  var batch = null;
  if (fardeauFormState.batchId && typeof wipProducts !== 'undefined') {
    batch = wipProducts.find(function(b) { return b.id === fardeauFormState.batchId; });
  }
  var f = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    code: genFardeauCode(), scanCode: null,
    essence: essence.value || (batch && (batch.species || batch.essence)) || '',
    batchId: batch ? batch.id : null, batchNum: batch ? batch.batchNum : null,
    ofNum: batch ? (batch.ofNum || (batch.notes || '')) : null,
    items: data.items, nbPieces: data.nbPieces, volumeTotal: data.volumeTotal,
    statut: 'EN_STOCK',
    sortieSechageAt: batch && batch.exitDate ? new Date(batch.exitDate + 'T12:00:00').toISOString() : new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  var code = genFardeauScanCode();
  for (var tries = 0; tries < 20 && fardeauScanCodeTaken(code); tries++) code = genFardeauScanCode();
  f.scanCode = code;
  fardeaux.unshift(f);
  fardeauxSave();
  addAuditLog('Fardeau créé: ' + f.code + ' (' + data.nbPieces + ' pièces, ' + data.volumeTotal.toFixed(3) + ' m³)' + (batch ? ' — lot ' + batch.batchNum : ''));
  if (batch && batch.sfItems) {
    var totalRefs = 0, coveredRefs = 0;
    batch.sfItems.forEach(function(it) {
      if (!it || !it.item) return; totalRefs++;
      var taken = (typeof fardeaux !== 'undefined' ? fardeaux : []).filter(function(fr) { return fr.batchId === batch.id && fr.statut !== 'SUPPRIME'; })
        .reduce(function(a, fr) { var li = (fr.items || []).find(function(x) { return x.item === it.item; }); return a + (li ? (li.qty || 0) : 0); }, 0);
      if (taken >= (it.qty || 0)) coveredRefs++;
    });
    if (totalRefs && totalRefs === coveredRefs) {
      batch.transferred = true;
      saveToStorage('charben_wip', wipProducts);
      if (typeof fsSave === 'function') { try { fsSave('wip', wipProducts); } catch (e) {} }
      if (typeof renderWipList === 'function') renderWipList();
    }
  }
  closeFardeauModal();
  if (typeof renderFardeauxList === 'function') renderFardeauxList();
  showToast('Fardeau ' + f.code + ' créé (' + data.nbPieces + ' pièces)', 'success');
}

/* --- Vente --- */

function vendreFardeau(id) {
  var f = (typeof fardeaux !== 'undefined' ? fardeaux : []).find(function(x) { return x.id === id; });
  if (!f) return;
  if (f.statut === 'VENDU') { showToast('Ce fardeau est déjà vendu', 'warning'); return; }
  var nbPieces = f.nbPieces != null ? f.nbPieces : ((f.items || []).reduce(function(a, it) { return a + (it.qty || 0); }, 0));
  var vol = (f.volumeTotal != null) ? f.volumeTotal : 0;
  openFormModal('Vendre le fardeau ' + f.code + ' ?', '🚚',
    '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">'
    + f.code + ' — ' + escapeHtml(f.essence || '') + ' · ' + nbPieces + ' pièces · ' + vol.toFixed(3) + ' m³.</div>'
    + '<div class="form-group"><label>Client</label><input id="formClient" type="text" class="form-control" placeholder="Nom du client"></div>'
    + '<div class="form-group"><label>N° Bon de Livraison</label><input id="formBl" type="text" class="form-control" placeholder="BL-…"></div>',
    function() {
      var client = (document.getElementById('formClient').value || '').trim();
      if (!client) { showToast('Saisissez le nom du client', 'warning'); return; }
      f.statut = 'VENDU'; f.client = client;
      f.bl = (document.getElementById('formBl').value || '').trim();
      f.venduAt = new Date().toISOString();
      fardeauxSave();
      addAuditLog('Vente fardeau: ' + f.code + ' → ' + client + (f.bl ? ' (BL ' + f.bl + ')' : ''));
      renderFardeauxList();
      showToast('Fardeau ' + f.code + ' vendu', 'success');
    }, false);
}

function deleteFardeau(id) {
  var f = (typeof fardeaux !== 'undefined' ? fardeaux : []).find(function(x) { return x.id === id; });
  if (!f) return;
  if (f.statut === 'VENDU') { showToast('Un fardeau vendu ne peut pas être supprimé', 'warning'); return; }
  showModal('Supprimer le fardeau ' + (f ? f.code : '') + ' ?', 'Cette action est irréversible.', '🗑️', function() {
    fardeaux = (typeof fardeaux !== 'undefined' ? fardeaux : []).filter(function(x) { return x.id !== id; });
    fardeauxSave(); addAuditLog('Fardeau supprimé');
    renderFardeauxList(); showToast('Fardeau supprimé', 'info');
  });
}

/* --- Listes --- */

function renderFrdRecap() {
  var el = document.getElementById('frdRecap');
  if (!el || typeof fardeaux === 'undefined') return;
  var enStock = fardeaux.filter(function(f) { return f.statut !== 'VENDU'; });
  var vendus = fardeaux.filter(function(f) { return f.statut === 'VENDU'; });
  var nbStock = enStock.reduce(function(a, f) { return a + (f.nbPieces != null ? f.nbPieces : ((f.items || []).reduce(function(b, it) { return b + (it.qty || 0); }, 0))); }, 0);
  var volStock = enStock.reduce(function(a, f) { return a + (f.volumeTotal || 0); }, 0);
  el.innerHTML = '<div class="kpi-grid-v2" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:10px;">'
    + '<div class="kpi-card-v2"><div class="kpi-value">' + enStock.length + '</div><div class="kpi-label">Fardeaux en stock</div></div>'
    + '<div class="kpi-card-v2"><div class="kpi-value">' + vendus.length + '</div><div class="kpi-label">Vendus</div></div>'
    + '<div class="kpi-card-v2"><div class="kpi-value">' + nbStock + '</div><div class="kpi-label">Pièces</div></div>'
    + '<div class="kpi-card-v2"><div class="kpi-value">' + volStock.toFixed(2) + '</div><div class="kpi-label">m³ en stock</div></div></div>';
}

function renderFardeauxList() {
  ensureFardeauxScanCodes();
  var el = document.getElementById('frdList');
  if (!el || typeof fardeaux === 'undefined') return;
  var filter = (document.getElementById('frdFilter').value || '').toLowerCase();
  var stEl = document.getElementById('frdFilterStatut');
  var stFilter = stEl ? stEl.value : 'all';
  var items = fardeaux;
  if (stFilter !== 'all') items = items.filter(function(f) { return f.statut === stFilter; });
  if (filter) items = items.filter(function(f) {
    var nbPieces = f.nbPieces != null ? f.nbPieces : ((f.items || []).reduce(function(a, it) { return a + (it.qty || 0); }, 0));
    return String(f.code || '').toLowerCase().indexOf(filter) >= 0
      || String(f.essence || '').toLowerCase().indexOf(filter) >= 0
      || String(f.batchNum || '').toLowerCase().indexOf(filter) >= 0
      || String(f.client || '').toLowerCase().indexOf(filter) >= 0
      || String(nbPieces).indexOf(filter) >= 0;
  });
  renderFrdRecap();
  if (items.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">' + MI('inventory_2','mi-xl mi-muted') + '</div><div class="empty-state-text">Aucun fardeau.</div></div>';
    return;
  }
  items = items.slice().sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
  var html = '<div class="dt-table dt-table-full"><div class="dt-head dt-head-full">'
    + '<span>Code</span><span>Essence</span><span>Contenu</span><span>Volume</span><span>Statut</span><span style="text-align:right;">⋮</span></div>';
  items.forEach(function(f) {
    var nbPieces = f.nbPieces != null ? f.nbPieces : ((f.items || []).reduce(function(a, it) { return a + (it.qty || 0); }, 0));
    var vol = f.volumeTotal || 0;
    var statutClass = f.statut === 'VENDU' ? 'badge-consumed' : 'badge-stock';
    var statutLabel = f.statut === 'VENDU' ? 'Vendu' : 'En stock';
    var contenu = (f.items || []).map(function(it) { return escapeHtml(it.item || '—') + ' ×' + (it.qty || 0); }).join('<br>');
    html += '<div class="dt-row">';
    html += '<span class="mp-dt-ref"><b>' + escapeHtml(f.code) + '</b>' + (f.batchNum ? '<div style="font-size:10px;color:var(--text-muted);">lot ' + escapeHtml(f.batchNum) + '</div>' : '') + '</span>';
    html += '<span class="mp-dt-type">' + escapeHtml(f.essence || '—') + '</span>';
    html += '<span class="mp-dt-autres" style="font-size:11px;">' + contenu + '<div style="color:var(--text-muted);">' + nbPieces + ' pièces</div></span>';
    html += '<span class="mp-dt-vol"><b>' + vol.toFixed(3) + '</b> m³</span>';
    html += '<span class="mp-dt-stat"><span class="' + statutClass + '">' + statutLabel + '</span></span>';
    html += '<span class="mp-dt-actions" style="text-align:right;white-space:nowrap;">';
    html += '<button class="btn btn-sm btn-ghost" onclick="openFardeauDetail(\'' + f.id + '\')" title="Fiche">📋</button> ';
    html += '<button class="btn btn-sm btn-secondary" onclick="openFardeauQrModal(\'' + f.id + '\')" title="QR">▦</button> ';
    if (f.statut !== 'VENDU') html += '<button class="btn btn-sm btn-success" onclick="vendreFardeau(\'' + f.id + '\')" title="Vendre">' + MI('point_of_sale','mi-sm') + '</button> ';
    html += '<button class="btn btn-sm btn-danger" onclick="deleteFardeau(\'' + f.id + '\')" data-perm="grumes:delete" title="Supprimer">' + MI('delete','mi-sm') + '</button>';
    html += '</span></div>';
  });
  html += '</div>';
  el.innerHTML = html;
  var totalEl = document.getElementById('frdTotalPreview');
  if (totalEl) {
    var v = items.reduce(function(a, f) { return a + (f.volumeTotal || 0); }, 0);
    var n = items.reduce(function(a, f) { return a + (f.nbPieces || 0); }, 0);
    totalEl.innerHTML = n + ' pièces · ' + v.toFixed(3) + ' m³';
  }
}

/* --- Scanner --- */

function openFardeauScanner() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    openFormModal('Scanner un fardeau', '▦',
      '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Caméra non disponible — saisissez le code.</div>'
      + '<div class="form-group"><label>Code fardeau ou QR</label><input id="fardeauCodeInput" type="text" class="form-control" placeholder="FRD-2026-001"></div>',
      function() {
        var ref = (document.getElementById('fardeauCodeInput').value || '').trim();
        if (!ref) { showToast('Saisissez un code', 'warning'); return; }
        var f = findFardeauByRef(ref);
        if (f) { closeFormModal(); openFardeauDetail(f.id); return; }
        showToast('Fardeau introuvable : ' + ref, 'error');
      }, false);
    return;
  }
  openFormModal('Scanner un fardeau', '▦',
    '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Pointez le QR du fardeau.</div>'
    + '<fieldset style="border:2px solid var(--accent, #059669);border-radius:12px;padding:8px;text-align:center;">'
    + '<legend style="font-size:11px;color:var(--text-muted);">Caméra</legend>'
    + '<video id="fardeauScanVideo" autoplay playsinline style="width:100%;border-radius:8px;background:#111;max-width:280px;display:block;margin:0 auto;"></video>'
    + '<div id="fardeauScanStatus" style="font-size:12px;margin-top:6px;color:var(--text-muted);">Initialisation…</div></fieldset>',
    function() { showToast('Scanner arrêté', 'info'); }, false);
  startFardeauCamScan();
}

function startFardeauCamScan() {
  stopFardeauCamScan();
  var video = document.getElementById('fardeauScanVideo');
  var status = document.getElementById('fardeauScanStatus');
  if (!video || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (status) status.innerHTML = '<span style="color:var(--red,#ef4444);">Caméra non disponible</span>';
    return;
  }
  frdScanState.active = true;
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(function(stream) {
      frdScanState.stream = stream; video.srcObject = stream;
      video.play().catch(function() {});
      if (status) status.innerHTML = MI('qr_code_scanner','mi-sm') + ' Pointez le QR du fardeau…';
      var loop = function() {
        if (!frdScanState.active) return;
        try {
          var w = video.videoWidth, h = video.videoHeight;
          if (w > 0 && h > 0 && video.getContext) {
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            var ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(video, 0, 0, w, h);
            var code = window.jsQR && jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
            if (code && code.data) {
              var parsed = parseQrPayload(code.data);
              var f = findFardeauByRef(parsed.ref || code.data);
              if (f) { stopFardeauCamScan(); closeFormModal(); openFardeauDetail(f.id); return; }
              var pfItem = (typeof finishedGoods !== 'undefined' ? finishedGoods : []).find(function(x) {
                var up = String(parsed.ref || code.data).toUpperCase().trim();
                return String(x.scanCode || '').toUpperCase() === up;
              });
              if (pfItem) { stopFardeauCamScan(); closeFormModal(); openPfQrModal(pfItem.id); return; }
            }
          }
        } catch (e) {}
        frdScanState.raf = requestAnimationFrame(loop);
      };
      frdScanState.raf = requestAnimationFrame(loop);
    })
    .catch(function() {
      if (status) status.innerHTML = '<span style="color:var(--red,#ef4444);">Caméra refusée</span>';
    });
}

function stopFardeauCamScan() {
  frdScanState.active = false;
  if (frdScanState.raf) { cancelAnimationFrame(frdScanState.raf); frdScanState.raf = null; }
  if (frdScanState.stream) { frdScanState.stream.getTracks().forEach(function(t) { t.stop(); }); frdScanState.stream = null; }
}
