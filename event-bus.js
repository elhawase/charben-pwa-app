/**
 * EVENT-BUS.JS — Pub/Sub local + événements persistés (realtime UI)
 * Pattern inspiré de RabbitMQ + WebSocket (OpenWES), sans serveur.
 * Les écrans s'abonnent; quand le stock change, la UI se met à jour seule.
 * Date: 2026-09-11
 */

'use strict';

(function () {
  const EVENTS_KEY = 'charben_events';
  const MAX_EVENTS = 500;

  const _bus = new EventTarget();

  /**
   * Publie un événement (persisté + notifié)
   * @param {string} topic - ex: 'stock.changed' | 'of.created' | 'rule.updated'
   * @param {Object} payload
   */
  function publish(topic, payload) {
    // 1. Persister (audit, limité à MAX_EVENTS)
    try {
      const events = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
      events.push({ topic, payload: payload || {}, timestamp: Date.now() });
      localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
    } catch (e) { errLog('event-bus', 'persistance', e, 'warn'); }

    // 2. Notifier les abonnés
    _bus.dispatchEvent(new CustomEvent(topic, { detail: payload || {} }));
  }

  /**
   * S'abonne à un topic
   * @returns {Function} unsubscribe
   */
  function subscribe(topic, handler) {
    const listener = (e) => { try { handler(e.detail); } catch (err) { errLog('event-bus', topic, err, 'error'); } };
    _bus.addEventListener(topic, listener);
    return () => _bus.removeEventListener(topic, listener);
  }

  /**
   * Derniers événements persistés (pour debugging / dashboard)
   */
  function recentEvents(limit) {
    try {
      const events = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
      return events.slice(-(limit || 20)).reverse();
    } catch (e) { return []; }
  }

  // Topics standard (références stables pour le reste de l'app)
  const Topics = {
    STOCK_CHANGED: 'stock.changed',
    OF_CREATED: 'of.created',
    OF_COMPLETED: 'of.completed',
    DRYLOT_TRANSFERRED: 'drylot.transferred',
    QC_RESULT: 'qc.result',
    RULE_UPDATED: 'rule.updated',
    PLANNING_UPDATED: 'planning.updated'
  };

  const api = { publish, subscribe, recentEvents, Topics };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (typeof window !== 'undefined') window.EventBus = api;
})();