#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE KNOWN-PROBLEMS SWEEP, RELEASE 1 — v0.9.2044 — what a save sends Google
//
// [stated] Brad 2026-10-29: "why can't we figure this out before hand" → the
// sweep (KNOWN_PROBLEMS_SWEEP_REPORT_2026-10-29.md) → "yes" to fixing the
// three save problems first. Every rule below runs the REAL code lifted out of
// app/sheets.js, app/bulk-tag.js and app/config.js; only Google is a stand-in.
// Each rule is then proved able to fail on a planted offender.
//
//   A  rrSheetCell — the ONE cell rule (B11 + B12 of the report):
//      typed text starting = + - @, leading-zero numbers and date-shaped
//      numbers go in as text; numbers, prices, dates, links and words do not
//      change; the rule never doubles the text mark
//   B  the writers apply it: sheetsUpdate, sheetsAppend and the bulk-tag batch
//      send the guarded cells; a set-up write (the Dashboard tab's buttons)
//      keeps its formulas
//   C  SCAN: every USER_ENTERED write in app/ goes through rrSheetCells
//   D  rrToday — the ONE "today" (B10): 8:30 PM Central on Oct 29 is the 29th
//      (the old London way said the 30th — shown in a Central-time child)
//   E  SCAN: no "today" worked out in London time anywhere in app/
//      (toISOString's first ten letters of now), and no second copy of a
//      local today (toLocaleDateString('en-CA')); a line marked rr-utc-day
//      is the deliberate exception
//   F  the saves that showed the bug now use it: Date Added (buildPersonalRow),
//      Date Sold / Date Listed (wizard-save), the sale date boxes
//   P  planted offenders — each turns its own check red
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const SHEETS = read('sheets.js'), TAG = read('bulk-tag.js'), CFG = read('config.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 400) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('not found: ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced: ' + sig);
}
function plant(src, a, b) { if (src.indexOf(a) < 0) throw new Error('plant target not found: ' + a.slice(0, 90)); return src.replace(a, b); }

// ── A: the rule itself ─────────────────────────────────────────────────────
function cellRule(src) {
  const c = {}; vm.createContext(c);
  vm.runInContext(grab(src, 'function rrSheetCell(') + '\n' + grab(src, 'function rrSheetCells(') + '\nthis.rrSheetCell = rrSheetCell; this.rrSheetCells = rrSheetCells;', c);
  return c;
}
const GUARDED = [
  ['-missing one coupler', 'a note starting with a dash (#ERROR! before)'],
  ['+1 717 555 1234', 'a phone number starting with +'],
  ['=see notes', 'text starting with ='],
  ['@ the show', 'text starting with @'],
  ['-', 'a lone dash'],
  ['0209', 'a leading-zero item number (209 before)'],
  ['001', 'a Pre-War leading-zero number'],
  ['0401-1', 'leading zero with a dash'],
  ['6-8459', 'a Lionel 6- number (a DATE before)'],
  ['10-1024', 'an MTH-style number (a DATE before)'],
  ['1/2', 'a fraction-like number (Jan 2 before)'],
  ['20-2619-3', 'a three-part MTH number'],
];
const UNCHANGED = [
  ['2343', 'a plain number'], ['25.00', 'a price'], ['-12.50', 'a negative amount'], ['0', 'zero'], ['0.50', 'fifty cents'],
  ['2026-10-29', 'an ISO date'], ['10/29/2026', 'a US date'], ['https://drive.google.com/file/d/abc/view', 'a link'],
  ['Shelf 3', 'ordinary words'], ['2343-P', 'a dashed engine number'], ['6-24122', 'a 6- number Google never reads as a date'],
  ['', 'blank'], ["'already text", 'a value that already carries the mark'],
];

function runA(src, tag) {
  const c = cellRule(src);
  const bad = GUARDED.filter(([v]) => c.rrSheetCell(v) !== "'" + v).map(([v, w]) => w + ' "' + v + '" -> ' + JSON.stringify(c.rrSheetCell(v)));
  const moved = UNCHANGED.filter(([v]) => c.rrSheetCell(v) !== v).map(([v, w]) => w + ' "' + v + '" -> ' + JSON.stringify(c.rrSheetCell(v)));
  const nonStr = [2343, 0, null, undefined, true].filter(v => c.rrSheetCell(v) !== v);
  const twice = GUARDED.filter(([v]) => c.rrSheetCell(c.rrSheetCell(v)) !== c.rrSheetCell(v)).map(([v]) => v);
  const grid = c.rrSheetCells([['0209', 'Shelf 3', 25], ['-x', '2026-10-29']]);
  return { bad, moved, nonStr, twice, grid, tag };
}

// ── B: the writers ─────────────────────────────────────────────────────────
function writers(src, tagSrc) {
  const sent = [];
  const c = {
    console: { log() {}, warn() {}, error() {} }, JSON, Object, Array, String, Number, Math, RegExp, Error, Promise,
    window: {}, accessToken: 'tok', state: { personalSheetId: 'SHEET' },
    _encodeRange: r => encodeURIComponent(r), _rrOfflineNow: () => false,
    _withTokenRetry: fn => fn(), _rrGridHeal: async () => false, rrOutboxSupersede() {},
    _rrWriteFailed: (k, a, e) => e,
    fetch: async (url, init) => { sent.push({ url, body: JSON.parse(init.body) });
      return { ok: true, json: async () => ({ updates: { updatedRange: 'X!A7:C7' } }) }; },
  };
  vm.createContext(c);
  vm.runInContext([
    grab(src, 'function rrSheetCell('), grab(src, 'function rrSheetCells('),
    grab(src, 'async function sheetsUpdate('), grab(src, 'async function sheetsAppend('), grab(src, 'async function sheetsSetupUpdate('),
    grab(tagSrc, 'async function _rrTagBatch('),
    'this.sheetsUpdate = sheetsUpdate; this.sheetsAppend = sheetsAppend; this.sheetsSetupUpdate = sheetsSetupUpdate; this._rrTagBatch = _rrTagBatch;',
  ].join('\n'), c);
  return { c, sent };
}
async function runB(src, tagSrc) {
  const { c, sent } = writers(src, tagSrc);
  const row = ['-missing one coupler', '0209', 25, '2026-10-29', 'Shelf 3'];
  const want = ["'-missing one coupler", "'0209", 25, '2026-10-29', 'Shelf 3'];
  await c.sheetsUpdate('SHEET', 'My Collection!A5:E5', [row]);
  await c.sheetsAppend('SHEET', 'Sold!A:E', [row]);
  await c._rrTagBatch([{ range: 'My Collection!K5', values: [['+1 shelf']] }]);
  await c.sheetsSetupUpdate('SHEET', 'Dashboard!A1:B1', [['=HYPERLINK("#gid=1","Home")', 'MY TRAINS']]);
  const vals = i => sent[i] && (sent[i].body.values || (sent[i].body.data && sent[i].body.data[0].values));
  return {
    update: JSON.stringify(vals(0) && vals(0)[0]) === JSON.stringify(want),
    append: JSON.stringify(vals(1) && vals(1)[0]) === JSON.stringify(want),
    tag: JSON.stringify(vals(2)) === JSON.stringify([["'+1 shelf"]]),
    tagUserEntered: !!(sent[2] && sent[2].body.valueInputOption === 'USER_ENTERED'),
    setup: JSON.stringify(vals(3)) === JSON.stringify([['=HYPERLINK("#gid=1","Home")', 'MY TRAINS']]),
    sent: sent.map(s => vals(sent.indexOf(s))),
  };
}

// ── C: every USER_ENTERED writer applies the rule ──────────────────────────
function enclosingFn(src, idx) {
  // the nearest function whose balanced body contains idx
  const re = /(?:async\s+)?function\s*[\w$]*\s*\([^)]*\)\s*\{/g; let m, best = null;
  while ((m = re.exec(src)) && m.index < idx) {
    let d = 0, k = src.indexOf('{', m.index);
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) break; } }
    if (k > idx) best = src.slice(m.index, k + 1);
  }
  return best;
}
function scanUserEntered(files) {
  const out = [];
  for (const [f, src] of Object.entries(files)) {
    const lines = src.split('\n'); let off = 0;
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      if (/USER_ENTERED/.test(L) && !/^\s*(\/\/|\*)/.test(L) && !/\/\/.*USER_ENTERED/.test(L.replace(/(['"`]).*?\1/g, ''))) {
        const fn = enclosingFn(src, off + L.indexOf('USER_ENTERED'));
        if (!fn || !/rrSheetCells\s*\(/.test(fn)) out.push(f + ':' + (i + 1));
      }
      off += L.length + 1;
    }
  }
  return out;
}
const appFiles = () => { const o = {}; fs.readdirSync(APP).filter(f => f.endsWith('.js')).forEach(f => { o[f] = read(f); }); return o; };

// ── D: rrToday ─────────────────────────────────────────────────────────────
function centralEvening(cfgSrc) {
  // 01:30 UTC on Oct 30 = 8:30 PM Central on Oct 29
  const script = grab(cfgSrc, 'function rrToday(') +
    '\nvar at = new Date("2026-10-30T01:30:00Z");' +
    '\nprocess.stdout.write(JSON.stringify({ now: rrToday(at), old: at.toISOString().slice(0, 10), plain: typeof rrToday() }));';
  const r = cp.spawnSync(process.execPath, ['-e', script], { env: Object.assign({}, process.env, { TZ: 'America/Chicago' }), encoding: 'utf8' });
  try { return JSON.parse(r.stdout); } catch (e) { return { err: r.stderr || r.stdout }; }
}

// ── E: no London today, no second local today ──────────────────────────────
const LONDON = /new Date\((?:Date\.now\(\))?\)\s*\.toISOString\(\)\s*\.(?:slice\(0,\s*10\)|substring\(0,\s*10\)|substr\(0,\s*10\)|split\(['"]T['"]\)\[0\])/;
const SECOND = /toLocaleDateString\(\s*['"](?:en-CA|sv-SE|sv)['"]/;
function scanToday(files) {
  const out = [];
  for (const [f, src] of Object.entries(files)) {
    src.split('\n').forEach((L, i) => {
      if (/rr-utc-day/.test(L)) return;
      if (LONDON.test(L)) out.push(f + ':' + (i + 1) + ' London today');
      else if (SECOND.test(L)) out.push(f + ':' + (i + 1) + ' a second local today');
    });
  }
  return out;
}

(async () => {
  section('A  the one cell rule (real rrSheetCell from app/sheets.js)');
  const a = runA(SHEETS, 'real');
  ok('A1 every shape Google misreads goes in as text (' + GUARDED.length + ' cases)', a.bad.length === 0, a.bad);
  ok('A2 numbers, prices, dates, links, words and marked text are unchanged (' + UNCHANGED.length + ' cases)', a.moved.length === 0, a.moved);
  ok('A3 a real number / blank / true is passed through untouched', a.nonStr.length === 0, a.nonStr);
  ok('A4 never doubles the text mark (rrSheetText output and a second pass stay as they are)', a.twice.length === 0, a.twice);
  ok('A5 rrSheetCells walks a whole grid', JSON.stringify(a.grid) === JSON.stringify([["'0209", 'Shelf 3', 25], ["'-x", '2026-10-29']]), a.grid);

  section('B  the writers send the guarded cells (real sheetsUpdate / sheetsAppend / _rrTagBatch)');
  const b = await runB(SHEETS, TAG);
  ok('B1 sheetsUpdate: "-missing one coupler" and "0209" go as text; 25 and the date untouched', b.update, b.sent[0]);
  ok('B2 sheetsAppend: the same row, the same result', b.append, b.sent[1]);
  ok('B3 the bulk-tag batch (the third USER_ENTERED writer) guards its cells', b.tag && b.tagUserEntered, b.sent[2]);
  ok('B4 a set-up write keeps its formula (the Dashboard tab\'s Home button)', b.setup, b.sent[3]);

  section('C  SCAN: every USER_ENTERED write in app/ goes through rrSheetCells');
  const files = appFiles();
  const c = scanUserEntered(files);
  ok('C1 no USER_ENTERED write outside the rule (' + Object.keys(files).length + ' files)', c.length === 0, c);
  const ueCount = Object.values(files).reduce((n, s) => n + s.split('\n').filter(L => /USER_ENTERED/.test(L) && !/^\s*(\/\/|\*)/.test(L)).length, 0);
  ok('C2 the scan has something to read (the three writers are found: ' + ueCount + ' lines)', ueCount >= 3, ueCount);

  section('D  the one today (real rrToday from app/config.js, run in Central time)');
  const d = centralEvening(CFG);
  ok('D1 8:30 PM Central on Oct 29 is the 29th', d.now === '2026-10-29', d);
  ok('D2 the old London way said the 30th — the bug this fixes, shown', d.old === '2026-10-30', d);
  ok('D3 rrToday() with nothing passed gives a date', d.plain === 'string', d);

  section('E  SCAN: no London today, no second local today');
  const e = scanToday(files);
  ok('E1 no "today" worked out in London time, no second copy of a local today', e.length === 0, e);

  section('F  the saves that showed the bug use the one today');
  const APPJS = read('app.js'), SAVE = read('wizard-save.js'), PAGES = read('app-pages.js'), WIZ = read('wizard.js');
  ok('F1 Date Added (buildPersonalRow) stamps rrToday()', /dateAdded:\s*rrToday\(\)/.test(grab(APPJS, 'function buildPersonalRow(')));
  ok('F2 Date Sold and Date Listed in the wizard saves default to rrToday()',
     /dateSold:\s*d\.dateSold\s*\|\|\s*\(?rrToday\(\)/.test(SAVE) && /d\.dateListed\s*\|\|\s*rrToday\(\)/.test(SAVE));
  ok('F3 the For Sale / Sold date boxes and the sale helper start at rrToday()',
     /id="eph-fs-date" value="\$\{rrToday\(\)\}"/.test(PAGES) && /id="eph-sold-date" value="\$\{rrToday\(\)\}"/.test(PAGES)
     && /function _rrSaleToday\(\)\s*\{\s*return rrToday\(\);/.test(PAGES));
  ok('F4 the wizard\'s date step stamps rrToday()', /wizard\.data\[s\.id\]\s*=\s*rrToday\(\)/.test(WIZ));

  section('P  planted offenders — each must turn its own check red');
  const pA = runA(plant(SHEETS, "if (/^[=+\\-@]/.test(t)) return \"'\" + v;", ''), 'planted');
  ok('P1 PLANTED the formula line taken out: A1 goes red', pA.bad.length > 0 && pA.bad.some(x => /coupler/.test(x)), pA.bad.length);
  const pA2 = runA(plant(SHEETS, "if (/^0\\d/.test(t)) return \"'\" + v;", ''), 'planted');
  ok('P2 PLANTED the leading-zero line taken out: A1 goes red on "0209"', pA2.bad.some(x => /0209/.test(x)), pA2.bad);
  const pA3 = runA(plant(SHEETS, "if (/^[-+]?(0|[1-9]\\d*)(\\.\\d+)?$/.test(t)) return v;", ''), 'planted');
  ok('P3 PLANTED the plain-number line taken out: A2 goes red (-12.50 would turn to text)', pA3.moved.length > 0, pA3.moved);
  const pA4 = runA(plant(SHEETS, "if (/^\\d{1,2}[-\\/]\\d{1,4}$/.test(t)) return \"'\" + v;", ''), 'planted');
  ok('P4 PLANTED the date-shape line taken out: A1 goes red on "6-8459" and "10-1024"', pA4.bad.some(x => /6-8459/.test(x)) && pA4.bad.some(x => /10-1024/.test(x)), pA4.bad);
  const pB = await runB(plant(SHEETS, "values: (opts && opts.setup) ? values : rrSheetCells(values) }", 'values }'), TAG);
  ok('P5 PLANTED sheetsUpdate without the rule: B1 goes red', !pB.update, pB.sent[0]);
  const pB2 = await runB(plant(SHEETS, "values: (opts && opts.setup) ? values : rrSheetCells(values) }", 'values: rrSheetCells(values) }'), TAG);
  ok('P6 PLANTED the rule run on set-up writes too: B4 goes red (the Home button would break)', !pB2.setup, pB2.sent[3]);
  const pB3 = await runB(SHEETS, plant(TAG, 'values: rrSheetCells(d.values)', 'values: d.values'));
  ok('P7 PLANTED the bulk-tag batch without the rule: B3 goes red', !pB3.tag, pB3.sent[2]);
  const pC = scanUserEntered(Object.assign({}, files, { 'planted.js': "async function _plantedWrite(v) {\n  return fetch('https://x/values:batchUpdate', { body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: v }) });\n}\n" }));
  ok('P8 PLANTED a new USER_ENTERED writer that skips the rule: C1 goes red', pC.length === 1 && /planted\.js:2/.test(pC[0]), pC);
  const pC2 = scanUserEntered({ 'planted.js': "// we used to write USER_ENTERED here\n" });
  ok('P9 a comment that says USER_ENTERED is not a writer (C1 stays green)', pC2.length === 0, pC2);
  const pD = centralEvening(plant(CFG, "return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());", 'return t.toISOString().slice(0, 10);'));
  ok('P10 PLANTED rrToday done the London way: D1 goes red', pD.now !== '2026-10-29', pD);
  const pE = scanToday(Object.assign({}, files, { 'planted.js':
    "var a = new Date().toISOString().slice(0, 10);\nvar b = new Date().toISOString().split('T')[0];\nvar c = new Date(Date.now()).toISOString().substring(0,10);\nvar d = new Date().toLocaleDateString('en-CA');\nvar e = new Date().toISOString().slice(0, 10);   // rr-utc-day: a Google quota that resets in London\n" }));
  ok('P11 PLANTED four London / second todays: E1 finds all four, and passes the marked one', pE.length === 4 && pE.every(x => /planted\.js:[1-4] /.test(x)), pE);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  the suite threw: ' + (e && e.stack || e)); process.exit(1); });
