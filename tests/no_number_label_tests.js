#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════
// NO-NUMBER LABEL — a piece with no item number never shows "No." before its
// NAME (nonumlabel)   (real Chromium, the REAL app)
//
// [stated] Brad 2026-11-27 08:51 CT sent Bob's (bobbers800) Collection Share
// PDF — his hand-entered Williams Amtrak engine printed "No. Amtrak" — "did bob
// enter this correctly" → 08:52 CT "yes" (plan) → 09:19 CT "yes" (go).
// PLAN_2026-11-27_NO_NUMBER_LABEL.md.
//
// Owner: config.js rrNoNumberName(num, pd) (THE rule: a space, or the copy's
// own Custom Name is what the number slot holds; no copy given → the member's
// own copies of that slot decide) + rrNumLabel(num, pd) ("No. 2343" or the
// name itself). browse.js _noNumTag asks the same rule.
//
//   A  the rule + label for five kinds of copy, with the copy and without it
//   B  the "NO #" tag (browse.js _noNumTag) — on names, never on numbers
//   C  the share PDF (share.js _buildPDF) prints "Amtrak", never "No. Amtrak";
//      a catalog number still prints "No. 2343"
//   D  the Remove prompt (app-collection.js removeCollectionItem) says
//      "Remove Amtrak …" / "Remove No. 2343 …"
//   S  source: the share / sell / contacts / non-item pages write no
//      'No. ' + … of their own (they ask rrNumLabel)
//   P  planted offenders — each rule undone in a served copy must turn red
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  no_number_label_tests needs playwright and it is not installed.'); process.exit(1); }
let JSPDF = '';
try { JSPDF = fs.readFileSync(require.resolve('jspdf/dist/jspdf.umd.min.js'), 'utf8'); }
catch (e) { console.log('FAILED  —  no_number_label_tests needs the jspdf package (node_modules) for the PDF checks.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra == null ? '' : String(extra)).slice(0, 500))); cond ? pass++ : fail++; }

async function scenario(pg) {
  return pg.evaluate(async () => {
    const R = {};
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    window.showToast = () => {};
    window.buildDashboard = () => {};
    const F = PERSONAL_FIELD_INDEX;
    let rowN = 10;
    const copy = (inv, fields) => {
      const r = new Array(PERSONAL_SCHEMA.length).fill('');
      Object.keys(fields).forEach(k => { if (F[k] !== undefined) r[F[k]] = fields[k]; });
      r[F.inventoryId] = inv;
      return rrPersonalRecordFromRow(r, ++rowN);
    };
    state.masterData = [{ itemNum: '2343', variation: '', itemType: 'Diesel', _era: 'pw', _tab: 'Lionel PW - Items', description: 'Santa Fe F3 AA', roadName: 'Santa Fe', rowId: 'RID-2343' }];
    _rebuildMasterIndex();
    state.personalSheetId = 'SHEET';
    state.personalData = {
      'C1': copy('C1', { itemNum: '2343', era: 'pw', masterRowId: 'RID-2343', condition: '8' }),
      'C2': copy('C2', { itemNum: 'Williams · Amtrak · Diesel · #250', era: 'Manual', manufacturer: 'Williams', condition: '7' }),
      'C3': copy('C3', { itemNum: 'Amtrak', customName: 'Amtrak', era: 'Manual', manufacturer: 'Williams', condition: '7' }),
      'C4': copy('C4', { itemNum: '6464-100', era: 'Manual', manufacturer: 'Lionel', condition: '6' }),
      'C5': copy('C5', { itemNum: '6464-200', customName: 'My boxcar', era: 'Manual', manufacturer: 'Lionel', condition: '6' }),
    };
    const P = state.personalData;
    // A — with the copy, and with the bare slot (the member's copies decide)
    R.withPd = ['C1', 'C2', 'C3', 'C4', 'C5'].map(k => rrNumLabel(P[k].itemNum, P[k]));
    R.bare = ['C1', 'C2', 'C3', 'C4', 'C5'].map(k => rrNumLabel(P[k].itemNum));
    R.catalogRow = rrNumLabel('2343', state.masterData[0]);
    R.unknown = rrNumLabel('9999');
    // B — the NO # tag
    R.tag = ['C1', 'C2', 'C3', 'C4', 'C5'].map(k => !!_noNumTag(P[k].itemNum));
    // C — the share PDF, as text
    try {
      const f = Object.assign(_getShareFields(), { photo: false });
      const items = ['C1', 'C3', 'C2'].map(k => ({ itemNum: P[k].itemNum, master: k === 'C1' ? state.masterData[0] : {}, pd: P[k], fs: {} }));
      const blob = await _buildPDF(items, f, '');
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
      R.pdf = s;
    } catch (e) { R.pdfErr = String(e && e.message || e); }
    // D — the Remove prompt (answered "no", so nothing is removed)
    const asked = [];
    const realConfirm = window.appConfirm;
    window.appConfirm = async (m) => { asked.push(String(m)); return false; };
    try { await removeCollectionItem('Amtrak', '', P.C3.row, 'C3'); } catch (e) { asked.push('ERR ' + e.message); }
    try { await removeCollectionItem('2343', '', P.C1.row, 'C1'); } catch (e) { asked.push('ERR ' + e.message); }
    window.appConfirm = realConfirm;
    R.asked = asked;
    R.stillThere = Object.keys(state.personalData).length;
    return R;
  });
}

async function openApp(browser, served) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (/jspdf\.umd\.min\.js$/.test(base)) return r.fulfill({ body: JSPDF, contentType: 'application/javascript' });
    if (!u.startsWith('file://')) return r.abort();
    const name = base.split('/').pop();
    if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  return { pg, errs };
}

const J = (a) => JSON.stringify(a);
const has = (s, t) => String(s || '').indexOf(t) >= 0;
const RULES = {
  A1: ['with the copy: "No. 2343" · the composed name · "Amtrak" · "No. 6464-100" · "No. 6464-200"', r => J(r.withPd) === J(['No. 2343', 'Williams · Amtrak · Diesel · #250', 'Amtrak', 'No. 6464-100', 'No. 6464-200'])],
  A2: ['the bare slot gives the same answers (the member\'s own copies decide)', r => J(r.bare) === J(r.withPd)],
  A3: ['a catalog row and an unknown number stay numbers', r => r.catalogRow === 'No. 2343' && r.unknown === 'No. 9999'],
  B1: ['the "NO #" tag sits on the two names only ("Amtrak" included)', r => J(r.tag) === J([false, true, true, false, false])],
  C1: ['the share PDF prints "Amtrak" and the composed name, never "No. Amtrak"', r => !r.pdfErr && has(r.pdf, '(Amtrak)') && !has(r.pdf, 'No. Amtrak') && !has(r.pdf, 'No. Williams')],
  C2: ['the share PDF still prints "No. 2343" for a catalog copy', r => !r.pdfErr && has(r.pdf, '(No. 2343)')],
  D1: ['Remove asks "Remove Amtrak …" for the named copy and "Remove No. 2343 …" for the catalog copy', r => r.asked.length === 2 && /^Remove Amtrak from your collection\?/.test(r.asked[0]) && /^Remove No\. 2343 from your collection\?/.test(r.asked[1])],
  D2: ['answering no removes nothing', r => r.stillThere === 5],
};

// S — source: the files whose every label now goes through rrNumLabel
const SCAN = ['share.js', 'sell.js', 'contacts.js', 'non-item-detail-config.js'];
function scanOffenders(read) {
  const bad = [];
  SCAN.forEach(f => {
    read(f).split('\n').forEach((line, i) => {
      if (/^\s*\/\//.test(line)) return;
      if (/typeof rrNumLabel === 'function' \? rrNumLabel\(/.test(line)) return;   // the guarded form: the rule, with the old words only where a suite loads the file alone
      if (/['"]No\. ['"]\s*\+/.test(line)) bad.push(f + ':' + (i + 1));
    });
  });
  return bad;
}

(async () => {
  const src = (n) => fs.readFileSync(path.join(APP, n), 'utf8');
  const bad = scanOffenders(src);
  ok('S1 share / sell / contacts / non-item pages write no \'No. \' + … of their own', bad.length === 0, bad.join(', '));
  ok('S2 the scan fires on a planted offender', scanOffenders(n => n === 'sell.js' ? src(n) + "\nvar x = 'No. ' + num;" : src(n)).length === 1);
  ok('S4 …and on a bare one beside a guarded one', scanOffenders(n => n === 'sell.js' ? src(n) + "\nvar y = (typeof rrNumLabel === 'function' ? rrNumLabel(n) : 'No. ' + (n));\nvar x = 'No. ' + num;" : src(n)).length === 1);
  ok('S3 …and not on a commented-out one', scanOffenders(n => n === 'sell.js' ? src(n) + "\n// var x = 'No. ' + num;" : src(n)).length === 0);

  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const o = await openApp(browser, null);
  let R = null;
  try { R = await scenario(o.pg); } catch (e) { ok('scenario runs', false, e.message); }
  if (R) Object.keys(RULES).forEach(k => { let v = false; try { v = !!RULES[k][1](R); } catch (e) {} ok(k + ' ' + RULES[k][0], v, J(Object.assign({}, R, { pdf: (R.pdf || '').length + ' bytes' }))); });
  ok('no page errors', o.errs.length === 0, o.errs.join(' | '));
  await o.pg.close();

  // ── P — planted offenders ──
  const plant = (n, from, to) => { const s = src(n); const c = s.split(from).length - 1; if (c !== 1) throw new Error('plant anchor found ' + c + ' times in ' + n + ': ' + from.slice(0, 60)); return { [n]: s.split(from).join(to) }; };
  const plants = [
    ['P1 the share PDF back to \'No. \' + itemNum', () => plant('share.js', "doc.text((typeof rrNumLabel === 'function' ? rrNumLabel(itemNum, pd) : 'No. ' + (itemNum)) + (varNum", "doc.text('No. ' + itemNum + (varNum"), ['C1']],
    ['P2 the rule ignores the copy\'s Custom Name (the tag asks the bare slot, so it is P5\'s)', () => plant('config.js', "    return !!cn && cn === v;\n", "    return false;\n"), ['A1', 'C1', 'D1']],
    ['P3 the "NO #" tag back to the space-only rule', () => plant('browse.js', "  if (!((typeof rrNoNumberName === 'function') ? rrNoNumberName(v, pd) : v.indexOf(' ') !== -1)) return '';", "  if (v.indexOf(' ') === -1) return '';"), ['B1']],
    ['P4 the Remove prompt back to \'Remove No. \'', () => plant('app-collection.js', "    if (!(await appConfirm('Remove ' + (typeof rrNumLabel === 'function' ? rrNumLabel(itemNum, pdKey && state.personalData[pdKey]) : 'No. ' + (itemNum)) + (_rmVar ? ' (Var. ' + _rmVar + ')' : '') + ' from your collection?", "    if (!(await appConfirm('Remove No. ' + itemNum + (_rmVar ? ' (Var. ' + _rmVar + ')' : '') + ' from your collection?"), ['D1']],
    ['P5 a name with no copy lookup (bare slot = always a number)', () => plant('config.js', "    return named && !numbered;", "    return false;"), ['A2', 'B1']],
  ];
  for (const [name, mkServed, mustRed] of plants) {
    let served; try { served = mkServed(); } catch (e) { ok(name + ' — plant applies', false, e.message); continue; }
    const op = await openApp(browser, served);
    let Rp = null, threw = '';
    try { Rp = await scenario(op.pg); } catch (e) { threw = String(e && e.message || e); }
    const red = mustRed.filter(k => { if (!Rp) return true; try { return !RULES[k][1](Rp); } catch (e) { return true; } });
    ok(name + ' → turns ' + mustRed.join(', ') + ' red', red.length === mustRed.length, 'still green: ' + mustRed.filter(k => red.indexOf(k) < 0).join(', ') + (threw ? ' (scenario threw: ' + threw.slice(0, 120) + ')' : ''));
    await op.pg.close();
  }
  await browser.close();
  console.log((fail ? 'FAILED' : 'PASSED') + '  —  no_number_label: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
