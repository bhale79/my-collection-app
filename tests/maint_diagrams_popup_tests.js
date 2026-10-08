// ═══════════════════════════════════════════════════════════════
// maint_diagrams_popup_tests.js — v0.9.1898.
//
// [stated] Brad, 2026-10-08: "the service manuals and parts diagrams need to be
// a button that says parts diagrams, that pops up the service manuals, the
// trainz diagram, and google search on a movable pop up so you can scroll up
// and down while still looking at the find your part screen. if you hit the
// button, the manual pop up should go to the right screen side and the find
// your part screen should move to the left side." + "no on the video, that
// stays only on the repair video section". Approved with it: a manual
// section's sheets scroll INSIDE the pop-up ("← All diagrams" goes back); a
// phone gets it full screen with "← Back to Find your part".
//
// THE RULES THIS SUITE PROTECTS — run in real Chromium, on the REAL code
// lifted out of maintenance.js (the service-manual block + the pop-up block),
// with the app's own app.css, so sizes and positions are measured, not read:
//   A. Need-a-part shows ONE "Parts diagrams" button where the box was, and no
//      saved-doc list of its own.
//   B. On a computer the pop-up opens on the RIGHT half and Need-a-part moves
//      to the LEFT half; both stay usable.
//   C. It lists the Lionel Service Manual sections, Trainz and Google (the one
//      builder), the saved diagrams — and never a saved video.
//   D. A section's sheets open INSIDE the pop-up (no full-screen viewer on
//      top); "← All diagrams" goes back.
//   E. It moves: dragging the title bar moves it; a press on the ✕ does not.
//   F. ✕ closes it and Need-a-part comes back to the middle; Need-a-part
//      closing takes it along; device Back (the guard's close) does what ✕ does.
//   G. A phone: full screen, "← Back to Find your part", nothing shifted.
// Every rule is proven able to fail on a planted offender.
// Run:  node tests/maint_diagrams_popup_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let chromium;
try { chromium = require('playwright').chromium; } catch (e) { console.log('FAIL  playwright missing'); process.exit(1); }
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const APP = path.join(__dirname, '..', 'app');
const maint = fs.readFileSync(path.join(APP, 'maintenance.js'), 'utf8');
const css = fs.readFileSync(path.join(APP, 'app.css'), 'utf8');

function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find function ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + name);
}
function smBlock(src) { const a = src.indexOf('var _SM_CACHE_KEY'); const fn = grab(src, '_smSlotHtml'); return src.slice(a, src.indexOf(fn) + fn.length); }
function dgBlock(src) { const a = src.indexOf("  var DG_ID = 'maint-diagrams-pop';"); const b = src.indexOf('  window._maintPopSearch = function () {'); if (a < 0 || b < a) throw new Error('pop-up block not found'); return src.slice(a, b); }

// the tab, in its own shape (rows from the live tab, 2026-10-08)
const D = id => 'https://drive.google.com/file/d/' + id + '/view';
const HDR = ['Sheet ID', 'Section', 'Page', 'Date printed', 'Page type', 'Covers items', 'Scan link', 'Back scan link', 'Covers (closest similar)'];
const VALUES = [HDR,
  ['SM-0400', 'LOC 2328', 'page 3', '4-57', 'Parts diagram', '2328, 2338', D('b0'), '', ''],
  ['SM-0401', 'LOC 2328', 'page 3', '1-59', 'Parts diagram', '2328, 2338', D('b1'), '', ''],
  ['SM-0402', 'LOC 2328', 'page 2', '12-58', 'Parts diagram', '2328, 2338', D('b2'), '', ''],
  ['SM-0403', 'LOC 2328', 'PL', '10-59', 'Parts list', '2328, 2338', D('b3'), D('b3b'), ''],
];
// the page: Need-a-part as the app draws it (fixed, full screen, a card in it)
const PAGE = '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '</style></head><body style="margin:0">'
  + '<div id="maint-parts-pop" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100030;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:2rem 1rem">'
  + '<div class="rr-card maint-card" style="max-width:520px"><input id="maint-pop-part"><div style="height:1500px">Find your part</div></div></div></body></html>';

function harness(src) {
  return `(function () {
    var state = window.state = { masterSheetId: 'M', masterVersion: { v: '1' }, myManuals: [
      { title: '2338 gp7 reassemble step by step', url: 'https://youtube.com/watch?v=x', type: 'video', covers: '2338' },
      { title: 'My GP7 exploded view', url: 'https://drive.google.com/file/d/mine/view', type: 'picture', covers: '2338' } ] };
    var SERVICE_MANUAL_TAB = 'Lionel PW - Service Manual', CATALOG_REFRESH_MAX_AGE_DAYS = 7, MASTER_SHEET_ID = 'M';
    var sheetsGet = function () { return Promise.resolve({ values: ${JSON.stringify(VALUES)} }); };
    var SECT = 'font-size:0.72rem;text-transform:uppercase;margin-bottom:0.6rem';
    function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
    function rrJsArg(v) { return _esc(String(v == null ? '' : v).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'")); }
    function _btn(c, size, extra) { return 'class="maint-btn" style="padding:0.5rem 0.8rem' + (extra ? ';' + extra : '') + '"'; }
    function _btnQuiet(size, extra) { return _btn('', size, extra); }
    function _btnSecondary() { return 'class="btn btn-secondary"'; }
    function _cardOpen(maxW) { return '<div class="rr-card maint-card" style="max-width:' + (maxW || 520) + 'px;margin-bottom:2rem">'; }
    function _cardFoot(i) { return '<div>' + i + '</div>'; }
    function _cardHead(context, title, closeJs) { return '<div style="display:flex;justify-content:space-between"><div><div class="modal-item-num">' + context + '</div><div class="rr-card-title">' + title + '</div></div>'
      + (closeJs ? '<button class="btn-close" id="dg-x" onclick="' + closeJs + '" aria-label="Close">&#x2715;</button>' : '') + '</div>'; }
    var ITEM = { itemNum: '2338', _era: 'pw' };
    function _target() { return { item: document.getElementById('maint-parts-pop') ? ITEM : ITEM }; }
    ${grab(maint, '_docCovers')}
    window.__guard = { n: 0, close: null };
    window.rrDismissGuard = function (ov, closeFn) { window.__guard.n++; window.__guard.close = closeFn; };
    ${smBlock(src)}
    // the one builder, cut to what it draws here: our sections first, then Trainz and Google
    function _maintDiagramLinksHtml(item, where) { return _smSlotHtml(item, where) + '<button id="tz">Trainz diagram: 2328 \\u2192</button><button id="gg">Google the parts diagram \\u2192</button>'; }
    ${dgBlock(src)}
    window.__smLoad = _smLoad;
  })();`;
}
async function open(browser, src, opts) {
  opts = opts || {};
  const page = await browser.newPage({ viewport: opts.phone ? { width: 400, height: 800 } : { width: 1600, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.setContent(PAGE);
  await page.evaluate(m => { window.IS_MOBILE_UA = m; }, !!opts.phone);
  await page.addScriptTag({ content: harness(src) });
  await page.evaluate(() => window.__smLoad());
  await page.evaluate(() => window._maintDiagramsOpen());
  page.__errs = errs;
  return page;
}
const rect = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width }; }, sel);
const has = (page, sel) => page.evaluate(s => !!document.querySelector(s), sel);
const text = (page, sel) => page.evaluate(s => (document.querySelector(s) || {}).innerText || '', sel);

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    section('A · Need-a-part: one "Parts diagrams" button, no list of its own');
    const popSrc = maint.slice(maint.indexOf('window._maintPartsPopup = function'), maint.indexOf('// ══ v0.9.1898: the Parts diagrams pop-up'));
    ok('the button is there, labelled "Parts diagrams"', /onclick="_maintDiagramsOpen\(\)" ' \+ _btn\('blue'[^)]*\) \+ '>Parts diagrams \\u2192<\/button>/.test(popSrc));
    ok('Need-a-part no longer lists saved docs or calls the builder itself', popSrc.indexOf('_docCovers(') < 0 && popSrc.indexOf('_maintDiagramLinksHtml(') < 0);
    ok('…and its store bar / Search / + Add sit above the typing box', popSrc.indexOf('_maintPopSearch()') < popSrc.indexOf('id="maint-pop-part"') && popSrc.indexOf('_maintPopAddWanted(') < popSrc.indexOf('id="maint-pop-part"'));

    section('B · a computer: the pop-up on the right half, Need-a-part on the left');
    let p = await open(browser, maint);
    const card = await rect(p, '#maint-dg-card'), pop = await rect(p, '#maint-parts-pop');
    ok('the pop-up is on the RIGHT half', card && card.l >= 800 - 1 && card.r <= 1600 + 1, JSON.stringify(card));
    ok('Need-a-part now fills only the LEFT half', pop && pop.r <= 800 + 1, JSON.stringify(pop));
    ok('Need-a-part\'s own card is inside the left half', (await rect(p, '#maint-parts-pop .rr-card')).r <= 800 + 1);
    ok('the half where Need-a-part sits is not covered — its typing box takes a click', await p.evaluate(() => { const r = document.getElementById('maint-pop-part').getBoundingClientRect(); const e = document.elementFromPoint(r.left + 5, r.top + 5); return e && e.id === 'maint-pop-part'; }));
    ok('guarded once (a stray tap never closes it; device Back does)', await p.evaluate(() => window.__guard.n) === 1);

    section('C · what it lists');
    const list = await text(p, '#maint-dg-body');
    ok('the Lionel Service Manual section button', /LOC 2328 — 4 sheets/.test(list), list.slice(0, 200));
    ok('Trainz and Google (the one builder)', await has(p, '#maint-dg-body #tz') && await has(p, '#maint-dg-body #gg'));
    ok('my saved diagram (a picture) is there', /My GP7 exploded view/.test(list));
    ok('my saved VIDEO is not', !/reassemble step by step/.test(list));
    ok('the heading is "Lionel Service Manual" — no "our scans", no explaining line', /Lionel Service Manual/.test(list) && !/our scans/.test(list) && !/from The Rail Roster's scans/.test(list));

    section('D · a section opens INSIDE the pop-up');
    await p.click('#maint-dg-body button:has-text("LOC 2328")');
    ok('the sheets are in the pop-up (4 pictures + the back of the parts list)', await p.evaluate(() => document.querySelectorAll('#maint-dg-body img').length) === 5);
    ok('…no full-screen viewer was put on top of Need-a-part', !(await has(p, '#maint-sm-viewer')));
    ok('…older printings at the end, under their label', /OLDER PRINTINGS|Older printings/.test(await text(p, '#maint-dg-body')));
    await p.click('#maint-dg-body button:has-text("All diagrams")');
    ok('"← All diagrams" goes back to the list', /LOC 2328 — 4 sheets/.test(await text(p, '#maint-dg-body')) && await p.evaluate(() => document.querySelectorAll('#maint-dg-body img').length) === 0);

    section('E · it moves');
    const before = await rect(p, '#maint-dg-card');
    const h = await p.evaluate(() => { const r = document.getElementById('maint-dg-head').getBoundingClientRect(); return { x: r.left + 40, y: r.top + 10 }; });
    await p.mouse.move(h.x, h.y); await p.mouse.down(); await p.mouse.move(h.x - 300, h.y + 50, { steps: 5 }); await p.mouse.up();
    const after = await rect(p, '#maint-dg-card');
    ok('dragging the title bar moves it with the pointer (300 px left)', Math.abs((before.l - after.l) - 300) <= 2, before.l + ' → ' + after.l);
    const x = await p.evaluate(() => { const r = document.getElementById('dg-x').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const t0 = await p.evaluate(() => document.getElementById('maint-diagrams-pop').style.transform);
    await p.mouse.move(x.x, x.y); await p.mouse.down(); await p.mouse.move(x.x - 200, x.y, { steps: 3 }); await p.mouse.up();
    ok('a press on the ✕ does not drag it', await p.evaluate(() => (document.getElementById('maint-diagrams-pop') || { style: {} }).style.transform) === t0 || !(await has(p, '#maint-diagrams-pop')));

    section('F · closing');
    await p.evaluate(() => { if (!document.getElementById('maint-diagrams-pop')) window._maintDiagramsOpen(); });
    await p.click('#dg-x');
    ok('✕ closes it', !(await has(p, '#maint-diagrams-pop')));
    ok('…and Need-a-part is back across the whole window', (await rect(p, '#maint-parts-pop')).r >= 1600 - 1);
    await p.evaluate(() => window._maintDiagramsOpen());
    await p.evaluate(() => window.__guard.close());
    ok('device Back runs the same close: gone, Need-a-part back in the middle', !(await has(p, '#maint-diagrams-pop')) && (await rect(p, '#maint-parts-pop')).r >= 1600 - 1);
    await p.evaluate(() => window._maintDiagramsOpen());
    await p.evaluate(() => document.getElementById('maint-parts-pop').remove());
    await p.waitForTimeout(50);
    ok('Need-a-part closing takes the pop-up with it', !(await has(p, '#maint-diagrams-pop')));
    ok('no page errors', p.__errs.length === 0, p.__errs.join(' | '));
    await p.close();

    section('G · a phone');
    p = await open(browser, maint, { phone: true });
    const pc = await rect(p, '#maint-diagrams-pop');
    ok('full screen, not side by side', pc && pc.l <= 1 && pc.w >= 399, JSON.stringify(pc));
    ok('Need-a-part is not shifted', (await rect(p, '#maint-parts-pop')).r >= 399);
    const back = p.locator('#maint-dg-body button', { hasText: 'Back to Find your part' });
    ok('"← Back to Find your part" is there', await back.count() === 1);
    await back.click();
    ok('…and it closes the pop-up', !(await has(p, '#maint-diagrams-pop')));
    await p.close();

    section('H · planted offenders are caught');
    async function caught(name, src, probe) {
      if (src === maint) { ok(name + ' (the plant did not apply)', false); return; }
      const q = await open(browser, src, probe.phone ? { phone: true } : {});
      let r = false; try { r = await probe(q); } catch (e) { r = true; }
      await q.close();
      ok(name, r);
    }
    await caught('H1 Need-a-part left in the middle (no shift) is caught',
      maint.replace('    _dgShiftPop(side);\n', ''), async q => (await rect(q, '#maint-parts-pop')).r > 801);
    await caught('H2 saved videos let back in is caught',
      maint.replace("return String(d.type || '') !== 'video';", 'return true;'), async q => /reassemble step by step/.test(await text(q, '#maint-dg-body')));
    await caught('H3 a section opening the full-screen viewer on top is caught',
      maint.replace("    if (where === 'pop' && _dgShowSection(num, secName, kind, hits)) return;\n", ''), async q => { await q.click('#maint-dg-body button:has-text("LOC 2328")'); return await has(q, '#maint-sm-viewer'); });
    await caught('H4 a pop-up left behind when Need-a-part closes is caught',
      maint.replace("if (!pop && mine) { window._maintDiagramsClose(); return; }", 'if (false) {}'), async q => { await q.evaluate(() => document.getElementById('maint-parts-pop').remove()); await q.waitForTimeout(50); return await has(q, '#maint-diagrams-pop'); });
    const phoneProbe = async q => (await rect(q, '#maint-diagrams-pop')).l > 1;
    phoneProbe.phone = true;
    await caught('H5 a phone forced side by side is caught',
      maint.replace("function _dgSideBySide() { return !window.IS_MOBILE_UA && (window.innerWidth || 0) >= DG_SIDE_MIN_W; }", 'function _dgSideBySide() { return true; }'), phoneProbe);
    await caught('H6 a ✕ that leaves Need-a-part on the left half is caught',
      maint.replace("    if (el && el.parentNode) el.parentNode.removeChild(el);\n    _dgShiftPop(false);", "    if (el && el.parentNode) el.parentNode.removeChild(el);"),
      async q => { await q.click('#dg-x'); await q.waitForTimeout(20); return (await rect(q, '#maint-parts-pop')).r < 1599; });
    await caught('H7 a drag that ignores the pointer is caught',
      maint.replace("el.style.transform = 'translate(' + Math.round(dx) + 'px,' + Math.round(dy) + 'px)';", ''),
      async q => { const b = await rect(q, '#maint-dg-card'); const hh = await q.evaluate(() => { const r = document.getElementById('maint-dg-head').getBoundingClientRect(); return { x: r.left + 40, y: r.top + 10 }; });
        await q.mouse.move(hh.x, hh.y); await q.mouse.down(); await q.mouse.move(hh.x - 300, hh.y, { steps: 5 }); await q.mouse.up(); return Math.abs(b.l - (await rect(q, '#maint-dg-card')).l) < 2; });
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL  crashed: ' + e.stack); process.exit(1); });
