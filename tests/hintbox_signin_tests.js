#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// hintbox_signin_tests.js — 2026-11-08 hintbox, item 6 (real Chromium, the REAL
// app from disk, Google's sign-in library stood in for)
//
// T-2026-11-05-03 (the testing chat, 2026-11-07 19:19 CT, Brad's Android phone):
// while he scrolled an item page, Google's "Select an account" box came up with
// the TEST account (bradhale5839@) pre-picked — the app was signed in as
// bhale@ipd-llc.com. Google offers first the account a request names in
// login_hint; with no name it offers the browser's own first account.
// THE ONE rule now: _rrWithHint (app-auth.js), applied in THE door every token
// request goes through (_rrWrapTokenClient) and by the redirect fallback —
// a request names the signed-in account unless the caller named one already or
// asked for Google's account chooser on purpose. Only the hint is added: never
// the scopes, never which account.
//
// A returning bhale@ whose pass has run out. Every way the app asks Google:
//   H1  the start-up renewal (pass ran out while the app was closed)
//   H2  the token keeper (heartbeat / back to the front / a save waiting)
//   H3  the retry on the next tap (the one that fires while scrolling a page)
//   H4  the Reconnect button, quiet ask AND its consent fallback
//   H5  the "tap to finish signing in" pill (write-outbox.js)
//   H6  an extra permission (Google Photos / full sheets) — its own client
//   H7  "Try again — tick the Drive box" (was hint-less: red on live main)
//   H8  THE door: a request with no hint gets the signed-in one; a request
//       that names an account keeps it (the account is never changed)
//   H9  the redirect fallback URL carries login_hint (was hint-less)
//   H10 "Continue with Google" still opens the plain account chooser (no hint)
//   H11 the scopes asked for are exactly as before
//   H12 a prompt list holding select_account ("consent select_account") keeps
//       the plain chooser (review, 2026-11-08)
//   H13 nobody signed in → no hint at all (review, 2026-11-08)
// With the quiet renewal on (the relay):
//   Q1  no device key yet → Google's one-time CODE window names bhale@
//   Q2  the relay cannot renew → the fallback window names bhale@
//   Q3  "an extra permission that lasts" → its CODE window names bhale@
// iPhone / iPad (the same code — no Apple-only sign-in road):
//   I1  start-up renewal and the door name bhale@ on an iPhone and an iPad
// PLANTED:
//   P1  the door without the hint → H7 and H8 red
//   P2  the redirect URL without the hint → H9 red
//   P3  no hint anywhere (door + every login_hint line) → every path red
//   P4  the chooser exclusion taken out → H10 and H12 red
//   P5  only an exact 'select_account' excluded → H12 red
//   P6  a hint taken from the saved lv_user when nobody is signed in → H13 red
//
// Run:  node tests/hintbox_signin_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  hintbox_signin_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const CFG = read('config.js');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

const BHALE = 'bhale@ipd-llc.com';
const EXTRA = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';

// Google's sign-in library, stood in for: every window and code window, with the
// client's own scope, is written down.
const GIS = `
window.__gis = { windows: [], codes: [], tokenCfgs: [] };
window.google = { accounts: { oauth2: {
  initTokenClient: function (cfg) { __gis.tokenCfgs.push(cfg); return { callback: cfg.callback, requestAccessToken: function (o) { __gis.windows.push({ scope: cfg.scope, o: JSON.parse(JSON.stringify(o || {})) }); } }; },
  initCodeClient: function (cfg) { return { requestCode: function () { __gis.codes.push({ login_hint: cfg.login_hint, scope: cfg.scope, ux_mode: cfg.ux_mode }); } }; }
} } };`;

const DEVICES = {
  computer: { viewport: { width: 1400, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', hasTouch: true, isMobile: true },
  iphone: { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', hasTouch: true, isMobile: true },
  ipad: { viewport: { width: 820, height: 1180 }, userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', hasTouch: true, isMobile: true },
};

async function boot(browser, o) {
  const ctx = await browser.newContext(DEVICES[o.device || 'phone']);
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(({ device }) => {
    try {
      localStorage.setItem('lv_user', JSON.stringify({ name: 'Brad', email: 'bhale@ipd-llc.com' }));
      localStorage.setItem('lv_personal_id', 'SID');
      localStorage.setItem('lv_token', 'OLD-PASS');
      localStorage.setItem('lv_token_expiry', String(Date.now() - 60000));   // ran out a minute ago
      if (device) localStorage.setItem('lv_renew_device', JSON.stringify({ device: 'DEV-1', email: 'bhale@ipd-llc.com' }));
    } catch (e) {}
  }, { device: !!o.key });
  await pg.route('**', r => {
    const u = r.request().url();
    if (u.startsWith('https://accounts.google.com/gsi/client')) return r.fulfill({ body: GIS, contentType: 'application/javascript' });
    // the relay: it cannot renew (an unknown answer) — the app must fall back to Google's window
    if (u.startsWith('https://script.google.com/')) return r.fulfill({ status: 200, body: '{"status":400,"message":"Unknown action"}', contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    if (!u.startsWith('file://')) return r.abort();
    const bare = u.split('?')[0];
    if (bare.endsWith('/app/config.js')) return r.fulfill({ body: CFG.replace(/const RR_QUIET_RENEW = '[a-z]+';/, "const RR_QUIET_RENEW = '" + (o.mode || 'off') + "';"), contentType: 'application/javascript' });
    for (const f of Object.keys(o.swap || {})) if (bare.endsWith('/app/' + f)) return r.fulfill({ body: o.swap[f], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.__gis && window.__gis.tokenCfgs.length > 0, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(2000);
  return { pg, ctx, errs };
}

// Everything the token client is asked on the window paths ('off' = no relay).
const windowPaths = pg => pg.evaluate(async () => {
  const S = ms => new Promise(r => setTimeout(r, ms));
  const G = window.__gis;
  const since = n => G.windows.slice(n).map(w => w.o);
  const out = {};
  out.boot = G.windows.slice(0, 1).map(w => w.o);
  out.mainScope = G.tokenCfgs[0] && G.tokenCfgs[0].scope;
  out.SCOPES = typeof SCOPES !== 'undefined' ? SCOPES : null;
  const expire = () => { localStorage.setItem('lv_token_expiry', String(Date.now() - 60000)); };
  // H3 the retry on the next tap
  expire(); window._rrTokenGestureArmed = false; window._rrTokenRenewing = false;
  let n = G.windows.length;
  _rrArmGestureRenew();
  document.body.click();
  await S(50);
  out.tap = since(n);
  // H2 the token keeper
  expire(); window._rrTokenRenewing = false;
  n = G.windows.length; rrEnsureFreshToken('heartbeat'); await S(50); out.keeper = since(n);
  // H5 the outbox pill
  n = G.windows.length; window._rrFinishSignIn(); await S(50); out.pill = since(n);
  // H6 an extra permission (its own client)
  n = G.windows.length; _rrRequestExtraScope('https://www.googleapis.com/auth/photospicker.mediaitems.readonly', function () {}); await S(50);
  out.extra = G.windows.slice(n);
  // H8 the door itself
  n = G.windows.length; tokenClient.requestAccessToken({ prompt: '' }); out.doorBare = since(n);
  n = G.windows.length; tokenClient.requestAccessToken({ prompt: '', login_hint: 'someone@else.com' }); out.doorNamed = since(n);
  n = G.windows.length; tokenClient.requestAccessToken({ prompt: 'consent' }); out.doorConsent = since(n);
  n = G.windows.length; tokenClient.requestAccessToken({ prompt: 'consent select_account' }); out.doorChooserList = since(n);
  // H9 the redirect fallback
  out.redirect = _oauthRedirectUrl('consent');
  out.redirectChooser = _oauthRedirectUrl('select_account');
  // H4 Reconnect: the quiet ask, then 6 s later the consent fallback
  expire(); window._rrTokenRenewing = false;
  n = G.windows.length; rrReconnectNow(); await S(6400); out.reconnect = since(n);
  // H7 "Try again — tick the Drive box"
  n = G.windows.length; _rrRetryScopeConsent(); out.retry = since(n);
  // H10 "Continue with Google"
  window._signInInFlight = false;
  n = G.windows.length; handleSignIn(); out.signIn = since(n);
  // H13 nobody signed in (state.user gone — the saved lv_user still in the browser)
  const keep = state.user; state.user = null;
  n = G.windows.length; tokenClient.requestAccessToken({ prompt: '' }); out.nobody = since(n);
  out.nobodyUrl = _oauthRedirectUrl('consent');
  state.user = keep;
  return out;
});

const quietPaths = pg => pg.evaluate(async () => {
  const S = ms => new Promise(r => setTimeout(r, ms));
  const G = window.__gis;
  const out = { bootCodes: G.codes.slice(), bootWindows: G.windows.map(w => w.o) };
  const n = G.codes.length;
  const started = _rrLinkLastingScope('https://www.googleapis.com/auth/spreadsheets', function () {});
  await S(50);
  out.lasting = { started, codes: G.codes.slice(n) };
  return out;
});

const hinted = (arr, who) => Array.isArray(arr) && arr.length > 0 && arr.every(o => o && o.login_hint === (who || BHALE));

function judgeWindows(w) {
  return {
    H1: hinted(w.boot) && w.boot[0].prompt === '',
    H2: hinted(w.keeper),
    H3: hinted(w.tap),
    H4: w.reconnect.length === 2 && hinted(w.reconnect) && w.reconnect[0].prompt === '' && w.reconnect[1].prompt === 'consent',
    H5: hinted(w.pill),
    H6: w.extra.length === 1 && w.extra[0].o.login_hint === BHALE,
    H7: hinted(w.retry) && w.retry[0].prompt === 'consent',
    H8: hinted(w.doorBare) && hinted(w.doorConsent) && hinted(w.doorNamed, 'someone@else.com'),
    H9: /[?&]login_hint=bhale%40ipd-llc\.com(&|$)/.test(w.redirect) && !/login_hint/.test(w.redirectChooser),
    H10: w.signIn.length === 1 && w.signIn[0].prompt === 'select_account' && !w.signIn[0].login_hint,
    H11: w.mainScope === w.SCOPES && w.extra.length === 1 && w.extra[0].scope === w.SCOPES + ' ' + EXTRA,
    H12: w.doorChooserList.length === 1 && w.doorChooserList[0].prompt === 'consent select_account' && !w.doorChooserList[0].login_hint,
    H13: w.nobody.length === 1 && !w.nobody[0].login_hint && !/login_hint/.test(w.nobodyUrl),
  };
}
const SAY = {
  H1: 'H1 the start-up renewal names bhale@',
  H2: 'H2 the token keeper (heartbeat / back to the front / a waiting save) names bhale@',
  H3: 'H3 the retry on the next tap — the one that fires while scrolling — names bhale@',
  H4: 'H4 Reconnect: the quiet ask AND its consent fallback both name bhale@',
  H5: 'H5 the "tap to finish signing in" pill names bhale@',
  H6: 'H6 an extra permission (its own client) names bhale@',
  H7: 'H7 "Try again — tick the Drive box" names bhale@ (was hint-less)',
  H8: 'H8 THE door: no hint → bhale@; a consent ask → bhale@; a request that names an account keeps it',
  H9: 'H9 the redirect fallback URL carries login_hint=bhale@ (never on the chooser)',
  H10: 'H10 "Continue with Google" still opens the plain account chooser — no hint, so any account can be picked',
  H11: 'H11 the scopes asked for are exactly as before (the app\'s own; app\'s own + the extra one)',
  H12: 'H12 a prompt LIST holding select_account (e.g. "consent select_account") is a chooser too — no hint',
  H13: 'H13 nobody signed in → the door and the redirect URL add no hint (never a remembered address)',
};

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    console.log('\n== H · every window path (Android phone) ==');
    let w;
    {
      const b = await boot(browser, { device: 'phone', mode: 'off' });
      w = await windowPaths(b.pg);
      const j = judgeWindows(w);
      for (const k of Object.keys(SAY)) T(SAY[k], j[k], w);
      T('Z  no page errors', b.errs.length === 0, b.errs);
      await b.ctx.close();
    }

    console.log('\n== Q · the quiet renewal (the relay) ==');
    {
      const b = await boot(browser, { device: 'phone', mode: 'all' });
      const q = await quietPaths(b.pg);
      T('Q1 no device key yet → Google\'s one-time CODE window names bhale@ (and no token window)', q.bootCodes.length === 1 && q.bootCodes[0].login_hint === BHALE && q.bootWindows.length === 0, q);
      T('Q3 "an extra permission that lasts" → its CODE window names bhale@', q.lasting.started === true && q.lasting.codes.length === 1 && q.lasting.codes[0].login_hint === BHALE, q.lasting);
      T('Z  no page errors', b.errs.length === 0, b.errs);
      await b.ctx.close();
    }
    {
      const b = await boot(browser, { device: 'phone', mode: 'all', key: true });
      await b.pg.waitForFunction(() => window.__gis.windows.length > 0, null, { timeout: 15000 }).catch(() => {});
      const q2 = await b.pg.evaluate(() => window.__gis.windows.map(x => x.o));
      T('Q2 the relay cannot renew → the fallback window names bhale@', hinted(q2) && q2[0].prompt === '', q2);
      await b.ctx.close();
    }

    console.log('\n== I · iPhone and iPad ==');
    for (const dev of ['iphone', 'ipad']) {
      const b = await boot(browser, { device: dev, mode: 'off' });
      const r = await b.pg.evaluate(() => {
        const G = window.__gis, n = G.windows.length;
        tokenClient.requestAccessToken({ prompt: '' });
        return { boot: G.windows.slice(0, 1).map(x => x.o), door: G.windows.slice(n).map(x => x.o) };
      });
      T('I1 ' + dev + ': the start-up renewal and the door name bhale@ (the same code, no Apple-only road)', hinted(r.boot) && hinted(r.door), r);
      await b.ctx.close();
    }

    console.log('\n== P · planted ==');
    const AUTH = read('app-auth.js');
    {
      const noDoor = AUTH.replace('      opts = _rrWithHint(opts);   // T-2026-11-05-03: always name the signed-in account', '      opts = opts || {};');
      const b = await boot(browser, { device: 'phone', mode: 'off', swap: { 'app-auth.js': noDoor } });
      const j = judgeWindows(await windowPaths(b.pg));
      T('P1 the door without the hint → H7 and H8 go red', noDoor !== AUTH && !j.H7 && !j.H8, j);
      await b.ctx.close();
    }
    {
      const noUrl = AUTH.replace("    (_hint ? '&login_hint=' + encodeURIComponent(_hint) : '') +\n", '');
      const b = await boot(browser, { device: 'phone', mode: 'off', swap: { 'app-auth.js': noUrl } });
      const j = judgeWindows(await windowPaths(b.pg));
      T('P2 the redirect URL without the hint → H9 goes red', noUrl !== AUTH && !j.H9, j);
      await b.ctx.close();
    }
    {
      const noChooser = AUTH.replace('  if (!o.login_hint && !chooser) {', '  if (!o.login_hint) {');
      const b = await boot(browser, { device: 'phone', mode: 'off', swap: { 'app-auth.js': noChooser } });
      const j = judgeWindows(await windowPaths(b.pg));
      T('P4 the chooser exclusion taken out → "Continue with Google" gets a hint: H10 and H12 go red', noChooser !== AUTH && !j.H10 && !j.H12, j);
      await b.ctx.close();
    }
    {
      const exact = AUTH.replace('  if (!o.login_hint && !chooser) {', "  if (!o.login_hint && o.prompt !== 'select_account') {");
      const b = await boot(browser, { device: 'phone', mode: 'off', swap: { 'app-auth.js': exact } });
      const j = judgeWindows(await windowPaths(b.pg));
      T('P5 only an exact \'select_account\' excluded → H12 goes red (H10 stays green)', exact !== AUTH && !j.H12 && j.H10, j);
      await b.ctx.close();
    }
    {
      const saved = AUTH.replace('    var h = _rrQuietUser();\n', "    var h = _rrQuietUser() || ((JSON.parse(localStorage.getItem('lv_user') || '{}') || {}).email || '');\n");
      const b = await boot(browser, { device: 'phone', mode: 'off', swap: { 'app-auth.js': saved } });
      const j = judgeWindows(await windowPaths(b.pg));
      T('P6 a hint taken from the saved lv_user when nobody is signed in → H13 goes red', saved !== AUTH && !j.H13, j);
      await b.ctx.close();
    }
    {
      // no hint anywhere: the door's fill reverted and every `login_hint: …` taken out
      const strip = s => s.replace(/login_hint: [^,}\n]+,?/g, '');
      const bare = strip(AUTH.replace('      opts = _rrWithHint(opts);   // T-2026-11-05-03: always name the signed-in account', '      opts = opts || {};'));
      const OUT = read('write-outbox.js'), bareOut = strip(OUT);
      const planted = bare !== AUTH && bareOut !== OUT && !/login_hint: /.test(bare) && !/login_hint: /.test(bareOut);
      const b = await boot(browser, { device: 'phone', mode: 'off', swap: { 'app-auth.js': bare, 'write-outbox.js': bareOut } });
      const j = judgeWindows(await windowPaths(b.pg));
      for (const k of ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8']) T('P3 no hint anywhere → ' + k + ' goes red', planted && !j[k], j);
      T('P3 …and the planted app still starts (the plant broke only the hint)', b.errs.length === 0, b.errs);
      await b.ctx.close();
      const q = await boot(browser, { device: 'phone', mode: 'all', swap: { 'app-auth.js': bare, 'write-outbox.js': bareOut } });
      const qq = await quietPaths(q.pg);
      T('P3 no hint anywhere → Q1 goes red', planted && !(qq.bootCodes.length === 1 && qq.bootCodes[0].login_hint === BHALE), qq);
      T('P3 no hint anywhere → Q3 goes red', planted && !(qq.lasting.codes.length === 1 && qq.lasting.codes[0].login_hint === BHALE), qq.lasting);
      await q.ctx.close();
      const k2 = await boot(browser, { device: 'phone', mode: 'all', key: true, swap: { 'app-auth.js': bare, 'write-outbox.js': bareOut } });
      await k2.pg.waitForFunction(() => window.__gis.windows.length > 0, null, { timeout: 15000 }).catch(() => {});
      const q2 = await k2.pg.evaluate(() => window.__gis.windows.map(x => x.o));
      T('P3 no hint anywhere → Q2 goes red', planted && q2.length > 0 && !hinted(q2), q2);
      await k2.ctx.close();
    }
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED  —  ' : 'ALL PASS  —  ') + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  suite crashed: ' + (e && e.stack || e)); console.log('FAILED  —  ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
