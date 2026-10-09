// ══ tests/browser_launch_path_tests.js — every browser suite can find its browser ══
//
// 2026-10-09. first_run_tests and new_account_gate_tests called
// chromium.launch() with no browser path, so in the cloud workspace they died
// before their first check ("npx playwright install") and every full run
// showed two reds that were never about the app — red that is always red
// stops being read. The other 51 browser suites already pass the path with a
// fallback: launch(fs.existsSync(ex) ? { executablePath: ex } : {}).
// This scans every launch in tests/ and tests/lib/ and requires the path;
// section B plants a bare launch() and requires red.
'use strict';
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function T(name, ok, info) { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok ? '' : '  -> ' + (info || ''))); ok ? pass++ : fail++; }

function launchesWithoutPath(files) {
  const bad = [];
  files.forEach(({ name, src }) => {
    const re = /chromium\.launch\(/g; let m;
    while ((m = re.exec(src))) {
      // the call's own text: up to the matching close paren (one level is enough here)
      let depth = 0, k = m.index + 'chromium.launch'.length, end = k;
      for (; k < src.length; k++) { if (src[k] === '(') depth++; else if (src[k] === ')') { depth--; if (!depth) { end = k; break; } } }
      const call = src.slice(m.index, end + 1);
      if (!/executablePath/.test(call)) bad.push(name + ': ' + call.slice(0, 60));
    }
  });
  return bad;
}
function readDir(d) {
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => f.endsWith('.js'))
    .map(f => ({ name: path.relative(path.join(__dirname, '..'), path.join(d, f)), src: fs.readFileSync(path.join(d, f), 'utf8') }));
}
const FILES = readDir(__dirname).concat(readDir(path.join(__dirname, 'lib')))
  .filter(f => !/browser_launch_path_tests\.js$/.test(f.name));   // this file holds the planted examples
const launches = FILES.filter(f => /chromium\.launch\(/.test(f.src)).length;

T('A1 the scan sees the browser suites (' + launches + ' files launch a browser)', launches >= 10, launches);
const bad = launchesWithoutPath(FILES);
T('A2 every chromium.launch in tests/ passes a browser path', bad.length === 0, bad.join(' | '));
T('A3 first_run_tests and new_account_gate_tests are among the files checked',
  FILES.some(f => /first_run_tests\.js$/.test(f.name) && /executablePath/.test(f.src)) &&
  FILES.some(f => /new_account_gate_tests\.js$/.test(f.name) && /executablePath/.test(f.src)));
// B. planted: a bare launch must be caught
const planted = launchesWithoutPath([{ name: 'planted.js', src: "const b = await chromium.launch();\nconst c = await chromium.launch({ headless: true });" }]);
T('B1 PLANTED bare launch() and launch({headless}) are both caught', planted.length === 2, JSON.stringify(planted));

console.log('\nbrowser_launch_path_tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
