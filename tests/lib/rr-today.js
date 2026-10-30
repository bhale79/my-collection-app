// tests/lib/rr-today.js — the REAL rrToday, lifted out of app/config.js, for a
// test sandbox that runs one app file on its own (v0.9.2044). Since the sweep
// made every "today" in the app come from config.js's rrToday, a sandbox that
// loads yardmaster.js, app-pages.js … without config.js needs it handed in:
//     sandbox.rrToday = require('./lib/rr-today.js');
// One copy, read from the app — never a hand-written stand-in.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const CFG = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'config.js'), 'utf8');
const i = CFG.indexOf('function rrToday(');
if (i < 0) throw new Error('rr-today.js: app/config.js has no rrToday');
let d = 0, k = CFG.indexOf('{', i);
for (; k < CFG.length; k++) { if (CFG[k] === '{') d++; else if (CFG[k] === '}') { d--; if (!d) break; } }
const box = { Date };
vm.createContext(box);
vm.runInContext(CFG.slice(i, k + 1) + '\nthis.rrToday = rrToday;', box);
module.exports = box.rrToday;
