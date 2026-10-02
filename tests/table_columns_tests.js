#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TABLE-COLUMNS TESTS — v0.9.1864   (real Chromium, the REAL app, no stubs)
//
// Brad, 2026-10-02: "probably need the edit column function on the for sale
// page as well." Release 3 of the column-editor brainstorm: the ✎ / + Add /
// drag / × machinery became ONE piece (table-columns.js) that any table
// registers with — For Sale now, My Collection moved onto it — so a fix lands
// in both because there is only one place for it to land.
//
// Every check presses the real control on the real page: the For Sale table
// gets the whole editor; My Collection still behaves exactly as v1862 pinned
// (column_switch_tests runs beside this one); the two tables share the one
// engine and the one rule for a column's Preferences switch.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  table_columns_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, got, want) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))); ok ? pass++ : fail++; }
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');

async function open(browser, planted, width) {
  const pg = await browser.newPage({ viewport: { width: width || 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const clean = u.split('?')[0];
    const name = Object.keys(planted || {}).find(k => clean.endsWith('/' + k));
    if (name) return r.fulfill({ body: planted[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    localStorage.clear();
    const PW = 'Lionel PW - Items';
    const mk = (n, v, t, road) => ({ itemNum: n, variation: v, itemType: t, _era: 'pw', _tab: PW, yearProd: '1950', description: t + ' ' + n, roadName: road || '' });
    state.masterData = [mk('6457', '3', 'Caboose', 'Lionel Lines'), mk('6464', '1', 'Boxcar', 'Western Pacific'), mk('2343', '1', 'Diesel', 'Santa Fe')];
    _rebuildMasterIndex();
    let inv = 1;
    const pd = (n, v, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: 'pw', manufacturer: 'Lionel', inventoryId: String(inv++), row: inv + 1 }, x || {});
    state.personalData = {
      '1': pd('6457', '3', { location: 'Basement', locationDetail: 'Tote 12', priceItem: '45', notes: 'runs well', custom2: 'Dad' }),
      '2': pd('6464', '1', { location: 'Garage', priceItem: '120' }),
      '3': pd('2343', '1', { location: 'Attic' }),
    };
    state.forSaleData = {
      '1': { inventoryId: '1', itemNum: '6457', variation: '3', askingPrice: '60', condition: '7', dateListed: '2026-09-01', row: 2 },
      '2': { inventoryId: '2', itemNum: '6464', variation: '1', askingPrice: '150', condition: '8', dateListed: '2026-09-15', row: 3 },
    };
    _currentEra = 'all';
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-forsale').classList.add('active');
    buildForSalePage();
  });
  return { pg, errs };
}

// What the For Sale screen shows: heading ids and the first row's cell ids.
const READ = () => {
  const ths = Array.from(document.querySelectorAll('#page-forsale .item-table thead th[data-col]')).map(t => t.getAttribute('data-col'));
  const tr = document.querySelector('#forsale-tbody tr[id^="share-card-"]');
  const tds = tr ? Array.from(tr.querySelectorAll('td[data-col]')).map(t => t.getAttribute('data-col')) : [];
  const cell = id => { const td = tr && tr.querySelector('td[data-col="' + id + '"]'); return td ? td.textContent.trim() : null; };
  return { ths, tds, same: JSON.stringify(ths) === JSON.stringify(tds), location: cell('location'), paid: cell('paid'), num: cell('num') };
};

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── A: the For Sale table has the whole editor ────────────────────────────
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate((READ) => {
      const read = eval('(' + READ + ')');
      const out = {};
      out.start = read();
      out.pencil = !!document.querySelector('#page-forsale thead th[data-col="actions"] button[title^="Edit columns"]');
      document.querySelector('#page-forsale thead th[data-col="actions"] button').click();          // ✎
      out.editOn = Object.assign(read(), { flag: !!state._fsColEdit, handles: document.querySelectorAll('#page-forsale thead th.rr-th-edit').length, locked: Array.from(document.querySelectorAll('#page-forsale thead th.rr-th-edit.locked')).map(t => t.getAttribute('data-col')) });
      document.querySelector('#page-forsale thead th[data-col="actions"] button').click();          // + Add
      out.menu = Array.from(document.querySelectorAll('#rr-addcol .rr-addcol-item')).map(b => ({ name: b.firstChild.textContent.trim(), titled: b.title.length > 20 }));
      document.querySelector('#rr-addcol .rr-addcol-item[onclick*="location\'"]').click();       // Location
      out.add = Object.assign(read(), { saved: localStorage.getItem('lv_fs_columns_v1') });
      rrTableAdd('forsale', 'paid');
      out.addPaid = read();
      rrTableSetOrder('forsale', ['paid', 'location', 'type', 'road', 'photo', 'desc', 'cond', 'price', 'worth', 'listed']);
      out.drag = read();
      document.querySelector('#page-forsale thead th[data-col="location"] button').click();        // × on the heading
      out.drop = read();
      Array.from(document.querySelectorAll('#page-forsale thead th[data-col="actions"] button')).pop().click();   // Done
      out.done = Object.assign(read(), { flag: !!state._fsColEdit });
      // sorting still works, by a standard column and by the added one
      document.querySelector('#page-forsale thead th[data-col="price"]').click();
      out.sortPrice = { sort: state._fsSort, first: read().num, arrow: /▲|▼/.test(document.querySelector('#page-forsale thead th[data-col="price"]').textContent) };
      document.querySelector('#page-forsale thead th[data-col="paid"]').click();
      document.querySelector('#page-forsale thead th[data-col="paid"]').click();                    // desc
      out.sortPaid = { sort: state._fsSort, first: read().num };
      state._fsSort = null;
      rrTableReset('forsale');
      out.reset = Object.assign(read(), { saved: localStorage.getItem('lv_fs_columns_v1') });
      // the empty state spans the chosen columns
      rrTableAdd('forsale', 'notes');
      const keep = state.forSaleData; state.forSaleData = {}; buildForSalePage();
      out.empty = { colspan: document.querySelector('#forsale-tbody td[colspan]').getAttribute('colspan'), want: String(rrTableColSpan('forsale')) };
      state.forSaleData = keep; rrTableReset('forsale');
      return out;
    }, READ.toString());
    T('A: no page errors', errs.join(' | '), '');
    T('A: before anything, headings and cells agree, and the ✎ is on the Actions heading', [r.start.same, r.start.ths.length, r.pencil], [true, 11, true]);
    T('A: ✎ turns edit mode on — handles on every heading, Maker and Item # locked', [r.editOn.same, r.editOn.flag, r.editOn.handles, r.editOn.locked], [true, true, 10, ['mfr', 'num']]);
    T('A: the + Add menu lists the personal-row columns, each with its sentence; not Condition or Road Name (already columns); no free custom slot, only the one holding data',
      [r.menu.length > 8, r.menu.every(m => m.titled), r.menu.some(m => m.name === 'Condition'), r.menu.some(m => m.name === 'Road Name'), r.menu.filter(m => /^Custom \d$/.test(m.name)).map(m => m.name), r.menu.some(m => m.name === 'Location Detail')],
      [true, true, false, false, ['Custom 2'], true]);   // Custom 2 holds data on a row, so it is not spare (v1862)
    T('A: + Add Location (the real menu entry) — the rows have it at once, showing the linked row’s place; the layout is saved under its own key',
      [r.add.same, r.add.tds.indexOf('location') > 0, r.add.location, r.add.saved], [true, true, 'Basement', '["type","road","photo","desc","cond","price","worth","listed","location"]']);
    T('A: + Add Price Paid shows the money', [r.addPaid.same, r.addPaid.paid], [true, '$45']);
    T('A: drag to reorder — the cells take the new order', [r.drag.same, r.drag.tds.slice(0, 4)], [true, ['mfr', 'num', 'paid', 'location']]);
    T('A: the × on a heading removes it from the rows too', [r.drop.same, r.drop.tds.indexOf('location')], [true, -1]);
    T('A: Done leaves them agreeing and edit mode off', [r.done.same, r.done.flag], [true, false]);
    T('A: sorting by Asking Price still works (arrow shown, cheapest first)', r.sortPrice, { sort: { col: 'price', dir: 'asc' }, first: '6457', arrow: true });
    T('A: …and by the added Price Paid column, as a number (desc → $120 first)', r.sortPaid, { sort: { col: 'paid', dir: 'desc' }, first: '6464' });
    T('A: Reset to default', [r.reset.same, r.reset.tds.length, r.reset.saved], [true, 11, null]);
    T('A: the empty state spans the chosen columns', r.empty.colspan, r.empty.want);
    await pg.close();
  }

  // ── B: one rule for a column’s Preferences switch, on BOTH tables ───────
  {
    const { pg, errs } = await open(browser);
    const r = await pg.evaluate(() => {
      const out = {};
      rrTableAdd('forsale', 'locationDetail');
      out.fs = { sw: localStorage.getItem('lv_locdetail_enabled'), asked: /wiz-uf-locationDetail/.test(_wizUserFieldsHtml({})) };
      rrTableDrop('forsale', 'locationDetail');
      out.afterDrop = localStorage.getItem('lv_locdetail_enabled');
      // the two tables are two registrations of the one engine
      out.engine = { coll: JSON.stringify(rrTableVisible('collection')) === JSON.stringify(_collVisibleCols()), ids: Object.keys(RR_TABLES).sort(), fsLocked: rrTable('forsale').locked, collLocked: rrTable('collection').locked };
      // each keeps its own layout
      rrTableAdd('forsale', 'notes');
      out.separate = { fs: rrTableVisible('forsale').indexOf('notes') > 0, coll: rrTableVisible('collection').indexOf('notes') };
      return out;
    });
    T('B: no page errors', errs.join(' | '), '');
    T('B: + Add Location Detail on For Sale turns its Extra Columns switch on, and the wizard asks', r.fs, { sw: 'true', asked: true });
    T('B: × leaves the switch alone', r.afterDrop, 'true');
    T('B: My Collection and For Sale are two registrations of the ONE engine, each with Maker + Item # locked', r.engine, { coll: true, ids: ['collection', 'forsale'], fsLocked: ['mfr', 'num'], collLocked: ['mfr', 'num'] });
    T('B: each table keeps its own layout', r.separate, { fs: true, coll: -1 });
    await pg.close();
  }

  // ── C: the phone shows cards, untouched ───────────────────────────────────
  {
    const { pg, errs } = await open(browser, null, 600);
    const r = await pg.evaluate(() => ({ cards: document.getElementById('forsale-cards').style.display, table: document.getElementById('forsale-table-wrap').style.display, n: document.querySelectorAll('#forsale-cards > div[id^="share-card-"], #forsale-cards > div').length }));
    T('C: no page errors', errs.join(' | '), '');
    T('C: on a phone the For Sale page draws cards and hides the table', [r.cards, r.table, r.n >= 2], ['flex', 'none', true]);
    await pg.close();
  }

  // ── PLANTED: a For Sale row builder with a fixed cell order ───────────────
  {
    const src = rd('app-pages.js');
    const anchor = "${rrTableVisible('forsale').map(function (id) { return _c[id] || '<td data-col=\"' + id + '\"><span style=\"color:var(--text-dim)\">—</span></td>'; }).join('')}";
    T('PLANTED: the row builder emits the cells in the chosen order, once', src.split(anchor).length - 1, 1);
    const old = src.replace(anchor, "${['mfr','num','type','road','photo','desc','cond','price','worth','listed'].map(function (id) { return _c[id]; }).join('')}");
    const { pg } = await open(browser, { 'app-pages.js': old });
    const r = await pg.evaluate((READ) => { const read = eval('(' + READ + ')'); rrTableAdd('forsale', 'location'); return read(); }, READ.toString());
    T('PLANTED: with a fixed order, + Add leaves the rows a column short — caught', [r.ths.indexOf('location') > 0, r.tds.indexOf('location')], [true, -1]);
    await pg.close();
  }

  // ── source rules: one engine, loaded and precached, layouts travel ────────
  const browse = rd('browse.js'), pages = rd('app-pages.js'), eng = rd('table-columns.js');
  T('SRC: My Collection’s header is the engine’s (one-line wrappers, no second renderer)',
    /function _renderCollectionHeader\(\) \{ rrTableRenderHeader\('collection'\); \}/.test(browse) && !/'<th data-col="' \+ c\.col/.test(browse), true);
  T('SRC: For Sale’s header is the engine’s too', /function _renderFsHeader\(\) \{ rrTableRenderHeader\('forsale'\); \}/.test(pages) && !/<th onclick="_fsSortBy/.test(pages), true);
  T('SRC: the heading markup is built in ONE place', [(eng.match(/'<th data-col="' \+ col/g) || []).length >= 3, (browse + pages).indexOf("'<th data-col=\"' + col") < 0], [true, true]);
  T('SRC: the extra-column list lives once (table-columns.js) and browse.js aliases it', /var _COLL_EXTRA_COLS = RR_ROW_EXTRA_COLS;/.test(browse) && (eng.match(/var RR_ROW_EXTRA_COLS = \[/g) || []).length === 1, true);
  T('SRC: the extra cell is built once (both tables call rrRowExtraCellHtml)', /rrRowExtraCellHtml\(xc, pd/.test(browse) && /rrRowExtraCellHtml\(xc, collPd\)/.test(pages), true);
  T('SRC: index.html loads the engine before browse.js', rd('index.html').indexOf('table-columns.js?v=') < rd('index.html').indexOf('browse.js?v='), true);
  T('SRC: the service worker precaches it', /'\.\/table-columns\.js'/.test(rd('sw.js')), true);
  T('SRC: the For Sale layout travels between devices like My Collection’s', /'lv_fs_columns_v1'/.test(rd('look-sync.js')), true);
  T('SRC: the engine draws no colour of its own (every shade is a palette variable)', /#[0-9a-f]{3,6}\b|rgba?\(/i.test(eng.replace(/\/\/.*$/gm, '')), false);

  await browser.close();
  console.log('\n' + (fail ? fail + ' FAILED, ' : '') + pass + ' passed' + (fail ? '' : ' — ALL GREEN'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
