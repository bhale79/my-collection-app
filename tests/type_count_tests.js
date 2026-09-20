#!/usr/bin/env node
// TYPE-COUNT + ROW-KEY TESTS — v0.9.1797
// Brad: "when i hit type, i see caboose says 2 next to it but i got 38", and
// "the two 6457 shows pictures but not in the thumbnail".
// Both functions are LIFTED from app/browse.js. findMaster and
// getTypeBucketLabel below are INPUTS to them, not the thing under test: the
// stub bucketer simply returns itemType, and says so here.
const fs = require('fs'), path = require('path');
const br = fs.readFileSync(path.join(__dirname, '..', 'app', 'browse.js'), 'utf8');
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing function ' + name);
  let d = 0; const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + name);
}
let pass = 0, fail = 0;
function T(n, got, want) { const ok = got === want; console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))); ok ? pass++ : fail++; }

var CATALOG = { '6457|pw': { itemType: 'Caboose' }, '6017|pw': { itemType: 'Caboose' }, '8359|mpc': { itemType: 'Diesel' } };
var findMaster = (n, v, prefer) => CATALOG[n + '|' + ((prefer && prefer.era) || '')] || null;   // refuses a number-only call by construction
var getTypeBucketLabel = r => r.itemType || '';
var _isCollectionCompanion = p => !!p._companion;
var _grpFoldActive = () => true;
var state = { personalData: {
  a: { owned: true, itemNum: '6457', variation: '3', era: 'pw', itemType: '' },          // blank stored type — the catalog supplies it
  b: { owned: true, itemNum: '6457', variation: '3', era: 'pw', itemType: '' },
  c: { owned: true, itemNum: '6017', variation: '1', era: 'pw', itemType: 'Boxcar' },    // a STUCK wrong stored type: catalog wins (v0.9.798)
  d: { owned: true, itemNum: '8359', variation: '', era: 'mpc', itemType: 'Diesel' },
  e: { owned: true, itemNum: '4C', variation: '', era: 'Manual', itemType: 'Caboose' },  // manual keeps its own type
  f: { owned: true, itemNum: 'ZZ9', variation: '', era: 'pw', itemType: 'Accessory' },   // off-catalog keeps its own type
  g: { owned: false, itemNum: '6457', variation: '3', era: 'pw', itemType: 'Caboose' },  // not owned
  h: { owned: true, itemNum: '6457-BOX', variation: '', era: 'pw', itemType: 'Box', _companion: true },
} };
eval(grab(br, '_phOwnTypeValues'));
var out = _phOwnTypeValues();
T('blank stored type is counted by its CATALOG type', out.Caboose, 4);          // a, b, c (catalog wins), e (manual)
T('a stuck stored "Boxcar" does not count as a Boxcar', out.Boxcar, undefined);
T('Diesel', out.Diesel, 1);
T('off-catalog row keeps its own type', out.Accessory, 1);
T('a folded box is not a row, so it is not counted', out.Box, undefined);
T('total = the 6 rows the list would show', Object.values(out).reduce((a, b) => a + b, 0), 6);
// PROVE IT CAN FAIL: the old body counted the stored type only.
var OLD = grab(br, '_phOwnTypeValues').replace(/if \(!p\.owned\) return;[^]*?var t = String/, 'var t = String');
T('surgery changed the function', OLD !== grab(br, '_phOwnTypeValues'), true);
var oldOut = (new Function('state', 'getTypeBucketLabel', OLD + '; return _phOwnTypeValues();'))(state, getTypeBucketLabel);
T('PLANTED: the old stored-type count says 2 cabooses', oldOut.Caboose, 2);
T('the lookup passes the owned row — never number-only', /findMaster\(p\.itemNum, p\.variation \|\| '', p\)/.test(grab(br, '_phOwnTypeValues')), true);

eval(grab(br, '_rrRowDomKey'));
var k1 = _rrRowDomKey({ itemNum: '6457', variation: '3', _personalOnly: true, inventoryId: '201' });
var k2 = _rrRowDomKey({ itemNum: '6457', variation: '3', _personalOnly: true, inventoryId: '202' });
T('two personal-only copies get DIFFERENT ids', k1 !== k2, true);
T('catalog copies still keyed by _copyPd', _rrRowDomKey({ itemNum: '8359', variation: '', _copyPd: { inventoryId: '97' } }), '8359--c97');
T('a plain catalog row is unchanged (inventoryId on a non-personal row is ignored)', _rrRowDomKey({ itemNum: '8359', variation: '', inventoryId: '5' }), '8359-');
T('ids stay attribute-safe', /^[A-Za-z0-9_-]+$/.test(_rrRowDomKey({ itemNum: '"Add Up" x', variation: '', _personalOnly: true, inventoryId: 'a"b' })), true);
var OLDKEY = grab(br, '_rrRowDomKey').replace("|| (item && item._personalOnly && item.inventoryId) || ''", "|| ''");
var oldKey = (new Function(OLDKEY + '; return _rrRowDomKey;'))();
T('PLANTED: without the fallback the two copies collide', oldKey({ itemNum: '6457', variation: '3', _personalOnly: true, inventoryId: '201' }) === oldKey({ itemNum: '6457', variation: '3', _personalOnly: true, inventoryId: '202' }), true);

console.log('\n' + (fail ? fail + ' FAILED, ' : '') + pass + ' passed' + (fail ? '' : ' — ALL GREEN'));
process.exit(fail ? 1 : 0);
