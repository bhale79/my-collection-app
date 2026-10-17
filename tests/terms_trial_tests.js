#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE TERMS PAGE SAYS WHAT SIGN-UP SAYS — v0.9.1956
//
// [stated] Brad, 2026-10-15, told that the terms page said "30 days, full
// features, no card required" while the app's sign-up says 3 weeks with a
// card: "take care of this too. need to add that specials can change terms
// like the free trial".
//
//   T1  the terms page's trial is the app's: 3 weeks, a card to start it, not
//       charged until it ends, cancel before then and pay nothing
//   T2  …and the sign-up screen still counts 21 days and says 3 weeks — the
//       two are compared, so neither can drift alone
//   T3  the terms page says a special (a show price) can change the terms for
//       that purchase, such as replacing the free trial
//   T4  the old "30 days … no card required" is gone; the page says when it
//       was last updated
//   T5  (Brad 2026-10-17, "yes, we can keep the 7 day refund") the terms page's
//       train-show refund window is the sales page's "N days to change your
//       mind" — compared, so neither can drift alone
//   P   PLANTED: the old bullet back → T1/T4 fail; the sign-up changed to
//       30 days → T2 fails; the sales page saying 14 days → T5 fails
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const TERMS = fs.readFileSync(path.join(ROOT, 'terms', 'index.html'), 'utf8');
const VAULT = fs.readFileSync(path.join(ROOT, 'app', 'vault.js'), 'utf8');
// the sales page: the hidden preview until launch day, the root page after it
const SALES_FILE = ['preview-1051ec16/index.html', 'index.html'].map(f => path.join(ROOT, f))
  .find(f => fs.existsSync(f) && /days to change your mind/.test(fs.readFileSync(f, 'utf8')));
const SALES = SALES_FILE ? fs.readFileSync(SALES_FILE, 'utf8') : '';
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 400))); cond ? pass++ : fail++; }

const text = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const trialLine = h => (text(h).match(/Free trial:[^.]*\.[^.]*\.[^.]*\./) || [''])[0];
const signupDays = v => { const m = v.match(/var trialEnd = new Date\(Date\.now\(\) \+ (\d+) \* 864e5\)/); return m ? Number(m[1]) : null; };
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const lastUpdatedOk = t => {                 // a real date, and not older than the 2026-10-15 trial wording
  const m = t.match(/Last updated: (\w+) (\d{1,2}), (\d{4})/); if (!m || MONTHS.indexOf(m[1]) < 0) return false;
  const iso = m[3] + '-' + String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0') + '-' + m[2].padStart(2, '0');
  return iso >= '2026-10-15';
};
const refundDays = (terms, sales) => {
  const a = text(terms).match(/Train-show price refunds:.*?within (\d+) days/), b = sales.match(/(\d+) days to change your mind/g) || [];
  const salesDays = Array.from(new Set(b.map(x => +x.match(/\d+/)[0])));
  return { terms: a ? +a[1] : null, sales: salesDays, ok: !!a && salesDays.length === 1 && salesDays[0] === +a[1] };
};
const checks = (terms, vault) => {
  const t = text(terms), line = trialLine(terms), days = signupDays(vault);
  return {
    t1: /3 weeks/.test(line) && /card is needed to start it/.test(line) && /not charged until the trial ends/.test(line) && /pay nothing/.test(line),
    t2: days === 21 && /Try everything free for 3 weeks/.test(vault) && /3 weeks/.test(line),
    t3: /Specials:/.test(t) && /special can change these terms/.test(t) && /replace the free trial/.test(t) && /train-show price/.test(t),
    t4: !/30 days, full features, no card required/.test(t) && lastUpdatedOk(t),
    line, days,
  };
};

const c = checks(TERMS, VAULT);
T('T1 the terms page\'s trial is the app\'s: 3 weeks, a card to start, not charged until it ends', c.t1, c.line);
T('T2 …and the sign-up screen still counts 21 days and says "3 weeks"', c.t2, { days: c.days, line: c.line });
T('T3 a special (a show price) can change the terms for that purchase, such as the free trial', c.t3);
T('T4 the old "30 days … no card required" is gone; "Last updated" is shown', c.t4);
const r5 = refundDays(TERMS, SALES);
T('T5 the terms\' train-show refund window is the sales page\'s "days to change your mind"', !!SALES_FILE && r5.ok, r5);
const sales14 = SALES.replace(/7 days to change your mind/, '14 days to change your mind');
T('P PLANTED: the sales page saying 14 days while the terms say 7 is caught (T5 would fail)', sales14 !== SALES && !refundDays(TERMS, sales14).ok);
T('P PLANTED: a "Last updated" older than the trial wording is caught (T4 would fail)', !lastUpdatedOk('Last updated: October 1, 2026') && lastUpdatedOk('Last updated: October 17, 2026'));
const oldTerms = TERMS.replace(/<li><b>Free trial:<\/b>[^\n]*<\/li>/, '<li><b>Free trial:</b> 30 days, full features, no card required. One trial per person.</li>');
const p1 = checks(oldTerms, VAULT);
T('P PLANTED: the old trial bullet back is caught (T1 and T4 would fail)', oldTerms !== TERMS && !p1.t1 && !p1.t4);
const oldVault = VAULT.replace('Date.now() + 21 * 864e5', 'Date.now() + 30 * 864e5');
T('P PLANTED: sign-up counting 30 days while the terms say 3 weeks is caught (T2 would fail)', oldVault !== VAULT && !checks(TERMS, oldVault).t2);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('TERMS TRIAL TESTS FAILING'); process.exit(1); }
console.log('ALL TERMS TRIAL TESTS GREEN (' + pass + ')');
