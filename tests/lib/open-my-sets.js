// ══ tests/lib/open-my-sets.js — the ONE way a test reaches My Sets ═════════
//
// 2026-11-22 (mysetsfilter — [stated] Brad: "why is sets separated like that,
// that should just be a filter not its own thing" → "what about under
// collections"). The title-row "🎁 My Sets (n)" button is gone; My Sets opens
// from the "Sets (n)" line in the Type list's "My Collection" section:
//   phone     the title's Filters → the sheet's Filters → Type → Sets (n)
//   computer  the Type chip (or the pill) → Sets (n)
// Every suite and walk that opens My Sets comes here, so a change to the route
// is made once. Real taps only, each checked for being on screen first, so a
// planted walk whose Back went elsewhere just finds nothing to tap.

const TAP = ([sel, re]) => {
  const b = [...document.querySelectorAll(sel)].find(x => new RegExp(re).test(x.textContent.replace(/\s+/g, ' ').trim()) && x.getClientRects().length);
  if (!b) return false; b.click(); return true;
};
const tapText = (pg, sel, re) => pg.evaluate(TAP, [sel, re]);
const wait = (pg, ms) => pg.waitForTimeout(ms);

// The Type list, opened the way the screen offers it. Returns false when there
// was nothing to tap.
async function openTypeList(pg) {
  if (await pg.evaluate(() => typeof rrIsPhone === 'function' && rrIsPhone())) {
    if (!(await tapText(pg, '#rr-filter-btn', 'Filters'))) return false;
    await wait(pg, 200);
    await tapText(pg, '#rr-filter-sheet #hierarchy-chips button', 'Filters'); await wait(pg, 150);
    const ok = await tapText(pg, '#ph-more-menu button', '^Type'); await wait(pg, 200);
    return ok;
  }
  const ok = await tapText(pg, '#hierarchy-chips button', '^(Type|Sets)'); await wait(pg, 200);
  return ok;
}
// Everything openTypeList opened, closed again (the Type list, the More menu,
// the phone's Filters sheet).
const closeLists = pg => pg.evaluate(() => {
  const o = document.getElementById('ph-picker-overlay'); if (o) o.remove();
  const m = document.getElementById('ph-more-menu'); if (m) m.remove();
  if (typeof _rrFilterSheetClose === 'function') _rrFilterSheetClose();
});
// The Type list top to bottom: { h: a heading } or { b: a line's words }.
const readTypeList = pg => pg.evaluate(() => [...document.querySelectorAll('#ph-picker-overlay > div > *')].map(e =>
  e.tagName === 'BUTTON' ? { b: e.textContent.replace(/\s+/g, ' ').trim() } : { h: e.textContent.replace(/\s+/g, ' ').trim() }));
// The Sets line's words ("Sets (4)"), or '' when the list has none; closed again.
async function setsLine(pg) {
  await openTypeList(pg);
  const list = await readTypeList(pg);
  await closeLists(pg); await wait(pg, 200);
  const l = list.find(x => x.b && /^Sets \(\d+\)/.test(x.b));
  return l ? l.b.replace(/\s*✓$/, '') : '';
}
// My Sets, opened through that line. Returns whether the line was there.
async function openMySets(pg) {
  await openTypeList(pg);
  const ok = await tapText(pg, '#ph-picker-overlay button', '^Sets \\(');
  if (!ok) await closeLists(pg);
  await wait(pg, 450);
  return ok;
}

module.exports = { openTypeList, closeLists, readTypeList, setsLine, openMySets, tapText };
