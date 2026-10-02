#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LOCATION DETAIL SWITCH — v0.9.1865 + the import door v0.9.1866   (real Chromium, the REAL app, no stubs)
//
// Brad, 2026-10-02: "location and location details should be managed
// together. location details is under extra columns."
//
// THE DESIGN he said "go" to: Location Detail's switch leaves Extra Columns
// and sits directly under Track Storage Location in Preferences → Collection —
// "Track Location Detail" — greyed out until Location tracking is on, and off
// again when Location goes off. One Storage Locations → Manage keeps serving
// both levels. Adding the Location Detail column on either table still flips
// its switch (and turns Location on first, since a tote with no room is not
// an address). Nothing else changes.
//
// HOW it is built: the locationDetail entry in RR_USER_FIELDS (config.js)
// gained prefToggle 'locdetail' (its switch is a Preferences row, written
// through _prefSet so it follows the ACCOUNT — one route per key, so the key
// left look-sync) and requires { lv_location_enabled } — rrFieldEnabled says
// no while that is off, _ufToggle turns it on first, _onPrefChange('location',
// false) turns Detail off with it. Every check here presses the real control.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  location_detail_switch_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, got, want) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))); ok ? pass++ : fail++; }
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const code = s => s.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

async function open(browser, planted) {
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
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    localStorage.clear();
    const PW = 'Lionel PW - Items';
    const mk = (n, v, t) => ({ itemNum: n, variation: v, itemType: t, _era: 'pw', _tab: PW, yearProd: '1950', description: t + ' ' + n, roadName: '' });
    state.masterData = [mk('6457', '3', 'Caboose'), mk('6464', '1', 'Boxcar'), mk('2343', '1', 'Diesel')];
    _rebuildMasterIndex();
    let inv = 1;
    const pd = (n, v, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: 'pw', manufacturer: 'Lionel', inventoryId: String(inv++), row: inv + 1 }, x || {});
    state.personalData = {
      a: pd('6457', '3', { location: 'Basement', locationDetail: 'Tote 12' }),
      b: pd('6464', '1', { location: 'Garage' }),
      c: pd('2343', '1', {}),
    };
    state.forSaleData = { a: { inventoryId: '1', itemNum: '6457', variation: '3', askingPrice: '60', condition: '7', dateListed: '2026-09-01', row: 2 } };
    _currentEra = 'all';
    _prefLocEnabled = false;
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  });
  return { pg, errs };
}

// What the page says right now — the two switches, what the wizard would ask,
// what the account clock and the look clock hold.
const SNAP = () => {
  const el = id => document.getElementById(id);
  const loc = el('ptog-location'), det = el('ptog-locdetail'), row = el('pref-row-locdetail');
  const asked = Array.from(new DOMParser().parseFromString(_wizUserFieldsHtml({}), 'text/html').querySelectorAll('input[id^="wiz-uf-"]')).map(i => i.id.replace('wiz-uf-', ''));
  const f = RR_USER_FIELDS.filter(x => x.key === 'locationDetail')[0];
  return {
    loc: loc ? { checked: loc.checked, disabled: loc.disabled } : null,
    det: det ? { checked: det.checked, disabled: det.disabled, dim: row ? row.style.opacity === '0.5' : null } : null,
    stored: { location: localStorage.getItem('lv_location_enabled'), detail: localStorage.getItem('lv_locdetail_enabled') },
    stamped: { location: !!localStorage.getItem('lv_location_enabled__at'), detail: !!localStorage.getItem('lv_locdetail_enabled__at') },
    look: !!localStorage.getItem('rr_look_stamp'),
    enabled: rrFieldEnabled(f),
    asked,
    locFlag: !!_prefLocEnabled,
    toast: (document.getElementById('toast') || {}).textContent || '',
  };
};

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── A: Preferences — the row, its place, and the two switches together ────
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate((SNAP) => {
      const snap = eval('(' + SNAP + ')');
      const out = {};
      const fire = el => el.dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-prefs').classList.add('active');
      buildPrefsPage();
      const prefsEl = document.getElementById('prefs-content');
      out.rowOrder = Array.from(prefsEl.querySelectorAll('.pref-row-label strong')).map(s => s.textContent.trim()).filter(t => /Location|Sub Types|Extra Columns/.test(t));
      out.rowWords = (prefsEl.querySelector('#pref-row-locdetail .pref-row-label span') || {}).textContent || '';
      out.extraWords = Array.from(prefsEl.querySelectorAll('.pref-row-label')).filter(l => /Extra Columns/.test(l.textContent)).map(l => l.querySelector('span').textContent)[0] || '';
      out.manageButtons = prefsEl.querySelectorAll('button[onclick*="_openLocationsModal"]').length;
      out.field = (f => ({ prefToggle: f.prefToggle, requires: f.requires }))(RR_USER_FIELDS.filter(x => x.key === 'locationDetail')[0]);
      out.fresh = snap();
      // Extra Columns does not list it any more
      _openUserFieldsModal();
      out.extra = { detail: !!document.getElementById('uf-on-locationDetail'), rows: document.querySelectorAll('#uf-modal-overlay input[type=checkbox]').length, first: (document.querySelector('#uf-modal-overlay input[type=checkbox] + div strong') || {}).textContent };
      document.getElementById('uf-modal-overlay').remove();
      // the greyed switch cannot be thrown
      const det = document.getElementById('ptog-locdetail');
      det.click();
      out.clickWhileOff = snap();
      // Location on → the Detail switch wakes up, still off
      const loc = document.getElementById('ptog-location');
      loc.checked = true; fire(loc);
      out.locOn = snap();
      // Detail on — through the page's own handler
      det.checked = true; fire(det);
      out.detOn = snap();
      // Location off → Detail goes off with it, and says so
      loc.checked = false; fire(loc);
      out.locOff = snap();
      // Location on again → the Detail switch wakes up OFF (the cascade was a real write)
      loc.checked = true; fire(loc);
      out.locOnAgain = snap();
      return out;
    }, SNAP.toString());
    T('A: no page errors', errs.join(' | '), '');
    T('A: the rows, in order — Track Location Detail sits right under Track Storage Location; Extra Columns no longer names it',
      [r.rowOrder, /^Shipper, Sub-collection/.test(r.extraWords)],
      [['Track Storage Location', 'Track Location Detail', 'Storage Locations', 'Track Sub Types', 'Sub Types', 'Extra Columns'], true]);
    T('A: the row says what it is and what it needs', [/spot inside/.test(r.rowWords), /Needs Track Storage Location on/.test(r.rowWords)], [true, true]);
    T('A: ONE Storage Locations → Manage serves both levels', r.manageButtons, 1);
    T('A: the field declares its switch and what it requires, once, in config.js', r.field, { prefToggle: 'locdetail', requires: { pref: 'lv_location_enabled', toggle: 'location', label: 'Track Storage Location' } });
    T('A: fresh — both off; the Detail switch is greyed out and cannot be thrown; nothing asked',
      [r.fresh.det, r.fresh.stored, r.fresh.asked, r.clickWhileOff.stored.detail, r.clickWhileOff.det.checked],
      [{ checked: false, disabled: true, dim: true }, { location: null, detail: null }, [], null, false]);
    T('A: Extra Columns does not list it (one control per switch); seven rows left, Shipper first', r.extra, { detail: false, rows: 7, first: 'Shipper' });
    T('A: Location ON → the Detail switch wakes up, still off; the wizard asks for nothing extra yet',
      [r.locOn.det, r.locOn.stored, r.locOn.asked, r.locOn.locFlag], [{ checked: false, disabled: false, dim: false }, { location: 'true', detail: null }, [], true]);
    T('A: Detail ON through the page — written through _prefSet (stamped for the account, NOT the look clock); the field is enabled; the wizard asks (real renderer)',
      [r.detOn.stored, r.detOn.stamped, r.detOn.look, r.detOn.enabled, r.detOn.asked], [{ location: 'true', detail: 'true' }, { location: true, detail: true }, false, true, ['locationDetail']]);
    T('A: Location OFF → Detail goes off WITH it (a real write, stamped), its switch greys out, the wizard stops asking, and the toast says so',
      [r.locOff.stored, r.locOff.det, r.locOff.enabled, r.locOff.asked, r.locOff.locFlag, r.locOff.toast],
      [{ location: 'false', detail: 'false' }, { checked: false, disabled: true, dim: true }, false, [], false, 'Location Detail turned off too — nothing was deleted']);
    T('A: Location ON again → the Detail switch wakes up OFF', [r.locOnAgain.det, r.locOnAgain.stored.detail], [{ checked: false, disabled: false, dim: false }, 'false']);
    await pg.close();
  }

  // ── B: the column door, on both tables ───────────────────────────────────
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate((SNAP) => {
      const snap = eval('(' + SNAP + ')');
      const out = {};
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-prefs').classList.add('active');
      buildPrefsPage();                                   // so the switches are on screen while the table flips them
      out.before = snap();
      _collAddCol('locationDetail');                      // My Collection's + Add
      out.coll = Object.assign(snap(), { cols: _collVisibleCols() });
      // reset, then the same through the For Sale table
      _collDropCol('locationDetail'); _collDropCol('location');
      ['lv_location_enabled', 'lv_location_enabled__at', 'lv_locdetail_enabled', 'lv_locdetail_enabled__at', 'lv_coll_columns_seen_v1'].forEach(k => localStorage.removeItem(k));
      _prefLocEnabled = false; buildPrefsPage();
      out.reset = snap();
      rrTableAdd('forsale', 'locationDetail');
      out.fs = snap();
      // Location already on → adding Detail says only its own name
      ['lv_locdetail_enabled', 'lv_locdetail_enabled__at'].forEach(k => localStorage.removeItem(k));
      rrTableDrop('forsale', 'locationDetail');
      rrTableAdd('forsale', 'locationDetail');
      out.fsAgain = snap();
      // × leaves the switches alone
      rrTableDrop('forsale', 'locationDetail'); _collDropCol('locationDetail');
      out.afterDrop = snap().stored;
      return out;
    }, SNAP.toString());
    T('B: no page errors', errs.join(' | '), '');
    T('B: fresh — nothing on', [r.before.stored, r.before.asked], [{ location: null, detail: null }, []]);
    T('B: + Add Location Detail on My Collection turns BOTH switches on — through the Preferences doors (both stamped), the switches on screen follow, the wizard asks, the toast names both',
      [r.coll.stored, r.coll.stamped, r.coll.loc.checked, r.coll.det, r.coll.locFlag, r.coll.asked, r.coll.toast],
      [{ location: 'true', detail: 'true' }, { location: true, detail: true }, true, { checked: true, disabled: false, dim: false }, true, ['locationDetail'], 'Location Detail and Track Storage Location are on in Preferences — new items will ask for both']);
    T('B: …and the Location column joins the table with it (a switch turned on puts its column on, once)', [r.coll.cols.indexOf('location') > 0, r.coll.cols.indexOf('locationDetail') > 0], [true, true]);
    T('B: reset took', r.reset.stored, { location: null, detail: null });
    T('B: + Add Location Detail on For Sale does the same (ONE engine, one rule)', [r.fs.stored, r.fs.asked, r.fs.toast], [{ location: 'true', detail: 'true' }, ['locationDetail'], 'Location Detail and Track Storage Location are on in Preferences — new items will ask for both']);
    T('B: with Location already on, the toast names Detail alone', [r.fsAgain.stored, r.fsAgain.toast], [{ location: 'true', detail: 'true' }, 'Location Detail is on in Preferences — new items will ask for it']);
    T('B: × leaves both switches alone', r.afterDrop, { location: 'true', detail: 'true' });
    await pg.close();
  }

  // ── C: a device that had Detail on from before (Extra Columns / look-sync) ─
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate((SNAP) => {
      const snap = eval('(' + SNAP + ')');
      const out = {};
      const fire = el => el.dispatchEvent(new Event('change', { bubbles: true }));
      localStorage.setItem('lv_locdetail_enabled', 'true');     // raw, unstamped: how look-sync wrote it before v1865
      const f = RR_USER_FIELDS.filter(x => x.key === 'locationDetail')[0];
      out.legacy = { enabled: rrFieldEnabled(f), listed: rrEnabledUserFields().map(x => x.key), healed: localStorage.getItem('lv_locdetail_enabled__at') };
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-prefs').classList.add('active');
      buildPrefsPage();
      out.page = snap();
      const loc = document.getElementById('ptog-location');
      loc.checked = true; fire(loc);
      out.locOn = snap();
      return out;
    }, SNAP.toString());
    T('C: no page errors', errs.join(' | '), '');
    T('C: Detail "on" with Location off counts as OFF (a tote with no room is not an address) — and the first read stamps the key so the account hears it (v1825 heal)',
      r.legacy, { enabled: false, listed: [], healed: '0' });
    T('C: the page shows it greyed out and unticked, the wizard does not ask', [r.page.det, r.page.asked], [{ checked: false, disabled: true, dim: true }, []]);
    T('C: Location ON → the remembered Detail comes back on with it, and the wizard asks', [r.locOn.det, r.locOn.enabled, r.locOn.asked], [{ checked: true, disabled: false, dim: false }, true, ['locationDetail']]);
    await pg.close();
  }

  // ── D: one route per key ─────────────────────────────────────────────────
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate(() => {
      localStorage.setItem('lv_locdetail_enabled', 'true'); localStorage.setItem('lv_shipper_enabled', 'true');
      const keys = Object.keys(rrLookSnapshot().keys);
      return { inList: RR_LOOK_KEYS.indexOf('lv_locdetail_enabled'), snapHas: keys.indexOf('lv_locdetail_enabled'), shipperStill: keys.indexOf('lv_shipper_enabled') >= 0 };
    });
    T('D: no page errors', errs.join(' | '), '');
    T('D: lv_locdetail_enabled left look-sync (the account prefs file carries it now) — and since v1867 so did Shipper and every other small setting', r, { inList: -1, snapHas: -1, shipperStill: false });
    const prefs = code(rd('prefs.js')), wiz = code(rd('wizard.js')), browse = code(rd('browse.js'));
    T('D: nothing writes lv_locdetail_enabled raw any more', ['prefs.js', 'browse.js', 'wizard.js', 'import-ui.js', 'bulk-tag.js', 'look-sync.js'].filter(f => /localStorage\.setItem\('lv_locdetail_enabled'/.test(code(rd(f)))), []);
    T('D: the wizard\'s own "Ask for storage location" tick runs the same handler as the Preferences switch (so the cascade holds there too)',
      /id="wiz-loc-toggle"[\s\S]{0,300}_prefSet\('lv_location_enabled', this\.checked \? 'true' : 'false'\); if \(typeof _onPrefChange === 'function'\) _onPrefChange\('location', this\.checked\)/.test(wiz), true);
    T('D: the pairing is declared on the field (config.js) and read there — _onPrefChange and _ufToggle name no key of their own',
      [/f\.requires\.toggle !== id/.test(prefs), /_prefGet\(f\.requires\.pref, 'false'\) !== 'true'/.test(prefs), /lv_locdetail_enabled/.test(prefs.slice(prefs.indexOf('function _onPrefChange('))), /sw\.field\.requires\.label/.test(browse)],
      [true, true, false, true]);
    await pg.close();
  }

  // ── E: the import's door (v0.9.1866 — [stated] Brad: "yes on import") ─────
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate((SNAP) => {
      const snap = eval('(' + SNAP + ')');
      const out = {};
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-prefs').classList.add('active');
      buildPrefsPage();
      // a mapped Shipper column touches Shipper only
      out.shipper = Object.assign({ ret: _impAutoEnableFields({ Items: { 'Carton': 'shipper' } }) }, snap(), { shipperOn: localStorage.getItem('lv_shipper_enabled') });
      // a mapped Location column turns Track Storage Location on, through the Preferences door
      out.loc = Object.assign({ ret: _impAutoEnableFields({ Items: { 'Where': 'location', 'Item #': 'itemNum' } }) }, snap());
      // already on → nothing to do, and it says so
      out.locAgain = Object.assign({ ret: _impAutoEnableFields({ Items: { 'Where': 'location' } }) }, snap());
      // reset; a mapped Location Detail column turns BOTH on (through _ufToggle's requires rule)
      ['lv_location_enabled', 'lv_location_enabled__at', 'lv_locdetail_enabled', 'lv_locdetail_enabled__at', 'lv_shipper_enabled'].forEach(k => localStorage.removeItem(k));
      _prefLocEnabled = false; buildPrefsPage();
      out.det = Object.assign({ ret: _impAutoEnableFields({ Items: { 'Tote': 'locationDetail' } }) }, snap());
      // the write step calls it, once, with the import's mappings
      return out;
    }, SNAP.toString());
    T('E: no page errors', errs.join(' | '), '');
    T('E: a mapped Shipper column turns Shipper on and leaves Location alone', [r.shipper.ret, r.shipper.shipperOn, r.shipper.stored.location], [{ fields: ['shipper'], location: false }, 'true', null]);
    T('E: a mapped Location column turns Track Storage Location ON — stamped for the account, the live flag set, the switch on screen ticked, the Detail switch awake',
      [r.loc.ret, r.loc.stored, r.loc.stamped.location, r.loc.locFlag, r.loc.loc.checked, r.loc.det.disabled], [{ fields: [], location: true }, { location: 'true', detail: null }, true, true, true, false]);
    T('E: with Location already on, a mapped Location column changes nothing', [r.locAgain.ret, r.locAgain.stored], [{ fields: [], location: false }, { location: 'true', detail: null }]);
    T('E: a mapped Location Detail column turns BOTH on (Detail needs Location)', [r.det.ret, r.det.stored, r.det.asked], [{ fields: ['locationDetail'], location: false }, { location: 'true', detail: 'true' }, ['locationDetail']]);
    const imp = code(rd('import-ui.js'));
    T('E: the write step calls the one rule, once, with the import\'s mappings', (imp.match(/_impAutoEnableFields\(_imp\.mappings\)/g) || []).length, 1);
    T('E: the rule throws the Location switch through _prefSet + _onPrefChange, never raw', /_prefSet\('lv_location_enabled', 'true'\);\s*\n\s*if \(typeof _onPrefChange === 'function'\) _onPrefChange\('location', true\);/.test(imp) && !/localStorage\.setItem\('lv_location_enabled'/.test(imp), true);
    await pg.close();
  }

  // ── PLANTED 3: an import that forgets the Location switch ─────────────────
  {
    const src = rd('import-ui.js');
    const anchor = "  if (used.location && typeof _prefGet === 'function' && _prefGet('lv_location_enabled', 'false') !== 'true') {\n";
    T('PLANTED 3: the import\'s Location rule is in _impAutoEnableFields exactly once', src.split(anchor).length - 1, 1);
    const { pg } = await open(browser, { 'import-ui.js': src.replace(anchor, "  if (false) {\n") });
    const r = await pg.evaluate(() => { _impAutoEnableFields({ Items: { 'Where': 'location' } }); return { location: localStorage.getItem('lv_location_enabled') }; });
    T('PLANTED 3: a mapped Location column that leaves the switch off is caught', r, { location: null });
    await pg.close();
  }

  // ── PLANTED 1: a Location switch that forgets to take Detail with it ──────
  {
    const src = rd('prefs.js');
    const anchor = "        _prefSet(f.pref, 'false');\n";
    T('PLANTED 1: the cascade write is in _onPrefChange exactly once', src.split(anchor).length - 1, 1);
    const { pg } = await open(browser, { 'prefs.js': src.replace(anchor, '') });
    const r = await pg.evaluate(() => {
      const fire = el => el.dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-prefs').classList.add('active');
      buildPrefsPage();
      const loc = document.getElementById('ptog-location'), det = document.getElementById('ptog-locdetail');
      loc.checked = true; fire(loc); det.checked = true; fire(det);
      loc.checked = false; fire(loc);
      return { detail: localStorage.getItem('lv_locdetail_enabled') };
    });
    T('PLANTED 1: Location off leaving Detail "true" is caught', r, { detail: 'true' });
    await pg.close();
  }

  // ── PLANTED 2: a reader that ignores what the field requires ─────────────
  {
    const src = rd('config.js');
    const anchor = "    if (f.requires && rrPrefRead(f.requires.pref) !== 'true') return false;\n";
    T('PLANTED 2: the requires gate is in rrFieldEnabled exactly once', src.split(anchor).length - 1, 1);
    const { pg } = await open(browser, { 'config.js': src.replace(anchor, '') });
    const r = await pg.evaluate(() => {
      localStorage.setItem('lv_locdetail_enabled', 'true');
      return { asked: /wiz-uf-locationDetail/.test(_wizUserFieldsHtml({})), location: localStorage.getItem('lv_location_enabled') };
    });
    T('PLANTED 2: a wizard asking for the tote with no room is caught', r, { asked: true, location: null });
    await pg.close();
  }

  await browser.close();
  console.log('\n' + (fail ? fail + ' FAILED, ' : '') + pass + ' passed' + (fail ? '' : ' — ALL GREEN'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
