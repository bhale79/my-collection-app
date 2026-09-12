// ═══════════════════════════════════════════════════════════════
// companion_link_tests.js — v0.9.1723.
//
// Brad, 2026-09-12: "so the companion checker is not see the 665 engine in my
// collection to match it with the 2046w. but if i add a new 2046w tender it
// wants to add it to the 665."
//
// He was watching one app disagree with itself. The Companion Suggester read
// the Companions tab ALONE — 160 rows, which list seven engines for the 2046W
// and not the 665 — so it announced seven missing engines while the 665 sat in
// his collection, unlinked, two rows away. The Add wizard reads
// state.partnerMap, built from Companions AND Sets AND the master, which knows
// twelve engines for the 2046W including the 665, so it offered the link.
//
// The ownership question now goes to the partner map too, and an owned-but-
// unlinked partner turns seven wrong lines into one offer with a button.
//
// The pins that matter most here are the NEGATIVE ones. Widening what counts
// as "you already have one" is exactly the kind of change that goes too far
// and silences real gaps, so most of this file is about the tool still
// speaking up when it should.
//
// The REAL runCompanionSuggester runs here, end to end, over Brad's exact
// collection.
//
// Run:  node tests/companion_link_tests.js
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  -> ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

const TOOLS = fs.readFileSync(path.join(__dirname, '..', 'app', 'tools.js'), 'utf8');

// ── Brad's actual data, as read out of his live app on 2026-09-12 ──────────
const MASTERS = [
  { itemNum: '2046W', variation: '1', itemType: 'Tender', description: 'Large Streamlined Tender', roadName: 'Lionel Lines' },
  { itemNum: '665',   variation: '1', itemType: 'Steam',  description: '4-6-4 Steam Locomotive',   roadName: '' },
  { itemNum: '637',   variation: '1', itemType: 'Steam',  description: '2-6-4',                    roadName: '' },
  { itemNum: '675',   variation: '1', itemType: 'Steam',  description: '2-6-2 Pacific',            roadName: '' },
  { itemNum: '736',   variation: '1', itemType: 'Steam',  description: '2-8-4 Steam Locomotive',   roadName: '' },
  { itemNum: '2026',  variation: '1', itemType: 'Steam',  description: '2-6-2 Steam Locomotive',   roadName: '' },
  { itemNum: '6466WX',variation: '1', itemType: 'Tender', description: 'Whistle Tender',           roadName: '' },
];
// The Companions tab: seven engines for the 2046W, and NOT the 665. This gap
// is the bug, reproduced exactly.
const COMPANIONS = [
  { engineNum: '637',  companionNum: '2046W', companionType: 'Tender' },
  { engineNum: '675',  companionNum: '2046W', companionType: 'Tender' },
  { engineNum: '736',  companionNum: '2046W', companionType: 'Tender' },
  { engineNum: '2026', companionNum: '6466WX', companionType: 'Tender' },
];
// The partner map: wider, and it does know the 665.
const PARTNERS = {
  '2046W': { locos: ['637', '675', '736', '665'], tenders: [] },
  '665':   { locos: [], tenders: ['2046W', '6026W'] },
  '2026':  { locos: [], tenders: ['6466WX'] },
  '6466WX':{ locos: ['2026'], tenders: [] },
};

function mkEnv(personal, opts) {
  opts = opts || {};
  const out = { innerHTML: '' };
  const writes = [];
  const toasts = [];
  const env = {
    window: {},
    document: { getElementById: (id) => (id === 'companion-suggester-results' ? out : null) },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    showToast: (m) => toasts.push(String(m)),
    rrEsc: (s) => String(s == null ? '' : s),
    isTender: (n) => /W$/.test(String(n)) || /WX$/.test(String(n)),
    findMaster: (n, v) => MASTERS.find((m) => m.itemNum === String(n) && (!v || m.variation === String(v))) || null,
    sheetsGet: async () => ({ values: [] }),
    sheetsUpdate: async (sheet, range, vals) => { writes.push({ range, value: vals[0][0] }); },
    parseCompanionRows: () => {},
    SHEET_TABS: { companions: 'Lionel PW - Companions' },
    PERSONAL_TAB: 'My Collection',
    personalColLetter: (f) => (f === 'groupId' ? 'AB' : 'A'),
    getMatchingLocos:   (n) => (opts.noPartnerMap ? [] : ((PARTNERS[String(n)] || {}).locos   || [])),
    getMatchingTenders: (n) => (opts.noPartnerMap ? [] : ((PARTNERS[String(n)] || {}).tenders || [])),
    getSetPartner:      () => null,
    state: {
      companionData: COMPANIONS.slice(),
      masterData: MASTERS.slice(),
      personalData: personal,
      wantData: {},
      masterSheetId: 'x',
      personalSheetId: 'y',
    },
  };
  env.window.state = env.state;
  const f0 = TOOLS.indexOf('async function runCompanionSuggester()');
  const f1 = TOOLS.indexOf('async function companionAddToWantList');
  const names = ['window', 'document', 'localStorage', 'showToast', 'rrEsc', 'isTender', 'findMaster',
    'sheetsGet', 'sheetsUpdate', 'parseCompanionRows', 'SHEET_TABS', 'PERSONAL_TAB', 'personalColLetter',
    'getMatchingLocos', 'getMatchingTenders', 'getSetPartner', 'state'];
  const made = new Function(...names,
    TOOLS.slice(f0, f1) + ' return { run: runCompanionSuggester, link: companionLinkItems };'
  )(...names.map((n) => env[n]));
  return {
    env, out, writes, toasts,
    run: () => made.run().then(() => out.innerHTML),
    link: made.link,
  };
}

(async function () {

// ── Brad's collection, exactly as it stands ───────────────────────────────
section("Brad's 2046W and his 665");
{
  const h = mkEnv({
    t: { inventoryId: '312', owned: true, itemNum: '2046W', variation: '1', row: 312, condition: '7' },
    e: { inventoryId: '311', owned: true, itemNum: '665',   variation: '1', row: 311, condition: '7' },
  });
  const html = await h.run();
  ok('the tool finally SEES the 665 he owns', /you already have the/.test(html) && /665/.test(html));
  ok('and offers the link the wizard would have offered', /Link them/.test(html) && /companionLinkItems\(/.test(html));
  ok('the seven engines he does not own are GONE', !/normally goes with the/.test(html), html.match(/normally goes with the/g) ? 'still nagging' : '');
  ['637', '675', '736'].forEach(n =>
    ok('  no longer claims the ' + n + ' is missing', !new RegExp('>' + n + '<').test(html)));
  ok('the header still names the owned copy', /You have a <strong>2046W<\/strong>/.test(html));
  ok('the offer says why it is showing — they are not linked', /they are just not linked/.test(html));
  ok("the 665's description rides along so he knows which engine",
     /4-6-4 Steam Locomotive/.test(html) && /condition 7/.test(html));
}

// ── the negatives: it must still speak up ─────────────────────────────────
section('It still reports a REAL gap');
{
  const h = mkEnv({
    t: { inventoryId: '312', owned: true, itemNum: '2046W', variation: '1', row: 312 },
  });
  const html = await h.run();
  ok('own the tender and NO engine at all — the seven gaps are still reported',
     /normally goes with the/.test(html) && /637/.test(html) && /675/.test(html) && /736/.test(html));
  ok('and no link is offered, because there is nothing to link to', !/Link them/.test(html));
}
{
  const h = mkEnv({
    d: { inventoryId: 'd', owned: true, itemNum: '2026',  variation: '1', row: 10 },
  });
  const html = await h.run();
  ok('an untouched pairing elsewhere is unaffected — the 2026 still wants its 6466WX',
     /You have a <strong>2026<\/strong>/.test(html) && /6466WX/.test(html) && /don/.test(html));
}
{
  // The mate is real but already spoken for. Linking it here would tear it out
  // of the group it is in, so it must not even be offered.
  const h = mkEnv({
    t: { inventoryId: '312', owned: true, itemNum: '2046W', variation: '1', row: 312 },
    e: { inventoryId: '311', owned: true, itemNum: '665',   variation: '1', row: 311, groupId: 'GRP-OTHER' },
    x: { inventoryId: 'x',   owned: true, itemNum: '2426W', variation: '1', row: 9,   groupId: 'GRP-OTHER' },
  });
  const html = await h.run();
  ok('a 665 already grouped with something else is NOT offered', !/Link them/.test(html));
  ok('…and the gaps are reported honestly instead', /normally goes with the/.test(html));
}
{
  // A tender is not an engine. The role test has to hold or the tool would
  // "satisfy" an engine gap with another tender.
  const h = mkEnv({
    t:  { inventoryId: '312', owned: true, itemNum: '2046W', variation: '1', row: 312 },
    t2: { inventoryId: '313', owned: true, itemNum: '6026W', variation: '1', row: 313 },
  });
  const html = await h.run();
  ok('a second TENDER never counts as the missing engine', !/Link them/.test(html));
}
{
  // Already linked: v0.9.1314's rule still wins — a settled pair says nothing
  // at all, not even an offer.
  const h = mkEnv({
    t: { inventoryId: '312', owned: true, itemNum: '2046W', variation: '1', row: 312, groupId: 'GRP-DONE' },
    e: { inventoryId: '311', owned: true, itemNum: '665',   variation: '1', row: 311, groupId: 'GRP-DONE' },
  });
  const html = await h.run();
  ok('an ALREADY linked pair stays completely silent', !/Link them/.test(html) && !/2046W/.test(html));
}
{
  // The safety net: if the partner map is not loaded, nothing may crash and the
  // tool must simply behave as it did before this change.
  const h = mkEnv({
    t: { inventoryId: '312', owned: true, itemNum: '2046W', variation: '1', row: 312 },
    e: { inventoryId: '311', owned: true, itemNum: '665',   variation: '1', row: 311 },
  }, { noPartnerMap: true });
  const html = await h.run();
  ok('no partner map -> old behaviour, no crash', /normally goes with the/.test(html) && !/Link them/.test(html));
}

// ── the Link button actually writes ───────────────────────────────────────
section('Link them');
{
  const h = mkEnv({
    t: { inventoryId: '312', owned: true, itemNum: '2046W', variation: '1', row: 312, condition: '7' },
    e: { inventoryId: '311', owned: true, itemNum: '665',   variation: '1', row: 311, condition: '7' },
  });
  await h.run();
  const items = h.env.window._companionEngines;
  ok('the rendered offer is reachable from the button handler',
     Array.isArray(items) && items.length === 1 && items[0].linkOffers && items[0].linkOffers.length === 1);
  h.env.document.getElementById = () => null;   // the button is not in this DOM
  await h.link(0, 0);
  ok('BOTH rows are written, not just one', h.writes.length === 2, JSON.stringify(h.writes.map(w => w.range)));
  ok('it writes the groupId COLUMN via personalColLetter, never a hardcoded one',
     h.writes.every(w => /^My Collection!AB\d+:AB\d+$/.test(w.range)), JSON.stringify(h.writes.map(w => w.range)));
  ok('the two rows get the SAME group id', h.writes[0].value === h.writes[1].value, h.writes[0].value);
  ok('the id follows the GRP- shape the rest of the app reads',
     /^GRP-2046W-\d+$/.test(h.writes[0].value), h.writes[0].value);
  ok('in-memory state is updated too, so the view agrees without a reload',
     h.env.state.personalData.t.groupId === h.writes[0].value &&
     h.env.state.personalData.e.groupId === h.writes[0].value);
  ok('it tells him what happened', h.toasts.some(t => /Linked/.test(t) && /2046W/.test(t) && /665/.test(t)), h.toasts.join(' | '));
}
{
  // A row with no sheet row of its own must not send a bogus range.
  const h = mkEnv({
    t: { inventoryId: '312', owned: true, itemNum: '2046W', variation: '1', row: 312 },
    e: { inventoryId: '311', owned: true, itemNum: '665',   variation: '1', row: 99999 },
  });
  await h.run();
  h.env.document.getElementById = () => null;
  await h.link(0, 0);
  ok('the placeholder row 99999 is skipped, not written', h.writes.length === 1 && /AB312/.test(h.writes[0].range));
}

// ── wiring pins ───────────────────────────────────────────────────────────
section('Wiring');
ok('the ownership question goes to the PARTNER MAP, not the Companions tab alone',
   /function _ccPartnerNums/.test(TOOLS) && /getMatchingLocos\(anchorNum\)/.test(TOOLS) && /getMatchingTenders\(anchorNum\)/.test(TOOLS));
ok('suggestions are still generated from the Companions tab — this can only go quieter',
   /state\.companionData\.forEach\(function\(c\) \{\s*\n\s*\/\/ Forward/.test(TOOLS));
ok('every partner-map call is guarded, so a missing helper cannot break the tool',
   (TOOLS.match(/try \{ \(getMatching(Locos|Tenders)\(anchorNum\)/g) || []).length === 2);
ok('the mate must fill the ROLE and be unlinked',
   /if \(!_ccFillsRole\(p, role\)\) return;/.test(TOOLS) && /if \(_ccItemGrouped\(p\)\) return;/.test(TOOLS));
ok('an anchor whose only outcome is a link offer survives the render filter',
   /e\.suggestions\.length > 0 \|\| \(e\.linkOffers && e\.linkOffers\.length > 0\)/.test(TOOLS));
ok('the link writer reuses the Smart Group Finder\'s column helper',
   /personalColLetter\('groupId'\)/.test(TOOLS.slice(TOOLS.indexOf('async function companionLinkItems'))));
ok('a double press cannot write two group ids', /_ccLinking/.test(TOOLS));
// tools.js sits exactly on its hardcoded-colour budget; the new markup had to
// be tokens only. If someone pastes a hex in here the ratchet fails, but this
// says WHY out loud so the next reader does not have to find out the hard way.
{
  const block = TOOLS.slice(TOOLS.indexOf('(e.linkOffers || []).forEach'), TOOLS.indexOf('// Deduplicate suggestions by companion number'));
  ok('the new link row uses colour TOKENS only — tools.js has no budget left',
     !/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(block) && /var\(--green\)/.test(block));
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

})();
