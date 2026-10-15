/* ═══════════════════════════════════════════════════════════════
   RBAC — helpers d'attribution de rôles (Spark, sans Cloud Functions)
   ───────────────────────────────────────────────────────────────
   Écrit directement dans Firestore users/{uid}.role.
   L'autorisation est appliquée par firestore.rules (testée dans
   tests/rbac-rules.test.mjs), pas par le client : un appel direct
   hors de ce fichier est refusé par les règles.

   Pourquoi pas de Cloud Functions ? Le déploiement des functions
   exige le plan Blaze (carte bancaire). Les règles Firestore
   fonctionnent sur le plan Spark. functions/index.js est conservé
   en réserve pour une éventuelle migration vers les Custom Claims.
   ═══════════════════════════════════════════════════════════════ */

var RBAC_ROLES = [
  'admin', 'production', 'chef_ligne', 'quality',
  'commercial', 'securite', 'responsable_technique'
];

/* Rôle appliqué par défaut à un nouveau compte (verrouillé par
   canSelfCreateUser() dans firestore.rules : impossible de demander
   autre chose, sauf pour le compte fondateur). */
var RBAC_DEFAULT_ROLE = 'production';

/* UID du compte fondateur (CEO). Doit correspondre à
   isBootstrapAdmin() dans firestore.rules. Seul compte autorisé à
   s'attribuer 'admin' lors de la création de son profil. */
var RBAC_BOOTSTRAP_UID = 'T5y779jXYROwEaQmMji5qh8FW263';

function rbacAssertValidRole(role) {
  if (RBAC_ROLES.indexOf(role) === -1) {
    throw new Error('Rôle invalide : ' + role);
  }
  return role;
}

/**
 * Rôle qu'un compte tout juste créé doit adopter.
 * @param {string} uid — UID du compte (connu après signUp)
 * @returns {string} 'admin' pour le fondateur, sinon 'production'
 */
function rbacInitialRoleFor(uid) {
  return uid === RBAC_BOOTSTRAP_UID ? 'admin' : RBAC_DEFAULT_ROLE;
}

/**
 * Change le rôle d'un utilisateur (écriture directe Firestore).
 * Refusée par firestore.rules si l'appelant n'est pas admin.
 * @param {string} uid — cible
 * @param {string} role — nouveau rôle
 * @returns {Promise<{uid, oldRole, newRole}>}
 */
async function rbacAssignRole(uid, role) {
  rbacAssertValidRole(role);
  var db = (typeof firebase !== 'undefined' && firebase.firestore)
    ? firebase.firestore()
    : null;
  if (!db) throw new Error('Firebase Firestore SDK non chargé');

  var ref = db.collection('users').doc(uid);
  var snap = await ref.get();
  var oldRole = snap.exists ? snap.data().role : null;

  await ref.update({ role: role });
  return { uid: uid, oldRole: oldRole, newRole: role };
}

/**
 * Révoque le rôle d'un utilisateur (retour au rôle par défaut).
 * @param {string} uid — cible
 * @returns {Promise<{uid, oldRole, newRole}>}
 */
async function rbacRevokeRole(uid) {
  return await rbacAssignRole(uid, RBAC_DEFAULT_ROLE);
}

/**
 * Le rôle est lu à chaque évaluation de règle : aucun cache de token
 * à rafraîchir. Conservé pour compatibilité avec les anciens appelants
 * (renvoie le rôle courant sans appel réseau).
 * @returns {Promise<{role}>}
 */
async function rbacRefreshClaims() {
  var user = (typeof firebase !== 'undefined' && firebase.auth)
    ? firebase.auth().currentUser
    : null;
  if (!user) throw new Error('Aucun utilisateur connecté');
  return { role: typeof currentRole !== 'undefined' ? currentRole : null };
}

/**
 * Réservé — plus nécessaire sans Custom Claims.
 * @returns {Promise<string>} token ID courant
 */
async function rbacForceTokenRefresh() {
  var user = (typeof firebase !== 'undefined' && firebase.auth)
    ? firebase.auth().currentUser
    : null;
  if (!user) throw new Error('Aucun utilisateur connecté');
  return await user.getIdToken(false);
}
