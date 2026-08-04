// ═══════════════════════════════════════════════════════════════
// button-audit.js — every button does something
// v0.9.1328 (Brad: "make sure all buttons work.")
//
// The app builds its UI by generating HTML strings, so a button's
// handler is a NAME INSIDE A STRING. Nothing checks that the name
// resolves. Rename a function, or delete one, and the button stays
// on screen looking perfectly clickable while doing nothing — the
// only trace is a ReferenceError in a console the user does not have
// open.
//
// This has bitten the project repeatedly and in more than one shape:
//   • v0.9.1134's reader-audit Stop was built as an HTML STRING and
//     handed to a status function that escapes HTML, so the user read
//     the literal text `<button onclick="...">Stop</button>`. The
//     cancel function existed and was unreachable.
//   • _pinAutoReadCancel existed, worked, and was called by nothing —
//     found and wired in v0.9.1324.
//   • openMigrationModal() had no caller; _isAdmin was never defined
//     anywhere in the repo.
//
// So this scanner answers three separate questions:
//
//   ORPHAN HANDLER  — an onclick names something that does not exist.
//                     The button is dead. This is the fatal class.
//   ESCAPED BUTTON  — button HTML is passed to a function that escapes
//                     it, so it renders as visible text.
//   DEAD HANDLER    — a window-exported handler nothing ever calls.
//                     Not fatal: either a missing button or removable
//                     code. Reported, not enforced, because plenty of
//                     handlers are legitimately called from other JS.
//
// METHOD: this does NOT regex the raw source. It reuses scanJs() from
// color-count.js, which walks the file always knowing whether it is in
// code, a string, a template, a regex or a comment. Four separate
// defects in this project have been the same mistake — a regex cannot
// tell code from a string from a comment — and a button audit that
// counted handler names inside comments would be exactly the fifth.
// ═══════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');
const { scanJs } = require('./color-count.js');

const APP = path.join(__dirname, '..', 'app');

// ── What counts as a handler reference ──────────────────────────
// Inline handler attributes as they appear inside generated markup.
// The value can be any expression, so we pull out every identifier
// that is being CALLED — `foo(...)` — and ignore property access on
// an object (`a.b()`), which cannot be checked from source alone.
const ATTR_RE = /\bon(click|change|input|submit|keydown|keyup|focus|blur|mouseenter|mouseleave|touchstart|touchend)\s*=\s*(["'])([\s\S]*?)\2/gi;
const CALL_RE = /(?:^|[^\w.$])([A-Za-z_$][\w$]*)\s*\(/g;

// Identifiers that are language or browser built-ins, or are provably
// in scope at handler-eval time (handlers run as globals).
const BUILTINS = new Set([
  'if', 'for', 'while', 'return', 'typeof', 'new', 'delete', 'void', 'in', 'of',
  'function', 'switch', 'catch', 'try', 'do', 'else', 'case', 'throw', 'await',
  'alert', 'confirm', 'prompt', 'parseInt', 'parseFloat', 'isNaN', 'String',
  'Number', 'Boolean', 'Array', 'Object', 'JSON', 'Math', 'Date', 'RegExp',
  'Promise', 'Error', 'Set', 'Map', 'encodeURIComponent', 'decodeURIComponent',
  'encodeURI', 'decodeURI', 'setTimeout', 'setInterval', 'clearTimeout',
  'clearInterval', 'requestAnimationFrame', 'fetch', 'btoa', 'atob',
  'console', 'window', 'document', 'localStorage', 'sessionStorage', 'event',
  'this', 'true', 'false', 'null', 'undefined', 'Infinity', 'NaN',
  // CSS functions: hover handlers assign style strings, so `var(--accent)`,
  // `calc(...)` and friends appear INSIDE a handler body. They are CSS, not
  // JavaScript calls. Four of the five "orphans" on the first run were
  // `var(` — a reminder that the scanner also has to know what it is
  // looking at, not just where it is standing.
  'var', 'calc', 'rgb', 'rgba', 'hsl', 'hsla', 'url', 'translate', 'translateX',
  'translateY', 'scale', 'rotate', 'blur', 'linear-gradient', 'color-mix',
  'cubic-bezier', 'clamp', 'min', 'max',
]);

// ── Handlers assembled at render time ───────────────────────────
// `onclick="' + toggleFn(c) + '"` does not name a handler — it names a
// function that RETURNS the handler text, evaluated while the markup is
// built. The real handler cannot be known from source, so these are
// counted and reported separately rather than called orphans. Detected by
// the concatenation itself: a quote closing, a +, and more expression.
const DYNAMIC_RE = /['"]\s*\+|\+\s*['"]/;

// ── Where a definition can come from ────────────────────────────
// Handlers are evaluated in global scope, so what matters is: is there
// a global by this name? Four ways this app creates one.
const DEF_PATTERNS = [
  /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g,             // function foo()
  /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g,                 // window.foo = ...
  /^\s*(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/gm,
  /\bwindow\[['"]([A-Za-z_$][\w$]*)['"]\]\s*=/g,       // window['foo'] = ...
];

function readAppFiles() {
  return fs.readdirSync(APP)
    .filter(f => /\.js$/.test(f))
    .map(f => ({ file: f, src: fs.readFileSync(path.join(APP, f), 'utf8') }));
}

// Every global name the app defines, from code only (comments blanked,
// strings kept — scanJs keeps strings because most UI text lives there,
// and a definition inside a string is not a definition, but the
// DEF_PATTERNS are specific enough that a false positive would need a
// string containing literal `function name(`, which would be a
// deliberate eval and is reported separately if it ever matters).
function collectDefined(files) {
  const defined = new Map();   // name -> file that defines it
  files.forEach(({ file, src }) => {
    const code = scanJs(src);
    DEF_PATTERNS.forEach(re => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(code))) {
        if (!defined.has(m[1])) defined.set(m[1], file);
      }
    });
  });
  // index.html can define globals too (inline <script>), and it carries
  // real buttons of its own.
  const idx = path.join(APP, 'index.html');
  if (fs.existsSync(idx)) {
    const html = fs.readFileSync(idx, 'utf8');
    DEF_PATTERNS.forEach(re => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(html))) if (!defined.has(m[1])) defined.set(m[1], 'index.html');
    });
  }
  return defined;
}

// Every handler reference, with the file and line it sits on.
function collectHandlers(files) {
  const refs = [];
  const scanOne = (file, text) => {
    ATTR_RE.lastIndex = 0;
    let m;
    while ((m = ATTR_RE.exec(text))) {
      const body = m[3];
      const at = m.index;
      const line = text.slice(0, at).split('\n').length;
      const dynamic = DYNAMIC_RE.test(body);
      CALL_RE.lastIndex = 0;
      let c;
      while ((c = CALL_RE.exec(body))) {
        const name = c[1];
        if (BUILTINS.has(name)) continue;
        refs.push({ file, line, name, attr: 'on' + m[1], dynamic,
                    snippet: body.slice(0, 80) });
      }
    }
  };
  files.forEach(({ file, src }) => scanOne(file, scanJs(src)));
  const idx = path.join(APP, 'index.html');
  if (fs.existsSync(idx)) scanOne('index.html', fs.readFileSync(idx, 'utf8'));
  return refs;
}

// ── The escaped-button class ────────────────────────────────────
// A function that escapes its input, handed markup. We find the escapers
// by their own behaviour (they replace < and >), then look for calls that
// pass a string containing a <button or <a tag.
function findEscapedButtons(files) {
  const hits = [];
  // Escapers, discovered rather than listed.
  const escapers = new Set();
  //
  // ⚠ THE MISTAKE I MADE HERE, TWICE, WRITTEN DOWN SO NOBODY REPEATS IT.
  //
  // First attempt ran the escaper-detector over scanJs() output. scanJs
  // deliberately BLANKS regex literals, and an escaper is recognised by
  // `.replace(/</g, '&lt;')` — a regex literal. So it found ZERO escapers and
  // its "no escaped buttons" pass was vacuous.
  //
  // Second attempt "fixed" that by stripping comments with a plain regex over
  // RAW source. That is this project's oldest bug, and I walked straight into
  // it: nine files contain `accept="image/*"`, the `/*` inside that STRING was
  // read as a comment opener, it paired with the next `*/` far below, and the
  // whole region in between vanished — including the drill line I had just
  // injected to prove the detector worked. The detector reported clean because
  // it could no longer see the code.
  //
  // The fix is to need neither. An escaper is a function whose body produces
  // the STRING '&lt;' — and strings SURVIVE scanJs. So everything below reads
  // scanJs output, comments and regex literals already gone, strings intact.
  // No second parser, no raw-source scanning, nothing to get wrong.
  // Body of the function whose parameter list OPENS at `parenAt`. Close the
  // parameter list first, then take the braced block — an earlier version
  // started scanning for `{` from inside the parameters, so it latched onto
  // some unrelated block further down and reported 49 "escapers" including
  // `select`, `img` and `hay`.
  const bodyOf = (code, parenAt) => {
    let d = 0, i = parenAt;
    for (; i < code.length && i < parenAt + 600; i++) {
      if (code[i] === '(') d++;
      else if (code[i] === ')') { d--; if (d === 0) { i++; break; } }
    }
    // arrow bodies may be an expression rather than a block
    const rest = code.slice(i, i + 2000);
    const brace = rest.indexOf('{');
    const semi = rest.search(/[;\n]/);
    if (brace < 0 || (semi >= 0 && semi < brace)) return rest.slice(0, Math.max(0, semi));
    let e = 0;
    for (let k = brace; k < rest.length; k++) {
      if (rest[k] === '{') e++;
      else if (rest[k] === '}') { e--; if (e === 0) return rest.slice(brace, k); }
    }
    return rest.slice(brace);
  };
  files.forEach(({ src }) => {
    const code = scanJs(src);
    // named functions and arrow/function expressions assigned to a name
    const re = /(?:\bfunction\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b[^(]*)?\()/g;
    let m;
    while ((m = re.exec(code))) {
      const name = m[1] || m[2];
      if (!name) continue;
      const body = bodyOf(code, re.lastIndex - 1);
      // An escaper turns '<' into an entity. Both halves required: plenty of
      // functions mention &lt; in output markup without escaping anything.
      if (/&lt;/.test(body) && /\breplace\s*\(/.test(body)) escapers.add(name);
    }
  });

  // What matters is what is INSIDE the call, not what follows it.
  //
  // An earlier version matched 300 characters AFTER the opening paren and
  // reported 34 hits, every one of them wrong: `_esc(c.phone) + '</a>'`
  // escapes a phone number and the markup merely comes NEXT in the
  // concatenation — the escaper being used exactly right. So read the balanced
  // argument, and ask whether the tag is in the argument.
  const argOf = (text, openIdx) => {
    let d = 0;
    for (let i = openIdx; i < text.length && i < openIdx + 4000; i++) {
      const ch = text[i];
      if (ch === '(') d++;
      else if (ch === ')') { d--; if (d === 0) return text.slice(openIdx + 1, i); }
    }
    return '';
  };
  files.forEach(({ file, src }) => {
    const code = scanJs(src);
    escapers.forEach(fn => {
      const re = new RegExp('(?:^|[^\\w.$])' + fn + '\\s*\\(', 'g');
      let m;
      while ((m = re.exec(code))) {
        const open = code.indexOf('(', m.index);
        if (open < 0) continue;
        const arg = argOf(code, open);
        if (!arg) continue;
        if (/<\s*(button|a|input|select|textarea)[\s>]/i.test(arg)) {
          hits.push({ file, line: code.slice(0, m.index).split('\n').length, escaper: fn,
                      snippet: arg.replace(/\s+/g, ' ').slice(0, 90) });
        }
      }
    });
  });
  return { escapers: [...escapers], hits };
}

function audit() {
  const files = readAppFiles();
  const defined = collectDefined(files);
  const refs = collectHandlers(files);

  const orphans = [];
  const seen = new Set();
  refs.forEach(r => {
    if (defined.has(r.name)) return;
    if (r.dynamic) return;      // handler text is built at render time
    const k = r.name + '@' + r.file + ':' + r.line;
    if (seen.has(k)) return;
    seen.add(k);
    orphans.push(r);
  });

  // Dead handlers: window-exported, referenced by no handler attribute and
  // by no other code. Informational only.
  const referenced = new Set(refs.map(r => r.name));
  const dead = [];
  files.forEach(({ file, src }) => {
    const code = scanJs(src);
    const re = /\bwindow\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function/g;
    let m;
    const BROWSER_HOOKS = new Set(['onload', 'onerror', 'onbeforeunload',
      'onpopstate', 'onresize', 'onhashchange', 'onmessage', 'onunload']);
    while ((m = re.exec(code))) {
      const name = m[1];
      if (referenced.has(name)) continue;
      if (BROWSER_HOOKS.has(name)) continue;   // the browser calls these

      // called from JS anywhere (not as its own definition)?
      // Count every REFERENCE, not just a call with parentheses.
      //
      // Two rounds of false positives taught this. First version required no
      // leading dot, so `window.foo(...)` — how most of these are invoked —
      // read as dead: 87 wrong. Second version required a `(`, so a handler
      // PASSED AS A FUNCTION REFERENCE read as dead too — which is exactly
      // what v0.9.1324 did with _pinAutoReadCancel (`_status(msg, window.
      // _pinAutoReadCancel)`), so the audit would have called the thing it
      // just fixed dead. A name that appears anywhere other than its own
      // definition line is in use, however it is reached.
      const callRe = new RegExp('(?:^|[^\\w$])' + name + '(?![\\w$])', 'g');
      let calls = 0;
      files.forEach(f2 => {
        const c2 = scanJs(f2.src);
        let mm; callRe.lastIndex = 0;
        while ((mm = callRe.exec(c2))) calls++;
      });
      // Subtract the definition itself — `window.NAME = function` mentions the
      // name once by necessity. Anything above one is a real reference.
      calls -= 1;
      // one "call" is the definition's own `window.x = function`, which the
      // regex does not match, so any call at all means it is used.
      // The definition line itself is `window.name = function`, which none of
      // the three call shapes match, so any hit at all means a real caller.
      if (calls <= 0) dead.push({ file, name, line: code.slice(0, m.index).split('\n').length });
    }
  });

  const escaped = findEscapedButtons(files);
  return { defined, refs, orphans, dead, escaped };
}

module.exports = { audit, collectDefined, collectHandlers, findEscapedButtons };

// ── CLI ─────────────────────────────────────────────────────────
if (require.main === module) {
  const r = audit();
  console.log('Button audit — ' + r.refs.length + ' handler references, '
    + r.defined.size + ' globals defined\n');

  const dyn = r.refs.filter(x => x.dynamic).length;
  console.log('  (' + dyn + ' of those are assembled at render time and cannot be checked statically)\n');
  console.log('ORPHAN HANDLERS (button does nothing): ' + r.orphans.length);
  r.orphans.forEach(o => console.log('  ' + o.file + ':' + o.line + '  ' + o.attr
    + '="' + o.name + '(...)"  — not defined anywhere'));

  console.log('\nESCAPED BUTTONS (markup rendered as text): ' + r.escaped.hits.length);
  r.escaped.hits.forEach(h => console.log('  ' + h.file + ':' + h.line
    + '  passed to ' + h.escaper + '()  ' + h.snippet.replace(/\s+/g, ' ')));

  console.log('\nDEAD HANDLERS (exported, never called): ' + r.dead.length);
  r.dead.forEach(d => console.log('  ' + d.file + ':' + d.line + '  window.' + d.name));

  const fatal = r.orphans.length + r.escaped.hits.length;
  console.log('\n' + (fatal ? 'FAILED — ' + fatal + ' button(s) cannot work'
                            : 'ALL PASS — every handler resolves'));
  process.exit(fatal ? 1 : 0);
}
