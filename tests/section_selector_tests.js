#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// SECTION SELECTOR TESTS — v0.9.1915   (real Chromium, the REAL app)
//
// Brad, 2026-10-10 (screenshot of the Master Catalog, "Items ×" pill): "items
// should not have an x by it. it seems like its something you can clear off,
// its not. it tells you what type of item you are entering."
//
// What was wrong: Section was drawn as a FILTER pill. Its × "reset" to Items —
// where you already were — and because the label "Items" never matched the
// 'items' it was compared with, it always counted as a filter, so "Clear" sat
// in the row with nothing filtered.
//
// THE RULES this suite holds, by driving the real app and reading what it drew:
//   A  the Section control is a selector, drawn FIRST, "Items ▾", no ×
//   B  it is never counted: no Clear button when no real filter is set
//   C  Clear clears filters and leaves the section where it is
//   D  the picker speaks plainly: "Service Tools", "Instruction Sheets",
//      heading "Show which part of the catalog"
//   E  My Collection has no Section control at all (v0.9.1295)
//   F  on a narrow screen the selector stays visible (filters fold, it does not)
// Planted offenders (the old behaviours served as browse.js) must turn it red.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  section_selector_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const BROWSE = fs.readFileSync(path.join(APP, 'browse.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want)));
  ok ? pass++ : fail++;
}

async function openApp(browser, width, browseSrc) {
  const pg = await browser.newPage({ viewport: { width: width, height: 800 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (browseSrc && u.split('?')[0].endsWith('/browse.js')) return r.fulfill({ body: browseSrc, contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    const PW = 'Lionel PW - Items';
    state.masterData = [
      { itemNum: '6343', variation: '', itemType: 'Flatcar', _era: 'pw', _tab: PW, yearProd: '1961', description: 'Barrel Ramp Car', roadName: '' },
      { itemNum: '2343', variation: '1', itemType: 'Diesel', _era: 'pw', _tab: PW, yearProd: '1950', description: 'F3', roadName: 'Santa Fe' },
    ];
    _rebuildMasterIndex();
    state.personalData = {};
    _currentEra = 'all';
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-browse').classList.add('active');
    state.filters.owned = false;
    localStorage.setItem('lv_browse_filter_state', JSON.stringify({ manufacturer: 'any', scale: 'any', era: 'any', section: 'items' }));
    try { renderBrowse(); } catch (e) {}
    _renderHierarchyChips();
  });
  return { pg, errs };
}

// What the chip row shows, read off the page.
const READ = () => {
  const host = document.getElementById('hierarchy-chips');
  const first = host && host.firstElementChild;
  const sec = host && host.querySelector('.ph-section');
  const pills = host ? Array.from(host.querySelectorAll('span')).filter(s => /Clear this filter/.test(s.innerHTML)) : [];
  return {
    firstIsSection: !!(first && first.classList.contains('ph-section')),
    section: sec ? sec.textContent.trim() : null,
    sectionHasX: !!(sec && /×/.test(sec.textContent)) || pills.some(s => /Items|Catalogs|Paper|Sets|Service|Instruction|Science|Construction|Other/.test(s.textContent)),
    clear: !!(host && host.querySelector('.ph-clear')),
    sectionVisible: !!(sec && getComputedStyle(sec).display !== 'none' && sec.getBoundingClientRect().width > 0),
    stored: (JSON.parse(localStorage.getItem('lv_browse_filter_state') || '{}').section) || '',
  };
};

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── A + B: a fresh Master Catalog ──
  let { pg, errs } = await openApp(browser, 1400);
  let r = await pg.evaluate(READ);
  T('A1 the Section control is drawn first', r.firstIsSection, true);
  T('A2 it reads "Items ▾"', r.section, 'Items ▾');
  T('A3 it has no ×', r.sectionHasX, false);
  T('B1 no Clear button when no real filter is set', r.clear, false);

  // a real filter: Clear appears, the selector still has no ×
  await pg.evaluate(() => { _setHierarchyChoice('manufacturer', 'lionel'); _renderHierarchyChips(); });
  r = await pg.evaluate(READ);
  T('B2 a maker filter brings Clear', r.clear, true);
  T('B3 …and the selector still has no ×', r.sectionHasX, false);

  // ── C: Clear leaves the section alone ──
  await pg.evaluate(() => { _setHierarchyChoice('section', 'catalogs'); _setHierarchyChoice('manufacturer', 'lionel'); _renderHierarchyChips(); });
  r = await pg.evaluate(READ);
  T('C1 picking Catalogs relabels the selector', r.section, 'Catalogs ▾');
  await pg.click('#hierarchy-chips .ph-clear');                 // a REAL click on Clear
  await pg.waitForTimeout(150);
  r = await pg.evaluate(READ);
  T('C2 after Clear the section is still Catalogs (stored)', r.stored, 'catalogs');
  T('C3 …and the selector still says Catalogs', r.section, 'Catalogs ▾');
  T('C4 …and with nothing filtered, Clear is gone again', r.clear, false);
  const clearOne = await pg.evaluate(() => { try { _phClearOne('section'); } catch (e) {} return JSON.parse(localStorage.getItem('lv_browse_filter_state')).section; });
  T('C5 there is no "clear the section" path left (_phClearOne leaves it)', clearOne, 'catalogs');

  // ── D: plain words ──
  const words = await pg.evaluate(() => ({
    st: _phLabelFor('section', 'serviceTools'), is: _phLabelFor('section', 'instrSheets'),
    items: _phLabelFor('section', 'items'), blank: _phLabelFor('section', ''),
    unknown: _phLabelFor('section', 'brandNewThing'),
  }));
  T('D1 serviceTools -> "Service Tools"', words.st, 'Service Tools');
  T('D2 instrSheets -> "Instruction Sheets"', words.is, 'Instruction Sheets');
  T('D3 items / blank -> "Items"', [words.items, words.blank], ['Items', 'Items']);
  T('D4 a section with no entry is spelled out, never raw', words.unknown, 'Brand New Thing');
  const picker = await pg.evaluate(() => {
    _openLevelPicker('section');
    const ov = document.getElementById('ph-picker-overlay');
    const out = { heading: ov ? ov.firstElementChild.firstElementChild.textContent : '',
                  raw: ov ? Array.from(ov.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => /[a-z][A-Z]/.test(t)) : ['no picker'] };
    if (ov) ov.remove();
    return out;
  });
  T('D5 the picker heading says what it is for', picker.heading, 'Show which part of the catalog');
  T('D6 no option shows a run-together internal name', picker.raw, []);

  // ── E: My Collection has none ──
  const owned = await pg.evaluate(() => { state.filters.owned = true; _renderHierarchyChips(); const has = !!document.querySelector('#hierarchy-chips .ph-section'); state.filters.owned = false; return has; });
  T('E1 My Collection has no Section control', owned, false);
  T('page errors (wide)', errs, []);
  await pg.close();

  // ── F: narrow screen — filters fold, the selector does not ──
  ({ pg, errs } = await openApp(browser, 900));
  r = await pg.evaluate(READ);
  const idleHidden = await pg.evaluate(() => Array.from(document.querySelectorAll('#hierarchy-chips .ph-idle')).every(b => getComputedStyle(b).display === 'none'));
  T('F1 at 900 px the idle filter chips fold away', idleHidden, true);
  T('F2 …and the Section selector stays visible', r.sectionVisible, true);
  await pg.close();
  // On a phone (<= 640 px) the WHOLE filter row lives in the Filters sheet
  // (v0.9.1025) — the selector is the first thing in it.
  ({ pg, errs } = await openApp(browser, 390));
  await pg.evaluate(() => { _rrFilterSheetOpen(); });
  r = await pg.evaluate(READ);
  T('F3 at phone width (390 px) the selector is first in the Filters sheet', [r.firstIsSection, r.sectionVisible], [true, true]);
  await pg.close();

  // ── PLANTED: the old behaviours, served as browse.js, must be caught ──
  // P1: Clear resets the section again (the pre-v0.9.1915 line)
  const p1 = BROWSE.replace("st.manufacturer = 'any'; st.scale = 'any'; st.era = 'any';", "st.manufacturer = 'any'; st.scale = 'any'; st.era = 'any'; st.section = 'items';");
  T('P1 planted source differs', p1 !== BROWSE, true);
  ({ pg } = await openApp(browser, 1400, p1));
  await pg.evaluate(() => { _setHierarchyChoice('section', 'catalogs'); _setHierarchyChoice('manufacturer', 'lionel'); _renderHierarchyChips(); });
  await pg.click('#hierarchy-chips .ph-clear'); await pg.waitForTimeout(150);
  r = await pg.evaluate(READ);
  T('P1 planted: Clear-resets-section is caught (section lost)', r.stored, 'items');
  await pg.close();
  // P2: Section drawn as a filter pill again (with ×, counted)
  const secStart = BROWSE.indexOf("  if (!_phOwned) {\n    html += '<button type=\"button\" class=\"ph-section\"");
  const secEnd = BROWSE.indexOf('  }\n', secStart) + 4;
  const p2 = secStart > 0 ? BROWSE.slice(0, secStart)
    + "  if (!_phOwned) { onCount++; html += _pillOn(_phLabelFor('section', st2.section), \"_phClearOne('section')\", \"_openLevelPicker('section')\"); }\n"
    + BROWSE.slice(secEnd) : BROWSE;
  T('P2 planted source differs', p2 !== BROWSE, true);
  ({ pg } = await openApp(browser, 1400, p2));
  r = await pg.evaluate(READ);
  T('P2 planted: the old pill shows a × (caught)', r.sectionHasX, true);
  T('P2 planted: …and Clear with nothing filtered (caught)', r.clear, true);
  await pg.close();

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
