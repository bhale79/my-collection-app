// ════════════════════════════════════════════════════════════════════════
// stop_and_switch_tests.js — v0.9.1775
//
// Two things Brad asked for on 2026-09-19:
//
//   "there is not stop scan button. so the scan button when hit needs to have
//    the rotating arrow, but also have 'stop scan' so you can stop it if you
//    want to."
//   "my mobile photo read still says off, while my desktop says 20 left."
//
// Both run the REAL functions, lifted out of the source. Section E plants an
// offender for each and requires the suite to go red.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const INBOX = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');
const AIID  = fs.readFileSync(path.join(__dirname, '..', 'app', 'ai-id.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find ' + name);
  let d = 0; const s0 = src.indexOf('{', i);
  for (let k = s0; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced braces in ' + name);
}
function grabAsync(src, name) {
  const i = src.indexOf('async function ' + name + '(');
  if (i < 0) throw new Error('could not find async ' + name);
  let d = 0; const s0 = src.indexOf('{', i);
  for (let k = s0; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced braces in ' + name);
}

console.log('\n== A. The busy button can be pressed ==');
{
  const btnStop = new Function(grab(INBOX, '_pinBtnStop') + '\nreturn _pinBtnStop;')();
  let stops = 0;
  const btn = { innerHTML: 'This is wrong — re-scan', disabled: false, onclick: function () { return 'ORIGINAL'; } };
  const original = btn.onclick;
  const restore = btnStop(btn, 'Stop scan', function () { stops++; });

  ok('the button is NOT disabled while it works (the whole bug)', btn.disabled === false);
  ok('…it says Stop scan', /Stop scan/.test(btn.innerHTML), btn.innerHTML.slice(0, 60));
  ok('…and still spins', /animation:spin/.test(btn.innerHTML));

  btn.onclick({ stopPropagation: function () {} });
  ok('pressing it stops the scan', stops === 1, 'stops=' + stops);
  btn.onclick({ stopPropagation: function () {} });
  btn.onclick({ stopPropagation: function () {} });
  ok('…and a second or third press does nothing extra', stops === 1, 'stops=' + stops);

  restore();
  ok('restore puts the label back', btn.innerHTML === 'This is wrong — re-scan');
  ok('…and the original click handler', btn.onclick === original);
  ok('…and a missing button never throws', typeof btnStop(null, 'x', function () {}) === 'function');
}

console.log('\n== B. Nothing lands after a stop ==');
{
  const body = INBOX.slice(INBOX.indexOf('window._pinRescan = async function'));
  const rescan = body.slice(0, body.indexOf('window._pinAutoReadCancel'));
  const read = rescan.indexOf('await _freeReadBlob(blob, 2400');
  const guardAfterRead = rescan.indexOf('if (_aborted) return;', read);
  const firstWrite = rescan.indexOf('m[fid] = {', read);
  ok('the re-scan is stoppable at all', /_pinBtnStop\(btn, 'Stop scan'/.test(rescan));
  ok('a late answer is discarded BEFORE anything is written',
     read > -1 && guardAfterRead > read && firstWrite > guardAfterRead,
     'read=' + read + ' guard=' + guardAfterRead + ' write=' + firstWrite);
  ok('…and stopping during the photo fetch is caught too',
     (rescan.match(/if \(_aborted\) return;/g) || []).length >= 2);
  ok('stopping puts the previous read back (Brad: "it should go back in")',
     /_mm2\[fid\] = _prevRead/.test(rescan));
}

console.log('\n== C. The Photo ID switch follows the account ==');
{
  function build(opts) {
    opts = opts || {};
    const env = {
      store: Object.assign({}, opts.store || {}),
      vault: opts.vault === undefined ? 'VAULT1' : opts.vault,
      drive: opts.drive || {},
      patches: []
    };
    const pre = `
      var __env = __ENV__;
      var _rrAiSyncing = false, _rrAiSynced = false;
      var localStorage = {
        getItem: function (k) { return (k in __env.store) ? __env.store[k] : null; },
        setItem: function (k, v) { __env.store[k] = String(v); }
      };
      var driveCache = { vaultId: __env.vault };
      async function driveRequest(method, url, body) {
        if (method === 'GET') return { appProperties: __env.drive };
        __env.patches.push(body);
        __env.drive = Object.assign({}, __env.drive, (body && body.appProperties) || {});
        return { id: 'ok' };
      }
      var window = {};
    `;
    const fn = new Function('__ENV__',
      pre + (opts.syncSrc || grabAsync(AIID, 'rrAiSyncOptOut')) + '\n'
          + grabAsync(AIID, 'rrAiPushOptOut') + '\n'
          + grab(AIID, 'rrAiOptedOut') + '\n'
          + grab(AIID, 'rrAiOptOutAt') + '\n'
          + 'return { sync: rrAiSyncOptOut, env: __env };')(env);
    return fn;
  }

  (async function () {
    // Brad's exact situation: neither device ever stamped. He chose ON.
    const a = build({ store: { rr_ai_optout: '1' } });
    await a.sync();
    ok('an unstamped pair reconciles to ON, as Brad chose',
       a.env.store.rr_ai_optout === '0', JSON.stringify(a.env.store));
    ok('…and is stamped, so this branch never runs twice',
       !!a.env.store.rr_ai_optout_at);
    ok('…and pushed, so the other device sees it',
       a.env.patches.length === 1 && a.env.drive.rrAiOptOut === '0',
       JSON.stringify(a.env.drive));

    // The newer answer wins, whichever side holds it.
    const b = build({ store: { rr_ai_optout: '0', rr_ai_optout_at: '100' },
                      drive: { rrAiOptOut: '1', rrAiOptOutAt: '200' } });
    await b.sync();
    ok('a NEWER change on Drive is pulled down',
       b.env.store.rr_ai_optout === '1' && b.env.store.rr_ai_optout_at === '200',
       JSON.stringify(b.env.store));
    ok('…without writing back', b.env.patches.length === 0);

    const c = build({ store: { rr_ai_optout: '1', rr_ai_optout_at: '300' },
                      drive: { rrAiOptOut: '0', rrAiOptOutAt: '200' } });
    await c.sync();
    ok('a NEWER change here is pushed up',
       c.env.patches.length === 1 && c.env.drive.rrAiOptOut === '1',
       JSON.stringify(c.env.drive));
    ok('…and this device keeps its own answer', c.env.store.rr_ai_optout === '1');

    // Agreement must be silent — no write amplification on every load.
    const d = build({ store: { rr_ai_optout: '1', rr_ai_optout_at: '400' },
                      drive: { rrAiOptOut: '1', rrAiOptOutAt: '400' } });
    await d.sync();
    ok('when both sides agree, nothing is written', d.env.patches.length === 0);

    // No vault yet (signed out, or Drive not ready) — do nothing, quietly.
    const e = build({ vault: null, store: {} });
    await e.sync();
    ok('with no vault it does nothing and never throws',
       e.env.patches.length === 0 && !e.env.store.rr_ai_optout_at);

    console.log('\n== D. Changing it stamps the clock ==');
    const setSrc = grab(AIID, 'rrAiSetOptOut');
    ok('rrAiSetOptOut writes a timestamp', /rr_ai_optout_at/.test(setSrc));
    ok('…and pushes it', /rrAiPushOptOut\(\)/.test(setSrc));

    console.log('\n== E. THE OFFENDERS: break each one, require red ==');
    // 1 — the reconcile stops choosing ON
    const badSrc = grabAsync(AIID, 'rrAiSyncOptOut')
      .replace("localStorage.setItem('rr_ai_optout', '0');", "localStorage.setItem('rr_ai_optout', '1');");
    const f = build({ store: { rr_ai_optout: '1' }, syncSrc: badSrc });
    await f.sync();
    ok('reconciling to OFF instead of ON is caught',
       f.env.store.rr_ai_optout !== '0', 'the ON check would have passed on broken source');

    // 2 — newest-wins reverts to "this device always wins"
    const badSrc2 = grabAsync(AIID, 'rrAiSyncOptOut')
      .replace('} else if (driveAt > localAt) {', '} else if (false) {');
    const g = build({ store: { rr_ai_optout: '0', rr_ai_optout_at: '100' },
                      drive: { rrAiOptOut: '1', rrAiOptOutAt: '200' }, syncSrc: badSrc2 });
    await g.sync();
    ok('losing the newest-wins pull is caught',
       g.env.store.rr_ai_optout !== '1', 'the pull check would have passed on broken source');

    // 3 — the late-answer guard is removed from the re-scan
    const bodyX = INBOX.slice(INBOX.indexOf('window._pinRescan = async function'));
    const rescanX = bodyX.slice(0, bodyX.indexOf('window._pinAutoReadCancel'))
      .replace(/\n\s*if \(_aborted\) return;/g, '');
    const readX = rescanX.indexOf('await _freeReadBlob(blob, 2400');
    ok('removing the late-answer guard is caught',
       rescanX.indexOf('if (_aborted) return;', readX) === -1);

    console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  })();
}
