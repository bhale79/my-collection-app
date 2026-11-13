#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// INVOICES: OPTIONAL + REAL DATES — TRR Pro (real Chromium, the REAL app, tests/lib/coll-world.js)
//
// [stated] Brad 2026-11-11 11:13 CT "the invoice thing, they probably don't
// want to change their invoice system. we need to make sure that is not
// something that is a have to"; 11:15 CT "yes on the we do our own and the
// date fix". Found on Pro walk 4 (T-2026-11-03-05, live v0.9.2141): the
// invoice date and "Paid on" showed 46337 — Google hands a date back as a
// serial number and the invoice reader printed it raw (list, invoice, PDF,
// the PDF's file name).
//   G  source guards, each PROVED on a planted offender
//   A  dates: the serial shown as a date everywhere; the person's own date
//      format on screen but never in the file name; an item made into an
//      invoice is still "on invoice 1" when its sale date comes back the
//      other form (serial ↔ "2026-10-20") — both ways round
//   B  "We do our own invoices" (Preferences → Business tools, owners): every
//      way in hidden, nothing made, the archive check quiet, nothing deleted;
//      untick → all back; an account setting (synced); Staff / a manager
//      cannot see or flip it; a regular customer sees none of it
// The stand-in Sheets used by collections_invoice_r10_tests store every date as
// TEXT, which is why that suite never saw 46337 — here the cells hold numbers,
// exactly what Google returns (valueRenderOption=UNFORMATTED_VALUE).
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  invoice_optional_dates_tests needs playwright and it is not installed.'); process.exit(1); }
const { boot, openColl, APP } = require('./lib/coll-world');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 1500))); cond ? pass++ : fail++; }
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
}
function fnBody(src, name) {
  const s = stripComments(src);
  const i = s.search(new RegExp('(async )?function ' + name + '\\('));
  if (i < 0) return '';
  const j = s.indexOf('\n  }', i);
  return s.slice(i, j < 0 ? undefined : j);
}

// ── G · source guards ──────────────────────────────────────────────────────
// every way into the app's invoices asks the ONE door
function doorsAsk(inv, ui) {
  const first = (name) => { const b = fnBody(inv, name); const lines = b.split('\n').slice(1, 4).join('\n'); return /rrInvOn\(\)/.test(lines); };
  const menu = (stripComments(ui).match(/[^\n]*data-coll-inv[^\n]*/) || [''])[0];
  const sold = fnBody(inv, 'rrInvPaintSoldButton');
  return first('rrInvOpen') && first('rrInvCreate') && first('rrInvUnpaidFor') &&
    /rrInvOn\(\)/.test(sold) && !/!_on\(\)/.test(sold) &&
    /typeof rrInvOn === 'function' && rrInvOn\(\)/.test(menu);
}
// nothing greyed out in its place ("All Collections — coming in a later release" was a leftover)
function noGreyPlaceholder(ui, cfg) { return !/allSoon/.test(stripComments(ui)) && !/allSoon/.test(cfg); }
function datesReadOneWay(inv) {
  const p = fnBody(inv, '_parse');
  return /date: _showDate\(r\[_col\('Date'\)\]\)/.test(p) && /paidOn: _showDate\(r\[_col\('Paid on'\)\]\)/.test(p) && !/String\(r\[_col\('(Date|Paid on)'\)\]/.test(p);
}
function fileNameIso(inv) { return /W\('pdfFile', \{ no: inv\.no, date: inv\.dateIso \|\| _isoDate\(inv\.date\) \}\)/.test(stripComments(inv)); }
function refsMatchOneWay(inv) {
  const s = stripComments(inv);
  const builds = s.match(/on\[[^\]]*\] = inv\.no/g) || [], looks = s.match(/on\[(?!_refKey)[^\]]*\]/g) || [];
  return builds.length === 2 && builds.every(b => /on\[_refKey\(l\.ref\)\]/.test(b)) && looks.length === 0 && /function rrInvRef\(coll, s\) \{[^}]*_isoDate\(s\.dateSold\)/.test(s);
}
function accountSetting(inv, cfg) {
  const set = fnBody(inv, 'rrInvOwnSet'), rd = fnBody(inv, 'rrInvOwn');
  return /rrPrefWrite\(I\(\)\.ownKey,/.test(set) && /rrPrefRead\(I\(\)\.ownKey\)/.test(rd) && !/localStorage/.test(set + rd) && /ownKey: 'lv_inv_own'/.test(cfg);
}
function ownersOnly(inv) {
  const set = fnBody(inv, 'rrInvOwnSet'), row = fnBody(inv, 'rrPrefsInvHtml');
  return /rrStaffGate\('business'\)/.test(set.split('\n').slice(0, 4).join('\n')) && /rrStaffCan\('business'\)/.test(row);
}
// the tick box sits under the words (inside the label column), never beside them
function boxUnderWords(inv) { const b = fnBody(inv, '_ownRowInner'); const i = b.indexOf('data-inv-own'), close = b.indexOf("</label></div>'"); return i > 0 && close > i && !/<\/span><\/div>' \+\s*'<label/.test(b); }
function guards() {
  console.log('\n== G · source guards ==');
  const inv = read('collections-invoice.js'), ui = read('collections-ui.js'), cfg = read('config.js'), dp = read('drive-picker.js');
  T('G1 every way in asks the ONE door rrInvOn(): the screen, making one, the archive check, the Sold page, the Collections menu', doorsAsk(inv, ui));
  T('G1b PLANTED: the menu asks only "is the file loaded" → caught', !doorsAsk(inv, ui.replace("typeof rrInvOn === 'function' && rrInvOn() && ", "typeof rrInvOpen === 'function' && ")));
  T('G1c PLANTED: the Sold page button asks only "is Pro on" → caught', !doorsAsk(inv.replace('if (!rrInvOn()) { if (old) old.remove(); return; }', 'if (!_on()) { if (old) old.remove(); return; }'), ui));
  T('G1d PLANTED: making an invoice forgets the door → caught', !doorsAsk(inv.replace("    if (!rrInvOn()) return { ok: false, why: 'off' };", ''), ui));
  T('G2 nothing greyed out in its place (the old "coming in a later release" row is gone)', noGreyPlaceholder(ui, cfg));
  T('G2b PLANTED: the greyed row back → caught', !noGreyPlaceholder(ui + "\nhtml += esc(W('allSoon'));", cfg));
  T('G3 the invoice Date and Paid on are read through the app\'s one date reader, never printed raw', datesReadOneWay(inv));
  T('G3b PLANTED: the raw cell → caught', !datesReadOneWay(inv.replace("date: _showDate(r[_col('Date')])", "date: String(r[_col('Date')] || '')")));
  T('G4 the PDF file name is always YYYY-MM-DD (never the display format with its slashes)', fileNameIso(inv));
  T('G4b PLANTED: the display date in the file name → caught', !fileNameIso(inv.replace('date: inv.dateIso || _isoDate(inv.date) })', 'date: inv.date })')));
  T('G5 "already on an invoice" compares the sold date ONE way, both where the list is built and where it is looked up', refsMatchOneWay(inv));
  T('G5b PLANTED: a raw look-up → caught', !refsMatchOneWay(inv.replace('return on[_refKey(l.ref)]; });', 'return on[l.ref]; });')));
  T('G6 the switch is an ACCOUNT setting (rrPrefRead / rrPrefWrite, ownKey lv_inv_own) — it follows the account to every device', accountSetting(inv, cfg));
  T('G6b PLANTED: written to this device only → caught', !accountSetting(inv.replace("rrPrefWrite(I().ownKey, own ? '1' : '')", "localStorage.setItem(I().ownKey, own ? '1' : '')"), cfg));
  T('G7 owners only: the switch\'s save opens with the roles door and its row asks rrStaffCan(\'business\')', ownersOnly(inv));
  T('G7b PLANTED: the save without the door → caught', !ownersOnly(inv.replace("    if (typeof rrStaffGate === 'function' && !rrStaffGate('business')) return false;   // TRR Pro staff PINs: the roles door (staff.js)\n    if (typeof rrPrefWrite", '    if (typeof rrPrefWrite')));
  T('G9 the "We do our own invoices" box sits under its words (beside them it squeezed the words on a phone)', boxUnderWords(inv));
  T('G9b PLANTED: the box beside the words again → caught', !boxUnderWords(inv.replace("'</span>' +\n      '<label", "'</span></div>' +\n      '<label").replace("</label></div>';", "</label>';")));
  const block = (cfg.match(/var RR_COLL_INVOICE = \{[\s\S]*?\n\};/) || [''])[0];
  T('G8 every word in RR_COLL_INVOICE; none says "AI"; the row is in Business tools', /ownLabel: 'We do our own invoices'/.test(block) && !/\bAI\b/.test(block) && /rrPrefsInvHtml\(\)/.test(stripComments(dp)));
}

async function steady(pg) {
  await pg.evaluate(() => {
    for (let i = 0; i < 8; i++) history.pushState({ pad: i }, '', '');
    window.__rm = async (id) => { const d = document.getElementById(id); if (d) d.remove(); await new Promise(r => setTimeout(r, 250)); };
    window.__pdf = [];
    window.jspdf = { jsPDF: function () {
      const doc = { t: [], name: '' };
      return { internal: { pageSize: { getWidth: () => 612, getHeight: () => 792 } },
        setFont() {}, setFontSize() {}, line() {}, addPage() {}, text(s) { doc.t.push(String(s)); }, save(n) { doc.name = n; window.__pdf.push(doc); } };
    } };
    // a date as Google hands it back: days since 1899-12-30
    window.__serial = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000 + 25569; };
    window.__until = async (fn, ms) => { for (let i = 0; i < (ms || 8000) / 100 && !fn(); i++) await new Promise(r => setTimeout(r, 100)); return !!fn(); };
  });
}
async function setup(pg) {
  await pg.evaluate(async () => {
    localStorage.removeItem('lv_inv_own'); localStorage.removeItem('lv_inv_own__at'); localStorage.removeItem('lv_date_fmt');
    const SOLD = (itemNum, inv, price, date) => [itemNum, '', '1', '8', '', price, date, '', inv, 'Lionel'];
    // 50 sold "2026-10-20" as TEXT (this device, just sold); 51 sold as a SERIAL (read back from Google)
    window.__S.S7['Sold'] = [['Sold'], ['h'], SOLD('2343', '50', '450', '2026-10-20'), SOLD('6464-1', '51', '60', __serial('2026-10-21')), SOLD('3656', '52', '35', '2026-10-22')];
  });
  await openColl(pg, 'c7');
  await pg.evaluate(async () => {
    state.contactsData = [{ id: 'B1', name: 'Ann Buyer', email: 'ann@example.test', address: '1 Main St, Springfield' }];
    await rrCollectionsLoad();
    rrInvSettingsSave({ name: 'Hale Trains & Auctions', address: '9 Depot Rd', phone: '555-0100', email: 'shop@example.test', taxRate: 0, terms: 'Net 15' });
    if (!document.getElementById('main-content')) document.body.appendChild(Object.assign(document.createElement('div'), { id: 'main-content' }));
  });
}

async function run(browser) {
  console.log('\n== A · dates ==');
  const { pg, errs } = await boot(browser);
  await steady(pg);
  await setup(pg);
  const today = await pg.evaluate(() => rrToday());
  const a = await pg.evaluate(async (today) => {
    const out = {};
    const key = (inv) => Object.keys(state.soldData).find(k => state.soldData[k].inventoryId === inv);
    // invoice 1 (item 50, sold date TEXT) and invoice 2 (item 51, sold date SERIAL)
    out.one = await rrInvCreate({ keys: [key('50')], buyerId: 'B1' });
    out.two = await rrInvCreate({ keys: [key('51')], buyerId: 'B1' });
    out.made = !!(out.one.ok && out.two.ok);
    // Google gives the Date back as a serial number; invoice 1 is paid today, Paid on a serial too
    const tab = window.__S.HOME['Invoices'];
    const r1 = tab.find(r => r[0] === '1'), r2 = tab.find(r => r[0] === '2');
    out.writtenAs = r1[1];
    r1[1] = __serial(today); r2[1] = __serial(today);
    out.paid = await rrInvMarkPaid(out.one.invoice.id);
    r1[11] = __serial(today);
    // the list, the invoice, the PDF
    rrInvOpen();
    await __until(() => document.querySelectorAll('[data-inv-row]').length === 2);
    out.listText = document.getElementById('rr-inv-list').textContent;
    const list = await rrInvList();
    const one = list.find(x => x.no === 1);
    out.oneDate = one.date; out.onePaid = one.paidOn; out.oneIso = one.dateIso;
    rrInvShow(one.id);
    out.oneText = document.getElementById('rr-coll-inv-one').textContent;
    window.__pdf = [];
    rrInvPdfGo(one.id);
    out.pdf = window.__pdf[0];
    await __rm('rr-coll-inv-one');
    // the person's own date format: on screen yes, in the file name never
    rrPrefWrite('lv_date_fmt', 'MM/DD/YYYY');
    const one2 = (await rrInvList()).find(x => x.no === 1);
    out.usDate = one2.date;
    rrInvOpen(); await __until(() => document.querySelectorAll('[data-inv-row]').length === 2);
    rrInvShow(one2.id);
    window.__pdf = []; rrInvPdfGo(one2.id);
    out.usPdf = window.__pdf[0];
    await __rm('rr-coll-inv-one'); await __rm('rr-coll-inv');
    rrPrefWrite('lv_date_fmt', 'YYYY-MM-DD');
    // the sale dates come back the OTHER form (a reload): 50 → serial, 51 → text
    state.soldData[key('50')].dateSold = String(__serial('2026-10-20'));
    state.soldData[key('51')].dateSold = '2026-10-21';
    const before = window.__S.HOME['Invoices'].length;
    out.again50 = await rrInvCreate({ keys: [key('50')], buyerId: 'B1' });
    out.again51 = await rrInvCreate({ keys: [key('51')], buyerId: 'B1' });
    out.rowsAfter = window.__S.HOME['Invoices'].length - before;
    const items = rrInvSoldItems(await rrInvList());
    out.onNo = items.map(x => x.s.inventoryId + ':' + x.onNo).sort();
    out.stored51 = (await rrInvList()).find(x => x.no === 2).lines[0].ref;
    rrInvNewOpen();
    await __until(() => document.querySelectorAll('#rr-coll-inv-new [data-inv-pick]').length === 3);
    out.box50 = document.querySelector('#rr-coll-inv-new [data-inv-pick="' + key('50') + '"]').disabled;
    out.box51 = document.querySelector('#rr-coll-inv-new [data-inv-pick="' + key('51') + '"]').disabled;
    out.box52 = document.querySelector('#rr-coll-inv-new [data-inv-pick="' + key('52') + '"]').disabled;
    await __rm('rr-coll-inv-new');
    return out;
  }, today);
  const serialToday = await pg.evaluate((t) => String(__serial(t)), today);
  const usToday = today.slice(5, 7) + '/' + today.slice(8, 10) + '/' + today.slice(0, 4);
  T('A0 two invoices made (one from a text sale date, one from a serial one); the app WRITES today as text', a.made && a.writtenAs === today, { made: a.made, writtenAs: a.writtenAs });
  T('A1 the Date comes back from Google as a serial — the invoice still reads it as ' + today + ' (date, Paid on)', a.oneDate === today && a.onePaid === today && a.oneIso === today, { date: a.oneDate, paid: a.onePaid, iso: a.oneIso });
  T('A2 the Invoices list shows the date, never the serial', a.listText.indexOf(today) >= 0 && a.listText.indexOf(serialToday) < 0, a.listText);
  T('A3 the invoice screen: the date and "Paid on <date>", never the serial', a.oneText.indexOf(today) >= 0 && a.oneText.indexOf('Paid on ' + today) >= 0 && a.oneText.indexOf(serialToday) < 0, a.oneText);
  T('A4 the PDF: "Date: <date>", "PAID <date>", and the file Invoice-1-<date>.pdf', a.pdf && a.pdf.t.includes('Date: ' + today) && a.pdf.t.includes('PAID ' + today) && a.pdf.name === 'Invoice-1-' + today + '.pdf' && a.pdf.t.join(' ').indexOf(serialToday) < 0, a.pdf);
  T('A5 the person\'s own date format (MM/DD/YYYY) on screen and on the PDF — the file name stays YYYY-MM-DD (no slashes)', a.usDate === usToday && a.usPdf && a.usPdf.t.includes('Date: ' + usToday) && a.usPdf.name === 'Invoice-1-' + today + '.pdf', { us: a.usDate, pdf: a.usPdf });
  T('A6 one live invoice per item even when its sale date comes back the other form: 50 (text → serial) and 51 (serial → text) both refused, nothing written', a.again50.why === 'taken' && a.again50.no === 1 && a.again51.why === 'taken' && a.again51.no === 2 && a.rowsAfter === 0, { a50: a.again50, a51: a.again51, rows: a.rowsAfter });
  T('A7 the New invoice screen: 50 and 51 boxes off ("already on invoice"), 52 free', a.onNo.join(',') === '50:1,51:2,52:0' && a.box50 && a.box51 && !a.box52, { onNo: a.onNo, b50: a.box50, b51: a.box51, b52: a.box52 });
  T('A7b a new invoice stores the sale date as YYYY-MM-DD in the item\'s lasting name (51 was sold as a serial)', /^c7\|51\|6464-1\|2026-10-21$/.test(a.stored51 || ''), a.stored51);

  console.log('\n== B · "We do our own invoices" ==');
  await pg.setViewportSize({ width: 430, height: 900 });   // a phone: where the squeeze showed
  const b = await pg.evaluate(async () => {
    const out = {};
    const menuText = () => { rrCollMenuOpen(); const t = (document.getElementById('rr-coll-menu') || {}).innerHTML || ''; const d = document.getElementById('rr-coll-menu'); if (d) d.remove(); return t; };
    const prefs = () => { try { showPage('prefs'); } catch (e) {} buildPrefsPage(); return document.getElementById('prefs-content'); };
    // default: offered
    let p = prefs();
    const box = () => document.querySelector('#prefs-content [data-inv-own]');
    out.rowShown = !!box() && /We do our own invoices/.test(document.getElementById('rr-inv-own-row').textContent) && !box().checked;
    out.inBizTools = !!(document.querySelector('#prefs-content [data-pp-prefs] #rr-inv-own-row'));
    { const ap = document.getElementById('app'); if (ap) ap.style.display = 'block';   // the stand-in world never signs in, so the app shell is hidden
      const sec = document.querySelector('#prefs-content [data-pp-prefs]'); const bd = sec && sec.querySelector('.pref-section-body'); if (bd) bd.style.display = 'block';
      const row = document.getElementById('rr-inv-own-row'), help = row && row.querySelector('.pref-row-label > span');
      out.helpShare = (row && help) ? help.getBoundingClientRect().width / row.getBoundingClientRect().width : 0; }
    rrCollUiPaint(); rrInvPaintSoldButton();
    out.soldBtn0 = !!document.getElementById('rr-inv-sold-btn');
    out.menu0 = /data-coll-inv/.test(menuText());
    const tabBefore = JSON.stringify(window.__S.HOME['Invoices']);
    // TICK it (tapped)
    window.__toasts = [];
    box().click();
    await new Promise(r => setTimeout(r, 300));
    out.stored = localStorage.getItem('lv_inv_own'); out.stamped = Number(localStorage.getItem('lv_inv_own__at')) > 0;
    out.toast = window.__toasts.slice(-1)[0];
    out.soldBtn1 = !!document.getElementById('rr-inv-sold-btn');
    const m1 = menuText();
    out.menu1 = /data-coll-inv/.test(m1); out.grey1 = /later release|aria-disabled/.test(m1);
    out.helpOn = /buttons are hidden/.test(document.getElementById('rr-inv-own-row').textContent) && box().checked;
    await rrInvOpen();
    out.screen1 = !!document.getElementById('rr-coll-inv');
    const k52 = Object.keys(state.soldData).find(k => state.soldData[k].inventoryId === '52');
    const n0 = window.__calls.filter(c => c.kind === 'put' || c.kind === 'append').length;
    out.make1 = await rrInvCreate({ keys: [k52], buyerId: 'B1' });
    out.writes1 = window.__calls.filter(c => c.kind === 'put' || c.kind === 'append').length - n0;
    const chk1 = await rrArchiveChecks('c7');
    out.arch1 = (chk1.open || []).filter(r => r.id === 'invoices').length;
    out.kept = JSON.stringify(window.__S.HOME['Invoices']) === tabBefore;
    // a reload keeps it (the setting, not the screen)
    p = prefs();
    out.stillTicked = box().checked;
    // UNTICK → everything back, the invoices still there
    box().click();
    await new Promise(r => setTimeout(r, 300));
    out.stored2 = localStorage.getItem('lv_inv_own');
    rrInvPaintSoldButton();
    out.soldBtn2 = !!document.getElementById('rr-inv-sold-btn');
    out.menu2 = /data-coll-inv/.test(menuText());
    const chk2 = await rrArchiveChecks('c7');
    out.arch2 = (chk2.open || []).filter(r => r.id === 'invoices').length;
    rrInvOpen(); await __until(() => document.querySelectorAll('[data-inv-row]').length === 2);
    out.listBack = document.querySelectorAll('[data-inv-row]').length;
    await __rm('rr-coll-inv');
    // a Staff member / a manager (PINs in use): no row, and the save refused
    const realCan = window.rrStaffCan, realGate = window.rrStaffGate;
    window.rrStaffCan = (w) => w !== 'business'; window.rrStaffGate = (w) => w !== 'business';
    p = prefs();
    out.staffRow = !!document.querySelector('#prefs-content [data-inv-own]');
    out.staffSet = rrInvOwnSet(true);
    out.staffStored = localStorage.getItem('lv_inv_own');
    window.rrStaffCan = realCan; window.rrStaffGate = realGate;
    // an invoice made BEFORE this fix (live v0.9.2141 stored the raw serial in the item's lasting name):
    // item 52, sold "2026-10-22" as text here, must still count as on it
    const old = new Array(17).fill(''); old[0] = '3'; old[1] = __serial('2026-11-11'); old[2] = 'Unpaid'; old[15] = 'invOLD';
    old[16] = JSON.stringify({ lines: [{ ref: 'c7|52|3656|' + __serial('2026-10-22'), coll: 'c7', fullId: '7-52', name: '3656', price: 35 }] });
    window.__S.HOME['Invoices'].push(old);
    const k52b = Object.keys(state.soldData).find(k => state.soldData[k].inventoryId === '52');
    out.old52 = await rrInvCreate({ keys: [k52b], buyerId: 'B1' });
    out.oldOn = rrInvSoldItems(await rrInvList()).filter(x => x.s.inventoryId === '52').map(x => x.onNo)[0];
    out.oldDate = (await rrInvList()).find(x => x.no === 3).date;
    // the same, read the OLD raw way, would have missed it (the reason for the fix)
    out.rawWouldMiss = ('c7|52|3656|' + __serial('2026-10-22')) !== ['c7', '52', '3656', state.soldData[k52b].dateSold].join('|');
    return out;
  });
  T('B1b at phone width the help words use most of the row (the box sits under them, not beside)', b.helpShare > 0.75, b.helpShare);
  T('B1 Preferences → Business tools has "Invoices — We do our own invoices", unticked; the Sold page and the Collections menu offer Invoices', b.rowShown && b.inBizTools && b.soldBtn0 && b.menu0, b);
  T('B2 ticked (tapped): an ACCOUNT setting (lv_inv_own = 1, stamped so it syncs to every device), with a ✓ message', b.stored === '1' && b.stamped && /Invoices hidden/.test(b.toast || ''), b);
  T('B3 …the Sold page button is gone, the Collections menu has no Invoices — and nothing greyed out in its place', !b.soldBtn1 && !b.menu1 && !b.grey1 && b.helpOn, b);
  T('B4 …the Invoices screen does not open; making one is refused with nothing written', !b.screen1 && b.make1.ok === false && b.make1.why === 'off' && b.writes1 === 0, b);
  T('B5 …archiving says nothing about invoices (there is an unpaid one) — and the invoices already made are untouched', b.arch1 === 0 && b.kept && b.stillTicked, b);
  T('B6 unticked: the button, the menu, the archive check and both invoices are back', b.stored2 === '' && b.soldBtn2 && b.menu2 && b.arch2 === 1 && b.listBack === 2, b);
  T('B7 Staff / a manager (PINs in use): no switch in Preferences, and the save is refused (nothing stored)', !b.staffRow && b.staffSet === false && b.staffStored === '', b);
  T('C1 an invoice made before this fix (its item\'s sale date stored as the serial): item 52 still "on invoice 3", a second one refused; its date reads 2026-11-11', b.old52.why === 'taken' && b.old52.no === 3 && b.oldOn === 3 && b.oldDate === '2026-11-11', { old52: b.old52, on: b.oldOn, date: b.oldDate });
  T('C1b …and the old raw comparison WOULD have missed it (why this fix is needed)', b.rawWouldMiss === true, b.rawWouldMiss);
  T('B8 no script error', errs.length === 0, errs);
  await pg.close();

  console.log('\n== X · a regular customer ==');
  const x = await boot(browser, { off: true });
  const o = await x.pg.evaluate(() => { buildPrefsPage(); return { row: !!document.querySelector('#prefs-content [data-inv-own]'), html: rrPrefsInvHtml(), on: rrInvOn(), set: rrInvOwnSet(true), stored: localStorage.getItem('lv_inv_own') }; });
  T('X1 Pro switched off (a regular customer): no switch, no invoices, the save does nothing', !o.row && o.html === '' && o.on === false && o.set === false && !o.stored, o);
  await x.pg.close();
}

(async () => {
  guards();
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try { await run(browser); } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log('FAILED  —  ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
