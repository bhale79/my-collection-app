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
  /#rrap,\s*#rrap-prevbar,\s*#rrap-mini\s*\{[\s\S]*?\n\s*\}/g,
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
