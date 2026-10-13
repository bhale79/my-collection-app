#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PHOTO SLOTS — where an earlier picture lands, and dragging a new one (v0.9.1937)
//
// [stated] Brad, adding a 3309-50 at the booth rehearsal (2026-10-13):
//   "the picture i downloaded from google photos went to the top view and not
//    the right side view" — and — "i tried to drag the photo to the correct
//    spot and i couldn't".
// Cause 1: the Photo ID / "Add a picture first" picture was handed to views[0],
//   which is Top View on every train (the v1929 ask was Right Side).
// Cause 2: a slot became draggable only if it was DRAWN with its picture; a
//   picture that landed afterwards (every upload) could not be dragged until
//   the step was redrawn.
// Boots the REAL app (app/index.html from disk, real Chromium).
//   U1–U6  _wizHandOffView, the one chooser (pure)
//   H1  the Photo ID picture lands in Right Side View
//   H2  the "Add a picture first" picture lands in Right Side View
//   H3  Right Side already holds a picture → the first EMPTY slot, nothing overwritten
//   H4  every slot full → nothing uploaded, and the user is told
//   D1  a picture uploaded AFTER the step was drawn can be dragged at once,
//       and dropping it on Right Side moves it there (the real upload code)
//   D2  the same on a slot whose picture was there when the step was drawn
//   S1  ONE place arms a drag (wizard.js _wizArmSlotDrag); both callers use it
//   P1  PLANTED: the old views[0] line → H1 fails (lands in Top View)
//   P2  PLANTED: the upload without its arm call → D1 fails (cannot drag)
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  photo_slot_handoff_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const WIZ = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
const WPH = fs.readFileSync(path.join(APP, 'wizard-photos.js'), 'utf8');
const CFG = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }
const code = s => s.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

// ── U: the chooser itself, pure, in Node ─────────────────────────────────────
(function () {
  const grab = (src, sig) => { const i = src.indexOf(sig); if (i < 0) throw new Error('missing ' + sig); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && !--d) return src.slice(i, k + 1); } };
  const cfg = grab(CFG, 'const RR_PHOTO_HANDOFF = {');
  const fn = new Function(cfg + ';\n' + grab(WIZ, 'function _wizHandOffView(') + '\nreturn _wizHandOffView;')();
  const ITEM = ['TV', 'LSV', 'FV', 'RSV', 'BKV', 'BV'].map(k => ({ key: k }));
  T('U1 an empty train step → Right Side View', fn(ITEM, {}, {}, 'photosItem') === 'RSV', fn(ITEM, {}, {}, 'photosItem'));
  T('U2 Right Side holds an upload → the first empty slot in drawing order (Top View)', fn(ITEM, { RSV: 'u' }, {}, 'photosItem') === 'TV');
  T('U3 Right Side holds a Photo Inbox picture → also full', fn(ITEM, {}, { 'photosItem|RSV': 'fid' }, 'photosItem') === 'TV');
  T('U4 another step\'s inbox picture does not fill this step\'s slot', fn(ITEM, {}, { 'photosBox|RSV': 'fid' }, 'photosItem') === 'RSV');
  T('U5 every slot full → \'\' (never overwrite)', fn(ITEM, { TV: 1, LSV: 1, FV: 1, RSV: 1, BKV: 1, BV: 1 }, {}, 'photosItem') === '');
  T('U6 a step with no Right Side (paper: front/back) → its first slot, as before', fn([{ key: 'PAPER-FRONT' }, { key: 'PAPER-BACK' }], {}, {}, 'photosItem') === 'PAPER-FRONT');
})();

// ── S: one place arms a drag ─────────────────────────────────────────────────
(function () {
  const w = code(WIZ), p = code(WPH);
  T('S1 wizard.js sets draggable in ONE place — _wizArmSlotDrag', (w.match(/\.draggable\s*=\s*true/g) || []).length === 1 && /function _wizArmSlotDrag\([^)]*\)\s*\{[\s\S]{0,200}\.draggable\s*=\s*true/.test(w));
  T('S1 …the step\'s drawing calls it', /if \(hasPic \|\| inboxFid\) _wizArmSlotDrag\(div, stepId, viewKey, s\.id\)/.test(w));
  T('S1 …the upload calls it, after the picture is in wizard.data', /wizard\.data\[stepId\]\[viewKey\] = url;[\s\S]{0,600}window\._wizArmSlotDrag\(zone, stepId, viewKey, stepId\)/.test(p));
  T('S1 …no slot sets its own ondragstart any more (the tray chip in wizard-photos.js is not a slot)', !/\.ondragstart\s*=/.test(w));
  T('S1 the hand-off asks the ONE chooser (no views[0] left for the Item photo)', /_wizHandOffView\(views, stored, wizard\.data\._inboxSlotMap, s\.id\)/.test(w) && !/_idTargetView = [^\n]*views\[0\]/.test(w));
})();

async function makeJpeg(browser) {
  const pg = await browser.newPage();
  const b64 = await pg.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 200;
    const x = c.getContext('2d'); x.fillStyle = 'rgb(40,80,180)'; x.fillRect(0, 0, 320, 200);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  });
  await pg.close();
  return b64;
}

// o.stub: replace uploadWizardPhoto with a recorder (H tests); otherwise the REAL
// upload runs with Drive stood in for (D tests).
async function open(browser, o) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 1500 } });   // tall enough that every slot is on screen for a real mouse drag
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const clean = u.split('?')[0];
    if (o.wiz && clean.endsWith('/app/wizard.js')) return r.fulfill({ body: o.wiz, contentType: 'application/javascript' });
    if (o.wph && clean.endsWith('/app/wizard-photos.js')) return r.fulfill({ body: o.wph, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(([stub, b64]) => {
    const mk = (n, t) => ({ itemNum: n, variation: '1', itemType: t, description: t, _era: 'pw', _tab: 'Lionel PW - Items', manufacturer: 'Lionel', roadName: '', gauge: 'O', yearProd: '1960', varDesc: '' });
    state.masterData = [mk('3309-50', 'Flatcar')];
    _rebuildMasterIndex(); state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); window._allIdxComplete = true;
    state.personalData = {}; state.personalSheetId = 'SID'; accessToken = 'tok';
    const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    window.__file = n => new File([u8], n, { type: 'image/jpeg' });
    window.__ups = [];
    if (stub) window.uploadWizardPhoto = async function (f, sid, view) { window.__ups.push({ name: f && f.name, sid, view }); return {}; };
    // Drive stood in for: the real upload code runs, nothing leaves the page
    let n = 0;
    window.driveUploadItemPhoto = async function (file, itemNum, viewKey, invId, label, onUp) { n++; if (onUp) onUp({ id: 'fid-' + viewKey + '-' + n }); return 'https://drive.example/' + viewKey + '/' + n; };
    window.driveRequest = async function () { return { name: '3309-50 X.jpg' }; };
    window.__toasts = [];
    const _st = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); try { return _st.apply(this, arguments); } catch (e) {} };
    try { _aiUsageMarkSeen(); } catch (e) {}
    startWizardFor('collection');
  }, [!!o.stub, o.b64]);
  await pg.waitForTimeout(700);
  return { pg, errs };
}
// before: runs in the page (string) before the Photos step is drawn
async function toPhotos(pg, before) {
  await pg.evaluate((before) => {
    wizard.data.itemNum = '3309-50'; wizard.matchedItem = state.masterData[0]; wizard.data.matchedItem = state.masterData[0];
    if (before) (new Function(before))();
    const steps = getSteps(wizard.tab);
    wizard.step = steps.findIndex(s => s.id === 'photosItem');
    renderWizardStep();
  }, before || '');
  await pg.waitForTimeout(1100);
}
const peek = pg => pg.evaluate(() => ({
  ups: window.__ups, toasts: window.__toasts,
  stored: Object.assign({}, wizard.data.photosItem || {}),
  ids: Object.assign({}, wizard.data._photoFileIds || {}),
  drag: Array.from(document.querySelectorAll('.photo-drop-zone[data-sid="photosItem"]')).reduce((o, z) => { o[z.dataset.view] = z.draggable; return o; }, {}),
}));

(async () => {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    const b64 = await makeJpeg(browser);

    // H1 the Photo ID picture
    { const { pg, errs } = await open(browser, { stub: true, b64 });
      await toPhotos(pg, "wizard.data._idItemPhotoFile = window.__file('photo-id.jpg');");
      const s = await peek(pg);
      T('H1 the Photo ID picture lands in Right Side View', s.ups.length === 1 && s.ups[0].view === 'RSV' && s.ups[0].sid === 'photosItem', s.ups);
      T('H1 …no page errors', errs.length === 0, errs);
      await pg.close(); }

    // H2 Add a picture first
    { const { pg } = await open(browser, { stub: true, b64 });
      await toPhotos(pg, "wizard.data._idItemPhotoFile = window.__file('picfirst.jpg'); wizard.data._picFirst = true;");
      const s = await peek(pg);
      T('H2 the "Add a picture first" picture lands in Right Side View, and says it was yours', s.ups.length === 1 && s.ups[0].view === 'RSV' && s.toasts.some(t => /Your picture was added/.test(t)), s);
      await pg.close(); }

    // H3 Right Side already full
    { const { pg } = await open(browser, { stub: true, b64 });
      await toPhotos(pg, "wizard.data.photosItem = { RSV: 'https://drive.example/mine' }; wizard.data._idItemPhotoFile = window.__file('photo-id.jpg');");
      const s = await peek(pg);
      T('H3 Right Side already has a picture → the first empty slot (Top View); Right Side untouched', s.ups.length === 1 && s.ups[0].view === 'TV' && s.stored.RSV === 'https://drive.example/mine', s);
      await pg.close(); }

    // H4 everything full
    { const { pg } = await open(browser, { stub: true, b64 });
      await toPhotos(pg, "wizard.data.photosItem = { TV:'a', LSV:'b', FV:'c', RSV:'d', BKV:'e', BV:'f' }; wizard.data._idItemPhotoFile = window.__file('photo-id.jpg');");
      const s = await peek(pg);
      T('H4 every slot full → nothing uploaded over a chosen picture, and the user is told', s.ups.length === 0 && s.toasts.some(t => /already has a picture/.test(t)), s);
      await pg.close(); }

    // D1 a picture uploaded after drawing — drag it with the mouse
    const d1 = async (o) => {
      const { pg, errs } = await open(browser, Object.assign({ b64 }, o || {}));
      await toPhotos(pg);
      await pg.evaluate(() => uploadWizardPhoto(window.__file('new.jpg'), 'photosItem', 'TV'));
      await pg.waitForTimeout(300);
      const before = await peek(pg);
      await pg.dragAndDrop('.photo-drop-zone[data-sid="photosItem"][data-view="TV"]', '.photo-drop-zone[data-sid="photosItem"][data-view="RSV"]');
      await pg.waitForTimeout(500);
      const after = await peek(pg);
      await pg.close();
      return { before, after, errs };
    };
    { const r = await d1();
      T('D1 a picture that landed after the step was drawn can be picked up at once', r.before.drag.TV === true && !!r.before.stored.TV, r.before);
      T('D1 …dropping it on Right Side moves it there (picture, and the crop button\'s file id with it)',
        r.after.stored.RSV === r.before.stored.TV && !r.after.stored.TV && r.after.ids['photosItem|RSV'] === r.before.ids['photosItem|TV'] && !r.after.ids['photosItem|TV'], r.after);
      T('D1 …no page errors', r.errs.length === 0, r.errs); }

    // D2 a slot drawn with its picture
    { const { pg } = await open(browser, { b64 });
      await toPhotos(pg, "wizard.data.photosItem = { TV: 'https://drive.example/old' };");
      await pg.dragAndDrop('.photo-drop-zone[data-sid="photosItem"][data-view="TV"]', '.photo-drop-zone[data-sid="photosItem"][data-view="RSV"]');
      await pg.waitForTimeout(500);
      const s = await peek(pg);
      T('D2 a slot drawn with its picture still drags (the shared helper on the drawing path)', s.stored.RSV === 'https://drive.example/old' && !s.stored.TV, s);
      await pg.close(); }

    // P1 planted: the old views[0] hand-off
    { const old = "_wizHandOffView(views, stored, wizard.data._inboxSlotMap, s.id)";
      if (WIZ.split(old).length !== 2) throw new Error('could not plant P1');
      const { pg } = await open(browser, { stub: true, b64, wiz: WIZ.replace(old, 'views[0].key') });
      await toPhotos(pg, "wizard.data._idItemPhotoFile = window.__file('photo-id.jpg');");
      const s = await peek(pg);
      T('P1 PLANTED: the old views[0] line puts it in Top View — H1 would fail', s.ups.length === 1 && s.ups[0].view === 'TV', s.ups);
      await pg.close(); }

    // P2 planted: the upload without its arm call
    { const arm = "if (zone && typeof window._wizArmSlotDrag === 'function') window._wizArmSlotDrag(zone, stepId, viewKey, stepId);";
      if (WPH.split(arm).length !== 2) throw new Error('could not plant P2');
      const r = await d1({ wph: WPH.replace(arm, '') });
      T('P2 PLANTED: without the arm call a new picture cannot be dragged and nothing moves — D1 would fail', r.before.drag.TV === false && !!r.after.stored.TV && !r.after.stored.RSV, r); }
  } finally { await browser.close(); }
  console.log('\nphoto_slot_handoff_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.stack); process.exit(1); });
