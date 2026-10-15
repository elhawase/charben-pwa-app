/**
 * OF-TRACKING.JS — Amélioration des OF avec tracking input/output
 * Intégration avec le nouveau système stock.js
 * Scierie Charben — 2026-09-11
 */

'use strict';

/**
 * ÉTEND createOfFromSpec() existant (app.js ligne 7510)
 * Ajoute le tracking des inputs (grumes consommées) et outputs (WIP produits)
 * 
 * UTILISATION:
 *   - Remplacer l'appel à createOfFromSpec() par createOfWithTracking()
 *   - Ou appeler linkOfToStock() après createOfFromSpec() standard
 */

/**
 * Crée un OF avec tracking complet des inputs/outputs
 * @param {Object} line - Ligne planning (paramètre existant de createOfFromSpec)
 * @param {Object} options - Options additionnelles pour tracking
 * @param {Array<string>} [options.input_stock_item_ids] - IDs StockItems grumes à consommer
 * @param {string} [options.location_id] - Poste de production (A1-B4)
 * @param {string} [options.batch_prefix] - Préfixe batch pour WIP (ex: "LOT-2026-09-11")
 * @returns {Object} BuildOrder créé
 */
function createOfWithTracking(line, options = {}) {
  // 1. Créer l'OF de base (logique existante)
  const baseOF = createOfFromSpec(line); // Fonction existante dans app.js
  
  // 2. Créer le BuildOrder dans le nouveau système
  const buildOrder = StockManager.createBuildOrder({
    reference: baseOF.id || `OF-${Date.now()}`,
    output_part_id: options.output_part_id || 'part_sf_generic', // Part semi-finie générique
    output_quantity: baseOF.quantite || 1,
    location_id: options.location_id || inferLocationFromLine(line),
    notes: buildNotesFromLine(line),
    scheduled_start: Date.now(),
    inputs: [] // Sera rempli après
  });
  
  // 3. Lier les inputs (grumes) si fournis
  if (options.input_stock_item_ids && options.input_stock_item_ids.length > 0) {
    linkInputsToBuildOrder(buildOrder.id, options.input_stock_item_ids);
  }
  
  // 4. Mettre à jour l'OF original avec les nouveaux IDs
  baseOF.build_order_id = buildOrder.id;
  baseOF.tracking_enabled = true;
  
  // 5. Log transaction
  TransactionLogger.log({
    type: 'build_order_created',
    build_order_id: buildOrder.id,
    part_id: buildOrder.output_part_id,
    details: {
      reference: buildOrder.reference,
      line_code: line.code,
      location: buildOrder.location_id
    }
  });
  
  return buildOrder;
}

/**
 * Lie des StockItems (grumes) à un BuildOrder en tant qu'inputs
 * @param {string} buildOrderId
 * @param {Array<string>} stockItemIds - IDs des StockItems grumes
 */
function linkInputsToBuildOrder(buildOrderId, stockItemIds) {
  const orders = JSON.parse(localStorage.getItem('charben_build_orders') || '[]');
  const order = orders.find(o => o.id === buildOrderId);
  
  if (!order) {
    throw new Error(`BuildOrder ${buildOrderId} introuvable`);
  }
  
  const stock = JSON.parse(localStorage.getItem('charben_stock_items') || '[]');
  
  stockItemIds.forEach(stockItemId => {
    const item = stock.find(s => s.id === stockItemId);
    if (!item) {
      errLog('of-tracking', 'findStockItem', 'StockItem ' + stockItemId + ' introuvable, ignoré', 'warn');
      return;
    }
    
    // Ajouter aux inputs du BuildOrder
    order.inputs.push({
      part_id: item.part_id,
      stock_item_id: stockItemId,
      quantity: item.quantity
    });
    
    // Marquer le StockItem comme réservé
    item.status = StockManager.STATUS.EN_COURS.code;
    item.metadata = item.metadata || {};
    item.metadata.reserved_for_build_order = buildOrderId;
    item.updated_at = Date.now();
  });
  
  // Sauvegarder
  localStorage.setItem('charben_build_orders', JSON.stringify(orders));
  localStorage.setItem('charben_stock_items', JSON.stringify(stock));
}

/**
 * Termine un OF avec création automatique des WIP
 * @param {string} buildOrderId
 * @param {Object} output - Données de sortie
 * @param {string} output.part_id - ID Part semi-finie
 * @param {number} output.quantity - Quantité produite
 * @param {string} [output.batch] - Numéro lot WIP
 * @param {Object} [output.metadata] - Métadonnées additionnelles
 */
function completeOfWithTracking(buildOrderId, output) {
  const orders = JSON.parse(localStorage.getItem('charben_build_orders') || '[]');
  const order = orders.find(o => o.id === buildOrderId);
  
  if (!order) {
    throw new Error(`BuildOrder ${buildOrderId} introuvable`);
  }
  
  // Générer batch si non fourni
  const batch = output.batch || generateBatchNumber(order);
  
  // Utiliser le nouveau système stock.js
  StockManager.completeBuildOrder(buildOrderId, [{
    part_id: output.part_id,
    quantity: output.quantity,
    location_id: StockManager.LOCATIONS.SECHAGE.id,
    status: StockManager.STATUS.EN_SECHAGE.code,
    batch: batch,
    metadata: {
      ...output.metadata,
      build_order_reference: order.reference,
      production_date: Date.now()
    }
  }]);
  
  // Transaction log additionnel
  TransactionLogger.log({
    type: 'transfer_to_sechage',
    build_order_id: buildOrderId,
    quantity: output.quantity,
    to_location_id: StockManager.LOCATIONS.SECHAGE.id,
    details: {
      batch,
      part_id: output.part_id
    }
  });
}

/**
 * Génération automatique de numéro de lot
 */
function generateBatchNumber(buildOrder) {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const shortId = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `LOT-${date}-${shortId}`;
}

/**
 * Infère le poste de production depuis la ligne planning
 */
function inferLocationFromLine(line) {
  const code = (line.code || '').toUpperCase();
  
  // Mapping code ligne → location ID
  if (code.includes('A1')) return StockManager.LOCATIONS.ATELIER.children.A1.id;
  if (code.includes('A2')) return StockManager.LOCATIONS.ATELIER.children.A2.id;
  if (code.includes('A3')) return StockManager.LOCATIONS.ATELIER.children.A3.id;
  if (code.includes('A4')) return StockManager.LOCATIONS.ATELIER.children.A4.id;
  if (code.includes('B1')) return StockManager.LOCATIONS.ATELIER.children.B1.id;
  if (code.includes('B2')) return StockManager.LOCATIONS.ATELIER.children.B2.id;
  if (code.includes('B3')) return StockManager.LOCATIONS.ATELIER.children.B3.id;
  if (code.includes('B4')) return StockManager.LOCATIONS.ATELIER.children.B4.id;
  
  return StockManager.LOCATIONS.ATELIER.id; // Par défaut
}

/**
 * Construit les notes depuis la ligne planning
 */
function buildNotesFromLine(line) {
  const parts = [];
  if (line.epaisseur) parts.push(`Épaisseur: ${line.epaisseur}mm`);
  if (line.largeur) parts.push(`Largeur: ${line.largeur}mm`);
  if (line.longueur) parts.push(`Longueur: ${line.longueur}mm`);
  if (line.essence) parts.push(`Essence: ${line.essence}`);
  if (line.rendement) parts.push(`Rendement: ${line.rendement}%`);
  return parts.join(' | ');
}

/**
 * Récupère tous les OF avec tracking activé
 */
function getTrackedBuildOrders() {
  const orders = JSON.parse(localStorage.getItem('charben_build_orders') || '[]');
  return orders.filter(o => o.inputs && o.inputs.length > 0);
}

/**
 * Résout la longueur (m) d'une grume depuis ses attributs.
 * @param {Object} attrs - part.attributes
 * @returns {number} longueur en mètres (0 si indisponible)
 */
function resolvePartLengthM(attrs) {
  if (!attrs) return 0;
  const m = parseFloat(attrs.longueur_m);
  if (m > 0) return m;
  const mm = parseFloat(attrs.longueur_mm);
  if (mm > 0) return mm / 1000;
  if (attrs.dimensions) {
    const dmm = parseFloat(attrs.dimensions.longueur_mm);
    if (dmm > 0) return dmm / 1000;
  }
  return 0;
}

/**
 * Volume géométrique d'un composant (m³), via le moteur canonique pour les grumes.
 *   · Grume (diametre_cm + longueur) → cylindre petit-bout (sciage-logic.calcVolumeGrume)
 *   · Pièce (dimensions ep × larg × long, mm) → pavé
 *   · Données insuffisantes → 0 — JAMAIS de cube de diamètre (dimensionnellement faux).
 * @param {Object} part - Part du système StockManager
 * @returns {number} volume en m³
 */
function partVolumeM3(part) {
  if (!part) return 0;
  const attrs = part.attributes || {};

  const dcm = parseFloat(attrs.diametre_cm);
  if (dcm > 0) {
    const engine = (typeof calcVolumeGrume === 'function') ? calcVolumeGrume
      : (typeof window !== 'undefined' && window.sciageLogic && typeof window.sciageLogic.calcVolumeGrume === 'function') ? window.sciageLogic.calcVolumeGrume
      : null;
    const lenM = resolvePartLengthM(attrs);
    if (engine && lenM > 0) return engine(dcm, lenM);
    errLog('of-tracking', 'partVolumeM3', 'Grume sans longueur (part sans longueur_m) — volume non calculable', 'warn');
    return 0;
  }

  const dims = attrs.dimensions || {};
  const ep = parseFloat(dims.epaisseur_mm) || 0;
  const lg = parseFloat(dims.largeur_mm) || 0;
  const lo = parseFloat(dims.longueur_mm) || 0;
  if (ep > 0 && lg > 0 && lo > 0) return +((ep / 1000) * (lg / 1000) * (lo / 1000)).toFixed(6);

  return 0;
}

/**
 * Calcule le taux de transformation d'un OF
 * @param {string} buildOrderId
 * @returns {Object} {input_volume, output_volume, ratio, efficiency}
 */
function calculateTransformationRatio(buildOrderId) {
  const orders = JSON.parse(localStorage.getItem('charben_build_orders') || '[]');
  const order = orders.find(o => o.id === buildOrderId);
  
  if (!order || !order.inputs || !order.outputs) {
    return { input_volume: 0, output_volume: 0, ratio: 0, efficiency: 'N/A' };
  }
  
  const inputVolume = order.inputs.reduce((sum, i) => {
    const part = StockManager.findPartById(i.part_id);
    return sum + partVolumeM3(part) * (parseFloat(i.quantity) || 0);
  }, 0);

  const outputVolume = order.outputs.reduce((sum, o) => {
    const part = o.part_id ? StockManager.findPartById(o.part_id) : null;
    return sum + partVolumeM3(part) * (parseFloat(o.quantity) || 0);
  }, 0);
  
  const ratio = inputVolume > 0 ? (outputVolume / inputVolume) : 0;
  const efficiency = ratio > 0.6 ? 'Excellent' : ratio > 0.4 ? 'Bon' : ratio > 0.2 ? 'Moyen' : 'Faible';
  
  return {
    input_volume: inputVolume.toFixed(2),
    output_volume: outputVolume.toFixed(2),
    ratio: (ratio * 100).toFixed(1) + '%',
    efficiency
  };
}

// ============================================================================
// INTÉGRATION AVEC ofPostSciageOutput() EXISTANT
// ============================================================================

/**
 * Wrapper pour ofPostSciageOutput avec tracking
 * Appeler APRÈS ofPostSciageOutput() standard
 */
function ofPostSciageOutputWithTracking(of) {
  // 1. Appeler la fonction originale
  if (typeof ofPostSciageOutput === 'function') {
    ofPostSciageOutput(of);
  }
  
  // 2. Trouver le BuildOrder correspondant
  const buildOrderId = of.build_order_id;
  if (!buildOrderId) {
    errLog('of-tracking', 'trackOf', 'OF sans build_order_id, tracking ignoré', 'warn');
    return;
  }
  
  // 3. Calculer les outputs (semi-finis produits)
  const outputs = buildWipOutputsFromOf(of);
  
  // 4. Compléter le BuildOrder
  completeOfWithTracking(buildOrderId, {
    part_id: outputs.part_id,
    quantity: outputs.quantity,
    batch: outputs.batch,
    metadata: {
      post_id: of.poste,
      operator: currentUser?.uid,
      production_time: Date.now() - (of.start_time || Date.now())
    }
  });
}

/**
 * Construit les outputs WIP depuis les données OF
 */
function buildWipOutputsFromOf(of) {
  return {
    part_id: `part_sf_${of.epaisseur || 'std'}x${of.largeur || 'std'}`,
    quantity: of.nb_pieces || 1,
    batch: `LOT-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${of.id?.substr(0, 4) || 'XXXX'}`
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createOfWithTracking,
    linkInputsToBuildOrder,
    completeOfWithTracking,
    getTrackedBuildOrders,
    calculateTransformationRatio,
    partVolumeM3,
    ofPostSciageOutputWithTracking
  };
} else {
  window.OfTracking = {
    createWithTracking: createOfWithTracking,
    linkInputs: linkInputsToBuildOrder,
    complete: completeOfWithTracking,
    getTracked: getTrackedBuildOrders,
    calculateRatio: calculateTransformationRatio,
    partVolumeM3: partVolumeM3,
    postSciageWithTracking: ofPostSciageOutputWithTracking
  };
}
