// tests/no_guessed_years_tests.js
// Verifies that _inferMissingYears() has been removed and that American Models /
// S-Helper rows with blank yearProd are never tagged PREWAR.
// Planted offenders: if _inferMissingYears is re-introduced, T2 and T3 fail.
// If the source-scan check is bypassed, T1 fails.
//
// Run:  node tests/no_guessed_years_tests.js
'use strict';

var fs   = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');

// ── helpers ──────────────────────────────────────────────────────────────────
var fails = 0;
function T(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    console.log('PASS  ' + name);
  } else {
    console.log('FAIL  ' + name);
    console.log('      got : ' + JSON.stringify(got));
    console.log('      want: ' + JSON.stringify(want));
    fails++;
  }
}

// Extract a named function from source text via brace matching.
function grab(src, name) {
  var idx = src.indexOf('function ' + name + '(');
  if (idx === -1) idx = src.indexOf('function ' + name + ' (');
  if (idx === -1) return null;
  var open = src.indexOf('{', idx);
  if (open === -1) return null;
  var depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(idx, i + 1);
}

// ── T1: source scan — _inferMissingYears must NOT exist in app-data.js ───────
(function() {
  var src = fs.readFileSync(path.join(ROOT, 'app', 'app-data.js'), 'utf8');
  T('T1  _inferMissingYears absent from app-data.js',
    src.indexOf('_inferMissingYears') === -1, true);
})();

// ── Minimal stub world for browse.js / wizard-suggestions.js ─────────────────
var browseSrc = fs.readFileSync(path.join(ROOT, 'app', 'browse.js'), 'utf8');
var wizSrc    = fs.readFileSync(path.join(ROOT, 'app', 'wizard-suggestions.js'), 'utf8');

// Extract _ERA_KEY_TO_PERIOD (a var block, not a function).
var eraMapSrc = (function() {
  var start = browseSrc.indexOf('var _ERA_KEY_TO_PERIOD');
  var end   = browseSrc.indexOf('\n};\n', start) + 4;
  return browseSrc.slice(start, end);
})();

var itemEraPeriodSrc = grab(browseSrc, '_itemEraPeriod');

// _wizPeriodOfRow lives in wizard.js.
var wizJsSrc    = fs.readFileSync(path.join(ROOT, 'app', 'wizard.js'), 'utf8');
var wizPeriodSrc = grab(wizJsSrc, '_wizPeriodOfRow');

var makerWordSrc  = grab(wizSrc, 'rrRowMakerWord');
var railWordSrc   = grab(wizSrc, 'rrRowRailWord') || 'function rrRowRailWord() { return ""; }';
var scaleOfRowSrc = grab(wizSrc, '_wizScaleOfRow') || 'function _wizScaleOfRow() { return ""; }';
var tagWordsSrc   = grab(wizSrc, 'rrRowTagWords');

var stubEnv = `
(function() {
  var window = {
    RR_ADD_FILTERS: { eraWords: { prewar: 'PREWAR', postwar: 'POSTWAR', modern: 'MODERN' }, tagSep: ' · ' }
  };
  var ERA_TABS    = {};
  var localStorage = { getItem: function() { return null; } };
  var state       = {};

  ${eraMapSrc}
  ${itemEraPeriodSrc}
  ${wizPeriodSrc}

  // Stubs for rrRowMakerWord's dependencies (live in app.js, not loaded here).
  var ERA_MAKER = { prewar: 'lionel', pw: 'lionel', pw_ho: 'lionel',
                    am_s: 'american_models', shelper: 'shelper' };
  var BRAND_LABELS = { lionel: 'Lionel', american_models: 'American Models',
                       shelper: 'S-Helper Service' };
  function _manufacturerOfItem(m) {
    var key = m && m._era ? String(m._era) : '';
    return ERA_MAKER[key] || key;
  }
  function _brandLabel(k) {
    return BRAND_LABELS[k] || String(k || '');
  }

  ${makerWordSrc}
  ${railWordSrc}
  ${scaleOfRowSrc}
  ${tagWordsSrc}

  // ── Test rows ──────────────────────────────────────────────────────────────
  var amRow = {
    itemNum: '1511', yearProd: '', _era: 'am_s',
    makerName: 'American Models', gauge: 'S', railType: ''
  };
  var shRow = {
    itemNum: '1511', yearProd: '', _era: 'shelper',
    makerName: 'S-Helper Service', gauge: 'S', railType: ''
  };
  var lionelRow = {
    itemNum: '1511', yearProd: '1936-1937', _era: 'prewar',
    makerName: 'Lionel', gauge: 'O', railType: '3-Rail'
  };

  T('T2  American Models 1511 period = modern (not prewar)',
    _itemEraPeriod(amRow), 'modern');

  T('T3  S-Helper Service 1511 period = modern (not prewar)',
    _itemEraPeriod(shRow), 'modern');

  T('T4  Lionel Pre-War 1511 period = prewar (unchanged)',
    _itemEraPeriod(lionelRow), 'prewar');

  var amTag = rrRowTagWords(amRow);
  T('T5  American Models 1511 tag does not contain PREWAR',
    amTag.indexOf('PREWAR') === -1, true);

  var shTag = rrRowTagWords(shRow);
  T('T6  S-Helper 1511 tag does not contain PREWAR',
    shTag.indexOf('PREWAR') === -1, true);

  var lionelTag = rrRowTagWords(lionelRow);
  T('T7  Lionel Pre-War 1511 tag contains PREWAR',
    lionelTag.indexOf('PREWAR') !== -1, true);
})();
`;

eval(stubEnv);  // eslint-disable-line no-eval

console.log('');
if (fails === 0) {
  console.log('All no_guessed_years_tests PASSED');
  process.exit(0);
} else {
  console.log(fails + ' test(s) FAILED');
  process.exit(1);
}
