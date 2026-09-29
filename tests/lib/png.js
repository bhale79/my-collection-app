// ══ tests/lib/png.js — a PNG reader and writer with NO dependency (v0.9.1837) ══
//
// The icon suite has to look at pixels: is the corner the manifest's colour, is
// the badge inside Android's safe zone, is the iPhone icon solid. pngjs is in
// package.json, but a suite that needs an npm install to run is a suite that
// sits red for environment reasons (layout-check did, for weeks). Node's own
// zlib is all a PNG needs, so this is ~90 lines instead of a dependency.
//
// Reads what tools/icons/make_icons.py writes — 8-bit RGB (colour type 2) or
// RGBA (6), not interlaced — and refuses anything else loudly, so an icon that
// was hand-swapped for a palette or 16-bit file fails the suite instead of
// being misread. Writes the same two kinds (filter 0 on every row), which is
// all a planted offender needs.
'use strict';
const zlib = require('zlib');

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (function () {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
}

// → { width, height, channels (3|4), data: Buffer (row-major, channels bytes per pixel) }
function decode(buf) {
  if (!buf || buf.length < 8 || !buf.slice(0, 8).equals(SIG)) throw new Error('not a PNG');
  let pos = 8, ihdr = null;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('latin1', pos + 4, pos + 8);
    const body = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), depth: body[8], colour: body[9], interlace: body[12] };
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!ihdr) throw new Error('no IHDR');
  if (ihdr.depth !== 8) throw new Error('unsupported bit depth ' + ihdr.depth);
  if (ihdr.colour !== 2 && ihdr.colour !== 6) throw new Error('unsupported colour type ' + ihdr.colour + ' (want RGB 2 or RGBA 6)');
  if (ihdr.interlace) throw new Error('interlaced PNG not supported');
  const ch = ihdr.colour === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = ihdr.width * ch;
  const out = Buffer.alloc(stride * ihdr.height);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < ihdr.height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v;
      if (f === 0) v = line[i];
      else if (f === 1) v = line[i] + a;
      else if (f === 2) v = line[i] + b;
      else if (f === 3) v = line[i] + ((a + b) >> 1);
      else if (f === 4) v = line[i] + paeth(a, b, c);
      else throw new Error('bad filter ' + f + ' on row ' + y);
      cur[i] = v & 0xff;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { width: ihdr.width, height: ihdr.height, channels: ch, data: out };
}

function pixel(img, x, y) {
  const i = (y * img.width + x) * img.channels;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.channels === 4 ? img.data[i + 3] : 255];
}

function chunk(type, body) {
  const len = Buffer.alloc(4); len.writeUInt32BE(body.length, 0);
  const tb = Buffer.concat([Buffer.from(type, 'latin1'), body]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(tb), 0);
  return Buffer.concat([len, tb, crc]);
}

// encode({ width, height, alpha, px: (x, y) => [r, g, b, a] }) → Buffer
function encode(spec) {
  const ch = spec.alpha ? 4 : 3, stride = spec.width * ch;
  const raw = Buffer.alloc((stride + 1) * spec.height);
  for (let y = 0; y < spec.height; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < spec.width; x++) {
      const p = spec.px(x, y), o = y * (stride + 1) + 1 + x * ch;
      raw[o] = p[0]; raw[o + 1] = p[1]; raw[o + 2] = p[2];
      if (ch === 4) raw[o + 3] = p[3] == null ? 255 : p[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(spec.width, 0); ihdr.writeUInt32BE(spec.height, 4);
  ihdr[8] = 8; ihdr[9] = spec.alpha ? 6 : 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

module.exports = { decode, encode, pixel, crc32 };
