/**
 * Bakes the 2x2 running-cat sheet into four clean RGBA frames.
 *
 * The generated art ships with the "transparent" background baked in as a grey
 * checkerboard and four poses packed into one image. This keys the checker out,
 * finds the gutters between the poses, and writes public/cat_run_0.png ..
 * cat_run_3.png so the runtime only has to load and cycle finished frames.
 *
 * ---------------------------------------------------------------------------
 * Why this was rewritten
 * ---------------------------------------------------------------------------
 * The first version keyed each pose to its own tight box, which produced four
 * canvases of four different sizes (306x170, 309x173, 307x160, 288x177). The
 * renderer draws a frame at a fixed width and derives the height from the
 * image aspect, so those four aspects made the cat grow and shrink by 18 %
 * between frames - a visible pop on every stride - and the ground line moved
 * 17 px, so it also bounced vertically.
 *
 * Two things fix that here:
 *   1. Every frame is written on ONE shared canvas, in sheet space. Same scale,
 *      same origin, ground line identical to the pixel. The runtime can then
 *      draw all four with one transform, and the legs are the only thing that
 *      moves.
 *   2. The matte is leak-proof. The old key accepted ANY neutral grey within
 *      +/-20 of either checker band, and the two bands (72 and 102) are only 30
 *      apart - so the union covered a 70-luminance-wide window that swallowed
 *      the cat's own greys. The helmet (lum 91) sat inside it and was erased
 *      along with the belly, which is why the cat looked moth-eaten against a
 *      dark wall. The flood fill now only accepts a pixel the first time it
 *      touches the background sea, and no dilation pass is allowed to grow
 *      into a pixel that does not match the checker almost exactly.
 *
 * The muzzle position is measured per frame from the blaster's brass ring and
 * written to a manifest, because the pose moves the gun and the old hard-coded
 * 0.925/0.47 put the shot in the wrong place on every stride.
 *
 * Usage: node scripts/bake-run-frames.mjs   (dev server must run on :3000)
 */
import { launchBrowser } from './browser.mjs';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
// The sheet lives in the project's art folder; copy it into public/ just long
// enough to load it same-origin, then remove it so the 750 KB source never
// ships in the build.
const SHEET_SRC = '3D/cat_character_sprite/cat_run_sheet.jpg';
const SHEET_TMP = 'public/cat_run_sheet.jpg';
const SHEET = './cat_run_sheet.jpg';
fs.copyFileSync(SHEET_SRC, SHEET_TMP);

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
// Same-origin so the canvas stays readable (getImageData would throw otherwise).
await page.goto(BASE, { waitUntil: 'domcontentloaded' });

const result = await page.evaluate(async (sheetUrl) => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const img = new Image();
  img.src = sheetUrl;
  await img.decode();

  // Full resolution: the sheet is keyed once, offline, and the frames ship
  // pre-matted, so there is no reason to pay for the rounding a downscale adds
  // to the ground line.
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;

  const at = (x, y) => (y * w + x) * 4;
  const lum = (i) => (d[i] + d[i + 1] + d[i + 2]) / 3;
  const spread = (i) => Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);

  // ---------------------------------------------------------------------
  // MATTE
  // ---------------------------------------------------------------------
  // This is deliberately the same algorithm the standing pose was baked with
  // (scripts/bake-cat-atlas.mjs), because that one already produces a clean
  // cut-out of this exact artwork. It is robust for a reason that matters:
  //
  //   Pass 1 marks EVERY achromatic pixel that sits on either checker shade,
  //   anywhere in the image. It does not care about connectivity, so it cannot
  //   leak and it cannot tunnel.
  //   Pass 2 throws away every marked region that does not reach the image
  //   border. The cat's helmet is marked too - it is grey and close to a
  //   checker shade - but it is enclosed, so it is thrown away, and the cat
  //   survives with its head intact.
  //
  // Earlier attempts here interleaved marking with the flood, which is why they
  // kept either eating the helmet or leaving checker squares inside the animal.
  const hist = new Uint32Array(256);
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) hist[Math.round(clamp(lum(at(x, y)), 0, 255))]++;
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) hist[Math.round(clamp(lum(at(x, y)), 0, 255))]++;
  }
  const smooth = new Float64Array(256);
  for (let l = 0; l < 256; l++) {
    let sum = 0;
    let n = 0;
    for (let o = -2; o <= 2; o++) {
      const k = l + o;
      if (k >= 0 && k < 256) {
        sum += hist[k];
        n++;
      }
    }
    smooth[l] = sum / n;
  }
  let bA = -1;
  for (let l = 8; l < 248; l++) {
    if (smooth[l] >= smooth[l - 1] && smooth[l] >= smooth[l + 1] && smooth[l] > 0) {
      if (bA < 0 || smooth[l] > smooth[bA]) bA = l;
    }
  }
  let bB = -1;
  for (let l = 8; l < 248; l++) {
    if (Math.abs(l - bA) < 8) continue;
    if (smooth[l] >= smooth[l - 1] && smooth[l] >= smooth[l + 1] && smooth[l] > 0) {
      if (bB < 0 || smooth[l] > smooth[bB]) bB = l;
    }
  }
  if (bA < 0 || bB < 0) throw new Error('could not find the two checker shades');
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
  const darkShade = shadeAt(Math.min(bA, bB));
  const lightShade = shadeAt(Math.max(bA, bB));

  // Achromatic grey sitting on either shade. The tolerance covers the
  // anti-aliased seam between checker squares.
  // A checker pixel is FLAT - the two shades are uniform across a whole cell -
  // while the cat is drawn with continuous shading, so its greys always carry a
  // gradient. That difference survives JPEG drift, which is why the window can
  // be wide enough to catch a drifted checker cell without catching any fur:
  // the spread test is doing the discriminating, not the luminance.
  const isBgPixel = (p) => {
    const i = p * 4;
    if (spread(i) > 14) return false;
    const l = lum(i);
    return Math.abs(l - darkShade) <= 16 || Math.abs(l - lightShade) <= 16;
  };
  // Loose variant used only for enclosing already-open background: flat enough
  // to be a checker cell, anywhere in the two-shade neighbourhood.
  const isFlatGrey = (p) => {
    const i = p * 4;
    if (spread(i) > 9) return false;
    const l = lum(i);
    return l >= darkShade - 22 && l <= lightShade + 22;
  };

  const marked = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (isBgPixel(p)) marked[p] = 1;

  // Keep only regions that reach the border. The helmet is marked too, but it
  // is enclosed by fur, so it never reaches the border and is dropped here.
  const reached = new Uint8Array(w * h);
  {
    const stack = [];
    const seed = (p) => {
      if (!reached[p] && marked[p]) {
        reached[p] = 1;
        stack.push(p);
      }
    };
    for (let x = 0; x < w; x++) {
      seed(x);
      seed((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      seed(y * w);
      seed(y * w + w - 1);
    }
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0) seed(p - 1);
      if (x < w - 1) seed(p + 1);
      if (y > 0) seed(p - w);
      if (y < h - 1) seed(p + w);
    }
  }
  const bg = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) bg[p] = reached[p] ? 1 : 0;

  // Close the thin seams between checker squares that break the flood: grow
  // into unmatched-but-grey pixels that mostly touch the cleared sea.
  for (let pass = 0; pass < 2; pass++) {
    const grown = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (bg[p]) {
          grown[p] = 1;
          continue;
        }
        if (!isBgPixel(p)) continue;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const qx = x + dx;
            const qy = y + dy;
            if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
            if (bg[qy * w + qx]) n++;
          }
        }
        if (n >= 3) grown[p] = 1;
      }
    }
    bg.set(grown);
  }

  // Alpha: cleared, or a half-alpha feather on the outline so the cat does not
  // stair-step at game zoom.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (bg[p]) {
        d[p * 4 + 3] = 0;
        continue;
      }
      let touches = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const qx = x + dx;
          const qy = y + dy;
          if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
          if (bg[qy * w + qx]) touches++;
        }
      }
      d[p * 4 + 3] = touches > 0 && touches <= 4 ? 128 : 255;
    }
  }

  // --- Enclosed checker islands -----------------------------------------
  // The border test keeps the helmet, but it also keeps any checker that the
  // cat completely wraps around - the pockets between the legs, under the
  // belly, inside the tail's curl. Those are real background and they show up
  // as checker windows punched through the animal.
  //
  // A checker pocket and the helmet can both be "enclosed grey", so the test
  // cannot be position or connectivity. It is STATISTICS: a checker pocket is
  // bimodal on exactly the two shades (the checker is a flat two-tone pattern),
  // while a drawing of a helmet shades continuously across a range. A component
  // is claimed only if nearly every pixel sits on one of the two shades AND
  // both shades are well represented.
  let islandStats = { islands: 0, px: 0 };
  {
    const visited = new Uint8Array(w * h);
    const kill = new Uint8Array(w * h);
    let islands = 0;
    for (let sy = 0; sy < h; sy++) {
      for (let sx = 0; sx < w; sx++) {
        const sp = sy * w + sx;
        if (visited[sp]) continue;
        // Only start inside a region the border flood refused.
        if (bg[sp]) {
          visited[sp] = 1;
          continue;
        }
        if (!marked[sp] && !isFlatGrey(sp)) continue;
        const pts = [];
        const q = [sp];
        visited[sp] = 1;
        while (q.length) {
          const p = q.pop();
          pts.push(p);
          const x = p % w;
          const y = (p - x) / w;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const np = ny * w + nx;
              if (visited[np]) continue;
              visited[np] = 1;
              // Continue through anything checker-marked.
              if (marked[np] || isFlatGrey(np)) q.push(np);
            }
          }
        }
        if (pts.length < 40) continue;
        let onDark = 0;
        let onLight = 0;
        for (const p of pts) {
          const l = lum(p * 4);
          if (Math.abs(l - darkShade) <= 9) onDark++;
          else if (Math.abs(l - lightShade) <= 9) onLight++;
        }
        const tonal = (onDark + onLight) / pts.length;
        const minority = Math.min(onDark, onLight) / pts.length;
        // Two flat tones, both present, almost nothing in between.
        if (tonal > 0.86 && minority > 0.2) {
          for (const p of pts) kill[p] = 1;
          islands++;
        }
      }
    }
    let n = 0;
    for (let p = 0; p < w * h; p++) {
      if (kill[p] && !bg[p]) {
        bg[p] = 1;
        n++;
      }
    }
    islandStats = { islands, px: n };
    // Re-apply alpha for the newly claimed pixels.
    for (const p of kill) d[p * 4 + 3] = 0;
  }

  // --- Split into the 2x2 cells -----------------------------------------
  // Gutters are the columns/rows with the least ink near the middle.
  const colAlpha = new Int32Array(w);
  const rowAlpha = new Int32Array(h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = d[(y * w + x) * 4 + 3];
      colAlpha[x] += a;
      rowAlpha[y] += a;
    }
  }
  const argmin = (arr, lo, hi) => {
    let bi = lo;
    let bv = Infinity;
    for (let i = lo; i < hi; i++) if (arr[i] < bv) {
      bv = arr[i];
      bi = i;
    }
    return bi;
  };
  const vx = argmin(colAlpha, Math.round(w * 0.35), Math.round(w * 0.65));
  const hy = argmin(rowAlpha, Math.round(h * 0.35), Math.round(h * 0.65));
  const cells = [
    [0, 0, vx, hy],
    [vx, 0, w, hy],
    [0, hy, vx, h],
    [vx, hy, w, h],
  ];

  // --- Strip speckle and the contact shadow by size -----------------------
  // After the matte, anything still opaque outside the cat's main mass is
  // either the soft contact shadow or a surviving checker fleck. Both are
  // SMALL, and both are separate connected components once the cat itself is
  // accounted for - so the robust test is component size, not colour: a
  // component that is a tiny fraction of its cell cannot be any part of a cat
  // whose body is hundreds of pixels wide. This also removes the "shadow
  // islands" that a per-row heuristic kept missing.
  {
    const seen = new Uint8Array(w * h);
    const kill = new Uint8Array(w * h);
    for (let sy = 0; sy < h; sy++) {
      for (let sx = 0; sx < w; sx++) {
        const sp = sy * w + sx;
        if (seen[sp] || d[sp * 4 + 3] === 0) continue;
        // Flood this opaque blob.
        const pts = [];
        const q = [sp];
        seen[sp] = 1;
        while (q.length) {
          const p = q.pop();
          pts.push(p);
          const x = p % w;
          const y = (p - x) / w;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const np = ny * w + nx;
              if (seen[np] || d[np * 4 + 3] === 0) continue;
              seen[np] = 1;
              q.push(np);
            }
          }
        }
        // The cat is one enormous blob per pose (tens of thousands of pixels).
        // Anything smaller than this is debris.
        if (pts.length < 4000) {
          for (const p of pts) kill[p] = 1;
        }
      }
    }
    let n = 0;
    for (let p = 0; p < w * h; p++) {
      if (kill[p]) {
        d[p * 4 + 3] = 0;
        n++;
      }
    }
    if (n) console.log(`  removed ${n} px of speckle / shadow debris`);
  }

  // --- Drop the contact shadow -------------------------------------------
  // Each pose ships a soft elliptical shadow under the paws. The flood does not
  // claim it (it is darker than the background), so it survives as a grey
  // smear. It cannot be separated from the cat by colour - it is neutral grey,
  // and so is the cat's white fur in shade - so it is separated by GEOMETRY:
  // the shadow is the only part of the mark that lies below the paws, and the
  // paws are the lowest point of the animal itself.
  //
  // Per cell: find the lowest row that has a substantial run of clearly
  // non-shadow ink (the paws), then clear everything neutral below it.
  for (const [cx0, cy0, cx1, cy1] of cells) {
    // A "solid" row has pixels that are either bright (white fur) or strongly
    // chromatic (black fur with green neon, the teal blaster) - never merely
    // the flat grey of a shadow.
    const solid = [];
    for (let y = cy0; y < cy1; y++) {
      let n = 0;
      for (let x = cx0; x < cx1; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] === 0) continue;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        const l = (r + g + b) / 3;
        if (l > 150 || mx - mn > 22) n++;
      }
      solid.push(n);
    }
    // Last row with a real footprint: at least 6 such pixels.
    let pawRow = cy0;
    for (let k = 0; k < solid.length; k++) if (solid[k] >= 6) pawRow = cy0 + k;
    for (let y = pawRow + 1; y < cy1; y++) {
      for (let x = cx0; x < cx1; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] === 0) continue;
        const mx = Math.max(d[i], d[i + 1], d[i + 2]);
        const mn = Math.min(d[i], d[i + 1], d[i + 2]);
        // Neutral leftovers below the paws are shadow, never cat.
        if (mx - mn <= 30) d[i + 3] = 0;
      }
    }
  }

  // --- Per-cell bounds ---------------------------------------------------
  // No separate shadow pass: the blurred coarse mask already refuses to cross
  // the soft contact shadow (it is darker than the background level, so the
  // flood stops at its rim), and the dilation finishes the edge.
  const bounds = [];
  for (const [cx0, cy0, cx1, cy1] of cells) {
    let minX = cx1;
    let minY = cy1;
    let maxX = cx0;
    let maxY = cy0;
    for (let y = cy0; y < cy1; y++) {
      for (let x = cx0; x < cx1; x++) {
        if (d[(y * w + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    bounds.push({ minX, minY, maxX, maxY });
  }

  // --- ONE shared frame, anchored on the paws ---------------------------
  // Drawing each pose where it happens to sit on the sheet is not enough: the
  // four poses are drawn at slightly different heights and widths, so copying
  // them verbatim still moves the feet and the centre of mass between frames.
  //
  // Every pose is therefore re-anchored: its own lowest opaque row (the paws)
  // is placed on one shared baseline, and its own bounding-box centre is placed
  // on one shared centre line. The union of the re-anchored boxes, padded a
  // hair for the motion blur on the fastest stride, becomes the frame. What is
  // left moving between the four frames is the legs - which is the point.
  const pad = 4;
  const anchors = cells.map(([, ], idx) => {
    const b = bounds[idx];
    return {
      // Half-width, so the two sides of the cycle stay balanced around the
      // pivot the renderer draws at.
      cx: (b.minX + b.maxX) / 2,
      // +1: maxY is an inclusive pixel index, so the paw line is just past it.
      feet: b.maxY + 1,
      halfW: (b.maxX - b.minX + 1) / 2,
      top: b.minY,
    };
  });
  const maxHalfW = Math.max(...anchors.map((a) => a.halfW));
  const maxAboveFeet = Math.max(...anchors.map((a) => a.feet - a.top));
  // Twice the widest half-width keeps the pivot exactly in the middle of the
  // frame for every pose, mirrored or not.
  const fw = Math.ceil(maxHalfW * 2) + pad * 2;
  // The paw line goes on the LAST row of the frame - no bottom padding. The
  // renderer draws the art upward from the feet, so any transparent strip below
  // the paws becomes a visible drop: the cat sinks into the platform by exactly
  // that many pixels once the frame is scaled. Padding on the left, right and
  // top is harmless; padding under the feet is not.
  const fh = Math.ceil(maxAboveFeet) + pad;
  const baselineY = fh - 1; // shared paw line, on the final row
  const centreX = fw / 2; // shared pivot, in frame pixels

  ctx.putImageData(data, 0, 0);

  // Downscale to the size the game actually draws. The sheet is 1275 px wide
  // and one pose is ~620 px, but the renderer never draws the cat wider than
  // about 90 px, so shipping the native resolution quadrupled the PNG weight
  // (240 KB a frame instead of 55 KB) for detail no one can see. 320 px keeps
  // it comfortably above 2x on a retina screen at that draw size.
  const OUT_W = 320;
  const outScale = Math.min(1, OUT_W / fw);
  const ofw = Math.round(fw * outScale);
  const ofh = Math.round(fh * outScale);

  const frames = cells.map(([cx0, cy0, cx1, cy1], idx) => {
    const b = bounds[idx];
    const a = anchors[idx];
    const c = document.createElement('canvas');
    c.width = ofw;
    c.height = ofh;
    const cctx = c.getContext('2d');
    cctx.imageSmoothingEnabled = true;
    cctx.imageSmoothingQuality = 'high';
    // Place the pose so its paw line and its centre land on the shared ones.
    cctx.drawImage(
      canvas,
      cx0, cy0, cx1 - cx0, cy1 - cy0,
      Math.round((centreX - a.halfW - (b.minX - cx0)) * outScale),
      Math.round((baselineY - (a.feet - cy0)) * outScale),
      Math.round((cx1 - cx0) * outScale), Math.round((cy1 - cy0) * outScale),
    );

    // --- Muzzle: find the blaster's brass ring -------------------------
    // The ring is the warmest, most saturated brass in the pose: high red,
    // medium green, low blue. Search the right half of the pose's own bounds.
    let best = null;
    let bestScore = -1;
    const sx0 = Math.round(b.minX + (b.maxX - b.minX) * 0.55);
    for (let y = b.minY; y <= b.maxY; y++) {
      for (let x = sx0; x <= b.maxX; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] === 0) continue;
        const r = d[i];
        const g = d[i + 1];
        const bl = d[i + 2];
        // Brass: r clearly above b, and warm rather than white.
        const score = r - bl + (r - g) * 0.5 - (r > 240 ? 60 : 0);
        if (r > 120 && r - bl > 45 && score > bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }

    // Pose-local -> frame-local, using the same placement as the draw above.
    const ox = Math.round(centreX - a.halfW - (b.minX - cx0));
    const oy = Math.round(baselineY - (a.feet - cy0));
    const px = (x) => (x - cx0 + ox) / fw;
    const py = (y) => (y - cy0 + oy) / fh;
    // The barrel tip is a little right of the ring's centre; fall back to the
    // old constants if the ring was not found.
    const muzzleX = best ? clamp(px(best.x + (b.maxX - b.minX) * 0.02), 0, 1) : 0.925;
    const muzzleY = best ? clamp(py(best.y), 0, 1) : 0.47;

    return {
      url: c.toDataURL('image/png'),
      w: ofw,
      h: ofh,
      muzzleX,
      muzzleY,
      artW: b.maxX - b.minX + 1,
      artH: b.maxY - b.minY + 1,
      groundY: ofh - 1,
    };
  });

  return { frames, vx, hy, w, h, fw, fh, islandStats };
}, SHEET);

console.log(`sheet ${result.w}x${result.h}  split vx=${result.vx} hy=${result.hy}`);
console.log(`enclosed checker islands cleared: ${result.islandStats.islands} regions, ${result.islandStats.px} px`);
console.log(`shared frame: ${result.fw}x${result.fh}`);
for (let i = 0; i < result.frames.length; i++) {
  const f = result.frames[i];
  const b64 = f.url.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(`public/cat_run_${i}.png`, Buffer.from(b64, 'base64'));
  console.log(
    `  frame ${i}: ${f.w}x${f.h}  art ${f.artW}x${f.artH}  ground=${f.groundY}  muzzle=(${f.muzzleX.toFixed(3)}, ${f.muzzleY.toFixed(3)})`,
  );
}

// The manifest lets the runtime read the per-frame muzzle instead of assuming
// one position for the whole cycle.
fs.writeFileSync(
  'public/cat_run_manifest.json',
  JSON.stringify(
    {
      frameW: result.frames[0].w,
      frameH: result.frames[0].h,
      frames: result.frames.map((f) => ({ muzzleX: +f.muzzleX.toFixed(4), muzzleY: +f.muzzleY.toFixed(4) })),
    },
    null,
    2,
  ),
);
console.log('wrote public/cat_run_0..3.png and cat_run_manifest.json');

fs.rmSync(SHEET_TMP, { force: true });
await browser.close();
