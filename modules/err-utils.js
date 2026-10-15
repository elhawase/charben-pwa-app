/* ============================================================
 * err-utils.js — Gestion centralisée des erreurs + audit
 * Pattern uniforme : errLog() / errUser() / errTry() / errAsync()
 * Charge APRÈS core.js (utilise _errorLog, showToast)
 * ============================================================ */

/* ─── Niveaux de log ─── */
var _errLogLevel = 0; /* 0=debug 1=info 2=warn 3=error */
var _LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

/* ─── errLog(module, context, error) ───
 * Log centralisé : ring buffer _errorLog + console.warn.
 * Retourne l'entrée créée pour debugging. */
function errLog(module, context, error, level) {
  var lvl = (level && _LOG_LEVELS[level] != null) ? level : 'error';
  if (_LOG_LEVELS[lvl] < _errLogLevel) return null;
  var msg = (error && error.message) ? error.message : String(error || 'unknown');
  var entry = { t: Date.now(), lvl: lvl, m: '[' + module + '.' + context + '] ' + msg.slice(0, 200) };
  if (typeof _errorLog !== 'undefined') {
    _errorLog.push(entry);
    if (_errorLog.length > 500) _errorLog.shift();
  }
  var fn = lvl === 'error' ? console.error : lvl === 'warn' ? console.warn : console.log;
  fn('[' + lvl.toUpperCase() + ':' + module + '.' + context + ']', error);
  return entry;
}

/* ─── errInfo(module, context, msg) ─── */
function errInfo(module, context, msg) {
  return errLog(module, context, msg, 'info');
}

/* ─── errWarn(module, context, msg) ─── */
function errWarn(module, context, msg) {
  return errLog(module, context, msg, 'warn');
}

/* ─── errUser(message, context) ───
 * Toast utilisateur pour erreurs métier. */
function errUser(message, context) {
  var msg = context ? context + ' : ' + message : message;
  if (typeof showToast === 'function') showToast(msg, 'error');
  return msg;
}

/* ─── errTry(module, context, fn) ───
 * try/catch synchronisé : log + toast en cas d'erreur. Retourne null. */
function errTry(module, context, fn) {
  try {
    return fn();
  } catch (e) {
    errLog(module, context, e, 'error');
    errUser((e.message || 'Erreur').slice(0, 80), context);
    return null;
  }
}

/* ─── errAsync(module, context, fn) ───
 * Version async de errTry pour chaînes de promesses. */
async function errAsync(module, context, fn) {
  try {
    return await fn();
  } catch (e) {
    errLog(module, context, e, 'error');
    errUser((e.message || 'Erreur').slice(0, 80), context);
    return null;
  }
}

/* ─── errSilent(module, context, fn) ───
 * try/catch silencieux : log uniquement, pas de toast.
 * Pour les opérations non critiques (localStorage, etc.). */
function errSilent(module, context, fn) {
  try {
    return fn();
  } catch (e) {
    errLog(module, context, e, 'warn');
    return null;
  }
}

/* ─── errAudit(action, details) ───
 * Écrit dans le buffer auditLogs global (append only). */
function errAudit(action, details) {
  if (typeof auditLogs !== 'undefined' && Array.isArray(auditLogs)) {
    auditLogs.push({ action: action, details: details || '', ts: new Date().toISOString(), user: (typeof currentUser !== 'undefined' ? currentUser : '') });
    if (auditLogs.length > 500) auditLogs = auditLogs.slice(-500);
  }
}

/* ─── errFlush() ───
 * Dump du ring buffer comme JSON (pour export/debug). */
function errFlush() {
  return JSON.stringify(typeof _errorLog !== 'undefined' ? _errorLog : []);
}

/* ─── errSetLevel(level) ─── */
function errSetLevel(level) {
  if (_LOG_LEVELS[level] != null) _errLogLevel = _LOG_LEVELS[level];
}

/* ─── Crash Reporting — collecte structurée ─── */
var _crashBuffer = [];
var _CRASH_MAX = 100;

function crashReport(source, error, extra) {
  var entry = {
    ts: new Date().toISOString(),
    source: source,
    msg: (error && error.message) ? error.message : String(error || 'unknown'),
    stack: (error && error.stack) ? error.stack.substring(0, 500) : '',
    url: typeof location !== 'undefined' ? location.href : '',
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    role: typeof currentRole !== 'undefined' ? currentRole : null,
    user: typeof currentUser !== 'undefined' && currentUser ? currentUser.email : null,
    extra: extra || null
  };
  _crashBuffer.push(entry);
  if (_crashBuffer.length > _CRASH_MAX) _crashBuffer.shift();
  errLog('crash', source, entry.msg, 'error');
  return entry;
}

function crashFlush() {
  var data = JSON.stringify(_crashBuffer);
  _crashBuffer = [];
  return data;
}

function crashCount() {
  return _crashBuffer.length;
}

/* ─── localStorage Volume Monitor ─── */
var _storageWarned = false;
function checkStorageVolume() {
  if (_storageWarned) return;
  try {
    var total = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('charben_') === 0) {
        total += (localStorage.getItem(k) || '').length * 2;
      }
    }
    var mb = total / (1024 * 1024);
    if (mb > 4.5) {
      _storageWarned = true;
      errLog('storage', 'volume', 'localStorage critique: ' + mb.toFixed(2) + ' MB / 5 MB — risque de perte de données', 'warn');
      if (typeof showToast === 'function') {
        showToast('Stockage local quasi-plein (' + mb.toFixed(1) + ' MB). Pensez à exporter les données.', 'warning');
      }
    } else if (mb > 3) {
      errInfo('storage', 'volume', 'localStorage: ' + mb.toFixed(2) + ' MB');
    }
  } catch (e) {
    errLog('storage', 'volumeCheck', e, 'warn');
  }
}
/* Vérifier au chargement et toutes les 5 minutes */
if (typeof window !== 'undefined') {
  setTimeout(checkStorageVolume, 2000);
  setInterval(checkStorageVolume, 300000);
}
