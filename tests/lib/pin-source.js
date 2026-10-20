// ═══════════════════════════════════════════════════════════════════════════
// tests/lib/pin-source.js — THE one way a test reads the Photo Inbox's code.
//
// Brad (2026-10-20): "lets plan the photo inbox split" → "start 1"
// (PLAN_2026-10-20_PHOTO_INBOX_SPLIT.md). The Photo Inbox is moving out of the
// one 13,600-line app/photo-inbox.js into several pieces (photo-inbox*.js).
// A test that reads app/photo-inbox.js by name would quietly stop seeing the
// code that moved — a scan for a forbidden pattern would go green because the
// pattern now lives in a file it never opens. So every test reads the Photo
// Inbox ONLY through this file:
//
//   pinPieceNames()  the pieces, in the order app/index.html loads them —
//                    read from index.html, never typed into a test
//   pinPieces()      { 'photo-inbox.js': text, ... } in that order
//   pinSource()      every piece joined, in load order — "the Photo Inbox"
//   pinRead(name, readFn)  for a list of app files: 'photo-inbox.js' means
//                    the whole Photo Inbox (pinSource); anything else is
//                    readFn(name)
//   pinMerge(files, prefix)  a { fileName: text } map of app files (keys
//                    optionally starting with `prefix`, e.g. 'app/') with the
//                    Photo Inbox pieces taken out and put back as ONE entry,
//                    prefix + 'photo-inbox.js' = pinSource(). A scan that
//                    works file by file — or plants into 'photo-inbox.js' —
//                    then sees the whole feature exactly once.
//   pinHook(src, code, piece)  a test-only door: `code` is put just inside
//                    the end of a piece's wrapper (the FIRST piece unless
//                    named) in `src` — the joined Photo Inbox, planted or not
//                    — where that piece's own names can be seen. Before the
//                    split this was "the last })();"; with pieces, a door
//                    goes into the piece that defines what it opens.
//   pinPieceOf(url)  which piece a request URL asks for (null = not one)
//   pinFulfill(route, url, text)  a browser test serving its own (planted)
//                    copy of the Photo Inbox: the FIRST piece's request gets
//                    the whole text, every other piece an empty script.
//                    Loading the pieces one after another is the same as
//                    loading them joined in one script — each piece is its
//                    own wrapper and they meet only through the page — so a
//                    test plants on pinSource() and serves it with this.
//                    Returns false (handled nothing) for any other URL.
//
// tests/pin_source_tests.js holds the rule: no other test opens a Photo Inbox
// file itself.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '..', '..', 'app');
const PIECE_RE = /<script\s+src="\.\/(photo-inbox(?:-(?!tests\b)[a-z0-9]+)*\.js)(?:\?[^"]*)?"/g;

function pinPieceNames(appDir) {
  const dir = appDir || APP_DIR;
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const out = [];
  let m;
  PIECE_RE.lastIndex = 0;
  while ((m = PIECE_RE.exec(html))) if (out.indexOf(m[1]) === -1) out.push(m[1]);
  if (!out.length) throw new Error('pin-source: app/index.html loads no photo-inbox*.js — the Photo Inbox is missing');
  return out;
}

function pinPieces(appDir) {
  const dir = appDir || APP_DIR;
  const out = {};
  pinPieceNames(dir).forEach(function (n) { out[n] = fs.readFileSync(path.join(dir, n), 'utf8'); });
  return out;
}

function pinSource(appDir) {
  const p = pinPieces(appDir);
  return Object.keys(p).map(function (k) { return p[k]; }).join('\n');
}

function pinRead(name, readFn) {
  const bare = String(name).replace(/^app\//, '');
  if (bare === 'photo-inbox.js') return pinSource();
  return readFn(name);
}

function pinMerge(files, prefix) {
  const pre = prefix || '';
  const names = pinPieceNames();
  const out = {};
  Object.keys(files).forEach(function (k) {
    if (names.indexOf(k.slice(pre.length)) !== -1 && k.indexOf(pre) === 0) return;
    out[k] = files[k];
  });
  out[pre + 'photo-inbox.js'] = pinSource();
  return out;
}

function pinHook(src, code, piece) {
  const names = pinPieceNames();
  const want = piece || names[0];
  const k = names.indexOf(want);
  if (k < 0) throw new Error('pin-source: pinHook — no Photo Inbox piece named ' + want);
  const P = pinPieces();
  const headOf = n => P[n].split('\n').slice(0, 3).join('\n');
  const findOnce = (h, n) => { const at = src.indexOf(h); if (at < 0 || src.indexOf(h, at + 1) >= 0) throw new Error('pin-source: pinHook could not find where ' + n + ' starts'); return at; };
  const start = k === 0 ? 0 : findOnce(headOf(want), want);
  const end = k + 1 < names.length ? findOnce(headOf(names[k + 1]), names[k + 1]) : src.length;
  const cut = src.lastIndexOf('})();', end);
  if (cut < start) throw new Error('pin-source: pinHook found no wrapper end in ' + want);
  return src.slice(0, cut) + code + '\n' + src.slice(cut);
}

function pinPieceOf(url) {
  const bare = String(url || '').split('?')[0];
  const names = pinPieceNames();
  for (let i = 0; i < names.length; i++) if (bare.endsWith('/app/' + names[i])) return names[i];
  return null;
}

function pinFulfill(route, url, text) {
  const piece = pinPieceOf(url);
  if (!piece) return false;
  const first = pinPieceNames()[0];
  const body = piece === first ? String(text) : '// ' + piece + ': served inside ' + first + ' by tests/lib/pin-source.js\n';
  route.fulfill({ body: body, contentType: 'application/javascript' });
  return true;
}

module.exports = { pinPieceNames, pinPieces, pinSource, pinRead, pinMerge, pinHook, pinPieceOf, pinFulfill, APP_DIR };
