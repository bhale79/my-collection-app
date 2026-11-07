// ═══════════════════════════════════════════════════════════════
// maint_diagram_links_tests.js — v0.9.1857.
//
// [stated] Brad, 2026-10-01 (item 5 of his Workbench list): "when i have the
// need a part page up, i should also be able to click on the parts diagram
// if i have it saved or be able to click the google link or the trainz link."
//
// Until now the "Manuals & Parts Diagrams" links (the maker's own page, LCCA
// on the desktop, Atlas / Marklin PDFs, the Trainz diagram, Google) were built
// INSIDE the Maintenance panel and nowhere else; the Need-a-part popup only
// offered a button that closed it and walked to the panel.
//
// THE RULES THIS SUITE PROTECTS:
//   1. ONE builder — _maintDiagramLinksHtml(item, where) (maintenance.js). The
//      panel's docs section calls it with '' and the Need-a-part popup with
//      'pop'. No second copy of any of its buttons anywhere in the file.
//   2. The popup's "Parts diagram" box holds the saved docs AND those links,
//      and no longer sends the user away to find them.
//   3. The LCCA note the button fills in is keyed by `where` (the popup sits
//      over the panel — two notes, two ids), and _maintLccaGo takes that id.
//   4. The REAL builder, run: a postwar engine on the desktop gets the LCCA
//      button + the Trainz diagram + Google; the same on a phone gets no LCCA
//      button (v1846) but keeps Trainz + Google; where='pop' → the popup's
//      own note id; a maker with nothing gets the honest line + Google.
// Every rule is proven able to fail on a planted offender.
// Run:  node tests/maint_diagram_links_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const maint = fs.readFileSync(path.join(__dirname, '..', 'app', 'maintenance.js'), 'utf8');

function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find function ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + name);
}
// run the REAL builder with the helpers it leans on stubbed to known answers
function build(src, item, opts) {
  opts = opts || {};
  const env = {
    window: { IS_MOBILE_UA: !!opts.phone, MARKLIN_PARTS_PDF_BASE: 'https://m/', MARKLIN_PARTS_SHOP: 'https://s/?q=' },
    _itemEraKey: () => opts.era || 'pw',
    _docsRoute: () => opts.route || 'lcca',
    _pwsmFile: () => opts.pwsm === undefined ? 'loco_2343' : opts.pwsm,
    _atlasMatch: () => null, _atlasMatchAll: () => [], _atlasFamilies: () => [], _atlasScale: () => 'O',
    ATLAS_DL: 'https://download.atlasrr.com', ATLAS_PAGE: 'https://shop.atlasrr.com/t-partsdiagrams.aspx',
    _btn: () => 'class="b"', _btnQuiet: () => 'class="q"',
    _esc: s => String(s), rrJsArg: s => String(s),
    _docsUrl: () => 'https://www.lionelcollectors.org/docs/x/loco_2343.pdf',
    _makerName: () => opts.maker || 'Lionel',
    _marklinParts: () => opts.marklin || null,
    _tzDiagram: () => (opts.tz === undefined ? { h: 'lionel-2028-2328-2337-2338-2339-2346-2348-2329-parts-list-and-exploded-view-parts-diagram', t: 'Lionel 2028 2328 2337 2338 2339 GP-7, 2346 2348 GP-9 2329 Re' } : opts.tz),
    // v0.9.2042: the panel draws EVERY right diagram (_tzDiagrams, a list)
    _tzDiagrams: () => (opts.tz === undefined ? [{ h: 'lionel-2028-2328-2337-2338-2339-2346-2348-2329-parts-list-and-exploded-view-parts-diagram', t: 'Lionel 2028 2328 2337 2338 2339 GP-7, 2346 2348 GP-9 2329 Re' }] : (opts.tz ? [].concat(opts.tz) : [])),
    _modelWords: () => 'GP-7 diesel',
    rrSearchNumber: () => item.itemNum,
    _lionelBoxNum: n => n,
    _smSlotHtml: () => '<!--SM-SLOT-->',   // v0.9.1896: our service-manual scans (own suite: service_manual_links_tests.js)
    _tzLiveRefresh: () => null,            // 2026-11-03: the site's Trainz list, read in the background (own suite: trainz_live_tests.js)
    _tzLabel: e => 'GP-7, GP-9',            // 2026-11-07: the short label (own checks: one_catalog_row_tests.js D13–D16)
  };
  const names = Object.keys(env);
  // 2026-11-07: _maintRouteLabel went with the LCCA button; the v0.9.2117 copy (planted below) still has it
  const fn = new Function(...names, grab(src, '_maintDiagramLinksHtml') + '\n' + (src.indexOf('function _maintRouteLabel(') >= 0 ? grab(src, '_maintRouteLabel') : '') + '\n_tzLabel = _tzLabel || function (e) { return e.t; };\nreturn _maintDiagramLinksHtml;');
  return fn(...names.map(n => env[n]))(item, opts.where || '');
}
const GP7 = { itemNum: '2338', roadName: 'Milwaukee Road' };

section('A · one builder, two callers, no copies');
ok('_maintDiagramLinksHtml exists and takes (item, where)', /function _maintDiagramLinksHtml\(item, where\)/.test(maint));
ok('the panel\'s docs section is built by it (where = \'\')', /sec\('Manuals &amp; Parts Diagrams', _maintDiagramLinksHtml\(item, ''\), 'docs'\)/.test(maint));
// v0.9.1898: the Need-a-part box became a "Parts diagrams" button; its pop-up (_dgListHtml) is the second caller
ok('the Parts diagrams pop-up beside Need-a-part is built by it (where = \'pop\'), after the saved diagrams',
   /_dgSavedHtml\(item\) \+ _maintDiagramLinksHtml\(item, 'pop'\)/.test(maint));
// v0.9.1859 ([stated] Brad: "on this page, would like to be able to click the parts diagram…"): the box is FIRST, above the drawer / catalog lanes
ok('the Parts diagrams button comes right after the pop-up\'s header, before the picker and the catalog',
   (() => { const pop = maint.slice(maint.indexOf('window._maintPartsPopup = function'), maint.indexOf('// ══ v0.9.1898: the Parts diagrams pop-up')); const a = pop.indexOf('onclick="_maintDiagramsOpen()"'), b = pop.indexOf('_maintPickerHtml(tg, taskId)'), c = pop.indexOf('Find the part'); return a > 0 && a < b && b < c; })());
ok('the popup no longer sends the user away (its "Find manuals & diagrams →" walk-away button is gone; the launcher\'s own button stays)', !/Find manuals &amp; diagrams \u2192<\/button>/.test(maint) && /_maintShowGrp\(\\'docs\\'\)" ' \+ bigBtn \+ '>Find manuals &amp; diagrams</.test(maint));
const once = (re) => (maint.match(re) || []).length === 1;
ok('the Google button is written ONCE in the file', once(/>Google the parts diagram \u2192<\/button>/g));
ok('the Trainz button is written ONCE', once(/>Trainz diagram: ' \+ _esc\(_tzLabel\(tzd, item\.itemNum\)\)/g));
// 2026-11-07 ([stated] Brad: "Remove the LCCA 'Service Manual pages' button completely"): no LCCA button, no LCCA label is left
ok('no LCCA button is written anywhere', !/_maintLccaGo\(/.test(maint.replace(/\/\/[^\n]*/g, '')) && !/\(LCCA members\)/.test(maint));

section('B · (retired 2026-11-07 — the LCCA note went with the LCCA button)');

section('C · the real builder, run');
const desk = build(maint, GP7);
ok('postwar 2338 on the desktop: NO LCCA button any more (2026-11-07)', !/_maintLccaGo\(/.test(desk) && !/LCCA/.test(desk));
ok('…the Trainz diagram button, to Trainz\'s current page', /trainz\.com\/pages\/parts-diagram\/lionel-2028-2328-2337-2338-2339-2346-2348-2329-parts-list-and-exploded-view-parts-diagram/.test(desk));
ok('…and the Google button with the maker, number and model words', /google\.com\/search\?q=[^"']*%22Lionel%22[^"']*%222338%22[^"']*GP-7/.test(desk) && /Google the parts diagram/.test(desk));
const pop = build(maint, GP7, { where: 'pop' });
ok('where = \'pop\': the same list, no LCCA note anywhere', !/maint-lcca-note/.test(pop) && /trainz\.com\/pages\/parts-diagram/.test(pop));
const phone = build(maint, GP7, { phone: true });
ok('on a phone: no LCCA button (v1846), Trainz + Google still there', !/_maintLccaGo\(/.test(phone) && /trainz\.com\/pages\/parts-diagram/.test(phone) && /Google the parts diagram/.test(phone));
// v0.9.1896: our service-manual scans come first, on phones too, postwar only
ok('postwar: our service-manual slot comes before the Trainz button', desk.indexOf('<!--SM-SLOT-->') >= 0 && desk.indexOf('<!--SM-SLOT-->') < desk.indexOf('trainz.com/pages/parts-diagram'));
ok('…and stays on a phone (Drive opens anywhere)', phone.indexOf('<!--SM-SLOT-->') >= 0);
ok('prewar (same LCCA route) gets no service-manual slot', build(maint, GP7, { era: 'prewar' }).indexOf('<!--SM-SLOT-->') < 0);
const noTz = build(maint, GP7, { tz: null });
ok('no Trainz diagram for this item: no Trainz button, Google still there', !/trainz\.com/.test(noTz) && /Google the parts diagram/.test(noTz));
const other = build(maint, { itemNum: '123' }, { route: 'other', maker: 'Weaver', tz: null });
ok('a maker with no parts list: the honest line, then Google', /does not publish a parts list/.test(other) && /Google the parts diagram/.test(other));

section('C2 · 2026-11-01: the Trainz diagram comes FIRST ([stated] Brad "add trainz parts diagrams above lionel parts diagram" → "yes")');
{
  // where each thing first appears in the drawn list (-1 = not drawn)
  const at = (h) => ({ sm: h.indexOf('<!--SM-SLOT-->'), tz: h.indexOf('trainz.com/pages/parts-diagram'), lcca: h.indexOf('_maintLccaGo('),
    lionel: h.indexOf('Lionel Support: search'), mth: h.indexOf('MTH Parts &amp; Sales'), google: h.indexOf('Google the parts diagram') });
  const order = (src) => ({
    pwDesk: at(build(src, GP7)), pwPhone: at(build(src, GP7, { phone: true })), prewar: at(build(src, GP7, { era: 'prewar' })),
    modern: at(build(src, { itemNum: '18860' }, { route: 'lionel', era: 'mpc' })), mth: at(build(src, { itemNum: '30-2101-1' }, { route: 'mth', era: 'mth_o', maker: 'MTH' })),
  });
  const rule = (o) => ({
    pwDesk: o.pwDesk.sm >= 0 && o.pwDesk.sm < o.pwDesk.tz && o.pwDesk.tz < o.pwDesk.google && o.pwDesk.lcca < 0,   // 2026-11-07: no LCCA row
    pwPhone: o.pwPhone.sm >= 0 && o.pwPhone.sm < o.pwPhone.tz && o.pwPhone.tz < o.pwPhone.google && o.pwPhone.lcca < 0,
    prewar: o.prewar.sm < 0 && o.prewar.tz >= 0 && o.prewar.tz < o.prewar.google && o.prewar.lcca < 0,
    modern: o.modern.tz >= 0 && o.modern.tz < o.modern.lionel && o.modern.lionel < o.modern.google,
    mth: o.mth.tz >= 0 && o.mth.tz < o.mth.mth && o.mth.mth < o.mth.google,
  });
  const o = order(maint), r = rule(o);
  ok('C2a a modern Lionel item: Trainz first, then Lionel Support, then Google', r.modern, JSON.stringify(o.modern));
  ok('C2b another maker (MTH): Trainz first, then the maker\'s own row', r.mth, JSON.stringify(o.mth));
  ok('C2c a Lionel POSTWAR item: the service manual sheets FIRST (Brad\'s 2026-10-08 standard), Trainz right after, then Google (no LCCA since 2026-11-07)', r.pwDesk, JSON.stringify(o.pwDesk));
  ok('C2d …the same on a phone (no LCCA button there)', r.pwPhone, JSON.stringify(o.pwPhone));
  ok('C2e a prewar item (no service manual sheets): Trainz first, then Google', r.prewar, JSON.stringify(o.prewar));
  ok('C2f the Trainz buttons are drawn ONCE per list', (build(maint, { itemNum: '18860' }, { route: 'lionel', era: 'mpc' }).match(/trainz\.com\/pages\/parts-diagram/g) || []).length === 1);
  // PLANTED: the old place (after the maker's row, just above Google)
  const old = maint.replace("    if (route !== 'lcca') h += tzHtml;\n", '').replace('    // (the Trainz buttons moved to the top of this list — see tzHtml above)\n', '    h += tzHtml;\n')
    .replace("      h += tzHtml;   // 2026-11-01: right after the service manual sheets (a prewar item has none: Trainz first)\n", '');
  const ro = rule(order(old));
  // (2026-11-07: with no LCCA row a prewar list is Trainz then Google either way, so C2e no longer separates the two)
  ok('C2g PLANTED: Trainz back at the bottom → C2a and C2b fail', old !== maint && !ro.modern && !ro.mth);
  // PLANTED: Trainz above Brad's own service manual sheets on a postwar item
  const above = maint.replace("      if (String(eraKey || '').toLowerCase() === 'pw') h += _smSlotHtml(item, where);\n      h += tzHtml;",
    "      h += tzHtml;\n      if (String(eraKey || '').toLowerCase() === 'pw') h += _smSlotHtml(item, where);");
  ok('C2h PLANTED: Trainz above the postwar service manual sheets → C2c fails', above !== maint && !rule(order(above)).pwDesk);
}

section('D · planted offenders are caught');
ok('D0 the button moved back under the catalog is caught', (() => { const pop = "window._maintPartsPopup = function () { x = _maintPickerHtml(tg, taskId) + 'Find the part' + 'onclick=\"_maintDiagramsOpen()\"'; };"; const a = pop.indexOf('onclick="_maintDiagramsOpen()"'), b = pop.indexOf('_maintPickerHtml(tg, taskId)'); return !(a > 0 && a < b); })());
ok('D1 the popup going back to the walk-away button is caught', /Find manuals &amp; diagrams \u2192<\/button>/.test(maint.replace("_maintDiagramLinksHtml(item, 'pop')", "'<button>Find manuals &amp; diagrams \u2192</button>'")));
ok('D2 a second Google button pasted into the popup is caught', !(() => { const o = maint + "\n// x\n'>Google the parts diagram \u2192</button>'"; return (o.match(/>Google the parts diagram \u2192<\/button>/g) || []).length === 1; })());
ok('D3 the popup calling the builder WITHOUT its own where (two notes, one id) is caught',
   !/_maintDiagramLinksHtml\(item, 'pop'\)/.test(maint.replace("_maintDiagramLinksHtml(item, 'pop')", "_maintDiagramLinksHtml(item, '')")));
// D4/D5 retired 2026-11-07 with the LCCA button; its planted offender is the v0.9.2117 file:
{
  let old = '';
  try { old = require('child_process').execSync('git show fb3beb1c:app/maintenance.js', { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) {}
  ok('D4 the v0.9.2117 builder (LCCA button on the desktop) is caught by the run', !!old && /_maintLccaGo\(/.test(build(old, GP7)), old ? '' : 'git history needed');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
