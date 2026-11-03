/**
 * Shared world-art helpers for the canvas stage.
 *
 * The platformer is a vector scene, but a flat vector scene reads as a
 * placeholder. These helpers add the layers that make a 2D world feel like a
 * place: a deep neon skyline with atmospheric perspective, volumetric light,
 * a filmic vignette and a very light grain pass. They are deterministic and
 * cheap enough to run every frame.
 */

const hash01 = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export interface SkylineOptions {
  width: number;
  height: number;
  ridgeBase: number;
  scrollX: number;
  isNight: boolean;
  isGolden: boolean;
  theme: string;
  time: number;
}

const URBAN = /park|suburban|city|downtown|industrial|construction|rooftop|power|highway|space|data|warzone|quantum|harbor|sewer|nuclear|laboratory|underground|roof|station|factory|base|bridge|titan|nexus|omega|infinity|transcendence|ascension|legendary|chaos|apocalypse|armageddon|pandemonium|abyss|oblivion|void/;

/**
 * Three layers of procedural skyline with real silhouettes: setbacks, roof
 * tanks, antennas, neon strips and clustered lit windows. The nearest layer
 * gets a handful of billboards and light streaks so the horizon is never a
 * row of identical rectangles.
 */
export const drawNeonSkyline = (ctx: CanvasRenderingContext2D, o: SkylineOptions) => {
  const { width, height, ridgeBase, scrollX, isNight, isGolden, theme, time } = o;
  const urban = URBAN.test(theme);

  const drawLayer = (
    parallax: number,
    baseH: number,
    alpha: number,
    body: string,
    edge: string,
    windowTint: string,
    seed: number,
    detail: number,
  ) => {
    const span = 320;
    const offset = ((scrollX * parallax) % span + span) % span;
    const count = Math.ceil(width / span) + 3;
    ctx.save();
    for (let i = -1; i < count; i++) {
      const r1 = hash01(seed + i * 3.71);
      const r2 = hash01(seed + i * 7.13 + 5);
      const r3 = hash01(seed + i * 11.9 + 2);
      const w = 38 + r1 * 96;
      const h = baseH * (0.3 + r2 * 0.7);
      const x = i * span - offset + r1 * 58;
      const y = ridgeBase - h;
      if (x + w < -40 || x > width + 40) continue;

      if (urban) {
        // Main mass.
        ctx.globalAlpha = alpha;
        ctx.fillStyle = body;
        ctx.fillRect(x, y, w, h + 6);

        // Setback crown: a narrower upper block on some towers.
        if (r3 > 0.42) {
          const cw = w * (0.38 + r1 * 0.3);
          const ch = 14 + r2 * 26;
          ctx.fillRect(x + (w - cw) / 2, y - ch, cw, ch + 2);
          // Antenna / spire.
          if (r2 > 0.48) {
            ctx.fillRect(x + w / 2 - 1, y - ch - 16 - r1 * 18, 2, 16 + r1 * 18);
          }
        }
        // Rooftop water tank or vent.
        if (r1 > 0.55 && detail > 1) {
          ctx.fillRect(x + w * 0.18, y - 8, 12, 8);
          ctx.fillRect(x + w * 0.2, y - 13, 8, 5);
        }

        // Neon roof edge. It is the single strongest signal that this is a
        // cyber city and not a grey blockout.
        if (detail > 0) {
          ctx.globalAlpha = Math.min(1, alpha * (isNight ? 1.9 : 1.35));
          ctx.fillStyle = edge;
          ctx.fillRect(x, y, w, detail > 1 ? 2 : 1);
        }

        // Window grid. The pattern is deliberately irregular: real towers have
        // dark floors, corner offices and a few rooms with the lights on.
        const lit = isNight ? 0.86 : isGolden ? 0.55 : 0.32;
        ctx.globalAlpha = Math.min(1, alpha * lit);
        ctx.fillStyle = windowTint;
        const cols = Math.max(2, Math.floor(w / 12));
        const rows = Math.max(2, Math.floor(h / 15));
        const cellW = w / cols;
        const cellH = h / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (hash01(seed + i * 2.3 + r * 1.7 + c * 0.9) > 0.56) continue;
            const ww = Math.max(1.5, cellW * 0.42);
            const wh = Math.max(2, cellH * 0.42);
            ctx.fillRect(x + c * cellW + cellW * 0.28, y + r * cellH + cellH * 0.3, ww, wh);
          }
        }

        // Closer layers get billboards and a vertical neon sign.
        if (detail > 1 && r3 > 0.55) {
          const signW = 13 + r1 * 11;
          const signH = 32 + r2 * 38;
          const sx = x + w * (r1 > 0.5 ? 0.72 : 0.12);
          const sy = y + 16 + r3 * 34;
          ctx.globalAlpha = Math.min(1, alpha * 2.2);
          ctx.shadowColor = edge;
          ctx.shadowBlur = 14;
          ctx.fillStyle = edge;
          ctx.fillRect(sx, sy, signW, signH);
          ctx.shadowBlur = 0;
          // A dark inset panel and vertical glyphs read as a neon sign at a
          // glance, without needing a font download.
          ctx.fillStyle = 'rgba(5,8,18,0.68)';
          ctx.fillRect(sx + 2, sy + 2, signW - 4, signH - 4);
          ctx.fillStyle = edge;
          ctx.font = 'bold 7px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.save();
          ctx.translate(sx + signW / 2, sy + signH / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(r3 > 0.78 ? 'NRN' : 'NEON', 0, 0);
          ctx.restore();
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
      } else {
        // Green chapters: layered pine ridges and a few distant cabins.
        const treeH = h * 0.9;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = body;
        const baseY = ridgeBase - 1;
        const trunkW = Math.max(2, w * 0.08);
        ctx.fillRect(x + w * 0.5 - trunkW / 2, baseY - treeH * 0.22, trunkW, treeH * 0.22);
        for (let tier = 0; tier < 3; tier++) {
          const tierTop = baseY - treeH * (1 - tier * 0.27);
          const tierBase = baseY - treeH * (0.4 - tier * 0.12);
          const tierW = w * (0.52 + tier * 0.24);
          ctx.beginPath();
          ctx.moveTo(x + w * 0.5, tierTop);
          ctx.lineTo(x + w * 0.5 + tierW / 2, tierBase);
          ctx.lineTo(x + w * 0.5 - tierW / 2, tierBase);
          ctx.closePath();
          ctx.fill();
        }
        if (detail > 1 && r2 > 0.7) {
          // A tiny lit cabin window on the ridge.
          ctx.globalAlpha = Math.min(1, alpha * 1.8);
          ctx.fillStyle = windowTint;
          ctx.fillRect(x + w * 0.5 + 8, baseY - 10, 4, 5);
        }
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  // Atmospheric perspective: the far layer is almost the colour of the sky,
  // the near layer is nearly black. That is what creates depth.
  if (isNight) {
    drawLayer(0.018, 300, 0.55, '#0b1730', '#4ce8ff', 'rgba(140, 230, 255, 0.6)', 11, 0);
    drawLayer(0.045, 232, 0.8, '#060e24', '#ff4fd8', 'rgba(255, 209, 102, 0.75)', 47, 1);
    drawLayer(0.085, 166, 1, '#02060f', '#2bee79', 'rgba(126, 231, 255, 0.95)', 83, 2);
  } else if (isGolden) {
    drawLayer(0.018, 300, 0.42, '#3a1f42', '#ffb36b', 'rgba(255, 220, 160, 0.6)', 11, 0);
    drawLayer(0.045, 232, 0.62, '#28122e', '#ff8f6b', 'rgba(255, 209, 140, 0.7)', 47, 1);
    drawLayer(0.085, 166, 0.9, '#150a1c', '#ffd166', 'rgba(255, 226, 160, 0.9)', 83, 2);
  } else {
    drawLayer(0.018, 300, 0.34, '#2a6a86', '#9df3ff', 'rgba(255, 250, 220, 0.5)', 11, 0);
    drawLayer(0.045, 232, 0.52, '#17475e', '#5fe6ff', 'rgba(255, 246, 205, 0.6)', 47, 1);
    drawLayer(0.085, 166, 0.82, '#0b2a3a', '#2bee79', 'rgba(255, 236, 180, 0.8)', 83, 2);
  }

  // A few slow airships / drones crossing the sky at night. They add a second
  // scale to the city and a moving light source without competing with play.
  if (isNight) {
    ctx.save();
    for (let i = 0; i < 2; i++) {
      const speed = 9 + i * 5;
      const x = ((time * speed + i * 430) % (width + 240)) - 120;
      const y = 90 + i * 56;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#0b1426';
      ctx.beginPath();
      ctx.ellipse(x, y, 26, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff4fd8';
      ctx.shadowColor = '#ff4fd8';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x + 20, y + 1, 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
};

/** Cached 96x96 monochrome noise tile. */
let noisePattern: CanvasPattern | null = null;
const getNoisePattern = (ctx: CanvasRenderingContext2D) => {
  if (noisePattern) return noisePattern;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const nctx = c.getContext('2d');
  if (!nctx) return null;
  const image = nctx.createImageData(96, 96);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  nctx.putImageData(image, 0, 0);
  noisePattern = ctx.createPattern(c, 'repeat');
  return noisePattern;
};

export interface AtmosphereOptions {
  width: number;
  height: number;
  time: number;
  isNight: boolean;
  isGolden: boolean;
  weather: string;
  reducedMotion: boolean;
  groundY: number;
}

/**
 * Filmic finish: a low fog band, weather veil, vignette and a whisper of
 * grain. Deliberately no light shafts - see the note below. Everything is
 * screen-space and sits under the HTML HUD.
 */
export const drawAtmosphere = (ctx: CanvasRenderingContext2D, o: AtmosphereOptions) => {
  const { width, height, time, isNight, weather, reducedMotion, groundY } = o;

  // No artificial god-rays. The sun/moon lights the sky through the broad,
  // edge-free radial glow drawn in the background pass; hard wedges or cones
  // reaching down onto the playfield read as a lens flare / generated light.

  // Low mist pooling over the ground. It separates the playfield from the
  // background and hides the hard seam where the soil meets the horizon.
  const mist = ctx.createLinearGradient(0, groundY - 90, 0, groundY + 20);
  mist.addColorStop(0, 'rgba(180, 220, 255, 0)');
  mist.addColorStop(0.6, isNight ? 'rgba(110, 170, 220, 0.07)' : 'rgba(230, 248, 255, 0.10)');
  mist.addColorStop(1, 'rgba(180, 220, 255, 0)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, groundY - 90, width, 110);

  // Rain adds a cool veil; snow a soft white one.
  if (weather === 'REGNIGT') {
    ctx.fillStyle = 'rgba(40, 70, 120, 0.10)';
    ctx.fillRect(0, 0, width, height);
  } else if (weather === 'SNÖIGT') {
    ctx.fillStyle = 'rgba(210, 235, 255, 0.06)';
    ctx.fillRect(0, 0, width, height);
  }

  // Top frame: deepens the upper sky so the HUD always has a dark backing and
  // the scene gains a little cinematic contrast.
  const top = ctx.createLinearGradient(0, 0, 0, height * 0.32);
  top.addColorStop(0, 'rgba(2, 5, 14, 0.24)');
  top.addColorStop(1, 'rgba(2, 5, 14, 0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, width, height * 0.32);

  // Bottom frame: a quiet gradient that seats the soil band and keeps the eye
  // on the action instead of the bottom edge of the canvas.
  const bottom = ctx.createLinearGradient(0, height * 0.8, 0, height);
  bottom.addColorStop(0, 'rgba(2, 4, 10, 0)');
  bottom.addColorStop(1, 'rgba(2, 4, 10, 0.38)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, height * 0.8, width, height * 0.2);

  // Vignette.
  const vig = ctx.createRadialGradient(width / 2, height * 0.46, height * 0.32, width / 2, height * 0.5, height * 0.95);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.68, 'rgba(2, 4, 12, 0.14)');
  vig.addColorStop(1, 'rgba(2, 4, 12, 0.52)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  // Grain. Kept under 4% so it adds texture without dulling the neon.
  if (!reducedMotion) {
    const pattern = getNoisePattern(ctx);
    if (pattern) {
      ctx.save();
      ctx.globalAlpha = 0.035;
      ctx.globalCompositeOperation = 'overlay';
      const shift = Math.floor((time * 18) % 96);
      ctx.translate(-shift, -shift);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width + 96, height + 96);
      ctx.restore();
    }
  }
};

/**
 * Cheap bright-pass bloom. The scene is downscaled, contrast-crushed and
 * blurred, then screened back over itself. Only the sun, neon windows, fish
 * and muzzle flashes survive the contrast pass, so the glow lands where it
 * belongs instead of fogging the whole frame.
 */
let bloomBuffer: HTMLCanvasElement | null = null;
export const drawBloom = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  strength = 0.34,
) => {
  const w = 426;
  const h = 240;
  if (!bloomBuffer) {
    bloomBuffer = document.createElement('canvas');
    bloomBuffer.width = w;
    bloomBuffer.height = h;
  }
  const bctx = bloomBuffer.getContext('2d');
  if (!bctx) return;
  bctx.clearRect(0, 0, w, h);
  bctx.filter = 'contrast(2.4) brightness(0.9) blur(3px)';
  bctx.drawImage(source, 0, 0, w, h);
  bctx.filter = 'none';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = strength;
  ctx.drawImage(bloomBuffer, 0, 0, source.width, source.height);
  ctx.restore();
};

/**
 * A neon rim + soft glow along the top edge of a ground slab. Kept separate
 * from the platform body so the same treatment can be used for both natural
 * ground and floating ledges.
 */
export const drawGroundRim = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  color: string,
  alpha = 0.9,
) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 1);
  ctx.lineTo(x + w - 2, y + 1);
  ctx.stroke();
  ctx.restore();
};
