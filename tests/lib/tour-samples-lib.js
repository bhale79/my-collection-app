// ══ tests/lib/tour-samples-lib.js — what the two tour-sample suites share ══
// v0.9.1871. tests/tour_samples_tests.js (what shows, never saved, gone — on a
// computer and a phone) and tests/tour_samples_rows_tests.js (a page with its
// own rows, the row shape, the signature, the source) run on the same helpers,
// so they cannot drift apart on how Drive is stood in for, what counts as a
// save, or how a card is read. Split in two so neither runs near the quick
// tier's 180-second cap (rules_testing: split, never weaken).
'use strict';
const fs = require('fs'), path = require('path');
const H = require('./tour-harness.js');
const SRC = name => fs.readFileSync(path.join(H.APP, name), 'utf8');
function planted(T, file, from, to) {
  const src = SRC(file);
  if (src.indexOf(from) < 0) { T('PLANTED: the anchor to cut is in ' + file, false, from.slice(0, 90)); return null; }
  return { [file]: src.split(from).join(to) };
}

// Drive, stood in for: the inbox folder exists and holds `files` (none = a new account).
async function standInDrive(pg, files) {
  await pg.evaluate((files) => {
    try { localStorage.setItem('rr_inbox_fid', 'FAKEFOLDER'); } catch (e) {}
    window.driveRequest = async function (method, url) {
      if (/\/files\/FAKEFOLDER/.test(url)) return { id: 'FAKEFOLDER', trashed: false };
      if (/^\/files\?/.test(url)) return { files: files || [] };
      return {};
    };
  }, files || []);
}
// Every door something could be saved through, watched; the photo / folder look-ups counted.
const WATCH = `(() => {
  window.__rec = { ls: [], idb: [], writes: [], photo: [], parts: 0 };
  const mark = v => { try { const s = typeof v === 'string' ? v : JSON.stringify(v); return /rr-sample|sample-2343|sample-6464|sample-6457/.test(s || ''); } catch (e) { return false; } };
  const _set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (mark(k) || mark(v)) __rec.ls.push(k); return _set.apply(this, arguments); };
  ['put', 'add'].forEach(m => { const f = IDBObjectStore.prototype[m]; IDBObjectStore.prototype[m] = function (v) { if (mark(v)) __rec.idb.push(m); return f.apply(this, arguments); }; });
  ['sheetsUpdate', 'sheetsAppend', 'sheetsBatchUpdate', 'sheetsDeleteRow', 'rrVerifiedRowUpdate', 'driveUploadFile', 'driveFindOrCreateFolder', 'driveRequest'].forEach(n => {
    const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function () { if (mark(Array.from(arguments))) __rec.writes.push(n); return f.apply(this, arguments); };
  });
  ['rrPhotoFolderFor', 'driveFindItemFolder', 'driveGetFolderPhotos', 'rrThumbFill', '_thumbFor', 'loadDriveThumb'].forEach(n => {
    const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function () { __rec.photo.push(n + ':' + String(arguments[0] && arguments[0].itemNum || arguments[2] || arguments[1] || arguments[0]).slice(0, 30)); return f.apply(this, arguments); };
  });
  const pt = window._ensurePartsTab; if (typeof pt === 'function') window._ensurePartsTab = function () { __rec.parts++; return pt.apply(this, arguments); };
  window.__lists = () => JSON.stringify([state.personalData, state.wantData, state.upgradeData, state.forSaleData, state.soldData, state.partsData, state.filteredData ? state.filteredData.length : 0]);
  window.__before = window.__lists();
})()`;

// What each page card shows: the visible sample rows in that page's list, their tags, numbers, the card's words.
const PAGE = { 'My Collection': '#page-browse', 'Want / Upgrade': '#page-upgrade', 'For Sale': '#page-forsale', 'Parts Needed': '#parts-list', 'Sold Items': '#page-sold', 'The Photo Inbox': '#pin-grid' };
const PROBE = `((sel) => {
  const nodes = Array.from(document.querySelectorAll(sel + ' [data-rr-sample]')).filter(n => n.getClientRects().length > 0);
  const text = nodes.map(n => n.textContent.replace(/\\s+/g, ' ')).join(' | ');
  const imgs = nodes.map(n => { const i = n.querySelector('img'); return i ? (i.getAttribute('src') || '') : ''; }).join(' ');
  return {
    n: nodes.length, inert: nodes.every(n => n.inert === true), tagged: nodes.every(n => { const t = n.querySelector('.rr-sample-tag'); return !!t && /^sample$/i.test(t.textContent.trim()); }),
    text, imgs, body: (document.getElementById('gt-body') || {}).textContent || '', title: (document.getElementById('gt-title') || {}).textContent || ''
  };
})`;
async function walkWithProbes(pg, stopAt) {
  const seen = {};
  await pg.evaluate(() => { window._gtMisses = []; startGuide('tour'); });
  let prev = '__none__';
  for (let k = 0; k < 40; k++) {
    const t0 = Date.now();
    while (Date.now() - t0 < 5000) {
      const now = await pg.evaluate(() => { const s = document.getElementById('gt-step'); return s ? s.textContent : null; });
      if (prev === '__none__' ? now !== null : (now === null || now !== prev)) { prev = now; break; }
      await pg.waitForTimeout(80);
    }
    if (prev === null) break;
    await pg.waitForTimeout(150);
    const title = await pg.evaluate(() => (document.getElementById('gt-title') || {}).textContent || '');
    if (PAGE[title]) seen[title] = await pg.evaluate(PROBE + '(' + JSON.stringify(PAGE[title]) + ')');
    if (stopAt && title === stopAt) return seen;
    const more = await pg.evaluate(() => { const n = document.getElementById('gt-next'); if (!n) return false; n.click(); return true; });
    if (!more) break;
  }
  return seen;
}
const NUMS = ['2343', '6464-1', '6457'];
const ROWS_NOTE = /three rows marked SAMPLE show what yours will look like/;
const PHOTOS_NOTE = /three photos marked SAMPLE \(courtesy of Cornucopia of Toy Trains\)/;
async function afterTour(pg) {
  return pg.evaluate(() => ({
    left: document.querySelectorAll('[data-rr-sample]').length, on: rrSamplesShowing(), callout: !!document.getElementById('gt-callout'),
    rec: window.__rec, same: window.__lists() === window.__before
  }));
}
// The shape of one row: tag + classes + column, every element in order, the SAMPLE pill left out.
const SKEL = `window.__skel = function (el) { const out = []; (function walk(n) { if (!n || n.nodeType !== 1) return; if (n.classList.contains('rr-sample-tag')) return; out.push(n.tagName + (n.classList.length ? '.' + Array.from(n.classList).sort().join('.') : '') + (n.dataset && n.dataset.col ? '#' + n.dataset.col : '')); for (const c of n.children) walk(c); })(el); return out.join(' '); };`;

module.exports = { SRC, planted, standInDrive, WATCH, PAGE, PROBE, walkWithProbes, NUMS, ROWS_NOTE, PHOTOS_NOTE, afterTour, SKEL };
