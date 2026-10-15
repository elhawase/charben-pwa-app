/**
 * FUZZY-SEARCH.JS — Moteur de recherche tolérant aux fautes (hors-ligne, zéro serveur)
 *
 * Remplace les prédicats naïfs `toLowerCase().includes(...)` qui :
 *   - ne trouvaient pas "CHENE" pour "CHÊNE" (accents)
 *   - ne trouvaient rien si l'opérateur se trompe de 1 lettre
 *   - ne gérait pas "125" vs "12,5" ( virgule décimale )
 *
 * Budget de comparaison borné : la passe floue ne s'exécute qu'après échec de la
 * passe exacte (sous-chaîne), et jamais au-delà de MAX_COMPARISONS par requête.
 * Aucune dépendance externe. Aucune écriture DOM (donc aucun risque XSS).
 */

'use strict';

(function (global) {
  var MAX_COMPARISONS = 20000;
  var normCache = new WeakMap();

  function normalize(value) {
    if (value === null || value === undefined) return '';
    var s = String(value);
    if (!s) return '';
    if (s.normalize) {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function normCached(value) {
    if (value === null || value === undefined) return '';
    var t = typeof value;
    if (t === 'object') {
      if (normCache.has(value)) return normCache.get(value);
      var n = normalize(value);
      normCache.set(value, n);
      return n;
    }
    return normalize(value);
  }

  function budgetFor(len) {
    if (len <= 3) return 0;
    if (len <= 6) return 1;
    return 2;
  }

  /* Damerau-Levenshtein (OSA) borné : sort dès que la ligne dépasse max */
  function distance(a, b, max) {
    var al = a.length, bl = b.length;
    if (a === b) return 0;
    if (al === 0) return bl <= max ? bl : max + 1;
    if (bl === 0) return al <= max ? al : max + 1;
    if (Math.abs(al - bl) > max) return max + 1;

    var prev2 = null, prev = new Array(bl + 1), cur = new Array(bl + 1), i, j;
    for (j = 0; j <= bl; j++) prev[j] = j;

    for (i = 1; i <= al; i++) {
      cur[0] = i;
      var rowMin = max + 1;
      for (j = 1; j <= bl; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        var v = prev[j - 1] + cost;
        var del = prev[j] + 1;
        var ins = cur[j - 1] + 1;
        if (del < v) v = del;
        if (ins < v) v = ins;
        if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) {
          var tr = prev2[j - 2] + 1;
          if (tr < v) v = tr;
        }
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      var old = prev; prev2 = old; prev = cur; cur = old;
    }
    return prev[bl] <= max ? prev[bl] : max + 1;
  }

  /* Fenêtre glissante : "0042" trouvé dans "lot-20260911-gr-0042" */
  function fuzzyWindow(hay, needle, max, state) {
    var nl = needle.length;
    if (nl === 0 || max === 0) return max + 1;
    if (nl > hay.length) return max + 1;
    var best = max + 1;
    for (var i = 0; i + nl <= hay.length; i++) {
      if (state.left <= 0) break;
      state.left--;
      var seg = hay.substr(i, nl);
      if (seg === needle) return 0;
      var d = distance(seg, needle, max);
      if (d < best) {
        best = d;
        if (best <= 1) return best;
      }
    }
    return best;
  }

  function scoreOne(hay, needle, state) {
    if (!needle) return 100;
    if (!hay) return 0;
    if (hay.indexOf(needle) >= 0) return 100;

    var tokens = hay.split(' '), i, t;
    for (i = 0; i < tokens.length; i++) {
      t = tokens[i];
      if (t === needle) return 95;
      if (t.length > 1 && t.indexOf(needle) === 0) return 85;
      if (needle.length > 2 && needle.indexOf(t) === 0 && t.length >= 3) return 75;
    }

    var max = budgetFor(needle.length);
    if (max === 0 || state.left <= 0) return 0;
    var d = fuzzyWindow(hay, needle, max, state);
    if (d > max) return 0;
    return 60 - 12 * d;
  }

  function splitTerms(query) {
    var q = normalize(query);
    if (!q) return [];
    return q.split(' ').filter(function (s) { return s.length > 0; });
  }

  function scoreTerms(hay, terms, state) {
    if (!terms.length) return 100;
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var s = scoreOne(hay, terms[i], state);
      if (s === 0) return 0;
      total += s;
    }
    return total;
  }

  function score(text, query) {
    var hay = normCached(text);
    var terms = splitTerms(query);
    if (!terms.length) return hay ? 0 : 100;
    return scoreTerms(hay, terms, { left: MAX_COMPARISONS });
  }

  function matches(text, query) {
    return score(text, query) > 0;
  }

  function fieldsText(item, fields) {
    var parts = [];
    for (var i = 0; i < fields.length; i++) {
      var v = item[fields[i]];
      if (v === null || v === undefined || v === '') continue;
      parts.push(normCached(v));
    }
    return parts.join(' ');
  }

  function filterItems(items, query, fields, opts) {
    opts = opts || {};
    if (!items || !items.length) return [];
    var terms = splitTerms(query);
    if (!terms.length) return items.slice();

    var state = { left: MAX_COMPARISONS };
    var hits = [];
    for (var i = 0; i < items.length; i++) {
      if (!items[i]) continue;
      var s = scoreTerms(fieldsText(items[i], fields), terms, state);
      if (s > 0) hits.push({ item: items[i], score: s, at: i });
    }
    if (opts.rank) {
      hits.sort(function (a, b) { return (b.score - a.score) || (a.at - b.at); });
    }
    var out = [];
    for (var k = 0; k < hits.length; k++) out.push(hits[k].item);
    return out;
  }

  var api = {
    normalize: normalize,
    distance: distance,
    score: score,
    matches: matches,
    filterItems: filterItems,
    MAX_COMPARISONS: MAX_COMPARISONS
  };

  global.FuzzySearch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
