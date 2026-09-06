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
   /crawl_batches!A1:G50/.test(ym22) && /crawl_deltas!A1:[A-Z]+\d{3,}/.test(ym22));   // v1687: X12000 (was Q4000) — the two Greenberg transcriptions
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
   !/A1:V5000/.test(ym33) && !/A1:A5000/.test(ym33) && !/A1:AD\d/.test(ym33) && ym33.indexOf('\'!A1:AD"') >= 0 && ym33.indexOf('\'!A1:A"') >= 0);   // v1683: A1:V → A1:AD (Image URL lands past W)
ok('1633 the Vault delta read holds a sweep-sized queue (12,000 since v1687)',
   /crawl_deltas!A1:X12000/.test(ym33));
ok('1633 the confirm line reports per-tab append counts',
   /perTab\.join/.test(ym33) && /totFresh/.test(ym33));


// ── v0.9.1634: the commit gets its rule-#5 guard — the hard way ─
// Five stacked Commit taps during the K-Line pilot each read the
// still-clean tab (the backup upload is the slow middle) and appended
// the same 50 rows: 250 rows, repaired by hand. Also: the dedupe and
// verify reads were bare fetches — a failed read looked like an EMPTY
// tab, a second door to duplicates. And a blank item number could ride
// an Approve straight into master. Proven to FAIL on v0.9.1633.
const ym34 = src('yardmaster.js');
const cm34 = ym34.slice(ym34.indexOf('window._ymCommit ='), ym34.indexOf('window._ymBatchOpen ='));
ok('1634 commit carries an in-flight guard, set before the first await, cleared in finally',
   /_ymCommitBusy/.test(cm34) && /already running/.test(cm34) && /finally\s*\{\s*window\._ymCommitBusy = false/.test(cm34));
ok('1634 a failed dedupe read STOPS the commit instead of impersonating an empty tab',
   /gotRes\.ok/.test(cm34) && /commit stopped before any write/.test(cm34));
ok('1634 a failed verify read says rows landed, never a silent lie',
   /chkRes\.ok/.test(cm34) && /rows were appended/.test(cm34));
ok('1634 approved rows with a blank item number are HELD and said',
   /heldNoNum/.test(cm34) && /no item number/.test(cm34));

// ── v0.9.1688: Clear finished — the queue card stops hoarding ────
// Brad, 2026-09-05 evening, ten committed batches (7,197 decided rows)
// dimmed in the Office: "clean up my yardmaster office from the
// completed items." A batch is finished only when it is committed AND
// nothing is pending or deferred AND no approved row is still held
// (blank number / no real tab — the v1628 stranding case stays
// visible). Clear finished writes 'dismissed' to ONE cell per batch,
// the status cell found BY HEADER; Show N finished lists them again
// with Put back. crawl_deltas is never written by any of it.
const ym88 = src('yardmaster.js');
ok('1688 finished = committed + nothing pending/deferred + nothing held',
   /function _ymIsFinished\(b\)/.test(ym88) && /b\.status === 'committed' && !c\.pending && !c\.deferred && !_ymHeldCount\(b\)/.test(ym88));
ok('1688 held = approved rows with a blank number or a tab that is not a real master tab',
   /function _ymHeldCount\(b\)/.test(ym88) && /validTabs\.indexOf\(String\(dd\.tab \|\| ''\)\.trim\(\)\) < 0/.test(ym88));
ok('1688 Clear finished, Show/Hide finished and Put back are wired to buttons',
   /onclick="_ymClearFinished\(\)"/.test(ym88) && /onclick="_ymToggleFinished\(\)"/.test(ym88) && /onclick="_ymPutBack\(/.test(ym88)
   && /window\._ymClearFinished = (async )?function/.test(ym88) && /window\._ymToggleFinished = function/.test(ym88) && /window\._ymPutBack = function/.test(ym88));
ok('1688 the batch status column comes from the crawl_batches header, and NO status write hardcodes a column letter',
   /out\.batchStatusCol = _bcol\.status == null \? 'E'/.test(ym88) && /function _ymBatchStatusRange\(b\)/.test(ym88)
   && !/'crawl_batches!E'/.test(ym88) && (ym88.match(/range: _ymBatchStatusRange\(b\)/g) || []).length === 3);
ok('1688 one status write in flight at a time (rule #5), local copies update only after the Vault says yes',
   /_ymStatusBusy = true/.test(ym88) && /finally \{ _ymStatusBusy = false; \}/.test(ym88)
   && /if \(!r\.ok\) throw new Error\('HTTP ' \+ r\.status\);\n\s*list\.forEach\(function \(b\) \{ b\.status = status; \}\)/.test(ym88));
ok('1688 clearing never writes a VALUE into a crawl_deltas cell (v1689: the only crawl_deltas mutation is the verified archive move)',
   !/DELTAS_TAB \+ '!' \+ [^;]*values:batchUpdate/.test(ym88.slice(ym88.indexOf('v0.9.1688: clearing finished'), ym88.indexOf('v0.9.1622 → v0.9.1626: the batch review view')))
   && !/crawl_deltas!/.test(ym88.slice(ym88.indexOf('v0.9.1688: clearing finished'), ym88.indexOf('v0.9.1622 → v0.9.1626: the batch review view'))));
ok('1688 the open-queue filter of v1628 is untouched (committed batches still show until cleared)',
   /!== 'dismissed'; \}\);/.test(ym88) && /var shown = _ymShowFinished \? open\.concat\(hidden\) : open;/.test(ym88));
ok('1688 an emptied queue still offers Show N finished',
   /New sweeps land here automatically\.<\/div>' \+ qfoot/.test(ym88));

// ── v0.9.1689: the archive — decided rows leave the working tab ──
// Brad said yes to the suggestion under v1688: the Office was still
// reading all 7,197 decided rows on every open. Clear finished now also
// MOVES the decided rows of cleared batches to crawl_deltas_archive. The
// behaviour is proven for real in yardmaster_archive_tests.js (in-memory
// Vault); these pins guard the shape.
const ym89 = src('yardmaster.js');
const ar89 = ym89.slice(ym89.indexOf('async function _ymArchiveRows'), ym89.indexOf('v0.9.1622 → v0.9.1626: the batch review view'));
ok('1689 both tab names live in YM — one place', /DELTAS_TAB: 'crawl_deltas'/.test(ym89) && /ARCHIVE_TAB: 'crawl_deltas_archive'/.test(ym89));
ok('1689 the move starts from a FRESH read of the working tab, never the cached copy',
   /readVals\(YM\.DELTAS_TAB \+ '!A1:AZ'/.test(ar89) && ar89.indexOf('readVals(YM.DELTAS_TAB') < ar89.indexOf('upload/drive'));
ok('1689 backup FIRST: the CSV upload precedes the archive tab, the append and the delete',
   ar89.indexOf('upload/drive') < ar89.indexOf('addSheet') && ar89.indexOf('upload/drive') < ar89.indexOf(':append') && ar89.indexOf(':append') < ar89.indexOf('deleteDimension'));
ok('1689 the archive count must VERIFY before a single row is removed',
   /archive count did not verify/.test(ar89) && ar89.indexOf('archive count did not verify') < ar89.indexOf('deleteDimension'));
ok('1689 already-archived ids are skipped, so a half-finished move reruns without doubling up',
   /var fresh = picks\.filter\(function \(p\) \{ return !have\[p\.id\]; \}\)/.test(ar89));
ok('1689 rows are appended BY HEADER and new columns go at the END of the archive header',
   /aHeads\.map\(function \(h\) \{ var i = heads\.indexOf\(h\)/.test(ar89) && /aHeads = aHeads\.concat\(missing\)/.test(ar89));
ok('1689 deletes go highest row first, as contiguous runs',
   /sort\(function \(a, b\) \{ return b - a; \}\)/.test(ar89) && /if \(rr === lo - 1\) \{ lo = rr; continue; \}/.test(ar89));
ok('1689 pending and deferred rows never move, whatever batch they sit in',
   /st !== 'pending' && st !== 'deferred'\) picks\.push/.test(ar89));
ok('1689 one archive in flight at a time; a stopped archive SAYS why',
   /_ymArchiveBusy = true/.test(ar89) && /finally \{ _ymArchiveBusy = false; \}/.test(ar89) && /showToast\('Archive stopped: ' \+ why/.test(ar89) && /the connection dropped/.test(ar89));   // raw browser errors are never shown (§198)
ok('1689 Clear finished asks once, then dismisses, then archives, then RELOADS (cached row numbers are stale after a move)',
   /title: 'Clear finished batches'/.test(ym89) && /await _ymSetBatchStatus\(list, 'dismissed', ''\)/.test(ym89)
   && /await _ymArchiveRows\(_ymDismissedIds\(\)\)/.test(ym89) && /_ymReload\(\);\n  \};\n  window\._ymArchiveLeftovers/.test(ym89));
ok('1689 leftovers of an earlier clear get their own Archive N rows button', /onclick="_ymArchiveLeftovers\(\)"/.test(ym89) && /window\._ymArchiveLeftovers = async function/.test(ym89));
ok('1689 deltas are numbered BEFORE the blank-id filter (a blank row can no longer shift every sheetRow below it)',
   /d\.crawlDeltas\.slice\(1\)\.map\(function \(r, i\) \{ r\._sheetRow = i \+ 2; return r; \}\)\n\s*\.filter\(function \(r\) \{ return g\(r, 'delta_id'\); \}\)/.test(ym89) && /sheetRow: r\._sheetRow, batch:/.test(ym89));
ok('1689 verdicts AND edits check the row still carries their delta_id before writing',
   /async function _ymRowsStillMatch\(list\)/.test(ym89)
   && /window\._ymApplyVerdicts = async function \(pairs, recordUndo\) \{\n\s*if \(!_isOwner\(\) \|\| !pairs\.length\) return;\n\s*if \(!\(await _ymRowsStillMatch\(/.test(ym89)
   && /if \(!\(await _ymRowsStillMatch\(\[dd\]\)\)\) return;/.test(ym89));
ok('1689 a mismatch writes nothing, reloads to the same view, and says so',
   /catch \(e\) \{ bad = list; \}/.test(ym89) && /queue changed underneath this screen/.test(ym89) && /function _ymReload\(\)/.test(ym89) && /if \(_ymBatchId\) window\._ymBatchOpen\(_ymBatchId, true\); else window\.ymBuildPage\(false\);/.test(ym89));
ok('1689 every header→column-letter answer goes through _ymColLetter (AA-safe)',
   /function _ymColLetter\(i\)/.test(ym89) && !/String\.fromCharCode\(65 \+ _/.test(ym89) && (ym89.match(/_ymColLetter\(/g) || []).length >= 4);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('YARDMASTER TESTS FAILING'); process.exit(1); }
console.log('ALL YARDMASTER TESTS GREEN (' + pass + ')');
