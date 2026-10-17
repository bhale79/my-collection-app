#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PASTE A PICTURE INTO THE ADD SCREEN'S PHOTO STEP — v0.9.1973
// (real Chromium, REAL wizard.js + wizard-photos.js)
//
// Brad, 2026-10-17, after deciding against copying makers' stock photos
// (copyright): "can we suggest they screen shot the picture them selves and
// past it?" → worded for ANY picture (the app never tells anyone to copy the
// maker's) → "go".
//
//   C1  on a computer the photo step says a copied picture can be pasted
//       (Ctrl+V); the words never mention a maker or a stock photo; a phone
//       has no such line
//   C2  Ctrl+V with a picture and nothing picked → Right Side, through the
//       same upload a dropped file takes
//   C3  Right Side already has a picture → the next empty slot (never replaced)
//   C4  the mouse over a slot → that slot
//   C5  a slot clicked (its chooser open) → that slot, the chooser closes; the
//       chooser on a computer says Ctrl+V works there
//   C6  every slot full, none picked → it says so, nothing uploads
//   C7  left alone: a paste into a text box, a paste of plain text, a paste on
//       a step that is not a photo step
//   X*  PLANTED: each undone in the code is caught
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  paste_photo_1973_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const WP = fs.readFileSync(path.join(APP, 'wizard-photos.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 700))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}
const ROW = { itemNum: '84631', variation: '', itemType: 'Diesel Locomotive', roadName: 'RJ Corman', description: 'RJ Corman EMD SD40T-2 Diesel', _era: 'mpc', _tab: 'Lionel MPC-Modern' };

async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 1536, height: o.h || 737 },
    userAgent: o.mobile ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36' : undefined });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    if (base.endsWith('/app/wizard-photos.js') && o.wp) return r.fulfill({ body: o.wp, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(row => {
    try { _aiUsageMarkSeen(); } catch (e) {}
    state.masterData = [row]; state.masterAllRows = [row]; state.personalData = {};
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
    // stand in for the Drive upload: record which slot each picture was sent to
    window._upCalls = [];
    window.uploadWizardPhoto = function (file, sid, vk) { window._upCalls.push({ sid: sid, vk: vk, type: file && file.type, name: file && file.name }); };
    window._toasts = [];
    var _st = window.showToast; window.showToast = function (m) { window._toasts.push(String(m)); try { _st.apply(this, arguments); } catch (e) {} };
  }, ROW);
  return { pg, ctx, errs };
}
// open the photo step; filled = views already holding a picture
const photoStep = (pg, filled) => pg.evaluate(async (filled) => {
  const row = state.masterData[0];
  openWizard('collection'); await new Promise(r => setTimeout(r, 300));
  wizard.data.itemNum = row.itemNum; wizard.matchedItem = row;
  wizard.step = wizard.steps.findIndex(s => s.id === 'photosItem');
  wizard.data.photosItem = {};
  (filled || []).forEach(v => { wizard.data.photosItem[v] = 'https://drive.google.com/drive/folders/x'; });
  renderWizardStep(); await new Promise(r => setTimeout(r, 500));
  window._upCalls = []; window._toasts = [];
  const hint = document.querySelector('#wizard-body .wiz-paste-hint');
  return { hint: hint ? hint.textContent : '', views: [...document.querySelectorAll('#wizard-body .photo-drop-zone')].map(z => z.dataset.view) };
}, filled || []);
// fire a paste: kind 'image' or 'text'; at = a CSS selector to send it to (default body)
const paste = (pg, kind, at) => pg.evaluate(async ([kind, at]) => {
  const dt = new DataTransfer();
  if (kind === 'image') {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
    dt.items.add(new File([png], 'image.png', { type: 'image/png' }));
  } else dt.setData('text/plain', 'Lionel 6-84631');
  const target = at ? document.querySelector(at) : document.body;
  const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  await new Promise(r => setTimeout(r, 150));
  return { calls: window._upCalls.slice(), toasts: window._toasts.slice(), prevented: ev.defaultPrevented, picker: document.getElementById('photo-picker-sheet').classList.contains('open') };
}, [kind, at || '']);

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let r, m, p;

  console.log('== C1 · the words ==');
  r = await open(browser, {});
  m = await photoStep(r.pg);
  T('C1 a computer: the photo step says a copied picture can be pasted with Ctrl+V', /Ctrl\+V/.test(m.hint) && /paste/i.test(m.hint), m.hint);
  T('C1 the words are for any picture — no maker, no stock photo, no "screenshot"', m.hint && !/lionel|mth|maker|manufactur|stock|screen ?shot/i.test(m.hint), m.hint);

  console.log('== C2–C6 · where a pasted picture lands ==');
  p = await paste(r.pg, 'image');
  T('C2 nothing picked → Right Side, through the same upload a dropped file takes (a real image file, named)', p.calls.length === 1 && p.calls[0].vk === 'RSV' && p.calls[0].sid === 'photosItem' && p.calls[0].type === 'image/png' && /^pasted-\d+\.png$/.test(p.calls[0].name) && p.prevented, p);
  T('page errors', r.errs.length === 0, r.errs);
  await r.ctx.close();

  r = await open(browser, {});
  await photoStep(r.pg, ['RSV']);
  p = await paste(r.pg, 'image');
  T('C3 Right Side already has a picture → the next empty slot, Right Side untouched', p.calls.length === 1 && p.calls[0].vk !== 'RSV', p);
  await r.ctx.close();

  r = await open(browser, {});
  await photoStep(r.pg);
  const box = await r.pg.evaluate(() => { const z = document.querySelector('#wizard-body .photo-drop-zone[data-view="FV"]'); const q = z.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
  await r.pg.mouse.move(box.x, box.y);
  p = await paste(r.pg, 'image');
  T('C4 the mouse over the Front slot → Front', p.calls.length === 1 && p.calls[0].vk === 'FV', p);
  await r.ctx.close();

  r = await open(browser, {});
  await photoStep(r.pg);
  const note = await r.pg.evaluate(() => { showPhotoSourcePicker('photosItem', 'TV'); const n = document.getElementById('picker-paste-note'); return n && n.offsetParent ? n.textContent : ''; });
  T('C5 the chooser on a computer says Ctrl+V pastes a copied picture into this slot', /Ctrl\+V/.test(note), note);
  p = await paste(r.pg, 'image');
  T('C5 a slot clicked (Top) → Top, and the chooser closes', p.calls.length === 1 && p.calls[0].vk === 'TV' && !p.picker, p);
  await r.ctx.close();

  r = await open(browser, {});
  const all = await photoStep(r.pg);
  await photoStep(r.pg, all.views);
  p = await paste(r.pg, 'image');
  T('C6 every slot full, none picked → it says to click the slot to replace; nothing uploads', p.calls.length === 0 && p.toasts.some(t => /Every slot has a picture/.test(t)), p);
  await r.ctx.close();

  console.log('== C7 · left alone ==');
  r = await open(browser, {});
  await photoStep(r.pg);
  await r.pg.evaluate(() => { const i = document.createElement('input'); i.id = 'tmp-box'; document.getElementById('wizard-body').appendChild(i); });
  p = await paste(r.pg, 'image', '#tmp-box');
  T('C7 a paste into a text box is left to the box', p.calls.length === 0 && !p.prevented, p);
  p = await paste(r.pg, 'text');
  T('C7 a paste of plain text is ignored', p.calls.length === 0 && !p.prevented, p);
  await r.pg.evaluate(async () => { wizard.step = wizard.steps.findIndex(s => s.id === 'conditionDetails'); renderWizardStep(); await new Promise(r => setTimeout(r, 300)); });
  p = await paste(r.pg, 'image');
  T('C7 a picture pasted on a step that is not a photo step is ignored', p.calls.length === 0, p);
  await r.ctx.close();

  r = await open(browser, { w: 412, h: 860, mobile: true });
  m = await photoStep(r.pg);
  T('C1 a phone: no Ctrl+V line (a phone has no Ctrl+V)', !m.hint, m.hint);
  await r.ctx.close();

  console.log('== planted offenders ==');
  let x = await open(browser, { wp: planted(WP, "  document.addEventListener('paste', _wizPhotoPaste);", '', 'listener') });
  await photoStep(x.pg);
  p = await paste(x.pg, 'image');
  T('X-C2 PLANTED: the paste listener not installed → nothing lands (caught)', p.calls.length === 0, p);
  await x.ctx.close();
  x = await open(browser, { wp: planted(WP, "  if (rsv && empty(rsv)) return { sid: rsv.dataset.sid, vk: rsv.dataset.view };", '', 'right side first') });
  await photoStep(x.pg);
  p = await paste(x.pg, 'image');
  T('X-C2b PLANTED: Right Side not preferred → the picture lands somewhere else (caught)', !(p.calls.length === 1 && p.calls[0].vk === 'RSV'), p);
  await x.ctx.close();
  x = await open(browser, { wp: planted(WP, "  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;", '', 'text box guard') });
  await photoStep(x.pg);
  await x.pg.evaluate(() => { const i = document.createElement('input'); i.id = 'tmp-box'; document.getElementById('wizard-body').appendChild(i); });
  p = await paste(x.pg, 'image', '#tmp-box');
  T('X-C7 PLANTED: the text-box guard removed → a paste into a box is taken (caught)', p.calls.length === 1, p);
  await x.ctx.close();
  x = await open(browser, { wp: planted(WP, "  if (!tgt) { showToast(", "  if (!tgt) tgt = { sid: 'photosItem', vk: 'RSV' };\n  if (false) { showToast(", 'never replace') });
  const all2 = await photoStep(x.pg);
  await photoStep(x.pg, all2.views);
  p = await paste(x.pg, 'image');
  T('X-C6 PLANTED: a full step replaces Right Side unasked → caught', p.calls.length === 1, p);
  await x.ctx.close();

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
