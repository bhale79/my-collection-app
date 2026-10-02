// ═══════════════════════════════════════════════════════════════
// fav_list_panel_tests.js — v0.9.1860.
//
// [stated] Brad, 2026-10-02 (brainstorm → "lets do that. go"): "brainstorm
// how to add the add and subtract buttons to the dropdown menu so that you
// get a list of youtubers and can add and subtract there. they don't need to
// be on this page at all."
//
// THE RULES THIS SUITE PROTECTS (the favourites row: YouTube channels on the
// Maintenance card, parts dealers on Need a part — ONE builder):
//   1. The row is a button showing the pick + a hidden field with the row's
//      ORIGINAL id and value (every reader unchanged). No <select>, no + Add,
//      no − on the card.
//   2. Tapping the button opens a list panel beneath it: the built-in
//      choice(s), each favourite with a ×, then "+ Add a channel… / + Add a
//      store…" which reveals a name box in the panel.
//   3. Picking writes the hidden field + the button text and closes the panel;
//      a dealer pick tells the lane (_maintDealerPicked). Adding from the box
//      saves the name and picks it. × takes a favourite off (never a
//      built-in); if it was the pick, the pick goes back to the label; the
//      panel stays open, redrawn.
// The REAL handlers run in a small fake page; every rule can fail.
// Run:  node tests/fav_list_panel_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const maint = fs.readFileSync(path.join(__dirname, '..', 'app', 'maintenance.js'), 'utf8');
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('not found: ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced: ' + sig);
}
const MAINT = { PREF_DEALERS: 'maint_parts_dealers', PREF_CHANNELS: 'maint_yt_channels', PREF_DEALER_PICK: 'maint_parts_dealer_pick', MAKER_STORE: '__maker' };
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// a fake page holding ONE favourites row, built by the real _favRow
function page(src, prefKey, selectId, label, favs, pick) {
  const store = { favs: favs.slice(), prefs: {}, picked: [] };
  const els = {};
  const el = (id, extra) => (els[id] = Object.assign({ id, value: '', textContent: '', innerHTML: '', style: { display: '' }, focus() { store.focused = id; }, getAttribute(n) { return this._a ? this._a[n] : undefined; } }, extra || {}));
  const win = { _maintDealerPicked: h => store.picked.push(h.value) };
  const code = ['function _favKind(prefKey)', 'function _favPanelHtml(prefKey, selectId, label, pick)', 'function _favRow(prefKey, selectId, label)', 'function _favPanelRedraw(prefKey, selectId)',
    'function _dealerPick()', 'window._favPanelToggle = function', 'window._favPick = function', 'window._favAddShow = function', 'window._maintAddFav = async function', 'window._maintDelFav = function']
    .map(s => grab(src, s)).join('\n');
  const api = new Function('MAINT', '_esc', 'rrJsArg', '_btnPrimary', '_favs', '_saveFavs', '_prefGet', '_prefSet', 'document', 'window', 'appPrompt',
    code + '\nreturn { row: _favRow, panelHtml: _favPanelHtml, toggle: window._favPanelToggle, pick: window._favPick, addShow: window._favAddShow, add: window._maintAddFav, del: window._maintDelFav };')(
    MAINT, esc, v => esc(String(v).replace(/'/g, "\\'")), () => 'class="p"',
    () => store.favs.slice(), (k, a) => { store.favs = a.slice(); }, (k, d) => (k in store.prefs ? store.prefs[k] : d), (k, v) => { store.prefs[k] = v; },
    { getElementById: id => els[id] || null }, win, async () => '');
  if (pick !== undefined) store.prefs[MAINT.PREF_DEALER_PICK] = pick;
  const html = api.row(prefKey, selectId, label);
  // the elements the row drew
  el(selectId, { value: (html.match(new RegExp('id="' + selectId + '" value="([^"]*)"')) || [, ''])[1].replace(/&#39;/g, "'") });
  el(selectId + '-txt', { textContent: (html.match(new RegExp('id="' + selectId + '-txt">([^<]*)<')) || [, ''])[1].replace(/&#39;/g, "'") });
  el(selectId + '-wrap', { _a: { 'data-label': label, 'data-pref': prefKey } });
  el(selectId + '-panel', { style: { display: 'none' } });
  // the panel's name box and add row appear once the panel is drawn (we fake them present)
  el(selectId + '-addrow', { style: { display: 'none' } });
  el(selectId + '-new', { value: '' });
  return { api, els, store, html };
}

section('A · the row');
{
  const P = page(maint, MAINT.PREF_CHANNELS, 'maint-yt-channel', 'All of YouTube', ['@Grampyslioneltrains']);
  ok('a hidden field with the original id, a button showing the label, a panel closed — no <select>, no + Add, no −',
     /<input type="hidden" id="maint-yt-channel" value="">/.test(P.html) && /id="maint-yt-channel-txt">All of YouTube</.test(P.html) && /id="maint-yt-channel-panel" style="display:none/.test(P.html)
     && !/<select/.test(P.html) && !/>\+ Add</.test(P.html) && !/&minus;/.test(P.html));
  const ph = P.api.panelHtml(MAINT.PREF_CHANNELS, 'maint-yt-channel', 'All of YouTube', '');
  ok('the panel: All of YouTube, the channel with a ×, then "+ Add a channel…" with a name box',
     ph.indexOf('>All of YouTube<') < ph.indexOf('@Grampyslioneltrains') && /_maintDelFav\('maint_yt_channels','maint-yt-channel','@Grampyslioneltrains'\)/.test(ph)
     && /\+ Add a channel…/.test(ph) && /id="maint-yt-channel-new"/.test(ph) && ph.indexOf('@Grampyslioneltrains') < ph.indexOf('+ Add a channel'));
  ok('…and no × on All of YouTube', !/data-fav=""[^>]*>[^<]*<span>[^<]*<\/span><span onclick="event\.stopPropagation\(\);_maintDelFav/.test(ph));
}
{
  const P = page(maint, MAINT.PREF_DEALERS, 'maint-pop-dealer', 'Any dealer', ["Olsen's"], "Olsen's");
  ok('the dealer row remembers its pick (v1759) in the hidden field and on the button', P.els['maint-pop-dealer'].value === "Olsen's" && P.els['maint-pop-dealer-txt'].textContent === "Olsen's");
  const ph = P.api.panelHtml(MAINT.PREF_DEALERS, 'maint-pop-dealer', 'Any dealer', "Olsen's");
  ok('the dealer panel: Any dealer, the maker\'s own store, the favourite (marked ✓), "+ Add a store…"',
     ph.indexOf('>Any dealer<') < ph.indexOf('__maker') && /✓ Olsen&#39;s</.test(ph) && /\+ Add a store…/.test(ph));
}

section('B · the handlers, run');
(async function main() {
  const P = page(maint, MAINT.PREF_DEALERS, 'maint-pop-dealer', 'Any dealer', ["Olsen's", 'trainz.com'], '');
  P.api.toggle(MAINT.PREF_DEALERS, 'maint-pop-dealer');
  ok('tap the button → the panel opens, drawn with the current list', P.els['maint-pop-dealer-panel'].style.display === '' && /trainz\.com/.test(P.els['maint-pop-dealer-panel'].innerHTML));
  P.api.pick(MAINT.PREF_DEALERS, 'maint-pop-dealer', 'trainz.com');
  ok('pick trainz.com → hidden field + button text set, panel closed, the lane told', P.els['maint-pop-dealer'].value === 'trainz.com' && P.els['maint-pop-dealer-txt'].textContent === 'trainz.com' && P.els['maint-pop-dealer-panel'].style.display === 'none' && P.store.picked.slice(-1)[0] === 'trainz.com');
  P.api.pick(MAINT.PREF_DEALERS, 'maint-pop-dealer', '__maker');
  ok('pick the maker\'s own store → the button says so', P.els['maint-pop-dealer-txt'].textContent === "The maker's own store" && P.els['maint-pop-dealer'].value === '__maker');
  P.api.addShow('maint-pop-dealer');
  ok('"+ Add a store…" reveals the name box and focuses it', P.els['maint-pop-dealer-addrow'].style.display === 'flex' && P.store.focused === 'maint-pop-dealer-new');
  P.els['maint-pop-dealer-new'].value = "  Joe's Train Shop ";
  await P.api.add(MAINT.PREF_DEALERS, 'maint-pop-dealer');
  ok('Add → the trimmed name is saved to the list and becomes the pick; the lane told', P.store.favs.indexOf("Joe's Train Shop") >= 0 && P.els['maint-pop-dealer'].value === "Joe's Train Shop" && P.store.picked.slice(-1)[0] === "Joe's Train Shop");
  P.els['maint-pop-dealer-new'].value = "Joe's Train Shop";
  await P.api.add(MAINT.PREF_DEALERS, 'maint-pop-dealer');
  ok('adding the same name again does not double it', P.store.favs.filter(f => f === "Joe's Train Shop").length === 1);
  P.api.toggle(MAINT.PREF_DEALERS, 'maint-pop-dealer');
  P.api.del(MAINT.PREF_DEALERS, 'maint-pop-dealer', "Joe's Train Shop");
  ok('× on the current pick → off the list, the pick goes back to Any dealer, the lane told, the panel stays open and is redrawn without it',
     P.store.favs.indexOf("Joe's Train Shop") < 0 && P.els['maint-pop-dealer'].value === '' && P.els['maint-pop-dealer-txt'].textContent === 'Any dealer'
     && P.store.picked.slice(-1)[0] === '' && P.els['maint-pop-dealer-panel'].style.display === '' && !/data-fav="Joe/.test(P.els['maint-pop-dealer-panel'].innerHTML));   // (the name box's example text says Joe's too)
  P.api.del(MAINT.PREF_DEALERS, 'maint-pop-dealer', '__maker');
  ok('× cannot remove the maker\'s own store', P.store.favs.length === 2);
  P.api.del(MAINT.PREF_DEALERS, 'maint-pop-dealer', "Olsen's");
  ok('× on a favourite that is NOT the pick leaves the pick alone', P.store.favs.indexOf("Olsen's") < 0 && P.els['maint-pop-dealer'].value === '');

  section('C · the card');
  ok('the Repair Videos box and Need a part still draw the row through _favRow (one builder)', /_favRow\(MAINT\.PREF_CHANNELS, 'maint-yt-channel', 'All of YouTube'\)/.test(maint) && /_favRow\(MAINT\.PREF_DEALERS, 'maint-pop-dealer', 'Any dealer'\)/.test(maint));
  ok('the readers are unchanged (they read the hidden field by its id)', /getElementById\('maint-yt-channel'\) \|\| \{\}\)\.value/.test(maint) && /getElementById\('maint-pop-dealer'\) \|\| \{\}\)\.value/.test(maint));

  section('D · planted offenders are caught');
  ok('D1 a + Add button back on the card is caught', />\+ Add</.test(page(maint.replace("'</button>'\n      + '<div id=\"' + selectId + '-panel\"", "'</button><button>+ Add</button>'\n      + '<div id=\"' + selectId + '-panel\""), MAINT.PREF_CHANNELS, 'x', 'All of YouTube', []).html));
  ok('D2 a × on the built-in line is caught', (() => { const o = maint.replace("line('', label, false)", "line('', label, true)"); const ph = page(o, MAINT.PREF_CHANNELS, 'x', 'All of YouTube', []).api.panelHtml(MAINT.PREF_CHANNELS, 'x', 'All of YouTube', ''); return /data-fav=""[^]*?_maintDelFav\('maint_yt_channels','x',''\)/.test(ph); })());
  ok('D3 a pick that forgets to close the panel is caught', (() => { const o = maint.replace("if (panel) panel.style.display = 'none';\n    if (prefKey === MAINT.PREF_DEALERS) window._maintDealerPicked(hid);", "if (prefKey === MAINT.PREF_DEALERS) window._maintDealerPicked(hid);"); const Q = page(o, MAINT.PREF_CHANNELS, 'y', 'All of YouTube', ['a']); Q.api.toggle(MAINT.PREF_CHANNELS, 'y'); Q.api.pick(MAINT.PREF_CHANNELS, 'y', 'a'); return Q.els['y-panel'].style.display === ''; })());

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
