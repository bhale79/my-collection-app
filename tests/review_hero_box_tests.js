#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// REVIEW CARD — THE BIG PHOTO BOX FOLLOWS THE PHOTO — v0.9.1829
// (real Chromium; the real _pinRvHeroHtml lifted out of photo-inbox.js)
//
// Brad, phone, 2026-09-28: "on the page where you crop, once you crop it can
// we make the photo box match the crop so that we dont have to scroll so
// much." v1705 pinned the phone's box at a fixed 40vh; a boxcar cropped to a
// wide strip then floated in the middle of a tall empty box with the details
// a screen below.
//
// THE RULE: the box is as tall as the photo, and no taller than the cap
// (40vh on a phone, 40/52vh on a computer). A wide crop gets a short box; a
// tall photo stops at the cap; an empty box (photo still loading) keeps a
// small floor so the ✂ and 🔍 never sit on each other. Section D plants the
// old fixed-height box and the pins go red.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  review_hero_box_tests needs playwright and it is not installed.'); process.exit(1); }
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

const PI = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');
function fnBody(sig) {
  const i = PI.indexOf(sig); if (i < 0) return '';
  let d = 0;
  for (let k = PI.indexOf('{', i); k < PI.length; k++) { if (PI[k] === '{') d++; else if (PI[k] === '}') { d--; if (!d) return PI.slice(i, k + 1); } }
  return '';
}
const HERO = fnBody('function _pinRvHeroHtml(maxH)');
// The old builder, for the offender: the phone's fixed-height mode of v1705.
const OLD_HERO = "function _pinRvHeroHtml(fixedH) { var box = 'position:relative;border-radius:12px;overflow:hidden;background:#26262e;display:flex;align-items:center;justify-content:center;margin-bottom:0.5rem;height:' + fixedH + ';'; var img = 'max-width:100%;object-fit:contain;display:block;cursor:zoom-in;max-height:100%;'; return '<div style=\"' + box + '\"><img id=\"pin-rv-main\" data-rvbig=\"' + _mainFid + '\" style=\"' + img + '\" alt=\"\"><button style=\"' + _cornBtn + ';left:8px;bottom:8px\">🔍</button><button style=\"' + _cornBtn + ';top:8px;right:8px\">✂</button></div>'; }";

async function run(browser, width, height, heroSrc, maxH) {
  const pg = await browser.newPage({ viewport: { width, height } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.setContent('<!doctype html><html><body style="margin:0;padding:12px;background:#111"><div id="card" style="width:100%"></div></body></html>');
  const out = await pg.evaluate(async ({ heroSrc, maxH }) => {
    const _cornBtn = 'position:absolute;width:30px;height:30px;border-radius:8px;border:none;background:rgba(0,0,0,0.6);color:#fff;font-size:0.9rem;line-height:1;cursor:pointer;padding:0;z-index:2';
    const hero = new Function('_mainFid', '_cornBtn', heroSrc + '\nreturn _pinRvHeroHtml;')('f1', _cornBtn);
    document.getElementById('card').innerHTML = hero(maxH);
    const box = document.querySelector('#card > div'), img = document.getElementById('pin-rv-main');
    const photo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#d02020'; x.fillRect(0, 0, w, h); return c.toDataURL('image/jpeg', 0.8); };
    const load = src => new Promise(r => { img.onload = () => r(); img.onerror = () => r(); img.src = src; });
    const size = () => { const b = box.getBoundingClientRect(), i = img.getBoundingClientRect(); const btns = Array.from(box.querySelectorAll('button')).map(x => x.getBoundingClientRect()); return { box: { w: Math.round(b.width), h: Math.round(b.height) }, img: { w: Math.round(i.width), h: Math.round(i.height) }, overlap: btns.length === 2 && !(btns[0].right <= btns[1].left || btns[1].right <= btns[0].left || btns[0].bottom <= btns[1].top || btns[1].bottom <= btns[0].top) }; };
    const r = { vh: innerHeight, empty: size() };
    await load(photo(3000, 1000)); r.wide = size();     // a boxcar cropped to a strip (3:1)
    await load(photo(1500, 2000)); r.tall = size();     // a portrait photo (3:4)
    await load(photo(1600, 1200)); r.landscape = size(); // a plain 4:3 photo
    return r;
  }, { heroSrc, maxH });
  out.errs = errs;
  await pg.close();
  return out;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  T('S0  the real builder was lifted (one argument: the cap)', HERO.length > 300 && /function _pinRvHeroHtml\(maxH\)/.test(HERO), HERO.slice(0, 80));

  console.log('== A · a phone (360 × 780), cap 40vh ==');
  const p = await run(browser, 360, 780, HERO, '40vh');
  const cap = Math.round(0.4 * p.vh);
  T('A1  a wide crop (3:1) gets a SHORT box — the photo\'s own height (about a third of the width), far under the cap', p.wide.box.h === p.wide.img.h && Math.abs(p.wide.box.h - p.wide.box.w / 3) <= 2 && p.wide.box.h < cap * 0.6, { wide: p.wide, cap });
  T('A2  a tall photo stops at the cap (40% of the screen)', Math.abs(p.tall.box.h - cap) <= 1 && p.tall.img.h <= cap, { tall: p.tall, cap });
  T('A3  a plain 4:3 photo: the box is the photo\'s height (three quarters of the width)', p.landscape.box.h === p.landscape.img.h && Math.abs(p.landscape.box.h - p.landscape.box.w * 0.75) <= 2, p.landscape);
  T('A4  the box changes with the photo — the wide crop\'s box is much shorter than the tall photo\'s', p.wide.box.h < p.tall.box.h * 0.5, { wide: p.wide.box.h, tall: p.tall.box.h });
  T('A5  while the photo is still loading the box keeps a small floor (64px) and the ✂ and 🔍 do not overlap', p.empty.box.h === 64 && !p.empty.overlap, p.empty);
  T('A6  no page errors', p.errs.length === 0, p.errs);

  console.log('\n== B · a computer (1200 × 900), cap 52vh ==');
  const d = await run(browser, 1200, 900, HERO, '52vh');
  const dcap = Math.round(0.52 * d.vh);
  T('B1  the same rule on a computer: wide crop → the photo\'s height; tall photo → the cap', d.wide.box.h === d.wide.img.h && d.wide.box.h < dcap && Math.abs(d.tall.box.h - dcap) <= 1, { wide: d.wide, tall: d.tall, dcap });
  T('B2  no page errors', d.errs.length === 0, d.errs);

  console.log('\n== D · the planted offender: the old fixed-height phone box ==');
  const o = await run(browser, 360, 780, OLD_HERO, '40vh');
  T('OFFENDER 1: with the box pinned at 40vh the wide crop floats in a tall box → A1 red', Math.abs(o.wide.box.h - cap) <= 1 && o.wide.img.h < o.wide.box.h * 0.6, { wide: o.wide, cap });
  await browser.close();

  console.log('\n== E · the source ==');
  T('E1  ONE builder, ONE mode: the phone and the desktop lines each pass only the cap',
    /var _stripHtml = _pinRvHeroHtml\('40vh'\)/.test(PI) && /var _photoWide = _pinRvHeroHtml\(_wide2 \? '40vh' : '52vh'\)/.test(PI) && (PI.match(/_pinRvHeroHtml\(/g) || []).length === 3);
  T('E2  no fixed-height mode is left in the builder', !/fixedH/.test(HERO) && !/height:' \+ /.test(HERO.replace(/max-height:' \+ /g, '')));

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
