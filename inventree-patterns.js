/**
 * INVENTREE-PATTERNS.JS — Techniques avancées copiées d'InvenTree
 * Adaptées pour CharbenAPK (vanilla JS, offline-first, zéro serveur)
 * Date: 2026-09-11
 */

'use strict';

// ============================================================================
// 1. GÉNÉRATION DE NUMÉROS DE LOT/BATCH (pattern InvenTree)
// ============================================================================

/**
 * Génère un numéro de lot unique avec séquence incrémentale
 * Format: LOT-YYYYMMDD-{PREFIX}-{SEQ:4digits}
 * 
 * @param {string} prefix - Préfixe métier (GR=grume, SF=semi-fini, PF=produit fini, OF=ordre fabrication)
 * @returns {string} Numéro de lot unique
 */
function generateBatchNumber(prefix = 'GEN') {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const storeKey = `charben_batch_seq_${today}_${prefix}`;
  
  // Incrémenter la séquence
  let seq = parseInt(localStorage.getItem(storeKey) || '0', 10) + 1;
  localStorage.setItem(storeKey, String(seq));
  
  // Format: LOT-20260911-GR-0001
  return `LOT-${today}-${prefix}-${String(seq).padStart(4, '0')}`;
}

/**
 * Génère un numéro de série unique (pour tracking individuel)
 * Format: SN-{CATEGORY}-{SEQ:6digits}
 */
function generateSerialNumber(category = 'ITEM') {
  const storeKey = `charben_serial_seq_${category}`;
  let seq = parseInt(localStorage.getItem(storeKey) || '0', 10) + 1;
  localStorage.setItem(storeKey, String(seq));
  return `SN-${category}-${String(seq).padStart(6, '0')}`;
}

/**
 * Génère une référence OF unique
 * Format: OF-{POSTE}-YYYYMMDD-{SEQ:3digits}
 */
function generateOfReference(poste = 'A1') {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const storeKey = `charben_of_seq_${today}_${poste}`;
  let seq = parseInt(localStorage.getItem(storeKey) || '0', 10) + 1;
  localStorage.setItem(storeKey, String(seq));
  return `OF-${poste}-${today}-${String(seq).padStart(3, '0')}`;
}

// ============================================================================
// 2. STATE MACHINE — Statuts stock avec transitions valides (pattern InvenTree)
// ============================================================================

const STOCK_STATUS_MACHINE = {
  // Définition des statuts (codes inspirés InvenTree)
  STATUSES: {
    ASSIGNABLE:      { code: 10, label: 'Assignable',      color: '#10b981', icon: '✓' },
    RESERVED:        { code: 15, label: 'Réservé',         color: '#f59e0b', icon: '🔒' },
    IN_PRODUCTION:   { code: 20, label: 'En production',   color: '#3b82f6', icon: '⚙️' },
    IN_SECHAGE:      { code: 25, label: 'En séchage',      color: '#8b5cf6', icon: '🌡️' },
    INSTALLED:       { code: 55, label: 'Installé',        color: '#06b6d4', icon: '📍' },
    QUARANTINE:      { code: 65, label: 'Quarantaine',     color: '#ef4444', icon: '⚠️' },
    REJECTED:        { code: 70, label: 'Rejeté',          color: '#dc2626', icon: '✗' },
    LOST:            { code: 75, label: 'Perdu',           color: '#6b7280', icon: '❓' },
    RETURNED:        { code: 80, label: 'Retourné',        color: '#8b5cf6', icon: '↩️' },
    DESTROYED:       { code: 85, label: 'Détruit',         color: '#7f1d1d', icon: '🗑️' },
    REJECTED_VENDOR: { code: 90, label: 'Rejeté fournisseur', color: '#b91c1c', icon: '📦' }
  },
  
  // Transitions autorisées (state machine)
  TRANSITIONS: {
    10: [15, 20, 65],           // ASSIGNABLE → RESERVED, IN_PRODUCTION, QUARANTINE
    15: [10, 20, 65],           // RESERVED → ASSIGNABLE, IN_PRODUCTION, QUARANTINE
    20: [25, 55, 65, 70],       // IN_PRODUCTION → IN_SECHAGE, INSTALLED, QUARANTINE, REJECTED
    25: [10, 55, 65, 70],       // IN_SECHAGE → ASSIGNABLE, INSTALLED, QUARANTINE, REJECTED
    55: [10, 65, 75],           // INSTALLED → ASSIGNABLE, QUARANTINE, LOST
    65: [10, 70, 75, 85, 90],   // QUARANTINE → ASSIGNABLE, REJECTED, LOST, DESTROYED, REJECTED_VENDOR
    70: [85, 90],               // REJECTED → DESTROYED, REJECTED_VENDOR
    75: [10, 85],               // LOST → ASSIGNABLE (si retrouvé), DESTROYED
    80: [10],                   // RETURNED → ASSIGNABLE
    85: [],                     // DESTROYED → (terminal)
    90: []                      // REJECTED_VENDOR → (terminal)
  }
};

/**
 * Vérifie si une transition de statut est valide
 * @param {number} fromStatus - Code statut actuel
 * @param {number} toStatus - Code statut cible
 * @returns {boolean}
 */
function isValidStatusTransition(fromStatus, toStatus) {
  const allowed = STOCK_STATUS_MACHINE.TRANSITIONS[fromStatus];
  return allowed ? allowed.includes(toStatus) : false;
}

/**
 * Change le statut d'un StockItem avec validation
 * @param {string} stockItemId
 * @param {number} newStatus
 * @param {string} [reason] - Raison du changement (audit)
 */
function changeStockStatus(stockItemId, newStatus, reason = '') {
  const stock = loadStock();
  const item = stock.find(s => s.id === stockItemId);
  
  if (!item) {
    throw new Error(`StockItem ${stockItemId} introuvable`);
  }
  
  const oldStatus = item.status;
  
  // Valider la transition
  if (!isValidStatusTransition(oldStatus, newStatus)) {
    const oldLabel = getStatusLabel(oldStatus);
    const newLabel = getStatusLabel(newStatus);
    throw new Error(`Transition invalide: ${oldLabel} → ${newLabel}`);
  }
  
  // Appliquer le changement
  item.status = newStatus;
  item.updated_at = Date.now();
  item.status_history = item.status_history || [];
  item.status_history.push({
    from: oldStatus,
    to: newStatus,
    timestamp: Date.now(),
    user: currentUser?.uid || 'system',
    reason
  });
  
  saveStock(stock);
  
  // Log transaction
  TransactionLogger.log({
    type: 'stock_status_changed',
    stock_item_id: stockItemId,
    from_location: oldStatus,
    to_location: newStatus,
    details: { reason, old_status: oldStatus, new_status: newStatus }
  });
}

/**
 * Récupère le label d'un statut
 */
function getStatusLabel(statusCode) {
  for (const key of Object.keys(STOCK_STATUS_MACHINE.STATUSES)) {
    if (STOCK_STATUS_MACHINE.STATUSES[key].code === statusCode) {
      return STOCK_STATUS_MACHINE.STATUSES[key].label;
    }
  }
  return `Status ${statusCode}`;
}

// ============================================================================
// 3. STOCK RÉSERVÉ vs DISPONIBLE (pattern InvenTree)
// ============================================================================

/**
 * Calcule le stock disponible pour une Part (exclut réservé)
 * @param {string} partId
 * @returns {Object} { total, reserved, available, by_location }
 */
function calculateAvailableStock(partId) {
  const stock = loadStock();
  const items = stock.filter(s => s.part_id === partId);
  
  const result = {
    total: 0,
    reserved: 0,
    available: 0,
    in_production: 0,
    quarantine: 0,
    by_location: {}
  };
  
  items.forEach(item => {
    const qty = item.quantity || 0;
    result.total += qty;
    
    // Comptabiliser par statut
    if (item.status === STOCK_STATUS_MACHINE.STATUSES.RESERVED.code) {
      result.reserved += qty;
    } else if (item.status === STOCK_STATUS_MACHINE.STATUSES.IN_PRODUCTION.code) {
      result.in_production += qty;
    } else if (item.status === STOCK_STATUS_MACHINE.STATUSES.QUARANTINE.code) {
      result.quarantine += qty;
    } else if (item.status === STOCK_STATUS_MACHINE.STATUSES.ASSIGNABLE.code) {
      result.available += qty;
    }
    
    // Par location
    const loc = item.location_id || 'unknown';
    if (!result.by_location[loc]) {
      result.by_location[loc] = { total: 0, available: 0 };
    }
    result.by_location[loc].total += qty;
    if (item.status === STOCK_STATUS_MACHINE.STATUSES.ASSIGNABLE.code) {
      result.by_location[loc].available += qty;
    }
  });
  
  return result;
}

/**
 * Réserve du stock pour un OF
 * @param {string} partId
 * @param {number} quantity
 * @param {string} buildOrderId
 * @returns {Array<string>} IDs des StockItems réservés
 */
function reserveStockForBuildOrder(partId, quantity, buildOrderId) {
  const stock = loadStock();
  const available = stock.filter(s => 
    s.part_id === partId && 
    s.status === STOCK_STATUS_MACHINE.STATUSES.ASSIGNABLE.code &&
    s.quantity > 0
  ).sort((a, b) => a.quantity - b.quantity); // FIFO (plus petit d'abord)
  
  let remaining = quantity;
  const reserved = [];
  
  for (const item of available) {
    if (remaining <= 0) break;
    
    const qtyToReserve = Math.min(item.quantity, remaining);
    
    // Si réservation partielle, splitter le StockItem
    if (qtyToReserve < item.quantity) {
      const newItem = {
        ...item,
        id: generateUUID(),
        quantity: qtyToReserve,
        status: STOCK_STATUS_MACHINE.STATUSES.RESERVED.code,
        metadata: { ...item.metadata, reserved_for: buildOrderId },
        created_at: Date.now(),
        updated_at: Date.now()
      };
      stock.push(newItem);
      item.quantity -= qtyToReserve;
      item.updated_at = Date.now();
      reserved.push(newItem.id);
    } else {
      // Réservation totale
      item.status = STOCK_STATUS_MACHINE.STATUSES.RESERVED.code;
      item.metadata = item.metadata || {};
      item.metadata.reserved_for = buildOrderId;
      item.updated_at = Date.now();
      reserved.push(item.id);
    }
    
    remaining -= qtyToReserve;
  }
  
  if (remaining > 0) {
    throw new Error(`Stock insuffisant: manque ${remaining} unités`);
  }
  
  saveStock(stock);
  
  TransactionLogger.log({
    type: 'stock_reserved',
    part_id: partId,
    quantity,
    build_order_id: buildOrderId,
    stock_item_ids: reserved
  });
  
  return reserved;
}

// ============================================================================
// 4. TRAÇABILITÉ PARENT/ENFANT (pattern InvenTree)
// ============================================================================

/**
 * Structure de traçabilité enrichie
 * Chaque StockItem garde trace de son origine et de ses descendants
 */
function createTrackedStockItem(data) {
  const item = {
    id: generateUUID(),
    part_id: data.part_id,
    quantity: data.quantity,
    location_id: data.location_id,
    status: data.status || STOCK_STATUS_MACHINE.STATUSES.ASSIGNABLE.code,
    batch: data.batch || generateBatchNumber('ITEM'),
    serial: data.serial || null,
    
    // Traçabilité parent/enfant
    parent_batch: data.parent_batch || null,
    parent_stock_item_id: data.parent_stock_item_id || null,
    children_ids: [],
    
    // Métadonnées enrichies
    supplier_ref: data.supplier_ref || null,
    origin_type: data.origin_type || 'production', // 'purchase', 'production', 'transfer'
    created_from: data.created_from || null, // ex: référence OF
    expiry_date: data.expiry_date || null,
    
    // Audit trail intégré
    history: [{
      action: 'created',
      timestamp: Date.now(),
      user: currentUser?.uid || 'system',
      details: data.notes || ''
    }],
    
    // Champs standards
    created_at: Date.now(),
    updated_at: Date.now(),
    owner_uid: currentUser?.uid || 'system',
    metadata: data.metadata || {}
  };
  
  // Lier au parent si fourni
  if (item.parent_stock_item_id) {
    linkParentChildStockItems(item.parent_stock_item_id, item.id);
  }
  
  return item;
}

/**
 * Lie un StockItem parent à son enfant
 */
function linkParentChildStockItems(parentId, childId) {
  const stock = loadStock();
  const parent = stock.find(s => s.id === parentId);
  const child = stock.find(s => s.id === childId);
  
  if (parent && child) {
    parent.children_ids = parent.children_ids || [];
    parent.children_ids.push(childId);
    parent.updated_at = Date.now();
    
    child.parent_stock_item_id = parentId;
    child.parent_batch = parent.batch;
    child.updated_at = Date.now();
    
    saveStock(stock);
  }
}

/**
 * Récupère la chaîne de traçabilité complète (amont)
 * @param {string} stockItemId
 * @returns {Array<Object>} Chaîne des ancêtres
 */
function getTraceabilityUpstream(stockItemId) {
  const stock = loadStock();
  const chain = [];
  let currentId = stockItemId;
  let iterations = 0;
  const maxIterations = 50; // Protection boucle infinie
  
  while (currentId && iterations < maxIterations) {
    const item = stock.find(s => s.id === currentId);
    if (!item) break;
    
    chain.push({
      id: item.id,
      batch: item.batch,
      part_id: item.part_id,
      location_id: item.location_id,
      status: item.status,
      created_at: item.created_at,
      origin_type: item.origin_type
    });
    
    currentId = item.parent_stock_item_id;
    iterations++;
  }
  
  return chain;
}

/**
 * Récupère la chaîne de traçabilité complète (aval)
 * @param {string} stockItemId
 * @returns {Array<Object>} Tous les descendants
 */
function getTraceabilityDownstream(stockItemId) {
  const stock = loadStock();
  const chain = [];
  const toProcess = [stockItemId];
  const processed = new Set();
  
  while (toProcess.length > 0) {
    const currentId = toProcess.shift();
    if (processed.has(currentId)) continue;
    processed.add(currentId);
    
    const item = stock.find(s => s.id === currentId);
    if (!item) continue;
    
    chain.push({
      id: item.id,
      batch: item.batch,
      part_id: item.part_id,
      quantity: item.quantity,
      location_id: item.location_id,
      status: item.status
    });
    
    // Ajouter les enfants à traiter
    if (item.children_ids && item.children_ids.length > 0) {
      toProcess.push(...item.children_ids);
    }
  }
  
  return chain;
}

// ============================================================================
// 5. BARCODE/QR FORMAT (pattern InvenTree)
// ============================================================================

const BARCODE_FORMATS = {
  // Format: {TYPE}-{ID}
  // Types: PART, STOCK, LOCATION, BUILD, BATCH
  PATTERNS: {
    PART: /^PART-(.+)$/,
    STOCK: /^STOCK-(.+)$/,
    LOCATION: /^LOC-(.+)$/,
    BUILD: /^BUILD-(.+)$/,
    BATCH: /^BATCH-(.+)$/,
    SERIAL: /^SN-(.+)$/
  },
  
  PREFIXES: {
    PART: 'PART',
    STOCK: 'STOCK',
    LOCATION: 'LOC',
    BUILD: 'BUILD',
    BATCH: 'BATCH',
    SERIAL: 'SN'
  }
};

/**
 * Génère un barcode pour une entité
 * @param {string} type - PART, STOCK, LOCATION, BUILD, BATCH, SERIAL
 * @param {string} id - Identifiant de l'entité
 * @returns {string} Barcode
 */
function generateBarcode(type, id) {
  const prefix = BARCODE_FORMATS.PREFIXES[type];
  if (!prefix) {
    throw new Error(`Type de barcode invalide: ${type}`);
  }
  return `${prefix}-${id}`;
}

/**
 * Parse un barcode et retourne son type et ID
 * @param {string} barcode
 * @returns {Object} { type, id, valid }
 */
function parseBarcode(barcode) {
  if (!barcode || typeof barcode !== 'string') {
    return { valid: false, error: 'Barcode vide ou invalide' };
  }
  
  for (const [type, pattern] of Object.entries(BARCODE_FORMATS.PATTERNS)) {
    const match = barcode.match(pattern);
    if (match) {
      return { valid: true, type, id: match[1] };
    }
  }
  
  return { valid: false, error: 'Format barcode non reconnu' };
}

/**
 * Action déclenchée par scan barcode
 * @param {string} barcode - Barcode scanné
 * @param {string} context - Contexte actuel (stock_view, of_view, etc.)
 * @returns {Object} Action à effectuer
 */
function handleBarcodeScan(barcode, context = 'general') {
  const parsed = parseBarcode(barcode);
  
  if (!parsed.valid) {
    return { success: false, error: parsed.error };
  }
  
  const actions = {
    PART: () => {
      const part = StockManager.findPartById(parsed.id);
      return {
        success: true,
        action: 'view_part',
        entity: part,
        message: part ? `Part: ${part.name}` : `Part introuvable: ${parsed.id}`
      };
    },
    
    STOCK: () => {
      const stock = loadStock().find(s => s.id === parsed.id);
      return {
        success: true,
        action: 'view_stock_item',
        entity: stock,
        message: stock ? `Stock: ${stock.batch || stock.id}` : `Stock introuvable: ${parsed.id}`
      };
    },
    
    LOCATION: () => {
      const locName = getLocationName(parsed.id);
      return {
        success: true,
        action: 'view_location',
        entity: { id: parsed.id, name: locName },
        message: `Location: ${locName}`
      };
    },
    
    BUILD: () => {
      const orders = JSON.parse(localStorage.getItem('charben_build_orders') || '[]');
      const order = orders.find(o => o.id === parsed.id);
      return {
        success: true,
        action: 'view_build_order',
        entity: order,
        message: order ? `OF: ${order.reference}` : `OF introuvable: ${parsed.id}`
      };
    },
    
    BATCH: () => {
      const items = loadStock().filter(s => s.batch === parsed.id);
      return {
        success: true,
        action: 'view_batch',
        entity: { batch: parsed.id, items },
        message: `Batch: ${parsed.id} (${items.length} items)`
      };
    },
    
    SERIAL: () => {
      const item = loadStock().find(s => s.serial === parsed.id);
      return {
        success: true,
        action: 'view_serial',
        entity: item,
        message: item ? `Série: ${parsed.id}` : `Série introuvable: ${parsed.id}`
      };
    }
  };
  
  const handler = actions[parsed.type];
  if (handler) {
    return handler();
  }
  
  return { success: false, error: `Type non supporté: ${parsed.type}` };
}

// ============================================================================
// 6. FILE D'ATTENTE OFFLINE (pattern InvenTree)
// ============================================================================

/**
 * Structure de la file d'attente offline
 * Stockée dans localStorage, rejouée quand online
 */
const OFFLINE_QUEUE_KEY = 'charben_offline_queue';

/**
 * Ajoute une opération à la file d'attente
 * @param {Object} operation
 */
function queueOfflineOperation(operation) {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  
  queue.push({
    id: generateUUID(),
    timestamp: Date.now(),
    type: operation.type,
    data: operation.data,
    retries: 0,
    max_retries: 3,
    status: 'pending' // pending, processing, completed, failed
  });
  
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Traite la file d'attente (appelé quand online)
 */
async function processOfflineQueue() {
  if (!navigator.onLine) {
    errLog('inventree', 'offlineQueue', 'Offline, file d\'attente non trait\u00e9e', 'info');
    return;
  }
  
  const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  const pending = queue.filter(op => op.status === 'pending');
  
  for (const op of pending) {
    try {
      op.status = 'processing';
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      
      // Exécuter l'opération
      await executeOfflineOperation(op);
      
      op.status = 'completed';
    } catch (error) {
      op.retries++;
      op.last_error = error.message;
      
      if (op.retries >= op.max_retries) {
        op.status = 'failed';
      } else {
        op.status = 'pending'; // Réessayer plus tard
      }
    }
    
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  }
  
  // Nettoyer les opérations complétées de plus de 24h
  const cleaned = queue.filter(op => 
    op.status !== 'completed' || (Date.now() - op.timestamp) < 24 * 60 * 60 * 1000
  );
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(cleaned));
}

/**
 * Exécute une opération de la file
 */
async function executeOfflineOperation(op) {
  // Dispatch selon le type
  switch (op.type) {
    case 'stock_add':
      return createStockItem(op.data);
    case 'stock_move':
      return moveStock(op.data.stock_item_id, op.data.to_location, op.data.quantity);
    case 'stock_consume':
      return consumeStock(op.data.stock_item_id, op.data.quantity, op.data.build_order_id);
    case 'build_order_complete':
      return completeBuildOrder(op.data.build_order_id, op.data.outputs);
    default:
      throw new Error(`Type d'opération inconnu: ${op.type}`);
  }
}

// Écouter le retour online
window.addEventListener('online', () => {
  errLog('inventree', 'online', 'Retour online, traitement de la file d\'attente...', 'info');
  processOfflineQueue();
});

// ============================================================================
// 7. PAGINATION & RECHERCHE OPTIMISÉE (pattern InvenTree)
// ============================================================================

/**
 * Pagination générique pour grandes collections
 * @param {Array} items - Collection complète
 * @param {Object} options
 * @returns {Object} { results, total, page, per_page, total_pages }
 */
function paginateItems(items, options = {}) {
  const page = options.page || 1;
  const perPage = options.per_page || 50;
  const offset = (page - 1) * perPage;
  
  return {
    results: items.slice(offset, offset + perPage),
    total: items.length,
    page,
    per_page: perPage,
    total_pages: Math.ceil(items.length / perPage)
  };
}

/**
 * Recherche optimisée avec index
 * Crée un index au premier appel, puis réutilise
 */
const searchIndexes = {};

function buildSearchIndex(collection, fields) {
  const items = JSON.parse(localStorage.getItem(collection) || '[]');
  const index = {};
  
  items.forEach(item => {
    fields.forEach(field => {
      const value = item[field];
      if (value) {
        const key = String(value).toLowerCase();
        if (!index[key]) index[key] = [];
        index[key].push(item);
      }
    });
  });
  
  searchIndexes[collection] = { index, fields, timestamp: Date.now() };
  return index;
}

function searchWithIndex(collection, query, fields) {
  const items = JSON.parse(localStorage.getItem(collection) || '[]');
  if (!query || !query.trim()) return items;
  return FuzzySearch.filterItems(items, query, fields);
}

// ============================================================================
// 8. PERMISSIONS PAR RÔLE (pattern InvenTree)
// ============================================================================
// DEPRECATED : utiliser checkPermission() depuis modules/permissions.js

/**
 * Vérifie si l'utilisateur courant a une permission
 * @param {string} resource - ex. 'grumes', 'planning'
 * @param {string} action - ex. 'view', 'edit', 'scan'
 * @returns {boolean}
 */
function hasPermission(resource, action) {
  const role = (typeof currentRole !== 'undefined' && currentRole) ? currentRole : (localStorage.getItem('charben_user_role') || 'production');
  return checkPermission(role, resource, action);
}

/**
 * Middleware de protection (à appeler avant actions sensibles)
 * @param {string} resource
 * @param {string} action
 * @throws Error si non autorisé
 */
function requirePermission(resource, action) {
  if (!hasPermission(resource, action)) {
    throw new Error(`Permission refusée: ${action} sur ${resource}`);
  }
}

// ============================================================================
// UTILITAIRES
// ============================================================================

function getLocationName(locationId) {
  if (!locationId) return 'Inconnu';
  const locs = window.StockManager?.LOCATIONS || {};
  for (const key of Object.keys(locs)) {
    if (locs[key].id === locationId) return locs[key].name;
    if (locs[key].children) {
      for (const ckey of Object.keys(locs[key].children)) {
        if (locs[key].children[ckey].id === locationId) return locs[key].children[ckey].name;
      }
    }
  }
  return locationId;
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Raccourcis vers fonctions stock.js
function loadStock() {
  return JSON.parse(localStorage.getItem('charben_stock_items') || '[]');
}

function saveStock(stock) {
  localStorage.setItem('charben_stock_items', JSON.stringify(stock));
  if (typeof fsSave === 'function') fsSave('stockItems', stock);
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateBatchNumber,
    generateSerialNumber,
    generateOfReference,
    STOCK_STATUS_MACHINE,
    isValidStatusTransition,
    changeStockStatus,
    calculateAvailableStock,
    reserveStockForBuildOrder,
    createTrackedStockItem,
    getTraceabilityUpstream,
    getTraceabilityDownstream,
    generateBarcode,
    parseBarcode,
    handleBarcodeScan,
    queueOfflineOperation,
    processOfflineQueue,
    paginateItems,
    searchWithIndex,
    hasPermission,
    requirePermission
  };
} else {
  window.InvenTreePatterns = {
    // Génération
    generateBatchNumber,
    generateSerialNumber,
    generateOfReference,
    
    // State machine
    STATUS: STOCK_STATUS_MACHINE,
    canTransition: isValidStatusTransition,
    changeStatus: changeStockStatus,
    
    // Stock disponible
    getAvailable: calculateAvailableStock,
    reserve: reserveStockForBuildOrder,
    
    // Traçabilité
    createTracked: createTrackedStockItem,
    traceUp: getTraceabilityUpstream,
    traceDown: getTraceabilityDownstream,
    
    // Barcode
    genBarcode: generateBarcode,
    parseBarcode,
    scanBarcode: handleBarcodeScan,
    
    // Offline
    queue: queueOfflineOperation,
    processQueue: processOfflineQueue,
    
    // Recherche
    paginate: paginateItems,
    search: searchWithIndex,
    
    // Permissions — source de vérité dans modules/permissions.js
    can: hasPermission,
    require: requirePermission
  };
}
