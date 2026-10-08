// ═══════════════════════════════════════════════════════════════
// service_manual_links_tests.js — v0.9.1896.
//
// [stated] Brad, 2026-10-08: "our new lionel maintenance sheets should show up
// under the manuals and parts diagrams section. it should auto show the sheet
// from our list. this should be above the lcca members button" and "if our item
// is lionel postwar, it should already know its diagram."
//
// THE RULES THIS SUITE PROTECTS:
//   A. The tab's name lives ONCE — SERVICE_MANUAL_TAB in config.js. No app file
//      types 'Lionel PW - Service Manual' anywhere else.
//   B. The block sits in _maintDiagramLinksHtml ABOVE the LCCA button, OUTSIDE
//      the phone guard (Drive opens on every device), for era 'pw' ONLY.
//   C. The tab is read BY HEADER NAME; only rows with a Drive scan link count;
//      any other address on the sheet is ignored; a missing header = nothing.
//   D. The match: exact first (2343C is not 2343); a plain number also asks for
//      its P (catalog 2343 = Lionel 2343P); 2343-P = 2343P; the -NN variation
//      and then trailing letters are dropped ONLY after a miss; "closest
//      similar" rows stay apart and never repeat a direct one; a year tag only
//      when the sheet names ONE year for that number.
//   E. Order: newest printing of each page first, in page order (parts lists
//      after numbered pages); older printings of the same page apart, below.
//   F. Nothing scanned → nothing shown (no empty heading).
//   G. The loader: one read of the tab even when two callers ask at once; kept
//      on this device; a different Master Version throws the copy away; a
//      failed read is not remembered.
// Every rule is proven able to fail on a planted offender.
// Run:  node tests/service_manual_links_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const APP = path.join(__dirname, '..', 'app');
const maint = fs.readFileSync(path.join(APP, 'maintenance.js'), 'utf8');
const config = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');

function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find function ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + name);
}
// the whole service-manual block, from its first var to the end of _smSlotHtml
function smBlock(src) {
  const a = src.indexOf('var _SM_CACHE_KEY');
  const fn = grab(src, '_smSlotHtml');
  return src.slice(a, src.indexOf(fn) + fn.length);
}
// run the REAL block with the app's globals stubbed
function load(src, env) {
  env = env || {};
  const store = env.store || {};
  const g = {
    state: env.state || { masterSheetId: 'MASTER', masterVersion: { v: '2.30' } },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    sheetsGet: env.sheetsGet || (() => Promise.resolve({ values: [] })),
    SERVICE_MANUAL_TAB: 'Lionel PW - Service Manual',
    MASTER_SHEET_ID: 'MASTER', CATALOG_REFRESH_MAX_AGE_DAYS: 7,
    document: env.document || { getElementById: () => null },
    setTimeout: env.setTimeout || (f => f()),
    console: { warn: () => {}, log: () => {} },
    _esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    rrJsArg: s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"),
    _btn: () => 'class="b"', _btnQuiet: () => 'class="q"',
  };
  const names = Object.keys(g);
  const api = '_smParse,_smMatch,_smOrder,_smLabel,_smBlockHtml,_smLoad,_smSlotHtml,_smTok';
  const fn = new Function(...names, smBlock(src) + '\nreturn {' + api + '};');
  const M = fn(...names.map(n => g[n]));
  M.store = store;
  return M;
}
// a fixture in the tab's own shape (rows copied from the live tab, 2026-10-08),
// columns deliberately NOT in sheet order — the reader must go by name
const HDR = ['Scan link', 'Sheet ID', 'Section', 'Page', 'Date printed', 'Page type', 'Front & back', 'Covers items', 'Back scan link', 'Covers (closest similar)', 'Notes'];
const D = id => 'https://drive.google.com/file/d/' + id + '/view';
function row(o) { return HDR.map(h => o[h] || ''); }
const VALUES = [HDR,
  row({ 'Sheet ID': 'SM-0386', Section: 'LOC 2200', Page: 'page 1', 'Date printed': '1-59', 'Page type': 'Service notes', 'Covers items': '2240, 2240C, 2240P, 2245C(54), 2245C(55), 2245P', 'Scan link': D('a1') }),
  row({ 'Sheet ID': 'SM-0387', Section: 'LOC 2200', Page: 'page 2', 'Date printed': '1-59', 'Page type': 'Parts diagram', 'Covers items': '2240, 2240C, 2240P, 2245C(54), 2245C(55), 2245P', 'Scan link': D('a2') }),
  row({ 'Sheet ID': 'SM-0388', Section: 'LOC 2200', Page: 'PL', 'Date printed': '11-59', 'Page type': 'Parts list', 'Covers items': '2240, 2240P, 2245P', 'Scan link': D('a3'), 'Back scan link': D('a3b') }),
  row({ 'Sheet ID': 'SM-0391', Section: 'LOC 2245C (1954)', Page: 'PL', 'Date printed': '6-60', 'Page type': 'Parts list', 'Covers items': '2245C, 2245C(54)', 'Scan link': D('a4') }),
  row({ 'Sheet ID': 'SM-0400', Section: 'LOC 2328', Page: 'page 3', 'Date printed': '4-57', 'Page type': 'Parts diagram', 'Covers items': '2328, 2338', 'Scan link': D('b0') }),
  row({ 'Sheet ID': 'SM-0401', Section: 'LOC 2328', Page: 'page 3', 'Date printed': '1-59', 'Page type': 'Parts diagram', 'Covers items': '2328, 2338', 'Scan link': D('b1') }),
  row({ 'Sheet ID': 'SM-0402', Section: 'LOC 2328', Page: 'page 2', 'Date printed': '12-58', 'Page type': 'Parts diagram', 'Covers items': '2328, 2338', 'Scan link': D('b2') }),
  row({ 'Sheet ID': 'SM-0403', Section: 'LOC 2328', Page: 'PL', 'Date printed': '10-59', 'Page type': 'Parts list', 'Covers items': '2328, 2338', 'Scan link': D('b3') }),
  row({ 'Sheet ID': 'SM-0500', Section: 'LOC 2343', Page: 'page 1', 'Date printed': '3-55', 'Page type': 'Service notes', 'Covers items': '2343P, 2343T, 2343C(54)', 'Scan link': D('c1') }),
  row({ 'Sheet ID': 'SM-0600', Section: 'NOC 6446', Page: 'PL', 'Date printed': '5-58', 'Page type': 'Parts list', 'Covers items': '6446, 6456', 'Covers (closest similar)': '6476, 6536', 'Scan link': D('d1') }),
  row({ 'Sheet ID': 'SM-0700', Section: 'ACC 30', Page: 'page 1', 'Date printed': '1-50', 'Page type': 'Service notes', 'Covers items': '30', 'Scan link': 'https://evil.example.com/x' }),
  row({ 'Sheet ID': 'SM-0701', Section: 'ACC 35', Page: 'page 1', 'Date printed': '1-50', 'Page type': 'Service notes', 'Covers items': '35' }),
  row({ 'Sheet ID': 'SM-0800', Section: 'NOC 6464', Page: 'page 1', 'Date printed': '2-54', 'Page type': 'Parts diagram', 'Covers items': '6464', 'Scan link': D('e1') }),
  row({ 'Sheet ID': 'SM-0801', Section: 'TEN W', Page: 'page 1', 'Date printed': '2-54', 'Page type': 'Parts diagram', 'Covers items': '2046W, 6466W', 'Scan link': D('f1') }),
  row({ 'Sheet ID': 'SM-0802', Section: 'LOC 646', Page: 'page 1', 'Date printed': '2-54', 'Page type': 'Parts diagram', 'Covers items': '646, 2046', 'Scan link': D('g1') }),
];
const ids = m => m.direct.map(h => h.r.id).sort().join(',');
const M = load(maint);
const ROWS = M._smParse(VALUES);

section('A · the tab name lives once');
ok('config.js defines SERVICE_MANUAL_TAB = \'Lionel PW - Service Manual\'', /const SERVICE_MANUAL_TAB = 'Lionel PW - Service Manual';/.test(config));
function nameTypedElsewhere(files) {   // files: [[name, text], …]
  return files.filter(([f, t]) => f !== 'config.js' && /\.js$/.test(f) && t.indexOf('Lionel PW - Service Manual') >= 0).map(([f]) => f);
}
const APP_FILES = fs.readdirSync(APP).filter(f => /\.js$/.test(f)).map(f => [f, fs.readFileSync(path.join(APP, f), 'utf8')]);
const typed = nameTypedElsewhere(APP_FILES);
ok('no other app file types the tab name', typed.length === 0, typed.join(', '));
ok('the loader reads the tab through the constant', /sheetsGet\(sid, "'" \+ SERVICE_MANUAL_TAB \+ "'!A1:Z"\)/.test(maint));

section('B · where the block sits');
const builder = grab(maint, '_maintDiagramLinksHtml');
const lccaBranch = builder.slice(builder.indexOf("if (route === 'lcca') {"), builder.indexOf("} else if (route === 'atlas' && _atlasHit)"));
const slotAt = lccaBranch.indexOf("h += _smSlotHtml(item, where)");
const guardAt = lccaBranch.indexOf('if (!window.IS_MOBILE_UA) {');
ok('the slot is in the LCCA branch, before the phone guard (so above the LCCA button, and on phones too)', slotAt > 0 && guardAt > slotAt);
ok('the slot is for era \'pw\' only', /if \(String\(eraKey \|\| ''\)\.toLowerCase\(\) === 'pw'\) h \+= _smSlotHtml\(item, where\);/.test(lccaBranch));

section('C · reading the tab');
ok('read by header name (columns shuffled in the fixture): 13 scanned rows kept', ROWS.length === 13, ROWS.length);
ok('a row with no scan link is dropped (ACC 35)', !ROWS.some(r => r.id === 'SM-0701'));
ok('a non-Drive address is ignored (ACC 30)', !ROWS.some(r => r.id === 'SM-0700'));
ok('the back-of-sheet link is carried', ROWS.find(r => r.id === 'SM-0388').b === D('a3b'));
ok('a tab with no Scan link column gives nothing', M._smParse([HDR.filter(h => h !== 'Scan link')].concat(VALUES.slice(1))).length === 0);
ok('an empty read gives nothing', M._smParse(undefined).length === 0 && M._smParse([]).length === 0);

section('D · which sheets an item gets');
ok('2240 → the three LOC 2200 sheets', ids(M._smMatch(ROWS, '2240')) === 'SM-0386,SM-0387,SM-0388');
ok('2343 (the catalog\'s powered A-unit) finds Lionel\'s 2343P sheet', ids(M._smMatch(ROWS, '2343')) === 'SM-0500');
ok('2343-P (the app\'s dash) = 2343P', ids(M._smMatch(ROWS, '2343-P')) === 'SM-0500');
ok('2343C finds its sheet exactly', ids(M._smMatch(ROWS, '2343C')) === 'SM-0500');
ok('2245C: both LOC 2200 pages + its own 1954 list, not the A-unit parts list', ids(M._smMatch(ROWS, '2245C')) === 'SM-0386,SM-0387,SM-0391');
ok('2338 gets the 2328 section (both printings of page 3)', ids(M._smMatch(ROWS, '2338')) === 'SM-0400,SM-0401,SM-0402,SM-0403');
ok('6464-100: the variation dropped only after the exact miss → 6464', ids(M._smMatch(ROWS, '6464-100')) === 'SM-0800');
ok('2046W: exact hit wins (the tender sheet), the letter is NOT dropped', ids(M._smMatch(ROWS, '2046W')) === 'SM-0801');
ok('2046WX: exact miss → letters dropped → 2046\'s loco sheet', ids(M._smMatch(ROWS, '2046WX')) === 'SM-0802');
const sim = M._smMatch(ROWS, '6476');
ok('6476: nothing direct, Lionel\'s closest-similar sheet kept apart', sim.direct.length === 0 && sim.similar.length === 1 && sim.similar[0].r.id === 'SM-0600');
ok('6446: direct only — the same sheet is not repeated as "similar"', M._smMatch(ROWS, '6446').direct.length === 1 && M._smMatch(ROWS, '6446').similar.length === 0);
ok('an unknown number gets nothing', ids(M._smMatch(ROWS, '9999')) === '' && M._smMatch(ROWS, '9999').similar.length === 0);
ok('a blank number gets nothing', M._smMatch(ROWS, '').direct.length === 0);
const yr = M._smMatch(ROWS, '2245C');
ok('year tag: LOC 2200 names 2245C(54) AND (55) → no tag', yr.direct.filter(h => h.r.sec === 'LOC 2200').every(h => h.y === ''));
ok('year tag: the 1954 list names 2245C plainly too → no tag', yr.direct.find(h => h.r.id === 'SM-0391').y === '');
ok('year tag: 2343C only as (54) → \'54 version', M._smMatch(ROWS, '2343C').direct[0].y === '54' && /’54 version/.test(M._smLabel(M._smMatch(ROWS, '2343C').direct[0])));

section('E · order and labels');
const o = M._smOrder(M._smMatch(ROWS, '2338').direct);
ok('newest printing of each page, in page order, parts list last', o.newest.map(h => h.r.id).join(',') === 'SM-0402,SM-0401,SM-0403', o.newest.map(h => h.r.id).join(','));
ok('the older printing of page 3 sits apart', o.older.map(h => h.r.id).join(',') === 'SM-0400');
ok('label: section · type · page · date', M._smLabel(o.newest[0]) === 'LOC 2328 · Parts diagram · page 2 · 12-58');
ok('label: a "PL" page does not repeat itself', M._smLabel(o.newest[2]) === 'LOC 2328 · Parts list · 10-59');

section('F · the block');
const html = M._smBlockHtml(M._smMatch(ROWS, '2338'));
ok('heading + one button per newest page, each opening our Drive scan', /Lionel Service Manual/.test(html) && html.indexOf(D('b2')) > 0 && html.indexOf(D('b1')) > 0 && html.indexOf(D('b3')) > 0);
ok('"Older printings" below them', html.indexOf('Older printings') > html.indexOf(D('b3')) && html.indexOf(D('b0')) > html.indexOf('Older printings'));
ok('back-of-sheet button when there is a back scan', /Back of sheet/.test(M._smBlockHtml(M._smMatch(ROWS, '2240'))) && M._smBlockHtml(M._smMatch(ROWS, '2240')).indexOf(D('a3b')) > 0);
ok('"closest similar" has its own heading', /closest similar item/.test(M._smBlockHtml(sim)));
ok('nothing scanned → empty string (no lonely heading)', M._smBlockHtml(M._smMatch(ROWS, '9999')) === '' && M._smBlockHtml(null) === '');
const evil = M._smParse([HDR, row({ Section: '<img src=x onerror=alert(1)>', 'Covers items': '1', 'Scan link': D('z') })]);
ok('sheet text is escaped in the button', !/<img/.test(M._smBlockHtml(M._smMatch(evil, '1'))));

section('G · the loader');
(async () => {
  let calls = 0, lastRange = '';
  const L = load(maint, { sheetsGet: (id, range) => { calls++; lastRange = range; return new Promise(r => setTimeout(() => r({ values: VALUES }), 5)); } });
  const [a, b] = await Promise.all([L._smLoad(), L._smLoad()]);
  ok('two callers at once → ONE read of the tab', calls === 1 && a.length === 13 && b === a);
  ok('the read asks for the tab by its constant', lastRange === "'Lionel PW - Service Manual'!A1:Z");
  ok('kept on this device with the Master Version', JSON.parse(L.store.rr_sm_cache_v1).mv === '2.30');
  let calls2 = 0;
  const L2 = load(maint, { store: L.store, sheetsGet: () => { calls2++; return Promise.resolve({ values: VALUES }); } });
  await L2._smLoad();
  ok('a fresh start with the same Master Version reads the device copy, not the sheet', calls2 === 0);
  let calls3 = 0;
  const L3 = load(maint, { store: L.store, state: { masterSheetId: 'MASTER', masterVersion: { v: '2.31' } }, sheetsGet: () => { calls3++; return Promise.resolve({ values: VALUES }); } });
  await L3._smLoad();
  ok('a new Master Version → the sheet is read again', calls3 === 1);
  let calls4 = 0;
  const L4 = load(maint, { sheetsGet: () => { calls4++; return calls4 === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ values: VALUES }); } });
  const f1 = await L4._smLoad(); const f2 = await L4._smLoad();
  ok('a failed read is not remembered — the next open tries again', f1.length === 0 && calls4 === 2 && f2.length === 13);
  // the slot: placeholder filled for the SAME item only
  const el = { attrs: {}, innerHTML: '', getAttribute(k) { return this.attrs[k]; } };
  const L5 = load(maint, { sheetsGet: () => Promise.resolve({ values: VALUES }), document: { getElementById: id => (id === 'maint-sm-pop' ? el : null) }, setTimeout: f => { el.attrs['data-sm-num'] = '2338'; f(); } });
  const ph = L5._smSlotHtml({ itemNum: '2338' }, 'pop');
  await new Promise(r => setTimeout(r, 20));
  ok('not loaded yet → a placeholder keyed by where, filled when the list arrives', /id="maint-sm-pop" data-sm-num="2338"/.test(ph) && /LOC 2328/.test(el.innerHTML));
  const el2 = { attrs: {}, innerHTML: '', getAttribute(k) { return this.attrs[k]; } };
  const L6 = load(maint, { sheetsGet: () => Promise.resolve({ values: VALUES }), document: { getElementById: () => el2 }, setTimeout: f => { el2.attrs['data-sm-num'] = '2240'; f(); } });
  L6._smSlotHtml({ itemNum: '2338' }, '');
  await new Promise(r => setTimeout(r, 20));
  ok('…but never into a slot that now belongs to another item', el2.innerHTML === '');
  ok('loaded → the buttons straight away, no placeholder', /LOC 2328/.test(L5._smSlotHtml({ itemNum: '2338' }, '')) && !/data-sm-num/.test(L5._smSlotHtml({ itemNum: '2338' }, '')));

  section('H · planted offenders are caught');
  ok('H1 the tab name typed into maintenance.js is caught', nameTypedElsewhere(APP_FILES.map(([f, t]) => [f, f === 'maintenance.js' ? t + "\nvar T = 'Lionel PW - Service Manual';" : t])).indexOf('maintenance.js') >= 0);
  ok('H2 the slot moved under the LCCA button is caught', (() => {
    const b = lccaBranch.replace("      if (String(eraKey || '').toLowerCase() === 'pw') h += _smSlotHtml(item, where);\n", '') + "\n h += _smSlotHtml(item, where);";
    const s = b.indexOf('h += _smSlotHtml(item, where)'), g = b.indexOf('if (!window.IS_MOBILE_UA) {');
    return !(s > 0 && g > s); })());
  ok('H3 the pw gate dropped (prewar borrows postwar sheets) is caught', !/=== 'pw'\) h \+= _smSlotHtml/.test(lccaBranch.replace("if (String(eraKey || '').toLowerCase() === 'pw') h += _smSlotHtml", 'h += _smSlotHtml')));
  const P = s => load(s)._smParse(VALUES);
  const m1 = maint.replace("if (!tk.k || steps[s].indexOf(tk.k) < 0) continue;", "if (!tk.k || steps.some(function (st) { return st.indexOf(tk.k) >= 0; }) === false) continue;");
  ok('H4 every step tried at once (2046W also grabs the 2046 loco sheet) is caught', m1 !== maint && ids(load(m1)._smMatch(P(m1), '2046W')) !== 'SM-0801');
  const m2 = maint.replace("if (/^\\d+$/.test(n)) steps[0].push(n + 'P');", '');
  ok('H5 the P rule dropped (2343 finds nothing) is caught', m2 !== maint && ids(load(m2)._smMatch(P(m2), '2343')) !== 'SM-0500');
  const m3 = maint.replace("return /^https:\\/\\/drive\\.google\\.com\\/[A-Za-z0-9_\\-\\/?=&.]+$/.test(u) ? u : '';", 'return u;');
  ok('H6 any address accepted as a scan link is caught', m3 !== maint && P(m3).some(r => r.id === 'SM-0700'));
  const m4 = maint.replace("if (any) hits.push({ r: r, y: (!plain && ys.length === 1) ? ys[0] : '' });", "if (any) hits.push({ r: r, y: ys[0] || '' });");
  ok('H7 a year tag on a sheet that serves both years is caught', m4 !== maint && load(m4)._smMatch(P(m4), '2245C').direct.some(h => h.r.sec === 'LOC 2200' && h.y));
  const m5 = maint.replace("res.similar = find('sim').filter(function (h) { return !seen[h.r.o]; });", "res.similar = find('sim');");
  ok('H8 similar rows mixed with direct (no de-dup) is caught', m5 !== maint && (() => { const V = VALUES.concat([row({ 'Sheet ID': 'SM-0900', Section: 'X', 'Covers items': '7777', 'Covers (closest similar)': '7777', 'Scan link': D('q') })]); const L = load(m5); return L._smMatch(L._smParse(V), '7777').similar.length > 0; })());
  const m6 = maint.replace("if (had[k]) older.push(h); else { had[k] = 1; newest.push(h); }", 'newest.push(h);');
  ok('H9 older printings mixed in with the newest is caught', m6 !== maint && load(m6)._smOrder(load(m6)._smMatch(P(m6), '2338').direct).newest.length !== 3);
  const m7 = maint.replace("if (!el || el.getAttribute('data-sm-num') !== num) return;", 'if (!el) return;');
  ok('H10 filling a slot that belongs to another item is caught', m7 !== maint && await (async () => {
    const e = { attrs: {}, innerHTML: '', getAttribute(k) { return this.attrs[k]; } };
    const L = load(m7, { sheetsGet: () => Promise.resolve({ values: VALUES }), document: { getElementById: () => e }, setTimeout: f => { e.attrs['data-sm-num'] = '2240'; f(); } });
    L._smSlotHtml({ itemNum: '2338' }, ''); await new Promise(r => setTimeout(r, 20)); return e.innerHTML !== ''; })());
  const m8 = maint.replace("}).then(function (rows) { _smLoading = null; return rows; });", '});');
  ok('H11 a loader that never clears its in-flight read (failure remembered) is caught', m8 !== maint && await (async () => {
    let c = 0; const L = load(m8, { sheetsGet: () => { c++; return c === 1 ? Promise.reject(new Error('x')) : Promise.resolve({ values: VALUES }); } });
    await L._smLoad(); const r2 = await L._smLoad(); return r2.length === 0; })());
  ok('H12 the empty-block rule broken (a lonely heading) is caught', (() => {
    const m9 = maint.replace("if (!match || (!match.direct.length && !match.similar.length)) return '';", 'if (!match) return \'\';');
    return m9 !== maint && load(m9)._smBlockHtml({ direct: [], similar: [] }) !== ''; })());

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL  crashed: ' + e.stack); process.exit(1); });
