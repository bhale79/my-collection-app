#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// SUB TYPE TRACKING — v0.9.1863   (real Chromium, the REAL app, no stubs)
//
// Brad, 2026-10-02: "sub type probably need to be set up like location where
// you can create different types." Release 2 of the column-editor brainstorm.
//
// THE DESIGN he said "go" to: Preferences → Collection gets "Track Sub Types"
// (a switch like Track Storage Location) and "Sub Types — Manage" (a list like
// Storage Locations). When it is on, the add wizard asks — the list as tap
// chips plus a free-text box, Next to skip — the item page and edit panel show
// it, the column shows it, and the Sub Type filter filters by it. The paper
// sections keep their built-in choices.
//
// HOW it is built: Sub Type is a USER FIELD (RR_USER_FIELDS, config.js), so
// the wizard, the save, the item page, the edit panel, the column's switch
// and the import follow the one definition. Its switch is written through
// _prefSet (it follows the ACCOUNT, like Location's), and so is the list.
// Every check here presses the real control or runs the real renderer.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  subtype_tracking_tests needs playwright and it is not installed.'); process.exit(1); }
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
      a: pd('6457', '3', { subType: 'Postwar reissue' }),
      b: pd('6464', '1', { subType: 'postwar REISSUE' }),                                  // same word, other case
      c: pd('2343', '1', { subType: 'Repaint' }),
      p: pd('CAT-1955-001', '', { itemType: 'Catalog', subType: 'Consumer Postwar' }),      // a paper section's own word
      i: pd('6457-IS', '', { subType: 'Operating' }),                                        // an instruction sheet
    };
    _currentEra = 'all';
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  });
  return { pg, errs };
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── A: Preferences — the switch and the manager, through the real page ───
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate(() => {
      const out = {};
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-prefs').classList.add('active');
      buildPrefsPage();
      const prefsEl = document.getElementById('prefs-content');
      const tog = document.getElementById('ptog-subtype');
      out.hasToggle = !!tog;
      out.hasManage = !!prefsEl.querySelector('button[onclick*="_openSubTypesModal"]');
      out.rowOrder = Array.from(prefsEl.querySelectorAll('.pref-row-label strong')).map(s => s.textContent.trim()).filter(t => /Storage Location|Sub Types|Track/.test(t));
      const f = RR_USER_FIELDS.filter(x => x.key === 'subType')[0];
      out.field = { pref: f.pref, choices: f.choices, prefToggle: f.prefToggle };
      // the switch, through the page's own handler
      tog.checked = true; tog.dispatchEvent(new Event('change', { bubbles: true }));
      out.on = { v: localStorage.getItem('lv_subtype_enabled'), at: !!localStorage.getItem('lv_subtype_enabled__at'), enabled: rrFieldEnabled(f), listed: rrEnabledUserFields().map(x => x.key) };
      // Extra Columns does NOT offer it a second time
      _openUserFieldsModal();
      out.extraCols = Array.from(document.querySelectorAll('#uf-modal-overlay strong, #uf-modal-overlay input[type=text]')).map(e => e.textContent || e.value).filter(t => /Sub Type/.test(t)).length;
      out.extraRows = document.querySelectorAll('#uf-modal-overlay input[type=checkbox]').length;
      document.getElementById('uf-modal-overlay').remove();
      tog.checked = false; tog.dispatchEvent(new Event('change', { bubbles: true }));
      out.off = { v: localStorage.getItem('lv_subtype_enabled'), listed: rrEnabledUserFields().map(x => x.key) };

      // the manager
      _openSubTypesModal();
      const box = () => document.getElementById('st-new-name');
      const names = () => Array.from(document.querySelectorAll('#st-list strong')).map(s => s.textContent.trim());
      out.empty = /No sub types yet/.test(document.getElementById('st-list').textContent);
      box().value = ' Operating car '; document.getElementById('st-add-btn').click();
      box().value = 'Repaint'; box().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      out.added = { names: names(), saved: rrSavedSubTypes(), at: !!localStorage.getItem('lv_saved_subtypes__at'), boxCleared: box().value };
      box().value = 'repaint'; document.getElementById('st-add-btn').click();
      out.dup = rrSavedSubTypes();
      document.querySelector('#st-list [data-st-del="0"]').click();
      out.removed = { names: names(), saved: rrSavedSubTypes() };
      document.getElementById('st-seed-btn').click();
      out.seeded = rrSavedSubTypes();
      // "Put items here" hands the word to the fill-a-column flow
      document.querySelector('#st-list [data-st-fill="0"]').click();
      out.fill = { modalGone: !document.getElementById('st-setup-modal'), setup: !!document.getElementById('rr-tag-setup'), field: (document.getElementById('rr-tag-field') || {}).value, value: (document.getElementById('rr-tag-value') || {}).value };
      const su = document.getElementById('rr-tag-setup'); if (su) su.remove();
      return out;
    });
    T('A: no page errors', errs.join(' | '), '');
    T('A: Preferences → Collection has the Track Sub Types switch and the Sub Types — Manage button', [r.hasToggle, r.hasManage], [true, true]);
    T('A: …beside Storage Locations, in that order (v1865: Track Location Detail sits between Location and its Manage)', r.rowOrder, ['Track Storage Location', 'Track Location Detail', 'Storage Locations', 'Track Sub Types', 'Sub Types']);
    T('A: Sub Type is a user field whose switch is that toggle', r.field, { pref: 'lv_subtype_enabled', choices: 'subtypes', prefToggle: 'subtype' });
    T('A: the switch ON — written through _prefSet (stamped), the field is enabled and listed', r.on, { v: 'true', at: true, enabled: true, listed: ['subType'] });
    T('A: Extra Columns does not list it a second time (one control per switch); the seven others still there (v1865: Location Detail has its own row too)', [r.extraCols, r.extraRows], [0, 7]);
    T('A: the switch OFF', r.off, { v: 'false', listed: [] });
    T('A: the manager starts empty', r.empty, true);
    T('A: Add (button) and Enter both add; trimmed; stored through _prefSet (stamped); the box clears', r.added, { names: ['Operating car', 'Repaint'], saved: ['Operating car', 'Repaint'], at: true, boxCleared: '' });
    T('A: a duplicate in another case is refused', r.dup, ['Operating car', 'Repaint']);
    T('A: × removes one', r.removed, { names: ['Repaint'], saved: ['Repaint'] });
    T('A: "+ Add from items I already entered" reads the TRAIN rows only — one spelling per word, no paper word, no instruction sheet', r.seeded, ['Repaint', 'Postwar reissue']);
    T('A: "Put items here" opens the fill-a-column flow with Sub Type and the word already answered', r.fill, { modalGone: true, setup: true, field: 'subType', value: 'Repaint' });
    await pg.close();
  }

  // ── B: the add wizard asks it — chips + free text, remembered ────────────
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate(() => {
      const out = {};
      rrSaveSubTypes(['Repaint', 'Postwar reissue']);
      out.offHtml = /wiz-uf-subType/.test(_wizUserFieldsHtml({}));
      _prefSet('lv_subtype_enabled', 'true');
      const host = document.createElement('div'); document.body.appendChild(host);
      wizard.data = {};
      host.innerHTML = _wizUserFieldsHtml(wizard.data);
      const chips = () => Array.from(host.querySelectorAll('#wiz-chips-subType .wiz-choice-chip'));
      out.drawn = { box: !!host.querySelector('#wiz-uf-subType'), chips: chips().map(c => c.textContent), lit: chips().filter(c => c.style.background.indexOf('--accent') > 0).length, order: Array.from(host.querySelectorAll('label')).map(l => l.textContent) };
      // tap a chip — the REAL onclick
      chips()[1].click();
      out.tapped = { data: wizard.data.subType, box: host.querySelector('#wiz-uf-subType').value, lit: chips().filter(c => c.style.background.indexOf('--accent') > 0).map(c => c.textContent) };
      // type a new one — oninput keeps wizard.data, onchange remembers it
      const inp = host.querySelector('#wiz-uf-subType');
      inp.value = 'Weathered'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      out.typedLit = chips().filter(c => c.style.background.indexOf('--accent') > 0).length;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      out.typed = { data: wizard.data.subType, saved: rrSavedSubTypes(), chips: chips().map(c => c.textContent), lit: chips().filter(c => c.style.background.indexOf('--accent') > 0).map(c => c.textContent) };
      // what the save would write — the real reader every save site spreads in
      out.saveOn = _rrUserFieldValues({ subType: ' Repaint ', notes: 'x' });
      out.saveBlank = _rrUserFieldValues({ subType: '' });
      _prefSet('lv_subtype_enabled', 'false');
      out.saveOff = _rrUserFieldValues({ subType: 'Repaint' });
      // the edit panel: with the switch on the user-field loop draws it (and the manual-only box steps aside)
      _prefSet('lv_subtype_enabled', 'true');
      out.panelOn = _rrSubTypeIsUserField();
      _prefSet('lv_subtype_enabled', 'false');
      out.panelOff = _rrSubTypeIsUserField();
      host.remove();
      return out;
    });
    T('B: no page errors', errs.join(' | '), '');
    T('B: with the switch off the wizard does not ask', r.offHtml, false);
    T('B: with it on — the box, the saved list as chips (none lit yet), after Sub-collection’s place in the list', [r.drawn.box, r.drawn.chips, r.drawn.lit, r.drawn.order], [true, ['Repaint', 'Postwar reissue'], 0, ['Sub Type']]);
    T('B: tapping a chip answers the question and fills the box; that chip is lit', r.tapped, { data: 'Postwar reissue', box: 'Postwar reissue', lit: ['Postwar reissue'] });
    T('B: typing something else un-lights the chips as you type', r.typedLit, 0);
    T('B: a typed sub type is remembered on change — a chip for it appears, lit', r.typed, { data: 'Weathered', saved: ['Repaint', 'Postwar reissue', 'Weathered'], chips: ['Repaint', 'Postwar reissue', 'Weathered'], lit: ['Weathered'] });
    T('B: the save carries it (trimmed) when on, drops a blank, and never when off', [r.saveOn, r.saveBlank, r.saveOff], [{ subType: 'Repaint' }, {}, {}]);
    T('B: the edit panel’s one question — is Sub Type drawn by the user-field loop?', [r.panelOn, r.panelOff], [true, false]);
    await pg.close();
  }

  // ── C: the column and the import follow the one definition ───────────────
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate(() => {
      const out = {};
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-browse').classList.add('active');
      filterOwned(); _renderCollectionHeader(); renderBrowse();
      _collAddCol('subType');
      out.addCol = { v: localStorage.getItem('lv_subtype_enabled'), at: !!localStorage.getItem('lv_subtype_enabled__at'), asked: /wiz-uf-subType/.test(_wizUserFieldsHtml({})), cell: (document.querySelector('#browse-tbody tr[data-item="6457"] td[data-col="subType"]') || {}).textContent };
      _collDropCol('subType');
      localStorage.removeItem('lv_coll_columns_v1'); localStorage.removeItem('lv_coll_columns_seen_v1'); _prefSet('lv_subtype_enabled', 'false');
      out.rev0 = _collVisibleCols().indexOf('subType');
      _prefSet('lv_subtype_enabled', 'true');          // the Preferences toggle's door
      out.rev1 = _collVisibleCols().indexOf('subType') > 0;
      // the Sub Type filter already there (v1799) sees the words
      _openLevelPicker('subType');
      out.picker = Array.from(document.querySelectorAll('#ph-picker-overlay button')).map(b => b.textContent.replace(/\s*\(\d+\)\s*$/, '').trim()).filter(t => t !== 'Cancel');
      const ov = document.getElementById('ph-picker-overlay'); if (ov) ov.remove();
      // the import
      // (one header per field — so the two spellings are asked in two calls)
      out.imp = { label: _IMP_FIELD_LABELS.subType, help: _impFieldHelp('subType') === rrFieldHelp('subType'),
                  map: Object.assign({}, rrImpHeuristicMap(['Item Number', 'Sub Type', 'Type']).map, rrImpHeuristicMap(['Item Number', 'Subtype']).map) };
      out.help = rrFieldHelp('subType');
      return out;
    });
    T('C: no page errors', errs.join(' | '), '');
    T('C: + Add Sub Type on My Collection flips Track Sub Types through _prefSet; the wizard asks; the cell shows the row’s word', r.addCol, { v: 'true', at: true, asked: true, cell: 'Postwar reissue' });
    T('C: Track Sub Types ON in Preferences puts the column on the table', [r.rev0, r.rev1], [-1, true]);
    T('C: the Sub Type filter lists the words on the rows', r.picker.filter(t => /Repaint|reissue/i.test(t)).length >= 2, true);
    T('C: the import offers it as a destination, shares the sentence, and maps "Sub Type" / "Subtype" headers (not "Type")', [r.imp.label, r.imp.help, r.imp.map['sub type'], r.imp.map['subtype'], r.imp.map['type'] === 'subType'], ['Sub Type', true, 'subType', 'subType', false]);
    T('C: the sentence points at Preferences → Sub Types', /Preferences → Sub Types/.test(r.help), true);
    await pg.close();
  }

  // ── PLANTED: a _ufToggle that writes this switch raw is caught ───────────
  {
    const src = rd('prefs.js');
    const i = src.indexOf('  if (f.prefToggle) {'), j = src.indexOf('  try { localStorage.setItem(f.pref, on ? \'true\' : \'false\'); } catch (e) {}', i);
    T('PLANTED: the account-door branch of _ufToggle is where expected', i > 0 && j > i, true);
    const old = src.slice(0, i) + src.slice(j);
    const { pg } = await open(browser, { 'prefs.js': old });
    const r = await pg.evaluate(() => { _ufToggle('subType', true); return { v: localStorage.getItem('lv_subtype_enabled'), at: !!localStorage.getItem('lv_subtype_enabled__at') }; });
    T('PLANTED: without that branch the switch is on but unstamped — it would never reach the account', r, { v: 'true', at: false });
    await pg.close();
  }

  // ── source rules ─────────────────────────────────────────────────────────
  const files = fs.readdirSync(APP).filter(f => /\.js$/.test(f));
  const raw = k => files.filter(f => new RegExp("localStorage\\.setItem\\('" + k + "'").test(code(rd(f))));
  T('SRC: lv_subtype_enabled is never written raw — _prefSet only (it follows the account)', raw('lv_subtype_enabled'), []);
  T('SRC: the saved list is written in ONE place (config.js, rrSaveSubTypes → _prefSet)', [raw('lv_saved_subtypes'), (code(rd('config.js')).match(/_prefSet\(RR_SUBTYPES_KEY/g) || []).length], [[], 1]);
  T('SRC: look-sync does not carry the switch as well — one route per key', /lv_subtype_enabled/.test(rd('look-sync.js')), false);
  T('SRC: the import’s write loop reads RR_USER_FIELDS, not a hand list', /\(window\.RR_USER_FIELDS \|\| \[\]\)\.map\(function \(f\) \{ return f\.key; \}\)\s*\n\s*\.forEach/.test(rd('import-ui.js')) && !/\['locationDetail', 'shipper', 'subCollection', 'custom1'/.test(rd('import-ui.js')), true);
  T('SRC: the import’s auto-enable goes through _ufToggle', /_ufToggle\(f\.key, true, \{ quiet: true \}\)/.test(rd('import-ui.js')), true);
  T('SRC: the edit panel offers the saved list and the manual-only box steps aside', /suggest === 'subtypes' && typeof rrSavedSubTypes === 'function'/.test(rd('app-collection.js')) && /&& !_rrSubTypeIsUserField\(\) \? \[\{ label: 'Sub Type'/.test(rd('app-collection.js')), true);
  T('SRC: the paper sections’ own sub types are untouched (their save still writes _uniSubType)', /subType: _uniSubType,/.test(rd('wizard-save.js')), true);
  T('SRC: the Sub Types manager is guarded like every overlay', /modal\.id = 'st-setup-modal';[\s\S]{0,2200}rrDismissGuard\(modal\);/.test(rd('prefs.js')), true);

  await browser.close();
  console.log('\n' + (fail ? fail + ' FAILED, ' : '') + pass + ' passed' + (fail ? '' : ' — ALL GREEN'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
