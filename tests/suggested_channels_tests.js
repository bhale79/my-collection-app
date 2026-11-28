// ═══════════════════════════════════════════════════════════════════════════
// suggested_channels_tests.js — 2026-11-28 (suggestchan, PLAN_2026-11-28_SUGGESTED_CHANNEL.md)
//
// [stated] Brad 2026-11-27 23:52 CT "we need to add his channel to the
// maintenance videos as a prefilled channel" (Mike Moore, Toy Train Tips And
// Tricks) → 2026-11-28 07:29 CT "well that rule changed for Trainz.com only.
// for Mike, no, just leave it as a drop down selection" → 07:31 CT "go".
//
// THE RULES THIS SUITE PROTECTS (the Toolbox's Repair Videos channel list):
//   1. The suggested channels live in ONE place — RR_SUGGESTED_CHANNELS in the
//      config file — and no other app file names Mike's handle.
//   2. Every member sees Toy Train Tips And Tricks in the channel list, under
//      "All of YouTube", marked "Suggested", with a ✕. It is NEVER the starting
//      pick: the box starts on "All of YouTube".
//   3. Picking it searches youtube.com/@ToyTrainTipsAndTricks/search for the
//      item, and the box reads its NAME, not the handle.
//   4. ✕ takes it off and it STAYS off (remembered in maint_yt_channels_hidden,
//      a setting that follows the account), also after a reload.
//   5. It is drawn beside the member's own channels, never written into them;
//      a member who typed the same handle himself sees it ONCE, as his own; if
//      he takes his own copy off, the suggestion does not come back.
//   6. The parts store list gets nothing from it (stores are not channels).
// The REAL code from maintenance.js and the REAL list from the config file run
// in a small fake page. Section P plants each rule broken; each must go red.
//
// Run: node tests/suggested_channels_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('not found: ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced: ' + sig);
}
const MAINT_SRC = APP('maintenance.js');
const CFG_SRC = APP('config.js');

// the REAL list, read out of the config file
function cfgList(cfg) {
  const m = cfg.match(/const RR_SUGGESTED_CHANNELS = (\[[\s\S]*?\]);/);
  if (!m) return null;
  return new Function('return ' + m[1])();
}

const MAINT = { PREF_DEALERS: 'maint_parts_dealers', PREF_CHANNELS: 'maint_yt_channels', PREF_CHANNELS_HIDDEN: 'maint_yt_channels_hidden', PREF_DEALER_PICK: 'maint_parts_dealer_pick', MAKER_STORE: '__maker' };
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const SIGS = ['function _favs(key)', 'function _saveFavs(key, arr)', 'function _chanKey(v)', 'function _suggestedChannelList()', 'function _suggestedChannels()', 'function _suggestedChannelName(v)',
  'function _builtInDealer()', 'function _dealerPick()', 'function _favKind(prefKey)', 'function _favPanelHtml(prefKey, selectId, label, pick)', 'function _favRow(prefKey, selectId, label)',
  'function _favPanelRedraw(prefKey, selectId)', 'window._favPanelToggle = function', 'window._favPick = function', 'window._maintDelFav = function', 'function _ytUrl(channel, item, part, action)'];

// a fake page holding ONE favourites row; prefs is the account's settings (survives a "reload")
function page(src, list, prefKey, selectId, label, prefs) {
  const els = {};
  const el = (id, extra) => (els[id] = Object.assign({ id, value: '', textContent: '', innerHTML: '', style: { display: '' }, getAttribute(n) { return this._a ? this._a[n] : undefined; } }, extra || {}));
  const win = { RR_SUGGESTED_CHANNELS: list, RR_BUILTIN_STORE: { name: 'Trainz', site: 'trainz.com' }, _maintDealerPicked() {} };
  const code = SIGS.map(s => grab(src, s)).join('\n');
  const api = new Function('MAINT', '_esc', 'rrJsArg', '_btnPrimary', '_prefGet', '_prefSet', 'document', 'window', '_makerName', '_baseNum', '_shortName',
    code + '\nreturn { row: _favRow, panelHtml: _favPanelHtml, toggle: window._favPanelToggle, pick: window._favPick, del: window._maintDelFav, yt: _ytUrl, favs: _favs };')(
    MAINT, esc, v => esc(String(v).replace(/'/g, "\\'")), () => 'class="p"',
    (k, d) => (k in prefs ? prefs[k] : d), (k, v) => { prefs[k] = v; },
    { getElementById: id => els[id] || null }, win, () => 'Lionel', () => '2343', () => 'Santa Fe F3');
  const html = api.row(prefKey, selectId, label);
  el(selectId, { value: (html.match(new RegExp('id="' + selectId + '" value="([^"]*)"')) || [, ''])[1] });
  el(selectId + '-txt', { textContent: (html.match(new RegExp('id="' + selectId + '-txt">([^<]*)<')) || [, ''])[1] });
  el(selectId + '-wrap', { _a: { 'data-label': label, 'data-pref': prefKey } });
  el(selectId + '-panel', { style: { display: 'none' } });
  return { api, els, prefs, html, panel: () => api.panelHtml(prefKey, selectId, label, els[selectId].value) };
}
const CH = ['maint_yt_channels', 'maint-yt-channel', 'All of YouTube'];
const savedList = (prefs, k) => { try { return JSON.parse(prefs[k] || '[]'); } catch (e) { return ['<bad>']; } };

function checks(src, cfg) {
  const r = {};
  const list = cfgList(cfg) || [];
  r.cfgOne = list.length >= 1 && list[0].name === 'Toy Train Tips And Tricks' && list[0].handle === '@ToyTrainTipsAndTricks'
    && (cfg.match(/const RR_SUGGESTED_CHANNELS\b/g) || []).length === 1 && /window\.RR_SUGGESTED_CHANNELS = RR_SUGGESTED_CHANNELS/.test(cfg);
  const others = fs.readdirSync(path.join(__dirname, '..', 'app')).filter(f => /\.js$/.test(f) && f !== 'config.js' && f !== 'maintenance.js').map(APP);
  r.oneSource = !/ToyTrainTipsAndTricks|Toy Train Tips And Tricks/i.test(src) && !others.some(s => /ToyTrainTipsAndTricks/i.test(s));

  // 2 · listed, marked, removable, never the starting pick
  let P = page(src, list, ...CH, {});
  const ph = P.panel();
  const iAll = ph.indexOf('All of YouTube</span>'), iMike = ph.indexOf('Toy Train Tips And Tricks'), iAdd = ph.indexOf('+ Add a channel');
  r.listed = iAll > 0 && iMike > iAll && iAdd > iMike && /Toy Train Tips And Tricks <span[^>]*>Suggested<\/span>/.test(ph)
    && ph.indexOf("_maintDelFav('maint_yt_channels','maint-yt-channel','@ToyTrainTipsAndTricks')") > 0;
  r.notDefault = P.els['maint-yt-channel'].value === '' && P.els['maint-yt-channel-txt'].textContent === 'All of YouTube' && /✓ All of YouTube/.test(ph) && !/✓ Toy Train/.test(ph);

  // 3 · picking it: the search goes to his channel; the box reads the name
  P.api.pick(...CH.slice(0, 2), '@ToyTrainTipsAndTricks');
  const url = P.api.yt(P.els['maint-yt-channel'].value, {}, 'e-unit', 'repair');
  r.pickSearch = P.els['maint-yt-channel'].value === '@ToyTrainTipsAndTricks' && /^https:\/\/www\.youtube\.com\/@ToyTrainTipsAndTricks\/search\?query=/.test(url) && /e-unit/.test(decodeURIComponent(url));
  r.pickName = P.els['maint-yt-channel-txt'].textContent === 'Toy Train Tips And Tricks';
  r.notWrittenOnPick = savedList(P.prefs, 'maint_yt_channels').length === 0;

  // 4 · ✕ takes it off and it stays off (also after a reload); the pick goes back
  P.api.del(...CH.slice(0, 2), '@ToyTrainTipsAndTricks');
  const hidden = savedList(P.prefs, 'maint_yt_channels_hidden');
  const reload = page(src, list, ...CH, P.prefs);
  r.xSticks = hidden.length === 1 && /toytraintipsandtricks/i.test(hidden[0]) && P.panel().indexOf('Toy Train Tips') < 0 && reload.panel().indexOf('Toy Train Tips') < 0
    && P.els['maint-yt-channel'].value === '' && P.els['maint-yt-channel-txt'].textContent === 'All of YouTube';
  r.notWrittenOnX = savedList(P.prefs, 'maint_yt_channels').length === 0 && !('maint_yt_channels' in P.prefs);   // not even saved as []
  // …and with his own list on this device, a ✕ on the suggestion leaves that setting untouched (no newer stamp to win a sync)
  const mineP = page(src, list, ...CH, { maint_yt_channels: JSON.stringify(['@Grampyslioneltrains']) });
  const writes = []; const _ps = mineP.prefs; const prox = new Proxy(_ps, { set(t, k, v) { writes.push(k); t[k] = v; return true; } });
  const mineP2 = page(src, list, ...CH, prox);
  mineP2.api.del(...CH.slice(0, 2), '@ToyTrainTipsAndTricks');
  r.ownListUntouched = writes.indexOf('maint_yt_channels') < 0 && writes.indexOf('maint_yt_channels_hidden') >= 0 && savedList(_ps, 'maint_yt_channels').join() === '@Grampyslioneltrains';

  // 5 · his own copy: shown once; taking his own copy off keeps the suggestion off
  const own = { maint_yt_channels: JSON.stringify(['@toytraintipsandtricks', '@Grampyslioneltrains']) };
  P = page(src, list, ...CH, own);
  const ph2 = P.panel();
  r.once = (ph2.match(/toytraintipsandtricks/gi) || []).length >= 1 && !/Toy Train Tips And Tricks/.test(ph2) && !/>Suggested</.test(ph2) && /@Grampyslioneltrains/.test(ph2);
  P.api.del(...CH.slice(0, 2), '@toytraintipsandtricks');
  const ph3 = P.panel();
  r.ownOffStaysOff = !/toytraintipsandtricks|Toy Train Tips/i.test(ph3) && savedList(P.prefs, 'maint_yt_channels').join() === '@Grampyslioneltrains';
  // an ordinary channel's ✕ hides no suggestion
  P = page(src, list, ...CH, { maint_yt_channels: JSON.stringify(['@Grampyslioneltrains']) });
  P.api.del(...CH.slice(0, 2), '@Grampyslioneltrains');
  r.plainX = savedList(P.prefs, 'maint_yt_channels_hidden').length === 0 && /Toy Train Tips And Tricks/.test(P.panel());

  // 6 · the parts store list gets nothing
  P = page(src, list, 'maint_parts_dealers', 'maint-pop-dealer', 'Any dealer', {});
  const pd = P.panel();
  r.noDealer = !/Toy Train|Suggested/.test(pd) && /trainz\.com/.test(pd);
  // no list in the config → no line, nothing breaks
  P = page(src, undefined, ...CH, {});
  r.noList = !/Suggested/.test(P.panel()) && /All of YouTube/.test(P.panel());
  return r;
}

section('A · one place');
const A = checks(MAINT_SRC, CFG_SRC);
ok('RR_SUGGESTED_CHANNELS holds Toy Train Tips And Tricks / @ToyTrainTipsAndTricks, defined once', A.cfgOne);
ok('no other app file names the channel (maintenance.js reads the list, never types it)', A.oneSource);

section('B · listed, never the starting pick');
ok('the panel: All of YouTube, then Toy Train Tips And Tricks "Suggested" with a ✕, then + Add a channel…', A.listed);
ok('the box starts on All of YouTube (✓ on All of YouTube, not on Mike\'s channel)', A.notDefault);

section('C · picking it');
ok('the search goes to youtube.com/@ToyTrainTipsAndTricks/search with the item and part', A.pickSearch);
ok('the box reads "Toy Train Tips And Tricks", not the handle', A.pickName);
ok('picking it writes nothing into the member\'s own channel list', A.notWrittenOnPick);

section('D · taking it off');
ok('✕ hides it, remembered in maint_yt_channels_hidden; gone after a reload; the pick goes back to All of YouTube', A.xSticks);
ok('✕ writes nothing into the member\'s own channel list', A.notWrittenOnX);
ok('✕ on the suggestion does not re-save his own channel list (a stale device must not win a sync)', A.ownListUntouched);
ok('✕ on an ordinary channel hides no suggestion', A.plainX);

section('E · the member\'s own copy');
ok('typed in himself: shown once, as his own (no "Suggested" line)', A.once);
ok('taking his own copy off keeps the suggestion off', A.ownOffStaysOff);

section('F · not for stores, and safe without a list');
ok('the parts store list shows Trainz and no suggested channel', A.noDealer);
ok('with no list in the config the channel list is as before', A.noList);

section('P · planted offenders');
function planted(name, mutate, mustFail) {
  const m = mutate({ src: MAINT_SRC, cfg: CFG_SRC });
  let r = null; try { r = checks(m.src, m.cfg); } catch (e) { r = null; }
  const caught = !!r && mustFail.some(k => !r[k]);
  ok('planted: ' + name + ' → caught', caught, r ? JSON.stringify(mustFail.map(k => k + '=' + r[k])) : 'threw');
}
const R = (s, a, b) => { if (s.indexOf(a) < 0) throw new Error('plant target missing: ' + a.slice(0, 60)); return s.replace(a, b); };
planted('Mike\'s channel picked first', o => ({ src: R(o.src, "pick = isDealer ? _dealerPick() : '';", "pick = isDealer ? _dealerPick() : (prefKey === MAINT.PREF_CHANNELS && _suggestedChannels()[0] ? _suggestedChannels()[0].handle : '');"), cfg: o.cfg }), ['notDefault']);
planted('the suggestion shown in the store list too', o => ({ src: R(o.src, "+ (prefKey === MAINT.PREF_CHANNELS ? _suggestedChannels()", "+ (true ? _suggestedChannels()"), cfg: o.cfg }), ['noDealer']);
planted('a ✕ that does not stick', o => ({ src: R(o.src, "_saveFavs(MAINT.PREF_CHANNELS_HIDDEN, hidden);", ""), cfg: o.cfg }), ['xSticks']);
planted('his own copy listed twice', o => ({ src: R(o.src, "return hidden.indexOf(k) < 0 && mine.indexOf(k) < 0;", "return hidden.indexOf(k) < 0;"), cfg: o.cfg }), ['once']);
planted('the box shows the handle', o => ({ src: R(o.src, ": (prefKey === MAINT.PREF_CHANNELS && _suggestedChannelName(hid.value) && _favs(prefKey).indexOf(hid.value) < 0) ? _suggestedChannelName(hid.value)", ": false ? ''"), cfg: o.cfg }), ['pickName']);
planted('the suggestion written into the member\'s list', o => ({ src: R(o.src, "function _suggestedChannels() {", "function _suggestedChannels() {\n    var _m = _favs(MAINT.PREF_CHANNELS); _suggestedChannelList().forEach(function (c) { if (_m.indexOf(c.handle) < 0) _m.push(c.handle); }); _saveFavs(MAINT.PREF_CHANNELS, _m);"), cfg: o.cfg }), ['notWrittenOnPick', 'notWrittenOnX', 'listed']);
planted('the ✕ re-saves his list every time', o => ({ src: R(o.src, "if (favs.length !== had.length) _saveFavs(prefKey, favs);", "_saveFavs(prefKey, favs);"), cfg: o.cfg }), ['ownListUntouched', 'notWrittenOnX']);
planted('a second copy of the channel typed into maintenance.js', o => ({ src: R(o.src, "function _chanKey(v) {", "var _MIKE = '@ToyTrainTipsAndTricks';\n  function _chanKey(v) {"), cfg: o.cfg }), ['oneSource']);
planted('the list gone from the config file', o => ({ src: o.src, cfg: R(o.cfg, "const RR_SUGGESTED_CHANNELS = [", "const RR_SUGGESTED_CHANNELS_OFF = [") }), ['cfgOne', 'listed']);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
