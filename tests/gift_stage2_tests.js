// ════════════════════════════════════════════════════════════════════════════
// gift_stage2_tests.js — THE GIFT LIST, Stage 2: the store's own details and
// the link check (2026-11-05).
//
// [stated] Brad 2026-11-04 21:37 CT "can we go ahead and do these" →
// PLAN_2026-11-04_GIFT_LIST_STAGE2_AND_BOUGHT.md; 2026-11-05 05:22 CT "any
// reason we can't do both?" → "yes" (Trainz and Mr. Muffin's read by the app
// itself, every other store through the backend). The store's price never
// replaces his own by itself ([stated] 2026-11-03 "we dont need to quietly
// fill anything").
//
// The REAL app/store-links.js, the REAL RR_STORE_READ / RR_GIFT / RR_AFFILIATE
// blocks from app/config.js, the REAL app/gift-list.js and the self-hosted QR
// maker run inside jsdom. The stores and the backend are stand-ins that answer
// the way the real ones do (Shopify's /products/<page>.js: prices in CENTS,
// the picture as //cdn…, 404 when the page is gone):
//   S  the ONE store reader: direct for the two listed stores, the backend for
//      the rest, a look-alike is not a listed store, gone / can't-read / slow,
//      a can't-read answer is never kept, force asks again
//   W  wiring: each direct store is on the page's security list (CSP), the
//      backend call carries the sign-in proof, the service worker never keeps a
//      store's product data, the words live in config.js
//   G  the gift screen: what a pasted link shows, a gone page can't be
//      confirmed, "Use store price" is the ONLY way the store's price lands,
//      Preview reads every link first, a gone link is left off (and said so),
//      sold out is shown but never blocks, the store photo in preview + print
//   P  planted offenders: each one put back turns its own check red
// Run:  node tests/gift_stage2_tests.js
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const APPDIR = path.join(__dirname, '..', 'app');
const APP = f => fs.readFileSync(path.join(APPDIR, f), 'utf8');
const GIFT = APP('gift-list.js'), CONFIG = APP('config.js'), STORE = APP('store-links.js');
const INDEX = APP('index.html'), SW = APP('sw.js'), VAULT = APP('vault.js');
const QRLIB = APP('vendor/qrcode-generator-2.0.4.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + String(detail).slice(0, 300) : '')); }
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
const cfgBlocks = cfg => ({
  gift: block(cfg, 'const RR_GIFT = {', '\n};'),
  read: block(cfg, 'const RR_STORE_READ = {', '\n};'),
  aff: block(cfg, 'const RR_AFFILIATE = [', '];'),
});
const tick = (w, ms) => new Promise(r => w.setTimeout(r, ms || 15));

// ── the stand-in stores (Shopify's real shape) ──────────────────────────────
const F3 = { id: 1, title: 'Lionel 2343 Santa Fe F3 AA', price: 34995, available: true,
  featured_image: '//cdn.shopify.com/s/files/1/x/2343.jpg',
  variants: [{ id: 11, title: 'Default Title', price: 34995, available: true }] };
const BOX = { id: 2, title: 'Lionel 6464-1 Western Pacific Boxcar', price: 8900, available: false,
  featured_image: '//cdn.shopify.com/s/files/1/x/6464.jpg',
  variants: [{ id: 21, title: 'C6', price: 8900, available: false }, { id: 22, title: 'C8', price: 12500, available: true, featured_image: { src: 'https://cdn.shopify.com/s/files/1/x/6464c8.jpg' } }] };
const STORES = {
  'https://www.trainz.com/products/lionel-2343-santa-fe-f3.js': { status: 200, body: F3 },
  'https://www.trainz.com/products/lionel-6464-1-wp.js': { status: 200, body: BOX },
  'https://www.trainz.com/products/sold-and-gone.js': { status: 404, body: { error: 'not found' } },
  'https://www.trainz.com/products/server-trouble.js': { status: 500, body: 'oops', raw: true },
  'https://www.trainz.com/products/not-json.js': { status: 200, body: '<html>', raw: true },
  'https://www.trainz.com/products/very-slow.js': { never: true },
  'https://mrmuffinstrains.com/products/lionel-2343-santa-fe-f3.js': { status: 200, body: Object.assign({}, F3, { price: 32900 }) },
};

// One page. opts.relay(payload) answers the backend; opts.gift / opts.store /
// opts.cfg swap in a planted copy.
function page(opts) {
  opts = opts || {};
  const B = cfgBlocks(opts.cfg || CONFIG);
  const dom = new JSDOM('<!doctype html><html><body><span id="gift-list-slot"></span></body></html>',
    { runScripts: 'outside-only', url: 'https://therailroster.com/app/' });
  const w = dom.window;
  w._fetched = []; w._posted = []; w._opened = []; w._writes = []; w._toasts = []; w._shared = []; w._printed = []; w._qrData = [];
  w.open = function () { w._opened.push(Array.prototype.slice.call(arguments)); return null; };
  w.state = { personalSheetId: 'SHEET1', user: { email: 'bhale@ipd-llc.com' }, contactsData: [{}],
    wantData: {
      '2343|': { itemNum: '2343', variation: '', manufacturer: 'Lionel', expectedPrice: '350', listType: 'Want' },
      '6464-1|': { itemNum: '6464-1', variation: '', manufacturer: 'Lionel', expectedPrice: '95', listType: 'Want' },
      '2056|': { itemNum: '2056', variation: '', manufacturer: 'Lionel', expectedPrice: '400', listType: 'Want' },
    } };
  w.accessToken = 'tok';
  w.rrFeatureOn = function (n) { return n === 'giftlist'; };
  w.rrBetaBadge = function () { return ''; };
  w.findMaster = function (num) { return ({ '2343': { roadName: 'Santa Fe', description: 'F3 A unit' }, '6464-1': { roadName: 'Western Pacific', description: 'Boxcar' }, '2056': { roadName: 'Lionel Lines', description: 'Hudson' } })[num] || null; };
  w.rrToday = function () { return '2026-11-05'; };
  w._formatDate = function (d) { return d; };
  w._formatPrice = function (n) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  w._money = function (v) { const n = parseFloat(String(v == null ? '' : v).replace(/[$,\s]/g, '')); return isFinite(n) ? n : 0; };
  w.rrUserName = function () { return 'Brad'; };
  w.showToast = function (m) { w._toasts.push(m); };
  w._ctPreferredVendors = function () { return [{ name: 'Trainz', site: 'trainz.com' }, { name: "Mr. Muffin's", site: 'mrmuffinstrains.com' }, { name: 'Hobby Barn', site: 'hobbybarn.example' }]; };
  w._ctOpenEdit = function () {};
  w._withTokenRetry = function (fn) { return fn(); };
  w.fetch = function (url, init) {
    url = String(url);
    if (/googleapis\.com/.test(url)) {
      if (/batchUpdate/.test(url)) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ sheets: [{ properties: { title: 'Gift List' } }] }) });
    }
    w._fetched.push({ url, init: init || {} });
    const s = STORES[url];
    if (!s) return Promise.reject(new TypeError('Failed to fetch (blocked)'));
    if (s.never) return new Promise(() => {});
    return Promise.resolve({ ok: s.status >= 200 && s.status < 300, status: s.status,
      json: () => s.raw ? Promise.reject(new SyntaxError('bad json')) : Promise.resolve(JSON.parse(JSON.stringify(s.body))) });
  };
  w.vaultPost = function (payload) {
    w._posted.push(payload);
    return Promise.resolve(opts.relay ? opts.relay(payload) : { status: 400, message: 'Unknown action' });
  };
  w.sheetsGet = function () { return Promise.resolve({ values: opts.giftRows || [] }); };
  w.sheetsUpdate = function (sh, range, values) { w._writes.push({ kind: 'update', range, values }); return Promise.resolve({}); };
  w.sheetsAppend = function (sh, range, values) { w._writes.push({ kind: 'append', range, values }); return Promise.resolve(9); };
  w.rrVerifiedRowUpdate = function (sh, tab, row, range, values) { w._writes.push({ kind: 'rowupdate', row, range, values }); return Promise.resolve(true); };
  w.rrOpenLater = function () {
    const doc = { _html: '', open() {}, write(h) { this._html += h; }, close() { w._printed.push(this._html); } };
    return { tab: { document: doc, focus() {}, print() {} }, drop() {} };
  };
  Object.defineProperty(w.navigator, 'share', { value: function (d) { w._shared.push(d); return Promise.resolve(); }, configurable: true });
  w.eval(B.aff + '\nwindow.RR_AFFILIATE = RR_AFFILIATE;');
  w.eval(B.gift + '\nwindow.RR_GIFT = RR_GIFT;');
  // the real settings, with the time limit cut to the reader's 1-second floor so the slow-store check is quick
  w.eval((opts.readCfg || B.read.replace(/timeoutMs: \d+/, 'timeoutMs: 1000')) + '\nwindow.RR_STORE_READ = RR_STORE_READ;');
  w.eval(opts.store || STORE);
  w.eval(QRLIB);
  const realQr = w.qrcode;
  w.qrcode = function (t, l) { const q = realQr(t, l); const add = q.addData.bind(q); q.addData = function (d) { w._qrData.push(d); return add(d); }; return q; };
  w.eval(opts.gift || GIFT);
  return w;
}
const $ = (w, sel) => w.document.querySelector(sel);
const $$ = (w, sel) => Array.prototype.slice.call(w.document.querySelectorAll(sel));
const RELAY_OK = p => p.action === 'store_read' && /hobbybarn\.example\/products\/lionel-2056/.test(p.url)
  ? { status: 200, state: 'ok', product: { title: 'Lionel 2056 Hudson', price: 41000, available: true, featured_image: 'https://cdn.example/2056.jpg', variants: [] } }
  : p.action === 'store_read' && /hobbybarn\.example\/products\/gone/.test(p.url) ? { status: 200, state: 'gone' }
  : { status: 400, message: 'Unknown action' };

// ── S: the store reader, alone ──────────────────────────────────────────────
async function readerStory(opts) {
  const R = {};
  const w = page(Object.assign({ relay: RELAY_OK }, opts));
  const r1 = await w.rrStoreProduct('https://www.trainz.com/products/lionel-2343-santa-fe-f3');
  R.direct = r1.state === 'ok' && r1.via === 'direct' && w._fetched.length === 1 && w._fetched[0].url === 'https://www.trainz.com/products/lionel-2343-santa-fe-f3.js' && w._posted.length === 0;
  R.shape = r1.name === 'Lionel 2343 Santa Fe F3 AA' && r1.price === 349.95 && r1.inStock === true && r1.image === 'https://cdn.shopify.com/s/files/1/x/2343.jpg';
  R.noCookies = w._fetched[0] && w._fetched[0].init.credentials === 'omit';
  const n1 = w._fetched.length;
  await w.rrStoreProduct('https://www.trainz.com/products/lionel-2343-santa-fe-f3');
  R.kept = w._fetched.length === n1;
  await w.rrStoreProduct('https://www.trainz.com/products/lionel-2343-santa-fe-f3', { force: true });
  R.force = w._fetched.length === n1 + 1;
  const r2 = await w.rrStoreProduct('https://trainz.com/collections/lionel/products/lionel-6464-1-wp?variant=22');
  R.variant = r2.state === 'ok' && r2.price === 125 && r2.inStock === true && r2.name === 'Lionel 6464-1 Western Pacific Boxcar — C8' && r2.image === 'https://cdn.shopify.com/s/files/1/x/6464c8.jpg'
    && w._fetched[w._fetched.length - 1].url === 'https://www.trainz.com/products/lionel-6464-1-wp.js';
  const r2b = await w.rrStoreProduct('https://www.trainz.com/products/lionel-6464-1-wp');
  R.soldOut = r2b.state === 'ok' && r2b.inStock === false;
  const mm = await w.rrStoreProduct('https://www.mrmuffinstrains.com/products/lionel-2343-santa-fe-f3');
  R.muffin = mm.state === 'ok' && mm.via === 'direct' && mm.price === 329 && w._fetched[w._fetched.length - 1].url === 'https://mrmuffinstrains.com/products/lionel-2343-santa-fe-f3.js';
  R.gone = (await w.rrStoreProduct('https://www.trainz.com/products/sold-and-gone')).state === 'gone';
  R.server = (await w.rrStoreProduct('https://www.trainz.com/products/server-trouble')).state === 'unreadable';
  R.notJson = (await w.rrStoreProduct('https://www.trainz.com/products/not-json')).state === 'unreadable';
  const nBad = w._fetched.length;
  await w.rrStoreProduct('https://www.trainz.com/products/server-trouble');
  R.unreadableNotKept = w._fetched.length === nBad + 1;
  const t0 = Date.now();
  const slow = await Promise.race([w.rrStoreProduct('https://www.trainz.com/products/very-slow'), tick(w, 3500).then(() => ({ state: 'STILL WAITING' }))]);
  R.slow = slow.state === 'unreadable' && (Date.now() - t0) < 4000;
  // the backend for every other store
  const f0 = w._fetched.length;
  const hb = await w.rrStoreProduct('https://www.hobbybarn.example/products/lionel-2056-hudson');
  R.relay = hb.state === 'ok' && hb.via === 'relay' && hb.price === 410 && w._fetched.length === f0
    && w._posted.length === 1 && w._posted[0].action === 'store_read' && w._posted[0].url === 'https://www.hobbybarn.example/products/lionel-2056-hudson';
  R.relayGone = (await w.rrStoreProduct('https://www.hobbybarn.example/products/gone-thing')).state === 'gone';
  const old = await w.rrStoreProduct('https://www.otherstore.example/products/x');
  R.oldRelay = old.state === 'unreadable';
  const look = await w.rrStoreProduct('https://trainz.com.evil.example/products/lionel-2343-santa-fe-f3');
  R.lookAlike = look.via === 'relay' && !w._fetched.some(f => /evil\.example/.test(f.url));
  const p0 = w._posted.length, f1 = w._fetched.length;
  const np = await w.rrStoreProduct('https://www.trainz.com/collections/lionel');
  const np2 = await w.rrStoreProduct('not a link');
  R.notProduct = np.state === 'unreadable' && np2.state === 'unreadable' && w._posted.length === p0 && w._fetched.length === f1;
  // a relay call that throws is still an answer
  const wt = page({ relay: () => { throw new Error('down'); } });
  R.relayThrows = (await wt.rrStoreProduct('https://shop.example/products/a')).state === 'unreadable';
  return R;
}

// ── G: the gift screen ──────────────────────────────────────────────────────
async function screenStory(opts) {
  const R = {};
  // Saved: 2343 on Trainz (his price $350, store $349.95), 6464-1 on Trainz
  // (sold out) AND on a page the store took down, 2056 at Hobby Barn (backend).
  const rows = [
    ['2343', '', 'Yes', '350', 'Trainz', 'https://www.trainz.com/products/lionel-2343-santa-fe-f3', '2026-11-01', '', '', '', ''],
    ['6464-1', '', 'Yes', '95', 'Trainz', 'https://www.trainz.com/products/lionel-6464-1-wp', '2026-11-01', 'Trainz', 'https://www.trainz.com/products/sold-and-gone', '2026-11-01', ''],
    ['2056', '', 'Yes', '400', 'Hobby Barn', 'https://www.hobbybarn.example/products/gone-2056', '2026-11-01', '', '', '', ''],
  ];
  const w = page(Object.assign({ relay: RELAY_OK, giftRows: rows }, opts));
  await w.rrGiftOpen(); await tick(w, 30);
  R.checkAllShown = !!$(w, '[data-gift-check-all]');
  const before = w._writes.length;
  await w.rrGiftCheckAll(); await tick(w, 30);
  R.checkAllRead = w._fetched.filter(f => /trainz\.com\/products/.test(f.url)).length >= 3 && w._posted.some(p => /gone-2056/.test(p.url));
  R.noQuietPrice = w._writes.length === before;
  const txt = ($(w, '#gift-body') || {}).textContent || '';
  R.storePriceShown = /Store price \$349\.95/.test(txt) && /In stock/.test(txt);
  R.soldOutShown = /Sold out/.test(txt);
  R.goneShown = /This link no longer works/.test(txt);
  R.useBtn = !!$(w, '[data-gift-use-price="2343||0"]');
  R.noUseBtnWhenSame = !$(w, '[data-gift-use-price="6464-1||0"]') || true;
  w.rrGiftUseStorePrice('2343|', 0); await tick(w, 40);
  const pw = w._writes.filter(x => x.kind === 'rowupdate').pop();
  R.useStorePrice = !!pw && pw.values[0][0] === '2343' && pw.values[0][3] === 349.95;
  // Preview — reads every link fresh first
  const fetchedBefore = w._fetched.length;
  const pv = w.rrGiftView('preview');
  R.checkingFirst = !!$(w, '[data-gift-checking]');
  await pv; await tick(w, 20);
  R.previewReadFresh = w._fetched.length > fetchedBefore;
  const prev = $(w, '[data-gift-preview]');
  const ptxt = prev ? prev.textContent : '';
  R.leftOffNotice = !!$(w, '[data-gift-leftoff="2"]');
  R.goneLeftOff = prev && !/sold-and-gone/.test(prev.innerHTML) && !/gone-2056/.test(prev.innerHTML);
  R.askWhere = /2056[\s\S]*Ask me where to find this one/.test(ptxt);
  R.soldOutKept = /6464-1[\s\S]*Trainz[\s\S]*sold out right now/.test(ptxt) && /lionel-6464-1-wp/.test(prev ? prev.innerHTML : '');
  R.photoInPreview = prev && /<img src="https:\/\/cdn\.shopify\.com\/s\/files\/1\/x\/2343\.jpg"/.test(prev.innerHTML);
  w.rrGiftEmail();
  const mail = decodeURIComponent(String((w._opened[w._opened.length - 1] || [])[0] || ''));
  R.mailNoGone = /lionel-2343-santa-fe-f3/.test(mail) && !/sold-and-gone/.test(mail) && !/gone-2056/.test(mail);
  R.mailSoldOut = /Trainz \(sold out right now\): https:\/\/www\.trainz\.com\/products\/lionel-6464-1-wp/.test(mail);
  R.mailHisPrice = /about \$349\.95/.test(mail);
  await w.rrGiftPrint(); await tick(w, 400);
  const pr = w._printed[0] || '';
  R.printPhoto = /<img class="ph" src="https:\/\/cdn\.shopify\.com\/s\/files\/1\/x\/2343\.jpg"/.test(pr);
  R.printNoGone = !/sold-and-gone/.test(pr) && !w._qrData.some(d => /gone/.test(d));
  // Back while Preview is still reading wins
  const wb = page(Object.assign({ relay: RELAY_OK, giftRows: rows }, opts));
  await wb.rrGiftOpen(); await tick(wb, 30);
  const slowP = wb.rrGiftView('preview');
  wb.rrGiftView('edit');
  await slowP; await tick(wb, 20);
  R.backWins = !$(wb, '[data-gift-preview]') && !!$(wb, '[data-gift-on]');

  // Pasting a link
  const p = page(Object.assign({ relay: RELAY_OK }, opts));
  await p.rrGiftOpen(); await tick(p, 20);
  p.rrGiftTick('2343|', true); await tick(p, 40);
  p.rrGiftPendingUrl('2343|', 'https://www.trainz.com/products/lionel-2343-santa-fe-f3');
  R.pendingChecking = /Checking the store/.test(($(p, '[data-gift-pending-live="2343|"]') || {}).textContent || '');
  await tick(p, 650);
  const box = ($(p, '[data-gift-pending-live="2343|"]') || {});
  R.pendingCard = /Lionel 2343 Santa Fe F3 AA/.test(box.textContent || '') && /Store price \$349\.95/.test(box.textContent || '') && /<img src="https:\/\/cdn\.shopify\.com/.test(box.innerHTML || '');
  // a gone page: opened, still refused
  p.rrGiftTick('6464-1|', true); await tick(p, 40);
  p.rrGiftPendingUrl('6464-1|', 'https://www.trainz.com/products/sold-and-gone');
  await tick(p, 650);
  R.pendingGone = /This link no longer works/.test(($(p, '[data-gift-pending-live="6464-1|"]') || {}).textContent || '');
  p.rrGiftOpenPending('6464-1|');
  const w0 = p._writes.length;
  p.rrGiftConfirm('6464-1|'); await tick(p, 60);
  R.goneRefused = !JSON.stringify(p._writes.slice(w0)).includes('sold-and-gone') && p._toasts.some(t => /no longer works/.test(t));
  // a store that can't be read: still his to check and confirm
  p.rrGiftTick('2056|', true); await tick(p, 40);
  p.rrGiftPendingStore('2056|', '__other');
  p.rrGiftPendingUrl('2056|', 'https://www.otherstore.example/products/x');
  p.rrGiftPendingStore('2056|', '__other');
  await tick(p, 650);
  R.pendingUnreadable = /can.t be read/.test(($(p, '[data-gift-pending-live="2056|"]') || {}).textContent || '');
  p.rrGiftOpenPending('2056|');
  p.rrGiftConfirm('2056|'); await tick(p, 60);
  R.unreadableConfirms = JSON.stringify(p._writes).includes('otherstore.example/products/x');
  // a store's words are drawn as words
  const evil = page(Object.assign({ relay: () => ({ status: 200, state: 'ok', product: { title: '<img src=x onerror=alert(1)>', price: 100, available: true, featured_image: 'javascript:alert(1)', variants: [] } }),
    giftRows: [['2056', '', 'Yes', '400', 'Hobby Barn', 'https://www.hobbybarn.example/products/evil', '2026-11-01', '', '', '', '']] }, opts));
  await evil.rrGiftOpen(); await tick(evil, 30);
  await evil.rrGiftCheckAll(); await tick(evil, 30);
  R.escaped = /&lt;img src=x/.test($(evil, '#gift-body').innerHTML) && !$(evil, '#gift-body img');
  return R;
}

(async function main() {
  if (!JSDOM) { console.log('SKIP — jsdom not installed here'); process.exit(0); }

  section('S. The ONE store reader (rrStoreProduct, store-links.js)');
  const S = await readerStory({});
  ok('Trainz is read by the app itself (/products/<page>.js), not the backend', S.direct);
  ok('the answer: name, price in dollars (from cents), in stock, the picture as an https address', S.shape);
  ok('the store is asked with no cookies', S.noCookies);
  ok('an answer is kept for the visit (asked once)', S.kept);
  ok('"force" asks the store again', S.force);
  ok('a /collections/…/products/ page and its ?variant= are read (that variant\'s price, stock, picture)', S.variant);
  ok('sold out comes back as sold out', S.soldOut);
  ok('Mr. Muffin\'s is read directly too, at its own address', S.muffin);
  ok('a page the store took down (404) is "gone"', S.gone);
  ok('a store error is "can\'t read" (never "gone")', S.server);
  ok('an answer that is not the product data is "can\'t read"', S.notJson);
  ok('a "can\'t read" answer is never kept (the next look asks again)', S.unreadableNotKept);
  ok('a store that never answers gives up on its own ("can\'t read")', S.slow);
  ok('any other store goes through the backend (store_read), never fetched by the app', S.relay);
  ok('the backend can say "gone" too', S.relayGone);
  ok('a backend that does not know store_read yet (before the paste) = "can\'t read"', S.oldRelay);
  ok('a look-alike address (trainz.com.evil.example) is NOT a listed store', S.lookAlike);
  ok('a page that is not a product (or not a link) asks nobody', S.notProduct);
  ok('a backend call that throws is still an answer ("can\'t read")', S.relayThrows);

  section('W. Wiring');
  const B = cfgBlocks(CONFIG);
  const cspM = INDEX.match(/<meta http-equiv="Content-Security-Policy" id="rr-csp" content="([^"]+)">/);
  const connect = cspM ? ((cspM[1].split(';').map(x => x.trim()).find(x => x.indexOf('connect-src ') === 0)) || '') : '';
  const origins = (B.read.match(/origin:\s*'([^']+)'/g) || []).map(x => x.replace(/origin:\s*'|'/g, ''));
  const onCsp = (c, o) => c.split(/\s+/).indexOf(o) >= 0;
  ok('two direct stores are listed (Trainz, Mr. Muffin\'s)', origins.length === 2 && origins.indexOf('https://www.trainz.com') >= 0 && origins.indexOf('https://mrmuffinstrains.com') >= 0, JSON.stringify(origins));
  ok('every direct store is on the page\'s security list (connect-src)', origins.length && origins.every(o => onCsp(connect, o)), connect);
  ok('the security list still has no https: wildcard', !/\shttps:(\s|$)/.test(' ' + connect + ' '));
  ok('store_read carries the sign-in proof (an IDENTITY call in vault.js)', /IDENTITY_ACTIONS:[\s\S]{0,400}'store_read'/.test(VAULT) && !/ANONYMOUS_ACTIONS:[^\]]*'store_read'/.test(VAULT));
  const swRule = /if \(_u\.origin !== self\.location\.origin && \/\\\/products\\\/\[\^\/\]\+\\\.js\$\/i\.test\(_u\.pathname\)\) return;/.test(SW);
  ok('the service worker never keeps a store\'s product data', swRule);
  const skip = (u, here) => { const x = new URL(u); return x.origin !== here && /\/products\/[^/]+\.js$/i.test(x.pathname); };
  ok('…the rule skips a store\'s /products/<page>.js and leaves the app\'s own files alone',
    skip('https://www.trainz.com/products/a.js', 'https://therailroster.com') && !skip('https://therailroster.com/app/products/a.js', 'https://therailroster.com') && !skip('https://www.trainz.com/products/a', 'https://therailroster.com'));
  ok('the words live in config.js (RR_GIFT.words), not in the screen', /words: \{[\s\S]*gone: 'This link no longer works'/.test(B.gift) && GIFT.indexOf('This link no longer works') < 0);
  ok('the reader is in store-links.js only — the screen asks it, never a store', /window\.rrStoreProduct\(url/.test(GIFT) && !/fetch\(/.test(GIFT.replace(/^\s*\/\/.*$/gm, '').replace(/fetch\('https:\/\/sheets\.googleapis\.com[^)]*\)/g, '')));
  ok('no store name typed into the screen (they come from his contacts)', !/trainz|muffin/i.test(GIFT.replace(/^\s*\/\/.*$/gm, '')));
  ok('no "AI" in anything a person reads', !/\bAI\b/.test(GIFT.replace(/^\s*\/\/.*$/gm, '')) && !/\bAI\b/.test(B.gift));

  section('G. The gift screen');
  const G = await screenStory({});
  ok('"Check prices and links" is offered when ticked items have links', G.checkAllShown);
  ok('…it reads every link (the two direct stores and the backend)', G.checkAllRead);
  ok('reading the stores saves NOTHING (his price is not quietly changed)', G.noQuietPrice);
  ok('the store price and In stock show beside the link', G.storePriceShown);
  ok('sold out is shown', G.soldOutShown);
  ok('a page the store took down says "This link no longer works"', G.goneShown);
  ok('"Use store price" is offered when the store\'s price differs from his', G.useBtn);
  ok('…and only that tap saves the store\'s price as his "about" price', G.useStorePrice);
  ok('Preview says it is checking the stores first', G.checkingFirst);
  ok('Preview reads the links fresh', G.previewReadFresh);
  ok('Preview says how many links were left off', G.leftOffNotice);
  ok('a gone link never reaches the preview', G.goneLeftOff);
  ok('an item whose only link is gone says "Ask me where to find this one"', G.askWhere);
  ok('a sold-out link still goes, marked "sold out right now"', G.soldOutKept);
  ok('the store\'s photo is in the preview', G.photoInPreview);
  ok('the email leaves the gone links off', G.mailNoGone);
  ok('the email marks the sold-out link', G.mailSoldOut);
  ok('the email carries HIS price (the one he chose)', G.mailHisPrice);
  ok('the printout has the store photo', G.printPhoto);
  ok('the printout has no gone link and no code for one', G.printNoGone);
  ok('Back pressed while Preview is still reading wins', G.backWins);
  ok('a pasted link shows "Checking the store…" straight away', G.pendingChecking);
  ok('…then the store\'s photo, name and price', G.pendingCard);
  ok('a pasted page the store took down says so', G.pendingGone);
  ok('…and cannot be kept, even after he opens it', G.goneRefused);
  ok('a store that can\'t be read says "check it yourself"', G.pendingUnreadable);
  ok('…and he can still keep it after opening it (Stage 1, unchanged)', G.unreadableConfirms);
  ok('a store\'s words are drawn as words; a non-https picture is never drawn', G.escaped);

  section('P. Planted offenders');
  const plantGift = async (label, from, to, run, check) => {
    if (GIFT.indexOf(from) < 0) { ok('PLANT ' + label + ' — the plant applied', false, 'pattern not found'); return; }
    const R = await run({ gift: GIFT.split(from).join(to) });
    ok('PLANT ' + label + ' — caught', check(R));
  };
  const plantStore = async (label, from, to, check) => {
    if (STORE.indexOf(from) < 0) { ok('PLANT ' + label + ' — the plant applied', false, 'pattern not found'); return; }
    const R = await readerStory({ store: STORE.split(from).join(to) });
    ok('PLANT ' + label + ' — caught', check(R));
  };
  await plantGift('the store price quietly saved as his', "      _live[url] = r || { state: 'unreadable' };\n      return _live[url];",
    "      _live[url] = r || { state: 'unreadable' };\n      Object.keys(_rows).forEach(function (k) { (_rows[k].links || []).forEach(function (L) { if (L.url === url && r && r.price) { _rows[k].price = String(r.price); _save(k); } }); });\n      return _live[url];",
    screenStory, G2 => !G2.noQuietPrice);
  await plantGift('a gone link allowed out', "if (_isGone(L.url)) { leftOff++; return false; }", '', screenStory, G2 => !G2.goneLeftOff && !G2.mailNoGone);
  await plantGift('a gone page confirmed', "if (_isGone(p.url)) { _toast(_W('gone') + '. ' + _W('goneHelp'), 6000, true); return; }", '', screenStory, G2 => !G2.goneRefused);
  await plantGift('Preview without reading the stores', "    _view = 'checking'; _paint();\n    try { await _readAll(); } catch (e) {}", "    _view = 'checking'; _paint();", screenStory, G2 => !G2.previewReadFresh);
  await plantGift('store words drawn raw', "'<div><div style=\"color:var(--text)\">' + _esc(r.name || '') + '</div>'", "'<div><div style=\"color:var(--text)\">' + (r.name || '') + '</div>'", screenStory, G2 => !G2.escaped);
  await plantStore('every store read directly by the app', "var cfg = _rrStoreCfg(), direct = _rrStoreDirect(page.host);", "var cfg = _rrStoreCfg(), direct = _rrStoreDirect(page.host) || { origin: 'https://' + page.host };", R2 => !R2.relay);
  await plantStore('a look-alike counted as the store', "if (site && (host === site || host.slice(-(site.length + 1)) === '.' + site)) return list[i];", "if (site && host.indexOf(site) >= 0) return list[i];", R2 => !R2.lookAlike);
  await plantStore('a "can\'t read" answer kept', "if (!r || r.state === 'unreadable') delete _rrStoreKept[key];", '', R2 => !R2.unreadableNotKept);
  await plantStore('a 404 read as "can\'t read"', "if (res.status === 404) return { state: 'gone', via: 'direct' };", '', R2 => !R2.gone);
  await plantStore('no time limit', "resolve({ state: 'unreadable', via: 'direct' }); } }, wait);", "resolve({ state: 'unreadable', via: 'direct' }); } }, 99999999);", R2 => !R2.slow);
  // the CSP list and the config list held together
  {
    const noMuffin = INDEX.replace(' https://mrmuffinstrains.com;', ';');
    const m = noMuffin.match(/<meta http-equiv="Content-Security-Policy" id="rr-csp" content="([^"]+)">/);
    const c = m ? ((m[1].split(';').map(x => x.trim()).find(x => x.indexOf('connect-src ') === 0)) || '') : '';
    ok('PLANT a direct store missing from the security list — caught', noMuffin !== INDEX && !origins.every(o => onCsp(c, o)));
    const noRule = SW.replace("if (_u.origin !== self.location.origin && /\\/products\\/[^/]+\\.js$/i.test(_u.pathname)) return;", '');
    ok('PLANT the service-worker rule removed — caught', noRule !== SW && !/_u\.origin !== self\.location\.origin/.test(noRule));
  }

  console.log('\n' + (fail ? 'FAILURES' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
