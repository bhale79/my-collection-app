// ════════════════════════════════════════════════════════════════════════
// photo_crop_tap_targets_tests.js — v0.9.1777
//
// Brad, 2026-09-19: "the +- .5 buttons text is larger than the buttons"
//
// .rr-tap (app.css, v0.9.1021) exists for buttons whose ENTIRE label is one
// glyph — the ✂ crop icon, the showcase ‹ ⏸ ›, the zoom − and +. On a phone it
// pins a 44x44 SQUARE and forces the glyph to 1.05rem, both !important, so
// nothing inline can override either.
//
// The crop screen's Level controls borrowed that class but carry WORDS.
// "− 0.5°" at 1.05rem needs roughly 50px of text inside a 44px box, so the
// label spilled out of its own button. That is the whole bug.
//
// THE RULE THIS FILE ENFORCES: a button whose label is more than one glyph
// must not wear .rr-tap. It is a class-wide rule, not a crop-screen rule,
// because the next person to add a labelled button will reach for .rr-tap for
// exactly the reason this one did — it is the class that says "tap target".
//
// Section D plants offenders and requires each to be caught.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const APPDIR = path.join(__dirname, '..', 'app');
const CSS = fs.readFileSync(path.join(APPDIR, 'app.css'), 'utf8');
const CROP = fs.readFileSync(path.join(APPDIR, 'photo-crop.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

// The source writes labels as \uXXXX escapes inside JS string literals, so the
// scan has to read them the way a browser eventually will.
function decode(s) {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, function (_, h) {
    return String.fromCharCode(parseInt(h, 16));
  });
}
// Count GLYPHS, not UTF-16 code units — an emoji or a surrogate pair is still
// one thing on screen.
function glyphs(s) { return Array.from(s.trim()).length; }

// Every <button ... class="rr-tap" ...>LABEL</button> in app/*.js, whichever
// order the attributes happen to be written in.
function scan(src, cls) {
  const out = [];
  const re = new RegExp('<button([^>]*class="' + cls + '"[^>]*)>([\\s\\S]*?)<\\/button>', 'g');
  let m;
  while ((m = re.exec(src)) !== null) {
    const id = (m[1].match(/id="([^"]+)"/) || [, '(no id)'])[1];
    const label = decode(m[2]).replace(/<[^>]*>/g, '');   // strip any nested markup
    out.push({ id: id, label: label, glyphs: glyphs(label) });
  }
  return out;
}

function everySquareButton(readCss) {
  const found = [];
  fs.readdirSync(APPDIR).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
    const src = (readCss && readCss[f]) || fs.readFileSync(path.join(APPDIR, f), 'utf8');
    scan(src, 'rr-tap').forEach(function (b) { b.file = f; found.push(b); });
  });
  return found;
}

console.log('\n== A. THE RULE: .rr-tap is for one-glyph labels only ==');
{
  const sq = everySquareButton();
  ok('the square-button class is actually in use', sq.length >= 6, 'found ' + sq.length);

  const worded = sq.filter(function (b) { return b.glyphs > 1; });
  ok('NO button with a worded label wears .rr-tap',
     worded.length === 0,
     worded.map(function (b) { return b.file + ':' + b.id + ' = "' + b.label.trim() + '" (' + b.glyphs + ' glyphs)'; }).join(' | '));

  // Name them, so a future reader sees what the class is FOR rather than
  // having to infer it from a passing assertion.
  sq.forEach(function (b) {
    ok('  ' + b.file + ' ' + b.id + ' is a single glyph ("' + b.label.trim() + '")', b.glyphs === 1, b.glyphs + ' glyphs');
  });
}

console.log('\n== B. The four Level buttons moved, the two Zoom buttons did not ==');
{
  const wide = scan(CROP, 'rr-tap-wide').map(function (b) { return b.id; });
  ['_rrCropRotQtrL', '_rrCropRotMinus', '_rrCropRotPlus', '_rrCropRotQtrR'].forEach(function (id) {
    ok(id + ' carries a label, so it is .rr-tap-wide', wide.indexOf(id) >= 0, wide.join(','));
  });
  const sq = scan(CROP, 'rr-tap').map(function (b) { return b.id; });
  ['_rrCropZoomOut', '_rrCropZoomIn'].forEach(function (id) {
    ok(id + ' is a single glyph, so it KEEPS the 44px square', sq.indexOf(id) >= 0, sq.join(','));
  });
  ok('…and nothing else on the crop screen changed class', sq.length === 2 && wide.length === 4,
     'square=' + sq.length + ' wide=' + wide.length);
}

console.log('\n== C. The stylesheet keeps the tap-target promise ==');
{
  const gate = CSS.slice(CSS.indexOf('/* ── Phone tap-target floor'));
  const sqRule = gate.slice(gate.indexOf('.rr-tap {'), gate.indexOf('.rr-tap-box'));
  const wideAt = gate.indexOf('.rr-tap-wide {');
  const wideRule = wideAt >= 0 ? gate.slice(wideAt, gate.indexOf('}', wideAt) + 1) : '';

  ok('the new class sits inside the SAME phone-only media gate',
     /@media \(max-width: 640px\)[\s\S]*\.rr-tap-wide \{/.test(CSS));
  ok('.rr-tap-wide still guarantees a 44px tap target',
     /min-width: 44px !important/.test(wideRule) && /min-height: 44px !important/.test(wideRule), wideRule);
  ok('…but does NOT pin a fixed size, so the label fits',
     /width: auto !important/.test(wideRule) && /height: auto !important/.test(wideRule), wideRule);
  ok('…and does NOT force the label bigger — that was half the bug',
     !/font-size/.test(wideRule), wideRule);

  // The square rule is deliberately untouched: six buttons still rely on it.
  ok('.rr-tap still pins the 44px square for single glyphs',
     /width: 44px !important/.test(sqRule) && /height: 44px !important/.test(sqRule), sqRule);
  ok('…and still forces the glyph up, which is right for one character',
     /font-size: 1\.05rem !important/.test(sqRule), sqRule);
}

console.log('\n== D. THE OFFENDERS: break each one, require red ==');
{
  // 1 — a worded label put back on the square class. This is the exact
  //     regression; it must be caught in ANY app file, not just this one.
  const badCrop = CROP.replace('id="_rrCropRotMinus" class="rr-tap-wide"',
                               'id="_rrCropRotMinus" class="rr-tap"');
  const badList = everySquareButton({ 'photo-crop.js': badCrop })
                    .filter(function (b) { return b.glyphs > 1; });
  ok('a worded label back on .rr-tap is caught', badList.length === 1,
     'found ' + badList.length + ' — the section A check would have passed on broken source');

  // 2 — the new class quietly gains a fixed width again.
  const badCss = CSS.replace('width: auto !important; height: auto !important;',
                             'width: 44px !important; height: 44px !important;');
  const at2 = badCss.indexOf('.rr-tap-wide {');
  const rule2 = badCss.slice(at2, badCss.indexOf('}', at2) + 1);
  ok('re-pinning a fixed width on .rr-tap-wide is caught',
     !/width: auto !important/.test(rule2), 'the width check would have passed on broken source');

  // 3 — the font bump creeps onto the wide class.
  const badCss3 = CSS.replace('.rr-tap-wide { min-width: 44px !important;',
                              '.rr-tap-wide { font-size: 1.05rem !important; min-width: 44px !important;');
  const at3 = badCss3.indexOf('.rr-tap-wide {');
  const rule3 = badCss3.slice(at3, badCss3.indexOf('}', at3) + 1);
  ok('a font-size bump creeping onto .rr-tap-wide is caught',
     /font-size/.test(rule3), 'the font check would have passed on broken source');

  // 4 — the tap-target minimum is dropped in the name of tidiness.
  const badCss4 = CSS.replace('.rr-tap-wide { min-width: 44px !important; min-height: 44px !important;',
                              '.rr-tap-wide { ');
  const at4 = badCss4.indexOf('.rr-tap-wide {');
  const rule4 = badCss4.slice(at4, badCss4.indexOf('}', at4) + 1);
  ok('losing the 44px minimum is caught',
     !/min-width: 44px !important/.test(rule4), 'the minimum check would have passed on broken source');

  // 5 — the scan itself must not be fooled by a \uXXXX escape, which is how
  //     every one of these labels is actually written in the source.
  ok('the scan decodes \\uXXXX escapes (or it would call "- 0.5" one glyph)',
     glyphs(decode('\\u2212 0.5\\u00b0')) === 6, String(glyphs(decode('\\u2212 0.5\\u00b0'))));
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
