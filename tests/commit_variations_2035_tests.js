// ══════════════════════════════════════════════════════════════
// commit_variations_2035_tests.js — v0.9.2035. Commit adds a NEW VARIATION
// of a number already on the tab.
//
// [stated] Brad "yes" (2026-10-27) to fixing Commit after a dry run of the COTT
// crawl batch (Oct 17) showed it would add only 103 of 266 approved rows: the
// number-only check held every Pre-War / Science variation of a number the
// master already had (the 22 No. 184 Bungalows, the 610 cars…), and the ones it
// did add went in with no variation letter.
//
// The rule (yardmaster.js): a row is a new variation when it carries Variation
// Details no row of that number on the tab (or earlier in the batch) carries;
// it gets the next free variation in the TAB's own style — letters on a letter
// tab, numbers on a number tab; a tab that leaves Variation blank stays blank
// unless a number needs telling apart. A row with no Variation Details is held
// exactly as before. Runs the REAL _ymCommit in a sandbox (harness copied from
// commit_batch_dedupe_2004_tests.js), then plants three offenders.
//
// Run:  node tests/commit_variations_2035_tests.js
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
  const row = (num, tab, varDesc, variation, status) => {
    const r = DH.map(() => '');
    n++; r[0] = 'X'; r[1] = 'X-' + String(n).padStart(4, '0'); r[2] = 'add'; r[3] = tab;
    r[4] = num; r[5] = 'Accessory'; r[7] = 'desc ' + num + ' #' + n; r[9] = variation || ''; r[11] = 'https://example.test/' + num + '/' + n;
    r[15] = status || 'approved'; r[16] = '2026-10-27'; r[18] = varDesc || '';
    return r;
  };
  const PW = 'Lionel Pre-War', SCI = 'Lionel PW - Science', RMT = 'RMT O';
  deltas.push(row('184', PW, 'Painted light gray sides; apple green inserts'));    // 1 new variation → A
  deltas.push(row('184', PW, 'Painted ivory sides; apple green inserts'));        // 2 new variation → B
  deltas.push(row('184', PW, '  painted LIGHT gray sides;   apple green inserts')); // 3 same as #1 (case/space) → HELD
  deltas.push(row('610', PW, 'Mojave body and roof'));                             // 4 = master 610 B's details → HELD
  deltas.push(row('610', PW, 'Red body, silver roof, serif lettering'));           // 5 new → D (A, B, C taken)
  deltas.push(row('999', PW, 'only one of these'));                               // 6 new number, single, letter tab → blank
  deltas.push(row('998', PW, 'first kind'));                                      // 7 new number, two kinds → A
  deltas.push(row('998', PW, 'second kind'));                                     // 8 → B
  deltas.push(row('254E', PW, 'olive green, pendulum reverse', 'B'));             // 9 given variation B is taken → HELD
  deltas.push(row('184', PW, ''));                                                // 10 no Variation Details → HELD (old rule)
  deltas.push(row('205', SCI, 'catalog price $7.50'));                            // 11 number tab: 205 has 1, 2 → 3
  deltas.push(row('2105', SCI, 'COTT code SS0446'));                              // 12 new number on a number tab → 1
  deltas.push(row('RMT-1', RMT, 'NEW car'));                                      // 13 blank-variation tab, new, single → blank
  deltas.push(row('RMT-5', RMT, 'a second road number'));                         // 14 RMT-5 already there (blank) → 1
  deltas.push(row('184', PW, 'rejected one', '', 'rejected'));                    // 15 rejected → never considered
  const batches = [BH.slice(), ['X', 'test', '2026-10-27', 'Batch X', 'pending', String(n), '']];
  const PH = ['Item Number', 'Item Type', 'Description', 'Variation #', 'Variation Details', 'Reference Link', 'Source', 'Row ID'];
  const prewar = [PH.slice(),
    ['184', 'Accessory', 'Bungalow, illuminated', '', '', '', 'Greenberg Book', 'R0000001'],
    ['610', 'Passenger Car', 'Pullman', 'A', 'Olive green body and roof', '', 'Greenberg Book', 'R0000002'],
    ['610', 'Passenger Car', 'Pullman', 'B', 'Mojave body and roof', '', 'Greenberg Book', 'R0000003'],
    ['610', 'Passenger Car', 'Pullman', 'C', 'Terra-cotta body, maroon roof', '', 'Greenberg Book', 'R0000004'],
    ['254E', 'Electric Locomotive', 'Electric', 'A', 'pea green', '', 'COTT', 'R0000005'],
    ['254E', 'Electric Locomotive', 'Electric', 'B', 'pea green, orange stripe', '', 'COTT', 'R0000006']];
  const sci = [PH.slice(),
    ['205', 'Science Set', 'Junior Microscope Set', '1', 'catalog price $5.00', '', 'COTT', 'S0000001'],
    ['205', 'Science Set', 'Junior Microscope Set', '2', 'catalog price $6.00', '', 'COTT', 'S0000002']];
  const rmt = [['Item Number', 'Item Type', 'Road Name', 'Description', 'Variation', 'Variation Description', 'Reference Link', 'Source'],
    ['RMT-5', 'Hopper', 'Reading', 'hopper', '', '', '', 'RMT site'],
    ['RMT-6', 'Hopper', 'Erie', 'hopper', '', '', '', 'RMT site']];
  return { tabs: { crawl_batches: batches, crawl_deltas: deltas, submissions: [['token']], barcode_pairs: [['upc']], chores: [['a']], usage: [['a']],
                   'Lionel Pre-War': prewar, 'Lionel PW - Science': sci, 'RMT O': rmt }, log: [], drive: [] };
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
    REAL_ERA_IDS: ['prewar', 'sci', 'rmt'], ERA_TABS: { prewar: { items: 'Lionel Pre-War' }, sci: { items: 'Lionel PW - Science' }, rmt: { items: 'RMT O' } },
    ERAS: { prewar: { manufacturer: 'Lionel' }, sci: { manufacturer: 'Lionel' }, rmt: { manufacturer: 'RMT' } },
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
  const v = r.v, ask = r.ctx.asks[0] || '';
  ok('Commit asked once', r.ctx.asks.length === 1, JSON.stringify(r.ctx.toasts));
  const a = varOf(v, 'Lionel Pre-War', 'Painted light gray sides; apple green inserts');
  const b = varOf(v, 'Lionel Pre-War', 'Painted ivory sides; apple green inserts');
  ok('184 (already on the tab): a new variation lands as A', a && a[3] === 'A', JSON.stringify(a));
  ok('184: the second new variation lands as B', b && b[3] === 'B', JSON.stringify(b));
  ok('184: the same details again (case and spaces differ) are HELD — 3 rows of 184 in all', rowsOf(v, 'Lionel Pre-War', '184').length === 3, JSON.stringify(rowsOf(v, 'Lionel Pre-War', '184')));
  ok('610: details the master row B already has are HELD', rowsOf(v, 'Lionel Pre-War', '610').filter(x => x[4] === 'Mojave body and roof').length === 1);
  const d = varOf(v, 'Lionel Pre-War', 'Red body, silver roof, serif lettering');
  ok('610: a new one takes the next free letter, D', d && d[3] === 'D', JSON.stringify(d));
  const s999 = rowsOf(v, 'Lionel Pre-War', '999');
  ok('999 (new number, only one, letter tab): lands with Variation left blank, as Pre-War general rows are', s999.length === 1 && s999[0][3] === '', JSON.stringify(s999));
  const s998 = rowsOf(v, 'Lionel Pre-War', '998').map(x => x[3]).sort().join(',');
  ok('998 (new number, two different kinds in the batch): both land, as A and B', s998 === 'A,B', s998);
  ok('254E with a given variation the tab already has (B): HELD', rowsOf(v, 'Lionel Pre-War', '254E').length === 2);
  ok('184 with no Variation Details: HELD (the old number rule)', !v.tabs['Lionel Pre-War'].some(x => x[0] === '184' && x[4] === '' && x[7] !== 'R0000001'));
  ok('the rejected 184 row never landed', !varOf(v, 'Lionel Pre-War', 'rejected one'));
  const s3 = varOf(v, 'Lionel PW - Science', 'catalog price $7.50');
  ok('number tab (PW - Science): 205 has 1 and 2 → the new one is 3', s3 && s3[3] === '3', JSON.stringify(s3));
  const s2105 = rowsOf(v, 'Lionel PW - Science', '2105');
  ok('number tab: a brand-new number gets 1, like every row there', s2105.length === 1 && s2105[0][3] === '1', JSON.stringify(s2105));
  const r1 = rowsOf(v, 'RMT O', 'RMT-1');
  ok('blank-variation tab (RMT O): a new single row stays blank', r1.length === 1 && r1[0][4] === '', JSON.stringify(r1));
  const r5 = rowsOf(v, 'RMT O', 'RMT-5');
  ok('blank-variation tab: a second RMT-5 with its own details lands as 1', r5.length === 2 && r5.some(x => x[4] === '1' && x[5] === 'a second road number'), JSON.stringify(r5));
  ok('10 rows appended in all (184 ×2, 610, 999, 998 ×2, 205, 2105, RMT-1, RMT-5)', r.ctx.appended.length === 10, JSON.stringify(r.ctx.appended));
  ok('the confirm box says how many are new variations of numbers already in master (5: 184 ×2, 610, 205, RMT-5)', /5 of them are new variations of a number already in master/.test(ask), ask);
  ok('…and still counts the held rows (4 already in master)', /4 held \u2014 number already in master\./.test(ask), ask);
  ok('every appended Pre-War row got a Row ID', v.tabs['Lionel Pre-War'].slice(7).every(x => /^NEWID/.test(x[7])), JSON.stringify(v.tabs['Lionel Pre-War'].slice(7).map(x => x[7])));

  // ═══ 2. pressing Commit again adds NOTHING (the details now sit on the tab) ═══
  const before = r.ctx.appended.length;
  r.ctx.sandbox._ymBatchOpen('X', false);
  await r.ctx.sandbox._ymCommit(); await tick(120);
  ok('a second Commit of the same batch appends nothing new', r.ctx.appended.length === before, JSON.stringify(r.ctx.appended.slice(before)));

  // ═══ 3. one rule each ═══
  ok('_ymVarKey / _ymVarStyle / _ymNextVar each defined once', ['_ymVarKey', '_ymVarStyle', '_ymNextVar'].every(f => (SRC.match(new RegExp('function ' + f + '\\(', 'g')) || []).length === 1));

  // ═══ 4. planted offenders ═══
  const k1 = "return String((dd && dd.varDesc) || '').replace(/\\s+/g, ' ').trim().toLowerCase();";
  ok('planted: the variation key line exists once', SRC.split(k1).length === 2);
  const o1 = await runCommit(SRC.replace(k1, "return '';"));
  ok('planted offender (no variation identity) → 184\'s new variations are held again, and the suite sees it', rowsOf(o1.v, 'Lionel Pre-War', '184').length === 1, JSON.stringify(rowsOf(o1.v, 'Lionel Pre-War', '184')));
  const k2 = "    return letters > digits ? 'letters' : (digits ? 'digits' : 'none');";
  ok('planted: the style line exists once', SRC.split(k2).length === 2);
  const o2 = await runCommit(SRC.replace(k2, "    return 'digits';"));
  const o2a = varOf(o2.v, 'Lionel Pre-War', 'Painted light gray sides; apple green inserts');
  ok('planted offender (every tab numbered) → a Pre-War variation lands as "1", and the suite sees it', o2a && o2a[3] === '1', JSON.stringify(o2a));
  const k3 = "if (canVary && !given && (existing[k] || many || style === 'digits')) vNew = _ymNextVar(style, ex.used);";
  ok('planted: the assignment line exists once', SRC.split(k3).length === 2);
  const o3 = await runCommit(SRC.replace(k3, ''));
  const o3d = varOf(o3.v, 'Lionel Pre-War', 'Red body, silver roof, serif lettering');
  ok('planted offender (no variation given) → 610\'s new row lands with a blank variation, and the suite sees it', o3d && o3d[3] === '', JSON.stringify(o3d));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL  crashed: ' + (e && e.stack)); process.exit(1); });
