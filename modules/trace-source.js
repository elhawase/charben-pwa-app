/**
 * TRACE-SOURCE.JS — Source de données LOCALE de l'écran Traçabilité.
 * Scierie Charben — remplace l'ancienne lecture API (MySQL 3002) par un
 * calcul client sur les tableaux locaux synchronisés Firestore (data-v7.js).
 *
 * Expose en globalThis.TraceSource :
 *   TraceSource.raw(id) -> tableau de lignes BRUTES (pré-normalisation),
 *   au format attendu par les normaliseurs de trace-api.js.
 *
 * ids : grumes, articles, wip, lots, fardeaux, of, rendement, stock,
 *       coherence, audit, traces.
 *
 * Aucune I/O réseau. ES5 (var, pas de arrow) pour compat WebView Android.
 */
(function () {
  'use strict';
  var g = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : {});
  if (typeof window === 'undefined' && typeof g.window === 'undefined') g.window = g;

  function arr(name) {
    try {
      var v = g[name];
      if (Array.isArray(v)) return v;
      if (typeof window !== 'undefined' && Array.isArray(window[name])) return window[name];
    } catch (e) {}
    return [];
  }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function m3(v) { return Math.round(num(v) * 10000) / 10000; }

  var STATUT_LABELS = {
    EN_STOCK: 'En stock', EN_WIP: 'En WIP', EN_COURSE: 'En cours',
    CONSOMME: 'Consommé', CONFORME: 'Conforme', NON_CONFORME: 'Non conforme'
  };
  function libelle(code) { return STATUT_LABELS[code] || (code ? String(code) : '—'); }

  function essCode(v) {
    var s = String(v == null ? '' : v).toUpperCase();
    if (!s) return '';
    if (s.indexOf('PIN') >= 0) return 'PIN';
    if (s.indexOf('EPICEA') >= 0 || s.indexOf('\u00c9PIC\u00c9A') >= 0 || s.indexOf('SAPIN') >= 0 || s.indexOf('SPRUCE') >= 0) return 'EPICEA';
    if (s.indexOf('CHENE') >= 0 || s.indexOf('CH\u00caNE') >= 0 || s.indexOf('OAK') >= 0) return 'CHENE';
    if (s.indexOf('CEDAR') >= 0 || s.indexOf('C\u00c8DRE') >= 0 || s.indexOf('CEDRE') >= 0) return 'CEDAR';
    if (s.indexOf('EUCALYPTUS') >= 0 || s.indexOf('EUCALYP') >= 0) return 'EUCALYPTUS';
    if (s.indexOf('PEUPLIER') >= 0 || s.indexOf('PEUPLI') >= 0 || s.indexOf('POPLAR') >= 0) return 'POPLAR';
    return s;
  }
  function statutGrume(s) {
    var u = String(s == null ? '' : s).toUpperCase();
    if (u.indexOf('CONSOMM') >= 0) return 'CONSOMME';
    if (u.indexOf('COURSE') >= 0) return 'EN_COURSE';
    return 'EN_STOCK';
  }
  function statutOf(s) {
    var u = String(s == null ? '' : s).toLowerCase();
    if (u.indexOf('non_conforme') >= 0 || u.indexOf('non conforme') >= 0) return 'NON_CONFORME';
    if (u === 'realise' || u.indexOf('r\u00e9alis') >= 0 || u === 'conforme' || u === 'termine' || u.indexOf('termin\u00e9') >= 0) return 'CONFORME';
    return 'EN_COURS';
  }
  function statutFardeau(s) {
    var u = String(s == null ? '' : s).toUpperCase();
    if (u === 'VENDU') return 'VENDU';
    if (u.indexOf('SUPPRIM') >= 0) return 'SUPPRIME';
    return 'EN_STOCK';
  }

  function grumesSrc() { var m = arr('mp'); return m.length ? m : arr('rawMaterials'); }
  function ofSrc() { var o = arr('ofOrders'); return o.length ? o : arr('orders'); }
  function wipSrc() { var w = arr('wip'); return w.length ? w : arr('wipProducts'); }
  function pfSrc() { var p = arr('pf'); return p.length ? p : arr('finishedGoods'); }

  function ofIdByNum() {
    var map = {};
    ofSrc().forEach(function (o) {
      var key = String(o.orderNum != null ? o.orderNum : (o.id != null ? o.id : ''));
      if (!key) return;
      map[key] = o.id != null ? o.id : o.orderNum;
    });
    return map;
  }
  function grumeIdByCode() {
    var map = {};
    grumesSrc().forEach(function (r) {
      var code = String(r.code != null ? r.code : '');
      if (!code) return;
      map[code] = r.id != null ? r.id : r.code;
    });
    return map;
  }

  function rawGrumes() {
    return grumesSrc().map(function (r) {
      return {
        grume_id: r.id != null ? r.id : r.code,
        code: r.code,
        scan_code: r.scanCode || r.scan_code || r.code,
        essence: r.essence || '',
        essence_code: r.essenceCode || essCode(r.essence),
        diametre_cm: num(r.diametre != null ? r.diametre : r.diametre_cm),
        longueur_m: num(r.longueur != null ? r.longueur : r.longueur_m),
        volume_m3: m3(r.volume != null ? r.volume : r.volume_m3),
        statut_code: statutGrume(r.statut),
        cree_le: r.createdAt || r.cree_le || ''
      };
    });
  }

  function lotIdFor(p) {
    var ofn = p.ofNum != null ? p.ofNum : (p.orderNum != null ? p.orderNum : '');
    return 'LOT-' + String(ofn) + '-' + essCode(p.essence);
  }
  function mapArticle(a, statutCode, isPf, ofById, grumeById) {
    var ofNum = a.ofNum != null ? a.ofNum : (a.orderNum != null ? a.orderNum : null);
    var grumeCode = a.grumeCode || a.grume_code || null;
    var ref = a.ref != null ? a.ref : (a.code != null ? a.code : a.reference);
    return {
      article_id: a.id != null ? a.id : ref,
      reference: ref,
      scan_code: a.scanCode || a.scan_code || ref,
      type: a.type || '—',
      essence: a.essence || '',
      essence_code: a.essenceCode || essCode(a.essence),
      epaisseur_mm: num(a.epaisseur),
      largeur_mm: num(a.largeur),
      longueur_mm: num(a.longueur),
      quantite: num(a.qte != null ? a.qte : a.quantite),
      volume_m3: m3(a.volume != null ? a.volume : a.volume_m3),
      statut_code: statutCode,
      grume_id: grumeCode != null ? (grumeById[grumeCode] != null ? grumeById[grumeCode] : null) : null,
      grume_code: grumeCode,
      ordre_fabrication_id: ofNum != null ? (ofById[String(ofNum)] != null ? ofById[String(ofNum)] : null) : null,
      of_numero: ofNum != null ? String(ofNum) : '—',
      lot_sechage_id: isPf ? null : lotIdFor(a),
      lot_numero: isPf ? '—' : lotIdFor(a),
      sf_source_id: a.sfRef || a.sf_source || null,
      cree_le: a.createdAt || a.cree_le || ''
    };
  }

  function rawWipArticles() {
    var ofById = ofIdByNum(), grumeById = grumeIdByCode();
    return wipSrc().map(function (p) {
      var st = String(p.statut == null ? '' : p.statut).toUpperCase();
      var code = st.indexOf('TRANSFERE') >= 0 || st.indexOf('TRANSF\u00c9R') >= 0 ? 'TRANSFERE' : 'EN_WIP';
      return mapArticle(p, code, false, ofById, grumeById);
    });
  }
  function rawFinishedArticles() {
    var ofById = ofIdByNum(), grumeById = grumeIdByCode();
    return pfSrc().map(function (p) {
      return mapArticle(p, 'EN_STOCK', true, ofById, grumeById);
    });
  }
  function rawArticles() { return rawWipArticles().concat(rawFinishedArticles()); }

  function rawLots() {
    var groups = {}, order = [];
    wipSrc().forEach(function (p) {
      var st = String(p.statut == null ? '' : p.statut).toUpperCase();
      if (st.indexOf('TRANSFERE') >= 0 || st.indexOf('TRANSF\u00c9R') >= 0) return;
      var id = lotIdFor(p);
      if (!groups[id]) {
        groups[id] = { lot_sechage_id: id, numero: id, essence: p.essence || '', essence_code: essCode(p.essence), statut_code: 'EN_WIP', date_debut: p.createdAt || '', date_fin: '', ordre_fabrication_id: null, of_numero: (p.ofNum != null ? String(p.ofNum) : '—') };
        order.push(id);
      }
    });
    var ofById = ofIdByNum();
    return order.map(function (id) {
      var lot = groups[id];
      var ofNum = null;
      wipSrc().forEach(function (p) { if (lotIdFor(p) === id && ofNum == null && p.ofNum != null) ofNum = p.ofNum; });
      lot.ordre_fabrication_id = ofNum != null ? (ofById[String(ofNum)] != null ? ofById[String(ofNum)] : null) : null;
      return lot;
    });
  }

  function rawFardeaux() {
    return arr('fardeaux').map(function (f) {
      var items = Array.isArray(f.items) ? f.items : [];
      return {
        fardeau_id: f.id != null ? f.id : f.code,
        code: f.code,
        statut_code: statutFardeau(f.statut),
        essence: f.essence || '',
        lot_numero: f.batchNum != null ? f.batchNum : (f.batchId != null ? f.batchId : '—'),
        client_nom: f.client || '—',
        bl_numero: f.bl || '—',
        nb_references: items.length,
        nb_pieces: num(f.nbPieces != null ? f.nbPieces : f.pieces),
        volume_m3: m3(f.volumeTotal != null ? f.volumeTotal : f.volume),
        date_sortie_sechage: f.sortieSechageAt || '',
        date_vente: f.venduAt || ''
      };
    });
  }

  function rawOf() {
    var wip = rawWipArticles(), pf = rawFinishedArticles();
    var pieces = wip.concat(pf);
    return ofSrc().map(function (o) {
      var ofNum = String(o.orderNum != null ? o.orderNum : (o.id != null ? o.id : ''));
      var mine = pieces.filter(function (a) { return String(a.of_numero) === ofNum; });
      var volProd = 0, volDosses = 0, nbDosses = 0, nbPieces = 0;
      mine.forEach(function (a) {
        nbPieces += num(a.quantite) || 1;
        if (a.type && String(a.type).toUpperCase().indexOf('DOSSE') >= 0) { volDosses += num(a.volume_m3); nbDosses += 1; }
        else volProd += num(a.volume_m3);
      });
      var grumesVol = num(o.totalConsumed);
      var rendement = grumesVol > 0 ? Math.round((volProd / grumesVol) * 1000) / 10 : 0;
      var recup = grumesVol > 0 ? Math.round(((volProd + volDosses) / grumesVol) * 1000) / 10 : 0;
      var couverture;
      if (grumesVol > 0 && mine.length > 0) couverture = 'OK';
      else if (grumesVol > 0) couverture = 'GRUMES_SANS_PIECES';
      else if (mine.length > 0) couverture = 'PIECES_SANS_GRUME';
      else couverture = 'AUCUNE_DONNEE';
      return {
        of_id: o.id != null ? o.id : o.orderNum,
        numero: o.orderNum != null ? String(o.orderNum) : (o.id != null ? String(o.id) : '—'),
        statut_code: statutOf(o.status),
        poste: o.assigned_poste || o.machine || '—',
        ligne: o.line || '—',
        essence: o.essence || '',
        essence_code: essCode(o.essence),
        nb_grumes: num(o.grumesCount != null ? o.grumesCount : (o.nbGrumes != null ? o.nbGrumes : 0)),
        volume_grumes_m3: m3(grumesVol),
        nb_pieces: nbPieces,
        volume_produit_m3: m3(volProd),
        rendement_pct: rendement,
        rendement_recup_pct: recup,
        nb_dosses: nbDosses,
        volume_dosses_m3: m3(volDosses),
        couverture: couverture
      };
    });
  }

  function rawStock() {
    var out = [];
    function push(nature, list) {
      var agg = {};
      list.forEach(function (r) {
        var st = r.statut_code || '';
        if (!agg[st]) agg[st] = { nature: nature, statut_code: st, libelle: libelle(st), nb_lignes: 0, volume_m3: 0 };
        agg[st].nb_lignes += 1;
        agg[st].volume_m3 += num(r.volume_m3);
      });
      Object.keys(agg).forEach(function (k) {
        var a = agg[k];
        a.volume_m3 = m3(a.volume_m3);
        out.push(a);
      });
    }
    push('grume', rawGrumes());
    push('article', rawArticles());
    return out;
  }

  function rawCoherence() {
    var wip = rawWipArticles(), pf = rawFinishedArticles();
    var sfByRef = {}, order = [];
    wip.forEach(function (p) {
      var ref = String(p.reference);
      if (!sfByRef[ref]) { sfByRef[ref] = { reference_sf: ref, qte_semi_finis: 0, qte_produits_finis: 0, ecart: 0, controle: '—' }; order.push(ref); }
      sfByRef[ref].qte_semi_finis += num(p.quantite);
    });
    pf.forEach(function (f) {
      var ref = String(f.sf_source_id || '');
      if (!ref) return;
      if (!sfByRef[ref]) { sfByRef[ref] = { reference_sf: ref, qte_semi_finis: 0, qte_produits_finis: 0, ecart: 0, controle: '—' }; order.push(ref); }
      sfByRef[ref].qte_produits_finis += num(f.quantite);
    });
    return order.map(function (ref) {
      var r = sfByRef[ref];
      r.ecart = r.qte_produits_finis - r.qte_semi_finis;
      r.controle = r.ecart === 0 ? 'OK' : 'ECART';
      return r;
    });
  }

  function rawAudit() {
    return arr('auditLogs').slice(0, 50).map(function (a) {
      return { horodatage: a.time || a.ts || a.horodatage || '', action: a.action || '', utilisateur: a.user || a.utilisateur || '—' };
    });
  }

  function rawTraces() {
    var out = [];
    function collect(list, origem) {
      list.forEach(function (it) {
        var tr = it && it.trace;
        if (!tr || !Array.isArray(tr.history)) return;
        tr.history.forEach(function (h) {
          out.push({ execute_le: h.ts || h.execute_le || '', action: h.action || '', execute_par: h.by || h.execute_par || '—', details: h.details != null ? h.details : (origem + ' ' + (it.code || it.ref || it.id || '')) });
        });
      });
    }
    collect(grumesSrc(), 'Grume');
    collect(ofSrc(), 'OF');
    collect(wipSrc(), 'WIP');
    collect(pfSrc(), 'PF');
    collect(arr('fardeaux'), 'Fardeau');
    out.sort(function (a, b) { return String(b.execute_le).localeCompare(String(a.execute_le)); });
    return out.slice(0, 50);
  }

  var BUILDERS = {
    grumes: rawGrumes, articles: rawArticles, wip: rawWipArticles, lots: rawLots,
    fardeaux: rawFardeaux, of: rawOf, rendement: rawOf, stock: rawStock,
    coherence: rawCoherence, audit: rawAudit, traces: rawTraces
  };

  function raw(id) {
    var fn = BUILDERS[id];
    if (!fn) return [];
    try { var r = fn(); return Array.isArray(r) ? r : []; } catch (e) { return []; }
  }

  var api = { raw: raw, ids: Object.keys(BUILDERS) };
  g.TraceSource = api;
  if (typeof window !== 'undefined') window.TraceSource = api;
})();
