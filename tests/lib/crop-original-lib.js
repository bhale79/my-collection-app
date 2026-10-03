// ═══════════════════════════════════════════════════════════════════════════
// crop-original-lib.js — shared by tests/crop_original_tests.js and
// tests/crop_original_more_tests.js (v0.9.1872, "the original is kept").
//
//   makeDrive()      a stand-in Google Drive that lives in Node: files with a
//                    VERSION HISTORY (revisions), appProperties, a request log,
//                    switches to make one call fail, and a DELETE counter. It
//                    answers the exact endpoints the app uses — multipart
//                    create, media PATCH, revisions list/get/update, file
//                    get/patch — so the REAL photo-crop.js and drive.js run
//                    against it unchanged. Nothing in the app is stubbed.
//   openApp(browser, drive, { files })   the real app from file:// in real
//                    Chromium, Cropper 1.6.1 served from tests/fixtures, every
//                    googleapis.com call routed to the stand-in; `files` serves
//                    planted app files by name (the proof a pin can fail).
//   TOOLKIT          in-page helpers: a drawn photo as a File, SHA-256 of a
//                    blob, waiting for the crop screen, setting the box,
//                    pressing the buttons, collecting toasts.
//   sha(buf)         SHA-256 hex in Node, to compare with the page's.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const APP = path.join(__dirname, '..', '..', 'app');
const FIX = path.join(__dirname, '..', 'fixtures');
const CROPPER_JS = fs.readFileSync(path.join(FIX, 'cropper-1.6.1.min.js'));
const CROPPER_CSS = fs.readFileSync(path.join(FIX, 'cropper-1.6.1.min.css'));

function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

// The bytes of each part of a multipart/form-data body, by field name.
function parseMultipart(buf, contentType) {
  const m = /boundary=([^;]+)/.exec(contentType || '');
  if (!m) return {};
  const b = Buffer.from('--' + m[1].replace(/^"|"$/g, ''));
  const out = {};
  let idx = buf.indexOf(b);
  while (idx >= 0) {
    const next = buf.indexOf(b, idx + b.length);
    if (next < 0) break;
    const part = buf.slice(idx + b.length + 2, next - 2);      // after CRLF, before CRLF
    const sep = part.indexOf('\r\n\r\n');
    if (sep > 0) {
      const head = part.slice(0, sep).toString('latin1');
      const name = (/name="([^"]+)"/.exec(head) || [])[1] || ('part' + Object.keys(out).length);
      out[name] = { headers: head, body: part.slice(sep + 4) };
    }
    idx = next;
  }
  return out;
}

function makeDrive() {
  const D = { files: {}, log: [], deletes: 0, fail: {}, _n: 1, _t: 1700000000000 };
  const iso = () => new Date(D._t += 1000).toISOString();
  D.create = function (name, mimeType, bytes, appProperties) {
    const id = 'f' + (D._n++);
    D.files[id] = { id, name, mimeType: mimeType || 'image/jpeg', appProperties: Object.assign({}, appProperties || {}),
      revisions: [{ id: 'r1', modifiedTime: iso(), keepForever: false, bytes: Buffer.from(bytes), mimeType: mimeType || 'image/jpeg' }] };
    return id;
  };
  D.head = f => f.revisions[f.revisions.length - 1];
  D.json = (route, status, obj) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(obj) });
  D.handle = async function (route) {
    const req = route.request();
    const u = new URL(req.url()), m = req.method(), p = u.pathname;
    const entry = { m, path: p, q: u.search };
    D.log.push(entry);
    if (m === 'DELETE') { D.deletes++; return route.fulfill({ status: 204, body: '' }); }
    let mm;
    // create (multipart): the file's FIRST version
    if (m === 'POST' && p === '/upload/drive/v3/files') {
      if (D.fail.create) return D.json(route, 500, { error: { message: 'planted' } });
      const parts = parseMultipart(req.postDataBuffer() || Buffer.alloc(0), req.headers()['content-type']);
      const meta = parts.metadata ? JSON.parse(parts.metadata.body.toString('utf8')) : {};
      const file = parts.file || Object.values(parts).find(x => /image|octet/.test(x.headers)) || { body: Buffer.alloc(0), headers: '' };
      const ct = (/Content-Type:\s*([^\r\n]+)/i.exec(file.headers) || [])[1] || meta.mimeType || 'image/jpeg';
      const id = D.create(meta.name || 'photo.jpg', ct, file.body);
      entry.fileId = id; entry.bytes = file.body.length;
      return D.json(route, 200, { id, name: meta.name, webViewLink: 'https://drive.google.com/file/d/' + id, webContentLink: 'https://drive.google.com/uc?id=' + id });
    }
    // media PATCH: a NEW version on top
    if (m === 'PATCH' && (mm = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(p))) {
      const f = D.files[mm[1]]; if (!f) return D.json(route, 404, { error: { message: 'no file' } });
      if (D.fail.media) return D.json(route, 500, { error: { message: 'planted' } });
      const bytes = req.postDataBuffer() || Buffer.alloc(0);
      f.revisions.push({ id: 'r' + (f.revisions.length + 1), modifiedTime: iso(), keepForever: false, bytes: Buffer.from(bytes), mimeType: req.headers()['content-type'] || 'image/jpeg' });
      entry.fileId = f.id; entry.bytes = bytes.length;
      return D.json(route, 200, { id: f.id });
    }
    // revisions
    if ((mm = /^\/drive\/v3\/files\/([^/]+)\/revisions$/.exec(p)) && m === 'GET') {
      const f = D.files[mm[1]]; if (!f) return D.json(route, 404, { error: { message: 'no file' } });
      if (D.fail.list) return D.json(route, 500, { error: { message: 'planted' } });
      return D.json(route, 200, { revisions: f.revisions.map(r => ({ id: r.id, modifiedTime: r.modifiedTime, keepForever: r.keepForever, size: String(r.bytes.length), mimeType: r.mimeType })) });
    }
    if ((mm = /^\/drive\/v3\/files\/([^/]+)\/revisions\/([^/]+)$/.exec(p))) {
      const f = D.files[mm[1]]; if (!f) return D.json(route, 404, { error: { message: 'no file' } });
      const r = f.revisions.find(x => x.id === mm[2]); if (!r) return D.json(route, 404, { error: { message: 'no revision' } });
      if (m === 'GET' && u.searchParams.get('alt') === 'media') {
        if (D.fail.revGet) return D.json(route, 500, { error: { message: 'planted' } });
        entry.revId = r.id;
        return route.fulfill({ status: 200, contentType: r.mimeType, body: r.bytes });
      }
      if (m === 'PATCH') {
        if (D.fail.protect) return D.json(route, 500, { error: { message: 'planted' } });
        let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
        if (typeof body.keepForever === 'boolean') r.keepForever = body.keepForever;
        entry.revId = r.id; entry.keepForever = r.keepForever;
        return D.json(route, 200, { id: r.id, keepForever: r.keepForever, modifiedTime: r.modifiedTime });
      }
    }
    // the file itself
    if ((mm = /^\/drive\/v3\/files\/([^/]+)$/.exec(p))) {
      const f = D.files[mm[1]]; if (!f) return D.json(route, 404, { error: { message: 'no file' } });
      if (m === 'GET' && u.searchParams.get('alt') === 'media') {
        const h = D.head(f); entry.fileId = f.id; entry.head = h.id;
        return route.fulfill({ status: 200, contentType: h.mimeType, body: h.bytes });
      }
      if (m === 'GET') return D.json(route, 200, { id: f.id, name: f.name, appProperties: Object.assign({}, f.appProperties) });
      if (m === 'PATCH') {
        let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
        if (body.appProperties) Object.keys(body.appProperties).forEach(k => { if (body.appProperties[k] === null) delete f.appProperties[k]; else f.appProperties[k] = String(body.appProperties[k]); });
        entry.fileId = f.id; entry.props = Object.assign({}, body.appProperties || {});
        return D.json(route, 200, { id: f.id });
      }
    }
    entry.unhandled = true;
    return D.json(route, 404, { error: { message: 'stand-in Drive: unhandled ' + m + ' ' + p } });
  };
  // the log since a mark, as compact strings
  D.since = function (k) { return D.log.slice(k).map(e => e.m + ' ' + e.path.replace(/^\/(upload\/)?drive\/v3\//, '') + (e.q && /alt=media/.test(e.q) ? '?alt=media' : '')); };
  return D;
}

async function openApp(browser, drive, opts) {
  opts = opts || {};
  const pg = await browser.newPage({ viewport: { width: opts.w || 1400, height: opts.h || 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (u.startsWith('file://')) {
      if (opts.files) {
        const name = u.split('?')[0].slice(('file://' + APP + '/').length);
        if (Object.prototype.hasOwnProperty.call(opts.files, name)) return r.fulfill({ body: opts.files[name], contentType: /\.css$/.test(name) ? 'text/css' : 'application/javascript' });
      }
      return r.continue();
    }
    if (/cropperjs\/1\.6\.1\/cropper\.min\.js/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: CROPPER_JS });
    if (/cropperjs\/1\.6\.1\/cropper\.min\.css/.test(u)) return r.fulfill({ contentType: 'text/css', body: CROPPER_CSS });
    if (/googleapis\.com/.test(u)) return drive.handle(r);
    return r.abort();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  await pg.evaluate(TOOLKIT);
  return { pg, errs };
}

const TOOLKIT = `(() => {
  window.state = window.state || {}; state.user = state.user || { name: 'T', email: 't@example.com' };
  window.accessToken = 'test-token';
  window.__toasts = [];
  window.showToast = function (m) { window.__toasts.push(String(m)); };
  // a "photo": four flat colour quadrants and a white diagonal band
  window.__photo = function (w, h, q) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    [['#d02020', 0, 0], ['#20b020', w / 2, 0], ['#2040d0', 0, h / 2], ['#e0c020', w / 2, h / 2]].forEach(([col, px, py]) => { x.fillStyle = col; x.fillRect(px, py, w / 2, h / 2); });
    x.strokeStyle = '#fff'; x.lineWidth = Math.round(w / 40); x.beginPath(); x.moveTo(0, 0); x.lineTo(w, h); x.stroke();
    return c.toDataURL('image/jpeg', q || 0.92);
  };
  window.__fileFrom = async function (dataUrl, name, type) {
    const b = await (await fetch(dataUrl)).blob();
    return new File([b], name || 'IMG_0001.jpg', { type: type || 'image/jpeg' });
  };
  window.__sha = async function (blob) {
    const d = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('');
  };
  window.__dims = function (blob) { return new Promise(res => { const im = new Image(); im.onload = () => { res([im.naturalWidth, im.naturalHeight]); URL.revokeObjectURL(im.src); }; im.onerror = () => res(null); im.src = URL.createObjectURL(blob); }); };
  // the crop screen, once Cropper has built; what it shows
  window.__screen = function (maxMs) {
    return new Promise((res, rej) => {
      const t0 = Date.now();
      (function poll() {
        const img = document.getElementById('_rrCropImg');
        const c = img && img.cropper;
        if (c && c.ready) {
          const im = c.getImageData();
          return res({
            hint: (document.getElementById('_rrCropHint') || {}).textContent || '',
            whole: !!(document.getElementById('_rrCropWhole') && document.getElementById('_rrCropWhole').style.display !== 'none'),
            restore: !!document.getElementById('_rrCropRestore'),
            natural: [im.naturalWidth, im.naturalHeight],
            data: c.getData(),
            rot: (document.getElementById('_rrCropRotV') || {}).textContent || '',
          });
        }
        if (Date.now() - t0 > (maxMs || 8000)) return rej(new Error('crop screen did not build'));
        setTimeout(poll, 60);
      })();
    });
  };
  window.__setBox = function (box, rotate) {
    const c = document.getElementById('_rrCropImg').cropper;
    if (typeof rotate === 'number') c.rotateTo(rotate);
    c.setData({ x: box.x, y: box.y, width: box.width, height: box.height });
    return c.getData();
  };
  window.__press = id => { const b = document.getElementById(id); if (!b) throw new Error('no button ' + id); b.click(); };
  window.__open = function (fileId, o) {
    window.__done = null; window.__doneBlob = null;
    return _cropOpenDriveFile(fileId, Object.assign({
      onDone: (ok, blob, kind) => { window.__done = { ok, kind, size: blob ? blob.size : 0 }; window.__doneBlob = blob; },
      onCancel: () => { window.__done = { cancelled: true }; },
    }, o || {}));
  };
  window.__waitDone = function (maxMs) {
    return new Promise((res, rej) => { const t0 = Date.now(); (function poll() { if (window.__done) return res(window.__done); if (Date.now() - t0 > (maxMs || 8000)) return rej(new Error('no onDone')); setTimeout(poll, 50); })(); });
  };
  window.__pixels = async function (blob, step) {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const out = []; for (let i = 0; i < d.length; i += 4 * (step || 97)) out.push(d[i], d[i + 1], d[i + 2]);
    return { w: c.width, h: c.height, px: out };
  };
})()`;

// Serve a planted copy of one app file: `from` must occur exactly once.
function planted(T, file, from, to, label) {
  const src = fs.readFileSync(path.join(APP, file), 'utf8');
  const n = src.split(from).length - 1;
  T('PLANTED ' + (label || file) + ': the anchor is in the source exactly once', n === 1, { file, from: from.slice(0, 80), found: n });
  if (n !== 1) return null;
  const out = {}; out[file] = src.replace(from, to);
  return out;
}

module.exports = { APP, sha, makeDrive, openApp, planted, parseMultipart };
