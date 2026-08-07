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


module.exports = { SEED, RESOLVE };
