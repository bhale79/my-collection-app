#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// NO FAINT TEXT ANYWHERE — v0.9.1990
//
// Brad, 2026-10-19, Preferences → How to Undo a Mistake: "why is the tip text
// in this horrible yellow that you can't see. this should be in the orange.
// make sure we don't have any yellow text on a cream background" → "go ahead".
//
// The Tip box asked for a colour the app never defined (--surface-alt) with a
// near-white fallback, under the pop-up's cream text: cream on white, 1.1:1.
// The View Backups rows had the same mistake. Both fixed; and so it cannot
// happen quietly again, this sweep opens every page and the main pop-ups in
// both themes the app ships and measures every piece of visible text against
// the colour actually behind it (colours read by the browser itself, so
// color-mix and any other notation are measured as drawn).
//
//   C0  the maths is right (black on white = 21:1)
//   C1  every page, both themes: no text under 3:1 (WCAG's floor for large text)
//   C2  every page, both themes: no yellow/gold text on a light background
//       under 4.5:1 — Brad's exact complaint
//   C3  the pop-ups: How to Undo a Mistake, View Backups, Recently Removed,
//       Help Center — same two rules
//   C4  the Tip box: orange words on the card colour, readable
//   U1  no colour name is used that no theme defines (the root cause)
//   X*  PLANTED: the old Tip box, and an undefined colour, are caught
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  text_contrast_sweep_1990_tests needs playwright and it is not installed.'); process.exit(1); }
const { SEED } = require('./lib/guide-fixture');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 1200))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}

// ── U · every var(--name) the app uses is defined by some theme ─────────────
function undefinedColours(files) {
  const defined = new Set(), bad = [];
  Object.keys(files).forEach(f => {
    const s = files[f];
    for (const m of s.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) defined.add(m[1]);
    for (const m of s.matchAll(/setProperty\(\s*['"](--[a-zA-Z0-9-]+)/g)) defined.add(m[1]);
  });
  Object.keys(files).forEach(f => {
    for (const m of files[f].matchAll(/var\((--[a-zA-Z0-9-]+)/g)) {
      if (!defined.has(m[1]) && m[1] !== '--x' && !/-$/.test(m[1])) bad.push(f + ': ' + m[1]);   // --x and var(--p-*): examples written in comments
    }
  });
  return bad;
}
const FILES = {};
fs.readdirSync(APP).filter(f => /\.(js|css|html)$/.test(f)).forEach(f => { FILES[f] = fs.readFileSync(path.join(APP, f), 'utf8'); });

// ── the measurer, run in the page ───────────────────────────────────────────
const MEASURE = `window.__rrMeasure = function (rootSel) {
  // the browser itself turns any colour notation into pixels
  var cv = document.createElement('canvas'); cv.width = cv.height = 1;
  var cx = cv.getContext('2d', { willReadFrequently: true });
  var px = function (css) {
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = 'rgba(0,0,0,0)'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1);
    var d = cx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  var over = function (f, b) { var a = f.a; return { r: f.r * a + b.r * (1 - a), g: f.g * a + b.g * (1 - a), b: f.b * a + b.b * (1 - a), a: 1 }; };
  var lum = function (c) { var v = [c.r, c.g, c.b].map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  var ratio = function (a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  var hue = function (c) { var r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return { h: 0, s: 0 };
    var h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return { h: h, s: mx ? d / mx : 0 }; };
  var bgOf = function (el) {   // composite every see-through layer down to the first solid one
    var layers = [], n = el;
    while (n) {
      var cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && n !== document.documentElement && n !== document.body) return null;   // a picture or gradient: not measurable
      var c = px(cs.backgroundColor);
      if (c.a > 0) { layers.push(c); if (c.a >= 0.95) break; }
      if (n === document.documentElement) break;
      n = n.parentElement;
    }
    var base = { r: 255, g: 255, b: 255, a: 1 };
    for (var i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };
  var root = document.querySelector(rootSel); if (!root) return { missing: rootSel };
  var out = { n: 0, low: [], yellow: [] }, seen = new Set();
  var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), t;
  while ((t = w.nextNode())) {
    var s = t.nodeValue.replace(/\\s+/g, ' ').trim(); if (s.length < 2 || !/[A-Za-z0-9]/.test(s)) continue;
    var el = t.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    if (/^(SCRIPT|STYLE|OPTION|NOSCRIPT|TITLE|TEXTAREA)$/.test(el.tagName)) continue;
    if (el.closest('[disabled],[aria-hidden="true"]')) continue;
    var r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    var cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue;
    var op = 1, hid = false, n2 = el;
    while (n2 && n2 !== document.documentElement) { var c2 = getComputedStyle(n2); op *= parseFloat(c2.opacity); if (c2.display === 'none') hid = true; n2 = n2.parentElement; }
    if (hid || op < 0.05) continue;
    var bg = bgOf(el); if (!bg) continue;
    var fg = px(cs.color); fg.a *= op;
    var seenFg = over(fg, bg), rt = ratio(seenFg, bg);
    out.n++;
    var where = (el.closest('[id]') || {}).id || '';
    var rec = { text: s.slice(0, 60), ratio: Math.round(rt * 100) / 100, color: cs.color, bg: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(',') + ')', in: where };
    if (rt < 3) out.low.push(rec);
    var hs = hue(seenFg);
    if (lum(bg) > 0.6 && hs.h >= 38 && hs.h <= 70 && hs.s > 0.35 && rt < 4.5) out.yellow.push(rec);
  }
  return out;
};`;

const PAGES = ['dashboard', 'collection', 'upgrade', 'forsale', 'parts', 'browse', 'tools', 'reports', 'sold', 'sets', 'contacts', 'prefs'];
const THEMES = ['dark', 'light'];

async function boot(browser, srcOverride) {
  const pg = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 140)));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const f = srcOverride && Object.keys(srcOverride).find(k => u.split('?')[0].endsWith('/app/' + k));
    if (f) return r.fulfill({ body: srcOverride[f], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'));
  await pg.waitForTimeout(2200);
  await pg.evaluate(SEED);
  await pg.evaluate(MEASURE);
  await pg.evaluate(() => {
    for (let i = 0; i < 6; i++) { const c = document.querySelectorAll('[id^="rr-"][id$="-card"]'); if (!c.length) break; c.forEach(x => x.remove()); }
    // the backup lists ask Google Drive; the test hands them two files
    window.backupList = async () => [{ id: 'b1', name: 'Rail Roster Backup - 2026-10-18 09:00 - manual', createdTime: new Date(Date.now() - 864e5).toISOString(), size: '45111' },
                                    { id: 'b2', name: 'Rail Roster Backup - 2026-10-10 18:04 - auto', createdTime: new Date(Date.now() - 9 * 864e5).toISOString(), size: '42594' }];
  });
  return { pg, errs };
}
const theme = (pg, t) => pg.evaluate(async t => { try { localStorage.setItem('lv_theme', t); } catch (e) {} applyTheme(t); await new Promise(z => setTimeout(z, 400)); return document.documentElement.getAttribute('data-theme') || t; }, t);
const page = (pg, p) => pg.evaluate(async p => {
  showPage(p); await new Promise(z => setTimeout(z, 700));
  if (p === 'prefs') { document.querySelectorAll('#page-prefs .pref-section-body').forEach(b => { b.style.display = ''; }); await new Promise(z => setTimeout(z, 300)); }
  return window.__rrMeasure('#page-' + p);
}, p);
const POPUPS = {
  'How to Undo a Mistake': async () => { _uiShowVersionHistoryHelp(); await new Promise(z => setTimeout(z, 300)); return '#vh-help-modal'; },
  'View Backups': async () => { await uiBackupList(); await new Promise(z => setTimeout(z, 500)); return '#backup-list-body'; },
  'Recently Removed': async () => {
    window.rrTrashList = async () => [{ itemNum: '3376', cells: ['3376', 'Lionel', 'Stock Car', 'Operating Bronx Zoo Car'], tab: 'My Collection', when: new Date(Date.now() - 2 * 864e5).toISOString(), why: 'removed from the item page', invId: '448', archiveRow: 5 },
                                      { itemNum: '6464-275', cells: ['6464-275', 'Lionel', 'Boxcar'], tab: 'My Collection', when: new Date().toISOString(), restored: true, archiveRow: 6 }];
    await uiTrashList(); await new Promise(z => setTimeout(z, 400)); return '#trash-list-modal';
  },
  'Help Center': async () => { openHelpHub(); await new Promise(z => setTimeout(z, 500)); return '#help-hub-modal'; },
  'Add an item, step 1': async () => { await openWizard('collection'); await new Promise(z => setTimeout(z, 700)); return '#wizard-modal'; },
  'An item\'s page': async () => { showItemDetailPage(state.masterData.findIndex(m => m.itemNum === '3376')); await new Promise(z => setTimeout(z, 600)); return '#page-itemdetail'; },
  'Photo Inbox': async () => { _pinGo(); await new Promise(z => setTimeout(z, 900)); return '#page-photo-inbox'; },
};
async function popup(pg, name) {
  return pg.evaluate(async ([name, fnSrc]) => {
    const fn = new Function('return (' + fnSrc + ')')();
    let sel; try { sel = await fn(); } catch (e) { return { err: e.message }; }
    const m = window.__rrMeasure(sel);
    // close whatever opened
    document.querySelectorAll('#vh-help-modal,#backup-list-modal,#trash-list-modal,#help-hub-modal,[id$="-modal"]').forEach(x => { if (x.id !== 'wizard-modal') x.remove(); });
    try { if (typeof closeWizard === 'function') closeWizard(); } catch (e) {}
    return m;
  }, [name, POPUPS[name].toString()]);
}

(async () => {
  T('U1 every colour name the app uses is defined by a theme (an undefined one falls back to whatever is typed beside it)', undefinedColours(FILES).length === 0, undefinedColours(FILES));

  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let { pg, errs } = await boot(browser);
  const sanity = await pg.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'background:#fff;color:#000;position:fixed;top:0;left:0'; d.id = 'rr-sanity'; d.textContent = 'Black on white'; document.body.appendChild(d); const m = window.__rrMeasure('#rr-sanity'); d.remove(); return m; });
  T('C0 the measurer reads black on white as 21:1 (nothing faint)', sanity.n === 1 && sanity.low.length === 0, sanity);

  for (const th of THEMES) {
    await theme(pg, th);
    for (const p of PAGES) {
      const r = await page(pg, p);
      T('C1 ' + th + ' · ' + p + ': no text under 3:1 (' + r.n + ' pieces of text measured)', r.n > 0 && r.low.length === 0, r.low.length ? r.low.slice(0, 6) : r);
      T('C2 ' + th + ' · ' + p + ': no yellow or gold text on a light background', r.yellow.length === 0, r.yellow.slice(0, 6));
    }
    for (const name of Object.keys(POPUPS)) {
      await pg.evaluate(() => showPage('prefs'));
      const r = await popup(pg, name);
      T('C3 ' + th + ' · ' + name + ': no text under 3:1, no yellow on light (' + (r.n || 0) + ' measured)', r && r.n > 0 && r.low.length === 0 && r.yellow.length === 0, r);
    }
  }
  const tip = await pg.evaluate(async () => {
    _uiShowVersionHistoryHelp(); await new Promise(z => setTimeout(z, 300));
    const t = [...document.querySelectorAll('#vh-help-modal strong')].find(s => s.textContent.trim() === 'Tip');
    const box = t && t.parentElement, accent = getComputedStyle(box).getPropertyValue('--t-accent').trim();   // the accent as WORDS (each theme's readable orange)
    const cv = document.createElement('canvas').getContext('2d'); const norm = c => { cv.fillStyle = c; return cv.fillStyle; };
    const out = { tipColor: t && norm(getComputedStyle(t).color), boxColor: box && norm(getComputedStyle(box).color), accent: norm(accent) };
    document.getElementById('vh-help-modal').remove(); return out;
  });
  T('C4 the Tip box\'s words are in the orange (the theme\'s accent-for-words colour)', tip.tipColor === tip.accent && tip.boxColor === tip.accent, tip);
  T('page errors', errs.length === 0, errs);
  await pg.close();

  console.log('== X · planted ==');
  const PREFS = FILES['prefs.js'];
  const OLD = planted(PREFS, "'<div style=\"background:var(--surface2);border-left:3px solid var(--accent);color:var(--t-accent);' +",
    "'<div style=\"background:var(--surface-alt,#f4f4f4);border-left:3px solid var(--accent,#4a7);' +", 'old tip box');
  ({ pg, errs } = await boot(browser, { 'prefs.js': OLD }));
  await theme(pg, 'dark');
  const x = await popup(pg, 'How to Undo a Mistake');
  T('X-C3 PLANTED: the old Tip box (cream on near-white) is caught', x.low.some(r => /Tip|Version history/.test(r.text)), x.low);
  await pg.close();
  const xu = undefinedColours(Object.assign({}, FILES, { 'prefs.js': OLD }));
  T('X-U1 PLANTED: the undefined colour name is caught', xu.some(v => /surface-alt/.test(v)), xu);

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
