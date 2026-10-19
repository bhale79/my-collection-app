// ══ tests/help-hub.js — THE HELP CENTRE ITSELF, NOT THE GUIDES INSIDE IT ══
//
// Brad: "do it for all the help functions."
//
// Every gate written so far tests the eleven guided walkthroughs. Nothing has
// ever tested the thing you press to REACH them. The Help Centre is a modal
// built from a string of HTML with inline onclick attributes, and four of its
// rows are not guides at all:
//
//   · Scanning and photo ID            -> showAiUsageCard(true)   (v0.9.1893; was the welcome card)
//   · How to undo a mistake            -> _uiShowVersionHistoryHelp()
//   · Reset tips                       -> resetContextualHints()
//   · Send feedback                    -> mailto:ADMIN_EMAIL
//
// Each of those is wrapped in `if (typeof X === 'function')`. That guard is
// sensible and it is also a trapdoor: if the function is ever renamed, the row
// still looks alive, still closes the Help Centre when pressed, and does
// NOTHING. A dead button that behaves like a live one is the exact shape of
// every help bug Brad has reported — "Add Want Item", the inert stat cards,
// the unreachable Engine + Tender. So each row is pressed here and required to
// leave a visible trace.
//
// The mailto row has the same problem in a different suit: with ADMIN_EMAIL
// unset the address builds as "mailto:?subject=…", which opens an empty email
// and looks like the app losing your feedback.
//
// WHAT IT CANNOT SEE, so nobody trusts it too far:
//   · whether the scanning card's WORDS are right — only that it appears
//   · whether a real mail client is installed
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { SEED } = require('./lib/guide-fixture');

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  console.log('FAILED  —  help-hub needs playwright and it is not installed.');
  process.exit(1);
}

const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

const KIT = `
window._hubClear = function () {
  for (var i = 0; i < 6; i++) {
    var c = document.querySelectorAll('[id^="rr-"][id$="-card"]');
    if (!c.length) break;
    for (var k = 0; k < c.length; k++) {
      var g = c[k].querySelector('[id$="-go"]');
      if (g) { try { g.click(); } catch (e) {} }
      if (c[k].parentNode) c[k].parentNode.removeChild(c[k]);
    }
  }
  var h = document.getElementById('help-hub-modal'); if (h) h.remove();
  try { _gtEnd(); } catch (e) {}
};
// Every row a user can press in the Help Centre, in order.
window._hubRows = function () {
  var m = document.getElementById('help-hub-modal');
  if (!m) return null;
  var out = [];
  m.querySelectorAll('button').forEach(function (b) {
    // The first line of a row is its ICON, on its own line, because the emoji
    // lives in a separate span. Treating that as the label reported every row
    // as blank — a harness fault, and one worth naming here so it does not get
    // re-introduced next time someone reads this file.
    var lines = (b.innerText || '').split('\\n').map(function (x) { return x.trim(); })
                  .filter(function (x) { return x.length; });
    var i0 = (lines.length > 1 && lines[0].length <= 3) ? 1 : 0;
    out.push({ icon: i0 ? lines[0] : '',
               label: lines[i0] || '',
               desc: lines[i0 + 1] || '',
               onclick: b.getAttribute('onclick') || '' });
  });
  return out;
};
window._hubPress = async function (label) {
  var m = document.getElementById('help-hub-modal');
  if (!m) return 'no-hub';
  var hit = null;
  m.querySelectorAll('button').forEach(function (b) {
    if (hit) return;
    if ((b.innerText || '').indexOf(label) >= 0) hit = b;
  });
  if (!hit) return 'no-row';
  // SCROLL TO IT FIRST, like a person would. The Help Centre's list is taller
  // than its own 74vh box, so the four non-guide rows at the bottom start out
  // below the fold of that box. Measuring them where they are NOT is how this
  // harness first reported three perfectly good buttons as unpressable.
  try { hit.scrollIntoView({ block: 'center' }); } catch (e) {}
  await new Promise(res => setTimeout(res, 350));
  // Press the POINT, not the node — a row covered by something else is a row
  // the user cannot press, and node.click() sails straight through any cover.
  var r = hit.getBoundingClientRect();
  var cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
  var top = document.elementFromPoint(cx, cy);
  var covered = !(top === hit || hit.contains(top));
  if (top) top.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy }));
  await new Promise(res => setTimeout(res, 900));
  return { covered: covered, coveredBy: covered && top ? (top.id || top.tagName) : '' };
};
// What is on screen that was not there before? The cheapest honest answer to
// "did pressing that do anything at all".
//
// THE HELP CENTRE ITSELF IS EXCLUDED, and that is the whole point. Every one of
// these rows closes the Help Centre on its way out, so a snapshot that counted
// the modal reported "something changed" even when the row's function had been
// renamed out of existence and nothing whatever happened. A mutation drill
// caught it: the row went dead and the assertion stayed green. What has to
// change is something OTHER than the modal going away.
window._hubSnapshot = function () {
  var ids = [];
  document.querySelectorAll('body > *').forEach(function (n) {
    if (n.id === 'help-hub-modal') return;
    if (n.offsetParent !== null || getComputedStyle(n).position === 'fixed') ids.push(n.id || n.className || n.tagName);
  });
  return ids.join('|');
};
`;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-hub-'));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 1844, height: 914 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.slice(0, 140)));
    for (const u of ['**://accounts.google.com/**', '**://apis.google.com/**',
                     '**://*.googleapis.com/**', '**://cdnjs.cloudflare.com/**',
                     '**://*.google.com/**'])
      await page.route(u, r => r.abort());

    await page.goto('file://' + APP + '/index.html');
    await page.waitForTimeout(2200);
    await page.evaluate(SEED);
    await page.evaluate(KIT);
    await page.evaluate(() => window._hubClear());
    await page.waitForTimeout(400);

    // ── 1. THE REAL DOOR ────────────────────────────────────────────────────
    // Open it the way a user does — by pressing the conductor widget in the
    // sidebar — not by calling openHelpHub() directly. A help centre you can
    // only reach from the console is not a help centre.
    const opened = await page.evaluate(async () => {
      const w = document.getElementById('tut-help-widget');
      if (!w) return { noWidget: true };
      const r = w.getBoundingClientRect();
      const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
      const top = document.elementFromPoint(cx, cy);
      const reachable = !!(top && (top === w || w.contains(top)));
      if (top) top.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy }));
      await new Promise(res => setTimeout(res, 800));
      return { reachable, onScreen: r.width > 0 && r.height > 0,
               hub: !!document.getElementById('help-hub-modal') };
    });
    ok('the Need Help? widget is on screen', !opened.noWidget && opened.onScreen, JSON.stringify(opened));
    ok('…and a real click on it lands, rather than hitting something on top',
       opened.reachable, JSON.stringify(opened));
    ok('BRAD\'S ASK: pressing it opens the Help Centre', opened.hub, JSON.stringify(opened));

    // ── 2. EVERY GUIDE HAS A ROW, AND EVERY ROW A GUIDE ─────────────────────
    // v0.9.1357 deleted a second, hardcoded list of guides precisely because a
    // list that can disagree with GUIDES is the bug. This keeps it honest.
    const rows = await page.evaluate(() => ({
      rows: window._hubRows(),
      guides: Object.keys(GUIDES).map(g => ({ id: g, label: GUIDES[g].label, desc: GUIDES[g].desc }))
    }));
    const guideRows = rows.rows.filter(r => /startGuide\('([^']+)'\)/.test(r.onclick));
    const named = guideRows.map(r => r.onclick.match(/startGuide\('([^']+)'\)/)[1]);
    ok('the Help Centre lists every guide exactly once',
       named.length === rows.guides.length && new Set(named).size === named.length,
       'listed ' + named.length + ' of ' + rows.guides.length + ': ' + named.join(','));
    ok('…and every row it lists is a guide that exists',
       named.every(n => rows.guides.some(g => g.id === n)),
       named.filter(n => !rows.guides.some(g => g.id === n)).join(','));
    ok('…and no row is left with a blank label or blank description',
       guideRows.every(r => r.label.length > 2 && r.desc.length > 2),
       JSON.stringify(guideRows.filter(r => r.label.length <= 2 || r.desc.length <= 2)
         .map(r => ({ label: r.label, desc: r.desc }))));
    // The row's words and the guide's own words are two copies of one thing.
    ok('…and each row says what its guide says it is called',
       guideRows.every(r => {
         const id = r.onclick.match(/startGuide\('([^']+)'\)/)[1];
         const g = rows.guides.find(x => x.id === id);
         return g && r.label === g.label && r.desc === g.desc;
       }),
       JSON.stringify(guideRows.slice(0, 3).map(r => r.label)));

    // ── 3. THE FEEDBACK ADDRESS IS A REAL ADDRESS ───────────────────────────
    const mail = rows.rows.find(r => r.onclick.indexOf('mailto:') >= 0);
    const addr = mail ? (mail.onclick.match(/mailto:([^?'"]*)/) || [])[1] : null;
    ok('the Send feedback row builds a mailto with a real recipient',
       !!addr && addr.indexOf('@') > 0, 'address was ' + JSON.stringify(addr));

    // ── 4. THE FOUR NON-GUIDE ROWS ACTUALLY DO SOMETHING ────────────────────
    // The trapdoor: each is guarded by `if (typeof X === 'function')`, so a
    // rename leaves a row that looks alive, closes the Help Centre, and does
    // nothing whatever.
    const NONGUIDE = [
      { label: 'Scanning and photo ID',       fn: 'showAiUsageCard' },   // v0.9.1893: the welcome card is gone
      { label: 'How to undo a mistake',       fn: '_uiShowVersionHistoryHelp' },
      { label: 'Reset tips',                  fn: 'resetContextualHints' },
      // v0.9.1987: the two Suggestions rows. Grading used to be slipped in by
      // help-guides.js after the hub drew; openHelpHub draws it now.
      { label: 'Photographing a large collection', fn: '_rrGuidePhotos' },
      { label: 'Condition grading (the C-scale)',  fn: 'rrgOpen' }
    ];
    for (const t of NONGUIDE) {
      const r = await page.evaluate(async (t) => {
        window._hubClear();
        openHelpHub();
        await new Promise(res => setTimeout(res, 500));
        const wired = (typeof window[t.fn] === 'function');
        const before = window._hubSnapshot();
        const press = await window._hubPress(t.label);
        const after = window._hubSnapshot();
        const out = { wired, press, changed: before !== after,
                      hubClosed: !document.getElementById('help-hub-modal') };
        window._hubClear();
        return out;
      }, t);
      ok('"' + t.label + '" is wired to a function that exists', r.wired, JSON.stringify(r));
      ok('…and its row is pressable, not covered', r.press && !r.press.covered, JSON.stringify(r));
      ok('…and pressing it visibly does something', r.changed, JSON.stringify(r));
    }

    // ── 5. THE HELP CENTRE CLOSES, BOTH WAYS ────────────────────────────────
    const closes = await page.evaluate(async () => {
      window._hubClear(); openHelpHub();
      await new Promise(res => setTimeout(res, 400));
      const m = document.getElementById('help-hub-modal');
      let x = null;
      m.querySelectorAll('button').forEach(b => { if (!x && (b.innerText || '').trim() === '×') x = b; });
      if (x) x.click();
      await new Promise(res => setTimeout(res, 400));
      const afterX = !document.getElementById('help-hub-modal');

      window._hubClear(); openHelpHub();
      await new Promise(res => setTimeout(res, 400));
      const m2 = document.getElementById('help-hub-modal');
      // v0.9.1790: the backdrop no longer closes it. Brad: "never close if you
      // pick outside." The click is still dispatched, because the thing under
      // test is now that it does NOTHING.
      m2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(res => setTimeout(res, 400));
      const afterBackdrop = !document.getElementById('help-hub-modal');

      window._hubClear(); openHelpHub(); openHelpHub(); openHelpHub();
      await new Promise(res => setTimeout(res, 300));
      const copies = document.querySelectorAll('#help-hub-modal').length;
      window._hubClear();
      return { afterX, afterBackdrop, copies };
    });
    ok('the × closes the Help Centre', closes.afterX, JSON.stringify(closes));
    // v0.9.1790 SUPERSEDED AND REPLACED, not deleted (the v1778 rule). This
    // pinned the backdrop CLOSING the Help Centre. [stated] Brad's standing
    // rule since v0.9.1786 is "never close if you pick outside", and when
    // asked whether the read-only overlays should follow it too — "so the rule
    // is simply clicking outside never closes anything" — he said yes. The ×
    // above is the way out, and the device Back button still works.
    ok('…and clicking the dark area around it does NOTHING', !closes.afterBackdrop, JSON.stringify(closes));
    ok('…and opening it three times leaves exactly one of it',
       closes.copies === 1, 'found ' + closes.copies);

    // ── 6. A GUIDE STARTED FROM THE HELP CENTRE LEAVES NOTHING BEHIND ───────
    // The row's onclick removes the modal and then calls startGuide. If the
    // order were ever reversed, the tour would run underneath a full-screen
    // dim overlay — visible, and completely unpressable.
    const fromHub = await page.evaluate(async () => {
      window._hubClear(); openHelpHub();
      await new Promise(res => setTimeout(res, 500));
      // v0.9.1987: the tour is the only guide left.
      await window._hubPress('Take the tour');
      await new Promise(res => setTimeout(res, 1600));
      const hubGone = !document.getElementById('help-hub-modal');
      const tour = !!document.getElementById('gt-callout');
      // Is the guide's own Next button the thing at its own coordinates?
      let reachable = false;
      const nx = document.getElementById('gt-next');
      if (nx) {
        const r = nx.getBoundingClientRect();
        const top = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
        reachable = !!(top && (top === nx || nx.contains(top)));
      }
      try { _gtEnd(); } catch (e) {}
      window._hubClear();
      return { hubGone, tour, reachable };
    });
    ok('starting a guide from the Help Centre closes the Help Centre', fromHub.hubGone, JSON.stringify(fromHub));
    ok('…and actually starts the guide', fromHub.tour, JSON.stringify(fromHub));
    ok('…and the guide\'s own Next button is pressable, not under a leftover overlay',
       fromHub.reachable, JSON.stringify(fromHub));

    // ── 7. TWO TOURS MUST NEVER RUN AT ONCE ─────────────────────────────────
    // The Help Centre sits above the tour (z-index 99999 against 99992), so it
    // CAN be opened mid-guide and a second guide started from it. One set of
    // tour furniture must survive, not two — two blockers would each swallow
    // the other's clicks.
    const twice = await page.evaluate(async () => {
      window._hubClear();
      startGuide('tour');
      await new Promise(res => setTimeout(res, 1400));
      openHelpHub();
      await new Promise(res => setTimeout(res, 500));
      const hubOnTop = (function () {
        const m = document.getElementById('help-hub-modal');
        if (!m) return false;
        const b = m.querySelector('button');
        if (!b) return false;
        const r = b.getBoundingClientRect();
        const top = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
        return !!(top && (top === b || b.contains(top)));
      })();
      // v0.9.1987: the tour is the only guide, so the second one started from
      // the hub is the tour again — it must REPLACE the running one, not stack.
      try { _gtEnd(); } catch (e) {}
      startGuide('tour');
      await new Promise(res => setTimeout(res, 1400));
      try { document.getElementById('gt-next').click(); } catch (e) {}   // move off card 1, so a restart is visible
      await new Promise(res => setTimeout(res, 700));
      openHelpHub();
      await new Promise(res => setTimeout(res, 500));
      await window._hubPress('Take the tour');
      await new Promise(res => setTimeout(res, 1800));
      const out = {
        hubOnTop,
        blockers: document.querySelectorAll('#gt-blocker').length,
        callouts: document.querySelectorAll('#gt-callout').length,
        holes: document.querySelectorAll('#gt-hole').length,
        hubGone: !document.getElementById('help-hub-modal'),
        card: (document.getElementById('gt-callout') || {}).innerText || ''
      };
      try { _gtEnd(); } catch (e) {}
      window._hubClear();
      return out;
    });
    ok('the Help Centre opens on top of a running guide, not underneath it',
       twice.hubOnTop, JSON.stringify(twice));
    ok('starting a second guide from it leaves exactly one tour running',
       twice.blockers === 1 && twice.callouts === 1 && twice.holes === 1, JSON.stringify(twice));
    ok('…and it is the one that was asked for, from its first card',
       /go through your dashboard/i.test(twice.card), JSON.stringify(twice.card).slice(0, 120));

    // ── 8. THE VIDEOS (v0.9.1987) ───────────────────────────────────────────
    // Brad: "we need to add our new videos with audio" and a mute button,
    // "the user can just turn the sound down but a mute button might be nice".
    // A row per ready video; the player opens ON TOP of the Help Center; Sound
    // and Captions are two buttons whose choice is remembered (lv_help_video_*
    // through _prefSet, so it follows the account).
    const vid = await page.evaluate(async () => {
      const cfg = window.TUTORIAL_GIFS;
      [cfg.prefMuted, cfg.prefCaptions].forEach(k => { localStorage.removeItem(k); localStorage.removeItem(k + '__at'); });
      window._hubClear(); openHelpHub();
      await new Promise(res => setTimeout(res, 400));
      const ready = rrReadyDemos();
      const d0 = ready[0], d1 = ready[1] || ready[0];
      const press = await window._hubPress(d0.title);
      await new Promise(res => setTimeout(res, 500));
      const pl = document.getElementById('rr-video-player');
      const out = { press, player: !!pl, hubUnder: !!document.getElementById('help-hub-modal') };
      if (!pl) return out;
      const v = pl.querySelector('video'), src = pl.querySelector('source'), tr = pl.querySelector('track');
      const x = pl.querySelector('.rr-vp-x');
      const xr = x.getBoundingClientRect();
      const top = document.elementFromPoint(Math.round(xr.left + xr.width / 2), Math.round(xr.top + xr.height / 2));
      out.onTop = !!(top && (top === x || x.contains(top)));
      out.src = src && src.getAttribute('src'); out.vtt = tr && tr.getAttribute('src'); out.poster = v.getAttribute('poster');
      out.want = d0.file;
      const bS = pl.querySelector('[data-vp="sound"]'), bC = pl.querySelector('[data-vp="cc"]');
      out.start = { muted: v.muted, cc: tr.track.mode, sound: bS.innerText, ccTxt: bC.innerText };
      bS.click(); await new Promise(res => setTimeout(res, 200));
      bC.click(); await new Promise(res => setTimeout(res, 200));
      out.after = { muted: v.muted, cc: tr.track.mode, sound: bS.innerText, ccTxt: bC.innerText,
                    kMuted: localStorage.getItem(cfg.prefMuted), kCc: localStorage.getItem(cfg.prefCaptions),
                    stamped: !!localStorage.getItem(cfg.prefMuted + '__at') };
      // A browser that cannot decode the video says so in words (the test
      // Chromium has no H.264, so this is exercised for real here).
      await new Promise(res => setTimeout(res, 1200));
      out.canMp4 = v.canPlayType('video/mp4; codecs="avc1.640028, mp4a.40.2"');
      out.errShown = !!pl.querySelector('.rr-vp-err');
      x.click(); await new Promise(res => setTimeout(res, 300));
      out.closedByX = !document.getElementById('rr-video-player');
      out.hubStill = !!document.getElementById('help-hub-modal');
      // Reopen another: both choices come back.
      rrPlayVideo(d1.id); await new Promise(res => setTimeout(res, 400));
      const pl2 = document.getElementById('rr-video-player');
      out.again = pl2 ? { muted: pl2.querySelector('video').muted, cc: pl2.querySelector('track').track.mode,
                          one: document.querySelectorAll('#rr-video-player').length } : null;
      // The video's OWN mute (its controls) is remembered the same way.
      if (pl2) { pl2.querySelector('video').muted = false; await new Promise(res => setTimeout(res, 250)); }
      out.nativeUnmute = { k: localStorage.getItem(cfg.prefMuted), txt: pl2 ? pl2.querySelector('[data-vp="sound"]').innerText : '' };
      // Escape closes it too; the Help Center stays.
      pl2 && pl2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise(res => setTimeout(res, 300));
      out.closedByEsc = !document.getElementById('rr-video-player');
      // The device Back button closes the player, not the Help Center.
      rrPlayVideo(d0.id); await new Promise(res => setTimeout(res, 400));
      history.back(); await new Promise(res => setTimeout(res, 700));
      out.closedByBack = !document.getElementById('rr-video-player');
      out.hubAfterBack = !!document.getElementById('help-hub-modal');
      // An id that is not a ready video opens nothing.
      rrPlayVideo('no-such-video'); await new Promise(res => setTimeout(res, 200));
      out.bogus = !!document.getElementById('rr-video-player');
      [cfg.prefMuted, cfg.prefCaptions].forEach(k => { localStorage.removeItem(k); localStorage.removeItem(k + '__at'); });
      window._hubClear();
      return out;
    });
    ok('BRAD\'S ASK: pressing a video row opens its player', vid.player && vid.press && !vid.press.covered, JSON.stringify(vid));
    ok('…on top of the Help Center, which stays open underneath', vid.onTop && vid.hubUnder, JSON.stringify(vid));
    ok('…playing that video, with its captions and its still',
       vid.src === './videos/' + vid.want + '.mp4' && vid.vtt === './videos/' + vid.want + '.vtt' && vid.poster === './videos/' + vid.want + '.jpg',
       JSON.stringify([vid.src, vid.vtt, vid.poster]));
    ok('…starting with sound on and captions off, and saying so',
       vid.start && vid.start.muted === false && vid.start.cc !== 'showing' && /Sound is on/.test(vid.start.sound) && /Captions are off/.test(vid.start.ccTxt),
       JSON.stringify(vid.start));
    ok('the Sound button mutes, and the Captions button shows captions',
       vid.after && vid.after.muted === true && vid.after.cc === 'showing' && /Sound is off/.test(vid.after.sound) && /Captions are on/.test(vid.after.ccTxt),
       JSON.stringify(vid.after));
    ok('…and both choices are saved through _prefSet (stamped, so they follow the account)',
       vid.after && vid.after.kMuted === '1' && vid.after.kCc === '1' && vid.after.stamped, JSON.stringify(vid.after));
    ok('…and the next video opens with them remembered, one player only',
       vid.again && vid.again.muted === true && vid.again.cc === 'showing' && vid.again.one === 1, JSON.stringify(vid.again));
    ok('…and unmuting with the video\'s own controls is remembered and shown on the button',
       vid.nativeUnmute && vid.nativeUnmute.k === '0' && /Sound is on/.test(vid.nativeUnmute.txt), JSON.stringify(vid.nativeUnmute));
    ok('the × closes the player and leaves the Help Center', vid.closedByX && vid.hubStill, JSON.stringify(vid));
    ok('…and Escape closes it too', vid.closedByEsc, JSON.stringify(vid));
    ok('…and the device Back button closes the player, not the Help Center', vid.closedByBack && vid.hubAfterBack, JSON.stringify(vid));
    ok('a name that is not a ready video opens nothing', vid.bogus === false, JSON.stringify(vid));
    ok('a browser that cannot play the video says so in words',
       vid.canMp4 !== '' || vid.errShown, JSON.stringify({ canMp4: vid.canMp4, errShown: vid.errShown }));

    // ── 9. THE PLAYER ON A PHONE, UPRIGHT AND SIDEWAYS ──────────────────────
    // Full screen on a phone; the × and both buttons on screen and big enough
    // for a thumb; sideways, the picture keeps most of the height.
    for (const vp of [{ w: 390, h: 844, name: 'phone upright' }, { w: 844, h: 390, name: 'phone sideways' }]) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.waitForTimeout(300);
      const ph = await page.evaluate(async () => {
        window._hubClear();
        rrPlayVideo(rrReadyDemos()[0].id);
        await new Promise(res => setTimeout(res, 500));
        const pl = document.getElementById('rr-video-player');
        if (!pl) return { none: true };
        const W = innerWidth, H = innerHeight;
        const r = el => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
        const box = r(pl.querySelector('.rr-vp-box')), vid = r(pl.querySelector('video')),
              x = r(pl.querySelector('.rr-vp-x')),
              btns = Array.from(pl.querySelectorAll('.rr-vp-btn')).map(r);
        const inside = q => q.l >= -1 && q.t >= -1 && q.r <= W + 1 && q.b <= H + 1;
        const out = { W, H, box, vid, x, btns,
          fullWidth: box.w >= W - 1,
          xOk: inside(x) && x.h >= 36,
          btnsOk: btns.length === 2 && btns.every(b => inside(b) && b.h >= 40),
          scrollX: document.documentElement.scrollWidth > W };
        pl.querySelector('.rr-vp-x').click();
        await new Promise(res => setTimeout(res, 200));
        return out;
      });
      ok('[' + vp.name + '] the player fills the screen width', !ph.none && ph.fullWidth, JSON.stringify(ph.box));
      ok('[' + vp.name + '] its × is on screen and thumb-sized', ph.xOk, JSON.stringify(ph.x));
      ok('[' + vp.name + '] Sound and Captions are both on screen and thumb-sized', ph.btnsOk, JSON.stringify(ph.btns));
      ok('[' + vp.name + '] the picture gets at least half the screen\'s height',
         ph.vid && ph.vid.h >= ph.H * 0.5 - 1 || (ph.vid && ph.vid.w >= ph.W - 1), JSON.stringify(ph.vid));
    }
    await page.setViewportSize({ width: 1844, height: 914 });

    ok('exercising the whole Help Centre raises no page errors',
       errs.length === 0, errs.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
