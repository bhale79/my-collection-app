#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// COLUMN-SWITCH TESTS — v0.9.1862   (real Chromium, the REAL app, no stubs)
//
// Brad, 2026-10-02, four screenshots of My Collection's column editor:
//   "when you add or subtract columns, the columns themselves don't update
//    correctly" … "it still doesn't update even when done editing them" …
//    "only when you click on something else does it refresh"
//   "if i add location and location detail here, it needs to update my
//    preferences"
//   "when i add existing columns or add custom columns, we need to make sure
//    we then add those to the add item questions"
//   "we need a pop up when you hover over these with a short description"
//   "[Custom 1,2,3] what are they and why do we need them if we have add
//    custom column button"
//
// THE RULES this holds, each pressed through the app's OWN buttons:
//   A  the rows follow the headings the moment the layout changes
//      (+ Add, ×, drag, Done, the old pop-up's Done and Reset)
//   B  adding a column flips its Preferences switch on, through the door
//      Preferences uses; removing it leaves the switch alone; a switch
//      turned on in Preferences puts the column on the table once
//   C  the add wizard asks a column that was added here (real renderer)
//   D  one sentence per column, the same words on the + Add menu, the
//      headings, Preferences → Extra Columns and the import
//   E  free custom slots fold into ONE "Spare column — name it…" entry
// and PLANTED OFFENDERS prove each check can fail (the old signature served
// in place of the real browse.js; a + Add that forgets the switch).
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  column_switch_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, got, want) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))); ok ? pass++ : fail++; }

const browseSrc = fs.readFileSync(path.join(APP, 'browse.js'), 'utf8');
const configSrc = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
const prefsSrc  = fs.readFileSync(path.join(APP, 'prefs.js'), 'utf8');
const impSrc    = fs.readFileSync(path.join(APP, 'import-ui.js'), 'utf8');

// One run of the real app with an optional planted script in place of the real one.
async function open(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const clean = u.split('?')[0];   // index.html loads every script as name.js?v=NNNN
    const name = Object.keys(planted || {}).find(k => clean.endsWith('/' + k));
    if (name) return r.fulfill({ body: planted[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    localStorage.clear();
    const PW = 'Lionel PW - Items';
    const mk = (n, v, t, era, tab, yr) => ({ itemNum: n, variation: v, itemType: t, _era: era, _tab: tab, yearProd: yr, description: t + ' ' + n, roadName: '' });
    state.masterData = [mk('6457', '3', 'Caboose', 'pw', PW, '1949'), mk('6464', '1', 'Boxcar', 'pw', PW, '1953'), mk('2343', '1', 'Diesel', 'pw', PW, '1950')];
    _rebuildMasterIndex();
    let inv = 1;
    const pd = (n, v, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: 'pw', manufacturer: 'Lionel', inventoryId: String(inv++), row: inv + 1 }, x || {});
    state.personalData = {
      a: pd('6457', '3', { roadName: 'Santa Fe', notes: 'runs well', location: 'Basement', locationDetail: 'Tote 12' }),
      b: pd('6464', '1', { roadName: 'Western Pacific' }),
      c: pd('2343', '1', { roadName: 'Santa Fe' }),
    };
    _currentEra = 'all';
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-browse').classList.add('active');
    filterOwned();
    _renderCollectionHeader();
    renderBrowse();
  });
  return { pg, errs };
}

// What the screen shows: the heading ids, and the cell ids of the first data row.
const READ = () => {
  const ths = Array.from(document.querySelectorAll('#page-browse .item-table thead th[data-col]')).map(t => t.getAttribute('data-col'));
  const tr = document.querySelector('#browse-tbody tr[data-item]');
  const tds = tr ? Array.from(tr.querySelectorAll('td[data-col]')).map(t => t.getAttribute('data-col')) : [];
  const cell = id => { const td = tr && tr.querySelector('td[data-col="' + id + '"]'); return td ? td.textContent.trim() : null; };
  return { ths, tds, same: JSON.stringify(ths) === JSON.stringify(tds), roadName: cell('roadName'), location: cell('location') };
};

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── A: the rows follow the headings ──────────────────────────────────────
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate((READ) => {
      const read = eval('(' + READ + ')');
      const out = {};
      out.start = read();
      // the ✎ on the Actions heading, then the real + Add menu entry
      document.querySelector('#page-browse thead th[data-col="actions"] button').click();
                                               out.editOn = read();         // ✎
      document.querySelector('#page-browse thead th[data-col="actions"] button').click();   // + Add
      document.querySelector('#rr-addcol .rr-addcol-item[onclick*="roadName"]').click();
                                               out.add = read();
      _collAddCol('notes');                    out.addInEdit = read();
      _collSetOrder(['notes', 'roadName', 'var', 'type', 'photo', 'desc', 'worth', 'added']);
                                               out.drag = read();           // a drop on the first heading
      document.querySelector('#page-browse thead th[data-col="notes"] button').click();
                                               out.drop = read();           // the × on the heading
      Array.from(document.querySelectorAll('#page-browse thead th[data-col="actions"] button')).pop().click();
                                               out.done = read();           // Done
      out.editOff = !state._collColEdit;
      // the old pop-up (still reachable): tick Year Made, Done; then Reset
      _openCollColumnsModal();
      const row = document.querySelector('#cc-list .cc-row[data-col="yearMade"] input'); row.checked = true;
      _collApplyCols();                        out.modal = read();
      _collResetCols();                        out.reset = read();
      return out;
    }, READ.toString());
    T('A: no page errors', errs.join(' | '), '');
    T('A: before anything, headings and cells agree', r.start.same, true);
    T('A: ✎ edit mode changes nothing in the rows', r.editOn.same, true);
    T('A: + Add a column (the real menu entry) — the rows have it the same instant', [r.add.same, r.add.tds.indexOf('roadName') > 0], [true, true]);
    T('A: …and the new cell shows the row’s own value', r.add.roadName, 'Santa Fe');
    T('A: a second + Add while editing', [r.addInEdit.same, r.addInEdit.tds.indexOf('notes') > 0], [true, true]);
    T('A: drag to reorder — the cells take the new order', [r.drag.same, r.drag.tds[2]], [true, 'notes']);
    T('A: the × on a heading removes it from the rows too', [r.drop.same, r.drop.tds.indexOf('notes')], [true, -1]);
    T('A: Done leaves them agreeing, and edit mode is off', [r.done.same, r.editOff], [true, true]);
    T('A: the old pop-up’s Done', [r.modal.same, r.modal.tds.indexOf('yearMade') > 0], [true, true]);
    T('A: Reset to default', [r.reset.same, r.reset.tds.length], [true, 9]);
    await pg.close();
  }

  // ── A, PLANTED: browse.js with the layout term taken back out of the check ─
  {
    const anchor = "(typeof _collVisibleCols === 'function' ? _collVisibleCols().join(',') : '')";
    T('PLANTED A: the layout term is in the signature exactly once', browseSrc.split(anchor).length - 1, 1);
    const old = browseSrc.replace(anchor, "''");
    const { pg } = await open(browser, { 'browse.js': old });
    const r = await pg.evaluate((READ) => { const read = eval('(' + READ + ')'); _collAddCol('roadName'); return read(); }, READ.toString());
    T('PLANTED A: with the term gone, + Add leaves the rows a column short (v1861 reproduced)', [r.ths.indexOf('roadName') > 0, r.tds.indexOf('roadName')], [true, -1]);
    await pg.close();
  }

  // ── B + C: the switch rule, through the real doors ────────────────────────
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate(() => {
      const out = {};
      const on = k => localStorage.getItem(k) === 'true';
      // what the add wizard's details step would ask right now — the REAL renderer
      const asked = () => Array.from(new DOMParser().parseFromString(_wizUserFieldsHtml({}), 'text/html').querySelectorAll('input[id^="wiz-uf-"]')).map(i => i.id.replace('wiz-uf-', ''));
      out.before = { locdetail: on('lv_locdetail_enabled'), location: on('lv_location_enabled'), asked: asked(), locFlag: !!_prefLocEnabled };
      _collAddCol('location');
      out.afterLocation = { location: on('lv_location_enabled'), at: !!localStorage.getItem('lv_location_enabled__at'), locFlag: !!_prefLocEnabled, locdetail: on('lv_locdetail_enabled') };
      // v0.9.1865: Location Detail's switch is its own Preferences row now, under
      // Track Storage Location and needing it — so from a fresh start + Add
      // Location Detail turns BOTH on (location_detail_switch_tests has the
      // whole story; this pins the door My Collection uses).
      _collDropCol('location');
      ['lv_location_enabled', 'lv_location_enabled__at', 'lv_coll_columns_seen_v1'].forEach(k => localStorage.removeItem(k)); _prefLocEnabled = false;
      _collAddCol('locationDetail');
      out.afterDetail = { locdetail: on('lv_locdetail_enabled'), location: on('lv_location_enabled'), asked: asked(), enabled: rrEnabledUserFields().map(f => f.key), stamp: !!localStorage.getItem('lv_locdetail_enabled__at'), locFlag: !!_prefLocEnabled };
      _collDropCol('locationDetail'); _collDropCol('location');
      out.afterDrop = { locdetail: on('lv_locdetail_enabled'), location: on('lv_location_enabled'), cols: _collVisibleCols() };
      // a column with no switch touches nothing
      const keysBefore = Object.keys(localStorage).filter(k => /_enabled$/.test(k)).sort().join(',');
      _collAddCol('roadName');
      out.noSwitch = Object.keys(localStorage).filter(k => /_enabled$/.test(k)).sort().join(',') === keysBefore;
      // the other direction: Preferences turns Track Storage Location on → the column arrives, once
      localStorage.removeItem('lv_coll_columns_v1'); localStorage.removeItem('lv_coll_columns_seen_v1'); localStorage.removeItem('lv_location_enabled');
      out.rev0 = _collVisibleCols().indexOf('location');
      _prefSet('lv_location_enabled', 'true'); _onPrefChange('location', true);     // what the Preferences toggle runs
      out.rev1 = _collVisibleCols().indexOf('location') > 0;
      out.rev1again = _collVisibleCols().indexOf('location') > 0;   // v1864: and on the NEXT read (it used to vanish with no saved layout)
      _collDropCol('location');
      out.rev2 = _collVisibleCols().indexOf('location');                             // stays hidden: the offer was made once
      out.rev2on = on('lv_location_enabled');
      // the old pop-up ticks go through the same rule
      localStorage.removeItem('lv_shipper_enabled');
      _openCollColumnsModal();
      document.querySelector('#cc-list .cc-row[data-col="shipper"] input').checked = true;
      _collApplyCols();
      out.modalSwitch = on('lv_shipper_enabled');
      return out;
    });
    T('B: no page errors', errs.join(' | '), '');
    T('B: fresh start — nothing on, nothing asked', [r.before.locdetail, r.before.location, r.before.asked, r.before.locFlag], [false, false, [], false]);
    T('B: + Add Location turns Track Storage Location ON through _prefSet (stamped) and the live flag — and Location alone leaves Detail off', [r.afterLocation.location, r.afterLocation.at, r.afterLocation.locFlag, r.afterLocation.locdetail], [true, true, true, false]);
    T('B: + Add Location Detail turns its Preferences switch ON — and Track Storage Location with it (v1865: it needs it)', [r.afterDetail.locdetail, r.afterDetail.location, r.afterDetail.locFlag], [true, true, true]);
    T('C: …and the add wizard now asks for it (the real renderer)', r.afterDetail.asked, ['locationDetail']);
    T('B: …through the Preferences door: it is an enabled field, stamped for the account (v1865; the look clock is a layout matter here — location_detail_switch_tests pins "not the look")', [r.afterDetail.enabled, r.afterDetail.stamp], [['locationDetail'], true]);
    T('B: × leaves both switches alone', [r.afterDrop.locdetail, r.afterDrop.location, r.afterDrop.cols.indexOf('location')], [true, true, -1]);
    T('B: a column with no switch (Road Name) touches no switch', r.noSwitch, true);
    T('B: Preferences → Track Storage Location ON puts the Location column on the table — and it is still there on the next read', [r.rev0, r.rev1, r.rev1again], [-1, true, true]);
    T('B: …once — hiding it afterwards is remembered, and the switch stays on', [r.rev2, r.rev2on], [-1, true]);
    T('B: the old pop-up’s ticks flip the switch too', r.modalSwitch, true);
    await pg.close();
  }

  // ── B, PLANTED: a + Add that forgets the switch ───────────────────────────
  {
    const anchor = "  onAdd: _collSwitchOn,                                    // v1862: the column's Preferences switch comes on with it\n";
    T('PLANTED B: + Add calls the switch rule exactly once (the table registers it)', browseSrc.split(anchor).length - 1, 1);
    const { pg } = await open(browser, { 'browse.js': browseSrc.replace(anchor, '') });
    const r = await pg.evaluate(() => { _collAddCol('locationDetail'); return { on: localStorage.getItem('lv_locdetail_enabled') === 'true', asked: /wiz-uf-locationDetail/.test(_wizUserFieldsHtml({})) }; });
    T('PLANTED B: a + Add that forgets the switch is caught (column shown, never asked)', r, { on: false, asked: false });
    await pg.close();
  }

  // ── D + E: one sentence per column, everywhere; spare slots fold ──────────
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate(() => {
      const out = {};
      // every column the table can show has words
      out.missing = _collAllCols().map(c => c.col).filter(id => !_collColHelp(id));
      // the + Add menu (desktop): hover title = the words; no line under the name
      window.IS_MOBILE_UA = false;
      _collAddColMenu();
      let items = Array.from(document.querySelectorAll('#rr-addcol .rr-addcol-item'));
      out.menuDesk = items.map(b => ({ name: b.firstChild.textContent.trim(), title: b.title, line: !!b.querySelector('.rr-addcol-help') }));
      document.getElementById('rr-addcol').remove();
      // the + Add menu (phone): the same words as a line under the name
      window.IS_MOBILE_UA = true;
      _collAddColMenu();
      items = Array.from(document.querySelectorAll('#rr-addcol .rr-addcol-item'));
      out.menuPhone = items.map(b => ({ title: b.title, line: (b.querySelector('.rr-addcol-help') || {}).textContent || '' }));
      document.getElementById('rr-addcol').remove();
      window.IS_MOBILE_UA = false;
      // the headings
      _renderCollectionHeader();
      const th = id => (document.querySelector('#page-browse .item-table thead th[data-col="' + id + '"]') || {}).title || '';
      out.thWorth = th('worth'); out.thPhoto = th('photo'); out.thMfr = th('mfr');
      _collColEdit(true); out.thEditDesc = th('desc'); out.thEditNum = th('num'); _collColEdit(false);
      // Preferences → Extra Columns
      _openUserFieldsModal();
      out.prefsDetail = (document.querySelector('#uf-modal-overlay .uf-help') || {}).textContent || '';
      out.prefsRows = document.querySelectorAll('#uf-modal-overlay .uf-help').length;
      document.getElementById('uf-modal-overlay').remove();
      // the words themselves
      out.words = { subCollection: rrFieldHelp('subCollection'), locationDetail: rrFieldHelp('locationDetail'), shipper: rrFieldHelp('shipper'), spare: rrFieldHelp('custom1'), subType: rrFieldHelp('subType') };
      // E: spare slots fold into one entry; a named one shows under its name
      _collAddColMenu();
      const names = () => Array.from(document.querySelectorAll('#rr-addcol .rr-addcol-item')).map(b => b.firstChild.textContent.trim());
      out.spare1 = names();
      document.getElementById('rr-addcol').remove();
      rrTagClaimCustom('custom2', 'Owner');            // what "+ Custom column" does
      out.namedJoined = _collVisibleCols().indexOf('custom2') > 0;   // v1585: a named slot joins the table by itself
      _collDropCol('custom2');                         // take it off so the menu can offer it back
      state.personalData.b.custom4 = 'x';              // a slot holding data is not spare
      _collAddColMenu(); out.spare2 = names(); document.getElementById('rr-addcol').remove();
      out.namedHelp = rrFieldHelp('custom2');
      // the import panel reads the same words
      out.imp = { detail: _impFieldHelp('locationDetail') === rrFieldHelp('locationDetail'), yourDesc: _impFieldHelp('yourDesc') === rrFieldHelp('yourDescription'), grade: _impFieldHelp('rawGrade') === rrFieldHelp('yourGrade'), photo: /photo file/i.test(_impFieldHelp('photoFile')), keys: _impHelpKeys() };
      // no sentence says "AI" (product rule)
      out.ai = Object.keys(RR_FIELD_HELP).filter(k => /\bAI\b/.test(RR_FIELD_HELP[k]));
      return out;
    });
    T('D: no page errors', errs.join(' | '), '');
    T('D: every column the table can show has a sentence', r.missing, []);
    T('D: desktop + Add menu — every entry carries its sentence on hover, no line under the name',
      [r.menuDesk.length > 5, r.menuDesk.every(m => m.title.length > 20), r.menuDesk.some(m => m.line)], [true, true, false]);
    T('D: phone + Add menu — the same sentence sits under the name', r.menuPhone.every(m => m.line === m.title && m.line.length > 20), true);
    T('D: the Sub-collection entry says what it is', r.menuDesk.find(m => m.name === 'Sub-collection').title, r.words.subCollection);
    T('D: a heading says what its column is and how to sort', [r.thWorth.indexOf(rrWords('userEstWorth')) === 0, /Click to sort by Est\. Worth\./.test(r.thWorth)], [true, true]);
    T('D: a heading that does not sort just says what it is', r.thPhoto, rrWords('photoItem'));
    T('D: the locked Maker heading too', r.thMfr.indexOf(rrWords('manufacturer')) === 0, true);
    T('D: in edit mode the sentence stays and says how to move it', [r.thEditDesc.indexOf(rrWords('description')) === 0, /Drag to move it/.test(r.thEditDesc), /Drag/.test(r.thEditNum)], [true, true, false]);
    T('D: Preferences → Extra Columns shows the same sentence (first row is Shipper — v1865 moved Location Detail to its own row; 7 rows)', [r.prefsDetail, r.prefsRows], [r.words.shipper, 7]);
    T('D: the words answer Brad’s questions', [/own groups/.test(r.words.subCollection), /spot inside/.test(r.words.locationDetail), /spare column/i.test(r.words.spare), /finer sort/.test(r.words.subType)], [true, true, true, true]);
    T('D: the import reads the same words (aliases included) and keeps its photo-file line', [r.imp.detail, r.imp.yourDesc, r.imp.grade, r.imp.photo, r.imp.keys.indexOf('custom1') > 0, r.imp.keys.indexOf('custom2')], [true, true, true, true, true, -1]);
    T('D: no sentence says "AI"', r.ai, []);
    T('E: five free slots fold into ONE spare entry', [r.spare1.filter(n => /^Custom \d$/.test(n)), r.spare1.filter(n => /Spare column/.test(n)).length, r.spare1.find(n => /Spare column/.test(n))], [[], 1, '＋ Spare column — name it… (5 left)']);
    T('E: a slot named through "+ Custom column" joins the table on its own (v1585)', r.namedJoined, true);
    T('E: taken off again, it is offered back under its NAME; a slot holding data shows as itself; 3 spares left', [r.spare2.indexOf('Owner') > 0, r.spare2.indexOf('Custom 4') > 0, r.spare2.find(n => /Spare column/.test(n))], [true, true, '＋ Spare column — name it… (3 left)']);
    T('E: the named slot’s sentence names it', /“Owner”/.test(r.namedHelp), true);
    await pg.close();
  }

  // ── source rules: one copy of the words; the spare rule has one owner ─────
  T('SRC: the import no longer keeps its own list of the words', /var _IMP_FIELD_HELP = \{/.test(impSrc), false);
  T('SRC: the import reads rrFieldHelp', /rrFieldHelp\(key\)/.test(impSrc), true);
  T('SRC: Preferences → Extra Columns reads rrFieldHelp', /rrFieldHelp\(f\.key\)/.test(prefsSrc), true);
  T('SRC: the words live in config.js, once', configSrc.split('window.RR_FIELD_HELP = {').length - 1, 1);
  T('SRC: "is this custom slot free" has ONE rule (bulk-tag.js), and + Add asks it (v1867: the name is read through the account reader)', [/rrTagCustomIsFree\(c\.pdKey\)/.test(browseSrc), (fs.readFileSync(path.join(APP, 'bulk-tag.js'), 'utf8').match(/rrPrefRead\('lv_label_' \+ key\)/g) || []).length], [true, 1]);
  T('SRC: the Extra Columns door is the one My Collection uses', /_ufToggle\(sw\.field\.key, true, \{ quiet: true \}\)/.test(browseSrc) && /function _ufToggle\(key, on, opts\)/.test(prefsSrc), true);
  T('SRC: Location goes through _prefSet + _onPrefChange, never a raw write', /_prefSet\(sw\.pref, 'true'\)/.test(browseSrc) && /_onPrefChange\('location', true\)/.test(browseSrc), true);

  await browser.close();
  console.log('\n' + (fail ? fail + ' FAILED, ' : '') + pass + ' passed' + (fail ? '' : ' — ALL GREEN'));
  process.exit(fail ? 1 : 0);

  function rrWords(key) {   // the sentence as config.js holds it (node side)
    const m = configSrc.match(new RegExp("^\\s*" + key + ":\\s*'((?:[^'\\\\]|\\\\.)*)',", 'm'));
    return m ? eval("'" + m[1] + "'") : '';
  }
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
