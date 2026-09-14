// ═══════════════════════════════════════════════════════════════
// stock_photo_rules_tests.js — v0.9.1745.
//
// Brad, 2026-09-14: "what about mth trains now" — after Atlas got its
// Image URL column, the other big maker with a predictable picture address.
//
// Measured live from the cloud before this shipped: 287 of 300 random MTH
// items (O / HO / G / S / Tinplate) load at
//   https://d2frr7198pxftr.cloudfront.net/production/public/product_images/<itemNum>.jpg
// and the 13 misses have no product picture on mthtrains.com either. So MTH
// is a URL RULE like Lionel, not a harvested column like Atlas.
//
// This suite lifts the real STOCK object and the real _candidates() from
// app/stock-photos.js and pins:
//   - the Lionel rule is byte-for-byte what v1600 measured (unchanged),
//   - the MTH rule builds exactly the measured address shape,
//   - which era keys each rule fires for (and which it never does),
//   - the candidate ORDER: free rule first, catalog Image URL second, no dupes.
// Run:  node tests/stock_photo_rules_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'stock-photos.js'), 'utf8');
const cfg = fs.readFileSync(path.join(__dirname, '..', 'app', 'config.js'), 'utf8');
const tools = fs.readFileSync(path.join(__dirname, '..', 'app', 'tools.js'), 'utf8');

// lift STOCK = {...};
const si = src.indexOf('var STOCK = {');
let d = 0, sj = -1;
for (let k = src.indexOf('{', si); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) { sj = k; break; } } }
const STOCK = new Function('return ' + src.slice(si + 'var STOCK = '.length, sj + 1))();
ok('STOCK lifts out of the source with both rules', STOCK && typeof STOCK.lionelStore === 'function' && typeof STOCK.mthStore === 'function');

// lift _candidates in a scope where _era and _master are ours
function grab(sig) {
  const i = src.indexOf(sig); if (i < 0) return '';
  let dd = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') dd++; else if (src[k] === '}') { dd--; if (!dd) return src.slice(i, k + 1); } }
  return '';
}
const candSrc = grab('function _candidates(pd)');
ok('_candidates lifts out of the source', candSrc.length > 100);
function makeCandidates(eraOf, masterOf) {
  return new Function('STOCK', '_era', '_master', candSrc + '\nreturn _candidates;')(STOCK, eraOf, masterOf);
}

section('The Lionel rule is unchanged');
ok('6-84631 → 684631-01.jpg', STOCK.lionelStore('6-84631') === 'https://www.lionelstore.com/LionelStore-Product-Images/684631-01.jpg', STOCK.lionelStore('6-84631'));
ok('bare 84631 gets its 6 back', STOCK.lionelStore('84631') === 'https://www.lionelstore.com/LionelStore-Product-Images/684631-01.jpg');
ok('2333118 (7 digits) stays as is', STOCK.lionelStore('2333118') === 'https://www.lionelstore.com/LionelStore-Product-Images/2333118-01.jpg');
ok('empty → empty', STOCK.lionelStore('') === '' && STOCK.lionelStore(null) === '');
ok('Lionel eras are exactly mpc / mod_ho / mod_s', Object.keys(STOCK.lionelEras).sort().join(',') === 'mod_ho,mod_s,mpc');

section('The MTH rule builds the measured address');
const MTH = 'https://d2frr7198pxftr.cloudfront.net/production/public/product_images/';
ok('30-1185-1 → 30-1185-1.jpg', STOCK.mthStore('30-1185-1') === MTH + '30-1185-1.jpg', STOCK.mthStore('30-1185-1'));
ok('80-2181-1 (HO) → 80-2181-1.jpg', STOCK.mthStore('80-2181-1') === MTH + '80-2181-1.jpg');
ok('10-1299-1 (Tinplate) → 10-1299-1.jpg', STOCK.mthStore('10-1299-1') === MTH + '10-1299-1.jpg');
ok('20-3045-1 (Premier) → 20-3045-1.jpg', STOCK.mthStore('20-3045-1') === MTH + '20-3045-1.jpg');
ok('dashes are KEPT (MTH prints them; the store URL uses them)', STOCK.mthStore('30-1185-1').indexOf('30-1185-1') > 0);
ok('surrounding whitespace is trimmed', STOCK.mthStore('  30-1185-1 ') === MTH + '30-1185-1.jpg');
ok('a stray space inside is encoded, not dropped', STOCK.mthStore('30 1185') === MTH + '30%201185.jpg');
ok('empty / null → empty (nothing to probe)', STOCK.mthStore('') === '' && STOCK.mthStore(null) === '' && STOCK.mthStore(undefined) === '');
ok('MTH eras are the five MTH tabs', Object.keys(STOCK.mthEras).sort().join(',') === 'mth_g,mth_ho,mth_o,mth_s,mth_tinplate');
for (const k of Object.keys(STOCK.mthEras)) ok('era key ' + k + ' exists in config.js', new RegExp('\\b' + k + '\\b').test(cfg));
ok('no era is in both rule tables', !Object.keys(STOCK.mthEras).some(k => STOCK.lionelEras[k]));

section('Candidate order: free rule first, catalog Image URL second, no duplicates');
const master = { imageUrl: 'https://archive.example/pic.jpg' };
let cand = makeCandidates(() => 'mth_o', () => master);
let c = cand({ itemNum: '30-1185-1' });
ok('an MTH O item: rule URL then the catalog URL', c.length === 2 && c[0] === MTH + '30-1185-1.jpg' && c[1] === master.imageUrl, JSON.stringify(c));
cand = makeCandidates(() => 'mth_ho', () => null);
c = cand({ itemNum: '80-2181-1' });
ok('an MTH HO item with no catalog row: the rule alone', c.length === 1 && c[0] === MTH + '80-2181-1.jpg', JSON.stringify(c));
cand = makeCandidates(() => 'mpc', () => null);
c = cand({ itemNum: '6-84631' });
ok('a modern Lionel item still gets ONLY the Lionel rule (no MTH address)', c.length === 1 && /lionelstore/.test(c[0]) && !/cloudfront/.test(c[0]), JSON.stringify(c));
cand = makeCandidates(() => 'atlas', () => ({ imageUrl: 'https://archive.atlasrr.com/Images/OLocos/0280/30138308.jpg' }));
c = cand({ itemNum: '30138308' });
ok('an Atlas item gets ONLY its harvested Image URL (no rule fires)', c.length === 1 && /archive\.atlasrr\.com/.test(c[0]), JSON.stringify(c));
cand = makeCandidates(() => 'pw', () => null);
ok('a postwar Lionel item with no catalog picture: nothing to try', cand({ itemNum: '2343' }).length === 0);
cand = makeCandidates(() => 'mth_o', () => ({ imageUrl: MTH + '30-1185-1.jpg' }));
c = cand({ itemNum: '30-1185-1' });
ok('a catalog Image URL equal to the rule is not listed twice', c.length === 1, JSON.stringify(c));
cand = makeCandidates(() => 'mth_o', () => ({ imageUrl: 'not a url' }));
ok('a catalog Image URL that is not http(s) is ignored', cand({ itemNum: '30-1185-1' }).length === 1);
cand = makeCandidates(() => null, () => null);
ok('no era, no master → nothing', cand({ itemNum: '30-1185-1' }).length === 0);

section('The Tools card tells the truth about coverage');
ok('the card says Lionel, MTH and Atlas', /Modern Lionel, MTH and Atlas today; other makers as their catalogs are crawled\./.test(tools));
ok('the old "Modern Lionel today" wording is gone', !/Modern Lionel today;/.test(tools));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
