#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE RULES UNDER MIKE'S ROADS — v0.9.2053 (fast tier; the real-browser walk is
// inbox_add_roads_2053_tests.js)
//
//   M  ONE maker-name rule (config.js): which names agree, and that no second
//      copy of the maker words survives anywhere in the app
//   K  the family finder (app.js rrDashedKin): MTH 20-20169 / 2020169, and every
//      family the app already knew is unchanged
//   H  the holds (photo-inbox-tools.js): a hold from an earlier opening of the
//      app whose mark is quiet is let go; this opening's, a fresh one's and an
//      armed note never; the save's safety net re-makes a missing hold; a
//      cancelled set lets go of its own holds only
//   S  source: who calls what (close, set cancel, the three saves, the carry list)
//   P  PLANTED: each undone is caught
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const PIECES = require('./lib/pin-source').pinPieces();
const TOOLS = PIECES['photo-inbox-tools.js'];
const { installMakerRule } = require('./lib/maker-rule');
let pass = 0, fail = 0;
function ok(n, c, d) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  -> ' + (typeof d === 'string' ? d : JSON.stringify(d)))); c ? pass++ : fail++; }
function grab(src, header) {
  const i = src.indexOf(header); if (i < 0) throw new Error('not found: ' + header);
  const o = src.indexOf('{', i); let d = 0;
  for (let k = o; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced: ' + header);
}
function plant(src, from, to, label) { if (src.indexOf(from) < 0) throw new Error('planted "' + label + '" no longer matches — update the test'); return src.split(from).join(to); }

// ── M ──────────────────────────────────────────────────────────────────────
console.log('\n== M · one maker-name rule ==');
const CFG = read('config.js');
const MR = installMakerRule({}, CFG);
const same = (a, b) => MR.rrMakerSame(a, b);
[['M.T.H.', 'MTH'], ["Mike's Train House", 'MTH'], ['RailKing', 'MTH'], ['Rail King', 'MTH'], ['MTH Electric Trains', 'MTH'],
 ['Tinplate Traditions by M.T.H.', 'MTH'], ['A.C. Gilbert', 'American Flyer'], ['Lionel LLC', 'Lionel'], ['K Line', 'K-Line'],
 ['Williams by Bachmann', 'Williams'], ['Atlas O', 'Atlas'], ['Märklin', 'Marklin']].forEach(([a, b]) =>
  ok('M  "' + a + '" agrees with "' + b + '"', same(a, b) && same(b, a)));
[['Marx', 'Atlas'], ['Lionel', 'MTH'], ['Ives', 'Lionel'], ['Weaver', 'Atlas O'], ['K-Line by Lionel', 'Lionel']].forEach(([a, b]) =>
  ok('M  "' + a + '" does NOT agree with "' + b + '"', !same(a, b) && !same(b, a)));
ok('M  "Premier" (MTH\'s line AND Atlas\'s) settles nothing — no conflict with either', same('Premier', 'MTH') && same('Premier', 'Atlas'));
ok('M  nothing to compare is no conflict', same('', 'MTH') && same('Lionel', ''));
ok('M  the Photo ID names are unchanged (Atlas shows as "Atlas O", MTH as "MTH")', MR.rrMakerName('atlas trains') === 'Atlas O' && MR.rrMakerName('M.T.H. Electric Trains') === 'MTH' && MR.rrMakerName('no maker here') === '');
const APPFILES = fs.readdirSync(APP).filter(f => /\.js$/.test(f));
const tinplateHomes = APPFILES.filter(f => /tinplate\\s\+traditions/.test(read(f)));
ok('M  the maker words live ONCE (config.js) — no second copy anywhere in the app', tinplateHomes.length === 1 && tinplateHomes[0] === 'config.js', tinplateHomes);
const agree = grab(PIECES['photo-inbox.js'], 'function _pinMfrAgree(a, b)');
ok('M  the inbox\'s maker check is the one rule, nothing of its own', /return rrMakerSame\(a, b\);/.test(agree) && !/split\(/.test(agree));
ok('M  Google Photo ID\'s cleaner is the one rule too', /var _canonMfr = function \(s\) \{ return rrMakerName\(s\); \};/.test(read('wizard-photos.js')));

// ── K ──────────────────────────────────────────────────────────────────────
console.log('\n== K · the family finder ==');
function kinFn(src) {
  const sb = { state: null }; vm.createContext(sb);
  vm.runInContext(grab(src, 'function rrDashedKin(num)') + '\nthis.f = rrDashedKin;', sb);
  return (rows, all, n) => { sb.state = { masterData: rows, masterByItemAll: all || null }; return sb.f(n); };
}
const R = (n, era) => ({ itemNum: n, _era: era || 'pw' });
const MTH = ['20-20169-1', '20-20169-2', '20-20169-3'].map(n => R(n, 'mth_o'));
const LION = [R('3376'), R('3376-160'), R('6014'), R('X6014'), R('6014-1'), R('20', 'prewar'), R('6464-1'), R('6464-275')];
const kin = kinFn(read('app.js'));
const idxOf = rows => { const m = new Map(); rows.forEach(r => { if (!m.has(r.itemNum)) m.set(r.itemNum, []); m.get(r.itemNum).push(r); }); return m; };
ok('K1 "20-20169" (no row of its own) → its three children', JSON.stringify(kin(LION.concat(MTH), null, '20-20169').sort()) === JSON.stringify(['20-20169-1', '20-20169-2', '20-20169-3']), kin(LION.concat(MTH), null, '20-20169'));
ok('K2 …found in the FULL-catalog index while the phone shows Lionel', kin(LION, idxOf(MTH), '20-20169').length === 3, kin(LION, idxOf(MTH), '20-20169'));
ok('K3 "2020169" (dashes lost) → the same family', kin(LION, idxOf(MTH), '2020169').length === 3, kin(LION, idxOf(MTH), '2020169'));
ok('K4 "20-20169" never names Lionel\'s prewar No. 20 as its parent', kin(LION.concat(MTH), null, '20-20169').indexOf('20') < 0);
ok('K5 unchanged: 3376 → 3376-160', JSON.stringify(kin(LION, null, '3376')) === JSON.stringify(['3376-160']));
ok('K6 unchanged: 6014 → X6014 and 6014-1', kin(LION, null, '6014').sort().join() === '6014-1,X6014', kin(LION, null, '6014'));
ok('K7 unchanged: 3376-160 → its parent 3376 only', JSON.stringify(kin(LION, null, '3376-160')) === JSON.stringify(['3376']));
ok('K8 a dashed number WITH a row of its own stays specific (no children offered)', kin(LION.concat([R('6464-275-1')]), null, '6464-275').indexOf('6464-275-1') < 0);
ok('K9 a 7-digit number that IS a row is never rewritten as MTH', kin([R('2023170', 'mpc'), R('20-23170-1', 'mth_o')], null, '2023170').length === 0);

// ── H ──────────────────────────────────────────────────────────────────────
console.log('\n== H · the holds ==');
function store(stage, pend) {
  const mem = { rr_inbox_setstage: JSON.stringify(stage || {}), rr_inbox_pending: JSON.stringify(pend || {}) };
  return { ls: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } }, read: k => JSON.parse(mem[k] || '{}') };
}
const LIST = v => (Array.isArray(v) ? v : [v]);
const QUIET = { log() {}, warn() {} };
const NOW = 1800000000000, MIN = 60000;
function sweepOf(src, s, open) {
  const lines = ['var RR_STAGED_ABANDON_MS', 'var _PIN_OPEN_ID'].map(h => (src.match(new RegExp(h.replace(/[$]/g, '\\$') + ' = [^;]+;')) || [''])[0]);
  const f = new Function('SETSTAGE_KEY', 'PENDING_KEY', 'localStorage', '_pendList', '_rrNowMs', 'console', '_pinWizardOpen', 'RR_ADD_HOLD_QUIET_MS',
    lines[0] + '\nvar _PIN_OPEN_ID = "this-opening";\n' + grab(src, 'function _pinSweepStaleClaims()') + '\nreturn _pinSweepStaleClaims;');
  return f('rr_inbox_setstage', 'rr_inbox_pending', s.ls, LIST, () => NOW, QUIET, () => !!open, 3 * MIN)();
}
// beatAgo null = the mark was zeroed (the page left)
const hold = (open, beatAgo, tsAgo) => ({ ts: NOW - (tsAgo || 2 * MIN), open: open, beat: beatAgo == null ? 0 : NOW - beatAgo, files: [{ id: 'm1' }] });
{
  const s = store({ a: hold('old-opening', null), b: hold('old-opening', 4 * MIN), c: hold('another-tab', 20000), d: hold('this-opening', null), e: { ts: NOW - 2 * MIN, files: [{ id: 'x' }] } });
  sweepOf(TOOLS, s, false);
  const st = s.read('rr_inbox_setstage');
  ok('H1 an earlier opening\'s hold whose page LEFT (mark zeroed) is let go at once — Mike\'s restart', !('a' in st), st);
  ok('H2 …and one whose mark went quiet (killed, no warning)', !('b' in st), st);
  ok('H3 a hold kept fresh by another live tab stays', 'c' in st, st);
  ok('H4 this opening\'s own hold is never let go by this rule', 'd' in st, st);
  ok('H5 a hold written before this release (no opening tag) keeps the old 30-minute rule', 'e' in st, st);
}
{
  const s = store({}, { p: hold('old-opening', null) });
  sweepOf(TOOLS, s, false);
  ok('H6 an ARMED note (a saved item\'s photos) is never let go by this rule', 'p' in s.read('rr_inbox_pending'));
}
function ensureOf(src, s, groups) {
  const f = new Function('SETSTAGE_KEY', 'PENDING_KEY', 'localStorage', '_pendList', '_rrNowMs', 'console', 'PIN', '_pinHoldMark', 'window',
    grab(src, 'window.rrPinEnsureStaged = function') + ';\nreturn window.rrPinEnsureStaged;');
  return f('rr_inbox_setstage', 'rr_inbox_pending', s.ls, LIST, () => NOW, QUIET, { _groups: groups || [] }, r => Object.assign(r, { open: 'this-opening', beat: NOW }), {});
}
{
  const s = store({});
  const made = ensureOf(TOOLS, s, [{ files: [{ id: 'm1', name: 'IMG_4001.jpg', _meta: { role: '' } }] }])('20-20169-3', ['m1', 'm2']);
  const st = s.read('rr_inbox_setstage');
  ok('H7 the save\'s safety net: a hold that was let go is written again from the Add screen\'s photos', made && st['20-20169-3'] && st['20-20169-3'].files.map(f => f.id).join() === 'm1,m2' && st['20-20169-3'].files[0].name === 'IMG_4001.jpg', st);
}
{
  const s = store({ '20-20169-3': { ts: NOW, files: [{ id: 'm1' }] } });
  ok('H8 …nothing is written when the hold is there', ensureOf(TOOLS, s)('20-20169-3', ['m1']) === false);
  const s2 = store({}, { '20-20169-3': { ts: NOW, files: [{ id: 'm1' }] } });
  ok('H9 …or when those photos are already armed for a saved item', ensureOf(TOOLS, s2)('20-20169-3', ['m1']) === false && !Object.keys(s2.read('rr_inbox_setstage')).length);
}
function releaseOf(src, s) {
  const f = new Function('SETSTAGE_KEY', 'PENDING_KEY', 'localStorage', '_pendList', 'console', 'window',
    grab(src, 'window.rrPinReleaseSetHolds = function') + ';\nreturn window.rrPinReleaseSetHolds;');
  return f('rr_inbox_setstage', 'rr_inbox_pending', s.ls, LIST, QUIET, {});
}
{
  const s = store({ '2343': { ts: NOW, files: [{ id: 's1' }, { id: 's2' }] }, '2343C': { ts: NOW, files: [{ id: 's3' }] }, '6464-1': { ts: NOW, files: [{ id: 'other' }] } },
                  { '2343T': { ts: NOW, files: [{ id: 's4' }] }, '773': { ts: NOW, files: [{ id: 's5' }], moved: true } });
  const rel = releaseOf(TOOLS, s);
  rel(['s1', 's2', 's3', 's4', 's5'], false);
  ok('H10 a cancelled set lets go of its own waiting holds', !('2343' in s.read('rr_inbox_setstage')) && !('2343C' in s.read('rr_inbox_setstage')));
  ok('H11 …never another add\'s hold', '6464-1' in s.read('rr_inbox_setstage'));
  ok('H12 …and a plain close leaves the armed (saved) members alone', '2343T' in s.read('rr_inbox_pending'));
  rel(['s1', 's2', 's3', 's4', 's5'], true);
  ok('H13 a set cancelled WITH its saved members deleted lets go of their armed notes too', !('2343T' in s.read('rr_inbox_pending')));
  ok('H14 …except one whose photos already moved (nothing to undo there)', '773' in s.read('rr_inbox_pending'));
}

// ── S ──────────────────────────────────────────────────────────────────────
console.log('\n== S · who calls what ==');
const WZ = read('wizard.js'), WS = read('wizard-save.js');
const close = grab(WZ, 'function _doCloseWizard()');
ok('S1 closing an unsaved set add lets go of its holds', /!_wd\._saveComplete && _wd\._pinSetStagedFiles[\s\S]{0,160}rrPinReleaseSetHolds\(_wd\._pinSetStagedFiles, false\)/.test(close));
ok('S2 "Yes, Delete All" on a part-saved set lets go of its armed notes too', /rrRemoveSetGroup\(groupId\);[\s\S]{0,500}rrPinReleaseSetHolds\(wizard\.data\._pinSetStagedFiles, true\)/.test(grab(WZ, 'async function _confirmSetCancel()')));
const manual = grab(WS, 'async function _saveManualEntry()');
ok('S3 the HAND-MADE save checks, re-keys and ARMS the inbox hold (Mike\'s first report)', /rrPinEnsureStaged\(d\._pinStagedNum[\s\S]{0,300}rrPinRekeyStaged\(d\._pinStagedNum, displayId\)[\s\S]{0,120}rrPinSetPhotoSaved\(displayId\)/.test(manual));
// v0.9.2072: was a COUNT of 3 — the Instruction Sheet save joined, so each save is named instead
const _netFirst = h => /rrPinEnsureStaged\(d\._pinStagedNum[\s\S]*?rrPinSetPhotoSaved\(/.test(grab(WS, h));
ok('S4 every Collection save that arms the inbox hold runs the safety net first', ['async function saveWizardItem()', 'async function saveEphemeraItem()', 'async function _saveManualEntry()', 'async function saveInstructionSheet()'].every(_netFirst));
ok('S5 the set add tells its Add screen which holds are its own', /_pinSetStagedNums: Object\.keys\(stage0 \|\| \{\}\), _pinSetStagedFiles: _setHoldIds/.test(TOOLS));
ok('S6 every hold the inbox writes carries its opening (single, no-number, set, and the safety net\'s)', /stage1\[num\] = _pinHoldMark\(\{ link: link/.test(TOOLS) && /stage\[key\] = _pinHoldMark\(\{ link: ''/.test(TOOLS) && /stage0\[n1\] = _pinHoldMark\(\{ link: ''/.test(TOOLS) && /stage\[k\] = _pinHoldMark\(\{ link: ''/.test(TOOLS));
const CARRY = (CFG.match(/const RR_INBOX_CARRY_KEYS = \[([\s\S]*?)\];/) || [])[1] || '';
const handed = {};
(TOOLS.match(/wizard\.data\.(_[A-Za-z]+) = /g) || []).forEach(m => { handed[m.slice(12, -3)] = 1; });
['_pinSetStagedNums', '_pinSetStagedFiles'].forEach(k => { handed[k] = 1; });
const missing = Object.keys(handed).filter(k => !/^_pinGroupingFromInbox$|^_returnPage$|^_era$/.test(k) && CARRY.indexOf("'" + k + "'") < 0);
ok('S7 everything the inbox hands the Add screen is on the ONE carry list (config.js)', missing.length === 0, missing);
ok('S8 the Item Type switch keeps that list, not a copy of its own', /RR_INBOX_CARRY_KEYS/.test(grab(WZ, 'function _wizSetKind(kind)')));
ok('S9 the words and numbers live in config.js once', /const RR_INBOX_GUESS = \{/.test(CFG) && /const RR_CATALOG_WAIT_MS = /.test(CFG) && /const RR_ADD_HOLD_QUIET_MS = /.test(CFG)
   && !/Add it as \{num\}\?/.test(TOOLS) && !/Looking it up in the catalog\\u2026'\)/.test(TOOLS.replace("RR_CATALOG_WAIT_TEXT.waiting : 'Looking it up in the catalog\\u2026'", '')));

// ── P ──────────────────────────────────────────────────────────────────────
console.log('\n== P · planted ==');
{
  const old = plant(CFG, "[/m\\.\\s?t\\.\\s?h|\\bmth\\b|mike'?s\\s+train\\s+house|tinplate\\s+traditions|rail\\s?king\\b/i, 'mth', 'MTH'],", "[/\\bmth\\b/i, 'mth', 'MTH'],", 'mth words');
  ok('P1 a maker list that only knows "MTH" fails M (Mike\'s Train House ≠ MTH)', !installMakerRule({}, old).rrMakerSame("Mike's Train House", 'MTH'));
}
{
  const old = plant(read('app.js'), "        if (!hasExact && s.length > n.length && s.slice(0, n.length) === n) {", "        if (false) {", 'children');
  ok('P2 without the children rule K1 fails', kinFn(old)(LION.concat(MTH), null, '20-20169').length === 0);
}
{
  const old = plant(TOOLS, '              && (!rec.beat || (now - rec.beat) > _quiet)) {', '              && false) {', 'quiet');
  const s = store({ a: hold('old-opening', null) }); sweepOf(old, s, false);
  ok('P3 without the earlier-opening rule H1 fails (the hold survives)', 'a' in s.read('rr_inbox_setstage'));
}
{
  const old = plant(TOOLS, '      if (holds(stage) || holds(pend)) return false;', '      return false;', 'net');
  const s = store({}); ensureOf(old, s)('20-20169-3', ['m1']);
  ok('P4 without the safety net H7 fails', !Object.keys(s.read('rr_inbox_setstage')).length);
}
{
  const old = plant(TOOLS, "            if (mine && storeKey === PENDING_KEY && rec.moved) mine = false;", '', 'moved');
  const s = store({}, { '773': { ts: NOW, files: [{ id: 's5' }], moved: true } }); releaseOf(old, s)(['s5'], true);
  ok('P5 without the "already moved" guard H14 fails', !('773' in s.read('rr_inbox_pending')));
}
{
  const old = plant(WS, "      if (typeof rrPinSetPhotoSaved === 'function') rrPinSetPhotoSaved(displayId);\n", '', 'manual arm');
  ok('P6 a hand-made save without the arm fails S3', !/rrPinSetPhotoSaved\(displayId\)/.test(grab(old, 'async function _saveManualEntry()')));
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
