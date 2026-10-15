/**
 * TRACE-API.JS — Couche de lecture unique écran Traçabilité.
 * Scierie Charben — lecture seule, KPIs et parcours.
 * Source : données LOCALES (TraceSource, tableaux Firestore), plus aucune API.
 * Dépendances: modules/trace-source.js. Exposé en globalThis.TraceAPI.
 */
(function () {
  'use strict';
  var g = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : {});
  if (typeof window === 'undefined' && typeof g.window === 'undefined') g.window = g;

  var CACHE_KEY = 'charben_trace_cache_v1';
  var STALE_MS = 0; /* lecture locale : toujours fraîche */

  var STATUT_LABELS = {
    EN_STOCK: 'En stock', EN_WIP: 'En WIP', EN_COURSE: 'En cours',
    CONSOMME: 'Consommé', CONFORME: 'Conforme', NON_CONFORME: 'Non conforme'
  };

  var ENDPOINTS = {
    grumes:    { path: '/grumes' },
    articles:  { path: '/articles' },
    wip:       { path: '/articles', params: { statut: 'EN_WIP' } },
    lots:      { path: '/lots' },
    fardeaux:  { path: '/fardeaux' },
    of:        { path: '/rendement' },
    rendement: { path: '/rendement' },
    stock:     { path: '/stock' },
    coherence: { path: '/coherence/pf-wip' },
    audit:     { path: '/audit', params: { limit: 50 } },
    traces:    { path: '/traces', params: { limit: 50 } }
  };

  var memCache = {};
  var store = { rows: {}, meta: {} };
  var liveTimer = null;

  /* Cadence de rafraîchissement live : normale 45s, ralentit si la base
     est injoignable (45s → 60s → 120s) pour ne pas marteler le réseau. */
  var READ_BACKOFF_MS = [45000, 60000, 120000];
  var _readFailStreak = 0;

  function nextPollDelay(failStreak) {
    var n = Number(failStreak);
    if (!isFinite(n) || n < 0) n = 0;
    n = Math.floor(n);
    if (n >= READ_BACKOFF_MS.length) n = READ_BACKOFF_MS.length - 1;
    return READ_BACKOFF_MS[n];
  }

  function cacheBackend() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (e) {}
    return {
      getItem: function (k) { return (k in memCache) ? memCache[k] : null; },
      setItem: function (k, v) { memCache[k] = String(v); }
    };
  }

  function readCache() {
    try { return JSON.parse(cacheBackend().getItem(CACHE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }

  function writeCacheEntry(id, list) {
    try {
      var c = readCache();
      c[id] = { rows: list, at: Date.now() };
      cacheBackend().setItem(CACHE_KEY, JSON.stringify(c));
    } catch (e) {}
  }

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function m3(v) { return Math.round(num(v) * 10000) / 10000; }
  function pct1(v) { return Math.round(num(v) * 10) / 10; }
  function statutLabel(code) { return STATUT_LABELS[code] || (code ? String(code) : '—'); }
  function fmtDate(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('fr-FR');
  }
  function fmtDateTime(v) {
    if (!v) return '—';
    var d = new Date(String(v).replace(' ', 'T'));
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleString('fr-FR');
  }

  /* Source LOCALE : lit les tableaux synchronisés (Firestore) via TraceSource.
     Plus aucun appel réseau. Retourne une promesse de lignes brutes. */
  function localFetch(id) {
    var TS = (typeof TraceSource !== 'undefined') ? TraceSource : (g ? g.TraceSource : null);
    var items = (TS && typeof TS.raw === 'function') ? TS.raw(id) : [];
    return Promise.resolve(Array.isArray(items) ? items : []);
  }

  function normGrume(x) {
    x = x || {};
    return {
      grume_id: x.grume_id, code: x.code || '—', scan_code: x.scan_code || '',
      essence: x.essence || x.essence_code || '—',
      diametre_cm: num(x.diametre_cm), longueur_m: num(x.longueur_m), volume_m3: m3(x.volume_m3),
      statut_code: x.statut_code || '', statut: statutLabel(x.statut_code),
      cree_le: x.cree_le || '', cree_le_fr: fmtDate(x.cree_le)
    };
  }

  function normRendement(x) {
    x = x || {};
    return {
      of_id: x.of_id, numero: x.numero || '—', statut_code: x.statut_code || '', statut: statutLabel(x.statut_code),
      poste: x.poste || '—', ligne: x.ligne || '—', essence: x.essence || x.essence_code || '—',
      nb_grumes: num(x.nb_grumes), volume_grumes_m3: m3(x.volume_grumes_m3),
      nb_pieces: num(x.nb_pieces), volume_produit_m3: m3(x.volume_produit_m3),
      rendement_pct: pct1(x.rendement_pct), rendement_recup_pct: pct1(x.rendement_recup_pct),
      nb_dosses: num(x.nb_dosses), volume_dosses_m3: m3(x.volume_dosses_m3), couverture: x.couverture || '—'
    };
  }

  function normArticle(x) {
    x = x || {};
    return {
      article_id: x.article_id, reference: x.reference || '—', scan_code: x.scan_code || '',
      type: x.type || '—', essence: x.essence || x.essence_code || '—',
      epaisseur_mm: num(x.epaisseur_mm), largeur_mm: num(x.largeur_mm), longueur_mm: num(x.longueur_mm),
      quantite: num(x.quantite), volume_m3: m3(x.volume_m3),
      statut_code: x.statut_code || '', statut: statutLabel(x.statut_code),
      grume_id: x.grume_id, ordre_fabrication_id: x.ordre_fabrication_id,
      lot_sechage_id: x.lot_sechage_id, sf_source_id: x.sf_source_id,
      grume_code: '—', of_numero: '—', lot_numero: '—',
      cree_le: x.cree_le || '', cree_le_fr: fmtDate(x.cree_le)
    };
  }

  function normLot(x) {
    x = x || {};
    return {
      lot_sechage_id: x.lot_sechage_id, numero: x.numero || '—',
      essence: x.essence || x.essence_code || '—',
      statut_code: x.statut_code || '', statut: statutLabel(x.statut_code),
      date_debut: x.date_debut || '', date_debut_fr: fmtDate(x.date_debut),
      date_fin: x.date_fin || '', date_fin_fr: fmtDate(x.date_fin),
      ordre_fabrication_id: x.ordre_fabrication_id, of_numero: x.of_numero || '—'
    };
  }

  function normFardeau(x) {
    x = x || {};
    return {
      fardeau_id: x.fardeau_id, code: x.code || '—',
      statut_code: x.statut_code || '', statut: statutLabel(x.statut_code),
      essence: x.essence || '—', lot_numero: x.lot_numero || '—',
      client_nom: x.client_nom || '—', bl_numero: x.bl_numero || '—',
      nb_references: num(x.nb_references), nb_pieces: num(x.nb_pieces), volume_m3: m3(x.volume_m3),
      date_sortie_sechage: x.date_sortie_sechage || '', date_sortie_sechage_fr: fmtDate(x.date_sortie_sechage),
      date_vente: x.date_vente || '', date_vente_fr: fmtDate(x.date_vente)
    };
  }

  function normStock(x) {
    x = x || {};
    return {
      nature: x.nature || '—', statut_code: x.statut_code || '',
      libelle: x.libelle || '—', nb_lignes: num(x.nb_lignes), volume_m3: m3(x.volume_m3)
    };
  }

  function normCoherence(x) {
    x = x || {};
    return {
      reference_sf: x.reference_sf || '—', qte_semi_finis: num(x.qte_semi_finis),
      qte_produits_finis: num(x.qte_produits_finis), ecart: num(x.ecart),
      controle: x.controle || '—'
    };
  }

  function normAudit(x) {
    x = x || {};
    return {
      horodatage: x.horodatage || '', horodatage_fr: fmtDateTime(x.horodatage),
      action: x.action || '—', utilisateur: x.utilisateur || x.user || '—',
      source: 'journal'
    };
  }

  function normTraceHist(x) {
    x = x || {};
    var det = x.details;
    if (det != null && typeof det === 'object') { try { det = JSON.stringify(det); } catch (e) { det = String(det); } }
    return {
      execute_le: x.execute_le || '', execute_le_fr: fmtDateTime(x.execute_le),
      action: x.action || '—', execute_par: x.execute_par || x.user || '—',
      details: (det == null || det === '') ? '—' : String(det), source: 'trace'
    };
  }

  var NORMALIZERS = {
    grumes: normGrume, of: normRendement, rendement: normRendement,
    articles: normArticle, wip: normArticle, lots: normLot, fardeaux: normFardeau,
    stock: normStock, coherence: normCoherence, audit: normAudit, traces: normTraceHist
  };

  function setMeta(id, source, error) {
    store.meta[id] = { source: source, at: Date.now(), error: error || null, count: (store.rows[id] || []).length };
  }

  function enrichArticles() {
    var grumes = store.rows.grumes || [];
    var lots = store.rows.lots || [];
    var ofs = store.rows.of || [];
    var gById = {}, lById = {}, oById = {};
    grumes.forEach(function (r) { if (r.grume_id != null) gById[r.grume_id] = r; });
    lots.forEach(function (r) { if (r.lot_sechage_id != null) lById[r.lot_sechage_id] = r; });
    ofs.forEach(function (r) { if (r.of_id != null) oById[r.of_id] = r; });
    ['articles', 'wip'].forEach(function (id) {
      (store.rows[id] || []).forEach(function (a) {
        var gr = (a.grume_id != null) ? gById[a.grume_id] : null;
        var lo = (a.lot_sechage_id != null) ? lById[a.lot_sechage_id] : null;
        var ofr = (a.ordre_fabrication_id != null) ? oById[a.ordre_fabrication_id] : null;
        a.grume_code = gr ? gr.code : (a.grume_id != null ? '#' + a.grume_id : '—');
        a.lot_numero = lo ? lo.numero : (a.lot_sechage_id != null ? '#' + a.lot_sechage_id : '—');
        a.of_numero = ofr ? ofr.numero : (a.ordre_fabrication_id != null ? '#' + a.ordre_fabrication_id : '—');
      });
    });
  }

  function load(id, force) {
    var ep = ENDPOINTS[id];
    if (!ep) return Promise.resolve({ ok: false, source: 'error', error: 'table inconnue' });
    var existing = store.rows[id];
    var metaNow = store.meta[id];
    var fresh = metaNow && metaNow.source === 'local' && (Date.now() - metaNow.at) < STALE_MS;
    if (!force && existing && fresh) return Promise.resolve({ ok: true, source: 'local', count: existing.length });
    return localFetch(id).then(function (items) {
      var norm = NORMALIZERS[id] || function (x) { return x; };
      var out = [];
      for (var i = 0; i < items.length; i++) out.push(norm(items[i]));
      store.rows[id] = out;
      enrichArticles();
      setMeta(id, 'local', null);
      writeCacheEntry(id, out);
      return { ok: true, source: 'local', count: out.length };
    }).catch(function (err) {
      var c = readCache()[id];
      var msg = String((err && err.message) || err);
      if (c && c.rows) {
        store.rows[id] = c.rows;
        enrichArticles();
        setMeta(id, 'offline', msg);
        return { ok: false, source: 'offline', count: c.rows.length, error: msg };
      }
      store.rows[id] = store.rows[id] || [];
      setMeta(id, 'offline', msg);
      return { ok: false, source: 'offline', count: 0, error: msg };
    });
  }

  function ensure(id) { return load(id, false); }

  function refreshAll(force) {
    var ids = Object.keys(ENDPOINTS);
    var jobs = ids.map(function (id) { return load(id, force); });
    return Promise.all(jobs).then(function (res) {
      var localOk = res.filter(function (r) { return r && r.source === 'local'; }).length;
      return { ok: localOk > 0, api: localOk, local: localOk, total: res.length };
    });
  }

  function rows(id) { return store.rows[id] || []; }
  function meta(id) { return store.meta[id] || { source: 'none', at: 0, count: 0, error: null }; }

  function kpis() {
    var gr = rows('grumes');
    var art = rows('articles');
    var wipList = rows('wip');
    var lots = rows('lots');
    var fard = rows('fardeaux');
    var rend = rows('rendement');
    function volSum(list) {
      var s = 0;
      for (var i = 0; i < list.length; i++) s += num(list[i].volume_m3);
      return m3(s);
    }
    var wipEff = wipList.length ? wipList : art.filter(function (r) { return r.statut_code === 'EN_WIP'; });
    var artStock = art.filter(function (r) { return r.statut_code === 'EN_STOCK'; });
    var grConso = gr.filter(function (r) { return r.statut_code === 'CONSOMME'; });
    var rendSum = 0, rendN = 0;
    rend.forEach(function (r) { if (num(r.rendement_pct) > 0) { rendSum += num(r.rendement_pct); rendN++; } });
    var ofLigne = {};
    rows('of').forEach(function (r) { if (r.of_id != null) ofLigne[r.of_id] = String(r.ligne || '').toUpperCase(); });
    function volLigne(l) {
      var s = 0;
      art.forEach(function (a) { if (ofLigne[a.ordre_fabrication_id] === l) s += num(a.volume_m3); });
      return m3(s);
    }
    function rendLigne(l) {
      var s = 0, n = 0;
      rend.forEach(function (r) {
        if (String(r.ligne || '').toUpperCase() === l && num(r.rendement_pct) > 0) { s += num(r.rendement_pct); n++; }
      });
      return { nbOf: n, moyenne: n ? Math.round((s / n) * 10) / 10 : 0, vol: volLigne(l) };
    }
    function volConso() { var s = 0; for (var i = 0; i < grConso.length; i++) s += num(grConso[i].volume_m3); return s; }
    var pertesVal = Math.max(0, volConso() - volSum(art));
    return {
      grumes: { count: gr.length, vol: volSum(gr), volConso: volSum(grConso), enStock: gr.filter(function (r) { return r.statut_code === 'EN_STOCK'; }).length, consommes: grConso.length },
      production: { count: art.length, vol: volSum(art) },
      wip: { count: wipEff.length, vol: volSum(wipEff) },
      pf: { count: artStock.length, vol: volSum(artStock) },
      lots: { count: lots.length, enWip: lots.filter(function (r) { return r.statut_code === 'EN_WIP'; }).length },
      fardeaux: { count: fard.length, vol: volSum(fard) },
      pertes: m3(pertesVal),
      rendement: { nbOf: rendN, moyenne: rendN ? Math.round((rendSum / rendN) * 10) / 10 : 0, lignes: { A: rendLigne('A'), B: rendLigne('B') } }
    };
  }

  function fluxVolumes() {
    var k = kpis();
    return [
      { label: 'Grumes reçues', vol: k.grumes.vol },
      { label: 'Grumes consommées', vol: k.grumes.volConso },
      { label: 'Produit total (sciage)', vol: k.production.vol },
      { label: 'WIP (séchage)', vol: k.wip.vol },
      { label: 'PF en stock', vol: k.pf.vol },
      { label: 'Fardeaux', vol: k.fardeaux.vol }
    ];
  }

  function rendementOfs() {
    return rows('rendement').slice().sort(function (a, b) { return num(b.rendement_pct) - num(a.rendement_pct); });
  }

  function search(q) {
    q = String(q || '').trim().toLowerCase();
    var hits = [];
    if (!q) return hits;
    function add(type, id, label, sub) {
      hits.push({ type: type, id: id, label: label, sub: sub });
    }
    rows('grumes').forEach(function (r) {
      var hay = (String(r.code) + ' ' + String(r.essence) + ' ' + String(r.statut)).toLowerCase();
      if (hay.indexOf(q) >= 0) add('grume', r.grume_id, r.code, r.essence + ' · ' + r.statut + ' · ' + r.volume_m3 + ' m³');
    });
    rows('of').forEach(function (r) {
      var hay = (String(r.numero) + ' ' + String(r.essence) + ' ' + String(r.ligne)).toLowerCase();
      if (hay.indexOf(q) >= 0) add('of', r.of_id, r.numero, 'OF · ' + r.essence + ' · ligne ' + r.ligne + ' · ' + r.rendement_pct + ' %');
    });
    rows('articles').forEach(function (r) {
      var hay = (String(r.reference) + ' ' + String(r.grume_code) + ' ' + String(r.lot_numero) + ' ' + String(r.of_numero) + ' ' + String(r.type)).toLowerCase();
      if (hay.indexOf(q) >= 0) add('article', r.article_id, r.reference, r.type + ' · ' + r.essence + ' · ' + r.statut);
    });
    rows('lots').forEach(function (r) {
      var hay = (String(r.numero) + ' ' + String(r.of_numero) + ' ' + String(r.essence)).toLowerCase();
      if (hay.indexOf(q) >= 0) add('lot', r.lot_sechage_id, r.numero, 'Lot séchage · ' + r.essence + ' · ' + r.statut);
    });
    rows('fardeaux').forEach(function (r) {
      var hay = (String(r.code) + ' ' + String(r.client_nom) + ' ' + String(r.lot_numero) + ' ' + String(r.bl_numero)).toLowerCase();
      if (hay.indexOf(q) >= 0) add('fardeau', r.fardeau_id, r.code, 'Fardeau · ' + r.client_nom + ' · ' + r.volume_m3 + ' m³');
    });
    return hits.slice(0, 40);
  }

  function uniqIds(list, key) {
    var out = [], seen = {};
    list.forEach(function (r) {
      var v = r[key];
      if (v == null || v === '' || seen[v]) return;
      seen[v] = true;
      out.push(v);
    });
    return out;
  }

  function parcours(type, id) {
    var artAll = rows('articles');
    var grById = {}, lotById = {}, ofById = {}, fardByLot = {};
    rows('grumes').forEach(function (r) { grById[r.grume_id] = r; });
    rows('lots').forEach(function (r) { lotById[r.lot_sechage_id] = r; });
    rows('of').forEach(function (r) { ofById[r.of_id] = r; });
    rows('fardeaux').forEach(function (r) {
      if (!fardByLot[r.lot_numero]) fardByLot[r.lot_numero] = [];
      fardByLot[r.lot_numero].push(r);
    });
    var arts = [], gr = null, lot = null, ofr = null, fard = null;
    if (type === 'article') {
      artAll.forEach(function (a) { if (a.article_id === id) gr = a; });
      var target = gr; gr = null;
      if (target) {
        arts = [target];
        gr = (target.grume_id != null) ? grById[target.grume_id] : null;
        lot = (target.lot_sechage_id != null) ? lotById[target.lot_sechage_id] : null;
        ofr = (target.ordre_fabrication_id != null) ? ofById[target.ordre_fabrication_id] : null;
      }
    } else if (type === 'grume') {
      gr = grById[id] || null;
      arts = artAll.filter(function (a) { return a.grume_id === id; });
    } else if (type === 'lot') {
      lot = lotById[id] || null;
      arts = artAll.filter(function (a) { return a.lot_sechage_id === id; });
      if (lot && lot.ordre_fabrication_id != null) ofr = ofById[lot.ordre_fabrication_id] || null;
      if (lot) fard = fardByLot[lot.numero] || [];
    } else if (type === 'of') {
      ofr = ofById[id] || null;
      arts = artAll.filter(function (a) { return a.ordre_fabrication_id === id; });
      var lids = uniqIds(arts, 'lot_sechage_id');
      if (lids.length === 1) lot = lotById[lids[0]] || null;
    } else if (type === 'fardeau') {
      rows('fardeaux').forEach(function (r) { if (r.fardeau_id === id) fard = r; });
      if (fard) {
        var lkey = fard.lot_numero;
        rows('lots').forEach(function (r) { if (r.numero === lkey) lot = r; });
        if (lot && lot.ordre_fabrication_id != null) ofr = ofById[lot.ordre_fabrication_id] || null;
        if (lot) arts = artAll.filter(function (a) { return a.lot_sechage_id === lot.lot_sechage_id; });
      }
    }
    var volArt = 0;
    arts.forEach(function (a) { volArt += num(a.volume_m3); });
    var steps = [];
    if (gr) steps.push({ label: 'Grume', value: gr.code, note: gr.essence + ' · Ø ' + gr.diametre_cm + ' cm · ' + gr.longueur_m + ' m · ' + gr.volume_m3 + ' m³ · ' + gr.statut });
    if (ofr) steps.push({ label: 'OF', value: ofr.numero, note: ofr.essence + ' · ligne ' + ofr.ligne + ' · ' + ofr.nb_pieces + ' pièces · rendement ' + ofr.rendement_pct + ' %' });
    steps.push({ label: 'Articles (sciage)', value: String(arts.length), note: arts.length ? m3(volArt) + ' m³ produit' : 'Aucun article lié dans la base' });
    if (lot) steps.push({ label: 'Lot séchage', value: lot.numero, note: lot.essence + ' · ' + lot.statut + ' · début ' + lot.date_debut_fr });
    var fardList = fard ? (Array.isArray(fard) ? fard : [fard]) : [];
    if (fardList.length) {
      fardList.forEach(function (f) {
        steps.push({ label: 'Fardeau', value: f.code, note: f.client_nom + ' · ' + f.volume_m3 + ' m³ · ' + f.statut });
      });
    }
    var title = (gr && gr.code) || (ofr && ofr.numero) || (lot && lot.numero) || (fardList[0] && fardList[0].code) || (arts[0] && arts[0].reference) || ('#' + id);
    return { title: title, steps: steps, articles: arts };
  }

  function esc(v) {
    if (typeof escapeHtml === 'function') return escapeHtml(String(v == null ? '—' : v));
    return String(v == null ? '—' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtVol(v) { return num(v).toFixed(4); }

  function renderTraceStatus() {
    var el = document.getElementById('traceStatus');
    if (!el) return;
    var anyLocal = false, allLocal = true;
    Object.keys(ENDPOINTS).forEach(function (id) {
      var m = meta(id);
      if (m.source === 'local') anyLocal = true;
      if (m.source !== 'local') allLocal = false;
    });
    var mArt = meta('articles');
    var when = mArt.at ? new Date(mArt.at).toLocaleTimeString('fr-FR') : '—';
    if (anyLocal && allLocal) {
      el.innerHTML = '<span class="mi mi-green">✅</span> Données locales (Firestore) — synchronisé à ' + esc(when);
    } else if (anyLocal) {
      el.innerHTML = '<span class="mi mi-amber">⚠️</span> Synchronisation partielle — ' + esc(when);
    } else {
      el.innerHTML = '<span class="mi mi-red">⛔</span> En attente de données locales — ' + esc(when);
    }
    try {
      var pulse = document.getElementById('syncPulse');
      var title = document.getElementById('syncBannerTitle');
      var sub = document.getElementById('syncBannerSub');
      if (pulse) {
        pulse.className = 'sync-pulse' + (allLocal ? ' pulse-green' : (anyLocal ? ' pulse-amber' : ' pulse-red'));
      }
      if (title) {
        title.textContent = (allLocal ? 'Données locales • À jour' : (anyLocal ? 'Données locales • Partiel' : 'Données locales • En attente'));
      }
      if (sub) {
        var lots = rows('lots') || [];
        var lotsCount = lots.length;
        var when2 = mArt.at ? new Date(mArt.at).toLocaleTimeString('fr-FR') : '—';
        sub.textContent = 'Synchro : ' + when2 + ' · ' + lotsCount.toLocaleString('fr-FR') + ' lots';
      }
    } catch (e) {}
    try {
      var warn = document.getElementById('syncBannerWarn');
      if (warn) {
        var RS = (typeof window !== 'undefined') ? window.RapportsSync : null;
        if (RS && typeof RS.pendingCount === 'function') {
          Promise.resolve(RS.pendingCount()).then(function (n) {
            n = Number(n) || 0;
            warn.textContent = n > 0 ? ('⚠ Échec synchro — ' + n + ' lot' + (n > 1 ? 's' : '') + ' en attente') : '';
          }, function () {});
        } else {
          warn.textContent = '';
        }
      }
    } catch (e) {}
    try {
      if (typeof window !== 'undefined' && typeof window.renderSyncControls === 'function') window.renderSyncControls();
    } catch (e) {}
  }

  function renderTraceKpis() {
    var el = document.getElementById('traceKpis');
    if (!el) return;
    var k = kpis();
    var rl = k.rendement.lignes || {};
    var rdA = rl.A || { nbOf: 0, moyenne: 0, vol: 0 };
    var rdB = rl.B || { nbOf: 0, moyenne: 0, vol: 0 };

    function mini(label, value, cls) {
      return '<div class="tp-mini"><span class="tp-mini-l">' + esc(label) + '</span>'
        + '<span class="tp-mini-v' + (cls ? ' ' + cls : '') + '">' + esc(value) + '</span></div>';
    }

    var flux = fluxVolumes();
    var fluxHtml = flux.map(function (r) {
      return '<div class="tp-flux-row"><span>' + esc(r.label) + '</span><b>' + esc(fmtVol(r.vol)) + ' m³</b></div>';
    }).join('');
    if (!fluxHtml) fluxHtml = '<div class="tp-empty">Aucun volume — la base est vide ou injoignable.</div>';

    var gap = Math.round((num(rdA.moyenne) - num(rdB.moyenne)) * 10) / 10;
    var hasOf = num(k.rendement.nbOf) > 0;
    var gapText = hasOf ? ((gap > 0 ? '+' : '') + String(gap).replace('.', ',') + ' pts') : '—';
    var leader = !hasOf ? 'Aucun OF évalué' : (gap > 0 ? 'Ligne A en tête' : (gap < 0 ? 'Ligne B en tête' : 'Ateliers à égalité'));

    function lineCard(letter, r, isLeader) {
      return '<div class="tp-line' + (isLeader ? ' is-leader' : '') + '">'
        + '<div class="tp-line-top"><b>Ligne ' + esc(letter) + '</b>'
        + '<span class="tp-line-pct">' + esc(r.moyenne) + ' %</span></div>'
        + '<div class="tp-line-sub">' + esc(r.nbOf) + ' OF · Vol: ' + esc(fmtVol(r.vol)) + ' m³</div>'
        + '</div>';
    }

    el.innerHTML = '<div class="tp-synth-grid">'
      + '<article class="tp-card">'
      + '<h3 class="tp-card-title">📊 Synthèse globale &amp; Matières</h3>'
      + '<div class="tp-minigrid">'
      + mini('Production OF', k.rendement.nbOf + ' OF')
      + mini('Matière première', fmtVol(k.grumes.vol) + ' m³')
      + mini('Produit (sciage)', fmtVol(k.production.vol) + ' m³')
      + mini('Pertes matière', fmtVol(k.pertes) + ' m³', 'is-rose')
      + mini('En cours / WIP', fmtVol(k.wip.vol) + ' m³')
      + mini('Stock PF', fmtVol(k.pf.vol) + ' m³')
      + '</div>'
      + '<h4 class="tp-card-sub">Volumes du flux (m³)</h4>'
      + '<div class="tp-flux">' + fluxHtml + '</div>'
      + '</article>'
      + '<article class="tp-card">'
      + '<h3 class="tp-card-title">⚖️ Ateliers (2 Lignes)</h3>'
      + '<div class="tp-lines">'
      + lineCard('A', rdA, gap > 0)
      + lineCard('B', rdB, gap < 0)
      + '</div>'
      + '<div class="tp-ecart"><span class="tp-ecart-l">Écart d\'efficacité (' + esc(leader) + ')</span>'
      + '<span class="tp-ecart-v">' + esc(gapText) + '</span></div>'
      + '</article>'
      + '</div>';
  }

  /* 4 cartes KPI « Analyse de production » (registre réel des mouvements).
     Déplacées ici depuis le KPI Dashboard. Source unique : productionStatsModule
     (brut = GRUME_ENTREE, utile = SEMI_FINI|DOSSE, chutes = CHUTE). */
  function renderTraceProduction() {
    var el = document.getElementById('traceProductionKpis');
    if (!el) return;
    var PS = (typeof window !== 'undefined') ? window.productionStatsModule : null;
    var MM = (typeof window !== 'undefined') ? window.mouvementsManager : null;
    var mvts = (MM && Array.isArray(MM.mouvements)) ? MM.mouvements : [];
    var stats = null;
    if (PS && typeof PS.queryProductionStats === 'function') {
      try { stats = PS.queryProductionStats(mvts); } catch (e) { stats = null; }
    }
    var has = !!(stats && stats.totalMouvements > 0);
    var gross = has ? Number(stats.totalGrossVolume).toFixed(3) : '0.000';
    var useful = has ? Number(stats.totalUsefulVolume).toFixed(3) : '0.000';
    var waste = has ? Number(stats.totalWasteVolume).toFixed(3) : '0.000';
    var yieldRate = has ? stats.overallYieldRate : '0.0%';
    var wasteRate = has ? stats.overallWasteRate : '0.0%';
    var yieldNum = num(String(yieldRate).replace('%', ''));
    var yieldCls = yieldNum >= 70 ? 'is-ok' : (yieldNum >= 40 ? 'is-warn' : 'is-bad');

    function card(icon, value, unit, label, sub, cls) {
      return '<div class="tp-kpi">'
        + '<div class="tp-kpi-l">' + icon + ' ' + esc(label) + '</div>'
        + '<div class="tp-kpi-v' + (cls ? ' ' + cls : '') + '">' + esc(value)
        + (unit ? ' <small>' + esc(unit) + '</small>' : '') + '</div>'
        + '<div class="tp-kpi-s">' + esc(sub) + '</div>'
        + '</div>';
    }

    el.innerHTML = '<div class="tp-kpis">'
      + card('🪵', gross, 'm³', 'Volume brut', has ? 'Grumes entrées' : 'En attente de sciage')
      + card('📦', useful, 'm³', 'Volume utile', 'Semi-finis + dosses')
      + card('📈', yieldRate, '', 'Rendement global', 'Taux de chute ' + wasteRate, yieldCls)
      + card('🗑️', waste, 'm³', 'Chutes / sciure', wasteRate + ' du brut', 'is-rose')
      + '</div>';
  }

  function traceKpiClick(id, filterCol, filterVal, badge) {
    traceSwitchTab('tb');
    if (typeof selectDataTable === 'function') selectDataTable(id);
    if (filterCol && typeof dataApplyFilter === 'function') dataApplyFilter(filterCol, filterVal);
    if (badge && typeof dataSetKpiBadge === 'function') dataSetKpiBadge(badge);
    var box = document.getElementById('dataTableContainer');
    if (box && box.classList) {
      box.classList.remove('trace-bento-updated');
      void box.offsetWidth;
      box.classList.add('trace-bento-updated');
      setTimeout(function () { box.classList.remove('trace-bento-updated'); }, 720);
    }
    if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function traceKpiClear() {
    if (typeof dataClearKpiFilter === 'function') dataClearKpiFilter();
  }

  /* Graphe « Rendement matière par OF » (conservé du KPI Dashboard, absent du
     mockup mais repris dans l'onglet Synthèse). Les volumes du flux sont
     désormais rendus dans la carte Synthèse (renderTraceKpis). */
  function renderTraceCharts() {
    var el = document.getElementById('traceCharts');
    if (!el) return;
    var ofs = rendementOfs().filter(function (r) { return num(r.rendement_pct) > 0; }).slice(0, 10);
    var k = kpis();

    function row(label, widthPct, valLabel) {
      return '<div class="tp-bar-row">'
        + '<span class="tp-bar-label">' + esc(label) + '</span>'
        + '<div class="tp-bar"><span class="tp-bar-fill" style="width:' + Math.max(2, Math.min(100, widthPct)) + '%"></span></div>'
        + '<span class="tp-bar-val">' + esc(valLabel) + '</span>'
        + '</div>';
    }

    var body;
    if (ofs.length) {
      body = '<div class="tp-chart-sub">Moyenne : <b>' + esc(k.rendement.moyenne) + ' %</b> sur ' + ofs.length + ' OF</div>'
        + ofs.map(function (r) {
          return row(r.numero + ' (' + r.essence + ')', num(r.rendement_pct), num(r.rendement_pct).toFixed(1) + ' %');
        }).join('');
    } else {
      body = '<div class="tp-empty">Aucun rendement calculé — lancez la synchronisation des sorties sciage.</div>';
    }

    el.innerHTML = '<article class="tp-card tp-chart">'
      + '<h3 class="tp-card-title">📈 Rendement matière par OF</h3>'
      + body
      + '</article>';
  }

  function renderTraceSearch() {
    var el = document.getElementById('traceSearch');
    if (!el) return;
    el.innerHTML = '<div class="data-search-box" style="max-width:520px;">'
      + '<input type="text" id="traceSearchInput" class="data-search-input" placeholder="Code grume, n° OF, n° lot, réf article, client…" oninput="traceOnSearchInput(this.value)" autocomplete="off">'
      + '</div><div id="traceSearchResults"></div>';
  }

  var searchTimer = null;
  function traceOnSearchInput(v) {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { renderTraceSearchResults(v); }, 250);
  }

  function renderTraceSearchResults(q) {
    var el = document.getElementById('traceSearchResults');
    if (!el) return;
    q = String(q || '').trim();
    if (q.length < 2) { el.innerHTML = ''; return; }
    var hits = search(q);
    if (!hits.length) {
      el.innerHTML = '<div class="data-tbl-empty">Aucun résultat pour « ' + esc(q) + ' ».</div>';
      return;
    }
    var TYPE_ICONS = { grume: '🪵', of: '📋', article: '📦', lot: '🧺', fardeau: '🚚' };
    el.innerHTML = '<div class="trace-hit-list">' + hits.map(function (h) {
      return '<button type="button" class="trace-hit" onclick="traceShowParcours(\'' + esc(h.type) + '\',' + esc(String(h.id)) + ')">'
        + '<span class="trace-hit-ico">' + (TYPE_ICONS[h.type] || '•') + '</span>'
        + '<span class="trace-hit-body"><b>' + esc(h.label) + '</b><i>' + esc(h.sub) + '</i></span>'
        + '</button>';
    }).join('') + '</div>';
  }

  function traceShowParcours(type, id) {
    var el = document.getElementById('traceParcours');
    if (!el) return;
    var p = parcours(type, id);
    var html = '<div class="trace-parcours">'
      + '<div class="trace-parcours-title">Parcours — ' + esc(p.title) + '</div>'
      + '<div class="trace-parcours-steps">';
    p.steps.forEach(function (s, i) {
      html += '<div class="trace-parcours-step">'
        + '<span class="trace-parcours-num">' + (i + 1) + '</span>'
        + '<span class="trace-parcours-label">' + esc(s.label) + '</span>'
        + '<b>' + esc(s.value) + '</b>'
        + (s.note ? '<i>' + esc(s.note) + '</i>' : '')
        + '</div>';
    });
    html += '</div>';
    if (p.articles.length) {
      html += '<div class="trace-parcours-arts"><b>Articles liés (' + p.articles.length + ')</b><div class="trace-hit-list">'
        + p.articles.slice(0, 30).map(function (a) {
          return '<div class="trace-hit trace-hit-static">'
            + '<span class="trace-hit-ico">📦</span>'
            + '<span class="trace-hit-body"><b>' + esc(a.reference) + '</b><i>' + esc(a.type) + ' · ' + esc(a.epaisseur_mm) + '×' + esc(a.largeur_mm) + '×' + esc(a.longueur_mm) + ' mm · x' + esc(a.quantite) + ' · ' + esc(a.volume_m3) + ' m³ · ' + esc(a.statut) + '</i></span>'
            + '</div>';
        }).join('')
        + (p.articles.length > 30 ? '<div class="data-tbl-empty">… et ' + (p.articles.length - 30) + ' autres (exportez la table Articles).</div>' : '')
        + '</div></div>';
    }
    html += '</div>';
    el.innerHTML = html;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function startTraceLive() {
    stopTraceLive();
    _readFailStreak = 0;
    scheduleTraceTick();
  }

  function scheduleTraceTick() {
    liveTimer = setTimeout(function () {
      liveTimer = null;
      var scr = document.getElementById('screenTrace');
      if (!scr || !scr.classList || !scr.classList.contains('active')) { stopTraceLive(); return; }
      refreshAll(false).then(function (res) {
        if (res && res.api > 0) _readFailStreak = 0; else _readFailStreak += 1;
        renderTraceStatus();
        renderTraceKpis();
        renderTraceProduction();
        renderTraceCharts();
        if (typeof renderDataChips === 'function') renderDataChips();
        if (typeof renderDataTable === 'function') renderDataTable();
        scheduleTraceTick();
      }, function () {
        _readFailStreak += 1;
        scheduleTraceTick();
      });
    }, nextPollDelay(_readFailStreak));
  }

  function stopTraceLive() {
    if (liveTimer) { clearTimeout(liveTimer); liveTimer = null; }
  }

  /* ==========================================================================
     ONGLETS — Synthèse & Ateliers / Tables de données / Périodes & Rapports.
     Restauration de l'onglet actif mémorisée (comme les onglets Ligne A/B).
     ========================================================================== */
  var TRACE_TAB_KEY = 'charben_trace_tab';
  var TRACE_TABS = ['ov', 'tb', 'rp'];

  function traceSwitchTab(tab) {
    if (TRACE_TABS.indexOf(tab) < 0) tab = 'ov';
    TRACE_TABS.forEach(function (id) {
      var on = (id === tab);
      var btn = document.getElementById('traceTabBtn-' + id);
      var panel = document.getElementById('tracePanel-' + id);
      if (btn) {
        if (btn.classList) btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      }
      if (panel) {
        if (panel.classList) panel.classList.toggle('is-active', on);
        if (on) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
      }
    });
    try { localStorage.setItem(TRACE_TAB_KEY, tab); } catch (e) {}
  }

  function restoreTraceTab() {
    var t = 'ov';
    try { t = localStorage.getItem(TRACE_TAB_KEY) || 'ov'; } catch (e) {}
    traceSwitchTab(t);
  }

  function renderTraceScreen() {
    renderTraceStatus();
    renderTraceKpis();
    renderTraceProduction();
    renderTraceCharts();
    renderTraceSearch();
    restoreTraceTab();
    if (typeof renderDataScreen === 'function') renderDataScreen();
    refreshAll(false).then(function () {
      renderTraceStatus();
      renderTraceKpis();
      renderTraceProduction();
      renderTraceCharts();
      if (typeof renderDataScreen === 'function') renderDataScreen();
    });
    startTraceLive();
  }

  var api = {
    load: load, ensure: ensure, refreshAll: refreshAll,
    rows: rows, meta: meta, kpis: kpis,
    fluxVolumes: fluxVolumes, rendementOfs: rendementOfs,
    search: search, parcours: parcours,
    renderTraceScreen: renderTraceScreen,
    renderTraceKpis: renderTraceKpis, renderTraceProduction: renderTraceProduction, renderTraceCharts: renderTraceCharts, renderTraceStatus: renderTraceStatus,
    traceKpiClick: traceKpiClick,
    traceKpiClear: traceKpiClear,
    traceSwitchTab: traceSwitchTab, restoreTraceTab: restoreTraceTab,
    startTraceLive: startTraceLive, stopTraceLive: stopTraceLive,
    nextPollDelay: nextPollDelay, READ_BACKOFF_MS: READ_BACKOFF_MS,
    STATUT_LABELS: STATUT_LABELS, ENDPOINTS: ENDPOINTS
  };
  g.TraceAPI = api;
  if (typeof window !== 'undefined') window.TraceAPI = api;
  g.traceOnSearchInput = traceOnSearchInput;
  g.traceShowParcours = traceShowParcours;
  g.traceKpiClick = traceKpiClick;
  g.traceKpiClear = traceKpiClear;
  g.traceSwitchTab = traceSwitchTab;
  g.renderTraceScreen = renderTraceScreen;
  g.renderTraceKpis = renderTraceKpis;
  g.renderTraceProduction = renderTraceProduction;
  g.renderTraceCharts = renderTraceCharts;
  g.renderTraceStatus = renderTraceStatus;
  if (typeof window !== 'undefined') {
    window.traceOnSearchInput = traceOnSearchInput;
    window.traceShowParcours = traceShowParcours;
    window.traceKpiClick = traceKpiClick;
    window.traceKpiClear = traceKpiClear;
    window.traceSwitchTab = traceSwitchTab;
    window.renderTraceScreen = renderTraceScreen;
    window.renderTraceKpis = renderTraceKpis;
    window.renderTraceProduction = renderTraceProduction;
    window.renderTraceCharts = renderTraceCharts;
    window.renderTraceStatus = renderTraceStatus;
  }
})();
