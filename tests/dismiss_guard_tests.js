// ════════════════════════════════════════════════════════════════════════
// dismiss_guard_tests.js — v0.9.1785
//
// [stated] Brad, on the "Edit want details" dialog, with a screenshot showing
// a condition target of 7, a priority of High and a max price of 150 typed in:
//
//     "if you click outside of the box it disappears."
//
// One click on the dark backdrop removed the overlay and threw all three away.
// No confirm, no toast, nothing. The line was:
//
//     d.addEventListener('click', function (e) { if (e.target === d) d.remove(); });
//
// ⚠ THE COUNT WAS WRONG THREE TIMES BEFORE IT WAS RIGHT. A first pass using a
// line-window said ELEVEN overlays were affected; a tighter one said THREE;
// scanning whole function bodies said SIX; widening from four files to ALL of
// them found SEVEN MORE, including `_partInstallForm` (five typed fields) and
// two checkbox pickers where losing your ticks is the same bug. The real
// number is 15 call sites. **A heuristic that has not been checked against the
// source is a guess.** This suite pins the real list so the next change to it
// is deliberate.
//
// ONE guard, not fifteen copies — six copies of a rule is how five of them
// drift (the link-builder lesson from v0.9.1783).
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

// ── lift the REAL helpers out of app.js ──────────────────────────────────
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  return null;
}
const sFields = grab(APP, 'rrFieldsOf');
const sSnap   = grab(APP, 'rrSnapshot');
const gi = APP.indexOf('window.rrDismissGuard = function');
const ge = APP.indexOf('\n};', gi);
const sGuard = gi < 0 ? null : APP.slice(gi, ge + 3);

// ── a DOM small enough to be honest about what it stands for ─────────────
function mkEl(tag, attrs) {
  const el = Object.assign({
    tagName: (tag || 'div').toUpperCase(), children: [], _listeners: {},
    style: { cssText: '' }, value: '', checked: false, type: 'text',
    addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
    removeEventListener() {},
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    remove() { this._removed = true; if (this.parentNode) this.parentNode.children =
      this.parentNode.children.filter(x => x !== this); },
    querySelectorAll(sel) {
      const want = sel.split(',').map(s => s.trim().toUpperCase());
      const out = [];
      (function walk(n) { (n.children || []).forEach(c => {
        if (want.indexOf(c.tagName) >= 0) out.push(c); walk(c);
      }); })(this);
      return out;
    },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    fire(t, ev) { (this._listeners[t] || []).forEach(fn => fn(ev)); },
  }, attrs || {});
  return el;
}

function build(guardSrc, fieldsSrc, snapSrc) {
  const body = document._body = mkEl('body');
  const document_ = {
    body: body,
    createElement: (t) => mkEl(t),
  };
  const asked = { count: 0, answer: true };
  const sandbox = {};
  const fn = new Function('window', 'document', 'rrAskDiscard', 'setTimeout', 'BackStack',
    (fieldsSrc || sFields) + '\n' + (snapSrc || sSnap) + '\n' + (guardSrc || sGuard)
    + '\nreturn { guard: window.rrDismissGuard, snap: rrSnapshot, fields: rrFieldsOf };');
  const wired = [];
  const BackStack = { wire: function (ov) { wired.push(ov); } };
  sandbox.BackStack = BackStack;   // the guard reads window.BackStack, then calls BackStack.wire
  const api = fn(sandbox, document_,
    function () { asked.count++; return Promise.resolve(asked.answer); },
    function (cb) { cb(); },                       // run the next-tick snapshot now
    BackStack);
  return { api, asked, wired, document_ };
}
const document = {};   // placeholder so mkEl's closure above is happy

// ════════════════════════════════════════════════════════════════════════
section('A. The helper ships and is ONE helper');

ok('rrFieldsOf ships', !!sFields);
ok('rrSnapshot ships', !!sSnap);
ok('rrDismissGuard ships and is on window', !!sGuard && /window\.rrDismissGuard/.test(APP));
ok('rrAskDiscard ships — an IN-APP dialog, never the browser confirm',
   /function rrAskDiscard\(/.test(APP) && !/[^.\w]confirm\(/.test(sGuard || ''));
if (!sGuard || !sFields || !sSnap) { console.log('\ncannot continue'); process.exit(1); }

// ════════════════════════════════════════════════════════════════════════
section('B. UNCHANGED closes. CHANGED asks. Nothing is ever lost silently.');
{
  const { api, asked } = build();
  const ov = mkEl('div');
  const inp = mkEl('input', { value: '7' });
  ov.appendChild(inp);
  api.guard(ov);

  // nothing touched -> closes exactly as before
  ov.fire('click', { target: ov });
  ok('an untouched dialog still closes on a backdrop click', ov._removed === true);
  ok('…and it did NOT ask — no question where there is nothing to lose', asked.count === 0);
}
{
  const { api, asked } = build();
  const ov = mkEl('div');
  const inp = mkEl('input', { value: '7' });
  ov.appendChild(inp);
  api.guard(ov);

  inp.value = '9';                     // Brad types
  asked.answer = false;                // …and chooses Keep editing
  ov.fire('click', { target: ov });
  ok('a CHANGED dialog asks before closing', asked.count === 1);
  ok('…and "Keep editing" LEAVES IT OPEN — the typed work survives',
     ov._removed !== true);
  ok('…with the value still in the field', inp.value === '9');
}
{
  const { api, asked } = build();
  const ov = mkEl('div');
  const inp = mkEl('input', { value: 'a' });
  ov.appendChild(inp);
  api.guard(ov);
  inp.value = 'b';
  asked.answer = true;                 // …chooses Discard
  ov.fire('click', { target: ov });
  ok('…and "Discard" does close it', asked.count === 1);
}
{
  // a click INSIDE the dialog must never close it, changed or not
  const { api, asked } = build();
  const ov = mkEl('div');
  const card = mkEl('div');
  const inp = mkEl('input', { value: '1' });
  ov.appendChild(card); card.appendChild(inp);
  api.guard(ov);
  inp.value = '2';
  ov.fire('click', { target: card });
  ok('a click INSIDE the dialog closes nothing and asks nothing',
     ov._removed !== true && asked.count === 0);
}
{
  // checkboxes count — losing ten ticks is the same bug as losing a price
  const { api, asked } = build();
  const ov = mkEl('div');
  const cb = mkEl('input', { type: 'checkbox', checked: false });
  ov.appendChild(cb);
  api.guard(ov);
  cb.checked = true;
  asked.answer = false;
  ov.fire('click', { target: ov });
  ok('a ticked CHECKBOX counts as a change', asked.count === 1 && ov._removed !== true);
}
{
  // a <select> counts too — two of the guarded dialogs are dropdown-only
  const { api, asked } = build();
  const ov = mkEl('div');
  const sel = mkEl('select', { value: 'Medium' });
  ov.appendChild(sel);
  api.guard(ov);
  sel.value = 'High';
  asked.answer = false;
  ov.fire('click', { target: ov });
  ok('a changed SELECT counts as a change', asked.count === 1 && ov._removed !== true);
}
{
  // a dialog with no fields at all behaves exactly as it always did
  const { api, asked } = build();
  const ov = mkEl('div');
  api.guard(ov);
  ov.fire('click', { target: ov });
  ok('a field-less overlay closes with no question', ov._removed === true && asked.count === 0);
}
{
  // guarding twice must not stack two handlers
  const { api, asked } = build();
  const ov = mkEl('div');
  const inp = mkEl('input', { value: 'x' });
  ov.appendChild(inp);
  api.guard(ov); api.guard(ov);
  inp.value = 'y';
  asked.answer = false;
  ov.fire('click', { target: ov });
  ok('guarding the same overlay twice asks ONCE, not twice', asked.count === 1);
}

// ════════════════════════════════════════════════════════════════════════
section('C. The device Back button — Brad\'s standing overlay rule');
{
  const { api, wired } = build();
  const ov = mkEl('div');
  api.guard(ov);
  ok('every guarded overlay wires through BackStack', wired.length === 1 && wired[0] === ov);
}

// ════════════════════════════════════════════════════════════════════════
section('D. THE REAL CALL SITES — the list, pinned');
// The count was wrong three times before it was right. This is the list as
// measured against the source on 2026-09-20; changing it should be deliberate.
const EXPECT = {
  'app-collection.js': 2,   // _rrMiniEdit (want details AND asking price) + _rrDetailFieldsPicker
  'app-pages.js':      6,   // ephemera edit, ebay filters, pick-for-upgrade,
                            // add-to-upgrade, add part, part install form
  'browse.js':         1,   // collection columns picker
  'bulk-tag.js':       1,   // tag picker
  'dashboard.js':      1,   // catalogue-coverage config
  'photo-inbox.js':    2,   // context picker, file picker
  'prefs.js':          2,   // user fields, locations
};
let total = 0;
Object.keys(EXPECT).forEach(function (f) {
  const src = fs.readFileSync(path.join(APPDIR, f), 'utf8');
  const n = (src.match(/rrDismissGuard\(/g) || []).length;
  total += n;
  ok(f + ' guards ' + EXPECT[f] + ' overlay(s)', n === EXPECT[f], 'found ' + n);
});
ok('15 call sites in total, and ONE helper behind them', total === 15, String(total));

// The rule that keeps it true: nobody hand-rolls a bare backdrop-remove on an
// overlay that holds typed fields ever again.
const OFFENDERS = [];
fs.readdirSync(APPDIR).filter(f => f.endsWith('.js')).forEach(function (f) {
  const lines = fs.readFileSync(path.join(APPDIR, f), 'utf8').split('\n');
  lines.forEach(function (ln, i) {
    if (/rrDismissGuard\(/.test(ln)) return;
    if (!/e\.target === ([A-Za-z_$][\w$]*)\b[\s\S]{0,40}\.remove\(\)/.test(ln)) return;
    let st = i;
    for (let j = i; j >= 0; j--) if (lines[j] && !/^\s/.test(lines[j])) { st = j; break; }
    let en = lines.length;
    for (let j = i; j < lines.length; j++) if (/^\}/.test(lines[j])) { en = j; break; }
    const body = lines.slice(st, en).join('\n');
    // barcode.js's two handlers test e.target.getAttribute, not identity, and
    // hold no fields of their own — deliberately left alone.
    if (/<input|<select|<textarea/.test(body) && !/getAttribute/.test(ln)) {
      OFFENDERS.push(f + ':' + (i + 1));
    }
  });
});
ok('no overlay with typed fields hand-rolls its own backdrop dismissal',
   OFFENDERS.length === 0, OFFENDERS.join(', '));

// ════════════════════════════════════════════════════════════════════════
section('E. Planted offenders — every rule above can actually fail');
{
  // 1 — the guard goes back to closing unconditionally: the shipped bug.
  const naive = sGuard
    .replace(/if \(opened !== null && now !== opened\) \{[\s\S]*?return;\s*\}/, '');
  const { api, asked } = build(naive);
  const ov = mkEl('div');
  const inp = mkEl('input', { value: '7' });
  ov.appendChild(inp);
  api.guard(ov);
  inp.value = '150';
  ov.fire('click', { target: ov });
  ok('a guard that closes without asking is caught — THE BUG BRAD REPORTED',
     naive !== sGuard && ov._removed === true && asked.count === 0);

  // 2 — the snapshot is taken but never compared (always looks unchanged).
  const blindSnap = sSnap.replace(/return rrFieldsOf\(ov\)[\s\S]*?\.join\('\\u0001'\);/,
                                  "return '';");
  const b = build(null, null, blindSnap);
  const ov2 = mkEl('div');
  const inp2 = mkEl('input', { value: 'a' });
  ov2.appendChild(inp2);
  b.api.guard(ov2);
  inp2.value = 'b';
  ov2.fire('click', { target: ov2 });
  ok('a snapshot that cannot see a change is caught',
     blindSnap !== sSnap && ov2._removed === true && b.asked.count === 0);

  // 3 — checkboxes read as .value instead of .checked, so ticks look identical.
  const noCheck = "function rrSnapshot(ov) { return rrFieldsOf(ov).map(function (el) { "
                + "return String(el.value == null ? '' : el.value); }).join('\u0001'); }";
  if (noCheck !== sSnap) {
    const c = build(null, null, noCheck);
    const ov3 = mkEl('div');
    const cb = mkEl('input', { type: 'checkbox', checked: false, value: 'on' });
    ov3.appendChild(cb);
    c.api.guard(ov3);
    cb.checked = true;                 // value never moves
    ov3.fire('click', { target: ov3 });
    ok('reading a checkbox by .value instead of .checked is caught',
       ov3._removed === true && c.asked.count === 0);
  } else {
    ok('reading a checkbox by .value instead of .checked is caught', false,
       'the offender did not change the source — has the snapshot moved?');
  }

  // 4 — the BackStack wiring is dropped.
  const noBack = sGuard.replace(/try \{ if \(window\.BackStack[\s\S]*?\} catch \(e\) \{\}/, '');
  const d = build(noBack);
  d.api.guard(mkEl('div'));
  ok('losing the BackStack wiring is caught', noBack !== sGuard && d.wired.length === 0);

  // 5 — the double-guard latch goes, so two handlers stack and it asks twice.
  const noLatch = sGuard.replace(/if \(!ov \|\| ov\._rrGuarded\) return;\s*\n\s*ov\._rrGuarded = true;/,
                                 'if (!ov) return;');
  if (noLatch !== sGuard) {
    const e = build(noLatch);
    const ov5 = mkEl('div');
    const i5 = mkEl('input', { value: '1' });
    ov5.appendChild(i5);
    e.api.guard(ov5); e.api.guard(ov5);
    i5.value = '2';
    e.asked.answer = false;
    ov5.fire('click', { target: ov5 });
    ok('losing the double-guard latch is caught', e.asked.count === 2);
  } else {
    ok('losing the double-guard latch is caught', false, 'offender did not apply');
  }

  // 6 — the call-site scan must FIRE on a newly hand-rolled backdrop remove,
  //     and must NOT fire on a read-only one. Both halves, or it is worthless.
  const fakeTyped = "function _newThing() {\n  var ov = 1;\n  ov.innerHTML = '<input id=\"x\">';\n  ov.onclick = function (e) { if (e.target === ov) ov.remove(); };\n}";
  const fakePlain = "function _newPlain() {\n  var ov = 1;\n  ov.innerHTML = '<p>hi</p>';\n  ov.onclick = function (e) { if (e.target === ov) ov.remove(); };\n}";
  function scan(src) {
    const lines = src.split('\n'); const hits = [];
    lines.forEach(function (ln, i) {
      if (/rrDismissGuard\(/.test(ln)) return;
      if (!/e\.target === ([A-Za-z_$][\w$]*)\b[\s\S]{0,40}\.remove\(\)/.test(ln)) return;
      let st = i; for (let j = i; j >= 0; j--) if (lines[j] && !/^\s/.test(lines[j])) { st = j; break; }
      let en = lines.length; for (let j = i; j < lines.length; j++) if (/^\}/.test(lines[j])) { en = j; break; }
      if (/<input|<select|<textarea/.test(lines.slice(st, en).join('\n'))) hits.push(i + 1);
    });
    return hits;
  }
  ok('the scan FIRES on a new hand-rolled backdrop remove with a field', scan(fakeTyped).length === 1);
  ok('…and does NOT fire on a read-only popup', scan(fakePlain).length === 0);
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
