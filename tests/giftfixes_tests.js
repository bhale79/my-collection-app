// tests/giftfixes_tests.js — the gift list fixes of 2026-11-07 (topic giftfixes)
//
// From Brad's hand-test 2026-11-07 (TEST_QUEUE T-2026-11-01-06 FAILED):
//   "i cant tap yes thats it. i get a circle with a line through it" /
//   "same thing when i try the open it to check it" — the Open button carried a
//   stray quote in its data attribute, so the paste handler never found it.
//   The old tests called the functions directly and never saw it; THIS file
//   types into the real box and clicks the real buttons (their own onclick).
// Plan: PLAN_2026-11-07_GIFT_LIST_FIXES.md. Every check is proven able to fail
// on a planted offender (section P).
'use strict';
const fs = require('fs');
const path = require('path');
const APPDIR = path.join(__dirname, '..', 'app');
const APP = f => fs.readFileSync(path.join(APPDIR, f), 'utf8');
const GIFT = APP('gift-list.js'), CONFIG = APP('config.js'), STORE = APP('store-links.js');
const CONTACTS = APP('contacts.js'), DATA = APP('app-data.js'), CSS = APP('app.css');
const QRLIB = APP('vendor/qrcode-generator-2.0.4.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function block(src, start, end) {
  const i = src.indexOf(start);
  if (i < 0) return '';
  const j = src.indexOf(end, i);
  return src.slice(i, j + end.length);
}
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }
const tick = (w, ms) => new Promise(r => w.setTimeout(r, ms || 15));

// ── 1. Contacts: ONE read range, and it reaches "Preferred Vendor" ─────────
function colLetter(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function rangeChecks(cfg, ct, data) {
  const R = {};
  const m = cfg.match(/const RR_CONTACTS = \{\s*readRange: '([A-Z]+)2:([A-Z]+)',/);
  const heads = (ct.match(/var HEADERS = \[([^\]]*)\]/) || ['', ''])[1].split(',').filter(x => x.trim()).length;
  R.cfgCovers = !!m && m[1] === 'A' && m[2] === colLetter(heads) && heads === 17;
  R.ctUses = /sheetsGet\(_ctSheet\(\), TAB \+ '!' \+ RR_CONTACTS\.readRange\)/.test(ct);
  R.dataUses = /'Contacts!' \+ RR_CONTACTS\.readRange\)/.test(data);
  // no other way to read the tab: no literal "Contacts!A2:<col>" read anywhere
  R.noLiteral = !/['"]Contacts!A2:[A-Z]+['"]/.test(data) && !/TAB \+ '!A2:[A-Z]+'/.test(ct);
  return R;
}

// ── 2. A store is called by its STORE name ─────────────────────────────────
function vendorFns(ct) {
  const dom = block(ct, 'function _ctVendorDomain(', '\n  }');
  const pv = block(ct, 'function _ctPreferredVendors() {', '\n  }');
  // eslint-disable-next-line no-new-func
  return new Function('state', dom + '\n' + pv + '\nreturn _ctPreferredVendors;');
}
function vendorChecks(ct) {
  const R = {};
  const run = list => { try { return vendorFns(ct)({ contactsData: list })(); } catch (e) { return 'ERR ' + e.message; } };
  // Brad's own two contacts (2026-11-07): the owner first, then the store
  const a = run([
    { name: 'Scott Griggs', business: '', website: 'trainz.com', preferredVendor: true },
    { name: 'Trainz.com', business: 'Trainz', website: 'trainz.com', preferredVendor: true },
  ]);
  R.storeName = Array.isArray(a) && a.length === 1 && a[0].name === 'Trainz' && a[0].site === 'trainz.com';
  const b = run([{ name: 'Scott Griggs', business: '', website: 'https://www.trainz.com/', preferredVendor: true }]);
  R.websiteNotPerson = Array.isArray(b) && b.length === 1 && b[0].name === 'trainz.com';
  const c = run([{ name: '', business: "Mr. Muffin's", website: 'mrmuffinstrains.com', preferredVendor: true },
                 { name: 'Dave', business: 'Daves Trains', website: 'davestrains.com', preferredVendor: false }]);
  R.onlyPreferred = Array.isArray(c) && c.length === 1 && c[0].name === "Mr. Muffin's";
  return R;
}
function contactSaveChecks(ct) {
  return {
    storeOnlySaves: /if \(!name && !v\('ct-f-biz'\)\) \{ showToast\('Give them a name or a store name'/.test(ct) && ct.indexOf("if (!name) { showToast('Give them at least a name'") < 0,
    listShowsStore: /_esc\(c\.name \|\| c\.business\)/.test(ct),
    sortsByStore: /function _ctSortKey\(c\) \{ return _ctLastNameKey\(\(c && \(c\.name \|\| c\.business\)\) \|\| ''\); \}/.test(ct),
  };
}

const cssGrey = css => /\.rr-btn\[disabled\], \.rr-btn:disabled \{ opacity: 0\.4; cursor: not-allowed; filter: grayscale\(1\);/.test(css);

// ── the link cleaner: tracking pairs out, every other character kept ─────
function trackerChecks(store) {
  const sb = { module: { exports: {} } };
  // eslint-disable-next-line no-new-func
  new Function('module', 'window', block(CONFIG, 'const RR_LINK_TRACKERS = {', '\n};') + '\n' + store + '\nmodule.exports.T = RR_LINK_TRACKERS;')(sb.module, undefined);
  const f = sb.module.exports.rrStripTrackers;
  const cases = [
    ['https://www.trainz.com/products/a?srsltid=AYC', 'https://www.trainz.com/products/a'],
    ['https://x.com/p?variant=123&utm_source=g&gclid=9#top', 'https://x.com/p?variant=123#top'],
    ['https://x.com/p?flag&a=%20b,c~&UTM_Medium=x', 'https://x.com/p?flag&a=%20b,c~'],
    ['https://x.com/p#frag?utm_source=1', 'https://x.com/p#frag?utm_source=1'],
    ['https://x.com/p?variant=1', 'https://x.com/p?variant=1'],
    ['not a url', 'not a url'],
  ];
  const bad = cases.filter(([i, o]) => f(i) !== o).map(([i]) => i + ' -> ' + f(i));
  return { exact: bad.length === 0, bad: bad.join(' | ') };
}

// ── 3. The gift list on a real page, its own buttons clicked ───────────────
function page(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!doctype html><html><body><span id="gift-list-slot"></span></body></html>',
    { runScripts: 'dangerously', url: 'https://therailroster.com/app/' });
  const w = dom.window;
  w._opened = []; w._toasts = []; w._rows = []; w._pub = []; w._printed = []; w._calls = 0;
  w.open = function () { w._opened.push(String(arguments[0])); return null; };
  w.state = { personalSheetId: 'SHEET1', user: { email: 'bhale@ipd-llc.com' }, contactsData: [{}],
    wantData: opts.wants || {
      '2245-P|1': { itemNum: '2245-P', variation: '1', manufacturer: 'Lionel', expectedPrice: '700', listType: 'Want' },
      '2245C|': { itemNum: '2245C', variation: '', manufacturer: 'Lionel', expectedPrice: '700', listType: 'Want' },
    } };
  w.accessToken = 'tok';
  w.rrFeatureOn = n => n === 'giftlist';
  w.findMaster = (num, v) => (opts.masters && opts.masters[num + '|' + v]) || ({ roadName: 'Texas Special', description: 'F3 Diesel' });
  w.rrToday = () => '2026-11-07';
  w._formatDate = d => d;
  w._formatPrice = n => '$' + Number(n).toLocaleString();
  w._money = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[$,\s]/g, '')); return isFinite(n) ? n : 0; };
  w.rrUserName = () => 'Brad';
  w.showToast = m => { w._toasts.push(m); };
  w._ctPreferredVendors = () => [{ name: 'Trainz', site: 'trainz.com' }, { name: "Mr. Muffin's", site: 'mrmuffinstrains.com' }];
  w._ctOpenEdit = () => {};
  w._withTokenRetry = fn => fn();
  w.fetch = () => Promise.resolve({ json: () => Promise.resolve({ sheets: [{ properties: { title: 'Gift List' } }] }) });
  w.sheetsGet = () => Promise.resolve({ values: opts.giftRows || [] });
  w.sheetsUpdate = () => Promise.resolve({});
  w.sheetsAppend = (sh, range, values) => { w._rows.push(values[0]); return Promise.resolve(2); };
  w.rrVerifiedRowUpdate = (sh, tab, row, range, values) => { w._rows.push(values[0]); return Promise.resolve(true); };
  w.appConfirm = () => Promise.resolve(true);
  w.rrOpenLater = () => { const doc = { _h: '', open() {}, write(h) { this._h += h; }, close() { w._printed.push(this._h); } }; return { tab: { document: doc, focus() {}, print() {} }, drop() {} }; };
  const pubAnswers = (opts.pub || [{ status: 200, listId: 'c'.repeat(32) }]).slice();
  w.vaultPost = p => {
    if (p.action === 'gift_link') return Promise.resolve({ status: 200, listId: '' });
    if (p.action === 'gift_publish') { w._pub.push(p); const a = pubAnswers.length > 1 ? pubAnswers.shift() : pubAnswers[0]; return Promise.resolve(a); }
    return Promise.resolve(null);
  };
  Object.defineProperty(w.navigator, 'share', { value: d => { w._shared = d; if (opts.shareRefuses) { const e = new Error('no tap'); e.name = 'NotAllowedError'; return Promise.reject(e); } return Promise.resolve(); }, configurable: true });
  w.eval(block(CONFIG, 'const RR_AFFILIATE = [', '];') + '\nwindow.RR_AFFILIATE = RR_AFFILIATE;');
  w.eval((opts.cfg || block(CONFIG, 'const RR_GIFT = {', '\n};')) + '\nwindow.RR_GIFT = RR_GIFT;');
  w.eval(block(CONFIG, 'const RR_LINK_TRACKERS = {', '\n};') + '\nwindow.RR_LINK_TRACKERS = RR_LINK_TRACKERS;');
  w.eval(opts.store || STORE);
  w.eval(QRLIB);
  // the store reader: answers from the test, never the network
  w.rrStoreProduct = url => Promise.resolve(/gone/.test(url) ? { state: 'gone' } : { state: 'ok', name: 'Lionel 2245P', price: 121.61, inStock: true, image: 'https://cdn.shopify.com/a.jpg' });
  w.eval(opts.gift || GIFT);
  return w;
}
const $ = (w, s) => w.document.querySelector(s);
function typeInto(w, el, value) { el.value = value; el.dispatchEvent(new w.Event('input', { bubbles: true })); }

async function story(opts) {
  const R = {};
  const w = page(opts);
  await w.rrGiftOpen(); await tick(w, 30);
  // tick the 2245-P with its own checkbox
  const box = $(w, '[data-gift-on="2245-P|1"]');
  box.checked = true; box.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(w, 30);
  R.editKeepsVariation = /Lionel 2245-P \(1\)/.test($(w, '#gift-body').textContent);
  // "Find it at Trainz" — Trainz's own search, the number spelled as stores spell it
  const finds = Array.from(w.document.querySelectorAll('#gift-body button')).filter(b => /^Find it at/.test(b.textContent));
  const findTz = finds.find(b => /Trainz/.test(b.textContent)), findMm = finds.find(b => /Muffin/.test(b.textContent));
  if (findTz) findTz.click();
  R.trainzOwnSearch = w._opened[w._opened.length - 1] === 'https://www.trainz.com/search?q=Lionel%202245P';
  await tick(w, 20);
  const findMm2 = Array.from(w.document.querySelectorAll('#gift-body button')).find(b => /Find it at Mr/.test(b.textContent));
  if (findMm2) findMm2.click();
  R.otherStoreGoogle = /^https:\/\/www\.google\.com\/search\?q=.*site%3Amrmuffinstrains\.com$/.test(w._opened[w._opened.length - 1] || '');
  await tick(w, 20);
  // paste a link — with Google's tracking code — into the REAL box
  const openBtn0 = $(w, '[data-gift-open="2245-P|1"]');
  R.openStartsOff = !!openBtn0 && openBtn0.disabled === true;
  typeInto(w, $(w, '[data-gift-url="2245-P|1"]'), 'https://www.trainz.com/products/lionel-2245p-vintage?srsltid=AYCX9vIcM_Ww268');
  const openBtn = $(w, '[data-gift-open="2245-P|1"]'), yesBtn = $(w, '[data-gift-confirm="2245-P|1"]');
  R.openTurnsOn = !!openBtn && openBtn.disabled === false;
  R.yesStillOff = !!yesBtn && yesBtn.disabled === true;
  R.boxShowsClean = $(w, '[data-gift-url="2245-P|1"]').value === 'https://www.trainz.com/products/lionel-2245p-vintage';
  await tick(w, 700);   // the store read (half a second after the paste)
  if (openBtn) openBtn.click();
  R.openOpens = w._opened[w._opened.length - 1] === 'https://www.trainz.com/products/lionel-2245p-vintage';
  R.yesTurnsOn = !!yesBtn && yesBtn.disabled === false;
  if (yesBtn) yesBtn.click(); await tick(w, 60);
  const last = w._rows[w._rows.length - 1] || [];
  R.keptClean = last[5] === 'https://www.trainz.com/products/lionel-2245p-vintage' && last[4] === 'Trainz';
  // a page the store took down: both buttons greyed once it is read
  const b2 = $(w, '[data-gift-on="2245C|"]');
  b2.checked = true; b2.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(w, 30);
  typeInto(w, $(w, '[data-gift-url="2245C|"]'), 'https://www.trainz.com/products/lionel-2245c-gone');
  await tick(w, 700);
  const off = sel => { const b = $(w, sel); return !!b && b.disabled === true; };   // a planted page may not draw the button
  R.goneBothOff = off('[data-gift-open="2245C|"]') && off('[data-gift-confirm="2245C|"]');
  // what SHE sees — no "(1)"
  await w.rrGiftView('preview'); await tick(w, 30);
  R.previewNoVariation = /Lionel 2245-P — Texas Special F3 Diesel/.test($(w, '[data-gift-preview]').textContent) && !/\(1\)/.test($(w, '[data-gift-preview]').textContent);
  w.rrGiftEmail();
  const mail = decodeURIComponent(w._opened[w._opened.length - 1] || '');
  R.mailNoVariation = /Lionel 2245-P — Texas Special/.test(mail) && !/2245-P \(1\)/.test(mail);
  // the family link turned on — what goes to the page has no "(1)" either
  await w.rrGiftFamilyOn(); await tick(w, 30);
  const sent = JSON.stringify((w._pub[w._pub.length - 1] || {}).list || {});
  R.pageNoVariation = /Lionel 2245-P — Texas Special/.test(sent) && !/\(1\)/.test(sent);
  R.familyOn = !!$(w, '[data-gift-family-url]');
  // print: the photo beside its item
  await w.rrGiftPrint(); await tick(w, 400);
  const pr = w._printed[0] || '';
  R.printBeside = /<div class="it"><img class="ph" src="https:\/\/cdn\.shopify\.com\/a\.jpg" alt=""><div class="bd">/.test(pr) && /\.it\{display:flex;/.test(pr) && !/float:right/.test(pr);
  R.toasts = w._toasts.slice();
  return R;
}
// a link saved BEFORE today, with the tracking code, leaves clean
async function oldLinkStory(opts) {
  const w = page(Object.assign({ giftRows: [['2245C', '', 'Yes', '700', 'Trainz', 'https://www.trainz.com/products/lionel-2245c?srsltid=XYZ&variant=7', '2026-11-07', '', '', '', '']] }, opts || {}));
  await w.rrGiftOpen(); await tick(w, 30);
  await w.rrGiftView('preview'); await tick(w, 30);
  w.rrGiftEmail();
  const mail = decodeURIComponent(w._opened[w._opened.length - 1] || '');
  return { oldLinkClean: mail.indexOf('https://www.trainz.com/products/lionel-2245c?variant=7') >= 0 && mail.indexOf('srsltid') < 0 };
}
// a link saved under an OLD name ("trainz.com") shows the store's name now ("Trainz")
// — [stated] Brad 2026-11-07 12:40 CT "It says trainz and trainz.com"
async function labelStory(opts) {
  const w = page(Object.assign({ giftRows: [
    ['2245C', '', 'Yes', '700', 'trainz.com', 'https://www.trainz.com/products/lionel-2245c', '2026-11-07', '', '', '', ''],
    ['2245-P', '1', 'Yes', '121.61', 'Bobs Trains', 'https://www.bobstrains.com/p/2245p', '2026-11-07', '', '', '', ''],
  ] }, opts || {}));
  await w.rrGiftOpen(); await tick(w, 30);
  const mine = Array.from(w.document.querySelectorAll('#gift-body a')).map(a => a.textContent);
  await w.rrGiftView('preview'); await tick(w, 30);
  const prev = Array.from(w.document.querySelectorAll('[data-gift-preview] a')).map(a => a.textContent);
  w.rrGiftEmail();
  const mail = decodeURIComponent(w._opened[w._opened.length - 1] || '');
  await w.rrGiftFamilyOn(); await tick(w, 30);
  const sent = ((w._pub[w._pub.length - 1] || {}).list || { items: [] }).items.map(it => (it.links || []).map(L => L.store).join(',')).join('|');
  return {
    nowName: mine.indexOf('Trainz') >= 0 && mine.indexOf('trainz.com') < 0 && prev.indexOf('Trainz') >= 0 && prev.indexOf('trainz.com') < 0
      && /Trainz: https:\/\/www\.trainz\.com\/products\/lionel-2245c/.test(mail) && !/trainz\.com: /.test(mail) && /Trainz/.test(sent) && !/trainz\.com/.test(sent),
    otherKept: mine.indexOf('Bobs Trains') >= 0 && /Bobs Trains: https:\/\/www\.bobstrains\.com/.test(mail),
    detail: JSON.stringify({ mine, prev, sent }),
  };
}
// the family link: one retry; the right words
async function familyStory(pub, opts) {
  const w = page(Object.assign({ pub: pub }, opts || {}));
  await w.rrGiftOpen(); await tick(w, 30);
  const b = $(w, '[data-gift-on="2245C|"]'); b.checked = true; b.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(w, 30);
  await w.rrGiftView('preview'); await tick(w, 30);
  const p = w.rrGiftFamilyOn();
  const busyWords = ($(w, '[data-gift-family-on]') || {}).textContent || '';
  await p; await tick(w, 30);
  return { tries: w._pub.length, on: !!$(w, '[data-gift-family-url]'), toasts: w._toasts.slice(), busyWords: busyWords };
}

// Text when the family link can't be turned on, and when the phone refuses a late share
async function textStory(pub, opts) {
  const w = page(Object.assign({ pub: pub }, opts || {}));
  await w.rrGiftOpen(); await tick(w, 30);
  const b = $(w, '[data-gift-on="2245C|"]'); b.checked = true; b.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(w, 30);
  await w.rrGiftView('preview'); await tick(w, 30);
  await w.rrGiftText(); await tick(w, 40);
  return { text: (w._shared || {}).text || '', toasts: w._toasts.slice(), tries: w._pub.length };
}
// two versions of one item on the list
async function twinStory(opts) {
  const w = page(Object.assign({
    wants: { '6464-1|1': { itemNum: '6464-1', variation: '1', manufacturer: 'Lionel', expectedPrice: '90' },
             '6464-1|2': { itemNum: '6464-1', variation: '2', manufacturer: 'Lionel', expectedPrice: '120' } },
    masters: { '6464-1|1': { roadName: 'Western Pacific', description: 'Boxcar', varDesc: 'SILVER BODY, BLUE FEATHER' },
               '6464-1|2': { roadName: 'Western Pacific', description: 'Boxcar', varDesc: '' } },
  }, opts || {}));
  await w.rrGiftOpen(); await tick(w, 30);
  ['6464-1|1', '6464-1|2'].forEach(k => { const b = $(w, '[data-gift-on="' + k + '"]'); b.checked = true; b.dispatchEvent(new w.Event('change', { bubbles: true })); });
  await tick(w, 30);
  await w.rrGiftView('preview'); await tick(w, 30);
  const t = $(w, '[data-gift-preview]').textContent;
  return { distinct: /Lionel 6464-1 — Western Pacific Boxcar — Silver body, blue feather/.test(t) && /Lionel 6464-1 — Western Pacific Boxcar — version 2/.test(t) && !/\(1\)|\(2\)/.test(t), t: t };
}

(async function main() {
  section('1. Contacts: one read range that reaches "Preferred Vendor"');
  const C = rangeChecks(CONFIG, CONTACTS, DATA);
  ok('config.js RR_CONTACTS.readRange runs A to the last header column (Q, "Preferred Vendor")', C.cfgCovers);
  ok('contacts.js reads through it', C.ctUses);
  ok('app-data.js\'s background load reads through it (it said A2:P and dropped the stores)', C.dataUses);
  ok('no other Contacts read range is typed anywhere', C.noLiteral);

  section('2. A store is called by its store name');
  const V = vendorChecks(CONTACTS);
  ok('the owner (no business) and the store on one website → "Trainz", never "Scott Griggs"', V.storeName);
  ok('a person with no business name → the store\'s website, not the person', V.websiteNotPerson);
  ok('only contacts ticked "Preferred vendor" are stores', V.onlyPreferred);
  const S = contactSaveChecks(CONTACTS);
  ok('a contact saves with a store name and no person ("+ Trainz")', S.storeOnlySaves);
  ok('the contact list shows the store name when there is no person', S.listShowsStore);
  ok('a store-only contact sorts by its store name', S.sortsByStore);

  section('2b. Tracking codes off, everything else kept exactly');
  const TR = trackerChecks(STORE);
  ok('only the tracking pairs go — %20, a bare flag, a comma, a #…? part and upper-case UTM_ all handled', TR.exact, TR.bad);

  section('3. Buttons that can\'t be used look it');
  ok('a disabled button is greyed (no colour), not just dimmed', cssGrey(CSS));

  if (!JSDOM) { console.log('\nSKIP the screen checks — jsdom not installed here'); }
  let R = {}, O = {}, F1 = {}, F2 = {}, F3 = {};
  if (JSDOM) {
    section('4. The gift list — its real buttons');
    R = await story({});
    ok('his own screen keeps the variation "(1)"', R.editKeepsVariation);
    ok('"Find it at Trainz" opens Trainz\'s own search for "Lionel 2245P"', R.trainzOwnSearch);
    ok('another store is searched on Google, on its own website', R.otherStoreGoogle);
    ok('"Open it to check" starts off with an empty box', R.openStartsOff);
    ok('pasting a link turns "Open it to check" ON (Brad: the circle with a line through it)', R.openTurnsOn);
    ok('…"Yes, that\'s it" stays off until it is opened', R.yesStillOff);
    ok('the box shows the address without Google\'s tracking code', R.boxShowsClean);
    ok('the Open button opens the clean page', R.openOpens);
    ok('after opening, "Yes, that\'s it" turns on', R.yesTurnsOn);
    ok('the link is kept clean, under the store\'s name', R.keptClean);
    ok('a page the store took down greys BOTH buttons', R.goneBothOff);
    ok('the preview has no variation number (Brad: she might buy 2)', R.previewNoVariation);
    ok('the email has no variation number', R.mailNoVariation);
    ok('the family page gets no variation number', R.pageNoVariation && R.familyOn);
    ok('the printout puts the photo beside its item', R.printBeside);
    O = await oldLinkStory();
    ok('a link saved earlier with ?srsltid= leaves clean (its variant=… kept)', O.oldLinkClean);

    section('4b. One name per store, everywhere');
    const LB = await labelStory();
    ok('a link saved as "trainz.com" shows "Trainz" — his screen, preview, email and the family page', LB.nowName, LB.detail);
    ok('a store that is not one of his keeps the name it was saved with', LB.otherKept, LB.detail);

    section('5. The family link: one retry, the right words');
    F1 = await familyStory([null, { status: 200, listId: 'c'.repeat(32) }]);
    ok('no answer once → tried again by itself → on', F1.tries === 2 && F1.on, JSON.stringify(F1));
    ok('"Turning on…" while it works', /Turning on/.test(F1.busyWords), F1.busyWords);
    F2 = await familyStory([null, null]);
    ok('no answer twice → "Couldn\'t connect", not "isn\'t ready"', F2.tries === 2 && !F2.on && F2.toasts.some(t => /Couldn.t connect/.test(t)) && !F2.toasts.some(t => /ready yet/.test(t)), JSON.stringify(F2));
    F3 = await familyStory([{ status: 400, message: 'Unknown action' }]);
    ok('a backend without the family link → "isn\'t ready yet", asked once', F3.tries === 1 && F3.toasts.some(t => /ready yet/.test(t)), JSON.stringify(F3));
    const F4 = await familyStory([{ status: 401, message: 'proof' }]);
    ok('a "no" from the server (sign-in) is NOT asked twice, and is not called a connection problem', F4.tries === 1 && !F4.on && F4.toasts.some(t => /couldn.t be turned on/.test(t)) && !F4.toasts.some(t => /Couldn.t connect/.test(t)), JSON.stringify(F4));
    const F5 = await familyStory([{ status: 503 }, { status: 200, listId: 'c'.repeat(32) }]);
    ok('a server failure (5xx) is tried once more', F5.tries === 2 && F5.on, JSON.stringify(F5));

    section('6. Text');
    const T1 = await textStory([{ status: 200, listId: 'c'.repeat(32) }]);
    ok('Text with the link off: turns it on (after asking) and sends ONE line', /^Gift ideas — from Brad — see the list and mark what you’ve bought: https:\/\/therailroster\.com\/gift\/\?l=c{32}$/.test(T1.text), T1.text);
    const T2 = await textStory([null, null]);
    ok('no signal: the link can\'t turn on → the FULL list still goes, and he is told why', /1\. Lionel 2245C/.test(T2.text) && !/therailroster\.com\/gift/.test(T2.text) && T2.toasts.some(t => /full list instead/.test(t)), JSON.stringify(T2));
    const T3 = await textStory([{ status: 200, listId: 'c'.repeat(32) }], { shareRefuses: true });
    ok('the phone refuses a late share → "tap Text again" (the link IS on)', T3.toasts.some(t => /tap Text again/.test(t)), JSON.stringify(T3.toasts));

    section('7. Two versions of one item');
    const TW = await twinStory();
    ok('each gets words that tell them apart — never a bare "(1)" / "(2)"', TW.distinct, TW.t);
  }

  section('P. Planted offenders');
  {
    const r1 = rangeChecks(CONFIG, CONTACTS, DATA.replace("'Contacts!' + RR_CONTACTS.readRange)", "'Contacts!A2:P')"));
    ok('PLANT app-data.js back to A2:P — caught', !r1.dataUses && !r1.noLiteral);
    const r2 = rangeChecks(CONFIG.replace("readRange: 'A2:Q'", "readRange: 'A2:P'"), CONTACTS, DATA);
    ok('PLANT the range one column short — caught', !r2.cfgCovers);
    const v1 = vendorChecks(CONTACTS.replace("var label = String(c.business || '').trim() || d;", "var label = c.business || c.name || d;"));
    ok('PLANT a person\'s name as the store — caught', !v1.websiteNotPerson);
    const v2 = vendorChecks(CONTACTS.replace("if (out[at[d]].name === d && label !== d) out[at[d]].name = label;", ''));
    ok('PLANT the first contact on a website wins regardless — caught', !v2.storeName);
    const s1 = contactSaveChecks(CONTACTS.replace("if (!name && !v('ct-f-biz')) { showToast('Give them a name or a store name'", "if (!name) { showToast('Give them at least a name'"));
    ok('PLANT a person\'s name required again — caught', !s1.storeOnlySaves);
    ok('PLANT a disabled button only dimmed — caught', !cssGrey(CSS.replace('filter: grayscale(1)', 'filter: none')));
  }
  {
    const t1 = trackerChecks(STORE.replace("return base + (kept.length ? '?' + kept.join('&') : '') + hash;", "var u = new URL(s); u.search = new URLSearchParams(kept.join('&')).toString(); return u.toString().replace(/\\?$/, '');"));
    ok('PLANT the address rebuilt (its spelling changed) — caught', !t1.exact);
    const t2 = trackerChecks(STORE.replace("k = k.toLowerCase();", ''));
    ok('PLANT upper-case UTM_ kept — caught', !t2.exact);
  }
  if (JSDOM) {
    const plant = async (label, from, to, run, caught) => {
      if (GIFT.indexOf(from) < 0) { ok('PLANT ' + label + ' — the plant applied', false, 'pattern not found'); return; }
      ok('PLANT ' + label + ' — caught', caught(await run({ gift: GIFT.split(from).join(to) })));
    };
    await plant('the stray quote put back on the Open button', `'<button class="rr-btn" data-gift-open="' + _esc(k) + '"`, `'<button class="rr-btn" data-gift-open=""' + _esc(k) + '"`, story, P => !P.openTurnsOn);
    await plant('Google again for Trainz', "if (own) {", "if (false) {", story, P => !P.trainzOwnSearch);
    await plant('the variation sent to her', "(e.variation && !forFamily ? ' ('", "(e.variation ? ' ('", story, P => !P.previewNoVariation && !P.mailNoVariation && !P.pageNoVariation);
    await plant('tracking codes kept on paste', "p.url = _clean(raw); p.opened = false;", "p.url = raw; p.opened = false;", story, P => !P.boxShowsClean && !P.keptClean);
    await plant('tracking codes kept on the way out', "var clean = _clean(L.url);", "var clean = L.url;", oldLinkStory, P => !P.oldLinkClean);
    await plant('a gone page leaves Open on', "          if (o2) o2.disabled = true;\n", '', story, P => !P.goneBothOff);
    await plant('no retry', "return once().then(function (ok) { return (ok || _family.why !== 'net') ? ok : once(); });", 'return once();', o => familyStory([null, { status: 200, listId: 'c'.repeat(32) }], o), P => P.tries === 1 && !P.on);
    await plant('"isn\'t ready" for every failure', "function _familyFailWords() { return _family.why === 'old' ? _F('notYet') : _family.why === 'err' ? _F('refused') : _F('noConnect'); }", "function _familyFailWords() { return _F('notYet'); }", o => familyStory([null, null], o), P => !P.toasts.some(t => /Couldn.t connect/.test(t)));
    await plant('every failure asked twice', "return once().then(function (ok) { return (ok || _family.why !== 'net') ? ok : once(); });", "return once().then(function (ok) { return (ok || _family.why === 'old') ? ok : once(); });", o => familyStory([{ status: 401, message: 'proof' }], o), P => P.tries === 2);
    await plant('no text at all when the link fails', "if (!okd) { _toast(_familyFailWords() + ' ' + _F('textFull'), 6000, true); _sendText(_text(o), true); return; }", "if (!okd) { _toast(_familyFailWords(), 6000, true); return; }", o => textStory([null, null], o), P => !/1\. Lionel 2245C/.test(P.text));
    await plant('two versions sent with the same name', "      if (seen[it.name] < 2) return;", "      return;", twinStory, P => !P.distinct);
    await plant('the saved name wins over the store\'s name', "return (s && s.name) || (L && L.store) || _hostOf(L && L.url).replace(/^www\\./, '');", "return (L && L.store) || (s && s.name) || _hostOf(L && L.url).replace(/^www\\./, '');", labelStory, P => !P.nowName);
    await plant('the photo floated off to the side again', ".it{display:flex;gap:14px;align-items:flex-start}", ".it{overflow:hidden}", story, P => !P.printBeside);
  }

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log('CRASH', e && e.stack || e); process.exit(1); });
