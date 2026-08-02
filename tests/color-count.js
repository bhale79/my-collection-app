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

// Strip comments before counting. A comment explaining a color fix
// necessarily quotes colors — that has broken five separate assertions in
// this suite's history, so it is handled once, here.
function stripComments(src, isCss) {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, ' ');       // /* … */ (both langs)
  if (!isCss) {
    // Line comments, but NOT the "//" in a URL (https://…), which would
    // eat the rest of a real line of code.
    out = out.replace(/(^|[^:/])\/\/[^\n]*/g, '$1');
  }
  return out;
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

function countFile(absPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  const isCss = /\.css$/i.test(absPath);
  let body = stripComments(src, isCss);
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

module.exports = { countAll, countFile, targetFiles, stripComments };

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
