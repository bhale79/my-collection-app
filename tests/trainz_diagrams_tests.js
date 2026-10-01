// ═══════════════════════════════════════════════════════════════
// trainz_diagrams_tests.js — v0.9.1855.
//
// [stated] Brad, 2026-10-01: "the trainz diagram went to …/lionel-gp-7-gp-9-
// rectifier-explode-view-parts-diagram which says diagram not found, but if i
// google it, i can find … /lionel-2028-2328-2337-2338-2339-2346-2348-2329-
// parts-list-and-exploded-view-parts-diagram. somehow i need to verify all
// the links for the diagrams for trainz.com."
//
// The table (app/trainz-diagrams-config.js) was copied from Trainz's feed on
// 2026-09-02; Trainz renamed 76 of those 648 pages since. Now the table is
// REBUILT from the feed by tools/trainz-diagrams/refresh.py, which also opens
// every page and refuses on "Diagram not found" — and this suite holds the
// table to the harvest file that was pulled, so nobody edits one without the
// other.
//
// THE RULES THIS SUITE PROTECTS:
//   1. The config's handles == the newest harvest's LIVE handles, one entry
//      each, in the feed's order — and every harvest row was CHECKED (opened)
//      the day it was pulled. (A hand edit, a stale config, an unchecked
//      harvest, a dead page shipped → red.)
//   2. The number rule, re-done here from the tool's wording, gives the
//      config's n for EVERY entry — so the rule in the tool and the rule
//      the app relies on cannot drift.
//   3. Brad's 2338 reaches the page Trainz has today; no entry carries the
//      dead rectifier handle.
//   4. The matcher (_tzDiagram, maintenance.js) still finds 2338, 2343C→2343,
//      18860↔618860, a transformer by its letters (ZW), and nothing for a
//      number no title holds.
// Run:  node tests/trainz_diagrams_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const ROOT = path.join(__dirname, '..');
const cfgSrc = fs.readFileSync(path.join(ROOT, 'app', 'trainz-diagrams-config.js'), 'utf8');
const maint = fs.readFileSync(path.join(ROOT, 'app', 'maintenance.js'), 'utf8');
const harvests = fs.readdirSync(path.join(ROOT, 'harvests')).filter(f => /^trainz-diagrams-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
const newest = harvests[harvests.length - 1];
const harvest = newest ? JSON.parse(fs.readFileSync(path.join(ROOT, 'harvests', newest), 'utf8')) : [];
const feed = harvest.filter(d => !d.dead);   // what the config may hold

// the config, run for real
function loadConfig(src) {
  const w = {};
  new Function('window', src)(w);
  return w.TRAINZ_DIAGRAMS || [];
}
const cfg = loadConfig(cfgSrc);

// the tool's number rule, in JS
function numbersOf(title) {
  const out = [];
  const xf = /transformer/i.test(title || '');
  String(title || '').split(/[\s,/]+/).forEach(tok => {
    const t = tok.replace(/^[.,;:()]+|[.,;:()]+$/g, '');
    if (!t || /\d\.\d/.test(t)) return;
    if (/^\d{1,2}-\d{1,2}-\d{1,2}(-\d{1,2})?$/.test(t)) return;
    const a = t.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const digits = (a.match(/\d/g) || []).length;
    const keep = (/^\d[A-Z0-9]*$/.test(a) && digits >= 2) || /^[A-Z]+\d{2,}[A-Z0-9]*$/.test(a) || (xf && /^[A-Z]{2}$/.test(a));
    if (keep && out.indexOf(a) < 0) out.push(a);
  });
  return out;
}

section('A · the config is the harvest');
ok('a harvest file exists (harvests/trainz-diagrams-<date>.json)', !!newest, harvests.join(', '));
ok('the harvest holds more diagrams than the Sept-2 copy (648)', harvest.length > 648, String(harvest.length));
ok('every harvest row was CHECKED (opened on trainz.com) — an unchecked harvest never ships', harvest.length > 0 && harvest.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.checked || '')));
ok('a page the check found dead is NOT in the config (2026-10-01: 6-19742, in Trainz\'s own feed)', harvest.some(d => d.dead) && !cfg.some(e => harvest.some(d => d.dead && d.handle === e.h)));
ok('the config has one entry per harvest row, same order',
   cfg.length === feed.length && cfg.every((e, i) => e.h === feed[i].handle),
   cfg.length + ' vs ' + feed.length);
ok('no handle twice', new Set(cfg.map(e => e.h)).size === cfg.length);
ok('every handle is a page slug (lowercase letters, digits, dashes)', cfg.every(e => /^[a-z0-9-]+$/.test(e.h)));
ok('the config says when it was pulled', /TRAINZ_DIAGRAMS_PULLED = '\d{4}-\d{2}-\d{2}'/.test(cfgSrc) && newest.indexOf(cfgSrc.match(/TRAINZ_DIAGRAMS_PULLED = '(\d{4}-\d{2}-\d{2})'/)[1]) > 0);

section('B · the number rule');
const mism = cfg.filter((e, i) => e.n !== numbersOf(feed[i].diagramTitle).join('|'));
ok('every entry\'s numbers are what the rule reads off its title', mism.length === 0, mism.slice(0, 3).map(e => e.t + ' → ' + e.n).join(' | '));
ok('rule: 6-18860 reads as 618860; 392T, 6918009T01 kept', numbersOf('Lionel MPC 6-18860 and 392T 6918009T01 Tender').join('|') === '618860|392T|6918009T01');
ok('rule: wheel arrangements and model names are not numbers', numbersOf('Lionel 675 2-6-4 K-4 F-3 NW-2 GG-1 Steam').join('|') === '675');
ok('rule: a version number (Railsounds 2.0) and "w/2" are not numbers', numbersOf('Lionel 6-18129 F-3B with Railsounds 2.0 w/2 AC Motors').join('|') === '618129');
ok('rule: GP20, O27, WS-85, SD40-2 are numbers', numbersOf('Lionel GP20 O27 WS-85 SD40-2').join('|') === 'GP20|O27|WS85|SD402');
ok('rule: a transformer\'s letters are its number (ZW), elsewhere two letters are words', numbersOf('Lionel VW & ZW Transformer').join('|') === 'VW|ZW' && numbersOf('Lionel AC Motor GP').join('|') === '');

section('C · Brad\'s 2338');
const e2338 = cfg.find(e => e.n.split('|').indexOf('2338') >= 0);
ok('2338 is on the GP-7 line', !!e2338 && /2028\|2328\|2337\|2338\|2339/.test(e2338.n), e2338 && e2338.n);
ok('…and that line carries the page Trainz has today', !!e2338 && e2338.h === 'lionel-2028-2328-2337-2338-2339-2346-2348-2329-parts-list-and-exploded-view-parts-diagram', e2338 && e2338.h);
ok('the dead rectifier handle is gone', !cfg.some(e => e.h === 'lionel-gp-7-gp-9-rectifier-explode-view-parts-diagram'));

section('D · the matcher');
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + name);
}
const tz = new Function('window', 'var _tzLookup = null;\n' + grab(maint, '_tzDiagram') + '\nreturn _tzDiagram;')({ TRAINZ_DIAGRAMS: cfg });
const hit = n => { const e = tz({ itemNum: n }); return e ? e.h : null; };
ok('2338 → the GP-7 page', hit('2338') === e2338.h);
ok('2343C → 2343\'s page (the suffix falls away)', hit('2343C') && /2343/.test(hit('2343C')));
ok('18860 and 6-18860 reach the same page', hit('18860') && hit('18860') === hit('6-18860'));
ok('ZW → the transformer page', hit('ZW') && /zw/.test(hit('ZW')), hit('ZW'));
ok('a number no title holds → nothing', hit('99999999') === null);

section('E · planted offenders are caught');
ok('E1 a hand-added entry (not in the harvest) is caught', (() => { const c = cfg.concat([{ n: '1', t: 'x', h: 'hand-made' }]); return !(c.length === feed.length && c.every((e, i) => e.h === feed[i].handle)); })());
ok('E2 a handle edited by hand is caught', (() => { const c = cfg.map((e, i) => i === 5 ? { n: e.n, t: e.t, h: e.h + '-x' } : e); return !c.every((e, i) => e.h === feed[i].handle); })());
ok('E3 a number typed in by hand is caught by the rule', (() => { const c = cfg.map((e, i) => i === 5 ? { n: e.n + '|12345', t: e.t, h: e.h } : e); return c.some((e, i) => e.n !== numbersOf(feed[i].diagramTitle).join('|')); })());
ok('E5 a dead page put back in the config is caught', (() => { const d = harvest.find(x => x.dead); const c = cfg.concat([{ n: '1', t: 'x', h: d.handle }]); return c.some(e => harvest.some(x => x.dead && x.handle === e.h)); })());
ok('E6 a harvest row with no check date is caught', !harvest.concat([{ handle: 'x', diagramTitle: 'x' }]).every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.checked || '')));
ok('E4 the Sept-2 rectifier handle put back is caught', cfg.concat([{ n: '2338', t: 'x', h: 'lionel-gp-7-gp-9-rectifier-explode-view-parts-diagram' }]).some(e => e.h === 'lionel-gp-7-gp-9-rectifier-explode-view-parts-diagram'));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
