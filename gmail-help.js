// ═══════════════════════════════════════════════════════════════
// gmail-help.js — Phase 0 Gmail help modal.
//
// Content lives in onboarding-config.js (GMAIL_HELP). This file is pure
// rendering + state: show the chooser, show a path, print the steps,
// close the modal. No copy is hardcoded here.
// ═══════════════════════════════════════════════════════════════

(function() {
  var _currentPath = null;   // id of the currently-shown path, or null for chooser

  // Shared styles derived from ONBOARD_UI. Recomputed on open so config
  // changes take effect without a rebuild.
  function _styles() {
    var u = window.ONBOARD_UI || {};
    var body = (u.bodyFontPx    || 18) + 'px';
    var head = (u.headingFontPx || 28) + 'px';
    var btnH = (u.buttonMinHeightPx || 52) + 'px';
    var btnR = (u.buttonRadiusPx    || 12) + 'px';
    var cardR= (u.cardRadiusPx      || 14) + 'px';
    var z    =  u.overlayZIndex     || 9990;
    return { body: body, head: head, btnH: btnH, btnR: btnR, cardR: cardR, z: z };
  }

  // ─── Public entry points ───

  function gmailShowHelp() {
    _currentPath = null;
    _removeExisting();
    var s = _styles();

    var ov = document.createElement('div');
    ov.id = 'gmail-help-overlay';
    ov.style.cssText =
      'position:fixed;inset:0;background:rgba(10,14,20,0.92);z-index:' + s.z +
      ';display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:1.5rem';
    ov.appendChild(_buildChooser());
    document.body.appendChild(ov);
  }
  window.gmailShowHelp = gmailShowHelp;

  function gmailCloseHelp() {
    _removeExisting();
    _currentPath = null;
  }
  window.gmailCloseHelp = gmailCloseHelp;

  function gmailShowPath(pathId) {
    var cfg = window.GMAIL_HELP || {};
    var path = (cfg.paths || []).find(function(p) { return p.id === pathId; });
    if (!path) return;
    _currentPath = pathId;
    var ov = document.getElementById('gmail-help-overlay');
    if (!ov) { gmailShowHelp(); ov = document.getElementById('gmail-help-overlay'); }
    ov.innerHTML = '';
    ov.appendChild(_buildPath(path));
  }
  window.gmailShowPath = gmailShowPath;

  function gmailBackToChooser() {
    _currentPath = null;
    var ov = document.getElementById('gmail-help-overlay');
    if (!ov) return;
    ov.innerHTML = '';
    ov.appendChild(_buildChooser());
  }
  window.gmailBackToChooser = gmailBackToChooser;

  function gmailPrintGuide(pathId) {
    var cfg = window.GMAIL_HELP || {};
    var path = (cfg.paths || []).find(function(p) { return p.id === pathId; });
    if (!path) return;
    var w = window.open('', '_blank', 'width=700,height=900');
    if (!w) { alert('Please allow pop-ups so we can open the printable page.'); return; }
    var stepsHtml = '';
    (path.steps || []).forEach(function(step, i) {
      stepsHtml +=
        '<li style="margin:0.9rem 0;line-height:1.55">' +
          _escape(step.text) +
          (step.link ? '<br><span style="color:#555">Link: ' + _escape(step.link) + '</span>' : '') +
        '</li>';
    });
    var reassure = path.reassurance ? '<p style="background:#f5f0e1;padding:0.9rem;border-radius:6px;border-left:4px solid #b48c3c;font-style:italic">' + _escape(path.reassurance) + '</p>' : '';
    var appReassure = cfg.reassurance ? '<p style="margin-top:1.5rem;color:#555;font-size:14px">' + _escape(cfg.reassurance) + '</p>' : '';
    w.document.write(
      '<!doctype html><html><head><title>Gmail Help \u2014 ' + _escape(path.label) + '</title>' +
      '<meta charset="utf-8">' +
      '<style>' +
        'body{font-family:Georgia,serif;max-width:640px;margin:40px auto;padding:0 20px;color:#222;line-height:1.55}' +
        'h1{font-size:24px;margin-bottom:0.3rem}' +
        'h2{font-size:18px;color:#555;font-weight:normal;margin-top:0}' +
        'ol{padding-left:1.5rem;font-size:17px}' +
        '.footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #ccc;font-size:13px;color:#777;text-align:center}' +
      '</style></head><body>' +
      '<h1>' + _escape(path.label) + '</h1>' +
      '<h2>' + _escape(path.blurb || '') + '</h2>' +
      reassure +
      '<ol>' + stepsHtml + '</ol>' +
      appReassure +
      '<div class="footer">The Rail Roster \u2014 printed ' + new Date().toLocaleDateString() + '</div>' +
      '<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>' +
      '</body></html>'
    );
    w.document.close();
  }
  window.gmailPrintGuide = gmailPrintGuide;

  // ─── Internal rendering ───

  function _buildChooser() {
    var cfg = window.GMAIL_HELP || {};
    var s = _styles();
    var panel = document.createElement('div');
    panel.style.cssText =
      'background:var(--surface);border-radius:' + s.cardR + ';' +
      'max-width:540px;width:100%;padding:1.6rem 1.5rem 1.3rem;' +
      'color:var(--text);font-family:var(--font-body);box-shadow:0 20px 60px rgba(0,0,0,0.45);margin:auto 0';
    var header =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem;margin-bottom:0.8rem">' +
        '<div>' +
          '<div style="font-family:var(--font-head);font-size:' + s.head + ';font-weight:700;color:var(--text);line-height:1.2">' + _escape(cfg.chooserTitle || 'Need help with Gmail?') + '</div>' +
          '<div style="font-size:' + s.body + ';color:var(--text-mid);margin-top:0.4rem;line-height:1.5">' + _escape(cfg.chooserSubtitle || '') + '</div>' +
        '</div>' +
        '<button onclick="gmailCloseHelp()" aria-label="Close" style="background:none;border:none;color:var(--text-mid);font-size:1.6rem;cursor:pointer;padding:0.2rem 0.4rem;line-height:1">\u00D7</button>' +
      '</div>';
    var buttons = '';
    (cfg.paths || []).forEach(function(p) {
      buttons +=
        '<button onclick="gmailShowPath(\'' + p.id + '\')" style="' +
          'display:block;width:100%;margin:0.55rem 0;padding:0.95rem 1rem;' +
          'background:var(--surface2);border:1px solid var(--border);border-radius:' + s.btnR + ';' +
          'color:var(--text);font-family:var(--font-body);font-size:' + s.body + ';font-weight:600;' +
          'text-align:left;cursor:pointer;min-height:' + s.btnH + ';line-height:1.4' +
          '">' + _escape(p.label) + '</button>';
    });
    var reassure = cfg.reassurance ?
      '<div style="margin-top:1rem;padding:0.8rem 1rem;background:rgba(180,140,60,0.08);border-left:3px solid #b48c3c;border-radius:6px;font-size:' + ((window.ONBOARD_UI && window.ONBOARD_UI.smallFontPx) || 15) + 'px;color:var(--text-mid);line-height:1.5">' +
        _escape(cfg.reassurance) + '</div>' : '';
    panel.innerHTML = header + buttons + reassure;
    return panel;
  }

  function _buildPath(path) {
    var cfg = window.GMAIL_HELP || {};
    var s = _styles();
    var panel = document.createElement('div');
    panel.style.cssText =
      'background:var(--surface);border-radius:' + s.cardR + ';' +
      'max-width:600px;width:100%;padding:1.5rem 1.4rem 1.3rem;' +
      'color:var(--text);font-family:var(--font-body);box-shadow:0 20px 60px rgba(0,0,0,0.45);margin:auto 0';

    var header =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem;margin-bottom:0.5rem">' +
        '<button onclick="gmailBackToChooser()" style="background:none;border:none;color:var(--accent);font-size:' + s.body + ';cursor:pointer;padding:0.3rem 0.5rem 0.3rem 0;font-weight:600">' + _escape(cfg.backLabel || '\u2190 Back') + '</button>' +
        '<button onclick="gmailCloseHelp()" aria-label="Close" style="background:none;border:none;color:var(--text-mid);font-size:1.6rem;cursor:pointer;padding:0.2rem 0.4rem;line-height:1">\u00D7</button>' +
      '</div>' +
      '<div style="font-family:var(--font-head);font-size:' + s.head + ';font-weight:700;color:var(--text);line-height:1.2;margin-bottom:0.3rem">' +
        _escape(path.label) +
      '</div>' +
      (path.blurb ? '<div style="font-size:' + s.body + ';color:var(--text-mid);margin-bottom:1rem;line-height:1.5">' + _escape(path.blurb) + '</div>' : '');

    var pathReassure = path.reassurance ?
      '<div style="margin:0.6rem 0 1rem;padding:0.8rem 1rem;background:rgba(180,140,60,0.1);border-left:3px solid #b48c3c;border-radius:6px;font-size:' + s.body + ';color:var(--text);line-height:1.5;font-style:italic">' +
        _escape(path.reassurance) + '</div>' : '';

    var stepsHtml = '';
    if ((path.steps || []).length) {
      stepsHtml += '<ol style="padding-left:1.6rem;margin:0;font-size:' + s.body + ';color:var(--text);line-height:1.6">';
      (path.steps || []).forEach(function(step, i) {
        var linkHtml = step.link
          ? ' <a href="' + _escape(step.link) + '" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600">Open the page \u2197</a>'
          : '';
        var shotHtml = step.screenshot
          ? '<div style="margin-top:0.5rem"><img src="' + _escape(step.screenshot) + '" alt="Step ' + (i+1) + ' screenshot" style="max-width:100%;border-radius:8px;border:1px solid var(--border)"></div>'
          : '';
        stepsHtml +=
          '<li style="margin:0.6rem 0;padding-left:0.3rem">' +
            _escape(step.text) + linkHtml + shotHtml +
          '</li>';
      });
      stepsHtml += '</ol>';
    }

    var actions = '<div style="display:flex;flex-wrap:wrap;gap:0.6rem;margin-top:1.3rem">';
    if ((path.steps || []).length) {
      actions +=
        '<button onclick="gmailPrintGuide(\'' + path.id + '\')" style="' +
          'flex:1;min-width:180px;padding:0.9rem 1rem;background:var(--surface2);' +
          'border:1px solid var(--border);border-radius:' + s.btnR + ';color:var(--text);' +
          'font-family:var(--font-body);font-size:' + s.body + ';font-weight:600;cursor:pointer;min-height:' + s.btnH + '">' +
          _escape(cfg.printLabel || 'Print these steps') +
        '</button>';
    }
    if (path.cta) {
      actions +=
        '<button onclick="gmailCloseHelp()" style="' +
          'flex:1;min-width:180px;padding:0.9rem 1rem;background:var(--accent);' +
          'border:none;border-radius:' + s.btnR + ';color:#fff;' +
          'font-family:var(--font-body);font-size:' + s.body + ';font-weight:700;cursor:pointer;min-height:' + s.btnH + '">' +
          _escape(path.cta) +
        '</button>';
    }
    actions += '</div>';

    panel.innerHTML = header + pathReassure + stepsHtml + actions;
    return panel;
  }

  function _removeExisting() {
    var existing = document.getElementById('gmail-help-overlay');
    if (existing) existing.remove();
  }

  // Very small HTML escaper for the text coming out of config.
  function _escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
