// WHAT GOES ON THE WEBSITE — .github/site-files.txt + the publish workflow
// (2026-10-19)
//
// Brad 2026-10-19: tests, tools, README, PROJECT_INSTRUCTIONS and the package
// files were public on therailroster.com because GitHub published the whole
// repo → "do the website only publishing". The site is now published by
// .github/workflows/publish-site.yml, which copies ONLY the "publish:" paths of
// .github/site-files.txt.
//
// Checks (each also run against a planted offender that must fail it):
//   L  every top-level file/folder in the repo is on the list exactly once,
//      as publish or private — a new one has to be decided, not slip through
//   M  the things the site cannot live without are published (home page, the
//      app, CNAME, the Search Console proof, robots, sitemap, terms, privacy)
//   N  the working files are private (tests, tools, README, notes, packages)
//   W  the workflow reads THIS list (no second list), deploys with
//      deploy-pages, runs on every push to main, and refuses a missing path
//   G  the gather step, run here exactly as the workflow runs it, produces a
//      site holding every published file and none of the private ones

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const LIST = path.join(ROOT, '.github', 'site-files.txt');
const WF = path.join(ROOT, '.github', 'workflows', 'publish-site.yml');

let pass = 0, fail = 0;
function ok(name, cond, why) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (why ? '  —  ' + why : '')); }
}

const MUST_PUBLISH = ['index.html', 'app', 'CNAME', 'google540af0b13abd3cff.html', 'robots.txt',
                      'sitemap.xml', 'terms', 'privacy', 'site', 'sw.js'];
const MUST_PRIVATE = ['tests', 'tools', 'README.md', 'PROJECT_INSTRUCTIONS.md', 'package.json',
                      'package-lock.json', '.github'];

function parse(text) {
  const out = { publish: [], private: [], bad: [] };
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    const m = /^(publish|private):\s*(\S+)$/.exec(l);
    if (m) out[m[1]].push(m[2]); else out.bad.push(l);
  }
  return out;
}

// Top-level entries the repo actually tracks (git when available, else the disk).
function topLevel() {
  try {
    const files = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n').filter(Boolean);
    return [...new Set(files.map(f => f.split('/')[0]))].sort();
  } catch (e) {
    return fs.readdirSync(ROOT).filter(n => n !== '.git' && n !== 'node_modules').sort();
  }
}

function checkList(text, top) {
  const p = parse(text);
  if (p.bad.length) return 'a line is neither publish: nor private: — ' + p.bad[0];
  const all = [...p.publish, ...p.private];
  const seen = new Set();
  for (const a of all) { if (seen.has(a)) return a + ' is listed twice'; seen.add(a); }
  for (const t of top) if (!seen.has(t)) return 'the repo has ' + t + ' but the list does not say publish or private';
  for (const a of p.publish) if (a.includes('/')) return a + ' — list top-level names only';
  return '';
}
function checkMust(text) {
  const p = parse(text);
  for (const m of MUST_PUBLISH) if (!p.publish.includes(m)) return m + ' must be published';
  return '';
}
function checkNever(text) {
  const p = parse(text);
  for (const m of MUST_PRIVATE) if (!p.private.includes(m)) return m + ' must be private';
  for (const m of MUST_PRIVATE) if (p.publish.includes(m)) return m + ' is published';
  return '';
}
function checkWorkflow(wf) {
  if (!/on:\s*\n\s*push:\s*\n\s*branches:\s*\[main\]/.test(wf)) return 'does not run on every push to main';
  if (!/done < <\(sed -n 's\/\^publish:[^']*' \.github\/site-files\.txt\)/.test(wf)) return 'the gather loop does not read the publish: lines of .github/site-files.txt';
  if ((wf.match(/\bcp\b/g) || []).length !== 1 || !wf.includes('cp -a "$p" _site/')) return 'copies something other than the listed paths (a second list)';
  if (!/actions\/upload-pages-artifact@v\d+[\s\S]*path:\s*_site/.test(wf)) return 'does not upload _site';
  if (!/actions\/deploy-pages@v\d+/.test(wf)) return 'does not deploy with deploy-pages';
  if (!/is not in the repo"; exit 1/.test(wf)) return 'does not stop on a listed path that is missing';
  if (!/set -euo pipefail/.test(wf)) return 'the gather step does not stop on errors';
  return '';
}

console.log('site_files_tests — the real repo');
const text = fs.existsSync(LIST) ? fs.readFileSync(LIST, 'utf8') : '';
const wf = fs.existsSync(WF) ? fs.readFileSync(WF, 'utf8') : '';
const top = topLevel();
ok('L every top-level entry decided once', !checkList(text, top), checkList(text, top));
ok('M the site keeps what it needs', !checkMust(text), checkMust(text));
ok('N working files stay private', !checkNever(text), checkNever(text));
ok('W the workflow reads the one list', !checkWorkflow(wf), checkWorkflow(wf));

// G — run the workflow's own gather step on a copy of the listed paths.
(function gather() {
  const m = /- name: Gather the website's files[\s\S]*?run: \|\n([\s\S]*?)\n\s*- uses: actions\/configure-pages/.exec(wf);
  if (!m) { ok('G gather step found', false, 'could not find the gather step'); return; }
  const script = m[1].split('\n').map(l => l.replace(/^ {10}/, '')).join('\n');
  const site = path.join(ROOT, '_site');            // where the workflow gathers; removed after
  fs.rmSync(site, { recursive: true, force: true });
  try { execSync(script, { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash', encoding: 'utf8' }); }
  catch (e) { ok('G gather step runs', false, String(e.stderr || e.message).slice(0, 300)); fs.rmSync(site, { recursive: true, force: true }); return; }
  const okSite = fs.existsSync(site);
  ok('G gather step runs', okSite, 'no _site produced');
  if (okSite) {
    const p = parse(text);
    const missing = p.publish.filter(x => !fs.existsSync(path.join(site, x)));
    const leaked = p.private.filter(x => fs.existsSync(path.join(site, x)));
    ok('G every published path is on the site', !missing.length, 'missing: ' + missing.join(', '));
    ok('G no private path is on the site', !leaked.length, 'leaked: ' + leaked.join(', '));
    const appSrc = execSync('git ls-files app | wc -l', { cwd: ROOT, encoding: 'utf8' }).trim();
    const appSite = execSync('find _site/app -type f | wc -l', { cwd: ROOT, encoding: 'utf8' }).trim();
    ok('G the whole app is copied (' + appSite + ' files)', appSite === appSrc, appSrc + ' tracked vs ' + appSite + ' on the site');
    fs.rmSync(site, { recursive: true, force: true });
  }
})();

console.log('site_files_tests — planted offenders (each must FAIL its check)');
const PLANTS = [
  ['L', () => checkList(text, [...top, 'secrets.txt']), 'a new top-level file nobody decided'],
  ['L', () => checkList(text + '\npublish: tests\n', top), 'a path listed twice'],
  ['L', () => checkList(text + '\nshow: app\n', top), 'a line that is neither'],
  ['M', () => checkMust(text.replace(/^publish: app$/m, 'private: app')), 'the app left off the site'],
  ['M', () => checkMust(text.replace(/^publish: google540af0b13abd3cff\.html$/m, '')), 'the Search Console proof left off'],
  ['N', () => checkNever(text.replace(/^private: tests$/m, 'publish: tests')), 'tests published'],
  ['N', () => checkNever(text.replace(/^private: PROJECT_INSTRUCTIONS\.md$/m, '')), 'the notes file undecided'],
  ['W', () => checkWorkflow(wf.split('.github/site-files.txt').join('files.txt')), 'workflow reads another list'],
  ['W', () => checkWorkflow(wf.replace(/branches: \[main\]/, 'branches: [dev]')), 'workflow not run on main'],
  ['W', () => checkWorkflow(wf.replace(/is not in the repo"; exit 1/, 'is not in the repo"')), 'a missing path no longer stops it'],
];
for (const [tag, f, what] of PLANTS) { const e = f(); ok(tag + ' catches: ' + what, !!e, 'the planted offender got through'); }

console.log('\n' + (fail ? 'FAILED' : 'PASSED') + '  —  site_files_tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
