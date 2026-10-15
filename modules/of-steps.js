/**
 * OF-STEPS.JS — Sous-étapes cochables par OF (suivi du flux de sciage).
 * Flux métier Charben : Débit (A1/B1) → Sciage largeurs CC (A2/B2) / SB (A3/B3)
 *                       → Dosses récup (A4/B4) → Séchage WIP → Transfert PF
 * Stockage: localStorage (fusionné avec productionPlan via ofId).
 */
'use strict';

var STEPS_KEY = 'charben_of_steps';

/* Structure d'une étape:
 * { id, ofId, label, machine, icon, done, doneAt }
 */

/* ─────────────────────────────────────────────
   Étapes par défaut selon le flux
   ───────────────────────────────────────────── */
window._ofSteps_defaultSteps = function(line) {
  /* Normalisation via l'accesseur canonique : un line brut 'A1' produirait
     des noms de machine falsifiés ('A11', 'A12', 'A13'…). */
  var ln = dashboardRenderer.ofLine({ line: line });
  return [
    { id: 's1', label: 'Débit grume', machine: ln + '1', icon: 'saw', done: false, doneAt: null },
    { id: 's2', label: 'Sciage largeurs CC', machine: ln + '2', icon: 'ruler', done: false, doneAt: null },
    { id: 's3', label: 'Déligneuse SB', machine: ln + '3', icon: 'tree-pine', done: false, doneAt: null },
    { id: 's4', label: 'Récup dosses', machine: ln + '4', icon: 'recycle', done: false, doneAt: null },
    { id: 's5', label: 'Séchage WIP', machine: 'SE', icon: 'thermometer', done: false, doneAt: null },
    { id: 's6', label: 'Transfert PF', machine: 'PF', icon: 'package', done: false, doneAt: null }
  ];
};

/* ─────────────────────────────────────────────
   Chargement / sauvegarde
   ───────────────────────────────────────────── */
window._ofSteps_load = function() {
  try { return JSON.parse(localStorage.getItem(STEPS_KEY) || '{}'); }
    catch (e) { errLog('of-steps', 'load', e, 'warn'); return {}; }
};

window._ofSteps_save = function(steps) {
  localStorage.setItem(STEPS_KEY, JSON.stringify(steps));
};

/* ─────────────────────────────────────────────
   Obtenir les étapes d'un OF (crée les défauts si absentes)
   ───────────────────────────────────────────── */
window._ofSteps_getForOf = function(ofId, line) {
  var all = window._ofSteps_load();
  if (!all[ofId]) {
    all[ofId] = window._ofSteps_defaultSteps(line);
    window._ofSteps_save(all);
  }
  return all[ofId];
};

/* ─────────────────────────────────────────────
   Basculer une étape
   ───────────────────────────────────────────── */
window._ofSteps_toggle = function(ofId, stepId) {
  var all = window._ofSteps_load();
  var steps = all[ofId];
  if (!steps) return;
  for (var i = 0; i < steps.length; i++) {
    if (steps[i].id === stepId) {
      steps[i].done = !steps[i].done;
      steps[i].doneAt = steps[i].done ? new Date().toISOString() : null;
      break;
    }
  }
  window._ofSteps_save(all);
  return window._ofSteps_progress(all[ofId]);
};

/* ─────────────────────────────────────────────
   Progression (0-100)
   ───────────────────────────────────────────── */
window._ofSteps_progress = function(steps) {
  if (!steps || steps.length === 0) return 0;
  var done = 0;
  for (var i = 0; i < steps.length; i++) { if (steps[i].done) done++; }
  return Math.round((done / steps.length) * 100);
};

/* ─────────────────────────────────────────────
   Rendu du composant étapes
   ───────────────────────────────────────────── */
window._ofSteps_render = function(ofId, line) {
  var steps = window._ofSteps_getForOf(ofId, line);
  var pct = window._ofSteps_progress(steps);

  var html = '<div class="of-steps-panel">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">';
  html += '<span style="font-size:12px;font-weight:700;color:var(--text-primary);">' + (typeof ofIcons !== 'undefined' ? ofIcons.lucide('check-circle', 14) : '✅') + ' Suivi du flux</span>';
  html += '<span style="font-size:11px;font-weight:800;color:' + (pct === 100 ? 'var(--success,#059669)' : 'var(--accent-primary)') + ';">' + pct + '%</span>';
  html += '</div>';

  /* Barre de progression */
  html += '<div style="height:5px;background:var(--border-color,#e2e8f0);border-radius:3px;overflow:hidden;margin-bottom:8px;">';
  html += '<div style="height:100%;width:' + pct + '%;background:' + (pct === 100 ? '#059669' : 'var(--accent-primary,#0e9f6e)') + ';transition:width .3s;"></div>';
  html += '</div>';

  /* Liste des étapes */
  for (var i = 0; i < steps.length; i++) {
    var s = steps[i];
    html += '<div class="of-step-row" onclick="ofSteps.toggle(\'' + escapeHtml(ofId) + '\',\'' + escapeHtml(s.id) + '\');ofSteps.rerender(\'' + escapeHtml(ofId) + '\',\'' + escapeHtml(line || 'A') + '\')" style="display:flex;align-items:center;gap:8px;padding:6px 4px;cursor:pointer;border-bottom:1px solid var(--border-color,#e2e8f0);">';
    html += '<span style="width:18px;height:18px;border:2px solid ' + (s.done ? '#059669' : 'var(--border-color,#cbd5e1)') + ';border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;background:' + (s.done ? '#059669' : 'transparent') + ';color:#fff;">' + (s.done ? '✓' : '') + '</span>';
    html += '<span style="font-size:10px;">' + (typeof ofIcons !== 'undefined' ? ofIcons.lucide(s.icon, 12) : s.icon) + '</span>';
    html += '<div style="flex:1;">';
    html += '<div style="font-size:11px;font-weight:' + (s.done ? '700' : '500') + ';color:' + (s.done ? 'var(--text-muted)' : 'var(--text-primary)') + ';text-decoration:' + (s.done ? 'line-through' : 'none') + ';">' + escapeHtml(s.label) + '</div>';
    html += '<div style="font-size:9px;color:var(--text-muted);">Machine ' + escapeHtml(s.machine) + (s.doneAt ? ' · ' + escapeHtml(s.doneAt.replace('T',' ').substring(0,16)) : '') + '</div>';
    html += '</div>';
    html += '</div>';
  }

  html += '</div>';
  return html;
};

/* ─────────────────────────────────────────────
   Rerender dans un conteneur donné
   ───────────────────────────────────────────── */
window._ofSteps_rerender = function(ofId, line) {
  var containers = document.querySelectorAll('[data-ofsteps="' + ofId + '"]');
  for (var i = 0; i < containers.length; i++) {
    containers[i].innerHTML = window._ofSteps_render(ofId, line);
  }
};

/* ─────────────────────────────────────────────
   Export global
   ───────────────────────────────────────────── */
window.ofSteps = {
  load: window._ofSteps_load,
  save: window._ofSteps_save,
  getForOf: window._ofSteps_getForOf,
  toggle: window._ofSteps_toggle,
  progress: window._ofSteps_progress,
  render: window._ofSteps_render,
  rerender: window._ofSteps_rerender,
  defaultSteps: window._ofSteps_defaultSteps
};