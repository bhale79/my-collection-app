#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE ACCOUNT CHECK — v0.9.1932
//
// Brad (2026-10-11): "i signed in using support@ on both my chrome users pages,
// bhale@ipd and support@railroster. both dashboards say collector, but the
// first one uses my bhale collection, the second one uses the support
// collection". The app remembered WHO used the browser (lv_user) but never
// asked whose pass Google handed back, so one account's pass ran under the
// other account's name, settings and saved sheet. Design Brad approved: check
// every pass against lv_user; a different account stops sync and asks
// "Use <new>" / "Go back to <old>".
// Boots the REAL app (app/index.html from disk, real Chromium), a returning
// bhale@ whose pass has run out, with Google's sign-in library stood in for:
//   A1  Google hands back support@'s pass → "Which account?" with both choices
//   A2  …and nothing happens meanwhile: no Drive read, no save, the pass is
//       not kept, bhale@'s sheet id untouched, no renewal window keeps coming
//   A3  "Use support@" → this browser switches: bhale@'s local copies cleared,
//       lv_user is support@, the new pass kept, the app starts again
//   A4  "Go back to bhale@" → the card goes, Google is asked for bhale@ with
//       the account chooser; bhale@'s pass is then taken as normal
//   A5  the same account's pass → no question, used as before
//   A6  Google cannot be asked whose pass it is (offline) → used as before
//   A7  the relay's pass says whose it is → no lookup at all
//   A8  PLANTED: without the check the wrong pass is taken and Drive is read
//   A9  a pass checked on an earlier start needs no second lookup (no wait at start)
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  account_check_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const AUTH = fs.readFileSync(path.join(APP, 'app-auth.js'), 'utf8');
const CFG = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

const GIS = `
window.__gis = { windows: [], codes: [], tokenCfg: null };
window.google = { accounts: { oauth2: {
  initTokenClient: function (cfg) { __gis.tokenCfg = cfg; return { callback: cfg.callback, requestAccessToken: function (o) { __gis.windows.push(o || {}); } }; },
  initCodeClient: function (cfg) { return { requestCode: function () { __gis.codes.push(1); } }; }
} } };`;
const BHALE = 'bhale@ipd-llc.com', SUPPORT = 'support@therailroster.com';

async function boot(browser, o) {
  const pg = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const net = { userinfo: [], drive: [], sheets: [] };
  await pg.addInitScript(() => {
    try {
      if (sessionStorage.getItem('__booted')) return;   // a reload keeps what the app wrote
      sessionStorage.setItem('__booted', '1');
      localStorage.setItem('lv_user', JSON.stringify({ name: 'Brad', email: 'bhale@ipd-llc.com' }));
      localStorage.setItem('lv_personal_id', 'BHALE-SHEET');
      localStorage.setItem('lv_display_name', 'Collector');
      localStorage.setItem('lv_token', 'OLD-PASS');
      localStorage.setItem('lv_token_expiry', String(Date.now() - 60000));
    } catch (e) {}
  });
  await pg.route('**', r => {
    const u = r.request().url();
    if (u.startsWith('https://accounts.google.com/gsi/client')) return r.fulfill({ body: GIS, contentType: 'application/javascript' });
    if (u.startsWith('https://www.googleapis.com/oauth2/v3/userinfo')) {
      const auth = r.request().headers()['authorization'] || '';
      net.userinfo.push(auth);
      if (o.userinfo === 'down') return r.abort();
      const who = (o.owners || {})[auth.replace('Bearer ', '')] || '';
      return r.fulfill({ status: 200, body: JSON.stringify({ email: who, given_name: who.split('@')[0] }), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    }
    if (u.indexOf('googleapis.com/drive') >= 0) { net.drive.push(u); return r.fulfill({ status: 200, body: '{"files":[]}', contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } }); }
    if (u.indexOf('sheets.googleapis.com') >= 0) { net.sheets.push(u); return r.fulfill({ status: 200, body: '{}', contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } }); }
    if (u.startsWith('https://script.google.com/')) return r.fulfill({ status: 200, body: '{"status":400}', contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    if (!u.startsWith('file://')) return r.abort();
    const bare = u.split('?')[0];
    if (bare.endsWith('/app/config.js')) return r.fulfill({ body: CFG.replace(/const RR_QUIET_RENEW = '[a-z]+';/, "const RR_QUIET_RENEW = 'off';"), contentType: 'application/javascript' });
    if (o.auth && bare.endsWith('/app/app-auth.js')) return r.fulfill({ body: o.auth, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.__gis && window.__gis.tokenCfg, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  return { pg, net };
}
const answer = (pg, resp) => pg.evaluate(r => onTokenReceived(r), resp);
const peek = pg => pg.evaluate(() => {
  const card = document.getElementById('rr-account-hold');
  return {
    card: card ? card.innerText : '', windows: (window.__gis || {}).windows || [],
    token: localStorage.getItem('lv_token'), user: localStorage.getItem('lv_user'), sheet: localStorage.getItem('lv_personal_id'),
    name: localStorage.getItem('lv_display_name'), hold: !!(window._rrAccountHoldNow && window._rrAccountHoldNow()),
  };
});

(async () => {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const owners = { 'SUPPORT-PASS': SUPPORT, 'BHALE-PASS': BHALE };
  try {
    // A1 / A2 / A3
    {
      const { pg, net } = await boot(browser, { owners });
      const w0 = (await peek(pg)).windows.length;
      const d0 = net.drive.length, s0 = net.sheets.length;
      await answer(pg, { access_token: 'SUPPORT-PASS', expires_in: 3599, scope: 'https://www.googleapis.com/auth/drive.file' });
      await pg.waitForTimeout(1500);
      let s = await peek(pg);
      T('A1 support@\'s pass for a browser bhale@ used → "Which account?" with both choices', /Which account\?/.test(s.card) && s.card.indexOf('Use ' + SUPPORT) >= 0 && s.card.indexOf('Go back to ' + BHALE) >= 0 && s.hold, s);
      T('A2 …nothing read or saved meanwhile (no Drive, no Sheets call)', net.drive.length === d0 && net.sheets.length === s0, { drive: net.drive.slice(d0), sheets: net.sheets.slice(s0) });
      T('A2 …the wrong pass is not kept; bhale@\'s sheet id and name untouched', s.token === 'OLD-PASS' && s.sheet === 'BHALE-SHEET' && JSON.parse(s.user).email === BHALE, s);
      await pg.evaluate(() => rrEnsureFreshToken('test'));
      await pg.waitForTimeout(300);
      s = await peek(pg);
      T('A2 …and no renewal window keeps coming while the question is up', s.windows.length === w0, { before: w0, after: s.windows.length });
      // A3
      await Promise.all([pg.waitForNavigation({ timeout: 15000 }).catch(() => {}), pg.click('#rr-account-hold [data-acct="use"]')]);
      await pg.waitForTimeout(2500);
      s = await peek(pg);
      T('A3 "Use support@": bhale@\'s local copies cleared (sheet id, name)', s.sheet === null && s.name === null, s);
      T('A3 …this browser is now support@\'s, with the new pass, started again', s.user && JSON.parse(s.user).email === SUPPORT && s.token === 'SUPPORT-PASS', s);
      await pg.close();
    }
    // A4
    {
      const { pg, net } = await boot(browser, { owners });
      await answer(pg, { access_token: 'SUPPORT-PASS', expires_in: 3599, scope: 'x' });
      await pg.waitForTimeout(1200);
      const w0 = (await peek(pg)).windows.length;
      await pg.click('#rr-account-hold [data-acct="back"]');
      await pg.waitForTimeout(400);
      let s = await peek(pg);
      const last = s.windows[s.windows.length - 1] || {};
      T('A4 "Go back to bhale@": the card goes, Google is asked for bhale@ with the chooser', !s.card && !s.hold && s.windows.length === w0 + 1 && last.login_hint === BHALE && last.prompt === 'select_account', { s, last });
      const d0 = net.drive.length;
      await answer(pg, { access_token: 'BHALE-PASS', expires_in: 3599, scope: 'https://www.googleapis.com/auth/drive.file' });
      await pg.waitForTimeout(1500);
      s = await peek(pg);
      T('A4 …bhale@\'s pass is then taken as normal', !s.card && s.token === 'BHALE-PASS' && JSON.parse(s.user).email === BHALE, s);
      await pg.close();
    }
    // A5 same account
    {
      const { pg } = await boot(browser, { owners });
      await answer(pg, { access_token: 'BHALE-PASS', expires_in: 3599, scope: 'x' });
      await pg.waitForTimeout(1200);
      const s = await peek(pg);
      T('A5 the same account\'s pass → no question, used as before', !s.card && s.token === 'BHALE-PASS', s);
      await pg.close();
    }
    // A9 a returning start: the saved pass was checked last time → no lookup, no wait
    {
      const { pg, net } = await boot(browser, { owners });
      await answer(pg, { access_token: 'BHALE-PASS', expires_in: 3599, scope: 'x' });
      await pg.waitForTimeout(1000);
      const u0 = net.userinfo.length;
      await pg.evaluate(() => { _rrPassOwnersReset && _rrPassOwnersReset(); });
      await answer(pg, { access_token: 'BHALE-PASS', expires_in: 3599, scope: 'x' });
      await pg.waitForTimeout(600);
      const s = await peek(pg);
      T('A9 a pass checked on an earlier start is not looked up again', net.userinfo.length === u0 && s.token === 'BHALE-PASS' && !s.card, { lookups: net.userinfo.length - u0, s });
      await pg.close();
    }
    // A6 lookup down
    {
      const { pg } = await boot(browser, { owners, userinfo: 'down' });
      await answer(pg, { access_token: 'SUPPORT-PASS', expires_in: 3599, scope: 'x' });
      await pg.waitForTimeout(1200);
      const s = await peek(pg);
      T('A6 cannot ask Google whose pass it is (offline) → used as before, no question', !s.card && s.token === 'SUPPORT-PASS', s);
      await pg.close();
    }
    // A7 relay pass carries its email
    {
      const { pg, net } = await boot(browser, { owners });
      const u0 = net.userinfo.length;
      await pg.evaluate(() => _rrQuietPass({ access_token: 'RELAY-PASS', expires_in: 3599, email: 'bhale@ipd-llc.com' }, null));
      await pg.waitForTimeout(1000);
      const s = await peek(pg);
      T('A7 the relay\'s pass says whose it is → taken with no lookup', s.token === 'RELAY-PASS' && !s.card && net.userinfo.length === u0, { s, lookups: net.userinfo.length - u0 });
      await pg.close();
    }
    // A8 planted
    {
      const planted = AUTH.replace('  if (!_rrAccountGate(resp)) return;\n', '');
      if (planted === AUTH) throw new Error('could not plant');
      const { pg } = await boot(browser, { owners, auth: planted });
      await answer(pg, { access_token: 'SUPPORT-PASS', expires_in: 3599, scope: 'x' });
      await pg.waitForTimeout(1200);
      const s = await peek(pg);
      T('A8 PLANTED: without the check support@\'s pass is taken under bhale@\'s name', !s.card && s.token === 'SUPPORT-PASS' && JSON.parse(s.user).email === BHALE, s);
      await pg.close();
    }
  } finally { await browser.close(); }
  console.log('\naccount_check_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.stack); process.exit(1); });
