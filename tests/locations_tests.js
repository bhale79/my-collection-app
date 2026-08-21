// ═══════════════════════════════════════════════════════════════
// locations_tests.js — Session 82, two-level storage locations.
//
// Brad's rule: a location holds the totes/shelves inside it, and Location
// Detail should suggest only the ones belonging to the location on THAT item.
// Older saved locations have no `details` key at all and must keep working.
//
// Run:  node tests/locations_tests.js
// ═══════════════════════════════════════════════════════════════
let store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
global.window = global.window || {};
// config.js is the whole app's config; pull out just the location helpers.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'config.js'), 'utf8');
['rrSavedLocations', 'rrLocationDetails', 'rrDatalistFor'].forEach(name => {
  const i = src.indexOf('window.' + name + ' = function');
  if (i < 0) throw new Error('missing ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) { eval(src.slice(i, k + 1) + ';'); break; } }
  }
});

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}
const set = v => { store['lv_saved_locations'] = JSON.stringify(v); };

// ── old data must survive ───────────────────────────────────────
set([{ name: 'Basement', type: 'Room' }]);           // no details key at all
const old = window.rrSavedLocations();
ok('a location saved before this feature still loads', old.length === 1 && old[0].name === 'Basement');
ok('...and reads as having no details yet', Array.isArray(old[0].details) && old[0].details.length === 0);
ok('...and asking for its details is safe', window.rrLocationDetails('Basement').length === 0);

// ── the two levels ──────────────────────────────────────────────
set([
  { name: 'Room 107', type: 'Room', details: ['Rack 1 Shelf 1', 'Rack 6 Shelf 3'] },
  { name: 'Room 106', type: 'Room', details: ['Tote 23', 'Tote 24'] },
]);
ok('details are scoped to their own location',
   window.rrLocationDetails('Room 107').join('|') === 'Rack 1 Shelf 1|Rack 6 Shelf 3');
ok('the other room offers only its own', window.rrLocationDetails('Room 106').join('|') === 'Tote 23|Tote 24');
ok('matching ignores case and stray spaces', window.rrLocationDetails('  room 106 ').length === 2);

// A blank or unknown location falls back to everything. A suggestion list
// that empties itself the moment you mistype the box above would be worse
// than no list at all.
ok('a blank location offers every detail', window.rrLocationDetails('').length === 4);
ok('an unknown location offers every detail', window.rrLocationDetails('Garage').length === 4);

// ── the datalist helper ─────────────────────────────────────────
const dl = window.rrDatalistFor('x-list', ['Tote 23', 'Tote 24']);
ok('datalist points the input at itself', dl.attr === ' list="x-list"');
ok('datalist lists the values', (dl.html.match(/<option/g) || []).length === 2);
ok('nothing to suggest means no markup at all',
   window.rrDatalistFor('y', []).attr === '' && window.rrDatalistFor('y', ['', '  ']).html === '');
const esc = window.rrDatalistFor('z', ['Tote "A" & B']);
ok('values are escaped', esc.html.indexOf('&quot;') > 0 && esc.html.indexOf('&amp;') > 0);

// ── junk in the store must not break the app ────────────────────
store['lv_saved_locations'] = 'not json at all';
ok('corrupt storage returns an empty list, not a crash', window.rrSavedLocations().length === 0);
set([null, { name: '' }, { name: 'Shed' }]);
ok('empty and malformed entries are dropped',
   window.rrSavedLocations().length === 1 && window.rrSavedLocations()[0].name === 'Shed');

// ── the UI halves are wired ─────────────────────────────────────
const prefs = fs.readFileSync(path.join(__dirname, '..', 'app', 'prefs.js'), 'utf8');
const wiz = fs.readFileSync(path.join(__dirname, '..', 'app', 'wizard.js'), 'utf8');
const coll = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-collection.js'), 'utf8');
ok('preferences can add a detail inside a location', /function _addLocDetail/.test(prefs));
ok('preferences can remove one', /function _deleteLocDetail/.test(prefs));
ok('seeding pulls the detail level too', /pd\.locationDetail/.test(prefs));
ok('the wizard offers saved locations', /rrDatalistFor\('wiz-loc-list'/.test(wiz));
ok('the wizard scopes Location Detail to the location', /f\.scopedTo === 'location'[\s\S]{0,200}rrLocationDetails/.test(wiz));
ok('the wizard re-scopes when the location changes', /function _wizRefreshLocDetails/.test(wiz));
ok('the edit panel offers the same lists', /suggest === 'locationDetails'[\s\S]{0,120}rrLocationDetails/.test(coll));

console.log('');
console.log(fail === 0 ? 'ALL LOCATION TESTS GREEN (' + pass + ')' : fail + ' FAILING of ' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
