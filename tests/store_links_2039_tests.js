// ════════════════════════════════════════════════════════════════════════════
// store_links_2039_tests.js — v0.9.2039: THE LAST STOP for every outgoing link.
//
// [stated] Brad, 2026-10-27/28: Trainz gave permission and mentioned an
// affiliate link; "what i don't want is trainz plastered over every button kind
// of thing"; yes to building the "last stop" with the code left blank.
//
// What is proven here, with the REAL app/store-links.js and the REAL
// RR_AFFILIATE block from app/config.js run inside jsdom:
//   A  the setting: ONE table, in config.js, shipped BLANK
//   B  blank code → every link leaves as the very same string
//   C  with a test code → a store link carries it; look-alikes, other sites,
//      mail/relative/broken addresses never do; never added twice; a network
//      "wrap" works; the address's own query and #anchor survive
//   D  the checkpoint itself: window.open is wrapped once and passes the
//      store-coded address on (other arguments untouched); a PRESSED link is
//      rewritten before it opens — even when the link's own handler stops the
//      event (capture phase), on an icon inside the link, on middle/right click
//   E  load order: index.html loads store-links.js right after config.js,
//      before every other script; the service worker caches it
//   F  NO OTHER WAY OUT — a scan of app/ (every .js + index.html, readdirSync):
//      page-changing location writes are only the known non-store ones; a
//      script-built link that is .click()ed off the page is a file save; nothing
//      else replaces window.open; nothing else reads RR_AFFILIATE; the service
//      worker opens no windows
//   P  planted offenders: each old/bad habit put back must turn its check red
// Run:  node tests/store_links_2039_tests.js
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APPDIR = path.join(__dirname, '..', 'app');
const APP = f => fs.readFileSync(path.join(APPDIR, f), 'utf8');
const STORE = APP('store-links.js'), CONFIG = APP('config.js'), INDEX = APP('index.html'), SW = APP('sw.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
// full-line // comments only (never strip /* */ with a regex — rules_testing)
const code = src => src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }

// The shipped table, lifted from config.js as written.
function shippedTable(cfg) {
  const i = cfg.indexOf('const RR_AFFILIATE = [');
  if (i < 0) return '';
  const j = cfg.indexOf('];', i);
  return cfg.slice(i, j + 2);
}
const TEST_TABLE = "const RR_AFFILIATE = [ { store: 'Trainz', host: 'trainz.com', params: { ref: 'TEST1' }, wrap: '' } ];";
const WRAP_TABLE = "const RR_AFFILIATE = [ { store: 'Trainz', host: 'trainz.com', params: {}, wrap: 'https://track.example.net/go?u={url}' } ];";

// A page with the table and the real store-links.js loaded the way index.html
// loads them (two classic scripts sharing one global scope). window.open is a
// recorder standing in for the browser's.
function page(tableSrc, storeSrc) {
  const dom = new JSDOM('<!doctype html><html><body>'
    + '<div id="wrap"><a id="tz" href="https://www.trainz.com/pages/parts-diagram/abc" target="_blank">Trainz diagram</a>'
    + '<a id="tzicon" href="https://trainz.com/products/x?variant=2#specs" target="_blank"><span><svg><path d="M0 0"></path></svg></span></a>'
    + '<a id="cott" href="https://cornucopiaoftoytrains.com/boxcars/#6464" target="_blank">COTT</a>'
    + '<a id="stop" href="https://www.trainz.com/products/stopper" target="_blank">stopper</a>'
    + '<a id="mail" href="mailto:a@b.c">mail</a></div></body></html>',
    { runScripts: 'outside-only', url: 'https://therailroster.com/app/' });
  const w = dom.window;
  w._opened = [];
  w.open = function () { w._opened.push(Array.prototype.slice.call(arguments)); return null; };
  // jsdom does not navigate on a link press; that is fine — the test reads the
  // href at the moment the press finishes, which is what the browser opens.
  w.eval(tableSrc + '\nwindow.RR_AFFILIATE = RR_AFFILIATE;');
  w.eval(storeSrc);
  return w;
}

function press(w, el, type, init) {
  const Ev = (type === 'click' || type === 'auxclick' || type === 'contextmenu') ? w.MouseEvent : (w.PointerEvent || w.MouseEvent);
  el.dispatchEvent(new Ev(type, Object.assign({ bubbles: true, cancelable: true }, init || {})));
}

const LINKS = [
  'https://www.trainz.com/pages/parts-diagram/abc',
  'https://trainz.com/products/lgb-20140?variant=7#specs',
  'http://shop.trainz.com/x',
  'HTTPS://WWW.TRAINZ.COM/Parts',
  'https://www.trainz.com/products/y?ref=OTHER',
  'https://nottrainz.com/products/z',
  'https://trainz.com.example.org/products/z',
  'https://cornucopiaoftoytrains.com/boxcars/#6464',
  'https://www.google.com/search?q=site%3Atrainz.com+lionel+6-84631',
  'mailto:support@therailroster.com',
  './index.html',
  '',
  null,
  'https://',
];

// Everything the checks below need, from one set of sources — so section P can
// re-run it on a planted copy and see the matching check go red.
function run(storeSrc) {
  const r = {};
  if (!JSDOM) { r.err = 'jsdom missing'; return r; }
  try {
    // B — as shipped
    const wb = page(shippedTable(CONFIG), storeSrc);
    r.blankSame = LINKS.every(u => wb.rrAffiliateUrl(u) === u);
    // C — with a test code
    const w = page(TEST_TABLE, storeSrc);
    const f = u => w.rrAffiliateUrl(u);
    r.c1 = f(LINKS[0]) === 'https://www.trainz.com/pages/parts-diagram/abc?ref=TEST1';
    r.c2 = f(LINKS[1]) === 'https://trainz.com/products/lgb-20140?variant=7&ref=TEST1#specs';
    r.c3 = f(LINKS[2]) === 'http://shop.trainz.com/x?ref=TEST1';
    r.c4 = /^https:\/\/www\.trainz\.com\/Parts\?ref=TEST1$/.test(f(LINKS[3]));
    r.notTwice = f(LINKS[4]) === LINKS[4] && f(f(LINKS[0])) === f(LINKS[0]);
    r.lookalike = f(LINKS[5]) === LINKS[5] && f(LINKS[6]) === LINKS[6];
    r.others = [7, 8, 9, 10, 11, 12, 13].every(i => f(LINKS[i]) === LINKS[i]);
    r.storeFor = !!w.rrAffiliateStoreFor(LINKS[0]) && w.rrAffiliateStoreFor(LINKS[5]) === null;
    const ww = page(WRAP_TABLE, storeSrc);
    r.wrap = ww.rrAffiliateUrl(LINKS[0]) === 'https://track.example.net/go?u=' + encodeURIComponent(LINKS[0])
      && ww.rrAffiliateUrl(ww.rrAffiliateUrl(LINKS[0])) === ww.rrAffiliateUrl(LINKS[0])
      && ww.rrAffiliateUrl(LINKS[7]) === LINKS[7];
    // D — window.open
    w.open(LINKS[0], '_blank', 'noopener');
    w.open(LINKS[7], '_blank');
    w.open();
    r.openCoded = w._opened[0] && w._opened[0][0] === f(LINKS[0]) && w._opened[0][1] === '_blank' && w._opened[0][2] === 'noopener';
    r.openOther = w._opened[1] && w._opened[1][0] === LINKS[7] && w._opened[1].length === 2;
    r.openEmpty = w._opened[2] && w._opened[2].length === 0;
    const before = w.open;
    r.installOnce = w.rrStoreLinksInstall(w) === false && w.open === before;
    w._opened.length = 0; w.open(LINKS[1]);
    r.openSingleWrap = w._opened.length === 1 && w._opened[0][0] === f(LINKS[1]);
    // D — pressed links
    const d = w.document;
    press(w, d.getElementById('tz'), 'click');
    r.pressCoded = d.getElementById('tz').getAttribute('href') === f(LINKS[0]);
    press(w, d.querySelector('#tzicon path'), 'pointerdown');
    r.pressIcon = d.getElementById('tzicon').getAttribute('href') === 'https://trainz.com/products/x?variant=2&ref=TEST1#specs';
    press(w, d.getElementById('cott'), 'click');
    press(w, d.getElementById('mail'), 'click');
    r.pressOther = d.getElementById('cott').getAttribute('href') === 'https://cornucopiaoftoytrains.com/boxcars/#6464'
      && d.getElementById('mail').getAttribute('href') === 'mailto:a@b.c';
    // the link's own handler stops the event (wizard-suggestions.js refA does)
    const st = d.getElementById('stop');
    st.addEventListener('click', ev => ev.stopPropagation());
    st.onclick = ev => ev.stopPropagation();
    press(w, st, 'click');
    r.pressStopped = st.getAttribute('href') === 'https://www.trainz.com/products/stopper?ref=TEST1';
    // middle-click and right-click / long-press menus open the href too
    const w2 = page(TEST_TABLE, storeSrc);
    press(w2, w2.document.getElementById('tz'), 'auxclick', { button: 1 });
    press(w2, w2.document.getElementById('cott'), 'contextmenu', { button: 2 });
    const w3 = page(TEST_TABLE, storeSrc);
    press(w3, w3.document.getElementById('tz'), 'contextmenu', { button: 2 });
    r.pressMenus = w2.document.getElementById('tz').getAttribute('href') === f(LINKS[0])
      && w3.document.getElementById('tz').getAttribute('href') === f(LINKS[0])
      && w2.document.getElementById('cott').getAttribute('href') === LINKS[7];
    // pressing again never adds it twice
    press(w, d.getElementById('tz'), 'click');
    r.pressTwice = d.getElementById('tz').getAttribute('href') === f(LINKS[0]);
  } catch (e) { r.err = String(e && e.stack || e); }
  return r;
}

// ── A — the setting ─────────────────────────────────────────────────────────
section('A  ONE setting, in config.js, shipped blank');
{
  const tbl = shippedTable(CONFIG);
  ok('A1 config.js defines RR_AFFILIATE exactly once', (CONFIG.match(/const RR_AFFILIATE\s*=/g) || []).length === 1);
  let t = null;
  try { t = new Function(tbl + '\nreturn RR_AFFILIATE;')(); } catch (e) { t = null; }
  ok('A2 the table parses and holds a Trainz entry for trainz.com', Array.isArray(t) && t.some(e => e.store === 'Trainz' && e.host === 'trainz.com'), JSON.stringify(t));
  const blank = Array.isArray(t) && t.every(e => !String(e.wrap || '').trim()
    && Object.keys(e.params || {}).every(k => !String(e.params[k] == null ? '' : e.params[k]).trim()));
  ok('A3 shipped BLANK — no code and no wrap yet (Brad has not signed up)', blank, JSON.stringify(t));
  ok('A4 every entry has a host and the four fields', Array.isArray(t) && t.every(e => e.host && 'params' in e && 'wrap' in e && e.store));
}

const R = run(STORE);
if (R.err) ok('harness ran', false, R.err);

section('B  blank code = every link leaves unchanged');
ok('B1 as shipped, every address in the list comes back as the very same value', R.blankSame === true);

section('C  with a test code');
ok('C1 www.trainz.com diagram link carries the code', R.c1 === true);
ok('C2 the address keeps its own query and #anchor', R.c2 === true);
ok('C3 a sub-address of trainz.com (shop.) counts as the store', R.c3 === true);
ok('C4 capitals in the address still match', R.c4 === true);
ok('C5 never added twice (already there / run twice)', R.notTwice === true);
ok('C6 look-alikes (nottrainz.com, trainz.com.example.org) are NOT the store', R.lookalike === true);
ok('C7 other sites, Google searches, mail, relative, empty, broken: unchanged', R.others === true);
ok('C8 rrAffiliateStoreFor names the store and nothing else', R.storeFor === true);
ok('C9 a network "wrap" address works, once, and only for the store', R.wrap === true);

section('D  the checkpoint');
ok('D1 window.open hands the store-coded address on, other arguments as given', R.openCoded === true);
ok('D2 window.open to any other site is passed through untouched', R.openOther === true);
ok('D3 window.open() with no address still works', R.openEmpty === true);
ok('D4 installing a second time does nothing (no double wrap)', R.installOnce === true && R.openSingleWrap === true);
ok('D5 a pressed store link is coded before it opens', R.pressCoded === true);
ok('D6 a press on an icon inside the link counts', R.pressIcon === true);
ok('D7 pressed links to other sites / mail are untouched', R.pressOther === true);
ok('D8 coded even when the link\'s own handler stops the event', R.pressStopped === true);
ok('D9 middle-click and right-click / long-press menus get it too', R.pressMenus === true);
ok('D10 pressing again never adds it twice', R.pressTwice === true);

// ── E — load order ───────────────────────────────────────────────────────────
section('E  loaded first, cached for offline');
{
  const srcs = [...INDEX.matchAll(/<script[^>]*\ssrc="\.\/([^"?]+)/g)].map(m => m[1]);
  ok('E1 index.html loads config.js first and store-links.js second', srcs[0] === 'config.js' && srcs[1] === 'store-links.js', srcs.slice(0, 3).join(', '));
  ok('E2 store-links.js is loaded exactly once', srcs.filter(s => s === 'store-links.js').length === 1);
  ok('E3 the service worker caches store-links.js', /'\.\/store-links\.js'/.test(SW));
  ok('E4 store-links.js installs itself on load', /\n\s*rrStoreLinksInstall\(window\);/.test(STORE));
}

// ── F — no other way out ─────────────────────────────────────────────────────
// Each scan is a function of the file set, so section P can plant an offender.
function appFiles() {
  const out = {};
  fs.readdirSync(APPDIR).filter(f => /\.js$/.test(f) || f === 'index.html').forEach(f => { out[f] = APP(f); });
  return out;
}
// A page-changing location write is allowed only for these known, non-store
// destinations (each checked by what the same line sends the page to).
const LOCATION_OK = [/_oauthRedirectUrl\(/, /'geo:/, /maps\.apple\.com/, /mailto:/, /_rrFeedbackMailto\(/, /rrAffiliateUrl\(/];
// A tab opened blank first (so a pop-up blocker allows it) and sent to its
// address after an await. Each one named here goes ONLY to Google — never a
// store — so it needs no store code. A NEW one fails F1 until it either passes
// its address through rrAffiliateUrl( or is added here with its reason.
const TAB_OK = [
  ['drive.js', /tab\.location = s\.pickerUri;/],              // the Google Photos picker
  ['photo-inbox-tools.js', /tab\.location = url;/],           // Google Lens (lens.google.com/uploadbyurl)
];
function scanLocation(files) {
  const bad = [];
  Object.keys(files).forEach(f => {
    const src = code(files[f]);
    // names that hold a window this file opened: tab = window.open(...)
    const tabs = [...src.matchAll(/([A-Za-z_$][\w$]*)\s*=\s*window\.open\(/g)].map(m => m[1]);
    src.split('\n').forEach((l, i) => {
      const hit = /(^|[^.\w$])location(\.href)?\s*=(?!=)/.test(l) && !/\b(const|let|var)\s+location\b/.test(l)
        || /\b(window|document|top|self|parent)\.location(\.href)?\s*=(?!=)/.test(l)
        || /\blocation\.(assign|replace)\s*\(/.test(l)
        || tabs.some(t => new RegExp('(^|[^.\\w$])' + t.replace(/\$/g, '\\$') + '\\.location(\\.href)?\\s*=(?!=)').test(l));
      if (!hit) return;
      if (LOCATION_OK.some(re => re.test(l))) return;
      if (TAB_OK.some(([file, re]) => file === f && re.test(l))) return;
      bad.push(f + ':' + (i + 1) + '  ' + l.trim().slice(0, 90));
    });
  });
  return bad;
}
// A link built in script and .click()ed never touches the page, so no press
// listener sees it: it must be a file save (download).
function scanDetachedClicks(files) {
  const bad = [];
  Object.keys(files).forEach(f => {
    const lines = code(files[f]).split('\n');
    lines.forEach((l, i) => {
      const m = l.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*document\.createElement\(\s*['"]a['"]\s*\)/);
      if (!m) return;
      const v = m[1];
      const win = lines.slice(i, i + 12).join('\n');
      const clicked = new RegExp('\\b' + v.replace(/\$/g, '\\$') + '\\.click\\(\\)').test(win);
      const appended = new RegExp('appendChild\\(\\s*' + v.replace(/\$/g, '\\$') + '\\s*\\)').test(win);
      const download = new RegExp('\\b' + v.replace(/\$/g, '\\$') + '\\.download\\s*=').test(win);
      if (clicked && !appended && !download) bad.push(f + ':' + (i + 1));
    });
  });
  return bad;
}
function scanOpenReplaced(files) {
  return Object.keys(files).filter(f => f !== 'store-links.js' && /\bwindow\.open\s*=(?!=)/.test(code(files[f])));
}
function scanTableReaders(files) {
  return Object.keys(files).filter(f => f !== 'store-links.js' && f !== 'config.js' && /\bRR_AFFILIATE\b/.test(code(files[f])));
}
function scanSwWindows(sw) { return /openWindow\s*\(/.test(code(sw)); }

section('F  no other way out of the app');
const FILES = appFiles();
ok('F0 the scan reads the whole app folder (readdirSync), index.html included', Object.keys(FILES).length > 50 && 'index.html' in FILES && 'store-links.js' in FILES, Object.keys(FILES).length + ' files');
const loc = scanLocation(FILES);
ok('F1 page-changing location writes are only the known non-store ones', loc.length === 0, loc.join(' | '));
ok('F1b … and the scan does see the known ones (it is reading)', (() => {
  let seen = 0;
  Object.keys(FILES).forEach(f => code(FILES[f]).split('\n').forEach(l => { if (/\blocation\.href\s*=(?!=)/.test(l)) seen++; }));
  return seen >= 3;
})());
const det = scanDetachedClicks(FILES);
ok('F2 a script-built link clicked off the page is always a file save', det.length === 0, det.join(', '));
ok('F2b … and the scan does find the app\'s own file-save links', (() => {
  let n = 0;
  Object.keys(FILES).forEach(f => { n += (code(FILES[f]).match(/document\.createElement\(\s*['"]a['"]\s*\)/g) || []).length; });
  return n >= 5;
})());
const op = scanOpenReplaced(FILES);
ok('F3 nothing but store-links.js replaces window.open', op.length === 0, op.join(', '));
const tr = scanTableReaders(FILES);
ok('F4 nothing but store-links.js reads RR_AFFILIATE', tr.length === 0, tr.join(', '));
ok('F5 the service worker opens no windows of its own', !scanSwWindows(SW));
ok('F6 the parts-diagram button still opens trainz.com through window.open', /window\.open\(\\'https:\/\/www\.trainz\.com\/pages\/parts-diagram\//.test(APP('maintenance.js')));

// ── P — planted offenders ────────────────────────────────────────────────────
section('P  planted offenders turn their check red');
function plant(src, from, to) {
  if (src.split(from).length !== 2) return null;   // the anchor must be unique
  return src.replace(from, to);
}
{
  const p1 = plant(STORE, "host === h || host.slice(-(h.length + 1)) === '.' + h", 'host.indexOf(h) >= 0');
  const r1 = p1 ? run(p1) : {};
  ok('P1 matching the store by "contains" lets look-alikes in → C6 red', p1 && r1.lookalike === false);

  const p2 = plant(STORE, 'if (!u.searchParams.has(k)) u.searchParams.set', 'u.searchParams.append');
  const r2 = p2 ? run(p2) : {};
  ok('P2 dropping the "never twice" guard → C5 red', p2 && r2.notTwice === false);

  const p3 = plant(STORE, 'win.addEventListener(type, _rrAffOnPress, true);', 'win.addEventListener(type, _rrAffOnPress, false);');
  const r3 = p3 ? run(p3) : {};
  ok('P3 listening after the link instead of before (bubble) → D8 red', p3 && r3.pressStopped === false);

  const p4 = plant(STORE, "if (!keys.length && !wrap) return url;", "if (!keys.length && !wrap) return new URL(String(url).trim()).toString();");
  const r4 = p4 ? run(p4) : {};
  ok('P4 a blank code that still rewrites the address → B1 red', p4 && r4.blankSame === false);

  const p5 = plant(STORE, "['pointerdown', 'click', 'auxclick', 'contextmenu']", "['click']");
  const r5 = p5 ? run(p5) : {};
  ok('P5 only listening for a plain click → D6/D9 red', p5 && (r5.pressMenus === false || r5.pressIcon === false));

  const p6 = plant(STORE, 'if (!win || win._rrStoreLinksOn) return false;', 'if (!win) return false;');
  const r6 = p6 ? run(p6) : {};
  ok('P6 installing without the once-only guard → D4 red', p6 && r6.installOnce === false);

  const F7 = Object.assign({}, FILES, { 'planted.js': "function goStore(){ location.href = 'https://www.trainz.com/x'; }\n" });
  ok('P7 a location write to a store → F1 red', scanLocation(F7).some(s => /^planted\.js/.test(s)));
  const F7c = Object.assign({}, FILES, { 'planted.js': "// location.href = 'https://www.trainz.com/x';\n" });
  ok('P7b … but not when it is commented out', !scanLocation(F7c).some(s => /^planted\.js/.test(s)));
  const F7t = Object.assign({}, FILES, { 'planted.js': "async function go(){\n  var tab = window.open('', '_blank');\n  await 1;\n  tab.location = 'https://www.trainz.com/x';\n}\n" });
  ok('P7c a blank tab sent to a store afterwards → F1 red', scanLocation(F7t).some(s => /^planted\.js/.test(s)));
  const F7d = Object.assign({}, FILES, { 'planted.js': "function keep(pd, loc){ pd.location = loc; wizard.data.location = loc; const location = 'Shelf 3'; }\n" });
  ok('P7d … a saved item\'s storage "location" field is not a page change', !scanLocation(F7d).some(s => /^planted\.js/.test(s)));
  const F7e = Object.assign({}, FILES, { 'drive.js': FILES['drive.js'].replace('tab.location = s.pickerUri;', "tab.location = 'https://www.trainz.com/x';") });
  ok('P7e … and a known Google tab re-aimed at a store → F1 red', FILES['drive.js'].indexOf('tab.location = s.pickerUri;') >= 0 && scanLocation(F7e).some(s => /^drive\.js/.test(s)));

  const F8 = Object.assign({}, FILES, { 'planted.js': "function go(u){\n  const a = document.createElement('a');\n  a.href = u; a.target = '_blank';\n  a.click();\n}\n" });
  ok('P8 a script-built link clicked off the page → F2 red', scanDetachedClicks(F8).some(s => /^planted\.js/.test(s)));
  const F8b = Object.assign({}, FILES, { 'planted.js': "function save(u){\n  const a = document.createElement('a');\n  a.href = u; a.download = 'x.csv';\n  a.click();\n}\n" });
  ok('P8b … a file save is fine', !scanDetachedClicks(F8b).some(s => /^planted\.js/.test(s)));

  const F9 = Object.assign({}, FILES, { 'planted.js': "window.open = function (u) { return null; };\n" });
  ok('P9 a second window.open replacement → F3 red', scanOpenReplaced(F9).indexOf('planted.js') >= 0);

  const F10 = Object.assign({}, FILES, { 'planted.js': "var code = RR_AFFILIATE[0].params.ref;\n" });
  ok('P10 a second reader of the store codes → F4 red', scanTableReaders(F10).indexOf('planted.js') >= 0);

  ok('P11 a service worker that opens windows → F5 red', scanSwWindows(SW + "\nself.addEventListener('notificationclick', e => clients.openWindow('https://www.trainz.com/'));\n"));

  const cfgPlant = CONFIG.replace("params: {}, wrap: ''", "params: { ref: 'X1' }, wrap: ''");
  let t = null; try { t = new Function(shippedTable(cfgPlant) + '\nreturn RR_AFFILIATE;')(); } catch (e) { t = null; }
  ok('P12 a code typed into the table is seen as "not blank" (A3 would go red)', cfgPlant !== CONFIG && Array.isArray(t)
    && t.some(e => Object.keys(e.params || {}).some(k => String(e.params[k]).trim())));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
