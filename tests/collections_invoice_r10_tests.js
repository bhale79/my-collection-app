#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// INVOICES — TRR Pro release 10 (real Chromium, the REAL app, tests/lib/coll-world.js)
//
// BUILD_PLAN_2026-10-28_TRR_PRO.md Release 10; [stated] Brad 2026-10-31
// 09:39 CT "build all the releases".
//   G  source guards, each PROVED on a planted offender
//   I  from the Sold list (tapped): the Invoices tab made in the HOME sheet
//      AFTER a backup; numbered; one live invoice per sold item; a clash with
//      another device's number moves ours on; the PDF (business header, the
//      buyer, full IDs, tax, shipping, total); the email ready in the
//      person's own mail program; Mark paid / Void found by the invoice's
//      own ID, never its row; void keeps the row and its number; the
//      archive check lists unpaid invoices; never the collection's client;
//      nothing written to a collection's own sheet
//   X  a regular customer sees none of it
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  collections_invoice_r10_tests needs playwright and it is not installed.'); process.exit(1); }
const { boot, openColl, APP } = require('./lib/coll-world');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 1500))); cond ? pass++ : fail++; }
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
}

// ── G · source guards ──────────────────────────────────────────────────────
function deletesRows(src) { return /\b(sheetsDeleteRow|rrRemoveRowConfirmed|sheetsClear)\(/.test(stripComments(src)); }
function backupFirst(src) {
  const s = stripComments(src);
  const fn = (s.match(/async function _ensureTab[\s\S]*?\n  \}/) || [''])[0];
  const b = fn.indexOf('backupCreateAuto('), a = fn.indexOf('addSheet');
  return b > 0 && a > b;
}
function usesGmail(src) { return /gmail/i.test(stripComments(src)); }
function namesClient(src) { return /rrCollectionClient\s*\(|\.clientId\b/.test(stripComments(src)); }
function rawRowWrite(src) { return /sheetsUpdate\([^;\n]*\.row\b/.test(stripComments(src)); }
function guardedRowWrites(src) { return (stripComments(src).match(/rrVerifiedRowUpdate\(/g) || []).length >= 2; }
function tabRegistered(src) { return /var _TAB = \(typeof rrFeatureTab === 'function' \? rrFeatureTab : String\)/.test(src) && /addSheet: \{ properties: \{ title: _TAB \} \}/.test(src); }
function guards() {
  console.log('\n== G · source guards ==');
  const inv = read('collections-invoice.js');
  T('G1 an invoice row is never deleted or cleared (void keeps it)', !deletesRows(inv));
  T('G1b PLANTED: a row delete → caught', deletesRows(inv + "\nsheetsDeleteRow(sid, 'Invoices', 3, {});"));
  T('G2 the home sheet is backed up BEFORE the Invoices tab is added', backupFirst(inv));
  T('G2b PLANTED: the tab added before the backup → caught', !backupFirst(inv.replace("await backupCreateAuto(I().backupReason || 'before-invoices', sid);   // no backup, no new tab", '')));
  T('G3 the Invoices tab is registered where it is born (never read as items)', tabRegistered(inv));
  T('G3b PLANTED: a tab made under a typed name → caught', !tabRegistered(inv.replace('title: _TAB }', "title: 'Invoices' }")));
  T('G9 an invoice row is written only through the guarded writer (it reads the row\'s Invoice ID first)', !rawRowWrite(inv) && guardedRowWrites(inv));
  T('G9b PLANTED: a bare row write → caught', rawRowWrite(inv + "\nawait sheetsUpdate(sid, \"'Invoices'!C\" + inv.row, [['Paid']]);"));
  T('G4 no Gmail — the email opens in the person\'s own mail program (no new Google permission)', !usesGmail(inv));
  T('G4b PLANTED: a Gmail call → caught', usesGmail(inv + "\nfetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts');"));
  T('G5 PRIVACY: never the collection\'s client', !namesClient(inv));
  T('G5b PLANTED: the client read → caught', namesClient(inv + '\nvar k = c.clientId;'));
  const ix = read('index.html'), sw = read('sw.js'), cfg = read('config.js'), ar = read('collections-archive.js');
  const core = JSON.parse(fs.readFileSync(path.join(__dirname, 'lib', 'core-files.json'), 'utf8')).core;
  T('G6 collections-invoice.js is loaded, offline, CORE', ix.includes('src="./collections-invoice.js?v=') && sw.includes("'./collections-invoice.js'") && core.includes('app/collections-invoice.js'));
  const block = (cfg.match(/var RR_COLL_INVOICE = \{[\s\S]*?\n\};/) || [''])[0];
  T('G7 every word in RR_COLL_INVOICE; none says "AI"; no typed toast; make / paid / void one-tap', block.length > 0 && !/\bAI\b/.test(block) && !/toast\('[A-Z]/.test(stripComments(inv)) && ['make', 'paid', 'void'].every(k => inv.includes("rrOnce('rr-coll-inv-" + k + "'")));
  T('G8 the archive checks list holds invoices — one line in config + its checker', /checks: \['moves', 'handover', 'invoices', 'unsold'\]/.test(cfg) && /\n    invoices: async function \(c\)/.test(ar));
}

async function steady(pg) {
  await pg.evaluate(() => {
    for (let i = 0; i < 8; i++) history.pushState({ pad: i }, '', '');
    window.__rm = async (id) => { const d = document.getElementById(id); if (d) d.remove(); await new Promise(r => setTimeout(r, 250)); };
    // the PDF maker (a CDN script in the app) — a stand-in that remembers what was written and saved
    window.__pdf = [];
    window.jspdf = { jsPDF: function () {
      const doc = { t: [], name: '' };
      const o = { internal: { pageSize: { getWidth: () => 612, getHeight: () => 792 } },
        setFont() {}, setFontSize() {}, line() {}, addPage() {}, text(s) { doc.t.push(String(s)); }, save(n) { doc.name = n; window.__pdf.push(doc); } };
      return o;
    } };
  });
}
async function setup(pg) {
  await pg.evaluate(async () => {
    const SOLD = (itemNum, inv, price, date) => [itemNum, '', '1', '8', '', price, date, '', inv, 'Lionel'];
    window.__S.S7['Sold'] = [['Sold'], ['h'], SOLD('2343', '50', '450', '2026-10-20'), SOLD('6464-1', '51', '60', '2026-10-21'), SOLD('3656', '52', '35', '2026-10-22')];
    const L = JSON.parse(window.__files.LIST.content); L.items.c7.clientId = 'K1'; window.__files.LIST.content = JSON.stringify(L);
  });
  await openColl(pg, 'c7');
  await pg.evaluate(async () => {
    state.contactsData = [{ id: 'K1', name: 'Pat Hale', email: 'pat@example.test' }, { id: 'B1', name: 'Ann Buyer', email: 'ann@example.test', address: '1 Main St, Springfield' }];
    await rrCollectionsLoad();
    rrInvSettingsSave({ name: 'Hale Trains & Auctions', address: '9 Depot Rd', phone: '555-0100', email: 'shop@example.test', taxRate: 8, terms: 'Net 15' });
    if (!document.getElementById('main-content')) document.body.appendChild(Object.assign(document.createElement('div'), { id: 'main-content' }));
  });
}

async function invRun(browser) {
  console.log('\n== I · invoices ==');
  const { pg, errs } = await boot(browser);
  await steady(pg);
  await setup(pg);
  const a = await pg.evaluate(async () => {
    const until = async (fn, ms) => { for (let i = 0; i < (ms || 8000) / 100 && !fn(); i++) await new Promise(r => setTimeout(r, 100)); return !!fn(); };
    const out = {};
    rrCollUiPaint();
    out.soldBtn = !!document.getElementById('rr-inv-sold-btn');
    window.__calls = [];
    document.getElementById('rr-inv-sold-btn').click();   // TAPPED, from the Sold page
    out.opened = await until(() => /No invoices yet/.test((document.getElementById('rr-inv-list') || {}).textContent || ''));
    document.querySelector('[data-inv-new]').click();
    out.newOpen = await until(() => document.querySelectorAll('#rr-coll-inv-new [data-inv-pick]').length === 3);
    const pick = (inv) => { const k = Object.keys(state.soldData).find(k => state.soldData[k].inventoryId === inv); document.querySelector('#rr-coll-inv-new [data-inv-pick="' + k + '"]').checked = true; };
    pick('50');
    document.getElementById('rr-inv-buyer').value = 'B1';
    document.getElementById('rr-inv-ship').value = '15';
    document.querySelector('[data-inv-make]').click();
    out.made = await until(() => !!document.getElementById('rr-coll-inv-one'));
    const tab = window.__S.HOME['Invoices'] || [];
    out.head = (tab[0] || []).slice(); out.note = (tab[1] || [])[0]; out.row = (tab[2] || []).slice();   // copies — the rows change later
    const bi = window.__calls.findIndex(c => c.kind === 'backup' && c.of === 'HOME' && /before-invoices/.test(c.name));
    const ti = window.__calls.findIndex(c => c.kind === 'addTab' && c.sid === 'HOME' && c.title === 'Invoices');
    out.backupFirst = bi >= 0 && ti > bi;
    out.pdf = window.__pdf[0];
    out.oneText = document.getElementById('rr-coll-inv-one').textContent;
    out.mail = (document.querySelector('#rr-coll-inv-one [data-inv-email]') || {}).getAttribute && document.querySelector('#rr-coll-inv-one [data-inv-email]').getAttribute('href');
    await __rm('rr-coll-inv-one');
    // the same item again → refused; its tick box is off in the screen
    const k50 = Object.keys(state.soldData).find(k => state.soldData[k].inventoryId === '50');
    out.again = await rrInvCreate({ keys: [k50], buyerId: 'B1' });
    rrInvNewOpen();
    await until(() => document.querySelectorAll('#rr-coll-inv-new [data-inv-pick]').length === 3);
    out.disabled = document.querySelector('#rr-coll-inv-new [data-inv-pick="' + k50 + '"]').disabled;
    out.onInv = /already on invoice 1/.test(document.getElementById('rr-coll-inv-new').textContent);
    await __rm('rr-coll-inv-new');
    // invoice 2; then another device takes number 3 at the same moment as ours
    const k51 = Object.keys(state.soldData).find(k => state.soldData[k].inventoryId === '51');
    const k52 = Object.keys(state.soldData).find(k => state.soldData[k].inventoryId === '52');
    out.two = (await rrInvCreate({ keys: [k51], buyerId: 'B1' })).invoice.no;
    const realAppend = window.sheetsAppend; let once = true;
    window.sheetsAppend = async function (sid, range, values) {
      if (once && /Invoices/.test(range)) { once = false; const other = new Array(17).fill(''); other[0] = '3'; other[2] = 'Unpaid'; other[15] = 'invOTHER'; other[16] = '{"lines":[]}'; window.__S.HOME['Invoices'].push(other); }
      return realAppend.apply(this, arguments);
    };
    const three = await rrInvCreate({ keys: [k52], buyerId: 'B1' });
    window.sheetsAppend = realAppend;
    out.clash = three.invoice.no;
    // a row slipped in above ours (another device) — Mark paid still finds OURS by its own ID
    const one = (await rrInvList()).find(x => x.no === 1);
    const stray = new Array(17).fill(''); stray[0] = '99'; stray[2] = 'Unpaid'; stray[15] = 'invSTRAY'; stray[16] = '{"lines":[]}';
    window.__S.HOME['Invoices'].splice(2, 0, stray);
    rrInvOpen(); await until(() => document.querySelectorAll('[data-inv-row]').length >= 4);
    rrInvShow(one.id);
    document.querySelector('#rr-coll-inv-one [data-inv-paid]').click();
    await until(() => (window.__S.HOME['Invoices'].find(r => r[15] === one.id) || [])[2] === 'Paid');
    const paidRow = window.__S.HOME['Invoices'].find(r => r[15] === one.id);
    out.paid = [paidRow[2], paidRow[11]]; out.strayUntouched = window.__S.HOME['Invoices'].find(r => r[15] === 'invSTRAY')[2] === 'Unpaid';
    await __rm('rr-coll-inv-one');
    // another device puts a DIFFERENT invoice on our row between the look-up and the write → nothing written
    const four = (await rrInvList()).find(x => x.no === 4);
    // (the swap lands right AFTER the app's own look-up of the whole tab, so old code and new code see the same race)
    const realGet = window.sheetsGet; let swapped = false;
    window.sheetsGet = async function (sid, range) {
      const res = JSON.parse(JSON.stringify(await realGet.apply(this, arguments)));
      if (!swapped && /Invoices/.test(range) && !/^Invoices!A(\d+):P\1$/.test(range)) {   // not the guard's own one-row read
        const r = window.__S.HOME['Invoices'].find(x => x[15] === four.id);
        if (r) { r[15] = 'invSWAP'; swapped = true; }
      }
      return res;
    };
    out.swap = await rrInvMarkPaid(four.id);
    window.sheetsGet = realGet;
    const swapRow = window.__S.HOME['Invoices'].find(r => r[15] === 'invSWAP');
    out.swapUntouched = swapped && !!swapRow && swapRow[2] === 'Unpaid';
    if (swapRow) swapRow[15] = four.id;   // put it back for the rest of the run
    // Void: the row stays, its number is never used again, its item can go on a new invoice
    const two = (await rrInvList()).find(x => x.no === 2);
    window.__confirms = [];
    rrInvShow(two.id);
    document.querySelector('#rr-coll-inv-one [data-inv-void]').click();
    await until(() => (window.__S.HOME['Invoices'].find(r => r[15] === two.id) || [])[2] === 'Void');
    out.voidRow = window.__S.HOME['Invoices'].find(r => r[15] === two.id).slice(0, 3);
    out.voidAsked = /never deleted/.test(window.__confirms.slice(-1)[0] || '');
    await __rm('rr-coll-inv-one');
    const reinv = await rrInvCreate({ keys: [k51], buyerId: 'B1' });
    out.reinv = reinv.ok && reinv.invoice.no;
    out.rows = window.__S.HOME['Invoices'].length - 2;
    // nothing written to Hale's own sheet; never the client
    out.collWrites = window.__calls.filter(c => (c.kind === 'put' || c.kind === 'append') && c.sid !== 'HOME').length;
    out.client = JSON.stringify(window.__S.HOME['Invoices']).indexOf('Pat Hale') >= 0 || window.__pdf.some(d => d.t.join(' ').indexOf('Pat Hale') >= 0);
    // the archive check
    const chk = await rrArchiveChecks('c7');
    out.archive = (chk.open || []).map(r => r.id + ':' + r.n + ':' + r.block);
    out.archText = ((chk.open || []).find(r => r.id === 'invoices') || {}).text;
    return out;
  });
  const today = await pg.evaluate(() => rrToday());
  T('I1 the Sold page has Invoices (tapped) — none yet', a.soldBtn && a.opened, a);
  T('I2 the home sheet was backed up BEFORE the Invoices tab was added; headers + the never-delete note', a.backupFirst && a.head && a.head[0] === 'Invoice No' && a.head[15] === 'Invoice ID' && /Never delete a row/.test(a.note || ''), a);
  T('I3 invoice 1: Unpaid, Ann Buyer, 7-50 $450 + 8% tax + $15 shipping = $501', a.made && a.row[0] === '1' && a.row[1] === today && a.row[2] === 'Unpaid' && a.row[3] === 'Ann Buyer' && /^7-50 /.test(a.row[4]) && a.row[5] === '450' && a.row[7] === '36' && a.row[8] === '15' && a.row[9] === '501', a.row);
  T('I4 the PDF is saved as Invoice-1-<date>.pdf: the business header, the buyer, the full ID, the total', a.pdf && a.pdf.name === 'Invoice-1-' + today + '.pdf' && ['Hale Trains & Auctions', 'INVOICE', 'Ann Buyer', '1 Main St, Springfield', '7-50'].every(t => a.pdf.t.includes(t)) && a.pdf.t.some(t => /501/.test(t)), a.pdf);
  T('I5 the email is ready in the person\'s own mail program: to the buyer, "Invoice 1 from Hale Trains & Auctions"', /^mailto:ann%40example\.test\?subject=Invoice%201%20from%20Hale%20Trains%20%26%20Auctions&body=/.test(a.mail || ''), a.mail);
  T('I6 one live invoice per sold item: the same item again is refused, and its box is off ("already on invoice 1")', a.again.why === 'taken' && a.again.no === 1 && a.disabled && a.onInv, a);
  T('I7 numbering: 2 next; another device took 3 at the same moment → ours moved on to 4', a.two === 2 && a.clash === 4, a);
  T('I8 Mark paid (tapped) finds the invoice by its OWN ID after a row slipped in above it — the other row untouched', a.paid[0] === 'Paid' && a.paid[1] === today && a.strayUntouched, a);
  T('I8b another device put a different invoice on that row between the look-up and the write → refused, nothing written', a.swap && a.swap.ok === false && a.swap.why === 'moved' && a.swapUntouched, { swap: a.swap, untouched: a.swapUntouched });
  T('I9 Void (tapped, asked first): the row STAYS, marked Void; its number is never used again; its item goes on a new invoice (100 — the highest on the tab, the other device\'s 99, + 1)', a.voidRow[0] === '2' && a.voidRow[2] === 'Void' && a.voidAsked && a.reinv === 100 && a.rows === 6, { voidRow: a.voidRow, voidAsked: a.voidAsked, reinv: a.reinv, rows: a.rows });
  T('I10 nothing written to the collection\'s own sheet; the collection\'s client never named', a.collWrites === 0 && !a.client, a);
  T('I11 archiving lists the unpaid invoices for this collection — the person may still archive anyway', a.archive.some(x => /^invoices:\d+:false$/.test(x)) && /not marked paid/.test(a.archText || ''), a);
  T('I12 no script error', errs.length === 0, errs);
  await pg.close();

  console.log('\n== X · a regular customer ==');
  const x = await boot(browser, { off: true });
  const o = await x.pg.evaluate(() => { rrInvPaintSoldButton(); rrInvOpen(); return { btn: !!document.getElementById('rr-inv-sold-btn'), open: !!document.getElementById('rr-coll-inv') }; });
  T('X1 switched off (a regular customer): no Invoices button on the Sold page, no Invoices screen', !o.btn && !o.open, o);
  await x.pg.close();
}

(async () => {
  guards();
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try { await invRun(browser); } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log('FAILED  —  ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
