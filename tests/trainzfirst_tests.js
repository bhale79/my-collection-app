// ════════════════════════════════════════════════════════════════════════════
// trainzfirst_tests.js — Trainz built in for everyone (2026-11-24).
//
// [stated] Brad 2026-11-24, with screenshots:
//   16:53 CT "also we need to have trainz.com listed here at the top already for
//            all users without them having to do anything" (gift list, My Stores)
//   16:53 CT "i want trainz.com already pre selected here first" (Need a part's
//            store list)  → 16:55 CT "okay"
//   16:57 CT "part diagrams shows trainz first on the list then ours that are the
//            lionel postwar" → asked → "Yes, Trainz first" (that order is held by
//            maint_diagram_links_tests.js C2 and service_manual_links_tests.js B)
//
// THE RULES THIS SUITE PROTECTS:
//   A  ONE setting names the store: RR_BUILTIN_STORE in config.js. gift-list.js
//      and maintenance.js read it; neither types the store's name or address.
//   B  The gift list: the built-in store is FIRST under My Stores for everyone,
//      with no contacts at all; a contact on the same website is listed once;
//      each item's store pick starts on it; a pasted page from a store not on
//      the list, with nothing picked, shows "Another store", never the wrong name.
//   C  Need a part: the built-in store is FIRST in the store list (no ✕) and is
//      the pick for a member who never picked; a member's own pick is kept —
//      including "Any dealer" (a saved ''), which is HIS choice, not "unset".
//   P  Every check is proven able to fail on a planted offender.
// The REAL files run: gift-list.js in jsdom, maintenance.js's functions lifted.
// Run:  node tests/trainzfirst_tests.js
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const CONFIG = rd('config.js'), GIFT = rd('gift-list.js'), MT = rd('maintenance.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const code = s => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\/[^\n'"]*$/gm, '');
function block(src, start, end) { const i = src.indexOf(start); if (i < 0) return ''; const j = src.indexOf(end, i); return j < 0 ? '' : src.slice(i, j + end.length); }

// ── A · one setting ──────────────────────────────────────────────────────────
section('A · ONE setting names the built-in store');
const BUILTIN = block(CONFIG, 'const RR_BUILTIN_STORE = ', ';\n');
ok('config.js defines RR_BUILTIN_STORE once, as Trainz / trainz.com', (CONFIG.match(/const RR_BUILTIN_STORE = /g) || []).length === 1 && /\{ name: 'Trainz', site: 'trainz\.com' \}/.test(BUILTIN), BUILTIN);
ok('…and puts it on window', /window\.RR_BUILTIN_STORE = RR_BUILTIN_STORE;/.test(CONFIG));
const APPDIR = path.join(__dirname, '..', 'app');
const elsewhere = fs.readdirSync(APPDIR).filter(f => /\.js$/.test(f) && f !== 'config.js')
  .filter(f => /RR_BUILTIN_STORE\s*=/.test(code(fs.readFileSync(path.join(APPDIR, f), 'utf8'))));
ok('no other app file sets it', elsewhere.length === 0, elsewhere.join(', '));
ok('gift-list.js and maintenance.js read it', /RR_BUILTIN_STORE/.test(code(GIFT)) && /RR_BUILTIN_STORE/.test(code(MT)));
ok('gift-list.js never types the store (the setting is the one place)', !/trainz/i.test(code(GIFT)));
const BI_FN = block(MT, 'function _builtInDealer() {', '\n  }');
ok('maintenance.js\'s _builtInDealer reads the setting, no store typed in it', BI_FN.length > 40 && !/trainz/i.test(code(BI_FN)));
ok('the gift list no longer OFFERS Trainz as "+ Trainz" (it is always listed)', /suggestedStores: \[\],/.test(CONFIG));
// planted: a second copy typed into gift-list.js
ok('PLANT a store typed into gift-list.js — caught', /trainz/i.test(code(GIFT.replace('function _stores() {', "function _stores() { var t = 'trainz.com';"))));

// ── B · the gift list (real gift-list.js in jsdom) ───────────────────────────
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }
const GIFT_CFG = block(CONFIG, 'const RR_GIFT = {', '\n};');
const AFF_BLANK = block(CONFIG, 'const RR_AFFILIATE = [', '];');
const STORE = rd('store-links.js');
const tick = (w, ms) => new Promise(r => w.setTimeout(r, ms || 15));
function giftPage(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!doctype html><html><body><span id="gift-list-slot"></span></body></html>',
    { runScripts: 'outside-only', url: 'https://therailroster.com/app/' });
  const w = dom.window;
  w.open = function () { return null; };
  w.state = { personalSheetId: 'SHEET1', user: { email: 'x@example.com' }, contactsData: [{}],
    wantData: { '2343|': { itemNum: '2343', variation: '', manufacturer: 'Lionel', expectedPrice: '350', listType: 'Want' } } };
  w.accessToken = 'tok';
  w.rrFeatureOn = n => n === 'giftlist';
  w.rrBetaBadge = () => '';
  w.findMaster = () => ({ roadName: 'Santa Fe', description: 'F3 A unit' });
  w.rrToday = () => '2026-11-24';
  w._formatDate = d => d;
  w._formatPrice = n => '$' + n;
  w._money = v => parseFloat(v) || 0;
  w.rrUserName = () => 'Brad';
  w.showToast = () => {};
  w._ctPreferredVendors = () => (opts.vendors || []).slice();
  w._ctOpenEdit = () => {};
  w.appConfirm = () => Promise.resolve(true);
  w.vaultPost = () => Promise.resolve(null);
  w._withTokenRetry = fn => fn();
  w.fetch = () => Promise.resolve({ json: () => Promise.resolve({ sheets: [{ properties: { title: 'Gift List' } }] }) });
  w.sheetsGet = () => Promise.resolve({ values: [] });
  w.sheetsUpdate = () => Promise.resolve({});
  w.sheetsAppend = () => Promise.resolve(3);
  w.rrVerifiedRowUpdate = () => Promise.resolve(true);
  w.eval(AFF_BLANK + '\nwindow.RR_AFFILIATE = RR_AFFILIATE;');
  if (opts.builtIn !== false) w.eval(BUILTIN + '\nwindow.RR_BUILTIN_STORE = RR_BUILTIN_STORE;');
  w.eval(GIFT_CFG + '\nwindow.RR_GIFT = RR_GIFT;');
  w.eval(STORE);
  w.eval(opts.gift || GIFT);
  return w;
}
const MUFFIN = { name: "Mr. Muffin's", site: 'mrmuffinstrains.com' };
async function giftStory(src) {
  const R = {};
  const chips = w => Array.from(w.document.querySelectorAll('.gift-chip')).map(c => c.textContent);
  // 1 · a member with no stores at all
  let w = giftPage({ gift: src, vendors: [] });
  await w.rrGiftOpen(); await tick(w);
  R.emptyChips = chips(w);
  R.noNoStores = !/No stores yet/.test(w.document.body.textContent);
  // 2 · his own store, and a contact on Trainz's website named differently
  w = giftPage({ gift: src, vendors: [MUFFIN, { name: 'Trainz.com', site: 'trainz.com' }] });
  await w.rrGiftOpen(); await tick(w);
  R.mixChips = chips(w);
  w.rrGiftTick('2343|', true); await tick(w);
  const sel = w.document.querySelector('[data-gift-store="2343|"]');
  R.pickValue = sel ? sel.value : '(no box)';
  R.firstOption = sel ? sel.options[0].value : '';
  R.firstMarked = !!sel && sel.options[0].hasAttribute('selected');   // drawn picked — not just the browser's fallback
  R.trainzOptions = sel ? Array.from(sel.options).filter(o => o.value === 'trainz.com').length : 0;
  R.firstFind = (Array.from(w.document.querySelectorAll('button')).find(b => /^Find it at /.test(b.textContent)) || {}).textContent || '';
  // a page from a store not on his list, nothing picked → "Another store"
  w.rrGiftPendingUrl('2343|', 'https://www.ebay.com/itm/12345');
  R.otherShown = sel ? sel.value : '';
  // a Trainz page → Trainz
  w.rrGiftPendingUrl('2343|', 'https://www.trainz.com/products/lionel-2343');
  R.trainzShown = sel ? sel.value : '';
  // 3 · no setting at all (an old config) → his own stores only, as before
  w = giftPage({ gift: src, vendors: [MUFFIN], builtIn: false });
  await w.rrGiftOpen(); await tick(w);
  R.noSettingChips = chips(w);
  return R;
}

(async function main() {
  section('B · the gift list');
  if (!JSDOM) {
    ok('jsdom is needed for section B (npm install) — UNKNOWN, not green', false, 'jsdom missing');
  } else {
    const R = await giftStory();
    ok('a member with NO stores sees Trainz under My Stores, set up for him', R.emptyChips.join('|') === 'Trainz', R.emptyChips.join('|'));
    ok('…and no "No stores yet" line', R.noNoStores);
    ok('Trainz is FIRST, then his own stores', R.mixChips[0] === 'Trainz' && R.mixChips.indexOf("Mr. Muffin's") > 0, R.mixChips.join('|'));
    ok('a contact on the same website is listed once, in Trainz\'s place', R.mixChips.length === 2 && R.mixChips.filter(c => /trainz/i.test(c)).length === 1, R.mixChips.join('|'));
    ok('an item\'s store pick starts on Trainz (drawn picked)', R.pickValue === 'trainz.com' && R.firstOption === 'trainz.com' && R.firstMarked, R.pickValue + ' / ' + R.firstOption + ' / ' + R.firstMarked);
    ok('…offered once in the box', R.trainzOptions === 1, String(R.trainzOptions));
    ok('"Find it at Trainz" is the first find button', R.firstFind === 'Find it at Trainz', R.firstFind);
    ok('a pasted page from a store not on his list, nothing picked → "Another store", never Trainz', R.otherShown === '__other', R.otherShown);
    ok('a pasted Trainz page → Trainz', R.trainzShown === 'trainz.com', R.trainzShown);
    ok('with no setting (an older config) the list is his own stores, as before', R.noSettingChips.join('|') === "Mr. Muffin's", R.noSettingChips.join('|'));

    section('P · gift list planted offenders');
    const plantG = async (label, from, to, bad) => {
      const src = GIFT.replace(from, to);
      if (src === GIFT) { ok('PLANT ' + label + ' — the plant applied', false, 'pattern not found'); return; }
      const P = await giftStory(src);
      ok('PLANT ' + label + ' — caught', bad(P));
    };
    await plantG('built-in store dropped', 'if (!b) return mine;', 'return mine;', P => P.emptyChips.length === 0);
    await plantG('built-in store put LAST', "return [b].concat(mine.filter(function (s) { return String((s && s.site) || '').toLowerCase() !== b.site; }));",
      "return mine.filter(function (s) { return String((s && s.site) || '').toLowerCase() !== b.site; }).concat([b]);", P => P.mixChips[0] !== 'Trainz');
    await plantG('a same-website contact listed twice', "return String((s && s.site) || '').toLowerCase() !== b.site;", 'return true;', P => P.mixChips.filter(c => /trainz/i.test(c)).length === 2);
    await plantG('the pick no longer drawn on the first store', "((p.store ? p.store === s.site : i === 0) ? ' selected' : '')", "((p.store === s.site) ? ' selected' : '')", P => !P.firstMarked);
    await plantG('"Another store" not shown for an outside page', "else if (sel && !p.store && _hostOf(p.url)) sel.value = '__other';", '', P => P.otherShown !== '__other');
  }

  // ── C · Need a part (maintenance.js, real functions lifted) ────────────────
  section('C · Need a part');
  function grab(src, sig) { const i = src.indexOf(sig); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; }
  const SIGS = ['function _builtInDealer()', 'function _dealerPick()', 'function _dealerSite(d)', 'function _plainWords(s)',
    'function _partsUrl(dealer, item, quoted, plain, makerWord)', 'function _favKind(prefKey)', 'function _favPanelHtml(prefKey, selectId, label, pick)', 'function _favRow(prefKey, selectId, label)',
    // 2026-11-28 (suggestchan): read by _favPanelHtml for the channel list
    'function _chanKey(v)', 'function _suggestedChannelList()', 'function _suggestedChannels()', 'function _suggestedChannelName(v)'];
  function room(src, opts) {
    opts = opts || {};
    const parts = SIGS.map(s => grab(src, s));
    const prefs = Object.assign({}, opts.prefs || {});
    const MAINT = { PREF_DEALERS: 'maint_parts_dealers', PREF_CHANNELS: 'maint_yt_channels', PREF_DEALER_PICK: 'maint_parts_dealer_pick', MAKER_STORE: '__maker' };
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const win = opts.noSetting ? {} : { RR_BUILTIN_STORE: { name: 'Trainz', site: 'trainz.com' } };
    const doc = { getElementById: id => (id === 'maint-pop-dealer' ? (opts.select || null) : null) };
    const api = new Function('MAINT', '_esc', 'rrJsArg', '_btnPrimary', '_makerName', '_favs', '_prefGet', 'document', 'window',
      parts.join('\n') + '\nreturn { pick: _dealerPick, panel: _favPanelHtml, row: _favRow, url: _partsUrl, bi: _builtInDealer };'
    )(MAINT, esc, v => esc(String(v == null ? '' : v).replace(/'/g, "\\'")), () => 'class="p"', () => 'Lionel',
      key => (key === MAINT.PREF_DEALERS ? (opts.favs || []).slice() : []),
      (k, d) => (k in prefs ? prefs[k] : d), doc, win);
    return { api, ok: parts.every(p => p.length > 30), lens: parts.map(p => p.length) };
  }
  const story = src => {
    const R = {};
    const r0 = room(src);
    R.lifted = r0.ok; R.lens = r0.lens.join(',');
    R.unset = r0.api.pick();
    R.anyKept = room(src, { prefs: { maint_parts_dealer_pick: '' } }).api.pick();
    R.favKept = room(src, { favs: ["Olsen's"], prefs: { maint_parts_dealer_pick: "Olsen's" } }).api.pick();
    R.makerKept = room(src, { prefs: { maint_parts_dealer_pick: '__maker' } }).api.pick();
    R.onScreen = room(src, { select: { value: '' } }).api.pick();   // the box on screen says Any dealer
    const row = r0.api.row('maint_parts_dealers', 'maint-pop-dealer', 'Any dealer');
    R.rowHidden = /<input type="hidden" id="maint-pop-dealer" value="trainz\.com">/.test(row);
    R.rowText = (row.match(/id="maint-pop-dealer-txt">([^<]*)</) || [])[1];
    const ph = room(src, { favs: ['trainz.com', "Olsen's"] }).api.panel('maint_parts_dealers', 'maint-pop-dealer', 'Any dealer', 'trainz.com');
    R.firstLine = (ph.match(/data-fav="([^"]*)"/) || [])[1];
    R.order = ph.indexOf('data-fav="trainz.com"') < ph.indexOf('data-fav=""') && ph.indexOf('data-fav=""') < ph.indexOf('data-fav="__maker"');
    R.once = (ph.match(/data-fav="trainz\.com"/g) || []).length;
    R.noX = !/_maintDelFav\('maint_parts_dealers','maint-pop-dealer','trainz\.com'\)/.test(ph);
    R.ticked = /✓ trainz\.com</.test(ph);
    R.channels = (room(src).api.panel('maint_yt_channels', 'maint-yt-channel', 'All of YouTube', '').match(/trainz/gi) || []).length;
    R.search = decodeURIComponent(r0.api.url('trainz.com', { itemNum: '2343' }, '', 'E-unit').replace('https://www.google.com/search?q=', ''));
    const old = room(src, { noSetting: true });
    R.noSettingPick = old.api.pick();
    R.noSettingLines = (old.api.panel('maint_parts_dealers', 'maint-pop-dealer', 'Any dealer', '').match(/data-fav="/g) || []).length;
    return R;
  };
  const M = story(MT);
  ok('the functions were lifted out of maintenance.js', M.lifted, M.lens);
  ok('a member who never picked a store: trainz.com is the pick', M.unset === 'trainz.com', M.unset);
  ok('…the box shows it, picked from the start', M.rowHidden && M.rowText === 'trainz.com', M.rowText);
  ok('a member who chose "Any dealer" keeps it (a saved \'\' is his choice, not unset)', M.anyKept === '', JSON.stringify(M.anyKept));
  ok('a member who chose his own store keeps it', M.favKept === "Olsen's", M.favKept);
  ok('…and "The maker\'s own store" is kept', M.makerKept === '__maker', M.makerKept);
  ok('the box on screen wins (he just changed it)', M.onScreen === '', JSON.stringify(M.onScreen));
  ok('trainz.com is FIRST in the store list, then Any dealer, then the maker\'s own store', M.firstLine === 'trainz.com' && M.order, M.firstLine);
  ok('…listed once, even when he had typed it himself', M.once === 1, String(M.once));
  ok('…with no ✕ (it cannot be taken off)', M.noX);
  ok('…and marked as the pick', M.ticked);
  ok('the YouTube channel list gets no store', M.channels === 0, String(M.channels));
  ok('the search names the store the way a typed "trainz.com" does', /^trainz\.com Lionel 2343 /.test(M.search), M.search);
  ok('with no setting (an older config): Any dealer, two built-in lines, as before', M.noSettingPick === '' && M.noSettingLines === 2, M.noSettingPick + ' / ' + M.noSettingLines);
  const delFav = grab(MT, 'window._maintDelFav = function (prefKey, selectId, name)');
  ok('the ✕ handler refuses to take the built-in store off', /gone === _builtInDealer\(\)\) return;/.test(delFav));

  section('P · Need a part planted offenders');
  const plantM = (label, from, to, bad) => {
    const src = MT.replace(from, to);
    if (src === MT) { ok('PLANT ' + label + ' — the plant applied', false, 'pattern not found'); return; }
    ok('PLANT ' + label + ' — caught', bad(story(src)));
  };
  plantM('unset read as "Any dealer" (the old default)', '_prefGet(MAINT.PREF_DEALER_PICK, null)', "_prefGet(MAINT.PREF_DEALER_PICK, '')", R => R.unset !== 'trainz.com');
  plantM('a saved "Any dealer" overridden by Trainz', "v = (saved === null || saved === undefined) ? _builtInDealer() : String(saved);", 'v = String(saved || _builtInDealer());', R => R.anyKept !== '');
  plantM('the built-in line dropped from the list', "+ (bi ? line(bi, bi, false) : '')", '', R => R.firstLine !== 'trainz.com');
  plantM('a typed "trainz.com" listed twice', "if (bi) favs = favs.filter(function (f) { return String(f).trim().toLowerCase() !== bi; });", '', R => R.once !== 1);
  plantM('the built-in pick refused as "not a favorite"', "v === _builtInDealer() || ", '', R => R.unset !== 'trainz.com');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
