// ═══════════════════════════════════════════════════════════════
// color-count.js — THE counter behind the no-hardcoded-colors rule
// v0.9.1154 (Brad: "no color should be hardcoded.")
//
// ONE implementation, used by both the ratchet test and the budget
// regenerator, so the number that gates a push and the number written
// into the budget can never disagree. (If they could, the ratchet would
// be theatre.)
//
// What counts as a hardcoded color: a hex literal (#abc, #aabbcc, with
// or without alpha) or an rgb()/rgba() with numeric channels. What does
// NOT count: anything inside a comment, and — deliberately — the palette
// definitions themselves, because something has to hold the real value
// of "orange". Those live in app.css's theme scopes and are the source
// of truth the rest of the app is supposed to point at.
// ═══════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');

const COLOR_RE = /#[0-9a-f]{3,8}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/gi;

// ── Removing comments (v0.9.1293: a scanner, not a regex) ───────────
//
// A comment explaining a color fix necessarily quotes colors, so comments
// have to come out before counting. Until v0.9.1293 that was done with
// `src.replace(/\/\*[\s\S]*?\*\//g, ' ')` — and a regex CANNOT TELL CODE
// FROM A STRING. Nine files in this app contain `accept="image/*"`. The
// `/*` inside that string was read as the start of a comment; it paired
// with the next `*/` in the file, which in app-pages.js was 2,335 lines
// later inside a regex literal, and 146,363 characters were thrown away
// before counting. wizard.js reported 10 color literals and truly had 243
// — the gate was watching 4% of the file, and reporting "within budget".
//
// So this walks the source once, always knowing which of code / string /
// template / regex / line-comment / block-comment it is standing in.
// STRINGS ARE KEPT — most of this app's colors live in style strings, and
// those are exactly what the rule is about. Comments and regex literals
// are blanked.
//
// If a future check ever needs to read source, do it this way. Four
// separate defects in this project have been the same mistake.

function scanJs(src) {
  let out = '', i = 0;
  const n = src.length;
  // The last non-space character already emitted. Decides whether a '/'
  // opens a regex literal or is a division sign.
  const prevSig = function () {
    for (let k = out.length - 1; k >= 0; k--) {
      if (!/\s/.test(out[k])) return out[k];
    }
    return '';
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '*') {                       // block comment
      const e = src.indexOf('*/', i + 2);
      i = (e < 0 ? n : e + 2);
      out += ' ';
      continue;
    }
    if (c === '/' && d === '/') {                       // line comment
      while (i < n && src[i] !== '\n') i++;
      out += '\n';                                      // keep line structure
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {          // string / template — KEPT
      const q = c;
      out += c; i++;
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') { out += src[i]; i++; }
        out += src[i]; i++;
      }
      out += (src[i] || ''); i++;
      continue;
    }
    if (c === '/' && /[(,=:[!&|?{};+\-*%~^]|^$/.test(prevSig())) {
      // A '/' in a position where a value may start is a regex literal.
      let j = i + 1, inClass = false, closed = false;
      for (; j < n; j++) {
        const x = src[j];
        if (x === '\\') { j++; continue; }
        if (x === '[') inClass = true;
        else if (x === ']') inClass = false;
        else if (x === '/' && !inClass) { closed = true; break; }
        else if (x === '\n') break;                     // regexes do not span lines
      }
      if (closed) {
        out += ' ';
        i = j + 1;
        while (i < n && /[gimsuy]/.test(src[i])) i++;    // flags
        continue;
      }
    }
    out += c; i++;
  }
  return out;
}

// CSS has block comments only, and strings that may contain '/*'.
function scanCss(src) {
  let out = '', i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '*') {
      const e = src.indexOf('*/', i + 2);
      i = (e < 0 ? n : e + 2);
      out += ' ';
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      out += c; i++;
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') { out += src[i]; i++; }
        out += src[i]; i++;
      }
      out += (src[i] || ''); i++;
      continue;
    }
    out += c; i++;
  }
  return out;
}

// HTML's only comment syntax is <!-- -->. Its markup has no string
// literals — an apostrophe in prose is prose — so attributes are left
// exactly as written, which is where inline style colors live. Embedded
// <script> and <style> bodies are handed to the right scanner.
//
// Before v0.9.1293 index.html was run through the JS stripper, which
// meant <!-- --> comments were counted and '//' in markup could eat the
// rest of a line.
function scanHtml(src) {
  let out = '', i = 0;
  const n = src.length;
  const lower = src.toLowerCase();
  while (i < n) {
    if (lower.startsWith('<!--', i)) {
      const e = lower.indexOf('-->', i + 4);
      i = (e < 0 ? n : e + 3);
      out += ' ';
      continue;
    }
    let tag = null;
    if (lower.startsWith('<script', i)) tag = 'script';
    else if (lower.startsWith('<style', i)) tag = 'style';
    if (tag) {
      const open = src.indexOf('>', i);
      if (open < 0) { out += src[i]; i++; continue; }
      const close = lower.indexOf('</' + tag, open + 1);
      const bodyEnd = (close < 0 ? n : close);
      out += src.slice(i, open + 1);
      out += (tag === 'script' ? scanJs : scanCss)(src.slice(open + 1, bodyEnd));
      i = bodyEnd;
      continue;
    }
    out += src[i]; i++;
  }
  return out;
}

// Kept under its original name and its original call shape — the ratchet
// in the suite calls stripComments(src, false) for JavaScript. `kind` may
// be false/'js', true/'css', or 'html'.
function stripComments(src, kind) {
  if (kind === true || kind === 'css') return scanCss(src);
  if (kind === 'html') return scanHtml(src);
  return scanJs(src);
}

// The theme scopes in app.css. These blocks are the palette — their
// literals are the definition, not a violation. Everything else in the
// file is counted normally.
const PALETTE_SCOPES = [
  /:root\s*\{[\s\S]*?\n\s*\}/g,
  /html\[data-theme="light"\]\s*\{[\s\S]*?\n\s*\}/g,
  /html\[data-theme="high-contrast"\]\s*\{[\s\S]*?\n\s*\}/g,
  /html\[data-theme="high-contrast"\]\s+\.main\s*\{[\s\S]*?\n\s*\}/g,
  /\n\s*\.main\s*\{[\s\S]*?\n\s*\}/g,
  // v0.9.1206: the Appearance editor's paper. Same kind of block as .main —
  // a palette DEFINITION, the source of truth appearance.js points at. It is
  // exempt for the same reason .main is: something has to hold the real value
  // of "cream". appearance.js itself must stay literal-free, and §174 checks
  // that separately, so this exemption cannot become a hiding place.
  // Matched on the #rrap prefix rather than the exact selector list: that
  // list grew in v0.9.1221 (the floating panels had to join it), and a
  // regex naming every id would have silently stopped exempting the block
  // and blamed app.css for nine colours it always had.
  /#rrap[^{]*\{[\s\S]*?\n\s*\}/g,
];

function kindOf(absPath) {
  if (/\.css$/i.test(absPath)) return 'css';
  if (/\.html?$/i.test(absPath)) return 'html';
  return 'js';
}

function countFile(absPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  let body = stripComments(src, kindOf(absPath));
  if (path.basename(absPath) === 'app.css') {
    PALETTE_SCOPES.forEach(function (re) { body = body.replace(re, ' '); });
  }
  return (body.match(COLOR_RE) || []).length;
}

// Every file the rule applies to, in a stable order.
function targetFiles(appDir) {
  return fs.readdirSync(appDir)
    .filter(function (f) { return /\.(js|css|html)$/i.test(f); })
    .filter(function (f) { return !/^tests-/.test(f); })   // in-app test harnesses
    .sort();
}

function countAll(appDir) {
  const out = {};
  targetFiles(appDir).forEach(function (f) {
    const n = countFile(path.join(appDir, f));
    if (n > 0) out[f] = n;
  });
  return out;
}

module.exports = { countAll, countFile, targetFiles, stripComments, scanJs, scanCss, scanHtml, kindOf };

// ═══════════════════════════════════════════════════════════════
// Run it directly:  node tests/color-count.js
//
// v0.9.1257 (audit 2026-08-02). Until now this file was a module and
// NOTHING else — no main block, no output, no exit code. `node
// tests/color-count.js` has been a step in the deploy checklist since
// v0.9.1154 and it printed nothing and exited 0 every single time. The
// counter was always sound; it just had no way of being asked directly,
// so the step was theatre. A gate that cannot fail is not a gate.
//
// The real ratchet still runs inside photo-inbox-tests.js (§ colour),
// which requires the functions above. This block does not replace it —
// it makes the standalone command mean what the checklist claims it
// means, and it reads the SAME budget file, so the two can never give
// different answers.
// ═══════════════════════════════════════════════════════════════
if (require.main === module) {
  const appDir = path.join(__dirname, '..', 'app');

  let budgets;
  try {
    budgets = require('./color-budget.json').budgets;
  } catch (e) {
    console.log('FAILED  —  cannot read tests/color-budget.json: ' + (e && e.message));
    process.exit(1);
  }

  const counts = countAll(appDir);
  const problems = [];
  let total = 0;

  Object.keys(counts).sort().forEach(function (f) {
    const n = counts[f];
    total += n;
    const b = budgets[f];
    if (b === undefined) {
      // A tracked file with colours and no budget line is not "fine by
      // default" — it is untracked, which is how a file slips out of the
      // rule entirely. Treat it as a failure, not a shrug.
      problems.push('  ' + f + ': ' + n + ' literals, NO budget entry  ' +
                    '-> run node tests/update-color-budget.js');
      return;
    }
    if (n > b) {
      problems.push('  ' + f + ': ' + n + ' vs budget ' + b + '   (+' + (n - b) + ')');
    }
  });

  const budgetTotal = Object.keys(budgets).reduce(function (a, k) { return a + budgets[k]; }, 0);

  if (problems.length) {
    console.log('Hardcoded colours OVER BUDGET:\n' + problems.join('\n'));
    console.log('\nFAILED  —  ' + problems.length + ' file(s) over budget.  ' +
                'Point the new colour at a CSS custom property instead of a literal.');
    process.exit(1);
  }

  console.log('ALL PASS  —  hardcoded colours within budget: ' +
              total + ' of ' + budgetTotal +
              ' across ' + Object.keys(counts).length + ' files.');
  process.exit(0);
}
