#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// KNOWN-PROBLEMS SWEEP, RELEASE 3 — v0.9.2048   (C16 and C17; B13 is
// tests/own_words_2048_tests.js, the real app in Chromium)
//
// C16 — a catalog list whose read FAILS keeps the copy this device saved.
//   loadSetData / loadCompanionData / loadCatalogRefData / loadISRefData set
//   their list to [] when Google did not answer — so a day-old saved copy was
//   thrown away and, for the session, sets had no completion and tenders no
//   pairing. Run here: the REAL four loaders, lifted from app-data.js into a
//   sandbox with a saved copy two days old and a sheetsGet that fails (throws,
//   or answers with an error). Only a tab that does not exist means "none".
//
// C17 — what a save could not do is SAID.
//   The save paths' photo uploads caught their failure with console.warn
//   alone — and so did the side rows a save writes (the instruction sheet,
//   master carton and box saved with an item, the set's My Sets row, "also
//   list it for sale", a Want List partner): the person was told "saved" and
//   the photo or row was just not there. ([stated] Brad "yes" to the photo
//   ones, then "yes" to the three, then "yes, add both".)
//   Run here: the REAL helpers (write-outbox.js) and the REAL showToast
//   (wizard-utils.js) in a sandbox with a clock we move by hand; and a scan —
//   no photo upload or new sheet row in app/ whose catch only writes to the
//   console (two named background exceptions in barcode.js, with reasons).
//
//   P  planted offenders — each turns its own check red.
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.split(from).join(to);
}
// one top-level function, by name, brace-matched (strings and comments skipped)
function lift(src, name) {
  const m = new RegExp('(^|\\n)((?:async\\s+)?function\\s+' + name + '\\s*\\()').exec(src);
  if (!m) throw new Error(name + ' not found');
  const start = m.index + m[1].length;
  let i = src.indexOf('{', start), dep = 0, q = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (c === '{') dep++;
    else if (c === '}') { dep--; if (!dep) return src.slice(start, i + 1); }
  }
  throw new Error(name + ' never closes');
}

// ══ C16 ══════════════════════════════════════════════════════════════════
const C16_FNS = ['_rrKeepCachedList', '_rrListReadOk', '_rrIsMissingTab', 'loadCatalogRefData', 'loadISRefData', 'loadSetData', 'loadCompanionData'];
function c16Box(src, sheetsGet, store) {
  const ls = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const ctx = {
    console: { warn() {}, log() {}, error() {} }, JSON, Date, Promise, parseInt, Array, String, Object, Error, RegExp,
    localStorage: ls, window: { _skipBackgroundRefresh: true },
    state: { masterSheetId: 'M', setData: null, companionData: null, catalogRefData: null, isRefData: null },
    _currentEra: 'pw',
    SHEET_TABS: { sets: 'Sets', companions: 'Companions', catalogs: 'Catalogs', instrSheets: 'Instruction Sheets PW' },
    sheetsGet,
    parseSetRows: rows => { ctx.state.setData = rows.map(r => ({ setNum: r[0] })); },
    parseCompanionRows: rows => { ctx.state.companionData = rows.map(r => ({ a: r[0] })); },
  };
  vm.createContext(ctx);
  vm.runInContext(C16_FNS.map(n => lift(src, n)).join('\n\n'), ctx);
  return ctx;
}
const OLD = Date.now() - 2 * 24 * 3600 * 1000;   // two days: past every 24-hour freshness window
function savedCopies() {
  return {
    lv_set_cache_pw: JSON.stringify([{ setNum: '1000W' }]), lv_set_cache_ts_pw: String(OLD),
    lv_companion_cache_pw: JSON.stringify([{ a: '2046' }]), lv_companion_cache_ts_pw: String(OLD),
    lv_catalog_ref_cache_pw: JSON.stringify([{ id: 'C-55' }]), lv_catalog_ref_ts_pw: String(OLD),
    lv_is_ref_cache_pw: JSON.stringify([{ id: 'IS-1' }]), lv_is_ref_ts_pw: String(OLD),
  };
}
const LISTS = [
  ['loadSetData', 'setData', '1000W'],
  ['loadCompanionData', 'companionData', '2046'],
  ['loadCatalogRefData', 'catalogRefData', 'C-55'],
  ['loadISRefData', 'isRefData', 'IS-1'],
];
const FAILS = {
  'Google does not answer (offline)': async () => { throw new Error('Failed to fetch'); },
  'Google answers with an error': async () => ({ error: { code: 503, message: 'The service is currently unavailable.', status: 'UNAVAILABLE' } }),
};

async function c16(src, tag) {
  const out = {};
  for (const [failName, get] of Object.entries(FAILS)) {
    for (const [fn, field, want] of LISTS) {
      const store = savedCopies();
      const box = c16Box(src, get, store);
      await box[fn]();
      const got = box.state[field];
      out[tag + '|' + failName + '|' + fn] = Array.isArray(got) && got.length === 1 && JSON.stringify(got).indexOf(want) >= 0;
    }
  }
  return out;
}

// ══ C17 ══════════════════════════════════════════════════════════════════
function c17Box(outboxSrc, utilsSrc, configSrc) {
  const timers = []; let now = 1e12;
  const toasts = [];
  const doc = {
    _el: null,
    getElementById(id) { return id === 'toast' ? doc._el : null; },
    createElement() { return { style: {}, remove() { if (doc._el === this) doc._el = null; }, set textContent(v) { this._t = v; }, get textContent() { return this._t; } }; },
    body: { appendChild(el) { doc._el = el; el.parentNode = doc.body; toasts.push({ text: el._t, error: /#c0392b/.test(el.style.cssText || '') }); } },
  };
  const ctx = {
    console: { warn() {}, log() {}, error() {} }, JSON, String, Math, parseInt, Object, Array, Error, RegExp,
    Date: { now: () => now },
    setTimeout: (f, ms) => { const t = { f, at: now + (ms || 0), done: false }; timers.push(t); return t; },
    clearTimeout: t => { if (t) t.done = true; },
    requestAnimationFrame: () => {}, document: doc, localStorage: { getItem() { return null; }, setItem() {} },
  };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  const words = /const RR_PHOTO_MISSED = \{[\s\S]*?\n\};/.exec(configSrc);
  if (!words) throw new Error('RR_PHOTO_MISSED not found in config.js');
  vm.runInContext(words[0].replace('const RR_PHOTO_MISSED', 'var RR_PHOTO_MISSED'), ctx);
  vm.runInContext(lift(utilsSrc, 'showToast'), ctx);
  // write-outbox.js is one wrapped block that needs the page; take the two helpers' block alone
  const a = outboxSrc.indexOf('  function rrIsSignInError(err) {'), b = outboxSrc.indexOf('  window.rrSaveCarryTake = rrSaveCarryTake;');
  if (a < 0 || b < 0) throw new Error('the C17 helpers were not found in write-outbox.js');
  vm.runInContext('function rrOutboxCount(){ return 0; }\n' + outboxSrc.slice(a, b) + '\nwindow.rrSaveCarryTake = rrSaveCarryTake; window.rrPhotoMissed = rrPhotoMissed; window.rrSaveMissed = rrSaveMissed;', ctx);
  ctx.advance = ms => { now += ms; timers.filter(t => !t.done && t.at <= now).forEach(t => { t.done = true; t.f(); }); };
  ctx.toasts = toasts;
  return ctx;
}

(async () => {
  const DATA = read('app-data.js');
  const r = await c16(DATA, 'real');
  for (const k of Object.keys(r)) { const [, how, fn] = k.split('|'); ok('C16 ' + fn + ' — ' + how + ': the saved copy is kept, not emptied', r[k]); }

  // a tab that truly does not exist still means "none" — and that answer is remembered for the day
  {
    const store = savedCopies(); delete store.lv_is_ref_cache_pw; delete store.lv_is_ref_ts_pw;
    const box = c16Box(DATA, async () => { throw new Error('Sheets read failed (400): Unable to parse range: Instruction Sheets PW!A2:F'); }, store);
    await box.loadISRefData();
    ok('C16 loadISRefData — a missing tab still means none ([]), cached for the day', Array.isArray(box.state.isRefData) && box.state.isRefData.length === 0 && store.lv_is_ref_cache_pw === '[]' && !!store.lv_is_ref_ts_pw);
  }
  // a failed read never writes an empty list into the saved copy
  {
    const store = savedCopies();
    const box = c16Box(DATA, FAILS['Google does not answer (offline)'], store);
    await box.loadISRefData();
    ok('C16 loadISRefData — a failed read leaves the saved copy and its date untouched', store.lv_is_ref_cache_pw === JSON.stringify([{ id: 'IS-1' }]) && store.lv_is_ref_ts_pw === String(OLD));
  }
  // first name times out, second name says "no such tab" — that is still a FAILED read
  {
    const store = savedCopies(); let calls = 0;
    const box = c16Box(DATA, async () => { calls++; if (calls === 1) throw new Error('Failed to fetch'); throw new Error('Unable to parse range: Instruction Sheets!A2:F'); }, store);
    await box.loadISRefData();
    ok('C16 loadISRefData — one name fails, the other is missing: still a failed read, copy kept', Array.isArray(box.state.isRefData) && box.state.isRefData.length === 1 && store.lv_is_ref_cache_pw !== '[]');
  }
  // a good read still replaces the list and the saved copy
  {
    const store = savedCopies();
    const box = c16Box(DATA, async () => ({ values: [['2100W', 'x'], ['2101W', 'y']] }), store);
    await box.loadSetData();
    ok('C16 loadSetData — a good read still replaces the list and refreshes the saved copy', box.state.setData.length === 2 && JSON.parse(store.lv_set_cache_pw).length === 2 && store.lv_set_cache_ts_pw !== String(OLD));
  }
  // planted: the old "= []" in each loader's catch
  const PL16 = [
    ['loadSetData', "state.setData = _rrKeepCachedList(SET_CACHE); }", "state.setData = []; }"],
    ['loadCompanionData', "state.companionData = _rrKeepCachedList(COMP_CACHE); }", "state.companionData = []; }"],
    ['loadCatalogRefData', "state.catalogRefData = _rrKeepCachedList(CACHE_KEY);   // v0.9.2048 (C16)", "state.catalogRefData = [];"],
    ['loadISRefData', "    state.isRefData = _rrKeepCachedList(CACHE_KEY);\n    return;", "    state.isRefData = [];\n    return;"],
  ];
  for (const [fn, from, to] of PL16) {
    const p = await c16(plant(DATA, from, to, fn), 'planted');
    ok('C16 P ' + fn + ' — the old "= []" turns its check red', p['planted|Google does not answer (offline)|' + fn] === false);
  }
  {
    const p = await c16(plant(DATA, "  if (res && res.error) throw new Error('Sheets read failed: ' + (res.error.message || res.error.status || 'error'));\n", '', '_rrListReadOk'), 'planted');
    ok('C16 P an error ANSWER taken as data turns the error-answer checks red', p['planted|Google answers with an error|loadSetData'] === false);
  }

  // ── C17: the helpers and the real showToast ──
  const OUT = read('write-outbox.js'), UT = read('wizard-utils.js'), CFG = read('config.js');
  const W = vm.runInNewContext('(' + /const RR_PHOTO_MISSED = (\{[\s\S]*?\n\});/.exec(CFG)[1] + ')');
  {
    const b = c17Box(OUT, UT, CFG);
    b.rrPhotoMissed(new Error('HTTP 500'), 'item photo');
    b.rrPhotoMissed(new Error('HTTP 500'), 'item photo');
    b.advance(500); ok('C17 misses in one save are added up, not told one by one', b.toasts.length === 0);
    b.advance(600);
    ok('C17 told once, a moment after the last miss, in RR_PHOTO_MISSED\'s words', b.toasts.length === 1 && b.toasts[0].text === W.many.replace('{n}', '2') && b.toasts[0].error, JSON.stringify(b.toasts));
    b.advance(1000); b.showToast('✓ 3376 saved!');
    ok('C17 the save\'s own "saved" message carries the words on its end', b.toasts[1] && b.toasts[1].text === '✓ 3376 saved!' + W.after + W.many.replace('{n}', '2').replace(/^./, c => c.toLowerCase()) && b.toasts[1].error, JSON.stringify(b.toasts[1]));
    b.showToast('✓ Something else');
    ok('C17 carried once only', b.toasts[2].text === '✓ Something else' && !b.toasts[2].error, JSON.stringify(b.toasts[2]));
  }
  {
    const b = c17Box(OUT, UT, CFG);
    b.rrPhotoMissed(new Error('x'), 'part photo'); b.advance(100); b.showToast('✓ Part saved');
    ok('C17 a "saved" message before the notice carries it at once (one photo)', b.toasts.length === 1 && b.toasts[0].text === '✓ Part saved' + W.after + W.one.replace(/^./, c => c.toLowerCase()));
    b.advance(5000);
    ok('C17 ... and the notice is not shown a second time after it', b.toasts.length === 1, JSON.stringify(b.toasts));
  }
  {
    const b = c17Box(OUT, UT, CFG);
    b.rrPhotoMissed(new Error('x'), 'folder', 3); b.advance(1000);
    ok('C17 a folder that could not be made counts every photo it cost', b.toasts[0] && b.toasts[0].text === W.many.replace('{n}', '3'));
    b.advance(20000); b.showToast('✓ Later, unrelated');
    ok('C17 a notice older than 15 seconds is not tacked onto an unrelated message', b.toasts[1].text === '✓ Later, unrelated');
  }
  {
    const b = c17Box(OUT, UT, CFG);
    b.rrSaveMissed(new Error('Something broke'), 'the instruction sheet');
    ok('C17 a side piece that did not save is told at once (rrSaveError\'s words)', b.toasts[0] && /Could not save the instruction sheet/.test(b.toasts[0].text) && b.toasts[0].error, JSON.stringify(b.toasts));
    b.showToast('✓ Item 3376 added to My Collection!');
    ok('C17 ... and rides on the item\'s own "added" message', /added to My Collection! But could not save the instruction sheet/.test(b.toasts[1].text), b.toasts[1].text);
  }
  {
    const b = c17Box(OUT, plant(UT, "typeof window.rrSaveCarryTake === 'function'", 'false', 'showToast carry'), CFG);
    b.rrPhotoMissed(new Error('x')); b.advance(1000); b.showToast('✓ saved');
    ok('C17 P showToast without the carry lets "saved" wipe the notice (check goes red)', b.toasts[1].text === '✓ saved');
  }

  // ── C17 scan: no photo upload whose catch only writes to the console ──
  function strip(src) {
    let out = '', i = 0, q = null;
    while (i < src.length) {
      const c = src[i], d = src[i + 1];
      if (q) { out += c; if (c === '\\') { out += src[i + 1] || ''; i += 2; continue; } if (c === q) q = null; i++; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; out += c; i++; continue; }
      if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
      if (c === '/' && d === '*') { while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; } out += '  '; i += 2; continue; }
      out += c; i++;
    }
    return out;
  }
  function closeAt(s, i, o, c) { let d = 0; for (let k = i; k < s.length; k++) { if (s[k] === o) d++; else if (s[k] === c) { d--; if (!d) return k; } } return -1; }
  function consoleOnly(body) {
    return body.replace(/console\.(warn|error|log)\s*\(/g, '@(').replace(/@\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, '').replace(/[\s;{}]/g, '') === '';
  }
  // A SAVE = a photo upload (driveUploadPhoto) or a new sheet row (sheetsAppend).
  const SAVE = /(driveUploadPhoto|sheetsAppend)\s*\(/;
  // Named exceptions, each with its reason — a catch body holding this text may stay quiet.
  const QUIET_OK = [
    ['barcode.js', "[bcmap] could not save the pairing", 'background learning of a barcode — the pairing is kept on this device; nobody pressed Save'],
    ['barcode.js', "[bcmap] could not forget the pairing", 'background clean-up of a barcode pairing — kept on this device; nobody pressed Save'],
  ];
  function silentUploads(src, file) {
    const s = strip(src), out = []; let m;
    const allowed = body => QUIET_OK.some(q => q[0] === file && body.indexOf(q[1]) >= 0);
    const re1 = /\.catch\s*\(/g;
    while ((m = re1.exec(s))) {
      const o = s.indexOf('(', m.index), c = closeAt(s, o, '(', ')');
      const st = Math.max(s.lastIndexOf(';', m.index), s.lastIndexOf('{', m.index), s.lastIndexOf('}', m.index));
      if (!SAVE.test(s.slice(st, m.index))) continue;
      const body = s.slice(o + 1, c).replace(/^\s*(\w+|\([^)]*\))\s*=>\s*/, '').replace(/^\s*function\s*\([^)]*\)\s*/, '');
      if (consoleOnly(body) && !allowed(body)) out.push(s.slice(0, m.index).split('\n').length);
    }
    const re2 = /\btry\s*\{/g;
    while ((m = re2.exec(s))) {
      const o = s.indexOf('{', m.index), c = closeAt(s, o, '{', '}');
      const cm = /^\s*catch\s*(\([^)]*\))?\s*\{/.exec(s.slice(c + 1)); if (!cm) continue;
      const co = c + cm[0].length, cc = closeAt(s, co, '{', '}');
      const cb = s.slice(co + 1, cc);
      if (SAVE.test(s.slice(o, c)) && consoleOnly(cb) && !allowed(cb)) out.push(s.slice(0, co).split('\n').length);
    }
    return out;
  }
  const files = fs.readdirSync(APP).filter(f => /\.js$/.test(f));
  const offenders = files.map(f => [f, silentUploads(read(f), f)]).filter(x => x[1].length).map(x => x[0] + ':' + x[1].join(','));
  ok('C17 S1 no photo upload or new sheet row in app/ whose catch only writes to the console', !offenders.length, offenders.join('  '));
  for (const [f, text, why] of QUIET_OK) ok('C17 S1 the named quiet exception still exists, so it cannot rot (' + f + ': ' + why + ')', read(f).indexOf(text) >= 0);
  ok('C17 S1 the scan really looks at uploads (it finds the ' + files.filter(f => /driveUploadPhoto\s*\(/.test(read(f))).length + ' files that upload)', files.filter(f => /driveUploadPhoto\s*\(/.test(read(f))).length >= 6);
  const P17 = [
    ['wizard-save.js', "await driveUploadPhoto(file, fname, folderId).catch(e => rrPhotoMissed(e, 'QE photo')); _pTried++;", "await driveUploadPhoto(file, fname, folderId).catch(e => console.warn(e)); _pTried++;", 'the Quick Entry upload\'s .catch'],
    ['wizard-save.js', "} catch(e) { rrPhotoMissed(e, 'catalog photo'); }", "} catch(e) { console.warn('Photo upload:', e); }", 'the catalog photo\'s try/catch'],
    ['wizard-save.js', "} catch(e) { rrSaveMissed(e, 'the instruction sheet'); }", "} catch(e) { console.warn('IS save error:', e); }", 'the instruction sheet saved with an item'],
    ['app-pages.js', "} catch (pe) { rrPhotoMissed(pe, 'part photo'); }", "} catch (pe) { console.warn('[Parts] photo upload failed', pe && pe.message); }", 'the part photo'],
    ['app-collection.js', "} catch (eU) { _gMiss++; console.warn('[group photo]', eU); }", "} catch (eU) { console.warn('[group photo]', eU); }", 'the group photo'],
    ['wizard-save.js', "  } catch(e) { rrSaveMissed(e, 'the set\\u2019s entry in My Sets'); }", "  } catch(e) { console.warn('My Sets row save error:', e); }", 'the set\'s My Sets row'],
    ['wizard-save.js', "      } catch(e) { rrSaveMissed(e, 'the box'); }", "      } catch(e) { console.warn('Group box row save error:', e); }", 'the box saved with an item'],
    ['wizard-save.js', "        rrSaveMissed(e, 'the For Sale listing');", "        console.warn('[alsoListForSale] write failed:', e && e.message);", 'also list it for sale'],
    ['app-collection.js', "} catch(e) { _wpFailed.push(c.itemNum); _wpErr = e; console.warn('[WantPartner] Failed to add', c.itemNum, e); }", "} catch(e) { console.warn('[WantPartner] Failed to add', c.itemNum, e); }", 'a Want List partner'],
    ['barcode.js', "[bcmap] could not save the pairing", "[bcmap] pairing not saved", 'a quiet catch that is NOT a named exception'],
  ];
  for (const [f, from, to, label] of P17) ok('C17 P ' + label + ' — the old console-only catch is caught by the scan', silentUploads(plant(read(f), from, to, label), f).length > 0);

  // the helpers are the only home of the words
  ok('C17 the photo words live once — RR_PHOTO_MISSED in config.js, nowhere else', files.filter(f => /did not upload\. Open the item/.test(read(f))).join(',') === 'config.js', files.filter(f => /did not upload\. Open the item/.test(read(f))).join(','));
  ok('C17 rrPhotoMissed / rrSaveMissed / rrSaveCarryTake are defined once (write-outbox.js)', files.filter(f => /function rrPhotoMissed\(|function rrSaveMissed\(|function rrSaveCarryTake\(/.test(read(f))).join(',') === 'write-outbox.js');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.stack); process.exit(1); });
