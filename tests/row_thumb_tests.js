// ═══════════════════════════════════════════════════════════════
// row_thumb_tests.js — v0.9.1806.
//
// Brad: "increase the picture size and show the complete picture and not cut
// off on the sides". The list thumbnails were 40–44 px SQUARES with
// object-fit:cover, so a long train photo was zoomed and its ends trimmed.
// Now ONE class, .rr-row-thumb (app.css), owns the size and the fit for every
// list thumbnail — desktop table, phone rows, stock photo — and the fit is
// contain (whole picture). A mouse hover shows a large preview.
//
// Source checks on the real files; section E plants each old habit back and
// the matching check must go red.
// Run:  node tests/row_thumb_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const CSS = APP('app.css'), BROWSE = APP('browse.js'), STOCK = APP('stock-photos.js');
const DASH = APP('dashboard.js'), INBOX = APP('photo-inbox.js');
// code only — a comment that SAYS "object-fit:cover" is history, not behaviour
const code = src => src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function between(src, a, b) { const i = src.indexOf(a); if (i < 0) return ''; const j = src.indexOf(b, i + a.length); return j < 0 ? '' : src.slice(i, j); }

// the pieces each check reads
const cssRule   = css => (css.match(/\.rr-row-thumb\s*\{[^}]*\}/) || [''])[0];
const cssImg    = css => (css.match(/\.rr-row-thumb img\s*\{[^}]*\}/) || [''])[0];
const deskLoad  = src => between(src, '// Async: load thumbnails for My Collection view', '// v0.9.985 (Brad): the bar is now');
const phoneLoad = src => between(src, 'v0.9.1025: fill the row thumbnails', 'if (cardsEl)') || between(src, "_collThumbJobs.slice(0, 60)", '});\n    }');
const stockFn   = src => between(src, 'window._stockThumb = function', 'return true;');

function checks(css, browse, stock, tag) {
  const t = s => (tag ? tag + ': ' : '') + s;
  const r = cssRule(css), im = cssImg(css);
  const A1 = /width:\s*var\(--rr-thumb-w\)/.test(r) && /height:\s*var\(--rr-thumb-h\)/.test(r);
  const A2 = /object-fit:\s*var\(--rr-photo-fit\)/.test(im) && /--rr-photo-fit:\s*contain/.test(css) && !/cover/.test(im)
          && /\.rr-fit\s*\{\s*object-fit:\s*var\(--rr-photo-fit\)/.test(css);
  const m = css.match(/--rr-thumb-w:\s*(\d+)px;\s*--rr-thumb-h:\s*(\d+)px/);
  const A3 = !!m && +m[1] > +m[2] && +m[1] >= 90;           // wide rectangle, bigger than the old 44
  const B1 = /<div id="thumb-\$\{_rrRowDomKey\(item\)\}" class="rr-row-thumb">/.test(browse);
  const B2 = /'<div id="' \+ _tid \+ '" class="rr-row-thumb"><\/div>'/.test(browse);
  const dl = deskLoad(browse);
  const B3 = dl.length > 0 && !/object-fit:\s*cover/.test(dl) && !/width:\s*40px/.test(dl);
  const B4 = !/object-fit:cover;opacity:0;transition:opacity 0\.3s'/.test(browse.slice(browse.indexOf('_collThumbJobs.slice(0, 60)'), browse.indexOf('_collThumbJobs.slice(0, 60)') + 900));
  const sf = stockFn(stock);
  const C1 = sf.length > 0 && !/object-fit:\s*cover/.test(sf) && !/min-width:40px/.test(sf);
  return { A1, A2, A3, B1, B2, B3, B4, C1, t };
}

section('A · app.css — the ONE place');
let R = checks(CSS, BROWSE, STOCK, '');
ok('.rr-row-thumb takes its size from --rr-thumb-w / --rr-thumb-h', R.A1, cssRule(CSS));
ok('the picture inside is FITTED (contain), never trimmed (cover)', R.A2, cssImg(CSS));
ok('the box is a wide rectangle, wider than the old 44 px square', R.A3);
ok('the Photo column is sized from the same variable (no 52 px left)',
  /td\[data-col="photo"\]\s*\{\s*width:\s*calc\(var\(--rr-thumb-w\)/.test(CSS) && !/data-col="photo"\]\s*\{\s*width:\s*52px/.test(CSS)
  && BROWSE.indexOf("'width:52px\">'") < 0);

section('B · browse.js — both list layouts use the class');
ok('desktop Photo cell is a .rr-row-thumb with no size of its own', R.B1);
ok('phone row thumbnail is a .rr-row-thumb with no size of its own', R.B2);
ok('desktop thumbnail loader sets no size and no cover', R.B3);
ok('phone thumbnail loader sets no cover', R.B4);

section('C · stock-photos.js');
ok('the stock thumbnail sets no cover and no 40 px minimum', R.C1);

section('D · hover preview');
ok('only on a real mouse (hover + fine pointer)', /matchMedia\('\(hover: hover\) and \(pointer: fine\)'\)/.test(BROWSE));
ok('the preview never takes a click', /#rr-thumb-preview\s*\{[^}]*pointer-events:\s*none/.test(CSS));
ok('a click / scroll takes it down', /addEventListener\('click', _hide, true\)/.test(BROWSE) && /addEventListener\('scroll', _hide, true\)/.test(BROWSE));
ok('it only shows a picture that actually loaded', /img\.naturalWidth === 0/.test(BROWSE));

section('D2 · v0.9.1807 — dashboard cards, scrolling strip, photo inbox');
const dashCover = d => (code(d).match(/object-fit:\s*cover/g) || []).length;
ok('dashboard.js sets object-fit:cover nowhere', dashCover(DASH) === 0, dashCover(DASH) + ' left');
ok('photo-inbox.js sets object-fit:cover nowhere', dashCover(INBOX) === 0, dashCover(INBOX) + ' left');
ok('dashboard photos wear .rr-fit (strip, showcase, recent additions, From my collection)',
  (DASH.match(/class="rr-fit"/g) || []).length >= 3 && /img\.className = 'rr-fit'/.test(DASH));
ok('photo-inbox photos wear .rr-fit (tiles, dashboard card, review rails)', (INBOX.match(/rr-fit/g) || []).length >= 9);
ok('photo tiles are 4:3 from ONE variable (inbox page, dashboard inbox card, showcase)',
  /--rr-photo-tile-ratio:\s*4 \/ 3/.test(CSS) && (INBOX.match(/aspect-ratio:var\(--rr-photo-tile-ratio\)/g) || []).length === 2
  && /aspect-ratio:var\(--rr-photo-tile-ratio\)/.test(DASH));
ok('the hover preview re-places itself once its picture has loaded', /box\.firstChild\.onload = function \(\) \{ _place\(null\); \}/.test(BROWSE));

section('E · planted offenders — each must turn a check red');
const o1 = CSS.replace('--rr-photo-fit: contain;', '--rr-photo-fit: cover;');
ok('offender 1 changed the source', o1 !== CSS);
ok('OFFENDER 1: the one switch back to cover -> A2 red', !checks(o1, BROWSE, STOCK).A2);
const o5 = DASH.replace(`'<img class="rr-fit" style="width:100%;height:100%;opacity:0;`, `'<img style="width:100%;height:100%;object-fit:cover;opacity:0;`);
ok('offender 5 changed the source', o5 !== DASH);
ok('OFFENDER 5: cover back on the scrolling strip -> dashboard check red', dashCover(o5) > 0);
const o2 = BROWSE.replace('// v0.9.1806: size + fit come from .rr-row-thumb (app.css) — the ONE place.',
  "img.style.cssText = 'width:40px;height:40px;object-fit:cover;border-radius:4px';");
ok('offender 2 changed the source', o2 !== BROWSE);
ok('OFFENDER 2: the old 40 px cover line back in the desktop loader -> B3 red', !checks(CSS, o2, STOCK).B3);
const o3 = CSS.replace('--rr-thumb-w: 96px; --rr-thumb-h: 56px;', '--rr-thumb-w: 44px; --rr-thumb-h: 44px;');
ok('offender 3 changed the source', o3 !== CSS);
ok('OFFENDER 3: back to a 44 px square -> A3 red', !checks(o3, BROWSE, STOCK).A3);
const o4 = STOCK.replace('alt="" onerror', 'alt="" style="object-fit:cover" onerror');
ok('offender 4 changed the source', o4 !== STOCK);
ok('OFFENDER 4: cover back on the stock thumbnail -> C1 red', !checks(CSS, BROWSE, o4).C1);

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
