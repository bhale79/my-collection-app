// ══ tests/want_partner_prompt_tests.js ═════════════════════════════════════
//
// v0.9.1740 (Brad, 2026-09-13): "so i added an engine from the companion
// checker. it said this engine matches the tender you have in your
// collection. i added the engine and got this screen [Add partner(s) to Want
// List? — five tenders, all ticked]. We need this screen if we add an engine
// with no tender by itself, but if we add the engine to match a tender we
// already have, we don't need this screen."
//
// _checkWantPartners asked only the WANT LIST whether a partner was spoken
// for. It never asked the collection, so the tender he already owns came back
// as something to go and find. Rule now: if ANY partner of the number being
// wanted is already owned, the pair is complete and the prompt never opens.
//
// The real function is lifted out of app-collection.js and run against a
// stub state and a stub DOM that records whether a pop-up was built.
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-collection.js'), 'utf8');
function grab(name) {
  const i = SRC.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0, j = SRC.indexOf('{', i);
  for (let k = j; k < SRC.length; k++) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); }
  }
  return '';
}
const fnSrc = grab('_checkWantPartners');
ok('the function is found in the source', fnSrc.length > 500, String(fnSrc.length));

// ── the world the function reads ─────────────────────────────────────────
const partnerMap = {
  '2026':  { tenders: ['2466W', '2466WX', '6466WX', '2046W', '2466T'], locos: [] },
  '2466W': { tenders: [], locos: ['2026', '2035', '675'] },
  '2343':  { tenders: [], locos: [], bUnit: '2343C' },
  '2343C': { tenders: [], locos: [], aUnit: '2343' },
};
const world = {
  state: { personalData: {}, wantData: {}, personalSheetId: 'x' },
  normalizeItemNum: (n) => String(n || '').trim(),
  _stripSuffix: (n) => String(n || '').trim().replace(/-(P|D)$/i, ''),
  isLocomotive: (n) => { const p = partnerMap[String(n).replace(/-(P|D)$/i, '')]; return !!(p && p.tenders.length); },
  isTender:     (n) => { const p = partnerMap[String(n).replace(/-(P|D)$/i, '')]; return !!(p && p.locos.length); },
  getMatchingTenders: (n) => { const p = partnerMap[String(n).replace(/-(P|D)$/i, '')]; return p ? p.tenders : []; },
  getMatchingLocos:   (n) => { const p = partnerMap[String(n).replace(/-(P|D)$/i, '')]; return p ? p.locos : []; },
  getBUnit: (n) => { const p = partnerMap[String(n).replace(/-(P|D)$/i, '')]; return (p && p.bUnit) || null; },
  getAUnit: (n) => { const p = partnerMap[String(n).replace(/-(P|D)$/i, '')]; return (p && p.aUnit) || null; },
  built: [],
  document: null,
  window: {},
};
world.document = {
  createElement() {
    const el = { style: {}, _html: '', kids: [],
      set innerHTML(v) { this._html = v; world.built.push(v); }, get innerHTML() { return this._html; },
      querySelector() { return { onclick: null }; }, remove() {} };
    return el;
  },
  body: { appendChild() {} },
};
const check = new Function(...Object.keys(world), fnSrc + '\nreturn _checkWantPartners;')(...Object.values(world));

function own(...nums) { world.state.personalData = {}; nums.forEach((n, i) => { world.state.personalData['inv' + i] = { owned: true, itemNum: n, variation: '' }; }); }
function want(...nums) { world.state.wantData = {}; nums.forEach(n => { world.state.wantData[n + '|'] = { itemNum: n }; }); }
function run(num) { world.built.length = 0; check(num, '', 'Medium', '', ''); return world.built.length ? world.built[world.built.length - 1] : ''; }
function listed(html) { return (html.match(/font-weight:600;color:var\(--accent\)">([^<]+)</g) || []).map(m => m.replace(/.*">/, '').replace('<', '')); }

// ── BRAD'S CASE: engine added to match a tender he owns ──────────────────
console.log('\n== The engine is being wanted BECAUSE of a tender already owned ==');
own('2466W'); want();
ok('owning 2466W: adding the 2026 to the Want List shows NO partner screen', run('2026') === '', 'a pop-up was built');
own('2466T'); want();
ok('owning the 2466T (any one of the five) is enough — no screen', run('2026') === '');
own('6466WX', '2343-C'); want();
ok('…and it does not matter which of the five it is', run('2026') === '');

// ── the screen still appears for a lone engine ───────────────────────────
console.log('\n== A lone engine still gets asked ==');
own('675'); want();
let html = run('2026');
ok('owning no partner at all: the prompt opens', html.length > 0, 'nothing built');
ok('…and offers all five tenders', listed(html).join(',') === '2466W,2466WX,6466WX,2046W,2466T', listed(html).join(','));
ok('…with the locomotive wording', /This locomotive has matching tenders/.test(html));
own(); want('2046W');
html = run('2026');
ok('a tender already on the WANT LIST is still left off the list (unchanged)', listed(html).join(',') === '2466W,2466WX,6466WX,2466T', listed(html).join(','));
own(); want('2466W', '2466WX', '6466WX', '2046W', '2466T');
ok('every tender already wanted: nothing to offer, no screen (unchanged)', run('2026') === '');

// ── the other directions ─────────────────────────────────────────────────
console.log('\n== Tender → engines, A unit ↔ B unit ==');
own('2035'); want();
ok('a tender whose engine is owned: no screen', run('2466W') === '');
own(); want();
html = run('2466W');
ok('a tender with no engine owned: asks, listing the engines', /This tender fits these locomotives/.test(html) && listed(html).length === 3, listed(html).join(','));
own('2343-C'); want();
ok('A unit: owning the B unit as 2343-C (app spelling) satisfies the catalog 2343C — no screen', run('2343') === '');
own('2343C'); want();
ok('…and as 2343C (catalog spelling) too', run('2343') === '');
own(); want();
ok('A unit with no B unit owned: asks', /also want the B unit/.test(run('2343')));
own('2343-P'); want();
ok('B unit: owning the A unit as 2343-P satisfies the bare 2343 anchor — no screen', run('2343C') === '');
own('2343'); want();
ok('…and as plain 2343 too', run('2343C') === '');

// ── spelling rules: what must NOT count as owning the partner ────────────
console.log('\n== A near miss is not ownership ==');
own('2466'); want();
html = run('2026');
ok('owning a 2466 ENGINE is not owning the 2466T tender — the prompt opens', html.length > 0 && listed(html).indexOf('2466T') >= 0, listed(html).join(','));
own('2466W'); want();
world.state.personalData.inv0.owned = false;
ok('a SOLD copy (owned:false) does not count', run('2026').length > 0, 'the sold copy silenced the prompt');
own('2466w'); want();
ok('case does not matter (2466w = 2466W)', run('2026') === '');

// ── source pins, so the rule cannot quietly move ─────────────────────────
console.log('\n== Source pins ==');
ok('the owned check runs on EVERY partner, not just the un-wanted ones',
   /if \(partners\.some\(_wpOwned\)\) return;/.test(fnSrc) && fnSrc.indexOf('partners.some(_wpOwned)') < fnSrc.indexOf("if (!candidates.length) return;"));
ok('ownership is read from personalData with the owned flag', /if \(!pd \|\| !pd\.owned \|\| !pd\.itemNum\) return;/.test(fnSrc));
ok('a bare anchor is owned as plain OR powered, never as a dummy/B/tender form', /_wpOwnedPoweredBases\.has\(c\.key\)/.test(fnSrc) && /if \(c\.unit\) return _wpOwnedKeys\.has\(c\.key\);/.test(fnSrc));
ok('the canon maps T to D and drops the dash before a unit letter', /m\[2\] === 'T' \? 'D' : m\[2\]/.test(fnSrc) && /-\?\(\[PDTC\]\)\$/.test(fnSrc));

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
