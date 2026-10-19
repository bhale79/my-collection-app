// ══ tests/help-surfaces.js — THE HELP THAT IS NOT THE GUIDED TOUR ═════════
//
// Brad: "do it for all the help functions."
//
// Eight rounds in, every harness so far has tested the eleven guided
// walkthroughs and the Help Centre that lists them. Those are not all the help
// in this app. Three more surfaces exist and none of them has ever been tested
// by anything:
//
//   · app/gmail-help.js       a small help system of its own — a chooser, a
//                             set of paths, a Back that returns to the
//                             chooser, a close, and a print. Exactly the
//                             shape Brad asked about: cancel out, back up, or
//                             move forward.
//   · app/help-photo-id.js    the panel explaining what a photo ID costs,
//                             rendered inside the Photo Inbox.
//   · app/tutorial-gifs-config.js  the help videos (v0.9.1987; was the onboarding demos).
//
// AND THE NUMBERS THE COPY PROMISES. The guided-tour copy makes factual claims
// that are not about buttons and that no gate has ever checked: a 1-to-10
// condition scale, one photo ID per item, photos going to Drive TRASH rather
// than being destroyed, a sheet row CLEARED rather than deleted. Each is
// checked here against what the app actually does, by name, with the reason.
//
// WHAT IT CANNOT SEE, so nobody trusts it too far:
//   · what Google does with a trashed file after 30 days
//   · whether the printed guide looks right on paper
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { SEED } = require('./lib/guide-fixture');

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  console.log('FAILED  —  help-surfaces needs playwright and it is not installed.');
  process.exit(1);
}

const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

// ── PART ONE: claims checked against the source, no browser needed ─────────
const tut = fs.readFileSync(path.join(APP, 'tutorial.js'), 'utf8');
const bodies = (tut.match(/body:\s*'(?:\\.|[^'])*'/g) || []).join('\n');

function claims(re) { return re.test(bodies); }

// "condition on a 1 to 10 scale" — v0.9.1987: the per-page guides that also
// promised one photo ID per item, the Drive trash and a cleared sheet row are
// gone (narrated videos replaced them), so those three claims went with them.
// The 1-to-10 promise lives on in the grading guide and its Help Center row.
const gradingSrc = fs.readFileSync(path.join(APP, 'help-guides.js'), 'utf8');
const condSaid = /our 1\u201310|our 1–10/.test(gradingSrc + tut);
const condSliders = ['wizard.js', 'browse.js', 'app-collection.js']
  .map(f => { try { return fs.readFileSync(path.join(APP, f), 'utf8'); } catch (e) { return ''; } })
  .join('\n');
const condRange = /min="1"\s+max="10"/.test(condSliders);
ok('the copy still promises a 1-to-10 condition scale', condSaid, 'if this went away, drop the check below too');
ok('BRAD\'S CLAIM: and the condition control really is 1 to 10',
   !condSaid || condRange, 'no min="1" max="10" range input found');

// ── PART TWO: the three untested help surfaces, in a real browser ──────────
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-surf-'));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.slice(0, 140)));
    for (const u of ['**://accounts.google.com/**', '**://apis.google.com/**',
                     '**://*.googleapis.com/**', '**://cdnjs.cloudflare.com/**',
                     '**://*.google.com/**'])
      await page.route(u, r => r.abort());

    await page.goto('file://' + APP + '/index.html');
    await page.waitForTimeout(2200);
    await page.evaluate(SEED);
    await page.waitForTimeout(400);

    // ── THE GMAIL HELP FLOW ─────────────────────────────────────────────────
    // Its own little help system, with the same three ways out Brad named.
    const gmail = await page.evaluate(async () => {
      const has = typeof window.gmailShowHelp === 'function';
      if (!has) return { missing: true };
      const cfg = window.GMAIL_HELP || {};
      const paths = (cfg.paths || []).map(p => p.id);
      gmailShowHelp();
      await new Promise(r => setTimeout(r, 500));
      const ov = () => document.getElementById('gmail-help-overlay');
      const chooserButtons = ov() ? ov().querySelectorAll('button').length : 0;
      // Every path the config declares must be reachable and must render.
      const perPath = [];
      for (const id of paths) {
        gmailShowPath(id);
        await new Promise(r => setTimeout(r, 350));
        const o = ov();
        const txt = o ? (o.innerText || '').replace(/\s+/g, ' ').trim() : '';
        let backable = false;
        if (o) o.querySelectorAll('button').forEach(b => {
          if (/back/i.test(b.innerText || '')) backable = true;
        });
        perPath.push({ id, chars: txt.length, backable });
        gmailBackToChooser();
        await new Promise(r => setTimeout(r, 300));
        perPath[perPath.length - 1].returnedToChooser =
          !!(ov() && /choose|which|help/i.test((ov().innerText || '').slice(0, 400)));
      }
      gmailCloseHelp();
      await new Promise(r => setTimeout(r, 300));
      const closed = !ov();
      // Opening twice must not stack two overlays.
      gmailShowHelp(); gmailShowHelp();
      await new Promise(r => setTimeout(r, 300));
      const copies = document.querySelectorAll('#gmail-help-overlay').length;
      gmailCloseHelp();
      await new Promise(r => setTimeout(r, 200));
      return { paths, chooserButtons, perPath, closed, copies,
               leftBehind: document.querySelectorAll('#gmail-help-overlay').length };
    });

    ok('the Gmail help flow exists and is wired up', !gmail.missing, JSON.stringify(gmail));
    if (!gmail.missing) {
      ok('…and its chooser offers something to choose', gmail.chooserButtons >= 2, String(gmail.chooserButtons));
      ok('…and every path its config declares actually renders something',
         gmail.perPath.length > 0 && gmail.perPath.every(p => p.chars > 40),
         JSON.stringify(gmail.perPath));
      ok('BRAD\'S ASK: every path has a Back, and Back returns to the chooser',
         gmail.perPath.every(p => p.backable && p.returnedToChooser),
         JSON.stringify(gmail.perPath));
      ok('…and closing it leaves nothing behind',
         gmail.closed && gmail.leftBehind === 0, JSON.stringify(gmail));
      ok('…and opening it twice leaves exactly one of it', gmail.copies === 1, String(gmail.copies));
    }

    // ── THE PHOTO-ID HELP PANEL ─────────────────────────────────────────────
    // v0.9.1927: the price belongs to Auto Read, a beta feature — rendered
    // here as a beta tester sees it, then again as everyone else does.
    const pid = await page.evaluate(() => {
      if (typeof window.rrPhotoIdHelpHtml !== 'function') return { missing: true };
      const orig = window.rrFeatureOn;
      const sw = window.RR_AUTO_READ_ON;
      window.RR_AUTO_READ_ON = true;   // v0.9.1949: off for everyone by default — switched on here to see the beta tester's page
      window.rrFeatureOn = n => n === 'auto_read' ? true : orig(n);
      let html;
      try { html = window.rrPhotoIdHelpHtml(); } finally { window.rrFeatureOn = orig; window.RR_AUTO_READ_ON = sw; }
      const off = document.createElement('div');
      window.rrFeatureOn = n => n === 'auto_read' ? false : orig(n);
      try { off.innerHTML = window.rrPhotoIdHelpHtml(); } finally { window.rrFeatureOn = orig; }
      const d = document.createElement('div');
      d.innerHTML = html;
      const text = (d.textContent || '').replace(/\s+/g, ' ').trim();
      return { missing: false, chars: text.length,
               pricesTheRead: /1 photo ID/.test(text),
               offHasNoPrice: !/(?<!Google )photo ID/i.test(off.textContent || ''),   // v0.9.1960: "Google Photo ID" is free
               saysFreeFirst: /free/i.test(text),
               brokenImg: Array.from(d.querySelectorAll('img')).filter(i => !i.getAttribute('src')).length };
    });
    ok('the photo-ID help panel renders', !pid.missing && pid.chars > 100, JSON.stringify(pid));
    if (!pid.missing) {
      ok('…and it states the price the buttons charge (beta tester)', pid.pricesTheRead, JSON.stringify(pid));
      ok('…and without Auto Read it names no price at all', pid.offHasNoPrice, JSON.stringify(pid));
      ok('…and it still says the free read comes first', pid.saysFreeFirst, JSON.stringify(pid));
      ok('…and no image in it is missing its source', pid.brokenImg === 0, JSON.stringify(pid));
    }

    // ── THE HELP VIDEOS (v0.9.1987 — was the six empty GIF slots) ───────────
    const gifs = await page.evaluate(() => {
      const g = window.TUTORIAL_GIFS || {};
      const demos = g.demos || [];
      return { count: demos.length,
               unnamed: demos.filter(d => !d.title).length,
               placeholders: demos.filter(d => !d.file).length };
    });
    ok('the help video list is configured', gifs.count > 0, JSON.stringify(gifs));
    ok('…and every video in it has a title', gifs.unnamed === 0, JSON.stringify(gifs));
    console.log('     ' + gifs.placeholders + ' of ' + gifs.count + ' listed videos have no file yet');

    // ── A DOOR MUST NOT BE OFFERED INTO AN EMPTY ROOM ──────────────────────
    // The Help Center draws a Videos heading only when rrReadyDemos() has
    // something, and every row under it is a video with a file. Two halves,
    // each able to fail on its own: emptied, the heading must go; filled, the
    // rows must match the ready list exactly.
    const doors = await page.evaluate(async () => {
      const read = () => {
        const m = document.getElementById('help-hub-modal');
        const txt = m ? (m.innerText || '') : '';
        const rows = m ? Array.from(m.querySelectorAll('button[onclick*="rrPlayVideo("]'))
          .map(b => (b.getAttribute('onclick').match(/rrPlayVideo\('([^']+)'\)/) || [])[1]) : [];
        if (m) m.remove();
        return { heading: /\bVIDEOS\b|\bVideos\b/.test(txt), rows };
      };
      const ready = rrReadyDemos().map(d => d.id);
      openHelpHub(); await new Promise(r => setTimeout(r, 300));
      const full = read();
      const keep = window.TUTORIAL_GIFS.demos;
      window.TUTORIAL_GIFS.demos = keep.map(d => Object.assign({}, d, { file: '' }));
      openHelpHub(); await new Promise(r => setTimeout(r, 300));
      const empty = read();
      window.TUTORIAL_GIFS.demos = keep;
      return { ready, full, empty };
    });
    ok('BRAD\'S SHAPE: with no video ready, the Help Center offers no Videos heading and no rows',
       !doors.empty.heading && doors.empty.rows.length === 0, JSON.stringify(doors.empty));
    ok('…and with videos ready, it lists exactly the ready ones, each once',
       doors.full.heading && doors.full.rows.length === doors.ready.length &&
       doors.ready.every(id => doors.full.rows.filter(r => r === id).length === 1),
       JSON.stringify(doors));

    ok('exercising every help surface raises no page errors',
       errs.length === 0, errs.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
