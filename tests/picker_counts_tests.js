#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PICKER-COUNT TESTS — v0.9.1798   (real Chromium, the REAL app, no stubs)
//
// Brad: "when i hit type, i see caboose says 2 next to it but i got 38" — and,
// asked whether the numbers should follow the other chips: "yes".
//
// THE RULE: the number beside a picker option is the number of rows the list
// shows when you pick it, with every other chip kept.
//
// This does not inspect how the count is made. It opens the real picker, reads
// every number, then PICKS every option through the app's own
// _setHierarchyChoice and counts the rows the real list drew. Two copies of
// "what the list would show" is how the bug happened; this test has none.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  picker_counts_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, got, want) { const ok = got === want; console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))); ok ? pass++ : fail++; }

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);

  const out = await pg.evaluate(() => {
    const PW = 'Lionel PW - Items', MPC = 'Lionel MPC-Modern', AT = 'Atlas O';
    const mk = (n, v, t, era, tab, yr) => ({ itemNum: n, variation: v, itemType: t, _era: era, _tab: tab, yearProd: yr, description: t + ' ' + n, roadName: '' });
    state.masterData = [
      mk('6457', '3', 'Caboose', 'pw', PW, '1949'), mk('6017', '1', 'Caboose', 'pw', PW, '1951'),
      mk('6464', '1', 'Boxcar', 'pw', PW, '1953'), mk('2343', '1', 'Diesel', 'pw', PW, '1950'),
      mk('8359', '', 'Diesel', 'mpc', MPC, '1973'), mk('9700', '', 'Boxcar', 'mpc', MPC, '1972'),
      mk('0326', '', 'Caboose', 'atlas', AT, '2005'),
    ];
    _rebuildMasterIndex();
    let inv = 1;
    const pd = (n, v, era, mfr, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: era, manufacturer: mfr, inventoryId: String(inv++), row: inv + 1 }, x || {});
    state.personalData = {
      a: pd('6457', '3', 'pw', 'Lionel'), b: pd('6457', '3', 'pw', 'Lionel'),          // two COPIES: blank stored type
      c: pd('6017', '1', 'pw', 'Lionel', { itemType: 'Boxcar' }),                      // STUCK wrong stored type
      d: pd('6464', '1', 'pw', 'Lionel', { groupId: 'SET-1500-1' }),                   // two members of one SET fold
      e: pd('2343', '1', 'pw', 'Lionel', { groupId: 'SET-1500-1' }),
      f: pd('8359', '', 'mpc', 'Lionel'), g: pd('9700', '', 'mpc', 'Lionel'),
      h: pd('0326', '', 'atlas', 'Atlas'),
      i: pd('Ertl 1:64 truck', '', 'Manual', 'Ertl', { itemType: 'Vehicle', yearMade: '1995' }),   // own maker + own type
    };
    state.mySetsData = { s1: { setNum: '1500', groupId: 'SET-1500-1', year: '1953' } };
    _currentEra = 'all';
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-browse').classList.add('active');
    filterOwned();

    const shown = () => { window._rrBrowseSig = null; renderBrowse(); return (state.filteredData || []).length; };
    const reset = () => {
      localStorage.setItem('lv_browse_filter_state', JSON.stringify({ manufacturer: 'any', scale: 'any', era: 'any', section: 'items' }));
      state.filters.ownMaker = ''; state.filters.type = '';
      var sel = document.getElementById('filter-type'); if (sel) sel.value = '';
    };
    const apply = pre => { reset(); (pre || []).forEach(p => _setHierarchyChoice(p[0], p[1])); };
    // Read the REAL picker: [{id-ish label, n}]. The option id is recovered by
    // picking the button itself, so nothing here re-derives an id either.
    const audit = (level, pre) => {
      apply(pre);
      _openLevelPicker(level);
      const labels = Array.from(document.querySelectorAll('#ph-picker-overlay button'))
        .map(b => b.textContent.replace(/\s*✓\s*$/, '').trim()).filter(t => t !== 'Cancel');
      document.getElementById('ph-picker-overlay').remove();
      const res = [];
      labels.forEach((lbl, idx) => {
        apply(pre);
        _openLevelPicker(level);
        const btn = Array.from(document.querySelectorAll('#ph-picker-overlay button')).filter(b => b.textContent.trim() !== 'Cancel')[idx];
        btn.click();                                   // the app's own pick
        const ov = document.getElementById('ph-picker-overlay'); if (ov) ov.remove();
        const m = lbl.match(/\((\d[\d,]*)\)$/);
        res.push({ level, pre: JSON.stringify(pre || []), label: lbl, said: m ? parseInt(m[1].replace(/,/g, ''), 10) : 0, got: shown() });
      });
      return res;
    };
    const all = [];
    ['type', 'manufacturer', 'scale', 'era'].forEach(l => all.push(...audit(l, [])));
    all.push(...audit('type', [['manufacturer', 'lionel']]));
    all.push(...audit('type', [['era', 'postwar']]));
    all.push(...audit('era', [['manufacturer', 'lionel']]));
    all.push(...audit('manufacturer', [['era', 'modern']]));
    all.push(...audit('era', [['type', 'Caboose']]));
    // state must be untouched by ASKING for counts
    apply([['manufacturer', 'lionel']]); const before = shown(); const fdRef = state.filteredData;
    const sig = JSON.stringify([state.filters, localStorage.getItem('lv_browse_filter_state'), state._collSection]);
    _openLevelPicker('type'); document.getElementById('ph-picker-overlay').remove();
    const untouched = (state.filteredData === fdRef) && sig === JSON.stringify([state.filters, localStorage.getItem('lv_browse_filter_state'), state._collSection]);
    reset();
    return { all, before, untouched, total: Object.keys(state.personalData).length };
  });

  T('no page errors while auditing', errs.join(' | '), '');
  T('the audit covered every level, bare and with other chips set', out.all.length > 80, true);
  const bad = out.all.filter(r => r.said !== r.got);
  bad.slice(0, 12).forEach(r => console.log('   MISMATCH  ' + r.level + ' ' + r.pre + '  "' + r.label + '"  said ' + r.said + ', picking it showed ' + r.got));
  T('EVERY number equals the rows shown after picking it', bad.length, 0);
  const find = (level, pre, starts) => out.all.find(r => r.level === level && r.pre === JSON.stringify(pre) && r.label.indexOf(starts) === 0) || {};
  T('Caboose, no other chip: 4 (two copies + stuck-type 6017 + Atlas)', find('type', [], 'Caboose').said, 4);
  T('Caboose with the Lionel chip on: 3 — the number FOLLOWS the chip', find('type', [['manufacturer', 'lionel']], 'Caboose').said, 3);
  T('a stuck stored "Boxcar" on a caboose is not counted as a boxcar', find('type', [['era', 'postwar']], 'Boxcar').got, find('type', [['era', 'postwar']], 'Boxcar').said);
  T('an own maker (Ertl) gets a real number', find('manufacturer', [], 'Ertl').said, 1);
  T('an option that would show nothing carries NO number', find('manufacturer', [], 'MTH').label, 'MTH');
  T('asking for counts changes no state and repaints nothing', out.untouched, true);
  // PROVE THE COMPARISON CAN FAIL: the old collection-wide figure, under a chip.
  const planted = out.all.map(r => (r.level === 'type' && r.pre !== '[]' && /^Caboose/.test(r.label)) ? Object.assign({}, r, { said: 4 }) : r);
  T('PLANTED: a collection-wide "Caboose (4)" under the Lionel chip is caught', planted.filter(r => r.said !== r.got).length > 0, true);

  await browser.close();
  console.log('\n' + (fail ? fail + ' FAILED, ' : '') + pass + ' passed' + (fail ? '' : ' — ALL GREEN'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
