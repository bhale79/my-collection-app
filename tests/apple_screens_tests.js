#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// iPHONE / iPAD SCREENS — 2026-11-01 (PLAN_2026-11-01_APPLE_SCREENS.md)
//
// [stated] Brad 2026-11-01 20:28 CT (his iPhone): "on the iphone, you can't see
// the photo id button" — the Add box's bottom row (Photo ID, ✕, Next) sat behind
// the bottom menu bar. 20:29 (his iPad): "Camera unavailable" with no reason —
// it was Safari's camera permission. 20:31 (his iPad): Research an Item ran off
// the bottom of the screen. 20:50 "yes build it quickly".
//
//   ONE measured number for the bottom bar: back-stack.js rrBottomBarMeasure →
//   --rr-bottom-bar on :root; every pop-up's room at the bottom uses it.
//   The scanner's camera picture gives up exactly the overflow (barcode.js
//   _biFitBox), never below RR_CAMERA.boxMin.
//   ONE camera starter (config.js rrStartCamera) says WHY the camera can't
//   start and writes one diary line.
//
//   C  camera reasons — the real config.js block in Node: each browser error →
//      its words and ONE diary line; Apple / Android / computer words.
//   S  the scan — getUserMedia( is called in ONE place (config.js); a second
//      copy planted in scan-shelve.js turns it red.
//   B  the real app in Chromium: the Add box at iPhone (34px home bar),
//      Android, iPad portrait + landscape — the footer above the bar and every
//      footer button clickable; Research an Item at five iPad sizes and an
//      iPhone — Capture, Gallery, Item #, Look up, Filters on screen; a camera
//      that is refused shows the reason; a fault AFTER the camera started does
//      not say "Camera unavailable".
//   P  planted offenders — the old fixed 92px / 92% lines → red; the bar made
//      40px taller → still green (measured, not guessed); the fit call removed
//      → Research red.
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  apple_screens_tests needs playwright: ' + e.message); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const { SEED } = require('./lib/guide-fixture');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.split(from).join(to);
}
const CT = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html' };
const UA_IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

// ── C: the camera reasons, from the real config.js block ───────────────────
const CFG = read('config.js');
const a0 = CFG.indexOf('const RR_CAMERA = {');
const a1 = CFG.indexOf("if (typeof window !== 'undefined') { window.RR_CAMERA = RR_CAMERA;");
ok('C0 the camera block is in config.js (RR_CAMERA … rrStartCamera)', a0 > 0 && a1 > a0);
function camWorld(ua, gum) {
  const log = [];
  const win = { rrSyncLog: (e, i) => log.push([e, i]) };
  const nav = { userAgent: ua, maxTouchPoints: 5, mediaDevices: gum === null ? undefined : { getUserMedia: gum } };
  const ctx = { window: win, navigator: nav, Promise, String };
  vm.createContext(ctx);
  vm.runInContext(CFG.slice(a0, a1) + '\nthis.RR_CAMERA = RR_CAMERA; this.rrCameraWhy = rrCameraWhy; this.rrStartCamera = rrStartCamera;', ctx);
  return { ctx, log };
}
const W = camWorld(UA_IPAD, null).ctx.RR_CAMERA.words;
(async () => {
  const cases = [
    ['NotAllowedError', UA_IPAD, 'deniedApple', 'denied'],
    ['NotAllowedError', UA_IPHONE, 'deniedApple', 'denied'],
    ['NotAllowedError', UA_ANDROID, 'deniedAndroid', 'denied'],
    ['NotAllowedError', 'Mozilla/5.0 (Windows NT 10.0) Chrome/124', 'denied', 'denied'],
    ['SecurityError', UA_IPAD, 'deniedApple', 'denied'],
    ['NotReadableError', UA_IPAD, 'busy', 'busy'],
    ['AbortError', UA_ANDROID, 'busy', 'busy'],
    ['NotFoundError', UA_IPAD, 'none', 'none'],
    ['OverconstrainedError', UA_ANDROID, 'none', 'none'],
    ['TypeError', UA_IPAD, 'other', 'other'],
  ];
  for (const [name, ua, key, reason] of cases) {
    const w = camWorld(ua, () => Promise.reject({ name }));
    let why = null;
    await w.ctx.rrStartCamera({ video: true }).then(() => {}, r => { why = r; });
    ok('C1 ' + name + ' on ' + ua.split('(')[1].split(';')[0] + ' → the "' + key + '" words + one diary line',
      why && why.reason === reason && why.words === W[key] && w.log.length === 1 && w.log[0][0] === 'camera' && w.log[0][1].indexOf(reason) === 0 && w.log[0][1].indexOf(name) > 0,
      JSON.stringify({ why, log: w.log }));
  }
  {
    const w = camWorld(UA_IPAD, () => { throw { name: 'NotAllowedError' }; });
    let why = null; await w.ctx.rrStartCamera({ video: true }).then(() => {}, r => { why = r; });
    ok('C2 a getUserMedia that throws (not rejects) is still caught and explained', why && why.reason === 'denied' && w.log.length === 1, JSON.stringify(why));
  }
  {
    const w = camWorld(UA_IPAD, null);
    let why = null; await w.ctx.rrStartCamera({ video: true }).then(() => {}, r => { why = r; });
    ok('C3 a browser with no camera support at all → the "none" words', why && why.reason === 'none' && why.words === W.none, JSON.stringify(why));
  }
  {
    const cam = { id: 'cam' };
    const w = camWorld(UA_IPAD, () => Promise.resolve(cam));
    let got = null; await w.ctx.rrStartCamera({ video: true }).then(s => { got = s; });
    ok('C4 a camera that starts → resolves with it, and NO diary line', got === cam && w.log.length === 0, JSON.stringify(w.log));
  }
  const allWords = Object.values(W).join(' ');
  ok('C5 the camera words never say "AI"', !/\bAI\b/.test(allWords));
  ok('C6 the iPad words name the fix (aA → Website Settings → Camera → Allow)', /aA/.test(W.deniedApple) && /Website Settings/.test(W.deniedApple) && /Allow/.test(W.deniedApple));

  // ── S: getUserMedia( in ONE place ─────────────────────────────────────────
  function gumSites(files) {
    const out = [];
    for (const [f, s] of files) {
      const lines = s.split('\n');
      lines.forEach((l, i) => { const code = l.replace(/\/\/.*$/, ''); if (/getUserMedia\s*\(/.test(code)) out.push(f + ':' + (i + 1)); });
    }
    return out;
  }
  const jsFiles = fs.readdirSync(APP).filter(f => /\.js$/.test(f)).map(f => [f, read(f)]);
  const sites = gumSites(jsFiles);
  ok('S1 the camera is started in ONE place (config.js rrStartCamera)', sites.length === 1 && /^config\.js:/.test(sites[0]), sites.join(', '));
  const SS = read('scan-shelve.js');
  ok('S2 Scan to Shelve uses the one starter', /rrStartCamera\s*\(/.test(SS));
  ok('S3 the scanner uses the one starter', /rrStartCamera\s*\(/.test(read('barcode.js')));
  {
    const planted = plant(SS, 'rrStartCamera(', 'navigator.mediaDevices.getUserMedia(', 'S1-P');
    const s2 = gumSites(jsFiles.map(([f, s]) => [f, f === 'scan-shelve.js' ? planted : s]));
    ok('S1 P a second camera start planted in scan-shelve.js turns S1 red', s2.length > 1, s2.join(', '));
  }

  // ── B: the real app in Chromium ───────────────────────────────────────────
  const ex = '/opt/pw-browsers/chromium';
  let browser;
  try { browser = await chromium.launch(Object.assign(fs.existsSync(ex) ? { executablePath: ex } : {}, { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }

  async function boot(S, served, init) {
    const ctx = await browser.newContext({ viewport: { width: S.w, height: S.h }, isMobile: true, hasTouch: true, userAgent: S.ua, permissions: ['camera'] });
    await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
    if (init) await ctx.addInitScript(init);
    const pg = await ctx.newPage();
    const cdp = await ctx.newCDPSession(pg);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: S.top || 0, bottom: S.hb, left: 0, right: 0 } });
    const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 140)));
    await ctx.route('**', r => {
      const u = r.request().url();
      if (!u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('about:') && !u.startsWith('blob:')) return r.abort();
      const name = u.split('?')[0].split('/').pop();
      if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: CT[path.extname(name)] || 'text/plain' });
      return r.continue();
    });
    await pg.goto('file://' + path.join(APP, 'index.html'));
    await pg.waitForTimeout(2200);
    await pg.evaluate(SEED); await pg.waitForTimeout(300);
    return { ctx, pg, errs };
  }

  // the Add box: footer above the bar, every footer button really on top at its centre
  async function addBox(pg, tab) {
    await pg.evaluate(t => { try { openWizard(t); } catch (e) { window.__e = e.message; } }, tab);
    await pg.waitForTimeout(1200);
    const r = await pg.evaluate(() => {
      const c = document.getElementById('rr-ai-usage-card'); if (c) c.remove();   // the one-time explainer card, not part of the box
      const m = document.querySelector('#wizard-modal .modal'), f = m && m.querySelector('.modal-footer'), nav = document.querySelector('.mobile-nav');
      const navOn = nav && getComputedStyle(nav).display !== 'none' && nav.getBoundingClientRect().top < innerHeight;
      const navTop = navOn ? nav.getBoundingClientRect().top : innerHeight;
      const fr = f && f.getBoundingClientRect();
      const btns = f ? Array.from(f.querySelectorAll('button')).filter(x => x.offsetWidth && getComputedStyle(x).visibility !== 'hidden').map(x => {
        const q = x.getBoundingClientRect(); const top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
        return { t: (x.textContent.trim().slice(0, 12) || x.getAttribute('aria-label') || x.id), ok: !!(top && (x === top || x.contains(top))), by: top ? (top.id || String(top.className).slice(0, 30) || top.tagName) : 'none' };
      }) : [];
      const bar = document.documentElement.style.getPropertyValue('--rr-bottom-bar');
      const cover = navOn ? Math.round(innerHeight - nav.getBoundingClientRect().top) : 0;
      return { e: window.__e || null, has: !!(m && f), footBottom: fr ? Math.round(fr.bottom) : null, navTop: Math.round(navTop), H: innerHeight, btns, bar, cover, navOn: !!navOn };
    });
    await pg.evaluate(() => { try { closeWizard(); } catch (e) {} });
    await pg.waitForTimeout(400);
    return r;
  }
  function addOk(r) { return r.has && !r.e && r.btns.length >= 2 && r.footBottom <= r.navTop && r.footBottom <= r.H && r.btns.every(b => b.ok); }

  const ADD_SIZES = [
    { n: 'iPhone 390x844 (34px home bar)', w: 390, h: 844, hb: 34, top: 47, ua: UA_IPHONE },
    { n: 'Android 412x915', w: 412, h: 915, hb: 0, ua: UA_ANDROID },
    { n: 'iPad 1024x1366', w: 1024, h: 1366, hb: 20, top: 24, ua: UA_IPAD },
    { n: 'iPad 1366x1024', w: 1366, h: 1024, hb: 20, top: 24, ua: UA_IPAD },
  ];
  for (const S of ADD_SIZES) {
    const b = await boot(S);
    for (const tab of ['collection', 'want']) {
      const r = await addBox(b.pg, tab);
      ok('B1 ' + S.n + ' — Add (' + tab + '): the footer ends above the bottom bar and every button in it can be tapped', addOk(r), JSON.stringify(r));
      if (tab === 'collection' && r.navOn) ok('B2 ' + S.n + ' — --rr-bottom-bar is the bar\'s measured cover (' + r.cover + 'px)', r.bar === r.cover + 'px', 'bar=' + r.bar + ' cover=' + r.cover);
    }
    ok('B3 ' + S.n + ' — no page errors', !b.errs.length, [...new Set(b.errs)].slice(0, 3).join(' | '));
    await b.ctx.close();
  }

  // Research an Item: the five things to press are on screen and not clipped inside the card
  async function research(pg) {
    await pg.evaluate(() => { try { window.openResearch(); } catch (e) { window.__e = e.message; } });
    await pg.waitForTimeout(2500);
    return pg.evaluate(() => {
      const ov = document.getElementById('bi-overlay'); if (!ov) return { none: true, e: window.__e || null };
      const card = ov.querySelector('.rr-card'); const cr = card.getBoundingClientRect();
      const find = (id, txt) => document.getElementById(id) || Array.from(card.querySelectorAll('button,label')).find(x => (x.textContent || '').indexOf(txt) >= 0);
      const want = [['Capture', find('bi-capture', 'Capture')], ['Gallery', find('bi-file-btn', 'Gallery')], ['Item #', document.getElementById('bi-quick')], ['Look up', find('bi-lookup', 'Look up')], ['Filters', document.getElementById('bi-filters-btn')]];
      const out = want.map(([n, e]) => { if (!e) return n + ':missing'; const q = e.getBoundingClientRect(); return n + ':' + (q.height && q.top >= 0 && q.bottom <= innerHeight && q.top >= cr.top && q.bottom <= cr.bottom ? 'IN' : 'OUT[' + Math.round(q.top) + ',' + Math.round(q.bottom) + ']'); });
      const vb = document.getElementById('bi-vbox');
      return { H: innerHeight, card: [Math.round(cr.top), Math.round(cr.bottom)], out, pic: vb ? Math.round(vb.getBoundingClientRect().height) : null, stat: (document.getElementById('bi-camstatus') || {}).textContent || '' };
    });
  }
  const RES_SIZES = [
    { n: 'iPad 10th gen landscape 1180x740', w: 1180, h: 740, hb: 20, top: 24, ua: UA_IPAD },
    { n: 'iPad mini landscape 1133x680', w: 1133, h: 680, hb: 20, top: 24, ua: UA_IPAD },
    { n: 'iPad 10th gen portrait 820x1100', w: 820, h: 1100, hb: 20, top: 24, ua: UA_IPAD },
    { n: 'iPad Pro landscape 1366x860', w: 1366, h: 860, hb: 20, top: 24, ua: UA_IPAD },
    { n: 'iPad Pro portrait 1024x1280', w: 1024, h: 1280, hb: 20, top: 24, ua: UA_IPAD },
    { n: 'iPhone 390x760', w: 390, h: 760, hb: 34, top: 47, ua: UA_IPHONE },
  ];
  const resIn = r => !r.none && r.out.every(x => /:IN$/.test(x));
  for (const S of RES_SIZES) {
    const b = await boot(S);
    const r = await research(b.pg);
    ok('B4 ' + S.n + ' — Research: Capture, Gallery, Item #, Look up and Filters all on screen', resIn(r), JSON.stringify(r));
    ok('B5 ' + S.n + ' — the camera picture keeps at least RR_CAMERA.boxMin', r.pic >= 150 - 1, 'pic=' + r.pic);
    await b.ctx.close();
  }

  // a refused camera says why (iPad words) and leaves one diary line
  {
    const b = await boot(RES_SIZES[0], null, () => {
      const deny = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
      try { Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: deny, configurable: true }); } catch (e) { navigator.mediaDevices.getUserMedia = deny; }
    });
    const r = await research(b.pg);
    const diary = await b.pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('rr_sync_log') || '[]').filter(x => x.e === 'camera'); } catch (e) { return ['bad']; } });
    ok('B6 iPad, camera refused — the status gives the iPad fix, not "Camera unavailable"', r.stat === W.deniedApple, JSON.stringify(r.stat));
    ok('B7 iPad, camera refused — ONE "camera" diary line naming the reason', diary.length === 1 && /^denied \(NotAllowedError\)$/.test(diary[0].i), JSON.stringify(diary));
    ok('B8 iPad, camera refused — the buttons still fit (the longer words are measured in)', resIn(r), JSON.stringify(r.out));
    await b.ctx.close();
  }
  // a fault AFTER the camera started (the barcode reader refusing its formats) is not "Camera unavailable"
  {
    const b = await boot(RES_SIZES[0], null, () => { window.BarcodeDetector = function () { throw new TypeError('formats not supported'); }; });
    const r = await research(b.pg);
    ok('B9 a barcode reader that throws after the camera started does not say "Camera unavailable"', !/unavailable/i.test(r.stat) && /Camera ready/.test(r.stat), JSON.stringify(r.stat));
    await b.ctx.close();
  }

  // ── P: planted offenders ─────────────────────────────────────────────────
  const CSS = read('app.css'), WIZ = read('wizard.js'), BC = read('barcode.js');
  const BAR = 'calc(var(--rr-bottom-bar) + 7px)';
  // P1 — the old fixed lines put back (CSS 92px / 108px and the box at 92% of the window)
  {
    let css = plant(CSS, '.modal-overlay { padding-bottom: ' + BAR + '; }', '.modal-overlay { padding-bottom: 92px; }', 'P1 overlay');
    css = plant(css, 'max-height: calc(100dvh - var(--rr-bottom-bar) - 23px);', 'max-height: calc(100dvh - 108px);', 'P1 box');
    const wiz = plant(WIZ, 'return Math.max(300, Math.round(Math.min(vv * 0.92, vv - _bar - 23)));', 'return Math.max(300, Math.round(vv * 0.92));', 'P1 wizard');
    const b = await boot(ADD_SIZES[0], { 'app.css': css, 'wizard.js': wiz });
    const r = await addBox(b.pg, 'collection');
    ok('P1 the old fixed 92px / 92% lines served → the iPhone Add footer goes red', !addOk(r), JSON.stringify(r));
    await b.ctx.close();
  }
  // P2 — the bar made 40px taller: still green, because it is measured
  {
    const css = CSS + '\n@media (max-width: 640px) { .mobile-nav { height: 108px !important; } }\n';
    const b = await boot(ADD_SIZES[0], { 'app.css': css });
    const r = await addBox(b.pg, 'collection');
    ok('P2 the bottom bar 40px taller → the iPhone Add footer is STILL above it (measured, not guessed)', addOk(r) && parseInt(r.bar, 10) >= 140, JSON.stringify(r));
    await b.ctx.close();
  }
  // P3 — the measured fit removed → Research runs off an iPad screen again
  {
    const bc = plant(BC, "      _biFitBox();   // 2026-11-01: the picture gives up height so the buttons fit (measured)\n", '', 'P3');
    const b = await boot(RES_SIZES[0], { 'barcode.js': bc });
    const r = await research(b.pg);
    ok('P3 the fit call removed → Research on an iPad 1180x740 goes red', !resIn(r), JSON.stringify(r));
    await b.ctx.close();
  }

  // P4 — the old camera start (one catch for everything, no reason) → the refused camera goes back to "Camera unavailable"
  {
    let bc = plant(BC, "rrStartCamera({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false })", "navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false })", 'P4 start');
    bc = plant(bc, "if (why && why.words) { stat.textContent = why.words; _biFitBox(); return; }", "stat.textContent = 'Camera unavailable \u2014 use \"Photo from gallery\".'; return;", 'P4 catch');
    const b = await boot(RES_SIZES[0], { 'barcode.js': bc }, () => {
      const deny = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
      try { Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: deny, configurable: true }); } catch (e) { navigator.mediaDevices.getUserMedia = deny; }
    });
    const r = await research(b.pg);
    ok('P4 the old camera start served → B6 goes red (the iPad words are gone)', r.stat !== W.deniedApple, JSON.stringify(r.stat));
    await b.ctx.close();
  }
  // P5 — the barcode reader unguarded (the old line) → a fault after start reads "Camera unavailable" again
  {
    let bc = plant(BC, "try { nativeDet = _biHasBD ? new window.BarcodeDetector({ formats: ['ean_13', 'upc_a', 'ean_8', 'upc_e', 'code_128', 'code_39'] }) : null; } catch (eBD) { nativeDet = null; }", "nativeDet = _biHasBD ? new window.BarcodeDetector({ formats: ['ean_13', 'upc_a', 'ean_8', 'upc_e', 'code_128', 'code_39'] }) : null;", 'P5 reader');
    bc = plant(bc, "console.warn('[scanner] after the camera started:', why);", "stat.textContent = 'Camera unavailable \u2014 use \"Photo from gallery\".';", 'P5 catch');
    const b = await boot(RES_SIZES[0], { 'barcode.js': bc }, () => { window.BarcodeDetector = function () { throw new TypeError('formats not supported'); }; });
    const r = await research(b.pg);
    ok('P5 the old reader line + catch served → B9 goes red', /unavailable/i.test(r.stat), JSON.stringify(r.stat));
    await b.ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.stack); process.exit(1); });
