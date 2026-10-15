/* err-boundary.js — Error boundary global
   Capture les erreurs non interceptées (runtime + promise rejections)
   et les logge dans err-utils au lieu de laisser l'app crasher silencieusement.
   Charge EN PREMIER dans index.html (avant tous les autres scripts). */
(function() {
  'use strict';

  /* ── Handler centralisé ── */
  function handleError(source, error, info) {
    var msg = (error && error.message) ? error.message : String(error);
    var stack = (error && error.stack) ? error.stack.substring(0, 500) : '';
    var detail = source + ': ' + msg + (info ? ' (' + info + ')' : '') + '\n' + stack;

    /* Log via err-utils si disponible, sinon console.
       IMPORTANT : ce fichier charge EN PREMIER, donc errLog
       (modules/err-utils.js) n'existe PAS encore au moment de
       l'install. Le handler s'execute plus tard, mais on garde
       la garde pour rester sur en cas d'erreur tres precoce. */
    if (typeof errLog === 'function') {
      errLog('err-boundary', source, detail, 'error');
    } else {
      console.error('[err-boundary]', detail);
    }

    /* Toast visible pour l'utilisateur (en production) */
    if (typeof showToast === 'function') {
      showToast('Erreur interne — reconnectez-vous si le problème persiste.', 'error');
    }
  }

  /* ── Erreurs synchrones (runtime JS) ── */
  window.onerror = function(message, source, lineno, colno, error) {
    handleError('runtime', error || { message: message }, source + ':' + lineno + ':' + colno);
    return true; /* empêche l'affichage dans la console du navigateur */
  };

  /* ── Promesses rejetées non capturées ── */
  window.addEventListener('unhandledrejection', function(event) {
    var reason = event.reason || event.detail || 'Unknown promise rejection';
    if (reason instanceof Error) {
      handleError('promise', reason);
    } else {
      handleError('promise', { message: String(reason) });
    }
  });

  /* NOTE : errLog n'est PAS encore defini ici (err-utils.js charge
     apres). D'ou la garde — sans elle, l'installation de l'error
     boundary leve un ReferenceError et neutralise le filet lui-meme. */
  if (typeof errLog === 'function') {
    errLog('err-boundary', 'init', 'Error boundary installe', 'info');
  }
})();
