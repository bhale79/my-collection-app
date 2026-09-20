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
const BROWSE = fs.readFileSync(path.join(__dirname, '..', 'app', 'browse.js'), 'utf8');
const LIFTED_PERIOD = (function () {
  function grab(src, sig) {
    const i = src.indexOf(sig);
    let d = 0;
    for (let k = src.indexOf('{', i); k < src.length; k++) {
      if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
    }
    return '';
  }
  // Brace-match the map, never cut at the first ';' — a comment inside it ends
  // the slice early and the Function() then fails to parse for a reason that
  // has nothing to do with what is being tested.
  const mapAt = BROWSE.indexOf('var _ERA_KEY_TO_PERIOD');
  let md = 0, mapEnd = mapAt;
  for (let k = BROWSE.indexOf('{', mapAt); k < BROWSE.length; k++) {
    if (BROWSE[k] === '{') md++;
    else if (BROWSE[k] === '}') { md--; if (!md) { mapEnd = k + 1; break; } }
  }
  const map = BROWSE.slice(mapAt, mapEnd) + ';';
  return new Function('ERA_TABS', map + '\n' + grab(BROWSE, 'function _itemEraPeriod(')
                      + '\nreturn _itemEraPeriod;')({});
})();

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
// v0.9.1794: the slice starts at the PERIOD/SCALE/TYPE helpers now, not at
// _valueBucketOf — the three new cuts live in front of it and the bucket
// functions call them. A slice that starts after the thing it needs is the
// harness lying about what it ran.
const BUCKET = SRC.slice(SRC.indexOf('var _VALUE_PERIODS'), SRC.indexOf('function _eraOf(pd)'))
  + SRC.slice(SRC.indexOf('function _valueModeLabel'), SRC.indexOf('function _dashEdBreakdownSel'));

// A tiny catalog, so the v0.9.1727 resolution has something to resolve against.
const CATALOG = {
  // v0.9.1794: years, gauges and types, because the period / scale / type cuts
  // read them off the CATALOG row — a personal row rarely carries any of the three.
  '2046W': { brand: 'Lionel', era: 'pw',    year: '1950',  gauge: 'O Gauge',  type: 'Steam Locomotive' },
  '9700':  { brand: 'Lionel', era: 'mpc',   year: '1975',  gauge: 'O Gauge',  type: 'Boxcar' },
  '1303':  { brand: 'Atlas',  era: 'atlas', year: '2005',  gauge: 'O Gauge',  type: 'Boxcar' },
  '81153': { brand: 'Lionel', era: 'mpc',   year: '2016',  gauge: 'O Gauge',  type: 'Boxcar' },
  'M1':    { brand: 'MTH',    era: 'mth_o', year: '2008',  gauge: 'O Gauge',  type: 'Steam Locomotive' },
  'W1':    { brand: 'Williams', era: 'williams', year: '2001', gauge: 'O Gauge', type: 'Boxcar' },
  'H1':    { brand: 'Atlas',  era: 'atlas', year: '2011',  gauge: 'HO Scale', type: 'Boxcar' },
  'P1':    { brand: '',       era: 'pw',    year: '1938',  gauge: 'O Gauge',  type: 'Boxcar' },
};

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
    _brandOfItem: (n) => (CATALOG[String(n || '').trim()] || {}).brand || '',
    _manufacturerOfEra: (e) => (e === 'pw' || e === 'mpc') ? 'Lionel' : '',
    findMaster: (n, v, prefer) => {
      const c = CATALOG[String(n || '').trim()];
      return c ? { _era: c.era, yearProd: c.year, gauge: c.gauge, itemType: c.type } : null;
    },
    rrEsc: (s) => String(s == null ? '' : s),
    // v0.9.1794 — the sandbox gains every global the new cuts reach for. A
    // stub standing in for the app must gain each new app global, or the
    // suite reports a bug that only exists in the harness. (Recorded rule;
    // this is its fourth outing.)
    WHAT_I_COLLECT: { SCALES: { o: { label: 'O Gauge' }, ho: { label: 'HO Scale' }, s: { label: 'S Gauge' } } },
    // The REAL _itemEraPeriod, lifted out of browse.js rather than stubbed.
    // A stub of it got this wrong immediately: it parsed years only, so the
    // unlinked instruction sheet — which has no year and falls back to its
    // TAB's era (the v0.9.1728 rule) — landed in Other, and the suite blamed
    // the app for the harness's omission. The real function has a step for
    // exactly that. Lift, do not imitate.
    _itemEraPeriod: LIFTED_PERIOD,
    _scaleOfItem: (it) => {
      const g = String((it && it.gauge) || '').toLowerCase().trim();
      if (!g) return null;
      if (g.charAt(0) === 'o') return 'o';
      if (g.indexOf('ho') === 0) return 'ho';
      if (g.charAt(0) === 's') return 's';
      return null;
    },
    getTypeBucket: (o) => String((o && o.itemType) || '').toLowerCase() || null,
    getTypeBucketLabel: (b) => b ? b.charAt(0).toUpperCase() + b.slice(1) : '',
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
  // The $50 of paper here carries no maker and no item reference, so it lands
  // in Other — checked properly in the v0.9.1727 section below. What matters
  // here is that it was not lost, and the sum pin above proves it.
  ok('[' + mode + '] folding the tail never loses a dollar', sum === GRAND);
});

// ── v0.9.1727 ───────────────────────────────────────────────────
// Brad: "paper and instruction sheets should have a manufacturer." v0.9.1726
// swept all of them into one 'Paper / Sets' line. A Lionel catalog is Lionel
// value, and a service sheet for a 2046W belongs beside the 2046W.
section('Paper, sheets and sets land on their maker');
{
  const mixed = {
    personalData: { a: { owned: true, itemNum: '2046W', era: 'pw', manufacturer: 'Lionel', userEstWorth: '100' } },
    // Paper carries its own manufacturer column.
    ephemeraData: {
      paper:    { p1: { estValue: '40', manufacturer: 'Lionel' },
                  p2: { estValue: '30', manufacturer: 'Atlas' } },
      catalogs: { c1: { estValue: '20', itemNum: '9700' } },       // resolves by its own number
    },
    // An instruction sheet names the item it belongs to.
    isData:    { i1: { estValue: '10', linkedItem: '2046W' } },
    scienceData:      { s1: { estValue: '5', itemNum: '1303' } },
    constructionData: { k1: { estValue: '7' } },                   // nothing to go on
  };
  const TOT = 100 + 40 + 30 + 20 + 10 + 5 + 7;

  const hm = mkCompute('maker')(mixed, 0).html;
  ok('the catch-all Paper / Sets line is GONE', !/Paper \/ Sets/.test(hm), hm.replace(/<[^>]+>/g, ' ').trim());
  ok('paper uses its own manufacturer column — Lionel paper joins Lionel',
     money(hm).includes(100 + 40 + 20 + 10), 'expected $' + (100 + 40 + 20 + 10));
  ok('…and Atlas paper joins Atlas, not Lionel', /Atlas/.test(hm) && money(hm).includes(30 + 5));
  ok('an instruction sheet resolves through the item it is FOR', money(hm).includes(100 + 40 + 20 + 10));
  ok('a catalog resolves through its own number', money(hm).includes(100 + 40 + 20 + 10));
  ok('something with nothing to go on still gets a line', /Other/.test(hm) && money(hm).includes(7));
  ok('[maker] the lines still add up', money(hm).slice(1).reduce((a, b) => a + b, 0) === TOT);

  const he = mkCompute('era')(mixed, 0).html;
  // v0.9.1794 RE-PIN: the era cut lists PERIODS now, not era tabs. [stated]
  // "value by era should be pre war, postwar, modern." The RULE is unchanged —
  // a sheet still resolves through the item it is for, a catalog through its
  // own number — only the line it lands on is now the period.
  ok('by era, a sheet lands in its item\'s period', /Postwar/.test(he) && money(he).includes(100 + 10));
  ok('…a catalog in its own (1975 -> Modern), with a science set (2005) beside it',
     /Modern/.test(he) && money(he).includes(20 + 5));
  ok('…and the old era-TAB labels are gone', !/Lionel Postwar|Lionel MPC\/Modern|Atlas O/.test(he));
  ok('paper with a maker but no item number cannot claim an era — it goes to Other',
     /Other/.test(he) && money(he).includes(40 + 30 + 7));
  ok('[era] the lines still add up', money(he).slice(1).reduce((a, b) => a + b, 0) === TOT);
}

section('Manufacturer');
{
  const h = mkCompute('maker')(STATE, 0).html;
  // 22830 postwar + 1170 mpc + 75 (no maker saved, resolved via its era)
  // + 10 (v0.9.1728: the unlinked instruction sheet falls back to postwar,
  // and postwar's maker is Lionel).
  const LIONEL = 22830 + 1170 + 75 + 10;
  ok('rolls both Lionel eras into ONE Lionel line', /Lionel/.test(h) && money(h).includes(LIONEL));
  ok('…including a row with no maker saved, via its era — that is the $75',
     money(h).includes(LIONEL) && !money(h).includes(22830 + 1170));
  ok('names the cut on the card, so a screenshot is self-explanatory', /by manufacturer/.test(h));
  // Pittman ($300) is the 7th bucket here, so it is correctly folded into
  // Other. What must be true either way is that its money did not join
  // Lionel's line — a fallback that grabbed too much would show 24,375.
  ok('a named maker is never swept into Lionel by the era fallback',
     !money(h).includes(LIONEL + 300));
}

section('Era');
{
  const h = mkCompute('era')(STATE, 0).html;
  // v0.9.1794 RE-PIN, and this is the ask itself: [stated] "value by era should
  // be pre war, postwar, modern. modern is all manufactures in the mpc era for
  // example, atlas, lionel mpc, mth all added together."
  ok('the lines are the three PERIODS, not era tabs',
     /Pre-war/.test(h) && /Postwar/.test(h) && /Modern/.test(h));
  ok('…and no era-TAB label survives', !/Lionel Postwar|Lionel MPC\/Modern|Atlas O|MTH O|Williams O/.test(h));
  // THE POINT OF THE CHANGE: Lionel MPC + Atlas + Williams + MTH on ONE line.
  ok('Modern adds every maker of that period together — what he could not see before',
     money(h).includes(1170 + 1270 + 1000 + 475 + 425 + 165), '1170+1270+1000+475+425+165');
  ok('Postwar carries every postwar row whoever made it, plus the unlinked sheet',
     money(h).includes(22830 + 75 + 10));
  ok('a 1938 row is Pre-war, and on its own line', money(h).includes(300));
  ok('names the cut', /by era/.test(h));
}

// ── v0.9.1728 ───────────────────────────────────────────────────
// Brad: "the only instruction sheets we have are lionel from the postwar
// era… now instruction sheets CAN be from other eras but the ones in our
// master list are postwar." Both halves are pinned: a sheet that names its
// item still resolves on its own, whatever era that item is, and only an
// UNLINKED sheet falls back to postwar.
section('An unlinked instruction sheet falls back to postwar');
{
  const sheets = {
    personalData: {},
    ephemeraData: {},
    isData: {
      linked:   { estValue: '10', linkedItem: '9700' },   // MPC/Modern item
      unlinked: { estValue: '20' },                       // nothing to go on
    },
    scienceData: {}, constructionData: {},
  };
  const he = mkCompute('era')(sheets, 0).html;
  // v0.9.1794 RE-PIN — same rule, period labels. The second half matters most:
  // an unlinked sheet has no year, so only the v0.9.1728 tab fallback can place
  // it. A FIRST ATTEMPT AT THIS CUT PUT IT IN "Other", and the harness's own
  // stub of _itemEraPeriod hid it — the real function has a step for exactly
  // this case, which is why the suite lifts it now instead of imitating it.
  ok('a sheet that NAMES its item keeps that item\'s period, not postwar',
     /Modern/.test(he) && money(he).includes(10), he.replace(/<[^>]+>/g, ' ').trim());
  ok('an UNLINKED sheet still falls back to Postwar, not Other',
     /Postwar/.test(he) && money(he).includes(20) && !/Other/.test(he));

  const hm = mkCompute('maker')(sheets, 0).html;
  ok('by maker, the unlinked sheet is Lionel — derived FROM the fallback era',
     /Lionel/.test(hm) && !/Other/.test(hm));
  ok('…and both sheets land on the one Lionel line', money(hm).includes(30));
  ok('the sum still holds', money(hm).slice(1).reduce((a, b) => a + b, 0) === 30);
  ok('only the instruction-sheet tab gets a fallback',
     /_extraWalk\(Object\.values\(state\.isData\|\|\{\}\), 'linkedItem', 'pw'\)/.test(SRC)
     && /_extraWalk\(Object\.values\(state\.scienceData\|\|\{\}\), 'itemNum'\)/.test(SRC));
}

// ── v0.9.1728: the Paper ADD flow finally asks ──────────────────
// The column has existed since the tab was built and the Edit form has always
// changed it, but wizard-save's `d.eph_manufacturer || 'Lionel'` had no writer,
// so every paper item arrived labelled Lionel.
section('Paper add: Manufacturer is asked for');
{
  const WIZ = fs.readFileSync(path.join(__dirname, '..', 'app', 'wizard.js'), 'utf8');
  const step = WIZ.slice(WIZ.indexOf("} else if (s.type === 'paperExtras') {"), WIZ.indexOf("} else if (s.type === 'pricePaid') {"));
  ok('the step writes eph_manufacturer — the field wizard-save already reads',
     /wizard\.data\.eph_manufacturer=this\.value/.test(step));
  ok('it is pre-filled, so adding Lionel paper costs no extra taps',
     /wizard\.data\.eph_manufacturer \|\| 'Lionel'/.test(step));
  ok('a datalist offers the makers the app knows',
     /list="pe-mfr-list"/.test(step) && /WHAT_I_COLLECT\.MANUFACTURERS/.test(step));
  ok('…but it is a TEXT box, so an unlisted maker is not a dead end',
     /<input type="text" id="pe-mfr"/.test(step));
  ok('the maker label is escaped', /rrEsc\(\(_M\[k\] && _M\[k\]\.label\)/.test(step));
  ok('the maker list is guarded — a missing config cannot break the step',
     /typeof WHAT_I_COLLECT !== 'undefined'/.test(step));
  ok('the step stays optional, exactly as it was',
     /All fields optional/.test(step));
  // wizard.js is AT its colour budget (238 of 238).
  ok('the new field uses colour TOKENS only',
     !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(step.slice(step.indexOf('Manufacturer'), step.indexOf('Est. Worth'))));
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

// ═══════════════════════════════════════════════════════════════
// v0.9.1794 — BY SCALE, AND BY TYPE WITHIN A SCALE.
//
// [stated] "should also have a value by scale, all o, all g, all ho.......etc.
// should also have value by type and scale. so select the scale, and then list
// all values by type, so all o scale boxcars, all o scale engines...etc"
// ═══════════════════════════════════════════════════════════════
section('By scale');
{
  const h = mkCompute('scale')(STATE, 0).html;
  ok('names the cut', /by scale/.test(h));
  ok('every O-gauge row adds together, whatever its maker or era', money(h).includes(27045));
  ok('a row whose scale cannot be resolved still gets a line, so the sum holds',
     /Other/.test(h) && money(h).includes(715));
  ok('[scale] the lines add up to the total above them',
     money(h).slice(1).reduce((a, b) => a + b, 0) === GRAND, String(GRAND));
  ok('uses the scale LABELS from the config, not the internal ids',
     /O Gauge/.test(h) && !/>o</.test(h));
}

section('By type, within one scale');
{
  const h = mkCompute('type:o')(STATE, 0).html;
  ok('names the cut AND the scale it is scoped to', /by type — O Gauge/.test(h));
  ok('all the O-gauge engines on one line', money(h).includes(23305));
  ok('…and all the O-gauge boxcars on another', money(h).includes(3740));
  // THE INVARIANT THIS CARD LEARNED THE HARD WAY (v0.9.1553): the lines must
  // sum to the total printed above them. A cut scoped to ONE scale could not,
  // so everything outside it lands on one honest line rather than vanishing.
  ok('everything outside the chosen scale is ONE honest line, not dropped',
     /Other scales/.test(h) && money(h).includes(715));
  ok('[type] the lines STILL add up to the total — the rule this card never breaks',
     money(h).slice(1).reduce((a, b) => a + b, 0) === GRAND, String(GRAND));

  const hHo = mkCompute('type:ho')(STATE, 0).html;
  ok('choosing a different scale re-scopes the whole card', /by type — HO Scale/.test(hHo));
  ok('…and with nothing owned in it, everything is Other scales and the total still holds',
     money(hHo).slice(1).reduce((a, b) => a + b, 0) === GRAND);
}

section('Every cut keeps the card\'s one unbreakable promise');
{
  // v0.9.1553 cost $34,430 of Brad's collection going missing from his own
  // total. Whatever cut is chosen, the lines must sum to the number above them.
  ['era', 'maker', 'scale', 'type:o', 'type:ho', 'type:s'].forEach(function (mode) {
    const h = mkCompute(mode)(STATE, 0).html;
    ok('[' + mode + '] sums to the total', money(h).slice(1).reduce((a, b) => a + b, 0) === GRAND);
  });
  const r = mkCompute('')(STATE, 0);
  ok('and "total only" is still untouched by any of it', r.value === '$' + GRAND.toLocaleString() && !r.html);
}

section('The chooser lives in Edit Dashboard, and only on this card');
ok('the Collection Value tile carries the picker', /entry\.id === 'value'\) \? _dashEdBreakdownSel/.test(SRC));
// v0.9.1794 RE-PIN: four cuts now, and the type options are BUILT from
// WHAT_I_COLLECT.SCALES rather than typed out — a hand-kept list of scales is
// the same mistake as a hand-kept list of files or a hand-typed version.
ok('four cuts: total only, era, manufacturer, scale — plus one per scale for type',
   /\['', 'Total only'\]/.test(SRC) && /\['era', 'By era/.test(SRC)
   && /\['maker', 'By manufacturer'\]/.test(SRC) && /\['scale', 'By scale'\]/.test(SRC));
ok('…the per-scale type options are derived from the scale config, not typed',
   /Object\.keys\(WHAT_I_COLLECT\.SCALES\)\.forEach/.test(SRC)
   && /'type:' \+ id/.test(SRC));
ok('…so it is still ONE selector on the card, as he asked',
   (SRC.match(/_dashEdBreakdownSel\(/g) || []).length === 2);
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
