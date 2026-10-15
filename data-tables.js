/* ═══════════════════════════════════════════════════════════════
   MODULE « DONNÉES » — Tableaux de données type ERPNext List View.
   Registre central de toutes les tables de l'application,
   extraction (CSV / Excel / JSON) et import (JSON / CSV / XLSX).
   Charge APRES app.js (utilise loadXlsx, escapeHtml, showModal…).
   ═══════════════════════════════════════════════════════════════ */

var dataCurrentTableId = null;
var dataSearchText = '';

/* Libellés français des champs (colonnes auto-détectées) — version complète */
var DATA_FIELD_LABELS = {
  id: 'ID', ts: 'Horodatage', t: 'Horodatage', date: 'Date', created: 'Créé le',
  createdAt: 'Créé le', updatedAt: 'Mis à jour', user: 'Utilisateur',
  orderNum: 'N° OF', order: 'N° OF', status: 'Statut', client: 'Client',
  reference: 'Référence', essence: 'Essence', centerWidth: 'Largeur de cœur',
  lateralWidths: 'Largeurs lat.', qty: 'Quantité', producedQty: 'Produit',
  plannedStart: 'Début prévu', plannedEnd: 'Fin prévue', actualStart: 'Début réel',
  actualEnd: 'Fin réelle', remarks: 'Remarques', line: 'Ligne',
  item: 'Article', warehouse: 'Magasin', actual_qty: 'Qté réelle',
  reserved_qty: 'Réservé', projected_qty: 'Prévu', balance: 'Solde',
  posting_date: 'Date écriture', voucher_type: 'Type', voucher_no: 'N° voucher',
  is_cancelled: 'Annulé', previous_qty: 'Qté avant', change_qty: 'Variation',
  new_qty: 'Nouvelle qté', reason: 'Motif', machine: 'Machine', pair: 'Paire',
  cote: 'Cote', product: 'Produit', grade: 'Classe',
  inspector: 'Inspecteur', notes: 'Notes', exported: 'Exporté',
  name: 'Nom', code: 'Code', isGroup: 'Groupe', parent: 'Parent',
  supplier: 'Fournisseur', project: 'Projet', task: 'Tâche', assigned: 'Assigné',
  deadline: 'Échéance', priority: 'Priorité', row: 'Rang', pont: 'Pont',
  type: 'Type', totalMeters: 'Mètres', stockTotal: 'Stock total',
  enService: 'En service', lastSharpening: 'Dern. aiguisage',
  totalUsage: 'Usages', avgLife: 'Vie moy.', threshold: 'Seuil',
  planDate: 'Date', title: 'Titre', volumeM3: 'Volume (m³)',
  pieces: 'Pièces', length: 'Longueur', width: 'Largeur', height: 'Hauteur',
  statusLabel: 'Statut', startDate: 'Date début', endDate: 'Date fin',
  openQty: 'Qté ouverte', doneQty: 'Qté faite', defect: 'Défaut',
  count: 'Nombre', shift: 'Poste', operator: 'Opérateur', team: 'Équipe',
  statut: 'Statut', nbPieces: 'Pièces', volumeTotal: 'Volume (m³)',
  batchNum: 'Lot séchage', venduAt: 'Vendu le', sortieSechageAt: 'Sortie séchage',
  bl: 'N° BL', items: 'Pièces du fardeau',
  text: 'Recherche', volume: 'Volume (m³)', longueur: 'Longueur',
  diametre: 'Diamètre', workstation: 'Poste', operation: 'Opération',
  startTs: 'Début', endTs: 'Fin',
  quantity: 'Quantité', rmCost: 'Coût MP', opCost: 'Coût opérations',
  description: 'Description', clientId: 'Client (ID)', clientName: 'Client',
  wood: 'Type de bois', logWidth: 'Largeur bille', central: 'Cœur',
  laterals: 'Latérales', thickness: 'Épaisseur', margin: 'Marge',
  plannedDate: 'Date prévue',
  oldVal: 'Ancienne', newVal: 'Nouvelle', field: 'Champ', time: 'Heure',
  forQty: 'À fabriquer', completedQty: 'Complétée',
  dryStart: 'Début', dryEnd: 'Fin', transferred: 'Transféré',
  species: 'Essence', epaisseur: 'Épaisseur', largeur: 'Largeur',
  qte: 'Qté', contact: 'Contact', phone: 'Téléphone', email: 'Email',
  address: 'Adresse', city: 'Ville'
};

/* Colonnes explicites par table (ordre + libellé). Si absentes → auto-détection. */
var DATA_TABLE_COLUMNS = {
  orders: [
    { k: 'orderNum', label: 'N° OF' },
    { k: 'clientName', label: 'Client' },
    { k: 'reference', label: 'Référence' },
    { k: 'wood', label: 'Type de bois' },
    { k: 'essence', label: 'Essence' },
    { k: 'logWidth', label: 'Grume (mm)' },
    { k: 'length', label: 'Longueur (mm)' },
    { k: 'qty', label: 'Quantité' },
    { k: 'line', label: 'Ligne' },
    { k: 'date', label: 'Date' }
  ],
  ofHistory: [
    { k: 'orderNum', label: 'N° OF' },
    { k: 'field', label: 'Champ' },
    { k: 'ts', label: 'Horodatage' },
    { k: 'oldVal', label: 'Ancienne' },
    { k: 'newVal', label: 'Nouvelle' },
    { k: 'user', label: 'Utilisateur' }
  ],
  rawMaterials: [
    { k: 'code', label: 'Code' },
    { k: 'essence', label: 'Essence' },
    { k: 'longueur', label: 'Longueur' },
    { k: 'diametre', label: 'Diamètre' },
    { k: 'volume', label: 'Volume (m³)' },
    { k: 'statut', label: 'Statut' },
    { k: 'createdAt', label: 'Créé le' }
  ],
  dryingBatches: [
    { k: 'batchNum', label: 'N° lot' },
    { k: 'ofNum', label: 'N° OF' },
    { k: 'species', label: 'Essence' },
    { k: 'status', label: 'Statut' },
    { k: 'dryStart', label: 'Début' },
    { k: 'dryEnd', label: 'Fin' },
    { k: 'transferred', label: 'Transféré' }
  ],
  finishedGoods: [
    { k: 'code', label: 'Réf' },
    { k: 'type', label: 'Type' },
    { k: 'essence', label: 'Essence' },
    { k: 'epaisseur', label: 'Épaisseur' },
    { k: 'largeur', label: 'Largeur' },
    { k: 'longueur', label: 'Longueur' },
    { k: 'qte', label: 'Qté' },
    { k: 'volume', label: 'Volume (m³)' },
    { k: 'statut', label: 'Statut' },
    { k: 'batchNum', label: 'Lot séchage' }
  ],
  fardeaux: [
    { k: 'code', label: 'Réf' },
    { k: 'essence', label: 'Essence' },
    { k: 'nbPieces', label: 'Pièces' },
    { k: 'volumeTotal', label: 'Volume (m³)' },
    { k: 'statut', label: 'Statut' },
    { k: 'batchNum', label: 'Lot séchage' },
    { k: 'client', label: 'Client' },
    { k: 'bl', label: 'N° BL' },
    { k: 'venduAt', label: 'Vendu le' },
    { k: 'sortieSechageAt', label: 'Sortie séchage' }
  ],
  productionPlan: [
    { k: 'reference', label: 'Référence' },
    { k: 'essence', label: 'Essence' },
    { k: 'logWidth', label: 'Largeur bille' },
    { k: 'length', label: 'Longueur' },
    { k: 'qty', label: 'Quantité' },
    { k: 'thickness', label: 'Épaisseur' },
    { k: 'status', label: 'Statut' },
    { k: 'ofNum', label: 'N° OF' },
    { k: 'date', label: 'Date' }
  ],
  auditLogs: [
    { k: 'action', label: 'Action' },
    { k: 'user', label: 'Utilisateur' },
    { k: 'time', label: 'Heure' }
  ],
  ofSavedQueries: [
    { k: 'name', label: 'Nom' },
    { k: 'text', label: 'Recherche' }
  ],
  planningTasks: [
    { k: 'task', label: 'Tâche' },
    { k: 'statusLabel', label: 'Statut' },
    { k: 'priority', label: 'Priorité' },
    { k: 'assigned', label: 'Assigné' },
    { k: 'deadline', label: 'Échéance' }
  ]
};

/* ═══════ REGISTRE DES TABLES ═══════
   id    : clé unique
   label : libellé français
   get() : renvoie les lignes (tableau d'objets plats)
   replace(rows) + persist() : réécrit le global, localStorage + Firestore, re-render
   cols  : colonnes explicites (optionnel)
   noRender : skip le re-render du tableau (gardé)
   vo      : fonctions de rendu à rejouer après import
*/
var DATA_TABLES = [
  {
    id: 'grumes', label: '🪵 Grumes', api: true,
    cols: [
      { k: 'code', label: 'Code' }, { k: 'scan_code', label: 'Code scan' },
      { k: 'essence', label: 'Essence' },
      { k: 'diametre_cm', label: 'Ø (cm)' }, { k: 'longueur_m', label: 'L (m)' },
      { k: 'volume_m3', label: 'Vol (m³)' }, { k: 'statut', label: 'Statut' },
      { k: 'statut_code', label: 'Code statut' },
      { k: 'cree_le_fr', label: 'Reçue le' }
    ],
    totals: [{ k: 'volume_m3', label: 'Vol (m³)' }],
    get: function() { return (typeof TraceAPI !== 'undefined') ? TraceAPI.rows('grumes') : []; },
    replace: function() {}, persist: function() {}
  },
  {
    id: 'of', label: '📋 OFs', api: true,
    cols: [
      { k: 'numero', label: 'N° OF' }, { k: 'statut', label: 'Statut' },
      { k: 'statut_code', label: 'Code statut' }, { k: 'ligne', label: 'Ligne' },
      { k: 'poste', label: 'Poste' },
      { k: 'essence', label: 'Essence' }, { k: 'nb_grumes', label: 'Nb grumes' },
      { k: 'volume_grumes_m3', label: 'Vol grumes (m³)' }, { k: 'nb_pieces', label: 'Nb pièces' },
      { k: 'volume_produit_m3', label: 'Vol produit (m³)' }
    ],
    totals: [
      { k: 'nb_grumes', label: 'Nb grumes' }, { k: 'volume_grumes_m3', label: 'Vol grumes (m³)' },
      { k: 'nb_pieces', label: 'Nb pièces' }, { k: 'volume_produit_m3', label: 'Vol produit (m³)' }
    ],
    get: function() { return (typeof TraceAPI !== 'undefined') ? TraceAPI.rows('of') : []; },
    replace: function() {}, persist: function() {}
  },
  {
    id: 'articles', label: '📦 Articles', api: true,
    cols: [
      { k: 'reference', label: 'Réf' }, { k: 'type', label: 'Type' },
      { k: 'essence', label: 'Essence' }, { k: 'epaisseur_mm', label: 'Ép. (mm)' },
      { k: 'largeur_mm', label: 'Larg. (mm)' }, { k: 'longueur_mm', label: 'Long. (mm)' },
      { k: 'quantite', label: 'Qté' }, { k: 'volume_m3', label: 'Vol (m³)' },
      { k: 'statut', label: 'Statut' }, { k: 'statut_code', label: 'Code statut' },
      { k: 'of_numero', label: 'OF' },
      { k: 'grume_code', label: 'Grume' }, { k: 'lot_numero', label: 'Lot' },
      { k: 'cree_le_fr', label: 'Créé le' }
    ],
    totals: [{ k: 'quantite', label: 'Qté' }, { k: 'volume_m3', label: 'Vol (m³)' }],
    get: function() { return (typeof TraceAPI !== 'undefined') ? TraceAPI.rows('articles') : []; },
    replace: function() {}, persist: function() {}
  },
  {
    id: 'lots', label: '🧺 Lots séchage', api: true,
    cols: [
      { k: 'numero', label: 'N° lot' }, { k: 'essence', label: 'Essence' },
      { k: 'statut', label: 'Statut' }, { k: 'statut_code', label: 'Code statut' },
      { k: 'of_numero', label: 'OF' },
      { k: 'date_debut_fr', label: 'Début' }, { k: 'date_fin_fr', label: 'Fin' }
    ],
    get: function() { return (typeof TraceAPI !== 'undefined') ? TraceAPI.rows('lots') : []; },
    replace: function() {}, persist: function() {}
  },
  {
    id: 'fardeaux', label: '🚚 Fardeaux', api: true,
    cols: [
      { k: 'code', label: 'Code' }, { k: 'statut', label: 'Statut' },
      { k: 'statut_code', label: 'Code statut' },
      { k: 'essence', label: 'Essence' }, { k: 'lot_numero', label: 'Lot' },
      { k: 'client_nom', label: 'Client' }, { k: 'bl_numero', label: 'BL' },
      { k: 'nb_pieces', label: 'Pièces' }, { k: 'volume_m3', label: 'Vol (m³)' },
      { k: 'date_sortie_sechage_fr', label: 'Sortie séchage' }, { k: 'date_vente_fr', label: 'Vente' }
    ],
    totals: [{ k: 'nb_pieces', label: 'Pièces' }, { k: 'volume_m3', label: 'Vol (m³)' }],
    get: function() { return (typeof TraceAPI !== 'undefined') ? TraceAPI.rows('fardeaux') : []; },
    replace: function() {}, persist: function() {}
  },
  {
    id: 'rendement', label: '📈 Rendement', api: true,
    cols: [
      { k: 'numero', label: 'N° OF' }, { k: 'statut', label: 'Statut' },
      { k: 'ligne', label: 'Ligne' }, { k: 'poste', label: 'Poste' },
      { k: 'essence', label: 'Essence' }, { k: 'rendement_pct', label: 'Rendement %' },
      { k: 'rendement_recup_pct', label: 'Récup. dosses %' }, { k: 'couverture', label: 'Couverture' },
      { k: 'nb_grumes', label: 'Nb grumes' }, { k: 'volume_grumes_m3', label: 'Vol grumes (m³)' },
      { k: 'nb_pieces', label: 'Nb pièces' }, { k: 'volume_produit_m3', label: 'Vol produit (m³)' },
      { k: 'nb_dosses', label: 'Nb dosses' }, { k: 'volume_dosses_m3', label: 'Vol dosses (m³)' }
    ],
    totals: [
      { k: 'volume_grumes_m3', label: 'Vol grumes (m³)' }, { k: 'volume_produit_m3', label: 'Vol produit (m³)' },
      { k: 'nb_dosses', label: 'Nb dosses' }, { k: 'volume_dosses_m3', label: 'Vol dosses (m³)' }
    ],
    get: function() { return (typeof TraceAPI !== 'undefined') ? TraceAPI.rows('rendement') : []; },
    replace: function() {}, persist: function() {}
  },
  {
    id: 'wip', label: '🔄 WIP (séchage)', api: true,
    cols: [
      { k: 'reference', label: 'Réf' }, { k: 'type', label: 'Type' },
      { k: 'essence', label: 'Essence' }, { k: 'epaisseur_mm', label: 'Ép. (mm)' },
      { k: 'largeur_mm', label: 'Larg. (mm)' }, { k: 'longueur_mm', label: 'Long. (mm)' },
      { k: 'quantite', label: 'Qté' }, { k: 'volume_m3', label: 'Vol (m³)' },
      { k: 'statut', label: 'Statut' }, { k: 'statut_code', label: 'Code statut' },
      { k: 'of_numero', label: 'OF' }, { k: 'lot_numero', label: 'Lot' },
      { k: 'cree_le_fr', label: 'Créé le' }
    ],
    totals: [{ k: 'quantite', label: 'Qté' }, { k: 'volume_m3', label: 'Vol (m³)' }],
    get: function() { return (typeof TraceAPI !== 'undefined') ? TraceAPI.rows('wip') : []; },
    replace: function() {}, persist: function() {}
  },
  {
    id: 'stock', label: '📊 Stock résumé', api: true,
    cols: [
      { k: 'nature', label: 'Nature' }, { k: 'libelle', label: 'Statut' },
      { k: 'statut_code', label: 'Code' }, { k: 'nb_lignes', label: 'Nb lignes' },
      { k: 'volume_m3', label: 'Vol (m³)' }
    ],
    totals: [{ k: 'nb_lignes', label: 'Nb lignes' }, { k: 'volume_m3', label: 'Vol (m³)' }],
    get: function() { return (typeof TraceAPI !== 'undefined') ? TraceAPI.rows('stock') : []; },
    replace: function() {}, persist: function() {}
  },
  {
    id: 'coherence', label: '⚖️ Cohérence PF-WIP', api: true,
    cols: [
      { k: 'reference_sf', label: 'Réf. SF' }, { k: 'qte_semi_finis', label: 'Qté WIP' },
      { k: 'qte_produits_finis', label: 'Qté PF' }, { k: 'ecart', label: 'Écart' },
      { k: 'controle', label: 'Contrôle' }
    ],
    totals: [{ k: 'qte_semi_finis', label: 'Qté WIP' }, { k: 'qte_produits_finis', label: 'Qté PF' }, { k: 'ecart', label: 'Écart' }],
    get: function() { return (typeof TraceAPI !== 'undefined') ? TraceAPI.rows('coherence') : []; },
    replace: function() {}, persist: function() {}
  },
  {
    id: 'audit', label: '🗒️ Audit', api: true,
    cols: [
      { k: 'horodatage_fr', label: 'Horodatage' }, { k: 'action', label: 'Action' },
      { k: 'utilisateur', label: 'Utilisateur' }, { k: 'source', label: 'Source' }
    ],
    get: function() { return (typeof TraceAPI !== 'undefined') ? TraceAPI.rows('audit') : []; },
    replace: function() {}, persist: function() {}
  },
  {
    id: 'traces', label: '🧭 Historique traces', api: true,
    cols: [
      { k: 'execute_le_fr', label: 'Date' }, { k: 'action', label: 'Action' },
      { k: 'execute_par', label: 'Par' }, { k: 'details', label: 'Détails' },
      { k: 'source', label: 'Source' }
    ],
    get: function() { return (typeof TraceAPI !== 'undefined') ? TraceAPI.rows('traces') : []; },
    replace: function() {}, persist: function() {}
  }
];

/* Aplatit une ligne d'OF (objets imbriqués) en objet plat lisible */
function flattenOrderRow(o) {
  var flat = {};
  for (var k in o) {
    var v = o[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (var k2 in v) flat[k + '.' + k2] = v[k2];
    } else {
      flat[k] = v;
    }
  }
  return flat;
}

/* Reconstruit les objets imbriqués (clés pointées) après un import :
   « gv.infos » → gv = { infos: … } — assure un round-trip fidèle. */
function unflattenRow(row) {
  if (!row || typeof row !== 'object') return row;
  var out = {};
  Object.keys(row).forEach(function (k) {
    if (k.indexOf('.') > 0) {
      var parts = k.split('.');
      var target = out;
      for (var i = 0; i < parts.length - 1; i++) {
        if (typeof target[parts[i]] !== 'object' || target[parts[i]] === null || Array.isArray(target[parts[i]])) target[parts[i]] = {};
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = row[k];
    } else {
      out[k] = row[k];
    }
  });
  return out;
}

/* ═══════ Navigation / rendu de l'écran ═══════ */
var dataSortCol = null;
var dataSortDir = 'asc';
var dataFilters = {};
var dataPage = 0;
var dataPageSize = 50;

function renderDataScreen() {
  if (!dataCurrentTableId) dataCurrentTableId = (DATA_TABLES[0] || {}).id;
  dataSortCol = null;
  dataSortDir = 'asc';
  dataFilters = {};
  renderDataToolbar();
  renderDataChips();
  renderDataTable();
  dataEnsureActiveTable();
}

function dataEnsureActiveTable() {
  var t = dataTableById(dataCurrentTableId);
  if (!t || !t.api || typeof TraceAPI === 'undefined') return;
  TraceAPI.ensure(t.id).then(function () {
    renderDataChips();
    renderDataTable();
    var badge = document.getElementById('dataSourceBadge');
    if (badge) badge.innerHTML = dataSourceBadgeHtml(t.id);
  });
}

function dataSourceBadgeHtml(id) {
  if (typeof TraceAPI === 'undefined') return '';
  var m = TraceAPI.meta(id);
  if (m.source === 'local' || m.source === 'api') {
    var when = m.at ? new Date(m.at).toLocaleTimeString('fr-FR') : '—';
    return '<span class="data-source-badge data-source-api" title="Données locales (Firestore) · ' + m.count + ' ligne(s)">● Local · ' + when + '</span>';
  }
  if (m.source === 'offline') {
    return '<span class="data-source-badge data-source-offline" title="' + escapeHtml(m.error || '') + '">● Hors ligne · cache local</span>';
  }
  return '<span class="data-source-badge data-source-none">○ Non chargé</span>';
}

function dataRefreshFromApi() {
  var t = dataTableById(dataCurrentTableId);
  if (!t || typeof TraceAPI === 'undefined') return;
  TraceAPI.refreshAll(true).then(function (r) {
    renderDataChips();
    renderDataToolbar();
    renderDataTable();
    if (typeof renderTraceKpis === 'function') renderTraceKpis();
    if (typeof renderTraceCharts === 'function') renderTraceCharts();
    if (typeof renderTraceStatus === 'function') renderTraceStatus();
    if (typeof showToast === 'function') {
      showToast(r.api > 0 ? 'Données locales rechargées (' + r.api + '/' + r.total + ' tables)' : 'Aucune donnée locale disponible', r.api > 0 ? 'success' : 'error');
    }
  });
}

function dataTableById(id) {
  var found = null;
  DATA_TABLES.forEach(function (t) { if (t.id === id) found = t; });
  return found;
}

function selectDataTable(id) {
  dataCurrentTableId = id;
  dataSearchText = '';
  dataSortCol = null;
  dataSortDir = 'asc';
  dataFilters = {};
  dataKpiBadgeText = '';
  var searchEl = document.getElementById('dataTableSearch');
  if (searchEl) searchEl.value = '';
  renderDataChips();
  renderDataToolbar();
  renderDataTable();
  dataEnsureActiveTable();
}

function renderDataChips() {
  var chips = document.getElementById('dataTableChips');
  if (!chips) return;
  var html = '<div class="data-tabs-header">'
    + '<div class="data-tabs-title">📊 Tables de données</div>'
    + '<div class="data-tabs-sub">' + DATA_TABLES.length + ' modules</div>'
    + '</div>'
    + '<div class="data-chips-scroll">';
  DATA_TABLES.forEach(function (t) {
    var rows = t.get();
    var count = rows ? rows.length : 0;
    var active = t.id === dataCurrentTableId;
    html += '<button class="data-tab' + (active ? ' data-tab-active' : '') + '" onclick="selectDataTable(\'' + t.id + '\')">'
      + '<span class="data-tab-label">' + escapeHtml(t.label) + '</span>'
      + '<span class="data-tab-count">' + count + '</span>'
      + (active ? '<span class="data-tab-indicator"></span>' : '')
      + '</button>';
  });
  html += '</div>';
  chips.innerHTML = html;
}

function dataTableColumns(t) {
  if (t.cols) return t.cols;
  var rows = t.get();
  var keys = [];
  (rows || []).forEach(function (r) {
    if (!r) return;
    Object.keys(r).forEach(function (k) {
      if (keys.indexOf(k) < 0) keys.push(k);
    });
  });
  return keys.map(function (k) {
    return { k: k, label: DATA_FIELD_LABELS[k] || humanizeKey(k) };
  });
}

function humanizeKey(k) {
  return String(k)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, function (m) { return m.toUpperCase(); });
}

function dataComputeTotals(t, rows) {
  if (!t || !t.totals || !t.totals.length) return null;
  var sums = {};
  t.totals.forEach(function (col) { sums[col.k] = 0; });
  (rows || []).forEach(function (r) {
    if (!r) return;
    t.totals.forEach(function (col) {
      var v = r[col.k];
      var n = (typeof v === 'number') ? v : parseFloat(String(v == null ? '' : v).replace(',', '.'));
      if (isFinite(n)) sums[col.k] += n;
    });
  });
  return sums;
}

function dataFormatTotal(key, v) {
  var n = num0(v);
  if (/_m3$/.test(key) || key === 'volume' || key === 'volumeM3') return n.toFixed(2);
  return String(Math.round(n * 100) / 100);
}

function num0(v) { var n = Number(v); return isFinite(n) ? n : 0; }

function dataCellValue(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch (e) { return ''; }
  }
  return String(v);
}

function dataSort(rows, col, dir) {
  if (!col || !rows.length) return rows;
  return rows.slice().sort(function (a, b) {
    var va = a ? dataCellValue(a[col]) : '';
    var vb = b ? dataCellValue(b[col]) : '';
    var na = parseFloat(va), nb = parseFloat(vb);
    if (!isNaN(na) && !isNaN(nb)) return dir === 'asc' ? na - nb : nb - na;
    return dir === 'asc' ? va.localeCompare(vb, 'fr') : vb.localeCompare(va, 'fr');
  });
}

function dataSearch(val) {
  dataSearchText = (val || '').trim();
  dataPage = 0;
  renderDataTable();
}

function dataToggleSort(col) {
  if (dataSortCol === col) {
    dataSortDir = dataSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    dataSortCol = col;
    dataSortDir = 'asc';
  }
  dataPage = 0;
  renderDataTable();
}

function dataToggleFilter(col) {
  var el = document.getElementById('dataFilter_' + col);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function dataApplyFilter(col, val) {
  if (val) { dataFilters[col] = val.toLowerCase(); } else { delete dataFilters[col]; }
  dataPage = 0;
  renderDataTable();
}

/* ═══════ MOTEUR GRID v2 — classification, statuts, filtres opérateurs, resize ═══════ */

/* Infère le type d'une colonne (texte / nombre / date) à partir de son nom
   puis, en repli, des valeurs d'échantillon. */
function dataColumnClass(k, rows) {
  if (!k) return 'text';
  if (/(date|_fr$|horodatage|le_fr|ts$)/i.test(String(k))) return 'date';
  if (/_m3$|_cm$|_mm$|_pct$|_m$/.test(String(k))) return 'num';
  if (/^(volume|vol|diametre|longueur|epaisseur|largeur|hauteur|quantite|qte|nb_|ecart|rendement|prix|cout|total|balance|stockTotal|pieces)/i.test(String(k))) return 'num';
  if (/^(code|statut|essence|reference|numero|client|nom|type|ligne|poste|couverture|controle|action|utilisateur|detail|reason|notes|source)$/i.test(String(k))) return 'text';
  var seen = 0, numeric = 0;
  (rows || []).forEach(function (r) {
    if (!r) return;
    var v = String(r[k] == null ? '' : r[k]).trim();
    if (v === '' || v === '—') return;
    seen++;
    if (isFinite(Number(v.replace(',', '.')))) numeric++;
  });
  if (seen > 0 && numeric === seen) return 'num';
  return 'text';
}

function dataAlignFor(kind) { return kind === 'num' ? 'right' : (kind === 'date' ? 'center' : 'left'); }
function dataTdKind(kind) { return 'data-td data-td-' + (kind || 'text'); }

/* Couleur discrète de statut (filtreés à la conversion label FR déjà faite
   par TraceAPI : « Consommé », « En stock », « En WIP », « Non conforme »…). */
var DATA_STATUS_STYLES = {
  ok: ['consommé', 'en stock', 'conforme', 'terminé', 'ok', 'vendu', 'transféré'],
  run: ['en cours', 'en wip', 'en attente', 'en séchage', 'prévu', 'en production'],
  err: ['non conforme', 'écart', 'erreur', 'défaut', 'annulé', 'échec']
};
function dataStatusClass(v) {
  var s = String(v == null ? '' : v).toLowerCase();
  if (!s) return '';
  for (var st in DATA_STATUS_STYLES) {
    if (DATA_STATUS_STYLES[st].indexOf(s) >= 0) return 'data-cell-' + st;
  }
  return '';
}

/* Filtre opérateur par colonne.
   - legacy query (string) : contains insensible à la casse ;
   - op {op, a, b} : eq/gt/gte/lt/lte/between pour num, before/after pour date. */
function dataParseNum(v) {
  if (v == null || v === '') return NaN;
  var n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) ? n : NaN;
}
function dataParseDate(v) {
  if (v == null || v === '') return NaN;
  var s = String(v).trim();
  if (!s || s === '—') return NaN;
  var m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  var d = new Date(s);
  return isNaN(d.getTime()) ? NaN : d.getTime();
}
function dataFilterPasses(rawValue, query, kind, op) {
  var val = rawValue == null ? '' : String(rawValue).trim();
  if (op && op.op) {
    var o = op.op;
    if (o === 'contains') {
      return String(val).toLowerCase().indexOf(String(op.a == null ? '' : op.a).toLowerCase()) >= 0;
    }
    if (o === 'eq') {
      if (kind === 'num') return dataParseNum(val) === dataParseNum(op.a);
      return String(val).toLowerCase() === String(op.a == null ? '' : op.a).toLowerCase();
    }
    if (kind === 'num') {
      var n = dataParseNum(val);
      if (isNaN(n) || isNaN(dataParseNum(op.a))) return false;
      if (o === 'gt') return n > dataParseNum(op.a);
      if (o === 'gte') return n >= dataParseNum(op.a);
      if (o === 'lt') return n < dataParseNum(op.a);
      if (o === 'lte') return n <= dataParseNum(op.a);
      if (o === 'between') {
        var hi = dataParseNum(op.b);
        if (isNaN(hi)) return n >= dataParseNum(op.a);
        return n >= dataParseNum(op.a) && n <= hi;
      }
      return false;
    }
    if (kind === 'date') {
      var t = dataParseDate(val);
      var ta = dataParseDate(op.a);
      if (isNaN(t) || isNaN(ta)) return false;
      if (o === 'before') return t <= ta;
      if (o === 'after') return t >= ta;
      return false;
    }
    return false;
  }
  if (query) return String(val).toLowerCase().indexOf(String(query).toLowerCase()) >= 0;
  return true;
}

function dataApplyOpFilter(col, op, a, b) {
  dataFilters[col] = { op: op || 'contains', a: a == null ? '' : String(a), b: b == null ? '' : String(b) };
  dataPage = 0;
  renderDataTable();
}

function dataClearFiltersChip(col) { delete dataFilters[col]; dataPage = 0; renderDataTable(); }

/* Filtre opérateur sélectionné par colonne (UI des popups). */
var dataFilterOp = {};
function dataSetFilterOp(col, op) {
  dataFilterOp[col] = op;
  delete dataFilters[col];
  dataPage = 0;
  renderDataTable();
}

/* Largeurs de colonnes redimensionnables (persistées en localStorage). */
var dataColWidths = null;
var DATA_COL_WIDTHS_KEY = 'charben_grid_widths_v1';
function dataLoadColWidths() {
  if (dataColWidths) return dataColWidths;
  dataColWidths = {};
  try {
    var raw = (typeof localStorage !== 'undefined' && localStorage) ? localStorage.getItem(DATA_COL_WIDTHS_KEY) : null;
    if (raw) dataColWidths = JSON.parse(raw) || {};
  } catch (e) { dataColWidths = {}; }
  return dataColWidths;
}
function dataSaveColWidths() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) localStorage.setItem(DATA_COL_WIDTHS_KEY, JSON.stringify(dataColWidths || {}));
  } catch (e) {}
}
function dataGetColWidth(tid, k, def) {
  var w = (dataLoadColWidths()[tid + '::' + k]);
  return (typeof w === 'number' && w >= 60) ? w : (def || 120);
}
function dataSetColWidth(tid, k, w) {
  dataLoadColWidths()[tid + '::' + k] = Math.max(60, Math.min(600, Math.round(w)));
  dataSaveColWidths();
}
function dataResizeCompute(base, delta, minW, maxW) {
  var w = (base || 120) + (delta || 0);
  if (minW != null && w < minW) w = minW;
  if (maxW != null && w > maxW) w = maxW;
  return w;
}

/* Badge de filtre actif issu des Smart KPI Cards. */
var dataKpiBadgeText = '';
function dataSetKpiBadge(text) {
  dataKpiBadgeText = text || '';
  if (typeof renderDataToolbar === 'function') renderDataToolbar();
}
function dataClearKpiFilter() {
  dataKpiBadgeText = '';
  dataFilters = {};
  dataPage = 0;
  renderDataToolbar();
  renderDataTable();
}

function renderDataToolbar() {
  var container = document.getElementById('dataTableContainer');
  if (!container) return;
  var t = dataTableById(dataCurrentTableId);
  var rowCount = t ? (t.get() || []).length : 0;
  var isApi = !!(t && t.api);
  var actions = '<button class="data-action-btn" onclick="dataExport(\'excel\')" title="Exporter Excel">⬇ Excel</button>'
    + '<button class="data-action-btn" onclick="dataExport(\'json\')" title="Exporter JSON">⬇ JSON</button>';
  if (isApi) {
    actions = '<span id="dataSourceBadge">' + dataSourceBadgeHtml(dataCurrentTableId) + '</span>'
        + '<button class="data-action-btn data-action-primary" onclick="dataRefreshFromApi()" title="Actualiser les données locales">🔄 Actualiser</button>'
      + actions;
  } else {
    actions += '<button class="data-action-btn" onclick="dataCleanAndReload()" title="Nettoyer doublons/vides">🧹 Nettoyer</button>'
      + '<button class="data-action-btn data-action-primary" onclick="dataImportStart()" title="Importer">⬆ Importer</button>'
      + '<input type="file" id="dataImportFile" accept=".json,.csv,.xlsx" style="display:none" onchange="handleDataTableFile(event)">';
  }
  var html = '<div class="data-toolbar">'
    + '<div class="data-toolbar-title" id="dataToolbarTitle">' + (t ? escapeHtml(t.label) : '') + '</div>'
    + '<div class="data-toolbar-actions">'
    + actions
    + '</div></div>'
    + '<div class="data-filters-row">'
    + '<div class="data-search-box">'
    + '<svg class="data-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>'
    + '<input type="text" id="dataTableSearch" class="data-search-input" placeholder="Rechercher..." value="' + escapeHtml(dataSearchText) + '" oninput="dataSearch(this.value)">'
    + (dataSearchText ? '<button class="data-search-clear" onclick="dataSearch(\'\')">✕</button>' : '')
    + '</div>'
    + '<span id="dataRowCount" class="data-row-count">' + rowCount + ' ligne(s)</span>'
    + '</div>'
    + (dataKpiBadgeText ? '<div class="data-kpi-badge">🎯 ' + escapeHtml(dataKpiBadgeText) + '<button class="data-kpi-badge-x" onclick="dataClearKpiFilter()" title="Retirer le filtre">✕</button></div>' : '')
    + '<div class="data-tbl-wrapper" id="dataTblBody"></div>';
  container.innerHTML = html;
}

function renderDataTable() {
  var body = document.getElementById('dataTblBody');
  var info = document.getElementById('dataRowCount');
  var title = document.getElementById('dataToolbarTitle');
  if (!body) return;
  var t = dataTableById(dataCurrentTableId);
  if (!t) { body.innerHTML = '<div class="data-tbl-empty">Table introuvable.</div>'; return; }
  if (title) title.textContent = t.label;

  var rows = (t.get() || []).slice();

  /* Search */
  if (dataSearchText) {
    var q = dataSearchText.toLowerCase();
    rows = rows.filter(function (r) {
      if (!r) return false;
      return Object.keys(r).some(function (k) {
        return dataCellValue(r[k]).toLowerCase().indexOf(q) >= 0;
      });
    });
  }

  /* Column filters (legacy string = contains ; opérateur = {op,a,b}) */
  Object.keys(dataFilters).forEach(function (col) {
    var f = dataFilters[col];
    var kind = dataColumnClass(col, rows);
    rows = rows.filter(function (r) {
      if (!r) return false;
      var v = dataCellValue(r[col]);
      if (typeof f === 'string') return dataFilterPasses(v, f, kind, null);
      return dataFilterPasses(v, null, kind, f);
    });
  });

  /* Sort */
  if (dataSortCol) rows = dataSort(rows, dataSortCol, dataSortDir);

  /* Pagination */
  var totalFiltered = rows.length;
  var totalPages = Math.max(1, Math.ceil(totalFiltered / dataPageSize));
  if (dataPage >= totalPages) dataPage = totalPages - 1;
  if (dataPage < 0) dataPage = 0;
  var pageRows = rows.slice(dataPage * dataPageSize, (dataPage + 1) * dataPageSize);

  if (info) info.textContent = totalFiltered + ' ligne(s)' + (totalPages > 1 ? ' — p.' + (dataPage + 1) + '/' + totalPages : '');

  var cols = dataTableColumns(t);
  if (!cols.length) {
    body.innerHTML = '<div class="data-tbl-empty">Aucune donnée.</div>';
    return;
  }

  /* Types + largeurs par colonne */
  var kinds = {};
  cols.forEach(function (c) { kinds[c.k] = dataColumnClass(c.k, rows); });

  /* Header with sort + filter + resize handle */
  var headHtml = cols.map(function (c) {
    var sortIcon = '';
    if (dataSortCol === c.k) sortIcon = dataSortDir === 'asc' ? ' ↑' : ' ↓';
    var w = dataGetColWidth(t.id, c.k, null);
    var style = w ? ' style="flex-basis:' + w + 'px;min-width:' + Math.round(w * 0.6) + 'px;"' : '';
    return '<div class="data-th" data-col="' + escapeHtml(c.k) + '"' + style + ' onclick="dataToggleSort(\'' + escapeHtml(c.k) + '\')" title="Trier">'
      + '<span class="data-th-text">' + escapeHtml(c.label) + sortIcon + '</span>'
      + '<button class="data-th-filter" onclick="event.stopPropagation();dataToggleFilter(\'' + escapeHtml(c.k) + '\')" title="Filtrer">▾</button>'
      + '<span class="data-th-resize" data-resize-col="' + escapeHtml(c.k) + '" title="Redimensionner"></span>'
      + '</div>';
  }).join('');

  /* Filter popups (opérateurs selon le type de colonne) */
  var operators = { num: ['contains', 'eq', 'gt', 'gte', 'lt', 'lte', 'between'], date: ['contains', 'before', 'after'], text: ['contains'] };
  var filterHtml = cols.map(function (c) {
    var kind = kinds[c.k];
    var ops = operators[kind] || operators.text;
    var curOp = dataFilterOp[c.k] || 'contains';
    var opSel = ops.map(function (o) {
      var labels = {
        contains: 'contient', eq: '=', gt: '>', gte: '≥', lt: '<', lte: '≤',
        between: 'entre', before: 'avant le', after: 'après le'
      };
      return '<option value="' + o + '"' + (o === curOp ? ' selected' : '') + '>' + (labels[o] || o) + '</option>';
    }).join('');
    var isBetween = curOp === 'between';
    var aPh = kind === 'date' ? 'JJ/MM/AAAA' : (kind === 'num' ? 'Valeur' : 'Texte');
    var active = dataFilters[c.k] ? ' data-filter-active' : '';
    var opts = '';
    if (kind !== 'num') {
      var vals = {};
      rows.forEach(function (r) { if (r) { var v = dataCellValue(r[c.k]); vals[v] = true; } });
      var optsList = Object.keys(vals).sort().slice(0, 20);
      if (!optsList.length || curOp !== 'contains') optsList = [];
      if (optsList.length) {
        opts = '<div class="data-filter-opts">'
          + '<div class="data-filter-opt" onclick="dataApplyFilter(\'' + escapeHtml(c.k) + '\',\'\')">Tout</div>'
          + optsList.map(function (o) { return '<div class="data-filter-opt" onclick="dataApplyOpFilter(\'' + escapeHtml(c.k) + '\',\'contains\',\'' + escapeHtml(o).replace(/'/g, "\\'") + '\',null)">' + escapeHtml(o) + '</div>'; }).join('')
          + '</div>';
      }
    }
    return '<div class="data-filter-popup' + active + '" id="dataFilter_' + escapeHtml(c.k) + '" style="display:none;">'
      + '<div class="data-filter-op-row"><select class="data-filter-op" onchange="dataSetFilterOp(\'' + escapeHtml(c.k) + '\',this.value)">' + opSel + '</select>'
      + (dataFilters[c.k] ? '<button class="data-filter-clear" onclick="dataClearFiltersChip(\'' + escapeHtml(c.k) + '\')" title="Vider">✕</button>' : '')
      + '</div>'
      + '<input type="text" class="data-filter-input" placeholder="' + aPh + '" oninput="dataApplyOpFilter(\'' + escapeHtml(c.k) + '\',\'' + curOp + '\',this.value,null)">'
      + (isBetween ? '<input type="text" class="data-filter-input" placeholder="Jusqu\u2019à…" oninput="dataApplyOpFilter(\'' + escapeHtml(c.k) + '\',\'between\',\'' + (dataFilters[c.k] && dataFilters[c.k].a != null ? escapeHtml(String(dataFilters[c.k].a)) : '') + '\',this.value)">' : '')
      + opts
      + '</div>';
  }).join('');

  /* Rows */
  var bodyHtml = (function () {
    return pageRows.map(function (r, idx) {
      var rowCls = idx % 2 === 0 ? 'data-tr' : 'data-tr data-tr-alt';
      return '<div class="' + rowCls + '">'
        + cols.map(function (c) {
          var v = dataCellValue(r ? r[c.k] : null);
          var kind = kinds[c.k];
          var tdCls = dataTdKind(kind) + ' data-td-align-' + dataAlignFor(kind);
          if (v === '—') tdCls += ' data-td-empty';
          var status = dataStatusClass(v);
          if (status) tdCls += ' ' + status;
          var w = dataGetColWidth(t.id, c.k, null);
          var style = w ? ' style="flex-basis:' + w + 'px;min-width:' + Math.round(w * 0.6) + 'px;"' : '';
          return '<div class="' + tdCls + '" data-col="' + escapeHtml(c.k) + '"' + style + ' title="' + escapeHtml(v) + '">' + escapeHtml(v) + '</div>';
        }).join('')
        + '</div>';
    }).join('');
  })();

  var totalsSums = dataComputeTotals(t, rows);
  var totalsHtml = '';
  if (totalsSums && bodyHtml) {
    totalsHtml = '<div class="data-tr data-tr-total">'
      + cols.map(function (c, i) {
        if (i === 0) return '<div class="data-td data-td-total-label">Total</div>';
        if (Object.prototype.hasOwnProperty.call(totalsSums, c.k)) {
          var kind = kinds[c.k];
          var xw = dataGetColWidth(t.id, c.k, null);
          var xstyle = xw ? ' style="flex-basis:' + xw + 'px;min-width:' + Math.round(xw * 0.6) + 'px;"' : '';
          return '<div class="data-td data-td-total data-td-align-' + dataAlignFor(kind) + '" data-col="' + escapeHtml(c.k) + '"' + xstyle + '>' + escapeHtml(dataFormatTotal(c.k, totalsSums[c.k])) + '</div>';
        }
        var cw = dataGetColWidth(t.id, c.k, null);
        var cstyle = cw ? ' style="flex-basis:' + cw + 'px;min-width:' + Math.round(cw * 0.6) + 'px;"' : '';
        return '<div class="data-td"' + cstyle + ' data-col="' + escapeHtml(c.k) + '"></div>';
      }).join('')
      + '</div>';
  }

  var emptyMsg = (dataSearchText || Object.keys(dataFilters).length)
    ? 'Aucun résultat.'
    : 'Aucune donnée.';

  /* Pagination controls */
  var pageNav = '';
  if (totalPages > 1) {
    var prevCls = dataPage <= 0 ? ' disabled' : '';
    var nextCls = dataPage >= totalPages - 1 ? ' disabled' : '';
    pageNav = '<div class="data-page-nav">'
      + '<button class="data-page-btn' + prevCls + '" onclick="dataGoPage(' + (dataPage - 1) + ')"' + (prevCls ? ' disabled' : '') + '>◀</button>'
      + '<span class="data-page-info">Page ' + (dataPage + 1) + ' / ' + totalPages + '</span>'
      + '<button class="data-page-btn' + nextCls + '" onclick="dataGoPage(' + (dataPage + 1) + ')"' + (nextCls ? ' disabled' : '') + '>▶</button>'
      + '<select class="data-page-size" onchange="dataSetPageSize(+this.value)">'
      + [25, 50, 100, 200].map(function (n) { return '<option value="' + n + '"' + (n === dataPageSize ? ' selected' : '') + '>' + n + '</option>'; }).join('')
      + '</select></div>';
  }

  body.innerHTML = '<div class="data-excel">'
    + '<div class="data-excel-scroll">'
    + '<div class="data-excel-header">' + headHtml + '</div>'
    + '<div class="data-excel-body">'
    + (bodyHtml ? (bodyHtml + totalsHtml) : '<div class="data-tbl-empty">' + emptyMsg + '</div>')
    + '</div></div></div>'
    + pageNav;

  /* Sync horizontal scroll: header跟着body一起移动 */
  var scrollEl = body.querySelector('.data-excel-scroll');
  var headerEl = body.querySelector('.data-excel-header');
  if (scrollEl && headerEl) {
    scrollEl.addEventListener('scroll', function() {
      headerEl.style.transform = 'translateX(-' + scrollEl.scrollLeft + 'px)';
    });
  }

  dataInitResize(body, t.id);
}

/* ─── Drag resize des colonnes (Excel-like) ─── */
function dataInitResize(scope, tableId) {
  var st = {};
  var handles = scope.querySelectorAll('.data-th-resize');
  var track = function (h, col) {
    h.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      st.col = col;
      st.startX = e.clientX;
      st.base = dataGetColWidth(tableId, col, 120);
      var move = function (ev) {
        var w = dataResizeCompute(st.base, ev.clientX - st.startX, 60, 600);
        dataSetColWidth(tableId, st.col, w);
        var cells = scope.querySelectorAll('[data-col="' + st.col + '"]');
        for (var i = 0; i < cells.length; i++) {
          cells[i].style.flexBasis = w + 'px';
          cells[i].style.minWidth = Math.round(w * 0.6) + 'px';
        }
      };
      var up = function () {
        dataSaveColWidths();
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      try { h.setPointerCapture && h.setPointerCapture(e.pointerId); } catch (er) {}
    });
  };
  for (var i = 0; i < handles.length; i++) {
    track(handles[i], handles[i].getAttribute('data-resize-col'));
  }
}

function dataRenderToolbar() { return ''; }

/* ─── Pagination helpers ─── */
function dataGoPage(n) {
  var t = dataTableById(dataCurrentTableId);
  if (!t) return;
  var rows = (t.get() || []).slice();
  if (dataSearchText) {
    var q = dataSearchText;
    rows = rows.filter(function (r) {
      if (!r) return false;
      return Object.keys(r).some(function (k) { return FuzzySearch.matches(dataCellValue(r[k]), q); });
    });
  }
  Object.keys(dataFilters).forEach(function (col) {
    var f = dataFilters[col];
    var kind = dataColumnClass(col, rows);
    rows = rows.filter(function (r) {
      if (!r) return false;
      var v = dataCellValue(r[col]);
      if (typeof f === 'string') return dataFilterPasses(v, f, kind, null);
      return dataFilterPasses(v, null, kind, f);
    });
  });
  if (dataSortCol) rows = dataSort(rows, dataSortCol, dataSortDir);
  var totalPages = Math.max(1, Math.ceil(rows.length / dataPageSize));
  dataPage = Math.max(0, Math.min(n, totalPages - 1));
  renderDataTable();
}
function dataSetPageSize(n) {
  dataPageSize = n || 50;
  dataPage = 0;
  renderDataTable();
}

function dataCleanAndReload() {
  var t0 = dataTableById(dataCurrentTableId);
  if (t0 && t0.api) {
    if (typeof showToast === 'function') showToast('Lecture seule — table synchronisée depuis la base.', 'error');
    return;
  }
  if (typeof cleanTableData === 'function') cleanTableData();
  renderDataChips();
  renderDataToolbar();
  renderDataTable();
  if (typeof showToast === 'function') showToast('Données nettoyées', 'success');
}

/* ═══════ Export ═══════ */
function dataExport(format) {
  var t = dataTableById(dataCurrentTableId);
  if (!t) return;
  var rows = dataSearchText ? t.get().filter(function (r) { return Object.keys(r).some(function (k) { return FuzzySearch.matches(dataCellValue(r[k]), dataSearchText); }); }) : t.get();
  var cols = dataTableColumns(t);
  var filename = t.id + '.' + format;
  var mime = 'application/octet-stream';
  var content;
  if (format === 'json') {
    mime = 'application/json';
    content = JSON.stringify(rows || [], null, 2);
  } else if (format === 'csv') {
    mime = 'text/csv;charset=utf-8';
    content = buildCsv(rows, cols);
  } else if (format === 'excel') {
    mime = 'application/vnd.ms-excel';
    filename = t.id + '.xls';
    content = buildExcelXml(rows, cols, t.label);
  }
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
    try {
      window.Capacitor.Plugins.Filesystem.writeFile({
        path: filename,
        data: content,
        directory: 'DOCUMENTS',
        encoding: 'UTF8',
        recursive: true
      }).then(function () {
        showToast('Export sauvegardé dans Documents : ' + filename, 'success');
      }).catch(function (e) {
        errLog('data-tables', 'exportFilesystem', e, 'warn');
        downloadBlob(content, filename, mime);
        showToast('Export « ' + t.label + ' » effectué.', 'success');
      });
      return;
    } catch (e) {
      errLog('data-tables', 'exportFilesystem write', e, 'warn');
    }
  }
  downloadBlob(content, filename, mime);
  showToast('Export « ' + t.label + ' » effectué.', 'success');
}

function buildCsv(rows, cols) {
  var sep = ';';
  var lines = [];
  lines.push(cols.map(function (c) { return csvCell(c.label); }).join(sep));
  (rows || []).forEach(function (r) {
    lines.push(cols.map(function (c) { return csvCell(dataCellValue(r ? r[c.k] : null)); }).join(sep));
  });
  return '\ufeff' + lines.join('\r\n');
}

function csvCell(v) {
  v = String(v === null || v === undefined ? '' : v);
  return /[;"\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

function buildExcelXml(rows, cols, title) {
  var esc = dataXmlEscape;
  var xml = '<?xml version="1.0" encoding="UTF-8"?>'
    + '<?mso-application progid="Excel.Sheet"?>'
    + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"'
    + ' xmlns:o="urn:schemas-microsoft-com:office:office"'
    + ' xmlns:x="urn:schemas-microsoft-com:office:excel"'
    + ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
    + '<Worksheet ss:Name="' + esc(title || 'Data') + '">'
    + '<Table>';
  xml += '<Row>' + cols.map(function (c) { return '<Cell><Data ss:Type="String">' + esc(c.label) + '</Data></Cell>'; }).join('') + '</Row>';
  (rows || []).forEach(function (r) {
    xml += '<Row>' + cols.map(function (c) {
      var v = r ? r[c.k] : null;
      var isNum = (typeof v === 'number') || (typeof v === 'string' && v !== '' && !isNaN(v) && !/\s/.test(v));
      var type = isNum ? 'Number' : 'String';
      var text = isNum ? String(v) : esc(dataCellValue(v));
      return '<Cell><Data ss:Type="' + type + '">' + text + '</Data></Cell>';
    }).join('') + '</Row>';
  });
  xml += '</Table></Worksheet></Workbook>';
  return xml;
}

function dataXmlEscape(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function downloadBlob(content, filename, mime) {
  var blob = new Blob([content], { type: mime || 'application/octet-stream' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

/* ═══════ Import ═══════ */
function dataImportStart() {
  var el = document.getElementById('dataImportFile');
  if (el) el.click();
}

function loadXlsx(cb) {
  if (typeof XLSX !== 'undefined') { cb(true); return; }
  if (typeof _xlsxPromise !== 'undefined' && _xlsxPromise) { _xlsxPromise.then(cb); return; }
  _xlsxPromise = ensureVendor('xlsx');
  _xlsxPromise.then(cb);
}

function handleDataTableFile(e) {
  var file = e.target.files[0];
  if (!file) return;
  var t = dataTableById(dataCurrentTableId);
  if (!t) return;
  if (t.api) {
    if (typeof showToast === 'function') showToast('Lecture seule — table synchronisée depuis la base.', 'error');
    e.target.value = '';
    return;
  }
  var ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    loadXlsx(function (ok) {
      if (!ok) { showToast('Bibliothèque XLSX non chargée (hors ligne).', 'error'); return; }
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
          var ws = wb.Sheets[wb.SheetNames[0]];
          var arr = XLSX.utils.sheet_to_json(ws, { defval: '' });
          dataImportRows(t, arr);
        } catch (err) {
          showToast('Fichier XLSX invalide : ' + err.message, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    });
    return;
  }
  var reader = new FileReader();
  reader.onload = function (ev) {
    try {
      var text = String(ev.target.result || '');
      var arr;
      if (ext === 'json') {
        var parsed = JSON.parse(text);
        arr = Array.isArray(parsed) ? parsed : (parsed.rows || []);
      } else if (ext === 'csv') {
        arr = parseCsv(text, dataTableColumns(t));
      } else {
        showToast('Format non supporté : .' + ext, 'error');
        return;
      }
      dataImportRows(t, arr);
    } catch (err) {
      showToast('Erreur de lecture : ' + err.message, 'error');
    }
  };
  reader.readAsText(file, 'UTF-8');
  e.target.value = '';
}

function parseCsv(text, cols) {
  var sep = text.indexOf(';') >= 0 ? ';' : ',';
  var lines = [];
  var cur = '';
  var inQ = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (ch === '"') { inQ = !inQ; cur += ch; continue; }
    if (!inQ && (ch === '\n' || ch === '\r')) {
      if (cur.trim() !== '') lines.push(cur);
      cur = '';
      if (ch === '\r' && text[i + 1] === '\n') i++;
      continue;
    }
    cur += ch;
  }
  if (cur.trim() !== '') lines.push(cur);

  var header = splitCsvLine(lines.shift() || '');
  var headerMap = {};
  header.forEach(function (h, idx) {
    var key = h;
    cols.forEach(function (c) { if (c.label === h) key = c.k; });
    headerMap[idx] = key;
  });

  var labelToKey = {};
  cols.forEach(function (c) { labelToKey[c.label] = c.k; });

  return lines.map(function (line) {
    var cells = splitCsvLine(line);
    var obj = {};
    cells.forEach(function (cell, idx) {
      var k = headerMap[idx];
      if (k === undefined) k = 'col' + idx;
      if (labelToKey[k]) k = labelToKey[k];
      if (k !== '') obj[k] = cleanCsvCell(cell);
    });
    return obj;
  });
}

function splitCsvLine(line) {
  var out = [];
  var cur = '';
  var inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; continue; }
      inQ = !inQ;
      continue;
    }
    if (ch === ';' || ch === ',') {
      if (inQ) { cur += ch; continue; }
      out.push(cur); cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function cleanCsvCell(v) {
  v = String(v).trim();
  if (v === '') return '';
  if (v !== '' && !isNaN(v)) return Number(v);
  if (v === 'Oui') return true;
  if (v === 'Non') return false;
  return v;
}

function dataImportRows(t, rows) {
  if (!Array.isArray(rows)) { showToast('Le fichier doit contenir un tableau de lignes.', 'error'); return; }
  rows = rows.filter(function (r) { return r && typeof r === 'object'; });
  if (!rows.length) { showToast('Aucune ligne valide dans le fichier.', 'error'); return; }
  var count = rows.length;
  showModal(
    'Importer ' + count + ' ligne(s) ?',
    'Cela remplacera la table « ' + t.label + ' » (' + (t.get().length) + ' ligne(s) actuelle(s)). Cette action est irréversible localement.',
    '📥',
    function () {
      try {
        t.replace(rows.map(unflattenRow));
        t.persist();
        (t.vo || []).forEach(function (fn) { if (typeof window[fn] === 'function') window[fn](); });
        renderDataScreen();
        showToast(count + ' ligne(s) importée(s) dans « ' + t.label + ' ».', 'success');
      } catch (err) {
        showToast('Import échoué : ' + err.message, 'error');
      }
    },
    { confirmText: 'Importer', danger: true, cancelText: 'Annuler' }
  );
}