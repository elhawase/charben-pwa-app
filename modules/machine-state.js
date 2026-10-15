/**
 * MACHINE-STATE.JS — État unifié par machine + lignes de production + fiche plein écran.
 *
 * Principes :
 *  - AUCUN calcul métier réécrit : on lit of-logic / sciage-logic / yield-helpers.
 *  - AUCUNE cote fictive : les schémas sont dérivés de l'OF réellement lancé.
 *  - La caméra n'est jamais détruite : la fiche plein écran vit dans un overlay
 *    séparé, et le bloc grume n'est re-rendu que par mise à jour ciblée.
 */
'use strict';

/* Vocabulaire de la maquette machines-lignes-v1.html. Le libellé est ce que
   l'opérateur lit sur la ligne, pas un terme de base de données : « En marche »
   se lit, « En fonctionnement » se décodait. */
var MACHINE_STATE_STATUS_DEFAULT = 'En marche';

var MACHINE_STATE_STATUSES = ['En marche', 'À l\'arrêt', 'En réglage', 'Maintenance'];

var MACHINE_STATE_STATUS_COLORS = {
  'En marche': '#10b981',
  'À l\'arrêt': '#ef4444',
  'En réglage': '#f59e0b',
  'Maintenance': '#3b82f6'
};

/* Les statuts sont choisis par l'opérateur et persistés dans
   charben_machine_status_<ligne>_<poste>. Changer le vocabulaire ne doit pas
   laisser un poste afficher un état inconnu : on traduit à la lecture. */
var MACHINE_STATE_STATUS_MIGRATION = {
  'En fonctionnement': 'En marche',
  'En maintenance': 'Maintenance',
  'Panne': 'À l\'arrêt'
};

window._machineState_statut = function statut(st) {
  if (!st) return MACHINE_STATE_STATUS_DEFAULT;
  if (MACHINE_STATE_STATUS_COLORS[st]) return st;
  return MACHINE_STATE_STATUS_MIGRATION[st] || MACHINE_STATE_STATUS_DEFAULT;
};

var MACHINE_STATE_LABELS = {
  '1': 'Débit épaisseurs',
  '2': 'Calibrage CC',
  '3': 'Déligneuse SB',
  '4': 'Récup. dosses'
};

var MACHINE_STATE_ICONS = {
  '1': 'tree-pine',
  '2': 'ruler',
  '3': 'split',
  '4': 'recycle'
};

/* Vocabulaire de la maquette validée machines-lignes-v1.html : « Calibrage CC »
   et « Déligneuse SB » portent la distinction CC/SB, qui decide de l'economie
   d'echelle. Ne pas la remplacer par un libelle de flux qui l'effacerait. */
var MACHINE_STATE_ROLES = {
  '1': 'Débit épaisseurs',
  '2': 'Calibrage CC',
  '3': 'Déligneuse SB',
  '4': 'Récup. dosses'
};

/* MACHINE_STATE_PILLS supprimé : il décrivait la NATURE DE LA PRODUCTION
   (« Produit · CC », « Bloc »). Au niveau 1 on veut l'état RÉEL de la machine.
   La ligne affiche désormais la pastille de statut ; la nature de ce qui
   sort se lit dans la Fiche de production. */

/* Rang 1..4 déduit du code machine (A1..B4) — évite les diagrammes identiques. */
window._machineState_slotOf = function(code) {
  var n = parseInt(String(code).slice(1), 10);
  return (n >= 1 && n <= 4) ? n : 0;
};

function machineStateEscape(v) {
  return (typeof escapeHtml === 'function') ? escapeHtml(String(v)) : String(v);
}

/* ─────────────────────────────────────────────
   Besoins en cales réels par machine
   ───────────────────────────────────────────── */
window._machineState_calesNeed = function(line, slot, o, pat) {
  var machine = line + String(slot);
  try {
    if (slot === 1) {
      return (pat && pat.totalNeeded) ? pat.totalNeeded : {};
    }
    if (slot === 2) {
      var cc = ofLogic.ccMachineInfo(o);
      if (!cc || !cc.b) return {};
      var combos = [comboArray(cc.b, machine)];
      if (cc.extraB) combos.push(comboArray(cc.extraB, machine));
      return needsForCombos(combos, Math.max(1, cc.n) * ARBORS_PER_SAW);
    }
    if (slot === 3) {
      var sbs = ofLogic.sbMachineInfo(o) || [];
      var all = [];
      sbs.forEach(function(s) {
        if (!s.b) return;
        for (var k = 0; k < Math.max(1, s.n); k++) all.push(comboArray(s.b, machine));
      });
      return all.length ? needsForCombos(all, ARBORS_PER_SAW) : {};
    }
    if (slot === 4) {
      var nb = (o.dosses && o.dosses.count) ? o.dosses.count : 0;
      if (!nb) return {};
      return needsForCombos([comboArray(DISK_THICKNESS, machine)], nb);
    }
  } catch (e) { /* aucune donnée exploitable */ }
  return {};
};

/* ─────────────────────────────────────────────
   Segments en mm pour le schéma compact (données réelles)
   ───────────────────────────────────────────── */
window._machineState_segments = function(line, slot, o, pat) {
  var segs = [];
  var disk = parseFloat(DISK_THICKNESS) || 4;
  function push(w, type) {
    var v = parseFloat(w);
    if (v && v > 0) segs.push({ w: v, type: type });
  }
  function diskBetween() { segs.push({ w: disk, type: 'disk' }); }

  if (!o) return segs;

  try {
    if (slot === 1) {
      if (!pat || pat.invalid) return segs;
      var lats = pat.laterals || [];
      push(pat.center, 'cc');
      /* Le CC secondaire est un anneau RÉEL : une lame + sa largeur. */
      if (pat.central2 > 0) { diskBetween(); push(pat.central2, 'cc'); }
      lats.forEach(function(l) { diskBetween(); push(l, 'sb'); });
      diskBetween();
      if (pat.outerRings > 0) push(pat.outerRings, 'sb');
      diskBetween();
      return segs;
    }
    if (slot === 2) {
      var cc = ofLogic.ccMachineInfo(o);
      if (!cc || !cc.b) return segs;
      if (cc.margin) { push(cc.margin, 'margin'); diskBetween(); }
      var made = 0;
      var reps = Math.max(1, Math.min(9, cc.n));
      for (var i = 0; i < reps; i++) {
        if (i > 0) diskBetween();
        push(cc.b, 'cc');
        made++;
      }
      if (cc.extraB) { diskBetween(); push(cc.extraB, 'cc'); }
      var chute = Math.max(0, (cc.chute || 0) - (cc.margin || 0));
      if (chute > 0) push(chute, 'chute');
      return segs;
    }
    if (slot === 3) {
      var sbs = ofLogic.sbMachineInfo(o) || [];
      var margin = (o.margin ? parseFloat(o.margin) : 0);
      if (margin) { push(margin, 'margin'); diskBetween(); }
      sbs.forEach(function(s, si) {
        if (!s.b) return;
        if (si > 0) diskBetween();
        var reps = Math.max(1, Math.min(9, s.n));
        for (var i = 0; i < reps; i++) {
          if (i > 0) diskBetween();
          push(s.b, 'sb');
        }
      });
      var last = sbs[sbs.length - 1];
      var rest = Math.max(0, (last && last.chute ? last.chute : 0) - margin);
      if (rest > 0) push(rest, 'chute');
      return segs;
    }
    if (slot === 4) {
      var chute4 = parseFloat(o.chute) || 0;
      if (chute4 <= 0) return segs;
      var nbD = (o.dosses && o.dosses.count) ? Math.max(1, Math.min(8, o.dosses.count)) : 2;
      var each = chute4 / nbD;
      for (var k = 0; k < nbD; k++) {
        if (k > 0) diskBetween();
        push(each, 'dosse');
      }
      return segs;
    }
  } catch (e) { /* schéma indisponible */ }
  return segs;
};

/* ─────────────────────────────────────────────
   Schéma compact à l'échelle réelle (largeur totale = logWidth)
   ───────────────────────────────────────────── */
window._machineState_miniSchema = function(line, slot, o, pat) {
  var segs = window._machineState_segments(line, slot, o, pat);
  if (!segs.length) {
    var msg = 'Aucun OF lancé';
    if (o) {
      msg = (slot === 1)
        ? 'Réglage du débit non calculé — lancez « Calculer le réglage »'
        : 'Aucune cote B définie sur cet OF';
    }
    return '<div class="ms-schema ms-schema-empty">' + machineStateEscape(msg) + '</div>';
  }
  var W = 300, PAD = 1, H = 26;
  var COLORS = {
    cc: '#3b82f6', sb: '#10b981', dosse: '#f59e0b',
    chute: '#b6602b', margin: '#6b7280', disk: '#374151'
  };
  var total = segs.reduce(function(a, s) { return a + s.w; }, 0);
  var inner = W - PAD * 2;
  var scale = inner / total;
  var parts = [];
  var x = PAD;
  segs.forEach(function(s) {
    var w = Math.max(0.6, s.w * scale);
    var fill = COLORS[s.type] || '#6b7280';
    var label = (s.w >= 1) ? (Math.round(s.w * 10) / 10) : '';
    var narrow = w < 17;
    parts.push(
      '<g>'
      + '<rect x="' + x.toFixed(2) + '" y="' + PAD + '" width="' + w.toFixed(2) + '" height="' + H + '" fill="' + fill + '" opacity="0.88" rx="1"></rect>'
      + (label
        ? (narrow
          ? '<text transform="translate(' + (x + w / 2).toFixed(2) + ',9) rotate(-90)" x="0" y="0" text-anchor="middle" font-size="7.5" fill="#fff" font-weight="700">' + label + '</text>'
          : '<text x="' + (x + w / 2).toFixed(2) + '" y="15.5" text-anchor="middle" font-size="8.5" fill="#fff" font-weight="700">' + label + '</text>')
        : '')
      + '</g>'
    );
    x += w;
  });
  return '<div class="ms-schema"><svg viewBox="0 0 ' + W + ' ' + (H + 2 * PAD) + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Schéma de découpe ' + line + slot + '">'
    + parts.join('')
    + '</svg>'
    + '<div class="ms-schema-cap">barre = ' + window._machineState_fr(total, 'mm') + (o && o.logWidth ? ' · Ø' + window._machineState_fr(parseFloat(o.logWidth)) : '') + '</div>'
    + '</div>';
};

/* ─────────────────────────────────────────────
   Formatage français des cotes
   Virgule décimale + espace avant l'unité, comme le reste de l'app
   (« 94,1667 % utile », « 1,2000 m³ » dans fiche-renderer.js).
   Sans ça la fiche machine affichait « 95.4% » et « 45.2 mm ».
   ───────────────────────────────────────────── */
window._machineState_fr = function(n, unite) {
  if (!(n > 0) && n !== 0) return '—';
  var s = String(Math.round(n * 10) / 10).replace('.', ',');
  return unite ? s + ' ' + unite : s;
};

/* ─────────────────────────────────────────────
   Métrique principale par machine (rendement / cotes)
   ───────────────────────────────────────────── */
window._machineState_metric = function(slot, o, pat) {
  if (!o) return { label: 'Rend.', value: '—' };
  try {
    if (slot === 1) {
      /* Maquette machines-lignes-v1 : A1 affiche le DIAMETRE de la grume
         (452 mm), pas un compte de blocs — le compte de lames reste lisible
         au niveau 2, dans le schema. `logWidth` de l'OF est deja en mm ; on
         replie sur la grume lancee si l'OF ne porte pas de diametre. */
      var mm = parseFloat(o.logWidth) || 0;
      if (!(mm > 0)) {
        try {
          var ln = (typeof dashboardRenderer !== 'undefined' && dashboardRenderer.ofLine)
            ? dashboardRenderer.ofLine(o) : '';
          var lch = (typeof lineLaunchedForOf === 'function' && ln) ? lineLaunchedForOf(ln, o.orderNum) : [];
          if (lch && lch.length) {
            var g = (typeof rawMaterials !== 'undefined' ? rawMaterials : []).filter(function (x) {
              return x && x.code === lch[0].code;
            })[0];
            mm = g ? (parseFloat(g.diametre) || 0) * 10 : (parseFloat(lch[0].widthMm) || 0);
          }
        } catch (e) { mm = 0; }
      }
      if (!(mm > 0)) return { label: 'Rend.', value: '—' };
      return { label: 'Ø mm', value: String(Math.round(mm)) };
    }
    if (slot === 2) {
      var cc = ofLogic.ccMachineInfo(o);
      if (!cc || !cc.b) return { label: 'Rend.', value: '—' };
      var used = cc.n * cc.b + (cc.n - 1) * (parseFloat(DISK_THICKNESS) || 4);
      if (cc.extraB) used += (parseFloat(DISK_THICKNESS) || 4) + cc.extraB;
      var pct = cc.usableW > 0 ? Math.round(used / cc.usableW * 1000) / 10 : 0;
      return { label: 'Rend. utile', value: window._machineState_fr(pct, '%') };
    }
    if (slot === 3) {
      var sbs = ofLogic.sbMachineInfo(o) || [];
      var u = 0, w = 0;
      sbs.forEach(function(s) {
        if (!s.b) return;
        var usedS = s.n * s.b + (s.n - 1) * (parseFloat(DISK_THICKNESS) || 4);
        u += usedS; w += s.usableW;
      });
      var p3 = w > 0 ? Math.round(u / w * 1000) / 10 : 0;
      return { label: 'Rend. utile', value: w > 0 ? window._machineState_fr(p3, '%') : '—' };
    }
    if (slot === 4) {
      var nb = (o.dosses && o.dosses.count) ? o.dosses.count : 0;
      return { label: 'Chute', value: window._machineState_fr(parseFloat(o.chute) || 0, 'mm') };
    }
  } catch (e) { /* métrique indisponible */ }
  return { label: 'Rend.', value: '—' };
};

/* ─────────────────────────────────────────────
   État unifié d'une machine
   ───────────────────────────────────────────── */
window._machineState_get = function(line, slot) {
  var code = line + String(slot);
  var o = getLineOrder(line);
  var pat = (line === 'A') ? lastPatternA : lastPatternB;
  var count = (prodCounters[line] && prodCounters[line][code]) || 0;
  var st = window._machineState_statut(loadFromStorage('charben_machine_status_' + line + '_' + code, MACHINE_STATE_STATUS_DEFAULT));
  var needs = window._machineState_calesNeed(line, slot, o, pat);
  var shortages = [];
  try { shortages = shortagesOf(needs, code); } catch (e) { shortages = []; }
  return {
    line: line,
    slot: slot,
    code: code,
    label: MACHINE_STATE_LABELS[slot] || '',
    icon: MACHINE_STATE_ICONS[slot] || 'settings',
    name: (typeof MACHINE_SLOT_NAMES !== 'undefined' && MACHINE_SLOT_NAMES[code]) || '',
    status: st,
    color: MACHINE_STATE_STATUS_COLORS[st] || '#10b981',
    count: count,
    order: o,
    pattern: pat,
    hasOrder: !!o,
    metric: window._machineState_metric(slot, o, pat),
    shortages: shortages,
    needs: needs
  };
};

/* ─────────────────────────────────────────────
   Niveau 1 — UNE ligne par machine
   Quatre faits, et rien d'autre : identité, rôle, état, un chiffre.
   Le schéma, les cales et le sélecteur d'état vivent au niveau 2.
   Une ligne sans problème est SILENCIEUSE : afficher « cales prêtes » en
   permanence transformerait un écran de pilotage en panneau de décorations.
   ───────────────────────────────────────────── */

window._machineState_m4 = function m4(n) {
  return (parseFloat(n) || 0).toFixed(4).replace('.', ',');
};

window._machineState_tonEtat = function tonEtat(status) {
  var st = window._machineState_statut(status);
  if (st === 'En marche') return 'run';
  if (st === 'À l\'arrêt') return 'down';
  if (st === 'Maintenance') return 'maint';
  return 'warn';
};

window._machineState_row = function row(line, slot) {
  /* `line` est recommende dans une chaine JS a apostrophes, a l'interieur
     d'un onclick/onkeydown. machineStateEscape() n'echappe PAS les
     apostrophes (il passe par textContent -> innerHTML) : on valide donc
     l'invariant plutot que de faire confiance a l'appelant. */
  if (!/^[AB]$/.test(String(line))) line = 'A';
  var s = window._machineState_get(line, slot);
  var ton = window._machineState_tonEtat(s.status);
  var role = MACHINE_STATE_ROLES[slot] || s.label;
  var alertHtml = '';

  if (!s.hasOrder) {
    alertHtml = '<div class="r-alert r-alert--info"><b>ℹ</b><span>Aucun OF lancé sur la ligne '
      + machineStateEscape(line) + '</span></div>';
  } else if (s.shortages.length) {
    alertHtml = '<div class="r-alert"><b>⚠</b><span>Cales '
      + machineStateEscape(s.shortages.join(' et ')) + ' mm manquantes</span></div>';
  }

  var valeur = '<span class="r-val' + (s.hasOrder ? '' : ' r-val--void') + '"><b>'
    + (s.hasOrder ? machineStateEscape(s.metric.value) : '—') + '</b><span>'
    + machineStateEscape(s.metric.label) + '</span></span>';

  return '<div class="ms-row ms-row--' + ton + '" role="button" tabindex="0"'
    + ' data-code="' + machineStateEscape(s.code) + '"'
    + ' aria-label="' + machineStateEscape(s.code + ' ' + role) + '"'
    + ' onclick="openMachineSheet(\'' + machineStateEscape(line) + '\',' + slot + ')"'
    + ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openMachineSheet(\''
      + machineStateEscape(line) + '\',' + slot + ');}">'
    + '<span class="r-code"><i data-lucide="' + machineStateEscape(s.icon) + '" style="width:13px;height:13px;"></i>'
      + machineStateEscape(s.code) + '</span>'
    + '<span class="r-role"><b>' + machineStateEscape(role) + '</b></span>'
    + '<span class="pill pill--' + ton + '">' + machineStateEscape(s.status) + '</span>'
    + valeur
    + '<span class="r-chev" aria-hidden="true">›</span>'
    + '</div>' + alertHtml;
};

/* Le bloc d'une ligne entière : en-tête puis les quatre machines dans l'ordre
   réel de la matière. */
window._machineState_ligneHtml = function ligneHtml(line) {
  var o = getLineOrder(line);
  var MM = (typeof window !== 'undefined') ? window.mouvementsManager : null;
  var rendement = '—';
  var ofNum = o ? String(o.orderNum || '') : '';
  if (MM && typeof MM.bilanOF === 'function' && ofNum) {
    try {
      var b = MM.bilanOF(ofNum);
      if (b && parseFloat(b.entrant) > 0) rendement = window._machineState_m4(b.rendement) + ' %';
    } catch (e) { rendement = '—'; }
  }

  var rows = '';
  for (var k = 1; k <= 4; k++) rows += window._machineState_row(line, k);

  return '<div class="ligne-head">'
    + '<span class="ligne-badge ligne-badge--' + machineStateEscape(line) + '">' + machineStateEscape(line) + '</span>'
    + '<div class="ligne-id"><div class="ligne-n">Ligne ' + machineStateEscape(line) + '</div>'
    + '<div class="ligne-s">' + (ofNum ? 'OF ' + machineStateEscape(ofNum) : 'Aucun OF en cours') + '</div></div>'
    + '<div class="ligne-yield"><b>' + machineStateEscape(rendement) + '</b><span>Rend. PF</span></div>'
    + '</div><div class="ms-rows">' + rows + '</div>';
};

/* Conservé : app.js:1695 et app.js:1704 appellent grid() et ne connaissent
   rien d'autre. La grille 2×2 n'existe plus : une ligne de production = un
   en-tête + quatre lignes. */
window._machineState_grid = function grid(line) {
  return window._machineState_ligneHtml(line);
};

/* ─────────────────────────────────────────────
   Fiche plein écran (overlay séparé — la caméra survit)
   ───────────────────────────────────────────── */
function machineStateOverlay() {
  var ov = document.getElementById('machineSheetOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'machineSheetOverlay';
    ov.className = 'ms-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="ms-sheet" id="machineSheetBody"></div>';
    document.body.appendChild(ov);
  }
  return ov;
}

window._machineState_ficheHtml = function(line, slot) {
  /* Même invariant que dans _machineState_row : `line` est recomposé dans une
     chaîne JS à apostrophes (onchange). machineStateEscape() n'échappe pas les
     apostrophes, on valide donc avant. */
  if (!/^[AB]$/.test(String(line))) line = 'A';
  var s = window._machineState_get(line, slot);
  var o = s.order;
  var pat = s.pattern;
  var html = '<div class="ms-sheet-head">'
    + '<span class="ms-sheet-code"><i data-lucide="' + s.icon + '" style="width:18px;height:18px;"></i>' + s.code + '</span>'
    + '<div class="ms-sheet-tt">'
    + '<div class="ms-sheet-t">' + machineStateEscape(s.label) + '</div>'
    + '<div class="ms-sheet-sub">' + machineStateEscape(s.name) + (s.hasOrder ? ' · OF ' + machineStateEscape(s.order.orderNum || '') : '') + '</div>'
    + '</div>'
    + '<button class="ms-sheet-close" onclick="closeMachineSheet()" aria-label="Fermer">✕</button>'
    + '</div>';

  /* Sélecteur de statut — dans la fiche, pas sur la tuile. */
  var sel = '<div class="ms-statusrow"><label for="msStatusSel">Statut</label><select id="msStatusSel" class="form-input ms-status-sel" onchange="changerStatutMachine(\'' + line + '\',\'' + s.code + '\',this.value)">';
  MACHINE_STATE_STATUSES.forEach(function(st) {
    sel += '<option value="' + st + '"' + (st === s.status ? ' selected' : '') + '>' + st + '</option>';
  });
  sel += '</select><span class="ms-status-pill" style="background:' + s.color + ';">' + machineStateEscape(s.status) + '</span></div>';
  html += sel;

  html += '<div class="ms-sheet-alert ' + (s.shortages.length ? 'is-bad' : 'is-ok') + '">'
    + (s.shortages.length
      ? '⚠️ Cales manquantes : ' + machineStateEscape(s.shortages.join(', ')) + ' mm'
      : (s.hasOrder ? '✅ Cales suffisantes pour ce réglage' : 'Aucun OF en cours sur la ligne'))
    + '</div>';

  /* Schéma de sciage à l'échelle réelle. */
  html += '<div class="ms-sheet-block"><h4>Schéma de découpe</h4>'
    + window._machineState_miniSchema(line, slot, o, pat)
    + '</div>';

  /* Fiches métier existantes — jamais recalculées ici.
     buildMachineFicheHtml attend le rang en CHAÎNE ('2'|'3'|'4') et
     dispatche vers les fiches CC / SB / Dosses qui portent les vrais
     diagrammes (buildRipDiagram / buildDossesDiagram). */
  if (slot > 1 && typeof buildMachineFicheHtml === 'function') {
    html += '<div class="ms-sheet-block"><h4>Fiche machine</h4>' + buildMachineFicheHtml(line, String(slot)) + '</div>';
  }
  if (slot === 1 && typeof buildPatternFicheHtml === 'function') {
    html += '<div class="ms-sheet-block"><h4>Réglage du débit</h4>' + buildPatternFicheHtml(line) + '</div>';
  }
  /* La Fiche de production filtrée sur le poste : c'est ce que la machine a
     réellement sorti, pas ce que l'OF prévoit. Elle remplace le « Détail du
     sciage », qui affichait le réglage prévu sans jamais le confronter au
     réel. */
  if (o && typeof _ficheRenderer_buildFicheOfHtml === 'function') {
    var fiche = _ficheRenderer_buildFicheOfHtml(o.orderNum, s.code, line);
    if (fiche) {
      html += '<div class="ms-sheet-block"><h4>Fiche de production — ' + machineStateEscape(s.code) + '</h4>' + fiche + '</div>';
    }
  }
  if (slot > 1 && typeof buildMachineStockFicheHtml === 'function') {
    html += '<div class="ms-sheet-block"><h4>État des cales</h4>' + buildMachineStockFicheHtml(line, String(slot)) + '</div>';
  }
  return html;
};

window._machineState_open = function(line, slot) {
  var ov = machineStateOverlay();
  var body = document.getElementById('machineSheetBody');
  body.innerHTML = window._machineState_ficheHtml(line, slot);
  ov.classList.add('open');
  document.body.classList.add('ms-open');
  if (typeof renderLucide === 'function') renderLucide();
};

window._machineState_close = function() {
  var ov = document.getElementById('machineSheetOverlay');
  if (ov) ov.classList.remove('open');
  document.body.classList.remove('ms-open');
};

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') window._machineState_close();
});

/* Un seul chemin de mise à jour de l'état : le module répercute sur la ligne,
   sur l'overlay ouvert et sur les icônes. L'UI ne se recharge jamais seule.
   La clé de stockage est inchangée — les états déjà saisis restent lus. */
window._machineState_setStatus = function setStatus(line, slot, statut) {
  var code = line + String(slot);
  /* On normalise avant d'écrire : le select n'offre que les libellés
     courants, mais setStatus est appelable depuis un onclick inline. Stocker
     une valeur inconnue la laisserait hors de tout badge et de toute
     couleur. */
  statut = window._machineState_statut(statut);
  if (typeof saveToStorage === 'function') saveToStorage('charben_machine_status_' + line + '_' + code, statut);
  if (typeof addAuditLog === 'function') addAuditLog(code + ' : ' + statut);
  if (typeof showToast === 'function') showToast(code + ' : ' + statut, 'info');

  var host = document.querySelector('[data-flux-grid="' + line + '"]');
  if (host) host.innerHTML = window._machineState_ligneHtml(line);
  if (typeof renderLucide === 'function') renderLucide();

  var sheet = document.getElementById('machineSheetOverlay');
  if (sheet && sheet.classList.contains('open')) window._machineState_open(line, slot);
};

window.machineState = {
  statuses: MACHINE_STATE_STATUSES,
  statusColors: MACHINE_STATE_STATUS_COLORS,
  slotOf: window._machineState_slotOf,
  get: window._machineState_get,
  row: window._machineState_row,
  ligneHtml: window._machineState_ligneHtml,
  grid: window._machineState_grid,
  setStatus: window._machineState_setStatus,
  open: window._machineState_open,
  close: window._machineState_close,
  miniSchema: window._machineState_miniSchema
};
