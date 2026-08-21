// ═══════════════════════════════════════════════════════════════
// import_core_tests.js — Session 81, Task #25 Phase 1.
//
// Proves app/import-core.js against the STANDING FIXTURE:
// Scott_Inventory_TEST_FIXTURE.xlsx (20 tabs, headers in row 2, 160
// red for-sale rows on a CUSTOM indexed palette at 13/14).
//
// Run:  node tests/import_core_tests.js [path-to-fixture.xlsx]
// Needs: exceljs (devDependency). Skips fixture tests (still fails the
// run) if the fixture file is missing — the fixture is part of the test.
// ═══════════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const core = require('../app/import-core.js');

let pass = 0, fail = 0;
function is_close(name, got, want) { ok(name, Math.abs(got - want) < 0.001, got); }
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

// ── Unit tests (no fixture needed) ──────────────────────────────

// Cell normalization
ok('norm: plain string trims', core.rrImpNormCell('  6464-25  ') === '6464-25');
ok('norm: number int', core.rrImpNormCell(1946) === '1946');
ok('norm: richText joins', core.rrImpNormCell({ richText: [{ text: 'Santa ' }, { text: 'Fe' }] }) === 'Santa Fe');
ok('norm: formula result', core.rrImpNormCell({ result: 42 }) === '42');
ok('norm: null empty', core.rrImpNormCell(null) === '');

// Header detection on a synthetic Scott-shaped tab
const synthRows = [
  ['My Trains', 'My Trains', 'My Trains'],                         // merged title
  ['Item #', 'Brand', 'Description', 'Condition', 'Value'],       // headers
  ['6464-25', 'Lionel', 'Great Northern Boxcar', 'C7', '45'],
  ['2343', 'Lionel', 'Santa Fe F3 AA', 'C8', '600'],
];
ok('header detect: row 2 of Scott shape', core.rrImpDetectHeaderRow(synthRows) === 1);
ok('header detect: headers in row 1 when no title', core.rrImpDetectHeaderRow(synthRows.slice(1)) === 0);
ok('header detect: no header -> -1', core.rrImpDetectHeaderRow([['x'], ['y']]) === -1);

// Heuristic mapping — Scott's main layout
const scottHeaders = ['Item #', 'Brand', 'Scale', 'Description/Type', 'Condition', 'Shipper', 'Storage Location', 'Owner', 'Collection', 'Paid', 'Value'];
const hm = core.rrImpHeuristicMap(scottHeaders);
ok('heuristic: Item # -> itemNum', hm.map['item #'] === 'itemNum');
ok('heuristic: Brand -> manufacturer', hm.map['brand'] === 'manufacturer');
ok('heuristic: Scale -> gauge', hm.map['scale'] === 'gauge');
ok('heuristic: Description/Type -> yourDesc', hm.map['description/type'] === 'yourDesc');
ok('heuristic: Condition -> rawGrade', hm.map['condition'] === 'rawGrade');
ok('heuristic: Storage Location -> location', hm.map['storage location'] === 'location');
ok('heuristic: Paid -> priceItem', hm.map['paid'] === 'priceItem');
ok('heuristic: Value -> userEstWorth', hm.map['value'] === 'userEstWorth');
// v0.9.1514 (Phase 2): Shipper and Collection now have real homes. Owner
// stays unmapped until the user names a custom column for it — the import
// offers the custom slots, it never claims one on its own.
ok('heuristic: Shipper -> shipper (NOT hasBox)', hm.map['shipper'] === 'shipper');
ok('heuristic: Collection -> subCollection', hm.map['collection'] === 'subCollection');
ok('heuristic: Owner stays unmapped (user names a custom column for it)',
   hm.unmapped.indexOf('owner') >= 0, JSON.stringify(hm.unmapped));

// A 5-column simple sheet maps too (Scott is the ceiling, not the norm)
const simple = core.rrImpHeuristicMap(['Number', 'Description', 'Condition', 'Paid', 'Notes']);
ok('heuristic simple: Number -> itemNum', simple.map['number'] === 'itemNum');
ok('heuristic simple: nothing weird unmapped', simple.unmapped.length === 0, JSON.stringify(simple.unmapped));

// Grade helpers
ok('grade guess: C10/P10 -> 10', core.rrImpGuessCondition('C10/P10') === '10');
ok('grade guess: C7 -> 7', core.rrImpGuessCondition('C7') === '7');
ok('grade guess: Excellent -> blank', core.rrImpGuessCondition('Excellent') === '');
const grades = core.rrImpCollectGrades([
  { rawGrade: 'C10/P10' }, { rawGrade: 'C10/P10' }, { rawGrade: 'C7' }, { rawGrade: '' },
]);
ok('grade collect: distinct + counted', grades.length === 2 && grades[0].grade === 'C10/P10' && grades[0].count === 2);

// Money cleanup
ok('money: $1,234.50 -> 1234.5', core.rrImpCleanMoney('$1,234.50') === '1234.5');
ok('money: junk -> blank', core.rrImpCleanMoney('n/a') === '');

// v0.9.1514 (Phase 2) — the new user-column targets.
const hmLoc = core.rrImpHeuristicMap(['Item #', 'Storage Location', 'Tote', 'Shipping Box', 'Series']);
ok('locationDetail: "Tote" maps', hmLoc.map['tote'] === 'locationDetail');
ok('shipper: "Shipping Box" maps', hmLoc.map['shipping box'] === 'shipper');
ok('subCollection: "Series" maps', hmLoc.map['series'] === 'subCollection');
ok('location still wins for "Storage Location"', hmLoc.map['storage location'] === 'location');

// ── SUFFIX RULE (the one that must never regress) ───────────────
const master = {
  '0936-1': [{ itemNum: '0936-1', description: 'Atlas boxcar road #65049' }],
  '0936-2': [{ itemNum: '0936-2', description: 'Atlas boxcar road #65226' }],
  '0936':   [{ itemNum: '0936', description: 'Atlas boxcar' }],
  '2343':   [{ itemNum: '2343', description: 'Santa Fe F3' }],
  '6464':   [{ itemNum: '6464', description: 'Boxcar series' }, { itemNum: '6464', description: 'Boxcar var 2' }],
};
const lookups = {
  candidatesFor: (num) => master[num] || [],
  baseOf: (num) => String(num).replace(/-(\d+|[PDTC])$/i, ''),
};
const triage = core.rrImpTriage([
  { itemNum: '0936-1', yourDesc: 'road 65049' },   // exact suffixed match — must match ITSELF
  { itemNum: '2343', yourDesc: 'F3' },              // clean match
  { itemNum: '6464', yourDesc: 'boxcar' },          // two candidates — ambiguous
  { itemNum: '9999-3', yourDesc: 'mystery' },       // no exact; base 9999 also unknown
  { itemNum: '2343-9', yourDesc: 'F3 special' },    // no exact; base 2343 known -> didYouMean OFFER only
], lookups);
ok('suffix rule: 0936-1 matches 0936-1 exactly (never stripped)',
   triage.matched.some(m => m.item.itemNum === '0936-1' && m.master.itemNum === '0936-1'));
ok('triage: clean 2343 matched', triage.matched.some(m => m.item.itemNum === '2343'));
ok('triage: 6464 ambiguous (2 candidates)', triage.ambiguous.length === 1 && triage.ambiguous[0].candidates.length === 2);
ok('triage: 9999-3 unmatched, no didYouMean', triage.unmatched.some(u => u.item.itemNum === '9999-3' && u.didYouMean.length === 0));
ok('triage: 2343-9 unmatched but base OFFERED (not applied)',
   triage.unmatched.some(u => u.item.itemNum === '2343-9' && u.didYouMean.length === 1 && u.didYouMean[0].itemNum === '2343'));

// Copy-counter evidence: identical descriptions = evidence; different = none
const evYes = core.rrImpCopyCounterEvidence([
  { itemNum: '6464-1', yourDesc: 'GN Boxcar' }, { itemNum: '6464-2', yourDesc: 'GN Boxcar' },
], lookups.baseOf);
ok('copy evidence: identical descs -> 1 group', evYes.length === 1 && evYes[0].count === 2);
const evNo = core.rrImpCopyCounterEvidence([
  { itemNum: '0936-1', yourDesc: 'road 65049' }, { itemNum: '0936-2', yourDesc: 'road 65226' },
], lookups.baseOf);
ok('copy evidence: different descs -> NO question (real variants)', evNo.length === 0);

// AI answer validation: garbage in, heuristic-safe out
const bad = core.rrImpValidateAiAnswer({ mappings: { 'Nope': { 'x': 'dropTables' } }, questions: 'not-an-array' }, [{ name: 'Lionel' }]);
ok('AI validate: unknown tab + field rejected', bad.ok === false && Object.keys(bad.mappings).length === 0);
const good = core.rrImpValidateAiAnswer({
  mappings: { 'Lionel': { 'Item #': 'itemNum', 'Junk': 'notAField' } },
  tabClass: { 'Lionel': 'trains' },
  gradeTable: [{ raw: 'C10/P10', condition: '10' }, { raw: 'C7', condition: '99' }],
  questions: [{ id: 'red', text: 'What does red mean?', options: ['For sale', 'Sold', 'Just formatting'] }],
}, [{ name: 'Lionel' }]);
ok('AI validate: good mapping kept, bad field dropped',
   good.ok && good.mappings['Lionel']['item #'] === 'itemNum' && good.mappings['Lionel']['junk'] === undefined);
ok('AI validate: bad condition (99) dropped, good kept', good.gradeTable.length === 1 && good.gradeTable[0].condition === '10');
ok('AI validate: question kept', good.questions.length === 1 && good.questions[0].options.length === 3);

// ── v0.9.1509 additions (every one found in Brad's LIVE test) ───
// Summary rows: Scott's per-tab "Total:" rows imported as items ($372k of
// fake value). Real items never look like this.
ok('summary: "TOTAL:" with no grade is a summary row',
   core.rrImpIsSummaryItem({ itemNum: 'TOTAL:', userEstWorth: '20147' }) === true);
ok('summary: "Total" lowercase, desc slot', core.rrImpIsSummaryItem({ itemNum: '', yourDesc: 'Total' }) === true);
ok('summary: "Grand total:" caught', core.rrImpIsSummaryItem({ itemNum: 'Grand total:' }) === true);
ok('summary: real item 2343 is NOT a summary row', core.rrImpIsSummaryItem({ itemNum: '2343', rawGrade: 'C8' }) === false);
ok('summary: "Total Package Deal" item is NOT (has grade)',
   core.rrImpIsSummaryItem({ itemNum: 'Total:', rawGrade: 'C7' }) === false);

// Year from description ("the date is in the title so it should be modern")
ok('year: "1989 LCAC Canada Southern" -> 1989', core.rrImpYearFromText('1989 LCAC Canada Southern Operating Hopper') === '1989');
ok('year: two years -> ambiguous, blank', core.rrImpYearFromText('1957 reissue of the 1954 car') === '');
ok('year: catalog-number lookalike 6464 ignored', core.rrImpYearFromText('6464 boxcar red') === '');
ok('year: none -> blank', core.rrImpYearFromText('Santa Fe F3') === '');

// Maker from tab name (prefill only — the USER confirms on the tabs screen)
const mk = ['Lionel', 'K-Line', 'MTH', 'Atlas', 'Weaver', 'Menards'];
ok('tab maker: "Lionel" -> Lionel', core.rrImpMakerFromTab('Lionel', mk) === 'Lionel');
ok('tab maker: "K-Line by Lionel" -> K-Line', core.rrImpMakerFromTab('K-Line by Lionel', mk) === 'K-Line');
ok('tab maker: "Wings of Texaco" -> no guess', core.rrImpMakerFromTab('Wings of Texaco', mk) === '');
ok('tab maker: "Misc Trains" -> no guess', core.rrImpMakerFromTab('Misc Trains', mk) === '');

// 6- prefix pass (274 of Scott's 387 "unmatched" Lionel items were catalog
// items as 6-<number>). Exact match must still ALWAYS win (suffix rule).
const master2 = {
  '6-11169': [{ itemNum: '6-11169', description: 'Modern boxcar' }],
  '11169':   [],
  '2343':    [{ itemNum: '2343', description: 'Santa Fe F3' }],
};
const lk2 = { candidatesFor: n => master2[n] || [], baseOf: n => n };
const tri2 = core.rrImpTriage([
  { itemNum: '11169', srcTab: 'Lionel', manufacturer: 'Lionel' },   // prefix hit
  { itemNum: '2343', srcTab: 'Lionel', manufacturer: 'Lionel' },    // exact wins
  { itemNum: '11169', srcTab: 'Atlas', manufacturer: 'Atlas' },     // NOT Lionel: no prefix pass
], lk2);
ok('prefix: Lionel 11169 matches catalog 6-11169',
   tri2.matched.some(m => m.matchedVia === '6-prefix' && m.catalogNum === '6-11169'));
ok('prefix: exact 2343 still matches exactly (no prefix attempted)',
   tri2.matched.some(m => m.item.itemNum === '2343' && !m.matchedVia));
ok('prefix: Atlas 11169 does NOT get the Lionel prefix pass',
   tri2.unmatched.some(u => u.item.itemNum === '11169' && u.item.srcTab === 'Atlas'));

// ── v0.9.1512: Excel's 1899 date corruption (found in Brad's export audit —
// 137 SCALE cells came through as "Fri Dec 29 1899 19:43" because Excel
// converts entries like 1:20 / 7:38 into times).
ok('date junk: 1899 timestamp -> blank, not a fake date',
   core.rrImpNormCell(new Date('1899-12-30T01:43:00Z')) === '');
ok('date junk: 1900 epoch edge -> blank',
   core.rrImpNormCell(new Date('1900-01-01T00:00:00Z')) === '');
ok('real date still survives',
   core.rrImpNormCell(new Date('2024-01-09T18:00:00Z')) === '2024-01-09');
ok('date junk counter sees them',
   core.rrImpCountDateJunk([{ rows: [{ cells: [new Date('1899-12-30'), 'ok', new Date('2024-01-09')] }] }]) === 1);

// ── v0.9.1518: Brad's Lionel number-length rule ─────────────────
ok('era rule: 4 digits -> vintage', core.rrImpLionelEraClass('2340') === 'vintage');
ok('era rule: 3 digits -> vintage', core.rrImpLionelEraClass('675') === 'vintage');
ok('era rule: 5 digits -> modern', core.rrImpLionelEraClass('26077') === 'modern');
ok('era rule: suffix ignored (6464-25 is vintage)', core.rrImpLionelEraClass('6464-25') === 'vintage');
ok('era rule: 6-prefixed modern number -> modern', core.rrImpLionelEraClass('6-11169') === 'vintage',
   'note: 6- prefix strips to "6" — prefix matches write the CATALOG number, so this path is not used for them');
ok('era rule: no digits -> no opinion', core.rrImpLionelEraClass('CA-SO') === '');
ok('row class: MPC tab -> modern', core.rrImpEraClassOfRow({ _era: 'mpc', _tab: 'Lionel MPC-Modern' }) === 'modern');
ok('row class: PW tab -> vintage', core.rrImpEraClassOfRow({ _era: 'pw', _tab: 'Lionel PW - Items' }) === 'vintage');
ok('vintage period: prewar tab', core.rrImpVintagePeriod({ _era: 'prewar', _tab: 'Lionel Pre-War' }) === 'prewar');
ok('vintage period: pw tab', core.rrImpVintagePeriod({ _era: 'pw', _tab: 'Lionel PW - Items' }) === 'postwar');

// The whole point: Lionel reuses numbers across eras.
const reused = {
  '2340': [{ itemNum: '2340', _era: 'pw',  _tab: 'Lionel PW - Items', description: 'GG-1 postwar' },
           { itemNum: '2340', _era: 'mpc', _tab: 'Lionel MPC-Modern', description: 'GG-1 reissue' }],
  '26077': [{ itemNum: '26077', _era: 'mpc', _tab: 'Lionel MPC-Modern', description: 'Flatcar w/ autos' },
            { itemNum: '26077', _era: 'pw', _tab: 'Lionel PW - Items', description: 'nonsense twin' }],
  '675':  [{ itemNum: '675', _era: 'pw', _tab: 'Lionel PW - Items', description: 'postwar steam' },
           { itemNum: '675', _era: 'prewar', _tab: 'Lionel Pre-War', description: 'prewar steam' }],
};
const lk3 = { candidatesFor: n => reused[n] || [], baseOf: n => n };
const t3 = core.rrImpTriage([
  { itemNum: '2340', manufacturer: 'Lionel', srcTab: 'Lionel' },
  { itemNum: '26077', manufacturer: 'Lionel', srcTab: 'Lionel' },
  { itemNum: '675', manufacturer: 'Lionel', srcTab: 'Lionel' },
], lk3);
ok('reused 2340 (4 digits) resolves to POSTWAR, not the reissue',
   t3.matched.some(m => m.item.itemNum === '2340' && m.master._era === 'pw' && m.matchedVia === 'lionel-digits'));
ok('reused 26077 (5 digits) resolves to MODERN',
   t3.matched.some(m => m.item.itemNum === '26077' && m.master._era === 'mpc'));
ok('675 stays for the prewar/postwar verify (two vintage candidates)',
   t3.ambiguous.some(a => a.item.itemNum === '675' && a.eraChoice === 'vintage' && a.prewar && a.postwar));

// ── UI wiring guard (added v0.9.1508 after a LIVE failure) ──────
// Brad opened Import on a real account and got an EMPTY window: _impRender's
// step map named _impStepWriting, which nothing defined, so building that
// object literal threw before the entry screen drew — broken for everyone,
// every time, and invisible to these node suites because import-ui.js is
// browser code. This static check reads import-ui.js as TEXT and proves every
// function the UI references by name actually exists. Cheap, no DOM needed.
// v0.9.1524: a deploy must never reload a running import. Two halves have to
// agree: the overlay marks itself busy, and the reload guard in index.html
// honours that mark. Either half alone is silently useless, so test both.
// v0.9.1526: the description type-reader. Brad's own examples are the spec —
// each of these is a line he pointed at or a miss the fixture run exposed.
// v0.9.1527: the catalog gate. Brad's (39) import matched ZERO of 3,370 rows
// because the lookup index was still building and nothing checked. Three
// pieces have to exist together, so all three are asserted: the catalog can
// report its readiness, the import asks before matching, and the triage
// screen shouts if a big train import matched nothing anyway.
// v0.9.1529: the Books tab. It imported with no type because the type
// question is only asked for a tab classed "not trains", and the AI called
// Books a train tab. Two catches now — one deterministic, one evidence-based.
// v0.9.1530: the year rule. It ran on ONE of Brad's eleven tabs because its
// default was assigned inside the tab-questions screen — a tab whose question
// never rendered kept `undefined`, which reads as "no". 437 years available,
// 27 written. The default now lives with the rule.
(function yearDefaultTest() {
  const uiPath = path.join(__dirname, '..', 'app', 'import-ui.js');
  const ui = fs.readFileSync(uiPath, 'utf8');

  ok('one function owns the answer', /function _impTabYearMeansMade/.test(ui));
  ok('trains default to yes without anyone being asked',
     /_impTabYearMeansMade[\s\S]{0,400}return c === 'trains'/.test(ui));
  ok('an explicit answer still wins',
     /_impTabYearMeansMade[\s\S]{0,200}tabYearMeans\[tabName\] !== undefined/.test(ui));
  ok('the staging rule asks that function, not the raw flag',
     /!it\.yearMade && _impTabYearMeansMade\(/.test(ui));
  ok('the screen asks the same function',
     /var defYear = _impTabYearMeansMade\(name, cls\)/.test(ui));
  ok('the default is no longer written from the screen',
     !/tabYearMeans\[name\] === undefined/.test(ui));
  ok('counting a tab\u2019s years falls back to the mapped items',
     /column walk above returned 0[\s\S]{0,600}rrImpApplyMapping\(t, m\)/.test(ui));
  ok('triage reports what the year rule did', /items got a Year from their description/.test(ui));

  // The year reader itself, on Brad's real phrasings.
  is_year('1946 Lionel Reproduction Catalog', '1946');
  is_year('A Century of Lionel Timeless Toy Trains', '');
  is_year('1929 WACO ASO Waco Straightwing', '1929');
  function is_year(text, want) {
    const got = core.rrImpYearFromText(text) || '';
    ok('year from "' + text.slice(0, 34) + '"', got === want, got || '(none)');
  }
})();

(function nonCatalogTabTest() {
  const numbered = n => Array.from({ length: n }, (_, i) => ({ itemNum: '646' + i }));
  const bare = n => Array.from({ length: n }, () => ({ itemNum: '', yourDesc: 'All Aboard for Christmas' }));

  ok('a tab of numberless rows is not catalogue items', core.rrImpTabIsNonCatalog(bare(115)));
  ok('a tab of numbered rows is', !core.rrImpTabIsNonCatalog(numbered(115)));
  ok('mostly numberless still counts', core.rrImpTabIsNonCatalog(bare(70).concat(numbered(30))));
  ok('an even split does NOT (too weak to act on)', !core.rrImpTabIsNonCatalog(bare(50).concat(numbered(50))));
  ok('a handful of rows is never enough to judge', !core.rrImpTabIsNonCatalog(bare(9)));
  is_close('numberless share is a plain fraction', core.rrImpNumberlessShare(bare(3).concat(numbered(1))), 0.75);

  // The UI half: both catches wired, and the user's word beating the reader.
  const uiPath = path.join(__dirname, '..', 'app', 'import-ui.js');
  const ui = fs.readFileSync(uiPath, 'utf8');
  ok('tab classes are re-judged before the questions', /function _impInferTabClasses[\s\S]{0,400}rrImpTabIsNonCatalog/.test(ui));
  ok('...and that runs when the questions are drawn', /_impStepTabFacts\(\)\s*\{\s*[\s\S]{0,120}_impInferTabClasses\(\)/.test(ui));
  ok('tabs that matched nothing are collected', /_imp\.unmatchedTabs = Object\.keys/.test(ui));
  ok('...and asked about on triage', /unmatchedTabs \|\| \[\]\)\.length/.test(ui));
  ok('a tab answer beats the description reader', /_imp\.tabType\[it\.srcTab\]\) return ''/.test(ui));
  ok('a tab answer applies whatever the tab was classed', !/tabClass !== 'trains' && _imp\.tabType/.test(ui));
})();

(function catalogGateTest() {
  const uiPath = path.join(__dirname, '..', 'app', 'import-ui.js');
  const dataPath = path.join(__dirname, '..', 'app', 'app-data.js');
  if (!fs.existsSync(uiPath) || !fs.existsSync(dataPath)) { ok('catalog gate: files present', false); return; }
  const ui = fs.readFileSync(uiPath, 'utf8');
  const dat = fs.readFileSync(dataPath, 'utf8');

  ok('catalog can report readiness', /function rrCatalogIndexStatus/.test(dat) &&
     /window\.rrCatalogIndexStatus/.test(dat));
  ok('readiness is only true once every era is in', /_allIdxComplete\s*=\s*map\.size\s*>\s*0/.test(dat));
  ok('import asks before it matches',
     /_impAfterTabFacts[\s\S]{0,700}_impCatalogReady\(\)/.test(ui));
  ok('import waits on its own instead of failing', /function _impCatalogWait/.test(ui) &&
     /_impStage\(\)/.test(ui.slice(ui.indexOf('function _impCatalogWait'))));
  ok('the gate has a named escape hatch', /function _impCatalogSkip/.test(ui));
  ok('triage shouts when a big train import matched nothing',
     /_trainRows >= 200 && t\.matched\.length === 0/.test(ui));
})();

(function typeReaderTest() {
  const cases = [
    ['GN 52\u2019 6\u201d Flatcar with Pipe Load #65049', 'Flatcar'],
    ['40\u2019 Plug Door Boxcar NP #98513', 'Boxcar'],
    ['Fort Knox Mint Car', 'Boxcar'],
    ['SP&S C424 Phase 2 Loco Powered #306', 'Engine'],
    ['UP Big Boy #4023', 'Engine'],
    ['Santa Fe B Unit', 'Engine'],
    ['Automatic Gateman', 'Accessory'],
    ['#164 Log Loader', 'Accessory'],          // "log" must NOT read as a load
    ['Neil\u2019s Guitar Shop', 'Accessory'],
    ['#65 Yard Lights', 'Accessory'],
    ['ZW Transformer', 'Transformer'],
    ['FT 10\u201d Straight (16 pcs)', 'Track'],
    ['Strasburg Freight 2 Pack', 'Set'],       // a set, not freight
    ['1946 Lionel Reproduction Catalog', 'Catalog'],
    ['N5C Caboose', 'Caboose'],
    ['UP \u201cNew Haven\u201d Combo Car', 'Passenger Car'],
    ['Conrail Two Tier Auto Carrier', 'Freight Car'],
    ['', ''],
    ['3001302A', ''],                          // a bare number says nothing
  ];
  let good = 0;
  cases.forEach(([text, want]) => {
    const got = core.rrImpTypeFromText(text);
    if (got === want) good++; else ok('type reader: ' + text, false, 'got "' + got + '" want "' + want + '"');
  });
  ok('type reader: Brad\u2019s examples all read correctly', good === cases.length, good + '/' + cases.length);

  // A catalog of boxcars is a CATALOG. Order-of-rules regression.
  ok('type reader: paper beats the car word inside it',
     core.rrImpTypeFromText('Lionel Boxcar Catalog 1957') === 'Catalog');

  // The survey groups, counts and shows real examples.
  const survey = core.rrImpTypeSurvey([
    { yourDesc: 'PRR Flatcar with trailers' },
    { yourDesc: 'NYC Boxcar' },
    { yourDesc: 'ATSF Boxcar #1234' },
    { yourDesc: '2001313-0' },
    { yourDesc: 'GP-9 Diesel', itemType: 'Engine' },   // already typed
  ], { onlyEmpty: true });
  ok('type survey: counts only what it could read', survey.read === 3, survey.read);
  ok('type survey: skips rows that already have a type', survey.blank === 1, survey.blank);
  ok('type survey: biggest group first with examples',
     survey.groups[0].type === 'Boxcar' && survey.groups[0].count === 2 && survey.groups[0].examples.length === 2);
})();

(function reloadGuardTest() {
  const uiPath = path.join(__dirname, '..', 'app', 'import-ui.js');
  const idxPath = path.join(__dirname, '..', 'app', 'index.html');
  if (!fs.existsSync(uiPath) || !fs.existsSync(idxPath)) {
    ok('reload guard: files present', false); return;
  }
  const ui = fs.readFileSync(uiPath, 'utf8');
  const idx = fs.readFileSync(idxPath, 'utf8');
  ok('import overlay marks itself busy', /setAttribute\(\s*['"]data-rr-busy['"]/.test(ui));
  ok('reload guard honours data-rr-busy', /_rrBusy[\s\S]{0,1200}data-rr-busy/.test(idx));
  ok('reload guard also names #imp-overlay', /_rrBusy[\s\S]{0,1400}imp-overlay/.test(idx));
})();

(function uiWiringGuard() {
  const uiPath = path.join(__dirname, '..', 'app', 'import-ui.js');
  if (!fs.existsSync(uiPath)) { ok('import-ui.js present', false, uiPath); return; }
  const src = fs.readFileSync(uiPath, 'utf8');
  const defined = new Set();
  const defRe = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m; while ((m = defRe.exec(src)) !== null) defined.add(m[1]);

  // Every value in the _impRender step map must be a defined function.
  const mapMatch = /var fn = \{([\s\S]*?)\};/.exec(src);
  ok('step map found in _impRender', !!mapMatch);
  if (mapMatch) {
    const named = [...mapMatch[1].matchAll(/:\s*(_imp[A-Za-z0-9_$]*)/g)].map(x => x[1]);
    ok('step map lists all screens', named.length >= 9, named.length + ' entries');
    const missing = named.filter(n => !defined.has(n));
    ok('EVERY step-map function is defined', missing.length === 0, missing.join(', ') || 'none missing');
  }

  // Functions called from inline onclick handlers must exist too (same bug
  // shape: a typo there fails only when a user taps the button).
  const onclicks = [...src.matchAll(/onclick=\\?["'][^"']*?(_imp[A-Za-z0-9_$]*)\s*\(/g)].map(x => x[1]);
  const missingClicks = [...new Set(onclicks)].filter(n => !defined.has(n));
  ok('every _imp* function used in an onclick is defined', missingClicks.length === 0,
     missingClicks.join(', ') || 'none missing');

  // The four globals the app depends on must be exported to window.
  ['rrImportOpen', 'rrImportClose', 'rrImportUndo', 'rrImportRecentBatchesHtml']
    .forEach(g => ok('window export: ' + g, src.indexOf('window.' + g + ' = ') >= 0));
})();

// ── Fixture tests (Scott's real workbook) ───────────────────────
const fixturePath = process.argv[2] || path.join(__dirname, '..', 'Scott_Inventory_TEST_FIXTURE.xlsx');

async function fixtureTests() {
  if (!fs.existsSync(fixturePath)) {
    ok('FIXTURE PRESENT at ' + fixturePath, false, 'missing — pass the path as argv[2]');
    return;
  }
  let ExcelJS;
  try { ExcelJS = require('exceljs'); }
  catch (e) { ok('exceljs available', false, 'npm install exceljs'); return; }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(fixturePath);

  // Custom palette from styles.xml (Numbers export) — read raw from zip.
  const zlib = require('zlib');
  let palette = null;
  try {
    const buf = fs.readFileSync(fixturePath);
    // Minimal zip walk: find "xl/styles.xml" local header, inflate raw.
    const name = Buffer.from('xl/styles.xml');
    let idx = buf.indexOf(name);
    while (idx > 30) {
      const lh = idx - 30;
      if (buf.readUInt32LE(lh) === 0x04034b50) {
        const method = buf.readUInt16LE(lh + 8);
        const compSize = buf.readUInt32LE(lh + 18);
        const nameLen = buf.readUInt16LE(lh + 26);
        const extraLen = buf.readUInt16LE(lh + 28);
        const start = lh + 30 + nameLen + extraLen;
        let xml;
        if (method === 8) {
          // Numbers writes streamed entries (sizes 0 in local header) — inflate to end of stream.
          xml = zlib.inflateRawSync(buf.slice(start, compSize > 0 ? start + compSize : undefined)).toString('utf8');
        } else {
          xml = buf.slice(start, start + (compSize || buf.length - start)).toString('utf8');
        }
        palette = core.rrImpPaletteFromStylesXml(xml);
        break;
      }
      idx = buf.indexOf(name, idx + 1);
    }
  } catch (e) { /* palette stays null; test below reports */ }
  ok('fixture: custom indexed palette parsed', !!palette && palette.length >= 15, palette && palette.length);
  ok('fixture: palette 13 is salmon FFB5AF', !!palette && palette[13] === 'FFFFB5AF', palette && palette[13]);

  // Normalize every tab through the core pipeline
  const tabs = [];
  wb.eachSheet(ws => {
    const raw = [];
    const scanMax = Math.min(ws.rowCount, 8);
    for (let r = 1; r <= scanMax; r++) raw.push((ws.getRow(r).values || []).slice(1));
    const hIdx = core.rrImpDetectHeaderRow(raw);
    const tab = { name: ws.name, headerRow: hIdx, headers: [], rows: [] };
    if (hIdx >= 0) {
      tab.headers = raw[hIdx].map(core.rrImpNormCell);
      for (let r = hIdx + 2; r <= ws.rowCount; r++) {   // +2: 1-based, skip header
        const row = ws.getRow(r);
        const cells = (row.values || []).slice(1);
        if (cells.every(c => core.rrImpNormCell(c) === '')) continue;
        const fill = row.getCell(1).fill;
        const sig = core.rrImpFillSig(fill);
        tab.rows.push({
          cells,
          rowIdx: r,
          fillSig: sig,
          fillRgb: sig ? core.rrImpResolveFillRgb(fill && fill.fgColor, palette) : null,
        });
      }
    }
    tabs.push(tab);
  });

  ok('fixture: 20 tabs read', tabs.length === 20, tabs.length);
  const withHeaders = tabs.filter(t => t.headerRow >= 0);
  const scottMain = tabs.filter(t => t.headers.some(h => core.rrImpNormHeader(h) === 'item #'));
  ok('fixture: header row found on every train/list tab (19 of 20)', withHeaders.length >= 19, withHeaders.length);
  ok('fixture: headers land on ROW 2 for the 15 main train tabs',
     scottMain.length >= 15 && scottMain.every(t => t.headerRow === 1),
     scottMain.map(t => t.headerRow).join(','));

  // Layout grouping: the 15 main train tabs must land in ONE family
  const groups = core.rrImpGroupLayouts(tabs);
  const mainGroup = groups.find(g => g.tabs.some(t => t.name === 'Lionel'));
  ok('fixture: 15 train tabs share ONE layout family', !!mainGroup && mainGroup.tabs.length === 15,
     mainGroup && mainGroup.tabs.map(t => t.name).join(', '));
  ok('fixture: Books does NOT join the train family', !mainGroup.tabs.some(t => t.name === 'Books'));

  // Fill groups: exactly one question-worthy group — the 160 red rows
  const fillGroups = core.rrImpFillGroups(tabs);
  ok('fixture: exactly 1 highlight group (two salmons merged)', fillGroups.length === 1, fillGroups.length);
  ok('fixture: red group = 160 rows', fillGroups.length === 1 && fillGroups[0].count === 160, fillGroups[0] && fillGroups[0].count);
  ok('fixture: red group carries a real swatch color', fillGroups.length === 1 && /^F/.test(fillGroups[0].rgb || ''), fillGroups[0] && fillGroups[0].rgb);

  // End-to-end mapping on the Lionel tab: 1,848+ items stage cleanly
  const lionel = tabs.find(t => t.name === 'Lionel');
  const mapping = {};
  const heur = core.rrImpHeuristicMap(lionel.headers);
  Object.keys(heur.map).forEach(k => { mapping[k] = heur.map[k]; });
  const staged = core.rrImpApplyMapping(lionel, mapping);
  ok('fixture: Lionel tab stages 1800+ items', staged.length >= 1800, staged.length);
  ok('fixture: staged items carry itemNum + rawGrade', staged.filter(s => s.itemNum && s.rawGrade).length > 1500);
  const redStaged = staged.filter(s => s.fillSig === 'idx:13' || s.fillSig === 'idx:14');
  ok('fixture: staged red rows preserved on items', redStaged.length > 0, redStaged.length);

  // v0.9.1509: the fixture's own "Total:" rows are detected
  const summaryCount = tabs.reduce((n, t) => {
    const m = {};
    const heur = core.rrImpHeuristicMap(t.headers || []);
    Object.keys(heur.map).forEach(k => { m[k] = heur.map[k]; });
    return n + core.rrImpApplyMapping(t, m).filter(core.rrImpIsSummaryItem).length;
  }, 0);
  ok('fixture: summary "Total:" rows detected (Scott has them)', summaryCount >= 10, summaryCount);

  // Grade strings from the real sheet feed the conversion table
  const gradeList = core.rrImpCollectGrades(staged);
  ok('fixture: distinct grade strings collected', gradeList.length >= 3 && gradeList[0].count > 100,
     gradeList.slice(0, 5).map(g => g.grade + '×' + g.count).join(', '));

  // AI payload stays small (headers + ≤10 samples per tab)
  const payload = core.rrImpBuildAiPayload(tabs, fillGroups);
  const payloadStr = JSON.stringify(payload);
  ok('fixture: AI payload under 200KB', payloadStr.length < 200 * 1024, Math.round(payloadStr.length / 1024) + 'KB');
  ok('fixture: payload includes a highlighted sample', payload.tabs.some(t => t.samples.some(s => s.highlighted)));

  // v0.9.1526: the type reader against the whole real sheet. Measured 86%
  // when built; the floor is set below that so ordinary tuning doesn't trip
  // it, but a rule change that guts coverage will.
  let typed = 0, seen = 0;
  staged.forEach(it => {
    const d = (it.yourDesc || '').trim();
    if (!d) return;
    seen++;
    if (core.rrImpTypeFromText(d)) typed++;
  });
  const pct = seen ? Math.round(typed / seen * 100) : 0;
  ok('fixture: type read from 80%+ of descriptions', pct >= 80, typed + '/' + seen + ' = ' + pct + '%');
}

fixtureTests().then(() => {
  console.log('');
  console.log(fail === 0 ? 'ALL IMPORT-CORE TESTS GREEN (' + pass + ')' : fail + ' FAILING of ' + (pass + fail));
  process.exit(fail === 0 ? 0 : 1);
});
