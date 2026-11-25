#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// THE MAINTENANCE TASK OPENS INSIDE THE BOX — 2026-11-25 (taskinbox)
//
// [stated] Brad 2026-11-25 10:35 CT (computer, No. 53 → Maintenance → a task):
// "why is the task card so small?" → "yes" → "go". v0.9.1788's task card was
// a pop-up of its own on body (680px, zoom 1) in front of the Maintenance
// box, which is a .maint-card drawn at the desk zoom (1.25–1.5x): small text
// in a small box in front of a big one. Now the task is drawn IN the Tasks
// section, in place of the list, the box's own size.
//
// The REAL app in Chromium, a computer (1400x900, zoom 1.5) and a phone:
//   A  the list: two rows, the section's title, + Add task, the hint
//   B  tap a row → the task view sits IN #maint-tasks (no element added to
//      the page), as wide as the section; title "Task 1 of 2"; + Add task and
//      the hint step aside; the notes box is six lines; Back to the list, Need
//      a part, Mark complete, Remove task are the element on top at their
//      centre; the Parts box below is still on screen
//   C  typing survives a redraw while the box has focus (the v1786 rule) —
//      both a direct redraw and the parts redraw, which waits for focus to leave
//   D  Back to the list restores the rows; the device Back does the same and
//      LEAVES THE MAINTENANCE BOX OPEN (BackStack.push on open, one step);
//      the panel's own ← Back to its launcher and the box's ✕, each with a
//      task open, give the step back (one device Back then does one thing)
//   P  planted: the old pop-up served in place → red; BackStack.push removed →
//      the device Back closes the whole box → red; the launcher's Back leaving
//      the step → red; a redraw dropping the typing → red
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  task_in_box_tests needs playwright: ' + e.message); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const { SEED } = require('./lib/guide-fixture');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.split(from).join(to);
}
const CT = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html' };
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1';
const SIZES = [
  { n: 'computer 1400x900', w: 1400, h: 900 },
  { n: 'iPhone 390x844', w: 390, h: 844, hb: 34, top: 47, ua: UA_IPHONE },
];

// the fixture: two open tasks on the owned 3376 (inventory id = the first seeded copy)
const FIX = `(() => {
  const pd = Object.values(state.personalData).find(p => p.itemNum === '3376');
  state.user = { email: 'tester@example.com' };
  window.rrFeatureOn = () => true;                       // the Maintenance suite is on for this tester
  state.maintLog = [
    { row: 2, id: 'T1', invId: pd.inventoryId, itemNum: '3376', type: 'chore', text: 'E-unit service', partNum: '', by: '', dateAdded: '2026-11-25', dateDone: '', status: 'open', notes: '' },
    { row: 3, id: 'T2', invId: pd.inventoryId, itemNum: '3376', type: 'chore', text: 'Fix railing', partNum: '', by: '', dateAdded: '2026-11-20', dateDone: '', status: 'open', notes: 'left side' },
  ];
  state.partsData = {};
  state.maintDocs = state.maintDocs || [];
  window.rrVerifiedRowUpdate = async () => true;         // a note's save: pretend the sheet took it
  window.showToast = () => {};
  return { inv: pd.inventoryId };
})()`;

const LOOK = `(() => {
  const t = el => (el && el.textContent || '').replace(/\\s+/g, ' ').trim();
  const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
  const box = document.getElementById('maint-overlay');
  const tasks = document.getElementById('maint-tasks');
  const sec = tasks ? tasks.closest('.maint-sec') : null;
  const card = tasks ? tasks.querySelector('.maint-task-card') : null;
  const onTop = x => { if (!x) return null; const q = x.getBoundingClientRect(); if (!q.width || !q.height) return { t: t(x), ok: false, by: 'no size' }; const e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return { t: t(x).slice(0, 18), ok: !!(e && (x === e || x.contains(e))), by: e ? (e.id || String(e.className).slice(0, 20) || e.tagName) : 'none' }; };
  const btn = re => card ? Array.from(card.querySelectorAll('button')).find(b => re.test(b.textContent)) : null;
  const ta = card ? card.querySelector('textarea') : null;
  const parts = document.getElementById('maint-parts');
  return {
    boxOpen: vis(box), ovOnPage: !!document.getElementById('maint-task-ov'),
    rows: tasks ? tasks.querySelectorAll('.maint-task').length : -1,
    view: !!card, viewId: card ? card.getAttribute('data-id') : '',
    title: (() => { const sec = tasks && tasks.closest('.maint-sec'); return sec ? t(sec.firstElementChild) : ''; })(),
    addShown: vis(document.getElementById('maint-task-add')), hintShown: vis(document.getElementById('maint-tasks-hint')),
    secW: sec ? Math.round(sec.getBoundingClientRect().width) : 0, tasksW: tasks ? Math.round(tasks.getBoundingClientRect().width) : 0, cardW: card ? Math.round(card.getBoundingClientRect().width) : 0,
    taRows: ta ? Number(ta.getAttribute('rows')) : 0, taH: ta ? Math.round(ta.getBoundingClientRect().height) : 0, taLine: ta ? parseFloat(getComputedStyle(ta).lineHeight) || 0 : 0, taFont: ta ? parseFloat(getComputedStyle(ta).fontSize) || 0 : 0,
    taValue: ta ? ta.value : null, taFocused: !!ta && document.activeElement === ta, caret: ta ? ta.selectionStart : -1,
    tap: { back: onTop(btn(/Back to the list/)), part: onTop(btn(/Need a part/)), done: onTop(btn(/Mark complete/)), remove: onTop(btn(/Remove task/)) },
    partsBelow: !!parts && vis(parts) && parts.getBoundingClientRect().top > (card ? card.getBoundingClientRect().top : 0),
    stackHas: !!(window.BackStack && window.BackStack.has && window.BackStack.has('maint-task')),
  };
})()`;
const sleep = (pg, ms) => pg.waitForTimeout(ms);

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  let browser;
  try { browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }

  async function boot(S, served) {
    const ctx = await browser.newContext({ viewport: { width: S.w, height: S.h }, isMobile: !!S.ua, hasTouch: !!S.ua, userAgent: S.ua || undefined });
    await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
    const pg = await ctx.newPage();
    if (S.ua) { const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: S.top || 0, bottom: S.hb || 0, left: 0, right: 0 } }); }
    const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 140)));
    await ctx.route('**', r => {
      const u = r.request().url();
      if (!u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('about:') && !u.startsWith('blob:')) return r.abort();
      const name = u.split('?')[0].split('/').pop();
      if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: CT[path.extname(name)] || 'text/plain' });
      return r.continue();
    });
    await pg.goto('file://' + path.join(APP, 'index.html'));
    await pg.waitForTimeout(2200);
    await pg.evaluate(SEED); await pg.waitForTimeout(200);
    const fx = await pg.evaluate(FIX);
    // the item's page, then its Maintenance box, on the Work on it group
    await pg.evaluate(inv => { showPage('browse', document.getElementById('mnav-collection')); filterOwned(); }, fx.inv); await sleep(pg, 500);
    await pg.evaluate(inv => { _maintOpenPanel(-1, '3376', '1', inv); }, fx.inv); await sleep(pg, 400);
    await pg.evaluate(() => { _maintShowGrp('work'); }); await sleep(pg, 500);
    return { ctx, pg, errs, inv: fx.inv };
  }

  async function walk(S, served) {
    const b = await boot(S, served);
    const R = { errs: b.errs };
    R.list = await b.pg.evaluate(LOOK);
    // B — open the first task from its row
    const row = await b.pg.$('#maint-tasks .maint-task[data-id="T1"]');
    if (row) { await row.click(); await sleep(pg(b), 400); }
    R.open = await b.pg.evaluate(LOOK);
    // C — type, redraw while focused (direct), then the parts redraw (waits for focus to leave)
    await b.pg.evaluate(() => { const ta = document.querySelector('#maint-tasks textarea'); if (ta) { ta.focus(); ta.value = 'armature is dry'; ta.setSelectionRange(8, 8); } });
    await b.pg.evaluate(() => { _maintRenderTasks(); }); await sleep(pg(b), 150);
    R.afterDirect = await b.pg.evaluate(LOOK);
    await b.pg.evaluate(() => { _maintPartsRedraw(); }); await sleep(pg(b), 150);
    R.afterPartsWhileTyping = await b.pg.evaluate(LOOK);
    await b.pg.evaluate(() => { const ta = document.querySelector('#maint-tasks textarea'); if (ta) ta.blur(); }); await sleep(pg(b), 400);
    R.afterBlur = await b.pg.evaluate(LOOK);
    // D — Back to the list
    await b.pg.evaluate(() => { const c = document.querySelector('#maint-tasks .maint-task-card'); const bt = c && Array.from(c.querySelectorAll('button')).find(x => /Back to the list/.test(x.textContent)); if (bt) bt.click(); }); await sleep(pg(b), 400);
    R.backBtn = await b.pg.evaluate(LOOK);
    // open again, then the DEVICE Back
    await b.pg.evaluate(() => { _maintOpenTask('T2'); }); await sleep(pg(b), 400);
    R.open2 = await b.pg.evaluate(LOOK);
    await b.pg.evaluate(() => { history.back(); }); await sleep(pg(b), 700);
    R.deviceBack = await b.pg.evaluate(LOOK);
    // open a task, then the panel's OWN ← Back to its launcher: the task's step must go with it, so ONE
    // device Back then closes the whole box (review 2026-11-25: it used to close an invisible task first)
    await b.pg.evaluate(() => { _maintOpenTask('T1'); }); await sleep(pg(b), 400);
    await b.pg.evaluate(() => { _maintShowGrp(''); }); await sleep(pg(b), 300);
    R.launcher = await b.pg.evaluate(() => ({ stackHas: !!(window.BackStack && window.BackStack.has && window.BackStack.has('maint-task')), launcherShown: (document.getElementById('maint-launcher') || {}).style ? document.getElementById('maint-launcher').style.display !== 'none' : false }));
    await b.pg.evaluate(() => { history.back(); }); await sleep(pg(b), 700);
    R.launcherBack = await b.pg.evaluate(() => ({ boxOpen: !!document.getElementById('maint-overlay') }));
    // open the box and a task again, close the whole box with its ✕ — then no leftover step
    await b.pg.evaluate(inv => { _maintOpenPanel(-1, '3376', '1', inv); }, b.inv); await sleep(pg(b), 400);
    await b.pg.evaluate(() => { _maintShowGrp('work'); }); await sleep(pg(b), 400);
    await b.pg.evaluate(() => { _maintOpenTask('T1'); }); await sleep(pg(b), 400);
    await b.pg.evaluate(() => { _maintClosePanel(); }); await sleep(pg(b), 400);
    R.afterX = await b.pg.evaluate(() => ({ boxOpen: !!document.getElementById('maint-overlay'), stackHas: !!(window.BackStack && window.BackStack.has && window.BackStack.has('maint-task')), page: (document.querySelector('.page.active') || {}).id || '' }));
    await b.ctx.close();
    return R;
  }
  const pg = b => b.pg;

  const sixLines = o => o.taRows === 6 && o.taH >= 6 * Math.max(o.taLine, o.taFont * 1.2) * 0.95;
  const viewGood = o => o.view && !o.ovOnPage && o.rows === 0 && o.boxOpen && o.cardW >= o.tasksW - 2 && o.cardW >= o.secW * 0.85
    && o.title === 'Tasks for this item' && !o.addShown && !o.hintShown && sixLines(o) && o.partsBelow && o.stackHas
    && ['back', 'part', 'done', 'remove'].every(k => o.tap[k] && o.tap[k].ok);

  for (const S of SIZES) {
    const R = await walk(S);
    console.log('== ' + S.n + ' ==');
    ok('A1 the list: two rows, the section title, + Add task and the hint; no task view', R.list.rows === 2 && !R.list.view && R.list.title === 'Tasks for this item' && R.list.addShown && R.list.hintShown && !R.list.ovOnPage, JSON.stringify(R.list));
    ok('B1 tapping a row draws the task IN the Tasks section, as wide as the section, the section title kept, six-line notes, every button tappable, the Parts box still below, one BackStack step', viewGood(R.open), JSON.stringify(R.open));
    ok('B2 nothing was added to the page for it (no pop-up of its own)', !R.open.ovOnPage, JSON.stringify(R.open));
    ok('C1 a direct redraw while he is typing keeps the note and the caret', R.afterDirect.view && R.afterDirect.taValue === 'armature is dry' && R.afterDirect.taFocused && R.afterDirect.caret === 8, JSON.stringify(R.afterDirect));
    ok('C2 the parts redraw while he is typing waits — the note is still there, still focused', R.afterPartsWhileTyping.taValue === 'armature is dry' && R.afterPartsWhileTyping.taFocused, JSON.stringify(R.afterPartsWhileTyping));
    ok('C3 after he leaves the box the note is kept (saved into the task) and the view is still the task', R.afterBlur.view && R.afterBlur.taValue === 'armature is dry', JSON.stringify(R.afterBlur));
    ok('D1 Back to the list: the rows are back, the title and + Add task too, the step given back', R.backBtn.rows === 2 && !R.backBtn.view && R.backBtn.title === 'Tasks for this item' && R.backBtn.addShown && !R.backBtn.stackHas && R.backBtn.boxOpen, JSON.stringify(R.backBtn));
    ok('D2 the device Back closes the task and LEAVES the Maintenance box open on the list', R.open2.view && R.open2.viewId === 'T2' && R.deviceBack.boxOpen && !R.deviceBack.view && R.deviceBack.rows === 2 && !R.deviceBack.stackHas, JSON.stringify({ open2: R.open2.viewId, after: R.deviceBack }));
    ok('D3 the panel\'s own ← Back to its launcher with a task open gives the task\'s step back, and ONE device Back then closes the box', R.launcher.launcherShown && !R.launcher.stackHas && !R.launcherBack.boxOpen, JSON.stringify({ launcher: R.launcher, after: R.launcherBack }));
    ok('D4 the box\'s ✕ with a task open closes the box and leaves no task step behind', !R.afterX.boxOpen && !R.afterX.stackHas, JSON.stringify(R.afterX));
    ok('E no page errors', !R.errs.length, [...new Set(R.errs)].slice(0, 3).join(' | '));
  }

  console.log('== P · planted offenders ==');
  const M = read('maintenance.js');
  {
    // the old pop-up, in place of the view: served from git history is not available to a suite,
    // so the plant is the shape — the view drawn onto body instead of into the section
    const js = plant(M, 'el.innerHTML = taskViewHtml(ot, openIdx, tasks.length);', "document.body.insertAdjacentHTML('beforeend', '<div id=\"maint-task-ov\" style=\"position:fixed;inset:0;z-index:100020;display:flex;align-items:center;justify-content:center;background:var(--scrim)\">' + taskViewHtml(ot, openIdx, tasks.length) + '</div>');", 'P1 pop-up again');
    const R = await walk(SIZES[0], { 'maintenance.js': js });
    // (the page's own sweep takes an older copy's pop-up down at once, so what is left is: no view in the section)
    ok('P1 the task drawn as a pop-up again is caught (B1 red: nothing in the section)', !viewGood(R.open) && !R.open.view, JSON.stringify(R.open));
  }
  {
    const js = plant(M, "try { if (window.BackStack && window.BackStack.push) window.BackStack.push('maint-task', function () { window._maintCloseTask(true); }); } catch (eB) {}", '', 'P2 no step');
    const R = await walk(SIZES[0], { 'maintenance.js': js });
    ok('P2 the task taking no history step is caught (D2 red: the device Back closes the whole box)', !R.deviceBack.boxOpen || R.open2.stackHas === false && !R.deviceBack.boxOpen, JSON.stringify(R.deviceBack));
  }
  {
    const js = plant(M, "      if (g !== 'work' && _maintOpenTaskId && typeof window._maintCloseTask === 'function') window._maintCloseTask();\n", '', 'P4 launcher keeps the step');
    const R = await walk(SIZES[0], { 'maintenance.js': js });
    ok('P4 the launcher\'s Back leaving the task\'s step behind is caught (D3 red: a device Back is swallowed)', R.launcher.stackHas || R.launcherBack.boxOpen, JSON.stringify({ launcher: R.launcher, after: R.launcherBack }));
  }
  {
    const js = plant(M, "var keep = keepTyping(ot);", "var keep = null;", 'P3 typing lost');
    const R = await walk(SIZES[0], { 'maintenance.js': js });
    ok('P3 a redraw that drops what he is typing is caught (C1 red)', R.afterDirect.taValue !== 'armature is dry' || R.afterDirect.caret !== 8, JSON.stringify(R.afterDirect));
  }

  await browser.close();
  console.log((fail ? 'FAILED' : 'GREEN') + '  task_in_box_tests  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
