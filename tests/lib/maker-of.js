// ══ tests/lib/maker-of.js — THE one maker rule for an item, as app.js defines it ══
//
// 2026-11-03 (PLAN_2026-11-03_NO_QUIET_MAKER — [stated] Brad: "we dont need to
// quielty fill anything. thats an issue"). Every save, list and send that names
// an item's maker asks app.js's rrMakerOf. A test that runs one app file on its
// own (a vm sandbox, a lifted function) needs the REAL rule beside it — read out
// of app.js here, never a hand-written stand-in that can drift.
//
//   makerOfSource([names])      the source text of the named functions
//                               (default: rrCopyCatalogRow, rrMakerOf,
//                               rrCopyIsUnlinked, rrKnownMakers), brace-matched
//   installMakerOf(sandbox)     runs that source INSIDE a vm context, so the
//                               rule sees the sandbox's own findMaster,
//                               _preferEraOf and _brandOfItem
//
// The rule reaches for findMaster, _preferEraOf and _brandOfItem at call time.
// A sandbox that has none of them still gets a working rule: no catalog row is
// ever found, so the answer is the chosen maker, else the saved one, else ''.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', '..', 'app', 'app.js');
const DEFAULT = ['rrCopyCatalogRow', 'rrMakerOf', 'rrCopyIsUnlinked', 'rrKnownMakers'];

function liftFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('maker-of: app/app.js has no function ' + name + ' — update tests/lib/maker-of.js');
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) break; } }
  return src.slice(i, k + 1);
}

function makerOfSource(names, appText) {
  const s = appText || fs.readFileSync(APP, 'utf8');
  return (names || DEFAULT).map(n => liftFn(s, n)).join('\n');
}

function installMakerOf(sandbox, names) {
  const list = names || DEFAULT;
  if (!vm.isContext(sandbox)) vm.createContext(sandbox);
  vm.runInContext(makerOfSource(list) + '\n' + list.map(n => 'this.' + n + ' = ' + n + ';').join('\n'), sandbox);
  return sandbox;
}

module.exports = { makerOfSource, installMakerOf, liftFn };
