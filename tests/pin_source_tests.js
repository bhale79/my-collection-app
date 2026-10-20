#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE PHOTO INBOX IS READ ONE WAY — tests/lib/pin-source.js (2026-10-20)
//
// Brad: "lets plan the photo inbox split" → "start 1". Step 1 of
// PLAN_2026-10-20_PHOTO_INBOX_SPLIT.md: before any code moves out of
// app/photo-inbox.js, every test reads the Photo Inbox through ONE helper, so
// a test cannot quietly stop seeing code that moved into another piece.
//
//   H  the helper itself: the pieces come from index.html, in load order;
//      pinSource joins them; pinMerge folds them into one entry; pinFulfill
//      serves a whole planted copy on the first piece and empties the rest
//   X  a SIMULATED split (a copy of the app in a temp folder, the inbox cut in
//      two at a function boundary): the joined source is the original, word
//      for word — so every test that reads through the helper keeps working
//   R  the rule: no test opens a Photo Inbox file by name (readFileSync,
//      a reader helper, a path join, or a route match on the URL)
//   O  the pieces' script tags sit together in index.html (that is what makes
//      "serve it all on the first piece" the same as the real load), and
//      sw.js keeps every piece for offline use
//   P  PLANTED: each rule fails on a planted offender
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const PIN = require('./lib/pin-source');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 700))); cond ? pass++ : fail++; }

// ── H · the helper ─────────────────────────────────────────────────────────
const names = PIN.pinPieceNames();
T('H1 the pieces are read from index.html, the first is photo-inbox.js', names.length >= 1 && names[0] === 'photo-inbox.js', names);
const pieces = PIN.pinPieces();
T('H2 pinPieces holds every piece, in load order', JSON.stringify(Object.keys(pieces)) === JSON.stringify(names), Object.keys(pieces));
const joined = PIN.pinSource();
T('H3 pinSource = the pieces joined in load order', joined === names.map(n => pieces[n]).join('\n'), joined.length);
T('H4 …and it holds the Photo Inbox (its page opener and its reader)', /window\._pinGo\s*=/.test(joined) && /function _numberFromText\(/.test(joined), '');
T('H5 pinRead: photo-inbox.js means the whole Photo Inbox, any other file goes to the reader given',
  PIN.pinRead('photo-inbox.js', () => 'X') === joined && PIN.pinRead('app/photo-inbox.js', () => 'X') === joined && PIN.pinRead('drive.js', f => 'R:' + f) === 'R:drive.js', '');
const merged = PIN.pinMerge({ 'drive.js': 'D', 'photo-inbox.js': 'old' });
T('H6 pinMerge folds the pieces into ONE photo-inbox.js entry and keeps the rest', merged['photo-inbox.js'] === joined && merged['drive.js'] === 'D' && Object.keys(merged).length === 2, Object.keys(merged));
const mergedP = PIN.pinMerge({ 'app/drive.js': 'D', 'app/photo-inbox.js': 'old', 'index.html': 'H' }, 'app/');
T('H7 …the same with an app/ prefix', mergedP['app/photo-inbox.js'] === joined && mergedP['index.html'] === 'H' && Object.keys(mergedP).length === 3, Object.keys(mergedP));
function fakeRoute() { const r = { got: null, fulfill(o) { r.got = o; } }; return r; }
let r1 = fakeRoute();
const h1 = PIN.pinFulfill(r1, 'file:///x/app/photo-inbox.js?v=1', 'PLANTED');
T('H8 pinFulfill serves the whole planted copy on the first piece', h1 === true && r1.got && r1.got.body === 'PLANTED' && r1.got.contentType === 'application/javascript', r1.got);
let r2 = fakeRoute();
T('H9 pinFulfill leaves any other file alone', PIN.pinFulfill(r2, 'file:///x/app/drive.js?v=1', 'PLANTED') === false && r2.got === null, r2.got);
T('H10 pinPieceOf names the piece a URL asks for', PIN.pinPieceOf('file:///x/app/photo-inbox.js?v=9') === 'photo-inbox.js' && PIN.pinPieceOf('file:///x/app/drive.js') === null, '');

// ── X · a simulated split ──────────────────────────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-split-'));
const real = fs.readFileSync(path.join(APP, 'photo-inbox.js'), 'utf8');
const cut = real.indexOf('\n  // ══ v0.9.1077 — identify by what the car SAYS');   // a section boundary inside the wrapper
const partA = real.slice(0, cut), partB = real.slice(cut + 1);
const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const tagRe = /(<script src="\.\/photo-inbox\.js\?v=\d+"><\/script>[^\n]*)/;
const htmlSplit = html.replace(tagRe, '$1\n<script src="./photo-inbox-reader.js?v=1"></script>');
fs.writeFileSync(path.join(TMP, 'index.html'), htmlSplit);
fs.writeFileSync(path.join(TMP, 'photo-inbox.js'), partA);
fs.writeFileSync(path.join(TMP, 'photo-inbox-reader.js'), partB);
T('X0 the simulation is set up (the cut point exists, the second tag went in)', cut > 0 && htmlSplit !== html, { cut });
T('X1 split in two, the helper finds both pieces in load order', JSON.stringify(PIN.pinPieceNames(TMP)) === JSON.stringify(['photo-inbox.js', 'photo-inbox-reader.js']), PIN.pinPieceNames(TMP));
T('X2 …and the joined source is the original, word for word', PIN.pinSource(TMP) === real, PIN.pinSource(TMP).length + ' vs ' + real.length);
T('X3 …so a test looking for code that moved still finds it', /function _pinDescArbitrate\(/.test(PIN.pinSource(TMP)) && !/function _pinDescArbitrate\(/.test(partA) && /function _pinDescArbitrate\(/.test(partB), '');

// ── R · the rule: no test opens a Photo Inbox file by name ─────────────────
// a piece is photo-inbox.js or photo-inbox-<name>.js; photo-inbox-tests.js is a TEST, never a piece
const PIECE = "photo-inbox(?:-(?!tests\\b)[a-z0-9]+)*\\.js";
const OFFENDERS = [
  { what: 'readFileSync of a Photo Inbox file', re: new RegExp("readFileSync\\([^;\\n]*'(?:app/)?" + PIECE + "'") },
  { what: 'a path built to a Photo Inbox file', re: new RegExp("\\.join\\([^;\\n]*'" + PIECE + "'\\s*\\)") },
  { what: 'a reader helper called on a Photo Inbox file', re: new RegExp("\\b(?!pinRead\\b)[A-Za-z_$][\\w$]*\\(\\s*'(?:app/)?" + PIECE + "'\\s*\\)") },
  { what: 'a request matched to a Photo Inbox file by name', re: new RegExp("endsWith\\(\\s*'/(?:app/)?" + PIECE + "'") },
];
function codeLines(text) {
  return text.split('\n').map((l, i) => ({ l, n: i + 1 })).filter(x => !/^\s*(\/\/|\*|\/\*)/.test(x.l));
}
function scanTests(files) {
  const bad = [];
  Object.keys(files).forEach(f => {
    codeLines(files[f]).forEach(x => {
      OFFENDERS.forEach(o => { if (o.re.test(x.l)) bad.push(f + ':' + x.n + ' — ' + o.what + ': ' + x.l.trim().slice(0, 100)); });
    });
  });
  return bad;
}
const TESTS = {};
fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== 'pin_source_tests.js').forEach(f => { TESTS[f] = fs.readFileSync(path.join(__dirname, f), 'utf8'); });
const found = scanTests(TESTS);
T('R1 no test opens a Photo Inbox file itself — they all read through tests/lib/pin-source.js', found.length === 0, found.slice(0, 8));

// ── O · load order and offline copy ────────────────────────────────────────
function tagsTogether(h) {
  const scripts = [...h.matchAll(/<script\s+src="\.\/([^"?]+)/g)].map(m => m[1]);
  const at = scripts.map((s, i) => /^photo-inbox(?:-[a-z0-9]+)*\.js$/.test(s) ? i : -1).filter(i => i >= 0);
  return at.length > 0 && at[at.length - 1] - at[0] === at.length - 1;
}
T('O1 the Photo Inbox pieces load together in index.html (no other script between them)', tagsTogether(html), '');
const sw = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8');
const swMissing = names.filter(n => sw.indexOf("'./" + n + "'") < 0);
T('O2 sw.js keeps every Photo Inbox piece for offline use', swMissing.length === 0, swMissing);

// ── P · planted offenders ──────────────────────────────────────────────────
const plants = [
  ["const S = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');", 'readFileSync'],
  ["const p = path.join(APP, 'photo-inbox-reader.js');", 'path'],
  ["const pin = rd('app/photo-inbox.js');", 'reader helper'],
  ["if (u.split('?')[0].endsWith('/app/photo-inbox.js')) return r.fulfill({ body });", 'route by name'],
];
plants.forEach(([line, what], i) => {
  const hit = scanTests({ 'planted_tests.js': '// header\n' + line + '\n' });
  T('P' + (i + 1) + ' PLANTED: ' + what + ' is caught', hit.length >= 1, hit);
});
T('P5 PLANTED: a commented-out mention is not an offender', scanTests({ 'c.js': "// const x = rd('photo-inbox.js');\n" }).length === 0, '');
T('P6 PLANTED: pinRead(f, rd) on a list of names is allowed', scanTests({ 'ok.js': "const s = pinRead('photo-inbox.js', rd);\n" }).length === 0, '');
T('P6b PLANTED: naming the Photo Inbox TEST file is not an offender', scanTests({ 'ok2.js': "const t = fs.readFileSync(path.join(__dirname, 'photo-inbox-tests.js'), 'utf8');\n" }).length === 0, '');
const htmlApart = htmlSplit.replace('<script src="./photo-inbox-reader.js?v=1"></script>', '').replace('</body>', '<script src="./photo-inbox-reader.js?v=1"></script>\n</body>');
T('P7 PLANTED: a piece loaded away from the others is caught', tagsTogether(htmlSplit) && !tagsTogether(htmlApart), '');
let threw = false; try { PIN.pinPieceNames(fs.mkdtempSync(path.join(os.tmpdir(), 'pin-none-')) + '/../' + path.basename(TMP) + '/nope'); } catch (e) { threw = true; }
const NOPE = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-nope-'));
fs.writeFileSync(path.join(NOPE, 'index.html'), '<html><script src="./app.js?v=1"></script></html>');
let threw2 = false; try { PIN.pinPieceNames(NOPE); } catch (e) { threw2 = /missing/.test(e.message); }
T('P8 PLANTED: an index.html with no Photo Inbox makes the helper fail loudly, never return nothing', threw && threw2, { threw, threw2 });

try { fs.rmSync(TMP, { recursive: true, force: true }); fs.rmSync(NOPE, { recursive: true, force: true }); } catch (e) {}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
