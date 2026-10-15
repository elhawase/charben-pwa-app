(function () {
  var attempts = 0;
  function initAnalytics() {
    try {
      if (typeof firebase !== 'undefined' && firebase.analytics && firebase.apps && firebase.apps.length) {
        firebase.analytics();
        return true;
      }
    } catch (e) {}
    if (++attempts < 20) { setTimeout(initAnalytics, 250); }
    return false;
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initAnalytics();
  } else {
    window.addEventListener('load', initAnalytics);
  }
})();