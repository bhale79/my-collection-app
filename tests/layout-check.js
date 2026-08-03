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
// Run it with:  node tests/layout-check.js  (or, better, `npm test`)
//
// It needs playwright. Until v0.9.1257 a missing playwright printed a
// note and exited 0 — "rather than failing a machine that never asked to
// run browser tests." The 2026-08-02 audit found what that actually
// bought: playwright was not declared in package.json, so on any clean
// clone this entire file — 171 assertions, the only thing in the suite
// that can SEE the app — exited green without rendering a single pixel.
// A gate that passes by not existing is worse than no gate, because it
// is counted.
//
// playwright is now a declared devDependency and its absence is a
// FAILURE. If a machine genuinely does not want browser tests, it should
// say so out loud by not running this file, not by having the file quietly
// agree with it.
// ═══════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  console.log('FAILED  —  layout-check needs playwright and it is not installed.');
  console.log('          playwright is a declared devDependency: run `npm install`.');
  console.log('          (This used to exit 0, which meant 171 layout assertions');
  console.log('           silently did not run on any clean clone. v0.9.1257.)');
  process.exit(1);
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

      // Brad: "reset to default doesn't reset it back to our normal layout."
      // The real test is with a saved skin already on :root — that is the
      // case where falling back by absence lands on the wrong thing.
      const reset = await page.evaluate(() => {
        const root = document.documentElement;
        const before = getComputedStyle(root).getPropertyValue('--bg').trim();
        // Pretend a custom skin has already been applied and saved.
        root.style.setProperty('--bg', '#123456');
        root.style.setProperty('--text', '#abcdef');
        window._rrapReset();
        const stage = document.getElementById('rrap-stage');
        const got = stage.style.getPropertyValue('--bg').trim();
        const gotText = stage.style.getPropertyValue('--text').trim();
        // Read the INLINE value, not the computed one: the question is
        // whether reading the defaults put the skin back where it found it.
        const restored = root.style.getPropertyValue('--bg').trim();
        root.style.removeProperty('--bg'); root.style.removeProperty('--text');
        return { before, got, gotText, restored };
      });
      ok(at + ': Reset goes to the app default, not to the saved skin',
         !!reset.got && reset.got.toLowerCase() === reset.before.toLowerCase(),
         'got ' + reset.got + ', default is ' + reset.before);
      ok(at + ': …and it resets the writing too, not just the page',
         !!reset.gotText && reset.gotText.toLowerCase() !== '#abcdef');
      ok(at + ': …and reading the default puts the live skin back as it found it',
         reset.restored === '#123456', 'root kept ' + JSON.stringify(reset.restored));

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

    // ══════════════════════════════════════════════════════════════════
    // The add step, MEASURED (v0.9.1232)
    //
    // Brad: "the add step needs to be as wide as it can on the desktop to
    // minimize scrolling down." The point of the change is that the step gets
    // SHORTER. A grep cannot see that, and neither can a screenshot with any
    // precision — so the real markup, built by the real function, is rendered
    // against the real stylesheet at both widths and measured.
    // ══════════════════════════════════════════════════════════════════
    {
      const wzSrc = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
      const a = wzSrc.indexOf('function _buildCondCol(col) {');
      const bEnd = wzSrc.indexOf('return html;\n    }', a);
      const bsrc = wzSrc.slice(a, bEnd + 'return html;\n    }'.length);
      const build = (two, data) => new Function('wizard', 'rrEsc', '_cd2up', '_isMobile',
        '_cdMaster', '_cdIsPaperLike', '_cdHideToggles', 'getMatchingTenders',
        '_cdEraFacts', 'window', 'document',
        '"use strict";' + bsrc + '; return _buildCondCol;')(
          { data: data || {} }, x => String(x == null ? '' : x), two, false, null, false, false,
          () => [], () => [], {}, {})({ id: 'main', label: '\u{1F682} No. 2343', prefix: '',
                              description: 'Santa Fe F3 A Unit' });
      // The worst case is not the empty step — it is the step with every
      // question answered the way that opens another field.
      const OPEN = { allOriginal: 'No', hasBox: 'Yes', hasIS: 'Yes', isError: 'Yes' };

      const stepPage = (widthPx, html) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${APP}/app.css">
<style>html,body{margin:0;background:#111}
 /* the wizard body, as the modal gives it: a fixed width and its padding */
 #box{width:${widthPx}px;box-sizing:border-box;padding:1rem 1.5rem}
 #row{display:flex;gap:0.5rem}</style></head>
<body><div id="box"><div id="row">${html}</div></div></body></html>`;

      const measure = async (widthPx, two, data, tag) => {
        const f2 = path.join(dir, 'step-' + widthPx + '-' + (two ? '2' : '1') + (tag || '') + '.html');
        fs.writeFileSync(f2, stepPage(widthPx, build(two, data)));
        const pg = await browser.newPage({ viewport: { width: widthPx + 40, height: 1000 } });
        await pg.goto('file://' + f2);
        await pg.waitForTimeout(150);
        const out = await pg.evaluate(() => {
          const col = document.querySelector('.cd-col');
          const box = document.getElementById('box');
          const cb = col.getBoundingClientRect(), bb = box.getBoundingClientRect();
          // Nothing may stick out sideways — that is the fault that shipped in 1211.
          const over = [];
          col.querySelectorAll('*').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return;
            if (r.right > bb.right + 1 || r.left < bb.left - 1) {
              over.push((el.id || el.className || el.tagName) + '@' + Math.round(r.right));
            }
          });
          const fieldsCS = getComputedStyle(document.querySelector('.cd-fields'));
          // Every question must still be beside its own answer control.
          const rows = [].slice.call(col.querySelectorAll('.cd-blk')).map(b => {
            const r = b.getBoundingClientRect();
            return { h: Math.round(r.height), w: Math.round(r.width),
                     txt: (b.textContent || '').trim().slice(0, 14) };
          });
          return { height: Math.round(cb.height), width: Math.round(cb.width),
                   cols: fieldsCS.gridTemplateColumns.split(' ').length,
                   over, rows };
        });
        await pg.close();
        return out;
      };

      const narrow = await measure(520, false);
      const wide   = await measure(900, true);

      ok('add step: the narrow box is still one column',
         narrow.cols === 1, JSON.stringify(narrow.cols));
      ok('add step: the wide box is two',
         wide.cols === 2, JSON.stringify(wide.cols));
      ok('add step: nothing sticks out of the narrow box',
         narrow.over.length === 0, narrow.over.join(' '));
      ok('add step: nothing sticks out of the wide box',
         wide.over.length === 0, wide.over.join(' '));
      const narrowOpen = await measure(520, false, OPEN, 'o');
      const wideOpen   = await measure(900, true,  OPEN, 'o');

      // The whole point: it has to be SHORTER, not merely different.
      ok('add step: the wide layout is measurably shorter',
         wide.height < narrow.height * 0.85,
         wide.height + 'px wide vs ' + narrow.height + 'px narrow');
      ok('add step: …and shorter still once every question has opened a field',
         wideOpen.height < narrowOpen.height * 0.8,
         wideOpen.height + 'px wide vs ' + narrowOpen.height + 'px narrow');
      ok('add step: nothing sticks out when every field is open either',
         wideOpen.over.length === 0 && narrowOpen.over.length === 0,
         wideOpen.over.concat(narrowOpen.over).join(' '));
      ok('add step: …and short enough to stop scrolling on a 1080p desktop',
         wide.height <= 900 - 150,
         wide.height + 'px inside a ' + (900 - 150) + 'px body');
      ok('add step: every question block still has real width in two columns',
         wide.rows.length > 0 && wide.rows.every(r => r.w > 150 && r.h > 10),
         JSON.stringify(wide.rows));
    }


    // ══════════════════════════════════════════════════════════════════
    // The variation description, MEASURED (v0.9.1233)
    //
    // Brad's Step 2 of 8 screenshot: item 726RR, one attribute per line, in a
    // 520px box. The claim is that the same text in its book sections, at the
    // width the modal now has, is meaningfully shorter. That is a measurement,
    // not an opinion.
    // ══════════════════════════════════════════════════════════════════
    {
      const wzSrc = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
      const ssrc = wzSrc.slice(wzSrc.indexOf('function _wizVarSections(txt)'),
                               wzSrc.indexOf('window._wizVarSections = _wizVarSections;'));
      const dsrc = wzSrc.slice(wzSrc.indexOf('const _vSecHtml = (sc, hl) =>'),
                               wzSrc.indexOf('let _vpCanHelp=false;'));
      const esc = x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const sections = new Function('txt', '"use strict";' + ssrc + '; return _wizVarSections(txt);');
      const descHtml = (raw, wide) => new Function(
        '_vEsc', '_vHl', '_vBaseNum', '_wizWide', '_wizVarSections',
        '"use strict";' + dsrc + '; return _vDescHtml;')(esc, esc, '1', () => wide, sections)
        ({ variation: '2', varDesc: raw });

      // Brad's own 726RR text, as the reference book has it.
      const RAW = ['(with RR on the side of the cab under 726)', '1952', '',
        'ENGINE', 'silver rubber stamped numbers', 'black stack',
        'with hexagonal based blackened flagstaffs',
        'reinforcement added under headlight',
        'ornamental bell and whistle, handrails on both sides with cotter key type stanchions',
        'simulated coupler on top of pilot, diecast trailing and pilot truck',
        'cab has 4 pane windows', 'large sand dome on top of boiler',
        'lighted, without Magnatraction', 'slant mounted motor with single worm drive',
        'with E unit slot, has three position E unit', 'spoked sintered iron drive wheels',
        'resistance coil provides smoke',
        'TENDER', 'plastic shell painted black with white heat stamped lettering',
        'with whistle', 'with water scoop', 'without handrails',
        'molded steps at rear corners'].join('\n');

      const vPage = (widthPx, html) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${APP}/app.css">
<style>html,body{margin:0;background:#111}
 #box{width:${widthPx}px;box-sizing:border-box;padding:1rem 1.5rem}
 #card{border:2px solid #444;border-radius:10px;padding:0.85rem 1rem}</style></head>
<body><div id="box"><div id="card">${html}</div></div></body></html>`;

      const vMeasure = async (widthPx, wide) => {
        const f3 = path.join(dir, 'var-' + widthPx + '.html');
        fs.writeFileSync(f3, vPage(widthPx, descHtml(RAW, wide)));
        const pg = await browser.newPage({ viewport: { width: widthPx + 40, height: 1200 } });
        await pg.goto('file://' + f3);
        await pg.waitForTimeout(150);
        const out = await pg.evaluate(() => {
          const card = document.getElementById('card');
          const box = document.getElementById('box');
          const bb = box.getBoundingClientRect();
          const over = [];
          card.querySelectorAll('*').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return;
            if (r.right > bb.right + 1 || r.left < bb.left - 1) over.push(el.className || el.tagName);
          });
          // Each heading must sit directly above its own list, never beside it
          // in a different column.
          const secs = [].slice.call(card.querySelectorAll('.var-sec')).map(sc => {
            const h = sc.querySelector('.var-sec-h'), b = sc.querySelector('.var-sec-b');
            return { head: h ? h.textContent.trim() : '',
                     headBottom: h ? Math.round(h.getBoundingClientRect().bottom) : null,
                     bodyTop: b ? Math.round(b.getBoundingClientRect().top) : null,
                     left: Math.round(sc.getBoundingClientRect().left) };
          });
          return { height: Math.round(card.getBoundingClientRect().height), over, secs };
        });
        await pg.close();
        return out;
      };

      const vNarrow = await vMeasure(520, false);
      const vWide   = await vMeasure(900, true);

      ok('variation: the 520px box is the plain single column it always was',
         vNarrow.secs.length === 0);
      ok('variation: the wide box is split into preamble, ENGINE and TENDER',
         vWide.secs.length === 3, JSON.stringify(vWide.secs.map(x => x.head)));
      ok('variation: ENGINE and TENDER end up side by side, not stacked',
         vWide.secs.length === 3 && vWide.secs[1].left !== vWide.secs[2].left,
         JSON.stringify(vWide.secs.map(x => x.left)));
      ok('variation: every heading sits directly above its own list',
         vWide.secs.filter(x => x.head)
                   .every(x => x.bodyTop >= x.headBottom - 1 && x.bodyTop - x.headBottom < 30),
         JSON.stringify(vWide.secs));
      ok('variation: nothing overhangs at either width',
         vNarrow.over.length === 0 && vWide.over.length === 0,
         vNarrow.over.concat(vWide.over).join(' '));
      ok('variation: the description is measurably shorter',
         vWide.height < vNarrow.height * 0.8,
         vWide.height + 'px wide vs ' + vNarrow.height + 'px narrow');
      // The saving is bounded by the LONGEST section — ENGINE has three times
      // TENDER's lines here, so the pair can never be shorter than ENGINE
      // alone. That is the price of keeping sections whole, and it is still
      // enough: what Brad actually asked for is that the step stop scrolling.
      // The wizard body on a 1080p desktop is the 900px box less its header,
      // progress strip, "ADDING" banner and footer.
      const BODY_ROOM = 900 - 120 - 50 - 70;
      ok('variation: …and the whole description now fits without scrolling',
         vWide.height <= BODY_ROOM,
         vWide.height + 'px inside ' + BODY_ROOM + 'px');
      ok('variation: …which it did not at the old 580px box',
         vNarrow.height > 580 - 120 - 50 - 70,
         vNarrow.height + 'px inside ' + (580 - 120 - 50 - 70) + 'px');
    }


    // ══════════════════════════════════════════════════════════════════
    // The watermark, MEASURED (v0.9.1241)
    //
    // Brad: "should be underneath everything. also the photos going through
    // the middle should not be transparent." Both halves are pixel facts:
    // a photo sitting over the mark must be its own colour EXACTLY, and the
    // mark must still be visible where nothing covers it. A grep can see
    // neither. This renders the real .main rule from app.css with a real
    // z-index:-1 backdrop and samples the pixels.
    // ══════════════════════════════════════════════════════════════════
    {
      // A solid magenta "photo" and a solid green "watermark" — any blending
      // shows up immediately as a changed channel.
      // The backdrop's style string is taken from applyLogoBackdrop itself, not
      // retyped here. A fixture that hard-codes z-index:-1 proves only that the
      // TEST wrote -1; it would stay green with the app back at z-index:1.
      const apSrc = fs.readFileSync(path.join(APP, 'appearance.js'), 'utf8');
      // The assignment spans several lines and has a comment in the middle
      // whose text contains an apostrophe — so strip comments FIRST, then join
      // the string pieces. (Regexing across it directly does not survive
      // "Brad's": the apostrophe ends the character class.)
      const wmStyle = (function () {
        const at = apSrc.indexOf("el.style.cssText = 'position:fixed");
        if (at < 0) return 'MISSING';
        const seg = apSrc.slice(at, apSrc.indexOf(';\n', apSrc.indexOf('background-size', at)))
                         .replace(/\/\/[^\n]*/g, '');
        const parts = seg.match(/'([^']*)'/g) || [];
        return parts.map(x => x.slice(1, -1)).join('');
      })();
      ok('watermark: the backdrop style was found in appearance.js',
         wmStyle !== 'MISSING' && /z-index/.test(wmStyle), wmStyle.slice(0, 80));

      // v0.9.1255: the backdrop no longer carries `inset:0` — it is a fixed
      // layer given .main's BOX, so it centres in the cream and not on the
      // screen. Take that sizing rule from appearance.js too rather than
      // retyping it: a fixture that positions the element itself would prove
      // only that the fixture can do maths.
      const wmFit = (function () {
        const at = apSrc.indexOf('function _fitLogoBackdrop()');
        if (at < 0) return '';
        return apSrc.slice(at, apSrc.indexOf('\n  }', at) + 4);
      })();
      ok('watermark: the sizing rule was found in appearance.js',
         /getBoundingClientRect\(\)/.test(wmFit) && /el\.style\.left/.test(wmFit), wmFit.slice(0, 60));

      // A real sidebar, so .main is OFFSET from the window. Without one the
      // old bug and the fix look identical.
      const wmPage = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${APP}/app.css">
<style>html,body{margin:0;height:100%}
 .app-body{display:flex;height:100%}
 .sidebar{width:260px;flex:0 0 260px;background:#123}
 #card{width:200px;height:120px;background:#ff00ff;margin:40px}</style></head>
<body><div class="app-body"><div class="sidebar"></div><div class="main">
  <div id="rr-logo-bg" style="${wmStyle};background-image:none;background-color:#00ff00;opacity:0.5"></div>
  <div id="card"></div>
</div></div>
<script>${wmFit}\n_fitLogoBackdrop();</script>
</body></html>`;
      const f4 = path.join(dir, 'watermark.html');
      fs.writeFileSync(f4, wmPage);
      const pg = await browser.newPage({ viewport: { width: 900, height: 600 } });
      await pg.goto('file://' + f4);
      await pg.waitForTimeout(120);
      const shot = await pg.screenshot({ type: 'png' });
      const box = await pg.evaluate(() => {
        const c = document.getElementById('card').getBoundingClientRect();
        return { cx: Math.round(c.left + c.width / 2), cy: Math.round(c.top + c.height / 2),
                 bx: Math.round(c.right + 120), by: Math.round(c.top + c.height / 2) };
      });
      // v0.9.1255 — THE POINT OF THE CHANGE. Brad: "the water mark logo needs
      // to stay centered in the yellow part not centered in the screen."
      // With a 260px sidebar the two centres are 130px apart, so this is the
      // one measurement that tells the fix from the bug.
      {
        const geo = await pg.evaluate(() => {
          const b = document.getElementById('rr-logo-bg').getBoundingClientRect();
          const m = document.querySelector('.main').getBoundingClientRect();
          return {
            bg: { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height),
                  cx: Math.round(b.left + b.width / 2) },
            main: { l: Math.round(m.left), t: Math.round(m.top), w: Math.round(m.width), h: Math.round(m.height),
                    cx: Math.round(m.left + m.width / 2) },
            winCx: Math.round(window.innerWidth / 2),
            fixed: getComputedStyle(document.getElementById('rr-logo-bg')).position,
          };
        });
        ok('watermark: it fills the cream area exactly, not the window',
           geo.bg.l === geo.main.l && geo.bg.t === geo.main.t &&
           geo.bg.w === geo.main.w && geo.bg.h === geo.main.h,
           JSON.stringify(geo.bg) + ' vs ' + JSON.stringify(geo.main));
        ok('watermark: its centre is the CREAM centre',
           geo.bg.cx === geo.main.cx, geo.bg.cx + ' vs ' + geo.main.cx);
        ok('watermark: …which is NOT the screen centre, so this measures the fix',
           geo.main.cx !== geo.winCx, 'cream ' + geo.main.cx + ' / screen ' + geo.winCx);
        ok('watermark: it does not start at the window edge any more',
           geo.bg.l > 0, 'left=' + geo.bg.l);
        ok('watermark: it stays FIXED, so it does not scroll away with the list',
           geo.fixed === 'fixed', geo.fixed);
      }

      await pg.close();

      // Decode the PNG without a dependency: re-render the two sample points
      // through a canvas in the browser instead.
      const pg2 = await browser.newPage({ viewport: { width: 900, height: 600 } });
      await pg2.goto('file://' + f4);
      await pg2.waitForTimeout(120);
      const px = await pg2.evaluate(async (b64pt) => {
        // Read pixels straight off a canvas painting of the page is not
        // available; instead assert the computed stacking directly.
        const wm = document.getElementById('rr-logo-bg');
        const card = document.getElementById('card');
        const main = document.querySelector('.main');
        const cs = getComputedStyle(main);
        const wcs = getComputedStyle(wm);
        // elementFromPoint over the card must be the card, never the mark.
        const overCard = document.elementFromPoint(b64pt.cx, b64pt.cy);
        const overBare = document.elementFromPoint(b64pt.bx, b64pt.by);
        return {
          mainPos: cs.position, mainZ: cs.zIndex,
          wmZ: wcs.zIndex, wmPE: wcs.pointerEvents,
          overCard: overCard && overCard.id,
          overBare: overBare && (overBare.id || overBare.className),
          mainCreates: cs.position !== 'static' && cs.zIndex !== 'auto'
        };
      }, box);
      await pg2.close();

      ok('watermark: .main really is a stacking context in the browser',
         px.mainCreates === true, px.mainPos + ' / z-index ' + px.mainZ);
      ok('watermark: the backdrop sits at z-index -1',
         px.wmZ === '-1', px.wmZ);
      ok('watermark: a photo over it is the topmost thing at that point',
         px.overCard === 'card', String(px.overCard));
      ok('watermark: it never wins a hit-test even where nothing covers it',
         px.wmPE === 'none' && px.overBare !== 'rr-logo-bg', String(px.overBare));

      // The pixels themselves — this is the half Brad reported.
      const sharp = (() => { try { return require('pngjs').PNG; } catch (e) { return null; } })();
      if (sharp) {
        const png = sharp.sync.read(shot);
        const at = (x, y) => { const i = (png.width * y + x) << 2;
          return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
        const onCard = at(box.cx, box.cy);
        const onBare = at(box.bx, box.by);
        ok('watermark: the photo is its own colour exactly — no wash over it',
           onCard[0] === 255 && onCard[1] === 0 && onCard[2] === 255, JSON.stringify(onCard));
        ok('watermark: …and the mark is still visible where nothing covers it',
           onBare[1] > onBare[0] && onBare[1] > onBare[2], JSON.stringify(onBare));
      } else {
        // v0.9.1257: this used to be `ok(…, true)` — a PASS printed for two
        // pixel reads that never happened, in the one part of the file that
        // looks at actual rendered colour. pngjs is a DECLARED dependency,
        // so its absence is a broken install, not a lifestyle choice.
        ok('watermark: pixel check could NOT run — pngjs missing', false, 'run npm install');
      }
    }


    // ══════════════════════════════════════════════════════════════════
    // The dashboard's add buttons, MEASURED (v0.9.1244)
    //
    // Brad: "the add buttons on top need to sit above the background logo, and
    // not be transparant." They carried a 12%-opacity inline background, so a
    // watermark behind them showed straight through. Whether a button is
    // see-through is a pixel fact — sample it.
    // ══════════════════════════════════════════════════════════════════
    {
      const btnPage = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${APP}/app.css">
<style>html,body{margin:0;height:100%}.app-body{display:flex;height:100%}</style></head>
<body><div class="app-body"><div class="main">
  <div id="rr-logo-bg" style="position:fixed;inset:0;pointer-events:none;z-index:-1;
       background:#00ff00;opacity:1"></div>
  <div class="dash-desktop-actions"><button class="btn" id="b1">Add to My Collection</button></div>
</div></div></body></html>`;
      const f5 = path.join(dir, 'dashbtn.html');
      fs.writeFileSync(f5, btnPage);
      const pg3 = await browser.newPage({ viewport: { width: 900, height: 400 } });
      await pg3.goto('file://' + f5);
      await pg3.waitForTimeout(120);
      const shot3 = await pg3.screenshot({ type: 'png' });
      const pt = await pg3.evaluate(() => {
        const b = document.getElementById('b1').getBoundingClientRect();
        const cs = getComputedStyle(document.getElementById('b1'));
        return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2),
                 bg: cs.backgroundColor, z: cs.zIndex, pos: cs.position };
      });
      await pg3.close();
      ok('add buttons: the background is a solid colour, not a 12% wash',
         !/rgba\([^)]*,\s*0?\.\d+\)/.test(pt.bg), pt.bg);
      ok('add buttons: …and they sit above the watermark explicitly',
         pt.pos === 'relative' && pt.z === '1', pt.pos + ' / ' + pt.z);
      const png3 = (() => { try { return require('pngjs').PNG.sync.read(shot3); } catch (e) { return null; } })();
      if (png3) {
        const i = (png3.width * pt.y + pt.x) << 2;
        const px3 = [png3.data[i], png3.data[i + 1], png3.data[i + 2]];
        // A solid green backdrop is directly behind. If any of it reaches the
        // button face, green wins the middle channel.
        ok('add buttons: nothing behind them bleeds through',
           !(px3[1] > px3[0] && px3[1] > px3[2]), JSON.stringify(px3));
      } else {
        // v0.9.1257 — see the note on the watermark pixel check above.
        ok('add buttons: pixel check could NOT run — pngjs missing', false, 'run npm install');
      }
    }


    // ══════════════════════════════════════════════════════════════════
    // Every swept toolbar button, MEASURED (v0.9.1273, rebuilt v0.9.1274)
    //
    // Brad, on a screenshot of the Photo Inbox: "the buttons do not need to
    // be transparent." Same complaint as v0.9.1244, one floor up: those
    // buttons carried a 12%-opacity inline background, and nothing had
    // changed about them — what changed was the watermark. v0.9.1241 doubled
    // #rr-logo-bg to min(110vmin,840px) at Brad's ask, and it finally reached
    // the toolbar. A locomotive behind glass.
    //
    // v0.9.1273 rewrote 139 inline button backgrounds to
    //   background:var(--bg-card);background:color-mix(in srgb, rgb(R,G,B) N%, var(--bg-card))
    // …and Brad's next screenshot said "still transparent". He was right.
    // The v0.9.869 master lever in app.css —
    //   .main button[style*="#2980b9"] … { background:rgba(139,142,148,0.12) !important }
    // — matches any button whose inline style MENTIONS one of seven legacy
    // colours (almost all of them: the blue text alone is enough), and its
    // !important beat every one of the 139 opaque declarations. The sweep was
    // correct and the stylesheet painted the wash straight back over it.
    // v0.9.1274 gives that lever (and the v0.9.870 destructive one) the same
    // opaque color-mix treatment.
    //
    // WHY THE v0.9.1273 VERSION OF THIS TEST MISSED IT: it rendered each
    // extracted background declaration on a bare button, stripped of the rest
    // of its style — so the lever, which matches on the OTHER parts of the
    // style attribute, never fired in the test while firing on every real
    // button in the app. A rendering test must render what the app renders.
    // So now each declaration is rendered BOTH ways — bare (inline wins) and
    // with the lever-triggering blue text (the lever wins) — plus one button
    // per lever trigger token, styled the way the legacy call sites were.
    //
    // The proof itself is unchanged and tint-blind: render everything over
    // two wildly different backdrops and require every button face to come
    // out pixel-identical. Any transparency at all makes the two differ.
    // ══════════════════════════════════════════════════════════════════
    {
      // Deliberately NOT anchored to var(--bg-card): an extractor that only
      // picks up declarations already in the right shape can never render a
      // wrong one, and a color-mix against `transparent` — which reads like a
      // fix and renders like the bug — would sail through untested. Match any
      // second operand and let the pixels decide.
      const MIX_RE = /color-mix\(in srgb, rgb\(\d+,\s*\d+,\s*\d+\) [\d.]+%, (?:var\(--[a-z0-9-]+\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\)/g;
      const mixes = [];
      for (const f of fs.readdirSync(APP).filter(n => n.endsWith('.js'))) {
        const src = fs.readFileSync(path.join(APP, f), 'utf8');
        let m;
        MIX_RE.lastIndex = 0;
        while ((m = MIX_RE.exec(src)) !== null) if (mixes.indexOf(m[0]) === -1) mixes.push(m[0]);
      }
      // app.css itself now carries the lever's color-mix — include it, so a
      // hand-edit to the lever's tint is rendered and measured like any other.
      {
        const css = fs.readFileSync(path.join(APP, 'app.css'), 'utf8');
        let m;
        MIX_RE.lastIndex = 0;
        while ((m = MIX_RE.exec(css)) !== null) if (mixes.indexOf(m[0]) === -1) mixes.push(m[0]);
      }

      ok('swept buttons: the shipped source actually uses color-mix',
         mixes.length >= 30, mixes.length + ' distinct declarations found');

      // Three families of test button:
      //   sb<i>  — the declaration alone; the inline style wins.
      //   sl<i>  — the same declaration + the blue text that makes the
      //            v0.9.869 lever match; the LEVER's background wins. This is
      //            the shape nearly every real button in the app has, and the
      //            one the v0.9.1273 test forgot to build.
      //   tk<i>  — one button per lever trigger token, styled like the legacy
      //            call sites the lever exists to reskin (solid legacy
      //            background). Covers both levers including #e74c3c.
      const TOKENS = ['#2ecc71', '#e67e22', '#8b5cf6', '#16a085', '#3498db',
                      '#2980b9', 'var(--accent)', '#e74c3c'];
      const ids = [];
      let cells = '';
      const base = 'display:block;width:200px;height:34px;margin:6px;border-radius:8px;';
      mixes.forEach((mix, i) => {
        cells += '<button class="btn" id="sb' + i + '" style="' + base +
                 'background:var(--bg-card);background:' + mix + '">b' + i + '</button>';
        ids.push('sb' + i);
        cells += '<button class="btn" id="sl' + i + '" style="' + base +
                 'background:var(--bg-card);background:' + mix + ';color:#2980b9">L' + i + '</button>';
        ids.push('sl' + i);
      });
      TOKENS.forEach((tok, i) => {
        cells += '<button class="btn" id="tk' + i + '" style="' + base +
                 'background:' + tok + ';color:#fff">t' + i + '</button>';
        ids.push('tk' + i);
      });

      const render = async function (backdrop, file) {
        const page = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${APP}/app.css">
<style>html,body{margin:0;height:100%}.app-body{display:flex;height:100%}
.main{overflow:auto}</style></head>
<body><div class="app-body"><div class="main">
  <div id="rr-logo-bg" style="position:fixed;inset:0;pointer-events:none;z-index:-1;
       background:${backdrop};opacity:1"></div>
  ${cells}
</div></div></body></html>`;
        const fp = path.join(dir, file);
        fs.writeFileSync(fp, page);
        const pg = await browser.newPage({ viewport: { width: 400, height: 300 } });
        await pg.goto('file://' + fp);
        await pg.waitForTimeout(150);
        const shot = await pg.screenshot({ type: 'png', fullPage: true });
        const at = await pg.evaluate((list) => {
          return list.map(function (id) {
            const el = document.getElementById(id);
            const b = el.getBoundingClientRect();
            return { id: id, x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2),
                     bg: getComputedStyle(el).backgroundColor };
          });
        }, ids);
        await pg.close();
        return { shot: shot, spots: at };
      };
      const green = await render('#00ff00', 'sweptbtn-g.html');
      const magenta = await render('#ff00ff', 'sweptbtn-m.html');
      const spots = green.spots;

      // Which declaration won? On a browser with color-mix the computed value
      // comes back as color(srgb …); on one without it, an opaque rgb() from
      // a fallback. Both are opaque, and the suite should say WHICH out loud
      // rather than passing on either and leaving it ambiguous.
      const mixWon = spots.filter(s => /^color\(/.test(s.bg)).length;
      ok('swept buttons: color-mix resolves in this browser (not the fallback)',
         mixWon === spots.length, mixWon + ' of ' + spots.length + ' — sample: ' + (spots[0] || {}).bg);

      // Opaque means no alpha component, in EITHER notation: rgba(…, 0.12)
      // or color(srgb … / 0.12). A test that only knew rgba() would have
      // waved the whole sweep through.
      const seeThrough = spots.filter(s =>
        /rgba\([^)]*,\s*0?\.\d+\s*\)/.test(s.bg) || /\/\s*0?\.\d+\s*\)/.test(s.bg));
      ok('swept buttons: not one of them computes to a translucent colour',
         seeThrough.length === 0,
         seeThrough.length ? JSON.stringify(seeThrough.slice(0, 4)) : spots.length + ' checked');

      const readPng = (buf) => { try { return require('pngjs').PNG.sync.read(buf); } catch (e) { return null; } };
      const pngG = readPng(green.shot), pngM = readPng(magenta.shot);
      if (pngG && pngM) {
        const sample = (png, s) => {
          const i = (png.width * s.y + s.x) << 2;
          return [png.data[i], png.data[i + 1], png.data[i + 2]];
        };
        const bled = [];
        spots.forEach((s, idx) => {
          const a = sample(pngG, s), b = sample(pngM, magenta.spots[idx]);
          if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) {
            bled.push({ id: s.id, overGreen: a, overMagenta: b });
          }
        });
        ok('swept buttons: the watermark does not show through any of them',
           bled.length === 0,
           bled.length ? JSON.stringify(bled.slice(0, 3)) : spots.length + ' buttons (incl. lever-matched), two backdrops, identical');

        // Sanity: the two renders MUST differ somewhere, or the comparison
        // above is comparing a page against itself and would pass on anything.
        const bare = { x: 380, y: 20 };
        const bg1 = sample(pngG, bare), bg2 = sample(pngM, bare);
        ok('swept buttons: …and the two backdrops really did differ (control)',
           bg1[0] !== bg2[0] || bg1[1] !== bg2[1] || bg1[2] !== bg2[2],
           JSON.stringify(bg1) + ' vs ' + JSON.stringify(bg2));
      } else {
        // v0.9.1257 — see the note on the watermark pixel check above.
        ok('swept buttons: pixel check could NOT run — pngjs missing', false, 'run npm install');
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // The THIRD painter, MEASURED (v0.9.1282)
    //
    // Brad: "you can see the logo through group photos and tag photo."
    // v0.9.1273 fixed the markup, v0.9.1274 fixed the stylesheet — and these
    // two buttons still bled, because _selInfo repaints them from JAVASCRIPT
    // on every selection change. The first JS touch re-serialises the style
    // attribute ("#2980b9" -> "rgb(41, 128, 185)"), the v0.9.869 lever's
    // [style*="#2980b9"] quietly stops matching, and the JS wash lands on a
    // button no stylesheet protects any more.
    //
    // So this block runs the REAL _pinOpaqueTint from the shipped source,
    // after the real markup, over two backdrops — the same tint-blind proof
    // as the other two layers get.
    // ══════════════════════════════════════════════════════════════════
    {
      const pinSrc = fs.readFileSync(path.join(APP, 'photo-inbox.js'), 'utf8');
      const ha = pinSrc.indexOf('function _pinOpaqueTint(el, rgbCsv, pct) {');
      const helper = ha >= 0 ? pinSrc.slice(ha, pinSrc.indexOf('\n  }', ha) + 4) : '';
      ok('js repaint: _pinOpaqueTint exists in the shipped source', helper.length > 50);
      const btnStyle = 'padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;'
        + 'background:var(--bg-card);background:color-mix(in srgb, rgb(139,142,148) 12%, var(--bg-card));'
        + 'color:#2980b9;font-weight:700;font-size:0.82rem';
      const render = async function (backdrop, file) {
        const page = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${APP}/app.css">
<style>html,body{margin:0;height:100%}.app-body{display:flex;height:100%}.main{overflow:auto;padding:20px}</style>
</head><body><div class="app-body"><div class="main">
<div id="rr-logo-bg" style="position:fixed;inset:0;pointer-events:none;z-index:-1;background:${backdrop};opacity:1"></div>
<button id="jt-idle" style="${btnStyle}">aaaaaa</button>
<button id="jt-active" style="${btnStyle}">aaaaaa</button>
</div></div>
<script>${helper.replace(/^  /gm, '')}
_pinOpaqueTint(document.getElementById('jt-idle'), '139,142,148', 12);
_pinOpaqueTint(document.getElementById('jt-active'), '41,128,185', 18);
</script></body></html>`;
        const fp = path.join(dir, file);
        fs.writeFileSync(fp, page);
        const pg = await browser.newPage({ viewport: { width: 420, height: 110 } });
        await pg.goto('file://' + fp);
        await pg.waitForTimeout(120);
        const shot = await pg.screenshot({ type: 'png' });
        const at = await pg.evaluate(() => ['jt-idle', 'jt-active'].map(function (id) {
          const r = document.getElementById(id).getBoundingClientRect();
          // sample INSIDE the face but away from the glyphs: 8px in from the left edge
          return { id: id, x: Math.round(r.left + 8), y: Math.round(r.top + r.height / 2) };
        }));
        await pg.close();
        return { shot: shot, spots: at };
      };
      const jg = await render('#00ff00', 'jsrepaint-g.html');
      const jm = await render('#ff00ff', 'jsrepaint-m.html');
      const readPng = (buf) => { try { return require('pngjs').PNG.sync.read(buf); } catch (e) { return null; } };
      const pg2 = readPng(jg.shot), pm2 = readPng(jm.shot);
      if (pg2 && pm2) {
        const sample = (png, s) => { const i = (png.width * s.y + s.x) << 2; return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
        const bled = [];
        jg.spots.forEach((s, i) => {
          const a = sample(pg2, s), b = sample(pm2, jm.spots[i]);
          if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) bled.push({ id: s.id, overGreen: a, overMagenta: b });
        });
        ok('js repaint: a JS-repainted mode button is opaque over any backdrop',
           bled.length === 0, bled.length ? JSON.stringify(bled) : '2 buttons, two backdrops, identical');
      } else {
        ok('js repaint: pixel check could NOT run — pngjs missing', false, 'run npm install');
      }
    }


    // ══════════════════════════════════════════════════════════════════
    // The detail-page photo gallery, MEASURED (v0.9.1293, request #29)
    //
    // The hero+rail gallery grew the drag-to-arrange gestures. This renders
    // the REAL _buildPhotoGallery (and the real shared sort it now calls)
    // with stub photos and measures: the chip row fits, the Right Side view
    // leads an unstamped folder, the tiles are draggable, and nothing
    // overhangs its container at desktop or side-column width. A grep can
    // see none of those.
    // ══════════════════════════════════════════════════════════════════
    {
      const collSrc = fs.readFileSync(path.join(APP, 'app-collection.js'), 'utf8');
      const h0 = collSrc.indexOf("var _RR_GAL_BLUE = '#2980b9';");
      const h1 = collSrc.indexOf('window._rrDetailGallery = async function');
      const g0 = collSrc.indexOf('var _galSeq = 0;');
      const g1 = collSrc.indexOf("if (typeof window !== 'undefined') window._buildPhotoGallery = _buildPhotoGallery;");
      ok('gallery: the real source slices were found', h0 > 0 && h1 > h0 && g0 > 0 && g1 > g0);
      const galSrc = collSrc.slice(h0, h1) + '\n' + collSrc.slice(g0, g1);
      const FAKES = JSON.stringify([
        { id: 'p1', name: '6561 BKV.jpg', thumbnailLink: '', view: '#' },
        { id: 'p2', name: '6561 RSV.jpg', thumbnailLink: '', view: '#' },
        { id: 'p3', name: '6561 FV.jpg', thumbnailLink: '', view: '#' },
        { id: 'p4', name: '6561 BOX TV.jpg', thumbnailLink: '', view: '#' },
      ]);
      const galPage = (width, stack) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${APP}/app.css">
<style>html,body{margin:0}#stage{width:${width}px;padding:12px;box-sizing:border-box;background:var(--surface);border:1px solid var(--border)}</style>
</head><body><div id="stage"></div>
<script>
  window.IS_MOBILE_UA = false;
  var ITEM_VIEWS = [
    { key: 'TV',  label: 'Top View',        abbr: 'Top' },
    { key: 'LSV', label: 'Left Side View',  abbr: 'Left Side' },
    { key: 'FV',  label: 'Front View',      abbr: 'Front' },
    { key: 'RSV', label: 'Right Side View', abbr: 'Right Side' },
    { key: 'BKV', label: 'Back View',       abbr: 'Back' },
    { key: 'BV',  label: 'Bottom View',     abbr: 'Bottom' },
  ];
  var COLORS = { p1: '%23888', p2: '%232980b9', p3: '%23999', p4: '%23c9922a' };
  function loadDriveThumb(id, img) {
    img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="' + (COLORS[id] || '%23777') + '"/></svg>';
  }
  function driveGetFolderPhotos() { return Promise.resolve(null); }
  function showToast() {}
  function driveRequest() { return Promise.resolve({}); }
  function _detailPhotoEdit() {}
</script>
<script>${galSrc}
  _buildPhotoGallery(document.getElementById('stage'), ${FAKES},
    { folderLink: 'https://drive.google.com/drive/folders/x', canRename: false, arrange: true${stack ? ', stack: true' : ''} });
</script></body></html>`;
      const measure = async function (width, stack, file) {
        const fp = path.join(dir, file);
        fs.writeFileSync(fp, galPage(width, stack));
        const pg = await browser.newPage({ viewport: { width: width + 40, height: 760 } });
        await pg.goto('file://' + fp);
        await pg.waitForTimeout(150);
        const m = await pg.evaluate(function () {
          const stage = document.getElementById('stage');
          const sr = stage.getBoundingClientRect();
          const chips = Array.prototype.slice.call(stage.children[0] ? stage.children[0].children : []);
          const tiles = Array.prototype.slice.call(stage.querySelectorAll('[draggable="true"]'));
          const labels = tiles.map(function (t) { var d = t.querySelector('div'); return d ? d.textContent : ''; });
          let overhang = 0;
          stage.querySelectorAll('*').forEach(function (n) {
            const r = n.getBoundingClientRect();
            if (r.width && r.right - sr.right > 1) overhang = Math.max(overhang, r.right - sr.right);
          });
          const imgsDraggable = Array.prototype.slice.call(stage.querySelectorAll('img'))
            .filter(function (im) { return im.draggable; }).length;
          return {
            chipTexts: chips.map(function (c) { return c.textContent; }),
            tileCount: tiles.length, labels: labels,
            overhang: overhang, imgsDraggable: imgsDraggable,
            heroLabel: (stage.querySelector('a div div') || {}).textContent || '',
          };
        });
        const shot = await pg.screenshot({ type: 'png', fullPage: true });
        fs.writeFileSync(path.join(dir, file.replace('.html', '.png')), shot);
        await pg.close();
        return m;
      };
      const wide = await measure(760, false, 'gallery-wide.html');
      ok('gallery: all seven view chips render, in projection order',
         wide.chipTexts.length === 7 && wide.chipTexts[0] === 'Top View' && wide.chipTexts[6] === 'plain photo',
         JSON.stringify(wide.chipTexts));
      ok('gallery: the Right Side view leads an unstamped folder',
         /RSV/.test(wide.heroLabel), wide.heroLabel);
      ok('gallery: every rail tile is draggable, and no image ghosts a URL',
         wide.tileCount === 4 && wide.imgsDraggable === 0,
         wide.tileCount + ' tiles, ' + wide.imgsDraggable + ' draggable imgs');
      ok('gallery: a tile with a view token wears the view\'s short name',
         wide.labels.indexOf('Front') !== -1 && wide.labels.indexOf('Back') !== -1,
         JSON.stringify(wide.labels));
      ok('gallery: nothing overhangs the card at desktop width',
         wide.overhang <= 1, wide.overhang + 'px overhang');
      const side = await measure(360, true, 'gallery-side.html');
      ok('gallery: the chip row wraps inside the narrow side column',
         side.overhang <= 1 && side.chipTexts.length === 7,
         side.overhang + 'px overhang, ' + side.chipTexts.length + ' chips');
      // keep the screenshots for review
      try {
        fs.mkdirSync(path.join(__dirname, '..', '_shots'), { recursive: true });
        fs.copyFileSync(path.join(dir, 'gallery-wide.png'), path.join(__dirname, '..', '_shots', 'gallery-wide.png'));
        fs.copyFileSync(path.join(dir, 'gallery-side.png'), path.join(__dirname, '..', '_shots', 'gallery-side.png'));
      } catch (e) {}
    }

    // ══════════════════════════════════════════════════════════════════
    // The excluded-numbers card section, MEASURED (v0.9.1294, request #30)
    //
    // The REAL _pinExcludedHtml builds the section here (fake store, real
    // code), and the render answers what a grep cannot: do the checkboxes
    // fit a review-card column without overflowing, and is the note
    // visible under them?
    // ══════════════════════════════════════════════════════════════════
    {
      const pinSrc = fs.readFileSync(path.join(APP, 'photo-inbox.js'), 'utf8');
      const x0 = pinSrc.indexOf('  var _exclView = { fid: null, nums: [] };');
      const x1 = pinSrc.indexOf("  var _rvAiMfr = '';");
      ok('excluded: the real section builder was found', x0 > 0 && x1 > x0);
      const exStore = { f1: { rejected: ['3-3-25', '175-50', '6561'] } };
      const exW = {};
      const exRig = new Function('window', '_pinOnScreenFid', '_ids', '_idsSave', 'rrEsc',
        pinSrc.slice(x0, x1) + '\n return _pinExcludedHtml;')(
          exW, () => 'f1', () => exStore, () => {}, (s) => String(s).replace(/</g, '&lt;'));
      exRig();                          // first render fills the view list
      exW._pinRejectToggle(1, false);   // one un-checked, like mid-correction
      const exHtml = exRig();
      const exPage = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${APP}/app.css">
<style>html,body{margin:0}#card{width:420px;padding:14px;box-sizing:border-box;background:var(--surface);border:1px solid var(--border);border-radius:12px}</style>
</head><body><div id="card">
<div style="font-size:0.8rem;color:#2ecc71;font-weight:700">✓ You already own one — this will be added as a separate copy.</div>
${exHtml}
</div></body></html>`;
      const exFp = path.join(dir, 'excluded-card.html');
      fs.writeFileSync(exFp, exPage);
      const exPg = await browser.newPage({ viewport: { width: 460, height: 340 } });
      await exPg.goto('file://' + exFp);
      await exPg.waitForTimeout(120);
      const exM = await exPg.evaluate(function () {
        const card = document.getElementById('card');
        const cr = card.getBoundingClientRect();
        const boxes = Array.prototype.slice.call(card.querySelectorAll('input[type="checkbox"]'));
        let overhang = 0;
        card.querySelectorAll('*').forEach(function (n) {
          const r = n.getBoundingClientRect();
          if (r.width && r.right - cr.right > 1) overhang = Math.max(overhang, r.right - cr.right);
        });
        const note = card.querySelector('#pin-rv-excl div:last-child');
        return {
          count: boxes.length,
          checked: boxes.filter(function (b) { return b.checked; }).length,
          overhang: overhang,
          noteVisible: !!(note && note.offsetHeight > 0 && /re-scan button below/.test(note.textContent)),
          boxSize: boxes.length ? boxes[0].getBoundingClientRect().height : 0,
        };
      });
      const exShot = await exPg.screenshot({ type: 'png', fullPage: true });
      await exPg.close();
      ok('excluded: three numbers render, the un-checked one still visible',
         exM.count === 3 && exM.checked === 2, JSON.stringify(exM));
      ok('excluded: the note under the checkboxes is visible and points at re-scan',
         exM.noteVisible);
      ok('excluded: checkboxes are finger-sized, not browser-default specks',
         exM.boxSize >= 14, exM.boxSize + 'px');
      ok('excluded: nothing overhangs the review-card column',
         exM.overhang <= 1, exM.overhang + 'px overhang');
      try {
        fs.mkdirSync(path.join(__dirname, '..', '_shots'), { recursive: true });
        fs.writeFileSync(path.join(__dirname, '..', '_shots', 'excluded-card.png'), exShot);
      } catch (e) {}
    }

    // ══════════════════════════════════════════════════════════════════
    // The filter chip row, MEASURED in both modes (v0.9.1295)
    //
    // Brad's paper-filter finding: the Section chip on My Collection
    // routed into a retired store and always showed zero. The REAL
    // _renderHierarchyChips draws here twice — owned (My Collection) and
    // not (Master Catalog) — and the render answers what a grep cannot:
    // which chips a user actually sees in each mode.
    // ══════════════════════════════════════════════════════════════════
    {
      const brSrc = fs.readFileSync(path.join(APP, 'browse.js'), 'utf8');
      const c0 = brSrc.indexOf("var _ERA_PERIODS = ['prewar', 'postwar', 'modern'];");
      const c1 = brSrc.indexOf('// v0.9.649 (Brad): one-tap reset of the whole filter hierarchy.');
      ok('chips: the real chip-row source slice was found', c0 > 0 && c1 > c0);
      const chipSrc = brSrc.slice(c0, c1);
      const chipPage = (owned) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${APP}/app.css">
<style>html,body{margin:0}#bar{width:900px;padding:10px;background:var(--surface)}#hierarchy-chips{display:flex;flex-wrap:wrap;gap:0.35rem;align-items:center}</style>
</head><body><div id="bar"><div id="hierarchy-chips"></div></div>
<select id="filter-type" style="display:none"><option value="">All Types</option><option value="Paper">Paper</option></select>
<script>
  try { localStorage.removeItem('lv_browse_filter_state'); } catch (e) {}
  window.state = { filters: { owned: ${owned} }, _browseTab: 'items' };
  var state = window.state;
</script>
<script>${chipSrc}
  _renderHierarchyChips();
</script></body></html>`;
      const chipMeasure = async function (owned, file) {
        const fp = path.join(dir, file);
        fs.writeFileSync(fp, chipPage(owned));
        const pg = await browser.newPage({ viewport: { width: 940, height: 90 } });
        await pg.goto('file://' + fp);
        await pg.waitForTimeout(100);
        const m = await pg.evaluate(function () {
          return Array.prototype.slice.call(document.querySelectorAll('#hierarchy-chips button'))
            .map(function (b) { return b.textContent.replace(/\s*▾\s*$/, '').trim(); });
        });
        const shot = await pg.screenshot({ type: 'png' });
        fs.writeFileSync(path.join(dir, file.replace('.html', '.png')), shot);
        await pg.close();
        return m;
      };
      const ownedChips = await chipMeasure(true, 'chips-collection.html');
      const masterChips = await chipMeasure(false, 'chips-master.html');
      ok('chips: My Collection has NO Section chip',
         ownedChips.indexOf('Items') < 0, JSON.stringify(ownedChips));
      ok('chips: …but keeps Manufacturer, Scale, Era and All Types',
         ownedChips.indexOf('Any Manufacturer') >= 0 && ownedChips.indexOf('Any Scale') >= 0 &&
         ownedChips.indexOf('Any Era') >= 0 && ownedChips.indexOf('All Types') >= 0,
         JSON.stringify(ownedChips));
      ok('chips: the Master Catalog still has its Section chip',
         masterChips.indexOf('Items') >= 0 && masterChips.indexOf('All Types') >= 0,
         JSON.stringify(masterChips));
      try {
        fs.mkdirSync(path.join(__dirname, '..', '_shots'), { recursive: true });
        fs.copyFileSync(path.join(dir, 'chips-collection.png'), path.join(__dirname, '..', '_shots', 'chips-collection.png'));
        fs.copyFileSync(path.join(dir, 'chips-master.png'), path.join(__dirname, '..', '_shots', 'chips-master.png'));
      } catch (e) {}
    }

    // ══════════════════════════════════════════════════════════════════
    // The Lens paste echo, MEASURED (v0.9.1296, request #28)
    //
    // The echo markup is EVALUATED out of wizard.js's real string concat
    // and filled by the REAL _identifyShowPasteEcho with a page-length
    // paste — the render proves the box stays capped (scrolls instead of
    // swallowing the modal) and shows text.
    // ══════════════════════════════════════════════════════════════════
    {
      const wizSrc = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
      const m0 = wizSrc.indexOf("'<div id=\"id-paste-echo\"");
      const m1 = wizSrc.indexOf("+ '</div>';", m0);
      ok('paste echo: the markup slice was found', m0 > 0 && m1 > m0);
      // The slice is a JS string-concat expression missing its leading value;
      // evaluate it as ('' + <slice minus trailing "+ '</div>';">).
      const expr = "'' + " + wizSrc.slice(m0, m1).replace(/^\s*\+/, '');
      const echoHtml = new Function('return (' + expr + ');')();
      const wpSrc = fs.readFileSync(path.join(APP, 'wizard-photos.js'), 'utf8');
      const e0 = wpSrc.indexOf('function _identifyShowPasteEcho(txt) {');
      const e1 = wpSrc.indexOf('\n}', e0) + 2;
      const echoPage = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${APP}/app.css">
<style>html,body{margin:0}#modal{width:420px;padding:14px;box-sizing:border-box;background:var(--surface);border:1px solid var(--border);border-radius:12px}</style>
</head><body><div id="modal">${echoHtml}</div>
<script>${wpSrc.slice(e0, e1)}
_identifyShowPasteEcho(Array(40).join('The Lionel 2331 Virginian Train Master is an O gauge diesel locomotive produced 1955-1958. '));
</script></body></html>`;
      const fp = path.join(dir, 'paste-echo.html');
      fs.writeFileSync(fp, echoPage);
      const pg = await browser.newPage({ viewport: { width: 460, height: 260 } });
      await pg.goto('file://' + fp);
      await pg.waitForTimeout(100);
      const m = await pg.evaluate(function () {
        const box = document.getElementById('id-paste-echo');
        const body = document.getElementById('id-paste-echo-text');
        return {
          visible: !!(box && box.offsetHeight > 0),
          bodyH: body ? body.getBoundingClientRect().height : 0,
          scrolls: body ? body.scrollHeight > body.clientHeight : false,
          label: box ? /What you pasted/i.test(box.textContent) : false,
        };
      });
      const shot = await pg.screenshot({ type: 'png', fullPage: true });
      await pg.close();
      ok('paste echo: the box renders, labeled', m.visible && m.label, JSON.stringify(m));
      // max-height:96px is content-box: + 0.9rem padding + 2px border ≈ 112px.
      ok('paste echo: a page-length paste is capped and scrolls',
         m.bodyH > 0 && m.bodyH <= 120 && m.scrolls, JSON.stringify(m));
      try {
        fs.mkdirSync(path.join(__dirname, '..', '_shots'), { recursive: true });
        fs.writeFileSync(path.join(__dirname, '..', '_shots', 'paste-echo.png'), shot);
      } catch (e) {}
    }

    // ══════════════════════════════════════════════════════════════════
    // The candidate picker, MEASURED (v0.9.1296, request #19)
    //
    // The REAL showCandidatePicker renders five same-number rows that
    // differ only in variation and section — the exact case Brad reported
    // as "five identical choices". The render proves each row now shows
    // something the others don't.
    // ══════════════════════════════════════════════════════════════════
    {
      const bcSrc = fs.readFileSync(path.join(APP, 'barcode.js'), 'utf8');
      const s0 = bcSrc.indexOf('function showCandidatePicker(candidates, scanResult) {');
      const s1 = bcSrc.indexOf('function _confirmCameraUse', s0) > 0
        ? bcSrc.indexOf('function _confirmCameraUse', s0)
        : bcSrc.indexOf('\n  // Expose globally', s0);
      ok('picker: the real source slice was found', s0 > 0 && s1 > s0);
      const CANDS = JSON.stringify([
        { itemNum: '6464-500', variation: 'A', varDetail: 'glossy yellow, black-outlined herald', description: 'Timken Boxcar', itemType: 'Boxcar', roadName: 'Timken', yearProd: '1954', _era: 'pw', _tab: 'Lionel PW - Items' },
        { itemNum: '6464-500', variation: 'B', varDetail: 'matte yellow, solid herald', description: 'Timken Boxcar', itemType: 'Boxcar', roadName: 'Timken', yearProd: '1954', _era: 'pw', _tab: 'Lionel PW - Items' },
        { itemNum: '6464-500', variation: 'C', varDetail: 'Hagerstown reissue', description: 'Timken Boxcar', itemType: 'Boxcar', roadName: 'Timken', yearProd: '1965', _era: 'pw', _tab: 'Lionel PW - Items' },
        { itemNum: '6464-500', description: 'Original box', _era: 'pw', _tab: 'Lionel PW - Boxes' },
        { itemNum: '6464-500', description: 'Inspection slip', _era: 'pw', _tab: 'Lionel PW - Paper' },
      ]);
      const pickPage = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%;background:#111}</style></head><body>
<script>
  function _eraLabel() { return 'Lionel Postwar'; }
  function _bcEsc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function _bcViewUrl() { return '#'; }
</script>
<script>${bcSrc.slice(s0, s1)}
showCandidatePicker(${CANDS}, { itemNum: '6464-500' });
</script></body></html>`;
      const fp = path.join(dir, 'picker.html');
      fs.writeFileSync(fp, pickPage);
      const pg = await browser.newPage({ viewport: { width: 560, height: 720 } });
      await pg.goto('file://' + fp);
      await pg.waitForTimeout(150);
      const m = await pg.evaluate(function () {
        const rows = Array.prototype.slice.call(document.querySelectorAll('.bc-cand'));
        const texts = rows.map(function (r) { return r.textContent.replace(/\s+/g, ' ').trim(); });
        return {
          count: rows.length,
          distinct: new Set(texts).size,
          hasVarA: texts.some(function (t) { return /Var\. A — glossy yellow/.test(t); }),
          tags: rows.map(function (r) { const s = r.querySelector('span'); return s ? s.textContent : ''; }),
        };
      });
      const shot = await pg.screenshot({ type: 'png', fullPage: true });
      await pg.close();
      ok('picker: five rows render and every one now reads differently',
         m.count === 5 && m.distinct === 5, JSON.stringify(m));
      ok('picker: the variation line is on the row',
         m.hasVarA, JSON.stringify(m));
      ok('picker: box and paper siblings wear their tags',
         m.tags.indexOf('BOX') >= 0 && m.tags.indexOf('PAPER') >= 0, JSON.stringify(m.tags));
      try {
        fs.mkdirSync(path.join(__dirname, '..', '_shots'), { recursive: true });
        fs.writeFileSync(path.join(__dirname, '..', '_shots', 'picker-real.png'), shot);
      } catch (e) {}
    }

    // ══════════════════════════════════════════════════════════════════
    // The floating group panel, MEASURED (v0.9.1297)
    //
    // The REAL _pinGrpPanelRender draws with four ticked photos and the
    // Train set kind, over a tall fake grid — proving it pins to the
    // top-right, stays inside the viewport, shows the thumbnails, the kind
    // select, the per-photo role selects and all three buttons.
    // ══════════════════════════════════════════════════════════════════
    {
      const pinSrc = fs.readFileSync(path.join(APP, 'photo-inbox.js'), 'utf8');
      const s0 = pinSrc.indexOf('  var _grpPanelKind = ');
      const s1 = pinSrc.indexOf('  window._pinConfirmUngroup');
      ok('panel: the real source slice was found', s0 > 0 && s1 > s0);
      const kindsSlice = pinSrc.slice(pinSrc.indexOf('  var _PIN_KINDS = ['), pinSrc.indexOf('\n  }', pinSrc.indexOf('function _pinDefaultRoles')) + 4);
      const panelPage = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${APP}/app.css">
<style>html,body{margin:0}#grid{height:1600px;background:var(--bg);padding:14px;color:var(--text-dim)}</style>
</head><body><div id="grid">the inbox grid (scrolls behind the panel)</div>
<script>
  window.IS_MOBILE_UA = false;
  function rrEsc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function showToast() {}
  function loadDriveThumb(id, img) { img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="%232980b9"/></svg>'; }
  function _pinMetaSet() { return Promise.resolve(true); }
  function _pinKindLabel(k) { return k; }
  function _pinRefresh() {}
  function _render() {}
  var _sel = { g1: 1 }, _selPurpose = 'group';
  function _selGroups() { return [{ key: 'g1', files: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] }]; }
  window._pinFinishMode = function () {};
</script>
<script>${kindsSlice}
${pinSrc.slice(s0, s1)}
_grpPanelKind = 'set';
_pinGrpPanelRender();
</script></body></html>`;
      const fp = path.join(dir, 'grp-panel.html');
      fs.writeFileSync(fp, panelPage);
      const pg = await browser.newPage({ viewport: { width: 1100, height: 700 } });
      await pg.goto('file://' + fp);
      await pg.waitForTimeout(150);
      await pg.evaluate(function () { window.scrollTo(0, 500); });
      await pg.waitForTimeout(80);
      const m = await pg.evaluate(function () {
        const p = document.getElementById('pin-grp-panel');
        if (!p) return { missing: true };
        const r = p.getBoundingClientRect();
        return {
          top: r.top, right: window.innerWidth - r.right, bottom: r.bottom,
          fixed: getComputedStyle(p).position === 'fixed',
          thumbs: p.querySelectorAll('img[data-gppfid]').length,
          roles: p.querySelectorAll('.pin-grp-panel-role').length,
          buttons: ['pin-grp-panel-apply', 'pin-grp-panel-cancel', 'pin-grp-panel-done']
            .every(function (id) { return !!document.getElementById(id); }),
          applyOn: !document.getElementById('pin-grp-panel-apply').disabled,
        };
      });
      const shot = await pg.screenshot({ type: 'png' });
      await pg.close();
      ok('panel: it renders fixed at the top-right and survives scrolling',
         !m.missing && m.fixed && m.top === 70 && m.right === 16, JSON.stringify(m));
      ok('panel: it stays inside the viewport', m.bottom <= 700, String(m.bottom));
      ok('panel: four ticked photos show as thumbnails with role dropdowns each',
         m.thumbs >= 8 && m.roles === 4, JSON.stringify(m));   // grid thumbs + role-row thumbs
      ok('panel: Apply, Cancel and Done are all present, Apply live at 2+ photos',
         m.buttons && m.applyOn);
      try {
        fs.mkdirSync(path.join(__dirname, '..', '_shots'), { recursive: true });
        fs.writeFileSync(path.join(__dirname, '..', '_shots', 'grp-panel.png'), shot);
      } catch (e) {}
    }

    // ══════════════════════════════════════════════════════════════════
    // The share card-actions screen, MEASURED (v0.9.1302)
    //
    // The REAL _rrActsStash/_rrActsBack/_rrBackBtnHtml/_rrCopyCardsToClipboard
    // run in the page: the card screen shows Copy-for-email and Back, Back
    // restores the original buttons, and Copy stitches two cards into ONE
    // image (height = both cards + the seam) handed to the clipboard.
    // ══════════════════════════════════════════════════════════════════
    {
      const sellSrc = fs.readFileSync(path.join(APP, 'sell.js'), 'utf8');
      const li0 = sellSrc.indexOf('function _rrLoadImg(');
      const li1 = sellSrc.indexOf('\n}', li0) + 2;
      const h0 = sellSrc.indexOf('function _rrDownloadFiles(');
      const h1 = sellSrc.indexOf('if (typeof window !== \'undefined\') { window._rrDoShareNow');
      ok('shareacts: the real source slices were found', li0 > 0 && h0 > 0 && h1 > h0);
      const actsPage = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${APP}/app.css">
<style>html,body{margin:0;background:var(--bg)}</style>
</head><body>
<div style="max-width:440px;margin:2rem auto;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.5rem">
  <div id="share-builder-actions" style="display:flex;flex-direction:column;gap:0.5rem">
    <button id="home-share">Share as images</button>
    <button id="home-pdf">Download as PDF instead</button>
  </div>
  <div id="share-progress" style="display:none"></div>
</div>
<script>
  function showToast(m) { window.__toast = m; }
  window.__copied = null;
  Object.defineProperty(navigator, 'clipboard', { value: { write: function (items) { window.__copied = items; return Promise.resolve(); } }, configurable: true });
  window.ClipboardItem = function (o) { this.parts = o; };
</script>
<script>${sellSrc.slice(li0, li1)}
${sellSrc.slice(h0, h1)}
window._rrActsBack = _rrActsBack; window._rrCopyCardsToClipboard = _rrCopyCardsToClipboard;
// two fake cards of known sizes, as the app would have built them
async function _mkCard(w, h) {
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  var x = c.getContext('2d'); x.fillStyle = '#123456'; x.fillRect(0, 0, w, h);
  var b = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
  return new File([b], 'card.png', { type: 'image/png' });
}
window.__ready = (async function () {
  window._rrShareFiles = [await _mkCard(700, 300), await _mkCard(700, 500)];
  var acts = document.getElementById('share-builder-actions');
  _rrActsStash(acts);
  acts.innerHTML = '<button id="do-share">Email 2 images…</button>' +
    '<button id="do-copy" onclick="_rrCopyCardsToClipboard()">Copy for email — then paste into your message</button>' +
    _rrBackBtnHtml();
  return true;
})();
</script></body></html>`;
      const fp2 = path.join(dir, 'share-acts.html');
      fs.writeFileSync(fp2, actsPage);
      const pg2 = await browser.newPage({ viewport: { width: 900, height: 700 } });
      await pg2.goto('file://' + fp2);
      await pg2.evaluate(function () { return window.__ready; });
      const card = await pg2.evaluate(async function () {
        document.getElementById('do-copy').click();
        await new Promise(function (r) { setTimeout(r, 300); });
        const items = window.__copied;
        if (!items || items.length !== 1) return { items: items ? items.length : 0 };
        const blob = items[0].parts['image/png'];
        const im = new Image();
        const u = URL.createObjectURL(blob);
        await new Promise(function (r) { im.onload = r; im.src = u; });
        return { items: 1, w: im.width, h: im.height, toast: window.__toast || '' };
      });
      ok('shareacts: Copy hands the clipboard ONE image, not a pile of files', card.items === 1, JSON.stringify(card));
      ok('shareacts: the stitch is both cards tall plus the seam, widest card wide',
         card.w === 700 && card.h === 300 + 500 + 16, card.w + 'x' + card.h);
      ok('shareacts: the toast tells Brad to click into the email and paste',
         /paste/.test(card.toast), card.toast);
      const back = await pg2.evaluate(function () {
        document.querySelector('#share-builder-actions button:last-child').click();
        return { home: !!document.getElementById('home-pdf') && !!document.getElementById('home-share'),
                 gone: !document.getElementById('do-copy') };
      });
      await pg2.close();
      ok('shareacts: Back restores the original Share / Download-PDF buttons, picks untouched',
         back.home && back.gone, JSON.stringify(back));
    }

  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
