/**
 * Bakes public/cat_character.png into a real RGBA sprite atlas.
 *
 * The purchased art ships with the "transparent" background baked in as a grey
 * checkerboard (colour type 2, no alpha). The game canvas cannot matte that
 * reliably per frame, so this script does it once, offline:
 *
 *   - decodes the PNG (deflate + per-scanline unfilter),
 *   - finds the two checker shade centres from a histogram of the border ring,
 *   - flood fills from the border over every pixel that matches either shade,
 *   - feathers the matte 1px into the remaining edge so the cat keeps a soft
 *     outline instead of a stair-stepped one,
 *   - re-encodes as a colour-type-6 PNG.
 *
 * Usage: node scripts/bake-cat-atlas.mjs
 * Deterministic: the same input always produces the same output.
 */
import { inflateSync, deflateSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'public', 'cat_character.png');
const OUT = SRC;

// ---------------------------------------------------------------- PNG decode
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
      if (colorType !== 2 && colorType !== 6) throw new Error(`unsupported colour type ${colorType}`);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const lineStart = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const thisByte = raw[lineStart + x];
      const left = x >= channels ? out[y * stride + x - channels] : 0;
      const up = y > 0 ? out[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? out[(y - 1) * stride + x - channels] : 0;
      let v;
      if (filter === 0) v = thisByte;
      else if (filter === 1) v = thisByte + left;
      else if (filter === 2) v = thisByte + up;
      else if (filter === 3) v = thisByte + ((left + up) >> 1);
      else if (filter === 4) v = thisByte + paeth(left, up, upLeft);
      else throw new Error(`bad filter ${filter}`);
      out[y * stride + x] = v & 0xff;
    }
  }
  // Normalise to RGBA.
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = out[i * channels];
    rgba[i * 4 + 1] = out[i * channels + 1];
    rgba[i * 4 + 2] = out[i * channels + 2];
    rgba[i * 4 + 3] = channels === 4 ? out[i * 4 + 3] : 255;
  }
  return { width, height, rgba, colorType };
}

// ---------------------------------------------------------------- PNG encode
function encodePng(width, height, rgba) {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  // Sub filter per byte keeps the RGBA scanlines small and is trivial to write.
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 1;
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? rgba[y * stride + x - 4] : 0;
      raw[y * (stride + 1) + 1 + x] = (rgba[y * stride + x] - left) & 0xff;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- main
const { width, height, rgba, colorType } = decodePng(await readFile(SRC));
if (colorType === 6) {
  console.log('Already an RGBA atlas, nothing to bake.');
  process.exit(0);
}

const lum = (i) => (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114);
const px = (x, y) => (y * width + x) * 4;

// Measure the two checker shades from the border ring. The cat art clips the
// border too, so min/max would be skewed by its highlights; instead histogram
// the ring's achromatic pixels and take the two dominant luminance peaks - the
// checker squares are flat colours and live in tight bins (~74 and ~100).
const hist = new Uint32Array(256);
const addBorder = (x, y) => {
  const i = px(x, y);
  const spread = Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) - Math.min(rgba[i], rgba[i + 1], rgba[i + 2]);
  if (spread > 12) return;
  hist[Math.round(Math.min(255, Math.max(0, lum(i))))]++;
};
for (let x = 0; x < width; x++) {
  addBorder(x, 0);
  addBorder(x, height - 1);
}
for (let y = 0; y < height; y++) {
  addBorder(0, y);
  addBorder(width - 1, y);
}
// Smooth ±2 bins so anti-aliased straddlers cannot outrank a real shade.
const smooth = new Float64Array(256);
for (let l = 0; l < 256; l++) {
  let s = 0;
  let n = 0;
  for (let d = -2; d <= 2; d++) {
    const k = l + d;
    if (k >= 0 && k < 256) {
      s += hist[k];
      n++;
    }
  }
  smooth[l] = s / n;
}
let bandA = -1;
for (let l = 30; l < 230; l++) {
  if (smooth[l] >= smooth[l - 1] && smooth[l] >= smooth[l + 1] && smooth[l] > 0) {
    if (bandA < 0 || smooth[l] > smooth[bandA]) bandA = l;
  }
}
let bandB = -1;
for (let l = 30; l < 230; l++) {
  if (Math.abs(l - bandA) < 8) continue;
  if (smooth[l] >= smooth[l - 1] && smooth[l] >= smooth[l + 1] && smooth[l] > 0) {
    if (bandB < 0 || smooth[l] > smooth[bandB]) bandB = l;
  }
}
if (bandA < 0 || bandB < 0) throw new Error('could not find the two checker shades');
// Weighted mean of the counts around each peak refines the shade centre.
const shadeAt = (band) => {
  let sum = 0;
  let n = 0;
  for (let l = band - 6; l <= band + 6; l++) {
    if (l < 0 || l > 255) continue;
    sum += l * hist[l];
    n += hist[l];
  }
  return n > 0 ? sum / n : band;
};
const bandLo = Math.min(bandA, bandB);
const bandHi = Math.max(bandA, bandB);
const dark = shadeAt(bandLo);
const light = shadeAt(bandHi);
if (light - dark < 8) throw new Error(`checker shades too close (${dark.toFixed(0)} vs ${light.toFixed(0)})`);

// A background pixel is achromatic grey sitting on either shade. Tolerance
// covers the anti-aliased seam between checker squares (values in between are
// within reach of at least one shade). Grid phase is irrelevant because the
// border flood fill below only clears grey that connects to the outside.
const isBgPixel = (x, y) => {
  const i = px(x, y);
  const l = lum(i);
  const spread = Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) - Math.min(rgba[i], rgba[i + 1], rgba[i + 2]);
  if (spread > 14) return false; // chromatic: the cat's own art
  return Math.abs(l - dark) <= 12 || Math.abs(l - light) <= 12;
};

// Pass 1: mark the checker.
const bg = new Uint8Array(width * height);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (isBgPixel(x, y)) bg[y * width + x] = 1;
  }
}

// Keep only regions that reach the border: interior grey art (the helmet)
// must survive even when it matches a checker tone.
const seen = new Uint8Array(width * height);
const stack = [];
const seed = (x, y) => {
  const p = y * width + x;
  if (!seen[p] && bg[p]) {
    seen[p] = 1;
    stack.push(p);
  }
};
for (let x = 0; x < width; x++) {
  seed(x, 0);
  seed(x, height - 1);
}
for (let y = 0; y < height; y++) {
  seed(0, y);
  seed(width - 1, y);
}
const keep = new Uint8Array(width * height);
while (stack.length) {
  const p = stack.pop();
  keep[p] = 1;
  const x = p % width;
  const y = (p - x) / width;
  if (x > 0) seed(x - 1, y);
  if (x < width - 1) seed(x + 1, y);
  if (y > 0) seed(x, y - 1);
  if (y < height - 1) seed(x, y + 1);
}
bg.set(keep);

// Hole closing: thin anti-aliased seams between checker squares can break the
// flood. Grow into unmatched-but-grey pixels that mostly touch the cleared
// sea, then hand one boundary layer back so we do not eat into the cat.
for (let pass = 0; pass < 2; pass++) {
  const grown = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (bg[p]) {
        grown[p] = 1;
        continue;
      }
      if (!isBgPixel(x, y)) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const qx = x + dx;
          const qy = y + dy;
          if (qx < 0 || qy < 0 || qx >= width || qy >= height) continue;
          if (bg[qy * width + qx]) n++;
        }
      }
      if (n >= 3) grown[p] = 1;
    }
  }
  bg.set(grown);
}

// Pass 2: feather - a kept pixel touching the cleared sea loses half its alpha
// so the outline does not stair-step at game zoom.
const alpha = new Uint8Array(width * height).fill(255);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const p = y * width + x;
    if (bg[p]) {
      alpha[p] = 0;
      continue;
    }
    let touches = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const qx = x + dx;
        const qy = y + dy;
        if (qx < 0 || qy < 0 || qx >= width || qy >= height) continue;
        if (bg[qy * width + qx]) touches++;
      }
    }
    if (touches > 0 && touches <= 4) alpha[p] = 128;
  }
}

for (let p = 0; p < width * height; p++) {
  rgba[p * 4 + 3] = alpha[p];
}

await writeFile(OUT, encodePng(width, height, rgba));
console.log(`Baked ${OUT} (${width}x${height}, dark=${dark.toFixed(0)}, light=${light.toFixed(0)})`);
