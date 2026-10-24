#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// REMOVE FROM COLLECTION LEAVES THE ITEM PAGE AT ONCE — v0.9.2016
//                                                         (real Chromium)
//
// [stated] Brad, 2026-10-23: "when in a item detail page and you hit remove
// from collection, it goes back to the same page and it looks like nothing is
// happening, then it says removed from collection, but you have to go back to
// the dashboard for it to look like it did something. we need for it to go
// back to the collection page as soon as you hit delete and not stay on the
// items page" → "yes".
//
// The page waited for the sheet, then asked "is ANY copy of this number still
// owned?" — with several copies (his three 6-36814s) the answer stayed yes, so
// it never left. Now removeCollectionItem calls opts.onConfirmed the moment
// the person confirms, and rrRemoveLeaveNow (app-collection.js) hides the copy
// and goes to My Collection; the sheet finishes behind; a refusal puts it back.
//
//   R1  one copy: confirmed → on My Collection while the sheet is still
//       working; the copy is gone; then "✓ Removed from collection"
//   R2  THE BUG: a number owned three times — remove one → leaves at once;
//       only THAT copy goes (by inventory number), the other two stay
//   R3  cancel → stays on the item page, nothing changes
//   R4  the sheet refuses → the copy comes back, with a message
//   R5  a set (Remove ALL pieces) → leaves at once, every piece goes
//   R6  the sheet is asked to delete THIS copy's row, by its inventory number
//   X*  PLANTED: the old wait-then-check-the-number handler → R2 stays (caught)
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  remove_leaves_now_2016_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const COLL = fs.readFileSync(path.join(APP, 'app-collection.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 700))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}

// scenario: { copies:[[inv,num,group]], open: inv, confirm: true|false, sheet: true|false, group: 'all'|null }
async function run(browser, sc, files) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => { const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort(); });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  const out = await pg.evaluate(async sc => {
    state.user = { email: 'bhale@ipd-llc.com', name: 'Brad' };
    state.personalSheetId = 'sheet1';
    state.masterData = [{ itemNum: '6-36814', roadName: 'Rio Grande', itemType: 'Diesel', variation: '' },
                        { itemNum: '6-36814-BOX', roadName: '', itemType: 'Box', variation: '' }];
    try { _rebuildMasterIndex(); } catch (e) {}
    state.personalData = {}; state.forSaleData = {}; state.upgradeData = {}; state.soldData = {}; state.wantData = {};
    sc.copies.forEach(function (c, i) {
      state.personalData[c[0]] = { inventoryId: c[0], itemNum: c[1], variation: '', owned: true, condition: 8, row: 10 + i, groupId: c[2] || '' };
    });
    ['auth-screen', 'beta-gate'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    document.getElementById('app').classList.add('active');
    // stand-ins for the sheet and the confirm
    window.__del = []; window.__toasts = []; window.__sheetBusy = false;
    window.sheetsDeleteRow = async function (id, tab, row, expect) {
      window.__sheetBusy = true; window.__del.push({ tab: tab, row: row, inv: expect && expect.inventoryId });
      await new Promise(z => setTimeout(z, 1500));
      window.__sheetBusy = false; return sc.sheet;
    };
    window.rrRemoveRowConfirmed = async function () { return true; };
    window._cachePersonalData = function () {};
    window.appConfirm = async function () { return sc.confirm; };
    const _t = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); try { _t.apply(this, arguments); } catch (e) {} };
    // open the item page for the chosen copy, the way My Collection does
    goToMyCollection(); await new Promise(z => setTimeout(z, 300));
    const pdOpen = state.personalData[sc.open];
    const idx = state.masterData.findIndex(m => m.itemNum === pdOpen.itemNum);
    showItemDetailPage(idx, sc.open); await new Promise(z => setTimeout(z, 500));
    const pageOf = () => ((document.querySelector('.page.active') || {}).id || '');
    const before = pageOf();
    const btn = [...document.querySelectorAll('#detail-remove-item')].find(b => b.offsetParent !== null) || document.getElementById('detail-remove-item');
    if (!btn) return { error: 'no remove button', before };
    btn.click();
    if (sc.group) {
      await new Promise(z => setTimeout(z, 300));
      const g = document.getElementById('rm-' + (sc.group === 'all' ? 'all-group' : sc.group));
      if (g) g.click();
    }
    await new Promise(z => setTimeout(z, 300));
    const soon = { page: pageOf(), owned: !!state.filters.owned, busy: window.__sheetBusy, keys: Object.keys(state.personalData).sort() };
    await new Promise(z => setTimeout(z, 2400));
    const later = { page: pageOf(), keys: Object.keys(state.personalData).sort(), toasts: window.__toasts.slice(), del: window.__del.slice() };
    return { before, soon, later };
  }, sc);
  await pg.close();
  return Object.assign(out, { errs });
}

const ONE = [['147', '6-36814']];
const THREE = [['147', '6-36814'], ['457', '6-36814'], ['466', '6-36814']];

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  console.log('== R · remove leaves the item page at once ==');
  let r = await run(browser, { copies: ONE, open: '147', confirm: true, sheet: true });
  T('R1 one copy: the item page was showing', /detail/.test(r.before), r.before);
  T('R1 confirmed → on My Collection WHILE the sheet is still working, the copy already gone', /browse/.test(r.soon.page) && r.soon.owned && r.soon.busy && r.soon.keys.length === 0, r.soon);
  T('R1 …then "✓ Removed from collection"', r.later.toasts.some(t => /Removed from collection/.test(t)) && r.later.keys.length === 0, r.later);
  T('R6 the sheet was asked to delete THIS copy\'s row, by its inventory number', r.later.del.length === 1 && r.later.del[0].inv === '147' && r.later.del[0].row === 10, r.later.del);
  T('page errors (R1)', r.errs.length === 0, r.errs);

  r = await run(browser, { copies: THREE, open: '457', confirm: true, sheet: true });
  T('R2 THE BUG: three copies, remove 457 → on My Collection at once', /browse/.test(r.soon.page) && r.soon.busy, r.soon);
  T('R2 …only 457 went; 147 and 466 stay', r.later.keys.join(',') === '147,466' && r.later.del.length === 1 && r.later.del[0].inv === '457', r.later);
  T('page errors (R2)', r.errs.length === 0, r.errs);

  r = await run(browser, { copies: THREE, open: '457', confirm: false, sheet: true });
  T('R3 cancel → stays on the item page, all three still there, the sheet untouched', /detail/.test(r.later.page) && r.later.keys.length === 3 && r.later.del.length === 0, r.later);

  r = await run(browser, { copies: THREE, open: '466', confirm: true, sheet: false });
  T('R4 the sheet refuses → it left at once, then 466 comes back', /browse/.test(r.soon.page) && r.soon.keys.join(',') === '147,457' && r.later.keys.join(',') === '147,457,466', { soon: r.soon, later: r.later.keys });
  T('R4 …with a message that it is still in the collection', r.later.toasts.some(t => /still in your collection/.test(t)), r.later.toasts);
  T('page errors (R4)', r.errs.length === 0, r.errs);

  r = await run(browser, { copies: [['457', '6-36814', 'g1'], ['901', '6-36814-BOX', 'g1'], ['147', '6-36814']], open: '457', confirm: true, sheet: true, group: 'all' });
  T('R5 a set → Remove ALL pieces → on My Collection at once; both pieces go, 147 stays', /browse/.test(r.soon.page) && r.soon.busy && r.later.keys.join(',') === '147' && r.later.del.length === 2, { soon: r.soon, later: r.later });
  T('page errors (R5)', r.errs.length === 0, r.errs);

  console.log('== X · planted ==');
  const OLD = planted(COLL, "    await removeCollectionItem(itemNum, variation, row, pd ? pd.inventoryId : '', rrRemoveLeaveNow());\n  }\n}",
    "    await removeCollectionItem(itemNum, variation, row, pd ? pd.inventoryId : '');\n  }\n" +
    "  var gone = !Object.values(state.personalData || {}).some(function(p) { return p && p.owned && rrSameNum(p.itemNum, itemNum) && rrSameVar(p.variation, variation); });\n" +
    "  if (gone) { if (typeof _detailBackToBrowse === 'function') _detailBackToBrowse(); }\n}", 'old handler');
  r = await run(browser, { copies: THREE, open: '457', confirm: true, sheet: true }, { 'app-collection.js': OLD });
  T('X-R2 PLANTED: the old wait-then-check-the-number handler → still on the item page (caught)', /detail/.test(r.later.page), r.later.page);

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
