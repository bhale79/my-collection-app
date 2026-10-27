// ═══════════════════════════════════════════════════════════════
// dispatch_links_2033_tests.js — v0.9.2033.
//
// Brad (2026-10-27): a Dispatch Board post links to Brian's Train Room's
// YouTube Short — "make the link tappable". The board drew the message as
// plain escaped text, so an address was words, not a link. Now _dbLinkify
// (dispatch-board.js) turns every http(s) address in a message into an
// <a> that opens in a new tab; the text around it is still escaped, the
// address is escaped once, trailing sentence punctuation stays outside.
//
// The real functions (_dbEsc, _dbLinkify, _dbBodyHtml) are lifted out of
// dispatch-board.js and run in Node. Section P plants each old habit back
// and the matching check must go red.
// Run:  node tests/dispatch_links_2033_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const DB = APP('dispatch-board.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return '';
}
function reOf(src) {
  const i = src.indexOf('var _DB_URL_RE');
  if (i < 0) return '';
  return src.slice(i, src.indexOf('\n', i));
}
function lift(src) {
  const body = reOf(src) + '\n' + grab(src, '_dbEsc') + '\n' + grab(src, '_dbLinkify') + '\n' + grab(src, '_dbBodyHtml')
    + '\nreturn { esc: _dbEsc, linkify: typeof _dbLinkify === "function" ? _dbLinkify : null, body: _dbBodyHtml };';
  return new Function(body)();
}

const SHORT = 'https://www.youtube.com/shorts/oKafJyOA1js';

function run(src, planted) {
  const r = {};
  let api;
  try { api = lift(src); } catch (e) { api = null; r.err = String(e); }
  if (!api) { r.loads = false; return r; }
  r.loads = true;
  const html = api.body('Thanks Brian:\n\n' + SHORT + '\n\nGo like and subscribe.');
  r.hasAnchor = html.indexOf('<a ') >= 0;
  r.hrefRight = html.indexOf('href="' + SHORT + '"') >= 0;
  r.newTab = /target="_blank"/.test(html) && /rel="noopener"/.test(html);
  r.textShown = html.indexOf('>' + SHORT + '</a>') >= 0;
  r.paragraphs = (html.match(/<p /g) || []).length === 3;
  // trailing punctuation stays outside the link
  const h2 = api.body('See ' + SHORT + '. Then ' + SHORT + ', and (' + SHORT + ') too!');
  r.tailOut = (h2.match(new RegExp('href="' + SHORT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"', 'g')) || []).length === 3
    && h2.indexOf('</a>.') >= 0 && h2.indexOf('</a>,') >= 0 && h2.indexOf('</a>)') >= 0;
  // words around the link are still escaped; the link is escaped ONCE
  const h3 = api.body('<b>bold</b> & ' + SHORT + '?x=1&y=2 "q"');
  r.escapedAround = h3.indexOf('&lt;b&gt;bold&lt;/b&gt; &amp; ') >= 0 && h3.indexOf('<b>') < 0 && h3.indexOf('&quot;q&quot;') >= 0;
  r.escapedOnce = h3.indexOf('href="' + SHORT + '?x=1&amp;y=2"') >= 0 && h3.indexOf('&amp;amp;') < 0;
  // a message with no address is unchanged from before
  const h4 = api.body('Plain words, no link.\nSecond line.');
  r.plainSame = h4 === '<p style="margin:0 0 0.6em">Plain words, no link.<br>Second line.</p>';
  // http too; a bare domain is NOT a link (no guessing)
  const h5 = api.body('http://example.com and example.com');
  r.httpToo = (h5.match(/<a /g) || []).length === 1 && h5.indexOf('href="http://example.com"') >= 0;
  // null / empty message draws nothing but an empty paragraph
  r.emptyOk = api.body(null) === '<p style="margin:0 0 0.6em"></p>' && api.body('') === '<p style="margin:0 0 0.6em"></p>';
  // the colour is a palette variable, never a literal
  r.paletteColor = /class="db-link"[^>]*color:var\(--t-link\)/.test(html) && !/#[0-9a-f]{3,6}/i.test(html.split('<a ')[1].split('>')[0]);
  return r;
}

section('A — the real code');
const A = run(DB);
ok('A1 _dbLinkify + _dbBodyHtml lift and run', A.loads, A.err);
ok('A2 an address in the message becomes a link', A.hasAnchor);
ok('A3 the link goes to the address as written', A.hrefRight);
ok('A4 it opens in a new tab, no opener', A.newTab);
ok('A5 the address is the link\'s words', A.textShown);
ok('A6 paragraphs still split on blank lines', A.paragraphs);
ok('A7 trailing . , ) stay outside the link', A.tailOut);
ok('A8 words around the link are still escaped', A.escapedAround);
ok('A9 the address is escaped exactly once', A.escapedOnce);
ok('A10 a message with no address draws exactly as before', A.plainSame);
ok('A11 http works; a bare domain is not guessed into a link', A.httpToo);
ok('A12 an empty / null message is safe', A.emptyOk);
ok('A13 the link colour is var(--t-link), no literal', A.paletteColor);

section('B — the board uses it');
ok('B1 both message draws go through _dbBodyHtml', (DB.match(/_dbBodyHtml\(it\.message\)/g) || []).length === 2);
ok('B2 no other place escapes the message on its own', !/_dbEsc\(it\.message\)/.test(DB));

section('P — planted offenders (each must go red)');
const P1 = run(DB.replace('var esc = _dbLinkify(String(msg == null ? \'\' : msg));', 'var esc = _dbEsc(msg);'));
ok('P1 plain escaping (the old code) → A2 red', P1.loads && !P1.hasAnchor);
const P2 = run(DB.replace('target="_blank" rel="noopener" ', ''));
ok('P2 no new tab → A4 red', P2.loads && !P2.newTab);
const P3 = run(DB.replace("var t = url.match(/[.,;:!?)]+$/);", 'var t = null;'));
ok('P3 punctuation swallowed into the link → A7 red', P3.loads && !P3.tailOut);
const P4 = run(DB.replace("out += _dbEsc(text.slice(last, m.index));", 'out += text.slice(last, m.index);'));
ok('P4 words around the link not escaped → A8 red', P4.loads && !P4.escapedAround);
const P5 = run(DB.replace("'<a href=\"' + _dbEsc(url) + '\"", "'<a href=\"' + _dbEsc(_dbEsc(url)) + '\""));
ok('P5 address escaped twice → A9 red', P5.loads && !P5.escapedOnce);
const P6 = run(DB.replace('color:var(--t-link)', 'color:#2980b9'));
ok('P6 a literal link colour → A13 red', P6.loads && !P6.paletteColor);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
