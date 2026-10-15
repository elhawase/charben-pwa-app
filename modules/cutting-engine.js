/**
 * CUTTING-ENGINE.JS — Orchestrateur de découpe (Plan Q, étape 2)
 *
 * Ce module NE RÉÉCRIT AUCUN CALCUL métier. Il regarde vers les sources
 * canoniques et les compose :
 *   - classification  → RulesEngine.getGrumeClass (rules-engine.js, étape 1)
 *   - géométrie        → formule du cercle (ce module, voir ci-dessous)
 *   - bilan de masse   → mouvementsManager.pertesParPoste (mouvements-manager.js)
 *                        + sciageLogic.calcVolumeGrume (_sciageLogic_calcVolumeGrume)
 *   - canal canonique  → importGrumeToWip (of-manager.js) : SEUL chemin qui lie la
 *                        pièce à sa grume, alimente wipProducts ET le registre.
 *
 * UNITÉS — ne pas deviner :
 *   diamètre : MILLIMÈTRES au classement/géométrie ; CENTIMÈTRES pour `diametreCm`
 *              du bilan (convention de rawMaterials.diametre et pertesParPoste).
 *   largeur / offset / épaisseur : MILLIMÈTRES.
 *   longueur : MÈTRES pour le bilan ; volumes en m³.
 *
 * GÉOMÉTRIE DU CERCLE : à la hauteur `offset` (distance à l'axe, en mm), la corde
 * disponible dans un disque de rayon R est H = 2·√(R² − offset²). On en retire
 * UN trait de lame (DISK_THICKNESS = 4 mm) pour obtenir la largeur NETTE sciable.
 *   - pièce CENTRALE (CC) : centrée sur l'axe → offset = épaisseur/2 ;
 *   - pièce LATÉRALE (SB) : mesurée au bord le plus ÉLOIGNÉ de l'axe
 *     (la corde y est la plus courte) → offset = offset_bord + épaisseur/2.
 *
 * Globals attendus : RulesEngine, mouvementsManager, sciageLogic, DISK_THICKNESS,
 *                    importGrumeToWip (ou ofManager.importGrumeToWip).
 */
'use strict';

/* ── Résolution des dépendances (résiliente à l'ordre de chargement) ── */

function _rules() {
  return (typeof window !== 'undefined' && window.RulesEngine) ? window.RulesEngine : null;
}
function _pertesParPoste() {
  if (typeof window !== 'undefined') {
    if (window.mouvementsManager && typeof window.mouvementsManager.pertesParPoste === 'function') {
      return window.mouvementsManager.pertesParPoste;
    }
    if (typeof window._mouvementsManager_pertesParPoste === 'function') {
      return window._mouvementsManager_pertesParPoste;
    }
  }
  return null;
}
function _calcVolumeGrume() {
  if (typeof window !== 'undefined') {
    if (window.sciageLogic && typeof window.sciageLogic.calcVolumeGrume === 'function') {
      return window.sciageLogic.calcVolumeGrume;
    }
    if (typeof window._sciageLogic_calcVolumeGrume === 'function') {
      return window._sciageLogic_calcVolumeGrume;
    }
  }
  return null;
}
function _importGrume() {
  if (typeof window !== 'undefined') {
    if (typeof window.importGrumeToWip === 'function') return window.importGrumeToWip;
    if (window.ofManager && typeof window.ofManager.importGrumeToWip === 'function') {
      return window.ofManager.importGrumeToWip;
    }
  }
  return null;
}
function _epaisseurLame(options) {
  if (options && typeof options.lameMm === 'number' && isFinite(options.lameMm)) {
    return Math.max(0, options.lameMm);
  }
  if (typeof DISK_THICKNESS === 'number' && DISK_THICKNESS > 0) return DISK_THICKNESS;
  return 4;
}

/* ── 1. Classification ── */

/* Délègue au moteur de règles (source unique des seuils C1/C2/C3 et [250,560]). */
function classerGrume(diametreMm) {
  var RE = _rules();
  if (!RE || typeof RE.getGrumeClass !== 'function') {
    return { ok: false, classe: null, error: 'MOTEUR_REGLES_INDISPONIBLE' };
  }
  return RE.getGrumeClass(diametreMm);
}

/* ── 2. Géométrie du cercle ── */

function rayonMm(diametreMm) {
  var d = parseFloat(diametreMm);
  if (!isFinite(d) || d <= 0) return 0;
  return d / 2;
}

/* Largeur NETTE disponible à une distance `offsetMm` de l'axe, lame déduite. */
function largeurUtile(diametreMm, offsetMm, options) {
  var R = rayonMm(diametreMm);
  var off = Math.abs(parseFloat(offsetMm));
  if (!(R > 0) || !isFinite(off)) return 0;
  if (off >= R) return 0;
  var brut = 2 * Math.sqrt((R * R) - (off * off));
  return +Math.max(0, brut - _epaisseurLame(options)).toFixed(2);
}

/* Pièce centrale (CC) : centrée sur l'axe → offset = épaisseur/2. */
function largeurCC(diametreMm, epaisseurMm, options) {
  var ep = parseFloat(epaisseurMm);
  if (!isFinite(ep) || ep <= 0) return 0;
  return largeurUtile(diametreMm, ep / 2, options);
}

/* Pièce latérale (SB) : bord éloigné → offset = offset_bord + épaisseur/2. */
function largeurSB(diametreMm, offsetBordMm, epaisseurMm, options) {
  var off = parseFloat(offsetBordMm);
  var ep = parseFloat(epaisseurMm);
  if (!isFinite(off) || !isFinite(ep) || ep <= 0) return 0;
  return largeurUtile(diametreMm, off + (ep / 2), options);
}

/* ── 3. Bilan de masse & résidus ── */

/* Volume du cylindre (m³) — délégué à sciageLogic.calcVolumeGrume. */
function volumeGrume(diametreCm, longueurM) {
  var fn = _calcVolumeGrume();
  if (typeof fn !== 'function') return 0;
  return fn(parseFloat(diametreCm), parseFloat(longueurM));
}

/*
 * Bilan décomposé via pertesParPoste :
 *   entrant = pf + lame(sciure) + dosse + carrelet(déchets)
 * `equilibre` est vrai si la décomposition boucle à 1e-6 près.
 */
function bilan(params) {
  var vide = {
    valide: false, entrant: 0, pf: 0, lame: 0, dosse: 0, carrelet: 0, total: 0,
    entrantTheorique: 0, ecart: 0, equilibre: false
  };
  if (!params) return vide;
  var pp = _pertesParPoste();
  if (typeof pp !== 'function') {
    vide.error = 'PERTES_INDISPONIBLE';
    return vide;
  }
  var d = pp(params);
  var valide = d.entrant > 0;
  var ecart = +(d.entrant - (d.pf + d.lame + d.dosse + d.carrelet)).toFixed(6);
  var theo = volumeGrume(params.diametreCm, params.longueurM);
  return {
    valide: valide,
    entrant: d.entrant,
    pf: d.pf,
    lame: d.lame,
    dosse: d.dosse,
    carrelet: d.carrelet,
    total: d.total,
    entrantTheorique: valide ? theo : 0,
    ecart: ecart,
    equilibre: valide && Math.abs(ecart) <= 1e-6
  };
}

/* ── 4. Canal canonique ── */

/*
 * Toute sortie validée passe par importGrumeToWip — jamais d'écriture directe
 * dans wipProducts. Retourne un résultat lisible plutôt que de propager l'effet.
 */
function cheminCanonique(of, grumeCode) {
  if (!of || typeof of !== 'object' || !grumeCode || String(grumeCode).trim() === '') {
    return { ok: false, error: 'PARAMS_INVALIDE', via: null, grumeCode: null, ofNum: null };
  }
  var fn = _importGrume();
  if (typeof fn !== 'function') {
    return { ok: false, error: 'CANAL_INDISPONIBLE', via: null, grumeCode: String(grumeCode), ofNum: of.orderNum || null };
  }
  fn(of, grumeCode);
  return { ok: true, via: 'importGrumeToWip', grumeCode: String(grumeCode), ofNum: of.orderNum || null };
}

/* ── Orchestrateur ── */

/*
 * executer({ diametreMm, decoupe?, of?, grumeCode? })
 *  1. classe la grume (rejet hors [250,560]) — bloque tout le reste si échec ;
 *  2. si `decoupe` fourni : calcule le bilan et vérifie l'invariant ;
 *  3. si `of` + `grumeCode` fournis : sort par le canal canonique.
 * Renvoie { ok, etape, classe, bilan, sortie } ; `etape` nomme le point de rejet.
 */
function executer(spec) {
  spec = spec || {};
  var cls = classerGrume(spec.diametreMm);
  if (!cls || cls.ok !== true) {
    return { ok: false, etape: 'classification', rejet: cls, classe: null, bilan: null, sortie: null };
  }
  var res = { ok: true, etape: 'ok', classe: cls, diametreMm: Number(spec.diametreMm), bilan: null, sortie: null };
  if (spec.decoupe) {
    res.bilan = bilan(spec.decoupe);
    if (res.bilan.valide && !res.bilan.equilibre) {
      return { ok: false, etape: 'bilan', rejet: null, classe: cls, bilan: res.bilan, sortie: null };
    }
  }
  if (spec.of && spec.grumeCode) {
    res.sortie = cheminCanonique(spec.of, spec.grumeCode);
    if (!res.sortie.ok) {
      return { ok: false, etape: 'canal', rejet: null, classe: cls, bilan: res.bilan, sortie: res.sortie };
    }
  }
  return res;
}

/* ── 5. Pont grume ↔ OF (étapes 3 : gates scan + WIP) ── */

/* Diamètre en mm : grumeWidthMm() si disponible (arrondi ×10 du cm), sinon fallback. */
function diametreMmDe(grume) {
  if (!grume) return 0;
  if (typeof window !== 'undefined' && typeof window.grumeWidthMm === 'function') {
    return window.grumeWidthMm(grume) || 0;
  }
  return Math.round((parseFloat(grume.diametre) || 0) * 10);
}

/* Largeurs nettes (mm) des pièces du plan OF pour ce diamètre.
   CC : centrées sur l'axe. SB : offsets cumulés depuis l'axe (bord éloigné). */
function largeursPlan(diamMm, of) {
  var res = { cc: [], sb: [] };
  if (!of) return res;
  var central = parseFloat(of.central);
  var central2 = parseFloat(of.central2);
  if (central > 0) res.cc.push({ ep: central, max: largeurCC(diamMm, central) });
  if (central2 > 0) res.cc.push({ ep: central2, max: largeurCC(diamMm, central2) });
  var halfBlock = (central > 0 ? central : 0) / 2 + (central2 > 0 ? central2 : 0) / 2;
  var acc = halfBlock;
  var laterals = Array.isArray(of.laterals) ? of.laterals : [];
  laterals.forEach(function(ep) {
    var e = parseFloat(ep);
    if (!(e > 0)) return;
    res.sb.push({ ep: e, max: largeurSB(diamMm, acc, e) });
    acc += e;
  });
  return res;
}

/* Construit les paramètres du bilan depuis la grume + l'OF (pièces = buildOfSemiItems). */
function construireDecoupe(grume, of, diamMm) {
  if (!of) return null;
  var items = [];
  if (typeof window !== 'undefined' && typeof window.buildOfSemiItems === 'function') {
    try { items = window.buildOfSemiItems(of, { perGrume: true }) || []; } catch (e) { items = []; }
  }
  var pieces = [];
  items.forEach(function(it) {
    if (!it || !it.dims) return;
    var ep = parseFloat(it.dims.ep), b = parseFloat(it.dims.b), q = parseFloat(it.qty);
    if (ep > 0 && b > 0 && q > 0) pieces.push({ epaisseur: ep, largeur: b, qty: q });
  });
  var diametreCm = parseFloat(grume.diametre);
  if (!(diametreCm > 0)) diametreCm = diamMm / 10;
  var longueurM = (parseFloat(of.pieceLength) > 0)
    ? parseFloat(of.pieceLength) / 1000
    : (parseFloat(grume.longueur) || 0);
  var nbLames = parseInt(of.diskCount, 10);
  if (!(nbLames > 0)) {
    var pc = parseInt(of.pieceCount, 10);
    nbLames = pc > 0 ? (2 * pc + 1) : 0;
  }
  var dosses = [];
  var d = of.dosses;
  if (d && parseFloat(d.epaisseur) > 0 && parseFloat(d.largeur) > 0 && parseFloat(d.count) > 0) {
    dosses.push({ epaisseur: parseFloat(d.epaisseur), largeur: parseFloat(d.largeur), qty: parseFloat(d.count) });
  }
  return { diametreCm: diametreCm, longueurM: longueurM, nbLames: nbLames, pieces: pieces, dosses: dosses };
}

function resumeGrume(grume, cls, diamMm, largeurs) {
  var parts = ['Grume ' + (grume.code || '?') + ' — classe ' + cls.classe + ' (' + cls.label + ')', 'Ø' + diamMm + 'mm'];
  if (largeurs && largeurs.cc && largeurs.cc.length) {
    parts.push('CC ' + largeurs.cc.map(function(c) { return c.ep + '→' + c.max + 'mm'; }).join(', '));
  }
  if (largeurs && largeurs.sb && largeurs.sb.length) {
    parts.push('SB ' + largeurs.sb.map(function(s) { return s.ep + '→' + s.max + 'mm'; }).join(', '));
  }
  return parts.join(' · ');
}

/*
 * evaluerGrume(grume, of) — évaluation SANS effet de bord, destinée aux gates du
 * flux opérateur (scan puis import WIP). Renvoie { ok, etape, classe, diametreMm,
 * largeurs, decoupe, bilan, resume }. `etape` nomme le point de rejet
 * ('grume' | 'classification' | 'bilan'). Le canal canonique n'est pas appelé ici.
 */
function evaluerGrume(grume, of) {
  if (!grume) {
    return { ok: false, etape: 'grume', error: 'GRUME_ABSENTE', classe: null, diametreMm: 0, largeurs: null, decoupe: null, bilan: null, resume: 'Aucune grume' };
  }
  var diamMm = diametreMmDe(grume);
  var cls = classerGrume(diamMm);
  if (!cls || cls.ok !== true) {
    var message = !cls ? 'Classification indisponible'
      : cls.error === 'HORS_LIMITES'
        ? ('Diamètre ' + diamMm + 'mm hors limites (' + cls.min + '–' + cls.max + 'mm)')
        : 'Diamètre invalide';
    return { ok: false, etape: 'classification', error: cls ? cls.error : 'CLASSIFICATION_INDISPONIBLE', classe: cls, diametreMm: diamMm, largeurs: null, decoupe: null, bilan: null, resume: message };
  }
  var largeurs = largeursPlan(diamMm, of);
  var decoupe = construireDecoupe(grume, of, diamMm);
  var b = decoupe ? bilan(decoupe) : null;
  if (b && b.valide && !b.equilibre) {
    return { ok: false, etape: 'bilan', error: 'BILAN_DESEQUILIBRE', classe: cls, diametreMm: diamMm, largeurs: largeurs, decoupe: decoupe, bilan: b, resume: 'Bilan matière déséquilibré' };
  }
  return { ok: true, etape: 'ok', classe: cls, diametreMm: diamMm, largeurs: largeurs, decoupe: decoupe, bilan: b, resume: resumeGrume(grume, cls, diamMm, largeurs) };
}

function grumeAutorisee(grume, of) {
  return evaluerGrume(grume, of).ok === true;
}

/* ── Exports ── */

var cuttingEngine = {
  classerGrume: classerGrume,
  rayonMm: rayonMm,
  largeurUtile: largeurUtile,
  largeurCC: largeurCC,
  largeurSB: largeurSB,
  volumeGrume: volumeGrume,
  bilan: bilan,
  cheminCanonique: cheminCanonique,
  executer: executer,
  diametreMmDe: diametreMmDe,
  largeursPlan: largeursPlan,
  construireDecoupe: construireDecoupe,
  evaluerGrume: evaluerGrume,
  grumeAutorisee: grumeAutorisee
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = cuttingEngine;
} else if (typeof window !== 'undefined') {
  window.cuttingEngine = cuttingEngine;
}
