#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE APP'S OWN NUMBERS ARE NOT CATALOG SUBMISSIONS — v0.9.2061
//
// 2026-10-30: 75 community submissions waited in the Yardmaster's Office and
// all 75 were rejected. 61 of them were numbers the APP had made itself —
// box / sheet / carton pieces (84631-MBOX), paper items (DWG-1957-468,
// OTH-1972-792, DWG-424) and an older section number (8058-CON). The
// Collector's Market send asked "is it in the catalog?" of every owned row,
// so each was filed for catalog review. [stated] Brad "ship it".
//
// The live catalog (230,365 numbers, read 2026-10-30) holds REAL items of the
// photo-folder's looser shapes — 8150-J, 8054-NB, 8375-X, CAT-ELLIOT-ROWLAND-
// CATAL-001 — so the rule matches only what the app actually writes.
//
//   A*  the 75 real submissions: 61 app-made held back, 14 still go; the real
//       catalog shapes are never held back
//   B*  the two makers (generatePaperItemNum, generateEphemeraItemNum) —
//       run for real — only ever write numbers the rule knows; every paper
//       code they use is listed (a new type cannot slip past)
//   C*  the real send (_vaultItemsToSend): app-made + not in the catalog →
//       not sent; a box of a catalog item still goes as market data; a real
//       number the catalog lacks still goes for review
//   X*  PLANTED: the old vault.js; a rule that uses the loose photo shapes;
//       a paper code missing from the list — each must turn this test red
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const CONFIG = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
const VAULT = fs.readFileSync(path.join(APP, 'vault.js'), 'utf8');
const WIZ = fs.readFileSync(path.join(APP, 'wizard-save.js'), 'utf8');

let pass = 0, fail = 0;
function T(n, cond, detail) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 400)));
  cond ? pass++ : fail++;
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('could not find ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + sig);
}
function grabLine(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('could not find ' + sig);
  return src.slice(i, src.indexOf('\n', i));
}
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}

// The rule (REAL, from config.js) in a sandbox.
function rule(cfg) {
  const code = grab(cfg, 'const RR_PHOTO_HOME = {') + ';\n'
    + grabLine(cfg, 'const RR_APP_SECTION_ENDINGS') + '\n'
    + grab(cfg, 'function rrIsAppMadeNumber(') + '\n'
    + 'this.rrIsAppMadeNumber = rrIsAppMadeNumber; this.RR_PHOTO_HOME = RR_PHOTO_HOME;';
  const sb = {}; vm.createContext(sb); vm.runInContext(code, sb);
  return sb;
}

// The 75 numbers that sat in the Office (crawl_deltas rows 13462-13536, read 2026-10-30).
const APP_MADE = ['84631-MBOX', '8058-CON', 'OTH-1972-792', 'OTH-1973-964', 'OTH-1962-700', 'DWG-1959-543',
  'DWG-424', 'DWG-1957-468', 'DWG-1951-689', 'DWG-322', 'DWG-1959-398', 'DWG-840', 'DWG-1957-386', 'DWG-1973-446',
  'DWG-849', 'DWG-838', 'DWG-1954-033', 'DWG-380', 'DWG-1955-525', 'DWG-941', 'DWG-290', 'DWG-1957-989',
  'DWG-1949-091', '2631030-IS', '2631030-MBOX', '20-91910-IS', '2631230-IS', '2631230-MBOX', '2426470-IS',
  '2531900L-BOX', '2531900L-IS', '2531900L-MBOX', '20-22022-1-IS', '20-22022-1-MBOX', '2331030-IS', '2331030-MBOX',
  '2432010-IS', '2432010-MBOX', '86199-51-BOX', '27308-BOX', '27308-IS', '6-21787-IS', '39082-IS', '39082-MBOX',
  '15406-IS', '15406-MBOX', 'K616-1892-BOX', '2632050-IS', '6-31712-IS', '6-31712-MBOX', '6-31705-IS',
  '6-31705-MBOX', '18005-IS', '18005-MBOX', '6-21786-IS', '6-21786-MBOX', '6-31716-IS', '6-31716-MBOX',
  'Moxie-BOX', '6-31778-IS', '51010-IS'];
const STILL_GO = ['LennytheLionSwinging', 'AddUpYour1966LionelP', '4CTRAIN-O-RAMALehigh', 'LionelMadisonCelanes',
  '6-lionel', 'Pittmanerectawiredea', '75lamppostdwg', 'RMT-92499-402', 'I.C.RRLantern', '2531900L', '86199-51',
  'Lionel6-21855APMilkC', 'K616-1892', 'Moxie'];
// Real catalog numbers of the looser shapes (live master, 2026-10-30).
const REAL_SHAPES = ['8150-J', '8159-J', '8054-NB', '8055-NB', '8271-L', '8375-X', '8260-NB', '8372-NB',
  'CAT-ELLIOT-ROWLAND-CATAL-001', 'CAT-ELLIOT-ROWLAND-CATAL-010', '2343', '6464-1', '6-21855', '20-22022-1'];

section('A  the 75 real submissions');
const R = rule(CONFIG);
T('A1 there are 75 (61 + 14)', APP_MADE.length === 61 && STILL_GO.length === 14, [APP_MADE.length, STILL_GO.length]);
const missed = APP_MADE.filter(n => !R.rrIsAppMadeNumber(n));
T('A2 all 61 app-made numbers are held back', missed.length === 0, missed);
const wrongly = STILL_GO.filter(n => R.rrIsAppMadeNumber(n));
T('A3 the 14 others (typed names, real numbers) still go', wrongly.length === 0, wrongly);
const realHit = REAL_SHAPES.filter(n => R.rrIsAppMadeNumber(n));
T('A4 real catalog shapes (8150-J, 8054-NB, CAT-ELLIOT-…) are never held back', realHit.length === 0, realHit);
T('A5 lower case and spaces read the same', R.rrIsAppMadeNumber(' dwg-1957-468 ') && R.rrIsAppMadeNumber('6-31712-is'));
T('A6 blank / null is not app-made', !R.rrIsAppMadeNumber('') && !R.rrIsAppMadeNumber(null) && !R.rrIsAppMadeNumber(undefined));

section('B  the two makers only write numbers the rule knows');
const makers = grab(WIZ, 'function generateEphemeraItemNum(') + '\n' + grab(WIZ, 'function generatePaperItemNum(')
  + '\nthis.eph = generateEphemeraItemNum; this.pap = generatePaperItemNum;';
const M = {}; vm.createContext(M); vm.runInContext(makers, M);
const typeBlock = (grab(WIZ, 'function generatePaperItemNum(').match(/const typeMap = \{([\s\S]*?)\};/) || [])[1] || '';
const paperTypes = Array.from(typeBlock.matchAll(/'([^']+)':\s*'([A-Z]+)'/g)).map(m => m[1]);
T('B1 the paper maker names its types (read from wizard-save.js)', paperTypes.length >= 11, paperTypes);
const badPaper = [];
paperTypes.concat(['Something New']).forEach(t => ['1957', '', '1930'].forEach(y => {
  const n = M.pap(t, y); if (!R.rrIsAppMadeNumber(n)) badPaper.push(n);
}));
T('B2 every paper number it writes (each type, with and without a year, the PAP fallback) is held back', badPaper.length === 0, badPaper);
const tabs = ['catalogs', 'paper', 'mockups', 'other', 'somethingelse'];
const cats = ['Consumer', 'Advance', 'Dealer', 'Other', ''];
const badEph = [];
tabs.forEach(tab => cats.forEach(c => ['1958', '', 1972].forEach(y => {
  const n = M.eph(tab, y, c); if (!R.rrIsAppMadeNumber(n)) badEph.push(n);
})));
T('B3 every section number it writes (each tab, catalog kind, year) is held back', badEph.length === 0, badEph);
const piece = ['BOX', 'IS', 'MBOX'].map(e => '6-36814-' + e).filter(n => !R.rrIsAppMadeNumber(n));
T('B4 the three piece endings (RR_ADD_PIECE) are held back', piece.length === 0, piece);
const pieceEnds = Array.from(grab(CONFIG, 'const RR_ADD_PIECE = {').matchAll(/ending: '(-[A-Z]+)'/g)).map(m => m[1]);
T('B5 every piece ending the Add a Piece box writes is held back', pieceEnds.length === 3
  && pieceEnds.every(e => R.rrIsAppMadeNumber('2343' + e)), pieceEnds);

section('C  the real send');
function sender(vaultSrc, cfg) {
  const RR = rule(cfg || CONFIG);
  const code = grab(vaultSrc, 'function _vaultInMaster(') + '\n'
    + grab(vaultSrc, 'function _vaultIsoDate(') + '\n'
    + grab(vaultSrc, 'function _vaultIsPartSale(') + '\n'
    + grab(vaultSrc, 'async function _vaultItemsToSend(') + '\n'
    + 'this.send = _vaultItemsToSend;';
  const master = new Set(['2343', '6464-1', '115', 'SM-243']); master.loaded = true;
  const sb = {
    console, rrIsAppMadeNumber: RR.rrIsAppMadeNumber, rrIsPartSale: () => false,
    baseItemNum: n => String(n).replace(/-?[PTC]$/, ''),
    rrDateTs: v => Date.parse(v), ERAS: {},
    _vaultMasterSet: async () => master,
    state: { personalData: {}, soldData: {} },
  };
  vm.createContext(sb); vm.runInContext(code, sb);
  return sb;
}
function owned(list) {
  const pd = {};
  list.forEach((x, i) => { pd['ID' + i] = Object.assign({ owned: true, variation: '', manufacturer: 'Lionel' }, x); });
  return pd;
}
const ROWS = [
  { itemNum: '2343', condition: '7', userEstWorth: '400' },          // catalog item → market
  { itemNum: '2343-BOX', condition: '6', userEstWorth: '50' },       // box of a catalog item → market, in_master
  { itemNum: '84631-MBOX', condition: '' },                          // app-made, not in catalog → NOT sent
  { itemNum: 'DWG-1957-468', condition: '8' },                       // app-made paper → NOT sent
  { itemNum: 'DWG-424', condition: '' },                             // app-made paper (no year) → NOT sent
  { itemNum: '8058-CON', condition: '7' },                           // app-made section → NOT sent
  { itemNum: 'RMT-92499-402', condition: '', description: 'Beep' },  // real number the catalog lacks → review
  { itemNum: 'Moxie', condition: '' },                               // typed name → review
  { itemNum: '8150-J', condition: '7' },                             // a real catalog SHAPE, not in this catalog → review
];
async function runC(vaultSrc, cfg) {
  const S = sender(vaultSrc, cfg);
  S.state.personalData = owned(ROWS);
  return S.send();
}

(async () => {
  const out = await runC(VAULT);
  const sent = out.items.map(i => i.item_num);
  T('C1 a catalog item still goes as market data', sent.indexOf('2343') >= 0, sent);
  const box = out.items.find(i => i.item_num === '2343-BOX');
  T('C2 the box of a catalog item still goes, marked in the catalog', !!box && box.in_master === true, box);
  const leaked = ['84631-MBOX', 'DWG-1957-468', 'DWG-424', '8058-CON'].filter(n => sent.indexOf(n) >= 0);
  T('C3 app-made numbers not in the catalog are not sent at all', leaked.length === 0, leaked);
  const review = out.items.filter(i => i.in_master === false).map(i => i.item_num).sort();
  T('C4 real numbers the catalog lacks still go for review (RMT-92499-402, Moxie, 8150-J)',
    JSON.stringify(review) === JSON.stringify(['8150-J', 'Moxie', 'RMT-92499-402']), review);
  T('C5 the review count and fingerprint name only those three',
    out.flagged === 3 && out.nfSig === '8150-J,MOXIE,RMT-92499-402', [out.flagged, out.nfSig]);
  const rmt = out.items.find(i => i.item_num === 'RMT-92499-402');
  T('C6 a review row still carries its description and source', !!rmt && rmt.description === 'Beep' && rmt.source === 'app', rmt);

  section('X  planted offenders (each must go red)');
  // X1 the old vault.js: no check → app-made numbers sent again.
  const oldVault = planted(VAULT, "      if (!inMaster && rrIsAppMadeNumber(itemNum)) continue;\n", '', 'old vault');
  const o1 = await runC(oldVault);
  const l1 = o1.items.map(i => i.item_num).filter(n => ['84631-MBOX', 'DWG-1957-468', '8058-CON'].indexOf(n) >= 0);
  T('X1 the old send files the app\'s own numbers again (C3 would catch it)', l1.length === 3, l1);
  // X2 a rule built on the photo folder's looser shapes holds back real items.
  const loose = planted(CONFIG, "  const s = /^8[0-3]\\d\\d-([A-Z]+)$/.exec(n);\n  return !!(s && RR_APP_SECTION_ENDINGS.indexOf(s[1]) >= 0);",
    "  return H.SECTION_NUMBER.some(function (x) { return x.re.test(n); });", 'loose sections');
  const RL = rule(loose);
  const h2 = REAL_SHAPES.filter(n => RL.rrIsAppMadeNumber(n));
  T('X2 the loose section shape holds back 8150-J / 8054-NB (A4 would catch it)', h2.indexOf('8150-J') >= 0 && h2.indexOf('8054-NB') >= 0, h2);
  const o2 = await runC(VAULT, loose);
  T('X2b … and the real send would drop 8150-J (C4 would catch it)', !o2.items.some(i => i.item_num === '8150-J'));
  // X3 a paper code missing from PAPER_CODE → its numbers slip through.
  const noDwg = planted(CONFIG, "IS: 'Instruction Sheets', DWG: 'Drawings',", "IS: 'Instruction Sheets',", 'no DWG');
  const RD = rule(noDwg);
  T('X3 a missing paper code lets DWG-1957-468 through (A2 / B2 would catch it)', !RD.rrIsAppMadeNumber('DWG-1957-468'));
  // X4 a loose paper shape holds back the catalog's own CAT-ELLIOT-… rows.
  const loosePaper = planted(CONFIG, "/^([A-Z]{2,3})-(?:[^-\\s]{1,8}-)?(\\d{3,4})$/", "/^([A-Z]{2,3})-(.*)()$/", 'loose paper');
  T('X4 a loose paper shape holds back CAT-ELLIOT-ROWLAND-CATAL-001 (A4 would catch it)',
    rule(loosePaper).rrIsAppMadeNumber('CAT-ELLIOT-ROWLAND-CATAL-001'));

  console.log('\n' + (fail ? 'FAILED' : 'PASSED') + '  app_made_numbers_2061_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.stack); process.exit(1); });
