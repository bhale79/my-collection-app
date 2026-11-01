#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// COMMAND IDs — THE ADD STEPS, THE REPORT, THE IMPORT, A PRO MOVE
// (2026-10-31; real Chromium, the REAL app; Sheets / Drive stood in for and
// RECORDING what they were asked to write)
//
// [stated] Brad 2026-10-31 16:02 CT "i think the add "command id" button be on
// all modern items" + "the report needs to filter items that have a command id".
//   W  the Add steps' Purchase & Value: the small "＋ Add command ID" button on
//      a Modern engine, car and accessory; none on a Postwar or Pre-war item,
//      nor a Modern-numbered item whose era was set to Postwar by hand; tap →
//      the three boxes (the catalog hint too); Done → the numbers; the plain
//      user-field boxes never carry them; the save writes them into the three
//      END columns of the item's row; ignored → nothing written, nothing asked
//   R  the Command ID report lists every item WITH an ID (an engine, a car, an
//      accessory) and nothing else (an engine without one is out), sorted by
//      system then number, with where it is kept; its Edit opens the builder
//      with "Has a Command ID: Yes" — a real filter, on any report
//   I  the import maps "TMCC ID", "DCS", "DCC Address" to the new columns
//   M  a TRR Pro move carries the IDs to the other collection
//   P  planted: the report without its filter lists an item with no ID; the
//      Add button on a Postwar item
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  command_ids_add_report_tests needs playwright and it is not installed.'); process.exit(1); }
const { boot: collBoot, openColl } = require('./lib/coll-world');
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

const MASTER = [
  { itemNum: '6-84631', variation: '', itemType: 'Diesel Locomotive', control: 'Legacy/CC', description: 'GP9 Diesel Locomotive', roadName: 'Santa Fe', yearProd: '2019', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '6-29000', variation: '', itemType: 'Boxcar', description: 'Boxcar', roadName: 'Erie', yearProd: '2001', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '6-14111', variation: '', itemType: 'Accessory', description: 'Operating Gateman', yearProd: '2001', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', description: 'F-3 A unit', roadName: 'Santa Fe', yearProd: '1950', _era: 'pw', _tab: 'Lionel PW - Items' },
  { itemNum: '262', variation: '', itemType: 'Steam Locomotive', description: '2-4-2 steam', yearProd: '1931', _era: 'prewar', _tab: 'Lionel Pre-War' },
  { itemNum: '30-2140-1', variation: '', itemType: 'Steam Locomotive', description: '4-6-2 Pacific with Proto-Sound 2.0', roadName: 'Pennsylvania', yearProd: '2004', _era: 'mth', _tab: 'MTH O' },
  { itemNum: '6-17000', variation: '', itemType: 'Caboose', description: 'Caboose', roadName: 'Erie', yearProd: '1999', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '6-84632', variation: '', itemType: 'Diesel Locomotive', description: 'GP9 B unit', roadName: 'Santa Fe', yearProd: '2019', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
];
const P = (n, inv, row, x) => Object.assign({ itemNum: n, variation: '', owned: true, inventoryId: inv, row: row, manufacturer: 'Lionel', condition: '8' }, x || {});
const PD = {
  '201': P('6-84631', '201', 3, { tmccId: '20', location: 'Layout room' }),
  '202': P('6-29000', '202', 4, { tmccId: '3', location: 'Shelf A' }),
  '203': P('6-14111', '203', 5, { tmccId: '12', location: 'Layout room' }),
  '204': P('6-17000', '204', 6, { dcsId: '5' }),
  '205': P('30-2140-1', '205', 7, { dccAddress: '3', manufacturer: 'MTH' }),
  '206': P('6-84632', '206', 8),                       // an engine WITHOUT an ID — never on the report
  '207': P('2343', '207', 9),
};

async function open(browser, swap) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    for (const f of Object.keys(swap || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: swap[f], contentType: 'application/javascript' });
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
    state.personalSheetId = 'SHEET'; state.isData = {};
    _currentEra = 'all';
    window.__appended = []; window.__toasts = []; window.__confirms = [];
    window.sheetsAppend = async (id, range, rows) => { window.__appended.push(rows[0]); return 100 + window.__appended.length; };
    window.rrVerifiedRowUpdate = async () => true; window.rrRowStillIs = async () => true;
    window.driveEnsureSetup = async () => {}; window.driveEnsureItemFolder = async (n) => 'FOLDER-' + n; window.driveUploadPhoto = async () => ({});
    window.buildDashboard = () => {}; window.loadPersonalData = async () => {};
    window.showToast = (m) => { window.__toasts.push(String(m)); };
    window.appConfirm = async (m) => { window.__confirms.push(String(m)); return true; };
    window.rrMaybeShowAddHelp = () => {};
    const au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  }, { master: MASTER, pd: PD });
  return { pg, ctx, errs };
}

// The Purchase & Value step for one catalog row, drawn by the real wizard.
const pvStep = (pg, num, extra) => pg.evaluate(async ([num, extra]) => {
  const S = ms => new Promise(r => setTimeout(r, ms));
  // (a fresh wizard each time — closing one walks the browser history back)
  { const wm = document.getElementById('wizard-modal'); if (wm) wm.classList.remove('open'); }
  await openWizard('collection'); await S(60);
  const m = state.masterData.find(x => x.itemNum === num);
  Object.assign(wizard.data, { itemNum: num, variation: '', condition: 8, allOriginal: 'Yes', hasBox: 'No', _itemGrouping: 'single', tenderMatch: 'none', setMatch: '', _era: m._era }, extra || {});
  wizard.matchedItem = m;
  wizard.steps = getSteps('collection');
  wizard.step = wizard.steps.findIndex(s => s.id === 'purchaseValue');
  renderWizardStep(); await S(80);
  const step = wizard.steps[wizard.step] && wizard.steps[wizard.step].id;
  const body = document.getElementById('wizard-modal');
  return { step, btn: !!document.getElementById('wiz-cmdid-add'), box: !!document.getElementById('wiz-cmdid'),
           plain: !!(body && body.querySelector('#wiz-uf-tmccId, #wiz-uf-dcsId, #wiz-uf-dccAddress')) };
}, [num, extra || null]);

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const t0 = Date.now();
  const { pg, ctx, errs } = await open(browser);

  console.log('\n== W · the Add steps ==');
  const w = {};
  for (const [k, n, x] of [['engine', '6-84631'], ['car', '6-29000'], ['acc', '6-14111'], ['postwar', '2343'], ['prewar', '262'], ['override', '6-84631', { eraPeriod: 'postwar' }]]) w[k] = await pvStep(pg, n, x);
  T('W1 Purchase & Value: the small button on a Modern engine, car and accessory', ['engine', 'car', 'acc'].every(k => w[k].step === 'purchaseValue' && w[k].btn), w);
  T('W2 none on a Postwar or Pre-war item, nor a Modern-numbered item whose era was set to Postwar by hand', ['postwar', 'prewar', 'override'].every(k => w[k].step === 'purchaseValue' && !w[k].box), w);
  T('W3 the plain user-field boxes never draw the IDs', Object.values(w).every(x => !x.plain));
  const ws = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    const out = {};
    // ignored → nothing written
    window.__appended.length = 0;
    await saveWizardItem(); await S(80);
    const F = PERSONAL_FIELD_INDEX;
    const cells = r => [r[F.dcsId], r[F.tmccId], r[F.dccAddress]].map(v => String(v == null ? '' : v)).join('|');
    out.ignored = window.__appended.length ? cells(window.__appended[0]) : 'NO ROW';
    out.ignoredAsked = window.__confirms.length;
    return out;
  });
  // (the last step drawn was the Postwar-override engine; draw the plain Modern engine again)
  await pvStep(pg, '6-84631');
  const wt = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    const out = {};
    document.getElementById('wiz-cmdid-add').click(); await S(50);
    out.order = Array.from(document.querySelectorAll('#wiz-cmdid input')).map(i => i.getAttribute('data-cmdid-key')).join(',');
    out.hint = (document.querySelector('#wiz-cmdid .rr-cmdid-hint') || {}).textContent || '';
    const set = (k, v) => { const el = document.getElementById('wiz-cmdid-' + k); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    set('tmccId', '0031'); set('dccAddress', '4401');
    window.__confirms.length = 0;
    await rrCmdIdWizDone(); await S(40);
    out.summary = (document.getElementById('wiz-cmdid') || {}).textContent.replace(/\s+/g, ' ').trim();
    out.asked = window.__confirms.length;
    window.__appended.length = 0;
    await saveWizardItem(); await S(80);
    const F = PERSONAL_FIELD_INDEX, r = window.__appended[0] || [];
    out.cells = [r[F.dcsId], r[F.tmccId], r[F.dccAddress]].map(v => String(v == null ? '' : v)).join('|');
    out.endCols = PERSONAL_SCHEMA.slice(-3).map(s => s.field).join(',');
    out.rows = window.__appended.length;
    const saved = Object.values(state.personalData).find(p => p.tmccId === '31');
    out.record = saved ? [saved.itemNum, saved.tmccId, saved.dccAddress].join('|') : 'none';
    return out;
  });
  await pvStep(pg, '6-84632');
  const wc = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    document.getElementById('wiz-cmdid-add').click(); await S(40);
    document.getElementById('wiz-cmdid-tmccId').value = '20';
    window.__confirms.length = 0;
    window.appConfirm = async (m) => { window.__confirms.push(String(m)); return false; };   // "Change this one"
    const done = await rrCmdIdWizDone(); await S(30);
    return { done, asked: window.__confirms.slice(), open: !!document.getElementById('wiz-cmdid-tmccId'), focus: document.activeElement && document.activeElement.id };
  });
  T('W4 ignoring the button changes nothing: no ID written, nothing asked', ws.ignored === '||' && ws.ignoredAsked === 0, ws);
  T('W5 tap → the three boxes, the catalog hint first ("Catalog: Legacy")', wt.order === 'tmccId,dcsId,dccAddress' && wt.hint === 'Catalog: Legacy', wt);
  T('W6 Done → the numbers in place of the boxes ("0031" kept as 31)', /LEGACY \/ TMCC\s*31/.test(wt.summary) && /DCC\s*4401/.test(wt.summary) && wt.asked === 0, wt);
  T('W7 the save writes them into the three END columns of the item\'s own row', wt.endCols === 'dcsId,tmccId,dccAddress' && wt.cells === '|31|4401' && wt.rows === 1 && wt.record === '6-84631|31|4401', wt);
  T('W8 the Add steps warn about a clash too, and "Change this one" keeps the boxes open on it', wc.done === false && wc.asked.length === 1 && /6-84631 Santa Fe Diesel is also set to TMCC \/ Legacy 20/.test(wc.asked[0]) && wc.open && wc.focus === 'wiz-cmdid-tmccId', wc);

  console.log('\n== R · the Command ID report ==');
  const rp = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    { const wm = document.getElementById('wizard-modal'); if (wm) wm.classList.remove('open'); }
    // only the stand-in copies (the W save added one)
    Object.keys(state.personalData).forEach(k => { if (!/^20[1-7]$/.test(k)) delete state.personalData[k]; });
    showPage('reports'); await S(60);
    if (typeof renderReportLibrary === 'function') renderReportLibrary();
    const lib = (document.getElementById('report-library') || {}).textContent || '';
    _repSetType('cmdids'); buildReport(); await S(60);
    const head = Array.from(document.querySelectorAll('#report-thead th')).map(t => t.textContent.trim());
    const rows = Array.from(document.querySelectorAll('#report-tbody tr')).map(tr => Array.from(tr.children).map(td => td.textContent.trim()));
    const edit = document.getElementById('rep-edit-cmdids');
    if (edit) edit.click(); await S(120);
    const ov = document.getElementById('rb-overlay');
    let filt = '', match = '';
    if (ov) {
      _rbShowTab('filters'); await S(60);
      const sel = Array.from(ov.querySelectorAll('[data-rb-yn="hasCmdId"].selected')).map(x => x.getAttribute('data-rb-val'));
      filt = sel.join(','); match = (document.getElementById('rb-match-top') || {}).textContent || '';
      _rbCloseOverlay();
    }
    return { lib: /Command ID Report/.test(lib) && /Only the items that have a Command ID/.test(lib), head, rows, editOpened: !!ov, filt, match, name: (REPORT_DEFS.find(d => d.id === 'cmdids') || {}).name };
  });
  const nums = rp.rows.map(r => r[0]);
  T('R1 the Reports page lists the "Command ID Report"', rp.lib && rp.name === 'Command ID Report', rp);
  T('R2 columns: item number, type, road name, description, the three IDs and where it is kept', rp.head.slice(0, 7).join('|') === 'Item #|Type|Road Name|Description|TMCC / Legacy ID|DCS ID|DCC Address' && rp.head.includes('Location'), rp.head);
  T('R3 only the items WITH an ID: the engine, the car, the accessory, the caboose, the MTH — the engine without one is out (and the Postwar one with none)', nums.length === 5 && !nums.includes('6-84632') && !nums.includes('2343'), rp.rows);
  T('R4 sorted by system then number: TMCC 3, 12, 20 → DCS 5 → DCC 3', nums.join(',') === '6-29000,6-14111,6-84631,6-17000,30-2140-1', nums);
  T('R5 Edit opens the builder on it, with "Has a Command ID: Yes" — a real filter (5 of 7 match)', rp.editOpened && rp.filt === 'Yes' && /5 of your 7 items match/.test(rp.match), rp);

  console.log('\n== I · the import ==');
  const im = await pg.evaluate(() => {
    const r = rrImpHeuristicMap(['Item #', 'TMCC ID', 'DCS', 'DCC Address', 'Legacy']);
    const r2 = rrImpHeuristicMap(['Item Number', 'Legacy ID', 'MTH DCS ID', 'DCC']);
    const staged = rrImpApplyMapping({ name: 'Sheet1', headers: ['Item #', 'TMCC ID'], rows: [{ cells: ['6-84631', '07'], rowIdx: 2 }] }, { 'item #': 'itemNum', 'tmcc id': 'tmccId' });
    return { map: r.map, unmapped: r.unmapped, map2: r2.map, labels: ['tmccId', 'dcsId', 'dccAddress'].map(k => _IMP_FIELD_LABELS[k]).join('|'), staged: staged[0] && staged[0].tmccId, norm: rrCmdIdNorm(staged[0] && staged[0].tmccId, { digits: 5 }).v };
  });
  T('I1 a customer\'s "TMCC ID", "DCS", "DCC Address" columns are pointed at the new columns', im.map['tmcc id'] === 'tmccId' && im.map['dcs'] === 'dcsId' && im.map['dcc address'] === 'dccAddress' && im.unmapped.includes('legacy'), im);
  T('I2 …"Legacy ID", "MTH DCS ID", "DCC" too, and the mapping list names all three', im.map2['legacy id'] === 'tmccId' && im.map2['mth dcs id'] === 'dcsId' && im.map2['dcc'] === 'dccAddress' && im.labels === 'TMCC / Legacy ID|DCS ID|DCC Address', im);
  T('I3 an imported "07" is written as 7 (the one cleaner)', im.staged === '07' && im.norm === '7' && /rrCmdIdNorm\(it\[k\], f\)/.test(read('import-ui.js')), im);
  T('Z  no page errors', errs.length === 0, errs);
  await ctx.close();

  console.log('\n== M · a TRR Pro move carries them ==');
  {
    const { pg: mp, errs: me } = await collBoot(browser);
    await mp.evaluate(() => {
      const F = PERSONAL_FIELD_INDEX;
      const rows = window.__S.S7['My Collection'];
      const r = rows.find(x => x[F.inventoryId] === '47');
      r[F.tmccId] = '12'; r[F.dcsId] = '7'; r[F.dccAddress] = '3';
    });
    await openColl(mp, 'c7');
    const mv = await mp.evaluate(async () => {
      const F = PERSONAL_FIELD_INDEX;
      const k47 = Object.keys(state.personalData).find(k => state.personalData[k].inventoryId === '47');
      const before = [state.personalData[k47].tmccId, state.personalData[k47].dcsId, state.personalData[k47].dccAddress].join('|');
      const m = rrMovePlan([k47], 'c8');
      const r = await rrMoveRun(m);
      const S8 = window.__S.S8['My Collection'];
      const moved = S8.slice(2).find(x => x[F.transferredFrom]);
      return { before, ok: r && r.ok, after: moved ? [moved[F.tmccId], moved[F.dcsId], moved[F.dccAddress]].join('|') : 'NOT MOVED', hdr: S8[1].slice(-3).join('|') };
    });
    T('M1 a moved item keeps its IDs (the move copies the whole row)', mv.before === '12|7|3' && mv.ok && mv.after === '12|7|3', mv);
    T('M2 …and the other collection\'s sheet has the three headings at its end', mv.hdr === 'DCS ID|TMCC / Legacy ID|DCC Address', mv);
    T('Z  no page errors in the move', me.length === 0, me);
    await mp.close();
  }

  console.log('\n== P · planted ==');
  {
    const rs = read('reports.js');
    const noFilter = rs.replace("if (f.hasCmdId && f.hasCmdId!=='Either')", 'if (false)');
    const { pg: p2, ctx: c2 } = await open(browser, noFilter !== rs ? { 'reports.js': noFilter } : {});
    const n2 = await p2.evaluate(async () => { _repSetType('cmdids'); buildReport(); await new Promise(r => setTimeout(r, 60)); return Array.from(document.querySelectorAll('#report-tbody tr')).map(tr => tr.children[0].textContent.trim()); });
    T('P1 the report\'s filter undone → it lists an item with no ID (R3 goes red)', noFilter !== rs && n2.includes('6-84632'), n2);
    await c2.close();
    const cm = read('command-ids.js');
    const anyEra = cm.replace("return rrCmdIdPeriod(wizProbe(d), wizMaster(d)) === 'modern';", 'return true;');
    const { pg: p3, ctx: c3 } = await open(browser, anyEra !== cm ? { 'command-ids.js': anyEra } : {});
    const pw = await pvStep(p3, '2343');
    T('P2 the Add button offered on every era → it shows on a Postwar item (W2 goes red)', anyEra !== cm && pw.btn, pw);
    await c3.close();
  }

  await browser.close();
  console.log('\n(' + Math.round((Date.now() - t0) / 1000) + ' s)');
  console.log('\n' + (fail ? 'FAILED  —  ' : 'ALL PASS  —  ') + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  suite crashed: ' + (e && e.stack || e)); console.log('FAILED  —  ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
