#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// OWN-ROWS TESTS — v0.9.1796
//
// Brad, shown that a dozen cards still hid owned items behind an unticked era:
// "fix it". And of the era called "23" on his sheet: "figure this out".
//
// THE RULE: What I Collect narrows the catalog SHELF. It has no say over rows
// the user put there himself (owned, wanted, for sale, sold), and no say over
// whether the app has the book it identifies those rows with.
//
// Everything behavioural here is LIFTED from app/, never imitated.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing function ' + name);
  let d = 0; const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}
const code = t => t.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');   // full-line // only (rules_testing)
let pass = 0, fail = 0;
function T(name, got, want) {
  const ok = got === want;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want)));
  ok ? pass++ : fail++;
}

// ── 1. NOTHING in app/ runs the user's own rows through the preference ─────
const files = fs.readdirSync(APP).filter(f => /\.(js|html)$/.test(f));   // the whole directory, never a hand list
T('scan covers the whole app directory', files.length > 40 && files.includes('index.html'), true);
const RX = /_pdEraEnabled|_filterByEraPref/;
const hits = files.filter(f => RX.test(code(read(f))));
T('no file mentions _pdEraEnabled / _filterByEraPref in code', hits.join(','), '');
T('PLANTED: a filter put back is caught', RX.test(code(read('dashboard.js') + '\n  var x = rows.filter(_pdEraEnabled);')), true);
T('PLANTED: a commented-out one is NOT', RX.test(code('  // rows.filter(_pdEraEnabled)')), false);

// ── 2. ticked ∪ owned is what loads; owned-only stays off the shelf ────────
const app = read('app.js'), dat = read('app-data.js');
{
  var REAL_ERA_IDS = ['pw', 'prewar', 'mpc', 'af_gilbert', 'lionel_parts'];
  var LOOKUP_ONLY_ERAS = ['lionel_parts'];
  var ERA_TABS = { pw: { items: 'x' }, prewar: { items: 'x' }, mpc: { items: 'x' }, af_gilbert: { items: 'x' }, lionel_parts: { items: 'x' } };
  var _store = {};
  var localStorage = { getItem: k => (k in _store ? _store[k] : null), setItem: (k, v) => { _store[k] = String(v); } };
  var _ticked = { mpc: 1, af_gilbert: 1 };                       // Brad's state: Modern only
  var _isEraEnabled = e => !!_ticked[e] && LOOKUP_ONLY_ERAS.indexOf(e) < 0;
  var state = { personalData: {
    a: { owned: true, itemNum: '520-P', era: 'pw', masterKey: 'pw|520|1' },
    b: { owned: true, itemNum: '8359', era: 'mpc' },
    c: { owned: false, itemNum: '238', era: 'prewar' },          // not owned → does not count
    d: { owned: true, itemNum: '4C', era: 'Manual' },            // names no catalog
    e: { owned: true, itemNum: '520-30', era: 'lionel_parts' },  // lookup-only never loads for display
  } };
  eval(grab(dat, '_preferEraOf'));
  eval(app.match(/var RR_OWNED_ERAS_KEY = '[^']+';/)[0]);
  eval(grab(app, '_isLoadableEra'));
  eval(grab(app, '_ownedEraKeys'));
  eval(grab(app, '_erasToLoad'));
  eval(grab(app, '_offShelfEras'));
  T('owned eras = pw + mpc only', _ownedEraKeys().join(','), 'mpc,pw');
  T('eras to load = ticked ∪ owned', _erasToLoad(REAL_ERA_IDS).join(','), 'pw,mpc,af_gilbert');
  T('unowned, unticked Pre-War is NOT loaded', _erasToLoad(REAL_ERA_IDS).indexOf('prewar'), -1);
  T('a lookup-only era is never loaded for display', _erasToLoad(REAL_ERA_IDS).indexOf('lionel_parts'), -1);
  T('Postwar is loaded yet OFF the browse shelf', _offShelfEras().has('pw'), true);
  T('a ticked era is ON the shelf', _offShelfEras().has('mpc'), false);
  T('the owned list was remembered for the next cold start', _store[RR_OWNED_ERAS_KEY], '["mpc","pw"]');
  state = { personalData: {} };                                  // cold start: sheet not read yet
  T('cold start uses the remembered list', _erasToLoad(REAL_ERA_IDS).join(','), 'pw,mpc,af_gilbert');
  _store[RR_OWNED_ERAS_KEY] = '{broken';
  T('a corrupt remembered list is survived', _erasToLoad(REAL_ERA_IDS).join(','), 'mpc,af_gilbert');
}
const lam = grab(app, 'loadAllErasMode');
T('startup asks _erasToLoad, not the preference alone', /_erasToLoad\(realEras\)/.test(lam) && !/realEras\.filter\(function\s*\(e\)\s*\{\s*return _isEraEnabled/.test(lam), true);
T('…and re-checks once the personal sheet is in', /await loadPersonalData\(\);[^]{0,300}_ensureOwnedErasLoaded\(\)/.test(lam), true);

// ── 3. browse: four catalog lists honour the shelf; own rows never number-only ─
const br = read('browse.js');
T('browse gates items, sets, catalogs and sheets off-shelf', (code(br).match(/_offShelfEras\(\)/g) || []).length, 4);
T('collection view is never gated (owned → empty set)', /const _offShelf = \(!owned && /.test(br), true);
const bareFM = s => (code(s).match(/findMaster\([^,()]*\)/g) || []).length;
T('browse.js makes NO number-only findMaster call', bareFM(br), 0);
T('PLANTED: a bare findMaster(_baseNum) is caught', bareFM(br + '\nvar z = findMaster(_baseNum);'), 1);

// ── 4. the sheet: the stamp cannot sit inside the body, text stays text ────
const sb = read('sheet-builder.js');
const cell = (sb.match(/const SHEET_FORMAT_STAMP_CELL = 'Dashboard!([A-Z]+)(\d+)'/) || []);
T('the stamp cell is declared once', (sb.match(/const SHEET_FORMAT_STAMP_CELL/g) || []).length, 1);
const bodyRange = (sb.match(/'Dashboard!A5:([A-Z])' \+ \(5 \+ TOTAL - 1\)/) || []);
T('the body range is where this test thinks it is', bodyRange[1], 'H');
const colNum = c => c.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const inBody = (c, r) => colNum(c) <= colNum(bodyRange[1] || 'H') && Number(r) >= 5;
T('the stamp is OUTSIDE the body', inBody(cell[1], cell[2]), false);
T('PLANTED: the old A50 address is inside it', inBody('A', '50'), true);
T('no literal stamp address survives in code', /Dashboard!A50/.test(code(sb)), false);
T('read and write both use the one constant', (code(sb).match(/SHEET_FORMAT_STAMP_CELL/g) || []).length, 3);
T('the body grows to fit what is drawn', /TOTAL = Math\.max\(TOTAL, _need \+ 2\)/.test(sb), true);
eval(grab(sb, '_asText'));
T('"LGB G" is forced to text', _asText('LGB G'), "'LGB G");
T('"1 / 12" can never become January 12th', _asText('1 / 12'), "'1 / 12");
T('a count stays a number', _asText('12'), '12');
T('money stays money', _asText('$28,830'), '$28,830');
T('blank stays blank', _asText(''), '');
T('both columns of a row go through it', /body\[line\]\[tcol\] = _asText\(rw\[0\]\); body\[line\]\[ncol\] = _asText\(rw\[1\]\)/.test(sb), true);

console.log('\n' + (fail ? fail + ' FAILED, ' : '') + pass + ' passed' + (fail ? '' : ' — ALL GREEN'));
process.exit(fail ? 1 : 0);
