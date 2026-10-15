/* ============================================================
 * core.js - UI / navigation / theme / modals / lucide icons
 * Extrait de app.js (Cycle 1 - modularisation)
 * Charge AVANT app.js
 * ============================================================ */

/* ─── Error Handler Global (Cycle 2 - robustesse) ─── */
var _errorLog = [];
window.onerror = function(msg, url, line, col, err) {
  var entry = { t: Date.now(), m: msg, l: line, c: col, u: (url || '').split('/').pop() };
  _errorLog.push(entry);
  if (_errorLog.length > 50) _errorLog.shift();
  if (typeof showToast === 'function') {
    showToast('Erreur technique : ' + (msg || '').slice(0, 80), 'error');
  }
};
window.onunhandledrejection = function(ev) {
  var reason = ev.reason || ev;
  var msg = (reason && reason.message) ? reason.message : String(reason);
  var entry = { t: Date.now(), m: 'UnhandledPromise: ' + msg.slice(0, 120) };
  _errorLog.push(entry);
  if (_errorLog.length > 50) _errorLog.shift();
  if (typeof showToast === 'function') {
    showToast('Erreur async : ' + msg.slice(0, 80), 'error');
  }
};

/* ─── END AUTH SYSTEM ─── */

function showToast(message, type = 'success', options = {}) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '<i data-lucide="check-circle" style="width:18px;height:18px;"></i>', error: '<i data-lucide="x-circle" style="width:18px;height:18px;"></i>', warning: '<i data-lucide="alert-triangle" style="width:18px;height:18px;"></i>', info: '<i data-lucide="info" style="width:18px;height:18px;"></i>' };
  const title = options.title || null;
  const body = options.description || message;
  const duration = options.duration || 3200;
  let html = '<span class="toast-icon">' + (icons[type] || '') + '</span>';
  html += '<div class="toast-body">';
  if (title) html += '<div class="toast-title">' + escapeHtml(title) + '</div>';
  html += '<div class="toast-msg">' + escapeHtml(body) + '</div>';
  html += '</div>';
  html += '<button type="button" class="toast-close" onclick="this.closest(\'.toast\').remove()" aria-label="Fermer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
  if (options.progress !== false) html += '<span class="toast-progress"></span>';
  toast.innerHTML = html;
  container.appendChild(toast);
  renderLucide();
  const progress = toast.querySelector('.toast-progress');
  if (progress) {
    progress.style.transitionDuration = duration + 'ms';
    requestAnimationFrame(() => progress.classList.add('active'));
  }
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

function initTheme() {
  const saved = loadFromStorage(STORAGE_KEYS.theme, 'light');
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon();
}

function initAuthParticles() {
  var canvas = document.getElementById('authParticles');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var w, h, particles = [];
  function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  for (var i = 0; i < 50; i++) {
    particles.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      s: Math.random() * 2 + 0.5, o: Math.random() * 0.25 + 0.05
    });
  }
  function anim() {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x > w) p.x = 0; if (p.x < 0) p.x = w;
      if (p.y > h) p.y = 0; if (p.y < 0) p.y = h;
      ctx.fillStyle = 'rgba(255,255,255,' + p.o + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(anim);
  }
  anim();
}

function initInputGlow() {
  document.querySelectorAll('.input-wrap').forEach(function(wrap) {
    wrap.addEventListener('mousemove', function(e) {
      var rect = wrap.getBoundingClientRect();
      wrap.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width * 100) + '%');
      wrap.style.setProperty('--my', ((e.clientY - rect.top) / rect.height * 100) + '%');
    });
  });
}

function togglePassword() {
  var pw = document.getElementById('loginPassword');
  var btn = document.getElementById('pwToggle');
  if (pw.type === 'password') {
    pw.type = 'text';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  } else {
    pw.type = 'password';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
}

function socialAuth(provider) {
  showToast('Connexion ' + provider + ' sera disponible dans une mise a jour', 'info');
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  safeSave(STORAGE_KEYS.theme, next);
  updateThemeIcon();
  showToast(`Mode ${next === 'dark' ? 'sombre' : 'clair'} activé`, 'info');
}

/* MODERN NAVIGATION — Bottom Nav + Module Grid (Material Design 3) */
/* Icônes Lucide (licence ISC, https://lucide.dev) — SVG inline, 100% offline */
var LUCIDE = {
  data: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  equip: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  gds: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  disques: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  mp: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  pf: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  menu: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  more: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  outils: '<path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>',
  planning: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  bookmarkPlus: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/><line x1="12" x2="12" y1="7" y2="13"/><line x1="15" x2="9" y1="10" y2="10"/>',
  calendarDays: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
  checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  disc3: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  factory: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  thermometer: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
  treePine: '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  clipboard: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  alertTriangle: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  link2: '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  chevronsUpDown: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  clipboardList: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  percent: '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  barChart3: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
  trendingUp: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  calculator: '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
  fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  messageSquare: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  radio: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19.1"/>',
  recycle: '<path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/><path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/><path d="m14 16-3 3 3 3"/><path d="M8.293 13.596 7.196 9.5 3.1 10.598"/><path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"/><path d="m13.378 9.633 4.096 1.098 1.097-4.096"/>',
  key: '<path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  refreshCw: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  hardHat: '<path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M4 15v-3a6 6 0 0 1 6-6"/><path d="M14 6a6 6 0 0 1 6 6v3"/>',
  triangle: '<path d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  scrollText: '<path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  shirt: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  footprints: '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/>',
  mask: '<path d="M2 14a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2 1 1 0 0 1-1-1v-2.3a2.7 2.7 0 0 0-5.4 0V20a1 1 0 0 1-1 1 2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z"/>',
  gloves: '<path d="M2 10v5"/><path d="M2 8v2"/><path d="M4 14V6a2 2 0 0 1 2-2h1"/><path d="M8 14V4a2 2 0 0 1 2-2h1"/><path d="M12 14V4a2 2 0 0 1 2-2h1"/><path d="M16 6v8"/><path d="M3 18a1 1 0 0 1-1-1v-3h6v3a1 1 0 0 1-1 1Z"/><path d="M5 20h14a2 2 0 0 0 2-2v-2c0-1.1-.9-2-2-2h-1v2a1 1 0 0 1-1 1"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  handshake: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
  circle: '<circle cx="12" cy="12" r="10"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  keyRound: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
  delete: '<path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"/><line x1="18" x2="12" y1="9" y2="15"/><line x1="12" x2="18" y1="9" y2="15"/>',
  trash2: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  hexagon: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
  building2: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  construction: '<rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14 2.3 6.3"/><path d="m14 6 7.7 7.7"/><path d="m8 6 8 8"/>',
  brain: '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M12 5v13"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>'
};
function LI(name, cls) {
  var paths = LUCIDE[name] || '';
  var cn = cls ? 'lucide-svg ' + cls : 'lucide-svg';
  return '<svg class="' + cn + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
}
/* Material Symbols — helper ligature : MI('check_circle','mi-green') -> <span class="mi">check_circle</span> */
function MI(name, cls) {
  var cn = cls ? 'mi ' + cls : 'mi';
  return '<span class="' + cn + '" aria-hidden="true">' + name + '</span>';
}
function renderLucide() {
  document.querySelectorAll('[data-lucide]').forEach(function(el) {
    if (el.dataset.lucide && !el.innerHTML.trim()) {
      var kv = el.dataset.lucide.replace(/-([a-z0-9])/g, function(m, c) { return c.toUpperCase(); });
      el.innerHTML = LI(LUCIDE[kv] ? kv : el.dataset.lucide);
    }
  });
}
var appModules = [
  { id: 'planning', label: 'Planning', icon: 'planning', desc: 'Planification des tâches, équipes et chantiers', route: 'planning' },
  { id: 'mp', label: 'Matières Premières', icon: 'mp', desc: 'Grumes, inventaire et entrées', route: 'mp' },
  { id: 'production', label: 'Production', icon: 'factory', desc: 'Pilotage des lignes de sciage A & B, séchage, rendement', route: 'production' },
  { id: 'pf', label: 'Produits Finis', icon: 'pf', desc: 'Stock de planches, madriers, chevrons', route: 'pf' },
  { id: 'settings', label: 'Paramètres', icon: 'settings', desc: 'Réglages, export Excel et import des données', route: 'settings' }
];
var bottomNavScreens = ['menu', 'settings'];

function navigateTo(screen) {
  if (screen === 'more') { openMoreSheet(); return; }
  closeMoreSheet();
  showScreen(screen);
}

function setBottomNavActive(screen) {
  document.querySelectorAll('#bottomNav .bn-item').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.screen === screen);
  });
}

function openMoreSheet() {
  document.getElementById('moreSheetOverlay').classList.add('open');
  setBottomNavActive('more');
  renderModuleGrid();
}

function closeMoreSheet() {
  document.getElementById('moreSheetOverlay').classList.remove('open');
}

function renderModuleGrid() {
  var grid = document.getElementById('moreModuleGrid');
  if (!grid) return;
  renderModuleGridInto(grid);
}

function renderModuleGridInto(grid) {
  var html = '';
  appModules.filter(function(m) { return m.id !== 'settings'; }).forEach(function(m, i) {
    var feature = true;
    var icon = LUCIDE[m.icon] ? LI(m.icon) : escapeHtml(m.icon);
    var st = moduleLiveStat(m.id);
    var kpi = '';
    if (st && st.v !== '') {
      kpi = '<span class="bento-kpi">' +
        escapeHtml(String(st.v)) + ' <i>' + escapeHtml(st.label) + '</i></span>';
    }
    var arrow = MI('arrow_forward', 'bento-arrow-ico');
    html += '<button type="button" class="bento-item bento-feature bento-feature-' + m.id + '"' +
      ' style="animation-delay:' + (i * 40) + 'ms"' +
      ' onclick="navigateTo(\'' + m.route + '\');closeMoreSheet();">' +
      '<span class="bento-icon">' + icon + '</span>' +
      '<span class="bento-body">' +
        '<span class="bento-title">' + escapeHtml(m.label) + '</span>' +
        '<span class="bento-desc">' + escapeHtml(m.desc) + '</span>' +
        kpi +
      '</span>' +
      arrow +
    '</button>';
  });
  grid.innerHTML = html;
  var cnt = document.getElementById('moreModuleCount');
  if (cnt) cnt.textContent = String(appModules.filter(function(m) { return m.id !== 'settings'; }).length);
}

function moduleLiveStat(id) {
  function arr(v) { return (typeof v !== 'undefined' && v && Array.isArray(v)) ? v : []; }
  try {
    var today = new Date().toISOString().slice(0, 10);
    switch (id) {
      case 'mp': {
        var raw = arr(rawMaterials);
        var nonConsumeCount = raw.filter(function(r) { return r && r.statut !== 'CONSOMME'; }).length;
        return nonConsumeCount ? { v: nonConsumeCount, label: 'grumes' } : null;
      }
      case 'production': {
        var raw2 = arr(rawMaterials);
        var sciagedToday = raw2.filter(function(r) {
          return r && r.statut === 'CONSOMME' && String(r.validatedAt ? r.validatedAt : r.launchedAt ? r.launchedAt : '').slice(0, 10) === today;
        }).length;
        return { v: sciagedToday, label: 'sci\u00e9es auj.' };
      }
      case 'planning': {
        var pp = arr(productionPlan);
        var activeOfCount = 0;
        pp.forEach(function(o) { if (o && (o.status === 'engage' || o.status === 'en_cours')) activeOfCount++; });
        return { v: activeOfCount, label: 'OF en cours' };
      }
      case 'pf': {
        var fg = arr(finishedGoods);
        return fg.length ? { v: fg.length, label: 'r\u00e9f\u00e9rences' } : null;
      }
      case 'equip': {
        var eq = arr(equipment);
        return eq.length ? { v: eq.length, label: "\u00e9quipements" } : null;
      }
    }
  } catch (e) {}
  return null;
}

function renderHomeModules() {
  var nameEl = document.getElementById('homeUserName');
  if (nameEl && currentUser && currentUser.email) {
    nameEl.textContent = currentUser.email.split('@')[0];
  }
  var dateEl = document.getElementById('homeHeroDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  // Time
  var timeEl = document.getElementById('homeHeroTime');
  if (timeEl) {
    timeEl.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  // Version
  var versionEl = document.getElementById('homeHeroVersion');
  if (versionEl) {
    versionEl.textContent = 'v6.2';
  }
  // Admin broadcast
  loadAdminBroadcast();
}

// Load admin broadcast message from localStorage (set by admin in settings)
function loadAdminBroadcast() {
  var banner = document.getElementById('adminBroadcastBanner');
  var textEl = document.getElementById('adminBroadcastText');
  if (!banner || !textEl) return;
  var msg = localStorage.getItem('charben_admin_broadcast');
  if (msg && msg.trim()) {
    // Check if user already dismissed this message
    var dismissed = localStorage.getItem('charben_broadcast_dismissed');
    if (dismissed !== msg) {
      textEl.textContent = msg;
      banner.style.display = 'flex';
    }
  }
}

function dismissAdminBroadcast() {
  var banner = document.getElementById('adminBroadcastBanner');
  var textEl = document.getElementById('adminBroadcastText');
  if (banner && textEl) {
    var msg = textEl.textContent;
    if (msg) localStorage.setItem('charben_broadcast_dismissed', msg);
    banner.style.display = 'none';
  }
}

function renderTopBarAvatar() {
  var av = document.getElementById('topBarAvatar');
  if (!av) return;
  if (currentUser && currentUser.email) {
    av.textContent = currentUser.email.charAt(0).toUpperCase();
  }
}

/* Handle resize */
window.addEventListener('resize', function() {
  /* modern layout is fluid — no action needed */
});

function updateThemeIcon() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const btn = document.querySelector('.top-bar-theme');
  if (!btn) return;
  if (isDark) {
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
  } else {
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
  }
}

function showModal(title, message, icon, callback, options) {
  var miMap = { '⚠️': 'warning', '⚠': 'warning', '🗑️': 'delete', '🗑': 'delete', '🌡️': 'device_thermostat', '❌': 'cancel', '✅': 'check_circle', '⚙️': 'settings', '⚖️': 'balance', '📊': 'bar_chart', '🔧': 'construction', '🚚': 'local_shipping', '📦': 'inventory_2', '📝': 'edit', '📥': 'upload', '📜': 'history' };
  var miName = miMap[icon];
  document.getElementById('modalIcon').innerHTML = miName ? MI(miName, 'mi-lg ' + (miName === 'warning' || miName === 'cancel' ? 'mi-amber' : 'mi-red')) : (icon || MI('warning', 'mi-lg mi-amber'));
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMessage').textContent = message;
  const okBtn = document.getElementById('modalOkBtn');
  const cancelBtn = document.getElementById('modalCancelBtn');
  const danger = !options || options.danger !== false;
  okBtn.textContent = (options && options.confirmText) || 'Confirmer';
  okBtn.classList.toggle('btn-danger', danger);
  okBtn.classList.toggle('btn-primary', !danger);
  if (cancelBtn) cancelBtn.textContent = (options && options.cancelText) || 'Annuler';
  document.getElementById('confirmModal').classList.add('open');
  pendingConfirmCallback = callback;
}

function closeModal() {
  document.getElementById('confirmModal').classList.remove('open');
  pendingConfirmCallback = null;
}

/* ─── showPrompt(title, message, defaultValue, callback) ───
 * Remplacement de window.prompt (interdit dans ce projet).
 * Utilise le formModal existant avec un input integre. */
var _promptCallback = null;
function showPrompt(title, message, defaultValue, callback) {
  var body = '<div style="margin-bottom:10px;font-size:13px;color:var(--text-secondary);">' + escapeHtml(message) + '</div>'
    + '<input type="text" id="promptInput" value="' + escapeHtml(defaultValue || '') + '" '
    + 'style="width:100%;padding:8px 12px;border:1px solid var(--border-color);border-radius:var(--radius-sm);'
    + 'background:var(--bg-primary);color:var(--text-primary);font-size:13px;box-sizing:border-box;" '
    + 'autofocus />';
  document.getElementById('formModalTitle').textContent = title;
  document.getElementById('formModalIcon').innerHTML = MI('edit', 'mi-lg mi-blue');
  document.getElementById('formModalBody').innerHTML = body;
  var okBtn = document.getElementById('formModalOkBtn');
  okBtn.classList.add('btn-primary');
  okBtn.classList.remove('btn-danger');
  okBtn.textContent = 'Valider';
  _promptCallback = callback;
  formModalFallbackIntent = _resolvePrompt;
  document.getElementById('formModal').classList.add('open');
  setTimeout(function() { var i = document.getElementById('promptInput'); if (i) i.focus(); }, 80);
}
function _resolvePrompt() {
  var input = document.getElementById('promptInput');
  var val = input ? input.value.trim() : '';
  if (_promptCallback) _promptCallback(val);
  _promptCallback = null;
  closeFormModal();
}

function confirmAction() {
  if (pendingConfirmCallback) pendingConfirmCallback();
  closeModal();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDiagramZoom(); }
});

function updateTopBarModule(name) {
  var iconEl = document.getElementById('topBarModuleIcon');
  var titleEl = document.getElementById('topBarModuleTitle');
  if (!iconEl || !titleEl) return;
  var iconMap = {
    production: 'factory', sechage: 'layers', mp: 'treePine', pf: 'package',
    equip: 'wrench', disques: 'disc3', planning: 'calendarDays',
    menu: 'menu', settings: 'settings', data: 'data', trace: 'barChart3'
  };
  var titles = {
    production: 'Production', sechage: 'Semi-finis (WIP)', settings: 'Paramètres',
    mp: 'Matières Premières', pf: 'Produits Finis',
    equip: 'Outils & Machines', disques: 'Disques & Lames de sciage',
    planning: 'Planning',
    menu: 'Tableau de bord', data: 'Données — Tableaux & Registres',
    trace: 'Traçabilité'
  };
  iconEl.innerHTML = LI(iconMap[name] || 'menu');
  titleEl.textContent = titles[name] || name;
}

function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  const dateIds = ['rawDate', 'eqInstallDate', 'maintDate', 'planDate', 'ppDate'];
  dateIds.forEach(function(id) {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });
}

function showScreen(name) {
  if (!canAccessScreen(name)) {
    showToast('Accès non autorisé pour votre rôle.', 'error');
    return;
  }
  if (document.body) document.body.classList.toggle('dashboard-fullscreen', name === 'menu');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screenId = 'screen' + name.charAt(0).toUpperCase() + name.slice(1);
  const screenEl = document.getElementById(screenId);
  if (screenEl) screenEl.classList.add('active');
  const navMap = {}
  const navEl = document.getElementById(navMap[name] || '');
  if (navEl) navEl.classList.add('active');
  updateTopBarModule(name);
  closeMoreSheet();
  setBottomNavActive(name);
  renderTopBarAvatar();
  if (name === 'settings') {
    renderMiscSettings();
    renderAccountCard();
    renderUserList();
  }
  if (name === 'production') {
    renderLigne('A');
    renderLigne('B');
    if (typeof procCalculatePattern === 'function') { procCalculatePattern('A'); procCalculatePattern('B'); }
    renderDryList();
    renderWipOfSelect();
    renderWipList();
    if (typeof renderWipMatrix === 'function') renderWipMatrix();
    var adminTools = document.getElementById('prodAdminTools');
    if (adminTools) {
      var showTools = (currentRole === 'admin' || currentRole === 'responsable_technique');
      adminTools.style.display = showTools ? 'block' : 'none';
      if (showTools) {
        if (typeof renderDisquesStockTable === 'function') renderDisquesStockTable('prodDisquesStock');
        if (typeof renderCalesStockTable === 'function') renderCalesStockTable('prodCalesStock');
        if (typeof renderCalesRegul === 'function') renderCalesRegul('prodCalesRegul');
      }
    }
  }
  if (name === 'mp') { renderGrumes(); if (typeof hydrateGrumesFromApi === 'function') { try { hydrateGrumesFromApi(); } catch (e) {} } if (typeof startMpAutoRefresh === 'function') { try { startMpAutoRefresh(10000); } catch (e) {} } }
  if (name === 'pf') { renderProduitsFinis(); if (typeof renderFardeauxList === 'function') renderFardeauxList(); if (typeof hydratePfFromApi === 'function') { try { hydratePfFromApi(); } catch (e) {} } }
  if (name === 'equip') { switchEquipTab(currentEquipTab || 'disques'); }
  if (name === 'disques') { renderDisquesAll(); }
  if (name === 'planning') { setDefaultDates(); switchPlanTab('of'); renderPlanningList(); renderProdPlanList(); renderGammePin(); renderGammeSuggestions(); populateGammeSelects(); var gd = document.getElementById('gammeDimensions'); if (gd) gd.style.display = (currentRole === 'admin') ? '' : 'none'; }
  if (name === 'menu') { renderDashboardKPIs(); renderAlertsPanel(); renderHomeModules(); }
if (name === 'trace') { if (typeof renderTraceScreen === 'function') renderTraceScreen(); }
if (name !== 'mp' && typeof stopMpAutoRefresh === 'function') { try { stopMpAutoRefresh(); } catch (e) {} }
if (typeof applyPermissionGuard === 'function') applyPermissionGuard();
}

function openGlobalSearch() {
  var el = document.getElementById('globalSearchOverlay');
  el.style.display = 'flex';
  var input = document.getElementById('globalSearchInput');
  input.value = '';
  input.focus();
  document.getElementById('globalSearchResults').innerHTML = '';
}
function closeGlobalSearch() {
  document.getElementById('globalSearchOverlay').style.display = 'none';
}
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openGlobalSearch(); }
  if (e.key === 'Escape' && document.getElementById('globalSearchOverlay').style.display !== 'none') closeGlobalSearch();
});
function globalSearch(q) {
  var el = document.getElementById('globalSearchResults');
  if (!q || q.length < 2) { el.innerHTML = ''; return; }
  var raw = q;
  var results = [];
  function pushResult(type, icon, label, sub, screen, item) {
    var s = FuzzySearch.score(
      ((item.orderNum||'')+' '+(item.date||'')+' '+(item.clientName||'')+' '+(item.reference||'')+' '+(item.essence||'')+' '+(item.statut||'')+' '+(item.code||'')+' '+(item.type||'')+' '+(item.qte||'')).trim(),
      raw);
    if (s > 0) results.push({ type: type, icon: icon, label: label, sub: sub, screen: screen, score: s });
  }
  if (typeof orders !== 'undefined') orders.forEach(function(o) {
    pushResult('OF', 'clipboard-list', o.orderNum, (o.date||'') + ' \u2014 ' + (o.clientName||'sans client'), 'planning', o);
  });
  if (typeof rawMaterials !== 'undefined') rawMaterials.forEach(function(r) {
    pushResult('Grume', 'tree-pine', r.code, r.essence + ' \u2014 ' + r.statut, 'mp', r);
  });
  if (typeof finishedGoods !== 'undefined') finishedGoods.forEach(function(f) {
    pushResult('Stock', 'package', f.type+' '+f.essence, f.qte + ' pi\u00e8ces', 'pf', f);
  });
  if (typeof planningTasks !== 'undefined') planningTasks.forEach(function(t) {
    pushResult('T\u00e2che', 'calendar', t.title, t.date + (t.clientName ? ' \u2014 ' + t.clientName : ''), 'planning', t);
  });
  results.sort(function(a,b){ return (b.score - a.score); });
  if (results.length === 0) { el.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:20px;">Aucun r\u00e9sultat pour "' + escapeHtml(q) + '"</div>'; return; }
  el.innerHTML = results.slice(0, 15).map(function(r) {
    return '<div onclick="closeGlobalSearch();showScreen(\'' + r.screen + '\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-secondary);border-radius:var(--radius-sm);margin-bottom:6px;cursor:pointer;transition:background 0.15s;" onmouseenter="this.style.background=\'var(--bg-tertiary)\'" onmouseleave="this.style.background=\'var(--bg-secondary)\'">'
      + '<span style="font-size:10px;color:var(--text-muted);font-weight:700;text-transform:uppercase;width:42px;flex-shrink:0;">' + r.type + '</span>'
      + '<span style="font-weight:600;font-size:13px;">' + escapeHtml(r.label) + '</span>'
      + '<span style="font-size:11px;color:var(--text-muted);flex:1;">' + escapeHtml(r.sub) + '</span>'
      + '<span style="color:var(--text-muted);font-size:11px;">→</span>'
      + '</div>';
  }).join('');
}

// === INVENTREE PATTERN: Traçabilité tab ===
function openTraceTab() {
  showScreen('trace');
}

function searchBatch() {
  var input = document.getElementById('traceBatchInput');
  var result = document.getElementById('traceBatchResult');
  if (!input || !result) return;
  var batch = input.value.trim();
  if (!batch) { result.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Entrez un numéro de lot.</div>'; return; }
  
  var transactions = JSON.parse(localStorage.getItem('charben_stock_transactions') || '[]');
  var batchTx = transactions.filter(function(t) { return t.details && t.details.batch === batch; });
  
  if (batchTx.length === 0) {
    result.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Aucune transaction trouvée pour le lot: ' + escapeHtml(batch) + '</div>';
    return;
  }
  
  var html = '<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px;">' + batchTx.length + ' transaction(s) pour ' + escapeHtml(batch) + '</div>';
  var typeLabels = { 'stock_consumed': '⚙️ Consommé', 'stock_added': '📥 Ajouté', 'transfer_to_pf': '📦 PF', 'build_order_created': '📋 OF créé' };
  batchTx.sort(function(a,b) { return a.timestamp - b.timestamp; }).forEach(function(t) {
    var d = new Date(t.timestamp);
    html += '<div style="font-size:11px;padding:4px 0;border-bottom:1px solid var(--border-color);">'
      + '<span>' + d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'}) + '</span> '
      + '<span style="font-weight:600;">' + (typeLabels[t.type] || t.type) + '</span>'
      + (t.details.order_num ? ' <span style="color:var(--text-muted);">OF ' + escapeHtml(t.details.order_num) + '</span>' : '')
      + '</div>';
  });
  result.innerHTML = html;
}