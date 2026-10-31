// ════════════════════════════════════════════════════════════════════════════
// gift_list_tests.js — THE GIFT WISH LIST, Stage 1 (owner-only beta).
//
// [stated] Brad, 2026-10-31: the Want list as a birthday / Christmas wish list
// for his wife; "the user too needs to verify the link is correct before he can
// send it out"; owner-only; no "bought" boxes; nothing starts ticked; the
// disclosure line in his approved words. Plan PLAN_2026-10-31_GIFT_LIST_STAGE1.md.
//
// The REAL app/gift-list.js, the REAL RR_GIFT and RR_AFFILIATE blocks from
// app/config.js, the REAL app/store-links.js and the REAL self-hosted QR maker
// run inside jsdom, with the sheet calls recorded:
//   A  the switch: no button and no screen unless rrFeatureOn('giftlist')
//   B  nothing starts ticked; only ticked items ever go out
//   C  a link is kept only after it was OPENED from here and confirmed, and only
//      when it is on the chosen store's own website ("Another store" on purpose)
//   D  every link in the email / text carries the store code through the last
//      stop (rrAffiliateUrl); with the code blank it leaves unchanged; the
//      disclosure shows only when a link carries a code, in Brad's words
//   E  the printout: one QR per link, made from the CODED link
//   F  saving: the tab is made on first save; a tick then a price typed straight
//      after are BOTH written, the second as an update of the same row (never a
//      second row); the saved row has the agreed columns
//   G  the collector's words are drawn as words (escaped)
//   H  wiring: index.html, the service worker, the Want/Upgrade page hook, the
//      tab registered where it is born, settings only in config.js, no "AI"
//   P  planted offenders: each bad habit put back turns its check red
// Run:  node tests/gift_list_tests.js
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APPDIR = path.join(__dirname, '..', 'app');
const APP = f => fs.readFileSync(path.join(APPDIR, f), 'utf8');
const GIFT = APP('gift-list.js'), CONFIG = APP('config.js'), STORE = APP('store-links.js');
const INDEX = APP('index.html'), SW = APP('sw.js'), PAGES = APP('app-pages.js');
const QRLIB = APP('vendor/qrcode-generator-2.0.4.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }

function block(src, start, end) {
  const i = src.indexOf(start);
  if (i < 0) return '';
  const j = src.indexOf(end, i);
  return src.slice(i, j + end.length);
}
const GIFT_CFG = block(CONFIG, 'const RR_GIFT = {', '\n};');
const AFF_BLANK = block(CONFIG, 'const RR_AFFILIATE = [', '];');
const AFF_CODE = "const RR_AFFILIATE = [ { store: 'Trainz', host: 'trainz.com', params: { ref: 'TEST1' }, wrap: '' } ];";
const tick = (w, ms) => new Promise(r => w.setTimeout(r, ms || 15));

// One page: the real blocks and files, the app's helpers stubbed and recorded.
function page(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!doctype html><html><body><span id="gift-list-slot"></span></body></html>',
    { runScripts: 'outside-only', url: 'https://therailroster.com/app/' });
  const w = dom.window;
  w._opened = []; w._writes = []; w._appends = []; w._updates = []; w._toasts = []; w._shared = []; w._printed = [];
  w._qrData = [];
  w.open = function () { w._opened.push(Array.prototype.slice.call(arguments)); return null; };
  w.state = { personalSheetId: 'SHEET1', user: { email: 'bhale@ipd-llc.com' }, contactsData: [{}],
    wantData: opts.wants || {
      '2343|': { itemNum: '2343', variation: '', manufacturer: 'Lionel', expectedPrice: '350', listType: 'Want' },
      '6464-1|': { itemNum: '6464-1', variation: '', manufacturer: 'Lionel', expectedPrice: '', listType: 'Want' },
    } };
  w.accessToken = 'tok';
  w.rrFeatureOn = function (n) { return opts.featureOn !== false && n === 'giftlist'; };
  w.rrBetaBadge = function () { return '<span>BETA</span>'; };
  w.findMaster = function (num) { return (opts.masters || { '2343': { roadName: 'Santa Fe', description: 'F3 A unit' }, '6464-1': { roadName: 'Western Pacific', description: 'Boxcar' } })[num] || null; };
  w.rrToday = function () { return '2026-10-31'; };
  w._formatDate = function (d) { return d; };
  w._formatPrice = function (n) { return '$' + Number(n).toLocaleString(); };
  w._money = function (v) { const n = parseFloat(String(v == null ? '' : v).replace(/[$,\s]/g, '')); return isFinite(n) ? n : 0; };
  w.rrUserName = function () { return 'Brad'; };
  w.showToast = function (m) { w._toasts.push(m); };
  w._ctPreferredVendors = function () { return [{ name: 'Trainz', site: 'trainz.com' }, { name: "Mr. Muffin's", site: 'mrmuffinstrains.com' }]; };
  w._ctOpenEdit = function () {};
  w._withTokenRetry = function (fn) { return fn(); };
  w._tabExists = !!opts.tabExists;
  w.fetch = function (url, init) {
    if (/batchUpdate/.test(url)) { w._writes.push({ kind: 'addSheet', body: init.body }); w._tabExists = true; return Promise.resolve({ json: () => Promise.resolve({}) }); }
    return Promise.resolve({ json: () => Promise.resolve({ sheets: w._tabExists ? [{ properties: { title: 'Gift List' } }] : [] }) });
  };
  w.sheetsGet = function () { return opts.giftRows ? Promise.resolve({ values: opts.giftRows }) : Promise.reject(new Error('Unable to parse range: Gift List!A2:K')); };
  w.sheetsUpdate = function (sh, range, values) { w._updates.push({ range, values }); w._writes.push({ kind: 'update', range, values }); return Promise.resolve({}); };
  w.sheetsAppend = function (sh, range, values) {
    w._appends.push({ range, values }); w._writes.push({ kind: 'append', range, values });
    return new Promise(r => w.setTimeout(() => r(3), 20));   // a real append takes a moment
  };
  w.rrVerifiedRowUpdate = function (sh, tab, row, range, values) { w._writes.push({ kind: 'rowupdate', row, range, values }); return Promise.resolve(true); };
  w.rrOpenLater = function () {
    const doc = { _html: '', open() {}, write(h) { this._html += h; }, close() { w._printed.push(this._html); } };
    return { tab: { document: doc, focus() {}, print() {} }, drop() {} };
  };
  Object.defineProperty(w.navigator, 'share', { value: function (d) { w._shared.push(d); return Promise.resolve(); }, configurable: true });
  w.eval((opts.aff || AFF_BLANK) + '\nwindow.RR_AFFILIATE = RR_AFFILIATE;');
  w.eval(GIFT_CFG + '\nwindow.RR_GIFT = RR_GIFT;');
  w.eval(opts.store || STORE);
  w.eval(QRLIB);
  // record what the QR maker is asked to draw
  const realQr = w.qrcode;
  w.qrcode = function (t, l) { const q = realQr(t, l); const add = q.addData.bind(q); q.addData = function (d) { w._qrData.push(d); return add(d); }; return q; };
  w.eval(opts.gift || GIFT);
  return w;
}
const $ = (w, sel) => w.document.querySelector(sel);
const $$ = (w, sel) => Array.prototype.slice.call(w.document.querySelectorAll(sel));

// The whole story once, returning named results — run on the real file and on
// each planted offender.
async function story(opts) {
  const R = {};
  // A — the switch
  const off = page(Object.assign({}, opts, { featureOn: false }));
  off.rrGiftPaintButton();
  await off.rrGiftOpen();
  R.offNoButton = $(off, '#gift-list-btn') === null;
  R.offNoScreen = $(off, '#gift-ov') === null;
  const w = page(opts);
  w.rrGiftPaintButton();
  R.onButton = !!$(w, '#gift-list-btn');
  await w.rrGiftOpen(); await tick(w);
  R.onScreen = !!$(w, '#gift-ov');
  // B — nothing starts ticked
  R.noneTicked = $$(w, '[data-gift-on]').length === 2 && $$(w, '[data-gift-on]').every(c => !c.checked);
  R.previewBlockedEmpty = !!$(w, 'button[disabled]') && /Preview and send \(0\)/.test(w.document.body.textContent);
  // F — tick then a price straight away
  w.rrGiftTick('2343|', true);
  w.rrGiftPrice('2343|', '375');
  await tick(w, 120);
  const rowsWritten = w._writes.filter(x => x.kind === 'append' || x.kind === 'rowupdate');
  R.tabMade = w._writes.some(x => x.kind === 'addSheet' && /"title":"Gift List"/.test(x.body)) && w._updates.some(u => /^Gift List!A1:K1$/.test(u.range));
  R.oneAppendThenUpdate = w._appends.length === 1 && rowsWritten.length === 2 && rowsWritten[1].kind === 'rowupdate' && rowsWritten[1].row === 3;
  R.priceLanded = rowsWritten.length === 2 && rowsWritten[1].values[0][3] === 375 && rowsWritten[1].values[0][2] === 'Yes' && rowsWritten[1].values[0][0] === '2343';
  R.rowShape = rowsWritten.length > 0 && rowsWritten[0].values[0].length === 11;
  // C — the link check
  w.rrGiftPendingUrl('2343|', 'https://www.trainz.com/products/lionel-2343-santa-fe-f3');
  R.storeGuessed = ($(w, '[data-gift-store="2343|"]') || {}).value === 'trainz.com';
  R.confirmLocked = ($(w, '[data-gift-confirm="2343|"]') || {}).disabled === true;
  w.rrGiftConfirm('2343|'); await tick(w, 120);
  R.unopenedRefused = !/trainz\.com\/products/.test(JSON.stringify(w._writes)) && w._toasts.some(t => /Open the link first/.test(t));
  const opensBefore = w._opened.length;
  w.rrGiftOpenPending('2343|');
  R.openedForCheck = w._opened.length === opensBefore + 1 && /lionel-2343-santa-fe-f3/.test(String(w._opened[w._opened.length - 1][0]));
  w.rrGiftConfirm('2343|'); await tick(w, 120);
  const lastRow = w._writes.filter(x => x.kind === 'rowupdate').pop();
  R.linkKept = !!lastRow && lastRow.values[0][4] === 'Trainz' && lastRow.values[0][5] === 'https://www.trainz.com/products/lionel-2343-santa-fe-f3' && lastRow.values[0][6] === '2026-10-31';
  // wrong store
  w.rrGiftTick('6464-1|', true); await tick(w, 120);
  w.rrGiftPendingStore('6464-1|', 'mrmuffinstrains.com');
  w.rrGiftPendingUrl('6464-1|', 'https://www.trainz-deals.example/6464');
  w.rrGiftPendingStore('6464-1|', 'mrmuffinstrains.com');
  const t0 = w._toasts.length, o0 = w._opened.length;
  w.rrGiftOpenPending('6464-1|');
  R.wrongStoreRefused = w._opened.length === o0 && w._toasts.length === t0 + 1 && /not on Mr\. Muffin/.test(w._toasts[w._toasts.length - 1]);
  w.rrGiftPendingStore('6464-1|', '__other');
  w.rrGiftOpenPending('6464-1|');
  w.rrGiftConfirm('6464-1|'); await tick(w, 120);
  const r2 = w._writes.filter(x => x.kind === 'rowupdate' || x.kind === 'append').pop();
  R.otherStoreOnPurpose = !!r2 && r2.values[0][5] === 'https://www.trainz-deals.example/6464' && r2.values[0][4] === 'trainz-deals.example';
  // B — only ticked items go out (untick 6464-1)
  w.rrGiftTick('6464-1|', false); await tick(w, 120);
  // D — what goes out
  w.rrGiftView('preview');
  R.previewShows = /Gift ideas — from Brad/.test($(w, '[data-gift-preview]') ? $(w, '[data-gift-preview]').textContent : '');
  R.onlyTicked = !/Western Pacific/.test(($(w, '[data-gift-preview]') || {}).textContent || 'x') && /Santa Fe/.test(($(w, '[data-gift-preview]') || {}).textContent || '');
  w.rrGiftEmail();
  const mail = decodeURIComponent(String((w._opened[w._opened.length - 1] || [])[0] || ''));
  w.rrGiftText();
  const txt = (w._shared[w._shared.length - 1] || {}).text || '';
  R.mail = mail; R.txt = txt;
  R.disclosureShown = !!$(w, '[data-gift-disclosure]');
  // E — print
  await w.rrGiftPrint(); await tick(w, 500);
  R.printed = w._printed[0] || '';
  R.qrData = w._qrData.slice();
  R.toasts = w._toasts.slice();
  w.rrGiftClose();
  R.closed = $(w, '#gift-ov') === null;
  // G — words drawn as words
  const x = page(Object.assign({}, opts, { masters: { '2343': { roadName: '<img src=x onerror=alert(1)>', description: 'F3' } } }));
  await x.rrGiftOpen(); await tick(x);
  R.escaped = !$(x, '#gift-ov img') && /&lt;img/.test($(x, '#gift-ov').innerHTML);
  return R;
}

(async function main() {
  if (!JSDOM) { console.log('SKIP — jsdom not installed here'); process.exit(0); }

  section('A. The switch (owner-only beta)');
  const R = await story({});
  ok('switch off: no Gift list button on the Want/Upgrade page', R.offNoButton);
  ok('switch off: the screen will not open', R.offNoScreen);
  ok('switch on: the button is drawn', R.onButton);
  ok('switch on: the screen opens', R.onScreen);

  section('B. Nothing starts ticked; only ticked items go out');
  ok('both Want items listed, neither ticked', R.noneTicked);
  ok('Preview and send is off with nothing ticked', R.previewBlockedEmpty);
  ok('an unticked item never reaches the preview', R.onlyTicked);
  ok('the preview reads "Gift ideas — from Brad"', R.previewShows);

  section('C. Every link is checked by the collector before it can be kept');
  ok('the store is recognised from the pasted address', R.storeGuessed);
  ok('"Yes, that\'s it" stays off until the link is opened', R.confirmLocked);
  ok('confirming an unopened link keeps nothing', R.unopenedRefused);
  ok('"Open it to check" opens the pasted page', R.openedForCheck);
  ok('after opening, the link is kept with its store and today\'s date', R.linkKept);
  ok('a page on another website is refused for the chosen store', R.wrongStoreRefused);
  ok('"Another store" takes an outside page on purpose', R.otherStoreOnPurpose);

  section('D. What goes out — the code blank (as shipped)');
  ok('email: the link leaves exactly as pasted', R.mail.indexOf('https://www.trainz.com/products/lionel-2343-santa-fe-f3\n') >= 0 || /lionel-2343-santa-fe-f3(\s|$)/.test(R.mail), R.mail.slice(0, 300));
  ok('email: no disclosure line when no link carries a code', R.mail.indexOf('commission') < 0);
  ok('preview: no disclosure line when no link carries a code', !R.disclosureShown);
  ok('text: the item, its price and the store link', /2343/.test(R.txt) && /about \$375/.test(R.txt) && /Trainz: https:\/\/www\.trainz\.com/.test(R.txt), R.txt);

  section('D2. What goes out — a test store code');
  const C = await story({ aff: AFF_CODE });
  const coded = 'https://www.trainz.com/products/lionel-2343-santa-fe-f3?ref=TEST1';
  ok('email: the Trainz link carries the code', C.mail.indexOf(coded) >= 0, C.mail.slice(0, 400));
  ok('text: the Trainz link carries the code', C.txt.indexOf(coded) >= 0);
  ok('email: the disclosure line, in Brad\'s words', C.mail.indexOf('Some links on this list may earn The Rail Roster a small commission, at no extra cost to you.') >= 0);
  ok('preview: the disclosure line is shown', C.disclosureShown);
  ok('the saved link is the PASTED one (the code is added only on the way out)', C.linkKept);

  section('E. The printout');
  ok('a print page was written', /<h1>Gift ideas — from Brad<\/h1>/.test(C.printed), C.printed.slice(0, 200));
  ok('a QR code is drawn beside the link', /<svg/.test(C.printed) && /data-qr-url="https:\/\/www\.trainz\.com\/products\/lionel-2343-santa-fe-f3\?ref=TEST1"/.test(C.printed));
  ok('the QR is made from the CODED link', C.qrData.length === 1 && C.qrData[0] === coded, JSON.stringify(C.qrData));
  ok('the printout carries the disclosure when coded', /small commission/.test(C.printed));
  ok('each code has its blank border (a phone camera needs it to read the code)', /createSvgTag\(3, 4\)/.test(GIFT));
  ok('code blank: the QR holds the link as pasted', R.qrData.length === 1 && R.qrData[0] === 'https://www.trainz.com/products/lionel-2343-santa-fe-f3');
  ok('code blank: no disclosure on the printout', !/commission/.test(R.printed));
  ok('nothing went wrong while printing (no error toasts)', !R.toasts.some(t => /could not|blocked/i.test(t)), JSON.stringify(R.toasts));

  section('F. Saving');
  ok('the "Gift List" tab is made on the first save, with its header row', R.tabMade);
  ok('tick then a price: ONE new row, then an update of that same row', R.oneAppendThenUpdate);
  ok('the price typed straight after the tick lands', R.priceLanded);
  ok('the saved row has the 11 agreed columns', R.rowShape);
  ok('the ✕ closes the screen', R.closed);

  section('G. Words drawn as words');
  ok('a catalog name with markup is shown as text, never run', R.escaped);

  section('H. Wiring');
  const giftTag = INDEX.indexOf('./gift-list.js?v='), sellTag = INDEX.indexOf('./sell.js?v='), ctTag = INDEX.indexOf('./contacts.js?v='), storeTag = INDEX.indexOf('./store-links.js?v=');
  ok('index.html loads gift-list.js after contacts.js, sell.js and store-links.js', giftTag > sellTag && giftTag > ctTag && giftTag > storeTag && sellTag > 0);
  ok('the Want/Upgrade page has the button slot', /<span id="gift-list-slot"><\/span>/.test(INDEX));
  ok('the service worker caches gift-list.js', /'\.\/gift-list\.js'/.test(SW));
  ok('buildUpgradePage draws the button on every render', /function buildUpgradePage\(\)[\s\S]{0,2200}rrGiftPaintButton\(\)/.test(PAGES));
  ok('the tab is registered where it is born', /var TAB = \(typeof rrFeatureTab === 'function' \? rrFeatureTab : String\)\('Gift List'\);/.test(GIFT));
  ok('the switch is RR_GIFT.feature through rrFeatureOn', /rrFeatureOn\(_G\(\)\.feature \|\| 'giftlist'\)/.test(GIFT) && /feature: 'giftlist'/.test(GIFT_CFG));
  ok('the disclosure words live only in config.js', GIFT.indexOf('small commission') < 0 && /disclosure: 'Some links on this list may earn The Rail Roster a small commission, at no extra cost to you\.'/.test(GIFT_CFG));
  ok('Trainz is only SUGGESTED (config), never hard-coded in the screen', !/trainz/i.test(GIFT.replace(/^\s*\/\/.*$/gm, '')) && /suggestedStores: \[\{ name: 'Trainz', site: 'trainz\.com' \}\]/.test(GIFT_CFG));
  ok('every link out goes through the last stop (rrAffiliateUrl in _outgoing)', /function _outgoing\(\)[\s\S]{0,600}rrAffiliateUrl\(L\.url\)/.test(GIFT));
  ok('no "AI" in anything a person reads', !/\bAI\b|🤖/.test(GIFT.replace(/^\s*\/\/.*$/gm, '')));
  ok('no "bought" boxes (Brad: hidden or not at all)', !/bought/i.test(GIFT.replace(/^\s*\/\/.*$/gm, '')));
  ok('the pop-up uses the phone-safe height (dvh twin) and Back closes it', /max-height:94vh;max-height:94dvh/.test(GIFT) && /rrDismissGuard\(ov, _close\)/.test(GIFT));

  section('P. Planted offenders');
  const plant = async (label, from, to, check, opts) => {
    const src = GIFT.replace(from, to);
    if (src === GIFT) { ok('PLANT ' + label + ' — the plant applied', false, 'pattern not found'); return; }
    const P = await story(Object.assign({ gift: src }, opts || {}));
    ok('PLANT ' + label + ' — caught', !check(P));
  };
  await plant('switch ignored', "try { return typeof rrFeatureOn === 'function' && rrFeatureOn(_G().feature || 'giftlist'); } catch (e) { return false; }", 'return true;', P => P.offNoButton && P.offNoScreen);
  await plant('items start ticked', "on: false,\n                                price:", "on: true,\n                                price:", P => P.noneTicked);
  await plant('confirm without opening', "if (!p.url || !p.opened) {", "if (!p.url) {", P => P.unopenedRefused);
  await plant('any website accepted for a store', "if (!_hostIs(host, p.store)) {", "if (false) {", P => P.wrongStoreRefused);
  await plant('link leaves without the last stop', "var out = (typeof rrAffiliateUrl === 'function') ? rrAffiliateUrl(L.url) : L.url;", 'var out = L.url;', P => P.mail.indexOf('?ref=TEST1') >= 0 && P.qrData[0] === 'https://www.trainz.com/products/lionel-2343-santa-fe-f3?ref=TEST1', { aff: AFF_CODE });
  await plant('disclosure always shown', "disclosure: coded ? (_G().disclosure || '') : ''", "disclosure: (_G().disclosure || '')", P => P.mail.indexOf('commission') < 0 && !P.disclosureShown);
  await plant('a busy row drops the next change', "if (_busy[k]) { _again[k] = true; return _busy[k]; }", "if (_busy[k]) { return _busy[k]; }", P => P.priceLanded);
  await plant('a busy row writes twice at once', "if (_busy[k]) { _again[k] = true; return _busy[k]; }", "", P => P.oneAppendThenUpdate);
  await plant('names drawn raw', "'<span style=\"font-weight:600;color:var(--text)\">' + _esc(_name(e)) + '</span>'", "'<span style=\"font-weight:600;color:var(--text)\">' + _name(e) + '</span>'", P => P.escaped);
  await plant('unticked items sent', "if (!g || !g.on) return;", "if (!g) return;", P => P.onlyTicked);

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log('CRASH', e && e.stack || e); process.exit(1); });
