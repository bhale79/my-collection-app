#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE KNOWN-PROBLEMS SWEEP, RELEASE 2 — v0.9.2047 — what a TAP is allowed to do
//
// [stated] Brad, 2026-10-29: "why can't we figure this out before hand" → the
// sweep (KNOWN_PROBLEMS_SWEEP_REPORT_2026-10-29.md) → "yes" to release 2:
// types A7 + A9 (a window, the share sheet or the clipboard asked for AFTER
// a wait — iPhone Safari refuses them silently), C15 (a quick second tap on
// a Save that saves twice) and C18 (a whole row written without checking it
// is still that row).
//
// Three scans over EVERY app/*.js (readdirSync, never a list), each proved
// able to fail on a planted offender, plus the REAL functions run in a Node
// sandbox against stand-in Google calls:
//
//   A  no window.open / navigator.share / clipboard write after an await or
//      inside a .then — unless a blank tab was opened first (rrOpenLater);
//      rrOpenLater and rrOnce (wizard-utils.js) run for real; openPhotoFolder
//      and the Preferences folder button open their tab BEFORE Drive answers
//   B  a tap-reached function that appends a row guards re-entry before its
//      first await; the three Upgrade / Want saves run twice at once → ONE row
//   C  a whole-row sheetsUpdate (column A, variable row) is verified first —
//      rrRowStillIs in the same function or the guarded writers; the contact
//      Save goes through rrVerifiedRowUpdate with the contact's id
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const acorn = require('acorn');
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const UTILS = read('wizard-utils.js'), COLL = read('app-collection.js'), PREFS = read('prefs.js'),
      PAGES = read('app-pages.js'), TOOLS = read('tools.js'), CONTACTS = read('contacts.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 600) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('not found: ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) { let e = k + 1; if (src[e] === ';') e++; return src.slice(i, e); } } }
  throw new Error('unbalanced: ' + sig);
}
function plant(src, a, b) { if (src.indexOf(a) < 0) throw new Error('plant target not found: ' + a.slice(0, 90)); return src.replace(a, b); }
const tick = (ms) => new Promise(r => setTimeout(r, ms || 0));
const FN = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const parse = (src) => acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script', locations: true, allowAwaitOutsideFunction: true });
function kids(node, fn) {
  for (const k of Object.keys(node)) {
    if (k === 'type' || k === 'loc' || k === 'start' || k === 'end') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach(c => { if (c && typeof c.type === 'string') fn(c); });
    else if (v && typeof v.type === 'string') fn(v);
  }
}
const APP_FILES = fs.readdirSync(APP).filter(f => f.endsWith('.js')).sort();
const SRC = {}; APP_FILES.forEach(f => { SRC[f] = read(f); });

// ═══ SCAN A · a gesture-gated browser call after a wait ════════════════════
// The gated calls: window.open, rrOpenExternal (the helper IS a window.open —
// barcode.js; a scan over call sites must see into the callee), navigator.share,
// navigator.clipboard.write / writeText. "After a wait" = an await earlier in
// the same function, or inside a .then callback. Not a hit when the function
// opened its tab first (window.open('', '_blank') or rrOpenLater()).
function scanGesture(src, file) {
  const hits = [];
  const txt = n => src.slice(n.start, n.end);
  const gated = (node) => {
    const c = node.callee;
    if (c.type === 'Identifier' && c.name === 'rrOpenExternal') return 'rrOpenExternal';
    if (c.type === 'MemberExpression') {
      const t = txt(c);
      if (t === 'window.open') return 'window.open';
      if (t === 'window.rrOpenExternal') return 'rrOpenExternal';
      if (t === 'navigator.share') return 'navigator.share';
      if (t === 'navigator.clipboard.write' || t === 'navigator.clipboard.writeText') return t;
    }
    return null;
  };
  const blankFirst = (node) => {
    const t = txt(node.callee);
    if (t === 'rrOpenLater' || t === 'window.rrOpenLater') return true;
    if (t !== 'window.open') return false;
    const a = node.arguments[0];
    return !!a && a.type === 'Literal' && (a.value === '' || a.value === 'about:blank');
  };
  function walk(node, scope, inThen) {
    if (FN.has(node.type)) { const s = { awaitAt: -1, blankAt: -1, inThen }; kids(node, c => walk(c, s, false)); return; }
    if (node.type === 'AwaitExpression') { walk(node.argument, scope, false); if (scope && scope.awaitAt < 0) scope.awaitAt = node.start; return; }
    if (node.type === 'CallExpression') {
      if (scope && blankFirst(node) && scope.blankAt < 0) scope.blankAt = node.start;
      const g = gated(node);
      if (g && !blankFirst(node) && scope) {
        const afterAwait = scope.awaitAt >= 0 && scope.awaitAt < node.start;
        const first = scope.blankAt >= 0 && scope.blankAt < node.start && (scope.awaitAt < 0 || scope.blankAt < scope.awaitAt);
        if ((afterAwait || scope.inThen) && !first) hits.push(file + ':' + node.loc.start.line + ' ' + g + (afterAwait ? ' after await' : ' inside .then'));
      }
      const c = node.callee;
      const isThen = c.type === 'MemberExpression' && !c.computed && c.property.name === 'then';
      walk(c, scope, false);
      node.arguments.forEach(a => walk(a, scope, isThen && FN.has(a.type)));
      return;
    }
    kids(node, c => walk(c, scope, false));
  }
  walk(parse(src), null, false);
  return hits;
}

// ═══ SCAN B · a tap-reached row-adding function guards re-entry ════════════
// The set: functions whose body calls sheetsAppend and whose NAME appears in an
// onclick="…" attribute or is assigned as a .onclick, plus anonymous .onclick
// handlers that append directly. The guard (before the first await), by the
// spellings in the app: rrOnce(…), <btn>.disabled = true, _rrBusyMark(…, true),
// if (_busy.X) return, if (<flag>) return + <flag> = true, <its pop-up>.remove().
// "guarded" = in the head (before the first await): rrOnce(…) · <btn>.disabled = true
// · _rrBusyMark(…, true) · if (_busy.X) return · if (FLAG) return AND FLAG = true
// (the same name, both in the head) · <its pop-up>.remove()
function guarded(head) {
  if (/rrOnce\s*\(|\.disabled\s*=\s*true|_rrBusyMark\s*\([^)]*,\s*true\)|if\s*\(\s*_busy\.\w+\s*\)\s*return|\w+\.remove\(\)/.test(head)) return true;
  const m = head.match(/if\s*\(\s*(\w+)\s*\)\s*return\b/g) || [];
  return m.some(x => { const f = x.match(/\(\s*(\w+)\s*\)/)[1]; return new RegExp('\\b' + f + '\\s*=\\s*true\\b').test(head); });
}
function scanDoubleTap(SRCMAP) {
  const all = Object.values(SRCMAP).join('\n');
  const hits = [], entries = [];
  // pass 1: every NAMED function that appends directly, and whether ITS head is guarded
  const appenders = new Map();   // name → its head is guarded
  const headOf = (src, fn) => { const body = src.slice(fn.start, fn.end); const fa = body.search(/\bawait\b/); return fa < 0 ? body : body.slice(0, fa); };
  for (const file of Object.keys(SRCMAP)) {
    const src = SRCMAP[file];
    (function walk(node, fn) {
      if (FN.has(node.type)) fn = node;
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'sheetsAppend' && fn && fn.id && !appenders.has(fn.id.name)) appenders.set(fn.id.name, guarded(headOf(src, fn)));
      kids(node, c => walk(c, fn));
    })(parse(src), null);
  }
  const reachedByTap = (name) => new RegExp('onclick=\\\\?["\'][^"\']*\\b' + name + '\\s*\\(').test(all) || new RegExp('\\.onclick\\s*=\\s*' + name + '\\b').test(all);
  // pass 2: the entries — a tap-reached function that appends, or that CALLS one that appends (one level)
  for (const file of Object.keys(SRCMAP)) {
    const src = SRCMAP[file];
    // a wrapper is fine when its own head is guarded, OR when every appender it
    // calls guards its own head (the guard lives in the callee: _impWrite)
    function consider(fn, name, label, callees) {
      entries.push(label);
      if (guarded(headOf(src, fn))) return;
      if (callees && callees.length && callees.every(a => appenders.get(a))) return;
      hits.push(label);
    }
    function walk(node, fn, isHandler) {
      if (FN.has(node.type)) {
        fn = node; fn._handler = isHandler;
        const name = (fn.id && fn.id.name) || '';
        if (name && reachedByTap(name) && !fn._seen) {
          const body = src.slice(fn.start, fn.end);
          const callees = [...appenders.keys()].filter(a => a !== name && new RegExp('\\b' + a + '\\s*\\(').test(body));
          if (appenders.has(name) || callees.length) { fn._seen = true; consider(fn, name, file + ':' + fn.loc.start.line + ' ' + name, appenders.has(name) ? null : callees); }
        }
      }
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'sheetsAppend' && fn && !fn._seen && fn._handler && !fn.id) {
        fn._seen = true; consider(fn, '', file + ':' + fn.loc.start.line + ' (handler)');
      }
      // an assigned handler: X.onclick = function/arrow
      if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && !node.left.computed && node.left.property.name === 'onclick' && FN.has(node.right.type)) {
        walk(node.right, fn, true); return;
      }
      kids(node, c => walk(c, fn, false));
    }
    walk(parse(src), null, false);
  }
  return { hits, entries };
}

// ═══ SCAN C · a whole-row write is verified first ══════════════════════════
function scanRowWrite(src, file) {
  const hits = [];
  const GUARDED = ['sheetsUpdateRow', 'rrVerifiedRowUpdate'];
  function walk(node, fn) {
    if (FN.has(node.type)) fn = node;
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'sheetsUpdate' && node.arguments.length >= 2 && fn) {
      const range = src.slice(node.arguments[1].start, node.arguments[1].end);
      const name = (fn.id && fn.id.name) || '';
      if (/!A['"`]\s*\+|!A\$\{/.test(range) && !GUARDED.includes(name) && !/rrRowStillIs\s*\(/.test(src.slice(fn.start, node.start))) {
        hits.push(file + ':' + node.loc.start.line + ' ' + (name || '(anonymous)') + ' ' + range.slice(0, 50));
      }
    }
    kids(node, c => walk(c, fn));
  }
  walk(parse(src), null);
  return hits;
}

// ── a sandbox for the real functions ───────────────────────────────────────
function sandbox(o) {
  o = o || {};
  const log = [];
  const c = {
    console: { log() {}, warn() {}, error() {} }, Promise, Date, JSON, Object, Array, String, Number, Math, RegExp, Error, setTimeout, clearTimeout,
    log, toasts: [], accessToken: 'tok', localStorage: { getItem: () => null, setItem() {} },
    state: Object.assign({ personalSheetId: 'MINE', personalData: {}, upgradeData: {}, wantData: {}, masterData: [] }, o.state || {}),
    PERSONAL_TAB: 'My Collection',
    slow: o.slow || 0,
  };
  c.window = c;
  c.document = { getElementById: () => null, querySelectorAll: () => [], body: { appendChild() {} } };
  c.showToast = (m) => { c.toasts.push(String(m)); };
  c.rrSaveError = (e) => 'save error: ' + (e && e.message);
  c.rrJsArg = s => String(s == null ? '' : s);
  ['renderBrowse', 'buildDashboard', '_cachePersonalData'].forEach(n => { c[n] = () => { log.push(n); }; });
  c._brandOfItem = () => 'Lionel'; c._getEraManufacturer = () => 'Lionel';
  c.rrVerifiedRowUpdate = async (sid, tab, row, range, values) => { log.push('verified ' + range); if (c.slow) await tick(c.slow); return true; };
  c.sheetsAppend = async (sid, range, rows) => { log.push('append ' + range); if (c.slow) await tick(c.slow); return 7; };
  c.sheetsGet = async () => { log.push('get'); return { values: [] }; };
  vm.createContext(c);
  return c;
}
function load(c, code) { vm.runInContext(code, c); return c; }
const RROPENLATER = grab(UTILS, 'function rrOpenLater(opts)');
const RRONCE = 'var _rrOnceBusy = {};\n' + grab(UTILS, 'function rrOnce(key, fn, btn)');

(async function main() {

  // ═══ A · the gesture scan ═══════════════════════════════════════════════
  section('A · no window / share sheet / clipboard asked for AFTER a wait');
  {
    let hits = [];
    APP_FILES.forEach(f => { hits = hits.concat(scanGesture(SRC[f], f)); });
    ok('every app/*.js: 0 gated calls after a wait (' + APP_FILES.length + ' files read)', hits.length === 0, hits);
    const P = (code) => scanGesture(code, 'planted.js');
    ok('PLANTED: window.open after an await → caught', P('async function f(){ await g(); window.open(u, "_blank"); }').length === 1);
    ok('PLANTED: the helper rrOpenExternal after an await → caught (the callee is a window.open)', P('async function f(){ await g(); rrOpenExternal(u); }').length === 1);
    ok('PLANTED: navigator.share inside a .then → caught', P('function f(){ up().then(function(){ navigator.share({url:u}); }); }').length === 1);
    ok('PLANTED: clipboard.writeText after an await → caught', P('async function f(){ var l = await up(); await navigator.clipboard.writeText(l); }').length === 1);
    ok('a commented-out offender does not fire', P('async function f(){ await g(); /* window.open(u) */ // window.open(u)\n }').length === 0);
    ok('a window.open with NO wait before it is fine', P('function f(){ window.open(u, "_blank"); }').length === 0);
    ok('the blank-tab-first pattern is fine (window.open(\'\') before the await)', P('async function f(){ var t = window.open("", "_blank"); await g(); t.location = u; window.open(u); }').length === 0);
    ok('the helper form is fine (rrOpenLater() before the await)', P('async function f(){ var t = rrOpenLater(); await g(); t.go(u); }').length === 0);
    ok('rrOpenLater AFTER the await is still a hit (the tab must open inside the tap)', P('async function f(){ await g(); var t = rrOpenLater(); window.open(u); }').length === 1);
    ok('an await inside a NESTED function does not count for the outer one', P('function f(){ var h = async () => { await g(); }; window.open(u); }').length === 0);
  }

  // ═══ A2 · rrOpenLater and rrOnce for real ═══════════════════════════════
  section('A2 · rrOpenLater / rrOnce (wizard-utils.js) run for real');
  {
    const mk = (openReturns) => {
      const c = sandbox();
      c.opened = [];
      c.open = (url, target, feat) => { c.opened.push([url, target, feat]); if (!openReturns) return null; const t = { closed: false, opener: 'app', location: null, close() { t.closed = true; } }; c.lastTab = t; return t; };
      load(c, RROPENLATER);
      return c;
    };
    let c = mk(true);
    let t = c.rrOpenLater();
    ok('opens a BLANK tab at once', c.opened.length === 1 && c.opened[0][0] === '' && c.opened[0][1] === '_blank');
    ok('go(url) points that same tab, opens no second window', t.go('https://x/y') === true && c.lastTab.location === 'https://x/y' && c.opened.length === 1);
    c = mk(true); t = c.rrOpenLater(); t.drop();
    ok('drop() closes the blank tab (the work failed)', c.lastTab.closed === true);
    c = mk(true); t = c.rrOpenLater({ ownPage: true }); t.go('https://lens');
    ok('ownPage: the tab is cut loose from the app (opener = null) before it is pointed — v1911\'s rule kept', c.lastTab.opener === null && c.lastTab.location === 'https://lens');
    c = mk(false); t = c.rrOpenLater();
    ok('blank tab refused (strict blocker) → go() falls back to a plain window.open of the address', (t.tab === null) && (t.go('https://x') === false) && c.opened.length === 2 && c.opened[1][0] === 'https://x');
    ok('…and drop() with no tab is harmless', (t.drop(), true));

    const c2 = sandbox(); load(c2, RRONCE);
    let runs = 0;
    const slow = () => new Promise(r => setTimeout(() => { runs++; r('done'); }, 20));
    const btn = { disabled: false, textContent: 'Save', isConnected: true };
    const p1 = c2.rrOnce('k', slow, btn), p2 = c2.rrOnce('k', slow, btn);
    ok('second call with the same key while the first runs → null, nothing run', p2 === null && btn.disabled === true && btn.textContent === 'Saving…');
    ok('the first call resolves with fn\'s value and the button comes back', (await p1) === 'done' && runs === 1 && btn.disabled === false && btn.textContent === 'Save');
    ok('after it settles the key is free again', c2.rrOnce('k', slow) !== null && (await tick(30), runs === 2));
    let caught = null; try { await c2.rrOnce('j', async () => { throw new Error('boom'); }); } catch (e) { caught = e.message; }
    ok('a failure is passed on AND releases the key', caught === 'boom' && c2.rrOnce('j', async () => 1) !== null);
    ok('two different keys run side by side', c2.rrOnce('a', slow) !== null && c2.rrOnce('b', slow) !== null);
    await tick(40);
  }

  // ═══ A3 · the real folder buttons open their tab BEFORE Drive answers ════
  section('A3 · openPhotoFolder / Preferences folder: the tab opens inside the tap');
  {
    const runColl = async (src) => {
      const c = sandbox();
      c.order = [];
      c.open = (url) => { c.order.push('open:' + url); return { close() { c.order.push('close'); }, set location(v) { c.order.push('go:' + v); } }; };
      c.driveRequest = async () => { c.order.push('drive'); await tick(10); return { id: 'F1', trashed: false }; };
      c.driveEnsureItemFolder = async () => 'F2'; c.driveFolderLink = id => 'https://drive/' + id;
      c.rrCopyInvFor = () => ''; c.personalColLetter = () => 'J';
      load(c, RROPENLATER + '\n' + grab(src, 'async function openPhotoFolder(itemNum, storedLink, invId)'));
      await c.openPhotoFolder('2338', 'https://drive.google.com/drive/folders/F1', '');
      return c.order;
    };
    let o = await runColl(COLL);
    ok('item page → Photo folder: blank tab opened, THEN Drive asked, THEN the tab pointed', o[0] === 'open:' && o[1] === 'drive' && o[2] === 'go:https://drive.google.com/drive/folders/F1', o);
    const OLD_COLL = plant(plant(COLL, 'var _pfTab = rrOpenLater();', ''), '_pfTab.go(storedLink);', "window.open(storedLink, '_blank');");
    o = await runColl(OLD_COLL);
    ok('PLANTED (the old code): the window asked for only after Drive answered → caught', o[0] === 'drive' && o[1] === 'open:https://drive.google.com/drive/folders/F1', o);

    const runPrefs = async (src) => {
      const c = sandbox();
      c.order = [];
      c.open = (url) => { c.order.push('open:' + url); return { close() { c.order.push('close'); }, set location(v) { c.order.push('go:' + v); } }; };
      c.driveCache = {}; c.driveEnsureSetup = async () => { c.order.push('setup'); await tick(10); c.driveCache.photosId = 'P9'; };
      c.rrIsSignInError = () => false;
      load(c, RROPENLATER + '\n' + grab(src, 'async function _prefsOpenPhotosFolder()'));
      await c._prefsOpenPhotosFolder();
      return c.order;
    };
    o = await runPrefs(PREFS);
    ok('Preferences → photo folder (first time): tab opened, setup ran, tab pointed', o.join(' ') === 'open: setup go:https://drive.google.com/drive/folders/P9', o);
    const c3 = sandbox(); c3.order = [];
    c3.open = (url) => { c3.order.push('open:' + url); return { close() { c3.order.push('close'); }, set location(v) { c3.order.push('go:' + v); } }; };
    c3.driveCache = {}; c3.driveEnsureSetup = async () => {}; c3.rrIsSignInError = () => false;
    load(c3, RROPENLATER + '\n' + grab(PREFS, 'async function _prefsOpenPhotosFolder()'));
    await c3._prefsOpenPhotosFolder();
    ok('…no folder yet: the blank tab is closed again and the person is told', c3.order.join(' ') === 'open: close' && /not set up yet/.test(c3.toasts.join('|')), c3.order);
  }

  // ═══ A4 · copy the cards as a picture: the picture is READY before the tap ═
  section('A4 · sell.js: the stitched picture is built ahead; the Copy tap hands it over with no wait first');
  {
    const SELL = read('sell.js');
    const mk = () => {
      const c = sandbox();
      c.order = [];
      c.ClipboardItem = function (o) { this.parts = o; };
      c.navigator = { clipboard: { write: async (items) => { const v = items[0].parts['image/png']; c.order.push('write:' + (v && typeof v.then === 'function' ? 'promise' : 'blob')); } } };
      c.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
      c._rrLoadImg = async () => { c.order.push('load'); await tick(5); return { width: 10, height: 10 }; };
      c.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob: (cb) => cb('BLOB') }) };
      c._rrDownloadFiles = () => { c.order.push('download'); };
      load(c, grab(SELL, 'async function _rrStitchCards(files)') + '\n' + grab(SELL, 'function _rrStitchAhead(files)') + '\n' + grab(SELL, 'async function _rrCopyCardsToClipboard(opt)'));
      c._rrShareFiles = ['f1', 'f2'];
      return c;
    };
    let c = mk();
    c._rrStitchAhead(c._rrShareFiles);
    await tick(30);
    ok('once the cards exist the picture is built in the background (both images loaded)', c.order.filter(x => x === 'load').length === 2 && c._rrShareStitchBlob === 'BLOB');
    c.order = [];
    const r = await c._rrCopyCardsToClipboard();
    ok('the Copy tap then writes the READY picture — a blob, first thing, nothing loaded again', r === true && c.order.join(' ') === 'write:blob', c.order);
    c = mk();
    const r2 = await c._rrCopyCardsToClipboard();
    ok('tapped before the picture is done: the promise itself goes into the ClipboardItem (Safari\'s form), the write placed before any wait', r2 === true && c.order.indexOf('write:promise') >= 0 && c.order.indexOf('write:promise') <= 1, c.order);
    ok('both share branches start the build the moment the cards exist', (SELL.match(/_rrStitchAhead\(files\);/g) || []).length === 2);
  }

  // ═══ B · double tap ═════════════════════════════════════════════════════
  section('B · a quick second tap on a Save saves ONCE');
  {
    const r = scanDoubleTap(SRC);
    ok('every tap-reached row-adding function guards re-entry before its first await (' + r.entries.length + ' entries)', r.hits.length === 0, r.hits);
    ok('the scan sees the three fixed ones as entries', ['saveUpgradeItem', 'saveUpgradeGroup', 'toolAddToWantList'].every(n => r.entries.some(e => e.endsWith(' ' + n))), r.entries);
    const P = (code) => scanDoubleTap({ 'planted.js': code });
    ok('PLANTED: an onclick function that appends with no guard → caught', P('function a(){ return "<b onclick=\\"saveX(1)\\">"; }\nasync function saveX(i){ await sheetsAppend(S, "T!A:B", [[i]]); }').hits.length === 1);
    ok('PLANTED: an onclick function that CALLS an appender, with no guard → caught (one level resolved)', P('function a(){ return "<b onclick=\\"saveX(1)\\">"; }\nfunction saveX(i){ return saveXNow(i); }\nasync function saveXNow(i){ await sheetsAppend(S, "T!A:B", [[i]]); }').hits.length === 1);
    ok('a wrapper whose callee guards ITSELF is fine (the guard lives in the callee)', P('function a(){ return "<b onclick=\\"goX(1)\\">"; }\nfunction goX(i){ return saveX(i); }\nvar done = false;\nasync function saveX(i){ if (done) return; done = true; await sheetsAppend(S, "T!A:B", [[i]]); }').hits.length === 0);
    ok('a flag checked AND taken before the first await is a guard', P('var busy = false;\nfunction a(){ return "<b onclick=\\"saveX(1)\\">"; }\nasync function saveX(i){ if (busy) return; busy = true; await sheetsAppend(S, "T!A:B", [[i]]); busy = false; }').hits.length === 0);
    ok('PLANTED: the flag checked before but TAKEN after the first await (the two-question-boxes bug) → caught', P('var busy = false;\nfunction a(){ return "<b onclick=\\"saveX(1)\\">"; }\nasync function saveX(i){ if (busy) return; if (!(await ask())) return; busy = true; await sheetsAppend(S, "T!A:B", [[i]]); busy = false; }').hits.length === 1);
    ok('PLANTED: an assigned .onclick handler that appends with no guard → caught', P('el.onclick = async function(){ await sheetsAppend(S, "T!A:B", [[1]]); };').hits.length === 1);
    ok('a function nobody\'s button reaches is outside the scan (its caller holds the guard)', P('async function saveWizardItem(){ await sheetsAppend(S, "T!A:B", [[1]]); }').entries.length === 0);
    ok('rrOnce before the first await is a guard', P('function a(){ return "<b onclick=\\"saveX(this)\\">"; }\nfunction saveX(b){ return rrOnce("x", async function(){ await sheetsAppend(S, "T!A:B", [[1]]); }, b); }').hits.length === 0);
    ok('the pop-up removed before the first await is a guard (the button is gone)', P('el.onclick = async function(){ ov.remove(); await sheetsAppend(S, "T!A:B", [[1]]); };').hits.length === 0);
    ok('the button disabled before the first await is a guard', P('el.onclick = async function(){ this.disabled = true; await sheetsAppend(S, "T!A:B", [[1]]); };').hits.length === 0);
    ok('PLANTED: the guard placed AFTER the first await is not a guard', P('el.onclick = async function(){ await x(); this.disabled = true; await sheetsAppend(S, "T!A:B", [[1]]); };').hits.length === 1);
  }
  section('B2 · the three saves, run twice at once, for real');
  {
    const UPG = (src) => RRONCE + '\n' + grab(src, 'function saveUpgradeItem(itemNum, variation, existingRow, invId, btn)') + '\n' + grab(src, 'async function _saveUpgradeItemNow(itemNum, variation, existingRow, invId)')
      + '\n' + grab(src, 'function saveUpgradeGroup(btn)') + '\n' + grab(src, 'async function _saveUpgradeGroupNow()');
    const runItem = async (src) => {
      const c = sandbox({ slow: 15 }); load(c, UPG(src));
      const btn = { disabled: false, textContent: '+ Add', isConnected: true };
      await Promise.all([c.saveUpgradeItem('2338', '', 0, 'INV1', btn), c.saveUpgradeItem('2338', '', 0, 'INV1', btn)]);
      return { rows: c.log.filter(l => /^append Want-Upgrade/.test(l)).length, btn };
    };
    let r = await runItem(PAGES);
    ok('Upgrade list → Save, tapped twice → ONE row; the button is back', r.rows === 1 && r.btn.disabled === false && r.btn.textContent === '+ Add', r);
    r = await runItem(plant(PAGES, "return rrOnce('upgrade-save', function () { return _saveUpgradeItemNow(itemNum, variation, existingRow, invId); }, btn);", 'return _saveUpgradeItemNow(itemNum, variation, existingRow, invId);'));
    ok('PLANTED: the guard taken out → TWO rows (the check can fail)', r.rows === 2, r);
    const runGroup = async (src) => {
      const c = sandbox({ slow: 15 }); c._upgGroupPieces = [{ itemNum: '2343', invId: 'A' }, { itemNum: '2343-T', invId: 'B' }]; load(c, UPG(src));
      await Promise.all([c.saveUpgradeGroup(), c.saveUpgradeGroup()]);
      return c.log.filter(l => /^append Want-Upgrade/.test(l)).length;
    };
    ok('Upgrade the whole set (2 pieces), tapped twice → TWO rows, not four', (await runGroup(PAGES)) === 2);
    ok('PLANTED: the guard taken out → four rows', (await runGroup(plant(PAGES, "return rrOnce('upgrade-save', function () { return _saveUpgradeGroupNow(); }, btn);", 'return _saveUpgradeGroupNow();'))) === 4);
    const runWant = async (src) => {
      const c = sandbox({ slow: 15 }); c.state.masterData = [{ itemNum: '6464-1', variation: 'A' }];
      load(c, RRONCE + '\n' + grab(src, 'function toolAddToWantList(itemNum, setIdx, btn)') + '\n' + grab(src, 'async function _toolAddToWantListNow(itemNum, setIdx)'));
      await Promise.all([c.toolAddToWantList('6464-1', 0), c.toolAddToWantList('6464-1', 0)]);
      return c.log.filter(l => /^append Want-Upgrade/.test(l)).length;
    };
    ok('Set Builder → ★ Want List, tapped twice → ONE row', (await runWant(TOOLS)) === 1);
    ok('PLANTED: the guard taken out → two rows', (await runWant(plant(TOOLS, "return rrOnce('setbuilder-want:' + itemNum, function () { return _toolAddToWantListNow(itemNum, setIdx); }, btn);", 'return _toolAddToWantListNow(itemNum, setIdx);'))) === 2);
    ok('the Upgrade / Want buttons hand themselves to the save (this) so they can read "Saving…"', /saveUpgradeGroup\(this\)/.test(PAGES) && /,this\)" style=/.test(PAGES.slice(PAGES.indexOf('saveUpgradeItem(\\\'\' + itemNum'), PAGES.indexOf('saveUpgradeItem(\\\'\' + itemNum') + 300)) && /toolAddToWantList\(\\'' \+ itm[^\n]*,this\)/.test(TOOLS));
    ok('Mark sold / Returned take their flag BEFORE the question box (the scan proves it above); Cancel gives it back', /_rrSellBusy = true;[^\n]*\n[\s\S]{0,900}if \(!_det\) \{ _rrSellBusy = false; return; \}/.test(PAGES) && /_rrReturnBusy = true;\n[\s\S]{0,400}\{ _rrReturnBusy = false; return; \}/.test(PAGES));
  }

  // ═══ C · a whole-row write is verified first ════════════════════════════
  section('C · a whole-row write checks the row is still that record');
  {
    let hits = [];
    APP_FILES.forEach(f => { hits = hits.concat(scanRowWrite(SRC[f], f)); });
    ok('every app/*.js: 0 unverified whole-row sheetsUpdate calls', hits.length === 0, hits);
    const P = (code) => scanRowWrite(code, 'planted.js');
    ok('PLANTED: a row write with no check → caught', P("async function f(row){ await sheetsUpdate(S, T + '!A' + row + ':Q' + row, [v]); }").length === 1);
    ok('PLANTED: the template-string spelling → caught', P('async function f(row){ await sheetsUpdate(S, `T!A${row}:Q${row}`, [v]); }').length === 1);
    ok('rrRowStillIs earlier in the same function → fine', P("async function f(row){ if (!(await rrRowStillIs(S, T, row, n))) return; await sheetsUpdate(S, T + '!A' + row + ':Q' + row, [v]); }").length === 0);
    ok('the guarded writers themselves are not hits', P("async function rrVerifiedRowUpdate(s,t,r,range,v){ await sheetsUpdate(s, range, v); }\nasync function g(row){ await sheetsUpdate(S, T + '!A' + row + ':Q' + row, [v]); }").length === 1);
    ok('a header write (row 1, no variable) is not a row write', P("async function f(){ await sheetsUpdate(S, T + '!A1:Q1', [h]); }").length === 0);
    // v0.9.2067 (collections): the contact save names the HOME sheet through _ctSheet(), not state.personalSheetId.
    ok('the contact Save goes through rrVerifiedRowUpdate with the contact\'s own id', /rrVerifiedRowUpdate\(_ctSheet\(\), TAB, row, TAB \+ '!A' \+ row \+ ':Q' \+ row, \[rowVals\], \{ num: c\.id \|\| '' \}, 'contact list'\)/.test(CONTACTS));
    ok('…and a refusal leaves the form open with the Save button back', /if \(!\(await rrVerifiedRowUpdate\(_ctSheet\(\), TAB, row[\s\S]{0,200}this\.textContent = '✓ Save Contact'; this\.disabled = false;\s*return;/.test(CONTACTS));
    ok('PLANTED: the old contact write (sheetsUpdate by row) → the scan catches it', scanRowWrite(plant(CONTACTS, "if (!(await rrVerifiedRowUpdate(_ctSheet(), TAB, row, TAB + '!A' + row + ':Q' + row, [rowVals], { num: c.id || '' }, 'contact list'))) {", "if (!(await sheetsUpdate(_ctSheet(), TAB + '!A' + row + ':Q' + row, [rowVals]))) {"), 'contacts.js').length === 1);
  }

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  the suite threw: ' + (e && e.stack || e)); process.exit(1); });
