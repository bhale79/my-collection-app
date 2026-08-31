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

// ── v0.9.1622: THE REVIEW QUEUE, READ-ONLY FIRST HOP (Session 88) ──
// Task #36's front door opens: crawl batches land in Vault tabs
// (crawl_batches / crawl_deltas, seeded S88 with the 182 retired
// Menards) and the Office shows them — batch card with progress
// counts, a review list with flags and Wayback research links.
// Verdict buttons are the NEXT release; commit the one after.
const ym22 = src('yardmaster.js');
ok('1622 the Vault read now includes the crawl queue tabs',
   /crawl_batches!A1:G50/.test(ym22) && /crawl_deltas!A1:Q400/.test(ym22));
ok('1622 the queue card exists and counts what is waiting',
   /Catalog review queue/.test(ym22) && /pending/.test(ym22));
ok('1622 a batch opens into a review list with a back door',
   /_ymBatchOpen/.test(ym22) && /_ymBatchBack/.test(ym22));
ok('1622 flagged candidates SAY why (the sweep\u2019s 46 warnings survive)',
   /flag/.test(ym22) && /_ymBatchFilter/.test(ym22));
// v0.9.1625 RE-PIN: "Research" split into Google (primary — the Wayback
// bodies are shells) + Archive (secondary). The behavior pinned here is
// that every candidate still carries an outbound research door.
ok('1622 every candidate carries its Research link (the Wayback snapshot)',
   /google\.com\/search/.test(ym22) && /rel="noopener"/.test(ym22));
ok('1622 read-only is SAID, not implied — verdicts are the next release',
   /read-only/i.test(ym22));
ok('1622 delta columns are found BY HEADER NAME, never fixed index',
   /_colIdx\(d\.crawlDeltas/.test(ym22) || /_dcol/.test(ym22));
ok('1622 still zero hardcoded hex in yardmaster.js',
   !/#[0-9a-fA-F]{3,6}\b/.test(ym22.replace(/&#39;/g, '')));

// ── v0.9.1625: VERDICTS + a list Brad can read (Session 88, his three) ──
// (1) "can't read it cause the background comes through" — the batch view
// now lives on a solid card like every other Office panel. (2) "i can't
// do anything but research it" — Approve / Reject / Defer per row, saved
// to the Vault the moment they're tapped (tap again to change your mind),
// plus Approve-all-clean. (3) "all i get is the second upload" — the
// Wayback bodies are shells, so Research leads with a Google search
// built from the item itself; the Archive link stays secondary.
const ym25 = src('yardmaster.js');
const bo25 = ym25.slice(ym25.indexOf('window._ymBatchOpen'), ym25.indexOf('// ── Injection'));
ok('1625 the review list sits on a SOLID card — no watermark bleed-through',
   /background:var\(--surface2\);border:1px solid var\(--border\);border-radius:12px/.test(bo25)
   && /\+ rows \+ '<\/div>'/.test(bo25), '');
ok('1625 every row offers Approve / Reject / Defer',
   /vbtn\(dd, 'approved', 'Approve'\)/.test(ym25) && /vbtn\(dd, 'rejected', 'Reject'\)/.test(ym25)
   && /vbtn\(dd, 'deferred', 'Defer'\)/.test(ym25));
ok('1625 a verdict lands in the Vault the moment it is tapped (one batch write)',
   /_ymVerdict/.test(ym25) && /values:batchUpdate/.test(ym25));
ok('1625 tapping the same verdict again returns the row to pending',
   /=== cur \? 'pending'/.test(ym25) || /same verdict again/.test(ym25));
ok('1625 the clean rows can be approved in ONE tap',
   /Approve all clean/.test(ym25));
ok('1625 Research leads with Google; the Archive shell is secondary',
   /google\.com\/search/.test(ym25) && />Archive</.test(ym25));
ok('1625 read-only wording is GONE from the batch view',
   !/verdict buttons arrive in the next release/.test(ym25));

// ── v0.9.1626: THE REVIEW FLOW LEARNS BRAD'S RHYTHM (Session 88) ──
// "everytime i select something it shoots me back to the top" — a
// verdict repaint keeps the scroll; only OPENING a batch goes to the
// top. "once i approve or reject it, it should be removed" — decided
// rows leave the working views; a Decided chip holds them for second
// thoughts. And an Undo-last button sits right of Approve-all-clean,
// reversing the last action — a bulk approve included.
const ym26 = src('yardmaster.js');
ok('1626 a verdict repaint KEEPS the scroll — only opening a batch goes to top',
   /_ymBatchOpen = function \(id, keepScroll\)/.test(ym26) && /if \(!keepScroll\)/.test(ym26)
   && /_ymBatchOpen\(_ymBatchId, true\)/.test(ym26));
ok('1626 decided rows leave the working views',
   /'pending'\) === 'pending'/.test(ym26.slice(ym26.indexOf('window._ymBatchOpen'))));
ok('1626 …and live under a Decided chip for second thoughts',
   /chip\('decided'/.test(ym26));
ok('1626 Undo sits beside Approve-all-clean and reverses the LAST action',
   /_ymUndoLast/.test(ym26) && /Undo last/.test(ym26)
   && ym26.indexOf('_ymUndoLast') > 0 && /_ymUndoStack/.test(ym26));
ok('1626 undo restores each row\u2019s PREVIOUS verdict — a bulk approve included',
   /prev/.test(ym26.slice(ym26.indexOf('_ymUndoStack'), ym26.indexOf('_ymUndoStack') + 2500)));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('YARDMASTER TESTS FAILING'); process.exit(1); }
console.log('ALL YARDMASTER TESTS GREEN (' + pass + ')');
