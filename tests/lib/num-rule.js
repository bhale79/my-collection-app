// ═══════════════════════════════════════════════════════════════════════════
// tests/lib/num-rule.js — THE product-line prefix rule, read from app/app.js
// (numspell, 2026-11-10). Lionel writes a modern number two ways — 6-18319
// and 18319 — and every place in the app asks ONE rule which spellings are
// the same number: rrNumBare / rrNumFull / rrNumSame / rrNumSpellings.
//
// A suite that runs real app code in a sandbox (vm, eval, a harness page)
// loads the rule from here, exactly as app.js writes it — never a copy:
//   numRuleSource(appSrc?)   the two settings + the four functions, as source
//   numRuleGlobal(appSrc?)   the same, written so a plain eval() puts every
//                            name on `global` (for suites that eval into Node)
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const APPJS = path.join(__dirname, '..', '..', 'app', 'app.js');
function grab(src, head) {
  const i = src.indexOf(head);
  if (i < 0) throw new Error('num-rule: missing ' + head + ' in app.js');
  let d = 0;
  const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('num-rule: unbalanced ' + head);
}
function numRuleSource(appSrc) {
  const s = appSrc || fs.readFileSync(APPJS, 'utf8');
  const line = (head) => { const a = s.indexOf(head); if (a < 0) throw new Error('num-rule: missing ' + head + ' in app.js'); return s.slice(a, s.indexOf('\n', a)); };
  return [line('var RR_NUM_PREFIX = '), line('var RR_NUM_PREFIX_ERAS = '),
    grab(s, 'function rrNumBare('), grab(s, 'function rrNumFull('),
    grab(s, 'function rrNumSame('), grab(s, 'function rrNumSpellings(')].join('\n');
}
function numRuleGlobal(appSrc) {
  return numRuleSource(appSrc)
    .replace(/^var (RR_NUM_\w+)/gm, 'global.$1')
    .replace(/^function (rrNum\w+)/gm, 'global.$1 = function');
}
module.exports = { numRuleSource, numRuleGlobal };
