/* version-check.js — Vérification de mise à jour au démarrage.
   Interroge un manifeste statique version.json (hébergé avec le frontend /
   Firestore) et compare la version locale (window.APP_VERSION, généré par
   scripts/version-bump.js) avec la version publiée. Si une version plus récente
   est disponible, ouvre la modale standard du projet. Gère forceUpdate (modale
   non fermable) et le téléchargement direct de l'APK (downloadUrl).
   URL du manifeste : window.CHARBEN_VERSION_URL si défini, sinon
   <API_BASE>/version.json (compat héritée), sinon './version.json' (même origine).
   À charger APRÈS core.js (escapeHtml/showToast) et app-version.js (APP_VERSION).
   Exposé en globalThis.UpdateCheck. */
(function () {
  'use strict';

  var g = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : {});

  var CHECK_INTERVAL = 3600000; /* 1 heure */
  var TIMEOUT_MS = 8000;
  var SKIP_KEY = 'charben_update_skip';
  var _lastCheck = 0;
  var _busy = false;
  var _pending = null; /* métadonnées de la MAJ actuellement affichée */

  function esc(v) {
    if (typeof escapeHtml === 'function') return escapeHtml(String(v == null ? '' : v));
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toInt(v) {
    var n = (typeof v === 'number') ? v : parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10);
    return (typeof n === 'number' && isFinite(n) && Number.isInteger(n) && n >= 0) ? n : null;
  }

  function parseVersion(v) {
    var parts = String(v == null ? '' : v).replace(/[^0-9.]/g, '').split('.');
    return [
      parseInt(parts[0] || 0, 10) || 0,
      parseInt(parts[1] || 0, 10) || 0,
      parseInt(parts[2] || 0, 10) || 0
    ];
  }

  function isNewer(remoteName, localName) {
    var r = parseVersion(remoteName), l = parseVersion(localName);
    for (var i = 0; i < 3; i++) {
      if (r[i] > l[i]) return true;
      if (r[i] < l[i]) return false;
    }
    return false;
  }

  /* versionCode entier = autorité ; repli semver si l'un des codes manque. */
  function needUpdate(local, remote) {
    local = local || {}; remote = remote || {};
    var rc = toInt(remote.versionCode), lc = toInt(local.code);
    if (rc != null && lc != null) return rc > lc;
    if (remote.versionName != null) return isNewer(remote.versionName, local.name == null ? '0.0.0' : local.name);
    return false;
  }

  function getLocalVersion() {
    var av = g.APP_VERSION || (typeof window !== 'undefined' ? window.APP_VERSION : null);
    if (av && (av.code != null || av.name != null)) {
      return { code: toInt(av.code), name: av.name != null ? String(av.name) : null };
    }
    var el = (typeof document !== 'undefined') ? document.querySelector('meta[name="app-version"]') : null;
    if (el) {
      var raw = el.getAttribute('content');
      return { code: null, name: raw ? String(raw).split('-')[0] : null };
    }
    return { code: null, name: null };
  }

  function manifestUrl() {
    var u = g.CHARBEN_VERSION_URL || (typeof window !== 'undefined' ? window.CHARBEN_VERSION_URL : null);
    if (u) return String(u);
    var b = g.API_BASE || (typeof window !== 'undefined' ? window.API_BASE : null);
    if (b) return String(b).replace(/\/+$/, '') + '/version.json';
    return './version.json';
  }

  function fetchJSON(url) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; reject(new Error('timeout')); } }, TIMEOUT_MS);
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var opts = { method: 'GET', cache: 'no-store' };
      if (ctrl) {
        opts.signal = ctrl.signal;
        setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, TIMEOUT_MS);
      }
      Promise.resolve()
        .then(function () { return fetch(url, opts); })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
        .then(function (j) { if (!done) { done = true; clearTimeout(timer); resolve(j); } })
        .catch(function (e) { if (!done) { done = true; clearTimeout(timer); reject(e); } });
    });
  }

  function readSkip() { try { return localStorage.getItem(SKIP_KEY); } catch (e) { return null; } }
  function writeSkip(code) { try { localStorage.setItem(SKIP_KEY, String(code)); } catch (e) {} }

  function openDownloadUrl(url) {
    var u = String(url || '');
    if (!/^https?:\/\//i.test(u)) return false;
    var cap = (typeof window !== 'undefined') ? window.Capacitor : null;
    if (cap && cap.Plugins && cap.Plugins.Browser && typeof cap.Plugins.Browser.open === 'function') {
      try { cap.Plugins.Browser.open({ url: u }); return true; } catch (e) {}
    }
    try {
      var a = document.createElement('a');
      a.href = u; a.target = '_system'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      return true;
    } catch (e) {}
    try { window.open(u, '_system'); return true; } catch (e) {}
    return false;
  }

  function el(id) { return (typeof document !== 'undefined') ? document.getElementById(id) : null; }

  function showUpdateModal(meta) {
    var modal = el('updateModal');
    if (!modal) return;
    _pending = meta || {};
    var forced = _pending.forceUpdate === true;
    var vName = esc(_pending.versionName || _pending.versionCode || '');
    var notes = _pending.releaseNotes ? esc(_pending.releaseNotes) : '';

    var icon = el('updateModalIcon');
    if (icon) icon.textContent = forced ? '⛔' : '⬆️';
    var title = el('updateModalTitle');
    if (title) title.textContent = forced ? 'Mise à jour obligatoire' : 'Mise à jour disponible';
    var msg = el('updateModalMessage');
    if (msg) msg.innerHTML = 'La version <b>' + vName + '</b> est disponible.' + (notes ? '<br><br>' + notes : '');
    var laterBtn = el('updateModalLaterBtn');
    if (laterBtn) laterBtn.style.display = forced ? 'none' : '';
    var nowBtn = el('updateModalNowBtn');
    if (nowBtn) nowBtn.textContent = forced ? 'Mettre à jour maintenant' : 'Mettre à jour';
    modal.dataset.force = forced ? '1' : '0';
    modal.classList.add('open');
  }

  function closeUpdateModal(force) {
    var modal = el('updateModal');
    if (!modal) return;
    if (modal.dataset.force === '1' && force !== true) return; /* non fermable si forceUpdate */
    modal.classList.remove('open');
    if (force === true) _pending = null;
  }

  function later() {
    if (_pending && _pending.versionCode != null) writeSkip(_pending.versionCode);
    var modal = el('updateModal');
    if (modal) modal.dataset.force = '0';
    closeUpdateModal(true);
  }

  function download() {
    if (!_pending) return;
    if (!openDownloadUrl(_pending.downloadUrl)) {
      if (typeof showToast === 'function') showToast('Lien de téléchargement indisponible', 'error');
    }
  }

  function onModalBackdrop(ev) {
    var modal = el('updateModal');
    if (ev && modal && ev.target === modal && modal.dataset.force !== '1') closeUpdateModal(true);
  }

  async function checkVersion() {
    if (_busy) return;
    var now = Date.now();
    if (_lastCheck !== 0 && now - _lastCheck < CHECK_INTERVAL) return;
    _busy = true;
    _lastCheck = now;
    try {
      var url = manifestUrl();
      if (!url) return;
      var remote = await fetchJSON(url);
      if (!remote || typeof remote !== 'object') return;
      var local = getLocalVersion();
      if (!needUpdate(local, remote)) {
        var m = el('updateModal');
        if (m) { m.dataset.force = '0'; m.classList.remove('open'); }
        return;
      }
      if (remote.forceUpdate !== true && readSkip() === String(remote.versionCode)) return;
      showUpdateModal(remote);
      if (typeof errLog === 'function') {
        errLog('version', 'check', 'MAJ dispo: ' + remote.versionName + ' (local: ' + (local.name || local.code) + ')', 'info');
      }
    } catch (e) {
      /* silencieux — hors-ligne ou serveur injoignable : non critique */
    } finally {
      _busy = false;
    }
  }

  function _reset() { _lastCheck = 0; _busy = false; _pending = null; }

  var api = {
    check: checkVersion,
    getLocal: getLocalVersion,
    getLocalVersion: getLocalVersion,
    isNewer: isNewer,
    needUpdate: needUpdate,
    show: showUpdateModal,
    close: closeUpdateModal,
    later: later,
    download: download,
    openDownloadUrl: openDownloadUrl,
    _reset: _reset
  };

  g.UpdateCheck = api;
  g.versionCheck = api;
  if (typeof window !== 'undefined') { window.UpdateCheck = api; window.versionCheck = api; }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('load', function () {
      var modal = document.getElementById('updateModal');
      if (modal) modal.addEventListener('click', onModalBackdrop);
      setTimeout(checkVersion, 5000);
      setInterval(checkVersion, CHECK_INTERVAL);
    });
  }
})();
