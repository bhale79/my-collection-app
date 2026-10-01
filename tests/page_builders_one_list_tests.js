// ═══════════════════════════════════════════════════════════════
// page_builders_one_list_tests.js — v0.9.1847.
//
// [stated] Brad, 2026-10-01, with a screenshot: "when you hit the update button
// on the desktop, you get this" — the menu with every count, and a blank page
// area. Asked: clicking the page does nothing; clicking Dashboard or any menu
// item brings it back.
//
// WHY: the update reload returns you to the page you were on with a bare
// showPage(name). showPage only filled in the pages on ITS OWN list; the
// Workbench, Yardmaster's Office and Dispatch Board were filled in by their
// menu BUTTONS, and an item's page needs an item the reload has forgotten. So
// coming back to any of those showed an empty page. There were three lists of
// "how to fill in page X" — showPage's, the Back button's (_rrGoBackTo) and the
// menu buttons' — and they disagreed.
//
// THE RULES THIS SUITE PROTECTS:
//   1. ONE list: config.js RR_PAGE_BUILDERS / rrRegisterPage / rrBuildPage, and
//      showPage — the one door — fills every page in through it.
//   2. Every page an app script creates for itself (pg.id = 'page-x') has a
//      builder on the list; its menu buttons call showPage and nothing more.
//   3. showPage and the Back button keep no builder list of their own.
//   4. After an update: the page you were on comes back FILLED IN; an item's
//      page is not returned to; and a page still empty after a moment gives way
//      to the Dashboard — never a blank screen.
// The real code is lifted and RUN (config.js registry, app.js showPage, the
// index.html resume); every rule is proven able to fail on a planted offender,
// the v1846 code among them.
// Run:  node tests/page_builders_one_list_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const APP = path.join(__dirname, '..', 'app');
const rd = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
const cfg = rd('config.js'), app = rd('app.js'), html = rd('index.html');

function grabFrom(src, sig) {
  const i = src.indexOf(sig); if (i < 0) return '';
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  return '';
}

// ── a small fake page: pages, nav, timers ──────────────────────────────────
function makeRoom(pageNames) {
  const pages = {};
  const mkEl = (id) => {
    const el = { id, _text: '', _kids: [], classList: null, scrollTop: 0,
      get textContent() { return this._text; },
      querySelector(sel) { return this._kids.find(k => sel.split(',').indexOf(k) >= 0) || null; },
      insertBefore() {}, remove() {} };
    const set = new Set();
    el.classList = { add: (c) => set.add(c), remove: (c) => set.delete(c), contains: (c) => set.has(c), toggle() {} };
    return el;
  };
  pageNames.forEach(n => { pages['page-' + n] = mkEl('page-' + n); });
  pages['page-dashboard']._text = 'Dashboard cards';
  pages['page-dashboard'].classList.add('active');
  const main = mkEl('main-content');
  const timers = [];
  const store = {};
  const win = {
    console,
    sessionStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    history: { pushState() {} },
    document: {
      getElementById: (id) => (id === 'main-content' ? main : (pages[id] || null)),
      querySelectorAll: (sel) => (sel === '.page' ? Object.values(pages) : []),
      createElement: () => mkEl('x'),
    },
    setInterval: (fn) => { timers.push({ fn, every: true, dead: false }); return timers.length; },
    clearInterval: (i) => { if (timers[i - 1]) timers[i - 1].dead = true; },
    setTimeout: (fn) => { timers.push({ fn, every: false, dead: false }); return timers.length; },
    _navSuppressHistory: false,
    rrPageShown: () => {},
  };
  win.window = win;
  // run every pending timer until nothing is left (intervals tick up to 100 times)
  win.flush = function () {
    for (let round = 0; round < 100; round++) {
      const live = timers.filter(t => !t.dead);
      if (!live.length) return;
      live.forEach(t => { if (!t.dead) { if (!t.every) t.dead = true; t.fn(); } });
    }
  };
  return { win, pages, store };
}
const active = (pages) => Object.keys(pages).filter(k => pages[k].classList.contains('active')).map(k => k.slice(5));

// Lift the pieces.
const REG_START = 'window.RR_PAGE_BUILDERS =';
const regSrc = (function () {
  const i = cfg.indexOf(REG_START); if (i < 0) return '';
  const j = cfg.indexOf('// ── v0.9.1791', i); return j < 0 ? '' : cfg.slice(i, j);
})();
const showPageSrc = grabFrom(app, 'function showPage(name, clickedEl)');
function resumeBlockOf(h) {
  const a = h.indexOf("var want = '';"); if (a < 0) return '';
  const start = h.lastIndexOf('(function () {', a);
  const end = h.indexOf('})();', a);
  return (start < 0 || end < 0) ? '' : h.slice(start, end + 5);
}
const resumeSrc = resumeBlockOf(html);

function boot(opts) {
  const names = ['dashboard', 'browse', 'workbench', 'yardmaster', 'dispatch', 'itemdetail', 'forsale'];
  const room = makeRoom(names);
  const w = room.win;
  const run = (src) => new Function('window', 'document', 'sessionStorage', 'history', 'setInterval', 'clearInterval', 'setTimeout', 'rrPageShown',
    'with (window) {' + src + '\n}')(w, w.document, w.sessionStorage, w.history, w.setInterval, w.clearInterval, w.setTimeout, w.rrPageShown);
  run(opts.regSrc != null ? opts.regSrc : regSrc);
  const built = [];
  // the dynamic pages' builders, as maintenance/yardmaster/dispatch register them
  ['workbench', 'yardmaster', 'dispatch'].forEach(n => w.rrRegisterPage && w.rrRegisterPage(n, () => { built.push(n); room.pages['page-' + n]._text = n + ' content'; }));
  if (w.rrRegisterPage) w.rrRegisterPage('forsale', () => { built.push('forsale'); room.pages['page-forsale']._text = 'for sale list'; });
  run((opts.showPageSrc || showPageSrc) + '\nwindow.showPage = showPage;');
  w.showPage = w.window.showPage;
  if (opts.want) room.store.rr_resume_page = opts.want;
  run(opts.resumeSrc || resumeSrc);
  w.flush();
  return { room, built };
}

// ── A · the pieces are where they should be ────────────────────────────────
section('A · lifted');
ok('config.js registry lifted', /rrRegisterPage/.test(regSrc) && /rrBuildPage/.test(regSrc));
ok('showPage lifted', showPageSrc.length > 500);
ok('the after-update resume lifted', /rr_resume_page/.test(resumeSrc));

// ── B · after an update, the page comes back FILLED IN ─────────────────────
section('B · the update resume, run');
['workbench', 'yardmaster', 'dispatch', 'forsale'].forEach(function (pg) {
  const r = boot({ want: pg });
  ok('back on ' + pg + ' after the update', active(r.room.pages).join() === pg, active(r.room.pages).join());
  ok(pg + ' is filled in, not blank', r.built.indexOf(pg) >= 0 && r.room.pages['page-' + pg].textContent.length > 0);
});
const rItem = boot({ want: 'itemdetail' });
ok('an item\'s page is NOT returned to — the Dashboard stays', active(rItem.room.pages).join() === 'dashboard', active(rItem.room.pages).join());
const rFresh = boot({});
ok('a fresh visit stays on the Dashboard', active(rFresh.room.pages).join() === 'dashboard');

// The safety net: a page with no builder that comes back empty → the Dashboard.
const rNet = boot({ want: 'workbench', regSrc: regSrc + "\nwindow.rrRegisterPage = function () {};" });
ok('safety net: a page still empty after the return gives way to the Dashboard',
   active(rNet.room.pages).join() === 'dashboard', active(rNet.room.pages).join());

// ── C · showPage builds through the ONE list, from any door ────────────────
section('C · showPage fills in every page on the list');
{
  const r = boot({});
  ['workbench', 'yardmaster', 'dispatch', 'forsale'].forEach(function (pg) {
    r.built.length = 0;
    r.room.win.showPage(pg);
    ok('showPage(\'' + pg + '\') builds it exactly once', r.built.filter(x => x === pg).length === 1, r.built.join());
  });
}
ok('showPage calls rrBuildPage(name)', /rrBuildPage\(name\);/.test(showPageSrc));
ok('showPage keeps no builder list of its own', !/if \(name === '[a-z-]+'[^)]*\)\s*(?:render|build|vault)\w*\(/.test(showPageSrc));
const goBack = grabFrom(app, 'function _rrGoBackTo(name)');
ok('the Back button keeps no builder list of its own (dashboard only)',
   goBack.length > 0 && !/build(ForSale|Upgrade|Want|Parts|Sets|Prefs|Tools|Contacts)Page|vaultRenderPage/.test(goBack) && /buildDashboard/.test(goBack));
ok('the dashboard is NOT on the list (showing it must not rebuild it, v1834)', !/rrRegisterPage\('dashboard'/.test(fs.readdirSync(APP).filter(f => f.endsWith('.js')).map(rd).join('\n')));

// ── D · every page a script creates has a builder; its buttons only show it ─
section('D · every self-made page is on the list');
function selfMadePages(files) {
  const out = [];
  // a PAGE is an element given class "page" — the Back-to-Dashboard bar's id
  // (page-back-dash) starts the same way and is not one
  files.forEach(function (src) { const re = /className\s*=\s*'page';[\s\S]{0,80}?\.id\s*=\s*'page-([a-z-]+)'/g; let m; while ((m = re.exec(src))) out.push(m[1]); });
  return out;
}
const jsFiles = fs.readdirSync(APP).filter(f => f.endsWith('.js'));
const allJs = jsFiles.map(rd).join('\n');
// photo-inbox builds its page itself through _pinGo (its own door, resumed by name in index.html)
const SELF_DOOR = { 'photo-inbox': '_pinGo' };
function unlisted(pagesMade, src) {
  return pagesMade.filter(p => !SELF_DOOR[p] && !new RegExp("rrRegisterPage\\('" + p + "'").test(src));
}
const made = selfMadePages(jsFiles.map(rd));
ok('found the self-made pages (workbench, yardmaster, dispatch, photo-inbox)',
   ['workbench', 'yardmaster', 'dispatch', 'photo-inbox'].every(p => made.indexOf(p) >= 0), made.join());
ok('every self-made page has a builder on the list', unlisted(made, allJs).length === 0, unlisted(made, allJs).join());
ok('photo-inbox\'s own door is still resumed by name', /_pinGo/.test(resumeSrc));
const BTN_THEN_BUILD = /showPage\('(workbench|yardmaster|dispatch)'[^;]*\);\s*(?:ymBuildPage|dbBuildPage|_wbBuild|_loadLog)\(/;
ok('no button shows one of them and then builds it itself', !BTN_THEN_BUILD.test(allJs), (allJs.match(BTN_THEN_BUILD) || [''])[0]);

// ── E · offenders ──────────────────────────────────────────────────────────
section('E · planted offenders are caught');
let v1846html = '';
try { v1846html = execSync('git show ae701a87:app/index.html', { cwd: path.join(__dirname, '..'), stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch (e) {}
const oldResume = v1846html ? resumeBlockOf(v1846html) : resumeSrc.replace(" || want === 'itemdetail'", '').replace(/\/\/ v0\.9\.1847 safety net[\s\S]*?\}, 1500\);/, '');
{
  // E1 — v1846's resume + v1846's showPage (no list): Workbench comes back blank
  const oldShow = showPageSrc.replace('rrBuildPage(name);', '');
  const r = boot({ want: 'workbench', resumeSrc: oldResume, showPageSrc: oldShow });
  ok('E1 v1846 (bare resume, no list) leaves Workbench blank — reproduced',
     active(r.room.pages).join() === 'workbench' && r.room.pages['page-workbench'].textContent === '');
  // E2 — v1846's resume returns to an item's page
  const r2 = boot({ want: 'itemdetail', resumeSrc: oldResume });
  ok('E2 v1846 returns to an empty item page — reproduced', active(r2.room.pages).join() === 'itemdetail');
}
ok('E3 a showPage with its own chain is caught',
   /if \(name === '[a-z-]+'[^)]*\)\s*(?:render|build|vault)\w*\(/.test(showPageSrc.replace('rrBuildPage(name);', "if (name === 'sold') buildSoldPage();")));
ok('E4 a self-made page with no builder is caught',
   unlisted(selfMadePages(["pg.className = 'page'; pg.id = 'page-trainshow';"]), allJs).join() === 'trainshow');
ok('E5 a button that builds after showing is caught',
   BTN_THEN_BUILD.test("btn.onclick = function () { showPage('dispatch', this); dbBuildPage(); };"));
ok('E6 a Back button with its own list is caught',
   /build(ForSale|Upgrade|Want|Parts|Sets|Prefs|Tools|Contacts)Page|vaultRenderPage/.test(goBack + "\nelse if (name === 'forsale') buildForSalePage();"));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
