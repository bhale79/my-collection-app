// tests/lib/main-photo.js — 2026-11-02 (the main picture)
//
// THE main-picture rule lives in app/app-collection.js (rrMainPhotoOf, on top of
// the gallery's _rrSortGalleryPhotos + _rrOrderOfName). A sandbox that loads
// dashboard.js alone (thumb_cache_sheet_tests, the tour sample lib…) needs the
// REAL rule, never a copy typed into the test — this lifts it from the file.
//
//   const { mainPhotoSrc, rememberSrc } = require('./lib/main-photo');
//   vm.runInContext(mainPhotoSrc(), ctx);   // defines the three functions in ctx
//   rememberSrc(dashSrc) — dashboard.js's "when was it last looked up" helpers
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', '..', 'app');

function fnSrc(src, name) {
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('main-photo lib: ' + name + ' not found');
  let i = at;
  if (src.slice(i - 6, i) === 'async ') i -= 6;
  let d = 0;
  for (let k = src.indexOf('{', at); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('main-photo lib: ' + name + ' unbalanced');
}
function mainPhotoSrc(acSrc) {
  const s = acSrc || fs.readFileSync(path.join(APP, 'app-collection.js'), 'utf8');
  return ['_rrOrderOfName', '_rrSortGalleryPhotos', 'rrMainPhotoOf'].concat(s.indexOf('function rrPiecePhotos(') >= 0 ? ['rrPiecePhotos'] : []).map(n => fnSrc(s, n) + '\n;this.' + n + ' = ' + n + ';').join('\n');
}
const REMEMBER = ['_thumbSeenKey', '_thumbSeen', '_thumbSeenSave', '_thumbSeenDrop', '_thumbFresh'];
function rememberSrc(dashSrc) {
  return REMEMBER.filter(n => dashSrc.indexOf('function ' + n + '(') >= 0)
    .map(n => fnSrc(dashSrc, n) + '\n;this.' + n + ' = ' + n + ';').join('\n');
}
module.exports = { mainPhotoSrc, rememberSrc, fnSrc };
