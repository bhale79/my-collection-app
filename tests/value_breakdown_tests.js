// ═══════════════════════════════════════════════════════════════
// value_breakdown_tests.js — v0.9.1726.
//
// Brad, 2026-09-12: "the small collection value card. underneath the total
// number, can we break it down by Manufacturer or by era. let the user choose
// in the edit card menu."
//
// THE PIN THAT MATTERS IS THE SUM. This card has been wrong in public once
// already: until v0.9.1553 the total ended `.filter(_pdEraEnabled)`, so any
// item whose maker was unticked under Preferences → What I Collect silently
// left the total — $34,430 of Brad's own collection, under the word Total,
// while three other sources agreed with each other and not with it.
//
// A breakdown is the same trap with more places to hide: six lines that look
// authoritative and quietly do not add up. So the buckets are filled in the
// SAME pass that builds the total, from the same number, and the tests below
// check the arithmetic rather than the wording.
//
// Run:  node tests/value_breakdown_tests.js
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  -> ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'dashboard.js'), 'utf8');

// ── the real compute, lifted out and RUN ────────────────────────
const CARD0 = SRC.indexOf("id: 'value', label: 'Collection Value'");
// Brace-match the compute body rather than slicing to the next card: the card
// object's own closing braces would come along and the Function() would not
// parse. Matching means this keeps working when the card moves.
function bodyAt(from) {
  const open = SRC.indexOf('{', SRC.indexOf('compute: function(state)', from));
  let depth = 0;
  for (let i = open; i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}') { depth--; if (!depth) return SRC.slice(open + 1, i); }
  }
  throw new Error('unbalanced compute body');
}
const COMPUTE = bodyAt(CARD0);
const BUCKET = SRC.slice(SRC.indexOf('function _valueBucketOf'), SRC.indexOf('function _eraOf(pd)'));

const ERAS = {
  pw:   { label: 'Lionel Postwar' },
  mpc:  { label: 'Lionel MPC/Modern' },
  atlas:{ label: 'Atlas O' },
  mth_o:{ label: 'MTH O' },
  rmt:  { label: 'RMT O' },
  menards: { label: 'Menards O' },
  williams:{ label: 'Williams O' },
  all:  { label: 'All', _isAll: true },
};

function mkCompute(mode) {
  const env = {
    ERAS,
    _getSlots: () => [{ id: 'value', breakdown: mode }],
    _currencySymbol: () => '$',
    _eraOf: (pd) => pd.era || '',
    _brandOfItem: () => '',
    _manufacturerOfEra: (e) => (e === 'pw' || e === 'mpc') ? 'Lionel' : '',
    rrEsc: (s) => String(s == null ? '' : s),
  };
  const names = Object.keys(env);
  const body = BUCKET + '\nreturn function (state) {' + COMPUTE + '};';
  return new Function(...names, body)(...names.map(n => env[n]));
}

// Brad's real numbers, read out of his live app on 2026-09-12.
const STATE = {
  personalData: {
    a: { owned: true, itemNum: '2046W', era: 'pw',    manufacturer: 'Lionel',   userEstWorth: '22830' },
    b: { owned: true, itemNum: '81153', era: 'mpc',   manufacturer: 'Lionel',   userEstWorth: '1170' },
    c: { owned: true, itemNum: '1303',  era: 'atlas', manufacturer: 'Atlas',    userEstWorth: '1270' },
    d: { owned: true, itemNum: 'W1',    era: 'williams', manufacturer: 'Williams', userEstWorth: '1000' },
    e: { owned: true, itemNum: 'M1',    era: 'mth_o', manufacturer: 'MTH',      userEstWorth: '475' },
    f: { owned: true, itemNum: 'N1',    era: 'menards', manufacturer: 'Menards', userEstWorth: '425' },
    g: { owned: true, itemNum: 'R1',    era: 'rmt',   manufacturer: 'RMT',      userEstWorth: '165' },
    h: { owned: true, itemNum: 'P1',    era: 'pw',    manufacturer: 'Pittman',  userEstWorth: '300' },
    i: { owned: true, itemNum: 'Z1',    era: 'pw',    manufacturer: '',         userEstWorth: '75' },
    j: { owned: true, itemNum: 'NOVAL', era: 'pw',    manufacturer: 'Lionel',   userEstWorth: '' },
    k: { owned: false, itemNum: 'SOLD', era: 'pw',    manufacturer: 'Lionel',   userEstWorth: '9999' },
  },
  ephemeraData: { box1: { p1: { estValue: '40' } } },
  isData: { i1: { estValue: '10' } },
  scienceData: {},
  constructionData: {},
};
const GRAND = 22830 + 1170 + 1270 + 1000 + 475 + 425 + 165 + 300 + 75 + 40 + 10;   // 27760

const money = (h) => (h.match(/\$[\d,]+/g) || []).map(s => parseInt(s.replace(/[$,]/g, ''), 10));

(async function () {

section('The total is untouched');
{
  const r = mkCompute('')(STATE, 0);
  ok('with no breakdown the card looks exactly as it did', r.value === '$' + GRAND.toLocaleString() && r.sub === 'estimated worth',
     r.value + ' / ' + r.sub);
  ok('…and returns value+sub, not html, so nothing about its layout changed', !r.html);
}
['maker', 'era'].forEach(mode => {
  const r = mkCompute(mode)(STATE, 0);
  const nums = money(r.html);
  ok('[' + mode + '] the headline total is unchanged by asking for a breakdown',
     nums[0] === GRAND, '$' + nums[0]);
  // THE test. Everything below the headline must add up to it.
  const lines = nums.slice(1);
  const sum = lines.reduce((a, b) => a + b, 0);
  ok('[' + mode + '] THE LINES ADD UP TO THE TOTAL', sum === GRAND, sum + ' vs ' + GRAND);
  ok('[' + mode + '] an item you no longer own is in neither', !r.html.includes('9,999') && nums[0] !== GRAND + 9999);
  ok('[' + mode + '] an item with no Est. Worth adds no line and no dollars', sum === GRAND);
  // In THIS fixture there are nine buckets, so the smallest — Paper / Sets at
  // $50 — is correctly folded into Other. Its own line is checked below, on a
  // collection with room for it. What matters here is that folding it did not
  // lose it, and the sum pin above already proves that.
  ok('[' + mode + '] folding the tail never loses a dollar', sum === GRAND);
});

section('Paper / Sets, on a collection with room for it');
{
  const small = {
    personalData: { a: { owned: true, itemNum: 'A', era: 'pw', manufacturer: 'Lionel', userEstWorth: '100' } },
    ephemeraData: { b: { p: { estValue: '40' } } }, isData: { i: { estValue: '10' } },
    scienceData: {}, constructionData: {},
  };
  const h = mkCompute('maker')(small, 0).html;
  ok('paper and instruction sheets get their own honest line',
     /Paper \/ Sets/.test(h) && money(h).includes(50), h.replace(/<[^>]+>/g, ' ').trim());
  ok('…and they are NOT guessed into a maker', !/Lionel<\/span><span[^>]*>\$150/.test(h));
  ok('the total still includes them', money(h)[0] === 150);
}

section('Manufacturer');
{
  const h = mkCompute('maker')(STATE, 0).html;
  ok('rolls both Lionel eras into ONE Lionel line', /Lionel/.test(h) && money(h).includes(22830 + 1170 + 75));
  ok('…including a row with no maker saved, via its era — that is the $75',
     money(h).includes(22830 + 1170 + 75) && !money(h).includes(22830 + 1170));
  ok('names the cut on the card, so a screenshot is self-explanatory', /by manufacturer/.test(h));
  // Pittman ($300) is the 7th bucket here, so it is correctly folded into
  // Other. What must be true either way is that its money did not join
  // Lionel's line — a fallback that grabbed too much would show 24,375.
  ok('a named maker is never swept into Lionel by the era fallback',
     !money(h).includes(22830 + 1170 + 75 + 300));
}

section('Era');
{
  const h = mkCompute('era')(STATE, 0).html;
  ok('uses the era LABELS, not the internal keys', /Lionel Postwar/.test(h) && !/>pw</.test(h));
  ok('keeps Postwar and MPC/Modern apart — the whole point of this cut',
     /Lionel Postwar/.test(h) && /Lionel MPC\/Modern/.test(h));
  ok('Postwar carries every postwar row, whoever made it', money(h).includes(22830 + 300 + 75));
  ok('names the cut', /by era/.test(h));
}

section('Six lines, then Other — and the sum still holds');
{
  const many = { personalData: {}, ephemeraData: {}, isData: {}, scienceData: {}, constructionData: {} };
  let expect = 0;
  for (let n = 0; n < 12; n++) {
    many.personalData['x' + n] = { owned: true, itemNum: 'X' + n, era: 'pw', manufacturer: 'Maker' + n, userEstWorth: String((12 - n) * 100) };
    expect += (12 - n) * 100;
  }
  const r = mkCompute('maker')(many, 0);
  const nums = money(r.html);
  ok('never more than six lines on a small card', nums.length - 1 === 6, (nums.length - 1) + ' lines');
  ok('the tail is FOLDED into Other, not dropped — the sum survives',
     nums.slice(1).reduce((a, b) => a + b, 0) === expect, nums.slice(1).reduce((a, b) => a + b, 0) + ' vs ' + expect);
  ok('biggest first', nums[1] >= nums[2] && nums[2] >= nums[3]);
}

section('The chooser lives in Edit Dashboard, and only on this card');
ok('the Collection Value tile carries the picker', /entry\.id === 'value'\) \? _dashEdBreakdownSel/.test(SRC));
ok('three choices: total only, manufacturer, era',
   /\[\['', 'Total only'\], \['maker', 'By manufacturer'\], \['era', 'By era'\]\]/.test(SRC));
ok('the mode is stored on the SLOT, like Catalog Coverage pins its era',
   /_dEd\.s\[i\]\.breakdown = v; else delete _dEd\.s\[i\]\.breakdown/.test(SRC));
ok('nothing persists until Save — a cancelled edit changes nothing',
   !/_saveSlots/.test(SRC.slice(SRC.indexOf('function _dashEdBreakdown'), SRC.indexOf('function _dashEdBreakdown') + 400)));
ok('the dropdown is reachable inside a draggable tile',
   /draggable="false"/.test(SRC) && /onclick="event\.stopPropagation\(\)" ondragstart="event\.stopPropagation\(\)"/.test(SRC));
ok('the handler is exposed for the inline onchange', /window\._dashEdBreakdown = _dashEdBreakdown/.test(SRC));

section('The v0.9.1553 lesson is not quietly undone');
{
  // The v0.9.1553 note inside this card QUOTES `.filter(_pdEraEnabled)` while
  // explaining why it was removed, so the pin has to read code, not prose.
  const code = COMPUTE.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  ok('the breakdown does NOT re-apply the What I Collect filter',
     !/_pdEraEnabled|_isEraEnabled/.test(code), 'a filter crept back into the value card');
}
ok('buckets are filled in the SAME pass as the total, from the same number',
   /total \+= v;\s*\n\s*if \(_mode\) _vAdd\(_valueBucketOf\(pd, _mode\), v\);/.test(COMPUTE));
{
  const helpLine = SRC.slice(SRC.indexOf("  value: 'Adds up"), SRC.indexOf("  catalog: '"));
  ok('the VALUE card help no longer claims the filter applies',
     !/Only eras enabled under Preferences/.test(helpLine)
     && /narrows the catalog you browse, not what your collection is worth/.test(helpLine));
  ok('…and the Items I Own help, which DOES filter, still says so',
     /Only eras enabled under Preferences/.test(SRC.slice(SRC.indexOf("  owned: 'Counts every"), SRC.indexOf("  value: 'Adds up"))));
}
// Colour budget: dashboard.js is at 95 of 96. One literal of headroom, and it
// stays that way — the new markup is tokens only.
{
  const added = SRC.slice(SRC.indexOf('function _valueBreakdownLines'), SRC.indexOf('function _eraOf(pd)'))
    + SRC.slice(SRC.indexOf('function _dashEdBreakdownSel'), SRC.indexOf('function _dashEdBreakdown'));
  ok('the new markup uses colour TOKENS only', !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(added));
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

})();
