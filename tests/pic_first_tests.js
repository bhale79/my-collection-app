#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ADD A PICTURE FIRST — v0.9.1929
//
// Brad (2026-10-11): "sometime a person has pictures on the pc and they don't
// know the order to hit the item number, so i want to have a button that says
// add a picture first … at the end of the item box … when i do this it puts
// the picture in a view box to the right of the add screen. then i can carry
// on." And: "we would put this picture in the right side view when we get to
// pictures."
// Boots the REAL app (app/index.html from disk, real Chromium) and picks a real
// picture through the browser's own file chooser.
//   P1  the button sits at the end of the item-number row, beside Box Only
//   P2  picking a picture: the view box appears to the RIGHT of the Add screen,
//       showing that picture; the button says it is added; header thumbnail too
//   P3  nothing is uploaded on the way
//   P4  Remove takes it back out — the box goes, the button resets
//   P5  at the Photos step it goes in as the first Item photo, the box goes,
//       and the message says it was YOUR picture
//   P6  closing the Add screen takes the box with it
//   P7  a phone: no side box (the header thumbnail shows it); the button is
//       its own full-width line
//   P8  a Want-list add has no button (it ends at no Photos step)
//   P9  PLANTED: without the hand-off the picture never reaches the Photos step
// v0.9.1930 (Brad: "it doesn't give me the option for google photos, just my pc
// harddrive"):
//   G1  the button asks where the picture is — this computer / Google Photos;
//       Cancel takes nothing
//   G2  Google Photos goes through the SHARED picker (drive.js), says what to do
//       while it waits, closes its session, and the photo lands in the view box
//   G3  …and goes in as the first Item photo at the Photos step
//   G4  a phone reads "Take a picture" + "Pick from this phone" (v0.9.1949)
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  pic_first_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const WIZ = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

// a real JPEG, made in the browser and written here once
async function makeJpeg(browser, file) {
  const pg = await browser.newPage();
  const b64 = await pg.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 400;
    const x = c.getContext('2d'); x.fillStyle = 'rgb(180,40,40)'; x.fillRect(0, 0, 640, 400);
    x.fillStyle = 'rgb(20,20,20)'; x.fillRect(80, 120, 480, 160);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  });
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  await pg.close();
}

async function open(browser, o) {
  const pg = await browser.newPage({ viewport: { width: o.w, height: o.h }, userAgent: o.ua });
  const net = [];
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) { net.push(u); return r.abort(); }
    if (o.wiz && u.split('?')[0].endsWith('/app/wizard.js')) return r.fulfill({ body: o.wiz, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(tab => {
    const mk = (n, t) => ({ itemNum: n, variation: '1', itemType: t, description: t, _era: 'pw', _tab: 'Lionel PW - Items', manufacturer: 'Lionel', roadName: 'Bosco', gauge: 'O', yearProd: '1955', varDesc: '' });
    state.masterData = [mk('6014-85', 'Boxcar')];
    _rebuildMasterIndex(); state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); window._allIdxComplete = true;
    state.personalData = {}; state.personalSheetId = 'SID'; accessToken = 'tok';
    window.__ups = [];
    window.uploadWizardPhoto = async function (f, sid, view) { window.__ups.push({ name: f && f.name, size: f && f.size, sid, view }); return {}; };
    window.__toasts = [];
    const _st = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); try { return _st.apply(this, arguments); } catch (e) {} };
    try { _aiUsageMarkSeen(); } catch (e) {}
    startWizardFor(tab);
  }, o.tab || 'collection');
  await pg.waitForTimeout(900);
  return { pg, net };
}
const peek = pg => pg.evaluate(() => {
  const r = id => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), vis: b.width > 0 && getComputedStyle(e).display !== 'none' }; };
  const modal = document.querySelector('#wizard-modal .modal');
  const mb = modal ? modal.getBoundingClientRect() : null;
  const btn = document.getElementById('wiz-picfirst-btn');
  const box = document.querySelector('[data-box-only-checkbox]');
  const panelImg = document.querySelector('#wiz-picfirst-panel img');
  return {
    btn: r('wiz-picfirst-btn'), btnText: btn ? btn.textContent : null,
    input: r('wiz-input'), boxOnly: box ? (b => ({ r: Math.round(b.right), t: Math.round(b.top) }))(box.getBoundingClientRect()) : null,
    panel: r('wiz-picfirst-panel'), panelImgSrc: panelImg ? panelImg.src : '', panelImgW: panelImg ? panelImg.naturalWidth : 0,
    modal: mb ? { l: Math.round(mb.left), r: Math.round(mb.right), t: Math.round(mb.top), b: Math.round(mb.bottom) } : null,
    hero: r('wiz-hero-photo'), file: !!(wizard.data._idItemPhotoFile), picFirst: !!wizard.data._picFirst,
    ups: window.__ups, toasts: window.__toasts,
  };
});
// v0.9.1930: the button first asks where the picture is
async function pick(pg, file) {
  await pg.click('#wiz-picfirst-btn');
  await pg.waitForSelector('#wiz-picfirst-choose [data-pfc="local"]');
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#wiz-picfirst-choose [data-pfc="local"]')]);
  await fc.setFiles(file);
  await pg.waitForTimeout(700);
}
async function toPhotos(pg) {
  await pg.evaluate(() => {
    wizard.data.itemNum = '6014-85'; wizard.matchedItem = state.masterData[0]; wizard.data.matchedItem = state.masterData[0];
    const steps = getSteps(wizard.tab);
    wizard.step = steps.findIndex(s => s.id === 'photosItem');
    renderWizardStep();
  });
  await pg.waitForTimeout(1200);
}

(async () => {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const JPG = path.join(require('os').tmpdir(), 'pic_first_car.jpg');
  try {
    await makeJpeg(browser, JPG);
    for (const sz of [{ name: 'Brad 1920×1032 at 125%', w: 1536, h: 826 }, { name: '1280×720', w: 1280, h: 720 }]) {
      const { pg, net } = await open(browser, sz);
      let s = await peek(pg);
      T('P1 ' + sz.name + ': the button is at the end of the item-number row', s.btn && s.btn.vis && s.boxOnly && s.btn.l >= s.boxOnly.r && Math.abs(s.btn.t - s.input.t) <= 6 && /Add a picture first/.test(s.btnText), s);
      T('P1 ' + sz.name + ': the item-number box keeps room to type', s.input && s.input.w >= 220, s.input);
      const net0 = net.length;   // page-load requests (fonts, libraries) are not the picture
      await pick(pg, JPG);
      s = await peek(pg);
      T('P2 ' + sz.name + ': the view box appears to the RIGHT of the Add screen', s.panel && s.panel.vis && s.modal && s.panel.l >= s.modal.r && s.panel.r <= sz.w, { panel: s.panel, modal: s.modal });
      T('P2 ' + sz.name + ': …showing the picture', /^blob:/.test(s.panelImgSrc) && s.panelImgW === 640, { src: s.panelImgSrc, w: s.panelImgW });
      T('P2 ' + sz.name + ': the button says it is added; the header thumbnail shows it', /Picture added/.test(s.btnText) && s.hero && s.hero.vis, { btn: s.btnText, hero: s.hero });
      T('P3 ' + sz.name + ': nothing uploaded, nothing sent', s.ups.length === 0 && net.length === net0, { ups: s.ups, net: net.slice(net0) });
      if (sz.w === 1536) {
        // P4 Remove
        await pg.click('#wiz-picfirst-panel [data-pf="remove"]');
        await pg.waitForTimeout(300);
        s = await peek(pg);
        T('P4 Remove: the box goes, the picture is let go, the button resets', !s.panel && !s.file && !s.picFirst && /Add a picture first/.test(s.btnText) && !(s.hero && s.hero.vis), s);
        // P5 Photos step
        await pick(pg, JPG);
        await toPhotos(pg);
        s = await peek(pg);
        const up = s.ups[0] || {};
        T('P5 at the Photos step it goes in as the first Item photo', s.ups.length === 1 && up.name === path.basename(JPG) && up.sid === 'photosItem' && !!up.view, s.ups);
        T('P5 …the side box goes and the slot is cleared', !s.panel && !s.file && !s.picFirst, s);
        T('P5 …and the message says it was your picture', s.toasts.some(t => /Your picture was added as the first Item photo/.test(t)) && !s.toasts.some(t => /identified it from/.test(t)), s.toasts);
        // P6 close
        await pg.evaluate(() => { startWizardFor('collection'); });
        await pg.waitForTimeout(700);
        await pick(pg, JPG);
        await pg.evaluate(() => _doCloseWizard());
        await pg.waitForTimeout(300);
        T('P6 closing the Add screen takes the box with it', !(await pg.$('#wiz-picfirst-panel')));
      }
      await pg.close();
    }
    // P7 phone
    {
      const { pg } = await open(browser, { w: 390, h: 800, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
      let s = await peek(pg);
      T('P7 a phone: the button is its own full-width line under the item number', s.btn && s.btn.vis && s.btn.t > s.input.b && s.btn.w >= 300, { btn: s.btn, input: s.input });
      await pick(pg, JPG);
      s = await peek(pg);
      T('P7 …no side box; the header thumbnail shows the picture', !s.panel && s.hero && s.hero.vis && s.file, s);
      await pg.evaluate(() => { _wizPicFirstRemove(); });
      await pg.click('#wiz-picfirst-btn');
      const phTxt = await pg.$eval('#wiz-picfirst-choose', e => e.innerText);
      // v0.9.1949: on a phone the camera has its own button (Brad: "you cant take a picture")
      T('G4 a phone: the choices read "Take a picture", "Pick from this phone" and "From Google Photos"', /Take a picture/.test(phTxt) && /Pick from this phone/.test(phTxt) && /From Google Photos/.test(phTxt), phTxt);
      await pg.close();
    }
    // G1–G3 — v0.9.1930 (Brad: "it doesn't give me the option for google photos")
    {
      const { pg, net } = await open(browser, { w: 1536, h: 826 });
      await pg.click('#wiz-picfirst-btn');
      const txt = await pg.$eval('#wiz-picfirst-choose', e => e.innerText);
      T('G1 the button asks where the picture is: this computer or Google Photos', /From this computer/.test(txt) && /From Google Photos/.test(txt), txt);
      await pg.click('#wiz-picfirst-choose [data-pfc="cancel"]');
      let s = await peek(pg);
      T('G1 …Cancel closes it and takes nothing', !(await pg.$('#wiz-picfirst-choose')) && !s.file && !s.panel, s);
      // the SHARED Google Photos picker (drive.js), answered as Google would
      const b64 = fs.readFileSync(JPG).toString('base64');
      await pg.evaluate(b64 => {
        window.__gp = { calls: 0, ended: 0, fetched: 0 };
        window.rrGPhotosPickSession = async function (o) { window.__gp.calls++; o.onStatus('waiting'); window.__gp.status = (document.getElementById('rr-gp-wait') || {}).textContent;   /* v0.9.1936: the shared waiting panel */ return { items: [{ type: 'PHOTO', mediaFile: { filename: 'IMG_6014.jpg' } }], auth: {}, sessionId: 'S1' }; };
        window.rrGPhotosFile = async function (item, auth, fb) { window.__gp.fetched++; const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return new File([bin], item.mediaFile.filename, { type: 'image/jpeg' }); };
        window.rrGPhotosEnd = function () { window.__gp.ended++; };
      }, b64);
      await pg.click('#wiz-picfirst-btn');
      await pg.click('#wiz-picfirst-choose [data-pfc="gphotos"]');
      await pg.waitForTimeout(900);
      s = await peek(pg);
      const gp = await pg.evaluate(() => window.__gp);
      T('G2 From Google Photos uses the shared picker, says what to do while it waits, and closes the session', gp.calls === 1 && gp.fetched === 1 && gp.ended === 1 && /Pick ONE photo/.test(gp.status || ''), gp);
      T('G2 …the Google photo lands in the view box, the button says it is added', s.panel && s.panel.vis && s.panelImgW === 640 && /Picture added/.test(s.btnText) && !(await pg.$('#wiz-picfirst-choose')), s);
      await toPhotos(pg);
      s = await peek(pg);
      T('G3 …and goes in as the first Item photo at the Photos step', s.ups.length === 1 && s.ups[0].name === 'IMG_6014.jpg' && s.ups[0].sid === 'photosItem', s.ups);
      await pg.close();
    }
    // P8 want list
    {
      const { pg } = await open(browser, { w: 1536, h: 826, tab: 'want' });
      const s = await peek(pg);
      T('P8 a Want-list add has no Add a picture first button', !s.btn && !!s.input, s);
      await pg.close();
    }
    // P9 planted: the hand-off block removed
    {
      // v0.9.1937: the hand-off block now opens with a comment (Right Side View, _wizHandOffView).
      const planted = WIZ.replace("    if (wizard.data._idItemPhotoFile) {\n      // v0.9.1937", "    if (false) {\n      // v0.9.1937");
      if (planted === WIZ) throw new Error('could not plant');
      const { pg } = await open(browser, { w: 1536, h: 826, wiz: planted });
      await pick(pg, JPG);
      await toPhotos(pg);
      const s = await peek(pg);
      T('P9 PLANTED: without the hand-off the picture never reaches the Photos step (and P5 would fail)', s.ups.length === 0, s.ups);
      await pg.close();
    }
  } finally { await browser.close(); try { fs.unlinkSync(JPG); } catch (e) {} }
  console.log('\npic_first_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.stack); process.exit(1); });
