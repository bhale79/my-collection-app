#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PREFERENCES → OWNER TOOLS → "ALLOW MASTER EDITS" — v0.9.1952   (real Chromium, REAL app)
//
// Brad, 2026-10-14: "yes" to a button that asks Google for the full Sheets
// permission. The app signs in with narrow access; a master-catalog fix needs the
// full Sheets permission, and only the account holder's own click may ask Google
// for it. The row shows only to RR_MASTER_EDITOR_EMAILS (config.js).
//   M1  bhale@ without the permission: the row and its Allow button
//   M2  support@ (an owner, the demo account): Owner tools yes, this row NO
//   M3  an ordinary member: no Owner tools at all
//   M4  the button asks Google (_ensureFullSheetsScope) and the row then says Allowed
//   M5  a sign-in that already carries it: "Allowed", no button, nothing asked
//   M6  Google says no: nothing changes, the button stays
//   M7  PLANTED: the row gated on the owner list → support@ sees it (caught)
//   M8  the list lives in ONE place (config.js)
// v0.9.1953 — THE PERMISSION THAT LASTS (Brad: "yes"). The click opens Google's
// CODE window (normal permissions + Sheets, prompt consent) and the relay swaps
// in a renewal key that carries it; one renewal at once is the proof.
//   L1  the code window asks for Sheets + the normal permissions, consent, Brad's account
//   L2  the relay gets the code and this device's old key to drop; the new key is kept
//   L3  the renewal proof carries Sheets → "stays on", the row says Allowed
//   L4  the renewal drops it → "this hour only" (never claimed as lasting)
//   L5  the person closes Google's window → no second window, the button stays
//   L6  no code window available → the one-hour window, inside the same click
//   L7  PLANTED: prompt 'consent' removed (Google would hand no new key) → caught
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  master_edits_button_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }

async function boot(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const bare = u.split('?')[0];
    if (planted && planted.pf && bare.endsWith('/app/prefs.js')) return r.fulfill({ body: planted.pf, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  // the stand-in world: a small catalog with Row IDs, a collection, a Sheets that records
  await pg.evaluate(() => {
    const PRE = 'Lionel Pre-War', PW = 'Lionel PW - Items', MS = 'Lionel Modern S - Items';
    const mk = (n, v, t, desc, era, tab, id, yr, x) => Object.assign({ itemNum: n, variation: v, itemType: t, description: desc, _era: era, _tab: tab, rowId: id, yearProd: yr || '', roadName: '', gauge: 'O', varDesc: '' }, x || {});
    const motor = mk('800', '', 'Motorized Unit', 'Electric Box Car (2 7/8")', 'prewar', PRE, 'MMMMMMMMMM', '1904-1905', { refLink: 'https://example.test/800' });
    const box = mk('800', '', 'Boxcar', 'Box Car (O gauge)', 'prewar', PRE, 'BBBBBBBBBB', '1915-1926', { roadName: 'Lionel Lines' });
    const boxC = mk('800', 'C', 'Boxcar', 'Box Car, variation C', 'prewar', PRE, 'CCCCCCCCCC', '1915', { varDesc: 'orange body' });
    const boxC2 = mk('800', 'C', 'Boxcar', 'Box Car, variation C, later run', 'prewar', PRE, 'C2C2C2C2C2', '1927', { varDesc: 'brown body' });   // two products share 800 var C
    const alco = mk('2343', '1', 'Diesel Locomotive', 'Santa Fe F3 A unit', 'pw', PW, 'DDDDDDDDDD', '1950');
    const moved = mk('6-49807', '', 'Accessory', 'S gauge accessory', 'mod_s', MS, 'SSSSSSSSSS', '2020');
    state.masterData = [motor, box, boxC, boxC2, alco, moved];
    _rebuildMasterIndex();
    state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); state.masterByRowIdAll = state.masterByRowId;
    window._allIdxComplete = true;
    state.personalSheetId = 'SID'; window.accessToken = 'tok'; accessToken = 'tok';
    let row = 3;
    const pd = (n, v, era, inv, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: era, manufacturer: 'Lionel', inventoryId: inv, row: row++, condition: '7' }, x || {});
    state.personalData = {
      a: pd('800', '', 'prewar', 'INV-A', { masterKey: 'prewar|800|' }),                 // key → the first 800 (the motor car)
      b: pd('800', 'C', 'prewar', 'INV-B', {}),                                           // no key: own match
      c: pd('6-49807', '', 'mod_s', 'INV-C', { masterKey: 'mpc|6-49807|' }),              // the key names a row that MOVED tabs
      d: pd('2343-P', '1', 'pw', 'INV-D', { masterRowId: 'DDDDDDDDDD' }),                  // already has its ID
      e: pd('SIGN-1', '', 'Manual', 'INV-E', { itemType: 'Accessory' }),                   // manual
      f: pd('800', '', 'prewar', 'INV-F', { masterKey: 'prewar|800|', row: 99999 }),       // a placeholder row
      g: pd('800', '', 'prewar', 'INV-G', { masterKey: 'prewar|800|' }),                   // the sheet row no longer holds it
    };
    state.soldData = {}; state.wantData = state.wantData || {}; state.forSaleData = {};
    // the stand-in Sheets: column A and the Inventory ID column as the SHEET has them
    const F = PERSONAL_FIELD_INDEX; const invCol = personalColLetter('inventoryId'), mriCol = personalColLetter('masterRowId');
    const sheetA = {}, sheetInv = {};
    Object.values(state.personalData).forEach(p => { if (p.row !== 99999) { sheetA[p.row] = p.itemNum; sheetInv[p.row] = p.inventoryId; } });
    sheetA[state.personalData.g.row] = '6464-1'; sheetInv[state.personalData.g.row] = 'INV-ZZ';   // g's row was taken by another item
    const last = Math.max(...Object.keys(sheetA).map(Number));
    window.__sheet = { header: 'Master Row ID', reads: [], writes: [], puts: [] };
    window.fetch = async function (url, opts) {
      const u = String(url); const method = (opts && opts.method) || 'GET';
      const ok = b => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
      if (/values:batchGet/.test(u)) {
        const ranges = [...u.matchAll(/ranges=([^&]+)/g)].map(m => decodeURIComponent(m[1]));
        window.__sheet.reads.push(ranges);
        return ok({ valueRanges: ranges.map(r => {
          if (r.endsWith('!' + mriCol + '2')) return { range: r, values: [[window.__sheet.header]] };
          if (/!A3:A$/.test(r)) { const v = []; for (let i = 3; i <= last; i++) v.push([sheetA[i] || '']); return { range: r, values: v }; }
          if (new RegExp('!' + invCol + '3:' + invCol + '$').test(r)) { const v = []; for (let i = 3; i <= last; i++) v.push([sheetInv[i] || '']); return { range: r, values: v }; }
          return { range: r, values: [] };
        }) });
      }
      if (/values:batchUpdate/.test(u) && method === 'POST') { window.__sheet.writes.push(JSON.parse(opts.body)); return ok({ totalUpdatedCells: 1 }); }
      const m = /\/values\/([^?]+)\?/.exec(u);
      if (m && method === 'GET') {   // rrRowStillIs: A{row}:{inv}{row}
        const r = decodeURIComponent(m[1]); const rowN = Number((/!A(\d+)/.exec(r) || [])[1]);
        const cells = []; cells[0] = sheetA[rowN] || ''; cells[F.inventoryId] = sheetInv[rowN] || '';
        return ok({ values: [cells] });
      }
      if (m && method === 'PUT') { window.__sheet.puts.push({ range: decodeURIComponent(m[1]), body: JSON.parse(opts.body) }); return ok({ updatedCells: 1 }); }
      return ok({});
    };
    window.showToast = function () {};
  });
  return { pg, errs };
}




const SHEETS = 'https://www.googleapis.com/auth/spreadsheets';
async function as(pg, email, opts) {
  return pg.evaluate(async ([email, opts, SHEETS]) => {
    state.user = { email: email, name: 'X' };
    window.__asked = 0;
    const setScopes = (sc) => { localStorage.setItem(RR_TOKEN_SCOPES_KEY, JSON.stringify({ fp: _rrPassPrint(accessToken), scope: sc })); };
    setScopes(opts.has ? 'openid email ' + SHEETS : 'openid email https://www.googleapis.com/auth/drive.file');
    window._ensureFullSheetsScope = async function () { window.__asked++; if (opts.grant) setScopes('openid email ' + SHEETS); return !!opts.grant; };
    window.showToast = function () {};
    const r = {};
    const html = _prefsOwnerToolsHtml();
    r.ownerTools = html.indexOf('Owner tools') >= 0;
    r.row = html.indexOf('id="pref-master-edits"') >= 0;
    r.btn = html.indexOf('id="pref-master-edits-btn"') >= 0;
    r.allowed = html.indexOf('id="pref-master-edits-on"') >= 0;
    if (opts.click) {
      _prefsAllowMasterEdits();
      await new Promise(r => setTimeout(r, 80));
      const after = _prefsOwnerToolsHtml();
      r.afterAllowed = after.indexOf('id="pref-master-edits-on"') >= 0;
      r.afterBtn = after.indexOf('id="pref-master-edits-btn"') >= 0;
    }
    r.asked = window.__asked;
    return r;
  }, [email, opts || {}, SHEETS]);
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const { pg, errs } = await boot(browser, null);
  T('M0 no script error', errs.length === 0, errs);
  const m1 = await as(pg, 'bhale@ipd-llc.com', {});
  T('M1 bhale@ without the permission: the row and its Allow button', m1.ownerTools && m1.row && m1.btn && !m1.allowed && m1.asked === 0, m1);
  const m2 = await as(pg, 'support@therailroster.com', {});
  T('M2 support@ (demo owner): Owner tools yes, master-edits row NO', m2.ownerTools && !m2.row, m2);
  const m3 = await as(pg, 'someone@example.com', {});
  T('M3 an ordinary member: no Owner tools at all', !m3.ownerTools && !m3.row, m3);
  const m4 = await as(pg, 'bhale@ipd-llc.com', { click: true, grant: true });
  T('M4 the button asks Google once, then the row says Allowed (no button)', m4.asked === 1 && m4.afterAllowed && !m4.afterBtn, m4);
  const m5 = await as(pg, 'bhale@ipd-llc.com', { has: true });
  T('M5 a sign-in that already carries it: Allowed, no button, nothing asked', m5.allowed && !m5.btn && m5.asked === 0, m5);
  const m6 = await as(pg, 'bhale@ipd-llc.com', { click: true, grant: false });
  T('M6 Google says no: the button stays, nothing claims Allowed', m6.asked === 1 && m6.afterBtn && !m6.afterAllowed, m6);

  // ── v0.9.1953: the lasting route ──
  async function lasting(pgX, o) {
    return pgX.evaluate(async ([o, SHEETS]) => {
      state.user = { email: 'bhale@ipd-llc.com', name: 'X' };
      RR_QUIET_RENEW_TEST = true;
      localStorage.setItem(RR_RENEW_DEVICE_KEY, JSON.stringify({ device: 'OLD', email: 'bhale@ipd-llc.com' }));
      localStorage.setItem(RR_TOKEN_SCOPES_KEY, JSON.stringify({ fp: _rrPassPrint(accessToken), scope: 'openid email https://www.googleapis.com/auth/drive.file' }));
      window.showToast = function (m) { window.__toast = m; };
      window.__asked = 0; window.__cfg = null; window.__posts = [];
      window._ensureFullSheetsScope = async function () { window.__asked++; return false; };
      window.google = o.noCode ? { accounts: { oauth2: {} } } : { accounts: { oauth2: { initCodeClient: function (cfg) {
        window.__cfg = cfg;
        return { requestCode: function () { setTimeout(function () {
          if (o.closeWindow) cfg.error_callback({ type: 'popup_closed' }); else cfg.callback({ code: 'CODE1' });
        }, 5); } };
      } } } };
      window.vaultPost = async function (p) {
        window.__posts.push(JSON.parse(JSON.stringify(p)));
        if (p.action === 'auth_link') return { status: 200, device: 'NEW', email: 'bhale@ipd-llc.com', access_token: 'tokLINK', expires_in: 3600, scope: 'openid email https://www.googleapis.com/auth/drive.file ' + SHEETS };
        if (p.action === 'auth_renew') return { status: 200, access_token: 'tokRENEW', expires_in: 3600, email: 'bhale@ipd-llc.com', scope: o.renewDrops ? 'openid email https://www.googleapis.com/auth/drive.file' : 'openid email https://www.googleapis.com/auth/drive.file ' + SHEETS };
        return { status: 400 };
      };
      _prefsAllowMasterEdits();
      await new Promise(r => setTimeout(r, 120));
      const html = _prefsOwnerToolsHtml();
      let dev = null; try { dev = JSON.parse(localStorage.getItem(RR_RENEW_DEVICE_KEY)); } catch (e) {}
      return { cfg: window.__cfg && { scope: window.__cfg.scope, prompt: window.__cfg.prompt, igs: window.__cfg.include_granted_scopes, hint: window.__cfg.login_hint },
               posts: window.__posts, asked: window.__asked, toast: window.__toast || '', dev: dev && dev.device, token: accessToken,
               allowed: html.indexOf('id="pref-master-edits-on"') >= 0, btn: html.indexOf('id="pref-master-edits-btn"') >= 0 };
    }, [o || {}, SHEETS]);
  }
  const l1 = await lasting(pg, {});
  T('L1 the code window asks for Sheets + the normal permissions, consent, for bhale@',
    l1.cfg && / https:\/\/www\.googleapis\.com\/auth\/spreadsheets$/.test(l1.cfg.scope) && /drive\.file/.test(l1.cfg.scope)
    && l1.cfg.prompt === 'consent' && l1.cfg.igs === true && l1.cfg.hint === 'bhale@ipd-llc.com', l1.cfg);
  T('L2 the relay gets the code + the old device to drop; the new device key is kept',
    l1.posts[0] && l1.posts[0].action === 'auth_link' && l1.posts[0].code === 'CODE1' && l1.posts[0].old_device === 'OLD' && l1.dev === 'NEW', { posts: l1.posts, dev: l1.dev });
  T('L3 the renewal proof carries Sheets → "stays on", Allowed, the renewed pass in use, no one-hour window',
    l1.posts[1] && l1.posts[1].action === 'auth_renew' && l1.posts[1].device === 'NEW' && /stays on/.test(l1.toast) && l1.allowed && l1.token === 'tokRENEW' && l1.asked === 0, l1);
  const l4 = await lasting(pg, { renewDrops: true });
  T('L4 the renewal drops it → keeps the window\'s pass (it has Sheets), says "this hour only", never "stays on"', /this hour/.test(l4.toast) && !/stays on/.test(l4.toast) && l4.token === 'tokLINK' && l4.allowed, l4);
  const l5 = await lasting(pg, { closeWindow: true });
  T('L5 Google\'s window closed → nothing claimed, no second window, the button stays', l5.asked === 0 && l5.btn && !l5.allowed && /did not give/.test(l5.toast) && l5.posts.length === 0, l5);
  const l6 = await lasting(pg, { noCode: true });
  T('L6 no code window available → the one-hour window is asked, inside the same click', l6.asked === 1 && !l6.cfg, l6);
  await pg.close();
  const auth = fs.readFileSync(path.join(APP, 'app-auth.js'), 'utf8');
  const fnA = auth.slice(auth.indexOf('function _rrLinkLastingScope('), auth.indexOf("window._rrLinkLastingScope = _rrLinkLastingScope"));
  const plantedAuth = auth.replace("      prompt: 'consent',\n      ux_mode: 'popup',\n      login_hint: em,", "      ux_mode: 'popup',\n      login_hint: em,");
  T('L7 PLANTED: the consent prompt removed → the L1 rule catches it (and the real code has it once)',
    plantedAuth !== auth && !/prompt: 'consent'/.test(plantedAuth.slice(plantedAuth.indexOf('function _rrLinkLastingScope('), plantedAuth.indexOf("window._rrLinkLastingScope")))
    && (fnA.match(/prompt: 'consent'/g) || []).length === 1, null);
  const src = fs.readFileSync(path.join(APP, 'prefs.js'), 'utf8');
  const gate = "return !!em && (typeof RR_MASTER_EDITOR_EMAILS !== 'undefined') && RR_MASTER_EDITOR_EMAILS.indexOf(em) >= 0;";
  if (src.indexOf(gate) < 0) throw new Error('the gate line moved; update this test');
  const planted = src.replace(gate, "return !!em && RR_OWNER_EMAILS.indexOf(em) >= 0;   // planted");
  const b2 = await boot(browser, { pf: planted });
  const p7 = await as(b2.pg, 'support@therailroster.com', {});
  T('M7 PLANTED: gated on the owner list → support@ sees the row (caught)', p7.row === true, p7);
  await b2.pg.close();
  const cfg = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
  const all = fs.readdirSync(APP).filter(f => /\.js$/.test(f)).map(f => fs.readFileSync(path.join(APP, f), 'utf8')).join('\n');
  T('M8 the list is defined once, in config.js, and holds only bhale@',
    (all.match(/const RR_MASTER_EDITOR_EMAILS = /g) || []).length === 1 && /const RR_MASTER_EDITOR_EMAILS = \['bhale@ipd-llc\.com'\];/.test(cfg), null);
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
