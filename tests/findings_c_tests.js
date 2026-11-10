#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════
// AUDIT FIXES C — five-platform audit, 2026-11-07 ([stated] Brad 12:00 CT
// "Yes" to building findings 10, 16, 17 and 18 as one hand-over). Real
// Chromium and — where it can start — the real Safari engine (WebKit), the
// REAL app.
//
//   F10 an Add Photos pick uploads the picture at once; Cancel → Discard sent
//       nothing to Drive, so the picture stayed (un-trashed) in the copy's
//       folder and came back at the next photo save ("saved twice"). Now a
//       discarded add sends every picture it uploaded to Drive's trash and
//       takes an emptied folder with it; a SAVED add keeps every one.
//   F16 the "Install The Rail Roster on this device?" offer stayed on top of a
//       window opened after it (iPhone: it covered the Add window's Cancel /
//       Next row). Now it steps aside while any pop-up is open (rr-pop-open).
//   F17 two overlays closing in the same instant made two history.back()
//       calls; the Safari engine merges them into ONE Back event, the Chrome
//       engine fires two — and the app's count then swallowed the person's
//       next real Back. Now one tick's pops become ONE history.go(-n).
//       2026-11-09, second half (the live re-run still failed A7 on iPhone,
//       iPad, Mac): the Safari engine ALSO drops a traversal asked for while
//       an earlier one is still on its way (a beat apart, not the same tick —
//       the Add window closes in two beats). Now ONE traversal is in flight
//       at a time; the rest go out when its popstate lands (F17h–F17k).
//   F18 the catalog's "Please select a filter…" prompt centred itself on the
//       table, which is wider than the pane on an iPad in portrait — its right
//       half was off the edge. Now it is pinned to the pane and as wide as it.
// Every fix is planted back (text-replaced in the CURRENT source) and caught.
// ═════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let pw;
try { pw = require('playwright'); }
catch (e) { console.log('FAILED  —  findings_c_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const BS = read('back-stack.js'), WIZ = read('wizard.js'), DRV = read('drive.js'), WPH = read('wizard-photos.js'), CSS = read('app.css'), BRW = read('browse.js');

async function open(browser, viewport, swap) {
  const pg = await browser.newPage(viewport && viewport.isMobile ? { viewport: { width: viewport.width, height: viewport.height }, hasTouch: true, isMobile: true } : { viewport });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('dialog', d => d.dismiss());
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const name = decodeURIComponent(u.split('?')[0]).split('/').pop();
    if (swap && swap[name] != null) return r.fulfill({ status: 200, contentType: name.endsWith('.css') ? 'text/css' : 'application/javascript', body: swap[name] });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  await pg.evaluate(() => {
    const mk = (n) => ({ itemNum: n, variation: '1', itemType: 'Boxcar', description: 'x', _era: 'pw', _tab: 'Lionel PW - Items', rowId: 'R' + n, yearProd: '1950', roadName: 'Santa Fe', gauge: 'O', varDesc: '' });
    state.masterData = [mk('6464-1'), mk('2343')]; _rebuildMasterIndex();
    state.personalSheetId = 'SID'; window.accessToken = 'tok'; accessToken = 'tok';
    state.personalData = {}; state.forSaleData = {}; state.soldData = {}; state.wantData = {}; state.upgradeData = {};
    document.getElementById('app').classList.add('active');
  });
  return { pg, errs };
}

// ── F10: a stand-in Drive that records every request; the wizard "closes" with uploads on its list ──
async function discard(pg, saved, offline, how) {   // how: 'confirmed' (default) | 'silent' | 'existing'
  return pg.evaluate(async ({ saved, offline, how }) => {
    window.__drive = [];
    // the stand-in: a trash PATCH answers ok; a folder listing says "empty"
    window.fetch = async (url, init) => {
      const u = String(url), m = (init && init.method) || 'GET';
      if (/googleapis\.com\/(upload\/)?drive/.test(u)) window.__drive.push(m + ' ' + u.replace(/^https:\/\/www\.googleapis\.com\/drive\/v3/, '').slice(0, 70));   // Drive only — the app's relay timers post elsewhere
      const body = /\/files\?q=/.test(u) ? { files: [] } : { id: 'x' };
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) };
    };
    window._offlineMode = !!offline;
    driveCache.itemFolders['2343/77'] = 'SUB77'; driveCache.itemFolders['2343'] = 'ITEM2343';
    startWizardFor('collection'); await new Promise(r => setTimeout(r, 400));   // the real Add window
    wizard.data.itemNum = '2343'; wizard.data._saveComplete = !!saved;
    const ex = how === 'existing';
    wizard.data._rrAddUploads = [{ id: 'PIC1', folderId: 'SUB77', itemNum: '2343', invId: '77', existing: ex }, { id: 'PIC2', folderId: 'SUB77', itemNum: '2343', invId: '77', existing: ex }];
    window.__drive.length = 0;
    if (how === 'silent') _doCloseWizard();                 // Back on the first step / the window's own ← Back: no question asked
    else { wizard.data._rrDiscardConfirmed = true; _doCloseWizard(); }   // the person chose Discard in "Discard this item?"

    await new Promise(r => setTimeout(r, 400));
    window._offlineMode = false;
    const log = (() => { try { return JSON.parse(localStorage.getItem('rr_sync_log') || '[]').filter(x => x.e === 'photo').slice(-2).map(x => x.i); } catch (e) { return []; } })();
    return { drive: window.__drive, cacheSub: driveCache.itemFolders['2343/77'] || '', cacheItem: driveCache.itemFolders['2343'] || '', listLeft: (wizard.data._rrAddUploads || []).length, log };
  }, { saved, offline, how });
}
// ── F10: the REAL upload path writes the picture down (a stand-in Drive answers the upload) ──
async function record(pg, discardedFirst) {
  return pg.evaluate(async (discardedFirst) => {
    window.__drive = [];
    window.fetch = async (url, init) => { const u = String(url), m = (init && init.method) || 'GET';
      if (/googleapis\.com\/(upload\/)?drive/.test(u)) window.__drive.push(m + ' ' + u.replace(/^https:\/\/www\.googleapis\.com\/drive\/v3/, '').slice(0, 70));
      const body = /\/files\?q=/.test(u) ? { files: [] } : { id: 'x' };
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) }; };
    window.driveUploadItemPhoto = async (file, num, view, inv, label, cb) => { await new Promise(r => setTimeout(r, 50)); cb({ id: 'NEW' + view, name: 'n', folderId: 'FOLD9' }); return 'https://drive.google.com/drive/folders/FOLD9'; };
    startWizardFor('collection'); await new Promise(r => setTimeout(r, 400));
    wizard.data.itemNum = '2343'; wizard.data._photoInventoryId = '9';
    const d = wizard.data;
    const p = uploadWizardPhoto(new File([new Uint8Array(10)], 'a.jpg', { type: 'image/jpeg' }), 'photosItem', 'FV');
    if (discardedFirst) { d._rrDiscardConfirmed = true; _doCloseWizard(); }   // Discard chosen while the picture is still going up
    await p; await new Promise(r => setTimeout(r, 300));
    return { list: (d._rrAddUploads || []).map(u => u.id + '@' + u.folderId + '/' + u.invId + (u.existing ? '/existing' : '')), drive: window.__drive };
  }, !!discardedFirst);
}
// ── F16: the offer on screen, then a pop-up opens on top ──
async function offerVsPopup(pg) {
  return pg.evaluate(async () => {
    // the start-up "scanning" card / Dispatch Board pop-up of this stand-in page are pop-ups too — out of the way first
    document.querySelectorAll('#rr-ai-usage-card, #db-popup').forEach(n => n.remove()); await new Promise(r => setTimeout(r, 400));
    const b = document.createElement('div'); b.id = 'pwa-install-offer';
    b.style.cssText = 'position:fixed;bottom:5.5rem;left:0;right:0;margin:0 auto;z-index:9995;width:min(92vw,420px);height:90px;background:#fff;display:flex';
    document.body.appendChild(b);
    const vis = () => getComputedStyle(b).display !== 'none';
    const before = vis();
    startWizardFor('collection');
    await new Promise(r => setTimeout(r, 700));
    const popClass = document.documentElement.classList.contains('rr-pop-open');
    const during = vis();
    _doCloseWizard();
    // the first Add shows the once-per-account "scanning / Photo ID" help card — a pop-up of its own; it goes too
    document.querySelectorAll('#rr-ai-usage-card').forEach(n => n.remove());
    await new Promise(r => setTimeout(r, 700));
    const after = vis();
    b.remove();
    return { before, popClass, during, after };
  });
}
// ── F18: the catalog prompt at an iPad's width ──
async function promptFit(pg) {
  return pg.evaluate(() => {
    _currentEra = 'all'; showPage('browse'); resetFilters(); renderBrowse();
    const td = document.getElementById('rr-catalog-prompt-td'); if (!td) return { noPrompt: true };
    const box = td.firstElementChild, wrap = td.closest('.browse-table-wrap');
    const br = box.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    const inner = box.firstElementChild.getBoundingClientRect();   // the blue card
    return { boxRight: Math.round(br.right), paneRight: Math.round(wr.right), boxLeft: Math.round(br.left), paneLeft: Math.round(wr.left),
             cardRight: Math.round(inner.right), tableWider: wrap.scrollWidth > wrap.clientWidth, words: box.innerText.slice(0, 40) };
  });
}

const EX = '/opt/pw-browsers/chromium';
const launchChromium = () => pw.chromium.launch(fs.existsSync(EX) ? { executablePath: EX } : {});
const launchWebkit = () => pw.webkit.launch();
(async () => {
  const chromium = pw.chromium, browser = await chromium.launch(fs.existsSync(EX) ? { executablePath: EX } : {});

  // ── F10 ──
  {
    const { pg, errs } = await open(browser);
    const d = await discard(pg, false);
    T('F10a a discarded add sends each uploaded picture to Drive\'s trash', d.drive.filter(x => /^PATCH \/files\/PIC[12]/.test(x)).length === 2, d.drive);
    T('F10b …and the emptied copy folder, then the emptied number folder, go too', d.drive.some(x => /^PATCH \/files\/SUB77/.test(x)) && d.drive.some(x => /^PATCH \/files\/ITEM2343/.test(x)), d.drive);
    T('F10c the folder cache forgets both folders (a later upload makes fresh ones)', d.cacheSub === '' && d.cacheItem === '', d);
    T('F10d the list is emptied so a second close sends nothing twice', d.listLeft === 0, d);
    T('F10e the sync log says what went', d.log.some(x => /discarded add: 2 picture/.test(x)), d.log);
    const s = await discard(pg, true);
    T('F10f a SAVED add keeps every picture (nothing sent to Drive)', s.drive.length === 0, s.drive);
    const o = await discard(pg, false, true);
    T('F10g offline: nothing is sent (Drive is not reachable) and the log says the pictures stay', o.drive.length === 0 && o.log.some(x => /offline/.test(x)), o);
    const q = await discard(pg, false, false, 'silent');
    T('F10i a SILENT close (Back on the first step, the window\'s own ← Back) keeps the pictures — no question was asked', q.drive.length === 0, q.drive);
    const x = await discard(pg, false, false, 'existing');
    T('F10j an EXISTING copy\'s add (Update Info / Pictures): the pictures go, its folder is left alone', x.drive.filter(z => /PATCH \/files\/PIC/.test(z)).length === 2 && !x.drive.some(z => /SUB77|ITEM2343/.test(z)), x.drive);
    const rec = await record(pg, false);
    T('F10k the real upload path writes the picture down (id, folder, copy)', rec.list.join(',') === 'NEWFV@FOLD9/9', rec);
    const late = await record(pg, true);
    T('F10l a picture that lands AFTER Discard goes straight to the trash and is not kept on any list', late.list.length === 0 && late.drive.some(z => /PATCH \/files\/NEWFV/.test(z)), late);
    T('F10h no page errors', errs.length === 0, errs);
    await pg.close();
  }
  {
    const a = "          _rrNoteAddUpload(d, { id: up.id, folderId: up.folderId || '', itemNum: itemNum, invId: _invId || '', existing: !!(d._existingInventoryId || d._photoOnly || d._updatePdKey) });\n";
    T('F10 P1 anchor present (once)', WPH.split(a).length === 2);
    const b = "        window.rrDiscardAddUploads(_ups).catch(function (eD) { console.warn('[wizard] discarded add: pictures not taken back', eD); });\n";
    T('F10 P2 anchor present (once)', WIZ.split(b).length === 2);
    const { pg } = await open(browser, null, { 'wizard.js': WIZ.replace(b, '') });
    const d = await discard(pg, false);
    T('F10 P2 PLANTED the close no longer takes the pictures back → F10a would fail', d.drive.length === 0, d.drive);
    await pg.close();
    const { pg: p1 } = await open(browser, null, { 'wizard-photos.js': WPH.replace(a, '') });
    const r1 = await record(p1, false);
    T('F10 P1 PLANTED the upload is not written down → F10k would fail', r1.list.length === 0, r1);
    await p1.close();
  }

  // ── F16 ──
  {
    const { pg, errs } = await open(browser, { width: 390, height: 844, isMobile: true });
    const r = await offerVsPopup(pg);
    T('F16a the offer shows on its own', r.before === true, r);
    T('F16b the Add window opening marks a pop-up open (rr-pop-open on <html>)', r.popClass === true, r);
    T('F16c …and the offer steps aside while it is open', r.during === false, r);
    T('F16d …and is back when the window closes', r.after === true, r);
    T('F16e no page errors', errs.length === 0, errs);
    await pg.close();
    const rule = 'html.rr-pop-open #pwa-install-offer { display: none !important; }\n';
    T('F16 P anchor present (once)', CSS.split(rule).length === 2);
    const { pg: p2 } = await open(browser, { width: 390, height: 844, isMobile: true }, { 'app.css': CSS.replace(rule, '') });
    const q = await offerVsPopup(p2);
    T('F16 P PLANTED without the rule the offer stays on top of the open window → F16c would fail', q.during === true, q);
    await p2.close();
  }

  // ── F17 (back-stack.js alone, the way back_stack_double_pop_tests does it) ──
  async function backTrace(engine, src) {
    const b = await engine(); const pg = await b.newPage();
    await pg.route('https://rr.test/**', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body><script>' + src + '</script></body>' }));
    await pg.goto('https://rr.test/app/');
    const out = await pg.evaluate(async () => {
      window.__closedA = 0; window.__go = []; const hg = history.go.bind(history), hb = history.back.bind(history);
      history.go = (n) => { window.__go.push('go(' + n + ')'); return hg(n); }; history.back = () => { window.__go.push('back()'); return hb(); };
      BackStack.push('A', () => { window.__closedA++; });
      BackStack.push('B', () => {}); BackStack.push('C', () => {});
      BackStack.pop('C'); BackStack.pop('B');             // two overlays gone in the same instant
      await new Promise(r => setTimeout(r, 600));
      const calls = window.__go.slice(), stillOpen = BackStack.size(), closedBefore = window.__closedA;
      hb();                                               // the person presses Back
      await new Promise(r => setTimeout(r, 600));
      return { calls, stillOpen, closedBefore, closedA: window.__closedA, size: BackStack.size() };
    });
    await b.close(); return out;
  }
  {
    const c = await backTrace(launchChromium, BS);
    T('F17a two pops in one tick ask the browser for ONE traversal, history.go(-2)', c.calls.length === 1 && c.calls[0] === 'go(-2)', c);
    T('F17b the overlay below stays open after that', c.stillOpen === 1 && c.closedBefore === 0, c);
    T('F17c the person\'s next Back closes it — nothing swallowed (Chrome engine)', c.closedA === 1 && c.size === 0, c);
    let wk = null;
    try { const w = await launchWebkit(); await w.close(); wk = launchWebkit; } catch (e) { console.log('NOTE  the Safari engine (WebKit) cannot start here — F17 checked on the Chrome engine only'); }
    if (wk) {
      const s = await backTrace(wk, BS);
      T('F17d the SAME on the Safari engine: one go(-2), the overlay below open, the next Back closes it', s.calls.length === 1 && s.calls[0] === 'go(-2)' && s.stillOpen === 1 && s.closedBefore === 0 && s.closedA === 1 && s.size === 0, s);
    }
    // planted: one history.back() per pop (the old way) — on the Safari engine the person's Back is swallowed
    const old = BS.replace('    _queueBack();\n  }', '    _ignorePops++; try { history.back(); } catch (e) {}\n  }');
    T('F17 P anchor present', old !== BS);
    const pc = await backTrace(launchChromium, old);
    T('F17 P1 PLANTED (old way): two traversals are asked for → F17a would fail', pc.calls.length === 2, pc);
    if (wk) { const ps = await backTrace(wk, old); T('F17 P2 PLANTED (old way) on the Safari engine: the person\'s Back is SWALLOWED → F17d would fail', ps.closedA === 0 && ps.size === 1, ps); }
  }
  // F17: close one, open another in the same instant — and the review's case: pop, push, pop in one task
  async function popPushPop(engine) {
    const b = await engine(); const pg = await b.newPage();
    await pg.route('https://rr.test/**', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body><script>' + BS + '</script></body>' }));
    await pg.goto('https://rr.test/app/');
    const r = await pg.evaluate(async () => {
      window.__seq = []; const hg = history.go.bind(history), hp = history.pushState.bind(history), hr = history.replaceState.bind(history);
      history.go = (n) => { window.__seq.push('go(' + n + ')'); return hg(n); }; history.pushState = (a, b2, c) => { window.__seq.push('push'); return hp(a, b2, c); };
      history.replaceState = (a, b2, c) => { window.__seq.push('replace'); return hr(a, b2, c); };
      window.__closedBase = 0; BackStack.push('base', () => { window.__closedBase++; });
      BackStack.push('A', () => {}); window.__seq.length = 0;
      BackStack.pop('A'); BackStack.push('B', () => {});   // the chooser steps aside for the panel, same instant
      await new Promise(r2 => setTimeout(r2, 300));
      const one = window.__seq.slice(); window.__seq.length = 0;
      // the review's case: pop, push, then another pop before the task ends
      BackStack.pop('B'); BackStack.push('C', () => {}); BackStack.pop('C');
      await new Promise(r2 => setTimeout(r2, 300));
      const two = window.__seq.slice(); const sizeBefore = BackStack.size();
      history.back();                                       // the person presses Back
      await new Promise(r2 => setTimeout(r2, 400));
      return { one, two, sizeBefore, closedBase: window.__closedBase, size: BackStack.size() };
    });
    await b.close(); return r;
  }
  {
    const r = await popPushPop(launchChromium);
    T('F17e a pop then a push in one instant: the new window takes the old one\'s place in history — no traversal', r.one.join(' ') === 'replace', r);
    T('F17f pop, push, pop in one task: at most ONE traversal, and the person\'s next Back still closes what is below (Chrome engine)', r.two.filter(x => /^go/.test(x)).length <= 1 && r.sizeBefore === 1 && r.closedBase === 1 && r.size === 0, r);
    let wk2 = null; try { const w = await launchWebkit(); await w.close(); wk2 = launchWebkit; } catch (e) {}
    if (wk2) { const sr = await popPushPop(wk2); T('F17g …and on the Safari engine', sr.two.filter(x => /^go/.test(x)).length <= 1 && sr.sizeBefore === 1 && sr.closedBase === 1 && sr.size === 0, sr); }
  }

  // F17 second half (2026-11-09): two pops a BEAT apart — the second traversal must wait for the first's popstate
  async function beatApart(engine, src, gap) {
    const b = await engine(); const pg = await b.newPage();
    // the listener goes in BEFORE back-stack.js loads, so it runs first (its own handler stops the event for everyone after it)
    await pg.addInitScript(() => { window.__seq = []; window.addEventListener('popstate', () => { window.__seq.push('pop'); }); });
    await pg.route('https://rr.test/**', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body><script>' + src + '</script></body>' }));
    await pg.goto('https://rr.test/app/');
    const out = await pg.evaluate(async (gap) => {
      window.__seq.length = 0; const hg = history.go.bind(history);
      history.go = (n) => { window.__seq.push('go(' + n + ')'); return hg(n); };
      window.__closedA = 0; BackStack.push('A', () => { window.__closedA++; });
      BackStack.push('B', () => {}); BackStack.push('C', () => {});
      BackStack.pop('C');
      if (gap === 'microtask') { await Promise.resolve(); await Promise.resolve(); } else { await new Promise(r => setTimeout(r, 0)); }
      BackStack.pop('B');                                 // a beat later — the element watcher's pop, the Add window's second step
      await new Promise(r => setTimeout(r, 700));
      const seq = window.__seq.slice(), stillOpen = BackStack.size(), closedBefore = window.__closedA;
      history.back();                                     // the person presses Back
      await new Promise(r => setTimeout(r, 700));
      return { seq, stillOpen, closedBefore, closedA: window.__closedA, size: BackStack.size() };
    }, gap);
    await b.close(); return out;
  }
  {
    const waited = s => s.seq.join(' ') === 'go(-1) pop go(-1) pop';     // the second ask only AFTER the first answer
    for (const gap of ['microtask', 'task']) {
      const c = await beatApart(launchChromium, BS, gap);
      T('F17h two pops a ' + gap + ' apart: the second traversal waits for the first popstate (Chrome engine)', waited(c) && c.stillOpen === 1 && c.closedBefore === 0, c);
      T('F17i …and the person\'s next Back closes the overlay below (Chrome engine, ' + gap + ')', c.closedA === 1 && c.size === 0, c);
    }
    let wk3 = null; try { const w = await launchWebkit(); await w.close(); wk3 = launchWebkit; } catch (e) {}
    if (wk3) for (const gap of ['microtask', 'task']) {
      const s = await beatApart(wk3, BS, gap);
      T('F17j the SAME on the Safari engine (' + gap + ' apart): waited, overlay below open, the next Back closes it', waited(s) && s.stillOpen === 1 && s.closedBefore === 0 && s.closedA === 1 && s.size === 0, s);
    }
    // planted: no waiting — a traversal is asked for while the earlier one is still on its way
    const guard = '    if (_goInFlight) return;               // _onPopState (or the timer) flushes again\n';
    T('F17 P3 anchor present (once)', BS.split(guard).length === 2);
    const eager = BS.replace(guard, '');
    const pc = await beatApart(launchChromium, eager, 'microtask');
    T('F17 P3 PLANTED (no waiting): the second traversal is asked for BEFORE the first answers → F17h would fail', pc.seq.slice(0, 2).join(' ') === 'go(-1) go(-1)', pc);
    if (wk3) { const ps = await beatApart(wk3, eager, 'microtask'); T('F17 P4 PLANTED (no waiting) on the Safari engine: the person\'s Back is SWALLOWED → F17j would fail', ps.closedA === 0 && ps.size === 1, ps); }
  }

  // F17k a traversal the browser never answers (nowhere to go) is given up after a moment — a real Back is not swallowed for it
  async function unanswered(engine, src) {
    const b = await engine(); const pg = await b.newPage();
    await pg.route('https://rr.test/**', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body><script>' + src + '</script></body>' }));
    await pg.goto('https://rr.test/app/');
    const out = await pg.evaluate(async () => {
      const hb = history.back.bind(history);
      history.go = () => {};                               // the browser swallows the ask — no popstate ever comes
      window.__closedB = 0; BackStack.push('A', () => {}); BackStack.push('B', () => { window.__closedB++; }); BackStack.push('C', () => {});
      BackStack.pop('C');
      await new Promise(r => setTimeout(r, 2200));         // past GO_ANSWER_MS
      hb();                                                // the person presses Back → B must close
      await new Promise(r => setTimeout(r, 600));
      return { closedB: window.__closedB, size: BackStack.size() };
    });
    await b.close(); return out;
  }
  {
    const u = await unanswered(launchChromium, BS);
    T('F17k an unanswered traversal is given up after a moment: the person\'s Back still closes the overlay', u.closedB === 1 && u.size === 1, u);
    let wk4 = null; try { const w = await launchWebkit(); await w.close(); wk4 = launchWebkit; } catch (e) {}
    if (wk4) { const us = await unanswered(wk4, BS); T('F17k …and on the Safari engine (the one that drops a go with nowhere to go)', us.closedB === 1 && us.size === 1, us); }
    const timer = '    _goTimer = setTimeout(_goUnanswered, GO_ANSWER_MS);\n';
    T('F17 P5 anchor present (once)', BS.split(timer).length === 2);
    const pu = await unanswered(launchChromium, BS.replace(timer, ''));
    T('F17 P5 PLANTED (no give-up timer): the person\'s Back is SWALLOWED → F17k would fail', pu.closedB === 0 && pu.size === 2, pu);
  }

  // F17l a push while a traversal is on its way (no step owed) waits for its answer — the new entry is not stranded
  async function pushInFlight(engine, src) {
    const b = await engine(); const pg = await b.newPage();
    await pg.addInitScript(() => { window.__pagePops = 0; window.addEventListener('popstate', () => { window.__pagePops++; }); });
    await pg.route('https://rr.test/**', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body><script>' + src + '</script></body>' }));
    await pg.goto('https://rr.test/app/');
    const out = await pg.evaluate(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 3; i++) history.pushState({ floor: i }, '', '');   // room below the floor
      const closed = []; const push = id => BackStack.push(id, () => { closed.push(id); });
      push('A'); push('B'); BackStack.pop('B');            // go(-1) on its way…
      await w(0); push('C');                               // …and a beat later a new window opens
      await w(700);
      const sizeBefore = BackStack.size(), lenBefore = history.length, popsBefore = window.__pagePops;
      history.back(); await w(600);                         // closes C
      history.back(); await w(600);                         // closes A — and must NOT step below the floor as well
      const reached = window.__pagePops - popsBefore;       // page-level popstates (the init listener sees every one)
      const landed = (history.state && history.state.floor !== undefined) ? history.state.floor : null;   // the floor entry (2) — or below it
      return { sizeBefore, lenBefore, closed, size: BackStack.size(), reached, landed };
    });
    await b.close(); return out;
  }
  {
    // two real Backs → two popstates (closes C, then A) and the page sits on the floor entry again; with the new entry stranded in the forward list the second Back lands BELOW the floor (one more Back than windows)
    const ok = r => r.sizeBefore === 2 && r.closed.join('') === 'CA' && r.size === 0 && r.reached === 2 && r.landed === 2;
    const c = await pushInFlight(launchChromium, BS);
    T('F17l a window opened while a rewind is on its way: two Backs close the two windows, nothing more (Chrome engine)', ok(c), c);
    let wk5 = null; try { const w = await launchWebkit(); await w.close(); wk5 = launchWebkit; } catch (e) {}
    if (wk5) { const s = await pushInFlight(wk5, BS); T('F17l …and on the Safari engine', ok(s), s); }
    const defer = '      _pushesDeferred++;                          // 2026-11-09: added the moment the traversal on its way lands\n';
    T('F17 P6 anchor present (once)', BS.split(defer).length === 2);
    const eager = BS.replace(defer, "      try { history.pushState(state, '', ''); } catch (e) {}\n");
    const pc = await pushInFlight(launchChromium, eager);
    T('F17 P6 PLANTED (pushed at once): the new entry is stranded — the second Back lands below the floor → F17l would fail', !ok(pc) && pc.landed !== 2, pc);
  }

  // ── F18 ──
  {
    const { pg, errs } = await open(browser, { width: 810, height: 1080 });
    const r = await promptFit(pg);
    T('F18a at an iPad\'s width the catalog table is wider than the pane (it scrolls sideways)', !r.noPrompt && r.tableWider === true, r);
    T('F18b …but the prompt box sits wholly inside the pane and spans it (less the cell\'s own padding)', !r.noPrompt && r.boxLeft >= r.paneLeft - 1 && r.boxRight <= r.paneRight + 1 && (r.boxRight - r.boxLeft) >= (r.paneRight - r.paneLeft) - 40, r);
    T('F18c …so the blue card is wholly on screen', !r.noPrompt && r.cardRight <= r.paneRight + 1, r);
    T('F18d the prompt words are the ones a computer sees', /Please select a filter/.test(r.words || ''), r);
    T('F18e no page errors', errs.length === 0, errs);
    await pg.close();
    const a = "    try { _rrCatalogPromptFit(); } catch (eFit) {}   // audit finding 18 (2026-11-07): the prompt stays inside the visible pane\n";
    T('F18 P anchor present (once)', BRW.split(a).length === 2);
    const { pg: p2 } = await open(browser, { width: 810, height: 1080 }, { 'browse.js': BRW.replace(a, '') });
    const q = await promptFit(p2);
    T('F18 P PLANTED without the fit the card runs past the pane\'s right edge → F18c would fail', !q.noPrompt && q.cardRight > q.paneRight + 1, q);
    await p2.close();
  }

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  crashed: ' + (e && e.stack || e)); process.exit(1); });
