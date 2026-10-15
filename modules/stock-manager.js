/**
 * STOCK.JS — Système de gestion stock inspiré d'InvenTree
 * Scierie Charben — Zero dépendance externe
 * Données: Firebase/Firestore + localStorage (offline-first)
 * Date: 2026-09-11
 */

'use strict';

// ============================================================================
// CONFIGURATION — Locations physiques (hiérarchie)
// ============================================================================

const STOCK_LOCATIONS = {
  PARC_GRUMES: {
    id: 'loc_parc',
    name: 'Parc à grumes',
    type: 'storage',
    parent: null,
    description: 'Stock grumes brutes (MP)'
  },
  ATELIER: {
    id: 'loc_atelier',
    name: 'Atelier',
    type: 'production',
    parent: null,
    children: {
      A1: { id: 'loc_a1', name: 'Poste A1', description: 'Débit grume — découpe épaisseurs selon OF (ex. 2 CC + 2 SB)' },
      A2: { id: 'loc_a2', name: 'Poste A2', description: 'Découpe largeurs CC (ex. madrier 125 + chevron 10)' },
      A3: { id: 'loc_a3', name: 'Poste A3', description: 'Découpe largeurs SB — semi-finis en attente séchage' },
      A4: { id: 'loc_a4', name: 'Poste A4', description: 'Récupération dosses — paramètres spéciaux (recyclage max)' },
      B1: { id: 'loc_b1', name: 'Poste B1', description: 'Débit grume — découpe épaisseurs selon OF (ex. 2 CC + 2 SB)' },
      B2: { id: 'loc_b2', name: 'Poste B2', description: 'Découpe largeurs CC (ex. madrier 125 + chevron 10)' },
      B3: { id: 'loc_b3', name: 'Poste B3', description: 'Découpe largeurs SB — semi-finis en attente séchage' },
      B4: { id: 'loc_b4', name: 'Poste B4', description: 'Récupération dosses — paramètres spéciaux (recyclage max)' }
    }
  },
  SECHAGE: {
    id: 'loc_sechage',
    name: 'Zone séchage',
    type: 'storage',
    parent: null,
    description: 'WIP semi-finis en cours de séchage'
  },
  STOCK_PF: {
    id: 'loc_pf',
    name: 'Stock produits finis',
    type: 'storage',
    parent: null,
    description: 'Pièces finies conformes'
  }
};

// ============================================================================
// CATEGORIES DE PARTS (références produits)
// ============================================================================

const PART_CATEGORIES = {
  MATIERE_PREMIERE: { id: 'cat_mp', name: 'Matière première', icon: '🪵' },
  SEMI_FINI: { id: 'cat_sf', name: 'Semi-finis', icon: '📐' },
  PRODUIT_FINI: { id: 'cat_pf', name: 'Produits finis', icon: '✅' }
};

// ============================================================================
// STATUS STOCK (cycle de vie)
// ============================================================================

const STOCK_STATUS = {
  DISPONIBLE: { code: 10, label: 'Disponible', color: '#10b981' },
  EN_COURS: { code: 20, label: 'En cours utilisation', color: '#f59e0b' },
  CONSOMME: { code: 30, label: 'Consommé', color: '#6b7280' },
  EN_SECHAGE: { code: 40, label: 'En séchage', color: '#3b82f6' },
  QUARANTAINE: { code: 50, label: 'Quarantaine (QC)', color: '#ef4444' },
  CONFORME: { code: 60, label: 'Conforme (transférable PF)', color: '#10b981' }
};

// ============================================================================
// STRUCTURE DONNÉES — Collections localStorage/Firestore
// ============================================================================

/**
 * Collection: charben_parts
 * Structure Part (référence produit)
 * 
 * @typedef {Object} Part
 * @property {string} id - UUID unique (généré)
 * @property {string} name - Nom court (ex: "grume-001", "planche-25x150")
 * @property {string} category - ID catégorie (cat_mp/cat_sf/cat_pf)
 * @property {string} description - Description longue
 * @property {Object} attributes - Attributs spécifiques métier
 * @property {number} [attributes.diametre_cm] - Diamètre grume (MP)
 * @property {string} [attributes.essence] - Essence bois
 * @property {Object} [attributes.dimensions] - Dimensions pièce (SF/PF)
 * @property {number} [attributes.dimensions.epaisseur_mm]
 * @property {number} [attributes.dimensions.largeur_mm]
 * @property {number} [attributes.dimensions.longueur_mm]
 * @property {boolean} trackable - Si true, tracking par lot obligatoire
 * @property {boolean} active - Si false, référence obsolète
 * @property {number} created_at - Timestamp création
 * @property {string} created_by - UID utilisateur créateur
 */

/**
 * Collection: charben_stock_items
 * Structure StockItem (stock physique)
 * 
 * @typedef {Object} StockItem
 * @property {string} id - UUID unique
 * @property {string} part_id - Référence Part.id
 * @property {number} quantity - Quantité (>0 = en stock, 0 = épuisé)
 * @property {string} location_id - ID location (loc_parc, loc_sechage, etc.)
 * @property {number} status - Code status (STOCK_STATUS)
 * @property {string} [batch] - Numéro de lot/série (obligatoire si Part.trackable=true)
 * @property {string} [serial] - Numéro de série individuel (optionnel)
 * @property {number} [expiry_date] - Timestamp expiration (ex: fin séchage prévue)
 * @property {Object} [metadata] - Métadonnées flexibles (QC, notes, etc.)
 * @property {string} [supplier_ref] - Référence fournisseur/origine (traçabilité amont)
 * @property {number} created_at - Timestamp ajout stock
 * @property {number} updated_at - Timestamp dernière modif
 * @property {string} owner_uid - UID utilisateur propriétaire/responsable
 */

/**
 * Collection: charben_build_orders
 * Structure BuildOrder (OF de transformation) — amélioration OF existants
 * 
 * @typedef {Object} BuildOrder
 * @property {string} id - UUID unique
 * @property {string} reference - Code OF lisible (ex: "OF-2026-09-11-A1-001")
 * @property {string} output_part_id - Part.id produit en sortie
 * @property {number} output_quantity - Quantité cible à produire
 * @property {number} status - 10=pending, 20=production, 30=complete, 40=cancelled
 * @property {Array<Object>} inputs - Liste des inputs consommés
 * @property {string} inputs[].part_id - Part consommée (ex: grume)
 * @property {string} inputs[].stock_item_id - StockItem.id consommé
 * @property {number} inputs[].quantity - Qté consommée
 * @property {Array<Object>} outputs - Liste des outputs produits (WIP/PF)
 * @property {string} outputs[].part_id - Part produite
 * @property {string} outputs[].stock_item_id - StockItem.id créé
 * @property {number} outputs[].quantity - Qté produite
 * @property {string} location_id - Poste de production (loc_a1, loc_b2, etc.)
 * @property {string} [notes] - Notes libres (détails découpe, épaisseurs, etc.)
 * @property {number} scheduled_start - Timestamp début prévu
 * @property {number} [actual_start] - Timestamp début réel
 * @property {number} [actual_end] - Timestamp fin réelle
 * @property {string} responsible_uid - UID opérateur responsable
 * @property {number} created_at
 * @property {number} updated_at
 */

// ============================================================================
// API — Fonctions principales
// ============================================================================

/**
 * Génère un UUID simple (fallback si crypto.randomUUID indisponible)
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Crée une nouvelle Part (référence produit)
 * @param {Object} data - Données part
 * @returns {Part}
 */
function createPart(data) {
  const part = {
    id: generateUUID(),
    name: data.name,
    category: data.category,
    description: data.description || '',
    attributes: data.attributes || {},
    trackable: data.trackable !== false, // Par défaut true
    active: true,
    created_at: Date.now(),
    created_by: currentUser?.uid || 'system'
  };
  
  // Validation basique
  if (!part.name || !part.category) {
    throw new Error('Part invalide: name et category requis');
  }
  
  // Sauvegarder
  const parts = loadParts();
  parts.push(part);
  saveParts(parts);
  
  // Transaction log
  logStockTransaction({
    type: 'part_created',
    part_id: part.id,
    details: { name: part.name, category: part.category }
  });
  
  return part;
}

/**
 * Crée un StockItem (ajout stock physique)
 * @param {Object} data - Données stock
 * @returns {StockItem}
 */
function createStockItem(data) {
  const part = findPartById(data.part_id);
  if (!part) {
    throw new Error(`Part ${data.part_id} introuvable`);
  }
  
  // Vérifier batch obligatoire si trackable
  if (part.trackable && !data.batch) {
    throw new Error(`Batch requis pour Part trackable: ${part.name}`);
  }
  
  const stockItem = {
    id: generateUUID(),
    part_id: data.part_id,
    quantity: data.quantity || 1,
    location_id: data.location_id,
    status: data.status || STOCK_STATUS.DISPONIBLE.code,
    batch: data.batch || null,
    serial: data.serial || null,
    expiry_date: data.expiry_date || null,
    metadata: data.metadata || {},
    supplier_ref: data.supplier_ref || null,
    created_at: Date.now(),
    updated_at: Date.now(),
    owner_uid: currentUser?.uid || 'system'
  };
  
  // Sauvegarder
  const stock = loadStock();
  stock.push(stockItem);
  saveStock(stock);
  
  // Transaction log
  logStockTransaction({
    type: 'stock_added',
    stock_item_id: stockItem.id,
    part_id: stockItem.part_id,
    quantity: stockItem.quantity,
    location_id: stockItem.location_id,
    batch: stockItem.batch
  });
  
  return stockItem;
}

/**
 * Déplace du stock entre locations (ex: Parc → Atelier)
 * @param {string} stockItemId
 * @param {string} toLocationId
 * @param {number} [quantity] - Si partiel, créer nouveau StockItem
 */
function moveStock(stockItemId, toLocationId, quantity = null) {
  const stock = loadStock();
  const item = stock.find(s => s.id === stockItemId);
  
  if (!item) {
    throw new Error(`StockItem ${stockItemId} introuvable`);
  }
  
  const fromLocation = item.location_id;
  
  if (quantity && quantity < item.quantity) {
    // Mouvement partiel: scinder le stock
    item.quantity -= quantity;
    item.updated_at = Date.now();
    
    const newItem = {
      ...item,
      id: generateUUID(),
      quantity,
      location_id: toLocationId,
      created_at: Date.now(),
      updated_at: Date.now()
    };
    stock.push(newItem);
    
    logStockTransaction({
      type: 'stock_split_moved',
      from_stock_item_id: stockItemId,
      new_stock_item_id: newItem.id,
      quantity,
      from_location: fromLocation,
      to_location: toLocationId
    });
  } else {
    // Mouvement total
    item.location_id = toLocationId;
    item.updated_at = Date.now();
    
    logStockTransaction({
      type: 'stock_moved',
      stock_item_id: stockItemId,
      quantity: item.quantity,
      from_location: fromLocation,
      to_location: toLocationId
    });
  }
  
  saveStock(stock);
}

/**
 * Consomme du stock (quantity → 0, status → CONSOMME)
 * @param {string} stockItemId
 * @param {number} quantityConsumed
 * @param {string} [buildOrderId] - Lien vers OF consommateur
 */
function consumeStock(stockItemId, quantityConsumed, buildOrderId = null) {
  const stock = loadStock();
  const item = stock.find(s => s.id === stockItemId);
  
  if (!item) {
    throw new Error(`StockItem ${stockItemId} introuvable`);
  }
  
  if (item.quantity < quantityConsumed) {
    throw new Error(`Stock insuffisant: ${item.quantity} disponible, ${quantityConsumed} demandé`);
  }
  
  item.quantity -= quantityConsumed;
  item.updated_at = Date.now();
  
  if (item.quantity === 0) {
    item.status = STOCK_STATUS.CONSOMME.code;
  }
  
  logStockTransaction({
    type: 'stock_consumed',
    stock_item_id: stockItemId,
    quantity_consumed: quantityConsumed,
    remaining: item.quantity,
    build_order_id: buildOrderId,
    location_id: item.location_id
  });
  
  saveStock(stock);
}

/**
 * Crée un BuildOrder (OF de transformation)
 * @param {Object} data
 * @returns {BuildOrder}
 */
function createBuildOrder(data) {
  const buildOrder = {
    id: generateUUID(),
    reference: data.reference || `OF-${new Date().toISOString().split('T')[0]}-${generateShortId()}`,
    output_part_id: data.output_part_id,
    output_quantity: data.output_quantity,
    status: 10, // pending
    inputs: data.inputs || [],
    outputs: [],
    location_id: data.location_id,
    notes: data.notes || '',
    scheduled_start: data.scheduled_start || Date.now(),
    actual_start: null,
    actual_end: null,
    responsible_uid: currentUser?.uid || 'system',
    created_at: Date.now(),
    updated_at: Date.now()
  };
  
  const orders = loadBuildOrders();
  orders.push(buildOrder);
  saveBuildOrders(orders);
  
  logStockTransaction({
    type: 'build_order_created',
    build_order_id: buildOrder.id,
    reference: buildOrder.reference,
    output_part_id: buildOrder.output_part_id,
    location_id: buildOrder.location_id
  });
  
  return buildOrder;
}

/**
 * Démarre un BuildOrder (status → production)
 */
function startBuildOrder(buildOrderId) {
  const orders = loadBuildOrders();
  const order = orders.find(o => o.id === buildOrderId);
  
  if (!order) {
    throw new Error(`BuildOrder ${buildOrderId} introuvable`);
  }
  
  if (order.status !== 10) {
    throw new Error(`BuildOrder ${order.reference} déjà démarré ou terminé`);
  }
  
  order.status = 20; // production
  order.actual_start = Date.now();
  order.updated_at = Date.now();
  
  saveBuildOrders(orders);
  
  logStockTransaction({
    type: 'build_order_started',
    build_order_id: buildOrderId,
    reference: order.reference
  });
}

/**
 * Termine un BuildOrder (consomme inputs, crée outputs)
 * @param {string} buildOrderId
 * @param {Array<Object>} outputs - [{part_id, quantity, batch, location_id}]
 */
function completeBuildOrder(buildOrderId, outputs) {
  const orders = loadBuildOrders();
  const order = orders.find(o => o.id === buildOrderId);
  
  if (!order) {
    throw new Error(`BuildOrder ${buildOrderId} introuvable`);
  }
  
  if (order.status !== 20) {
    throw new Error(`BuildOrder ${order.reference} pas en production`);
  }
  
  // 1. Consommer les inputs
  order.inputs.forEach(input => {
    consumeStock(input.stock_item_id, input.quantity, buildOrderId);
  });
  
  // 2. Créer les outputs (WIP/PF)
  const createdOutputs = outputs.map(out => {
    const stockItem = createStockItem({
      part_id: out.part_id,
      quantity: out.quantity,
      location_id: out.location_id || STOCK_LOCATIONS.SECHAGE.id,
      status: out.status || STOCK_STATUS.EN_SECHAGE.code,
      batch: out.batch,
      metadata: { build_order_id: buildOrderId, created_from_of: order.reference }
    });
    return {
      part_id: out.part_id,
      stock_item_id: stockItem.id,
      quantity: out.quantity
    };
  });
  
  order.outputs = createdOutputs;
  order.status = 30; // complete
  order.actual_end = Date.now();
  order.updated_at = Date.now();
  
  saveBuildOrders(orders);
  
  logStockTransaction({
    type: 'build_order_completed',
    build_order_id: buildOrderId,
    reference: order.reference,
    outputs: createdOutputs.length
  });
}

/**
 * Génère un ID court (6 chars alphanumériques)
 */
function generateShortId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ============================================================================
// RECHERCHE & QUERIES
// ============================================================================

/**
 * Trouve une Part par ID
 */
function findPartById(partId) {
  const parts = loadParts();
  return parts.find(p => p.id === partId);
}

/**
 * Recherche Parts par catégorie
 */
function findPartsByCategory(categoryId) {
  const parts = loadParts();
  return parts.filter(p => p.category === categoryId && p.active);
}

/**
 * Recherche StockItems par location
 */
function findStockByLocation(locationId) {
  const stock = loadStock();
  return stock.filter(s => s.location_id === locationId && s.quantity > 0);
}

/**
 * Recherche StockItems par Part
 */
function findStockByPart(partId) {
  const stock = loadStock();
  return stock.filter(s => s.part_id === partId && s.quantity > 0);
}

/**
 * Recherche StockItems par batch (traçabilité)
 */
function findStockByBatch(batch) {
  const stock = loadStock();
  return stock.filter(s => s.batch === batch);
}

/**
 * Calcul stock total d'une Part (somme quantities)
 */
function getTotalStockForPart(partId) {
  const items = findStockByPart(partId);
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Recherche BuildOrders actifs (status=20)
 */
function getActiveBuildOrders() {
  const orders = loadBuildOrders();
  return orders.filter(o => o.status === 20);
}

// ============================================================================
// PERSISTENCE — localStorage + Firestore sync
// ============================================================================

function loadParts() {
  return errSilent('stock-manager', 'loadParts', function() {
    var data = localStorage.getItem('charben_parts');
    return data ? JSON.parse(data) : [];
  }) || [];
}

function saveParts(parts) {
  errSilent('stock-manager', 'saveParts', function() {
    localStorage.setItem('charben_parts', JSON.stringify(parts));
    if (typeof fsSave === 'function') fsSave('parts', parts);
  });
}

function loadStock() {
  return errSilent('stock-manager', 'loadStock', function() {
    var data = localStorage.getItem('charben_stock_items');
    return data ? JSON.parse(data) : [];
  }) || [];
}

function saveStock(stock) {
  errSilent('stock-manager', 'saveStock', function() {
    localStorage.setItem('charben_stock_items', JSON.stringify(stock));
    if (typeof fsSave === 'function') fsSave('stockItems', stock);
  });
}

function loadBuildOrders() {
  return errSilent('stock-manager', 'loadBuildOrders', function() {
    var data = localStorage.getItem('charben_build_orders');
    return data ? JSON.parse(data) : [];
  }) || [];
}

function saveBuildOrders(orders) {
  errSilent('stock-manager', 'saveBuildOrders', function() {
    localStorage.setItem('charben_build_orders', JSON.stringify(orders));
    if (typeof fsSave === 'function') fsSave('buildOrders', orders);
  });
}

// ============================================================================
// EXPORTS (si module ES6) ou attachement global
// ============================================================================

/* ─── Garde-fou mutations ───
 * Les mutations de stock throwent volontairement (contrat d'API). Mais
 * un throw non rattrape laisse l'operateur devant un ecran fige, avec
 * un stock potentiellement desynchronise. On enveloppe donc chaque
 * mutation : log structure + toast utilisateur.
 * Lecture seule (findXxx) : pas d'enveloppe, une exception de lecture
 * doit rester visible au developpeur. */
function _guardMutation(name, fn) {
  return function() {
    try {
      return fn.apply(null, arguments);
    } catch (e) {
      /* errLog/errUser/errAudit n'existent pas hors navigateur (tests Node,
         <script> charge isole). On degrade proprement au lieu de lever
         une ReferenceError qui masquerait l'erreur reelle. */
      if (typeof errLog === 'function') {
        errLog('stock-manager', name, e, 'error');
        if (typeof errUser === 'function') errUser((e && e.message ? e.message : 'Erreur').slice(0, 90), 'Stock');
        if (typeof errAudit === 'function') errAudit('stock_mutation_failed', name);
      } else if (typeof console !== 'undefined') {
        console.error('[stock-manager.' + name + ']', e);
      }
      throw e;
    }
  };
}

var _api = {
  LOCATIONS: STOCK_LOCATIONS,
  CATEGORIES: PART_CATEGORIES,
  STATUS: STOCK_STATUS,
  createPart: _guardMutation('createPart', createPart),
  createStockItem: _guardMutation('createStockItem', createStockItem),
  moveStock: _guardMutation('moveStock', moveStock),
  consumeStock: _guardMutation('consumeStock', consumeStock),
  createBuildOrder: _guardMutation('createBuildOrder', createBuildOrder),
  startBuildOrder: _guardMutation('startBuildOrder', startBuildOrder),
  completeBuildOrder: _guardMutation('completeBuildOrder', completeBuildOrder),
  findPartById,
  findPartsByCategory,
  findStockByLocation,
  findStockByPart,
  findStockByBatch,
  getTotalStockForPart,
  getActiveBuildOrders
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = _api;
} else {
  // Attachement global pour vanilla JS
  window.StockManager = _api;
}
