// ═══════════════════════════════════════════════════════════════
// handler_argument_tests.js — v0.9.1760.
//
// Brad, 2026-09-16: "lionel support takes me to 440 steam engine parts and the
// google the parts diagram button does nothing."
//
// THE BUG, read live off his card: item 8359 is described as
//     EMD GP-7 'GM50' Diesel Locomotive
// and the button was built as  onclick="window.open('<url with that text>')".
// Those two apostrophes closed the JavaScript string early, so the handler was
// not valid JavaScript at all — the browser threw "missing ) after argument
// list" while parsing it and the click did NOTHING. No error, no clue.
//
// THE TRAP: HTML-escaping is NOT enough here. The browser DECODES the attribute
// BEFORE the JavaScript inside it is parsed, so &#39; turns back into a bare '
// and breaks the string just the same. The text must be escaped for the JS
// string FIRST (backslashes, then quotes), and only then for the attribute.
// One place does that now: rrJsArg (app.js). Yardmaster had it right by hand
// since v1712 and nowhere else did — 63 other handler arguments across four
// files were one apostrophe away from silence.
//
// This suite runs the REAL rrJsArg and proves the round trip, shows the old way
// really did break, and holds the sweep at zero.
// Run:  node tests/handler_argument_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const app = APP('app.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) { const i = src.indexOf(sig); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; }

// ── the real helpers, lifted out of app.js ────────────────────────────────
const rrEscSrc = grab(app, 'function rrEsc(v)');
const rrJsArgSrc = grab(app, 'function rrJsArg(v)');
ok('rrEsc and rrJsArg are both in app.js, which every other file loads first', rrEscSrc.length > 40 && rrJsArgSrc.length > 40);
const api = new Function(rrEscSrc + '\n' + rrJsArgSrc + '\nreturn { esc: rrEsc, jsArg: rrJsArg };')();
ok('…and rrJsArg is published on window for the other files', /window\.rrJsArg = rrJsArg;/.test(app));

// what the BROWSER does to an attribute before the JS in it is parsed
const htmlDecode = s => String(s)
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// the full journey: value → attribute → (browser decodes) → JS string literal → value
function throughAButton(v) {
  const attribute = api.jsArg(v);
  const js = "window.open('" + htmlDecode(attribute) + "','_blank')";
  new Function(js);                                   // must PARSE, or the button is dead
  return new Function("return '" + htmlDecode(attribute) + "'")();   // and mean the same thing
}

section('The value that comes back out of the button is the value that went in');
const CASES = [
  ["EMD GP-7 'GM50' Diesel Locomotive", 'the 8359 description that started this'],
  ["Henning's Trains", 'a store with an apostrophe'],
  ['https://www.google.com/search?q=lionel%20%228359%22', 'a search URL'],
  ['21" Aluminum Passenger Car', 'an inch mark'],
  ['back\\slash', 'a backslash'],
  ["O'Brien & Sons <Ltd>", 'quote, ampersand and angle brackets together'],
  ['', 'an empty string'],
  ['6-8359', 'an ordinary item number'],
];
CASES.forEach(function (c) {
  let got = null, threw = '';
  try { got = throughAButton(c[0]); } catch (e) { threw = String(e && e.message || e); }
  ok(c[1] + ' survives the round trip', !threw && got === c[0], threw || JSON.stringify(got));
});
ok('null and undefined become an empty string, never the word "null"', api.jsArg(null) === '' && api.jsArg(undefined) === '');
ok('a number is fine too', api.jsArg(24177) === '24177');

section('The old way really was broken — this is not a theoretical fix');
let oldBroke = false;
try { new Function("window.open('" + htmlDecode(api.esc("EMD GP-7 'GM50' Diesel Locomotive")) + "','_blank')"); }
catch (e) { oldBroke = /missing|Invalid|Unexpected/i.test(String(e.message)); }
ok('HTML-escaping ALONE leaves a handler that will not parse (Brad\'s dead button)', oldBroke);
ok('…and rrJsArg makes that exact string parse', (function () { try { throughAButton("EMD GP-7 'GM50' Diesel Locomotive"); return true; } catch (e) { return false; } })());

section('The sweep: no handler argument is left unescaped');
const FILES = ['maintenance.js', 'contacts.js', 'yardmaster.js', 'stock-photos.js'];
const OPEN_ARG = "\\'' + ";
let armed = 0, total = 0;
FILES.forEach(function (f) {
  const s = APP(f);
  let i = 0;
  while ((i = s.indexOf(OPEN_ARG, i)) >= 0) {
    const after = s.slice(i + OPEN_ARG.length, i + OPEN_ARG.length + 10);
    total++;
    if (after.indexOf('rrJsArg(') === 0) armed++;
    else if (after.indexOf('_esc(') === 0) { fail++; console.log('  FAIL  ' + f + ' still drops _esc() straight into a handler argument at ' + i); }
    i += OPEN_ARG.length;
  }
});
// 74 openings in all: 64 carry TEXT and are now armed; the other 10 pass internal
// constants the code itself wrote (a pref key, a select id, a field name), which
// cannot contain an apostrophe.
ok('every handler argument that carries text goes through rrJsArg (64 of them)', armed === 64, 'armed ' + armed + ' of ' + total + ' openings');
ok('…and the sweep found every opening it expected to', total === 74, String(total));
FILES.forEach(function (f) {
  ok(f + ' has no _esc() left inside a handler argument', APP(f).indexOf("\\'' + _esc(") < 0);
});
ok('the Yardmaster\'s hand-rolled copy (v1712) now calls the shared helper', /var g = groups\[k\], ke = rrJsArg\(k\);/.test(APP('yardmaster.js')));
ok('a contact\'s address — an apostrophe in a street name — is escaped too', /_ctMap\(event, \\'' \+ rrJsArg\(encodeURIComponent\(c\.address\)\)/.test(APP('contacts.js')));

section('Lionel Support searches the number the way the box prints it');
const mt = APP('maintenance.js');
const boxNum = new Function(grab(mt, 'function _lionelBoxNum(num)') + '\nreturn _lionelBoxNum;')();
ok('8359 → 6-8359 (Brad: "the model number is Model Number: 6-8359")', boxNum('8359') === '6-8359');
ok('17294 → 6-17294, 83503 → 6-83503 — the short catalog numbers all carry the prefix', boxNum('17294') === '6-17294' && boxNum('83503') === '6-83503');
ok('a long modern number is printed bare and is left alone', boxNum('2032010') === '2032010' && boxNum('6304678206') === '6304678206');
ok('a number that already has the prefix keeps it — it is no longer stripped off', boxNum('6-8359') === '6-8359');
ok('nothing odd on an empty or lettered number', boxNum('') === '' && boxNum('DECO1234567') === 'DECO1234567');
ok('the search URL and the button label both use it', /encodeURIComponent\(_lionelBoxNum\(num\)\)/.test(mt) && /_esc\(_lionelBoxNum\(num\)\)/.test(mt));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
