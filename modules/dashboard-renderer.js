/**
 * DASHBOARD-RENDERER.JS — Tableau de bord (KPIs, alertes, tâches).
 * Api la stratégie sûre : ce module délègue aux fonctions originales
 * de app.js (copies EXACTES ou passthrough). Aucune divergence possible.
 * Étape suivante : migrer le code réel dans ce module une fois les
 * helpers (kdTaskFilter, renderUpcomingTasks...) également migrés.
 * Globals: rawMaterials, orders, equipment, wipProducts, finishedGoods,
 *          planningTasks, disques, qualityChecks, getAppPref,
 *          renderUpcomingTasks, kdSetTaskFilter, kdTaskFilter,
 *          escapeHtml, updateAlertBadge, renderLucide, showToast,
 *          disqueStockRestant, predictGrumesConsumption, calcVolumeGrume
 */
'use strict';

/* ─────────────────────────────────────────────
   renderDashboardKPIs — tableau de bord complet
   PASSTHROUGH vers app.js (fonction originale de 506 lignes)
   ───────────────────────────────────────────── */

// Exact copy from app.js
window._dashboardRenderer_renderDashboardKPIs = function() {
  var el = document.getElementById('dashboardKPIs');
  if (!el) return;

  var today = new Date();
  /* Clé "jour" en heure LOCALE — l'ISO UTC (toISOString) décalait le jour en soirée */
  function dayKeyLocal(d) {
    var x = (d instanceof Date) ? d : new Date(d);
    if (!x || isNaN(x.getTime())) return '';
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }
  var todayKey = dayKeyLocal(today);
  var weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  var monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  var ofLine = window._dashboardRenderer_ofLine || function(o) { return String((o && o.line) || 'A').charAt(0).toUpperCase() || 'A'; };
  var lineOrderFor = window._dashboardRenderer_lineOrderFor || function(line) { return getLineOrder(line); };

  /* ── Stock MP ── */
  /* CONFIG RÉCEPTION GRUMES (scierie Charben) — à ajuster ici si besoin.
     Longueurs usuelles 3 m à 7 m (en pratique 4 m ou 5 m).
     Diamètre max accepté sur le parc : 560 mm. Au-delà → grume refusée. */
  var GRUME_LEN_MIN_M = 3;
  var GRUME_LEN_MAX_M = 7;
  var GRUME_DIAM_MAX_MM = 560;
  /* ── Helper: calcul volume grume (diametre cm, longueur m ou mm) ── */
  function grumeVolume(g) {
    var dcm = parseFloat(g.diametre) || 0;
    var l = parseFloat(g.longueur) || 0;
    if (l > 100) l = l / 1000;
    /* Garde-fou réception — mesures hors tolérance = données invalides, grume refusée (volume 0) */
    if (l < GRUME_LEN_MIN_M || l > GRUME_LEN_MAX_M) return 0;
    if (dcm <= 0 || dcm * 10 > GRUME_DIAM_MAX_MM) return 0;
    /* Moteur volumétrique canonique (cylindre petit-bout) — modules/sciage-logic.js */
    return calcVolumeGrume(dcm, l);
  }

  /* ── Stock MP par essence (zone 1 du panneau) ── */
  var mpStockArr = rawMaterials.filter(function(r) { return r.statut === 'EN_STOCK'; });
  var mpVol = mpStockArr.reduce(function(s, r) { return s + grumeVolume(r); }, 0);
  var mpAvgDiam = mpStockArr.length ? Math.round(mpStockArr.reduce(function(s, r) { return s + (parseFloat(r.diametre) || 0); }, 0) / mpStockArr.length) : 0;
  var consumedWeek = rawMaterials.filter(function(r) {
    if (r.statut === 'CONSOMME' && r.consumedAt && r.consumedAt >= weekAgo) return true;
    if (r.statut === 'EN_COURSE') {
      var launched = (lineLaunch['A'] && lineLaunch['A'].launched || []).concat(lineLaunch['B'] && lineLaunch['B'].launched || []);
      var match = launched.find(function(l) { return l.code === r.code && l.validatedAt && l.validatedAt >= weekAgo; });
      if (match) return true;
      if (r.launchedAt && r.launchedAt >= weekAgo) return true;
    }
    return false;
  });
  var consumedWeekVol = consumedWeek.reduce(function(s, r) { return s + grumeVolume(r); }, 0);
  var rotPct = mpVol > 0 ? Math.min(100, Math.round((consumedWeekVol / mpVol) * 100)) : 0;

  /* ── Total grumes lancées & sciées sur les 2 lignes ── */
  var grumesSciees = 0;
  ['A', 'B'].forEach(function(ln) {
    var launched = (lineLaunch[ln] && lineLaunch[ln].launched) || [];
    grumesSciees += launched.length;
  });
  if (grumesSciees === 0) {
    grumesSciees = rawMaterials.filter(function(r) {
      return r.statut === 'CONSOMME' || (r.statut === 'EN_COURSE' && r.launchedAt);
    }).length;
  }

  /* ── Stats par ligne (grumes liées) ── */
  /* Codes OF rattachés à une ligne (attribution des grumes sans tracking) */
  function lineOfNums(line) {
    var m = {};
    orders.forEach(function(o) { if (o && o.orderNum && ofLine(o) === line) m[o.orderNum] = 1; });
    return m;
  }
  function grumeByCode(code) {
    return rawMaterials.find(function(x) { return x && x.code === code; });
  }
  function lineStats(line) {
    var launched = (lineLaunch[line] && lineLaunch[line].launched) || [];
    var scioday = 0, encours = 0, vol30 = 0;
    var seen = {};
    launched.forEach(function(l) {
      /* Dédoublonnage : une même grume ne doit compter qu'une fois en sciées/volume */
      if (seen[l.code]) return;
      seen[l.code] = 1;
      var gm = grumeByCode(l.code);
      var vol = gm ? grumeVolume(gm) : 0;
      if (l.validatedAt) {
        if (dayKeyLocal(l.validatedAt) === todayKey) { scioday++; }
        if (l.validatedAt >= monthAgo) vol30 += vol;
      } else {
        encours++;
        /* Lancée aujourd'hui sans validation : c'est bien de l'activité du jour */
        if (l.launchedAt && dayKeyLocal(l.launchedAt) === todayKey) { scioday++; }
      }
    });
    /* Fallback : pas de tracking ligne → s'appuyer sur les grumes lancées/consommées,
       en attribuant chaque grume à SA ligne (via OF ou tracking global) pour éviter le
       double comptage A+B (l'ancien code avait un isLineA calculé puis jamais utilisé). */
    if (launched.length === 0) {
      var myOfs = lineOfNums(line);
      var tracked = {};
      ['A', 'B'].forEach(function(l2) {
        ((lineLaunch[l2] && lineLaunch[l2].launched) || []).forEach(function(e) { if (e.code) tracked[e.code] = l2; });
      });
      rawMaterials.forEach(function(r) {
        if (!r.launchedAt && !r.consumedAt) return;
        var mine;
        if (r.ofNum && Object.keys(myOfs).length) {
          mine = !!myOfs[r.ofNum];
        } else if (tracked[r.code]) {
          mine = tracked[r.code] === line;
        } else {
          mine = (line === 'A'); /* inconnu → attribué à A, jamais aux deux */
        }
        if (!mine) return;
        var vol = grumeVolume(r);
        var dKey = dayKeyLocal(r.consumedAt || r.launchedAt);
        var when = r.consumedAt || r.launchedAt;
        if (when >= monthAgo) vol30 += vol;
        if (dKey === todayKey) scioday++;
        if (r.statut === 'EN_COURSE') encours++;
      });
    }
    return { scioday: scioday, encours: encours, vol30: vol30, active: launched.length > 0 || encours > 0 };
  }
  var stA = lineStats('A'), stB = lineStats('B');

  /* ── OF actif / rendement / réalisés par ligne ── */
  function lineOfData(line) {
    var o = dashboardRenderer.lineOrderFor(line);
    if (o && o.status === 'annule') o = null;
    function belongsToLine(x) { return dashboardRenderer.ofLine(x) === line; }
    var realized = orders.filter(function(x) {
      if (!belongsToLine(x)) return false;
      if (x.status === 'realise') return true;
      if (x.qty > 0 && (x.producedQty || 0) >= x.qty) return true;
      return false;
    }).length;
    var total = orders.filter(function(x) { return belongsToLine(x); }).length;
    var pct = total > 0 ? Math.round((realized / total) * 100) : 0;
    var rend = null;
    if (o && o.qty > 0) {
      rend = Math.min(100, Math.round(((o.producedQty || 0) / o.qty) * 100));
    } else if (!o) {
      var done = orders.filter(function(x) { return belongsToLine(x) && x.status === 'realise' && x.qty > 0; });
      var sum = done.reduce(function(s, x) { return s + Math.min(100, Math.round(((x.producedQty || 0) / x.qty) * 100)); }, 0);
      rend = done.length ? Math.round(sum / done.length) : null;
    }
    var label = o ? (o.status === 'draft' ? 'brouillon' : o.status === 'realise' ? 'réalisé' : o.status === 'annule' ? 'annulé' : 'engagé') : null;
    return { of: o, label: label, realized: realized, total: total, pct: pct, rend: rend };
  }
  var odA = lineOfData('A'), odB = lineOfData('B');
  var rendA = odA.rend, rendB = odB.rend;

  /* ── Rendement de sciage par ligne (produit / grume) ── */
  function computeLineYield(line) {
    var myOfs = lineOfNums(line);
    /* Tous les lancements de la ligne (dédoublonnés par code grume) */
    var launched = (lineLaunch[line] && lineLaunch[line].launched) || [];
    var seenCodes = {};
    launched = launched.filter(function(l) {
      if (!l || !l.code) return false;
      if (seenCodes[l.code]) return false;
      seenCodes[l.code] = 1;
      return true;
    });
    var mpVol = 0;
    launched.forEach(function(l) {
      var gm = rawMaterials.find(function(x) { return l.code && x.code === l.code; });
      if (gm) mpVol += grumeVolume(gm);
    });
    /* Fallback symétrique à lineStats (ci-dessus) : sans tracking de lancement,
       le rendement restait bloqué à « — » alors que « grumes sciées » comptait
       déjà les grumes consommées — incohérence dans la même carte. On attribue
       donc les grumes à leur ligne (via OF, sinon à A) : même règle que lineStats,
       jamais de double comptage A+B. */
    if (launched.length === 0) {
      var trackedY = {};
      ['A', 'B'].forEach(function(l2) {
        ((lineLaunch[l2] && lineLaunch[l2].launched) || []).forEach(function(e) { if (e.code) trackedY[e.code] = l2; });
      });
      rawMaterials.forEach(function(r) {
        if (!r.launchedAt && !r.consumedAt) return;
        var mine;
        if (r.ofNum && Object.keys(myOfs).length) {
          mine = !!myOfs[r.ofNum];
        } else if (trackedY[r.code]) {
          mine = trackedY[r.code] === line;
        } else {
          mine = (line === 'A'); /* inconnu → attribué à A, jamais aux deux */
        }
        if (!mine) return;
        mpVol += grumeVolume(r);
      });
    }
    var pfVol = 0;
    /* WIP en cours de la ligne */
    if (typeof wipProducts !== 'undefined' && wipProducts) {
      wipProducts.forEach(function(w) {
        if (w && w.ofNum && myOfs[w.ofNum] && w.statut === 'EN_WIP') pfVol += (w.volume || 0);
      });
    }
    /* PF finis de la ligne */
    if (typeof finishedGoods !== 'undefined' && finishedGoods) {
      finishedGoods.forEach(function(f) {
        /* volume est DÉJÀ total (saisie manuelle : ep×larg×long×qté ; transfert WIP :
           une ligne par pièce, qte=1). Σ volume = stock réel — même convention que
           renderPfRecap. Ne PAS multiplier par qte (double comptage des PF manuels). */
        if (f && f.ofNum && myOfs[f.ofNum]) pfVol += (f.volume || 0);
      });
    }
    var pct = mpVol > 0 ? Math.min(100, Math.round((pfVol / mpVol) * 100)) : 0;
    return { pct: pct, pfVol: +pfVol.toFixed(3), mpVol: +mpVol.toFixed(3) };
  }
  var yieldA = computeLineYield('A'), yieldB = computeLineYield('B');

  /* ── Objectifs mensuels par ligne ── */
  var lineObj = loadFromStorage('charben_line_objectives', { A: { monthly_m3: 0 }, B: { monthly_m3: 0 } });
  var objA = (lineObj && lineObj.A && lineObj.A.monthly_m3) || 0;
  var objB = (lineObj && lineObj.B && lineObj.B.monthly_m3) || 0;

  /* Production PF du MOIS courant (source canonique partagée avec la sidebar
     of-objectives). Le % d'objectif se calcule sur le mois — jamais sur le
     rendement cumulé (all-time), sinon la barre mensuelle sur-compte. */
  function monthPfVol(line) {
    if (typeof window._ofObjectives_monthlyPfByLine === 'function') {
      var r = window._ofObjectives_monthlyPfByLine(line);
      return r && typeof r.vol === 'number' ? r.vol : 0;
    }
    return 0;
  }
  var monthPfA = monthPfVol('A'), monthPfB = monthPfVol('B');

  /* ── PF produits 30 derniers jours (un mois), par ligne ── */
  var pfNumA = {}, pfNumB = {};
  orders.forEach(function(x) {
    /* ofLine() normalise les OF de poste (A1/A2/A3→A, B1/B2→B) : lire x.line
       directement imputait les OF A1 à la ligne B via le else. */
    if (ofLine(x) === 'B') pfNumB[x.orderNum] = true; else pfNumA[x.orderNum] = true;
  });
  var PF_WINDOW_DAYS = 30;
  var pfDayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  function pfEmptyWindow() {
    var days = [];
    for (var i = PF_WINDOW_DAYS - 1; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      days.push({ k: d.toISOString().slice(0, 10), c: 0, lab: pfDayNames[d.getDay()] });
    }
    return days;
  }
  function pfKeyOf(f) { return ((f.sortieSechageAt || f.createdAt || '').slice(0, 10)); }
  /* Série attribuée à un ensemble d'OF (ligne A ou B) sur 30 jours */
  function pfPerLine(set) {
    var days = pfEmptyWindow();
    finishedGoods.forEach(function(f) {
      if (!f.ofNum || !set[f.ofNum]) return;
      var k = pfKeyOf(f);
      days.forEach(function(dd) { if (dd.k === k) dd.c += (f.qte || 1); });
    });
    return { days: days, tot: days.reduce(function(s, dd) { return s + dd.c; }, 0) };
  }
  /* Série de repli : sorties NON attribuées (aucun OF, ou OF hors ensembles A/B —
     typiquement les saisies addProduitFini). Jamais la courbe d'une autre ligne. */
  function pfSeriesOrphan() {
    var days = pfEmptyWindow();
    finishedGoods.forEach(function(f) {
      if (f.ofNum && (pfNumA[f.ofNum] || pfNumB[f.ofNum])) return;
      var k = pfKeyOf(f);
      days.forEach(function(dd) { if (dd.k === k) dd.c += (f.qte || 1); });
    });
    return { days: days, tot: days.reduce(function(s, dd) { return s + dd.c; }, 0) };
  }
  var pfA = pfPerLine(pfNumA), pfB = pfPerLine(pfNumB);
  var pfOrphan = pfSeriesOrphan();
  /* Une ligne sans PF attribué affiche la courbe de repli des sorties non
     attribuées — le graphique reste visible tant qu'il existe des données. */
  function pfViewFor(att, orphan) {
    if (att.tot > 0) return { days: att.days, tot: att.tot, fallback: false };
    if (orphan.tot > 0) return { days: orphan.days, tot: orphan.tot, fallback: true };
    return { days: att.days, tot: att.tot, fallback: false };
  }
  var pfViewA = pfViewFor(pfA, pfOrphan), pfViewB = pfViewFor(pfB, pfOrphan);
  /* Échelle Y commune PF 30j — mêmes graduations sur les 2 lignes pour comparer */
  var pfCommonMax = 1;
  [pfA, pfB, pfOrphan].forEach(function(pl) {
    if (pl && pl.days) { pl.days.forEach(function(d) { if (d.c > pfCommonMax) pfCommonMax = d.c; }); }
  });
  var pfScaleTop = niceScaleTop(pfCommonMax);

  /* ── Production du jour ── */
  /* Sorties RÉELLES du jour rattachées à une ligne (PF + lots de séchage + semi).
     Uniquement des lignes enregistrées : aucune estimation par motif. */
  function piecesOutToday(line) {
    var myOfs = lineOfNums(line);
    var n = 0;
    (typeof finishedGoods !== 'undefined' && finishedGoods ? finishedGoods : []).forEach(function(f) {
      if (!f || !f.ofNum || !myOfs[f.ofNum]) return;
      if (dayKeyLocal(f.sortieSechageAt || f.createdAt) === todayKey) n += (f.qte || 1);
    });
    (typeof wipProducts !== 'undefined' && wipProducts ? wipProducts : []).forEach(function(b) {
      if (!b || !b.ofNum || !myOfs[b.ofNum]) return;
      if (dayKeyLocal(b.createdAt) === todayKey) n += (b.pieces || b.qte || b.nbPieces || 0);
    });
    orders.forEach(function(o) {
      if (!o || !o.orderNum || !myOfs[o.orderNum] || !o.semiItems) return;
      if (dayKeyLocal(o.actualEnd || o.updatedAt) === todayKey) {
        o.semiItems.forEach(function(it) { n += (it.qty || 0); });
      }
    });
    return n;
  }

  /* ── Stock MP par essence (zone 1 du panneau) ── */
  var essGroups = {};
  mpStockArr.forEach(function(r) {
    var e = r.essence || '—';
    if (!essGroups[e]) essGroups[e] = { n: 0, v: 0, d: 0 };
    essGroups[e].n++;
    essGroups[e].v += grumeVolume(r);
    essGroups[e].d += (parseFloat(r.diametre) || 0);
  });
  var essArr = Object.keys(essGroups).map(function(e) {
    var g = essGroups[e];
    return { essence: e, n: g.n, v: g.v, d: g.n ? Math.round(g.d / g.n) : 0 };
  }).sort(function(a, b) { return b.v - a.v; });

  /* ── Conso 7j par essence (pour intégration dans chaque carte espèce) ── */
  var consoEss = {};
  consumedWeek.forEach(function(r) {
    var e = r.essence || '\u2014';
    if (!consoEss[e]) consoEss[e] = 0;
    consoEss[e] += grumeVolume(r);
  });
  essArr.forEach(function(en) { en.c = consoEss[en.essence] || 0; });

  /* ── Conso 6j ventilée par jour (Ven = repos, exclu) ── */
  var consoDays = (function() {
    var days = [];
    var dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      if (d.getDay() === 5) continue;
      days.push({ k: d.toISOString().slice(0, 10), c: 0, lab: dayNames[d.getDay()] });
    }
    consumedWeek.forEach(function(r) {
      var launchedAll = (lineLaunch['A'] && lineLaunch['A'].launched || []).concat(lineLaunch['B'] && lineLaunch['B'].launched || []);
      var match = launchedAll.find(function(l) { return l.code === r.code && l.validatedAt; });
      var k = match ? match.validatedAt.slice(0, 10) : (r.launchedAt || r.consumedAt || '').slice(0, 10);
      days.forEach(function(dd) { if (dd.k === k) dd.c += grumeVolume(r); });
    });
    return days;
  })();
  var consoMax = 1;
  consoDays.forEach(function(dd) { if (dd.c > consoMax) consoMax = dd.c; });

  /* ── Séchage (WIP) ── */
  var dryActiveArr = wipProducts.filter(function(b) { return b.statut === 'EN_WIP'; });
  var dryReady = dryActiveArr.filter(function(b) { return b.secheAt; }).length;
  var dryAvgTemp = 0;

  /* ── Santé globale ── */
  var rends = [rendA, rendB].filter(function(x) { return x != null; });
  var globalRend = rends.length ? Math.round(rends.reduce(function(s, x) { return s + x; }, 0) / rends.length) : null;
  var totalRealized = odA.realized + odB.realized;
  var totalPlanned = odA.total + odB.total;
  var activeLines = (stA.active ? 1 : 0) + (stB.active ? 1 : 0);

  var GREEN = '#10b981', VIOLET = '#a78bfa';

  /* ── Chromage moderne : palette vive 5 états, alpha renforcé ── */
  var CHROM = {
    green:  { color: '#10B981', bg: 'rgba(16,185,129,0.14)',  border: 'rgba(16,185,129,0.45)' },
    amber:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.14)',  border: 'rgba(245,158,11,0.48)' },
    red:    { color: '#EF4444', bg: 'rgba(239,68,68,0.14)',   border: 'rgba(239,68,68,0.48)' },
    neutral:{ color: '#8B98A9', bg: 'rgba(139,152,169,0.10)', border: 'rgba(139,152,169,0.30)' },
    cyan:   { color: '#06B6D4', bg: 'rgba(6,182,212,0.14)',   border: 'rgba(6,182,212,0.45)' }
  };
  function chromageRend(pct) {
    if (pct == null) return CHROM.neutral;
    if (pct >= 90) return CHROM.cyan;
    if (pct >= 70) return CHROM.green;
    if (pct >= 40) return CHROM.amber;
    return CHROM.red;
  }
  function chromageObj(pct) {
    if (pct == null || pct === 0) return CHROM.neutral;
    if (pct >= 90) return CHROM.cyan;
    if (pct >= 80) return CHROM.green;
    if (pct >= 50) return CHROM.amber;
    return CHROM.red;
  }
  function chromageStock(vol) {
    if (vol <= 0) return CHROM.red;
    if (vol < 20) return CHROM.amber;
    return CHROM.green;
  }

  function barsHtml(vals, max) {
    var h = '';
    vals.forEach(function(v, i) {
      var pct = max > 0 && v > 0 ? Math.max(8, Math.round((v / max) * 100)) : 5;
      h += '<i style="height:' + pct + '%;animation-delay:' + (0.2 + i * 0.06) + 's;"></i>';
    });
    return h;
  }

  /* Helpers charts partagés : échelle ronde (multiples de 4) + lissage Catmull-Rom */
  function niceScaleTop(v) {
    var raw = v <= 0 ? 4 : v;
    var steps = [4, 8, 20, 40, 100, 200, 400, 800, 1200, 1600, 2000, 4000, 8000, 12000, 16000, 20000, 40000, 60000, 100000];
    for (var s = 0; s < steps.length; s++) { if (raw <= steps[s]) return steps[s]; }
    return Math.ceil(raw / 100000) * 100000;
  }
  function fmtAxis(v) {
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k';
    return String(Math.round(v));
  }
  function catmull(p) {
    if (p.length < 2) return '';
    var d = 'M' + p[0].x.toFixed(1) + ',' + p[0].y.toFixed(1);
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
      var c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      var c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += 'C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' + p2.x.toFixed(1) + ',' + p2.y.toFixed(1);
    }
    return d;
  }

  function ligneInner(line, st, od, pfLine, color, yieldData, objM3, pfScaleTop, monthProd) {
    var rend = od && od.rend != null ? od.rend : null;
    var isA = line === 'A';
    var yld = yieldData || { pct: null, pfVol: 0, mpVol: 0 };
    var obj = objM3 || 0;
    var mProd = monthProd || 0;
    var h = '';
    /* Bandeau contexte OF (comme l'aperçu validé) */
    var odOf = od && od.of ? od.of : null;
    if (odOf) {
      h += '<div class="kd-lp-ctx"><b>' + escapeHtml(odOf.orderNum || '') + '</b><span>' + escapeHtml(odOf.wood || '') + '</span><span>' + (odOf.machine || '') + '</span><span>CC ' + (odOf.central || 0) + 'mm</span>' + (odOf.laterals && odOf.laterals.length ? '<span>SB ' + odOf.laterals.join('+') + 'mm</span>' : '') + '</div>';
    }
    /* Corps ligne — donut rendement + micro-KPI (même langage que la carte Rendement) */
    var yldPct = yld.pct != null ? yld.pct : 0;
    var objProg = obj > 0 ? Math.min(100, Math.round((mProd / obj) * 100)) : 0;
    var objGap = obj > 0 ? Math.max(0, +(obj - mProd).toFixed(1)) : 0;
    var chromYld = chromageRend(yld.pct);
    var chromObjL = chromageObj(objProg);
    var cirL = 2 * Math.PI * 32;
    var yldRing = yld.pct != null ? Math.max(0, Math.min(100, yld.pct)) : 0;
    h += '<div class="kd-lp-yield-kpi">';
    h += '<div class="kd-lp-yk-main">';
    h += '<div class="kd-lp-yk-donut"><svg viewBox="0 0 76 76">';
    h += '<circle cx="38" cy="38" r="32" fill="none" stroke="rgba(148,163,184,0.22)" stroke-width="9"/>';
    h += '<circle cx="38" cy="38" r="32" fill="none" stroke="' + (yld.pct != null ? chromYld.color : 'transparent') + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + ((yldRing / 100) * cirL).toFixed(1) + ' ' + cirL.toFixed(1) + '"/>';
    h += '</svg><div class="kd-lp-yk-hole"><div><b style="color:' + (yld.pct != null ? chromYld.color : 'var(--text-primary)') + ';">' + (yld.pct != null ? yld.pct + '%' : '\u2014') + '</b><i>rdt sciage</i></div></div></div>';
    h += '<div class="kd-lp-yk-side">';
    h += '<div class="kd-lp-mk"><span>m\u00b3 produits</span><b>' + yld.pfVol + '</b></div>';
    h += '<div class="kd-lp-mk"><span>m\u00b3 grumes</span><b>' + yld.mpVol + '</b></div>';
    h += '</div>';
    h += '</div>';
    h += '</div>';
    /* Tracks OF + Objectif */
    var oRealized = od ? (od.realized || 0) : 0;
    var oTotal = od ? (od.total || 0) : 0;
    var oPct = od ? (od.pct || 0) : 0;
    h += '<div class="kd-lp-tracks">';
    h += '<div><div class="kd-lp-track-head"><span class="kd-lp-track-lab" style="color:#3b82f6;">OF en cours</span><span class="kd-lp-track-sp"></span><span class="kd-lp-track-val">' + oRealized + ' / ' + oTotal + '</span><span class="kd-lp-track-badge" style="color:#3b82f6;background:rgba(59,130,246,0.13);border:1px solid rgba(59,130,246,0.35);">' + oPct + '%</span></div>';
    h += '<div class="kd-lp-yk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + oPct + '" aria-label="Progression OF en cours : ' + oPct + '%"><div class="kd-lp-yk-bar-fill" style="width:' + oPct + '%;background:#3b82f6;"></div></div></div>';
    if (obj > 0) {
      h += '<div><div class="kd-lp-track-head"><span class="kd-lp-track-lab" style="color:' + chromObjL.color + ';">Objectif ' + obj + ' m\u00b3</span><span class="kd-lp-track-sp"></span><span class="kd-lp-track-val">' + mProd + ' / ' + obj + ' m\u00b3</span><span class="kd-lp-track-badge" style="color:' + chromObjL.color + ';background:' + chromObjL.bg + ';border:1px solid ' + chromObjL.border + ';">' + objProg + '%</span></div>';
      h += '<div class="kd-lp-yk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + objProg + '" aria-label="Progression objectif ligne ' + (isA ? 'A' : 'B') + ' : ' + objProg + '%"><div class="kd-lp-yk-bar-fill" style="width:' + objProg + '%;background:' + chromObjL.color + ';"></div></div>';
      h += '<div class="kd-lp-obj-gap">Restant ' + objGap + ' m\u00b3 ce mois</div></div>';
    } else {
      h += '<div class="kd-lp-obj-empty" onclick="navigateTo(\'settings\')">Objectif mensuel \u2014 d\u00e9finir \u203a</div>';
    }
    h += '</div>';
    /* Stats chips */
    var sc = st || {};
    h += '<div class="kd-lp-chips">';
    h += '<div class="kd-lp-chip"><b>' + (sc.scioday || 0) + '</b><span>Sci\u00e9es</span></div>';
    var piecesDay = piecesOutToday(line);
    h += '<div class="kd-lp-chip kd-lp-chip-day" role="group" aria-label="Production du jour ligne ' + line + ' : ' + piecesDay + ' pi\u00e8ces"><b>' + piecesDay + '</b><span>Sorties du jour</span></div>';
    h += '<div class="kd-lp-chip"><b>' + (sc.vol30 != null ? sc.vol30.toFixed(1) : '0') + '</b><span>m\u00b3 30j</span></div>';
    h += '</div>';
    /* PF 30j — chart pro : échelle à graduations rondes, courbe lissée */
    var pfdays = (pfLine && pfLine.days) ? pfLine.days : [];
    var pfTot = (pfLine && pfLine.tot != null) ? pfLine.tot : 0;
    var pfFallback = !!(pfLine && pfLine.fallback);
    var pn = pfdays.length;
    h += '<div class="kd-lp-pf">';
    h += '<div class="kd-lp-pf-head"><span>PF produits \u2014 30j</span><span style="color:' + color + ';font-weight:800;">' + pfTot + ' pcs</span></div>';
    if (pfFallback) {
      h += '<div class="kd-lp-pf-note">sorties non attribu\u00e9es (sans OF)</div>';
    }
    if (pn < 2 || pfTot <= 0) {
      h += '<div class="kd-lp-pf-empty" role="img" aria-label="Production PF 30 jours, ' + pfTot + ' pieces au total"><span>Aucun PF rattach\u00e9 \u00e0 un OF sur les 30 derniers jours</span></div>';
    } else {
    var pfMax = 1;
    pfdays.forEach(function(d) { if (d.c > pfMax) pfMax = d.c; });
    var svgW = 300, svgH = 84, padL = 30, padR = 8, padT = 12, padB = 20;
    var chartW = svgW - padL - padR, chartH = svgH - padT - padB;
    var stepX = pn > 1 ? chartW / (pn - 1) : chartW;
    var baseY = padT + chartH;
    var yTop = pfScaleTop > 0 ? pfScaleTop : niceScaleTop(pfMax);
    var pfPts = pfdays.map(function(d, i) {
      return { x: padL + i * stepX, y: yTop > 0 ? padT + chartH - (d.c / yTop) * chartH : baseY, c: d.c, lab: d.lab, isToday: i === pn - 1 };
    });
    /* Sur 30 points les libellés se chevauchent : on n'affiche qu'un repère
       sur 5 (+ premier & dernier), et une valeur seulement sur ces repères
       (ou le dernier point, toujours mis en avant). */
    var dens = pn > 12;
    function pfTick(pi) { return !dens || pi === 0 || pi === pn - 1 || (pi % 5 === 0); }
    var pfSmooth = catmull(pfPts);
    var pfArea = pfSmooth + ' L' + pfPts[pn - 1].x.toFixed(1) + ',' + baseY + ' L' + pfPts[0].x.toFixed(1) + ',' + baseY + ' Z';
    h += '<svg class="kd-lp-line-chart" viewBox="0 0 ' + svgW + ' ' + svgH + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Production PF 30 jours, ' + pfTot + ' pieces au total">';
    h += '<defs><linearGradient id="kdLcGrad' + line + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + color + '" stop-opacity="0.35"/><stop offset="100%" stop-color="' + color + '" stop-opacity="0.02"/></linearGradient></defs>';
    h += '<g class="kd-lc-grid">';
    for (var gi = 1; gi <= 4; gi++) {
      var gy = padT + chartH - (chartH * gi) / 4;
      h += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (svgW - padR) + '" y2="' + gy.toFixed(1) + '"/>';
      h += '<text class="kd-lc-ytic" x="' + (padL - 5) + '" y="' + (gy + 3).toFixed(1) + '">' + fmtAxis((yTop * gi) / 4) + '</text>';
    }
    h += '</g>';
    pfPts.forEach(function(p, pi) {
      if (!pfTick(pi)) return;
      h += '<line class="kd-lc-xguide" x1="' + p.x.toFixed(1) + '" y1="' + (padT - 2) + '" x2="' + p.x.toFixed(1) + '" y2="' + baseY + '"/>';
    });
    h += '<path d="' + pfArea + '" fill="url(#kdLcGrad' + line + ')" opacity="0.45"/>';
    h += '<path d="' + pfSmooth + '" fill="none" stroke="' + color + '" stroke-width="4.5" opacity="0.16" stroke-linecap="round"/>';
    h += '<path d="' + pfSmooth + '" class="kd-lp-lc-line" style="stroke:' + color + ';"/>';
    pfPts.forEach(function(p, pi) {
      var emph = p.isToday;
      var tick = pfTick(pi);
      var edge = pi === 0 ? 'start' : (pi === pn - 1 ? 'end' : 'middle');
      var ax = pi === 0 ? p.x + 2 : (pi === pn - 1 ? p.x - 2 : p.x);
      h += '<circle class="' + (emph ? 'kd-lc-dot-today' : 'kd-lc-dot') + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (emph ? 4 : 2.2) + '" style="color:' + color + ';"/>';
      if (emph || (p.c > 0 && tick)) {
        h += '<text class="kd-lc-val' + (emph ? ' kd-lc-val-today' : '') + '" x="' + ax.toFixed(1) + '" y="' + (p.y - 6).toFixed(1) + '" style="color:' + color + ';text-anchor:' + edge + ';">' + p.c + '</text>';
      }
      if (tick) {
        h += '<text class="kd-lp-lc-day' + (emph ? ' kd-lc-day-today' : '') + '" x="' + ax.toFixed(1) + '" y="' + (svgH - 5) + '" text-anchor="' + edge + '"' + (emph ? ' style="color:' + color + ';"' : '') + '>' + p.lab + '</text>';
      }
    });
    h += '</svg>';
    }
    h += '</div>';
    return h;
  }

  function lignePanel(line, st, od, pfLine, color, tagline) {
    var h = '<div class="kd-lp">';
    h += ligneInner(line, st, od, pfLine, color);
    h += '</div>';
    return h;
  }

  var html = '<div class="kd-dash">';

  html += '<div class="kd-sf">';
  html += '<div class="kd-sf-head"><div class="kd-sf-title"><div class="kd-sf-ic"><i data-lucide="layers" style="width:17px;height:17px;"></i></div><div><b>Stock &amp; Rotation MP</b><span>Disponible en grumes \u00b7 \u00e9coulement 7j</span></div></div></div>';
  html += '<div class="kd-sf-kpi">';
  var chromStock = chromageStock(mpVol);
  html += '<div class="kd-rt">';
  html += '<div class="kd-rt-hero"><b style="color:' + chromStock.color + ';">' + mpVol.toFixed(2) + '</b><span>m\u00b3 en stock</span></div>';
  html += '<div class="kd-rt-mid"><span>Grumes</span><b>' + mpStockArr.length + '</b><i></i><span>Diam. moy.</span><b>' + mpAvgDiam + ' cm</b></div>';
  html += '<div class="kd-rt-flow">';
  html += '<div class="kd-rt-flow-head"><span class="kd-rt-flow-lab" style="color:' + chromStock.color + ';">\u00c9coulement 7j</span><span class="kd-rt-flow-sp"></span><span class="kd-rt-flow-badge" style="color:' + chromStock.color + ';">' + consumedWeekVol.toFixed(1) + ' m\u00b3 \u00b7 ' + rotPct + '%</span></div>';
  html += '<div class="kd-lp-yk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + rotPct + '" aria-label="\u00c9coulement du stock sur 7 jours : ' + rotPct + '%"><div class="kd-lp-yk-bar-fill" style="width:' + rotPct + '%;background:' + chromStock.color + ';"></div></div>';
  html += '<div class="kd-rt-bars">';
  consoDays.forEach(function(dd) {
    var bh = consoMax > 0 && dd.c > 0 ? Math.max(8, Math.round((dd.c / consoMax) * 100)) : 3;
    html += '<div class="kd-rt-bar"><i style="height:' + bh + '%;background:' + chromStock.color + ';"></i><em>' + dd.lab + '</em></div>';
  });
  html += '</div>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  /* Zone 1 : Stock MP par essence — n'afficher QUE le stock actif (n > 0).
     Une essence à zéro (ex. Épicéa=0) est masquée ; toute essence présente hors
     gamme (ex. Chêne) s'affiche, pour que la somme des cartes = total « Grumes ».
     Si aucune essence en stock, la section n'est pas rendue (pas de bloc vide). */
  var essDisplay = ['Pin', '\u00c9pic\u00e9a'];
  var essMap = {};
  essArr.forEach(function(en) {
    essMap[en.essence] = en;
    if (en.essence && en.essence !== '\u2014' && essDisplay.indexOf(en.essence) < 0) essDisplay.push(en.essence);
  });
  essDisplay = essDisplay.filter(function(name) { var e = essMap[name]; return e && e.n > 0; });
  if (essDisplay.length) {
    html += '<div class="kd-sf-sec">';
    html += '<div class="kd-sf-ess">';
    essDisplay.forEach(function(name) {
      var e = essMap[name] || { essence: name, n: 0, v: 0, d: 0, c: 0 };
      html += '<div class="kd-sf-ess-card">';
      html += '<div class="kd-sf-ess-top"><b>' + escapeHtml(e.essence) + '</b><span class="kd-sf-ess-qte"><b>' + e.n + '</b> grume' + (e.n > 1 ? 's' : '') + '</span></div>';
      html += '<div class="kd-sf-ess-v">' + (Math.round(e.v * 100) / 100) + ' <small>m\u00b3</small></div>';
      html += '<div class="kd-ess-conso">';
      html += '<div class="kd-ess-conso-head"><span class="kd-ess-conso-lab">Conso 7j</span><span class="kd-ess-conso-val">' + (Math.round(e.c * 100) / 100) + ' m\u00b3</span></div>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';
  }

  /* ── Zone : Stock Produits Finis (RÉEL) ──
     Même convention que l'écran PF (ui-renderer.renderPfRecap) :
     m³ stock = Σ volume (volume déjà total) ; pcs dispo = Σ(qte − qteExpedie).
     Aucune estimation, aucune valeur inventée. */
  var pfStockVol = 0, pfStockDispo = 0, pfStockShipped = 0;
  var pfItems = (typeof finishedGoods !== 'undefined' && finishedGoods) ? finishedGoods : [];
  pfItems.forEach(function(f) {
    if (!f) return;
    pfStockVol += (f.volume || 0);
    pfStockDispo += ((f.qte || 0) - (f.qteExpedie || 0));
    pfStockShipped += (f.qteExpedie || 0);
  });
  var chromPf = chromageStock(pfStockVol);
  html += '<div class="kd-sf" role="group" aria-label="Stock produits finis : ' + pfStockVol.toFixed(2) + ' m\u00b3, ' + pfStockDispo + ' pi\u00e8ces disponibles, ' + pfStockShipped + ' exp\u00e9di\u00e9es">';
  html += '<div class="kd-sf-head"><div class="kd-sf-title"><div class="kd-sf-ic" style="background:' + chromPf.bg + ';color:' + chromPf.color + ';border-color:' + chromPf.border + ';box-shadow:0 0 18px ' + chromPf.bg + ';"><i data-lucide="package" style="width:17px;height:17px;"></i></div><div><b>Stock Produits Finis</b><span>Disponible \u00b7 exp\u00e9di\u00e9</span></div></div></div>';
  html += '<div class="kd-sf-kpi">';
  html += '<div class="kd-rt">';
  html += '<div class="kd-rt-hero"><b style="color:' + chromPf.color + ';">' + pfStockVol.toFixed(2) + '</b><span>m\u00b3 en stock</span></div>';
  html += '<div class="kd-rt-mid"><span>R\u00e9f.</span><b>' + pfItems.length + '</b><i></i><span>Dispo</span><b>' + pfStockDispo + ' pcs</b><i></i><span>Exp\u00e9di\u00e9</span><b>' + pfStockShipped + ' pcs</b></div>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  /* Zone 2.5 : Rendement global + objectifs */
  var totalPfVol = (yieldA.pfVol || 0) + (yieldB.pfVol || 0);
  var totalMpVol2 = (yieldA.mpVol || 0) + (yieldB.mpVol || 0);
  var globalYieldPct = totalMpVol2 > 0 ? Math.min(100, Math.round((totalPfVol / totalMpVol2) * 100)) : null;
  var totalObj = objA + objB;
  var totalPfMonth = +((monthPfA + monthPfB).toFixed(4));   /* production PF du MOIS — base du % objectif (arrondi : évite l'artefact flottant 1.2003000000000001) */
  var chromRdt = chromageRend(globalYieldPct);
  html += '<div class="kd-sf-sec"><div class="kd-sf-head"><div class="kd-sf-title"><div class="kd-sf-ic" style="background:' + chromRdt.bg + ';color:' + chromRdt.color + ';border-color:' + chromRdt.border + ';box-shadow:0 0 18px ' + chromRdt.bg + ';"><i data-lucide="percent" style="width:17px;height:17px;"></i></div><div><b>Rendement de sciage</b><span>Rdt global \u00b7 Objectif mensuel</span></div></div></div>';
  html += '<div class="kd-lp-yield-kpi kd-rdt-main">';
  var cir = 2 * Math.PI * 38;
  var rdtPct = globalYieldPct != null ? Math.max(0, Math.min(100, globalYieldPct)) : 0;
  var rdtDash = (rdtPct / 100) * cir;
  html += '<div class="kd-rdt-donut"><svg viewBox="0 0 92 92">';
  html += '<circle cx="46" cy="46" r="38" fill="none" stroke="rgba(148,163,184,0.22)" stroke-width="10"/>';
  html += '<circle cx="46" cy="46" r="38" fill="none" stroke="' + (globalYieldPct != null ? chromRdt.color : 'transparent') + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + rdtDash.toFixed(1) + ' ' + cir.toFixed(1) + '"/>';
  html += '</svg><div class="kd-rdt-donut-hole"><div><b style="color:' + (globalYieldPct != null ? chromRdt.color : 'var(--text-primary)') + ';">' + (globalYieldPct != null ? globalYieldPct + '%' : '\u2014') + '</b><i>rendement</i></div></div></div>';
  /* Taux de chute = complément exact du rendement affiché (100 − rendement).
     Toujours cohérent avec le donut : même source, jamais de contradiction. */
  var chutePct = globalYieldPct != null ? Math.max(0, Math.min(100, 100 - globalYieldPct)) : null;
  var chromChute = chutePct == null ? CHROM.neutral : (chutePct <= 10 ? CHROM.green : chutePct <= 30 ? CHROM.amber : CHROM.red);
  html += '<div class="kd-rdt-side">';
  html += '<div class="kd-rdt-row"><span>m\u00b3 produits</span><b>' + totalPfVol.toFixed(2) + '</b></div>';
  html += '<div class="kd-rdt-row"><span>grumes sci\u00e9es</span><b>' + grumesSciees + '</b></div>';
  html += '<div class="kd-rdt-row"><span>taux de chute</span><b style="color:' + chromChute.color + ';">' + (chutePct != null ? chutePct + '%' : '\u2014') + '</b></div>';
  html += '</div>';
  html += '</div>';
  html += '<div class="kd-rdt-lines">';
  if (totalObj > 0) {
    var globalProg = Math.min(100, Math.round((totalPfMonth / totalObj) * 100));
    var globalGap = Math.max(0, +(totalObj - totalPfMonth).toFixed(1));
    var chromObj = chromageObj(globalProg);
    html += '<div class="kd-rdt-global"><div class="kd-rdt-line-head"><span class="kd-rdt-line-lab" style="color:' + chromObj.color + ';">Objectif mensuel</span><span class="kd-rdt-line-obj">' + totalPfMonth.toFixed(1) + ' / ' + totalObj + ' m\u00b3</span><span class="kd-rdt-line-pct kd-chrom" style="margin-left:auto;color:' + chromObj.color + ';background:' + chromObj.bg + ';border:1px solid ' + chromObj.border + ';border-radius:6px;padding:1px 6px;">' + globalProg + '%</span></div>';
    html += '<div class="kd-lp-yk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + globalProg + '" aria-label="Progression objectif mensuel : ' + globalProg + '%"><div class="kd-lp-yk-bar-fill" style="width:' + globalProg + '%;background:' + chromObj.color + ';"></div></div>';
    html += '<div class="kd-lp-obj-gap">Restant ' + globalGap + ' m\u00b3 ce mois</div></div>';
  } else {
    html += '<div class="kd-rdt-global"><div class="kd-rdt-line-head"><span class="kd-rdt-line-lab" style="color:var(--text-muted);">Objectif mensuel</span><span class="kd-rdt-line-obj">Aucun objectif \u2014 <b style="color:var(--accent-primary);cursor:pointer;" onclick="navigateTo(\'settings\')">d\u00e9finir un objectif \u203a</b></span></div></div>';
  }
  html += '</div>';
  /* ── Graphique central : production CUMULÉE du mois — 2 séries DISTINCTES ──
     Axe X = paliers du mois : 01 · 05 · 10 · 15 · 25 · 30 (+31 si mois à 31 j),
     tronqués à aujourd'hui + le jour courant ajouté en dernier point (sinon la
     production des derniers jours tombe entre deux paliers et le point mis en
     avant affiche un cumul faux). Chaque point = cumul du 1er du mois jusqu'au palier.
     Deux séries JAMAIS additionnées entre elles (sinon le même bois serait compté à
     l'entrée sciage PUIS à la sortie séchage) :
       · « Grumes sciées » (MP)  = volume de grumes entrées en sciage (A + B confondus) ;
       · « Produits finis » (PF) = volume de produits finis sortis (A + B confondus). */
  (function() {
    var now = new Date();
    var daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var todayDom = now.getDate();
    var monthKey = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2);
    var grid = [1, 5, 10, 15, 25, 30];
    if (daysInMonth === 31) grid.push(31);
    var markers = grid.filter(function(g) { return g <= todayDom; });
    if (markers[markers.length - 1] !== todayDom) markers.push(todayDom);
    var n = markers.length, lastI = n - 1;
    function pad2(v) { return ('0' + v).slice(-2); }

    /* Volume unitaire par code matière */
    var matVol = {};
    rawMaterials.forEach(function(x) { if (x && x.code) matVol[x.code] = grumeVolume(x); });

    /* Buckets par jour du mois courant : MP = grumes lancées (A+B), PF = produits finis.
       Une grume n'est comptée qu'une seule fois (dédoublonnage par code). */
    var mpBuckets = {}, pfBuckets = {};
    var seenMp = {};
    ['A', 'B'].forEach(function(ln) {
      var launched = (lineLaunch[ln] && lineLaunch[ln].launched) || [];
      launched.forEach(function(l) {
        if (!l || !l.code) return;
        var vol = matVol[l.code];
        if (vol == null) return;
        var vk = (l.validatedAt || l.launchedAt || '').slice(0, 10);
        if (vk.slice(0, 7) !== monthKey) return;
        var d = parseInt(vk.slice(8, 10), 10);
        if (!d) return;
        if (seenMp[l.code]) return;
        seenMp[l.code] = 1;
        mpBuckets[d] = (mpBuckets[d] || 0) + vol;
      });
    });
    finishedGoods.forEach(function(f) {
      if (!f) return;
      var fk = (f.sortieSechageAt || f.createdAt || '').slice(0, 10);
      if (fk.slice(0, 7) !== monthKey) return;
      var d = parseInt(fk.slice(8, 10), 10);
      if (!d) return;
      pfBuckets[d] = (pfBuckets[d] || 0) + (f.volume || 0);
    });

    /* Cumul depuis le 1er jusqu'à chaque palier (somme de TOUS les jours <= palier) */
    function cumAt(bk, d) {
      var s = 0;
      for (var dd2 = 1; dd2 <= d; dd2++) s += bk[dd2] || 0;
      return s;
    }
    var dataMP = markers.map(function(d) { return { lab: pad2(d), v: +cumAt(mpBuckets, d).toFixed(2) }; });
    var dataPF = markers.map(function(d) { return { lab: pad2(d), v: +cumAt(pfBuckets, d).toFixed(2) }; });

    /* Le dernier point EST toujours aujourd'hui */
    var todayIdx = lastI;

    var dataMax = 0; dataMP.concat(dataPF).forEach(function(d) { if (d.v > dataMax) dataMax = d.v; });
    var maxV = Math.max(dataMax, 1);
    var yTopW = niceScaleTop(maxV);
    var W = 360, H = 168, P = { t: 22, b: 36, l: 44, r: 14 };
    var pW = W - P.l - P.r, pH = H - P.t - P.b;
    var denom = lastI > 0 ? lastI : 1;
    var stepWx = pW / denom;
    function pxW(i) { return P.l + (i / denom) * pW; }
    function pyW(v) { return P.t + pH - (v / yTopW) * pH; }
    var mpPts = dataMP.map(function(d, i) { return { x: pxW(i), y: pyW(d.v), v: d.v, lab: d.lab, isToday: i === todayIdx }; });
    var pfPts = dataPF.map(function(d, i) { return { x: pxW(i), y: pyW(d.v), v: d.v, lab: d.lab, isToday: i === todayIdx }; });
    var baseYw = P.t + pH;
    var mpSmooth = catmull(mpPts);
    var pfSmooth = catmull(pfPts);
    var totMP = mpPts[lastI].v, totPF = pfPts[lastI].v;
    var mpArea = n > 1 ? mpSmooth + ' L' + mpPts[lastI].x.toFixed(1) + ',' + baseYw + ' L' + mpPts[0].x.toFixed(1) + ',' + baseYw + ' Z' : '';
    var pfArea = n > 1 ? pfSmooth + ' L' + pfPts[lastI].x.toFixed(1) + ',' + baseYw + ' L' + pfPts[0].x.toFixed(1) + ',' + baseYw + ' Z' : '';
    /* Palette main chart STRICTEMENT distincte des lignes A (vert) / B (violet) :
       grumes (MP) = brun bois naturel, débits / produits finis (PF) = bleu corporate
       (attribution inversée par rapport à l'ancien MP bleu / PF ambre). */
    var MP_COLOR = '#8b5a2b', PF_COLOR = '#2563eb';
    html += '<div class="kd-sf-sec">';
    html += '<div class="kd-weekly-chart">';
    html += '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;" role="img" aria-label="Production cumulée du mois en mètres cubes, grumes sciées ' + totMP.toFixed(1) + ', produits finis ' + totPF.toFixed(1) + '">';
    html += '<defs><linearGradient id="gMP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + MP_COLOR + '" stop-opacity="0.32"/><stop offset="100%" stop-color="' + MP_COLOR + '" stop-opacity="0.02"/></linearGradient><linearGradient id="gPF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + PF_COLOR + '" stop-opacity="0.32"/><stop offset="100%" stop-color="' + PF_COLOR + '" stop-opacity="0.02"/></linearGradient></defs>';
    html += '<rect x="' + (pxW(lastI) - stepWx / 2).toFixed(1) + '" y="' + P.t + '" width="' + stepWx.toFixed(1) + '" height="' + pH + '" fill="rgba(148,163,184,0.07)"/>';
    for (var g2 = 1; g2 <= 4; g2++) {
      var gv2 = (yTopW * g2) / 4, gy2 = pyW(gv2);
      html += '<line class="kd-lc-gridline" x1="' + P.l + '" y1="' + gy2.toFixed(1) + '" x2="' + (W - P.r) + '" y2="' + gy2.toFixed(1) + '"/>';
      html += '<text class="kd-lc-ytic" x="' + (P.l - 5) + '" y="' + (gy2 + 3).toFixed(1) + '">' + fmtAxis(gv2) + '</text>';
    }
    html += '<line class="kd-lc-base" x1="' + P.l + '" y1="' + baseYw + '" x2="' + (W - P.r) + '" y2="' + baseYw + '"/>';
    for (var xi2 = 0; xi2 < n; xi2++) {
      html += '<line class="kd-lc-xguide" x1="' + pxW(xi2).toFixed(1) + '" y1="' + P.t + '" x2="' + pxW(xi2).toFixed(1) + '" y2="' + baseYw + '"/>';
    }
    if (n > 1) {
      html += '<path d="' + mpArea + '" fill="url(#gMP)"/>';
      html += '<path d="' + pfArea + '" fill="url(#gPF)"/>';
      html += '<path d="' + mpSmooth + '" fill="none" stroke="' + MP_COLOR + '" stroke-width="7" opacity="0.15" stroke-linecap="round"/>';
      html += '<path d="' + pfSmooth + '" fill="none" stroke="' + PF_COLOR + '" stroke-width="7" opacity="0.15" stroke-linecap="round"/>';
      html += '<path d="' + mpSmooth + '" fill="none" stroke="' + MP_COLOR + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
      html += '<path d="' + pfSmooth + '" fill="none" stroke="' + PF_COLOR + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
    }
    [mpPts, pfPts].forEach(function(ser, si) {
      var serCol = si === 0 ? MP_COLOR : PF_COLOR;
      ser.forEach(function(p, i) {
        var emph = p.isToday;
        var edge = i === 0 ? 'start' : (i === lastI ? 'end' : 'middle');
        var ax = i === 0 ? p.x + 2 : (i === lastI ? p.x - 2 : p.x);
        html += '<circle class="' + (emph ? 'kd-lc-dot-today' : 'kd-lc-dot') + '" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (emph ? 4.5 : 3) + '" style="fill:' + serCol + ';color:' + serCol + (emph ? ';filter:drop-shadow(0 0 4px ' + serCol + ');' : '') + '"/>';
        if (emph && p.v > 0) {
          html += '<text class="kd-lc-val kd-lc-val-today" x="' + ax.toFixed(1) + '" y="' + (p.y - 8).toFixed(1) + '" style="color:' + serCol + ';fill:' + serCol + ';text-anchor:' + edge + ';">' + p.v.toFixed(1) + '</text>';
        }
      });
    });
    dataMP.forEach(function(d, i) {
      var emph = i === todayIdx;
      var edge = i === 0 ? 'start' : (i === lastI ? 'end' : 'middle');
      var ax = i === 0 ? pxW(i) + 2 : (i === lastI ? pxW(i) - 2 : pxW(i));
      html += '<text class="kd-lp-lc-day' + (emph ? ' kd-lc-day-today' : '') + '" x="' + ax.toFixed(1) + '" y="' + (H - 9) + '" text-anchor="' + edge + '"' + (emph ? ' style="fill:var(--text-primary);font-weight:900;"' : '') + '>' + d.lab + '</text>';
    });
    html += '</svg>';
    html += '<div class="kd-weekly-legend">';
    html += '<span class="kd-wl-item" style="color:' + MP_COLOR + ';"><i style="background:' + MP_COLOR + ';box-shadow:0 0 6px ' + MP_COLOR + ';"></i>Grumes sciées \u00b7 ' + fmtAxis(totMP) + ' m\u00b3</span>';
    html += '<span class="kd-wl-item" style="color:' + PF_COLOR + ';"><i style="background:' + PF_COLOR + ';box-shadow:0 0 6px ' + PF_COLOR + ';"></i>Produits finis \u00b7 ' + fmtAxis(totPF) + ' m\u00b3</span>';
    html += '</div>';
    html += '</div></div>';
  })();

  /* ── Zone : Ordres de fabrication — indicateur UNIFIÉ ──
     Regroupe « OF en cours » et « taux de réalisation » en un seul KPI
     synthétique. Données réelles : orders (statut/producedQty), aucune estimation. */
  var ofActive = orders.filter(function(o) {
    if (!o) return false;
    if (o.status === 'realise' || o.status === 'annule' || o.status === 'completed' || o.status === 'done') return false;
    return !(o.qty > 0 && (o.producedQty || 0) >= o.qty);
  }).length;
  var ofRealPct = totalPlanned > 0 ? Math.round((totalRealized / totalPlanned) * 100) : 0;
  var chromOf = chromageObj(ofRealPct);
  html += '<div class="kd-sf-sec" role="group" aria-label="Ordres de fabrication : ' + ofActive + ' OF en cours, taux de r\u00e9alisation ' + ofRealPct + '%, ' + totalRealized + ' sur ' + totalPlanned + '">';
  html += '<div class="kd-sf-head"><div class="kd-sf-title"><div class="kd-sf-ic" style="background:' + chromOf.bg + ';color:' + chromOf.color + ';border-color:' + chromOf.border + ';box-shadow:0 0 18px ' + chromOf.bg + ';"><i data-lucide="clipboard-list" style="width:17px;height:17px;"></i></div><div><b>Ordres de fabrication</b><span>OF en cours \u00b7 taux de r\u00e9alisation</span></div></div></div>';
  html += '<div class="kd-rdt-lines">';
  html += '<div class="kd-rdt-global"><div class="kd-rdt-line-head"><span class="kd-rdt-line-lab" style="color:' + chromOf.color + ';">' + ofActive + ' OF en cours</span><span class="kd-rdt-line-pct kd-chrom" style="margin-left:auto;color:' + chromOf.color + ';background:' + chromOf.bg + ';border:1px solid ' + chromOf.border + ';border-radius:6px;padding:1px 6px;">' + ofRealPct + '% r\u00e9alis\u00e9s (' + totalRealized + '/' + totalPlanned + ')</span></div>';
  html += '<div class="kd-lp-yk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + ofRealPct + '" aria-label="Taux de r\u00e9alisation des OF : ' + ofRealPct + '%"><div class="kd-lp-yk-bar-fill" style="width:' + ofRealPct + '%;background:' + chromOf.color + ';"></div></div></div>';
  html += '</div>';
  html += '</div>';

  /* Zone « Analyse de production » DÉPLACÉE vers la vue Traçabilité.
     Source inchangée : registre append-only des mouvements (mouvementsManager)
     agrégé par productionStatsModule.queryProductionStats.
     Rendu désormais par trace-api.js → renderTraceProduction() (#traceProductionKpis). */

  /* Zone 3 : Lignes de sciage · A & B — onglets sur un même espace */
  html += '<div class="kd-sf-sec">';
  html += '<div class="kd-lp-wrap">';
  var activeLigne = (window.__kdActiveLigne === 'B') ? 'B' : 'A';
  var isAActive = activeLigne === 'A';
  html += '<div class="kd-lp-tabs" role="tablist" aria-label="Lignes de sciage">';
  html += '<button type="button" role="tab" id="lpTabA" class="kd-lp-tab' + (isAActive ? ' kd-lp-tab-active' : '') + '" data-line="A" aria-selected="' + isAActive + '" onclick="dashboardRenderer.switchLigneTab(\'A\')"><span class="kd-lp-tab-badge kd-lp-tab-badge-a">A</span>Ligne A</button>';
  html += '<button type="button" role="tab" id="lpTabB" class="kd-lp-tab' + (isAActive ? '' : ' kd-lp-tab-active') + '" data-line="B" aria-selected="' + (!isAActive) + '" onclick="dashboardRenderer.switchLigneTab(\'B\')"><span class="kd-lp-tab-badge kd-lp-tab-badge-b">B</span>Ligne B</button>';
  html += '</div>';
  html += '<div class="kd-lp-pane' + (isAActive ? '' : ' kd-lp-hidden') + '" id="lpContentA" role="tabpanel">';
      html += ligneInner('A', stA, odA, pfViewA, GREEN, yieldA, objA, pfScaleTop, monthPfA);
  html += '</div>';
  html += '<div class="kd-lp-pane' + (isAActive ? ' kd-lp-hidden' : '') + '" id="lpContentB" role="tabpanel">';
      html += ligneInner('B', stB, odB, pfViewB, VIOLET, yieldB, objB, pfScaleTop, monthPfB);
  html += '</div>';
  html += '</div></div>';

  html += '</div>';

  html += '</div>';

  // === OPENWES PATTERN: Alertes prédiction stock grumes (Prediction.js) ===
  if (typeof Prediction !== 'undefined') {
    try {
      var alerts = Prediction.checkStockAlerts();
      if (alerts.length > 0) {
        html += '<div style="margin-top:12px;">';
        alerts.forEach(function(a) {
          html += '<div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:8px 12px;margin-bottom:6px;font-size:12px;color:#92400e;">' + escapeHtml(a.message) + '</div>';
        });
        html += '</div>';
      }
    } catch (e) { errLog('dashboard-renderer', 'Prediction alerts', e, 'warn'); }
  }

  el.innerHTML = html;
  renderLucide();
  animateCounters();
}

/* ─────────────────────────────────────────────
   refreshDashboard — rafraîchissement rapide
   Extrait EXACT: app.js lignes 7513-7519
   ───────────────────────────────────────────── */

window._dashboardRenderer_refreshDashboard = function(silent) {
  renderDashboardKPIs();
  renderAlertsPanel();
  renderUpcomingTasksPanel();
  renderPlanningRate();
  /* ── Flash info pro : objectifs + réglages ── */
  if (typeof ofFlash !== 'undefined') { ofFlash.launch(); }
  if (!silent) showToast('Tableau de bord actualisé.', 'success');
};

/* ─────────────────────────────────────────────
   renderAlertsPanel — panneau alertes (copie EXACTE)
   Extrait EXACT: app.js lignes 7438-7511
   ───────────────────────────────────────────── */

window._dashboardRenderer_renderAlertsPanel = function() {
  const el = document.getElementById('alertsPanel');
  if (!el) return;
  const sec = document.getElementById('alertsSection');
  if (getAppPref('charben_notif_on', '1') === '0') {
    el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:8px 0;">Notifications désactivées</div>';
    if (sec) sec.style.display = 'block';
    return;
  }
  const alerts = [];

  var lowStockFG = (Array.isArray(finishedGoods) ? finishedGoods : []).filter(function(f) { return (f.qte || 0) <= 0; });
  var pfGroups = {};
  lowStockFG.forEach(function(f) {
    var fam = (f.type || 'PF') + ' ' + (f.essence || '');
    if (!pfGroups[fam]) pfGroups[fam] = { refs: 0, qte: 0 };
    pfGroups[fam].refs++;
    pfGroups[fam].qte += (f.qte || 0);
  });
  Object.keys(pfGroups).forEach(function(fam) {
    var g = pfGroups[fam];
    alerts.push({ icon: '<i data-lucide="alert-triangle" style="width:16px;height:16px;"></i>', type: 'warning', title: 'Stock épuisé: ' + escapeHtml(fam), desc: (g.refs > 1) ? g.refs + ' références en rupture de stock' : 'Rupture de stock', action: "showScreen('pf')" });
  });

  var today = new Date().toISOString().slice(0, 10);
  /* Alertes SF en WIP — DÉSACTIVÉES */
  /* wipProducts.forEach(function(b) {
    if (b.statut === 'EN_WIP' && b.ofNum) {
      alerts.push({ icon: '<i data-lucide="package" style="width:16px;height:16px;"></i>', type: 'info', title: 'SF en WIP: ' + escapeHtml(b.ref || ''), desc: (b.qte || 0) + ' pcs — ' + escapeHtml(b.essence || '') + ' ' + escapeHtml(b.epaisseur || 0) + '×' + escapeHtml(b.largeur || 0) + 'mm', action: "showScreen('production')" });
    }
  }); */

  (Array.isArray(equipment) ? equipment : []).forEach(function(e) {
    if (e.status === 'hors_service') {
      alerts.push({ icon: '<i data-lucide="wrench" style="width:16px;height:16px;"></i>', type: 'danger', title: 'Équipement HS: ' + escapeHtml(e.name || ''), desc: 'Hors service', action: "showScreen('equipment')" });
    }
  });

  (Array.isArray(disques) ? disques : []).forEach(function(d) {
    var restD = disqueStockRestant(d);
    if (restD <= (d.seuilAlerte || 0)) {
      alerts.push({ icon: '<i data-lucide="disc-3" style="width:16px;height:16px;"></i>', type: 'danger', title: 'Disques stock bas: ' + escapeHtml(d.ref), desc: 'Stock restant: ' + restD + ' — réapprovisionner', action: "showScreen('disques')" });
    }
  });

  if (rawMaterials.length === 0 && wipProducts.length === 0 && finishedGoods.length === 0) {
    alerts.push({ icon: '<i data-lucide="rocket" style="width:16px;height:16px;"></i>', type: 'success', title: 'Bienvenue !', desc: 'Commencez par ajouter des matières premières', action: "showScreen('mp')" });
  }

  if (alerts.length === 0) {
    updateAlertBadge(0);
    el.innerHTML = '';
    if (sec) sec.style.display = 'none';
    return;
  }

  var html = '<div class="alerts-panel">';
  html += '<div class="alerts-header"><h4><i data-lucide="bell" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"></i> Alertes <span class="alert-count">' + alerts.length + '</span></h4></div>';
  alerts.slice(0, 5).forEach(function(a) {
    html += '<div class="alert-item" onclick="' + escapeHtml(a.action) + '">';
    html += '<div class="alert-icon ' + a.type + '">' + a.icon + '</div>';
    // security-check: allow a.title/a.desc sont echappes a la construction (lignes 735/742/748/755/760)
    html += '<div class="alert-body"><div class="alert-title">' + a.title + '</div><div class="alert-desc">' + a.desc + '</div></div>';
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
  if (sec) sec.style.display = 'block';
  updateAlertBadge(alerts.length);
  renderLucide();
};

/* ─────────────────────────────────────────────
   renderUpcomingTasksPanel — panneau tâches
   Extrait EXACT: app.js lignes 7274-7278
   ───────────────────────────────────────────── */

window._dashboardRenderer_renderUpcomingTasksPanel = function() {
  var el = document.getElementById('upcomingTasks');
  if (!el) return;
  el.innerHTML = renderUpcomingTasks();
};

/* ─────────────────────────────────────────────
   renderPlanningRate — taux réalisation (copie EXACTE)
   Extrait EXACT: app.js lignes 7297-7323
   ───────────────────────────────────────────── */

window._dashboardRenderer_renderPlanningRate = function() {
  var el = document.getElementById('planningRate');
  if (!el) return;
  var totalT = planningTasks.length;
  var doneT = planningTasks.filter(function(t) { return t.status === 'done'; }).length;
  var kdOfs = kdTrProductionOfs();
  var totalP = kdOfs.length;
  var doneP = kdOfs.filter(function(o) {
    if (o.status === 'realise' || o.status === 'completed' || o.status === 'done') return true;
    return o.qty > 0 && (o.producedQty || 0) >= o.qty;
  }).length;
  if (totalT === 0 && totalP === 0) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:8px 0;">Aucune tâche planifiée</div>';
    return;
  }
  var rateT = totalT ? Math.round(doneT / totalT * 100) : 0;
  var rateP = totalP ? Math.round(doneP / totalP * 100) : 0;
  var html = '<div class="kd-tr-duo">';
  if (totalT > 0) {
    html += '<div class="kd-tr-rate kd-tr-rate-t"><div class="kd-tr-rate-lab">Tâches <b>' + doneT + '/' + totalT + '</b></div><div class="kd-tr-rate-big">' + rateT + '<small>%</small></div><div class="kd-tr-rate-bar"><i style="width:' + rateT + '%;"></i></div></div>';
  }
  if (totalP > 0) {
    html += '<div class="kd-tr-rate kd-tr-rate-p"><div class="kd-tr-rate-lab">Production OF <b>' + doneP + '/' + totalP + '</b></div><div class="kd-tr-rate-big">' + rateP + '<small>%</small></div><div class="kd-tr-rate-bar"><i style="width:' + rateP + '%;"></i></div></div>';
  }
  html += '</div>';
  el.innerHTML = html;
};

/* ─────────────────────────────────────────────
   kdSetTaskFilter — filtre tâches (copie EXACTE)
   Extrait EXACT: app.js lignes 7281-7285
   ───────────────────────────────────────────── */

window._dashboardRenderer_kdSetTaskFilter = function(f) {
  kdTaskFilter = f;
  renderUpcomingTasksPanel();
  renderPlanningRate();
};

window._dashboardRenderer_toggleAccordion = function(line) {
  var el = document.getElementById('accItem' + line);
  if (!el) return;
  el.classList.toggle('kd-acc-open');
};

window._dashboardRenderer_switchLigneTab = function(line) {
  var isA = line === 'A';
  window.__kdActiveLigne = isA ? 'A' : 'B';
  var tabA = document.getElementById('lpTabA');
  var tabB = document.getElementById('lpTabB');
  var contentA = document.getElementById('lpContentA');
  var contentB = document.getElementById('lpContentB');
  if (!tabA || !tabB || !contentA || !contentB) return;
  tabA.classList.toggle('kd-lp-tab-active', isA);
  tabB.classList.toggle('kd-lp-tab-active', !isA);
  contentA.classList.toggle('kd-lp-hidden', !isA);
  contentB.classList.toggle('kd-lp-hidden', isA);
  tabA.setAttribute('aria-selected', isA ? 'true' : 'false');
  tabB.setAttribute('aria-selected', isA ? 'false' : 'true');
};

window._dashboardRenderer_toggleLignePanel = function(line) {
  var el = document.getElementById('kdLp' + line);
  if (!el) return;
  var open = el.classList.contains('kd-lp-open');
  el.classList.toggle('kd-lp-open', !open);
  var stored = loadFromStorage('charben_kd_lp_collapsed', {});
  if (!stored || typeof stored !== 'object') stored = {};
  if (open) stored[line] = true; else delete stored[line];
  saveToStorage('charben_kd_lp_collapsed', stored);
};

/* ─────────────────────────────────────────────
   EXPORT GLOBAL — wrappers compatibles
   ───────────────────────────────────────────── */

/* ── Helpers purifiés (testables hors DOM) ── */
window._dashboardRenderer_ofLine = function ofLine(o) {
  if (!o) return 'A';
  return String(o.line || 'A').charAt(0).toUpperCase() || 'A';
};
window._dashboardRenderer_lineOrderFor = function lineOrderFor(line) {
  var launches = (typeof lineLaunch !== 'undefined' && lineLaunch[line] && lineLaunch[line].launched) ? lineLaunch[line].launched : [];
  var byDate = launches.slice().sort(function (a, b) {
    var da = a && a.launchedAt || '', db = b && b.launchedAt || '';
    return db > da ? 1 : db < da ? -1 : 0;
  });
  var seenOfs = {};
  for (var i = 0; i < byDate.length; i++) {
    var ofn = byDate[i] && byDate[i].ofNum;
    if (!ofn || seenOfs[ofn]) continue;
    seenOfs[ofn] = 1;
    var found = (typeof orders !== 'undefined' ? orders : []).find(function (x) { return x && x.orderNum === ofn; });
    if (found && found.status !== 'annule') return found;
  }
  var fallback = getLineOrder(line);
  if (fallback && fallback.status !== 'annule') return fallback;
  return null;
};

window.dashboardRenderer = {
  renderDashboardKPIs: window._dashboardRenderer_renderDashboardKPIs,
  refreshDashboard: window._dashboardRenderer_refreshDashboard,
  renderAlertsPanel: window._dashboardRenderer_renderAlertsPanel,
  renderUpcomingTasksPanel: window._dashboardRenderer_renderUpcomingTasksPanel,
  renderPlanningRate: window._dashboardRenderer_renderPlanningRate,
  kdSetTaskFilter: window._dashboardRenderer_kdSetTaskFilter,
  switchLigneTab: window._dashboardRenderer_switchLigneTab,
  toggleAccordion: window._dashboardRenderer_toggleAccordion,
  toggleLignePanel: window._dashboardRenderer_toggleLignePanel,
  ofLine: window._dashboardRenderer_ofLine,
  lineOrderFor: window._dashboardRenderer_lineOrderFor
};