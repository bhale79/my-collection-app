// ═══════════════════════════════════════════════════════════════
// native_dialog_tests.js — v0.9.1819 (release readiness S2).
//
// THE RULE: the app never opens the browser's own pop-up boxes —
// confirm(), alert(), prompt() — anywhere. They are small-print, cannot be
// styled for older eyes, ignore the theme, freeze the page, and on a phone
// the Back button does the wrong thing. The app has its own two boxes,
// appConfirm and appPrompt (wizard-utils.js, loaded on every start), and a
// plain notice (showToast). A failure message goes through rrSaveError.
//
// Before this release ~25 places still used the browser's boxes and 33 more
// carried a dead "if appConfirm is missing, use the browser's" fallback —
// the same dead-fallback habit v0.9.1813 removed around rrSaveError. This
// scan walks every app script (comments blanked, strings KEPT — an onclick
// attribute is a call at runtime) and holds both counts at zero.
// Section C plants each old habit and the scan must go red.
// Run:  node tests/native_dialog_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// Blank // comments (keeps line numbers), keep everything else.
const code = src => src.replace(/(^|[^:'"`])\/\/[^\n]*/gm, (m, pre) => pre + ' '.repeat(m.length - pre.length));
const lineOf = (src, i) => src.slice(0, i).split('\n').length;

// A native box is `confirm(` / `alert(` / `prompt(` not preceded by an
// identifier character or a dot (so appConfirm( and obj.confirm( are not
// hits) — OR the explicit window./globalThis. spelling.
function nativeCalls(src) {
  const out = [];
  const re = /(^|[^\w$.])(?:window\.|globalThis\.)?(confirm|alert|prompt)\s*\(/g;
  let m;
  while ((m = re.exec(src))) out.push({ at: lineOf(src, m.index), fn: m[2] });
  return out;
}
function deadGuards(src) {
  const out = [];
  const re = /typeof\s+(appConfirm|appPrompt)\s*[!=]==?\s*'function'/g;
  let m;
  while ((m = re.exec(src))) out.push({ at: lineOf(src, m.index), fn: m[1] });
  return out;
}

section('A · the app opens none of the browser\'s boxes');
const files = fs.readdirSync(APP).filter(f => /\.js$/.test(f)).sort();
const hits = [], guards = [];
files.forEach(f => {
  const src = code(fs.readFileSync(path.join(APP, f), 'utf8'));
  nativeCalls(src).forEach(h => hits.push(f + ':' + h.at + ' ' + h.fn));
  deadGuards(src).forEach(g => guards.push(f + ':' + g.at));
});
ok('A1  zero confirm( / alert( / prompt( calls across ' + files.length + ' scripts', hits.length === 0, hits.join(', '));
ok('A2  zero "typeof appConfirm/appPrompt" fallbacks (the helper is on every start; a fallback is the browser box in disguise)', guards.length === 0, guards.join(', '));
const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
ok('A3  index.html carries no inline browser box either', nativeCalls(html.replace(/<!--[\s\S]*?-->/g, '')).length === 0);

section('B · the app\'s own boxes are real and loaded');
const WU = fs.readFileSync(path.join(APP, 'wizard-utils.js'), 'utf8');
ok('B1  appConfirm and appPrompt are top-level functions in wizard-utils.js', /^function appConfirm\(message, opts\)/m.test(WU) && /^function appPrompt\(message, defaultValue, opts\)/m.test(WU));
ok('B2  …and put on window', /window\.appConfirm = appConfirm/.test(WU) && /window\.appPrompt = appPrompt/.test(WU));
ok('B3  wizard-utils.js is loaded by index.html', /<script src="\.\/wizard-utils\.js\?v=\d+"><\/script>/.test(html));
// lift _appDialogText and run it
const iT = WU.indexOf('function _appDialogText(');
const bodyT = WU.slice(iT, WU.indexOf('\n}', iT) + 2);
const _appDialogText = new Function(bodyT + '\nreturn _appDialogText;')();
ok('B4  a "\\n" in a message becomes a line break on screen', _appDialogText('one\n\ntwo') === 'one<br><br>two' && _appDialogText(null) === '');
ok('B5  both boxes render the message through it', (WU.match(/' \+ _appDialogText\(message\) \+ '/g) || []).length === 2);
ok('B6  the two report-export failures go through rrSaveError, not raw error text', (() => {
  const re = fs.readFileSync(path.join(APP, 'report-export.js'), 'utf8');
  return /rrSaveError\(e, 'the PDF'/.test(re) && /rrSaveError\(e, 'the Google Doc'/.test(re) && !/\+ e\.message/.test(code(re));
})());

section('C · planted offenders — the scan must fire');
const clean = code(fs.readFileSync(path.join(APP, 'stock-photos.js'), 'utf8'));
ok('C0  the sample file is clean to start', nativeCalls(clean).length === 0 && deadGuards(clean).length === 0);
ok('OFFENDER 1: a bare confirm( in code -> A1 red', nativeCalls(clean + "\nfunction _x(){ if (!confirm('Sure?')) return; }\n").length === 1);
ok('OFFENDER 2: window.confirm( -> A1 red', nativeCalls(clean + "\nfunction _x(){ return window.confirm('Sure?'); }\n").length === 1);
ok('OFFENDER 3: alert( with raw error text -> A1 red', nativeCalls(clean + "\ntry { x(); } catch (e) { alert('Failed: ' + e.message); }\n").length === 1);
ok('OFFENDER 4: prompt( inside an onclick attribute string (a call at runtime) -> A1 red', nativeCalls(clean + "\nvar h = '<button onclick=\"var n = prompt(\\'Name?\\'); go(n)\">x</button>';\n").length === 1);
ok('OFFENDER 5: the dead typeof fallback -> A2 red', deadGuards(clean + "\nvar ok = (typeof appConfirm === 'function') ? await appConfirm('x') : true;\n").length === 1);
ok('OFFENDER 6 (negative): appConfirm( and appPrompt( are not hits', nativeCalls(clean + "\nasync function _y(){ await appConfirm('a'); await appPrompt('b', ''); }\n").length === 0);
ok('OFFENDER 7 (negative): the old habit in a comment stays green', nativeCalls(code(clean + "\n// used to be: if (!confirm('x')) return; and alert(msg)\n")).length === 0);
ok('OFFENDER 8 (negative): a method named confirm on an object is not the browser box', nativeCalls(clean + "\nBackStack.confirm('x'); opts.prompt(1);\n").length === 0);

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
