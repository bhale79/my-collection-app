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
//
// v0.9.1959 (Brad: "be freaking consistant" — then, on a 3:2 photo, "this is
// better / except you have to scroll to see what it read / scale the buttons
// back so they are not so gigantic"): EVERY photo beside the buttons, whatever
// its shape (the wide-shot arrangement is gone), and smaller buttons so the
// whole "From the photo" box shows without scrolling. W1/W2/S3/W6d/X1–X3 rewritten.
//   C1  every shape (7:1, 3:2, tall, People Pack) puts the photo in the SAME left cell
//   B1  the laptop button sizes (Add 0.86rem, the others 0.76rem) — the phone keeps its own
//   R1  Brad's 647 reading (5 lines of why) shows WHOLE, no scrolling — 3:2, 7:1, three photos
//   W4  Sales List and the existing-item add each as wide as their words (the long one on one line)
//   X1  PLANTED: the v1958 button sizes back → the reading is cut off again (caught)
//   X2  PLANTED: a wide shot sent across the top again → C1/W1 catch it
//   W6e a tall photo + three photos: the photo gives way, the strip stays on the card
//   X3  PLANTED: _pinRvFitHero a no-op → the 3:2 photo stops filling its side (caught)
//   X4  PLANTED: the fit forgets the strip → a tall photo + three photos pushes it off the card (caught)
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  review_card_laptop_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }

const SRC = require('./lib/pin-source').pinSource();
function hooked(s) {   // expose the inbox's group list, as photo-inbox-tests does
  return require('./lib/pin-source').pinHook(s, '\n;window.__PG={set groups(v){PIN._groups=v;}};\n');   // inside the first piece's wrapper
}
function planted(from, to, what) {
  if (SRC.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return SRC.replace(from, to);
}

// opts: { w, h, dpr, mobile, files, shape:'wide'|'32', scale, src }
// Brad's 647 card, 2026-10-15: "number only — No. 647" with five lines of why
const READ647 = { num: '647', raw: 'DIESEL NO 8359 B&O GM50 LIONEL 647 708 607',
  dbg: { cand: ['8357', '647', '708', '607'], joined: '8357', viaMaker: '647', inEra: ['8357:mpc', '647:af_gilbert', '708:af_gilbert'], offEra: [] } };
async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: o.dpr || 1,
    userAgent: o.mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(([scale, nf, rd]) => {
    try {
      localStorage.setItem('lv_font_scale', scale || 'normal');
      localStorage.setItem('rr_pin_help_seen', '1'); localStorage.setItem('rr_photoid_help_seen', '1');   // the second is the help pop-up's own flag
      localStorage.setItem('rr_inbox_ids', JSON.stringify({ f0a: rd || { num: '6556', mfr: 'Lionel', road: 'M-K-T', desc: 'Stock Car' } }));
    } catch (e) {}
    window.__NF = nf;
  }, [o.scale, o.files || 1, o.reading || null]);
  const body = hooked(o.src || SRC);
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    if (require('./lib/pin-source').pinFulfill(r, u, body)) return;
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
      topR: R(document.getElementById('pin-rv-top')), readR: R(read), readTop: read ? read.scrollTop : null,
      ai: R(document.getElementById('pin-rv-ailine')),
      aiLines: (() => { const a = document.getElementById('pin-rv-ailine'); return a ? (a.innerText.match(/^\s*\u00b7 /mg) || []).length : 0; })(),
      sizes: (() => { const f = id => { const e = document.getElementById(id); return e ? cs(e).fontSize : null; }; return { add: f('pin-rv-add'), sell: f('pin-rv-sell'), attach: f('pin-rv-attach') }; })(),
    };
  });
  await ctx.close();
  return { m, errs };
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  // v0.9.1959: 737 tall — measured off Brad's own screenshot of this card
  // (Chrome maximised on 1920 x 1080 at 125%, the taskbar showing); was 745
  const BRAD = { w: 1536, h: 737, dpr: 1.25 };
  const onScreen = m => m.act && m.act[0] <= m.act[1] + 1 && m.hidden.length === 0 && m.help && m.help.b <= m.card.b + 1;

  console.log('== Brad\'s laptop, a long side shot of a car ==');
  const a = await open(browser, Object.assign({}, BRAD));
  T('W0 no script error', a.errs.length === 0, a.errs);
  // the photo wholly inside its cell, the strip under it and on the card
  const stack = m => m.photo && m.strip && m.topR && m.photo.y >= m.topR.y - 1 && m.strip.y >= m.photo.b - 1 && m.strip.b <= m.card.b + 1;
  const beside = m => m.photo && m.actR && m.photo.r <= m.actR.x + 2 && !m.wideshot;
  // the whole "From the photo" box inside the right column's visible window, nothing scrolled
  const readWhole = m => m.ai && m.readR && m.readTop === 0 && m.ai.y >= m.readR.y - 1 && m.ai.b <= m.readR.b + 1;
  T('W1 a 7:1 side shot sits BESIDE the buttons, like every other photo', beside(a.m), { photo: a.m.photo, act: a.m.actR, wideshot: a.m.wideshot });
  T('W2 …and runs the full width of its cell (≥ 95%)', a.m.photo.w >= 0.95 * (a.m.topR.w - 4), { photo: a.m.photo, cell: a.m.topR });
  T('W3 every button is on screen, none below the card', onScreen(a.m), { act: a.m.act, hidden: a.m.hidden, help: a.m.help, card: a.m.card });
  // v0.9.1958: ONE big Add across, the other two adds side by side under it
  T('W4 one big Add, with Sales List and the existing-item add side by side under it',
    a.m.grid && Math.abs(a.m.sellR.y - a.m.attR.y) < 2 && a.m.sellR.y > a.m.addH.b - 2 && a.m.addH.w > a.m.sellR.w * 1.6, { add: a.m.addH, sell: a.m.sellR, att: a.m.attR });
  T('S4 the calmer controls: help is a small "?", Discard is a plain red link (no button box)',
    a.m.helpTxt === '?' && a.m.help.w < 40 && a.m.discard && /Discard Photo/.test(a.m.discard.txt) && /underline/.test(a.m.discard.deco) && /rgba\(0, 0, 0, 0\)|transparent/.test(a.m.discard.bg), { help: a.m.helpTxt, discard: a.m.discard });
  // v0.9.1969: the size table follows the window's height too — on this short
  // window (1536x737) every pop-up is 1.25 now, and this card stays at 1.25
  T('W8 this card is at 1.25x, as every other pop-up is on this short window (v1969 table)', a.m.zoom === '1.25' && a.m.otherZoom === '1.25', [a.m.zoom, a.m.otherZoom]);
  // v0.9.1959: "scale the buttons back so they are not so gigantic" — from the ONE place (_RV_SIZE)
  T('B1 the laptop buttons are the smaller sizes: Add 0.86rem, the others 0.76rem (were 0.98 / 0.84)',
    a.m.sizes.add === '13.76px' && a.m.sizes.sell === '12.16px' && a.m.sizes.attach === '12.16px', a.m.sizes);

  console.log('== a normal 3:2 photo ==');
  const b = await open(browser, Object.assign({ shape: '32' }, BRAD));
  T('W5 the whole 3:2 photo is on screen and at least a third of the page tall', b.m.photo.y >= b.m.card.y && b.m.photo.h >= b.m.inner[1] / 3, { photo: b.m.photo, card: b.m.card });
  T('W5b …and every button is on screen', onScreen(b.m), { act: b.m.act, hidden: b.m.hidden });
  T('S1 the 3:2 photo sits BESIDE the buttons and is at least two thirds of the card tall', beside(b.m) && b.m.photo.h >= 0.66 * b.m.card.h, { photo: b.m.photo, act: b.m.actR, card: b.m.card });

  console.log('== a tall photo, and Brad\'s People Pack crop ==');
  const tl = await open(browser, Object.assign({ shape: 'tall' }, BRAD));
  T('S2 a tall photo: beside the buttons, every button on screen', beside(tl.m) && onScreen(tl.m), { photo: tl.m.photo, act: tl.m.act, hidden: tl.m.hidden });
  const pp = await open(browser, Object.assign({ shape: 'pp' }, BRAD));
  T('S3 the People Pack crop (3.3:1): BESIDE the buttons too, every button on screen', beside(pp.m) && onScreen(pp.m), { photo: pp.m.photo, act: pp.m.act, hidden: pp.m.hidden });
  const same = [a, b, tl, pp].map(r => r.m.topR);
  T('C1 consistent: all four shapes put the photo in the SAME left cell, the buttons in the same place',
    same.every(r => Math.abs(r.x - same[0].x) < 1 && Math.abs(r.w - same[0].w) < 1 && Math.abs(r.h - same[0].h) < 1)
    && [a, b, tl, pp].every(r => beside(r.m) && Math.abs(r.m.actR.x - a.m.actR.x) < 1), { cells: same, act: [a, b, tl, pp].map(r => r.m.actR.x) });

  console.log('== Brad\'s 647 reading: the whole "From the photo" box, no scrolling ==');
  const r1 = await open(browser, Object.assign({ shape: '32', reading: READ647 }, BRAD));
  T('R1 (set-up) the reading is as long as Brad\'s (≥ 5 lines of why)', r1.m.aiLines >= 5, r1.m.aiLines);
  T('R1 a 3:2 photo: the whole reading shows under the buttons without scrolling', readWhole(r1.m) && onScreen(r1.m), { ai: r1.m.ai, read: r1.m.readR, scroll: r1.m.read });
  const r2 = await open(browser, Object.assign({ reading: READ647 }, BRAD));
  T('R1 a 7:1 shot: the same', readWhole(r2.m) && onScreen(r2.m), { ai: r2.m.ai, read: r2.m.readR });
  const r3 = await open(browser, Object.assign({ shape: '32', files: 3, reading: READ647 }, BRAD));
  T('R1 three photos: the same', readWhole(r3.m) && onScreen(r3.m), { ai: r3.m.ai, read: r3.m.readR });

  console.log('== three photos ==');
  const c = await open(browser, Object.assign({ files: 3 }, BRAD));
  T('W6 photo strip and view slots sit side by side', c.m.rail && c.m.views && Math.abs(c.m.rail.y - c.m.views.y) < 30 && c.m.views.x > c.m.rail.r - 2, { rail: c.m.rail, views: c.m.views });
  T('W6b …and every button is on screen', onScreen(c.m), { act: c.m.act, hidden: c.m.hidden, help: c.m.help, card: c.m.card });
  const c2 = await open(browser, Object.assign({ files: 3, shape: '32' }, BRAD));
  T('W6c a 3:2 photo with three photos: the photo gives way so the strip stays on the card, every button on screen',
    onScreen(c2.m) && c2.m.photo.h >= 120 && stack(c2.m), { act: c2.m.act, hidden: c2.m.hidden, photo: c2.m.photo, strip: c2.m.strip, card: c2.m.card });
  // the case that NEEDS the fit: a TALL photo above the strip — without the fit it pushes the strip off the card
  const c4 = await open(browser, Object.assign({ files: 3, shape: 'tall' }, BRAD));
  T('W6e a tall photo with three photos: the photo gives way so the strip stays on the card, every button on screen',
    onScreen(c4.m) && c4.m.photo.h >= 160 && stack(c4.m), { act: c4.m.act, photo: c4.m.photo, strip: c4.m.strip, cell: c4.m.topR, card: c4.m.card });
  const c3 = await open(browser, Object.assign({ files: 3, shape: 'pp' }, BRAD));
  T('W6d the People Pack crop with three photos: beside the buttons, strip on the card, every button on screen',
    beside(c3.m) && onScreen(c3.m) && stack(c3.m), { act: c3.m.act, hidden: c3.m.hidden, photo: c3.m.photo, strip: c3.m.strip });

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
  const x1 = await open(browser, Object.assign({ shape: '32', reading: READ647, src: planted(
    "      ? { add: 'padding:0.42rem 0.6rem;font-size:0.86rem;', main: 'padding:0.3rem 0.45rem;font-size:0.76rem;', grid: 'padding:0.3rem 0.45rem;font-size:0.76rem;' }",
    "      ? { add: 'padding:0.72rem 0.6rem;font-size:0.98rem;', main: 'padding:0.5rem 0.5rem;font-size:0.84rem;', grid: 'padding:0.5rem 0.5rem;font-size:0.84rem;' }", 'old sizes') }, BRAD));
  T('X1 PLANTED: the v1958 button sizes back → the 647 reading is cut off again (R1 would fail)', !readWhole(x1.m), { ai: x1.m.ai, read: x1.m.readR });
  const x2 = await open(browser, Object.assign({ src: planted("    var box = img.parentElement;\n",
    "    var box = img.parentElement;\n    if (img.naturalWidth / img.naturalHeight >= 2.5) { var g0 = document.getElementById('pin-rv-cols'); g0.style.gridTemplateAreas = '\"photo photo\" \"act read\"'; }   // planted\n", 'across the top') }, BRAD));
  T('X2 PLANTED: a wide shot sent across the top again → caught (W1/C1 would fail)', !beside(x2.m), { photo: x2.m.photo, act: x2.m.actR });
  const x3 = await open(browser, Object.assign({ shape: '32', src: planted("    img.style.maxHeight = h + 'px'; if (box) box.style.maxHeight = h + 'px';",
    "    // planted: never fit", 'no fit') }, BRAD));
  T('X3 PLANTED: _pinRvFitHero a no-op → the 3:2 photo no longer fills its side (S1 would fail)', x3.m.photo && x3.m.photo.h < 0.66 * x3.m.card.h, { photo: x3.m.photo, card: x3.m.card });
  const x4 = await open(browser, Object.assign({ files: 3, shape: 'tall', src: planted("    var room = top.clientHeight - (strip ? strip.offsetHeight + 8 : 0) - 8;",
    "    var room = top.clientHeight - 8;   // planted: forgets the strip", 'no strip room') }, BRAD));
  T('X4 PLANTED: the fit forgets the photo strip → a tall photo pushes the photo out of its cell, over the strip (W6e would fail)', !stack(x4.m), { cell: x4.m.topR, strip: x4.m.strip, card: x4.m.card, photo: x4.m.photo });

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
