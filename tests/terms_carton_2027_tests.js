#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TERMS AND WHAT THEY MEAN + ONE MASTER CARTON COLUMN — v0.9.2027
// (real Chromium, the REAL app)
//
// A York customer asked for "a page with Term Definitions"; Brad: "mouse over
// it for more than a few seconds ... and it shows the word's definition", then
// reviewed every definition (RR_TERMS, config.js). And: "the shipper and
// master carton should just be the same column".
//
//   A  the list: every term has words; Brad's own wording is what is stored
//   B  the Add step's questions are defined words carrying their definition
//   C  a real mouse resting on a question shows the conductor with the
//      definition — not before the usual wait, yes after it
//   D  a phone: press and hold a defined word → the definition shows (on a
//      phone-sized screen) and the press does not count as a tap
//   E  the item page: detail labels, group roles, the kind of group, the copy
//      chip and the variation chip are defined words; an era badge says the
//      period's years
//   F  the master carton column: named "Master Carton / Outside Shipper",
//      shows "Yes · 6/10" when the group holds a master carton (table, item
//      page, reports alike), else older typed text; the Add steps do not ask a
//      second carton question; the edit panel only offers the old text box
//      while it still holds text; bulk tagging does not offer it
//   G  Help → Terms lists every term
//   P  planted offenders — each change undone in a served copy turns red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  terms_carton_2027_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }

async function openApp(browser, served, mobile) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1400, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await ctx.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const name = u.split('?')[0].split('/').pop();
    if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: name.endsWith('.css') ? 'text/css' : 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    state.masterData = [
      { itemNum: '2343', variation: '1', itemType: 'Diesel', _era: 'pw', _tab: 'Lionel PW - Items', yearProd: '1950', description: 'Santa Fe F3 A Unit', roadName: 'Santa Fe' },
      { itemNum: '2343C', variation: '', itemType: 'Diesel', _era: 'pw', _tab: 'Lionel PW - Items', yearProd: '1950', description: 'Santa Fe F3 B Unit', roadName: 'Santa Fe' },
    ];
    _rebuildMasterIndex();
    const pd = (n, inv, row, x) => Object.assign({ owned: true, itemNum: n, variation: '', inventoryId: inv, row: row, era: 'pw', manufacturer: 'Lionel' }, x);
    state.personalData = {
      a:  pd('2343', '5', 5, { variation: '1', groupId: 'G1', condition: '8', shipper: '' }),
      a2: pd('2343', '9', 9, { variation: '1', groupId: '', condition: '6', shipper: 'old brown box' }),   // a second copy, old typed text
      b:  pd('2343C', '6', 6, { groupId: 'G1', condition: '8' }),
      m:  pd('2343-MBOX', '7', 7, { groupId: 'G1', condition: '6', itemType: 'Master Carton' }),
    };
    state.isData = {}; state.personalSheetId = 'S';
    window.rrMaybeShowAddHelp = () => {};
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  });
  return { ctx, pg, errs };
}

async function desktop(o) {
  const pg = o.pg;
  const R = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    const R = {};
    const T = k => (RR_TERMS.find(t => t.key === k) || {});
    R.allHaveWords = RR_TERMS.every(t => String(rrTermDef(t.key) || '').trim().length > 3);
    R.mc = rrTermDef('masterCarton'); R.dummy = rrTermDef('dummyA'); R.bu = rrTermDef('bUnit');
    R.eras = [rrTermDef('prewar'), rrTermDef('postwar'), rrTermDef('modern')];
    R.mcWord = T('masterCarton').word;
    // B — the Add step
    _currentEra = 'pw';
    openWizard('collection'); await S(300);
    wizard.data.itemNum = '2343'; wizardNext(); await S(500);
    document.querySelectorAll('#ai-usage-card').forEach(e => e.remove());
    const q = k => document.querySelector('#wizard-body [data-term="' + k + '"]');
    R.addTerms = ['allOriginal', 'hasBox', 'instructionSheet', 'masterCarton', 'errorItem', 'condition'].map(k => !!(q(k) && q(k).getAttribute('data-ctip') === rrTermDef(k)));
    const ao = q('allOriginal'); if (ao) ao.id = 'term-probe';
    // F — the Add steps ask no second carton question
    try { localStorage.setItem('lv_shipper_enabled', 'true'); } catch (e) {}
    R.addAsksShipper = (typeof _wizUserFieldsHtml === 'function') ? /shipper/i.test(_wizUserFieldsHtml(wizard.data)) : 'none';
    return R;
  });
  // C — a real mouse resting on "All Original?"
  const box = await pg.locator('#term-probe').boundingBox();
  await pg.mouse.move(5, 5);
  await pg.mouse.move(box.x + 8, box.y + box.height / 2);
  await pg.waitForTimeout(700);
  const early = await pg.evaluate(() => !!document.getElementById('conductor-tip'));
  await pg.waitForTimeout(1100);
  const late = await pg.evaluate(() => { const t = document.getElementById('conductor-tip'); return t ? t.textContent : ''; });
  await pg.mouse.move(5, 5);
  const R2 = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    try { _doCloseWizard(); } catch (e) {}
    const R = {};
    // E — the item page
    _currentEra = 'all';
    showItemDetailPage(0, '5'); await S(200);
    const pgEl = document.getElementById('page-itemdetail');
    const has = k => !!pgEl.querySelector('[data-term="' + k + '"]');
    R.detail = { condition: has('condition'), inventoryId: has('inventoryId'), bUnit: has('bUnit'), masterCarton: has('masterCarton'), dieselSets: has('dieselSets') || has('groupedSet'), variation: has('variation') };
    R.copyChip = has('copyOf');
    R.eraBadge = (typeof eraBadgeHTML === 'function') ? eraBadgeHTML('Lionel PW - Items') : '';
    // F — the column
    const col = (typeof RR_ROW_EXTRA_COLS !== 'undefined' ? RR_ROW_EXTRA_COLS : []).find(c => c.col === 'shipper');
    const def = RR_USER_FIELDS.find(f => f.key === 'shipper');
    R.colLabel = (typeof rrFieldLabel === 'function') ? rrFieldLabel(def) : def.label;
    R.cellA = col ? rrRowExtraValue(col, state.personalData.a) : 'no col';
    R.cellA2 = col ? rrRowExtraValue(col, state.personalData.a2) : 'no col';
    R.reportA = (typeof _rbCellVal === 'function') ? _rbCellVal('shipper', state.personalData.a, {}, {}) : 'none';
    R.detailA = (pgEl.textContent.indexOf('Yes · 6/10') >= 0);
    R.bulk = (typeof _btFields === 'function' ? _btFields() : (typeof rrBulkTagFields === 'function' ? rrBulkTagFields() : null));
    // G — Help → Terms
    rrTermsOpen(); await S(100);
    const tv = document.getElementById('rr-terms');
    R.termsRows = tv ? tv.querySelectorAll('[data-term-row]').length : 0;
    R.termsN = RR_TERMS.length;
    R.termsGuarded = !!(tv && tv._rrGuarded);
    if (tv) tv.remove();
    return R;
  });
  return Object.assign({}, await Promise.resolve(R), { early, late }, R2);
}

async function phone(o) {
  const pg = o.pg;
  await pg.evaluate(async () => {
    _currentEra = 'all';
    showItemDetailPage(0, '5'); await new Promise(r => setTimeout(r, 200));
    const el = document.querySelector('#page-itemdetail [data-term="inventoryId"]');
    if (el) { el.id = 'hold-probe'; el.scrollIntoView({ block: 'center' }); }
    window._clicks = 0; document.addEventListener('click', () => { window._clicks++; }, false);
  });
  const b = await pg.locator('#hold-probe').boundingBox();
  const cdp = await o.ctx.newCDPSession(pg);
  const pt = { x: b.x + 6, y: b.y + b.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
  await pg.waitForTimeout(750);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pg.waitForTimeout(250);
  return pg.evaluate(() => {
    const t = document.getElementById('conductor-tip');
    return { text: t ? t.textContent : '', shown: !!(t && getComputedStyle(t).display !== 'none'), clicks: window._clicks, want: rrTermDef('inventoryId') };
  });
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  async function scenario(served) {
    let D = null, P = null, errs = [];
    const o = await openApp(browser, served, false);
    try { D = await desktop(o); } catch (e) { D = { err: String(e && e.message || e) }; }
    errs = errs.concat(o.errs); await o.ctx.close();
    const m = await openApp(browser, served, true);
    try { P = await phone(m); } catch (e) { P = { err: String(e && e.message || e) }; }
    errs = errs.concat(m.errs); await m.ctx.close();
    return { D, P, errs };
  }
  const { D, P, errs } = await scenario(null);
  if (D.err) console.log('desktop error: ' + D.err);
  if (P.err) console.log('phone error: ' + P.err);

  ok('A1 every term has words', D.allHaveWords === true);
  ok('A2 Brad’s Master Carton wording', D.mc === 'For postwar, the box that held the grouped item’s own boxes. For modern items, the outer shipping box, usually plain brown cardboard.' && D.mcWord === 'Master Carton / Outside Shipper', D.mc);
  ok('A3 Brad’s Dummy A Unit and B Unit wording', D.dummy === 'A diesel with a cab but no motor.' && D.bu === 'A diesel with no cab.', D.dummy + ' | ' + D.bu);
  ok('A4 Brad’s eras: just the years', JSON.stringify(D.eras) === JSON.stringify(['1901–1942.', '1945–1969.', '1970 to today.']), JSON.stringify(D.eras));
  ok('B1 the Add step’s six questions are defined words with their definitions', JSON.stringify(D.addTerms) === '[true,true,true,true,true,true]', JSON.stringify(D.addTerms));
  ok('C1 a resting mouse does not pop the tip early', D.early === false, String(D.early));
  ok('C2 …and after the wait the conductor shows the definition', String(D.late).indexOf('Every part is the one it left the factory with') >= 0, String(D.late).slice(0, 80));
  ok('D1 a phone: press and hold shows the definition', P.shown === true && String(P.text).indexOf(P.want) >= 0, JSON.stringify(P));
  ok('D2 …and the press is not a tap', P.clicks === 0, String(P.clicks));
  ok('E1 item page: detail labels, a group role, the carton, the kind of group, the variation chip', D.detail && Object.values(D.detail).every(Boolean), JSON.stringify(D.detail));
  ok('E2 the copy chip is a defined word', D.copyChip === true);
  ok('E3 an era badge says the period’s years', /data-term="postwar"/.test(D.eraBadge) && /1945–1969/.test(D.eraBadge), D.eraBadge.slice(0, 160));
  ok('F1 the column is named Master Carton / Outside Shipper', D.colLabel === 'Master Carton / Outside Shipper', D.colLabel);
  ok('F2 it shows "Yes · 6/10" from the group’s master carton — table and reports alike', D.cellA === 'Yes · 6/10' && D.reportA === 'Yes · 6/10', D.cellA + ' | ' + D.reportA);
  ok('F3 …and on the item page', D.detailA === true);
  ok('F4 a copy with no carton keeps its older typed text', D.cellA2 === 'old brown box', D.cellA2);
  ok('F5 the Add steps ask no second carton question', D.addAsksShipper === false, String(D.addAsksShipper));
  ok('G1 Help → Terms lists every term, and is guarded', D.termsRows === D.termsN && D.termsN > 20 && D.termsGuarded, D.termsRows + '/' + D.termsN + ' ' + D.termsGuarded);
  // F6 — static: bulk tagging does not offer the typed carton column; the edit panel's filter is the one in place
  const bt = fs.readFileSync(path.join(APP, 'bulk-tag.js'), 'utf8');
  ok('F6 bulk tagging does not offer a typed carton column', !/\{ key: 'shipper'/.test(bt));
  const ac = fs.readFileSync(path.join(APP, 'app-collection.js'), 'utf8');
  ok('F7 the edit panel offers the old text box only while it holds text', /return !f\.show \|\| String\(pd\[f\.key\] \|\| ''\)\.trim\(\) !== '';/.test(ac));
  const appErrs = errs.filter(e => !/fonts|Failed to fetch|net::|ERR_/i.test(e));
  ok('no page errors', appErrs.length === 0, appErrs.slice(0, 3).join(' | '));

  // ── P — planted offenders ──
  const src = (n) => fs.readFileSync(path.join(APP, n), 'utf8');
  const plant = (n, from, to) => { const s = src(n); if (s.indexOf(from) < 0) throw new Error('plant anchor missing in ' + n + ': ' + from.slice(0, 60)); return { [n]: s.split(from).join(to) }; };
  const plants = [
    ['P1 the Add questions are plain words again', plant('wizard.js', "+ '<span' + (termKey && typeof rrTermAttrs === 'function' ? rrTermAttrs(termKey) : '') + ' style=", "+ '<span' + ' style="), x => x.D.addTerms && x.D.addTerms.slice(0, 5).every(Boolean)],
    ['P2 no press-and-hold on a phone', plant('tutorial.js', "_holdT = setTimeout(function () { _holdT = null; _show(tgt); _heldTip = true; }, HOLD_MS);", ''), x => x.P.shown === true],
    ['P3 the phone hides every tip again (old style rule)', plant('tutorial.css', '#conductor-tip.ctip-term { display: flex !important; }', ''), x => x.P.shown === true],
    ['P4 the column ignores the group’s master carton', plant('config.js', "if (mb && mb !== pd) {", 'if (false) {'), x => x.D.cellA === 'Yes · 6/10'],
    ['P5 the Add steps ask the carton twice', plant('wizard.js', ".filter(function (f) { return f.asked !== false; })", ''), x => x.D.addAsksShipper === false],
  ];
  for (const [name, served, check] of plants) {
    let x = null;
    try { x = await scenario(served); } catch (e) { x = null; }
    let still = false; try { still = !!(x && check(x)); } catch (e) { still = false; }
    ok(name + ' — caught', !still, 'the check still passed');
  }
  await browser.close();
  console.log((fail ? 'FAILED' : 'GREEN') + '  terms_carton_2027_tests  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
