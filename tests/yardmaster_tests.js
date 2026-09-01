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

// ── v0.9.1627: COMMIT — the cockpit's last mile (Session 88) ──
// Brad reviewed all 182 in one sitting; this lands the approved rows.
// The standing rules, in code: dated per-tab CSV BACKUPS reach the
// RailRoster Backups folder BEFORE any master write, and a backup
// failure ABORTS the commit; rows are built BY HEADER NAME against the
// target tab's own header row; a number already in master is HELD,
// never overwritten — the commit is append-only, so no existing row
// (trap rows included) can be touched; approved rows with no proposed
// tab are held and SAID; the batch is marked committed only after the
// appended counts verify.
const ym27 = src('yardmaster.js');
const cm27 = ym27.slice(ym27.indexOf('v0.9.1627: COMMIT'), ym27.indexOf('window._ymBatchOpen = function'));
// v0.9.1628 RE-PIN: the status gate moved into the dedupe — Commit is
// offered while approved rows remain, and a re-run appends only what
// the master lacks. The button and the function are the pin now.
ok('1627 the Commit button exists, gated on approved rows and a not-yet-committed batch',
   /_ymCommit/.test(ym27) && /Commit /.test(ym27) && /\(c\.approved \+ c\.edited\) > 0/.test(ym27));
ok('1627 backups land BEFORE any master write — and a failed backup ABORTS',
   cm27.indexOf('upload/drive/v3/files') > 0
   && cm27.indexOf('upload/drive/v3/files') < cm27.indexOf('sheetsAppend(MID')
   && /backup failed/i.test(cm27));
ok('1627 master rows are built BY HEADER NAME, never by fixed index',
   /_ymMasterCell/.test(cm27) && /'Item Number'/.test(cm27) && /'Year Produced'/.test(cm27)
   && /heads\.map\(function \(h\)/.test(cm27));
ok('1627 a number already in master is HELD — append-only, nothing deleted or overwritten',
   /held/i.test(cm27) && !/deleteRange|deleteDimension|clear\(/.test(cm27) && /sheetsAppend\(MID/.test(cm27));
ok('1627 approved rows with NO proposed tab are held and SAID',
   /no tab/i.test(cm27));
ok('1627 the batch is marked committed only after the counts verify',
   /committed/.test(cm27) && /verify/i.test(cm27));

// v0.9.1627(b): EDIT — Brad mid-review: "how do i change things you
// flagged?" Every row opens into an inline editor; saving writes the
// delta back to the Vault stamped 'edited', which the commit treats
// exactly like approved. The tab picker is the door for the 11
// no-gauge rows the commit would otherwise hold.
ok('1627b every row offers Edit, and saving counts as approved',
   /_ymEditOpen/.test(ym27) && /_ymEditSave/.test(ym27) && /'edited', today/.test(ym27));
ok('1627b the editor writes the delta BACK to the Vault, tab included',
   /crawl_deltas!D/.test(ym27) && /ym-ed-tab/.test(ym27));
// v0.9.1633 superseded the hardcoded pair: the picker now derives from
// config. The GUARANTEE stands — both Menards homes must still be
// reachable — asserted through the mechanism that now provides them.
const _cfg33 = src('config.js');
ok('1627b/1633 both Menards homes still reachable as commit targets (via ERA_TABS)',
   /_ymMasterTabs\(\)\.map/.test(ym27)
   && /items:\s*'Menards O'/.test(_cfg33) && /items:\s*'Menards HO'/.test(_cfg33)
   && /'menards'/.test(_cfg33.slice(_cfg33.indexOf('REAL_ERA_IDS'), _cfg33.indexOf('REAL_ERA_IDS') + 700))
   && /'menards_ho'/.test(_cfg33.slice(_cfg33.indexOf('REAL_ERA_IDS'), _cfg33.indexOf('REAL_ERA_IDS') + 700)));

// ── v0.9.1628: THE VERIFY COUNTS TRUE, AND A COMMITTED BATCH STAYS ──
// Brad's first real commit: every row LANDED, then the count check
// cried foul — it counted the header row on one side only, came up
// one short every time, and refused to mark the batch committed. The
// check was miscalibrated, not the commit. Fixed symmetric. And a
// committed batch no longer vanishes from the queue (his 3 no-tab
// rows would have been stranded): it stays, dimmed, reviewable, with
// Commit still offered while approved rows remain — safe to re-run
// because the dedupe holds everything already in master.
const ym28 = src('yardmaster.js');
const cm28 = ym28.slice(ym28.indexOf('v0.9.1627: COMMIT'), ym28.indexOf('window._ymBatchOpen = function'));
ok('1628 both sides of the verify skip the header row — symmetric at last',
   /rowsBefore = vals\.slice\(1\)\.filter/.test(cm28));
ok('1628 a commit with nothing fresh left marks the batch committed and says so',
   /already in the master/.test(cm28));
ok('1628 committed batches STAY in the queue, dimmed but reviewable',
   /!== 'dismissed'; \}\);/.test(ym28) && /u2713 committed/.test(ym28));
ok('1628 Commit stays offered while approved rows remain',
   !/b\.status !== 'committed' && \(c\.approved/.test(ym28));


// ── v0.9.1633: the commit router serves EVERY real era tab ─────
// The Menards pilot proved the cockpit; the Wayback sweeps (K-Line,
// Lionel, Weaver, MTH, LGB…) need their own tabs as commit targets.
// And the old A1:V5000 read cap would have BLINDED the dedupe on a
// 21,000-row tab (Lionel MPC-Modern) — silent duplicates. Proven to
// FAIL on the v0.9.1632 tree before the build.
const ym33 = src('yardmaster.js');
ok('1633 valid commit tabs derive from REAL_ERA_IDS + ERA_TABS — one source of truth, no second list',
   /_ymMasterTabs/.test(ym33) && /REAL_ERA_IDS\.forEach/.test(ym33) && /ERA_TABS\[id\]/.test(ym33));
ok('1633 the router no longer hardcodes the Menards pair',
   !/t === 'Menards O' \|\| t === 'Menards HO'/.test(ym33));
ok('1633 the Edit dropdown is built FROM the derived list, never typed twice',
   /_ymMasterTabs\(\)\.map/.test(ym33) && !/<option value="Menards O"/.test(ym33));
ok('1633 dedupe + verify reads are UNBOUNDED — a 21,000-row tab cannot blind the dedupe',
   !/A1:V5000/.test(ym33) && !/A1:A5000/.test(ym33) && ym33.indexOf('\'!A1:V"') >= 0 && ym33.indexOf('\'!A1:A"') >= 0);
ok('1633 the Vault delta read holds a sweep-sized queue (Q4000)',
   /crawl_deltas!A1:Q4000/.test(ym33));
ok('1633 the confirm line reports per-tab append counts',
   /perTab\.join/.test(ym33) && /totFresh/.test(ym33));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('YARDMASTER TESTS FAILING'); process.exit(1); }
console.log('ALL YARDMASTER TESTS GREEN (' + pass + ')');
