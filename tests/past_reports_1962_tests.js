#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PAST REPORTS — v0.9.1962   (real Chromium, REAL reports.js + report-export.js, real jsPDF)
//
// Brad, 2026-10-15: "on the reports, we need to keep past reports so that we
// can send those quickly". Found: every PDF export was filed in a Drive folder
// "Past reports", but the button only opened Drive — nothing in the app listed
// or sent one; CSV exports were not kept at all; and his one saved insurance
// PDF was 142 MB (each 36-point photo carried the whole camera picture), far
// past Gmail's 25 MB. Told the three-part plan: "yes".
//
//   L1  Past reports opens a list INSIDE the app, newest first, with Send /
//       Open / Download on each, and a link to the Drive folder
//   L2  a report over 25 MB says so and offers no Send; a Google Doc says it
//       goes as a PDF
//   L3  the list can be closed (✕), and a tap beside it does not close it
//   S1  Send loads the report, then "Tap to send" opens the share menu with the
//       file attached (a Google Doc exported as a PDF)
//   S2  where files cannot be shared, Send saves it to downloads instead
//   D1  Download saves the file
//   C1  a CSV export is kept in Past reports too, named by report, date and time (v0.9.1966)
//   P1  the insurance PDF's photos are shrunk: 3 items with camera-size photos
//       make a PDF well under 1 MB
//   X*  PLANTED: each undone in the code is caught
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  past_reports_1962_tests needs playwright and it is not installed.'); process.exit(1); }
let JSPDF = '';
try { JSPDF = fs.readFileSync(require.resolve('jspdf/dist/jspdf.umd.min.js'), 'utf8'); }
catch (e) { console.log('FAILED  —  past_reports_1962_tests needs the jspdf package (node_modules) for the PDF check.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 700))); cond ? pass++ : fail++; }
const RX = fs.readFileSync(path.join(APP, 'report-export.js'), 'utf8');
const RP = fs.readFileSync(path.join(APP, 'reports.js'), 'utf8');
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}
const FILES = [
  { id: 'PDF1', name: 'insurance-report-2026-10-15.pdf', mimeType: 'application/pdf', createdTime: '2026-10-15T20:00:00Z', size: '812345' },
  { id: 'DOC1', name: 'Full Collection — Oct 14, 2026', mimeType: 'application/vnd.google-apps.document', createdTime: '2026-10-14T20:00:00Z', webViewLink: 'https://docs.google.com/document/d/DOC1/edit' },
  { id: 'CSV1', name: 'contacts-2026-10-12.csv', mimeType: 'text/csv', createdTime: '2026-10-12T20:00:00Z', size: '2048' },
  { id: 'BIG1', name: 'insurance-report-2026-08-04.pdf', mimeType: 'application/pdf', createdTime: '2026-08-04T19:59:08Z', size: '142062099' },
];

// o: { rx, rp, canShare }
async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (/jspdf\.umd\.min\.js$/.test(base)) return r.fulfill({ body: JSPDF, contentType: 'application/javascript' });
    if (/googleapis\.com\/drive\/v3\/files\//.test(u)) return r.fulfill({ body: 'REPORT-BYTES', contentType: /export/.test(u) ? 'application/pdf' : 'application/octet-stream' });
    if (!u.startsWith('file://')) return r.abort();
    if (base.endsWith('/app/report-export.js') && o.rx) return r.fulfill({ body: o.rx, contentType: 'application/javascript' });
    if (base.endsWith('/app/reports.js') && o.rp) return r.fulfill({ body: o.rp, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  await pg.evaluate(([files, canShare]) => {
    window.showToast = function (m) { (window.__toasts = window.__toasts || []).push(m); };
    accessToken = 'test-token'; window.accessToken = 'test-token';
    window.__drive = []; window.__fetched = []; window.__shared = []; window.__saved = []; window.__kept = [];
    window.driveFindOrCreateFolder = async function () { return 'PASTFOLDER'; };
    window.driveRequest = async function (m, p) { window.__drive.push([m, p]); if (/in%20parents|in\+parents|%27PASTFOLDER%27/.test(p)) return { files: files }; return {}; };
    const _f = window.fetch.bind(window);
    window.fetch = function (u, opt) { if (/googleapis\.com\/drive\/v3\/files\//.test(String(u))) window.__fetched.push(String(u)); return _f(u, opt); };
    Object.defineProperty(navigator, 'canShare', { value: () => canShare, configurable: true });
    Object.defineProperty(navigator, 'share', { value: async (d) => { window.__shared.push((d.files || []).map(f => [f.name, f.type, f.size])); }, configurable: true });
    const _click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__saved.push(this.download); return; } return _click.call(this); };
    window._archiveBlob = async function (blob, name, mime) { window.__kept.push([name, mime, blob && blob.size]); };
  }, [FILES, o.canShare !== false]);
  return { pg, ctx, errs };
}
const listView = pg => pg.evaluate(() => {
  const ov = document.getElementById('rep-past-ov');
  const rows = [...document.querySelectorAll('[data-pastrep]')];
  return {
    open: !!ov, ids: rows.map(r => r.getAttribute('data-pastrep')),
    send: rows.filter(r => r.querySelector('[data-pastsend]')).map(r => r.getAttribute('data-pastrep')),
    buttons: rows.map(r => [...r.querySelectorAll('button')].map(b => b.textContent.trim()).join('/')),
    text: ov ? ov.innerText : '', drive: !!(ov && ov.querySelector('a[href*="drive.google.com/drive/folders/PASTFOLDER"]')),
  };
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let r, m;

  console.log('== the list ==');
  r = await open(browser, {});
  await r.pg.evaluate(() => _openPastReports()); await sleep(400);
  m = await listView(r.pg);
  T('L0 no script error', r.errs.length === 0, r.errs);
  T('L1 Past reports opens a list inside the app, newest first', m.open && JSON.stringify(m.ids) === '["PDF1","DOC1","CSV1","BIG1"]', m.ids);
  T('L1 each report has Send / Open / Download, and the Drive folder is a link at the foot', m.buttons[0] === 'Send/Open/Download/Delete' && m.drive, { b: m.buttons, drive: m.drive });
  T('L2 the 142 MB report says it is too big to email and offers no Send', !m.send.includes('BIG1') && /Too big to email/.test(m.text) && /135\.5 MB|142/.test(m.text), { send: m.send });
  T('L2 a Google Doc says it is sent as a PDF', /Google Doc \(sent as a PDF\)/.test(m.text), m.text.slice(0, 300));
  await r.pg.mouse.click(10, 10); await sleep(200);
  T('L3 a tap beside the list does not close it', (await listView(r.pg)).open);
  await r.pg.evaluate(() => document.querySelector('#rep-past-ov [data-close]').click()); await sleep(100);
  T('L3 the ✕ closes it', !(await listView(r.pg)).open);

  console.log('== Send / Download ==');
  await r.pg.evaluate(() => _openPastReports()); await sleep(400);
  await r.pg.evaluate(() => document.querySelector('[data-pastsend="PDF1"]').click()); await sleep(500);
  const label = await r.pg.evaluate(() => document.querySelector('[data-pastsend="PDF1"]').textContent);
  T('S1 Send loads the report first, then asks for one more tap ("Tap to send")', label === 'Tap to send' && (await r.pg.evaluate(() => window.__shared.length)) === 0, label);
  await r.pg.evaluate(() => document.querySelector('[data-pastsend="PDF1"]').click()); await sleep(300);
  m = await r.pg.evaluate(() => ({ shared: window.__shared, fetched: window.__fetched }));
  T('S1 …which opens the share menu with the PDF attached', m.shared.length === 1 && m.shared[0][0][0] === 'insurance-report-2026-10-15.pdf' && /alt=media/.test(m.fetched[0]), m);
  await r.pg.evaluate(() => document.querySelector('[data-pastsend="DOC1"]').click()); await sleep(500);
  await r.pg.evaluate(() => document.querySelector('[data-pastsend="DOC1"]').click()); await sleep(300);
  m = await r.pg.evaluate(() => ({ shared: window.__shared, fetched: window.__fetched }));
  T('S1 a Google Doc goes as a PDF (exported)', m.shared.length === 2 && m.shared[1][0][0] === 'Full Collection — Oct 14, 2026.pdf' && m.shared[1][0][1] === 'application/pdf' && m.fetched.some(u => /DOC1\/export\?mimeType=application\/pdf/.test(u)), m);
  await r.pg.evaluate(() => [...document.querySelectorAll('[data-pastrep="CSV1"] button')].find(b => /Download/.test(b.textContent)).click()); await sleep(400);
  m = await r.pg.evaluate(() => window.__saved);
  T('D1 Download saves the file', m.includes('contacts-2026-10-12.csv'), m);
  T('page errors', r.errs.length === 0, r.errs);
  await r.ctx.close();

  r = await open(browser, { canShare: false });
  await r.pg.evaluate(() => _openPastReports()); await sleep(400);
  await r.pg.evaluate(() => document.querySelector('[data-pastsend="PDF1"]').click()); await sleep(500);
  m = await r.pg.evaluate(() => ({ saved: window.__saved, shared: window.__shared }));
  T('S2 where files cannot be shared, Send saves it to downloads instead', m.saved.includes('insurance-report-2026-10-15.pdf') && m.shared.length === 0, m);
  await r.ctx.close();

  console.log('== CSV exports are kept ==');
  r = await open(browser, {});
  m = await r.pg.evaluate(() => {
    state.contactsData = [{ name: 'Bob Smith', phone: '555' }];
    const s = document.getElementById('report-type'); const o = document.createElement('option'); o.value = 'contacts'; s.appendChild(o); s.value = 'contacts';
    exportReport();
    return window.__kept;
  });
  T('C1 a Contacts CSV export is kept in Past reports', m.length === 1 && /^contacts-\d{4}-\d\d-\d\d-\d{4}\.csv$/.test(m[0][0]) && m[0][1] === 'text/csv', m);
  await r.ctx.close();

  console.log('== the insurance PDF is small enough to send ==');
  const pdfSize = async (o) => {
    const x = await open(browser, o);
    const n = await x.pg.evaluate(async () => {
      const big = (() => { const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const g = c.getContext('2d');
        for (let i = 0; i < 400; i++) { g.fillStyle = 'hsl(' + (i * 37 % 360) + ',70%,' + (30 + i % 40) + '%)'; g.fillRect((i * 97) % 3000, (i * 53) % 2000, 180, 140); }
        return c.toDataURL('image/jpeg', 0.92); })();
      window._fetchPhotoAsDataUrl = async () => big;
      window.driveGetFolderPhotos = async () => [{ id: 'P' }];
      window.findMaster = () => ({ roadName: 'Lionel Lines', itemType: 'Caboose' });
      state.personalData = {
        a: { inventoryId: 'a', owned: true, itemNum: '6517', condition: '7', userEstWorth: '40', photoItem: 'F1' },
        b: { inventoryId: 'b', owned: true, itemNum: '6556', condition: '7', userEstWorth: '325', photoItem: 'F2' },
        c: { inventoryId: 'c', owned: true, itemNum: '2343', condition: '8', userEstWorth: '600', photoItem: 'F3' },
      };
      window.jspdf.jsPDF.API.save = function () { return this; };
      await _insurancePDF();
      return window.__kept.length ? window.__kept[0][2] : -1;
    });
    await x.ctx.close();
    return n;
  };
  const small = await pdfSize({});
  T('P1 three items with camera-size photos make an insurance PDF well under 1 MB (it was 142 MB for Brad\'s collection)', small > 0 && small < 1024 * 1024, small);

  console.log('== planted offenders ==');
  const bigNoShrink = await pdfSize({ rx: planted(RX, "        if (url) url = await _repShrinkDataUrl(url, REP_PHOTO_MAX_PX);\n", "", 'no shrink') });
  T('X-P1 PLANTED: photos not shrunk → the same PDF is several times bigger (P1 would fail)', bigNoShrink > small * 4, { small, bigNoShrink });
  let x = await open(browser, { rx: planted(RX, "var REP_EMAIL_MAX_BYTES = 25 * 1024 * 1024;", "var REP_EMAIL_MAX_BYTES = Infinity;", 'no size limit') });
  await x.pg.evaluate(() => _openPastReports()); await sleep(400); m = await listView(x.pg);
  T('X-L2 PLANTED: no 25 MB check → the 142 MB report offers Send (caught)', m.send.includes('BIG1'), m.send);
  await x.ctx.close();
  x = await open(browser, { rp: planted(RP, "a.click(); _repKeepCsv(blob, _cn);", "a.click();", 'csv not kept') });
  m = await x.pg.evaluate(() => { state.contactsData = [{ name: 'Bob' }]; const s = document.getElementById('report-type'); const o = document.createElement('option'); o.value = 'contacts'; s.appendChild(o); s.value = 'contacts'; exportReport(); return window.__kept.length; });
  T('X-C1 PLANTED: the CSV not kept → caught', m === 0, m);
  await x.ctx.close();

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
