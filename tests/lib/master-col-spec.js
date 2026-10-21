// tests/lib/master-col-spec.js — v0.9.2014.
// The app reads every master tab through ONE alias list: MASTER_COL_SPEC +
// _normHdr in app/app-data.js ('Item #' = Item Number, 'Item Description' =
// Description, 'Variation #' = Variation …). Since v0.9.2014 the Office's
// Commit writes through that same list (yardmaster.js _ymHeaderField). Test
// harnesses that lift Office code out of yardmaster.js get the list from HERE,
// sliced out of app-data.js itself — never a copy typed into a test.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATA = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'app-data.js'), 'utf8');
const a = DATA.indexOf('function _normHdr(');
const b = DATA.indexOf('const MASTER_COL_SPEC = [');
const e = DATA.indexOf('\n];', b);
if (a < 0 || b < 0 || e < 0) throw new Error('master-col-spec: MASTER_COL_SPEC / _normHdr not found in app-data.js');
// the normaliser (one small function) + the list, exactly as the app has them
const fnEnd = DATA.indexOf('\n}\n', a) + 2;
const SRC = DATA.slice(a, fnEnd) + '\n' + DATA.slice(b, e + 3) + '\n';
const box = {};
vm.runInNewContext(SRC + 'this.MASTER_COL_SPEC = MASTER_COL_SPEC; this._normHdr = _normHdr;', box);

module.exports = { SRC, MASTER_COL_SPEC: box.MASTER_COL_SPEC, _normHdr: box._normHdr };
