/**
 * RULES-ENGINE.JS — Règles métier configurables et versionnées
 * Pattern inspiré de "wes_rule" + PF4J plugins (OpenWES)
 * L'admin ajuste les seuils SANS toucher au code.
 * Date: 2026-09-11
 */

'use strict';

const RULES_STORE_KEY = 'charben_rules_v1';

/**
 * Version du jeu de règles. 2 = dimensions corrigées en MILLIMÈTRES.
 * v1 exprimait les dimensions en cm alors que le reste de l'app travaille en mm
 * (largeur de grume jusqu'à 560) : toute OF réelle était refusée à l'allocation.
 */
const RULES_VERSION = 4;

const DEFAULT_RULES = {
  version: RULES_VERSION,
  // Unité : MILLIMÈTRES, alignée sur les globales de firebase-core.js.
  // Toute divergence ici est un bug — le test rules-unites.test.mjs la détecte.
  dimensions: {
    MIN_LOG_WIDTH: 250,      // mm largeur min grume acceptable — EN DESSOUS, la grume est REJETÉE du flux
    MAX_LOG_WIDTH: 560,      // mm largeur max grume acceptable
    MAX_BLADES: 7,           // nb lames max sur les postes de découpe (A2/A3/A4) ; le débit A1/B1 en monte 17
    DISK_THICKNESS: 4,       // mm épaisseur disque/lame
    MAX_LOG_WIDTH_CM: 56
  },
  allocation: {
    DIAMETER_HEAVY_LINE_B: 450, // en MM (largeur nominale du motif). 450mm = 45cm : sépare les 36 OF
                                  // les plus larges sur 105 (médiane logWidth 400mm, max 560mm).
    POSTE_EP_HAUT: 80,         // épaisseur > 80mm → poste A2/B2
    POSTE_EP_BAS: 60,          // épaisseur ≤ 60mm → poste A1/B1
    MIN_LOAD_FOR_ALGO: 0.6,    // charge > 60% → réallocation
    LINE_TARGET_SHARE_A: 0.5   // part de charge visée pour la ligne A. Sans plancher,
                               // « la moins chargée » vide la ligne A (elle portait
                               // 4230 min contre 489) et l'autre ligne ne démarre jamais.
  },
  // 3 classes de diamètre (mm). Les bornes sont CONTIGUËS et couvrent exactement
  // [MIN_LOG_WIDTH .. MAX_LOG_WIDTH] ; C3 s'aligne sur DIAMETER_HEAVY_LINE_B (450).
  // Modifiables par les admins/superviseurs via setGrumeClasses() (qui valide la
  // cohérence avant d'écrire). Clés additives : getRules() les fait apparaître par
  // deepMerge même sur un stock v4 — pas besoin de bumper RULES_VERSION.
  grumeClasses: {
    C1: { label: 'Petits', min: 250, max: 350 },
    C2: { label: 'Moyens', min: 351, max: 450 },
    C3: { label: 'Gros',   min: 451, max: 560 }
  },
  sechage: {
    DEFAULT_DRY_DAYS: 20,      // jours de séchage par défaut
    HUMIDITE_TARGET: 14,       // % humidité cible PF
    MIN_DRY_DAYS: 7
  },
  qc: {
    QUARANTAINE_THRESHOLD: 3   // nb défauts avant quarantaine auto
  }
};

/**
 * Retourne les règles actives (fusion défaut + stockées)
 */
function getRules() {
  try {
    const stored = localStorage.getItem(RULES_STORE_KEY);
    if (!stored) return JSON.parse(JSON.stringify(DEFAULT_RULES));
    const parsed = JSON.parse(stored);
    if (parsed === null || typeof parsed !== 'object') return JSON.parse(JSON.stringify(DEFAULT_RULES));

    // Migration v1 → v2 : les dimensions stockées étaient en cm. On les jette
    // pour que les défauts (mm) reprennent la main.
    // v2 → v3 : DIAMETER_HEAVY_LINE_B valait 60 (cm) alors que la largeur est en
    // mm — seuil au-dessus du maximum physique (560mm), règle inatteignable.
    // v3 → v4 : seuil recalibré sur la distribution réelle de logWidth (450mm).
    // Cette clé n'est jamais reprise d'une version antérieure : elle est
    // systématiquement effacée pour que le défaut en mm s'applique. Le reste du
    // bloc allocation est conservé intact.
    const storedVersion = parseInt(parsed.version, 10) || 1;
    if (storedVersion < RULES_VERSION) {
      delete parsed.dimensions;
      if (parsed.allocation) {
        delete parsed.allocation.DIAMETER_HEAVY_LINE_B;
      }
      parsed.version = RULES_VERSION;
    }

    // Fusion profonde : les valeurs stockées écrasent les défauts
    return deepMerge(JSON.parse(JSON.stringify(DEFAULT_RULES)), parsed);
  } catch (e) {
    errLog('rules', 'stock corrompu, défaut utilisé', e, 'warn');
    return JSON.parse(JSON.stringify(DEFAULT_RULES));
  }
}

/**
 * Fusion profonde de 2 objets
 */
function deepMerge(base, override) {
  const out = {};
  Object.keys(base).forEach(k => {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])
        && override[k] && typeof override[k] === 'object' && !Array.isArray(override[k])) {
      out[k] = deepMerge(base[k], override[k]);
    } else {
      out[k] = (override[k] !== undefined) ? override[k] : base[k];
    }
  });
  // Ajouter les clés de override non présentes dans base
  Object.keys(override || {}).forEach(k => {
    if (!(k in out)) out[k] = override[k];
  });
  return out;
}

/**
 * Récupère une règle par chemin pointé: getRule('dimensions.MAX_BLADES')
 */
function getRule(path) {
  const rules = getRules();
  const keys = path.split('.');
  let target = rules;
  for (const k of keys) {
    if (target === undefined || target === null || !(k in target)) return undefined;
    target = target[k];
  }
  return target;
}

/**
 * Met à jour une règle (ou la crée).
 * Retourne la nouvelle valeur active.
 */
function updateRule(path, value) {
  const rules = getRules();
  const keys = path.split('.');
  let target = rules;
  keys.slice(0, -1).forEach(k => {
    if (!target[k] || typeof target[k] !== 'object') target[k] = {};
    target = target[k];
  });
  target[keys[keys.length - 1]] = value;
  rules.version = (rules.version || 1) + 1;
  localStorage.setItem(RULES_STORE_KEY, JSON.stringify(rules));

  // Audit local (déclenche EventBus si présent)
  if (typeof window !== 'undefined' && window.EventBus && typeof window.EventBus.publish === 'function') {
    window.EventBus.publish('rule.updated', { path, value });
  } else if (typeof TransactionLogger !== 'undefined') {
    try { TransactionLogger.log({ type: 'rule_updated', details: { path, value } }); } catch(e){}
  }
  return getRule(path);
}

/**
 * Réinitialise les règles aux valeurs par défaut
 */
function resetRules() {
  localStorage.setItem(RULES_STORE_KEY, JSON.stringify(DEFAULT_RULES));
  if (typeof window !== 'undefined' && window.EventBus && typeof window.EventBus.publish === 'function') {
    window.EventBus.publish('rule.updated', { path: '*', value: 'reset' });
  }
}

/**
 * Classe un diamètre de grume (mm) dans l'une des 3 classes.
 * Rejette toute grume hors de [MIN_LOG_WIDTH .. MAX_LOG_WIDTH].
 * Retourne un objet discriminé :
 *   succès : { ok:true,  classe, label, min, max, diametreMm }
 *   rejet  : { ok:false, classe:null, error:'HORS_LIMITES'|'INVALIDE', diametreMm, min, max }
 */
function getGrumeClass(diametreMm) {
  const dims = getRule('dimensions') || {};
  const min = Number(dims.MIN_LOG_WIDTH);
  const max = Number(dims.MAX_LOG_WIDTH);

  if (diametreMm === null || diametreMm === undefined || diametreMm === ''
      || !Number.isFinite(Number(diametreMm))) {
    return { ok: false, classe: null, error: 'INVALIDE', diametreMm: diametreMm, min: min, max: max };
  }
  const d = Number(diametreMm);
  if (d < min || d > max) {
    return { ok: false, classe: null, error: 'HORS_LIMITES', diametreMm: d, min: min, max: max };
  }

  const classes = getRule('grumeClasses') || {};
  const liste = Object.keys(classes)
    .map(code => ({
      code: code,
      label: classes[code] && classes[code].label,
      min: Number(classes[code] && classes[code].min),
      max: Number(classes[code] && classes[code].max)
    }))
    .sort((a, b) => a.min - b.min);

  let c = liste.find(x => d >= x.min && d <= x.max);
  if (!c) c = liste.find(x => d <= x.max);   // valeur tombée dans un trou → classe supérieure
  if (!c) c = liste[liste.length - 1];       // sécurité : bornes déjà garanties par [min,max]
  return { ok: true, classe: c.code, label: c.label || c.code, min: c.min, max: c.max, diametreMm: d };
}

/**
 * Valide une table de classes AVANT écriture. Lève une Error si incohérente.
 * Contraintes : les 3 classes présentes, contiguës (max+1 = min suivante),
 * C1.min = MIN_LOG_WIDTH, C3.max = MAX_LOG_WIDTH, toutes dans les limites absolues.
 */
function validerGrumeClasses(classes, min, max) {
  ['C1', 'C2', 'C3'].forEach(code => {
    const c = classes[code];
    if (!c || !Number.isFinite(c.min) || !Number.isFinite(c.max)) {
      throw new Error('setGrumeClasses : classe ' + code + ' manquante ou invalide');
    }
    if (c.min > c.max) {
      throw new Error('setGrumeClasses : classe ' + code + ' incohérente (min > max)');
    }
    if (c.min < min || c.max > max) {
      throw new Error('setGrumeClasses : ' + code + ' [' + c.min + '..' + c.max
        + '] hors des limites absolues (' + min + '..' + max + ')');
    }
  });
  if (classes.C1.min !== min) {
    throw new Error('setGrumeClasses : C1.min doit être la limite absolue ' + min);
  }
  if (classes.C3.max !== max) {
    throw new Error('setGrumeClasses : C3.max doit être la limite absolue ' + max);
  }
  const ordonnees = ['C1', 'C2', 'C3'];
  for (let i = 0; i < ordonnees.length - 1; i++) {
    const a = classes[ordonnees[i]];
    const b = classes[ordonnees[i + 1]];
    if (a.max + 1 !== b.min) {
      throw new Error('setGrumeClasses : classes non contiguës entre ' + ordonnees[i]
        + ' et ' + ordonnees[i + 1] + ' (trou ou chevauchement)');
    }
  }
}

/**
 * Met à jour un ou plusieurs seuils de classe (admin/superviseur).
 * Fusionne avec les valeurs actives, valide la cohérence, puis persiste.
 * Retourne la table de classes résultante.
 */
function setGrumeClasses(partiel) {
  if (!partiel || typeof partiel !== 'object') {
    throw new Error('setGrumeClasses : objet attendu');
  }
  const dims = getRule('dimensions') || {};
  const min = Number(dims.MIN_LOG_WIDTH);
  const max = Number(dims.MAX_LOG_WIDTH);
  const actuelles = getRule('grumeClasses') || {};

  const fusion = {};
  ['C1', 'C2', 'C3'].forEach(code => {
    const base = actuelles[code] || {};
    const maj = partiel[code] || {};
    fusion[code] = {
      label: maj.label !== undefined ? maj.label : (base.label || code),
      min: maj.min !== undefined ? Number(maj.min) : Number(base.min),
      max: maj.max !== undefined ? Number(maj.max) : Number(base.max)
    };
  });

  validerGrumeClasses(fusion, min, max);
  updateRule('grumeClasses', fusion);
  return fusion;
}

/**
 * Raccourcis métier (ce que le code appelle réellement)
 */
const Rules = {
  get: getRule,
  get maxLogWidth() { return getRule('dimensions.MAX_LOG_WIDTH'); },
  get maxBlades()   { return getRule('dimensions.MAX_BLADES'); },
  get diskThickness(){ return getRule('dimensions.DISK_THICKNESS'); },
  get diamHeavyLineB(){ return getRule('allocation.DIAMETER_HEAVY_LINE_B'); },
  get posteEpHaut()  { return getRule('allocation.POSTE_EP_HAUT'); },
  get posteEpBas()   { return getRule('allocation.POSTE_EP_BAS'); },
  get dryDays()      { return getRule('sechage.DEFAULT_DRY_DAYS'); },
  get humiditeTarget(){ return getRule('sechage.HUMIDITE_TARGET'); },
  get grumeClasses() { return getRule('grumeClasses'); },
  grumeClass(diametreMm) { return getGrumeClass(diametreMm); }
};

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getRules, getRule, updateRule, resetRules, Rules, DEFAULT_RULES,
    getGrumeClass, setGrumeClasses, validerGrumeClasses };
} else if (typeof window !== 'undefined') {
  window.RulesEngine = { get: getRule, set: updateRule, reset: resetRules, all: getRules, Rules,
    getGrumeClass, setGrumeClasses };
}