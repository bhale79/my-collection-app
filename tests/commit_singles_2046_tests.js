// ══════════════════════════════════════════════════════════════
// commit_singles_2046_tests.js — v0.9.2046. Office Commit numbers a brand-new
// SINGLE row only when the tab's own single rows carry a variation.
//
// [stated] Brad "yes" (2026-10-30) to building this fix as a release. Master
// 2.64 committed 40 new Micro-Trains N cars and every one landed with
// Variation "1" (cleared by hand). Cause: v0.9.2035 numbered a fresh single row
// on any tab whose variations are numbers. Micro-Trains N numbers the numbers it
// has several of, but its 5,072 single rows leave Variation blank. PW - Science
// (200 singles) and PW - Other (19) number every single row, so they keep 1.
// Runs the REAL _ymCommit in a sandbox (harness copied from
// commit_variations_2035_tests.js), then plants three offenders.
//
// Run:  node tests/commit_singles_2046_tests.js
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
const MCS = require('./lib/master-col-spec.js');
const LAST_COL = (CFG.match(/const MASTER_READ_LAST_COL = '([A-Z]+)'/) || [])[1];


function makeVault() {
  const DH = ['batch_id', 'delta_id', 'action', 'proposed_tab', 'item_num', 'item_type', 'road_name', 'description', 'gauge', 'variation', 'years', 'ref_link', 'msrp', 'source', 'flag', 'status', 'decided', 'image_url', 'var_desc', 'sub_type', 'notes', 'category'];
  const BH = ['batch_id', 'source', 'created', 'label', 'status', 'total', 'note'];
  const deltas = [DH.slice()];
  let n = 0;
  const row = (num, tab, varDesc, variation) => {
    const r = DH.map(() => '');
    n++; r[0] = 'X'; r[1] = 'X-' + String(n).padStart(4, '0'); r[2] = 'add'; r[3] = tab;
    r[4] = num; r[5] = 'Boxcar'; r[7] = 'desc ' + num + ' #' + n; r[9] = variation || ''; r[11] = 'https://example.test/' + num + '/' + n;
    r[15] = 'approved'; r[16] = '2026-10-30'; r[18] = varDesc || '';
    return r;
  };
  const MT = 'Micro-Trains N', SCI = 'Lionel PW - Science', PWO = 'Lionel PW - Other';
  deltas.push(row('101 00 821', MT, 'Atlas run, Pennsylvania'));      // 1 new single on a blank-singles tab → BLANK (the 2.64 bug)
  deltas.push(row('101 00 822', MT, 'Atlas run, Reading'));           // 2 another → BLANK
  deltas.push(row('020 00 001', MT, 'third road number'));            // 3 already there as 1, 2 → 3
  deltas.push(row('101 00 900', MT, 'first kind'));                    // 4 new number, two kinds → 1
  deltas.push(row('101 00 900', MT, 'second kind'));                   // 5 → 2
  deltas.push(row('2106', SCI, 'COTT code SS0447'));                   // 6 new single on a numbered-singles tab → 1
  deltas.push(row('PWO-9', PWO, 'only one'));                          // 7 same on PW - Other → 1
  const batches = [BH.slice(), ['X', 'test', '2026-10-30', 'Batch X', 'pending', String(n), '']];
  const PH = ['Item Number', 'Item Type', 'Description', 'Variation #', 'Variation Details', 'Reference Link', 'Source', 'Row ID'];
  const mt = [PH.slice(),
    ['020 00 001', 'Boxcar', '40ft boxcar', '1', 'road number 1', '', 'MT site', 'M0000001'],
    ['020 00 001', 'Boxcar', '40ft boxcar', '2', 'road number 2', '', 'MT site', 'M0000002'],
    ['020 00 010', 'Boxcar', '40ft boxcar', '', '', '', 'MT site', 'M0000003'],
    ['020 00 011', 'Boxcar', '40ft boxcar', '', '', '', 'MT site', 'M0000004'],
    ['020 00 012', 'Boxcar', '40ft boxcar', '', '', '', 'MT site', 'M0000005']];
  const sci = [PH.slice(),
    ['205', 'Science Set', 'Junior Microscope Set', '1', 'catalog price $5.00', '', 'COTT', 'S0000001'],
    ['205', 'Science Set', 'Junior Microscope Set', '2', 'catalog price $6.00', '', 'COTT', 'S0000002'],
    ['206', 'Science Set', 'Chemistry Set', '1', '', '', 'COTT', 'S0000003'],
    ['207', 'Science Set', 'Physics Set', '1', '', '', 'COTT', 'S0000004']];
  const pwo = [PH.slice(),
    ['PWO-1', 'Other', 'thing', '1', '', '', 'COTT', 'O0000001'],
    ['PWO-2', 'Other', 'thing', '1', '', '', 'COTT', 'O0000002']];
  return { tabs: { crawl_batches: batches, crawl_deltas: deltas, submissions: [['token']], barcode_pairs: [['upc']], chores: [['a']], usage: [['a']],
                   'Micro-Trains N': mt, 'Lionel PW - Science': sci, 'Lionel PW - Other': pwo }, log: [], drive: [] };
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
    REAL_ERA_IDS: ['mtn', 'sci', 'pwo'], ERA_TABS: { mtn: { items: 'Micro-Trains N' }, sci: { items: 'Lionel PW - Science' }, pwo: { items: 'Lionel PW - Other' } },
    ERAS: { mtn: { manufacturer: 'Micro-Trains' }, sci: { manufacturer: 'Lionel' }, pwo: { manufacturer: 'Lionel' } },
    rrNewRowId: () => 'NEWID' + String(Math.random()).slice(2, 7),
    MASTER_SHEET_ID: 'master',
    MASTER_READ_LAST_COL: LAST_COL,
    // v0.9.2014: the app's ONE master column list (app-data.js), as the live page has it
    MASTER_COL_SPEC: MCS.MASTER_COL_SPEC, _normHdr: MCS._normHdr,
    rrEsc: (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    rrRegisterPage: () => {},
    // the guarded append (sheets.js) — writes straight into the fake master
    sheetsAppend: async (id, range, rows) => { const tab = range.replace(/'/g, '').split('!')[0]; rows.forEach(r => { v.tabs[tab].push(r.slice()); appended.push(tab + '|' + r[0]); }); return true; }
  };
  sandbox.rrJsArg = (x) => sandbox.rrEsc(String(x == null ? '' : x).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
  // v0.9.2044 (ships before this one) gives the app ONE today (rrToday, config.js); hand it in when it is there
  try { sandbox.rrToday = require('./lib/rr-today.js'); } catch (e) { /* before v0.9.2044: the app does not use it */ }
  sandbox.window = sandbox;
  sandbox.encodeURIComponent = encodeURIComponent;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'yardmaster.js' });
  return { sandbox, page, asks, toasts, appended };
}
const tick = (ms) => new Promise(r => setTimeout(r, ms || 30));

async function runCommit(src, v) {
  v = v || makeVault(); const ctx = boot(v, src);
  ctx.sandbox.ymBuildPage(true);
  for (let i = 0; i < 60 && !/Catalog review queue/.test(ctx.page.innerHTML); i++) await tick();
  ctx.sandbox._ymBatchOpen('X', false);
  await ctx.sandbox._ymCommit(); await tick(120);
  return { v, ctx };
}
const rowsOf = (v, tab, num) => v.tabs[tab].slice(1).filter(r => String(r[0]).trim() === num);
const varOf = (v, tab, vd) => { const r = v.tabs[tab].slice(1).find(x => (x[4] || '') === vd || (x[5] || '') === vd); return r ? r : null; };

(async () => {
  // ═══ 1. the real file ═══
  const r = await runCommit(SRC);
  const v = r.v;
  ok('Commit asked once', r.ctx.asks.length === 1, JSON.stringify(r.ctx.toasts));
  const m1 = rowsOf(v, 'Micro-Trains N', '101 00 821'), m2 = rowsOf(v, 'Micro-Trains N', '101 00 822');
  ok('Micro-Trains N: a brand-new single lands with Variation BLANK, like the tab\'s other single rows (2.64 gave "1")', m1.length === 1 && m1[0][3] === '', JSON.stringify(m1));
  ok('Micro-Trains N: the second brand-new single is blank too', m2.length === 1 && m2[0][3] === '', JSON.stringify(m2));
  const m3 = varOf(v, 'Micro-Trains N', 'third road number');
  ok('Micro-Trains N: a new kind of a number it already has (1, 2) still lands as 3', m3 && m3[3] === '3', JSON.stringify(m3));
  const m9 = rowsOf(v, 'Micro-Trains N', '101 00 900').map(x => x[3]).sort().join(',');
  ok('Micro-Trains N: a new number that comes as two kinds still lands as 1 and 2', m9 === '1,2', m9);
  const s1 = rowsOf(v, 'Lionel PW - Science', '2106');
  ok('PW - Science (single rows numbered): a brand-new single still gets 1', s1.length === 1 && s1[0][3] === '1', JSON.stringify(s1));
  const o1 = rowsOf(v, 'Lionel PW - Other', 'PWO-9');
  ok('PW - Other (single rows numbered): a brand-new single still gets 1', o1.length === 1 && o1[0][3] === '1', JSON.stringify(o1));
  ok('7 rows appended in all', r.ctx.appended.length === 7, JSON.stringify(r.ctx.appended));

  // ═══ 2. one rule ═══
  ok('_ymSinglesVaried defined once', (SRC.match(/function _ymSinglesVaried\(/g) || []).length === 1);
  ok('the old "any number tab numbers a single" trigger is gone', SRC.indexOf("many || style === 'digits')") < 0);

  // ═══ 3. planted offenders ═══
  const k1 = "if (canVary && !given && (existing[k] || many || singlesVaried)) vNew = _ymNextVar(style, ex.used);";
  ok('planted: the assignment line exists once', SRC.split(k1).length === 2);
  const p1 = await runCommit(SRC.replace(k1, k1.replace('singlesVaried', "style === 'digits'")));
  const p1m = rowsOf(p1.v, 'Micro-Trains N', '101 00 821');
  ok('planted offender (the v2035 trigger back) → the Micro-Trains single lands as "1" again, and the suite sees it', p1m.length === 1 && p1m[0][3] === '1', JSON.stringify(p1m));
  const k2 = '    return withVar > blank;';
  ok('planted: the singles rule line exists once', SRC.split(k2).length === 2);
  const p2 = await runCommit(SRC.replace(k2, '    return false;'));
  const p2s = rowsOf(p2.v, 'Lionel PW - Science', '2106');
  ok('planted offender (singles never numbered) → the Science single lands blank, and the suite sees it', p2s.length === 1 && p2s[0][3] === '', JSON.stringify(p2s));
  const p3 = await runCommit(SRC.replace(k2, '    return true;'));
  const p3m = rowsOf(p3.v, 'Micro-Trains N', '101 00 822');
  ok('planted offender (singles always numbered) → the Micro-Trains single lands as "1", and the suite sees it', p3m.length === 1 && p3m[0][3] === '1', JSON.stringify(p3m));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL  crashed: ' + (e && e.stack)); process.exit(1); });
