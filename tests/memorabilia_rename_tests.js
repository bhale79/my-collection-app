#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// memorabilia_rename_tests.js — v0.9.1843   (roadmap 4.27 — Brad: "memorabilia")
//
// The fourth non-train section was called "Other Lionel" — in the add screen,
// the filter list, the section chip and the Type column of every user's
// sheet — which told an MTH or Atlas collector their dealer sign was
// "Other Lionel". The word was hard-typed in fifteen places across eight
// files. Now it is defined ONCE (EPHEMERA_TABS, config.js) as "Memorabilia":
//
//   A. the definition — four sections, one place, the legacy spelling kept
//   B. the deciders (ephSectionOfType / ephCanonType) — REAL, lifted
//   C. the wizard WRITES the section's type — the app's own line, evaluated
//   D. the personal-row parser READS every spelling as one
//   E. the real list in real Chromium: a legacy "Other Lionel" row and a
//      "Memorabilia" row share the chip; the Type list says Memorabilia;
//      the Type list's section options SHOW the rows they name (found while
//      renaming: "📄 Paper Items" → 0 of Brad's 26 paper rows)
//   F. start-up no longer CREATES the four retired tabs — the REAL function
//      run against a scripted Sheets API
//   G. the words exist once — no literal outside the definition
//   H. the dead "My Mock-ups & Other Items" panel stays gone
//   I. every rule above fails on a planted offender
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const SRC = f => fs.readFileSync(path.join(APP, f), 'utf8');
const { stripComments } = require('./color-count.js');

let pass = 0, fail = 0;
function T(n, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (detail === undefined ? '' : JSON.stringify(detail))));
  cond ? pass++ : fail++;
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find ' + name);
  let d = 0; const s0 = src.indexOf('{', i);
  for (let k = s0; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}

const cfg = SRC('config.js'), br = SRC('browse.js'), ws = SRC('wizard-save.js'), ad = SRC('app-data.js');
const as = SRC('app-setup.js'), tg = SRC('type-groups.js'), ix = SRC('index.html');

// The definition, lifted whole: from `const EPHEMERA_TABS = [` to the window line.
function defSlice(src) {
  const a = src.indexOf('const EPHEMERA_TABS = [');
  const b = src.indexOf("if (typeof window !== 'undefined') { window.EPHEMERA_TABS", a);
  if (a < 0 || b < 0) throw new Error('definition not found in config.js');
  return src.slice(a, b);
}
function loadDef(src) {
  return new Function(defSlice(src) + '; return { EPHEMERA_TABS, ephTab, ephSectionOfType, ephCanonType };')();
}

// ── A ────────────────────────────────────────────────────────────────────
section('A · the definition: four sections, one place');
const D = loadDef(cfg);
const tabs = D.EPHEMERA_TABS;
T('A1  four sections', tabs.length === 4, tabs.map(t => t.id));
T('A2  ids are catalogs / paper / mockups / other (the keys the code uses)', tabs.map(t => t.id).join() === 'catalogs,paper,mockups,other');
const other = D.ephTab('other');
T('A3  the fourth section is called Memorabilia — label, single and the written type',
  other && other.label === 'Memorabilia' && other.single === 'Memorabilia' && other.type === 'Memorabilia', other);
T('A4  …and still READS the old spelling "Other Lionel" (the rows are in people\'s sheets)',
  other.reads.indexOf('other lionel') >= 0 && other.reads.indexOf('memorabilia') >= 0, other.reads);
T('A5  …and remembers its old tab by its old name — never to create it, only to read/colour/lock it',
  other.sheetTab === 'Other Lionel');
T('A6  every section reads the spelling it writes', tabs.every(t => t.reads.indexOf(t.type.toLowerCase()) >= 0));
T('A7  every read is lower-case and trimmed (the decider lower-cases the row)',
  tabs.every(t => t.reads.every(r => r === r.toLowerCase().trim() && r.length)));
T('A8  singles are unique (they are the Type list\'s values)', new Set(tabs.map(t => t.single.toLowerCase())).size === 4);
T('A9  the other three are what they were (Catalog / Paper Item / Mock-Up; writes Catalog / Paper / Mock-Up)',
  D.ephTab('catalogs').single === 'Catalog' && D.ephTab('catalogs').type === 'Catalog' &&
  D.ephTab('paper').single === 'Paper Item' && D.ephTab('paper').type === 'Paper' &&
  D.ephTab('mockups').single === 'Mock-Up' && D.ephTab('mockups').type === 'Mock-Up');
// A section's single must never collide with a tier-1 bucket label: the row
// test decides "is this a section option?" by that word.
(function () {
  const w = {}; new Function('window', tg)(w);
  const labels = (w.TYPE_BUCKETS || []).map(b => String(b.label).toLowerCase());
  T('A10 no section word doubles as a type-bucket label', tabs.every(t => labels.indexOf(t.single.toLowerCase()) < 0), labels);
})();
T('A11 ephTab of an unknown id is null, not a throw', D.ephTab('nope') === null);

// ── B ────────────────────────────────────────────────────────────────────
section('B · the deciders, lifted from config.js and RUN');
const sec = D.ephSectionOfType, canon = D.ephCanonType;
T('B1  "Other Lionel" is the fourth section', sec('Other Lionel') === 'other');
T('B2  …whatever the case or spacing', sec('  OTHER LIONEL ') === 'other');
T('B3  "Memorabilia" is the fourth section', sec('Memorabilia') === 'other');
T('B4  Paper / Paper Item / Catalog / Mock-Up / mockup land where they always did',
  sec('Paper') === 'paper' && sec('Paper Item') === 'paper' && sec('Catalog') === 'catalogs' && sec('Mock-Up') === 'mockups' && sec('mockup') === 'mockups');
T('B5  a train is no section', sec('Boxcar') === '' && sec('Steam Locomotive') === '');
T('B6  plain "Other" stays a TRAIN (the manual-add oddball type)', sec('Other') === '');
T('B7  empty / missing → no section', sec('') === '' && sec(null) === '' && sec(undefined) === '');
T('B8  canon: the legacy spelling becomes the written one', canon('Other Lionel') === 'Memorabilia' && canon('other lionel') === 'Memorabilia');
T('B9  canon: the current spelling is itself', canon('Memorabilia') === 'Memorabilia' && canon('Mock-Up') === 'Mock-Up');
T('B10 canon: a legacy paper spelling becomes Paper; a mock-up spelling Mock-Up', canon('paper item') === 'Paper' && canon('mockup') === 'Mock-Up');
T('B11 canon: anything else comes back untouched — a train, plain Other, empty',
  canon('Boxcar') === 'Boxcar' && canon('Other') === 'Other' && canon('') === '');

// ── C ────────────────────────────────────────────────────────────────────
section('C · the wizard writes the section\'s type — the app\'s own line, evaluated');
const wsCode = stripComments(ws, false);
const lineDef = /const _ephDef = \(typeof ephTab === 'function'\) \? ephTab\(tab\) : null;/;
const lineType = /const _uniItemType = \(_ephDef && _ephDef\.type\) \|\| \(\(_userTab && _userTab\.label\) \|\| 'Other'\);/;
T('C1  saveEphemeraItem asks the definition for the section', lineDef.test(wsCode));
T('C2  …and the written Type is the section\'s `type`', lineType.test(wsCode));
function writtenType(src, tab, userTab) {
  const m = lineType.exec(stripComments(src, false)); if (!m) return null;
  return new Function('ephTab', 'tab', '_userTab', 'const _ephDef = (typeof ephTab === \'function\') ? ephTab(tab) : null; ' + m[0] + ' return _uniItemType;')(D.ephTab, tab, userTab);
}
T('C3  RUN: the fourth section writes Memorabilia', writtenType(ws, 'other') === 'Memorabilia');
T('C4  RUN: paper writes Paper, mockups Mock-Up, catalogs Catalog',
  writtenType(ws, 'paper') === 'Paper' && writtenType(ws, 'mockups') === 'Mock-Up' && writtenType(ws, 'catalogs') === 'Catalog');
T('C5  RUN: a user\'s own tab writes its label; an unknown tab writes Other (the train oddball)',
  writtenType(ws, 'my_signs', { id: 'my_signs', label: 'My Signs' }) === 'My Signs' && writtenType(ws, 'zzz') === 'Other');
T('C6  the wizard spells no section name of its own', !/Other Lionel|Memorabilia|'Mock-Up'|'Paper Items'/.test(wsCode));

// ── D ────────────────────────────────────────────────────────────────────
section('D · the personal-row parser reads every spelling as one');
const adCode = stripComments(ad, false);
const parseSlice = adCode.slice(adCode.indexOf("obj.quickEntry = (obj.quickEntry === 'Yes');"), adCode.indexOf('newPersonal[key] = obj;'));
T('D1  the parser runs every Type through ephCanonType, right after the field loop and before the row is kept',
  /if \(typeof ephCanonType === 'function'\) obj\.itemType = ephCanonType\(obj\.itemType\);/.test(parseSlice), parseSlice);
T('D2  the parsed-personal cache was re-stamped (a normalised value is a new shape)',
  /const PERSONAL_CACHE_VER = '(?!pf1')[a-z0-9]+';/.test(cfg));

// ── F ────────────────────────────────────────────────────────────────────
section('F · start-up makes only the four LIVE tabs — the REAL function, scripted Sheets API');
function ensureRig(src, tabsPresent, opts) {
  opts = opts || {};
  const fn = 'async ' + grab(src, 'ensureEphemeraSheets');   // grab starts at `function`; the real one is async
  const st = { batch: [], stamps: [] };
  const fetchStub = async (url, init) => {
    if (String(url).indexOf(':batchUpdate') > -1) { st.batch.push(JSON.parse(init.body)); return { json: async () => ({}) }; }
    return { json: async () => ({ sheets: tabsPresent.map(t => ({ properties: { title: t } })) }) };
  };
  const sheetsUpdate = async (id, range, values) => { if (opts.failStamps) throw new Error('refused'); st.stamps.push({ range, values }); };
  const H = { IS_HEADERS: ['is'], SCIENCE_HEADERS: ['sc'], CONSTRUCTION_HEADERS: ['co'], MY_SETS_HEADERS: ['ms'],
              CATALOG_HEADERS: ['cat'], EPHEMERA_HEADERS: ['eph'], MOCKUP_HEADERS: ['mu'] };
  const api = new Function('fetch', 'sheetsUpdate', 'accessToken', ...Object.keys(H),
    'let _ensureEphemDone = false;\n' + fn + '\nreturn { run: ensureEphemeraSheets, flag: () => _ensureEphemDone };')
    (fetchStub, sheetsUpdate, 'tok', ...Object.values(H));
  return { st, api };
}
const RETIRED = tabs.map(t => t.sheetTab);
const LIVE = ['Instruction Sheets', 'Science Sets', 'Construction Sets', 'My Sets'];
(async function () {
  const r1 = ensureRig(as, []);
  await r1.api.run('S');
  const made1 = r1.st.batch.flatMap(b => b.requests.map(q => q.addSheet.properties.title));
  T('F1  a brand-new sheet: ONE batchUpdate creates exactly the four live tabs', r1.st.batch.length === 1 && made1.join() === LIVE.join(), made1);
  T('F2  …and none of the four retired tabs (Catalogs / Paper Items / Mock-Ups / the old fourth-section tab)',
    made1.every(t => RETIRED.indexOf(t) < 0), made1);
  T('F3  …eight header stamps (title + headers per live tab), all on live tabs',
    r1.st.stamps.length === 8 && r1.st.stamps.every(s => LIVE.some(t => s.range.indexOf(t + '!') === 0)), r1.st.stamps.map(s => s.range));
  T('F4  …no stamp touches a retired tab', r1.st.stamps.every(s => RETIRED.every(t => s.range.indexOf(t + '!') !== 0)));
  T('F5  …and the run-once flag is set once the writes are done', r1.api.flag() === true);
  const r2 = ensureRig(as, LIVE.concat(['My Collection', 'Sold']));
  await r2.api.run('S');
  T('F6  a sheet with the live tabs: nothing is created, the eight stamps still repair the headers',
    r2.st.batch.length === 0 && r2.st.stamps.length === 8);
  const r3 = ensureRig(as, ['Instruction Sheets', 'My Sets']);
  await r3.api.run('S');
  const made3 = r3.st.batch.flatMap(b => b.requests.map(q => q.addSheet.properties.title));
  T('F7  only the missing live tabs are created', made3.join() === 'Science Sets,Construction Sets', made3);
  const r4 = ensureRig(as, LIVE, { failStamps: true });
  let threw = false; try { await r4.api.run('S'); } catch (e) { threw = true; }
  T('F8  a refused stamp throws AND leaves the flag down (v0.9.1325: set last, so the next caller retries)', threw && r4.api.flag() === false);
  T('F9  the function spells no retired tab name of its own (comments aside)',
    RETIRED.every(t => stripComments(grab(as, 'ensureEphemeraSheets'), false).indexOf("'" + t + "'") < 0));
  T('F10 the canonical-tab set still names the retired tabs through the definition (a legacy sheet\'s tabs are not "user tabs")',
    /\.\.\.EPHEMERA_TABS\.map\(t => t\.sheetTab\),\s*\n\s*'Instruction Sheets', 'Science Sets', 'Construction Sets', 'My Sets',/.test(as));

  // ── G ──────────────────────────────────────────────────────────────────
  section('G · the words exist once');
  const files = fs.readdirSync(APP).filter(f => /\.js$/.test(f) && f !== 'config.js');
  const withOld = files.filter(f => /other lionel/i.test(stripComments(SRC(f), false)));
  T('G1  "Other Lionel" appears in no script but config.js (comments aside)', withOld.length === 0, withOld);
  T('G2  …nor in index.html', !/other lionel/i.test(stripComments(ix, 'html')));
  const cfgCode = stripComments(cfg, false);
  const defStart = cfgCode.indexOf('const EPHEMERA_TABS = ['), defEnd = cfgCode.indexOf('];', defStart) + 2;
  const outsideDef = cfgCode.slice(0, defStart) + cfgCode.slice(defEnd);
  T('G3  in config.js the old spelling lives only inside the definition (reads + the old tab name)',
    !/other lionel/i.test(outsideDef) && (cfgCode.slice(defStart, defEnd).match(/other lionel/gi) || []).length === 2);
  // "Memorabilia" as a quoted literal: the definition, plus ONE allowance —
  // type-groups.js files the master catalog's own 'Memorabilia' rows (Lionel's
  // Other tab) under Paper / Box / Misc; that is a master-catalog synonym, not
  // the section's name, and must not follow a rename.
  const memLit = /['"]Memorabilia['"]/;
  const withMem = files.filter(f => f !== 'type-groups.js' && memLit.test(stripComments(SRC(f), false)));
  T('G4  "Memorabilia" is quoted in no script but config.js (and type-groups\' master synonym)', withMem.length === 0, withMem);
  T('G5  …and in type-groups.js only on the master synonym line', (stripComments(tg, false).match(/['"]Memorabilia['"]/g) || []).length === 1);
  T('G6  …and nowhere in index.html', !memLit.test(stripComments(ix, 'html')));
  T('G7  app.js no longer carries its own copy of the section list', !/const EPHEMERA_TABS = \[/.test(stripComments(SRC('app.js'), false)));
  T('G8  browse.js builds its section tables from the definition, not by hand',
    /EPHEMERA_TABS\.forEach\(function \(t\) \{ _SEC_TYPES\[t\.id\] = t\.reads; \}\);/.test(br) &&
    /const _typeSection = function\(it\) \{ return ephSectionOfType\(it\.itemType\); \};/.test(br) &&
    /EPHEMERA_TABS\.forEach\(function \(t\) \{ _ephLabels\[t\.id\] = t\.single; _ephEmojis\[t\.id\] = t\.emoji; _ephTypeMap\[t\.single\] = t\.id; \}\);/.test(br) &&
    /_chipMeta\[t\.id\] = \{ label: t\.emoji \+ ' ' \+ t\.label, color: _chipColors\[t\.id\] \};/.test(br));
  T('G9  the Type list\'s section options come from the definition (value = single, text = emoji + label)',
    /o\.value = t\.single; o\.textContent = t\.emoji \+ ' ' \+ t\.label;/.test(br));
  T('G10 the sheet formatter and the lock name the retired tabs through the definition',
    /\.\.\.EPHEMERA_TABS\.map\(t => t\.sheetTab\)/.test(SRC('sheet-builder.js')) &&
    (SRC('sheet-builder.js').match(/\[ephTab\('(catalogs|paper|mockups|other)'\)\.sheetTab\]:/g) || []).length === 4);

  // ── H ──────────────────────────────────────────────────────────────────
  section('H · the dead panel stays gone');
  const brCode = stripComments(br, false);
  T('H1  renderMockupsOtherTab is gone from browse.js', !/renderMockupsOtherTab/.test(brCode));
  T('H2  the panel is gone from index.html', !/browse-mockups-panel|mockups-tbody|mockups-search|mockups-count/.test(ix));
  T('H3  the tab controller no longer knows a mockups panel or title',
    !/mockups:'browse-mockups-panel'/.test(brCode) && !/mockups:'My Mock-ups & Other Items'/.test(brCode));
  T('H4  …and a stale saved "mockups" tab lands on Items', /if \(tab === 'mockups'\) tab = 'items';/.test(brCode));

  // ── E ──────────────────────────────────────────────────────────────────
  section('E · the real list, real Chromium');
  let chromium = null;
  try { chromium = require('playwright').chromium; } catch (e) {}
  if (!chromium) {
    T('E0  playwright is installed (the list is proven in a real browser)', false, 'npm install');
  } else {
    const ex = '/opt/pw-browsers/chromium';
    const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
    async function runList(planted) {
      const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      const errs = []; pg.on('pageerror', e => errs.push(e.message));
      await pg.route('**', r => {
        const u = r.request().url();
        if (!u.startsWith('file://')) return r.abort();
        const clean = u.split('?')[0];
        const name = Object.keys(planted || {}).find(k => clean.endsWith('/' + k));
        if (name) return r.fulfill({ body: planted[name], contentType: 'application/javascript' });
        return r.continue();
      });
      await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(900);
      const out = await pg.evaluate(() => {
        const PW = 'Lionel PW - Items';
        const mk = (n, v, t) => ({ itemNum: n, variation: v, itemType: t, _era: 'pw', _tab: PW, yearProd: '1950', description: t + ' ' + n, roadName: 'Road ' + n });
        state.masterData = [mk('6464-425', '1', 'Boxcar'), mk('2343', '', 'Diesel Locomotive'), mk('6457', '', 'Caboose')];
        _rebuildMasterIndex();
        let inv = 1;
        const pd = (n, v, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: 'pw', manufacturer: 'Lionel', inventoryId: 'i' + (inv++), row: inv + 2, condition: '8' }, x || {});
        state.personalData = {
          a: pd('6464-425', '1'), b: pd('2343', ''),
          c: pd('ODD-1', '', { era: 'Manual', itemType: 'Other', description: 'an off-catalog oddball' }),        // plain Other = a TRAIN
          d: pd('PAP-1', '', { era: 'Manual', itemType: 'Paper', description: 'a paper item' }),
          e: pd('PAP-2', '', { era: 'Manual', itemType: 'Paper Item', description: 'an older paper item' }),
          f: pd('MEM-1', '', { era: 'Manual', itemType: 'Memorabilia', description: 'a dealer sign' }),
          g: pd('MEM-2', '', { era: 'Manual', itemType: 'Other Lionel', description: 'a sign filed by v0.9.1842' }),
          h: pd('MOC-1', '', { era: 'Manual', itemType: 'Mock-Up', description: 'a factory mock-up' }),
        };
        state.soldData = {}; state.wantData = state.wantData || {};
        _currentEra = 'all';
        var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
        document.getElementById('app').classList.add('active');
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-browse').classList.add('active');
        localStorage.setItem('lv_browse_filter_state', JSON.stringify({ manufacturer: 'any', scale: 'any', era: 'any', section: 'items' }));
        state.filters.ownMaker = ''; state.filters.type = ''; state.filters.subCollection = ''; state.filters.subType = '';
        filterOwned();
        populateFilters();
        const opts = [...document.querySelectorAll('#filter-type option')].map(o => ({ v: o.value, t: o.textContent }));
        const draw = (sec, type) => {
          state._collSection = sec; state.filters.type = type; state.currentPage = 1;
          window._rrBrowseSig = null; renderBrowse();
          const chips = [...document.querySelectorAll('button[onclick^="_collSectionSet"]')].map(b => b.textContent.trim());
          return { rows: state.filteredData.map(r => r.itemNum).sort(), chips };
        };
        const r = {
          opts,
          allNoType: draw('all', ''),
          allMem: draw('all', 'Memorabilia'),
          allPaper: draw('all', 'Paper Item'),
          allMock: draw('all', 'Mock-Up'),
          allBoxcar: draw('all', 'Boxcar'),
          chipMem: draw('other', ''),
          chipTrains: draw('trains', ''),
          trainsMem: draw('trains', 'Memorabilia'),
          bucketOwnMem: getTypeBucketLabel({ itemType: 'Memorabilia', _personalOnly: true }),
          bucketOwnOld: getTypeBucketLabel({ itemType: 'Other Lionel', _personalOnly: true }),
          bucketMasterMem: getTypeBucketLabel({ itemType: 'Memorabilia' }),
        };
        try {
          const all = _collectAllOwnedItems();
          r.everything = {}; all.forEach(x => { const n = String(x.title || '').replace(/<[^>]+>/g, ''); r.everything[n] = x.type; });
        } catch (e) { r.everythingErr = String(e); }
        return r;
      });
      out.errs = errs;
      await pg.close();
      return out;
    }
    const L = await runList(null);
    T('E1  the page ran without a script error', L.errs.length === 0, L.errs);
    const optTexts = L.opts.map(o => o.t).join(' | ');
    T('E2  the Type list offers "📦 Memorabilia" (value Memorabilia) and "📄 Paper Items" and "🔩 Mock-Ups"',
      L.opts.some(o => o.v === 'Memorabilia' && o.t === '📦 Memorabilia') && L.opts.some(o => o.v === 'Paper Item' && o.t === '📄 Paper Items') && L.opts.some(o => o.v === 'Mock-Up' && o.t === '🔩 Mock-Ups'), optTexts);
    T('E3  …and never the old words', !/Other Lionel/.test(optTexts), optTexts);
    T('E4  the combined view shows all eight rows', L.allNoType.rows.length === 8, L.allNoType.rows);
    T('E5  the section chips read Trains · Paper Items · Mock-Ups · Memorabilia · All — no "Other Lionel"',
      L.allNoType.chips.join() === 'Trains,Paper Items,Mock-Ups,Memorabilia,All', L.allNoType.chips);
    T('E6  the Memorabilia chip shows the row typed today AND the row typed "Other Lionel" by v0.9.1842',
      L.chipMem.rows.join() === 'MEM-1,MEM-2', L.chipMem.rows);
    T('E7  the Trains chip keeps the trains — and the plain "Other" oddball — and none of the sections',
      L.chipTrains.rows.join() === '2343,6464-425,ODD-1', L.chipTrains.rows);
    T('E8  THE FIX: the Type list\'s "Memorabilia" shows the Memorabilia rows (it used to hide every row it named)',
      L.allMem.rows.join() === 'MEM-1,MEM-2', L.allMem.rows);
    T('E9  …"Paper Items" shows the paper rows, both spellings', L.allPaper.rows.join() === 'PAP-1,PAP-2', L.allPaper.rows);
    T('E10 …"Mock-Ups" shows the mock-up', L.allMock.rows.join() === 'MOC-1', L.allMock.rows);
    T('E11 a bucket word still works as before ("Boxcar" → the boxcar)', L.allBoxcar.rows.join() === '6464-425', L.allBoxcar.rows);
    T('E12 the filters still AND: the Trains chip with the Memorabilia option shows nothing (a chip is not overruled)', L.trainsMem.rows.length === 0, L.trainsMem.rows);
    T('E13 a user\'s own Memorabilia row is filed as Memorabilia in the Type column — the old spelling too',
      L.bucketOwnMem === 'Memorabilia' && L.bucketOwnOld === 'Memorabilia', [L.bucketOwnMem, L.bucketOwnOld]);
    T('E14 …while the master catalog\'s own Memorabilia rows stay under Paper / Box / Misc (untouched)', L.bucketMasterMem === 'Paper', L.bucketMasterMem);
    T('E15 the everything page files both memorabilia rows and the mock-up under Other, the paper under Paper',
      L.everything && L.everything['MEM-1'] === 'other' && L.everything['MEM-2'] === 'other' && L.everything['MOC-1'] === 'other' && L.everything['PAP-1'] === 'paper' && L.everything['PAP-2'] === 'paper', L.everything || L.everythingErr);

    // ── I (browser half) ─────────────────────────────────────────────────
    section('I · planted offenders — the real file replaced by the old code');
    const brOld = br.replace('if (_typeSection(item) !== _tfSec) return false;', 'return false;');
    T('I1  offender "hide the rows the option names" changed browse.js', brOld !== br);
    const O1 = await runList({ 'browse.js': brOld });
    T('I1  …and E8 goes red on it (Memorabilia option → nothing)', O1.allMem.rows.length === 0 && O1.errs.length === 0, O1.allMem.rows);
    const cfgNoLegacy = cfg.replace("reads: ['memorabilia', 'other lionel']", "reads: ['memorabilia']");
    T('I2  offender "forget the old spelling" changed config.js', cfgNoLegacy !== cfg);
    const O2 = await runList({ 'config.js': cfgNoLegacy });
    T('I2  …and E6 goes red on it (the v0.9.1842 row falls out of the chip)', O2.chipMem.rows.join() === 'MEM-1' && O2.errs.length === 0, O2.chipMem.rows);
    const tgNoOwn = tg.replace("if (_own && typeof ephSectionOfType === 'function' && ephSectionOfType(it) === 'other') {", 'if (false) {');
    T('I3  offender "drop the own-row rule" changed type-groups.js', tgNoOwn !== tg);
    const O3 = await runList({ 'type-groups.js': tgNoOwn });
    T('I3  …and E13 goes red on it (a collector\'s sign is filed as "Paper")', O3.bucketOwnMem === 'Paper' && O3.errs.length === 0, O3.bucketOwnMem);
    await browser.close();
  }

  // ── I (node half) ────────────────────────────────────────────────────
  const D2 = loadDef(cfg.replace("reads: ['memorabilia', 'other lionel']", "reads: ['memorabilia']"));
  T('I4  offender "forget the old spelling": B1 goes red (the decider no longer knows it)', D2.ephSectionOfType('Other Lionel') !== 'other');
  const wsOld = ws.replace("const _uniItemType = (_ephDef && _ephDef.type) || ((_userTab && _userTab.label) || 'Other');",
                           "const _uniItemType = (_ephDef && 'Other Lionel') || ((_userTab && _userTab.label) || 'Other');");
  T('I5  offender "write the old word": C2/C3 go red', wsOld !== ws && !lineType.test(stripComments(wsOld, false)) && writtenType(wsOld, 'other') !== 'Memorabilia');
  const adOld = ad.replace("if (typeof ephCanonType === 'function') obj.itemType = ephCanonType(obj.itemType);", '');
  const adOldCode = stripComments(adOld, false);
  const adOldSlice = adOldCode.slice(adOldCode.indexOf("obj.quickEntry = (obj.quickEntry === 'Yes');"), adOldCode.indexOf('newPersonal[key] = obj;'));
  T('I6  offender "parser keeps the old spelling": D1 goes red', adOld !== ad && !/ephCanonType\(obj\.itemType\)/.test(adOldSlice));
  const asOld = as.replace("{ title: 'Instruction Sheets', titleRange:", "{ title: 'Other Lionel', titleRange: 'Other Lionel!A1:Q1', headerRange: 'Other Lionel!A2:N2', headers: EPHEMERA_HEADERS },\n    { title: 'Instruction Sheets', titleRange:");
  T('I7  offender "create the old tab again" changed app-setup.js', asOld !== as);
  const rO = ensureRig(asOld, []); await rO.api.run('S');
  const madeO = rO.st.batch.flatMap(b => b.requests.map(q => q.addSheet.properties.title));
  T('I7  …and F2/F4 go red on it', madeO.indexOf('Other Lionel') >= 0 && rO.st.stamps.some(s => s.range.indexOf('Other Lionel!') === 0));
  T('I8  offender "a literal in browse.js": G1 goes red', /other lionel/i.test(stripComments(br + "\nconst _x = 'Other Lionel';\n", false)));
  T('I9  offender "the panel put back": H1 goes red', /renderMockupsOtherTab/.test(stripComments(br + '\nfunction renderMockupsOtherTab() {}\n', false)));
  T('I10 offender "a comment does not count": a commented "Other Lionel" is NOT a violation (so G1 measures code, not prose)',
    !/other lionel/i.test(stripComments("// the old name was 'Other Lionel'\nvar a = 1;\n", false)));

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
