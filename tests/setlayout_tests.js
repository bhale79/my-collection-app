#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ADD-A-SET SCREEN LAYOUT — 2026-11-08 setlayout (real Chromium, the REAL app)
//
// PLAN_2026-11-07_TESTING_FIXES.md item 5. Found by the testing chat on Brad's
// Android phone and his Work Chrome (v0.9.2126/2127):
//   T-2026-11-04-03  phone: the "Do you know the set number?" title is missing
//                    above Yes / No; the set-number box and the Set Box field
//                    run past the right edge of the screen.
//   T-2026-11-01-09  after Back from the manual maker step ("Who made this
//                    item?") the orange "ADDING No. 1511" strip stays on Step 1
//                    and covers the Type / Scale boxes.
//   T-2026-11-04-05  computer: the set-number and set-notes steps show a
//                    sideways scrollbar; the "ADDING No. 2625" strip (the last
//                    piece walked) stays on the notes and summary steps.
// The owners: _syncWizKindBar (the phone title), the 'text' and 'textarea'
// step renderers and the setEntryMode row (the overflow), and
// _renderAddingBannerItem (what the strip names) — all in app/wizard.js.
//
// Checked at phone 390x844 AND 360x780 (Android) and desktop 1400x900:
//   K  "Do you know the set number?" is on screen above Yes / No (and, on a
//      phone, below the Item Type box)
//   F  nothing sideways on "Do you know…", "Identify your set", the set box
//      question and the "My set isn't listed" form
//   N  the set-number step: nothing sideways (box inside the screen, no scroll)
//   E  the set details step: the Set Box field inside the screen
//   W  during the walk the strip names the piece being added
//   O  the notes step: nothing sideways; the strip names the SET, not 2625
//   C  the summary: the strip names the set
//   S  an own set with a name but no number: the strip names it by its name
//   M  "Use 66238 as typed" → "Who made this item?" → Back to Step 1: no strip
//      left behind
//   V  a strip that IS up on Step 1 (an engine waiting for Engine / Engine +
//      Tender) never covers the Manufacturer / Era / Scale / Type boxes — measured
//      on the REAL in-flow strip; the absolutely-placed strip exists only in the
//      planted offender, to prove the check can see a cover
//   P  PLANTED offenders — each fix taken back out in a served copy turns its
//      check red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  setlayout_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const WIZ = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
let pass = 0, fail = 0;
function ok(n, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(extra)));
  cond ? pass++ : fail++;
}
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches wizard.js — update the test');
  const out = src.split(from).join(to);
  if (out === src) throw new Error('planted offender "' + label + '" changed nothing');
  return out;
}

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ANDROID_UA };
const PHONE360 = { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: ANDROID_UA };
const DESK = { viewport: { width: 1400, height: 900 } };

async function openApp(browser, opts, served) {
  const ctx = await browser.newContext(opts);
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await ctx.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const name = u.split('?')[0].split('/').pop();
    if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  await pg.evaluate(() => {
    state.masterData = [
      { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', description: 'F3 Diesel', roadName: 'Santa Fe', _era: 'pw', _tab: 'Lionel PW - Items', gauge: 'O', rowId: 'PW2343' },
      { itemNum: '2625', variation: '', itemType: 'Passenger Car', description: 'Pullman', roadName: 'Irvington', _era: 'pw', _tab: 'Lionel PW - Items', gauge: 'O', rowId: 'PW2625' },
      { itemNum: '773', variation: '', itemType: 'Steam Locomotive', description: 'Hudson', roadName: 'New York Central', _era: 'pw', _tab: 'Lionel PW - Items', gauge: 'O', rowId: 'PW773' },
      { itemNum: '20-66238', variation: '', itemType: 'Boxcar', description: 'Boxcar', roadName: 'Reading', _era: 'mth_o', _tab: 'MTH O', manufacturer: 'MTH', gauge: 'O', rowId: 'MTH66238' },
      { itemNum: '773W', variation: '', itemType: 'Tender', description: 'Tender', roadName: 'New York Central', _era: 'pw', _tab: 'Lionel PW - Items', gauge: 'O', rowId: 'PW773W' },
    ];
    // a long set name on purpose — the strip must cut it, not widen the screen
    state.setData = [{ setNum: '2124W', setName: 'Super Passenger Set With A Very Long Name Indeed', year: '1950', gauge: 'O', items: ['2343', '2625'], alts: [], _era: 'pw' }];
    _rebuildMasterIndex();
    state.personalData = {}; state.mySetsData = {}; state.isData = {}; state.personalSheetId = 'SHEET'; _currentEra = 'all';
    state.user = { name: 'Brad', email: 'brad@example.com' };
    try { localStorage.clear(); } catch (e) {}
    window.showToast = () => {}; window.rrMaybeShowAddHelp = () => {};
    window.sheetsAppend = async () => 300; window.sheetsUpdate = async () => ({});
    window.rrVerifiedRowUpdate = async () => true; window.rrRowStillIs = async () => true;
    window.rrWhereIsRow = async (sid, tab, row) => ({ ok: true, row: row });
    window.driveEnsureSetup = async () => {}; window.driveUploadPhoto = async () => ({});
    window.buildDashboard = () => {}; window.loadPersonalData = async () => {};
    // 773 has a tender, so Step 1 asks Engine Only / Engine + Tender and stays put
    window.getMatchingTenders = function (b) { return String(b) === '773' ? ['773W'] : []; };
    const au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  });
  // the page's own rules forbid eval — the measuring function is installed once
  await pg.evaluate('window.__slMeasure = ' + MEASURE);
  return { ctx, pg, errs };
}

// what one step looks like: sideways overflow, the strip, the title
const MEASURE = `(function () {
  const s = (wizard.steps && wizard.steps[wizard.step]) || {};
  const bd = document.getElementById('wizard-body');
  const br = bd.getBoundingClientRect();
  const cs = getComputedStyle(bd);
  const contentR = br.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth || 0);
  const past = [];
  bd.querySelectorAll('*').forEach(e => {
    const r = e.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && (r.right > contentR + 1 || r.right > window.innerWidth)) past.push((e.id || e.tagName) + '@' + Math.round(r.right));
  });
  const ban = document.getElementById('wizard-adding-banner');
  const t = document.getElementById('wizard-title');
  const tr = t ? t.getBoundingClientRect() : null;
  return {
    step: s.id || '', type: s.type || '',
    sideways: bd.scrollWidth > bd.clientWidth + 1 || document.documentElement.scrollWidth > window.innerWidth + 1,
    past: past.slice(0, 4),
    strip: ban ? ban.textContent.replace(/\\s+/g, ' ').trim() : '',
    title: (t && t.offsetParent && tr.height > 0 && tr.right <= window.innerWidth + 1) ? t.textContent.trim() : '',
    titleBottom: tr ? Math.round(tr.bottom) : -1,
    titleTop: tr ? Math.round(tr.top) : -1,
    kindHeadBottom: (() => { const h = document.getElementById('wizard-kind-head'); if (!h || !h.offsetParent) return -1; return Math.round(h.getBoundingClientRect().bottom); })(),
  };
})`;

// the whole set road on one page: catalog set 2124W, two pieces walked
async function setRoad(pg) {
  return pg.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const m = () => window.__slMeasure();
    const R = {};
    await openWizard('collection'); await sleep(150);
    _wizSetKind('set'); await sleep(200);
    R.knows = m();
    const yes = [...document.querySelectorAll('#wizard-body button')].find(b => b.textContent.trim() === 'Yes');
    R.yesTop = yes ? Math.round(yes.getBoundingClientRect().top) : -1;
    wizard.data.set_knowsNum = 'Yes'; await wizardNext(); await sleep(150);
    const inp = document.getElementById('wiz-input');
    if (inp) { inp.value = '2124W'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    wizard.data.set_num = '2124W'; await sleep(150);
    R.setNum = m();
    await wizardNext(); await sleep(200);
    R.components = m();
    window._confirmSetMatch('2124W'); await sleep(300);
    R.details = m();
    const sb = document.getElementById('se-setbox');
    const lbl = sb && sb.closest('label');
    const lr = lbl ? lbl.getBoundingClientRect() : null;
    R.setBoxInside = !!(lr && lr.left >= 0 && lr.right <= window.innerWidth && lr.right <= document.getElementById('wizard-body').getBoundingClientRect().right);
    const w = document.getElementById('se-worth'); if (w) w.value = '100';
    const fb = document.getElementById('se-full-btn'); if (fb) fb.click(); await sleep(400);
    R.walk = [];
    for (let n = 0; n < 2; n++) {
      R.walk.push(m().strip);
      Object.assign(wizard.data, { condition: 7, allOriginal: 'Yes', hasBox: 'No', tenderMatch: 'none', setMatch: '' });
      try { await saveWizardItem(); } catch (e) { R.err = e.message; }
      await sleep(300);
    }
    for (let k = 0; k < 4 && wizard.steps[wizard.step].id !== 'set_notes'; k++) {
      if (wizard.steps[wizard.step].id === 'set_hasBox') wizard.data.set_hasBox = 'No';
      await wizardNext(); await sleep(150);
    }
    R.notes = m();
    // the set box question, drawn on its own (the walk may have answered it already)
    { const keep = wizard.step, kb = wizard.data.set_hasBox; delete wizard.data.set_hasBox;
      wizard.step = wizard.steps.findIndex(s => s.id === 'set_hasBox'); renderWizardStep(); await sleep(120);
      R.hasBox = m();
      wizard.data.set_hasBox = kb; wizard.step = keep; renderWizardStep(); await sleep(120); }
    await wizardNext(); await sleep(150);
    R.confirm = m();
    try { _doCloseWizard(); } catch (e) {}
    // S — an own set with a name and no number, on its notes step
    await openWizard('collection'); await sleep(120);
    _wizSetKind('set'); await sleep(150);
    Object.assign(wizard.data, { set_knowsNum: 'No', _ownSet: true, _ownSetName: 'My MTH Freight', _ownSetNum: '', itemNum: '30-7777-1' });
    wizard.step = wizard.steps.findIndex(s => s.id === 'set_notes'); renderWizardStep(); await sleep(120);
    R.ownNoNum = m();
    wizard.step = wizard.steps.findIndex(s => s.id === 'set_ownInfo'); renderWizardStep(); await sleep(150);
    R.ownInfo = m();
    try { _doCloseWizard(); } catch (e) {}
    return R;
  });
}

// M — "Use 66238 as typed" → "Who made this item?" → Back to Step 1
// V — an engine waiting for Engine / Engine + Tender: the strip is up on Step 1
async function stepOneRoad(pg) {
  return pg.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const m = () => window.__slMeasure();
    const R = {};
    const filterBoxes = () => [...document.querySelectorAll('#wizard-body select[id^="wiz-search-"]')].filter(e => e.offsetParent);
    const covered = () => {
      const ban = document.getElementById('wizard-adding-banner');
      const b = ban.getBoundingClientRect();
      const out = [];
      filterBoxes().forEach(e => {
        const r = e.getBoundingClientRect();
        const overlap = b.height > 0 && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (overlap || (top && top !== e && !e.contains(top))) out.push(e.id);
      });
      return out;
    };
    await openWizard('collection'); await sleep(200);
    const inp = document.getElementById('wiz-input');
    inp.value = '66238'; inp.dispatchEvent(new Event('input', { bubbles: true })); await sleep(450);
    // the real "Use 66238 as typed" row (MTH 20-66238 only CONTAINS the number)
    const typedRow = document.querySelector('#wiz-suggestions [data-typed-num]');
    R.typedRow = !!typedRow;
    if (typedRow) typedRow.click(); await sleep(600);
    R.maker = m();
    wizardBack(); await sleep(300);
    R.back = m();
    R.backBoxes = filterBoxes().length;
    R.backCovered = covered();
    try { _doCloseWizard(); } catch (e) {}
    await openWizard('collection'); await sleep(200);
    const inp2 = document.getElementById('wiz-input');
    inp2.value = '773'; inp2.dispatchEvent(new Event('input', { bubbles: true })); await sleep(450);
    const row = state.masterData.find(r => r.itemNum === '773');
    selectSuggestion('773', row.roadName, row.itemType, { row: row }); await sleep(300);
    renderWizardStep(); await sleep(200);
    R.held = m();
    R.heldBoxes = filterBoxes().length;
    R.heldCovered = covered();
    try { _doCloseWizard(); } catch (e) {}
    return R;
  });
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    for (const [nm, opts] of [['phone 390', PHONE], ['phone 360', PHONE360], ['desktop 1400', DESK]]) {
      const isPhone = nm !== 'desktop 1400';
      const { ctx, pg, errs } = await openApp(browser, opts);
      if (isPhone) ok('setup ' + nm + ': the app sees a phone', await pg.evaluate(() => !!window.IS_MOBILE_UA), 'IS_MOBILE_UA false');
      const R = await setRoad(pg);
      ok('K  ' + nm + ': "Do you know the set number?" is on screen', R.knows.step === 'set_knowsNum' && R.knows.title === 'Do you know the set number?', R.knows);
      ok('K  ' + nm + ': the question sits above Yes / No', R.knows.titleBottom > 0 && R.yesTop > R.knows.titleBottom, [R.knows.titleBottom, R.yesTop]);
      if (isPhone) ok('K  ' + nm + ': the Item Type box sits above the question (header order)', R.knows.kindHeadBottom > 0 && R.knows.titleTop >= R.knows.kindHeadBottom - 1, [R.knows.kindHeadBottom, R.knows.titleTop]);
      ok('F  ' + nm + ': "Do you know the set number?" — nothing sideways', !R.knows.sideways && R.knows.past.length === 0, R.knows);
      ok('F  ' + nm + ': "Identify your set" — nothing sideways', R.components.step === 'set_components' && !R.components.sideways && R.components.past.length === 0, R.components);
      ok('F  ' + nm + ': "Does it have the original set box?" — nothing sideways', R.hasBox.step === 'set_hasBox' && !R.hasBox.sideways && R.hasBox.past.length === 0, R.hasBox);
      ok('F  ' + nm + ': "My set isn\u2019t listed" form — nothing sideways', R.ownInfo.step === 'set_ownInfo' && !R.ownInfo.sideways && R.ownInfo.past.length === 0, R.ownInfo);
      ok('K  ' + nm + ': no strip before anything is chosen', R.knows.strip === '', R.knows.strip);
      ok('N  ' + nm + ': the set-number step — nothing sideways', R.setNum.step === 'set_num' && !R.setNum.sideways && R.setNum.past.length === 0, R.setNum);
      ok('N  ' + nm + ': the set-number step — no strip while the number is typed', R.setNum.strip === '', R.setNum.strip);
      ok('E  ' + nm + ': the set details step — nothing sideways', R.details.step === 'set_entryMode' && !R.details.sideways && R.details.past.length === 0, R.details);
      ok('E  ' + nm + ': the Set Box field is inside the screen', R.setBoxInside, R.details.past);
      ok('W  ' + nm + ': during the walk the strip names the piece being added', /No\. 2343(?!\d)/.test(R.walk[0] || '') && /No\. 2625(?!\d)/.test(R.walk[1] || ''), R.walk);
      ok('O  ' + nm + ': the notes step — nothing sideways', R.notes.step === 'set_notes' && !R.notes.sideways && R.notes.past.length === 0, R.notes);
      ok('O  ' + nm + ': the notes step — the strip names the set (2124W), not the last piece (2625)', /No\. 2124W/.test(R.notes.strip) && /Super Passenger Set/.test(R.notes.strip) && !/2625/.test(R.notes.strip), R.notes.strip);
      ok('C  ' + nm + ': the summary — the strip names the set, not 2625', R.confirm.type === 'confirm' && /No\. 2124W/.test(R.confirm.strip) && !/2625/.test(R.confirm.strip) && !R.confirm.sideways, R.confirm);
      ok('S  ' + nm + ': an own set with no number — the strip names it by its name', /My MTH Freight/.test(R.ownNoNum.strip) && !/No\./.test(R.ownNoNum.strip) && !/30-7777/.test(R.ownNoNum.strip), R.ownNoNum.strip);
      ok('setup ' + nm + ': the walk saved without an error', !R.err, R.err);
      const M = await stepOneRoad(pg);
      ok('M  ' + nm + ': setup — the "Use 66238 as typed" row is offered', M.typedRow, M.typedRow);
      ok('M  ' + nm + ': "Who made this item?" names the number typed', M.maker.step !== 'itemNumGrouping' && /No\. 66238(?!\d)/.test(M.maker.strip), M.maker);
      ok('M  ' + nm + ': Back to Step 1 — no strip left behind', M.back.type === 'itemNumGrouping' && M.back.strip === '', M.back);
      ok('M  ' + nm + ': Back to Step 1 — the filter boxes are there and uncovered', M.backBoxes >= 3 && M.backCovered.length === 0, [M.backBoxes, M.backCovered]);
      ok('V  ' + nm + ': a held engine on Step 1 shows its strip', M.held.type === 'itemNumGrouping' && /No\. 773(?!\d)/.test(M.held.strip), M.held);
      ok('V  ' + nm + ': …and the strip covers none of the filter boxes', M.heldBoxes >= 3 && M.heldCovered.length === 0, [M.heldBoxes, M.heldCovered]);
      ok('no page errors (' + nm + ')', errs.length === 0, errs);
      await ctx.close();
    }

    // ── P — planted offenders: each fix taken back out of a served wizard.js ──
    const P = {
      order: plant(WIZ, `          '<div id="wizard-kind-head" style="display:none;margin-top:0.15rem"></div>' +
          '<div class="modal-title" id="wizard-title"></div>' +`, `          '<div class="modal-title" id="wizard-title"></div>' +
          '<div id="wizard-kind-head" style="display:none;margin-top:0.15rem"></div>' +`, 'title back above the Item Type box'),
      title: plant(WIZ, "if (title) title.style.display = (s && s.type === 'itemNumGrouping') ? 'none' : '';", "if (title) title.style.display = 'none';", 'phone title hidden'),
      textBox: plant(WIZ, `<input type="text" id="wiz-input" value="\${val}" placeholder="\${_wizPlaceholder(s)}"
          style="width:100%;box-sizing:border-box;`, `<input type="text" id="wiz-input" value="\${val}" placeholder="\${_wizPlaceholder(s)}"
          style="width:100%;`, 'text box-sizing'),
      notesBox: plant(WIZ, `<textarea id="wiz-input" placeholder="Optional notes…"
          style="width:100%;box-sizing:border-box;`, `<textarea id="wiz-input" placeholder="Optional notes…"
          style="width:100%;`, 'textarea box-sizing'),
      setBox: plant(plant(WIZ, "worthCol.style.cssText = 'flex:1;min-width:0;", "worthCol.style.cssText = 'flex:1;", 'worth min-width'),
        "boxCol.style.cssText = 'flex:0.8;min-width:0;", "boxCol.style.cssText = 'flex:0.8;", 'set box min-width'),
      setStrip: plant(WIZ, "var _bnSetSteps = wizard.tab === 'set' && !d._setMode;", 'var _bnSetSteps = false;', 'set strip'),
      stepOne: plant(WIZ, "if (_bnChoosing && !_bnSetSteps && !_inManual && !match) { el.innerHTML = ''; return; }", '', 'step-1 strip'),
      pieces: plant(WIZ, 'style="flex:1;min-width:0;padding:0.65rem 0.9rem;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2)', 'style="flex:1;padding:0.65rem 0.9rem;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2)', 'pieces box min-width'),
      cover: plant(WIZ, `'<div style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0.7rem;margin-top:0.55rem;'
      + 'background:var(--surface2);border-radius:6px;'`, `'<div style="position:absolute;left:0;right:0;top:9.5rem;height:9rem;z-index:5;display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0.7rem;margin-top:0.55rem;'
      + 'background:var(--surface2);border-radius:6px;'`, 'strip over the boxes'),
    };
    Object.keys(P).forEach(k => ok('P  setup: plant "' + k + '" applied', P[k] !== WIZ, k));
    {
      const { ctx, pg } = await openApp(browser, PHONE, { 'wizard.js': P.order });
      const R = await setRoad(pg);
      ok('P  PLANTED title moved back above the Item Type box → header-order check red', !(R.knows.kindHeadBottom > 0 && R.knows.titleTop >= R.knows.kindHeadBottom - 1), [R.knows.kindHeadBottom, R.knows.titleTop]);
      await ctx.close();
    }
    {
      const { ctx, pg } = await openApp(browser, PHONE360, { 'wizard.js': P.pieces });
      const R = await setRoad(pg);
      ok('P  PLANTED 360 pieces box without min-width → F red ("Identify your set")', R.components.sideways || R.components.past.length > 0, R.components);
      await ctx.close();
    }
    {
      const { ctx, pg } = await openApp(browser, PHONE, { 'wizard.js': P.title });
      const R = await setRoad(pg);
      ok('P  PLANTED phone title hidden again → K red', !(R.knows.title === 'Do you know the set number?'), R.knows.title);
      await ctx.close();
    }
    for (const [nm, opts] of [['phone 390', PHONE], ['desktop 1400', DESK]]) {
      const { ctx, pg } = await openApp(browser, opts, { 'wizard.js': P.textBox });
      const R = await setRoad(pg);
      ok('P  PLANTED ' + nm + ' set-number box without box-sizing → N red', R.setNum.sideways || R.setNum.past.length > 0, R.setNum);
      await ctx.close();
    }
    for (const [nm, opts] of [['phone 390', PHONE], ['desktop 1400', DESK]]) {
      const { ctx, pg } = await openApp(browser, opts, { 'wizard.js': P.notesBox });
      const R = await setRoad(pg);
      ok('P  PLANTED ' + nm + ' notes box without box-sizing → O red', R.notes.sideways || R.notes.past.length > 0, R.notes);
      await ctx.close();
    }
    {
      const { ctx, pg } = await openApp(browser, PHONE, { 'wizard.js': P.setBox });
      const R = await setRoad(pg);
      ok('P  PLANTED phone Set Box row without min-width → E red', !R.setBoxInside || R.details.sideways || R.details.past.length > 0, R.details);
      await ctx.close();
    }
    {
      const { ctx, pg } = await openApp(browser, DESK, { 'wizard.js': P.setStrip });
      const R = await setRoad(pg);
      ok('P  PLANTED the set steps not naming the set → O red (the strip says 2625)', /2625/.test(R.notes.strip) || !/2124W/.test(R.notes.strip), R.notes.strip);
      ok('P  PLANTED … → C red too', /2625/.test(R.confirm.strip) || !/2124W/.test(R.confirm.strip), R.confirm.strip);
      await ctx.close();
    }
    {
      const { ctx, pg } = await openApp(browser, PHONE, { 'wizard.js': P.stepOne });
      const M = await stepOneRoad(pg);
      ok('P  PLANTED Step 1 keeping a typed number\'s strip → M red', M.back.strip !== '', M.back);
      await ctx.close();
    }
    {
      const { ctx, pg } = await openApp(browser, PHONE, { 'wizard.js': P.cover });
      const M = await stepOneRoad(pg);
      ok('P  PLANTED a strip drawn over the filter boxes → V red', M.heldCovered.length > 0, M.heldCovered);
      await ctx.close();
    }
  } catch (e) {
    console.log('FAIL  crashed: ' + (e && e.stack || e));
    fail++;
  } finally {
    await browser.close();
  }
  console.log('\nsetlayout_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
