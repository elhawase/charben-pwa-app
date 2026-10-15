/* haptics.js — Retour tactile natif
   Utilise @capacitor/haptics quand disponible (Android),
   fallback silencieux sur web.
   Appelle hapticsTap() sur les boutons critiques. */
(function() {
  'use strict';

  var _available = false;

  async function check() {
    try {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
        _available = true;
      }
    } catch (e) {
      _available = false;
    }
  }

  async function vibrate(style) {
    if (!_available) return;
    try {
      var fn = window.Capacitor.Plugins.Haptics;
      if (style === 'success') {
        await fn.vibrate({ duration: 50 });
        setTimeout(function() { fn.vibrate({ duration: 50 }); }, 100);
      } else if (style === 'error') {
        await fn.vibrate({ duration: 200 });
      } else if (style === 'warning') {
        await fn.vibrate({ duration: 100 });
      } else {
        await fn.impact({ style: 'medium' });
      }
    } catch (e) {}
  }

  function tap() { vibrate('light'); }
  function success() { vibrate('success'); }
  function error() { vibrate('error'); }
  function warning() { vibrate('warning'); }

  /* Initialiser */
  if (window.Capacitor) check();

  window.haptics = {
    tap: tap,
    success: success,
    error: error,
    warning: warning,
    isAvailable: function() { return _available; }
  };

  /* Auto-attach sur boutons critiques au chargement */
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      document.querySelectorAll('.btn-primary, .auth-btn').forEach(function(btn) {
        btn.addEventListener('click', tap);
      });
    }, 1000);
  });
})();
