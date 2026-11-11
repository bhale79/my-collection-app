// ══ tests/lib/findmaster-real.js — the REAL findMaster, both layers, in a box ══
//
// stdmodern (2026-11-08). findMaster (app-data.js) is THE lookup chokepoint;
// its answer depends on the loaded index (Layer 1), the whole-catalog index
// (Layer 2), the Row ID / Master Key links, the scorer (_findMasterCore) and
// — since stdmodern C2 — the "Also Sold As" rule (rrRowAlsoSoldBy, app.js).
// This builds all of it from the app's OWN files (or from planted copies of
// them) into one sandbox, so a test can ask the real question end to end:
//
//   const fm = buildFindMaster({ layer1: rows, layer2: rows, eras, eraTabs, dat, app, cfg, indexComplete });
//   fm.findMaster('11-1005', '', pd)
//
// dat / app: the source text of app-data.js / app.js (defaults: the real files).
// scale: { ERA_SCALE, ERA_TO_SCALE, ERA_SCALES_MULTI, RR_LINE_ROW_SCALES,
//   CHIP_LABEL } — when given, the app's ONE row-scale rule (rrRowEraScale and
//   the functions under it) is loaded too, so findMaster's scale hint is real.
// The period of a row is the app's own _itemEraPeriod (browse.js), always.
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', '..', 'app');
const rowKind = require('./row-kind');

function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('findmaster-real: ' + name + ' is not where this helper looks');
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('findmaster-real: unbalanced ' + name);
}
function grabIf(src, name) { try { return grab(src, name); } catch (e) { return ''; } }

// RR_BOOK_COPY_REDIRECT as config.js (or a planted copy of it) writes it.
function bookCopyTable(o) {
  const cfg = o.cfg || fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
  const i = cfg.indexOf('const RR_BOOK_COPY_REDIRECT = ');
  if (i < 0) return '';
  const j = cfg.indexOf('\n};\n', i);
  return 'var ' + cfg.slice(i + 'const '.length, j + 3);
}
// The redirect's own module state, as app-data.js declares it — never a copy, so
// an app-data.js that lost the declaration fails here as it would in the app.
function bookCopyState(dat) {
  const m = /^var _rrBcIdx = [^\n]*;$/m.exec(dat);
  return m ? m[0] : '';
}

function index(rows) {
  const m = new Map();
  (rows || []).forEach(r => { const k = String(r.itemNum).trim(); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
  return m;
}

function buildFindMaster(o) {
  o = o || {};
  const dat = o.dat || fs.readFileSync(path.join(APP, 'app-data.js'), 'utf8');
  const app = o.app || fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
  const wiz = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
  const pdl = fs.readFileSync(path.join(APP, 'wizard-pdlookup.js'), 'utf8');
  const brw = fs.readFileSync(path.join(APP, 'browse.js'), 'utf8');
  const pa = brw.indexOf('var _ERA_KEY_TO_PERIOD = {');
  if (pa < 0) throw new Error('findmaster-real: _ERA_KEY_TO_PERIOD is not where this helper looks');
  let pd = 0, pz = -1;
  for (let k = brw.indexOf('{', pa); k < brw.length; k++) { if (brw[k] === '{') pd++; else if (brw[k] === '}') { pd--; if (!pd) { pz = k + 1; break; } } }
  const sc = o.scale || null;
  const body = [
    'var _lkCache = new WeakMap(), _zkCache = new WeakMap();',
    rowKind.rowKindSource(null, dat),
    grab(pdl, '_pdLookupKey'), grab(pdl, 'rrSameVar'),   // zerobridge: rrSameVar calls _pdLookupKey (a saved copy WITH a variation)
    grab(app, 'rrNumZeroKey'), grab(app, 'rrNumZeroTwin'),
    require('./num-rule').numRuleSource(),   // numspell: the ONE product-line prefix rule findMaster asks
    grab(app, 'rrAlsoSoldAsNames'), grab(app, '_rrMakerWord'), grab(app, 'rrRowAlsoSoldBy'),
    brw.slice(pa, pz) + ';', grab(brw, '_itemEraPeriod'),
    grab(wiz, '_wizPeriodOfYear'), grab(wiz, '_wizPeriodOfRow'),
    sc ? ('var WHAT_I_COLLECT = { ERA_TO_SCALE: ' + JSON.stringify(sc.ERA_TO_SCALE || {}) + ' }, ERA_SCALE = ' + JSON.stringify(sc.ERA_SCALE || {})
      + ', ERA_SCALES_MULTI = ' + JSON.stringify(sc.ERA_SCALES_MULTI || {}) + ', RR_LINE_ROW_SCALES = ' + JSON.stringify(sc.RR_LINE_ROW_SCALES || {})
      + ', _RR_CHIP_SCALE_LABEL = ' + JSON.stringify(sc.CHIP_LABEL || {}) + ';\n'
      + 'function _itemEraKey(it) { return String((it && (it._era || it.era)) || "").toLowerCase(); }\n'
      + ['_scaleOfEra', '_scalesOfGauge', 'rrLineRowScales', '_rrLineRowScale', 'rrRowOwnLineScale', 'rrRowEraScale'].map(n => grabIf(app, n)).join('\n')) : '',
    'window._wizPeriodOfRow = _wizPeriodOfRow;',
    ['_mIsMotive', '_mSuffix', '_letterKinRows', '_zeroKinRows', '_findMasterCore',
     'rrMasterKeyOf', 'rrMasterByKey', 'rrMasterRowIdOf', '_rrIndexByRowId', 'rrMasterByRowId', '_rrRowIdFits',
     'findMaster', '_preferEraOf', '_rrRealRowsOf'].map(n => grab(dat, n)).join('\n'),
    grabIf(dat, '_rrRowSoldAsEra'),   // stdmodern C2 — absent in a copy from before it
    // zerobridge: the book-copy redirect and its one table (config.js, or o.cfg —
    // the source text of a planted config.js); absent in a copy from before it
    bookCopyTable(o), bookCopyState(dat),
    ['_rrBcTable', '_rrBcIndex', '_rrBcEntryFits', 'rrBookCopyRedirect', '_rrBookCopyPairFits', 'rrRowForVariation'].map(n => grabIf(dat, n)).join('\n'),
    // o.indexComplete: the whole-catalog index's "complete" signal (the app's
    // rrCatalogIndexStatus); left out, the helper's own fallback (a layer 2 exists)
    (typeof o.indexComplete === 'boolean') ? ('function rrCatalogIndexStatus() { return { complete: ' + o.indexComplete + ' }; }') : '',
    'state.masterByRowId = _rrIndexByRowId(state._l1); state.masterByRowIdAll = state._l2 ? _rrIndexByRowId(state._l2) : null;',
    'return { findMaster: findMaster, core: _findMasterCore, soldAsEra: (typeof _rrRowSoldAsEra === "function") ? _rrRowSoldAsEra : null, state: state,'
      + ' redirect: (typeof rrBookCopyRedirect === "function") ? rrBookCopyRedirect : null,'
      + ' rowForVariation: (typeof rrRowForVariation === "function") ? rrRowForVariation : null,'
      + ' keyOf: rrMasterKeyOf, rowIdOf: rrMasterRowIdOf, rowIdFits: _rrRowIdFits };',
  ].join('\n');
  const state = {
    _l1: o.layer1 || [], _l2: o.layer2 || null,
    masterByItem: index(o.layer1 || []), masterByItemAll: o.layer2 ? index(o.layer2) : null,
  };
  const baseItemNum = n => String(n || '').replace(/-?[PDTC]$/i, '');
  return new Function('state', 'ERA_TABS', 'ERAS', 'window', 'baseItemNum', body)(
    state, o.eraTabs || {}, o.eras || {}, {}, baseItemNum);
}

module.exports = { buildFindMaster, grab, index };
