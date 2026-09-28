#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// UPDATE BAR LAYOUT — v0.9.1829   (real Chromium, the REAL app, no stubs)
//
// Brad, phone, 2026-09-27: "the there is an update is all out of shape."
// Measured at 360 px: the bar was ONE flex row with no wrapping, so the
// sentence was squeezed into a 43-px-wide column of seven lines beside the
// two buttons, "Tonight" ran off the right edge, and the whole bar sat on top
// of the bottom menu.
//
// THE RULE: the sentence is a sentence (one or two lines, most of the bar's
// width); the two buttons are a sealed pair on ONE row, every pixel of them
// on screen; on a phone the bar sits ABOVE the bottom menu; on a computer it
// is still one row. Section C plants the old markup and the pins go red.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  update_bar_layout_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

// What the bar looked like before v1829 — the planted offender.
const OLD_CSS = 'position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:100010;display:flex;align-items:center;gap:0.7rem;padding:0.55rem 0.85rem;border-radius:10px;background:var(--surface);border:1px solid var(--accent2);font-family:var(--font-body);font-size:0.83rem;color:var(--text);max-width:calc(100vw - 2rem)';
const OLD_HTML = '<span>A new version of The Rail Roster is ready.</span>'
  + '<button type="button" style="border:none;border-radius:7px;padding:0.35rem 0.8rem;background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-size:0.8rem;font-weight:700;cursor:pointer;flex-shrink:0">Update now</button>'
  + '<button type="button" style="border:1.5px solid var(--border);border-radius:7px;padding:0.35rem 0.8rem;background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.8rem;font-weight:600;cursor:pointer;flex-shrink:0">Tonight</button>';

async function measure(browser, width, height, offender) {
  const pg = await browser.newPage({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(600);
  const out = await pg.evaluate(({ offender, OLD_CSS, OLD_HTML }) => {
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    localStorage.removeItem('rr_update_bar_seen');
    _rrShowUpdateBar('v9.9.9');
    const bar = document.getElementById('rr-update-bar');
    if (!bar) return { noBar: true };
    if (offender) { bar.style.cssText = OLD_CSS; bar.innerHTML = OLD_HTML; }
    const r = el => { const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom) }; };
    const sentence = bar.querySelector('span');
    const buttons = Array.from(bar.querySelectorAll('button'));
    const nav = document.querySelector('.mobile-nav');
    const navShown = !!nav && getComputedStyle(nav).display !== 'none';
    const fontPx = parseFloat(getComputedStyle(sentence).fontSize);
    const res = { vw: innerWidth, vh: innerHeight, bar: r(bar), sentence: r(sentence), sentenceText: sentence.textContent, fontPx, buttons: buttons.map(b => Object.assign({ text: b.textContent }, r(b))), navShown, nav: navShown ? r(nav) : null };
    bar.remove(); localStorage.removeItem('rr_update_bar_seen');
    return res;
  }, { offender, OLD_CSS, OLD_HTML });
  out.errs = errs;
  await pg.close();
  return out;
}
function judge(m) {
  const j = {};
  j.sentenceWide = m.sentence.w >= 0.6 * m.bar.w;                              // a sentence, not a column
  j.sentenceShort = m.sentence.h <= 2.6 * m.fontPx;                             // at most two lines
  j.buttonsOnScreen = m.buttons.length === 2 && m.buttons.every(b => b.x >= 0 && b.r <= m.vw && b.x >= m.bar.x && b.r <= m.bar.r + 1);
  j.buttonsOneRow = m.buttons.length === 2 && Math.abs(m.buttons[0].y - m.buttons[1].y) <= 2 && m.buttons[0].r <= m.buttons[1].x;
  j.barOnScreen = m.bar.x >= 0 && m.bar.r <= m.vw;
  j.aboveNav = !m.navShown || m.bar.b <= m.nav.y;
  j.oneRowWithSentence = m.buttons.length === 2 && Math.abs(m.sentence.y + m.sentence.h / 2 - (m.buttons[0].y + m.buttons[0].h / 2)) <= 4;
  return j;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  console.log('== A · a phone (360 × 780) ==');
  const ph = await measure(browser, 360, 780, false), pj = judge(ph);
  T('A1  the bar is shown, inside the screen', !ph.noBar && pj.barOnScreen, ph.bar);
  T('A2  the sentence is a sentence — most of the bar\'s width, at most two lines (not a seven-line column)', pj.sentenceWide && pj.sentenceShort, { sentence: ph.sentence, bar: ph.bar, fontPx: ph.fontPx });
  T('A3  both buttons are wholly on screen, inside the bar', pj.buttonsOnScreen, ph.buttons);
  T('A4  …and side by side on ONE row (a sealed pair)', pj.buttonsOneRow, ph.buttons);
  T('A5  …under the sentence, not beside it', ph.buttons.length === 2 && ph.buttons[0].y >= ph.sentence.b - 1, { sentence: ph.sentence, buttons: ph.buttons });
  T('A6  the bottom menu is showing on the phone, and the bar sits ABOVE it', ph.navShown && pj.aboveNav, { bar: ph.bar, nav: ph.nav });
  T('A7  no page errors', ph.errs.length === 0, ph.errs);

  console.log('\n== B · a computer (1200 × 900) ==');
  const dk = await measure(browser, 1200, 900, false), dj = judge(dk);
  T('B1  one row: the sentence and both buttons share a line', dj.oneRowWithSentence && dj.buttonsOneRow, { sentence: dk.sentence, buttons: dk.buttons });
  T('B2  everything on screen, no bottom menu to clear (bottom stays 14px)', dj.barOnScreen && dj.buttonsOnScreen && !dk.navShown && Math.abs((dk.vh - dk.bar.b) - 14) <= 1, { bar: dk.bar, vh: dk.vh });
  T('B3  no page errors', dk.errs.length === 0, dk.errs);

  console.log('\n== C · the planted offender: the old one-row bar on the phone ==');
  const off = await measure(browser, 360, 780, true), oj = judge(off);
  T('OFFENDER 1: the sentence becomes a narrow column → A2 red', !(oj.sentenceWide && oj.sentenceShort), { sentence: off.sentence, bar: off.bar });
  T('OFFENDER 2: a button runs off the screen or out of the bar → A3 red', !oj.buttonsOnScreen, off.buttons);
  await browser.close();

  console.log('\n== D · the source ==');
  const cfg = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
  const fn = cfg.slice(cfg.indexOf('window._rrShowUpdateBar = function'), cfg.indexOf('window._rrCheckForUpdate = function'));
  T('D1  the menu height is READ off the real .mobile-nav, never typed (app.css owns that number)', /querySelector\('\.mobile-nav'\)/.test(fn) && /getBoundingClientRect\(\)\.height/.test(fn) && !/68/.test(fn));
  T('D2  the buttons are wrapped as one sealed pair (flex-wrap:nowrap)', /<span style="display:flex;flex-wrap:nowrap;gap:0\.6rem;flex:0 0 auto">/.test(fn));

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
