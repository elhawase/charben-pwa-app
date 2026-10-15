/**
 * FIRESTORE-PAGES.JS — Contrat de pagination Firestore (F-04)
 * Scierie Charben — Limite 1 MiB par document Firestore.
 *
 * Aujourd'hui chaque collection FS_COLLECTIONS vit dans UN document
 * `{col}/shared` contenant { items: [...] }. Au-delà de la limite, le set()
 * échoue (puis sync-manager rejoue et échoue à nouveau : boucle).
 *
 * F-04 (sharding) : découper la série canonique en N pages bornées, chaque
 * page étant un document `{col}/pg_00000`.. de structure uniforme
 * `{ items: [tranche] }`, plus un document d'en-tête `{col}/pg_meta`
 * portant `seqCount` (nombre de pages) et `schema`. Lecture = meta, puis
 * pages 0..seqCount-1, concaténées. L'ancien doc `shared` reste le repli
 * backward-compatible tant que pg_meta est absent.
 *
 * CE MODULE NE CONTIENT AUCUN SECRET NI CHEMIN CONFIDENTIEL : il est le seul
 * contrat partagé entre firebase-core.js (écriture, zone confidentielle),
 * realtime-sync.js (lecture) et les tests. Les deux côtés l'utilisent pour
 * produire des adresses de documents IDENTIQUES.
 *
 * Exposé : window.__FSPAGES__
 */
(function() {
  'use strict';

  var PAGE_PREFIX = 'pg_';
  var META_KEY = 'pg_meta';
  var SCHEMA = 'pages-v1';

  /* Budget cible de contenu par page : 512 KiB, sous la limite Firestore
     1 MiB, avec une réserve de cadrage (JSON, clés) pour ne JAMAIS dépasser
     la limite même en cas d'approximation de mesure. */
  var PAGE_BUDGET_BYTES = 524288;
  var PAGE_FRAME_RESERVE_BYTES = 4096;
  var HARD_LIMIT_BYTES = 1048576;

  /* Largeur de la partie numérique des ids de page : pg_00000 → 99999 pages
     (plafond ~48 Go par collection, hors sujet ici). */
  var SEQ_WIDTH = 5;

  function keyOf(item) {
    if (!item) return null;
    if (item.id != null && item.id !== '') return String(item.id);
    if (item.orderNum != null && item.orderNum !== '') return String(item.orderNum);
    if (item.code != null && item.code !== '') return String(item.code);
    if (item.reference != null && item.reference !== '') return String(item.reference);
    return null;
  }

  function serializedSize(item) {
    try { return JSON.stringify(item).length; } catch (e) { return 0; }
  }

  function sortKey(item) {
    var k = keyOf(item);
    return k != null ? 'k:' + k : 'j:' + serializedSize(item) + ':' + item;
  }

  /* Tri canonique : identique sur tous les appareils pour que les frontières
     de pages soient déterministes. Priorité : id, orderNum, code, reference,
     sinon la forme sérialisée (ordre stable seulement sur la même machine). */
  function canonicalOrder(items) {
    if (!Array.isArray(items)) return [];
    return items.map(function(item, i) { return { item: item, sk: sortKey(item), i: i }; })
      .sort(function(a, b) { return a.sk < b.sk ? -1 : a.sk > b.sk ? 1 : a.i - b.i; })
      .map(function(e) { return e.item; });
  }

  function sealPage(items) {
    return { items: items, bytes: serializedSize(items) };
  }

  function zeroPad(n, width) {
    var s = String(n);
    while (s.length < width) s = '0' + s;
    return s;
  }

  function docIdFor(seq) {
    return PAGE_PREFIX + zeroPad(seq, SEQ_WIDTH);
  }

  /* Découpe la série canonique en pages dont le contenu sérialisé ne dépasse
     pas le budget (moins la réserve de cadrage). Un item unique plus lourd que
     le budget utile est tout de même émis sur sa propre page (le garde-fou
     isOversized() le signalera en écriture). */
  function slicePages(items, budget) {
    budget = budget || PAGE_BUDGET_BYTES;
    var usable = Math.max(1024, budget - PAGE_FRAME_RESERVE_BYTES);
    var ordered = canonicalOrder(items);
    var pages = [];
    var cur = [];
    var curBytes = 0;
    ordered.forEach(function(item) {
      var b = serializedSize(item);
      if (cur.length > 0 && curBytes + b > usable) {
        pages.push(sealPage(cur));
        cur = [];
        curBytes = 0;
      }
      cur.push(item);
      curBytes += b;
    });
    if (cur.length > 0) pages.push(sealPage(cur));
    return pages.map(function(p, i) {
      return { seq: i, id: docIdFor(i), bytes: p.bytes, items: p.items };
    });
  }

  function metaFor(pages) {
    return { schema: SCHEMA, seqCount: pages.length, updatedAt: new Date().toISOString() };
  }

  /* Inverse de slicePages : les pages ARRIVENT TRIÉES PAR seq croissant. */
  function joinPages(pages) {
    if (!Array.isArray(pages)) return [];
    var out = [];
    pages.forEach(function(p) {
      if (p && Array.isArray(p.items)) out = out.concat(p.items);
    });
    return out;
  }

  /* Dimension de l'écriture mono-document actuelle ({col}/shared). C'est la
     valeur qui déclenche le garde-fou tant que le sharding n'est pas en place. */
  function estimateDocBytes(items) {
    return serializedSize(items);
  }

  function isOversized(items, hardLimit) {
    hardLimit = hardLimit || HARD_LIMIT_BYTES;
    var offenders = [];
    (items || []).forEach(function(item) {
      var b = serializedSize(item);
      if (b > hardLimit) offenders.push({ key: keyOf(item) || '(sans clé)', bytes: b });
    });
    return { oversized: offenders.length > 0, offenders: offenders };
  }

  window.__FSPAGES__ = {
    PAGE_PREFIX: PAGE_PREFIX,
    META_KEY: META_KEY,
    SCHEMA: SCHEMA,
    PAGE_BUDGET_BYTES: PAGE_BUDGET_BYTES,
    PAGE_FRAME_RESERVE_BYTES: PAGE_FRAME_RESERVE_BYTES,
    HARD_LIMIT_BYTES: HARD_LIMIT_BYTES,
    SEQ_WIDTH: SEQ_WIDTH,
    keyOf: keyOf,
    docIdFor: docIdFor,
    canonicalOrder: canonicalOrder,
    slicePages: slicePages,
    metaFor: metaFor,
    joinPages: joinPages,
    estimateDocBytes: estimateDocBytes,
    isOversized: isOversized
  };
})();