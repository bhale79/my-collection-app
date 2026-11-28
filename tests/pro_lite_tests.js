#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PRO LITE — ONE SWITCH PER PRO PIECE        (real Chromium, the REAL app)
// 2026-11-26 07:24 CT: "a lite version of it that just handles the multiple
// collections, same app as the base one, but can handle 10 plus collections";
// 2026-11-27 09:08 CT "yes" to splitting the switch (PLAN_2026-11-27_PRO_LITE.md).
// Until now ONE feature name ('collections') switched on every Pro piece but
// the shelf labels. Now:
//   collections  drop-down, details, All Collections, archive, move   (Lite + Pro)
//   invoices / capture / staff / handover                             (Pro)
//   A  config: THE list (RR_PRO_FEATURES) and every Pro block takes its name
//      from it; each business screen asks ITS OWN switch; nothing outside
//      config.js types a Pro switch name; PLANTED offenders are caught
//   B  a Pro Lite account: collections yes — invoices, intake, staff PINs,
//      hand-over button, Business tools section: none of them
//   C  a full Pro account: every piece, exactly as before
//   D  a regular account: none; an owner: all
//   E  a hand-over already under way still shows on a Lite account (it can be
//      finished or cancelled); only the button that STARTS one is switched
//   F  My Subscription: plan 'lite' says "Pro Lite", never the regular price;
//      the plan is remembered per account; an unknown plan word = regular
//   G  PLANTED in the page: invoices back on the collections switch → a Lite
//      account would see invoices → caught
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  pro_lite_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail === undefined ? null : detail)).slice(0, 700))); cond ? pass++ : fail++; }
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');

const NAMES = ['collections', 'invoices', 'capture', 'staff', 'handover'];
// each business screen and the door it must ask (its own block's feature)
const DOORS = [
  ['collections-invoice.js', /rrFeatureOn\(I\(\)\.feature\)/],
  ['capture.js', /rrFeatureOn\(C\(\)\.feature\)/],
  ['staff.js', /rrFeatureOn\(C\(\)\.feature\)/],
  ['drive-picker.js', /rrFeatureOn\(C\(\)\.feature\)/],
  ['collections-handover.js', /rrFeatureOn\(H\(\)\.feature\)/],
  ['collections-ui.js', /rrFeatureOn\(U\(\)\.feature\)/],
];
function doorsMissing(over) {
  return DOORS.filter(([f, re]) => !re.test(strip((over && over[f]) || read(f)))).map(d => d[0]);
}
// nothing outside config.js may type a Pro switch name into rrFeatureOn
function typedNames(over) {
  const bad = [];
  fs.readdirSync(APP).filter(f => f.endsWith('.js') && f !== 'config.js').forEach(f => {
    const src = strip((over && over[f]) || read(f));
    const re = /rrFeatureOn\(\s*['"]([a-z_]+)['"]/g; let m;
    while ((m = re.exec(src))) if (NAMES.indexOf(m[1]) >= 0) bad.push(f + ': ' + m[1]);
  });
  return bad;
}

async function boot(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const file = u.split('?')[0].split('/').pop();
    if (planted && planted[file]) return r.fulfill({ body: planted[file], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  await pg.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    state.user = { email: 'shop@example.test', name: 'Test Shop' };
    window._offlineMode = false; window._readOnlyMode = false;
    window._subScreen = function () {}; window._subApply = function () {};
    window.showToast = function () {};
  });
  return { pg, errs };
}
// what one account sees, read through the app's own doors
async function sees(pg, features, opts) {
  opts = opts || {};
  return pg.evaluate((o) => {
    window._subState = { sub: 'active', plan: o.plan || 'regular', features: o.features };
    if (o.owner) state.user = { email: (typeof RR_OWNER_EMAILS !== 'undefined' && RR_OWNER_EMAILS[RR_OWNER_EMAILS.length - 1]) || state.user.email, name: 'Owner' };
    if (o.handover) window.rrCollectionsData = function () { return { items: { c7: { key: 'c7', number: 7, name: 'Jones', handover: { state: o.handover, clientName: 'A Client', files: [1, 2], accepted: 0 } } } }; };
    const r = {};
    const call = (fn, ...a) => { try { return typeof window[fn] === 'function' ? window[fn](...a) : 'MISSING'; } catch (e) { return 'THROW ' + e.message; } };
    r.collections = !!call('rrCollUiOn');
    r.invoices = !!call('rrInvOn');
    r.capture = !!call('rrCaptureOn');
    r.handoverOn = !!call('rrHandOverOn');
    r.staffRow = String(call('rrPrefsStaffHtml') || '').length > 0;
    r.business = String(call('rrPrefsPickerHtml') || '');
    r.hoHtml = String(call('rrHandOverDetailsHtml', { key: 'c7', number: 7, name: 'Jones' }) || '');
    let b = document.getElementById('pin-capture-btn');
    if (!b) { b = document.createElement('button'); b.id = 'pin-capture-btn'; document.body.appendChild(b); }
    call('rrCaptureButtonSync');
    r.captureBtnShown = b.style.display !== 'none';
    r.owner = !!(typeof rrIsRealOwner === 'function' && rrIsRealOwner());
    return r;
  }, Object.assign({ features }, opts));
}

(async () => {
  console.log('== A · config and the scan ==');
  const cfg = read('config.js');
  T('A1 THE list: RR_PRO_FEATURES names the five pieces once', /var RR_PRO_FEATURES = \{\s*collections: 'collections',\s*invoices: 'invoices',\s*capture: 'capture',\s*staff: 'staff',\s*handover: 'handover',\s*\};/.test(cfg));
  const blocks = [['RR_COLL_UI', 'collections'], ['RR_COLL_INVOICE', 'invoices'], ['RR_CAPTURE', 'capture'], ['RR_STAFF', 'staff'], ['RR_DRIVE_PICKER', 'staff'], ['RR_COLL_HANDOVER', 'handover']];
  const wrong = blocks.filter(([b, n]) => !new RegExp('(var|const) ' + b + ' = \\{\\s*\\n\\s*feature: RR_PRO_FEATURES\\.' + n + ',').test(cfg)).map(x => x[0]);
  T('A2 every Pro block takes its switch from THE list (no name typed twice)', wrong.length === 0, wrong);
  T('A3 the list comes BEFORE every block that reads it (a var read early would be undefined)', blocks.every(([b]) => cfg.indexOf('var RR_PRO_FEATURES = {') < cfg.search(new RegExp('(var|const) ' + b + ' = \\{'))));
  T('A4 no Pro block is left on the old shared name \'collections\' except RR_COLL_UI (through the list)', !/\n\s*feature: 'collections',/.test(cfg));
  const miss = doorsMissing();
  T('A5 each Pro screen asks ITS OWN switch through rrFeatureOn', miss.length === 0, miss);
  const inv = read('collections-invoice.js');
  const plantedInv = inv.replace("typeof rrCollUiOn === 'function' && rrCollUiOn() && typeof rrFeatureOn === 'function' && !!rrFeatureOn(I().feature)", "typeof rrCollUiOn === 'function' && rrCollUiOn()");
  T('A6 PLANTED: invoices back on the collections switch only → caught', plantedInv !== inv && doorsMissing({ 'collections-invoice.js': plantedInv }).indexOf('collections-invoice.js') >= 0);
  const typed = typedNames();
  T('A7 no file outside config.js types a Pro switch name', typed.length === 0, typed);
  const sc = read('scan-shelve.js') + "\nfunction _planted() { return rrFeatureOn('invoices'); }\n";
  T('A8 PLANTED: rrFeatureOn(\'invoices\') typed in scan-shelve.js → caught', typedNames({ 'scan-shelve.js': sc }).some(b => /scan-shelve/.test(b)));
  T('A9 the plan words: "Pro" and "Pro Lite" live in config.js only', /const RR_PLAN_WORDS = \{ pro: 'Pro', lite: 'Pro Lite' \}/.test(cfg) && !/Pro Lite/.test(strip(read('prefs.js'))));

  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    const { pg, errs } = await boot(browser);
    const names = await pg.evaluate(() => [RR_COLL_UI.feature, RR_COLL_INVOICE.feature, RR_CAPTURE.feature, RR_STAFF.feature, RR_DRIVE_PICKER.feature, RR_COLL_HANDOVER.feature]);
    T('A10 in the page the blocks hold the five names', JSON.stringify(names) === JSON.stringify(['collections', 'invoices', 'capture', 'staff', 'staff', 'handover']), names);

    console.log('\n== B · a Pro Lite account (collections only) ==');
    const L = await sees(pg, ['collections'], { plan: 'lite' });
    T('B1 the collection drop-down and its screens are on', L.collections, L);
    T('B2 no invoices', !L.invoices, L);
    T('B3 no sticker-and-shelf intake (and its Photo Inbox button is hidden)', !L.capture && !L.captureBtnShown, L);
    T('B4 no staff PINs row', !L.staffRow, L);
    T('B5 no Business tools section at all', L.business === '', L.business.slice(0, 200));
    T('B6 no "Hand over to the client" button on a collection', !L.handoverOn && L.hoHtml === '', L.hoHtml.slice(0, 200));
    T('B7 not an owner (the test is honest)', !L.owner, L);

    console.log('\n== C · a full Pro account ==');
    const P = await sees(pg, ['collections', 'invoices', 'capture', 'staff', 'handover', 'scan_shelve'], { plan: 'pro' });
    T('C1 collections, invoices, intake on', P.collections && P.invoices && P.capture && P.captureBtnShown, P);
    T('C2 staff PINs row and the Business tools section', P.staffRow && /data-pp-prefs/.test(P.business) && /rr-staff-prefs-row/.test(P.business) && /rr-inv-own-row/.test(P.business) && /rr-pp-prefs-row/.test(P.business), P.business.slice(0, 300));
    T('C3 the hand-over button', P.handoverOn && /data-ho-open/.test(P.hoHtml), P.hoHtml.slice(0, 200));
    const I = await sees(pg, ['collections', 'invoices'], { plan: 'pro' });
    T('C4 invoices alone still get the Business tools section (its own-invoices row, no staff, no picker row)', /rr-inv-own-row/.test(I.business) && !/rr-staff-prefs-row/.test(I.business) && !/rr-pp-prefs-row/.test(I.business), I.business.slice(0, 300));
    const N = await sees(pg, ['invoices', 'capture'], { plan: 'pro' });
    T('C5 invoices and intake need collections too (no collections → neither)', !N.invoices && !N.capture, N);

    console.log('\n== D · regular and owner ==');
    const R = await sees(pg, [], {});
    T('D1 a regular account sees no Pro piece', !R.collections && !R.invoices && !R.capture && !R.staffRow && R.business === '' && R.hoHtml === '' && !R.captureBtnShown, R);
    const O = await sees(pg, [], { owner: true });
    T('D2 an owner sees every piece (owners see everything)', O.owner && O.collections && O.invoices && O.capture && O.staffRow && /data-ho-open/.test(O.hoHtml), O);
    await pg.evaluate(() => { state.user = { email: 'shop@example.test', name: 'Test Shop' }; });

    console.log('\n== E · a hand-over already under way on a Lite account ==');
    const W = await sees(pg, ['collections'], { plan: 'lite', handover: 'waiting' });
    T('E1 it still shows, with Cancel — it can be finished or cancelled', /data-ho-wait/.test(W.hoHtml) && /data-ho-cancel/.test(W.hoHtml), W.hoHtml.slice(0, 200));
    const A2 = await sees(pg, ['collections'], { plan: 'lite', handover: 'accepted' });
    T('E2 an accepted one still offers Keep / Remove', /data-ho-accepted/.test(A2.hoHtml), A2.hoHtml.slice(0, 200));
    const opened = await pg.evaluate(() => {
      const r = {};
      window.rrCollectionsData = function () { return { items: { c7: { key: 'c7', number: 7, name: 'Jones' } } }; };
      window.rrCollectionByKey = function () { return { key: 'c7', number: 7, name: 'Jones' }; };
      window.rrCurrentCollection = function () { return { key: 'c9' }; };
      const toasts = []; window.showToast = m => toasts.push(String(m));
      rrHandOverOpen('c7'); r.newLite = toasts.length;     // switch off, nothing under way → nothing at all
      window._subState.features = ['collections', 'handover'];
      rrHandOverOpen('c7'); r.newPro = toasts.length;      // switch on → it goes on (here: "open it first")
      return r;
    });
    T('E3 a NEW hand-over cannot be started by a Lite account (the door refuses before anything)', opened.newLite === 0 && opened.newPro === 1, opened);

    console.log('\n== F · My Subscription ==');
    const f = await pg.evaluate(() => {
      window.rrCollectionsData = undefined;
      const row = s => { window._subState = s; return (_prefsSubRowHtml() || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); };
      const r = {};
      r.liteActive = row({ sub: 'active', plan: 'lite', paidThrough: '2027-08-01', portalLink: 'https://billing.example/p', features: ['collections'] });
      r.liteBeta = row({ sub: 'beta', plan: 'lite', freeUntil: '2027-06-30', features: ['collections'] });
      r.proActive = row({ sub: 'active', plan: 'pro', paidThrough: '2027-08-01', portalLink: 'https://billing.example/p', features: [] });
      r.oddPlan = row({ sub: 'active', plan: 'gold', paidThrough: '2027-08-01', portalLink: 'https://billing.example/p', features: [] });
      r.price = RR_PRICE_TEXT;
      // remembered per account: an outage keeps the plan
      rrFeaturesRemember({ features: ['collections'], plan: 'lite' });
      window._subState = null; r.kept = rrPlan();
      rrFeaturesRemember({ features: [], plan: 'gold' });
      r.keptOdd = rrPlan();
      state.user = { email: 'someone-else@example.test', name: 'Other' };
      rrFeaturesRemember; r.otherAccount = rrPlan();
      return r;
    });
    const has = (s, w) => String(s).indexOf(w) >= 0;
    T('F1 a Lite member sees "Pro Lite — Renews …"', /^My Subscription Pro Lite — Renews /.test(f.liteActive), f.liteActive);
    T('F2 ...and is NOT quoted the regular price', !has(f.liteActive, f.price), f.liteActive);
    T('F3 a Lite account made by hand: "Pro Lite — free until …", not "Beta tester"', has(f.liteBeta, 'Pro Lite — free until') && !has(f.liteBeta, 'Beta tester'), f.liteBeta);
    T('F4 a full Pro member still sees "Pro — Renews …" (not "Pro Lite")', /^My Subscription Pro — Renews /.test(f.proActive) && !has(f.proActive, 'Lite'), f.proActive);
    T('F5 an unknown plan word is a regular member (price shown, no "Pro")', has(f.oddPlan, f.price) && !has(f.oddPlan, 'Pro'), f.oddPlan);
    T('F6 the Lite plan is remembered for THIS account through an outage', f.kept === 'lite', f);
    T('F7 an unknown remembered plan reads regular; another account never inherits it', f.keptOdd === 'regular' && f.otherAccount === 'regular', f);
    T('F8 no script error in the page', errs.length === 0, errs);
    await pg.close();

    console.log('\n== G · PLANTED in the page ==');
    const { pg: pg2 } = await boot(browser, { 'collections-invoice.js': plantedInv });
    const PL = await sees(pg2, ['collections'], { plan: 'lite' });
    T('G1 PLANTED: invoices back on the collections switch → a Lite account would see invoices (caught)', PL.invoices === true, PL);
    await pg2.close();
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED  —  ' : 'ALL PASS  —  ') + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
