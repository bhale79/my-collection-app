// ══ tests/press_fixes_tests.js ═════════════════════════════════════════════
//
// v0.9.1710 (Session 94). What Sweep 2 of the silent-control audit fixed,
// pinned — by RUNNING the real app headless with Google unreachable, the way
// the sweep found them (tests/press-audit.js; PRESS_AUDIT_SWEEP2_2026-09-10.md).
//
//   A1  Reports → Want / Upgrade / Parts → Preview FROZE the app when the
//       parts read failed: the failure handler re-rendered, the re-render
//       read again, the read failed again — ~2,900 times a second, forever.
//       Now: one failed read, "Parts couldn't be loaded — Retry", and only a
//       person starts another.
//   A2  "Sync from Sheet" wiped the collection BEFORE reading; when the read
//       failed there was nothing to keep, the empty result was cached, and
//       the toast said "✓ Synced". Now the collection is unchanged, the cache
//       is not rewritten with less than it had, and the toast says what
//       happened.
//   B1–B3  Back Up Now, the inbox's Refresh and the photo-folder link blamed
//       "your connection" for a sign-in problem. One shared rule
//       (rrIsSignInError) words all three; a repeat Refresh is now visible.
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');

// ── source pins (cheap, run first) ────────────────────────────────────────
section('A1 — the parts read cannot loop (source)');
const rep = rd('reports.js'), lib = rd('report-library.js');
ok('a failed read is remembered in ONE flag', /var _wupPartsFailed = false;/.test(rep), '');
ok('the failure branch sets it — and the automatic re-render sees it before it would read again',
   /_wupPartsFailed=true;/.test(rep) && /if \(!state\.partsData && _wupPartsFailed\) \{/.test(rep), '');
ok('…and draws "Parts couldn\'t be loaded" with a Retry button instead of "Loading parts…"',
   /Parts couldn\\u2019t be loaded/.test(rep) && /onclick="_wupRetryParts\(\)"/.test(rep), '');
ok('only a person clears the flag: Retry, a section button, or opening the report',
   /function _wupRetryParts\(\)\{ _wupPartsFailed = false; buildReport\(\); \}/.test(rep) &&
   /function _setWupView\(v\)\{ _wupView = v; _wupPartsFailed = false; buildReport\(\); \}/.test(rep) &&
   /function _repPreview\(id\) \{[\s\S]{0,400}_wupPartsFailed = false;/.test(lib), '');
ok('the old "leaving unloaded so the next render retries" comment — the loop\'s own description — is gone', !/so the next render retries/.test(rep), '');

section('A2 — Sync from Sheet keeps the collection when the read fails (source)');
const app = rd('app.js'), data = rd('app-data.js');
const frd = app.slice(app.indexOf('async function forceRefreshData()'), app.indexOf('async function forceRefreshData()') + 3500);
ok('the loader reports the result of THIS load', /window\._plLastFailed = _plFailed;/.test(data), '');
ok('forceRefreshData no longer wipes the five stores before reading',
   !/state\.personalData = \{\};\s*\n\s*state\.soldData = \{\};/.test(frd) && /const _before = \{ personal: state\.personalData/.test(frd), '');
ok('…the cache is only dropped and rewritten AFTER a clean read',
   frd.indexOf("localStorage.removeItem('lv_personal_cache')") > frd.indexOf('if (window._plLastFailed) {'), '');
ok('…a failed read puts every store back and says so, and never says ✓ Synced',
   /state\.personalData = _before\.personal; state\.soldData = _before\.sold;/.test(frd) &&
   /your collection is unchanged/.test(frd) && frd.indexOf("showToast('✓ Synced from Google Sheet')") > frd.indexOf('return;'), '');

section('B1–B3 — one rule for "signed out" (source)');
const wo = rd('write-outbox.js');
ok('rrIsSignInError exists, is exported, and knows the backup\'s wording ("Sign in to …")',
   /function rrIsSignInError\(err\)/.test(wo) && /window\.rrIsSignInError = rrIsSignInError;/.test(wo) && /Sign in to\\b/.test(wo), '');
const saveErrBody = wo.slice(wo.indexOf('function rrSaveError('), wo.indexOf('window.rrSaveError = rrSaveError;'));
ok('rrSaveError uses it (one rule, not a second regex of its own)', /if \(rrIsSignInError\(raw\)\) \{/.test(saveErrBody) && !/Not signed in\|Token required/.test(saveErrBody), '');
ok('the photo-folder link asks it', /rrIsSignInError\(e\)\)\s*\n?\s*\? 'You\\u2019re signed out \\u2014 sign in to open your photo folder'/.test(rd('prefs.js')), '');
const pin = rd('photo-inbox.js');
ok('the inbox refresh asks it', /rrIsSignInError\(e\)\)\s*\n?\s*\? 'You\\u2019re signed out \\u2014 sign in to load the inbox\.'/.test(pin), '');
ok('…and lets "Loading inbox…" be seen for ~400ms before a fast failure replaces it, unless a newer refresh started',
   /var _rfWait = Math\.max\(0, 400 - \(Date\.now\(\) - _rfStart\)\);/.test(pin) && /if \(window\._pinRefreshSeq === _rfSeq\) _status\(_rfMsg\);/.test(pin), '');

// ── behaviour: the real app, headless, Google unreachable ─────────────────
let chromium = null;
try { chromium = require('playwright').chromium; } catch (e) {}
if (!chromium) {
  console.log('\n  SKIP  behaviour pins — playwright is not installed here (npm install)');
  console.log('\n  ' + pass + ' passed, ' + fail + ' failed  —  6 SKIPPED: behaviour pins need playwright');
  process.exit(fail ? 1 : 0);
}
const { SEED } = require('./lib/guide-fixture');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
    for (const u of ['**://accounts.google.com/**', '**://apis.google.com/**', '**://*.googleapis.com/**', '**://cdnjs.cloudflare.com/**', '**://*.google.com/**', '**://fonts.gstatic.com/**'])
      await ctx.route(u, r => r.abort());
    const page = await ctx.newPage();
    let partsFailures = 0;
    page.on('console', m => { if (/parts read failed/.test(m.text())) partsFailures++; });
    await page.goto('file://' + APP + '/index.html'); await page.waitForTimeout(2200);
    await page.evaluate(SEED); await page.waitForTimeout(500);
    await page.evaluate(() => { window.__t = []; const o = window.showToast; window.showToast = function (m) { window.__t.push(String(m)); return o.apply(this, arguments); }; });
    const toasts = () => page.evaluate(() => window.__t.splice(0));
    const booted = await page.evaluate(() => !!(window.state && state.masterData && state.masterData.length && typeof forceRefreshData === 'function'));
    ok('the app boots headless with the synthetic collection', booted, '');

    section('A1 — behaviour');
    await page.evaluate(() => { showPage('reports', null); }); await page.waitForTimeout(400);
    const previewed = await Promise.race([
      page.evaluate(() => { _repPreview('wantupgrade'); return true; }),
      new Promise(r => setTimeout(() => r(false), 8000)),
    ]);
    ok('Preview on Want / Upgrade / Parts returns (it used to never come back)', previewed === true, '');
    await page.waitForTimeout(2000);
    ok('with the read failing, exactly ONE read was attempted in two seconds (was ~5,800)', partsFailures === 1, String(partsFailures));
    const rows = await page.evaluate(() => Array.from(document.querySelectorAll('tbody tr')).map(r => r.innerText.replace(/\s+/g, ' ').trim()).filter(r => /Parts|Retry/.test(r)));
    ok('the report says "Parts couldn\'t be loaded" and offers Retry', rows.some(r => /Parts couldn.t be loaded/.test(r)) && rows.some(r => /Retry/.test(r)), rows.join(' | ').slice(0, 120));
    const clicked = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Retry' && b.offsetParent); if (b) { b.click(); return true; } return false; });
    await page.waitForTimeout(1500);
    ok('Retry makes exactly one more attempt, then stops again', clicked && partsFailures === 2, String(partsFailures));

    section('A2 — behaviour');
    const before = await page.evaluate(() => ({ owned: Object.keys(state.personalData || {}).length, want: Object.keys(state.wantData || {}).length, upg: Object.keys(state.upgradeData || {}).length }));
    await page.evaluate(() => { showPage('dashboard', null); }); await page.waitForTimeout(300);
    await toasts();
    await page.evaluate(() => forceRefreshData()); await page.waitForTimeout(1500);
    const after = await page.evaluate(() => ({ owned: Object.keys(state.personalData || {}).length, want: Object.keys(state.wantData || {}).length, upg: Object.keys(state.upgradeData || {}).length,
      card: (document.getElementById('dash-card-0') || { innerText: '' }).innerText.replace(/\s+/g, ' ').slice(0, 30),
      cachedOwned: (function () { try { const c = JSON.parse(localStorage.getItem('lv_personal_cache') || 'null'); return c ? Object.keys(c.personalData || {}).length : null; } catch (e) { return -1; } })() }));
    const said = await toasts();
    ok('with the read failing, the collection on screen is unchanged (was wiped to 0)', before.owned > 0 && after.owned === before.owned && after.want === before.want && after.upg === before.upg, JSON.stringify({ before, after }));
    ok('…the dashboard still shows the items', new RegExp('ITEMS I OWN ' + before.owned).test(after.card), after.card);
    ok('…the local cache does not hold less than the collection had', after.cachedOwned === null || after.cachedOwned === before.owned, String(after.cachedOwned));
    ok('…it never says "✓ Synced", and it says the collection is unchanged', !said.some(s => /Synced from Google Sheet/.test(s)) && said.some(s => /your collection is unchanged/.test(s)), said.join(' | ').slice(0, 160));

    section('B1–B3 — behaviour');
    await page.evaluate(() => { showPage('prefs', null); buildPrefsPage(); }); await page.waitForTimeout(300); await toasts();
    await page.evaluate(() => uiBackupNow()); await page.waitForTimeout(800);
    const b1 = await toasts();
    ok('B1 Back Up Now, signed out: the toast names sign-in, not "Please try again"', b1.some(s => /signed out\. Sign in again/.test(s)) && !b1.some(s => /Please try again/.test(s)), b1.join(' | '));
    await page.evaluate(() => _prefsOpenPhotosFolder()); await page.waitForTimeout(800);
    const b3 = await toasts();
    ok('B3 photo-folder link, signed out: names sign-in, not the connection', b3.some(s => /signed out .* sign in to open your photo folder/.test(s)) && !b3.some(s => /check your connection/.test(s)), b3.join(' | '));
    await page.evaluate(() => { window._pinGo(document.getElementById('nav-photo-inbox')); }); await page.waitForTimeout(1200);
    const status = () => page.evaluate(() => (document.body.innerText.match(/(You.re signed out[^\n]*|Could not load the inbox[^\n]*|Loading inbox…)/) || [''])[0]);
    ok('B2 inbox, signed out: the status names sign-in', /signed out .* sign in to load the inbox/.test(await status()), await status());
    await page.evaluate(() => window._pinRefresh()); await page.waitForTimeout(150);
    const mid = await status(); await page.waitForTimeout(600); const end = await status();
    ok('B2 a repeat Refresh is SEEN: "Loading inbox…" first, then the reason', /Loading inbox/.test(mid) && /signed out/.test(end), mid + ' → ' + end);
  } finally {
    await browser.close();
  }
  console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL  harness threw: ' + e.message); console.log('\n  ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
