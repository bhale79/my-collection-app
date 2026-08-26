// ═══════════════════════════════════════════════════════════════
// yardmaster_tests.js — Session 86. The heartbeat + the Office.
//
// Brad: "how many people actually use the app?" and "I need something
// like an admin page that will help me keep track of everything."
// v0.9.1580 ships both halves the relay (v3.7/v3.8) already serves:
// the once-a-day anonymous heartbeat, and the owner-only Yardmaster's
// Office page (queues, chores, usage — the Monday digest's twin view).
//
// Run:  node tests/yardmaster_tests.js
// Proven to FAIL on the v0.9.1579 tree before the build.
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
function src(f) { return fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8'); }
function maybe(f) { try { return src(f); } catch (e) { return ''; } }

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

// ── the heartbeat (vault.js) ─────────────────────────────────────
const vault = src('vault.js');
ok('the heartbeat exists in vault.js (beside vaultPost, its one transport)',
   /function _rrHeartbeat/.test(vault));
ok('…it fires at most once per device per day (lv_hb_day guard)',
   /lv_hb_day/.test(vault) && /getItem\('lv_hb_day'\)\s*===\s*today\)\s*return/.test(vault));
ok('…the day is marked ONLY on a confirmed ok — a failed ping retries next load',
   /r\s*&&\s*r\.ok\)\s*\{\s*try\s*\{\s*localStorage\.setItem\('lv_hb_day'/.test(vault));
ok('…it posts action heartbeat with the app version and NOTHING else',
   /action:\s*'heartbeat',\s*v:\s*\(typeof APP_VERSION/.test(vault)
   && !/heartbeat[\s\S]{0,300}(email|token|state\.user)/.test(vault.slice(vault.indexOf('_rrHeartbeat'))));
ok('…it waits for the app shell before pinging (no race with boot)',
   /_rrHeartbeatBoot/.test(vault) && /classList\.contains\('active'\)/.test(vault.slice(vault.indexOf('_rrHeartbeatBoot'))));

// ── the Office (yardmaster.js) ───────────────────────────────────
const ym = maybe('yardmaster.js');
ok('yardmaster.js exists', ym.length > 1000);
ok('the gate: BOTH owner emails, checked against the signed-in user',
   /bhale@ipd-llc\.com/.test(ym) && /support@therailroster\.com/.test(ym)
   && /state\.user\s*&&\s*String\(state\.user\.email/.test(ym));
ok('a non-owner gets NOTHING — injection refuses before touching the DOM',
   /_ymInjectUI\(\)\s*\{\s*if\s*\(!_isOwner\(\)\)\s*return false/.test(ym));
ok('…and the boot poller stands down for good on a signed-in non-owner',
   /if\s*\(!_isOwner\(\)\)\s*\{\s*clearInterval\(t\);\s*return;\s*\}/.test(ym));
ok('self-contained: injects its own page div, sidebar item, and account-menu entry',
   /page-yardmaster/.test(ym) && /nav-yardmaster-btn/.test(ym) && /menu-yardmaster-btn/.test(ym));
ok('it reads the Vault in ONE batchGet with the owner token',
   /values:batchGet/.test(ym) && /Bearer ' \+ window\.accessToken/.test(ym));
ok('queue counts follow the digest\u2019s rules (in_master no/false; status not promoted/rejected)',
   /'no'\s*\|\|\s*v\s*===\s*'false'/.test(ym)
   && /'promoted'\s*&&\s*v\s*!==\s*'rejected'/.test(ym));
ok('Mark done writes ONLY that row\u2019s last_done cell (chores!C<row>)',
   /'chores!C'\s*\+\s*row/.test(ym) && !/chores!A/.test(ym.slice(ym.indexOf('_ymChoreDone'), ym.indexOf('_ymChoreDone') + 800)));
ok('columns are found BY HEADER NAME, never by fixed index',
   /_colIdx\(/.test(ym) && /indexOf\(name\)/.test(ym));
ok('zero hardcoded hex — theme vars only (the color ratchet stays flat)',
   !/#[0-9a-fA-F]{3,6}\b/.test(ym.replace(/https?:\/\/[^\s'"]+/g, '')));

// ── wiring ───────────────────────────────────────────────────────
const html = src('index.html');
ok('index.html loads yardmaster.js with a ?v= like every other file',
   /<script src="\.\/yardmaster\.js\?v=\d+"><\/script>/.test(html));
ok('…as a delete-one-line feature beside the Dispatch Board',
   html.indexOf('yardmaster.js') > html.indexOf('dispatch-board.js'));
const sw = src('sw.js');
ok('sw.js precaches yardmaster.js (the S85 offline-app lesson)',
   /'\.\/yardmaster\.js'/.test(sw));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('YARDMASTER TESTS FAILING'); process.exit(1); }
console.log('ALL YARDMASTER TESTS GREEN (' + pass + ')');
