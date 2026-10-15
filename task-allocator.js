/**
 * TASK-ALLOCATOR.JS — Allocation automatique des OF (IA simulée)
 * Pattern inspiré de "wes_task / wes_task_line AI-allocated" (OpenWES)
 * Détermine: ligne (A/B) + poste (A1-B4/B1-B4) + priorité + temps estimé
 * Règles heuristiques lisibles, auditables, configurables via RulesEngine.
 * Date: 2026-09-11
 */

'use strict';

// ---------------------------------------------------------------------------
// MAP POSTE → code planning (économie d'échelle, cf G-STACK)
// A1/B1 = débit grume + découpe épaisseurs (OF : ex. 2 CC + 2 SB)
// A2/B2 = découpe largeurs des CC (ex. madrier 125 + chevron 10)
// A3/B3 = découpe largeurs des SB (semi-finis attente séchage)
// A4/B4 = récupération des dosses (paramètres spéciaux, recyclage max)
// ---------------------------------------------------------------------------

const ALLOCATION_WEIGHTS = {
  A1: { epMax: 60,  type: 'precise' },   // débit épaisseurs selon l'OF
  A2: { epMax: 999, type: 'cc' },        // largeurs des pièces CC
  A3: { epMax: 999, type: 'sb' },        // largeurs des pièces SB
  A4: { epMax: 999, type: 'dosses' }     // récupération dosses (recyclage)
};

/**
 * Source canonique des OF.
 *
 * ATTENTION : `charben_orders` est une clé PRÉ-v6. Elle n'existe plus sur une
 * base réelle — migrations.js la liste parmi les clés legacy à migrer, et
 * realtime-sync.js:22 déclare `charben_orders_v6` comme clé de stockage. Lire
 * l'ancienne clé renvoyait systématiquement un tableau vide : la charge des
 * lignes valait donc 0 et l'équilibrage de charge n'a jamais fonctionné.
 *
 * Ordre de préférence : tableau vivant de l'app → charben_orders_v6 → legacy.
 * @returns {Array<Object>}
 */
function lireOrders() {
  if (typeof orders !== 'undefined' && Array.isArray(orders) && orders.length) return orders;
  var cles = ['charben_orders_v6', 'charben_orders'];
  for (var i = 0; i < cles.length; i++) {
    try {
      var brut = localStorage.getItem(cles[i]);
      if (brut) {
        var p = JSON.parse(brut);
        if (Array.isArray(p)) return p;
      }
    } catch (e) {
      /* stock corrompu : on essaie la clé suivante */
    }
  }
  return [];
}

/**
 * Ligne d'un OF, normalisée comme dashboardRenderer.ofLine (A1 → A, B2 → B).
 * 4 OF de la base portaient `line: 'A1'` : sans normalisation ils ne pesaient
 * sur aucune ligne.
 */
function ligneDe(o) {
  if (!o) return 'A';
  return String(o.line || 'A').charAt(0).toUpperCase() || 'A';
}

/**
 * Charge courante d'une ligne (somme des temps estimés des OF actifs)
 * @param {string} line - 'A' ou 'B'
 * @returns {number} charge en minutes
 */
function lineLoad(line) {
  let total = 0;
  lireOrders().forEach(o => {
    if ((o.assigned_line || ligneDe(o)) === line && isActiveStatus(o.status)) {
      total += (o.estimated_time_min || estimateTime(o) || 10);
    }
  });
  return total;
}

/**
 * Charge courante d'un poste
 * @param {string} poste - 'A1'|'A2'|...|'B4'
 */
function posteLoad(poste) {
  let total = 0;
  lireOrders().forEach(o => {
    /* assigned_poste n'existe que sur les OF passés par l'allocateur : on
       retombe sur machine, renseigné sur tous les OF. */
    if ((o.assigned_poste || o.machine) === poste && isActiveStatus(o.status)) {
      total += (o.estimated_time_min || estimateTime(o) || 10);
    }
  });
  return total;
}

/**
 * Statut "actif" (pas réalisé ni annulé)
 */
function isActiveStatus(status) {
  const active = ['engage', 'encours', 'pending', 'in_progress', undefined, null];
  return active.includes(status && String(status).toLowerCase());
}

/**
 * Estimation du temps de découpe (heuristique)
 * Base 15 min + 5 min par épaisseur + 2 min par pièce
 * @param {Object} of - donnée OF
 * @returns {number} minutes estimées
 */
function estimateTime(of) {
  const ep = parseFloat(of.central) || 0;
  const pieces = (of.pieceCount) || (1 + (of.laterals ? of.laterals.length : 0)) || 1;
  const base = 15;
  const time = base + (ep > 0 ? ep * 0.8 : 0) + pieces * 2;
  return Math.round(time);
}

/**
 * Calcule le rendement attendu (économie d'échelle — diamètre)
 * Reprend l'esprit des calculs dosses/tranches: plus le diamètre est grand,
 * plus le taux de valorisation (pièces) est élevé par rapport aux dosses.
 *
 * Species-Aware : le coefficient de sciage de l'essence (`coefSciage`, référentiel
 * central `sciage-logic.js` exposé en `window.essenceProfile`) ajuste le RENDEMENT
 * NET prévisionnel (`rendementNetPct`), en % de la jauge. Il ne touche JAMAIS le
 * rendement géométrique ni le volume facturé (cylindre petit-bout). Repli neutre
 * (coef = 1) si le référentiel essence n'est pas chargé.
 * @param {Object} of - porte `essence` pour le profil ; `logWidth`/`central`/`laterals` pour la géométrie
 * @returns {Object} { rendementPct, valorisablePct, dossesPct, chute, diskTotal, rendementNetPct, coefSciage, essence }
 */
function calculateRendement(of) {
  const logWidth = parseFloat(of.logWidth) || 0;
  const central = parseFloat(of.central) || 0;
  const laterals = of.laterals || [];
  const profil = (typeof window !== 'undefined' && typeof window.essenceProfile === 'function')
    ? window.essenceProfile(of && of.essence)
    : null;
  const coefSciage = profil ? profil.coefSciage : 1;
  const essence = profil ? profil.key : ((of && of.essence) || null);
  if (!logWidth || !central) {
    return { rendementPct: 0, valorisablePct: 0, dossesPct: 0, rendementNetPct: 0, coefSciage, essence };
  }

  const sumSingle = central + laterals.reduce((a, b) => a + b, 0);
  const sumDouble = sumSingle * 2;
  const rules = window.RulesEngine ? window.RulesEngine.all() : null;
  const diskCount = 2 * (1 + laterals.length) + 1;
  // Repli sans RulesEngine : les mêmes constantes que firebase-core.js, en mm.
  const diskThickness = rules
    ? rules.dimensions.DISK_THICKNESS
    : (typeof DISK_THICKNESS !== 'undefined' ? DISK_THICKNESS : 4);
  const diskTotal = diskCount * diskThickness;
  const totalConsumed = sumDouble + diskTotal;
  const chute = +(logWidth - totalConsumed).toFixed(2);

  const valorisable = sumDouble;
  const dosses = Math.max(0, logWidth - valorisable - diskTotal);
  const rendementPct = logWidth > 0 ? +((valorisable / logWidth) * 100).toFixed(1) : 0;
  const rendementNetPct = +(rendementPct * coefSciage).toFixed(1);

  return {
    rendementPct,
    valorisablePct: rendementPct,
    dossesPct: +((dosses / logWidth) * 100).toFixed(1),
    chute,
    diskTotal,
    rendementNetPct,
    coefSciage,
    essence
  };
}

/**
 * Sélection du poste selon épaisseur max + type
 * Respecte la logique A1/B1 (rendement), A2/B2 (épais), A3/B3 (SB), A4/B4 (tout)
 * @param {Object} of
 * @returns {string} poste 'A1'..'A4' (ligne appliquée ensuite)
 */
function selectPoste(of) {
  const rules = window.RulesEngine ? window.RulesEngine.all() : null;
  const epHaut = rules ? rules.allocation.POSTE_EP_HAUT : 80;
  const epBas = rules ? rules.allocation.POSTE_EP_BAS : 60;

  const central = parseFloat(of.central) || 0;
  const laterals = of.laterals || [];
  const maxEp = Math.max(central, ...(laterals.length ? laterals : [0]));

  // Logique pseudo-IA: choix du poste le moins chargé adapté
  if (maxEp > epHaut) return pickLeastLoaded(['A2', 'A3', 'A4'], of);
  if (maxEp > epBas) return 'A1'; // assez fin → rendement
  return 'A1'; // petite épaisseur → rendement (dosses valorisées)
}

/**
 * Choisit le poste le moins chargé parmi un ensemble
 */
function pickLeastLoaded(candidates, of) {
  let best = candidates[0];
  let bestLoad = Infinity;
  candidates.forEach(p => {
    const load = posteLoad(p);
    if (load < bestLoad) { bestLoad = load; best = p; }
  });
  return best;
}

/**
 * EMPLACEMENT ALLOCATION COMPLÈTE
 * @param {Object} of - OF (objet), doit comporter logWidth, central, laterals, logWidthMax?
 * @returns {Object} allocation { ofId, orderNum, assigned_line, assigned_poste, priority, estimated_time_min, decision_trace, timestamp }
 */
function allocateOf(of) {
  const rules = window.RulesEngine ? window.RulesEngine.all() : null;
  const diamHeavyB = rules ? rules.allocation.DIAMETER_HEAVY_LINE_B : 500;
  // Largeur de grume en MM, déduite de l'OF lui-même. `grumeDiametre` n'existe
  // sur aucune OF réelle (l'OF est créée depuis le planning, qui ne porte pas de
  // diamètre) : le lire seul donnait 0 et désactivait la règle en silence.
  // On retient donc l'enveloppe de capacité du motif, en mm, qui est déjà la
  // référence du garde-fou de lancement (grumes-manager.js).
  let logGaugeMm = 0;
  let gaugeSource = 'aucun';
  const lw = parseFloat(of.logWidth);
  const lwm = parseFloat(of.logWidthMax);
  // logWidth = largeur nominale du motif (c'est elle que compare le refus de
  // largeur plus bas). logWidthMax n'est que la TOLÉRANCE du motif : des OF
  // déjà réalisées portent 570-590mm alors que la largeur réelle était 560.
  // L'utiliser comme jauge refusait des OF physiquement produites.
  if (lw > 0) { logGaugeMm = lw; gaugeSource = 'logWidth'; }
  else if (lwm > 0) { logGaugeMm = lwm; gaugeSource = 'logWidthMax'; }
  else {
    // Repli : un diamètre réellement porté par l'OF, s'il y en a un.
    const d = parseFloat(of.grumeDiametre) || parseFloat(of.diameter) || 0;
    if (d > 0) { logGaugeMm = d; gaugeSource = 'grumeDiametre'; }
  }
  const maxWidth = rules
    ? rules.dimensions.MAX_LOG_WIDTH
    : (typeof MAX_LOG_WIDTH !== 'undefined' ? MAX_LOG_WIDTH : 560);
  const logWidth = parseFloat(of.logWidth) || 0;

  const trace = [];
  let assigned_line = 'A';
  let assigned_poste = selectPoste(of);
  let priority = 3;
  let refused = false;

  // 1. Contrainte largeur
  if (logWidth > maxWidth) {
    refused = true;
    trace.push('refus:logWidth>MAX_LOG_WIDTH');
  }

  // 2. Choix ligne : répartition par part cible + économie d'échelle sur la taille
  if (!refused) {
    const loadA = lineLoad('A');
    const loadB = lineLoad('B');
    const total = loadA + loadB;
    const shareCibleA = rules && rules.allocation.LINE_TARGET_SHARE_A != null
      ? rules.allocation.LINE_TARGET_SHARE_A : 0.5;
    const shareA = total > 0 ? loadA / total : 0;
    const grosLog = logGaugeMm > diamHeavyB;

    if (grosLog) {
      /* Les grosses grumes vont sur la ligne dédiée (économie d'échelle), sauf si
         cette ligne a déjà atteint sa part cible de charge. */
      const shareB = total > 0 ? loadB / total : 0;
      assigned_line = shareB < (1 - shareCibleA) ? 'B' : 'A';
      trace.push('grosse_grume_' + logGaugeMm + 'mm>' + diamHeavyB + 'mm(source=' + gaugeSource + ')'
        + '→line=' + assigned_line + ':partB=' + Math.round(shareB * 100) + '%/cible=' + Math.round((1 - shareCibleA) * 100) + '%');
    } else {
      assigned_line = shareA < shareCibleA ? 'A' : 'B';
      trace.push('grume_' + logGaugeMm + 'mm<=' + diamHeavyB + 'mm(source=' + gaugeSource + ')'
        + '→line=' + assigned_line + ':partA=' + Math.round(shareA * 100) + '%/cible=' + Math.round(shareCibleA * 100) + '%');
    }
  }

  // 3. Appliquer la lettre de ligne au poste (A1 → B1 si ligne B)
  assigned_poste = (assigned_line === 'A' ? 'A' : 'B') + assigned_poste[1];

  // 4. Priorité
  if (of.urgent === true) { priority = 1; trace.push('priority=1:urgent'); }
  else if (of.qc_alert === true) { priority = 2; trace.push('priority=2:qc_alert'); }
  else if (of.client_prioritaire) { priority = 2; trace.push('priority=2:client_prioritaire'); }
  else if (priorityDefaultDate(of)) { priority = 4; trace.push('priority=4:date_future'); }

  // 5. Temps estimé
  const estimated = estimateTime(of);

  // 6. Rendement (géométrique + net prévisionnel ajusté par l'essence)
  const rendement = calculateRendement(of);
  if (rendement && rendement.essence && rendement.coefSciage && rendement.coefSciage !== 1) {
    trace.push('rendement_net=' + rendement.rendementNetPct + '%[essence=' + rendement.essence
      + ',coef=' + rendement.coefSciage + ']');
  }

  return {
    ofId: of.id || null,
    orderNum: of.orderNum || null,
    assigned_line,
    assigned_poste,
    priority,
    estimated_time_min: estimated,
    rendement,
    refused,
    decision_trace: trace,
    timestamp: Date.now()
  };
}

/**
 * Priorité basse si la date de planning est dans le futur lointain (>7j)
 */
function priorityDefaultDate(of) {
  if (!of.plannedDate) return false;
  const d = new Date(of.plannedDate);
  if (isNaN(d.getTime())) return false;
  return (d.getTime() - Date.now()) > 7 * 24 * 60 * 60 * 1000;
}

/**
 * Tri de la file d'allocation (priorité puis load)
 */
function prioritizeQueue(orders) {
  return orders.slice().sort((a, b) => {
    return (a.priority || 3) - (b.priority || 3);
  });
}

/**
 * Audit de décision depuis l'historique de l'OF
 */
function getDecisionTrace(orderNum) {
  const liste = lireOrders();
  const o = liste.find(x => x.orderNum === orderNum || x.id === orderNum);
  return o && o.allocation ? o.allocation.decision_trace : [];
}

/**
 * Validation d'une allocation (contraintes de base)
 */
function validateAllocation(orderNum) {
  const liste = lireOrders();
  const o = liste.find(x => x.orderNum === orderNum || x.id === orderNum);
  if (!o || !o.allocation) return { valid: false, reason: 'allocation_absente' };
  const alloc = o.allocation;
  const ok = !alloc.refused && alloc.assigned_line && alloc.assigned_poste;
  return { valid: !!ok, reason: ok ? 'ok' : 'refused_ou_incomplet', allocation: alloc };
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { allocateOf, lineLoad, posteLoad, estimateTime, calculateRendement, prioritizeQueue, validateAllocation, selectPoste };
} else if (typeof window !== 'undefined') {
  window.TaskAllocator = {
    allocate: allocateOf,
    lineLoad,
    posteLoad,
    estimateTime,
    rendement: calculateRendement,
    prioritize: prioritizeQueue,
    validate: validateAllocation
  };
}