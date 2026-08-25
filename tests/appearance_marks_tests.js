// ═══════════════════════════════════════════════════════════════
// appearance_marks_tests.js — Session 86. Size + round-badge on the marks.
//
// Brad, seeing his billboard watermark boxed in the middle of the cream:
// "we need to be able to control the size of the picture too… need a fit
// to screen or something like that." And the sidebar roundel: "2 issues
// here, size and transparent background."
//
// The watermark's size was hardcoded (min(110vmin,840px), v1241) and the
// sidebar mark capped at 110px in CSS. This suite pins the fix: each mark
// carries its own `size` (and `round` for the square-cornered logos), the
// setting rides the SAME brand record as the faintness so Preview /
// Cancel / Apply / Reset keep meaning what they meant, and the renderers
// honor it.
//
// Run:  node tests/appearance_marks_tests.js
// Proven to FAIL on v0.9.1577 (commit df4ac62) before the build.
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
function src(f) { return fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8'); }

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

// ── a small honest DOM: just enough for the three mark renderers ─
function fakeNode(tag) {
  return {
    tagName: String(tag || 'div').toUpperCase(),
    id: '', innerHTML: '', style: {},
    children: [], parentNode: null,
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    insertBefore(c) { c.parentNode = this; this.children.unshift(c); return c; },
    remove() { this.parentNode = null; },
    querySelector() { return null; },
    classList: { add() {}, remove() {}, contains() { return false; } },
    setAttribute() {}, addEventListener() {}
  };
}
// style.cssText concatenation (the real code does `el.style.cssText += …`)
function styleWithCssText() {
  let txt = '';
  return {
    get cssText() { return txt; },
    set cssText(v) { txt = String(v); }
  };
}

function boot() {
  const byId = {};
  const store = {};
  const main = fakeNode('div');
  main.getBoundingClientRect = () => ({ left: 225, top: 96, width: 1200, height: 800 });
  const sidebar = fakeNode('div');
  const header = fakeNode('div');
  const doc = {
    body: fakeNode('body'),
    createElement(tag) {
      const n = fakeNode(tag);
      n.style = styleWithCssText();
      return n;
    },
    getElementById(id) { return byId[id] || null; },
    querySelector(sel) {
      if (sel === '.main') return main;
      if (sel === '.sidebar') return sidebar;
      if (sel === '.header') return header;
      return null;
    },
    querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {}
  };
  // registration: anything appended anywhere with an id is findable
  const reg = (n) => { if (n.id) byId[n.id] = n; };
  [main, sidebar, header, doc.body].forEach(h => {
    const orig = h.appendChild.bind(h);
    h.appendChild = (c) => { reg(c); return orig(c); };
    const origIb = h.insertBefore.bind(h);
    h.insertBefore = (c) => { reg(c); return origIb(c); };
  });
  const win = {
    addEventListener() {}, removeEventListener() {},
    localStorage: {
      getItem(k) { return (k in store) ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; }
    },
    getComputedStyle() { return { getPropertyValue() { return ''; } }; },
    matchMedia() { return { matches: false, addEventListener() {} }; },
    document: doc,
    APPEARANCE_ENABLED: false
  };
  win.window = win;
  const ctx = {
    window: win, document: doc, localStorage: win.localStorage,
    getComputedStyle: win.getComputedStyle, navigator: { userAgent: 'test' },
    console, URL: { createObjectURL() { return 'blob:x'; }, revokeObjectURL() {} },
    Image: function () { return {}; }, setTimeout: () => 0, clearTimeout() {},
    requestAnimationFrame: (f) => 0
  };
  vm.createContext(ctx);
  vm.runInContext(src('appearance.js'), ctx);
  return { win, doc, byId, store, sidebar, header };
}

const PNG = 'data:image/png;base64,x';

// ── 1. the watermark honors its size setting ─────────────────────
{
  const t = boot();
  t.win.applyLogoBackdrop({ data: PNG, size: 'cover' });
  const el = t.byId['rr-logo-bg'];
  ok('watermark exists in the harness at all', !!el);
  ok('BRAD\'S ASK: size "cover" paints wallpaper — background-size cover',
     !!el && (el.style.backgroundSize === 'cover'
              || String(el.style.cssText).indexOf('background-size:cover') >= 0
              || String(el.style.cssText).indexOf('background-size: cover') >= 0),
     el && (el.style.backgroundSize || '(cssText) ' + String(el.style.cssText).slice(-60)));
}
{
  const t = boot();
  t.win.applyLogoBackdrop({ data: PNG, size: 'fill' });
  const el = t.byId['rr-logo-bg'];
  ok('…size "fill" shows the whole picture as big as it fits — contain',
     !!el && (el.style.backgroundSize === 'contain'
              || String(el.style.cssText).indexOf('contain') >= 0));
}
{
  const t = boot();
  t.win.applyLogoBackdrop({ data: PNG });
  const el = t.byId['rr-logo-bg'];
  const sized = (el && (String(el.style.backgroundSize || '') + ' ' + String(el.style.cssText || '')));
  ok('…no size chosen = TODAY\'S size exactly (nothing changes for anyone)',
     !!el && /min\(110vmin,\s*840px\)/.test(sized), sized && sized.trim().slice(-50));
}
{
  // switching size on an EXISTING mark must restyle, not just at creation
  const t = boot();
  t.win.applyLogoBackdrop({ data: PNG });
  t.win.applyLogoBackdrop({ data: PNG, size: 'cover' });
  const el = t.byId['rr-logo-bg'];
  ok('…changing size on a mark already on screen actually resizes it',
     !!el && (el.style.backgroundSize === 'cover'
              || String(el.style.cssText).indexOf('cover') >= 0));
}

// ── 2. the sidebar mark honors size + round ──────────────────────
{
  const t = boot();
  t.store['rr_skin_brand'] = JSON.stringify({ sidebar: { data: PNG, kind: 'png', size: 'xl', round: true } });
  t.win.applyBranding();
  const el = t.byId['rr-brand-sidebar'];
  ok('sidebar mark renders from the saved record', !!el && el.innerHTML.indexOf('<img') >= 0);
  ok('BRAD\'S ASK: sidebar "Extra large" beats the 110px CSS cap (inline max-height)',
     !!el && /max-height:\s*220px/.test(el.innerHTML), el && el.innerHTML.slice(0, 160));
  ok('BRAD\'S ASK: Round badge clips the square corners (border-radius:50%)',
     !!el && /border-radius:\s*50%/.test(el.innerHTML));
}
{
  const t = boot();
  t.store['rr_skin_brand'] = JSON.stringify({ sidebar: { data: PNG, kind: 'png' } });
  t.win.applyBranding();
  const el = t.byId['rr-brand-sidebar'];
  ok('…a sidebar mark with no choices looks exactly like today (no clip, no forced size)',
     !!el && !/border-radius:\s*50%/.test(el.innerHTML)
          && !/max-height:\s*(70|160|220)px/.test(el.innerHTML));
}

// ── 3. the header mark honors round ──────────────────────────────
{
  const t = boot();
  t.store['rr_skin_brand'] = JSON.stringify({ header: { data: PNG, kind: 'png', round: true } });
  t.win.applyBranding();
  const el = t.byId['rr-brand-header'];
  ok('header mark renders from the saved record', !!el && el.innerHTML.indexOf('<img') >= 0);
  ok('…and Round badge clips it too', !!el && /border-radius:\s*50%/.test(el.innerHTML));
}

// ── 4. the settings survive the record fill (Cancel/Apply plumbing) ─
{
  // _brandFill/_fillSlot normalize every record read; if they drop `size`
  // and `round`, Apply would silently forget the choice — the exact shape
  // of the v1208 cancel bug. Prove the round-trip keeps them.
  const t = boot();
  t.store['rr_skin_brand'] = JSON.stringify({
    watermark: { data: PNG, kind: 'png', opacity: 0.2, size: 'cover' },
    sidebar: { data: PNG, kind: 'png', size: 'large', round: true }
  });
  t.win.applyBranding();
  const wm = t.byId['rr-logo-bg'];
  const sb = t.byId['rr-brand-sidebar'];
  ok('a saved size choice survives the record normalizer (watermark)',
     !!wm && (wm.style.backgroundSize === 'cover' || String(wm.style.cssText).indexOf('cover') >= 0));
  ok('…and the opacity dial still works beside it (not clobbered)',
     !!wm && String(wm.style.opacity) === '0.2', wm && wm.style.opacity);
  ok('a saved size choice survives the normalizer (sidebar large = 160px)',
     !!sb && /max-height:\s*160px/.test(sb.innerHTML));
  ok('…and round survives with it', !!sb && /border-radius:\s*50%/.test(sb.innerHTML));
}
{
  // junk in a hand-edited record must not paint junk styles
  const t = boot();
  t.store['rr_skin_brand'] = JSON.stringify({ watermark: { data: PNG, size: 'javascript:evil' } });
  t.win.applyBranding();
  const el = t.byId['rr-logo-bg'];
  const sized = el && (String(el.style.backgroundSize || '') + ' ' + String(el.style.cssText || ''));
  ok('an unknown size value falls back to standard, never into the style attribute',
     !!el && /min\(110vmin,\s*840px\)/.test(sized) && sized.indexOf('evil') < 0);
}

// ── 5. the editor offers the dials (source shape) ────────────────
{
  const app = src('appearance.js');
  ok('the editor has a size handler (_rrapSlotSize) on window',
     /window\._rrapSlotSize\s*=/.test(app));
  ok('…and a round-badge handler (_rrapSlotRound) on window',
     /window\._rrapSlotRound\s*=/.test(app));
  ok('the watermark tile offers "How big" beside "How faint"',
     /_rrapSlotSize\(\\?'watermark\\?'/.test(app));
  ok('the sidebar tile offers sizes too',
     /_rrapSlotSize\(\\?'sidebar\\?'/.test(app));
  ok('both handlers repaint the candidate (live preview, same as the faint dial)',
     /_rrapSlotSize[\s\S]{0,220}_paintCandidate/.test(app)
     && /_rrapSlotRound[\s\S]{0,220}_paintCandidate/.test(app));
  ok('no new hex literals rode in with the dials',
     !/_rrapSlotSize[\s\S]{0,400}#[0-9a-fA-F]{3}\b/.test(app));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('APPEARANCE-MARKS TESTS FAILING'); process.exit(1); }
console.log('ALL APPEARANCE-MARKS TESTS GREEN (' + pass + ')');
