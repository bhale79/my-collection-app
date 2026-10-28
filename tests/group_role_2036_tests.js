// ═══════════════════════════════════════════════════════════════
// group_role_2036_tests.js — v0.9.2036.
//
// Lars (2026-10-28): "Seeing same Engine vs Set issue on these: ENGINE — 6-21787
// Blue Comet set … ENGINE — 6-31705 50th ANNIVERSARY set". Both rows are typed
// Passenger Set in the master and the app buckets them as Set — the word came
// from the GROUP STRIP on the item page: rrGroupRole named the lead piece of
// any group "Engine" unless it was a tender, unit, box or sheet. Now the lead
// piece is named by what it IS: a locomotive bucket (RR_GROUP_ENGINE_BUCKETS,
// config.js) says Engine; a set says Set; a car says its kind; no bucket says
// Item. The pieces keep their words, and ONE rank helper (rrGroupRank) orders
// a group: any lead piece first, then dummy A, B unit, tender, sheet, box, carton.
//
// The real rrGroupRole / rrGroupRank are lifted out of app-collection.js and
// run with a stand-in _ownedBucketOf and isTender. Section P plants each old
// habit back and the matching check must go red.
// Run:  node tests/group_role_2036_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const COLL = APP('app-collection.js'), CONFIG = APP('config.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const code = src => src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return '';
}
function constOf(src, name, end) {
  const i = src.indexOf(name + ' =');
  if (i < 0) return '';
  const j = src.indexOf(end, i);
  return src.slice(src.lastIndexOf('\n', i) + 1, j + end.length);
}
function lift(coll, cfg, buckets) {
  const body = constOf(cfg, 'const RR_GROUP_ENGINE_BUCKETS', '};') + '\n' + constOf(coll, 'var RR_GROUP_RANK', '};') + '\n'
    + grab(coll, 'rrGroupRole') + '\n' + grab(coll, 'rrGroupRank') + '\n'
    + 'return { role: rrGroupRole, rank: typeof rrGroupRank === "function" ? rrGroupRank : null, engines: typeof RR_GROUP_ENGINE_BUCKETS !== "undefined" ? RR_GROUP_ENGINE_BUCKETS : null };';
  const isTender = n => /^2046W$|W$/.test(String(n));
  const _ownedBucketOf = p => (buckets[String(p && p.itemNum)] !== undefined ? buckets[String(p.itemNum)] : '');
  return new Function('isTender', '_ownedBucketOf', body)(isTender, _ownedBucketOf);
}
const BUCKETS = { '6-21787': 'Set', '6-31705': 'Set', '6464-100': 'Boxcar', '6357': 'Caboose', '2046': 'Steam Locomotive', '2343-P': 'Diesel Locomotive', '2343-D': 'Diesel Locomotive', '2343C': 'Diesel Locomotive', '3927': 'Motorized Unit', 'GG1-2332': 'Electric Locomotive', 'TYPED-1': '' };
const P = n => ({ itemNum: n });

function run(coll, cfg) {
  const r = {};
  let api; try { api = lift(coll, cfg, BUCKETS); } catch (e) { r.err = String(e); return r; }
  const role = api.role;
  r.setIsSet = role(P('6-21787')) === 'Set' && role(P('6-31705')) === 'Set';
  r.carIsKind = role(P('6464-100')) === 'Boxcar' && role(P('6357')) === 'Caboose';
  r.locoIsEngine = role(P('2046')) === 'Engine' && role(P('GG1-2332')) === 'Engine' && role(P('3927')) === 'Engine';
  r.noBucketItem = role(P('TYPED-1')) === 'Item';
  r.piecesKept = role(P('6-21787-BOX')) === 'Box' && role(P('6-21787-MBOX')) === 'Master Carton' && role(P('6-21787-IS')) === 'Instruction Sheet'
    && role(P('2046W')) === 'Tender' && role(P('2343-P')) === 'Powered A Unit' && role(P('2343-D')) === 'Dummy A Unit' && role(P('2343C')) === 'B Unit';
  r.rankFn = typeof api.rank === 'function';
  const order = ['6-21787-BOX', '6-21787-IS', '6-21787', '6-21787-MBOX'].map(P).sort((a, b) => (api.rank ? api.rank(role(a)) - api.rank(role(b)) : 0)).map(p => p.itemNum);
  r.setFirst = r.rankFn && order[0] === '6-21787' && order[3] === '6-21787-MBOX';
  const order2 = ['2343C', '2343-D', '2343-P', '6464-100'].map(P).sort((a, b) => (api.rank ? api.rank(role(a)) - api.rank(role(b)) : 0)).map(p => p.itemNum);
  r.leadFirst = r.rankFn && order2.indexOf('2343C') === 3 && order2.indexOf('2343-D') === 2;
  r.enginesOne = !!api.engines && Object.keys(api.engines).length >= 4 && api.engines['Steam Locomotive'] === 1;
  const c = code(coll);
  r.noDefaultEngine = !/return 'Engine';\s*\n\}/.test(c.slice(c.indexOf('function rrGroupRole('), c.indexOf('function rrGroupRole(') + 1200));
  r.sortsUseHelper = (c.match(/rrGroupRank\(/g) || []).length >= 5 && !/RR_GROUP_RANK\[(rrGroupRole|_grpRole)\(/.test(c) && !/=== undefined \? 9/.test(c);
  r.bucketsInConfig = /const RR_GROUP_ENGINE_BUCKETS/.test(cfg) && !/RR_GROUP_ENGINE_BUCKETS\s*=\s*\{/.test(c);
  // the strip draws the role through rrTypeWord(role) — a Set reads "Set"
  r.stripDrawsRole = /rrTypeWord\(role\)/.test(c);
  return r;
}

section('A — the lead piece is named by what it is');
const A = run(COLL, CONFIG);
ok('A1 rrGroupRole + rrGroupRank lift and run', !A.err, A.err);
ok('A2 a set says Set (6-21787, 6-31705 — Lars)', A.setIsSet);
ok('A3 a car says its kind (Boxcar, Caboose)', A.carIsKind);
ok('A4 a locomotive says Engine (steam, electric, motorized unit)', A.locoIsEngine);
ok('A5 an item with no bucket says Item', A.noBucketItem);
ok('A6 the pieces keep their words (Box, Master Carton, Instruction Sheet, Tender, A units, B unit)', A.piecesKept);
ok('A7 the engine kinds are ONE list in config.js', A.enginesOne && A.bucketsInConfig);

section('B — the group order');
ok('B1 rrGroupRank exists', A.rankFn);
ok('B2 a set sorts first, its box / sheet / carton after', A.setFirst);
ok('B3 the lead (powered A) sorts before dummy A and B unit', A.leadFirst);
ok('B4 both sorts go through rrGroupRank, no "undefined → 9" left', A.sortsUseHelper);
ok('B5 no bare "return Engine" default remains', A.noDefaultEngine);
ok('B6 the strip draws the role word', A.stripDrawsRole);

section('P — planted offenders (each must go red)');
const P1 = run(COLL.replace("return b || 'Item';", "return 'Engine';"), CONFIG);
ok('P1 the old "everything is an Engine" default → A2/A3 red', !P1.err && !P1.setIsSet && !P1.carIsKind);
const P2 = run(COLL, CONFIG.replace("{ 'Steam Locomotive': 1, 'Diesel Locomotive': 1, 'Electric Locomotive': 1, 'Motorized Unit': 1 }", "{ 'Steam Locomotive': 1 }"));
ok('P2 an engine kind dropped from the list → A4 red', !P2.err && !P2.locoIsEngine);
const P3 = run(COLL.replace("return r === undefined ? 0 : r;", "return r === undefined ? 9 : r;"), CONFIG);
ok('P3 an unknown role sorted LAST again → B2 red (the set would sink below its box)', !P3.err && !P3.setFirst);
const P4 = run(COLL.replace("return rrGroupRank(_grpRole(a.p)) - rrGroupRank(_grpRole(b.p));", "var ra = RR_GROUP_RANK[_grpRole(a.p)], rb = RR_GROUP_RANK[_grpRole(b.p)]; return (ra === undefined ? 9 : ra) - (rb === undefined ? 9 : rb);"), CONFIG);
ok('P4 a sort with its own rank arithmetic again → B4 red', !P4.err && !P4.sortsUseHelper);
const P5 = run(COLL.replace("if (/-D$/.test(n)) return 'Dummy A Unit';", "if (/-D$/.test(n)) return 'Engine';"), CONFIG);
ok('P5 a piece word lost → A6 red', !P5.err && !P5.piecesKept);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
