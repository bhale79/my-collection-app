#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE GIFT LIST NEVER GUESSES WHO IS READING IT (2026-11-25, [stated] Brad 09:59 CT
// "on the wish list, it says something like this is what she will see. can you
// find this and change she to they" → 10:13 CT "yes").
// The preview screen said "This is exactly what she will see." The family member
// the list goes to can be anyone, so the words say "they".
//   T1  the preview line says "This is exactly what they will see."
//   T2  no words shown on screen in gift-list.js say she / her / he / him / his
//       (comments are not on screen and are skipped)
//   T3  PLANTED: a "she" put back into a shown string is caught by T2's scan
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'gift-list.js'), 'utf8');
let pass = 0, fail = 0;
function ok(n, c, x) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  -> ' + String(x === undefined ? '' : x).slice(0, 300))); c ? pass++ : fail++; }

// the words a person sees: the text inside quotes, on lines that are not comments
function shownGendered(src) {
  const out = [];
  src.split('\n').forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    const code = line.replace(/\/\/.*$/, '');                     // a comment after code
    const strs = code.match(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || [];
    strs.forEach(s => {
      const words = s.replace(/<[^>]*>/g, ' ');                    // tags are not words on screen
      if (/\b(she|her|hers|he|him|his)\b/i.test(words)) out.push((i + 1) + ': ' + s.slice(0, 120));
    });
  });
  return out;
}

ok('T1 the preview says "This is exactly what they will see."', SRC.indexOf('This is exactly what they will see.') >= 0 && SRC.indexOf('what she will see') < 0);
const found = shownGendered(SRC);
ok('T2 nothing shown on the gift list says she / her / he / him / his', found.length === 0, found.join(' | '));
const planted = SRC.replace('This is exactly what they will see.', 'This is exactly what she will see.');
ok('T3 PLANTED: "she" put back into the preview line is caught', planted !== SRC && shownGendered(planted).length === 1);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
