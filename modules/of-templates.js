/**
 * OF-TEMPLATES.JS — Templates réutilisables pour la création rapide d'OF.
 * Stockage: localStorage. Pattern similaire à TaskTemplateEntity (analyse trimt).
 * Permet de sauvegarder une configuration OF fréquente et la réutiliser en 1 clic.
 */
'use strict';

var TEMPLATES_KEY = 'charben_of_templates';

/* ─────────────────────────────────────────────
   Chargement / sauvegarde
   ───────────────────────────────────────────── */
window._ofTemplates_load = function() {
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]'); }
  catch (e) { errLog('of-templates', 'load', e, 'warn'); return []; }
};

window._ofTemplates_save = function(templates) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
};

/* ─────────────────────────────────────────────
   Créer un template depuis un OF existant
   ───────────────────────────────────────────── */
window._ofTemplates_createFromOf = function(of, name) {
  var templates = window._ofTemplates_load();
  var tpl = {
    id: 'tpl_' + Date.now(),
    name: name || (of.orderNum || 'Template'),
    wood: of.wood || '',
    essence: of.essence || '',
    line: dashboardRenderer.ofLine(of),
    machine: of.machine || 'A1',
    logDiameter: of.logDiameter || '',
    logWidth: of.logWidth || '',
    logLength: of.logLength || '',
    targetWidths: of.targetWidths || '',
    secondaryCc: of.secondaryCc || '',
    secondarySb: of.secondarySb || '',
    qty: of.qty || '',
    client: of.client || '',
    notes: of.notes || '',
    createdAt: new Date().toISOString()
  };
  templates.push(tpl);
  window._ofTemplates_save(templates);
  return tpl;
};

/* ─────────────────────────────────────────────
   Créer un template manuellement
   ───────────────────────────────────────────── */
window._ofTemplates_create = function(data) {
  var templates = window._ofTemplates_load();
  var tpl = {
    id: 'tpl_' + Date.now(),
    name: data.name || 'Template',
    wood: data.wood || '',
    essence: data.essence || '',
    line: dashboardRenderer.ofLine(data),
    machine: data.machine || 'A1',
    logDiameter: data.logDiameter || '',
    logWidth: data.logWidth || '',
    logLength: data.logLength || '',
    targetWidths: data.targetWidths || '',
    secondaryCc: data.secondaryCc || '',
    secondarySb: data.secondarySb || '',
    qty: data.qty || '',
    client: data.client || '',
    notes: data.notes || '',
    createdAt: new Date().toISOString()
  };
  templates.push(tpl);
  window._ofTemplates_save(templates);
  return tpl;
};

/* ─────────────────────────────────────────────
   Supprimer un template
   ───────────────────────────────────────────── */
window._ofTemplates_remove = function(tplId) {
  var templates = window._ofTemplates_load();
  templates = templates.filter(function(t) { return t.id !== tplId; });
  window._ofTemplates_save(templates);
};

/* ─────────────────────────────────────────────
   Appliquer un template → pré-remplir le formulaire OF
   ───────────────────────────────────────────── */
window._ofTemplates_apply = function(tplId) {
  var templates = window._ofTemplates_load();
  var tpl = null;
  for (var i = 0; i < templates.length; i++) {
    if (templates[i].id === tplId) { tpl = templates[i]; break; }
  }
  if (!tpl) return null;

  /* Mapper les champs template vers les champs du formulaire OF */
  var fieldMap = {
    wood: 'ppEssence',
    essence: 'ppEssence',
    line: 'ppLine',
    machine: 'ppMachine',
    logDiameter: 'ppDiameter',
    logWidth: 'ppLogWidth',
    logLength: 'ppLogLength',
    targetWidths: 'ppTargetWidths',
    secondaryCc: 'ppSecondaryCc',
    secondarySb: 'ppSecondarySb',
    qty: 'ppQty',
    client: 'ppClient',
    notes: 'ppNotes'
  };

  var filled = {};
  for (var key in fieldMap) {
    if (Object.prototype.hasOwnProperty.call(fieldMap, key) && tpl[key]) {
      var el = document.getElementById(fieldMap[key]);
      if (el) {
        el.value = tpl[key];
        filled[key] = tpl[key];
      }
    }
  }

  /* Si ligne, recalculer les machines */
  if (tpl.line && typeof selectPpLine === 'function') {
    selectPpLine(tpl.line);
  }

  return filled;
};

/* ─────────────────────────────────────────────
   Rendu du sélecteur de templates
   ───────────────────────────────────────────── */
window._ofTemplates_renderSelector = function() {
  var templates = window._ofTemplates_load();
  var html = '<div class="of-templates-selector">';

  if (templates.length === 0) {
    html += '<div style="font-size:10px;color:var(--text-muted);padding:6px 0;">Aucun template enregistré. Créez un OF puis sauvegardez-le comme template.</div>';
  } else {
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">';
    html += '<span style="font-size:11px;font-weight:700;color:var(--text-primary);">📋 Templates OF</span>';
    html += '<span style="font-size:10px;color:var(--text-muted);">' + templates.length + ' enregistré(s)</span>';
    html += '</div>';
    html += '<div class="tpl-list">';
    for (var i = 0; i < templates.length; i++) {
      var t = templates[i];
      html += '<div class="tpl-item" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;margin-bottom:4px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-secondary);">';
      html += '<div style="flex:1;cursor:pointer;" onclick="ofTemplates.apply(\'' + escapeHtml(t.id) + '\')">';
      html += '<div style="font-size:11px;font-weight:600;color:var(--text-primary);">' + escapeHtml(t.name) + '</div>';
      html += '<div style="font-size:10px;color:var(--text-muted);">' + escapeHtml(t.wood || t.essence || '—') + ' · Ligne ' + escapeHtml(t.line) + (t.machine ? ' · ' + escapeHtml(t.machine) : '') + '</div>';
      html += '</div>';
      html += '<button class="btn btn-sm btn-danger" onclick="ofTemplates.remove(\'' + escapeHtml(t.id) + '\');ofTemplates.renderSelector();" data-perm="planning:delete" style="font-size:9px;padding:2px 6px;">✕</button>';
      html += '</div>';
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
};

/* ─────────────────────────────────────────────
   Rendu du bouton "Sauvegarder comme template"
   ───────────────────────────────────────────── */
window._ofTemplates_renderSaveBtn = function(ofId) {
  return '<button class="btn btn-sm btn-secondary" onclick="ofTemplates.saveCurrentAsTemplate(\'' + escapeHtml(ofId) + '\')" style="font-size:10px;padding:4px 8px;">📋 Sauver template</button>';
};

/* ─────────────────────────────────────────────
   Sauvegarder l'OF courant comme template
   ───────────────────────────────────────────── */
window._ofTemplates_saveCurrentAsTemplate = function(ofId) {
  if (typeof productionPlan === 'undefined') return;
  var of = null;
  for (var i = 0; i < productionPlan.length; i++) {
    if (productionPlan[i].id === ofId || productionPlan[i].orderNum === ofId) {
      of = productionPlan[i]; break;
    }
  }
  if (!of) return;
  var defaultName = (of.wood || 'Bois') + ' — Ligne ' + dashboardRenderer.ofLine(of);
  showPrompt('Sauvegarder comme template', 'Nom du template :', defaultName, function(name) {
    if (!name) return;
    window._ofTemplates_createFromOf(of, name);
  });
};

/* ─────────────────────────────────────────────
   Export global
   ───────────────────────────────────────────── */
window.ofTemplates = {
  load: window._ofTemplates_load,
  create: window._ofTemplates_create,
  createFromOf: window._ofTemplates_createFromOf,
  remove: window._ofTemplates_remove,
  apply: window._ofTemplates_apply,
  renderSelector: window._ofTemplates_renderSelector,
  renderSaveBtn: window._ofTemplates_renderSaveBtn,
  saveCurrentAsTemplate: window._ofTemplates_saveCurrentAsTemplate
};