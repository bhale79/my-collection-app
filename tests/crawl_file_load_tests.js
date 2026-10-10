// ═══════════════════════════════════════════════════════════════
// crawl_file_load_tests.js — v0.9.1917. The crawls' one door into the
// Yardmaster's review queue.
//
// Brad (2026-10-10): "review our other crawls…" → the Oct 5 monthly crawl
// could not work out how to fill the review queue and left its findings
// as files. Every crawl now writes ONE JSON file (RR_CRAWL_FILE, config.js)
// and loads it through the Office's "Load a crawl results file" box.
//
// What is proven here, on the real yardmaster.js in a sandbox with a fake
// Sheets API:
//   • a good file becomes review rows BY HEADER NAME, status pending
//   • every kind of bad file is refused whole — nothing written
//   • a batch id loads ONCE; the same file again writes nothing
//   • a cut-short earlier load is refused, never doubled
//   • rows go in BEFORE the batch line; a failed row append writes no line
//   • a non-owner gets nothing
//   • the format lives in ONE place (config.js) — a planted second copy fails
//
// Run:  node tests/crawl_file_load_tests.js
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
function src(f) { return fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8'); }

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

const config = src('config.js'), ym = src('yardmaster.js');

// ── the ONE definition ──────────────────────────────────────────
const defM = config.match(/const RR_CRAWL_FILE = \{[\s\S]*?\};/);
ok('config.js defines RR_CRAWL_FILE once', !!defM && (config.match(/RR_CRAWL_FILE\s*=/g) || []).length === 1);
function formatTypedTwice(text) { return /'rr-crawl-batch-\d+'/.test(text); }
ok('yardmaster.js never types the format string itself — it reads RR_CRAWL_FILE', !formatTypedTwice(ym) && /RR_CRAWL_FILE/.test(ym));
ok('…and that check can FAIL: a planted copy of the format string is caught',
   formatTypedTwice(ym + "\nvar x = 'rr-crawl-batch-1';"));

// ── the sandbox ─────────────────────────────────────────────────
const DH = ['batch_id', 'delta_id', 'action', 'proposed_tab', 'item_num', 'item_type', 'road_name', 'description', 'gauge', 'variation',
            'years', 'ref_link', 'msrp', 'source', 'flag', 'status', 'decided', 'image_url', 'var_desc', 'sub_type', 'notes', 'category'];
const BH = ['batch_id', 'source', 'created', 'label', 'status', 'total', 'note'];

function makeBox(opts) {
  opts = opts || {};
  const calls = [];
  const els = {};
  const sheet = { batches: (opts.batches || []).slice(), deltaBatchIds: (opts.deltaBatchIds || []).slice() };
  function resp(status, body) { return { ok: status >= 200 && status < 300, status, json: async () => body }; }
  const fakeFetch = async function (url, init) {
    const u = decodeURIComponent(String(url));
    const method = (init && init.method) || 'GET';
    calls.push({ method, u, body: init && init.body ? JSON.parse(init.body) : null });
    if (method === 'GET') {
      if (/crawl_deltas!A1:AZ1/.test(u)) return resp(200, { values: [DH] });
      if (/crawl_batches!A1:Z1/.test(u)) return resp(200, { values: [BH] });
      if (/crawl_batches!A2:A/.test(u)) return resp(200, { values: sheet.batches.map(b => [b]) });
      if (/crawl_deltas!A2:A/.test(u)) return resp(200, { values: sheet.deltaBatchIds.map(b => [b]) });
      if (/values:batchGet/.test(u)) return resp(200, { valueRanges: [] });
      return resp(404, {});
    }
    if (/crawl_deltas!A1:V:append/.test(u)) {
      if (opts.failRows) return resp(500, {});
      return resp(200, {});
    }
    if (/crawl_batches!A1:G:append/.test(u)) return resp(200, {});
    return resp(400, {});
  };
  const ctx = {
    console, JSON, Math, Date, String, Object, Array, Promise, RegExp, Error, encodeURIComponent, decodeURIComponent, parseInt, Set,
    setInterval: () => 0, clearInterval: () => {}, setTimeout: (f) => 0,
    localStorage: { getItem: () => null, setItem: () => {} },
    state: { user: { email: opts.email || 'bhale@ipd-llc.com' } },
    accessToken: 'test-token',
    fetch: fakeFetch,
    toasts: [],
    document: {
      getElementById: (id) => els[id] || (els[id] = { id, textContent: '', style: {}, innerHTML: '' }),
      querySelector: () => null, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} })
    },
  };
  ctx.window = ctx;
  ctx.showToast = function (t) { ctx.toasts.push(t); };
  ctx.rrRegisterPage = function () {};
  ctx.rrJsArg = (s) => String(s);
  vm.createContext(ctx);
  vm.runInContext(defM[0].replace('const ', 'var '), ctx);
  vm.runInContext(ym, ctx);
  // the Office's own reload is not under test here
  return { ctx, calls, els, sheet };
}
function fileOf(obj) { const t = typeof obj === 'string' ? obj : JSON.stringify(obj); return { name: 'test.json', size: t.length, text: async () => t }; }
function good(extra) {
  return Object.assign({
    format: 'rr-crawl-batch-1', batch_id: 'CB-ATLAS-20261012', source: 'Atlas (archive.atlasrr.com)', created: '2026-10-12',
    label: 'Atlas — new items', note: 'monthly crawl, 2nd Monday',
    rows: [
      { action: 'add', proposed_tab: 'Atlas O', item_num: '30138016', description: 'Test boxcar', source: 'archive.atlasrr.com' },
      { action: 'add', proposed_tab: 'Atlas HO', item_num: '20006543', description: 'Test hopper', flag: 'check the scale' }
    ]
  }, extra || {});
}

// ── the checker ─────────────────────────────────────────────────
{
  const { ctx } = makeBox();
  const chk = ctx._ymCrawlCheck(good(), DH, '2026-10-12');
  ok('a good file passes the check', !chk.error, chk.error);
  ok('…two rows, each as wide as the header row', chk.rows && chk.rows.length === 2 && chk.rows.every(r => r.length === DH.length));
  const r0 = chk.rows[0];
  ok('…cells land BY HEADER NAME (item_num, proposed_tab, description)',
     r0[DH.indexOf('item_num')] === '30138016' && r0[DH.indexOf('proposed_tab')] === 'Atlas O' && r0[DH.indexOf('description')] === 'Test boxcar');
  ok('…batch_id, status pending and an empty decided are set by the loader, not the file',
     r0[DH.indexOf('batch_id')] === 'CB-ATLAS-20261012' && r0[DH.indexOf('status')] === 'pending' && r0[DH.indexOf('decided')] === '');
  ok('…delta ids are made from the batch id when the file gives none',
     r0[DH.indexOf('delta_id')] === 'CB-ATLAS-20261012-00001' && chk.rows[1][DH.indexOf('delta_id')] === 'CB-ATLAS-20261012-00002');
  ok('…the batch line carries source, label, total and pending', chk.batch.total === '2' && chk.batch.status === 'pending' && chk.batch.label === 'Atlas — new items');

  const refused = [
    ['a file with the wrong format', good({ format: 'something-else' })],
    ['a batch id in lower case', good({ batch_id: 'cb-atlas-20261012' })],
    ['a batch id without CB-', good({ batch_id: 'ATLAS-20261012' })],
    ['no source', good({ source: '' })],
    ['no rows', good({ rows: [] })],
    ['a column the queue does not have', good({ rows: [{ action: 'add', item_num: '1', colour: 'red' }] })],
    ['a file that tries to set status itself', good({ rows: [{ action: 'add', item_num: '1', status: 'approved' }] })],
    ['an action other than add or barcode', good({ rows: [{ action: 'retire', item_num: '1' }] })],
    ['add and barcode mixed in one file', good({ rows: [{ action: 'add', item_num: '1' }, { action: 'barcode', item_num: '2' }] })],
    ['a row with no number and no flag', good({ rows: [{ action: 'add', description: 'mystery' }] })],
    ['a row holding a list instead of a value', good({ rows: [{ action: 'add', item_num: '1', notes: ['a', 'b'] }] })],
    ['the same row twice', good({ rows: [{ action: 'add', item_num: '1' }, { action: 'add', item_num: '1' }] })],
    ['the same delta id twice', good({ rows: [{ action: 'add', item_num: '1', delta_id: 'X-1' }, { action: 'add', item_num: '2', delta_id: 'X-1' }] })],
  ];
  refused.forEach(([name, obj]) => {
    const c = ctx._ymCrawlCheck(obj, DH, '2026-10-12');
    ok('refused: ' + name, !!c.error, c.error);
  });
  const big = good({ rows: Array.from({ length: ctx.RR_CRAWL_FILE.MAX_ROWS + 1 }, (_, i) => ({ action: 'add', item_num: String(i) })) });
  ok('refused: more rows than MAX_ROWS', !!ctx._ymCrawlCheck(big, DH, '2026-10-12').error);
  ok('refused: a queue whose header row lacks delta_id', !!ctx._ymCrawlCheck(good(), DH.filter(h => h !== 'delta_id'), '2026-10-12').error);
  ok('two rows that differ only in road name are NOT copies (Aristo-Craft had real ones)',
     !ctx._ymCrawlCheck(good({ rows: [{ action: 'add', item_num: '1', road_name: 'UP' }, { action: 'add', item_num: '1', road_name: 'SP' }] }), DH, '2026-10-12').error);
}

// ── the loader, end to end on the fake Sheets API ───────────────
(async function () {
  {
    const { ctx, calls, els } = makeBox();
    await ctx._ymCrawlLoadFile({ files: [fileOf(good())], value: 'x' });
    const posts = calls.filter(c => c.method === 'POST');
    ok('a good file: rows appended, then ONE batch line — in that order',
       posts.length === 2 && /crawl_deltas!A1:V:append/.test(posts[0].u) && /crawl_batches!A1:G:append/.test(posts[1].u), posts.map(p => p.u.split('/values/')[1]).join(' | '));
    ok('…the row append range ends at the header row’s last column (V for 22)', /crawl_deltas!A1:V:append/.test(posts[0].u));
    ok('…2 rows sent, the batch line says total 2 and pending',
       posts[0].body.values.length === 2 && posts[1].body.values[0][BH.indexOf('total')] === '2' && posts[1].body.values[0][BH.indexOf('status')] === 'pending');
    ok('…the outcome is left for the crawl to read back', ctx.rrCrawlLoadLast && ctx.rrCrawlLoadLast.ok === true && ctx.rrCrawlLoadLast.rows === 2 && ctx.rrCrawlLoadLast.already === false,
       JSON.stringify(ctx.rrCrawlLoadLast));
    ok('…and shown on the page', /Loaded 2 rows/.test(els['ym-crawl-load-result'].textContent));
  }
  {
    const { ctx, calls } = makeBox({ batches: ['CB-OLD', 'CB-ATLAS-20261012'] });
    await ctx._ymCrawlLoadFile({ files: [fileOf(good())] });
    ok('the same batch id again: "already loaded", NOTHING written',
       calls.filter(c => c.method === 'POST').length === 0 && ctx.rrCrawlLoadLast.ok === true && ctx.rrCrawlLoadLast.already === true);
  }
  {
    const { ctx, calls } = makeBox({ deltaBatchIds: ['CB-ATLAS-20261012'] });
    await ctx._ymCrawlLoadFile({ files: [fileOf(good())] });
    ok('rows of this batch already in the queue with no batch line (a cut-short load): refused, nothing written',
       calls.filter(c => c.method === 'POST').length === 0 && ctx.rrCrawlLoadLast.ok === false && /cut short/.test(ctx.rrCrawlLoadLast.text));
  }
  {
    const { ctx, calls } = makeBox({ failRows: true });
    await ctx._ymCrawlLoadFile({ files: [fileOf(good())] });
    const posts = calls.filter(c => c.method === 'POST');
    ok('a failed row append writes NO batch line (nothing half-shown)',
       posts.length === 1 && /crawl_deltas/.test(posts[0].u) && ctx.rrCrawlLoadLast.ok === false && /NOT written/.test(ctx.rrCrawlLoadLast.text));
  }
  {
    const { ctx, calls } = makeBox();
    await ctx._ymCrawlLoadFile({ files: [fileOf(good({ rows: [{ action: 'add', item_num: '1', colour: 'red' }] }))] });
    ok('a bad file is refused before ANY write, with the reason', calls.filter(c => c.method === 'POST').length === 0
       && ctx.rrCrawlLoadLast.ok === false && /colour/.test(ctx.rrCrawlLoadLast.text) && /nothing was loaded/.test(ctx.rrCrawlLoadLast.text));
  }
  {
    const { ctx, calls } = makeBox();
    await ctx._ymCrawlLoadFile({ files: [fileOf('{ not json')] });
    ok('an unreadable file: refused, nothing written', calls.filter(c => c.method === 'POST').length === 0 && ctx.rrCrawlLoadLast.ok === false);
  }
  {
    const { ctx, calls } = makeBox({ email: 'stranger@example.com' });
    await ctx._ymCrawlLoadFile({ files: [fileOf(good())] });
    ok('a non-owner: nothing read, nothing written', calls.length === 0 && ctx.rrCrawlLoadLast == null);
  }
  {
    const { ctx, calls } = makeBox();
    let release;
    const slow = { name: 'slow.json', size: 10, text: () => new Promise(r => { release = () => r(JSON.stringify(good())); }) };
    const first = ctx._ymCrawlLoadFile({ files: [slow] });
    await ctx._ymCrawlLoadFile({ files: [fileOf(good({ batch_id: 'CB-SECOND-1' }))] });
    ok('a second load while one is running is turned away (the busy guard)', ctx.rrCrawlLoadLast.ok === false && /already loading/.test(ctx.rrCrawlLoadLast.text));
    release(); await first;
    ok('…and the first still finishes', ctx.rrCrawlLoadLast.ok === true && calls.filter(c => c.method === 'POST').length === 2);
  }

  // ── the page: the box the crawls use ──────────────────────────
  ok('the Office draws a file box with the id the crawls look for (ym-crawl-file → _ymCrawlLoadFile)',
     /id="ym-crawl-file"[^>]*onchange="_ymCrawlLoadFile\(this\)"/.test(ym));
  ok('…with a result line the crawl reads back (ym-crawl-load-result)', /id="ym-crawl-load-result"/.test(ym));
  ok('…drawn under the queue whether or not batches are waiting', (ym.match(/qfoot \+ crawlBox/g) || []).length === 2);
  ok('the loader never touches the master sheet', (function () {
    const a = ym.indexOf('function _ymCrawlCheck'), b = ym.indexOf('// ── v0.9.1627: COMMIT');
    const part = ym.slice(a, b);
    return a > 0 && b > a && !/MASTER_SHEET_ID/.test(part) && !/_ymMasterTabs/.test(part);
  })());

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
