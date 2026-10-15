/**
 * PLANNING-RENDERER.JS — Planning de production + formulaire OF + prévisualisation grume.
 * Copies EXACTES des helpers manipulables ; passthrough pour les gros renders/add.
 * Globals: productionPlan, ppSelected, GAMME_ESSENCES, DISK_THICKNESS, MAX_LOG_WIDTH
 */
'use strict';

/* ─────────────────────────────────────────────
   Helpers purs / petits — copies EXACTES
   Extrait EXACT: app.js lignes 8030-8032, 8079-8239, 8360-8367
   ───────────────────────────────────────────── */

window._planningRenderer_planningStatusLabel = function(s) {
  return s === 'done' ? 'Terminé' : (s === 'doing' ? 'En cours' : 'À faire');
};

window._planningRenderer_switchPlanTab = function(tab) {
  document.getElementById('planTabTasks').style.display = tab === 'tasks' ? '' : 'none';
  document.getElementById('planTabOf').style.display = tab === 'of' ? '' : 'none';
  var tabAgenda = document.getElementById('planTabAgenda');
  if (tabAgenda) tabAgenda.style.display = tab === 'agenda' ? '' : 'none';
  var btns = document.querySelectorAll('#planTabSwitcher button');
  btns.forEach(function(b) { b.classList.remove('active'); });
  var idx = { tasks: 0, of: 1, agenda: 2 }[tab] || 0;
  if (btns[idx]) btns[idx].classList.add('active');
  if (tab === 'tasks') renderPlanningList();
  if (tab === 'of') {
    if (typeof populateEssenceSelect === 'function') populateEssenceSelect('ppEssence', typeof gammeEssence === 'function' ? gammeEssence() : 'spruce');
  }
  if (tab === 'agenda' && typeof agendaRenderer !== 'undefined') {
    agendaRenderer.renderAgenda();
  }
};

window._planningRenderer_selectPpLine = function(line) {
  var btnA = document.getElementById('ppLineBtnA');
  var btnB = document.getElementById('ppLineBtnB');
  var hidden = document.getElementById('ppLine');
  if (btnA) btnA.classList.toggle('active', line === 'A');
  if (btnB) btnB.classList.toggle('active', line === 'B');
  if (hidden) hidden.value = line;
  renderPpMachines();
};

window._planningRenderer_renderPpMachines = function() {
  var line = (document.getElementById('ppLine') || {}).value || 'A';
  var prefix = line === 'B' ? 'B' : 'A';
  var seg = document.getElementById('ppMachineSeg');
  if (!seg) return;
  var machines = [
    { id: prefix + '1', label: prefix + '1 — Débit', num: '1' },
    { id: prefix + '2', label: prefix + '2 — Scie CC', num: '2' },
    { id: prefix + '3', label: prefix + '3 — Déligneuse SB', num: '3' },
    { id: prefix + '4', label: prefix + '4 — Dosses', num: '4' }
  ];
  var currentMachine = (document.getElementById('ppMachine') || {}).value || (prefix + '1');
  if (currentMachine.charAt(0) !== prefix) currentMachine = prefix + '1';
  var html = '';
  machines.forEach(function(m) {
    html += '<button type="button" data-machine="' + m.id + '" class="' + (currentMachine === m.id ? 'active' : '') + '" onclick="selectPpMachine(\'' + m.id + '\')">' + escapeHtml(m.label) + '</button>';
  });
  seg.innerHTML = html;
  var hidd = document.getElementById('ppMachine');
  if (hidd) hidd.value = currentMachine;
  selectPpMachine(currentMachine);
};

window._planningRenderer_selectPpMachine = function(machine) {
  var prefix = machine.charAt(0);
  var num = machine.charAt(1);
  var hidden = document.getElementById('ppMachine');
  if (hidden) hidden.value = machine;
  var seg = document.getElementById('ppMachineSeg');
  if (seg) {
    seg.querySelectorAll('button').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-machine') === machine);
    });
  }
  var panels = { '1': 'ppOpsA1', '2': 'ppOpsA2', '3': 'ppOpsA3', '4': 'ppOpsA4' };
  Object.keys(panels).forEach(function(k) {
    var el = document.getElementById(panels[k]);
    if (el) el.style.display = (k === num) ? '' : 'none';
  });
  var labels = { 'ppOpsA1Label': '1', 'ppOpsA2Label': '2', 'ppOpsA3Label': '3', 'ppOpsA4Label': '4' };
  Object.keys(labels).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = prefix + labels[id];
  });
  if (num === '2' || num === '3') window._planningRenderer_syncPpWidths();
};

window._planningRenderer_togglePpSecondarySb = function() {
  var sec = document.getElementById('ppSecondarySb');
  var btn = document.getElementById('ppAddSbBtn');
  if (!sec) return;
  var visible = sec.style.display !== 'none';
  sec.style.display = visible ? 'none' : '';
  if (btn) btn.textContent = visible ? '+ SB 2 secondaire' : '\u2212 Retirer SB 2 secondaire';
  window._planningRenderer_syncPpWidths();
};

window._planningRenderer_togglePpSecondaryCc = function() {
  var sec = document.getElementById('ppSecondaryCc');
  var btn = document.getElementById('ppAddCcBtn');
  if (!sec) return;
  var visible = sec.style.display !== 'none';
  sec.style.display = visible ? 'none' : '';
  if (btn) btn.textContent = visible ? '+ CC 2 secondaire' : '\u2212 Retirer CC 2 secondaire';
  window._planningRenderer_syncPpWidths();
};

window._planningRenderer_readPpCcValues = function() {
  var cc = [];
  ['ppCentral', 'ppCentral2'].forEach(function(id) {
    var v = parseFloat(document.getElementById(id) ? document.getElementById(id).value : '');
    if (!isNaN(v) && v > 0) cc.push(v);
  });
  return cc;
};

window._planningRenderer_readPpSbValues = function() {
  var sb = [];
  ['ppSb1', 'ppSb2'].forEach(function(id) {
    var v = parseFloat(document.getElementById(id) ? document.getElementById(id).value : '');
    if (!isNaN(v) && v > 0) sb.push(v);
  });
  return sb;
};

window._planningRenderer_syncPpWidths = function() {
  var machine = (document.getElementById('ppMachine') || {}).value || 'A1';
  var prefix = machine.charAt(0);
  var num = machine.charAt(1);
  var cc = window._planningRenderer_readPpCcValues();
  var sb = window._planningRenderer_readPpSbValues();
  if (num === '2') window._planningRenderer_renderPpWidthFields('ppA2CcWidths', 'ppCcw', cc, 'Largeur CC');
  if (num === '3') window._planningRenderer_renderPpWidthFields('ppA3SbWidths', 'ppSbw', sb, 'Largeur SB');
  window._planningRenderer_updatePpGrumePreview();
};

window._planningRenderer_updatePpGrumePreview = function() {
  var cc = window._planningRenderer_readPpCcValues();
  var sb = window._planningRenderer_readPpSbValues();
  var pieceCount = cc.length + sb.length;
  if (pieceCount === 0) {
    var pv = document.getElementById('ppGrumePreview');
    if (pv) pv.style.display = 'none';
    return;
  }
  var diskCount = 2 * pieceCount + 1;
  var sumSingle = cc.reduce(function(a, b) { return a + b; }, 0) + sb.reduce(function(a, b) { return a + b; }, 0);
  var totalMm = sumSingle * 2 + diskCount * DISK_THICKNESS;
  var ok = totalMm <= MAX_LOG_WIDTH;
  var el = document.getElementById('ppGrumePreview');
  var txt = document.getElementById('ppGrumeText');
  if (el) el.style.display = '';
  if (txt) {
    txt.innerHTML = '<span style="font-weight:600;">Ø motif nécessaire : <span style="color:' + (ok ? 'var(--accent-primary,#059669)' : 'var(--danger,#dc2626)') + ';">' + totalMm + ' mm</span></span>'
      + ' <span style="font-size:11px;color:var(--text-muted);">(Σ ép.×2 + ' + diskCount + ' lames × ' + DISK_THICKNESS + 'mm)'
      + (ok ? ' — motif valide pour ≤ 560mm' : ' — <b style="color:var(--danger);">DEPASSE 560mm</b>') + '</span>'
      + '<br><span style="font-size:11px;color:var(--text-muted);">Le Ø réel de chaque grume (mesuré à la réception MP) détermine la découpe au lancement.</span>';
  }
};

/* ─────────────────────────────────────────────
   SIMULATION & PRÉDICTION DE SCIAGE (Plan S4)
   S'appuie STRICTEMENT sur predictYieldModule.predictLogYield →
   sciageLogic (calcVolumeGrume + essenceProfile). Aucune table de
   rendement inventée : volumes, chutes et rendement viennent du moteur.
   ───────────────────────────────────────────── */

window._planningRenderer_ppSimVals = function() {
  var ess = (document.getElementById('ppSimEssence') || {}).value || 'spruce';
  var dia = parseFloat(document.getElementById('ppDiameter') ? document.getElementById('ppDiameter').value : '');
  var len = parseFloat(document.getElementById('ppLength') ? document.getElementById('ppLength').value : '');
  var qty = parseInt(document.getElementById('ppQty') ? document.getElementById('ppQty').value : '', 10);
  return { ess: ess, dia: dia, len: len, qty: isNaN(qty) ? null : qty };
};

window._planningRenderer_ppMotifMm = function() {
  var cc = window._planningRenderer_readPpCcValues();
  var sb = window._planningRenderer_readPpSbValues();
  var pieceCount = cc.length + sb.length;
  if (pieceCount === 0) return 0;
  var diskCount = 2 * pieceCount + 1;
  var sumSingle = cc.reduce(function(a, b) { return a + b; }, 0) + sb.reduce(function(a, b) { return a + b; }, 0);
  return sumSingle * 2 + diskCount * DISK_THICKNESS;
};

window._planningRenderer_ppBlockStatus = function() {
  var v = window._planningRenderer_ppSimVals();
  var any = !isNaN(v.dia) || !isNaN(v.len) || v.qty !== null;
  if (!any) return { blocked: false, msgs: [] };
  var msgs = [];
  if (!isNaN(v.dia) && v.dia > 0) {
    var diaMm = Math.round(v.dia * 10);
    if (diaMm > MAX_LOG_WIDTH) {
      msgs.push('Diamètre ' + v.dia + ' cm (' + diaMm + ' mm) hors capacité des lignes A/B (max ' + MAX_LOG_WIDTH + ' mm).');
    } else {
      var motif = window._planningRenderer_ppMotifMm();
      if (motif > 0 && diaMm < motif) {
        msgs.push('Diamètre ' + v.dia + ' cm (' + diaMm + ' mm) insuffisant pour le motif de découpe (besoin ≥ ' + motif + ' mm).');
      }
    }
  }
  if (v.qty !== null && v.qty < 1) msgs.push('Quantité invalide (' + v.qty + ') : au moins 1 pièce.');
  return { blocked: msgs.length > 0, msgs: msgs };
};

window._planningRenderer_ppEssenceLabel = function(key) {
  var map = {
    spruce: 'Épicéa (Spruce)',
    'epicea': 'Épicéa (Spruce)',
    pin: 'Pin (Pine)',
    pine: 'Pin (Pine)',
    ekki: 'Ekki',
    azobe: 'Azobé',
    other: 'Autre / Inconnue'
  };
  return map[key] || String(key);
};

window._planningRenderer_updatePpPrediction = function() {
  var box = document.getElementById('ppPredictionBox');
  var volBox = document.getElementById('ppVolumeResult');
  var blkBox = document.getElementById('ppPredBlock');
  if (!box) return;
  if (volBox) volBox.innerHTML = '— m³';
  if (blkBox) { blkBox.style.display = 'none'; blkBox.innerHTML = ''; }

  if (typeof window.predictYieldModule === 'undefined' || typeof window.predictYieldModule.predictLogYield !== 'function') {
    box.innerHTML = '<div>Module de prédiction non chargé — <b>vérifier la liaison sciage-logic.js → predict-yield.js</b>.</div>';
    return;
  }

  var v = window._planningRenderer_ppSimVals();
  var diaOk = !isNaN(v.dia) && v.dia > 0;
  var lenOk = !isNaN(v.len) && v.len > 0;
  if (!diaOk || !lenOk) {
    box.innerHTML = 'Renseignez ' + (diaOk ? 'la longueur' : (lenOk ? 'le diamètre' : 'le diamètre (cm) et la longueur (m)')) + ' de la grume pour lancer la prédiction.';
    return;
  }

  var pred = null;
  try {
    pred = window.predictYieldModule.predictLogYield(v.ess, v.dia, v.len);
  } catch (e) {
    box.innerHTML = '<div style="color:#dc2626;">Prédiction indisponible : ' + escapeHtml(e && e.message ? e.message : String(e)) + '</div>';
    return;
  }

  var qty = (v.qty !== null && v.qty >= 1) ? v.qty : 1;
  var tGross = Number(((pred.grossVolume || 0) * qty).toFixed(4));
  var tUseful = Number(((pred.estimatedUsefulVolume || 0) * qty).toFixed(4));
  var tWaste = Number(((pred.estimatedWaste || 0) * qty).toFixed(4));
  var yieldTxt = pred.estimatedYieldRate || '—';
  var essLabel = window._planningRenderer_ppEssenceLabel(pred.essenceKey || v.ess);
  var diaMm = Math.round(v.dia * 10);
  var motif = window._planningRenderer_ppMotifMm();
  var yieldPct = parseFloat(String(yieldTxt).replace('%', ''));
  var retrait = pred.retraitPct || 0;

  if (volBox) {
    volBox.innerHTML = '<span style="font-weight:800;">' + Number(pred.grossVolume).toFixed(4) + ' m³</span><span style="font-size:11px;color:var(--text-muted);font-weight:500;margin-left:4px;">/ grume</span>';
  }

  var html = '';
  html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px;">';
  html += '<div style="padding:8px 10px;background:rgba(255,255,255,.05);border:1px solid var(--glass-border);border-radius:8px;"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;">Volume brut</div><div style="font-weight:800;font-size:13px;color:var(--text-primary);margin-top:2px;">' + tGross.toFixed(4) + ' m³</div><div style="font-size:10px;color:var(--text-muted);">' + Number(pred.grossVolume).toFixed(4) + ' m³ × ' + qty + (qty > 1 ? ' grumes' : ' grume') + '</div></div>';
  html += '<div style="padding:8px 10px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:8px;"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;">Volume utile estimé</div><div style="font-weight:800;font-size:13px;color:#10b981;margin-top:2px;">' + tUseful.toFixed(4) + ' m³</div><div style="font-size:10px;color:var(--text-muted);">' + yieldTxt + ' de rendement</div></div>';
  html += '<div style="padding:8px 10px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.22);border-radius:8px;"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;">Chutes / sciure</div><div style="font-weight:800;font-size:13px;color:#ef4444;margin-top:2px;">' + tWaste.toFixed(4) + ' m³</div></div>';
  html += '<div style="padding:8px 10px;background:rgba(59,130,246,.07);border:1px solid rgba(59,130,246,.22);border-radius:8px;"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;">Essence</div><div style="font-weight:800;font-size:13px;color:var(--text-primary);margin-top:2px;">' + escapeHtml(essLabel) + '</div><div style="font-size:10px;color:var(--text-muted);">' + escapeHtml(pred.famille || 'standard') + (retrait ? ' · retrait ' + retrait + '%' : '') + '</div></div>';
  html += '</div>';

  var guides = [];
  if (motif > 0) {
    if (diaMm < motif) guides.push({ t: 'error', m: 'Diamètre <b>' + v.dia + ' cm</b> insuffisant pour le motif courant : besoin ≥ <b>' + motif + ' mm</b>.' });
    else guides.push({ t: 'ok', m: 'Motif compatible : besoin ' + motif + ' mm ≤ Ø grume ' + diaMm + ' mm.' });
  }
  if (diaMm > MAX_LOG_WIDTH) guides.push({ t: 'error', m: 'Ø <b>' + diaMm + ' mm</b> hors capacité des lignes A/B (max ' + MAX_LOG_WIDTH + ' mm).' });
  if (v.len < 3 || v.len > 7) guides.push({ t: 'warn', m: 'Longueur <b>' + v.len + ' m</b> hors plage de réception habituelle (3–7 m).' });

  if (retrait >= 8) guides.push({ t: 'warn', m: 'Retrait séchage <b>élevé</b> (' + retrait + '%) : prévoir des surlargeurs, sinon les pièces passent sous cote après séchage.' });
  else if (retrait >= 6) guides.push({ t: 'info', m: 'Retrait séchage modéré (' + retrait + '%).' });
  else guides.push({ t: 'ok', m: 'Retrait séchage faible (' + retrait + '%) : bon maintien des cotes au séchage.' });

  if (!isNaN(yieldPct)) {
    if (yieldPct < 55) guides.push({ t: 'warn', m: 'Rendement estimé <b>faible</b> (' + yieldTxt + ') : forte perte en dosses/chutes possible — revoir la configuration de découpe.' });
    else guides.push({ t: 'ok', m: 'Rendement estimé <b>' + yieldTxt + '</b> : configuration de découpe rentable.' });
  }
  if (diaMm >= 380) guides.push({ t: 'info', m: 'Grosse grume : économie d\'échelle favorable — privilégier un débit complet (ex. 2 CC + 4 SB) pour maximiser la récupération.' });
  else if (motif > 0 && diaMm < 280) guides.push({ t: 'info', m: 'Grume fine : chaque millimètre compte — valider le motif avant lancement pour limiter dosses et tranches perdues.' });

  html += '<div style="display:flex;flex-direction:column;gap:5px;">';
  guides.forEach(function(g) {
    var color = g.t === 'error' ? '#ef4444' : (g.t === 'warn' ? '#f59e0b' : (g.t === 'ok' ? '#10b981' : '#3b82f6'));
    var icon = g.t === 'error' ? '✕' : (g.t === 'warn' ? '⚠' : (g.t === 'ok' ? '✓' : 'ℹ'));
    html += '<div style="font-size:11px;line-height:1.5;color:' + color + ';">' + icon + ' ' + g.m + '</div>';
  });
  html += '</div>';
  box.innerHTML = html;

  var blk = window._planningRenderer_ppBlockStatus();
  if (blkBox) {
    if (blk.blocked) {
      blkBox.style.display = '';
      blkBox.innerHTML = '⚠ ' + blk.msgs.map(escapeHtml).join('<br>');
    } else {
      blkBox.style.display = 'none';
      blkBox.innerHTML = '';
    }
  }
};

window._planningRenderer_renderPpWidthFields = function(containerId, prefix, values, labelText) {
  var el = document.getElementById(containerId);
  if (!el) return;
  if (!values.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Aucune ép saisie sur A1.</div>'; return; }
  var prevW1 = (document.getElementById(prefix + '1') || {}).value || '';
  var prevW2 = (document.getElementById(prefix + '2') || {}).value || '';
  var html = '<div class="form-grid form-grid-2">';
  values.forEach(function(v, i) {
    var w1 = (i === 0) ? prevW1 : prevW1;
    var w2 = (i === 0) ? prevW2 : prevW2;
    html += '<div class="form-group">'
      + '<label class="form-label">' + labelText + ' ' + (i + 1) + 'a (Ép. ' + v + ' mm)</label>'
      + '<input type="number" class="form-input" id="' + prefix + (i * 2 + 1) + '" placeholder="Larg. 1 pour ' + v + 'mm" min="1" step="any" value="' + w1 + '">'
      + '</div>';
    html += '<div class="form-group">'
      + '<label class="form-label">' + labelText + ' ' + (i + 1) + 'b (Ép. ' + v + ' mm)</label>'
      + '<input type="number" class="form-input" id="' + prefix + (i * 2 + 2) + '" placeholder="Larg. 2 pour ' + v + 'mm" min="1" step="any" value="' + w2 + '">'
      + '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
};

window._planningRenderer_parsePpLaterals = function(str) {
  var out = [];
  if (!str) return out;
  String(str).split(/[;\s]+/).forEach(function(p) {
    var v = parseFloat(String(p).replace(',', '.'));
    if (!isNaN(v) && v > 0) out.push(v);
  });
  return out;
};

window._planningRenderer_ppStatusLabel = function(s) {
  return s === 'realise' ? 'Réalisé' : (s === 'engage' ? 'Engagé' : 'Planifié');
};

window._planningRenderer_ppStatusColor = function(s) {
  return s === 'realise' ? '#059669' : (s === 'engage' ? '#f59e0b' : '#3b82f6');
};

window._planningRenderer_ppFilteredProdPlan = function() {
  var q = (document.getElementById('ppSearch') ? document.getElementById('ppSearch').value : '').toLowerCase();
  var st = document.getElementById('ppStatusFilter') ? document.getElementById('ppStatusFilter').value : '';
  var list = productionPlan.slice();
  if (q) list = list.filter(function(p) {
    return (p.wood || '').toLowerCase().indexOf(q) > -1 ||
           (p.essence || '').toLowerCase().indexOf(q) > -1 ||
           (p.ofNum || '').toLowerCase().indexOf(q) > -1;
  });
  if (st) list = list.filter(function(p) { return p.status === st; });
  return list;
};

window._planningRenderer_mapProdPlanRow = function(r) {
  var keys = Object.keys(r);
  function normHeader(s) {
    return String(s).toLowerCase()
      .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c')
      .replace(/\s+/g, '');
  }
  var normKeys = keys.map(normHeader);
  function find(names) {
    for (var i = 0; i < names.length; i++) {
      var idx = normKeys.indexOf(names[i]);
      if (idx > -1 && r[keys[idx]] !== undefined && r[keys[idx]] !== '') return r[keys[idx]];
    }
    return '';
  }
  function toNum(v) {
    if (v === '' || v === undefined || v === null) return NaN;
    return parseFloat(String(v).replace(/\s+/g, '').replace(',', '.'));
  }
  var laterals = window._planningRenderer_parsePpLaterals(String(find(['laterales', 'lateral', 'laterals', 'lat', 'largeurslaterales'])));
  var logWidth = toNum(find(['grume', 'largeurgrume', 'largeur', 'logwidth', 'lw']));
  var central = toNum(find(['centre', 'centrale', 'central', 'epaisseurcentrale', 'center']));
  var length = toNum(find(['longueur', 'longueurs', 'length', 'long']));
  var qty = toNum(find(['quantite', 'qte', 'qty', 'nb', 'nombre']));
  var thickness = toNum(find(['epaisseur', 'thickness', 'ep', 'epaisseurlame']));
  var line = String(find(['ligne', 'line', 'equipe'])).trim().toUpperCase();
  if (line.indexOf('B') > -1) line = 'B'; else line = 'A';
  return {
    wood: String(find(['bois', 'typebois', 'essence', 'typedebois', 'matiere'])).trim(),
    logWidth: logWidth,
    central: central,
    laterals: laterals,
    length: isNaN(length) ? null : length,
    qty: isNaN(qty) ? null : qty,
    thickness: isNaN(thickness) ? null : thickness,
    date: String(find(['date', 'dateprevue', 'echeance'])).trim(),
    line: line,
    notes: String(find(['notes', 'remarques', 'commentaire'])).trim()
  };
};

/* ─────────────────────────────────────────────
   Gros renders / add / engagement — passthrough (couplés app.js)
   ───────────────────────────────────────────── */

// Exact copy from app.js L8034
window._planningRenderer_renderPlanningList = function() {
  var el = document.getElementById('planningList');
  if (!el) return;
  if (planningTasks.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-text">Aucune tâche planifiée</div></div>';
    return;
  }
  var groups = {};
  planningTasks.slice().sort(function(a, b) { return (a.date + ' ' + a.time).localeCompare(b.date + ' ' + b.time); }).forEach(function(t) {
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  });
  var html = '<div class="dt-table dt-table-full"><div class="dt-head dt-head-full">'
    + '<span>Date</span><span>Tâche</span><span>Assigné</span><span>Priorité</span><span>Statut</span><span style="text-align:right;">⋮</span>'
    + '</div>';
  Object.keys(groups).sort().forEach(function(d) {
    groups[d].forEach(function(t, ti) {
      var pc = t.priority === 'Urgente' ? '#ef4444' : (t.priority === 'Haute' ? '#f59e0b' : (t.priority === 'Moyenne' ? '#3b82f6' : '#6b7280'));
      var done = t.status === 'done';
      html += '<div class="dt-row" style="' + (done ? 'opacity:.55;' : '') + '">';
      if (ti === 0) {
        html += '<span class="mp-dt-date" style="font-weight:700;color:var(--accent);">📅 ' + escapeHtml(d) + '</span>';
      } else {
        html += '<span class="mp-dt-date"></span>';
      }
      html += '<span class="mp-dt-autres">' + (done ? '<s>' : '') + escapeHtml(t.title) + (done ? '</s>' : '') + (t.notes ? '<div style="font-size:10px;color:var(--text-muted);">' + escapeHtml(t.notes) + '</div>' : '');
      if (t.time) html += '<div style="font-size:10px;color:var(--text-muted);">🕒 ' + escapeHtml(t.time) + '</div>';
      html += '</span>';
      html += '<span class="mp-dt-type">' + escapeHtml(t.assign || '—') + '</span>';
      html += '<span class="mp-dt-cons" style="color:' + pc + ';font-weight:600;">' + escapeHtml(t.priority) + '</span>';
      // security-check: allow planningStatusLabel() est totale (ternaire ferme, aucun fallback brut)
      html += '<span class="mp-dt-stat">' + planningStatusLabel(t.status) + '</span>';
      html += '<span class="mp-dt-actions" style="text-align:right;white-space:nowrap;">';
      html += '<button onclick="togglePlanningStatus(\'' + t.id + '\')" style="background:none;border:1px solid var(--border);border-radius:8px;color:var(--accent);font-size:11px;cursor:pointer;padding:4px 8px;margin-right:6px;">' + (done ? '↺' : (t.status === 'doing' ? '✓' : '▶')) + '</button>';
      html += '<button onclick="deletePlanningTask(\'' + t.id + '\')" style="background:none;border:none;color:var(--danger);font-size:14px;cursor:pointer;padding:4px;">✕</button>';
      html += '</span></div>';
    });
  });
  html += '</div>';
  el.innerHTML = html;
}
window._planningRenderer_saveProdPlan = function() { safeSave('charben_prodplan', productionPlan); };

window._planningRenderer_renderProdPlanList = function() {
  var el = document.getElementById('prodPlanList');
  if (!el) return;
  var list = ppFilteredProdPlan();
  var st = document.getElementById('ppStatusFilter') ? document.getElementById('ppStatusFilter').value : '';
  var countEl = document.getElementById('ppCount');
  if (countEl) countEl.textContent = '· ' + productionPlan.length + ' ordre(s)';

  var html = '<div class="dt-toolbar">';
  html += '<div class="dt-search-wrap"><span style="color:var(--text-muted);"><i data-lucide="search" style="width:14px;height:14px;"></i></span>';
  html += '<input class="dt-search" id="ppSearch" placeholder="Rechercher bois, essence, OF..." value="' + escapeHtml(document.getElementById('ppSearch') ? document.getElementById('ppSearch').value : '') + '" oninput="renderProdPlanList()">';
  html += '</div>';
  html += '<select class="form-input" id="ppStatusFilter" style="flex:0 0 auto;width:auto;min-width:0;padding:8px 30px 8px 10px;font-size:12px;" onchange="renderProdPlanList()">';
  html += '<option value="">Tous</option><option value="planifie"' + (st === 'planifie' ? ' selected' : '') + '>Planifié</option><option value="engage"' + (st === 'engage' ? ' selected' : '') + '>Engagé</option><option value="realise"' + (st === 'realise' ? ' selected' : '') + '>Réalisé</option>';
  html += '</select>';
  html += '</div>';

  if (list.length === 0) {
    html += '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">Aucun ordre de production</div></div>';
    el.innerHTML = html;
    return;
  }

  var allSelected = list.every(function(p) { return ppSelected[p.id]; });
  html += '<div class="dt-table"><div class="dt-head pp-head">';
  html += '<input type="checkbox" class="dt-checkbox" ' + (allSelected ? 'checked' : '') + ' onchange="ppToggleSelectAll()">';
  html += '<span>Statut</span><span>Ordre</span><span>Découpe</span><span>Quantité</span>';
  html += '</div>';

  list.forEach(function(p) {
    var sel = !!ppSelected[p.id];
    var pc = ppStatusColor(p.status);
    var ccStr = (p.ccEpaisseurs && p.ccEpaisseurs.length) ? p.ccEpaisseurs.join('/') : (p.central + (p.central2 ? '/' + p.central2 : ''));
    var sbStr = (p.ccEpaisseurs && p.ccEpaisseurs.length) ? (p.laterals.length ? p.laterals.join('/') : '') : (p.laterals.length ? p.laterals.join(';') : '');
    var cfg;
    if (p.logWidthMin && p.logWidthMin !== p.logWidth) {
      cfg = p.logWidthMin + '–' + p.logWidth + 'mm · CC:' + ccStr + 'mm' + (sbStr ? ' · SB:' + sbStr + 'mm' : '');
    } else {
      cfg = p.logWidth + 'mm · CC:' + ccStr + 'mm' + (sbStr ? ' · SB:' + sbStr + 'mm' : '');
    }
    var extra = [];
    if (p.length) extra.push(p.length + 'mm');
    if (p.thickness) extra.push(p.thickness + 'mm');
    var qtyTxt = p.qty ? p.qty + ' pcs' : '—';
    html += '<div class="dt-row pp-row ' + (sel ? 'selected' : '') + '" onclick="ppToggleSelect(\'' + p.id + '\')">';
    html += '<input type="checkbox" class="dt-checkbox" ' + (sel ? 'checked' : '') + ' onclick="event.stopPropagation();ppToggleSelect(\'' + p.id + '\')">';
    html += '<div>';
    // security-check: allow ppStatusLabel() est totale (ternaire ferme, aucun fallback brut)
    html += '<span class="status-badge" style="background:' + pc + '18;color:' + pc + ';border:1px solid ' + pc + '55;font-size:10px;padding:3px 8px;">' + ppStatusLabel(p.status) + '</span>';
    if (p.ofNum) html += '<div style="font-size:10px;font-weight:700;color:var(--accent-primary, #2e7d32);margin-top:3px;">' + escapeHtml(p.ofNum) + '</div>';
    html += '</div>';
    html += '<div>';
    html += '<div class="pp-ref">' + escapeHtml(p.wood || 'Bois non renseigné') + '</div>';
    html += '</div>';
    html += '<div style="font-size:11px;color:var(--text-secondary);">';
    html += escapeHtml(cfg);
    if (extra.length) html += '<br><span style="color:var(--text-muted);">' + extra.map(escapeHtml).join(' · ') + '</span>';
    html += '</div>';
    html += '<div style="font-size:11px;">';
    html += '<div style="font-weight:600;">' + qtyTxt + '</div>';
    html += '<div style="font-size:10px;color:var(--text-muted);">' + escapeHtml(p.date) + ' · L' + escapeHtml(p.line) + (p.machine ? ' · ' + escapeHtml(p.machine) : '') + '</div>';
    html += '</div>';
    html += '</div>';
  });

  html += '</div>';

  var selCount = Object.keys(ppSelected).filter(function(id) { return ppSelected[id]; }).length;
  if (selCount > 0) {
    html += '<div class="bulk-actions-toolbar">';
    html += '<span class="bulk-label">' + selCount + ' sélectionné(s)</span>';
    html += '<button class="btn btn-sm btn-secondary" onclick="engageProdPlan()">Engager</button>';
    html += '<button class="btn btn-sm btn-danger" onclick="deleteSelectedProdPlan()">Supprimer</button>';
    html += '<button class="btn btn-sm btn-ghost" onclick="ppClearSelection()">Annuler</button>';
    html += '</div>';
  }

  el.innerHTML = html;
  renderLucide();
};

window._planningRenderer_ppToggleSelect = function(id) {
  if (ppSelected[id]) delete ppSelected[id];
  else ppSelected[id] = true;
  renderProdPlanList();
};

window._planningRenderer_ppToggleSelectAll = function() {
  var list = ppFilteredProdPlan();
  var all = list.length > 0 && list.every(function(p) { return ppSelected[p.id]; });
  list.forEach(function(p) { if (all) delete ppSelected[p.id]; else ppSelected[p.id] = true; });
  renderProdPlanList();
};

window._planningRenderer_ppClearSelection = function() {
  ppSelected = {};
  renderProdPlanList();
};

window._planningRenderer_deleteSelectedProdPlan = function() {
  var ids = Object.keys(ppSelected).filter(function(id) { return ppSelected[id]; });
  if (ids.length === 0) return;
  productionPlan = productionPlan.filter(function(p) { return !ppSelected[p.id]; });
  ids.forEach(function(id) { delete ppSelected[id]; });
  window._planningRenderer_saveProdPlan();
  fsSave('prod', productionPlan);
  renderProdPlanList();
  showToast('Ordre(s) supprimé(s).', 'success');
};

window._planningRenderer_createOfFromSpec = function(line) {
  var laterals = line.laterals || [];
  var logWidthMin = parseFloat(line.logWidthMin) || parseFloat(line.logWidth) || 0;
  var logWidthMax = parseFloat(line.logWidthMax) || MAX_LOG_WIDTH;
  var logWidth = logWidthMin;
  var central = parseFloat(line.central);
  if (!logWidth || logWidth <= 0 || !central || central <= 0) return null;
  if (logWidth > MAX_LOG_WIDTH) return null;
  var sumSingle = central + laterals.reduce(function(a, b) { return a + b; }, 0);
  var sumDouble = sumSingle * 2;
  var ccCount = (line.central2 && parseFloat(line.central2) > 0) ? 2 : 1;
  var pieceCount = ccCount + laterals.length;
  var machine = line.machine || line.line || 'A';
  var isDebit = machine === 'A1' || machine === 'B1';
  var effectiveMaxBlades = isDebit ? 17 : MAX_BLADES;
  var diskCount = 2 * pieceCount + 1;
  if (diskCount > effectiveMaxBlades) return null;
  var diskTotal = diskCount * DISK_THICKNESS;
  var totalConsumed = sumDouble + diskTotal;
  var chute = +(logWidth - totalConsumed).toFixed(2);
  if (chute < 0) return null;
  orderCounter++;
  var orderNum = 'OF-' + String(orderCounter).padStart(4, '0');
  var now = new Date();
  var order = {
    orderNum: orderNum,
    date: now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    line: dashboardRenderer.ofLine(line),
    machine: line.machine || (line.line || 'A'),
    logWidth: logWidth,
    logWidthMin: logWidthMin,
    logWidthMax: logWidthMax,
    central: central,
    central2: (line.central2 && parseFloat(line.central2) > 0) ? parseFloat(line.central2) : null,
    laterals: laterals.slice(),
    pieceCount: pieceCount,
    diskCount: diskCount,
    totalConsumed: totalConsumed,
    chute: chute,
    ppId: line.id,
    clientName: line.clientName || '',
    reference: line.reference || '',
    status: 'engage',
    wood: line.wood || '',
    essence: (line.essence && GAMME_ESSENCES[line.essence]) ? line.essence : 'spruce',
    centerWidth: (line.centerWidth && parseFloat(line.centerWidth) > 0) ? line.centerWidth : ((line.ccLargeurs && line.ccLargeurs.length && parseFloat(line.ccLargeurs[0]) > 0) ? line.ccLargeurs[0] : null),
    lateralWidths: (line.lateralWidths && line.lateralWidths.length) ? line.lateralWidths.slice() : ((line.sbLargeurs && line.sbLargeurs.length) ? line.sbLargeurs.slice() : []),
    length: line.length || null,
    qty: line.qty || null,
    plannedDate: line.date || null,
    notes: line.notes || '',
    margin: line.margin || null,
    dosses: line.dosses || null,
    thickness: line.thickness || 0,
    ccWidths: line.ccWidths || [],
    sbWidths: line.sbWidths || []
  };
  /* ── Résolution largeurs standard si absentes (gamme) ── */
  if (order.centerWidth == null && typeof resolveOfWidths === 'function') {
    try {
      var rw = resolveOfWidths(order) || {};
      if (rw.centerWidth > 0) order.centerWidth = rw.centerWidth;
      if (!order.lateralWidths.length && rw.lateralWidths && rw.lateralWidths.length) order.lateralWidths = rw.lateralWidths;
      if (order.central2 && parseFloat(order.central2) > 0 && rw.centerWidth > 0) {
        order.ccWidths = [rw.centerWidth, rw.centerWidth];
      }
    } catch (e) { errLog('planning-renderer', 'resolveOfWidths', e, 'warn'); }
  }
  orders.unshift(order);
  setLineOrder(order.line, order);
  safeSave(STORAGE_KEYS.orders, orders);
  safeSave(STORAGE_KEYS.counter, orderCounter);
  fsSave('orders', orders);
  return orderNum;
};

window._planningRenderer_engageProdPlan = function() {
  var list = ppFilteredProdPlan().filter(function(p) { return ppSelected[p.id] && p.status === 'planifie'; });
  if (list.length === 0) { showToast('Sélectionnez des ordres planifiés.', 'warning'); return; }
  var created = [], errors = [];
  list.forEach(function(p) {
    var r = createOfFromSpec(p);
    if (r) { p.status = 'engage'; p.ofNum = r; created.push(r); }
    else errors.push(p.id);
  });
  window._planningRenderer_saveProdPlan();
  fsSave('prod', productionPlan);
  ppSelected = {};
  renderProdPlanList();
  renderOrdersList();
  refreshDashboard(true);
  if (typeof syncToAllTabs === 'function') syncToAllTabs();
  if (created.length) showToast(created.length + ' OF créé(s) : ' + created.join(', '), 'success');
  if (errors.length) showToast('Impossible d\'engager : ' + errors.join(', '), 'error');
};

window._planningRenderer_addProdPlan = function() {
  var ppBlk = window._planningRenderer_ppBlockStatus();
  if (ppBlk.blocked) {
    var blkMsgEl = document.getElementById('ppMsg');
    if (blkMsgEl) blkMsgEl.innerHTML = '<span style="color:var(--danger);">⚠ ' + ppBlk.msgs.map(escapeHtml).join('<br>') + '</span>';
    return;
  }
  var ppEssSel = document.getElementById('ppEssence');
  var essence = (ppEssSel && GAMME_ESSENCES[ppEssSel.value]) ? ppEssSel.value : gammeEssence();
  var wood = (GAMME_ESSENCES[essence] && GAMME_ESSENCES[essence].label) || essence;
  var ccVals = readPpCcValues();
  var sbVals = readPpSbValues();
  var central = ccVals.length ? ccVals[0] : 0;
  var central2 = ccVals.length > 1 ? ccVals[1] : null;
  var laterals = sbVals;
  var qty = parseFloat(document.getElementById('ppQty').value);
  var date = document.getElementById('ppDate').value;
  var line = document.getElementById('ppLine').value;
  var machine = (document.getElementById('ppMachine') || {}).value || (line === 'B' ? 'B1' : 'A1');
  var thickness = DISK_THICKNESS;
  var notes = document.getElementById('ppNotes').value.trim();
  var msgEl = document.getElementById('ppMsg');
  var margin = parseFloat(document.getElementById('ppMargin') ? document.getElementById('ppMargin').value : '') || 0;
  var ccWidths = [];
  for (var i = 1; i <= 4; i++) { var w = parseFloat(document.getElementById('ppCcw' + i) ? document.getElementById('ppCcw' + i).value : ''); if (!isNaN(w) && w > 0) ccWidths.push(w); }
  var sbWidths = [];
  for (var j = 1; j <= 8; j++) { var ww = parseFloat(document.getElementById('ppSbw' + j) ? document.getElementById('ppSbw' + j).value : ''); if (!isNaN(ww) && ww > 0) sbWidths.push(ww); }
  if (!date) date = new Date().toISOString().slice(0, 10);
  if (!central || central <= 0) { msgEl.innerHTML = '<span style="color:var(--danger);">Saisissez au moins une épaisseur CC 1.</span>'; return; }
  var pieceCount = ccVals.length + laterals.length;
  var debitMachine = (line === 'B') ? 'B1' : 'A1';
  var isDebit = true;
  var effectiveMaxBlades = 17;
  var diskCount = 2 * pieceCount + 1;
  if (diskCount > effectiveMaxBlades) {
    msgEl.innerHTML = '<span style="color:var(--danger);">Trop de pièces (' + pieceCount + ') pour le débit (' + diskCount + ' disques). Max: ' + effectiveMaxBlades + ' lames.</span>';
    return;
  }
  var sumSingle = ccVals.reduce(function(a, b) { return a + b; }, 0) + laterals.reduce(function(a, b) { return a + b; }, 0);
  var diskTotal = diskCount * DISK_THICKNESS;
  var totalConsumed = sumSingle * 2 + diskTotal;
  var logWidthMin = totalConsumed;
  var logWidth = totalConsumed;
  var logWidthMax = MAX_LOG_WIDTH;
  productionPlan.push({
    id: 'pp_' + Date.now() + '_' + productionPlan.length,
    wood: wood,
    essence: essence,
    logWidth: logWidth,
    logWidthMin: logWidthMin,
    logWidthMax: logWidthMax,
    central: central,
    central2: central2,
    laterals: laterals.slice(),
    ccWidths: ccWidths,
    sbWidths: sbWidths,
    length: parseFloat(document.getElementById('ppLength') ? document.getElementById('ppLength').value : '') || null,
    qty: qty,
    thickness: thickness,
    date: date,
    line: line,
    machine: machine,
    notes: notes,
    margin: margin,
    status: 'planifie',
    ofNum: null,
    createdAt: new Date().toISOString()
  });
  window._planningRenderer_saveProdPlan();
  fsSave('prod', productionPlan);
  renderProdPlanList();
  showToast('Ordre ajouté au planning.', 'success');
  document.getElementById('ppQty').value = '';
  if (document.getElementById('ppNotes')) document.getElementById('ppNotes').value = '';
  msgEl.innerHTML = '';
  window._planningRenderer_updatePpPrediction();
};

/* ─────────────────────────────────────────────
   TÂCHES — add / toggle / delete (intégration agenda)
   ───────────────────────────────────────────── */

window._planningRenderer_addPlanningTask = function() {
  var titleEl = document.getElementById('planTitle');
  var dateEl = document.getElementById('planDate');
  var timeEl = document.getElementById('planTime');
  var assignEl = document.getElementById('planAssign');
  var priorityEl = document.getElementById('planPriority');
  var notesEl = document.getElementById('planNotes');
  var msgEl = document.getElementById('planningMsg');
  if (!titleEl || !dateEl) return;

  var title = titleEl.value.trim();
  var date = dateEl.value;
  var time = timeEl ? timeEl.value : '';
  var assign = assignEl ? assignEl.value : '';
  var priority = priorityEl ? priorityEl.value : 'Moyenne';
  var notes = notesEl ? notesEl.value.trim() : '';

  if (!title) {
    if (msgEl) msgEl.innerHTML = '<span style="color:var(--danger);">Saisissez un titre de tâche.</span>';
    return;
  }
  if (!date) date = new Date().toISOString().slice(0, 10);

  var task = {
    id: 'task_' + Date.now() + '_' + planningTasks.length,
    title: escapeHtml(title),
    date: date,
    time: time,
    assign: assign,
    priority: priority,
    notes: notes,
    status: 'todo',
    createdAt: new Date().toISOString()
  };

  planningTasks.push(task);
  safeSave('charben_planning', planningTasks);
  fsSave('planning', planningTasks);
  renderPlanningList();

  /* ── Auto-rappel pour la tâche ── */
  if (typeof ofReminders !== 'undefined' && date) {
    ofReminders.autoForOf(task.id, task.title, date);
  }

  /* ── Rafraîchir l'agenda si visible ── */
  if (typeof agendaRenderer !== 'undefined') {
    agendaRenderer.renderAgenda();
  }

  if (msgEl) msgEl.innerHTML = '<span style="color:var(--success);">Tâche ajoutée à l\'agenda.</span>';
  titleEl.value = '';
  if (notesEl) notesEl.value = '';
  if (typeof showToast === 'function') showToast('Tâche planifiée : ' + task.title, 'success');
};

window._planningRenderer_togglePlanningStatus = function(taskId) {
  for (var i = 0; i < planningTasks.length; i++) {
    if (planningTasks[i].id === taskId) {
      var t = planningTasks[i];
      if (t.status === 'todo') t.status = 'doing';
      else if (t.status === 'doing') t.status = 'done';
      else t.status = 'todo';
      break;
    }
  }
  safeSave('charben_planning', planningTasks);
  fsSave('planning', planningTasks);
  renderPlanningList();
  if (typeof agendaRenderer !== 'undefined') {
    agendaRenderer.renderAgenda();
  }
};

window._planningRenderer_deletePlanningTask = function(taskId) {
  showModal('Supprimer', 'Supprimer cette tâche ?', '🗑', function() {
    planningTasks = planningTasks.filter(function(t) { return t.id !== taskId; });
    safeSave('charben_planning', planningTasks);
    fsSave('planning', planningTasks);
    renderPlanningList();
    if (typeof agendaRenderer !== 'undefined') {
      agendaRenderer.renderAgenda();
    }
    showToast('Tâche supprimée', 'success');
  });
};

/* ─────────────────────────────────────────────
   EXPORT GLOBAL
   ───────────────────────────────────────────── */

window.planningRenderer = {
  saveProdPlan: window._planningRenderer_saveProdPlan,
  planningStatusLabel: window._planningRenderer_planningStatusLabel,
  switchPlanTab: window._planningRenderer_switchPlanTab,
  selectPpLine: window._planningRenderer_selectPpLine,
  renderPpMachines: window._planningRenderer_renderPpMachines,
  selectPpMachine: window._planningRenderer_selectPpMachine,
  togglePpSecondarySb: window._planningRenderer_togglePpSecondarySb,
  togglePpSecondaryCc: window._planningRenderer_togglePpSecondaryCc,
  readPpCcValues: window._planningRenderer_readPpCcValues,
  readPpSbValues: window._planningRenderer_readPpSbValues,
  syncPpWidths: window._planningRenderer_syncPpWidths,
  updatePpGrumePreview: window._planningRenderer_updatePpGrumePreview,
  ppSimVals: window._planningRenderer_ppSimVals,
  ppMotifMm: window._planningRenderer_ppMotifMm,
  ppBlockStatus: window._planningRenderer_ppBlockStatus,
  ppEssenceLabel: window._planningRenderer_ppEssenceLabel,
  updatePpPrediction: window._planningRenderer_updatePpPrediction,
  renderPpWidthFields: window._planningRenderer_renderPpWidthFields,
  parsePpLaterals: window._planningRenderer_parsePpLaterals,
  ppStatusLabel: window._planningRenderer_ppStatusLabel,
  ppStatusColor: window._planningRenderer_ppStatusColor,
  ppFilteredProdPlan: window._planningRenderer_ppFilteredProdPlan,
  mapProdPlanRow: window._planningRenderer_mapProdPlanRow,
  renderPlanningList: window._planningRenderer_renderPlanningList,
  addProdPlan: window._planningRenderer_addProdPlan,
  renderProdPlanList: window._planningRenderer_renderProdPlanList,
  ppToggleSelect: window._planningRenderer_ppToggleSelect,
  ppToggleSelectAll: window._planningRenderer_ppToggleSelectAll,
  ppClearSelection: window._planningRenderer_ppClearSelection,
  deleteSelectedProdPlan: window._planningRenderer_deleteSelectedProdPlan,
  createOfFromSpec: window._planningRenderer_createOfFromSpec,
  engageProdPlan: window._planningRenderer_engageProdPlan,
  addPlanningTask: window._planningRenderer_addPlanningTask,
  togglePlanningStatus: window._planningRenderer_togglePlanningStatus,
  deletePlanningTask: window._planningRenderer_deletePlanningTask
};