#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// A PHOTO FOR AN ITEM WHOSE NAME HAS AN APOSTROPHE — 2026-11-02
// (PLAN_2026-11-02_APOSTROPHE_PHOTO_FOLDER.md)
//
// Joseph's report (v0.9.2098): "Every time tried to upload a photo from a file
// on my computer JPG it never gets uploaded … Could not save this photo Please
// try again." [stated] Brad 14:06 CT "can we do an audit and try different ways
// to do what he was doing and see if we can replicate it?" → 14:14 "yes" (plan)
// → 14:15 "build it". Replicated: drive.js _driveFindOrCreateFolderNow put the
// folder name into Drive's search unescaped — a hand-added "40' Wood Reefer" or a
// Paper "Lionel's 1957 Catalog" could never take a photo (Drive: 400 Invalid Value).
//
//   N  rrDriveQ (the ONE escape for a name inside a Drive search) and
//      rrImageTypeOf, the real functions lifted from drive.js
//   S  the scan — every Drive search in app/ that puts a CHANGING value into
//      name='…' goes through rrDriveQ (fixed names are a named list);
//      driveUploadPhoto is no longer a second copy of the upload
//   B  the real app in Chromium at Joseph's window (1051x658), a stand-in Drive
//      that keeps Drive's own rules: an unescaped ' in a search → 400; \' and \\
//      un-escape; a one-request upload over 5 MB → 413; the resumable upload
//      (Location + PUT). Each road: the photo lands, in a folder named EXACTLY as
//      typed, and a second photo finds the SAME folder (no duplicate).
//   P  planted offenders — each turns its own check red.
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  apostrophe_photo_tests needs playwright: ' + e.message); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(extra || '').slice(0, 600))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.split(from).join(to);
}
const DRV = read('drive.js');
const CT = { '.js': 'application/javascript' };

// ── N ───────────────────────────────────────────────────────────────────────
const lift = (name) => { const a = DRV.indexOf('function ' + name + '('); const b = DRV.indexOf('\n}', a); const line = DRV.indexOf('\n', a);
  const body = (b > 0 && b < DRV.indexOf('\nfunction', a + 10) ? DRV.slice(a, b + 2) : DRV.slice(a, line)); return new Function(body + '; return ' + name + ';')(); };
const Q = lift('rrDriveQ'), TY = lift('rrImageTypeOf');
ok("N1 rrDriveQ: 40' Wood Reefer → 40\\' Wood Reefer", Q("40' Wood Reefer") === "40\\' Wood Reefer", Q("40' Wood Reefer"));
ok('N2 rrDriveQ: a backslash is doubled', Q('8188\\1') === '8188\\\\1', Q('8188\\1'));
ok("N3 rrDriveQ: both, backslash first (x\\'y → x\\\\\\'y)", Q("x\\'y") === "x\\\\\\'y", Q("x\\'y"));
ok('N4 rrDriveQ: plain words, numbers and blanks unchanged', Q('Lionel 2343') === 'Lionel 2343' && Q(45) === '45' && Q(null) === '');
ok('N5 rrImageTypeOf: a blank-type .JPG / .jpeg / .png is known; a .txt is not; a typed file keeps its type',
   TY({ name: 'Atlas 8188-1.JPG', type: '' }) === 'image/jpeg' && TY({ name: 'a.jpeg', type: '' }) === 'image/jpeg' && TY({ name: 'a.png', type: '' }) === 'image/png'
   && TY({ name: 'a.txt', type: '' }) === '' && TY({ name: 'a.jpg', type: 'image/webp' }) === 'image/webp');

// ── S ───────────────────────────────────────────────────────────────────────
const FIXED = /^(_NEW_VAULT_NAME|_OLD_VAULT_NAME|CONFIG_FILENAME|_OLD_CONFIG_FILENAME|PREFS_FILENAME|FILE_NAME|_sellSheetName\(\)|_SELL_CUST_FILE|\(_U\(\)\.fileName \|\| 'rail-roster-collections\.json'\))$/;
function rawSearches(files) {
  const bad = [];
  for (const [f, s] of files) s.split('\n').forEach((l, i) => {
    const code = l.replace(/^\s*\/\/.*$/, '');
    const re = /name\s*=\s*'(?:\$\{([^}]*)\}|"\s*\+\s*([^+]+?)\s*\+\s*")/g; let m;
    while ((m = re.exec(code))) {
      const expr = (m[1] || m[2] || '').trim();
      if (/^rrDriveQ\(/.test(expr) || /^safe$/.test(expr) && /var safe = rrDriveQ\(/.test(s) || FIXED.test(expr)) continue;
      bad.push(f + ':' + (i + 1) + ' ' + expr.slice(0, 50));
    }
  });
  return bad;
}
const files = fs.readdirSync(APP).filter(f => /\.js$/.test(f)).map(f => [f, read(f)]);
const RS = rawSearches(files);
ok('S1 every Drive search that puts a changing name into name=\'…\' goes through rrDriveQ', RS.length === 0, RS.join(' | '));
ok('S1b the scan really sees searches (it finds the fixed-name ones and the rrDriveQ ones)', files.reduce((n, [, s]) => n + (s.match(/name\s*=\s*'(?:\$\{|"\s*\+)/g) || []).length, 0) >= 12);
{
  const p = files.map(([f, s]) => [f, f === 'drive.js' ? plant(s, "name='${rrDriveQ(name)}' and mimeType", "name='${name}' and mimeType", 'S1-P') : s]);
  ok("S1 P the old `name='${name}'` put back in drive.js → S1 red", rawSearches(p).length > 0);
}
{
  // (drive.js's other two one-request uploads write the app's own small settings files, not photos)
  const body = (DRV.split('async function driveUploadPhoto(file, fileName, folderId) {')[1] || '').split('\n}')[0];
  ok('S2 driveUploadPhoto is no longer a second copy of the upload (it hands to driveUploadFile, sends nothing itself)',
     /return driveUploadFile\(file, fileName, folderId\);/.test(body) && !/fetch\(/.test(body), body.slice(0, 300));
}
ok('S3 the words live in config.js (RR_DRIVE_REFUSED) and never say "AI"', /const RR_DRIVE_REFUSED = \{/.test(read('config.js')) && !/\bAI\b/.test(read('config.js').split('const RR_DRIVE_REFUSED')[1].split('};')[0]));

// ── B: the real app ─────────────────────────────────────────────────────────
// the stand-in Drive (the audit's, with the resumable upload)
const DRIVE = (opts) => {
  window.__drive = { files: {}, calls: [], n: 0 };
  const D = window.__drive; const add = (f) => { D.files[f.id] = f; return f; };
  add({ id: 'root', name: 'My Drive', parents: [], folder: true });
  add({ id: 'VAULT', name: 'The Rail Roster', parents: ['root'], folder: true });
  add({ id: 'PH', name: 'My Collection Photos', parents: ['VAULT'], folder: true });
  add({ id: 'SPH', name: 'My Sold Collection Photos', parents: ['VAULT'], folder: true });
  try { localStorage.setItem('lv_vault_id', 'VAULT'); localStorage.setItem('lv_photos_id', 'PH'); localStorage.setItem('lv_sold_photos_id', 'SPH'); } catch (e) {}
  const R = (s, b, hdr) => ({ ok: s >= 200 && s < 300, status: s, json: async () => b, text: async () => JSON.stringify(b), headers: { get: (k) => (hdr || {})[String(k).toLowerCase()] || null } });
  const bad = (s, msg) => R(s, { error: { code: s, message: msg } });
  const qOk = (q) => { const re = /name\s*=\s*'((?:[^'\\]|\\.)*)'/g; let m, good = true;
    while ((m = re.exec(q))) { const rest = q.slice(re.lastIndex); if (rest.length && !/^\s+(and|or)\s|^\s*\)|^\s*$/.test(rest)) good = false; }
    if ((q.replace(/\\./g, '').match(/'/g) || []).length % 2) good = false; return good; };
  const unesc = (s) => s.replace(/\\(.)/g, '$1');
  const keep = (meta, size) => { const par = D.files[(meta.parents || [])[0]]; if (!par) return null;
    return add({ id: 'FILE' + (++D.n), name: meta.name, parents: meta.parents, size, mime: meta.mimeType }); };
  window.fetch = async function (url, o) {
    const u = String(url); const method = (o && o.method) || 'GET';
    D.calls.push(method + ' ' + decodeURIComponent(u).replace('https://www.googleapis.com', '').slice(0, 160));
    if (/sheets\.googleapis/.test(u)) return R(200, { values: [] });
    if (/^https:\/\/upload\.session\//.test(u) && method === 'PUT') {   // the resumable session's address
      const s = D.sessions[u]; const f = keep(s.meta, o.body.size);
      return f ? R(200, { id: f.id, name: f.name }) : bad(404, 'File not found');
    }
    if (/\/upload\/drive\/v3\/files/.test(u) && method === 'POST') {
      if (window.__refuse) return bad(window.__refuse, 'Invalid Value');
      if (/uploadType=resumable/.test(u)) {
        if (window.__noSession) throw new TypeError('Failed to fetch');
        D.sessions = D.sessions || {}; const at = 'https://upload.session/' + (++D.n);
        D.sessions[at] = { meta: JSON.parse(o.body) };
        return R(200, {}, { location: at });
      }
      const meta = JSON.parse(await o.body.get('metadata').text()); const file = o.body.get('file');
      if (file.size > 5 * 1024 * 1024) return bad(413, 'Request Too Large');
      const f = keep(meta, file.size); return f ? R(200, { id: f.id, name: f.name }) : bad(404, 'File not found');
    }
    const m = /\/drive\/v3\/files(?:\/([^?/]+))?(\?[^#]*)?$/.exec(u);
    if (!m) return R(200, {});
    const id = m[1], qs = new URLSearchParams((m[2] || '').slice(1));
    if (!id && method === 'GET') {
      const q = qs.get('q') || '';
      if (!qOk(q)) return bad(400, 'Invalid Value');
      const nm = (/name\s*=\s*'((?:[^'\\]|\\.)*)'/.exec(q) || [])[1];
      const parents = [...q.matchAll(/'([^']+)'\s+in\s+parents/g)].map(x => x[1]);
      const folder = /vnd\.google-apps\.folder'/.test(q);
      const hits = Object.values(D.files).filter(f => f.id !== 'root' && (nm == null || f.name === unesc(nm)) && (!parents.length || (f.parents || []).some(p => parents.includes(p))) && (!folder || f.folder));
      return R(200, { files: hits.map(f => ({ id: f.id, name: f.name, parents: f.parents, mimeType: f.folder ? 'application/vnd.google-apps.folder' : 'image/jpeg' })) });
    }
    if (!id && method === 'POST') { const b = JSON.parse(o.body || '{}'); const f = add({ id: 'FOLD' + (++D.n), name: b.name, parents: b.parents, folder: true }); return R(200, { id: f.id }); }
    if (id) { const f = D.files[id]; return f ? R(200, { id: f.id, name: f.name, parents: f.parents, trashed: false }) : bad(404, 'File not found'); }
    return R(200, {});
  };
};
const JPG = (() => { const b = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64'); return b; })();
async function boot(browser, served) {
  const ctx = await browser.newContext({ viewport: { width: 1051, height: 658 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await pg.route('**', r => { const u = r.request().url(); if (!/^(file|data|blob|about):/.test(u)) return r.abort();
    const name = u.split('?')[0].split('/').pop(); if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: CT[path.extname(name)] || 'text/plain' }); return r.continue(); });
  await pg.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
  await pg.addInitScript(DRIVE, {});
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1300);
  await pg.evaluate(() => {
    try { _aiUsageMarkSeen(); } catch (e) {}
    window.showAiUsageCard = function () {};
    const row = { itemNum: '8188-1', variation: '', itemType: 'Reefer', roadName: 'Pabst-ett', description: 'Wood Reefer', _era: 'atlas', _tab: 'Atlas O', manufacturer: 'Atlas' };
    state.masterData = [row]; state.masterAllRows = [row]; state.personalData = {};
    state.user = { name: 'Joseph', email: 'joe@example.test' }; state.personalSheetId = 'SHEET1';
    window.accessToken = 'TOK'; accessToken = 'TOK';
    try { localStorage.setItem('lv_token', 'TOK'); localStorage.setItem('lv_token_expiry', String(Date.now() + 3000000)); localStorage.removeItem('rr_sync_log'); } catch (e) {}
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
    window.__toasts = []; const st = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); try { st.apply(this, arguments); } catch (e) {} };
  });
  return { ctx, pg, errs };
}
const toPhotoStep = (pg, d, tab) => pg.evaluate(async ([d, tab]) => {
  openWizard(tab || 'collection'); await new Promise(r => setTimeout(r, 300));
  Object.assign(wizard.data, d); if (!d._manualEntry && !d.eph_title) wizard.matchedItem = state.masterData[0];
  const i = wizard.steps.findIndex(s => s.type === 'drivePhotos'); if (i < 0) return false;
  wizard.step = i; renderWizardStep(); await new Promise(r => setTimeout(r, 500)); return true;
}, [d, tab]);
const pick = async (pg, file, nth) => {   // a slot → Upload from Computer → the file (a real file chooser)
  await pg.evaluate(() => { const c = document.getElementById('rr-ai-usage-card'); if (c) c.remove(); });
  await pg.locator('#wizard-body .photo-drop-zone').nth(nth || 0).click();
  await pg.waitForTimeout(250);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 5000 }), pg.click('#picker-btn-lib')]);
  await fc.setFiles(file);
};
const landed = (pg, ms) => pg.waitForFunction((n) => Object.values(window.__drive.files).filter(f => !f.folder && f.size).length >= n, ms || 1, { timeout: 8000 }).catch(() => {});
const world = (pg) => pg.evaluate(() => ({ toasts: window.__toasts.slice(), photos: Object.values(window.__drive.files).filter(f => !f.folder && f.size).map(f => ({ name: f.name, parent: window.__drive.files[f.parents[0]].name, mime: f.mime, size: f.size })),
  folders: Object.values(window.__drive.files).filter(f => f.folder).map(f => f.name), calls: window.__drive.calls.slice(),
  diary: (() => { try { return JSON.parse(localStorage.getItem('rr_sync_log') || '[]').filter(x => x.e === 'photo').map(x => x.i); } catch (e) { return ['?']; } })() }));
const jpg = (name, buf, type) => ({ name, mimeType: type == null ? 'image/jpeg' : type, buffer: buf || JPG });

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  let browser;
  try { browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }

  // a road: two photos for ONE item, both land in ONE folder named exactly as typed
  async function road(label, d, tab, folderName, served, open) {
    const { ctx, pg, errs } = await boot(browser, served);
    let w;
    try {
      if (open) { await pg.evaluate(open); await pg.waitForTimeout(800); } else await toPhotoStep(pg, d, tab);
      await pick(pg, jpg('Atlas 8188-1.jpg'), 0); await landed(pg, 1);
      await pick(pg, jpg('second.jpg'), 1); await landed(pg, 2);
      w = await world(pg);
    } catch (e) { w = { photos: [], folders: [], toasts: [], harness: e.message.split('\n')[0] }; }
    await ctx.close();
    const named = w.folders.filter(n => n === folderName).length;
    return { w, named, errs, okk: w.photos.length === 2 && w.photos.every(p => p.parent === folderName || p.parent !== undefined) && named === 1 };
  }
  const R1 = await road("B1 Add screen: item number \"40' Wood Reefer\"", { itemNum: "40' Wood Reefer" }, 'collection', "40' Wood Reefer");
  ok("B1 Add screen, item \"40' Wood Reefer\": both photos land, ONE folder named exactly \"40' Wood Reefer\", no message",
     R1.w.photos.length === 2 && R1.named === 1 && !R1.w.toasts.some(t => /Could not|would not/.test(t)), JSON.stringify(R1.w).slice(0, 500));
  const R2 = await road('B2 item page → Add Photos: hand-added (Manual) "40\' Wood Reefer NO #"', null, null, "40' Wood Reefer NO #", null,
    () => { state.personalData = { K1: { owned: true, inventoryId: '7', row: 5, itemNum: "40' Wood Reefer NO #", era: 'Manual', manufacturer: 'Lionel', itemType: 'Reefer' } }; openPhotoWizard("40' Wood Reefer NO #", '', 'K1'); });
  ok("B2 item page → Add Photos for Joseph's hand-added \"40' Wood Reefer NO #\": both land, one folder named as typed",
     R2.w.photos.length === 2 && R2.named === 1, JSON.stringify(R2.w).slice(0, 500));
  const R3 = await road('B3 Paper item "Lionel\'s 1957 Catalog"', { eph_title: "Lionel's 1957 Catalog", itemNum: "Lionel's 1957 Catalog" }, 'paper', "Lionel's 1957 Catalog");
  ok("B3 a Paper item titled \"Lionel's 1957 Catalog\": both land, one folder named as typed", R3.w.photos.length === 2 && R3.named === 1, JSON.stringify(R3.w).slice(0, 500));
  const R4 = await road('B4 item number with a backslash "8188\\1"', { itemNum: '8188\\1' }, 'collection', '8188\\1');
  ok('B4 an item number with a backslash: both land in ONE folder named exactly "8188\\1" (the second photo finds it — no duplicate)', R4.w.photos.length === 2 && R4.named === 1, JSON.stringify(R4.w).slice(0, 500));
  ok('B0 no page errors on the roads', ![R1, R2, R3, R4].some(r => r.errs.length), [R1, R2, R3, R4].map(r => r.errs.join(';')).join(' | '));

  // big, refused, typeless
  {
    const { ctx, pg } = await boot(browser);
    await toPhotoStep(pg, { itemNum: '8188-1' });
    const big = Buffer.alloc(7 * 1024 * 1024); JPG.copy(big);
    await pick(pg, jpg('camera original.jpg', big)); await landed(pg, 1);
    const w = await world(pg);
    ok('B5 a 7 MB camera picture goes by Google\'s resumable upload and lands (no 413)',
       w.photos.length === 1 && w.photos[0].size === big.length && w.calls.some(c => /uploadType=resumable/.test(c)) && w.calls.some(c => /^PUT https:\/\/upload\.session\//.test(c)) && !w.calls.some(c => /uploadType=multipart/.test(c)),
       JSON.stringify({ photos: w.photos, calls: w.calls.filter(c => /upload/.test(c)) }));
    await ctx.close();
  }
  {
    const { ctx, pg } = await boot(browser);
    await toPhotoStep(pg, { itemNum: '8188-1' });
    await pg.evaluate(() => { window.__noSession = true; });
    const big = Buffer.alloc(5 * 1024 * 1024 + 10); JPG.copy(big);
    await pick(pg, jpg('just over.jpg', big)); await pg.waitForTimeout(1500);
    const w = await world(pg);
    ok('B6 a resumable session that cannot open falls back to the one-request upload (never worse than before)',
       w.calls.some(c => /uploadType=resumable/.test(c)) && w.calls.some(c => /uploadType=multipart/.test(c)), JSON.stringify(w.calls.filter(c => /upload/.test(c))));
    await ctx.close();
  }
  {
    const { ctx, pg } = await boot(browser);
    await toPhotoStep(pg, { itemNum: '8188-1' });
    await pg.evaluate(() => { window.__refuse = 400; });
    await pick(pg, jpg('Atlas 8188-1.jpg')); await pg.waitForTimeout(1500);
    const w = await world(pg);
    const W = await pg.evaluate(() => RR_DRIVE_REFUSED);
    ok('B7 Drive refusing a photo says so in RR_DRIVE_REFUSED\'s words (not "Please try again")',
       w.toasts.some(t => t.indexOf(W.words.split('{thing}')[0]) === 0 && /Google answered 400/.test(t)) && !w.toasts.some(t => /Please try again/.test(t)), JSON.stringify(w.toasts));
    ok('B8 …and ONE Report-a-problem diary line carries Drive\'s answer (never the picture or a name)',
       w.diary.length === 1 && /^photo slot — Photo upload failed \(HTTP 400\): Invalid Value$/.test(w.diary[0]), JSON.stringify(w.diary));
    await ctx.close();
  }
  {
    const { ctx, pg } = await boot(browser);
    await toPhotoStep(pg, { itemNum: '8188-1' });
    await pg.evaluate((b64) => {
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const dt = new DataTransfer(); dt.items.add(new File([bin], 'Atlas 8188-1.JPG', { type: '' }));
      document.querySelector('#wizard-body .photo-drop-zone').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, JPG.toString('base64'));
    await landed(pg, 1);
    const w = await world(pg);
    ok('B9 a picture the browser gave no type, dropped on a slot, uploads (as image/jpeg)', w.photos.length === 1 && w.photos[0].mime === 'image/jpeg', JSON.stringify(w.photos));
    await ctx.close();
  }

  // ── P: the old lines served ──
  {
    const drv = plant(DRV, "name='${rrDriveQ(name)}' and mimeType", "name='${name}' and mimeType", 'P1');
    const R = await road('P1', { itemNum: "40' Wood Reefer" }, 'collection', "40' Wood Reefer", { 'drive.js': drv });
    ok("P1 the old unescaped search served → B1 red (Joseph's failure comes back, his exact words)",
       R.w.photos.length === 0 && R.w.toasts.some(t => /would not take this photo \(Google answered 400\)|Could not save this photo/.test(t)), JSON.stringify(R.w.toasts));
  }
  {
    const drv = plant(DRV, "  if (file && file.size > _max) {\n    const big = await _driveUploadResumable(file, metadata);\n    if (big) return big;\n  }\n", '', 'P2');
    const { ctx, pg } = await boot(browser, { 'drive.js': drv });
    await toPhotoStep(pg, { itemNum: '8188-1' });
    const big = Buffer.alloc(7 * 1024 * 1024); JPG.copy(big);
    await pick(pg, jpg('camera original.jpg', big)); await pg.waitForTimeout(1500);
    const w = await world(pg);
    ok('P2 the big-file route taken out → B5 red (Drive refuses 7 MB in one request)', w.photos.length === 0, JSON.stringify(w.photos));
    await ctx.close();
  }
  {
    const wp = plant(read('wizard-photos.js'), "    if (typeof rrPhotoFailed === 'function') rrPhotoFailed(e, 'photo slot');   // 2026-11-02: the reason reaches a report\n", '', 'P3');
    const { ctx, pg } = await boot(browser, { 'wizard-photos.js': wp });
    await toPhotoStep(pg, { itemNum: '8188-1' });
    await pg.evaluate(() => { window.__refuse = 400; });
    await pick(pg, jpg('Atlas 8188-1.jpg')); await pg.waitForTimeout(1500);
    const w = await world(pg);
    ok('P3 the diary line taken out of the photo slot → B8 red', w.diary.length === 0, JSON.stringify(w.diary));
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.stack); process.exit(1); });
