/* ═══════════════════════════════════════════════════════════════
   MODULE 5: OUTILS & MACHINES + DISQUES DE SCIAGE
   Extrait de app.js — Phase 2A découpage
   Charge APRÈS app.js (utilise equipment, disques, saveToStorage…)
   ═══════════════════════════════════════════════════════════════ */

/* Init disques si absent */
if (!disques || !Array.isArray(disques) || disques.length === 0) {
  disques = JSON.parse(JSON.stringify(DISQUES_SEED));
  saveToStorage('charben_disques', disques);
}

/* ─── OUTILS & MACHINES ─── */

function addEquipment() {
  var name = document.getElementById('eqName').value.trim();
  var type = document.getElementById('eqType').value;
  var line = document.getElementById('eqLine').value;
  var installDate = document.getElementById('eqInstallDate').value;
  var msgEl = document.getElementById('eqMsg');
  if (!name) {
    msgEl.innerHTML = '<span style="color:var(--danger);">Saisissez un nom.</span>';
    return;
  }
  var item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    name: escapeHtml(name), type: type, line: line, installDate: installDate || '',
    status: 'actif', createdAt: new Date().toISOString()
  };
  equipment.unshift(item);
  saveToStorage('charben_equip', equipment);
  fsSave('equip', equipment);
  addAuditLog('Équipement ajouté: ' + name);
  msgEl.innerHTML = '<span style="color:var(--success);">Ajouté !</span>';
  document.getElementById('eqName').value = '';
  document.getElementById('eqInstallDate').value = '';
  renderEquipList();
  renderEquipSelect();
}

function toggleEquipStatus(id) {
  var eq = equipment.find(function(e) { return e.id === id; });
  if (!eq) return;
  var states = ['actif', 'maintenance', 'hors_service'];
  var idx = states.indexOf(eq.status);
  eq.status = states[(idx + 1) % states.length];
  saveToStorage('charben_equip', equipment);
  fsSave('equip', equipment);
  addAuditLog(eq.name + ' → ' + eq.status);
  renderEquipList();
}

function deleteEquipment(id) {
  showModal('Supprimer cet équipement ?', 'Les maintenances liées seront conservées.', '🗑️', function() {
    equipment = equipment.filter(function(e) { return e.id !== id; });
    saveToStorage('charben_equip', equipment);
    fsSave('equip', equipment);
    addAuditLog('Équipement supprimé');
    renderEquipList();
    renderEquipSelect();
    showToast('Équipement supprimé', 'info');
  });
}

function renderEquipSelect() {
  var sel = document.getElementById('maintEquip');
  if (!sel) return;
  var html = '<option value="">— Sélectionner —</option>';
  equipment.forEach(function(eq) {
    html += '<option value="' + eq.id + '">' + escapeHtml(eq.name) + '</option>';
  });
  sel.innerHTML = html;
}

function setMachineDisque(id, disqueId) {
  var m = equipment.find(function(e) { return e.id === id; });
  if (!m) return;
  m.disque = disqueId || '';
  saveToStorage('charben_equip', equipment);
  fsSave('equip', equipment);
  var d = disqueById(disqueId);
  syncDisquesFromMachines(true);
  addAuditLog('Réglage disque ' + (m.name || '') + ' → ' + (d ? d.ref : 'aucun'));
  renderEquipList();
  renderDisquesAll();
  renderEquipDisques();
}

function addMaintenance() {
  var eqId = document.getElementById('maintEquip').value;
  var type = document.getElementById('maintType').value;
  var date = document.getElementById('maintDate').value;
  var notes = document.getElementById('maintNotes').value.trim();
  var msgEl = document.getElementById('maintMsg');
  if (!eqId || !date) {
    msgEl.innerHTML = '<span style="color:var(--danger);">Sélectionnez un équipement et une date.</span>';
    return;
  }
  var eq = equipment.find(function(e) { return e.id === eqId; });
  var log = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    equipId: eqId, equipName: eq ? eq.name : '', type: type, date: date, notes: escapeHtml(notes),
    createdAt: new Date().toISOString()
  };
  maintenanceLogs.unshift(log);
  if (eq && type === 'remplacement') {
    eq.status = 'actif';
    saveToStorage('charben_equip', equipment);
    fsSave('equip', equipment);
    renderEquipList();
  }
  saveToStorage('charben_maint', maintenanceLogs);
  fsSave('maint', maintenanceLogs);
  addAuditLog('Maintenance ' + type + ': ' + (eq ? eq.name : ''));
  msgEl.innerHTML = '<span style="color:var(--success);">Enregistré !</span>';
  document.getElementById('maintNotes').value = '';
  renderMaintList();
}

function renderMaintList() {
  var el = document.getElementById('maintList');
  if (!el) return;
  if (maintenanceLogs.length === 0) {
    el.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px 0;">Aucune maintenance enregistrée.</p>';
    return;
  }
  var typeLabels = { preventive:'Préventive', corrective:'Corrective', remplacement:'Remplacement' };
  var html = '<div class="dt-table dt-table-full"><div class="dt-head dt-head-full">'
    + '<span>Date</span><span>Équipement / Opération</span>'
    + '</div>';
  maintenanceLogs.slice(0, 20).forEach(function(m) {
    html += '<div class="dt-row">';
    html += '<span class="mp-dt-date">' + m.date + '</span>';
    html += '<span class="mp-dt-autres">' + escapeHtml(m.equipName) + ' — ' + (typeLabels[m.type] || m.type);
    if (m.notes) html += ' (' + m.notes + ')';
    html += '</span></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

/* ─── DISQUES DE SCIAGE ─── */

function machineSlotLabel(l) {
  var n = MACHINE_SLOT_NAMES[l];
  return n ? l + ' · ' + n : l;
}

function saveDisques() {
  saveToStorage('charben_disques', disques);
  fsSave('disques', disques);
}

function renderDisquesStockTable(id) {
  var el = document.getElementById(id || 'disquesStockTable');
  if (!el) return;
  window.__dsRefs = disques.map(function(d) { return d.id; });
  var html = '<p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Chaque machine possède ses disques (emplacements A1–B4). Le magasin garde le stock de réapprovisionnement. Total par référence = somme des machines + magasin.</p>';
  html += '<div style="overflow-x:auto;"><table class="data-table">' +
    '<thead><tr><th>Machine</th>';
  disques.forEach(function(d) { html += '<th title="' + escapeHtml(d.ref) + '">Ø ' + (d.diametre || '—') + '</th>'; });
  html += '<th>Total</th><th>Statut</th><th>Besoin OF</th><th>Écart</th></tr></thead><tbody>';
  DISQUES_MACHINES.forEach(function(m) {
    var tot = disques.reduce(function(s, d) { return s + (((d.locations || {})[m]) || 0); }, 0);
    var nm = MACHINE_SLOT_NAMES[m] || '';
    var gap = discGapForMachine(m);
    html += '<tr data-drow="' + m + '" data-dneed="' + (gap.need || 0) + '"><td><b>' + m + '</b>' +
      (nm ? '<div style="font-size:10px;color:var(--text-muted);line-height:1.3;">' + escapeHtml(nm) + '</div>' : '') + '</td>';
    disques.forEach(function(d) {
      html += '<td><input type="number" class="ds-input" data-drow="' + m + '" data-dref="' + d.id + '" id="ds_' + m + '_' + d.id + '" value="' + (((d.locations || {})[m]) || 0) + '" min="0" style="width:46px;text-align:center;padding:2px;font-size:12px;" oninput="dsRecalc()"></td>';
    });
    html += '<td><b class="ds-row-total">' + tot + '</b></td>' +
      '<td><span class="ds-row-status badge ' + (tot > 0 ? 'badge-stock' : '') + '">' + (tot > 0 ? MI('check','mi-sm mi-green') : '—') + '</span></td>' +
      '<td><b class="ds-row-need">' + (gap.need || '—') + '</b></td>' +
      '<td><span class="ds-row-gap badge ' + (gap.gap < 0 ? 'badge-danger' : 'badge-stock') + '" style="font-size:11px;">' + (gap.need ? (gap.gap < 0 ? MI('warning','mi-sm mi-amber') + ' ' + Math.abs(gap.gap) + ' manquant' : 'OK') : '—') + '</span></td></tr>';
  });
  var magTot = disques.reduce(function(s, d) { return s + (((d.locations || {})['En Stock']) || 0); }, 0);
  html += '<tr data-drow="MAGASIN"><td><b>' + MI('store','mi-sm') + ' Magasin</b><div style="font-size:10px;color:var(--text-muted);">réapprovisionnement</div></td>';
  disques.forEach(function(d) {
    html += '<td><input type="number" class="ds-input" data-drow="MAGASIN" data-dref="' + d.id + '" id="ds_MAGASIN_' + d.id + '" value="' + (((d.locations || {})['En Stock']) || 0) + '" min="0" style="width:46px;text-align:center;padding:2px;font-size:12px;" oninput="dsRecalc()"></td>';
  });
  html += '<td><b class="ds-row-total">' + magTot + '</b></td><td></td><td></td><td></td></tr>';
  html += '<tr style="background:var(--accent-light, rgba(255,255,255,.05));"><td><b>Total par référence</b></td>';
  disques.forEach(function(d) { html += '<td><b id="dscoltot_' + d.id + '"></b></td>'; });
  html += '<td><b id="dsgrandtot"></b></td><td></td><td></td><td></td></tr>';
  html += '</tbody></table></div>';
  html += '<button class="btn btn-success btn-block" style="margin-top:12px;" onclick="saveDisquesTable()" data-perm="reglages:edit">' + MI('save','mi-sm') + ' Enregistrer le stock</button>' +
    '<div id="disquesMachinesMsg" style="margin-top:10px;font-size:12px;"></div>';
  el.innerHTML = html;
  dsRecalc();
}

function dsRecalc() {
  document.querySelectorAll('#disquesStockTable tbody tr[data-drow], #equipDisquesStockTable tbody tr[data-drow]').forEach(function(tr) {
    var total = 0;
    tr.querySelectorAll('.ds-input').forEach(function(inp) {
      var v = parseInt(inp.value, 10); if (!isNaN(v) && v > 0) total += v;
    });
    var t = tr.querySelector('.ds-row-total'); if (t) t.textContent = total;
    if (tr.dataset.drow !== 'MAGASIN') {
      var st = tr.querySelector('.ds-row-status');
      if (st) { st.innerHTML = total > 0 ? MI('check','mi-sm mi-green') : '—'; st.className = 'ds-row-status badge ' + (total > 0 ? 'badge-stock' : ''); }
      var need = parseInt(tr.dataset.dneed || '0', 10);
      var gapEl = tr.querySelector('.ds-row-gap');
      if (gapEl) {
        var gap = total - need;
        var h;
        if (!need) h = '<span class="badge" style="font-size:11px;">—</span>';
        else if (gap < 0) h = '<span class="badge badge-danger" style="font-size:11px;">' + MI('warning','mi-sm mi-amber') + ' ' + Math.abs(gap) + ' manquant</span>';
        else h = '<span class="badge badge-stock" style="font-size:11px;">OK</span>';
        gapEl.innerHTML = h;
      }
    }
  });
  (window.__dsRefs || []).forEach(function(did) {
    var col = 0;
    document.querySelectorAll('#disquesStockTable .ds-input[data-dref="' + did + '"], #equipDisquesStockTable .ds-input[data-dref="' + did + '"]').forEach(function(inp) {
      var v = parseInt(inp.value, 10); if (!isNaN(v) && v > 0) col += v;
    });
    var ct = document.getElementById('dscoltot_' + did); if (ct) ct.textContent = col;
  });
  var grand = 0;
  document.querySelectorAll('#disquesStockTable tbody tr[data-drow], #equipDisquesStockTable tbody tr[data-drow]').forEach(function(tr) {
    var t = tr.querySelector('.ds-row-total'); if (t) grand += (parseInt(t.textContent, 10) || 0);
  });
  var g = document.getElementById('dsgrandtot'); if (g) g.textContent = grand;
}

function saveDisquesTable() {
  (window.__dsRefs || []).forEach(function(did) {
    var d = disqueById(did);
    if (!d) return;
    if (!d.locations) d.locations = {};
    var tot = 0;
    DISQUES_LOCATIONS.forEach(function(l) {
      var idSuffix = l === 'En Stock' ? 'MAGASIN' : l;
      var v = parseInt((document.getElementById('ds_' + idSuffix + '_' + did) || {}).value, 10);
      var q = isNaN(v) ? 0 : Math.max(v, 0);
      if (q > 0) d.locations[l] = q; else delete d.locations[l];
      tot += q;
    });
    d.stockTotal = tot;
  });
  saveDisques();
  var msg = document.getElementById('disquesMachinesMsg');
  if (msg) msg.innerHTML = '<span style="color:var(--success);">' + MI('check_circle','mi-sm mi-green') + ' Stock de disques enregistré</span>';
  showToast('Stock de disques enregistré', 'success');
  renderDisquesAll();
  renderEquipDisques();
  if (typeof renderLigne === 'function') { renderLigne('A'); renderLigne('B'); }
}

function renderDisquesAll() {
  syncDisquesFromMachines();
  renderDisquesStockTable();
  renderLucide();
}

function renderEquipDisques() {
  syncDisquesFromMachines();
  renderDisquesStockTable('equipDisquesStockTable');
  renderLucide();
}

function switchEquipTab(tab) {
  currentEquipTab = tab;
  document.querySelectorAll('#screenEquip .eq-tab-panel').forEach(function(el) { el.style.display = 'none'; });
  var btns = document.querySelectorAll('#screenEquip .tab-switcher button');
  btns.forEach(function(b) { b.classList.remove('active'); });
  var panel = document.getElementById('equipTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (panel) panel.style.display = 'block';
  btns.forEach(function(b) { if (b.getAttribute('data-tab') === tab) b.classList.add('active'); });
  if (tab === 'disques') renderEquipDisques();
  else if (tab === 'cales') { renderCalesStockTable(); renderCalesRegul(); }
}

function disqueLocationChips(d) {
  var chips = '';
  DISQUES_LOCATIONS.forEach(function(loc) {
    var q = (d.locations && d.locations[loc]) ? d.locations[loc] : 0;
    if (q > 0) chips += '<span class="badge badge-stock" style="margin:2px 2px;" title="' + escapeHtml(machineSlotLabel(loc)) + '">' + loc + ' ' + q + '</span>';
  });
  return chips || '<span style="color:var(--text-muted);font-size:11px;">—</span>';
}

function currentDisqueOf() {
  var sel = document.getElementById('duOf');
  if (!sel || !sel.value) return null;
  return orders.find(function(o) { return o.orderNum === sel.value; }) || null;
}

function renderDisqueBesoin() {
  var el = document.getElementById('duBesoin');
  if (!el) return;
  var o = currentDisqueOf();
  if (!o) { el.innerHTML = ''; return; }
  var laterals = (o.laterals && o.laterals.length) ? o.laterals.length : 0;
  var pieceCount = 1 + laterals;
  var diskCount = (o.diskCount) ? o.diskCount : (2 * pieceCount + 1);
  var secondaires = Math.max(0, diskCount - 1);
  var principale = disques.find(function(d) { return d.type === 'principale'; });
  var dispoPrinc = principale ? disqueStockRestant(principale) : '—';
  var dispoSec = disques.filter(function(d) { return d.type === 'secondaire'; }).reduce(function(s, d) { return s + disqueStockRestant(d); }, 0);
  el.innerHTML = '<div class="warning-box" style="margin-top:10px;font-size:12px;">' +
    '<b>Besoin estimé pour ' + escapeHtml(o.orderNum) + '</b> : ' + diskCount + ' disques' +
    ' <span style="opacity:.7;">(1 principale 650 + ' + secondaires + ' secondaires 355/210)</span><br>' +
    'Stock dispo — Principale: <b>' + dispoPrinc + '</b> · Secondaires: <b>' + dispoSec + '</b>' +
    (dispoSec < secondaires ? ' <span style="color:var(--danger);font-weight:700;">→ Stock secondaires insuffisant !</span>' : '') +
    '</div>';
}

function goDisqueUse(id) {
  var d = disqueById(id);
  if (!d) return;
  navigateTo('disques');
  var sel = document.getElementById('duRef');
  if (sel) sel.value = id;
  var typeSel = document.getElementById('duType');
  if (typeSel) typeSel.value = 'montage';
  var qteEl = document.getElementById('duQte');
  if (qteEl) qteEl.value = '1';
  showToast('Consommation : ' + d.ref, 'info');
}

function disqueAffutage(id) {
  var d = disqueById(id);
  if (!d) return;
  showModal('Affûter disques', 'Réinitialiser les mètres usés de ' + d.ref + ' ?', '🔧', function() {
    d.lastSharpening = new Date().toISOString();
    d.totalMeters = 0;
    if (!d.usages) d.usages = [];
    d.usages.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2,6), ofNum: 'Affûtage', type: 'affutage', qte: 0, meters: 0, date: new Date().toISOString(), user: currentUser ? currentUser.email : '' });
    saveDisques();
    addAuditLog('Affûtage disques: ' + d.ref);
    renderDisquesAll();
    showToast('Affûtage enregistré', 'success');
  });
}

function deleteDisqueUsage(id) {
  var found = null;
  disques.forEach(function(d) {
    (d.usages || []).forEach(function(u) {
      if (u.id === id) found = u;
    });
  });
  if (!found) return;
  showModal('Supprimer', 'Supprimer cet enregistrement ? (Le stock n\'est pas recalculé automatiquement.)', '🗑️', function() {
    disques.forEach(function(d) {
      d.usages = (d.usages || []).filter(function(u) { return u.id !== id; });
    });
    saveDisques();
    renderDisquesAll();
    showToast('Enregistrement supprimé', 'info');
  });
}

function addDisqueRef() {
  var ref = document.getElementById('dnrRef').value.trim();
  var type = document.getElementById('dnrType').value;
  var diam = parseFloat(document.getElementById('dnrDiam').value) || 0;
  var qte = parseInt(document.getElementById('dnrQte').value, 10) || 0;
  var seuil = parseInt(document.getElementById('dnrSeuil').value, 10) || 1;
  var msgEl = document.getElementById('dnrMsg');
  if (!ref) { msgEl.innerHTML = '<span style="color:var(--danger);">Saisissez une référence.</span>'; return; }
  if (qte <= 0) { msgEl.innerHTML = '<span style="color:var(--danger);">Quantité initiale invalide.</span>'; return; }
  var locs = {};
  DISQUES_LOCATIONS.forEach(function(l) { locs[l] = 0; });
  locs['En Stock'] = qte;
  var d = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    ref: escapeHtml(ref), type: type, diametre: diam, stockTotal: qte, enService: 0,
    locations: locs, seuilAlerte: seuil, seuilMeters: 40000, totalMeters: 0,
    lastSharpening: '', usages: [], createdAt: new Date().toISOString()
  };
  disques.push(d);
  saveDisques();
  addAuditLog('Référence disque ajoutée: ' + ref);
  msgEl.innerHTML = '<span style="color:var(--success);">Ajouté !</span>';
  document.getElementById('dnrRef').value = '';
  document.getElementById('dnrDiam').value = '';
  document.getElementById('dnrQte').value = '';
  renderDisquesAll();
}

/* ─── RÉGULARISATION STOCK DISQUES ─── */

function disquesRegulLabel(d) {
  return escapeHtml(d.ref) + ' (' + disqueTypeLabel(d.type) + ' · ' + disqueStockRestant(d) + ' disp.)';
}

function disquesRegulApply() {
  var d = disqueById(document.getElementById('dregRef').value);
  var loc = document.getElementById('dregLoc').value;
  var sense = document.getElementById('dregSense').value;
  var qty = parseInt(document.getElementById('dregQty').value, 10);
  var note = (document.getElementById('dregNote').value || '').trim();
  var msgEl = document.getElementById('disquesRegulMsg');
  if (!d || !loc || isNaN(qty) || qty < 1) {
    if (msgEl) msgEl.innerHTML = '<span style="color:var(--danger);">Vérifiez la référence, l\'emplacement et la quantité.</span>';
    return;
  }
  if (!d.locations) d.locations = {};
  var current = d.locations[loc] || 0;
  if (sense === 'out') {
    if (current < qty) {
      if (msgEl) msgEl.innerHTML = '<span style="color:var(--danger);">Sortie impossible : ' + current + ' disponible @ ' + escapeHtml(loc) + ' (' + escapeHtml(d.ref) + ').</span>';
      return;
    }
    d.locations[loc] = current - qty;
    d.stockTotal = Math.max(0, (d.stockTotal || 0) - qty);
  } else {
    d.locations[loc] = current + qty;
    d.stockTotal = (d.stockTotal || 0) + qty;
  }
  saveDisques();
  var log = { ref: d.ref, loc: loc, sense: sense, qty: qty, note: note, by: (currentUser && currentUser.email) || 'admin', date: new Date().toLocaleString('fr-FR') };
  disquesRegulLogs.unshift(log);
  saveToStorage(STORAGE_KEYS.disquesRegul, disquesRegulLogs);
  addAuditLog('Régularisation disques: ' + (sense === 'in' ? '+' : '−') + qty + ' @ ' + loc + ' (' + d.ref + ')' + (note ? ' — ' + note : ''));
  if (msgEl) msgEl.innerHTML = '<span style="color:var(--success);">' + MI('check_circle','mi-sm mi-green') + ' Régularisation enregistrée</span>';
  showToast('Régularisation disques enregistrée', 'success');
  renderDisquesAll();
}
