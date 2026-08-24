// ═══════════════════════════════════════════════════════════════
// line_badge_tests.js — Session 85. The product-LINE badge.
//
// The Williams marking job (S85) wrote Category = "Williams by Bachmann"
// on 73 master rows (60 marks + 13 adds). The variation popup already
// shows the text (Session 112 extraFields); this adds the visible badge
// on browse rows and makes the line searchable. Config-driven so the
// future K-Line by Lionel marker is one config line, zero code.
//
// Run:  node tests/line_badge_tests.js
// Proven to FAIL on v0.9.1575 (commit 226bc66) before the build.
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
function src(f) { return fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8'); }

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

// ── config: lineBadges is a real section with the Williams entry ─
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(src('era-badges-config.js'), ctx);
const CFG = ctx.window.ERA_BADGES;
ok('ERA_BADGES.lineBadges exists', !!(CFG && CFG.lineBadges));
const wb = CFG && CFG.lineBadges && CFG.lineBadges['Williams by Bachmann'];
ok('…with the Williams by Bachmann entry', !!wb);
ok('…whose short label is small enough for a chip', !!wb && String(wb.label || '').length >= 2 && String(wb.label || '').length <= 5, wb && wb.label);

// ── renderer: lineBadgeHTML drives off the row's category ────────
const badges = src('era-badges.js');
ok('lineBadgeHTML exists and is published', /function lineBadgeHTML/.test(badges) && /window\.lineBadgeHTML/.test(badges));
ok('it reads the row CATEGORY, not the tab', /lineBadges\[/.test(badges) && /category/.test(badges));
ok('it is NOT gated to all-eras mode (the line is never obvious from the era dropdown)',
   !/function lineBadgeHTML[\s\S]{0,600}showOnlyInAllMode/.test(badges));
ok('no new hex literals — themed vars only',
   !/function lineBadgeHTML[\s\S]{0,900}#[0-9a-fA-F]{3}/.test(badges));

// ── browse: every era-badge call site also renders the line badge ─
const browse = src('browse.js');
const eraSites = (browse.match(/eraBadgeHTML\(/g) || []).length;
const lineSites = (browse.match(/lineBadgeHTML\(/g) || []).length;
ok('every browse era-badge site carries the line badge (' + eraSites + ' sites)',
   eraSites >= 4 && lineSites >= eraSites, eraSites + ' era vs ' + lineSites + ' line');

// ── search: the line text is findable ───────────────────────────
ok('the master search haystack includes category',
   /haystack = `\$\{item\.itemNum\}[^`]*category/.test(browse));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('LINE-BADGE TESTS FAILING'); process.exit(1); }
console.log('ALL LINE-BADGE TESTS GREEN (' + pass + ')');
