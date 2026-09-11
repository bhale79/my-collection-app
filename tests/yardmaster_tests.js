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
   && !/'crawl_batches!E'/.test(ym88) && (ym88.match(/range: _ymBatchStatusRange\(b\)/g) || []).length >= 3);   // v1694: the barcode commit added two more
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

// ── v0.9.1694: the Office plumbing (S89 carried #4 and #6) ────────
// Submissions and barcode pairings join the review queue through ONE
// button; a barcode commit is the cockpit's first edit of a live master
// row, kept to one guarded cell. Behaviour is proven for real in
// yardmaster_archive_tests.js §8–10; these pin the shape.
const ym94 = src('yardmaster.js');
const q94 = ym94.slice(ym94.indexOf('v0.9.1694: QUEUE INTO REVIEW'), ym94.indexOf('v0.9.1627: COMMIT'));
const c94 = ym94.slice(ym94.indexOf('async function _ymCommitBarcodes'), ym94.indexOf('async function _ymStampPairs'));
ok('1694 the card splits the held count into need-a-tab / need-a-number', /function _ymHeldSplit\(b\)/.test(ym94) && /need a tab/.test(ym94) && /need a number/.test(ym94));
ok('1694 the batch view has a Held filter that lists exactly the uncommittable approved rows', /_ymFilter === 'held' \? heldRows/.test(ym94) && /function _ymIsHeldRow\(dd, validTabs\)/.test(ym94));
ok('1694 one Queue button, wired, guarded by a busy flag', /onclick="_ymQueueWaiting\(\)"/.test(ym94) && /window\._ymQueueWaiting = async function/.test(q94) && /_ymQueueBusy = true;/.test(q94) && /finally \{ _ymQueueBusy = false; \}/.test(q94));
ok('1694 two ROLLING batches with fixed ids, reopened when new rows arrive', /SUBS_BATCH = 'CB-COMMUNITY-SUBS', PAIRS_BATCH = 'CB-BARCODE-PAIRS'/.test(ym94) && /a rolling batch reopens when new rows arrive/.test(q94));
ok('1694 a maker maps to a tab only when it has exactly ONE — otherwise the row is flagged, never guessed (v1714: the flag says WHY — has several / no tab yet)',
   /return tabs\.length === 1 \? tabs\[0\] : '';/.test(ym94) && /_ymShapeFlag\(_ymPreSortReasons\(\{ maker: s\.mfr, num: s\.num, desc: s\.desc/.test(q94) && /if \(!flag\.length && !tab\) flag\.push\(_ymNoTabFlag\(maker\)\);/.test(ym94)
   && /' has several' : 'needs a tab \\u2014 no tab yet for ' \+ m;/.test(ym94));
ok('1694 deltas land BEFORE the source rows are stamped (a stamp without a row would lose the item)', q94.indexOf(':append?valueInputOption=RAW') < q94.indexOf("values: [['queued']]"));
ok('1694 source stamps are by header-derived column + the row the delta carries in its notes', /subInMasterCol/.test(ym94) && /pairStatusCol/.test(ym94) && /submissions row ' \+ s\.row/.test(q94) && /barcode_pairs row ' \+ p\.row/.test(q94));
ok('1694 a barcode batch takes its own commit path; a MIXED batch refuses to commit', /approved\.every\(function \(dd\) \{ return dd\.action === 'barcode'; \}\)/.test(ym94) && /mixes barcode rows with catalog rows/.test(ym94));
ok('1694 barcode commit: only the UPC / Barcode column, found by header', /heads\.indexOf\('UPC \/ Barcode'\)/.test(c94) && !/upcIdx = \d/.test(c94));
ok('1694 barcode commit: empty-or-equal only — a different UPC on the row is HELD', /if \(cur && cur !== dd\._upc\) \{ heldDifferent\.push\(dd\); return; \}/.test(c94));
ok('1694 barcode commit: the Item Number is RE-READ at the row right before the write; a mismatch holds', /values:batchGet\?' \+ ranges/.test(c94) && /if \(seen\[i\] !== String\(x\.dd\.num\)\.trim\(\)\) \{ heldNotFound\.push\(x\.dd\); return; \}/.test(c94));
ok('1694 barcode commit: backup FIRST, then the header cell (END of the row) if the column is missing, then the cells', c94.indexOf('upload/drive') < c94.indexOf("[['UPC / Barcode']]") && c94.indexOf("[['UPC / Barcode']]") < c94.indexOf('values:batchUpdate\', { method: \'POST\', headers: H, body: JSON.stringify({ valueInputOption: \'RAW\', data: data })'));
ok('1694 barcode commit: one write per cell, never a whole row', /values: \[\[x\.dd\._upc\]\]/.test(c94) && !/_ymMasterCell/.test(c94));
ok('1694 barcode commit: rule #5 guard shared with the append commit', /window\._ymCommitBusy = true;/.test(c94) && /finally \{ window\._ymCommitBusy = false; \}/.test(c94));
ok('1694 the pairs tab is stamped promoted only for rows that actually landed (or were already there)', /if \(dd\._done\) data\.push/.test(ym94) && /if \(now !== 'queued'\) return;/.test(ym94));
ok('1694 the submissions tab is stamped yes / rejected after ITS batch commits, only rows this queue marked', /if \(b\.id === SUBS_BATCH\) await _ymStampSubmissions\(H\);/.test(ym94) && (ym94.match(/if \(now !== 'queued'\) return;/g) || []).length === 2);

// v0.9.1695: the queue reads the WHOLE submissions tab and dedupes against the master at queue time
const ym95 = src('yardmaster.js');
ok('1695 the queue tabs are read unbounded (the A1:L1000 cap hid 885 waiting rows)', /'submissions!A1:L', 'barcode_pairs!A1:I'/.test(ym95) && !/submissions!A1:L1000/.test(ym95));
ok('1695 a submission already in the master is stamped yes, never queued; a failed master read stops the queue', /if \(k && inMaster\[k\]\) \{ stampYes\.push\(s\.row\); return false; \}/.test(ym95) && /could not read the master item numbers/.test(ym95));
ok('1695 the same maker+number+variation filed twice queues ONCE and both rows are stamped', /if \(k && seenSub\[dk\]\) \{ stampSubs\.push\(s\.row\); return false; \}/.test(ym95));

// ── v0.9.1712 (Session 95): a flag is a NOTE or a CHECK ───────────────────
// Brad: "when it says 'maker still lists it — may not be retired', why does
// this matter? … If I google it and it shows up as a real item, it should be
// in the list." The retired-maker sweeps wrote notes about the RETIRED label
// and the queue painted them red. Now only a CHECK ("I couldn't confirm this
// exists or what it is") counts as flagged; a NOTE rides along in grey and
// the row is clean. And: one tap approves or rejects every pending row that
// carries the same flag.
const cfg12 = src('config.js'), ym12 = src('yardmaster.js');
const vm12 = require('vm');
const _a12 = cfg12.indexOf('const RR_FLAG_NOTES'), _b12 = cfg12.indexOf('\n}\n', cfg12.indexOf('function rrFlagKind')) + 3;
const k12 = {};
vm12.runInNewContext(cfg12.slice(_a12, _b12) + ';this.k = rrFlagKind; this.notes = RR_FLAG_NOTES;', k12);
ok('1712 rrFlagKind lives in config.js (ONE list to edit) and is exported', typeof k12.k === 'function' && /window\.rrFlagKind\s*=\s*rrFlagKind/.test(cfg12) && /window\.RR_FLAG_NOTES\s*=\s*RR_FLAG_NOTES/.test(cfg12));
ok('1712 an empty flag is neither', k12.k('') === '' && k12.k(null) === '');
ok('1712 the two sweep phrases Brad asked about are NOTES', k12.k('maker still lists it — may not be retired') === 'note' && k12.k('EU market item') === 'note');
ok('1712 the Kato feed’s phrases are NOTES (1,592 of 2,640 rows say "Kato still sells it")',
   ['Kato still sells it', 'no photo on site', 'no price shown', 'filed to Kato N by default', 'Kato lists it under BOTH N and HO — works with either', 'no category on the site — filed as a part', '009 narrow gauge (Kato UK range)'].every(f => k12.k(f) === 'note'));
ok('1712 several notes joined by ";" are still a NOTE', k12.k('Kato still sells it; no photo on site; no price shown') === 'note');
ok('1712 a doubt about existence or identity is a CHECK',
   ['inferred — verify', 'no record found anywhere', 'needs a tab — Lionel has several', 'needs a number', 'UPC looks wrong', 'suspected misread SKU', 'ALREADY IN MASTER — reject?'].every(f => k12.k(f) === 'check'));
ok('1712 a flag that asks for eyes ("check" / "verify" / "?") is a CHECK even when it also says a note phrase',
   k12.k('type guessed — check') === 'check' && k12.k('scale not found — check') === 'check' && k12.k('looks like a part but its category is not Parts — check') === 'check');
ok('1712 …but the same phrase without the ask is a NOTE (Marx / Greenberg "type guessed")', k12.k('type guessed') === 'note');
ok('1712 a note joined to a check is a CHECK (one doubt is enough)', k12.k('no record found anywhere; maker still lists it') === 'check');
ok('1712 a phrase the list has never seen is a CHECK, never a free pass', k12.k('something brand new') === 'check');
ok('1712 the crawl-brief convention: "note: …" is always a NOTE', k12.k('note: sold only through club stores') === 'note');
ok('1712 the Office asks config for the kind and falls back to CHECK if config is missing (the old, stricter rule)',
   /function _ymFlagKind\(dd\) \{[\s\S]{0,200}typeof rrFlagKind === 'function'\) \? rrFlagKind\(dd\.flag\) : 'check'/.test(ym12));
ok('1712 "flagged" means CHECK rows only; "clean" is everything that is not a check', /var flagged = pend\.filter\(_ymIsCheck\);/.test(ym12) && /_ymFilter === 'clean' \? pend\.filter\(function \(dd\) \{ return !_ymIsCheck\(dd\); \}\)/.test(ym12));
ok('1712 Approve all clean takes rows that carry only a note', /return dd\.batch === _ymBatchId && !_ymIsCheck\(dd\) && \(dd\.status \|\| 'pending'\) === 'pending';/.test(ym12) && !/!dd\.flag && \(dd\.status/.test(ym12));
ok('1712 a check is drawn red with ⚠, a note grey with ⓘ', /kind === 'check'\s*\?\s*'<div style="' \+ extra \+ 'color:var\(--accent\)">\\u26a0 '/.test(ym12) && /color:var\(--text-dim\)">\\u24d8 '/.test(ym12));
ok('1712 the chip says what it is now: "Needs a look" + a clean count that shows how many carry notes', /Needs a look \(' \+ flagged\.length/.test(ym12) && /' with notes'/.test(ym12));
ok('1712 the per-flag strip: distinct flags, PENDING counts, Approve all / Reject all each', /var _flagStrip = function \(items\)/.test(ym12) && /if \(!dd\.flag \|\| \(dd\.status \|\| 'pending'\) !== 'pending'\) return;/.test(ym12) && /Approve all ' \+ g\.n/.test(ym12) && /Reject all ' \+ g\.n/.test(ym12));
ok('1712 …shown on the To review, Needs a look and Clean tabs (not Decided / Held)', /\(_ymFilter === 'all' \|\| _ymFilter === 'flagged' \|\| _ymFilter === 'clean'\) \? _flagStrip\(list\) : ''/.test(ym12));
ok('1712 _ymVerdictFlag acts on this batch’s PENDING rows with EXACTLY that flag text, confirms first, and goes through _ymVerdictMany (so Undo works)',
   /window\._ymVerdictFlag = function \(flagText, status\)/.test(ym12) && /String\(dd\.flag \|\| ''\) === want && \(dd\.status \|\| 'pending'\) === 'pending'/.test(ym12) && /appConfirm\(q, \{ title: verb \+ ' by flag'/.test(ym12) && /var go = function \(\) \{ window\._ymVerdictMany\(rows, status\); \};/.test(ym12));
ok('1712 the flag text is JS-escaped BEFORE it is HTML-escaped for the onclick (an entity would decode back into a bare quote)', /ke = _esc\(k\.replace\(\/\\\\\/g, '\\\\\\\\'\)\.replace\(\/'\/g, "\\\\'"\)\)/.test(ym12));
ok('1712 the stale "Read-only for now" line is gone from the Office', !/Read-only for now/.test(ym12));
ok('1712 no hex colours were introduced', !/#[0-9a-fA-F]{3,6}\b/.test(ym12.slice(ym12.indexOf('function _ymFlagKind'), ym12.indexOf('function _ymIsFinished'))) && !/#[0-9a-fA-F]{6}\b/.test(ym12.slice(ym12.indexOf('var _flagLine'), ym12.indexOf('var rows = list.map'))));

// ── v0.9.1713 (Session 96): who is using the app — beta testers only ──────
// Brad: "I want names/emails of who used the app, opens in the past week and
// in total … this is just for Beta people … only for the beta people after
// launch." Relay v4.0 keeps the count on each tester's beta_testers row; the
// Office reads that tab (added at the END of the batchGet) and sums a 14-day
// ledger into "last 7 days". Nobody outside beta_testers is recorded.
const ym13 = src('yardmaster.js'), vault13 = src('vault.js');
const privacy13 = fs.readFileSync(path.join(__dirname, '..', 'privacy', 'index.html'), 'utf8');
ok('1713 the check-in carries the name (capped) — the only new field the app sends', /action: 'sub_check', email: state\.user\.email,\s*\n\s*name: String\(state\.user\.name \|\| ''\)\.slice\(0, 80\),/.test(vault13));
ok('1713 the heartbeat is untouched — still anonymous, still once per device per day', /vaultPost\(\{ action: 'heartbeat', v: \(typeof APP_VERSION/.test(vault13) && /lv_hb_day/.test(vault13) && !/heartbeat', email/.test(vault13));
ok('1713 beta_testers!A1:H is read in the same batchGet, at the END of the list (v[0..5] keep their meaning)',
   /'crawl_batches!A1:G50', 'crawl_deltas!A1:X12000',[^\n]*\n\s*'beta_testers!A1:H'\]/.test(ym13) && /crawlBatches: v\[4\], crawlDeltas: v\[5\], betaTesters: v\[6\]/.test(ym13));
ok('1713 columns are found BY HEADER (email, last_seen, app_version, opens, recent_days, name), never by position',
   /function _ymBetaRows\(rows, now\)/.test(ym13) && ["'email'", "'last_seen'", "'app_version'", "'opens'", "'recent_days'", "'name'"].every(k => ym13.indexOf("g(r, " + k + ")") >= 0) && !/r\[3\]|r\[4\]|r\[5\]|r\[6\]|r\[7\]/.test(ym13.slice(ym13.indexOf('function _ymBetaRows'), ym13.indexOf('function _summarize'))));
// run the two pure helpers on the real code
const _a13 = ym13.indexOf('  function _ymLedgerSum'), _b13 = ym13.indexOf('  function _summarize(d) {');
const k13 = {};
require('vm').runInNewContext(ym13.slice(_a13, _b13) + ';this.sum = _ymLedgerSum; this.rows = _ymBetaRows;', k13);
const now13 = new Date('2026-09-11T15:00:00Z');
ok('1713 the 7-day sum counts today and the six days before it, nothing older',
   k13.sum('2026-09-04:9;2026-09-05:1;2026-09-11:2', 7, now13) === 3 && k13.sum('', 7, now13) === 0 && k13.sum('junk;2026-09-11:x', 7, now13) === 0);
const rows13 = [['email', 'free_until', 'note', 'last_seen', 'app_version', 'opens', 'recent_days', 'name'],
                ['a@x.com', '', '', '2026-09-10', 'v0.9.1712', 40, '2026-09-04:3;2026-09-10:2', 'Ann'],
                ['b@x.com', '', 'auto-enrolled', '', '', '', '', ''],
                ['', '', '', '', '', '', '', ''],
                ['c@x.com', '', '', '2026-09-11', 'v0.9.1713', '7', '2026-09-11:1', '']];
const out13 = k13.rows(rows13, now13);
ok('1713 one line per tester with email, name, opens last 7 days, opens total, last seen, version; blank rows skipped',
   out13.length === 3 && out13.some(r => r.email === 'a@x.com' && r.name === 'Ann' && r.week === 2 && r.total === 40 && r.seen === '2026-09-10' && r.version === 'v0.9.1712'));
ok('1713 …most recently seen first, never-seen testers last', out13.map(r => r.email).join(',') === 'c@x.com,a@x.com,b@x.com' && out13[2].seen === '' && out13[2].total === 0);
ok('1713 an old relay (blank columns) yields zeros, not NaN', out13[2].week === 0 && out13[2].total === 0);
ok('1713 the card names the tester (name over email), shows last 7 days / total / last seen / version, and says who is counted',
   /_card\('Who’s using the app'/.test(ym13) && /_esc\(b\.name \|\| b\.email\)/.test(ym13) && /b\.seen \? _esc\(b\.seen\) : 'never'/.test(ym13) && /Beta testers only — the relay \(v4\.0\) counts one open each time a tester’s app loads; nobody outside the beta_testers tab is recorded\./.test(ym13));
ok('1713 the anonymous daily table stays, labelled as devices per day', /_card\('App opens, last 7 days — devices per day'/.test(ym13) && /Anonymous heartbeat: one per device per day, signed in or not/.test(ym13));
ok('1713 the privacy page says it: beta testers only, last opened + how often, nothing about the collection',
   /for beta testers only, when the app was last opened and how often/.test(privacy13) && /Beta testers only: the date you last opened the app, the app version, and a count of opens/.test(privacy13) && /nothing about your collection or what you did in the app/.test(privacy13));
ok('1713 no hex colours in the new card', !/#[0-9a-fA-F]{3,6}\b/.test(ym13.slice(ym13.indexOf('// 3 — WHO IS USING THE APP'), ym13.indexOf('// 4 — THIS WEEK'))));

// ── v0.9.1714 (Session 96): the community PRE-SORT ────────────────────────
// Brad: "it mixes real trains we lack with junk (model airplanes, cars).
// Propose a pre-sort so the obvious junk is flagged as a CHECK and the
// obvious trains are clean." Lists live in config.js; measured on the real
// batch of 2026-09-11 (1,559 rows: 565 duplicates, 78 diecast makers, …).
const cfg14 = src('config.js'), ym14 = src('yardmaster.js');
const _a14 = cfg14.indexOf('const RR_NOT_TRAIN_MAKERS'), _b14 = cfg14.indexOf('\n}\n', cfg14.indexOf('function rrPreSortReasons')) + 3;
const k14 = {};
require('vm').runInNewContext(cfg14.slice(_a14, _b14) + ';this.f = rrPreSortReasons; this.n = rrMakerNorm; this.notTrain = RR_NOT_TRAIN_MAKERS; this.otherO = RR_OTHER_O_BRANDS;', k14);
const r14 = (o) => k14.f(o);
ok('1714 the lists and the classifier live in config.js (ONE place) and are exported', typeof k14.f === 'function' && Array.isArray(k14.notTrain) && Array.isArray(k14.otherO)
   && ['RR_NOT_TRAIN_MAKERS', 'RR_OTHER_O_BRANDS', 'RR_MAKER_ALIASES', 'RR_PRESORT_WORDS', 'rrMakerNorm', 'rrPreSortReasons'].every(n => new RegExp('window\\.' + n + '\\s*=\\s*' + n).test(cfg14)));
ok('1714 a diecast maker is junk twice over (maker + description) and names the maker in the flag',
   JSON.stringify(r14({ maker: 'Die-cast Masters', num: '85925', desc: 'Cat 335F L Hydraulic Excavator' })) === JSON.stringify(['not a train maker — Die-cast Masters', 'looks like a vehicle or aircraft, not a train']));
ok('1714 a train word protects the row: a flatcar WITH a tractor, tanks on a flat car, an airplane PARTS CAR, an operating car are clean',
   [r14({ maker: 'Menards', num: '279-3090', desc: 'Norfolk Southern Long Flatcar with USA Missle' }), r14({ maker: 'MTH', num: '20-90361F', desc: 'TTX #98111 60’ Flat Car with 2 M1A Abrams Tanks' }),
    r14({ maker: 'K-Line', num: 'K691-1152', desc: '2005 PND TCA Boeing Airplane Parts Car' }), r14({ maker: 'K-Line', num: 'K-42438', desc: 'Operating Boy and Airplane' }),
    r14({ maker: 'Lionel', num: '3039', desc: 'PRR GG1 #4817' }), r14({ maker: 'MTH', num: '31872', desc: '#263 Baby Blue Comet 4-Car Set (#612 Pullman, #613 Pullman)' })].every(x => x.length === 0));
ok('1714 a car with no train word is a vehicle even from a train maker (MTH Ford Shelby, K-Line Kruisers Porsche)',
   r14({ maker: 'MTH', num: '30-50066A', desc: 'Ford Shelby GT-500KR 1968 Silver/Black' }).join() === 'looks like a vehicle or aircraft, not a train'
   && r14({ maker: 'K-Line Kruisers', num: 'K-94424', desc: 'Porsche 356B Coupe with Caravan Brown' }).length === 2);
ok('1714 books, catalogs and drawings are paper; track, switches and figure packs are track/scenery',
   r14({ maker: 'Lionel', num: '32096', desc: 'Greenbergs Lionel Catalogs Vol 6 1961-1969' }).join() === 'book, paper or memorabilia, not a product'
   && r14({ maker: 'Lionel', num: '75lamppostdwg', desc: '#75 Lamp Post Drawing' }).join() === 'book, paper or memorabilia, not a product'
   && r14({ maker: 'Atlas', num: '6072', desc: 'O-72 LH Switch (2 pcs)' }).join() === 'track, power or scenery'
   && r14({ maker: 'Woodland Scenics', num: 'A2725', desc: 'Dogs and Cats Figure Pack' }).join() === 'track, power or scenery');
ok('1714 an empty -MBOX / -IS box record and a made-up number are caught; a plain blank description is not junk by itself',
   r14({ maker: 'Lionel', num: '51222-MBOX', desc: '', notes: 'submissions row 3377; via grouped with 51222' }).join() === 'box record, not an item'
   && r14({ maker: 'Lionel', num: 'LennytheLionSwinging', desc: 'Lionel... The Leader in Model Railroading' }).join() === 'no catalog number'
   && r14({ maker: 'K-Line', num: 'K-1234', desc: '' }).length === 0);
ok('1714 makers compare through the alias map (K-Line by Lionel → k-line, Märklín → marklin)', k14.n('K-Line by Lionel') === 'k-line' && k14.n('Märklín') === 'marklin' && k14.n('  MTH ') === 'mth');
ok('1714 the Office asks config for reasons and falls back to NONE when config is missing (never a guess)',
   /function _ymPreSortReasons\(o\) \{\s*try \{ return \(typeof rrPreSortReasons === 'function'\) \? \(rrPreSortReasons\(o\) \|\| \[\]\) : \[\]; \}/.test(ym14));
ok('1714 Lionel with a modern 5-to-7-digit number goes to the MPC-Modern tab by era id (mpc / mod_ho / mod_s), never by a typed tab name',
   /if \(\/\^\\d\{5,7\}\$\/\.test\(String\(num \|\| ''\)\.trim\(\)\.replace\(\/\^6-\/, ''\)\)\) \{/.test(ym14) && /return tabOf\('mpc'\);/.test(ym14) && /return tabOf\('mod_ho'\);/.test(ym14) && /return tabOf\('mod_s'\);/.test(ym14)
   && !/'Lionel MPC-Modern'/.test(ym14.slice(ym14.indexOf('function _ymTabFor('), ym14.indexOf('function _ymNoTabFlag'))));
ok('1714 small O-gauge brands go to the other_o tab by era id', /RR_OTHER_O_BRANDS\.indexOf\(m\) >= 0\) return tabOf\('other_o'\);/.test(ym14));
ok('1714 queueing skips a number already WAITING in the queue and stamps the filing queued (the 565-duplicate cause)',
   /var pendingKeys = \{\};/.test(ym14) && /pendingKeys\[_ymDupKey\(_ymDeltaMaker\(dd\), dd\.num, dd\.variation\)\] = 1;/.test(ym14) && /pendingKeys\[_ymDupKey\(s\.mfr, s\.num, s\.variation\)\] \|\| pendingKeys\[_ymDupKey\('', s\.num, s\.variation\)\]\)\) \{ stampSubs\.push\(s\.row\); return false; \}/.test(ym14));
ok('1714 a queued row remembers its maker in the notes, so a later Pre-sort knows it', /notes: 'submissions row ' \+ s\.row \+ \(s\.mfr \? '; maker ' \+ s\.mfr : ''\)/.test(ym14) && /match\(\/\(\?:\^\|; \)maker \(\[\^;\]\+\)\/\)/.test(ym14));
ok('1714 the Pre-sort button is on the community batch only, and the handler touches PENDING rows only — the flag and an EMPTY tab, no verdicts',
   /\(_ymBatchId === SUBS_BATCH && pend\.length\)/.test(ym14) && /onclick="_ymPreSort\(\)"/.test(ym14)
   && /_ymBatchId !== SUBS_BATCH \|\| _ymPreSortBusy\) return;/.test(ym14) && /dd\.batch === SUBS_BATCH && \(dd\.status \|\| 'pending'\) === 'pending'; \}\);\s*\n\s*if \(!rows\.length\)/.test(ym14)
   && /var tab = String\(dd\.tab \|\| ''\) \|\| _ymTabFor\(maker, dd\.num, dd\.desc\);/.test(ym14) && !/status.*approved|'rejected'/.test(ym14.slice(ym14.indexOf('function _ymPreSortPlan'), ym14.indexOf('window._ymPreSort = '))));
ok('1714 the Pre-sort confirms with counts first, re-checks the row ids before writing (v1689 guard), and writes the two columns found by header',
   /appConfirm\(q, \{ title: 'Pre-sort', ok: 'Sort ' \+ changed\.length \}\)/.test(ym14) && /await _ymRowsStillMatch\(changed\.map\(function \(x\) \{ return x\.dd; \}\)\)/.test(ym14)
   && /out\.deltaCols = \{ tab: _dcol\.proposed_tab == null \? 'D' : _ymColLetter\(_dcol\.proposed_tab\)/.test(ym14) && /cols\.flag \+ x\.dd\.sheetRow/.test(ym14));
ok('1714 a second copy is a duplicate only for the same maker or an unknown maker — never two different known makers',
   /if \(prev && \(!m \|\| prev\.unknown \|\| prev\.makers\[m\]\)\) isDup = true;/.test(ym14));
ok('1714 ONE flag shape for queue time and the Pre-sort: a duplicate carries only its mark, junk carries its reasons without the needs-a-tab tail, a clean row carries the tab / number needs',
   /function _ymShapeFlag\(reasons, tab, num, maker, isDup\)/.test(ym14) && /if \(isDup\) return 'duplicate \\u2014 filed again';/.test(ym14) && (ym14.match(/_ymShapeFlag\(/g) || []).length === 3);
ok('1714 the Pre-sort files the maker of an old row into its notes before the old flag (its only record) is rewritten — so a second press changes nothing',
   /var notes = \(maker && !\/\(\?:\^\|; \)maker \/\.test\(String\(dd\.notes \|\| ''\)\)\)/.test(ym14) && /if \(x\.notes !== null\) data\.push\(\{ range: YM\.DELTAS_TAB \+ '!' \+ cols\.notes/.test(ym14));
ok('1714 an old "no maker given" flag is not mistaken for a maker called that', /!== 'no maker given'\) \? fm\[1\]\.trim\(\) : '';/.test(ym14));
ok('1714 no hex colours in the new code', !/#[0-9a-fA-F]{3,6}\b/.test(ym14.slice(ym14.indexOf('function _ymPreSortPlan'), ym14.indexOf("// ── v0.9.1627(b): EDIT"))));

// ── v0.9.1715 (Session 96): the blank TYPE, read from the description ─────
// Brad: "many say boxcar in the title and the type is blank." Every community
// row arrives with item_type empty; getTypeBucket only runs once a type
// exists, so it answered 'Other' for all 1,559. These are the real misreads
// found on the live batch and fixed: an incidental word beating a body style,
// and a load / parent-set clause being read as the car itself.
const cfg15 = src('config.js'), ym15 = src('yardmaster.js');
const _a15 = cfg15.indexOf('const RR_TYPE_WORDS'), _b15 = cfg15.indexOf('\n}\n', cfg15.indexOf('function rrTypeFromDescription')) + 3;
const k15 = {};
require('vm').runInNewContext(cfg15.slice(_a15, _b15) + ';this.t = rrTypeFromDescription; this.words = RR_TYPE_WORDS;', k15);
const T = (d) => k15.t('', d);
ok('1715 the reader lives in config.js and is exported', typeof k15.t === 'function' && /window\.rrTypeFromDescription = rrTypeFromDescription/.test(cfg15) && /window\.RR_TYPE_WORDS\s+= RR_TYPE_WORDS/.test(cfg15));
ok('1715 every type it can return is one of the 23 TYPE_BUCKETS (that list stays the vocabulary)', (function () {
  const tg = src('type-groups.js'); const sb = { window: {} }; sb.window.window = sb.window;
  require('vm').runInNewContext(tg, sb);
  const ids = sb.window.TYPE_BUCKETS.map(b => b.id).concat(['Steam Locomotive', 'Diesel Locomotive', 'Electric Locomotive']);
  return k15.words.every(w => w[0] === 'LOCO' || ids.indexOf(w[0]) >= 0);
})());
ok('1715 a body style beats an incidental word — "Light Grey" is not a light, "Historical Art" is not paper',
   T('GN 1937 AAR Double Door Boxcar #3345 Light Grey Peterson Supply') === 'Boxcar' && T('NYC Historical Art Wood Sided Reefer') === 'Boxcar');
ok('1715 a "with …" clause names the LOAD, not the car', T('Flatcar with Combine Load') === 'Flatcar'
   && T('BN Depressed Center Flatcar with Black Transformer Load') === 'Flatcar' && T('ATSF Die-cast Hopper with Coal Load') === 'Hopper' && T('UP Flatcar w/ Ertl Green Spreaders') === 'Flatcar');
ok('1715 a "from …" clause names the parent set, so it never types the row — blank beats wrong', T('6464-125 From #2293 Illinois Central F3 Freight Set') === '');
ok('1715 a road name is not a wheel arrangement ("Texas & Pacific" is not a Pacific)', T('Texas & Pacific Railway Double Deck Stock Car') === 'Stock Car');
ok('1715 the plain cases Brad meant: it says boxcar in the title', ['WWII Boxcar “Old Crow Express”', 'PRR Heinz Boxcar', 'NH Boxcar Brown “6464-425”'].every(d => T(d) === 'Boxcar'));
ok('1715 locomotives split into steam / diesel / electric', T('PRR GG1 #4817') === 'Electric Locomotive' && T('SP&S SW-9 Loco Peterson Supply #45') === 'Diesel Locomotive' && T('Southern Pacific FT Diesel Engine') === 'Diesel Locomotive');
ok('1715 sets, track, passenger, intermodal and paper each read correctly',
   T('ATSF Black Bonnet 4 Car 70’ Streamline Passenger Car Set') === 'Set' && T('O-54 Full Curve Track (1 pcs)') === 'Track'
   && T('Amtrak Superliner Aluminum Coach #34102 18”') === 'Passenger Car' && T('40’ Container APL #6175229') === 'Intermodal'
   && T('Lionel A Collectors Guide & History Vol 4 1970-1980') === 'Paper / Box / Misc');
ok('1715 nothing recognisable means NO type, never a guess', T('') === '' && T('Janelco #8891') === '' && T(null) === '');
ok('1715 a switch is track but a switcher is a locomotive', T('O-72 LH Switch (2 pcs)') === 'Track' && T('Hooker Plymouth Switcher') === 'Diesel Locomotive');
ok('1715 the Office asks config and falls back to NO type when config is missing',
   /function _ymTypeFor\(num, desc\) \{\s*try \{ return \(typeof rrTypeFromDescription === 'function'\) \? \(rrTypeFromDescription\(num, desc\) \|\| ''\) : ''; \}/.test(ym15));
ok('1715 queueing fills the type from the description', /item_num: s\.num, item_type: _ymTypeFor\(s\.num, s\.desc\)/.test(ym15));
ok('1715 the Pre-sort fills a BLANK type only and never overwrites one that is there',
   /var type = String\(dd\.type \|\| ''\) \|\| _ymTypeFor\(dd\.num, dd\.desc\);/.test(ym15)
   && /if \(x\.type !== String\(x\.dd\.type \|\| ''\)\) data\.push\(\{ range: YM\.DELTAS_TAB \+ '!' \+ cols\.type/.test(ym15));
ok('1715 the type column is found BY HEADER like the other three, and the confirm says how many get one',
   /type: _dcol\.item_type == null \? 'F' : _ymColLetter\(_dcol\.item_type\)/.test(ym15) && /' get a type read from the description'/.test(ym15));

// ── v0.9.1716 (Session 96): someone's list number, not a catalog number ───
// Found by reading the live queue: 132 of the 889 rows still pending sat in a
// run of CONSECUTIVE numbers whose descriptions run A-Z — a collection
// spreadsheet exported with the row number as the item number. The real
// catalog number is often in the description ("6464-525"). Batch-wide by
// nature, so it runs in the Pre-sort and never at queue time.
const cfg16 = src('config.js'), ym16 = src('yardmaster.js');
const _a16 = cfg16.indexOf('const RR_INVENTORY_MIN_RUN'), _b16 = cfg16.indexOf('\n}\n', cfg16.indexOf('function rrInventoryRows')) + 3;
const k16 = {};
require('vm').runInNewContext(cfg16.slice(_a16, _b16) + ';this.f = rrInventoryRows; this.min = RR_INVENTORY_MIN_RUN; this.alpha = RR_INVENTORY_ALPHA;', k16);
const mk16 = (pairs) => pairs.map(([num, desc], i) => ({ id: 'r' + i, num: String(num), desc: desc }));
ok('1716 the rule lives in config.js with both thresholds exposed, and is exported',
   typeof k16.f === 'function' && k16.min === 5 && k16.alpha === 0.8 && /window\.rrInventoryRows\s+= rrInventoryRows/.test(cfg16));
const books16 = k16.f(mk16([[32136, 'Short lines of the Pacific Northwest'], [32137, 'Spokane, Portland & Seattle Railway In Color'],
  [32138, 'Spokane, Portland and Seattle color Guide'], [32139, 'Standard Catalog of American Flyer Trains'],
  [32140, 'Standard Catalog of Farm Toys 3rd Edition'], [32141, 'Standard Catalog of Lionel Train Sets 1945-1969']]));
ok('1716 a consecutive run in A-Z order is caught, every row of it', Object.keys(books16).length === 6);
const atlas16 = k16.f(mk16([[6051, '4 1/2" Straight (12 pcs)'], [6052, '1 3/4" Straight Track (6 pkgs)'], [6053, '5 1/2" Straight (21 pcs)'],
  [6054, '10" Straight'], [6055, '2 1/2" Straight'], [6056, '19" Straight']]));
ok('1716 a GENUINE consecutive catalog run is NOT caught — its descriptions are not alphabetical', Object.keys(atlas16).length === 0);
ok('1716 a run shorter than the minimum is never caught', Object.keys(k16.f(mk16([[100, 'aaa'], [101, 'bbb'], [102, 'ccc'], [103, 'ddd']]))).length === 0);
ok('1716 a gap breaks the run — 5 in a row is 5 CONSECUTIVE, not 5 sorted',
   Object.keys(k16.f(mk16([[200, 'aaa'], [201, 'bbb'], [203, 'ccc'], [204, 'ddd'], [205, 'eee']]))).length === 0);
ok('1716 non-numeric and short numbers are ignored outright', Object.keys(k16.f(mk16([['6464-500', 'aaa'], ['K-1121', 'bbb'], ['12', 'ccc'], ['ABC', 'ddd'], ['', 'eee']]))).length === 0);
ok('1716 an empty batch, a tiny batch and junk input are all safe', Object.keys(k16.f([])).length === 0 && Object.keys(k16.f(null)).length === 0 && Object.keys(k16.f(mk16([[100, '']]))).length === 0);
ok('1716 the Office asks config and falls back to catching NOTHING when config is missing',
   /if \(typeof rrInventoryRows !== 'function'\) return \{\};/.test(ym16));
ok('1716 it runs ONCE over the whole batch inside the Pre-sort plan, and never at queue time',
   /var inv = _ymInventoryRows\(rows\);/.test(ym16) && /if \(inv\[dd\.id\]\) reasons\.unshift\('a list number, not a catalog number'\);/.test(ym16)
   && !/_ymInventoryRows/.test(ym16.slice(ym16.indexOf('window._ymQueueWaiting'), ym16.indexOf('window._ymCommit'))));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('YARDMASTER TESTS FAILING'); process.exit(1); }
console.log('ALL YARDMASTER TESTS GREEN (' + pass + ')');
