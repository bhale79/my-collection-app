#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════
// PAGE SCRIPTS — tools/page-scripts/page_scripts.js (2026-11-12)
// A new script file reaches app/index.html through ONE tool, by NAME, at ship
// time — never through a hand-over patch (whose neighbouring lines carry the
// old version stamps and stop fitting the moment another release lands;
// staffpins #28 was pulled from a train for it, twice broken).
//
//   A  the real page: a new script is placed right after its neighbour, in the
//      page's own spelling, with the stamp the page carries NOW; nothing else
//      on the page moves; a second run changes nothing
//   B  the same line fits whatever the version is (the whole point): placed on
//      a page stamped with another number, it takes THAT number
//   C  what it refuses — and that it writes nothing when it does
//   D  the .scripts file: lines, comments, the words after |
//   E  lint-patch: a patch that adds a script tag to the page by itself
//   F  the command line, end to end, on a copy of the real app folder
//   P  PLANTED offenders — each must turn its check red
// ══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const TOOL = path.join(__dirname, '..', 'tools', 'page-scripts', 'page_scripts.js');
const T0 = require(TOOL);
const APP = path.join(__dirname, '..', 'app');
const PAGE = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function T(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)); }
}
const threw = fn => { try { fn(); return ''; } catch (e) { return String(e && e.message || e); } };
const stampOf = html => { const s = new Set(T0.tagsOf(html).map(t => t.stamp)); return Array.from(s); };

// The checks, run against a tool (the real one, or a planted copy).
function run(tool) {
  const R = {};
  const tags = tool.tagsOf(PAGE);
  const names = tags.map(t => t.file);
  const mid = tags[Math.floor(tags.length / 2)];                 // a neighbour in the middle of the page
  const last = tags[tags.length - 1];
  R.count = tags.length;
  R.oneStamp = stampOf(PAGE).length;

  // A
  const a = tool.place(PAGE, { file: 'brand-new.js', after: mid.file, note: 'a new screen' }, null);
  const aLines = a.html.split('\n'), pLines = PAGE.split('\n');
  R.A_did = a.did;
  R.A_line = aLines[mid.line + 1];
  R.A_wantLine = mid.indent + '<script src=' + mid.quote + mid.dot + 'brand-new.js?v=' + mid.stamp + mid.quote + '></script>   <!-- a new screen -->';
  R.A_rest = aLines.slice(0, mid.line + 1).join('\n') === pLines.slice(0, mid.line + 1).join('\n')
    && aLines.slice(mid.line + 2).join('\n') === pLines.slice(mid.line + 1).join('\n');
  R.A_order = (function () { const n = tool.tagsOf(a.html).map(t => t.file); const i = n.indexOf(mid.file); return [n.length - names.length, n[i + 1]]; })();
  R.A_stamps = stampOf(a.html).length;
  const a2 = tool.place(a.html, { file: 'brand-new.js', after: mid.file, note: 'a new screen' }, null);
  R.A_again = [a2.did, a2.html === a.html];
  const aEnd = tool.place(PAGE, { file: 'brand-new.js', after: last.file, note: '' }, null);
  R.A_end = [tool.tagsOf(aEnd.html).slice(-1)[0].file, /<!--/.test(aEnd.html.split('\n')[last.line + 1])];

  // B — another release landed first: every stamp on the page is a different number
  const moved = PAGE.replace(/\?v=\d+/g, '?v=987654');
  const b = tool.place(moved, { file: 'brand-new.js', after: mid.file, note: '' }, null);
  R.B = [b.did, /brand-new\.js\?v=987654/.test(b.html), stampOf(b.html)];
  const crlf = tool.place(PAGE.replace(/\n/g, '\r\n'), { file: 'brand-new.js', after: mid.file, note: '' }, null);
  R.B_crlf = [/brand-new\.js[^\n]*\r\n/.test(crlf.html), crlf.html.split('\r\n').length - PAGE.split('\n').length];

  // C
  R.C_noNeighbour = /on the page 0 times/.test(threw(() => tool.place(PAGE, { file: 'brand-new.js', after: 'not-here.js', note: '' }, null)));
  R.C_twice = /on the page 2 times/.test(threw(() => tool.place(PAGE + '\n' + pLines[mid.line] + '\n', { file: 'brand-new.js', after: mid.file, note: '' }, null)));
  R.C_noFile = /is not in app\//.test(threw(() => tool.place(PAGE, { file: 'brand-new.js', after: mid.file, note: '' }, APP)));
  R.C_note = /cannot hold/.test(threw(() => tool.place(PAGE, { file: 'brand-new.js', after: mid.file, note: 'a --> b' }, null)));
  R.C_outside = tool.tagsOf(PAGE).some(t => /^https?:|^\/\//.test(t.file));   // an outside host is never a neighbour

  // D
  R.D = [
    tool.parseLine('add staff.js after drive-picker.js | TRR Pro — staff PINs'),
    tool.parseLine('  ADD  ./staff.js   AFTER  app/drive-picker.js  '),
    tool.parseLine('# a comment'), tool.parseLine('   '),
  ];
  R.D_bad = [
    /not understood/.test(threw(() => tool.parseLine('staff.js after drive-picker.js'))),
    /not a script file name/.test(threw(() => tool.parseLine('add ../evil.js after drive-picker.js'))),
    /not a script file name/.test(threw(() => tool.parseLine('add staff.css after drive-picker.js'))),
  ];

  // E
  const patch = [
    'diff --git a/app/staff.js b/app/staff.js', '+++ b/app/staff.js', '+<script src="./in-a-string.js?v=1"></script>',
    'diff --git a/app/index.html b/app/index.html', '--- a/app/index.html', '+++ b/app/index.html', '@@ -1,2 +1,3 @@',
    ' <script src="./drive-picker.js?v=2141"></script>', '+<script src="./staff.js?v=2141"></script>   <!-- staff -->',
    '+<script src="https://cdn.example.com/lib.js"></script>', '+<div>words</div>',
  ].join('\n');
  R.E = tool.lintPatch(patch);
  R.E_clean = tool.lintPatch(patch.replace('+<script src="./staff.js?v=2141"></script>   <!-- staff -->\n', ''));
  return { R, mid, names };
}

// F — the command line on a copy of the real app folder
function cli(args, cwd) {
  const r = cp.spawnSync(process.execPath, [TOOL].concat(args), { cwd, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
function walkCli(mid) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-page-scripts-'));
  const app = path.join(dir, 'app'); fs.mkdirSync(app);
  const page = path.join(app, 'index.html'); fs.writeFileSync(page, PAGE);
  T0.tagsOf(PAGE).forEach(t => { const p = path.join(app, t.file); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, ''); });
  const F = {};
  const s1 = path.join(dir, 'ship_one.scripts'), s2 = path.join(dir, 'ship_two.scripts');
  fs.writeFileSync(s1, '# staff PINs\nadd one.js after ' + mid.file + ' | the first\n');
  fs.writeFileSync(s2, 'add two.js after one.js | rides on the first\n');
  let r = cli(['apply', s1, '--page', page], dir);
  F.missingFile = [r.code, /REFUSED/.test(r.out) && /nothing was written/.test(r.out), fs.readFileSync(page, 'utf8') === PAGE];
  fs.writeFileSync(path.join(app, 'one.js'), ''); fs.writeFileSync(path.join(app, 'two.js'), '');
  r = cli(['apply', s1, s2, '--page', page, '--dry'], dir);
  F.dry = [r.code, /DRY RUN/.test(r.out), fs.readFileSync(page, 'utf8') === PAGE];
  r = cli(['apply', s1, s2, '--page', page], dir);
  const after = T0.tagsOf(fs.readFileSync(page, 'utf8')).map(t => t.file);
  const i = after.indexOf(mid.file);
  F.applied = [r.code, after.slice(i, i + 3), stampOf(fs.readFileSync(page, 'utf8')).length];
  const once = fs.readFileSync(page, 'utf8');
  r = cli(['apply', s1, s2, '--page', page], dir);
  F.again = [r.code, /Nothing to change/.test(r.out), fs.readFileSync(page, 'utf8') === once];
  // one bad line among good ones: NOTHING is written (all or nothing)
  fs.writeFileSync(page, PAGE);
  fs.writeFileSync(s2, 'add two.js after not-on-the-page.js\n');
  r = cli(['apply', s1, s2, '--page', page], dir);
  F.allOrNothing = [r.code, fs.readFileSync(page, 'utf8') === PAGE];
  const pf = path.join(dir, 'x.patch');
  fs.writeFileSync(pf, 'diff --git a/app/index.html b/app/index.html\n+++ b/app/index.html\n+<script src="./staff.js?v=1"></script>\n');
  r = cli(['lint-patch', pf], dir);
  F.lint = [r.code, /ADDS A SCRIPT TO THE PAGE/.test(r.out) && /staff\.js/.test(r.out)];
  fs.writeFileSync(pf, 'diff --git a/app/staff.js b/app/staff.js\n+++ b/app/staff.js\n+var a = 1;\n');
  r = cli(['lint-patch', pf], dir);
  F.lintClean = [r.code, /^OK/m.test(r.out)];
  r = cli(['nonsense'], dir);
  F.unknown = r.code;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  return F;
}

// A planted copy of the tool: one line changed, loaded from a temp file.
function planted(from, to, what) {
  const src = fs.readFileSync(TOOL, 'utf8');
  if (src.split(from).length !== 2) throw new Error('planting "' + what + '": its anchor is not there exactly once');
  const f = path.join(os.tmpdir(), 'rr-page-scripts-planted-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.js');
  fs.writeFileSync(f, src.replace(from, to));
  try { return require(f); } finally { try { fs.unlinkSync(f); } catch (e) {} }
}

try {
  const { R, mid } = run(T0);
  T('the real page lists its local scripts, all on ONE stamp', [R.count > 50, R.oneStamp], [true, 1]);
  T('A1 a new script is placed right after its neighbour, in the page\'s own spelling, with the page\'s stamp and its note', [R.A_did, R.A_line], ['added', R.A_wantLine]);
  T('A2 not one other line of the page moved', R.A_rest, true);
  T('A3 the page loads one more script, right after the neighbour, still on ONE stamp', [R.A_order, R.A_stamps], [[1, 'brand-new.js'], 1]);
  T('A4 run again: nothing changes', R.A_again, ['already there', true]);
  T('A5 after the LAST script on the page works too, and no note means no comment', R.A_end, ['brand-new.js', false]);
  T('B1 another release landed first (every stamp a different number): the same line still fits and takes THAT number', R.B, ['added', true, ['987654']]);
  T('B2 a page with Windows line endings keeps them, one line longer', R.B_crlf, [true, 1]);
  T('C1 refused: the neighbour is not on the page', R.C_noNeighbour, true);
  T('C2 refused: the neighbour is on the page twice', R.C_twice, true);
  T('C3 refused: the new file is not in app/ (its patch was not applied)', R.C_noFile, true);
  T('C4 refused: a note that would break out of its comment', R.C_note, true);
  T('C5 a script from an outside host is never a neighbour', R.C_outside, false);
  T('D1 the .scripts line: names with or without ./ or app/, any case of the words, the note after |; comments and blank lines skipped', R.D,
    [{ file: 'staff.js', after: 'drive-picker.js', note: 'TRR Pro — staff PINs' }, { file: 'staff.js', after: 'drive-picker.js', note: '' }, null, null]);
  T('D2 refused: a line it does not understand, a path that climbs out of app/, a file that is not .js', R.D_bad, [true, true, true]);
  T('E1 lint-patch: a patch that adds a local script tag to app/index.html is named (a tag inside another file, an outside host and other added lines are not)', R.E, [{ line: 9, file: 'staff.js' }]);
  T('E2 …and a patch that does not is clean', R.E_clean, []);

  const F = walkCli(mid);
  T('F1 the command: refused while the new file is missing — exit 2, says nothing was written, the page untouched', F.missingFile, [2, true, true]);
  T('F2 --dry: says so and writes nothing', F.dry, [0, true, true]);
  T('F3 two hand-overs in queue order (the second rides on the first): both placed, in order, one stamp', F.applied, [0, [mid.file, 'one.js', 'two.js'], 1]);
  T('F4 run again: nothing to change', F.again, [0, true, true]);
  T('F5 one line that does not fit among good ones: NOTHING is written', F.allOrNothing, [2, true]);
  T('F6 lint-patch exits 1 and names the script; a clean patch exits 0', [F.lint, F.lintClean], [[1, true], [0, true]]);
  T('F7 an unknown command is refused', F.unknown, 2);

  // ── P ──────────────────────────────────────────────────────────────────
  let p = run(planted("(n.stamp == null ? '' : '?v=' + n.stamp)", "'?v=2141'", 'a typed-in stamp')).R;
  T('P1 a typed-in version stamp is caught (B1 red: the page ends up on two stamps)', p.B[2].length === 1, false);
  p = run(planted("  if (tags.some(t => t.file === want.file)) return { html, did: 'already there' };\n", '', 'no already-there check')).R;
  T('P2 a second run adding the script again is caught (A4 red)', p.A_again[1], false);
  p = run(planted('if (at.length !== 1) throw', 'if (at.length < 1) throw', 'two neighbours allowed')).R;
  T('P3 guessing between two neighbours is caught (C2 red)', p.C_twice, false);
  p = run(planted("  lines.splice(n.line + 1, 0, tag + cr);", "  lines.splice(n.line, 0, tag + cr);", 'placed before')).R;
  T('P4 placed BEFORE its neighbour is caught (A1/A3 red)', p.A_order[1] === 'brand-new.js' && p.A_line === p.A_wantLine, false);
  p = run(planted("if (/^diff --git /.test(ln)) inPage = / b\\/app\\/index\\.html\\s*$/.test(ln);", "if (/^diff --git /.test(ln)) inPage = true;", 'lint every file')).R;
  T('P5 lint-patch calling out a tag inside another file is caught (E1 red)', p.E.length === 1, false);
  p = run(planted("    if (!m || /^(?:[a-z]+:)?\\/\\//i.test(m[5])) return;           // an outside host is not ours", "    if (!m) return;", 'outside hosts counted')).R;
  T('P6 an outside host treated as one of the page\'s own scripts is caught (C5 red)', p.C_outside, true);
} catch (e) { fail++; console.log('FAIL  page_scripts_tests threw: ' + (e && e.stack || e)); }
console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
