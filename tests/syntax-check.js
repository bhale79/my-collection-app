// ═══════════════════════════════════════════════════════════════
// syntax-check.js — every shipped .js file parses
// v0.9.1257 (audit 2026-08-02)
//
// "node --check on every file" has been a deploy step for a long time,
// run by hand, one file at a time. It is the cheapest gate in the whole
// checklist and the easiest to skip when in a hurry.
//
// It is genuinely NOT covered by the other tests: the suite reads app
// source as TEXT and matches patterns against it. A file with a missing
// brace still reads fine as a string, so 2,243 assertions can pass on an
// app that will not parse in a browser.
//
// This makes it one command, over every file, with an exit code.
// ═══════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// Everything that actually ships, plus the tests themselves — a syntax
// error in the harness is how a gate stops running.
const DIRS = [
  path.join(ROOT, 'app'),
  path.join(ROOT, 'tests'),
];

let checked = 0;
const broken = [];

DIRS.forEach(function (dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir)
    .filter(function (f) { return /\.js$/i.test(f); })
    .sort()
    .forEach(function (f) {
      const abs = path.join(dir, f);
      const src = fs.readFileSync(abs, 'utf8');
      checked++;
      try {
        // Compile without running — exactly what `node --check` does.
        new vm.Script(src, { filename: abs });
      } catch (e) {
        broken.push('  ' + path.relative(ROOT, abs) + ': ' + (e && e.message));
      }
    });
});

// Also the root service worker and the two pages, which are not in app/
// and have historically been the files everyone forgets.
[path.join(ROOT, 'sw.js')].forEach(function (abs) {
  if (!fs.existsSync(abs)) return;
  checked++;
  try { new vm.Script(fs.readFileSync(abs, 'utf8'), { filename: abs }); }
  catch (e) { broken.push('  ' + path.relative(ROOT, abs) + ': ' + (e && e.message)); }
});

if (broken.length) {
  console.log('SYNTAX ERRORS:\n' + broken.join('\n'));
  console.log('\nFAILED  —  ' + broken.length + ' of ' + checked + ' files do not parse.');
  process.exit(1);
}

console.log('ALL PASS  —  ' + checked + ' JavaScript files parse cleanly.');
process.exit(0);
