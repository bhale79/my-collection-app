#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// COLLECTOR'S MARKET: SALES ARE SENT, AND EVERY CHANGE IS SENT — v0.9.1992
//                                                         (real Chromium)
//
// [stated] Brad, 2026-10-19: "can you check to see if the community
// submissions is working for when a person add an item that is on the master
// list, that we get a entry for the item, the condition, and the estimated
// worth or if they sale an item, its details and its sales price" → the plan
// → "yes". Found: a sale was never sent (the send read My Collection only,
// and a sold item leaves it), and a change waited up to a week unless it was
// made in the Add steps. Relay v4.7/v4.8 (live 2026-10-19) keep sales.
//
//   S*  what one send carries: Brad's 115 sale (item, variation, condition,
//       $60, the Sheets serial 46309 → 2026-10-14, maker) beside the owned
//       items; NOT a part from the Workbench, a $0 sale, a sale with no
//       condition, an item outside the catalog, a sale being taken back; no
//       buyer, place or notes ever leave
//   O*  owned items exactly as before (condition, worth, grouped companion)
//   W*  send on change: nothing changed → nothing sent; a condition edit, a
//       new sale, a sale taken back → sent; one send at a time; never sooner
//       than the gap; the weekly safety net; opted out → nothing; the watcher
//       sends with no screen asking
//   M*  the market card: sale prices in their own block; sales alone show;
//       the old answer (no `sold`) draws as before; no rarity from sales
//   X*  PLANTED: the old vault.js (sales never sent; the watcher missing)
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  community_sales_1992_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const VAULT_SRC = fs.readFileSync(path.join(APP, 'vault.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 600))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}

const MASTER = [
  { itemNum: '115', variation: '1', _era: 'pw', manufacturer: 'Lionel', itemType: 'Accessory', description: 'City Station' },
  { itemNum: '2343', variation: '', _era: 'pw', manufacturer: 'Lionel', itemType: 'Diesel', description: 'Santa Fe F3' },
  { itemNum: '2343T', variation: '', _era: 'pw', manufacturer: 'Lionel', itemType: 'Diesel', description: 'Santa Fe F3 dummy' },
  { itemNum: '6464-1', variation: '2', _era: 'pw', manufacturer: 'Lionel', itemType: 'Boxcar', description: 'Western Pacific' },
  { itemNum: '2025', variation: '', _era: 'pw', manufacturer: 'Lionel', itemType: 'Steam', description: '2-6-2' },
];
const OWNED = {
  '501': { itemNum: '6464-1', variation: '2', owned: true, inventoryId: '501', condition: '8', userEstWorth: '150', manufacturer: 'Lionel' },
  '502': { itemNum: '2343', variation: '', owned: true, inventoryId: '502', condition: '7', userEstWorth: '400', groupId: 'GRP-1', manufacturer: 'Lionel' },
  '503': { itemNum: '2343-T', variation: '', owned: true, inventoryId: '503', condition: '7', userEstWorth: '', groupId: 'GRP-1', manufacturer: 'Lionel' },
  '504': { itemNum: '2025', variation: '', owned: true, inventoryId: '504', condition: '', userEstWorth: '125', manufacturer: 'Lionel' },
};
const SOLD = {
  'sold-3': { row: 3, key: 'sold-3', itemNum: '115', variation: '1', condition: '6', salePrice: '60', dateSold: '46309', manufacturer: 'Lionel', notes: 'to the club', soldTo: 'Joe', soldAt: 'York' },
  'sold-4': { row: 4, key: 'sold-4', itemNum: '2343-25', variation: '', condition: '', salePrice: '12', dateSold: '2026-10-01', notes: 'Part from Parts Bin — brush holder', manufacturer: '' },
  'sold-5': { row: 5, key: 'sold-5', itemNum: '2025', variation: '', condition: '7', salePrice: '0', dateSold: '2026-10-02', manufacturer: 'Lionel' },
  'sold-6': { row: 6, key: 'sold-6', itemNum: '6464-1', variation: '2', condition: '', salePrice: '90', dateSold: '2026-10-03', manufacturer: 'Lionel' },
  'sold-7': { row: 7, key: 'sold-7', itemNum: 'DWG-1957-468', variation: '', condition: '8', salePrice: '50', dateSold: '2026-10-04', manufacturer: 'Lionel' },
  'sold-8': { row: 8, key: 'sold-8', itemNum: '2343', variation: '', condition: '7', salePrice: '$1,250', dateSold: '10/05/2026', manufacturer: 'Lionel', _returnBusy: true },
};

async function boot(browser, files) {
  const pg = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(([master, owned, sold]) => {
    state.user = { email: 'tester@example.com' };
    state.masterData = master.slice(); try { _rebuildMasterIndex(); } catch (e) {}
    state.personalData = JSON.parse(JSON.stringify(owned));
    state.soldData = JSON.parse(JSON.stringify(sold));
    window.__posts = [];
    window.vaultPost = async function (p) { window.__posts.push(JSON.parse(JSON.stringify(p))); await new Promise(z => setTimeout(z, 30)); return { status: 200, rows_written: (p.items || []).length }; };
    vaultSetOptIn(true);
    try { localStorage.removeItem(VAULT.KEY_SENT_SIG || 'x'); localStorage.removeItem(VAULT.KEY_LAST_SUB); } catch (e) {}
    VAULT.SEND_MIN_GAP_MS = 0;
  }, [MASTER, OWNED, SOLD]);
  return { pg, errs };
}
const send = pg => pg.evaluate(async () => { const n = window.__posts.length; await vaultSubmitData(); return window.__posts.slice(n); });

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const DATE_115 = new Date((46309 - 25569) * 864e5).toISOString().slice(0, 10);   // the Sheets serial, read by the test's own arithmetic

  console.log('== S · what one send carries ==');
  let { pg, errs } = await boot(browser);
  let sent = await send(pg);
  const items = (sent[0] && sent[0].items) || [];
  const sales = items.filter(i => i.kind === 'sold');
  T('S1 one send', sent.length === 1 && sent[0].action === 'submit' && !!sent[0].token, sent.map(p => p.action));
  const s115 = sales.find(i => i.item_num === '115');
  T('S2 Brad\'s 115 sale: item, variation, condition, price, date, maker', !!s115 && s115.variation === '1' && s115.condition === '6' && s115.sold_price === 60
    && s115.date_sold === DATE_115 && s115.manufacturer === 'Lionel' && s115.est_worth === 0 && s115.in_master === true, s115);
  T('S2 …the serial 46309 became ' + DATE_115, !!s115 && s115.date_sold === '2026-10-14', s115 && s115.date_sold);
  T('S3 only that sale goes: no part, no $0, no missing condition, nothing outside the catalog, nothing being taken back', sales.length === 1, sales.map(i => i.item_num));
  T('S4 no buyer, place or notes ever leave', !JSON.stringify(sent[0]).match(/Joe|York|to the club|brush holder/), JSON.stringify(sent[0]).slice(0, 300));
  T('page errors', errs.length === 0, errs);

  console.log('== O · owned items as before ==');
  const own = items.filter(i => i.kind === 'owned');
  const o6464 = own.find(i => i.item_num === '6464-1');
  T('O1 6464-1: condition 8, worth 150, owned', !!o6464 && o6464.condition === '8' && o6464.est_worth === 150 && o6464.variation === '2', o6464);
  const tdummy = own.find(i => i.item_num === '2343-T');
  T('O2 the $0 dummy is marked as priced on its lead', !!tdummy && tdummy.source === 'grouped with 2343', tdummy);
  T('O3 an owned item with no condition stays out (as before)', !own.some(i => i.item_num === '2025'), own.map(i => i.item_num));
  T('O4 owned rows carry no sale price', own.every(i => i.sold_price === 0), own.map(i => i.sold_price));

  console.log('== W · send on change ==');
  sent = await send(pg);
  T('W1 nothing changed → nothing sent', sent.length === 0, sent.length);
  await pg.evaluate(() => { state.personalData['501'].condition = '9'; });
  sent = await send(pg);
  T('W2 a condition edit → sent', sent.length === 1 && sent[0].items.some(i => i.item_num === '6464-1' && i.condition === '9'), sent.length);
  await pg.evaluate(() => { state.soldData['sold-9'] = { key: 'sold-9', itemNum: '2343', variation: '', condition: '8', salePrice: '$1,100', dateSold: '2026-10-18', manufacturer: 'Lionel' }; });
  sent = await send(pg);
  const s2343 = sent[0] && sent[0].items.find(i => i.kind === 'sold' && i.item_num === '2343');
  T('W3 a new sale → sent ($1,100 read as 1100)', !!s2343 && s2343.sold_price === 1100 && s2343.date_sold === '2026-10-18', s2343);
  await pg.evaluate(() => { delete state.soldData['sold-9']; });
  sent = await send(pg);
  T('W4 the sale taken back (Returned) → sent without it', sent.length === 1 && !sent[0].items.some(i => i.kind === 'sold' && i.item_num === '2343'), sent.length);
  const twin = await pg.evaluate(async () => { state.personalData['501'].condition = '7'; const n = window.__posts.length; await Promise.all([vaultSubmitData(), vaultSubmitData()]); return window.__posts.length - n; });
  T('W5 two asks at once → ONE send', twin === 1, twin);
  const gap = await pg.evaluate(async () => { VAULT.SEND_MIN_GAP_MS = 60000; await vaultSubmitData(); state.personalData['501'].condition = '6'; const n = window.__posts.length; await vaultSubmitData(); const r = window.__posts.length - n; VAULT.SEND_MIN_GAP_MS = 0; return r; });
  T('W6 inside the gap → waits (the next tick sends it)', gap === 0, gap);
  sent = await send(pg);
  T('W6 …and after the gap it goes', sent.length === 1, sent.length);
  const week = await pg.evaluate(async () => { localStorage.setItem(VAULT.KEY_LAST_SUB, String(Date.now() - VAULT.SUBMIT_INTERVAL_MS - 1000)); const n = window.__posts.length; await vaultSubmitData(); return window.__posts.length - n; });
  T('W7 unchanged for a week → the safety net sends anyway', week === 1, week);
  const out = await pg.evaluate(async () => { vaultSetOptIn(false); state.personalData['501'].condition = '5'; const n = window.__posts.length; await vaultSubmitData(); const r = window.__posts.length - n; vaultSetOptIn(true); return r; });
  T('W8 opted out → nothing sent', out === 0, out);
  const watched = await pg.evaluate(async () => {
    VAULT.WATCH_MS = 150; vaultInit();
    state.soldData['sold-10'] = { key: 'sold-10', itemNum: '6464-1', variation: '2', condition: '8', salePrice: '140', dateSold: '2026-10-19', manufacturer: 'Lionel' };
    const n = window.__posts.length;
    await new Promise(z => setTimeout(z, 1200));
    const got = window.__posts.slice(n).filter(p => p.action === 'submit');
    return { sends: got.length, hasSale: got.some(p => p.items.some(i => i.kind === 'sold' && i.item_num === '6464-1' && i.sold_price === 140)) };
  });
  T('W9 the watcher sends the new sale with no screen asking', watched.sends >= 1 && watched.hasSale, watched);
  await pg.close();

  console.log('== M · the market card ==');
  ({ pg, errs } = await boot(browser));
  const card = await pg.evaluate(() => {
    const strip = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.replace(/\s+/g, ' ').trim(); };
    const m = { C7: { avg: 400, low: 300, high: 500, count: 12 } }, s = { C7: { avg: 360, low: 320, high: 410, count: 4 }, C6: { avg: 250, low: 250, high: 250, count: 1 } };
    return { both: strip(_vaultCardData(m, 400, s)), soldOnly: strip(_vaultCardData({}, 400, s)), old: strip(_vaultCardData(m, 400)) };
  });
  T('M1 both: estimated worth AND sold prices, each in its own block', /Estimated worth/.test(card.both) && /Sold prices/.test(card.both) && /\$320 – \$410/.test(card.both) && /4 sales/.test(card.both) && /1 sale\b/.test(card.both), card.both);
  T('M2 sales alone still show (no "no data")', /Sold prices/.test(card.soldOnly) && /\$250/.test(card.soldOnly) && !/Rarity/.test(card.soldOnly), card.soldOnly);
  T('M3 an answer without `sold` draws as before', /\$300 – \$500/.test(card.old) && !/Sold prices/.test(card.old) && /Based on 12 contributor reports\./.test(card.old), card.old);
  T('page errors', errs.length === 0, errs);
  await pg.close();

  console.log('== X · planted ==');
  const NOSALES = planted(VAULT_SRC, "  if (typeof state !== 'undefined' && state.soldData) {", "  if (false) {", 'sales loop');
  ({ pg, errs } = await boot(browser, { 'vault.js': NOSALES }));
  const xs = await pg.evaluate(async () => { const n = window.__posts.length; await vaultSubmitData(); return window.__posts.slice(n); });
  const xItems = (xs[0] && xs[0].items) || [];
  T('X-S2 PLANTED: the sales left out (the old send) → no sale goes (caught)', xs.length === 1 && !xItems.some(i => i.item_num === '115' && i.sold_price > 0), xItems.map(i => i.item_num + ':' + i.sold_price));
  await pg.close();
  const WEEKLY = planted(VAULT_SRC, "  if (sig !== (localStorage.getItem(VAULT.KEY_SENT_SIG) || '')) return true;\n", '', 'change test');
  ({ pg, errs } = await boot(browser, { 'vault.js': WEEKLY }));
  const xw = await pg.evaluate(async () => { await vaultSubmitData(); state.personalData['501'].condition = '10'; const n = window.__posts.length; await vaultSubmitData(); return window.__posts.length - n; });
  T('X-W2 PLANTED: only the weekly timer (the old rule) → a condition edit waits a week (caught)', xw === 0, xw);
  await pg.close();
  const NOWATCH = planted(VAULT_SRC, '  vaultWatchStart();\n}', '\n}', 'watcher start');
  ({ pg, errs } = await boot(browser, { 'vault.js': NOWATCH }));
  const xn = await pg.evaluate(async () => {
    VAULT.WATCH_MS = 150; vaultInit();
    await new Promise(z => setTimeout(z, 3500));   // past vaultInit's own one-off send at 3 s
    state.soldData['sold-11'] = { key: 'sold-11', itemNum: '115', variation: '1', condition: '5', salePrice: '45', dateSold: '2026-10-19', manufacturer: 'Lionel' };
    const n = window.__posts.length;
    await new Promise(z => setTimeout(z, 1200));
    return window.__posts.length - n;
  });
  T('X-W9 PLANTED: no watcher → the new sale is never sent (caught)', xn === 0, xn);
  await pg.close();

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
