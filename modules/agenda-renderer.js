/**
 * AGENDA-RENDERER.JS — Vue calendrier intelligente pour le planning de production.
 * Affiche les OF et tâches sur un calendrier mensuel avec suivi de progression.
 * Source: productionPlan[] + planningTasks[] (globals existants).
 */
'use strict';

/* ─────────────────────────────────────────────
   État interne
   ───────────────────────────────────────────── */
window._agendaRenderer_state = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  selectedDate: null
};

/* ─────────────────────────────────────────────
   Helpers dates
   ───────────────────────────────────────────── */
window._agendaRenderer_makeDateKey = function(y, m, d) {
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
};

window._agendaRenderer_parseDateKey = function(key) {
  var p = key.split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
};

window._agendaRenderer_sameDay = function(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};

/* ─────────────────────────────────────────────
   Collecte des événements (OF + Tâches) par jour
   ───────────────────────────────────────────── */
window._agendaRenderer_getEventsForDate = function(dateKey) {
  var events = [];
  var i, p, t;

  /* OF de production */
  if (typeof productionPlan !== 'undefined') {
    for (i = 0; i < productionPlan.length; i++) {
      p = productionPlan[i];
      if (p.date === dateKey) {
        events.push({
          type: 'of',
          id: p.id,
          title: (p.ofNum || 'OF-' + i) + ' — ' + (p.wood || p.essence || 'Bois'),
          status: p.status || 'planifie',
          line: dashboardRenderer.ofLine(p),
          machine: p.machine || '',
          qty: p.qty || null,
          notes: p.notes || '',
          ref: p
        });
      }
    }
  }

  /* Tâches planifiées */
  if (typeof planningTasks !== 'undefined') {
    for (i = 0; i < planningTasks.length; i++) {
      t = planningTasks[i];
      if (t.date === dateKey) {
        events.push({
          type: 'task',
          id: t.id,
          title: t.title || 'Tâche',
          status: t.status || 'todo',
          assign: t.assign || '',
          priority: t.priority || 'Moyenne',
          notes: t.notes || '',
          ref: t
        });
      }
    }
  }

  return events;
};

window._agendaRenderer_getAllEvents = function() {
  var all = [];
  if (typeof productionPlan !== 'undefined') {
    for (var i = 0; i < productionPlan.length; i++) {
      var p = productionPlan[i];
      if (p.date) {
        all.push({ dateKey: p.date, type: 'of', status: p.status || 'planifie', title: (p.ofNum || 'OF') + ' ' + (p.wood || ''), ref: p });
      }
    }
  }
  if (typeof planningTasks !== 'undefined') {
    for (var j = 0; j < planningTasks.length; j++) {
      var t = planningTasks[j];
      if (t.date) {
        all.push({ dateKey: t.date, type: 'task', status: t.status || 'todo', title: t.title || 'Tâche', ref: t });
      }
    }
  }
  return all;
};

/* ─────────────────────────────────────────────
   Couleurs par statut
   ───────────────────────────────────────────── */
window._agendaRenderer_statusColor = function(status) {
  var map = {
    'planifie': '#3b82f6',
    'engage': '#f59e0b',
    'realise': '#059669',
    'doing': '#f59e0b',
    'done': '#059669',
    'todo': '#3b82f6'
  };
  return map[status] || '#6b7280';
};

window._agendaRenderer_statusLabel = function(status) {
  var map = {
    'planifie': 'Planifié',
    'engage': 'Engagé',
    'realise': 'Réalisé',
    'doing': 'En cours',
    'done': 'Terminé',
    'todo': 'À faire'
  };
  return map[status] || status;
};

/* ─────────────────────────────────────────────
   Navigation mois
   ───────────────────────────────────────────── */
window._agendaRenderer_prevMonth = function() {
  var s = window._agendaRenderer_state;
  s.month--;
  if (s.month < 0) { s.month = 11; s.year--; }
  window._agendaRenderer_renderCalendar();
};

window._agendaRenderer_nextMonth = function() {
  var s = window._agendaRenderer_state;
  s.month++;
  if (s.month > 11) { s.month = 0; s.year++; }
  window._agendaRenderer_renderCalendar();
};

window._agendaRenderer_goToday = function() {
  var now = new Date();
  window._agendaRenderer_state.year = now.getFullYear();
  window._agendaRenderer_state.month = now.getMonth();
  window._agendaRenderer_state.selectedDate = window._agendaRenderer_makeDateKey(now.getFullYear(), now.getMonth(), now.getDate());
  window._agendaRenderer_renderCalendar();
  window._agendaRenderer_renderDayDetail();
  window._agendaRenderer_renderSidebar();
};

/* ─────────────────────────────────────────────
   Rendu du calendrier mensuel
   ───────────────────────────────────────────── */
window._agendaRenderer_renderCalendar = function() {
  var el = document.getElementById('agendaCalendarGrid');
  var monthLabel = document.getElementById('agendaMonthLabel');
  if (!el) return;

  var s = window._agendaRenderer_state;
  var NOMS_MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  if (monthLabel) monthLabel.textContent = NOMS_MOIS[s.month] + ' ' + s.year;

  var premier = new Date(s.year, s.month, 1);
  var dernier = new Date(s.year, s.month + 1, 0);
  var totalJours = dernier.getDate();
  var jourDepart = premier.getDay();
  var joursMoisPrec = new Date(s.year, s.month, 0).getDate();
  var totalCellules = 42;

  var aujourd = new Date();
  var aujKey = window._agendaRenderer_makeDateKey(aujourd.getFullYear(), aujourd.getMonth(), aujourd.getDate());
  var eventsAll = window._agendaRenderer_getAllEvents();

  /* Indexer les événements par date */
  var eventsByDate = {};
  for (var i = 0; i < eventsAll.length; i++) {
    var dk = eventsAll[i].dateKey;
    if (!eventsByDate[dk]) eventsByDate[dk] = [];
    eventsByDate[dk].push(eventsAll[i]);
  }

  var html = '';
  for (var c = 0; c < totalCellules; c++) {
    var numJour = c - jourDepart + 1;
    var an = s.year, mo = s.month, jr = numJour;
    var muted = false;

    if (numJour < 1) {
      muted = true;
      jr = joursMoisPrec + numJour;
      var prevDate = new Date(s.year, s.month - 1, 1);
      an = prevDate.getFullYear(); mo = prevDate.getMonth();
    }
    if (numJour > totalJours) {
      muted = true;
      jr = numJour - totalJours;
      var nextDate = new Date(s.year, s.month + 1, 1);
      an = nextDate.getFullYear(); mo = nextDate.getMonth();
    }

    var dk2 = window._agendaRenderer_makeDateKey(an, mo, jr);
    var isToday = dk2 === aujKey;
    var isSelected = dk2 === s.selectedDate;
    var dayEvents = eventsByDate[dk2] || [];
    var hasEvents = dayEvents.length > 0;

    var cls = 'ag-day';
    if (muted) cls += ' ag-muted';
    if (isToday) cls += ' ag-today';
    if (isSelected) cls += ' ag-selected';
    if (hasEvents) cls += ' ag-has-events';

    /* Past days: dim */
    var dateCell = new Date(an, mo, jr);
    var todayComp = new Date(aujourd.getFullYear(), aujourd.getMonth(), aujourd.getDate());
    if (dateCell < todayComp && !isToday) cls += ' ag-past';

    /* Badges de statut */
    var badges = '';
    if (hasEvents) {
      var statusCounts = {};
      for (var ei = 0; ei < dayEvents.length; ei++) {
        var st = dayEvents[ei].status;
        statusCounts[st] = (statusCounts[st] || 0) + 1;
      }
      var badgeColors = [];
      for (var stK in statusCounts) {
        if (Object.prototype.hasOwnProperty.call(statusCounts, stK)) {
          badgeColors.push('<span class="ag-badge-dot" style="background:' + window._agendaRenderer_statusColor(stK) + ';" title="' + escapeHtml(window._agendaRenderer_statusLabel(stK)) + ' (' + statusCounts[stK] + ')"></span>');
        }
      }
      badges = '<div class="ag-badges">' + badgeColors.join('') + '</div>';
    }

    html += '<div class="' + cls + '" data-date="' + escapeHtml(dk2) + '" onclick="window._agendaRenderer_selectDay(\'' + escapeHtml(dk2) + '\')">';
    html += '<div class="ag-day-num">' + jr + '</div>';
    if (hasEvents) html += '<div class="ag-day-count">' + dayEvents.length + '</div>';
    html += badges;
    html += '</div>';
  }

  el.innerHTML = html;
};

/* ─────────────────────────────────────────────
   Sélection d'un jour
   ───────────────────────────────────────────── */
window._agendaRenderer_selectDay = function(dateKey) {
  window._agendaRenderer_state.selectedDate = dateKey;
  window._agendaRenderer_renderCalendar();
  window._agendaRenderer_renderDayDetail();
};

/* ─────────────────────────────────────────────
   Détail du jour sélectionné
   ───────────────────────────────────────────── */
window._agendaRenderer_renderDayDetail = function() {
  var el = document.getElementById('agendaDayDetail');
  if (!el) return;

  var s = window._agendaRenderer_state;
  var dk = s.selectedDate;
  if (!dk) {
    el.innerHTML = '<div class="ag-empty"><div class="ag-empty-icon">' + (typeof ofIcons !== 'undefined' ? ofIcons.lucide('calendar', 32, 'var(--text-muted)') : '📅') + '</div><div class="ag-empty-text">Sélectionnez un jour pour voir les détails</div></div>';
    return;
  }

  var d = window._agendaRenderer_parseDateKey(dk);
  var NOMS_JOURS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  var NOMS_MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  var dayName = NOMS_JOURS[d.getDay()];
  var monthName = NOMS_MOIS[d.getMonth()];
  var dayLabel = dayName + ' ' + d.getDate() + ' ' + monthName + ' ' + d.getFullYear();

  var events = window._agendaRenderer_getEventsForDate(dk);

  var html = '<div class="ag-detail-header">';
  html += '<div class="ag-detail-date">' + escapeHtml(dayLabel) + '</div>';
  html += '<div class="ag-detail-count">' + events.length + ' élément(s)</div>';
  html += '</div>';

  if (events.length === 0) {
    html += '<div class="ag-empty" style="padding:20px 0;"><div class="ag-empty-icon">📭</div><div class="ag-empty-text">Aucun OF ou tâche ce jour</div></div>';
  } else {
    html += '<div class="ag-detail-list">';
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var col = window._agendaRenderer_statusColor(ev.status);
      var typeIcon = ev.type === 'of' ? (typeof ofIcons !== 'undefined' ? ofIcons.lucide('factory', 12) : '🏭') : (typeof ofIcons !== 'undefined' ? ofIcons.lucide('clipboard-list', 12) : '📋');
      var typeLabel = ev.type === 'of' ? 'OF Production' : 'Tâche';

      html += '<div class="ag-detail-item" style="border-left:3px solid ' + col + ';">';
      html += '<div class="ag-detail-item-head">';
      html += '<span class="ag-type-badge" style="background:' + col + '18;color:' + col + ';">' + typeIcon + ' ' + typeLabel + '</span>';
      html += '<span class="ag-status-dot" style="background:' + col + ';" title="' + escapeHtml(window._agendaRenderer_statusLabel(ev.status)) + '"></span>';
      html += '</div>';
      html += '<div class="ag-detail-item-title">' + escapeHtml(ev.title) + '</div>';

      var meta = [];
      if (ev.type === 'of') {
        meta.push('Ligne ' + escapeHtml(ev.line));
        if (ev.machine) meta.push('Machine ' + escapeHtml(ev.machine));
        if (ev.qty) meta.push(ev.qty + ' pcs');
        meta.push(window._agendaRenderer_statusLabel(ev.status));
      } else {
        if (ev.assign) meta.push(ev.assign);
        if (ev.priority) meta.push(ev.priority);
        meta.push(window._agendaRenderer_statusLabel(ev.status));
      }
      html += '<div class="ag-detail-item-meta">' + meta.map(escapeHtml).join(' · ') + '</div>';

      if (ev.notes) {
        html += '<div class="ag-detail-item-notes">' + escapeHtml(ev.notes) + '</div>';
      }

      /* ── Sous-étapes cochables (suivi flux sciage) ── */
      if (ev.type === 'of' && typeof ofSteps !== 'undefined') {
        html += '<div data-ofsteps="' + escapeHtml(ev.id) + '" style="margin-top:8px;">';
        html += ofSteps.render(ev.id, dashboardRenderer.ofLine(ev));
        html += '</div>';
      }

      /* ── Panneau rappels (OF + Tâches) ── */
      if (typeof ofReminders !== 'undefined') {
        html += '<div style="margin-top:8px;">';
        html += ofReminders.renderPanel(ev.id, ev.title.split('—')[0].trim(), ev.date || dk);
        html += '</div>';
      }

      html += '</div>';
    }
    html += '</div>';
  }

  el.innerHTML = html;
};

/* ─────────────────────────────────────────────
   Panneau latéral — Aujourd'hui + À venir
   ───────────────────────────────────────────── */
window._agendaRenderer_renderSidebar = function() {
  var el = document.getElementById('agendaSidebar');
  if (!el) return;

  var now = new Date();
  var todayKey = window._agendaRenderer_makeDateKey(now.getFullYear(), now.getMonth(), now.getDate());
  var todayEvents = window._agendaRenderer_getEventsForDate(todayKey);

  /* Événements à venir (du lendemain, max 10) */
  var upcoming = [];
  var all = window._agendaRenderer_getAllEvents();
  var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  var tomorrowKey = window._agendaRenderer_makeDateKey(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

  for (var i = 0; i < all.length; i++) {
    if (all[i].dateKey >= tomorrowKey) {
      upcoming.push(all[i]);
    }
  }
  upcoming.sort(function(a, b) { return a.dateKey < b.dateKey ? -1 : (a.dateKey > b.dateKey ? 1 : 0); });
  upcoming = upcoming.slice(0, 10);

  var html = '';

  /* Bloc aujourd'hui */
  html += '<div class="ag-sidebar-section">';
  html += '<div class="ag-sidebar-title">Aujourd\'hui</div>';
  html += '<div class="ag-sidebar-date">' + window._agendaRenderer_formatDate(now) + '</div>';

  if (todayEvents.length === 0) {
    html += '<div class="ag-empty-sm">Aucun événement aujourd\'hui</div>';
  } else {
    for (var j = 0; j < todayEvents.length; j++) {
      var ev = todayEvents[j];
      var col = window._agendaRenderer_statusColor(ev.status);
      html += '<div class="ag-sidebar-item" style="border-left:3px solid ' + col + ';">';
      html += '<div class="ag-sidebar-item-title">' + escapeHtml(ev.title) + '</div>';
      html += '<div class="ag-sidebar-item-meta" style="color:' + col + ';">' + escapeHtml(window._agendaRenderer_statusLabel(ev.status)) + '</div>';
      html += '</div>';
    }
  }
  html += '</div>';

  /* Bloc à venir */
  html += '<div class="ag-sidebar-section" style="margin-top:16px;">';
  html += '<div class="ag-sidebar-title">À venir</div>';

  if (upcoming.length === 0) {
    html += '<div class="ag-empty-sm">Aucun événement prévu</div>';
  } else {
    for (var k = 0; k < upcoming.length; k++) {
      var u = upcoming[k];
      var col2 = window._agendaRenderer_statusColor(u.status);
      html += '<div class="ag-sidebar-item" style="border-left:3px solid ' + col2 + ';">';
      html += '<div class="ag-sidebar-item-date">' + escapeHtml(u.dateKey) + '</div>';
      html += '<div class="ag-sidebar-item-title">' + escapeHtml(u.title) + '</div>';
      html += '<div class="ag-sidebar-item-meta" style="color:' + col2 + ';">' + escapeHtml(window._agendaRenderer_statusLabel(u.status)) + '</div>';
      html += '</div>';
    }
  }
  html += '</div>';

  /* ── Bloc rappels actifs ── */
  if (typeof ofReminders !== 'undefined') {
    var reminders = ofReminders.load();
    var nowTs = Date.now();
    var activeReminders = [];
    for (var ri = 0; ri < reminders.length; ri++) {
      var r = reminders[ri];
      if (!r.active) continue;
      var rp = r.date.split('-');
      var rt = (r.time || '08:00').split(':');
      var rTarget = new Date(Number(rp[0]), Number(rp[1]) - 1, Number(rp[2]), Number(rt[0]), Number(rt[1]), 0);
      if (rTarget.getTime() > nowTs) {
        activeReminders.push({ reminder: r, target: rTarget });
      }
    }
    activeReminders.sort(function(a, b) { return a.target - b.target; });
    activeReminders = activeReminders.slice(0, 5);

    html += '<div class="ag-sidebar-section" style="margin-top:16px;">';
    html += '<div class="ag-sidebar-title">' + (typeof ofIcons !== 'undefined' ? ofIcons.lucide('bell', 12) : '⏰') + ' Rappels actifs</div>';
    if (activeReminders.length === 0) {
      html += '<div class="ag-empty-sm">Aucun rappel programmé</div>';
    } else {
      for (var ai = 0; ai < activeReminders.length; ai++) {
        var ar = activeReminders[ai];
        html += '<div class="ag-sidebar-item" style="border-left:3px solid #f59e0b;">';
        html += '<div class="ag-sidebar-item-date">' + escapeHtml(ar.reminder.date) + ' ' + escapeHtml(ar.reminder.time) + '</div>';
        html += '<div class="ag-sidebar-item-title">' + escapeHtml(ar.reminder.ofNum) + '</div>';
        html += '<div class="ag-sidebar-item-meta" style="color:#f59e0b;">' + escapeHtml(ar.reminder.message) + '</div>';
        html += '</div>';
      }
    }
    html += '</div>';
  }

  /* ── Bloc objectifs mensuels + rappels auto ── */
  if (typeof ofObjectives !== 'undefined') {
    /* Suivi objectif m³ */
    html += ofObjectives.renderMonthlyTracker();
    /* Rappels objectifs + réglages machines */
    html += ofObjectives.renderRemindersPanel();
  }

  el.innerHTML = html;
};

window._agendaRenderer_formatDate = function(d) {
  var NOMS_JOURS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  var NOMS_MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  return NOMS_JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + NOMS_MOIS[d.getMonth()] + ' ' + d.getFullYear();
};

/* ─────────────────────────────────────────────
   Barre de progression globale
   ───────────────────────────────────────────── */
window._agendaRenderer_renderProgress = function() {
  var el = document.getElementById('agendaProgress');
  if (!el) return;

  var counts = { planifie: 0, engage: 0, realise: 0, total: 0 };
  if (typeof productionPlan !== 'undefined') {
    for (var i = 0; i < productionPlan.length; i++) {
      var p = productionPlan[i];
      counts.total++;
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
  }

  var pctRealise = counts.total > 0 ? Math.round((counts.realise / counts.total) * 100) : 0;
  var pctEngage = counts.total > 0 ? Math.round(((counts.realise + counts.engage) / counts.total) * 100) : 0;

  var html = '<div class="ag-progress-bar">';
  html += '<div class="ag-progress-track">';
  html += '<div class="ag-progress-fill" style="width:' + pctEngage + '%;"></div>';
  html += '</div>';
  html += '<div class="ag-progress-label">' + pctRealise + '% réalisé · ' + pctEngage + '% engagé/réalisé</div>';
  html += '</div>';

  html += '<div class="ag-progress-stats">';
  html += '<div class="ag-stat"><div class="ag-stat-num" style="color:#3b82f6;">' + counts.planifie + '</div><div class="ag-stat-label">Planifié</div></div>';
  html += '<div class="ag-stat"><div class="ag-stat-num" style="color:#f59e0b;">' + counts.engage + '</div><div class="ag-stat-label">Engagé</div></div>';
  html += '<div class="ag-stat"><div class="ag-stat-num" style="color:#059669;">' + counts.realise + '</div><div class="ag-stat-label">Réalisé</div></div>';
  html += '<div class="ag-stat"><div class="ag-stat-num" style="color:var(--text-primary);">' + counts.total + '</div><div class="ag-stat-label">Total</div></div>';
  html += '</div>';

  el.innerHTML = html;
};

/* ─────────────────────────────────────────────
   Rendu principal
   ───────────────────────────────────────────── */
window._agendaRenderer_renderAgenda = function() {
  window._agendaRenderer_renderCalendar();
  window._agendaRenderer_renderDayDetail();
  window._agendaRenderer_renderSidebar();
  window._agendaRenderer_renderProgress();
};

/* ─────────────────────────────────────────────
   Export global (module-aliases compatible)
   ───────────────────────────────────────────── */
window.agendaRenderer = {
  renderAgenda: window._agendaRenderer_renderAgenda,
  renderCalendar: window._agendaRenderer_renderCalendar,
  renderDayDetail: window._agendaRenderer_renderDayDetail,
  renderSidebar: window._agendaRenderer_renderSidebar,
  renderProgress: window._agendaRenderer_renderProgress,
  prevMonth: window._agendaRenderer_prevMonth,
  nextMonth: window._agendaRenderer_nextMonth,
  goToday: window._agendaRenderer_goToday,
  selectDay: window._agendaRenderer_selectDay
};
