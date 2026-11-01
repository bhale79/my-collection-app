// tests/lib/part-status.js — the REAL part-state helpers, lifted out of
// app/config.js (2026-10-31, the "Ordered" state), for a test sandbox that runs
// one app file on its own. Every screen asks rrPartStatus / rrPartWord /
// rrPartStillNeeded (config.js), so a sandbox without config.js needs them:
//     Object.assign(global, require('./lib/part-status.js'));
// One copy, read from the app — never a hand-written stand-in.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const CFG = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'config.js'), 'utf8');
const a = CFG.indexOf('const RR_PART_STATUS = {');
const b = CFG.indexOf("if (typeof window !== 'undefined') { window.RR_PART_STATUS");
if (a < 0 || b < a) throw new Error('part-status.js: app/config.js has no RR_PART_STATUS block');
const box = {};
vm.createContext(box);
vm.runInContext(CFG.slice(a, b) + '\nthis.out = { RR_PART_STATUS, rrPartStatus, rrPartWord, rrPartStillNeeded };', box);
module.exports = box.out;
