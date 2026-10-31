// ══ tests/lib/inbox-door-roads.js — Photo Inbox → Add → each kind of save ══
//
// v0.9.2072 (PLAN_2026-10-30_INBOX_PAPER_SAVES.md). The roads shared by
// inbox_save_doors_roads_2072_tests.js (the real app) and
// inbox_save_doors_planted_2072_tests.js (each fix undone in a served copy must
// turn its road red). Built on the iPhone harness in ./inbox-roads.js: Mike's
// two photos (m1 = Right Side View, m2) in the inbox, read as 20-20169-3.
//
// A pretend Drive and Sheets record every photo move, rename and row, so a
// road can say exactly where each photo went.
'use strict';
const H = require('./inbox-roads');

// The pretend Google, installed once the Add screen is open (the harness's own
// listing answer is kept for everything that is not a rename).
function stubs(mode) {
  window.__rec = { moves: [], renames: [], rows: [], folders: [], links: [] };
  const dr = window.driveRequest;
  window.driveRequest = async (m, u, body) => { if (m === 'PATCH') { window.__rec.renames.push([String(u), body && body.name]); return {}; } return dr(m, u, body); };
  window.driveMoveFileToFolder = async (id, from, to) => { if (mode === 'partial' && id === 'm2') throw new Error('gone'); window.__rec.moves.push([id, from, to]); };
  window.driveEnsureSetup = async () => {};
  window.driveEnsureItemFolder = async (n) => 'ITEMFID-' + n;
  window.driveFindOrCreateFolder = async (name, parent) => { window.__rec.folders.push([name, parent]); return 'FOLDER-' + String(name).replace(/\s+/g, '_'); };
  window.ensureEphemeraSheets = async () => {};
  window.sheetsAppend = async (sid, range, rows) => { window.__rec.rows.push([range, rows[0]]); return 5; };
  window.sheetsUpdate = async () => ({});
  window.rrVerifiedRowUpdate = async (sid, tab, row, range, vals) => { window.__rec.links.push([range, vals && vals[0] && vals[0][0]]); return true; };
  window._cachePersonalData = () => {};
  if (mode === 'offline') window._offlineMode = true;
}
async function saveFrom(b, stepTest) {
  await b.pg.evaluate(async (src) => {
    const want = new Function('s', 'return (' + src + ')(s);');
    wizard.step = wizard.steps.findIndex(s => want(s));
    try { renderWizardStep(); } catch (e) {}
    try { await wizardNext(); } catch (e) { window.__saveErr = String(e && e.message); }
  }, stepTest.toString());
  await b.pg.waitForTimeout(600);
}
async function after(b) {
  const a = await H.st(b);
  a.rec = await b.pg.evaluate(() => window.__rec);
  a.saveErr = await b.pg.evaluate(() => window.__saveErr || '');
  a.errs = b.errs.slice();
  return a;
}
// ...and then the same photos are looked at again: no "spoken for".
async function lookAgain(b) {
  await H.card(b); await H.tapAdd(b, 700);
  return H.st(b);
}

const DOOR_ROADS = {
  // Paper Item → Catalog. mode: 'ok' | 'offline' | 'partial'
  async catalog(br, mode, served) {
    const b = await H.boot(br, { num: '20-20169-3', mfr: 'MTH' }, served);
    await H.card(b); await H.tapAdd(b);
    const held = Object.keys((await H.st(b)).stage);
    await b.pg.evaluate(() => { _wizSetKind('paper'); }); await b.pg.waitForTimeout(400);
    await b.pg.evaluate(stubs, mode);
    await b.pg.evaluate(() => Object.assign(wizard.data, { eph_paperType: 'Catalog', eph_paperSubType: 'Consumer Postwar', eph_year: '1955', eph_condition: 7 }));
    await saveFrom(b, s => s.id === 'eph_confirm');
    const a = await after(b); a.held = held;
    a.carry = await b.pg.evaluate(() => (typeof rrSaveCarryTake === 'function' ? rrSaveCarryTake() : ''));
    if (mode === 'ok') { await b.pg.evaluate(() => { window._offlineMode = false; }); a.again = await lookAgain(b); }
    await b.ctx.close(); return a;
  },
  // Paper Item → Instruction Sheet: armed at the save, filed by the background
  // mover (which the save's own dashboard build runs).
  async instructionSheet(br, served) {
    const b = await H.boot(br, { num: '20-20169-3', mfr: 'MTH' }, served);
    await H.card(b); await H.tapAdd(b);
    await b.pg.evaluate(() => { _wizSetKind('paper'); }); await b.pg.waitForTimeout(400);
    await b.pg.evaluate(stubs, 'ok');
    await b.pg.evaluate(() => { wizard.data.eph_paperType = 'Instruction Sheet'; wizard.steps = getSteps('paper'); Object.assign(wizard.data, { is_linkedItem: '2343', is_condition: 7 }); });
    await saveFrom(b, s => s.id === 'is_confirm');
    // the save's own dashboard build runs the background mover, as for a train
    const a = await after(b); await b.ctx.close(); return a;
  },
  // A catalog match that is a Science Set or a Construction Set.
  async scienceConstruction(br, kind, served) {
    const row = kind === 'Science Set'
      ? { itemNum: 'A-201', itemType: 'Science Set', roadName: '', description: 'Chemistry Lab', gauge: '', yearProd: '1950', variation: '', _era: 'pw', _tab: 'Lionel PW - Science', manufacturer: 'Lionel' }
      : { itemNum: 'C-310', itemType: 'Construction Set', roadName: '', description: 'Bridge & Tower Builder', gauge: '', yearProd: '1956', variation: '', _era: 'pw', _tab: 'Lionel PW - Construction', manufacturer: 'Lionel' };
    const b = await H.boot(br, { num: row.itemNum, mfr: 'Lionel', extraRows: [row] }, served);
    await H.card(b); await H.tapAdd(b, 1200);
    const before = await H.st(b);
    await b.pg.evaluate(stubs, 'ok');
    await saveFrom(b, s => s.type === 'confirm');
    const a = await after(b); a.before = before; a.num = row.itemNum; a.desc = row.description;
    await b.ctx.close(); return a;
  },
  // The roads that already worked — walked again, must still arm.
  async train(br, served) {
    const b = await H.boot(br, { num: '20-20169-3', mfr: 'MTH' }, served);
    await H.card(b); await H.tapAdd(b);
    await b.pg.evaluate(stubs, 'ok');
    await saveFrom(b, s => s.type === 'confirm');
    const a = await after(b); await b.ctx.close(); return a;
  },
  async paperOther(br, served) {
    const b = await H.boot(br, { num: '20-20169-3', mfr: 'MTH' }, served);
    await H.card(b); await H.tapAdd(b);
    await b.pg.evaluate(() => { _wizSetKind('paper'); }); await b.pg.waitForTimeout(400);
    await b.pg.evaluate(stubs, 'ok');
    await b.pg.evaluate(() => Object.assign(wizard.data, { eph_paperType: 'Other', eph_title: 'Dealer poster', eph_condition: 7 }));
    await saveFrom(b, s => s.id === 'eph_confirm');
    const a = await after(b); await b.ctx.close(); return a;
  },
};

module.exports = { DOOR_ROADS, H };
