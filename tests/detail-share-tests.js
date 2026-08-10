// ── v0.9.1420 — Share from the item detail page (Brad) ────────────────────
//
// "need to add the share button on the detail item page."
//
// One share system, two doors — the same rule the Help menu follows. The
// detail page's Share must funnel into the SAME builder, PDF, image-card and
// Gmail machinery the list route uses, differing only in how the item lands
// in _shareItems. A second share pipeline that could drift was the failure
// mode to avoid, so most of these assertions are about sameness.

const fs   = require('fs');
const path = require('path');

const APP = n => path.join(__dirname, '..', 'app', n);
const SHARE = fs.readFileSync(APP('share.js'), 'utf8');
const COLL  = fs.readFileSync(APP('app-collection.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ══ 1. The function, run for real ══════════════════════════════════════════
section('shareSingleItem — a single item lands where the builder looks');

const fnSrc = (() => {
  const a = SHARE.indexOf('function shareSingleItem(idx, invId)');
  const b = SHARE.indexOf("if (typeof window !== 'undefined') { window.shareSingleItem");
  if (a < 0 || b < 0) throw new Error('shareSingleItem not found');
  return SHARE.slice(a, b);
})();

function run(opts) {
  const calls = { opened: 0, toasts: [] };
  const sandbox = new Function('state', 'findPDKey', `
    var _shareMode = true, _shareSource = 'forsale';
    var _shareItems = { stale: { itemNum: 'OLD' } };
    var window = { _shareDataMap: {} };
    var opened = 0, toasts = [];
    function showToast(m) { toasts.push(m); }
    function openShareBuilder() { opened++; }
    ${fnSrc}
    shareSingleItem(${opts.idx}, ${JSON.stringify(opts.invId)});
    return { mode: _shareMode, source: _shareSource, items: _shareItems,
             map: window._shareDataMap, opened: opened, toasts: toasts };
  `);
  return sandbox(opts.state, opts.findPDKey || (() => null));
}

const master = { itemNum: '773', variation: '1', roadName: 'New York Central', description: '4-6-4 Hudson' };
const state = {
  masterData: [master],
  // personalData keyed the OLD way (triplet) but carrying the stable id —
  // the exact mid-migration shape the app is in.
  personalData: { '773|1|42': { itemNum: '773', variation: '1', inventoryId: 'inv-99', photoItem: 'folder1' } },
};

const r = run({ idx: 0, invId: 'inv-99', state });
ok('exactly ONE item is staged — the stale selection is thrown out',
   Object.keys(r.items).length === 1, JSON.stringify(Object.keys(r.items)));
const staged = Object.values(r.items)[0];
ok('the staged shape is the SAME one the list renderers build',
   staged && staged.itemNum === '773' && staged.variation === '1' && staged.master === master,
   JSON.stringify(staged && Object.keys(staged)));
ok('the copy is found by inventoryId VALUE, surviving the key migration',
   staged && staged.pd && staged.pd.inventoryId === 'inv-99');
ok('the builder opens', r.opened === 1);
ok('share mode stays OFF — no checkboxes, no bottom bar', r.mode === false);
ok('the source is collection, so the collector skin paints it', r.source === 'collection');

// findPDKey fallback when no inventoryId is passed.
const r2 = run({ idx: 0, invId: '', state,
  findPDKey: (n, v) => (n === '773' && v === '1') ? '773|1|42' : null });
ok('without an inventoryId, findPDKey still locates the owned copy',
   Object.values(r2.items)[0].pd.inventoryId === 'inv-99');

// A bad index must not open an empty builder.
const r3 = run({ idx: 7, invId: '', state });
ok('a missing master row says so and never opens the builder',
   r3.opened === 0 && r3.toasts.length === 1, JSON.stringify(r3.toasts));

// ══ 2. One system, not two ═════════════════════════════════════════════════
section('Sameness — the detail door uses the list route’s machinery');

ok('shareSingleItem calls the SAME openShareBuilder', /openShareBuilder\(\);\n\}/.test(fnSrc));
ok('no second builder appeared',
   (SHARE.match(/function openShareBuilder/g) || []).length === 1);
ok('no second PDF/image path appeared',
   (SHARE.match(/function _doShare/g) || []).length === 1);
ok('the generate paths read only what shareSingleItem sets (_shareItems, _shareSource)',
   /var items\s+= Object\.values\(_shareItems\);/.test(SHARE));

// ══ 3. The button on the detail page ═══════════════════════════════════════
section('The Share button');

const btn = (() => {
  const a = COLL.indexOf('id="detail-share-item"');
  return a < 0 ? '' : COLL.slice(a - 60, a + 700);
})();
ok('the owned-item detail page has the Share button', !!btn);
ok('it passes the master index AND the on-screen copy’s inventoryId',
   /shareSingleItem\(\$\{idx\},'\$\{pd && pd\.inventoryId \? pd\.inventoryId : ''\}'\)/.test(btn));
ok('it wears the collection list’s green share identity (same icon, same green)',
   /#2ecc71/.test(btn) && /polyline points="16 6 12 2 8 6"/.test(btn));
ok('it sits BEFORE Remove from Collection — destructive stays last',
   COLL.indexOf('id="detail-share-item"') < COLL.indexOf('id="detail-remove-item"',
     COLL.indexOf('id="detail-share-item"')));
ok('it explains itself like its neighbours (data-ctip)', /data-ctip="Share this item/.test(btn));
// The want-mode branch (item not owned) must NOT offer Share — there is no
// copy, no photos and no condition to share.
const wantBranch = COLL.slice(COLL.indexOf('detail-add-collection'), COLL.indexOf('detail-share-item'));
ok('the not-owned (want) branch does not offer Share',
   !/shareSingleItem/.test(wantBranch));

console.log('\n' + (fail ? 'FAILED' : 'OK') + '  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
