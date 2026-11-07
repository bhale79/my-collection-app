#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// set_words_tests.js — 2026-11-07 (maintenance chat; real Chromium, the REAL
// app, the REAL 472-set Postwar list)
//
// Add → Set matched the whole typed text as ONE piece: "santa fe freight"
// found none of the 472 sets (measured on the live list). [stated] Brad
// 2026-11-07 "yes" to PLAN_2026-11-07_SET_WORDS.md → "yes" to building it.
//
//   W  word by word: "santa fe freight" → the Santa Fe freight sets, their own
//      names first; "fe santa freight" the same; part of a word is enough.
//   F  words every set shares are ignored: "freight set" finds the sets the
//      book calls an Outfit or a Train; "lionel postwar santa fe" still finds them.
//   G  "o27" and "027" are one gauge: "o27 freight 1955" → the 1955 O27 freights.
//   P  the pieces' catalog words count: "hudson" → the sets whose engine row is
//      a 4-6-4 Hudson (listed after any set whose own words match); a piece's
//      number still finds its sets ("2343").
//   C  choosing a result still opens that set (its pieces, the exact row).
//   N  nothing found says so ("try fewer"); more than 15 says how many.
//   S  the source: ONE rule (rrSetMatches); a piece is looked up WITH the
//      Postwar era, never by its number alone; the words live in config.js.
//   X  PLANTED: the old whole-phrase match → W red; filler words not ignored →
//      F red; the piece lookup by number alone → S red; names-first order
//      removed → P1b red.
//
// Run:  node tests/set_words_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  set_words_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'setwords_pw_sets_2026-11-07.json'), 'utf8'));
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }
function plant(src, a, b) { if (src.indexOf(a) < 0) throw new Error('plant target not found: ' + a.slice(0, 90)); return src.replace(a, b); }

// ── what the fixture itself says (worked out here, independently of the app) ──
const ROWS = FX.sets;
const name = r => String(r[1] || '').toLowerCase();
const santaFeFreightByName = ROWS.filter(r => /santa/.test(name(r)) && /\bfe\b/.test(name(r)) && /freight/.test(name(r))).map(r => r[0]);
const outfitOrTrainOnly = ROWS.filter(r => /freight/.test(name(r)) && !/\bset\b/.test(name(r)) && /(outfit|train)/.test(name(r))).map(r => r[0]);
const o27Freight1955 = ROWS.filter(r => String(r[2]) === '1955' && String(r[3]).toUpperCase() === 'O27' && /freight/.test(name(r))).map(r => r[0]);
const HUDSONS = FX.items.filter(i => /hudson/i.test(i.subType)).map(i => i.itemNum);
const hudsonByName = ROWS.filter(r => /hudson/.test(name(r))).map(r => r[0]);
const hudsonByPiece = ROWS.filter(r => r.slice(5, 20).some(c => HUDSONS.indexOf(String(c).trim()) >= 0)).map(r => r[0]);
// the sets write a diesel's units as 2343P / 2343C / 2343T — all of them are the 2343
const with2343 = ROWS.filter(r => r.slice(5, 20).some(c => String(c).trim().toUpperCase().startsWith('2343'))).map(r => r[0]);

// ── S · the source ──────────────────────────────────────────────────────────
console.log('\n== S · one rule ==');
const WS = read('wizard-suggestions.js');
const body = (src) => { const i = src.indexOf('function updateSetSuggestions('); return src.slice(i, src.indexOf('\nfunction ', i + 10)); };
T('S1 the Set list asks THE rule (rrSetMatches) and no longer compares the whole typed text', /rrSetMatches\(s, _words\)/.test(body(WS)) && !/setName \|\| ''\)\.toUpperCase\(\)\.includes\(q\)/.test(body(WS)));
const pieceLookup = (src) => /findMaster\(String\(n\), '', \{ era: 'pw' \}\)/.test(src) && !/findMaster\(String\(n\)\)/.test(src);
T('S2 a piece is looked up WITH the Postwar era — never by its number alone', pieceLookup(WS));
T('S3 PLANTED: the piece looked up by number alone → caught by S2', !pieceLookup(WS.replace("findMaster(String(n), '', { era: 'pw' })", 'findMaster(String(n))')));
T('S4 the words live once, in config.js (RR_SET_SEARCH)', /window\.RR_SET_SEARCH = \{/.test(read('config.js')) && !/try fewer/.test(WS));

async function open(browser, swap) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await ctx.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://') && !u.startsWith('about:')) return r.abort();
    const nm = u.split('?')[0].split('/').pop();
    if (swap && swap[nm] != null) return r.fulfill({ body: swap[nm], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  await pg.evaluate(async (FX) => {
    state.masterData = FX.items.map(r => Object.assign({}, r)); _rebuildMasterIndex();
    parseSetRows(FX.sets);   // the app's own reader of the Sets tab
    state.personalData = {}; state.personalSheetId = 'SHEET'; _currentEra = 'all';
    state.user = { name: 'Brad', email: 'brad@example.com' };
    try { localStorage.clear(); } catch (e) {}
    window.showToast = () => {}; window.rrMaybeShowAddHelp = () => {};
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    await openWizard('collection'); await new Promise(r => setTimeout(r, 150));
    _wizSetKind('set'); await new Promise(r => setTimeout(r, 200));
    wizard.data.set_knowsNum = 'Yes'; await wizardNext(); await new Promise(r => setTimeout(r, 150));
  }, FX);
  return { ctx, pg, errs };
}
// type into the Set box the way a person does (its own oninput), read the list
const typeIn = (pg, text) => pg.evaluate(async (text) => {
  const inp = document.getElementById('wiz-input');
  if (!inp) return { err: 'no box', step: wizard.steps[wizard.step] && wizard.steps[wizard.step].id };
  inp.value = text; inp.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 60));
  const el = document.getElementById('wiz-suggestions');
  const shown = el && el.style.display !== 'none';
  const rows = el ? Array.from(el.querySelectorAll('button')).map(b => b.querySelector('span') ? b.querySelector('span').textContent.trim() : '') : [];
  const lit = el ? Array.from(el.querySelectorAll('button')).map(b => Array.from(b.querySelectorAll('span')).filter(s => /accent\)/.test(s.getAttribute('style') || '') && /border:1px solid var\(--accent\)/.test(s.getAttribute('style') || '')).map(s => s.textContent.trim())) : [];
  return { step: wizard.steps[wizard.step] && wizard.steps[wizard.step].id, shown, rows, text: el ? el.textContent.replace(/\s+/g, ' ').trim() : '', lit };
}, text);

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    const w = await open(browser);
    const R = {};
    for (const q of ['santa fe freight', 'fe santa freight', 'sant fe freig', 'freight set', 'lionel postwar santa fe', 'o27 freight 1955', 'O27 FREIGHT 1955', '027 freight 1955', 'hudson', 'hudson passenger', '2343', 'zz qq nothing', 'freight']) R[q] = await typeIn(w.pg, q);
    // C · choose the first Santa Fe result
    await typeIn(w.pg, 'santa fe freight');
    R.chosen = await w.pg.evaluate(async () => {
      const b = document.querySelector('#wiz-suggestions button'); if (b) b.click();
      await new Promise(r => setTimeout(r, 200));
      const s = wizard.data._resolvedSet;
      return s ? { num: s.setNum, name: s.setName, items: s.items.length, set_num: wizard.data.set_num } : null;
    });

    console.log('\n== W · word by word ==');
    T('W0 the step is the Set number step and the real list is loaded (472 sets)', R['santa fe freight'].step === 'set_num' && FX.sets.length === 472, R['santa fe freight'].step);
    const sf = R['santa fe freight'].rows;
    T('W1 "santa fe freight" → the Santa Fe freight sets, the ones NAMED that way first (' + santaFeFreightByName.join(', ') + ')', santaFeFreightByName.length >= 4 && sf.slice(0, santaFeFreightByName.length).join(',') === santaFeFreightByName.join(','), sf);
    T('W2 any order: "fe santa freight" gives the same list', R['fe santa freight'].rows.join(',') === sf.join(','), R['fe santa freight'].rows);
    T('W3 part of a word is enough: "sant fe freig"', R['sant fe freig'].rows.slice(0, santaFeFreightByName.length).join(',') === santaFeFreightByName.join(','), R['sant fe freig'].rows);

    console.log('\n== F · filler words ==');
    const fs1 = R['freight set'].rows;
    T('F1 "freight set" finds sets the book calls an Outfit or a Train (' + outfitOrTrainOnly.slice(0, 3).join(', ') + '…) — not only names holding "set"', outfitOrTrainOnly.length > 0 && fs1.indexOf(outfitOrTrainOnly[0]) >= 0, { first: outfitOrTrainOnly.slice(0, 5), got: fs1 });
    T('F2 "lionel postwar santa fe" still finds the Santa Fe sets', santaFeFreightByName.every(n => R['lionel postwar santa fe'].rows.indexOf(n) >= 0), R['lionel postwar santa fe'].rows);

    console.log('\n== G · one gauge, two spellings ==');
    T('G1 "o27 freight 1955" → the 1955 O27 freights (' + o27Freight1955.length + ' in the list)', o27Freight1955.length >= 5 && o27Freight1955.every(n => R['o27 freight 1955'].rows.indexOf(n) >= 0), { want: o27Freight1955, got: R['o27 freight 1955'].rows });
    T('G2 capitals do not matter, and "027" finds the same sets', R['O27 FREIGHT 1955'].rows.join(',') === R['o27 freight 1955'].rows.join(',') && R['027 freight 1955'].rows.join(',') === R['o27 freight 1955'].rows.join(','), [R['027 freight 1955'].rows.length, R['o27 freight 1955'].rows.length]);

    console.log('\n== P · the pieces\' words ==');
    const hud = R['hudson'].rows;
    const hudN = hud.filter(n => hudsonByName.indexOf(n) >= 0).length;
    T('P1 "hudson" → every result is a set NAMED Hudson or one holding a 4-6-4 Hudson engine — and some come only through the engine', hud.length > 0 && hud.every(n => hudsonByName.indexOf(n) >= 0 || hudsonByPiece.indexOf(n) >= 0) && hud.some(n => hudsonByName.indexOf(n) < 0), { got: hud });
    T('P1b the sets NAMED Hudson are listed first, then the ones found through the engine', hudN > 0 && hud.slice(0, hudN).every(n => hudsonByName.indexOf(n) >= 0) && hud.slice(hudN).every(n => hudsonByName.indexOf(n) < 0), { got: hud, byName: hudsonByName });
    T('P2 "hudson passenger" → the Hudson passenger sets', R['hudson passenger'].rows.length > 0 && R['hudson passenger'].rows.every(n => hudsonByName.indexOf(n) >= 0 || hudsonByPiece.indexOf(n) >= 0), R['hudson passenger'].rows);
    T('P3 a piece\'s number still finds its sets, and lights that piece ("2343")', R['2343'].rows.length > 0 && R['2343'].rows.every(n => with2343.indexOf(n) >= 0) && R['2343'].lit.every(l => l.length > 0 && l.every(x => x.startsWith('2343'))), { got: R['2343'].rows, lit: R['2343'].lit.slice(0, 3) });
    const tier = sf.slice(santaFeFreightByName.length);
    T('P4 after the named ones come sets that are Santa Fe only through a piece (the 2343\'s "Santa Fe")', tier.every(n => with2343.indexOf(n) >= 0), tier);

    console.log('\n== C · choosing one ==');
    T('C1 choosing the first result opens THAT set with its pieces', !!R.chosen && R.chosen.num === santaFeFreightByName[0] && R.chosen.set_num === santaFeFreightByName[0] && R.chosen.items > 0, R.chosen);

    console.log('\n== N · nothing, and too many ==');
    T('N1 nothing found says so — "try fewer" — instead of an empty box', R['zz qq nothing'].shown && /try fewer/.test(R['zz qq nothing'].text) && R['zz qq nothing'].rows.length === 0, R['zz qq nothing']);
    T('N2 more than 15 → 15 shown and how many there are ("15 of N sets")', R['freight'].rows.length === 15 && /15 of \d+ sets/.test(R['freight'].text), R['freight'].text.slice(-80));
    T('N3 no page errors', w.errs.length === 0, w.errs);
    await w.ctx.close();

    console.log('\n== X · planted: each check can fail ==');
    const oldRule = plant(WS, "(state.setData || []).forEach((s, k) => { const t = rrSetMatches(s, _words); if (t) _hits.push({ s: s, t: t, k: k }); });",
      "const _qq = String(query || '').trim().toUpperCase(); (state.setData || []).forEach((s, k) => { if (s.setNum.toUpperCase().includes(_qq) || (s.setName || '').toUpperCase().includes(_qq) || s.items.some(it => it.toUpperCase().startsWith(_qq))) _hits.push({ s: s, t: 1, k: k }); });");
    { const p = await open(browser, { 'wizard-suggestions.js': oldRule }); const r = await typeIn(p.pg, 'santa fe freight');
      T('X1 the old whole-phrase match → W1 red ("santa fe freight" finds nothing)', r.rows.length === 0, r.rows); await p.ctx.close(); }
    const CFG = read('config.js');
    const noIgnore = plant(CFG, "  ignore: ['set', 'sets', 'outfit', 'outfits', 'train', 'trains', 'lionel', 'postwar', 'post-war', 'the', 'with', 'and', '&'],", '  ignore: [],');
    { const p = await open(browser, { 'config.js': noIgnore }); const r = await typeIn(p.pg, 'freight set');
      T('X2 filler words not ignored → F1 red (the Outfit / Train sets are lost)', r.rows.indexOf(outfitOrTrainOnly[0]) < 0, r.rows); await p.ctx.close(); }
    const noTier = plant(WS, "_hits.sort((a, b) => (a.t - b.t) || (a.k - b.k));", "_hits.sort((a, b) => a.k - b.k);");
    { const p = await open(browser, { 'wizard-suggestions.js': noTier }); const r = (await typeIn(p.pg, 'hudson')).rows;
      const n = r.filter(x => hudsonByName.indexOf(x) >= 0).length;
      const ok = n > 0 && r.slice(0, n).every(x => hudsonByName.indexOf(x) >= 0);
      T('X3 names-first order removed → P1b red (a set found only through its engine jumps ahead)', !ok, r); await p.ctx.close(); }
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'PASSED') + '  —  set_words_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  set_words_tests crashed: ' + (e && e.stack || e)); process.exit(1); });
