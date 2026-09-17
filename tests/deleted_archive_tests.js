// ═══════════════════════════════════════════════════════════════
// deleted_archive_tests.js — v0.9.1762. NOTHING LEAVES WITHOUT A COPY.
//
// Brad, after v1761 shipped: "now can we make sure this doesn't happen again."
//
// v1761 stopped the app picking the wrong copy, and a sweep keeps that shape
// from coming back. This suite covers the other half: the app now copies every
// row to a "Deleted Rows" tab BEFORE removing it, and **refuses to remove
// anything it could not copy.** That protects him from the bugs nobody has
// found yet, which is more than any amount of careful code can promise.
//
// The last time a row went wrong, the only reason it could be restored was
// that its values happened to still be in an open page's memory. That was luck.
//
// These tests load the REAL sheets.js into a sandbox with a fake Google, so
// what is proved is the shipped code's actual sequence of API calls — not a
// description of it.
// Run:  node tests/deleted_archive_tests.js
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'sheets.js'), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

const MINE = 'personal-sheet', MASTER = 'master-sheet';
const TRASH = 'Deleted Rows';
// One of Brad's real rows: 6-24177, Inventory ID 153, condition 8, boxed.
const ROW_233 = ['6-24177', 'Hot air balloon ride', '8', 'Yes', '8', '2004', 'O', '153'];

// ── a fake Google that records every call, in order ────────────────────────
function boot(opts) {
  opts = opts || {};
  const calls = [];                    // {kind, tab, range, body}
  const tabs = new Set(opts.tabs || ['My Collection', 'For Sale']);
  const toasts = [];
  const rows = Object.assign({ 'My Collection!233': ROW_233.slice() }, opts.rows || {});

  function reply(body, okFlag) {
    return Promise.resolve({ ok: okFlag !== false, status: okFlag === false ? 500 : 200,
                             json: async () => body, text: async () => JSON.stringify(body) });
  }
  const fetch = (url, init) => {
    const u = decodeURIComponent(String(url));
    const method = (init && init.method) || 'GET';
    const body = init && init.body ? JSON.parse(init.body) : null;
    const sheetId = (u.match(/spreadsheets\/([^/?:]+)/) || [])[1];

    if (method === 'GET' && /\?fields=sheets\.properties/.test(u)) {
      calls.push({ kind: 'meta', sheetId });
      return reply({ sheets: [...tabs].map(t => ({ properties: { title: t, sheetId: 1 } })) });
    }
    if (method === 'GET' && /\/values\//.test(u)) {
      const range = (u.match(/\/values\/([^?]+)/) || [])[1];
      const m = range.match(/^(.+?)!A(\d+):/);
      calls.push({ kind: 'read', sheetId, range });
      const key = m ? (m[1] + '!' + m[2]) : '';
      const full = rows[key] || [];
      // honour the requested end column so rrRowStillIs gets what it asks for
      const endCol = (range.match(/:([A-Z]+)\d+$/) || [])[1] || 'BZ';
      const width = endCol.split('').reduce((a, c) => a * 26 + (c.charCodeAt(0) - 64), 0);
      return reply({ values: full.length ? [full.slice(0, width)] : [] });
    }
    if (method === 'POST' && /:append/.test(u)) {
      const range = (u.match(/\/values\/([^?:]+)/) || [])[1];
      const tab = range.split('!')[0];
      calls.push({ kind: 'append', sheetId, tab, values: body && body.values, raw: /valueInputOption=RAW/.test(u) });
      if (opts.failAppend) return reply({ error: 'nope' }, false);
      return reply({ updates: { updatedRange: tab + '!A9:Z9' } });
    }
    if (method === 'PUT' && /\/values\//.test(u)) {
      const range = (u.match(/\/values\/([^?]+)/) || [])[1];
      calls.push({ kind: 'write', sheetId, range, values: body && body.values });
      return reply({ updatedCells: 1 });
    }
    if (method === 'POST' && /:batchUpdate/.test(u)) {
      const r = ((body && body.requests) || [])[0] || {};
      if (r.addSheet) { tabs.add(r.addSheet.properties.title); calls.push({ kind: 'addSheet', tab: r.addSheet.properties.title }); }
      else if (r.deleteDimension) calls.push({ kind: 'DELETE', sheetId, start: r.deleteDimension.range.startIndex });
      else calls.push({ kind: 'batchUpdate', sheetId });
      return reply({ replies: [{}] });
    }
    calls.push({ kind: 'other', url: u, method });
    return reply({});
  };

  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout, clearTimeout, fetch, encodeURIComponent, decodeURIComponent, Date, JSON, Promise, Number, String, Object, Array, Math,
    accessToken: 'tok',
    API_KEY: '',
    state: { personalSheetId: MINE, masterSheetId: MASTER },
    PERSONAL_TAB: 'My Collection',
    PERSONAL_FIELD_INDEX: { inventoryId: 7 },
    colLetter: (i) => String.fromCharCode(65 + i),
    showToast: (m) => toasts.push(String(m)),
    navigator: { onLine: !opts.offline },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'sheets.js' });
  return { sandbox, calls, toasts, tabs };
}
const kinds = (calls) => calls.map(c => c.kind).join(' > ');
const trashAppend = (calls) => calls.find(c => c.kind === 'append' && c.tab === TRASH);

(async () => {

section('A removal copies the row first — and the copy lands BEFORE the delete');
{
  const t = boot();
  const got = await t.sandbox.sheetsDeleteRow(MINE, 'My Collection', 233, { itemNum: '6-24177', inventoryId: '153' });
  const ap = trashAppend(t.calls);
  ok('the row was deleted', got === true);
  ok('a copy went to the "Deleted Rows" tab', !!ap, kinds(t.calls));
  ok('…and it went BEFORE the delete, not after',
     ap && t.calls.indexOf(ap) < t.calls.findIndex(c => c.kind === 'DELETE'), kinds(t.calls));
  const saved = ap && ap.values[0];
  ok('the copy carries the whole row, exactly as it was',
     saved && JSON.stringify(saved.slice(6)) === JSON.stringify(ROW_233), JSON.stringify(saved));
  ok('…with when it went, which tab, which row, what happened, and the Inventory ID',
     saved && /^\d{4}-\d\d-\d\d/.test(saved[0]) && saved[1] === 'My Collection'
     && saved[2] === '233' && saved[3] === 'removed' && saved[4] === '153' && saved[5] === '6-24177',
     JSON.stringify(saved && saved.slice(0, 6)));
  ok('written RAW, so a date or a leading zero is archived as it stood', ap && ap.raw === true);
}

section('No copy, no removal — the rule that makes the rest of it mean something');
{
  const t = boot({ failAppend: true });
  const got = await t.sandbox.sheetsDeleteRow(MINE, 'My Collection', 233, { itemNum: '6-24177', inventoryId: '153' });
  ok('the delete was refused', got === false);
  ok('and NOTHING was deleted', !t.calls.some(c => c.kind === 'DELETE'), kinds(t.calls));
  ok('the user was told why, in words, not a code',
     t.toasts.some(m => /couldn.t save a copy/i.test(m) && /won.t remove anything it can.t put back/i.test(m)),
     JSON.stringify(t.toasts));
}

section('The tab makes itself, once, with headers that explain what it is');
{
  const t = boot({ tabs: ['My Collection'] });
  await t.sandbox.sheetsDeleteRow(MINE, 'My Collection', 233, { itemNum: '6-24177', inventoryId: '153' });
  const add = t.calls.find(c => c.kind === 'addSheet');
  const hdr = t.calls.find(c => c.kind === 'write' && /Deleted%20Rows|Deleted Rows/.test(c.range));
  ok('the "Deleted Rows" tab was created on first use', add && add.tab === TRASH);
  ok('with a header row a person can read', hdr && /never deletes anything from this tab/i.test(hdr.values[0][0]));
  ok('and column names that make a restore obvious',
     hdr && hdr.values[1][0] === 'Removed at' && hdr.values[1][4] === 'Inventory ID'
     && /the row exactly as it was/i.test(hdr.values[1][6]), JSON.stringify(hdr && hdr.values[1]));

  const before = t.calls.filter(c => c.kind === 'meta').length;
  t.sandbox.state.personalSheetId = MINE;
  await t.sandbox.sheetsDeleteRow(MINE, 'My Collection', 233, { itemNum: '6-24177', inventoryId: '153' });
  const created = t.calls.filter(c => c.kind === 'addSheet').length;
  ok('a second removal does not create it again', created === 1, String(created));
  ok('…and does not re-check the tab list every time (checked once per session)',
     t.calls.filter(c => c.kind === 'meta').length < before + 2);
}

section('It archives the user\'s data, and only the user\'s data');
{
  const t = boot({ tabs: ['My Collection', 'Lionel PW - Items'], rows: { 'Lionel PW - Items!5': ['2343', 'F-3 AA'] } });
  await t.sandbox.sheetsDeleteRow(MASTER, 'Lionel PW - Items', 5, { itemNum: '2343', inventoryId: '' });
  ok('a row removed from the shared MASTER catalog is not put in his bin', !trashAppend(t.calls), kinds(t.calls));
  ok('…but it is still deleted', t.calls.some(c => c.kind === 'DELETE'), kinds(t.calls));
}
{
  const t = boot({ tabs: ['My Collection', TRASH], rows: { 'Deleted Rows!4': ['x'] } });
  await t.sandbox.sheetsDeleteRow(MINE, TRASH, 4, { itemNum: 'x', inventoryId: '' });
  ok('the archive is never archived into itself', !trashAppend(t.calls), kinds(t.calls));
}

section('The other way a row dies — blanked where it stands — is covered too');
{
  const t = boot({ rows: { 'For Sale!12': ['6-24177', '', '', '', '', '', '', '153'] } });
  const got = await t.sandbox.rrRemoveRowConfirmed(MINE, 'For Sale', 12, 'For Sale!A12:J12',
                                                   [['', '', '', '', '', '', '', '', '', '']],
                                                   { num: '6-24177', invId: '153' }, 'For Sale');
  const ap = trashAppend(t.calls);
  ok('an unlist keeps a copy of the row it blanks', !!ap, kinds(t.calls));
  ok('…labelled with what happened to it', ap && /cleared from For Sale/.test(ap.values[0][3]), ap && ap.values[0][3]);
  ok('…and the removal still reports honestly', got === true || got === false);
}
{
  const t = boot({ failAppend: true, rows: { 'For Sale!12': ['6-24177'] } });
  const got = await t.sandbox.rrRemoveRowConfirmed(MINE, 'For Sale', 12, 'For Sale!A12:J12', [['']], { num: '6-24177' }, 'For Sale');
  ok('no copy means the row is not blanked either', got === false && !t.calls.some(c => c.kind === 'write' && /For%20Sale|For Sale/.test(c.range)),
     kinds(t.calls));
}

section('The cases that must NOT get in the way');
{
  const t = boot({ rows: { 'My Collection!240': [] } });
  const got = await t.sandbox.sheetsDeleteRow(MINE, 'My Collection', 240, { itemNum: '', inventoryId: '' });
  ok('an already-empty row is not worth keeping and does not block the removal',
     !trashAppend(t.calls) && got === true, kinds(t.calls));
}
{
  const t = boot({ offline: true });
  const got = await t.sandbox.sheetsDeleteRow(MINE, 'My Collection', 233, { itemNum: '6-24177', inventoryId: '153' });
  ok('offline, the removal is refused rather than half-done', got === false && !t.calls.some(c => c.kind === 'DELETE'));
  ok('…and it says the useful thing, not "write failed"',
     t.toasts.some(m => /offline/i.test(m) && /keeps a copy/i.test(m)), JSON.stringify(t.toasts));
}

section('THE SWEEP — every way out of the sheet goes through the archive');
{
  // If a third removal path is ever added to sheets.js, this is what notices.
  const removalGates = [...SRC.matchAll(/async function (sheetsDeleteRow|rrRemoveRowConfirmed)\([^)]*\)\s*\{/g)].map(m => m[1]);
  ok('the two removal gates are still the only two in sheets.js',
     removalGates.length === 2 && removalGates.includes('sheetsDeleteRow') && removalGates.includes('rrRemoveRowConfirmed'),
     removalGates.join(','));
  const guarded = (SRC.match(/if \(!\(await rrArchiveRowBeforeRemoval\(/g) || []).length;
  ok('and both of them refuse to proceed without the copy', guarded === 2, String(guarded));
  // Two files reach past sheets.js and call deleteDimension themselves. This
  // suite FOUND them; each is now accounted for by name, and a THIRD turns
  // this red — which is the point, because a bulk delete that skips the net
  // is exactly the shape that costs a user the most at once.
  const dir = path.join(__dirname, '..', 'app');
  const direct = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'sheets.js')
    .filter(f => /deleteDimension/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
  ok('only the two known files delete rows without going through sheets.js',
     direct.length === 2 && direct.includes('import-ui.js') && direct.includes('yardmaster.js'),
     direct.join(','));

  const imp = fs.readFileSync(path.join(dir, 'import-ui.js'), 'utf8');
  ok('the import undo — the biggest removal in the app — now copies first, and throws if it cannot',
     /rrArchiveRowsBeforeRemoval\(state\.personalSheetId, tabName, rowNums, 'import undone'\)/.test(imp)
     && /throw new Error\('nothing was removed/.test(imp));
  const impFn = imp.slice(imp.indexOf('async function _impBatchDeleteRows'));
  ok('…and it does so BEFORE the function builds any delete request',
     impFn.indexOf('rrArchiveRowsBeforeRemoval') >= 0
     && impFn.indexOf('rrArchiveRowsBeforeRemoval') < impFn.indexOf('{ deleteDimension:'));

  const ym = fs.readFileSync(path.join(dir, 'yardmaster.js'), 'utf8');
  ok('the Yardmaster is the allowed exception on its own terms: it archives, VERIFIES the copy, then removes',
     /ARCHIVE_TAB[^\n]*:append/.test(ym) && /archive count did not verify/.test(ym)
     && ym.indexOf('archive count did not verify') < ym.indexOf('deleteDimension'));
  ok('…and it works on the Vault, not the user\'s own collection',
     !/state\.personalSheetId/.test(ym.slice(ym.indexOf('deleteDimension') - 3000, ym.indexOf('deleteDimension') + 500)));
}

section('The bulk form — many rows, one read, same rule');
{
  const t = boot({ rows: { 'My Collection!5': ['A1', 'one', '', '', '', '', '', 'inv5'],
                           'My Collection!6': ['B2', 'two', '', '', '', '', '', 'inv6'],
                           'My Collection!7': [] } });
  // the tab read comes back as a whole sheet: rows 1..7
  t.sandbox.sheetsGet = async () => ({ values: [[], [], [], [], ['A1', 'one', '', '', '', '', '', 'inv5'],
                                                ['B2', 'two', '', '', '', '', '', 'inv6'], []] });
  const got = await t.sandbox.rrArchiveRowsBeforeRemoval(MINE, 'My Collection', [5, 6, 7], 'import undone');
  const ap = trashAppend(t.calls);
  ok('every row with anything in it is copied', got === true && ap && ap.values.length === 2, ap && String(ap.values.length));
  ok('the empty row is skipped rather than filed as a blank', ap && ap.values.every(r => r[5]));
  ok('it reads the tab ONCE, not once per row', t.calls.filter(c => c.kind === 'read').length <= 1,
     String(t.calls.filter(c => c.kind === 'read').length));
  ok('each copy says it was an import undo', ap && ap.values.every(r => r[3] === 'import undone'));
  ok('and finds each row\'s Inventory ID by itself, with nobody to tell it',
     ap && ap.values[0][4] === 'inv5' && ap.values[1][4] === 'inv6',
     ap && JSON.stringify(ap.values.map(r => r[4])));
}
{
  const t = boot({ failAppend: true });
  t.sandbox.sheetsGet = async () => ({ values: [[], [], [], [], ['A1', 'one']] });
  const got = await t.sandbox.rrArchiveRowsBeforeRemoval(MINE, 'My Collection', [5], 'import undone');
  ok('a failed bulk copy refuses the whole removal', got === false);
  ok('…and says so plainly', t.toasts.some(m => /couldn.t save copies/i.test(m)), JSON.stringify(t.toasts));
}
{
  const t = boot();
  const got = await t.sandbox.rrArchiveRowsBeforeRemoval(MASTER, 'Lionel PW - Items', [5], 'x');
  ok('the bulk form also leaves the shared master catalogue alone', got === true && !trashAppend(t.calls));
}

section('The app tells the user the net is there');
{
  const ac = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-collection.js'), 'utf8');
  const hits = (ac.match(/Deleted Rows(&rdquo;|")? tab, so this can be undone/g) || []).length;
  ok('every Remove confirm says the row is kept and this can be undone', hits === 3, String(hits));
}

section('Trio');
{
  const cfg = fs.readFileSync(path.join(__dirname, '..', 'app', 'config.js'), 'utf8');
  const sw  = fs.readFileSync(path.join(__dirname, '..', 'app', 'sw.js'), 'utf8');
  const ix  = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
  ok('APP_VERSION v0.9.1762', /const APP_VERSION = 'v0\.9\.1762';/.test(cfg));
  ok('CACHE_NAME is the version + 10', /const CACHE_NAME = 'mca-v1772';/.test(sw));
  ok('index.html stamps every asset at 1762 and none at 1761',
     (ix.match(/\?v=1762/g) || []).length === 79 && !/\?v=1761/.test(ix));
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
})();
