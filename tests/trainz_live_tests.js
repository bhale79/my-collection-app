// ═══════════════════════════════════════════════════════════════════════════
//  trainz_live_tests.js — the Trainz diagram list that stays current on its own
//  (PLAN_2026-11-02_TRAINZ_DIAGRAMS_LIVE, Part 1; [stated] Brad 2026-11-03 "Yes")
//
//  Every Monday the crawl on Brad's PC publishes harvests/trainz-diagrams-live.json.
//  The app (maintenance.js, _TZ_LIVE) reads it in the background and uses it only
//  when it passes every check and is not older than the list built into the
//  release. This suite runs the REAL loader and the REAL matcher, cut out of
//  maintenance.js, against a fake site and a fake device:
//    A  the rules are not too tight: the real built-in list passes them, and so
//       does the published file when there is one
//    B  a good file is used, kept on the device, and its new diagrams get buttons
//    C  a missing, broken, wrong, short, unsafe or old file changes NOTHING
//    D  offline: the device's last good copy is used; a bad copy is ignored
//    E  the matching rules are unchanged — the same list gives the same buttons
//    F  the offline cache never answers for the file; the address is right
//    G  planted offenders: each broken loader below is caught
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), APP = path.join(ROOT, 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const MAINT = read('maintenance.js'), SW = read('sw.js'), CFG = read('trainz-diagrams-config.js'), TG = read('type-groups.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail).slice(0, 400) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function plant(src, a, b) { if (src.indexOf(a) < 0) throw new Error('plant target not found: ' + a.slice(0, 80)); return src.replace(a, b); }

// the matcher + the loader, exactly as maintenance.js has them
function block(src) {
  const a = src.indexOf('  var _tzLookup = null;'), b = src.indexOf('  // ── v0.9.1690: Maerklin');
  if (a < 0 || b < a) throw new Error('the Trainz block was not found in maintenance.js');
  return src.slice(a, b);
}
const BUILT = (() => { const w = {}; vm.runInNewContext(CFG, { window: w }); return { list: w.TRAINZ_DIAGRAMS, pulled: w.TRAINZ_DIAGRAMS_PULLED }; })();

// a sandbox: fake site (site: {status, text} | 'offline'), fake device (store)
function boot(src, opt) {
  opt = opt || {};
  const store = Object.assign({}, opt.store || {});
  const calls = [];
  const c = { console: { log() {}, warn() {}, error() {} }, JSON, Object, Array, String, RegExp, Promise, Error };
  c.window = c;
  c.localStorage = opt.noStorage
    ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }
    : { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  c.fetch = (url, init) => {
    calls.push({ url, init });
    const s = opt.site;
    if (!s || s === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
    return Promise.resolve({ ok: s.status === 200, status: s.status, json: () => Promise.resolve().then(() => JSON.parse(s.text)) });
  };
  vm.createContext(c);
  vm.runInContext(TG, c);
  vm.runInContext(CFG, c);
  vm.runInContext(block(src), c);
  return { c, store, calls,
    refresh: () => Promise.resolve(c._tzLiveRefresh()),
    hits: (num, era, type) => c._tzDiagrams({ itemNum: num, itemType: type || '', description: '' }, era || 'pw').map(e => e.h) };
}
const clone = x => JSON.parse(JSON.stringify(x));
function doc(over) {
  const d = Object.assign({ format: 'rr-trainz-diagrams-1', pulled: '2026-11-09', source: 'test', diagrams: clone(BUILT.list) }, over || {});
  if (!('count' in (over || {}))) d.count = Array.isArray(d.diagrams) ? d.diagrams.length : 0;
  return d;
}
// a new diagram Trainz adds after the built-in list was pulled (a number no real diagram holds)
const NEW = { n: '99887', t: 'Lionel 99887 Test Boxcar', h: 'lionel-99887-test-boxcar-parts-diagram' };
const withNew = () => doc({ diagrams: clone(BUILT.list).concat([NEW]) });
const site = d => ({ status: 200, text: typeof d === 'string' ? d : JSON.stringify(d) });

(async function main() {
  section('A · the rules fit the real lists');
  const L0 = boot(MAINT);
  ok('A1 the built-in list (' + BUILT.list.length + ' diagrams, pulled ' + BUILT.pulled + ') passes every check',
    L0.c._tzLiveCheck({ format: 'rr-trainz-diagrams-1', pulled: BUILT.pulled, count: BUILT.list.length, diagrams: BUILT.list }) === '');
  const PUB = path.join(ROOT, 'harvests', 'trainz-diagrams-live.json');
  if (fs.existsSync(PUB)) {
    const p = JSON.parse(fs.readFileSync(PUB, 'utf8'));
    ok('A2 the published harvests/trainz-diagrams-live.json passes every check', L0.c._tzLiveCheck(p) === '', L0.c._tzLiveCheck(p));
  } else ok('A2 (no published file yet — the built-in list is in use, as designed)', true);
  ok('A3 at start-up, with nothing on the device, the built-in list is in use', L0.c.TRAINZ_DIAGRAMS === L0.c._TZ_BUILT_IN.diagrams && !L0.c.TRAINZ_DIAGRAMS_SOURCE);

  section('B · a good file is used');
  {
    const L = boot(MAINT, { site: site(withNew()) });
    ok('B1 before the file arrives, the new boxcar has no button', L.hits('99887', 'pw', 'Boxcar').indexOf(NEW.h) < 0);
    const r = await L.refresh();
    ok('B2 the file is read and used', r === true && L.c.TRAINZ_DIAGRAMS_SOURCE === 'site' && L.c.TRAINZ_DIAGRAMS.length === BUILT.list.length + 1);
    ok('B3 …and the new boxcar now gets its button', L.hits('99887', 'pw', 'Boxcar').indexOf(NEW.h) >= 0, L.hits('99887', 'pw', 'Boxcar'));
    ok('B4 the good copy is kept on this device', JSON.parse(L.store.rr_tz_live_v1 || 'null') !== null && JSON.parse(L.store.rr_tz_live_v1).diagrams.length === BUILT.list.length + 1);
    ok('B5 it is asked for at /harvests/ on the same site, past the browser\'s cache', L.calls.length === 1 && L.calls[0].url === '../harvests/trainz-diagrams-live.json' && L.calls[0].init.cache === 'no-cache', L.calls);
    await L.refresh(); await L.refresh();
    ok('B6 asked for ONCE per open of the app, however many screens build links', L.calls.length === 1, L.calls.length);
    const renamed = clone(BUILT.list); const i2338 = renamed.findIndex(e => / 2338 /.test(' ' + e.n.replace(/\|/g, ' ') + ' '));
    renamed[i2338] = { n: renamed[i2338].n, t: renamed[i2338].t, h: 'lionel-gp-7-renamed-page-test' };
    const L2 = boot(MAINT, { site: site(doc({ diagrams: renamed })) });
    const before = L2.hits('2338', 'pw', 'Diesel Locomotive');
    await L2.refresh();
    ok('B7 a page Trainz renamed: the button follows the new page (2338 GP-7)', before.indexOf('lionel-gp-7-renamed-page-test') < 0 && L2.hits('2338', 'pw', 'Diesel Locomotive').indexOf('lionel-gp-7-renamed-page-test') >= 0, L2.hits('2338', 'pw', 'Diesel Locomotive'));
    const L3 = boot(MAINT, { site: site(withNew()), noStorage: true });
    ok('B8 a device that will not keep anything (private window) still uses the site list', await L3.refresh() === true && L3.c.TRAINZ_DIAGRAMS_SOURCE === 'site');
  }

  section('C · a bad file changes nothing');
  const bad = {
    'the file is missing (404)': { status: 404, text: 'Not found' },
    'the file is not JSON': site('<html>oops'),
    'the file is cut off half way': site(JSON.stringify(withNew()).slice(0, 5000)),
    'the wrong format': site(doc({ format: 'rr-trainz-diagrams-0' })),
    'no pulled date': site(doc({ pulled: 'last week' })),
    'only 599 diagrams': site(doc({ diagrams: clone(BUILT.list).slice(0, 599) })),
    'an empty list': site(doc({ diagrams: [] })),
    'the count does not match': site(doc({ count: 9 })),
    'two diagrams on one page': site(doc({ diagrams: clone(BUILT.list).concat([clone(BUILT.list[0])]) })),
    'a page name with a quote in it': site(doc({ diagrams: clone(BUILT.list).concat([{ n: '1', t: 'x', h: "x');alert(1);('" }]) })),
    'a page name with a slash': site(doc({ diagrams: clone(BUILT.list).concat([{ n: '1', t: 'x', h: '../../evil' }]) })),
    'a title over 60 characters': site(doc({ diagrams: clone(BUILT.list).concat([{ n: '1', t: 'x'.repeat(61), h: 'long-title' }]) })),
    'an entry with an extra field': site(doc({ diagrams: clone(BUILT.list).concat([{ n: '1', t: 'x', h: 'extra', url: 'https://elsewhere' }]) })),
    'item numbers with odd characters': site(doc({ diagrams: clone(BUILT.list).concat([{ n: '<b>', t: 'x', h: 'odd-numbers' }]) })),
    'a list older than the built-in one': site(doc({ pulled: '2026-09-01', diagrams: clone(BUILT.list).concat([NEW]), count: BUILT.list.length + 1 })),
    'the site cannot be reached': 'offline'
  };
  for (const why of Object.keys(bad)) {
    const L = boot(MAINT, { site: bad[why] });
    const r = await L.refresh();
    ok('C ' + why + ' → the built-in list stays, nothing is kept', r === false && L.c.TRAINZ_DIAGRAMS === L.c._TZ_BUILT_IN.diagrams && !('rr_tz_live_v1' in L.store) && L.hits('2338', 'pw', 'Diesel Locomotive').length > 0);
  }
  {
    const L = boot(MAINT, { site: site(withNew()) }); await L.refresh();
    const kept = L.store.rr_tz_live_v1;
    const L2 = boot(MAINT, { site: site('<html>oops'), store: { rr_tz_live_v1: kept } });
    await L2.refresh();
    ok('C a bad file after a good one → the device\'s good copy stays in use (and stays kept)', L2.c.TRAINZ_DIAGRAMS_SOURCE === 'device' && L2.store.rr_tz_live_v1 === kept && L2.hits('99887', 'pw', 'Boxcar').indexOf(NEW.h) >= 0);
  }

  section('D · offline, and the device\'s copy');
  {
    const L = boot(MAINT, { site: site(withNew()) }); await L.refresh();
    const kept = L.store.rr_tz_live_v1;
    const off = boot(MAINT, { site: 'offline', store: { rr_tz_live_v1: kept } });
    ok('D1 no signal: the last good copy is used from the moment the app opens', off.c.TRAINZ_DIAGRAMS_SOURCE === 'device' && off.hits('99887', 'pw', 'Boxcar').indexOf(NEW.h) >= 0);
    await off.refresh();
    ok('D2 …and the failed read does not take it away', off.c.TRAINZ_DIAGRAMS_SOURCE === 'device' && off.store.rr_tz_live_v1 === kept);
    const junk = boot(MAINT, { store: { rr_tz_live_v1: '{not json' } });
    ok('D3 a damaged copy on the device → the built-in list, no error', junk.c.TRAINZ_DIAGRAMS === junk.c._TZ_BUILT_IN.diagrams);
    const tamper = JSON.parse(kept); tamper.diagrams[0].h = 'bad page"name';
    const t = boot(MAINT, { store: { rr_tz_live_v1: JSON.stringify(tamper) } });
    ok('D4 a device copy that fails the checks is never used (checked every open, not trusted)', t.c.TRAINZ_DIAGRAMS === t.c._TZ_BUILT_IN.diagrams);
    const old = JSON.parse(kept); old.pulled = '2026-09-01';
    const o = boot(MAINT, { store: { rr_tz_live_v1: JSON.stringify(old) } });
    ok('D5 a device copy older than this release\'s built-in list → the built-in list (a newer release wins)', o.c.TRAINZ_DIAGRAMS === o.c._TZ_BUILT_IN.diagrams);
    const blocked = boot(MAINT, { noStorage: true });
    ok('D6 a device that refuses storage → the app still opens on the built-in list', blocked.c.TRAINZ_DIAGRAMS === blocked.c._TZ_BUILT_IN.diagrams);
    // the undo: last week's file put back on the site wins over this week's copy on the device
    const lastWeek = withNew(); lastWeek.pulled = '2026-11-02'; lastWeek.diagrams.pop(); lastWeek.count--;
    const thisWeek = withNew(); thisWeek.pulled = '2026-11-09';
    const u = boot(MAINT, { site: site(lastWeek), store: { rr_tz_live_v1: JSON.stringify(thisWeek) } });
    await u.refresh();
    ok('D7 the undo works: last week\'s file put back on the site replaces this week\'s copy on the device', u.c.TRAINZ_DIAGRAMS_PULLED === '2026-11-02' && u.hits('99887', 'pw', 'Boxcar').indexOf(NEW.h) < 0 && JSON.parse(u.store.rr_tz_live_v1).pulled === '2026-11-02');
  }

  section('E · the matching rules are unchanged');
  {
    const A = boot(MAINT), B = boot(MAINT, { site: site(doc()) });
    await B.refresh();
    const nums = new Set();
    BUILT.list.forEach(e => e.n.split('|').forEach(n => { if (n) { nums.add(n); nums.add(n + 'C'); if (/^6\d{4,}$/.test(n)) nums.add('6-' + n.slice(1)); } }));
    ['3562-25', '6436-110', '224P', '1654T', '2343C', '64-15', '44', '350', '18860'].forEach(n => nums.add(n));
    const eras = ['pw', 'prewar', 'mpc', 'mod', 'mod_s', 'af_gilbert', 'marx'];
    const types = ['', 'Steam Locomotive', 'Diesel Locomotive', 'Caboose', 'Accessory', 'Transformer/Power'];
    let n = 0, diff = [];
    for (const num of nums) for (const era of eras) for (const ty of types) {
      const a = A.hits(num, era, ty).join(','), b = B.hits(num, era, ty).join(',');
      n++; if (a !== b) diff.push([num, era, ty, a, b]);
    }
    ok('E1 the same list from the site gives the SAME buttons as the built-in list (' + n + ' item/era/type cases)', B.c.TRAINZ_DIAGRAMS_SOURCE === 'site' && diff.length === 0 && n > 10000, diff.slice(0, 3));
    ok('E2 the matcher still reads the one list in use (window.TRAINZ_DIAGRAMS), nothing else', /function _tzDiagrams\(item, eraKey\) \{\n    var list = window\.TRAINZ_DIAGRAMS;/.test(MAINT));
    const lines = MAINT.split('\n').filter(l => /TRAINZ_DIAGRAMS\s*=[^=]/.test(l) && !/^\s*\/\//.test(l));
    ok('E3 the list is swapped in ONE place (_tzUse) — no other line in the app assigns it', lines.length === 1 && /window\.TRAINZ_DIAGRAMS = doc\.diagrams;/.test(lines[0]) &&
      fs.readdirSync(APP).filter(f => /\.js$/.test(f) && f !== 'maintenance.js' && f !== 'trainz-diagrams-config.js').every(f => !/TRAINZ_DIAGRAMS\s*=[^=]/.test(read(f))), lines);
    ok('E4 the links builder asks for the site list (once per open) before it builds', /function _maintDiagramLinksHtml\(item, where\) \{\n    _tzLiveRefresh\(\);/.test(MAINT));
  }

  section('F · the offline cache and the address');
  function swAnswers(src, url) {
    const handlers = {};
    const cacheStub = { match: () => Promise.resolve(undefined), put: () => Promise.resolve() };
    const sb = {
      self: { location: { href: 'https://therailroster.com/app/sw.js?v=1' }, addEventListener: (t, f) => { handlers[t] = f; },
              skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve([]) } },
      caches: { open: () => Promise.resolve(cacheStub), keys: () => Promise.resolve([]), delete: () => Promise.resolve(true), match: () => Promise.resolve(undefined) },
      fetch: () => Promise.resolve({ ok: true, clone() { return this; } }),
      URL, console: { log() {}, warn() {}, error() {} }, Promise, setTimeout, Request: function () {}, Response: { error: () => ({}) }
    };
    vm.createContext(sb);
    vm.runInContext(src, sb);
    let answered = false;
    handlers.fetch({ request: { url, method: 'GET', mode: 'cors', destination: '', headers: { get: () => null } }, respondWith: () => { answered = true; } });
    return answered;
  }
  const FURL = 'https://therailroster.com/harvests/trainz-diagrams-live.json';
  ok('F1 the real service worker lets the list go straight to the site (never cached)', swAnswers(SW, FURL) === false);
  ok('F2 …while it still answers for an ordinary app file (so the check can tell)', swAnswers(SW, 'https://therailroster.com/app/app.css?v=1') === true);
  ok('F3 the file is not on the precache list', !/trainz-diagrams-live/.test(SW.slice(SW.indexOf('['), SW.indexOf('];'))));
  ok('F4 from the app\'s page the address is the site\'s /harvests/ file',
    ['https://therailroster.com/app/', 'https://therailroster.com/app/index.html'].every(p => new URL('../harvests/trainz-diagrams-live.json', p).href === FURL));
  const sf = fs.readFileSync(path.join(ROOT, '.github', 'site-files.txt'), 'utf8');
  ok('F5 harvests/ is published on the website (site-files.txt)', /^publish: harvests$/m.test(sf));
  const csp = (read('index.html').match(/Content-Security-Policy[^>]*content="([^"]*)"/) || [])[1] || '';
  ok('F6 the page\'s security policy lets it read its own site', /connect-src[^;]*'self'/.test(csp) || (!/connect-src/.test(csp) && /default-src 'self'/.test(csp)), csp.slice(0, 120));

  section('G · planted offenders are caught');
  {
    // a loader that trusts whatever arrives
    const trusting = plant(MAINT, "        var bad = _tzLiveCheck(doc);\n", "        var bad = '';\n");
    const L = boot(trusting, { site: site(doc({ diagrams: clone(BUILT.list).concat([{ n: '1', t: 'x', h: "x');alert(1);('" }]) })) });
    await L.refresh();
    ok('G1 PLANTED: a loader that skips the checks → the unsafe page name gets in (and C catches it)', L.c.TRAINZ_DIAGRAMS_SOURCE === 'site');
    // a loader that drops the fallback: a failed read empties the list
    const dropping = plant(MAINT, "      .catch(function (e) { console.warn('[trainz] the site list could not be read: ' + (e && e.message)); return false; });",
      "      .catch(function (e) { window.TRAINZ_DIAGRAMS = []; _tzLookup = null; return false; });");
    const D = boot(dropping, { site: 'offline' }); await D.refresh();
    ok('G2 PLANTED: a loader that drops the fallback → every button gone offline (and C/D catch it)', D.hits('2338', 'pw', 'Diesel Locomotive').length === 0);
    // a swap that forgets the old lookup
    const stale = plant(MAINT, "    _tzLookup = null;                          // the matcher rebuilds from the list now in use\n", '');
    const S = boot(stale, { site: site(withNew()) });
    S.hits('2338', 'pw', 'Diesel Locomotive');   // builds the lookup from the built-in list
    await S.refresh();
    ok('G3 PLANTED: a swap that keeps the old lookup → the new boxcar still has no button (B3 catches it)', S.hits('99887', 'pw', 'Boxcar').indexOf(NEW.h) < 0);
    // a check without the page-name rule
    const loose = plant(MAINT, "if (typeof e.h !== 'string' || !/^[a-z0-9][a-z0-9-]{0,199}$/.test(e.h)) return 'entry ' + i + ': page name';", "if (typeof e.h !== 'string') return 'entry ' + i + ': page name';");
    ok('G4 PLANTED: without the page-name rule → a quote in a page name passes', boot(loose).c._tzLiveCheck(doc({ diagrams: clone(BUILT.list).concat([{ n: '1', t: 'x', h: "x');alert(1);('" }]) })) === '');
    // a loader that lets an old file replace a newer release's list
    const ageless = plant(MAINT, "        if (String(doc.pulled) < _TZ_BUILT_IN.pulled) return false;   // older than this release's own list\n", '');
    const O = boot(ageless, { site: site(doc({ pulled: '2026-09-01' })) }); await O.refresh();
    ok('G5 PLANTED: without the age rule → an old file replaces the release\'s newer list', O.c.TRAINZ_DIAGRAMS_SOURCE === 'site');
    // the offline cache without its skip line
    const sw2 = plant(SW, "  if (url.includes('/harvests/trainz-diagrams-live.json')) return;\n", '');
    ok('G6 PLANTED: a service worker without the skip line answers for the file (F1 catches it)', swAnswers(sw2, FURL) === true);
    // the builder no longer asks
    const silent = plant(MAINT, "    _tzLiveRefresh();   // 2026-11-03", "    // 2026-11-03");
    ok('G7 PLANTED: a links builder that never asks → E4 catches it', !/function _maintDiagramLinksHtml\(item, where\) \{\n    _tzLiveRefresh\(\);/.test(silent));
    // a device copy trusted without its check
    const trustDevice = plant(MAINT, "if (doc && !_tzLiveCheck(doc) && String(doc.pulled) >= _TZ_BUILT_IN.pulled) _tzUse(doc, 'device');", "if (doc) _tzUse(doc, 'device');");
    const T = boot(trustDevice, { store: { rr_tz_live_v1: JSON.stringify(doc({ diagrams: [{ n: '1', t: 'x', h: 'bad"name' }], count: 1 })) } });
    ok('G8 PLANTED: a device copy used without its check → one bad diagram replaces them all (D4 catches it)', T.c.TRAINZ_DIAGRAMS.length === 1);
  }

  console.log('\n' + (fail ? 'FAILED' : 'PASSED') + '  trainz_live_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack)); process.exit(1); });
