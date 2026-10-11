#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ONE TABLE NAMES A REFERENCE SITE — v0.9.1922
//
// Booth-video prep (2026-10-11): on the Add screen's variation list every COTT
// row's link read "View ↗". The Add screens labelled links from their own regex
// list in item-search-filters-config.js, whose COTT pattern (/cott|collectors
// oftinplate/) cannot match COTT's real address, cornucopiaoftoytrains.com —
// while the Browse page, reading browse.js _SITE_LABELS, said COTT. Two lists of
// one fact. Now resolveRefLabel takes the SITE from _externalSiteLabel (browse.js)
// and only the WORDING from config.
//   A  every reference host in the live catalog (counts measured 2026-10-11)
//      gets the right short + verbose label on the Add screens.
//      PLANTED: the old pattern resolver → COTT reads "View ↗" (caught).
//   B  a whole-domain entry must END the host: findmylionel.com (14 rows,
//      not Lionel's site) is not "Lionel". PLANTED: plain indexOf → "Lionel".
//   C  the config carries no site list of its own any more.
// Runs the REAL code: app/item-search-filters-config.js whole, and the
// _SITE_LABELS + _externalSiteLabel slice of app/browse.js.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 600))); cond ? pass++ : fail++; }

const CFG = fs.readFileSync(path.join(APP, 'item-search-filters-config.js'), 'utf8');
const BRW = fs.readFileSync(path.join(APP, 'browse.js'), 'utf8');
function siteSlice(src) {
  const a = src.indexOf('var _SITE_LABELS'), b = src.indexOf('if (typeof window', a);
  if (a < 0 || b < 0) throw new Error('browse.js _SITE_LABELS marker moved');
  return src.slice(a, b) + '\nwindow._externalSiteLabel = _externalSiteLabel;';
}
function world(cfgSrc, brwSrc) {
  const ctx = { URL, String, Object };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(siteSlice(brwSrc), ctx);
  vm.runInContext(cfgSrc, ctx);
  return ctx;
}

// host, catalog rows, expected short, expected verbose
const LIVE = [
  ['https://cornucopiaoftoytrains.com/boxcars-page-1-a/#6014', 6520, 'COTT ↗', 'View on COTT ↗'],
  ['https://archive.atlasrr.com/product/3300', 46527, 'Atlas ↗', 'View on Atlas ↗'],
  ['https://download.atlasrr.com/x.pdf', 7195, 'Atlas ↗', 'View on Atlas ↗'],
  ['https://mthtrains.com/30-1234', 19382, 'MTH ↗', 'View on MTH ↗'],
  ['https://www.mthtrains.com/30-1234', 18446, 'MTH ↗', 'View on MTH ↗'],
  ['https://www.lionel.com/search?query=6-8359', 15330, 'Lionel ↗', 'View on Lionel ↗'],
  ['https://www.trainz.com/products/x', 3779, 'Trainz ↗', 'View on Trainz ↗'],
  ['https://www.google.com/search?q=Lionel+6014', 1789, 'Google ↗', 'Search Google ↗'],
  ['https://web.archive.org/web/2017/http://3rdrail.com/x', 872, 'Web Archive ↗', 'View on Web Archive ↗'],
  ['https://www.readymadetoys.com/rn.html', 416, 'RMT ↗', 'View on RMT ↗'],
  ['https://www.tandem-associates.com/lionel/x.htm', 199, 'Tandem Associates ↗', 'View on Tandem Associates ↗'],
  ['https://www.marklin.com/x', 7238, 'View ↗', 'View reference ↗'],   // not named yet — honest default
];

// ── A ──────────────────────────────────────────────────────────────────────
{
  const w = world(CFG, BRW);
  LIVE.forEach(function (t) {
    const s = w.resolveRefLabel(t[0]), v = w.resolveRefLabel(t[0], { verbose: true });
    T('A ' + t[0].split('/')[2] + ' (' + t[1].toLocaleString() + ' rows) → "' + t[2] + '" / "' + t[3] + '"', s === t[2] && v === t[3], { s, v });
  });
  T('A empty link → no label', w.resolveRefLabel('') === '' && w.resolveRefLabel('', { verbose: true }) === '');
  T('A a query mentioning cott does not make Google read COTT', w.resolveRefLabel('https://www.google.com/search?q=cott') === 'Google ↗');
  T('A a host merely containing c-o-t-t is not COTT', w.resolveRefLabel('https://scottsdale-trains.com/x') === 'View ↗', w.resolveRefLabel('https://scottsdale-trains.com/x'));

  // PLANTED: the pre-v1922 resolver and pattern list
  const oldCfg = CFG
    .replace(/shortFormat:[\s\S]*?verboseBySite:[^\n]*\n/, "patterns: [ { match: /cott|collectorsoftinplate/i, short: 'COTT \\u2197', verbose: 'View on COTT \\u2197' } ],\n")
    .replace(/var site = [\s\S]*?\n  }\n  if \(wantVerbose\) return ll\.defaultVerbose/, "var patterns = ll.patterns || [];\n  for (var i = 0; i < patterns.length; i++) { var p = patterns[i]; if (!p.match.test(url)) continue; return wantVerbose ? p.verbose : p.short; }\n  if (wantVerbose) return ll.defaultVerbose");
  if (oldCfg === CFG) throw new Error('could not plant the old resolver');
  const o = world(oldCfg, BRW);
  T('A PLANTED: the old pattern list labels a real COTT link "View ↗"', o.resolveRefLabel(LIVE[0][0]) === 'View ↗', o.resolveRefLabel(LIVE[0][0]));
}

// ── B ──────────────────────────────────────────────────────────────────────
{
  const w = world(CFG, BRW);
  T('B findmylionel.com (14 rows) is not labelled Lionel', w._externalSiteLabel('https://www.findmylionel.com/x') === 'External', w._externalSiteLabel('https://www.findmylionel.com/x'));
  T('B lionel.com itself still is', w._externalSiteLabel('https://lionel.com/x') === 'Lionel');
  T('B a dotless entry still matches inside the host (archive.atlasrr.com)', w._externalSiteLabel('https://archive.atlasrr.com/p') === 'Atlas');
  const oldBrw = BRW.replace(/var part = _SITE_LABELS\[i\]\[0\];[\s\S]*?: host\.indexOf\(part\) >= 0\) return _SITE_LABELS\[i\]\[1\];/,
                             "if (host.indexOf(_SITE_LABELS[i][0]) >= 0) return _SITE_LABELS[i][1];");
  if (oldBrw === BRW) throw new Error('could not plant the old matcher');
  const o = world(CFG, oldBrw);
  T('B PLANTED: plain indexOf calls findmylionel.com "Lionel"', o._externalSiteLabel('https://www.findmylionel.com/x') === 'Lionel', o._externalSiteLabel('https://www.findmylionel.com/x'));
}

// ── C ──────────────────────────────────────────────────────────────────────
{
  const cfgCode = CFG.replace(/\/\/[^\n]*/g, '');
  T('C the config holds no site list (no linkLabel.patterns, no host regex)', !/patterns\s*:/.test(cfgCode) && !/cornucopia|mthtrains|atlasrr/.test(cfgCode), cfgCode.match(/patterns\s*:|cornucopia|mthtrains|atlasrr/));
  const planted = CFG.replace("shortFormat:", "patterns: [],\n      shortFormat:");
  T('C PLANTED: a patterns list put back is caught', /patterns\s*:/.test(planted.replace(/\/\/[^\n]*/g, '')));
}

console.log('\nref_link_label_tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
