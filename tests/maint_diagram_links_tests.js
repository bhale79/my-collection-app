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
    _modelWords: () => 'GP-7 diesel',
    rrSearchNumber: () => item.itemNum,
    _lionelBoxNum: n => n,
    _smSlotHtml: () => '<!--SM-SLOT-->',   // v0.9.1896: our service-manual scans (own suite: service_manual_links_tests.js)
  };
  const names = Object.keys(env);
  const fn = new Function(...names, grab(src, '_maintDiagramLinksHtml') + '\n' + grab(src, '_maintRouteLabel') + '\nreturn _maintDiagramLinksHtml;');
  return fn(...names.map(n => env[n]))(item, opts.where || '');
}
const GP7 = { itemNum: '2338', roadName: 'Milwaukee Road' };

section('A · one builder, two callers, no copies');
ok('_maintDiagramLinksHtml exists and takes (item, where)', /function _maintDiagramLinksHtml\(item, where\)/.test(maint));
ok('the panel\'s docs section is built by it (where = \'\')', /sec\('Manuals &amp; Parts Diagrams', _maintDiagramLinksHtml\(item, ''\), 'docs'\)/.test(maint));
ok('the Need-a-part popup\'s Parts diagram box is built by it (where = \'pop\'), after the saved docs',
   /'">Parts diagram<\/div>'\s*\n\s*\+\s*docHtml\s*\n[\s\S]{0,300}?_maintDiagramLinksHtml\(tg\.item, 'pop'\)/.test(maint));
// v0.9.1859 ([stated] Brad: "on this page, would like to be able to click the parts diagram…"): the box is FIRST, above the drawer / catalog lanes
ok('the Parts diagram box comes right after the pop-up\'s header, before the picker and the catalog',
   (() => { const pop = maint.slice(maint.indexOf('window._maintPartsPopup = function'), maint.indexOf('window._maintPopSearch = function')); const a = pop.indexOf('>Parts diagram</div>'), b = pop.indexOf('_maintPickerHtml(tg, taskId)'), c = pop.indexOf('Find the part'); return a > 0 && a < b && b < c; })());
ok('the popup no longer sends the user away (its "Find manuals & diagrams →" walk-away button is gone; the launcher\'s own button stays)', !/Find manuals &amp; diagrams \u2192<\/button>/.test(maint) && /_maintShowGrp\(\\'docs\\'\)" ' \+ bigBtn \+ '>Find manuals &amp; diagrams</.test(maint));
const once = (re) => (maint.match(re) || []).length === 1;
ok('the Google button is written ONCE in the file', once(/>Google the parts diagram \u2192<\/button>/g));
ok('the Trainz button is written ONCE', once(/>Trainz diagram: ' \+ _esc\(tzd\.t\)/g));
ok('the LCCA button is written ONCE', once(/_maintLccaGo\(\\'' \+ rrJsArg\(_docsUrl\(route, item\)\)/g));
ok('the panel keeps no private copy of the route / label (one place works them out)',
   !/var routeLabel = route === 'lcca'/.test(maint) && (maint.match(/var routeLabel = _maintRouteLabel\(/g) || []).length === 1);

section('B · the LCCA note is keyed by where');
ok('the note\'s id is noteId, built from where', /var noteId = 'maint-lcca-note' \+ \(where \? '-' \+ where : ''\);/.test(maint) && /'<div id="' \+ noteId \+ '" style="display:none/.test(maint));
ok('the LCCA button hands _maintLccaGo that id', /_maintLccaGo\(\\'' \+ rrJsArg\(_docsUrl\(route, item\)\) \+ '\\',\\'' \+ rrJsArg\(noteId\) \+ '\\'\)/.test(maint));
ok('_maintLccaGo(url, noteId) reads the note by that id (falls back to the panel\'s)', /window\._maintLccaGo = function \(url, noteId\)/.test(maint) && /document\.getElementById\(noteId \|\| 'maint-lcca-note'\)/.test(maint));

section('C · the real builder, run');
const desk = build(maint, GP7);
ok('postwar 2338 on the desktop: the LCCA Service Manual button', /_maintLccaGo\(/.test(desk) && /Service Manual pages for 2338 \(LCCA members\)/.test(desk));
ok('…the Trainz diagram button, to Trainz\'s current page', /trainz\.com\/pages\/parts-diagram\/lionel-2028-2328-2337-2338-2339-2346-2348-2329-parts-list-and-exploded-view-parts-diagram/.test(desk));
ok('…and the Google button with the maker, number and model words', /google\.com\/search\?q=[^"']*%22Lionel%22[^"']*%222338%22[^"']*GP-7/.test(desk) && /Google the parts diagram/.test(desk));
ok('…the note carries the PANEL id when where = \'\'', /id="maint-lcca-note"/.test(desk) && !/maint-lcca-note-/.test(desk));
const pop = build(maint, GP7, { where: 'pop' });
ok('where = \'pop\': the note carries the popup\'s own id, and the button names it', /id="maint-lcca-note-pop"/.test(pop) && /_maintLccaGo\([^)]*maint-lcca-note-pop/.test(pop) && !/id="maint-lcca-note"/.test(pop));
const phone = build(maint, GP7, { phone: true });
ok('on a phone: no LCCA button (v1846), Trainz + Google still there', !/_maintLccaGo\(/.test(phone) && /trainz\.com\/pages\/parts-diagram/.test(phone) && /Google the parts diagram/.test(phone));
// v0.9.1896: our service-manual scans sit ABOVE the LCCA button, on phones too, postwar only
ok('postwar: our service-manual slot comes before the LCCA button', desk.indexOf('<!--SM-SLOT-->') >= 0 && desk.indexOf('<!--SM-SLOT-->') < desk.indexOf('_maintLccaGo('));
ok('…and stays on a phone (Drive opens anywhere)', phone.indexOf('<!--SM-SLOT-->') >= 0);
ok('prewar (same LCCA route) gets no service-manual slot', build(maint, GP7, { era: 'prewar' }).indexOf('<!--SM-SLOT-->') < 0);
const noTz = build(maint, GP7, { tz: null });
ok('no Trainz diagram for this item: no Trainz button, Google still there', !/trainz\.com/.test(noTz) && /Google the parts diagram/.test(noTz));
const other = build(maint, { itemNum: '123' }, { route: 'other', maker: 'Weaver', tz: null });
ok('a maker with no parts list: the honest line, then Google', /does not publish a parts list/.test(other) && /Google the parts diagram/.test(other));

section('D · planted offenders are caught');
ok('D0 the box moved back under the catalog is caught', (() => { const pop = "window._maintPartsPopup = function () { x = _maintPickerHtml(tg, taskId) + 'Find the part' + '>Parts diagram</div>'; }; window._maintPopSearch = function () {}"; const a = pop.indexOf('>Parts diagram</div>'), b = pop.indexOf('_maintPickerHtml(tg, taskId)'); return !(a > 0 && a < b); })());
ok('D1 the popup going back to the walk-away button is caught', /Find manuals &amp; diagrams \u2192<\/button>/.test(maint.replace("_maintDiagramLinksHtml(tg.item, 'pop')", "'<button>Find manuals &amp; diagrams \u2192</button>'")));
ok('D2 a second Google button pasted into the popup is caught', !(() => { const o = maint + "\n// x\n'>Google the parts diagram \u2192</button>'"; return (o.match(/>Google the parts diagram \u2192<\/button>/g) || []).length === 1; })());
ok('D3 the popup calling the builder WITHOUT its own where (two notes, one id) is caught',
   !/_maintDiagramLinksHtml\(tg\.item, 'pop'\)/.test(maint.replace("_maintDiagramLinksHtml(tg.item, 'pop')", "_maintDiagramLinksHtml(tg.item, '')")));
ok('D4 a builder that ignores where is caught by the run', (() => { const o = maint.replace("var noteId = 'maint-lcca-note' + (where ? '-' + where : '');", "var noteId = 'maint-lcca-note';"); return !/maint-lcca-note-pop/.test(build(o, GP7, { where: 'pop' })); })());
ok('D5 the LCCA guard removed (button on a phone) is caught by the run', (() => { const o = maint.replace(/if \(!window\.IS_MOBILE_UA\) \{\n/, '{\n'); return o !== maint && /_maintLccaGo\(/.test(build(o, GP7, { phone: true })); })());

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
