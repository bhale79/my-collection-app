// ════════════════════════════════════════════════════════════════════════════
// gift_family_tests.js — THE GIFT LIST's FAMILY LINK and its page (2026-11-05).
//
// [stated] Brad 2026-10-31 07:02 CT: the bought boxes "should be hidden from
// the main user or we dont need to do it"; 2026-11-05 05:19 CT "yes" to the
// marks hidden on the family page behind an "I'm shopping for … — show what's
// been bought" tap. Plan: PLAN_2026-11-04_GIFT_LIST_STAGE2_AND_BOUGHT.md (B).
//
// The REAL app/gift-list.js + the REAL config blocks + store-links.js run in
// jsdom with a stand-in backend that behaves like relay v5.0; the REAL
// gift/index.html runs in jsdom against the same stand-in.
//   A  the app: "Turn on the family link" sends EXACTLY the preview (coded
//      links, gone links left off, item keys) and shows the link; a shared
//      list is sent again on every Preview; the email / text / printout carry
//      the page; "Stop sharing" asks first, then deletes; an old backend (no
//      v5.0 yet) says "not ready" and nothing breaks
//   B  the app NEVER asks for the marks (runtime record + a source scan of
//      every app file)
//   C  the family page: the list without the marks; the marks only after the
//      tap; "I bought this" / "Undo"; a stopped list says so; a bad code asks
//      nobody; words drawn as words; a javascript: link never becomes a link;
//      a non-https picture is never drawn
//   W  wiring: the page's backend address is the app's (VAULT.ENDPOINT), the
//      page is not indexed and has its own security policy, it is on the
//      website list, the privacy page says what is kept and for how long,
//      vault.js lists the three calls that carry the sign-in proof
//   P  planted offenders
// Run:  node tests/gift_family_tests.js
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const APPDIR = path.join(ROOT, 'app');
const APP = f => fs.readFileSync(path.join(APPDIR, f), 'utf8');
const GIFT = APP('gift-list.js'), CONFIG = APP('config.js'), STORE = APP('store-links.js'), VAULT = APP('vault.js');
const QRLIB = APP('vendor/qrcode-generator-2.0.4.js');
const PAGE = fs.readFileSync(path.join(ROOT, 'gift', 'index.html'), 'utf8');
const SITE = fs.readFileSync(path.join(ROOT, '.github', 'site-files.txt'), 'utf8');
const PRIVACY = fs.readFileSync(path.join(ROOT, 'privacy', 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + String(detail).slice(0, 300) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }
function block(src, start, end) { const i = src.indexOf(start); if (i < 0) return ''; const j = src.indexOf(end, i); return src.slice(i, j + end.length); }
const tick = (w, ms) => new Promise(r => w.setTimeout(r, ms || 15));
const ENDPOINT = (VAULT.match(/ENDPOINT:\s*'([^']+)'/) || [])[1];
const CODE = 'a'.repeat(32);

// ── a stand-in relay v5.0 (the gift actions only) ──
function relay(o) {
  o = o || {};
  const db = { lists: {}, marks: {}, calls: [] };
  if (o.seed) Object.assign(db.lists, o.seed);
  db.handle = function (p) {
    db.calls.push(p);
    if (o.old) return { status: 400, message: 'Unknown action' };
    const a = p.action;
    if (a === 'gift_link') return { status: 200, listId: db.lists.mine ? CODE : '' };
    if (a === 'gift_publish') { db.lists.mine = p.list; return { status: 200, listId: CODE }; }
    if (a === 'gift_stop') { const had = !!db.lists.mine; delete db.lists.mine; db.marks = {}; return { status: 200, removed: had ? 1 : 0 }; }
    if (a === 'gift_get') { if (p.listId !== CODE || !db.lists.mine) return { status: 404 }; return { status: 200, list: db.lists.mine }; }
    if (a === 'gift_marks') { if (p.listId !== CODE || !db.lists.mine) return { status: 404 }; return { status: 200, keys: Object.keys(db.marks) }; }
    if (a === 'gift_mark') { if (p.listId !== CODE || !db.lists.mine) return { status: 404 }; if (p.on === false) delete db.marks[p.itemKey]; else db.marks[p.itemKey] = 1; return { status: 200 }; }
    if (a === 'store_read') return { status: 400, message: 'Unknown action' };
    return { status: 400, message: 'Unknown action' };
  };
  return db;
}

// ── the app page ──
function appPage(db, opts) {
  opts = opts || {};
  const dom = new JSDOM('<!doctype html><html><body><span id="gift-list-slot"></span></body></html>', { runScripts: 'outside-only', url: 'https://therailroster.com/app/' });
  const w = dom.window;
  w._opened = []; w._writes = []; w._toasts = []; w._shared = []; w._printed = []; w._qrData = []; w._asked = [];
  w.open = function () { w._opened.push(Array.prototype.slice.call(arguments)); return null; };
  w.state = { personalSheetId: 'SHEET1', user: { email: 'bhale@ipd-llc.com' }, contactsData: [{}], wantData: {
    '2343|': { itemNum: '2343', variation: '', manufacturer: 'Lionel', expectedPrice: '350', listType: 'Want' },
    '1317-2|': { itemNum: '1317-2', variation: '', manufacturer: 'Lionel', expectedPrice: '95', listType: 'Want' } } };
  w.accessToken = 'tok';
  w.rrFeatureOn = n => n === 'giftlist';
  w.rrBetaBadge = () => '';
  w.findMaster = num => ({ '2343': { roadName: 'Santa Fe', description: 'F3 A unit' }, '1317-2': { roadName: '', description: 'Set' } })[num] || null;
  w.rrToday = () => '2026-11-05';
  w._formatDate = d => d;
  w._formatPrice = n => '$' + Number(n).toLocaleString();
  w._money = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[$,\s]/g, '')); return isFinite(n) ? n : 0; };
  w.rrUserName = () => 'Brad';
  w.showToast = m => w._toasts.push(m);
  w._ctPreferredVendors = () => [{ name: 'Trainz', site: 'trainz.com' }];
  w._ctOpenEdit = () => {};
  w._withTokenRetry = fn => fn();
  w.appConfirm = function (msg) { w._asked.push(msg); return Promise.resolve(opts.confirm !== false); };
  w.fetch = function (url) {
    url = String(url);
    if (/googleapis/.test(url)) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ sheets: [{ properties: { title: 'Gift List' } }] }) });
    if (/sold-and-gone\.js$/.test(url)) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    if (/\/products\/.+\.js$/.test(url)) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ title: 'Lionel 2343', price: 34995, available: true, featured_image: '//cdn.shopify.com/a.jpg', variants: [] }) });
    return Promise.reject(new TypeError('blocked'));
  };
  w.vaultPost = p => Promise.resolve(db.handle(JSON.parse(JSON.stringify(p))));
  w.sheetsGet = () => Promise.resolve({ values: [
    ['2343', '', 'Yes', '350', 'Trainz', 'https://www.trainz.com/products/lionel-2343', '2026-11-01', 'Trainz', 'https://www.trainz.com/products/sold-and-gone', '2026-11-01', ''],
    ['1317-2', '', 'Yes', '95', '', '', '', '', '', '', ''] ] });
  w.sheetsUpdate = () => Promise.resolve({});
  w.sheetsAppend = () => Promise.resolve(9);
  w.rrVerifiedRowUpdate = () => Promise.resolve(true);
  w.rrOpenLater = function () { const doc = { _html: '', open() {}, write(h) { this._html += h; }, close() { w._printed.push(this._html); } }; return { tab: { document: doc, focus() {}, print() {} }, drop() {} }; };
  Object.defineProperty(w.navigator, 'share', { value: d => { w._shared.push(d); return Promise.resolve(); }, configurable: true });
  w.eval((opts.aff || block(CONFIG, 'const RR_AFFILIATE = [', '];')) + '\nwindow.RR_AFFILIATE = RR_AFFILIATE;');
  w.eval(block(opts.config || CONFIG, 'const RR_GIFT = {', '\n};') + '\nwindow.RR_GIFT = RR_GIFT;');
  w.eval(block(CONFIG, 'const RR_STORE_READ = {', '\n};') + '\nwindow.RR_STORE_READ = RR_STORE_READ;');
  w.eval(STORE);
  w.eval(QRLIB);
  const realQr = w.qrcode;
  w.qrcode = function (t, l) { const q = realQr(t, l); const add = q.addData.bind(q); q.addData = d => { w._qrData.push(d); return add(d); }; return q; };
  w.eval(opts.gift || GIFT);
  return w;
}
const $ = (w, s) => w.document.querySelector(s);
const AFF_CODE = "const RR_AFFILIATE = [ { store: 'Trainz', host: 'trainz.com', params: { ref: 'TEST1' }, wrap: '' } ];";

async function appStory(opts) {
  opts = opts || {};
  const R = {};
  const db = relay(opts.relay);
  const w = appPage(db, Object.assign({ aff: AFF_CODE }, opts));
  await w.rrGiftOpen(); await tick(w, 30);
  await w.rrGiftView('preview'); await tick(w, 30);
  R.offAtFirst = !!$(w, '[data-gift-family-on]') && !$(w, '[data-gift-family-url]') && !db.calls.some(c => c.action === 'gift_publish');
  R.askedLink = db.calls.some(c => c.action === 'gift_link');
  await w.rrGiftFamilyOn(); await tick(w, 30);
  const pub = db.calls.filter(c => c.action === 'gift_publish').pop();
  R.published = !!pub;
  R.onShown = !!$(w, '[data-gift-family-url]') && /therailroster\.com\/gift\/\?l=a{32}/.test($(w, '[data-gift-family-url]').textContent);
  const items = pub ? pub.list.items : [];
  const byKey = k => items.find(i => i.key === k);
  R.sentKeys = items.map(i => i.key).sort().join(',') === '1317-2|,2343|';
  R.sentCoded = !!byKey('2343|') && byKey('2343|').links.length === 1 && byKey('2343|').links[0].url === 'https://www.trainz.com/products/lionel-2343?ref=TEST1';
  R.sentNoGone = !JSON.stringify(pub || {}).includes('sold-and-gone');
  R.sentOnlyShown = pub && Object.keys(pub.list).sort().join(',') === 'disclosure,footer,items,title,who' && !JSON.stringify(pub).includes('bhale@ipd-llc.com') && !JSON.stringify(pub).includes('SHEET1');
  R.sentPicture = !!byKey('2343|') && byKey('2343|').image === 'https://cdn.shopify.com/a.jpg';
  R.sentAsk = !!byKey('1317-2|') && byKey('1317-2|').links.length === 0;
  // email / text / print carry the page
  w.rrGiftEmail();
  const mail = decodeURIComponent(String((w._opened[w._opened.length - 1] || [])[0] || ''));
  R.mailLink = /See the list and mark what you’ve bought: https:\/\/therailroster\.com\/gift\/\?l=a{32}/.test(mail);
  w.rrGiftText();
  R.textLink = /therailroster\.com\/gift\/\?l=a{32}/.test((w._shared[w._shared.length - 1] || {}).text || '');
  await w.rrGiftPrint(); await tick(w, 400);
  R.printQr = /data-family-qr="1"/.test(w._printed[0] || '') && w._qrData.indexOf('https://therailroster.com/gift/?l=' + CODE) >= 0;
  // a shared list is sent again on the next Preview
  const n0 = db.calls.filter(c => c.action === 'gift_publish').length;
  w.rrGiftView('edit');
  await w.rrGiftView('preview'); await tick(w, 30);
  R.republished = db.calls.filter(c => c.action === 'gift_publish').length === n0 + 1;
  // a fresh opening knows the list is shared
  const w2 = appPage(db, { aff: AFF_CODE, gift: opts.gift });
  await w2.rrGiftOpen(); await tick(w2, 30);
  await w2.rrGiftView('preview'); await tick(w2, 30);
  R.remembered = !!$(w2, '[data-gift-family-url]');
  // stop sharing: asks first; "No" keeps it
  const wn = appPage(db, { aff: AFF_CODE, confirm: false, gift: opts.gift });
  await wn.rrGiftOpen(); await wn.rrGiftView('preview'); await tick(wn, 30);
  await wn.rrGiftFamilyStop(); await tick(wn, 20);
  R.stopAsks = wn._asked.length === 1 && /Stop sharing your gift list\?/.test(wn._asked[0]) && !db.calls.some(c => c.action === 'gift_stop') && !!db.lists.mine;
  await w.rrGiftFamilyStop(); await tick(w, 30);
  R.stopped = db.calls.some(c => c.action === 'gift_stop') && !db.lists.mine && !!$(w, '[data-gift-family-on]') && w._toasts.some(t => /Sharing stopped/.test(t));
  await tick(w, 1600);   // the quick-second-tap guard on Text (1.5 s) has to pass first
  // 2026-11-07 (giftfixes, Brad "do 1"): with the link off, Text ASKS to turn
  // it on — a "Cancel" shares nothing and turns nothing on
  const shared0 = w._shared.length, asked0 = w._asked.length, pubs0 = db.calls.filter(c => c.action === 'gift_publish').length;
  w.appConfirm = function (msg) { w._asked.push(msg); return Promise.resolve(false); };
  await w.rrGiftText(); await tick(w, 30);
  R.textAfterStop = w._shared.length === shared0 && w._asked.length === asked0 + 1 && /Turn on the family link\?/.test(w._asked[w._asked.length - 1] || '')
    && db.calls.filter(c => c.action === 'gift_publish').length === pubs0 && !db.lists.mine;
  // the app never asked for the marks
  R.neverMarks = !db.calls.concat(relay().calls).some(c => /^gift_marks?$/.test(c.action));
  // an old backend (before the v5.0 paste)
  const dbOld = relay({ old: true });
  const wo = appPage(dbOld, { aff: AFF_CODE, gift: opts.gift });
  await wo.rrGiftOpen(); await wo.rrGiftView('preview'); await tick(wo, 30);
  await wo.rrGiftFamilyOn(); await tick(wo, 30);
  R.oldBackend = !!$(wo, '[data-gift-family-on]') && wo._toasts.some(t => /isn.t ready yet/.test(t)) && !!$(wo, '[data-gift-preview]');
  return R;
}

// ── the family page ──
function familyPage(db, url, opts) {
  opts = opts || {};
  const dom = new JSDOM(opts.html || PAGE, { url: url || ('https://therailroster.com/gift/?l=' + CODE), runScripts: 'dangerously',
    beforeParse(w) {
      w._posts = [];
      w.fetch = function (u, init) {
        const body = JSON.parse(init.body);
        w._posts.push({ url: String(u), body: body });
        return Promise.resolve({ json: () => Promise.resolve(db.handle(body)) });
      };
    } });
  return dom.window;
}
async function twoStoreStory(opts) {
  const db = relay();
  db.lists.mine = { title: 'Gift ideas — from Brad', who: 'Brad', items: [
    { key: '2245C|', name: 'Lionel 2245C', price: '$700', image: '', links: [{ store: 'Trainz', url: 'https://www.trainz.com/products/c' }, { store: "Mr. Muffin's", url: 'https://mrmuffinstrains.com/products/c' }] } ] };
  const w = familyPage(db, null, opts || {});
  await tick(w, 60);
  const d = w.document, a = Array.from(d.querySelectorAll('[data-item="2245C|"] .links a'));
  const twoLinks = a.length === 2 && a[0].textContent === 'Trainz' && a[1].textContent === "Mr. Muffin's" && !d.querySelector('[data-tap]');
  // 2026-11-08: once it is bought (and the marks are showing), neither store is a link
  db.marks['2245C|'] = 1;
  const rv = d.querySelector('[data-reveal]'); if (rv) rv.click();
  await tick(w, 60);
  const bx = d.querySelector('[data-item="2245C|"]');
  const offs = bx ? Array.from(bx.querySelectorAll('[data-store-off]')).map(s => s.textContent) : [];
  const boughtTwoNoLinks = !!bx && /Bought ✓/.test(bx.textContent) && !bx.querySelector('a') && offs.join('|') === "Trainz|Mr. Muffin's";
  return { twoLinks, boughtTwoNoLinks };
}
async function pageStory(opts) {
  opts = opts || {};
  const R = {};
  const db = relay();
  db.lists.mine = { title: 'Gift ideas — from Brad', who: 'Brad', disclosure: 'Some links may earn a commission.', footer: 'Made with The Rail Roster.', items: [
    { key: '2343|', name: 'Lionel 2343 <img src=x onerror=alert(1)>', price: '$350', image: 'https://cdn.shopify.com/a.jpg', links: [{ store: 'Trainz', url: 'https://www.trainz.com/products/a?ref=X' }] },
    { key: '1317-2|', name: 'Lionel 1317-2', price: '', image: 'http://plain.example/x.jpg', links: [{ store: 'Evil', url: 'javascript:alert(1)' }] },
    { key: '6464|', name: 'Lionel 6464', price: '$90', image: '', links: [{ store: 'Trainz', url: 'https://www.trainz.com/products/b', soldOut: true }] } ] };
  db.marks['6464|'] = 1;
  const w = familyPage(db, null, opts);
  await tick(w, 60);
  const d = w.document;
  R.endpoint = w._posts[0] && w._posts[0].url === ENDPOINT;
  R.listShown = d.querySelectorAll('[data-item]').length === 3 && /Gift ideas — from Brad/.test(d.querySelector('h1').textContent);
  R.noMarksYet = !w._posts.some(p => p.body.action === 'gift_marks') && !/Bought ✓/.test(d.getElementById('page').textContent) && !d.querySelector('[data-buy]');
  // 2026-11-07 ([stated] Brad 12:43 CT): the button is the LAST thing, and says what it is for
  R.revealWords = /^Did you buy an item on this list\? Mark it bought\.$/.test((d.querySelector('[data-reveal]') || {}).textContent || '');
  {
    const rv = d.querySelector('[data-reveal]'), items = d.querySelectorAll('[data-item]'), notes = d.querySelectorAll('.note');
    const after = (a, b) => !!a && !!b && !!(b.compareDocumentPosition(a) & w.Node.DOCUMENT_POSITION_FOLLOWING);
    R.revealAtBottom = after(rv, items[items.length - 1]) && after(notes[0], rv);
  }
  R.tapItemWords = Array.from(d.querySelectorAll('.sub')).some(p => p.textContent === 'Tap an item to see it at the store.');
  // the whole box of an item with ONE store opens it ([stated] Brad "The whole line should be clickable")
  w._opened = [];
  d.addEventListener('click', ev => { const a = ev.target && ev.target.closest && ev.target.closest('a'); if (a) { ev.preventDefault(); w._opened.push(a.getAttribute('href')); } }, true);
  const nm = d.querySelector('[data-item="2343|"] .name');
  if (nm) nm.click();
  R.boxOpens = w._opened.length === 1 && w._opened[0] === 'https://www.trainz.com/products/a?ref=X' && !!d.querySelector('[data-tap="2343|"]');
  R.goWords = /^See it at Trainz ›$/.test((d.querySelector('[data-item="2343|"] .links a') || {}).textContent || '');
  const noLink = d.querySelector('[data-item="1317-2|"]');
  if (noLink) noLink.click();
  R.noLinkNoTap = w._opened.length === 1 && !d.querySelector('[data-tap="1317-2|"]');
  w._scrolled = [];
  w.Element.prototype.scrollIntoView = function () { w._scrolled.push(this.getAttribute('data-item')); };
  R.escaped = !d.querySelector('[data-item] .name img') && /<img src=x onerror/.test(d.querySelector('[data-item]').textContent);
  const links = Array.from(d.querySelectorAll('.links a')).map(a => a.getAttribute('href'));
  R.noJsLink = links.length === 2 && !links.some(h => /^javascript:/i.test(h)) && links[0] === 'https://www.trainz.com/products/a?ref=X';
  R.askWhenNoLink = /Ask Brad where to find this one/.test(d.querySelector('[data-item="1317-2|"]').textContent);
  R.httpsPicOnly = d.querySelectorAll('[data-item] img').length === 1 && d.querySelector('[data-item] img').getAttribute('src') === 'https://cdn.shopify.com/a.jpg';
  R.soldOut = /sold out right now/.test(d.querySelector('[data-item="6464|"]').textContent);
  R.newTab = Array.from(d.querySelectorAll('.links a')).every(a => a.target === '_blank' && /noopener/.test(a.rel));
  R.disclosure = /Some links may earn a commission/.test(d.body.textContent);
  // the tap
  d.querySelector('[data-reveal]').click(); await tick(w, 60);
  R.scrolledToFirst = w._scrolled.length === 1 && w._scrolled[0] === '2343|';
  R.marksAfterTap = w._posts.some(p => p.body.action === 'gift_marks' && p.body.listId === CODE) && /Bought ✓/.test(d.querySelector('[data-item="6464|"]').textContent) && !!d.querySelector('[data-buy="2343|"]');
  // 2026-11-07 (giftfixes, [stated] Brad "many people will double tap it"):
  // a tap right after the list is drawn is ignored …
  const marks0 = w._posts.filter(p => p.body.action === 'gift_mark').length;
  const click = sel => { const b = d.querySelector(sel); if (b) b.click(); return b; };   // a planted page may not draw the button
  click('[data-buy="2343|"]'); await tick(w, 60);
  R.calmAfterDraw = w._posts.filter(p => p.body.action === 'gift_mark').length === marks0 && !db.marks['2343|'];
  await tick(w, 900);
  // … "Saving…" shows the moment it is tapped, before the backend answers …
  const opened0 = w._opened.length;
  const buyBtn = click('[data-buy="2343|"]');
  R.buyDoesNotOpen = w._opened.length === opened0;
  R.savingAtOnce = !!buyBtn && buyBtn.textContent === 'Saving…' && buyBtn.disabled === true;
  await tick(w, 60);
  R.buy = !!db.marks['2343|'] && !!d.querySelector('[data-undo="2343|"]');
  // 2026-11-08 ([stated] Brad 16:49 CT "with the green bought on the card, i
  // click it and it takes me to trainz"; 16:50 CT "it shouldn't open it"):
  // a bought item's box opens NOTHING — tap the green words, the name, the
  // store name, the box itself; none of them may open the store
  {
    const opened1 = w._opened.length;
    const bx = d.querySelector('[data-item="2343|"]');
    // the very tap Brad made, on its own: the green words open nothing
    const green = bx && bx.querySelector('.bought');
    if (green) green.click();
    R.greenTapOpensNothing = !!green && w._opened.length === opened1;
    const tapAll = [bx && bx.querySelector('.bought'), bx && bx.querySelector('.name'), bx && bx.querySelector('[data-store-off]'), bx && bx.querySelector('.mark'), bx];
    tapAll.forEach(t => { if (t) t.click(); });
    R.boughtTapsReal = tapAll.every(Boolean);
    R.boughtOpensNothing = R.boughtTapsReal && w._opened.length === opened1 && !bx.querySelector('a') && !bx.hasAttribute('data-tap') && !/\btap\b/.test(bx.className);
    R.boughtStoreName = /^Trainz$/.test((bx && bx.querySelector('[data-store-off]') || {}).textContent || '');
    // the item that was already bought when the marks came in is the same
    const b6 = d.querySelector('[data-item="6464|"]');
    if (b6) { const t6 = b6.querySelector('.bought'); if (t6) t6.click(); b6.click(); }
    R.boughtOnLoadOpensNothing = !!b6 && w._opened.length === opened1 && !b6.querySelector('a');
    R.boughtKeepsSoldOut = !!b6 && /sold out right now/.test(b6.textContent);
  }
  // … Undo sits apart (its own class, pushed to the far side) …
  R.undoApart = !!d.querySelector('[data-undo="2343|"]') && d.querySelector('[data-undo="2343|"]').className === 'undo' && /\.mark \.undo \{ margin-left:auto;/.test(d.querySelector('style').textContent);
  // … and the second half of a double tap never undoes it
  click('[data-undo="2343|"]'); await tick(w, 60);
  R.doubleTapSafe = !!db.marks['2343|'];
  await tick(w, 900);
  click('[data-undo="2343|"]'); await tick(w, 60);
  R.undo = !db.marks['2343|'] && !!d.querySelector('[data-buy="2343|"]');
  // after Undo the box opens the store again
  {
    const opened2 = w._opened.length;
    const nm2 = d.querySelector('[data-item="2343|"] .name');
    if (nm2) nm2.click();
    R.undoTapsAgain = w._opened.length === opened2 + 1 && w._opened[opened2] === 'https://www.trainz.com/products/a?ref=X';
  }
  // a save that does not land keeps the list, and says so UNDER that item
  const realHandle = db.handle;
  db.handle = b => b.action === 'gift_mark' ? { status: 429, message: 'busy' } : realHandle(b);
  await tick(w, 900);
  click('[data-buy="2343|"]'); await tick(w, 60);
  const it2343 = d.querySelector('[data-item="2343|"]');
  R.busyUnderItem = d.querySelectorAll('[data-item]').length === 3 && !!it2343 && /Too many people/.test((it2343.querySelector('.flash') || {}).textContent || '') && !!d.querySelector('[data-buy="2343|"]');
  db.handle = b => b.action === 'gift_mark' ? null : realHandle(b);
  await tick(w, 900);
  click('[data-buy="2343|"]'); await tick(w, 60);
  R.failUnderItem = d.querySelectorAll('[data-item]').length === 3 && /didn’t save/.test((d.querySelector('[data-item="2343|"] .flash') || {}).textContent || '') && !db.marks['2343|'];
  db.handle = realHandle;
  // a second visitor sees the same marks (after their own tap)
  const w2 = familyPage(db, null, opts); await tick(w2, 60);
  w2.document.querySelector('[data-reveal]').click(); await tick(w2, 60);
  R.shared = /Bought ✓/.test(w2.document.querySelector('[data-item="6464|"]').textContent);
  // stopped / bad code
  delete db.lists.mine;
  const w3 = familyPage(db, null, opts); await tick(w3, 60);
  R.stoppedMsg = /no longer shared/.test(w3.document.body.textContent);
  const w4 = familyPage(db, 'https://therailroster.com/gift/?l=../../x', opts); await tick(w4, 60);
  R.badCode = /no longer shared/.test(w4.document.body.textContent) && w4._posts.length === 0;
  return R;
}

(async function main() {
  if (!JSDOM) { console.log('SKIP — jsdom not installed here'); process.exit(0); }
  section('A. The app — the family link');
  const A = await appStory();
  ok('Preview shows "Turn on the family link" — nothing is shared until he taps it', A.offAtFirst);
  ok('Preview asks the backend whether his list is already shared (gift_link)', A.askedLink);
  ok('the tap sends the list (gift_publish)', A.published);
  ok('…and shows the family page\'s address', A.onShown);
  ok('what is sent: the ticked items, each with its own key', A.sentKeys);
  ok('…the store links CODED (the same last stop as the email)', A.sentCoded);
  ok('…a link the store took down left off', A.sentNoGone);
  ok('…only what the preview shows — no email, no sheet, nothing else of his collection', A.sentOnlyShown);
  ok('…the store\'s picture', A.sentPicture);
  ok('…an item with no link goes as "ask me"', A.sentAsk);
  ok('the email starts with the family page\'s address', A.mailLink);
  ok('the text carries it too', A.textLink);
  ok('the printout has a QR code for the family page', A.printQr);
  ok('a shared list is sent again on every Preview (the page matches)', A.republished);
  ok('a fresh opening of the screen knows the list is shared', A.remembered);
  ok('"Stop sharing" asks first — "Keep sharing" changes nothing', A.stopAsks);
  ok('"Stop sharing" → the backend deletes it, the screen says so', A.stopped);
  ok('after stopping, Text asks first — Cancel turns nothing on and sends nothing', A.textAfterStop);
  ok('an old backend (before the v5.0 paste): "not ready yet", the preview still works', A.oldBackend);

  section('B. The collector never sees what was bought');
  ok('the app never asked for the marks (every backend call recorded)', A.neverMarks);
  const appFiles = fs.readdirSync(APPDIR).filter(f => /\.(js|html)$/.test(f));
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\/[^\n'"`]*$/gm, '');
  const askers = appFiles.filter(f => /['"]gift_marks?['"]/.test(strip(fs.readFileSync(path.join(APPDIR, f), 'utf8'))));
  ok('no file in app/ names gift_marks or gift_mark (comments aside)', askers.length === 0, askers);
  ok('(plant) a file that did would be caught', /['"]gift_marks?['"]/.test(strip("  vaultPost({ action: 'gift_marks', listId: c });")));
  ok('no "bought" words drawn by the app', !/bought/i.test(strip(GIFT).replace(/'[^']*mark what (you|they)[^']*'/g, '')) || !/>[^<]*bought[^<]*</i.test(strip(GIFT)));

  section('C. The family page');
  const C = await pageStory();
  const T2 = await twoStoreStory();
  ok('an item with two stores: one link per store, the box itself opens neither', T2.twoLinks);
  ok('it asks the app\'s own backend address', C.endpoint);
  ok('the list is shown (title, every item)', C.listShown);
  ok('the marks are NOT asked for until the tap — none shown', C.noMarksYet);
  ok('the button reads "Did you buy an item on this list? Mark it bought."', C.revealWords);
  ok('the button is the LAST thing — after every item, before the notes', C.revealAtBottom);
  ok('the line under the title says to tap an item', C.tapItemWords);
  ok('an item with one store: tapping anywhere on its box opens that store', C.boxOpens);
  ok('…and its line reads "See it at Trainz ›"', C.goWords);
  ok('an item with no link is not a tap target', C.noLinkNoTap);
  ok('after the button (at the bottom) the page goes back up to the first item', C.scrolledToFirst);
  ok('"I bought this" inside the box does NOT open the store', C.buyDoesNotOpen);
  ok('words are drawn as words (a name with markup stays text)', C.escaped);
  ok('a javascript: link never becomes a link', C.noJsLink);
  ok('an item with no usable link says "Ask Brad where to find this one"', C.askWhenNoLink);
  ok('only an https picture is drawn', C.httpsPicOnly);
  ok('"sold out right now" is shown', C.soldOut);
  ok('store links open in a new tab, with no way back into the page', C.newTab);
  ok('the disclosure line is shown', C.disclosure);
  ok('after the tap: the marks are read and shown, with "I bought this" on the rest', C.marksAfterTap);
  ok('a tap in the first moment after the list is drawn is ignored (2026-11-07)', C.calmAfterDraw);
  ok('"I bought this" shows "Saving…" at once, before the backend answers', C.savingAtOnce);
  ok('"I bought this" marks it', C.buy);
  ok('"Undo" sits apart — at the far side, not where "I bought this" was', C.undoApart);
  ok('the second half of a double tap does not undo it', C.doubleTapSafe);
  ok('"Undo" takes it back', C.undo);
  ok('a bought item: tapping the green "Bought ✓" opens nothing (Brad\'s tap, 2026-11-08)', C.greenTapOpensNothing);
  ok('a bought item: the green "Bought ✓", the name, the store name, the box — none opens the store (2026-11-08)', C.boughtOpensNothing);
  ok('…its store is named in plain words ("Trainz"), not a link', C.boughtStoreName);
  ok('…an item already bought when the marks came in opens nothing either', C.boughtOnLoadOpensNothing);
  ok('…after Undo, tapping the box opens the store again', C.undoTapsAgain);
  ok('…a bought item still says "sold out right now"', C.boughtKeepsSoldOut);
  ok('…a bought item with two stores: both named in plain words, neither a link', T2.boughtTwoNoLinks);
  ok('"too busy" while saving: the list stays, the words show under that item', C.busyUnderItem);
  ok('a save with no answer: the list stays, "That didn\'t save" under that item', C.failUnderItem);
  ok('a second visitor sees the same marks after their own tap', C.shared);
  ok('a stopped list says "This gift list is no longer shared."', C.stoppedMsg);
  ok('a bad code asks nobody and says the same', C.badCode);

  section('W. Wiring');
  const pageEndpoint = (PAGE.match(/var ENDPOINT = '([^']+)'/) || [])[1];
  ok('the page\'s backend address is the app\'s VAULT.ENDPOINT (one address, held together here)', !!ENDPOINT && pageEndpoint === ENDPOINT, pageEndpoint);
  ok('the page is never listed by search engines (noindex)', /<meta name="robots" content="noindex, nofollow">/.test(PAGE));
  ok('the page has its own security policy: talks only to the backend', /connect-src https:\/\/script\.google\.com https:\/\/script\.googleusercontent\.com;/.test(PAGE) && /default-src 'none'/.test(PAGE));
  ok('the page draws list words with textContent, never innerHTML', !/innerHTML/.test(PAGE));
  ok('the page is on the website list (publish: gift)', /^publish: gift$/m.test(SITE));
  ok('the privacy page says what a shared gift list keeps', /Gift list you choose to share \(optional\)/.test(PRIVACY) && /one-way code/.test(PRIVACY));
  ok('…and when it is deleted (Stop sharing, or 12 months)', /Stop sharing<\/b> in the app, or by itself 12 months after you last sent it/.test(PRIVACY));
  ok('vault.js: gift_publish, gift_link, gift_stop carry the sign-in proof', /IDENTITY_ACTIONS:[\s\S]{0,600}'gift_publish', 'gift_link', 'gift_stop'/.test(VAULT));
  ok('the family words live in config.js (RR_GIFT.family)', /family: \{[\s\S]*pageUrl: 'https:\/\/therailroster\.com\/gift\/\?l=\{code\}'/.test(CONFIG) && GIFT.replace(/^\s*\/\/.*$/gm, '').indexOf('therailroster.com/gift') < 0);

  section('P. Planted offenders');
  const plantApp = async (label, from, to, check) => {
    if (GIFT.indexOf(from) < 0) { ok('PLANT ' + label + ' — the plant applied', false, 'pattern not found'); return; }
    ok('PLANT ' + label + ' — caught', check(await appStory({ gift: GIFT.split(from).join(to) })));
  };
  const plantPage = async (label, from, to, check) => {
    if (PAGE.indexOf(from) < 0) { ok('PLANT ' + label + ' — the plant applied', false, 'pattern not found'); return; }
    ok('PLANT ' + label + ' — caught', check(await pageStory({ html: PAGE.split(from).join(to) })));
  };
  await plantApp('the app asks for the marks', "    return _post(function () { return vaultPost({ action: 'gift_link' }); }).then(function (r) {", "    _post(function () { return vaultPost({ action: 'gift_marks', listId: 'x' }); });\n    return _post(function () { return vaultPost({ action: 'gift_link' }); }).then(function (r) {", R => !R.neverMarks);
  await plantApp('the list shared on the first Preview, untapped', "if (_family.code && turn === _viewTurn) await _publish();", "if (turn === _viewTurn) await _publish();", R => !R.offAtFirst);
  await plantApp('raw (uncoded) links sent', "                 links: it.links.map(function (L) { return { store: L.store, url: L.url, soldOut: !!L.soldOut }; }) };",
    "                 links: it.links.map(function (L) { return { store: L.store, url: String(L.url).split('?')[0], soldOut: !!L.soldOut }; }) };", R => !R.sentCoded);
  await plantApp('stop without asking', "    if (!yes) return;\n    _family.busy = true;", "    yes = true;\n    _family.busy = true;", R => !R.stopAsks);
  await plantPage('marks read on load', "  call({ action: 'gift_get', listId: code }).then(function (r) {", "  call({ action: 'gift_marks', listId: code });\n  call({ action: 'gift_get', listId: code }).then(function (r) {", R => !R.noMarksYet);
  {
    const a1 = "var good = (it.links || []).filter(function (L) { return !!safeLink(L.url); });", a2 = "        var u = safeLink(L.url);\n";
    const html3 = PAGE.split(a1).join("var good = (it.links || []).filter(function (L) { return !!L.url; });").split(a2).join("        var u = String(L.url || '');\n");
    ok('PLANT any link made a link — caught', PAGE.indexOf(a1) >= 0 && PAGE.indexOf(a2) >= 0 && !(await pageStory({ html: html3 })).noJsLink);
  }
  await plantPage('a name drawn as markup', "var nm = el('div', 'name', (i + 1) + '. ' + (it.name || ''));", "var nm = el('div', 'name'); nm.innerHTML = (i + 1) + '. ' + (it.name || '');", R => !R.escaped);
  await plantPage('no pause after drawing (a double tap lands on Undo)', "if (busy || Date.now() < calmUntil) return;", "if (busy) return;", R => !R.doubleTapSafe);
  await plantPage('no "Saving…" while it saves', "if (btn) { btn.disabled = true; btn.textContent = WORDS.saving; }", '', R => !R.savingAtOnce);
  await plantPage('a busy save wipes the page', "if (r && r.status === 429) { failed(WORDS.busy); return; }", "if (r && r.status === 429) { busy = false; answer(r); return; }", R => !R.busyUnderItem);
  await plantPage('the failure words at the top, not under the item', "if (flash && flash.key === it.key) body.appendChild(el('p', 'flash', flash.text));", "if (flash && flash.key === it.key) page.insertBefore(el('p', 'flash', flash.text), page.firstChild);", R => !R.failUnderItem);
  {
    const html2 = PAGE.split("if (good.length === 1 && !bought) {\n        var only").join("if (good.length >= 1 && !bought) {\n        var only");
    ok('PLANT a two-store box made tappable — caught', html2 !== PAGE && !(await twoStoreStory({ html: html2 })).twoLinks);
  }
  await plantPage('the button back at the top', "    if (marks !== null) page.appendChild(el('p', 'sub', w('revealNote')));", "    if (marks !== null) page.appendChild(el('p', 'sub', w('revealNote')));\n    if (marks === null) { var rt = el('button', 'main', w('reveal')); rt.setAttribute('data-reveal', '1'); rt.onclick = reveal; page.appendChild(rt); }", R => !R.revealAtBottom);
  await plantPage('a button tap opens the store too', "while (t && t !== box) { if (t.tagName === 'BUTTON' || t.tagName === 'A') return; t = t.parentNode; }", "while (t && t !== box) { if (t.tagName === 'A') return; t = t.parentNode; }", R => !R.buyDoesNotOpen);
  await plantPage('a bought box still opens the store (the 2026-11-08 bug)', "if (good.length === 1 && !bought) {", "if (good.length === 1) {", R => !R.boughtOpensNothing);
  await plantPage('a bought item keeps its store link', "        if (bought) {\n          var off", "        if (false) {\n          var off", R => !R.boughtOpensNothing);
  {
    const a1 = "if (good.length === 1 && !bought) {", a2 = "        if (bought) {\n          var off";
    const old = PAGE.split(a1).join("if (good.length === 1) {").split(a2).join("        if (false) {\n          var off");
    ok('PLANT the page as it was live (bought box + its link) — the green-words tap catches it', PAGE.indexOf(a1) >= 0 && PAGE.indexOf(a2) >= 0 && !(await pageStory({ html: old })).greenTapOpensNothing);
    ok('PLANT a bought two-store item keeps its links — caught', !(await twoStoreStory({ html: PAGE.split(a2).join("        if (false) {\n          var off") })).boughtTwoNoLinks);
  }
  await plantPage('a bought item loses its sold-out note', "          if (L.soldOut) links.appendChild(el('span', 'so', '(' + WORDS.soldOut + ') '));\n          return;", "          return;", R => !R.boughtKeepsSoldOut);
  await plantPage('the box not tappable', "box.onclick = function (ev) {", "box.onclickX = function (ev) {", R => !R.boxOpens);
  await plantPage('no trip back up after the button', "try { if (first && first.scrollIntoView)", "try { if (false && first && first.scrollIntoView)", R => !R.scrolledToFirst);
  await plantPage('Undo back in the same spot', "var u2 = el('button', 'undo', WORDS.undo);", "var u2 = el('button', '', WORDS.undo);", R => !R.undoApart);
  await plantPage('a bad code sent to the backend', "if (!/^[a-f0-9]{32}$/.test(code)) { message(WORDS.gone); return; }", '', R => !R.badCode);
  {
    const other = PAGE.replace(/var ENDPOINT = '[^']+'/, "var ENDPOINT = 'https://script.google.com/macros/s/OLD/exec'");
    ok('PLANT the page pointed at another backend — caught', (other.match(/var ENDPOINT = '([^']+)'/) || [])[1] !== ENDPOINT);
  }
  console.log('\n' + (fail ? 'FAILURES' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
