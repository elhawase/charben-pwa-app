/**
 * RAPPORTS.JS — Modèle de rapports (LOCAL)
 * Scierie Charben — fonctions pures de reporting + API locale no-op.
 * Conservé après fusion RAPPORTS → TRAÇABILITÉ :
 *  - modèle pur testable (RapportsModel) ;
 *  - RapportsAPI réduit à une coquille locale (plus aucun appel réseau).
 * L'ancien write path (POST /sync/articles puis /sync/lots vers l'API 3002)
 * a été retiré : les sorties de sciage sont désormais écrites localement puis
 * synchronisées vers Firestore via realtime-sync.js.
 * Le rendu de l'écran Rapports a été supprimé — les données sont consultées
 * via l'écran Traçabilité (trace-api.js + modules/trace-source.js + data-tables.js).
 * Hors-ligne safe, jamais de crash.
 */

'use strict';

// ============================================================================
// CONFIGURATION
// ============================================================================

const RAPPORTS_COUVERTURE_LABELS = {
  OK: 'Calcul\u00e9',
  PIECES_SANS_GRUME: 'Pi\u00e8ces sans grume',
  GRUMES_SANS_PIECES: 'Grumes sans pi\u00e8ces',
  AUCUNE_DONNEE: 'Aucune donn\u00e9e',
  AUTRE: 'Autre'
};

// ============================================================================
// API — coquille locale (plus aucun appel réseau)
// ============================================================================

function rpLocalResult(query) {
  void query;
  return Promise.resolve({ ok: true, items: [] });
}

var RapportsAPI = {
  fetchJSON: function() { return rpLocalResult(); },
  getStock: function(query) { return rpLocalResult(query); },
  getRendement: function(query) { return rpLocalResult(query); },
  getGrumes: function(query) { return rpLocalResult(query); },
  getFardeaux: function(query) { return rpLocalResult(query); },
  getCoherence: function(query) { return rpLocalResult(query); },
  getAudit: function(query) { return rpLocalResult(query); },
  getTraces: function(query) { return rpLocalResult(query); },
  getLots: function(query) { return rpLocalResult(query); },
  getArticles: function(query) { return rpLocalResult(query); },
  /* No-ops : les écritures sont locales + Firestore (realtime-sync.js). */
  syncLots: function() { return Promise.resolve({ ok: true, lots_crees: 0, lots_existants: 0, articles_liees: 0 }); },
  syncArticles: function() { return Promise.resolve({ ok: true, articles_crees: 0, articles_existants: 0 }); }
};

// ============================================================================
// MODELE — fonctions pures (testables sans DOM)
// ============================================================================

function rpFmtM3(n) {
  if (n == null || isNaN(Number(n)) || !isFinite(Number(n))) return '\u2014';
  return Number(n).toFixed(3);
}

function rpFmtPct(n) {
  if (n == null || isNaN(Number(n)) || !isFinite(Number(n))) return '\u2014';
  return Number(n).toFixed(1) + ' %';
}

function rpNum(n) {
  if (n == null || isNaN(Number(n)) || !isFinite(Number(n))) return 0;
  return Number(n);
}

function rpCouvertureLabel(c) {
  return RAPPORTS_COUVERTURE_LABELS[c] || String(c == null ? 'AUTRE' : c);
}

function rpStockBuckets(items) {
  var arr = Array.isArray(items) ? items : [];
  return arr.map(function(it) {
    return {
      nature: it.nature == null ? '' : String(it.nature),
      statut_code: it.statut_code == null ? '' : String(it.statut_code),
      libelle: it.libelle == null ? '' : String(it.libelle),
      nb_lignes: rpNum(it.nb_lignes),
      volume_m3: rpNum(it.volume_m3)
    };
  }).sort(function(a, b) {
    return (a.nature < b.nature ? -1 : a.nature > b.nature ? 1
      : a.statut_code < b.statut_code ? -1 : a.statut_code > b.statut_code ? 1 : 0);
  });
}

function rpGrumesParStatut(items) {
  var arr = Array.isArray(items) ? items : [];
  var map = {};
  arr.forEach(function(g) {
    if (!g || !g.statut_code) return;
    var st = String(g.statut_code);
    if (!map[st]) map[st] = { statut_code: st, nb: 0, volume_m3: 0 };
    map[st].nb++;
    map[st].volume_m3 += rpNum(g.volume_m3);
  });
  return Object.keys(map).map(function(k) {
    return { statut_code: k, nb: map[k].nb, volume_m3: Math.round(map[k].volume_m3 * 1000) / 1000 };
  }).sort(function(a, b) { return a.statut_code < b.statut_code ? -1 : a.statut_code > b.statut_code ? 1 : 0; });
}

function rpRendementSummary(rows) {
  var arr = Array.isArray(rows) ? rows : [];
  var parCouverture = {
    OK: 0, PIECES_SANS_GRUME: 0, GRUMES_SANS_PIECES: 0, AUCUNE_DONNEE: 0, AUTRE: 0
  };
  var computable = [];
  var somme = 0;
  arr.forEach(function(r) {
    if (!r) return;
    var c = r.couverture || 'AUTRE';
    if (parCouverture[c] == null) c = 'AUTRE';
    parCouverture[c]++;
    if (c === 'OK' && r.rendement_pct != null && isFinite(Number(r.rendement_pct))) {
      computable.push(r);
      somme += Number(r.rendement_pct);
    }
  });
  return {
    total: arr.length,
    parCouverture: parCouverture,
    computable: computable,
    moyRendement: computable.length ? Math.round((somme / computable.length) * 10) / 10 : null
  };
}

function rpLotsSummary(items) {
  var arr = Array.isArray(items) ? items : [];
  var map = {};
  var total = 0;
  arr.forEach(function(l) {
    if (!l) return;
    total++;
    var st = (l.statut_code == null || l.statut_code === '') ? 'SANS_STATUT' : String(l.statut_code);
    if (!map[st]) map[st] = { statut_code: st, nb: 0 };
    map[st].nb++;
  });
  return {
    total: total,
    parStatut: Object.keys(map).map(function(k) { return map[k]; })
      .sort(function(a, b) { return a.statut_code < b.statut_code ? -1 : a.statut_code > b.statut_code ? 1 : 0; })
  };
}

function rpArticlesSummary(items) {
  var arr = Array.isArray(items) ? items : [];
  var nbRefs = 0, nbPieces = 0, volumeM3 = 0;
  var types = {}, stats = {};
  function bucket(map, key, pieces, vol) {
    if (!map[key]) map[key] = { cle: key, nbRefs: 0, nbPieces: 0, volume_m3: 0 };
    map[key].nbRefs++;
    map[key].nbPieces += pieces;
    map[key].volume_m3 += vol;
  }
  arr.forEach(function(a) {
    if (!a) return;
    nbRefs++;
    var pieces = rpNum(a.quantite);
    var vol = rpNum(a.volume_m3);
    nbPieces += pieces;
    volumeM3 += vol;
    var t = (a.type == null || a.type === '') ? 'SANS_TYPE' : String(a.type);
    var s = (a.statut_code == null || a.statut_code === '') ? 'SANS_STATUT' : String(a.statut_code);
    bucket(types, t, pieces, vol);
    bucket(stats, s, pieces, vol);
  });
  var parType = Object.keys(types).map(function(k) { return types[k]; }).map(function(t) {
    return { type: t.cle, nbRefs: t.nbRefs, nbPieces: t.nbPieces, volume_m3: Math.round(t.volume_m3 * 1000) / 1000 };
  }).sort(function(a, b) {
    if (b.volume_m3 !== a.volume_m3) return b.volume_m3 - a.volume_m3;
    return a.type < b.type ? -1 : a.type > b.type ? 1 : 0;
  });
  var parStatut = Object.keys(stats).map(function(k) {
    var s = stats[k];
    return { statut_code: s.cle, nbRefs: s.nbRefs, nbPieces: s.nbPieces, volume_m3: Math.round(s.volume_m3 * 1000) / 1000 };
  }).sort(function(a, b) { return a.statut_code < b.statut_code ? -1 : a.statut_code > b.statut_code ? 1 : 0; });
  return {
    nbRefs: nbRefs,
    nbPieces: nbPieces,
    volumeM3: Math.round(volumeM3 * 1000) / 1000,
    parType: parType,
    parStatut: parStatut
  };
}

/* ── Payload des sorties de sciage (wipProducts → article).
       Filtre les entrées sans référence, sans essence ou dimensions ≤ 0. ── */
function rpSyncArticlesItems(wipList) {
  var arr = Array.isArray(wipList) ? wipList : [];
  var out = [];
  arr.forEach(function(p) {
    if (!p || typeof p.ref !== 'string' || !p.ref) return;
    if (p.essence == null || String(p.essence).trim() === '') return;
    var ep = Number(p.epaisseur), larg = Number(p.largeur), lng = Number(p.longueur);
    if (!(ep > 0) || !(larg > 0) || !(lng > 0)) return;
    out.push({
      reference: p.ref,
      type: (p.type == null ? '' : String(p.type)).slice(0, 40) || null,
      essence_code: String(p.essence),
      epaisseur_mm: ep, largeur_mm: larg, longueur_mm: lng,
      quantite: (Number(p.qte) >= 1) ? Math.floor(Number(p.qte)) : 1,
      statut_code: p.statut === 'TRANSFERE' ? 'TRANSFERE' : 'EN_WIP',
      dosse: !!p.isDosse,
      of_numero: p.ofNum ? String(p.ofNum) : null,
      grume_code: p.grumeCode ? String(p.grumeCode) : null
    });
  });
  return out;
}

var rpPostesOf = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];

function rpNumb(n) { n = Number(n); return isFinite(n) ? n : 0; }

function rpSyncGrumes(list) {
  var out = [], seen = {};
  (Array.isArray(list) ? list : []).forEach(function(g) {
    if (!g) return;
    var code = String(g.code || '').trim().slice(0, 20);
    if (!code || seen[code]) return;
    var scan = String(g.scanCode || '').trim().slice(0, 20);
    var dia = rpNumb(g.diametre), lng = rpNumb(g.longueur);
    if (!scan || !(dia > 0) || dia > 56 || !(lng > 0) || lng > 9999) return;
    seen[code] = 1;
    out.push({
      code: code,
      scan_code: scan,
      essence_code: String(g.essenceCode || g.essence || '').trim(),
      diametre_cm: dia,
      longueur_m: lng,
      statut_code: String(g.statut || 'EN_STOCK')
    });
  });
  return out;
}

function rpSyncOfs(list) {
  var out = [], seen = {};
  (Array.isArray(list) ? list : []).forEach(function(o) {
    if (!o) return;
    var numero = String(o.orderNum || '').trim().slice(0, 16);
    if (!numero || seen[numero]) return;
    var lw = rpNumb(o.logWidth);
    if (!(lw > 0) || lw > 560) return;
    var poste = String(o.assigned_poste || o.machine || (String(o.line || '').charAt(0).toUpperCase() + '1'))
      .trim().slice(0, 2).toUpperCase();
    if (rpPostesOf.indexOf(poste) === -1) return;
    var nbPieces = Math.max(0, Math.floor(rpNumb(o.pieceCount)));
    var nbLames = Math.floor(rpNumb(o.diskCount));
    if (!(nbLames > 0) || nbLames > 17) nbLames = Math.min(17, 2 * nbPieces + 1);
    seen[numero] = 1;
    out.push({
      numero: numero,
      poste: poste,
      essence_code: String(o.essence || '').trim(),
      log_width_mm: lw,
      quantite_planifiee: (rpNumb(o.qty) >= 1) ? Math.floor(rpNumb(o.qty)) : 1,
      statut_code: String(o.status || 'engage'),
      nb_pieces: nbPieces,
      nb_lames: nbLames,
      consommation_mm: rpNumb(o.totalConsumed),
      chute_mm: rpNumb(o.chute)
    });
  });
  return out;
}

function rpSyncReferentials(wip, grumesList, ordersList) {
  var usedG = {}, usedO = {};
  (Array.isArray(wip) ? wip : []).forEach(function(p) {
    if (p && p.grumeCode) usedG[String(p.grumeCode).trim()] = 1;
    if (p && p.ofNum) usedO[String(p.ofNum).trim()] = 1;
  });
  var grumes = rpSyncGrumes(grumesList).filter(function(g) { return !!usedG[g.code]; });
  var ofs = rpSyncOfs(ordersList).filter(function(o) { return !!usedO[o.numero]; });
  grumes.sort(function(a, b) { return a.code < b.code ? -1 : a.code > b.code ? 1 : 0; });
  ofs.sort(function(a, b) { return a.numero < b.numero ? -1 : a.numero > b.numero ? 1 : 0; });
  return { grumes: grumes, ofs: ofs };
}

var RapportsModel = {
  fmtM3: rpFmtM3,
  fmtPct: rpFmtPct,
  couvertureLabel: rpCouvertureLabel,
  stockBuckets: rpStockBuckets,
  grumesParStatut: rpGrumesParStatut,
  rendementSummary: rpRendementSummary,
  lotsSummary: rpLotsSummary,
  articlesSummary: rpArticlesSummary,
  syncArticlesItems: rpSyncArticlesItems,
  syncGrumes: rpSyncGrumes,
  syncOfs: rpSyncOfs,
  syncReferentials: rpSyncReferentials
};

// ============================================================================
// STATUT — cible l'écran Traçabilité (#traceSyncStatus), repli sur showToast
// ============================================================================

function rpSetStatus(text, isError) {
  var el = null;
  try { el = document.getElementById('traceSyncStatus'); } catch (e) {}
  if (el) {
    el.textContent = text || '';
    el.className = 'rp-status' + (isError ? ' rp-status-error' : ' rp-status-ok');
    return;
  }
  if (typeof showToast === 'function' && text) showToast(text, isError ? 'error' : 'success');
}

// ============================================================================
// SYNCHRONISATION — locale uniquement (plus de write path réseau)
// Les sorties de sciage sont déjà écrites dans les tableaux locaux et
// synchronisées vers Firestore via realtime-sync.js. Ces fonctions restent
// exposées pour compatibilité d'interface (boutons/UI) et déclenchent
// simplement un re-rendu.
// ============================================================================

function renderSyncControls() {
  var btn = null, help = null;
  try { btn = document.getElementById('syncRetryBtn'); } catch (e) {}
  try { help = document.getElementById('syncHelp'); } catch (e) {}
  if (btn) btn.style.display = 'none';
  if (help) { help.textContent = ''; help.style.display = 'none'; }
}

function syncRetryNow() {
  return syncLotsRapports({ manual: true });
}

function syncLotsRapports(opts) {
  void opts;
  rpSetStatus('Donn\u00e9es locales \u00e0 jour.', false);
  if (typeof dataRefreshFromApi === 'function') {
    try { return Promise.resolve(dataRefreshFromApi()); } catch (e) { return Promise.resolve(); }
  }
  return Promise.resolve();
}

// ============================================================================
// API PUBLIQUE
// ============================================================================

window.RapportsAPI = RapportsAPI;
window.RapportsModel = RapportsModel;
window.syncLotsRapports = syncLotsRapports;
window.syncRetryNow = syncRetryNow;
window.renderSyncControls = renderSyncControls;
window.RapportsSync = {
  retryNow: syncRetryNow,
  pendingCount: function() { return Promise.resolve(0); },
  attempts: function() { return 0; },
  reset: function() {}
};
