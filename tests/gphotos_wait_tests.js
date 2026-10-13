// ═══════════════════════════════════════════════════════════════════════════
// gphotos_wait_tests.js — v0.9.1936. The Google Photos waiting screen.
//
// [stated] Brad 2026-10-13: "when adding a picture using photo id, i pick from
// google photos, click my photo and hit done … i then have to manually switch
// back to the app … when i switch back to the app it show the google photo
// button again, and a few seconds it show the picture i selected. so for a few
// seconds, the user doesn't know to wait or to click or what to do. I think
// when we select the google photo, the app should switch to a 'waiting on photo
// to upload' screen or something like that so when it does upload, we get to
// the crop photo screen like it should."
//
//   A  drive.js's session helper, run for real on a fake clock with a
//      stand-in Google: the picker address ends in /autoclose (Google closes
//      its own tab on Done); the wait is cut short the moment the app's tab is
//      in front again — PLANTED: the old plain timer misses it
//   B  rrGPhotosPickFiles, run for real: the waiting panel goes up at once,
//      says what to do (wording from config.js), moves through waiting →
//      bringing it in, comes down on success, error and Cancel; Cancel stops
//      the wait; Back is wired; one photo or many
//   C  ONE door: only drive.js opens a Google Photos session; every caller but
//      the Photo Inbox comes through rrGPhotosPickFiles — PLANTED: a second
//      copy, or a caller going round the panel, fails the scan
//   D  Photo ID hands the picked file to the same path a computer file takes
//      (the crop screen follows)
//
// Run:  node tests/gphotos_wait_tests.js
// Proven to FAIL on v0.9.1935 (commit 97b1e47) before the build.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const APP = path.join(__dirname, '..', 'app');
const src = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (detail === undefined ? '' : JSON.stringify(detail)))); cond ? pass++ : fail++; }
function section(t) { console.log('\n== ' + t + ' =='); }
function constBlock(text, name) {
  const i = text.indexOf('const ' + name + ' = {');
  if (i < 0) return '';
  let d = 0, j = text.indexOf('{', i);
  for (let k = j; k < text.length; k++) {
    if (text[k] === '{') d++;
    else if (text[k] === '}') { d--; if (d === 0) return 'var' + text.slice(i + 5, k + 1) + ';'; }
  }
  return '';
}
const DRIVE = src('drive.js'), CFG = src('config.js');
const SLICE_START = '// ── Google Photos picker — SHARED';
function driveSlice(text) {
  const i = text.indexOf(SLICE_START);
  const j = text.indexOf("window.rrGPhotosEnd = rrGPhotosEnd;", i);
  const k = text.indexOf('}', j);
  return (i < 0 || j < 0) ? '' : text.slice(i, k + 1);
}
function makeWin(driveText) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://therailroster.test/app/', runScripts: 'outside-only' });
  const win = dom.window;
  win.eval(constBlock(CFG, 'RR_GPHOTOS_WAIT'));
  win.eval(driveSlice(driveText));
  return win;
}
const tick = () => new Promise(r => setImmediate(r));

(async function () {
  // ── A · the session helper ──────────────────────────────────────────────
  section('A · Google closes its own tab; the app checks the moment it is back');
  async function runSession(driveText) {
    const win = makeWin(driveText);
    let now = 0, seq = 0; const timers = [];
    win.setTimeout = (fn, ms) => { const id = ++seq; timers.push({ id, at: now + (ms || 0), fn }); return id; };
    win.accessToken = 'tok';
    win._ensurePhotosScope = async () => true;
    const tab = { location: '', close() {} };
    win.open = () => tab;
    let polls = 0, uriSeen = '', done = false, result = null;
    win.fetch = async (url, init) => {
      if (/\/v1\/sessions$/.test(url) && init && init.method === 'POST')
        return { ok: true, json: async () => ({ id: 'S1', pickerUri: 'https://photos.google.com/picker/S1', pollingConfig: { pollInterval: '60s' } }) };
      if (/\/v1\/sessions\/S1/.test(url)) { polls++; return { ok: true, json: async () => ({ mediaItemsSet: polls >= 2 }) }; }
      if (/mediaItems\?/.test(url)) return { ok: true, json: async () => ({ mediaItems: [{ type: 'PHOTO', mediaFile: { baseUrl: 'b', filename: 'a.jpg' } }] }) };
      return { ok: false, status: 404 };
    };
    win.rrGPhotosPickSession({ onUri: u => { uriSeen = u; } }).then(r => { done = true; result = r; });
    for (let i = 0; i < 50; i++) await tick();            // parked on its first wait (60 s), no timer fired
    const pollsBefore = polls;
    // The user comes back from Google Photos: the app's tab is in front again.
    Object.defineProperty(win.document, 'visibilityState', { value: 'visible', configurable: true });
    win.document.dispatchEvent(new win.Event('visibilitychange'));
    for (let i = 0; i < 50; i++) await tick();
    const pollsAfterReturn = polls;
    // finish the run the slow way so nothing is left hanging
    for (let g = 0; g < 200 && !done; g++) { await tick(); timers.sort((a, b) => a.at - b.at); const nx = timers.shift(); if (nx) { now = nx.at; nx.fn(); } }
    return { tabUri: tab.location, uriSeen, pollsBefore, pollsAfterReturn, result, done };
  }
  const A = await runSession(DRIVE);
  T('A1 the picker opens at an address ending in /autoclose (Google closes its tab on Done)', /\/autoclose$/.test(A.tabUri), A.tabUri);
  T('A2 …and that same address is handed to the caller (for "Open Google Photos")', A.uriSeen === A.tabUri, A.uriSeen);
  T('A3 coming back to the app asks Google AT ONCE — no waiting out the 60-second gap', A.pollsBefore === 0 && A.pollsAfterReturn >= 1, A);
  T('A4 …and the pick still completes', A.done && A.result && !A.result.error && A.result.items.length === 1, A.result);
  const plantedDrive = DRIVE.replace('    await _nap(iv);', '    await new Promise(function (r) { setTimeout(r, iv); });');
  if (plantedDrive === DRIVE) T('A5 PLANTED: could plant the old timer', false);
  else {
    const P = await runSession(plantedDrive);
    T('A5 PLANTED: with the old plain timer, coming back changes nothing (A3 would fail)', P.pollsAfterReturn === 0, P);
  }

  // ── B · the waiting panel ───────────────────────────────────────────────
  section('B · the waiting panel — up at once, says what to do, comes down');
  function harness(o) {
    o = o || {};
    const win = makeWin(DRIVE);
    const log = { ended: 0, guarded: 0, sessionOpts: null };
    win.rrDismissGuard = function (ov, fn) { log.guarded++; log.backFn = fn; };
    let resolveSession, resolveFile;
    win.rrGPhotosPickSession = function (opts) { log.sessionOpts = opts; return new Promise(r => { resolveSession = r; }); };
    win.rrGPhotosFile = function () { return new Promise(r => { resolveFile = r; }); };
    win.rrGPhotosEnd = function () { log.ended++; };
    const W = win.eval('RR_GPHOTOS_WAIT');
    const panel = () => win.document.getElementById('rr-gp-wait');
    const text = () => (panel() || {}).textContent || '';
    const btn = k => panel() && panel().querySelector('[data-gpw="' + k + '"]');
    return { win, log, W, panel, text, btn, session: v => resolveSession(v), file: v => resolveFile(v) };
  }
  // B1–B4: the happy path
  {
    const h = harness();
    let res = null;
    const p = h.win.rrGPhotosPickFiles({ max: 1, fallbackName: 'gphotos.jpg' }).then(r => { res = r; });
    T('B1 the panel is up the instant Google Photos opens (no await before it)', !!h.panel());
    T('B1 …with its words from config.js: the title and what to do', h.text().indexOf(h.W.title) >= 0 && h.text().indexOf(h.W.how) >= 0 && h.text().indexOf(h.W.after) >= 0, h.text());
    T('B1 …says it is opening Google Photos, and offers Cancel', h.text().indexOf(h.W.opening) >= 0 && h.btn('cancel') && h.btn('cancel').textContent === h.W.cancel);
    T('B1 …Back is wired and a stray tap on the backdrop does nothing (rrDismissGuard)', h.log.guarded === 1 && typeof h.log.backFn === 'function');
    h.log.sessionOpts.onUri('https://photos.google.com/picker/S1/autoclose');
    h.log.sessionOpts.onStatus('waiting');
    T('B2 while Google Photos is open it says it is waiting for Done', h.text().indexOf(h.W.waiting) >= 0, h.text());
    T('B2 …and offers "Open Google Photos" in case its tab got closed or lost', h.btn('reopen') && h.btn('reopen').style.display !== 'none');
    h.session({ items: [{ type: 'PHOTO', mediaFile: {} }], auth: {}, sessionId: 'S1' });
    for (let i = 0; i < 10; i++) await tick();
    T('B3 the moment the pick arrives it says it is bringing it in — the panel stays up', !!h.panel() && h.text().indexOf(h.W.fetching) >= 0, h.text());
    h.file(new h.win.File(['x'], 'IMG_1.jpg', { type: 'image/jpeg' }));
    await p;
    T('B4 …then the panel comes down and the photo is handed back', !h.panel() && res && res.files && res.files.length === 1 && res.files[0].name === 'IMG_1.jpg', res);
    T('B4 …and Google\'s session is closed once', h.log.ended === 1);
  }
  // B5: Cancel while waiting
  {
    const h = harness();
    let res = null;
    const p = h.win.rrGPhotosPickFiles({ max: 1 }).then(r => { res = r; });
    h.log.sessionOpts.onStatus('waiting');
    h.btn('cancel').click();
    T('B5 Cancel takes the panel down at once', !h.panel());
    T('B5 …and tells the wait to stop', h.log.sessionOpts.shouldAbort() === true);
    h.session({ error: 'cancelled' });
    await p;
    T('B5 …the result is "cancelled", which says nothing to the user', res && res.error === 'cancelled' && h.win.rrGPhotosErrText(res) === '', res);
  }
  // B6: errors close the panel and speak from config
  {
    const h = harness();
    let res = null;
    const p = h.win.rrGPhotosPickFiles({ max: 1 }).then(r => { res = r; });
    h.session({ error: 'timeout' });
    await p;
    T('B6 an error takes the panel down', !h.panel());
    T('B6 …and its message comes from config.js', h.win.rrGPhotosErrText(res) === h.W.err_timeout, h.win.rrGPhotosErrText(res));
    T('B6 …setup trouble (401/403) gets the setup steps', h.win.rrGPhotosErrText({ error: 'session', status: 403 }) === h.W.errSetup);
    T('B6 …anything else names its code', /\(500\)/.test(h.win.rrGPhotosErrText({ error: 'session', status: 500 })));
  }
  // B7: blocked tab
  {
    const h = harness();
    h.win.rrGPhotosPickFiles({ max: 1 });
    h.log.sessionOpts.onNeedTab('https://photos.google.com/picker/S1/autoclose');
    T('B7 a blocked Google Photos tab says so and shows "Open Google Photos"', h.text().indexOf(h.W.blocked) >= 0 && h.btn('reopen').style.display !== 'none', h.text());
  }
  // B8: many photos (the photo tray)
  {
    const h = harness();
    let res = null;
    const p = h.win.rrGPhotosPickFiles({ max: 2 }).then(r => { res = r; });
    T('B8 several photos: the panel says "photos"', h.text().indexOf(h.W.titleMany) >= 0 && h.text().indexOf(h.W.howMany) >= 0, h.text());
    let n = 0;
    h.win.rrGPhotosFile = async () => new h.win.File(['x'], 'p' + (++n) + '.jpg');
    h.session({ items: [{ type: 'PHOTO' }, { type: 'VIDEO' }, { type: 'PHOTO' }, { type: 'PHOTO' }], auth: {}, sessionId: 'S2' });
    await p;
    T('B8 …videos are left out and no more than asked for come back', res && res.files.length === 2 && res.picked === 3 && !h.panel(), res && { n: res.files.length, picked: res.picked });
  }

  // ── C · one door ────────────────────────────────────────────────────────
  section('C · ONE door to Google Photos');
  const FILES = {};
  fs.readdirSync(APP).filter(f => f.endsWith('.js')).forEach(f => { FILES[f] = src(f); });
  function scan(files) {
    const out = { sessions: [], bypass: [] };
    Object.keys(files).forEach(function (f) {
      const t = files[f];
      if (/photospicker\.googleapis\.com\/v1\/sessions'/.test(t) && f !== 'drive.js') out.sessions.push(f);
      if (f !== 'drive.js' && f !== 'photo-inbox.js' && /rrGPhotosPickSession\(\{/.test(t)) out.bypass.push(f);
    });
    return out;
  }
  const S = scan(FILES);
  T('C1 only drive.js opens a Google Photos session', S.sessions.length === 0, S.sessions);
  T('C2 every caller but the Photo Inbox comes through rrGPhotosPickFiles', S.bypass.length === 0, S.bypass);
  T('C3 Photo ID, "Add a picture first", the photo slots and the photo tray all do',
    /rrGPhotosPickFiles\(\{ max: 1/.test(FILES['barcode.js']) && /rrGPhotosPickFiles\(\{ max: 1/.test(FILES['wizard.js'])
    && (FILES['wizard-photos.js'].match(/rrGPhotosPickFiles\(\{ max: /g) || []).length >= 2);
  const p1 = Object.assign({}, FILES, { 'wizard-photos.js': FILES['wizard-photos.js'] + "\nfetch('https://photospicker.googleapis.com/v1/sessions', {});" });
  const p2 = Object.assign({}, FILES, { 'barcode.js': FILES['barcode.js'] + "\nwindow.rrGPhotosPickSession({ onStatus: function () {} });" });
  T('C4 PLANTED: a second copy of the session dance fails the scan', scan(p1).sessions.length === 1);
  T('C4 PLANTED: a caller going round the waiting panel fails the scan', scan(p2).bypass.length === 1);

  // ── D · Photo ID goes on to the crop screen ─────────────────────────────
  section('D · Photo ID: the picked photo takes the computer-file path (then the crop screen)');
  const bc = FILES['barcode.js'];
  const blk = bc.slice(bc.indexOf("if (act === 'gphotos'"), bc.indexOf("if (act === 'quick')"));
  T('D1 the Photo ID screen hands the file to _biIngestFile — the same path a computer file takes', /_biIngestFile\(res\.files\[0\]\)/.test(blk) && /if \(act === 'gallery'\)/.test(bc));
  T('D2 the old one-line status under the button is gone (the panel says it now)', !/bi-gp-status/.test(bc));
  T('D3 the wording has no "AI" in it (house rule)', !/\bAI\b/.test(constBlock(CFG, 'RR_GPHOTOS_WAIT')));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('GPHOTOS-WAIT TESTS FAILING'); process.exit(1); }
  console.log('ALL GPHOTOS-WAIT TESTS GREEN (' + pass + ')');
})().catch(e => { console.log('FAIL  the suite crashed: ' + (e && e.stack || e)); process.exit(1); });
