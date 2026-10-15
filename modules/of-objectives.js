/**
 * OF-OBJECTIVES.JS — Suivi objectifs mensuels vs réalisé + rappels smart.
 * Notifications discrètes liées à l'agenda, non-intrusives.
 * Focus : informer sans déranger.
 */
'use strict';

/* ─────────────────────────────────────────────
   Calcul de la production réalisée par ligne (mois en cours)
   ───────────────────────────────────────────── */
window._ofObjectives_monthlyPfByLine = function(line) {
  var now = new Date();
  var monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var vol = 0;
  var count = 0;

  var myOfNums = {};
  if (typeof orders !== 'undefined') {
    for (var i = 0; i < orders.length; i++) {
      var o = orders[i];
      if (dashboardRenderer.ofLine(o) === line && o.orderNum) myOfNums[o.orderNum] = true;
    }
  }
  if (typeof productionPlan !== 'undefined') {
    for (var j = 0; j < productionPlan.length; j++) {
      var p = productionPlan[j];
      if (dashboardRenderer.ofLine(p) === line && p.ofNum) myOfNums[p.ofNum] = true;
    }
  }
  if (typeof finishedGoods !== 'undefined') {
    for (var k = 0; k < finishedGoods.length; k++) {
      var f = finishedGoods[k];
      if (!f || !f.ofNum || !myOfNums[f.ofNum]) continue;
      var fk = (f.sortieSechageAt || f.createdAt || '').slice(0, 7);
      /* `volume` est DÉJÀ total (addProduitFini : ep×larg×long×qté ; transfert WIP :
         une ligne par pièce, qte=1). Ne JAMAIS multiplier par qte (double comptage). */
      if (fk === monthKey) { vol += (f.volume || 0); count += (f.qte || 1); }
    }
  }
  if (typeof wipProducts !== 'undefined') {
    for (var w = 0; w < wipProducts.length; w++) {
      var wp = wipProducts[w];
      if (!wp || !wp.ofNum || !myOfNums[wp.ofNum]) continue;
      var wk = (wp.createdAt || '').slice(0, 7);
      /* `volume` WIP est DÉJÀ total (wip-manager : ep×larg×long×qté). Pas de ×pieces. */
      if (wk === monthKey) { vol += (wp.volume || 0); count += (wp.pieces || wp.qte || 1); }
    }
  }
  return { vol: +vol.toFixed(4), count: count };
};

/* ─────────────────────────────────────────────
   Objectifs mensuels
   ───────────────────────────────────────────── */
window._ofObjectives_getObjectives = function() {
  var defaults = { A: { monthly_m3: 0 }, B: { monthly_m3: 0 } };
  try { return JSON.parse(localStorage.getItem('charben_line_objectives') || JSON.stringify(defaults)); }
    catch (e) { errLog('of-objectives', 'load', e, 'warn'); return defaults; }
};

/* ─────────────────────────────────────────────
   Jours ouvrables restants dans le mois
   ───────────────────────────────────────────── */
window._ofObjectives_workingDaysLeft = function() {
  var now = new Date();
  var year = now.getFullYear(), month = now.getMonth();
  var lastDay = new Date(year, month + 1, 0).getDate();
  var today = now.getDate();
  var days = 0;
  for (var d = today + 1; d <= lastDay; d++) {
    var dt = new Date(year, month, d);
    if (dt.getDay() !== 0 && dt.getDay() !== 6) days++;
  }
  return Math.max(days, 1);
};

window._ofObjectives_workingDaysTotal = function() {
  var now = new Date();
  var year = now.getFullYear(), month = now.getMonth();
  var lastDay = new Date(year, month + 1, 0).getDate();
  var days = 0;
  for (var d = 1; d <= lastDay; d++) {
    var dt = new Date(year, month, d);
    if (dt.getDay() !== 0 && dt.getDay() !== 6) days++;
  }
  return Math.max(days, 1);
};

/* ─────────────────────────────────────────────
   Progression objectif mensuel
   ───────────────────────────────────────────── */
window._ofObjectives_monthlyProgress = function() {
  var obj = window._ofObjectives_getObjectives();
  var objA = (obj.A && obj.A.monthly_m3) || 0;
  var objB = (obj.B && obj.B.monthly_m3) || 0;
  var prodA = window._ofObjectives_monthlyPfByLine('A');
  var prodB = window._ofObjectives_monthlyPfByLine('B');
  var totalObj = objA + objB;
  var totalProd = prodA.vol + prodB.vol;
  var totalPct = totalObj > 0 ? Math.min(100, Math.round((totalProd / totalObj) * 100)) : 0;
  /* m³ restant = objectif − réalisé, PLANCHER à 0 (jamais de reliquat négatif). */
  var gap = Math.max(0, +(totalObj - totalProd).toFixed(4));
  var gapA = Math.max(0, +(objA - prodA.vol).toFixed(4));
  var gapB = Math.max(0, +(objB - prodB.vol).toFixed(4));
  var daysLeft = window._ofObjectives_workingDaysLeft();
  var daysTotal = window._ofObjectives_workingDaysTotal();
  var now = new Date();
  var dayOfMonth = now.getDate();
  var expectedPct = daysTotal > 0 ? Math.round((dayOfMonth / daysTotal) * 100) : 0;
  var dailyTarget = totalObj > 0 ? +(totalObj / daysTotal).toFixed(4) : 0;

  return {
    objA: objA, objB: objB,
    prodA: prodA.vol, prodB: prodB.vol,
    countA: prodA.count, countB: prodB.count,
    totalObj: totalObj, totalProd: totalProd,
    totalPct: totalPct, gap: gap, gapA: gapA, gapB: gapB,
    daysLeft: daysLeft, daysTotal: daysTotal,
    expectedPct: expectedPct, dailyTarget: dailyTarget,
    behind: totalPct < expectedPct,
    behindPct: Math.max(0, expectedPct - totalPct)
  };
};

/* ─────────────────────────────────────────────
   Rendu compact — barre objectif (sidebar)
   ───────────────────────────────────────────── */
window._ofObjectives_renderMonthlyTracker = function() {
  var m = window._ofObjectives_monthlyProgress();
  if (m.totalObj === 0) {
    /* Aucun objectif paramétré : invite propre (jamais de barre 0% cassée). */
    var tIcon = (typeof ofIcons !== 'undefined') ? ofIcons.lucide('target', 14) : '';
    var e = '<div class="ag-sidebar-section" style="margin-top:16px;">';
    e += '<div class="ag-sidebar-title">' + tIcon + ' Objectif mensuel</div>';
    e += '<div class="of-obj-invite" style="cursor:pointer;font-size:10px;color:var(--text-muted);padding:6px 0;" onclick="navigateTo(\'settings\')">Aucun objectif défini — <b style="color:var(--accent-primary);">Définir un objectif \u203a</b></div>';
    e += '</div>';
    return e;
  }
  var col = m.totalPct >= 100 ? '#059669' : (m.totalPct >= m.expectedPct ? '#f59e0b' : '#ef4444');
  var statusIcon = m.totalPct >= 100 ? (typeof ofIcons !== 'undefined' ? ofIcons.lucide('check-circle', 14) : '✅') : (m.totalPct >= m.expectedPct ? (typeof ofIcons !== 'undefined' ? ofIcons.lucide('bar-chart', 14) : '📊') : (typeof ofIcons !== 'undefined' ? ofIcons.lucide('alert-triangle', 14) : '⚠️'));

  var html = '<div class="ag-sidebar-section" style="margin-top:16px;">';
  html += '<div class="ag-sidebar-title">' + statusIcon + ' Objectif mensuel</div>';

  /* Barre compacte */
  html += '<div style="height:6px;background:var(--border-color);border-radius:3px;overflow:hidden;margin:6px 0 4px;position:relative;">';
  html += '<div style="height:100%;width:' + m.totalPct + '%;background:' + col + ';transition:width .3s;"></div>';
  if (m.expectedPct > 0 && m.expectedPct < 100) {
    html += '<div style="position:absolute;top:0;left:' + m.expectedPct + '%;height:100%;width:1.5px;background:var(--text-muted);opacity:.5;"></div>';
  }
  html += '</div>';

  /* Chiffres compacts */
  html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);">';
  html += '<span>' + m.totalProd.toFixed(1) + ' / ' + m.totalObj + ' m³</span>';
  html += '<span style="color:' + col + ';font-weight:700;">' + m.totalPct + '%</span>';
  html += '</div>';

  /* Lignes A/B en une ligne */
  html += '<div style="display:flex;gap:6px;margin-top:6px;font-size:9px;">';
  html += '<span style="flex:1;text-align:center;padding:3px 0;background:var(--bg-secondary);border-radius:4px;">';
  html += '<b style="color:var(--accent-primary);">A</b> ' + m.prodA.toFixed(1) + '/' + m.objA + '</span>';
  html += '<span style="flex:1;text-align:center;padding:3px 0;background:var(--bg-secondary);border-radius:4px;">';
  html += '<b style="color:#f59e0b;">B</b> ' + m.prodB.toFixed(1) + '/' + m.objB + '</span>';
  html += '</div>';

  /* m³ restant — global + par ligne (objectif − réalisé, plancher 0) */
  html += '<div style="margin-top:5px;font-size:9px;color:var(--text-muted);">';
  html += 'Restant ' + m.gap.toFixed(1) + ' m³ ce mois · A ' + m.gapA.toFixed(1) + ' · B ' + m.gapB.toFixed(1);
  html += '</div>';

  /* Alerte écart — discrète, pas de panique */
  if (m.behind && m.gap > 0 && m.daysLeft > 0) {
    var dailyNeeded = +(m.gap / m.daysLeft).toFixed(1);
    html += '<div style="margin-top:6px;padding:5px 6px;background:rgba(239,68,68,.06);border-left:2px solid #ef4444;border-radius:0 4px 4px 0;font-size:10px;">';
    html += '<span style="color:#ef4444;font-weight:600;">Écart ' + m.behindPct + '%</span> · ';
    html += '<span style="color:var(--text-muted);">_' + dailyNeeded + ' m³/j ' + m.daysLeft + 'j restant(s)</span>';
    html += '</div>';
  }

  html += '</div>';
  return html;
};

/* ─────────────────────────────────────────────
   Rappels automatiques — SMART (non intrusifs)
   ───────────────────────────────────────────── */
window._ofObjectives_autoReminders = function() {
  var m = window._ofObjectives_monthlyProgress();
  var reminders = [];

  /* 1. Retard objectif — seulement si > 10% d'écart */
  if (m.behind && m.gap > 0 && m.behindPct > 10) {
    var dailyNeeded = +(m.gap / m.daysLeft).toFixed(1);
    reminders.push({
      type: 'objective_gap',
      priority: m.behindPct > 25 ? 'high' : 'low',
      title: 'Objectif en retard',
      body: m.totalPct + '% / ' + m.expectedPct + '% — manque ' + m.gap.toFixed(1) + ' m³ (' + dailyNeeded + ' m³/j)',
      icon: 'bar-chart'
    });
  }

  /* 2. OF à venir avec changement réglages — seulement si changement significatif */
  if (typeof productionPlan !== 'undefined') {
    var now = new Date();
    var tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    var dayAfter = new Date(now); dayAfter.setDate(dayAfter.getDate() + 2);
    var fmt = function(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
    var tomorrowKey = fmt(tomorrow);
    var dayAfterKey = fmt(dayAfter);

    ['A', 'B'].forEach(function(line) {
      var currentOf = null;
      if (typeof getLineOrder === 'function') currentOf = getLineOrder(line);

      for (var i = 0; i < productionPlan.length; i++) {
        var p = productionPlan[i];
        if (dashboardRenderer.ofLine(p) !== line) continue;
        if (p.date !== tomorrowKey && p.date !== dayAfterKey) continue;

        var changes = [];
        if (currentOf) {
          if (p.essence && currentOf.essence && p.essence !== currentOf.essence) {
            var oldLabel = (GAMME_ESSENCES[currentOf.essence] || {}).label || currentOf.essence;
            var newLabel = (GAMME_ESSENCES[p.essence] || {}).label || p.essence;
            changes.push(oldLabel + ' → ' + newLabel);
          }
          if (p.logWidth && currentOf.logWidth && Math.abs(p.logWidth - currentOf.logWidth) > 20) {
            changes.push('Grume ' + currentOf.logWidth + '→' + p.logWidth + 'mm');
          }
          if (p.central && currentOf.central && p.central !== currentOf.central) {
            changes.push('CC ' + currentOf.central + '→' + p.central + 'mm');
          }
        }

        if (changes.length > 0) {
          reminders.push({
            type: 'machine_settings',
            priority: 'medium',
            title: 'Réglages L' + line + ' ' + p.date,
            body: changes.join(', '),
            icon: 'settings'
          });
        }
      }
    });
  }

  return reminders;
};

/* ─────────────────────────────────────────────
   Rendu rappels objectifs — sidebar compact
   ───────────────────────────────────────────── */
window._ofObjectives_renderRemindersPanel = function() {
  var reminders = window._ofObjectives_autoReminders();
  if (reminders.length === 0) return '';

  var html = '';
  for (var i = 0; i < reminders.length; i++) {
    var r = reminders[i];
    var borderCol = r.priority === 'high' ? '#ef4444' : (r.priority === 'medium' ? '#f59e0b' : '#3b82f6');
    html += '<div style="margin-top:6px;padding:5px 6px;border-left:2px solid ' + borderCol + ';border-radius:0 4px 4px 0;font-size:10px;">';
    html += '<span style="font-weight:600;color:var(--text-primary);">' + (typeof ofIcons !== 'undefined' ? ofIcons.lucide(r.icon, 10) : r.icon) + ' ' + escapeHtml(r.title) + '</span>';
    html += '<div style="color:var(--text-muted);margin-top:1px;">' + escapeHtml(r.body) + '</div>';
    html += '</div>';
  }
  return html;
};

/* ─────────────────────────────────────────────
   Export global
   ───────────────────────────────────────────── */
window.ofObjectives = {
  monthlyPfByLine: window._ofObjectives_monthlyPfByLine,
  getObjectives: window._ofObjectives_getObjectives,
  monthlyProgress: window._ofObjectives_monthlyProgress,
  renderMonthlyTracker: window._ofObjectives_renderMonthlyTracker,
  autoReminders: window._ofObjectives_autoReminders,
  renderRemindersPanel: window._ofObjectives_renderRemindersPanel
};