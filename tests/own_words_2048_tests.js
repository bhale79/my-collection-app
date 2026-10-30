#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// A PERSON'S OWN WORDS ARE SHOWN AS WORDS — v0.9.2048 (known-problems sweep,
// release 3, type B13)   (real Chromium, the REAL app, measured)
//
// The sweep found ≈8 fields a person types (notes, location, Not Original,
// Your Grade, the seller's name, a manual item's maker / type / description,
// a part's description and number, an instruction sheet's number, a catalog's
// type, a paper item's title) poured into the page raw. A note with a "<" in
// it — "<b>MINT</b>", "boxed < 1955" — was READ AS PAGE CODE: words vanished
// or the layout broke. And the parts page's Google button used its own quote
// escape that a backslash undid, so a description ending in "\" killed it.
//
// How this test measures: boot the real app on the guide fixture, then put
// marked markup — <i data-rrx="FIELD">FIELD</i>'s \ — into EVERY text field of
// every list (personal, manual, sold, for sale, want, upgrade, instruction
// sheets, parts, contacts, catalogs, paper). Walk 21 screens at computer and
// phone size. On each, three things must be true:
//   1. no VISIBLE <i data-rrx> element exists (the words were not read as code)
//   2. the marker shows as TEXT somewhere (the screen really drew the field —
//      a screen that stopped drawing cannot pass by showing nothing)
//   3. no visible on-click handler fails to parse (the apostrophe and the
//      trailing backslash in the data are inside the buttons' arguments too)
//      and nothing is escaped twice (&lt; shown on screen).
//   P  planted offenders — the old code served for one spot at a time must
//      turn its own screen red.
// ═════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  own_words_2048_tests needs playwright and it is not installed.'); process.exit(1); }
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

const KEEP = /^(itemNum|variation|inventoryId|era|row|_key|id|owned|matchedTo|groupId|masterKey|masterRowId|status|condition|datePurchased|dateAdded|dateSold|dateListed|dateBought|dateInstalled|priceItem|userEstWorth|askingPrice|salePrice|targetPrice|pricePaid|estValue|photo.*|forInv|forItem|linkedItem|year|quantity|qty|hasBox|allOriginal|isError|taskId|formCode)$/;
const INJECT = `(function(){
  var M = function(f){ return '<i data-rrx="'+f+'">'+f+"</i>'s \\\\"; };
  function dose(o){ Object.keys(o).forEach(function(k){ if (!${KEEP}.test(k) && typeof o[k]==='string') o[k]=M(k); }); }
  Object.values(state.personalData).forEach(function(p){ p.notes='x'; p.location='x'; p.notOriginalDesc='x'; p.allOriginal='No'; p.yourGrade='x'; p.yearMade='x'; p.errorDesc='x'; p.isError='Yes'; p.yourDescription='x'; p.purchasedFrom='C-1'; dose(p); p.purchasedFrom='C-1'; });
  state.personalData['MAN-1|||9'] = { itemNum:'MAN-1', variation:'', owned:true, inventoryId:'46099', row:9, era:'Manual',
     description:'x', roadName:'x', itemType:'x', manufacturer:'x', notes:'x', location:'x', condition:'7' };
  dose(state.personalData['MAN-1|||9']);
  Object.values(state.soldData).forEach(function(p){ p.notes='x'; p.buyer='x'; p.soldTo='x'; p.description='x'; dose(p); });
  Object.values(state.forSaleData).forEach(function(p){ p.notes='x'; dose(p); });
  Object.values(state.wantData).forEach(function(p){ p.notes='x'; dose(p); });
  Object.values(state.upgradeData).forEach(function(p){ p.notes='x'; dose(p); });
  state.isData = { '46050': { _key:'46050', row:3, sheetNum:'923-12', linkedItem:'3376', year:'1955', condition:'8', notes:'x', photoLink:'', inventoryId:'46050', groupId:'', formCode:'x', pricePaid:'', estValue:'' } };
  dose(state.isData['46050']);
  state.partsData = { p3: { row:3, id:'P-1', description:'x', partNum:'x', forItem:'3376', forInv:'46001', photo:'', notes:'x', dateAdded:'2026-10-01', status:'wanted', dateBought:'', dateInstalled:'', taskId:'' } };
  dose(state.partsData.p3);
  state.contactsData = [{ row:2, id:'C-1', name:'x', business:'x', phone:'x', email:'x', specialties:'x', notes:'x', cardLink:'', met:'x', dateAdded:'2026-10-01', address:'x', website:'x', home:'x', cell:'x', title:'x', personPhoto:'', pref:'' }];
  dose(state.contactsData[0]);
  state.ephemeraData = state.ephemeraData || {};
  state.ephemeraData.catalogs = { 2: { row:2, itemNum:'C-55', catType:'x', year:'1955', hasMailer:'x', condition:'8', pricePaid:'', estValue:'', notes:'x', photoLink:'', inventoryId:'46060' } };
  dose(state.ephemeraData.catalogs[2]);
  state.ephemeraData.paper = { 2: { row:2, itemNum:'PA-1', title:'x', description:'x', year:'1955', manufacturer:'x', condition:'8', quantity:'1', pricePaid:'', estValue:'', notes:'x', photoLink:'', inventoryId:'46061' } };
  dose(state.ephemeraData.paper[2]);
})()`;
const COUNT = `(function(){ var out={}; document.querySelectorAll('i[data-rrx]').forEach(function(e){ if (!e.getClientRects().length) return; var f=e.getAttribute('data-rrx'); out[f]=(out[f]||0)+1; });
  var broken=0; document.querySelectorAll('*').forEach(function(e){ for (var a of e.attributes) if (e.getClientRects().length && /^[a-z]+">/i.test(a.name) || /<\\/i>/.test(a.name)) broken++; });
  if (broken) out['(broken attribute)']=broken;
  var dbl=0, shown=0; var w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); var n; while ((n=w.nextNode())) { var pe=n.parentElement; if (!pe || !pe.getClientRects().length) continue; if (/&(lt|gt|amp|quot|#39);/.test(n.nodeValue)) dbl++; if (/<i data-rrx=/.test(n.nodeValue)) shown++; }
  if (dbl) out['(double-escaped)']=dbl;
  var bh=[]; document.querySelectorAll('*').forEach(function(e){ if (!e.getClientRects().length) return; for (var a of e.attributes) { if (/^on[a-z]+$/.test(a.name) && a.value.trim() && e[a.name] === null) bh.push(a.name+':'+a.value.slice(0,70)); } });
  if (bh.length) { out['(broken handler)']=bh.length; window.__bh=bh; } else window.__bh=[]; window.__shown=shown; return out; })()`;

// [name, how to open it, does the screen draw a person's words (must show the marker as text)]
const VIEWS = [
  ['dashboard', "showPage('dashboard', null)", false],
  ['collection list', "showPage('browse', null); filterOwned();", true],
  ['upgrade/want', "showPage('upgrade', null); buildUpgradePage();", true],
  ['for sale', "showPage('forsale', null); buildForSalePage();", false],
  ['parts', "showPage('parts', null); buildPartsPage();", true],
  ['sold', "showPage('sold', null); if (typeof buildSoldPage==='function') buildSoldPage();", true],
  ['contacts', "showPage('contacts', null); if (window._ctRenderList) window._ctRenderList();", true],
  ['reports', "showPage('reports', null);", false],
  ['item page 3376', "_openOwnedByInvId('46001')", true],
  ['item page 773', "_openOwnedByInvId('46002')", true],
  ['item page manual', "_openOwnedByInvId('46099')", true],
  ['sold detail', "showSoldDetailPage('s1')", true],
  ['instruction sheet page', "showNonItemDetailPage('is','46050')", true],
  ['instruction sheet popup', "openISDetail('46050')", true],
  ['catalog page', "showNonItemDetailPage('catalogs', 2)", true],
  ['paper page', "showNonItemDetailPage('paper', 2)", true],
  ['collection: instruction sheets', "showPage('browse', null); filterOwned(); _collSectionSet('is');", true],
  ['collection: catalogs', "showPage('browse', null); filterOwned(); _collSectionSet('catalogs');", true],
  ['collection: paper', "showPage('browse', null); filterOwned(); _collSectionSet('paper');", true],
  ['want item page', "_wantViewDetail('2333','1')", true],
  ['contact edit', "showPage('contacts', null); window._ctOpenEdit && window._ctOpenEdit(2);", true],
];

async function boot(browser, vp, served) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.touch, hasTouch: !!vp.touch });
  await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await ctx.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://') && !u.startsWith('about:') && !u.startsWith('data:')) return r.abort();
    const name = u.split('?')[0].split('/').pop();
    if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: CT[path.extname(name)] || 'text/plain' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'));
  await pg.waitForTimeout(2000);
  await pg.evaluate(SEED); await pg.waitForTimeout(300);
  await pg.evaluate(INJECT);
  return { ctx, pg, errs };
}

async function walk(pg, views) {
  const res = {};
  for (const [name, open] of views) {
    await pg.evaluate(new Function('try{' + open + '}catch(e){window.__e=e.message}'));
    await pg.waitForTimeout(450);
    const e = await pg.evaluate(() => { const x = window.__e; window.__e = null; return x; });
    const c = await pg.evaluate(COUNT);
    const shown = await pg.evaluate(() => window.__shown);
    const bh = await pg.evaluate(() => window.__bh || []);
    res[name] = { c, shown, bh, e };
    // take down this screen's pop-ups so the next screen is measured alone
    await pg.evaluate(() => { document.querySelectorAll('body > *').forEach(o => { const cs = getComputedStyle(o); if (cs.position === 'fixed' && !['app', 'wizard-modal'].includes(o.id) && /data-rrx/.test(o.innerHTML)) o.remove(); }); document.querySelectorAll('.modal-overlay').forEach(o => { if (o.id !== 'wizard-modal' && /data-rrx/.test(o.innerHTML)) o.remove(); }); });
  }
  return res;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  let browser;
  try { browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }
  const VPS = [['computer', { w: 1400, h: 900 }], ['phone', { w: 390, h: 844, touch: true }]];
  const runs = await Promise.all(VPS.map(async ([label, vp]) => {
    const a = await boot(browser, vp); const r = await walk(a.pg, VIEWS); const errs = a.errs.slice(); await a.ctx.close(); return [label, r, errs];
  }));
  for (const [label, r, errs] of runs) {
    for (const [name, , draws] of VIEWS) {
      const x = r[name];
      ok(label + ' · ' + name + ' — opens', !x.e, x.e);
      const leaks = Object.keys(x.c).filter(k => !/^\(/.test(k));
      ok(label + ' · ' + name + ' — a person\'s words are not read as page code', !leaks.length, JSON.stringify(x.c));
      ok(label + ' · ' + name + ' — every button\'s action still works with \' and \\ in the words', !x.c['(broken handler)'] && !x.c['(broken attribute)'], (x.bh || []).slice(0, 3).join(' | '));
      ok(label + ' · ' + name + ' — nothing shown escaped twice', !x.c['(double-escaped)'], String(x.c['(double-escaped)']));
      if (draws) ok(label + ' · ' + name + ' — the words really are on the screen, as words', x.shown > 0, 'shown ' + x.shown);
    }
    ok(label + ' · no page errors while walking', !errs.length, errs.slice(0, 3).join(' | '));
  }

  // ── P: planted offenders — the old line served, one screen each must go red ──
  const PL = [
    ['app-pages.js', "line-height:1.6\">' + rrEsc(sd.notes) + '</div></div>';", "line-height:1.6\">' + sd.notes + '</div></div>';", 'sold detail', 'leak', 'P1 the sold page\'s notes raw'],
    ['app-pages.js', "var esc = rrJsArg;", "var esc = function (s) { return String(s || '').replace(/'/g, \"\\\\'\").replace(/\"/g, '&quot;'); };", 'parts', 'handler', 'P2 the parts page\'s old quote escape'],
    ['app-collection.js', "val: pd && pd.location ? rrEsc(pd.location) : null }", "val: pd && pd.location ? pd.location : null }", 'item page 3376', 'leak', 'P3 the item page\'s Location raw'],
    ['browse.js', "title=\"${rrEsc(_descFull)}\">${rrEsc(_descFull)}${", "title=\"${(_descFull||'').replace(/\"/g,'&quot;')}\">${_descFull}${", 'collection list', 'leak', 'P4 My Collection\'s description column raw'],
  ];
  const served = {};
  for (const [file, from, to, , , label] of PL) served[file] = plant(served[file] || read(file), from, to, label);
  const pb = await boot(browser, VPS[0][1], served);
  const pr = await walk(pb.pg, VIEWS.filter(v => PL.some(p => p[3] === v[0])));
  await pb.ctx.close();
  for (const [, , , view, kind, label] of PL) {
    const x = pr[view];
    const red = kind === 'leak' ? Object.keys(x.c).some(k => !/^\(/.test(k)) : !!x.c['(broken handler)'];
    ok(label + ' — turns "' + view + '" red', red, JSON.stringify(x.c));
  }

  // ── S: the no-op escape that hid in browse.js — replace(/'/g,"\'") escapes nothing ──
  const NOOP = /replace\(\s*\/'\/g\s*,\s*"\\'"\s*\)/;
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
  const offenders = fs.readdirSync(APP).filter(f => /\.js$/.test(f)).filter(f => NOOP.test(strip(read(f))));
  ok('S1 no app file uses replace(/\'/g, "\\\'") — it escapes nothing (use rrJsArg)', !offenders.length, offenders.join(', '));
  ok('S1p the scan catches a planted one', NOOP.test(strip("const v = (x||'').replace(/'/g,\"\\'\");")));

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.stack); process.exit(1); });
