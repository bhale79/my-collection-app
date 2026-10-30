// ══ tests/lib/maker-rule.js — THE one maker-name rule, as config.js defines it ══
//
// v0.9.2053. The Photo Inbox's maker check (_pinMfrAgree) and the Google Photo ID
// cleaner both ask config.js's rrMakerSame / rrMakerName now — one list for the
// whole app (Mike's MTH audit: "M.T.H." and "RailKing" were "a different brand").
// A test that runs Photo Inbox code on its own needs that rule beside it, read
// from config.js itself so it can never be a copy that drifts.
//
//   makerRuleSource()      the source text: RR_MAKER_ALIASES … rrMakerSame
//   installMakerRule(obj)  defines the rule's functions on obj (default: global)
'use strict';
const fs = require('fs'), path = require('path');
const CFG = path.join(__dirname, '..', '..', 'app', 'config.js');

function makerRuleSource(cfgText) {
  const s = cfgText || fs.readFileSync(CFG, 'utf8');
  const a = s.indexOf('const RR_MAKER_ALIASES = {');
  const n = s.indexOf('function rrMakerNorm(mfr) {');
  const w = s.indexOf('const RR_MAKER_WORDS = [');
  const e = s.indexOf('function rrMakerSame(a, b) {');
  if (a < 0 || n < 0 || w < 0 || e < 0) throw new Error('maker-rule: config.js no longer has the maker rule where this helper looks — update tests/lib/maker-rule.js');
  const aliases = s.slice(a, s.indexOf('};', a) + 2);
  // rrMakerNorm through the end of rrMakerSame (brace-matched)
  const o = s.indexOf('{', e); let d = 0, end = -1;
  for (let k = o; k < s.length; k++) { if (s[k] === '{') d++; else if (s[k] === '}') { d--; if (!d) { end = k + 1; break; } } }
  return aliases + '\n' + s.slice(n, end);
}

function installMakerRule(target, cfgText) {
  const t = target || global;
  const f = new Function(makerRuleSource(cfgText)
    + '\nreturn { RR_MAKER_ALIASES: RR_MAKER_ALIASES, rrMakerNorm: rrMakerNorm, RR_MAKER_WORDS: RR_MAKER_WORDS,'
    + ' RR_MAKER_LINE_WORDS: RR_MAKER_LINE_WORDS, rrMakerKey: rrMakerKey, rrMakerName: rrMakerName, rrMakerSame: rrMakerSame };');
  const r = f();
  Object.assign(t, r);
  return r;
}

module.exports = { makerRuleSource, installMakerRule };
