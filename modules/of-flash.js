/**
 * OF-FLASH.JS — Notifications flash pro sur l'écran KPI.
 * Style "brique pro" : info → flash → disparu.
 * Apparaît au chargement du dashboard, s'efface après quelques secondes.
 * Focus : objectifs, réglages machines, alertes critiques.
 */
'use strict';

/* ─────────────────────────────────────────────
   État interne
   ───────────────────────────────────────────── */
window._ofFlash_state = {
  queue: [],
  active: false,
  timer: null
};

/* ─────────────────────────────────────────────
   Générer les messages flash à partir des données
   ───────────────────────────────────────────── */
window._ofFlash_buildMessages = function() {
  var msgs = [];
  var now = new Date();
  var monthNames = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  var today = monthNames[now.getMonth()] + ' ' + now.getDate();

  /* ── 1. Objectif mensuel — progress compacte ── */
  if (typeof ofObjectives !== 'undefined') {
    var m = ofObjectives.monthlyProgress();
    if (m.totalObj > 0) {
      var col = m.totalPct >= 100 ? 'success' : (m.totalPct >= m.expectedPct ? 'warning' : 'danger');
      var icon = m.totalPct >= 100 ? 'check-circle' : (m.totalPct >= m.expectedPct ? 'bar-chart' : 'alert-triangle');
      var line = 'Objectif ' + today + ' : <b>' + m.totalPct + '%</b> (' + m.totalProd.toFixed(1) + '/' + m.totalObj + ' m³)';
      if (m.behind && m.gap > 0 && m.daysLeft > 0) {
        line += ' · <span style="color:#ef4444;font-weight:700;">Écart ' + m.behindPct + '%</span> — _' + (m.gap / m.daysLeft).toFixed(0) + ' m³/j';
      }
      msgs.push({ icon: icon, type: col, text: line, priority: m.behindPct > 20 ? 3 : 1 });
    }
  }

  /* ── 2. Règlages machines — OF à venir ── */
  if (typeof productionPlan !== 'undefined') {
    var tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    var fmt = function(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
    var tomorrowKey = fmt(tomorrow);

    ['A', 'B'].forEach(function(line) {
      var currentOf = null;
      if (typeof getLineOrder === 'function') currentOf = getLineOrder(line);
      for (var i = 0; i < productionPlan.length; i++) {
        var p = productionPlan[i];
        if (dashboardRenderer.ofLine(p) !== line || p.date !== tomorrowKey) continue;
        var changes = [];
        if (currentOf) {
          if (p.essence && currentOf.essence && p.essence !== currentOf.essence) {
            changes.push('Essence: ' + ((GAMME_ESSENCES[currentOf.essence]||{}).label||'?') + ' → ' + ((GAMME_ESSENCES[p.essence]||{}).label||'?'));
          }
          if (p.logWidth && currentOf.logWidth && Math.abs(p.logWidth - currentOf.logWidth) > 20) {
            changes.push('Grume ' + currentOf.logWidth + '→' + p.logWidth + 'mm');
          }
          if (p.central && currentOf.central && p.central !== currentOf.central) {
            changes.push('CC ' + currentOf.central + '→' + p.central + 'mm');
          }
        }
        if (changes.length > 0) {
          msgs.push({ icon: 'settings', type: 'info', text: 'Réglages L' + line + ' demain · ' + changes.join(' · '), priority: 2 });
        }
      }
    });
  }

  /* ── 3. OF avec changement d'essence ── */
  if (typeof orders !== 'undefined' && typeof productionPlan !== 'undefined') {
    for (var j = 0; j < productionPlan.length; j++) {
      var pp = productionPlan[j];
      if (pp.status === 'planifie' && pp.essence) {
        var current = null;
        if (typeof getLineOrder === 'function') current = getLineOrder(dashboardRenderer.ofLine(pp));
        if (current && current.essence && pp.essence !== current.essence) {
          var oldL = (GAMME_ESSENCES[current.essence]||{}).label || current.essence;
          var newL = (GAMME_ESSENCES[pp.essence]||{}).label || pp.essence;
          msgs.push({ icon: 'tree-pine', type: 'warning', text: 'Changement essence · ' + oldL + ' → ' + newL + ' (L' + dashboardRenderer.ofLine(pp) + ')', priority: 2 });
        }
      }
    }
  }

  /* ── 4. OF avec largeur grume différente ── */
  if (typeof productionPlan !== 'undefined') {
    for (var k = 0; k < productionPlan.length; k++) {
      var pp2 = productionPlan[k];
      if (pp2.status === 'planifie' && pp2.logWidth) {
        var cur = null;
        if (typeof getLineOrder === 'function') cur = getLineOrder(dashboardRenderer.ofLine(pp2));
        if (cur && cur.logWidth && Math.abs(pp2.logWidth - cur.logWidth) > 40) {
          msgs.push({ icon: 'ruler', type: 'info', text: 'Grume ' + cur.logWidth + '→' + pp2.logWidth + 'mm · L' + dashboardRenderer.ofLine(pp2) + ' — vérifier cales', priority: 1 });
        }
      }
    }
  }

  /* Trier par priorité (3=haute en premier) */
  msgs.sort(function(a, b) { return (b.priority || 0) - (a.priority || 0); });
  return msgs.slice(0, 4); /* Max 4 messages flash */
};

/* ─────────────────────────────────────────────
   Rendu du flash (container + animation)
   ───────────────────────────────────────────── */
window._ofFlash_render = function(container) {
  var msgs = window._ofFlash_buildMessages();
  if (msgs.length === 0) { container.style.display = 'none'; return; }

  var typeColors = {
    success: { bg: 'rgba(5,150,105,.12)', border: '#059669', text: '#059669' },
    warning: { bg: 'rgba(245,158,11,.12)', border: '#f59e0b', text: '#d97706' },
    danger:  { bg: 'rgba(239,68,68,.12)', border: '#ef4444', text: '#dc2626' },
    info:    { bg: 'rgba(59,130,246,.12)', border: '#3b82f6', text: '#2563eb' }
  };

  var html = '';
  for (var i = 0; i < msgs.length; i++) {
    var msg = msgs[i];
    var c = typeColors[msg.type] || typeColors.info;
    var delay = i * 0.15; /* cascade */
    html += '<div class="of-flash-item" style="';
    html += 'display:flex;align-items:center;gap:10px;';
    html += 'padding:10px 14px;';
    html += 'background:' + c.bg + ';';
    html += 'border-left:3px solid ' + c.border + ';';
    html += 'border-radius:0 8px 8px 0;';
    html += 'margin-bottom:6px;';
    html += 'animation:flashSlideIn 0.4s ease-out ' + delay + 's both, flashFadeOut 0.6s ease-in 5s ' + delay + 's forwards;';
    html += 'font-size:12px;line-height:1.5;';
    html += 'cursor:pointer;';
    html += '" onclick="this.style.animation=\'flashSlideOut 0.4s ease-in forwards\';setTimeout(function(){this.remove();}.bind(this),400);">';
    html += '<span style="flex-shrink:0;">' + (typeof ofIcons !== 'undefined' ? ofIcons.lucide(msg.icon, 16, c.text) : msg.icon) + '</span>';
    html += '<span style="flex:1;color:var(--text-primary);">' + msg.text + '</span>';
    html += '<span style="font-size:10px;color:' + c.text + ';font-weight:600;flex-shrink:0;">' + flashTimeNow() + '</span>';
    html += '</div>';
  }

  container.innerHTML = html;
  container.style.display = 'block';

  /* Auto-nettoyage après 7 secondes */
  setTimeout(function() {
    var items = container.querySelectorAll('.of-flash-item');
    for (var j = 0; j < items.length; j++) {
      items[j].style.animation = 'flashSlideOut 0.5s ease-in forwards';
    }
    setTimeout(function() { container.style.display = 'none'; container.innerHTML = ''; }, 600);
  }, 7000);
};

/* ─────────────────────────────────────────────
   Heure compacte
   ───────────────────────────────────────────── */
function flashTimeNow() {
  var d = new Date();
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

/* ─────────────────────────────────────────────
   Injection CSS des animations (une seule fois)
   ───────────────────────────────────────────── */
window._ofFlash_injectCSS = function() {
  if (document.getElementById('ofFlashCSS')) return;
  var css = document.createElement('style');
  css.id = 'ofFlashCSS';
  css.textContent = `
    @keyframes flashSlideIn {
      from { opacity: 0; transform: translateX(20px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes flashFadeOut {
      from { opacity: 1; }
      to   { opacity: 0; transform: translateY(-4px); }
    }
    @keyframes flashSlideOut {
      from { opacity: 1; transform: translateX(0); max-height: 80px; margin-bottom: 6px; }
      to   { opacity: 0; transform: translateX(30px); max-height: 0; margin-bottom: 0; padding: 0 14px; }
    }
    .of-flash-item:hover { filter: brightness(0.95); }
  `;
  document.head.appendChild(css);
};

/* ─────────────────────────────────────────────
   Lancer le flash sur l'écran dashboard
   ───────────────────────────────────────────── */
window._ofFlash_launch = function() {
  window._ofFlash_injectCSS();
  /* Créer le container flash au-dessus des KPIs */
  var el = document.getElementById('dashboardKPIs');
  if (!el) return;
  var flashContainer = document.getElementById('ofFlashContainer');
  if (!flashContainer) {
    flashContainer = document.createElement('div');
    flashContainer.id = 'ofFlashContainer';
    flashContainer.style.cssText = 'margin-bottom:12px;';
    el.parentNode.insertBefore(flashContainer, el);
  }
  window._ofFlash_render(flashContainer);
};

/* ─────────────────────────────────────────────
   Export global
   ───────────────────────────────────────────── */
window.ofFlash = {
  launch: window._ofFlash_launch,
  render: window._ofFlash_render,
  buildMessages: window._ofFlash_buildMessages,
  injectCSS: window._ofFlash_injectCSS
};