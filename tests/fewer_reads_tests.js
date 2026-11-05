#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════
// FEWER READS — audit finding 3 (2026-11-04 night, [stated] Brad 21:32 CT
// "start the next fix if there is one, then ship it, and repeat"). Real
// Chromium, the REAL app, a stand-in Google that counts every request.
//
// The four-platform audit measured ~18 separate Google Sheets reads on one
// app load; Google allows 60 a minute per person across ALL devices, so two
// devices loading together ran out and saves failed. Now:
//   R1  My Collection, Sold, For Sale and Want-Upgrade are ONE request
//   R2  Instruction Sheets, Science Sets, Construction Sets, My Sets are ONE
//   R3  Parts Needed and Contacts stay their own reads (a new account has
//       neither tab, and one missing tab fails a whole one-request read)
//   R4  what the one request answers lands in the lists exactly as before
//   R5  if the one request fails (a missing tab), the tabs are read one by
//       one as before — and the lists still fill
//   R6  if Google says "too many requests", it does NOT fan out into more
//       reads; what is on screen is kept
//   R7  the Upgrade "self-heal" re-read only runs when there is something to
//       heal (it re-read Want-Upgrade on every load with no Upgrade entries)
// Planted: the one request switched off, the busy fan-out, the self-heal
// re-read on every load — each must turn a check red.
// ═════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  fewer_reads_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }
const AD = fs.readFileSync(path.join(APP, 'app-data.js'), 'utf8');

// mode: 'ok' | 'missingTab' (the set-tab batch answers 400) | 'busy' (every batch 429s) ; upgrades: include an Upgrade row
async function run(browser, mode, swap, upgrades) {
  const pg = await browser.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const name = decodeURIComponent(u.split('?')[0]).split('/').pop();
    if (swap && swap[name] != null) return r.fulfill({ status: 200, contentType: 'application/javascript', body: swap[name] });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  const out = await pg.evaluate(async ({ mode, upgrades }) => {
    state.personalSheetId = 'SID'; window.accessToken = 'tok'; accessToken = 'tok';
    const F = PERSONAL_FIELD_INDEX, W = Object.keys(F).length + 5;
    const mc = []; for (let i = 0; i < 3; i++) { const r = new Array(W).fill(''); r[F.itemNum] = String(2343 + i); r[F.variation] = '1'; r[F.inventoryId] = 'INV-' + i; r[F.condition] = '7'; mc.push(r); }
    const tabs = {
      'My Collection': mc,
      'Sold': [['6464-1', '1', '', '', '', '35', '2025-01-01', '', 'INV-S']],
      'For Sale': [['2343', '1', '7', '99', '2026-01-01', '', '', '', 'INV-0', 'Lionel']],
      'Want-Upgrade List': upgrades ? [['2343', '1', 'Upgrade', 'High', '', '9', 'INV-0', '', 'Lionel'], ['2245', '1', 'Want', 'Medium', '', '', '', '', 'Lionel']] : [['2245', '1', 'Want', 'Medium', '', '', '', '', 'Lionel']],
      'Instruction Sheets': [['1234', '2343', '', '7', '', '', 'IS-1']], 'Science Sets': [], 'Construction Sets': [], 'My Sets': [],
      'Parts Needed': [], 'Contacts': [],
    };
    const tabOf = r => decodeURIComponent(r).split('!')[0].replace(/^'|'$/g, '');
    window.__calls = [];
    const reply = (status, body) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) });
    window.fetch = async (url, init) => {
      const u = String(url); const method = (init && init.method) || 'GET';
      if (!/sheets\.googleapis\.com/.test(u) || !/\/SID/.test(u)) return reply(200, {});
      if (/values:batchGet/.test(u)) {
        const ranges = [...u.matchAll(/ranges=([^&]+)/g)].map(m => decodeURIComponent(m[1].replace(/%20/g, ' ')));
        window.__calls.push({ kind: 'batch', tabs: ranges.map(tabOf) });
        if (mode === 'busy') return reply(429, { error: { code: 429, message: 'Quota exceeded for quota metric Read requests', status: 'RESOURCE_EXHAUSTED' } });
        if (mode === 'missingTab' && ranges.some(r => /Science Sets/.test(r))) return reply(400, { error: { code: 400, message: 'Unable to parse range: Science Sets!A3:O' } });
        return reply(200, { valueRanges: ranges.map(r => ({ range: r, majorDimension: 'ROWS', values: (tabs[tabOf(r)] || []).slice() })) });
      }
      const m = /\/values\/([^?]+)\?/.exec(u);
      if (m) {
        const range = decodeURIComponent(m[1].replace(/%20/g, ' '));
        window.__calls.push({ kind: (method === 'GET' ? 'single' : 'write'), tab: tabOf(range) });
        if (mode === 'busy') return reply(429, { error: { code: 429, message: 'Quota exceeded' } });
        return reply(200, { range, majorDimension: 'ROWS', values: (tabs[tabOf(range)] || []).slice() });
      }
      return reply(200, {});
    };
    if (mode === 'busy') { state.personalData = { keep: { itemNum: 'ON-SCREEN', inventoryId: 'keep', row: 3, owned: true } }; }
    let threw = '';
    try { await _loadPersonalFromSheets('SID'); } catch (e) { threw = e.message; }
    await new Promise(r => setTimeout(r, 2200));   // the secondary tabs and the 1.5 s self-heal
    const calls = window.__calls;
    return {
      threw,
      batches: calls.filter(c => c.kind === 'batch').map(c => c.tabs.join('+')),
      singles: calls.filter(c => c.kind === 'single').map(c => c.tab),
      mc: Object.values(state.personalData || {}).map(p => p.inventoryId).sort().join(','),
      sold: Object.keys(state.soldData || {}).length, fs: Object.keys(state.forSaleData || {}).length,
      want: Object.keys(state.wantData || {}).length, ug: Object.keys(state.upgradeData || {}).length,
      is: Object.keys(state.isData || {}).length,
    };
  }, { mode, upgrades: !!upgrades });
  await pg.close();
  return { out, errs };
}
const PRIMARY = 'My Collection+Sold+For Sale+Want-Upgrade List';
const SETS = 'Instruction Sheets+Science Sets+Construction Sets+My Sets';

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  {
    const { out, errs } = await run(browser, 'ok');
    T('R1  the four primary tabs are ONE request', out.batches.includes(PRIMARY) && !out.singles.some(t => /^(My Collection|Sold|For Sale|Want-Upgrade List)$/.test(t)), out);
    T('R2  the four set / instruction-sheet tabs are ONE request', out.batches.includes(SETS) && !out.singles.some(t => /^(Instruction Sheets|Science Sets|Construction Sets|My Sets)$/.test(t)), out);
    T('R3  Parts Needed and Contacts are still their own reads', out.singles.filter(t => t === 'Parts Needed').length === 1 && out.singles.filter(t => t === 'Contacts').length === 1, out.singles);
    T('R3b the whole load is 4 requests to the sheet (was 11)', out.batches.length + out.singles.length === 4, out);
    T('R4  everything lands: 3 copies, the sale, the listing, the want, the instruction sheet', out.mc === 'INV-0,INV-1,INV-2' && out.sold === 1 && out.fs === 1 && out.want === 1 && out.is === 1, out);
    T('R7  no Upgrade rows on the sheet → no second Want-Upgrade read', !out.singles.includes('Want-Upgrade List'), out.singles);
    T('R4b no page errors', errs.length === 0 && !out.threw, errs.concat(out.threw || []));
  }
  {
    const { out } = await run(browser, 'ok', null, true);
    T('R7b an Upgrade row on the sheet lands, and nothing is re-read', out.ug === 1 && !out.singles.includes('Want-Upgrade List'), out);
  }
  {
    const { out, errs } = await run(browser, 'missingTab');
    T('R5  a missing set tab fails the one request → the four set tabs are read one by one', out.batches.includes(SETS) && ['Instruction Sheets', 'Science Sets', 'Construction Sets', 'My Sets'].every(t => out.singles.includes(t)), out);
    T('R5b …and the lists still fill (the primary request was fine)', out.mc === 'INV-0,INV-1,INV-2' && out.is === 1, out);
    T('R5c no page errors', errs.length === 0 && !out.threw, errs.concat(out.threw || []));
  }
  {
    const { out } = await run(browser, 'busy');
    // (the Upgrade self-heal's one re-read is right here: the read did not land)
    T('R6  "too many requests" → no fan-out into more reads (no single reads of the batched tabs)', !out.singles.some(t => /^(My Collection|Sold|For Sale|Instruction Sheets|Science Sets|Construction Sets|My Sets)$/.test(t)) && out.singles.filter(t => t === 'Want-Upgrade List').length <= 1, out);
    T('R6b …and what was on screen is kept', out.mc === 'keep', out);
  }

  // ── PLANTED ──
  {
    const a = "    if (vr && vr.length === ranges.length && vr.every(";
    T('P1 anchor present (once)', AD.split(a).length === 2);
    const { out } = await run(browser, 'ok', { 'app-data.js': AD.replace(a, "    if (false && vr && vr.length === ranges.length && vr.every(") });
    T('P1 PLANTED the one request ignored → R1/R3b would fail', !(out.batches.length + out.singles.length === 4), out);
  }
  {
    // both doors: an error REPLY, and the thrown "Sheets API error 429" (_withTokenRetry, after its one retry)
    const a = "    if (bg && bg.error && (bg.error.code === 429 || _busy(_em))) return _failAll('Google is busy (too many requests): ' + _em);\n";
    const a2 = "    if (_busy(e && e.message)) return _failAll(e && e.message);\n";
    T('P2 anchors present (once each)', AD.split(a).length === 2 && AD.split(a2).length === 2);
    const { out } = await run(browser, 'busy', { 'app-data.js': AD.replace(a, '').replace(a2, '') });
    T('P2 PLANTED fan-out on "too many requests" → R6 would fail', out.singles.some(t => /^(My Collection|Sold)$/.test(t)), out);
  }
  {
    const a = "    if (_ugReadLanded && _ugRowsRead === 0) return;   // the sheet holds no Upgrade rows — nothing to heal\n";
    T('P3 anchor present (once)', AD.split(a).length === 2);
    const { out } = await run(browser, 'ok', { 'app-data.js': AD.replace(a, '') });
    T('P3 PLANTED self-heal on every load → R7 would fail', out.singles.includes('Want-Upgrade List'), out.singles);
  }

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  crashed: ' + (e && e.stack || e)); process.exit(1); });
