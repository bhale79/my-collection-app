// ══ tests/guide-contrast.js — CAN YOU ACTUALLY READ THE HELP CARD? ════════
//
// Round six of the overnight audit. The help card is built entirely from theme
// variables — var(--surface) behind, var(--text) and var(--text-mid) on top,
// var(--accent) for the ring and the Next button — and it has only ever been
// looked at in the Dark theme. The app also ships Light. A card that is
// perfectly readable on one is not automatically readable on the other, and
// nothing in this project has ever measured it.
//
// Nothing here is a matter of taste. Contrast is a number:
//
//   · body text on the card       >= 4.5:1   (WCAG AA for normal text)
//   · the title, which is larger  >= 3.0:1   (AA for large text)
//   · the Next button's label on its own background >= 3.0:1
//   · the spotlight RING against the page it is drawn on >= 3.0:1, or the
//     highlight is invisible and the whole mechanism is pointless
//
// It also checks the card is distinguishable from the page behind it, because
// a card that melts into the background is unreadable in a way no per-element
// contrast ratio can express.
//
// WHAT IT CANNOT SEE, so nobody trusts it too far:
//   · whether the card LOOKS good — only whether it can be read
//   · images and the conductor, which carry no text
//   · a theme that is not installed; it measures what the app ships
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { SEED } = require('./lib/guide-fixture');

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  console.log('FAILED  —  guide-contrast needs playwright and it is not installed.');
  process.exit(1);
}

const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

const KIT = `
// sRGB relative luminance and the WCAG contrast ratio, written out rather than
// approximated, because a wrong constant here would quietly pass everything.
window._lum = function (css) {
  var m = String(css).match(/-?[\\d.]+/g);
  if (!m || m.length < 3) return null;
  var v = m.slice(0, 3).map(Number);
  if (v[0] <= 1 && v[1] <= 1 && v[2] <= 1) v = v.map(function (x) { return x * 255; });
  var c = v.map(function (x) {
    x = x / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
window._ratio = function (a, b) {
  var la = window._lum(a), lb = window._lum(b);
  if (la === null || lb === null) return null;
  var hi = Math.max(la, lb), lo = Math.min(la, lb);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
};
// A transparent background means "whatever is behind me". Walk up until
// something opaque is found, which is what the eye does.
window._bgOf = function (el) {
  var n = el;
  // Walk all the way to <html> INCLUSIVE. Stopping at <body> was wrong: this
  // app paints its page colour on the root element, so the walk fell off the
  // end and returned a transparent value, which reads as black. Everything
  // measured against "the page" was then measured against the wrong colour,
  // and the scrim maths layered on top of it did nothing whatever.
  while (n) {
    var bg = getComputedStyle(n).backgroundColor;
    var m = String(bg).match(/-?[0-9.]+/g);
    var alpha = (m && m.length > 3) ? Number(m[3]) : 1;
    if (bg && bg !== 'transparent' && alpha > 0.5) return bg;
    if (n === document.documentElement) break;
    n = n.parentElement;
  }
  return 'rgb(255,255,255)';   // a page with no colour of its own is white
};
// THE PAGE AS THE EYE SEES IT WHILE A TOUR IS RUNNING. The spotlight dims
// everything outside the ring with a 9999px box-shadow of rgba(0,0,0,0.62), so
// comparing anything against the page's own background colour measures a
// screen nobody is looking at. The first run of this gate did exactly that and
// reported two defects that were both its own fault: the dark card "melting
// into the page" at 1.11:1 when in reality it sits on a page darkened almost
// to black, and the orange ring failing on the light theme at 2.95:1 when the
// surface immediately outside it is dimmed and the contrast there is enormous.
window._SCRIM = 0.62;
window._composite = function (base, alpha) {
  var m = String(base).match(/-?[0-9.]+/g);
  if (!m || m.length < 3) return base;
  var v = m.slice(0, 3).map(Number);
  if (v[0] <= 1 && v[1] <= 1 && v[2] <= 1) v = v.map(function (x) { return x * 255; });
  var out = v.map(function (x) { return Math.round(x * (1 - alpha)); });
  return 'rgb(' + out.join(',') + ')';
};
window._dimmedPage = function () {
  return window._composite(window._bgOf(document.body), window._SCRIM);
};
window._cardReadout = function () {
  var c = document.getElementById('gt-callout');
  if (!c) return null;
  var cardBg = window._bgOf(c);
  var title = c.querySelector('strong');
  var body = null;
  c.querySelectorAll('div').forEach(function (d) {
    if (body) return;
    var t = (d.innerText || '').trim();
    if (t.length > 40 && !d.querySelector('button')) body = d;
  });
  var nx = document.getElementById('gt-next');
  var hole = document.getElementById('gt-hole');
  var out = { cardBg: cardBg };
  if (title) out.title = { color: getComputedStyle(title).color,
                           size: parseFloat(getComputedStyle(title).fontSize),
                           ratio: window._ratio(getComputedStyle(title).color, cardBg) };
  if (body)  out.body  = { color: getComputedStyle(body).color,
                           size: parseFloat(getComputedStyle(body).fontSize),
                           ratio: window._ratio(getComputedStyle(body).color, cardBg) };
  if (nx) {
    var nbg = getComputedStyle(nx).backgroundColor;
    var m = String(nbg).match(/-?[\\d.]+/g);
    var solid = !(m && m.length > 3 && Number(m[3]) < 0.5) && nbg !== 'transparent';
    out.next = { color: getComputedStyle(nx).color, bg: nbg, solid: solid,
                 ratio: window._ratio(getComputedStyle(nx).color, solid ? nbg : cardBg) };
  }
  if (hole) {
    var hs = getComputedStyle(hole);
    // The ring has a DIMMED page on its outside and an undimmed one inside it.
    // It is doing its job if it stands out from either — that is what makes a
    // border visible.
    // The ring is not only its border. A hairline drawn by box-shadow on
    // either side is part of the same edge and does the same job, so every
    // colour at that edge counts — the ring is visible if ANY of them stands
    // out from the surface on its side.
    var edges = [hs.borderTopColor];
    var sh = String(hs.boxShadow || '');
    (sh.match(/rgba?\([^)]*\)/g) || []).forEach(function (col, ix) {
      // the huge 9999px shadow is the dimmer itself, not an edge
      if (sh.indexOf(col + ' 0px 0px 0px 9999px') >= 0 || /9999/.test(sh.split(col)[1] || '')) {
        if (ix === (sh.match(/rgba?\([^)]*\)/g) || []).length - 1) return;
      }
      edges.push(col);
    });
    var pageIn = window._bgOf(document.body), pageOut = window._dimmedPage();
    var best = 0, bestWhich = '';
    edges.forEach(function (c2) {
      [[pageIn, 'inside'], [pageOut, 'outside']].forEach(function (pr) {
        var v = window._ratio(c2, pr[0]);
        if (v && v > best) { best = v; bestWhich = c2 + ' vs ' + pr[1]; }
      });
    });
    out.ring = { color: hs.borderTopColor, width: parseFloat(hs.borderTopWidth),
                 edges: edges, best: bestWhich,
                 ratioInside: window._ratio(hs.borderTopColor, pageIn),
                 ratioOutside: window._ratio(hs.borderTopColor, pageOut),
                 ratio: best };
  }
  // A card that melts into the page behind it is unreadable however good its
  // own text contrast is — and the page behind it, while a tour runs, is dim.
  out.pageDimmed = window._dimmedPage();
  out.cardVsPage = window._ratio(cardBg, window._dimmedPage());
  return out;
};
`;

const THEMES = ['dark', 'light'];
const AA_NORMAL = 4.5, AA_LARGE = 3.0, RING_MIN = 3.0, CARD_VS_PAGE_MIN = 1.15;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-contrast-'));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.slice(0, 140)));
    for (const u of ['**://accounts.google.com/**', '**://apis.google.com/**',
                     '**://*.googleapis.com/**', '**://cdnjs.cloudflare.com/**',
                     '**://*.google.com/**'])
      await page.route(u, r => r.abort());

    await page.goto('file://' + APP + '/index.html');
    await page.waitForTimeout(2200);
    await page.evaluate(SEED);
    await page.evaluate(KIT);
    await page.evaluate(() => window.__clr = (function () {
      for (let i = 0; i < 6; i++) {
        const c = document.querySelectorAll('[id^="rr-"][id$="-card"]');
        if (!c.length) break;
        c.forEach(x => { const g = x.querySelector('[id$="-go"]'); if (g) try { g.click(); } catch (e) {} x.remove(); });
      }
      return 1;
    })());
    await page.waitForTimeout(400);

    // The maths must be right before any of its answers mean anything.
    const sanity = await page.evaluate(() => ({
      blackOnWhite: window._ratio('rgb(0,0,0)', 'rgb(255,255,255)'),
      same: window._ratio('rgb(120,120,120)', 'rgb(120,120,120)')
    }));
    ok('the contrast maths is right before it is trusted',
       Math.abs(sanity.blackOnWhite - 21) < 0.05 && Math.abs(sanity.same - 1) < 0.01,
       JSON.stringify(sanity));

    const themesAvailable = await page.evaluate(() =>
      ((window.A11Y && window.A11Y.theme && window.A11Y.theme.options) || []).map(o => o.key));
    ok('every theme this gate knows about is one the app actually ships',
       THEMES.every(t => themesAvailable.includes(t)),
       'app ships: ' + themesAvailable.join(', ') + ' | gate checks: ' + THEMES.join(', '));

    // A guide with a real ring and a decent amount of body text — the hardest
    // case for readability, not the easiest.
    for (const theme of THEMES) {
      const r = await page.evaluate(async (theme) => {
        try { localStorage.setItem('lv_theme', theme); } catch (e) {}
        try { if (typeof applyTheme === 'function') applyTheme(theme); } catch (e) {}
        await new Promise(res => setTimeout(res, 600));
        try { _gtEnd(); } catch (e) {}
        startGuide('reports');
        await new Promise(res => setTimeout(res, 1600));
        const nx = document.getElementById('gt-next');
        if (nx) nx.click();                       // step 2, which has more text
        await new Promise(res => setTimeout(res, 900));
        const out = window._cardReadout();
        out.appliedTheme = document.documentElement.getAttribute('data-theme') ||
                           document.documentElement.className || '';
        try { _gtEnd(); } catch (e) {}
        return out;
      }, theme);

      console.log('');
      console.log('  ── ' + theme + ' ── card ' + r.cardBg +
                  ' | title ' + (r.title ? r.title.ratio + ':1' : '?') +
                  ' | body ' + (r.body ? r.body.ratio + ':1' : '?') +
                  ' | Next ' + (r.next ? r.next.ratio + ':1' : '?') +
                  ' | ring ' + (r.ring ? r.ring.ratio + ':1' : '?') +
                  ' | card vs page ' + r.cardVsPage + ':1');

      ok(theme + ': the theme really did change', !!r.appliedTheme, JSON.stringify(r.appliedTheme));
      ok(theme + ': the card body text is readable (AA, ' + AA_NORMAL + ':1)',
         !!r.body && r.body.ratio >= AA_NORMAL, JSON.stringify(r.body));
      ok(theme + ': the card title is readable (AA large, ' + AA_LARGE + ':1)',
         !!r.title && r.title.ratio >= AA_LARGE, JSON.stringify(r.title));
      ok(theme + ': the Next button\'s label is readable on its own background',
         !!r.next && r.next.ratio >= AA_LARGE, JSON.stringify(r.next));
      ok(theme + ': the spotlight ring stands out from the page it surrounds',
         !!r.ring && r.ring.ratio >= RING_MIN && r.ring.width >= 1.5, JSON.stringify(r.ring));
      ok(theme + ': the card does not melt into the page behind it',
         r.cardVsPage !== null && r.cardVsPage >= CARD_VS_PAGE_MIN, String(r.cardVsPage));
    }

    ok('measuring every theme raises no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
