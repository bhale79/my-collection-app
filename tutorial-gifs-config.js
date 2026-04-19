// ═══════════════════════════════════════════════════════════════
// tutorial-gifs-config.js — SINGLE SOURCE OF TRUTH for the
// "Watch how it works" section of the Help menu.
//
// Each entry is one GIF demo. Fill in `gifUrl` with a link to an
// externally-hosted GIF (e.g., a GitHub-hosted raw file or a CDN)
// and the Help-menu item becomes clickable. Until then, entries
// render as "coming soon".
//
// To add a new GIF demo:
//   1. Host the GIF somewhere public (GitHub raw, Cloudinary, etc.)
//   2. Add an entry to TUTORIAL_GIFS below with a `gifUrl`
//   3. No other code changes needed — the menu re-renders from config
// ═══════════════════════════════════════════════════════════════

const TUTORIAL_GIFS = {
  sectionTitle:  '\uD83C\uDFAC  Watch how it works',
  sectionNote:   'Short demos. No audio. Playable on phone or desktop.',
  comingSoonBadge: 'Coming soon',

  demos: [
    { id: 'add-item-gif',       title: 'Add an item',         description: 'From "+ Add" to "Saved" in under 30 seconds.',   gifUrl: '' },
    { id: 'add-want-gif',       title: 'Add to Want List',    description: 'Set a target price and track your wants.',        gifUrl: '' },
    { id: 'want-to-col-gif',    title: 'Turn a Want into a Purchase', description: 'One-tap conversion from Want List to Collection.', gifUrl: '' },
    { id: 'list-sale-gif',      title: 'List for Sale',       description: 'Move an item to For Sale and set your price.',   gifUrl: '' },
    { id: 'record-sale-gif',    title: 'Record a Sale',       description: 'Log a sold item and the sale price.',            gifUrl: '' },
    { id: 'insurance-gif',      title: 'Generate an Insurance Report', description: 'Print or save a PDF for your insurance company.', gifUrl: '' },
  ],
};

window.TUTORIAL_GIFS = TUTORIAL_GIFS;

// ─── Render into the Help menu after it's built ──────────────
// tutorial.js builds tut-help-menu once on first open. We mount our
// extra section at the end of that menu, preserving its existing items.
// Safe to re-run (idempotent — checks for existing ID).
(function() {
  'use strict';

  function _renderGifsSection() {
    var menu = document.getElementById('tut-help-menu');
    if (!menu) return false;
    if (document.getElementById('tut-gifs-section')) return true;

    var cfg = window.TUTORIAL_GIFS || {};
    var section = document.createElement('div');
    section.id = 'tut-gifs-section';
    section.style.cssText = 'border-top:1px solid var(--border);margin-top:0.5rem;padding-top:0.5rem';

    var header = document.createElement('div');
    header.className = 'tut-menu-header';
    header.style.cssText = 'font-size:0.85rem;font-weight:700;padding:0.4rem 0.9rem 0.2rem;color:var(--text)';
    header.innerHTML = _escape(cfg.sectionTitle || 'Watch how it works');
    section.appendChild(header);

    if (cfg.sectionNote) {
      var note = document.createElement('div');
      note.style.cssText = 'font-size:0.75rem;color:var(--text-dim);padding:0 0.9rem 0.4rem;font-style:italic';
      note.textContent = cfg.sectionNote;
      section.appendChild(note);
    }

    (cfg.demos || []).forEach(function(d) {
      var btn = document.createElement('button');
      btn.className = 'tut-menu-item';
      btn.disabled = !d.gifUrl;
      btn.style.opacity = d.gifUrl ? '1' : '0.55';
      btn.style.cursor  = d.gifUrl ? 'pointer' : 'not-allowed';
      var badge = d.gifUrl ? '' : '<span style="margin-left:auto;font-size:0.7rem;color:var(--text-dim);font-style:italic">' + _escape(cfg.comingSoonBadge || 'Coming soon') + '</span>';
      btn.innerHTML =
        '<div class="tut-menu-icon" style="background:rgba(139,92,246,0.15)">\uD83C\uDFAC</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-start;flex:1;text-align:left">' +
          '<div>' + _escape(d.title || '') + '</div>' +
          (d.description ? '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem;font-weight:400">' + _escape(d.description) + '</div>' : '') +
        '</div>' +
        badge;
      if (d.gifUrl) btn.onclick = function() { _openGifModal(d); };
      section.appendChild(btn);
    });

    menu.appendChild(section);
    return true;
  }

  function _openGifModal(demo) {
    var ov = document.createElement('div');
    ov.id = 'tut-gif-modal';
    ov.style.cssText =
      'position:fixed;inset:0;background:rgba(10,14,20,0.92);z-index:10020;' +
      'display:flex;align-items:center;justify-content:center;padding:1.5rem';
    ov.innerHTML =
      '<div style="background:var(--surface);border-radius:14px;max-width:720px;width:100%;padding:1.2rem;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.5)">' +
        '<button onclick="document.getElementById(\'tut-gif-modal\').remove()" style="position:absolute;right:0.8rem;top:0.6rem;background:none;border:none;color:var(--text-mid);font-size:1.6rem;cursor:pointer;padding:0.2rem 0.5rem">\u00D7</button>' +
        '<div style="font-family:var(--font-head);font-size:1.15rem;font-weight:700;color:var(--text);margin-bottom:0.6rem">' + _escape(demo.title || '') + '</div>' +
        (demo.description ? '<div style="font-size:0.88rem;color:var(--text-mid);margin-bottom:0.9rem">' + _escape(demo.description) + '</div>' : '') +
        '<img src="' + _escape(demo.gifUrl) + '" alt="' + _escape(demo.title || '') + '" style="width:100%;border-radius:8px;background:#000">' +
      '</div>';
    ov.onclick = function(e) { if (e.target === ov) ov.remove(); };
    document.body.appendChild(ov);
  }

  // Mount when menu is built. Tutorial menu is created lazily on first
  // help-button open, so we poll briefly for it.
  function _mountWhenReady() {
    if (_renderGifsSection()) return;
    var tries = 0;
    var iv = setInterval(function() {
      tries++;
      if (_renderGifsSection() || tries > 20) clearInterval(iv);
    }, 500);
  }

  // Also hook into tutToggleMenu so we render after the menu appears.
  // (Safe on page-load before tutorial.js loads — checked inside.)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _mountWhenReady);
  } else {
    _mountWhenReady();
  }
  // Re-try when the help widget is first clicked
  document.addEventListener('click', function(e) {
    var w = document.getElementById('tut-help-widget');
    if (w && w.contains(e.target)) setTimeout(_renderGifsSection, 100);
  });

  function _escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
})();
