#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// command_id_pick_tests.js — 2026-11-02 (maintenance chat; real Chromium, the
// REAL app, a stand-in My Collection sheet that records every write)
//
// [stated] Brad (on the Command ID box with its three boxes): "we need to just
// show what each engine has not a box for all three, lionel and atlas engines
// will always be tmcc/legacy, mth has dcc [DCS — confirmed], the ho and n and
// others may be dcc or other. so we just need a drop down to show the 4 and
// then a box to enter it." → "yes" to TMCC / Legacy, DCS, DCC, Other.
//
//   A  where the drop-down starts: the system the copy already has a number
//      for; else what the catalog says; else the maker's — Lionel and Atlas →
//      TMCC / Legacy, MTH → DCS; anything else (HO, N, Bachmann, Kato) → DCC.
//      PLANTED: the maker list emptied → the Lionel / Atlas / MTH starts go
//      red (the check can fail).
//   B  an engine on TWO systems (TMCC 12 + DCS 7): the drop-down shows each
//      system's own number; changing DCS keeps TMCC. PLANTED: a served
//      command-ids.js that keeps only the shown system's number → TMCC is
//      lost and the check goes red.
//   C  "Other": its own END column; the card says OTHER 5; "other 5" finds
//      it; the Command ID report lists it; a spreadsheet's "Other ID" /
//      "Other Command ID" column maps to it; two engines on Other 5 are warned
//      about each other.
//
// Run:  node tests/command_id_pick_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  command_id_pick_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

const MASTER = [
  { itemNum: '6-84631', variation: '', itemType: 'Diesel Locomotive', control: 'Legacy/CC', description: 'GP9 Diesel Locomotive', roadName: 'Santa Fe', yearProd: '2019', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '6-29000', variation: '', itemType: 'Boxcar', description: 'Boxcar', roadName: 'Erie', yearProd: '2001', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '6-18000', variation: '', itemType: 'Diesel Locomotive', description: 'GP7 Diesel', roadName: 'Erie', yearProd: '2001', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '20-2000-1', variation: '', itemType: 'Diesel Locomotive', description: 'SD70 Diesel', roadName: 'BNSF', yearProd: '2008', _era: 'mth', _tab: 'MTH O' },
  { itemNum: '51605', variation: '', itemType: 'Diesel Locomotive', description: 'GP7 Diesel', roadName: 'Chessie', yearProd: '2010', _era: 'bachmann_ho', _tab: 'Bachmann HO' },
];
const P = (n, inv, row, x) => Object.assign({ itemNum: n, variation: '', owned: true, inventoryId: inv, row: row, manufacturer: 'Lionel', condition: '8' }, x || {});
const PD = {
  '201': P('6-18000', '201', 3),                                              // Lionel, catalog silent
  '202': P('20-2000-1', '202', 4, { manufacturer: 'MTH' }),                  // MTH, catalog silent
  '203': P('51605', '203', 5, { manufacturer: 'Bachmann' }),                 // HO
  '204': P('6-84631', '204', 6, { dcsId: '7' }),                             // Legacy in the catalog, but the copy holds DCS 7
  '205': P('6-84631', '205', 7, { tmccId: '12', dcsId: '7' }),               // two systems
  '206': P('6-29000', '206', 8, { otherCmdId: '5' }),                        // a car already on Other 5
};

async function open(browser, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    for (const f of Object.keys(o.swap || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: o.swap[f], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  await pg.evaluate(({ master, pd }) => {
    try { _aiUsageMarkSeen(); } catch (e) {}
    try { localStorage.clear(); } catch (e) {}
    state.masterData = master.slice(); try { _rebuildMasterIndex(); } catch (e) {}
    state.masterAllRows = master.slice();
    state.personalData = JSON.parse(JSON.stringify(pd));
    state.personalSheetId = 'SHEET';
    window.__toasts = []; window.showToast = function (m) { window.__toasts.push(String(m)); };
    window.__confirms = []; window.__answers = [];
    window.appConfirm = async function (msg, opts) { window.__confirms.push(String(msg)); return window.__answers.length ? window.__answers.shift() : true; };
    window.__sheet = {}; window.__writes = [];
    const cellOf = v => v == null ? '' : String(v).replace(/^'/, '');
    Object.values(state.personalData).forEach(p => { window.__sheet[p.row] = rrRecordRow(p).map(cellOf); });
    const toIdx = s => { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
    window.sheetsGet = async (id, rg) => { const m = /!A(\d+):/.exec(rg); return { values: [(window.__sheet[+m[1]] || []).slice()] }; };
    window.sheetsUpdate = async (id, rg, vals) => {
      window.__writes.push(rg);
      const m = /!([A-Z]+)(\d+)(?::([A-Z]+)\d+)?$/.exec(rg);
      const row = window.__sheet[+m[2]] = window.__sheet[+m[2]] || [];
      vals[0].forEach((v, i) => { row[toIdx(m[1]) + i] = cellOf(v); });
    };
    window.loadPersonalData = async () => {};
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
    // the drop-down, worked the way a person works it
    window.__setId = (k, v) => { const sel = document.getElementById('cmdid-in-sys'); sel.value = k; sel.dispatchEvent(new Event('change', { bubbles: true })); const n = document.getElementById('cmdid-in-num'); n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); };
    window.__openCard = async (inv) => {
      const pdx = state.personalData[inv];
      const idx = state.masterData.findIndex(m => m.itemNum === pdx.itemNum);
      showItemDetailPage(idx, inv); await new Promise(r => setTimeout(r, 100));
      const b = document.getElementById('cmdid-add') || document.getElementById('cmdid-show');
      if (!b) return false;
      b.click(); await new Promise(r => setTimeout(r, 50));
      return !!document.getElementById('cmdid-in-sys');
    };
  }, { master: MASTER, pd: PD });
  return { pg, ctx, errs };
}

// where the drop-down starts, read off the real card (falls back to the
// function for a row the era decider does not offer)
const startsOf = pg => pg.evaluate(async () => {
  const out = {};
  for (const inv of ['201', '202', '203', '204']) {
    const opened = await window.__openCard(inv);
    out[inv] = opened ? document.getElementById('cmdid-in-sys').value + '=' + document.getElementById('cmdid-in-num').value : 'NOT OFFERED';
  }
  // makers the stand-in catalog has no row for: the same rule, asked directly
  const k = w => rrCmdIdStartKey({}, null, rrCmdIdMakerKey(null, null, [w]));
  out.atlas = k('Atlas O'); out.kato = k('Kato'); out.lionel = k('Lionel'); out.mthWords = k("Mike's Train House"); out.none = k('');
  return out;
});

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    const { pg, ctx, errs } = await open(browser);

    console.log('\n== A · where the drop-down starts ==');
    const st = await startsOf(pg);
    T('A1 a Lionel engine the catalog says nothing about → TMCC / Legacy', st['201'] === 'tmccId=', st);
    T('A2 an MTH engine the catalog says nothing about → DCS', st['202'] === 'dcsId=', st);
    T('A3 an HO Bachmann engine → DCC', st['203'] === 'dccAddress=', st);
    T('A4 a copy that already holds a DCS number opens on DCS with it, even where the catalog says Legacy', st['204'] === 'dcsId=7', st);
    T('A5 by maker name: Atlas O → TMCC / Legacy, Lionel → TMCC / Legacy, "Mike\'s Train House" → DCS, Kato → DCC, no maker → DCC',
      st.atlas === 'tmccId' && st.lionel === 'tmccId' && st.mthWords === 'dcsId' && st.kato === 'dccAddress' && st.none === 'dccAddress', st);
    const opts = await pg.evaluate(() => Array.from(document.getElementById('cmdid-in-sys').options).map(o => o.textContent).join('|'));
    T('A6 the four choices, in Brad\'s words: TMCC / Legacy, DCS, DCC, Other', opts === 'TMCC / Legacy|DCS|DCC|Other', opts);
    const plantA = await pg.evaluate(() => {
      const keep = RR_CMDID.makerSys; RR_CMDID.makerSys = {};
      const k = w => rrCmdIdStartKey({}, null, rrCmdIdMakerKey(null, null, [w]));
      const r = { lionel: k('Lionel'), atlas: k('Atlas O'), mth: k('MTH') };
      RR_CMDID.makerSys = keep; return r;
    });
    T('A7 PLANTED: the maker list emptied → Lionel, Atlas and MTH all start on DCC (A1, A2, A5 would go red)', plantA.lionel === 'dccAddress' && plantA.atlas === 'dccAddress' && plantA.mth === 'dccAddress', plantA);

    console.log('\n== B · an engine on two systems ==');
    const two = async (p) => p.evaluate(async () => {
      const out = {};
      await window.__openCard('205');
      out.first = document.getElementById('cmdid-in-sys').value + '=' + document.getElementById('cmdid-in-num').value;
      const sel = document.getElementById('cmdid-in-sys'); sel.value = 'dcsId'; sel.dispatchEvent(new Event('change', { bubbles: true }));
      out.dcsShown = document.getElementById('cmdid-in-num').value;
      sel.value = 'dccAddress'; sel.dispatchEvent(new Event('change', { bubbles: true }));
      out.dccShown = document.getElementById('cmdid-in-num').value;
      window.__setId('dcsId', '8');
      window.__answers = [true];
      out.saved = await rrCmdIdSave(); await new Promise(r => setTimeout(r, 60));
      const F = PERSONAL_FIELD_INDEX, row = window.__sheet[7];
      out.cells = [row[F.tmccId], row[F.dcsId], row[F.dccAddress], row[F.otherCmdId]].join('|');
      out.card = document.getElementById('cmdid-card').textContent.replace(/\s+/g, ' ').trim();
      return out;
    });
    const b = await two(pg);
    T('B1 it opens on its first system with that number (TMCC / Legacy 12)', b.first === 'tmccId=12', b);
    T('B2 switching the drop-down shows that system\'s own number (DCS 7); a system with none shows an empty box', b.dcsShown === '7' && b.dccShown === '', b);
    T('B3 DCS changed to 8 and saved → TMCC 12 is kept; both show on the card', b.saved === true && b.cells === '12|8||' && /LEGACY \/ TMCC\s*12/.test(b.card) && /DCS\s*8/.test(b.card), b);
    {
      const src = read('command-ids.js');
      const anchor = "fs.map(function (f) { return '<input type=\"hidden\"";
      const bad = src.replace(anchor, "fs.filter(function (f) { return f.key === start; }).map(function (f) { return '<input type=\"hidden\"");
      let pb = { cells: 'not planted' };
      if (bad !== src) { const w = await open(browser, { swap: { 'command-ids.js': bad } }); pb = await two(w.pg); await w.ctx.close(); }
      T('B4 PLANTED: a box that keeps only the shown system\'s number → TMCC 12 is lost (B3 goes red)', pb.cells !== 'not planted' && pb.cells !== '12|8||', pb);
    }

    console.log('\n== C · Other ==');
    const c = await pg.evaluate(async () => {
      const out = {};
      await window.__openCard('201');
      window.__setId('otherCmdId', '5');
      window.__confirms.length = 0; window.__answers = [true];
      out.saved = await rrCmdIdSave(); await new Promise(r => setTimeout(r, 60));
      const F = PERSONAL_FIELD_INDEX, row = window.__sheet[3];
      out.cell = row[F.otherCmdId];
      out.lastCol = PERSONAL_SCHEMA[PERSONAL_SCHEMA.length - 1].field + '=' + PERSONAL_SCHEMA[PERSONAL_SCHEMA.length - 1].header;
      out.card = document.getElementById('cmdid-card').textContent.replace(/\s+/g, ' ').trim();
      out.asked = window.__confirms.slice();
      const q = rrCmdIdQuery('other 5');
      out.found = Object.values(state.personalData).filter(p => rrCmdIdMatches(p, q)).map(p => p.inventoryId).sort().join(',');
      out.anyId = Object.values(state.personalData).filter(p => rrCmdIdMatches(p, rrCmdIdQuery('ID 5'))).map(p => p.inventoryId).sort().join(',');
      out.report = rrCmdIdReportDef().colOrder.join(',');
      // (one spreadsheet column per field — so each heading in its own sheet)
      try { out.imp = [rrImpHeuristicMap(['Item #', 'Other ID']).map['other id'], rrImpHeuristicMap(['Item #', 'Other Command ID']).map['other command id']].join(','); } catch (e) { out.imp = 'ERR ' + e.message; }
      return out;
    });
    T('C1 "Other" saved → its own column, the LAST on the sheet ("Other Command ID")', c.saved === true && c.cell === '5' && c.lastCol === 'otherCmdId=Other Command ID', c);
    T('C2 the card says OTHER 5', /OTHER\s*5/.test(c.card), c.card);
    T('C3 "other 5" finds it (and the car already on Other 5); "ID 5" too', c.found === '201,206' && c.anyId === '201,206', c);
    T('C4 the Command ID report has the Other column', /dccAddress,otherCmdId,location/.test(c.report), c.report);
    T('C5 a spreadsheet\'s "Other ID" / "Other Command ID" column maps to it', c.imp === 'otherCmdId,otherCmdId', c.imp);
    T('C6 an engine and a car both on the track, both Other 5 → warned, in plain words', c.asked.length === 1 && /6-29000 .*is also set to Other 5\. Both will answer the remote\./.test(c.asked[0]), c.asked);
    T('Z  no page errors', errs.length === 0, errs);
    await ctx.close();
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED  —  ' : 'ALL PASS  —  ') + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  suite crashed: ' + (e && e.stack || e)); console.log('FAILED  —  ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
