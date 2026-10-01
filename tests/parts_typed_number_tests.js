// ═══════════════════════════════════════════════════════════════
// parts_typed_number_tests.js — v0.9.1856.
//
// [stated] Brad, 2026-10-01, the Mark Part Installed form for the 2338's
// e-unit drum: "if i add a part from the list, there is a part installed
// description and a part number. it should be part # installed, and part
// description." The drum had been TYPED ("Lionel 259E-1 Light Blue E-Unit
// Drum"), so the whole line was saved as the description and the number box
// came up empty.
//
// THE RULES THIS SUITE PROTECTS:
//   1. ONE rule reads a part number out of typed text — `_partsSplitTyped`
//      (app-pages.js) — and both typing points use it: the Need-a-part popup's
//      box (maintenance.js) and the Parts page's Add a Part form.
//   2. What it reads: the first word, or the second after a maker word, that
//      looks like a part number (≤ 2 letters, ≥ 3 digits or ≥ 2 with a dash:
//      259E-1, 100-4, 2343-117, 6304776029, WS-85, AA-0000012). Not "#24",
//      "3", "6-Wheel", "E-Unit", "K-4". The number comes OUT of the
//      description. A bare number typed alone → number only (v1752 rule kept).
//   3. Both forms show the NUMBER first, then the description; the install
//      form fills a blank number from the description the same way.
// The REAL helper runs; every rule is proven able to fail.
// Run:  node tests/parts_typed_number_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const pages = APP('app-pages.js'), maint = APP('maintenance.js');

function liftSplit(src) {
  const i = src.indexOf('var _PARTS_NUM_RX'), j = src.indexOf('// "Is this part already on the list', i);
  if (i < 0 || j < 0) throw new Error('helper not found');
  return new Function(src.slice(i, j) + ';return _partsSplitTyped;')();
}
const split = liftSplit(pages);
const S = t => { const r = split(t); return r.partNum + ' | ' + r.description; };

section('A · the rule, on Brad\'s drum and the shapes parts come in');
ok('"Lionel 259E-1 Light Blue E-Unit Drum" → 259E-1 | Lionel Light Blue E-Unit Drum', S('Lionel 259E-1 Light Blue E-Unit Drum') === '259E-1 | Lionel Light Blue E-Unit Drum', S('Lionel 259E-1 Light Blue E-Unit Drum'));
ok('number first: "259E-1 light blue drum"', S('259E-1 light blue drum') === '259E-1 | light blue drum');
ok('a bare number alone is the number (v1752 rule kept): "2343-117"', S('2343-117') === '2343-117 | ');
ok('a bare number with a # : "#100-42" → 100-42', S('#100-42') === '100-42 | ');
ok('Lionel modern 10-digit: "6304776029 smoke unit"', S('6304776029 smoke unit') === '6304776029 | smoke unit');
ok('MTH: "MTH AA-0000012 traction tire"', S('MTH AA-0000012 traction tire') === 'AA-0000012 | MTH traction tire');
ok('two letters + dash: "WS-85 air whistle"', S('WS-85 air whistle') === 'WS-85 | air whistle');
ok('"100-4 Complete 3 Position E-Unit" — the 3 inside is left alone', S('100-4 Complete 3 Position E-Unit') === '100-4 | Complete 3 Position E-Unit');
ok('a wire gauge is not a number: "#24 Blue Stranded E-Unit Finger Wire"', S('#24 Blue Stranded E-Unit Finger Wire') === ' | #24 Blue Stranded E-Unit Finger Wire');
ok('a count is not a number: "3 Position E-Unit"', S('3 Position E-Unit') === ' | 3 Position E-Unit');
ok('"6-Wheel trucks" is words', S('6-Wheel trucks') === ' | 6-Wheel trucks');
ok('"E-Unit drum", "K-4 shell", "E-1 lever" are words', S('E-Unit drum') === ' | E-Unit drum' && S('K-4 shell') === ' | K-4 shell' && S('E-1 lever') === ' | E-1 lever');
ok('plain words stay as typed', S('pickup roller assembly') === ' | pickup roller assembly');
ok('only the first or second word can be the number: "brass idler gear 2343-117" stays words', S('brass idler gear 2343-117') === ' | brass idler gear 2343-117');
ok('spaces are tidied, blank is blank', S('  Lionel   259E-1   drum ') === '259E-1 | Lionel drum' && S('') === ' | ');

section('B · both typing points use the one rule');
ok('the Need-a-part popup\'s box: _maintPopAddWanted calls _partsSplitTyped and writes its two halves',
   /var split = _partsSplitTyped\(txt\);[\s\S]{0,200}?description: split\.description, partNum: split\.partNum/.test(maint));
ok('…and its private isNum test is gone', !/var isNum = /.test(maint));
ok('the Parts page\'s Add a Part (savePart): a blank number is read out of the description',
   /function savePart\(existingRow\) \{[\s\S]{0,900}?if \(!partNum\.trim\(\)\) \{ var _sp = _partsSplitTyped\(desc\); if \(_sp\.partNum && _sp\.description\) \{ partNum = _sp\.partNum; desc = _sp\.description; \} \}/.test(pages));
ok('the helper is on window for maintenance.js', /window\._partsSplitTyped = _partsSplitTyped/.test(pages));

section('C · the forms: number first, then description');
const inst = pages.slice(pages.indexOf('function _partInstallForm('), pages.indexOf('async function _savePartInstalled('));
ok('install form: "Part # installed" box comes before "Part description"',
   inst.indexOf("id=\"_inst-part\"") > 0 && inst.indexOf("id=\"_inst-part\"") < inst.indexOf("id=\"_inst-desc\"") && /Part # installed/.test(inst) && /Part description \*/.test(inst));
ok('install form: a blank number is read out of the description (the typed drum shows 259E-1)',
   /var _instNum = String\(p\.partNum \|\| ''\), _instDesc = String\(p\.description \|\| ''\);\s*\n\s*if \(!_instNum\.trim\(\)\) \{ var _sp = _partsSplitTyped\(_instDesc\);/.test(inst)
   && /value="' \+ _esc\(_instNum\) \+ '"/.test(inst) && /value="' \+ _esc\(_instDesc\) \+ '"/.test(inst));
const addf = pages.slice(pages.indexOf('function showAddPartModal('), pages.indexOf('async function savePart('));
ok('Add a Part form: the Part Number box comes before Description',
   addf.indexOf('id="_part-num"') > 0 && addf.indexOf('id="_part-num"') < addf.indexOf('id="_part-desc"'));
{
  // run the REAL install form's prefill on the drum row and on a catalog row
  const body = inst.slice(inst.indexOf('var _instNum'), inst.indexOf('var IN ='));
  const pre = new Function('p', '_partsSplitTyped', body + ';return _instNum + " | " + _instDesc;');
  ok('install form, the typed drum row → 259E-1 | Lionel Light Blue E-Unit Drum', pre({ partNum: '', description: 'Lionel 259E-1 Light Blue E-Unit Drum' }, split) === '259E-1 | Lionel Light Blue E-Unit Drum');
  ok('install form, a catalog row keeps its own number and words', pre({ partNum: '100-4', description: 'Complete 3 Position E-Unit' }, split) === '100-4 | Complete 3 Position E-Unit');
  ok('install form, a number-only row stays number-only (description not emptied)', pre({ partNum: '', description: '2343-117' }, split) === ' | 2343-117');
}

section('D · planted offenders are caught');
ok('D1 the v1855 rule (whole line = description) is caught', (() => { const o = pages.replace("if (at < 0) return { partNum: '', description: t };", "return { partNum: '', description: t };"); return liftSplit(o)('Lionel 259E-1 drum').partNum === ''; })());
ok('D2 a rule that takes any digit-word (3, #24) is caught', (() => { const o = pages.replace("return letters <= 2 && (digits >= 3 || (digits >= 2 && /-/.test(t)));", "return letters <= 2;"); const f = liftSplit(o); return f('3 Position E-Unit').partNum !== '' && f('#24 Blue wire').partNum !== ''; })());
ok('D3 the popup going back to its own isNum test is caught', /var isNum = /.test(maint.replace('var split = _partsSplitTyped(txt);', "var isNum = /x/.test(txt); var split = { partNum: isNum ? txt : '', description: isNum ? '' : txt };")));
ok('D4 the install form with the description box first again is caught', (() => { const o = inst.replace('id="_inst-part"', 'id="_inst-partX"'); return !(o.indexOf('id="_inst-part"') > 0 && o.indexOf('id="_inst-part"') < o.indexOf('id="_inst-desc"')); })());

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
