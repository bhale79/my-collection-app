#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// NO "ADD A STAT CARD" — EDIT DASHBOARD IS THE ONE WAY IN — v0.9.1931
//
// Brad (2026-10-11): "we don't need the +add a stat card, we have the edit
// dashboard button" — "no, dont keep the one case, we always have the edit
// dashboard".
// Boots the REAL app (app/index.html from disk, real Chromium) and draws the
// dashboard three ways:
//   N1  some stat cards (room for more): no "Add a stat card" anywhere
//   N2  no stat cards at all: still none — the empty row takes no space
//   N3  Edit Dashboard is on the page every time
//   N4  the guide's data-card step names only Edit Dashboard
//   N5  no app file still says "Add a stat card" outside a comment — and the
//       scan catches a planted one
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  no_add_stat_card_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

// N5 — strip comments line by line, then look for the words
function offenders(files) {
  const bad = [];
  files.forEach(f => {
    const src = f.src.split('\n').filter(l => !/^\s*(\/\/|\/\*|\*|<!--)/.test(l)).map(l => l.replace(/\s\/\/ .*$/, '')).join('\n');
    if (/Add a stat card/i.test(src)) bad.push(f.name);
  });
  return bad;
}
const files = fs.readdirSync(APP).filter(n => /\.(js|html)$/.test(n)).map(n => ({ name: n, src: fs.readFileSync(path.join(APP, n), 'utf8') }));
T('N5 no app file says "Add a stat card" outside a comment', offenders(files).length === 0, offenders(files));
{
  const planted = files.map(f => f.name === 'dashboard.js' ? { name: f.name, src: f.src + "\nvar x = '<button>+ Add a stat card</button>';\n" } : f);
  T('N5 PLANTED: a new "Add a stat card" button is caught', offenders(planted).indexOf('dashboard.js') >= 0);
}

async function draw(browser, slots) {
  const pg = await browser.newPage({ viewport: { width: 1536, height: 826 } });
  await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  const out = await pg.evaluate(slots => {
    state.user = { email: 'tester@example.com', name: 'Tester' };
    state.personalData = { a: { itemNum: '6014-85', inventoryId: '1', owned: true, priceItem: '20' } };
    state.soldData = state.soldData || {}; state.forSaleData = state.forSaleData || {}; state.wantData = state.wantData || {};
    // the saved layout is what _getSlots returns; the app fills an all-empty
    // layout back in on its own, so answer it directly to reach the empty case
    window._getSlots = function () { return slots.slice(); };
    try { showPage('dashboard'); } catch (e) {}
    try { buildDashboard(); } catch (e) { return { err: e.message }; }
    const page = document.getElementById('page-dashboard');
    const grid = document.getElementById('stats-grid');
    const gb = grid ? grid.getBoundingClientRect() : null;
    return { text: page ? page.innerText : '', cards: document.querySelectorAll('#stats-grid .stat-card').length,
             gridH: gb ? Math.round(gb.height) : -1, edit: !!document.getElementById('dash-edit-btn'),
             addRow: !!document.getElementById('stats-add-row') };
  }, slots);
  await pg.close();
  return out;
}

(async () => {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    const some = await draw(browser, [{ id: 'value' }, null, null, null, null, null]);
    T('N1 some stat cards: no "Add a stat card" anywhere', !some.err && some.cards >= 1 && !/Add a stat card/i.test(some.text) && !some.addRow, some.err || { cards: some.cards, addRow: some.addRow });
    T('N3 …and Edit Dashboard is there', some.edit);
    const none = await draw(browser, [null, null, null, null, null, null]);
    T('N2 no stat cards: still no "Add a stat card", and the empty row takes no space', !none.err && none.cards === 0 && !/Add a stat card/i.test(none.text) && none.gridH === 0, none.err || { cards: none.cards, gridH: none.gridH });
    T('N3 …and Edit Dashboard is there', none.edit);
  } finally { await browser.close(); }
  const tut = fs.readFileSync(path.join(APP, 'tutorial.js'), 'utf8');
  T('N4 the guide\'s data-card step names only Edit Dashboard', /Use <strong>Edit Dashboard<\/strong> to change which stats appear or add another one/.test(tut));
  console.log('\nno_add_stat_card_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.stack); process.exit(1); });
