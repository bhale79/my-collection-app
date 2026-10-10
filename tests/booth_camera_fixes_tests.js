#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE BOOTH CAMERA LIST — v0.9.1920   (real Chromium, the REAL app + source)
//
// Scripting the Oct 22 train-show video turned up spots that looked wrong on a
// TV or confused a customer. Brad: "lets fix it all before we start."
//   A  Record Sale on the item page works right after a reload — the wizard
//      window is built first (it was built on first use, so the button did
//      nothing until some other wizard had opened). PLANTED: the build line
//      removed → no window opens.
//   B  the Add wizard's last screen: the seller reads "Dave Miller — Miller's
//      Trains", not the "C-…" contact code; its pencil opens the contact list
//      (never a free-text box that would cut the link); a diesel set's partner
//      units are named by role ("B Unit", "Dummy A Unit") and the raw
//      "Unit2 item num" / "Unit2 power" rows are gone. PLANTED: the seller line
//      removed → the code shows again.
//   C  box + instruction-sheet condition left at the shown 7 is SAVED (only
//      moving the slider used to write it); a box answered No keeps no stray
//      condition. PLANTED: the commit block removed → boxCond stays blank.
//   D  the Want list: no variation picked → no variation description (it used
//      to show whichever variation findMaster returned). PLANTED: guard gone.
//   E  "Your name" in Preferences drives the greeting and the account button;
//      blank falls back to the Google first name ("The" for "The Rail Roster").
//   F  words: a sure Photo Inbox read shows no "?"; no "already tried / free in
//      the background" claims; phone wording on phones (no Ctrl+, no desk);
//      Add's photo screen titled for adding; "per user" gone; the tour says
//      Est. Worth is required and names no buyer field.
//   G  scan: every function in app/ that opens the wizard window builds it
//      first. PLANTED: today's sellFromCollection without the build → caught.
// The stand-in world boots app/index.html from disk with every network call
// refused (the shape full_row_carry_tests uses).
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  booth_camera_fixes_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

function plant(file, from, to) {
  const s = rd(file); const out = s.replace(from, to);
  if (out === s) throw new Error('planted ' + file + ': the line moved; update this test — ' + from.slice(0, 60));
  return out;
}
const PLANT = {
  sell: () => ({ 'app-collection.js': plant('app-collection.js', "  if (typeof _buildWizardModal === 'function') _buildWizardModal();\n  document.getElementById('wizard-modal').classList.add('open');\n  document.body.style.overflow = 'hidden';\n  // Skip tab, itemNum, variation steps", "  document.getElementById('wizard-modal').classList.add('open');\n  document.body.style.overflow = 'hidden';\n  // Skip tab, itemNum, variation steps") }),
  seller: () => ({ 'wizard.js': plant('wizard.js', "if (k === 'purchasedFrom' && typeof window._ctLabel === 'function') dispVal = window._ctLabel(v);", '') }),
  box: () => ({ 'wizard.js': plant('wizard.js', "if (wizard.data[hk] === 'Yes' && !wizard.data[ck]) wizard.data[ck] = 7;", "if (false) {}") }),
  vardesc: () => ({ 'app-pages.js': plant('app-pages.js', "  if (!u || String(u.variation || '').trim() === '') return '';\n  var vm = (m === undefined) ? _wuVarMaster(u) : m;", "  var vm = (m === undefined) ? _wuVarMaster(u) : m;") }),
};

async function boot(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const bare = u.split('?')[0];
    for (const f of Object.keys(planted || {})) if (bare.endsWith('/app/' + f)) return r.fulfill({ body: planted[f], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    const PW = 'Lionel PW - Items';
    const mk = (n, v, t, desc, x) => Object.assign({ itemNum: n, variation: v, itemType: t, description: desc, _era: 'pw', _tab: PW, rowId: 'R' + n + v, yearProd: '1950', roadName: 'Santa Fe', gauge: 'O', varDesc: '' }, x || {});
    state.masterData = [
      mk('2343P', '1', 'Diesel Locomotive', 'Santa Fe F3 A unit', { varDesc: 'silver and red warbonnet' }),
      mk('2343C', '1', 'Diesel Locomotive', 'Santa Fe F3 B unit'),
      mk('6464-100', '1', 'Boxcar', 'Western Pacific boxcar', { varDesc: 'clear shell painted orange' }),
      mk('6464-100', '2', 'Boxcar', 'Western Pacific boxcar', { varDesc: 'silver body, yellow feather' }),
    ];
    _rebuildMasterIndex();
    state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); state.masterByRowIdAll = state.masterByRowId;
    window._allIdxComplete = true;
    state.personalSheetId = 'SID'; window.accessToken = 'tok'; accessToken = 'tok';
    state.personalData = { 'INV-1': { owned: true, itemNum: '2343-P', variation: '1', era: 'pw', manufacturer: 'Lionel', inventoryId: 'INV-1', row: 3, condition: '7', priceItem: '200', userEstWorth: '350' } };
    state.contactsData = [{ id: 'C-1700000000001', name: 'Dave Miller', business: "Miller's Trains" }, { id: 'C-1700000000002', name: 'Linda Carver', business: '' }];
    state.soldData = {}; state.wantData = {}; state.forSaleData = {}; state.upgradeData = {};
    window.fetch = async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '{}' });
    window.showToast = function () {};
  });
  return { pg, errs };
}

// ── A: Record Sale right after a reload ────────────────────────────────────
async function runA(browser, planted) {
  const { pg, errs } = await boot(browser, planted);
  const out = await pg.evaluate(() => {
    const before = !!document.getElementById('wizard-modal');
    let threw = '';
    try { sellFromCollection(state.masterData.findIndex(m => m.itemNum === '2343P'), 'INV-1'); } catch (e) { threw = e.message; }
    const m = document.getElementById('wizard-modal');
    return { before, open: !!(m && m.classList.contains('open')), threw, tab: (typeof wizard !== 'undefined' && wizard) ? wizard.tab : '' };
  });
  await pg.close();
  return { out, errs };
}

// ── B: the last Add screen ─────────────────────────────────────────────────
async function runB(browser, planted) {
  const { pg, errs } = await boot(browser, planted);
  const out = await pg.evaluate(() => {
    _buildWizardModal();
    const steps = getSteps('collection');
    const ci = steps.findIndex(s => s.type === 'confirm');
    const master = state.masterData[0];
    wizard = { step: ci, tab: 'collection', steps: steps, matchedItem: master, data: {
      tab: 'collection', itemNum: '2343', variation: '1', condition: 7, priceItem: '150', userEstWorth: '400',
      purchasedFrom: 'C-1700000000001', hasBox: 'No', allOriginal: 'Yes',
      _itemGrouping: 'ab', unitPower: 'Powered', unit2ItemNum: '2343C', unit2Power: '', unit2Condition: 7, unit2HasBox: 'No' } };
    document.getElementById('wizard-modal').classList.add('open');
    renderWizardStep();
    const body = document.getElementById('wizard-body') || document.getElementById('wizard-modal');
    const txt = body.textContent;
    const r = { ci, txt: txt.slice(0, 1600) };
    r.name = /Dave Miller — Miller's Trains/.test(txt);
    r.code = /C-1700000000001/.test(txt);
    r.boughtLabel = /Bought From/.test(txt);
    r.bUnit = /B Unit\s*2343C/.test(txt);
    r.bUnitCond = /B Unit Condition/.test(txt);
    r.raw = /Unit2 item num|Unit2 power|Unit 2 Item/i.test(txt);
    // the pencil on the seller row → a list of contacts, not a text box
    _confirmEdit('purchasedFrom');
    const sel = document.getElementById('confirm-input-purchasedFrom');
    r.selTag = sel ? sel.tagName : '';
    r.opts = sel ? Array.from(sel.options).map(o => o.textContent) : [];
    if (sel) { sel.value = 'C-1700000000002'; _confirmDoneEdit('purchasedFrom'); }
    r.after = wizard.data.purchasedFrom;
    r.afterShown = (document.getElementById('confirm-val-purchasedFrom') || {}).textContent;
    // ABA: the third unit is the dummy A unit, the second the B unit; AA's second is the dummy A
    wizard.data._itemGrouping = 'aa'; wizard.data.unit2ItemNum = '2343T'; wizard.data.unit2Power = 'Dummy';
    renderWizardStep();
    const t2 = (document.getElementById('wizard-body') || document.getElementById('wizard-modal')).textContent;
    r.aaDummy = /Dummy A Unit\s*2343T/.test(t2);
    r.aaPower = /Dummy A Unit Power|Unit2 power|power\s*Dummy/i.test(t2);
    return r;
  });
  await pg.close();
  return { out, errs };
}

// ── C: box / sheet condition committed at the shown 7 ─────────────────────
async function runC(browser, planted) {
  const { pg, errs } = await boot(browser, planted);
  const out = await pg.evaluate(async () => {
    _buildWizardModal();
    const steps = getSteps('collection');
    const di = steps.findIndex(s => s.type === 'conditionDetails');
    const go = async (data) => {
      wizard = { step: di, tab: 'collection', steps: steps, matchedItem: state.masterData[0], data: Object.assign({ tab: 'collection', itemNum: '2343', variation: '1', _itemGrouping: 'single', userEstWorth: '400' }, data) };
      try { await _wizardNextCore(); } catch (e) { return { threw: e.message }; }
      return { boxCond: wizard.data.boxCond, is: wizard.data.is_condition, cond: wizard.data.condition, u2: wizard.data.unit2BoxCond };
    };
    return {
      di,
      yes: await go({ hasBox: 'Yes' }),
      moved: await go({ hasBox: 'Yes', boxCond: 9 }),
      no: await go({ hasBox: 'No', boxCond: 5 }),
      sheet: await go({ hasBox: 'No', hasIS: 'Yes' }),
      ab: await go({ hasBox: 'Yes', _itemGrouping: 'ab', unit2ItemNum: '2343C', unit2HasBox: 'Yes' }),
    };
  });
  await pg.close();
  return { out, errs };
}

// ── D + E: the Want list's variation text; the name box ───────────────────
async function runDE(browser, planted) {
  const { pg, errs } = await boot(browser, planted);
  const out = await pg.evaluate(() => {
    const r = {};
    r.blank = _wuVarDesc({ itemNum: '6464-100', variation: '' });
    r.picked = _wuVarDesc({ itemNum: '6464-100', variation: '2' });
    state.user = { name: 'The Rail Roster', email: 'support@example.test' };
    try { localStorage.removeItem(RR_DISPLAY_NAME_KEY); } catch (e) {}
    rrPaintGreeting(); updateUserUI();
    r.g0 = (document.getElementById('dash-greeting') || {}).textContent || '';
    _prefsSetDisplayName('Brad');
    r.g1 = (document.getElementById('dash-greeting') || {}).textContent || '';
    r.chip1 = (document.getElementById('user-name') || {}).textContent || '';
    r.user1 = rrUserName();
    _prefsSetDisplayName('  ');
    r.g2 = (document.getElementById('dash-greeting') || {}).textContent || '';
    r.user2 = rrUserName();
    _prefsSetDisplayName('<b>x</b>');
    r.esc = (document.getElementById('dash-greeting') || {}).innerHTML.indexOf('<b>x</b>') < 0;
    try { localStorage.removeItem(RR_DISPLAY_NAME_KEY); } catch (e) {}
    // the help panel on a phone vs a desktop
    const was = window.IS_MOBILE_UA;
    window.IS_MOBILE_UA = true;  r.phoneHelp = rrPhotoIdHelpHtml();
    window.IS_MOBILE_UA = false; r.deskHelp = rrPhotoIdHelpHtml();
    window.IS_MOBILE_UA = was;
    return r;
  });
  await pg.close();
  return { out, errs };
}

// ── G: every opener of the wizard window builds it first ───────────────────
function openerScan(files) {
  const bad = [];
  Object.keys(files).forEach(f => {
    const lines = files[f].split('\n');
    lines.forEach((ln, i) => {
      if (!/getElementById\(['"]wizard-modal['"]\)\.classList\.add\(['"]open['"]\)/.test(ln)) return;
      // walk back to the enclosing top-level function (a line starting "function" / "async function")
      let j = i, built = false;
      for (; j >= 0; j--) {
        if (/_buildWizardModal\(/.test(lines[j]) && j !== i) built = true;
        if (/^(async\s+)?function\s/.test(lines[j]) || /^window\.\w+\s*=\s*(async\s+)?function/.test(lines[j])) break;
      }
      if (!built) bad.push(f + ':' + (i + 1));
    });
  });
  return bad;
}

(async () => {
  // ── F: words (source) ──────────────────────────────────────────────────
  const pin = rd('photo-inbox.js'), help = rd('help-photo-id.js'), dash = rd('dashboard.js'), bc = rd('barcode.js'), tut = rd('tutorial.js'), html = rd('index.html');
  T('F1 a sure Photo Inbox read shows no "?" (the tile line)', !/String\(sug\.num\)\.replace\(\/<\/g, '&lt;'\) \+ '\?<\/span>/.test(pin) && /\+ ' · best guess<\/span>/.test(pin));
  T('F2 no "already tried, and it was free" in the help panel', !/already tried/.test(help) && /Start with the free read/.test(help) && /Identify my items/.test(help));
  T('F3 the paid-batch message makes no "already tried every photo" claim', !/free reader already tried every photo/.test(pin));
  T('F4 the Welcome card no longer says photos are read "in the background, for free"', !/in the background, for free/.test(dash));
  T('F5 the Quick Capture toast no longer says "at the desk"', !/file them at the desk/.test(pin));
  T('F6 the Add flow\'s photo screen is titled for adding', /📷 Identify Your Item from a Photo/.test(bc) && !/What Item Do You Want to Research\?/.test(bc));
  T('F7 the Collection Value placeholder no longer says "per user"', !/>per user</.test(html) && /<div class="stat-sub">estimated worth<\/div>/.test(html));
  T('F8 the tour says Est. Worth is required, not "every field is optional"', !/Every field after the item number is optional/.test(tut) && /Est\. Worth<\/strong> on the Purchase &amp; Value screen/.test(tut));
  T('F9 the tour names no buyer field on a sale', !/the buyer or notes/.test(tut));
  T('F10 the tour explains a blue number, not "2328?"', !/<strong>2328\?<\/strong>/.test(tut));
  T('F11 the Photo Inbox instructions + empty box switch to phone words', /window\.IS_MOBILE_UA \? 'Use <b>Add photos<\/b> to take pictures/.test(pin) && /window\.IS_MOBILE_UA \? 'Tap <b>Add photos<\/b>/.test(pin) && /window\.IS_MOBILE_UA \? 'Tap' : 'Click'/.test(pin));
  T('F12 the Google copy-back banner + toast have phone words', /press and hold on the answer, choose <b>Select all<\/b>/.test(pin) && /press and hold on Google\\u2019s answer/.test(pin));

  // ── G: the opener scan, then its planted offender ─────────────────────
  const files = {}; fs.readdirSync(APP).filter(f => f.endsWith('.js')).forEach(f => { files[f] = rd(f); });
  const bad = openerScan(files);
  T('G1 every function that opens the wizard window builds it first', bad.length === 0, bad);
  const plantedFiles = Object.assign({}, files, PLANT.sell());
  const badP = openerScan(plantedFiles);
  T('G2 PLANTED: sellFromCollection without the build is caught', badP.some(b => /^app-collection\.js:/.test(b)), badP);

  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    let r = await runA(browser, null);
    T('A1 right after a load the wizard window does not exist yet', r.out.before === false, r.out);
    T('A2 Record Sale opens the sale wizard anyway (it builds the window)', r.out.open && !r.out.threw && r.out.tab === 'sold', r.out);
    T('A3 no page errors', r.errs.length === 0, r.errs);
    r = await runA(browser, PLANT.sell());
    T('A4 PLANTED: without the build line, nothing opens', !r.out.open, r.out);

    r = await runB(browser, null);
    T('B1 the last screen shows the seller by name — "Dave Miller — Miller\'s Trains"', r.out.name && !r.out.code, r.out);
    T('B2 its label reads "Bought From"', r.out.boughtLabel, r.out.txt);
    T('B3 the AB set\'s second unit reads "B Unit 2343C" and its condition "B Unit Condition"', r.out.bUnit && r.out.bUnitCond, r.out.txt);
    T('B4 no raw "Unit2 item num" / "Unit2 power" rows', !r.out.raw, r.out.txt);
    T('B5 the seller pencil opens a LIST of contacts (no free-text box)', r.out.selTag === 'SELECT' && r.out.opts.includes("Dave Miller — Miller's Trains") && r.out.opts.includes('Linda Carver') && !r.out.opts.some(o => /Add someone new/.test(o)), r.out.opts);
    T('B6 picking from the list keeps an ID and shows the name', r.out.after === 'C-1700000000002' && r.out.afterShown === 'Linda Carver', r.out);
    T('B7 an AA\'s second unit reads "Dummy A Unit 2343T", no power row', r.out.aaDummy && !r.out.aaPower, r.out);
    T('B8 no page errors', r.errs.length === 0, r.errs);
    r = await runB(browser, PLANT.seller());
    T('B9 PLANTED: without the seller line the "C-…" code shows again', r.out.code, r.out.txt);

    r = await runC(browser, null);
    T('C1 a box left at the shown 7 is saved as 7', r.out.yes.boxCond === 7, r.out);
    T('C2 a box condition the user moved is kept (9)', r.out.moved.boxCond === 9, r.out);
    T('C3 a box answered No keeps no stray condition', !r.out.no.boxCond, r.out);
    T('C4 an instruction sheet left at the shown 7 is saved as 7', r.out.sheet.is === 7, r.out);
    T('C5 the B unit\'s box (AB set) is saved at 7 too', r.out.ab.u2 === 7 && r.out.ab.boxCond === 7, r.out);
    T('C6 no page errors', r.errs.length === 0, r.errs);
    r = await runC(browser, PLANT.box());
    T('C7 PLANTED: without the commit the box condition stays blank', !r.out.yes.boxCond, r.out);

    r = await runDE(browser, null);
    T('D1 a want with no variation shows no variation description', r.out.blank === '', r.out.blank);
    T('D2 a want WITH a variation still shows its own description', r.out.picked === 'silver body, yellow feather', r.out.picked);
    T('E1 no name typed: the greeting uses the Google first word ("The")', /Good (Morning|Afternoon|Evening), The$/.test(r.out.g0.trim()), r.out.g0);
    T('E2 "Brad" typed: the greeting and the account button say Brad', /, Brad$/.test(r.out.g1.trim()) && r.out.chip1 === 'Brad' && r.out.user1 === 'Brad', r.out);
    T('E3 cleared: back to the Google name', /, The$/.test(r.out.g2.trim()) && r.out.user2 === 'The Rail Roster', r.out);
    T('E4 a typed name is shown as text, never as page code', r.out.esc, r.out);
    T('F13 on a phone the help panel says press-and-hold, no Ctrl+', !/Ctrl\+/.test(r.out.phoneHelp) && /press and hold/.test(r.out.phoneHelp), '');
    T('F14 on a desktop the help panel keeps Ctrl+A / Ctrl+C / Ctrl+V', /Ctrl\+A/.test(r.out.deskHelp) && /Ctrl\+V/.test(r.out.deskHelp), '');
    T('D3 no page errors', r.errs.length === 0, r.errs);
    r = await runDE(browser, PLANT.vardesc());
    T('D4 PLANTED: without the guard a blank variation shows some variation\'s text', r.out.blank !== '', r.out.blank);
  } finally { await browser.close(); }

  console.log('\nbooth_camera_fixes_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.message); process.exit(1); });
