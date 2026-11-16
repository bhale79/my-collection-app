// lionelstore_parts_era_tests.js — RETIRED 2026-11-16 (nolionelstore).
// Lionel's own parts-store catalog left the app until Lionel gives written
// permission ([stated] Brad 2026-11-16 15:09 CT "the parts yes"). Our one shipping
// route cannot delete a file, so this suite stays as a pointer: the rules for the
// take-down live in tests/nolionelstore_tests.js. If the catalog ever comes back,
// restore this file from git history (before 2026-11-16) and retire that one.
const fs = require('fs');
const path = require('path');
const ok = fs.existsSync(path.join(__dirname, 'nolionelstore_tests.js'));
console.log((ok ? '  PASS  ' : '  FAIL  ') + 'retired — the take-down suite nolionelstore_tests.js is present');
console.log('\n' + (ok ? 1 : 0) + ' passed, ' + (ok ? 0 : 1) + ' failed');
process.exit(ok ? 0 : 1);
