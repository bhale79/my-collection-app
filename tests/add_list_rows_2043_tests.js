#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ADD STEP 1: THE MATCH LIST SHOWS THE MATCHES — v0.9.2043
// (real Chromium, the REAL wizard + app.css)
//
// Brad, 2026-10-29, the Add screen at 1920 wide with 773 typed: "we need to
// resize this as you can't see but one option at the bottom." Measured: with a
// steam engine's Engine Only / Engine + Tender row and the ADDING bar up, the
// list had room for NO whole match (pop-ups are drawn at 1.5x on a big window,
// the filter boxes were 69 px, each match two lines and 94 px). The old fit
// test (add_fit_1970) only asked that the FIRST match be on screen — so a
// one-row list passed. This one counts whole rows.
//
//   L1  his big screen (1920x970 and 1920x928), 773 typed, Engine/Tender row and
//       ADDING bar up: at least 4 whole matches in the list, nothing scrolls,
//       Next on screen
//   L2  his laptop (1536x737): at least 3 whole matches, nothing scrolls
//   L3  on a computer each match is ONE line (number · type · details · link)
//   L4  a field that repeats one already shown is shown once
//       ("4-6-4 Steam Locomotive · 4-6-4 Steam Locomotive")
//   L5  long details are cut with … and the whole text is on hover
//   L6  "How are you entering this item?" sits beside its buttons on a computer
//   L7  the filter boxes' height comes from ONE number (oneLineMinHeightPx)
//   L8  a phone keeps its two-line rows and the question above the buttons
//   P*  PLANTED: each change undone is caught
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  add_list_rows_2043_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 700))); cond ? pass++ : fail++; }
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
function planted(file, from, to, what) {
  const src = read(file), n = src.split(from).length - 1;
  if (n !== 1) throw new Error('planted ' + what + ': the anchor is in ' + file + ' ' + n + ' times; update this test');
  const o = {}; o[file] = src.replace(from, to); return o;
}

const LONG = 'Boxcar, with a long description that runs on well past the width of the list so it has to be cut short';
const mk = (n, t, d, road) => ({ itemNum: n, variation: '', itemType: t, roadName: road || '', description: d, _era: 'pw',
  _tab: 'Lionel PW - Items', manufacturer: 'Lionel', scale: 'O', refLink: 'http://www.cottcomp.com/x' });
const ROWS = [
  mk('773', 'Steam Locomotive', '4-6-4 Steam Locomotive', '4-6-4 Steam Locomotive'),   // road cell repeats the description (L4)
  mk('773W', 'Tender', 'Tender for 773'),
  mk('7730', 'Boxcar', 'Boxcar'),
  mk('77301', 'Boxcar', LONG),
  mk('7731', 'Flatcar', 'Flatcar'),
];

async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.h },
    userAgent: o.mobile ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36' : undefined });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    const name = base.slice(('file://' + APP + '/').length);
    if (o.files && Object.prototype.hasOwnProperty.call(o.files, name))
      return r.fulfill({ body: o.files[name], contentType: /\.css$/.test(name) ? 'text/css' : 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(rows => {
    try { _aiUsageMarkSeen(); } catch (e) {}
    // 773 has a tender, so step 1 asks Engine Only / Engine + Tender (the partner
    // map is built from the companions tab in the real app)
    window.getMatchingTenders = function (b) { return String(b) === '773' ? ['773W'] : []; };
    state.masterData = rows.slice(); try { _rebuildMasterIndex(); } catch (e) {}
    state.masterAllRows = rows.slice(); state.personalData = {};
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
  }, ROWS);
  return { pg, ctx, errs };
}

// Step 1 as Brad had it: 773 typed, then the step drawn again (the ADDING bar is
// drawn with the step) and the list refreshed.
async function step1(pg) {
  await pg.evaluate(async () => { openWizard('collection'); await new Promise(r => setTimeout(r, 400)); });
  const inp = await pg.$('#wiz-input');
  await inp.focus(); await pg.keyboard.type('773');
  await pg.waitForTimeout(1200);
  await pg.evaluate(async () => {
    renderWizardStep(); await new Promise(r => setTimeout(r, 300));
    const i = document.getElementById('wiz-input'); i.focus(); i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await pg.waitForTimeout(1200);
  return pg.evaluate(() => {
    const R = e => { if (!e) return null; const q = e.getBoundingClientRect(); return { t: Math.round(q.top), b: Math.round(q.bottom), l: Math.round(q.left), r: Math.round(q.right), h: Math.round(q.height) }; };
    const sug = document.getElementById('wiz-suggestions'), box = sug && sug.getBoundingClientRect();
    const rows = sug ? [...sug.querySelectorAll('[data-idx]')] : [];
    const whole = rows.filter(r => { const q = r.getBoundingClientRect(); return q.height > 10 && q.top >= box.top - 1 && q.bottom <= box.bottom + 1; }).length;
    const bd = document.getElementById('wizard-body'), nx = document.getElementById('wizard-next-btn');
    const grp = document.getElementById('wiz-grouping-btns');
    const lbl = grp && [...grp.querySelectorAll('div')].find(d => /How are you entering/i.test(d.textContent) && !d.querySelector('div'));
    const btns = grp ? [...grp.querySelectorAll('button')] : [];
    const one = rows.map(r => {
      const num = r.querySelector('.wiz-sug-l1 > span') || r.firstChild, det = r.querySelector('.wiz-sug-details');
      const a = num && num.getBoundingClientRect(), b = det && det.getBoundingClientRect();
      return { num: (num && num.textContent) || '', sameLine: !!(a && b && Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 8),
        details: det ? det.textContent : '', title: det ? det.title : '', cut: !!(det && det.scrollWidth > det.clientWidth + 1),
        ellipsis: det ? getComputedStyle(det).textOverflow : '' };
    });
    const sel = document.getElementById('wiz-search-era');
    const zoom = parseFloat(getComputedStyle(document.querySelector('#wizard-modal .modal')).zoom) || 1;
    return { vh: innerHeight, rows: rows.length, whole, over: bd.scrollHeight - bd.clientHeight, next: R(nx),
      banner: !!(document.getElementById('wizard-adding-banner') || {}).textContent, how: btns.some(b => /Engine \+ Tender/.test(b.textContent)),
      lbl: R(lbl), btn: R(btns[0]), one, selH: sel ? sel.getBoundingClientRect().height : 0, zoom,
      cfgH: (window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.sizing || {}).oneLineMinHeightPx };
  });
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let r, m;

  console.log('== L · the list on a computer ==');
  for (const [w, h, need] of [[1920, 970, 4], [1920, 928, 4], [1536, 737, 3]]) {
    r = await open(browser, { w, h });
    m = await step1(r.pg);
    T('L' + (w === 1536 ? '2' : '1') + ' ' + w + 'x' + h + ', 773 typed, Engine/Tender row and ADDING bar up: at least ' + need + ' whole matches, nothing scrolls, Next on screen',
      m.banner && m.how && m.whole >= need && m.over <= 0 && m.next.b <= m.vh,
      { banner: m.banner, how: m.how, whole: m.whole, rows: m.rows, over: m.over, next: m.next, vh: m.vh });
    if (w === 1920 && h === 970) {
      T('L3 on a computer every match is one line: the details sit beside the number', m.one.length === 5 && m.one.every(x => x.sameLine), m.one);
      const s773 = m.one.find(x => x.num === '773');
      T('L4 the 773\'s repeated road cell is shown once ("4-6-4 Steam Locomotive", not twice)', s773 && s773.details === '4-6-4 Steam Locomotive', s773);
      const lng = m.one.find(x => x.num === '77301');
      T('L5 a long description is cut with … and the whole text is on hover', lng && lng.cut && lng.ellipsis === 'ellipsis' && lng.title === LONG, lng);
      T('L6 "How are you entering this item?" sits beside its buttons, on the same line', m.lbl && m.btn && m.lbl.r <= m.btn.l && m.lbl.t < m.btn.b && m.lbl.b > m.btn.t, { lbl: m.lbl, btn: m.btn });
      T('L7 the filter boxes are oneLineMinHeightPx tall (×' + m.zoom + ' on this window), read from the config', m.cfgH === 34 && Math.abs(m.selH - m.cfgH * m.zoom) <= 2, { selH: m.selH, cfgH: m.cfgH, zoom: m.zoom });
      T('page errors (computer)', r.errs.length === 0, r.errs);
    }
    await r.ctx.close();
  }
  const WIZ = read('wizard.js');
  T('L7 one number: wizard.js reads oneLineMinHeightPx and types no box height of its own for the one-line row',
    /var _dropH = _oneLine \? \(sz\.oneLineMinHeightPx \|\| sz\.minHeightPx \|\| 44\)/.test(WIZ) && (WIZ.match(/min-height:' \+ _dropH \+ 'px/g) || []).length === 3,
    (WIZ.match(/min-height:' \+ _dropH \+ 'px/g) || []).length);

  console.log('== L8 · a phone ==');
  r = await open(browser, { w: 412, h: 860, mobile: true });
  m = await step1(r.pg);
  T('L8 a phone keeps two-line matches (details under the number)', m.one.length > 0 && m.one.every(x => !x.sameLine), m.one.map(x => x.sameLine));
  T('L8 …and the question above its buttons', m.lbl && m.btn && m.lbl.b <= m.btn.t + 1, { lbl: m.lbl, btn: m.btn });
  T('page errors (phone)', r.errs.length === 0, r.errs);
  await r.ctx.close();

  console.log('== P · planted ==');
  // the whole one-line block, as it stands in app.css
  const CSSF = read('app.css');
  const ROW_RULES = CSSF.split('\n').filter(l => l.indexOf('.wiz-ing-wide #wiz-suggestions .wiz-sug-') === 0);
  T('P0 the one-line block is five rules in app.css', ROW_RULES.length === 5, ROW_RULES.length);
  const noRows = { 'app.css': CSSF.split('\n').filter(l => l.indexOf('.wiz-ing-wide #wiz-suggestions .wiz-sug-') !== 0).join('\n') };
  for (const [label, files, check] of [
    ['P1 the one-line row rules removed: two-line rows again, and the big screen shows fewer than 4 whole matches (L1 would fail)',
      noRows, m => m.whole < 4 && !m.one.every(x => x.sameLine)],
    ['P2 the duplicate guard removed: the 773 says it twice (L4 would fail)',
      planted('wizard-suggestions.js', "if (!v.length || _detailsSeen[k]) return false;", "if (!v.length) return false;", 'P2'),
      m => (m.one.find(x => x.num === '773') || {}).details === '4-6-4 Steam Locomotive · 4-6-4 Steam Locomotive'],
    ['P3 the question put back above its buttons on a computer (L6 would fail)',
      planted('wizard-handlers.js', "let html = _isMobile ? '' : '<div class=\"wiz-grp-inline\">';", "let html = _isMobile ? '' : '<div>';", 'P3'),
      m => !(m.lbl && m.btn && m.lbl.r <= m.btn.l)],
    ['P4 the Add box held to 86% of the window again: fewer than 4 whole matches at 1920x928 (L1 would fail)',
      planted('app.css', '  #wizard-modal .modal { max-height: calc(94dvh / var(--rr-pop-zoom)) !important; }\n', '', 'P4'), m => m.whole < 4],
  ]) {
    r = await open(browser, { w: 1920, h: (label.indexOf('P4') === 0 ? 928 : 970), files });
    m = await step1(r.pg);
    T(label, check(m), { whole: m.whole, one: m.one.slice(0, 1), lbl: m.lbl, btn: m.btn });
    await r.ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
