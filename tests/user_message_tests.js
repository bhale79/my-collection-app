// ═══════════════════════════════════════════════════════════════
// user_message_tests.js — v0.9.1813 (release readiness S14).
//
// THE RULE: a message shown to the user never carries raw error text.
// "Cannot read properties of undefined" means nothing to a collector; the
// technical detail goes to the console (for Brad and Claude), and the toast
// says in plain words what happened and what to do — "Could not save your
// tags — nothing was changed. Please try again."
//
// The July 2026 pre-beta audit counted ~40 of these; by 2026-09-27 four were
// left (bulk-tag ×2, import-ui ×2) and this release removed them. This scan
// keeps the count at zero: every showToast(...) call whose arguments mention
// `.message` is an offender.
//
// EXCLUDED, deliberately: yardmaster.js — the Office is Brad's own admin
// screen, and its "tell Claude" messages are addressed to him.
//
// Section B plants an offender and the scan must go red.
// Run:  node tests/user_message_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..', 'app');
const ADMIN_ONLY = new Set(['yardmaster.js']);
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
// code only — a comment that quotes the old habit is history, not behaviour
const code = src => src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

// Every showToast( call, with its argument text up to the matching ')'.
// A `showToast(` that sits INSIDE a string on its own line — an onclick
// attribute in an HTML template (sell.js has one) — is not a call: the line
// before it holds an odd number of unescaped quotes.
function insideStringOnLine(src, idx) {
  const ls = src.lastIndexOf('\n', idx) + 1;
  const before = src.slice(ls, idx).replace(/\\./g, '');
  let q = null;
  for (const ch of before) { if (q) { if (ch === q) q = null; } else if (ch === "'" || ch === '"' || ch === '`') q = ch; }
  return q !== null;
}
function toastCalls(src) {
  const out = [];
  const re = /(^|[^\w$.])showToast\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const start = m.index + m[1].length;
    if (insideStringOnLine(src, start)) continue;
    let d = 1, k = m.index + m[0].length, inS = null;
    for (; k < src.length && d > 0; k++) {
      const c = src[k];
      if (inS) { if (c === '\\') { k++; continue; } if (c === inS) inS = null; continue; }
      if (c === "'" || c === '"' || c === '`') { inS = c; continue; }
      if (c === '(') d++; else if (c === ')') d--;
    }
    out.push({ at: src.slice(0, start).split('\n').length, args: src.slice(m.index + m[0].length, k - 1) });
  }
  return out;
}
function offenders(src) {
  return toastCalls(code(src)).filter(t => /\.message\b/.test(t.args));
}

console.log('== A · no user toast carries raw error text ==');
const files = fs.readdirSync(APP).filter(f => /\.js$/.test(f)).sort();
let total = 0, hits = [];
files.forEach(f => {
  if (ADMIN_ONLY.has(f)) return;
  const src = fs.readFileSync(path.join(APP, f), 'utf8');
  const calls = toastCalls(code(src)); total += calls.length;
  offenders(src).forEach(o => hits.push(f + ':' + o.at));
});
ok('A1  the scan saw the app\'s toasts (' + total + ' calls across ' + files.length + ' files)', total > 200, String(total));
ok('A2  zero showToast calls mention .message outside the admin-only Office', hits.length === 0, hits.join(', '));
ok('A3  the four sites this release fixed are clean (bulk-tag.js, import-ui.js)',
   offenders(fs.readFileSync(path.join(APP, 'bulk-tag.js'), 'utf8')).length === 0 &&
   offenders(fs.readFileSync(path.join(APP, 'import-ui.js'), 'utf8')).length === 0);

console.log('\n== B · planted offenders — the scan must fire ==');
const clean = fs.readFileSync(path.join(APP, 'bulk-tag.js'), 'utf8');
const o1 = clean.replace("showToast('Could not save your tags", "showToast('Could not save: ' + e.message + '");
ok('offender 1 changed the source', o1 !== clean);
ok('OFFENDER 1: `+ e.message +` inside a toast -> A2 red', offenders(o1).length === 1);
const o2 = clean + "\nfunction _x(e){ showToast('Failed: ' + (e && e.message ? e.message : 'error'), 5000, true); }\n";
ok('OFFENDER 2: the old ternary spelling -> A2 red', offenders(o2).length === 1);
const o3 = clean + "\nfunction _y(e){ showToast(rrEsc('Save failed — ' + (e.message || 'try again'))); }\n";
ok('OFFENDER 3: nested inside another call -> still found (paren matching)', offenders(o3).length === 1);
const o4 = clean + "\n// showToast('Failed: ' + e.message)\n";
ok('OFFENDER 4 (negative): the old habit inside a comment stays green', offenders(o4).length === 0);
const o5 = clean + "\nfunction _z(e){ showToast('Could not save (' + ')' + e.message); }\n";
const o6 = clean + "\nvar _h = '<button onclick=\"showToast(\\'Saved\\')\">x</button>'; function _w(e){ return _read(e && e.message); }\n";
ok('OFFENDER 6 (negative): a showToast( inside an HTML string is not a call (sell.js shape)', offenders(o6).length === 0);
ok('OFFENDER 5: a \')\' inside a string does not end the argument early', offenders(o5).length === 1);

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
