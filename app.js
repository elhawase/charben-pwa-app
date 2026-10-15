/* ============================================================
 * app.js - logique metier (dashboard, stock, production, disques,
 * planning, outils) - core.js charge avant
 * ============================================================ */

function addLateralInput() {
  const maxLaterals = Math.floor((MAX_BLADES - 3) / 2);
  if (lateralCount >= maxLaterals) {
    showToast(`Limite atteinte : ${maxLaterals} latérales max (la machine ne monte que ${MAX_BLADES} lames)`, 'warning');
    return;
  }
  lateralCount++;
  renderLateralInputs();
}

function removeLateralInput(index) {
  if (lateralCount > 1) {
    lateralCount--;
    renderLateralInputs();
  }
}

function renderLateralInputs() {
  const container = document.getElementById('lateralInputsContainer');
  if (!container) return;
  let html = '';
  for (let i = 0; i < lateralCount; i++) {
    html += `
      <div class="lateral-input-row">
        <input type="number" class="form-input" id="lat${i}" placeholder="Latérale ${i + 1} (mm)" min="1" step="any" oninput="updateOfSummary()">
        <input type="number" class="form-input" id="latW${i}" placeholder="B ${i + 1} (mm)" min="1" step="any" oninput="updateOfSummary()">
        ${lateralCount > 1 ? `<button type="button" class="remove-lateral-btn" onclick="removeLateralInput(${i})">×</button>` : ''}
      </div>`;
  }
  container.innerHTML = html;

  const maxLaterals = Math.floor((MAX_BLADES - 3) / 2);
  const addBtn = document.getElementById('addLateralBtn');
  if (addBtn) {
    const atMax = lateralCount >= maxLaterals;
    addBtn.disabled = atMax;
    addBtn.style.opacity = atMax ? '0.5' : '1';
    addBtn.style.cursor = atMax ? 'not-allowed' : 'pointer';
  }
}

function populateEssenceSelect(selectId, value) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '';
  Object.keys(GAMME_ESSENCES).forEach(function(k) {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = GAMME_ESSENCES[k].label;
    sel.appendChild(opt);
  });
  const v = GAMME_ESSENCES[value] ? value : 'spruce';
  sel.value = v;
}

function validateOrder() {
  const msgEl = document.getElementById('ofValidationMsg');
  const logWidth = parseFloat(document.getElementById('ofLogWidth').value);
  const central = parseFloat(document.getElementById('ofCentralThickness').value);
  const laterals = getLateralValues();

  if (!logWidth || logWidth <= 0) {
    msgEl.innerHTML = '<div class="warning-box">Veuillez renseigner la largeur de grume.</div>';
    return;
  }
  if (logWidth > MAX_LOG_WIDTH) {
    msgEl.innerHTML = '<div class="warning-box">' + MI('warning','mi-sm mi-amber') + ' Grume > ' + MAX_LOG_WIDTH + 'mm non support\u00e9e — capacit\u00e9 max de sciage des lignes A/B = ' + MAX_LOG_WIDTH + 'mm.</div>';
    return;
  }
  if (!central || central <= 0) {
    msgEl.innerHTML = '<div class="warning-box">Veuillez renseigner l\'épaisseur centrale.</div>';
    return;
  }

  const sumSingle = central + laterals.reduce((a, b) => a + b, 0);
  const sumDouble = sumSingle * 2;
  const pieceCount = 1 + laterals.length;
  const diskCount = 2 * pieceCount + 1;

  if (diskCount > MAX_BLADES) {
    const maxLaterals = Math.floor((MAX_BLADES - 3) / 2);
    msgEl.innerHTML = `<div class="warning-box">` + MI('cancel','mi-sm mi-red') + ` Commande NON valid\u00e9e : la machine ne peut monter que ${MAX_BLADES} lames maximum sur l'axe (1 centrale + max ${maxLaterals} lat\u00e9rales). Votre s\u00e9lection demande ${diskCount} lames (1 centrale + ${laterals.length} lat\u00e9rale(s)). R\u00e9duisez le nombre d'\u00e9paisseurs lat\u00e9rales.</div>`;
    return;
  }

  const diskTotal = diskCount * DISK_THICKNESS;
  const totalConsumed = sumDouble + diskTotal;
  const chute = +(logWidth - totalConsumed).toFixed(2);

  if (chute < 0) {
    msgEl.innerHTML = `<div class="warning-box">` + MI('cancel','mi-sm mi-red') + ` Grume trop petite. Besoin: ${totalConsumed}mm (manque ${Math.abs(chute).toFixed(1)}mm)</div>`;
    return;
  }

  const essenceSel = document.getElementById('ofEssence');
  const essence = (essenceSel && GAMME_ESSENCES[essenceSel.value]) ? essenceSel.value : gammeEssence();
  const centerWidth = parseFloat(document.getElementById('ofCenterWidth').value);
  const lateralWidths = getLateralWidths();
  const margin = Math.max(0, parseFloat(document.getElementById('ofMargin').value) || 0);
  if (2 * margin >= logWidth) {
    msgEl.innerHTML = '<div class="warning-box">' + MI('cancel','mi-sm mi-red') + ' Marge de s\u00e9curit\u00e9 trop grande (' + margin + 'mm \u00d7 2) pour une grume de ' + logWidth + 'mm.</div>';
    return;
  }
  const gv = validateGammePieces(essence, central, centerWidth, laterals, lateralWidths);
  if (gv.blocked.length) {
    msgEl.innerHTML = '<div class="warning-box">' + MI('cancel','mi-sm mi-red') + ' ' + gv.blocked.map(function(m) { return escapeHtml(m); }).join('<br>') + '</div>';
    return;
  }

  const qty = parseInt(document.getElementById('ofQty').value || '0', 10);
  const pieceLength = parseInt(document.getElementById('ofPieceLength').value || '0', 10) || 0;
  const client = (document.getElementById('ofClient').value || '').trim().toUpperCase();
  const reference = (document.getElementById('ofReference').value || '').trim();
  const plannedStart = document.getElementById('ofPlannedStart').value || '';
  const plannedEnd = document.getElementById('ofPlannedEnd').value || '';
  const remarks = (document.getElementById('ofRemarks').value || '').trim();

  orderCounter++;
  const orderNum = `OF-${String(orderCounter).padStart(4, '0')}`;
  const now = new Date();
  const date = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
               now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const order = {
    orderNum,
    date,
    line: ofActiveLine,
    logWidth,
    central,
    laterals,
    essence,
    centerWidth,
    lateralWidths,
    pieceCount,
    diskCount,
    totalConsumed,
    chute,
    margin: margin > 0 ? margin : null,
    qty,
    pieceLength,
    client,
    reference,
    plannedStart,
    plannedEnd,
    actualStart: date,
    producedQty: 0,
    status: 'draft',
    remarks
  };

  orders.unshift(order);
  setLineOrder(ofActiveLine, order);
  safeSave(STORAGE_KEYS.orders, orders);
  safeSave(STORAGE_KEYS.counter, orderCounter);
  fsSave('orders', orders);

  syncToAllTabs();

  const essLabel = escapeHtml(GAMME_ESSENCES[essence].label);
  const cwStr = centerWidth ? escapeHtml(String(centerWidth)) : '—';
  const lwStr = (lateralWidths && lateralWidths.length) ? escapeHtml(lateralWidths.join(', ')) + ' mm' : '—';
  const gammeLine = gv.infos.map(function(i2) { return escapeHtml(String(i2.h)) + '×' + escapeHtml(String(i2.b)) + ' ' + escapeHtml(String(i2.cls)); }).join(' · ');

  const qtyStr = qty ? escapeHtml(String(qty)) : '—';
  const clientStr = client ? escapeHtml(client) : '—';
  const refStr = reference ? escapeHtml(reference) : '—';
  const fgStr = fgWarehouse ? escapeHtml(fgWarehouse) : '—';
  const wipStr = wipWarehouse ? escapeHtml(wipWarehouse) : '—';
  const startStr = plannedStart ? escapeHtml(plannedStart) : '—';
  const endStr = plannedEnd ? escapeHtml(plannedEnd) : '—';

  msgEl.innerHTML = `
    <div class="status-badge status-success" style="display:flex;padding:14px;border-radius:12px;">
      <span>'+MI('check_circle','mi-sm mi-green')+' <b>${escapeHtml(orderNum)}</b> valid\u00e9e</span>
    </div>
    <div class="config-preview" style="margin-top:12px;">
      <div class="config-preview-row"><span>Client</span><strong>${clientStr}</strong></div>
      <div class="config-preview-row"><span>Référence</span><strong>${refStr}</strong></div>
      <div class="config-preview-row"><span>Quantité</span><strong>${qtyStr}</strong></div>
      <div class="config-preview-row"><span>Début prévu</span><strong>${startStr}</strong></div>
      <div class="config-preview-row"><span>Fin prévue</span><strong>${endStr}</strong></div>
      <div class="config-preview-row"><span>Magasin PF</span><strong>${fgStr}</strong></div>
      <div class="config-preview-row"><span>Magasin en-cours</span><strong>${wipStr}</strong></div>
      <div class="config-preview-row"><span>Consommé</span><strong>${totalConsumed} mm</strong></div>
      <div class="config-preview-row"><span>Disques (${diskCount}×${DISK_THICKNESS})</span><strong>${diskTotal} mm</strong></div>
      <div class="config-preview-row"><span>Chute totale</span><strong style="color:${chute > 20 ? 'var(--warning)' : 'var(--success)'}">${chute} mm</strong></div>
      <div class="config-preview-row"><span>Essence</span><strong>${essLabel}</strong></div>
      <div class="config-preview-row"><span>Largeurs B</span><strong>Centre ${cwStr} · Latérales ${lwStr}</strong></div>
      ${margin > 0 ? '<div class="config-preview-row"><span>Marge sécurité</span><strong>' + margin + 'mm × 2 (flancs non sciés protégés)</strong></div>' : ''}
      ${gammeLine ? '<div class="config-preview-row"><span>Gamme</span><strong>' + gammeLine + '</strong></div>' : ''}
    </div>`;
  if (gv.warnings.length) {
    msgEl.innerHTML += '<div class="warning-box" style="margin-top:10px;">' + MI('warning','mi-sm mi-amber') + ' ' + gv.warnings.map(function(m) { return escapeHtml(m); }).join('<br>') + '</div>';
  }

  showToast(`${orderNum} créée !`, 'success');
  renderOrdersList();
  clearOfForm();
}

function clearOfForm() {
  var fields = ['ofLogWidth', 'ofCentralThickness', 'ofCenterWidth', 'ofMargin', 'ofQty', 'ofClient', 'ofReference', 'ofPlannedStart', 'ofPlannedEnd', 'ofRemarks'];
  fields.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var container = document.getElementById('lateralInputsContainer');
  if (container) container.innerHTML = '';
  var summary = document.getElementById('ofSummary');
  if (summary) { summary.style.display = 'none'; summary.innerHTML = ''; }
}

function updateOfSummary() {
  var logWidth = parseFloat(document.getElementById('ofLogWidth').value) || 0;
  var central = parseFloat(document.getElementById('ofCentralThickness').value) || 0;
  var centerWidth = parseFloat(document.getElementById('ofCenterWidth').value) || 0;
  var lateralInputs = document.querySelectorAll('#lateralInputsContainer input');
  var laterals = Array.from(lateralInputs).map(function(i) { return parseFloat(i.value) || 0; });
  var sumLat = laterals.reduce(function(a, b) { return a + b; }, 0);
  var margin = Math.max(0, parseFloat(document.getElementById('ofMargin').value) || 0);
  var diskCount = Math.ceil((central * 2 + sumLat) / DISK_THICKNESS);
  var diskTotal = diskCount * DISK_THICKNESS;
  var totalConsumed = sumLat + diskTotal + (centerWidth ? centerWidth * 2 : 0) + margin * 2;
  var chute = +(logWidth - totalConsumed).toFixed(2);
  var summary = document.getElementById('ofSummary');
  if (!summary) return;
  if (!logWidth || !central) { summary.style.display = 'none'; summary.innerHTML = ''; return; }
  summary.style.display = 'block';
  summary.innerHTML = '<div style="font-size:12px;color:var(--text-secondary);line-height:1.7;">'
    + '<strong>Estimation</strong> : ' + diskCount + ' disques × ' + DISK_THICKNESS + 'mm = <strong>' + diskTotal + 'mm</strong> · '
    + 'Consommé estimé = <strong>' + totalConsumed + 'mm</strong> · '
    + 'Chute = <strong style="color:' + (chute < 0 ? 'var(--danger)' : chute < 20 ? 'var(--success)' : 'var(--warning)') + '">' + chute + 'mm</strong>'
    + '</div>';
}

function syncToAllTabs() {
  const o = getActiveOrder();
  if (!o) return;

  const patternEl = document.getElementById('patternSelect');
  if (patternEl) { patternEl.value = 'CUSTOM'; toggleCustomInputs(); }
  const centerEl = document.getElementById('cCenter');
  if (centerEl) centerEl.value = o.central;
  const sideEl = document.getElementById('cSide');
  if (sideEl) sideEl.value = o.laterals && o.laterals[0] != null ? o.laterals[0] : '';
  const side2Group = document.getElementById('cSide2Group');
  if (side2Group) {
    const side2El = document.getElementById('cSide2');
    if (o.laterals && o.laterals.length > 1) {
      if (side2El) side2El.value = o.laterals[1];
      side2Group.style.display = 'block';
    } else {
      if (side2El) side2El.value = '';
      side2Group.style.display = 'none';
    }
  }

  updateSyncBanner();

  renderYieldAuto();

  renderSettingsSync();
}

function updateSyncBanner() {
  const sub = document.getElementById('topBarSyncSub');
  if (!sub) return;
  sub.textContent = '';
}

function toggleCustomInputs() {
  const isCustom = document.getElementById('patternSelect').value === 'CUSTOM';
  document.getElementById('customInputs').style.display = isCustom ? 'block' : 'none';
}


function saveAdminBroadcast() {
  var input = document.getElementById('adminBroadcastInput');
  if (!input) return;
  var msg = input.value.trim();
  if (!msg) { showToast('Message vide', 'warning'); return; }
  localStorage.setItem('charben_admin_broadcast', msg);
  localStorage.removeItem('charben_broadcast_dismissed');
  showToast('Message diffusé à tous les utilisateurs', 'success');
  loadAdminBroadcast();
}

function clearAdminBroadcast() {
  localStorage.removeItem('charben_admin_broadcast');
  localStorage.removeItem('charben_broadcast_dismissed');
  var input = document.getElementById('adminBroadcastInput');
  if (input) input.value = '';
  showToast('Message effacé', 'info');
  loadAdminBroadcast();
}

function resetAllData() {
  showModal('Réinitialiser', 'Effacer toutes les données de l\'application ? Cette action est irréversible.', '⚠️', function() {
    Object.keys(localStorage).forEach(function(k) {
      if (k.indexOf('charben_') === 0 && k !== 'charben_theme' && k.indexOf('charben_role_') !== 0 && k !== 'charben_session' && k !== 'charben_remember') {
        try { localStorage.removeItem(k); } catch (e) {}
      }
    });
    showToast('Données réinitialisées — redémarrage...', 'info');
    setTimeout(function() { location.reload(); }, 900);
  });
}

function renderYieldAuto() {
  const resultPanel = document.getElementById('yieldResult');
  const syncBadge = document.getElementById('yieldSyncBadge');
  if (!resultPanel || !syncBadge) return;

  const o = getActiveOrder();
  if (!o) {
    resultPanel.classList.remove('active');
    syncBadge.style.display = 'none';
    return;
  }
  
  syncBadge.style.display = 'inline-flex';
  syncBadge.innerHTML = MI('check_circle','mi-sm mi-green') + ' ' + escapeHtml(o.orderNum);

  calculateAndDisplayYield(o);
}

function calculateAndDisplayYield(o) {
  const resultPanel = document.getElementById('yieldResult');
  if (!resultPanel) return;
  resultPanel.classList.add('active');
  resultPanel.innerHTML = buildYieldFicheHtml(o);
}

/**
 * Table de rendement par diamètre — pour un OF donné, montre le rendement attendu
 * sur différentes largeurs de grume (diamètre × 10mm) compatibles avec le plan.
 * Permet d'anticiper le rendement selon la grume réelle lancée.

/**
 * Table rendement par grume lancée sur l'OF actuel.
 * Monte un mini-RP de chaque grume avec son diamètre réel, la contribution volumique
 * réelle, et le rendement instantané grume→pièces.

// (bloc variable deplacé vers data.js — ligne source 760)
// (bloc variable deplacé vers data.js — ligne source 761)
// (bloc variable deplacé vers data.js — ligne source 762)
// (bloc variable deplacé vers data.js — ligne source 763)
// (bloc variable deplacé vers data.js — ligne source 764)
// (bloc variable deplacé vers data.js — ligne source 765)
// (bloc variable deplacé vers data.js — ligne source 766)

function confirmInstallation(line) {
  if (!lastInstallNeeds) return;
  const short = shortagesOf(lastInstallNeeds, line + '1');
  if (short.length) {
    var detail = shortageDetail(lastInstallNeeds, line + '1', short);
    showModal(
      'Stock insuffisant — ' + line + '1',
      detail + '<br><br>Déduire quand même les cales disponibles du stock ?',
      '⚠️',
      function() {
        consumeCales(line + '1', lastInstallNeeds);
        renderStockTable();
        renderCalesStockTable();
        ['1', '2', '3', '4'].forEach(function(n) {
          saveToStorage('charben_machine_status_' + line + '_' + line + n, 'En marche');
        });
        renderLigne(line);
        showToast('Stock partiellement déduit', 'success');
      }
    );
    return;
  }
  showModal(
    'Confirmer installation',
    'Déduire les cales du stock ?',
    '⚙️',
    () => {
      consumeCales(line + '1', lastInstallNeeds);
      renderStockTable();
      renderCalesStockTable();
      ['1', '2', '3', '4'].forEach(function(n) {
        saveToStorage('charben_machine_status_' + line + '_' + line + n, 'En marche');
      });
      renderLigne(line);
      showToast('Stock mis à jour', 'success');
    }
  );
}


/* ===== FICHES TECHNIQUES A2/A3/A4 — CC / SB / Dosses ===== */
// (bloc variable deplacé vers data.js — ligne source 881)

// (bloc variable deplacé vers data.js — ligne source 883)

function shortageDetail(needs, machine, shortages) {
  var d = shortages.map(function(s) {
    var dis = stockDispoFor(machine, s);
    return escapeHtml(s + 'mm : dispo ' + dis.total + ' (kit ' + dis.kit + ' + magasin ' + dis.magasin + ') / besoin ' + needs[s]);
  }).join(', ');
  return '\u26a0\ufe0f Stock insuffisant' + (machine ? ' — ' + machineKitKey(machine) : '') + ' : ' + d;
}

function consumeCales(machine, needs) {
  try {
    var kit = machineKit(machine);
    Object.keys(needs).forEach(function(size) {
      var n = needs[size];
      var fromKit = Math.min(kit[size] || 0, n);
      kit[size] = (kit[size] || 0) - fromKit;
      if (!kit[size]) delete kit[size];
      var rest = n - fromKit;
      if (rest > 0) {
        STOCK[size] = Math.max((STOCK[size] || 0) - rest, 0);
      }
    });
    saveToStorage(STORAGE_KEYS.calesMachines, calesMachines);
    safeSave(STORAGE_KEYS.stock, STOCK);
  } catch (e) {
    errLog('cales', 'consumeCales ' + machine, e, 'error');
    errUser('Déduction des cales non enregistrée. Rechargez la page.', 'Calage ' + machine);
    return;
  }
  renderCalesStockTable();
  if (typeof renderLigne === 'function') { renderLigne('A'); renderLigne('B'); }
}

function machineConfirmInstallation(line, machine) {
  const o = getLineOrder(line);
  if (!o) {
    showToast('Aucun OF en cours pour la ligne ' + line + '.', 'warning');
    return;
  }
  let needs = null;
  if (machine.endsWith('2')) {
    const info = ccMachineInfo(o);
    if (info && info.b && info.n >= 1) {
      needs = needsForCombos([comboArray(info.b, machine)], info.n * ARBORS_PER_SAW);
      if (info.extraB) {
        const extraNeeds = needsForCombos([comboArray(info.extraB, machine)], ARBORS_PER_SAW);
        Object.keys(extraNeeds).forEach(function(s) { needs[s] = (needs[s] || 0) + extraNeeds[s]; });
      }
    }
  } else if (machine.endsWith('3')) {
    const infos = sbMachineInfo(o);
    const combos = [];
    infos.forEach(function(i) {
      if (i.b && i.n >= 1) { for (let k = 0; k < i.n; k++) combos.push(comboArray(i.b, machine)); }
    });
    needs = needsForCombos(combos, ARBORS_PER_SAW);
  }
  lastSlotInstall = { line: line, machine: machine, needs: needs };
  confirmSlotInstallation(line, machine);
}

function confirmSlotInstallation(line, machine) {
  const needs = lastSlotInstall.needs;
  if (needs) {
    const short = shortagesOf(needs, machine);
    if (short.length) {
      var detail = shortageDetail(needs, machine, short);
      showModal(
        'Stock insuffisant — ' + machine,
        detail + '<br><br>Déduire quand même les cales disponibles du stock ?',
        '⚠️',
        function() {
          consumeCales(machine, needs);
          renderStockTable();
          renderCalesStockTable();
          saveToStorage('charben_machine_status_' + line + '_' + machine, 'En marche');
          renderLigne(line);
          showToast('Stock partiellement déduit', 'success');
        }
      );
      return;
    }
  }
  showModal('Confirmer installation ' + machine, needs ? 'D\u00e9duire les cales du stock ?' : 'Confirmer la r\u00e9cup\u00e9ration des dosses ?', '\u2699\ufe0f', function() {
    if (needs) {
      consumeCales(machine, needs);
      renderStockTable();
      renderCalesStockTable();
    }
    saveToStorage('charben_machine_status_' + line + '_' + machine, 'En marche');
    renderLigne(line);
    showToast('Stock mis \u00e0 jour', 'success');
  });
}

/* ═══════════════════════════════════════════════
   PDF EXPORT — Diagram zoom, plan A4, viewer
   → Extrait vers modules/pdf-export.js (Phase 2A)
   ═══════════════════════════════════════════════ */


function renderStockTable() {
  const container = document.getElementById('stockTable');
  if (!container) return;
  const sizes = getRingSizes().filter(s => !stockFilterText.trim() || String(s).includes(stockFilterText.trim()));
  const totalEl = document.getElementById('stockTotal');
  if (totalEl) {
    const totalQty = sizes.reduce((sum, s) => sum + (STOCK[s] || 0), 0);
    totalEl.textContent = `${sizes.length} cales · ${totalQty} pièces`;
  }
  container.innerHTML = `
    <div class="stock-row stock-row-header">
      <span>Cale</span>
      <span>Stock</span>
      <span>Besoin</span>
    </div>` +
    sizes.map(s => {
      const need = lastInstallNeeds ? (lastInstallNeeds[s] || 0) : null;
      const dispo = stockDispoFor(lastInstallMachine, s);
      let status = '<span style="color:var(--text-muted);font-size:11px;">—</span>';
      if (need && need > 0) {
        const ok = dispo.total >= need;
        status = `<span class="stock-status ${ok ? 'ok' : 'warn'}">${need} ${ok ? MI('check_circle','mi-sm mi-green') : MI('warning','mi-sm mi-amber')}</span>`;
      }
      return `
        <div class="stock-row">
          <span><b>${s}mm</b></span>
          <input type="number" class="stock-input" id="sk_${s}" value="${STOCK[s] || 0}" min="0">
          <span>${status}</span>
        </div>`;
    }).join('');
}



/* ═══════════════════════════════════════════════
   STOCK CALES PAR MACHINE — kits dédiés + magasin
   A1+B1 : réglage validé (Production)
   A2−B2 / A3−B3 / A4−B4 : état document (Engineering Note)
   Chaque paire possède SON kit séparé, le magasin = réapprovisionnement.
   ═══════════════════════════════════════════════ */
// (bloc variable deplacé vers data.js — ligne source 1710)
// (bloc variable deplacé vers data.js — ligne source 1711)

function renderCalesStockTable() {
  var el = document.getElementById('calesStockTable');
  if (!el) return;
  var sizes = calesAllSizes();
  window.__cmSizes = sizes;
  var html = '<p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Chaque paire de machines possède son propre kit de cales (sans mélange). Le magasin garde le réapprovisionnement. Une cale est toujours affectée à UNE machine ou au magasin : total par taille = somme des kits + magasin.</p>';
  html += '<div style="overflow-x:auto;"><table class="data-table">' +
    '<thead><tr><th>Machine</th>';
  sizes.forEach(function(s) { html += '<th>' + s + '</th>'; });
  html += '<th>Total</th><th>Statut</th><th>Besoin OF</th><th>\u00c9cart</th></tr></thead><tbody>';

  CALES_PAIR_KEYS.forEach(function(k) {
    var kit = calesMachines[k] || {};
    var total = caleListTotal(kit);
    var pn = calesPairName(k);
    var gap = caleGapForPair(k);
    html += '<tr data-row="' + k + '" data-cneed="' + (gap.need || 0) + '"><td><b>' + calesPairShort(k) + '</b>' +
      (pn ? '<div style="font-size:11px;color:var(--text-muted);line-height:1.3;">' + escapeHtml(pn) + '</div>' : '') + '</td>';
    sizes.forEach(function(s) {
      html += '<td><input type="number" class="cm-input" data-row="' + k + '" data-size="' + s + '" id="cm_' + k + '_' + s + '" value="' + (kit[s] || 0) + '" min="0" style="width:46px;text-align:center;padding:2px;font-size:12px;" oninput="cmRecalc()"></td>';
    });
    html += '<td><b class="cm-row-total">' + total + '</b></td>' +
      '<td><span class="cm-row-status badge ' + (total > 0 ? 'badge-stock' : '') + '">' + (total > 0 ? MI('check','mi-sm mi-green') + ' Kit' : '—') + '</span></td>' +
      '<td><b class="cm-row-need">' + (gap.need || '—') + '</b></td>' +
      '<td><span class="cm-row-gap badge ' + (gap.gap < 0 ? 'badge-danger' : 'badge-stock') + '" style="font-size:11px;">' + (gap.need ? (gap.gap < 0 ? MI('warning','mi-sm mi-amber') + ' ' + Math.abs(gap.gap) + ' manquant' : 'OK') : '—') + '</span></td></tr>';
  });

  var magTotal = Object.keys(STOCK).reduce(function(s, k) { return s + STOCK[k]; }, 0);
  html += '<tr data-row="MAGASIN"><td><b>' + MI('store','mi-sm') + ' Magasin</b><div style="font-size:10px;color:var(--text-muted);">r\u00e9approvisionnement</div></td>';
  sizes.forEach(function(s) {
    html += '<td><input type="number" class="cm-input" data-row="MAGASIN" data-size="' + s + '" id="cm_MAGASIN_' + s + '" value="' + (STOCK[s] !== undefined ? STOCK[s] : 0) + '" min="0" style="width:46px;text-align:center;padding:2px;font-size:12px;" oninput="cmRecalc()"></td>';
  });
  html += '<td><b class="cm-row-total">' + magTotal + '</b></td><td></td><td></td><td></td></tr>';

  html += '<tr style="background:var(--accent-light, rgba(255,255,255,.05));"><td><b>Total par taille</b></td>';
  sizes.forEach(function(s) { html += '<td><b id="cmcoltot_' + s + '"></b></td>'; });
  html += '<td><b id="cmgrandtot"></b></td><td></td><td></td><td></td></tr>';

  html += '</tbody></table></div>';
  html += '<button class="btn btn-success btn-block" style="margin-top:12px;" onclick="saveCalesMachines()" data-perm="reglages:edit">' + MI('save','mi-sm') + ' Enregistrer le stock</button>' +
    '<div id="calesMachinesMsg" style="margin-top:10px;font-size:12px;"></div>';
  el.innerHTML = html;
  cmRecalc();
}

function cmRecalc() {
  document.querySelectorAll('#calesStockTable tbody tr[data-row], #equipCalesStockTable tbody tr[data-row]').forEach(function(tr) {
    var total = 0;
    tr.querySelectorAll('.cm-input').forEach(function(inp) {
      var v = parseInt(inp.value, 10); if (!isNaN(v) && v > 0) total += v;
    });
    var t = tr.querySelector('.cm-row-total'); if (t) t.textContent = total;
    if (tr.dataset.row !== 'MAGASIN') {
      var st = tr.querySelector('.cm-row-status');
      if (st) { st.innerHTML = total > 0 ? MI('check','mi-sm mi-green') + ' Kit' : '—'; st.className = 'cm-row-status badge ' + (total > 0 ? 'badge-stock' : ''); }
      var need = parseInt(tr.dataset.cneed || '0', 10);
      var gapEl = tr.querySelector('.cm-row-gap');
      if (gapEl) {
        var gap = total - need;
        var html;
        if (!need) html = '<span class="badge" style="font-size:11px;">—</span>';
        else if (gap < 0) html = '<span class="badge badge-danger" style="font-size:11px;">' + MI('warning','mi-sm mi-amber') + ' ' + Math.abs(gap) + ' manquant</span>';
        else html = '<span class="badge badge-stock" style="font-size:11px;">OK</span>';
        gapEl.innerHTML = html;
      }
    }
  });
  (window.__cmSizes || []).forEach(function(s) {
    var col = 0;
    document.querySelectorAll('#calesStockTable .cm-input[data-size="' + s + '"]').forEach(function(inp) {
      var v = parseInt(inp.value, 10); if (!isNaN(v) && v > 0) col += v;
    });
    var ct = document.getElementById('cmcoltot_' + s); if (ct) ct.textContent = col;
  });
  var grand = 0;
  document.querySelectorAll('#calesStockTable tbody tr[data-row]').forEach(function(tr) {
    var t = tr.querySelector('.cm-row-total');
    if (t) grand += (parseInt(t.textContent, 10) || 0);
  });
  var g = document.getElementById('cmgrandtot'); if (g) g.textContent = grand;
}

function saveCalesMachines() {
  var sizes = window.__cmSizes || [];
  CALES_PAIR_KEYS.forEach(function(k) {
    var kit = {};
    sizes.forEach(function(s) {
      var v = parseInt((document.getElementById('cm_' + k + '_' + s) || {}).value, 10);
      if (!isNaN(v) && v > 0) kit[s] = v;
    });
    calesMachines[k] = kit;
  });
  sizes.forEach(function(s) {
    var v = parseInt((document.getElementById('cm_MAGASIN_' + s) || {}).value, 10);
    STOCK[s] = isNaN(v) ? 0 : Math.max(v, 0);
  });
  saveToStorage(STORAGE_KEYS.calesMachines, calesMachines);
  safeSave(STORAGE_KEYS.stock, STOCK);
  var msg = document.getElementById('calesMachinesMsg');
  if (msg) msg.innerHTML = '<span style="color:var(--success);">' + MI('check_circle','mi-sm mi-green') + ' Stock par machine enregistr\u00e9</span>';
  showToast('Stock par machine enregistré', 'success');
  renderCalesStockTable();
  if (typeof renderLigne === 'function') { renderLigne('A'); renderLigne('B'); }
}

/* ═══════════════════════════════════════════════
   RÉGULARISATION STOCK CALES — réservée admin (moi)
   Ajustements contrôlés : entrée/sortie par cible et taille,
   avec motif + historique + audit. Visible uniquement pour l'admin.
   ═══════════════════════════════════════════════ */
// (bloc variable deplacé vers data.js — ligne source 1829)

function calesRegulGet(key, size) {
  if (key === 'MAGASIN') return STOCK[size] || 0;
  return (calesMachines[key] || {})[size] || 0;
}

function calesRegulSet(key, size, val) {
  if (key === 'MAGASIN') { STOCK[size] = Math.max(0, val); return; }
  if (!calesMachines[key]) calesMachines[key] = {};
  if (val > 0) calesMachines[key][size] = val; else delete calesMachines[key][size];
}

function renderCalesRegul() {
  var el = document.getElementById('calesRegul');
  if (!el) return;
  if (!isAdmin()) {
    el.innerHTML = '';
    return;
  }
  var sizes = calesAllSizes();
  var html = '<p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">' + MI('lock','mi-sm mi-muted') + ' R\u00e9serv\u00e9 \u00e0 l\'administrateur : ajustement contr\u00f4l\u00e9 du stock (inventaire, casses, corrections). Chaque op\u00e9ration est horodat\u00e9e et trac\u00e9e.</p>';
  html += '<div class="form-grid form-grid-2">' +
    '<div class="form-group"><label class="form-label">Cible</label><select class="form-input" id="cregTarget">';
  calesRegulTargetKeys().forEach(function(k) { html += '<option value="' + k + '">' + calesRegulTargetLabel(k) + '</option>'; });
  html += '</select></div>' +
    '<div class="form-group"><label class="form-label">Taille (mm)</label><select class="form-input" id="cregSize">';
  sizes.forEach(function(s) { html += '<option value="' + s + '">' + s + ' mm</option>'; });
  html += '</select></div>' +
    '<div class="form-group"><label class="form-label">Sens</label><select class="form-input" id="cregSense">' +
    '<option value="in">Entrée (+) — inventaire/retour</option>' +
    '<option value="out">Sortie (−) — casse/correction</option>' +
    '</select></div>' +
    '<div class="form-group"><label class="form-label">Quantité</label><input type="number" class="form-input" id="cregQty" value="1" min="1"></div>' +
    '</div>' +
    '<div class="form-group"><label class="form-label">Motif</label><input type="text" class="form-input" id="cregNote" placeholder="Ex : inventaire, 2 cales cassées 20mm..."></div>' +
    '<button class="btn btn-primary btn-block" onclick="calesRegulApply()">' + MI('balance','mi-sm') + ' Appliquer la r\u00e9gularisation</button>' +
    '<div id="calesRegulMsg" style="margin-top:10px;font-size:12px;"></div>';

  if (calesRegulLogs.length) {
    var logRows = calesRegulLogs.slice(0, 15).map(function(r) {
      var sign = r.sense === 'in' ? '<span style="color:var(--success);">+</span>' : '<span style="color:var(--danger);">−</span>';
      return '<div class="dt-row">' +
        '<span class="mp-dt-date" style="min-width:100px;">' + escapeHtml(r.date) + '</span>' +
        '<span class="mp-dt-autres">' + sign + ' <b>' + r.qty + '</b> × ' + r.size + ' mm → ' + calesRegulTargetLabel(r.target) + (r.note ? ' · ' + escapeHtml(r.note) : '') + '</span>' +
        '<span class="mp-dt-vol">' + escapeHtml(r.by) + '</span></div>';
    }).join('');
    html += '<div style="margin-top:14px;"><h5 style="font-size:12px;font-weight:700;margin-bottom:8px;color:var(--text-secondary);">Historique des régularisations</h5>'
      + '<div class="dt-table dt-table-full"><div class="dt-head dt-head-full"><span>Date</span><span>Opération</span><span>Par</span></div>'
      + logRows + '</div></div>';
  }
  el.innerHTML = html;
}

function calesRegulApply() {
  var target = document.getElementById('cregTarget').value;
  var size = document.getElementById('cregSize').value;
  var sense = document.getElementById('cregSense').value;
  var qty = parseInt(document.getElementById('cregQty').value, 10);
  var note = (document.getElementById('cregNote').value || '').trim();
  var msgEl = document.getElementById('calesRegulMsg');
  if (!target || !size || isNaN(qty) || qty < 1) {
    if (msgEl) msgEl.innerHTML = '<span style="color:var(--danger);">Vérifiez la cible, la taille et la quantité.</span>';
    return;
  }
  if (sense === 'out') {
    var cur = calesRegulGet(target, size);
    if (cur < qty) {
      if (msgEl) msgEl.innerHTML = '<span style="color:var(--danger);">Sortie impossible : ' + cur + ' disponible en ' + calesRegulTargetLabel(target) + ' (' + size + 'mm).</span>';
      return;
    }
    calesRegulSet(target, size, cur - qty);
  } else {
    calesRegulSet(target, size, calesRegulGet(target, size) + qty);
  }
  saveToStorage(STORAGE_KEYS.calesMachines, calesMachines);
  safeSave(STORAGE_KEYS.stock, STOCK);
  var log = { target: target, size: size, sense: sense, qty: qty, note: note, by: (currentUser && currentUser.email) || 'admin', date: new Date().toLocaleString('fr-FR') };
  calesRegulLogs.unshift(log);
  saveToStorage(STORAGE_KEYS.calesRegul, calesRegulLogs);
  addAuditLog('Régularisation cales: ' + (sense === 'in' ? '+' : '−') + qty + ' × ' + size + 'mm → ' + calesRegulTargetLabel(target) + (note ? ' (' + note + ')' : ''));
  if (msgEl) msgEl.innerHTML = '<span style="color:var(--success);">' + MI('check_circle','mi-sm mi-green') + ' R\u00e9gularisation enregistr\u00e9e</span>';
  showToast('Régularisation cales enregistrée', 'success');
  renderCalesStockTable();
  renderCalesRegul();
}

/* ═══════════════════════════════════════════════
   OF LIST: filtrage, tri, sélection, export, PDF
   → Extrait vers modules/of-list-manager.js (Phase 2A)
   ═══════════════════════════════════════════════ */

/**
 * Création automatique de lot de séchage quand une réf SF atteint N pièces.
 * Appelé après ofPostSciageOutput. N est saisi manuellement dans le formulaire.
 * Fonction utilitaire appelable depuis validateGrumeA1 ou saveOrderEdit.

/* var formModalFallbackIntent — déplacé vers state.js */

function openFormModal(title, icon, bodyHtml, onOk, danger) {
  document.getElementById('formModalTitle').textContent = title;
  document.getElementById('formModalIcon').innerHTML = MI(icon || 'edit', 'mi-lg mi-blue');
  document.getElementById('formModalBody').innerHTML = bodyHtml;
  var okBtn = document.getElementById('formModalOkBtn');
  okBtn.classList.toggle('btn-danger', !!danger);
  okBtn.classList.toggle('btn-primary', !danger);
  okBtn.textContent = 'Valider';
  formModalFallbackIntent = onOk;
  document.getElementById('formModal').classList.add('open');
}

function closeFormModal() {
  document.getElementById('formModal').classList.remove('open');
  formModalFallbackIntent = null;
  if (typeof stopFardeauCamScan === 'function' && typeof frdScanState !== 'undefined' && frdScanState.active) {
    stopFardeauCamScan();
  }
}

function confirmFormModal() {
  if (typeof formModalFallbackIntent === 'function') formModalFallbackIntent();
  closeFormModal();
}

function exportData(format) {
  const data = { stock: STOCK, orders, counter: orderCounter, version: '6.1', date: new Date().toISOString() };
  let content, filename, type;
  
  if (format === 'json') {
    content = JSON.stringify(data, null, 2);
    filename = `gestion-decoupes-${new Date().toISOString().slice(0,10)}.json`;
    type = 'application/json';
  } else {
    let csv = 'Type,Ref,Date,Client,Référence,Quantité,Qté produite,Statut,Magasin PF,Magasin WIP,Début prévu,Fin prévue,Grume,Centrale,Laterales,Disques,Consommé,Chute,Remarques\n';
    orders.forEach(o => csv += `OF,"${o.orderNum}","${o.date}","${o.client || ''}","${o.reference || ''}",${o.qty || 0},${o.producedQty || 0},"${o.status || ''}","${o.fgWarehouse || ''}","${o.wipWarehouse || ''}","${o.plannedStart || ''}","${o.plannedEnd || ''}",${o.logWidth},${o.central},"${(o.laterals || []).join(';')}",${o.diskCount},${o.totalConsumed},${o.chute},"${(o.remarks || '').replace(/"/g, '""')}"\n`);
    csv += '\nStock\n';
    Object.entries(STOCK).forEach(([s, q]) => csv += `Cale,${s}mm,,${q}\n`);
    content = csv;
    filename = `gestion-decoupes-${new Date().toISOString().slice(0,10)}.csv`;
    type = 'text/csv';
  }
  
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`Export ${format.toUpperCase()}`, 'success');
}

function exportExcel() {
  const content = buildExcelContent();
  const filename = 'historique-OF-' + new Date().toISOString().slice(0, 10) + '.xls';
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
    try {
      window.Capacitor.Plugins.Filesystem.writeFile({
        path: filename,
        data: content,
        directory: 'DOCUMENTS',
        encoding: 'UTF8',
        recursive: true
      }).then(function() {
        showToast('Excel sauvegardé : ' + filename, 'success');
      }).catch(function(e) {
        errLog('app', 'exportFilesystem', e, 'warn');
        downloadExcelFallback(content, filename);
      });
      return;
    } catch (e) {
      errLog('app', 'exportFilesystem write', e, 'warn');
      downloadExcelFallback(content, filename);
      return;
    }
  }
  downloadExcelFallback(content, filename);
}

function downloadExcelFallback(content, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Excel ' + orders.length + ' OF', 'success');
}

function importData() { document.getElementById('importFile').click(); }

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  showModal('Importer', 'Remplacer les données actuelles ?', '📥', () => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.stock && typeof d.stock === 'object' && !Array.isArray(d.stock)) { STOCK = d.stock; safeSave(STORAGE_KEYS.stock, STOCK); }
        if (d.orders && Array.isArray(d.orders)) { orders = d.orders; safeSave(STORAGE_KEYS.orders, orders); fsSave('orders', orders); }
        if (typeof d.counter === 'number') { orderCounter = d.counter; safeSave(STORAGE_KEYS.counter, orderCounter); }
        currentOrderA = bestOrderForLine('A');
        currentOrderB = bestOrderForLine('B');
        renderAll();
        syncToAllTabs();
        showToast('Données importées', 'success');
      } catch { showToast('Format invalide', 'error'); }
    };
    reader.readAsText(file);
  });
  e.target.value = '';
}

// (bloc variable deplacé vers data.js — ligne source 2358)

function openTool(tool) {
  ['calculator', 'notepad', 'converter', 'timer', 'volume', 'credits'].forEach(t => {
    document.getElementById(`tool${t.charAt(0).toUpperCase() + t.slice(1)}`).style.display = 'none';
  });
  
  if (activeTool === tool) {
    activeTool = null;
    return;
  }
  
  activeTool = tool;
  const toolEl = document.getElementById(`tool${tool.charAt(0).toUpperCase() + tool.slice(1)}`);
  toolEl.style.display = 'block';
  toolEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  if (tool === 'notepad') loadNotepad();
  if (tool === 'credits') {
    const year = new Date().getFullYear();
    document.getElementById('creditsYear').textContent = year;
    document.getElementById('creditsYear2').textContent = year;
  }
}

// (bloc variable deplacé vers data.js — ligne source 2383)
// (bloc variable deplacé vers data.js — ligne source 2384)

function loadNotepad() {
  const saved = loadFromStorage(STORAGE_KEYS.notepad, '');
  document.getElementById('notepadText').value = saved;
}

function saveNotepad() {
  const text = document.getElementById('notepadText').value;
  safeSave(STORAGE_KEYS.notepad, text);
  showToast('Notes sauvegardées', 'success');
}

function clearNotepad() {
  showModal('Effacer', 'Effacer toutes les notes ?', '🗑️', () => {
    document.getElementById('notepadText').value = '';
    localStorage.removeItem(STORAGE_KEYS.notepad);
    showToast('Notes effacées', 'info');
  });
}

// (bloc variable deplacé vers data.js — ligne source 2555)
// (bloc variable deplacé vers data.js — ligne source 2556)
// (bloc variable deplacé vers data.js — ligne source 2557)
// (bloc variable deplacé vers data.js — ligne source 2558)
// (bloc variable deplacé vers data.js — ligne source 2559)

function calculateLogVolume() {
  const d = parseFloat(document.getElementById('volDiameter').value);
  const l = parseFloat(document.getElementById('volLength').value);
  const n = parseInt(document.getElementById('volCount').value, 10) || 1;
  const resultEl = document.getElementById('volumeResult');

  if (isNaN(d) || isNaN(l) || d <= 0 || l <= 0) {
    resultEl.textContent = 'Renseignez le diamètre et la longueur.';
    return;
  }
  /* Moteur volumétrique canonique (cylindre petit-bout) — modules/sciage-logic.js.
     `d` est saisi en mm ; calcVolumeGrume attend le diamètre en cm. */
  const unitVolume = calcVolumeGrume(d / 10, l);
  const totalVolume = unitVolume * n;
  resultEl.innerHTML = `
    <strong>${unitVolume.toFixed(4)} m³</strong> par grume<br>
    ${n > 1 ? `<strong>${totalVolume.toFixed(4)} m³</strong> pour ${n} grumes` : ''}
  `;
}

/* ═══════════════════════════════════════════════
   MODULE 2: MATIERES PREMIERES (Grumes)
   ═══════════════════════════════════════════════ */
/* MODULE PRODUCTION - Compteurs lignes */
// (bloc variable deplacé vers data.js — ligne source 2634)

function validerOperation(ligne, machine) {
  if (!prodCounters[ligne]) prodCounters[ligne] = {};
prodCounters[ligne][machine] = (prodCounters[ligne][machine] || 0) + 1;
      saveToStorage('charben_prod_counters', prodCounters);
      if (typeof fsSave === 'function') fsSave('prodCounters', prodCounters);
  renderLigne(ligne);
  renderLucide();
  showToast('Opération validée ' + machine, 'success');
}

/* ═══════════════════════════════════════════════
   LANCEMENT DES GRUMES MP SUR LE PLAN FLUX
   - Bouton sur le logo Grume : lance une grume MP (réf code)
   - Synchronisation par largeur : Ø cm × 10 = largeur mm vs largeur OF
   - Compteurs par OF : grumes lancées / validées A1
   - Validation : confirme que la découpe est passée par A1
   ═══════════════════════════════════════════════ */
// (bloc variable deplacé vers data.js — ligne source 2655)
// (bloc variable deplacé vers data.js — ligne source 2656)
// (bloc variable deplacé vers data.js — ligne source 2657)

/* var camScanState — déplacé vers state.js */

function toggleGrumeCamScan(line) {
  var box = document.getElementById('grumeCamScan' + line);
  if (!box) return;
  if (box.style.display === 'none') {
    box.style.display = 'block';
    startGrumeCamScan(line);
  } else {
    stopGrumeCamScan();
    box.style.display = 'none';
  }
}

function startGrumeCamScan(line) {
  var status = document.getElementById('grumeCamStatus' + line);
  var video = document.getElementById('grumeCamVideo' + line);
  if (!video) return;
  stopGrumeCamScan();
  camScanState.line = line;
  if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Permissions) {
    Capacitor.Plugins.Permissions.request({ name: 'camera' }).catch(function() {});
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (status) status.innerHTML = '<span style="color:var(--red,#ef4444);">Caméra non disponible (mode bureau) — utilisez la saisie manuelle</span>';
    return;
  }
  status.innerHTML = 'Démarrage de la caméra…';
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(function(stream) {
      camScanState.stream = stream;
      video.srcObject = stream;
      video.setAttribute('autoplay', 'true');
      video.play().catch(function() {});
      if (status) status.innerHTML = MI('qr_code_scanner','mi-sm') + ' Pointez le QR de la grume dans le cadre\u2026';
      scanQrLoop(line, video, status);
    })
    .catch(function(err) {
      if (status) status.innerHTML = '<span style="color:var(--red,#ef4444);">Caméra refusée (' + (err && err.name || 'erreur') + ') — utilisez la saisie manuelle</span>';
      showToast('Caméra indisponible — utilisez la saisie manuelle', 'warning');
    });
}

function validateGrumeA1(line, code) {
  var st = lineLaunchState(line);
  var g = (st.launched || []).find(function(x) { return x.code === code; });
  if (!g || g.validatedAt) return;
  var oProg = getLineOrder(line);
  /* === GATE CUTTING-ENGINE (étape 3) ===
     Aucune entrée WIP si la découpe est refusée : classe hors [250,560] mm
     ou bilan matière déséquilibré. Le canal canonique (importGrumeToWip) n'est
     jamais atteint pour une grume rejetée. */
  if (typeof cuttingEngine !== 'undefined' && cuttingEngine && typeof cuttingEngine.evaluerGrume === 'function') {
    var gmGate = rawMaterials.find(function(x) { return x.code === code; })
      || { code: code, diametre: g.diametreCm || 0, longueur: g.longueur || 0 };
    var evGate = cuttingEngine.evaluerGrume(gmGate, oProg);
    if (!evGate || !evGate.ok) {
      var resumeGate = (evGate && evGate.resume) || ('Import WIP refusé pour ' + code);
      addAuditLog('Import WIP bloqué cutting-engine: ' + code + ' — ' + resumeGate);
      showToast(resumeGate + ' — sortie WIP annulée', 'error');
      return;
    }
  }
  g.validatedAt = new Date().toISOString();
  var mp = rawMaterials.find(function(x) { return x.code === code; });
  if (mp && mp.statut === 'EN_COURSE') {
    mp.statut = 'CONSOMME';
    mp.consumedAt = new Date().toISOString();
    saveToStorage('charben_raw', rawMaterials);
    fsSave('raw', rawMaterials);
  }
  if (oProg && oProg.status !== 'realise' && oProg.status !== 'annule' && oProg.qty > 0) {
    oProg.producedGrumes = (oProg.producedGrumes || 0) + 1;
    var yieldP = oProg.diskCount || (2 * (1 + (oProg.laterals || []).length) + 1);
    oProg.producedQty = (oProg.producedGrumes || 0) * yieldP;
    var ofDone = oProg.producedQty >= oProg.qty;
    if (ofDone) {
      oProg.status = 'realise';
      if (!oProg.actualEnd) oProg.actualEnd = new Date().toISOString();
    }
    safeSave(STORAGE_KEYS.orders, orders);
    fsSave('orders', orders);
    syncToAllTabs();
    if (ofDone && typeof ofPostSciageOutput === 'function') ofPostSciageOutput(oProg);
  }
  if (oProg && typeof importGrumeToWip === 'function') {
    try { importGrumeToWip(oProg, code); } catch (e) { errLog('sciage', 'importGrumeToWip', e); errUser('Sortie WIP non enregistrée pour la grume ' + code, 'Sciage A1'); }
  }
  saveLineLaunch();
  if (typeof sciagePiecesPerGrume === 'function' && oProg) {
    try {
      var spp = sciagePiecesPerGrume(oProg);
      if (!prodCounters[line]) prodCounters[line] = {};
      ['A1', 'A2', 'A3', 'A4'].forEach(function(key) {
        var mac = line + key.charAt(1);
        prodCounters[line][mac] = (prodCounters[line][mac] || 0) + (spp[key] || 0);
      });
      saveToStorage('charben_prod_counters', prodCounters);
      if (typeof fsSave === 'function') fsSave('prodCounters', prodCounters);
    } catch (e) { errLog('sciage', 'compteurPieces', e); errUser('Compteur de pièces non mis à jour', 'Sciage A1'); }
  }
  addAuditLog('D\u00e9coupe valid\u00e9e A1 ligne ' + line + ': grume ' + code);
  renderLigne(line);
  renderLucide();
  renderGrumes();
  renderDashboardKPIs();
  if (typeof renderWipMatrix === 'function') renderWipMatrix();
  if (typeof renderWipList === 'function') renderWipList();
  showToast('Grume valid\u00e9e A1 : ' + code, 'success');
}

function toggleGrumeLauncher(line) {
  var panel = document.getElementById('grumeLauncher' + line);
  if (!panel) return;
  var show = panel.style.display === 'none';
  panel.style.display = show ? 'block' : 'none';
  if (show) renderGrumeLauncher(line);
}

// (bloc variable deplacé vers data.js — ligne source 2724)

function renderGrumeLauncher(line) {
  var panel = document.getElementById('grumeLauncher' + line);
  if (!panel) return;
  var o = getLineOrder(line);
  if (!o) {
    panel.innerHTML = '<div class="empty-state"><div class="empty-state-icon">' + MI('info','mi-xl mi-muted') + '</div><div class="empty-state-text">Aucun OF en cours pour la ligne ' + line + '</div></div>';
    return;
  }
  var ofW = parseFloat(o.logWidth) || 0;
  var avail = rawMaterials.filter(function(g) { return g.statut === 'EN_STOCK'; });
  if (!avail.length) {
    panel.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🪵</div><div class="empty-state-text">Aucune grume en stock sur MP (Mati\u00e8res Premi\u00e8res)</div></div>';
    return;
  }
  var widths = [];
  avail.forEach(function(g) { var gw = grumeWidthMm(g); if (widths.indexOf(gw) === -1) widths.push(gw); });
  widths.sort(function(a, b) { return a - b; });
  var html = '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">Sync largeur : grume (\u00d8 cm × 10) vs largeur OF <b>' + ofW + 'mm</b> — tol\u00e9rance ±' + LAUNCH_WIDTH_TOLERANCE + 'mm.</div>';
  html += '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">';
  html += '<input id="grumeSearchText' + line + '" class="form-input" style="flex:1;min-width:130px;" placeholder="Saisir lettre ou r\u00e9f (ex : G, GR-2026)\u2026" oninput="grumeSearchInput(\'' + line + '\')">';
  html += '<select id="grumeSearchWidth' + line + '" class="form-input" style="flex:0 0 auto;" onchange="grumeSearchWidth(\'' + line + '\')">';
  html += '<option value="">Toutes largeurs</option>';
  widths.forEach(function(w) { html += '<option value="' + w + 'mm">' + w + 'mm</option>'; });
  html += '</select>';
  html += '</div>';
  html += '<div id="grumeResults' + line + '" style="max-height:230px;overflow-y:auto;margin-bottom:8px;"></div>';
  html += '<button id="grumeConfirmBtn' + line + '" class="btn btn-sm btn-success" style="width:100%;padding:8px;" disabled onclick="confirmGrumeSelection(\'' + line + '\')">\u2705 Valider la s\u00e9lection</button>';
  panel.innerHTML = html;
  renderGrumeLauncherResults(line);
}

// (bloc variable deplacé vers data.js — ligne source 2868)
// (bloc variable deplacé vers data.js — ligne source 2869)
// (bloc variable deplacé vers data.js — ligne source 2881)
// (bloc variable deplacé vers data.js — ligne source 2894)
// (bloc variable deplacé vers data.js — ligne source 2898)

/* ==== SUGGESTIONS INTELLIGENTES DE DÉBIT ====
   Dénominations selon les normes scierie (AFNOR B53-001 à 53-014) :
   - Madrier  : rapport largeur/épaisseur 2 à 3 (ex. 63×175, 75×200, 100×225)
   - Chevron  : section carrée ou sensiblement carrée, côté 40 à 125mm (ex. 75×75, 63×75)
   - Bastaing : rapport 2 à 3, épaisseurs 50-63mm
   - Planche  : rapport ≥ 4, épaisseur 25 à 40mm
   - Volige   : rapport ≥ 4, épaisseur ≤ 22mm
   - Poutre   : section carrée, côté > 120mm */
// (bloc variable deplacé vers data.js — ligne source 2925)

// (bloc variable deplacé vers data.js — ligne source 2958)

function suggestCutPlans(essence, logWidth, opts) {
  opts = opts || {};
  const marginRaw = (opts.margin === undefined || opts.margin === null || opts.margin === '') ? DEFAULT_SAFETY_MARGIN : parseFloat(opts.margin);
  const margin = Math.max(0, isNaN(marginRaw) ? DEFAULT_SAFETY_MARGIN : marginRaw);
  const mode = opts.mode || 'auto';
  const usableW = usableWidth(logWidth, margin);
  const data = (GAMME_ESSENCES[essence] || GAMME_ESSENCES.spruce).data;
  const hs = Object.keys(data).map(Number).sort(function(a, b) { return b - a; });
  const A2 = MACHINE_SPECS.A2, A3 = MACHINE_SPECS.A3;
  const plans = [];
  const seen = {};

  hs.forEach(function(Hc) {
    if (!(data[Hc].cc && data[Hc].cc.length)) return;
    const ccWs = data[Hc].cc.slice().sort(function(a, b) { return b - a; });
    ccWs.forEach(function(Bc) {
      const n = Math.floor(usableW / (Bc + DISK_THICKNESS));
      if (n < 1) return;
      if (Hc > A2.openingH) return;
      const usedCC = n * Bc + (n - 1) * DISK_THICKNESS;
      if (usedCC > A2.arbor) return;
      const latCands = hs.filter(function(h) { return h < Hc && (data[h].sb || []).length; });

      function bestWidths(Hl) {
        const ws = data[Hl].sb.slice().sort(function(a, b) { return b - a; });
        return ws.slice(0, 3);
      }

      function tryLats(lats) {
        let ccB2 = null;
        let nEff = n;
        const restCC = usableW - usedCC;
        const row2 = data[Hc];
        if (row2 && row2.cc && row2.cc.length) {
          if (restCC >= 20) {
            const cands2 = row2.cc.slice().filter(function(w) { return w < Bc && w <= restCC - DISK_THICKNESS; }).sort(function(a, b) { return b - a; });
            if (cands2.length) ccB2 = cands2[0];
          } else if (n >= 2) {
            const space = usableW - (n - 1) * Bc - (n - 2) * DISK_THICKNESS - DISK_THICKNESS;
            const cands2 = row2.cc.slice().filter(function(w) { return w < Bc && w <= space; }).sort(function(a, b) { return b - a; });
            if (cands2.length) { ccB2 = cands2[0]; nEff = n - 1; }
          }
        }
        const key = Hc + 'x' + Bc + 'n' + nEff + (ccB2 ? '+x' + ccB2 : '') + '|' + lats.map(function(l) { return l.h + 'x' + l.b; }).join(',');
        if (seen[key]) return;
        seen[key] = true;
        const kerfsA1 = (lats.length + 1) * DISK_THICKNESS + DISK_THICKNESS / 2;
        const latSum = lats.reduce(function(a, l) { return a + l.h; }, 0);
        const outerRings = 280 - kerfsA1 - Hc - latSum;
        if (outerRings < 0) return;
        const diskCount = 2 * (1 + lats.length) + 1;
        const totalConsumed = 2 * (Hc + latSum) + diskCount * DISK_THICKNESS;
        if (totalConsumed > logWidth) return;
        let valid = true;
        const latsInfo = lats.map(function(l) {
          const nl = Math.floor(usableW / (l.b + DISK_THICKNESS));
          if (nl < 1) { valid = false; return null; }
          const stk = nl * l.b + (nl - 1) * DISK_THICKNESS;
          if (l.h > A3.openingH || stk > A3.arbor) { valid = false; return null; }
          return { h: l.h, b: l.b, n: nl, chute: +(logWidth - stk).toFixed(1) };
        });
        if (!valid) return;
        let volume = Hc * Bc * nEff + (ccB2 ? Hc * ccB2 : 0);
        latsInfo.forEach(function(l) { volume += l.h * l.b * l.n; });
        const volDenom = usableW * (Hc + latSum);
        const usedEff = nEff * Bc + (nEff - 1) * DISK_THICKNESS + (ccB2 ? DISK_THICKNESS + ccB2 : 0);
        const plan = {
          essence: essence, logWidth: logWidth, margin: margin, usableW: +usableW.toFixed(1),
          centralH: Hc, centralB: Bc, nCC: nEff, ccUsed: usedEff,
          ccChute: +(logWidth - usedEff).toFixed(1),
          ccB2: ccB2,
          ccB2Design: ccB2 ? pieceDesignation(Hc, ccB2) : null,
          laterals: latsInfo, outerRings: +outerRings.toFixed(1),
          diskCount: diskCount, totalConsumed: totalConsumed,
          chute: +(logWidth - totalConsumed).toFixed(2),
          volume: volume,
          yieldPct: volDenom > 0 ? Math.round(volume / volDenom * 1000) / 10 : 0
        };
        plan.ccDesign = pieceDesignation(Hc, Bc);
        plan.latDesigns = latsInfo.map(function(l) { return pieceDesignation(l.h, l.b); });
        let score = volume;
        if (ccB2) score += 150;
        if (ccB2 && nEff < n) score += Bc * Hc + 300;
        if (mode === 'madrier') {
          const r = Bc / Hc;
          if (r >= 2 && r <= 3) score += 600;
          if (r >= 0.8 && r <= 1.3) score += 300;
          score -= plan.ccChute * 1.5;
        } else if (mode === 'rendement') {
          score -= plan.chute * 3;
          score += usedEff * 1.2;
        } else {
          score -= plan.chute * 2;
        }
        plan.score = Math.round(score);
        buildPlanHelp(plan, mode, data);
        plans.push(plan);
      }

      tryLats([]);
      if (latCands.length) {
        latCands.forEach(function(Hl) {
          bestWidths(Hl).forEach(function(Bl) { tryLats([{ h: Hl, b: Bl }]); });
        });
      }
      if (latCands.length >= 2) {
        latCands.forEach(function(Hl1) {
          latCands.forEach(function(Hl2) {
            if (Hl2 > Hl1) return;
            bestWidths(Hl1).forEach(function(Bl1) {
              bestWidths(Hl2).forEach(function(Bl2) { tryLats([{ h: Hl1, b: Bl1 }, { h: Hl2, b: Bl2 }]); });
            });
          });
        });
      }
    });
  });

  plans.sort(function(a, b) { return b.score - a.score; });
  lastSuggestions = plans.slice(0, 5);
  return { plans: lastSuggestions, total: plans.length };
}

function renderSuggestPanel(containerId, formType) {
  const el = document.getElementById(containerId);
  if (!el) return;
  var prefillGW = '';
  if (formType === 'of' && document.getElementById('ofLogWidth')) prefillGW = document.getElementById('ofLogWidth').value;
  else if (formType === 'pp') {
    var ccV = readPpCcValues();
    var sbV = readPpSbValues();
    if (ccV.length + sbV.length > 0) {
      var pcN = ccV.length + sbV.length;
      var totW = (ccV.reduce(function(a, b) { return a + b; }, 0) + sbV.reduce(function(a, b) { return a + b; }, 0)) * 2 + (2 * pcN + 1) * DISK_THICKNESS;
      if (totW > 0 && totW <= MAX_LOG_WIDTH) prefillGW = Math.round(totW * 10) / 10;
    }
  }
  el.innerHTML =
    '<details class="card no-print" style="margin-top:16px;padding:0;overflow:hidden;">' +
    '<summary style="cursor:pointer;padding:12px 16px;font-size:13px;font-weight:700;list-style:none;">🧠 Suggestion intelligente de débit <span style="font-weight:600;color:var(--text-muted);">(catalogue Pin/Épicéa + limites machines + marge de sécurité)</span></summary>' +
    '<div style="padding:12px 16px 14px;">' +
    '<div class="form-grid form-grid-2">' +
    '<div class="form-group"><label class="form-label">Largeur de grume (mm)</label>' +
    '<input type="number" class="form-input" id="' + formType + 'SuggestLogWidth" value="' + escapeHtml(String(prefillGW)) + '" min="1" max="' + MAX_LOG_WIDTH + '" step="any" placeholder="Ex : 300"></div>' +
    '<div class="form-group"><label class="form-label">Mode de suggestion</label>' +
    '<select class="form-input" id="' + formType + 'SuggestMode">' +
    '<option value="auto">Auto (équilibré)</option>' +
    '<option value="rendement">Rendement max</option>' +
    '<option value="madrier">Madrier + chevron</option>' +
    '</select></div>' +
    '<div class="form-group"><label class="form-label">Marge sécurité (mm / côté)</label>' +
    '<input type="number" class="form-input" id="' + formType + 'SuggestMargin" value="' + DEFAULT_SAFETY_MARGIN + '" min="0" max="30" step="1"></div>' +
    '</div>' +
    '<button class="btn btn-primary btn-block" onclick="runSuggestions(\'' + formType + '\')">🧠 Générer les suggestions</button>' +
    '<div id="' + formType + 'SuggestResults" style="margin-top:12px;"></div>' +
    '</div></details>';
}

function runSuggestions(formType) {
  const isOf = formType === 'of';
  const marginEl = document.getElementById(formType + 'SuggestMargin');
  const modeEl = document.getElementById(formType + 'SuggestMode');
  const margin = marginEl ? parseFloat(marginEl.value) : DEFAULT_SAFETY_MARGIN;
  const mode = modeEl ? modeEl.value : 'auto';
  const resEl = document.getElementById(formType + 'SuggestResults');
  if (!resEl) return;
  const essSel = document.getElementById(isOf ? 'ofEssence' : 'ppEssence');
  const essence = (essSel && GAMME_ESSENCES[essSel.value]) ? essSel.value : gammeEssence();
  const logWidthEl = document.getElementById(formType + 'SuggestLogWidth');
  let logWidth = parseFloat(logWidthEl ? logWidthEl.value : '');
  if ((!logWidth || logWidth <= 0) && !isOf) {
    const ccV = readPpCcValues();
    const sbV = readPpSbValues();
    if (ccV.length + sbV.length > 0) {
      const totW = (ccV.reduce(function(a, b) { return a + b; }, 0) + sbV.reduce(function(a, b) { return a + b; }, 0)) * 2 + (2 * (ccV.length + sbV.length) + 1) * DISK_THICKNESS;
      if (totW > 0 && totW <= MAX_LOG_WIDTH) logWidth = totW;
    }
  }
  if (!logWidth || logWidth <= 0) {
    resEl.innerHTML = '<div class="warning-box">Renseignez d\u2019abord la largeur de grume (mm) dans le panneau de suggestion.</div>';
    return;
  }
  if (logWidth > MAX_LOG_WIDTH) {
    resEl.innerHTML = '<div class="warning-box">Grume > ' + MAX_LOG_WIDTH + 'mm non supportée.</div>';
    return;
  }
  if (2 * margin >= logWidth) {
    resEl.innerHTML = '<div class="warning-box">Marge de sécurité trop grande (' + margin + 'mm × 2) pour une grume de ' + logWidth + 'mm — réduisez la marge.</div>';
    return;
  }
  const result = suggestCutPlans(essence, logWidth, { mode: mode, margin: margin });
  resEl.innerHTML = renderSuggestionResults(result, essence, formType);
}

function renderSuggestionResults(result, essence, formType) {
  const essLabel = GAMME_ESSENCES[essence] ? GAMME_ESSENCES[essence].label : essence;
  if (!result.plans.length) {
    return '<div class="warning-box">Aucun plan de coupe possible pour cette grume (' + result.logWidth + 'mm) en ' + escapeHtml(essLabel) + '.<br>Conseils : réduisez la marge de sécurité, ou choisissez des pièces plus étroites.</div>';
  }
  let html = '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">' + result.total + ' plan(s) validé(s) · Essence ' + escapeHtml(essLabel) + '</div>';
  result.plans.forEach(function(p, idx) {
    html += '<div class="flux-fiche" style="margin-bottom:10px;padding:10px 12px;background:var(--bg-card, rgba(255,255,255,.04));border:1px solid var(--border-color);border-radius:12px;">';
    html += '<div style="font-size:12px;font-weight:700;margin-bottom:6px;">' + (idx + 1) + '. ' + escapeHtml(p.ccDesign) + ' ×' + p.nCC + (p.laterals.length ? ' + ' + p.laterals.map(function(l) { return escapeHtml(pieceDesignation(l.h, l.b)) + ' ×' + l.n; }).join(' + ') : '') + '</div>';
    html += '<table class="result-table">' +
      '<tr><td>Centre (A2 — Scie CC)</td><td><b>' + p.nCC + ' × ' + p.centralH + '×' + p.centralB + 'mm</b> · ' + escapeHtml(p.ccDesign) + (p.ccB2 ? ' <b>+ 1 × ' + p.centralH + '×' + p.ccB2 + 'mm</b> (' + escapeHtml(p.ccB2Design) + ')' : '') + '</td></tr>';
    p.laterals.forEach(function(l, i) {
      html += '<tr><td>Latérale ' + (i + 1) + ' (A3 — Déligneuse)</td><td><b>' + l.n + ' × ' + l.h + '×' + l.b + 'mm</b> · ' + escapeHtml(pieceDesignation(l.h, l.b)) + (ARBORS_PER_SAW > 1 ? ' (' + ARBORS_PER_SAW + ' arbres)' : '') + '</td></tr>';
    });
    html += '<tr><td>Rendement</td><td><b>' + p.yieldPct + '%</b> · chute ' + p.chute + 'mm → A4</td></tr>' +
      '<tr><td>Arbre A1</td><td>' + (ARBORS_PER_SAW > 1 ? ARBORS_PER_SAW + ' arbres · ' : '') + 'centre ' + p.centralH + ' + lat ' + p.laterals.map(function(l) { return l.h; }).join(',') + ' · complément ' + p.outerRings + 'mm</td></tr>';
    if (p.margin > 0) html += '<tr><td>Marge sécurité</td><td>' + p.margin + 'mm × 2 → largeur utile ' + p.usableW + 'mm</td></tr>';
    html += '</table>';
    p.help.forEach(function(h) {
      html += '<div style="font-size:11px;line-height:1.5;color:var(--text-secondary);margin-top:4px;">' + escapeHtml(h) + '</div>';
    });
    p.warnings.forEach(function(w) {
      html += '<div class="warning-box" style="margin-top:6px;">' + escapeHtml(w) + '</div>';
    });
    html += '<button class="btn btn-sm btn-success" style="margin-top:8px;" onclick="applySuggestion(' + idx + ', \'' + formType + '\')">' + MI('check','mi-sm mi-green') + ' Appliquer ce plan</button>';
    html += '</div>';
  });
  return html;
}

function setInputVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function applySuggestion(idx, formType) {
  const p = lastSuggestions[idx];
  if (!p) return;
  if (formType === 'of') {
    setInputVal('ofEssence', p.essence);
    setInputVal('ofLogWidth', p.logWidth);
    setInputVal('ofCentralThickness', p.centralH);
    setInputVal('ofCenterWidth', p.centralB);
    setInputVal('ofMargin', p.margin);
    lateralCount = Math.max(1, p.laterals.length);
    renderLateralInputs();
    p.laterals.forEach(function(l, i) {
      setInputVal('lat' + i, l.h);
      setInputVal('latW' + i, l.b);
    });
    showToast('Suggestion appliquée au formulaire OF', 'success');
  } else {
    setInputVal('ppEssence', p.essence);
    const extraCc = p.ccB2 ? 1 : 0;
    const totCc = p.nCC + extraCc;
    setInputVal('ppCentral', p.centralH);
    setInputVal('ppCentral2', totCc >= 2 ? p.centralH : '');
    const secCc = document.getElementById('ppSecondaryCc');
    if (secCc) secCc.style.display = totCc >= 2 ? '' : 'none';
    const addCcBtn = document.getElementById('ppAddCcBtn');
    if (addCcBtn) addCcBtn.textContent = totCc >= 2 ? '\u2212 Retirer CC 2 secondaire' : '+ CC 2 secondaire';
    ['ppSb1', 'ppSb2'].forEach(function(id, i) {
      setInputVal(id, (i < p.laterals.length && p.laterals[i]) ? p.laterals[i].h : '');
    });
    const secSb = document.getElementById('ppSecondarySb');
    if (secSb) secSb.style.display = p.laterals.length >= 2 ? '' : 'none';
    const addSbBtn = document.getElementById('ppAddSbBtn');
    if (addSbBtn) addSbBtn.textContent = p.laterals.length >= 2 ? '\u2212 Retirer SB 2 secondaire' : '+ SB 2 secondaire';
    setInputVal('ppLaterals', p.laterals.map(function(l) { return l.h; }).join(';'));
    setInputVal('ppMargin', p.margin);
    const prefix = ((document.getElementById('ppLine') || {}).value === 'B') ? 'B' : 'A';
    selectPpMachine(prefix + '2');
    for (let c = 1; c <= 2; c++) setInputVal('ppCcw' + c, c === 1 ? p.centralB : (c === 2 ? (p.nCC >= 2 ? p.centralB : (extraCc ? p.ccB2 : '')) : ''));
    selectPpMachine(prefix + '3');
    p.laterals.slice(0, 2).forEach(function(l, i) { setInputVal('ppSbw' + (i + 1), l.b); });
    selectPpMachine(prefix + '1');
    const gwEl = document.getElementById(formType + 'SuggestLogWidth');
    if (gwEl && !gwEl.value) gwEl.value = p.logWidth;
    updatePpGrumePreview();
    showToast('Suggestion appliquée au nouvel ordre de production', 'success');
  }
}

function renderGammePin() {
  const el = document.getElementById('gammePinTable');
  if (!el) return;
  const sel = document.getElementById('gammeEssenceSel');
  if (sel && sel.options.length === 0) {
    Object.keys(GAMME_ESSENCES).forEach(function(k) {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = GAMME_ESSENCES[k].label;
      sel.appendChild(opt);
    });
  }
  const essence = gammeEssence();
  if (sel) sel.value = essence;
  const data = GAMME_ESSENCES[essence].data;
  let html = '<table class="result-table" style="width:100%;font-size:11px;">';
  html += '<tr><td style="font-weight:700;">H \\ B (mm)</td>' + GAMME_PIN_WIDTHS.map(function(w) { return '<td style="font-weight:700;text-align:center;">' + w + '</td>'; }).join('') + '</tr>';
  Object.keys(data).forEach(function(h) {
    const row = data[h];
    html += '<tr><td style="font-weight:700;">' + h + '</td>';
    GAMME_PIN_WIDTHS.forEach(function(w) {
      const sb = row.sb.indexOf(w) >= 0;
      const cc = row.cc.indexOf(w) >= 0;
      let cell, cls;
      if (sb && cc) { cell = 'SB/CC'; cls = 'gpm-mix'; }
      else if (sb) { cell = 'SB'; cls = 'gpm-sb'; }
      else if (cc) { cell = 'CC'; cls = 'gpm-cc'; }
      else { cell = '—'; cls = 'gpm-no'; }
      html += '<td class="' + cls + '" style="text-align:center;border:1px solid var(--border-color);padding:2px 4px;border-radius:4px;">' + cell + '</td>';
    });
    html += '</tr>';
  });
  html += '</table>';
  html += '<div style="margin-top:8px;font-size:11px;color:var(--text-secondary);">' +
    '<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#3b82f6;margin-right:4px;"></span>SB · Side Board' +
    '&nbsp;&nbsp;<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#10b981;margin-right:4px;"></span>CC · Center' +
    '&nbsp;&nbsp;<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#f59e0b;margin-right:4px;"></span>SB/CC mixte' +
    '&nbsp;&nbsp;<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:rgba(128,128,128,.3);margin-right:4px;"></span>Non disponible</div>';
  el.innerHTML = html;
  renderGammeSuggestions();
}

function gammeEssenceChange() {
  const sel = document.getElementById('gammeEssenceSel');
  if (sel) saveToStorage(GAMME_ESSENCE_KEY, sel.value);
  renderGammePin();
  renderGammeSuggestions();
  populateGammeSelects();
}

function onPpEssenceChange() {
  populateGammeSelects();
  if (typeof updatePpGrumePreview === 'function') updatePpGrumePreview();
}

function populateGammeSelects() {
  var essSel = document.getElementById('ppEssence');
  var essence = essSel && GAMME_ESSENCES[essSel.value] ? essSel.value : gammeEssence();
  var data = (GAMME_ESSENCES[essence] || GAMME_ESSENCES.spruce).data;
  var thicknesses = Object.keys(data).map(Number).sort(function(a, b) { return b - a; });
  var ccT = thicknesses.filter(function(h) { return data[h].cc && data[h].cc.length; });
  var sbT = thicknesses.filter(function(h) { return data[h].sb && data[h].sb.length; });
  fillSelect('ppCentral', ccT);
  fillSelect('ppCentral2', ccT);
  fillSelect('ppSb1', sbT);
  fillSelect('ppSb2', sbT);
  ['ppCcw1','ppCcw2','ppSbw1','ppSbw2'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="">Choisir épaisseur</option>';
  });
  ['ppCcWidthWrap1','ppCcWidthWrap2','ppSbWidthWrap1','ppSbWidthWrap2'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  ['ccBadge1','ccBadge2','sbBadge1','sbBadge2','ccGammeBadge','sbGammeBadge'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function fillSelect(id, values) {
  var el = document.getElementById(id);
  if (!el) return;
  var prev = el.value;
  var html = '<option value="">— Choisir —</option>';
  values.forEach(function(v) {
    html += '<option value="' + v + '"' + (String(prev) === String(v) ? ' selected' : '') + '>' + v + ' mm</option>';
  });
  el.innerHTML = html;
}

function onThicknessChange(type, num) {
  var essSel = document.getElementById('ppEssence');
  var essence = essSel && GAMME_ESSENCES[essSel.value] ? essSel.value : gammeEssence();
  var data = (GAMME_ESSENCES[essence] || GAMME_ESSENCES.spruce).data;
  var thicknessId = type === 'cc' ? (num === 1 ? 'ppCentral' : 'ppCentral2') : (num === 1 ? 'ppSb1' : 'ppSb2');
  var widthId = type === 'cc' ? (num === 1 ? 'ppCcw1' : 'ppCcw2') : (num === 1 ? 'ppSbw1' : 'ppSbw2');
  var widthBId = type === 'cc' ? (num === 1 ? 'ppCcwB1' : 'ppCcwB2') : (num === 1 ? 'ppSbwB1' : 'ppSbwB2');
  var wrapId = type === 'cc' ? (num === 1 ? 'ppCcWidthWrap1' : 'ppCcWidthWrap2') : (num === 1 ? 'ppSbWidthWrap1' : 'ppSbWidthWrap2');
  var wrapBId = type === 'cc' ? (num === 1 ? 'ppCcWidthWrapB1' : 'ppCcWidthWrapB2') : (num === 1 ? 'ppSbWidthWrapB1' : 'ppSbWidthWrapB2');
  var badgeId = type + 'Badge' + num;
  var thicknessEl = document.getElementById(thicknessId);
  var widthEl = document.getElementById(widthId);
  var widthBEl = document.getElementById(widthBId);
  var wrapEl = document.getElementById(wrapId);
  var wrapBEl = document.getElementById(wrapBId);
  var badgeEl = document.getElementById(badgeId);
  if (!thicknessEl || !widthEl) return;
  var h = parseFloat(thicknessEl.value);
  if (!h || !data[h]) {
    widthEl.innerHTML = '<option value="">Choisir épaisseur</option>';
    if (widthBEl) widthBEl.innerHTML = '<option value="">Choisir épaisseur d\'abord</option>';
    if (wrapEl) wrapEl.style.display = 'none';
    if (wrapBEl) wrapBEl.style.display = 'none';
    if (badgeEl) badgeEl.style.display = 'none';
    validateGammeSelection();
    return;
  }
  var widths = type === 'cc' ? (data[h].cc || []) : (data[h].sb || []);
  widths = widths.slice().sort(function(a, b) { return b - a; });
  var htmlA = '';
  var htmlB = '<option value="">— Choisir largeur B —</option>';
  widths.forEach(function(w, i) {
    htmlA += '<option value="' + w + '"' + (i === 0 ? ' selected' : '') + '>' + w + ' mm</option>';
    htmlB += '<option value="' + w + '"' + (i === 1 ? ' selected' : '') + '>' + w + ' mm</option>';
  });
  widthEl.innerHTML = htmlA;
  if (widthBEl) widthBEl.innerHTML = htmlB;
  if (wrapEl) wrapEl.style.display = '';
  if (wrapBEl) wrapBEl.style.display = '';
  if (badgeEl) {
    var essLabel = GAMME_ESSENCES[essence] ? GAMME_ESSENCES[essence].label : essence;
    badgeEl.style.display = '';
    badgeEl.style.background = type === 'cc' ? 'rgba(16,185,129,.12)' : 'rgba(59,130,246,.12)';
    badgeEl.style.color = type === 'cc' ? '#10b981' : '#3b82f6';
    badgeEl.style.border = '1px solid ' + (type === 'cc' ? 'rgba(16,185,129,.3)' : 'rgba(59,130,246,.3)');
    var desigA = widths[0] ? pieceDesignation(h, widths[0]) : '';
    var desigB = widths[1] ? pieceDesignation(h, widths[1]) : '';
    badgeEl.innerHTML = (type === 'cc' ? '🟢 CC' : '🔵 SB') + ' ' + h + 'mm — A: ' + widths[0] + 'mm (' + desigA + ')' + (widths[1] ? ' · B: ' + widths[1] + 'mm (' + desigB + ')' : '');
  }
  validateGammeSelection();
  onWidthChange();
}

function onWidthChange() {
  syncWidths('cc');
  syncWidths('sb');
  validateGammeSelection();
}

function syncWidths(type) {
  var wA1Id = type === 'cc' ? 'ppCcw1' : 'ppSbw1';
  var wB1Id = type === 'cc' ? 'ppCcwB1' : 'ppSbwB1';
  var wA2Id = type === 'cc' ? 'ppCcw2' : 'ppSbw2';
  var wB2Id = type === 'cc' ? 'ppCcwB2' : 'ppSbwB2';
  var wA1 = (document.getElementById(wA1Id) || {}).value;
  var wB1 = (document.getElementById(wB1Id) || {}).value;
  if (wA1) setSelectVal(wA2Id, wA1);
  if (wB1) setSelectVal(wB2Id, wB1);
}

function validateGammeSelection() {
  var essSel = document.getElementById('ppEssence');
  var essence = essSel && GAMME_ESSENCES[essSel.value] ? essSel.value : gammeEssence();
  var data = (GAMME_ESSENCES[essence] || GAMME_ESSENCES.spruce).data;
  var essLabel = GAMME_ESSENCES[essence] ? GAMME_ESSENCES[essence].label : essence;
  var ccG = document.getElementById('ccGammeBadge');
  var sbG = document.getElementById('sbGammeBadge');
  var ccH = parseFloat((document.getElementById('ppCentral') || {}).value);
  var ccW = parseFloat((document.getElementById('ppCcw1') || {}).value);
  var sbH = parseFloat((document.getElementById('ppSb1') || {}).value);
  var sbW = parseFloat((document.getElementById('ppSbw1') || {}).value);
  if (ccG) {
    if (ccH && ccW) {
      var row = data[ccH];
      var ok = row && ((row.cc && row.cc.indexOf(ccW) >= 0) || (row.sb && row.sb.indexOf(ccW) >= 0));
      ccG.style.display = '';
      ccG.style.background = ok ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.12)';
      ccG.style.color = ok ? '#10b981' : '#ef4444';
      ccG.style.border = '1px solid ' + (ok ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)');
      ccG.innerHTML = (ok ? '✅' : '❌') + ' ' + ccH + '×' + ccW + (ok ? ' valide' : ' hors gamme ' + essLabel);
    } else { ccG.style.display = 'none'; }
  }
  if (sbG) {
    if (sbH && sbW) {
      var row2 = data[sbH];
      var ok2 = row2 && ((row2.cc && row2.cc.indexOf(sbW) >= 0) || (row2.sb && row2.sb.indexOf(sbW) >= 0));
      sbG.style.display = '';
      sbG.style.background = ok2 ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.12)';
      sbG.style.color = ok2 ? '#10b981' : '#ef4444';
      sbG.style.border = '1px solid ' + (ok2 ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)');
      sbG.innerHTML = (ok2 ? '✅' : '❌') + ' ' + sbH + '×' + sbW + (ok2 ? ' valide' : ' hors gamme ' + essLabel);
    } else { sbG.style.display = 'none'; }
  }
}

function applyGammePick(type, h, w) {
  if (type === 'cc') {
    var el = document.getElementById('ppCentral');
    if (el) el.value = String(h);
    onThicknessChange('cc', 1);
    setTimeout(function() { var el2 = document.getElementById('ppCcw1'); if (el2) el2.value = String(w); onWidthChange(); }, 50);
    showToast('CC appliqué : ' + h + '×' + w + 'mm', 'success');
  } else {
    var el = document.getElementById('ppSb1');
    if (el) el.value = String(h);
    onThicknessChange('sb', 1);
    setTimeout(function() { var el2 = document.getElementById('ppSbw1'); if (el2) el2.value = String(w); onWidthChange(); }, 50);
    showToast('SB appliqué : ' + h + '×' + w + 'mm', 'success');
  }
}

function setSelectVal(id, val) { var el = document.getElementById(id); if (el) el.value = String(val); }

function renderGammeSuggestions() {
  var el = document.getElementById('gammeSuggestions');
  if (!el) return;
  var essence = gammeEssence();
  var data = (GAMME_ESSENCES[essence] || GAMME_ESSENCES.spruce).data;
  var essLabel = GAMME_ESSENCES[essence] ? GAMME_ESSENCES[essence].label : essence;
  var thicknesses = Object.keys(data).map(Number).sort(function(a, b) { return b - a; });
  var html = '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Configurations recommandées · ' + escapeHtml(essLabel) + '</div>';
  html += '<div style="display:flex;flex-direction:column;gap:8px;">';
  thicknesses.forEach(function(H) {
    var row = data[H];
    var ccW = (row.cc && row.cc.length) ? row.cc.slice().sort(function(a, b) { return b - a; }) : [];
    var sbW = (row.sb && row.sb.length) ? row.sb.slice().sort(function(a, b) { return b - a; }) : [];
    if (!ccW.length && !sbW.length) return;
    var desig = pieceDesignation(H, ccW[0] || sbW[0]);
    html += '<div style="background:var(--bg-card,rgba(255,255,255,.04));border:1px solid var(--border-color);border-radius:10px;padding:10px 12px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><span style="font-size:12px;font-weight:800;">Ép. ' + H + ' mm</span><span style="font-size:10px;color:var(--text-muted);">' + escapeHtml(desig) + '</span></div>';
    if (ccW.length) {
      html += '<div style="margin-bottom:6px;"><div style="font-size:10px;font-weight:700;color:#10b981;margin-bottom:3px;">CC (' + ccW.length + ')</div><div style="display:flex;flex-wrap:wrap;gap:4px;">';
      ccW.forEach(function(W) { html += '<button type="button" class="btn btn-sm" onclick="applyGammePick(\'cc\',' + H + ',' + W + ')" style="font-size:10px;padding:3px 8px;border-radius:6px;background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.3);cursor:pointer;">' + W + 'mm</button>'; });
      html += '</div></div>';
    }
    if (sbW.length) {
      html += '<div><div style="font-size:10px;font-weight:700;color:#3b82f6;margin-bottom:3px;">SB (' + sbW.length + ')</div><div style="display:flex;flex-wrap:wrap;gap:4px;">';
      sbW.forEach(function(W) { html += '<button type="button" class="btn btn-sm" onclick="applyGammePick(\'sb\',' + H + ',' + W + ')" style="font-size:10px;padding:3px 8px;border-radius:6px;background:rgba(59,130,246,.12);color:#3b82f6;border:1px solid rgba(59,130,246,.3);cursor:pointer;">' + W + 'mm</button>'; });
      html += '</div></div>';
    }
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function mesureConfirmee(line, m) {
  return loadFromStorage('charben_machine_reglage_' + line + '_' + m, false);
}

function toggleMesureConfirmee(line, m) {
  var key = 'charben_machine_reglage_' + line + '_' + m;
  var cur = loadFromStorage(key, false);
  saveToStorage(key, !cur);
  addAuditLog('Mesures de découpes ' + (cur ? 'reouvertes' : 'confirmées') + ' : ' + m + ' (ligne ' + line + ')');
  renderLigne(line);
  renderLucide();
}

function confirmAllMesures(line) {
  ['1', '2', '3', '4'].forEach(function(n) {
    saveToStorage('charben_machine_reglage_' + line + '_' + n, true);
  });
  addAuditLog('Mesures de découpes confirmées sur les 4 machines (ligne ' + line + ')');
  showToast('Mesures confirmées sur les 4 machines (ligne ' + line + ')', 'success');
  renderLigne(line);
  renderLucide();
}

function renderLigne(ligne) {
  var el = document.getElementById('ligne' + ligne + 'Content');
  if (!el) return;

  /* ── Le bloc grume/caméra est monté UNE SEULE FOIS ──
     el.innerHTML détruit <video> et son srcObject : on garde un shell
     persistant et on ne ré-affiche que la grille. */
  var grumeHost = el.querySelector('[data-flux-grume="' + ligne + '"]');
  var gridHost = el.querySelector('[data-flux-grid="' + ligne + '"]');
  if (!grumeHost || !gridHost) {
    el.innerHTML = '<div class="diagram-container flux-container">'
      + '<div class="diagram-header">Flux Ligne ' + escapeHtml(String(ligne)) + '</div>'
      + '<div class="diagram-body flux-body">'
      + '<div data-flux-grume="' + ligne + '"></div>'
      + '<div data-flux-grid="' + ligne + '"></div>'
      + '</div></div>';
    grumeHost = el.querySelector('[data-flux-grume="' + ligne + '"]');
    gridHost = el.querySelector('[data-flux-grid="' + ligne + '"]');
    grumeHost.innerHTML = buildGrumeFluxBlock(ligne);
  }

  /* Mise à jour ciblée du libellé OF — jamais de reconstruction du bloc. */
  var label = document.getElementById('grumeOfLabel' + ligne);
  if (label) {
    var oL = getLineOrder(ligne);
    label.textContent = oL ? ('OF ' + (oL.orderNum || '')) : 'Aucun OF en cours';
  }

  /* Grille + comparatif : le même plan de fiche sur les deux lignes. */
  gridHost.innerHTML = machineState.grid(ligne)
    + (typeof buildComparaisonHtml === 'function'
      ? '<div style="margin-top:12px;">' + buildComparaisonHtml() + '</div>'
      : '');
}

function changerStatutMachine(ligne, machine, statut) {
  /* Le module est le seul écrivain de l'état machine ; ici on se contente
     de traduire un code de machine en slot. */
  var slot = machineState.slotOf(machine);
  if (!slot) return;
  machineState.setStatus(ligne, slot, statut);
}

function renderLignes() {
  renderLigne('A');
  renderLigne('B');
  renderLucide();
}

function switchProcSubTab(line) {
  document.querySelectorAll('.proc-subtab').forEach(function(el) { el.style.display = 'none'; });
  document.getElementById('procSubBtnA').classList.toggle('active', line === 'A');
  document.getElementById('procSubBtnB').classList.toggle('active', line === 'B');
  document.getElementById('procSub' + line).style.display = 'block';
  updateProcOfInfo(line);
  renderLigne(line);
  renderLucide();
}

function updateProcOfInfo(line) {
  var el = document.getElementById('procOfInfo' + line);
  if (!el) return;
  var o = getLineOrder(line);
  if (o) {
    var lats = (o.laterals && o.laterals.length) ? o.laterals.join(', ') + 'mm' : '—';
    var essLabel = (o.essence && GAMME_ESSENCES[o.essence]) ? GAMME_ESSENCES[o.essence].label : '—';
    var pieces = '';
    if (o.central) {
      var bC = o.centerWidth || '—';
      var clsC = (o.centerWidth && o.essence) ? (gammeClass(o.essence, o.central, o.centerWidth) || 'hors-gamme') : '';
      pieces += 'Centre <b>' + escapeHtml(String(o.central)) + '×' + escapeHtml(String(bC)) + (clsC ? ' ' + escapeHtml(clsC) : '') + '</b>';
    }
    if (o.laterals && o.laterals.length) {
      var lw = (o.lateralWidths && o.lateralWidths.length) ? o.lateralWidths : [];
      var piecesLat = o.laterals.map(function(h, i) {
        var b = lw[i] || '—';
        var cls = (lw[i] && o.essence) ? (gammeClass(o.essence, h, lw[i]) || 'hors-gamme') : '';
        return escapeHtml(String(h)) + '×' + escapeHtml(String(b)) + (cls ? ' ' + escapeHtml(cls) : '');
      }).join(' · ');
      if (pieces) pieces += ' · ';
      pieces += 'Latérales <b>' + piecesLat + '</b>';
    }
    el.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">' +
        '<span class="status-badge status-success" style="font-weight:700;">' + escapeHtml(o.orderNum) + '</span>' +
        '<span style="font-size:11px;color:var(--text-muted);">Ligne ' + escapeHtml(o.line || line) + (o.date ? ' · ' + escapeHtml(o.date) : '') + '</span>' +
        (essLabel !== '—' ? '<span class="status-badge status-info" style="font-size:10px;">' + escapeHtml(essLabel) + '</span>' : '') +
      '</div>' +
      '<div style="line-height:1.7;">Grume <b>' + escapeHtml(String(o.logWidth)) + 'mm</b> · ' + (pieces || 'Centre <b>' + escapeHtml(String(o.central)) + 'mm</b> · Latérales <b>' + lats + '</b>') + '</div>';
  } else {
    el.innerHTML = '<div style="line-height:1.6;">Aucun OF en cours pour la ligne <b>' + escapeHtml(line) + '</b>. Validez une commande dans l\'onglet <b>OF</b>.</div>';
  }
}

function switchProdTab(tab) {
  document.querySelectorAll('.prod-tab-content').forEach(function(el) { el.style.display = 'none'; });
  document.querySelectorAll('#screenProduction .tab-switcher button').forEach(function(el) { el.classList.remove('active'); });
  document.getElementById('prodTab' + tab).style.display = 'block';
  var btns = document.querySelectorAll('#screenProduction .tab-switcher button');
  var idx = { Lignes:0, Sechage:1, Fiche:2 }[tab] || 0;
  if (btns[idx]) btns[idx].classList.add('active');
  if (tab === 'Lignes') {
    var activeLine = document.getElementById('procSubBtnA').classList.contains('active') ? 'A' : 'B';
    renderLigne(activeLine);
    ['A', 'B'].forEach(function(line) {
      updateProcOfInfo(line);
      procCalculatePattern(line);
    });
  }
  if (tab === 'Sechage' && typeof renderWipList === 'function') { renderWipList(); if (typeof renderWipMatrix === 'function') renderWipMatrix(); }
  if (tab === 'Of' && typeof renderOrdersList === 'function') renderOrdersList();
  if (tab === 'Fiche') renderProdFiche();
}

/* MODULE FICHE — vue « Fiche de production » au niveau OF.
   Le rendu existait déjà (buildFicheOfHtml) mais n'était atteignable que depuis
   la console : la validation CDP l'appelait directement, ce qui prouvait que la
   fonction marche, pas qu'un opérateur pouvait l'ouvrir. Maquette
   machines-lignes-v1 : « Voir la fiche de la ligne › ». */
function prodFicheActiveLine() {
  var btnA = document.getElementById('procSubBtnA');
  return (btnA && btnA.classList.contains('active')) ? 'A' : 'B';
}

function renderProdFiche() {
  var host = document.getElementById('prodTabFicheBody');
  if (!host) return;
  var line = prodFicheActiveLine();
  var o = (typeof getLineOrder === 'function') ? getLineOrder(line) : null;
  if (!o || typeof buildFicheOfHtml !== 'function') {
    host.innerHTML = '<div class="card" style="padding:16px;text-align:center;color:var(--text-muted);">'
      + 'Aucun ordre en cours sur la ligne ' + escapeHtml(line) + '.</div>';
    return;
  }
  var fiche = buildFicheOfHtml(o.orderNum, '', line);
  host.innerHTML = fiche ? fiche
    : '<div class="card" style="padding:16px;text-align:center;color:var(--text-muted);">'
      + 'Aucun mouvement enregistré pour ' + escapeHtml(String(o.orderNum)) + '.</div>';
}

function openProdFiche() {
  switchProdTab('Fiche');
}

/* MODULE RAW MATERIALS */
// (bloc variable deplacé vers data.js — ligne source 3451)

function previewVolumeMP() {
  const d = parseFloat(document.getElementById('gdsMpDiametre').value);
  const l = parseFloat(document.getElementById('gdsMpLongueur').value);
  const el = document.getElementById('gdsMpVolumePreview');
  const capEl = document.getElementById('gdsMpCapacityAlert');
  if (capEl) capEl.style.display = (d > MAX_LOG_WIDTH / 10) ? '' : 'none';
  if (d > 0 && l > 0) {
    el.textContent = calcVolumeGrume(d, l).toFixed(3);
  } else {
    el.textContent = '—';
  }
}

function nextGrumeCode() {
  var y = new Date().getFullYear();
  var prefix = 'GR-' + y + '-';
  var maxN = 0;
  var re = /^GR-(\d{4})-(\d+)$/;
  rawMaterials.forEach(function(g) {
    if (!g || !g.code) return;
    var m = String(g.code).trim().match(re);
    if (m) {
      var n = parseInt(m[2], 10);
      if (n > maxN) maxN = n;
    }
  });
  var c;
  try { c = parseInt(localStorage.getItem('charben_grume_counter') || '0', 10); } catch (e) { c = 0; }
  if (!c || isNaN(c)) c = 0;
  if (c > maxN) maxN = c;
  var next = maxN + 1;
  var code = prefix + String(next).padStart(3, '0');
  while (rawMaterials.some(function(g) { return String(g.code || '') === code; })) {
    next += 1;
    code = prefix + String(next).padStart(3, '0');
  }
  try { localStorage.setItem('charben_grume_counter', String(next)); } catch (e) {}
  return code;
}

function addGrume() {
  const essence = document.getElementById('gdsMpEssence').value;
  const longueur = parseFloat(document.getElementById('gdsMpLongueur').value);
  const diametre = parseFloat(document.getElementById('gdsMpDiametre').value);
  const msgEl = document.getElementById('gdsMpMsg');
  const finalCode = nextGrumeCode();
  if (!longueur || !diametre) { msgEl.innerHTML = '<span style="color:var(--danger);">Remplissez la longueur et le diamètre.</span>'; return; }
  if (essence !== 'Pin' && essence !== '\u00c9pic\u00e9a') { msgEl.innerHTML = '<span style="color:var(--danger);">Essence non accept\u00e9e. Seuls le Pin et l\u2019\u00c9pic\u00e9a sont autoris\u00e9s.</span>'; return; }
  if (diametre > MAX_LOG_WIDTH / 10) {
    msgEl.innerHTML = '<span style="color:var(--danger);">Capacité de sciage dépassée : Ø' + diametre + 'cm > ' + (MAX_LOG_WIDTH / 10) + 'cm (max 560mm sur les lignes A/B). Grume ignorée.</span>';
    return;
  }
  const volume = calcVolumeGrume(diametre, longueur);
  var newScanCode = genGrumeScanCode();
  for (var sc = 0; sc < 20 && grumeScanCodeTaken(newScanCode); sc++) newScanCode = genGrumeScanCode();
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    code: finalCode, scanCode: newScanCode, essence, longueur, diametre, volume,
    statut: 'EN_STOCK', createdAt: new Date().toISOString()
  };
  rawMaterials.unshift(item);
  saveToStorage('charben_raw', rawMaterials);
  fsSave('raw', rawMaterials);
  addAuditLog('Grume enregistrée: ' + finalCode + ' (' + essence + ') — réception ' + volume + ' m³ (MP)');
  msgEl.innerHTML = '<span style="color:var(--success);">Grume ' + escapeHtml(finalCode) + ' enregistrée (' + volume + ' m³) — stock MP à jour</span>';
  document.getElementById('gdsMpLongueur').value = '';
  document.getElementById('gdsMpDiametre').value = '';
  document.getElementById('gdsMpVolumePreview').textContent = '—';
  renderGrumes();
  if (typeof renderLigne === 'function') { renderLigne('A'); renderLigne('B'); }
  openGrumeQrModal(item.id);
}

function consommerGrume(id) {
  var g = rawMaterials.find(function(r) { return r.id === id; });
  if (!g || g.statut !== 'EN_STOCK') { showToast('Grume introuvable ou déjà engagée', 'warning'); return; }
  showModal('Consommer la grume ' + (g.code || '') + ' ?', 'La grume sera marquée "Sciée" et sortie du stock MP (' + g.volume + ' m³).', '🪚', function() {
    g.statut = 'CONSOMME';
    g.consumedAt = new Date().toISOString();
    saveToStorage('charben_raw', rawMaterials);
    fsSave('raw', rawMaterials);
    addAuditLog('Grume consommée (sciage manuel): ' + (g.code || ''));
    renderGrumes();
    showToast('Grume consommée : ' + g.code, 'success');
  });
}

function deleteGrume(id) {
  var grume = rawMaterials.find(function(r) { return r.id === id; });
  showModal('Supprimer cette grume ?', 'Cette action est irréversible.', '🗑️', function() {
    rawMaterials = rawMaterials.filter(function(r) { return r.id !== id; });
    saveToStorage('charben_raw', rawMaterials);
    fsSave('raw', rawMaterials);
    addAuditLog('Grume supprimée' + (grume ? ': ' + grume.code : ''));
    renderGrumes();
    showToast('Grume supprimée', 'info');
  });
}


/* var _qrScanAlphabet — déplacé vers state.js */

function grumeQrDataUrl(id) {
  var g = rawMaterials.find(function(x) { return x.id === id; });
  if (!g || !window.qrcode) return '';
  var payload = grumeQrPayload(g);
  var qr = qrcode(0, 'M');
  qr.addData(payload);
  qr.make();
  var size = qr.getModuleCount();
  var cs = Math.max(4, Math.round(200 / size));
  var cv = document.createElement('canvas');
  cv.width = size * cs; cv.height = size * cs;
  var ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#000000';
  for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) if (qr.isDark(r, c)) ctx.fillRect(c * cs, r * cs, cs, cs);
  return cv.toDataURL('image/png');
}

function openGrumeQrModal(id) {
  var g = rawMaterials.find(function(x) { return x.id === id; });
  if (!g) return;
  var modal = document.getElementById('qrModal');
  if (!modal) return;
  document.getElementById('qrModalTitle').textContent = 'QR · ' + g.code;
  document.getElementById('qrModalRef').textContent = g.code;
  var info = document.getElementById('qrModalInfo');
  info.innerHTML = escapeHtml(g.essence) + ' · Ø' + g.diametre + 'cm × ' + g.longueur + 'm · ' + g.volume + ' m³ · ' + (g.statut === 'EN_STOCK' ? '<span class="badge badge-stock">Disponible</span>' : '<span class="badge badge-consumed">Engagée / sciée</span>');
  var canvas = document.getElementById('qrModalCanvas');
  drawGrumeQr(canvas, grumeQrPayload(g));
  document.getElementById('qrModalPrint').onclick = function() { printGrumeLabel(id); };
  modal.classList.add('open');
  renderLucide();
}

function closeQrModal() {
  var modal = document.getElementById('qrModal');
  if (modal) modal.classList.remove('open');
}

function printGrumeLabel(id) {
  var g = rawMaterials.find(function(x) { return x.id === id; });
  if (!g) return;
  var dataUrl = grumeQrDataUrl(id);
  var win = window.open('', '_blank', 'width=400,height=300');
  if (!win) { showToast('Autorisez les popups pour imprimer', 'warning'); return; }
  win.document.write('<html><head><title>Label ' + escapeHtml(g.code) + '</title>');
  win.document.write('<style>body{font-family:Arial,sans-serif;text-align:center;padding:16px;}' +
    '.sarl{font-size:11px;color:#666;letter-spacing:1px;}.ref{font-size:26px;font-weight:800;margin:6px 0;}' +
    '.info{font-size:13px;color:#333;margin:4px 0;}.ess{font-size:12px;color:#444;}' +
    '@media print{ .noprint{display:none;} }</style></head><body>');
  win.document.write('<div class="sarl">SARL CHARBEN INDUSTRIE — DÉCOUPES DE BOIS</div>');
  win.document.write('<div class="ref">' + escapeHtml(g.code) + '</div>');
  win.document.write('<div class="info">' + escapeHtml(g.essence) + ' · Ø ' + g.diametre + ' cm · L ' + g.longueur + ' m · ' + g.volume + ' m³' + (g.qualite ? ' · Q° ' + escapeHtml(g.qualite) : '') + '</div>');
  win.document.write('<div class="info">' + (g.fournisseur ? 'Fournisseur : ' + escapeHtml(g.fournisseur) : '') + (g.origine ? ' · ' + escapeHtml(g.origine) : '') + '</div>');
  win.document.write('<img src="' + dataUrl + '" style="width:180px;height:180px;margin-top:8px;">');
  win.document.write('<div class="ess">Scanner ce QR au sciage (A1/B1) pour lancer la grume</div>');
  win.document.write('<div class="noprint" style="margin-top:14px;"><button onclick="window.print()" style="padding:8px 22px;font-size:14px;">Imprimer</button></div>');
  win.document.write('</body></html>');
  win.document.close();
}

/* renderGrumes() est fourni par modules/ui-renderer.js, aliasé dans
   module-aliases.js (chargé après app.js). La version locale était masquée
   par cet alias et dupliquait la logique : supprimée (Phase 2 — sync MP). */

/* ═══════════════════════════════════════════════
   MODULE 4: CHAMBRE DE SECHAGE
   ═══════════════════════════════════════════════ */
// (bloc variable deplacé vers data.js — ligne source 3550)

/* var DRY_AUTO_THRESHOLD_KEY — déplacé vers state.js */

/* Stubs WIP/séchage orphelins supprimés (Phase 5). Implémentations réelles
   dans modules/wip-manager.js, aliasé module-aliases.js. */


/* ═══════════════════════════════════════════════
   MODULE 6: STOCK FINAL
   ═══════════════════════════════════════════════ */
// (bloc variable deplacé vers data.js — ligne source 3659)


function previewVolumePF() {
  const ep = parseFloat(document.getElementById('gdsPfEp').value);
  const larg = parseFloat(document.getElementById('gdsPfLarg').value);
  const long = parseFloat(document.getElementById('gdsPfLong').value);
  const qte = parseInt(document.getElementById('gdsPfQte').value) || 1;
  const el = document.getElementById('gdsPfVolumePreview');
  if (ep > 0 && larg > 0 && long > 0) {
    const vol = (ep * larg * long * qte) / 1e9;
    el.textContent = vol.toFixed(4);
  } else {
    el.textContent = '—';
  }
}

function addProduitFini() {
  const type = document.getElementById('gdsPfType').value;
  const essence = document.getElementById('gdsPfEssence').value;
  const ep = parseInt(document.getElementById('gdsPfEp').value);
  const larg = parseInt(document.getElementById('gdsPfLarg').value);
  const long = parseInt(document.getElementById('gdsPfLong').value);
  const qte = parseInt(document.getElementById('gdsPfQte').value) || 1;
  const msgEl = document.getElementById('gdsPfMsg');
  if (!ep || !larg || !long) {
    msgEl.innerHTML = '<span style="color:var(--danger);">Remplissez toutes les dimensions.</span>';
    return;
  }
  const volume = parseFloat(((ep * larg * long * qte) / 1e9).toFixed(4));
  const ref = 'PF-' + (type || 'X') + '-' + ep + 'x' + larg + 'x' + long + '-' + essence;
  var sc = genGrumeScanCode();
  for (var tries = 0; tries < 20 && pfScanCodeTaken(sc); tries++) sc = genGrumeScanCode();
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    code: ref, type, essence, epaisseur: ep, largeur: larg, longueur: long, qte, volume,
    scanCode: sc,
    statut: 'EN_STOCK', createdAt: new Date().toISOString()
  };
  finishedGoods.unshift(item);
  saveToStorage('charben_stock', finishedGoods);
  fsSave('stock', finishedGoods);
  addAuditLog('Produit fini ajouté: ' + ref + ' (x' + qte + ') — stock PF à jour');
  msgEl.innerHTML = '<span style="color:var(--success);">' + escapeHtml(ref) + ' ajouté au stock PF (x' + qte + ')</span>';
  document.getElementById('gdsPfEp').value = '';
  document.getElementById('gdsPfLarg').value = '';
  document.getElementById('gdsPfLong').value = '';
  document.getElementById('gdsPfQte').value = '1';
  document.getElementById('gdsPfVolumePreview').textContent = '—';
  renderProduitsFinis();
}

function expedierProduitFini(id) {
  const f = finishedGoods.find(function(x) { return x.id === id; });
  if (!f) return;
  openFormModal('Expédier ' + (f.code || f.type) + ' — ' + f.essence, '🚚',
    '<div class="form-group"><label>Quantité (pcs)</label><input id="formQte" type="number" class="form-control" value="' + (f.qte - (f.qteExpedie || 0)) + '" min="1" max="' + (f.qte - (f.qteExpedie || 0)) + '"></div>'
    + '<div class="form-group"><label>Client</label><input id="formClient" type="text" class="form-control" placeholder="Nom du client"></div>'
    + '<div class="form-group"><label>N° Bon de Livraison</label><input id="formBl" type="text" class="form-control" placeholder="BL-…"></div>',
    function() {
      var qty = parseInt(document.getElementById('formQte').value, 10) || 0;
      var client = (document.getElementById('formClient').value || '').trim();
      var bl = (document.getElementById('formBl').value || '').trim();
      var dispo = (f.qte || 0) - (f.qteExpedie || 0);
      if (qty <= 0 || qty > dispo) { showToast('Quantité invalide (dispo : ' + dispo + ' pcs)', 'warning'); return; }
      f.qteExpedie = (f.qteExpedie || 0) + qty;
      if (f.qteExpedie >= f.qte) { f.statut = 'EXPEDIE'; f.expedieAt = new Date().toISOString(); }
      else f.statut = 'PARTIEL';
      f.client = client; f.bl = bl;
      saveToStorage('charben_stock', finishedGoods);
      fsSave('stock', finishedGoods);
      addAuditLog('Expédition: ' + qty + ' pcs ' + (f.code || 'PF') + ' → ' + (client || 'inconnu') + (bl ? ' (BL ' + bl + ')' : ''));
      renderProduitsFinis();
      showToast('Expédition enregistrée (' + qty + ' pcs)', 'success');
    }, false);
}

function deleteProduitFini(id) {
  showModal('Supprimer ce produit du stock ?', 'Cette action est irréversible.', '🗑️', function() {
    finishedGoods = finishedGoods.filter(function(f2) { return f2.id !== id; });
    saveToStorage('charben_stock', finishedGoods);
    fsSave('stock', finishedGoods);
    addAuditLog('Produit fini supprimé du stock');
    renderProduitsFinis();
    showToast('Produit supprimé', 'info');
  });
}

function pfScanCodeTaken(code) {
  code = String(code || '').toUpperCase();
  if (!code) return true;
  if ((typeof finishedGoods !== 'undefined' ? finishedGoods : []).some(function(f) { return f.scanCode === code; })) return true;
  if (typeof grumeScanCodeTaken === 'function' && grumeScanCodeTaken(code)) return true;
  return (typeof fardeaux !== 'undefined' ? fardeaux : []).some(function(f) {
    return f.scanCode === code || String(f.code || '').toUpperCase() === code;
  });
}

function ensurePfScanCodes() {
  if (typeof finishedGoods === 'undefined') return false;
  var changed = false;
  finishedGoods.forEach(function(f) {
    if (!f.scanCode) {
      var code = genGrumeScanCode();
      for (var tries = 0; tries < 20 && pfScanCodeTaken(code); tries++) code = genGrumeScanCode();
      f.scanCode = code;
      changed = true;
    }
  });
  if (changed) {
    try { saveToStorage('charben_stock', finishedGoods); }
    catch (e) { errLog('stock', 'ensurePfScanCodes save', e, 'error'); errUser('Codes QR PF non enregistrés localement', 'Stock PF'); }
    try { fsSave('stock', finishedGoods); }
    catch (e) { errLog('stock', 'ensurePfScanCodes fsSave', e, 'error'); }
  }
  return changed;
}

function pfQrPayload(f) {
  if (!f) return '';
  if (!String(f.scanCode || '').trim()) ensurePfScanCodes();
  var sec = String(f.scanCode || '').trim() || f.code || '';
  return JSON.stringify({
    t: 'PF',
    ref: sec,
    c: f.code || '',
    ess: f.essence || '',
    ep: f.epaisseur || 0,
    lr: f.largeur || 0,
    lg: f.longueur || 0,
    q: f.qte || 0,
    v: f.volume || 0,
    date: (f.createdAt || '').slice(0, 10)
  });
}

function openPfQrModal(id) {
  ensurePfScanCodes();
  var f = (typeof finishedGoods !== 'undefined' ? finishedGoods : []).find(function(x) { return x.id === id; });
  if (!f) return;
  var modal = document.getElementById('qrModal');
  if (!modal) return;
  document.getElementById('qrModalTitle').textContent = 'QR · ' + (f.code || f.type || 'PF');
  document.getElementById('qrModalRef').textContent = f.code || f.type || 'PF';
  var info = document.getElementById('qrModalInfo');
  var dispo = (f.qte || 0) - (f.qteExpedie || 0);
  info.innerHTML = '<b>' + escapeHtml(f.type || '') + ' — ' + escapeHtml(f.essence || '') + '</b> · ' + f.epaisseur + '×' + f.largeur + '×' + f.longueur + ' mm · ' + dispo + '/' + f.qte + ' pcs · '
    + (f.volume ? f.volume + ' m³' : '');
  var sub = document.getElementById('qrModalRef').nextElementSibling;
  if (sub) sub.textContent = 'Pièce en vrac — scanner pour consulter la fiche produit fini';
  var canvas = document.getElementById('qrModalCanvas');
  drawGrumeQr(canvas, pfQrPayload(f));
  document.getElementById('qrModalPrint').onclick = function() { printPfLabel(id); };
  modal.classList.add('open');
  renderLucide();
}

function printPfLabel(id) {
  var f = (typeof finishedGoods !== 'undefined' ? finishedGoods : []).find(function(x) { return x.id === id; });
  if (!f) return;
  var dataUrl = '';
  if (window.qrcode) {
    var qr = qrcode(0, 'M');
    qr.addData(pfQrPayload(f));
    qr.make();
    var size = qr.getModuleCount();
    var cs = Math.max(4, Math.round(200 / size));
    var cv = document.createElement('canvas');
    cv.width = size * cs; cv.height = size * cs;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#000000';
    for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) if (qr.isDark(r, c)) ctx.fillRect(c * cs, r * cs, cs, cs);
    dataUrl = cv.toDataURL('image/png');
  }
  var win = window.open('', '_blank', 'width=400,height=300');
  if (!win) { showToast('Autorisez les popups pour imprimer', 'warning'); return; }
  var dispo = (f.qte || 0) - (f.qteExpedie || 0);
  win.document.write('<html><head><title>Label ' + escapeHtml(f.code || f.type) + '</title>');
  win.document.write('<style>body{font-family:Arial,sans-serif;text-align:center;padding:16px;}' +
    '.sarl{font-size:11px;color:#666;letter-spacing:1px;}.ref{font-size:26px;font-weight:800;margin:6px 0;}' +
    '.info{font-size:13px;color:#333;margin:4px 0;}.ess{font-size:12px;color:#444;}' +
    '@media print{ .noprint{display:none;} }</style></head><body>');
  win.document.write('<div class="sarl">SARL CHARBEN INDUSTRIE — PRODUITS FINIS (VRAC)</div>');
  win.document.write('<div class="ref">' + escapeHtml(f.code || f.type || 'PF') + '</div>');
  win.document.write('<div class="info">' + escapeHtml(f.type || '') + ' — ' + escapeHtml(f.essence || '') + ' · ' + f.epaisseur + '×' + f.largeur + '×' + f.longueur + ' mm (' + f.epaisseur + 'mm deplié)</div>');
  win.document.write('<div class="info">' + dispo + '/' + f.qte + ' pcs' + (f.volume ? ' · ' + f.volume + ' m³' : '') + '</div>');
  if (dataUrl) win.document.write('<img src="' + dataUrl + '" style="width:180px;height:180px;margin-top:8px;">');
  win.document.write('<div class="ess">Pièce en vrac — stock produit fini</div>');
  win.document.write('<div class="noprint" style="margin-top:14px;"><button onclick="window.print()" style="padding:8px 22px;font-size:14px;">Imprimer</button></div>');
  win.document.write('</body></html>');
  win.document.close();
}

/* renderProduitsFinis() est fourni par modules/ui-renderer.js, aliasé dans
   module-aliases.js (chargé après app.js). Version locale masquée : supprimée
   (Phase 2 — sync PF). */

/* ═══════════════════════════════════════════════
   MODULE F: FARDEAUX (bundles)
   → Extrait vers modules/fardeaux-manager.js (Phase 2A)
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   MODULE 5: OUTILS & MACHINES + DISQUES
   → Extrait vers modules/disques-renderer.js (Phase 2A)
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   MODULE 1: ADMIN - SHIFTS & AUDIT LOGS
   ═══════════════════════════════════════════════ */
// (bloc variable deplacé vers data.js — ligne source 4527)
// (bloc variable deplacé vers data.js — ligne source 4528)

function addAuditLog(action) {
  const log = {
    id: Date.now().toString(36),
    action: action,
    user: currentUser ? currentUser.email : 'Système',
    time: new Date().toISOString()
  };
  auditLogs.unshift(log);
  if (auditLogs.length > 200) auditLogs = auditLogs.slice(0, 200);
  saveToStorage('charben_audit', auditLogs);
  fsSave('audit', auditLogs);
}

function renderAuditLogs() {
  const el = document.getElementById('auditLogsList');
  if (!el) return;
  if (auditLogs.length === 0) {
    el.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px 0;">Aucune activité enregistrée.</p>';
    return;
  }
  let html = '<div class="dt-table dt-table-full"><div class="dt-head dt-head-full">'
    + '<span>Date</span><span>Action</span><span>Utilisateur</span>'
    + '</div>';
  auditLogs.slice(0, 50).forEach(function(l) {
    const t = new Date(l.time);
    const timeStr = t.toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'}) + ' ' + t.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
    html += '<div class="dt-row">';
    html += '<span class="mp-dt-date">' + timeStr + '</span>';
    html += '<span class="mp-dt-autres">' + escapeHtml(l.action) + '</span>';
    html += '<span class="mp-dt-vol">' + escapeHtml(l.user) + '</span>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}


function deleteShift(id) {
  showModal('Supprimer cette équipe ?', 'Les membres seront perdus.', '🗑️', function() {
    shifts = shifts.filter(s => s.id !== id);
    saveToStorage('charben_shifts', shifts);
    fsSave('shifts', shifts);
    addAuditLog('Equipe supprimée');
    renderShifts();
    showToast('Equipe supprimée', 'info');
  });
}

function addMemberToShift(shiftId) {
  showPrompt('Ajouter un membre', 'Nom du membre :', '', function(name) {
    if (!name) return;
    var shift = shifts.find(function(s) { return s.id === shiftId; });
    if (!shift) return;
    shift.members.push(name);
    saveToStorage('charben_shifts', shifts);
    fsSave('shifts', shifts);
    renderShifts();
  });
}

function removeMemberFromShift(shiftId, memberIdx) {
  const shift = shifts.find(s => s.id === shiftId);
  if (!shift) return;
  shift.members.splice(memberIdx, 1);
  saveToStorage('charben_shifts', shifts);
  fsSave('shifts', shifts);
  renderShifts();
}

function renderShifts() {
  const el = document.getElementById('shiftsList');
  if (!el) return;
  if (shifts.length === 0) {
    el.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px 0;">Aucune équipe configurée.</p>';
    return;
  }
  let html = '<div class="dt-table dt-table-full"><div class="dt-head dt-head-full">'
    + '<span>Équipe</span><span>Membres</span><span style="text-align:right;">⋮</span>'
    + '</div>';
  shifts.forEach(function(s) {
    html += '<div class="dt-row">';
    html += '<span class="mp-dt-ref" style="font-weight:600;">' + escapeHtml(s.name) + '</span>';
    html += '<span class="mp-dt-autres">';
    if (s.members.length === 0) {
      html += '<span style="font-size:11px;color:var(--text-muted);">Aucun membre</span>';
    }
    s.members.forEach(function(m, i) {
      html += '<span class="shift-member">' + m + ' <button onclick="removeMemberFromShift(\'' + s.id + '\',' + i + ')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:12px;margin-left:4px;">' + MI('close','mi-sm mi-red') + '</button></span> ';
    });
    html += '</span>';
    html += '<span class="mp-dt-actions" style="text-align:right;white-space:nowrap;">';
    html += '<button class="btn btn-sm btn-secondary" onclick="addMemberToShift(\'' + s.id + '\')" data-perm="settings:edit">+ Membre</button> ';
    html += '<button class="btn btn-sm btn-danger" onclick="deleteShift(\'' + s.id + '\')" data-perm="settings:delete">' + MI('delete','mi-sm') + '</button>';
    html += '</span></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

/* ═══════════════════════════════════════════════
   DASHBOARD KPIs + CHARTS + TASKS
   → Extrait vers modules/dashboard-kpi.js (Phase 2A)
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   QUALITY CONTROL MODULE
   ═══════════════════════════════════════════════ */

