/**
 * FICHE-RENDERER.JS — Fiches de sciage, rendement, cales
 * Scierie Charben — Extraits depuis app.js
 * Globals: escapeHtml, getLineOrder, MACHINE_SPECS, DISK_THICKNESS,
 *          ARBORS_PER_SAW, GAMME_ESSENCES, rawMaterials,
 *          lineLaunchedForOf, lastSlotInstall, lastPatternA, lastPatternB,
 *          ccMachineInfo, sbMachineInfo, needsForCombos, comboArray,
 *          getCombination, pieceDesignation, buildRipDiagram, buildDossesDiagram,
 *          buildMachineFicheShell, stockDispoFor
 */
'use strict';

/* ─────────────────────────────────────────────
   buildFicheSciageHtml — fiche A1 (stock grumes)
   Extrait: app.js lignes 497-585
   ───────────────────────────────────────────── */

window._ficheRenderer_buildFicheSciageHtml = function(o, line) {
  if (!o) return '';
  var launched = (typeof lineLaunchedForOf === 'function') ? lineLaunchedForOf(line || 'A', o.orderNum) : [];
  var nbGrumes = launched.filter(function(l) { return l.validatedAt; }).length;
  var longueur = o.pieceLength ? (o.pieceLength / 1000) : '?';
  var grumeLen = 0;
  launched.forEach(function(l) { var gl = parseFloat(l.longueur) || 0; if (gl > grumeLen) grumeLen = gl; });
  if (grumeLen > 0 && longueur === '?') longueur = grumeLen;
  var laterals = o.laterals || [];
  var COLORS = { CC: '#3b82f6', SB: '#10b981', DOSSE: '#f59e0b' };
  var rows = '';
  var nbCC = (o.ccQtyPerGrume || 1);
  rows += '<tr style="background:' + COLORS.CC + '10;border-left:3px solid ' + COLORS.CC + ';">'
    + '<td style="font-weight:700;color:' + COLORS.CC + ';">A2</td>'
    + '<td style="color:' + COLORS.CC + ';font-weight:700;">CC CENTRAL ' + escapeHtml(String(o.central)) + '</td>'
    + '<td>Ép. <b>' + o.central + 'mm</b></td>'
    + '<td>× <b>' + (nbCC * nbGrumes) + '</b></td>'
    + '<td>' + o.central + 'mm × ?mm × ' + longueur + 'm</td></tr>';
  if (o.central2 && parseFloat(o.central2) > 0) {
    rows += '<tr style="background:' + COLORS.CC + '08;border-left:3px solid ' + COLORS.CC + ';">'
      + '<td style="font-weight:700;color:' + COLORS.CC + ';">A2</td>'
      + '<td style="color:' + COLORS.CC + ';">CC SECONDAIRE ' + escapeHtml(String(o.central2)) + '</td>'
      + '<td>Ép. <b>' + o.central2 + 'mm</b></td>'
      + '<td>× <b>' + (nbCC * nbGrumes) + '</b></td>'
      + '<td>' + o.central2 + 'mm × ?mm × ' + longueur + 'm</td></tr>';
  }
  var sbLabels = ['SB CENTRAL', 'SB SECONDAIRE', 'SB 3', 'SB 4'];
  laterals.forEach(function(lat, i) {
    var nbSB = (o.lateralQtyMult || 2);
    var label = i < sbLabels.length ? sbLabels[i] : 'SB ' + (i + 1);
    rows += '<tr style="background:' + COLORS.SB + '10;border-left:3px solid ' + COLORS.SB + ';">'
      + '<td style="font-weight:700;color:' + COLORS.SB + ';">A3</td>'
      + '<td style="color:' + COLORS.SB + ';font-weight:700;">' + escapeHtml(label) + ' ' + escapeHtml(String(lat)) + '</td>'
      + '<td>Ép. <b>' + lat + 'mm</b></td>'
      + '<td>× <b>' + (nbSB * nbGrumes) + '</b></td>'
      + '<td>' + lat + 'mm × ?mm × ' + longueur + 'm</td></tr>';
  });
  var chute = o.chute || 0;
  if (chute > 0) {
    var nbDosses = (o.dosses && o.dosses.count) ? o.dosses.count : 2;
    var dosseEp = (o.dosses && o.dosses.epaisseur) ? o.dosses.epaisseur : DISK_THICKNESS;
    var dosseLarg = +(chute / nbDosses).toFixed(1);
    rows += '<tr style="background:' + COLORS.DOSSE + '10;border-left:3px solid ' + COLORS.DOSSE + ';">'
      + '<td style="font-weight:700;color:' + COLORS.DOSSE + ';">A4</td>'
      + '<td style="color:' + COLORS.DOSSE + ';">Dosses</td>'
      + '<td>Ép. <b>' + dosseEp + 'mm</b></td>'
      + '<td>× <b>' + (nbDosses * nbGrumes) + '</b></td>'
      + '<td>' + dosseEp + 'mm × ' + dosseLarg + 'mm × ' + longueur + 'm</td></tr>';
  }
  if (!rows) return '';
  var uid = 'ficheA1_' + (o.orderNum || '').replace(/[^a-zA-Z0-9]/g, '_');
  var legend = '<span style="color:' + COLORS.CC + ';font-weight:700;">■</span> CC · '
    + '<span style="color:' + COLORS.SB + ';font-weight:700;">■</span> SB · '
    + '<span style="color:' + COLORS.DOSSE + ';font-weight:700;">■</span> Dosses';
  var tableHtml = '<table class="result-table" style="width:100%;border-collapse:collapse;font-size:11px;">'
    + '<thead><tr style="border-bottom:2px solid var(--border-color);">'
    + '<th style="text-align:left;padding:6px 4px;">Poste</th>'
    + '<th style="text-align:left;padding:6px 4px;">Découpe A1</th>'
    + '<th style="text-align:left;padding:6px 4px;">Épaisseur</th>'
    + '<th style="text-align:left;padding:6px 4px;">Qté totale</th>'
    + '<th style="text-align:left;padding:6px 4px;">Dimensions</th>'
    + '</tr></thead><tbody>' + rows + '</tbody></table>'
    + '<div style="font-size:10px;color:var(--text-muted);margin-top:6px;">' + legend + '</div>'
    + window._ficheRenderer_buildBilanMatiereHtml(o.orderNum);
  return ficheShell({ variant: 'a1', id: uid, title: '📋 Fiche de stock A1 — ' + escapeHtml(o.orderNum) + (nbGrumes ? ' (' + nbGrumes + ' grume(s))' : ''), content: tableHtml });
};

/* ─────────────────────────────────────────────
   buildBilanMatiereHtml — bilan volume d'un OF, affiché sous la fiche A1
   ─────────────────────────────────────────────
   entrant = semi-finis + dosses + chutes (invariant du registre).

   Sans données de registre on n'affiche RIEN : un « 0,0000 » se lirait comme une
   mesure à zéro, ce qui serait faux. `gm.volume` étant stocké à 4 décimales, un
   écart de l'ordre du centième de litre est de l'arrondi de stockage, pas une
   anomalie — d'où le seuil, sinon la fiche alerterait en permanence. */

window._ficheRenderer_buildBilanMatiereHtml = function (ofNum) {
  var MM = (typeof window !== 'undefined') ? window.mouvementsManager : null;
  if (!MM || typeof MM.bilanOF !== 'function' || !ofNum) return '';
  var b = null;
  try { b = MM.bilanOF(ofNum); } catch (e) { return ''; }
  if (!b || !(parseFloat(b.entrant) > 0)) return '';

  var SEUIL_ECART = 0.001;
  var m3 = function (v) { return (parseFloat(v) || 0).toFixed(4).replace('.', ','); };
  var pct = function (v) { return (parseFloat(v) || 0).toFixed(1).replace('.', ','); };
  var ecart = Math.abs(parseFloat(b.ecart) || 0);

  var lignes = [
    ['Entrant (grumes)', m3(b.entrant)],
    ['Semi-finis', m3(b.semiFini)],
    ['Dosses', m3(b.dosses)],
    ['Utile', m3(b.utile)],
    ['Chutes — pertes de lame', m3(b.chutes)]
  ];
  var corps = lignes.map(function (l) {
    return '<tr style="border-bottom:1px solid var(--border-color);">'
      + '<td style="padding:4px 2px;color:var(--text-muted);">' + escapeHtml(l[0]) + '</td>'
      + '<td style="padding:4px 2px;text-align:right;font-weight:700;">' + escapeHtml(l[1]) + ' m³</td></tr>';
  }).join('');

  var alerte = '';
  if (ecart > SEUIL_ECART) {
    alerte = '<div class="warning-box" style="margin-top:8px;font-size:11px;">'
      + '⚠️ <b>Écart de bilan de ' + escapeHtml(m3(ecart)) + ' m³</b> — le volume sorti ne couvre '
      + 'pas la grume entrée. Vérifier la longueur de découpe de l\'OF.</div>';
  }

  /* Rendement PF (semi-finis / grumes) et dosses affichées SÉPARÉMENT :
     la dosse n'est pas du produit, elle relève d'une récupération potentielle
     (décision CEO 08/10/2026 — voir mouvements-manager.js, bilanPoste). */
  var dossesPct = b.entrant > 0 ? (parseFloat(b.dosses) || 0) / b.entrant * 100 : 0;
  return '<div style="margin-top:10px;border-top:1px solid var(--border-color);padding-top:8px;">'
    + '<div style="font-size:11px;font-weight:700;margin-bottom:6px;">Bilan matière — ' + escapeHtml(String(ofNum)) + '</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:11px;"><tbody>' + corps + '</tbody></table>'
    + '<div style="font-size:11px;margin-top:6px;">Rendement PF <b>' + escapeHtml(pct(b.rendement))
    + ' %</b> · dosses <b>' + escapeHtml(pct(dossesPct)) + ' %</b> · pertes de lame <b>' + escapeHtml(pct(b.pertePct)) + ' %</b></div>'
    + alerte
    + '</div>';
};

/* ─────────────────────────────────────────────
   buildCcFicheHtml — fiche CC (centre centrales)
   Extrait: app.js lignes 1588-1632
   ───────────────────────────────────────────── */

window._ficheRenderer_buildCcFicheHtml = function(line, machine) {
  var o = getLineOrder(line);
  var info = window.ofLogic.ccMachineInfo(o);
  var title = 'Découpe CC';
  if (!info) return '';
  if (!info.b) return buildMachineFicheShell(line, machine, title, '<div class="warning-box" style="margin-top:6px;">⚠️ Largeur B du centre non saisie.</div>', '', null);
  if (info.n < 1) return buildMachineFicheShell(line, machine, title, '<div class="warning-box" style="margin-top:6px;">⚠️ B=' + info.b + 'mm > largeur grume ' + o.logWidth + 'mm.</div>', '', null);
  var spec = MACHINE_SPECS[machine] || null;
  var stack = info.n * info.b + (info.n - 1) * DISK_THICKNESS;
  var warnsHtml = '';
  if (spec && info.h > spec.openingH) warnsHtml += '<div class="warning-box" style="margin-top:8px;">⚠️ Épaisseur ' + info.h + 'mm > ouverture ' + spec.openingH + 'mm.</div>';
  if (spec && stack > spec.arbor) warnsHtml += '<div class="warning-box" style="margin-top:8px;">⚠️ Empilement ' + stack + 'mm > axe ' + spec.arbor + 'mm.</div>';
  var usedEff = info.n * info.b + (info.n - 1) * DISK_THICKNESS + (info.extraB ? DISK_THICKNESS + info.extraB : 0);
  var chuteEff = +(o.logWidth - usedEff).toFixed(1);
  var needs = needsForCombos([comboArray(info.b, machine)], info.n * ARBORS_PER_SAW);
  if (info.extraB) {
    var extraNeeds = needsForCombos([comboArray(info.extraB, machine)], ARBORS_PER_SAW);
    Object.keys(extraNeeds).forEach(function(s) { needs[s] = (needs[s] || 0) + extraNeeds[s]; });
  }
  /* ── CC secondaire (central2) ── */
  var info2 = null;
  if (o.central2 && parseFloat(o.central2) > 0) {
    /* Recalculer pour l'épaisseur central2 */
    var o2 = {};
    for (var k in o) { o2[k] = o[k]; }
    o2.central = o.central2;
    /* Utiliser la largeur CC secondaire si disponible */
    if (o.ccWidths && o.ccWidths.length > 1) o2.centerWidth = o.ccWidths[1];
    info2 = window.ofLogic.ccMachineInfo(o2);
    if (info2 && info2.n > 0) {
      var stack2 = info2.n * info2.b + (info2.n - 1) * DISK_THICKNESS;
      if (spec && info2.h > spec.openingH) warnsHtml += '<div class="warning-box" style="margin-top:8px;">⚠️ Épaisseur CC2 ' + info2.h + 'mm > ouverture ' + spec.openingH + 'mm.</div>';
      if (spec && stack2 > spec.arbor) warnsHtml += '<div class="warning-box" style="margin-top:8px;">⚠️ Empilement CC2 ' + stack2 + 'mm > axe ' + spec.arbor + 'mm.</div>';
      var extraNeeds2 = needsForCombos([comboArray(info2.b, machine)], info2.n * ARBORS_PER_SAW);
      Object.keys(extraNeeds2).forEach(function(s) { needs[s] = (needs[s] || 0) + extraNeeds2[s]; });
    }
  }
  lastSlotInstall = { line: line, machine: machine, needs: needs };
  var ccName = pieceDesignation(info.h, info.b);
  var rows = '<table class="result-table">'
    + '<tr><td>Pièces reçues (A1)</td><td><b>2 × Centre ' + info.h + '×' + o.logWidth + 'mm</b> (' + ARBORS_PER_SAW + ' arbres)</td></tr>'
    + '<tr><td>Refendage CC</td><td><b>2 × ' + info.n + ' × ' + info.b + 'mm</b> · ' + escapeHtml(ccName) + '</td></tr>'
    + (info.extraB ? '<tr><td>💡 Pièce rentable sur le reste</td><td><b>2 × 1 × ' + info.extraB + 'mm</b> · ' + escapeHtml(pieceDesignation(info.h, info.extraB)) + ' — chute réduit à ' + chuteEff + 'mm</td></tr>' : '')
    + '<tr><td>Cale CC</td><td><b>' + getCombination(info.b, machine) + ' mm × ' + (info.n * ARBORS_PER_SAW) + (info.extraB ? ' + ' + getCombination(info.extraB, machine) + ' mm × ' + ARBORS_PER_SAW : '') + '</b></td></tr>';
  /* ── Ligne CC secondaire ── */
  if (info2 && info2.n > 0) {
    var cc2Name = pieceDesignation(info2.h, info2.b);
    rows += '<tr style="background:rgba(59,130,246,.05);border-top:2px solid rgba(59,130,246,.3);">'
      + '<td>CC SECONDAIRE</td>'
      + '<td><b>2 × ' + info2.n + ' × ' + info2.b + 'mm</b> · ' + escapeHtml(cc2Name) + '</td></tr>'
      + '<tr style="background:rgba(59,130,246,.05);"><td>Cale CC2</td>'
      + '<td><b>' + getCombination(info2.b, machine) + ' mm × ' + (info2.n * ARBORS_PER_SAW) + '</b></td></tr>';
  }
  rows += '<tr><td>Chute / déchet</td><td><b>' + chuteEff + ' mm</b></td></tr></table>';
  var rowLabel = 'Cant central → CC';
  var mkRow = function(label) {
    var pieces = [];
    for (var i = 0; i < info.n; i++) pieces.push({ b: info.b, color: '#4a8a4f' });
    if (info.extraB) pieces.push({ b: info.extraB, color: '#c98f52' });
    return { label: label, initialW: o.logWidth, h: info.h, margin: info.margin, pieces: pieces, chute: chuteEff };
  };
  var diagram = buildRipDiagram([mkRow(rowLabel + ' — pièce 1'), mkRow(rowLabel + ' — pièce 2')]);
  return buildMachineFicheShell(line, machine, title, rows, diagram, needs, warnsHtml);
};

/* ─────────────────────────────────────────────
   buildSbFicheHtml — fiche SB (latérales)
   Extrait: app.js lignes 1634-1682
   ───────────────────────────────────────────── */

window._ficheRenderer_buildSbFicheHtml = function(line, machine) {
  var o = getLineOrder(line);
  var infos = window.ofLogic.sbMachineInfo(o);
  var title = 'Découpe SB';
  var missing = infos.filter(function(i) { return !i.b; });
  var impossible = infos.filter(function(i) { return i.b && i.n < 1; });
  if (missing.length) return buildMachineFicheShell(line, machine, title, '<div class="warning-box" style="margin-top:6px;">⚠️ Largeurs B des latérales manquantes.</div>', '', null);
  if (impossible.length) return buildMachineFicheShell(line, machine, title, '<div class="warning-box" style="margin-top:6px;">⚠️ Largeur B > largeur grume.</div>', '', null);
  var spec = MACHINE_SPECS[machine] || null;
  var warnsHtml = '';
  infos.forEach(function(i) {
    var stk = i.n * i.b + (i.n - 1) * DISK_THICKNESS;
    if (spec && i.h > spec.openingH) warnsHtml += '<div class="warning-box" style="margin-top:8px;">⚠️ Épaisseur SB ' + i.h + 'mm > ouverture ' + spec.openingH + 'mm.</div>';
    if (spec && stk > spec.arbor) warnsHtml += '<div class="warning-box" style="margin-top:8px;">⚠️ Empilement SB ' + stk + 'mm > axe ' + spec.arbor + 'mm.</div>';
  });
  var combosNeeded = [];
  infos.forEach(function(i) { for (var k = 0; k < i.n; k++) combosNeeded.push(comboArray(i.b, machine)); });
  var needs = needsForCombos(combosNeeded, ARBORS_PER_SAW);
  lastSlotInstall = { line: line, machine: machine, needs: needs };
  var rows = '<table class="result-table">'
    + '<tr><td>Pièces reçues (A1)</td><td><b>' + infos.length + ' latérale(s) SB × ' + ARBORS_PER_SAW + ' arbres</b></td></tr>';
  infos.forEach(function(i) {
    rows += '<tr><td>Refendage SB ' + i.h + 'mm</td><td><b>' + (i.n * ARBORS_PER_SAW) + ' × ' + i.b + 'mm · CH ' + i.chute + 'mm</b> · ' + escapeHtml(pieceDesignation(i.h, i.b)) + '</td></tr>';
  });
  infos.forEach(function(i) {
    rows += '<tr><td>Cale SB ' + i.h + 'mm</td><td><b>' + getCombination(i.b, machine) + ' mm × ' + (i.n * ARBORS_PER_SAW) + '</b></td></tr>';
  });
  rows += '</table>';
  var rowsDiagram = [];
  infos.forEach(function(i) {
    for (var p = 1; p <= ARBORS_PER_SAW; p++) {
      var pieces = [];
      for (var k = 0; k < i.n; k++) pieces.push({ b: i.b, color: '#c98f52' });
      rowsDiagram.push({ label: 'SB ' + i.h + 'mm (pièce ' + p + ')', initialW: o.logWidth, h: i.h, margin: i.margin, pieces: pieces, chute: i.chute });
    }
  });
  var diagram = buildRipDiagram(rowsDiagram);
  return buildMachineFicheShell(line, machine, title, rows, diagram, needs, warnsHtml);
};

/* ─────────────────────────────────────────────
   buildDossesFicheHtml — fiche dosses (récup)
   Extrait: app.js lignes 1684-1708
   ───────────────────────────────────────────── */

window._ficheRenderer_buildDossesFicheHtml = function(line, machine) {
  var o = getLineOrder(line);
  var pat = line === 'A' ? lastPatternA : lastPatternB;
  var chute = (o && o.chute) || (pat && pat.outerRings) || 0;
  var dosseCount = (o && o.dosses && o.dosses.count) ? o.dosses.count : (chute > 0 ? 2 : 0);
  var perDosse = chute > 0 && dosseCount > 0 ? +(chute / dosseCount).toFixed(1) : 0;
  var dosseEp = (o && o.dosses && o.dosses.epaisseur) ? o.dosses.epaisseur : DISK_THICKNESS;
  var dosseLarg = (o && o.dosses && o.dosses.largeur) ? o.dosses.largeur : (perDosse > 0 ? perDosse : '');
  var title = 'Récupération dosses';
  var spec = MACHINE_SPECS[machine] || null;
  lastSlotInstall = { line: line, machine: machine, needs: null };
  var warnsHtml = '';
  if (spec && perDosse > spec.arbor) warnsHtml += '<div class="warning-box" style="margin-top:8px;">⚠️ Dosse ' + perDosse + 'mm > axe ' + spec.arbor + 'mm.</div>';
  var rows = '<table class="result-table">'
    + '<tr><td>Dosses restantes</td><td><b>' + dosseCount + ' dosse(s)</b></td></tr>'
    + '<tr><td>Ép. dosse</td><td><b>' + dosseEp + ' mm</b></td></tr>'
    + '<tr><td>Larg. dosse</td><td><b>' + dosseLarg + ' mm</b></td></tr>'
    + '<tr><td>Récupération</td><td><b>Horizontal (comme A1)</b></td></tr>'
    + '<tr><td>Déchet</td><td><b>' + chute + ' mm</b></td></tr>'
    + '<tr><td>Par dosse / axe</td><td><b>≈ ' + perDosse + ' mm</b></td></tr></table>';
  return buildMachineFicheShell(line, machine, title, rows, buildDossesDiagram(chute, dosseCount), null, warnsHtml);
};

/* ─────────────────────────────────────────────
   buildMachineFicheHtml — dispatcher fiches
   Extrait: app.js lignes 1710-1717
   ───────────────────────────────────────────── */

window._ficheRenderer_buildMachineFicheHtml = function(line, n) {
  var o = getLineOrder(line);
  if (!o) return '';
  if (n === '2') return window._ficheRenderer_buildCcFicheHtml(line, line + '2');
  if (n === '3') return window._ficheRenderer_buildSbFicheHtml(line, line + '3');
  if (n === '4') return window._ficheRenderer_buildDossesFicheHtml(line, line + '4');
  return '';
};

/* ─────────────────────────────────────────────
   EXPORT GLOBAL — wrappers compatibles
   ───────────────────────────────────────────── */

/* ─────────────────────────────────────────────
   Fiche de production au niveau OF — 5 blocs
   Alimentée par le registre, jamais par des cotes recalculées : la fiche
   dit ce qui est SORTI de la machine, pas ce qui aurait dû l'être. Le
   poste est un filtre optionnel — vide = toute la ligne.
   ───────────────────────────────────────────── */

window._ficheRenderer_m4 = function m4(n) {
  return escapeHtml((parseFloat(n) || 0).toFixed(4).replace('.', ','));
};

window._ficheRenderer_horodatage = function horodatage(ts) {
  var s = String(ts || '');
  /* HH:MM — l'opérateur lit l'heure de la machine, pas une date ISO. */
  var m = /T(\d{2}):(\d{2})/.exec(s);
  return m ? (m[1] + ':' + m[2]) : (s.slice(0, 16).replace('T', ' ') || '—');
};

/* Le poste et la nature viennent de Firestore. Comme escapeHtml() (data.js:8)
   passe par textContent -> innerHTML, il n'échappe PAS les guillemets : une
   valeur contenant " fermerait l'attribut class et permettrait d'injecter un
   gestionnaire d'événement. On valide donc le code avant le markup — un poste
   n'est qu'un code machine, une nature qu'un mot du registre. */
window._ficheRenderer_badgePoste = function badgePoste(poste) {
  var p = String(poste || '').toUpperCase();
  if (!/^[A-Z0-9_-]{1,12}$/.test(p)) return '<span class="mach">—</span>';
  return '<span class="mach mach--' + p.toLowerCase() + '">' + escapeHtml(p) + '</span>';
};

window._ficheRenderer_nature = function nature(nat) {
  var cls = String(nat || '').toLowerCase();
  if (!/^[a-z0-9_-]{1,24}$/.test(cls)) return '<span class="nat">—</span>';
  return '<span class="nat nat--' + cls.replace('_', '-') + '">' + escapeHtml(String(nat)) + '</span>';
};

window._ficheRenderer_buildFicheOfHtml = function buildFicheOfHtml(ofNum, poste, line) {
  var MM = (typeof window !== 'undefined') ? window.mouvementsManager : null;
  if (!MM || typeof MM.pourOFPoste !== 'function' || !ofNum) return '';

  var mv;
  try { mv = MM.pourOFPoste(ofNum, poste); } catch (e) { return ''; }
  /* Registre vide ou OF inconnu : RIEN. Un « 0,0000 » se lirait comme une
     mesure à zéro, ce qui serait faux — et un OF saisi avant l'existence du
     registre ne doit surtout pas laisser croire qu'aucune matière n'est sortie. */
  if (!mv || !mv.length) return '';

  var b;
  try { b = MM.bilanPoste(ofNum, poste); } catch (e) { return ''; }
  if (!b) return '';
  /* Aucun retour sur l'entrant, même sans filtre. Un OF « inconnu » est déjà
     couvert par la garde `!mv.length` ci-dessus. Si l'entrant est illisible
     (NaN, undefined, non numérique, négatif), le registre est CORROMPU : c'est
     une anomalie à montrer, pas une fiche à cacher — sinon l'opérateur
     conclura que rien n'est sorti de l'OF. L'alarme est donc armée plus bas. */

  var TOLERANCE = 0.0001;
  /* Un mouvement au volume illisible est un registre CORROMPU. Le bilan le
     ramène à 0 en silence (`parseFloat(m.volume) || 0`), ce qui produirait un
     faux « il manque 0,5000 m³ » : la détection remonte donc au mouvement
     lui-même, avant que le bilan n'ait mangé l'anomalie.
     Un volume NÉGATIF est de même un registre corrompu, pas un écart : il
     est physiquement impossible en scierie et trahit un calcul de découpe
     faux en amont. Le classer « fuite de comptage » enverrait l'opérateur
     chercher une opération manquante alors que le bug est en amont.
     Le reste NÉGATIF, lui, reste une surproduction légitime : c'est le bilan
     qui est bon, c'est la production qui dépasse la matière. */
  var corrupt = mv.some(function (x) {
    if (!x) return true;
    var v = parseFloat(x.volume);
    return !isFinite(v) || v < 0;
  });
  var reste = parseFloat(b.reste) || 0;
  /* Une SURPRODUCTION suppose une matière entrée réelle. Si l'entrant vaut 0
     alors qu'il y a des sorties, ce n'est pas du bois en trop : c'est une
     entrée jamais scannée, donc une opération MANQUANTE. Confondre les deux
     enverrait l'opérateur chercher un excédent de matière qui n'existe pas. */
  var surprod = !corrupt && (parseFloat(b.entrant) || 0) > 0 && reste < -TOLERANCE;
  var noInput = !corrupt && !surprod && !(parseFloat(b.entrant) || 0) > 0
    && (parseFloat(b.utile) || 0) > TOLERANCE;
  var ok = !corrupt && !surprod && Math.abs(parseFloat(b.ecart) || 0) < TOLERANCE;
  var m4 = window._ficheRenderer_m4;
  var h = '';

  /* Bilan matière — l'invariant, en tête de fiche */
  var tot = b.entrant > 0 ? b.entrant : 1;
  /* Un pourcentage non fini produirait « NaN% » dans un attribut style. */
  var pct = function (v) {
    var x = (parseFloat(v) || 0) / tot * 100;
    return isFinite(x) ? x.toFixed(2) : '0.00';
  };
  /* La barre n'a de sens que rapportée à un entrant réel. En filtre par poste
     lentrant vaut souvent 0 (la grume est entrée sur un autre poste) : la
     division par `tot = 1` afficherait un pourcentage sans signification
     (44,15 % de part PF alors que tout est utile). Mieux vaut ne pas
     afficher de barre, et laisser l'équation parler. */
  /* Trois segments aux trois sources de la matière sortante : PF (le produit),
     dosses (récupération potentielle), chutes (pertes de lame). Le taux affiché
     dans chaque segment est sa part de l'entrant — la largeur et le texte
     parlent de la même chose. */
  var bar = b.entrant > 0
    ? '<div class="fb-bar">'
      + '<span class="fb-u" style="width:' + pct(b.semiFini) + '%">'
      + pct(b.semiFini) + ' % PF</span>'
      + (parseFloat(b.dosses) > 0
        ? '<span class="fb-d" style="width:' + pct(b.dosses) + '%">'
          + pct(b.dosses) + ' % dosse</span>'
        : '')
      + '<span class="fb-p" style="width:' + pct(b.chutes) + '%">'
      + m4(b.chutes) + ' m³ perte</span></div>'
    : '';
  h += '<div class="fb">'
    + '<div class="fb-h"><span class="fb-t">Fiche de production</span>'
    + '<span class="fb-of">' + escapeHtml(String(ofNum))
    + (poste ? ' · poste ' + escapeHtml(String(poste).toUpperCase()) : '') + '</span>'
    /* Maquette machines-lignes-v1 : depuis la Fiche d'un poste, on remonte à la
       Fiche de la ligne.Absent sur la Fiche de ligne elle-même — un bouton qui
       mènerait à l'écran déjà affiché serait un piège. */
    + (poste && line ? '<button type="button" class="fb-open" onclick="openProdFiche()">Voir la fiche de la ligne '
      + escapeHtml(String(line).toUpperCase()) + ' ›</button>' : '') + '</div>'
    + bar
    + '<div class="fb-eq' + (ok ? '' : ' fb-eq--ko') + '">'
    + m4(b.entrant) + ' m³ entrant = ' + m4(b.utile) + ' utile + ' + m4(b.chutes)
    + ' perte · reste = <b>' + m4(reste) + '</b> · écart = <b>'
    + m4(Math.abs(b.ecart)) + '</b> m³</div>'
    + '<div class="fb-note">Rendement = cubage nominal des pièces sorties (avant retrait de sciage) ; les dosses sont un reste, hors rendement.</div></div>';

  /* 1 · Grumes lancées */
  h += '<div class="blk"><div class="blk-h"><span class="blk-n">1 · Grumes lancées</span>'
    + '<span class="blk-c">' + b.grumes + ' grume' + (b.grumes > 1 ? 's' : '')
    + ' · ' + m4(b.entrant) + ' m³</span></div><table class="tbl"><thead><tr>'
    + '<th>Code</th><th class="num">Ø mm</th><th class="num hide-xs">Long. m</th>'
    + '<th class="num">Volume m³</th><th class="hide-xs">Poste</th>'
    + '<th class="num hide-xs">Heure</th></tr></thead><tbody>';
  mv.forEach(function (m) {
    if (!m || m.nature !== 'GRUME_ENTREE') return;
    var code = String(m.grumeCode || '');
    /* grumeDia est en CENTIMÈTRES (mouvements-manager.js) : la colonne est
       intitulée « Ø mm », la valeur doit donc être convertie (×10). */
    var diaMm = Math.round((parseFloat(m.grumeDia) || 0) * 10);
    /* longueurM : longueur de la grume en MÈTRES, distincte du champ `longueur`
       des pièces (mm). Absente → « — ». */
    var longM = parseFloat(m.longueurM) || 0;
    h += '<tr><td class="ref">' + escapeHtml(code || 'sans code') + '</td>'
      + '<td class="num">' + (diaMm > 0 ? diaMm : '—') + '</td>'
      + '<td class="num hide-xs">' + (longM > 0 ? String(Math.round(longM * 100) / 100).replace('.', ',') : '—') + '</td>'
      + '<td class="num">' + m4(m.volume) + '</td>'
      + '<td class="hide-xs">' + window._ficheRenderer_badgePoste(m.machine) + '</td>'
      + '<td class="num hide-xs ts">' + escapeHtml(window._ficheRenderer_horodatage(m.ts)) + '</td></tr>';
  });
  h += '</tbody></table></div>';

  /* 2 · Pièces sortantes — regroupées par référence */
  var refs = {}, ordre = [];
  mv.forEach(function (m) {
    if (!m || m.nature !== 'SEMI_FINI') return;
    var lib = String(m.item || '—');
    if (!refs[lib]) {
      refs[lib] = {
        poste: m.machine, qty: 0, vol: 0,
        epaisseur: parseFloat(m.epaisseur) || 0,
        largeur: parseFloat(m.largeur) || 0,
        grumes: {}
      };
      ordre.push(lib);
    }
    refs[lib].qty += (parseFloat(m.qty) || 0);
    refs[lib].vol += (parseFloat(m.volume) || 0);
    refs[lib].grumes[String(m.grumeCode || '')] = 1;
  });
  h += '<div class="blk"><div class="blk-h"><span class="blk-n">2 · Pièces sortantes</span>'
    + '<span class="blk-c">' + b.pieces + ' pièce' + (b.pieces > 1 ? 's' : '')
    + ' · ' + m4(b.semiFini) + ' m³</span></div>';
  if (ordre.length) {
    h += '<table class="tbl"><thead><tr><th>Référence</th><th class="hide-xs">Donnée technique</th>'
      + '<th class="num">Qté</th><th class="hide-xs">Poste</th><th class="num hide-xs">Grumes</th>'
      + '<th class="num">Volume m³</th></tr></thead><tbody>';
    ordre.forEach(function (k) {
      var r = refs[k];
      /* Cotes de la première pièce portant cette référence : le bloc 2 regroupe
         par référence, or une référence change d'épaisseur d'une passe à
         l'autre. On affiche les cotes de la première occurrence, qui est celle
         qui a produit le volume cumulé. */
      var dims = (r.epaisseur > 0 && r.largeur > 0)
        ? (Math.round(r.epaisseur * 10) / 10) + ' × ' + (Math.round(r.largeur * 10) / 10) + ' mm'
        : '—';
      h += '<tr><td class="ref">' + escapeHtml(k) + '</td>'
        + '<td class="hide-xs">' + dims + '</td>'
        + '<td class="num">' + (Math.round(r.qty * 100) / 100) + '</td>'
        + '<td class="hide-xs">' + window._ficheRenderer_badgePoste(r.poste) + '</td>'
        + '<td class="num hide-xs">' + Object.keys(r.grumes).length + '</td>'
        + '<td class="num">' + m4(r.vol) + '</td></tr>';
    });
    h += '</tbody></table>';
  } else {
    h += '<div class="tbl-empty">Aucune pièce semi-fini sortie sur cet OF.</div>';
  }
  h += '</div>';

  /* 3 · Dosses — isolées, avec le rappel isDosse */
  var dos = mv.filter(function (m) { return m && m.nature === 'DOSSE'; });
  h += '<div class="blk"><div class="blk-h"><span class="blk-n">3 · Dosses</span>'
    + '<span class="blk-c">' + dos.length + ' · ' + m4(b.dosses) + ' m³</span></div>';
  if (dos.length) {
    h += '<table class="tbl"><thead><tr><th class="hide-xs">Référence</th><th>Donnée technique</th>'
      + '<th class="hide-xs">Poste</th><th class="hide-xs">Grume</th>'
      + '<th class="num">Volume m³</th></tr></thead><tbody>';
    dos.forEach(function (m) {
      h += '<tr><td class="ref hide-xs">' + escapeHtml(String(m.item || 'DOSSE')) + '</td>'
        + '<td>' + (Math.round((parseFloat(m.epaisseur) || 0) * 10) / 10) + ' × '
        + (Math.round((parseFloat(m.largeur) || 0) * 10) / 10) + ' mm</td>'
        + '<td class="hide-xs">' + window._ficheRenderer_badgePoste(m.machine) + '</td>'
        + '<td class="hide-xs">' + escapeHtml(String(m.grumeCode || 'sans code')) + '</td>'
        + '<td class="num">' + m4(m.volume) + '</td></tr>';
    });
    h += '</tbody></table>';
  } else {
    h += '<div class="tbl-empty">Aucune dosse valorisée sur cet OF.</div>';
  }
  h += '<div class="fb-alert">Le champ <b>isDosse</b> doit être écrit à la création du '
    + 'semi-fini : sans lui la dosse n\'est pas distinguée d\'un produit et la machine '
    + 'de récupération devient <b>invisible</b> dans le registre.</div></div>';

  /* 4 · Chutes et pertes — le reste porte le SENS de l'écart */
  h += '<div class="blk"><div class="blk-h"><span class="blk-n">4 · Chutes et pertes</span>'
    + '<span class="blk-c">' + m4(b.chutes) + ' m³ perte</span></div>'
    + '<table class="tbl"><tbody>'
    + '<tr><td class="ref">Pertes de lame</td><td class="hide-xs">aire non valorisée × longueur</td>'
    + '<td class="hide-xs">—</td><td class="num">' + m4(b.chutes) + '</td></tr>'
/* Un reste négatif n'est PAS « du bois à imputer » : c'est du bois
       PRODUIT sans matière entrante correspondante. Garder le même libellé
       dans les deux lectures était exactement l'ambiguïté d'affichage signalée
       par la revue du Task 2 — l'alarme sonnait, mais l'opérateur n'avait pas
       de mot pour ce qu'il regardait. */
    + (surprod
      ? '<tr class="is-surprod"><td class="ref">SURPRODUCTION</td>'
        + '<td class="hide-xs">les sorties dépassent la matière entrée</td>'
        + '<td class="hide-xs">—</td><td class="num">' + m4(reste) + '</td></tr>'
      : (noInput
        ? '<tr class="is-noinput"><td class="ref">SORTIE SANS ENTRÉE</td>'
          + '<td class="hide-xs">aucune matière entrée sur cet OF</td>'
          + '<td class="hide-xs">—</td><td class="num">' + m4(reste) + '</td></tr>'
        : '<tr><td class="ref">RESTE à imputer</td>'
          + '<td class="hide-xs">entrant − utile − pertes</td>'
          + '<td class="hide-xs">—</td><td class="num">' + m4(reste) + '</td></tr>'))
    + '</tbody></table>'
    /* Trois causes distinctes, trois messages distincts. Les confondre
       envoie l'opérateur chercher la mauvaise chose :
       — registre corrompu  : le bilan est faux, il ne peut pas être rapporté ;
       — surproduction       : le bilan est BON, c'est la production qui dépasse
         la matière. Aucune ligne CHUTE n'est écrite (l'écrire ramènerait
         l'écart à zéro et éteindrait cette alarme) : c'est donc le reste
         négatif, nommé comme tel, qui porte le signal ;
       — fuite de comptage   : il manque réellement une opération au registre. */
    + (ok ? '' : (corrupt
      ? '<div class="fb-alert fb-alert--ko"><b>Registre illisible sur cet OF.</b> '
        + 'Un volume de mouvement est illisible ou négatif : le bilan ci-dessus est '
        + 'faux et ne peut pas être rapporté. Corriger le mouvement avant de valider la fiche.</div>'
      : (surprod
        ? '<div class="fb-alert fb-alert--ko"><b>Surproduction.</b> '
          + m4(Math.abs(reste)) + ' m³ sortent sans matière entrante correspondante. '
          + 'Les pertes affichées restent à ' + m4(b.chutes) + ' m³ : vérifier le débit '
          + 'et les cotes de découpe de cet OF, ou la matière entrée a été sous-évaluée.</div>'
        : (noInput
          ? '<div class="fb-alert fb-alert--ko"><b>Sortie sans entrée.</b> '
            + m4(Math.abs(reste)) + ' m³ sont sortis alors qu\'aucune matière n\'a été '
            + 'entrée sur cet OF. L\'entrée de la grume n\'a pas été scannée : '
            + 'la lancer avant de valider la fiche.</div>'
          : '<div class="fb-alert fb-alert--ko"><b>Fuite de comptage.</b> '
            + m4(reste) + ' m³ ne sont ni valorisés ni perdus. Une opération manque au registre.</div>'))))
    + '</div>';

  /* 5 · Journal — append-only, l'intégralité des lignes */
  h += '<div class="blk"><div class="blk-h"><span class="blk-n">5 · Journal des mouvements</span>'
    + '<span class="blk-c">' + mv.length + ' ligne' + (mv.length > 1 ? 's' : '') + ' · append-only</span></div>'
    + '<table class="tbl"><thead><tr><th class="num">Heure</th><th class="hide-xs">Poste</th>'
    + '<th>Grume</th><th>Nature</th><th class="hide-xs">Détail</th><th class="num hide-xs">Stock</th>'
    + '<th class="num">Volume m³</th></tr></thead><tbody>';
  mv.forEach(function (m) {
    if (!m) return;
    h += '<tr><td class="num ts">' + escapeHtml(window._ficheRenderer_horodatage(m.ts)) + '</td>'
      + '<td class="hide-xs">' + window._ficheRenderer_badgePoste(m.machine) + '</td>'
      + '<td class="ref">' + escapeHtml(String(m.grumeCode || '—')) + '</td>'
      + '<td>' + window._ficheRenderer_nature(m.nature) + '</td>'
      + '<td class="hide-xs">' + escapeHtml(String(m.item || '—')) + '</td>'
      + '<td class="num hide-xs">' + escapeHtml(String(m.stock || '—')) + '</td>'
      + '<td class="num">' + m4(m.volume) + '</td></tr>';
  });
  h += '</tbody></table></div>';

  return '<div class="fiche">' + h + '</div>';
};

/* ─────────────────────────────────────────────
   Comparatif A/B — la preuve que le même plan de fiche fonctionne sur les
   deux lignes, sans code dupliqué.
   ───────────────────────────────────────────── */

window._ficheRenderer_buildComparaisonHtml = function buildComparaisonHtml() {
  if (typeof getLineOrder !== 'function') return '';
  var MM = (typeof window !== 'undefined') ? window.mouvementsManager : null;
  if (!MM || typeof MM.bilanOF !== 'function') return '';
  var m4 = window._ficheRenderer_m4;

  function ligneHtml(l) {
    var o;
    try { o = getLineOrder(l); } catch (e) { o = null; }
    if (!o) {
      return '<tr><td>' + escapeHtml(l) + '</td><td colspan="7" class="tbl-empty">'
        + 'Aucun OF en cours sur la ligne ' + escapeHtml(l) + '</td></tr>';
    }
    var b;
    try { b = MM.bilanOF(o.orderNum); } catch (e) { b = null; }
    if (!b || !(parseFloat(b.entrant) > 0)) {
      return '<tr><td>' + escapeHtml(l) + '</td><td class="ref">'
        + escapeHtml(String(o.orderNum || '')) + '</td>'
        + '<td colspan="6" class="tbl-empty">Aucun mouvement enregistré</td></tr>';
    }
    return '<tr><td>' + window._ficheRenderer_badgePoste(l + '1') + '</td>'
      + '<td class="ref">' + escapeHtml(String(o.orderNum || '')) + '</td>'
      + '<td class="num">' + b.grumes + '</td>'
      + '<td class="num">' + m4(b.entrant) + '</td>'
      + '<td class="num">' + m4(b.utile) + '</td>'
      + '<td class="num">' + m4(b.chutes) + '</td>'
      + '<td class="num">' + m4(b.rendement) + ' %</td>'
      + '<td class="num">' + m4(Math.abs(b.ecart)) + '</td></tr>';
  }

  return '<div class="blk"><div class="blk-h"><span class="blk-n">Les deux lignes</span>'
    + '<span class="blk-c">même plan de fiche · même registre</span></div>'
    + '<table class="tbl"><thead><tr><th>Ligne</th><th>OF</th><th class="num">Grumes</th>'
    + '<th class="num">Entrant m³</th><th class="num">Utile m³</th><th class="num">Perte m³</th>'
    + '<th class="num">Rend. PF</th><th class="num">Écart</th></tr></thead><tbody>'
    + ligneHtml('A') + ligneHtml('B')
    + '</tbody></table></div>';
};

window.ficheRenderer = {
  buildFicheSciageHtml: window._ficheRenderer_buildFicheSciageHtml,
  buildCcFicheHtml: window._ficheRenderer_buildCcFicheHtml,
  buildSbFicheHtml: window._ficheRenderer_buildSbFicheHtml,
  buildDossesFicheHtml: window._ficheRenderer_buildDossesFicheHtml,
  buildMachineFicheHtml: window._ficheRenderer_buildMachineFicheHtml,
  buildBilanMatiereHtml: window._ficheRenderer_buildBilanMatiereHtml,
  buildFicheOfHtml: window._ficheRenderer_buildFicheOfHtml,
  buildComparaisonHtml: window._ficheRenderer_buildComparaisonHtml
};
