#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE NAME ON THE USER'S SHEET — v0.9.1994
// (real Chromium, REAL app.js / sheet-builder.js / prefs.js)
//
// Brad (2026-10-19, the support@ demo sheet): "it says The's, should be
// Collector". The support@ Google account is named "The Rail Roster"; the
// Dashboard tab and the file title took Google's first word directly and
// skipped rrGreetName, so the name typed in Preferences never reached them.
//
//   N1  a Google name whose first word is an article (The / A / An) is not a
//       name: the app says "Collector" — "Annie" / "Andrew" still are names
//   N2  the name typed in Preferences wins, on the greeting and the sheet
//   N3  the Dashboard tab's B2 is rrCollectionTitle ("Collector's Collection")
//   N4  the file title is corrected when it is still the app's own wording —
//       a title the user typed is left alone, a correct one is not rewritten
//   N5  a name saved in Preferences renames the sheet and rewrites B2
//   S   scan: "'s Collection" is built ONLY in rrCollectionTitle
//   P   PLANTED: the shipped v0.9.1993 files (git 897a266c) — so this can fail
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), cp = require('child_process');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  sheet_name_1994_tests needs playwright and it is not installed.'); process.exit(1); }
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
const OLD_SHA = '897a266c';
function gitShow(f) {
  try { return cp.execSync('git show ' + OLD_SHA + ':' + f, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; }
}

let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }

// ── S: the scan (source only) ───────────────────────────────────────────────
// Anything that BUILDS "<something>'s Collection" from a name — a template
// `${x}'s Collection` or a + "'s Collection" join — outside rrCollectionTitle.
function offenders(files) {
  const out = [];
  Object.keys(files).forEach(function (f) {
    const lines = String(files[f] || '').split('\n');
    let inOwner = false;
    lines.forEach(function (l, i) {
      if (/^function rrCollectionTitle\(/.test(l)) inOwner = true;
      else if (inOwner && /^}/.test(l)) { inOwner = false; return; }
      if (inOwner) return;
      if (/^\s*\/\//.test(l)) return;
      if (/\}'s Collection/.test(l) || /\+\s*["']'s Collection["']/.test(l) || /\+\s*"'s Collection"/.test(l)) out.push(f + ':' + (i + 1));
    });
  });
  return out;
}
const now = {}, old = {};
fs.readdirSync(APP).filter(f => f.endsWith('.js')).forEach(f => { now[f] = fs.readFileSync(path.join(APP, f), 'utf8'); });
const off = offenders(now);
T('S1 "\'s Collection" is built only in rrCollectionTitle (app.js)', off.length === 0, off);
const oldSB = gitShow('app/sheet-builder.js'), oldApp = gitShow('app/app.js');
if (!oldSB || !oldApp) T('S0 the v0.9.1993 files could be read from git (' + OLD_SHA + ')', false, 'git show failed');
else {
  const pOff = offenders({ 'sheet-builder.js': oldSB, 'app.js': oldApp });
  T('S2 PLANTED: the scan catches v0.9.1993 (Dashboard + file title built from Google\'s first word)', pOff.length >= 2, pOff);
}

async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    if (o.old && base.endsWith('/app/app.js')) return r.fulfill({ body: o.old.app, contentType: 'application/javascript' });
    if (o.old && base.endsWith('/app/sheet-builder.js')) return r.fulfill({ body: o.old.sb, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(() => {
    try { _aiUsageMarkSeen(); } catch (e) {}
    try { localStorage.clear(); } catch (e) {}
    window._rrPrefsSyncDone = true;
    window.rrPrefsQueuePush = function () {};
    state.personalSheetId = 'SHEET1';
    accessToken = 'TEST-PASS';   // a stand-in sign-in pass (the rename needs one)
    // A stand-in Google: Drive file title + Sheets writes are recorded.
    window.__title = 'The Rail Roster - The\'s Collection';
    window.__patched = []; window.__b2 = [];
    window.fetch = async function (url, opt) {
      url = String(url);
      const j = (o) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });
      if (url.indexOf('/drive/v3/files/SHEET1') !== -1) {
        if (opt && opt.method === 'PATCH') { const n = JSON.parse(opt.body).name; window.__patched.push(n); window.__title = n; return j({ id: 'SHEET1' }); }
        return j({ name: window.__title });
      }
      if (url.indexOf('sheets.googleapis.com') !== -1 && url.indexOf('fields=sheets.properties') !== -1)
        return j({ sheets: [{ properties: { sheetId: 7, title: 'Dashboard' } }, { properties: { sheetId: 8, title: 'My Collection' } }] });
      return j({});
    };
    window.sheetsSetupUpdate = async function (id, range, values) {
      if (/Dashboard!A1/.test(range)) window.__b2.push(values[1][1]);
      return {};
    };
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
  });
  return { pg, ctx, errs };
}
const who = (pg, google, typed) => pg.evaluate(([g, t]) => {
  state.user = { name: g, email: 'x@example.com' };
  if (t == null) localStorage.removeItem('lv_display_name'); else localStorage.setItem('lv_display_name', t);
  return { greet: rrGreetName(), title: _getPersonalSheetName() };
}, [google, typed]);
const dash = (pg) => pg.evaluate(async () => {
  window.__b2 = [];
  try { await _writeDashboardContent('SHEET1'); } catch (e) { return 'ERR ' + e.message; }
  return window.__b2[0];
});
const rename = (pg, title) => pg.evaluate(async (t) => {
  window.__title = t; window.__patched = [];
  await _maybeRenamePersonalSheet();
  return { patched: window.__patched.slice(), title: window.__title };
}, title);

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let r = await open(browser, {});

  // ── N1 ───────────────────────────────────────────────────────────────────
  let a = await who(r.pg, 'The Rail Roster', null);
  T('N1 Google name "The Rail Roster": the app says Collector', a.greet === 'Collector', a);
  T('N1 …and the file title is "The Rail Roster - Collector\'s Collection"', a.title === "The Rail Roster - Collector's Collection", a);
  a = await who(r.pg, 'A Smith Family', null);
  T('N1 "A Smith Family" → Collector', a.greet === 'Collector', a);
  a = await who(r.pg, 'an  Other', null);
  T('N1 "an Other" (any case, extra spaces) → Collector', a.greet === 'Collector', a);
  a = await who(r.pg, 'Annie Hale', null);
  T('N1 "Annie Hale" is a name → Annie (a whole word, not a prefix)', a.greet === 'Annie', a);
  a = await who(r.pg, 'Theo Brown', null);
  T('N1 "Theo Brown" → Theo', a.greet === 'Theo', a);
  a = await who(r.pg, 'Brad Hale', null);
  T('N1 "Brad Hale" → Brad, "Brad\'s Collection"', a.greet === 'Brad' && a.title === "The Rail Roster - Brad's Collection", a);
  a = await who(r.pg, '', null);
  T('N1 no Google name → Collector', a.greet === 'Collector', a);

  // ── N2 ───────────────────────────────────────────────────────────────────
  a = await who(r.pg, 'The Rail Roster', 'Collector');
  T('N2 the name typed in Preferences wins ("Collector")', a.greet === 'Collector' && a.title === "The Rail Roster - Collector's Collection", a);
  a = await who(r.pg, 'The Rail Roster', 'Brad H.');
  T('N2 the name typed in Preferences wins ("Brad H.")', a.greet === 'Brad H.' && a.title === "The Rail Roster - Brad H.'s Collection", a);

  // ── N3 the Dashboard tab ─────────────────────────────────────────────────
  await who(r.pg, 'The Rail Roster', null);
  let b2 = await dash(r.pg);
  T('N3 Dashboard B2 for "The Rail Roster" = "Collector\'s Collection"', b2 === "Collector's Collection", b2);
  await who(r.pg, 'The Rail Roster', 'Brad H.');
  b2 = await dash(r.pg);
  T('N3 Dashboard B2 follows the Preferences name', b2 === "Brad H.'s Collection", b2);

  // ── N4 the file title ────────────────────────────────────────────────────
  await who(r.pg, 'The Rail Roster', null);
  let n = await rename(r.pg, "The Rail Roster - The's Collection");
  T('N4 "The Rail Roster - The\'s Collection" is renamed to "…Collector\'s Collection"', n.patched.length === 1 && n.title === "The Rail Roster - Collector's Collection", n);
  n = await rename(r.pg, "The Rail Roster - Collector's Collection");
  T('N4 an already-right title is not rewritten', n.patched.length === 0, n);
  n = await rename(r.pg, 'My Lionel Trains');
  T('N4 a title the user typed is left alone', n.patched.length === 0 && n.title === 'My Lionel Trains', n);
  n = await rename(r.pg, "The Boxcar Files - The's Collection");
  T('N4 the old Boxcar Files title is still renamed', n.patched.length === 1 && n.title === "The Rail Roster - Collector's Collection", n);
  const waits = await r.pg.evaluate(async () => {
    window._rrPrefsSyncDone = false; window.__title = "The Rail Roster - The's Collection"; window.__patched = [];
    const p = _maybeRenamePersonalSheet();
    await new Promise(r => setTimeout(r, 600));
    const before = window.__patched.length;
    localStorage.setItem('lv_display_name', 'Brad H.');   // the account's name arrives
    window._rrPrefsSyncDone = true;
    await p;
    return { before, after: window.__patched.slice() };
  });
  T('N4 the rename waits for the account\'s settings, then uses the name they bring', waits.before === 0 && waits.after.join() === "The Rail Roster - Brad H.'s Collection", waits);

  // ── N5 a name saved in Preferences ───────────────────────────────────────
  const n5 = await r.pg.evaluate(async () => {
    localStorage.removeItem('lv_display_name');
    window.__title = "The Rail Roster - Collector's Collection"; window.__patched = []; window.__b2 = [];
    _prefsSetDisplayName('Brad');
    await new Promise(r => setTimeout(r, 2800));
    return { patched: window.__patched.slice(), b2: window.__b2.slice() };
  });
  T('N5 saving "Brad" in Preferences renames the sheet', n5.patched.join() === "The Rail Roster - Brad's Collection", n5);
  T('N5 …and rewrites Dashboard B2', n5.b2.indexOf("Brad's Collection") !== -1, n5);
  T('page errors', r.errs.length === 0, r.errs);
  await r.ctx.close();

  // ── P planted ────────────────────────────────────────────────────────────
  if (oldSB && oldApp) {
    r = await open(browser, { old: { app: oldApp, sb: oldSB } });
    const p = await who(r.pg, 'The Rail Roster', null);
    T('P1 PLANTED: v0.9.1993 names the support@ sheet "The\'s Collection"', p.title === "The Rail Roster - The's Collection", p);
    await r.pg.evaluate(() => localStorage.setItem('lv_display_name', 'Collector'));
    const pb2 = await dash(r.pg);
    T('P2 PLANTED: v0.9.1993 writes "The\'s Collection" on the Dashboard even with "Collector" typed in Preferences', pb2 === "The's Collection", pb2);
    await r.ctx.close();
  }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
