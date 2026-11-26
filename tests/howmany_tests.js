#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════
// "HOW MANY?" WHEN ADDING TRACK AND SWITCHES — howmany   (real Chromium, the REAL app)
//
// Problem report (Rex, 2026-11-22): "Can I add several 022 switches at once?"
// [stated] Brad 2026-11-22 17:05 CT "yes, one item per line, if a person says
// they have 6 022 switches, there is 6 individual rows that are identical
// other than the inventory id. price is listed as each. how many is just on
// track and switches".
//
// Owners: config.js RR_HOW_MANY (which bucket, the cap, the words) ·
// wizard-save.js rrHowManyOffered / rrHowManyCount / rrHowManyCopies and the
// ONE append in saveWizardItem · wizard.js the box and the review line ·
// app-data.js the offline drain's every-row id check.
//
// Proved through the app's own screens and its own save — only the Google
// Sheets / Drive writers are stood in for, and they RECORD what they were
// asked to write:
//   A  offered only for track and switches, only on a plain new add
//   B  the box on Purchase & Value: starts at 1, "each" shows above 1, the
//      cap, junk typed in, and it fits a 320 px phone
//   C  the review screen says "6 × 022 — 6 separate entries"
//   D  6 → SIX rows in ONE append, six Inventory IDs, every other cell the
//      same, the price not divided; six pieces in memory
//   E  1 → the save is exactly the save without the box
//   F  with a box → each copy its own group and its own box row
//   G  photos stay with the first row
//   H  a second save while one is running, and after one finished, adds nothing
//   I  a failed write leaves none of the six in memory
//   J  offline: the waiting entry's further rows take fresh ids on a clash
//   K  the real sheetsAppend sends the six rows as one request
//   P  planted offenders — each rule undone in a served copy must turn red
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  howmany_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra == null ? '' : String(extra)).slice(0, 300))); cond ? pass++ : fail++; }

async function scenario(pg) {
  return pg.evaluate(async () => {
    const R = {};
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const mk = (n, t, d, x) => Object.assign({ itemNum: n, variation: '', itemType: t, _era: 'pw', _tab: 'Lionel PW - Items', yearProd: '1950', description: d, roadName: '', rowId: 'RID-' + n }, x || {});
    state.masterData = [ mk('022', 'Track', 'Remote Control Switches, pair'), mk('042', 'Switch', 'Manual Switches, pair'),
                         mk('6464-1', 'Boxcar', 'Western Pacific Boxcar'), mk('2343-P', 'Diesel', 'Santa Fe F3') ];
    _rebuildMasterIndex();
    state.personalData = { k9: { owned: true, itemNum: '6464-1', variation: '', inventoryId: '9', row: 5, era: 'pw', manufacturer: 'Lionel' } };
    state.isData = {}; state.forSaleData = {}; state.wantData = {}; state.upgradeData = {};
    state.personalSheetId = 'SHEET';
    try { localStorage.removeItem('lv_inv_hwm'); } catch (e) {}
    _currentEra = 'all';
    const realAppend = window.sheetsAppend;
    const calls = [], toasts = [];
    let failNext = false;
    window.sheetsAppend = async (id, range, rows) => {
      if (failNext) throw new Error('Sheets write failed: planted');
      calls.push({ range: String(range), rows: rows.map(r => r.slice()) });
      const first = 200 + calls.reduce((a, c) => a + c.rows.length, 0) - rows.length + 1;
      return first;
    };
    window.rrVerifiedRowUpdate = async () => true;
    window.rrRowStillIs = async () => true;
    window.rrWhereIsRow = async (sid, tab, row) => ({ ok: true, row: row });
    window.driveEnsureSetup = async () => {};
    window.driveEnsureItemFolder = async (n) => 'FOLDER-' + n;
    window.driveUploadPhoto = async () => ({});
    window.buildDashboard = () => {}; window.renderBrowse = () => {};
    window.buildSoldPage = () => {}; window.buildForSalePage = () => {};
    window.loadPersonalData = async () => {};
    window.showToast = (m) => { toasts.push(String(m)); };
    window.rrMaybeShowAddHelp = () => {};
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    const F = PERSONAL_FIELD_INDEX;
    const cell = (row, f) => String(row[F[f]] == null ? '' : row[F[f]]).replace(/^'/, '');
    const coll = () => calls.filter(c => /^My Collection!/.test(c.range) || c.range.indexOf(PERSONAL_TAB + '!') === 0);

    // open a plain add of one catalog item
    const open = async (num, extra) => {
      try { if (typeof closeWizard === 'function' && window.wizard && wizard.steps) { wizard.data._saveComplete = true; closeWizard(); } } catch (e) {}
      openWizard('collection');
      await sleep(60);
      Object.assign(wizard.data, { itemNum: num, variation: '', condition: 7, allOriginal: 'Yes', hasBox: 'No',
        _itemGrouping: 'single', tenderMatch: 'none', setMatch: '', priceItem: '12.50', userEstWorth: '20', datePurchased: '2026-11-22', hasIS: 'No' }, extra || {});
      wizard.matchedItem = num ? (findMaster(num, '', { era: 'pw' }) || null) : null;
    };
    const showStep = async (id) => {
      const i = wizard.steps.findIndex(s => s.id === id);
      if (i < 0) return false;
      wizard.step = i; renderWizardStep(); await sleep(120); return true;
    };
    const type = (v) => { const el = document.getElementById('pv-howmany'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); return el; };

    // ── A — who is asked ──
    await open('022');     R.aTrack = rrHowManyOffered(wizard.data); R.aMatched = !!wizard.matchedItem;
    await open('042');     R.aSwitch = rrHowManyOffered(wizard.data);
    await open('6464-1', { _howMany: 6 }); R.aBoxcar = rrHowManyOffered(wizard.data); R.aBoxcarCount = rrHowManyCount(wizard.data);
    await open('2343-P');  R.aDiesel = rrHowManyOffered(wizard.data);
    const flags = { _setMode: true, _fromInbox: true, _alsoListForSale: true, boxOnly: true, _fillItemMode: true, _updatePdKey: 'k9', _addToGroupInv: '9', _existingGroupId: 'GRP-X', _photoOnly: true };
    R.aFlags = {};
    for (const k of Object.keys(flags)) { await open('022'); wizard.data[k] = flags[k]; R.aFlags[k] = rrHowManyOffered(wizard.data); }
    await open('022'); wizard.data.tenderMatch = '6026W'; R.aPaired = rrHowManyOffered(wizard.data);
    await open('022'); wizard.tab = 'want'; R.aWant = rrHowManyOffered(wizard.data); wizard.tab = 'collection';
    // a number the catalog does not know, said to be track on the "What is this item?" step
    await open('TRK-99'); wizard.matchedItem = null; wizard.data.manualItemType = 'Track';
    R.aTypedReady = (typeof _catalogReady === 'function') ? _catalogReady() : null;
    R.aTypedTrack = rrHowManyOffered(wizard.data);
    wizard.data.manualItemType = 'Boxcar'; R.aTypedBoxcar = rrHowManyOffered(wizard.data);
    R.cfg = { bucket: RR_HOW_MANY.bucket, max: RR_HOW_MANY.max };
    R.clamp = ['', 'abc', '0', '-3', '2.7', '6', '25', '26', '400', null, undefined].map(v => rrHowManyClamp(v));

    // ── B — the box ──
    await open('022');
    R.bStepFound = await showStep('purchaseValue');
    const box = document.getElementById('pv-howmany');
    R.bBox = !!box; R.bStart = box ? box.value : '';
    const eachShown = () => Array.from(document.querySelectorAll('.pv-each')).map(e => e.style.display !== 'none');
    R.bEachCount = document.querySelectorAll('.pv-each').length;
    R.bEachAt1 = eachShown();
    R.bPriceLabel1 = (document.getElementById('pv-price').closest('div').parentNode.textContent || '').replace(/\s+/g, ' ').trim();
    type('6'); R.bData6 = wizard.data._howMany; R.bEachAt6 = eachShown();
    R.bPriceLabel6 = Array.from(document.getElementById('pv-price').closest('div').parentNode.querySelectorAll('.pv-each')).filter(e => e.style.display !== 'none').map(e => e.textContent.trim()).join('|');
    R.bHint6 = document.getElementById('pv-howmany-hint').textContent;
    const el40 = type('40'); R.bVal40 = el40.value; R.bData40 = wizard.data._howMany; R.bHint40 = document.getElementById('pv-howmany-hint').textContent;
    type(''); R.bBlankCount = rrHowManyCount(wizard.data); R.bEachBlank = eachShown();
    const elB = type(''); elB.dispatchEvent(new Event('blur')); R.bBlurVal = elB.value;
    type('3'); R.bPriceKept = wizard.data.priceItem;
    // a re-draw keeps the number
    renderWizardStep(); await sleep(100); R.bRedraw = document.getElementById('pv-howmany').value; R.bEachRedraw = eachShown();
    // fits the screen it is on
    const r = document.getElementById('pv-howmany').getBoundingClientRect();
    R.bFit = { left: r.left, right: r.right, w: r.width, vw: window.innerWidth };
    const pvC = document.querySelector('.wiz-pv'), pvR = pvC.getBoundingClientRect();
    R.bFit.cw = pvC.clientWidth; R.bFit.sw = pvC.scrollWidth; R.bFit.sl = pvC.scrollLeft;
    R.bFit.inC = r.left >= pvR.left - 1 && r.right <= pvR.right + 1;
    R.bFit.worthW = document.getElementById('pv-worth').closest('div').getBoundingClientRect().width;
    // not on a boxcar's screen
    await open('6464-1', { _howMany: 6 }); await showStep('purchaseValue');
    R.bBoxcarBox = !!document.getElementById('pv-howmany'); R.bBoxcarEach = document.querySelectorAll('.pv-each').length;

    // ── C — the review screen ──
    await open('022', { _howMany: 6 }); await showStep('confirm');
    const cf = document.getElementById('cf-howmany');
    R.cText = cf ? cf.firstElementChild.textContent : ''; R.cNote = cf ? cf.lastElementChild.textContent : '';
    R.cBody = (document.getElementById('wizard-body') || document.body).textContent.replace(/\s+/g, ' ');
    await open('022', { _howMany: 1 }); await showStep('confirm'); R.cNone = !document.getElementById('cf-howmany');
    await open('6464-1', { _howMany: 6 }); await showStep('confirm'); R.cBoxcarNone = !document.getElementById('cf-howmany');

    // ── D — six ──
    await open('022', { _howMany: 6 });
    calls.length = 0; toasts.length = 0;
    const before = Object.keys(state.personalData).length;
    await saveWizardItem(); await sleep(50);
    const dC = coll();
    R.dCalls = dC.length; R.dRows = dC[0] ? dC[0].rows.length : 0;
    const rows = dC[0] ? dC[0].rows : [];
    R.dIds = rows.map(x => cell(x, 'inventoryId'));
    const skip = [F.inventoryId];
    R.dDiffCols = [];
    rows.slice(1).forEach(x => x.forEach((v, i) => { if (skip.indexOf(i) < 0 && String(v == null ? '' : v) !== String(rows[0][i] == null ? '' : rows[0][i]) && R.dDiffCols.indexOf(i) < 0) R.dDiffCols.push(i); }));
    R.dPrices = rows.map(x => cell(x, 'priceItem')); R.dWorths = rows.map(x => cell(x, 'userEstWorth'));
    R.dNums = rows.map(x => cell(x, 'itemNum')); R.dGroups = rows.map(x => cell(x, 'groupId'));
    R.dRowIds = rows.map(x => cell(x, 'masterRowId')); R.dKeys = rows.map(x => cell(x, 'masterKey'));
    const mem = R.dIds.map(id => state.personalData[id]).filter(Boolean);
    R.dMem = mem.length; R.dMemRows = mem.map(m => m.row); R.dMemOwned = mem.every(m => m.owned !== false && m.itemNum === '022');
    R.dMemPrices = mem.map(m => String(m.priceItem));
    R.dAdded = Object.keys(state.personalData).length - before;
    R.dToast = toasts.join(' | ');

    // ── E — one is today's save ──
    await open('022', { _howMany: 1 }); calls.length = 0; await saveWizardItem(); await sleep(30);
    const e1 = coll();
    await open('022'); calls.length = 0; toasts.length = 0; await saveWizardItem(); await sleep(30);
    const e0 = coll();
    R.eCalls = [e1.length, e0.length]; R.eRows = [e1[0] && e1[0].rows.length, e0[0] && e0[0].rows.length];
    R.eSame = !!(e1[0] && e0[0]) && e1[0].rows[0].every((v, i) => i === F.inventoryId || String(v == null ? '' : v) === String(e0[0].rows[0][i] == null ? '' : e0[0].rows[0][i]));
    R.eToast = toasts.join(' | ');

    // ── F — with a box ──
    await open('022', { _howMany: 3, hasBox: 'Yes', boxCond: 6 }); calls.length = 0;
    await saveWizardItem(); await sleep(50);
    const fC = coll();
    R.fCalls = fC.map(c => c.rows.map(x => cell(x, 'itemNum')).join(','));
    const fItems = fC[0] ? fC[0].rows : [], fBoxes = fC[1] ? fC[1].rows : [];
    R.fItemGroups = fItems.map(x => cell(x, 'groupId')); R.fBoxGroups = fBoxes.map(x => cell(x, 'groupId'));
    R.fIds = fItems.concat(fBoxes).map(x => cell(x, 'inventoryId'));
    R.fBoxMatched = fBoxes.map(x => cell(x, 'matchedTo'));
    R.fMem = R.fIds.filter(id => state.personalData[id]).length;
    R.fGroupSizes = R.fItemGroups.map(g => Object.values(state.personalData).filter(p => p.groupId === g).length);

    // ── G — photos stay with the first ──
    await open('022', { _howMany: 3, hasBox: 'Yes', boxCond: 6, photosItem: { front: 'https://drive.google.com/drive/folders/ITEMFOLDER' }, photosBox: { front: 'https://drive.google.com/drive/folders/BOXFOLDER' } });
    calls.length = 0; await saveWizardItem(); await sleep(50);
    const gC = coll();
    R.gItemPhotos = (gC[0] ? gC[0].rows : []).map(x => cell(x, 'photoItem'));
    R.gItemBoxPhotos = (gC[0] ? gC[0].rows : []).map(x => cell(x, 'photoBox'));
    R.gBoxRowPhotos = (gC[1] ? gC[1].rows : []).map(x => cell(x, 'photoBox'));
    // and the maker of copies, directly
    const proto = new Array(Object.keys(F).length).fill(''); proto[F.itemNum] = '022'; proto[F.inventoryId] = '500'; proto[F.photoItem] = 'LINK'; proto[F.photoBox] = 'BLINK'; proto[F.groupId] = 'GRP-LINKED'; proto[F.priceItem] = '12.50';
    const cps = rrHowManyCopies(proto, 4, { ownGroup: false, lead: '022' });
    R.gCopies = cps.length; R.gCopyGroups = cps.map(x => x[F.groupId]); R.gCopyPhotos = cps.map(x => x[F.photoItem] + x[F.photoBox]);
    R.gProtoKept = proto[F.photoItem] === 'LINK' && proto[F.inventoryId] === '500';
    R.gNone = [rrHowManyCopies(proto, 1).length, rrHowManyCopies(proto, 0).length, rrHowManyCopies(null, 5).length];

    // ── H — no double save ──
    await open('022', { _howMany: 4 }); calls.length = 0;
    const p1 = saveWizardItem(), p2 = saveWizardItem(); await p1; await p2; await sleep(30);
    R.hRunning = coll().reduce((a, c) => a + c.rows.length, 0);
    const dH = wizard.data; calls.length = 0;
    wizard.data = dH; await saveWizardItem(); await sleep(30);
    R.hAfter = coll().length;

    // ── I — a failed write leaves nothing ──
    await open('022', { _howMany: 5 }); calls.length = 0;
    const nI = Object.keys(state.personalData).length;
    failNext = true; R.iThrew = false;
    try { await saveWizardItem(); } catch (e) { R.iThrew = true; }
    failNext = false; await sleep(30);
    R.iAdded = Object.keys(state.personalData).length - nI; R.iCalls = calls.length;
    try { wizard.data._saveComplete = true; closeWizard(); } catch (e) {}

    // ── J — offline: every row of a waiting entry is looked at ──
    const invIdx = PERSONAL_SCHEMA.findIndex(f => f.field === 'inventoryId');
    const qRow = (id, num) => { const x = new Array(invIdx + 2).fill(''); x[F.itemNum] = num; x[invIdx] = id; return x; };
    const runDrain = async (pd, values) => {
      state.personalData = pd;
      const entry = { kind: 'append', args: { sheetId: 'SHEET', range: 'My Collection!A:A', values: values } };
      let verdict = null;
      const oL = window.rrOutboxList, oD = window.rrOutboxDrainAppends;
      window.rrOutboxList = () => [entry];
      window.rrOutboxDrainAppends = (fn) => { verdict = fn(entry); return null; };
      await window._rrOfflineAppendDrain();
      window.rrOutboxList = oL; window.rrOutboxDrainAppends = oD;
      return { dropped: verdict, ids: values.map(v => String(v[invIdx])) };
    };
    const real = (id, num, row) => ({ owned: true, itemNum: num, inventoryId: id, row: row });
    // another device took 51 and 52 for other items; 50 is free
    R.jClash = await runDrain({ a: real('51', '6464-1', 8), b: real('52', '2343-P', 9), m0: real('50', '022', 0), m1: real('51', '022', 0), m2: real('52', '022', 0) },
                              [qRow('50', '022'), qRow('51', '022'), qRow('52', '022')]);
    // the first row's id is taken by another item: all three move on, all different
    R.jFirst = await runDrain({ a: real('50', '6464-1', 8), b: real('52', '2343-P', 9) }, [qRow('50', '022'), qRow('51', '022'), qRow('52', '022')]);
    // nothing clashes: nothing changes
    R.jClean = await runDrain({ a: real('9', '6464-1', 8) }, [qRow('50', '022'), qRow('51', '022'), qRow('52', '022')]);
    // the whole entry already landed (first row is in the sheet as the same item): dropped, ids untouched
    R.jLanded = await runDrain({ a: real('50', '022', 8), b: real('51', '022', 9), c: real('52', '022', 10) }, [qRow('50', '022'), qRow('51', '022'), qRow('52', '022')]);

    // the first row's id is another copy of the SAME item on the sheet (another device's 022); the rest never landed
    R.jSameFirst = await runDrain({ a: real('50', '022', 8) }, [qRow('50', '022'), qRow('51', '022'), qRow('52', '022')]);
    // after a reload the waiting rows are not in memory: a fresh id must not be a sibling's
    R.jReload = await runDrain({ a: real('50', '6464-1', 8) }, [qRow('50', '022'), qRow('51', '022'), qRow('52', '022')]);
    // a ONE-row entry is judged exactly as before
    R.jOneLanded = await runDrain({ a: real('50', '022', 8) }, [qRow('50', '022')]);
    R.jOneClash = await runDrain({ a: real('50', '6464-1', 8) }, [qRow('50', '022')]);
    R.jOneNew = await runDrain({ a: real('9', '6464-1', 8) }, [qRow('50', '022')]);
    await open('022'); wizard.data.setMatch = 'link'; R.aSetLink = rrHowManyOffered(wizard.data);
    try { wizard.data._saveComplete = true; closeWizard(); } catch (e) {}

    // ── K — the real sheetsAppend: one request for the six ──
    const oF = window.fetch; const posts = [];
    window.fetch = async (u, o) => { posts.push({ u: String(u), body: o && o.body }); return { ok: true, status: 200, json: async () => ({ updates: { updatedRange: "'My Collection'!A300:AZ305" } }) }; };
    try { window._readOnlyMode = false; } catch (e) {}
    const oTok = accessToken; accessToken = 'tok';
    const six = [1, 2, 3, 4, 5, 6].map(i => qRow(String(700 + i), '022'));
    try { R.kFirst = await realAppend('SHEET', 'My Collection!A:A', six); } catch (e) { R.kErr = String(e && e.message || e); }
    window.fetch = oF;
    accessToken = oTok;
    const ap = posts.filter(p => /:append/.test(p.u));
    R.kPosts = ap.length; try { R.kValues = JSON.parse(ap[0].body).values.length; } catch (e) { R.kValues = -1; }
    return R;
  });
}

async function openApp(browser, served, viewport) {
  const pg = await browser.newPage({ viewport: viewport || { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const name = u.split('?')[0].split('/').pop();
    if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  return { pg, errs };
}

const src0 = (n) => fs.readFileSync(path.join(APP, n), 'utf8');
const uniq = (a) => a.length === new Set(a).size;
const seq = (a) => a.every((v, i) => i === 0 || parseInt(v, 10) === parseInt(a[i - 1], 10) + 1);
// every rule, as a check on one scenario result — used for the real app AND for each planted offender
const RULES = {
  A1: ['a catalog track item (022) is asked How many', r => r.aMatched && r.aTrack === true],
  A2: ['a catalog switch is asked too', r => r.aSwitch === true],
  A3: ['a boxcar is NOT asked, and a count left on it counts as 1', r => r.aBoxcar === false && r.aBoxcarCount === 1 && r.aDiesel === false],
  A4: ['not in a set walk, a photo-inbox add, an add also listed for sale, a box on its own, a fill, an edit, an add into a group, a photo-only save', r => Object.keys(r.aFlags).length === 9 && Object.values(r.aFlags).every(v => v === false)],
  A5: ['not for a pair, not on the Want list', r => r.aPaired === false && r.aWant === false],
  A6: ['a hand-typed number said to be Track is asked; said to be a Boxcar is not', r => r.aTypedTrack === true && r.aTypedBoxcar === false],
  A7: ['the bucket and the cap come from config.js (Track, 25)', r => r.cfg.bucket === 'Track' && r.cfg.max === 25],
  A8: ['a typed count is a whole number from 1 to 25, else 1', r => JSON.stringify(r.clamp) === JSON.stringify([1, 1, 1, 1, 2, 6, 25, 25, 25, 1, 1])],
  B1: ['the box is on Purchase & Value and starts at 1', r => r.bStepFound && r.bBox && r.bStart === '1'],
  B2: ['at 1 nothing says "each"', r => r.bEachCount === 2 && r.bEachAt1.every(v => v === false)],
  B3: ['at 6 the count is kept once and both money labels say "each"', r => r.bData6 === 6 && r.bEachAt6.length === 2 && r.bEachAt6.every(v => v === true) && r.bPriceLabel6 === 'each'],
  B4: ['typing 40 stops at 25 and says why', r => r.bVal40 === '25' && r.bData40 === 25 && /up to 25/.test(r.bHint40) && !/up to 25/.test(r.bHint6)],
  B5: ['an emptied box counts as 1 and reads 1 on leaving it', r => r.bBlankCount === 1 && r.bEachBlank.every(v => v === false) && r.bBlurVal === '1'],
  B6: ['a re-drawn screen keeps the number; the price typed is untouched', r => r.bRedraw === '3' && r.bEachRedraw.every(v => v === true) && r.bPriceKept === '12.50'],
  B7: ['a boxcar\'s screen has no box and no "each"', r => r.bBoxcarBox === false && r.bBoxcarEach === 0],
  C1: ['the review screen says "6 × 022 — 6 separate entries"', r => r.cText === '6 × 022 — 6 separate entries' && /Inventory ID/.test(r.cNote)],
  C2: ['the review rows say the price and worth are each; the count is not an editable row', r => /Price Paid \(each\)/.test(r.cBody) && /Est\. Worth \(each/.test(r.cBody) && !/how ?many/i.test(r.cBody.replace(r.cText, ''))],
  C3: ['no such line at 1, or on a boxcar', r => r.cNone === true && r.cBoxcarNone === true],
  D1: ['6 → ONE append holding six rows', r => r.dCalls === 1 && r.dRows === 6],
  D2: ['six Inventory IDs, all different, in sequence', r => r.dIds.length === 6 && r.dIds.every(Boolean) && uniq(r.dIds) && seq(r.dIds)],
  D3: ['every other cell of the six rows is the same', r => r.dRows === 6 && r.dDiffCols.length === 0],
  D4: ['the price and the worth are each — on every row, not divided', r => r.dPrices.length === 6 && r.dPrices.every(v => parseFloat(v) === 12.5) && r.dWorths.every(v => parseFloat(v) === 20)],
  D5: ['all six carry the same catalog row (Row ID and key)', r => r.dNums.every(v => v === '022') && uniq(r.dRowIds) === false && new Set(r.dRowIds).size === 1 && r.dRowIds[0] !== '' && new Set(r.dKeys).size === 1],
  D6: ['six pieces in memory on six sheet rows', r => r.dMem === 6 && r.dAdded === 6 && r.dMemOwned && uniq(r.dMemRows) && seq(r.dMemRows) && r.dMemRows[0] > 0 && r.dMemPrices.every(v => parseFloat(v) === 12.5)],
  D7: ['no group when there is no box; the message says 6 × 022', r => r.dGroups.every(v => v === '') && /6 × 022 added to My Collection/.test(r.dToast)],
  E1: ['1 → one append, one row, the same row as an add without the box', r => r.eCalls.join() === '1,1' && r.eRows.join() === '1,1' && r.eSame === true && /Item 022 added to My Collection/.test(r.eToast)],
  F1: ['3 with a box → three items in one append, three box rows in one append', r => r.fCalls.join(' / ') === '022,022,022 / 022-BOX,022-BOX,022-BOX'],
  F2: ['each copy has its own group, and its own box row in it', r => r.fItemGroups.length === 3 && r.fItemGroups.every(g => /^GRP-022-\d+$/.test(g)) && uniq(r.fItemGroups) && r.fItemGroups.join() === r.fBoxGroups.join() && r.fGroupSizes.join() === '2,2,2'],
  F3: ['six Inventory IDs across items and boxes, all in memory', r => r.fIds.length === 6 && uniq(r.fIds) && r.fMem === 6 && r.fBoxMatched.every(v => v === '022')],
  G1: ['the photo link is on the first row only', r => r.gItemPhotos.length === 3 && /ITEMFOLDER/.test(r.gItemPhotos[0]) && r.gItemPhotos[1] === '' && r.gItemPhotos[2] === ''],
  G2: ['the box photo link is on the first item row and first box row only', r => /BOXFOLDER/.test(r.gItemBoxPhotos[0]) && r.gItemBoxPhotos.slice(1).join('') === '' && /BOXFOLDER/.test(r.gBoxRowPhotos[0]) && r.gBoxRowPhotos.slice(1).join('') === ''],
  G3: ['a copy never inherits a link to a box you already had; the first row is left as built', r => r.gCopies === 3 && r.gCopyGroups.join('') === '' && r.gCopyPhotos.join('') === '' && r.gProtoKept && r.gNone.join() === '0,0,0'],
  H1: ['two saves at once write the four rows once', r => r.hRunning === 4],
  H2: ['a save after the save finished writes nothing', r => r.hAfter === 0],
  I1: ['a failed write leaves none of the five in memory', r => r.iAdded === 0 && r.iCalls === 0],
  J1: ['offline: a further row whose id the sheet holds takes a fresh one', r => r.jClash.dropped === false && r.jClash.ids[0] === '50' && uniq(r.jClash.ids) && r.jClash.ids.slice(1).every(v => parseInt(v, 10) > 52)],
  J2: ['offline: the first row clashes → every clashing row moves, all different', r => r.jFirst.dropped === false && uniq(r.jFirst.ids) && r.jFirst.ids[1] === '51' && parseInt(r.jFirst.ids[0], 10) > 52 && parseInt(r.jFirst.ids[2], 10) > 52],
  J3: ['offline: no clash → the ids are sent as they were', r => r.jClean.dropped === false && r.jClean.ids.join() === '50,51,52'],
  J4: ['offline: an entry that already landed is dropped whole, never doubled', r => r.jLanded.dropped === true && r.jLanded.ids.join() === '50,51,52'],
  J5: ['offline: the first row is another copy of the same item on the sheet, the rest never landed → SENT (not dropped), the clashing row moved', r => r.jSameFirst.dropped === false && uniq(r.jSameFirst.ids) && parseInt(r.jSameFirst.ids[0], 10) > 52 && r.jSameFirst.ids.slice(1).join() === '51,52'],
  J6: ['offline: a fresh id is never a waiting sibling\'s id', r => r.jReload.dropped === false && uniq(r.jReload.ids) && parseInt(r.jReload.ids[0], 10) > 52],
  J7: ['offline: a one-row entry is judged as before (landed → dropped, another item → moved, new → sent)', r => r.jOneLanded.dropped === true && r.jOneLanded.ids[0] === '50' && r.jOneClash.dropped === false && r.jOneClash.ids[0] !== '50' && r.jOneNew.dropped === false && r.jOneNew.ids[0] === '50'],
  A9: ['not for a piece linked to a set', r => r.aSetLink === false],
  K1: ['the real sheetsAppend sends six rows as ONE request and answers the first row', r => !r.kErr && r.kPosts === 1 && r.kValues === 6 && r.kFirst === 300],
};

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const { pg, errs } = await openApp(browser);
  let R;
  try { R = await scenario(pg); } catch (e) { console.log('FAIL  the scenario threw  -> ' + String(e && e.message || e).slice(0, 600)); console.log('FAILED  —  howmany: the scenario did not run'); await browser.close(); process.exit(1); }
  Object.keys(RULES).forEach(k => { let v = false, x = ''; try { v = !!RULES[k][1](R); } catch (e) { x = String(e); } ok(k + ' ' + RULES[k][0], v, x || JSON.stringify(pick(R, k))); });
  const appErrs = errs.filter(e => !/fonts|Failed to fetch|net::/i.test(e));
  ok('no page errors', appErrs.length === 0, appErrs.slice(0, 3).join(' | '));
  await pg.close();

  // the box on Rex's phone: 320 px wide
  {
    const o = await openApp(browser, null, { width: 320, height: 654 });
    const R3 = await scenario(o.pg);
    ok('B8 on a 320 px phone the box is inside the screen', R3.bBox && R3.bFit.left >= 0 && R3.bFit.right <= R3.bFit.vw && R3.bFit.w >= 80 && R3.bFit.inC, JSON.stringify(R3.bFit));
    ok('B10 on a 320 px phone the screen does not slide sideways and the worth box keeps its full line', R3.bFit.sw <= R3.bFit.cw && R3.bFit.sl === 0 && R3.bFit.worthW >= R3.bFit.cw - 2, JSON.stringify(R3.bFit));
    // planted: the money box allowed to push the screen wider again
    {
      const s0 = src0('wizard.js'), a = 'id="pv-worth" value="\' + (_pvD.userEstWorth || \'\') + \'" placeholder="0.00" min="0" step="0.01" style="flex:1;min-width:0;';
      const c = s0.split(a).length - 1;
      if (c !== 1) ok('P17 plant applies', false, 'anchor found ' + c + ' times');
      else {
        const o2 = await openApp(browser, { 'wizard.js': s0.split(a).join(a.replace('min-width:0;', '')) }, { width: 320, height: 654 });
        const R4 = await scenario(o2.pg);
        ok('P17 the worth box without min-width:0 → the 320 px screen slides sideways (B10 red)', !(R4.bFit.sw <= R4.bFit.cw && R4.bFit.sl === 0), JSON.stringify(R4.bFit));
        await o2.pg.close();
      }
    }
    ok('B9 on a 320 px phone the save still makes six rows in one append', R3.dCalls === 1 && R3.dRows === 6, R3.dCalls + ' ' + R3.dRows);
    await o.pg.close();
  }

  // ── P — planted offenders: undo one rule in a served copy; its check must go red ──
  const src = (n) => fs.readFileSync(path.join(APP, n), 'utf8');
  const plant = (n, from, to) => { const s = src(n); const c = s.split(from).length - 1; if (c !== 1) throw new Error('plant anchor found ' + c + ' times in ' + n + ': ' + from.slice(0, 60)); return { [n]: s.split(from).join(to) }; };
  const plants = [
    ['P1 the box shown on a boxcar', () => plant('wizard-save.js', '    return rrHowManyCarRow(row, bucket);', '    return true;'), ['A3', 'B7']],   // 2026-11-26 (menardscars): the "else" line is now the listed-maker car rule
    ['P2 two rows sharing an Inventory ID', () => plant('wizard-save.js', '    c[F.inventoryId] = nextInventoryId();', ''), ['D2']],
    ['P3 the price divided by the count', () => plant('wizard-save.js', '    var c = row.slice();', '    var c = row.slice(); c[F.priceItem] = String((parseFloat(row[F.priceItem]) || 0) / n);'), ['D3', 'D4']],
    ['P4 the rows written one at a time (a partial batch is possible)', () => plant('wizard-save.js', "[row].concat(_hmCopies))) || 0;", "[row])) || 0; for (const _c of _hmCopies) await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [_c]);"), ['D1']],
    ['P5 the in-flight lock gone (a second save doubles the rows)', () => plant('wizard-save.js', "  if (d._wizSaveLock) { console.warn('[Save] Blocked — a save is already in flight'); return; }", ''), ['H1']],
    ['P6 every row sharing the one photo folder', () => plant('wizard-save.js', "    c[F.photoItem] = '';", ''), ['G1']],
    ['P7 the cap not applied', () => plant('wizard-save.js', '  return n > max ? max : n;', '  return n;'), ['A8', 'B4']],
    ['P8 offline: only the first row of an entry looked at', () => plant('app-data.js', "        if (_vs.length > 1) {", "        if (false) {"), ['J1']],
    ['P18 offline: a multi-copy entry dropped on its first row alone', () => plant('app-data.js', "          var _allLanded = _vs.every(function (r) {", "          var _allLanded = _vs.slice(0, 1).every(function (r) {"), ['J5']],
    ['P19 offline: a fresh id not kept past the waiting rows', () => plant('app-data.js', "          if (!isNaN(n) && n > _maxInv) _maxInv = n;", ""), ['J6']],
    ['P9 offered on a photo-inbox add', () => plant('wizard-save.js', '    if (d._fromInbox || d._alsoListForSale || d._photoOnly || d._existingInventoryId || d._existingGroupId) return false;', ''), ['A4']],
    ['P10 the review screen silent about the count', () => plant('wizard.js', "    if (!_isEph && _cfHowMany > 1) {", "    if (false) {"), ['C1']],
    ['P11 the copies not put in memory', () => plant('wizard-save.js', "      _hmCopies.forEach(function (c, ci) {", "      [].forEach(function (c, ci) {"), ['D6']],
    ['P12 a copy with a box left without its own box row', () => plant('wizard-save.js', "[u1BoxRow].concat(_hmBoxRows));", "[u1BoxRow]);"), ['F1']],
    ['P13 the copies sharing the first row\'s group', () => plant('wizard-save.js', "    c[F.groupId] = opts.ownGroup ? ('GRP-' + (opts.lead || '') + '-' + (ts + i)) : '';", ''), ['F2', 'G3']],
    ['P14 the count kept when the item is not track', () => plant('wizard-save.js', '  return rrHowManyOffered(d) ? rrHowManyClamp(d._howMany) : 1;', '  return rrHowManyClamp(d._howMany);'), ['A3']],
    ['P15 "each" never shown', () => plant('wizard.js', "  document.querySelectorAll('.pv-each').forEach(function (e) { e.style.display = n > 1 ? '' : 'none'; });", ''), ['B3']],
    ['P16 the bucket changed in config.js', () => plant('config.js', "  bucket: 'Track',", "  bucket: 'Boxcar',"), ['A1', 'A7']],
  ];
  for (const [name, mkServed, mustRed] of plants) {
    let served; try { served = mkServed(); } catch (e) { ok(name + ' — plant applies', false, e.message); continue; }
    const o = await openApp(browser, served);
    let Rp = null, threw = '';
    try { Rp = await o.pg.evaluate(() => 1) && await scenario(o.pg); } catch (e) { threw = String(e && e.message || e); }
    const red = mustRed.filter(k => { if (!Rp) return true; try { return !RULES[k][1](Rp); } catch (e) { return true; } });
    ok(name + ' → turns ' + mustRed.join(', ') + ' red', red.length === mustRed.length, 'still green: ' + mustRed.filter(k => red.indexOf(k) < 0).join(', ') + (threw ? ' (scenario threw: ' + threw.slice(0, 120) + ')' : ''));
    await o.pg.close();
  }
  await browser.close();
  console.log((fail ? 'FAILED' : 'PASSED') + '  —  howmany: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();

function pick(R, k) {
  const p = k.charAt(0).toLowerCase(), o = {};
  Object.keys(R).forEach(n => { if (n.charAt(0) === p) o[n] = R[n]; });
  return o;
}
