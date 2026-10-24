#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE DUPLICATE CHECKER FITS ITS CARD — v0.9.2016            (real Chromium)
//
// [stated] Brad, 2026-10-23, Collection Tools → Duplicate Checker on his
// 1920-wide laptop: "need to look at the layout, add to sales list goes
// beyound the box" → "yes". Each copy was ONE grid row of fixed columns plus
// two buttons that may not shrink — wider than the half-width card, so
// "Add to For Sale List" hung past its edge and "6-36814-BOX" was squeezed
// onto three lines. Now the buttons sit on their own line under each copy,
// and the header and the copies share ONE column list (DUPE_COLS).
//
//   F1  at Brad's size, a laptop, the booth TV and two phones: every Details
//       and Add to For Sale List button sits inside its card
//   F2  …and inside the copy's own box; no copy is wider than its card
//   F3  the header lines up with the copies (same column list, same width)
//   F4  at Brad's size "6-36814-BOX" in Grouped? is on ONE line
//   F5  both buttons still work as before (Details opens THIS copy,
//       For Sale gets THIS copy's store key)
//   S1  DUPE_COLS is the one column list — the header and the copy use it
//   L*  [stated] Brad: "the dulplicate finder should not include items in the
//       sales list. and if you add an item from the duplicate checker to the
//       sale list, it should update the list and show that item is no longer
//       there" → "yes". L1 a listed copy is left out; L2 a number left with
//       one copy drops off; L3 the note says how many were left out; L4 the
//       REAL Add to For Sale → save → close lands back on an updated list;
//       L5 a cancelled listing comes back to the same list
//   X*  PLANTED: the old one-row layout → F1 catches it at Brad's size;
//       listed copies counted again (L1); no return flag on For Sale (L4)
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  dupe_checker_fit_2016_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const TOOLS = fs.readFileSync(path.join(APP, 'tools.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 600))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.split(from).join(to);
}

// Brad's screen: 1920 wide; a laptop; the booth TV; two phones
const SIZES = [[1920, 1080, 'Brad'], [1280, 800, 'laptop'], [1568, 706, 'booth'], [412, 915, 'phone 412'], [360, 780, 'phone 360']];

async function measure(browser, w, h, files) {
  const pg = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => { const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort(); });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  const out = await pg.evaluate(async () => {
    state.user = { email: 'bhale@ipd-llc.com', name: 'Brad' };
    state.masterData = [{ itemNum: '6-36814', roadName: 'Rio Grande', itemType: 'Diesel', variation: '' },
                        { itemNum: '6-36814-BOX', roadName: '', itemType: 'Box', variation: '' }];
    try { _rebuildMasterIndex(); } catch (e) {}
    const mk = (inv, num, cond, extra) => Object.assign({ inventoryId: inv, itemNum: num, variation: '', owned: true, condition: cond, hasBox: 'Yes' }, extra || {});
    state.personalData = {
      'k147': mk('147', '6-36814', 7, { groupId: 'g0' }),
      'k457': mk('457', '6-36814', 8, { groupId: 'g1' }),
      'k466': mk('466', '6-36814', 8, { groupId: 'g2', priceItem: '1249.99' }),
      'kb1':  mk('901', '6-36814-BOX', 8, { groupId: 'g1' }),
      'kb2':  mk('902', '6-36814-BOX', 8, { groupId: 'g2' }),
    };
    ['auth-screen', 'beta-gate'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    document.getElementById('app').classList.add('active');
    showPage('tools'); await new Promise(z => setTimeout(z, 600));
    window.__calls = [];
    window._openOwnedByInvId = k => window.__calls.push('open:' + k);
    window.listForSaleFromCollection = (i, k) => window.__calls.push('sale:' + k);
    runDuplicateChecker(); await new Promise(z => setTimeout(z, 300));
    const res = document.getElementById('duplicate-checker-results');
    const card = res.closest('.tools-card');
    const cr = card.getBoundingClientRect();
    const bad = [];
    const copies = [...res.querySelectorAll('.tools-result-row')];
    let buttons = 0;
    copies.forEach(grp => {
      [...grp.querySelectorAll('button')].forEach(b => {
        buttons++;
        const r = b.getBoundingClientRect();
        if (r.right > cr.right - 1 || r.left < cr.left) bad.push({ what: b.textContent.trim(), right: Math.round(r.right), cardRight: Math.round(cr.right) });
        const box = b.closest('.rr-dupe-copy') || b.parentElement.parentElement;
        const br = box.getBoundingClientRect();
        if (r.right > br.right + 0.5) bad.push({ what: b.textContent.trim() + ' past its copy box', right: Math.round(r.right), boxRight: Math.round(br.right) });
      });
      [...grp.children].forEach(ch => { const r = ch.getBoundingClientRect(); if (r.right > cr.right - 1) bad.push({ what: 'a line of the group wider than the card', right: Math.round(r.right), cardRight: Math.round(cr.right) }); });
    });
    // header lines up with the copies
    const head = res.querySelector('.rr-dupe-head');
    const first = res.querySelector('.rr-dupe-copy');
    let align = null;
    if (head && first) {
      const hc = [...head.children].map(e => Math.round(e.getBoundingClientRect().left));
      const rc = [...first.firstElementChild.children].map(e => Math.round(e.getBoundingClientRect().left));
      const hw = Math.round(head.getBoundingClientRect().width), rw = Math.round(first.getBoundingClientRect().width);
      align = { hc, rc, hw, rw, ok: hc.length === rc.length && hc.every((x, i) => Math.abs(x - rc[i]) <= 1) && Math.abs(hw - rw) <= 1 };
    }
    // the Grouped? cell holding 6-36814-BOX: one line?
    const g = [...res.querySelectorAll('.rr-dupe-grouped')].find(e => /6-36814-BOX/.test(e.textContent));
    let oneLine = null;
    if (g) { const lh = parseFloat(getComputedStyle(g).lineHeight) || (parseFloat(getComputedStyle(g).fontSize) * 1.3); oneLine = g.getBoundingClientRect().height <= lh * 1.5; }
    // the buttons still do their jobs
    const btns = [...res.querySelectorAll('.rr-dupe-copy button')];
    const det = btns.find(b => /Details/.test(b.textContent)), sale = btns.find(b => /For Sale/.test(b.textContent));
    if (det) det.click(); if (sale) sale.click();
    const scrollW = document.documentElement.scrollWidth, winW = window.innerWidth;
    return { groups: copies.length, buttons, bad, align, oneLine, calls: window.__calls.slice(), pageScroll: scrollW > winW + 1 ? [scrollW, winW] : null };
  });
  await pg.close();
  return Object.assign(out, { errs });
}


async function listing(browser, files) {
  const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => { const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort(); });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  const out = await pg.evaluate(async () => {
    state.user = { email: 'bhale@ipd-llc.com', name: 'Brad' };
    state.masterData = [{ itemNum: '6-36814', roadName: 'Rio Grande', itemType: 'Diesel', variation: '' },
                        { itemNum: '6-36814-BOX', roadName: '', itemType: 'Box', variation: '' }];
    try { _rebuildMasterIndex(); } catch (e) {}
    const mk = (inv, num) => ({ inventoryId: inv, itemNum: num, variation: '', owned: true, condition: 8 });
    state.personalData = { k147: mk('147', '6-36814'), k457: mk('457', '6-36814'), k466: mk('466', '6-36814'),
                           kb1: mk('901', '6-36814-BOX'), kb2: mk('902', '6-36814-BOX') };
    // 466 listed under its inventory number; 902 an older row under another key
    state.forSaleData = { '466': { inventoryId: '466', itemNum: '6-36814' }, 'legacy-row-7': { inventoryId: '902', itemNum: '6-36814-BOX' } };
    ['auth-screen', 'beta-gate'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    document.getElementById('app').classList.add('active');
    showPage('tools'); await new Promise(z => setTimeout(z, 600));
    const read = () => {
      const res = document.getElementById('duplicate-checker-results');
      return { nums: [...res.querySelectorAll('.tools-result-row strong')].map(e => e.textContent.trim()),
               invs: [...res.querySelectorAll('.rr-dupe-copy')].map(e => e.firstElementChild.children[1].textContent.trim()),
               note: ((res.querySelector('.rr-dupe-salenote') || {}).textContent || '').trim() };
    };
    runDuplicateChecker(); await new Promise(z => setTimeout(z, 200));
    const first = read();
    // L5: list 457, then cancel (nothing written) → back on the same list
    const btn2 = [...document.querySelectorAll('#duplicate-checker-results .rr-dupe-copy button')].find(b => /For Sale/.test(b.textContent) && /k457/.test(b.getAttribute('onclick')));
    let cancelled = null;
    if (btn2) {
      btn2.click(); await new Promise(z => setTimeout(z, 400));
      wizard.data = { tab: 'forsale' }; closeWizard(); await new Promise(z => setTimeout(z, 700));
      cancelled = { page: (document.querySelector('.page.active') || {}).id || '', list: read() };
    }
    // L4: the REAL button → the REAL For Sale wizard → a save → the REAL close
    const btn = [...document.querySelectorAll('#duplicate-checker-results .rr-dupe-copy button')].find(b => /For Sale/.test(b.textContent) && /k147/.test(b.getAttribute('onclick')));
    if (!btn) return { first, cancelled, wizOpen: false, wizKey: null, page: '', after: { nums: [], invs: [], note: '' } };
    btn.click(); await new Promise(z => setTimeout(z, 400));
    const wizOpen = document.getElementById('wizard-modal').classList.contains('open');
    const wizKey = wizard && wizard.data && wizard.data._collectionPdKey;
    state.forSaleData['147'] = { inventoryId: '147', itemNum: '6-36814' };   // what the save writes
    wizard.data._saveComplete = true; closeWizard(); await new Promise(z => setTimeout(z, 700));
    const page = (document.querySelector('.page.active') || {}).id || '';
    const after = read();
    return { first, wizOpen, wizKey, page, after, cancelled };
  });
  await pg.close();
  return Object.assign(out, { errs });
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  console.log('== F · fits its card ==');
  for (const [w, h, name] of SIZES) {
    const r = await measure(browser, w, h);
    T('F1 ' + name + ' (' + w + '×' + h + '): 2 groups, 10 buttons, every button inside its card and its copy box', r.groups === 2 && r.buttons === 10 && r.bad.length === 0, r);
    T('F3 ' + name + ': the header lines up with the copies (same columns, same width)', r.align && r.align.ok, r.align);
    T('F2 ' + name + ': the page itself never scrolls sideways', !r.pageScroll, r.pageScroll);
    if (name === 'Brad') {
      T('F4 Brad: "6-36814-BOX" in Grouped? is on one line', r.oneLine === true, r.oneLine);
      T('F5 Details opens THIS copy; For Sale gets THIS copy\'s store key', r.calls[0] === 'open:k147' && r.calls[1] === 'sale:k147', r.calls);
    }
    T('page errors (' + name + ')', r.errs.length === 0, r.errs);
  }


  console.log('== L · the For Sale list ==');
  const L = await listing(browser);
  T('L1 a copy on the For Sale list is left out (466 by its number; 902 an older row)', L.first.invs.join(',') === '147,457', L.first);
  T('L2 6-36814-BOX is left with one copy → it drops off the list', L.first.nums.join(',') === '6-36814', L.first.nums);
  T('L3 the note says how many were left out', /^2 copies on your For Sale list aren’t counted\.$/.test(L.first.note), L.first.note);
  T('L4 Add to For Sale List opens the For Sale wizard for THIS copy', L.wizOpen && L.wizKey === 'k147', { open: L.wizOpen, key: L.wizKey });
  T('L4 …saved → back on Collection Tools, re-scanned: 147 is gone, so 6-36814 has one copy left and drops off', /tools/.test(L.page) && L.after.nums.length === 0 && /3 copies/.test(L.after.note), L);
  T('L5 a cancelled listing → back on Collection Tools, the same list (nothing left out that was not listed)', L.cancelled && /tools/.test(L.cancelled.page) && /^2 copies/.test(L.cancelled.list.note) && L.cancelled.list.invs.join(',') === '147,457', L.cancelled);
  T('page errors (L)', L.errs.length === 0, L.errs);
  const L5 = await listing(browser, { 'tools.js': planted(TOOLS, "    if (_dupeOnForSale(pd)) { onSale++; return; }\n", '', 'skip') });
  T('X-L1 PLANTED: listed copies counted again → 466 shows (caught)', L5.first.invs.indexOf('466') >= 0, L5.first.invs);
  const L6 = await listing(browser, { 'tools.js': planted(TOOLS, "event.stopPropagation();window._toolsRerun=&apos;dupes&apos;;listForSaleFromCollection", "event.stopPropagation();listForSaleFromCollection", 'flag') });
  T('X-L4 PLANTED: no return flag on For Sale → the list is not re-scanned after the save (caught)', L6.after.note === '' && L6.after.invs.length === 0, L6);

  console.log('== S · one column list ==');
  const defs = (TOOLS.match(/var DUPE_COLS\s*=/g) || []).length;
  const uses = (TOOLS.match(/grid-template-columns:' \+ DUPE_COLS \+ '/g) || []).length;
  T('S1 DUPE_COLS is defined once and used by the header AND the copy', defs === 1 && uses === 2, { defs, uses });
  T('S1 …and no typed copy of the old one-row columns is left', TOOLS.indexOf('2rem 4rem 4.5rem 5rem 1fr auto') < 0);

  console.log('== X · planted ==');
  // the old layout: buttons back in the row as a column that cannot shrink
  let OLD = planted(TOOLS, "var DUPE_COLS = '2rem 4rem 4.5rem 5rem minmax(0,1fr)';", "var DUPE_COLS = '2rem 4rem 4.5rem 5rem 1fr auto';", 'columns');
  OLD = planted(OLD, "        '</div>' +\n        '<span class=\"rr-dupe-acts\" style=\"display:flex;flex-wrap:wrap;justify-content:flex-end;gap:0.35rem;margin-top:0.3rem\">' +",
                     "        '<span class=\"rr-dupe-acts\" style=\"display:flex;gap:0.35rem;flex-shrink:0\">' +", 'buttons line');
  OLD = planted(OLD, "        '</span>' +\n      '</div>';\n    });", "        '</span>' +\n      '</div></div>';\n    });", 'close');
  const x = await measure(browser, 1920, 1080, { 'tools.js': OLD });
  T('X-F1 PLANTED: the old one-row layout → buttons past the card at Brad\'s size (caught)', x.bad.length > 0, x.bad.slice(0, 2));

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
