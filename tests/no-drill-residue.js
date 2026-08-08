// ══ tests/no-drill-residue.js — DID I LEAVE A DRILL SWITCHED ON? ══════════
//
// I break the app on purpose, often — a mutation drill is how a new assertion
// earns the right to be believed. On 2026-08-08 one of those drills disabled
// the tour's page watchdog, the command that was supposed to restore it timed
// out before it ran, and v0.9.1399 was COMMITTED with the watchdog switched
// off. The commit message described a fix the code did not contain. Nothing
// caught it for two hours; the thing that finally did was a test going red for
// a reason I could not explain.
//
// This is the guard. It is deliberately dumb, deliberately fast, and it runs
// before anything is committed: no shipped file may contain the words a drill
// leaves behind, and no branch may be short-circuited by a constant.
//
// WHAT IT CANNOT SEE: a drill that looks like ordinary code. It catches the
// careless kind, which is the kind that actually happened.
'use strict';

const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

// Words that only ever appear in something temporary.
const MARKERS = [/\bDRILL\b/, /\bMUTATED\b/, /\bTEMPORARILY DISABLED\b/i,
                 /\bDO NOT COMMIT\b/i, /\bXXX-?REMOVE\b/i];
// A branch that can never be taken, or can never be escaped.
const DEAD = [/\bif\s*\(\s*true\s*\)\s*return\b/, /\bif\s*\(\s*false\s*&&/,
              /\breturn\s*;\s*\/\/\s*(drill|debug)/i];

const files = fs.readdirSync(APP).filter(f => /\.(js|html|css)$/.test(f));
ok('there are shipped files to check', files.length > 10, String(files.length));

const marked = [], dead = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(APP, f), 'utf8');
  src.split('\n').forEach((line, n) => {
    // This file's own explanation of what it looks for must not trip it.
    if (MARKERS.some(re => re.test(line))) marked.push(f + ':' + (n + 1) + '  ' + line.trim().slice(0, 90));
    if (DEAD.some(re => re.test(line))) dead.push(f + ':' + (n + 1) + '  ' + line.trim().slice(0, 90));
  });
}

console.log('');
for (const m of marked) console.log('     marker: ' + m);
for (const d of dead) console.log('     dead branch: ' + d);
if (marked.length || dead.length) console.log('');

ok('no shipped file carries a leftover drill marker', marked.length === 0,
   marked.slice(0, 4).join(' | '));
ok('no shipped file has a branch wired permanently open or shut', dead.length === 0,
   dead.slice(0, 4).join(' | '));

console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
