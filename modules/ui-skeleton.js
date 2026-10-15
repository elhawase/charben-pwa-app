/* ============================================================
 * ui-skeleton.js — Squelettes de chargement (design system)
 *
 * Le CSS (.skeleton, .skeleton-line, .skeleton-circle) existe
 * dans styles.css depuis la v7.0 mais n'etait appele par AUCUN
 * fichier JS. Ce module branche le design system.
 *
 * Regle : ne JAMAIS afficher un squelette sur un rendu synchrone
 * (rendu local-first = instantane). Un squelette sur un rendu
 * synchrone est un faux clignotement, pire que pas de squelette.
 * A n'utiliser que sur un VRAI attente reseau / Firestore.
 *
 * Pattern : showSkeleton(el, opts) ... await ... hideSkeleton(el)
 * ou, pour un bloc : withSkeleton(el, opts, fnAsync)
 * ============================================================ */
(function() {
  'use strict';

  var _seq = 0;

  /* ─── showSkeleton(el, opts) ───
   * el    : element DOM (ou id string)
   * opts  : { lines, label, shape, keepContent }
   *   lines      nombre de lignes (defaut 4)
   *   label      texte pour lecteurs d'ecran (defaut "Chargement")
   *   shape      'list' | 'cards' | 'kpi' | 'rows' (defaut 'list')
   *   keepContent true = n'efface pas le contenu existant
   * Returns l'element squelette insere, ou null. */
  function showSkeleton(el, opts) {
    el = _resolve(el);
    if (!el) return null;
    var o = opts || {};
    var lines = Math.max(1, Math.min(o.lines || 4, 12));
    var label = o.label || 'Chargement';
    var shape = o.shape || 'list';

    var id = 'sk-' + (++_seq);
    var wrap = document.createElement('div');
    wrap.className = 'skeleton-wrap';
    wrap.id = id;
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    wrap.setAttribute('aria-busy', 'true');

    var html = '';
    var i;
    if (shape === 'kpi') {
      for (i = 0; i < lines; i++) {
        html += '<div class="skeleton skeleton-block-card">'
          + '<div class="skeleton skeleton-line w80"></div>'
          + '<div class="skeleton skeleton-line w60"></div>'
          + '</div>';
      }
    } else if (shape === 'cards') {
      for (i = 0; i < lines; i++) {
        html += '<div class="skeleton skeleton-block-card">'
          + '<div class="skeleton skeleton-circle"></div>'
          + '<div style="flex:1">'
          + '<div class="skeleton skeleton-line w80"></div>'
          + '<div class="skeleton skeleton-line w60"></div>'
          + '</div></div>';
      }
    } else if (shape === 'rows') {
      for (i = 0; i < lines; i++) {
        html += '<div class="skeleton skeleton-row">'
          + '<div class="skeleton skeleton-line" style="width:22%"></div>'
          + '<div class="skeleton skeleton-line" style="width:38%"></div>'
          + '<div class="skeleton skeleton-line" style="width:16%"></div>'
          + '</div>';
      }
    } else {
      for (i = 0; i < lines; i++) {
        var w = (i === lines - 1) ? ' w60' : (i % 3 === 1 ? '' : ' w80');
        html += '<div class="skeleton skeleton-line' + w + '"></div>';
      }
    }

    wrap.innerHTML = html
      + '<span class="sr-only" aria-live="polite">' + escapeHtml(label) + '</span>';

    if (o.keepContent) {
      el.appendChild(wrap);
    } else {
      el.innerHTML = '';
      el.appendChild(wrap);
    }
    return wrap;
  }

  /* ─── hideSkeleton(el) ───
   * Retire le squelette et rend la main au contenu reel. */
  function hideSkeleton(el) {
    el = _resolve(el);
    if (!el) return false;
    var nodes = el.querySelectorAll ? el.querySelectorAll('.skeleton-wrap') : [];
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].parentNode.removeChild(nodes[i]);
    }
    el.removeAttribute('aria-busy');
    return true;
  }

  /* ─── withSkeleton(el, opts, fn) ───
   * Affiche le squelette, await fn(el), retire le squelette.
   * NE masque jamais une erreur : si fn leve, le squelette est
   * retire puis l'erreur remonte (voir catch de l'appelant). */
  function withSkeleton(el, opts, fn) {
    var node = showSkeleton(el, opts);
    var dom = _resolve(el);
    return Promise.resolve()
      .then(function() { return fn(dom); })
      .then(function(result) { hideSkeleton(dom); return result; },
            function(err) { hideSkeleton(dom); throw err; });
  }

  /* ─── Interne ─── */
  function _resolve(el) {
    if (!el) return null;
    if (typeof el === 'string') return document.getElementById(el);
    return el;
  }

  window.uiSkeleton = {
    show: showSkeleton,
    hide: hideSkeleton,
    with: withSkeleton
  };
  window.showSkeleton = showSkeleton;
  window.hideSkeleton = hideSkeleton;
  window.withSkeleton = withSkeleton;
})();
