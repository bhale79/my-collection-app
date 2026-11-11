#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TRR Pro — GOOGLE'S FILE PICKER: the ONE door, and the proof report
// (real Chromium, the REAL app, a stand-in Drive + Sheets: tests/lib/coll-world.js,
//  and a STAND-IN picker — nothing here talks to Google)
//
// Plan PLAN_2026-11-10_TRR_PRO_R9_STAFF.md, Step 1; [stated] Brad 2026-11-10
// 06:09 CT "go ahead and do the google thing", 11:25 CT "yes" to Step 1.
//   G  source guards, each PROVED on a planted offender: the picker is loaded
//      and built ONLY in drive-picker.js; the key and app ID live ONLY in
//      config.js; the file is loaded, cached and a core file
//   D  the door: the app's own pass, the key, the app ID, My Drive + Shared
//      with me, folders only when asked; picked / cancelled; one at a time; a
//      lapsed pass that cannot be renewed opens nothing; a failed load says so
//      and the door works again after
//   P  the proof: answer A (inside can be seen and opened), B (only the
//      folder), none (not even the folder), part (something will not open);
//      "Look again" never picks again and sees a file added since; a
//      cancelled pick shows and saves nothing
//   X  a regular customer: no Business tools, the proof does nothing
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  drive_picker_tests needs playwright and it is not installed.'); process.exit(1); }
const { boot, APP } = require('./lib/coll-world');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 1200))); cond ? pass++ : fail++; }
function strip(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n'); }

// ── G · source guards ──────────────────────────────────────────────────────
// G1 the picker is loaded and built in ONE file. Any app file other than
// drive-picker.js that builds a picker, loads it, or names its frame is a second door.
const DOOR_RE = /PickerBuilder|gapi\.load\(\s*['"]picker|docs\.google\.com\/picker|RR_DRIVE_PICKER\.loader|\.setOAuthToken\(/;
function secondDoors(files) { return files.filter(f => f.name !== 'drive-picker.js' && DOOR_RE.test(strip(f.src))).map(f => f.name); }
function appFiles() { return fs.readdirSync(APP).filter(f => /\.(js|html)$/.test(f)).map(f => ({ name: f, src: read(f) })); }
// G2 the key and the app ID are written in ONE place (config.js).
function keyCopies(files, key) { return files.filter(f => f.src.indexOf(key) >= 0).map(f => f.name); }
function guards() {
  console.log('\n== G · source guards ==');
  const files = appFiles();
  T('G1 the picker is loaded and built ONLY in drive-picker.js', secondDoors(files).length === 0, secondDoors(files));
  T('G1 drive-picker.js really is the door (it builds the picker)', DOOR_RE.test(strip(read('drive-picker.js'))));
  const planted = files.concat([{ name: 'browse.js', src: read('browse.js') + '\nfunction x() { new google.picker.PickerBuilder().build(); }' }]);
  T('G1b PLANTED: a second picker in browse.js → caught', secondDoors(planted).indexOf('browse.js') >= 0, secondDoors(planted));
  const planted2 = files.concat([{ name: 'gift.js', src: "function y() { gapi.load('picker', z); }" }]);
  T('G1c PLANTED: a second load of the picker → caught', secondDoors(planted2).indexOf('gift.js') >= 0);
  const cfg = read('config.js');
  const key = (/apiKey:\s*'([^']+)'/.exec(cfg.slice(cfg.indexOf('var RR_DRIVE_PICKER'))) || [])[1] || '';
  const appId = (/appId:\s*'([^']+)'/.exec(cfg.slice(cfg.indexOf('var RR_DRIVE_PICKER'))) || [])[1] || '';
  T('G2 config.js holds the picker key and the app ID', /^AIza/.test(key) && /^\d{6,}$/.test(appId), { key: key.slice(0, 6), appId });
  T('G2 the key is written ONCE (config.js only)', JSON.stringify(keyCopies(files, key)) === '["config.js"]', keyCopies(files, key));
  T('G2 the app ID is written ONCE (config.js only)', JSON.stringify(keyCopies(files, "'" + appId + "'")) === '["config.js"]', keyCopies(files, appId));
  T('G2b PLANTED: a copy of the key in drive-picker.js → caught', keyCopies(files.concat([{ name: 'drive-picker.js', src: "var k = '" + key + "';" }]), key).length === 2);
  const ix = read('index.html');
  T('G3 index.html loads drive-picker.js once, after config.js', (ix.match(/drive-picker\.js\?v=/g) || []).length === 1 && ix.indexOf('drive-picker.js?v=') > ix.indexOf('config.js?v='));
  T('G4 the offline cache holds drive-picker.js', /'\.\/drive-picker\.js'/.test(read('sw.js')));
  const cf = JSON.parse(fs.readFileSync(path.join(__dirname, 'lib', 'core-files.json'), 'utf8'));
  T('G5 drive-picker.js is a core file', JSON.stringify(cf).indexOf('app/drive-picker.js') >= 0);
  const csp = (/<meta http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"/.exec(ix) || [])[1] || '';
  const frames = ((/frame-src ([^;]+)/.exec(csp) || [])[1] || '').trim().split(/\s+/);
  T('G6 the page lets Google\'s picker frame open (docs.google.com) and its scripts load (apis.google.com)', frames.indexOf('https://docs.google.com') >= 0 && /script-src[^;]*https:\/\/apis\.google\.com/.test(csp), frames);
}

// ── the stand-in picker ─────────────────────────────────────────────────────
// google.picker with the same names the real one has. window.__pick decides
// what the person does: { docs: [...] } picks them, { cancel: true } cancels,
// { hold: true } leaves it open (the next call must be refused).
async function standIn(pg) {
  await pg.evaluate(() => {
    window.__built = [];
    window.__pick = { docs: [{ id: 'PF', name: 'Staff check', mimeType: 'application/vnd.google-apps.folder' }] };
    function View(id) { this.id = id; this.calls = []; }
    ['setIncludeFolders', 'setSelectFolderEnabled', 'setMimeTypes', 'setOwnedByMe', 'setLabel'].forEach(m => {
      View.prototype[m] = function (v) { this.calls.push([m, v]); return this; };
    });
    function Builder() { this.b = { views: [] }; }
    const set = (k) => function (v) { this.b[k] = v; return this; };
    Builder.prototype.setOAuthToken = set('token');
    Builder.prototype.setDeveloperKey = set('key');
    Builder.prototype.setAppId = set('appId');
    Builder.prototype.setTitle = set('title');
    Builder.prototype.setCallback = set('cb');
    Builder.prototype.enableFeature = function (f) { (this.b.features = this.b.features || []).push(f); return this; };
    Builder.prototype.addView = function (v) { this.b.views.push(v); return this; };
    Builder.prototype.build = function () {
      const b = this.b; window.__built.push(b);
      return { dispose: function () { b.disposed = true; }, setVisible: function (on) {
        (b.visible = b.visible || []).push(on);
        if (on === false) return;
        const p = window.__pick;
        setTimeout(() => {
          if (p.hold) return;
          b.cb({ action: 'loaded' });
          if (p.cancel) b.cb({ action: 'cancel' });
          else b.cb({ action: 'picked', docs: p.docs });
        }, 30);
      } };
    };
    window.google = window.google || {};
    window.google.picker = ({
      PickerBuilder: Builder, DocsView: View,
      ViewId: { DOCS: 'all' }, Action: { PICKED: 'picked', CANCEL: 'cancel', LOADED: 'loaded' },
      Response: { ACTION: 'action', DOCUMENTS: 'docs' }, Document: { ID: 'id', NAME: 'name', MIME_TYPE: 'mimeType' },
      Feature: { MULTISELECT_ENABLED: 'multi' },
    });
  });
}

// ── the stand-in folder the spare account picks ─────────────────────────────
// What the app can see is decided per test (window.__see):
//   folder: true/false   the folder's own metadata
//   kids:   the things listed inside, by folder id
//   deny:   ids whose CONTENT is refused (403)
async function seeWorld(pg) {
  await pg.evaluate(() => {
    const FOLDER = 'application/vnd.google-apps.folder', SHEET = 'application/vnd.google-apps.spreadsheet';
    window.__FULL = {
      PF: [{ id: 'PS1', name: 'The Rail Roster – 1 Staff check', mimeType: SHEET }, { id: 'PPH', name: 'Photos', mimeType: FOLDER }, { id: 'PSOLD', name: 'Sold Photos', mimeType: FOLDER }],
      PPH: [{ id: 'PIMG1', name: 'Lionel 2343 ID45 RSV.jpg', mimeType: 'image/jpeg' }, { id: 'PIMG2', name: 'Lionel 2343 ID45 LSV.jpg', mimeType: 'image/jpeg' }],
      PSOLD: [],
    };
    window.__see = { folder: true, kids: window.__FULL, deny: [] };
    window.__S.PS1 = { 'My Collection': [['My Collection'], ['Item Number', 'Inventory ID'], ['2343', '45']] };
    window.__seeCalls = [];
    const inner = window.fetch;
    const okR = (b) => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
    const bad = (s) => ({ ok: false, status: s, json: async () => ({ error: { code: s, message: 'nope' } }), text: async () => JSON.stringify({ error: { code: s, message: 'nope' } }) });
    window.fetch = async function (url, opts) {
      const u = decodeURIComponent(String(url));
      // a sheet of the picked folder: Google reads 'A1:B2' from its FIRST tab
      const sv = /sheets\.googleapis\.com\/v4\/spreadsheets\/(P[A-Z0-9]+)\/values\/([^?]+)/.exec(u);
      if (sv) {
        window.__seeCalls.push({ id: sv[1], u, sheet: true, range: sv[2] });
        if (window.__see.deny.indexOf(sv[1]) >= 0) return bad(403);
        const tabs = window.__S[sv[1]] || {}; const first = tabs[Object.keys(tabs)[0]] || [];
        return okR({ range: sv[2], values: first.slice(0, 2).map(r => r.slice(0, 2)) });
      }
      const mine = /'(P[A-Z0-9]+)' in parents/.exec(u) || /drive\/v3\/files\/(P[A-Z0-9]+)\?/.exec(u);
      if (!mine || !/googleapis\.com\/drive\/v3\/files/.test(u)) return inner(url, opts);
      const id = mine[1];
      window.__seeCalls.push({ id, u, range: opts && opts.headers && opts.headers.Range });
      if (/ in parents/.test(u)) return okR({ files: (window.__see.kids[id] || []) });
      if (/alt=media/.test(u)) return window.__see.deny.indexOf(id) >= 0 ? bad(403) : okR({});
      if (id === 'PF') return window.__see.folder ? okR({ id: 'PF', name: 'Staff check', mimeType: FOLDER }) : bad(404);
      return okR({ id });
    };
  });
}

async function world(browser, opts) {
  const b = await boot({ newPage: () => browser.newPage({ viewport: { width: 1200, height: 900 } }) }, opts);
  // The stand-in picker defines window.google. The app's start-up waits up to
  // 4 s for Google's SIGN-IN script by checking that very name (app.js), so a
  // stand-in put there sooner is taken for the sign-in script under a loaded
  // machine ("reading 'oauth2'"). In the real app the picker only ever opens
  // after sign-in. So: wait the start-up window out first.
  await b.pg.waitForTimeout(4500);
  await standIn(b.pg);
  await seeWorld(b.pg);
  return b;
}
const proofText = (pg) => pg.evaluate(() => { const d = document.getElementById('rr-picker-proof'); return d ? d.innerText : ''; });
async function waitReport(pg) {
  await pg.waitForFunction(() => { const d = document.getElementById('rr-picker-proof'); return d && d.querySelector('[data-pp-answer]'); }, null, { timeout: 8000 });
  return pg.evaluate(() => {
    const d = document.getElementById('rr-picker-proof');
    const q = s => d.querySelector(s);
    return {
      answer: q('[data-pp-answer]').getAttribute('data-pp-answer'),
      answerText: q('[data-pp-answer]').textContent,
      folder: (q('[data-pp-folder]') || {}).getAttribute ? q('[data-pp-folder]').getAttribute('data-pp-folder') : null,
      count: q('[data-pp-count]') ? Number(q('[data-pp-count]').getAttribute('data-pp-count')) : null,
      checks: [...d.querySelectorAll('[data-pp-check]')].map(x => ({ kind: x.getAttribute('data-pp-check'), ok: x.getAttribute('data-pp-ok'), text: x.innerText })),
      items: [...d.querySelectorAll('[data-pp-item]')].map(x => x.textContent),
      text: d.innerText,
    };
  });
}

// ── D · the door ────────────────────────────────────────────────────────────
async function doorRun(browser) {
  console.log('\n== D · the one door ==');
  const { pg, errs } = await world(browser);
  const d = await pg.evaluate(async () => {
    const o = {};
    o.picked = await rrPickFromDrive({ folders: true, title: 'Pick a folder' });
    const b = window.__built[0];
    o.token = b.token; o.key = b.key; o.appId = b.appId; o.title = b.title;
    o.cfgKey = RR_DRIVE_PICKER.apiKey; o.cfgAppId = RR_DRIVE_PICKER.appId;
    o.views = b.views.map(v => v.calls);
    window.__pick = { cancel: true };
    o.cancelled = await rrPickFromDrive({});
    o.plainViews = window.__built[1].views.map(v => v.calls);
    window.__pick = { docs: [{ id: 'A', name: 'a', mimeType: 'x' }, { id: 'B', name: 'b', mimeType: 'y' }] };
    o.multi = await rrPickFromDrive({ multi: true });
    o.multiFeature = window.__built[2].features;
    // one at a time
    window.__pick = { hold: true };
    window.__toasts = [];
    const first = rrPickFromDrive({});
    await new Promise(z => setTimeout(z, 60));
    o.second = await rrPickFromDrive({});
    o.busyToast = window.__toasts.slice();
    o.builtWhileOpen = window.__built.length;
    // let the held one finish
    window.__built[window.__built.length - 1].cb({ action: 'cancel' });
    o.firstDone = await first;
    o.afterHold = await (async () => { window.__pick = { cancel: true }; await rrPickFromDrive({}); return window.__built.length; })();
    return o;
  });
  T('D1 the picker gets the app\'s OWN pass, the key and the app ID from config', d.token === 'tok' && d.key === d.cfgKey && d.appId === d.cfgAppId && /^AIza/.test(d.key), d);
  const mine = d.views[0] || [], shared = d.views[1] || [];
  const has = (calls, m, v) => calls.some(c => c[0] === m && (v === undefined || c[1] === v));
  T('D1 two tabs: My Drive and Shared with me', d.views.length === 2 && has(mine, 'setOwnedByMe', true) && has(shared, 'setOwnedByMe', false) && has(mine, 'setLabel', 'My Drive') && has(shared, 'setLabel', 'Shared with me'), d.views);
  T('D1 folders: true → only folders shown, and a folder can be chosen', [mine, shared].every(c => has(c, 'setSelectFolderEnabled', true) && has(c, 'setMimeTypes', 'application/vnd.google-apps.folder')), d.views);
  T('D1 no folders asked → folders are not choosable', (d.plainViews || []).every(c => !has(c, 'setSelectFolderEnabled')), d.plainViews);
  T('D1 the title is set', d.title === 'Pick a folder', d.title);
  T('D2 picked → [{ id, name, mimeType }]', JSON.stringify(d.picked) === JSON.stringify([{ id: 'PF', name: 'Staff check', mimeType: 'application/vnd.google-apps.folder' }]), d.picked);
  T('D2 cancelled → null', d.cancelled === null, d.cancelled);
  T('D2 multi: true → more than one, and the picker is told so', Array.isArray(d.multi) && d.multi.length === 2 && JSON.stringify(d.multiFeature) === '["multi"]', d);
  T('D3 one picker at a time: a second call while open opens nothing and says so', d.second === null && d.builtWhileOpen === 4 && d.busyToast.indexOf('The file picker is already open.') >= 0, d);
  T('D3 the door opens again once the first one closes', d.firstDone === null && d.afterHold === 5, d);
  // a lapsed pass that cannot be renewed
  const p = await pg.evaluate(async () => {
    const was = window.__built.length; window.__toasts = [];
    const L = window.rrPassLapsed, R = window.rrWaitForPass;
    window.rrPassLapsed = () => true; window.rrWaitForPass = async () => false;
    const r = await rrPickFromDrive({ folders: true });
    window.rrPassLapsed = L; window.rrWaitForPass = R;
    return { r, built: window.__built.length - was, toasts: window.__toasts.slice() };
  });
  T('D4 a pass that cannot be renewed: nothing opens, the person is told to sign in', p.r === null && p.built === 0 && p.toasts.some(t => /Sign in again/.test(t)), p);
  // a failed load (no picker on the page; the stand-in world lets nothing reach Google)
  const l = await pg.evaluate(async () => {
    const keep = window.google; window.google = undefined; window.__toasts = [];
    const r = await rrPickFromDrive({ folders: true });
    const s = [...document.querySelectorAll('script')].filter(x => x.src === RR_DRIVE_PICKER.loader).length;
    window.google = keep;
    window.__pick = { docs: [{ id: 'PF', name: 'Staff check', mimeType: 'application/vnd.google-apps.folder' }] };
    const again = await rrPickFromDrive({ folders: true });
    return { r, toasts: window.__toasts.slice(), loaderTags: s, again };
  });
  T('D5 Google\'s loader is fetched from config\'s address when the picker is not on the page', l.loaderTags === 1, l);
  T('D5 the picker cannot load: null, and the person is told', l.r === null && l.toasts.some(t => /did not open/.test(t)), l);
  T('D5 ...and the door works again afterwards', Array.isArray(l.again) && l.again[0].id === 'PF', l);
  // our own Close button: there while the picker is open, gone after, and it always gets the person out
  const e = await pg.evaluate(async () => {
    const o = {};
    window.__pick = { cancel: true };
    await rrPickFromDrive({});
    o.goneAfterCancel = !document.getElementById('rr-picker-escape');
    window.__pick = { hold: true };
    const was = window.__built.length;
    const p = rrPickFromDrive({ folders: true });
    await new Promise(z => setTimeout(z, 60));
    const btn = document.getElementById('rr-picker-escape');
    o.shown = !!btn; o.text = btn ? btn.textContent : ''; o.z = btn ? Number(getComputedStyle(btn).zIndex) : 0;
    o.h = btn ? btn.getBoundingClientRect().height : 0;
    if (btn) btn.click();
    o.r = await p;
    const b = window.__built[was];
    o.hidden = JSON.stringify(b.visible); o.disposed = !!b.disposed;
    o.goneAfter = !document.getElementById('rr-picker-escape');
    window.__pick = { docs: [{ id: 'PF', name: 'Staff check', mimeType: 'application/vnd.google-apps.folder' }] };
    o.again = await rrPickFromDrive({ folders: true });
    o.goneAfterPick = !document.getElementById('rr-picker-escape');
    return o;
  });
  T('D7 while the picker is open, our own "Close the picker" sits above it (a 44px button)', e.shown && e.text === 'Close the picker' && e.z >= 2147483000 && e.h >= 44, e);
  T('D7 tapping it closes Google\'s picker (hidden + disposed) and the call ends with null', e.r === null && e.hidden === '[true,false]' && e.disposed, e);
  T('D7 the button is gone after a pick, a cancel, or its own tap — and the door opens again', e.goneAfter && e.goneAfterCancel && e.goneAfterPick && Array.isArray(e.again), e);
  T('D6 no page errors', errs.length === 0, errs);
  await pg.close();
}

// ── P · the proof ───────────────────────────────────────────────────────────
async function proofRun(browser) {
  console.log('\n== P · the proof report ==');
  const { pg, errs } = await world(browser);
  // the Preferences row (Pro)
  const pr = await pg.evaluate(() => {
    localStorage.removeItem(RR_DRIVE_PICKER.proofKey);
    buildPrefsPage();
    const s = document.querySelector('#prefs-content [data-pp-prefs]');
    return { section: !!s, title: s ? s.querySelector('.pref-section-title').textContent : '', pick: !!(s && s.querySelector('[data-pp-prefs-pick]')), again: !!(s && s.querySelector('[data-pp-prefs-again]')) };
  });
  T('P0 Pro: Preferences has Business tools → Test Google\'s file picker, with Pick a folder', pr.section && /Business tools/.test(pr.title) && pr.pick && !pr.again, pr);

  // A — everything inside can be seen and opened
  await pg.evaluate(() => { document.querySelector('#prefs-content [data-pp-prefs-pick]').click(); });
  let r = await waitReport(pg);
  T('P1 answer A: the folder pick opened what is inside it', r.answer === 'answerA' && /opened what is inside/.test(r.answerText), r);
  T('P1 the folder itself is seen; 5 things inside (1 sheet, 2 folders, and the 2 photos inside Photos)', r.folder === '1' && r.count === 5, r);
  T('P1 the sheet: its rows can be read', r.checks.filter(c => c.kind === 'sheet').length === 1 && r.checks.filter(c => c.kind === 'sheet').every(c => c.ok === '1'), r.checks);
  T('P1 the photos: both open (only a few bytes are fetched)', r.checks.filter(c => c.kind === 'photo').length === 2 && r.checks.filter(c => c.kind === 'photo').every(c => c.ok === '1'), r.checks);
  const rng = await pg.evaluate(() => window.__seeCalls.filter(c => /alt=media/.test(c.u)).map(c => c.range));
  T('P1 a photo check asks for 32 bytes, never the whole photo', rng.length === 2 && rng.every(x => x === 'bytes=0-31'), rng);
  T('P1 a photo shows its place inside the folder', r.checks.some(c => /Photos › Lionel 2343 ID45 RSV\.jpg/.test(c.text)), r.checks);
  const saved = await pg.evaluate(() => ({ s: JSON.parse(localStorage.getItem(RR_DRIVE_PICKER.proofKey) || 'null'), again: !!document.querySelector('#prefs-content [data-pp-prefs-again]'), againText: (document.querySelector('#prefs-content [data-pp-prefs-again]') || {}).textContent }));
  T('P1 the folder is remembered (id and name only) and Preferences offers "Look again at Staff check"', saved.s && saved.s.id === 'PF' && saved.s.name === 'Staff check' && Object.keys(saved.s).length === 2 && saved.again && saved.againText === 'Look again at Staff check', saved);

  // Look again: a photo added later — NO new pick
  const before = await pg.evaluate(() => window.__built.length);
  await pg.evaluate(() => {
    window.__FULL.PPH.push({ id: 'PIMG3', name: 'Lionel 2343 ID45 TOP.jpg', mimeType: 'image/jpeg' });
    document.querySelector('#rr-picker-proof [data-pp-again]').click();
  });
  await pg.waitForFunction(() => /6 thing/.test((document.getElementById('rr-picker-proof') || {}).innerText || ''), null, { timeout: 8000 }).catch(() => {});
  r = await waitReport(pg);
  const after = await pg.evaluate(() => window.__built.length);
  T('P2 Look again re-checks the SAME folder without opening the picker', after === before, { before, after });
  T('P2 ...and sees the photo added since (6 things, 3 photos opened)', r.count === 6 && r.checks.filter(c => c.kind === 'photo' && c.ok === '1').length === 3, r);

  // part — a photo that will not open
  await pg.evaluate(() => { window.__see.deny = ['PIMG2']; document.querySelector('#rr-picker-proof [data-pp-again]').click(); });
  await pg.waitForFunction(() => { const a = document.querySelector('#rr-picker-proof [data-pp-answer]'); return a && a.getAttribute('data-pp-answer') === 'answerPart'; }, null, { timeout: 8000 }).catch(() => {});
  r = await waitReport(pg);
  T('P3 a photo that will not open: answer "part", and its line says why (403, not allowed)', r.answer === 'answerPart' && r.checks.some(c => c.ok === '0' && /LSV/.test(c.text) && /403, not allowed/.test(c.text)), r);

  await pg.evaluate(() => { window.__see.deny = ['PS1']; document.querySelector('#rr-picker-proof [data-pp-again]').click(); });
  await pg.waitForFunction(() => [...document.querySelectorAll('#rr-picker-proof [data-pp-check="sheet"]')].some(x => x.getAttribute('data-pp-ok') === '0'), null, { timeout: 8000 }).catch(() => {});
  r = await waitReport(pg);
  T('P3b a sheet whose rows cannot be read: answer "part", its line says no', r.answer === 'answerPart' && r.checks.some(c => c.kind === 'sheet' && c.ok === '0' && /✗ no \(403, not allowed\)/.test(c.text)), r);
  const rr = await pg.evaluate(() => window.__seeCalls.filter(c => c.sheet).map(c => c.range));
  T('P1b a sheet check reads only A1:B2 of its first tab', rr.length >= 1 && rr.every(x => x === 'A1:B2'), rr);

  // B — only the folder itself
  await pg.evaluate(() => { window.__see.deny = []; window.__see.kids = {}; document.querySelector('#rr-picker-proof [data-pp-again]').click(); });
  await pg.waitForFunction(() => { const a = document.querySelector('#rr-picker-proof [data-pp-answer]'); return a && a.getAttribute('data-pp-answer') === 'answerB'; }, null, { timeout: 8000 }).catch(() => {});
  r = await waitReport(pg);
  T('P4 answer B: the folder is seen, nothing inside it', r.answer === 'answerB' && r.folder === '1' && r.count === 0 && /only the folder itself/.test(r.answerText), r);

  // none — not even the folder
  await pg.evaluate(() => { window.__see.folder = false; document.querySelector('#rr-picker-proof [data-pp-again]').click(); });
  await pg.waitForFunction(() => { const a = document.querySelector('#rr-picker-proof [data-pp-answer]'); return a && a.getAttribute('data-pp-answer') === 'answerNone'; }, null, { timeout: 8000 }).catch(() => {});
  r = await waitReport(pg);
  T('P5 not even the folder: answer "could not be opened", with Google\'s reason (404)', r.answer === 'answerNone' && r.folder === '0' && /404, not found/.test(r.text), r);

  // a cancelled pick shows and saves nothing
  const c = await pg.evaluate(async () => {
    document.querySelector('#rr-picker-proof [data-pp-close]').click();
    localStorage.removeItem(RR_DRIVE_PICKER.proofKey);
    window.__pick = { cancel: true };
    await rrPickerProofOpen();
    return { report: !!document.getElementById('rr-picker-proof'), saved: localStorage.getItem(RR_DRIVE_PICKER.proofKey) };
  });
  T('P6 a cancelled pick: no report, nothing remembered', !c.report && c.saved === null, c);
  // Look again with nothing remembered = pick first
  const n = await pg.evaluate(async () => { const was = window.__built.length; window.__pick = { cancel: true }; await rrPickerProofAgain(); return window.__built.length - was; });
  T('P7 Look again with no folder remembered opens the picker instead', n === 1, n);
  // a double tap on Look again runs ONE look
  const dbl = await pg.evaluate(async () => {
    window.__see = { folder: true, kids: window.__FULL, deny: [] };
    localStorage.setItem(RR_DRIVE_PICKER.proofKey, JSON.stringify({ id: 'PF', name: 'Staff check' }));
    window.__seeCalls = [];
    await Promise.all([rrPickerProofAgain(), rrPickerProofAgain()]);
    return window.__seeCalls.filter(x => x.id === 'PF' && !/ in parents/.test(x.u)).length;
  });
  T('P8 a double tap on Look again runs ONE look', dbl === 1, dbl);
  T('P9 no page errors', errs.length === 0, errs);
  await pg.close();
}

// ── X · a regular customer ──────────────────────────────────────────────────
async function regularRun(browser) {
  console.log('\n== X · a regular customer ==');
  const { pg, errs } = await world(browser, { off: true });
  const x = await pg.evaluate(async () => {
    buildPrefsPage();
    const o = { section: !!document.querySelector('#prefs-content [data-pp-prefs]'), html: rrPrefsPickerHtml() };
    const was = window.__built.length;
    await rrPickerProofOpen(); await rrPickerProofAgain();
    o.built = window.__built.length - was;
    o.report = !!document.getElementById('rr-picker-proof');
    o.text = document.getElementById('prefs-content').innerText;
    return o;
  });
  T('X1 a regular customer: no Business tools in Preferences', !x.section && x.html === '' && !/Business tools|file picker/.test(x.text), { section: x.section, html: x.html });
  T('X2 a regular customer: the proof does nothing (no picker, no report)', x.built === 0 && !x.report, x);
  T('X3 no page errors', errs.length === 0, errs);
  await pg.close();
}

(async () => {
  guards();
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    await doorRun(browser);
    await proofRun(browser);
    await regularRun(browser);
  } catch (e) { T('the run itself', false, e && e.stack); }
  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  drive_picker_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
