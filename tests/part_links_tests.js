// ═══════════════════════════════════════════════════════════════
// part_links_tests.js — v0.9.1770.
//
// Brad, 2026-09-19, on the "Need a part" popup for item 84631:
//   "we should always show the link for the mfr part link. if they select
//    trainz, then we should show the trainz parts lists, if another, the
//    search that with google"
//   "so what i mean we show all parts that in this case lionel has. if the
//    same part is available from a trainz link, you show that link to, if its
//    not then we have search link"
//   "so a part should have 2 links always, in this case, lionel link, no
//    trainz direct link, but a google search to search trainz for the part"
//   "we have to search the part number and the description"
//   "so it should be trainz.com lionel "6101155203" eye dropper / smoke fill"
//   "also add the item number too"
//   "forgot, we have to get rid of teh " ". so trainz.com lionel 6-84631
//    6101155203 eye dropper / smoke fill"
//
// THE RULES THIS SUITE PROTECTS:
//   1. TWO links on a part line, not one. The maker's own page is the first,
//      and it shows whatever store is picked — the deliberate reversal of the
//      v0.9.1759 gate. If someone ever puts that gate back, section C goes red.
//   2. The second link opens a store's own page ONLY when we already hold this
//      exact part number on that store's site AND the user picked that store
//      for themselves. Otherwise it is a search. (Sept 16: "we can't link
//      directly to trainz website … unless the user select them".)
//   3. The search carries the item number, the part number and what the part
//      is called — all of it unquoted, so Google can weigh the words instead
//      of demanding every one of them.
//      Not the engine's number and not the measurements — that was v0.9.1760,
//      and _partPhrase is where that lesson now lives.
//   4. NO store is named anywhere in the code. A store is matched by its web
//      address against the addresses already in our parts catalogs.
//
// THIS SUITE PROVES ITSELF (section F). The maker-link lookup is broken on
// purpose and the two-link tests must go red. A green run on a check that
// cannot fail is worth nothing — feedback_scan_must_prove_itself.
// Run:  node tests/part_links_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APPDIR = path.join(__dirname, '..', 'app');
const APP = f => fs.readFileSync(path.join(APPDIR, f), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  return null;
}
const maint = APP('maintenance.js');
const data  = APP('app-data.js');
const cfg   = APP('config.js');

// ── the REAL era rows, read out of config.js ───────────────────────────────
// Not retyped here. If Brad's catalogs change what partsOfficial or partsLink
// say, these tests change with them instead of quietly testing a copy.
function realEra(id) {
  const m = cfg.match(new RegExp('^\\s*' + id + ':\\s*(\\{.*?\\}),?\\s*$', 'm'));
  return m ? eval('(' + m[1] + ')') : null;
}
const ERAS = {};
['lionel_parts', 'lionelstore_parts', 'traintender_parts', 'mth_parts'].forEach(id => {
  const e = realEra(id); if (e) ERAS[id] = e;
});

section('A · the real era config, not a retyped copy');
ok('all four parts eras were found in config.js', Object.keys(ERAS).length === 4, Object.keys(ERAS).join(','));
ok('the Lionel STORE catalog is the maker\'s own (partsOfficial)', ERAS.lionelstore_parts && ERAS.lionelstore_parts.partsOfficial === true);
ok('the Lionel PARTS catalog (Trainz-sourced) is NOT the maker\'s own',
   ERAS.lionel_parts && !ERAS.lionel_parts.partsOfficial);
ok('both are Lionel, so one may answer for the other',
   ERAS.lionel_parts && ERAS.lionelstore_parts
   && ERAS.lionel_parts.manufacturer === 'Lionel' && ERAS.lionelstore_parts.manufacturer === 'Lionel');
ok('MTH parts are MTH, and never Lionel', ERAS.mth_parts && ERAS.mth_parts.manufacturer === 'MTH');

// ── the real rows, out of the harvests the sweeps wrote ────────────────────
// Real part numbers, real addresses, real descriptions. A hand-typed row would
// have let the 1.6% overlap go unnoticed.
function harvest(files) {
  const out = [];
  for (const f of files) {
    const p = path.join(__dirname, '..', 'harvests', f);
    if (!fs.existsSync(p)) continue;
    let d = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (d && !Array.isArray(d)) { for (const k of ['rows', 'items', 'parts', 'data']) if (d[k]) { d = d[k]; break; } }
    if (Array.isArray(d)) out.push(...d);
  }
  return out;
}
const rawStore  = harvest(['lionelstore-parts-1.json', 'lionelstore-parts-2.json', 'lionelstore-parts-3.json']);
const rawTrainz = harvest(['lionel-parts-1.json', 'lionel-parts-2.json']);
const row = (raw, era) => ({ itemNum: String(raw[0]), itemType: 'Part', description: String(raw[7] || ''), refLink: String(raw[12] || ''), _era: era });
const storeRows  = rawStore.map(r => row(r, 'lionelstore_parts'));
const trainzRows = rawTrainz.map(r => row(r, 'lionel_parts'));

section('B · the real catalogs, and the overlap that shapes the whole design');
ok('the Lionel store catalog loaded', storeRows.length > 50000, String(storeRows.length));
ok('the Trainz catalog loaded', trainzRows.length > 15000, String(trainzRows.length));
const trainzNums = new Set(trainzRows.map(r => r.itemNum.trim().toUpperCase()));
const shared = storeRows.filter(r => trainzNums.has(r.itemNum.trim().toUpperCase()));
ok('a store part is USUALLY not at Trainz — so a search is the normal outcome',
   shared.length / storeRows.length < 0.05, (100 * shared.length / storeRows.length).toFixed(1) + '%');
ok('…but some store parts ARE at Trainz, or rule 2 could never be tested',
   shared.length > 100, String(shared.length));
const brad = storeRows.find(r => r.itemNum === '6101155203');
ok('Brad\'s own example part is in the catalog', !!brad && /EYE DROPPER/i.test(brad.description),
   brad && brad.description);
ok('…and Trainz does not carry it, exactly as he said', !!brad && !trainzNums.has('6101155203'));

// ── the real functions, lifted and run ─────────────────────────────────────
// EVERY closure name they touch is handed in. Miss one and it throws here
// rather than passing on a stub that flatters the code.
const names = ['_linkHost', '_partLinksIndex', '_partLinkOn', '_partOfficialLink'];
const dataSrc = names.map(n => grab(data, n));
section('C · the two links, built by the real code');
ok('all four lookups ship in app-data.js', dataSrc.every(Boolean),
   names.filter((n, i) => !dataSrc[i]).join(','));
ok('…and are exported', names.every(n => new RegExp('window\\.' + n + '\\s*=\\s*' + n).test(data)));
// _makerName and _docsRoute come along for real too — the maker word in the
// search is theirs, and a stub would have quietly dropped "Lionel" out of it.
const mNames = ['_partsUrl', '_dealerSite', '_plainWords', '_partPhrase', '_catalogPartLinkHtml', '_partLinkA',
                '_makerName', '_docsRoute'];
const mSrc = mNames.map(n => grab(maint, n));
ok('all eight builders ship in maintenance.js', mSrc.every(Boolean),
   mNames.filter((n, i) => !mSrc[i]).join(','));
if (!dataSrc.every(Boolean) || !mSrc.every(Boolean)) { console.log('\ncannot continue'); process.exit(1); }

// `breakIt` is section F's crowbar: it swaps the real maker-link lookup for one
// that never finds anything, which must cost us the first of the two links.
// The item Brad was looking at. Its number is spelled by the REAL rrSearchNumber
// (app.js), the one place that knows a modern Lionel 84631 sells as 6-84631 —
// not retyped here, or this suite would stop noticing if that rule moved.
const sNum = grab(APP('app.js'), 'rrSearchNumber');
const ENGINE = { itemNum: '84631', _tab: 'Lionel Modern - Items', _era: 'mod',
                 roadName: 'RJ Corman', description: 'SD40T-2 Diesel' };

function build(rows, pick, breakIt) {
  const src = 'var _plIdx = null, _plIdxRows = null, _plIdxLen = -1;\n'   // the index's own cache vars
    + sNum + '\n'
    + dataSrc.join('\n') + '\n' + mSrc.join('\n') + `
    ${breakIt ? 'function _partOfficialLink(){ return { href: "", era: "" }; }' : ''}
    return { link: _catalogPartLinkHtml, url: _partsUrl, phrase: _partPhrase,
             host: _linkHost, on: _partLinkOn, official: _partOfficialLink };`;
  return new Function('ERAS', 'MAINT', 'state', '_esc', '_manufacturerOfItem', '_partsMakerOf', '_dealerPick',
                      'document', '_itemEraPeriod', src)(
    ERAS,
    { MAKER_STORE: '__maker' },
    { masterAllRows: rows, masterData: rows },
    s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    null,                                  // no _manufacturerOfItem: _makerName falls to _docsRoute, for real
    era => (ERAS[era] && ERAS[era].manufacturer) || '',
    () => pick,
    null,                                  // no DOM: _dealerPick is handed in instead
    it => (String(it && it._era || '') === 'mod' ? 'modern' : '')
  );
}
const ALL = storeRows.concat(trainzRows);
const hrefs = html => (html.match(/href="([^"]*)"/g) || []).map(h => h.slice(6, -1));
const words = html => (html.match(/>([^<]+)<\/a>/g) || []).map(w => w.slice(1, -4));

// Brad's own part, with Trainz picked — his stated expected outcome.
{
  const api = build(ALL, 'trainz.com');
  const html = api.link(brad, null);
  const h = hrefs(html), w = words(html);
  ok('TWO links, not one', h.length === 2, String(h.length) + ': ' + w.join(' / '));
  ok('the first is Lionel\'s own page for the part',
     h[0] === 'https://www.lionelsupport.com/EYE-DROPPER-SMOKE-FILL', h[0]);
  ok('…labelled with the era\'s own word', w[0] === (ERAS.lionelstore_parts.partsLink || 'store'), w[0]);
  ok('the second is a SEARCH, because Trainz has no such part', /google\.com\/search/.test(h[1] || ''), h[1]);
  ok('…and says so on the link', w[1] === 'search trainz.com', w[1]);
  const q = decodeURIComponent((h[1] || '').split('q=')[1] || '').replace(/\+/g, ' ');
  ok('the search names the store', /(^|\s)trainz\.com(\s|$)/.test(q), q);
  ok('…and the maker', /lionel/i.test(q), q);
  ok('…and the part number, unquoted (Brad: "we have to get rid of teh \" \"")',
     /(^|\s)6101155203(\s|$)/.test(q) && q.indexOf('"') < 0, q);
  ok('…and what the part is called (Brad: "and the description")', /eye dropper/i.test(q), q);
  ok('…and, when an item is in hand, the item number too (Brad, 2026-09-19)',
     /(^|\s)6-84631(\s|$)/.test(decodeURIComponent((hrefs(api.link(brad, ENGINE))[1] || '').split('q=')[1] || '').replace(/\+/g, ' ')),
     decodeURIComponent((hrefs(api.link(brad, ENGINE))[1] || '').split('q=')[1] || '').replace(/\+/g, ' '));
  ok('…spelled 6-84631 the way the catalog sells it, not the bare 84631',
     !/(^|\s)84631(\s|$)/.test(decodeURIComponent((hrefs(api.link(brad, ENGINE))[1] || '').split('q=')[1] || '').replace(/\+/g, ' ')));
  ok('…and the whole thing is Brad\'s own sentence, in his order',
     decodeURIComponent((hrefs(api.link(brad, ENGINE))[1] || '').split('q=')[1] || '').replace(/\+/g, ' ')
       === 'trainz.com Lionel 6-84631 6101155203 EYE DROPPER SMOKE FILL',
     decodeURIComponent((hrefs(api.link(brad, ENGINE))[1] || '').split('q=')[1] || '').replace(/\+/g, ' '));
  ok('no item in hand (the Workbench drawer) leaves the item number out, not blank',
     q.indexOf('84631') < 0 && q.indexOf('""') < 0, q);
}

// A store part that IS at Trainz: the second link becomes Trainz's own page.
{
  const s = shared[0];
  const tw = trainzRows.find(r => r.itemNum.trim().toUpperCase() === s.itemNum.trim().toUpperCase());
  const api = build(ALL, 'trainz.com');
  const h = hrefs(api.link(s, null));
  ok('a part Trainz DOES carry gets Trainz\'s own address as its second link',
     h.length === 2 && h[1] === tw.refLink, (h[1] || '') + ' vs ' + tw.refLink);
  ok('…and still keeps the maker\'s link first', h[0] === s.refLink, h[0]);
}

// Rule 2's guard: the SAME part, with nobody / someone else picked.
{
  const s = shared[0];
  const tw = trainzRows.find(r => r.itemNum.trim().toUpperCase() === s.itemNum.trim().toUpperCase());
  ['', '__maker', 'charlesro.com'].forEach(pick => {
    const h = hrefs(build(ALL, pick).link(s, null));
    ok('Trainz is NOT auto-linked when the picked store is "' + (pick || 'any') + '"',
       h.length === 2 && h[1] !== tw.refLink && /google\.com\/search/.test(h[1]), h[1]);
  });
}

// A Trainz row, seen from the other side.
{
  const t = trainzRows.find(r => r.refLink && r.itemNum);
  const hAny = hrefs(build(ALL, '').link(t, null));
  ok('a Trainz row is never auto-linked to Trainz with no store picked',
     hAny.every(u => !/trainz\.com/.test(u)), hAny.join(' '));
  const hT = hrefs(build(ALL, 'trainz.com').link(t, null));
  ok('…but opens directly once the user picks Trainz themselves',
     hT.indexOf(t.refLink) >= 0, hT.join(' '));
}

section('D · the maker guard — one maker\'s numbering never answers for another');
{
  const collide = { itemNum: storeRows[0].itemNum, itemType: 'Part', description: 'X',
                    refLink: 'https://www.mthtrains.com/fake', _era: 'mth_parts' };
  const api = build(ALL.concat([collide]), 'mthtrains.com');
  const h = hrefs(api.link(storeRows[0], null));
  // The picked store is named in the SEARCH — that is the point of picking it.
  // What must not happen is the MTH page being opened as this Lionel part's own.
  ok('an MTH part sharing a Lionel number is not opened as this part\'s page',
     h.length === 2 && h.indexOf(collide.refLink) < 0 && /google\.com\/search/.test(h[1]), h.join(' '));
}

section('E · what the part is CALLED, without the measurements');
{
  const api = build(ALL, '');
  ok('"TRACTION TIRE .625 ID x .058 TH x .148 WD" -> "TRACTION TIRE"',
     api.phrase('TRACTION TIRE .625 ID x .058 TH x .148 WD') === 'TRACTION TIRE',
     api.phrase('TRACTION TIRE .625 ID x .058 TH x .148 WD'));
  ok('"EYE DROPPER / SMOKE FILL" survives whole', api.phrase('EYE DROPPER / SMOKE FILL') === 'EYE DROPPER SMOKE FILL',
     api.phrase('EYE DROPPER / SMOKE FILL'));
  ok('"GEAR / WORM SHAFT W/ BEARINGS W/ COUPLING" stops at the W/',
     api.phrase('GEAR / WORM SHAFT W/ BEARINGS W/ COUPLING') === 'GEAR WORM SHAFT',
     api.phrase('GEAR / WORM SHAFT W/ BEARINGS W/ COUPLING'));
  ok('nothing describable gives nothing, not a stray quote', api.phrase('') === '' && api.phrase('.625 ID') === '');
  const long = storeRows.filter(r => api.phrase(r.description).split(' ').length > 4);
  ok('no phrase anywhere in the real catalog runs past four words', long.length === 0, String(long.length));
  ok('a web address is a web address, however it is written',
     api.host('https://www.trainz.com/products/x') === 'trainz.com'
     && api.host('trainz.com') === 'trainz.com'
     && api.host('WWW.Trainz.com/') === 'trainz.com', api.host('https://www.trainz.com/products/x'));
  ok('…and a shop NAME is not one', api.host("Joe's Train Shop") === '' && api.host('') === '');
}

section('F · no store is named in the code');
{
  // The code may not contain a dealer's address. The comments explain the design
  // with real examples, so only the code is scanned — and the scan is shown to
  // work on a planted one first.
  const codeOnly = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  // A string literal never spans a line break, so the pattern must not either —
  // otherwise it runs from a quote on one line, straight through a trailing
  // comment, and calls the comment's words a hardcoded dealer.
  const DEALER = /['"`][^'"`\n]*\b(trainz|charlesro|mthtrains|lionelsupport)\b[^'"`\n]*['"`]/i;
  ok('the scan detects a planted dealer', DEALER.test(`var d = "trainz.com";`));
  // Scoped to the code THIS rule owns — the part-link builders and the lookups
  // behind them — not to whole files. maintenance.js does carry one Lionel
  // address on purpose (the box-number search, a different feature that predates
  // this); flagging that would make the check noise, and a noisy check is one
  // nobody reads.
  [['the part-link builders', mSrc.join('\n')], ['the part-link lookups', dataSrc.join('\n')]].forEach(([what, s]) => {
    ok('no dealer address is written into ' + what, !DEALER.test(codeOnly(s)),
       (codeOnly(s).match(DEALER) || [''])[0]);
  });
  ok('…and the one address maintenance.js does carry is the OLD box-number search, not a part link',
     /lionelsupport\.com\/search\?keywords=/.test(maint)
     && !DEALER.test(codeOnly(grab(maint, '_catalogPartLinkHtml') || '')));
}

section('G · the suite proves itself — break the maker lookup, lose a link');
{
  // The check is run QUIETLY here — a printed FAIL line, even an expected one,
  // is how a real failure gets waved past on the next read of this output.
  const h = hrefs(build(ALL, 'trainz.com', true).link(brad, null));
  ok('the two-link check goes red when the maker lookup is broken', h.length !== 2,
     'the broken build still produced ' + h.length + ' links — the check cannot fail, so it proves nothing');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
