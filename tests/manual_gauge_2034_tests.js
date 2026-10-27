// ═══════════════════════════════════════════════════════════════
// manual_gauge_2034_tests.js — v0.9.2034.
//
// Melissa (2026-10-27, Report a problem, typing in a Bowser hopper): "When
// asked for Scale/Gauge, N scale is not an option to choose." The manual-entry
// picker typed its own list (O, O-27, Standard, S, HO, G, No. 1) and the photo
// reader kept a SECOND copy as a chain of regexes; N, Z, On30 and HOn30 were in
// neither. Now ONE list, RR_MANUAL_GAUGES (config.js): the picker draws it and
// rrGaugeFromWords() maps a reader's wording onto it.
//
// A: the list and the normalizer, lifted from config.js and run in Node.
// B: the picker builds its options from the ONE list; the reader asks the ONE
//    normalizer; no typed gauge list survives anywhere else in app/.
// P: planted offenders — each puts an old habit back and must go red.
// Run:  node tests/manual_gauge_2034_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP_DIR = path.join(__dirname, '..', 'app');
const APP = f => fs.readFileSync(path.join(APP_DIR, f), 'utf8');
const CONFIG = APP('config.js'), WIZ = APP('wizard.js'), PHOTOS = APP('wizard-photos.js');
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
function constOf(src, name) {
  const i = src.indexOf('const ' + name + ' =');
  if (i < 0) return '';
  const j = src.indexOf('];', i);
  return src.slice(i, j + 2);
}
function lift(cfg) {
  const body = constOf(cfg, 'RR_MANUAL_GAUGES') + '\n' + constOf(cfg, '_RR_GAUGE_WORDS') + '\n' + grab(cfg, 'rrGaugeFromWords')
    + '\nreturn { list: typeof RR_MANUAL_GAUGES !== "undefined" ? RR_MANUAL_GAUGES : null, from: typeof rrGaugeFromWords === "function" ? rrGaugeFromWords : null };';
  return new Function(body)();
}
// The picker's option builder, exactly as wizard.js writes it, run with the lifted list.
function pickerOptions(wiz, list, chosen) {
  const i = wiz.indexOf('<select id="manual-gauge"');
  const j = wiz.indexOf('</select>', i);
  const chunk = wiz.slice(i, j);
  const m = chunk.match(/\n\s*(\[.*?\.join\(''\))/s);
  if (!m) return null;
  try { return new Function('RR_MANUAL_GAUGES', 'd', 'return ' + m[1] + ';')(list, { manualGauge: chosen }); } catch (e) { return 'ERR ' + e.message; }
}

function run(cfg, wiz, photos) {
  const r = {};
  let api; try { api = lift(cfg); } catch (e) { r.err = String(e); return r; }
  r.hasList = Array.isArray(api.list) && api.list.length > 0;
  r.hasN = r.hasList && api.list.indexOf('N') >= 0;
  r.hasZ = r.hasList && api.list.indexOf('Z') >= 0;
  r.keepsOld = r.hasList && ['O', 'O-27', 'Standard', 'S', 'HO', 'G', 'No. 1'].every(g => api.list.indexOf(g) >= 0);
  r.noBlankInList = r.hasList && api.list.every(g => String(g).trim() !== '');
  r.noDup = r.hasList && new Set(api.list).size === api.list.length;
  const f = api.from;
  const want = [['N scale', 'N'], ['n', 'N'], ['N-scale hopper', 'N'], ['HO scale', 'HO'], ['HOn30', 'HOn30'], ['On30', 'On30'],
                ['O gauge', 'O'], ['O-27', 'O-27'], ['O27', 'O-27'], ['Standard Gauge', 'Standard'], ['Gauge 1', 'No. 1'], ['No.1', 'No. 1'],
                ['No. 1 gauge', 'No. 1'], ['S gauge', 'S'], ['G scale', 'G'], ['Z scale', 'Z'], ['', ''], ['unknown', ''], ['1:48', '']];
  r.fromOk = !!f && want.every(([w, e]) => f(w) === e);
  r.fromDetail = f ? want.filter(([w, e]) => f(w) !== e).map(([w, e]) => w + ' → ' + JSON.stringify(f(w)) + ' (wanted ' + JSON.stringify(e) + ')').join('; ') : 'no function';
  r.fromOnlyList = !!f && ['N scale', 'HO', 'Standard', 'O-27', 'Gauge 1', 'Z', 'On30', 'HOn30', 'S', 'G', 'O', 'unknown', 'TT scale', '1:48'].every(w => f(w) === '' || api.list.indexOf(f(w)) >= 0);
  // B — the picker
  const opts = r.hasList ? pickerOptions(wiz, api.list, 'N') : null;
  r.pickerBuilt = typeof opts === 'string' && opts.indexOf('<option') >= 0;
  r.pickerHasN = r.pickerBuilt && /<option value="N" selected>N<\/option>/.test(opts);
  r.pickerNotSure = r.pickerBuilt && /<option value="">— not sure —<\/option>/.test(opts);
  r.pickerCount = r.pickerBuilt ? (opts.match(/<option /g) || []).length : 0;
  r.pickerAll = r.hasList && r.pickerCount === api.list.length + 1;
  r.pickerFromList = /RR_MANUAL_GAUGES/.test(code(wiz).slice(code(wiz).indexOf('<select id="manual-gauge"'), code(wiz).indexOf('<select id="manual-gauge"') + 600));
  // no typed gauge list anywhere in app/ but config.js
  const typed = /\[\s*''\s*,\s*'O'\s*,\s*'O-27'|'O-27'\s*,\s*'Standard'\s*,\s*'S'/;
  r.noTypedList = fs.readdirSync(APP_DIR).filter(f => f.endsWith('.js') && f !== 'config.js')
    .every(f => !typed.test(code(f === 'wizard.js' ? wiz : f === 'wizard-photos.js' ? photos : APP(f))));
  // the reader asks the ONE normalizer, with no regex chain of its own
  const pc = code(photos);
  r.readerUsesOne = /manualGauge\s*=\s*rrGaugeFromWords\(/.test(pc);
  r.readerNoChain = !/\/standard\/i\.test\([^)]*\)\s*\?\s*'Standard'/.test(pc);
  return r;
}

section('A — the one list and the normalizer');
const A = run(CONFIG, WIZ, PHOTOS);
ok('A1 RR_MANUAL_GAUGES lifts from config.js', A.hasList, A.err);
ok('A2 N is on the list (Melissa)', A.hasN);
ok('A3 Z is on the list', A.hasZ);
ok('A4 every old choice is still there (O, O-27, Standard, S, HO, G, No. 1)', A.keepsOld);
ok('A5 no blank entry (— not sure — is the picker\'s, not the list\'s) and no duplicate', A.noBlankInList && A.noDup);
ok('A6 rrGaugeFromWords maps a reader\'s wording onto the list', A.fromOk, A.fromDetail);
ok('A7 the normalizer never answers a word that is not on the list', A.fromOnlyList);

section('B — the picker and the reader use it');
ok('B1 the picker builds its options from the list', A.pickerBuilt && A.pickerFromList);
ok('B2 the picker offers N (and keeps a chosen N selected)', A.pickerHasN);
ok('B3 the first option is still "— not sure —"', A.pickerNotSure);
ok('B4 one option per list entry, plus not-sure', A.pickerAll, 'count ' + A.pickerCount);
ok('B5 no typed gauge list anywhere in app/ but config.js', A.noTypedList);
ok('B6 the photo reader asks rrGaugeFromWords', A.readerUsesOne);
ok('B7 the reader keeps no regex chain of its own', A.readerNoChain);

section('P — planted offenders (each must go red)');
const P1 = run(CONFIG.replace("'HO', 'N', 'G'", "'HO', 'G'"), WIZ, PHOTOS);
ok('P1 N dropped from the list → A2 + B2 red', P1.hasList && !P1.hasN && !P1.pickerHasN);
const P2 = run(CONFIG, WIZ.replace("[''].concat(RR_MANUAL_GAUGES)", "['','O','O-27','Standard','S','HO','G','No. 1']"), PHOTOS);
ok('P2 the picker types its own list again → B1/B2/B5 red', !P2.pickerFromList && !P2.pickerHasN && !P2.noTypedList);
const P3 = run(CONFIG, WIZ, PHOTOS.replace('wizard.data.manualGauge = rrGaugeFromWords(meta.gauge);', "var _g = String(meta.gauge); wizard.data.manualGauge = /standard/i.test(_g) ? 'Standard' : /\\bho\\b/i.test(_g) ? 'HO' : '';"));
ok('P3 the reader grows its own regex chain again → B6 + B7 red', !P3.readerUsesOne && !P3.readerNoChain);
const P4 = run(CONFIG.replace("['HO', /\\bho\\b/i], ['N', /\\bn\\b/i]", "['N', /\\bn\\b/i], ['HO', /\\bho\\b/i]").replace("['HOn30', /\\bhon30\\b/i], ['On30', /\\bon30\\b/i], ", ''), WIZ, PHOTOS);
ok('P4 the specific words no longer come first (HOn30 read as HO) → A6 red', P4.hasList && !P4.fromOk);
const P5 = run(CONFIG.replace("return '';\n}\nif (typeof window !== 'undefined') { window.RR_MANUAL_GAUGES", "return 'TT';\n}\nif (typeof window !== 'undefined') { window.RR_MANUAL_GAUGES"), WIZ, PHOTOS);
ok('P5 the normalizer answers a word off the list → A7 red', P5.hasList && !P5.fromOnlyList);
const P6 = run(CONFIG.replace("'S', 'HO', 'N', 'G'", "'S', 'HO', 'N', 'N', 'G'"), WIZ, PHOTOS);
ok('P6 a duplicate on the list → A5 red', P6.hasList && !P6.noDup);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
