// ══════════════════════════════════════════════════════════════
// commit_batch_dedupe_2004_tests.js — v0.9.2004. Commit holds a SECOND copy of
// the same tab + number inside one batch.
//
// Brad's 903 re-check (2026-10-18) found 309 community rows approved twice —
// same tab, same number. _ymCommit only checked each row against the MASTER,
// so pressing Commit would have appended both copies. Brad: "okay" to the fix.
//
// This suite runs the REAL _ymCommit (app/yardmaster.js) in a sandbox against
// an in-memory Vault + master and checks what was actually appended and what
// the confirm box said. Then it plants the offender — the same file with the
// in-batch guard taken out — and proves the suite catches it.
//
// Run:  node tests/commit_batch_dedupe_2004_tests.js
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

const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'yardmaster.js'), 'utf8');
const CFG = fs.readFileSync(path.join(__dirname, '..', 'app', 'config.js'), 'utf8');
const LAST_COL = (CFG.match(/const MASTER_READ_LAST_COL = '([A-Z]+)'/) || [])[1];

// ── the in-memory Vault + master ───────────────────────────────
function makeVault() {
  const DH = ['batch_id', 'delta_id', 'action', 'proposed_tab', 'item_num', 'item_type', 'road_name', 'description', 'gauge', 'variation', 'years', 'ref_link', 'msrp', 'source', 'flag', 'status', 'decided', 'image_url', 'var_desc', 'sub_type', 'notes', 'category'];
  const BH = ['batch_id', 'source', 'created', 'label', 'status', 'total', 'note'];
  const deltas = [DH.slice()];
  let n = 0;
  const row = (num, tab, status, desc) => {
    const r = DH.map(() => '');
    n++; r[0] = 'X'; r[1] = 'X-' + String(n).padStart(4, '0'); r[2] = 'add'; r[3] = tab;
    r[4] = num; r[5] = 'Boxcar'; r[7] = desc || ('desc ' + num); r[15] = status; r[16] = '2026-10-20';
    return r;
  };
  deltas.push(row('N10', 'Marx O', 'approved', 'first copy'));
  deltas.push(row('N10', 'Marx O', 'approved', 'second copy'));      // ← the same item twice: HELD
  deltas.push(row(' N10 ', 'Marx O', 'edited', 'third copy, spaced')); // ← same key once trimmed: HELD
  deltas.push(row('N11', 'Marx O', 'edited'));
  deltas.push(row('N1', 'Marx O', 'approved'));                       // ← already in the master: HELD (old rule)
  deltas.push(row('N12', 'Marx O', 'approved'));
  deltas.push(row('N12', 'Lionel PW - Items', 'approved'));           // ← same number, OTHER tab: NOT a duplicate
  deltas.push(row('N13', 'Marx O', 'rejected'));                      // ← rejected: never considered
  deltas.push(row('N13', 'Marx O', 'approved'));
  const batches = [BH.slice(), ['X', 'test', '2026-10-20', 'Batch X', 'pending', String(n), '']];
  const marx = [['Item Number', 'Item Type', 'Description'], ['N1', 'Boxcar', 'one'], ['N2', 'Boxcar', 'two']];
  const pw = [['Item Number', 'Item Type', 'Description'], ['2343', 'Diesel', 'F3']];
  return { tabs: { crawl_batches: batches, crawl_deltas: deltas, submissions: [['token']], barcode_pairs: [['upc']], chores: [['a']], usage: [['a']],
                   'Marx O': marx, 'Lionel PW - Items': pw }, log: [], drive: [] };
}

function colIdx(letter) { let x = 0; for (const ch of letter) x = x * 26 + (ch.charCodeAt(0) - 64); return x - 1; }
function parseRange(rng) {
  const m = rng.match(/^'?([^'!]+)'?!([A-Z]+)(\d+)(?::([A-Z]+)(\d*))?$/);
  if (!m) throw new Error('bad range ' + rng);
  return { tab: m[1], c1: colIdx(m[2]), r1: +m[3], c2: m[4] ? colIdx(m[4]) : colIdx(m[2]), r2: m[5] ? +m[5] : (m[4] ? null : +m[3]) };
}
function readRange(v, rng) {
  const p = parseRange(rng), t = v.tabs[p.tab];
  if (!t) return [];
  const out = [];
  const last = p.r2 == null ? t.length : Math.min(p.r2, t.length);
  for (let r = p.r1; r <= last; r++) out.push((t[r - 1] || []).slice(p.c1, p.c2 + 1));
  while (out.length && out[out.length - 1].every(c => c === '' || c == null)) out.pop();
  return out;
}
function writeRange(v, rng, values) {
  const p = parseRange(rng), t = v.tabs[p.tab];
  values.forEach((vr, i) => { const r = p.r1 - 1 + i; while (t.length <= r) t.push([]); vr.forEach((c, j) => { t[r][p.c1 + j] = c; }); });
}
function res(status, body) { return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }; }
function makeFetch(v) {
  return async function (url, init) {
    init = init || {};
    const method = init.method || 'GET';
    v.log.push(method + ' ' + url);
    let m;
    if ((m = url.match(/\/values:batchGet\?(.*)$/))) {
      const ranges = m[1].split('&').filter(x => x.startsWith('ranges=')).map(x => decodeURIComponent(x.slice(7)));
      return res(200, { valueRanges: ranges.map(r => ({ range: r, values: readRange(v, r) })) });
    }
    if ((m = url.match(/\/values:batchUpdate$/))) { JSON.parse(init.body).data.forEach(d => writeRange(v, d.range, d.values)); return res(200, {}); }
    if ((m = url.match(/\/values\/([^?]+)$/)) && method === 'GET') return res(200, { values: readRange(v, decodeURIComponent(m[1])) });
    if (url.match(/\/spreadsheets\/[^/]+\?fields=sheets\.properties$/)) return res(200, { sheets: Object.keys(v.tabs).map((t, i) => ({ properties: { title: t, sheetId: i + 1 } })) });
    if (url.match(/\/drive\/v3\/files\?q=/)) return res(200, { files: [{ id: 'folder1' }] });
    if (url.match(/\/upload\/drive\/v3\/files\?uploadType=multipart/)) { v.drive.push(init.body); return res(200, { id: 'bk' + v.drive.length }); }
    return res(404, { error: 'unhandled ' + method + ' ' + url });
  };
}

function boot(v, src) {
  const page = { innerHTML: '', id: 'page-yardmaster' };
  const asks = [], toasts = [], appended = [];
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => 0,
    state: { user: { email: 'bhale@ipd-llc.com' } },
    accessToken: 'tok',
    fetch: makeFetch(v),
    showToast: (msg) => toasts.push(String(msg)),
    appConfirm: async (msg) => { asks.push(String(msg)); return true; },
    document: { getElementById: (id) => (id === 'page-yardmaster' ? page : null), querySelector: () => null, createElement: () => ({}) },
    REAL_ERA_IDS: ['marx', 'pw'], ERA_TABS: { marx: { items: 'Marx O' }, pw: { items: 'Lionel PW - Items' } },
    ERAS: { marx: { manufacturer: 'Marx' }, pw: { manufacturer: 'Lionel' } },
    MASTER_SHEET_ID: 'master',
    MASTER_READ_LAST_COL: LAST_COL,
    rrEsc: (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    rrRegisterPage: () => {},
    // the guarded append (sheets.js) — writes straight into the fake master
    sheetsAppend: async (id, range, rows) => { const tab = range.replace(/'/g, '').split('!')[0]; rows.forEach(r => { v.tabs[tab].push(r.slice()); appended.push(tab + '|' + r[0]); }); return true; }
  };
  sandbox.rrJsArg = (x) => sandbox.rrEsc(String(x == null ? '' : x).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
  sandbox.window = sandbox;
  sandbox.encodeURIComponent = encodeURIComponent;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'yardmaster.js' });
  return { sandbox, page, asks, toasts, appended };
}
const tick = (ms) => new Promise(r => setTimeout(r, ms || 30));

async function runCommit(src) {
  const v = makeVault(); const ctx = boot(v, src);
  ctx.sandbox.ymBuildPage(true);
  for (let i = 0; i < 60 && !/Catalog review queue/.test(ctx.page.innerHTML); i++) await tick();
  ctx.sandbox._ymBatchOpen('X', false);
  await ctx.sandbox._ymCommit(); await tick(120);
  const nums = (tab) => v.tabs[tab].slice(1).map(r => String(r[0]).trim());
  return { v, ctx, marx: nums('Marx O'), pw: nums('Lionel PW - Items') };
}
const count = (arr, x) => arr.filter(y => y === x).length;

(async () => {
  // ═══ 1. the real file ═══
  const r = await runCommit(SRC);
  ok('the Office loaded the batch and Commit asked once', r.ctx.asks.length === 1, JSON.stringify(r.ctx.asks) + ' toasts ' + JSON.stringify(r.ctx.toasts));
  const ask = r.ctx.asks[0] || '';
  ok('N10 approved three times on Marx O → appended ONCE', count(r.marx, 'N10') === 1, JSON.stringify(r.marx));
  ok('the FIRST copy is the one that landed (its description)', (r.v.tabs['Marx O'].find(x => String(x[0]).trim() === 'N10') || []).indexOf('first copy') >= 0,
     JSON.stringify(r.v.tabs['Marx O'].find(x => String(x[0]).trim() === 'N10')));
  ok('N12 on Marx O AND N12 on Lionel PW - Items both landed — the key is per tab', count(r.marx, 'N12') === 1 && count(r.pw, 'N12') === 1, JSON.stringify(r.pw));
  ok('N1 (already in the master) still held — the old rule is unchanged', count(r.marx, 'N1') === 1);
  ok('a rejected copy is never counted: N13 (rejected + approved) landed once', count(r.marx, 'N13') === 1);
  ok('N11 (edited) landed', count(r.marx, 'N11') === 1);
  ok('exactly 5 rows appended (N10, N11, N12, N13 on Marx O; N12 on PW)', r.ctx.appended.length === 5, JSON.stringify(r.ctx.appended));
  ok('the confirm box says it plainly: "2 held — same item twice in this batch"', /2 held — same item twice in this batch\./.test(ask), ask);
  ok('…and still says "1 held — number already in master"', /1 held — number already in master\./.test(ask), ask);
  ok('…and counts what will be appended: "Append 5 rows"', /^Append 5 rows/.test(ask), ask);
  ok('backups were still written before the append (one per tab)', r.v.drive.length === 2, String(r.v.drive.length));

  // ═══ 2. ONE key helper for both checks (single source of truth) ═══
  const cm = SRC.slice(SRC.indexOf('window._ymCommit ='), SRC.indexOf('async function _ymStampSubmissions'));
  ok('_ymCommitKey is defined once in yardmaster.js', (SRC.match(/function _ymCommitKey\(/g) || []).length === 1);
  ok('the master side and the batch side both go through _ymCommitKey', /existing\[n\] = 1/.test(cm) && /var n = _ymCommitKey\(r\[numIdx\]\)/.test(cm) && /var k = _ymCommitKey\(dd\[numCol\.field\]\)/.test(cm));
  ok('no hand-rolled number key left in the commit plan', !/existing\[String\(/.test(cm));

  // ═══ 3. planted offenders — the suite must catch each ═══
  const guard = "else if (seenHere[k]) heldTwice.push(dd);";
  ok('planted: the guard line exists exactly once to take out', SRC.split(guard).length === 2);
  const off1 = await runCommit(SRC.replace(guard, ''));
  ok('planted offender (in-batch guard removed) → N10 lands more than once and the suite sees it', count(off1.marx, 'N10') > 1, JSON.stringify(off1.marx));
  // a batch key that skips the trim — two helpers drifting apart
  const off2src = SRC.replace('var k = _ymCommitKey(dd[numCol.field]);', 'var k = String(dd[numCol.field] || "");');
  ok('planted: the batch key line exists to swap', off2src !== SRC);
  const off2 = await runCommit(off2src);
  ok('planted offender (batch key not trimmed like the master key) → " N10 " slips through and the suite sees it', off2.ctx.appended.length !== 5, JSON.stringify(off2.ctx.appended));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL  crashed: ' + (e && e.stack)); process.exit(1); });
