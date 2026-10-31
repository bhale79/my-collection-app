#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// YORK EMAIL FIXES — v0.9.2030   (real Chromium, the REAL app)
//
// Four things three York customers wrote in about, 2026-10-24 → 26:
//   A/B  an iPhone photo sat at "1 photo waiting to upload" all night with a
//        blank picture (Mike). photo-inbox-offline.js: the staged photo is kept
//        as BYTES (a File in IndexedDB can come back unreadable on an iPhone);
//        the drain WAITS for the Google sign-in (rrWaitForPass) instead of
//        returning silently; the strip SAYS what is wrong (RR_STAGE_WORDS).
//   C    "Google Photos Picker error (400)" (Curtis). drive.js reads Google's
//        reason; rrGPhotosErrorWords turns it into words (RR_GPHOTOS_WAIT);
//        both routes — the inbox import and the Add steps — show them.
//   D    a new K4 "connects it as a diesel" (Lars). type-groups.js knows the
//        steam names the catalog's bare "Locomotive" rows need (K4, M1, T1,
//        AC-9/12, 2-10-0 …), and a Rectifier is an electric.
//   E    "Other · 46212" on a card (Lars). browse.js: a typed-in item's card
//        shows its Year Made, never the purchase date as a raw number.
//   P    planted offenders — each change undone in a served copy of a file
//        must turn its own check red
// Only the Google writers are stood in for; they RECORD what they were asked.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  york_fixes_2030_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }

async function openApp(browser, served) {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 720 } });   // the customers' phones (402×660 on the report) — My Collection draws CARDS under 640
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await ctx.route('**', r => {
    const u = r.request().url();
    // Google refuses the picker session the way it did for the York customer
    if (/photospicker\.googleapis\.com\/v1\/sessions$/.test(u) && r.request().method() === 'POST') {
      return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 400, message: 'Google Photos has not been set up', status: 'FAILED_PRECONDITION' } }) });
    }
    if (!u.startsWith('file://') && !u.startsWith('about:')) return r.abort();
    const name = u.split('?')[0].split('/').pop();
    if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  return { ctx, pg, errs };
}

async function scenario(pg) {
  return pg.evaluate(async () => {
    const R = {};
    const F = window._pinFns;
    const W = RR_STAGE_WORDS;
    state.masterData = []; state.personalData = {}; state.isData = {}; state.personalSheetId = 'S'; _currentEra = 'all';
    state.user = { name: 'Curtis', email: 'ccurtishsr@gmail.com' };
    const _realRenderBrowse = window.renderBrowse;   // a function declaration cannot be deleted back — keep it to restore
    window.buildDashboard = () => {}; window.renderBrowse = () => {}; window.rrMaybeShowAddHelp = () => {};
    const toasts = []; window.showToast = (m) => { toasts.push(String(m)); };
    document.getElementById('app').classList.add('active');
    // a clean device store
    await new Promise(res => { try { const rq = indexedDB.deleteDatabase('rr_photo_stage'); rq.onsuccess = rq.onerror = rq.onblocked = () => res(); } catch (e) { res(); } });
    // the inbox page, so #pin-staged exists
    try { window._pinRefresh = async () => {}; _pinGo(document.getElementById('nav-photo-inbox')); } catch (e) { R.pageErr = String(e && e.message || e); }
    const strip = () => ((document.querySelector('#pin-staged [data-stage-status]') || {}).textContent || '').trim();
    const badges = () => Array.from(document.querySelectorAll('#pin-staged img')).length + ':' + Array.from(document.querySelectorAll('#pin-staged div[onclick] > div')).map(d => d.textContent.trim()).join(',');
    const allRecs = () => new Promise(res => { const rq = indexedDB.open('rr_photo_stage', 2); rq.onsuccess = () => { const db = rq.result; const g = db.transaction('photos').objectStore('photos').getAll(); g.onsuccess = () => { db.close(); res(g.result || []); }; g.onerror = () => { db.close(); res([]); }; }; rq.onerror = () => res([]); });
    const putRec = (rec) => new Promise(res => { const rq = indexedDB.open('rr_photo_stage', 2); rq.onsuccess = () => { const db = rq.result; const tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').put(rec); tx.oncomplete = () => { db.close(); res(true); }; tx.onerror = () => { db.close(); res(false); }; }; rq.onerror = () => res(false); });

    // ── A: a staged photo is bytes; the strip's words; an unreadable one ──
    window.accessToken = 'T'; try { localStorage.setItem('lv_token', 'T'); localStorage.setItem('lv_token_expiry', String(Date.now() + 3600000)); } catch (e) {}
    const photo = new File([new Uint8Array([255, 216, 255, 224, 1, 2, 3, 4])], 'IMG_1.jpg', { type: 'image/jpeg' });
    const id1 = await F._stageOne(photo, 'INBOX 1 g1 IMG_1.jpg', 'pw', '');
    let recs = await allRecs();
    const r1 = recs.find(r => r.id === id1) || {};
    R.aBytes = !!(r1.bytes && r1.bytes.byteLength === 8); R.aBlobNull = r1.blob == null; R.aName = r1.fname;
    await F._stageRenderStrip();
    R.aWords = strip(); R.aBadges = badges();
    // a record whose picture cannot be read any more (the iPhone case)
    await putRec({ id: 'stgBAD', name: 'INBOX 2 g2 bad.jpg', type: 'image/jpeg', bytes: null, blob: null, era: '', view: '', at: Date.now(), tries: 0, lastErr: '' });
    await F._stageRenderStrip();
    R.aBadWords = strip(); R.aBadBadges = badges();
    window._stageReview('stgBAD'); await new Promise(r => setTimeout(r, 100));
    R.aReviewWhy = ((document.querySelector('#stage-review-ov [data-stage-why]') || {}).textContent || '').trim();
    const rv = document.getElementById('stage-review-ov'); if (rv) rv.remove();
    // remove the bad one so the drain below is about the good photo
    await new Promise(res => { const rq = indexedDB.open('rr_photo_stage', 2); rq.onsuccess = () => { const db = rq.result; const tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').delete('stgBAD'); tx.oncomplete = () => { db.close(); res(); }; }; });

    // ── B: the drain waits for the sign-in, then uploads the bytes ──
    const uploads = [];
    window.driveUploadFile = async (f, name, fid) => { const b = new Uint8Array(await f.arrayBuffer()); uploads.push({ name: name, bytes: Array.from(b).join(','), fname: f.name }); return { id: 'D' + uploads.length }; };
    F._folder = async () => 'FOLDER';
    F._pinMetaSet = async () => {};
    window._pinRefresh = async () => {};
    // the pass has run out; the renewal takes a moment and then lands
    window.accessToken = ''; try { localStorage.removeItem('lv_token'); localStorage.setItem('lv_token_expiry', '1'); } catch (e) {}
    let waitCalls = 0, wordsDuringWait = '';
    window.rrWaitForPass = (why) => new Promise(res => { waitCalls++; setTimeout(() => { wordsDuringWait = strip(); window.accessToken = 'T2'; try { localStorage.setItem('lv_token', 'T2'); localStorage.setItem('lv_token_expiry', String(Date.now() + 3600000)); } catch (e) {} res(true); }, 250); });
    window._pinStageDrainNow();
    for (let i = 0; i < 60 && !uploads.length; i++) await new Promise(r => setTimeout(r, 50));
    await new Promise(r => setTimeout(r, 200));
    R.bWaitCalls = waitCalls; R.bWordsDuringWait = wordsDuringWait;
    R.bUploaded = uploads.length === 1 && uploads[0].bytes === '255,216,255,224,1,2,3,4' && uploads[0].name === 'INBOX 1 g1 IMG_1.jpg';
    recs = await allRecs(); R.bLeft = recs.length;
    // the renewal never comes back: the strip says so, nothing is lost
    const id3 = await F._stageOne(photo, 'INBOX 3 g3 IMG_3.jpg', '', '');
    window.accessToken = ''; try { localStorage.removeItem('lv_token'); localStorage.setItem('lv_token_expiry', '1'); } catch (e) {}
    window.rrWaitForPass = async () => false;
    await F._stageDrain();
    recs = await allRecs(); const r3 = recs.find(r => r.id === id3) || {};
    R.b2Err = r3.lastErr; R.b2Words = strip(); R.b2Uploads = uploads.length;
    // Google refuses the pass mid-upload → the pass is marked refused, the reason kept
    window.accessToken = 'T3'; try { localStorage.setItem('lv_token', 'T3'); localStorage.setItem('lv_token_expiry', String(Date.now() + 3600000)); } catch (e) {}
    let refused = 0; window.rrPassRefused = () => { refused++; };
    window.driveUploadFile = async () => { throw new Error('HTTP 401'); };
    await F._stageDrain();
    recs = await allRecs(); const r3b = recs.find(r => r.id === id3) || {};
    R.b3Refused = refused; R.b3Err = r3b.lastErr;
    R.toasts = toasts.slice(-4);

    // ── C: Google's reason in words, both routes ──
    window._ensurePhotosScope = async () => true; window._rrPassHasScope = () => true;   // the permission is in; Google refuses the session itself
    const pick = await rrGPhotosPickSession({ onNeedTab: () => {} });
    R.cPick = { error: pick.error, status: pick.status, reason: pick.reason };
    R.cWords = rrGPhotosErrorWords(pick);
    R.cErrText = rrGPhotosErrText(pick);
    R.cRefused = rrGPhotosErrorWords({ error: 'session', status: 403, reason: 'PERMISSION_DENIED' });
    R.cBare403 = rrGPhotosErrText({ error: 'session', status: 403, reason: '' });   // keeps its older setup words
    R.cBusy = rrGPhotosErrorWords({ error: 'session', status: 429, reason: 'RESOURCE_EXHAUSTED' });
    R.cOther = rrGPhotosErrText({ error: 'session', status: 500, reason: '' });

    // ── D: the steam names ──
    const t = (desc, type) => getTypeBucket({ itemNum: 'x', itemType: type || 'Locomotive', description: desc, subType: '' });
    R.d = {
      k4: t('Pennsylvania LEGACY K4 #8'), m1: t('Pennsylvania LEGACY M1 #6855'), t1: t('Reading LEGACY T1 #2114'),
      ac9: t('Halloween LEGACY AC-9 #3131'), dec: t('Strasburg LEGACY 2-10-0 #90 (1967/2020)'), porter: t('Lackawanna Die Cast Porter #9'),
      thomas: t('Thomas the Tank Engine #1'), classA: t('Baltimore & Ohio LionMaster Class A Locomotive #7620'),
      rect: t('Virginian Conventional Rectifier #234'),
      nw2: t('Santa Fe Lionchief Plus 2.0 NW2 #623'), u36b: t('Delaware & Hudson U36B LionChief Locomotive #1776'),
      gp9: t('Santa Fe GP9 #2800', 'Diesel Locomotive'), hudson: t('NYC Hudson #5344', 'Steam Locomotive'),
    };

    // ── E: the card's year ──
    state.personalData = {
      kA: { owned: true, itemNum: '2531900L', variation: '', inventoryId: '70', row: 5, era: 'Manual', manufacturer: 'Lionel', itemType: 'Steam Locomotive', description: 'Custom run K4', datePurchased: '46212', yearMade: '' },
      kB: { owned: true, itemNum: '2531901L', variation: '', inventoryId: '71', row: 6, era: 'Manual', manufacturer: 'Lionel', itemType: 'Steam Locomotive', description: 'Custom run K4', datePurchased: '46212', yearMade: '1952' },
    };
    try {
      window.renderBrowse = _realRenderBrowse;   // the real one
      showPage('browse'); filterOwned();
      await new Promise(r => setTimeout(r, 400));
      // a phone draws cards (the customer's screen) — the card's second line is "Type · Year"
      const subs = Array.from(document.querySelectorAll('#browse-cards .browse-card-sub')).map(d => d.textContent.trim());
      R.eSubs = subs;
      R.eNoSerial = subs.length > 0 && subs.every(s => s.indexOf('46212') < 0);
      R.eYear = subs.some(s => /1952/.test(s));
    } catch (e) { R.eErr = String(e && e.message || e); }
    return R;
  });
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const { ctx, pg, errs } = await openApp(browser);
  const R = await scenario(pg);
  if (R.pageErr) console.log('note: inbox page threw: ' + R.pageErr);
  if (R.eErr) console.log('note: browse threw: ' + R.eErr);

  ok('A1 a staged photo is kept as bytes, not a File', R.aBytes && R.aBlobNull && R.aName === 'IMG_1.jpg', JSON.stringify([R.aBytes, R.aBlobNull, R.aName]));
  ok('A2 the strip draws the picture and says "uploading…" while nothing is wrong', /uploading/.test(R.aWords) && /^1:waiting$/.test(R.aBadges), R.aWords + ' | ' + R.aBadges);
  ok('A3 a photo that cannot be read: the strip says so, the badge says so', /can’t be read/.test(R.aBadWords) && /can’t read/.test(R.aBadBadges), R.aBadWords + ' | ' + R.aBadBadges);
  ok('A4 the review card says it too', /can’t be read/.test(R.aReviewWhy), R.aReviewWhy);
  ok('B1 Upload now with a lapsed sign-in WAITS for the renewal and says so', R.bWaitCalls === 1 && /Waiting for your Google sign-in/.test(R.bWordsDuringWait), R.bWaitCalls + ' | ' + R.bWordsDuringWait);
  ok('B2 then uploads the stored bytes under the staged name and clears the record', R.bUploaded === true && R.bLeft === 0, JSON.stringify([R.bUploaded, R.bLeft]));
  ok('B3 a renewal that never comes: the photo is kept, the strip says sign in', R.b2Err === 'SESSION_EXPIRED' && /Google sign-in/.test(R.b2Words) && R.b2Uploads === 1, JSON.stringify([R.b2Err, R.b2Words, R.b2Uploads]));
  ok('B4 Google refusing the pass mid-upload marks it refused for the next try', R.b3Refused === 1 && R.b3Err === 'SESSION_EXPIRED', JSON.stringify([R.b3Refused, R.b3Err]));
  ok('C1 the picker session carries Google’s reason', R.cPick.error === 'session' && R.cPick.status === 400 && R.cPick.reason === 'FAILED_PRECONDITION', JSON.stringify(R.cPick));
  ok('C2 "not set up" in words, naming the signed-in account (inbox route)', /hasn’t been set up for Google Photos/.test(R.cWords) && /ccurtishsr@gmail\.com/.test(R.cWords) && /photos\.google\.com/.test(R.cWords), R.cWords);
  ok('C3 the Add steps’ route says the same words', R.cErrText === R.cWords, R.cErrText);
  ok('C4 refused / busy / other each get their own words; a bare 403 keeps the setup words', /sign out, sign back in/.test(R.cRefused) && /busy/.test(R.cBusy) && /\(500\)/.test(R.cOther) && /one-time setup/.test(R.cBare403), JSON.stringify([R.cRefused, R.cBusy, R.cOther, R.cBare403]));
  ok('D1 K4, M1, T1, AC-9, 2-10-0, Porter, tank engine, Class A are Steam',
     ['k4', 'm1', 't1', 'ac9', 'dec', 'porter', 'thomas', 'classA'].every(k => R.d[k] === 'Steam Locomotive'), JSON.stringify(R.d));
  ok('D2 a Rectifier is Electric; NW2, U36B, GP9 stay Diesel; a Hudson stays Steam',
     R.d.rect === 'Electric Locomotive' && R.d.nw2 === 'Diesel Locomotive' && R.d.u36b === 'Diesel Locomotive' && R.d.gp9 === 'Diesel Locomotive' && R.d.hudson === 'Steam Locomotive', JSON.stringify(R.d));
  ok('E1 a typed-in item’s card never shows the purchase date as a number', R.eNoSerial === true, JSON.stringify(R.eSubs));
  ok('E2 its Year Made shows in the year slot', R.eYear === true, JSON.stringify(R.eSubs));
  const appErrs = errs.filter(e => !/fonts|Failed to fetch|net::/i.test(e));
  ok('no page errors', appErrs.length === 0, appErrs.slice(0, 3).join(' | '));
  await ctx.close();

  // ── P — planted offenders ──
  const src = (n) => fs.readFileSync(path.join(APP, n), 'utf8');
  const plant = (n, from, to) => { const s = src(n); if (s.indexOf(from) < 0) throw new Error('plant anchor missing in ' + n + ': ' + from.slice(0, 50)); return { [n]: s.split(from).join(to) }; };
  const plants = [
    ['P1 the drain returns silently with no sign-in (old)', plant('photo-inbox-offline.js', "    if (!_qcToken() || (typeof rrPassLapsed === 'function' && rrPassLapsed())) {", '    if (!_qcToken()) return;\n    if (false) {'), r => r.bWaitCalls === 1 && r.bUploaded === true],
    ['P2 the File stored instead of its bytes (old)', plant('photo-inbox-offline.js', '    var bytes = await _stageBytesOf(file);', '    var bytes = null;'), r => r.aBytes && r.aBlobNull],
    ['P3 the strip always says "uploading…" (old)', plant('photo-inbox-offline.js', "    if (bad) return W.unreadable || '';\n    if (failed) return _stageReasonOf(failed);", ''), r => /can’t be read/.test(r.aBadWords) && /Google sign-in/.test(r.b2Words)],
    ['P4 Google’s reason dropped (old)', plant('drive.js', "    return { error: 'session', status: sRes.status, reason: _reason };", "    return { error: 'session', status: sRes.status };"), r => r.cPick.reason === 'FAILED_PRECONDITION' && /hasn’t been set up/.test(r.cWords)],
    ['P5 the Add steps’ route shows "(400)" (old)', plant('drive.js', '  var _words = rrGPhotosErrorWords(res);', "  var _words = '';"), r => r.cErrText === r.cWords],
    ['P6 the steam names unknown (old)', plant('type-groups.js', 'k-?4s?|m-?1[ab]?|t-?1|ac-?(?:9|12)|class a|porter|tank engine|best friend of charleston|j-?1a?|j-?3a|y-?6b|', ''), r => r.d.k4 === 'Steam Locomotive'],
    ['P7 the card shows the purchase date (old)', plant('browse.js', "    yearProd: String(pd.yearMade || '').trim() || (_refItem ? _refItem.yearProd : ''),", "    yearProd: pd.datePurchased || (_refItem ? _refItem.yearProd : ''),")   /* 2026-10-31: the row builder moved to rrPersonalOnlyRow (4 spaces in) */, r => r.eNoSerial === true],
  ];
  for (const [name, served, check] of plants) {
    const o = await openApp(browser, served);
    let r = null;
    try { r = await scenario(o.pg); } catch (e) { r = null; }
    ok(name + ' — caught', !r || check(r) === false, r ? 'the check still passed' : '');
    await o.ctx.close();
  }
  await browser.close();
  console.log((fail ? 'FAILED' : 'GREEN') + '  york_fixes_2030_tests  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
