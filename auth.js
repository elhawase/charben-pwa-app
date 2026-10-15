/* ─── AUTH SYSTEM (Firebase) ─── */
function getUsers() { return []; }
function saveUsers(u) { /* Firebase gère les users */ }

function getRoleLabel(role) {
  return { admin: 'Admin', production: 'Production', commercial: 'Commercial', quality: 'Qualité', securite: 'Sécurité', chef_ligne: 'Chef de Ligne', responsable_technique: 'Responsable Technique' }[role] || escapeHtml(String(role || 'Inconnu'));
}

function getRoleClass(role) {
  var safe = { admin: 'admin', production: 'production', commercial: 'commercial', quality: 'quality', securite: 'securite', chef_ligne: 'chef_ligne', responsable_technique: 'responsable_technique' }[role];
  return safe || 'default';
}

function getRoleColor(role) {
  return { admin: '#a86e36', production: '#2563eb', commercial: '#7c3aed', quality: '#059669', securite: '#dc2626', chef_ligne: '#f59e0b', responsable_technique: '#0ea5e9' }[role] || '#948a7c';
}

function isAdmin() {
  return currentRole === 'admin';
}

function hasPermission(perm) {
  if (!currentRole) return false;
  /* backward compat : ancien format plat ('view_of', etc.) */
  if (perm.indexOf(':') === -1) return checkLegacyPermission(currentRole, perm);
  /* nouveau format 'resource:action' */
  var parts = perm.split(':');
  return checkPermission(currentRole, parts[0], parts[1]);
}

function canAccessScreen(screen) {
  if (!currentRole) return false;
  return canRoleAccessScreen(currentRole, screen);
}

function showAuthOverlay() {
  const overlay = document.getElementById('authOverlay');
  overlay.classList.remove('hidden');
  overlay.classList.add('visible');
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
document.getElementById('loginError').textContent = '';
  document.getElementById('formLogin').classList.add('active');
  const regForm = document.getElementById('formRegister');
  if (regForm) regForm.classList.remove('active');
  try {
    var saved = JSON.parse(localStorage.getItem('charben_remember'));
    if (saved && saved.email) {
      document.getElementById('loginEmail').value = saved.email;
      document.getElementById('loginPassword').value = '';
      document.getElementById('rememberMe').checked = true;
    }
  } catch (e) {}
  checkIfBootstrapNeeded();
}

/* Le bouton d'inscription est TOUJOURS visible.
   Il ne liste plus la collection users pour savoir si elle est vide :
   - ça exposait la liste des comptes (et leurs emails) à un visiteur
     non authentifié, via l'API REST ;
   - et c'était une sécurité illusoire : l'inscription se fait via
     accounts:signUp, appelable directement sans passer par ce bouton.
   Qui devient admin est décidé par les règles, à partir de l'UID
   fondateur (isBootstrapAdmin() dans firestore.rules), pas par un
   compteur de documents. */
function checkIfBootstrapNeeded() {
  var registerBtn = document.getElementById('registerBtn');
  if (!registerBtn) return;
  registerBtn.style.display = 'block';
}

function showRegisterForm() {
  document.getElementById('formLogin').classList.remove('active');
  const regForm = document.getElementById('formRegister');
  if (regForm) regForm.classList.add('active');
  const regErr = document.getElementById('regError');
  if (regErr) regErr.textContent = '';
}

function showLoginForm() {
  const regForm = document.getElementById('formRegister');
  if (regForm) regForm.classList.remove('active');
  document.getElementById('formLogin').classList.add('active');
  document.getElementById('loginError').textContent = '';
}

async function diagTest() {
  var panel = document.getElementById('diagPanel');
  var content = document.getElementById('diagContent');
  var toggleBtn = document.getElementById('diagToggleBtn');
  if (!panel || !content) return;
  
  var lines = [];
  var capHttp = hasCapacitorHttp();
   lines.push('=== DIAGNOSTIC v7.0.2 ===');
  lines.push('Date: ' + new Date().toISOString());
  lines.push('Platform: ' + navigator.userAgent.substring(0, 80));
  lines.push('onLine: ' + navigator.onLine);
  lines.push('CapacitorHttp: ' + capHttp);
  lines.push('Capacitor: ' + (!!window.Capacitor));
  lines.push('');
  
  lines.push('[1/3] Test Internet...');
  try { var r1 = await netRequest('GET', 'https://httpbin.org/get', {}, null); lines.push('  OK (status: ' + r1.status + ')'); } catch(e) { lines.push('  FAIL: ' + e.message); }
  
  lines.push('[2/3] Test Firebase Auth API...');
  try { var r2 = await netRequest('POST', 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + firebaseConfig.apiKey, {'Content-Type':'application/json'}, {email:'test@test.com',password:'x',returnSecureToken:true}); lines.push('  Status: ' + r2.status + ' | Error: ' + (r2.data && r2.data.error ? r2.data.error.message : 'none')); } catch(e) { lines.push('  FAIL: ' + e.message); }
  
  lines.push('[3/3] Test Firestore REST...');
  if (authToken) {
    try { var r3 = await netRequest('GET', FS_REST + '/users', { 'Authorization': 'Bearer ' + authToken }, null); lines.push('  Status: ' + r3.status + ' | Auth: Bearer OK'); } catch(e) { lines.push('  FAIL: ' + e.message); }
  } else {
    try { var r3 = await netRequest('GET', FS_REST + '/users', {}, null); lines.push('  Status: ' + r3.status + (r3.status === 403 ? ' (attendu sans auth)' : '')); } catch(e) { lines.push('  FAIL: ' + e.message); }
  }
  
  lines.push('');
  lines.push('=== FIN ===');
  var report = lines.join('\n');
  content.textContent = report;
  
  window._diagReport = report;
  panel.style.display = 'block';
  if (toggleBtn) toggleBtn.style.display = 'block';
  
  try { localStorage.setItem('charben_diag_last', report); } catch(e) {}
}

function diagCopyReport() {
  var report = window._diagReport || localStorage.getItem('charben_diag_last') || 'Aucun rapport';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(report).then(function() { showToast('Rapport copie ! Colle-le sur WhatsApp.', 'success'); });
  } else {
    showPrompt('Rapport de diagnostic', 'Copiez ce rapport et envoyez-le sur WhatsApp :', report, function() {});
  }
}

function toggleDiagPanel() {
  var panel = document.getElementById('diagPanel');
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function clearAppCache() {
  showModal('Vider le cache', 'Vider le cache et recharger l\'application ?', '🗑', function() {
    try {
      Object.keys(localStorage).forEach(function(k) {
        if (k.startsWith('charben_')) localStorage.removeItem(k);
      });
      localStorage.removeItem('charben_user');
      localStorage.removeItem('charben_role');
      localStorage.removeItem('charben_theme');
    } catch(e) {}
    if ('caches' in window) {
      caches.keys().then(function(names) {
        names.forEach(function(n) { caches.delete(n); });
      });
    }
    showToast('Cache vide. Rechargement...', 'success');
    setTimeout(function() { location.reload(); }, 600);
  });
}

function diagAutoRun() {
}
diagAutoRun();

function hideAuthOverlay() {
  const overlay = document.getElementById('authOverlay');
  overlay.classList.remove('visible');
  overlay.classList.add('hidden');
}

async function handleLogin() {
  var email = document.getElementById('loginEmail').value.trim();
  var pass = document.getElementById('loginPassword').value;
  var errEl = document.getElementById('loginError');
  var btn = document.getElementById('loginBtn');
  if (!email || !pass) { errEl.textContent = 'Remplissez tous les champs.'; return; }
  btn.disabled = true; btn.classList.add('loading');
  errEl.textContent = '';
  try {
    var res = await netRequest('POST', 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + firebaseConfig.apiKey, { 'Content-Type': 'application/json' }, { email: email, password: pass, returnSecureToken: true });
    var data = res.data;
    if (data.error) {
      var errors = {
        'EMAIL_NOT_FOUND': 'Aucun compte associé à cet email.',
        'INVALID_PASSWORD': 'Mot de passe incorrect.',
        'USER_DISABLED': 'Ce compte a été désactivé.',
        'TOO_MANY_REQUESTS': 'Trop de tentatives. Réessayez plus tard.',
        'INVALID_EMAIL': 'Adresse email invalide.',
        'MISSING_EMAIL': 'Email requis.',
        'MISSING_PASSWORD': 'Mot de passe requis.'
      };
      errEl.textContent = errors[data.error.message] || 'Erreur : ' + data.error.message;
      btn.disabled = false; btn.classList.remove('loading');
      return;
    }
    authToken = data.idToken;
    authRefreshToken = data.refreshToken;
    authUid = data.localId;
    currentUser = { uid: data.localId, email: data.email || email };
    /* ── Phase 1b : sign-in SDK Firebase Auth ──
       1. realtimeSync.init() initialise Firebase.initializeApp() nécessaire pour firebase.auth()
       2. signInWithEmailAndPassword crée la session SDK pour que request.auth != null dans les règles
       3. startRealtimeSync() plus tard démarrera les listeners avec auth */
    if (window.realtimeSync && window.realtimeSync.init) window.realtimeSync.init();
    try {
      await firebase.auth().signInWithEmailAndPassword(email, pass);
      errLog('auth', 'signIn', 'Firebase SDK sign-in OK', 'info');
    } catch (e) {
      console.warn('[auth] Firebase SDK sign-in failed (non-bloquant):', e.message);
    }
    if (document.getElementById('rememberMe').checked) {
      try { localStorage.setItem('charben_remember', JSON.stringify({ email: email })); } catch (e) {}
    } else {
      try { localStorage.removeItem('charben_remember'); } catch (e) {}
    }
    await fetchUserRole(currentUser);
    if (!currentRole) {
      btn.disabled = false; btn.textContent = 'Se connecter';
      errEl.textContent = 'Votre compte n\'a pas de rôle attribué. Contactez l\'administrateur.';
      authToken = null; authRefreshToken = null; authUid = null; currentUser = null;
      return;
    }
    btn.disabled = false; btn.classList.remove('loading');
    hideAuthOverlay();
    showScreen('menu');
    updateHeaderUser();
    renderAccountCard();
    renderUserList();
    if (typeof applyPermissionGuard === 'function') applyPermissionGuard();
    await loadAllFromFirestore();
    if (typeof loadFardeauxFromFirestore === 'function') await loadFardeauxFromFirestore();
    var remoteObj = await fsLoad('lineObj');
    if (remoteObj && remoteObj.A && remoteObj.B) {
      saveToStorage('charben_line_objectives', remoteObj);
    } else {
      var localObj = loadFromStorage('charben_line_objectives', null);
      if (localObj && localObj.A && localObj.B && ((localObj.A.monthly_m3 || 0) > 0 || (localObj.B.monthly_m3 || 0) > 0)) {
        if (typeof fsSave === 'function') { try { fsSave('lineObj', localObj); } catch (e) {} }
      }
    }
    await mergeOrdersFromFirestore();
    if (typeof backfillProductionKpis === 'function') { try { await backfillProductionKpis(); } catch (e) {} }
    if (typeof renderDashboardKPIs === 'function') renderDashboardKPIs();
    startRealtimeSync();
    if (typeof startRealtimeListeners === 'function') startRealtimeListeners();
    saveSession();
    showToast('Connecté en tant que ' + currentUser.email, 'success');
  } catch (e) {
    btn.disabled = false; btn.classList.remove('loading');
    errEl.textContent = 'Erreur: ' + e.message + ' | online: ' + navigator.onLine;
    errEl.style.fontSize = '11px';
    console.error('Login error:', e);
  }
}

async function handleResetPassword() {
  var email = document.getElementById('loginEmail').value.trim();
  if (!email) { document.getElementById('loginError').textContent = 'Saisissez votre email d\'abord.'; return; }
  try {
    await netRequest('POST', 'https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=' + firebaseConfig.apiKey, { 'Content-Type': 'application/json' }, { requestType: 'PASSWORD_RESET', email: email });
    showToast('Email de réinitialisation envoyé.', 'success');
  } catch (e) {
    document.getElementById('loginError').textContent = 'Erreur : ' + e.message;
  }
}

async function handleRegister() {
  var email = document.getElementById('regEmail').value.trim();
  var pass = document.getElementById('regPassword').value;
  var errEl = document.getElementById('regError');
  var btn = document.getElementById('regBtn');
  if (!email || !pass) { errEl.textContent = 'Remplissez tous les champs.'; return; }
  if (pass.length < 6) { errEl.textContent = 'Le mot de passe doit faire 6+ caractères.'; return; }
  btn.disabled = true; btn.textContent = 'Création en cours...';
  errEl.textContent = '';
  try {
    var res = await netRequest('POST', 'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + firebaseConfig.apiKey, { 'Content-Type': 'application/json' }, { email: email, password: pass, returnSecureToken: true });
    var data = res.data;
    if (data.error) {
      var errors = {
        'EMAIL_EXISTS': 'Cet email est déjà utilisé.',
        'INVALID_EMAIL': 'Adresse email invalide.',
        'WEAK_PASSWORD': 'Mot de passe trop faible.',
        'OPERATION_NOT_ALLOWED': 'Création de compte désactivée.'
      };
      errEl.textContent = errors[data.error.message] || 'Erreur : ' + data.error.message;
      btn.disabled = false; btn.textContent = 'Créer mon compte';
      return;
    }
    authToken = data.idToken;
    authRefreshToken = data.refreshToken;
    authUid = data.localId;
    currentUser = { uid: data.localId, email: email };
    /* Phase 1b : sign-in SDK Firebase Auth pour les règles Firestore */
    if (window.realtimeSync && window.realtimeSync.init) window.realtimeSync.init();
    try {
      await firebase.auth().signInWithEmailAndPassword(email, pass);
      errLog('auth', 'register', 'Firebase SDK sign-in OK', 'info');
    } catch (e) {
      console.warn('[auth] Firebase SDK sign-in failed (register, non-bloquant):', e.message);
    }
    /* Le rôle est déterminé par l'UID, pas par un compteur de documents.
       rbacInitialRoleFor() renvoie 'admin' pour le compte fondateur et
       'production' pour tout le monde. Firestore Rules refutera toute
       autre valeur (canSelfCreateUser() dans firestore.rules). */
    var role = rbacInitialRoleFor(data.localId);
    await fsRestSet('users/' + data.localId, { email: email, role: role, displayName: email.split('@')[0], createdAt: new Date().toISOString() });
    currentRole = role;
    try { localStorage.setItem('charben_role_' + data.localId, role); } catch(e) {}
    btn.disabled = false; btn.textContent = 'Créer mon compte';
    hideAuthOverlay();
    updateHeaderUser();
    renderAccountCard();
    renderUserList();
    saveSession();
    showToast('Compte ' + getRoleLabel(role) + ' créé ! Bienvenue.', 'success');
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Créer mon compte';
    errEl.textContent = 'Erreur: ' + e.message + ' | online: ' + navigator.onLine;
    errEl.style.fontSize = '11px';
    console.error('Register error:', e);
  }
}

async function logoutUser() {
  fsUnsubscribeAll();
  if (authToken) {
    try { await netRequest('POST', 'https://identitytoolkit.googleapis.com/v1/accounts:signOut?key=' + firebaseConfig.apiKey, { 'Content-Type': 'application/json' }, { idToken: authToken }); } catch (e) {}
  }
  authToken = null; authRefreshToken = null; authUid = null;
  clearSession();
  currentUser = null;
  currentRole = null;
  try {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && (k.indexOf('charben_role_') === 0 || k === 'charben_remember')) keys.push(k);
    }
    keys.forEach(function(k) { localStorage.removeItem(k); });
  } catch(e) {}
  updateHeaderUser();
  renderAccountCard();
  renderUserList();
  showAuthOverlay();
}

async function fetchUserRole(user) {
  /* Lecture « détaillée » : distingue un 404 (document réellement absent)
     d'une PANNE (429/quota, réseau, 401 non rafraîchi). fsRestGet, lui,
     renvoie null dans les deux cas — cette confusion déconnectait
     l'utilisateur sur un simple 429 et détruisait le cache de rôle. */
  var rd;
  if (typeof fsRestGetDetailed === 'function') {
    rd = await fsRestGetDetailed('users/' + user.uid);
  } else {
    var legacy = await fsRestGet('users/' + user.uid);
    rd = legacy
      ? { status: 200, data: legacy, error: null }
      : { status: 0, data: null, error: 'unavailable' };
  }

  /* Lecture réussie : le document fait foi. */
  if (rd && !rd.error && rd.status !== 404) {
    if (rd.data && rd.data.role) {
      currentRole = rd.data.role;
      try { localStorage.setItem('charben_role_' + user.uid, currentRole); } catch (e) {}
    } else {
      currentRole = null;
      try { localStorage.removeItem('charben_role_' + user.uid); } catch (e) {}
    }
    return;
  }

  /* Document réellement absent : seul le compte fondateur (bootstrap)
     est auto-attribué 'admin'. Tout autre compte reste sans rôle. */
  if (rd && rd.status === 404) {
    currentRole = (user.uid === RBAC_BOOTSTRAP_UID && typeof rbacInitialRoleFor === 'function')
      ? rbacInitialRoleFor(user.uid)
      : null;
    if (currentRole) { try { localStorage.setItem('charben_role_' + user.uid, currentRole); } catch (e) {} }
    return;
  }

  /* Firestore indisponible : repli sur le cache SANS le détruire. Une
     panne n'est PAS une absence de rôle — on ne déconnecte pas. */
  var cached = null;
  try { cached = localStorage.getItem('charben_role_' + user.uid); } catch (e) {}
  currentRole = cached || null;
  if (cached) {
    errLog('auth', 'cache', 'Role depuis le cache (Firestore indisponible)', 'info');
  }
}

function updateHeaderUser() {
  if (!currentUser || !currentRole) { renderTopBarAvatar(); return; }
  renderTopBarAvatar();
  renderAccountCard();
}

function handleUserMenu() {
  if (!currentUser) { showAuthOverlay(); return; }
  showModal('Déconnexion', currentUser.email + ' (' + getRoleLabel(currentRole) + ') — Voulez-vous vous déconnecter ?', '👤', () => {
    logoutUser();
    showToast('Déconnecté.', 'info');
  });
}

function renderAccountCard() {
  const el = document.getElementById('accountSection');
  if (!el) return;
  if (!currentUser || !currentRole) { el.innerHTML = ''; return; }
  el.innerHTML =
    '<div class="account-card">' +
      '<div class="ac-avatar" style="background:' + getRoleColor(currentRole) + ';">' + currentUser.email.charAt(0).toUpperCase() + '</div>' +
      '<div class="ac-info">' +
        '<div class="ac-name">' + escapeHtml(currentUser.email) + '</div>' +
        '<div class="ac-role">' + getRoleLabel(currentRole) + '</div>' +
      '</div>' +
      '<button class="ac-logout" onclick="logoutUser()">Déconnexion</button>' +
    '</div>';
}

function deleteUser(userId) {
  showModal('Supprimer', 'Supprimer cet utilisateur ?', '🗑', () => {
    showToast('Suppression via Firebase Console.', 'info');
  });
}

async function renderUserList() {
  var section = document.getElementById('userManageSection');
  if (!section) return;
  if (!currentRole || !isAdmin()) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  try {
    var userDocs = await fsRestList('users');
    var users = userDocs.map(function(d) { return { id: d.id, email: d.data.email, role: d.data.role }; });
    var html = '<div class="um-header"><h4>👥 Utilisateurs <span class="um-count">' + users.length + '</span></h4>';
    html += '<button class="um-add-btn" onclick="showAddUserModal()">+ Ajouter</button></div>';
    if (users.length === 0) {
      html += '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:12px 0;">Aucun utilisateur sur ce projet. Le premier compte doit être créé depuis l\'écran de connexion.</p>';
    } else {
      users.forEach(function(u) {
        var isMe = currentUser && u.id === currentUser.uid;
        /* Le compte fondateur est verrouillé côté règles
           (isProtectedUser) : on affiche un badge, pas un select,
           pour ne pas proposer une action qui échouerait. */
        var isFounder = u.id === RBAC_BOOTSTRAP_UID;
        var safeUid = escapeHtml(u.id);
        html += '<div class="user-row">';
        html += '<div class="ur-avatar" style="background:' + getRoleColor(u.role) + ';">' + (u.email ? escapeHtml(u.email.charAt(0).toUpperCase()) : '?') + '</div>';
        html += '<div class="ur-info"><div class="ur-name">' + escapeHtml(u.email || u.id);
        if (isMe) html += ' <span class="ur-you">vous</span>';
        if (isFounder) html += ' <span class="ur-you">fondateur</span>';
        html += '</div>';
        if (isMe || isFounder) {
          html += '<span class="ur-role-badge ' + getRoleClass(u.role) + '">' + getRoleLabel(u.role) + '</span>';
        } else {
          html += '<select class="ur-role-select ' + getRoleClass(u.role) + '" data-uid="' + safeUid + '" data-prev="' + escapeHtml(u.role || '') + '" onchange="handleRoleChange(this)">';
          RBAC_ROLES.forEach(function(r) {
            html += '<option value="' + r + '"' + (r === u.role ? ' selected' : '') + '>' + getRoleLabel(r) + '</option>';
          });
          html += '</select>';
        }
        html += '</div><div class="ur-actions">';
        if (!isMe) {
          html += '<button class="ur-btn ur-btn-del" onclick="deleteUser(\'' + safeUid + '\')" title="Supprimer">🗑</button>';
        }
        html += '</div></div>';
      });
    }
    section.innerHTML = html;
  } catch (e) {
    section.innerHTML = '<div class="um-header"><h4>👥 Utilisateurs</h4></div><p style="font-size:12px;color:var(--danger);">Erreur Firestore: ' + escapeHtml(e.message) + '</p>';
  }
}

async function handleRoleChange(sel) {
  var uid = sel.getAttribute('data-uid');
  var newRole = sel.value;
  var oldRole = sel.getAttribute('data-prev') || '';
  sel.disabled = true;
  try {
    await rbacAssignRole(uid, newRole);
    showToast('Rôle de ' + escapeHtml(uid) + ' → ' + getRoleLabel(newRole), 'success');
    sel.setAttribute('data-prev', newRole);
  } catch (e) {
    showToast('Erreur: ' + escapeHtml(e.message), 'error');
    sel.value = oldRole || 'production';
  } finally {
    sel.disabled = false;
  }
}

function showAddUserModal() {
  showToast('Un compte se crée depuis l\'écran de connexion. Son rôle pourra être changé ici.', 'info');
}

function openRegisterFromSettings() {
  showAddUserModal();
}

