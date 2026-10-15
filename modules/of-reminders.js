/**
 * OF-REMINDERS.JS — Système de rappels et notifications pour les OF.
 * Utilise Web Notification API (Chrome/Edge) + localStorage pour la persistence.
 * Intègre l'agenda existant (agenda-renderer.js) pour le contexte temporel.
 */
'use strict';

/* ─────────────────────────────────────────────
   Clés localStorage
   ───────────────────────────────────────────── */
var REMINDERS_KEY = 'charben_of_reminders';
var REMINDERS_ENABLED_KEY = 'charben_reminders_enabled';

/* ─────────────────────────────────────────────
   État interne
   ───────────────────────────────────────────── */
window._ofReminders_state = {
  timers: {},
  permissionGranted: false
};

/* ─────────────────────────────────────────────
   Chargement / sauvegarde des rappels
   ───────────────────────────────────────────── */
window._ofReminders_load = function() {
  try {
    return JSON.parse(localStorage.getItem(REMINDERS_KEY) || '[]');
  } catch (e) { errLog('of-reminders', 'load', e, 'warn'); return []; }
};

window._ofReminders_save = function(reminders) {
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
};

window._ofReminders_isEnabled = function() {
  return localStorage.getItem(REMINDERS_ENABLED_KEY) !== '0';
};

window._ofReminders_setEnabled = function(on) {
  localStorage.setItem(REMINDERS_ENABLED_KEY, on ? '1' : '0');
};

/* ─────────────────────────────────────────────
   Demande de permission notification
   ───────────────────────────────────────────── */
window._ofReminders_requestPermission = function() {
  if (!('Notification' in window)) {
    errLog('of-reminders', 'notify', 'Notifications non supportées par ce navigateur', 'warn');
    return Promise.resolve('denied');
  }
  if (Notification.permission === 'granted') {
    window._ofReminders_state.permissionGranted = true;
    return Promise.resolve('granted');
  }
  if (Notification.permission === 'denied') return Promise.resolve('denied');
  return Notification.requestPermission().then(function(p) {
    window._ofReminders_state.permissionGranted = (p === 'granted');
    return p;
  });
};

/* ─────────────────────────────────────────────
   Afficher une notification
   ───────────────────────────────────────────── */
window._ofReminders_show = function(title, body, tag) {
  if (!window._ofReminders_isEnabled()) return;
  if (!window._ofReminders_state.permissionGranted && Notification.permission !== 'granted') return;

  try {
    var n = new Notification(title, {
      body: body,
      icon: 'img/icon-192.png',
      badge: 'img/icon-192.png',
      tag: tag || 'charben-of-' + Date.now(),
      requireInteraction: true,
      vibrate: [200, 100, 200]
    });
    n.onclick = function() {
      window.focus();
      n.close();
    };
    setTimeout(function() { n.close(); }, 30000);
  } catch (e) {
    errLog('of-reminders', 'notify error', e, 'warn');
  }
};

/* ─────────────────────────────────────────────
   Ajouter un rappel pour un OF
   ───────────────────────────────────────────── */
window._ofReminders_add = function(ofId, ofNum, date, time, message) {
  var reminders = window._ofReminders_load();
  var id = 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  var reminder = {
    id: id,
    ofId: ofId,
    ofNum: ofNum || ofId,
    date: date,
    time: time || '08:00',
    message: message || 'Rappel OF',
    active: true,
    createdAt: new Date().toISOString()
  };
  reminders.push(reminder);
  window._ofReminders_save(reminders);
  window._ofReminders_schedule(reminder);
  return reminder;
};

/* ─────────────────────────────────────────────
   Supprimer un rappel
   ───────────────────────────────────────────── */
window._ofReminders_remove = function(reminderId) {
  var reminders = window._ofReminders_load();
  reminders = reminders.filter(function(r) { return r.id !== reminderId; });
  window._ofReminders_save(reminders);
  if (window._ofReminders_state.timers[reminderId]) {
    clearTimeout(window._ofReminders_state.timers[reminderId]);
    delete window._ofReminders_state.timers[reminderId];
  }
};

/* ─────────────────────────────────────────────
   Programmer un timer pour un rappel
   ───────────────────────────────────────────── */
window._ofReminders_schedule = function(reminder) {
  if (!reminder.active) return;
  var now = new Date();
  var parts = reminder.date.split('-');
  var timeParts = (reminder.time || '08:00').split(':');
  var target = new Date(
    Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]),
    Number(timeParts[0]), Number(timeParts[1]), 0
  );
  var delay = target.getTime() - now.getTime();
  if (delay <= 0) return;

  window._ofReminders_state.timers[reminder.id] = setTimeout(function() {
    window._ofReminders_show(
      '🏭 Rappel OF — ' + reminder.ofNum,
      reminder.message,
      'of-' + reminder.ofId
    );
  }, delay);
};

/* ─────────────────────────────────────────────
   Recharger tous les timers (au démarrage)
   ───────────────────────────────────────────── */
window._ofReminders_rescheduleAll = function() {
  var reminders = window._ofReminders_load();
  var now = new Date();
  for (var i = 0; i < reminders.length; i++) {
    var r = reminders[i];
    if (r.active) {
      var parts = r.date.split('-');
      var tp = (r.time || '08:00').split(':');
      var target = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), Number(tp[0]), Number(tp[1]), 0);
      if (target > now) {
        window._ofReminders_schedule(r);
      }
    }
  }
};

/* ─────────────────────────────────────────────
   Rappels pour une OF spécifique
   ───────────────────────────────────────────── */
window._ofReminders_forOf = function(ofId) {
  var reminders = window._ofReminders_load();
  return reminders.filter(function(r) { return r.ofId === ofId; });
};

/* ─────────────────────────────────────────────
   Rendu du panneau de rappels (pour la sidebar agenda)
   ───────────────────────────────────────────── */
window._ofReminders_renderPanel = function(ofId, ofNum, ofDate) {
  var reminders = window._ofReminders_forOf(ofId);
  var enabled = window._ofReminders_isEnabled();
  var perm = ('Notification' in window) ? Notification.permission : 'unavailable';

  var html = '<div class="reminder-panel">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">';
  html += '<span style="font-size:12px;font-weight:700;color:var(--text-primary);">' + (typeof ofIcons !== 'undefined' ? ofIcons.lucide('clock', 14) : '⏰') + ' Rappels</span>';
  html += '<label style="font-size:10px;display:flex;align-items:center;gap:4px;cursor:pointer;">';
  html += '<input type="checkbox" id="remToggle_' + escapeHtml(ofId) + '" ' + (enabled ? 'checked' : '') + ' onchange="ofReminders.toggleEnabled(this.checked)" style="width:14px;height:14px;">';
  html += '<span style="color:var(--text-muted);">' + (enabled ? 'Activé' : 'Désactivé') + '</span>';
  html += '</label>';
  html += '</div>';

  if (perm === 'unavailable') {
    html += '<div style="font-size:10px;color:var(--text-muted);padding:6px;background:var(--bg-secondary);border-radius:6px;">Notifications non supportées sur cet appareil</div>';
  } else if (perm === 'denied') {
    html += '<div style="font-size:10px;color:var(--danger);padding:6px;background:var(--bg-secondary);border-radius:6px;">Notifications bloquées — activez-les dans les paramètres du navigateur</div>';
  } else if (perm === 'default') {
    html += '<button class="btn btn-sm btn-secondary" onclick="ofReminders.requestPerm()" style="font-size:10px;padding:4px 8px;margin-bottom:6px;">Activer les notifications</button>';
  }

  /* Liste des rappels existants */
  if (reminders.length > 0) {
    html += '<div class="reminder-list">';
    for (var i = 0; i < reminders.length; i++) {
      var r = reminders[i];
      html += '<div class="reminder-item" style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border-color);">';
      html += '<div style="flex:1;">';
      html += '<div style="font-size:11px;font-weight:600;color:var(--text-primary);">' + escapeHtml(r.date) + ' ' + escapeHtml(r.time) + '</div>';
      html += '<div style="font-size:10px;color:var(--text-muted);">' + escapeHtml(r.message) + '</div>';
      html += '</div>';
      html += '<button class="btn btn-sm btn-danger" onclick="ofReminders.remove(\'' + escapeHtml(r.id) + '\')" data-perm="planning:delete" style="font-size:9px;padding:2px 6px;">✕</button>';
      html += '</div>';
    }
    html += '</div>';
  }

  /* Formulaire d'ajout */
  html += '<div style="margin-top:8px;">';
  html += '<div style="display:flex;gap:4px;">';
  html += '<input type="date" id="remDate_' + escapeHtml(ofId) + '" value="' + escapeHtml(ofDate || window._agendaRenderer_makeDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) + '" style="flex:1;font-size:10px;padding:4px;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-secondary);color:var(--text-primary);">';
  html += '<input type="time" id="remTime_' + escapeHtml(ofId) + '" value="08:00" style="width:60px;font-size:10px;padding:4px;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-secondary);color:var(--text-primary);">';
  html += '</div>';
  html += '<input type="text" id="remMsg_' + escapeHtml(ofId) + '" placeholder="Message du rappel..." value="Rappel OF ' + escapeHtml(ofNum || '') + '" style="width:100%;font-size:10px;padding:4px;margin-top:4px;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-secondary);color:var(--text-primary);">';
  html += '<button class="btn btn-sm btn-primary" onclick="ofReminders.addFromUI(\'' + escapeHtml(ofId) + '\',\'' + escapeHtml(ofNum || '') + '\')" style="font-size:10px;padding:4px 8px;margin-top:4px;width:100%;">+ Ajouter le rappel</button>';
  html += '</div>';

  html += '</div>';
  return html;
};

/* ─────────────────────────────────────────────
   Ajout depuis le UI
   ───────────────────────────────────────────── */
window._ofReminders_addFromUI = function(ofId, ofNum) {
  var dateEl = document.getElementById('remDate_' + ofId);
  var timeEl = document.getElementById('remTime_' + ofId);
  var msgEl = document.getElementById('remMsg_' + ofId);
  if (!dateEl || !timeEl) return;
  var date = dateEl.value;
  var time = timeEl.value;
  var msg = msgEl ? msgEl.value : 'Rappel OF ' + ofNum;
  if (!date) return;
  window._ofReminders_requestPermission().then(function() {
    window._ofReminders_add(ofId, ofNum, date, time, msg);
  });
};

/* ─────────────────────────────────────────────
   Toggle activation global
   ───────────────────────────────────────────── */
window._ofReminders_toggleEnabled = function(on) {
  window._ofReminders_setEnabled(on);
  if (on) {
    window._ofReminders_requestPermission().then(function() {
      window._ofReminders_rescheduleAll();
    });
  } else {
    var timers = window._ofReminders_state.timers;
    for (var k in timers) { if (Object.prototype.hasOwnProperty.call(timers, k)) { clearTimeout(timers[k]); } }
    window._ofReminders_state.timers = {};
  }
};

/* ─────────────────────────────────────────────
   Auto-rappel : créer un rappel 1 jour avant l'OF
   ───────────────────────────────────────────── */
window._ofReminders_autoForOf = function(ofId, ofNum, ofDate) {
  if (!ofDate) return;
  var reminders = window._ofReminders_load();
  var exists = reminders.some(function(r) { return r.ofId === ofId && r.message.indexOf('Auto:') === 0; });
  if (exists) return;

  var parts = ofDate.split('-');
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  d.setDate(d.getDate() - 1);
  var autoDate = window._agendaRenderer_makeDateKey(d.getFullYear(), d.getMonth(), d.getDate());
  window._ofReminders_add(ofId, ofNum, autoDate, '07:30', 'Auto: OF ' + (ofNum || ofId) + ' prévu demain');
};

/* ─────────────────────────────────────────────
   Export global
   ───────────────────────────────────────────── */
window.ofReminders = {
  load: window._ofReminders_load,
  save: window._ofReminders_save,
  isEnabled: window._ofReminders_isEnabled,
  requestPerm: window._ofReminders_requestPermission,
  add: window._ofReminders_add,
  remove: window._ofReminders_remove,
  forOf: window._ofReminders_forOf,
  renderPanel: window._ofReminders_renderPanel,
  addFromUI: window._ofReminders_addFromUI,
  toggleEnabled: window._ofReminders_toggleEnabled,
  autoForOf: window._ofReminders_autoForOf,
  rescheduleAll: window._ofReminders_rescheduleAll
};