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
        ok('watermark: pixel check skipped — pngjs not installed', true, 'npm i pngjs to enable');
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
        ok('add buttons: pixel check skipped — pngjs not installed', true);
      }
    }

  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
