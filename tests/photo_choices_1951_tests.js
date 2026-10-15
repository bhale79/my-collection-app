#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PHOTO ID OFFERS THE NUMBERS IT READ — v0.9.1951
// (real Chromium, the REAL app, the REAL Tesseract.js)
//
// [stated] Brad, 2026-10-14, after v1950, with a screenshot: Photo ID on his
// Woodruff box still said "Lettering: no item number read". His picture was a
// screenshot of the WHOLE screen — the browser's tabs and bookmarks bar read
// "2026" twice ("Jobs Reports 2026", "2026 Timesheets") and outvoted the box's
// 1927690, read once, so the closer look confirmed nothing. Reproduced with the
// full 164,815-row catalog. Brad said "yes" to: when the closer look reads
// numbers the catalog knows but cannot settle, offer them as choices, longest
// first — the same "which one is YOUR item?" a shelf photo gets.
//
// Fixtures: tests/fixtures/woodruff_screen_1927690.jpg is that screenshot
// with the mail tab and the bookmark names replaced by neutral words (the two
// "2026" bookmarks kept — they ARE the failure). woodruff_screen_rows.json is
// every catalog row whose number the reader saw on it (175 rows, taken from
// the live catalog), so the real ranking runs, not a three-row toy.
//
//   A  on that picture: no green tick; the choices are offered, 1927690 FIRST,
//      with "None of these"; tapping 1927690 lands it in the catalog.
//      PLANTED: without the choices, "no item number read" — Brad's screen.
//   B  the choice list: catalog-known only, longest first, no repeats, at most
//      RR_PHOTO_ID_CLOSER.maxChoices.
//   C  unchanged: a confirmed closer read goes straight through (no
//      question); a closer read the catalog knows nothing of still ends at
//      "no item number read".
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  photo_choices_1951_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const FIX = path.join(__dirname, 'fixtures');
const PIC = fs.readFileSync(path.join(FIX, 'woodruff_screen_1927690.jpg')).toString('base64');
const ROWS = JSON.parse(fs.readFileSync(path.join(FIX, 'woodruff_screen_rows.json'), 'utf8'));
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 700))); cond ? pass++ : fail++; }

async function boot(browser, files) {
  const pg = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    if (u.startsWith('file://') || u.startsWith('https://cdn.jsdelivr.net/') || u.startsWith('https://tessdata.projectnaptha.com/')) return r.continue();
    return r.abort();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(rows => {
    state.masterAllRows = rows; state.masterData = rows.slice();
    try { _rebuildMasterIndex(); } catch (e) {}
    state.masterByItemAll = state.masterByItem; window._allIdxComplete = true;
  }, ROWS);
  return { pg, errs };
}
// Photo ID's real stages on the screenshot; stops at the first question or the end
const run = (pg) => pg.evaluate(async (b64) => {
  const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  window.__res = null;
  window._biPipelineOnCanvas(c, { noAi: true }).then(r => { window.__res = r || {}; });
  for (let i = 0; i < 1200; i++) {
    await new Promise(r => setTimeout(r, 150));
    const t = ((document.getElementById('bi-stages') || {}).textContent || '').replace(/\s+/g, ' ');
    const btns = [...document.querySelectorAll('#bi-actions [data-bi]')].map(b => ({ act: b.getAttribute('data-bi'), txt: b.textContent.trim() }));
    if (btns.length) return { t, btns };
    if (window.__res) return { t, btns: [], res: true };
  }
  return { t: 'timeout', btns: [] };
}, PIC);

(async function () {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    // ── A · the screenshot ──
    {
      const { pg, errs } = await boot(browser);
      const a = await run(pg);
      const nums = a.btns.filter(b => /^num:/.test(b.act)).map(b => b.act.slice(4));
      T('A Photo ID asks which number is YOURS instead of giving up', /which number is YOUR item/.test(a.t) && nums.length >= 2, a);
      T('A …1927690 is the FIRST choice (longest first)', nums[0] === '1927690', nums);
      T('A …the browser\'s 2026 is offered, never picked for him', nums.indexOf('2026') > 0, nums);
      T('A …"None of these" is there', a.btns.some(b => b.act === 'none'), a.btns);
      T('A …and there is no green tick on a guess', !/✓ found/.test(a.t) && /not sure which is yours/.test(a.t), a.t);
      await pg.click('#bi-actions [data-bi="num:1927690"]');
      const done = await pg.evaluate(async () => {
        for (let i = 0; i < 80; i++) { await new Promise(r => setTimeout(r, 100)); if (window.__res) break; }
        return { t: ((document.getElementById('bi-stages') || {}).textContent || '').replace(/\s+/g, ' '), res: window.__res && { itemNum: window.__res.itemNum, tab: window.__res.masterItem && window.__res.masterItem._tab } };
      });
      T('A tapping 1927690 lands it in the catalog: Woodruff, Lionel MPC-Modern', done.res && done.res.itemNum === '1927690' && done.res.tab === 'Lionel MPC-Modern' && /Catalog: ✓ 1927690/.test(done.t), done);
      T('A page errors', errs.length === 0, errs);
      await pg.close();
    }
    {
      const bc = read('barcode.js');
      const a0 = bc.indexOf('        else if (_fr) {');
      const a1 = a0 < 0 ? -1 : bc.indexOf('\n        }\n', a0);
      if (a0 < 0 || a1 < 0) T('A PLANTED: could plant Photo ID without the choices', false, { a0, a1 });
      else {
        const old = bc.slice(0, a0) + bc.slice(a1 + '\n        }\n'.length - 1);
        const { pg } = await boot(browser, { 'barcode.js': old });
        const p = await run(pg);
        T('A PLANTED: without the choices, the same screenshot reads "no item number read" (A would fail)', /no item number read/.test(p.t) && !p.btns.some(b => /^num:/.test(b.act)), p);
        await pg.close();
      }
    }

    // ── B · the choice list ──
    {
      const { pg, errs } = await boot(browser);
      const b = await pg.evaluate(() => ({
        list: window._bcCloserChoices({ num: '2026', matched: false, dbg: { inEra: ['303:mpc', '2026:pw', '1927690:mpc', '230:pw', '2026:mpc'], offEra: ['55555:mth'] } }),
        none: window._bcCloserChoices({ num: '4927690', matched: false }),
        max: RR_PHOTO_ID_CLOSER.maxChoices,
      }));
      T('B catalog-known only, longest first, no repeats, at most maxChoices', JSON.stringify(b.list) === JSON.stringify(['1927690', '55555', '2026', '303']) && b.max === 4, b);
      T('B a read with nothing the catalog knows offers nothing', b.none.length === 0, b);

      // ── C · unchanged paths ──
      const stub = (fr) => pg.evaluate(async (fr) => {
        window.Tesseract = { recognize: async () => ({ data: { text: 'Sleeping Car 2 Pack' } }) };
        window.rrFreeReadBlob = async () => fr;
        const c = document.createElement('canvas'); c.width = 300; c.height = 200;
        let res = null; window._biPipelineOnCanvas(c, { noAi: true }).then(r => { res = r || {}; });
        for (let i = 0; i < 80; i++) {
          await new Promise(r => setTimeout(r, 100));
          const btns = document.querySelectorAll('#bi-actions [data-bi^="num:"]').length;
          if (btns || res) { const t = ((document.getElementById('bi-stages') || {}).textContent || '').replace(/\s+/g, ' '); const o = document.getElementById('bi-overlay'); if (o) o.remove(); return { t, btns, num: res && res.itemNum }; }
        }
        return { t: 'timeout' };
      }, fr);
      const c1 = await stub({ num: '1927690', matched: true, dbg: { inEra: ['1927690:mpc', '2026:pw'] } });
      T('C a CONFIRMED closer read goes straight through — no question', /✓ found 1927690/.test(c1.t) && !c1.btns && c1.num === '1927690', c1);
      const c2 = await stub({ num: '4927690', matched: false, dbg: { inEra: [], offEra: [] } });
      T('C a closer read the catalog knows nothing of still says "no item number read"', /no item number read/.test(c2.t) && !c2.btns, c2);
      T('B/C page errors', errs.length === 0, errs);
      await pg.close();
    }
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('PHOTO CHOICES 1951 TESTS FAILING'); process.exit(1); }
  console.log('ALL PHOTO CHOICES 1951 TESTS GREEN (' + pass + ')');
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
