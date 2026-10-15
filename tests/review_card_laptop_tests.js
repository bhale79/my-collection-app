#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE PHOTO INBOX REVIEW CARD ON A LAPTOP — v0.9.1943   (real Chromium, REAL app)
//
// Brad, 2026-10-14, on his laptop (1920 x 1080 at 125%, so the page is 1536 wide
// and pop-ups are shown at 1.5x): "in the photo inbox, when you click a photo,
// you can [hardly] even see the photo. scale things down so you get a decent
// photo to see. all the other text is large. the buttons could be put into a
// grid". A long side shot of a car came out about an inch tall, and the lower
// buttons were below the bottom of the card.
//
// The fix (photo-inbox.js + app.css):
//   - the photo runs across the FULL width of the card, above the columns
//   - the four "what to do" buttons are a 2 x 2 grid beside the "not sure" grid
//   - every button's size and shape comes from ONE place (_rvBtn)
//   - this one card is shown at 1.25x, a step smaller than the other pop-ups
//   - _pinRvFitHero takes any overflow off the photo, so no button is hidden
//   - with several photos, the photo strip and view slots sit side by side
//
// Measured on Brad's screen size (1536 x 745 page, 1.25 device pixels):
//   W1-W3  a long side shot (7:1): full card width, every button on screen
//   W4     the four action buttons are a 2 x 2 grid
//   W5     a 3:2 photo: whole photo on screen, at least as tall as a third of the page
//   W6     three photos: strip + view slots beside each other, every button on screen
//   W7     Large text: every button still on screen
//   W8     this card is at 1.25x; every other pop-up keeps 1.5x
//   P1     the phone card: buttons stacked, sizes exactly as before v1943
//   W6c    a 3:2 photo + three photos: the photo gives way (the case that needs the fit)
//   X1     PLANTED: _pinRvFitHero a no-op → that case hides buttons (caught)
//   X2     PLANTED: the photo back in the left column → the long shot is short again (caught)
//
// v0.9.1958 (Brad, the same card: "This is way too big. is so big that i can't
// see all the buttons as i get lost" — "just do it"): photo and controls SIDE BY
// SIDE for an ordinary photo; a very wide shot (RR_PIN_RV.wideShot, 2.5:1) still
// runs across the top with the two button groups side by side under it. ONE big
// orange Add, the other two adds side by side, help as a small ?, Discard as a
// quiet link. W1/W2/W4/W5 rewritten for that; S1–S4 and X3 added.
//   S1  a 3:2 photo: beside the buttons, at least two thirds of the card tall
//   S2  a tall photo: beside the buttons, every button on screen
//   S3  Brad's People Pack crop (3.3:1): across the top, ≥ 250px tall, every button on screen
//   S4  the calmer controls: one main button, help is "?", Discard is a link
//   X3  PLANTED: never side by side → the 3:2 photo is short again (caught)
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  review_card_laptop_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }

const SRC = fs.readFileSync(path.join(APP, 'photo-inbox.js'), 'utf8');
function hooked(s) {   // expose the inbox's group list, as photo-inbox-tests does
  const cut = s.lastIndexOf('})();');
  return s.slice(0, cut) + '\n;window.__PG={set groups(v){_groups=v;}};\n' + s.slice(cut);
}
function planted(from, to, what) {
  if (SRC.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return SRC.replace(from, to);
}

// opts: { w, h, dpr, mobile, files, shape:'wide'|'32', scale, src }
async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: o.dpr || 1,
    userAgent: o.mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(([scale, nf]) => {
    try {
      localStorage.setItem('lv_font_scale', scale || 'normal');
      localStorage.setItem('rr_pin_help_seen', '1');
      localStorage.setItem('rr_inbox_ids', JSON.stringify({ f0a: { num: '6556', mfr: 'Lionel', road: 'M-K-T', desc: 'Stock Car' } }));
    } catch (e) {}
    window.__NF = nf;
  }, [o.scale, o.files || 1]);
  const body = hooked(o.src || SRC);
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    if (u.split('?')[0].endsWith('/app/photo-inbox.js')) return r.fulfill({ body, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  await pg.evaluate(async (shape) => {
    const pic = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      g.fillStyle = '#c0282d'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; for (let x = 0; x < w; x += 40) g.fillRect(x, 0, 6, h); return c.toDataURL('image/jpeg', 0.8); };
    const img = shape === '32' ? pic(1600, 1067) : shape === 'tall' ? pic(900, 1200) : shape === 'pp' ? pic(1464, 448) : pic(1600, 228);
    const mk = (n, t, desc) => ({ itemNum: n, variation: '', itemType: t, description: desc, _era: 'pw', _tab: 'Lionel PW - Items', rowId: 'KKKKKKKKKK', yearProd: '1958', roadName: 'M-K-T', gauge: 'O', varDesc: '' });
    state.masterData = [mk('6556', 'Stock Car', 'M-K-T Stock Car, red with white lettering')];
    _rebuildMasterIndex(); state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); state.masterByRowIdAll = state.masterByRowId; window._allIdxComplete = true;
    state.personalData = {}; window.showToast = function () {};
    window.loadDriveThumb = function (fid, el) { if (el && el.tagName === 'IMG') el.src = img; };
    window.driveRequest = async function () { return {}; };
    window.__PG.groups = [{ key: 'g0', files: Array.from({ length: window.__NF }, (_, i) => ({ id: i ? 'f0' + i : 'f0a', name: 'INBOX 1 p' + i + '.jpg', createdTime: '2026-10-14' })) }];
    window._pinReview('g0');
  }, o.shape || 'wide');
  await pg.waitForTimeout(1200);
  const m = await pg.evaluate(() => {
    const R = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
    const card = document.querySelector('#pin-review-ov .rr-card');
    const act = document.getElementById('pin-rv-act'), read = document.getElementById('pin-rv-read');
    const btns = ['pin-rv-add', 'pin-rv-sell', 'pin-rv-attach'].map(id => document.getElementById(id));
    btns.push([...document.querySelectorAll('#pin-review-ov button')].find(b => /Discard/.test(b.textContent)));
    const help = document.getElementById('pin-rv-help') || [...document.querySelectorAll('#pin-review-ov button')].find(b => /How best/.test(b.textContent));
    const every = [...document.querySelectorAll('#pin-rv-act button')];
    const cardR = R(card);
    // a second, ordinary pop-up card for the zoom comparison
    const other = document.createElement('div'); other.className = 'rr-card'; document.body.appendChild(other);
    const otherZoom = getComputedStyle(other).zoom; other.remove();
    const cs = e => e ? getComputedStyle(e) : null;
    return {
      card: cardR, zoom: cs(card).zoom, otherZoom: otherZoom,
      photo: R(document.getElementById('pin-rv-main')),
      top: !!document.getElementById('pin-rv-top'), strip: R(document.getElementById('pin-rv-strip')),
      rail: R(document.getElementById('pin-rv-photos')), views: R(document.getElementById('pin-rv-views')),
      order: (() => { const h = document.getElementById('pin-review-ov').innerHTML; return [h.indexOf('id="pin-rv-main"'), h.indexOf('id="pin-rv-cols"')]; })(),
      act: act ? [act.scrollHeight, act.clientHeight] : null, read: read ? [read.scrollHeight, read.clientHeight] : null,
      four: btns.map(R), help: R(help), hidden: every.filter(b => R(b).b > cardR.b + 1).map(b => b.textContent.trim()),
      phone: btns.map(b => b && { fs: cs(b).fontSize, pad: cs(b).paddingTop, mb: cs(b).marginBottom }),
      grid: !!document.getElementById('pin-rv-do'), inner: [innerWidth, innerHeight],
      actR: R(act), wideshot: !!document.querySelector('#pin-rv-cols.pin-rv-wideshot'),
      helpTxt: help ? help.textContent.trim() : '', discard: (() => { const d = document.getElementById('pin-rv-discard'); return d ? { bg: getComputedStyle(d).backgroundColor, txt: d.textContent.trim(), deco: getComputedStyle(d).textDecorationLine } : null; })(),
      addH: R(document.getElementById('pin-rv-add')), sellR: R(document.getElementById('pin-rv-sell')), attR: R(document.getElementById('pin-rv-attach')),
    };
  });
  await ctx.close();
  return { m, errs };
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const BRAD = { w: 1536, h: 745, dpr: 1.25 };
  const onScreen = m => m.act && m.act[0] <= m.act[1] + 1 && m.hidden.length === 0 && m.help && m.help.b <= m.card.b + 1;

  console.log('== Brad\'s laptop, a long side shot of a car ==');
  const a = await open(browser, Object.assign({}, BRAD));
  T('W0 no script error', a.errs.length === 0, a.errs);
  T('W1 a 7:1 side shot runs across the TOP (the wide-shot arrangement)', a.m.wideshot && a.m.photo.b <= a.m.actR.y + 2, { photo: a.m.photo, act: a.m.actR });
  T('W2 a 7:1 side shot runs the card\'s full width (≥ 90%) and is ≥ 200px tall (was 94)', a.m.photo.w >= 0.9 * (a.m.card.w - 60) && a.m.photo.h >= 200, { photo: a.m.photo, card: a.m.card });
  T('W3 every button is on screen, none below the card', onScreen(a.m), { act: a.m.act, hidden: a.m.hidden, help: a.m.help, card: a.m.card });
  // v0.9.1958: ONE big Add across, the other two adds side by side under it
  T('W4 one big Add, with Sales List and the existing-item add side by side under it',
    a.m.grid && Math.abs(a.m.sellR.y - a.m.attR.y) < 2 && a.m.sellR.y > a.m.addH.b - 2 && a.m.addH.w > a.m.sellR.w * 1.6, { add: a.m.addH, sell: a.m.sellR, att: a.m.attR });
  T('S4 the calmer controls: help is a small "?", Discard is a plain red link (no button box)',
    a.m.helpTxt === '?' && a.m.help.w < 50 && a.m.discard && /Discard Photo/.test(a.m.discard.txt) && /underline/.test(a.m.discard.deco) && /rgba\(0, 0, 0, 0\)|transparent/.test(a.m.discard.bg), { help: a.m.helpTxt, discard: a.m.discard });
  T('W8 this card is at 1.25x; every other pop-up keeps 1.5x', a.m.zoom === '1.25' && a.m.otherZoom === '1.5', [a.m.zoom, a.m.otherZoom]);

  console.log('== a normal 3:2 photo ==');
  const b = await open(browser, Object.assign({ shape: '32' }, BRAD));
  T('W5 the whole 3:2 photo is on screen and at least a third of the page tall', b.m.photo.y >= b.m.card.y && b.m.photo.h >= b.m.inner[1] / 3, { photo: b.m.photo, card: b.m.card });
  T('W5b …and every button is on screen', onScreen(b.m), { act: b.m.act, hidden: b.m.hidden });
  T('S1 the 3:2 photo sits BESIDE the buttons and is at least two thirds of the card tall', !b.m.wideshot && b.m.photo.r <= b.m.actR.x + 2 && b.m.photo.h >= 0.66 * b.m.card.h, { photo: b.m.photo, act: b.m.actR, card: b.m.card });

  console.log('== a tall photo, and Brad\'s People Pack crop ==');
  const tl = await open(browser, Object.assign({ shape: 'tall' }, BRAD));
  T('S2 a tall photo: beside the buttons, every button on screen', !tl.m.wideshot && tl.m.photo.r <= tl.m.actR.x + 2 && onScreen(tl.m), { photo: tl.m.photo, act: tl.m.act, hidden: tl.m.hidden });
  const pp = await open(browser, Object.assign({ shape: 'pp' }, BRAD));
  T('S3 the People Pack crop (3.3:1): across the top, ≥ 250px tall, every button on screen', pp.m.wideshot && pp.m.photo.h >= 250 && onScreen(pp.m), { photo: pp.m.photo, act: pp.m.act, hidden: pp.m.hidden });

  console.log('== three photos ==');
  const c = await open(browser, Object.assign({ files: 3 }, BRAD));
  T('W6 photo strip and view slots sit side by side', c.m.rail && c.m.views && Math.abs(c.m.rail.y - c.m.views.y) < 30 && c.m.views.x > c.m.rail.r - 2, { rail: c.m.rail, views: c.m.views });
  T('W6b …and every button is on screen', onScreen(c.m), { act: c.m.act, hidden: c.m.hidden, help: c.m.help, card: c.m.card });
  // the case that NEEDS the fit: a normal-shaped photo (its full 40vh) + the strip + the slots
  const c2 = await open(browser, Object.assign({ files: 3, shape: '32' }, BRAD));
  T('W6c a 3:2 photo with three photos: the photo gives way, every button on screen', onScreen(c2.m) && c2.m.photo.h >= 120, { act: c2.m.act, hidden: c2.m.hidden, photo: c2.m.photo });

  const c3 = await open(browser, Object.assign({ files: 3, shape: 'pp' }, BRAD));
  T('W6d a wide crop with three photos: the photo gives way, every button on screen', c3.m.wideshot && onScreen(c3.m) && c3.m.photo.h >= 120, { act: c3.m.act, hidden: c3.m.hidden, photo: c3.m.photo });

  console.log('== Large text ==');
  const d = await open(browser, Object.assign({ scale: 'large' }, BRAD));
  T('W7 with Large text every button is still on screen', onScreen(d.m), { act: d.m.act, hidden: d.m.hidden, help: d.m.help });

  console.log('== a phone: as it was ==');
  const p = await open(browser, { w: 390, h: 844, dpr: 3, mobile: true });
  const px = v => parseFloat(v);
  T('P1 the phone card has no laptop grid, no full-width top', !p.m.grid && !p.m.top, p.m);
  T('P2 phone button sizes exactly as before v1943 (Add 0.93rem/0.72rem, others 0.9rem/0.68rem, 0.5rem apart)',
    p.m.phone[0] && px(p.m.phone[0].fs) === 14.88 && px(p.m.phone[0].pad) === 11.52 && px(p.m.phone[0].mb) === 8
    && [1, 2].every(i => px(p.m.phone[i].fs) === 14.4 && px(p.m.phone[i].pad) === 10.88 && px(p.m.phone[i].mb) === 8)
    && px(p.m.phone[3].fs) === 14.4 && px(p.m.phone[3].mb) === 0, p.m.phone);

  console.log('== planted offenders ==');
  // v0.9.1958: the give-way is the WIDE-shot arrangement's rule now (a photo beside the buttons cannot push them)
  const x1 = await open(browser, Object.assign({ files: 3, shape: 'pp', src: planted("    var over = Math.max(act.scrollHeight - act.clientHeight, read ? read.scrollHeight - read.clientHeight : 0);",
    "    var over = 0;   // planted: never fit", 'no fit') }, BRAD));
  T('X1 PLANTED: _pinRvFitHero a no-op → a wide crop with three photos hides buttons (caught)', !onScreen(x1.m), { act: x1.m.act, hidden: x1.m.hidden });
  const s2 = planted("    grid.classList.toggle('pin-rv-wideshot', !!wide);", "    wide = false; grid.classList.toggle('pin-rv-wideshot', false);   // planted", 'no wide shot');
  const x2 = await open(browser, Object.assign({ src: s2 }, BRAD));
  T('X2 PLANTED: no wide-shot arrangement → the long shot is short again (caught)', x2.m.photo && x2.m.photo.h < 200, x2.m.photo);
  const s3 = planted("    var wide = img.naturalWidth > 0", "    var wide = true || img.naturalWidth > 0", 'never side by side');
  const x3 = await open(browser, Object.assign({ shape: '32', src: s3 }, BRAD));
  T('X3 PLANTED: never side by side → the 3:2 photo is short again (caught)', x3.m.photo && x3.m.photo.h < 0.66 * x3.m.card.h, { photo: x3.m.photo, card: x3.m.card });

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
