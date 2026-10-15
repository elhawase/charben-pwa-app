/* ═══════════════════════════════════════════════════════════════════
   PERMISSIONS — Matrice unique Rôle × Ressource × Action
   Source de vérité. Tout le reste (auth.js, UI guard, Firestore rules)
   lit ICI.
   ═══════════════════════════════════════════════════════════════════ */

/*
  Ressources = modules métier de la scierie :
    grumes       Réception, stock grumes, scan QR
    planning     Planning prod, OF, gammes
    sciage       Débit A1/A2/A3/A4, params ligne
    sechage      WIP, lots séchage
    transfert_pf Conformité, transfert PF
    stock_pf     Inventaire PF, mouvements
    rendement    Yield, KPIs, dashboards
    reglages     Cales machines, params technique
    users        Gestion utilisateurs / rôles
    settings     Réglages app, thème, config

  Actions :
    view   Lecture seule
    add    Création
    edit   Modification
    delete Suppression
    scan   Scan QR / code-barres
    start  Démarrer un processus (débit, sciage)
    validate Valider / approuver (conformité, qualité)
    export Exporter / imprimer
*/

var PERMISSIONS_MATRIX = {

  /* ─── Admin : tout ─── */
  admin: {
    grumes:       ['view','add','edit','delete','scan'],
    planning:     ['view','add','edit','delete'],
    sciage:       ['view','add','edit','delete','start'],
    sechage:      ['view','add','edit','delete'],
    transfert_pf: ['view','add','edit','delete','validate'],
    stock_pf:     ['view','add','edit','delete'],
    rendement:    ['view','add','edit','delete','export'],
    reglages:     ['view','add','edit','delete'],
    users:        ['view','add','edit','delete'],
    settings:     ['view','add','edit','delete'],
    trace:        ['view']
  },

  /* ─── Production : cœur de métier ─── */
  production: {
    grumes:       ['view','add','scan'],
    planning:     ['view','edit'],
    sciage:       ['view','start'],
    sechage:      ['view','edit'],
    transfert_pf: ['view'],
    stock_pf:     ['view','edit'],
    rendement:    ['view'],
    reglages:     ['view'],
    users:        [],
    settings:     ['view'],
    trace:        ['view']
  },

  /* ─── Chef de ligne : opérateur + supervision ligne ─── */
  chef_ligne: {
    grumes:       ['view','add','scan'],
    planning:     ['view','edit'],
    sciage:       ['view','start','edit'],
    sechage:      ['view'],
    transfert_pf: [],
    stock_pf:     ['view'],
    rendement:    ['view'],
    reglages:     ['view','edit'],
    users:        [],
    settings:     ['view'],
    trace:        ['view']
  },

  /* ─── Qualité : validation, conformité ─── */
  quality: {
    grumes:       ['view'],
    planning:     ['view'],
    sciage:       ['view'],
    sechage:      ['view','validate'],
    transfert_pf: ['view','validate'],
    stock_pf:     ['view'],
    rendement:    ['view','export'],
    reglages:     ['view'],
    users:        [],
    settings:     [],          /* quality : pas d'accès Réglages (admin only) */
    trace:        ['view']
  },

  /* ─── Commercial : lecture seule, rendement ─── */
  commercial: {
    grumes:       ['view'],
    planning:     ['view'],
    sciage:       [],
    sechage:      [],
    transfert_pf: ['view'],
    stock_pf:     ['view'],
    rendement:    ['view','export'],
    reglages:     [],
    users:        [],
    settings:     [],         /* commercial : pas d'accès Réglages (admin only) */
    trace:        ['view']
  },

  /* ─── Sécurité : lecture + scan grumes ─── */
  securite: {
    grumes:       ['view','scan'],
    planning:     [],
    sciage:       ['view'],
    sechage:      ['view'],
    transfert_pf: [],
    stock_pf:     ['view'],
    rendement:    ['view'],
    reglages:     [],
    users:        [],
    settings:     ['view'],
    trace:        ['view']
  },

  /* ─── Responsable technique : params + superv technique ─── */
  responsable_technique: {
    grumes:       ['view','edit'],
    planning:     ['view','edit'],
    sciage:       ['view','edit'],
    sechage:      ['view'],
    transfert_pf: ['view'],
    stock_pf:     ['view'],
    rendement:    ['view'],
    reglages:     ['view','edit'],
    users:        [],
    settings:     ['view','edit'],
    trace:        ['view']
  }
};

/* ─── Mapping écran → ressource(s) requises ─── */
var SCREEN_RESOURCES = {
  production: ['sciage','planning'],
  planning:   ['planning'],
  mp:         ['grumes'],
  pf:         ['stock_pf','transfert_pf'],
  equip:      ['reglages'],
  disques:    ['reglages'],
  rendement:  ['rendement'],
  settings:   ['settings'],
  users:      ['users'],
  trace:      ['trace'],
  menu:       []   /* toujours visible */
};

/* ─── Permissions legacy → ressource:action (rétrocompatibilité) ─── */
var LEGACY_PERM_MAP = {
  view_of:       'planning:view',
  edit_of:       'planning:edit',
  validate_of:   'transfert_pf:validate',
  view_settings: 'settings:view',
  edit_settings: 'settings:edit',
  view_stock:    'grumes:view',
  edit_stock:    'grumes:edit',
  view_yield:    'rendement:view',
  view_tools:    'reglages:view',
  manage_users:  'users:edit',
  edit_pattern:  'reglages:edit',
  admin_panel:   'settings:edit'
};

/* ═══ API publique ═══ */

/**
 * Vérifie une permission ressource:action pour un rôle donné.
 * @param {string} role     — ex. 'production'
 * @param {string} resource — ex. 'grumes'
 * @param {string} action   — ex. 'scan'
 * @returns {boolean}
 */
function checkPermission(role, resource, action) {
  if (!role || !resource || !action) return false;
  var perms = PERMISSIONS_MATRIX[role];
  if (!perms) return false;
  var allowed = perms[resource];
  if (!allowed) return false;
  return allowed.indexOf(action) !== -1;
}

/**
 * Vérifie une permission legacy (ancien format plat).
 * Utiliser pour migration progressive — les anciens appels
 * hasPermission('view_of') continuent de fonctionner.
 * @param {string} role  — ex. 'production'
 * @param {string} perm  — ex. 'view_of'
 * @returns {boolean}
 */
function checkLegacyPermission(role, perm) {
  var mapped = LEGACY_PERM_MAP[perm];
  if (!mapped) return false;
  var parts = mapped.split(':');
  return checkPermission(role, parts[0], parts[1]);
}

/**
 * Vérifie si un rôle peut accéder à un écran donné.
 * @param {string} role   — ex. 'production'
 * @param {string} screen — ex. 'planning'
 * @returns {boolean}
 */
function canRoleAccessScreen(role, screen) {
  if (!role) return false;
  if (role === 'admin') return true;
  var resources = SCREEN_RESOURCES[screen];
  if (!resources || !resources.length) return true; /* menu, inconnu */
  var perms = PERMISSIONS_MATRIX[role];
  if (!perms) return false;
  for (var i = 0; i < resources.length; i++) {
    var r = resources[i];
    if (perms[r] && perms[r].length > 0) return true;
  }
  return false;
}

/**
 * Retourne la liste des ressources auxquelles un rôle a accès.
 * Utile pour le UI guard (masquer les onglets/boutons inutiles).
 * @param {string} role
 * @returns {string[]}
 */
function getAllowedResources(role) {
  if (!role) return [];
  if (role === 'admin') {
    return Object.keys(PERMISSIONS_MATRIX.admin);
  }
  var perms = PERMISSIONS_MATRIX[role];
  if (!perms) return [];
  var result = [];
  var keys = Object.keys(perms);
  for (var i = 0; i < keys.length; i++) {
    if (perms[keys[i]].length > 0) result.push(keys[i]);
  }
  return result;
}

/**
 * Vérifie si un rôle a au moins UNE action sur une ressource.
 * @param {string} role
 * @param {string} resource
 * @returns {boolean}
 */
function hasAnyPermission(role, resource) {
  if (!role || !resource) return false;
  var perms = PERMISSIONS_MATRIX[role];
  if (!perms) return false;
  return !!(perms[resource] && perms[resource].length > 0);
}

/**
 * Applique le UI guard : masque tous les éléments avec
 * data-perm="resource:action" si l'utilisateur n'a pas la permission.
 * À appeler après chaque rendu de page.
 */
function applyPermissionGuard() {
  var role = (typeof currentRole !== 'undefined') ? currentRole : null;
  if (!role) return;

  var els = document.querySelectorAll('[data-perm]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    var spec = el.getAttribute('data-perm');
    if (!spec) continue;

    var parts = spec.split(':');
    var resource = parts[0];
    var action = parts[1] || 'view';

    if (!checkPermission(role, resource, action)) {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.style.display = '';
      el.removeAttribute('aria-hidden');
    }
  }
}

/* ─── Export Node (source unique partagée client ↔ serveur) ───
   En navigateur, `module` est absent : ce bloc est ignoré (comportement
   client strictement inchangé). En Node (package.json type=commonjs),
   api/permissions.mjs charge CE fichier via createRequire : une seule
   matrice PERMISSIONS_MATRIX pilote l'UI client ET le RBAC de l'API. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PERMISSIONS_MATRIX: PERMISSIONS_MATRIX,
    SCREEN_RESOURCES: SCREEN_RESOURCES,
    LEGACY_PERM_MAP: LEGACY_PERM_MAP,
    checkPermission: checkPermission,
    checkLegacyPermission: checkLegacyPermission,
    canRoleAccessScreen: canRoleAccessScreen,
    getAllowedResources: getAllowedResources,
    hasAnyPermission: hasAnyPermission
  };
}
