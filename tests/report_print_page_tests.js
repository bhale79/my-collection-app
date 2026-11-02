#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// report_print_page_tests.js — 2026-11-02 (maintenance chat)
//
// Hand-test T-2026-10-31-02 FAILED (Brad, 2026-11-01): "everything is there" —
// "left menu and buttons" in the Insurance report's print preview. Measured in
// Chromium on live v0.9.2094: page 1 of the paper was the Reports LIST, the
// report was page 2 under the pop-up's title bar, and the owner line printed
// dark on navy. [stated] Brad "yes" to the fix: Print copies the report onto
// its OWN white page in a new tab and prints that — the app never reaches the
// printer.
//
//   A  no app code prints the app (window.print() on the app window) — the old
//      row-Print fallback included. PLANTED: the fallback put back → caught.
//   B  Insurance, real app, real Chromium: Print opens the print page; on it is
//      the report ONLY — heading, owner line, totals, every row, the photo,
//      the signature lines — and none of: the left menu, the top bar, any
//      button, the Reports list, the pop-up's title bar. One sheet of paper
//      for two rows. Black text (it reads with "Background graphics" off).
//      The app's own window.print() is never called.
//   C  another report (Full Collection): its name + "Printed <date>" on top,
//      its rows, no buttons.
//   D  the pop-up's own Print button goes through the same door.
//   E  a blocked pop-up says so and prints nothing; a double tap makes one page.
//   F  PLANTED: a button dropped into the report area never reaches the paper;
//      with the strip list emptied the same check FAILS (it can fail).
//
// Run:  node tests/report_print_page_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  report_print_page_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail).slice(0, 700) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
// code only: comments blanked, and string literals blanked (a page WRITTEN into
// another window may print itself — gmail-help.js does)
function codeOnly(src) {
  let out = '', i = 0, q = null;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (q) { if (c === '\\') { out += '  '; i += 2; continue; } if (c === q) { q = null; out += c; i++; continue; } out += c === '\n' ? '\n' : ' '; i++; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? src.length : e + 2; out += src.slice(i, end).replace(/[^\n]/g, ' '); i = end; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; out += c; i++; continue; }
    out += c; i++;
  }
  return out;
}
const APPJS = fs.readdirSync(APP).filter(f => /\.js$/.test(f) && f !== 'sw.js');
function printsTheApp(files) {
  const out = [];
  Object.keys(files).forEach(f => codeOnly(files[f]).split('\n').forEach((l, i) => {
    // window.print() / self.print() / a bare print() — the APP window. A print
    // page's own print (t.tab.print()) is another window and is fine.
    if (/\b(window|self|top)\s*\.\s*print\s*\(/.test(l) || /(^|[^.\w$])print\s*\(\s*\)/.test(l)) out.push(f + ':' + (i + 1));
  }));
  return out;
}

section('A · nothing prints the app itself');
const FILES = {}; APPJS.forEach(f => { FILES[f] = rd(f); });
const offs = printsTheApp(FILES);
ok('A1 no app file calls window.print() on the app (' + APPJS.length + ' files)', offs.length === 0, offs);
const LIB = FILES['report-library.js'];
const planted = Object.assign({}, FILES, { 'report-library.js': LIB.replace("if (typeof printReportWithPhotos === 'function') printReportWithPhotos();", "if (typeof printReportWithPhotos === 'function') printReportWithPhotos(); else window.print();") });
ok('A2 PLANTED: the old row-Print fallback put back → caught by A1', planted['report-library.js'] !== LIB && printsTheApp(planted).length === 1, printsTheApp(planted));
const html = rd('index.html');
ok('A3 the pop-up\'s Print button goes to the one door', /id="rep-print-btn"[^>]*onclick="printReportWithPhotos\(\)"/.test(html));
ok('A4 the words and the paper look live once, in config.js (RR_REPORT_PRINT)', /const RR_REPORT_PRINT = \{/.test(rd('config.js')) && !/RR_REPORT_PRINT\s*=/.test(FILES['report-export.js']));

(async () => {
  const ex = '/opt/pw-browsers/chromium';   // the cloud's Chromium (as bench_parts_tests)
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    await ctx.route('**', r => r.request().url().startsWith('file://') || r.request().url().startsWith('data:') || r.request().url() === 'about:blank' ? r.continue() : r.abort());
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(900);
    const PIC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await pg.evaluate(pic => {
      const md = [
        { itemNum: '2338', variation: '', itemType: 'Diesel', _era: 'pw', _tab: 'Lionel PW - Items', yearProd: '1955', roadName: 'Milwaukee Road', description: 'GP-7', rowId: 'R2', gauge: 'O' },
        { itemNum: '2356', variation: '', itemType: 'Diesel', _era: 'pw', _tab: 'Lionel PW - Items', yearProd: '1951', roadName: 'Southern', description: 'F-3 A unit', rowId: 'R3', gauge: 'O' },
      ];
      state.masterData = md; _rebuildMasterIndex();
      const P = (inv, n, x) => Object.assign({ owned: true, itemNum: n, variation: '', era: 'pw', manufacturer: 'Lionel', inventoryId: inv, row: Number(inv), condition: '8', userEstWorth: '250' }, x || {});
      state.personalData = { b: P('190', '2338', { photoItem: 'folder-2338' }), c: P('140', '2356') };
      state.user = Object.assign({}, state.user || {}, { email: 'collector@example.com', name: 'Test Owner' });
      if (!document.querySelector('.sidebar')) _buildAppShell();
      try { showApp(); } catch (e) {}
      const au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
      document.getElementById('app').classList.add('active');
      try { showPage('reports'); } catch (e) {}
      try { renderReportLibrary(); } catch (e) {}
      // no Drive here: the photo folder answers with one picture
      window._repPreloadPhotos = async () => ({});
      window.driveGetFolderPhotos = async () => [{ id: 'pic-1' }];
      window.loadDriveThumb = (id, img) => { img.src = pic; return true; };
      window.__appPrinted = 0; window.print = function () { window.__appPrinted++; };
      window.__toasts = []; const st = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); try { return st.apply(this, arguments); } catch (e) {} };
    }, PIC);

    // catch the print page: its print() is counted, never run
    // no print page within 15 s = FAIL (the old code printed the app and opened none)
    const nextPopup = () => Promise.race([
      new Promise(res => { ctx.once('page', p => res(p)); }),
      new Promise((res, rej) => setTimeout(() => rej(new Error('no print page opened — Print sent the app to the printer?')), 15000)),
    ]);
    async function printAndRead(trigger) {
      const popP = nextPopup();
      await pg.evaluate(trigger);
      const pop = await popP;
      await pop.waitForFunction(() => document.body && document.body.classList.contains('rr-report-print'), null, { timeout: 15000 });
      await pop.waitForTimeout(300);
      const r = await pop.evaluate(() => {
        const cs = el => el ? getComputedStyle(el).color : null;
        return {
          text: document.body.innerText,
          title: document.title,
          rows: document.querySelectorAll('tbody tr').length,
          buttons: document.querySelectorAll('button, input, select, textarea').length,
          sidebar: !!document.querySelector('.sidebar, nav, .mobile-nav, .header'),
          onAttrs: [...document.querySelectorAll('*')].filter(e => [...e.attributes].some(a => /^on/i.test(a.name))).length,
          imgs: [...document.images].map(i => ({ ok: i.complete && i.naturalWidth > 0, src: i.getAttribute('src').slice(0, 22) })),
          metaColor: cs(document.querySelector('.ins-report-meta span')),
          tdColor: cs(document.querySelector('tbody td:nth-child(3)')),
          h1: (document.querySelector('h1.rp-title') || {}).textContent || '',
          sig: [...document.querySelectorAll('.ins-report-footer div[style*="border-bottom"]')].map(d => getComputedStyle(d).borderBottomStyle + ' ' + getComputedStyle(d).borderBottomColor),
        };
      });
      const pdf = await pop.pdf({ format: 'Letter' });
      const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
      return { pop, r, pages };
    }

    section('B · the Insurance report, row Print');
    const b = await printAndRead(() => { _repPrintRow('insurance'); });
    ok('B1 a print page opened with the report heading, the owner line and the totals',
      /Insurance Documentation/i.test(b.r.text) && /Test Owner/.test(b.r.text) && /\$500/.test(b.r.text), b.r.text.slice(0, 300));
    ok('B2 every row is on it (2), with the description', b.r.rows === 2 && /Milwaukee Road/.test(b.r.text) && /Southern/.test(b.r.text), { rows: b.r.rows });
    ok('B3 no left menu, no top bar, no nav of any kind', !b.r.sidebar && !/Dashboard|My Collection|Parts Needed|Preferences/.test(b.r.text), b.r.text.slice(0, 400));
    ok('B4 no buttons or boxes, and no on-click left on the page', b.r.buttons === 0 && b.r.onAttrs === 0 && !/Export|Close|Google Doc/.test(b.r.text), b.r);
    ok('B5 the Reports LIST is not on the paper', !/Full Collection|Command ID Report|Contacts|Not generated yet/.test(b.r.text), b.r.text.slice(0, 400));
    ok('B6 the photo made it onto the print page (loaded)', b.r.imgs.length === 1 && b.r.imgs[0].ok, b.r.imgs);
    ok('B7 the owner line and the cells are black (readable with "Background graphics" off)', b.r.metaColor === 'rgb(0, 0, 0)' && b.r.tdColor === 'rgb(0, 0, 0)', [b.r.metaColor, b.r.tdColor]);
    ok('B8 the signature and date lines print (solid black)', b.r.sig.length === 2 && b.r.sig.every(s => /^solid rgb\(0, 0, 0\)/.test(s)), b.r.sig);
    ok('B9 two rows fit one sheet — no blank or extra first page', b.pages === 1, b.pages);
    ok('B10 the print page is titled with the report and the date (what "Save as PDF" names the file)', /Insurance Report — /.test(b.r.title), b.r.title);
    ok('B11 the app\'s own window.print() was never called', (await pg.evaluate(() => window.__appPrinted)) === 0);
    await b.pop.close();

    section('C · another report (Full Collection)');
    const c = await printAndRead(() => { _repPrintRow('collection'); });
    ok('C1 its name and "Printed <date>" on top', /Full Collection/.test(c.r.h1) && /Printed \w+ \d+, \d{4}/.test(c.r.text), { h1: c.r.h1 });
    ok('C2 its rows, no buttons, no menu, no Insurance heading left over', c.r.rows === 2 && c.r.buttons === 0 && !c.r.sidebar && !/Insurance Documentation/.test(c.r.text), c.r);
    await c.pop.close();

    section('D · the pop-up\'s own Print button');
    const d = await printAndRead(() => { _repSetType('insurance'); buildReport(); document.getElementById('rep-print-btn').click(); });
    ok('D1 the same clean page', /Insurance Documentation/.test(d.r.text) && d.r.buttons === 0 && !d.r.sidebar && d.r.rows === 2, d.r);
    await d.pop.close();

    section('E · blocked pop-up, double tap');
    const e1 = await pg.evaluate(async () => {
      const realOpen = window.open; window.open = () => null; window.__toasts = [];
      await printReportWithPhotos();
      window.open = realOpen;
      return { toasts: window.__toasts.slice(), printed: window.__appPrinted };
    });
    ok('E1 a blocked pop-up says how to allow it, and the app is NOT printed instead', e1.toasts.some(t => /allow pop-ups/i.test(t)) && e1.printed === 0, e1);
    let opened = 0; const counter = () => { opened++; }; ctx.on('page', counter);
    await pg.evaluate(() => { _repSetType('collection'); buildReport(); printReportWithPhotos(); printReportWithPhotos(); });
    await pg.waitForTimeout(1500);
    ctx.off('page', counter);
    ok('E2 a double tap makes one print page', opened === 1, opened);
    for (const p of ctx.pages()) if (p !== pg) await p.close();

    section('F · planted');
    const f = await pg.evaluate(() => {
      _repSetType('insurance'); buildReport();
      const tw = _repTableWrap();
      const extra = document.createElement('div'); extra.innerHTML = '<button onclick="alert(1)">Planted Button</button><div style="display:none">Planted Hidden</div>';
      tw.appendChild(extra);
      const withStrip = _repPrintHtml();
      const keep = RR_REPORT_PRINT.strip; RR_REPORT_PRINT.strip = 'x-none';
      const noStrip = _repPrintHtml();
      RR_REPORT_PRINT.strip = keep; extra.remove();
      return { withStrip: /Planted Button/.test(withStrip), hidden: /Planted Hidden/.test(withStrip), onclick: /onclick=/i.test(withStrip), noStrip: /Planted Button/.test(noStrip), noStripOn: /onclick=/i.test(noStrip) };
    });
    ok('F1 a button dropped into the report area never reaches the paper; neither does anything hidden on screen', !f.withStrip && !f.hidden && !f.onclick, f);
    ok('F2 PLANTED: the strip list emptied → the button IS on the page (the check can fail) — and its on-click is still removed', f.noStrip && !f.noStripOn, f);
    ok('G1 no page errors', errs.length === 0, errs);
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL  crashed: ' + (e && e.stack)); process.exit(1); });
