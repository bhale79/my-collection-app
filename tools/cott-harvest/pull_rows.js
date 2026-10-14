// tools/cott-harvest/pull_rows.js — step 1 of a COTT deep-link harvest (read-only).
//
// Reads every inventory tab of the master as public CSV (the master-audit reader),
// keeps the rows whose Reference Link is a COTT page, and lists the COTT pages
// whose links still open at the page TOP because the page is not in the app's
// deep-link map (app/cott-anchors.js).
//
//   node tools/cott-harvest/pull_rows.js <out-dir>
//   → <out-dir>/cott_rows.json, <out-dir>/pages_unharvested.json  [[slug, rows], …]
const fs = require('fs'), path = require('path');
const au = require('../master-audit/audit.js');
(async () => {
  const out = process.argv[2]; if (!out) { console.log('usage: node tools/cott-harvest/pull_rows.js <out-dir>'); process.exit(2); }
  fs.mkdirSync(out, { recursive: true });
  const A = au.loadApp(); await au.loadGids(A);
  const rows = []; let total = 0;
  for (const t of au.auditTabs(A)) {
    let csv = null;
    for (let k = 0; k < 4 && !csv; k++) { try { csv = await au.readTab(A, t.tab); } catch (e) { await new Promise(r => setTimeout(r, 5000 * (k + 1))); } }
    if (!csv) { console.log('UNREADABLE: ' + t.tab + ' — the run is incomplete, run it again'); process.exit(1); }
    const cm = A.buildMasterColMap(csv[0]); if (!cm) continue;
    for (let n = 1; n < csv.length; n++) {
      const r = csv[n]; if (!r || !r.some(c => String(c || '').trim())) continue;
      total++;
      const m = A.parseMasterRow(r, t.tab, cm);
      if (/cornucopiaoftoytrains/i.test(m.refLink || '')) rows.push({ tab: t.tab, row: n + 1, itemNum: m.itemNum, variation: m.variation, roadName: m.roadName, itemType: m.itemType, varDesc: m.varDesc, refLink: m.refLink });
    }
  }
  global.window = {};
  new Function('window', fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'cott-anchors.js'), 'utf8'))(window);
  const D = window.COTT_DEEPLINK_MAP, pages = {};
  rows.forEach(r => {
    const u = window.cottAnchorUrl(r.refLink, r.itemNum, window.cottRowWords(r), r.variation || '');
    if (u.indexOf('#') >= 0) return;
    const slug = ((r.refLink.match(/toytrains\.com\/([^\/#?]+)/i) || [])[1] || '').toLowerCase();
    if (slug && !D[slug]) pages[slug] = (pages[slug] || 0) + 1;
  });
  const list = Object.entries(pages).sort((a, b) => b[1] - a[1]);
  fs.writeFileSync(path.join(out, 'cott_rows.json'), JSON.stringify(rows));
  fs.writeFileSync(path.join(out, 'pages_unharvested.json'), JSON.stringify(list));
  console.log(total + ' master rows read, ' + rows.length + ' link to COTT; ' + list.length + ' unharvested pages hold ' + list.reduce((s, x) => s + x[1], 0) + ' page-top links');
})();
