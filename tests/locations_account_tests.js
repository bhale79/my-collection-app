#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// STORAGE LOCATIONS — the spots inside, and the list following the account (v0.9.1937)
//
// [stated] Brad (2026-10-13): "on managing storage locations, i can't set up or
// manage location detail like i can storage locations. this is the sub type of
// storage locations so like downstairs closest, tote 2 or whatever".
// The spots inside a place WERE manageable — by clicking the place's name beside
// a tiny arrow, which nothing said. And the whole list was written raw to one
// device, so a list built on the computer was empty on the phone. He said yes to:
//   1. a plain "Spots inside" button on every place;
//   2. Preferences → Location Details → Manage, like Sub Types — the SAME screen;
//   3. the list follows the account, and lists already built on two devices are
//      COMBINED, never one thrown away.
//   N1–N4  the one reader / the one writer (config.js), and no raw write left
//   C1–C5  rrLocationsUnion — two lists combined
//   M1–M7  rrPrefsMerge with the union rule (the real function from drive.js)
//   L1–L2  _prefsLocalState offers an old, never-stamped list to the merge
//   B1–B5  the real screen in Chromium
//   P1–P3  PLANTED offenders — each must turn its check red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const CFG = rd('config.js'), DRIVE = rd('drive.js'), PREFS = rd('prefs.js');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }
const code = s => s.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
const grab = (src, sig) => { const i = src.indexOf(sig); if (i < 0) throw new Error('missing ' + sig); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && !--d) return src.slice(i, k + 1); } };

// ── N: one reader, one writer ────────────────────────────────────────────────
function rig(cfgSrc) {
  const store = {}, sets = [];
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = {};
  const _prefGet = (k, d) => (k in store ? store[k] : d);
  const _prefSet = (k, v) => { sets.push(k); store[k] = String(v); store[k + '__at'] = String(Date.now()); };
  const body = ['var RR_LOCATIONS_KEY = \'lv_saved_locations\';',
    grab(cfgSrc, 'window.rrSavedLocations = function'), grab(cfgSrc, 'window.rrSaveLocations = function'),
    grab(cfgSrc, 'window.rrLocationsUnion = function')].join(';\n');
  new Function('window', 'localStorage', '_prefGet', '_prefSet', body)(win, ls, _prefGet, _prefSet);
  return { win, store, sets };
}
{
  const r = rig(CFG);
  r.win.rrSaveLocations([{ name: ' Downstairs ', type: 'Room', details: ['Closet'] }, { name: '' }, 'Garage']);
  const back = r.win.rrSavedLocations();
  T('N1 the writer stores through _prefSet (stamped, so it follows the account)', r.sets.join() === 'lv_saved_locations' && !!r.store['lv_saved_locations__at'], r);
  T('N2 …trims names, drops blanks, keeps the spots inside, and the reader gives the same list back',
    JSON.stringify(back) === JSON.stringify([{ name: 'Downstairs', type: 'Room', details: ['Closet'] }, { name: 'Garage', type: '', details: [] }]), back);
}
{
  // every write of the key in app/ goes through the one writer
  const rawWrites = (srcOf) => {
    const offenders = [];
    fs.readdirSync(APP).filter(f => f.endsWith('.js')).forEach(f => {
      const c = code(srcOf(f));
      const re = /localStorage\.setItem\(\s*(['"]lv_saved_locations['"]|RR_LOCATIONS_KEY)/g; let m;
      while ((m = re.exec(c))) {
        const inWriter = f === 'config.js' && grab(CFG, 'window.rrSaveLocations = function').indexOf(c.slice(m.index, m.index + 42)) >= 0;
        if (!inWriter) offenders.push(f + ':' + c.slice(m.index, m.index + 60));
      }
    });
    return offenders;
  };
  const offenders = rawWrites(rd);
  const plantedRaw = rawWrites(f => f === 'wizard.js' ? rd(f) + "\nfunction _x(){ localStorage.setItem('lv_saved_locations', '[]'); }\n" : rd(f));
  T('P4 PLANTED: a raw write added in wizard.js is caught by N3', plantedRaw.length === 1 && /^wizard\.js:/.test(plantedRaw[0]), plantedRaw);
  T('N3 nothing in app/ writes the saved locations raw (only rrSaveLocations\' own no-_prefSet fallback)', offenders.length === 0, offenders);
  T('N4 the Storage Locations screen reads and writes through the one reader / writer',
    /function _getSavedLocations\(\)\{ return \(typeof rrSavedLocations === 'function'\) \? rrSavedLocations\(\) : \[\]; \}/.test(PREFS)
    && /function _setSavedLocations\(arr\)\{ if \(typeof rrSaveLocations === 'function'\) rrSaveLocations\(arr \|\| \[\]\); \}/.test(PREFS)
    && !/lv_saved_locations/.test(code(PREFS)));
}

// ── C: two lists combined ────────────────────────────────────────────────────
{
  const U = rig(CFG).win.rrLocationsUnion;
  const J = JSON.stringify;
  const pc = [{ name: 'Downstairs', type: 'Room', details: ['Closet', 'Tote 2'] }, { name: 'Garage', type: 'Building', details: [] }];
  const phone = [{ name: 'downstairs ', type: '', details: ['tote 2', 'Shelf 1'] }, { name: 'Storage Unit 4', type: 'Storage Unit', details: ['Rack A'] }];
  const both = JSON.parse(U(J(pc), J(phone)));
  T('C1 every place from both, matched by name ignoring case and spaces; the account\'s order first',
    J(both.map(l => l.name)) === J(['Downstairs', 'Garage', 'Storage Unit 4']), both);
  T('C2 …the spots inside combined the same way (Tote 2 once, Shelf 1 added)', J(both[0].details) === J(['Closet', 'Tote 2', 'Shelf 1']), both[0]);
  T('C3 …a type is kept, a blank one never wipes it', both[0].type === 'Room' && both[2].type === 'Storage Unit', both);
  T('C4 an unreadable side never costs the other its list', U('not json', J(phone)) === J(phone) && U(J(pc), '{oops') === J(pc));
  T('C5 an old list with no spots at all still combines', J(JSON.parse(U(J([{ name: 'Basement' }]), J([{ name: 'Basement', details: ['Tote 9'] }])))) === J([{ name: 'Basement', type: '', details: ['Tote 9'] }]));
}

// ── M: the merge (the real function) ─────────────────────────────────────────
const mergeOf = src => new Function("const PREF_AT_SUFFIX = '__at';\n" + grab(src, 'function rrPrefsMerge(') + '\nreturn rrPrefsMerge;')();
const unions = { lv_saved_locations: rig(CFG).win.rrLocationsUnion };
const K = 'lv_saved_locations';
const A = JSON.stringify([{ name: 'Downstairs', type: 'Room', details: ['Closet'] }]);
const B = JSON.stringify([{ name: 'Garage', type: 'Building', details: ['Tote 2'] }]);
function mergeChecks(merge, tag) {
  const out = {};
  // M1 the first device to sync seeds the account
  out.m1 = merge({ [K]: A }, { [K]: '0' }, {}, 1000, unions, {});
  // M2 the second device, with its own list, meets the account's
  out.m2 = merge({ [K]: B }, { [K]: '0' }, { [K]: { v: A, t: 1000 } }, 2000, unions, {});
  // M3 the same list on both: nothing written
  out.m3 = merge({ [K]: A }, { [K]: '0' }, { [K]: { v: A, t: 1000 } }, 2000, unions, {});
  // M4/M5 after they have met, a removal sticks
  const AB = JSON.parse(out.m2.push[K] ? out.m2.push[K].v : '[]');
  const onlyB = JSON.stringify(AB.filter(l => l.name !== 'Downstairs'));
  out.m4 = merge({ [K]: onlyB }, { [K]: '3000' }, { [K]: { v: JSON.stringify(AB), t: 2000 } }, 3100, unions, { [K]: true });
  out.m5 = merge({ [K]: JSON.stringify(AB) }, { [K]: '2000' }, { [K]: { v: onlyB, t: 3000 } }, 3200, unions, { [K]: true });
  // M6 a fresh device (signed out, list cleared) takes the account's
  out.m6 = merge({}, {}, { [K]: { v: A, t: 1000 } }, 4000, unions, {});
  // M7 other settings unchanged: newest wins, no union
  out.m7 = merge({ lv_theme: 'dark' }, { lv_theme: '500' }, { lv_theme: { v: 'light', t: 90 } }, 5000, unions, {});
  return out;
}
{
  const r = mergeChecks(mergeOf(DRIVE));
  T('M1 the first device seeds the account with its list, and remembers it has met', r.m1.push[K] && r.m1.push[K].v === A && r.m1.push[K].t === 1000 && r.m1.apply[K + '__met'] === '1', r.m1);
  const both = r.m2.apply[K] ? JSON.parse(r.m2.apply[K]).map(l => l.name) : [];
  T('M2 the second device KEEPS its own list and gets the account\'s too — both sides end with both',
    JSON.stringify(both) === '["Downstairs","Garage"]' && r.m2.push[K] && r.m2.push[K].v === r.m2.apply[K] && r.m2.apply[K + '__at'] === '2000' && r.m2.apply[K + '__met'] === '1', r.m2);
  T('M3 the same list on both → nothing pushed', !r.m3.push[K] && r.m3.apply[K] === A, r.m3);
  T('M4 once met, a removal on one device is pushed as it is (no union brings it back)', r.m4.push[K] && !/Downstairs/.test(r.m4.push[K].v), r.m4);
  T('M5 …and the other device takes the removal', r.m5.apply[K] && !/Downstairs/.test(r.m5.apply[K]) && !r.m5.push[K], r.m5);
  T('M6 a device with no list takes the account\'s', r.m6.apply[K] === A && r.m6.apply[K + '__met'] === '1', r.m6);
  T('M7 every other setting: newest wins, as before', r.m7.push.lv_theme && r.m7.push.lv_theme.v === 'dark' && !r.m7.apply.lv_theme, r.m7);
  // the older callers (no unions passed) behave exactly as before
  const old = mergeOf(DRIVE)({ [K]: B }, { [K]: '0' }, { [K]: { v: A, t: 1000 } }, 2000);
  T('M8 called without the union list (older tests, older callers) the merge is the plain newest-wins one', old.apply[K] === A && !old.push[K], old);
}

// ── L: an old never-stamped list reaches the merge ───────────────────────────
function localStateOf(src, store) {
  const keys = Object.keys(store);
  const ls = { length: keys.length, key: i => keys[i], getItem: k => (k in store ? store[k] : null) };
  return new Function('localStorage', 'window', "const PREF_AT_SUFFIX = '__at';\n" + grab(src, 'function _prefsLocalState(') + '\nreturn _prefsLocalState();')(ls, { RR_PREF_UNION: unions });
}
{
  const st = localStateOf(DRIVE, { lv_saved_locations: B, lv_theme: 'dark', lv_theme__at: '5' });
  T('L1 a list written before v1937 (no stamp) is offered to the merge, scored 0 — never silently overwritten', st.local[K] === B && st.stamps[K] === '0' && !st.met[K], st);
  const st2 = localStateOf(DRIVE, { lv_saved_locations: B, lv_saved_locations__at: '77', lv_saved_locations__met: '1' });
  T('L2 a list that has met the account keeps its stamp and is marked met', st2.stamps[K] === '77' && st2.met[K] === true, st2);
  T('L3 the sync hands both to the merge', /rrPrefsMerge\(st\.local, st\.stamps, got\.prefs, Date\.now\(\), \(window\.RR_PREF_UNION \|\| \{\}\), st\.met\)/.test(DRIVE));
}

// ── P1/P2 planted, Node side ─────────────────────────────────────────────────
{
  const noUnion = DRIVE.replace("if (typeof unions[k] === 'function' && !met[k]) {", 'if (false) {');
  if (noUnion === DRIVE) throw new Error('could not plant P1');
  const r = mergeChecks(mergeOf(noUnion));
  T('P1 PLANTED: without the union rule the second device\'s list is thrown away — M2 would fail',
    r.m2.apply[K] === A && !r.m2.push[K], r.m2);
  const noOffer = DRIVE.replace("if (v !== null) { local[k] = v; stamps[k] = '0'; }", '');
  if (noOffer === DRIVE) throw new Error('could not plant P2');
  const st = localStateOf(noOffer, { lv_saved_locations: B });
  T('P2 PLANTED: without offering the unstamped list, the merge never sees it — L1 would fail', !(K in st.local), st);
}

// ── B: the real screen ───────────────────────────────────────────────────────
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAIL  —  locations_account_tests needs playwright and it is not installed.'); process.exit(1); }
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
    window.rrPrefsQueuePush = function () {};          // no Drive here
    localStorage.setItem('lv_saved_locations', JSON.stringify([{ name: 'Downstairs', type: 'Room', details: ['Closet', 'Tote 2'] }, { name: 'Garage', type: 'Building' }]));
    state.personalData = {};
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  });
  return { pg, errs };
}
const SHOT = () => {
  const m = document.getElementById('loc-setup-modal');
  return {
    open: !!m,
    spots: Array.from(document.querySelectorAll('#loc-list [data-loc-spots]')).map(b => { const r = b.getBoundingClientRect(); return { text: b.textContent, vis: r.width > 0 && r.height > 0, expanded: b.getAttribute('aria-expanded') }; }),
    inputs: Array.from(document.querySelectorAll('#loc-list input[id^="loc-det-new-"]')).map(i => i.id),
    intro: m ? (m.querySelector('div[style*="line-height:1.5"]') || {}).textContent : '',
  };
};
(async () => {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    { const { pg, errs } = await open(browser);
      const r = await pg.evaluate((SHOT) => {
        const shot = eval('(' + SHOT + ')'); const out = {};
        _openLocationsModal();
        out.first = shot();
        document.querySelector('#loc-list [data-loc-spots="1"]').click();
        out.afterClick = shot();
        const inp = document.getElementById('loc-det-new-1'); inp.value = 'Tote 7';
        document.querySelector('#loc-list [data-locdet-add="1"]').click();
        out.saved = JSON.parse(localStorage.getItem('lv_saved_locations'));
        out.stamped = Number(localStorage.getItem('lv_saved_locations__at') || 0) > 0;   // a real change time (a bare read stamps 0)
        document.getElementById('loc-close').click();
        // Preferences → Location Details → Manage
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-prefs').classList.add('active');
        buildPrefsPage();
        const row = Array.from(document.querySelectorAll('#prefs-content .pref-row')).find(r => /^Location Details/.test((r.querySelector('strong') || {}).textContent || ''));
        out.row = !!row;
        if (row) row.querySelector('button').click();
        out.spotsView = shot();
        return out;
      }, SHOT.toString());
      T('B1 every place shows a plain "Spots inside" button — the count when it has spots, "+ Add spots inside" when not',
        JSON.stringify(r.first.spots) === JSON.stringify([{ text: 'Spots inside (2) ▾', vis: true, expanded: 'false' }, { text: '+ Add spots inside', vis: true, expanded: 'false' }]) && r.first.inputs.length === 0, r.first);
      T('B1 …and the words at the top say where the spots are', /Spots inside/.test(r.first.intro), r.first.intro);
      T('B2 pressing it opens that place\'s spots, ready to type one', JSON.stringify(r.afterClick.inputs) === '["loc-det-new-1"]' && r.afterClick.spots[1].text === 'Hide spots ▴', r.afterClick);
      T('B3 a spot added there is saved under its place — through _prefSet, so it follows the account',
        JSON.stringify(r.saved[1]) === JSON.stringify({ name: 'Garage', type: 'Building', details: ['Tote 7'] }) && r.stamped, r);
      T('B4 Preferences has a Location Details row; its Manage opens the same screen with every place\'s spots showing',
        r.row && r.spotsView.open && JSON.stringify(r.spotsView.inputs) === '["loc-det-new-0","loc-det-new-1"]' && /spots inside each place/.test(r.spotsView.intro), r.spotsView);
      T('B5 no page errors', errs.length === 0, errs); }

    // P3 planted: the screen writing raw again
    { const raw = PREFS.replace("function _setSavedLocations(arr){ if (typeof rrSaveLocations === 'function') rrSaveLocations(arr || []); }",
                                "function _setSavedLocations(arr){ localStorage.setItem('lv_saved_locations', JSON.stringify(arr || [])); }");
      if (raw === PREFS) throw new Error('could not plant P3');
      const { pg } = await open(browser, { 'prefs.js': raw });
      const stamped = await pg.evaluate(() => {
        _openLocationsModal(); document.querySelector('#loc-list [data-loc-spots="1"]').click();
        document.getElementById('loc-det-new-1').value = 'Tote 7'; document.querySelector('#loc-list [data-locdet-add="1"]').click();
        return Number(localStorage.getItem('lv_saved_locations__at') || 0) > 0;
      });
      T('P3 PLANTED: a raw write leaves the change on this device only — B3 would fail', stamped === false, stamped);
      await pg.close(); }
  } finally { await browser.close(); }
  console.log('\nlocations_account_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.stack); process.exit(1); });
