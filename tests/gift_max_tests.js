// ════════════════════════════════════════════════════════════════════════════
// gift_max_tests.js — 2026-11-25 (giftmax): a "don't go over" price per gift item.
//
// [stated] Brad 2026-11-07 07:01 CT "might want to give them an option to select a
// range for a product or max price don't go over this price kind of thing to help
// the wife not overspend" → 2026-11-25 16:40 CT "Don't go over" (a limit, not a
// range). Plan PLAN_2026-11-25_GIFT_LIST_DONT_GO_OVER.md.
//
// The REAL app/gift-list.js + RR_GIFT (config.js) + store-links.js in jsdom (the
// gift_list_tests harness), and the REAL gift/index.html family page:
//   M  the box: typed, saved in column L, read back; a tab made before column L
//      gets its heading; blank = nothing anywhere
//   O  what goes out: preview, email, text, print and the family-page copy carry
//      ONE line in the config's words; the published item carries `max`
//   N  the over-your-limit note beside a store price — the collector's only
//   F  the family page shows the line (same words as the config), and nothing
//      when there is no limit
//   P  planted offenders: each old shape put back turns its check red
// Run:  node tests/gift_max_tests.js
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APPDIR = path.join(__dirname, '..', 'app');
const APP = f => fs.readFileSync(path.join(APPDIR, f), 'utf8');
const GIFT = APP('gift-list.js'), CONFIG = APP('config.js'), STORE = APP('store-links.js');
const QRLIB = APP('vendor/qrcode-generator-2.0.4.js');
const FAMILY = fs.readFileSync(path.join(__dirname, '..', 'gift', 'index.html'), 'utf8');

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
  // 2026-11-07 (giftfixes): Text asks to turn the family link on ([stated] Brad "do 1")
  w._asked = []; w._published = [];
  w.appConfirm = function (msg) { w._asked.push(msg); return Promise.resolve(opts.confirm !== false); };
  w.vaultPost = function (p) {
    if (p.action === 'gift_link') return Promise.resolve({ status: 200, listId: '' });
    if (p.action === 'gift_publish') { w._published.push(p); return Promise.resolve({ status: 200, listId: 'b'.repeat(32) }); }
    return Promise.resolve(null);
  };
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

const TRAINZ_URL = 'https://www.trainz.com/products/lionel-2343-santa-fe-f3';
// a page whose store reader sees Trainz asking $450 for the 2343
function pageWithStore(opts) {
  const w = page(opts);
  // the store reader's own settings (RR_STORE_READ, config.js) — which stores are read directly
  w.eval(block(CONFIG, 'const RR_STORE_READ = {', '\n};').replace(/timeoutMs: \d+/, 'timeoutMs: 1000') + '\nwindow.RR_STORE_READ = RR_STORE_READ;');
  const sheetsFetch = w.fetch;
  w._fetched = [];
  w.fetch = function (url, init) {
    url = String(url);
    if (/googleapis\.com/.test(url)) return sheetsFetch(url, init);
    w._fetched.push(url);
    if (url === TRAINZ_URL + '.js') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ title: 'Lionel 2343 Santa Fe F3', price: 45000, available: true, featured_image: 'https://cdn.shopify.com/s/2343.jpg', variants: [] }) });
    return sheetsFetch(url, init);
  };
  return w;
}

async function story(opts) {
  opts = opts || {};
  const R = {};
  // M — the box, typed and saved
  const w = page(opts);
  await w.rrGiftOpen(); await tick(w);
  w.rrGiftTick('2343|', true); await tick(w, 120);
  R.box = !!$(w, '[data-gift-max="2343|"]') && /Don.t go over/.test(($(w, '[data-gift-key="2343|"]') || {}).textContent || '');
  R.boxBlank = R.box && $(w, '[data-gift-max="2343|"]').value === '';
  w.rrGiftMax('2343|', '400'); await tick(w, 150);
  const last = w._writes.filter(x => x.kind === 'append' || x.kind === 'rowupdate').pop();
  R.saved = !!last && last.values[0].length === 12 && last.values[0][11] === 400 && last.values[0][3] === 350;
  R.savedRange = !!last && (last.kind === 'append' ? /^Gift List!A:L$/.test(last.range) : /^Gift List!A\d+:L\d+$/.test(last.range));
  // O — what goes out
  await w.rrGiftView('preview');
  const pv = ($(w, '[data-gift-preview]') || {}).textContent || '';
  R.preview = /Please don’t spend more than \$400/.test(pv) && /about \$350/.test(pv);
  w.rrGiftEmail();
  const mail = decodeURIComponent(String((w._opened[w._opened.length - 1] || [])[0] || ''));
  R.email = /Please don’t spend more than \$400/.test(mail);
  await w.rrGiftText(); await tick(w, 40);
  // with the family link on, a text carries only the link — the FULL list goes by text when the link
  // can't be turned on (no signal at a show, an old backend), so that path is the one checked here
  const tw = page(opts);
  tw.vaultPost = function (p) { return Promise.resolve(p.action === 'gift_link' ? { status: 200, listId: '' } : { status: 503 }); };
  await tw.rrGiftOpen(); await tick(tw);
  tw.rrGiftTick('2343|', true); await tick(tw, 120);
  tw.rrGiftMax('2343|', '400'); await tick(tw, 150);
  await tw.rrGiftView('preview');
  await tw.rrGiftText(); await tick(tw, 40);
  const txt = (tw._shared[tw._shared.length - 1] || {}).text || '';
  R.text = /\n   Please don’t spend more than \$400\n/.test(txt + '\n');
  const pub = w._published[w._published.length - 1];
  const pit = pub && pub.list && pub.list.items && pub.list.items[0];
  R.published = !!pit && pit.max === '$400' && pit.price === '$350';
  await w.rrGiftPrint(); await tick(w, 500);
  R.print = /<div class="mx">Please don’t spend more than \$400<\/div>/.test(w._printed[0] || '');
  // blank again → nothing anywhere
  w.rrGiftClose();
  const b = page(opts);
  await b.rrGiftOpen(); await tick(b);
  b.rrGiftTick('2343|', true); await tick(b, 120);
  await b.rrGiftView('preview');
  await b.rrGiftText(); await tick(b, 40);
  const bt = (b._shared[b._shared.length - 1] || {}).text || '';
  const bp = b._published[b._published.length - 1];
  R.blank = !/spend more than/.test((($(b, '[data-gift-preview]') || {}).textContent || '') + bt) && !!bp && bp.list.items[0].max === '';
  const bl = b._writes.filter(x => x.kind === 'append' || x.kind === 'rowupdate').pop();
  R.blankSaved = !!bl && bl.values[0].length === 12 && bl.values[0][11] === '';
  // M — read back from the sheet (column L), and the heading on an older tab
  const ROWS = [['2343', '', 'Yes', '350', 'trainz.com', TRAINZ_URL, '2026-11-20', '', '', '', '', '400']];
  const r = pageWithStore(Object.assign({}, opts, { giftRows: ROWS, tabExists: true }));
  r.sheetsGet = function (sh, range) {
    if (/!L1$/.test(range)) return Promise.resolve({ values: [] });            // a tab made before column L
    return Promise.resolve({ values: ROWS });
  };
  await r.rrGiftOpen(); await tick(r, 120);
  R.readBack = !!$(r, '[data-gift-max="2343|"]') && $(r, '[data-gift-max="2343|"]').value === '400';
  // N — the store asks $450, over his $400 limit: a note for HIM
  await r.rrGiftCheckAll(); await tick(r, 120);
  const card = ($(r, '[data-gift-key="2343|"]') || {}).textContent || '';
  R.overNote = !!$(r, '[data-gift-over="2343||0"]') && /Store price is over your limit/.test(card);
  r.rrGiftMax('2343|', '500'); await tick(r, 150);
  R.underNoNote = !$(r, '[data-gift-over="2343||0"]');
  R.heading = r._updates.some(u => u.range === 'Gift List!L1' && u.values[0][0] === 'Don’t Go Over');
  await r.rrGiftView('preview');
  R.noteNeverSent = !/over your limit/.test(($(r, '[data-gift-preview]') || {}).textContent || '');
  return R;
}

// F — the family page
const CODE = 'b'.repeat(32);
function familyPage(list, html) {
  const dom = new JSDOM(html || FAMILY, { url: 'https://therailroster.com/gift/?l=' + CODE, runScripts: 'dangerously',
    beforeParse(w) {
      w.fetch = function (u, init) {
        const p = JSON.parse(init.body);
        const out = p.action === 'gift_get' ? { status: 200, list } : p.action === 'gift_marks' ? { status: 200, keys: [] } : { status: 400 };
        return Promise.resolve({ json: () => Promise.resolve(out) });
      };
    } });
  return dom.window;
}
async function familyStory(html) {
  const R = {};
  const list = { title: 'Gift ideas — from Brad', who: 'Brad', items: [
    { key: '2343|', name: 'Lionel 2343', price: '$350', max: '$400', image: '', links: [{ store: 'Trainz', url: TRAINZ_URL }] },
    { key: '6464-1|', name: 'Lionel 6464-1', price: '$90', max: '', image: '', links: [] },
    { key: '2056|', name: 'Lionel 2056 <b>x</b>', price: '', max: '$500<img src=x>', image: '', links: [] } ] };
  const w = familyPage(list, html);
  await tick(w, 80);
  const box = k => w.document.querySelector('[data-item="' + k + '"]');
  const t1 = (box('2343|') || {}).textContent || '';
  R.line = /About \$350/.test(t1) && /Please don’t spend more than \$400/.test(t1) && !!(box('2343|') && box('2343|').querySelector('.max'));
  R.none = !!box('6464-1|') && !/spend more than/.test(box('6464-1|').textContent);
  R.asText = !!box('2056|') && !box('2056|').querySelector('.max img') && /\$500<img src=x>/.test(box('2056|').textContent);
  return R;
}

(async () => {
  if (!JSDOM) { console.log('jsdom is not installed — gift_max_tests cannot run here'); process.exit(1); }
  const S = await story();
  section('M · the "Don\'t go over" box');
  ok('a ticked item has a "Don\'t go over" box beside "About", empty to start', S.box && S.boxBlank);
  ok('typed $400: saved in the 12th column (L) beside the about price, as a number', S.saved, S.saved);
  ok('…the row is written A to L', S.savedRange);
  ok('left blank: column L is saved blank', S.blankSaved);
  ok('read back from the sheet: column L fills the box', S.readBack);
  ok('a tab made before column L gets the heading "Don’t Go Over" in L1', S.heading);
  section('O · what goes out carries ONE line');
  ok('Preview: "Please don’t spend more than $400" under the item (the about price unchanged)', S.preview);
  ok('Email carries the line', S.email);
  ok('Text carries the line, on its own line under the item', S.text);
  ok('Print carries the line', S.print);
  ok('the family-page copy carries max "$400" beside price "$350"', S.published);
  ok('no limit = no line anywhere, and the family copy says max ""', S.blank);
  section('N · the over-your-limit note (the collector\'s only)');
  ok('Trainz asks $450, his limit is $400: "Store price is over your limit" beside the link', S.overNote);
  ok('limit raised to $500: the note goes away', S.underNoNote);
  ok('the note is never in what goes out', S.noteNeverSent);
  const F = await familyStory();
  section('F · the family page');
  ok('the family page shows "Please don’t spend more than $400" under "About $350"', F.line);
  ok('an item with no limit shows no line', F.none);
  ok('the limit is drawn as words, never as page code', F.asText);
  const cfgLine = (CONFIG.match(/maxLine: '([^']*)'/) || [])[1], famLine = (FAMILY.match(/maxLine: '([^']*)'/) || [])[1];
  ok('the family page\'s words are the config\'s words (RR_GIFT.words.maxLine)', !!cfgLine && cfgLine === famLine, cfgLine + ' | ' + famLine);

  section('P · planted offenders');
  const plant = (src, a, b) => { if (src.indexOf(a) < 0) throw new Error('plant anchor missing: ' + a.slice(0, 70)); return src.replace(a, b); };
  const p1 = await story({ gift: plant(GIFT, "price: _price(g.price), max: _price(g.max), links: links", "price: _price(g.price), links: links") });
  ok('P1 planted: the limit left out of what goes out → preview / text / family copy caught (red)', !p1.preview && !p1.text && !p1.published);
  const p2 = await story({ gift: plant(GIFT, "            (isFinite(mx) && mx > 0) ? mx : ''];", "            ];") });
  ok('P2 planted: the row saved with 11 columns → caught (red)', !p2.saved);
  const p3 = await story({ gift: plant(GIFT, "notes: c(10), max: c(11) };", "notes: c(10) };") });
  ok('P3 planted: column L not read back → caught (red)', !p3.readBack);
  const p4 = await story({ gift: plant(GIFT, "        if (r.state === 'ok' && r.price && isFinite(lim) && lim > 0 && r.price > lim + 0.005) {", "        if (false) {") });
  ok('P4 planted: no over-your-limit note → caught (red)', !p4.overNote);
  const p5 = await story({ gift: plant(GIFT, "return { key: it.key, name: it.name, price: it.price, max: it.max || '', image:", "return { key: it.key, name: it.name, price: it.price, image:") });
  ok('P5 planted: the family-page copy without max → caught (red)', !p5.published);
  const p6 = await familyStory(plant(FAMILY, "      if (it.max) body.appendChild(", "      if (false) body.appendChild("));
  ok('P6 planted: the family page ignores max → caught (red)', !p6.line);
  const p7 = await story({ gift: plant(GIFT, "      } catch (e) { /* the heading is a label only — the save goes on */ }", "      } catch (e) { }\n      if (false) {}").replace("if (!(hd && hd.values && hd.values[0] && String(hd.values[0][0] || '').trim())) await", "if (false) await") });
  ok('P7 planted: an older tab never gets the L1 heading → caught (red)', !p7.heading);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH ' + (e && e.stack || e)); process.exit(1); });
