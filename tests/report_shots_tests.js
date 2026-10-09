// ════════════════════════════════════════════════════════════════════════
// report_shots_tests.js — v0.9.1905 (security review #6, Brad "yes" 2026-10-09)
//
// PROBLEM-REPORT SCREENSHOTS ARE SHARED WITH THE OWNERS ONLY. Before: each
// screenshot was made "anyone with the link can view" — forward the report
// email and the picture (someone's collection, values, name) goes with it.
// Now it is shared with RR_OWNER_EMAILS (config.js: support@ and the inbox it
// forwards to — [stated] Brad "yes" to "my two addresses ... still only you"),
// quietly first, with Google's notice email as the second try, and if Google
// refuses there is NO public-link fallback: the user is asked to attach it.
//
//   A. the sweep: every place in the app that makes a file public is on ONE
//      short list, each on purpose. A new one fails here until it is listed.
//   B. the REAL _uploadShots, against a stand-in Google Drive.
//   C. the guards can fail: the v0.9.1904 error-report.js goes red, and a
//      planted public-link call goes red in A.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');
const APPDIR = path.join(__dirname, '..', 'app');
const SRC = fs.readFileSync(path.join(APPDIR, 'error-report.js'), 'utf8');
const CONFIG = fs.readFileSync(path.join(APPDIR, 'config.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('could not find ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + sig);
}

// ── A. the public-link places ───────────────────────────────────────────
// Each entry: the function, and why it has to be public.
const PUBLIC_ON_PURPOSE = {
  rrShareOpenPhoto:    'share.js — a photo the user chose to share; expires on the timer they picked (v1303)',
  _uploadShareToDrive: 'share.js — a shared PDF list a customer must open; stamped so it can be found and expired (v1408)',
  _rrLensPublish:      'drive.js — the photo-reader copy Google Lens must fetch; trashed ten minutes later',
};
// every "make this public" call: a permission body with type 'anyone'
function publicPlaces(files) {
  const out = [];
  files.forEach(f => {
    const src = typeof f === 'string' ? fs.readFileSync(path.join(APPDIR, f), 'utf8') : f.src;
    const name = typeof f === 'string' ? f : f.name;
    const re = /type\s*:\s*['"]anyone['"]/g;
    let m;
    while ((m = re.exec(src))) {
      // the nearest function above it
      const before = src.slice(0, m.index);
      const fns = [...before.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)];
      out.push({ file: name, fn: fns.length ? fns[fns.length - 1][1] : '(top level)' });
    }
  });
  return out;
}
const APP_FILES = fs.readdirSync(APPDIR).filter(f => f.endsWith('.js'));
section('A. every public-link place is on the list, on purpose');
const places = publicPlaces(APP_FILES);
ok('found the public-link places (scan sanity: at least the three known)', places.length >= 3, places);
places.forEach(p => ok(p.file + ' → ' + p.fn + ' is on the list', !!PUBLIC_ON_PURPOSE[p.fn], p));
Object.keys(PUBLIC_ON_PURPOSE).forEach(fn => ok('listed "' + fn + '" still exists (no dead entries)', places.some(p => p.fn === fn)));
ok('error-report.js makes nothing public', !places.some(p => p.file === 'error-report.js'), places.filter(p => p.file === 'error-report.js'));
const planted = publicPlaces([{ name: 'planted.js', src: "async function _leakIt(id){ await fetch(u, { body: JSON.stringify({ role: 'reader', type: 'anyone' }) }); }" }]);
ok('a planted public-link call is caught (it names an unlisted function)', planted.length === 1 && !PUBLIC_ON_PURPOSE[planted[0].fn], planted);

// ── B. the real _uploadShots against a stand-in Drive ───────────────────
// script: how the stand-in answers each permission POST, in order (true = ok)
function device(src, opts) {
  opts = opts || {};
  const calls = [];
  const permAnswers = (opts.perm || []).slice();
  const sb = {
    console: { log() {}, warn() {}, error() {} },
    JSON, Object, String, Array, Promise, Date,
    Blob: class { constructor(parts, o) { this.parts = parts; this.type = o && o.type; } },
    FormData: class { constructor() { this.f = []; } append(k, v) { this.f.push([k, v]); } },
    accessToken: opts.token === undefined ? 'ya29.t' : opts.token,
    fetch: async (url, o) => {
      const body = o && typeof o.body === 'string' ? JSON.parse(o.body) : null;
      calls.push({ url, body });
      if (/upload\/drive/.test(url)) return { ok: true, json: async () => (opts.uploadFails ? {} : { id: 'F' + calls.length }) };
      if (/\/permissions/.test(url)) { const a = permAnswers.length ? permAnswers.shift() : true; return { ok: a, json: async () => ({}) }; }
      return { ok: true, json: async () => ({}) };
    },
  };
  vm.createContext(sb);
  let code = '';
  if (opts.owners !== null) code += "const RR_OWNER_EMAILS = " + JSON.stringify(opts.owners || ['bhale@ipd-llc.com', 'support@therailroster.com']) + ";\n";
  if (src.indexOf('async function _shareShotWithOwners(') >= 0) code += grab(src, 'async function _shareShotWithOwners(') + '\n';
  code += grab(src, 'async function _uploadShots(files, onProgress)') + '\nthis._uploadShots = _uploadShots;';
  vm.runInContext(code, sb);
  sb.calls = calls;
  sb.perms = () => calls.filter(c => /\/permissions/.test(c.url));
  return sb;
}
const SHOT = { name: 'shot.png' };

(async function main() {
  section('B. the real _uploadShots');
  {
    const d = device(SRC);
    const links = await d._uploadShots([SHOT, SHOT], null);
    const p = d.perms();
    ok('two screenshots → two links', links.length === 2 && links.every(l => /^https:\/\/drive\.google\.com\/file\/d\/F\d+\/view$/.test(l)), links);
    ok('NO screenshot is made public (no type "anyone")', p.every(c => c.body && c.body.type !== 'anyone'), p.map(c => c.body));
    ok('each is shared with exactly the owners list — both addresses', p.length === 4 && p.every(c => c.body.type === 'user' && c.body.role === 'reader') &&
       p.filter(c => c.body.emailAddress === 'bhale@ipd-llc.com').length === 2 && p.filter(c => c.body.emailAddress === 'support@therailroster.com').length === 2, p.map(c => c.body));
    ok('…quietly (no "shared with you" email)', p.every(c => /sendNotificationEmail=false/.test(c.url)), p.map(c => c.url));
  }
  {
    // Google wants the notice email for one address: quiet try refused, second try with the notice lands
    const d = device(SRC, { perm: [false, true, true] });
    const links = await d._uploadShots([SHOT], null);
    const p = d.perms();
    ok('a refused quiet share is retried once WITH the notice email', p.length === 3 && /sendNotificationEmail=false/.test(p[0].url) && /sendNotificationEmail=true/.test(p[1].url), p.map(c => c.url));
    ok('…and the link is given', links.length === 1 && /^https:/.test(links[0]), links);
  }
  {
    const d = device(SRC, { perm: [false, false, true] });
    const links = await d._uploadShots([SHOT], null);
    ok('one owner refused both ways, the other took it → the link is given (one of you can open it)', links.length === 1 && /^https:/.test(links[0]), links);
  }
  {
    const d = device(SRC, { perm: [false, false, false, false] });
    const links = await d._uploadShots([SHOT], null);
    const p = d.perms();
    ok('Google refuses every share → NO link (never a public fallback)', links.length === 1 && !/^https?:/.test(links[0]) && /attach it/.test(links[0]), links);
    ok('…and nothing was ever made public', p.every(c => c.body.type !== 'anyone'), p.map(c => c.body));
    ok('…two tries per owner, no loop', p.length === 4, p.length);
  }
  {
    const d = device(SRC, { owners: [] });
    const links = await d._uploadShots([SHOT], null);
    ok('an empty owners list → no link, the user attaches it (never public)', links.length === 1 && !/^https?:/.test(links[0]) && d.perms().length === 0, links);
  }
  {
    const d = device(SRC, { token: null });
    const links = await d._uploadShots([SHOT], null);
    ok('not signed in → unchanged: "please attach the images yourself", nothing uploaded', links.length === 1 && /not signed in/.test(links[0]) && d.calls.length === 0, links);
    const d2 = device(SRC, { uploadFails: true });
    const l2 = await d2._uploadShots([SHOT], null);
    ok('an upload that fails → unchanged: "failed to upload", no share attempted', l2.length === 1 && /failed to upload/.test(l2[0]) && d2.perms().length === 0, l2);
  }
  ok('the owners list is ONE setting in config.js (both addresses)', /const RR_OWNER_EMAILS = \['bhale@ipd-llc\.com', 'support@therailroster\.com'\];/.test(CONFIG));
  ok('the report screen says who can open the pictures', /only The Rail Roster\\u2019s support team can open them/.test(SRC));
  ok('…and no longer says the report "carries the links" as if anyone could follow them', SRC.indexOf('the report carries the links.') < 0);

  // ── C. the guard can fail ─────────────────────────────────────────────
  section('C. the guard can fail (v0.9.1904 error-report.js)');
  let old = null;
  try { old = execSync('git show 0c9fbe3:app/error-report.js', { cwd: path.join(__dirname, '..'), stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch (e) {}
  if (old) {
    const d = device(old);
    await d._uploadShots([SHOT], null);
    ok('v0.9.1904 made the screenshot public → B would be red', d.perms().some(c => c.body && c.body.type === 'anyone'), d.perms().map(c => c.body));
    ok('v0.9.1904 is caught by the sweep in A too', publicPlaces([{ name: 'error-report.js', src: old }]).some(p => !PUBLIC_ON_PURPOSE[p.fn]));
  } else {
    ok('old error-report.js available from git (0c9fbe3) — skipped in a shallow clone', true);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed  (report_shots_tests)');
  process.exit(fail ? 1 : 0);
})();
