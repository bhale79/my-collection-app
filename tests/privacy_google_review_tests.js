#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PRIVACY PAGE — what Google's app review asked for   (site release 2026-11-01)
//
// Google's OAuth review (email 2026-11-01, project lionel-vault) sent the app
// back because the privacy policy did not describe (1) how sensitive data is
// protected and (2) how long Google user data is kept and how it is deleted.
// [stated] Brad 2026-11-01: "yes" to the wording, incl. "delete it within 30 days".
//
// Checks — each also run against a PLANTED page that must make it fail:
//   S  the "How we protect your information" section is there, with the
//      encryption, sign-in (one-hour pass + the relay's renewal key) and
//      narrow-permission lines
//   K  the "How long we keep information, and how to delete it" section is
//      there, with the Google-data line, the 30-day promise and the
//      remove-access address
//   O  the old one-line "Deleting your information" section is gone (one place)
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const PAGE = fs.readFileSync(path.join(__dirname, '..', 'privacy', 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, why) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (why ? '  —  ' + why : '')); }
}

function section(h, title) {
  const i = h.indexOf('<h2>' + title + '</h2>');
  if (i < 0) return '';
  const j = h.indexOf('<h2>', i + 4);
  return h.slice(i, j < 0 ? h.length : j);
}
function checkProtect(h) {
  const s = section(h, 'How we protect your information');
  if (!s) return 'section missing';
  if (!/encrypted \(HTTPS\)/.test(s)) return 'no encryption line';
  if (!/one-hour pass/.test(s) || !/renewal key/.test(s) || !/remove the app's access/.test(s)) return 'no sign-in / renewal-key line';
  if (!/only the pictures you pick/.test(s)) return 'no narrow-permission line';
  return '';
}
function checkKeep(h) {
  const s = section(h, 'How long we keep information, and how to delete it');
  if (!s) return 'section missing';
  if (!/We keep no copy of your Google Sheet, your Drive files or your Google Photos/.test(s)) return 'no Google-data line';
  if (!/delete it within 30 days/.test(s)) return 'no 30-day promise';
  if (!/myaccount\.google\.com\/connections/.test(s)) return 'no remove-access address';
  return '';
}
function checkOld(h) { return /<h2>Deleting your information<\/h2>/.test(h) ? 'old section still there' : ''; }

{ const w = checkProtect(PAGE); ok('S  the protection section is there and complete', !w, w); }
{ const w = checkKeep(PAGE); ok('K  the keep-and-delete section is there and complete', !w, w); }
{ const w = checkOld(PAGE); ok('O  the old "Deleting your information" section is gone', !w, w); }

ok('PLANTED protection section removed → S fails',
   !!checkProtect(PAGE.replace('<h2>How we protect your information</h2>', '<h2>Security</h2>')));
ok('PLANTED renewal-key disclosure removed → S fails',
   !!checkProtect(PAGE.replace(/renewal key/g, 'token')));
ok('PLANTED 30-day promise removed → K fails',
   !!checkKeep(PAGE.replace('delete it within 30 days', 'delete it')));
ok('PLANTED old section put back → O fails',
   !!checkOld(PAGE + '<h2>Deleting your information</h2>'));

console.log('\n' + (fail ? 'FAILED' : 'ALL PRIVACY GOOGLE REVIEW TESTS GREEN') + ' (' + pass + ' passed, ' + fail + ' failed)');
process.exit(fail ? 1 : 0);
