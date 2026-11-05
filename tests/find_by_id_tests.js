// ═══════════════════════════════════════════════════════════════
// find_by_id_tests.js — FIND BY ID (2026-11-04, [stated] Brad "Yes" to
// PLAN_2026-11-04_FIND_BY_ID.md, from the four-platform audit's findings 1–3).
//
// TWO DEVICES, ONE SHEET. Device B removes an item higher up the list, so
// Google deletes that row and every row below moves up one. Device A still
// holds the old row numbers. Before this release A's next save was refused
// ("That row moved… Refresh and try again"), a Remove was refused, and a SALE
// was written to Sold while the collection row was refused — "✓ Added to Sold!"
// over an item that was now both owned and sold (audit F7, live, several times).
// And when Google said "too many requests", the identity check was skipped and
// the write went ahead anyway.
//
// Proved here on the REAL sheets.js (and app.js's two My Collection writers,
// write-outbox.js's replay) against a stand-in Google that holds the rows and
// really shifts them on a delete:
//   A  rrWhereIsRow: unmoved · moved (found ONCE, every record put back) · gone ·
//      on two rows · no id to find it by · Google busy then answers · busy
//      throughout (NOTHING written) · offline
//   B  every gate saves to the row the record is on NOW and never touches the
//      old row: sheetsUpdateRow, rrVerifiedRowUpdate, rrRemoveRowConfirmed (the
//      copy kept is of the RIGHT row), sheetsDeleteRow (returns the row deleted)
//   C  refusals say why (gone / twice / busy), and write nothing
//   D  the outbox: a queued row write that says who it is for goes to where the
//      record is when it is sent; one whose record is gone is never sent
//   E  the sale order (wizard-save.js sold path, app-pages.js markForSaleAsSold):
//      the copy is found BEFORE the Sold row is written; a sale whose copy could
//      not be taken off says so instead of "✓ Added to Sold!"
//   P  planted offenders — the old refuse-on-move, "writing anyway", the old
//      sale order, a renumber from the remembered row — each turns this red.
// Run:  node tests/find_by_id_tests.js
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = (f) => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const SHEETS = APP('sheets.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

const MINE = 'personal-sheet';
const MC = 'My Collection', FS = 'For Sale', TRASH = 'Deleted Rows';
// The tab layouts the identity check reads (column H = Inventory ID on My
// Collection in this stand-in; For Sale's from its own headers, column I).
const FOR_SALE_HEADERS = ['Item Number', 'Variation', 'Condition', 'Asking Price', 'Date Listed', 'Notes', 'Original Price', 'Est Worth', 'Inventory ID', 'Manufacturer'];
const colIdx = (letters) => letters.split('').reduce((a, c) => a * 26 + (c.charCodeAt(0) - 64), 0) - 1;
const colLetter = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

// A My Collection row: number, variation, …, Inventory ID in H.
const mcRow = (num, id) => [num, '1', '', '', '', '', '', String(id)];
const fsRow = (num, id, price) => [num, '1', '7', String(price), '', '', '', '', String(id), 'Lionel'];

// ── a stand-in Google: real rows, real shifting on delete ──────────────────
function boot(opts) {
  opts = opts || {};
  const calls = [], toasts = [];
  const tabs = {};                         // tab -> array of rows; index 0 = sheet row 3
  tabs[MC] = (opts.mc || []).map(r => r.slice());
  tabs[FS] = (opts.fs || []).map(r => r.slice());
  tabs[TRASH] = [];
  let busyLeft = opts.busyReads || 0;      // reads answered 429 before Google answers again
  const reply = (body, status) => Promise.resolve({ ok: !status || status < 400, status: status || 200,
    headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) });
  const parse = (range) => {
    const m = /^(.+?)!([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/.exec(range);
    return m ? { tab: m[1].replace(/^'|'$/g, ''), c1: colIdx(m[2]), r1: m[3] ? +m[3] : 3, c2: colIdx(m[4] || m[2]), r2: m[5] ? +m[5] : (m[3] && !m[4] ? +m[3] : null) } : null;
  };
  const fetch = (url, init) => {
    const u = decodeURIComponent(String(url));
    const method = (init && init.method) || 'GET';
    const body = init && init.body ? JSON.parse(init.body) : null;
    if (method === 'GET' && /\?fields=sheets\.properties/.test(u)) {
      calls.push({ kind: 'meta' });
      return reply({ sheets: Object.keys(tabs).map((t, i) => ({ properties: { title: t, sheetId: 100 + i } })) });
    }
    if (method === 'GET' && /\/values\//.test(u)) {
      const range = (u.match(/\/values\/([^?]+)/) || [])[1];
      if (busyLeft > 0) { busyLeft--; calls.push({ kind: 'read429', range }); return reply({ error: { code: 429, message: 'Quota exceeded' } }, 429); }
      calls.push({ kind: 'read', range });
      const p = parse(range); const rows = tabs[p.tab] || [];
      const last = p.r2 == null ? rows.length + 2 : p.r2;
      const out = [];
      for (let r = p.r1; r <= last; r++) out.push((rows[r - 3] || []).slice(p.c1, p.c2 + 1));
      while (out.length && !out[out.length - 1].length) out.pop();
      return reply({ values: out });
    }
    if (method === 'PUT' && /\/values\//.test(u)) {
      const range = (u.match(/\/values\/([^?]+)/) || [])[1];
      calls.push({ kind: 'write', range, values: body && body.values });
      const p = parse(range); const rows = tabs[p.tab];
      (body.values || []).forEach((vals, k) => {
        const r = p.r1 + k; while (rows.length < r - 2) rows.push([]);
        const row = rows[r - 3]; vals.forEach((v, j) => { row[p.c1 + j] = v; });
      });
      return reply({ updatedCells: 1 });
    }
    if (method === 'POST' && /:append/.test(u)) {
      const range = (u.match(/\/values\/([^?:]+)/) || [])[1];
      const tab = range.split('!')[0].replace(/^'|'$/g, '');
      calls.push({ kind: 'append', tab, values: body && body.values });
      (tabs[tab] = tabs[tab] || []).push(...(body.values || []).map(r => r.slice()));
      return reply({ updates: { updatedRange: tab + '!A' + (tabs[tab].length + 2) } });
    }
    if (method === 'POST' && /:batchUpdate/.test(u)) {
      const r = ((body && body.requests) || [])[0] || {};
      if (r.deleteDimension) {
        const name = Object.keys(tabs)[r.deleteDimension.range.sheetId - 100];
        calls.push({ kind: 'DELETE', tab: name, row: r.deleteDimension.range.startIndex + 1 });
        tabs[name].splice(r.deleteDimension.range.startIndex - 2, 1);
      } else calls.push({ kind: 'batch' });
      return reply({ replies: [{}] });
    }
    calls.push({ kind: 'other', url: u, method });
    return reply({});
  };
  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    setTimeout, clearTimeout, fetch, encodeURIComponent, decodeURIComponent, Date, JSON, Promise, Number, String, Object, Array, Math, Error, RegExp,
    accessToken: 'tok', API_KEY: '',
    state: { personalSheetId: MINE, masterSheetId: 'master', personalData: {}, forSaleData: {}, soldData: {}, upgradeData: {} },
    PERSONAL_TAB: MC, PERSONAL_FIELD_INDEX: { inventoryId: 7 }, FOR_SALE_HEADERS, colLetter,
    showToast: (m) => toasts.push(String(m)),
    navigator: { onLine: !opts.offline },
    // the words, as config.js has them, with short waits so the busy cases run fast
    RR_FIND_BY_ID: Object.assign({}, CONFIG_WORDS, { retryWaitsMs: [5, 5, 5] }),
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  sandbox.rrToday = require('./lib/rr-today.js');
  vm.runInContext(opts.sheetsSrc || SHEETS, sandbox, { filename: 'sheets.js' });
  // device A's memory: every row as it was when A loaded the sheet
  (opts.mc || []).forEach((r, i) => { sandbox.state.personalData[r[7]] = { itemNum: r[0], variation: r[1], inventoryId: r[7], row: i + 3 }; });
  (opts.fs || []).forEach((r, i) => { sandbox.state.forSaleData[r[8]] = { itemNum: r[0], variation: r[1], inventoryId: r[8], askingPrice: r[3], row: i + 3 }; });
  return { sandbox, calls, toasts, tabs,
           // device B removes the item on sheet row n of a tab (Google shifts the rest)
           removeElsewhere: (tab, n) => tabs[tab].splice(n - 3, 1) };
}
// config.js's RR_FIND_BY_ID, lifted (never a copy of its words)
const CFG = APP('config.js');
const CONFIG_WORDS = (function () {
  const m = /const RR_FIND_BY_ID = (\{[\s\S]*?\n\});/.exec(CFG);
  if (!m) throw new Error('RR_FIND_BY_ID not found in config.js');
  return vm.runInNewContext('(' + m[1] + ')');
})();
const writesTo = (calls, re) => calls.filter(c => c.kind === 'write' && re.test(c.range));
const STANDARD = () => ({ mc: [mcRow('2343', 10), mcRow('2343', 11), mcRow('2245', 12), mcRow('6464-1', 13)],
                          fs: [fsRow('2343', 11, 9), fsRow('6464-1', 13, 25)] });

(async function main() {
  section('Sanity — the stand-in and the lifted words');
  ok('config.js holds the words (gone / twice / busy / sale words)', ['gone', 'twice', 'busy', 'saleKept', 'saleStopped', 'outboxDropped'].every(k => typeof CONFIG_WORDS[k] === 'string' && CONFIG_WORDS[k].length > 10));
  ok('…and the waits (never "write anyway" — it waits, then stops)', Array.isArray(CONFIG_WORDS.retryWaitsMs) && CONFIG_WORDS.retryWaitsMs.length >= 2);
  {
    const t = boot(STANDARD());
    ok('the stand-in reads a row', (await t.sandbox.sheetsGet(MINE, 'My Collection!A4:H4')).values[0][7] === '11');
    t.removeElsewhere(MC, 3);
    ok('…and a delete elsewhere moves every row below up one', (await t.sandbox.sheetsGet(MINE, 'My Collection!A4:H4')).values[0][7] === '12');
  }

  section('A · rrWhereIsRow — where is the record NOW?');
  {
    const t = boot(STANDARD());
    const r = await t.sandbox.rrWhereIsRow(MINE, MC, 4, '2343', '11');
    ok('A1 unmoved: the same row, ok', r.ok && r.row === 4 && !r.moved, JSON.stringify(r));
  }
  {
    const t = boot(STANDARD());
    t.removeElsewhere(MC, 3);                                  // B removes ID 10 (row 3)
    const r = await t.sandbox.rrWhereIsRow(MINE, MC, 5, '2245', '12');
    ok('A2 moved: found by its Inventory ID at its new row', r.ok && r.row === 4 && r.moved === true, JSON.stringify(r));
    const pd = t.sandbox.state.personalData;
    ok('A2b …and the same read put EVERY record of that tab back at its row', pd['11'].row === 3 && pd['12'].row === 4 && pd['13'].row === 5, JSON.stringify(Object.values(pd).map(p => p.inventoryId + '@' + p.row)));
    ok('A2c …ONE extra read (the id column), nothing written', t.calls.filter(c => c.kind === 'read').length === 2 && !t.calls.some(c => c.kind === 'write'), t.calls.map(c => c.kind).join('>'));
  }
  {
    const t = boot(STANDARD());
    t.removeElsewhere(MC, 4);                                  // B removes ID 11 itself
    const r = await t.sandbox.rrWhereIsRow(MINE, MC, 4, '2343', '11');
    ok('A3 gone: removed on the other device → refused, why "gone"', !r.ok && r.why === 'gone', JSON.stringify(r));
  }
  {
    const o = STANDARD(); o.mc.push(mcRow('2343', 11));         // the same id twice
    const t = boot(o); t.removeElsewhere(MC, 3);
    const r = await t.sandbox.rrWhereIsRow(MINE, MC, 4, '2343', '11');
    ok('A4 on two rows → refused, why "twice" (it never guesses)', !r.ok && r.why === 'twice', JSON.stringify(r));
  }
  {
    const t = boot(STANDARD()); t.removeElsewhere(MC, 3);
    const r = await t.sandbox.rrWhereIsRow(MINE, MC, 4, '6464-1', '');
    ok('A5 an old row with no Inventory ID that moved → refused as before (nothing to find it by)', !r.ok && r.why === 'moved', JSON.stringify(r));
  }
  {
    const t = boot(Object.assign(STANDARD(), { busyReads: 2 }));
    const r = await t.sandbox.rrWhereIsRow(MINE, MC, 4, '2343', '11');
    ok('A6 Google busy twice, then answers → ok (it waited and asked again)', r.ok && r.row === 4 && t.calls.filter(c => c.kind === 'read429').length === 2, JSON.stringify(r));
  }
  {
    const t = boot(Object.assign(STANDARD(), { busyReads: 99 }));
    const r = await t.sandbox.rrWhereIsRow(MINE, MC, 4, '2343', '11');
    ok('A7 Google busy throughout → refused, why "busy" (never "write anyway")', !r.ok && r.why === 'busy', JSON.stringify(r));
    const w = await t.sandbox.sheetsUpdateRow(MINE, 'My Collection!A4:H4', [mcRow('2343', 11)], { itemNum: '2343', inventoryId: '11' });
    ok('A7b …and the gate behind it writes NOTHING', w === false && !t.calls.some(c => c.kind === 'write'), t.calls.map(c => c.kind).join('>'));
    ok('A7c …and says Google is busy', t.toasts.some(x => x === CONFIG_WORDS.busy), t.toasts.join(' | '));
  }
  {
    const t = boot(Object.assign(STANDARD(), { offline: true }));
    const r = await t.sandbox.rrWhereIsRow(MINE, MC, 4, '2343', '11');
    ok('A8 offline → ok at the remembered row (the write is queued, re-checked when it is sent)', r.ok && r.row === 4 && r.offline === true, JSON.stringify(r));
  }
  {
    const t = boot(STANDARD()); t.removeElsewhere(MC, 3);
    ok('A9 rrRowStillIs (yes/no) is "no" for a record that moved', (await t.sandbox.rrRowStillIs(MINE, MC, 5, '2245', '12')) === false);
    ok('A9b …and "yes" where it still is', (await t.sandbox.rrRowStillIs(MINE, MC, 4, '2245', '12')) === true);
  }

  section('B · every gate saves where the record is NOW — the other item is never touched');
  {
    const t = boot(STANDARD()); t.removeElsewhere(MC, 3);
    const exp = { itemNum: '2245', inventoryId: '12' };
    const ok1 = await t.sandbox.sheetsUpdateRow(MINE, 'My Collection!A5:H5', [['2245', '1', 'EDITED', '', '', '', '', '12']], exp);
    ok('B1 sheetsUpdateRow: saved', ok1 === true && exp.foundRow === 4, JSON.stringify(exp));
    ok('B1b …on row 4 (where 2245 is now), never row 5 (now 6464-1)', writesTo(t.calls, /!A4:H4$/).length === 1 && !writesTo(t.calls, /5/).length && t.tabs[MC][1][2] === 'EDITED' && t.tabs[MC][2][0] === '6464-1' && t.tabs[MC][2][2] === '', JSON.stringify(t.tabs[MC]));
  }
  {
    const t = boot(STANDARD()); t.removeElsewhere(MC, 3);
    const ok1 = await t.sandbox.rrVerifiedRowUpdate(MINE, MC, 5, 'My Collection!C5', [['8']], { num: '2245', invId: '12' }, 'collection');
    ok('B2 rrVerifiedRowUpdate (one cell): lands on the moved row', ok1 === true && writesTo(t.calls, /!C4$/).length === 1 && t.tabs[MC][1][2] === '8' && t.tabs[MC][2][2] === '', t.calls.map(c => c.kind + ':' + (c.range || '')).join(' '));
  }
  {
    const t = boot(STANDARD()); t.removeElsewhere(FS, 3);       // B sells/unlists the first listing
    const ok1 = await t.sandbox.rrRemoveRowConfirmed(MINE, FS, 4, 'For Sale!A4:J4', [Array(10).fill('')], { num: '6464-1', invId: '13' }, 'For Sale list');
    ok('B3 rrRemoveRowConfirmed: the listing at its new row is blanked', ok1 === true && writesTo(t.calls, /For Sale!A3:J3$/).length === 1 && t.tabs[FS][0].join('') === '', t.calls.map(c => c.kind + ':' + (c.range || c.tab || '')).join(' '));
    const kept = t.tabs[TRASH].find(r => r.join('|').indexOf('6464-1') >= 0);
    ok('B3b …and the copy kept in Deleted Rows is of THAT listing', !!kept, JSON.stringify(t.tabs[TRASH]));
  }
  {
    const t = boot(STANDARD()); t.removeElsewhere(MC, 3);
    const got = await t.sandbox.sheetsDeleteRow(MINE, MC, 6, { itemNum: '6464-1', inventoryId: '13' });
    const del = t.calls.find(c => c.kind === 'DELETE');
    ok('B4 sheetsDeleteRow: deletes the row the item is on now, and says which', got === 5 && del && del.row === 5, JSON.stringify({ got, del }));
    ok('B4b …2343 #11 and 2245 are still there', t.tabs[MC].map(r => r[7]).join(',') === '11,12', t.tabs[MC].map(r => r[7]).join(','));
    ok('B4c …and a copy was kept first', t.tabs[TRASH].some(r => r.indexOf('13') >= 0));
  }

  section('C · refusals say why, and write nothing');
  {
    const t = boot(STANDARD()); t.removeElsewhere(MC, 4);
    const w = await t.sandbox.sheetsUpdateRow(MINE, 'My Collection!A4:H4', [mcRow('2343', 11)], { itemNum: '2343', inventoryId: '11' });
    ok('C1 gone: nothing written', w === false && !t.calls.some(c => c.kind === 'write'));
    ok('C1b …and the words say it was removed on another device', t.toasts.some(x => x === CONFIG_WORDS.gone.replace('{num}', '2343')), t.toasts.join(' | '));
  }
  {
    const o = STANDARD(); o.mc.push(mcRow('2343', 11)); const t = boot(o); t.removeElsewhere(MC, 3);
    const w = await t.sandbox.rrVerifiedRowUpdate(MINE, MC, 4, 'My Collection!C4', [['9']], { num: '2343', invId: '11' }, 'collection');
    ok('C2 twice: nothing written, and it says so', w === false && !t.calls.some(c => c.kind === 'write') && t.toasts.some(x => x === CONFIG_WORDS.twice.replace('{num}', '2343')), t.toasts.join(' | '));
  }
  {
    const t = boot(Object.assign(STANDARD(), { busyReads: 99 }));
    const got = await t.sandbox.sheetsDeleteRow(MINE, MC, 4, { itemNum: '2343', inventoryId: '11' });
    ok('C3 busy: no delete, no copy, says Google is busy', got === false && !t.calls.some(c => c.kind === 'DELETE' || c.kind === 'append') && t.toasts.some(x => x === CONFIG_WORDS.busy), t.toasts.join(' | '));
  }

  section('D · the outbox — a queued write goes where its record is when it is SENT');
  {
    // Load write-outbox.js beside sheets.js; queue while offline, then device B
    // removes a row above, then the queue is sent.
    const t = boot(Object.assign(STANDARD(), { offline: true }));
    const store = {};
    t.sandbox.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
    t.sandbox.document = { getElementById: () => null, querySelector: () => null, createElement: () => ({ style: {}, appendChild() {}, setAttribute() {}, addEventListener() {} }), body: { appendChild() {} }, addEventListener() {} };
    t.sandbox.addEventListener = () => {};
    let outboxLoaded = true;
    try { vm.runInContext(APP('write-outbox.js'), t.sandbox, { filename: 'write-outbox.js' }); } catch (e) { outboxLoaded = false; console.log('  (write-outbox.js did not load: ' + e.message + ')'); }
    ok('D0 write-outbox.js loads beside sheets.js', outboxLoaded && typeof t.sandbox.rrOutboxRetry === 'function');
    if (outboxLoaded) {
      try { await t.sandbox.sheetsUpdateRow(MINE, 'My Collection!A5:H5', [['2245', '1', 'OFFLINE EDIT', '', '', '', '', '12']], { itemNum: '2245', inventoryId: '12' }); } catch (e) {}
      const q = t.sandbox.rrOutboxList();
      ok('D1 offline: the edit is queued, and says who it is for', q.length === 1 && q[0].args.expect && q[0].args.expect.invId === '12', JSON.stringify(q.map(e => e.args)));
      t.sandbox.navigator.onLine = true;
      t.removeElsewhere(MC, 3);                               // meanwhile, on the other device
      const res = await t.sandbox.rrOutboxRetry({});
      ok('D2 back online: sent to row 4, where 2245 is now — not row 5', res.sent === 1 && t.tabs[MC][1][2] === 'OFFLINE EDIT' && t.tabs[MC][2][0] === '6464-1' && (t.tabs[MC][2][2] || '') === '', JSON.stringify(t.tabs[MC]) + ' ' + JSON.stringify(res));
      // a queued write whose record was removed elsewhere is never sent
      t.sandbox.navigator.onLine = false;
      try { await t.sandbox.sheetsUpdateRow(MINE, 'My Collection!A3:H3', [['2343', '1', 'NEVER', '', '', '', '', '11']], { itemNum: '2343', inventoryId: '11' }); } catch (e) {}
      t.sandbox.navigator.onLine = true;
      t.removeElsewhere(MC, 3);                               // 2343 #11 removed on the other device
      const before = JSON.stringify(t.tabs[MC]);
      const res2 = await t.sandbox.rrOutboxRetry({});
      ok('D3 the record is gone: the write is NEVER sent, nothing else is touched', JSON.stringify(t.tabs[MC]) === before && t.sandbox.rrOutboxCount() === 0, JSON.stringify(res2) + ' ' + JSON.stringify(t.tabs[MC]));
      ok('D3b …and the person is told once', t.toasts.some(x => x === CONFIG_WORDS.outboxDropped.replace('{num}', '2343')), t.toasts.join(' | '));
    }
  }

  section('E · a sale finds its copy BEFORE it writes, and never says "✓" over a copy still owned');
  const WS = APP('wizard-save.js'), AP = APP('app-pages.js'), APPJS = APP('app.js'), AC = APP('app-collection.js'), WZ = APP('wizard.js');
  const soldBranch = (() => { const a = WS.indexOf("} else if (tab === 'sold') {"); return WS.slice(a, WS.indexOf("} else if (tab === 'want')", a)); })();
  const saleOrderOk = (src, appendRe) => { const f = src.search(/rrWhereIsRow\(state\.personalSheetId, PERSONAL_TAB/); const a = src.search(appendRe); return f > 0 && a > 0 && f < a; };
  ok('E1 wizard sale: the copy is found (rrWhereIsRow) before the Sold row is appended', saleOrderOk(soldBranch, /sheetsAppend\(state\.personalSheetId, 'Sold!A:'/));
  ok('E1b …and a copy that cannot be found stops the sale with its own words (SALE_STOPPED + rrWords)', /new Error\('SALE_STOPPED'\)/.test(soldBranch) && /\.rrWords = /.test(soldBranch) && /RR_FIND_BY_ID\.saleStopped/.test(soldBranch));
  const mfs = (() => { const a = AP.indexOf('async function markForSaleAsSold('); return AP.slice(a, AP.indexOf('\n}\n', a)); })();
  ok('E2 one-box sale (markForSaleAsSold): found before the Sold row is appended', saleOrderOk(mfs, /sheetsAppend\(state\.personalSheetId, 'Sold!A:'/) && /SALE_STOPPED/.test(mfs));
  ok('E3 a refused take-off names the copy (saleKept) instead of "✓ Added to Sold!"', /_rrSaleKeptNum = collectionEntry\.itemNum/.test(soldBranch)
     && /if \(tab === 'sold' && _rrSaleKeptNum\) \{[\s\S]{0,200}RR_FIND_BY_ID\.saleKept/.test(WS));
  ok('E3b …and the copy is only forgotten when the sheet let go of it', /if \(!_rrSaleKeptNum && _collKey && state\.personalData\[_collKey\]\) delete state\.personalData\[_collKey\]/.test(soldBranch));
  const GROUP_KEPT = 'else if (!_rrSaleKeptNum) _rrSaleKeptNum = (_sp && _sp.itemNum) || itemNum;';
  ok('E3c a group piece the sheet kept is named too (no "✓" over it)', /if \(_spBlanked\) delete state\.personalData\[_gs\.sellPd\[_i\]\];/.test(soldBranch) && soldBranch.indexOf(GROUP_KEPT) > 0);
  ok('E4 rrSaveError says a refusal\'s own words (err.rrWords)', /if \(err && err\.rrWords\) return String\(err\.rrWords\);/.test(APP('write-outbox.js')));
  ok('E5 app.js: rrPersonalRemoveRow and rrPersonalSafeWrite ask rrWhereIsRow first',
     /async function rrPersonalRemoveRow[\s\S]{0,700}rrWhereIsRow\(state\.personalSheetId, PERSONAL_TAB, rec\.row/.test(APPJS)
     && /async function rrPersonalSafeWrite[\s\S]{0,1200}rrWhereIsRow\(state\.personalSheetId, PERSONAL_TAB, rec\.row/.test(APPJS));
  // every renumber after a delete uses the row REALLY deleted (sheetsDeleteRow's answer)
  const renumbers = [AC, WZ, WS].join('\n').match(/_adjustRowsAfterDelete\([^)]*\)/g) || [];
  const fromRemembered = renumbers.filter(c => /\.row\b|_delRow\b/.test(c) && !/function/.test(c));
  ok('E6 every renumber after a delete uses the row sheetsDeleteRow says it deleted', renumbers.length >= 6 && fromRemembered.length === 0, fromRemembered.join(' | '));
  ok('E7 no "writing anyway" is left in sheets.js', !/writing anyway/.test(SHEETS.replace(/^\s*\/\/.*$/mg, '')));

  section('P · planted offenders — each must turn a check red');
  // P1 the old refuse-on-move: rrWhereIsRow stops at the mismatch instead of looking
  {
    const anchor = '  // It moved. Find it by its Inventory ID — one read of that tab\'s id column.\n';
    ok('P1 anchor present (once)', SHEETS.split(anchor).length === 2);
    const planted = SHEETS.replace(anchor, anchor + "  return { ok: false, why: 'moved' };\n");
    const t = boot(Object.assign(STANDARD(), { sheetsSrc: planted })); t.removeElsewhere(MC, 3);
    const w = await t.sandbox.sheetsUpdateRow(MINE, 'My Collection!A5:H5', [['2245', '1', 'X', '', '', '', '', '12']], { itemNum: '2245', inventoryId: '12' });
    ok('P1 PLANTED old refuse-on-move → B1 would fail (the edit is refused)', w === false);
  }
  // P2 "writing anyway": a failed check counts as a pass
  {
    const anchor = "    return { ok: false, why: 'busy', err: rd.err };\n";
    ok('P2 anchor present (once)', SHEETS.split(anchor).length === 2);
    const planted = SHEETS.replace(anchor, '    return { ok: true, row: rowNum };   // PLANTED: writing anyway\n');
    const t = boot(Object.assign(STANDARD(), { busyReads: 99, sheetsSrc: planted }));
    const w = await t.sandbox.sheetsUpdateRow(MINE, 'My Collection!A4:H4', [mcRow('2343', 11)], { itemNum: '2343', inventoryId: '11' });
    ok('P2 PLANTED "writing anyway" → A7b would fail (a write goes out unchecked)', w === true);
  }
  // P3 the old sale order: the Sold row first, the copy found after
  // (today's 1eeff99b order: no find before the append — plant it by taking the
  //  first find out of each sale path, the way the live code had it)
  {
    const SOLD = /sheetsAppend\(state\.personalSheetId, 'Sold!A:'/;
    const unFind = (src) => src.replace('rrWhereIsRow(state.personalSheetId, PERSONAL_TAB', 'rrSkipped(state.personalSheetId, PERSONAL_TAB');
    ok('P3 anchors present (both sale paths)', unFind(soldBranch) !== soldBranch && unFind(mfs) !== mfs);
    ok('P3 PLANTED wizard sale with no find before the Sold row → E1 would fail', !saleOrderOk(unFind(soldBranch), SOLD));
    ok('P3b PLANTED one-box sale with no find before the Sold row → E2 would fail', !saleOrderOk(unFind(mfs), SOLD));
  }
  // P3c the group piece forgotten in the last message
  {
    const planted = soldBranch.replace(GROUP_KEPT, '');
    ok('P3c PLANTED group piece not named → E3c would fail', planted !== soldBranch && planted.indexOf(GROUP_KEPT) < 0);
  }
  // P4 a renumber from the remembered row
  {
    const planted = AC.replace('_adjustRowsAfterDelete(state.forSaleData, _fsEntGone, \'For Sale\')', '_adjustRowsAfterDelete(state.forSaleData, fsEntry.row, \'For Sale\')');
    ok('P4 anchor present', planted !== AC);
    const bad = ([planted, WZ, WS].join('\n').match(/_adjustRowsAfterDelete\([^)]*\)/g) || []).filter(c => /\.row\b|_delRow\b/.test(c));
    ok('P4 PLANTED renumber from fsEntry.row → E6 would fail', bad.length === 1);
  }
  // P5 the gate that forgets to aim at the found row
  {
    const anchor = "  await sheetsUpdate(spreadsheetId, _range, values, { expect: { tab: tab, row: _w.row, num: _num, invId: _inv } });\n  if (expect && typeof expect === 'object') expect.foundRow = _w.row;";
    ok('P5 anchor present (once)', SHEETS.split(anchor).length === 2);
    const planted = SHEETS.replace(anchor, anchor.replace('_range, values', 'range, values'));
    const t = boot(Object.assign(STANDARD(), { sheetsSrc: planted })); t.removeElsewhere(MC, 3);
    await t.sandbox.rrVerifiedRowUpdate(MINE, MC, 5, 'My Collection!C5', [['8']], { num: '2245', invId: '12' }, 'collection');
    ok('P5 PLANTED write to the remembered range → B2 would fail (6464-1 changed)', t.tabs[MC][2][2] === '8');
  }

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
