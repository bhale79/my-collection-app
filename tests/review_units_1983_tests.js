#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE REVIEW STEP NAMES EACH UNIT — v0.9.1983 (real Chromium, REAL wizard.js,
// wizard-handlers.js and app.css)
//
// Brad, 2026-10-18, adding his Lionel 2378 Milwaukee Road AB F3 set, on "Looking
// good! Ready to save your locomotive?": "under the 2378 which is the powered a
// unit, it says b unit. under the b unit, it says b unit. so there is no a unit
// info to edit." The lines came in the order he answered (A, B, A, B …) and
// filled two columns left to right, so "B Unit 2378C" sat beside the 2378 and
// "B Unit All Original" right under it, while the A unit's own lines carried no
// unit name at all. Told the plan — one labeled box per unit, one for the whole
// set — "yes".
//
//   U1  his AB set on his laptop (1536x737): "A unit — 2378 (powered)" and
//       "B unit — 2378C" side by side; every A line in the A box, every B line
//       in the B box, no "B Unit" words left in either; the purchase lines in
//       "For the whole set"; no line lost, none twice
//   U2  engine + tender: "Engine — 2046" and "Tender — 2046W" (the tender's
//       number was never on this screen before)
//   U3  AA: "A unit — 2343 (powered)" and "A unit — 2343T (dummy)"
//   U4  ABA: the two A units side by side, the B unit under them
//   U5  a single item keeps its one list — no unit boxes
//   U6  a phone: the boxes stack
//   U7  editing the B unit's number with its pencil changes the box heading too
//   U8  the step itself never scrolls; Save stays on screen
//   P   PLANTED: the shipped v0.9.1982 review (git cbdf679d) puts a "B Unit"
//       line in the 2378's column and has no unit boxes — so this suite can fail
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), cp = require('child_process');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  review_units_1983_tests needs playwright and it is not installed.'); process.exit(1); }
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
let OLDWIZ = null;
try { OLDWIZ = cp.execSync('git show cbdf679d:app/wizard.js', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) {}

let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 900))); cond ? pass++ : fail++; }

const ROWS = [
  { itemNum: '2378', variation: '', itemType: 'Diesel Locomotive', roadName: 'Milwaukee Road', description: 'F3 Diesel', _era: 'pw', _tab: 'Lionel PW - Items' },
  { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', roadName: 'Santa Fe', description: 'F3 A unit', _era: 'pw', _tab: 'Lionel PW - Items' },
  { itemNum: '2046', variation: '', itemType: 'Steam Locomotive', roadName: 'Lionel Lines', description: '4-6-4 Hudson steam locomotive', _era: 'pw', _tab: 'Lionel PW - Items' },
  { itemNum: '84631', variation: '', itemType: 'Diesel Locomotive', roadName: 'RJ Corman', description: 'SD40T-2', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
];

async function open(browser, o) {
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.h },
    userAgent: o.mobile ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36' : undefined });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!u.startsWith('file://')) return r.abort();
    if (base.endsWith('/app/wizard.js') && o.wiz) return r.fulfill({ body: o.wiz, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(rows => {
    try { _aiUsageMarkSeen(); } catch (e) {}
    state.masterData = rows.slice(); try { _rebuildMasterIndex(); } catch (e) {}
    state.masterAllRows = rows.slice(); state.personalData = {};
    _prefLocEnabled = true;
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
  }, ROWS);
  return { pg, ctx, errs };
}

// Open the review step with the answers in the order he gave them, and read it.
const review = (pg, kind) => pg.evaluate(async (kind) => {
  const S = ms => new Promise(r => setTimeout(r, ms));
  const R = e => { if (!e) return null; const q = e.getBoundingClientRect(); return { t: Math.round(q.top), b: Math.round(q.bottom), l: Math.round(q.left), r: Math.round(q.right) }; };
  const row = { ab: state.masterData[0], aa: state.masterData[1], aba: state.masterData[1], engine_tender: state.masterData[2], single: state.masterData[3] }[kind];
  openWizard('collection'); await S(300);
  wizard.matchedItem = row;
  const d = wizard.data;
  // his answers, in his order: A, then B, then A, then B …
  if (kind === 'ab') {
    Object.assign(d, { itemNum: '2378', variation: '1', unit2ItemNum: '2378C', hasBox: 'No', allOriginal: 'Yes', unit2AllOriginal: 'Yes',
      isError: 'No', unit2IsError: 'No', unit2HasBox: 'No', hasIS: 'No', hasMasterBox: 'No', condition: 8, unit2Condition: 8,
      datePurchased: '2026-10-18', userEstWorth: '1500', priceItem: '500', location: 'Train Room', notes: 'Part of set.', purchasedFrom: 'Frank Russo' });
  } else if (kind === 'aa') {
    Object.assign(d, { itemNum: '2343', unit2ItemNum: '2343T', hasBox: 'Yes', unit2HasBox: 'No', condition: 7, unit2Condition: 6, allOriginal: 'Yes', unit2AllOriginal: 'No', priceItem: '300' });
  } else if (kind === 'aba') {
    Object.assign(d, { itemNum: '2343', unit2ItemNum: '2343C', unit3ItemNum: '2343T', condition: 7, unit2Condition: 6, unit3Condition: 5, hasBox: 'No', unit2HasBox: 'No', unit3HasBox: 'Yes', priceItem: '800' });
  } else if (kind === 'engine_tender') {
    Object.assign(d, { itemNum: '2046', tenderMatch: '2046W', _tenderConfirmed: true, condition: 8, tenderCondition: 7, hasBox: 'Yes', tenderHasBox: 'No', allOriginal: 'Yes', tenderAllOriginal: 'Yes', priceItem: '400' });
  } else {
    Object.assign(d, { itemNum: '84631', condition: 9, hasBox: 'Yes', allOriginal: 'Yes', priceItem: '450', location: 'Shelf A' });
  }
  if (kind !== 'single') d._itemGrouping = kind;
  const i = wizard.steps.findIndex(s => s.id === 'confirm');
  if (i < 0) return { missing: true };
  wizard.step = i; renderWizardStep(); await S(500);
  document.querySelectorAll('#ai-usage-card').forEach(e => e.remove());
  const lineOf = el => { const sp = el.querySelectorAll('span'); return { label: (sp[0] && sp[0].textContent || '').trim(), key: (sp[1] && sp[1].id || '').replace('confirm-val-', ''), box: R(el) }; };
  const units = [...document.querySelectorAll('.wiz-cf-unit')].map(u => ({
    id: u.getAttribute('data-cf-unit'), head: ((u.querySelector('.wiz-cf-unit-title') || u.querySelector('.wiz-cf-unit-head') || {}).textContent || ''), box: R(u),
    headNum: (u.querySelector('.wiz-cf-unit-head [id^="confirm-val-"]') || {}).id || '', headPencil: (u.querySelector('.wiz-cf-unit-head button[id^="confirm-edit-btn-"]') || {}).id || '',
    lines: [...u.querySelectorAll('.wiz-cf-rows > div')].filter(x => x.querySelector('[id^="confirm-val-"]')).map(lineOf),
  }));
  const all = [...document.querySelectorAll('#wizard-body .wiz-cf-rows [id^="confirm-val-"]')].map(v => lineOf(v.parentElement));
  const headNums = [...document.querySelectorAll('#wizard-body .wiz-cf-unit-head [id^="confirm-val-"]')].map(v => v.id.replace('confirm-val-', ''));
  const wrap = document.querySelector('.wiz-cf-unitwrap');
  const listScroll = wrap ? wrap.scrollHeight - wrap.clientHeight : null;
  const bd = document.getElementById('wizard-body'), nx = document.getElementById('wizard-next-btn') || document.querySelector('#wizard-modal button.btn-primary');
  // the step's own scroll (not the lines' own box)
  return { units, all, headNums, listScroll, bodyOver: bd.scrollHeight - bd.clientHeight, side: bd.scrollWidth - bd.clientWidth, next: R(nx), vh: innerHeight };
}, kind);

const unitKey = k => /^(itemNum|variation|condition|allOriginal|notOriginalDesc|hasBox|boxCond|isError|errorDesc)$/.test(k) ? 'a'
  : /^unit2/.test(k) ? 'u2' : /^unit3/.test(k) ? 'u3' : /^tender/.test(k) ? 't' : 'set';

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── U1 his set, his laptop ───────────────────────────────────────────────
  let r = await open(browser, { w: 1536, h: 737 });
  let m = await review(r.pg, 'ab');
  const A = m.units.find(u => u.id === 'a'), B = m.units.find(u => u.id === 'b'), SET = m.units.find(u => u.id === 'set');
  T('U1 two unit boxes + one for the whole set', A && B && SET && m.units.length === 3, m.units.map(u => u.id + ':' + u.head));
  T('U1 the A box reads "A unit — 2378 (powered)"', A && /^A unit — 2378 \(powered\)$/.test(A.head.trim()), A && A.head);
  T('U1 the B box reads "B unit — 2378C"', B && /^B unit — 2378C$/.test(B.head.trim()), B && B.head);
  T('U1 side by side on his laptop: the A unit on the left, the B unit beside it', A && B && Math.abs(A.box.t - B.box.t) < 4 && A.box.r <= B.box.l, { A: A && A.box, B: B && B.box });
  T('U1 every line in the A box is an A-unit line (number, variation, condition, all original, box, error)',
    A && A.lines.length >= 5 && A.lines.every(l => unitKey(l.key) === 'a'), A && A.lines.map(l => l.key));
  T('U1 every line in the B box is a B-unit line', B && B.lines.length >= 4 && B.lines.every(l => unitKey(l.key) === 'u2'), B && B.lines.map(l => l.key));
  T('U1 no line in either box still says "B Unit …" (the heading says whose it is)',
    A && B && [...A.lines, ...B.lines].every(l => !/^B Unit/i.test(l.label)), A && B && [...A.lines, ...B.lines].map(l => l.label));
  T('U1 each unit\'s number sits in its heading WITH its own pencil (A: itemNum, B: unit2ItemNum), not as a separate line',
    A && B && A.headNum === 'confirm-val-itemNum' && A.headPencil === 'confirm-edit-btn-itemNum' && B.headNum === 'confirm-val-unit2ItemNum' && B.headPencil === 'confirm-edit-btn-unit2ItemNum'
    && !m.all.some(l => l.key === 'itemNum' || l.key === 'unit2ItemNum'), { A: A && [A.headNum, A.headPencil], B: B && [B.headNum, B.headPencil] });
  T('U1 the purchase lines (date, paid, worth, storage, notes, instruction sheet, master box) are in "For the whole set"',
    SET && ['datePurchased', 'priceItem', 'userEstWorth', 'location', 'notes', 'hasIS', 'hasMasterBox'].every(k => SET.lines.some(l => l.key === k)) && SET.lines.every(l => unitKey(l.key) === 'set'),
    SET && SET.lines.map(l => l.key));
  const keys = m.all.map(l => l.key).concat(m.headNums);
  T('U1 no line lost and none shown twice (' + keys.length + ' answers: ' + m.headNums.length + ' in headings + the lines)', keys.length === new Set(keys).size && m.all.length === m.units.reduce((n, u) => n + u.lines.length, 0) && keys.length >= 19, keys);
  // ── U8 ──
  T('U8 the step itself never scrolls; Save stays on screen', m.bodyOver <= 0 && m.side <= 0 && m.next && m.next.b <= m.vh, { bodyOver: m.bodyOver, side: m.side, next: m.next, vh: m.vh });
  T('U8 his AB set fits his laptop with NOTHING to scroll (as the old one-list review did)', m.listScroll !== null && m.listScroll <= 0, m.listScroll);
  // ── U7 ──
  const head2 = await r.pg.evaluate(async () => {
    _confirmEdit('unit2ItemNum');
    const inp = document.getElementById('confirm-input-unit2ItemNum'); inp.value = '2378C-1';
    _confirmDoneEdit('unit2ItemNum');
    const btn = document.getElementById('confirm-edit-btn-unit2ItemNum');
    return { head: document.querySelector('[data-cf-unit="b"] .wiz-cf-unit-title').textContent.trim(), val: document.getElementById('confirm-val-unit2ItemNum').textContent, data: wizard.data.unit2ItemNum, pencilBack: !!btn && btn.style.display !== 'none' };
  });
  T('U7 editing the B unit\'s number changes the line, the answer AND the box heading', head2.head === 'B unit — 2378C-1' && head2.val === '2378C-1' && head2.data === '2378C-1' && head2.pencilBack, head2);
  T('page errors (laptop)', r.errs.length === 0, r.errs);
  await r.ctx.close();

  // ── U2 / U3 / U4 / U5 ───────────────────────────────────────────────────
  r = await open(browser, { w: 1536, h: 737 });
  m = await review(r.pg, 'engine_tender');
  let heads = m.units.map(u => u.head.trim());
  T('U2 engine + tender: "Engine — 2046" and "Tender — 2046W" (the tender\'s number is on screen now)', heads[0] === 'Engine — 2046' && heads[1] === 'Tender — 2046W', heads);
  T('U2 the tender\'s lines are in the tender box, the engine\'s in the engine box',
    m.units[0].lines.every(l => unitKey(l.key) === 'a') && m.units[1].lines.length >= 3 && m.units[1].lines.every(l => unitKey(l.key) === 't'), m.units.map(u => u.lines.map(l => l.key)));
  await r.ctx.close();

  r = await open(browser, { w: 1536, h: 737 });
  m = await review(r.pg, 'aa');
  heads = m.units.map(u => u.head.trim());
  T('U3 AA: "A unit — 2343 (powered)" and "A unit — 2343T (dummy)"', heads[0] === 'A unit — 2343 (powered)' && heads[1] === 'A unit — 2343T (dummy)', heads);
  await r.ctx.close();

  r = await open(browser, { w: 1536, h: 737 });
  m = await review(r.pg, 'aba');
  const [a1, a2, b1] = m.units;
  T('U4 ABA: A unit, the dummy A unit, then the B unit', a1 && a2 && b1 && a1.head.trim() === 'A unit — 2343 (powered)' && a2.head.trim() === 'A unit — 2343T (dummy)' && b1.head.trim() === 'B unit — 2343C', m.units.map(u => u.head));
  T('U4 the two A units side by side, the B unit under them', a1 && a2 && b1 && Math.abs(a1.box.t - a2.box.t) < 4 && a1.box.r <= a2.box.l && b1.box.t >= Math.max(a1.box.b, a2.box.b) - 1, m.units.map(u => u.box));
  T('U4 each A unit carries only its own lines', a2 && a2.lines.every(l => unitKey(l.key) === 'u3') && b1.lines.every(l => unitKey(l.key) === 'u2'), m.units.map(u => u.lines.map(l => l.key)));
  await r.ctx.close();

  r = await open(browser, { w: 1536, h: 737 });
  m = await review(r.pg, 'single');
  T('U5 a single item keeps its one list (no unit boxes), every line on screen', m.units.length === 0 && m.all.length >= 4, { units: m.units.length, lines: m.all.length });
  await r.ctx.close();

  // ── U6 a phone ───────────────────────────────────────────────────────────
  r = await open(browser, { w: 412, h: 915, mobile: true });
  m = await review(r.pg, 'ab');
  const pA = m.units.find(u => u.id === 'a'), pB = m.units.find(u => u.id === 'b');
  T('U6 a phone: the A unit, then the B unit under it (stacked), nothing cut off at the side', pA && pB && pB.box.t >= pA.box.b - 1 && m.side <= 0, { A: pA && pA.box, B: pB && pB.box, side: m.side });
  T('page errors (phone)', r.errs.length === 0, r.errs);
  await r.ctx.close();

  // ── P planted: the shipped v0.9.1982 review ─────────────────────────────
  if (!OLDWIZ) T('P0 the v0.9.1982 wizard.js could be read from git (cbdf679d)', false, 'git show failed');
  else {
    r = await open(browser, { w: 1536, h: 737, wiz: OLDWIZ });
    m = await review(r.pg, 'ab');
    const item = m.all.find(l => l.key === 'itemNum');
    const underIt = m.all.filter(l => item && Math.abs(l.box.l - item.box.l) < 4 && l.box.t > item.box.t && /^B Unit/.test(l.label));
    T('P1 PLANTED: v0.9.1982 has no unit boxes', m.units.length === 0, m.units.length);
    T('P2 PLANTED: …and puts a "B Unit" line in the 2378\'s own column — what Brad saw', underIt.length > 0, { item, all: m.all.map(l => l.label + '@' + l.box.l + ',' + l.box.t) });
    await r.ctx.close();
  }

  await browser.close();
  console.log('\nreview_units_1983_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log('\nreview_units_1983_tests: ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
