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
//   · app/tutorial-gifs-config.js  the onboarding demos.
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

// "condition on a 1 to 10 scale"
const condSaid = claims(/1 to 10/);
const condSliders = ['wizard.js', 'browse.js', 'app-collection.js']
  .map(f => { try { return fs.readFileSync(path.join(APP, f), 'utf8'); } catch (e) { return ''; } })
  .join('\n');
const condRange = /min="1"\s+max="10"/.test(condSliders);
ok('the copy still promises a 1-to-10 condition scale', condSaid, 'if this went away, drop the check below too');
ok('BRAD\'S CLAIM: and the condition control really is 1 to 10',
   !condSaid || condRange, 'no min="1" max="10" range input found');

// "one photo ID per item" / "Read this photo (1 photo ID)"
const idSaid = claims(/one photo ID per item/);
const inbox = fs.readFileSync(path.join(APP, 'photo-inbox.js'), 'utf8');
const idPriced = /1 photo ID/.test(inbox);
ok('the copy still prices a close read at one photo ID', idSaid);
ok('BRAD\'S CLAIM: and the button the user presses says the same price',
   !idSaid || idPriced, 'photo-inbox.js never mentions "1 photo ID"');

// "Discard sends photos to your Drive trash, recoverable for about 30 days"
const trashSaid = claims(/Drive trash/);
const collection = fs.readFileSync(path.join(APP, 'app-collection.js'), 'utf8');
const trashesNotDeletes = /trashed:\s*true/.test(collection) &&
                          !/driveRequest\('DELETE'/.test(collection);
ok('the copy still says photos go to the Drive trash', trashSaid);
ok('BRAD\'S CLAIM: and the code trashes them rather than destroying them',
   !trashSaid || trashesNotDeletes,
   'expected a PATCH trashed:true and no DELETE in app-collection.js');

// "Your Google Sheet row is cleared rather than destroyed"
const clearSaid = claims(/cleared rather than destroyed/);
const clearsRow = /clearRow|batchClear|values\/[^']*:clear|CLEAR/i.test(collection);
ok('the copy still says the sheet row is cleared, not destroyed', clearSaid);
ok('BRAD\'S CLAIM: and removal clears the row rather than deleting it',
   !clearSaid || clearsRow, 'no row-clearing call found in app-collection.js');

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
    const pid = await page.evaluate(() => {
      if (typeof window.rrPhotoIdHelpHtml !== 'function') return { missing: true };
      const html = window.rrPhotoIdHelpHtml();
      const d = document.createElement('div');
      d.innerHTML = html;
      const text = (d.textContent || '').replace(/\s+/g, ' ').trim();
      return { missing: false, chars: text.length,
               pricesTheRead: /1 photo ID/.test(text),
               saysFreeFirst: /free/i.test(text),
               brokenImg: Array.from(d.querySelectorAll('img')).filter(i => !i.getAttribute('src')).length };
    });
    ok('the photo-ID help panel renders', !pid.missing && pid.chars > 100, JSON.stringify(pid));
    if (!pid.missing) {
      ok('…and it states the price the buttons charge', pid.pricesTheRead, JSON.stringify(pid));
      ok('…and it still says the free read comes first', pid.saysFreeFirst, JSON.stringify(pid));
      ok('…and no image in it is missing its source', pid.brokenImg === 0, JSON.stringify(pid));
    }

    // ── THE ONBOARDING DEMOS ────────────────────────────────────────────────
    const gifs = await page.evaluate(() => {
      const g = window.TUTORIAL_GIFS || {};
      const demos = g.demos || [];
      return { count: demos.length,
               unnamed: demos.filter(d => !d.title && !d.label && !d.id).length,
               placeholders: demos.filter(d => !d.gifUrl).length };
    });
    ok('the onboarding demo list is configured', gifs.count > 0, JSON.stringify(gifs));
    ok('…and every demo in it has something to call itself',
       gifs.unnamed === 0, JSON.stringify(gifs));
    // Placeholders are a KNOWN state (onboarding.js says so outright), not a
    // defect — this records how many, so the number is visible rather than
    // discovered later by a user pressing one.
    console.log('     ' + gifs.placeholders + ' of ' + gifs.count +
                ' onboarding demos have no gif yet (a known placeholder state)');

    // ── A DOOR MUST NOT BE OFFERED INTO AN EMPTY ROOM ──────────────────────
    // With every demo still a placeholder, "Watch how-to demos" would open a
    // box containing a heading, nothing at all, and a line saying you can also
    // find these in the Help menu — where there are none either. That is the
    // same shape as the tour card describing stat cards a new user does not
    // have. The app already gets this right in two places, and this is the
    // assertion that keeps it right: the onboarding link and the Help-menu
    // section both check rrReadyDemos() before offering anything.
    const doors = await page.evaluate(async () => {
      const ready = (typeof rrReadyDemos === 'function') ? rrReadyDemos().length : -1;
      // The onboarding screen that carries the demos link.
      let linkShown = null;
      try {
        if (typeof showFeatureMap === 'function') {
          showFeatureMap();
          await new Promise(r => setTimeout(r, 700));
          linkShown = /Watch how-to demos/.test(document.body.innerText || '');
          if (typeof onboardSkipTour === 'function') onboardSkipTour();
          await new Promise(r => setTimeout(r, 300));
        }
      } catch (e) {}
      // The Help menu section.
      const section = !!document.getElementById('tut-gifs-section');
      // Every demo rrReadyDemos() hands back is badged "Ready" and rendered as
      // a launcher. One without a gifUrl is a button that does nothing.
      let readyWithoutGif = 0;
      try {
        readyWithoutGif = (typeof rrReadyDemos === 'function' ? rrReadyDemos() : [])
          .filter(d => !d || !d.gifUrl).length;
      } catch (e) {}
      return { ready, linkShown, section, readyWithoutGif };
    });
    // The first version of this assertion short-circuited to true whenever any
    // demo was ready, which made it vacuous the moment a drill marked them all
    // ready — green on the very defect it was written to catch. Two halves
    // now, and each can fail on its own.
    ok('BRAD\'S SHAPE: no "watch the demos" door is offered while there are none',
       doors.ready > 0 || (doors.linkShown !== true && doors.section === false),
       JSON.stringify(doors));
    ok('…and nothing is ever listed as Ready to watch without a video behind it',
       doors.readyWithoutGif === 0,
       JSON.stringify(doors) + '  — rrReadyDemos() is what decides the Ready badge');

    ok('exercising every help surface raises no page errors',
       errs.length === 0, errs.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
