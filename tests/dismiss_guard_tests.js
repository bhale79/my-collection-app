// ════════════════════════════════════════════════════════════════════════
// dismiss_guard_tests.js — v0.9.1786
//
// [stated] Brad, on the "Edit want details" dialog, with a screenshot showing
// a condition target of 7, a priority of High and a max price of 150:
//
//     "if you click outside of the box it disappears."
//
// …and, after v0.9.1785 supposedly fixed it:
//
//     "nope, still does it."
//
// ⚠ v1785 GUARDED THE WRONG THING, AND THAT IS THE LESSON HERE. It asked
// before discarding CHANGES and closed silently when nothing had been touched
// — on the reasoning that there was nothing to lose. But the dialog opens with
// the saved values already in it, so opening it and clicking away still made
// it vanish. He reported the dialog VANISHING; the fix addressed losing edits,
// which is a narrower thing. **He described a symptom; I fixed my theory of
// the cause and never checked the theory against him.**
//
// [stated] Asked directly, he answered: "never close if you pick outside."
//
// So the rule has no conditions in it now: a backdrop click does NOTHING.
// Cancel, Save, the ✕, or the device Back button. A rule that depends on
// whether the app thinks you touched something is a rule you cannot trust.
//
// ⚠ AND THE COUNT WAS WRONG FOUR TIMES BEFORE IT WAS RIGHT: a line-window
// said ELEVEN overlays, a tighter slice said THREE, whole function bodies said
// SIX, widening to every file found FIFTEEN. A heuristic that has not been
// checked against the source is a guess.
//
// Section D plants an offender for every rule.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const APPDIR = path.join(__dirname, '..', 'app');
const APP = fs.readFileSync(path.join(APPDIR, 'app.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

const gi = APP.indexOf('window.rrDismissGuard = function');
const ge = APP.indexOf('\n};', gi);
const GUARD = gi < 0 ? null : APP.slice(gi, ge + 3);

// ── a DOM small enough to be honest about what it stands for ─────────────
function mkEl(tag, attrs) {
  return Object.assign({
    tagName: (tag || 'div').toUpperCase(), children: [], _l: {},
    value: '', checked: false, type: 'text',
    addEventListener(k, f) { (this._l[k] = this._l[k] || []).push(f); },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    remove() { this._removed = true; },
    fire(k, ev) { (this._l[k] || []).forEach(f => f(ev)); },
  }, attrs || {});
}
function build(src) {
  const wired = [];
  const BackStack = { wire: function (ov) { wired.push(ov); } };
  const win = { BackStack: BackStack };
  const guard = new Function('window', 'BackStack',
    (src || GUARD) + '\nreturn window.rrDismissGuard;')(win, BackStack);
  return { guard, wired };
}
function ev(target) {
  const e = { target: target, _stopped: false, _prevented: false };
  e.stopPropagation = function () { e._stopped = true; };
  e.preventDefault = function () { e._prevented = true; };
  return e;
}

// ════════════════════════════════════════════════════════════════════════
section('A. The helper ships, and it is ONE helper');
ok('rrDismissGuard ships on window', !!GUARD && /window\.rrDismissGuard/.test(APP));
ok('the dead v1785 helpers are GONE, not left lying around',
   !/function rrAskDiscard\(/.test(APP) && !/function rrSnapshot\(/.test(APP)
   && !/function rrFieldsOf\(/.test(APP));
if (!GUARD) { console.log('\ncannot continue'); process.exit(1); }

// ════════════════════════════════════════════════════════════════════════
section('B. An outside click does NOTHING. No conditions.');
{
  const { guard } = build();
  const ov = mkEl('div');
  guard(ov);
  const e = ev(ov);
  ov.fire('click', e);
  ok('a backdrop click does not close an untouched dialog — THE BUG BRAD REPORTED',
     ov._removed !== true);
  ok('…and the click is swallowed, not passed on underneath', e._stopped === true);
}
{
  // the v1785 behaviour must NOT come back in any form: no snapshot, no ask
  const { guard } = build();
  const ov = mkEl('div');
  const inp = mkEl('input', { value: '7' });
  ov.appendChild(inp);
  guard(ov);
  inp.value = '150';                      // typed
  ov.fire('click', ev(ov));
  ok('a CHANGED dialog also stays open — same rule, no special case',
     ov._removed !== true);
  inp.value = '7';                        // typed back to the original
  ov.fire('click', ev(ov));
  ok('…and so does one typed back to its original value', ov._removed !== true);
}
{
  const { guard } = build();
  const ov = mkEl('div');
  const card = mkEl('div');
  ov.appendChild(card);
  guard(ov);
  const e = ev(card);
  ov.fire('click', e);
  ok('a click INSIDE the dialog is left completely alone',
     ov._removed !== true && e._stopped === false);
}
{
  const { guard } = build();
  const ov = mkEl('div');
  guard(ov); guard(ov);
  ok('guarding twice attaches ONE handler', (ov._l.click || []).length === 1);
}
ok('the guard holds no snapshot, no comparison and no prompt',
   !/rrSnapshot|rrAskDiscard|opened/.test(GUARD), 'v1785 logic is still in there');

// ════════════════════════════════════════════════════════════════════════
section('C. The device Back button still gets you out');
{
  const { guard, wired } = build();
  const ov = mkEl('div');
  guard(ov);
  ok('every guarded overlay wires through BackStack', wired.length === 1 && wired[0] === ov);
}

// ════════════════════════════════════════════════════════════════════════
section('D. EVERY guarded overlay has a visible way OUT');
// This is the check that makes "never close" safe. Without a Cancel, a Done,
// a Close or an ✕, "never close on a backdrop click" would TRAP the user —
// far worse than the bug it fixes.
//
// ⚠ It decodes \uXXXX first. The ✕ on pickItemForUpgrade is written '✕'
// in source, and a first pass at this check read the raw text, reported "NO
// WAY OUT", and very nearly had a button added to a dialog that already had
// one. Same escape-decoding trap as the tap-target scan in v0.9.1777.
function decode(s) {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, function (_, h) {
    return String.fromCharCode(parseInt(h, 16));
  });
}
// v0.9.1790: AND IT RESOLVES A LABEL HELD IN A COPY CONSTANT.
//
// _partsChooser's way out is `PARTS_COPY.cancel`, and PARTS_COPY.cancel is
// 'Cancel'. Reading the raw source, this scan saw no Cancel and called a
// perfectly escapable dialog a trap — the third time the same lesson has
// arrived: the scan reads TEXT, and the text is not always the thing. First
// the ✕ written as ✕ (v1777, again in v1786), now a label behind a
// constant.
//
// Only a key defined EXACTLY ONCE in the file is resolved. A name defined
// twice with different values would otherwise let a wrong substitution turn a
// real trap into a pass, which is the dangerous direction to be wrong in.
function resolveCopy(slice, fileSrc) {
  return slice.replace(/\b[A-Z][A-Z0-9_]*\.(\w+)\b/g, function (whole, key) {
    const hits = fileSrc.match(new RegExp('\\b' + key + ":\\s*'([^']*)'", 'g')) || [];
    if (hits.length !== 1) return whole;
    return (hits[0].match(/'([^']*)'/) || [null, whole])[1];
  });
}
// v0.9.1788: a leading glyph is normal on a back button ("← Back"), and the
// old pattern demanded the word sit flush against the '>'. It would have
// called the new Maintenance task card a trap while it had a Back button in
// plain sight.
const WAYS = /(>\s*[^<A-Za-z]{0,3}\s*(Cancel|Close|Done|Not now|Back|Skip)\b)|×|&times;|✕|✖|╳/i;
// v0.9.1788: EVERY app file, not a list of seven.
//
// The list was hand-written in v1786 and named only the files that had guarded
// overlays THAT DAY. A guard added anywhere else — as v1788 did, in
// maintenance.js — got no way-out check at all, which is the one check that
// makes "never close on an outside click" safe rather than a trap. A
// hand-kept list of files to scan is the same mistake as a hand-typed version
// number: it is correct only until the next change.
const FILES = fs.readdirSync(APPDIR).filter(f => f.endsWith('.js')).sort();
let sites = 0, trapped = [];
FILES.forEach(function (f) {
  const src = fs.readFileSync(path.join(APPDIR, f), 'utf8');
  const lines = src.split('\n');
  lines.forEach(function (ln, i) {
    if (!/rrDismissGuard\(/.test(ln)) return;
    sites++;
    let st = i; for (let j = i; j >= 0; j--) if (lines[j] && !/^\s/.test(lines[j])) { st = j; break; }
    let en = lines.length; for (let j = i; j < lines.length; j++) if (/^\}/.test(lines[j])) { en = j; break; }
    if (!WAYS.test(resolveCopy(decode(lines.slice(st, en).join('\n')), src))) trapped.push(f + ':' + (i + 1));
  });
});
ok('every guarded overlay offers Cancel / Done / Close / ✕', trapped.length === 0,
   trapped.join(', '));
// v1786 pinned 15 across seven named files; v1788 scans every app file and
// adds the Maintenance task card. The pin is here so the next change to this
// number has to be a decision, not a drift.
// v1786 pinned 15 across seven named files; v1788 scanned every file and
// added the Maintenance task card; v1790 guarded the fourteen read-only
// overlays too, so there is now ONE rule with no exceptions in it.
ok('33 guarded call sites, and ONE helper behind them', sites === 33, String(sites));

// nobody double-wires BackStack any more — the guard does it, once
let dbl = 0;
FILES.forEach(function (f) {
  const lines = fs.readFileSync(path.join(APPDIR, f), 'utf8').split('\n');
  lines.forEach(function (ln, i) {
    const m = ln.match(/rrDismissGuard\((\w+)\)/); if (!m) return;
    let en = lines.length; for (let j = i; j < lines.length; j++) if (/^\}/.test(lines[j])) { en = j; break; }
    lines.slice(i, en).forEach(function (l2) {
      if (new RegExp('BackStack\\.wire\\(' + m[1] + '\\)').test(l2)) dbl++;
    });
  });
});
ok('no guarded overlay wires BackStack twice', dbl === 0, String(dbl));

// ── v0.9.1789: BOTH SPELLINGS, EVERY FILE, AND NO JUDGEMENT CALL ─────────
//
// THIS SCAN MISSED FOUR OVERLAYS AND I TOLD BRAD IT HAD FOUND THEM ALL.
//
// v1786 looked for ONE spelling — `e.target === x` on the same line as a
// `.remove()` — and only inside app/*.js. Four overlays wrote it the other
// way, as an inline attribute calling a named function:
//
//     onclick="if(event.target===this)_wbCloseCard()"
//
// The Workbench add-task card, the service history, the My Manuals form and
// the report preview. The first two are the same bug Brad reported, on an
// overlay carrying a form. One of them lived in index.html, which was not
// scanned at all.
//
// THE "TYPED FIELDS" CLAUSE STAYS, FOR NOW, AND HERE IS WHY IT IS WRITTEN
// DOWN RATHER THAN QUIETLY DROPPED. Removing it turns up FOURTEEN more
// overlays that close on a backdrop click — read-only popups and menus, which
// v0.9.1785 deliberately left alone on the grounds that dismissing them costs
// nothing. Brad's rule as he said it ("never close if you pick outside") has
// no such clause, so those fourteen may well want guarding too; that is a
// decision for him, not something to slip into a release about four other
// overlays. He has been asked. Until he answers, this check enforces exactly
// what v1786 promised — and now actually enforces it, in both spellings and
// in index.html, which is what it failed to do before.
const DISMISSALS = [
  { name: 'e.target === x … .remove()', re: /e\.target === ([A-Za-z_$][\w$]*)\b[\s\S]{0,40}\.remove\(\)/ },
  { name: 'inline onclick="if(event.target===this)…"', re: /event\.target\s*===\s*this/ },
];
const SCANNED = fs.readdirSync(APPDIR)
  .filter(f => f.endsWith('.js') || f.endsWith('.html')).sort();
ok('the scan reads index.html too — one of the four missed overlays lived there',
   SCANNED.indexOf('index.html') >= 0);
const OFFENDERS = [], READONLY = [];
SCANNED.forEach(function (f) {
  const lines = fs.readFileSync(path.join(APPDIR, f), 'utf8').split('\n');
  lines.forEach(function (ln, i) {
    if (/rrDismissGuard\(/.test(ln)) return;
    if (/^\s*(\/\/|\*|<!--)/.test(ln)) return;          // a comment ABOUT the pattern is not the pattern
    if (/getAttribute/.test(ln)) return;                // barcode.js tests an attribute, not identity
    if (!DISMISSALS.some(d => d.re.test(ln))) return;
    // the overlay's own source: back to the last unindented line, on to the next
    let st = i; for (let j = i; j >= 0; j--) if (lines[j] && !/^\s/.test(lines[j])) { st = j; break; }
    let en = lines.length; for (let j = i; j < lines.length; j++) if (/^\}/.test(lines[j])) { en = j; break; }
    const body = lines.slice(st, en).join('\n');
    (/<input|<select|<textarea/.test(body) ? OFFENDERS : READONLY).push(f + ':' + (i + 1));
  });
});
ok('no overlay with typed fields hand-rolls its own backdrop dismissal',
   OFFENDERS.length === 0, OFFENDERS.join(', '));
// Not a failure — a COUNT, so the fourteen cannot quietly become forty while
// the question of what to do about them is still open. If Brad says to guard
// them this number goes to 0; if he says leave them, it stays pinned here.
// v0.9.1790 — [stated] Brad, asked whether the fourteen read-only overlays
// should be guarded too "so the rule is simply clicking outside never closes
// anything": "yes". So this is now ZERO, and the rule above needs no clause
// about typed fields at all. Both checks are kept: the typed-fields one is the
// promise v1786 made, and this one is the promise it should have made.
ok('NOTHING closes on a backdrop click any more — one rule, no exceptions',
   READONLY.length === 0, READONLY.length + ': ' + READONLY.join(', '));

// ════════════════════════════════════════════════════════════════════════
section('E. Planted offenders — every rule above can actually fail');
{
  // 1 — the shipped bug: the backdrop closes the dialog.
  const naive = GUARD.replace(
    /ov\.addEventListener\('click'[\s\S]*?\}\);/,
    "ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });");
  const b = build(naive);
  const ov = mkEl('div');
  b.guard(ov);
  ov.fire('click', ev(ov));
  ok('a guard that closes on a backdrop click is caught — THE BUG BRAD REPORTED',
     naive !== GUARD && ov._removed === true);

  // 2 — v1785 creeping back: close when it thinks nothing changed.
  const v1785ish = GUARD.replace(
    "if (e.target === ov) { e.stopPropagation(); e.preventDefault(); }",
    "if (e.target === ov && !ov._touched) ov.remove();");
  const c = build(v1785ish);
  const ov2 = mkEl('div');
  c.guard(ov2);
  ov2.fire('click', ev(ov2));
  ok('the v1785 "close if unchanged" rule creeping back is caught',
     v1785ish !== GUARD && ov2._removed === true);

  // 3 — the BackStack wiring is dropped, so device Back stops working.
  const noBack = GUARD.replace(/try \{ if \(window\.BackStack[\s\S]*?\} catch \(e\) \{\}/, '');
  const d = build(noBack);
  d.guard(mkEl('div'));
  ok('losing the BackStack wiring is caught', noBack !== GUARD && d.wired.length === 0);

  // 4 — the double-guard latch goes and two handlers stack.
  const noLatch = GUARD.replace(/if \(!ov \|\| ov\._rrGuarded\) return;\s*\n\s*ov\._rrGuarded = true;/,
                                'if (!ov) return;');
  const e4 = build(noLatch);
  const ov4 = mkEl('div');
  e4.guard(ov4); e4.guard(ov4);
  ok('losing the double-guard latch is caught',
     noLatch !== GUARD && (ov4._l.click || []).length === 2);

  // 5 — the way-out scan must FIRE on a trapped dialog, and must NOT be fooled
  //     by an escaped ✕. Both halves, or it is worthless — and the second half
  //     is the one that actually bit.
  const trappedSrc = "function _t() {\n  var ov = 1;\n  rrDismissGuard(ov);\n  ov.innerHTML = '<div>no exit here</div>';\n}";
  const escapedX  = "function _t() {\n  var ov = 1;\n  rrDismissGuard(ov);\n  ov.innerHTML = '<button>\\u2715</button>';\n}";
  function hasWayOut(src) { return WAYS.test(decode(src)); }
  ok('the scan FIRES on a dialog with no way out', !hasWayOut(trappedSrc));
  ok('…and is NOT fooled by an ✕ written as \\u2715', hasWayOut(escapedX));
  ok('…and reading it RAW would have been fooled — which is why it decodes',
     !WAYS.test(escapedX));

  // 6 — v0.9.1789: the spelling this scan was BLIND to for three releases.
  //     Both halves matter. It must fire on the inline attribute form, and the
  //     OLD one-spelling pattern must be shown to miss it — otherwise there is
  //     nothing to prove the widening was needed, and someone narrows it back.
  const inlineOffender = 'onclick="if(event.target===this)_wbCloseCard()"';
  const oldPattern = /e\.target === ([A-Za-z_$][\w$]*)\b[\s\S]{0,40}\.remove\(\)/;
  ok('the inline onclick="if(event.target===this)…" spelling is caught now',
     DISMISSALS.some(d => d.re.test(inlineOffender)));
  ok('…and the v1786 pattern alone would have walked straight past it — the actual miss',
     !oldPattern.test(inlineOffender));

  // 7 — and the same offender hidden in index.html, which was not read at all.
  const ixOffender = fs.readFileSync(path.join(APPDIR, 'index.html'), 'utf8')
    .replace('<body', '<div id="x" onclick="if(event.target===this)_closeX()"></div><body');
  ok('an offender planted in index.html is caught — the file the old scan never opened',
     ixOffender.split('\n').some(ln => DISMISSALS.some(d => d.re.test(ln))));

  // 8 — v0.9.1790: a way out whose LABEL lives in a copy constant. Both
  //     halves again: the resolver must find it, and the raw read must be
  //     shown to miss it, or the resolver looks like decoration and gets cut.
  const fileSrc = "var PARTS_COPY = {\n  cancel: 'Cancel'\n};";
  const viaConst = "ov.innerHTML = '<button>' + PARTS_COPY.cancel + '</button>';";
  ok('a Cancel held in a copy constant counts as a way out',
     WAYS.test(resolveCopy(viaConst, fileSrc)));
  ok('…and reading it RAW would have called that dialog a trap — the actual false alarm',
     !WAYS.test(viaConst));
  const twice = "var A = { cancel: 'Cancel' };\nvar B = { cancel: 'Abandon' };";
  ok('a key defined twice is NOT resolved — a wrong substitution could hide a real trap',
     !WAYS.test(resolveCopy(viaConst, twice)));
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
