/**
 * TRANSACTIONS.JS — Historique immutable des mouvements stock
 * Audit trail complet — Scierie Charben
 * Inspiré d'InvenTree, zéro dépendance externe
 * Date: 2026-09-11
 */

'use strict';

// ============================================================================
// TYPES DE TRANSACTIONS (audit trail)
// ============================================================================

const TRANSACTION_TYPES = {
  // Parts
  PART_CREATED: { code: 'part_created', label: 'Part créée', icon: '➕' },
  PART_UPDATED: { code: 'part_updated', label: 'Part modifiée', icon: '✏️' },
  PART_DEACTIVATED: { code: 'part_deactivated', label: 'Part désactivée', icon: '🗑️' },
  
  // Stock
  STOCK_ADDED: { code: 'stock_added', label: 'Stock ajouté', icon: '📥' },
  STOCK_REMOVED: { code: 'stock_removed', label: 'Stock retiré', icon: '📤' },
  STOCK_MOVED: { code: 'stock_moved', label: 'Stock déplacé', icon: '🔄' },
  STOCK_SPLIT_MOVED: { code: 'stock_split_moved', label: 'Stock fractionné et déplacé', icon: '🔀' },
  STOCK_CONSUMED: { code: 'stock_consumed', label: 'Stock consommé', icon: '⚙️' },
  STOCK_ADJUSTED: { code: 'stock_adjusted', label: 'Stock ajusté (inventaire)', icon: '📊' },
  STOCK_STATUS_CHANGED: { code: 'stock_status_changed', label: 'Statut stock modifié', icon: '🏷️' },
  
  // Build Orders (OF)
  BUILD_ORDER_CREATED: { code: 'build_order_created', label: 'OF créé', icon: '📋' },
  BUILD_ORDER_STARTED: { code: 'build_order_started', label: 'OF démarré', icon: '▶️' },
  BUILD_ORDER_COMPLETED: { code: 'build_order_completed', label: 'OF terminé', icon: '✅' },
  BUILD_ORDER_CANCELLED: { code: 'build_order_cancelled', label: 'OF annulé', icon: '❌' },
  
  // Transferts
  TRANSFER_TO_SECHAGE: { code: 'transfer_to_sechage', label: 'Transfert vers séchage', icon: '🌡️' },
  TRANSFER_TO_PF: { code: 'transfer_to_pf', label: 'Transfert vers PF', icon: '📦' },
  
  // Qualité
  QC_PASSED: { code: 'qc_passed', label: 'Contrôle qualité OK', icon: '✔️' },
  QC_FAILED: { code: 'qc_failed', label: 'Contrôle qualité échoué', icon: '⚠️' },
  QC_QUARANTINE: { code: 'qc_quarantine', label: 'Mise en quarantaine', icon: '🔴' }
};

// ============================================================================
// STRUCTURE TRANSACTION (immutable)
// ============================================================================

/**
 * Collection: charben_stock_transactions
 * 
 * @typedef {Object} StockTransaction
 * @property {string} id - UUID unique
 * @property {string} type - Code transaction (TRANSACTION_TYPES)
 * @property {number} timestamp - Date/heure (Date.now())
 * @property {string} user_uid - UID utilisateur auteur
 * @property {string} [part_id] - Part concernée
 * @property {string} [stock_item_id] - StockItem concerné
 * @property {string} [build_order_id] - BuildOrder concerné
 * @property {string} [from_location_id] - Location source (si mouvement)
 * @property {string} [to_location_id] - Location destination (si mouvement)
 * @property {number} [quantity] - Quantité concernée
 * @property {Object} details - Détails additionnels (flexible)
 * @property {string} [details.reference] - Référence lisible (ex: code OF)
 * @property {string} [details.batch] - Numéro de lot
 * @property {string} [details.notes] - Notes libres
 * @property {string} [details.reason] - Raison du mouvement/ajustement
 * @property {Object} [details.previous_state] - État avant modification (snapshot)
 * @property {Object} [details.new_state] - État après modification (snapshot)
 * @property {string} [session_id] - ID session (pour grouper transactions liées)
 */

// ============================================================================
// API — Fonctions principales
// ============================================================================

/**
 * Enregistre une transaction dans l'historique (immutable)
 * @param {Object} data - Données transaction
 * @returns {StockTransaction}
 */
function logStockTransaction(data) {
  const transaction = {
    id: generateUUID(),
    type: data.type,
    timestamp: Date.now(),
    user_uid: currentUser?.uid || localStorage.getItem('charben_user_uid') || 'system',
    part_id: data.part_id || null,
    stock_item_id: data.stock_item_id || null,
    build_order_id: data.build_order_id || null,
    from_location_id: data.from_location || data.from_location_id || null,
    to_location_id: data.to_location || data.to_location_id || null,
    quantity: data.quantity || data.quantity_consumed || null,
    details: data.details || {},
    session_id: data.session_id || getSessionId()
  };
  
  // Ajouter aux transactions
  const transactions = loadTransactions();
  transactions.push(transaction);
  saveTransactions(transactions);
  
  // Sauvegarder dans le log fichier (optionnel, pour export)
  appendToTransactionLog(transaction);
  
  return transaction;
}

/**
 * Récupère l'historique complet d'un StockItem
 * @param {string} stockItemId
 * @returns {Array<StockTransaction>}
 */
function getStockItemHistory(stockItemId) {
  const transactions = loadTransactions();
  return transactions
    .filter(t => t.stock_item_id === stockItemId)
    .sort((a, b) => b.timestamp - a.timestamp); // Plus récent d'abord
}

/**
 * Récupère l'historique d'un batch (traçabilité complète)
 * @param {string} batch
 * @returns {Array<StockTransaction>}
 */
function getBatchHistory(batch) {
  const transactions = loadTransactions();
  return transactions
    .filter(t => t.details.batch === batch)
    .sort((a, b) => a.timestamp - b.timestamp); // Chronologique
}

/**
 * Récupère l'historique d'un BuildOrder
 * @param {string} buildOrderId
 * @returns {Array<StockTransaction>}
 */
function getBuildOrderHistory(buildOrderId) {
  const transactions = loadTransactions();
  return transactions
    .filter(t => t.build_order_id === buildOrderId)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Récupère toutes les transactions d'une période
 * @param {number} startDate - Timestamp début
 * @param {number} endDate - Timestamp fin
 * @returns {Array<StockTransaction>}
 */
function getTransactionsByPeriod(startDate, endDate) {
  const transactions = loadTransactions();
  return transactions.filter(t => 
    t.timestamp >= startDate && t.timestamp <= endDate
  );
}

/**
 * Récupère les transactions par utilisateur
 * @param {string} userUid
 * @returns {Array<StockTransaction>}
 */
function getTransactionsByUser(userUid) {
  const transactions = loadTransactions();
  return transactions.filter(t => t.user_uid === userUid);
}

/**
 * Récupère les transactions par type
 * @param {string} typeCode - Code TRANSACTION_TYPES
 * @returns {Array<StockTransaction>}
 */
function getTransactionsByType(typeCode) {
  const transactions = loadTransactions();
  return transactions.filter(t => t.type === typeCode);
}

/**
 * Recherche transactions par location
 * @param {string} locationId
 * @returns {Array<StockTransaction>}
 */
function getTransactionsByLocation(locationId) {
  const transactions = loadTransactions();
  return transactions.filter(t => 
    t.from_location_id === locationId || t.to_location_id === locationId
  );
}

// ============================================================================
// RAPPORTS & STATISTIQUES
// ============================================================================

/**
 * Génère un rapport d'activité journalier
 * @param {number} date - Timestamp (utilise le jour entier)
 * @returns {Object} Rapport
 */
function generateDailyReport(date) {
  const d = new Date(date);
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const endOfDay = startOfDay + (24 * 60 * 60 * 1000);
  
  const transactions = getTransactionsByPeriod(startOfDay, endOfDay);
  
  const report = {
    date: d.toISOString().split('T')[0],
    total_transactions: transactions.length,
    summary: {},
    details: []
  };
  
  // Compter par type
  Object.keys(TRANSACTION_TYPES).forEach(key => {
    const type = TRANSACTION_TYPES[key];
    const count = transactions.filter(t => t.type === type.code).length;
    if (count > 0) {
      report.summary[key] = count;
    }
  });
  
  // Détails par catégorie
  report.details = transactions.map(t => ({
    time: new Date(t.timestamp).toLocaleTimeString('fr-FR'),
    type: TRANSACTION_TYPES[Object.keys(TRANSACTION_TYPES).find(k => TRANSACTION_TYPES[k].code === t.type)]?.label || t.type,
    user: t.user_uid,
    details: t.details
  }));
  
  return report;
}

/**
 * Génère un rapport de traçabilité pour un lot
 * @param {string} batch
 * @returns {Object} Rapport traçabilité
 */
function generateTraceabilityReport(batch) {
  const transactions = getBatchHistory(batch);
  const stockItems = findStockByBatch ? findStockByBatch(batch) : [];
  
  const report = {
    batch,
    generated_at: new Date().toISOString(),
    transactions_count: transactions.length,
    timeline: transactions.map(t => ({
      date: new Date(t.timestamp).toLocaleString('fr-FR'),
      type: t.type,
      icon: TRANSACTION_TYPES[Object.keys(TRANSACTION_TYPES).find(k => TRANSACTION_TYPES[k].code === t.type)]?.icon || '📌',
      label: TRANSACTION_TYPES[Object.keys(TRANSACTION_TYPES).find(k => TRANSACTION_TYPES[k].code === t.type)]?.label || t.type,
      user: t.user_uid,
      from_location: t.from_location_id,
      to_location: t.to_location_id,
      quantity: t.quantity,
      notes: t.details.notes || ''
    })),
    current_stock: stockItems.map(s => ({
      id: s.id,
      part_id: s.part_id,
      quantity: s.quantity,
      location: s.location_id,
      status: s.status
    })),
    full_chain: buildTraceabilityChain(transactions)
  };
  
  return report;
}

/**
 * Construit la chaîne de traçabilité (origine → destination finale)
 * @param {Array<StockTransaction>} transactions
 * @returns {string} Chaîne lisible
 */
function buildTraceabilityChain(transactions) {
  if (transactions.length === 0) return 'Aucune traçabilité';
  
  const chain = [];
  const locations = window.StockManager?.LOCATIONS || {};
  
  transactions.forEach(t => {
    if (t.type === 'stock_added') {
      chain.push(`Origine: ${locations[t.to_location_id]?.name || t.to_location_id}`);
    } else if (t.type === 'stock_moved' || t.type === 'stock_split_moved') {
      chain.push(`${locations[t.from_location_id]?.name || t.from_location_id} → ${locations[t.to_location_id]?.name || t.to_location_id}`);
    } else if (t.type === 'stock_consumed') {
      chain.push(`Consommé par OF: ${t.build_order_id || 'N/A'}`);
    } else if (t.type === 'transfer_to_sechage') {
      chain.push(`Entrée séchage`);
    } else if (t.type === 'transfer_to_pf') {
      chain.push(`Transfert PF`);
    }
  });
  
  return chain.join(' → ');
}

// ============================================================================
// EXPORT & IMPORT
// ============================================================================

/**
 * Exporte toutes les transactions en JSON
 * @param {number} [startDate] - Optionnel, filtre par date
 * @param {number} [endDate] - Optionnel
 * @returns {string} JSON
 */
function exportTransactionsJSON(startDate, endDate) {
  let transactions = loadTransactions();
  
  if (startDate && endDate) {
    transactions = getTransactionsByPeriod(startDate, endDate);
  }
  
  return JSON.stringify({
    export_date: new Date().toISOString(),
    total_transactions: transactions.length,
    transactions
  }, null, 2);
}

/**
 * Exporte les transactions en CSV (pour Excel)
 * @param {number} [startDate]
 * @param {number} [endDate]
 * @returns {string} CSV
 */
function exportTransactionsCSV(startDate, endDate) {
  let transactions = loadTransactions();
  
  if (startDate && endDate) {
    transactions = getTransactionsByPeriod(startDate, endDate);
  }
  
  const headers = ['ID', 'Date', 'Heure', 'Type', 'Utilisateur', 'Part', 'StockItem', 'BuildOrder', 'De', 'Vers', 'Quantité', 'Notes'];
  const rows = transactions.map(t => [
    t.id,
    new Date(t.timestamp).toLocaleDateString('fr-FR'),
    new Date(t.timestamp).toLocaleTimeString('fr-FR'),
    t.type,
    t.user_uid,
    t.part_id || '',
    t.stock_item_id || '',
    t.build_order_id || '',
    t.from_location_id || '',
    t.to_location_id || '',
    t.quantity || '',
    (t.details.notes || '').replace(/"/g, '""')
  ]);
  
  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

/**
 * Télécharge l'export (génère un fichier blob)
 * @param {string} format - 'json' ou 'csv'
 * @param {number} [startDate]
 * @param {number} [endDate]
 */
function downloadTransactionExport(format, startDate, endDate) {
  let content, filename, mimeType;
  
  if (format === 'csv') {
    content = exportTransactionsCSV(startDate, endDate);
    filename = `charben_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    mimeType = 'text/csv';
  } else {
    content = exportTransactionsJSON(startDate, endDate);
    filename = `charben_transactions_${new Date().toISOString().split('T')[0]}.json`;
    mimeType = 'application/json';
  }
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// PERSISTENCE
// ============================================================================

function loadTransactions() {
  const data = localStorage.getItem('charben_stock_transactions');
  return data ? JSON.parse(data) : [];
}

function saveTransactions(transactions) {
  localStorage.setItem('charben_stock_transactions', JSON.stringify(transactions));
}

function appendToTransactionLog(transaction) {
  // Optionnel: sauvegarder dans un log fichier séparé (pour exports)
  const logKey = `charben_transaction_log_${new Date().toISOString().split('T')[0]}`;
  const existing = localStorage.getItem(logKey);
  const log = existing ? JSON.parse(existing) : [];
  log.push(transaction);
  localStorage.setItem(logKey, JSON.stringify(log));
}

// ============================================================================
// UTILITAIRES
// ============================================================================

function getSessionId() {
  let sessionId = sessionStorage.getItem('charben_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('charben_session_id', sessionId);
  }
  return sessionId;
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TRANSACTION_TYPES,
    logStockTransaction,
    getStockItemHistory,
    getBatchHistory,
    getBuildOrderHistory,
    getTransactionsByPeriod,
    getTransactionsByUser,
    getTransactionsByType,
    getTransactionsByLocation,
    generateDailyReport,
    generateTraceabilityReport,
    exportTransactionsJSON,
    exportTransactionsCSV,
    downloadTransactionExport
  };
} else {
  window.TransactionLogger = {
    TYPES: TRANSACTION_TYPES,
    log: logStockTransaction,
    getStockItemHistory,
    getBatchHistory,
    getBuildOrderHistory,
    getTransactionsByPeriod,
    getTransactionsByUser,
    getTransactionsByType,
    getTransactionsByLocation,
    generateDailyReport,
    generateTraceabilityReport,
    exportJSON: exportTransactionsJSON,
    exportCSV: exportTransactionsCSV,
    downloadExport: downloadTransactionExport
  };
}
