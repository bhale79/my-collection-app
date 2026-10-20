#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE PHOTO INBOX'S PIECES MEET ONLY THROUGH THE HAND-OVER — split step 3+
//
// Brad: "lets plan the photo inbox split" → "start 1" → "yes" → "now".
// PLAN_2026-10-20_PHOTO_INBOX_SPLIT.md. From step 3 the Photo Inbox is several
// files (photo-inbox.js first, then photo-inbox-*.js). Each is its own
// wrapper; a function one piece calls in another is handed over on ONE object,
// PINF (window._pinFns): the piece that has it hands it over at its end
// (Object.assign(PINF, { name: name })), the piece that calls it names it at
// its top (var name = PINF.from('name')).
//
//   H1  every piece is one wrapper; the first makes PINF once, the others take it
//   H2  every name taken is handed over by exactly ONE piece, which defines it
//   H3  nothing is handed over that no piece takes
//   H4  a stand-in's text matches its name, and no piece both takes and defines a name
//   H5  THE ONE THAT MATTERS: no piece uses something another piece defines
//       without taking it (a parser follows every name, minding local ones)
//   R   in real Chromium: every piece loads, every handed-over name is a
//       function on window._pinFns, and a call across the boundary works
//       both ways
//   P   PLANTED: a stand-in with no hand-over, a hand-over nobody takes, and
//       a piece using another's function without taking it — each caught
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const PIN = require('./lib/pin-source');

const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 700))); cond ? pass++ : fail++; }

function wrapperBody(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', locations: true });
  const w = ast.body.filter(s => s.type === 'ExpressionStatement' && s.expression.type === 'CallExpression' && /Function/.test(s.expression.callee.type));
  return { ast, wrappers: w.length, body: w.length ? w[0].expression.callee.body.body : [] };
}
// What a piece defines at its top, takes (stand-ins) and hands over.
function shape(src) {
  const { ast, wrappers, body } = wrapperBody(src);
  const defines = new Set(), takes = {}, valueTakes = {}, gives = [], fnDefs = new Set(), varAt = {};
  body.forEach((t, i) => {
    if (t.type === 'FunctionDeclaration') { defines.add(t.id.name); fnDefs.add(t.id.name); }
    else if (t.type === 'VariableDeclaration') t.declarations.forEach(d => {
      if (d.id.type !== 'Identifier') return;
      const init = d.init;
      const isTake = init && init.type === 'CallExpression' && init.callee.type === 'MemberExpression'
        && init.callee.object.name === 'PINF' && init.callee.property.name === 'from';
      const isValueTake = init && init.type === 'MemberExpression' && !init.computed && init.object.name === 'PINF';
      if (isTake) takes[d.id.name] = init.arguments[0] && init.arguments[0].value;
      else if (isValueTake) valueTakes[d.id.name] = init.property.name;
      else { defines.add(d.id.name); varAt[d.id.name] = i; }
    });
    else if (t.type === 'ExpressionStatement' && t.expression.type === 'CallExpression'
      && t.expression.callee.type === 'MemberExpression' && t.expression.callee.object.name === 'Object'
      && t.expression.callee.property.name === 'assign' && t.expression.arguments[0] && t.expression.arguments[0].name === 'PINF') {
      t.expression.arguments[1].properties.forEach(p => gives.push({ key: p.key.name, value: p.value.name, at: i }));
    }
  });
  return { ast, wrappers, defines, takes, valueTakes, gives, fnDefs, varAt };
}
function innerNames(fn) {
  const out = new Set();
  const pat = p => { if (!p) return; if (p.type === 'Identifier') out.add(p.name); else if (p.type === 'ObjectPattern') p.properties.forEach(q => pat(q.type === 'RestElement' ? q.argument : q.value)); else if (p.type === 'ArrayPattern') p.elements.forEach(pat); else if (p.type === 'AssignmentPattern') pat(p.left); else if (p.type === 'RestElement') pat(p.argument); };
  (fn.params || []).forEach(pat);
  (function w(n) { if (!n || typeof n.type !== 'string') return; if (n !== fn && /Function/.test(n.type)) return; if (n.type === 'VariableDeclarator') pat(n.id); if (n.type === 'FunctionDeclaration' && n !== fn) out.add(n.id.name); if (n.type === 'CatchClause' && n.param) pat(n.param); for (const k in n) { if (k === 'loc') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(w); else if (v && typeof v.type === 'string') w(v); } })(fn.body);
  return out;
}
// Names a piece uses that ANOTHER piece defines and this piece neither
// defines nor takes — a call that would fail once the pieces are apart.
function strays(pieces) {
  const S = {}; Object.keys(pieces).forEach(n => { S[n] = shape(pieces[n]); });
  const out = [];
  Object.keys(pieces).forEach(n => {
    const own = new Set([...S[n].defines, ...Object.keys(S[n].takes), ...Object.keys(S[n].valueTakes)]);
    const others = new Set(); Object.keys(S).forEach(m => { if (m !== n) S[m].defines.forEach(x => others.add(x)); });
    (function w(node, sh, p, k) {
      if (!node || typeof node.type !== 'string') return;
      let s2 = sh;
      if (/Function/.test(node.type)) { s2 = new Set([...sh, ...innerNames(node)]); if (node.id && node.type !== 'FunctionDeclaration') s2.add(node.id.name); }
      if (node.type === 'Identifier' && others.has(node.name) && !own.has(node.name) && !sh.has(node.name)) {
        const prop = p && p.type === 'MemberExpression' && k === 'property' && !p.computed;
        const key = p && p.type === 'Property' && k === 'key' && !p.computed;
        if (!prop && !key) out.push(n + ': ' + node.name + ' @' + node.loc.start.line);
      }
      for (const kk in node) { if (kk === 'loc') continue; const v = node[kk]; if (Array.isArray(v)) v.forEach(c => w(c, s2, node, kk)); else if (v && typeof v.type === 'string') w(v, s2, node, kk); }
    })(S[n].ast, new Set(), null, null);
  });
  return out;
}
function rules(pieces) {
  const names = Object.keys(pieces), S = {};
  names.forEach(n => { S[n] = shape(pieces[n]); });
  const r = { oneWrapper: [], made: 0, takenOk: [], takes: [], gives: [], dead: [], mismatch: [], both: [], values: [], valueBad: [] };
  names.forEach((n, i) => {
    if (S[n].wrappers !== 1) r.oneWrapper.push(n);
    r.made += (pieces[n].match(/var PINF = window\._pinFns = \{\};/g) || []).length;
    if (i > 0 && !/var PINF = window\._pinFns;/.test(pieces[n])) r.takenOk.push(n);
    Object.keys(S[n].takes).forEach(t => {
      r.takes.push(n + ':' + t);
      if (S[n].takes[t] !== t) r.mismatch.push(n + ':' + t + ' takes "' + S[n].takes[t] + '"');
      if (S[n].defines.has(t)) r.both.push(n + ':' + t);
      const givers = names.filter(m => S[m].gives.some(g => g.key === t) && S[m].defines.has(t));
      if (givers.length !== 1) r.gives.push(n + ':' + t + ' handed over by ' + givers.length);
    });
    // A VALUE (a fixed setting) is taken as it loads, so it must come from a
    // piece that loaded EARLIER, handed over AFTER that piece set it.
    Object.keys(S[n].valueTakes).forEach(t => {
      r.values.push(n + ':' + t);
      if (S[n].valueTakes[t] !== t) r.mismatch.push(n + ':' + t + ' takes PINF.' + S[n].valueTakes[t]);
      if (S[n].defines.has(t)) r.both.push(n + ':' + t);
      const givers = names.filter(m => S[m].gives.some(g => g.key === t) && S[m].varAt[t] !== undefined);
      if (givers.length !== 1) { r.valueBad.push(n + ':' + t + ' handed over (as a set value) by ' + givers.length); return; }
      const m = givers[0], g = S[m].gives.find(x => x.key === t);
      if (names.indexOf(m) >= i) r.valueBad.push(n + ':' + t + ' comes from ' + m + ', which loads AFTER it');
      if (g.at <= S[m].varAt[t]) r.valueBad.push(m + ' hands over ' + t + ' BEFORE setting it');
    });
    S[n].gives.forEach(g => {
      if (g.key !== g.value) r.mismatch.push(n + ' gives ' + g.key + ': ' + g.value);
      if (!names.some(m => m !== n && (Object.prototype.hasOwnProperty.call(S[m].takes, g.key) || Object.prototype.hasOwnProperty.call(S[m].valueTakes, g.key)))) r.dead.push(n + ' gives ' + g.key + ' — nobody takes it');
    });
  });
  return r;
}

const P = PIN.pinPieces();
const names = Object.keys(P);
T('H0 the Photo Inbox is in pieces: photo-inbox.js first, then photo-inbox-*.js', names.length >= 2 && names[0] === 'photo-inbox.js' && names.slice(1).every(n => /^photo-inbox-[a-z0-9-]+\.js$/.test(n)), names);
const R = rules(P);
T('H1 every piece is one wrapper', R.oneWrapper.length === 0, R.oneWrapper);
T('H1 …the first piece makes PINF once, every other piece takes it', R.made === 1 && R.takenOk.length === 0, { made: R.made, missing: R.takenOk });
T('H2 every name taken is handed over by exactly one piece that defines it', R.takes.length > 0 && R.gives.length === 0, { takes: R.takes.length, bad: R.gives });
T('H3 nothing is handed over that no piece takes', R.dead.length === 0, R.dead);
T('H4 every stand-in names itself, and no piece both takes and defines a name', R.mismatch.length === 0 && R.both.length === 0, { mismatch: R.mismatch, both: R.both });
T('H6 every fixed setting taken comes from an EARLIER piece, handed over after it is set', R.valueBad.length === 0, { values: R.values, bad: R.valueBad });
function valueWrites(pieces) {
  const S = {}; Object.keys(pieces).forEach(n => { S[n] = shape(pieces[n]); });
  const vals = new Set([].concat(...Object.keys(S).map(n => Object.keys(S[n].valueTakes))));
  const out = [];
  Object.keys(pieces).forEach(n => {
    (function w(node, p, k) {
      if (!node || typeof node.type !== 'string') return;
      const target = node.type === 'AssignmentExpression' ? node.left : node.type === 'UpdateExpression' ? node.argument : null;
      if (target) {
        let base = target; while (base.type === 'MemberExpression') base = base.object;
        if (base.type === 'Identifier' && vals.has(base.name)) out.push(n + ': ' + base.name + ' @' + node.loc.start.line);
      }
      for (const kk in node) { if (kk === 'loc') continue; const v = node[kk]; if (Array.isArray(v)) v.forEach(c => w(c, node, kk)); else if (v && typeof v.type === 'string') w(v, node, kk); }
    })(S[n].ast, null, null);
  });
  return out;
}
const vw = valueWrites(P);
T('H7 a fixed setting handed over is never changed afterwards (each piece holds a copy)', vw.length === 0, vw);
const st = strays(P);
T('H5 no piece uses what another piece defines without taking it', st.length === 0, st.slice(0, 10));

// ── P · planted ────────────────────────────────────────────────────────────
const reader = names.find(n => n !== names[0]);
const takeLine = (P[reader].match(/\n  var (\w+) = PINF\.from\('\1'\);/) || []);
T('P0 the plant anchors exist', !!takeLine[0], takeLine[0]);
if (takeLine[0]) {
  const tn = takeLine[1];
  // 1. the reader stops taking a name it uses → H5 catches the stray use
  const p1 = Object.assign({}, P); p1[reader] = P[reader].replace(takeLine[0], '');
  T('P1 PLANTED: a piece that uses ' + tn + ' without taking it is caught', strays(p1).some(s => s.indexOf(reader + ': ' + tn) === 0), strays(p1).slice(0, 3));
  // 2. the giver stops handing it over → H2 catches it
  const giver = names.find(n => n !== reader && new RegExp('\\b' + tn + ': ' + tn + '\\b').test(P[n]));
  const p2 = Object.assign({}, P); p2[giver] = P[giver].replace(new RegExp('\\b' + tn + ': ' + tn + '\\b,?\\s*'), '');
  T('P2 PLANTED: a name taken but no longer handed over is caught', rules(p2).gives.some(g => g.indexOf(':' + tn + ' handed over by 0') !== -1), rules(p2).gives);
  // 3. a hand-over nobody takes → H3 catches it
  const p3 = Object.assign({}, P); p3[reader] = P[reader].replace('Object.assign(PINF, { ', 'Object.assign(PINF, { _loadTesseract: _loadTesseract, ');
  T('P3 PLANTED: a hand-over nobody takes is caught', rules(p3).dead.some(d => /_loadTesseract/.test(d)), rules(p3).dead);
}

const vgive = P[names[0]].match(/\n  Object\.assign\(PINF, \{ (SETSTAGE_KEY|_PIN_SHEET_OV|READER_VER)[^\n]*\}\);/);
if (vgive) {
  const early = Object.assign({}, P);
  early[names[0]] = P[names[0]].replace(vgive[0], '').replace("  var PINF = window._pinFns = {};", "  var PINF = window._pinFns = {};" + vgive[0]);
  T('P4 PLANTED: fixed settings handed over before they are set are caught', rules(early).valueBad.some(b => /BEFORE setting it/.test(b)), rules(early).valueBad.slice(0, 3));
  const later = Object.assign({}, P); const taker = names.find(n => /\n  var (\w+) = PINF\.\1;/.test(P[n]));
  const vn = P[taker].match(/\n  var (\w+) = PINF\.\1;/)[1];
  later[taker] = P[taker].replace('})();', '  ' + vn + ' = 1;\n})();');
  T('P5 PLANTED: a piece changing its copy of ' + vn + ' is caught', valueWrites(later).some(w => w.indexOf(vn) !== -1), valueWrites(later));
}

// ── R · the real app in Chromium ───────────────────────────────────────────
(async () => {
  let chromium;
  try { chromium = require('playwright').chromium; }
  catch (e) { T('R0 playwright is installed (the real-app checks need it)', false, 'missing'); return done(); }
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const loaded = [];
  pg.on('requestfinished', rq => { const n = PIN.pinPieceOf(rq.url()); if (n) loaded.push(n); });
  await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1200);
  T('R1 every piece loads', names.every(n => loaded.indexOf(n) !== -1), loaded);
  const givenFns = [].concat(...names.map(n => { const sh = shape(P[n]); return sh.gives.filter(g => sh.fnDefs.has(g.key)).map(g => g.key); }));
  const givenVals = [].concat(...names.map(n => { const sh = shape(P[n]); return sh.gives.filter(g => !sh.fnDefs.has(g.key)).map(g => g.key); }));
  const onPage = await pg.evaluate(([fns, vals]) => ({
    fns: fns.map(k => k + ':' + typeof (window._pinFns || {})[k]),
    vals: vals.map(k => k + ':' + typeof (window._pinFns || {})[k]),
  }), [givenFns, givenVals]);
  T('R2 every handed-over function is a function on window._pinFns', onPage.fns.length === givenFns.length && onPage.fns.every(s => /:function$/.test(s)), onPage.fns.filter(s => !/:function$/.test(s)));
  T('R2 …and every handed-over fixed setting is there, set', onPage.vals.every(s => !/:undefined$/.test(s)), onPage.vals);
  const cross = await pg.evaluate(() => {
    const F = window._pinFns;
    // the reader's number finder, through the hand-over (main file → reader)
    const a = F.from('_numberFromText')('LIONEL 6464-25 GREAT NORTHERN', {});
    // the main file's row demotion, through the hand-over (reader → main file)
    const b = F.from('_pinDemotedRow')({ _box: true, itemNum: '6464-25', _tab: 'Lionel PW - Boxes' });
    return { a: a == null ? null : (typeof a === 'object' ? JSON.stringify(a).slice(0, 120) : String(a)), b: typeof b };
  });
  T('R3 a call across the boundary works both ways (reader ← main file, main file ← reader)', cross && cross.a !== null && cross.b === 'boolean', cross);
  T('R4 no page errors', errs.length === 0, errs);
  await browser.close();
  done();
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });

function done() {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
