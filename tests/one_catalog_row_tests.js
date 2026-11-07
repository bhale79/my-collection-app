#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// ONE CATALOG ROW — 2026-11-07 (onerow)
//
// [stated] Brad, from the hand-test of 2026-11-07: his postwar 2338 Milwaukee
// Road GP-7 had NO "Trainz diagram" button. His copy was tied to the Nabisco
// cereal-promo row that shares the number (Promotional, Var 1, in front of the
// engine) — Promotional → Accessory, and an accessory never matches a diesel
// drawing. "Propose the root fix: ONE place that decides 'which catalog row is
// this item', used by everything, plus a test that uses my 2338 and proves it
// fails on a planted offender." → "yes" (2026-11-07 08:14 CT).
//
// Everything here runs the REAL code lifted from app/ against REAL master rows
// read 2026-11-07 (tests/fixtures/onerow_rows_2026-11-07.json):
//   A  the ONE rule: rrRowKind (app-data.js) + its words (config.js)
//   B  findMaster never lets a promo / paper / box / part row win on its own
//      — Brad's 2338, the 6427 box trap, the 58 "Postwar" era word, 3424-75;
//      the owner of the promo / box still gets it (the v0.9.1731 rule)
//   C  THE copy type: the catalog row's type wins (Brad's 58 said "Accessory")
//   D  the Trainz button: 2338 gets the GP-7 sheet; postwar 6427 only the
//      Porthole; the page-name table; the live check accepts `m`; the label
//   E  Dashboard "Value by type" names the type (it said "Other" for all)
//   F  the LCCA button is gone; the darker backdrop is ONE setting
//   P  planted offenders — the lookup, the key guard, the era cleaner, the box-owner
//      rule, the word list, the dashboard, the shelf label, the LCCA removal, the
//      Trainz table and matcher, the label and the one-list scan each fail on the
//      code they replaced (C1–C5 document the rule; C7 is its planted proof)
// ═════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const { rowKindSource, grabFn } = require('./lib/row-kind');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail).slice(0, 400) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function plant(src, a, b) { if (src.indexOf(a) < 0) throw new Error('plant target not found: ' + a.slice(0, 90)); return src.replace(a, b); }
function grabObj(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('not found: ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1).replace(/^const /, 'var ') + ';'; } }
  throw new Error('unbalanced: ' + sig);
}

const CFG = read('config.js'), DAT = read('app-data.js'), APPJS = read('app.js'), MAINT = read('maintenance.js'), DASH = read('dashboard.js');
const ROWS = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'onerow_rows_2026-11-07.json'), 'utf8')).rows;
const rowsOf = (n, tab) => ROWS.filter(r => r.itemNum === n && (!tab || r._tab === tab));

// ── a world holding the REAL findMaster and everything it calls ──────────
const FM_FUNCS = ['rrMasterKeyOf', 'rrMasterByKey', 'rrMasterRowIdOf', '_rrIndexByRowId', 'rrMasterByRowId', '_rrRowIdFits',
  'findMaster', '_preferEraOf', '_rrRealRowsOf', '_findMasterCore', '_mIsMotive', '_mSuffix', '_letterKinRows', '_zeroKinRows',
  'rrCopyRow', 'rrCopyTypeWord', 'rrCopyBucket'];
function world(datSrc, cfgSrc, order) {
  const d = datSrc || DAT, c = cfgSrc || CFG;
  const ctx = { console: { log() {}, warn() {} }, Map, WeakMap };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('type-groups.js'), ctx);
  vm.runInContext(grabObj(c, 'const ERAS = {') + '\n' + grabObj(c, 'const ERA_TABS = {'), ctx);
  vm.runInContext(rowKindSource(c, d), ctx);
  vm.runInContext('var _lkCache = new WeakMap(), _zkCache = new WeakMap();\n'
    + grabFn(APPJS, 'rrNumZeroKey') + '\n' + grabFn(APPJS, 'rrNumZeroTwin') + '\n'
    + 'function baseItemNum(n) { return String(n || "").replace(/-?[PDTC]$/i, ""); }\n'
    + FM_FUNCS.map(n => grabFn(d, n)).join('\n'), ctx);
  const all = ROWS.map(r => Object.assign({}, r));
  if (order === 'prewar-first') all.sort((a, b) => (a._era === 'prewar' ? 0 : 1) - (b._era === 'prewar' ? 0 : 1));
  const idx = new Map();
  all.forEach(r => { const k = r.itemNum; if (!idx.has(k)) idx.set(k, []); idx.get(k).push(r); });
  ctx.state = { masterData: all, masterByItem: idx, masterByItemAll: null };
  ctx.state.masterByRowId = ctx._rrIndexByRowId(all);
  return ctx;
}
const W = world();
const fm = (n, v, p, w) => (w || W).findMaster(n, v, p);
const desc = m => m ? (m._tab + ' · ' + m.itemType + ' · v' + (m.variation || '-') + ' · ' + m.description) : 'null';

section('A · the ONE rule — rrRowKind');
{
  const K = t => W.rrRowKind({ itemType: t });
  ok('A1 Promotional / Paper / Box / Paper / Box / Misc / Catalog / Sales Material / Memorabilia / Ephemera / Manual → paper',
    ['Promotional', 'Paper', 'Box', 'Paper / Box / Misc', 'Catalog', 'Sales Material', 'Memorabilia', 'Ephemera', 'Manual', 'Magazine', 'Record', 'Certificate', 'Newsletter', 'Instruction Sheet', 'Display Case'].every(t => K(t) === 'paper'));
  ok('A2 Packet / Separate Sale / Part → part', ['Packet', 'Separate Sale', 'Part'].every(t => K(t) === 'part'));
  ok('A3 Set / Diesel Set / Car Set → set', ['Set', 'Diesel Set', 'Car Set'].every(t => K(t) === 'set'));
  ok('A4 the things themselves stay items — incl. the MPC "Instruction Car", a Boxcar, a Party Car',
    ['Instruction Car', 'Boxcar', 'Party Car', 'Diesel Locomotive', 'Motorized Unit', 'Caboose', 'Accessory', 'Billboard', 'Tools & Supplies'].every(t => K(t) === 'item'),
    ['Instruction Car', 'Boxcar', 'Party Car'].map(t => t + '=' + K(t)));
  ok('A5 a row on a Boxes / Paper / Parts tab is not the item, whatever its type says',
    W.rrRowKind({ itemType: 'Accessory', _tab: 'Lionel PW - Boxes' }) === 'paper' && W.rrRowKind({ itemType: 'Accessory', _tab: 'Lionel Parts' }) === 'part');
  const real = rowsOf('6-36834')[0];
  ok('A6 the real MPC 6-36834 row (Instruction Car) is an item', real && W.rrRowKind(real) === 'item', real);
  ok('A7 rrDemotedRow (the Photo Inbox and My Collection) = rrRowKind not item, sets included',
    W.rrDemotedRow({ itemType: 'Set' }) && W.rrDemotedRow({ itemType: 'Promotional' }) && !W.rrDemotedRow({ itemType: 'Boxcar' }));
}

section('B · findMaster — Brad\'s 2338 and the other traps (real rows)');
{
  const promo = rowsOf('2338', 'Lionel PW - Items').find(r => r.itemType === 'Promotional');
  ok('B0 the fixture holds the Nabisco promo as Var 1 in front of the engines', promo && promo.variation === '1' && rowsOf('2338', 'Lionel PW - Items').indexOf(promo) === 0);
  // how a set member is saved (wizard-save.js): findMaster(num, '', prefer) and era written "Postwar"
  let m = fm('2338', '', { era: 'Postwar', manufacturer: 'Lionel' });
  ok('B1 2338 saved as a set member (era "Postwar", no variation) → the GP-7, never the promo', m && m.itemType === 'Diesel Locomotive', desc(m));
  m = fm('2338', '', null);
  ok('B2 2338 with no hint at all → the GP-7', m && m.itemType === 'Diesel Locomotive', desc(m));
  m = fm('2338', '', { masterKey: 'pw|2338|', era: 'pw' });
  ok('B3 a stored key with a BLANK variation → the GP-7', m && m.itemType === 'Diesel Locomotive', desc(m));
  m = fm('2338', '', { era: 'pw', itemType: 'Promotional', masterKey: 'pw|2338|1' });
  ok('B4 the OWNER of the promo sheet (own type Promotional) keeps the promo', m && m.itemType === 'Promotional', desc(m));
  m = fm('2338', '', { era: 'pw', masterRowId: promo.rowId, masterKey: 'pw|2338|1' });
  ok('B5 a saved Row ID still answers exactly (Brad\'s own copy needs its link changed — a data fix, on his yes)', m && m.rowId === promo.rowId, desc(m));
  m = fm('2338', '3', { era: 'pw' });
  ok('B6 a variation the copy NAMES still answers (Var 3 = the GP-7 Var 3)', m && m.variation === '3' && m.itemType === 'Diesel Locomotive', desc(m));
  // 6427: the only blank-variation row is the BOX (772 postwar numbers are like this)
  m = fm('6427', '', { masterKey: 'pw|6427|', era: 'pw' });
  ok('B7 6427 with key "pw|6427|" → the Porthole caboose, not the empty box', m && m.itemType === 'Caboose' && m._tab === 'Lionel PW - Items', desc(m));
  m = fm('6427', '', { masterKey: 'pw|6427|', era: 'pw', itemType: 'Box' });
  ok('B8 …the owner of the 6427 BOX still gets the box', m && m._tab === 'Lionel PW - Boxes', desc(m));
  // 58: era written "Postwar" must weigh like pw (the prewar 58 is sixteen lamp posts)
  // the prewar 58 (sixteen Lamp Posts) loaded FIRST — ERA_TABS order — so only the era word can pick the plow
  const WP = world(DAT, CFG, 'prewar-first');
  ok('B9-0 (the prewar-first world really puts a prewar 58 first)', WP.state.masterByItem.get('58')[0]._era === 'prewar');
  m = fm('58', '', { era: 'Postwar', manufacturer: 'Lionel' }, WP);
  ok('B9 58 with era "Postwar" (prewar loaded first) → the postwar Rotary Snow Plow, not a prewar Lamp Post', m && m.itemType === 'Motorized Unit', desc(m));
  m = fm('58', '', { era: 'Lionel Postwar' }, WP);
  ok('B10 58 with the era written as its label, "Lionel Postwar" → the snow plow too', m && m.itemType === 'Motorized Unit', desc(m));
  // the independent review's two cases (2026-11-07): the swap never leaves the number or the catalog
  m = fm('77', '', { era: 'pw' }, WP);
  ok('B13 postwar 77 (prewar loaded first) → a POSTWAR row, never the prewar 77', m && m._era === 'pw', desc(m));
  m = fm('77', '', { era: 'Postwar' }, WP);
  ok('B13b …the same with era "Postwar" — the Science Set, not the dealer display', m && m._era === 'pw' && m.itemType === 'Science Set', desc(m));
  m = fm('3462P', '', { era: 'pw' });
  ok('B14 3462P → the exact 3462P row, never the 3462 milk car (a different number)', m && m.itemNum === '3462P' && m._era === 'pw', desc(m));
  m = fm('3462P', '', null);
  ok('B14b 3462P with no hint → still a 3462P row', m && m.itemNum === '3462P', desc(m));
  m = fm('3424-75', '', { era: 'pw' });
  ok('B11 3424-75 → the signal, not the "Separate Sale" replacement part that sits in front', m && m.itemType !== 'Separate Sale', desc(m));
  // nothing real answers → the paper row is still found (never "no row")
  const w2 = world(); w2.state.masterByItem = new Map([['2338', [Object.assign({}, promo)]]]);
  m = fm('2338', '', { era: 'pw' }, w2);
  ok('B12 a promo row still answers when it is the only row there is', m && m.itemType === 'Promotional', desc(m));
}

section('C · THE copy type — the catalog row wins');
{
  // Brad's 58 (inventory 203), read live 2026-11-07: own Item Type "Accessory", Row ID 2TBK2TS6WS
  const pw58 = rowsOf('58', 'Lionel PW - Items')[0];
  const brad58 = { itemNum: '58', variation: '', era: 'pw', itemType: 'Accessory', masterKey: 'pw|58|1', masterRowId: pw58.rowId };
  ok('C1 Brad\'s 58 (own column "Accessory") → bucket Motorized Unit', W.rrCopyBucket(brad58) === 'Motorized Unit', W.rrCopyBucket(brad58));
  ok('C2 …and its type word is the catalog\'s', W.rrCopyTypeWord(brad58) === 'Motorized Unit');
  const manual = { itemNum: 'DWG-322', era: 'Manual', itemType: 'Paper' };
  ok('C3 a manual entry (no catalog row) keeps its own type', W.rrCopyTypeWord(manual) === 'Paper');
  const brad6427 = { itemNum: '6427', variation: '1', era: 'pw', itemType: '', masterKey: 'pw|6427|1', masterRowId: rowsOf('6427', 'Lionel PW - Items')[0].rowId };
  ok('C4 Brad\'s 6427 (own column blank) → Caboose, not Other', W.rrCopyBucket(brad6427) === 'Caboose', W.rrCopyBucket(brad6427));
  ok('C5 the dashboard\'s group decider asks THE copy-type rule', /function _ownedBucketOf\(pd\) \{[\s\S]{0,400}return rrCopyBucket\(pd, _valueMasterOf\(pd\)\);/.test(DASH));
  // (reports.js's section rule still reads the copy's own type first ON PURPOSE — it is the
  // rule My Collection's Show chips use; the two must agree. Changing both is Brad's call.)
  ok('C6 the shelf label asks it too', /rrCopyTypeWord\(pd, m\)/.test(read('scan-shelve.js')));
  const shelfName = (src) => { vm.runInContext(grabFn(src, 'rrShelveItemName'), W); return W.rrShelveItemName(brad58); };
  ok('C7 Brad\'s 58 shelf label says "Motorized Unit"', /Motorized Unit/.test(shelfName(read('scan-shelve.js'))), shelfName(read('scan-shelve.js')));
  let oldShelf = '';
  try { oldShelf = cp.execSync('git show fb3beb1c:app/scan-shelve.js', { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) {}
  ok('C7-P the v0.9.2117 shelf label (own column first) → C7 fails ("Accessory")', !!oldShelf && /Accessory/.test(shelfName(oldShelf)), oldShelf ? shelfName(oldShelf) : 'git history needed');
  vm.runInContext(grabFn(read('scan-shelve.js'), 'rrShelveItemName'), W);
}

// ── the Trainz matcher, REAL, with the REAL lists ─────────────────────────
const TZ_SIGS = ['function _tzFamily(e)', 'function _tzItemFamily(eraKey)', 'var _TZ_BUCKET_KIND = {', 'function _tzItemKind(item)', 'function _tzTitleKinds(e)',
  'var _TZ_KIN = {', 'function _tzKindsAgree(a, b)', 'function _tzFits(itemKind, e)', 'function _tzJunkKey(k, title)', 'function _tzModernNums(e)',
  'function _tzLabel(e, itemNum)', 'function _tzDiagrams(item, eraKey)'];
function grabSig(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('not found: ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1) + (sig.indexOf('var ') === 0 ? ';' : ''); } }
  throw new Error('unbalanced: ' + sig);
}
function tzWorld(maintSrc, list, cfgSrc) {
  const c = { console: { log() {}, warn() {} } };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(read('type-groups.js'), c);
  vm.runInContext(read('trainz-diagrams-config.js'), c);
  if (list) c.TRAINZ_DIAGRAMS = list;
  vm.runInContext(grabObj(cfgSrc || CFG, 'const RR_TRAINZ_MODERN_PAGES = {'), c);
  vm.runInContext('var _tzLookup = null;\n' + TZ_SIGS.map(s => grabSig(maintSrc, s)).join('\n'), c);
  return c;
}
const LIVE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'harvests', 'trainz-diagrams-live.json'), 'utf8'));
const tzOf = (c, row, era) => c._tzDiagrams(Object.assign({}, row), era).map(e => e.t);

section('D · the Trainz button');
for (const [name, list] of [['built-in list', null], ['weekly list (no `m` yet)', LIVE.diagrams]]) {
  const c = tzWorld(MAINT, list);
  const gp7 = W.findMaster('2338', '', { era: 'Postwar' });
  const promo = rowsOf('2338', 'Lionel PW - Items').find(r => r.itemType === 'Promotional');
  const t1 = tzOf(c, gp7, 'pw');
  ok('D1 ' + name + ': Brad\'s 2338, through the ONE lookup → the GP-7 / GP-9 diagram', t1.length === 1 && /2338/.test(t1[0]) && /GP-7/.test(t1[0]), t1);
  ok('D2 ' + name + ': the promo row itself still gets none (a cereal-box card is not the engine)', tzOf(c, promo, 'pw').length === 0);
  const pw6427 = tzOf(c, rowsOf('6427', 'Lionel PW - Items')[0], 'pw');
  ok('D3 ' + name + ': postwar 6427 Porthole caboose → the Porthole sheet only', pw6427.length === 1 && /Porthole/.test(pw6427[0]), pw6427);
  const m6427 = tzOf(c, rowsOf('6427', 'Lionel MPC-Modern')[0], 'mpc');
  ok('D4 ' + name + ': modern 6-6427 work caboose → the Transfer Caboose sheet', m6427.some(t => /Transfer Caboose/.test(t)), m6427);
  ok('D5 ' + name + ': postwar 6426 Flatcar with Boats and 6428 Mail car → no caboose sheet',
    tzOf(c, rowsOf('6426', 'Lionel PW - Items')[0], 'pw').every(t => !/Transfer Caboose/.test(t)) && tzOf(c, rowsOf('6428', 'Lionel PW - Items')[0], 'pw').every(t => !/Transfer Caboose/.test(t)));
  ok('D6 ' + name + ': postwar 58 still has the Rotary Snowplow sheet; modern 8459 gets it too',
    tzOf(c, rowsOf('58', 'Lionel PW - Items')[0], 'pw').some(t => /Rotary Snowplow/.test(t)) && tzOf(c, rowsOf('8459', 'Lionel MPC-Modern')[0], 'mpc').some(t => /Rotary Snowplow/.test(t)));
}
{
  // a weekly list that carries `m` itself (the crawl writes it from now on) is read before the table
  const c = tzWorld(MAINT, [{ n: '6427|6426|6428', t: 'Lionel 6427 6426 6428 Transfer Caboose', h: 'some-renamed-page', m: '6427|6426|6428' }]);
  ok('D7 an entry\'s own `m` files those numbers as modern (a renamed page needs no table line)',
    tzOf(c, rowsOf('6427', 'Lionel PW - Items')[0], 'pw').length === 0 && tzOf(c, rowsOf('6427', 'Lionel MPC-Modern')[0], 'mpc').length === 1);
  const LC = new Function('_TZ_LIVE', grabSig(MAINT, 'function _tzLiveCheck(doc)') + '\nreturn _tzLiveCheck;')({ format: 'rr-trainz-diagrams-1', min: 1, max: 5000 });
  const docOf = d => ({ format: 'rr-trainz-diagrams-1', pulled: '2026-11-09', count: d.length, diagrams: d });
  const good = { n: '6427|6426', t: 'x', h: 'a-b' };
  ok('D8 the live check: h,n,t still passes', LC(docOf([good])) === '');
  ok('D9 the live check: a well-formed `m` passes', LC(docOf([Object.assign({ m: '6427' }, good)])) === '');
  ok('D10 the live check: `m` naming a number the entry does not list is refused', /does not list/.test(LC(docOf([Object.assign({ m: '9999' }, good)]))));
  ok('D11 the live check: `m` carrying a quote is refused', /modern numbers/.test(LC(docOf([Object.assign({ m: "6427'" }, good)]))));
  ok('D12 the live check: any other extra field is still refused', /malformed/.test(LC(docOf([Object.assign({ x: '1' }, good)]))));
  const L = new Function(grabSig(MAINT, 'function _tzJunkKey(k, title)') + '\n' + grabSig(MAINT, 'function _tzLabel(e, itemNum)') + '\nreturn _tzLabel;')();
  const gpE = LIVE.diagrams.find(e => /2338/.test(e.n));
  ok('D13 the 2338 label is clean — "GP-7, GP-9", not "…2329 Re"', L(gpE, '2338') === 'GP-7, GP-9', L(gpE, '2338'));
  ok('D14 a size stays in the label — "44 Ton Switcher"', L(LIVE.diagrams.find(e => /^Lionel 625 626/.test(e.t)), '627') === '44 Ton Switcher');
  ok('D15 a title that is all numbers names THIS item — "No. 224"', L(LIVE.diagrams.find(e => /^Lionel 208 209 210/.test(e.t)), '224') === 'No. 224');
  ok('D16 the button shows the short label and keeps the full title as its hover words',
    /title="' \+ _esc\(tzd\.t\) \+ '"/.test(MAINT) && /Trainz diagram: ' \+ _esc\(_tzLabel\(tzd, item\.itemNum\)\)/.test(MAINT));
}

section('E · Dashboard "Value by type"');
{
  const c = { console: { log() {} } }; c.window = c; vm.createContext(c);
  vm.runInContext(read('type-groups.js'), c);
  vm.runInContext('function _valueScaleId() { return "O"; }\n' + grabFn(DASH, '_valueTypeLabel'), c);
  ok('E1 a GP-7 is valued under "Diesel", not "Other"', c._valueTypeLabel({}, { itemType: 'Diesel Locomotive', subType: 'EMD GP-7' }, 'O') === 'Diesel', c._valueTypeLabel({}, { itemType: 'Diesel Locomotive' }, 'O'));
  ok('E2 a caboose under its own type', c._valueTypeLabel({}, { itemType: 'Caboose' }, 'O') !== 'Other');
  ok('E3 a manual item with its own type keeps it', c._valueTypeLabel({ itemType: 'Boxcar' }, null, 'O') !== 'Other');
}

section('F · LCCA gone, the darker backdrop is ONE setting, the rule lives ONCE');
{
  const PIN = require('./lib/pin-source').pinSource();   // the Photo Inbox is read ONLY through its lib (pin_source_tests R1)
  ok('F1 no LCCA button on any device — no _maintLccaGo, no "(LCCA members)" label', !/_maintLccaGo/.test(MAINT.replace(/\/\/[^\n]*/g, '')) && !/\(LCCA members\)|Service Manual archive \(members\)/.test(MAINT));
  ok('F2 the Parts diagrams pop-up dims through _dgDim() on BOTH layouts — side by side on a FIXED layer, never the wrapper a drag moves',
    /'left:0;background:' \+ _dgDim\(\)/.test(MAINT) && /'width:50vw;box-sizing:border-box;pointer-events:none' :/.test(MAINT) && /z-index:100031;background:' \+ _dgDim\(\)/.test(MAINT));
  ok('F3 _dgDim reads RR_DIAGRAMS_DIM, defined ONCE in config.js', /RR_DIAGRAMS_DIM/.test(grabFn(MAINT, '_dgDim')) && (CFG.match(/const RR_DIAGRAMS_DIM =/g) || []).length === 1);
  ok('F4 the Need-a-part backdrop goes dark with it and back on close', /_dgShiftPop\(side\);\n\s*_dgDimPop\(true, side\);/.test(MAINT) && /_dgShiftPop\(false\);\n\s*_dgDimPop\(false\);/.test(MAINT));
  // the rule's words exist ONCE: no other app file carries its own promo/paper demotion regex
  // a regex word list holding BOTH a promo word and a paper word, in any order (browse.js held
  // "/\\b(paper|promo|…)\\b/" — the review found it; the first version of this scan did not)
  const listsIn = (txt) => (txt.match(/\/\\b\([^/\n]*\)\\b\/i?/g) || []).filter(r => /\bpromo/.test(r) && /\bpaper\b/.test(r));
  const scanF5 = (getText) => {
    const files = fs.readdirSync(APP).filter(f => /\.(js|html)$/.test(f) && !/^photo-inbox/.test(f));
    const own = files.filter(f => f !== 'config.js' && listsIn(getText(f)).length);
    if (listsIn(PIN).length) own.push('photo-inbox (pinSource)');
    return own;
  };
  const own = scanF5(read);
  ok('F5 no app file but config.js holds a promo/paper word list', own.length === 0, own);
  let oldBrowse = '';
  try { oldBrowse = cp.execSync('git show fb3beb1c:app/browse.js', { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) {}
  ok('F5-P the v0.9.2117 browse.js (its own list) is found by F5', !!oldBrowse && scanF5(f => f === 'browse.js' ? oldBrowse : read(f)).indexOf('browse.js') >= 0);
  ok('F6 the Photo Inbox asks THE rule (no list of its own)', /function _pinDemotedRow\(row\) \{\s*return rrDemotedRow\(row\);\s*\}/.test(PIN) && /function _pinIsSetRow\(row\) \{\s*return rrRowKind\(row\) === 'set';\s*\}/.test(PIN));
  ok('F7 the catalog check names copies tied to a promo / paper / box / part row', /_rrCopiesOnDemotedRows/.test(DAT));
}

section('P · planted offenders — each fails on the code it replaced');
{
  // P1 the demotion cut out of findMaster's pick → Brad's 2338 lands on the promo again
  const noDem = world(plant(plant(DAT, "      return _swap(bestE);", '      return bestE;'), "    return _swap(pool[0]);", '    return pool[0];'));
  ok('P1 demotion removed → B2 fails (2338 with no hint = the promo)', (fm('2338', '', null, noDem) || {}).itemType === 'Promotional');
  ok('P1b …and B1 fails (the set-member save = the promo)', (fm('2338', '', { era: 'Postwar', manufacturer: 'Lionel' }, noDem) || {}).itemType === 'Promotional');
  // P2 the blank-key guard removed → 6427 opens its empty box
  const noKey = world(plant(DAT, '    if (_byKey && _rrLookupDemoted(_byKey) && !_rrPreferWantsDemoted(prefer)', '    if (false && _byKey && _rrLookupDemoted(_byKey) && !_rrPreferWantsDemoted(prefer)'));
  ok('P2 blank-key guard removed → B7 fails (6427 = the box)', (fm('6427', '', { masterKey: 'pw|6427|', era: 'pw' }, noKey) || {})._tab === 'Lionel PW - Boxes');
  // P3 the era cleaner removed → "Postwar" weighs nothing; the box-owner rule removed → B8 fails
  const noEra = world(plant(DAT, "  var k = (typeof _rrEraKeyOf === 'function') ? _rrEraKeyOf(s) : s;", '  var k = s;'));
  ok('P3 era cleaner removed → "Postwar" names no catalog', noEra._rrPreferEraKey('Postwar') === '' && W._rrPreferEraKey('Postwar') === 'pw');
  const noOwner = world(plant(DAT, '  return !!t && _rrLookupDemoted({ itemType: t });', '  return false;'));
  ok('P3b box-owner rule removed → B8 fails (the 6427 box owner gets the caboose)', (fm('6427', '', { masterKey: 'pw|6427|', era: 'pw', itemType: 'Box' }, noOwner) || {})._tab === 'Lionel PW - Items');
  // P11 the era cleaner removed, prewar loaded first → B9 fails (Brad's 58 = a prewar lamp post)
  const noEraP = world(plant(DAT, "  var k = (typeof _rrEraKeyOf === 'function') ? _rrEraKeyOf(s) : s;", '  var k = s;'), CFG, 'prewar-first');
  ok('P11 era cleaner removed → B9 fails (58 + "Postwar" = a prewar Lamp Post)', (fm('58', '', { era: 'Postwar', manufacturer: 'Lionel' }, noEraP) || {})._era === 'prewar');
  // P12 the swap allowed to leave the number → B14 fails (3462P = the 3462 milk car)
  const anySwap = world(plant(DAT, "      if (!r || r === m || _rrLookupDemoted(r) || String(r.itemNum || '').trim() !== n0 || String(r._era || '') !== e0) return;",
    '      if (!r || r === m || _rrLookupDemoted(r)) return;'), CFG, 'prewar-first');
  ok('P12 swap allowed past the number / catalog → B14 fails (3462P answered by the 3462 car)', (fm('3462P', '', { era: 'pw' }, anySwap) || {}).itemNum === '3462');
  // P13 the review's first version (a −50 penalty inside the scoring) → B13 fails (77 = the PREWAR 77)
  const penalty = world(plant(DAT, "      return _swap(bestE);", "      { let b2 = null, s2b = -Infinity; pool.forEach(r => { const sc = _prefBoost(r) + ((_rrLookupDemoted(r) && pool.some(x => x._era === r._era && !_rrLookupDemoted(x))) ? -50 : 0); if (sc > s2b) { b2 = r; s2b = sc; } }); return b2; }"), CFG, 'prewar-first');
  ok('P13 the first version (a penalty in the scoring) → B13 fails (postwar 77 = the prewar row)', (fm('77', '', { era: 'pw' }, penalty) || {})._era === 'prewar');
  // P4 the OLD word list (v0.9.1119) → the packet / separate-sale rows are items again, and the Instruction Car is paper
  const oldWords = CFG.replace(/const RR_ROW_KIND_WORDS = \{[\s\S]*?\n\};/, "const RR_ROW_KIND_WORDS = { set: { type: /\\bset\\b/i, tab: /\\bsets?\\b/i }, item: /(?!)/, paper: { type: /\\b(promo|promotional|paper|boxes|catalog|catalogs|display|displays|instruction|instructions)\\b/i, tab: /\\b(promo|promotional|paper|boxes|catalog|catalogs|display|displays|instruction|instructions)\\b/i }, part: { type: /(?!)/, tab: /(?!)/ } };");
  const wOld = world(DAT, oldWords);
  ok('P4 the old word list → A2 fails (Separate Sale is an item) and A4 fails (Instruction Car is paper)',
    wOld.rrRowKind({ itemType: 'Separate Sale' }) === 'item' && wOld.rrRowKind({ itemType: 'Instruction Car' }) === 'paper');
  // P5 the dashboard back on the copy's own column → Brad's 58 is an Accessory again (the v2117 code)
  let oldDash = '';
  try { oldDash = cp.execSync('git show fb3beb1c:app/dashboard.js', { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) {}
  if (oldDash) {
    const c = { console: { log() {} } }; c.window = c; vm.createContext(c);
    vm.runInContext(read('type-groups.js'), c);
    vm.runInContext('function _valueScaleId() { return "O"; }\n' + grabFn(oldDash, '_valueTypeLabel'), c);
    ok('P5 the v0.9.2117 Value-by-type → E1 fails ("Other")', c._valueTypeLabel({}, { itemType: 'Diesel Locomotive' }, 'O') === 'Other');
    let oldMaint = cp.execSync('git show fb3beb1c:app/maintenance.js', { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    ok('P6 the v0.9.2117 maintenance.js → F1 fails (the LCCA button is there)', /_maintLccaGo\(/.test(oldMaint.replace(/\/\/[^\n]*/g, '')) && /\(LCCA members\)/.test(oldMaint));
  } else {
    ok('P5/P6 need git history (a full clone) — none here', false, 'git show fb3beb1c failed');
  }
  // P7 the page-name table emptied and no `m` → postwar 6427 gets the Transfer Caboose again (the hand-test)
  const noTable = tzWorld(MAINT, LIVE.diagrams, CFG.replace(/const RR_TRAINZ_MODERN_PAGES = \{[\s\S]*?\n\};/, 'const RR_TRAINZ_MODERN_PAGES = {};'));
  ok('P7 table emptied → D3 fails (postwar 6427 shows the Transfer Caboose too)', tzOf(noTable, rowsOf('6427', 'Lionel PW - Items')[0], 'pw').length === 2);
  // P8 the matcher ignoring the page's modern numbers → the same
  const noMod = tzWorld(plant(MAINT, "          var fk = mod[k] ? 'modern' : f;", '          var fk = f;'), LIVE.diagrams);
  ok('P8 `m` ignored by the matcher → D3 fails', tzOf(noMod, rowsOf('6427', 'Lionel PW - Items')[0], 'pw').length === 2);
  // P9 the old label (the cut title) → D13 fails
  {
    const oldL = new Function(grabSig(MAINT, 'function _tzJunkKey(k, title)') + '\n' + plant(grabSig(MAINT, 'function _tzLabel(e, itemNum)'), '    var t = String(e.t || \'\');', '    return String(e.t || \'\');') + '\nreturn _tzLabel;')();
    const e = LIVE.diagrams.find(x => /2338/.test(x.n));
    ok('P9 the label as the cut title (the v0.9.2117 button) → D13 fails', oldL(e, '2338') !== 'GP-7, GP-9' && /2329 Re$/.test(oldL(e, '2338')));
  }
  // P10 a second word list planted in another file → F5 fails
  // (scanF5 lives in section F's block — run it again here over a planted maintenance.js)
  const plantedList = MAINT + "\nvar _x = /\\b(box|paper|promotional|catalog)\\b/i;";
  const f5 = (getText) => fs.readdirSync(APP).filter(f => /\.(js|html)$/.test(f) && !/^photo-inbox/.test(f) && f !== 'config.js')
    .filter(f => ((getText(f).match(/\/\\b\([^/\n]*\)\\b\/i?/g) || []).filter(r => /\bpromo/.test(r) && /\bpaper\b/.test(r))).length);
  ok('P10 a promo/paper list planted (another order) in maintenance.js is found by the F5 scan', f5(f => f === 'maintenance.js' ? plantedList : read(f)).indexOf('maintenance.js') >= 0 && f5(read).length === 0);
}

console.log('\n' + (fail ? 'FAILED  —  ' : 'ALL PASS  —  ') + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
