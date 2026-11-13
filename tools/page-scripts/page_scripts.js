#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════
// PAGE SCRIPTS — the ONE way a new script file gets onto app/index.html
// (2026-11-12, [stated] Brad 12:06 CT "how do we fix this" → 12:08 CT "yes")
//
// WHY. app/index.html lists every script with the version as a stamp
// (?v=2144), and every release rewrites every stamp. A hand-over patch that
// ADDS a script line carries its neighbours — with the OLD stamps — as its
// "where do I go" marker, so any release that lands first makes the patch
// stop fitting. staffpins (#28) was pulled from a train for exactly that, and
// broke again on the very next release.
//
// THE RULE. A hand-over patch never touches app/index.html to add a script,
// the same way it never touches the version trio. The builder writes ONE
// plain line in the hand-over folder (ship_<topic>.scripts):
//
//     add staff.js after drive-picker.js | TRR Pro — staff PINs
//
// and the shipping chat runs, on the train's tree, BEFORE the trio bump:
//
//     node tools/page-scripts/page_scripts.js apply <…/ship_<topic>.scripts> …
//
// The tag is placed after its neighbour by NAME, with the stamp the page
// carries at that moment. The trio bump then moves every stamp together.
//
// COMMANDS
//   apply <file.scripts> [more…]   place every line of each file (in order)
//   add <new.js> --after <neighbour.js> [--note "words"]
//   lint-patch <file.patch> [more…]   exit 1 if a patch adds a local script
//                                     tag to app/index.html itself
//   list                           the local scripts the page loads, in order
// Options: --page <path> (default app/index.html, beside this repo's app/)
//          --dry (say what would change, write nothing)
//
// It refuses, and writes nothing, when: the neighbour is not on the page
// exactly once; the new file is not in app/; the line is not understood.
// A script already on the page is left alone (so a second run changes
// nothing).
// Tests: tests/page_scripts_tests.js.
// ══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DEFAULT_PAGE = path.join(ROOT, 'app', 'index.html');

// One local script tag on the page: <script src="./name.js?v=123" …></script>
const TAG = /^([ \t]*)<script\b([^>]*?)\bsrc=(["'])(\.\/)?([^"'?#>]+\.js)(?:\?v=([^"'&#]+))?\3([^>]*)><\/script>/;
function tagsOf(html) {
  const out = [];
  html.split('\n').forEach((line, i) => {
    const m = TAG.exec(line);
    if (!m || /^(?:[a-z]+:)?\/\//i.test(m[5])) return;           // an outside host is not ours
    out.push({ line: i, indent: m[1], dot: m[4] || '', file: m[5], stamp: m[6] == null ? null : m[6], quote: m[3] });
  });
  return out;
}

// "add staff.js after drive-picker.js | words for the comment"
function parseLine(raw) {
  const text = String(raw).replace(/\r$/, '');
  if (!text.trim() || /^\s*#/.test(text)) return null;
  const bar = text.indexOf('|');
  const head = (bar < 0 ? text : text.slice(0, bar)).trim();
  const note = bar < 0 ? '' : text.slice(bar + 1).trim();
  const m = /^add\s+(\S+)\s+after\s+(\S+)$/i.exec(head);
  if (!m) throw new Error('not understood: "' + text.trim() + '" — write: add <new.js> after <neighbour.js> | optional words');
  return { file: clean(m[1]), after: clean(m[2]), note };
}
function clean(name) {
  const n = String(name).replace(/^\.\//, '').replace(/^app\//, '');
  if (!/^[A-Za-z0-9._\/-]+\.js$/.test(n) || n.includes('..')) throw new Error('"' + name + '" is not a script file name in app/');
  return n;
}

// Place ONE script. Returns { html, did } — did is 'added' or 'already there'.
function place(html, want, appDir) {
  const tags = tagsOf(html);
  if (tags.some(t => t.file === want.file)) return { html, did: 'already there' };
  const at = tags.filter(t => t.file === want.after);
  if (at.length !== 1) throw new Error('"' + want.after + '" is on the page ' + at.length + ' times — it must be there exactly once to place "' + want.file + '" after it');
  if (appDir && !fs.existsSync(path.join(appDir, want.file))) throw new Error('"' + want.file + '" is not in app/ — apply its patch first');
  if (/--|[<>]/.test(want.note)) throw new Error('the words after | cannot hold "--", "<" or ">"');
  const n = at[0];
  const tag = n.indent + '<script src=' + n.quote + n.dot + want.file + (n.stamp == null ? '' : '?v=' + n.stamp) + n.quote + '></script>'
    + (want.note ? '   <!-- ' + want.note + ' -->' : '');
  const lines = html.split('\n');
  const cr = /\r$/.test(lines[n.line]) ? '\r' : '';
  lines.splice(n.line + 1, 0, tag + cr);
  return { html: lines.join('\n'), did: 'added' };
}

// A patch that adds a local script tag to app/index.html by itself.
function lintPatch(text) {
  const bad = [];
  let inPage = false;
  String(text).split('\n').forEach((ln, i) => {
    if (/^diff --git /.test(ln)) inPage = / b\/app\/index\.html\s*$/.test(ln);
    else if (inPage && /^\+(?!\+\+)/.test(ln)) {
      const m = TAG.exec(ln.slice(1));
      if (m && !/^(?:[a-z]+:)?\/\//i.test(m[5])) bad.push({ line: i + 1, file: m[5] });
    }
  });
  return bad;
}

function main(argv) {
  const args = argv.slice();
  const opt = { page: DEFAULT_PAGE, dry: false, after: '', note: '' };
  const rest = [];
  while (args.length) {
    const a = args.shift();
    if (a === '--page') opt.page = path.resolve(args.shift() || '');
    else if (a === '--dry') opt.dry = true;
    else if (a === '--after') opt.after = args.shift() || '';
    else if (a === '--note') opt.note = args.shift() || '';
    else rest.push(a);
  }
  const cmd = rest.shift();
  const say = s => process.stdout.write(s + '\n');
  if (cmd === 'lint-patch') {
    if (!rest.length) throw new Error('lint-patch needs a patch file');
    let n = 0;
    rest.forEach(f => lintPatch(fs.readFileSync(f, 'utf8')).forEach(b => {
      n++; say('ADDS A SCRIPT TO THE PAGE  ' + path.basename(f) + ':' + b.line + '  ' + b.file + '  — cut the patch without app/index.html and write "add ' + b.file + ' after <neighbour.js>" in ship_<topic>.scripts');
    }));
    say(n ? n + ' script line(s) added by a patch.' : 'OK — no patch adds a script to the page.');
    return n ? 1 : 0;
  }
  if (cmd === 'list') { tagsOf(fs.readFileSync(opt.page, 'utf8')).forEach(t => say(t.file + (t.stamp == null ? '  (NO STAMP)' : '  ?v=' + t.stamp))); return 0; }
  let wants;
  if (cmd === 'add') {
    if (rest.length !== 1 || !opt.after) throw new Error('add needs: add <new.js> --after <neighbour.js>');
    wants = [{ file: clean(rest[0]), after: clean(opt.after), note: opt.note, from: 'the command line' }];
  } else if (cmd === 'apply') {
    if (!rest.length) throw new Error('apply needs at least one .scripts file');
    wants = [];
    rest.forEach(f => fs.readFileSync(f, 'utf8').split('\n').forEach(l => { const w = parseLine(l); if (w) { w.from = path.basename(f); wants.push(w); } }));
    if (!wants.length) throw new Error('no "add … after …" line in ' + rest.map(f => path.basename(f)).join(', '));
  } else {
    throw new Error('commands: apply <file.scripts>… | add <new.js> --after <neighbour.js> | lint-patch <file.patch>… | list');
  }
  const appDir = path.dirname(opt.page);
  let html = fs.readFileSync(opt.page, 'utf8');
  const before = html;
  const done = [];
  wants.forEach(w => { const r = place(html, w, appDir); html = r.html; done.push(w.file + ' after ' + w.after + ' — ' + r.did + ' (' + w.from + ')'); });   // a throw here leaves the page untouched: nothing is written until every line fits
  done.forEach(say);
  if (html !== before && !opt.dry) fs.writeFileSync(opt.page, html);
  say(html === before ? 'Nothing to change.' : (opt.dry ? 'DRY RUN — nothing written.' : 'Written: ' + path.relative(process.cwd(), opt.page)));
  return 0;
}

module.exports = { tagsOf, parseLine, place, lintPatch, main };
if (require.main === module) {
  try { process.exit(main(process.argv.slice(2))); }
  catch (e) { process.stderr.write('REFUSED — ' + (e && e.message || e) + '\n(nothing was written)\n'); process.exit(2); }
}
