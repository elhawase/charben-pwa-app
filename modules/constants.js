/**
 * CONSTANTS.JS — Constantes métier dédiées (labels, colonnes)
 * Scierie Charben — Extraits depuis data-tables.js
 * BUG FIX: DATA_FIELD_LABELS était duplicué dans data-tables.js (lignes 12 et 44)
 * Ce module contient la version unique et dédupliquée
 */
'use strict';

/* ─────────────────────────────────────────────
   DATA_FIELD_LABELS — libellés français
   Extrait: data-tables.js lignes 12-87 (DEDUPLIQUE)
   ───────────────────────────────────────────── */

window.DATA_FIELD_LABELS = {
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
  cote: 'Cote', qte: 'Quantité', product: 'Produit', grade: 'Classe',
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
  contact: 'Contact', phone: 'Téléphone', email: 'Email',
  address: 'Adresse', city: 'Ville'
};

/* ─────────────────────────────────────────────
   DATA_TABLE_COLUMNS — colonnes par table
   Extrait: data-tables.js lignes 90-216
   ───────────────────────────────────────────── */

window.DATA_TABLE_COLUMNS = {
  orders: [
    { k: 'orderNum', label: 'N° OF' }, { k: 'clientName', label: 'Client' },
    { k: 'reference', label: 'Référence' }, { k: 'wood', label: 'Type de bois' },
    { k: 'essence', label: 'Essence' }, { k: 'logWidth', label: 'Grume (mm)' },
    { k: 'length', label: 'Longueur (mm)' }, { k: 'qty', label: 'Quantité' },
    { k: 'line', label: 'Ligne' }, { k: 'status', label: 'Statut' },
    { k: 'date', label: 'Date' }, { k: 'remarks', label: 'Remarques' }
  ],
  ofHistory: [
    { k: 'orderNum', label: 'N° OF' }, { k: 'field', label: 'Champ' },
    { k: 'oldVal', label: 'Ancienne' }, { k: 'newVal', label: 'Nouvelle' },
    { k: 'time', label: 'Heure' }
  ],
  rawMaterials: [
    { k: 'code', label: 'Code' }, { k: 'essence', label: 'Essence' },
    { k: 'longueur', label: 'Longueur (m)' }, { k: 'diametre', label: 'Diamètre (cm)' },
    { k: 'volume', label: 'Volume (m³)' }, { k: 'statut', label: 'Statut' },
    { k: 'fournisseur', label: 'Fournisseur' }
  ],
  dryingBatches: [
    { k: 'batchNum', label: 'Lot' }, { k: 'species', label: 'Essence' },
    { k: 'volume', label: 'Volume (m³)' }, { k: 'temp', label: 'Temp (°C)' },
    { k: 'entryDate', label: 'Entrée' }, { k: 'exitDate', label: 'Sortie' },
    { k: 'status', label: 'Statut' }
  ],
  wipProducts: [
    { k: 'ref', label: 'Réf SF' }, { k: 'type', label: 'Type' }, { k: 'essence', label: 'Essence' },
    { k: 'epaisseur', label: 'Ép. (mm)' }, { k: 'largeur', label: 'Larg. (mm)' },
    { k: 'longueur', label: 'Long. (m)' }, { k: 'qte', label: 'Qté' },
    { k: 'volume', label: 'Volume (m³)' }, { k: 'statut', label: 'Statut' }
  ],
  finishedGoods: [
    { k: 'type', label: 'Produit' }, { k: 'essence', label: 'Essence' },
    { k: 'epaisseur', label: 'Épaisseur' }, { k: 'largeur', label: 'Largeur' },
    { k: 'longueur', label: 'Longueur' }, { k: 'qte', label: 'Quantité' },
    { k: 'statut', label: 'Statut' }
  ],
  fardeaux: [
    { k: 'code', label: 'Code' }, { k: 'species', label: 'Essence' },
    { k: 'nbPieces', label: 'Pièces' }, { k: 'volumeTotal', label: 'Volume (m³)' },
    { k: 'statut', label: 'Statut' }, { k: 'items', label: 'Pièces du fardeau' }
  ],
  productionPlan: [
    { k: 'wood', label: 'Bois' }, { k: 'logWidth', label: 'Grume' },
    { k: 'central', label: 'Centre' }, { k: 'laterals', label: 'Latérales' },
    { k: 'length', label: 'Longueur' }, { k: 'qty', label: 'Quantité' },
    { k: 'line', label: 'Ligne' }, { k: 'date', label: 'Date' },
    { k: 'status', label: 'Statut' }
  ],
  auditLogs: [
    { k: 'ts', label: 'Horodatage' }, { k: 'user', label: 'Utilisateur' },
    { k: 'action', label: 'Action' }, { k: 'details', label: 'Détails' }
  ],
  ofSavedQueries: [
    { k: 'label', label: 'Nom' }, { k: 'query', label: 'Requête' },
    { k: 'createdAt', label: 'Créé le' }
  ]
};
