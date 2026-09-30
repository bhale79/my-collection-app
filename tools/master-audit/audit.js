#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// tools/master-audit/audit.js — the master-list audit (roadmap 4.31, 2026-09-30)
//
// [stated] Brad: an on-demand check, not a nightly one — "we don't add or
// subtract like that". Run it after every master edit, next to the Master
// Version row, and whenever Brad says "run the master audit":
//
//     node tools/master-audit/audit.js --out <dir> [--prev <dir>/STATE.json]
//                                      [--tabs "MTH O,Atlas O"] [--fixture <dir>]
//
// Every check is a plain RULE (the table below) — no Claude tokens per row.
// The master is read the way the public already can: each tab's EXPORT CSV
// (export?format=csv&gid=…, cells exactly as the sheet displays them; no
// token, no Sheets quota), the tab's gid taken from the sheet's public
// htmlview page. NOT the gviz endpoint: gviz types a column by its majority
// and BLANKS a text cell in a mostly-numeric column — "116C", "1A", "ART-5400"
// and Variation # "A"/"B" all read as empty, which made 957 numbered rows look
// numberless and five distinct MPC rows look identical (2026-09-30). The
// export keeps text as text and keeps blank rows, so a CSV row IS a sheet row.
// The rules ask the APP'S OWN definitions, never
// a copy: the tab list is ERA_TABS + MASTER_TAB_KEYS (config.js), fields are
// read by header name through MASTER_COL_SPEC / parseMasterRow (app-data.js),
// a type is judged by getTypeBucket (type-groups.js), a gauge by
// _scalesOfGauge (app.js), the Master Version by _mvPickLatest (app-data.js).
// Change a rule in the app and this audit follows.
//
// Outputs (in --out): MASTER_AUDIT_<date>.md (the morning read: counts per
// rule per tab, NEW since the previous run, CLEARED since), MASTER_AUDIT_
// <date>_flags.csv (one line per flag — tools/master-audit/to_xlsx.py makes
// the banded workbook), STATE.json (the flag keys, for the next run's deltas).
//
// A flag is identified by tab + item number + variation + rule + field —
// stable identifiers, never a row number. The sheet row is given only as a
// hint (rows move whenever the sheet is edited).
//
// --fixture <dir> reads <dir>/<tab>.csv instead of the network — that is how
// tests/master_list_tests.js runs the real rules on planted rows.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const APP = path.join(__dirname, '..', '..', 'app');
const SRC = f => fs.readFileSync(path.join(APP, f), 'utf8');

// ── lifting the app's own code ───────────────────────────────────────────
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find ' + name);
  let d = 0; const s0 = src.indexOf('{', i);
  for (let k = s0; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}
function constBlock(src, name) {
  // `const NAME = <literal>;` — the literal ends at the first "\n};" or "\n];" after it
  const i = src.indexOf('const ' + name + ' = ');
  if (i < 0) throw new Error('could not find const ' + name);
  const open = src[src.indexOf('=', i) + 2];
  const close = open === '[' ? '\n];' : (open === '{' ? '\n};' : ';');
  const j = src.indexOf(close, i);
  if (j < 0) throw new Error('unterminated const ' + name);
  return src.slice(i, j + close.length) + '\n';
}
function constLine(src, name) {
  const i = src.indexOf('const ' + name + ' = ');
  if (i < 0) throw new Error('could not find const ' + name);
  const j = src.indexOf(';\n', i);
  return src.slice(i, j + 1) + '\n';
}

// The app's dedupe key, taken from _deduplicateMaster's own `const key = …;`
// line so the audit's idea of "the same row" can never drift from the app's.
function dedupeKeyFn(adSrc) {
  const fn = grab(adSrc, '_deduplicateMaster');
  const m = fn.match(/const key = ([^;]+);/);
  if (!m) throw new Error('_deduplicateMaster has no `const key = …;` line');
  return 'function masterDedupeKey(m) { return ' + m[1] + '; }';
}
function loadApp() {
  const cfg = SRC('config.js'), ad = SRC('app-data.js'), app = SRC('app.js'), tg = SRC('type-groups.js');
  const w = {};
  new Function('window', tg)(w);                       // the real bucketer
  const lifted = new Function(
    constLine(cfg, 'MASTER_SHEET_ID') +
    constBlock(cfg, 'ERAS') +
    constLine(cfg, 'REAL_ERA_IDS') +
    constLine(cfg, 'LOOKUP_ONLY_ERAS') +
    constBlock(cfg, 'ERA_TABS') +
    constLine(cfg, 'MASTER_TAB_KEYS') +
    constBlock(ad, 'MASTER_COL_SPEC') +
    grab(ad, '_normHdr') + '\n' + grab(ad, 'buildMasterColMap') + '\n' + grab(ad, '_mcell') + '\n' +
    grab(ad, '_fmtYearProd') + '\n' + grab(ad, 'parseMasterRow') + '\n' +
    grab(ad, '_mvCompare') + '\n' + grab(ad, '_mvDateKey') + '\n' + grab(ad, '_mvPickLatest') + '\n' +
    grab(app, '_scalesOfGauge') + '\n' +
    dedupeKeyFn(ad) + '\n' +
    'return { MASTER_SHEET_ID, ERAS, REAL_ERA_IDS, LOOKUP_ONLY_ERAS, ERA_TABS, MASTER_TAB_KEYS, ' +
    'buildMasterColMap, parseMasterRow, _mvPickLatest, _scalesOfGauge, masterDedupeKey };'
  )();
  lifted.getTypeBucket = w.getTypeBucket;
  lifted.TYPE_BUCKETS = w.TYPE_BUCKETS;
  return lifted;
}

// ── the tabs to walk: every inventory tab of every real era ─────────────
// (parts catalogs are lookup-only eras with their own shape — not walked;
//  Catalogs / Sets / Companions / Instruction Sheets have their own schema —
//  not walked. Both said so in the report.)
function auditTabs(A, only) {
  const out = [];
  A.REAL_ERA_IDS.forEach(era => {
    if (A.LOOKUP_ONLY_ERAS.indexOf(era) >= 0) return;
    const et = A.ERA_TABS[era]; if (!et) return;
    A.MASTER_TAB_KEYS.forEach(k => { if (et[k]) out.push({ era, key: k, tab: et[k] }); });
  });
  if (only && only.length) return out.filter(t => only.indexOf(t.tab) >= 0);
  return out;
}

// ── reading a tab ────────────────────────────────────────────────────────
// The sheet's public htmlview page lists every tab with its gid; the export
// endpoint needs the gid. One page fetch per run, then one export per tab.
function htmlviewUrl(sheetId) { return 'https://docs.google.com/spreadsheets/d/' + sheetId + '/htmlview'; }
function exportUrl(sheetId, gid) { return 'https://docs.google.com/spreadsheets/d/' + sheetId + '/export?format=csv&gid=' + gid; }
// The tab names on that page are JS string literals ("\x3d", "\/", "\"") — decode them.
function jsUnescape(s) {
  return s.replace(/\\x([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
          .replace(/\\u([0-9A-Fa-f]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
          .replace(/\\(.)/g, '$1');
}
function gidMapFromHtml(html) {
  const map = {};
  const re = /items\.push\(\{name: "((?:[^"\\]|\\.)*)", pageUrl: "[^"]*", gid: "(\d+)"/g;
  let m; while ((m = re.exec(html))) { const name = jsUnescape(m[1]); if (!(name in map)) map[name] = m[2]; }
  return map;
}
async function loadGids(A) {
  const map = gidMapFromHtml(await fetchText(htmlviewUrl(A.MASTER_SHEET_ID)));
  if (!Object.keys(map).length) throw new Error('the sheet\'s public page listed no tabs — nothing was read');
  A._gids = map;
  return map;
}
function fetchText(url, hops) {
  hops = hops || 0;
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if ([301, 302, 303, 307, 308].indexOf(res.statusCode) >= 0 && res.headers.location && hops < 5) {
        res.resume(); return resolve(fetchText(res.headers.location, hops + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' for ' + url)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}
// RFC 4180: quoted fields, doubled quotes, newlines inside quotes.
function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false, i = 0;
  if (text.charCodeAt(0) === 0xFEFF) i = 1;
  for (; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
async function readTab(A, tab, fixtureDir) {
  if (fixtureDir) {
    const f = path.join(fixtureDir, tab + '.csv');
    if (!fs.existsSync(f)) return null;
    return parseCsv(fs.readFileSync(f, 'utf8'));
  }
  const gids = A._gids || await loadGids(A);
  const gid = gids[tab];
  if (gid === undefined) throw new Error('no tab named "' + tab + '" on the sheet (its public page lists ' + Object.keys(gids).length + ' tabs)');
  return parseCsv(await fetchText(exportUrl(A.MASTER_SHEET_ID, gid)));
}

// ── the rules — ONE table ────────────────────────────────────────────────
// test(m, ctx) returns a note (the flag) or '' (the row passes). `m` is the
// row as parseMasterRow gives it to the app. ctx = { era, tab, A, yearSpan }.
const YEAR_MIN = 1900;
const YEAR_MAX = new Date().getFullYear() + 1;
const ENTITY = /&(amp|quot|#\d+|lt|gt|apos|nbsp);/i;
// Rolling stock and engines — the kinds of row where a blank Road Name is
// worth counting (accessories, track and paper have none). Counted per tab
// in the coverage table, never flagged row by row: Lionel postwar and pre-war
// engines carry no road by convention, Märklin's European models neither,
// and 18,000 "look at me" rows would bury the real findings (measured on the
// first live run, 2026-09-30).
const ROAD_BUCKETS = { 'Boxcar': 1, 'Caboose': 1, 'Diesel Locomotive': 1, 'Electric Locomotive': 1, 'Flatcar': 1, 'Gondola': 1, 'Hopper': 1,
                       'Intermodal': 1, 'Operating Freight': 1, 'Passenger Car': 1, 'Steam Locomotive': 1, 'Stock Car': 1, 'Tank Car': 1 };
const MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i;
// A REAL date, not a number that merely wears dashes: Lionel's 1364-12-58 and
// CTC-14 are catalog numbers. Year 1900–2100, month 1–12, day 1–31, or a
// spreadsheet's "Jan-05" / "5-Jan" with a real month name.
function looksLikeDate(s) {
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})([T ]\d{1,2}:\d{2}(:\d{2})?)?$/);
  if (m) return +m[1] >= 1900 && +m[1] <= 2100 && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) return +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31;
  m = s.match(/^([A-Za-z]{3})-(\d{2}|\d{4})$/); if (m) return MONTHS.test(m[1]);
  m = s.match(/^(\d{1,2})-([A-Za-z]{3})(-(\d{2}|\d{4}))?$/); if (m) return MONTHS.test(m[2]) && +m[1] >= 1 && +m[1] <= 31;
  return false;
}
function yearSpanOf(A, era) {
  const y = String((A.ERAS[era] || {}).years || '').trim();
  const m = y.match(/^(\d{4})\s*-\s*(\d{4}|Today)$/i);
  if (!m) return null;
  return { from: +m[1], to: /today/i.test(m[2]) ? YEAR_MAX : +m[2] };
}
// '1957' | '1957-1966' | '1957-66' | '1955-1957, 1959' | 'Fall 2022' | 'c. 1950'
// → the years named; null when the cell cannot be read as years at all.
function yearsOf(raw) {
  const t = String(raw || '').trim();
  if (!t) return [];
  const out = [];
  const body = t.replace(/\s*\([^)]*\)\s*$/, '');   // "2019–2020 (archive dates)" — the note is not the year
  const two = y => (+y <= 30 ? 2000 : 1900) + +y;    // "94-95" → 1994-1995; "05" → 2005
  for (let part of body.split(/[,;/]/)) {
    part = part.trim().replace(/^(c\.|ca\.|circa|about|approx\.?)\s*/i, '').replace(/^(spring|summer|fall|autumn|winter|early|late|mid)[\s-]*/i, '');
    if (!part) continue;
    let m = part.match(/^(\d{4})$/); if (m) { out.push(+m[1]); continue; }
    m = part.match(/^(\d{4})\s*[-–]\s*(\d{4})$/); if (m) { out.push(+m[1], +m[2]); continue; }
    m = part.match(/^(\d{4})\s*[-–]\s*(\d{2})$/); if (m) { out.push(+m[1], +(m[1].slice(0, 2) + m[2])); continue; }
    m = part.match(/^(\d{2})\s*[-–]\s*(\d{2})$/); if (m) { out.push(two(m[1]), two(m[2])); continue; }
    return null;
  }
  return out;
}

const RULES = [
  // ── the item number ──
  { id: 'num-missing', sev: 'check', field: 'itemNum', title: 'no item number, but a description',
    test: m => (!m.itemNum.trim() && m.description.trim()) ? 'row has a description but no number' : '' },
  { id: 'num-header', sev: 'check', field: 'itemNum', title: 'a header row inside the data',
    test: m => /^item\s*(number|no\.?|#)$/i.test(m.itemNum.trim()) ? 'a re-typed header row' : '' },
  { id: 'num-date', sev: 'check', field: 'itemNum', title: 'item number stored as a date or a decimal (the S103 / S154 bug)',
    test: m => { const n = m.itemNum.trim(); if (!n) return ''; if (looksLikeDate(n)) return 'reads as a date: ' + n; if (/^\d+\.0+$/.test(n)) return 'reads as a decimal: ' + n; return ''; } },
  { id: 'num-space', sev: 'check', field: 'itemNum', title: 'item number with stray spaces (breaks exact matches)',
    test: m => (m.itemNum !== m.itemNum.trim() || /\s{2,}/.test(m.itemNum)) ? JSON.stringify(m.itemNum) : '' },
  // ── the type ──
  { id: 'type-missing', sev: 'look', field: 'itemType', title: 'no item type (the app then files the row by its words — usually right, not always)',
    test: m => (!m.itemType.trim() && m.itemNum.trim()) ? 'blank' : '' },
  { id: 'type-unknown', sev: 'look', field: 'itemType', title: 'item type outside the app\'s 23 buckets (shown as its own word in the Type column)',
    test: (m, ctx) => {
      if (!m.itemType.trim()) return '';
      const b = ctx.A.getTypeBucket(m);
      return ctx.bucketIds[b] ? '' : ('"' + m.itemType + '" → "' + b + '" (not a bucket)');
    } },
  // ── the description ──
  { id: 'desc-missing', sev: 'check', field: 'description', title: 'no description',
    test: m => (!m.description.trim() && m.itemNum.trim()) ? 'blank' : '' },
  { id: 'desc-short', sev: 'look', field: 'description', title: 'description under four characters',
    test: m => { const d = m.description.trim(); return (d && d.length < 4) ? JSON.stringify(d) : ''; } },
  { id: 'desc-bare-no', sev: 'check', field: 'description', title: 'description ends in the bare word "No" (a cut-off "No. 390…", the v1783 case)',
    test: m => /\bNo\.?$/.test(m.description.trim()) ? '…' + m.description.trim().slice(-30) : '' },
  { id: 'text-entity', sev: 'check', field: 'description', title: 'HTML leftovers (&amp; &quot; …) in a text cell',
    test: m => { for (const f of ['description', 'roadName', 'varDesc', 'notes', 'subType', 'originalDesc']) { if (ENTITY.test(m[f] || '')) return f + ': ' + (m[f].match(ENTITY) || [''])[0]; } return ''; } },
  // ── the year ──
  { id: 'year-unreadable', sev: 'check', field: 'yearProd', title: 'year that is not a year or a range',
    test: m => { const r = m._yearRaw; if (!String(r || '').trim()) return ''; const t = _fmtYear(r); return yearsOf(t) === null ? JSON.stringify(String(r)) : ''; } },
  { id: 'year-out-of-range', sev: 'check', field: 'yearProd', title: 'year outside 1900–next year, or a range running backwards',
    test: m => { const ys = yearsOf(_fmtYear(m._yearRaw)); if (!ys || !ys.length) return ''; if (ys.some(y => y < YEAR_MIN || y > YEAR_MAX)) return String(m._yearRaw); if (ys.length === 2 && ys[1] < ys[0]) return 'backwards: ' + m._yearRaw; return ''; } },
  { id: 'year-off-era', sev: 'look', field: 'yearProd', title: 'year outside the era this tab covers',
    test: (m, ctx) => { if (!ctx.yearSpan) return ''; const ys = yearsOf(_fmtYear(m._yearRaw)); if (!ys || !ys.length) return ''; const bad = ys.filter(y => y < ctx.yearSpan.from || y > ctx.yearSpan.to); return bad.length ? (m._yearRaw + ' vs era ' + ctx.yearSpan.from + '-' + ctx.yearSpan.to) : ''; } },
  // ── the gauge ──
  { id: 'gauge-unknown', sev: 'look', field: 'gauge', title: 'a gauge spelling the app cannot read (harmless where the era has one scale; the words to teach _scalesOfGauge)',
    test: (m, ctx) => (m.gauge.trim() && !ctx.A._scalesOfGauge(m.gauge).length) ? JSON.stringify(m.gauge) : '' },
  { id: 'gauge-missing-prewar', sev: 'check', field: 'gauge', title: 'blank gauge on Lionel Pre-War (the one tab where gauge is load-bearing)',
    test: (m, ctx) => (ctx.era === 'prewar' && !m.gauge.trim() && m.itemNum.trim()) ? 'blank' : '' },
  // ── the link ──
  { id: 'link-bad', sev: 'check', field: 'refLink', title: 'reference link that is not a web address',
    test: m => { const l = m.refLink.trim(); if (!l) return ''; if (!/^https?:\/\/\S+$/i.test(l)) return JSON.stringify(l.slice(0, 60)); if (ENTITY.test(l)) return 'HTML leftover in the address'; return ''; } },
  // ── the money ──
  { id: 'value-bad', sev: 'look', field: 'marketVal', title: 'market value / MSRP with no amount in it, or an absurd one (a cell listing several prices passes)',
    test: m => { for (const f of ['marketVal', 'msrp']) { const v = String(m[f] || '').trim(); if (!v) continue;
      const nums = (v.replace(/,(?=\d{3})/g, '').match(/\d+(\.\d+)?/g) || []).map(Number);
      if (!nums.length) return f + ': ' + JSON.stringify(v.slice(0, 40));
      if (nums.some(n => n > 50000)) return f + ': ' + v.slice(0, 40); } return ''; } },
];
function _fmtYear(raw) {
  // the app's own display rule reduces '1957-01-01' → '1957'; reuse it
  const t = String(raw == null ? '' : raw).trim();
  let m = t.match(/^(\d{4})-\d{1,2}-\d{1,2}(?:[T ]\d{1,2}:\d{2}(?::\d{2})?)?$/); if (m) return m[1];
  m = t.match(/^\d{1,2}\/\d{1,2}\/(\d{4})$/); if (m) return m[1];
  return t;
}
// Tab-wide rules (need every row of the tab): duplicates.
// Duplicates are judged by the app's OWN dedupe key (_deduplicateMaster,
// app-data.js): a row that key collapses is a row the app already throws
// away at load — the S154 duplicates. Two rows that agree on everything the
// product IS (number, variation, powered/dummy, track power, sub type, date)
// but differ in road or description are 'dup-key': one product, two stories.
// Atlas sells one number as 3-rail and 2-rail rows; those differ in track
// power and are NOT flagged.
function tabRules(rows, A) {
  const out = [];
  const exact = {}, product = {};
  rows.forEach((m, i) => {
    if (!m.itemNum.trim()) return;
    (exact[A.masterDedupeKey(m)] = exact[A.masterDedupeKey(m)] || []).push(i);
    const p = [m.itemNum.trim(), m.variation.trim(), (m.poweredDummy || '').trim(), (m.trackPower || '').trim(), (m.subType || '').trim(), String(m._yearRaw || '').trim()].join('|');
    (product[p] = product[p] || []).push(i);
  });
  const exactIdx = new Set();
  Object.keys(exact).forEach(e => { if (exact[e].length > 1) exact[e].forEach(i => { exactIdx.add(i); out.push({ i, id: 'dup-exact', field: 'itemNum', note: 'identical row appears ' + exact[e].length + '× — the app keeps one' }); }); });
  Object.keys(product).forEach(p => {
    const g = product[p]; if (g.length < 2) return;
    const stories = new Set(g.map(i => A.masterDedupeKey(rows[i])));
    if (stories.size < 2) return;
    g.forEach(i => { if (!exactIdx.has(i)) out.push({ i, id: 'dup-key', field: 'itemNum', note: 'one product (number, variation, unit, rail, sub type, date) told ' + stories.size + ' ways' }); });
  });
  return out;
}
const TAB_RULES = [
  { id: 'dup-exact', sev: 'check', field: 'itemNum', title: 'identical rows by the app\'s own dedupe key (the app keeps one, drops the rest) — the S154 duplicates' },
  { id: 'dup-key', sev: 'look', field: 'itemNum', title: 'one product (number, variation, unit, rail, sub type, date) with two different roads or descriptions' },
];
const ALL_RULES = RULES.concat(TAB_RULES);

// ── checking one tab ─────────────────────────────────────────────────────
function checkTab(A, t, csvRows) {
  const res = { tab: t.tab, era: t.era, rowsChecked: 0, flags: [], header: null, headerOk: true };
  if (!csvRows || !csvRows.length) { res.headerOk = false; return res; }
  const cm = A.buildMasterColMap(csvRows[0]);
  res.header = csvRows[0];
  if (!cm) { res.headerOk = false; res.flags.push({ tab: t.tab, row: 1, itemNum: '', variation: '', rule: 'tab-header', field: '', note: 'row 1 is not a recognisable item-tab header' }); return res; }
  const bucketIds = {}; (A.TYPE_BUCKETS || []).forEach(b => { bucketIds[b.id] = 1; });
  const ctx = { era: t.era, tab: t.tab, A, yearSpan: yearSpanOf(A, t.era), bucketIds };
  const parsed = [];
  for (let n = 1; n < csvRows.length; n++) {
    const r = csvRows[n];
    if (!r || !r.some(c => String(c || '').trim())) continue;   // a blank row — skipped, but it keeps its row number
    const m = A.parseMasterRow(r, t.tab, cm); m._era = t.era; m._sheetRow = n + 1;
    parsed.push(m);
  }
  res.rowsChecked = parsed.length;
  // Coverage — how full the tab is, field by field (a picture, not a flag).
  const cov = { rows: parsed.length, road: 0, roadOf: 0, type: 0, gauge: 0, year: 0, desc: 0, link: 0 };
  parsed.forEach(m => {
    if (!m.itemNum.trim()) return;
    if (m.itemType.trim()) cov.type++;
    if (m.gauge.trim()) cov.gauge++;
    if (String(m._yearRaw || '').trim()) cov.year++;
    if (m.description.trim()) cov.desc++;
    if (m.refLink.trim()) cov.link++;
    const b = A.getTypeBucket(m);
    if (ROAD_BUCKETS[b] && !/undecorated|unlettered|unpainted|undec\b/i.test(m.description + ' ' + m.varDesc + ' ' + m.subType)) { cov.roadOf++; if (m.roadName.trim()) cov.road++; }
  });
  res.coverage = cov;
  parsed.forEach(m => {
    RULES.forEach(rule => {
      let note = ''; try { note = rule.test(m, ctx); } catch (e) { note = 'rule threw: ' + e.message; }
      if (note) res.flags.push({ tab: t.tab, row: m._sheetRow, itemNum: m.itemNum, variation: m.variation, rule: rule.id, field: rule.field, value: String(m[rule.field] == null ? '' : m[rule.field]), note: String(note) });
    });
  });
  tabRules(parsed, A).forEach(f => { const m = parsed[f.i]; res.flags.push({ tab: t.tab, row: m._sheetRow, itemNum: m.itemNum, variation: m.variation, rule: f.id, field: f.field, value: m.itemNum, note: f.note }); });
  return res;
}
const flagKey = f => [f.tab, f.itemNum.trim(), f.variation.trim(), f.rule, f.field].join('|');

// ── the report ───────────────────────────────────────────────────────────
function summarize(results, prev, meta) {
  const flags = results.flatMap(r => r.flags);
  const keys = new Set(flags.map(flagKey));
  const prevKeys = new Set((prev && prev.keys) || []);
  const fresh = flags.filter(f => !prevKeys.has(flagKey(f)));
  const cleared = prev ? [...prevKeys].filter(k => !keys.has(k)) : [];
  const perRule = {}; ALL_RULES.forEach(r => { perRule[r.id] = { total: 0, tabs: {} }; });
  perRule['tab-header'] = { total: 0, tabs: {} };
  flags.forEach(f => { const p = perRule[f.rule] || (perRule[f.rule] = { total: 0, tabs: {} }); p.total++; p.tabs[f.tab] = (p.tabs[f.tab] || 0) + 1; });
  // The words behind type-unknown / gauge-unknown, counted: the useful view
  // of a vocabulary gap is "which words, how many", not 479 rows.
  const vocab = {};
  flags.forEach(f => { if (f.rule !== 'type-unknown' && f.rule !== 'gauge-unknown') return; const k = f.rule + '|' + f.tab + '|' + (f.value || '').trim(); vocab[k] = (vocab[k] || 0) + 1; });
  return { meta, flags, keys: [...keys], fresh, cleared, perRule, vocab, tabs: results.map(r => ({ tab: r.tab, era: r.era, rowsChecked: r.rowsChecked, flags: r.flags.length, headerOk: r.headerOk, coverage: r.coverage || null })) };
}
function ruleTitle(id) { const r = ALL_RULES.find(x => x.id === id); return r ? r.title : id; }
function ruleSev(id) { const r = ALL_RULES.find(x => x.id === id); return r ? r.sev : 'check'; }
function md(S) {
  const L = [];
  const m = S.meta;
  L.push('# Master-list audit — ' + m.date + (m.masterVersion ? ' — Master Version ' + m.masterVersion : ''));
  L.push('');
  L.push('Read the way the public reads it (each tab\'s export CSV, cells as the sheet shows them), judged by the app\'s own rules. ' + S.tabs.length + ' tabs, **' +
         S.tabs.reduce((a, t) => a + t.rowsChecked, 0).toLocaleString() + ' rows checked, ' + S.flags.length.toLocaleString() + ' flags**' +
         (m.prevDate ? (' — **' + S.fresh.length.toLocaleString() + ' new** since ' + m.prevDate + ', **' + S.cleared.length.toLocaleString() + ' cleared**.') : ' (first run — every flag counts as new).'));
  L.push('');
  L.push('Not walked (their own shapes): the parts catalogs (' + m.skippedParts.join(', ') + ') and the Catalogs / Sets / Companions / Instruction Sheets tabs.');
  L.push('');
  L.push('**check** = almost certainly wrong, fix it · **look** = worth an eye, may be fine (a road-less flatcar, a year the era does not cover).');
  L.push('');
  L.push('## By rule');
  L.push('');
  L.push('| rule | kind | what it means | flags | new | tabs |');
  L.push('|---|---|---|---:|---:|---|');
  const freshByRule = {}; S.fresh.forEach(f => { freshByRule[f.rule] = (freshByRule[f.rule] || 0) + 1; });
  Object.keys(S.perRule).sort((a, b) => S.perRule[b].total - S.perRule[a].total).forEach(id => {
    const p = S.perRule[id]; if (!p.total) return;
    const tabs = Object.keys(p.tabs).sort((a, b) => p.tabs[b] - p.tabs[a]).map(t => t + ' ' + p.tabs[t]).join(' · ');
    L.push('| `' + id + '` | ' + ruleSev(id) + ' | ' + ruleTitle(id) + ' | ' + p.total.toLocaleString() + ' | ' + (freshByRule[id] || 0) + ' | ' + tabs + ' |');
  });
  const silent = ALL_RULES.filter(r => !S.perRule[r.id] || !S.perRule[r.id].total).map(r => '`' + r.id + '`');
  if (silent.length) { L.push(''); L.push('Rules with nothing to report: ' + silent.join(', ') + '.'); }
  const vk = Object.keys(S.vocab || {});
  if (vk.length) {
    L.push(''); L.push('## Words the app cannot read (type-unknown / gauge-unknown), counted'); L.push('');
    L.push('| rule | tab | word | rows |'); L.push('|---|---|---|---:|');
    vk.sort((a, b) => S.vocab[b] - S.vocab[a]).slice(0, 80).forEach(k => { const p = k.split('|'); L.push('| `' + p[0] + '` | ' + p[1] + ' | ' + (p[2] || '(blank)') + ' | ' + S.vocab[k] + ' |'); });
  }
  L.push('');
  L.push('## By tab — rows, flags, and how full each column is');
  L.push('');
  L.push('road = rolling stock and engines with a road name (undecorated exempt); the rest = rows with the cell filled. A low number is a picture of the source, not a fault of a row — it is here so gaps are seen, not flagged 18,000 times.');
  L.push('');
  L.push('| tab | era | rows | flags | road | type | gauge | year | description | link |');
  L.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  const pct = (n, d) => d ? Math.round(100 * n / d) + '%' : '—';
  S.tabs.forEach(t => {
    const c = t.coverage;
    L.push('| ' + t.tab + ' | ' + t.era + ' | ' + t.rowsChecked.toLocaleString() + ' | ' + (t.headerOk ? t.flags : 'HEADER NOT READ') + ' | ' +
      (c ? [pct(c.road, c.roadOf), pct(c.type, c.rows), pct(c.gauge, c.rows), pct(c.year, c.rows), pct(c.desc, c.rows), pct(c.link, c.rows)].join(' | ') : '— | — | — | — | — | —') + ' |');
  });
  if (S.fresh.length && m.prevDate) {
    L.push(''); L.push('## New since ' + m.prevDate + ' (first 60)'); L.push('');
    S.fresh.slice(0, 60).forEach(f => L.push('- ' + f.tab + ' · **' + (f.itemNum || '(no number)') + (f.variation ? ' var ' + f.variation : '') + '** · `' + f.rule + '` — ' + f.note + ' (sheet row ' + f.row + ')'));
  }
  if (S.cleared.length) {
    L.push(''); L.push('## Cleared since ' + m.prevDate + ' (first 60)'); L.push('');
    S.cleared.slice(0, 60).forEach(k => { const p = k.split('|'); L.push('- ' + p[0] + ' · **' + (p[1] || '(no number)') + (p[2] ? ' var ' + p[2] : '') + '** · `' + p[3] + '`'); });
  }
  L.push(''); L.push('## Examples per rule (first 8 each — the full list is the flags file)'); L.push('');
  Object.keys(S.perRule).forEach(id => {
    const ex = S.flags.filter(f => f.rule === id).slice(0, 8); if (!ex.length) return;
    L.push('**`' + id + '` — ' + ruleTitle(id) + '**'); L.push('');
    ex.forEach(f => L.push('- ' + f.tab + ' · ' + (f.itemNum || '(no number)') + (f.variation ? ' var ' + f.variation : '') + ' — ' + f.note + ' (sheet row ' + f.row + ')'));
    L.push('');
  });
  L.push('_A flag is tab + item number + variation + rule; the sheet row is a hint only — rows move whenever the sheet is edited (the export keeps blank rows, so the number is the row as it stood when this ran)._');
  return L.join('\n') + '\n';
}
function csvEscape(s) { s = String(s == null ? '' : s); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function flagsCsv(S) {
  const L = ['tab,item number,variation,rule,kind,field,cell as it stands,note,sheet row,new'];
  const freshKeys = new Set(S.fresh.map(flagKey));
  S.flags.forEach(f => L.push([f.tab, f.itemNum, f.variation, f.rule, ruleSev(f.rule), f.field, f.value || '', f.note, f.row, freshKeys.has(flagKey(f)) ? 'new' : ''].map(csvEscape).join(',')));
  return L.join('\n') + '\n';
}

// ── main ─────────────────────────────────────────────────────────────────
async function run(opts) {
  const A = loadApp();
  const tabs = auditTabs(A, opts.tabs);
  const results = [];
  if (!opts.fixture) await loadGids(A);   // one page fetch; a sheet with no readable tab list stops the run here, loudly
  let masterVersion = '';
  try {
    const mv = await readTab(A, 'Master Version', opts.fixture);
    const latest = mv ? A._mvPickLatest(mv.slice(1)) : null;
    masterVersion = latest ? latest.v : '';
  } catch (e) { masterVersion = ''; }
  for (const t of tabs) {
    let rows = null;
    try { rows = await readTab(A, t.tab, opts.fixture); }
    catch (e) { results.push({ tab: t.tab, era: t.era, rowsChecked: 0, flags: [{ tab: t.tab, row: 0, itemNum: '', variation: '', rule: 'tab-unreadable', field: '', note: e.message }], headerOk: false }); continue; }
    if (rows === null) { if (opts.fixture) continue; }
    results.push(checkTab(A, t, rows));
    if (opts.log) opts.log(t.tab + ': ' + results[results.length - 1].rowsChecked + ' rows, ' + results[results.length - 1].flags.length + ' flags');
  }
  const prev = opts.prev ? JSON.parse(fs.readFileSync(opts.prev, 'utf8')) : null;
  const date = opts.date || new Date().toISOString().slice(0, 10);
  const meta = { date, masterVersion, prevDate: prev ? prev.date : '', skippedParts: A.LOOKUP_ONLY_ERAS.map(e => (A.ERA_TABS[e] || {}).items).filter(Boolean) };
  const S = summarize(results, prev, meta);
  if (opts.out) {
    fs.mkdirSync(opts.out, { recursive: true });
    fs.writeFileSync(path.join(opts.out, 'MASTER_AUDIT_' + date + '.md'), md(S));
    fs.writeFileSync(path.join(opts.out, 'MASTER_AUDIT_' + date + '_flags.csv'), flagsCsv(S));
    fs.writeFileSync(path.join(opts.out, 'STATE.json'), JSON.stringify({ date, masterVersion, keys: S.keys, counts: Object.fromEntries(Object.keys(S.perRule).map(k => [k, S.perRule[k].total])) }, null, 1));
  }
  return S;
}

if (require.main === module) {
  const a = process.argv.slice(2);
  const get = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const opts = { out: get('--out'), prev: get('--prev'), fixture: get('--fixture'), date: get('--date'),
                 tabs: get('--tabs') ? get('--tabs').split(',').map(s => s.trim()).filter(Boolean) : null, log: s => console.log('  ' + s) };
  if (!opts.out) { console.log('usage: node tools/master-audit/audit.js --out <dir> [--prev STATE.json] [--tabs "A,B"] [--fixture <dir>] [--date YYYY-MM-DD]'); process.exit(2); }
  run(opts).then(S => {
    console.log('\n' + S.tabs.length + ' tabs, ' + S.tabs.reduce((x, t) => x + t.rowsChecked, 0) + ' rows, ' + S.flags.length + ' flags (' + S.fresh.length + ' new, ' + S.cleared.length + ' cleared) → ' + opts.out);
  }).catch(e => { console.error('FAILED: ' + (e && e.stack || e)); process.exit(1); });
}

module.exports = { loadApp, auditTabs, parseCsv, checkTab, summarize, md, flagsCsv, flagKey, run, RULES, TAB_RULES, ALL_RULES, yearsOf, looksLikeDate, readTab, loadGids, gidMapFromHtml, exportUrl, htmlviewUrl, jsUnescape };
