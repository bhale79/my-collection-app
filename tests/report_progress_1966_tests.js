#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// REPORTS: DELETE, "GENERATING" POP-UP, ONE AT A TIME, TIMED NAMES — v0.9.1966
// (real Chromium, REAL report-export.js + report-library.js + reports.js, real jsPDF)
//
// Brad, 2026-10-16: "1) no way to delete past reports from here, i know you can
// go and open the drive. 2) when you export to: pdf or what ever, there needs
// to be a pop up that says, generating report with a progress indicator".
// His screenshot also showed TWO identical insurance-report-2026-10-16.pdf, both
// 8:32 AM — a second press while the first was still building. Told the
// four-part plan: "yes".
//
//   D1  Delete asks first, then puts the report in the Drive trash and takes
//       the row off the list
//   D2  "Keep it" changes nothing
//   D3  the last one deleted → "No past reports left."
//   D4  a delete Drive refuses keeps the row and says so
//   G1  the insurance PDF opens "Generating your report", counts the photos
//       ("Loading photos — 2 of 3"), the bar grows, then "Building the PDF…"
//   G2  it ends with "Done" and "kept in Past reports", the bar full, and
//       closes itself
//   G3  ✕ hides it while the report keeps going; a tap beside it does not
//   G4  the CSV and the Google Doc show it too
//   N1  a second press while a PDF is being made is refused — ONE copy kept
//   N2  the export menu (CSV) is refused while a PDF is being made
//   T1  the saved PDF's name carries the local date AND time
//   T2  the CSV download and its kept copy have the same timed name
//   T3  the Google Doc's title carries the time, and its real report name
//   X*  PLANTED: each undone in the code is caught
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  report_progress_1966_tests needs playwright and it is not installed.'); process.exit(1); }
let JSPDF = '';
try { JSPDF = fs.readFileSync(require.resolve('jspdf/dist/jspdf.umd.min.js'), 'utf8'); }
catch (e) { console.log('FAILED  —  report_progress_1966_tests needs the jspdf package (node_modules).'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 700))); cond ? pass++ : fail++; }
const RX = fs.readFileSync(path.join(APP, 'report-export.js'), 'utf8');
const RL = fs.readFileSync(path.join(APP, 'report-library.js'), 'utf8');
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}
const FILES = [
  { id: 'PDF1', name: 'insurance-report-2026-10-16-0832.pdf', mimeType: 'application/pdf', createdTime: '2026-10-16T13:32:00Z', size: '812345' },
  { id: 'CSV1', name: 'contacts-2026-10-12-1015.csv', mimeType: 'text/csv', createdTime: '2026-10-12T20:00:00Z', size: '2048' },
];

// o: { rx, rl, confirm (true/false), trashFails }
async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (/jspdf\.umd\.min\.js$/.test(base)) return r.fulfill({ body: JSPDF, contentType: 'application/javascript' });
    if (/googleapis\.com\/upload\/drive\/v3\/files/.test(u)) return r.fulfill({ body: JSON.stringify({ id: 'NEWDOC', webViewLink: 'https://docs.google.com/document/d/NEWDOC/edit' }), contentType: 'application/json' });
    if (!u.startsWith('file://')) return r.abort();
    if (base.endsWith('/app/report-export.js') && o.rx) return r.fulfill({ body: o.rx, contentType: 'application/javascript' });
    if (base.endsWith('/app/report-library.js') && o.rl) return r.fulfill({ body: o.rl, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  await pg.evaluate(([files, o]) => {
    window.showToast = function (m) { (window.__toasts = window.__toasts || []).push(m); };
    window.appConfirm = async function (msg, opt) { (window.__asked = window.__asked || []).push([msg, opt]); return o.confirm !== false; };
    accessToken = 'test-token'; window.accessToken = 'test-token';
    window.__drive = []; window.__saved = []; window.__kept = []; window.__docs = []; window.__opened = [];
    window.driveFindOrCreateFolder = async function () { return 'PASTFOLDER'; };
    window.driveRequest = async function (m, p, body) {
      window.__drive.push([m, p, body]);
      if (m === 'PATCH' && o.trashFails) throw new Error('403 forbidden');
      if (/in%20parents|in\+parents|%27PASTFOLDER%27/.test(p)) return { files: files };
      return {};
    };
    const _f = window.fetch.bind(window);
    window.fetch = function (u, opt) { if (/upload\/drive\/v3\/files/.test(String(u))) window.__docs.push(String(opt && opt.body || '')); return _f(u, opt); };
    window.open = function (u) { window.__opened.push(u); return null; };
    const _click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__saved.push(this.download); return; } return _click.call(this); };
    window._archiveBlob = async function (blob, name, mime) { window.__kept.push([name, mime, blob && blob.size]); };
    // three items whose photos arrive one after another, so the count can be watched
    const small = (() => { const c = document.createElement('canvas'); c.width = 60; c.height = 40; const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 60, 40); return c.toDataURL('image/jpeg', 0.8); })();
    const delay = { F1: 400, F2: 800, F3: 1200 };
    window.driveGetFolderPhotos = async (folder) => [{ id: folder }];
    window._fetchPhotoAsDataUrl = (id) => new Promise(res => setTimeout(() => res(small), delay[id] || 300));
    window.findMaster = () => ({ roadName: 'Lionel Lines', itemType: 'Caboose' });
    state.personalData = {
      a: { inventoryId: 'a', owned: true, itemNum: '6517', condition: '7', userEstWorth: '40', photoItem: 'F1' },
      b: { inventoryId: 'b', owned: true, itemNum: '6556', condition: '7', userEstWorth: '325', photoItem: 'F2' },
      c: { inventoryId: 'c', owned: true, itemNum: '2343', condition: '8', userEstWorth: '600', photoItem: 'F3' },
    };
    state.contactsData = [{ name: 'Bob Smith', phone: '555' }];
    if (window.jspdf) window.jspdf.jsPDF.API.save = function (n) { window.__saved.push(n); return this; };
    // watch the pop-up: every label / title / bar change, in order
    window.__seen = [];
    new MutationObserver(() => {
      const ov = document.getElementById('rep-gen-ov');
      if (!ov) return;
      const t = (document.getElementById('rep-gen-title') || {}).textContent, l = (document.getElementById('rep-gen-label') || {}).textContent,
        w = parseFloat((document.getElementById('rep-gen-bar') || { style: {} }).style.width) || 0;
      const last = window.__seen[window.__seen.length - 1];
      if (!last || last.t !== t || last.l !== l || last.w !== w) window.__seen.push({ t, l, w });
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style'] });
  }, [FILES, o]);
  return { pg, ctx, errs };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const setType = (pg, v) => pg.evaluate(v => { const s = document.getElementById('report-type'); if (![...s.options].some(x => x.value === v)) { const op = document.createElement('option'); op.value = v; s.appendChild(op); } s.value = v; }, v);
const popUp = pg => pg.evaluate(() => { const ov = document.getElementById('rep-gen-ov'); return ov ? { shown: ov.style.display !== 'none', title: document.getElementById('rep-gen-title').textContent } : null; });
async function ensureJspdf(pg) { await pg.evaluate(async () => { if (typeof _ensureJsPDF === 'function') await _ensureJsPDF(); else if (typeof _loadJsPDF === 'function') await _loadJsPDF(); window.jspdf.jsPDF.API.save = function (n) { window.__saved.push(n); return this; }; }).catch(() => {}); }

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let r, m;

  console.log('== Delete ==');
  r = await open(browser, {});
  await r.pg.evaluate(() => _openPastReports()); await sleep(400);
  await r.pg.evaluate(() => document.querySelector('[data-pastdel="CSV1"]').click()); await sleep(300);
  m = await r.pg.evaluate(() => ({ asked: window.__asked, patch: window.__drive.filter(d => d[0] === 'PATCH'), rows: [...document.querySelectorAll('[data-pastrep]')].map(x => x.getAttribute('data-pastrep')) }));
  T('D1 Delete asks first, naming the report and the 30-day trash', m.asked && m.asked.length === 1 && /contacts-2026-10-12-1015\.csv/.test(m.asked[0][0]) && /trash/.test(m.asked[0][0]) && /30 days/.test(m.asked[0][0]) && m.asked[0][1].danger === true, m.asked);
  T('D1 …then puts it in the Drive trash (not a permanent delete)', m.patch.length === 1 && m.patch[0][1] === '/files/CSV1' && m.patch[0][2] && m.patch[0][2].trashed === true, m.patch);
  T('D1 …and takes the row off the list, leaving the others', JSON.stringify(m.rows) === '["PDF1"]', m.rows);
  await r.pg.evaluate(() => document.querySelector('[data-pastdel="PDF1"]').click()); await sleep(300);
  m = await r.pg.evaluate(() => document.getElementById('rep-past-list').innerText);
  T('D3 the last one deleted → "No past reports left."', /No past reports left/.test(m), m);
  T('page errors (delete)', r.errs.length === 0, r.errs);
  await r.ctx.close();

  r = await open(browser, { confirm: false });
  await r.pg.evaluate(() => _openPastReports()); await sleep(400);
  await r.pg.evaluate(() => document.querySelector('[data-pastdel="PDF1"]').click()); await sleep(300);
  m = await r.pg.evaluate(() => ({ patch: window.__drive.filter(d => d[0] === 'PATCH').length, rows: document.querySelectorAll('[data-pastrep]').length }));
  T('D2 "Keep it" changes nothing', m.patch === 0 && m.rows === 2, m);
  await r.ctx.close();

  r = await open(browser, { trashFails: true });
  await r.pg.evaluate(() => _openPastReports()); await sleep(400);
  await r.pg.evaluate(() => document.querySelector('[data-pastdel="PDF1"]').click()); await sleep(300);
  m = await r.pg.evaluate(() => ({ rows: document.querySelectorAll('[data-pastrep]').length, toasts: window.__toasts || [] }));
  T('D4 a delete Drive refuses keeps the row and says so', m.rows === 2 && m.toasts.some(t => /Could not delete/.test(t)), m);
  await r.ctx.close();

  console.log('== the "Generating your report" pop-up ==');
  r = await open(browser, {});
  await ensureJspdf(r.pg);
  await setType(r.pg, 'insurance');
  await r.pg.evaluate(() => { window.__run = exportReportPDF(); });
  await sleep(150);
  const early = await popUp(r.pg);
  T('G1 pressing Export opens "Generating your report" at once', early && early.shown && early.title === 'Generating your report', early);
  // N1: a second press while it works
  await r.pg.evaluate(() => { window.__run2 = exportReportPDF(); });
  await r.pg.evaluate(async () => { await window.__run; await window.__run2; });
  m = await r.pg.evaluate(() => ({ seen: window.__seen, kept: window.__kept, saved: window.__saved, toasts: window.__toasts || [] }));
  const labels = m.seen.map(s => s.l);
  T('G1 it counts the photos ("Loading photos — 1 of 3", "2 of 3", "3 of 3")', ['1', '2', '3'].every(n => labels.includes('Loading photos — ' + n + ' of 3')), labels);
  const loadW = m.seen.filter(s => /^Loading photos —/.test(s.l)).map(s => s.w);
  T('G1 the bar grows as the photos come in', loadW.length >= 3 && loadW.every((w, i) => i === 0 || w >= loadW[i - 1]) && loadW[loadW.length - 1] > loadW[0], loadW);
  T('G1 then it says "Building the PDF…"', labels.includes('Building the PDF…'), labels);
  const last = m.seen[m.seen.length - 1] || {};
  T('G2 it ends with "Done", "kept in Past reports" and the bar full', last.t === 'Done' && /kept in Past reports/.test(last.l) && last.w === 100, last);
  T('N1 a second press while it was being made is refused — ONE copy kept, ONE download', m.kept.length === 1 && m.saved.length === 1 && m.toasts.some(t => /Still making the last report/.test(t)), { kept: m.kept, saved: m.saved, toasts: m.toasts });
  const nm = await r.pg.evaluate(() => { const d = new Date(), p = n => (n < 10 ? '0' : '') + n; return { want: 'insurance-report-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-', got: window.__kept[0] && window.__kept[0][0], dl: window.__saved[0] }; });
  T('T1 the saved PDF\'s name carries the local date AND time (insurance-report-YYYY-MM-DD-HHMM.pdf)', nm.got && nm.got.indexOf(nm.want) === 0 && /-\d{4}-\d\d-\d\d-\d{4}\.pdf$/.test(nm.got) && nm.dl === nm.got, nm);
  await sleep(2800);
  T('G2 …and closes itself', (await popUp(r.pg)) === null, await popUp(r.pg));
  T('page errors (PDF)', r.errs.length === 0, r.errs);
  await r.ctx.close();

  r = await open(browser, {});
  await ensureJspdf(r.pg);
  await setType(r.pg, 'insurance');
  await r.pg.evaluate(() => { window.__run = exportReportPDF(); }); await sleep(150);
  await r.pg.mouse.click(10, 10); await sleep(150);
  T('G3 a tap beside the pop-up does not close it', (await popUp(r.pg) || {}).shown === true, await popUp(r.pg));
  await r.pg.evaluate(() => document.querySelector('#rep-gen-ov [data-close]').click()); await sleep(100);
  T('G3 ✕ hides it…', (await popUp(r.pg) || { shown: false }).shown === false, await popUp(r.pg));
  // N2: the export menu's CSV while the PDF works
  await r.pg.evaluate(() => _repExport('contacts', 'csv')); await sleep(100);
  m = await r.pg.evaluate(() => ({ csv: window.__kept.filter(k => /\.csv$/.test(k[0])).length, type: document.getElementById('report-type').value, shown: document.getElementById('rep-gen-ov').style.display }));
  T('N2 the export menu is refused while a PDF is being made (no CSV, report type unchanged, pop-up shown again)', m.csv === 0 && m.type === 'insurance' && m.shown === 'flex', m);
  await r.pg.evaluate(() => window.__run);
  m = await r.pg.evaluate(() => window.__kept.filter(k => /\.pdf$/.test(k[0])).length);
  T('G3 …and the report keeps going to the end', m === 1, m);
  await r.ctx.close();

  console.log('== CSV and Google Doc ==');
  r = await open(browser, {});
  await r.pg.evaluate(() => _repExport('contacts', 'csv')); await sleep(200);
  m = await r.pg.evaluate(() => ({ seen: window.__seen, kept: window.__kept, saved: window.__saved }));
  T('G4 the CSV shows the pop-up ("Building the CSV…" → "Done")', m.seen.some(s => s.l === 'Building the CSV…') && m.seen.some(s => s.t === 'Done' && /CSV downloaded/.test(s.l)), m.seen);
  T('T2 the CSV download and its kept copy have the same name, with date and time', m.kept.length === 1 && /^contacts-\d{4}-\d\d-\d\d-\d{4}\.csv$/.test(m.kept[0][0]) && m.saved.includes(m.kept[0][0]), m);
  await r.pg.evaluate(async () => { window.__seen = []; await exportReportGoogleDoc(); });
  m = await r.pg.evaluate(() => ({ seen: window.__seen, docs: window.__docs, opened: window.__opened }));
  const meta = (() => { try { return JSON.parse((m.docs[0] || '').split('\r\n\r\n')[1].split('\r\n')[0]); } catch (e) { return null; } })();
  T('G4 the Google Doc shows the pop-up ("Creating the Google Doc…" → "Done")', m.seen.some(s => s.l === 'Creating the Google Doc…') && m.seen.some(s => s.t === 'Done'), m.seen);
  T('T3 the Google Doc\'s title has its real report name and the time (e.g. "— Oct 16, 2026 8:32 AM")', meta && /^Contacts/i.test(meta.name) && /\d{1,2}:\d\d\s?[AP]M$/.test(meta.name), meta);
  T('page errors (CSV/Doc)', r.errs.length === 0, r.errs);
  await r.ctx.close();

  console.log('== planted offenders ==');
  let x = await open(browser, { rx: planted(RX, "  await driveRequest('PATCH', '/files/' + f.id, { trashed: true });", "", 'no trash') });
  await x.pg.evaluate(() => _openPastReports()); await sleep(400);
  await x.pg.evaluate(() => document.querySelector('[data-pastdel="PDF1"]').click()); await sleep(300);
  m = await x.pg.evaluate(() => window.__drive.filter(d => d[0] === 'PATCH').length);
  T('X-D1 PLANTED: the Drive trash call removed → caught', m === 0, m);
  await x.ctx.close();

  x = await open(browser, { rx: planted(RX, "  if (!(await appConfirm(", "  if (false && !(await appConfirm(", 'no confirm') });
  await x.pg.evaluate(() => _openPastReports()); await sleep(400);
  await x.pg.evaluate(() => document.querySelector('[data-pastdel="PDF1"]').click()); await sleep(300);
  m = await x.pg.evaluate(() => (window.__asked || []).length);
  T('X-D1 PLANTED: no question first → caught', m === 0, m);
  await x.ctx.close();

  x = await open(browser, { rx: planted(RX, "    var ov = _repProgOv();\n", "    var ov = null;\n", 'no pop-up') });
  await ensureJspdf(x.pg); await setType(x.pg, 'insurance');
  await x.pg.evaluate(() => { window.__run = exportReportPDF(); }); await sleep(150);
  m = await popUp(x.pg);
  T('X-G1 PLANTED: busy without the pop-up → caught', m === null, m);
  await x.pg.evaluate(() => window.__run); await x.ctx.close();

  x = await open(browser, { rx: planted(RX, "  if (_repStillWorking()) return;   // v0.9.1966\n  var type = (document.getElementById('report-type') || {}).value || 'insurance';\n  if (!(window.jspdf", "  var type = (document.getElementById('report-type') || {}).value || 'insurance';\n  if (!(window.jspdf", 'no guard') });
  await ensureJspdf(x.pg); await setType(x.pg, 'insurance');
  m = await x.pg.evaluate(async () => { const a = exportReportPDF(); const b = exportReportPDF(); await a; await b; return window.__kept.length; });
  T('X-N1 PLANTED: no one-at-a-time check on Export PDF → two copies (caught)', m === 2, m);
  await x.ctx.close();

  x = await open(browser, { rl: planted(RL, "  if (typeof _repStillWorking === 'function' && _repStillWorking()) return;\n  document.querySelectorAll", "  document.querySelectorAll", 'no menu guard') });
  await ensureJspdf(x.pg); await setType(x.pg, 'insurance');
  await x.pg.evaluate(() => { window.__run = exportReportPDF(); }); await sleep(150);
  await x.pg.evaluate(() => _repExport('contacts', 'csv')); await sleep(100);
  m = await x.pg.evaluate(() => document.getElementById('report-type').value);
  T('X-N2 PLANTED: no check on the export menu → it changes the report under the PDF (caught)', m !== 'insurance', m);
  await x.pg.evaluate(() => window.__run).catch(() => {}); await x.ctx.close();

  x = await open(browser, { rx: planted(RX, "+ '-' + p(d.getHours()) + p(d.getMinutes()) + (ext || '')", "+ (ext || '')", 'no time') });
  await x.pg.evaluate(() => _repExport('contacts', 'csv')); await sleep(300);
  m = await x.pg.evaluate(() => window.__kept.map(k => k[0]));
  T('X-T1 PLANTED: the time left out of names → caught', m.length === 1 && !/-\d{4}-\d\d-\d\d-\d{4}\.csv$/.test(m[0]), m);
  await x.ctx.close();

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
