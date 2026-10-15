/**
 * CALC-UTILS.JS — Calculatrice scientifique, timer, conversions.
 * Copies EXACTES de app.js.
 */
'use strict';

window._calcUtils_escapeXml = function(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window._calcUtils_sciUpdateDisplay = function() {
  document.getElementById('calcExprLine').textContent = sciExpr || '\u00A0';
  document.getElementById('calcDisplay').textContent = sciExpr === '' ? '0' : sciExpr;
}

window._calcUtils_sciAppend = function(token) {
  sciExpr += token;
  sciUpdateDisplay();
}

window._calcUtils_sciClear = function() {
  sciExpr = '';
  sciUpdateDisplay();
}

window._calcUtils_sciBackspace = function() {
  sciExpr = sciExpr.slice(0, -1);
  sciUpdateDisplay();
}

window._calcUtils_sciToggleMode = function() {
  sciDegMode = !sciDegMode;
  document.getElementById('sciModeBtn').textContent = sciDegMode ? 'DEG' : 'RAD';
}

window._calcUtils_sciEvaluate = function(rawExpr, isDeg) {
  const s = rawExpr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/√/g, 'sqrt')
    .replace(/π/g, 'pi');
  let pos = 0;

  function skipSpaces() { while (s[pos] === ' ') pos++; }
  function peekChar() { skipSpaces(); return s[pos]; }
  function consume(ch) { skipSpaces(); if (s[pos] === ch) { pos++; return true; } return false; }

  function parseExpression() {
    let v = parseTerm();
    while (true) {
      skipSpaces();
      if (consume('+')) v += parseTerm();
      else if (peekChar() === '-') { pos++; v -= parseTerm(); }
      else break;
    }
    return v;
  }
  function parseTerm() {
    let v = parseFactor();
    while (true) {
      skipSpaces();
      if (consume('*')) v *= parseFactor();
      else if (consume('/')) {
        const d = parseFactor();
        if (d === 0) throw new Error('Division par zéro');
        v /= d;
      }
      else break;
    }
    return v;
  }
  function parseFactor() {
    let v = parseUnaryPostfix();
    skipSpaces();
    if (consume('^')) v = Math.pow(v, parseFactor()); // right-associatif
    return v;
  }
  function parseUnaryPostfix() {
    let v = parseUnary();
    while (peekChar() === '%') { pos++; v = v / 100; }
    return v;
  }
  function parseUnary() {
    skipSpaces();
    if (peekChar() === '-') { pos++; return -parseUnary(); }
    if (peekChar() === '+') { pos++; return parseUnary(); }
    return parsePrimary();
  }
  function parsePrimary() {
    skipSpaces();
    if (consume('(')) {
      const v = parseExpression();
      skipSpaces();
      if (!consume(')')) throw new Error('Parenthèse manquante');
      return v;
    }
    const idMatch = /^[a-zA-Z]+/.exec(s.slice(pos));
    if (idMatch) {
      const name = idMatch[0];
      pos += name.length;
      if (name === 'pi') return Math.PI;
      if (name === 'e') return Math.E;
      skipSpaces();
      if (!consume('(')) throw new Error(`Fonction ${name} : parenthèse attendue`);
      const arg = parseExpression();
      skipSpaces();
      if (!consume(')')) throw new Error('Parenthèse manquante');
      const toRad = a => isDeg ? a * Math.PI / 180 : a;
      switch (name) {
        case 'sin': return Math.sin(toRad(arg));
        case 'cos': return Math.cos(toRad(arg));
        case 'tan': return Math.tan(toRad(arg));
        case 'log': return Math.log10(arg);
        case 'ln': return Math.log(arg);
        case 'sqrt':
          if (arg < 0) throw new Error('√ de négatif');
          return Math.sqrt(arg);
        default: throw new Error(`Fonction inconnue : ${name}`);
      }
    }
    const numMatch = /^[0-9]*\.?[0-9]+/.exec(s.slice(pos));
    if (numMatch) { pos += numMatch[0].length; return parseFloat(numMatch[0]); }
    throw new Error('Expression invalide');
  }

  if (s.trim() === '') throw new Error('Expression vide');
  const result = parseExpression();
  skipSpaces();
  if (pos < s.length) throw new Error(`Caractère inattendu : "${s[pos]}"`);
  if (!isFinite(result)) throw new Error('Résultat non valide');
  return result;
}

window._calcUtils_sciEquals = function() {
  try {
    const result = sciEvaluate(sciExpr, sciDegMode);
    document.getElementById('calcExprLine').textContent = sciExpr + ' =';
    let formatted = Math.abs(result) < 1e-9 ? '0' : result.toPrecision(10);
    if (formatted.includes('.')) formatted = formatted.replace(/\.?0+$/, '');
    if (formatted.includes('e')) formatted = String(result);
    sciExpr = formatted;
    document.getElementById('calcDisplay').textContent = formatted;
    } catch (err) {
      errLog('calc-utils', 'evaluate', err, 'warn');
      document.getElementById('calcDisplay').textContent = 'Erreur';
    document.getElementById('calcExprLine').textContent = err.message || 'Expression invalide';
    sciExpr = '';
  }
}

window._calcUtils_convertMmToInch = function() {
  const mm = parseFloat(document.getElementById('convMm').value);
  if (!isNaN(mm)) document.getElementById('convInch').value = (mm / 25.4).toFixed(4);
}

window._calcUtils_convertInchToMm = function() {
  const inch = parseFloat(document.getElementById('convInch').value);
  if (!isNaN(inch)) document.getElementById('convMm').value = (inch * 25.4).toFixed(2);
}

window._calcUtils_formatTimer = function(ms) {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const tenths = Math.floor((ms % 1000) / 100);
  return `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${tenths}`;
}

window._calcUtils_timerToggle = function() {
  const btn = document.getElementById('timerStartBtn');
  if (!timerRunning) {
    timerRunning = true;
    timerStartTs = Date.now() - timerElapsed;
    timerInterval = setInterval(() => {
      timerElapsed = Date.now() - timerStartTs;
      document.getElementById('timerDisplay').textContent = formatTimer(timerElapsed);
    }, 100);
    btn.textContent = '⏸️ Pause';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-secondary');
  } else {
    timerRunning = false;
    clearInterval(timerInterval);
    btn.textContent = '▶️ Reprendre';
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-success');
  }
}

window._calcUtils_timerReset = function() {
  timerRunning = false;
  clearInterval(timerInterval);
  timerElapsed = 0;
  timerLapCount = 0;
  document.getElementById('timerDisplay').textContent = '00:00.0';
  document.getElementById('timerLaps').innerHTML = '';
  const btn = document.getElementById('timerStartBtn');
  btn.textContent = '▶️ Démarrer';
  btn.classList.remove('btn-secondary');
  btn.classList.add('btn-success');
}

window._calcUtils_timerLap = function() {
  timerLapCount++;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--border-color);';
  row.innerHTML = `<span>Coupe ${timerLapCount}</span><span>${formatTimer(timerElapsed)}</span>`;
  document.getElementById('timerLaps').prepend(row);
}

/* --- EXPORT GLOBAL --- */

window.calcUtils = {
  escapeXml: window._calcUtils_escapeXml,
  sciUpdateDisplay: window._calcUtils_sciUpdateDisplay,
  sciAppend: window._calcUtils_sciAppend,
  sciClear: window._calcUtils_sciClear,
  sciBackspace: window._calcUtils_sciBackspace,
  sciToggleMode: window._calcUtils_sciToggleMode,
  sciEvaluate: window._calcUtils_sciEvaluate,
  sciEquals: window._calcUtils_sciEquals,
  convertMmToInch: window._calcUtils_convertMmToInch,
  convertInchToMm: window._calcUtils_convertInchToMm,
  formatTimer: window._calcUtils_formatTimer,
  timerToggle: window._calcUtils_timerToggle,
  timerReset: window._calcUtils_timerReset,
  timerLap: window._calcUtils_timerLap
};
