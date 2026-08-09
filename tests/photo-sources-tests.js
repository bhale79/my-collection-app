// ── v0.9.1417 — the iPhone Photo Inbox report ─────────────────────────────
//
// Beta tester 1, on an iPhone: tapping "From Google Photos" showed a red
// "Still working on the last batch…" toast, and there was no way to add
// anything from his camera roll.
//
// Two causes, three fixes. Each assertion below is mutation-drilled: the
// pre-fix source is reconstructed and the same assertion is run against it,
// and if the old code PASSES, the check is not testing anything and this
// suite says so out loud rather than reporting green.
//
// drive.js is exercised for real, on a fake clock, with a stubbed fetch — the
// poll loop is the thing under test, so it has to actually run.

const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP = n => path.join(__dirname, '..', 'app', n);

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
// A drilled pair: the fix must pass and the pre-fix code must fail.
function drilled(name, fixed, broken) {
  ok(name, fixed);
  ok('  ↳ pre-fix code fails this (drill)', !broken,
     broken ? 'the old code passed too — this assertion has no teeth' : '');
}
function section(t) { console.log('\n== ' + t + ' =='); }

const INBOX = fs.readFileSync(APP('photo-inbox.js'), 'utf8');
const DRIVE = fs.readFileSync(APP('drive.js'), 'utf8');

// ══ 1. The camera roll has a door on a phone ═══════════════════════════════
section('Add photos from… — the mobile source list');

// The sheet is built from a string, and pulling the whole 8,600-line IIFE into
// a stub browser to read three buttons would test the stub. Read the builder.
function sourceSheet(src) {
  const a = src.indexOf('function _pinAddSourceSheet()');
  if (a < 0) return null;
  const b = src.indexOf('document.body.appendChild(ov);', a);
  return b < 0 ? null : src.slice(a, b);
}
const sheet = sourceSheet(INBOX);
// The pre-fix sheet, verbatim from v0.9.1416.
const sheetOld =
  "var sources = mobile\n" +
  "  ? '<button onclick=\"_qcOpen()\">Take with Phone</button>'\n" +
  "    + '<button onclick=\"_pinGPhotos()\">From Google Photos</button>'\n" +
  "  : '<button onclick=\"_pinPickFiles()\">From This Computer</button>'\n" +
  "    + '<button onclick=\"_pinGPhotos()\">From Google Photos</button>';";

// The two arms of `var sources = mobile ? <phone> : <desktop>;`. Anchored on
// the ternary's own punctuation rather than on "mobile", which appears in the
// IS_MOBILE_UA line and in the comment above it — the first version of this
// helper anchored on the word and sliced the wrong 40 lines.
function sourceArms(s) {
  if (!s) return { mobile: '', desktop: '' };
  const a = s.indexOf('var sources = mobile');
  if (a < 0) return { mobile: '', desktop: '' };
  const stmt = s.slice(a, s.indexOf(';', s.indexOf('_pinGPhotos()', a)) + 1);
  const split = stmt.search(/\n\s*: /);
  if (split < 0) return { mobile: stmt, desktop: '' };
  return { mobile: stmt.slice(0, split), desktop: stmt.slice(split) };
}
const arms    = sourceArms(sheet);
const armsOld = sourceArms('var sources = ' + sheetOld.slice(sheetOld.indexOf('mobile')));
const mob    = arms.mobile;
const mobOld = armsOld.mobile;
ok('the arm splitter found both arms of the real ternary',
   /srcBtn|button/.test(arms.mobile) && /srcBtn|button/.test(arms.desktop),
   'mobile=' + arms.mobile.length + ' desktop=' + arms.desktop.length);

drilled('a phone is offered the file picker (the camera roll)',
        /_pinPickFiles\(\)/.test(mob), /_pinPickFiles\(\)/.test(mobOld));
ok('...and the camera is still offered too', /_qcOpen\(\)/.test(mob));
ok('...and Google Photos is still offered', /_pinGPhotos\(\)/.test(mob));
ok('the desktop branch kept its file picker', /_pinPickFiles\(\)/.test(arms.desktop));

// The picker only opens on iOS if click() rides the user's gesture — so the
// button must call it directly, never through a timer or an await.
const pickFiles = INBOX.slice(INBOX.indexOf('window._pinPickFiles ='),
                              INBOX.indexOf('window._pinPickFiles =') + 200);
ok('the file picker click is synchronous (iOS keeps the gesture)',
   /inp\.click\(\);/.test(pickFiles) && !/setTimeout|await|then\(/.test(pickFiles),
   pickFiles.split('\n').slice(0, 4).join(' '));
ok('the file input still accepts any image and takes several',
   /id="pin-file-input"[^>]*accept="image\/\*"[^>]*multiple/.test(INBOX));

// ══ 2. The waiting line repaints, so Cancel cannot go missing ══════════════
section('drive.js — the picker poll re-asserts the status every tick');

// Run the real rrGPhotosPickSession with a controllable clock and fetch.
async function runPoll(driveSrc, opts) {
  opts = opts || {};
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
                        { url: 'https://example.test/', runScripts: 'outside-only' });
  const win = dom.window;
  let now = 0, seq = 0;
  const timers = [];
  win.setTimeout = (fn, ms) => { const id = ++seq; timers.push({ id, at: now + (ms || 0), fn }); return id; };
  win.accessToken = 'tok';
  win._ensurePhotosScope = async () => true;
  // The picker tab: blocked when opts.popupBlocked.
  win.open = () => (opts.popupBlocked ? null : { location: '', close() {} });

  let polls = 0;
  win.fetch = async (url, init) => {
    if (/\/v1\/sessions$/.test(url) && init && init.method === 'POST') {
      return { ok: true, json: async () => ({ id: 'S1', pickerUri: 'https://photos.example/pick', pollingConfig: { pollInterval: '4s' } }) };
    }
    if (/\/v1\/sessions\/S1/.test(url)) {
      polls++;
      return { ok: true, json: async () => ({ mediaItemsSet: polls >= (opts.pollsBeforeDone || 3) }) };
    }
    if (/mediaItems\?/.test(url)) {
      return { ok: true, json: async () => ({ mediaItems: [{ type: 'PHOTO', mediaFile: { baseUrl: 'b', filename: 'a.jpg' } }] }) };
    }
    return { ok: false, status: 404 };
  };

  win.eval(driveSrc.slice(driveSrc.indexOf('async function rrGPhotosPickSession'),
                          driveSrc.indexOf('// Download one picked media item as a File.')));

  const statusCalls = [];
  const needTab = [];
  let done = false, result = null, thrown = null;
  win.rrGPhotosPickSession({
    shouldAbort: () => false,
    onStatus: () => statusCalls.push(1),
    onNeedTab: uri => needTab.push(uri),
  }).then(r => { done = true; result = r; }, e => { done = true; thrown = e; });

  // Advance the fake clock only when the helper is genuinely parked on a
  // timer; otherwise let its pending promise jobs run. Firing timers blindly
  // would race past awaits and test a different program than the one shipping.
  for (let guard = 0; guard < 20000 && !done; guard++) {
    await new Promise(r => setImmediate(r));
    if (done) break;
    timers.sort((a, b) => a.at - b.at || a.id - b.id);
    const nx = timers.shift();
    if (nx) { now = nx.at; nx.fn(); }
  }
  if (thrown) throw thrown;
  if (!done) throw new Error('picker helper never settled — the harness gave up');
  return { statusCalls: statusCalls.length, needTab, result, polls };
}

// The pre-fix helper: onStatus once, bare window.open fallback.
const drivePreFix = DRIVE
  .replace(/  onStatus\('waiting'\);\n(  while \(!picked[^\n]*\n)    await new Promise\(function \(r\) \{ setTimeout\(r, iv\); \}\);\n    onStatus\('waiting'\);/,
           "  onStatus('waiting');\n$1    await new Promise(function (r) { setTimeout(r, iv); });")
  .replace(/  if \(!tab\) \{\n    var _opened = null;[\s\S]*?\n  \}/,
           '  if (!tab) window.open(s.pickerUri, \'_blank\');');
if (drivePreFix === DRIVE) {
  ok('the drive.js drill actually bites', false, 'neither pre-fix pattern was reconstructed');
}

(async function () {
  const fixed  = await runPoll(DRIVE,       { pollsBeforeDone: 4 });
  const broken = await runPoll(drivePreFix, { pollsBeforeDone: 4 });

  drilled('the waiting line is repainted on every poll, not written once',
          fixed.statusCalls >= 4, broken.statusCalls >= 4);
  ok('...and the pick still completes normally',
     !fixed.result.error && fixed.result.items.length === 1,
     JSON.stringify(fixed.result.error || ''));

  // A blocked popup must be handed back, not swallowed.
  const blockedFix = await runPoll(DRIVE,       { popupBlocked: true, pollsBeforeDone: 2 });
  const blockedOld = await runPoll(drivePreFix, { popupBlocked: true, pollsBeforeDone: 2 });
  drilled('a blocked picker tab is reported to the caller with its URL',
          blockedFix.needTab.length === 1 && /photos\.example/.test(blockedFix.needTab[0]),
          blockedOld.needTab.length === 1);
  ok('...and the poll keeps running, so a later tap still lands the pick',
     !blockedFix.result.error && blockedFix.result.items.length === 1);

  // ══ 3. The inbox tells the truth when it is busy ════════════════════════
  section('photo-inbox.js — the busy guard has a way out');

  const painter = INBOX.slice(INBOX.indexOf('function _pinGPStatus()'),
                              INBOX.indexOf('function _pinBusyBounce()'));
  const bounce  = INBOX.slice(INBOX.indexOf('function _pinBusyBounce()'),
                              INBOX.indexOf('function _pinBusyBounce()') + 500);

  // v0.9.1417 routed the FIVE guards that already showed a message. Cooper's
  // report (v0.9.1418) proved that was backwards: the ones that most needed a
  // voice were the four that had none, and they were left out precisely
  // because this replace matched on the toast. All ten route through the
  // bounce now. tests/inbox-busy-tests.js asserts the count-free property —
  // that NO guard in the file is silent — which is the one that would have
  // caught the miss; this stays pinned so a new guard shows up as a change.
  drilled('every "still working" guard goes through the shared bounce',
          (INBOX.match(/_pinBusyBounce\(\); return;/g) || []).length === 10,
          /\{ showToast\('Still working on the last batch…', 2500, true\); return; \}/.test(INBOX));
  ok('the bounce repaints the waiting line before it scolds',
     /_pinGPStatus\(\)/.test(bounce) && /Cancel/.test(bounce));
  ok('the painter always offers Cancel', /_pinGPhotosCancel\(\)/.test(painter));
  ok('the painter offers a re-open button when the tab was blocked',
     /_pinGPhotosOpenTab\(\)/.test(painter) && /_gpPickerUri/.test(painter));
  ok('the painter says nothing when no picker wait is running',
     /if \(!_gpWaiting\) return false;/.test(painter));

  // The flag must be lowered on EVERY exit, or the painter starts lying and
  // overwrites the import progress with a stale Cancel button.
  const gp = INBOX.slice(INBOX.indexOf('window._pinGPhotos = async function'),
                         INBOX.indexOf('// ── Discard (Drive trash'));
  ok('the wait ends the moment the picker returns',
     /_gpWaiting = false; _gpPickerUri = '';\n\s*if \(pick\.error\)/.test(gp));
  ok('...and again in the finally, whatever happened',
     /finally \{ _setBusy\(false\); _gpWaiting = false; _gpPickerUri = ''; \}/.test(gp));
  ok('Cancel lowers the flag too, so it cannot re-arm itself',
     /_pinGPhotosCancel = function \(\) \{\s*_gpAbort = true; _gpWaiting = false;/.test(INBOX));
  ok('re-opening a blocked tab is wired to a tap, not called for the user',
     /_pinGPhotosOpenTab = function \(\) \{[\s\S]{0,160}window\.open\(_gpPickerUri/.test(INBOX));

  // The other caller of the shared helper must survive the onStatus change.
  const BC = fs.readFileSync(APP('barcode.js'), 'utf8');
  ok('barcode.js still drives the same helper and its onStatus is idempotent',
     /rrGPhotosPickSession\(\{[\s\S]{0,300}onStatus: function \(\) \{ setSt\(/.test(BC));

  console.log('\n' + (fail ? 'FAILED' : 'OK') + '  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
