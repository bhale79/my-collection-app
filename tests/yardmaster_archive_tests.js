// ══════════════════════════════════════════════════════════════
// yardmaster_archive_tests.js — v0.9.1689. The archive move, run for real
// against an in-memory Vault.
//
// The Office's "Clear finished" now MOVES decided rows of cleared batches
// from crawl_deltas to crawl_deltas_archive. That is the first time the
// Office deletes anything, so the source-regex pins in yardmaster_tests.js
// are not enough: this suite loads the real yardmaster.js into a sandbox
// with a fake Sheets/Drive API (a tiny in-memory spreadsheet that honours
// batchGet, values GET/PUT/append, values:batchUpdate, addSheet and
// deleteDimension) and checks what actually happened to the rows.
//
// Run:  node tests/yardmaster_archive_tests.js
// ══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

// ── the in-memory Vault ─────────────────────────────────────────
function makeVault() {
  const DH = ['batch_id', 'delta_id', 'action', 'proposed_tab', 'item_num', 'item_type', 'road_name', 'description', 'gauge', 'variation', 'years', 'ref_link', 'msrp', 'source', 'flag', 'status', 'decided', 'image_url', 'var_desc', 'sub_type', 'notes', 'category'];
  const BH = ['batch_id', 'source', 'created', 'label', 'status', 'total', 'note'];
  const deltas = [DH.slice()];
  const row = (batch, n, status, tab) => {
    const r = DH.map(() => '');
    r[0] = batch; r[1] = batch + '-' + String(n).padStart(4, '0'); r[2] = 'add'; r[3] = tab == null ? 'Marx O' : tab;
    r[4] = 'N' + n; r[7] = 'desc ' + n; r[15] = status; r[16] = status === 'pending' ? '' : '2026-09-05';
    return r;
  };
  // batch A: 4 decided rows (committed, finished)     rows 2–5
  for (let i = 1; i <= 4; i++) deltas.push(row('A', i, i === 3 ? 'rejected' : 'approved'));
  // batch B: 3 rows, one still pending (NOT finished)  rows 6–8
  deltas.push(row('B', 1, 'approved')); deltas.push(row('B', 2, 'pending')); deltas.push(row('B', 3, 'edited'));
  // a BLANK row in the middle (the _loadMyDocs shape)  row 9
  deltas.push(DH.map(() => ''));
  // batch C: 3 decided rows, committed, finished       rows 10–12
  for (let i = 1; i <= 3; i++) deltas.push(row('C', i, 'approved'));
  // batch D: committed but one approved row has NO TAB → held → not finished   rows 13–14
  deltas.push(row('D', 1, 'approved')); deltas.push(row('D', 2, 'approved', ''));
  // batch E: already dismissed earlier, rows still here (a leftover)  rows 15–16
  deltas.push(row('E', 1, 'approved')); deltas.push(row('E', 2, 'rejected'));
  const batches = [BH.slice(),
    ['A', 'test', '2026-09-01', 'Batch A', 'committed', '4', 'note A'],
    ['B', 'test', '2026-09-02', 'Batch B', 'committed', '3', 'note B'],
    ['C', 'test', '2026-09-03', 'Batch C', 'committed', '3', 'note C'],
    ['D', 'test', '2026-09-04', 'Batch D', 'committed', '2', 'note D'],
    ['E', 'test', '2026-09-04', 'Batch E', 'dismissed', '2', 'note E']];
  const subs = [['token','item_num','variation','condition','est_worth','sold_price','updated','in_master','manufacturer','description','road_name','source'],
    ['t1','999','','7','','','2026-09-01','no','Marx','Tin whistle car','','wizard'],
    ['t2','6-12345','','','','','2026-09-02','no','Lionel','Boxcar the catalog lacks','Santa Fe','wizard'],   // Lionel has several tabs → needs a tab
    ['t3','777','','','','','2026-09-03','yes','Marx','already in','','wizard'],
    ['t4','','','','','','2026-09-03','no','','no number at all','','wizard']];
  const pairs = [['upc','item_num','mfr','in_master','how','first_seen','last_seen','report_count','status'],
    ['012345678905','N1','Marx','yes','scan-corrected','2026-09-01','2026-09-02','3','pending'],
    ['023456789012','N2','Marx','yes','scan','2026-09-01','2026-09-01','1','pending'],
    ['034567890123','NOPE','Marx','no','scan','2026-09-01','2026-09-01','1','pending'],
    ['045678901234','N3','Marx','yes','scan','2026-09-01','2026-09-01','1','promoted']];
  // a MASTER tab (same fake spreadsheet namespace — tab names do not collide)
  const marx = [['Item Number','Item Type','Description','UPC / Barcode'],
    ['N1','Boxcar','one',''], ['N2','Boxcar','two','023456789012'], ['N4','Boxcar','four','999999999999']];
  return { tabs: { crawl_batches: batches, crawl_deltas: deltas, submissions: subs, barcode_pairs: pairs, chores: [['a']], usage: [['a']], 'Marx O': marx },
           ids: { crawl_batches: 11, crawl_deltas: 22, submissions: 33, barcode_pairs: 44, 'Marx O': 55 }, nextId: 100, log: [], drive: [] };
}

function colIdx(letter) { let n = 0; for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }
function parseRange(rng) {
  // 'tab!A1:AZ' / 'tab!B1:B' / 'tab!A1' / 'tab!E3' → {tab, c1, r1, c2, r2} (r2/c2 null = open)
  const m = rng.match(/^'?([^'!]+)'?!([A-Z]+)(\d+)(?::([A-Z]+)(\d*))?$/);
  if (!m) throw new Error('bad range ' + rng);
  return { tab: m[1], c1: colIdx(m[2]), r1: +m[3], c2: m[4] ? colIdx(m[4]) : colIdx(m[2]), r2: m[5] ? +m[5] : (m[4] ? null : +m[3]) };
}
function readRange(v, rng) {
  const p = parseRange(rng), t = v.tabs[p.tab];
  if (!t) return [];
  const out = [];
  const last = p.r2 == null ? t.length : Math.min(p.r2, t.length);
  for (let r = p.r1; r <= last; r++) {
    const src = t[r - 1] || [];
    out.push(src.slice(p.c1, p.c2 + 1));
  }
  // trim trailing empty rows the way Sheets does
  while (out.length && out[out.length - 1].every(c => c === '' || c == null)) out.pop();
  return out;
}
function writeRange(v, rng, values) {
  const p = parseRange(rng), t = v.tabs[p.tab];
  values.forEach((vr, i) => {
    const r = p.r1 - 1 + i;
    while (t.length <= r) t.push([]);
    vr.forEach((c, j) => { t[r][p.c1 + j] = c; });
  });
}
function res(status, body) { return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }; }

function makeFetch(v, opts) {
  opts = opts || {};
  return async function (url, init) {
    init = init || {};
    const method = init.method || 'GET';
    v.log.push(method + ' ' + url.replace(/^https:\/\/(sheets|www)\.googleapis\.com/, ''));
    if (opts.fail && opts.fail(url, init, v)) return res(500, { error: 'injected' });
    let m;
    if ((m = url.match(/\/values:batchGet\?(.*)$/))) {
      const ranges = m[1].split('&').filter(x => x.startsWith('ranges=')).map(x => decodeURIComponent(x.slice(7)));
      return res(200, { valueRanges: ranges.map(r => ({ range: r, values: readRange(v, r) })) });
    }
    if ((m = url.match(/\/values:batchUpdate$/))) {
      const b = JSON.parse(init.body);
      b.data.forEach(d => writeRange(v, d.range, d.values));
      return res(200, {});
    }
    if ((m = url.match(/\/values\/([^?:]+):append\?/))) {
      const rng = decodeURIComponent(m[1]); const p = parseRange(rng); const t = v.tabs[p.tab];
      JSON.parse(init.body).values.forEach(r => t.push(r.slice()));
      return res(200, {});
    }
    if ((m = url.match(/\/values\/([^?]+)\?valueInputOption=RAW$/)) && method === 'PUT') {
      writeRange(v, decodeURIComponent(m[1]), JSON.parse(init.body).values);
      return res(200, {});
    }
    if ((m = url.match(/\/values\/([^?]+)$/)) && method === 'GET') {
      return res(200, { values: readRange(v, decodeURIComponent(m[1])) });
    }
    if (url.match(/\/spreadsheets\/[^/]+\?fields=sheets\.properties$/)) {
      return res(200, { sheets: Object.keys(v.tabs).map(t => ({ properties: { title: t, sheetId: v.ids[t] } })) });
    }
    if (url.match(/\/spreadsheets\/[^/]+:batchUpdate$/)) {
      const reqs = JSON.parse(init.body).requests;
      for (const q of reqs) {
        if (q.addSheet) { const title = q.addSheet.properties.title; v.tabs[title] = []; v.ids[title] = v.nextId++; }
        else if (q.deleteDimension) {
          const rg = q.deleteDimension.range;
          const tab = Object.keys(v.ids).find(t => v.ids[t] === rg.sheetId);
          if (!tab) return res(400, { error: 'no sheet ' + rg.sheetId });
          v.tabs[tab].splice(rg.startIndex, rg.endIndex - rg.startIndex);
        }
      }
      return res(200, {});
    }
    if (url.match(/\/drive\/v3\/files\?q=/)) return res(200, { files: [{ id: 'folder1' }] });
    if (url.match(/\/upload\/drive\/v3\/files\?uploadType=multipart/)) { v.drive.push(init.body); return res(200, { id: 'bk' + v.drive.length }); }
    return res(404, { error: 'unhandled ' + method + ' ' + url });
  };
}

// ── load the real yardmaster.js into a sandbox ─────────────────
function boot(v, opts) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'yardmaster.js'), 'utf8');
  const page = { innerHTML: '', id: 'page-yardmaster' };
  const toasts = [];
  const sandbox = {
    console, setTimeout, clearTimeout,
    setInterval: () => 0, clearInterval: () => 0,
    state: { user: { email: 'bhale@ipd-llc.com' } },
    accessToken: 'tok',
    fetch: makeFetch(v, opts),
    showToast: (msg) => toasts.push(String(msg)),
    appConfirm: async () => (opts && opts.confirm === false ? false : true),
    document: { getElementById: (id) => (id === 'page-yardmaster' ? page : null), querySelector: () => null, createElement: () => ({}) },
    REAL_ERA_IDS: ['marx', 'pw', 'mpc'], ERA_TABS: { marx: { items: 'Marx O' }, pw: { items: 'Lionel PW - Items' }, mpc: { items: 'Lionel MPC-Modern' } },
    ERAS: { marx: { manufacturer: 'Marx' }, pw: { manufacturer: 'Lionel' }, mpc: { manufacturer: 'Lionel' } },
    MASTER_SHEET_ID: 'master'
  };
  sandbox.sheetsUpdate = async (id, range, values) => { writeRange(v, range.replace(/'/g, ''), values); v.log.push('sheetsUpdate ' + range); return true; };
  sandbox.window = sandbox;
  sandbox.encodeURIComponent = encodeURIComponent;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'yardmaster.js' });
  return { sandbox, page, toasts };
}
const tick = (ms) => new Promise(r => setTimeout(r, ms || 30));
async function loaded(ctx) { ctx.sandbox.ymBuildPage(true); for (let i = 0; i < 50 && !/Catalog review queue/.test(ctx.page.innerHTML); i++) await tick(); }
const idsIn = (tab) => tab.slice(1).map(r => r[1]).filter(Boolean);

(async () => {
  // ═══ 1. the happy path ═══
  {
    const v = makeVault(); const ctx = boot(v);
    await loaded(ctx);
    ok('the queue renders from the fake Vault', /Batch A/.test(ctx.page.innerHTML) && /Batch D/.test(ctx.page.innerHTML));
    ok('Clear finished counts A and C only — B has a pending row, D has a held (no-tab) row, E is already cleared',
       /Clear finished \(2\)/.test(ctx.page.innerHTML), (ctx.page.innerHTML.match(/Clear finished \(\d+\)/) || [''])[0]);
    ok('D says "1 need a tab" on its row (v1694: the held count, split by what is missing)', /1 need a tab/.test(ctx.page.innerHTML));
    ok('the leftover rows of already-cleared E are offered for archiving', /Archive 2 rows/.test(ctx.page.innerHTML));

    await ctx.sandbox._ymClearFinished();
    for (let i = 0; i < 80 && v.log.filter(l => /batchGet/.test(l)).length < 2; i++) await tick();
    await tick(60);

    const d = v.tabs.crawl_deltas, a = v.tabs.crawl_deltas_archive;
    ok('the archive tab was created with the working tab\'s header', !!a && a[0].join() === d[0].join());
    ok('A, C and E rows moved: 4 + 3 + 2 = 9 in the archive', a && idsIn(a).length === 9, a && idsIn(a).join(','));
    ok('…and the same nine are gone from the working tab', idsIn(d).every(id => !/^(A|C|E)-/.test(id)), idsIn(d).join(','));
    ok('B (pending) and D (held) rows all stayed — 3 + 2', idsIn(d).length === 5 && idsIn(d).filter(id => /^B-/.test(id)).length === 3 && idsIn(d).filter(id => /^D-/.test(id)).length === 2);
    ok('the blank row in the middle did not confuse the row numbers (rows kept in order)', idsIn(d).join(',') === 'B-0001,B-0002,B-0003,D-0001,D-0002');
    ok('archived rows are byte-identical to what they were', a.slice(1).find(r => r[1] === 'A-0003')[15] === 'rejected' && a.slice(1).find(r => r[1] === 'C-0002')[7] === 'desc 2');
    ok('A and C are marked dismissed in crawl_batches; B and D untouched',
       v.tabs.crawl_batches[1][4] === 'dismissed' && v.tabs.crawl_batches[3][4] === 'dismissed' && v.tabs.crawl_batches[2][4] === 'committed' && v.tabs.crawl_batches[4][4] === 'committed');
    ok('a CSV backup of the whole working tab went to Drive BEFORE anything moved', v.drive.length === 1 && /crawl_deltas — backup .* before archiving 9 rows\.csv/.test(v.drive[0]) && /A-0001/.test(v.drive[0]) && /E-0002/.test(v.drive[0]));
    const li = (re) => v.log.findIndex(l => re.test(l));
    const lastIdx = (re) => v.log.map((l, i) => (re.test(l) ? i : -1)).filter(i => i >= 0).pop();
    const iBackup = li(/upload\/drive/), iAppend = li(/:append/), iDelete = lastIdx(/^POST \/v4\/spreadsheets\/[^/]+:batchUpdate$/);
    const iVerify = v.log.map((l, i) => (/GET .*crawl_deltas_archive!B1%3AB$/.test(l) ? i : -1)).filter(i => i > iAppend)[0];
    ok('order of operations: backup → archive append → verify read → deleteDimension',
       iBackup < iAppend && iAppend < iVerify && iVerify < iDelete, [iBackup, iAppend, iVerify, iDelete].join(','));
    const delReq = v.log.filter(l => /^POST \/v4\/spreadsheets\/[^/]+:batchUpdate$/.test(l)).length;
    ok('the deletes went out as ONE batch of contiguous runs (A rows 2–5, C rows 10–12, E rows 15–16), not one call per row', delReq === 2, delReq + ' batchUpdate calls (1 addSheet + 1 delete expected)');
    ok('the screen reloaded and the cleared batches left the queue', !/Batch A/.test(ctx.page.innerHTML) && /Batch B/.test(ctx.page.innerHTML) && /Show 3 finished/.test(ctx.page.innerHTML), ctx.page.innerHTML.slice(0, 200));
    ok('the toast says what happened', ctx.toasts.some(t => /2 batches cleared · 9 rows archived/.test(t)), ctx.toasts.join(' | '));
  }

  // ═══ 2. a half-finished move reruns cleanly ═══
  {
    const v = makeVault(); const ctx = boot(v);
    // pretend an earlier run archived E-0001 but died before deleting it
    v.tabs.crawl_deltas_archive = [v.tabs.crawl_deltas[0].slice(), v.tabs.crawl_deltas[15].slice()];
    v.ids.crawl_deltas_archive = 77;
    await loaded(ctx);
    await ctx.sandbox._ymArchiveLeftovers();
    for (let i = 0; i < 80 && v.log.filter(l => /batchGet/.test(l)).length < 2; i++) await tick();
    await tick(60);
    const a = v.tabs.crawl_deltas_archive, d = v.tabs.crawl_deltas;
    ok('rerun: E-0001 was NOT archived twice', idsIn(a).filter(id => id === 'E-0001').length === 1, idsIn(a).join(','));
    ok('rerun: E-0002 joined it', idsIn(a).includes('E-0002'));
    ok('rerun: both E rows left the working tab', !idsIn(d).some(id => /^E-/.test(id)));
    ok('rerun: nothing else moved', idsIn(d).length === 12);
  }

  // ═══ 3. a failed backup stops everything ═══
  {
    const v = makeVault(); const ctx = boot(v, { fail: (url) => /upload\/drive/.test(url) });
    await loaded(ctx);
    const before = JSON.stringify(v.tabs.crawl_deltas);
    await ctx.sandbox._ymArchiveLeftovers();
    await tick(80);
    ok('failed backup: the working tab is untouched', JSON.stringify(v.tabs.crawl_deltas) === before);
    ok('failed backup: no archive tab was created', !v.tabs.crawl_deltas_archive);
    ok('failed backup: the toast says so', ctx.toasts.some(t => /Archive stopped: backup failed/.test(t)), ctx.toasts.join(' | '));
  }

  // ═══ 4. a failed append leaves the working tab whole ═══
  {
    const v = makeVault(); const ctx = boot(v, { fail: (url) => /:append/.test(url) });
    await loaded(ctx);
    const before = JSON.stringify(v.tabs.crawl_deltas);
    await ctx.sandbox._ymArchiveLeftovers();
    await tick(80);
    ok('failed append: nothing was removed from the working tab', JSON.stringify(v.tabs.crawl_deltas) === before);
    ok('failed append: the toast says the rerun is safe', ctx.toasts.some(t => /nothing was removed from crawl_deltas; run Archive again/.test(t)), ctx.toasts.join(' | '));
  }

  // ═══ 5. the verify gate: an archive that did not grow blocks the delete ═══
  {
    const v = makeVault();
    // an append that "succeeds" but writes nothing (the API lying, or a wrong tab)
    const ctx = boot(v);
    const realFetch = ctx.sandbox.fetch;
    ctx.sandbox.fetch = async (url, init) => { if (/:append/.test(url)) { v.log.push('POST (swallowed) ' + url); return res(200, {}); } return realFetch(url, init); };
    await loaded(ctx);
    const before = JSON.stringify(v.tabs.crawl_deltas);
    await ctx.sandbox._ymArchiveLeftovers();
    await tick(80);
    ok('verify gate: the count mismatch stopped the delete', JSON.stringify(v.tabs.crawl_deltas) === before && ctx.toasts.some(t => /archive count did not verify \(expected 2, found 0\)/.test(t)), ctx.toasts.join(' | '));
  }

  // ═══ 6. cancel at the confirm = nothing happens ═══
  {
    const v = makeVault(); const ctx = boot(v, { confirm: false });
    await loaded(ctx);
    const before = JSON.stringify(v.tabs);
    await ctx.sandbox._ymClearFinished();
    await tick(60);
    ok('cancel: not one cell changed', JSON.stringify(v.tabs) === before && !v.log.some(l => /POST|PUT/.test(l)));
  }

  // ═══ 7. the verified-row guard on verdicts ═══
  {
    const v = makeVault(); const ctx = boot(v);
    await loaded(ctx);
    ctx.sandbox._ymBatchOpen('B', false);
    // rows move underneath the screen: someone deletes row 2 in the sheet
    v.tabs.crawl_deltas.splice(1, 1);
    const before = JSON.stringify(v.tabs.crawl_deltas);
    ctx.sandbox._ymVerdict('B-0002', 'approved');
    await tick(120);
    ok('guard: the verdict was NOT written to the shifted row', JSON.stringify(v.tabs.crawl_deltas) === before);
    ok('guard: the screen said so and reloaded', ctx.toasts.some(t => /queue changed underneath/.test(t)) && v.log.filter(l => /batchGet/.test(l)).length >= 2, ctx.toasts.join(' | '));
    // after the reload the same tap lands on the right row
    ctx.toasts.length = 0;
    ctx.sandbox._ymVerdict('B-0002', 'approved');
    await tick(120);
    const rowB2 = v.tabs.crawl_deltas.find(r => r[1] === 'B-0002');
    ok('guard: after the reload the verdict lands on B-0002 itself', rowB2 && rowB2[15] === 'approved' && v.tabs.crawl_deltas.filter(r => r[15] === 'approved' && r[1] !== 'B-0002').length === 9, JSON.stringify(v.tabs.crawl_deltas.map(r => r[1] + ':' + r[15])));
  }

  // ═══ 8. v0.9.1694 — Queue into review ═══
  {
    const v = makeVault(); const ctx = boot(v);
    await loaded(ctx);
    ok('queue: the Waiting card offers to queue the 3 waiting submissions + 3 pairs (the yes/promoted rows are not waiting)',
       /Queue 6 into review/.test(ctx.page.innerHTML), (ctx.page.innerHTML.match(/Queue \d+ into review/) || [''])[0]);
    ok('queue: the card shows N need a tab · M need a number (the v1688 held count, split)',
       /1 need a tab/.test(ctx.page.innerHTML), ctx.page.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400));
    await ctx.sandbox._ymQueueWaiting();
    for (let i = 0; i < 80 && v.log.filter(l => /batchGet/.test(l)).length < 2; i++) await tick();
    await tick(60);
    const d = v.tabs.crawl_deltas, ids = idsIn(d);
    const subsRows = d.slice(1).filter(r => r[0] === 'CB-COMMUNITY-SUBS'), pairRows = d.slice(1).filter(r => r[0] === 'CB-BARCODE-PAIRS');
    ok('queue: 3 submission rows and 3 pair rows became deltas', subsRows.length === 3 && pairRows.length === 3, subsRows.length + '/' + pairRows.length);
    ok('queue: both rolling batches exist and are pending with the right totals',
       v.tabs.crawl_batches.some(r => r[0] === 'CB-COMMUNITY-SUBS' && r[4] === 'pending' && r[5] === '3') && v.tabs.crawl_batches.some(r => r[0] === 'CB-BARCODE-PAIRS' && r[4] === 'pending' && r[5] === '3'));
    ok('queue: a maker with ONE tab gets it; a maker with several is flagged needs a tab; no number is flagged',
       subsRows[0][3] === 'Marx O' && subsRows[1][3] === '' && /needs a tab/.test(subsRows[1][14]) && /needs a number/.test(subsRows[2][14]));
    ok('queue: a barcode delta carries action=barcode and the UPC in its notes',
       pairRows.every(r => r[2] === 'barcode') && /UPC 012345678905; barcode_pairs row 2/.test(pairRows[0][20]));
    ok('queue: the source rows are stamped queued — and ONLY the waiting ones',
       v.tabs.submissions[1][7] === 'queued' && v.tabs.submissions[2][7] === 'queued' && v.tabs.submissions[4][7] === 'queued' && v.tabs.submissions[3][7] === 'yes'
       && v.tabs.barcode_pairs[1][8] === 'queued' && v.tabs.barcode_pairs[4][8] === 'promoted');
    ok('queue: the deltas were written BEFORE the source stamps', v.log.findIndex(l => /crawl_deltas!A1:V:append/.test(l)) < v.log.findIndex(l => /POST .*values:batchUpdate/.test(l) && v.tabs.submissions[1][7] === 'queued'));
    ok('queue: delta ids are unique and sequenced', new Set(ids).size === ids.length && /-0001$/.test(subsRows[0][1]) && /-0003$/.test(subsRows[2][1]));
    ok('queue: after the reload the Waiting card shows nothing waiting', /Nothing waiting/.test(ctx.page.innerHTML));
    // run it AGAIN — nothing must double up
    const before = JSON.stringify(v.tabs.crawl_deltas);
    await ctx.sandbox._ymQueueWaiting(); await tick(60);
    ok('queue: a second press queues nothing (all sources are stamped)', JSON.stringify(v.tabs.crawl_deltas) === before);
  }

  // ═══ 9. v0.9.1694 — the barcode commit: one cell, guarded ═══
  {
    const v = makeVault(); const ctx = boot(v);
    await loaded(ctx);
    await ctx.sandbox._ymQueueWaiting();
    for (let i = 0; i < 80 && v.log.filter(l => /batchGet/.test(l)).length < 2; i++) await tick();
    await tick(60);
    // approve all three pair rows, then commit the pairs batch
    ctx.sandbox._ymBatchOpen('CB-BARCODE-PAIRS', false);
    const pairs = v.tabs.crawl_deltas.slice(1).filter(r => r[0] === 'CB-BARCODE-PAIRS').map(r => r[1]);
    for (const id of pairs) { ctx.sandbox._ymVerdict(id, 'approved'); await tick(120); }
    const masterBefore = JSON.stringify(v.tabs['Marx O']);
    await ctx.sandbox._ymCommit();
    for (let i = 0; i < 80 && !/committed/.test(String(v.tabs.crawl_batches.find(r => r[0] === 'CB-BARCODE-PAIRS')[4])); i++) await tick();
    await tick(60);
    const m = v.tabs['Marx O'];
    ok('barcode commit: N1 got its UPC — one cell', m[1][3] === '012345678905' && m[1][0] === 'N1' && m[1][1] === 'Boxcar' && m[1][2] === 'one');
    ok('barcode commit: N2 already had the same UPC — left alone, counted as already there', m[2][3] === '023456789012');
    ok('barcode commit: NOPE is not in the tab — HELD, nothing written for it', m.length === 4 && !m.some(r => r[3] === '034567890123'));
    ok('barcode commit: no other cell on any row changed', JSON.stringify(m.map(r => r.slice(0, 3))) === JSON.stringify(JSON.parse(masterBefore).map(r => r.slice(0, 3))));
    ok('barcode commit: a backup CSV of the tab went to Drive first', v.drive.some(b => /Marx O — backup .* \(UPC write\)\.csv/.test(b)));
    ok('barcode commit: the Item Number cell was RE-READ at the target row right before the write',
       v.log.some(l => /batchGet\?ranges=.*Marx%20O.*!A2/.test(l) || /batchGet\?ranges=.*Marx O.*!A2/.test(decodeURIComponent(l))));
    ok('barcode commit: the pairs tab learned — promoted for the two that landed/were there, still queued for the held one',
       v.tabs.barcode_pairs[1][8] === 'promoted' && v.tabs.barcode_pairs[2][8] === 'promoted' && v.tabs.barcode_pairs[3][8] === 'queued');
    ok('barcode commit: the batch is committed', v.tabs.crawl_batches.find(r => r[0] === 'CB-BARCODE-PAIRS')[4] === 'committed');
  }

  // ═══ 10. v0.9.1694 — a mismatched row is held, never written ═══
  {
    const v = makeVault(); const ctx = boot(v);
    await loaded(ctx);
    await ctx.sandbox._ymQueueWaiting();
    for (let i = 0; i < 80 && v.log.filter(l => /batchGet/.test(l)).length < 2; i++) await tick();
    await tick(60);
    ctx.sandbox._ymBatchOpen('CB-BARCODE-PAIRS', false);
    const first = v.tabs.crawl_deltas.slice(1).filter(r => r[0] === 'CB-BARCODE-PAIRS')[0][1];
    ctx.sandbox._ymVerdict(first, 'approved'); await tick(120);
    // between the plan read and the write, the master row moves (a row inserted above it)
    const realFetch = ctx.sandbox.fetch;
    let armed = false;
    ctx.sandbox.fetch = async (url, init) => {
      const r = await realFetch(url, init);
      if (!armed && /Marx%20O'?!A1%3AAD|Marx O'!A1:AD/.test(decodeURIComponent(url))) { armed = true; v.tabs['Marx O'].splice(1, 0, ['N0','Boxcar','zero','']); }
      return r;
    };
    await ctx.sandbox._ymCommit(); await tick(200);
    const m = v.tabs['Marx O'];
    ok('moved row: the verify caught it — NO UPC was written anywhere', !m.some(r => r[3] === '012345678905'));
    ok('moved row: the pair stays queued (not promoted)', v.tabs.barcode_pairs[1][8] === 'queued');
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('YARDMASTER ARCHIVE TESTS FAILING'); process.exit(1); }
  console.log('ALL YARDMASTER ARCHIVE TESTS GREEN (' + pass + ')');
})().catch(e => { console.error(e); process.exit(1); });
