// ═══════════════════════════════════════════════════════════════
// officedash_tests.js — 2026-11-16, [stated] Brad 06:06 CT "yes and ship it".
//
// The Office's community check ("Queue into review") stripped EVERY dash
// and space from a number before asking "is it already in the catalog?".
// Athearn's Roundhouse line uses RND-1166 (a 24' ore car) and RND1166 (a
// 36' wood boxcar) — two cars. A member's RND1166 was stamped in_master=yes
// because RND-1166 exists, and never reached Brad's review.
//
// Now ONE key, rrNumKey (app.js, beside rrNumBare; tests/lib/num-rule.js hands it to every sandbox), says "the same catalog number" for the
// Add screen (rrNumSameAsTyped) AND the Office (_ymDupKey, the master read,
// normNum): case and edges never matter, a one-digit line prefix comes off
// (6-31705 = 31705), a dash before END letters does not count (2343-P =
// 2343P); every other character counts.
//
// Part A — rrNumKey itself (run from the app's own text).
// Part B — the Office REALLY runs: _ymQueueWaiting, cut from yardmaster.js,
//          run against a stand-in Vault + master; which rows are stamped
//          "yes" (already in the catalog) and which are queued.
// Part C — the Add screen's rule is the same key (behaviour unchanged).
// Part P — planted offenders: each turns its check red.
//
// Run:  node tests/officedash_tests.js
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}
const J = (o) => String(JSON.stringify(o)).slice(0, 300);
function plant(text, from, to, what) {
  if (text.indexOf(from) < 0) throw new Error('plant "' + what + '": the text to replace is gone — update the plant');
  return text.replace(from, to);
}
// a function's whole text, by brace counting from its first line
function cut(text, startRe) {
  const m = text.match(startRe); if (!m) return '';
  let i = m.index, j = text.indexOf('{', i), d = 0;
  for (let k = j; k < text.length; k++) { if (text[k] === '{') d++; else if (text[k] === '}') { d--; if (!d) return text.slice(i, k + 1); } }
  return '';
}

const APP = read('app.js'), YMJS = read('yardmaster.js'), WS = read('wizard-suggestions.js');

// ── Part A ───────────────────────────────────────────────────────
function keyFrom(appText) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(cut(appText, /function rrNumBare\(/) + '\n' + cut(appText, /function rrNumKey\(/) + '\nthis.rrNumKey = rrNumKey;', ctx);
  return ctx.rrNumKey;
}
function partA(appText) {
  const K = keyFrom(appText), r = [];
  const same = (a, b) => K(a) === K(b);
  r.push(['A1 RND-1166 and RND1166 are two numbers', !same('RND-1166', 'RND1166'), [K('RND-1166'), K('RND1166')]]);
  r.push(['A2 2343-P = 2343P and 1076-L = 1076l (a dash before end letters, any case)', same('2343-P', '2343P') && same('1076-L', '1076l')]);
  r.push(['A3 6-31705 = 31705 (Lionel\'s one-digit line prefix)', same('6-31705', '31705')]);
  r.push(['A4 6464-1 is not 64641; MTH 20-66238 is not 2066238', !same('6464-1', '64641') && !same('20-66238', '2066238')]);
  r.push(['A5 edges and case: " rnd-1166 " = "RND-1166"; blank stays blank', same(' rnd-1166 ', 'RND-1166') && K('') === '' && K(null) === '']);
  return r;
}
partA(APP).forEach(c => ok(c[0], c[1], J(c[2])));

// ── Part B — the real queue step ─────────────────────────────────
function runQueue(ymText, appText, subs, masterNums) {
  const K = keyFrom(appText);
  const q = cut(ymText, /window\._ymQueueWaiting = async function/);
  const dup = cut(ymText, /function _ymDupKey\(/);
  if (!q || !dup) return Promise.resolve({ err: 'could not cut _ymQueueWaiting / _ymDupKey' });
  const DH = ['batch_id', 'delta_id', 'action', 'proposed_tab', 'item_num', 'item_type', 'road_name', 'description', 'gauge', 'variation', 'years', 'ref_link', 'msrp', 'source', 'flag', 'status', 'decided', 'image_url', 'var_desc', 'sub_type', 'notes', 'category'];
  const BH = ['batch_id', 'source', 'created', 'label', 'status', 'total', 'note'];
  const out = { appended: [], stamps: [], toast: '' };
  const resp = (o, okv) => Promise.resolve({ ok: okv !== false, status: okv === false ? 500 : 200, json: () => Promise.resolve(o) });
  const ctx = {
    window: { accessToken: 't' }, console,
    rrNumKey: K, rrToday: () => '2026-11-16',
    YM: { VAULT_ID: 'V', DELTAS_TAB: 'crawl_deltas' }, SUBS_BATCH: 'CB-COMMUNITY', PAIRS_BATCH: 'CB-BARCODES', MASTER_SHEET_ID: 'M',
    _isOwner: () => true, appConfirm: () => Promise.resolve(true),
    _ymData: { subRows: subs, pairRows: [], deltas: [], subInMasterCol: 'H', pairStatusCol: 'F' },
    _ymMasterTabs: () => ['Roundhouse HO', 'Lionel PW - Items'],
    _ymMakerNorm: (m) => String(m || '').toLowerCase(), _ymDeltaMaker: () => '',
    _ymTabFor: () => 'Roundhouse HO', _ymTabForMaker: () => '', _ymTypeFor: () => '', _ymNoTabFlag: () => '',
    _ymShapeFlag: () => '', _ymPreSortReasons: () => [], _ymColLetter: () => 'F',
    _ymReload: () => {}, showToast: (t) => { out.toast = String(t); },
    fetch: (url, opt) => {
      url = decodeURIComponent(String(url));
      if (url.includes('values:batchGet')) return resp({ valueRanges: [{ values: masterNums.map(n => [n]) }, { values: [['2343P'], ['6464-1']] }] });
      if (url.includes('crawl_deltas!A1:AZ1')) return resp({ values: [DH] });
      if (url.includes('crawl_batches!A1:Z1')) return resp({ values: [BH] });
      if (url.includes(':append')) { const b = JSON.parse(opt.body); if (url.includes('crawl_deltas')) out.appended.push(...b.values); return resp({}); }
      if (url.includes('crawl_batches!A1:G')) return resp({ values: [BH] });
      if (url.includes('crawl_deltas!A1:B')) return resp({ values: [['batch_id', 'delta_id']] });
      if (url.includes('values:batchUpdate')) { const b = JSON.parse(opt.body); (b.data || []).forEach(d => { if (/^submissions!/.test(d.range)) out.stamps.push([d.range, d.values[0][0]]); }); return resp({}); }
      return resp({}, false);
    },
  };
  vm.createContext(ctx);
  try { vm.runInContext('var _ymQueueBusy = false;\n' + dup + '\n' + q + ';', ctx); }
  catch (e) { return Promise.resolve({ err: 'load: ' + e.message }); }
  return ctx.window._ymQueueWaiting().then(() => {
    const st = {}; out.stamps.forEach(([rng, v]) => { st[rng.replace(/^submissions!H/, '')] = v; });
    out.stampByRow = st;
    out.queuedNums = out.appended.map(r => r[DH.indexOf('item_num')]);
    return out;
  }, (e) => ({ err: 'run: ' + e.message }));
}
const SUBS = [
  { row: 2, num: 'RND1166', mfr: 'Roundhouse', desc: "36' old time wood boxcar", variation: '' },
  { row: 3, num: 'RND-1166', mfr: 'Roundhouse', desc: "24' ore car", variation: '' },
  { row: 4, num: '2343-P', mfr: 'Lionel', desc: 'Santa Fe F3', variation: '' },
  { row: 5, num: '64641', mfr: 'Lionel', desc: 'boxcar', variation: '' },
];
const checksB = (R) => [
  ['B1 the queue step ran to the end (no error, the toast came)', !R.err && /queued into review/.test(R.toast || ''), R.err || R.toast],
  ['B2 RND1166 (not in the catalog) is QUEUED for review, not stamped "already in the catalog"', R.stampByRow && R.stampByRow['2'] === 'queued' && R.queuedNums.includes('RND1166'), J(R.stampByRow)],
  ['B3 RND-1166 (in the catalog) is stamped yes, never queued', R.stampByRow && R.stampByRow['3'] === 'yes' && !R.queuedNums.includes('RND-1166'), J(R.stampByRow)],
  ['B4 2343-P = the catalog\'s 2343P: stamped yes (a dash before end letters still does not count)', R.stampByRow && R.stampByRow['4'] === 'yes', J(R.stampByRow)],
  ['B5 64641 is not the catalog\'s 6464-1: queued', R.stampByRow && R.stampByRow['5'] === 'queued' && R.queuedNums.includes('64641'), J(R.stampByRow)],
];

// ── Part C — the Add screen ──────────────────────────────────────
function partC(wsText) {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(cut(APP, /function rrNumBare\(/) + '\n' + cut(APP, /function rrNumKey\(/) + '\n' + cut(wsText, /function rrNumLinePrefixOff\(/) + '\n' + cut(wsText, /function rrNumSameAsTyped\(/) + '\nthis.S = rrNumSameAsTyped;', ctx);
  const S = ctx.S;
  return [
    ['C1 the Add screen\'s rrNumSameAsTyped asks rrNumKey (one rule, not two)', /function rrNumSameAsTyped[\s\S]{0,300}rrNumKey\(a\) === rrNumKey\(b\)/.test(wsText)],
    ['C2 …and behaves as before: 2343-P = 2343P, 6-31705 = 31705, RND-1166 ≠ RND1166, 20-66238 ≠ 66238', S('2343P', '2343-P') && S('6-31705', '31705') && !S('RND-1166', 'RND1166') && !S('20-66238', '66238')],
  ];
}
partC(WS).forEach(c => ok(c[0], c[1]));
ok('C3 no number key in yardmaster.js strips every non-letter, non-digit (/[^A-Z0-9]/g) any more', !/\[\^A-Z0-9\]\/g/.test(cut(YMJS, /function _ymDupKey\(/) + cut(YMJS, /window\._ymQueueWaiting = async function/)));

(async () => {
  const R = await runQueue(YMJS, APP, SUBS, ['RND-1166', 'RND3189']);
  checksB(R).forEach(c => ok(c[0], c[1], c[2]));

  // ── Part P — planted offenders ───────────────────────────────────
  const redB = (r) => checksB(r).some(c => !c[1]);
  // P1: the master read strips every dash again
  const p1 = plant(YMJS, 'var n = rrNumKey(r[0]);', "var n = String(r[0] == null ? '' : r[0]).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');", 'master read');
  const p1b = plant(p1, 'var normNum = rrNumKey;', "var normNum = function (n) { return String(n || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); };", 'normNum');
  const R1 = await runQueue(p1b, APP, SUBS, ['RND-1166', 'RND3189']);
  ok('P1 PLANTED (the old dash-blind master read + normNum): B2 goes red — RND1166 stamped "already in the catalog"', redB(R1) && R1.stampByRow && R1.stampByRow['2'] === 'yes', J(R1.stampByRow || R1.err));
  // P2: rrNumKey itself made dash-blind — A1 and B goes red
  const p2 = plant(APP, ".replace(/-(?=[A-Z]+$)/, '');\n}", ".replace(/[^A-Z0-9]/g, '');\n}", 'rrNumKey');
  ok('P2 PLANTED (rrNumKey ignores every dash): A1 goes red', partA(p2).some(c => !c[1] && /^A1/.test(c[0])));
  const R2 = await runQueue(YMJS, p2, SUBS, ['RND-1166', 'RND3189']);
  ok('P2b …and the Office stamps RND1166 yes again (B2 red)', redB(R2), J(R2.stampByRow || R2.err));
  // P3: rrNumKey forgets the end-letters rule — B4 / A2 go red
  const p3 = plant(APP, ".replace(/-(?=[A-Z]+$)/, '');\n}", ";\n}", 'end letters');
  ok('P3 PLANTED (the dash before end letters counts): A2 goes red', partA(p3).some(c => !c[1] && /^A2/.test(c[0])));
  // P4: the Add screen keeps its own copy of the rule
  const p4 = plant(WS, '  return rrNumKey(a) === rrNumKey(b);', "  var k = function (v) { return rrNumLinePrefixOff(v).replace(/-(?=[a-z]+$)/, ''); };\n  return k(a) === k(b);", 'own copy');
  ok('P4 PLANTED (the Add screen keeps its own copy of the rule): C1 goes red', !partC(p4)[0][1]);
  // P5: _ymDupKey strips every dash again
  const p5 = plant(YMJS, "var k = rrNumKey(num) + '|'", "var k = String(num || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') + '|'", 'dup key');
  ok('P5 PLANTED (the duplicate key strips every dash): C3 goes red', /\[\^A-Z0-9\]\/g/.test(cut(p5, /function _ymDupKey\(/)));

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
