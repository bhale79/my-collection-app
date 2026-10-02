#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PREFERENCES CONTROLS — v0.9.1814 (the S10 audit, as a gate)   (real Chromium, the REAL app, no stubs)
//
// Roadmap Tier 1 #1 / release readiness S10: "walk every toggle, every
// dropdown, every button on the Preferences page. Turn it on → confirm the
// claimed behaviour fires. Turn it off → confirm it stops."
//
// Every control here is driven through the SAME handler the page's markup
// calls (the onchange text in buildPrefsPage), then the effect is read off
// the page — a class on <body>, a style on <html>, a hidden banner, the
// number of rows a list draws. A control that is read into a variable and
// never used is a dead switch, and section B says so by name.
//
// Section C is the sync rule (v1779/v1793): a preference the page offers
// must reach the account, so nothing may write it with a raw
// localStorage.setItem — that write stays on this device.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  prefs_controls_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const code = s => s.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);

  const out = await pg.evaluate(async () => {
    const res = {};
    const PW = 'Lionel PW - Items';
    const mk = (n, v, t) => ({ itemNum: n, variation: v, itemType: t, _era: 'pw', _tab: PW, yearProd: '1950', description: t + ' ' + n, roadName: '' });
    state.masterData = []; for (let i = 0; i < 70; i++) state.masterData.push(mk(String(6000 + i), '1', 'Boxcar'));
    _rebuildMasterIndex();
    state.personalData = {}; let inv = 1;
    for (let i = 0; i < 70; i++) state.personalData['k' + i] = { owned: true, itemNum: String(6000 + i), variation: '1', era: 'pw', manufacturer: 'Lionel', inventoryId: String(inv++), row: inv + 1, condition: i % 2 ? '6' : '8' };
    state.upgradeData = {};
    _currentEra = 'all';
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    const show = id => { document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); document.getElementById(id).classList.add('active'); };

    // ── the page itself builds ───────────────────────────────────────
    show('page-prefs'); buildPrefsPage();
    const prefsEl = document.getElementById('prefs-content');
    res.built = !!prefsEl && prefsEl.innerHTML.length > 2000;
    const ctl = sel => prefsEl.querySelector(sel);
    const fire = (el) => { el.dispatchEvent(new Event('change', { bubbles: true })); };

    // 1 theme — the select's own onchange
    const themeSel = ctl('select[onchange*="lv_theme"]');
    const cssVar = () => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    themeSel.value = 'dark'; fire(themeSel); const bgDark = cssVar();
    themeSel.value = 'light'; fire(themeSel); const bgLight = cssVar();
    res.theme = { has: !!themeSel, bgDark, bgLight, changed: bgDark !== bgLight && !!bgLight };
    themeSel.value = 'dark'; fire(themeSel);

    // 2 font scale
    const fsSel = ctl('select[onchange*="setFontScale"]');
    const fsz = () => document.documentElement.style.fontSize || getComputedStyle(document.documentElement).fontSize;
    fsSel.value = 'normal'; fire(fsSel); const fN = fsz();
    fsSel.value = 'large'; fire(fsSel); const fL = fsz();
    res.font = { has: !!fsSel, fN, fL, changed: fN !== fL };
    fsSel.value = 'normal'; fire(fsSel);

    // 3 compact
    const cmp = document.getElementById('ptog-compact');
    cmp.checked = true; fire(cmp); const cOn = document.body.classList.contains('compact-mode');
    cmp.checked = false; fire(cmp); const cOff = document.body.classList.contains('compact-mode');
    res.compact = { has: !!cmp, on: cOn, off: cOff };

    // 4 disclaimer — the banner on the catalog page
    const dis = document.getElementById('ptog-disclaimer');
    const banner = () => { const d = document.getElementById('disclaimer-browse'); return d ? getComputedStyle(d).display : 'missing'; };
    dis.checked = false; fire(dis); const dOff = banner();
    dis.checked = true; fire(dis); const dOn = banner();
    res.disclaimer = { has: !!dis, off: dOff, on: dOn, works: dOff === 'none' && dOn !== 'none' };

    // 5 location — the wizard reads _prefLocEnabled
    const loc = document.getElementById('ptog-location');
    loc.checked = true; fire(loc); const lOn = !!window._prefLocEnabled;
    loc.checked = false; fire(loc); const lOff = !!window._prefLocEnabled;
    res.location = { has: !!loc, on: lOn, off: lOff };

    // 5c Track Location Detail (v0.9.1865) — greyed out until Location is on,
    // off again when Location goes off; the wizard's real renderer follows
    const ld = document.getElementById('ptog-locdetail');
    const ldAsk = () => /wiz-uf-locationDetail/.test(_wizUserFieldsHtml({}));
    const ldFresh = { disabled: ld.disabled, checked: ld.checked };
    loc.checked = true; fire(loc);
    const ldWoke = { disabled: ld.disabled, checked: ld.checked };
    ld.checked = true; fire(ld);
    const ldOn = { on: localStorage.getItem('lv_locdetail_enabled'), at: !!localStorage.getItem('lv_locdetail_enabled__at'), asks: ldAsk() };
    loc.checked = false; fire(loc);
    const ldCascade = { on: localStorage.getItem('lv_locdetail_enabled'), disabled: ld.disabled, checked: ld.checked, asks: ldAsk() };
    res.locdetail = { has: !!ld, fresh: ldFresh, woke: ldWoke, on: ldOn, cascade: ldCascade };

    // 5b Track Sub Types (v0.9.1863) — the wizard's real renderer asks, or not
    const st = document.getElementById('ptog-subtype');
    st.checked = true; fire(st); const sOn = /wiz-uf-subType/.test(_wizUserFieldsHtml({}));
    const sAt = !!localStorage.getItem('lv_subtype_enabled__at');
    st.checked = false; fire(st); const sOff = /wiz-uf-subType/.test(_wizUserFieldsHtml({}));
    res.subtype = { has: !!st, on: sOn, off: sOff, stamped: sAt, manage: !!ctl('button[onclick*="_openSubTypesModal"]') };

    // 6 page size — rows the collection list draws
    const ps = ctl('select[onchange*="lv_page_size"]');
    const rowsDrawn = () => { show('page-browse'); filterOwned(); window._rrBrowseSig = null; renderBrowse(); return document.querySelectorAll('#browse-tbody tr, .rr-coll-row').length; };
    ps.value = '25'; fire(ps); const r25 = rowsDrawn();
    ps.value = '50'; fire(ps); const r50 = rowsDrawn();
    res.pageSize = { has: !!ps, r25, r50, works: r25 > 0 && r25 <= 25 && r50 > r25 };
    show('page-prefs'); buildPrefsPage();

    // 7 upgrade threshold — "Flag items below this condition": the REAL
    // Upgrade Targets card, rendered with the threshold at 7 then at 5.
    // 35 owned items are condition 6, 35 are condition 8; none is on the
    // upgrade list, so what the card flags is the threshold's doing alone.
    const ut = document.getElementById('pref-upgrade-thresh');
    const card = (PANEL_CATALOG || []).filter(c => c.id === 'upgrades')[0];
    const flags = () => { const h = card.render(state); return { flagged: (h.match(/at or below your/g) || []).length, empty: /No upgrade targets yet/.test(h) }; };
    ut.value = '7'; fire(ut); const t7 = flags();
    ut.value = '5'; fire(ut); const t5 = flags();
    ut.value = '7'; fire(ut);
    res.upgradeThresh = { has: !!ut, t7, t5, works: t7.flagged > 0 && t7.flagged <= DASH_LIST_MAX && t5.flagged === 0 && t5.empty };

    // 8 default condition + the four wizard defaults: a reader exists for each key the control writes
    const keys = ['lv_default_cond', 'lv_def_hasBox', 'lv_def_hasIS', 'lv_def_isError', 'lv_def_allOriginal', 'lv_def_masterBox'];
    res.defaults = keys.map(k => ({ k, control: !!ctl('[onchange*="' + k + '"]') }));

    // 9 clear cache
    localStorage.setItem('lv_personal_cache', '{"x":1}'); localStorage.setItem('lv_personal_cache_ts', '1');
    const cc = ctl('button[onclick*="_clearCacheOnly"]');
    if (typeof _clearCacheOnly === 'function') _clearCacheOnly();
    res.clearCache = { has: !!cc, gone: localStorage.getItem('lv_personal_cache') === null };

    // 10 custom column on/off → the column joins the collection list
    const uf = (window.RR_USER_FIELDS || []).filter(f => f.custom)[0];
    localStorage.removeItem(uf.pref); localStorage.removeItem('lv_label_' + uf.key); localStorage.removeItem('lv_coll_columns_seen_v1'); localStorage.removeItem('lv_coll_columns_v1');
    const colsNow = () => (typeof _collVisibleCols === 'function' ? _collVisibleCols() : (typeof _collCols === 'function' ? _collCols() : [])).map(c => c.col || c);
    const before = colsNow().length;
    _ufToggle(uf.key, true);
    const after = colsNow().length;
    res.userField = { key: uf.key, before, after, joins: after === before + 1, enabled: typeof rrFieldEnabled === 'function' && rrFieldEnabled(uf) };
    _ufToggle(uf.key, false);

    res.errs = [];
    return res;
  });
  await browser.close();

  console.log('== A · each control does what its label says (real page, real handlers) ==');
  T('A0  the Preferences page builds', out.built);
  T('A1  Theme: dark → light changes the page colours', out.theme.has && out.theme.changed, out.theme);
  T('A2  Text size: normal → large changes the page font size', out.font.has && out.font.changed, out.font);
  T('A3  Compact mode: on adds body.compact-mode, off removes it', out.compact.has && out.compact.on && !out.compact.off, out.compact);
  T('A4  Accuracy disclaimer: off hides the catalog banner, on shows it', out.disclaimer.has && out.disclaimer.works, out.disclaimer);
  T('A5  Location field: on/off reaches the wizard\'s flag', out.location.has && out.location.on && !out.location.off, out.location);
  T('A5c Track Location Detail: greyed out until Location is on; on → stamped for the account and the wizard asks; Location off → it goes off too and greys out',
    out.locdetail.has && out.locdetail.fresh.disabled && !out.locdetail.fresh.checked && !out.locdetail.woke.disabled && !out.locdetail.woke.checked
    && out.locdetail.on.on === 'true' && out.locdetail.on.at && out.locdetail.on.asks
    && out.locdetail.cascade.on === 'false' && out.locdetail.cascade.disabled && !out.locdetail.cascade.checked && !out.locdetail.cascade.asks, out.locdetail);
  T('A5b Track Sub Types: on → the wizard asks (real renderer), off → it stops; stamped for the account; Manage beside it', out.subtype.has && out.subtype.on && !out.subtype.off && out.subtype.stamped && out.subtype.manage, out.subtype);
  T('A6  Items per page: 25 draws ≤25 rows, 50 draws more', out.pageSize.has && out.pageSize.works, out.pageSize);
  T('A7  Clear cache: the personal cache is gone afterwards', out.clearCache.has && out.clearCache.gone, out.clearCache);
  T('A7b Upgrade threshold: at 7 the card FLAGS the condition-6 items (capped at the row limit); at 5 it flags none and says so', out.upgradeThresh.has && out.upgradeThresh.works, out.upgradeThresh);
  out.defaults.forEach(d => T('A8  ' + d.k + ': the page has the control', d.control));
  T('A9  Custom column: switching it on adds the column to My Collection', out.userField.joins && out.userField.enabled, out.userField);

  console.log('\n== B · every key a control writes is READ AND USED somewhere ==');
  const files = fs.readdirSync(APP).filter(f => /\.js$/.test(f) && f !== 'prefs.js' && f !== 'tests-onboarding.js');
  const all = files.map(f => [f, code(rd(f))]);
  const readers = k => all.filter(([f, s]) => s.indexOf(k) >= 0).map(([f]) => f);
  const CONTROL_KEYS = ['lv_theme', 'lv_font_scale', 'lv_compact_mode', 'lv_show_disclaimer', 'lv_location_enabled', 'lv_locdetail_enabled', 'lv_subtype_enabled', 'lv_page_size',
    'lv_default_cond', 'lv_upgrade_thresh', 'lv_def_hasBox', 'lv_def_hasIS', 'lv_def_isError', 'lv_def_allOriginal', 'lv_def_masterBox'];
  CONTROL_KEYS.forEach(k => T('B  ' + k + ' has a reader outside prefs.js', readers(k).length > 0, readers(k)));
  // the value must be USED, not just read into a variable: the variable named
  // at the read must appear again in the same function body.
  function usedAfterRead(file, key) {
    const s = code(rd(file));
    const i = s.indexOf(key); if (i < 0) return null;
    const line = s.slice(s.lastIndexOf('\n', i) + 1, s.indexOf('\n', i));
    const m = line.match(/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/);
    if (!m) return true;                       // not assigned to a local — used inline
    const name = m[1];
    // walk to the end of the enclosing function: count braces from the read
    let d = 0, k = i, started = false;
    for (; k < s.length; k++) { if (s[k] === '{') { d++; started = true; } else if (s[k] === '}') { d--; if (started && d < 0) break; } }
    const rest = s.slice(s.indexOf('\n', i), k);
    return new RegExp('\\b' + name.replace(/\$/g, '\\$') + '\\b').test(rest);
  }
  T('B  lv_upgrade_thresh ("Flag items below this condition") is USED by the dashboard card, not just read',
    usedAfterRead('dashboard.js', 'lv_upgrade_thresh') === true, 'dashboard.js reads it into `thresh` and never uses it');

  console.log('\n== C · a preference the page offers reaches the account (no raw writes) ==');
  const rawWrites = k => all.concat([['prefs.js', code(rd('prefs.js'))]]).filter(([f, s]) => new RegExp("localStorage\\.setItem\\('" + k + "'").test(s)).map(([f]) => f);
  T('C1  lv_location_enabled is never written raw (the wizard\'s own toggle must go through _prefSet too)',
    rawWrites('lv_location_enabled').length === 0, rawWrites('lv_location_enabled'));
  const uf = code(rd('prefs.js'));
  const ufToggle = uf.slice(uf.indexOf('function _ufToggle('), uf.indexOf('function _ufRename('));
  T('C1b lv_subtype_enabled is never written raw (v0.9.1863: _ufToggle routes a prefToggle field through _prefSet)',
    rawWrites('lv_subtype_enabled').length === 0 && /if \(f\.prefToggle\) \{[\s\S]{0,900}rrPrefWrite\(f\.pref, on \? 'true' : 'false'\)/.test(ufToggle), rawWrites('lv_subtype_enabled'));
  T('C1c lv_locdetail_enabled is never written raw (v0.9.1865: its own Preferences row, through _prefSet; left look-sync)',
    rawWrites('lv_locdetail_enabled').length === 0 && !/lv_locdetail_enabled/.test(code(rd('look-sync.js'))), rawWrites('lv_locdetail_enabled'));
  // v0.9.1867: every field's on/off follows the ACCOUNT (rrPrefWrite → _prefSet,
  // newest per setting); look-sync's all-or-nothing file carries only the big
  // pictures now — so _ufToggle must NOT touch its clock any more.
  T('C2  a custom column\'s on/off travels by the account: _ufToggle writes through rrPrefWrite and never touches the look clock',
    (ufToggle.match(/rrPrefWrite\(f\.pref, on \? 'true' : 'false'\)/g) || []).length === 2 && !/rrLookTouch\(\)/.test(ufToggle), ufToggle.slice(0, 200));
  T('C3  lv_theme is never written raw', rawWrites('lv_theme').length === 0, rawWrites('lv_theme'));

  T('E1  no page errors', errs.length === 0, errs);
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
