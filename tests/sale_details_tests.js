#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// RECORDING A SALE, AND TAKING ONE BACK — v0.9.1944   (real Chromium, the REAL app)
//
// [stated] Brad, 2026-10-14, on the Record sale box: "on record a sale, we
// track sold price, but we need to be able to track sold to: ex Bob, sold at:
// ex York Trainshow, sold date:, and notes ex combined with the 6464-150" —
// and on the sold item's page: "we also need a returned button that puts it
// back into the sale list".
//
//   A  scans, each proven able to fail on a planted offender:
//      A1 no My Collection row is blanked except through rrPersonalRemoveRow
//         (which keeps a copy in Deleted Rows first)
//      A2 no Sold range is typed as letters — every one comes from SOLD_HEADERS
//      A3 every Sold row the app builds carries Sold To and Sold At
//      A4 SOLD_HEADERS ends Sold To, Sold At; the builder fills every column;
//         the loader reads the two new columns where the headers put them
//   B  Mark sold on a listing, through the REAL box: price / Sold to / Sold at
//      (from the Show Mode session) / date / notes (from the listing) land in
//      the new Sold row; the collection row and the listing are each kept in
//      Deleted Rows under the sale's tag before they are blanked; a tap
//      outside the box does nothing; Cancel writes nothing
//      PLANTED: the old blanking line -> no copy of the collection row (B fails)
//   C  Returned on that sale: the collection row and the listing come back
//      exactly as they were; the sale leaves Sold (a copy kept); pressing it
//      again changes nothing
//   D  Returned when the listing will not go back: the sale STAYS on Sold, and
//      pressing Returned again finishes the job without a second copy
//   E  Returned on a sale recorded before v0.9.1944 (nothing kept): asks the
//      asking price first (Cancel writes nothing), rebuilds the row from the
//      sale's snapshot, lists it at that price
//   F  the sold item's page shows Sold To as the person, Sold At, and a
//      Returned button; a part's sale has no Returned button; the Sold list
//      shows who and where
//   G  the sell wizard's last screen asks Sold to / Sold at too; its sale keeps
//      the collection row and the listing under the tag; Returned undoes it
//   H  Brad: "the sold at needs to remember these locations" — place buttons
//      under Sold At: the Show Mode session, then the places he has used (most
//      used first), then eBay / York Train Show / Flea market / Marketplace
//
// The stand-in Google Sheets lives behind fetch(): reads, writes, appends,
// the tab list and addSheet — so sheets.js runs for real, archive and all.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  sale_details_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const APP_FILES = fs.readdirSync(APP).filter(f => /\.js$/.test(f));

// ── A · scans ───────────────────────────────────────────────────────────────
function scanBlank(files) {
  const bad = [];
  Object.keys(files).forEach(name => {
    const lines = files[name].split('\n');
    let inGate = false;
    lines.forEach((ln, i) => {
      if (/async function rrPersonalRemoveRow\b/.test(ln)) inGate = true;
      else if (inGate && /^}/.test(ln)) inGate = false;
      if (/^\s*\/\//.test(ln)) return;
      if (/personalWriteRow\([^,]+,\s*personalBlankRow\(\)\s*\)/.test(ln) && !inGate) bad.push(name + ':' + (i + 1));
    });
  });
  return bad;
}
function scanSoldRange(files) {
  const bad = [];
  Object.keys(files).forEach(name => files[name].split('\n').forEach((ln, i) => {
    if (/^\s*\/\//.test(ln)) return;
    // a range wider than column A (the title cell 'Sold!A1:A1' is not a table range)
    if (/['"`]Sold!A\d*:(?!A\d*['"`])[A-Z]/.test(ln) || /Sold!A\$\{[^}]+\}:[A-Z]/.test(ln)) bad.push(name + ':' + (i + 1) + '  ' + ln.trim().slice(0, 100));
  }));
  return bad;
}
// every _buildSoldRow({...}) call's object names soldTo and soldAt
function scanBuilderCalls(files) {
  const bad = [], seen = [];
  Object.keys(files).forEach(name => {
    const s = files[name];
    const re = /_buildSoldRow\(\{/g; let m;
    while ((m = re.exec(s))) {
      let depth = 0, j = m.index + '_buildSoldRow('.length;
      for (; j < s.length; j++) { const c = s[j]; if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) break; } }
      const obj = s.slice(m.index, j + 1);
      const line = s.slice(0, m.index).split('\n').length;
      seen.push(name + ':' + line);
      if (!/\bsoldTo\s*:/.test(obj) || !/\bsoldAt\s*:/.test(obj)) bad.push(name + ':' + line);
    }
  });
  return { bad, seen };
}

(function sectionA() {
  const all = {}; APP_FILES.forEach(f => { all[f] = read(f); });
  const b1 = scanBlank(all);
  T('A1 no collection row is blanked except through rrPersonalRemoveRow', b1.length === 0, b1);
  const p1 = Object.assign({}, all, { 'app-pages.js': all['app-pages.js'] + '\nasync function _x(r){ await personalWriteRow(r, personalBlankRow()); }\n' });
  T('A1 PLANTED: a bare blanking write is caught', scanBlank(p1).length === 1, scanBlank(p1));

  const b2 = scanSoldRange(all);
  T('A2 no Sold range is typed as letters', b2.length === 0, b2);
  const p2 = Object.assign({}, all, { 'browse.js': all['browse.js'] + "\nsheetsAppend(id, 'Sold!A:T', [r]);\n" });
  T('A2 PLANTED: \'Sold!A:T\' is caught', scanSoldRange(p2).length === 1, scanSoldRange(p2));

  const b3 = scanBuilderCalls(all);
  T('A3 every Sold row built carries Sold To and Sold At (' + b3.seen.length + ' builders)', b3.bad.length === 0 && b3.seen.length >= 5, b3);
  const ws = all['wizard-save.js'];
  const ws2 = ws.replace("soldTo: d.soldTo || '', soldAt: (d.soldAt || '').trim(),   // v0.9.1944", '');
  T('A3 PLANTED: the wizard dropping them is caught', ws2 !== ws && scanBuilderCalls(Object.assign({}, all, { 'wizard-save.js': ws2 })).bad.length === 1);

  // A4 — the headers, the builder and the loader agree
  const vm = require('vm');
  const appSrc = all['app.js'];
  const hs = appSrc.indexOf('const SOLD_HEADERS = ['), he = appSrc.indexOf('];', hs);
  const box = {};
  vm.runInNewContext(appSrc.slice(hs, he + 2).replace('const SOLD_HEADERS', 'SOLD_HEADERS') + ';\n'
    + appSrc.slice(appSrc.indexOf('function colLetter('), appSrc.indexOf('// Spreadsheet column letter')) + '\n'
    + appSrc.slice(appSrc.indexOf('function soldEndCol()'), appSrc.indexOf('const FOR_SALE_HEADERS')) + '\n'
    + appSrc.slice(appSrc.indexOf('function _buildSoldRow(opts)'), appSrc.indexOf('window._buildSoldRow = _buildSoldRow;')) + '\n'
    + 'out.headers = SOLD_HEADERS; out.end = soldEndCol(); out.range = soldRowRange(9);'
    + 'out.row = _buildSoldRow({ itemNum: "2343", salePrice: "5", dateSold: "2026-10-14", soldTo: "C-1", soldAt: "York" });',
    { out: box, window: {} });
  const H = box.headers || [];
  T('A4 SOLD_HEADERS ends Sold To, Sold At', H[H.length - 2] === 'Sold To' && H[H.length - 1] === 'Sold At', H.slice(-3));
  T('A4 the Sold range ends where the headers do', box.end === 'V' && box.range === 'Sold!A9:V9', [box.end, box.range]);
  T('A4 the builder fills every column, Sold To and Sold At last',
    box.row && box.row.length === H.length && box.row[H.indexOf('Sold To')] === 'C-1' && box.row[H.indexOf('Sold At')] === 'York', box.row);
  const ad = all['app-data.js'];
  T('A4 the loader reads them where the headers put them',
    new RegExp('soldTo: _ss\\(r\\[' + H.indexOf('Sold To') + '\\]\\), soldAt: _ss\\(r\\[' + H.indexOf('Sold At') + '\\]\\)').test(ad)
    && /sheetsGet\(sheetId, 'Sold!A3:' \+ soldEndCol\(\)\)/.test(ad));
})();

// ── the stand-in spreadsheet ────────────────────────────────────────────────
function plantedOldBlank() {
  const s = read('app-pages.js');
  const out = s.replace('try { _ceOk = await rrPersonalRemoveRow(collEntry, _saleTag); }', 'try { _ceOk = await personalWriteRow(collEntry, personalBlankRow()); }');
  if (out === s) throw new Error('planted app-pages.js: the collection removal line moved; update this test');
  return out;
}

async function boot(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    if (planted && u.split('?')[0].endsWith('/app/app-pages.js')) return r.fulfill({ body: planted, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(() => {
    // ── the sheet ──
    const colIdx = s => { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
    const colL = i => { let n = i + 1, s = ''; while (n > 0) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); } return s; };
    const S = window.__S = { tabs: {}, failAppendTo: null, log: [] };
    const tab = t => (S.tabs[t] = S.tabs[t] || []);
    const parse = r => {
      r = decodeURIComponent(r);
      const i = r.lastIndexOf('!');
      const t = (i < 0 ? r : r.slice(0, i)).replace(/^'|'$/g, '');
      if (i < 0) return { t, c1: 0, r1: 1, c2: 200, r2: 1e6 };
      const [p, q] = r.slice(i + 1).split(':');
      const cell = s => { const m = /^([A-Z]*)(\d*)$/.exec(s || ''); return { c: m && m[1] ? colIdx(m[1]) : null, r: m && m[2] ? Number(m[2]) : null }; };
      const a = cell(p), b = q === undefined ? a : cell(q);
      return { t, c1: a.c == null ? 0 : a.c, r1: a.r == null ? 1 : a.r, c2: b.c == null ? 200 : b.c, r2: b.r == null ? (q === undefined ? a.r || 1e6 : 1e6) : b.r };
    };
    const last = rows => { for (let i = rows.length - 1; i >= 0; i--) if ((rows[i] || []).some(c => String(c == null ? '' : c) !== '')) return i + 1; return 0; };
    const get = rg => {
      const R = parse(rg), rows = tab(R.t), out = [];
      const top = Math.min(R.r2, last(rows));
      for (let r = R.r1; r <= top; r++) {
        const row = (rows[r - 1] || []).slice(R.c1, R.c2 + 1).map(c => c == null ? '' : c);
        while (row.length && row[row.length - 1] === '') row.pop();
        out.push(row);
      }
      while (out.length && !out[out.length - 1].length) out.pop();
      return out;
    };
    const put = (rg, values, raw) => {
      const R = parse(rg), rows = tab(R.t);
      values.forEach((v, k) => {
        const r = R.r1 + k; rows[r - 1] = rows[r - 1] || [];
        v.forEach((c, j) => { let x = c == null ? '' : c; if (!raw && typeof x === 'string' && x.charAt(0) === "'") x = x.slice(1); rows[r - 1][R.c1 + j] = x; });
      });
    };
    S.get = get; S.put = put; S.tab = tab; S.colL = colL;
    window.fetch = async function (url, opts) {
      const u = String(url), method = (opts && opts.method) || 'GET';
      const ok = b => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
      const body = opts && opts.body ? JSON.parse(opts.body) : null;
      if (/spreadsheets\/SID\?fields=/.test(u)) return ok({ sheets: Object.keys(S.tabs).map((t, i) => ({ properties: { title: t, sheetId: 100 + i } })) });
      if (/spreadsheets\/SID:batchUpdate/.test(u)) {
        (body.requests || []).forEach(q => {
          if (q.addSheet) tab(q.addSheet.properties.title);
          if (q.deleteDimension) {
            const g = q.deleteDimension.range, t = Object.keys(S.tabs)[g.sheetId - 100];
            S.tabs[t].splice(g.startIndex, g.endIndex - g.startIndex); S.log.push('delete ' + t + ' ' + (g.startIndex + 1));
          }
        });
        return ok({});
      }
      if (/values:batchGet/.test(u)) {
        const ranges = [...u.matchAll(/ranges=([^&]+)/g)].map(m => decodeURIComponent(m[1]));
        return ok({ valueRanges: ranges.map(r => ({ range: r, values: get(r) })) });
      }
      const m = /\/values\/([^?]+)\?/.exec(u);
      if (!m) return ok({});
      let rg = m[1]; const raw = /valueInputOption=RAW/.test(u);
      if (/:append$/.test(rg)) {
        rg = rg.replace(/:append$/, '');
        const t = parse(rg).t;
        if (S.failAppendTo && S.failAppendTo === t) { S.failAppendTo = null; return { ok: false, status: 503, json: async () => ({ error: { message: 'unavailable' } }), text: async () => 'unavailable' }; }
        const rows = tab(t); const at = Math.max(last(rows) + 1, 3);
        put("'" + t + "'!A" + at, body.values, raw);
        S.log.push('append ' + t + ' ' + at);
        return ok({ updates: { updatedRange: "'" + t + "'!A" + at + ':' + colL(body.values[0].length - 1) + (at + body.values.length - 1) } });
      }
      if (method === 'GET') return ok({ range: decodeURIComponent(rg), values: get(rg) });
      if (method === 'PUT') { put(rg, body.values, raw); S.log.push('put ' + decodeURIComponent(rg)); return ok({ updatedCells: 1 }); }
      return ok({});
    };
    window.showToast = function (m) { (window.__toasts = window.__toasts || []).push(String(m)); };
    window.loadPersonalData = async function () {};
    state.personalSheetId = 'SID'; window.accessToken = 'tok'; accessToken = 'tok';
    state.contactsData = [{ id: 'C-1700000000001', name: 'Bob Smith', business: '' }, { id: 'C-1700000000002', name: 'Ann Lee', business: 'Lee Trains' }];
    state.upgradeData = {}; state.wantData = state.wantData || {}; state.isData = state.isData || {};
    try { localStorage.setItem('lv_show_session', JSON.stringify({ name: 'Timonium Show', date: new Date().toLocaleDateString('en-CA') })); } catch (e) {}
  });
  return { pg, errs };
}

// The world every section starts from: one owned 2343 (Inventory ID 7) listed
// for sale, and one earlier sale (at York) on the Sold tab.
async function seed(pg) {
  return pg.evaluate(() => {
    const S = window.__S; S.tabs = {};
    const F = PERSONAL_FIELD_INDEX;
    const rec = { owned: true, itemNum: '2343', variation: '', condition: '8', priceItem: '300', inventoryId: '7', manufacturer: 'Lionel',
      hasBox: 'Yes', boxCond: '7', photoItem: 'https://drive.test/item7', allOriginal: 'Yes', purchasedFrom: 'C-1700000000002', yourGrade: 'C8', custom3: 'shelf B', row: 3 };
    const row = buildPersonalRow(rec);
    S.tab(PERSONAL_TAB)[0] = ['My Collection']; S.tab(PERSONAL_TAB)[1] = PERSONAL_HEADERS.slice();
    S.put(PERSONAL_TAB + '!A3', [row], false);
    S.tab('For Sale')[0] = ['For Sale']; S.tab('For Sale')[1] = FOR_SALE_HEADERS.slice();
    S.put('For Sale!A3', [['2343', '', '8', '450', '2026-10-01', 'runs well', '300', '', '7', 'Lionel']], true);
    S.tab('Sold')[0] = ['Sold']; S.tab('Sold')[1] = SOLD_HEADERS.slice();
    const old = new Array(SOLD_HEADERS.length).fill(''); old[0] = '6464-1'; old[5] = '35'; old[6] = '2026-09-01'; old[21] = 'York Train Show';
    S.put('Sold!A3', [old], true);
    state.personalData = { '7': Object.assign({}, rec, { masterKey: '' }) };
    state.forSaleData = { '7': { row: 3, itemNum: '2343', variation: '', condition: '8', askingPrice: '450', dateListed: '2026-10-01', notes: 'runs well', originalPrice: '300', estWorth: '', inventoryId: '7', manufacturer: 'Lionel' } };
    state.soldData = { 'sold-3': { row: 3, key: 'sold-3', itemNum: '6464-1', salePrice: '35', dateSold: '2026-09-01', soldAt: 'York Train Show', notes: '' } };
    window.__toasts = [];
    return { collRow: S.get(PERSONAL_TAB + '!A3:BZ3')[0] };
  });
}

async function markSold(pg, fill) {
  await pg.evaluate(() => { window.__p = markForSaleAsSold('7', '450').then(() => 'done', e => 'threw ' + (e && e.message)); });
  await pg.waitForSelector('#rr-sale-dlg', { timeout: 5000 });
  const shown = await pg.evaluate(() => {
    const ov = document.getElementById('rr-sale-dlg');
    return { price: ov.querySelector('#rr-sale-price').value, at: ov.querySelector('#rr-sale-at').value,
      notes: ov.querySelector('#rr-sale-notes').value, date: ov.querySelector('#rr-sale-date').value,
      places: [...ov.querySelectorAll('#rr-sale-at-list option')].map(o => o.value),
      chips: [...ov.querySelectorAll('[data-sale-place]')].map(b => b.textContent),
      lit: [...ov.querySelectorAll('[data-sale-place][aria-pressed="true"]')].map(b => b.textContent),
      people: [...ov.querySelectorAll('#rr-sale-to option')].map(o => o.textContent) };
  });
  if (fill) await fill();
  return shown;
}

(async function () {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    const { pg, errs } = await boot(browser);
    const today = await pg.evaluate(() => new Date().toLocaleDateString('en-CA'));

    // ── B · Mark sold ──
    let world = await seed(pg);
    const world0 = world;
    // a tap outside the box does nothing; Cancel writes nothing
    await pg.evaluate(() => { window.__p0 = markForSaleAsSold('7', '450'); });
    await pg.waitForSelector('#rr-sale-dlg');
    await pg.mouse.click(5, 5);
    await pg.waitForTimeout(200);
    const stillOpen = await pg.evaluate(() => !!document.getElementById('rr-sale-dlg'));
    await pg.click('#rr-sale-dlg [data-sale="cancel"]');
    await pg.evaluate(() => window.__p0);
    const afterCancel = await pg.evaluate(() => ({ log: window.__S.log.slice(), open: !!document.getElementById('rr-sale-dlg') }));
    T('B a tap outside the Record sale box leaves it open', stillOpen);
    T('B Cancel closes it and writes nothing', !afterCancel.open && afterCancel.log.length === 0, afterCancel);

    let tapped = null;
    const shown = await markSold(pg, async () => {
      await pg.click('#rr-sale-dlg [data-sale-place="eBay"]');
      tapped = await pg.evaluate(() => ({ v: document.getElementById('rr-sale-at').value,
        lit: [...document.querySelectorAll('#rr-sale-dlg [data-sale-place][aria-pressed="true"]')].map(b => b.textContent) }));
      await pg.click('#rr-sale-dlg [data-sale-place="Timonium Show"]');
      await pg.fill('#rr-sale-price', '425');
      await pg.selectOption('#rr-sale-to', 'C-1700000000001');
      await pg.fill('#rr-sale-notes', 'runs well — combined with the 6464-150');
    });
    T('B one tap on a place button fills Sold At and lights that button', tapped && tapped.v === 'eBay' && JSON.stringify(tapped.lit) === '["eBay"]', tapped);
    T('B the box starts from the asking price, the listing\'s notes, today and the Show Mode session',
      shown.price === '450' && shown.notes === 'runs well' && shown.date === today && shown.at === 'Timonium Show', shown);
    T('B Sold at offers the places sold at before, the session first', shown.places[0] === 'Timonium Show' && shown.places.indexOf('York Train Show') > 0, shown.places);
    T('B the place buttons: the session, places used before, then the starting places — each once',
      JSON.stringify(shown.chips) === JSON.stringify(['Timonium Show', 'York Train Show', 'eBay', 'Flea market', 'Marketplace']) && JSON.stringify(shown.lit) === '["Timonium Show"]', shown);
    T('B Sold to lists the contacts and "Add someone new…"', shown.people.indexOf('Bob Smith') >= 0 && shown.people.indexOf('Ann Lee — Lee Trains') >= 0 && /Add someone new/.test(shown.people[shown.people.length - 1]), shown.people);
    await pg.click('#rr-sale-dlg [data-sale="ok"]');
    const res = await pg.evaluate(() => window.__p);
    const B = await pg.evaluate(() => {
      const S = window.__S, H = SOLD_HEADERS;
      const sold = S.get('Sold!A4:' + soldEndCol() + '4')[0] || [];
      const bin = S.get("'Deleted Rows'!A3:BZ");
      return { sold: sold, soldAt: sold[H.indexOf('Sold At')], soldTo: sold[H.indexOf('Sold To')], notes: sold[H.indexOf('Notes')], price: sold[H.indexOf('Sale Price')],
        date: sold[H.indexOf('Date Sold')], inv: sold[H.indexOf('Inventory ID')],
        coll: S.get(PERSONAL_TAB + '!A3:BZ3')[0] || [], fs: S.get('For Sale!A3:J3')[0] || [], bin: bin,
        state: Object.values(state.soldData).find(x => x.itemNum === '2343') || null };
    });
    T('B the sale finished', res === 'done', res);
    T('B the new Sold row carries price, Sold To (the contact), Sold At, date and notes',
      B.price === '425' && B.soldTo === 'C-1700000000001' && B.soldAt === 'Timonium Show' && B.date === today
      && B.notes === 'runs well — combined with the 6464-150' && String(B.inv) === '7', B);
    T('B the screen has Sold To and Sold At straight away', B.state && B.state.soldTo === 'C-1700000000001' && B.state.soldAt === 'Timonium Show', B.state);
    T('B the collection row and the listing are blanked', !B.coll.length && !B.fs.length, [B.coll, B.fs]);
    const tag = '[sale 7 ' + today + ']';
    const collCopy = B.bin.find(l => l[1] === 'My Collection' && String(l[3]).indexOf(tag) >= 0);
    const fsCopy = B.bin.find(l => l[1] === 'For Sale' && String(l[3]).indexOf(tag) >= 0);
    T('B the collection row is kept in Deleted Rows, whole, under the sale\'s tag', !!collCopy && JSON.stringify(collCopy.slice(6)) === JSON.stringify(world.collRow), collCopy);
    T('B the listing is kept in Deleted Rows under the sale\'s tag', !!fsCopy && fsCopy[9] === '450', fsCopy);
    const soldKey = await pg.evaluate(() => Object.keys(state.soldData).find(k => state.soldData[k].itemNum === '2343'));

    // ── C · Returned ──
    await pg.evaluate(() => { window.appConfirm = async () => true; window.appPrompt = async () => { window.__asked = true; return '999'; }; window.__asked = false; });
    await pg.evaluate(k => rrSaleReturned(k), soldKey);
    const C = await pg.evaluate(() => {
      const S = window.__S;
      const collRows = S.get(PERSONAL_TAB + '!A3:BZ').filter(r => r.length);
      const fsRows = S.get('For Sale!A3:J').filter(r => r.length);
      const soldRows = S.get('Sold!A3:' + soldEndCol()).filter(r => r.length);
      const bin = S.get("'Deleted Rows'!A3:BZ");
      return { collRows, fsRows, soldRows, bin, asked: window.__asked, toasts: window.__toasts.slice(-2) };
    });
    T('C the collection row is back exactly as it was', C.collRows.length === 1 && JSON.stringify(C.collRows[0]) === JSON.stringify(world.collRow), C.collRows);
    T('C the listing is back at its asking price', C.fsRows.length === 1 && C.fsRows[0][3] === '450' && String(C.fsRows[0][8]) === '7', C.fsRows);
    T('C no asking price was asked — the listing was kept', C.asked === false);
    T('C the sale is off Sold (the earlier sale stays)', C.soldRows.length === 1 && C.soldRows[0][0] === '6464-1', C.soldRows);
    T('C the sale itself is kept in Deleted Rows', C.bin.some(l => l[1] === 'Sold' && /^returned/.test(l[3]) && l[6] === '2343'), C.bin.map(l => l.slice(0, 4)));
    T('C the restored lines are marked put back', C.bin.filter(l => String(l[3]).indexOf(tag) >= 0 && / — put back /.test(l[3])).length === 2, C.bin.map(l => l[3]));
    const before = await pg.evaluate(() => window.__S.log.length);
    await pg.evaluate(k => rrSaleReturned(k), soldKey);
    T('C pressing Returned again changes nothing', await pg.evaluate(n => window.__S.log.length === n, before));

    // ── D · half put back, then finished ──
    world = await seed(pg);
    await markSold(pg);
    await pg.click('#rr-sale-dlg [data-sale="ok"]');
    await pg.evaluate(() => window.__p);
    const dKey = await pg.evaluate(() => Object.keys(state.soldData).find(k => state.soldData[k].itemNum === '2343'));
    await pg.evaluate(() => { window.__S.failAppendTo = 'For Sale'; });
    await pg.evaluate(k => rrSaleReturned(k), dKey);
    const D1 = await pg.evaluate(() => ({ sold: window.__S.get('Sold!A3:' + soldEndCol()).filter(r => r.length).length,
      coll: window.__S.get(PERSONAL_TAB + '!A3:BZ').filter(r => r.length).length, fs: window.__S.get('For Sale!A3:J').filter(r => r.length).length,
      toast: window.__toasts[window.__toasts.length - 1] }));
    T('D the listing would not go back -> the sale stays on Sold and says so', D1.sold === 2 && D1.coll === 1 && D1.fs === 0 && /not back on the For Sale list/.test(D1.toast), D1);
    await pg.evaluate(k => rrSaleReturned(k), dKey);
    const D2 = await pg.evaluate(() => ({ sold: window.__S.get('Sold!A3:' + soldEndCol()).filter(r => r.length).length,
      coll: window.__S.get(PERSONAL_TAB + '!A3:BZ').filter(r => r.length).length, fs: window.__S.get('For Sale!A3:J').filter(r => r.length).length }));
    T('D Returned again finishes it — one collection row, one listing, sale gone', D2.sold === 1 && D2.coll === 1 && D2.fs === 1, D2);

    // ── E · a sale from before v0.9.1944 ──
    await seed(pg);
    await pg.evaluate(() => {
      const S = window.__S;
      S.tab(PERSONAL_TAB).length = 2; S.tab('For Sale').length = 2;   // nothing kept: the old sale paths blanked without a copy
      state.personalData = {}; state.forSaleData = {};
      const r = _buildSoldRow({ itemNum: '2343', variation: '', condition: '8', pricePaid: '300', salePrice: '410', dateSold: '2026-08-15', inventoryId: '7', manufacturer: 'Lionel',
        src: { hasBox: 'Yes', boxCond: '7', photoItem: 'https://drive.test/item7', allOriginal: 'Yes' } }).slice(0, 20);   // a 20-column row, as they were
      S.put('Sold!A4', [r], true);
      state.soldData['sold-4'] = { row: 4, key: 'sold-4', itemNum: '2343', variation: '', condition: '8', priceItem: '300', salePrice: '410', dateSold: '2026-08-15', inventoryId: '7',
        manufacturer: 'Lionel', hasBox: 'Yes', boxCond: '7', photoItem: 'https://drive.test/item7', allOriginal: 'Yes', notes: '' };
      window.appPrompt = async () => null; S.log = [];
    });
    await pg.evaluate(() => rrSaleReturned('sold-4'));
    T('E Cancel at the asking price writes nothing', await pg.evaluate(() => window.__S.log.length === 0 && !!window.__S.get('Sold!A4:A4').length));
    await pg.evaluate(() => { window.appPrompt = async (msg, def) => { window.__def = def; return '475'; }; });
    await pg.evaluate(() => rrSaleReturned('sold-4'));
    const E = await pg.evaluate(() => {
      const S = window.__S, F = PERSONAL_FIELD_INDEX;
      const c = S.get(PERSONAL_TAB + '!A3:BZ').filter(r => r.length);
      return { def: window.__def, coll: c, inv: c[0] && c[0][F.inventoryId], cond: c[0] && c[0][F.condition], photo: c[0] && c[0][F.photoItem], box: c[0] && c[0][F.hasBox],
        fs: S.get('For Sale!A3:J').filter(r => r.length), sold: S.get('Sold!A4:A4').length };
    });
    T('E the asking price is asked, starting from what it sold for', E.def === '410', E.def);
    T('E the collection row is rebuilt from the sale\'s snapshot, same Inventory ID', E.coll.length === 1 && String(E.inv) === '7' && String(E.cond) === '8' && E.photo === 'https://drive.test/item7' && E.box === 'Yes', E);
    T('E it is listed for sale at the price given', E.fs.length === 1 && E.fs[0][3] === '475' && String(E.fs[0][8]) === '7', E.fs);
    T('E the sale is off Sold', E.sold === 0, E);

    // ── G · the sell wizard: its last screen asks the same, and Returned undoes it ──
    await seed(pg);
    const G0 = await pg.evaluate(() => {
      sellFromCollection(-1, '7');
      wizard.data.salePrice = '400';
      wizard.step = wizard.steps.findIndex(x => x.id === 'confirm');
      renderWizardStep();
      const f = document.getElementById('wiz-sale-fields');
      return { has: !!f, at: f && f.querySelector('#wiz-sale-at').value, to: f && f.querySelector('#wiz-sale-to') ? 1 : 0 };
    });
    T('G the sell wizard\'s last screen has Sold to and Sold at, from the Show Mode session', G0.has && G0.to === 1 && G0.at === 'Timonium Show', G0);
    await pg.selectOption('#wiz-sale-to', 'C-1700000000002');
    await pg.click('#wiz-sale-fields [data-sale-place="eBay"]');
    T('G a place button on the wizard\'s screen fills what the wizard saves', await pg.evaluate(() => wizard.data.soldAt === 'eBay'));
    await pg.evaluate(() => { wizard.data.notes = 'shipped Priority'; });
    const gRes = await pg.evaluate(() => saveWizardItem().then(() => 'done', e => 'threw ' + (e && e.message)));
    const G = await pg.evaluate(() => {
      const S = window.__S, H = SOLD_HEADERS;
      const sold = S.get('Sold!A3:' + soldEndCol()).filter(r => r.length && r[0] === '2343')[0] || [];
      return { sold, to: sold[H.indexOf('Sold To')], at: sold[H.indexOf('Sold At')], notes: sold[H.indexOf('Notes')], date: sold[H.indexOf('Date Sold')],
        coll: S.get(PERSONAL_TAB + '!A3:BZ').filter(r => r.length).length, fs: S.get('For Sale!A3:J').filter(r => r.length).length,
        bin: S.get("'Deleted Rows'!A3:BZ").map(l => [l[1], l[3]]) };
    });
    T('G the wizard sale saved', gRes === 'done', gRes);
    T('G its Sold row carries Sold To, Sold At and the notes', G.to === 'C-1700000000002' && G.at === 'eBay' && G.notes === 'shipped Priority', G);
    const gTag = '[sale 7 ' + G.date + ']';
    T('G the collection row and the listing went to Deleted Rows under the sale\'s tag', G.coll === 0 && G.fs === 0
      && G.bin.some(l => l[0] === 'My Collection' && l[1].indexOf(gTag) >= 0) && G.bin.some(l => l[0] === 'For Sale' && l[1].indexOf(gTag) >= 0), G);
    await pg.evaluate(() => { const S = window.__S, H = SOLD_HEADERS;
      const rows = S.get('Sold!A3:' + soldEndCol()); const i = rows.findIndex(r => r[0] === '2343');
      state.soldData = { 'sold-w': { row: 3 + i, key: 'sold-w', itemNum: '2343', variation: '', inventoryId: '7', dateSold: rows[i][H.indexOf('Date Sold')], salePrice: '400' } };
      window.__asked = false; window.appPrompt = async () => { window.__asked = true; return '1'; }; });
    await pg.evaluate(() => rrSaleReturned('sold-w'));
    const G2 = await pg.evaluate(() => { const S = window.__S;
      return { coll: S.get(PERSONAL_TAB + '!A3:BZ').filter(r => r.length), fs: S.get('For Sale!A3:J').filter(r => r.length),
        sold: S.get('Sold!A3:A').filter(r => r.length && r[0] === '2343').length, asked: window.__asked }; });
    T('G Returned puts the wizard sale back — the row exactly, the listing, no question asked', G2.coll.length === 1 && JSON.stringify(G2.coll[0]) === JSON.stringify(world0.collRow)
      && G2.fs.length === 1 && G2.fs[0][3] === '450' && G2.sold === 0 && G2.asked === false, G2);

    // ── H · the places remember: most-used first, spelled the way he uses most ──
    const H = await pg.evaluate(() => {
      const keep = state.soldData;
      try { localStorage.removeItem('lv_show_session'); } catch (e) {}
      state.soldData = {
        a: { soldAt: 'eBay', dateSold: '2026-01-01' }, b: { soldAt: 'ebay', dateSold: '2026-02-01' }, c: { soldAt: 'eBay', dateSold: '2026-03-01' },
        d: { soldAt: 'Greenberg Show', dateSold: '2026-09-30' }, e: { soldAt: 'York Train Show', dateSold: '2026-04-01' }, f: { soldAt: 'York Train Show', dateSold: '2026-05-01' },
        g: { soldAt: 'Uncle Joe', dateSold: '2026-08-01' },
      };
      const out = rrSaleSoldAtPlaces();
      state.soldData = keep;
      try { localStorage.setItem('lv_show_session', JSON.stringify({ name: 'Timonium Show', date: new Date().toLocaleDateString('en-CA') })); } catch (e) {}
      return out;
    });
    T('H most-used first (ties: most recent), each once, then the starting places he has not used',
      JSON.stringify(H) === JSON.stringify(['eBay', 'York Train Show', 'Greenberg Show', 'Uncle Joe', 'Flea market', 'Marketplace']), H);

    // ── F · the sold item's page ──
    await pg.evaluate(() => {
      state.soldData = {
        's-a': { row: 7, key: 's-a', itemNum: '2343', salePrice: '425', dateSold: '2026-10-14', soldTo: 'C-1700000000001', soldAt: 'Timonium Show', inventoryId: '7' },
        's-p': { row: 8, key: 's-p', itemNum: 'PART', salePrice: '5', dateSold: '2026-10-14', notes: 'Part from Parts Bin — coupler' },
      };
    });
    const F1 = await pg.evaluate(() => { showSoldDetailPage('s-a'); const c = document.getElementById('item-detail-content'); return { text: c.textContent, ret: !!c.querySelector('button[onclick^="rrSaleReturned"]') }; });
    T('F the sold page names the buyer and the place, and has Returned', /Sold To\s*Bob Smith/.test(F1.text) && /Sold At\s*Timonium Show/.test(F1.text) && F1.ret, F1.text.slice(0, 400));
    const F2 = await pg.evaluate(() => { showSoldDetailPage('s-p'); return !!document.querySelector('#item-detail-content button[onclick^="rrSaleReturned"]'); });
    T('F a part\'s sale has no Returned button', F2 === false);
    const F3 = await pg.evaluate(() => { showPage('sold'); buildSoldPage(); return document.getElementById('page-sold').textContent; });
    T('F the Sold list shows who and where', /to Bob Smith · Timonium Show/.test(F3), F3.slice(0, 300));

    T('no page errors', errs.length === 0, errs);
    await pg.close();

    // ── PLANTED: the old blanking line ──
    const p = await boot(browser, plantedOldBlank());
    await seed(p.pg);
    await markSold(p.pg);
    await p.pg.click('#rr-sale-dlg [data-sale="ok"]');
    await p.pg.evaluate(() => window.__p);
    const kept = await p.pg.evaluate(() => window.__S.get("'Deleted Rows'!A3:BZ").some(l => l[1] === 'My Collection'));
    T('B PLANTED: the old blanking line keeps no copy of the collection row (B would fail)', kept === false);
    await p.pg.close();
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('SALE DETAILS TESTS FAILING'); process.exit(1); }
  console.log('ALL SALE DETAILS TESTS GREEN (' + pass + ')');
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
