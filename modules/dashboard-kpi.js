/* ============================================================
   DASHBOARD KPIs v7.0 — sparklines + alerts + tasks + OF chart
   Extrait de app.js — Phase 2A découpage
   Charge APRÈS app.js (utilise orders, planningTasks, escapeHtml…)
   ============================================================ */

function generateSparkline(data, color) {
  if (!data || data.length < 2) return '';
  var max = Math.max.apply(null, data);
  var min = Math.min.apply(null, data);
  var range = max - min || 1;
  var w = 120, h = 32;
  var points = data.map(function(v, i) {
    var x = (i / (data.length - 1)) * w;
    var y = h - ((v - min) / range) * (h - 4) - 2;
    return x + ',' + y;
  }).join(' ');
  var areaPoints = points + ' ' + w + ',' + h + ' 0,' + h;
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="kpi-sparkline" preserveAspectRatio="none">'
    + '<polygon points="' + areaPoints + '" fill="' + color + '" opacity="0.15"/>'
    + '<polyline points="' + points + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</svg>';
}

function parseOrderDate(str) {
  if (!str) return null;
  var m = String(str).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[ T]?(\d{1,2})?:?(\d{1,2})?/);
  if (!m) return null;
  var d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0));
  return isNaN(d.getTime()) ? null : d;
}

function ofCountSince(daysAgo) {
  var cutoff = new Date(Date.now() - daysAgo * 86400000);
  return orders.filter(function(o) {
    var d = parseOrderDate(o.date);
    return d && d >= cutoff;
  }).length;
}

function ofAvgRendement() {
  if (orders.length === 0) return null;
  var productMm = 0, totalLog = 0;
  orders.forEach(function(o) {
    var lat = (o.laterals || []).reduce(function(s, l) { return s + (Number(l) || 0); }, 0);
    productMm += 2 * ((Number(o.central) || 0) + lat);
    totalLog += Number(o.logWidth) || 0;
  });
  if (totalLog === 0) return null;
  return Math.round((productMm / totalLog) * 1000) / 10;
}

function ofChartData() {
  var days = [], out = [];
  for (var i = 29; i >= 0; i--) {
    var day = new Date(Date.now() - i * 86400000);
    var label = day.toLocaleDateString('fr-FR', { weekday: 'short' });
    var key = day.getFullYear() + '-' + (day.getMonth() + 1) + '-' + day.getDate();
    var count = orders.filter(function(o) {
      var d = parseOrderDate(o.date);
      return d && (d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()) === key;
    }).length;
    days.push(label);
    out.push(count);
  }
  return { labels: days, values: out };
}

function renderOfTrendChart() {
  var chart = ofChartData();
  var max = Math.max.apply(null, chart.values.concat([1]));
  var bw = 26, gap = 10, h = 90, padB = 16;
  var n = chart.values.length;
  var bars = chart.values.map(function(v, i) {
    var bh = (v / max) * (h - padB);
    var x = i * (bw + gap);
    var y = h - bh;
    var gradId = 'ofBar' + i;
    var showLab = (i % 5 === 0) || (i === n - 1);
    var label = showLab
      ? '<text x="' + (x + bw / 2) + '" y="' + (h - 5) + '" text-anchor="middle" font-size="8" fill="var(--text-muted)">' + chart.labels[i] + '</text>'
      : '';
    return '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="var(--brand-green)" stop-opacity="1"/>'
      + '<stop offset="100%" stop-color="var(--brand-green)" stop-opacity="0.25"/>'
      + '</linearGradient></defs>'
      + '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + bh + '" rx="5" fill="url(#' + gradId + ')" style="filter:drop-shadow(0 0 4px var(--v9-glow-1));"><title>' + v + ' OF</title></rect>'
      + label;
  }).join('');
  var w = chart.values.length * (bw + gap) - gap;
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="of-chart-svg" preserveAspectRatio="none" style="width:100%;height:90px;">' + bars + '</svg>';
}

function kdTrProductionOfs() {
  if (typeof orders !== 'undefined' && orders.length) {
    return orders.filter(function(o) { return o.status && o.status !== 'draft'; });
  }
  if (typeof productionPlan !== 'undefined' && productionPlan.length) {
    return productionPlan.filter(function(p) { return p.status; });
  }
  return [];
}

function kdTaskLineBadge(assign) {
  if (/ligne\s*b/i.test(assign || '')) return '<span class="kd-tr-badge kd-tr-b-line">B</span>';
  if (/ligne\s*a/i.test(assign || '')) return '<span class="kd-tr-badge kd-tr-b-line">A</span>';
  return '';
}

function kdTaskPriorityBadge(pri) {
  var p = (pri || '').toLowerCase();
  if (p.indexOf('urg') > -1) return '<span class="kd-tr-badge kd-tr-b-pri-urg">Urgente</span>';
  if (p.indexOf('haut') > -1) return '<span class="kd-tr-badge kd-tr-b-pri-haut">Priorité haute</span>';
  if (p.indexOf('moy') > -1) return '<span class="kd-tr-badge kd-tr-b-pri-moy">Priorité moyenne</span>';
  return '<span class="kd-tr-badge kd-tr-b-time">Normale</span>';
}

function renderUpcomingTasks() {
  var now = new Date();
  var today = now.toISOString().slice(0, 10);
  var tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  var nowTime = now.toTimeString().slice(0, 5);
  var tasks = planningTasks.filter(function(t) {
    if (t.status === 'done') return false;
    if (!t.date) return true;
    if (kdTaskFilter === 'today') return t.date === today;
    if (kdTaskFilter === 'tomorrow') return t.date === tomorrow;
    if (kdTaskFilter === 'doing') return t.status === 'doing' || t.status === 'en_cours';
    if (t.date < today) return true;
    if (t.date === today) return !t.time || t.time >= nowTime;
    return true;
  }).sort(function(a, b) {
    return (a.date + ' ' + (a.time || '')).localeCompare(b.date + ' ' + (b.time || ''));
  }).slice(0, 8);
  var html = '';
  html += '<div class="kd-tr-chips">';
  [['toutes','Toutes'],['today','Aujourd\'hui'],['tomorrow','Demain'],['doing','En cours']].forEach(function(c) {
    var on = kdTaskFilter === c[0] ? ' kd-tr-chip-on' : '';
    html += '<span class="kd-tr-chip' + on + '" onclick="kdSetTaskFilter(\'' + c[0] + '\')">' + c[1] + '</span>';
  });
  html += '</div>';
  var groups = {};
  tasks.forEach(function(t) {
    var k = t.date === today ? 'aujourdhui' : (t.date === tomorrow ? 'demain' : (t.date < today ? 'retard' : (t.date || 'autre')));
    if (!groups[k]) groups[k] = [];
    groups[k].push(t);
  });
  var orderKeys = [];
  if (groups['retard']) orderKeys.push('retard');
  if (groups['aujourdhui']) orderKeys.push('aujourdhui');
  if (groups['demain']) orderKeys.push('demain');
  Object.keys(groups).sort().forEach(function(k) { if (orderKeys.indexOf(k) === -1) orderKeys.push(k); });
  if (tasks.length === 0) {
    html += '<div class="kd-tr-empty">Aucune tâche à venir</div>';
  } else {
    orderKeys.forEach(function(k) {
      if (!groups[k] || !groups[k].length) return;
      var lab = k === 'aujourdhui' ? 'Aujourd\'hui' : (k === 'demain' ? 'Demain' : (k === 'retard' ? 'En retard' : k));
      html += '<div class="kd-tr-day">' + lab + ' <span>' + groups[k].length + ' tâche' + (groups[k].length > 1 ? 's' : '') + '</span></div>';
      groups[k].forEach(function(t) {
        var stateBadge = t.status === 'doing' || t.status === 'en_cours' ? '<span class="kd-tr-badge kd-tr-b-state">en cours</span>' : (t.status === 'done' ? '<span class="kd-tr-badge kd-tr-b-state kd-tr-b-done">fait</span>' : '');
        html += '<div class="kd-tr-task">';
        html += '<div class="kd-tr-task-top"><div><div class="kd-tr-task-title">' + escapeHtml(t.title) + '</div>';
        html += '<div class="kd-tr-task-sub">' + (t.notes ? escapeHtml(t.notes) : '') + '</div></div>';
        html += '<div>' + stateBadge + '</div></div>';
        html += '<div class="kd-tr-task-badges">';
        if (t.date) html += '<span class="kd-tr-badge kd-tr-b-date">' + escapeHtml(t.date) + '</span>';
        if (t.time) html += '<span class="kd-tr-badge kd-tr-b-time">' + escapeHtml(t.time) + '</span>';
        html += kdTaskPriorityBadge(t.priority);
        html += kdTaskLineBadge(t.assign);
        html += '</div></div>';
      });
    });
  }
  html += '<div class="kd-tr-sec-lab"><em></em> Réalisation — OF du plan de production</div>';
  var ofs = kdTrProductionOfs()
    .sort(function(a, b) { return String(a.date || a.actualStart || a.createdAt || '').localeCompare(String(b.date || b.actualStart || b.createdAt || '')); })
    .slice(0, 5);
  if (ofs.length === 0) {
    html += '<div class="kd-tr-empty">Aucun ordre de production</div>';
  } else {
    ofs.forEach(function(p) {
      var qty = Math.max(p.qty || 0, p.pieceCount || 0);
      var produced = Math.max(p.producedQty || 0, 0);
      if (!qty && p.status === 'realise') qty = produced || 1;
      var pct = qty > 0 ? Math.min(100, Math.round((produced / qty) * 100)) : 0;
      var cfg = (p.logWidth || '') ? p.logWidth + 'mm · ' + p.central + 'mm' + (p.laterals && p.laterals.length ? ' / ' + p.laterals.join(';') + 'mm' : '') : (p.reference || '');
      var statLab = p.status === 'realise' ? 'été scié' : (p.status === 'engage' ? 'en sciage' : 'planifié');
      html += '<div class="kd-tr-of">';
      html += '<div class="kd-tr-of-top"><div><div class="kd-tr-of-no">' + escapeHtml(p.orderNum || p.ofNum || 'OF à venir') + '</div><div class="kd-tr-of-client">' + escapeHtml(p.client || p.clientName || '') + (p.essence && GAMME_ESSENCES[p.essence] ? ' · ' + escapeHtml(GAMME_ESSENCES[p.essence].label) : '') + '</div></div>';
      html += '<div class="kd-tr-of-prog"><b>' + pct + '%</b><span>' + produced + ' / ' + (qty > 0 ? qty : '?') + ' pcs</span></div></div>';
      html += '<div class="kd-tr-of-mid"><span>' + escapeHtml(cfg) + '</span><span>' + statLab + '</span></div>';
      html += '<div class="kd-tr-of-bar"><i style="width:' + pct + '%;"></i></div>';
      html += '<div class="kd-tr-of-tags"><span class="kd-tr-badge kd-tr-b-line">Ligne ' + escapeHtml(p.line || 'A') + '</span>';
      if (p.date) html += '<span class="kd-tr-badge kd-tr-b-date">' + escapeHtml(p.date) + '</span>';
      html += '<span class="kd-tr-badge kd-tr-b-ess">' + (qty > 0 ? qty + ' pcs cible' : (p.status === 'draft' ? 'brouillon' : 'en production')) + '</span></div>';
      html += '</div>';
    });
  }
  return html;
}

function updateAlertBadge(count) {
  var badge = document.getElementById('alertBadge');
  if (!badge) return;
  if (count && count > 0) {
    badge.textContent = count;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}
