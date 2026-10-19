#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE DETAILS CARD'S "EDIT FIELDS" CHOICE FOLLOWS THE ACCOUNT — v0.9.1989
// (real Chromium, REAL app-collection.js, app.js _prefGet/_prefSet, drive.js
// rrPrefsMerge)
//
// Offered after v0.9.1988: "the Edit fields list for the detail page is still
// saved separately in each browser. Your phone and computer can show different
// detail cards." Brad: "yes".
//
//   A1  Done in the picker writes the choice through the settings door —
//       stamped, and handed to the account sync
//   A2  Reset writes an EMPTY choice the same way (a removal cannot travel to
//       the other devices; an empty value can) — and the card is the default
//   A3  the other device: the account's choice, merged in by the real
//       rrPrefsMerge, decides that device's card; an empty one means default
//   A4  a choice saved before this release (never stamped) is sent to the
//       account the first time it is read — nothing he set up is lost
//   A5  a field switched on (v0.9.1988 rrDetailFieldsJoin) is written the
//       same way
//   P   PLANTED: the shipped v0.9.1988 app-collection.js (git cf6e5b54) writes
//       the choice to this browser only — so this suite can fail
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), cp = require('child_process');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  detail_fields_account_1989_tests needs playwright and it is not installed.'); process.exit(1); }
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
let OLD = null;
try { OLD = cp.execSync('git show cf6e5b54:app/app-collection.js', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) {}

let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }
const KEY = 'lv_detail_fields_v1';

async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: 1536, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    if (o.old && base.endsWith('/app/app-collection.js')) return r.fulfill({ body: o.old, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate((pre) => {
    try { _aiUsageMarkSeen(); } catch (e) {}
    try { localStorage.clear(); } catch (e) {}
    if (pre) localStorage.setItem('lv_detail_fields_v1', pre);   // an old, never-stamped choice
    window.__pushed = [];
    window.rrPrefsQueuePush = function (k) { window.__pushed.push(k); };   // the account sync's hook
    state.masterData = [{ itemNum: '10-2204', variation: '', itemType: 'Stock Car', description: 'Blue 4020 Stock Car', _era: 'mth_std', _tab: 'MTH Standard' }];
    try { _rebuildMasterIndex(); } catch (e) {}
    state.personalData = { I1: { inventoryId: 'I1', itemNum: '10-2204', variation: '', owned: true, condition: '7', userEstWorth: '125', location: 'Basement', row: 3 } };
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
  }, o.pre || null);
  return { pg, ctx, errs };
}
// The Details card's field labels on the item page.
const card = (pg) => pg.evaluate(async () => {
  const S = ms => new Promise(r => setTimeout(r, ms));
  showItemDetailPage(0, 'I1'); await S(200);
  return [...document.querySelectorAll('#item-detail-content div[style*="grid-template-columns"] > div > span:first-child')].map(s => s.textContent);
});

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── A1 / A2 this device ──────────────────────────────────────────────────
  let r = await open(browser, {});
  const def0 = await card(r.pg);
  T('A0 no choice saved: the default card (filled fields: Condition, Est. Worth, Location …)', def0 && def0.includes('Condition') && def0.includes('Location'), def0);
  const a1 = await r.pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    window.__pushed = [];
    _rrDetailFieldsPicker(); await S(50);
    document.querySelectorAll('#df-list .df-row').forEach(row => { const cb = row.querySelector('input[type=checkbox]'); cb.checked = ['condition', 'estWorth'].includes(row.dataset.field); });
    _rrDetailFieldsApply(); await S(200);
    return { v: localStorage.getItem('lv_detail_fields_v1'), at: Number(localStorage.getItem('lv_detail_fields_v1__at')), pushed: window.__pushed.slice() };
  });
  T('A1 Done saves the choice through the settings door: stamped and handed to the account sync',
    a1.v === JSON.stringify(['condition', 'estWorth']) && a1.at > 0 && a1.pushed.includes(KEY), a1);
  const c1 = await card(r.pg);
  T('A1 the card shows just his two fields', c1 && c1.join() === 'Condition,Est. Worth', c1);
  const a2 = await r.pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    window.__pushed = [];
    _rrDetailFieldsReset(); await S(200);
    return { v: localStorage.getItem('lv_detail_fields_v1'), at: Number(localStorage.getItem('lv_detail_fields_v1__at')), pushed: window.__pushed.slice() };
  });
  T('A2 Reset writes an EMPTY choice the same way (stamped, sent), so every device resets', a2.v === '' && a2.at > 0 && a2.pushed.includes(KEY), a2);
  const c2 = await card(r.pg);
  T('A2 …and the card is the default again', c2 && c2.join() === def0.join(), { c2, def0 });

  // ── A3 the other device, through the real merge ──────────────────────────
  const a3 = await r.pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    const now = Date.now();
    // this device: an older choice; the account: a newer one made on the phone
    localStorage.setItem('lv_detail_fields_v1', JSON.stringify(['location'])); localStorage.setItem('lv_detail_fields_v1__at', String(now - 60000));
    const m = rrPrefsMerge({ lv_detail_fields_v1: localStorage.getItem('lv_detail_fields_v1') }, { lv_detail_fields_v1: String(now - 60000) },
      { lv_detail_fields_v1: { v: JSON.stringify(['estWorth', 'condition']), t: now } }, now, {}, {});
    Object.keys(m.apply).forEach(k => localStorage.setItem(k, m.apply[k]));
    showItemDetailPage(0, 'I1'); await S(200);
    const a = [...document.querySelectorAll('#item-detail-content div[style*="grid-template-columns"] > div > span:first-child')].map(s => s.textContent);
    const m2 = rrPrefsMerge({ lv_detail_fields_v1: localStorage.getItem('lv_detail_fields_v1') }, { lv_detail_fields_v1: String(now) },
      { lv_detail_fields_v1: { v: '', t: now + 1000 } }, now + 2000, {}, {});
    Object.keys(m2.apply).forEach(k => localStorage.setItem(k, m2.apply[k]));
    showItemDetailPage(0, 'I1'); await S(200);
    const b = [...document.querySelectorAll('#item-detail-content div[style*="grid-template-columns"] > div > span:first-child')].map(s => s.textContent);
    return { a, b };
  });
  T('A3 the phone\'s newer choice, merged in, decides this device\'s card (in its order)', a3.a.join() === 'Est. Worth,Condition', a3.a);
  T('A3 a Reset made on the phone (an empty choice) gives this device the default card', a3.b.includes('Location') && a3.b.includes('Condition') && a3.b.length >= 3, a3.b);
  T('page errors', r.errs.length === 0, r.errs);
  await r.ctx.close();

  // ── A4 an old, never-stamped choice ──────────────────────────────────────
  r = await open(browser, { pre: JSON.stringify(['estWorth']) });
  const c4 = await card(r.pg);
  const a4 = await r.pg.evaluate(() => ({ at: localStorage.getItem('lv_detail_fields_v1__at'), pushed: window.__pushed.slice() }));
  T('A4 a choice saved before this release still decides the card', c4 && c4.join() === 'Est. Worth', c4);
  T('A4 …and its first read sends it to the account (stamped 0, so an account choice already there wins)', a4.at === '0' && a4.pushed.includes(KEY), a4);

  // ── A5 a field switched on joins through the same door ───────────────────
  const a5 = await r.pg.evaluate(() => {
    localStorage.setItem('lv_detail_fields_v1__at', '5');
    window.__pushed = [];
    _ufToggle('shipper', true, { quiet: true });
    return { v: JSON.parse(localStorage.getItem('lv_detail_fields_v1')), at: Number(localStorage.getItem('lv_detail_fields_v1__at')), pushed: window.__pushed.slice() };
  });
  T('A5 a field switched on joins the saved choice through the account door', a5.v.join() === 'estWorth,uf_shipper' && a5.at > 5 && a5.pushed.includes(KEY), a5);
  await r.ctx.close();

  // ── P planted ────────────────────────────────────────────────────────────
  if (!OLD) T('P0 the v0.9.1988 app-collection.js could be read from git (cf6e5b54)', false, 'git show failed');
  else {
    r = await open(browser, { old: OLD });
    const p = await r.pg.evaluate(async () => {
      const S = ms => new Promise(r => setTimeout(r, ms));
      showItemDetailPage(0, 'I1'); await S(200);
      window.__pushed = [];
      _rrDetailFieldsPicker(); await S(50);
      _rrDetailFieldsApply(); await S(200);
      return { at: localStorage.getItem('lv_detail_fields_v1__at'), pushed: window.__pushed.slice() };
    });
    T('P1 PLANTED: v0.9.1988 saves the choice to this browser only (no stamp, nothing sent)', p.at === null && !p.pushed.includes(KEY), p);
    await r.ctx.close();
  }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
