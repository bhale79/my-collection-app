// ══ tests/lib/row-kind.js — THE "is this catalog row the thing itself?" rule ══
//
// 2026-11-07 (onerow). app-data.js rrRowKind decides whether a catalog row is
// the item or a promo / paper / box / part / set row that shares its number;
// findMaster, the Photo Inbox, My Collection, the dashboard and the Trainz
// button all ask it. Its words live in config.js RR_ROW_KIND_WORDS. A test that
// runs findMaster / _findMasterCore / Photo Inbox code on its own needs the
// REAL rule beside it — read from the app's own files here, never a copy.
//
//   rowKindSource()   source text: RR_ROW_KIND_WORDS, _rrEraKeyOf, rrRowKind,
//                     rrDemotedRow, _rrLookupDemoted, _rrPreferWantsDemoted,
//                     _rrPreferEraKey  (eval it, or put it inside a new Function)
//   installRowKind(t) defines them on t (default: global)
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', '..', 'app');

function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('row-kind: ' + name + ' is not where this helper looks — update tests/lib/row-kind.js');
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('row-kind: unbalanced ' + name);
}
function rowKindSource(cfgText, dataText) {
  const cfg = cfgText || fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
  const dat = dataText || fs.readFileSync(path.join(APP, 'app-data.js'), 'utf8');
  const pdl = fs.readFileSync(path.join(APP, 'wizard-pdlookup.js'), 'utf8');
  const a = cfg.indexOf('const RR_ROW_KIND_WORDS = {');
  if (a < 0) throw new Error('row-kind: config.js has no RR_ROW_KIND_WORDS');
  let d = 0, end = -1;   // brace-matched — never "the next };"
  for (let k = cfg.indexOf('{', a); k < cfg.length; k++) { if (cfg[k] === '{') d++; else if (cfg[k] === '}') { d--; if (!d) { end = k + 1; break; } } }
  const words = cfg.slice(a, end).replace('const ', 'var ') + ';';
  return [words, grabFn(pdl, '_rrEraKeyOf'), grabFn(dat, 'rrRowKind'), grabFn(dat, 'rrDemotedRow'), grabFn(dat, '_rrLookupDemoted'),
    grabFn(dat, '_rrPreferWantsDemoted'), grabFn(dat, '_rrPreferEraKey')].join('\n');
}
// the functions only — for a sandbox that already ran config.js (RR_ROW_KIND_WORDS is a const there)
function rowKindFnSource(dataText) {
  const dat = dataText || fs.readFileSync(path.join(APP, 'app-data.js'), 'utf8');
  const pdl = fs.readFileSync(path.join(APP, 'wizard-pdlookup.js'), 'utf8');
  return [grabFn(pdl, '_rrEraKeyOf'), grabFn(dat, 'rrRowKind'), grabFn(dat, 'rrDemotedRow'), grabFn(dat, '_rrLookupDemoted'),
    grabFn(dat, '_rrPreferWantsDemoted'), grabFn(dat, '_rrPreferEraKey'), grabFn(dat, '_rrRealRowsOf')].join('\n');
}
function installRowKind(target, cfgText, dataText) {
  const t = target || global;
  const r = new Function(rowKindSource(cfgText, dataText)
    + '\nreturn { RR_ROW_KIND_WORDS: RR_ROW_KIND_WORDS, _rrEraKeyOf: _rrEraKeyOf, rrRowKind: rrRowKind, rrDemotedRow: rrDemotedRow,'
    + ' _rrLookupDemoted: _rrLookupDemoted, _rrPreferWantsDemoted: _rrPreferWantsDemoted, _rrPreferEraKey: _rrPreferEraKey };')();
  Object.assign(t, r);
  return r;
}
module.exports = { rowKindSource, rowKindFnSource, installRowKind, grabFn };
