// ═══════════════════════════════════════════════════════════════
// tutorial-gifs-config.js — THE ONE LIST of help videos, and their player.
//
// v0.9.1987 (Brad: "under guided walk throughs, the tour is the only one we
// need to keep, we need to add our new videos with audio"). The file keeps
// its old name so nothing that loads it has to change; what it holds is now
// the Help Center's video library.
//
// TO ADD A VIDEO — two steps, no other code:
//   1. Put three files in app/videos/, all with the same name:
//        name.mp4  the video (H.264 + AAC, "faststart", ~CRF 27)
//        name.vtt  the captions (WebVTT)
//        name.jpg  the still shown before Play
//   2. Add one line to `demos` below with file: 'name'.
// tests/help_videos_1987_tests.js fails if a listed video is missing any of
// its three files, or if its `length` does not match the real video.
//
// A video appears in the Help Center ONLY when its entry has a `file`
// (rrReadyDemos — the one reader). Nothing unready is ever drawn.
//
// The videos are NOT kept by the offline cache (sw.js skips /videos/) — they
// are large and stream from the site when played.
// ═══════════════════════════════════════════════════════════════

const TUTORIAL_GIFS = {
  sectionTitle: 'Videos',
  sectionNote:  'Short videos with sound. Turn the sound off or the captions on with the buttons under each video.',
  folder:       './videos/',

  // The two settings the player remembers. They go through _prefSet, so
  // they follow the account to every device.
  prefMuted:    'lv_help_video_muted',
  prefCaptions: 'lv_help_video_captions',

  // Groups, in the order the Help Center shows them. A group with no ready
  // video is not drawn.
  sections: [
    { id: 'adding',  title: 'Adding to your collection' },
    { id: 'selling', title: 'Selling and sharing' },
    { id: 'reports', title: 'Reports' },
    { id: 'help',    title: 'Getting help' },
  ],

  demos: [
    { id: 'add-known-item',    section: 'adding',  file: 'add-known-item',    length: '3:46',
      title: 'Add an item when you know its number',
      description: 'Photo, number, condition, value and where it is kept — a 3376 giraffe car from start to saved.' },
    { id: 'add-unknown-item',  section: 'adding',  file: 'add-unknown-item',  length: '3:16',
      title: 'Add an item when you don’t know its number',
      description: 'Find the number from a photo with Google Lens, then finish the add.' },
    { id: 'add-ab-diesel-set', section: 'adding',  file: 'add-ab-diesel-set', length: '2:54',
      title: 'Add an A-B diesel pair',
      description: 'The powered A unit and its B unit entered together, with photos of each.' },
    { id: 'add-paper-item',    section: 'adding',  file: 'add-paper-item',    length: '2:28',
      title: 'Add a paper item',
      description: 'Catalogs, drawings and other paper — with a crooked photo straightened and cropped.' },
    { id: 'share-for-sale',    section: 'selling', file: 'share-for-sale',    length: '1:32',
      title: 'Share your for-sale list',
      description: 'Pick the items, choose what to show, and email them as picture cards.' },
    { id: 'already-own-check', section: 'adding',  file: 'already-own-check', length: '0:31',
      title: 'See if you already own it',
      description: 'Start adding a number you already have, and the app shows you the one in your collection.' },
    { id: 'reports-overview',  section: 'reports', file: 'reports-overview',  length: '1:14',
      title: 'The Reports page',
      description: 'An insurance list and show lists ready to print or save as a PDF, and your own custom reports.' },
    { id: 'report-a-problem',  section: 'help',    file: 'report-a-problem',  length: '1:17',
      title: 'Report a problem',
      description: 'Tell us what went wrong, add screenshots, and see exactly what is sent before you send it.' },
  ],
};

window.TUTORIAL_GIFS = TUTORIAL_GIFS;

// ONE READER for "which videos actually exist" (since v0.9.1248, when the
// list was six empty GIF slots). Everything that offers a video asks this.
function rrReadyDemos() {
  var cfg = window.TUTORIAL_GIFS || {};
  return (cfg.demos || []).filter(function (d) { return d && d.file; });
}
window.rrReadyDemos = rrReadyDemos;

// The ready videos, grouped for the Help Center: [{ title, demos }] in the
// order of `sections`. A video whose section is not listed goes in a last
// "More videos" group rather than vanishing.
function rrVideoGroups() {
  var cfg = window.TUTORIAL_GIFS || {};
  var ready = rrReadyDemos(), out = [], used = {};
  (cfg.sections || []).forEach(function (s) {
    var ds = ready.filter(function (d) { return d.section === s.id; });
    ds.forEach(function (d) { used[d.id] = 1; });
    if (ds.length) out.push({ title: s.title, demos: ds });
  });
  var rest = ready.filter(function (d) { return !used[d.id]; });
  if (rest.length) out.push({ title: 'More videos', demos: rest });
  return out;
}
window.rrVideoGroups = rrVideoGroups;

// ─── The player ───────────────────────────────────────────────
// One overlay, on top of the Help Center (which stays open underneath, so
// closing a video lands you back on the list). Two big buttons under the
// picture — Sound and Captions — and both choices are remembered.
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function getOn(key) {
    try { return (typeof _prefGet === 'function' ? _prefGet(key, '0') : localStorage.getItem(key)) === '1'; }
    catch (e) { return false; }
  }
  function setOn(key, on) {
    var v = on ? '1' : '0';
    try {
      if (getOn(key) === on) return;                   // nothing changed — no account write
      if (typeof _prefSet === 'function') _prefSet(key, v); else localStorage.setItem(key, v);
    } catch (e) {}
  }

  function rrPlayVideo(id) {
    var cfg = window.TUTORIAL_GIFS || {};
    var d = null;
    rrReadyDemos().forEach(function (x) { if (x.id === id) d = x; });
    if (!d) return;
    var ex = document.getElementById('rr-video-player'); if (ex) closePlayer(ex);

    var base = (cfg.folder || './videos/') + d.file;
    var ov = document.createElement('div');
    ov.id = 'rr-video-player';
    ov.className = 'rr-vp';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', d.title || 'Help video');
    ov.innerHTML =
      '<div class="rr-vp-box">' +
        '<div class="rr-vp-head">' +
          '<div class="rr-vp-title">' + esc(d.title) + (d.length ? ' <span class="rr-vp-len">' + esc(d.length) + '</span>' : '') + '</div>' +
          '<button type="button" class="rr-vp-x" aria-label="Close">×</button>' +
        '</div>' +
        '<video class="rr-vp-video" controls playsinline preload="metadata" poster="' + esc(base + '.jpg') + '">' +
          '<source src="' + esc(base + '.mp4') + '" type="video/mp4">' +
          '<track kind="captions" srclang="en" label="English" src="' + esc(base + '.vtt') + '">' +
        '</video>' +
        '<div class="rr-vp-bar">' +
          '<button type="button" class="rr-vp-btn" data-vp="sound"></button>' +
          '<button type="button" class="rr-vp-btn" data-vp="cc"></button>' +
        '</div>' +
        (d.description ? '<div class="rr-vp-desc">' + esc(d.description) + '</div>' : '') +
      '</div>';

    var v = ov.querySelector('video');
    var trackEl = ov.querySelector('track');
    var bSound = ov.querySelector('[data-vp="sound"]');
    var bCc = ov.querySelector('[data-vp="cc"]');

    function track() { return (trackEl && trackEl.track) || (v.textTracks && v.textTracks[0]) || null; }
    function draw() {
      var muted = !!v.muted;
      bSound.innerHTML = muted ? '🔇 Sound is off' : '🔊 Sound is on';
      bSound.setAttribute('aria-pressed', muted ? 'false' : 'true');
      var t = track(), cc = !!(t && t.mode === 'showing');
      bCc.innerHTML = '<span class="rr-vp-cc">CC</span> ' + (cc ? 'Captions are on' : 'Captions are off');
      bCc.setAttribute('aria-pressed', cc ? 'true' : 'false');
      bSound.classList.toggle('on', !muted);
      bCc.classList.toggle('on', cc);
    }
    function setCaptions(on) {
      var t = track();
      if (t) t.mode = on ? 'showing' : 'hidden';
    }

    // Start from the remembered choices.
    v.muted = getOn(cfg.prefMuted);
    setCaptions(getOn(cfg.prefCaptions));
    draw();

    bSound.onclick = function () { v.muted = !v.muted; };   // volumechange saves + redraws
    bCc.onclick = function () {
      var t = track();
      var on = !(t && t.mode === 'showing');
      setCaptions(on);
      setOn(cfg.prefCaptions, on);
      draw();
    };
    // The video's own controls can change these too — remember those as well.
    v.addEventListener('volumechange', function () { setOn(cfg.prefMuted, !!v.muted); draw(); });
    if (v.textTracks && v.textTracks.addEventListener) {
      v.textTracks.addEventListener('change', function () {
        var t = track();
        setOn(cfg.prefCaptions, !!(t && t.mode === 'showing'));
        draw();
      });
    }
    // A track element can reset its mode when it loads; put the choice back.
    if (trackEl) trackEl.addEventListener('load', function () { setCaptions(getOn(cfg.prefCaptions)); draw(); });

    // A browser that cannot play the video says so in words, instead of
    // leaving a black box with a spinner.
    var src = ov.querySelector('source');
    if (src) src.addEventListener('error', function () {
      if (ov.querySelector('.rr-vp-err')) return;
      var m = document.createElement('div');
      m.className = 'rr-vp-err';
      m.textContent = 'This video would not play here. Check your internet connection and try again — or open the app in Chrome, Edge or Safari.';
      v.parentNode.insertBefore(m, v.nextSibling);
    });

    var close = function () { closePlayer(ov); };
    ov.querySelector('.rr-vp-x').onclick = close;
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    if (typeof rrDismissGuard === 'function') rrDismissGuard(ov, close);   // Back closes; a stray tap outside does nothing
    document.body.appendChild(ov);
    try { ov.querySelector('.rr-vp-x').focus({ preventScroll: true }); } catch (e) {}
    try { var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }

  // Stop the sound BEFORE the element goes — a removed video can keep
  // playing its audio for a moment in some browsers.
  function closePlayer(ov) {
    try {
      var v = ov.querySelector('video');
      if (v) { v.pause(); v.removeAttribute('src'); Array.prototype.forEach.call(v.querySelectorAll('source'), function (s) { s.remove(); }); v.load(); }
    } catch (e) {}
    if (ov.parentNode) ov.parentNode.removeChild(ov);   // BackStack.wire sees it go and rewinds Back itself
  }

  window.rrPlayVideo = rrPlayVideo;
})();
