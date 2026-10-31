#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// HAND OVER A COLLECTION TO ITS CLIENT — TRR Pro release 7B (part 1)
// (real Chromium, the REAL app, the stand-in Google world tests/lib/coll-world.js
//  — now with sharing: a permission list per file, pendingOwner, Accept)
//
// Plan PLAN_2026-10-31_TRR_PRO_R7B.md; [stated] Brad 2026-10-31 08:28 CT "yes"
// to one Google ownership request per file.
//   G  source guards, each PROVED on a planted offender
//   H  refusals (not open, no client, no email, archived, unfinished move);
//      the requests: one per file — the sheet FIRST with Google's one email,
//      every folder and photo after it, silently; pressing again never asks
//      twice; a Movement Log line; nothing trashed or deleted
//   W  waiting: N of M accepted; archive waits for it; Keep → linked (listed,
//      writes work, never trashed); Unlink / Remove → this account's access
//      off every file, the record kept, old labels say "handed over"
//   C  cancel takes the requests back; the sheet refused → nothing sent;
//      one photo refused → the rest sent, Send again finishes; a stop part
//      way → Send again carries on, nothing asked twice
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  collections_handover_r7b_tests needs playwright and it is not installed.'); process.exit(1); }
const { boot, openColl, APP } = require('./lib/coll-world');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 1500))); cond ? pass++ : fail++; }
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
}

// ── G · source guards ──────────────────────────────────────────────────────
function removesFiles(src) {
  const s = stripComments(src);
  if (/trashed:\s*true/.test(s)) return true;
  const dels = s.match(/driveRequest\(\s*'DELETE',[^;]*/g) || [];
  return dels.some(d => !/'\/permissions\/'/.test(d));
}
function emailOnce(src) {
  const s = stripComments(src);
  return /_ask\(id, who\.email, i === 0 \|\| !H\(\)\.emailFirstOnly\)/.test(s) && /emailFirstOnly: true/.test(read('config.js'));
}
function guards() {
  console.log('\n== G · source guards ==');
  const ho = read('collections-handover.js');
  T('G1 a hand-over never trashes or deletes a FILE — only sharing permissions come off', !removesFiles(ho));
  T('G1b PLANTED: a file DELETE → caught', removesFiles(ho + "\ndriveRequest('DELETE', '/files/' + id);"));
  T('G1c PLANTED: a trash → caught', removesFiles(ho + "\ndriveRequest('PATCH', '/files/' + id, { trashed: true });"));
  T('G2 Google\'s email goes with the FIRST request (the sheet) only — not one per photo', emailOnce(ho));
  T('G2b PLANTED: an email with every request → caught', !emailOnce(ho.replace('i === 0 || !H().emailFirstOnly', 'true')));
  const ix = read('index.html'), sw = read('sw.js');
  const core = JSON.parse(fs.readFileSync(path.join(__dirname, 'lib', 'core-files.json'), 'utf8')).core;
  T('G3 collections-handover.js is loaded (after the archive file), offline, CORE', ix.includes('src="./collections-handover.js?v=') && ix.indexOf('collections-handover.js') > ix.indexOf('collections-archive.js') && sw.includes("'./collections-handover.js'") && core.includes('app/collections-handover.js'));
  const cfg = read('config.js');
  const block = (cfg.match(/var RR_COLL_HANDOVER = \{[\s\S]*?\n\};/) || [''])[0];
  T('G4 every word in RR_COLL_HANDOVER (config.js); none says "AI"; no typed toast', block.length > 0 && !/\bAI\b/.test(block) && !/toast\('[A-Z]/.test(stripComments(ho)));
  T('G5 every action is one-tap (rrOnce): send, check, cancel, keep, remove', ['send', 'check', 'cancel', 'keep', 'remove'].every(k => ho.includes("rrOnce('rr-coll-handover-" + k + "'")));
  const ar = read('collections-archive.js');
  T('G6 the archive checks list holds the hand-over (one line in config + its checker)', /checks: \['moves', 'handover', 'invoices', 'unsold'\]/.test(cfg) && /\n    handover: function \(c\)/.test(ar));
  T('G7 the client\'s email comes through the ONE privacy door (rrCollectionClient), never Contacts read directly', /rrCollectionClient\(c\)/.test(ho) && !/contactsData/.test(stripComments(ho)));
}

const WAIT = ms => new Promise(r => setTimeout(r, ms));
async function steady(pg) {
  await pg.evaluate(() => {
    for (let i = 0; i < 8; i++) history.pushState({ pad: i }, '', '');
    window.__rm = async (id) => { const d = document.getElementById(id); if (d) d.remove(); await new Promise(r => setTimeout(r, 250)); };
  });
}
// the client in Contacts, and Hale's client set in the list file
// (after the collection is open: opening a collection reads Contacts from home again)
async function withClient(pg, email) {
  await pg.evaluate(async (em) => {
    state.contactsData = [{ id: 'K1', name: 'Pat Hale', email: em }, { id: 'K2', name: 'No Mail' }];
    const L = JSON.parse(window.__files.LIST.content); L.items.c7.clientId = 'K1'; window.__files.LIST.content = JSON.stringify(L);
    await rrCollectionsLoad();
  }, email);
}
// every file of Hale's collection, as the stand-in Drive has it
const HALE_FILES = `(function () {
  const out = ['S7']; const kids = p => Object.values(window.__files).filter(f => (f.parents || []).includes(p));
  const q = ['FP7']; out.push('FP7');
  while (q.length) { const p = q.shift(); kids(p).forEach(f => { if (!out.includes(f.id)) { out.push(f.id); if (f.mime === 'folder') q.push(f.id); } }); }
  return out;
})()`;

async function handRun(browser) {
  console.log('\n== H · the hand-over ==');
  const { pg, errs } = await boot(browser);
  await steady(pg);
  await openColl(pg, 'c7');
  await withClient(pg, 'pat@example.test');
  const h = await pg.evaluate(async (FILES) => {
    const out = {};
    out.notOpen = (await rrHandOverStart('c8')).why;
    // no client / a client with no email
    let L = JSON.parse(window.__files.LIST.content);
    L.items.c7.clientId = ''; window.__files.LIST.content = JSON.stringify(L); await rrCollectionsLoad();
    out.noClient = (await rrHandOverStart('c7')).why;
    L.items.c7.clientId = 'K2'; window.__files.LIST.content = JSON.stringify(L); await rrCollectionsLoad();
    out.noEmail = (await rrHandOverStart('c7')).why;
    L.items.c7.clientId = 'K1'; window.__files.LIST.content = JSON.stringify(L); await rrCollectionsLoad();
    // an unfinished move involving it
    L = JSON.parse(window.__files.LIST.content); L.moves = { mvX: { id: 'mvX', from: 'c7', to: 'c8', step: 'marked', items: [] } }; window.__files.LIST.content = JSON.stringify(L);
    out.moves = (await rrHandOverStart('c7')).why;
    delete L.moves; window.__files.LIST.content = JSON.stringify(L);
    // archived
    await rrArchiveCollection('c7', { anyway: true });
    out.archived = (await rrHandOverStart('c7')).why;
    await rrUnarchiveCollection('c7');
    // send
    window.__calls = [];
    const r = await rrHandOverStart('c7', { keep: true });
    const asks = window.__calls.filter(c => c.kind === 'permAsk');
    const expect = eval(FILES);   // read from the stand-in Drive, not typed
    out.r = r;
    out.asked = asks.map(a => a.id); out.expect = expect;
    out.firstNotify = asks[0] && asks[0].id === 'S7' && asks[0].notify;
    out.restQuiet = asks.slice(1).every(a => !a.notify);
    out.allPending = asks.every(a => a.pending && a.email === 'pat@example.test');
    out.harm = window.__calls.filter(c => c.kind === 'trash' || c.kind === 'permDrop').length;
    const e = JSON.parse(window.__files.LIST.content).items.c7;
    out.state = e.handover.state; out.nFiles = e.handover.files.length; out.status = e.status;
    out.log = (window.__S.S7['Movement Log'] || []).slice(2).map(l => l[3] + '|' + l[5] + '|' + l[7]);
    // press again: nothing asked twice
    window.__calls = [];
    out.again = await rrHandOverStart('c7', { keep: true });
    out.againAsks = window.__calls.filter(c => c.kind === 'permAsk').length;
    // the details card
    rrCollDetailsOpen('c7');
    const d = document.getElementById('rr-coll-details');
    out.card = d.querySelector('[data-ho-wait]') && d.querySelector('[data-ho-wait]').textContent;
    out.cardBtns = !!d.querySelector('[data-ho-check]') && !!d.querySelector('[data-ho-cancel]');
    await __rm('rr-coll-details');
    // archive waits for it
    const a = await rrArchiveCollection('c7', { anyway: true });
    out.archiveWhy = a.why; out.archiveIds = (a.open || []).map(x => x.id);
    return out;
  }, HALE_FILES);
  T('H1 refused, nothing asked: not the open collection; no client; a client with no email; an unfinished move; archived', h.notOpen === 'open' && h.noClient === 'client' && h.noEmail === 'email' && h.moves === 'moves' && h.archived === 'archived', h);
  T('H2 ONE request per file — the sheet, the folder, every folder and photo inside (' + h.expect.length + ')', h.r.ok && JSON.stringify(h.asked.slice().sort()) === JSON.stringify(h.expect.slice().sort()) && h.r.sent === h.expect.length && h.nFiles === h.expect.length, h);
  T('H3 the sheet goes FIRST and carries Google\'s one email; every other request is quiet; each is an ownership request to the client', h.firstNotify && h.restQuiet && h.allPending, h);
  T('H4 nothing is trashed, nothing taken away; the collection is still ACTIVE and waiting', h.harm === 0 && h.status === 'active' && h.state === 'waiting', h);
  T('H5 one Movement Log line: the whole collection, to the client, "Handed over to the client"', h.log.length === 1 && h.log[0] === 'The whole collection|Pat Hale|Handed over to the client', h.log);
  T('H6 pressing Send again asks for nothing twice', h.again.ok && h.againAsks === 0, h);
  T('H7 its Details say "Waiting for Pat Hale to accept — 0 of N accepted" with Check now + Cancel', new RegExp('Waiting for Pat Hale to accept — 0 of ' + h.expect.length + ' accepted').test(h.card || '') && h.cardBtns, h);
  T('H8 archiving waits for the hand-over (one more line in the archive checks)', h.archiveWhy === 'open' && h.archiveIds.includes('handover'), h);

  console.log('\n== W · accepted → linked → unlinked ==');
  const w = await pg.evaluate(async () => {
    const out = {};
    window.__accept('pat@example.test', 4);
    out.part = await rrHandOverCheck('c7');
    window.__accept('pat@example.test');
    out.all = await rrHandOverCheck('c7');
    rrCollDetailsOpen('c7');
    let d = document.getElementById('rr-coll-details');
    out.acceptedCard = !!d.querySelector('[data-ho-keep]') && !!d.querySelector('[data-ho-remove]');
    await __rm('rr-coll-details');
    out.keep = await rrHandOverKeep('c7');
    const e = JSON.parse(window.__files.LIST.content).items.c7;
    out.status = e.status; out.linked = e.linked; out.reg = rrCollectionByKey('c7') && rrCollectionByKey('c7').status;
    try { await sheetsUpdate('S7', 'My Collection!ZZ3', [['still mine to work on']]); out.write = 'wrote'; } catch (er) { out.write = er.message; }
    rrCollMenuOpen();
    out.inMenu = [...document.querySelectorAll('#rr-coll-list > button')].some(x => /7 – Hale/.test(x.textContent));
    await __rm('rr-coll-menu');
    rrCollDetailsOpen('c7');
    d = document.getElementById('rr-coll-details');
    out.linkedCard = d.querySelector('[data-ho-linked]') && d.querySelector('[data-ho-linked]').textContent;
    out.unlinkBtn = !!d.querySelector('[data-ho-unlink]');
    await __rm('rr-coll-details');
    out.moveTarget = rrMoveTargets !== undefined;
    // a linked collection is never trashed — even archived
    await rrArchiveCollection('c7', { anyway: true });
    window.__calls = [];
    out.del = (await rrDeleteCollection('c7', 'Hale')).why;
    out.delTrash = window.__calls.filter(c => c.kind === 'trash').length;
    await rrUnarchiveCollection('c7');
    // Unlink: this account's access off every file; the record stays
    window.__calls = [];
    out.unlink = await rrHandOverRemove('c7');
    out.drops = window.__calls.filter(c => c.kind === 'permDrop').map(c => c.id).length;
    out.harm = window.__calls.filter(c => c.kind === 'trash').length;
    out.myAccessLeft = Object.values(window.__files).filter(f => (f.perms || []).some(p => p.emailAddress === window.__me)).length;
    const e2 = JSON.parse(window.__files.LIST.content).items.c7;
    out.status2 = e2.status; out.num = e2.number; out.reg2 = rrCollectionByKey('c7'); out.live = state.personalSheetId;
    out.label = rrStickerFind('RR1:I:' + _shSheetTagOf('S7') + ':47');
    return out;
  });
  const today = await pg.evaluate(() => rrToday());
  T('W1 Check now: 4 of N accepted, still waiting; then all → accepted, Details offer Keep / Remove', w.part.ok && w.part.accepted === 4 && !w.part.all && w.all.all && w.acceptedCard, w);
  T('W2 Keep → a LINKED collection: still listed, in the drop-down, writes still work, Details say "Linked — owned by Pat Hale" with Unlink', w.keep.ok && w.status === 'linked' && w.linked === true && w.reg === 'linked' && w.write === 'wrote' && w.inMenu && /Linked — owned by Pat Hale/.test(w.linkedCard || '') && w.unlinkBtn, w);
  T('W3 a linked collection is never trashed — Delete refuses it, even archived', w.del === 'linked' && w.delTrash === 0, w);
  T('W4 Unlink: home first; this account\'s access comes off EVERY file; nothing trashed', w.unlink.ok && w.live === 'HOME' && w.drops > 0 && w.myAccessLeft === 0 && w.harm === 0, w);
  T('W5 the record stays (handed over, number 7 kept for good); this device forgets it; an old label says when it was handed over', w.status2 === 'handedOver' && w.num === 7 && w.reg2 === null && w.label && w.label.kind === 'deletedColl' && w.label.text === '7-47 — Hale was handed over to the client on ' + today + '.', w);
  T('W6 no script error', errs.length === 0, errs);
  await pg.close();
}

async function cancelRun(browser) {
  console.log('\n== C · cancel, refusals, a stop part way ==');
  const { pg, errs } = await boot(browser);
  await steady(pg);
  await openColl(pg, 'c7');
  await withClient(pg, 'pat@example.test');
  const c = await pg.evaluate(async () => {
    const out = {};
    // the sheet itself refused → nothing else asked
    window.__permFail = (id, m) => id === 'S7' && m === 'POST';
    window.__calls = [];
    out.refused = await rrHandOverStart('c7', { keep: true });
    out.refusedAsks = window.__calls.filter(x => x.kind === 'permAsk').length;
    out.refusedState = JSON.parse(window.__files.LIST.content).items.c7.handover.state;
    out.refusedCancel = (await rrHandOverCancel('c7')).ok;
    // one photo refused → the rest are sent; Send again finishes it
    window.__permFail = (id, m) => id === 'IMG45' && m === 'POST';
    window.__calls = [];
    out.some = await rrHandOverStart('c7', { keep: true });
    out.someState = JSON.parse(window.__files.LIST.content).items.c7.handover.state;
    window.__permFail = null;
    out.fix = await rrHandOverStart('c7', { keep: true });
    out.fixAsks = window.__calls.filter(x => x.kind === 'permAsk' && x.id === 'IMG45').length;
    // cancel before they accept: every request taken back
    out.cancel = await rrHandOverCancel('c7');
    out.pendingLeft = Object.values(window.__files).filter(f => (f.perms || []).some(p => p.emailAddress === 'pat@example.test')).length;
    out.cancelState = JSON.parse(window.__files.LIST.content).items.c7.handover.state;
    rrCollDetailsOpen('c7');
    out.openBtn = !!document.querySelector('#rr-coll-details [data-ho-open]');
    await __rm('rr-coll-details');
    // a stop part way (the connection drops at the 5th request) → Send again carries on
    let k = 0;
    const realFetch = window.fetch;
    window.fetch = async function (url, opts) { if (/\/permissions\?/.test(String(url)) && opts && opts.method === 'POST' && ++k === 5) throw new TypeError('Failed to fetch'); return realFetch(url, opts); };
    window.__calls = [];
    out.stop = await rrHandOverStart('c7', { keep: true });
    out.carry = await rrHandOverStart('c7', { keep: true });
    window.fetch = realFetch;
    const asks = window.__calls.filter(x => x.kind === 'permAsk').map(x => x.id);
    out.asks = asks.length; out.unique = new Set(asks).size;
    out.total = JSON.parse(window.__files.LIST.content).items.c7.handover.files.length;
    return out;
  });
  T('C1 Google refuses the SHEET → nothing else is asked, it says so; Cancel tidies up', !c.refused.ok && c.refused.why === 'refused' && c.refusedAsks === 0 && c.refusedState === 'refused' && c.refusedCancel, c);
  T('C2 one photo refused → every other request sent, told plainly; Send again sends only that one', c.some.why === 'some' && c.some.bad === 1 && c.someState === 'sending' && c.fix.ok && c.fixAsks === 1, c);
  T('C3 Cancel takes every request back; the collection can be handed over later', c.cancel.ok && c.pendingLeft === 0 && c.cancelState === 'cancelled' && c.openBtn, c);
  T('C4 a stop part way → Send again carries on: every file asked once, none twice', c.stop.why === 'stopped' && c.carry.ok && c.asks === c.total && c.unique === c.total, c);
  T('C5 no script error', errs.length === 0, errs);
  await pg.close();
}

async function screenRun(browser) {
  console.log('\n== S · the screen ==');
  const { pg, errs } = await boot(browser);
  await steady(pg);
  await openColl(pg, 'c7');
  await withClient(pg, 'pat@example.test');
  const s = await pg.evaluate(async () => {
    rrCollDetailsOpen('c7');
    const btn = document.querySelector('#rr-coll-details [data-ho-open]');
    const hasBtn = !!btn;
    btn.click();
    for (let i = 0; i < 40 && !/9 files/.test((document.getElementById('rr-ho-count') || {}).textContent || ''); i++) await new Promise(r => setTimeout(r, 50));
    const dlg = document.getElementById('rr-coll-handover');
    const text = dlg.textContent;
    dlg.querySelector('input[name="rr-ho-after"][value="remove"]').checked = true;
    window.__toasts = [];
    dlg.querySelector('[data-ho-send]').click();   // TAPPED, not called
    for (let i = 0; i < 80 && document.getElementById('rr-coll-handover'); i++) await new Promise(r => setTimeout(r, 100));
    const e = JSON.parse(window.__files.LIST.content).items.c7;
    // Check now, tapped
    window.__accept('pat@example.test');
    rrCollDetailsOpen('c7');
    document.querySelector('#rr-coll-details [data-ho-check]').click();
    for (let i = 0; i < 80 && !document.querySelector('#rr-coll-details [data-ho-keep]'); i++) await new Promise(r => setTimeout(r, 100));
    const keepBtn = document.querySelector('#rr-coll-details [data-ho-keep]');
    if (keepBtn) keepBtn.click();
    for (let i = 0; i < 80 && JSON.parse(window.__files.LIST.content).items.c7.status !== 'linked'; i++) await new Promise(r => setTimeout(r, 100));
    var linkedAfterTaps = JSON.parse(window.__files.LIST.content).items.c7.status;
    return { hasBtn, text, keep: e.handover.keep, state: e.handover.state, closed: !document.getElementById('rr-coll-handover'), toast: (window.__toasts.find(t => /Requests sent/.test(t)) || ''), linkedAfterTaps };
  });
  T('S1 Details → "Hand over to the client…" → the screen names the client and email, counts the files, offers the report first and Keep / Remove', s.hasBtn && /To: Pat Hale \(pat@example\.test\)/.test(s.text) && /9 files: the sheet, its folders and every photo\./.test(s.text) && /Make the PDF report/.test(s.text) && /Keep my access/.test(s.text), s);
  T('S2 Send: the choice is remembered (Remove), the screen closes, the person is told what the client does next', s.keep === false && s.state === 'waiting' && s.closed && /Requests sent to Pat Hale for 9 files\. They accept them in Google Drive\./.test(s.toast), s);
  T('S3 Check now and Keep, TAPPED, make it a linked collection', s.linkedAfterTaps === 'linked', s);
  T('S4 no script error', errs.length === 0, errs);
  await pg.close();
}

(async () => {
  guards();
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    await handRun(browser);
    await cancelRun(browser);
    await screenRun(browser);
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log('FAILED  —  ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
