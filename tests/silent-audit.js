// ═══════════════════════════════════════════════════════════════
// silent-audit.js — no control may do nothing without saying so
// Session 94 (Brad: "make sure all the buttons actually work like we
// found today with the photo crop next arrow").
//
// THE CLASS THIS HUNTS. v0.9.1705 fixed the review card's › arrow on a
// phone. The handler existed (button-audit was green), the button was on
// screen at the right size (phone-audit was green) — and pressing it did
// nothing, because the handler fetched #pin-rv-main, found nothing (that
// element only existed in the DESKTOP layout) and returned. Silently.
// Brad pressed it, nothing happened, nothing said why. The bug lived in
// exactly this shape:
//
//     var img = document.getElementById('pin-rv-main');
//     if (!img) return;
//
// So this audit asks, of every control's handler and the functions it
// calls: where does it fetch an element and quietly give up if it is
// missing — and can that element actually be missing? An element that
// index.html always carries is a safe guard. One built only in a layout
// fork (`_wide ? … : …`, IS_MOBILE_UA, innerWidth) is the arrow class.
// One built nowhere at all is a dead control. A bail-out on STATE
// (`if (!_rvGroups) return;`) is listed separately: it may be right, but
// it should say so.
//
// METHOD, same discipline as button-audit: never regex the raw source.
// scanJs() blanks comments and regex literals and keeps strings, so ids
// (which live in strings) and code are both visible and never confused.
//
// This is an AUDIT, not a gate: it writes a report and exits 0. Findings
// become red pins as they are fixed, never before.
// ═══════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');
const { scanJs } = require('./color-count.js');

// scanJs() blanks comments but does not keep the file's LENGTH — a line
// comment comes out one newline longer, a block comment loses its newlines
// — so an index into its output does not name a line in the real file.
// This audit reports file:line to a human, so it needs a scan that keeps
// every character position: comments and regex literals become spaces of
// the same length (newlines kept), strings are kept verbatim. Same rules
// as scanJs, same regex-vs-division heuristic, one extra promise.
function scanKeepLines(src) {
  let out = '', i = 0;
  const n = src.length;
  const blank = t => t.replace(/[^\n]/g, ' ');
  const prevSig = () => { for (let k = out.length - 1; k >= 0; k--) if (!/\s/.test(out[k])) return out[k]; return ''; };
  // `return /^image\//.test(x)` — a regex after a KEYWORD. scanJs' heuristic
  // only knows punctuation, so it read `\//` as a line comment and swallowed
  // the rest of the line, including the `}` that closed the function. That
  // one line made _ensurePage's body run to the end of the file.
  const prevWord = () => { const m = /([A-Za-z_$][\w$]*)\s*$/.exec(out.slice(-40)); return m ? m[1] : ''; };
  const KW = /^(return|typeof|case|in|of|else|do|throw|void|delete|new|yield|await|instanceof)$/;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2; out += blank(src.slice(i, end)); i = end; continue; }
    if (c === '/' && d === '/') { let j = i; while (j < n && src[j] !== '\n') j++; out += blank(src.slice(i, j)); i = j; continue; }
    if (c === '"' || c === "'") {
      const q = c; out += c; i++;
      while (i < n && src[i] !== q) { if (src[i] === '\\') { out += src[i]; i++; } out += src[i]; i++; }
      out += (src[i] || ''); i++; continue;
    }
    if (c === '`') {
      // A template literal may hold ${ … } with strings, comments and even
      // nested templates inside. Copy the literal text verbatim, and hand
      // each ${ … } back to this same scanner so a `//` in a URL inside it
      // is not read as a comment — the first version desynced on exactly
      // that in wizard.js and blanked the line that creates #wiz-suggestions.
      out += c; i++;
      while (i < n && src[i] !== '`') {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') {
          let j = i + 2, d = 1, q = null;
          for (; j < n && d > 0; j++) {
            const x = src[j];
            if (q) { if (x === '\\') { j++; continue; } if (x === q) q = null; continue; }
            if (x === '"' || x === "'" || x === '`') { q = x; continue; }
            if (x === '{') d++; else if (x === '}') d--;
          }
          out += '${' + scanKeepLines(src.slice(i + 2, j - 1)) + '}';
          i = j; continue;
        }
        out += src[i]; i++;
      }
      out += (src[i] || ''); i++; continue;
    }
    if (c === '/' && (/[(,=:[!&|?{};+\-*%~^]|^$/.test(prevSig()) || KW.test(prevWord()))) {
      let j = i + 1, inClass = false, closed = false;
      for (; j < n; j++) { const x = src[j]; if (x === '\\') { j++; continue; } if (x === '[') inClass = true; else if (x === ']') inClass = false; else if (x === '/' && !inClass) { closed = true; break; } else if (x === '\n') break; }
      if (closed) { let k = j + 1; while (k < n && /[gimsuy]/.test(src[k])) k++; out += blank(src.slice(i, k)); i = k; continue; }
    }
    out += c; i++;
  }
  return out;
}

const APP = path.join(__dirname, '..', 'app');
const OUT = process.env.RR_SILENT_OUT || '/tmp/rr-silent-audit';
fs.mkdirSync(OUT, { recursive: true });

// ── The app's ways of speaking to the user ──────────────────────
// A bail-out that reaches one of these before returning is not silent.
const SPEAKS_RE = /showToast\(|_status\(|rrSyncPill\(|_pinBusyBounce\(|\balert\(|\bconfirm\(|appConfirm\(|appAlert\(|Banner\(|_pinOfflineRefuse\(|rrSaveError\(|_pinStuckStatus\(|showConfirm\(|rrConfirm\(|\.textContent\s*=|innerHTML\s*=|classList\.(add|remove|toggle)\(|style\.display\s*=|\.disabled\s*=/;

// ── Layout / state forks: the arrow class is born here ──────────
const FORK_RE = /\b(_wide|IS_MOBILE_UA|innerWidth|isMobile|_isPhone|isPhone|matchMedia|_rrPhone|_mobile)\b/;

const ATTR_RE = /\bon(click|change|input|submit|keydown|keyup|pointerdown|touchstart|touchend)\s*=\s*(["'])([\s\S]*?)\2/gi;
const CALL_RE = /(?:^|[^\w.$])([A-Za-z_$][\w$]*)\s*\(/g;
const BUILTIN = new Set(('if for while return typeof new delete void in of function switch catch try do else case throw await ' +
  'alert confirm prompt parseInt parseFloat isNaN String Number Boolean Array Object JSON Math Date RegExp Promise Error Set Map ' +
  'encodeURIComponent decodeURIComponent setTimeout setInterval clearTimeout clearInterval requestAnimationFrame fetch btoa atob ' +
  'console window document localStorage sessionStorage event this true false null undefined var calc rgb rgba hsl hsla url ' +
  'translate translateX translateY scale rotate blur min max clamp').split(' '));

// Walk from `from` (which must sit ON an opener) to its matching closer,
// skipping string and template literals — scanJs keeps strings, and the
// HTML this app builds is full of `{` inside them (inline <style>, CSS
// text). The first version counted those and gave functions bodies that
// ran thousands of lines past their real end.
function matchFrom(code, from, open, close) {
  let d = 0;
  for (let i = from; i < code.length; i++) {
    const c = code[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < code.length && code[i] !== q) { if (code[i] === '\\') i++; i++; }
      continue;
    }
    if (c === open) d++;
    else if (c === close) { d--; if (d === 0) return i; }
  }
  return -1;
}

// The hand-rolled scanner above is the fallback. A template literal nested
// inside another template's ${ … } (wizard.js's variation cards) is where it
// gives up — and a real tokenizer is the honest tool for a real language.
// With acorn installed (devDependency), comments and regex literals are
// blanked from exact token positions; strings and templates stay verbatim.
let acorn = null;
try { acorn = require('acorn'); } catch (e) { acorn = null; }
function blankWithAcorn(raw) {
  const comments = [];
  const spans = [];
  for (const tok of acorn.tokenizer(raw, { ecmaVersion: 2022, onComment: comments })) {
    if (tok.type && tok.type.label === 'regexp') spans.push([tok.start, tok.end]);
  }
  comments.forEach(c => spans.push([c.start, c.end]));
  const chars = raw.split('');
  spans.forEach(([a, b]) => { for (let k = a; k < b; k++) if (chars[k] !== '\n') chars[k] = ' '; });
  return chars.join('');
}

function readApp() {
  if (!acorn) console.log('NOTE: acorn is not installed (npm install) — using the fallback scanner; nested template literals may desync a few files.\n');
  return fs.readdirSync(APP).filter(f => /\.js$/.test(f)).map(f => {
    const raw = fs.readFileSync(path.join(APP, f), 'utf8');
    let code;
    try { code = acorn ? blankWithAcorn(raw) : scanKeepLines(raw); }
    catch (e) { console.log('  (acorn could not tokenize ' + f + ': ' + e.message.slice(0, 80) + ' — fallback scanner used)'); code = scanKeepLines(raw); }
    if (code.length !== raw.length) throw new Error('the scan changed the length of ' + f);
    return { file: f, raw, code };
  });
}
const lineOf = (text, at) => text.slice(0, at).split('\n').length;

// ── 1. Every function the app defines, with its body ────────────
// Four definition shapes; the body is taken by brace-matching from the
// first `{` after the parameter list closes (button-audit's lesson: close
// the parameters FIRST, or an unrelated block further down is taken).
function collectFunctions(files) {
  const fns = new Map();   // name -> { file, line, body }
  const DEF = [
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /\bwindow\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\s*\(/g,
    /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\s*\(/g,
    /\bwindow\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g,               // window.x = (a, b) => {
    /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g,   // const x = (a) => {
  ];
  files.forEach(({ file, code }) => {
    DEF.forEach((re, shape) => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(code))) {
        const name = m[1];
        // close the parameter list (string-aware)
        const pOpen = (shape >= 3) ? m.index + m[0].length - 1 : code.indexOf('(', m.index + m[0].length - 1);
        const pClose = matchFrom(code, pOpen, '(', ')');
        if (pClose < 0) continue;
        const i = pClose + 1;
        // arrow shapes must be followed by =>
        const after = code.slice(i, i + 12);
        if (shape >= 3 && !/^\s*=>/.test(after)) continue;
        const b = code.indexOf('{', i);
        if (b < 0 || b - i > 12) continue;
        const e = matchFrom(code, b, '{', '}');
        if (e < 0) continue;
        const body = code.slice(b, e + 1);
        // The same name can be defined twice: the real function, and a thin
        // wrapper that re-assigns window.NAME to add a hook (photo-inbox.js
        // wraps buildDashboard and renderWizardStep). Keep the LONGEST body —
        // the wrapper is a few lines; the audit wants the real thing.
        const prev = fns.get(name);
        if (!prev || body.length > prev.body.length) fns.set(name, { name, file, line: lineOf(code, m.index), start: b, end: e + 1, body, params: code.slice(pOpen + 1, pClose) });
      }
    });
  });
  return fns;
}

// ── 2. Every control: the handler names inline markup calls ─────
function collectControls(files) {
  const refs = [];
  const scanOne = (file, text) => {
    ATTR_RE.lastIndex = 0;
    let m;
    while ((m = ATTR_RE.exec(text))) {
      const body = m[3];
      CALL_RE.lastIndex = 0;
      let c;
      while ((c = CALL_RE.exec(body))) {
        if (BUILTIN.has(c[1])) continue;
        refs.push({ file, at: m.index, line: lineOf(text, m.index), handler: c[1], snippet: body.replace(/\s+/g, ' ').slice(0, 90) });
      }
    }
  };
  files.forEach(({ file, code }) => scanOne(file, code));
  const idx = path.join(APP, 'index.html');
  if (fs.existsSync(idx)) scanOne('index.html', fs.readFileSync(idx, 'utf8'));
  return refs;
}

// ── 3. Where every element id is born ───────────────────────────
// Static: index.html. Dynamic: a JS string that assigns the id. Each
// dynamic birth is tagged with whether a layout fork is in play in the
// same function — the arrow class.
function collectBirths(files, fns) {
  const births = new Map();   // id -> [{ where, forked, fn }]
  const add = (id, rec) => { if (!births.has(id)) births.set(id, []); births.get(id).push(rec); };
  const idx = path.join(APP, 'index.html');
  if (fs.existsSync(idx)) {
    const html = fs.readFileSync(idx, 'utf8');
    const re = /\bid\s*=\s*["']([A-Za-z_][\w-]*)["']/g;
    let m;
    while ((m = re.exec(html))) add(m[1], { where: 'index.html:' + lineOf(html, m.index), forked: false, static: true });
  }
  const enclosing = (file, at) => enclosingFn(fns, file, at);
  files.forEach(({ file, code }) => {
    // v0.9.1710: [A-Za-z] missed every id that begins with an underscore
    // (_part-modal, _part-desc, _grpfs-price-input, _inst-desc…), so their
    // births were invisible and every lookup of them read as NEVER-CREATED.
    const re = /\bid\s*=\s*\\?["']([A-Za-z_][\w-]*)\\?["']|\.id\s*=\s*['"]([A-Za-z_][\w-]*)['"]|\bid:\s*['"]([A-Za-z_][\w-]*)['"]/g;
    let m;
    while ((m = re.exec(code))) {
      const id = m[1] || m[2] || m[3];
      const fn = enclosing(file, m.index);
      // A fork counts when a layout/state fork sits in the same function
      // BEFORE the birth — the branch decides what is built.
      let forked = false;
      if (fn) forked = FORK_RE.test(code.slice(fn.start, m.index));
      add(id, { where: file + ':' + lineOf(code, m.index), forked: !!forked, fn: fn ? fn.name : '', static: false });
    }
  });

  // v0.9.1711 — two births the first scanner could not see (both found by
  // hand-checking the sweep-2 list, where they were the only false positives):
  //
  // (a) A PREFIX birth: `id="ptog-${id}"` / `id="thumb-' + fid` / `.id = 'cam-' + n`.
  //     The prefix is recorded; a lookup whose id starts with a recorded prefix is
  //     treated as born (dynamic). Prefixes shorter than 3 characters are ignored —
  //     `id="${x}"` would otherwise match everything.
  // (b) A HELPER birth: `mkDrop('wiz-search-mfr', …)` where mkDrop's body writes
  //     its parameter into an id (`id="' + fieldId + '"`, `.id = fieldId`,
  //     `id="${fieldId}"`). For every app function whose body does that with one
  //     of its parameters, each call site's literal string in that argument
  //     position is a birth.
  births.prefixes = new Set();
  files.forEach(({ file, code }) => {
    const re = /\bid\s*=\s*\\?["']([A-Za-z_][\w-]*?)(?:\$\{|["']\s*\+)|\.id\s*=\s*['"]([A-Za-z_][\w-]*?)['"]\s*\+/g;
    let m;
    while ((m = re.exec(code))) {
      const pre = m[1] || m[2];
      if (pre && pre.length >= 3) births.prefixes.add(pre);
    }
  });
  const makers = [];   // { name, argIndex }
  fns.forEach(fn => {
    if (!fn.params) return;
    const params = fn.params.split(',').map(x => x.trim().replace(/=.*$/, '').trim()).filter(x => /^[A-Za-z_$][\w$]*$/.test(x));
    params.forEach((pname, i) => {
      const esc = pname.replace(/\$/g, '\\$');
      const uses = new RegExp(
        '\\bid\\s*=\\s*\\\\?["\'](?:\\\\?["\'])?\\s*\\+\\s*' + esc + '\\b' +   // id="' + fieldId  (one quote closes the HTML attr, one the JS string)
        '|\\.id\\s*=\\s*' + esc + '\\b' +                                  // el.id = fieldId
        '|\\bid\\s*=\\s*\\\\?["\']\\$\\{\\s*' + esc + '\\s*\\}');            // id="${fieldId}"
      if (uses.test(fn.body)) makers.push({ name: fn.name, argIndex: i });
    });
  });
  files.forEach(({ file, code }) => {
    makers.forEach(mk => {
      const re = new RegExp('\\b' + mk.name.replace(/\$/g, '\\$') + '\\s*\\(', 'g');
      let m;
      while ((m = re.exec(code))) {
        const open = m.index + m[0].length - 1;
        const close = matchFrom(code, open, '(', ')');
        if (close < 0) continue;
        // split the argument list at top-level commas (string-aware, bracket-aware)
        const args = []; let depth = 0, cur = '', i = open + 1;
        for (; i < close; i++) {
          const c = code[i];
          if (c === '"' || c === "'" || c === '`') { const q = c; cur += c; i++; while (i < close && code[i] !== q) { if (code[i] === '\\') { cur += code[i]; i++; } cur += code[i]; i++; } cur += code[i]; continue; }
          if ('([{'.includes(c)) depth++;
          else if (')]}'.includes(c)) depth--;
          if (c === ',' && depth === 0) { args.push(cur); cur = ''; continue; }
          cur += c;
        }
        args.push(cur);
        const arg = (args[mk.argIndex] || '').trim();
        const lit = arg.match(/^['"]([A-Za-z_][\w-]*)['"]$/);
        if (lit) add(lit[1], { where: file + ':' + lineOf(code, m.index), forked: false, fn: mk.name, static: false, helper: true });
      }
    });
  });
  return births;
}

// A lookup id is "born" if it has a recorded birth, or starts with a recorded
// dynamic prefix (`ptog-${id}` births ptog-disclaimer, ptog-location, …).
function bornAnywhere(births, id) {
  if ((births.get(id) || []).length) return true;
  if (births.prefixes) for (const p of births.prefixes) if (id.length > p.length && id.startsWith(p)) return true;
  return false;
}

// The innermost app function whose body contains position `at` in `file`.
function enclosingFn(fns, file, at) {
  let best = null;
  fns.forEach(f => { if (f.file === file && at >= f.start && at < f.end && (!best || (f.end - f.start) < (best.end - best.start))) best = f; });
  return best;
}

// ── 4. Silent bail-outs inside a function body ──────────────────
// Returns [{ kind: 'element'|'state', id, name, line, silent, snippet }]
function bailOutsIn(fn, files) {
  const body = fn.body;
  const out = [];
  // element fetches: NAME = document.getElementById('ID') / querySelector('#ID' or SEL)
  const fetches = new Map();   // var name -> id/selector
  const F1 = /\b(?:var|let|const)?\s*([A-Za-z_$][\w$]*)\s*=\s*(?:document|[A-Za-z_$][\w$]*)\.(?:getElementById|querySelector)\(\s*['"]([^'"]+)['"]\s*(\+?)/g;
  let m;
  while ((m = F1.exec(body))) {
    const isSelector = /querySelector\(/.test(m[0]) && !/^#[\w-]+$/.test(m[2]);
    fetches.set(m[1], isSelector ? '*' + m[2] : (m[3] === '+' ? m[2] + '*' : m[2]));
  }
  // an id built from a variable: NAME = document.getElementById(someVar)
  const F2 = /\b(?:var|let|const)?\s*([A-Za-z_$][\w$]*)\s*=\s*document\.getElementById\(\s*([A-Za-z_$][\w$.]*)\s*\)/g;
  while ((m = F2.exec(body))) fetches.set(m[1], '*' + m[2]);
  // A guard on the ANSWER to a question is not silent: the user just said
  // no (`var ok = confirm(…); if (!ok) return;`). Same for an empty typed
  // value the handler asked for (`var v = prompt(…)`).
  const asked = new Set();
  const A = /\b([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:window\.)?(?:confirm|appConfirm|prompt|rrConfirm|showConfirm|_pinConfirm|rrAsk)\(/g;
  while ((m = A.exec(body))) asked.add(m[1]);
  // guard shapes: if (!X) return …;   if (!X || …) return;   if (!X) { … return; }
  const G = /if\s*\(\s*!\s*([A-Za-z_$][\w$]*)(?:\s*\|\|[^)]*)?\)\s*(\{[^}]*\}|[^\n;]*;)/g;
  while ((m = G.exec(body))) {
    const name = m[1], block = m[2];
    if (!/\breturn\b/.test(block)) continue;
    if (asked.has(name)) continue;                       // user cancelled — silence is right
    const silent = !SPEAKS_RE.test(block);
    const target = fetches.get(name);
    const line = fn.line + body.slice(0, m.index).split('\n').length - 1;
    if (target) out.push({ kind: 'element', id: target.replace(/^#/, ''), name, line, silent, snippet: m[0].replace(/\s+/g, ' ').slice(0, 100) });
    else if (/^(document|window|state|_\w+|\w+)$/.test(name)) out.push({ kind: 'state', name, line, silent, snippet: m[0].replace(/\s+/g, ' ').slice(0, 100) });
  }
  // direct: if (!document.getElementById('ID')) return
  const D = /if\s*\(\s*!\s*document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)\s*\)\s*(\{[^}]*\}|[^\n;]*;)/g;
  while ((m = D.exec(body))) {
    if (!/\breturn\b/.test(m[2])) continue;
    out.push({ kind: 'element', id: m[1], name: '(direct)', line: fn.line + body.slice(0, m.index).split('\n').length - 1, silent: !SPEAKS_RE.test(m[2]), snippet: m[0].replace(/\s+/g, ' ').slice(0, 100) });
  }
  return out;
}

// ── 4b. Guarded no-ops (v0.9.1710) ──────────────────────────────
// The bail-out above is `if (!x) return` — the control gives up. This is its
// quieter twin: `var b = getElementById('id'); if (b) b.style.display = …`.
// Nothing returns, nothing is said, and when that id exists nowhere the line
// simply never runs. Sweep 2 met a whole block of them: the old browse tab
// strip (#btab-items, #btab-sets, …) was removed long ago, but ~40 lines
// across two functions still tried to show, hide, relabel and underline its
// buttons on every era switch and every browse render.
//
// A guard on an element that CAN exist is good defensive code — only a guard
// on an id that is born nowhere is a finding, so this returns candidates and
// main() keeps the ones with no birth.
function guardedNoopsIn(fn) {
  const body = fn.body;
  const fetches = new Map();
  const F1 = /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = F1.exec(body))) fetches.set(m[1], m[2]);
  if (!fetches.size) return [];
  const out = [];
  // if (X) …  /  if (X && …) …  — and NOT a bail-out (no return in the block)
  const G = /if\s*\(\s*([A-Za-z_$][\w$]*)(?:\s*&&[^)]*)?\)\s*(\{[^}]*\}|[^\n;]*;)/g;
  while ((m = G.exec(body))) {
    const id = fetches.get(m[1]);
    if (!id) continue;
    if (/\breturn\b/.test(m[2])) continue;             // that is a bail-out, handled above
    out.push({ id, name: m[1],
               line: fn.line + body.slice(0, m.index).split('\n').length - 1,
               snippet: m[0].replace(/\s+/g, ' ').slice(0, 100) });
  }
  return out;
}

// ── 5. Put it together ──────────────────────────────────────────
module.exports = { scanKeepLines, matchFrom, collectFunctions, collectControls, collectBirths, bornAnywhere, bailOutsIn, guardedNoopsIn, readApp };

// The report runs only when this file is the program (`node tests/silent-audit.js`).
// Required from a test, it just lends its scanners. (A bare top-level `return`
// would do the same job in CommonJS, but tests/syntax-check.js parses every
// file as a plain script, where that is a syntax error.)
function main() {
const files = readApp();
const fns = collectFunctions(files);
const controls = collectControls(files);
const births = collectBirths(files, fns);

// which functions does each function call (only app-defined ones)
function callees(fn) {
  const set = new Set();
  CALL_RE.lastIndex = 0;
  let c;
  while ((c = CALL_RE.exec(fn.body))) if (fns.has(c[1]) && c[1] !== fn.name) set.add(c[1]);
  return [...set];
}

const findings = [];
const seen = new Set();
const handlerNames = [...new Set(controls.map(c => c.handler))].filter(h => fns.has(h));
handlerNames.forEach(h => {
  // depth 2: the handler and what it calls directly
  const chain = [[h]];
  callees(fns.get(h)).forEach(k => chain.push([h, k]));
  chain.forEach(path_ => {
    const fn = fns.get(path_[path_.length - 1]);
    bailOutsIn(fn, files).forEach(b => {
      if (!b.silent) return;
      const key = fn.name + ':' + b.line + ':' + (b.id || b.name);
      if (seen.has(key)) return;
      seen.add(key);
      const born = b.kind === 'element' ? (births.get(b.id) || []) : [];
      // Where do this handler's controls live? A control emitted by the very
      // function that also emits its target can never meet a missing target
      // (the cross-era search button sits inside the banner it acts on).
      const sites = controls.filter(c => c.handler === h);
      const birthFns = new Set(born.map(x => x.fn).filter(Boolean));
      const sameBuilder = sites.length > 0 && birthFns.size > 0 && sites.every(c => {
        if (c.file === 'index.html') return false;
        const f = enclosingFn(fns, c.file, c.at);
        return f && birthFns.has(f.name);
      });
      let klass;
      if (b.kind === 'state') klass = 'STATE';
      else if (/\*/.test(b.id) || /[^\w-]/.test(b.id)) klass = 'DYNAMIC-ID';
      else if (!born.length) klass = 'NEVER-CREATED';
      else if (born.some(x => x.static)) klass = 'STATIC';
      else if (sameBuilder) klass = 'SAME-BUILDER';
      else if (born.every(x => x.forked)) klass = 'FORKED';
      else if (born.some(x => x.forked)) klass = 'FORKED-PARTLY';
      else klass = 'DYNAMIC';
      const where = controls.filter(c => c.handler === h).slice(0, 3).map(c => c.file + ':' + c.line).join(', ');
      findings.push({ klass, control: h, via: path_.join(' → '), fn: fn.name, file: fn.file, line: b.line, id: b.id || '', name: b.name, snippet: b.snippet,
                      births: born.map(x => x.where + (x.forked ? ' (forked in ' + x.fn + ')' : '')).slice(0, 4), controlsAt: where });
    });
  });
});

// GUARDED-NOOP is not reachability-scoped: work done for nothing is worth
// knowing about wherever it sits, and the "born nowhere" filter is strict
// enough that the list stays short.
const noops = [];
fns.forEach(fn => {
  guardedNoopsIn(fn).forEach(g => {
    if (bornAnywhere(births, g.id)) return;             // the element can exist — a fair guard
    noops.push({ fn: fn.name, file: fn.file, ...g });
  });
});

const order = ['NEVER-CREATED', 'FORKED', 'FORKED-PARTLY', 'DYNAMIC', 'DYNAMIC-ID', 'SAME-BUILDER', 'STATIC', 'STATE'];
findings.sort((a, b) => order.indexOf(a.klass) - order.indexOf(b.klass) || a.file.localeCompare(b.file) || a.line - b.line);
const counts = {};
findings.forEach(f => { counts[f.klass] = (counts[f.klass] || 0) + 1; });

console.log('silent-audit — controls: ' + controls.length + ' inline handlers naming ' + handlerNames.length + ' app functions; ' + fns.size + ' functions indexed; ' + births.size + ' element ids born\n');
console.log('GUARDED NO-OPS (an `if (el)` on an id born nowhere, anywhere in the app): ' + noops.length + '\n');
console.log('SILENT BAIL-OUTS reachable from a control (handler, or one call deep):');
order.forEach(k => { if (counts[k]) console.log('  ' + k.padEnd(14) + counts[k]); });
console.log('');
const show = k => {
  const list = findings.filter(f => f.klass === k);
  if (!list.length) return;
  console.log('── ' + k + ' (' + list.length + ') ──');
  list.forEach(f => {
    console.log('  ' + f.file + ':' + f.line + '  ' + f.via + '   ' + (f.id ? '#' + f.id : f.name));
    console.log('      ' + f.snippet);
    if (f.births.length) console.log('      born: ' + f.births.join(' | '));
    if (f.controlsAt) console.log('      control at: ' + f.controlsAt);
  });
  console.log('');
};
['NEVER-CREATED', 'FORKED', 'FORKED-PARTLY', 'DYNAMIC-ID'].forEach(show);
(function () {
  const list = findings.filter(f => f.klass === 'DYNAMIC');
  if (!list.length) return;
  console.log('── DYNAMIC (' + list.length + ') — target built by JS elsewhere than the control; needs eyes ──');
  const byId = {};
  list.forEach(f => { (byId[f.id] = byId[f.id] || []).push(f); });
  Object.keys(byId).forEach(id => {
    const f = byId[id][0];
    console.log('  #' + id.padEnd(28) + ' x' + byId[id].length + '  ' + f.via + '  born ' + f.births.join(' | ').slice(0, 70) + '  control at ' + f.controlsAt.slice(0, 60));
  });
  console.log('');
})();
if (noops.length) {
  console.log('── GUARDED-NOOP (' + noops.length + ') — `if (el) el.…` on an id that is born NOWHERE: the line never runs ──');
  const byId = {};
  noops.forEach(g => { (byId[g.id] = byId[g.id] || []).push(g); });
  Object.keys(byId).sort().forEach(id => {
    const g = byId[id][0];
    console.log('  #' + id.padEnd(26) + ' x' + byId[id].length + '  ' + g.file + ':' + g.line + '  in ' + g.fn);
    console.log('      ' + g.snippet);
  });
  console.log('');
}
fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify({ counts, findings, guardedNoops: noops }, null, 1));
console.log('Report: ' + path.join(OUT, 'findings.json'));
process.exit(0);   // an audit, not a gate — findings are for reading, never for failing a build
}
if (require.main === module) main();
