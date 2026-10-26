#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// A COLUMN YOU MAKE IS A FIELD EVERYWHERE — v0.9.1988 (real Chromium, REAL
// bulk-tag.js, browse.js, table-columns.js, app-collection.js, wizard.js)
//
// Brad, 2026-10-19: "i just added a sub collection column and add it to the
// first row. I went to delete it, and its not on the detail page, nor is it
// selectable to add to the detail page. Also, it did not add that column to
// the add item steps". Measured: "+ Custom column" → Sub-collection wrote the
// table layout DIRECTLY and never turned the field's Preferences switch on —
// the switch every other screen asks. Told the plan — "yes".
//
//   F1  "+ Custom column" → Sub-collection, "Mint Cars": the switch comes on;
//       the detail page shows "Sub-collection  Mint Cars"; Edit fields lists
//       it; Update Info lets it be changed; the Add steps ask for it
//   F3  his saved "Edit fields" choice: a field switched on joins the card, ticked
//   F2  the same door for Sub Type and Shipper; Location brings Location and
//       Location Detail on together
//   R1  ONE-TIME REPAIR: a column already on the table, holding a value, with
//       its switch off (his account today) gets the switch, once, with one
//       message; the second run does nothing
//   R2  a column on the table with NO values is left alone
//   S1  SAFETY NET: switch off, but this item has a Shipper value — its detail
//       page and Update Info still show it (a value is never hidden)
//   S2  …and an item with no value shows nothing for a switched-off field
//   P   PLANTED: the shipped v0.9.1987 bulk-tag.js + app-collection.js (git
//       e1dd9ce5) fail F1 and S1 — so this suite can fail
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), cp = require('child_process');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  custom_columns_1988_tests needs playwright and it is not installed.'); process.exit(1); }
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
const old = (f) => { try { return cp.execSync('git show e1dd9ce5:app/' + f, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; } };
const OLD = { 'bulk-tag.js': old('bulk-tag.js'), 'app-collection.js': old('app-collection.js') };

let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }

const MASTER = [
  { itemNum: '10-2204', variation: '', itemType: 'Stock Car', description: 'Blue 4020 Stock Car', _era: 'mth_std', _tab: 'MTH Standard' },
  { itemNum: '10-2210', variation: '', itemType: 'Caboose', description: 'Caboose', _era: 'mth_std', _tab: 'MTH Standard' },
];
const PD = {
  I1: { inventoryId: 'I1', itemNum: '10-2204', variation: '', owned: true, condition: '7', userEstWorth: '125', row: 3 },
  I2: { inventoryId: 'I2', itemNum: '10-2210', variation: '', owned: true, condition: '6', row: 4 },
};

async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: 1536, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    for (const f of Object.keys(o.swap || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: o.swap[f], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(({ master, pd }) => {
    try { _aiUsageMarkSeen(); } catch (e) {}
    try { localStorage.clear(); } catch (e) {}
    state.masterData = master.slice(); try { _rebuildMasterIndex(); } catch (e) {}
    state.masterAllRows = master.slice();
    state.personalData = JSON.parse(JSON.stringify(pd));
    window.__toasts = [];
    const _st = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); try { _st.apply(this, arguments); } catch (e) {} };
    // the row write is not this suite's business — the switch and the screens are
    window.rrTagApply = async function () {};
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
  }, { master: MASTER, pd: PD });
  return { pg, ctx, errs };
}

// Fill a column through the real "+ Custom column" dialog.
const fill = (pg, key, value, pairValue) => pg.evaluate(async ([key, value, pairValue]) => {
  const S = ms => new Promise(r => setTimeout(r, ms));
  rrTagOpen(key); await S(60);
  document.getElementById('rr-tag-value').value = value;
  const p = document.getElementById('rr-tag-pair'); if (p && pairValue) p.value = pairValue;
  rrTagNext(); await S(150);
  if (typeof rrTagCancel === 'function') { try { rrTagCancel(); } catch (e) {} }
}, [key, value, pairValue || '']);

// What the screens say about one item.
const screens = (pg, inv) => pg.evaluate(async (inv) => {
  const S = ms => new Promise(r => setTimeout(r, ms));
  const pd = state.personalData[inv];
  const idx = state.masterData.findIndex(m => m.itemNum === pd.itemNum);
  showItemDetailPage(idx, inv); await S(200);
  const defs = (window._rrDetailFieldDefs || []).map(d => d.id + '=' + d.label);
  const grid = ((document.getElementById('item-detail-content') || {}).textContent || '').replace(/\s+/g, ' ');
  let panel = '';
  try { showItemPanel(idx, inv, 'edit'); await S(200); panel = (document.getElementById('item-panel') || document.body).textContent; } catch (e) { panel = 'ERR ' + e.message; }
  try { closeItemPanel && closeItemPanel(); } catch (e) {}
  let wiz = '';
  try { wiz = _wizUserFieldsHtml({}); } catch (e) { wiz = 'ERR ' + e.message; }
  return { defs, grid, panel, wiz, enabled: rrEnabledUserFields().map(f => f.key) };
}, inv);

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── F1 his exact steps ───────────────────────────────────────────────────
  let r = await open(browser, {});
  await fill(r.pg, 'subCollection', 'Mint Cars');
  await r.pg.evaluate(() => { state.personalData.I1.subCollection = 'Mint Cars'; });   // what Apply writes on the ticked row
  let st = await r.pg.evaluate(() => ({ sw: localStorage.getItem('lv_subcoll_enabled'), stamped: Number(localStorage.getItem('lv_subcoll_enabled__at')) > 0, col: _collVisibleCols().includes('subCollection'), toasts: window.__toasts.slice() }));
  T('F1 "+ Custom column" → Sub-collection turns its switch on (through the settings door, so it follows the account)', st.sw === 'true' && st.stamped && st.col, st);
  T('F1 …and says so, like "+ Add" does', st.toasts.some(t => /Sub-collection is on in Preferences/.test(t)), st.toasts);
  let s = await screens(r.pg, 'I1');
  T('F1 the detail page lists Sub-collection (Edit fields reads the same list)', s.defs.includes('uf_subCollection=Sub-collection'), s.defs);
  T('F1 the detail page shows "Mint Cars"', /Sub-collection\s*Mint Cars/.test(s.grid), s.grid.slice(0, 400));
  T('F1 Update Info offers Sub-collection to change or clear', /Sub-collection/.test(s.panel) && /Mint Cars/.test(s.panel), s.panel.slice(0, 300));
  T('F1 the Add steps ask for Sub-collection', /Sub-collection/.test(s.wiz) && /subCollection/.test(s.wiz), s.wiz.slice(0, 300));

  // ── F3 he had saved his own "Edit fields" choice (his screenshot) ─────────
  const f3 = await r.pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    // a saved choice WITHOUT Sub Type, then Sub Type is made through "+ Custom column"
    // (v0.9.2027: was Shipper — the master carton column is no longer typed; it
    // shows the group's master carton, so "+ Custom column" does not offer it)
    localStorage.setItem('lv_detail_fields_v1', JSON.stringify(['condition', 'hasBox', 'estWorth', 'uf_subCollection']));
    rrTagOpen('subType'); await S(60); document.getElementById('rr-tag-value').value = 'Operating'; rrTagNext(); await S(150);
    state.personalData.I1.subType = 'Operating';
    const cfg = JSON.parse(localStorage.getItem('lv_detail_fields_v1'));
    showItemDetailPage(0, 'I1'); await S(200);
    return { cfg, grid: (document.getElementById('item-detail-content').textContent || '').replace(/\s+/g, ' ') };
  });
  T('F3 with a saved "Edit fields" choice, a column switched on joins the Details card (ticked, at the end)', f3.cfg.slice(-1)[0] === 'uf_subType' && /Sub Type\s*Operating/.test(f3.grid), f3.cfg);
  await r.pg.evaluate(() => localStorage.removeItem('lv_detail_fields_v1'));

  // ── F2 the other fields in that list ─────────────────────────────────────
  await fill(r.pg, 'subType', 'Operating');
  // v0.9.2027: Shipper is no longer filled by "+ Custom column" (see F3)
  await fill(r.pg, 'location', 'Basement', 'Tote 3');
  st = await r.pg.evaluate(() => ({ sub: localStorage.getItem('lv_subtype_enabled'), ship: localStorage.getItem('lv_shipper_enabled'), loc: localStorage.getItem('lv_location_enabled'), det: localStorage.getItem('lv_locdetail_enabled'), on: rrEnabledUserFields().map(f => f.key) }));
  T('F2 the Sub Type switch comes on the same way', st.sub === 'true' && st.on.includes('subType'), st);
  T('F2 Location brings Track Storage Location AND Location Detail on together', st.loc === 'true' && st.det === 'true' && st.on.includes('locationDetail'), st);
  T('page errors (fill a column)', r.errs.length === 0, r.errs);
  await r.ctx.close();

  // ── R1 / R2 the one-time repair ──────────────────────────────────────────
  r = await open(browser, {});
  const rep = await r.pg.evaluate(async () => {
    // his account today: the column on the table, a value on one row, the switch off
    rrTableSave('collection', ['var', 'type', 'photo', 'desc', 'worth', 'added', 'subCollection', 'shipper']);
    state.personalData.I1.subCollection = 'Mint Cars';
    window.__toasts = [];
    const fixed = rrCollRepairColumnSwitches();
    const after = { sw: localStorage.getItem('lv_subcoll_enabled'), ship: localStorage.getItem('lv_shipper_enabled'), flag: localStorage.getItem('lv_colsw_repair_1988'), flagStamped: Number(localStorage.getItem('lv_colsw_repair_1988__at')) > 0 };
    // switch it off again: the repair has run on this account and must not run twice
    _ufToggle('subCollection', false, { quiet: true });
    const second = rrCollRepairColumnSwitches();
    return { fixed, after, second, toasts: window.__toasts.slice(), swAfterSecond: localStorage.getItem('lv_subcoll_enabled') };
  });
  T('R1 the column on his table with "Mint Cars" gets its switch, with one message', rep.fixed.join() === 'Sub-collection' && rep.after.sw === 'true' && rep.toasts.length === 1 && /Sub-collection is now on your item pages/.test(rep.toasts[0]), rep);
  T('R1 it runs once per account (remembered through the settings door); a second run changes nothing', rep.after.flag === 'done' && rep.after.flagStamped && rep.second.length === 0 && rep.swAfterSecond === 'false', rep);
  T('R2 a column on the table with no values (Shipper) is left alone', rep.after.ship !== 'true', rep.after);
  const soon = await r.pg.evaluate(() => typeof rrCollRepairSoon === 'function' && /rrCollRepairSoon\(\)/.test(String(buildApp)));
  T('R1 the app starts the repair itself (buildApp → rrCollRepairSoon)', soon, soon);
  T('page errors (repair)', r.errs.length === 0, r.errs);
  await r.ctx.close();

  // ── S1 / S2 the safety net ───────────────────────────────────────────────
  r = await open(browser, {});
  await r.pg.evaluate(() => { state.personalData.I1.shipper = 'Original carton'; });
  s = await screens(r.pg, 'I1');
  T('S1 switch off, but this item HAS a Shipper value: its detail page shows it', s.defs.includes('uf_shipper=Master Carton / Outside Shipper') && /Outside Shipper\s*Original carton/.test(s.grid) && !s.enabled.includes('shipper'), { defs: s.defs, enabled: s.enabled });
  T('S1 …and Update Info lets it be changed or cleared', /Outside Shipper/.test(s.panel) && /Original carton/.test(s.panel), s.panel.slice(0, 300));
  T('S1 the Add steps still do not ask for a switched-off field', !/shipper/i.test(s.wiz), s.wiz.slice(0, 200));
  const s2 = await screens(r.pg, 'I2');
  T('S2 an item with no value shows nothing for a switched-off field', !s2.defs.some(d => /^uf_/.test(d)), s2.defs);
  T('page errors (safety net)', r.errs.length === 0, r.errs);
  await r.ctx.close();

  // ── P planted ────────────────────────────────────────────────────────────
  if (!OLD['bulk-tag.js'] || !OLD['app-collection.js']) T('P0 the v0.9.1987 files could be read from git (e1dd9ce5)', false, 'git show failed');
  else {
    r = await open(browser, { swap: OLD });
    await fill(r.pg, 'subCollection', 'Mint Cars');
    const p1 = await r.pg.evaluate(() => localStorage.getItem('lv_subcoll_enabled'));
    T('P1 PLANTED: v0.9.1987 "+ Custom column" never turns the switch on', p1 !== 'true', p1);
    await r.pg.evaluate(() => { state.personalData.I1.shipper = 'Original carton'; });
    const ps = await screens(r.pg, 'I1');
    T('P2 PLANTED: v0.9.1987 hides a switched-off field\'s value from the detail page', !ps.defs.includes('uf_shipper=Shipper'), ps.defs);
    await r.ctx.close();
  }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
