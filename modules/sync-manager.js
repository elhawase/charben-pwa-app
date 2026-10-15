/**
 * SYNC-MANAGER.JS — Authentification & synchronisation Firestore temps réel
 * Scierie Charben — Extraits depuis app.js
 * IMPORTANT: NE PAS TOUCHER firebase-core.js (confidentialité)
 * Globals: currentUser, currentRole, authRefreshToken, authUid, authToken,
 *          fsRestGet, fsSubscribe, fsPollIntervals, mergeOrdersFromFirestore,
 *          loadAllFromFirestore, clearSession, showAuthOverlay, hideAuthOverlay,
 *          refreshAuthToken, checkIfBootstrapNeeded, loadFardeauxFromFirestore,
 *          renderGrumes, renderDryList, renderProduitsFinis, renderEquipList,
 *          renderMaintList, renderShifts, renderAuditLogs, renderQualityList,
 *          renderPlanningList, renderProdPlanList, renderDisquesAll,
 *          renderFardeauxList, renderAccountCard, renderUserList,
 *          showScreen, updateHeaderUser, getAppPref, showToast
 */
'use strict';

/* ─────────────────────────────────────────────
   initAuth — restauration session au démarrage
   Extrait: app.js lignes 9029-9071
   ───────────────────────────────────────────── */

window._syncManager_initAuth = async function() {
  try {
    var saved = JSON.parse(localStorage.getItem('charben_session') || 'null');
    if (!saved || !saved.refreshToken || !saved.uid) {
      showAuthOverlay();
      checkIfBootstrapNeeded();
      return;
    }
    authRefreshToken = saved.refreshToken;
    authUid = saved.uid;
    var ok = await refreshAuthToken();
    if (!ok || !authToken) {
      clearSession();
      showAuthOverlay();
      checkIfBootstrapNeeded();
      return;
    }
    /* Sauvegarder le refresh token mis à jour (Firebase le tourne à chaque refresh) */
    saveSession();
    /* Lecture détaillée : distingue un 404 (document réellement absent) d'une
       panne (429/quota/réseau/401). fsRestGet renvoyait null dans les deux
       cas — un 429 au reload détruisait une session valide. */
    var rd;
    if (typeof fsRestGetDetailed === 'function') {
      rd = await fsRestGetDetailed('users/' + authUid);
    } else {
      var legacyRole = await fsRestGet('users/' + authUid);
      rd = legacyRole ? { status: 200, data: legacyRole, error: null } : { status: 0, data: null, error: 'unavailable' };
    }
    if (rd && rd.error) {
      /* Firestore indisponible : repli sur le cache de rôle SANS purger la
         session. Si aucun rôle en cache, l'overlay reste (règle : currentRole
         null n'appelle jamais hideAuthOverlay). */
      var cachedRole = null;
      try { cachedRole = localStorage.getItem('charben_role_' + authUid); } catch(e) {}
      if (!cachedRole) {
        errLog('sync-manager', 'initAuth', 'Firestore indisponible — session conservée, rôle inconnu', 'warn');
        showAuthOverlay();
        checkIfBootstrapNeeded();
        return;
      }
      currentUser = { uid: authUid, email: '' };
      currentRole = cachedRole;
    } else {
      var roleDoc = (rd && !rd.error) ? rd.data : null;
      if (!roleDoc || !roleDoc.role) {
        clearSession();
        showAuthOverlay();
        checkIfBootstrapNeeded();
        return;
      }
      currentUser = { uid: authUid, email: roleDoc.email || '' };
      currentRole = roleDoc.role;
    }
    try { localStorage.setItem('charben_role_' + authUid, currentRole); } catch(e) {}
    hideAuthOverlay();
    showScreen('menu');
    updateHeaderUser();
    renderAccountCard();
    renderUserList();
    if (typeof applyPermissionGuard === 'function') applyPermissionGuard();
    /* Squelette sur le VRAI attente reseau qui suit (localStorage est
       instantane, Firestore non) : sans ca le dashboard affiche un
       etat vide pendant plusieurs secondes. */
    var kpiBox = document.getElementById('dashboardKPIs');
    if (kpiBox && typeof showSkeleton === 'function') {
      showSkeleton(kpiBox, { shape: 'kpi', lines: 4, label: 'Chargement des indicateurs de production' });
    }
    await loadAllFromFirestore();
    if (typeof loadFardeauxFromFirestore === 'function') await loadFardeauxFromFirestore();
    /* Rejouer les ecritures en attente (file IndexedDB) apres restauration de session */
    if (window._offlineQueue && window._offlineQueue.flushPendingSync) {
      try { window._offlineQueue.flushPendingSync(); } catch (e) {}
    }
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
    /* Retirer le squelette AVANT le rendu reel : le rendu remplace le
       contenu de toute facon, on evite juste un saut de layout vide. */
    if (kpiBox && typeof hideSkeleton === 'function') hideSkeleton(kpiBox);
    if (typeof renderDashboardKPIs === 'function') renderDashboardKPIs();
    window._syncManager_startRealtimeSync();
    /* ── Backfill + fusion prodCounters / lineLaunch (jamais sync avant) ── */
    try { await backfillProductionKpis(); } catch (e) {}
    /* ── Démarrer les listeners temps réel (onSnapshot) ── */
    startRealtimeListeners();
    showToast('Session restaurée — ' + currentUser.email, 'success');
  } catch (e) {
    errLog('sync-manager', 'Session restore', e, 'warn');
    if (kpiBox && typeof hideSkeleton === 'function') hideSkeleton(kpiBox);
    clearSession();
    showAuthOverlay();
    checkIfBootstrapNeeded();
  }
};

/* Fusion compteurs : max par ligne/machine (compteurs monotones) */
function mergeCounters(local, remote) {
  var out = JSON.parse(JSON.stringify(remote || {}));
  Object.keys(local || {}).forEach(function(line) {
    if (!out[line]) out[line] = {};
    Object.keys(local[line] || {}).forEach(function(mac) {
      var a = Number(out[line][mac] || 0), b = Number(local[line][mac] || 0);
      out[line][mac] = Math.max(a, b);
    });
  });
  return out;
}

/* Clé stable pour dédup : id si présent, sinon code|ofNum|launchedAt|widthMmm (champs immuables) */
function llKey(l) {
  if (!l) return '';
  if (l.id) return 'id:' + l.id;
  return 'k:' + [l.code, l.ofNum, l.launchedAt, l.widthMm].join('|');
}

/* Fusion lineLaunch : union des grumes lancées par ligne/OF (dédupliqué par clé stable) */
function mergeLineLaunch(local, remote) {
  var out = JSON.parse(JSON.stringify(remote || {}));
  Object.keys(local || {}).forEach(function(line) {
    if (!out[line]) out[line] = { launched: [] };
    if (!Array.isArray(out[line].launched)) out[line].launched = [];
    var seen = {};
    out[line].launched.forEach(function(l) { seen[llKey(l)] = 1; });
    (local[line] && local[line].launched || []).forEach(function(l) {
      var key = llKey(l);
      if (!seen[key]) { out[line].launched.push(l); seen[key] = 1; }
    });
  });
  return out;
}

async function backfillProductionKpis() {
  if (typeof fsLoad !== 'function') return;
  /* prodCounters */
  if (typeof prodCounters !== 'undefined' && prodCounters) {
    var remotePC = await fsLoad('prodCounters');
    var mergedPC = mergeCounters(prodCounters, remotePC || {});
    prodCounters = mergedPC;
    saveToStorage('charben_prod_counters', prodCounters);
    if (typeof fsSave === 'function') fsSave('prodCounters', prodCounters);
  }
  /* lineLaunch */
  if (typeof lineLaunch !== 'undefined' && lineLaunch) {
    var remoteLL = await fsLoad('lineLaunch');
    var mergedLL = mergeLineLaunch(lineLaunch, remoteLL || {});
    lineLaunch = mergedLL;
    saveToStorage(LINE_LAUNCH_KEY, lineLaunch);
    if (typeof fsSave === 'function') fsSave('lineLaunch', lineLaunch);
  }
}

/* ─────────────────────────────────────────────
   startRealtimeSync — abonnements Firestore temps réel
   Extrait: app.js lignes 9073-9097
   ───────────────────────────────────────────── */

window._syncManager_startRealtimeSync = function() {
  if (getAppPref('charben_auto_sync', '1') === '0') return;
  /* ── Silent sync : données synchronisées, aucun re-render automatique ── */
  fsSubscribe('raw', rawMaterials, function() { renderGrumes(); if (typeof renderDashboardKPIs === 'function') renderDashboardKPIs(); }, 'charben_raw');
  fsSubscribe('wip', wipProducts, function() { renderWipList(); }, 'charben_wip');
  fsSubscribe('stock', finishedGoods, function() { renderProduitsFinis(); if (typeof renderDashboardKPIs === 'function') renderDashboardKPIs(); }, 'charben_stock');
  fsSubscribe('equip', equipment, renderEquipList, 'charben_equip');
  fsSubscribe('maint', maintenanceLogs, renderMaintList, 'charben_maint');
  fsSubscribe('shifts', shifts, renderShifts, 'charben_shifts');
  fsSubscribe('audit', auditLogs, renderAuditLogs, 'charben_audit');
  fsSubscribe('qc', qualityChecks, renderQualityList, 'charben_qc');
  fsSubscribe('planning', planningTasks, renderPlanningList, 'charben_planning');
  fsSubscribe('prod', productionPlan, renderProdPlanList, 'charben_prodplan');
  fsSubscribe('disques', disques, renderDisquesAll, 'charben_disques');
  if (typeof fardeaux !== 'undefined' && typeof FS_COLLECTIONS !== 'undefined') {
    if (!FS_COLLECTIONS.fardeaux) FS_COLLECTIONS.fardeaux = 'fardeaux';
    if (typeof renderFardeauxList === 'function') fsSubscribe('fardeaux', fardeaux, renderFardeauxList, 'charben_fardeaux');
  }
  if (!fsPollIntervals['orders']) {
    fsPollIntervals['orders'] = setInterval(function() {
      if (currentUser) mergeOrdersFromFirestore().then(function() { if (typeof renderDashboardKPIs === 'function') renderDashboardKPIs(); });
    }, 30000);
  }
  /* ── Sync prodCounters + lineLaunch (KPI production) ── */
  if (!fsPollIntervals['prodCounters']) {
    fsPollIntervals['prodCounters'] = setInterval(function() {
      if (currentUser) {
        fsLoad('prodCounters').then(function(remote) {
          if (remote && typeof prodCounters !== 'undefined') {
            var merged = mergeCounters(prodCounters, remote);
            if (JSON.stringify(merged) !== JSON.stringify(prodCounters)) {
              prodCounters = merged;
              safeSave('charben_prod_counters', prodCounters);
              if (typeof renderDashboardKPIs === 'function') renderDashboardKPIs();
            }
          }
        }).catch(function() {});
        fsLoad('lineLaunch').then(function(remote) {
          if (remote && typeof lineLaunch !== 'undefined') {
            var merged2 = mergeLineLaunch(lineLaunch, remote);
            if (JSON.stringify(merged2) !== JSON.stringify(lineLaunch)) {
              lineLaunch = merged2;
              safeSave(LINE_LAUNCH_KEY, lineLaunch);
              if (typeof renderDashboardKPIs === 'function') renderDashboardKPIs();
            }
          }
        }).catch(function() {});
      }
    }, 15000);
  }
};

/* ─────────────────────────────────────────────
   EXPORT GLOBAL — wrappers compatibles
   ───────────────────────────────────────────── */

window.syncManager = {
  initAuth: window._syncManager_initAuth,
  startRealtimeSync: window._syncManager_startRealtimeSync,
  mergeLineLaunch: mergeLineLaunch
};

/* ── Listeners temps réel via Firebase onSnapshot ── */
function startRealtimeListeners() {
  if (typeof realtimeSync === 'undefined' || !realtimeSync.init) return;
  try {
    realtimeSync.init();
    /* Enregistrer les callbacks de rendu */
    realtimeSync.setRenderCallback('raw', function() { renderGrumes(); if (typeof renderDashboardKPIs === 'function') renderDashboardKPIs(); });
    realtimeSync.setRenderCallback('wip', function() { renderWipList(); });
    realtimeSync.setRenderCallback('stock', function() { renderProduitsFinis(); if (typeof renderDashboardKPIs === 'function') renderDashboardKPIs(); });
    realtimeSync.setRenderCallback('orders', function() { mergeOrdersFromFirestore().then(function() { if (typeof renderDashboardKPIs === 'function') renderDashboardKPIs(); }); });
    realtimeSync.setRenderCallback('equip', renderEquipList);
    realtimeSync.setRenderCallback('maint', renderMaintList);
    realtimeSync.setRenderCallback('shifts', renderShifts);
    realtimeSync.setRenderCallback('audit', renderAuditLogs);
    realtimeSync.setRenderCallback('qc', renderQualityList);
    realtimeSync.setRenderCallback('planning', renderPlanningList);
    realtimeSync.setRenderCallback('prod', renderProdPlanList);
    realtimeSync.setRenderCallback('disques', renderDisquesAll);
    if (typeof fardeaux !== 'undefined') {
      realtimeSync.setRenderCallback('fardeaux', renderFardeauxList);
    }
    realtimeSync.setRenderCallback('prodCounters', function() { if (typeof renderDashboardKPIs === 'function') renderDashboardKPIs(); });
    realtimeSync.setRenderCallback('lineLaunch', function() { if (typeof renderDashboardKPIs === 'function') renderDashboardKPIs(); });
    /* Démarrer les listeners pour toutes les collections */
    var keys = ['raw','orders','wip','stock','equip','maint','shifts','audit','qc','planning','prod','disques','prodCounters','lineLaunch'];
    keys.forEach(function(k) { realtimeSync.startListener(k); });
    errLog('sync', 'start', 'Realtime listeners started (' + keys.length + ' collections)', 'info');
  } catch (e) {
    errLog('sync-manager', 'Realtime init', e.message, 'warn');
  }
}
