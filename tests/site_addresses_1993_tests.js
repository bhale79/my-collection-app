#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// EVERY therailroster.com FILE ADDRESS IN THE APP NAMES A FILE THE SITE HAS
// — v0.9.1993
//
// Brad, 2026-10-19, on his sheet's Dashboard: "why does the image not show
// up". The app moved into /app/ (PHASE B) and the conductor picture moved
// with it, but sheet-builder.js still wrote =IMAGE("https://therailroster.com
// /img/conductor-header.png") — an address the site answers with "page not
// found" — into every user's Dashboard. Nothing checked that an address the
// app hands out is a real file.
//
//   A1  every https://therailroster.com/<path>.<ext> written in app/*.js and
//       app/*.html is a file in this repo (the site serves the repo as is)
//   A2  the Dashboard picture is the app's own conductor-header.png
//   P   PLANTED: the v0.9.1992 addresses (/img/conductor-header.png and
//       /conductor-list.png) are caught
// Fast (no browser) — part of the release gate.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
let pass = 0, fail = 0;
function T(n, c, d) { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  -> ' + JSON.stringify(d).slice(0, 600))); c ? pass++ : fail++; }

const RX = /https:\/\/therailroster\.com\/([A-Za-z0-9_\-\/.]+\.(?:png|jpe?g|gif|svg|webp|ico|json|js|css|html|mp4|vtt|pdf))/g;
function addressesIn(text) { const out = []; let m; RX.lastIndex = 0; while ((m = RX.exec(text))) out.push(m[1]); return out; }
function missing(list) { return list.filter(p => !fs.existsSync(path.join(ROOT, p))); }

const files = fs.readdirSync(APP).filter(f => /\.(js|html)$/.test(f));
const found = [];
files.forEach(f => addressesIn(fs.readFileSync(path.join(APP, f), 'utf8')).forEach(p => found.push({ f, p })));
T('A0 the scan finds the app\'s own addresses (share card, Dashboard picture)', found.length >= 2, found);
const bad = found.filter(x => missing([x.p]).length);
T('A1 every therailroster.com file address in app/ is a real file on the site', bad.length === 0, bad);
const sb = fs.readFileSync(path.join(APP, 'sheet-builder.js'), 'utf8');
const hdr = (sb.match(/const CONDUCTOR_HEADER_URL = '([^']+)'/) || [])[1] || '';
T('A2 the Dashboard picture is the app\'s own conductor-header.png, and it exists',
  hdr === 'https://therailroster.com/app/img/conductor-header.png' && fs.existsSync(path.join(APP, 'img', 'conductor-header.png')), hdr);
T('A2 the address is written once (sheet-builder.js uses the constant)', (sb.match(/conductor-header\.png/g) || []).length === 1, (sb.match(/conductor-header\.png/g) || []).length);

const planted = "const A='https://therailroster.com/img/conductor-header.png'; const B='https://therailroster.com/conductor-list.png';";
T('P1 PLANTED: the v0.9.1992 addresses are caught as missing files', missing(addressesIn(planted)).length === 2, missing(addressesIn(planted)));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
