#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// master_list_tests.js — tools/master-audit/audit.js, the master-list audit (roadmap 4.31, 2026-09-30)
// (named master_list, not master_audit: in tests/ the word "audit" means a report that never gates — run_all_tests pins that)
//
// The REAL audit run on a planted tab (a fixture directory stands in for the
// network): every rule fires on the one row planted for it and stays quiet on
// the good rows; the tab list comes from config.js, not a hand-typed list;
// duplicates are judged by the app's OWN dedupe key; the report and the
// flags file say what the flags say; the second run knows what is new and
// what cleared. Section H plants an offender for the load-bearing pieces.
//
// 2026-09-30, the reader: the audit reads each tab's EXPORT CSV (gid from the
// sheet's public page), never the gviz endpoint — gviz blanks a text cell in
// a mostly-numeric column ("116C", Variation "A"), which made 957 numbered
// rows look numberless. B4–B6 test the gid reader, C27/C28 a lettered number
// and a blank row's row number, F2 a tab the sheet does not have, H6 the
// planted gviz offender.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const audit = require('../tools/master-audit/audit.js');

let pass = 0, fail = 0;
function T(n, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (detail === undefined ? '' : JSON.stringify(detail))));
  cond ? pass++ : fail++;
}
function section(t) { console.log('\n== ' + t + ' =='); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'master-audit-'));

// ── the planted tab: Lionel PW - Items, the app's 18-column header ────────
const HEADER = ['Item Number', 'Item Type', 'Sub-Type', 'Unit', 'Powered/Dummy', 'Control', 'Road Name', 'Description', 'Gauge', 'Year Produced',
                'Variation #', 'Variation Details', 'Reference Link', 'Notes', 'Est. Market Value', 'Source', 'COTT Code', 'Original COTT Desc',
                'Category', 'Track/Power', 'MSRP'];   // the 21-column shape (Atlas / MTH); Lionel rows leave the last three blank
function row(o) {
  const r = { itemNum: '', itemType: '', subType: '', unit: '', poweredDummy: '', control: '', roadName: '', description: '', gauge: 'O Gauge', yearProd: '1955',
              variation: '', varDesc: '', refLink: '', notes: '', marketVal: '', source: 'Greenberg Book', cottCode: '', originalDesc: '' };
  Object.assign(r, o);
  return [r.itemNum, r.itemType, r.subType, r.unit, r.poweredDummy, r.control, r.roadName, r.description, r.gauge, r.yearProd,
          r.variation, r.varDesc, r.refLink, r.notes, r.marketVal, r.source, r.cottCode, r.originalDesc];
}
const GOOD = [
  row({ itemNum: '6464-425', itemType: 'Boxcar', roadName: 'New Haven', description: 'New Haven Boxcar, black', yearProd: '1956-1958', variation: 'A' }),
  row({ itemNum: '2343', itemType: 'Diesel Locomotive', subType: 'F3', unit: 'Powered A', poweredDummy: 'P', roadName: 'Santa Fe', description: 'Santa Fe F3 A unit', yearProd: '1950-1952', refLink: 'https://example.org/2343', marketVal: '450' }),
  row({ itemNum: '3472', itemType: 'Operating Freight', roadName: 'Lionel Lines', description: 'Operating Milk Car', yearProd: '1949-1953' }),
  row({ itemNum: '6511', itemType: 'Flatcar', description: 'Undecorated flatcar with pipes', yearProd: '1953' }),   // no road, but undecorated
  row({ itemNum: '022', itemType: 'Track', description: 'Remote-control switch pair', yearProd: '1945-1969' }),   // accessory kind: no road wanted
  row({ itemNum: '1364-12-58', itemType: 'Accessory', description: 'A number that wears dashes but is no date', yearProd: 'Fall 1958' }),
  row({ itemNum: '6017', itemType: 'Caboose', roadName: 'Lionel Lines', description: 'SP-type caboose', yearProd: '1955-1957, 1959', variation: 'B' }),
  row({ itemNum: '116C', itemType: 'Boxcar', roadName: 'Seaboard', description: 'a number with a letter in it — the shape the gviz CSV used to blank', yearProd: '1955' }),
];
const BAD = {
  'num-missing':        row({ itemNum: '', itemType: 'Boxcar', roadName: 'Erie', description: 'a boxcar with no number' }),
  'num-header':         row({ itemNum: 'Item Number', itemType: 'Item Type', description: 'Description' }),
  'num-date':           row({ itemNum: '2005-01-02', itemType: 'Boxcar', roadName: 'Erie', description: 'a number stored as a date' }),
  'num-decimal':        row({ itemNum: '3002231.0', itemType: 'Boxcar', roadName: 'Erie', description: 'a number stored as a decimal' }),
  'num-space':          row({ itemNum: ' 6464-1 ', itemType: 'Boxcar', roadName: 'Erie', description: 'a number with spaces' }),
  'type-missing':       row({ itemNum: '9001', itemType: '', roadName: 'Erie', description: 'no type at all' }),
  'type-unknown':       row({ itemNum: '9002', itemType: 'Premiums', description: 'a word the buckets do not know (left as its own word on purpose, v1844)' }),
  'road-blank':         row({ itemNum: '9003', itemType: 'Boxcar', roadName: '', description: 'a boxcar with no road — counted in coverage, never flagged' }),
  'desc-missing':       row({ itemNum: '9004', itemType: 'Boxcar', roadName: 'Erie', description: '' }),
  'desc-short':         row({ itemNum: '9005', itemType: 'Boxcar', roadName: 'Erie', description: 'TTX' }),
  'desc-bare-no':       row({ itemNum: '9006', itemType: 'Steam Locomotive', roadName: 'Lionel Lines', description: 'Locomotive No' }),
  'text-entity':        row({ itemNum: '9007', itemType: 'Boxcar', roadName: 'Erie', description: 'Baltimore &amp; Ohio boxcar' }),
  'year-unreadable':    row({ itemNum: '9008', itemType: 'Boxcar', roadName: 'Erie', description: 'year is prose', yearProd: 'Postwar era' }),
  'year-out-of-range':  row({ itemNum: '9009', itemType: 'Boxcar', roadName: 'Erie', description: 'year from the future', yearProd: '2199' }),
  'year-backwards':     row({ itemNum: '9010', itemType: 'Boxcar', roadName: 'Erie', description: 'range runs backwards', yearProd: '1960-1950' }),
  'year-off-era':       row({ itemNum: '9011', itemType: 'Boxcar', roadName: 'Erie', description: 'a prewar year on the postwar tab', yearProd: '1938' }),
  'gauge-unknown':      row({ itemNum: '9012', itemType: 'Boxcar', roadName: 'Erie', description: 'a gauge spelling the app cannot read', gauge: 'Toy' }),
  'link-bad':           row({ itemNum: '9013', itemType: 'Boxcar', roadName: 'Erie', description: 'a link that is not one', refLink: 'see COTT page 44' }),
  'value-bad':          row({ itemNum: '9014', itemType: 'Boxcar', roadName: 'Erie', description: 'a value with no amount in it', marketVal: 'no price shown' }),
  'value-absurd':       row({ itemNum: '9018', itemType: 'Boxcar', roadName: 'Erie', description: 'an absurd amount', marketVal: '$1,250,000' }),
  'value-many':         row({ itemNum: '9019', itemType: 'Boxcar', roadName: 'Erie', description: 'several prices in one cell is fine', marketVal: '$259.00\n\n$299.00 QSI\n$319.00 TMCC' }),
  'dup-exact-1':        row({ itemNum: '9015', itemType: 'Boxcar', roadName: 'Erie', description: 'the same row twice', yearProd: '1957' }),
  'dup-exact-2':        row({ itemNum: '9015', itemType: 'Boxcar', roadName: 'Erie', description: 'the same row twice', yearProd: '1957' }),
  'dup-key-1':          row({ itemNum: '9016', itemType: 'Boxcar', roadName: 'Erie', description: 'one product, one story', yearProd: '1957' }),
  'dup-key-2':          row({ itemNum: '9016', itemType: 'Boxcar', roadName: 'Lackawanna', description: 'one product, another story', yearProd: '1957' }),
};
// a legit Atlas-style pair: same number, 3-rail and 2-rail — NOT a duplicate
const RAIL_PAIR = [
  row({ itemNum: '9017', itemType: 'Boxcar', roadName: 'Erie', description: 'two rails or three', yearProd: '2010' }).concat(['Master', '3-Rail', '79.95']),
  row({ itemNum: '9017', itemType: 'Boxcar', roadName: 'Erie', description: 'two rails or three', yearProd: '2010' }).concat(['Master', '2-Rail', '79.95']),
];
function csvLine(cells) { return cells.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(','); }
const PREWAR = [
  row({ itemNum: '400E', itemType: 'Steam Locomotive', roadName: 'Lionel Lines', description: 'Standard gauge 4-4-4', gauge: 'Standard', yearProd: '1931-1939' }),
  row({ itemNum: '9020', itemType: 'Boxcar', roadName: 'Lionel Lines', description: 'a pre-war row with no gauge', gauge: '', yearProd: '1935' }),   // gauge-missing-prewar
];
function writeFixture(dir, rows, header) {
  fs.mkdirSync(dir, { recursive: true });
  const H = header || HEADER;
  const pad = r => r.concat(Array(Math.max(0, H.length - r.length)).fill(''));
  // row 2 is blank, like the real tabs — a blank row is skipped but keeps its row number (the export keeps blank rows)
  fs.writeFileSync(path.join(dir, 'Lionel PW - Items.csv'), [csvLine(H), csvLine(pad([]))].concat(rows.map(r => csvLine(pad(r)))).join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'Lionel Pre-War.csv'), [csvLine(H)].concat(PREWAR.map(r => csvLine(pad(r)))).join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'Master Version.csv'), csvLine(['Version', 'Date', 'Notes']) + '\n' + csvLine(['1.86', '2026-09-27', 'test']) + '\n' + csvLine(['1.85', '2026-09-27', 'older']) + '\n');
}

(async () => {
  // ── A ───────────────────────────────────────────────────────────────────
  section('A · the app\'s own pieces are the audit\'s pieces');
  const A = audit.loadApp();
  T('A1  the tab list is built from ERA_TABS × MASTER_TAB_KEYS of the real eras (config.js), not typed here',
    audit.auditTabs(A).length > 40 && audit.auditTabs(A).every(t => A.ERA_TABS[t.era] && A.ERA_TABS[t.era][t.key] === t.tab));
  T('A2  …and the parts catalogs (lookup-only eras) are not on it', audit.auditTabs(A).every(t => A.LOOKUP_ONLY_ERAS.indexOf(t.era) < 0));
  T('A3  …and it can be narrowed to named tabs', audit.auditTabs(A, ['MTH O', 'Atlas O']).map(t => t.tab).sort().join() === 'Atlas O,MTH O');
  T('A4  types are judged by the real getTypeBucket; gauges by the real _scalesOfGauge',
    A.getTypeBucket({ itemType: 'Boxcar' }) === 'Boxcar' && A._scalesOfGauge('O Gauge').join() === 'o' && A._scalesOfGauge('Toy').length === 0);
  T('A5  duplicates are judged by the app\'s own dedupe key, lifted from _deduplicateMaster',
    A.masterDedupeKey({ itemNum: '1', roadName: 'R', variation: 'A', poweredDummy: 'P', description: 'D', trackPower: '3-Rail', subType: 'S', _yearRaw: '1950' }) === '1|R|A|P|D|3-Rail|S|1950');
  T('A6  the Master Version is picked by the app\'s own _mvPickLatest', typeof A._mvPickLatest === 'function');

  // ── B ───────────────────────────────────────────────────────────────────
  section('B · the small readers');
  T('B1  a real date is a date; a Lionel number with dashes is not', audit.looksLikeDate('2005-01-02') && audit.looksLikeDate('1/2/2005') && audit.looksLikeDate('Jan-05') && !audit.looksLikeDate('1364-12-58') && !audit.looksLikeDate('CTC-14') && !audit.looksLikeDate('6464-425'));
  T('B2  years: single, range, short range, list, season, circa, a trailing note, a two-digit range — and prose is unreadable',
    JSON.stringify(audit.yearsOf('1957')) === '[1957]' && JSON.stringify(audit.yearsOf('1957-1966')) === '[1957,1966]' && JSON.stringify(audit.yearsOf('1941-42')) === '[1941,1942]'
    && JSON.stringify(audit.yearsOf('1955-1957, 1959')) === '[1955,1957,1959]' && JSON.stringify(audit.yearsOf('Fall 2022')) === '[2022]' && JSON.stringify(audit.yearsOf('c. 1950')) === '[1950]'
    && JSON.stringify(audit.yearsOf('2019–2020 (archive dates)')) === '[2019,2020]' && JSON.stringify(audit.yearsOf('94-95')) === '[1994,1995]'
    && audit.yearsOf('Postwar era') === null && audit.yearsOf('?') === null && JSON.stringify(audit.yearsOf('')) === '[]');
  // B7 (2026-10-01): the ways the sources really write a year. "1923?" is COTT's own doubt mark (the year is
  // still a year); "1985 and 1987" is two years, not a range; "1950s" is a decade the Marx guide prints as "50s".
  // A '?' with no year in front of it stays unreadable — a blank-the-question-mark reader would hide the Weaver "?" cells.
  const B7 = yo => JSON.stringify(yo('1923?')) === '[1923]' && JSON.stringify(yo('1926-1927?')) === '[1926,1927]'
    && JSON.stringify(yo('1985 and 1987')) === '[1985,1987]' && JSON.stringify(yo('1974-75 and 1978')) === '[1974,1975,1978]'
    && JSON.stringify(yo('1950s')) === '[1950,1959]' && JSON.stringify(yo('1950s-1960s')) === '[1950,1969]'
    && yo('?') === null && yo('19??') === null && yo('50s') === null && yo('RERUN 1998') === null && yo('Postwar era') === null;
  T('B7  years as the sources write them: a doubt mark, "and", a decade — and a bare "?" / "19??" still unreadable', B7(audit.yearsOf));
  T('B7b (offender) a reader that simply drops every "?" fails B7', !B7(s => audit.yearsOf(String(s).replace(/\?/g, ''))));
  T('B3  the CSV reader keeps quoted commas, doubled quotes and a newline inside quotes',
    JSON.stringify(audit.parseCsv('"a,b","say ""hi""","two\nlines"\r\n1,2,3\n')) === JSON.stringify([['a,b', 'say "hi"', 'two\nlines'], ['1', '2', '3']]));
  // the sheet's public page, as it really reads (names are JS string literals; the page URL carries \x3d)
  const PAGE = 'x;items.push({name: "Lionel PW - Items", pageUrl: "https:\\/\\/docs.google.com\\/spreadsheets\\/d\\/ID\\/htmlview\\/sheet?headers\\x3dtrue&gid=129413875", gid: "129413875",initialSheet: ("129413875" == gid)});'
             + 'items.push({name: "Brad\\x27s \\"Odd\\" Tab \\/ caf\\u00e9", pageUrl: "p", gid: "42",initialSheet: false});'
             + 'items.push({name: "Lionel PW - Items", pageUrl: "p", gid: "999",initialSheet: false});';
  const gm = audit.gidMapFromHtml(PAGE);
  T('B4  the tab → gid map is read off the sheet\'s public page, names decoded, first entry wins',
    gm['Lionel PW - Items'] === '129413875' && gm['Brad\'s "Odd" Tab / café'] === '42' && Object.keys(gm).length === 2, gm);
  T('B4b …and a page with no tab list gives an empty map (the run then stops, loudly)', Object.keys(audit.gidMapFromHtml('<html>nothing here</html>')).length === 0);
  T('B5  the export address carries the gid, cells as displayed — and it is not the gviz endpoint',
    audit.exportUrl('SHEET', '129413875') === 'https://docs.google.com/spreadsheets/d/SHEET/export?format=csv&gid=129413875' && !/gviz/.test(audit.exportUrl('SHEET', '1')) && /\/htmlview$/.test(audit.htmlviewUrl('SHEET')));
  T('B6  jsUnescape decodes \\xHH, \\uHHHH and \\-escapes', audit.jsUnescape('a\\x3db\\u00e9\\/\\"') === 'a=bé/"');

  // ── C ───────────────────────────────────────────────────────────────────
  section('C · the real audit on the planted tab');
  const fx1 = path.join(tmp, 'fx1'); writeFixture(fx1, GOOD.concat(Object.values(BAD), RAIL_PAIR));
  const out1 = path.join(tmp, 'out1');
  const S1 = await audit.run({ out: out1, fixture: fx1, tabs: ['Lionel PW - Items', 'Lionel Pre-War'], date: '2026-09-30' });
  T('C1  two tabs walked, every row counted', S1.tabs.length === 2 && S1.tabs[0].rowsChecked === GOOD.length + Object.keys(BAD).length + RAIL_PAIR.length && S1.tabs[1].rowsChecked === PREWAR.length, S1.tabs);
  T('C2  the Master Version came through the app\'s picker', S1.meta.masterVersion === '1.86', S1.meta);
  const byNum = {}; S1.flags.forEach(f => { (byNum[f.itemNum.trim() + '|' + f.rule] = byNum[f.itemNum.trim() + '|' + f.rule] || []).push(f); });
  const has = (num, rule) => !!byNum[num + '|' + rule];
  T('C19b gauge-missing-prewar fires on the Pre-War tab only', has('9020', 'gauge-missing-prewar') && !has('9001', 'gauge-missing-prewar') && !has('400E', 'gauge-missing-prewar'));
  const goodNums = GOOD.map(r => r[0]).concat(['400E']);
  const goodFlags = S1.flags.filter(f => goodNums.indexOf(f.itemNum) >= 0);
  T('C3  the good rows raise nothing — undecorated flatcar, track, the dashed number, the season year, the year list', goodFlags.length === 0, goodFlags.map(f => f.itemNum + ':' + f.rule + ':' + f.note));
  T('C4  num-missing', has('', 'num-missing'));
  T('C5  num-header', has('Item Number', 'num-header'));
  T('C6  num-date fires on a date AND on a decimal', has('2005-01-02', 'num-date') && has('3002231.0', 'num-date'));
  T('C7  num-space', has('6464-1', 'num-space'));
  T('C8  type-missing', has('9001', 'type-missing'));
  T('C9  type-unknown, and it says the word', has('9002', 'type-unknown') && /Premiums/.test(byNum['9002|type-unknown'][0].note));
  T('C10 a blank road is never a flag — it is counted in the coverage picture',
    !S1.flags.some(f => f.rule === 'road-missing') && S1.tabs[0].coverage && S1.tabs[0].coverage.roadOf > 0 && S1.tabs[0].coverage.road < S1.tabs[0].coverage.roadOf);
  T('C11 desc-missing', has('9004', 'desc-missing'));
  T('C12 desc-short', has('9005', 'desc-short'));
  T('C13 desc-bare-no', has('9006', 'desc-bare-no'));
  T('C14 text-entity names the field', has('9007', 'text-entity') && /^description: &amp;/.test(byNum['9007|text-entity'][0].note));
  T('C15 year-unreadable', has('9008', 'year-unreadable'));
  T('C16 year-out-of-range on 2199', has('9009', 'year-out-of-range'));
  T('C17 year-out-of-range on a backwards range', has('9010', 'year-out-of-range') && /backwards/.test(byNum['9010|year-out-of-range'][0].note));
  T('C18 year-off-era on 1938 in the postwar tab', has('9011', 'year-off-era'));
  T('C19 gauge-unknown on Marx\'s "Toy"', has('9012', 'gauge-unknown'));
  T('C20 link-bad', has('9013', 'link-bad'));
  T('C21 value-bad on a money cell with no amount, and on an absurd one — a cell listing several prices passes',
    has('9014', 'value-bad') && has('9018', 'value-bad') && !has('9019', 'value-bad'));
  T('C22 dup-exact on both copies of the same row', (byNum['9015|dup-exact'] || []).length === 2);
  T('C23 dup-key on one product told two ways', (byNum['9016|dup-key'] || []).length === 2);
  T('C24 …but a 3-rail / 2-rail pair is NOT a duplicate of any kind', !has('9017', 'dup-exact') && !has('9017', 'dup-key'));
  T('C25 every rule in the table fired at least once (the fixture covers the table)',
    audit.ALL_RULES.every(r => S1.flags.some(f => f.rule === r.id)), audit.ALL_RULES.filter(r => !S1.flags.some(f => f.rule === r.id)).map(r => r.id));
  T('C26 every flag carries the cell as it stands', S1.flags.every(f => typeof f.value === 'string'));
  T('C27 a number with a letter in it (116C) is a number — never num-missing (the shape the gviz CSV blanked)', !has('116C', 'num-missing') && !S1.flags.some(f => f.itemNum === '116C'));
  const nm = byNum['|num-missing'] && byNum['|num-missing'][0];
  T('C28 a flag\'s row is the SHEET row — the blank row 2 is counted, not skipped (the first planted row sits at row 3 + the good rows)',
    nm && nm.row === 3 + GOOD.length, nm && nm.row);

  // ── D ───────────────────────────────────────────────────────────────────
  section('D · the files it writes');
  const mdText = fs.readFileSync(path.join(out1, 'MASTER_AUDIT_2026-09-30.md'), 'utf8');
  const csvText = fs.readFileSync(path.join(out1, 'MASTER_AUDIT_2026-09-30_flags.csv'), 'utf8');
  const state1 = JSON.parse(fs.readFileSync(path.join(out1, 'STATE.json'), 'utf8'));
  T('D1  the report names the date, the Master Version, rows checked and flags',
    /Master-list audit — 2026-09-30 — Master Version 1\.86/.test(mdText) && /\*\*[\d,]+ rows checked, [\d,]+ flags\*\*/.test(mdText));
  T('D2  …says which tabs were NOT walked and why', /Not walked/.test(mdText) && /parts catalogs/.test(mdText));
  T('D3  …has the by-rule table with every firing rule', audit.ALL_RULES.every(r => mdText.indexOf('`' + r.id + '`') >= 0));
  T('D4  …lists the words the app cannot read, counted', /## Words the app cannot read/.test(mdText) && /Premiums \| 1/.test(mdText) && /Toy \| 1/.test(mdText));
  T('D4b …and the coverage table per tab (road / type / gauge / year / description / link)', /\| tab \| era \| rows \| flags \| road \| type \| gauge \| year \| description \| link \|/.test(mdText) && /\| Lionel PW - Items \| pw \| \d+ \| \d+ \| \d+% \| \d+% \| \d+% \| \d+% \| \d+% \| \d+% \|/.test(mdText));
  T('D5  …and says the sheet row is a hint only (rows move when the sheet is edited)', /sheet row is a hint only/.test(mdText) && !/csv row/.test(mdText));
  T('D6  the flags file has one line per flag plus the header, with the cell value', csvText.split('\n').filter(Boolean).length === S1.flags.length + 1 && /^tab,item number,variation,rule,kind,field,cell as it stands,note,sheet row,new$/.test(csvText.split('\n')[0]));
  T('D7  STATE.json holds every flag key and the counts', state1.keys.length === new Set(S1.flags.map(audit.flagKey)).size && state1.counts['dup-exact'] === 2 && state1.date === '2026-09-30');

  // ── E ───────────────────────────────────────────────────────────────────
  section('E · the second run: new and cleared');
  const fx2 = path.join(tmp, 'fx2');
  const bad2 = Object.assign({}, BAD); delete bad2['link-bad'];                                   // one flag fixed
  const rows2 = GOOD.concat(Object.values(bad2), RAIL_PAIR, [row({ itemNum: '9099', itemType: 'Boxcar', roadName: 'Erie', description: 'Baltimore &quot;Ohio&quot;' })]);   // one new
  writeFixture(fx2, rows2);
  const out2 = path.join(tmp, 'out2');
  const S2 = await audit.run({ out: out2, fixture: fx2, tabs: ['Lionel PW - Items', 'Lionel Pre-War'], prev: path.join(out1, 'STATE.json'), date: '2026-10-01' });
  T('E1  the fixed flag is CLEARED', S2.cleared.length === 1 && /9013\|.*\|link-bad/.test(S2.cleared[0]), S2.cleared);
  T('E2  the new flag is NEW — and only it', S2.fresh.length === 1 && S2.fresh[0].itemNum === '9099' && S2.fresh[0].rule === 'text-entity', S2.fresh);
  const md2 = fs.readFileSync(path.join(out2, 'MASTER_AUDIT_2026-10-01.md'), 'utf8');
  T('E3  the report says so, against the previous date', /\*\*1 new\*\* since 2026-09-30, \*\*1 cleared\*\*/.test(md2) && /## New since 2026-09-30/.test(md2) && /## Cleared since 2026-09-30/.test(md2));
  T('E4  a flag\'s identity is tab + number + variation + rule + field — never the row', audit.flagKey({ tab: 'T', itemNum: ' 1 ', variation: 'A', rule: 'r', field: 'f', row: 99 }) === 'T|1|A|r|f');

  // ── F ───────────────────────────────────────────────────────────────────
  section('F · an unreadable tab is reported, not skipped');
  const fx3 = path.join(tmp, 'fx3'); fs.mkdirSync(fx3, { recursive: true });
  fs.writeFileSync(path.join(fx3, 'Lionel PW - Items.csv'), csvLine(['Set Name', 'Year', 'Contents']) + '\n' + csvLine(['1464W', '1950', 'stuff']) + '\n');
  const S3 = await audit.run({ out: path.join(tmp, 'out3'), fixture: fx3, tabs: ['Lionel PW - Items'], date: '2026-09-30' });
  T('F1  a tab whose row 1 is not an item header is flagged tab-header and marked HEADER NOT READ',
    S3.flags.some(f => f.rule === 'tab-header') && !S3.tabs[0].headerOk && /HEADER NOT READ/.test(fs.readFileSync(path.join(tmp, 'out3', 'MASTER_AUDIT_2026-09-30.md'), 'utf8')));
  let f2err = null; try { await audit.readTab({ MASTER_SHEET_ID: 'X', _gids: { 'Other Tab': '1' } }, 'Lionel PW - Items', null); } catch (e) { f2err = e.message; }
  T('F2  a tab the sheet\'s page does not list is refused by name, before any fetch', /no tab named "Lionel PW - Items"/.test(f2err || '') && /lists 1 tabs/.test(f2err || ''), f2err);

  // ── G ───────────────────────────────────────────────────────────────────
  section('G · the workbook builder');
  const py = require('child_process').spawnSync('python3', ['tools/master-audit/to_xlsx.py', path.join(out1, 'MASTER_AUDIT_2026-09-30_flags.csv'), path.join(out1, 'flags.xlsx')], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  if (py.status !== 0 && /No module named/.test(py.stderr || '')) {
    T('G1  to_xlsx.py needs openpyxl on this machine (pip install openpyxl) — skipped', true);
  } else {
    T('G1  to_xlsx.py writes the workbook', py.status === 0 && fs.existsSync(path.join(out1, 'flags.xlsx')), py.stderr);
    const chk = require('child_process').spawnSync('python3', ['-c', "import openpyxl,sys;wb=openpyxl.load_workbook(sys.argv[1]);ws=wb['All'];print(wb.sheetnames, ws.max_row-1, ws['A1'].value, ws[ws.max_column and 1][ws.max_column-1].value, ws['A2'].fill.fgColor.rgb, ws['A3'].fill.fgColor.rgb, ws.freeze_panes)", path.join(out1, 'flags.xlsx')], { encoding: 'utf8' });
    T('G2  …three sheets (check / look / All), one row per flag, a "Your decision" column, gray/white bands, a frozen header',
      /\['check', 'look', 'All'\] \d+ tab Your decision 00EEEEEE 00000000 A2/.test(chk.stdout) && +chk.stdout.split(' ')[3] === S1.flags.length, chk.stdout + chk.stderr);
  }

  // ── H ───────────────────────────────────────────────────────────────────
  section('H · planted offenders');
  // H1: a rule silenced — the fixture stops covering the table (C25 red)
  T('H1  a rule the fixture stops exercising is caught by C25 (take link-bad\'s flags away and the coverage check goes red)',
    !audit.ALL_RULES.every(r => S1.flags.filter(f => f.rule !== 'link-bad').some(f => f.rule === r.id)));
  // H2: a dedupe key that ignores track power turns the rail pair into a duplicate
  const A2 = Object.assign({}, A, { masterDedupeKey: m => m.itemNum + '|' + m.description });
  const fake = { tab: 'Lionel PW - Items', era: 'pw', key: 'items' };
  const csvRail = [HEADER.concat(['Category', 'Track/Power', 'MSRP'])].concat(RAIL_PAIR);
  const rWrong = audit.checkTab(A2, fake, csvRail), rRight = audit.checkTab(A, fake, csvRail);
  T('H2  a dedupe key of our own (not the app\'s) would call the 3-rail / 2-rail pair a duplicate — C24 goes red on it',
    rWrong.flags.some(f => f.rule === 'dup-exact') && !rRight.flags.some(f => f.rule === 'dup-exact'));
  // H3: a bucketer that knows nothing turns every type into type-unknown (C3 red)
  const A3 = Object.assign({}, A, { getTypeBucket: () => 'nothing' });
  const r3 = audit.checkTab(A3, fake, [HEADER].concat(GOOD));
  T('H3  a bucketer that is not the app\'s flags the good rows — C3 goes red on it', r3.flags.some(f => f.rule === 'type-unknown' && f.itemNum === '6464-425'));
  // H4: a year reader that cannot read seasons flags the good "Fall 1958" row
  const r4good = audit.checkTab(A, fake, [HEADER].concat(GOOD));
  T('H4  the season year on a good row is read (no year-unreadable) — a reader without seasons would flag it', !r4good.flags.some(f => f.rule === 'year-unreadable'));
  // H5: the tab list — a hand-typed list would not follow config.js
  T('H5  the tab list is not a literal in the audit: it names no tab of its own', !/'Lionel PW - Items'|'MTH O'|'Atlas O'/.test(fs.readFileSync(path.join(__dirname, '..', 'tools', 'master-audit', 'audit.js'), 'utf8').replace(/\/\/[^\n]*/g, '')));
  // H6: the reader — the export endpoint, never gviz (which blanks text in a numeric column). The scan and its offender.
  // full-line comments only — a "//" inside a URL string is code, not a comment
  const auditCode = fs.readFileSync(path.join(__dirname, '..', 'tools', 'master-audit', 'audit.js'), 'utf8').replace(/^\s*\/\/[^\n]*$/gm, '');
  const readerOk = code => /export\?format=csv&gid=/.test(code) && !/gviz\/tq/.test(code);
  const offender = auditCode.replace("'/export?format=csv&gid=' + gid", "'/gviz/tq?tqx=out:csv&gid=' + gid");
  T('H6  the reader asks the export endpoint and never gviz — and a reader switched back to gviz fails this check', readerOk(auditCode) && !readerOk(offender) && offender !== auditCode);

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
