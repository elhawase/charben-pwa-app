/**
 * SETTINGS-MANAGER.JS — Paramètres, préférences, thème.
 * Copies EXACTES des fonctions smalls ; renderMiscSettings complet.
 * Globals: getActiveOrder, escapeHtml, renderLucide, settingsSwitchRow,
 *          renderAlertsPanel, showToast, toggleTheme, currentRole,
 *          setAppPref, getAppPref
 */
'use strict';

/* ─────────────────────────────────────────────
   getAppPref / setAppPref — copies EXACTES
   Extrait EXACT: app.js lignes 348-357
   ───────────────────────────────────────────── */

window._settingsManager_getAppPref = function(key, def) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : v;
  } catch (e) { return def; }
};

window._settingsManager_setAppPref = function(key, val) {
  try { localStorage.setItem(key, val); } catch (e) {}
};

/* ─────────────────────────────────────────────
   renderSettingsSync — copie EXACTE
   Extrait EXACT: app.js lignes 335-346
   ───────────────────────────────────────────── */

window._settingsManager_renderSettingsSync = function() {
  const el = document.getElementById('settingsSyncInfo');
  if (!el) return;
  const o = getActiveOrder();
  if (!o) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'inline-flex';
  el.innerHTML = '<i data-lucide="link-2" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"></i>' + escapeHtml(o.orderNum) + ' appliqué';
  renderLucide();
};

/* ─────────────────────────────────────────────
   renderMiscSettings — copie EXACTE
   Extrait EXACT: app.js lignes 359-409
   ───────────────────────────────────────────── */

window._settingsManager_renderMiscSettings = function() {
  const el = document.getElementById('miscSettings');
  if (!el) return;
  const notifOn = getAppPref('charben_notif_on', '1') === '1';
  const syncOn = getAppPref('charben_auto_sync', '1') === '1';
  const isDark = (document.documentElement.getAttribute('data-theme') || 'light') === 'dark';

  let html = '';

  html += settingsSwitchRow('notif', 'Notifications / Alertes', 'Afficher les alertes du tableau de bord (stock bas, équipements hors service, non-conformités...).', notifOn, 'notifOnChange()');
  html += settingsSwitchRow('sync', 'Synchronisation automatique', 'Synchronisation temps réel avec le serveur (Firestore).', syncOn, 'autoSyncChange()');
  html += settingsSwitchRow('theme', 'Thème sombre', 'Basculer l\'interface entre mode sombre et mode clair.', isDark, 'themeChange()');

  /* ── Objectifs mensuels de sciage ── */
  const lineObj = loadFromStorage('charben_line_objectives', { A: { monthly_m3: 0 }, B: { monthly_m3: 0 } });
  const objA = (lineObj && lineObj.A && lineObj.A.monthly_m3) || 0;
  const objB = (lineObj && lineObj.B && lineObj.B.monthly_m3) || 0;
  html += '<div class="settings-row settings-row-stack">';
  html += '<div><div class="settings-row-title">Objectifs mensuels de sciage</div>';
  html += '<div class="settings-row-desc">Définir les objectifs m\u00b3 par ligne pour le suivi de rendement.</div></div>';
  html += '<div style="width:100%;margin-top:10px;display:flex;flex-direction:column;gap:10px;">';
  html += '<div style="display:flex;align-items:center;gap:10px;">';
  html += '<span style="width:60px;font-size:13px;font-weight:800;color:#10b981;">Ligne A</span>';
  html += '<input type="number" id="objLineA" class="form-input" style="flex:1;max-width:120px;" value="' + objA + '" min="0" step="1" placeholder="m\u00b3">';
  html += '<span style="font-size:11px;color:var(--text-muted);">m\u00b3 / mois</span>';
  html += '</div>';
  html += '<div style="display:flex;align-items:center;gap:10px;">';
  html += '<span style="width:60px;font-size:13px;font-weight:800;color:#a78bfa;">Ligne B</span>';
  html += '<input type="number" id="objLineB" class="form-input" style="flex:1;max-width:120px;" value="' + objB + '" min="0" step="1" placeholder="m\u00b3">';
  html += '<span style="font-size:11px;color:var(--text-muted);">m\u00b3 / mois</span>';
  html += '</div>';
  html += '<button class="btn btn-sm btn-primary" onclick="saveLineObjectives()" style="align-self:flex-start;">Enregistrer les objectifs</button>';
  html += '</div></div>';

  html += '<div class="settings-row settings-row-stack">';
  html += '<div><div class="settings-row-title">Sauvegarde & Données</div><div class="settings-row-desc">Exporter ou restaurer vos données (stock, OF, réglages, planning).</div></div>';
  html += '<div class="settings-actions">';
  html += '<button class="btn btn-sm btn-secondary" onclick="exportData(\'json\')">JSON</button>';
  html += '<button class="btn btn-sm btn-secondary" onclick="exportData(\'csv\')">CSV</button>';
  html += '<button class="btn btn-sm btn-success" onclick="exportExcel()">Excel</button>';
  html += '<button class="btn btn-sm btn-primary" onclick="importData()">Importer</button>';
  html += '</div></div>';

  html += '<div class="settings-row settings-row-stack">';
  html += '<div><div class="settings-row-title" style="color:var(--danger, #ef4444);">Réinitialiser les données</div><div class="settings-row-desc">Efface toutes les données locales et synchronisées de l\'application.</div></div>';
  html += '<button class="btn btn-sm btn-danger" onclick="resetAllData()">Réinitialiser</button></div>';

  html += '<div class="settings-about">';
  html += '<div class="settings-row-title">À propos</div>';
  html += '<div class="settings-about-line"><span>Application</span><b>Gestion des Découpes</b></div>';
  html += '<div class="settings-about-line"><span>Version</span><b>v8.0 Pro</b></div>';
  html += '<div class="settings-about-line"><span>Société</span><b>SARL Charben Industrie</b></div>';
  html += '<div class="settings-about-line"><span>Rôle</span><b>' + escapeHtml(currentRole || '—') + '</b></div>';
  html += '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;">Réglage d\'arbre, stock de cales et ordres de fabrication pour atelier de sciage — © ' + new Date().getFullYear() + ' SARL Charben Industrie.</div>';
  html += '</div>';

  if (currentRole === 'admin') {
    html += '<div class="settings-row settings-row-stack" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border-color);">';
    html += '<div><div class="settings-row-title"><i data-lucide="megaphone" style="width:16px;height:16px;vertical-align:-2px;margin-right:6px;"></i>Message utilisateurs (bannière)</div>';
    html += '<div class="settings-row-desc">Ce message s\'affichera sur l\'écran d\'accueil de tous les utilisateurs.</div></div>';
    html += '<div style="width:100%;margin-top:8px;">';
    html += '<textarea id="adminBroadcastInput" class="form-input" rows="3" placeholder="Entrez le message à diffuser..."></textarea>';
    html += '<div style="margin-top:8px;display:flex;gap:8px;">';
    html += '<button class="btn btn-primary btn-sm" onclick="saveAdminBroadcast()">Enregistrer</button>';
    html += '<button class="btn btn-secondary btn-sm" onclick="clearAdminBroadcast()">Effacer</button>';
    html += '</div></div></div>';
  }

  el.innerHTML = html + '<input type="file" id="importFile" accept=".json,.csv" style="display:none" onchange="handleImport(event)">';
  renderLucide();
  window._settingsManager_renderGrumeClassesForm();
};

/* ─────────────────────────────────────────────
   notifOnChange / autoSyncChange / themeChange — EXACTES
   Extrait EXACT: app.js lignes 420-438
   ───────────────────────────────────────────── */

window._settingsManager_saveLineObjectives = function() {
  var a = parseFloat(document.getElementById('objLineA').value) || 0;
  var b = parseFloat(document.getElementById('objLineB').value) || 0;
  var obj = { A: { monthly_m3: a }, B: { monthly_m3: b } };
  saveToStorage('charben_line_objectives', obj);
  if (typeof fsSave === 'function') { try { fsSave('lineObj', obj); } catch (e) {} }
  showToast('Objectifs enregistr\u00e9s : A = ' + a + ' m\u00b3, B = ' + b + ' m\u00b3', 'success');
  renderDashboardKPIs();
};

window._settingsManager_notifOnChange = function() {
  const on = document.getElementById('notif').checked;
  setAppPref('charben_notif_on', on ? '1' : '0');
  renderAlertsPanel();
  showToast(on ? 'Notifications activées' : 'Notifications désactivées', 'info');
};

window._settingsManager_autoSyncChange = function() {
  const on = document.getElementById('sync').checked;
  setAppPref('charben_auto_sync', on ? '1' : '0');
  showToast(on ? 'Synchronisation automatique activée' : 'Synchronisation automatique désactivée', 'info');
};

window._settingsManager_themeChange = function() {
  toggleTheme();
  const isDark = (document.documentElement.getAttribute('data-theme') || 'light') === 'dark';
  const c = document.getElementById('theme');
  if (c) c.checked = isDark;
};

/* ─────────────────────────────────────────────
   Classes de grumes (C1, C2, C3) — Plan Q, étape UI
   Panneau éditable (admin / responsable_technique) branché sur
   RulesEngine.setGrumeClasses(). La logique pure est isolée dans
   grumeClassesFromInputs pour être testable en Node.
   ───────────────────────────────────────────── */

window._settingsManager_grumeClassesFromInputs = function(v) {
  const min = Number(v && v.minLim);
  const max = Number(v && v.maxLim);
  const b1 = Number(v && v.c1max);
  const b2 = Number(v && v.c2max);
  const entiers = [min, max, b1, b2].every(x => Number.isInteger(x) && x > 0);
  if (!entiers) {
    return { ok: false, error: 'Valeurs invalides : saisissez des entiers positifs (mm).' };
  }
  if (min >= max) {
    return { ok: false, error: 'Limites globales incohérentes : le minimum (' + min + ') doit être strictement inférieur au maximum (' + max + ').' };
  }
  if (b1 < min) {
    return { ok: false, error: 'C1.max (' + b1 + ') doit être ≥ la limite globale (' + min + ').' };
  }
  if (b2 <= b1) {
    return { ok: false, error: 'C2.max (' + b2 + ') doit être > C1.max (' + b1 + ') (classes contiguës).' };
  }
  if (b2 >= max) {
    return { ok: false, error: 'C2.max (' + b2 + ') doit être < la limite globale (' + max + ') pour laisser une classe C3.' };
  }
  return {
    ok: true,
    minLim: min,
    maxLim: max,
    classes: {
      C1: { label: 'Petits', min: min, max: b1 },
      C2: { label: 'Moyens', min: b1 + 1, max: b2 },
      C3: { label: 'Gros', min: b2 + 1, max: max }
    }
  };
};

window._settingsManager_buildGrumeClassesForm = function(classes, dims, editable) {
  const minL = Number(dims && dims.MIN_LOG_WIDTH);
  const maxL = Number(dims && dims.MAX_LOG_WIDTH);
  const c1 = (classes && classes.C1) || {};
  const c2 = (classes && classes.C2) || {};
  const c3 = (classes && classes.C3) || {};
  const ro = editable ? '' : ' disabled';
  const onIp = editable ? ' oninput="recomputeGrumeClasses()"' : '';

  let html = '';
  if (editable) {
    html += '<div class="settings-row-desc" style="margin-bottom:10px;">Modifiez les bornes puis enregistrez. Les bornes dérivées (C2.min, C3.min, C3.max) sont recalculées automatiquement ; le moteur valide la contiguïté avant d\'écrire.</div>';
  } else {
    html += '<div class="settings-row-desc" style="margin-bottom:10px;">Modification réservée aux administrateurs et responsables techniques.</div>';
  }

  html += '<div class="settings-row settings-row-stack">';
  html += '<div><div class="settings-row-title"><i data-lucide="ruler" style="width:16px;height:16px;vertical-align:-2px;margin-right:6px;"></i>Limites globales des grumes</div>';
  html += '<div class="settings-row-desc">Diamètre minimal et maximal acceptés dans le flux (mm). C1.min et C3.max s\'alignent automatiquement sur ces valeurs.</div></div>';
  html += '<div style="width:100%;margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">';
  html += '<span style="font-size:11px;color:var(--text-muted);">De</span>';
  html += '<input type="number" id="gcl_min_lim" class="form-input" style="max-width:110px;" value="' + minL + '" min="1" step="1"' + ro + onIp + '>';
  html += '<span style="font-size:11px;color:var(--text-muted);">à</span>';
  html += '<input type="number" id="gcl_max_lim" class="form-input" style="max-width:110px;" value="' + maxL + '" min="1" step="1"' + ro + onIp + '>';
  html += '<span style="font-size:11px;color:var(--text-muted);">mm</span>';
  html += '</div></div>';

  const lignes = [
    { code: 'C1', label: c1.label, couleur: '#10b981', minVal: c1.min, minId: 'gcl_c1min', maxVal: c1.max, maxId: 'gcl_c1max', maxEditable: true },
    { code: 'C2', label: c2.label, couleur: '#a78bfa', minVal: (c1.max === undefined ? '' : c1.max + 1), minId: 'gcl_c2min', maxVal: c2.max, maxId: 'gcl_c2max', maxEditable: true },
    { code: 'C3', label: c3.label, couleur: '#f59e0b', minVal: (c2.max === undefined ? '' : c2.max + 1), minId: 'gcl_c3min', maxVal: c3.max, maxId: 'gcl_c3max', maxEditable: false }
  ];
  lignes.forEach(function(r) {
    html += '<div class="settings-row settings-row-stack">';
    html += '<div><div class="settings-row-title" style="color:' + r.couleur + ';">' + escapeHtml(r.code + ' · ' + (r.label || r.code)) + '</div>';
    html += '<div class="settings-row-desc">Borne basse → borne haute (mm)</div></div>';
    html += '<div style="width:100%;margin-top:10px;display:flex;gap:8px;align-items:center;">';
    html += '<input type="number" id="' + r.minId + '" class="form-input" style="max-width:110px;" value="' + r.minVal + '" readonly>';
    html += '<span style="color:var(--text-muted);">→</span>';
    if (r.maxEditable) {
      html += '<input type="number" id="' + r.maxId + '" class="form-input" style="max-width:110px;" value="' + r.maxVal + '" min="1" step="1"' + ro + onIp + '>';
    } else {
      html += '<input type="number" id="' + r.maxId + '" class="form-input" style="max-width:110px;" value="' + r.maxVal + '" readonly>';
    }
    html += '</div></div>';
  });

  if (editable) {
    html += '<div class="settings-actions">';
    html += '<button class="btn btn-sm btn-primary" onclick="saveGrumeClasses()">Enregistrer les seuils</button>';
    html += '</div>';
  }

  return html;
};

window._settingsManager_renderGrumeClassesForm = function() {
  const wrap = document.getElementById('grumeClassesWrap');
  if (!wrap) return;
  const editable = (currentRole === 'admin' || currentRole === 'responsable_technique');
  let html;
  try {
    const rules = (window.RulesEngine && typeof window.RulesEngine.all === 'function') ? window.RulesEngine.all() : null;
    if (!rules) throw new Error('Moteur de règles indisponible');
    html = window._settingsManager_buildGrumeClassesForm(rules.grumeClasses, rules.dimensions, editable);
  } catch (e) {
    html = '<div class="settings-row-desc">' + escapeHtml(e.message) + '</div>';
  }
  wrap.innerHTML = html;
  if (typeof renderLucide === 'function') { try { renderLucide(); } catch (e) {} }
};

window._settingsManager_recomputeGrumeClasses = function() {
  const val = function(id) {
    const el = document.getElementById(id);
    return el ? Number(el.value) : NaN;
  };
  const r = window._settingsManager_grumeClassesFromInputs({
    minLim: val('gcl_min_lim'), maxLim: val('gcl_max_lim'),
    c1max: val('gcl_c1max'), c2max: val('gcl_c2max')
  });
  if (!r.ok) return;
  const set = function(id, v) {
    const el = document.getElementById(id);
    if (el) el.value = v;
  };
  set('gcl_c1min', r.classes.C1.min);
  set('gcl_c2min', r.classes.C2.min);
  set('gcl_c3min', r.classes.C3.min);
  set('gcl_c3max', r.classes.C3.max);
};

window._settingsManager_saveGrumeClasses = function() {
  const val = function(id) {
    const el = document.getElementById(id);
    return el ? Number(el.value) : NaN;
  };
  const r = window._settingsManager_grumeClassesFromInputs({
    minLim: val('gcl_min_lim'), maxLim: val('gcl_max_lim'),
    c1max: val('gcl_c1max'), c2max: val('gcl_c2max')
  });
  if (!r.ok) {
    showToast(r.error, 'error');
    return { ok: false, error: r.error };
  }
  try {
    if (!window.RulesEngine || typeof window.RulesEngine.set !== 'function'
        || typeof window.RulesEngine.setGrumeClasses !== 'function') {
      throw new Error('Moteur de règles indisponible');
    }
    /* Préserve les libellés actuels éventuellement personnalisés */
    const actuelles = (window.RulesEngine.all() && window.RulesEngine.all().grumeClasses) || {};
    ['C1', 'C2', 'C3'].forEach(function(code) {
      if (actuelles[code] && actuelles[code].label) r.classes[code].label = actuelles[code].label;
    });
    window.RulesEngine.set('dimensions.MIN_LOG_WIDTH', r.minLim);
    window.RulesEngine.set('dimensions.MAX_LOG_WIDTH', r.maxLim);
    window.RulesEngine.setGrumeClasses(r.classes);
  } catch (e) {
    showToast('Seuils non enregistrés : ' + e.message, 'error');
    return { ok: false, error: e.message };
  }
  showToast('Seuils des classes mis à jour (C1.min = ' + r.minLim + ' mm, C3.max = ' + r.maxLim + ' mm).', 'success');
  window._settingsManager_renderGrumeClassesForm();
  return { ok: true, minLim: r.minLim, maxLim: r.maxLim, classes: r.classes };
};

/* ─────────────────────────────────────────────
   EXPORT GLOBAL
   ───────────────────────────────────────────── */

window.settingsManager = {
  getAppPref: window._settingsManager_getAppPref,
  setAppPref: window._settingsManager_setAppPref,
  renderSettingsSync: window._settingsManager_renderSettingsSync,
  renderMiscSettings: window._settingsManager_renderMiscSettings,
  saveLineObjectives: window._settingsManager_saveLineObjectives,
  notifOnChange: window._settingsManager_notifOnChange,
  autoSyncChange: window._settingsManager_autoSyncChange,
  themeChange: window._settingsManager_themeChange,
  grumeClassesFromInputs: window._settingsManager_grumeClassesFromInputs,
  buildGrumeClassesForm: window._settingsManager_buildGrumeClassesForm,
  renderGrumeClassesForm: window._settingsManager_renderGrumeClassesForm,
  recomputeGrumeClasses: window._settingsManager_recomputeGrumeClasses,
  saveGrumeClasses: window._settingsManager_saveGrumeClasses
};