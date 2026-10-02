// ═══════════════════════════════════════════════════════════════════════════
// Feature tabs are NOT collection tabs — v0.9.1426, rebuilt v0.9.1861
//
// This exact bug has now shipped FOUR times, each time in the same shape:
// a FEATURE creates a tab on the user's personal sheet, nobody adds it to the
// guard lists, and the app files it as one of the user's own collection tabs.
//
//   (earlier)  — 'Parts Needed'
//   v0.9.794   — 'Contacts'     → appeared in My Collection as "Contactss"
//   v0.9.1426  — 'Barcode Map'  → got a Show chip beside Trains/Catalogs, and
//                was parsed by parseEphemeraRows (a paper-item parser), which
//                put the UPC in title, the item number in description, the
//                maker in year, and a date serial in manufacturer.
//   v0.9.1861  — 'Deleted Rows' → [stated] Brad, 2026-10-02: a "Deleted Rowss"
//                chip listing two cleared service-history rows as items —
//                title = a timestamp, manufacturer = "cleared from service
//                history", quantity = a log id, Est. Value $NaN. "so lets get
//                rid of that. it will confuse a user."
//
// Until v1861 this suite kept its OWN hand list of feature tabs (FEATURE_TABS)
// and checked two more hand lists against it — three lists to remember, and
// Deleted Rows was on none of them. Remembering is the part that keeps
// failing, so nothing is remembered any more:
//
//   1. A feature registers its tab name WHERE THE NAME IS BORN:
//          var LOG_TAB = rrFeatureTab('Maintenance Log');     (config.js registry)
//   2. Both guards — the canonical set in syncUserDefinedTabsFromSheet
//      (app-setup.js, the Show chip) and _RESERVED_TABS in loadPersonalData
//      (app-data.js, the loader) — read RR_FEATURE_TABS. No names typed there.
//   3. THIS suite walks every addSheet in app/*.js and fails on a tab that is
//      created but never registered. A new tab cannot be forgotten: it is
//      either registered, or it is named in the KNOWN_NOT_FEATURE list below
//      with the reason it is not a feature tab.
//   4. The REAL guards run: the real sync prunes a wrongly-saved chip and its
//      bucket; the real loader filter skips the registered tabs.
// Every rule is proven able to fail on a planted offender.
// Run:  node tests/barcode-map-tests.js
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
// Comments are stripped before any search (the guards' comments name the very
// tabs being asserted). String-aware: a '/*' or '//' inside a quoted string
// (a URL, a glob) is text, not a comment — the old regex stripper swallowed
// 300 lines of maintenance.js after one such string and hid two tabs.
function _stripComments(s) {
  let out = '', i = 0, q = null;
  while (i < s.length) {
    const c = s[i], n = s[i + 1];
    if (q) { out += c; if (c === '\\') { out += n || ''; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { const e = s.indexOf('*/', i + 2); i = e < 0 ? s.length : e + 2; continue; }
    out += c; i++;
  }
  return out;
}

// addSheet sites whose title is NOT a feature tab, each with its reason. A
// new addSheet that is neither registered nor listed here fails section A.
const KNOWN_NOT_FEATURE = {
  "'Sold'": 'a collection tab the app reads (canonical by name)',
  "'For Sale'": 'a collection tab the app reads (canonical by name)',
  "'Want-Upgrade List'": 'a collection tab the app reads (canonical by name)',
  "'Dashboard'": 'the sheet dashboard (canonical by name)',
  't.title': 'app-setup LIVE_TABS: Instruction Sheets / Science Sets / Construction Sets / My Sets (canonical by name)',
  'label': "wizard-handlers: the user's OWN custom tab — the one kind that SHOULD get a chip",
  'YM.ARCHIVE_TAB': "yardmaster: on the vault workbook, not the user's sheet",
};
// The floor: every tab known to be a feature tab today. The walk in A finds
// tabs; this proves the walk cannot quietly find fewer than it should.
const FLOOR = ['Parts Needed', 'Contacts', 'Barcode Map', 'My Manuals', 'Maintenance Log', 'Parts Bin', 'Deleted Rows'];

const files = fs.readdirSync(APP).filter(f => f.endsWith('.js'));
const SRC = {}; files.forEach(f => { SRC[f] = rd(f); });

// ── the registry: every name handed to rrFeatureTab, by file ────────────
function registered(srcByFile) {
  const out = {};
  Object.keys(srcByFile).forEach(f => {
    const s = _stripComments(srcByFile[f]);
    const re = /rrFeatureTab(?:\s*:\s*String\))?\s*\(\s*'([^']+)'\s*\)/g;
    let m; while ((m = re.exec(s))) { (out[f] = out[f] || []).push(m[1]); }
  });
  return out;
}
// ── the walk: every addSheet title, resolved to a name or an identifier ──
function walk(srcByFile) {
  const sites = [];
  Object.keys(srcByFile).forEach(f => {
    const s = _stripComments(srcByFile[f]);
    const re = /addSheet:\s*\{\s*properties:\s*\{\s*title:\s*([^,}]+)/g;
    let m; while ((m = re.exec(s))) {
      const raw = m[1].trim();
      let name = null;
      const lit = raw.match(/^'([^']+)'$/);
      if (lit) name = lit[1];
      else {
        // an identifier: its definition in the same file must register it
        const id = raw.split('.').pop();
        const def = s.match(new RegExp('(?:var|const|let)\\s+' + id.replace(/[$]/g, '\\$') + '\\s*=\\s*\\(typeof rrFeatureTab === \'function\' \\? rrFeatureTab : String\\)\\(\'([^\']+)\'\\)'));
        if (def) name = def[1];
      }
      sites.push({ file: f, raw: raw, name: name });
    }
  });
  return sites;
}
function judge(srcByFile) {
  const reg = registered(srcByFile);
  const all = new Set([].concat.apply([], Object.keys(reg).map(f => reg[f])));
  const bad = [];
  walk(srcByFile).forEach(site => {
    if (KNOWN_NOT_FEATURE[site.raw]) return;                       // explained, with its reason
    if (site.name) {
      if (!all.has(site.name)) bad.push(site.file + ': creates \'' + site.name + '\' but never registers it (rrFeatureTab)');
    } else {
      bad.push(site.file + ': addSheet title ' + site.raw + ' is neither registered nor explained in KNOWN_NOT_FEATURE');
    }
  });
  return { bad: bad, names: all };
}

section('A · every tab a feature creates is registered where it is born');
ok('config.js holds the registry (RR_FEATURE_TABS + rrFeatureTab)', /var RR_FEATURE_TABS = \[\];/.test(SRC['config.js']) && /function rrFeatureTab\(name\)/.test(SRC['config.js']));
const J = judge(SRC);
ok('every addSheet in app/*.js is registered or explained', J.bad.length === 0, J.bad.join('; '));
FLOOR.forEach(n => ok('\'' + n + '\' is registered', J.names.has(n)));
ok('the walk saw every addSheet site it should (' + walk(SRC).length + ')', walk(SRC).length >= 16, 'found ' + walk(SRC).length);

section('B · both guards read the registry, and type no names');
const setup = SRC['app-setup.js'], data = SRC['app-data.js'];
const canonicalBlock = _stripComments((setup.match(/const canonical = new Set\(\[([\s\S]*?)\]\);/) || [])[1] || '');
ok('found the canonical tab set', canonicalBlock.length > 0);
ok('the canonical set spreads RR_FEATURE_TABS', /\.\.\.\(typeof RR_FEATURE_TABS !== 'undefined' \? RR_FEATURE_TABS : \[\]\)/.test(canonicalBlock));
ok('…and types no feature-tab name by hand', FLOOR.every(n => canonicalBlock.indexOf("'" + n + "'") < 0));
const reservedBlock = _stripComments((data.match(/const _RESERVED_TABS = \{\};[\s\S]{0,200}?forEach\([^)]*\)[^\n]*/) || [''])[0]);
ok('_RESERVED_TABS is filled from RR_FEATURE_TABS', /RR_FEATURE_TABS/.test(reservedBlock) && FLOOR.every(n => reservedBlock.indexOf("'" + n + "'") < 0));
ok('the sync prunes the pruned tab\'s OWN bucket, not a hand list', /_wrong\.forEach\(t => \{ try \{ delete state\.ephemeraData\[t\.id\]; \}/.test(setup) && !/delete state\.ephemeraData\.parts_needed/.test(setup));

section('C · the real guards, run');
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('not found: ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced: ' + sig);
}
async function runSync(src, titles, saved, buckets, featureTabs) {
  const state = { userDefinedTabs: saved, ephemeraData: buckets };
  const log = [];
  const env = {
    accessToken: 'tok', state: state, EPHEMERA_TABS: [], RR_FEATURE_TABS: featureTabs,
    fetch: async () => ({ ok: true, json: async () => ({ sheets: titles.map(t => ({ properties: { title: t } })) }) }),
    saveUserDefinedTabs: () => { log.push('saved'); },
    console: { log: () => {}, warn: (m) => { log.push('warn:' + m); } },
  };
  const names = Object.keys(env);
  const fn = new Function(...names, grab(src, 'async function syncUserDefinedTabsFromSheet(sheetId)') + '\nreturn syncUserDefinedTabsFromSheet;');
  await fn(...names.map(n => env[n]))('sheet1');
  return { state: state, log: log };
}
// the loader's filter — the lines around _RESERVED_TABS, run against a fake sheetsGet
function runLoader(src, saved, featureTabs) {
  const block = (src.match(/const _RESERVED_TABS = \{\};[\s\S]*?await Promise\.all\(_utPromises\);/) || [''])[0];
  if (!block) throw new Error('loader block not found');
  const asked = [];
  const env = {
    RR_FEATURE_TABS: featureTabs, state: { userDefinedTabs: saved }, sheetId: 's', newEphemera: {},
    sheetsGet: async (id, range) => { asked.push(range); return { values: [] }; },
    parseEphemeraRows: () => {}, console: { warn: () => {} },
  };
  const names = Object.keys(env);
  const fn = new Function(...names, 'return (async () => {' + block + '})();');
  return fn(...names.map(n => env[n])).then(() => asked);
}
(async () => {
  const FT = Array.from(J.names);
  {
    const r = await runSync(setup, ['My Collection', 'Deleted Rows', 'Maintenance Log', 'My Stuff'],
      [{ id: 'deleted_rows', label: 'Deleted Rows' }], { deleted_rows: { 3: { title: 'x' } }, my_stuff: {} }, FT);
    const labels = r.state.userDefinedTabs.map(t => t.label);
    ok('a saved "Deleted Rows" chip is pruned, its bucket dropped, and the change saved',
       labels.indexOf('Deleted Rows') < 0 && !('deleted_rows' in r.state.ephemeraData) && r.log.indexOf('saved') >= 0, JSON.stringify(labels) + ' ' + JSON.stringify(Object.keys(r.state.ephemeraData)));
    ok('…Maintenance Log is not backfilled as a chip either', labels.indexOf('Maintenance Log') < 0);
    ok('…while the user\'s own "My Stuff" tab IS backfilled as a chip', labels.indexOf('My Stuff') >= 0 && r.state.userDefinedTabs.some(t => t.id === 'my_stuff'));
  }
  {
    const asked = await runLoader(data, [{ id: 'deleted_rows', label: 'Deleted Rows' }, { id: 'my_stuff', label: 'My Stuff' }], FT);
    ok('the loader reads the user\'s tab and never the Deleted Rows tab', asked.length === 1 && /^My Stuff!/.test(asked[0]), JSON.stringify(asked));
  }

  section('D · planted offenders are caught');
  {
    const o = Object.assign({}, SRC, { 'zzz-new-feature.js': "fetch(u, { body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Price Watch' } } }] }) });" });
    ok('D1 a new feature creating an unregistered tab is caught', judge(o).bad.length === 1 && /Price Watch/.test(judge(o).bad[0]));
  }
  {
    const o = Object.assign({}, SRC, { 'zzz-new-feature.js': "var PW_TAB = 'Price Watch';\nfetch(u, { body: JSON.stringify({ requests: [{ addSheet: { properties: { title: PW_TAB } } }] }) });" });
    ok('D2 a new feature naming its tab through a plain variable (not registered) is caught', judge(o).bad.length === 1 && /PW_TAB/.test(judge(o).bad[0]));
  }
  {
    const o = Object.assign({}, SRC, { 'sheets.js': SRC['sheets.js'].replace("(typeof rrFeatureTab === 'function' ? rrFeatureTab : String)('Deleted Rows')", "'Deleted Rows'") });
    ok('D3 the v1860 sheets.js (Deleted Rows typed into RR_TRASH_TAB, never registered) is caught', judge(o).bad.some(b => /sheets\.js: addSheet title RR_TRASH_TAB is neither registered/.test(b)), judge(o).bad.join('; '));
  }
  {
    const o = SRC['app-setup.js'].replace("...(typeof RR_FEATURE_TABS !== 'undefined' ? RR_FEATURE_TABS : []),", "'Parts Needed', 'Contacts', 'Barcode Map',");
    const r = await runSync(o, ['My Collection', 'Deleted Rows'], [{ id: 'deleted_rows', label: 'Deleted Rows' }], { deleted_rows: {} }, FT);
    ok('D4 the v1860 canonical set (hand list) is caught by the run: the chip survives', r.state.userDefinedTabs.some(t => t.label === 'Deleted Rows'));
  }
  {
    const o = SRC['app-setup.js'].replace("if (state.ephemeraData) _wrong.forEach(t => { try { delete state.ephemeraData[t.id]; } catch (e) {} });", '');
    const r = await runSync(o, ['My Collection', 'Deleted Rows'], [{ id: 'deleted_rows', label: 'Deleted Rows' }], { deleted_rows: {} }, FT);
    ok('D5 a prune that leaves the bucket behind is caught by the run', ('deleted_rows' in r.state.ephemeraData));
  }
  {
    const asked = await runLoader(data, [{ id: 'deleted_rows', label: 'Deleted Rows' }], []);
    ok('D6 an empty registry (config.js not loaded) would let the loader read the tab — the run sees it', asked.length === 1);
  }

  section('E · the Barcode Map tab itself (v1426 audit)');
  const bc = SRC['barcode.js'];
  ok('Barcode Map tab still has its documented header', /\['UPC \/ Barcode', 'Item Number', 'Manufacturer', 'Learned On', 'How'\]/.test(bc), 'header changed — re-check the audit doc');
  ok('barcode pairings still share to the community pool', /_bcPairShare\(/.test(bc) && /vaultIsOptedIn/.test(bc), 'community sharing path missing');

  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();
