#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE QUIET RENEWAL, BOOTED FOR REAL — v0.9.1924
//
// quiet_renewal_tests.js runs the door's own code in Node. This boots the WHOLE
// app (app/index.html from disk, real Chromium) with a stand-in for Google's
// sign-in library and for the relay, a returning user whose saved pass has run
// out — exactly the moment the app used to flash Google's window on opening.
//   B1  switch off (as shipped) → Google's window, the relay never asked
//   B2  switch on, device linked → the relay renews; NO window; the app holds
//       the relay's pass (localStorage lv_token) — it went down the real road
//   B3  switch on, no device yet → Google's CODE window (not the token window);
//       the code goes to the relay; the device key is saved; the pass is used
//   B4  switch on, relay down → Google's window, as before
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  quiet_renewal_boot_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const CFG = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

// A stand-in for https://accounts.google.com/gsi/client — records every window.
const GIS = `
window.__gis = { windows: [], codes: [], codeCfg: null, tokenCfg: null };
window.google = { accounts: { oauth2: {
  initTokenClient: function (cfg) { __gis.tokenCfg = cfg; return { callback: cfg.callback, requestAccessToken: function (o) { __gis.windows.push(o || {}); } }; },
  initCodeClient: function (cfg) { __gis.codeCfg = cfg; return { requestCode: function () { __gis.codes.push({ login_hint: cfg.login_hint, ux_mode: cfg.ux_mode }); } }; }
} } };`;

async function boot(browser, o) {
  const pg = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const relay = [];
  await pg.addInitScript(({ device }) => {
    try {
      localStorage.setItem('lv_user', JSON.stringify({ name: 'Collector', email: 'bhale@ipd-llc.com' }));
      localStorage.setItem('lv_personal_id', 'SID');
      localStorage.setItem('lv_token', 'OLD-PASS');
      localStorage.setItem('lv_token_expiry', String(Date.now() - 60000));   // ran out a minute ago
      if (device) localStorage.setItem('lv_renew_device', JSON.stringify({ device: 'DEV-1', email: 'bhale@ipd-llc.com' }));
    } catch (e) {}
  }, { device: !!o.device });
  await pg.route('**', r => {
    const u = r.request().url();
    if (u.startsWith('https://accounts.google.com/gsi/client')) return r.fulfill({ body: GIS, contentType: 'application/javascript' });
    if (u.startsWith('https://script.google.com/')) {
      let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      relay.push(body);
      const ans = o.relay ? o.relay(body) : { status: 400, message: 'Unknown action' };
      if (ans === 'abort') return r.abort();
      return r.fulfill({ status: 200, body: JSON.stringify(ans), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
    }
    if (!u.startsWith('file://')) return r.abort();
    const bare = u.split('?')[0];
    if (o.mode && bare.endsWith('/app/config.js')) {
      return r.fulfill({ body: CFG.replace("const RR_QUIET_RENEW = 'off';", "const RR_QUIET_RENEW = '" + o.mode + "';"), contentType: 'application/javascript' });
    }
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.__gis && (window.__gis.tokenCfg !== null), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(o.wait || 2500);
  return { pg, relay };
}
const peek = pg => pg.evaluate(() => ({
  windows: (window.__gis || {}).windows || [], codes: (window.__gis || {}).codes || [],
  token: localStorage.getItem('lv_token'), device: localStorage.getItem('lv_renew_device'),
  quietOn: typeof _rrQuietOn === 'function' ? _rrQuietOn() : null,
  switchIs: typeof RR_QUIET_RENEW !== 'undefined' ? RR_QUIET_RENEW : null,
}));

(async () => {
  T('B0 the switch ships OFF (on only after the relay is live and checked)', /const RR_QUIET_RENEW = 'off';/.test(CFG));
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    // B1
    {
      const { pg, relay } = await boot(browser, { device: true });
      const s = await peek(pg);
      T('B1 switch off → the expired pass is renewed through Google\'s window, as today', s.windows.length === 1 && s.windows[0].prompt === '' && s.windows[0].login_hint === 'bhale@ipd-llc.com', s);
      T('B1 …and the relay is never asked to renew', !relay.some(b => /^auth_/.test(b.action || '')), relay.map(b => b.action));
      await pg.close();
    }
    // B2
    {
      const { pg, relay } = await boot(browser, { mode: 'owners', device: true,
        relay: b => b.action === 'auth_renew' ? { status: 200, email: 'bhale@ipd-llc.com', access_token: 'RELAY-PASS', expires_in: 3599, scope: 'drive.file' } : { status: 200 } });
      const s = await peek(pg);
      const ren = relay.filter(b => b.action === 'auth_renew');
      T('B2 switch on + linked device → the app asks the relay on opening', s.quietOn === true && ren.length === 1 && ren[0].device === 'DEV-1' && ren[0].email === 'bhale@ipd-llc.com' && !('gtoken' in ren[0]), { s, ren });
      T('B2 …NO Google window of either kind', s.windows.length === 0 && s.codes.length === 0, s);
      T('B2 …and the app now holds the relay\'s pass (it went down the real road)', s.token === 'RELAY-PASS', s.token);
      await pg.close();
    }
    // B3
    {
      const { pg, relay } = await boot(browser, { mode: 'owners', device: false,
        relay: b => b.action === 'auth_link' ? { status: 200, device: 'NEW-DEV', email: 'bhale@ipd-llc.com', access_token: 'LINK-PASS', expires_in: 3599 } : { status: 200 } });
      let s = await peek(pg);
      T('B3 switch on, nothing linked → Google\'s CODE window, not the token window', s.codes.length === 1 && s.codes[0].login_hint === 'bhale@ipd-llc.com' && s.codes[0].ux_mode === 'popup' && s.windows.length === 0, s);
      await pg.evaluate(() => window.__gis.codeCfg.callback({ code: 'ONE-TIME-CODE', scope: 'x' }));
      await pg.waitForTimeout(1500);
      s = await peek(pg);
      const link = relay.filter(b => b.action === 'auth_link');
      T('B3 …the code goes to the relay with the expected email', link.length === 1 && link[0].code === 'ONE-TIME-CODE' && link[0].email === 'bhale@ipd-llc.com' && !('gtoken' in link[0]), link);
      T('B3 …the device key is saved and the pass is used — still no token window', s.device && JSON.parse(s.device).device === 'NEW-DEV' && s.token === 'LINK-PASS' && s.windows.length === 0, s);
      await pg.close();
    }
    // B4
    {
      const { pg, relay } = await boot(browser, { mode: 'owners', device: true, relay: () => 'abort' });
      const s = await peek(pg);
      T('B4 switch on but the relay cannot be reached → Google\'s window, as before', relay.some(b => b.action === 'auth_renew') && s.windows.length === 1, { s, relay: relay.map(b => b.action) });
      await pg.close();
    }
  } finally { await browser.close(); }
  console.log('\nquiet_renewal_boot_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.stack); process.exit(1); });
