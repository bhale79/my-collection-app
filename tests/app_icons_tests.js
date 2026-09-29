// ═══════════════════════════════════════════════════════════════════════════
// app_icons_tests.js — v0.9.1837
//
// THE BADGE IS THE ICON — AND IT SURVIVES WHAT PHONES DO TO ICONS.
//
// [stated] Brad: "make this the new phone icon that goes on the home screen."
//
// Six files, all cut from tools/icons/badge-master.png by
// tools/icons/make_icons.py. Each exists for something a phone does:
//   icon-192 / icon-512            purpose "any" — shown whole (Android splash,
//                                  app info, the landing page's tab)
//   icon-192-maskable / -512-      purpose "maskable" — Android cuts the home
//                                  icon into its own shape and keeps only the
//                                  inner 80%, so the badge sits at 80%
//   apple-touch-icon (180)         iPhone: no transparency, iOS rounds it
//   favicon-32                     the tab: transparent corners
//
// These tests read the PIXELS (tests/lib/png.js, no dependency) and the wiring
// (manifest, index.html, sw.js, the landing page, the generator), through ONE
// judge that takes its sources as input — so section G can hand it planted
// offenders and require red: a merged "any maskable" entry (how the ring got
// cut before), a masked icon drawn past the safe zone, a see-through iPhone
// icon, a blank square, a stamped icon href, an icon missing from the
// precache, a generator with its own colour.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const png = require('./lib/png.js');

const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const rb = f => { try { return fs.readFileSync(path.join(ROOT, f)); } catch (e) { return null; } };

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ── the sources, as the app ships them ──────────────────────────────────────
function realSources() {
  const manifest = rd('app/manifest.json');
  const names = iconNames(manifest, rd('app/index.html'));
  const files = {};
  names.forEach(n => { files[n] = rb('app/' + n); });
  return {
    manifest,
    index: rd('app/index.html'),
    sw: rd('app/sw.js'),
    root: rd('index.html'),
    tool: rd('tools/icons/make_icons.py'),
    master: rb('tools/icons/badge-master.png'),
    files,
  };
}

// every icon file the manifest and the page name (bare file names)
function iconNames(manifest, index) {
  const out = [];
  try { JSON.parse(manifest).icons.forEach(i => out.push(String(i.src).replace(/^\.\//, ''))); } catch (e) {}
  const rx = /<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g;
  let m;
  while ((m = rx.exec(index))) out.push(m[1].split('?')[0]);
  return Array.from(new Set(out));
}

function hexRgb(h) { h = String(h).replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
function near(p, rgb, tol) { return Math.abs(p[0] - rgb[0]) <= tol && Math.abs(p[1] - rgb[1]) <= tol && Math.abs(p[2] - rgb[2]) <= tol; }
function tryDecode(buf) { try { return buf ? png.decode(buf) : null; } catch (e) { return { error: e.message }; } }

// ── THE judge: one list of named checks over a set of sources ───────────────
function judge(S) {
  const C = [];
  const add = (id, name, cond, detail) => C.push({ id, name, pass: !!cond, detail: detail || '' });

  let man = null;
  try { man = JSON.parse(S.manifest); } catch (e) {}
  const icons = (man && Array.isArray(man.icons)) ? man.icons : [];
  const bg = man && man.background_color ? hexRgb(man.background_color) : null;

  // A. the manifest
  const purposes = icons.map(i => String(i.purpose || 'any').trim());
  const anyS = icons.filter((i, k) => purposes[k] === 'any').map(i => i.sizes).sort();
  const maskS = icons.filter((i, k) => purposes[k] === 'maskable').map(i => i.sizes).sort();
  add('M1', 'manifest lists four icons — 192 and 512 plain, 192 and 512 maskable',
      icons.length === 4 && anyS.join() === '192x192,512x512' && maskS.join() === '192x192,512x512',
      'plain ' + anyS.join('/') + ' maskable ' + maskS.join('/'));
  add('M2', 'no icon entry serves BOTH purposes — "any maskable" is how Android shaved the ring',
      icons.length > 0 && purposes.every(p => !/\s/.test(p)), purposes.join(' | '));
  add('M3', 'the manifest keeps its background_color, the one colour the squares are cut from',
      !!bg, String(man && man.background_color));

  // B. the files themselves
  const decoded = {};
  Object.keys(S.files).forEach(n => { decoded[n] = tryDecode(S.files[n]); });
  const sizeOf = n => decoded[n] && !decoded[n].error ? decoded[n].width + 'x' + decoded[n].height : (decoded[n] ? 'bad: ' + decoded[n].error : 'missing');
  add('M4', 'every manifest icon file exists, is a plain 8-bit PNG and is the size it declares',
      icons.length > 0 && icons.every(i => sizeOf(String(i.src).replace(/^\.\//, '')) === i.sizes && decoded[String(i.src).replace(/^\.\//, '')].width === decoded[String(i.src).replace(/^\.\//, '')].height),
      icons.map(i => i.src + ' ' + sizeOf(String(i.src).replace(/^\.\//, ''))).join(', '));

  const opaqueNames = Object.keys(S.files).filter(n => n !== 'favicon-32.png');
  const solid = img => img && !img.error && (img.channels === 3 || (function () { for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 255) return false; return true; })());
  add('F1', 'the Android and iPhone icons are SOLID — no transparent corner for iOS to paint black',
      opaqueNames.length >= 5 && opaqueNames.every(n => solid(decoded[n])),
      opaqueNames.filter(n => !solid(decoded[n])).join(', '));

  const corners = img => [[0, 0], [img.width - 1, 0], [0, img.height - 1], [img.width - 1, img.height - 1]].map(c => png.pixel(img, c[0], c[1]));
  const cornersBg = n => decoded[n] && !decoded[n].error && bg && corners(decoded[n]).every(p => near(p, bg, 2));
  add('F2', 'every square is the manifest background_color at all four corners (the splash paints that colour, so only the badge shows)',
      !!bg && opaqueNames.length >= 5 && opaqueNames.every(cornersBg),
      opaqueNames.filter(n => !cornersBg(n)).map(n => n + ' ' + (decoded[n] && !decoded[n].error ? JSON.stringify(corners(decoded[n])[0]) : sizeOf(n))).join(', '));

  // maskable: nothing but the fill outside the inner-80% circle (+2 px for the anti-aliased edge) …
  const maskNames = Object.keys(S.files).filter(n => /-maskable\.png$/.test(n));
  function outsideSafe(img) {
    const s = img.width, c = (s - 1) / 2, lim = 0.4 * s + 2;
    let bad = 0;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      if (Math.hypot(x - c, y - c) > lim && !near(png.pixel(img, x, y), bg, 6)) bad++;
    }
    return bad;
  }
  const safe = n => decoded[n] && !decoded[n].error && bg && outsideSafe(decoded[n]) === 0;
  add('F3', 'the maskable icons keep the WHOLE badge inside the inner 80% — Android\'s safe zone — so no mask ever cuts the ring',
      maskNames.length === 2 && maskNames.every(safe),
      maskNames.map(n => n + ': ' + (decoded[n] && !decoded[n].error ? outsideSafe(decoded[n]) + ' px outside' : sizeOf(n))).join(', '));
  // … and the badge reaches that circle (not shrunk to a dot in the middle)
  function reaches(img) {
    const s = img.width, c = (s - 1) / 2, lo = 0.4 * s - 4, hi = 0.4 * s - 1.5;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const r = Math.hypot(x - c, y - c);
      if (r >= lo && r <= hi && !near(png.pixel(img, x, y), bg, 40)) return true;
    }
    return false;
  }
  add('F4', '…and the badge REACHES the safe zone (80% of the square), not shrunk to a coin in the middle',
      maskNames.length === 2 && maskNames.every(n => decoded[n] && !decoded[n].error && bg && reaches(decoded[n])));

  // plain + iPhone: the badge nearly fills the square
  function margin(img) {   // first non-fill pixel down the centre column, as a fraction of the size
    const s = img.width, x = s >> 1;
    for (let y = 0; y < s; y++) if (!near(png.pixel(img, x, y), bg, 12)) return y / s;
    return 1;
  }
  const fullNames = opaqueNames.filter(n => !/-maskable\.png$/.test(n));
  add('F5', 'the plain and iPhone icons nearly fill their square (top margin under 5%)',
      fullNames.length === 3 && fullNames.every(n => decoded[n] && !decoded[n].error && bg && margin(decoded[n]) < 0.05),
      fullNames.map(n => n + ' ' + (decoded[n] && !decoded[n].error && bg ? (margin(decoded[n]) * 100).toFixed(1) + '%' : sizeOf(n))).join(', '));

  // the badge is actually there
  function differs(img) {
    let d = 0, n = img.width * img.height;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (!near(png.pixel(img, x, y), bg, 12)) d++;
    return d / n;
  }
  add('F6', 'each square carries a picture — at least 30% of its pixels are not the fill',
      opaqueNames.length >= 5 && opaqueNames.every(n => decoded[n] && !decoded[n].error && bg && differs(decoded[n]) >= 0.3),
      opaqueNames.map(n => n + ' ' + (decoded[n] && !decoded[n].error && bg ? (differs(decoded[n]) * 100).toFixed(0) + '%' : sizeOf(n))).join(', '));

  const fav = decoded['favicon-32.png'];
  add('F7', 'the tab icon is 32x32 with transparent corners and a solid centre (the coin on any tab colour)',
      fav && !fav.error && fav.width === 32 && fav.height === 32 && fav.channels === 4 &&
      png.pixel(fav, 0, 0)[3] === 0 && png.pixel(fav, 31, 31)[3] === 0 && png.pixel(fav, 16, 16)[3] === 255,
      fav ? (fav.error || (fav.width + 'x' + fav.height + ' ch' + fav.channels)) : 'missing');

  // C. the page
  add('P1', 'index.html points the tab at favicon-32.png and the iPhone at apple-touch-icon.png (180)',
      /<link rel="icon" type="image\/png" sizes="32x32" href="favicon-32.png">/.test(S.index) &&
      /<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">/.test(S.index));
  add('P2', 'no icon is base64 pasted into index.html any more',
      !/rel="(?:icon|apple-touch-icon)"[^>]*href="data:/.test(S.index));
  add('P3', 'the icon hrefs are BARE — sw.js caches icons bare, so a ?v= would miss the precache',
      !/href="(?:favicon-32\.png|apple-touch-icon\.png)\?/.test(S.index) && !/"\.\/(?:icon-[^"]*|apple-touch-icon|favicon-32)\.png\?/.test(S.manifest));

  // D. the worker
  const shellA = S.sw.indexOf('const SHELL_FILES = ['), shellB = S.sw.indexOf('];', shellA);
  const shell = shellA >= 0 && shellB > shellA ? S.sw.slice(shellA, shellB) : '';
  const wanted = iconNames(S.manifest, S.index);
  const missing = wanted.filter(n => shell.indexOf("'./" + n + "'") < 0);
  add('S1', 'sw.js precaches every icon the manifest and the page name (' + wanted.length + ')',
      wanted.length >= 6 && missing.length === 0, 'missing: ' + missing.join(', '));
  let stampedFn = null;
  try {
    stampedFn = new Function('var _vq = "?v=9";' + S.sw.slice(S.sw.indexOf('function _stamped(url)'), S.sw.indexOf('// Install: pre-cache')) + '; return _stamped;')();
  } catch (e) {}
  add('S2', '…and still caches them bare (_stamped leaves every .png alone)',
      !!stampedFn && wanted.every(n => stampedFn('./' + n) === './' + n));

  // E. the landing page
  add('R1', 'the landing page\'s tab icon is the same coin (app/favicon-32.png), and the file exists',
      /<link rel="icon" type="image\/png" sizes="32x32" href="app\/favicon-32\.png">/.test(S.root) && !!S.files['favicon-32.png']);

  // F. the generator — the icons can be made again, from one master, with the manifest's colour
  const masterHdr = tryDecode(S.master);
  add('T1', 'tools/icons holds the master badge (a square RGBA PNG) and the generator that cuts the six files from it',
      masterHdr && !masterHdr.error && masterHdr.channels === 4 && masterHdr.width === masterHdr.height && masterHdr.width >= 1024 &&
      /def render\(/.test(S.tool) && /ICONS = \[/.test(S.tool),
      masterHdr ? (masterHdr.error || masterHdr.width + 'x' + masterHdr.height) : 'no master');
  add('T2', 'the generator READS the fill from manifest.json and types no colour of its own (single source of truth)',
      /background_color/.test(S.tool) && !/#[0-9a-fA-F]{6}\b/.test(S.tool) && !/\(\s*15\s*,\s*18\s*,\s*32\s*\)/.test(S.tool));
  const genNames = [];
  const grx = /\(\s*'([\w.-]+\.png)'\s*,\s*(\d+)\s*,\s*([\d.]+)\s*,\s*(True|False)\s*\)/g;
  let gm;
  while ((gm = grx.exec(S.tool))) genNames.push({ name: gm[1], size: +gm[2], frac: +gm[3], opaque: gm[4] === 'True' });
  const gset = genNames.map(g => g.name).sort().join(), wset = wanted.slice().sort().join();
  add('T3', 'the generator writes exactly the files that are wired in — no orphan, no hand-made icon',
      genNames.length === 6 && gset === wset, 'generator: ' + gset + ' | wired: ' + wset);
  const maskGen = genNames.filter(g => /-maskable/.test(g.name));
  add('T4', 'the generator draws the maskable pair at 80% and the rest at 96%+ (or 100% for the tab)',
      maskGen.length === 2 && maskGen.every(g => g.frac === 0.8) &&
      genNames.filter(g => !/-maskable/.test(g.name)).every(g => g.frac >= 0.96) &&
      genNames.every(g => g.opaque === (g.name !== 'favicon-32.png')));

  return C;
}

function red(C, id) { const c = C.find(x => x.id === id); return c && !c.pass; }
function green(C, id) { const c = C.find(x => x.id === id); return c && c.pass; }

// ── planted pictures ────────────────────────────────────────────────────────
const CREAM = [251, 213, 154];
function disc(size, frac, bg, alpha) {   // a cream disc of diameter frac*size on the fill (or on nothing)
  const c = (size - 1) / 2, r = frac * size / 2;
  return png.encode({ width: size, height: size, alpha: !!alpha, px: (x, y) => {
    const inside = Math.hypot(x - c, y - c) <= r;
    return inside ? CREAM.concat([255]) : (alpha ? [0, 0, 0, 0] : bg.concat([255]));
  } });
}

(function () {
  const S = realSources();
  const C = judge(S);

  section('A–F. The shipped icons and their wiring');
  C.forEach(c => ok(c.name, c.pass, c.detail));

  section('G. Planted offenders — each check proves it can go red');
  const bg = hexRgb(JSON.parse(S.manifest).background_color);

  // 1. the pre-v1837 manifest: one entry serving both purposes
  const o1 = Object.assign({}, S, { manifest: S.manifest.replace(/"purpose": "maskable"/g, '"purpose": "any maskable"') });
  ok('offender 1 changed the manifest', o1.manifest !== S.manifest);
  ok('OFFENDER 1: an "any maskable" entry → M2 red', red(judge(o1), 'M2'));

  // 2. a maskable icon drawn at 96% — the ring would be shaved
  const o2 = Object.assign({}, S, { files: Object.assign({}, S.files, { 'icon-192-maskable.png': disc(192, 0.96, bg, false) }) });
  ok('OFFENDER 2: a masked icon past the safe zone → F3 red', red(judge(o2), 'F3'));
  ok('…while the same picture is fine as a PLAIN icon (F5 judges fill, not safe zone)',
     green(judge(Object.assign({}, S, { files: Object.assign({}, S.files, { 'icon-192.png': disc(192, 0.96, bg, false) }) })), 'F5'));

  // 3. a maskable icon shrunk to 60% — safe, but wasting the icon
  const o3 = Object.assign({}, S, { files: Object.assign({}, S.files, { 'icon-512-maskable.png': disc(512, 0.6, bg, false) }) });
  const j3 = judge(o3);
  ok('OFFENDER 3: a masked icon shrunk to 60% → F4 red (and F3 still green: it IS inside the zone)', red(j3, 'F4') && green(j3, 'F3'));

  // 4. an iPhone icon with see-through corners
  const o4 = Object.assign({}, S, { files: Object.assign({}, S.files, { 'apple-touch-icon.png': disc(180, 0.96, bg, true) }) });
  ok('OFFENDER 4: a transparent-cornered iPhone icon → F1 red', red(judge(o4), 'F1'));

  // 5. a blank square
  const o5 = Object.assign({}, S, { files: Object.assign({}, S.files, { 'icon-512.png': disc(512, 0, bg, false) }) });
  const j5 = judge(o5);
  ok('OFFENDER 5: a blank fill-coloured square → F6 red and F5 red (corners F2 still green)', red(j5, 'F6') && red(j5, 'F5') && green(j5, 'F2'));

  // 6. a stamped icon href
  const o6 = Object.assign({}, S, { index: S.index.replace('href="favicon-32.png"', 'href="favicon-32.png?v=1837"') });
  ok('offender 6 changed the page', o6.index !== S.index);
  ok('OFFENDER 6: favicon-32.png?v=… → P3 red (the worker caches icons bare)', red(judge(o6), 'P3'));

  // 7. an icon dropped from the precache
  const o7 = Object.assign({}, S, { sw: S.sw.replace("  './apple-touch-icon.png',", '') });
  ok('offender 7 changed the worker', o7.sw !== S.sw);
  ok('OFFENDER 7: apple-touch-icon.png missing from SHELL_FILES → S1 red', red(judge(o7), 'S1'));

  // 8. a generator with its own colour
  const o8 = Object.assign({}, S, { tool: S.tool.replace('return tuple(int(hexv[i:i + 2], 16) for i in (0, 2, 4))', 'return (15, 18, 32)  # "#0f1220"') });
  ok('offender 8 changed the generator', o8.tool !== S.tool);
  ok('OFFENDER 8: a colour typed into the generator → T2 red', red(judge(o8), 'T2'));

  // 9. a seventh icon file the generator never heard of
  const o9 = Object.assign({}, S, { manifest: S.manifest.replace('"src": "./icon-512-maskable.png"', '"src": "./icon-512-hand-made.png"') });
  ok('OFFENDER 9: a hand-made icon in the manifest → T3 red (and M4: no such file)', red(judge(o9), 'T3') && red(judge(o9), 'M4'));

  // 10. the wrong size on disk
  const o10 = Object.assign({}, S, { files: Object.assign({}, S.files, { 'icon-192.png': S.files['icon-512.png'] }) });
  ok('OFFENDER 10: a 512 file where the manifest says 192 → M4 red', red(judge(o10), 'M4'));

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
