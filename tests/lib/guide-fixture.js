// ══ tests/lib/guide-fixture.js ════════════════════════════════════════════
//
// The synthetic collection and the tour engine's own selector-resolution rule,
// shared by every gate that boots the real app headless. They lived inside
// guide-walk.js until v0.9.1384 gave them a second reader (guide-cover.js);
// one copy means the two gates can never drift into testing different apps.
'use strict';

// Synthetic collection: enough shape for every page builder to render, and
// chosen to exercise the cases the guides talk about — an engine (grouping),
// a stock car (no grouping), a dashed relative, something for sale, something
// wanted, something sold.
const SEED = `
(function () {
  const mk = (n,t,road,desc,v,vd) => ({ itemNum:n, itemType:t, roadName:road, description:desc,
    variation:v, varDesc:vd, era:'Lionel Postwar', _era:'lionel_postwar', gauge:'O',
    yearProd:'1955', manufacturer:'Lionel', estValue:'120', refLink:'' });
  const M = [
    mk('3376','Stock Car','Bronx Zoo','Operating Bronx Zoo Car','1','unpainted blue molded shell with white heat stamped lettering'),
    mk('3376','Stock Car','Bronx Zoo','Operating Bronx Zoo Car','2','unpainted blue molded shell with yellow heat stamped lettering'),
    mk('3376-160','Stock Car','Bronx Zoo','Operating Bronx Zoo Car','1','unpainted green molded shell with yellow heat stamped lettering'),
    mk('773','Steam Engine','New York Central','4-6-4 Steam Locomotive','1','with 773W tender'),
    // v0.9.1384 — the tender EARNS the grouping row. getGroupingOptions() only
    // offers "Engine Only / Engine + Tender" when getMatchingTenders() finds a
    // partner, and a partner only exists if companionData says so. Without
    // this pair the add-item guide's grouping step measured a hidden, empty
    // div and every assertion about it passed for the wrong reason — a
    // mutation drill caught exactly that.
    mk('773W','Tender','New York Central','Tender','1','die-cast'),
    mk('6464-275','Boxcar','State of Maine','Boxcar','1','blue red white'),
    mk('2333','Diesel','Santa Fe','F-3 AA Units','1','early screen')
  ];
  state.masterData = M;
  state.masterByItem = new Map();
  M.forEach(m => { const k = String(m.itemNum);
    if (!state.masterByItem.has(k)) state.masterByItem.set(k, []);
    state.masterByItem.get(k).push(m); });
  const P = {}; let id = 46001, row = 2;
  [['3376','1'],['773','1'],['6464-275','1'],['2333','1']].forEach(([n,v]) => {
    P[n+'|'+v+'|'+row] = { itemNum:n, variation:v, owned:true, inventoryId:String(id++), row:row++,
      condition:'8', priceItem:'45', userEstWorth:'120', datePurchased:'2026-08-06',
      photoItem:'', notes:'', era:'Lionel Postwar', location:'' };
  });
  state.personalData = P;
  state.companionData = [{ engineNum:'773', companionNum:'773W', companionType:'Tender' }];
  state.forSaleData = { fs1: { itemNum:'6464-275', variation:'1', inventoryId:'46003', askingPrice:'50', dateListed:'2026-08-01', row:2 } };
  state.wantData    = { w1:  { itemNum:'2333', variation:'1', row:2, targetPrice:'300' } };
  state.upgradeData = { u1:  { itemNum:'773',  variation:'1', row:2, targetPrice:'900' } };
  state.soldData    = { s1:  { itemNum:'3376', variation:'2', row:2, salePrice:'60', dateSold:'2026-07-01' } };
  try { if (typeof buildPartnerMap === 'function') buildPartnerMap(); } catch (e) {}
  try { if (typeof buildApp === 'function') buildApp(); } catch (e) {}

  // ── BOOT INTO THE STATE A SIGNED-IN USER ACTUALLY SEES ──────────────────
  //
  // Found while building help-hub.js, and it had been quietly wrong in every
  // guide gate before it. Headless, with no Google auth, the beta-gate screen
  // stays displayed ABOVE #app — so the whole application rendered 872px down
  // a scrolling document, entirely below the fold. Measured: the Need Help?
  // widget sat at y=1391 in an 800px window and elementFromPoint at its centre
  // returned null, which read as "the only door into the Help Centre cannot be
  // pressed". It is not a bug. It is a page state no user is ever in.
  //
  // That matters beyond the false alarm. The tour's blocker, spotlight and
  // card are position:fixed — viewport coordinates — while page content sat a
  // screenful below. Any assertion of the form "is this control covered" was
  // comparing two different coordinate spaces and could pass for the wrong
  // reason. Hiding the pre-app screens here fixes it for every gate at once,
  // which is the point of one shared fixture.
  try {
    ['beta-gate', 'auth-screen', 'setup-screen'].forEach(function (id) {
      var n = document.getElementById(id); if (n) n.style.display = 'none';
    });
    var _app = document.getElementById('app');
    if (_app && !_app.classList.contains('active')) _app.classList.add('active');
    window.scrollTo(0, 0);
  } catch (e) {}
})();
`;

// The tour engine's own resolution rule, reproduced exactly. If this and
// tutorial.js ever disagree, this audit is lying — so it is written to match
// resolve() line for line rather than approximating it.
const RESOLVE = `
window._walkResolve = function (step) {
  if (!step.selector) return { kind: 'narration' };
  var cands = document.querySelectorAll(step.selector), el = null;
  for (var c = 0; c < cands.length; c++) { if (cands[c].offsetParent !== null) { el = cands[c]; break; } }
  if (el && step.wrap) el = el.closest(step.wrap) || el;
  if (!el) return { kind: 'MISS', matched: cands.length };
  var b = el.getBoundingClientRect();
  return { kind: 'hit', tag: el.tagName, id: el.id || '',
           text: (el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 60),
           w: Math.round(b.width), h: Math.round(b.height) };
};
`;


// ── THE DRIVER ────────────────────────────────────────────────────────────
// Brad, after an audit that only pressed Next: "do each freaking step like a
// user would and fill the things out". These are the hands that do that —
// read the card, find the control the step really points at, and use it. They
// live here because two gates now need them: guide-drive (does the guide keep
// up?) and guide-buttons (Cancel, Back, and 773-then-Enter).
const DRIVER = `
window._clearOverlays = function () {
  for (var i = 0; i < 6; i++) {
    var c = document.querySelectorAll('[id^="rr-"][id$="-card"]');
    if (!c.length) return;
    for (var k = 0; k < c.length; k++) {
      var g = c[k].querySelector('[id$="-go"]');
      if (g) { try { g.click(); } catch (e) {} }
      if (c[k].parentNode) c[k].parentNode.removeChild(c[k]);
    }
  }
};
window._drvResolve = function (step) {
  if (!step.selector) return null;
  var cands = document.querySelectorAll(step.selector), el = null;
  for (var c = 0; c < cands.length; c++) { if (cands[c].offsetParent !== null) { el = cands[c]; break; } }
  if (el && step.wrap) el = el.closest(step.wrap) || el;
  return el;
};
window._drvCard = function () {
  var c = document.getElementById('gt-callout');
  if (!c) return null;
  var t = (c.innerText || '');
  var m = t.match(/Step (\\d+) of (\\d+)/);
  return { title: t.split('\\n')[0].trim(), step: m ? +m[1] : null, of: m ? +m[2] : null };
};
window._drvWizard = function () {
  var w = document.querySelector('#wizard-modal.open');
  if (!w) return null;
  var t = (w.innerText || '').split('\\n').filter(Boolean);
  return { head: (t[0] || '').trim(), title: (t[1] || '').trim() };
};
// THE APP'S OWN POSITION, as a string. The rule the drive gate enforces is not
// "the guide must advance whenever you click" — clicking an inert stat card
// correctly changes nothing, and a guide that advanced anyway would be worse.
// It is: IF THE APP MOVED AND THE GUIDE DID NOT, THE GUIDE IS NOW WRONG.
window._drvWhere = function () {
  var pg = (document.querySelector('.page.active') || {}).id || '';
  var w = window._drvWizard();
  return pg + ' :: ' + (w ? (w.head + ' / ' + w.title) : 'no-wizard');
};
window._drvStranded = function (gid) {
  var card = window._drvCard();
  if (!card || card.step == null) return null;
  var st = GUIDES[gid].steps[card.step - 1];
  if (!st) return null;
  // A closed wizard leaves its modal measurable — offsetParent stays non-null —
  // so a selector check alone reports "still on screen" for a screen that has
  // been thrown away. Proven by drill: with the tour's watchdog disabled, this
  // function returned null on a card visibly describing a wizard that was
  // gone. The step's own needs predicate is the only thing that can see it, so
  // it is asked first.
  if (typeof st.needs === 'function') {
    var okNeeds = true;
    try { okNeeds = !!st.needs(); } catch (e) { okNeeds = true; }
    if (!okNeeds) return { step: card.step, title: card.title, selector: st.selector || '(narration)', why: 'needs' };
  }
  if (!st.selector) return null;                  // narration is never stranded
  return window._drvResolve(st) ? null : { step: card.step, title: card.title, selector: st.selector, why: 'selector' };
};
// Do what the card says, on the real control.
window._drvAct = async function (gid) {
  var card = window._drvCard();
  if (!card || card.step == null) return 'no-card';
  var st = GUIDES[gid].steps[card.step - 1];
  var el = st ? window._drvResolve(st) : null;
  if (!el) return 'nothing-to-act-on';
  var tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    el.focus();
    var val = (el.id === 'wiz-input') ? '773' : '1';
    el.value = '';
    val.split('').forEach(function (ch) {
      el.value += ch;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' }));
    });
    await new Promise(r => setTimeout(r, 900));
    // BRAD'S COMBINATION, BY NAME: "what happens if i hit an entered number
    // like 773 and then hit enter after it".
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
    return 'typed+enter';
  }
  if (tag === 'SELECT') return 'select-left-alone';
  try { el.click(); return 'clicked'; } catch (e) { return 'click-failed'; }
};
// THE ENGINE'S OWN "DOES THIS STEP STILL APPLY" RULE, needs predicate and all.
//
// MEASURED, and it matters: when the wizard closes, its modal is hidden in a
// way that leaves offsetParent non-null, so #wiz-photoid-block still reads as
// ON SCREEN to any selector check. "Does the selector resolve" is therefore
// blind to a closed wizard — which is exactly why the tour engine grew a
// needs predicate for those steps rather than relying on selectors. Any
// assertion about backing out of the wizard has to ask the same question.
window._drvApplies = function (gid) {
  var c = window._drvCard();
  if (!c || c.step == null) return null;
  var st = GUIDES[gid].steps[c.step - 1];
  if (!st) return null;
  var needsOk = true;
  if (typeof st.needs === 'function') { try { needsOk = !!st.needs(); } catch (e) { needsOk = true; } }
  return { step: c.step, title: c.title, hasNeeds: typeof st.needs === 'function',
           needsOk: needsOk, resolves: st.selector ? !!window._drvResolve(st) : true };
};
// Put the app back to a known place between runs, without saving anything.
window._drvReset = async function () {
  window._clearOverlays();
  try { _gtEnd(); } catch (e) {}
  try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); } catch (e) {}
  try { if (typeof showPage === 'function') showPage('dashboard'); } catch (e) {}
  await new Promise(r => setTimeout(r, 350));
};
// Wait until the guide reacts, rather than sleeping a flat guess. The first
// version of the drive gate slept 1400ms and reported add-item #1 as broken;
// a focused probe proved the guide DID advance — step 2 carries a before()
// hook that holds the redraw another 900ms. A harness that cries wolf on a
// fix just shipped is worse than no harness.
window._drvSettle = async function (fromStep, budgetMs) {
  var t = 0, span = 150, cap = budgetMs || 4500;
  while (t < cap) {
    await new Promise(r => setTimeout(r, span)); t += span;
    var c = window._drvCard();
    if (!c) return 'ended';
    if (fromStep != null && c.step !== fromStep) { await new Promise(r => setTimeout(r, 650)); return 'moved'; }
  }
  return 'stayed';
};
`;


module.exports = { SEED, RESOLVE, DRIVER };
