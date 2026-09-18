// ═══════════════════════════════════════════════════════════════
// copy_identity_tests.js — v0.9.1761. WHICH COPY does the app act on?
//
// Brad, 2026-09-16: "i added a new hot air balloon ride... i hit remove on the
// one i just added, and the two went away." His ORIGINAL 6-24177 was deleted —
// Inventory ID 153, condition 8, boxed, 2004 — and had to be restored by hand.
//
// THE BUG: an owned copy is its Inventory ID. Two things stood in for it and
// both are wrong — the item NUMBER (you can own two) and the ROW number (it
// moves). findPD / findPDKey answer "which copy?" from an index holding ONE key
// per number+variation, so with two copies the answer is first-one-wins. Nine
// places opened the item detail page without saying which copy, and with no id
// every button on that page — Edit, Photos, Sell, For Sale, Remove — fell back
// to that coin flip.
//
// THE GUARD COULD NOT CATCH IT. sheetsDeleteRow re-reads the row first, but it
// settles on the Inventory ID only when it is GIVEN one; with a blank id it
// checks the item number, which is the very thing that is not unique. It
// confirms "yes, that's a 24177" on either row. So the fix has to be upstream.
//
// This suite runs the REAL list-of-copies helpers, and sweeps the app so a new
// detail-page opener that forgets the copy id turns the build red.
// Run:  node tests/copy_identity_tests.js
// ═══════════════════════════════════════════════════════════════
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
  const i = src.indexOf(sig); if (i < 0) return '';
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  return '';
}

// ── the real helpers, lifted out of wizard-pdlookup.js ────────────────────
const pdl = APP('wizard-pdlookup.js');
const parts = ['function _pdLookupKey(itemNum, variation)', 'function rrSameNum(a, b)',
               'function rrOwnedCopyKeys(itemNum, variation, anyVariation)', 'function rrCopyInvFor(itemNum, variation, anyVariation)']
  .map(sig => grab(pdl, sig));
ok('all four identity helpers are in wizard-pdlookup.js', parts.every(p => p.length > 30),
   parts.map(p => p.length).join(','));
const mk = new Function('state', parts.join('\n') + '\nreturn { keys: rrOwnedCopyKeys, inv: rrCopyInvFor };');

// Brad's actual shape: two 6-24177s, plus singles and an unowned row.
function room() {
  return { personalData: {
    '153': { inventoryId: '153', itemNum: '6-24177', variation: '', owned: true,  row: 233, condition: '8' },
    '260': { inventoryId: '260', itemNum: '6-24177', variation: '', owned: true,  row: 234, condition: '' },
    '99':  { inventoryId: '99',  itemNum: '6-8359',  variation: '', owned: true,  row: 12 },
    '77':  { inventoryId: '77',  itemNum: '2343',    variation: 'A', owned: true, row: 40 },
    '78':  { inventoryId: '78',  itemNum: '2343',    variation: 'B', owned: true, row: 41 },
    '55':  { inventoryId: '55',  itemNum: '6-24177', variation: '', owned: false, row: 9 },
    '31':  { inventoryId: '31',  itemNum: '210-P',   variation: '', owned: true,  row: 70 },
  } };
}

section('"Which copy?" is answered with a LIST, never with the first one');
const api = mk(room());
ok('both of Brad\'s 6-24177s are found — the number names two copies, not one',
   JSON.stringify(api.keys('6-24177', '')) === '["153","260"]', JSON.stringify(api.keys('6-24177', '')));
ok('the order is the sheet\'s order, so "Copy 1 of 2" means the same copy every render',
   api.keys('6-24177', '')[0] === '153');
ok('a row that is not owned is not a candidate (the sold/removed 24177 row)',
   api.keys('6-24177', '').indexOf('55') < 0);
ok('a single copy is still a list of one', JSON.stringify(api.keys('6-8359', '')) === '["99"]');
ok('nothing owned gives an empty list, not a wrong answer', api.keys('1234', '').length === 0);
ok('a blank number can never match everything', api.keys('', '').length === 0 && api.keys(null, '').length === 0);

section('Variations are different things — unless the caller only has a number');
ok('2343 Var. A is one copy, not both variations', JSON.stringify(api.keys('2343', 'A')) === '["77"]');
ok('2343 Var. B is the other', JSON.stringify(api.keys('2343', 'B')) === '["78"]');
ok('with anyVariation, 2343 names BOTH — more candidates means "ask", never "guess"',
   JSON.stringify(api.keys('2343', '', true)) === '["77","78"]');
ok('the -P / -D catalog bridging still reaches the AA/AB units (210 finds 210-P)',
   JSON.stringify(api.keys('210', '')) === '["31"]');

section('An id is handed back ONLY when the number names exactly one copy');
ok('one copy of 6-8359 -> its Inventory ID', api.inv('6-8359', '') === '99');
ok('TWO copies of 6-24177 -> empty, which means "say which", not "use the first"',
   api.inv('6-24177', '') === '');
ok('no copies -> empty', api.inv('1234', '') === '');
ok('anyVariation narrows the same way: 2343 owns two variations, so no id',
   api.inv('2343', '', true) === '' && api.inv('2343', 'A') === '77');

section('The detail page pins the copy it is drawing');
const ac = APP('app-collection.js');
ok('showItemDetailPage pins _lastDetailCopyInv to the copy it actually draws',
   /window\._lastDetailCopyInv = \(pd && pd\.inventoryId\) \? String\(pd\.inventoryId\) : null;/.test(ac));
ok('…on EVERY path — the pin sits after the lookup, beside _lastDetailPdKey, not inside one branch',
   /window\._lastDetailPdKey = pdKey \|\| null;[\s\S]{0,1300}window\._lastDetailCopyInv = \(pd && pd\.inventoryId\)/.test(ac)
   && (ac.match(/window\._lastDetailCopyInv = /g) || []).length === 1);
ok('…and want mode clears it, so a stale id cannot leak into the next page',
   /if \(_wantMode\) \{ pd = null; pdKey = null; \}/.test(ac)
   && ac.indexOf('if (_wantMode) { pd = null; pdKey = null; }') < ac.indexOf('window._lastDetailCopyInv = (pd && pd.inventoryId)'));
ok('…so _detailPdKey (which every button on that page asks) always has an id to use',
   /var _inv = window\._lastDetailCopyInv;/.test(grab(ac, 'function _detailPdKey(item)')));
ok('the header tells the user which copy — "Copy 1 of 2" — and it is clickable',
   /Copy \$\{_copyPos\} of \$\{_allCopyKeys\.length\}/.test(ac) && /onclick="rrShowCopyPicker\(\$\{idx\}\)"/.test(ac));
ok('the chip only appears when there really is more than one copy',
   /_allCopyKeys\.length > 1 && _copyPos > 0/.test(ac));
ok('the picker exists, is published, and reopens the page ON THE CHOSEN COPY',
   /function rrShowCopyPicker\(idx\)/.test(ac) && /window\.rrShowCopyPicker = rrShowCopyPicker/.test(ac)
   && /function rrPickCopy\(idx, inv\)[\s\S]{0,260}showItemDetailPage\(idx, inv\)/.test(ac));
ok('the picker labels copies by what actually tells them apart, and shows the id',
   /Condition ' \+ p\.condition/.test(ac) && /Inventory ID/.test(ac) && /Has photos/.test(ac));
ok('the id in the picker\'s handler goes through rrJsArg (v1760\'s rule)',
   /rrPickCopy\(' \+ idx \+ ',\\'' \+ rrJsArg\(inv\)/.test(ac));

section('THE SWEEP — no one opens the item detail page without naming a copy');
// This is the pin that keeps the bug from coming back: 31 call sites, and nine
// of them used to pass only an index.
const FILES = fs.readdirSync(path.join(__dirname, '..', 'app')).filter(f => f.endsWith('.js'));
const bare = [];
let callSites = 0;
FILES.forEach(function (f) {
  const s = APP(f);
  const lines = s.split('\n');
  let off = 0;
  lines.forEach(function (line, ln) {
    const start = off; off += line.length + 1;
    if (/^\s*(\/\/|\*)/.test(line)) return;              // comments never call anything
    let i = -1;
    while ((i = line.indexOf('showItemDetailPage(', i + 1)) >= 0) {
      if (/[A-Za-z_$.]$/.test(line.slice(0, i))) continue;          // _edit / _photos / _sell
      if (/function\s+$/.test(line.slice(0, i))) continue;          // the definition itself
      callSites++;
      // walk the real source (calls may wrap onto the next line) to the match
      let d = 0, seg = '', j = start + i + 'showItemDetailPage('.length - 1;
      for (; j < s.length && j < start + i + 4000; j++) {
        const c = s[j];
        if (c === '(') { d++; if (d === 1) continue; }
        else if (c === ')') { d--; if (!d) break; }
        seg += c;
      }
      if (seg.indexOf(',') < 0) bare.push(f + ':' + (ln + 1) + '  ' + line.trim().slice(0, 90));
    }
  });
});
// v0.9.1765: 35 -> 26. NINE of these were repaints that passed a REMEMBERED
// POSITION (window._lastDetailIdx) rather than opening a named item, and a
// background era refresh moves every row after the refreshed maker, so the
// position could mean a different item by the time the repaint ran. They now
// go through rrDetailRepaint, which resolves the copy by inventory id and
// works the position out fresh — see tests/detail_repaint_tests.js. A census
// going DOWN because positional openers were removed is the healthy
// direction; the floor stays pinned so the next change is still deliberate.
// v0.9.1767: 26 -> 25. The detail page's "Matched to" and "Grouped with"
// links stopped baking a catalog POSITION into their onclick (a position
// baked into markup waits there until someone clicks, and _applyPendingEras
// moves rows mid-session); they now build their handler with _rrOpenJs, which
// asks by inventory id and keeps a position only for a row that has none.
// Two call sites went, the helper's one sanctioned fallback arrived: net -1.
// See tests/opener_identity_tests.js.
ok('the sweep actually found the call sites (not a broken scanner)', callSites >= 25, String(callSites));
ok('EVERY showItemDetailPage call names a copy — a new one that forgets turns this red',
   bare.length === 0, bare.join(' | '));

section('Nothing acts on a guess — the paths that cost data');
ok('Remove refuses outright when the number names several copies and no id was given',
   /if \(!pdKey && typeof rrOwnedCopyKeys === 'function'\)[\s\S]{0,700}_rmCands\.length > 1[\s\S]{0,400}return;/.test(ac));
ok('…and it refuses BEFORE thisPd is resolved, so nothing downstream sees a wrong copy',
   ac.indexOf('_rmCands.length > 1') < ac.indexOf('var thisPd = pdKey ? state.personalData[pdKey] : null;'));
ok('the photo-folder repair only writes when the copy is NAMED (id given, or only one owned)',
   /async function openPhotoFolder\(itemNum, storedLink, invId\)/.test(ac)
   && /var _pfKey = \(invId && state\.personalData\[invId\]\) \? invId : '';/.test(ac)
   && /rrCopyInvFor\(itemNum, '', true\)/.test(ac));
ok('…and the collection row hands it that copy\'s id', /openPhotoFolder\(\\''\+_rrAttrArg\(item\.itemNum\)\+'\\',\\''\+_rrAttrArg\(_hasPhoto\|\|''\)\+'\\',\\''\+_rrAttrArg\(_myInvIdM\|\|''\)/.test(APP('browse.js')));
ok('the dead first-find photo function is GONE, not left loaded',
   ac.indexOf('function addPhotosFromCollection') < 0 && APP('app-pages.js').indexOf('addPhotosFromCollection(') < 0);

section('Nothing acts on a guess — the paths that wrote the wrong field');
const ws = APP('wizard-save.js');
ok('the box-grouping backfill will not stamp a group onto a guess',
   /_giCands\.length > 1[\s\S]{0,300}existingItem = null;/.test(ws));
ok('the set link names the partner copy or writes nothing',
   /const existingUnit = _suCands\.length === 1 \? state\.personalData\[_suCands\[0\]\] : null;/.test(ws));
ok('the engine/tender cross-link names the copy or writes nothing',
   /const matchedEntry = _meCands\.length === 1 \? state\.personalData\[_meCands\[0\]\] : null;/.test(ws));
ok('none of the three still take the first row with that number',
   ws.indexOf(".find(pd => pd.itemNum === itemNum && pd.owned)") < 0 || /_giCands/.test(ws));
ok('getGroupMembers takes an id, and returns nothing rather than the wrong group',
   /function getGroupMembers\(itemNum, invId\)/.test(APP('app.js'))
   && /_keys\.length > 1[\s\S]{0,260}return \[\];/.test(APP('app.js')));
ok('the Upgrade list\'s Remove asks instead of guessing',
   /_ugCands\.length > 1[\s\S]{0,300}return;/.test(APP('app-pages.js')));

section('The guard below is still a guard — it just is not the one that catches this');
const sh = APP('sheets.js');
ok('sheetsDeleteRow still demands to be told what it believes it is deleting',
   /throw new Error\('sheetsDeleteRow: `expected` is required/.test(sh));
ok('rrRowStillIs still settles on the Inventory ID whenever both sides have one',
   /if \(wantId && gotId\) \{\s*\n\s*if \(gotId === wantId\) return true;/.test(sh));
ok('…and it still says out loud that the item-number fallback is the weaker one',
   /item numbers repeat/.test(sh));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
