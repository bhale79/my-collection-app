// ══ tests/lib/inbox-roads.js — the Photo Inbox → Add screen roads, as an iPhone ══
//
// v0.9.2053 (Mike, MTH 20-20169-3). The harness shared by
// inbox_add_roads_2053_tests.js (the roads) and inbox_add_roads_planted_2053_tests.js
// (each fix undone in a served copy must turn its road red). Two suites so each
// stays well inside the runner's three-minute limit for a quick suite.
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; } catch (e) { chromium = null; }
const APP = path.join(__dirname, '..', '..', 'app');
const PIN = require('./pin-source');
const SEED = require('./guide-fixture').SEED.replace(/const SHAPE = '[a-z]+';/, "const SHAPE = 'empty';");   // a brand-new user, like Mike
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.split(from).join(to);
}
const PIECES = PIN.pinPieces();   // the Photo Inbox, read the ONE way
// The give-up road is run on a served config.js whose RR_CATALOG_WAIT_MS is short —
// the rule under test is "wait the configured limit, then give up honestly", and
// twenty real seconds would put the suite past the runner's three-minute limit.
const SHORT_WAIT_MS = 2000;
function shortWaitConfig() {
  return plant(read('config.js'), /const RR_CATALOG_WAIT_MS = [^;]+;/.exec(read('config.js'))[0], 'const RR_CATALOG_WAIT_MS = ' + SHORT_WAIT_MS + ';', 'catalog wait');
}
const CT = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html' };

// ── one page: the app, Mike's catalog rows, two photos, the reader's answer ──
async function boot(browser, o, served) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: IPHONE_UA });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await ctx.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://') && !u.startsWith('about:')) return r.abort();
    const name = u.split('?')[0].split('/').pop();
    if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: CT[path.extname(name)] || 'text/plain' });
    return r.continue();
  });
  const b = { ctx, pg, errs };
  await open(b, o, false);
  return b;
}
async function open(b, o, keepHolds) {
  await b.pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await b.pg.waitForTimeout(800);
  await b.pg.evaluate(SEED);
  await b.pg.evaluate((args) => {
    const o = args.o;
    document.getElementById('app').classList.add('active');
    try { localStorage.setItem('lv_user', JSON.stringify(state.user || { email: 'mike@example.com' })); } catch (e) {}
    // Mike's rows, as the master's MTH O tab has them; and Atlas 1303 for the
    // brand-disagreement rule (Brad's Marx girder bridge, v0.9.941)
    const mk = (v, vd, desc) => ({ itemNum: '20-20169-' + v, itemType: 'Diesel Locomotive', roadName: 'CSX', description: desc, gauge: 'O',
      yearProd: '2011', variation: v, varDesc: vd, _era: 'mth_o', _tab: 'MTH O', manufacturer: 'MTH', category: 'Premier' });
    const R = [mk('1', 'Hi-Rail Wheels / w/Proto-Sound 3.0', 'Dash-8 Diesel Engine'), mk('2', 'Scale Wheels / w/Proto-Sound 3.0', 'Dash-8 Diesel Engine'),
               mk('3', 'w/Proto-Sound 3.0', 'Dash-8 Diesel Engine (Non-Powered)'),
               { itemNum: '1303', itemType: 'Accessory', roadName: '', description: 'Girder Bridge', gauge: 'O', variation: '1', _era: 'atlas', _tab: 'Atlas O', manufacturer: 'Atlas' }];
    const idx = new Map(); state.masterData.concat(R).forEach(r => { const k = r.itemNum; if (!idx.has(k)) idx.set(k, []); idx.get(k).push(r); });
    if (o.catalog !== 'loading') {
      // the full-catalog index is complete (the normal state a few seconds after start)
      R.forEach(r => { state.masterData.push(r); const k = r.itemNum; if (!state.masterByItem.has(k)) state.masterByItem.set(k, []); state.masterByItem.get(k).push(r); });
      state.masterByItemAll = idx; window._allIdxComplete = true;
    } else {
      state.masterByItemAll = new Map(); window._allIdxComplete = false; window._allIdxBuilding = true;   // still on its way
      window.__catalogArrives = () => { state.masterByItemAll = idx; window._allIdxComplete = true; window._allIdxBuilding = false; };
    }
    window._scheduleLookupIndex = () => {};   // no Google in the test: the index arrives when the test says so
    localStorage.setItem('rr_inbox_fid', 'INBOXFID'); localStorage.setItem('rr_photoid_help_seen', '1'); localStorage.setItem('rr_pin_help_seen', '1');
    window.driveRequest = async (m, u) => (/\/files\?/.test(String(u)) && /in%20parents|in parents/.test(String(u)))
      ? { files: [{ id: 'm1', name: 'IMG_4001.jpg', mimeType: 'image/jpeg', createdTime: '2026-10-29T12:00:00Z', appProperties: { rrView: 'RSV' } },
                  { id: 'm2', name: 'IMG_4002.jpg', mimeType: 'image/jpeg', createdTime: '2026-10-29T12:00:05Z', appProperties: { rrView: 'LSV' } }] }
      : { id: 'INBOXFID', trashed: false };
    window.driveEnsureItemFolder = async () => 'ITEMFID';
    window.driveFindOrCreateFolder = async () => 'SUBFID';
    window.driveFolderLink = (id) => 'https://drive.google.com/drive/folders/' + id;
    window.loadDriveThumb = () => {};
    if (!o.helpCard) window.rrMaybeShowAddHelp = () => {};
    window.__groups = () => [{ key: 'g1', kind: 'single', files: [
      { id: 'm1', name: 'IMG_4001.jpg', appProperties: { rrView: 'RSV' } }, { id: 'm2', name: 'IMG_4002.jpg', appProperties: { rrView: 'LSV' } }] }];   // view stamps as Drive holds them
    window._pinShared._groups = window.__groups();
    const ids = {};
    if (o.num !== undefined) ids.m1 = Object.assign({ num: o.num, mfr: o.mfr || '', road: 'CSX', desc: 'Dash-8 Diesel Engine' }, o.guess ? { guess: true } : {});
    localStorage.setItem('rr_inbox_ids', JSON.stringify(ids));
    if (!args.keepHolds) { localStorage.removeItem('rr_inbox_setstage'); localStorage.removeItem('rr_inbox_pending'); }
    try { buildDashboard(); } catch (e) {} try { showPage('photo-inbox'); } catch (e) {}
  }, { o, keepHolds });
  await b.pg.waitForTimeout(400);
}
async function card(b) {
  await b.pg.evaluate(() => { window._pinShared._groups = window.__groups(); window._pinReview('g1'); });
  await b.pg.waitForTimeout(350);
  return b.pg.evaluate(() => ({ box: (document.getElementById('pin-rv-num') || {}).value,
    info: ((document.getElementById('pin-rv-info') || {}).innerText || '').replace(/\s+/g, ' ') }));
}
const STATE = `(() => {
  const w = (typeof wizard !== 'undefined' && wizard) || null, s = w && w.steps ? w.steps[w.step] : null;
  const inp = document.getElementById('wiz-input'), m = document.getElementById('wizard-modal');
  const y = document.getElementById('_ac-yes');
  let dlg = null; if (y) { let d = y; while (d && !/\\?|spoken for/i.test(d.innerText || '')) d = d.parentElement; dlg = d ? d.innerText.replace(/\\s+/g, ' ') : ''; }
  return { open: !!(m && m.classList.contains('open')), stepId: s ? s.id : '', itemNum: w && w.data ? (w.data.itemNum || '') : '',
    manualNum: w && w.data ? (w.data.manualItemNum || '') : '', manual: !!(w && w.data && w.data._manualEntry), noNumber: !!(w && w.data && w.data._noNumberEntry),
    matched: w && w.matchedItem ? w.matchedItem.itemNum : '', box: inp ? inp.value : null, views: !!(w && w.data && w.data._addPhotoViews),
    sale: !!(w && w.data && w.data._alsoListForSale), dialog: dlg, cardOpen: !!document.getElementById('pin-review-ov'),
    help: !!document.getElementById('rr-ai-usage-card'),
    toast: Array.from(document.querySelectorAll('.toast, #toast, .rr-toast, [class*=toast]')).map(t => t.innerText).join(' | '),
    stage: JSON.parse(localStorage.getItem('rr_inbox_setstage') || '{}'), pend: JSON.parse(localStorage.getItem('rr_inbox_pending') || '{}') };
})()`;
const st = (b) => b.pg.evaluate(STATE);
const tapAdd = async (b, ms) => { await b.pg.click('#pin-rv-add'); await b.pg.waitForTimeout(ms || 900); };
const spokenFor = (s) => !!(s.dialog && /spoken for/i.test(s.dialog));

// Each road, as a function — run on the real app, and again on planted copies.
const ROADS = {
  async guessYes(br, served) {
    const b = await boot(br, { num: '20-20169-3', mfr: 'MTH', guess: true }, served);
    const c = await card(b); await tapAdd(b, 400); const q = await st(b);
    if (q.dialog) { await b.pg.click('#_ac-yes'); await b.pg.waitForTimeout(900); }
    const a = await st(b); await b.ctx.close(); return { c, q, a };
  },
  async makerSpelled(br, mfr, served) {
    const b = await boot(br, { num: '20-20169-3', mfr: mfr }, served);
    await card(b); await tapAdd(b); const a = await st(b); await b.ctx.close(); return a;
  },
  async family(br, num, served) {
    const b = await boot(br, { num: num, mfr: 'MTH' }, served);
    await card(b); await tapAdd(b, 1200); const a = await st(b); await b.ctx.close(); return a;
  },
  async restart(br, served) {
    const b = await boot(br, { num: '20-20169-3', mfr: 'MTH' }, served);
    await card(b); await tapAdd(b);
    const held = Object.keys((await st(b)).stage);
    await open(b, { num: '20-20169-3', mfr: 'MTH' }, true);          // the iPhone restarted the app
    await card(b); await tapAdd(b, 700); const a = await st(b); await b.ctx.close(); return { held, a };
  },
  async typeSwitch(br, served) {
    const b = await boot(br, { num: '20-20169-3', mfr: 'MTH' }, served);
    await card(b); await tapAdd(b);
    await b.pg.evaluate(() => { wizardBack(); }); await b.pg.waitForTimeout(300);
    const viewsBefore = await b.pg.evaluate(() => !!(wizard.data && wizard.data._addPhotoViews));   // before ANY switch
    await b.pg.evaluate(() => { _wizSetKind('manual'); }); await b.pg.waitForTimeout(400);
    const man = await st(b);
    man.viewsBefore = viewsBefore;
    await b.pg.evaluate(() => { _wizSetKind('cataloged'); }); await b.pg.waitForTimeout(500);
    const a = await st(b); await b.ctx.close(); return { man, a };
  },
  async loading(br, arrive, served) {
    const b = await boot(br, { num: '20-20169-3', mfr: 'MTH', catalog: 'loading' }, served);
    await card(b); await tapAdd(b, 600);
    const during = await st(b);
    if (arrive) { await b.pg.evaluate(() => window.__catalogArrives()); await b.pg.waitForTimeout(1200); }
    else await b.pg.waitForTimeout(SHORT_WAIT_MS + 1500);
    const a = await st(b); await b.ctx.close(); return { during, a };
  },
  async explainer(br, served) {
    const b = await boot(br, { num: '20-20169-3', mfr: 'MTH', helpCard: true }, served);
    await b.pg.evaluate(() => { try { localStorage.clear(); localStorage.setItem('rr_inbox_fid', 'INBOXFID'); localStorage.setItem('rr_photoid_help_seen', '1'); localStorage.setItem('rr_pin_help_seen', '1');
      localStorage.setItem('rr_inbox_ids', JSON.stringify({ m1: { num: '20-20169-3', mfr: 'MTH' } })); } catch (e) {} });
    await card(b); await tapAdd(b, 900);
    const inbox = await st(b);
    await b.pg.evaluate(() => { try { _doCloseWizard(); } catch (e) {} }); await b.pg.waitForTimeout(300);
    await b.pg.evaluate(() => { openWizard('collection'); }); await b.pg.waitForTimeout(900);
    const plain = await st(b); await b.ctx.close(); return { inbox, plain };
  },
  async handMade(br, served) {
    // "Ives" is no maker the app knows and not MTH: the add becomes a hand-made entry
    const b = await boot(br, { num: '20-20169-3', mfr: 'Ives' }, served);
    await card(b); await tapAdd(b);
    const before = await st(b);
    await b.pg.evaluate(async () => {
      window.sheetsAppend = async () => 7; window._cachePersonalData = () => {};
      Object.assign(wizard.data, { manualManufacturer: 'Ives', manualItemType: 'Diesel', manualDesc: 'Dash-8', manualCondition: '7' });
      try { await _saveManualEntry(); } catch (e) { window.__saveErr = String(e && e.message); }
    });
    await b.pg.waitForTimeout(500);
    const a = await st(b); a.saveErr = await b.pg.evaluate(() => window.__saveErr || '');
    await b.ctx.close(); return { before, a };
  },
};


module.exports = { chromium, boot, open, card, st, tapAdd, spokenFor, ROADS, read, plant, PIECES, shortWaitConfig };
