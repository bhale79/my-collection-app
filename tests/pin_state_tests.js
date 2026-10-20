#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE PHOTO INBOX'S SHARED STATE LIVES ON ONE OBJECT — split step 2 (2026-10-20)
//
// Brad: "lets plan the photo inbox split" → "start 1" → "yes" (step 2).
// PLAN_2026-10-20_PHOTO_INBOX_SPLIT.md: measured with a parser, 19 values in
// app/photo-inbox.js are CHANGED by more than one part of the file. Once the
// file is in pieces, a plain variable in one piece cannot be changed from
// another — so those 19 live on ONE object, PIN (window._pinShared), created
// once by the first piece. Done by a parser rename, word for word: undoing it
// gives back the old file byte for byte (checked when it was made).
//
//   S1  the shared values are the ones first set at the top of the Photo
//       Inbox as "PIN._name = …" — read from the code, never typed here
//   S2  none of them is used bare (as a plain variable) anywhere in the
//       Photo Inbox — every use goes through PIN
//   S3  PIN is made ONCE (var PIN = window._pinShared = {}) in the first piece
//   S4  each shared value has ONE first setting at the top level, where its
//       comment is
//   R   in real Chromium: after the app loads, window._pinShared holds every
//       shared value with its starting value, and the Photo Inbox page opens
//       with no page errors
//   P   PLANTED: a bare use, a second PIN, a second first-setting, and the
//       old file (git bdf24031) are each caught
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const acorn = require('acorn');
const PINSRC = require('./lib/pin-source');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 700))); cond ? pass++ : fail++; }

// Every top-level statement of every piece's wrapper (the pieces are each one
// `(function () { … })();`).
function topStatements(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', locations: true });
  const out = [];
  ast.body.forEach(s => {
    if (s.type === 'ExpressionStatement' && s.expression.type === 'CallExpression' && /Function/.test(s.expression.callee.type)) {
      s.expression.callee.body.body.forEach(t => out.push(t));
    }
  });
  return { ast, top: out };
}
// "PIN._name = …" at the top level → the shared names, in order.
function sharedNames(src) {
  const names = [];
  topStatements(src).top.forEach(t => {
    if (t.type === 'ExpressionStatement' && t.expression.type === 'AssignmentExpression' && t.expression.operator === '='
        && t.expression.left.type === 'MemberExpression' && !t.expression.left.computed
        && t.expression.left.object.type === 'Identifier' && t.expression.left.object.name === 'PIN') {
      names.push(t.expression.left.property.name);
    }
  });
  return names;
}
// Every bare use of a shared name (an Identifier that is not PIN.<name>).
// The names a function declares for itself (parameters, its own var / let /
// const / function / catch names) — a local that happens to share a shared
// value's name (photo-inbox.js has `var _busy = _pinBtnBusy(...)`) is NOT a
// bare use of the shared value.
function localNames(fn) {
  const out = new Set();
  const pat = p => { if (!p) return; if (p.type === 'Identifier') out.add(p.name); else if (p.type === 'ObjectPattern') p.properties.forEach(q => pat(q.type === 'RestElement' ? q.argument : q.value)); else if (p.type === 'ArrayPattern') p.elements.forEach(pat); else if (p.type === 'AssignmentPattern') pat(p.left); else if (p.type === 'RestElement') pat(p.argument); };
  (fn.params || []).forEach(pat);
  (function w(n) { if (!n || typeof n.type !== 'string') return; if (n !== fn && /Function/.test(n.type)) return; if (n.type === 'VariableDeclarator') pat(n.id); if (n.type === 'FunctionDeclaration' && n !== fn) out.add(n.id.name); if (n.type === 'CatchClause' && n.param) pat(n.param); for (const k in n) { if (k === 'loc') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(w); else if (v && typeof v.type === 'string') w(v); } })(fn.body);
  return out;
}
// Every bare use of a shared name (an Identifier that is not PIN.<name> and
// is not a function's own local of the same name).
function bareUses(src, names) {
  const NS = new Set(names);
  const out = [];
  const { ast } = topStatements(src);
  (function walk(n, parent, key, shadow) {
    if (!n || typeof n.type !== 'string') return;
    let sh = shadow;
    const wrapper = /Function/.test(n.type) && parent && parent.type === 'CallExpression' && key === 'callee';   // a piece's own wrapper
    if (/Function/.test(n.type) && !wrapper) { sh = new Set(shadow); localNames(n).forEach(x => { if (NS.has(x)) sh.add(x); }); }
    if (n.type === 'Identifier' && NS.has(n.name) && !sh.has(n.name)) {
      const asProp = parent && parent.type === 'MemberExpression' && key === 'property' && !parent.computed;
      const asKey = parent && parent.type === 'Property' && key === 'key' && !parent.computed && !parent.shorthand;
      if (!asProp && !asKey) out.push(n.name + ' @' + n.loc.start.line);
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(c => walk(c, n, k, sh));
      else if (v && typeof v.type === 'string') walk(v, n, k, sh);
    }
  })(ast, null, null, new Set());
  return out;
}
function pinMade(src) { return (src.match(/var PIN = window\._pinShared = \{\};/g) || []).length; }
function firstSettings(src, names) {
  const count = {};
  topStatements(src).top.forEach(t => {
    if (t.type === 'ExpressionStatement' && t.expression.type === 'AssignmentExpression'
        && t.expression.left.type === 'MemberExpression' && t.expression.left.object && t.expression.left.object.name === 'PIN') {
      const k = t.expression.left.property.name; count[k] = (count[k] || 0) + 1;
    }
  });
  return names.filter(n => count[n] !== 1).map(n => n + ' ×' + (count[n] || 0));
}

const SRC = PINSRC.pinSource();
const NAMES = sharedNames(SRC);
T('S1 the shared values are read from the code: all 19 measured for the split, first set as PIN._name at the top', NAMES.length >= 19, NAMES);
T('S1 …including the ones the review card, the grid and the reader all change', ['_groups', '_sel', '_rvKey', '_rvAiRec', '_pinOneShot', '_idAbort'].every(n => NAMES.indexOf(n) !== -1), NAMES);
const bare = bareUses(SRC, NAMES);
T('S2 not one is used bare anywhere in the Photo Inbox — every use goes through PIN', bare.length === 0, bare.slice(0, 10));
T('S3 PIN is made once, in the first piece', pinMade(SRC) === 1 && pinMade(PINSRC.pinPieces()[PINSRC.pinPieceNames()[0]]) === 1, pinMade(SRC));
const fs4 = firstSettings(SRC, NAMES);
T('S4 each shared value has exactly ONE first setting at the top level', fs4.length === 0, fs4);

// ── P · planted ────────────────────────────────────────────────────────────
let OLD = null;
try { OLD = cp.execSync('git show bdf24031:app/photo-inbox.js', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) {}
if (!OLD) T('P0 the step-1 Photo Inbox could be read from git (bdf24031)', false, 'git show failed');
else {
  const oldBare = bareUses(OLD, NAMES);
  T('P1 PLANTED: the old file (plain variables) is caught — hundreds of bare uses', oldBare.length > 250, oldBare.length);
}
const anchor = 'function _selGroups() {';
T('P2 the plant anchor exists', SRC.indexOf(anchor) !== -1, anchor);
const p2 = SRC.replace(anchor, anchor + ' _sel = {};');
T('P2 PLANTED: one bare "_sel = {}" inside a function is caught', bareUses(p2, NAMES).length === 1, bareUses(p2, NAMES));
const p2b = SRC.replace(anchor, anchor + ' var _busy = 1; _busy++;');
T('P2b a function\'s OWN local named like a shared value is not a bare use', bareUses(p2b, NAMES).length === 0, bareUses(p2b, NAMES));
const p3 = SRC.replace('var PIN = window._pinShared = {};', 'var PIN = window._pinShared = {};\n  var PIN = window._pinShared = {};');
T('P3 PLANTED: a second PIN is caught', pinMade(p3) === 2, pinMade(p3));
const p4 = SRC.replace("  PIN._rvAiMfr = '';", "  PIN._rvAiMfr = '';\n  PIN._rvAiMfr = 'x';");
T('P4 PLANTED: a second first-setting is caught', firstSettings(p4, NAMES).join() === '_rvAiMfr ×2', firstSettings(p4, NAMES));

// ── R · the real app in Chromium ───────────────────────────────────────────
(async () => {
  let chromium;
  try { chromium = require('playwright').chromium; }
  catch (e) { T('R0 playwright is installed (the real-app checks need it)', false, 'missing'); return done(); }
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  const st = await pg.evaluate((names) => {
    const S = window._pinShared;
    if (!S) return null;
    const out = {};
    names.forEach(n => { out[n] = (n in S) ? (Array.isArray(S[n]) ? 'array' : (S[n] === null ? 'null' : typeof S[n])) : 'MISSING'; });
    return out;
  }, NAMES);
  T('R1 after the app loads, window._pinShared holds every shared value', st && NAMES.every(n => st[n] !== 'MISSING'), st);
  T('R2 …with its starting value (groups a list, the selection a map, the card key empty text)',
    st && st._groups === 'array' && st._sel === 'object' && st._rvKey === 'string' && st._rvAiRec === 'null' && st._idAbort === 'boolean', st);
  const opened = await pg.evaluate(async () => {
    try { _aiUsageMarkSeen(); } catch (e) {}
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
    try { window._pinGo(); } catch (e) { return 'threw: ' + e.message; }
    await new Promise(r => setTimeout(r, 600));
    const p = document.getElementById('page-photo-inbox');
    return p ? (p.classList.contains('active') ? 'open' : 'not active') : 'no page';
  });
  T('R3 the Photo Inbox page opens', opened === 'open', opened);
  T('R4 …with no page errors', errs.length === 0, errs);
  await browser.close();
  done();
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });

function done() {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
