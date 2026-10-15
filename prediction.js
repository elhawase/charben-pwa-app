/**
 * PREDICTION.JS — Prédiction consommation grumes + alertes stock
 * Pattern inspiré de "AI demand prediction" (OpenWES), sans serveur.
 * Analyse l'historique des OF réalisés pour anticiper la pénurie.
 * Date: 2026-09-11
 */

'use strict';

(function () {

  /**
   * Charge l'historique des OF réalisés.
   *
   * `charben_orders` est une clé PRÉ-v6 : elle n'existe plus sur une base réelle
   * (realtime-sync.js:22 déclare charben_orders_v6). La lire renvoyait toujours un
   * tableau vide, donc toutes les prédictions partaient de zéro historique.
   */
  function loadAllOrders() {
    if (typeof orders !== 'undefined' && Array.isArray(orders) && orders.length) return orders;
    var cles = ['charben_orders_v6', 'charben_orders'];
    for (var i = 0; i < cles.length; i++) {
      try {
        var brut = localStorage.getItem(cles[i]);
        if (brut) {
          var p = JSON.parse(brut);
          if (Array.isArray(p)) return p;
        }
      } catch (e) { /* stock corrompu : clé suivante */ }
    }
    return [];
  }

  function loadRealisedOrders() {
    return loadAllOrders().filter(o => {
      const s = (o.status || '').toLowerCase();
      return s === 'realise' || s === 'realised' || s === 'done' || s === 'complete';
    });
  }

  /**
   * Résumé consommation par diamètre (moyenne / semaine + besoin)
   * @param {number} weeksBack - fenêtre analysée (semaines)
   * @returns {Object} { [diametre]: { avg_per_week, need_for_2weeks, current_stock, will_run_out, nbOrders } }
   */
  function predictGrumesConsumption(weeksBack) {
    const weeks = weeksBack || 4;
    const orders = loadRealisedOrders();
    const byDiameter = {};

    orders.forEach(o => {
      const dir = diameterOf(o);
      // Un OF sans diamètre réel ne doit pas être rangé sous un diamètre par
      // défaut. Avec `|| 65`, les 41 OF réalisées (aucune ne porte de
      // grumeDiametre) tombaient toutes dans un bucket « 65 cm » : aucune
      // grume du parc ne fait 65 cm, le stock lu valait 0 et l'app affichait
      // une alerte de rupture permanente et fausse.
      if (!dir) return;
      if (!byDiameter[dir]) byDiameter[dir] = 0;
      byDiameter[dir]++;
    });

    const result = {};
    Object.keys(byDiameter).forEach(d => {
      const avgPerWeek = +(byDiameter[d] / weeks).toFixed(2);
      const need2w = Math.ceil(avgPerWeek * 2);
      const current = getGrumesStockByDiameter(d);
      result[d] = {
        avg_per_week: avgPerWeek,
        need_for_2weeks: need2w,
        current_stock: current,
        will_run_out: current < need2w,
        nb_orders: byDiameter[d]
      };
    });
    return result;
  }

  /**
   * Normalise un diamètre (ex "65cm" → "65", "CM65" → "65")
   */
  function normalizeDiameter(raw) {
    const m = String(raw).match(/(\d+(\.\d+)?)/);
    return m ? m[1] : '65';
  }

  /**
   * Diamètre porté par l'OF, normalisé. `null` si l'OF n'en porte aucun.
   * Le diamètre est enregistré au lancement de la grume (grumes-manager.js) :
   * à la création de l'OF il est inconnu, l'OF n'a pas encore de matière.
   */
  function diameterOf(o) {
    if (!o) return null;
    const brut = (o.grumeDiametre !== undefined && o.grumeDiametre !== null && o.grumeDiametre !== '')
      ? o.grumeDiametre
      : (o.diameter !== undefined && o.diameter !== null && o.diameter !== '' ? o.diameter : null);
    if (brut === null) return null;
    return normalizeDiameter(brut);
  }

  /**
   * Couverture en diamètres des OF réalisées.
   * Sans elle, la prévision affiche un chiffre qui paraît calculé alors
   * qu'il repose sur un sous-ensemble : il faut le dire explicitement.
   */
  function diameterCoverage() {
    const orders = loadRealisedOrders();
    let avec = 0;
    orders.forEach(o => { if (diameterOf(o)) avec++; });
    return { total: orders.length, avec_diametre: avec, sans_diametre: orders.length - avec };
  }

  /**
   * Grumes disponibles par diamètre (cm).
   *
   * Source : `charben_raw`, seule collection portant des grumes (`diametre`,
   * `statut`). Les grumes EN_COURSE sont déjà affectées à une OF lancée et les
   * CONSOMMEES déjà débitées : les compter surestimerait le disponible et
   * masquerait les ruptures.
   *
   * Ne pas utiliser `charben_stock_items` ni `charben_stock` : ce sont des
   * pièces (Madrier, Planche, Chevron), sans diamètre de grume.
   */
  function getGrumesStockByDiameter(diametre) {
    const cible = String(normalizeDiameter(diametre));
    let count = 0;
    try {
      const grumes = JSON.parse(localStorage.getItem('charben_raw') || '[]');
      if (!Array.isArray(grumes)) return 0;
      grumes.forEach(g => {
        if (!g || String(g.statut || '').toUpperCase() !== 'EN_STOCK') return;
        if (g.diametre === undefined || g.diametre === null || g.diametre === '') return;
        if (String(normalizeDiameter(g.diametre)) === cible) count++;
      });
    } catch (e) { /* prédiction non bloquante */ }
    return count;
  }

  /**
   * Génére les alertes stock (pour le dashboard home)
   * @returns {Array<Object>} [{ severity, message }]
   */
  function checkStockAlerts() {
    const predictions = predictGrumesConsumption();
    const alerts = [];
    Object.keys(predictions).forEach(d => {
      const p = predictions[d];
      if (p.will_run_out) {
        alerts.push({
          severity: 'warning',
          key: 'stock_grume_' + d,
          message: '⚠️ Stock grumes ' + d + 'cm faible : ' + p.current_stock
            + ' restante(s) — besoin env. ' + p.need_for_2weeks + ' pour 2 semaines.'
        });
      }
    });
    // Les OF sans diamètre sont hors périmètre de la prévision : on le dit
    // plutôt que de les compter sous un diamètre inventé.
    const couv = diameterCoverage();
    if (couv.sans_diametre > 0) {
      alerts.unshift({
        severity: 'info',
        key: 'stock_grume_diametre_absent',
        message: 'ℹ️ Prévision par diamètre : ' + couv.sans_diametre + ' OF réalisée(s) sur '
          + couv.total + ' sans diamètre enregistré — non couvertes. '
          + 'Le diamètre est désormais relevé au lancement de la grume.'
      });
    }
    return alerts;
  }

  /**
   * Évolution sur 8 semaines (mini-histogramme consommé)
   */
  function weeklySeries() {
    const weeks = {};
    const now = Date.now();
    loadRealisedOrders().forEach(o => {
      const date = o.date ? new Date(String(o.date).split(' ').reverse().join('/')) : null;
      // date au format fr "DD/MM/YYYY HH:MM" → plus simple: utilse timestamp si dispo
      if (!o.timestamp) return;
      const ts = o.timestamp;
      const wk = Math.floor(((now - ts) / (7 * 24 * 3600 * 1000)));
      const w = Math.max(0, Math.min(7, wk));
      weeks[w] = (weeks[w] || 0) + (o.pieceCount || 1);
    });
    return weeks;
  }

  const api = {
    predictGrumesConsumption, checkStockAlerts, normalizeDiameter, weeklySeries,
    diameterOf, diameterCoverage
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (typeof window !== 'undefined') window.Prediction = api;
})();