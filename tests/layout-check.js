// ═══════════════════════════════════════════════════════════════
// layout-check.js — renders the Appearance editor and MEASURES it
//
// Why this exists: on 2026-07-31 Brad sent a screenshot of v0.9.1211 with
// the right-hand colour chips cut off the side of the screen. The whole
// suite was green. It always would have been — every assertion about that
// editor is a grep over source, and no grep can see that a box overhangs
// its container by exactly the width of its parent's padding.
//
// Two real faults came out of one render:
//   1. the stage was fitted to wrap.clientWidth, which INCLUDES the
//      wrapper's padding, so it overhung by that padding at every size;
//   2. .rrap-right had no min-height:0, so a column flex child could push
//      past the space it was given.
// Neither was visible at 1900px, which is why it shipped.
//
// Run it with:  node tests/layout-check.js
// It needs playwright. Without it the script says so and exits 0 rather
// than failing a machine that never asked to run browser tests.
// ═══════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  console.log('layout-check: playwright not installed — skipping (npm i playwright to enable)');
  process.exit(0);
}

const APP = path.join(__dirname, '..', 'app');
const SIZES = [[1900, 1000], [1600, 950], [1440, 900], [1280, 860], [1200, 800], [1000, 700]];

// The editor needs almost nothing to open — that is itself worth knowing.
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${APP}/app.css">
<style>html,body{margin:0;height:100%}</style></head><body>
<script>
  window.APPEARANCE_ENABLED = true;
  window.state = { personalData: {} };
  window.showToast = function(){};
  window.applyTheme = function(){};
  window.ERAS = {};
</script>
<script src="file://${APP}/appearance.js"></script>
<script>window.addEventListener('load', function(){ window.openAppearance(); });</script>
</body></html>`;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-layout-'));
  const file = path.join(dir, 'harness.html');
  fs.writeFileSync(file, HARNESS);

  let pass = 0, fail = 0;
  const ok = (name, cond, extra) => {
    if (cond) { pass++; console.log('  PASS  ' + name); }
    else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
  };

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const [w, h] of SIZES) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto('file://' + file);
      await page.waitForTimeout(500);
      const r = await page.evaluate(() => {
        const ov = document.getElementById('rrap');
        if (!ov) return { err: 'the editor did not open' };
        const wrap = document.querySelector('.rrap-stagewrap');
        const st = document.getElementById('rrap-stage');
        const vw = window.innerWidth, vh = window.innerHeight;
        const wr = wrap.getBoundingClientRect(), sr = st.getBoundingClientRect();
        const cs = getComputedStyle(wrap);
        const padR = parseFloat(cs.paddingRight) || 0, padB = parseFloat(cs.paddingBottom) || 0;
        const off = [];
        // Every visible thing in the editor must be on the screen.
        ov.querySelectorAll('.rrap-logotile, .rrap-role, .rrap-swb, .rrap-btn, .rrap-tin, .rrap-tsel, .rrap-rc, .rrap-preset')
          .forEach(function (el) {
            const b = el.getBoundingClientRect();
            if (b.width === 0 && b.height === 0) return;      // a hidden scene
            if (b.right > vw + 1 || b.bottom > vh + 1 || b.left < -1 || b.top < -1) {
              off.push((el.dataset.var || el.dataset.slot || el.className.split(' ')[0])
                + '[' + Math.round(b.left) + ',' + Math.round(b.top) + ','
                + Math.round(b.right) + ',' + Math.round(b.bottom) + ']');
            }
          });
        const app = document.getElementById('ra-app');
        const ar = app ? app.getBoundingClientRect() : null;
        // Brad: "also need titles to the pick boxes for font, text color, and
        // border." A control with no label is a guess, so every one of them
        // must sit inside a label that has visible words in it.
        const unlabelled = [];
        ov.querySelectorAll('.rrap-trow input, .rrap-trow select').forEach(function (el) {
          const lab = el.closest('label');
          const txt = lab && lab.querySelector('.rrap-flab');
          if (!txt || !txt.textContent.trim() || !txt.getBoundingClientRect().height) {
            unlabelled.push(el.tagName.toLowerCase() + '.' + (el.className || '?'));
          }
        });
        // Brad: "the header text should be above teh three logo boxes and
        // everything centered." Order and centring are both measurable.
        const strip = document.querySelector('.rrap-bottom');
        const secs = strip ? [].slice.call(strip.children) : [];
        const sr2 = strip ? strip.getBoundingClientRect() : null;
        const centred = secs.every(function (el) {
          const b = el.getBoundingClientRect();
          return Math.abs((b.left + b.right) / 2 - (sr2.left + sr2.right) / 2) <= 3;
        });
        // …and the preview should sit in the middle of the room it has,
        // not pinned to the top with a void beneath it.
        const gapTop = sr.top - wr.top, gapBot = wr.bottom - sr.bottom;
        // Brad circled the three mark boxes: "when i say spread it out, i
        // mean whats circled in red." They must use the strip's width, not
        // huddle in the middle of it.
        const tiles = [].slice.call(document.querySelectorAll('.rrap-tilewrap'))
          .map(function (e) { return e.getBoundingClientRect(); });
        const tileRow = document.querySelector('.rrap-tiles');
        let tileSpan = 0, tileGapSpread = 0, tileW = 0;
        if (tiles.length === 3 && tileRow) {
          const rowW = tileRow.getBoundingClientRect().width;
          tileSpan = (tiles[2].right - tiles[0].left) / rowW;
          const g = [tiles[1].left - tiles[0].right, tiles[2].left - tiles[1].right];
          tileGapSpread = Math.round(Math.abs(g[0] - g[1]));
          tileW = Math.round(tiles[0].width);
        }
        return {
          tileSpan: tileSpan, tileGapSpread: tileGapSpread, tileW: tileW,
          stripOrderOk: secs.length === 2 &&
            !!secs[0].querySelector('.rrap-trow') && !!secs[1].querySelector('.rrap-tiles'),
          stripCentred: centred,
          previewOffCentre: Math.round(Math.abs(gapTop - gapBot)),
          unlabelled: unlabelled,
          overflowX: sr.right > wr.right - padR + 1,
          overflowY: sr.bottom > wr.bottom - padB + 1,
          editorScrolls: ov.scrollHeight > ov.clientHeight + 1,
          leftScrolls: (function () {
            const l = document.querySelector('.rrap-left');
            return !!l && l.scrollHeight > l.clientHeight + 1;
          })(),
          scale: (st.style.transform.match(/scale\(([\d.]+)\)/) || [])[1] || '1',
          off: off
        };
      });

      const at = w + '×' + h;
      if (r.err) { ok(at + ': the editor opens', false, r.err); await page.close(); continue; }
      ok(at + ': nothing is cut off the screen', r.off.length === 0, r.off.join(' '));
      ok(at + ': the preview stays inside its area', !r.overflowX && !r.overflowY,
         'x=' + r.overflowX + ' y=' + r.overflowY + ' scale=' + r.scale);
      ok(at + ': the editor does not scroll', !r.editorScrolls);
      ok(at + ': the colour box fits without scrolling', !r.leftScrolls);
      ok(at + ': every pick box says what it is for',
         r.unlabelled.length === 0, r.unlabelled.join(', '));
      ok(at + ': the header line sits above the three mark boxes',
         r.stripOrderOk);
      ok(at + ': the three mark boxes use the width of the strip',
         r.tileSpan >= 0.9, 'they span ' + Math.round(r.tileSpan * 100) + '% of it');
      ok(at + ': …evenly, and big enough to see a logo in',
         r.tileGapSpread <= 3 && r.tileW >= 96,
         'gaps differ by ' + r.tileGapSpread + 'px, tiles ' + r.tileW + 'px');
      ok(at + ': both rows of the strip are centred',
         r.stripCentred);
      ok(at + ': the preview sits in the middle of its space, not pinned to the top',
         r.previewOffCentre <= 4, r.previewOffCentre + 'px off centre');
      // Brad: "hover over certain areas and it hightlights all the area that
      // would change if i picked it. Then let me click it, and the color
      // picker pops up." Both halves are measurable.
      const hov = await page.evaluate(() => {
        const stage = document.getElementById('rrap-stage');
        const app = document.getElementById('ra-app');
        if (!stage || !app) return { err: 'no preview' };
        const fire = (el, type, pt) => {
          const b = el.getBoundingClientRect();
          const x = pt ? pt.x : b.left + b.width / 2, y = pt ? pt.y : b.top + b.height / 2;
          el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
          return { x, y };
        };
        // Hover the header bar: everything painted with that colour lights up.
        const head = document.getElementById('ra-head');
        const hb = head.getBoundingClientRect();
        fire(stage, 'mousemove', { x: hb.left + 6, y: hb.top + hb.height / 2 });
        const lit = document.querySelectorAll('#rrap-stage .rrap-hl').length;
        const tip = document.getElementById('rrap-tip');
        const tipText = tip ? tip.textContent : '';
        const tr = tip ? tip.getBoundingClientRect() : null;
        const tipOn = !!tr && tr.left >= -1 && tr.top >= -1 &&
                      tr.right <= innerWidth + 1 && tr.bottom <= innerHeight + 1;
        // Click a hairline: a row's border sits on a panel on a background,
        // so the chooser must appear rather than a guess being made.
        const row = document.getElementById('ra-border');
        const rb = row.getBoundingClientRect();
        fire(stage, 'click', { x: rb.left + 40, y: rb.bottom - 1 });
        const what = document.getElementById('rrap-what');
        const opts = what ? what.querySelectorAll('.rrap-whatbtn').length : 0;
        const wr = what ? what.getBoundingClientRect() : null;
        const whatOn = !!wr && wr.left >= -1 && wr.top >= -1 &&
                       wr.right <= innerWidth + 1 && wr.bottom <= innerHeight + 1;
        if (what) what.remove();
        return { lit, tipText, tipOn, opts, whatOn, chips: document.querySelectorAll('.rrap-chip').length };
      });
      ok(at + ': hovering the preview lights up everything that colour touches',
         !hov.err && hov.lit >= 2, hov.err || (hov.lit + ' lit'));
      ok(at + ': …and names it, on the screen',
         /Panels/.test(hov.tipText || '') && !!hov.tipOn, JSON.stringify(hov.tipText));
      ok(at + ': clicking a hairline asks what you meant instead of guessing',
         hov.opts >= 2 && !!hov.whatOn, hov.opts + ' options');
      ok(at + ': the chips and leader lines are gone', hov.chips === 0);

      // A pop-up that is see-through is not a pop-up. Every floating panel
      // must resolve to a real, opaque background — this is exactly what
      // went wrong when they were appended outside the element that
      // declares the palette they read.
      const opaque = await page.evaluate(() => {
        const out = {};
        const stage = document.getElementById('rrap-stage');
        const row = document.getElementById('ra-border').getBoundingClientRect();
        stage.dispatchEvent(new MouseEvent('mousemove',
          { clientX: row.left + 40, clientY: row.bottom - 1, bubbles: true }));
        stage.dispatchEvent(new MouseEvent('click',
          { clientX: row.left + 40, clientY: row.bottom - 1, bubbles: true }));
        document.querySelectorAll('.rrap-role')[0].click();
        ['rrap-pal', 'rrap-tip', 'rrap-what'].forEach(function (id) {
          const el = document.getElementById(id);
          if (!el) { out[id] = 'missing'; return; }
          const bg = getComputedStyle(el).backgroundColor;
          const m = /rgba?\(([^)]+)\)/.exec(bg);
          const a = m ? (m[1].split(',')[3] !== undefined ? parseFloat(m[1].split(',')[3]) : 1) : 0;
          out[id] = (bg && bg !== 'transparent' && a > 0.95) ? 'ok' : bg;
        });
        ['rrap-pal', 'rrap-what'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
        const t = document.getElementById('rrap-tip'); if (t) t.remove();
        return out;
      });
      ok(at + ': every pop-up has a solid background, not a see-through one',
         Object.keys(opaque).every(k => opaque[k] === 'ok'), JSON.stringify(opaque));

      // The picker Brad asked for: it has to open beside what you clicked,
      // stay on the screen, and offer a way back. A picker that opens half
      // off the edge is worse than the browser's own.
      const pal = await page.evaluate(() => {
        const role = document.querySelector('.rrap-role');
        if (!role) return { err: 'no colour control found' };
        role.click();
        const p = document.getElementById('rrap-pal');
        if (!p) return { err: 'the picker did not open' };
        const b = p.getBoundingClientRect();
        // Is the picker actually the topmost thing across its own area? A
        // screenshot cannot answer this reliably — a pale panel over pale
        // chrome looks the same either way. Hit-testing can.
        const buried = [];
        for (let x = 4; x < b.width - 4; x += 24) {
          for (let y = 4; y < b.height - 4; y += 24) {
            const hit = document.elementFromPoint(b.left + x, b.top + y);
            if (!hit || !p.contains(hit)) {
              buried.push(Math.round(x) + ',' + Math.round(y) + '→' +
                (hit ? (hit.className || hit.tagName) : 'null'));
            }
          }
        }
        const a = role.getBoundingClientRect();
        return {
          buried: buried.slice(0, 6),
          anchor: [Math.round(a.left), Math.round(a.top), Math.round(a.right), Math.round(a.bottom)],
          coversAnchor: b.left < a.right - 1 && b.right > a.left + 1 &&
                        b.top < a.bottom - 1 && b.bottom > a.top + 1,
          swatches: p.querySelectorAll('.rrap-palsw').length,
          onScreen: b.left >= -1 && b.top >= -1 &&
                    b.right <= window.innerWidth + 1 && b.bottom <= window.innerHeight + 1,
          hasReset: /Back to default/.test(p.textContent),
          hasCustom: /Custom/.test(p.textContent),
          rect: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]
        };
      });
      ok(at + ': the colour picker opens with a grid to choose from',
         !pal.err && pal.swatches >= 60, pal.err || (pal.swatches + ' swatches'));
      ok(at + ': …entirely on the screen',
         !!pal.onScreen, JSON.stringify(pal.rect));
      ok(at + ': …with a way back to the default and a way to the browser picker',
         !!pal.hasReset && !!pal.hasCustom);
      ok(at + ': …and never covering the swatch you clicked',
         !pal.coversAnchor, JSON.stringify(pal.rect) + ' vs ' + JSON.stringify(pal.anchor));
      ok(at + ': …and nothing paints over it',
         pal.buried && pal.buried.length === 0, (pal.buried || []).join(' '));
      await page.close();
    }
  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
