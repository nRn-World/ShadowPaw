/**
 * Shadow Paw - the cartoon world renderer.
 *
 * The stage used to be drawn as a cold, hazy cyberpunk scene: a blue-grey sky,
 * flat rectangular "buildings" and clip-art animals waving at the camera. It
 * read as a placeholder, and the muted palette made the cat blend into the
 * background instead of popping out of it.
 *
 * This module is the replacement. Everything here follows one art direction:
 *
 *   - thick, warm dark outlines on every solid shape (never pure black)
 *   - big, rounded, hand-drawn silhouettes instead of right-angle boxes
 *   - a saturated, sunny palette per chapter family (meadow, forest, snow,
 *     desert, lava, city) instead of one global blue wash
 *   - three depth planes with real atmospheric perspective, plus a soft
 *     inked foreground so the frame has a bottom and a top
 *   - everything animates: grass sways, clouds drift, windows flicker, smoke
 *     curls, and the foreground parallax slides faster than the world
 *
 * All of it is procedural, deterministic and cheap (no per-frame allocation
 * beyond a few gradients), so it runs every frame on a phone.
 */

export type Family =
  | 'meadow'
  | 'forest'
  | 'snow'
  | 'desert'
  | 'lava'
  | 'city'
  | 'ice'
  | 'space'
  | 'night';

export interface Pal {
  skyTop: string;
  skyMid: string;
  skyLow: string;
  haze: string;
  sun: string;
  sunCore: string;
  cloud: string;
  cloudShade: string;
  far: string;
  mid: string;
  near: string;
  ink: string;
  groundTop: string;
  groundBody: string;
  groundDeep: string;
  groundRim: string;
  ledge: string;
  ledgeBody: string;
  ledgeDeep: string;
  ledgeRim: string;
  accent: string;
  accent2: string;
  grass: string;
  grassDark: string;
  starfield: boolean;
  night: boolean;
}

const base = (over: Partial<Pal>): Pal => ({
  skyTop: '#62c7f0',
  skyMid: '#a8e4f7',
  skyLow: '#e4f7fb',
  haze: '#cfeeff',
  sun: '#ffe9a8',
  sunCore: '#fffdf0',
  cloud: '#ffffff',
  cloudShade: '#cfe9f5',
  far: '#9fd0e0',
  mid: '#6fb0c8',
  near: '#3f7f98',
  ink: '#20313f',
  groundTop: '#6ed36a',
  groundBody: '#3f9b4c',
  groundDeep: '#1f5c33',
  groundRim: '#b6f79a',
  ledge: '#f3c980',
  ledgeBody: '#c98f4e',
  ledgeDeep: '#7d5227',
  ledgeRim: '#ffe3aa',
  accent: '#ffd166',
  accent2: '#ff7ab8',
  grass: '#6ed36a',
  grassDark: '#2f8a48',
  starfield: false,
  night: false,
  ...over,
});

export const FAMILY_PALETTES: Record<Family, Pal> = {
  meadow: base({}),
  forest: base({
    skyTop: '#4fb7d6',
    skyMid: '#9ae3d8',
    skyLow: '#e8f8d9',
    haze: '#d5f2ce',
    far: '#9ccfa6',
    mid: '#5fa877',
    near: '#2f734f',
    ink: '#1d3327',
    groundTop: '#77d95f',
    groundBody: '#3d9840',
    groundDeep: '#1c5228',
    groundRim: '#c8ff9f',
    ledge: '#e9b46c',
    ledgeBody: '#a9713c',
    ledgeDeep: '#5f3c1c',
    ledgeRim: '#ffdca0',
  }),
  snow: base({
    skyTop: '#8fc9e8',
    skyMid: '#cbe8f7',
    skyLow: '#f4fbff',
    haze: '#e9f6ff',
    sun: '#ffeecb',
    cloud: '#ffffff',
    cloudShade: '#d5e9f7',
    far: '#cfe4f2',
    mid: '#a6c7dd',
    near: '#7b9cb4',
    ink: '#2a3c4c',
    groundTop: '#ffffff',
    groundBody: '#d9ecf7',
    groundDeep: '#9db9cc',
    groundRim: '#ffffff',
    ledge: '#e8f4fb',
    ledgeBody: '#b7d2e4',
    ledgeDeep: '#7f9db2',
    ledgeRim: '#ffffff',
    grass: '#eaf6ff',
    grassDark: '#b9d4e6',
    accent: '#7ee7ff',
    accent2: '#c3a6ff',
  }),
  desert: base({
    skyTop: '#f2b06a',
    skyMid: '#ffd79a',
    skyLow: '#ffeccd',
    haze: '#ffe2b8',
    sun: '#ffd27a',
    sunCore: '#fff6d8',
    far: '#e3a879',
    mid: '#c8804f',
    near: '#9b5a33',
    ink: '#3a2418',
    groundTop: '#f0c46a',
    groundBody: '#cf9445',
    groundDeep: '#8d5c25',
    groundRim: '#ffe8a8',
    ledge: '#e7b268',
    ledgeBody: '#b97b3f',
    ledgeDeep: '#6f4220',
    ledgeRim: '#ffdda0',
    grass: '#f2cb74',
    grassDark: '#c79a49',
    accent: '#ff9f43',
    accent2: '#ff5f8a',
  }),
  lava: base({
    skyTop: '#3a1030',
    skyMid: '#7a1f3a',
    skyLow: '#d1493a',
    haze: '#ff8a5c',
    sun: '#ffb35c',
    sunCore: '#fff0c0',
    cloud: '#ffb08a',
    cloudShade: '#b8555a',
    far: '#6b2030',
    mid: '#4a1524',
    near: '#2b0c17',
    ink: '#1a0710',
    groundTop: '#5a2a24',
    groundBody: '#3a1816',
    groundDeep: '#200b0c',
    groundRim: '#ff9a4a',
    ledge: '#6b322a',
    ledgeBody: '#421d18',
    ledgeDeep: '#240e0c',
    ledgeRim: '#ffa860',
    grass: '#5a2a24',
    grassDark: '#361413',
    accent: '#ff7043',
    accent2: '#ffd166',
  }),
  city: base({
    skyTop: '#7fd0f0',
    skyMid: '#bfeaf8',
    skyLow: '#eef9ff',
    haze: '#d8f0fb',
    far: '#b6d4e2',
    mid: '#8fb0c4',
    near: '#6a8798',
    ink: '#22303c',
    groundTop: '#6fcf6a',
    groundBody: '#3c9248',
    groundDeep: '#1d5228',
    groundRim: '#c2f9a2',
    accent: '#ffd166',
    accent2: '#ff7ab8',
  }),
  ice: base({
    skyTop: '#6fb8e8',
    skyMid: '#bde6fb',
    skyLow: '#f0fbff',
    haze: '#dff3ff',
    far: '#b4dff2',
    mid: '#88bcd8',
    near: '#5f92b0',
    ink: '#223a4c',
    groundTop: '#eaf9ff',
    groundBody: '#a9d8ee',
    groundDeep: '#6d9fbb',
    groundRim: '#ffffff',
    ledge: '#d6f0fb',
    ledgeBody: '#9ac6dd',
    ledgeDeep: '#638fa8',
    ledgeRim: '#ffffff',
    grass: '#e6f7ff',
    grassDark: '#a8cee2',
    accent: '#7ee7ff',
    accent2: '#9d8cff',
  }),
  space: base({
    skyTop: '#120a30',
    skyMid: '#2a1758',
    skyLow: '#5b2a80',
    haze: '#8a5ab8',
    sun: '#c7a8ff',
    sunCore: '#f4ecff',
    cloud: '#7f5ab0',
    cloudShade: '#4a2e78',
    far: '#2e1a52',
    mid: '#1e1140',
    near: '#100a26',
    ink: '#0a0618',
    groundTop: '#4a3a78',
    groundBody: '#2c2050',
    groundDeep: '#150e2c',
    groundRim: '#b79bff',
    ledge: '#4a3a78',
    ledgeBody: '#311f5c',
    ledgeDeep: '#1a1036',
    ledgeRim: '#c8b0ff',
    grass: '#4a3a78',
    grassDark: '#2a1c4a',
    accent: '#b388ff',
    accent2: '#7ee7ff',
    starfield: true,
    night: true,
  }),
  night: base({
    skyTop: '#1b2450',
    skyMid: '#33386e',
    skyLow: '#6a4a7a',
    haze: '#8a6a9a',
    sun: '#e8ecff',
    sunCore: '#ffffff',
    cloud: '#5a5a86',
    cloudShade: '#3a3a60',
    far: '#2f3560',
    mid: '#242a4c',
    near: '#171b36',
    ink: '#0e1024',
    groundTop: '#2f5a44',
    groundBody: '#1d3c30',
    groundDeep: '#0e211c',
    groundRim: '#68d8a0',
    ledge: '#3a4a60',
    ledgeBody: '#262f40',
    ledgeDeep: '#141a26',
    ledgeRim: '#7ee7ff',
    grass: '#2f5a44',
    grassDark: '#1a3a2e',
    accent: '#7ee7ff',
    accent2: '#ff7ab8',
    starfield: true,
    night: true,
  }),
};

/** Chapter theme -> art family. Ordered: first match wins. */
const FAMILY_RULES: Array<[RegExp, Family]> = [
  [/space|station|quantum|void|omega|infinity|nexus|transcendence|datacenter|ascension|oblivion/, 'space'],
  [/ice|glacier|arctic|snow|alpine|mountain/, 'snow'],
  [/volcano|lava|inferno|hell|hades|tartarus|apocalypse|armageddon|pandemonium|chaos/, 'lava'],
  [/desert|beach|dune|highway|warzone/, 'desert'],
  [/forest|countryside|park|sewer|ruins/, 'forest'],
  [/underground|abyss|nightmare/, 'night'],
  [/city|downtown|rooftop|industrial|harbor|construction|power|nuclear|laboratory|factory|titan|legendary|enlighten/, 'city'],
];

export const familyForTheme = (theme: string): Family => {
  const t = String(theme || '').toLowerCase();
  for (const [pattern, family] of FAMILY_RULES) if (pattern.test(t)) return family;
  return 'meadow';
};

/** Picks a palette, then brightens it when the stage is authored at night. */
export const paletteFor = (theme: string, timeOfDay: string): Pal => {
  const pal = { ...FAMILY_PALETTES[familyForTheme(theme)] };
  const nightStage = timeOfDay === 'NIGHT';
  if (!nightStage || pal.night) return pal;
  // A night city is not a black building site: it keeps the family hue and
  // drops to a deep, saturated evening version of the same palette.
  const mix = (hex: string, to: string, k: number) => blend(hex, to, k);
  return {
    ...pal,
    skyTop: mix(pal.skyTop, '#131a38', 0.72),
    skyMid: mix(pal.skyMid, '#1d2450', 0.62),
    skyLow: mix(pal.skyLow, '#3a3670', 0.5),
    haze: mix(pal.haze, '#2a2a5a', 0.45),
    far: mix(pal.far, '#1e2244', 0.55),
    mid: mix(pal.mid, '#151a36', 0.6),
    near: mix(pal.near, '#0d1128', 0.62),
    ink: '#0b0e20',
    groundTop: mix(pal.groundTop, '#1e3a2e', 0.45),
    groundBody: mix(pal.groundBody, '#12241f', 0.55),
    groundDeep: mix(pal.groundDeep, '#08120f', 0.6),
    ledge: mix(pal.ledge, '#2a3248', 0.55),
    ledgeBody: mix(pal.ledgeBody, '#1a2032', 0.6),
    ledgeDeep: mix(pal.ledgeDeep, '#0b0f1c', 0.6),
    night: true,
    starfield: true,
    sun: '#eef2ff',
    sunCore: '#ffffff',
    cloud: mix(pal.cloud, '#2a2f56', 0.6),
    cloudShade: mix(pal.cloudShade, '#1a1f40', 0.6),
  };
};

/* --------------------------------------------------------------- utils --- */

/**
 * Reads `#rgb`, `#rrggbb`, `rgb(r, g, b)` and `rgba(r, g, b, a)`.
 *
 * Handling the `rgb()` form is not a nicety - `blend()` *returns* `rgb(...)`, so
 * any nested mix (a shade of a blend) used to run this parser on a string it
 * could not read, fall through to NaN and come back as black. Every derived
 * city tone was therefore black, which is why the industrial skyline rendered
 * as near-black slabs no matter what base colours the palette offered.
 */
const hexToRgb = (hex: string): [number, number, number] => {
  const s = String(hex).trim();
  if (s.startsWith('rgb')) {
    const parts = s.slice(s.indexOf('(') + 1, s.indexOf(')')).split(',').map((v) => parseFloat(v));
    return [(parts[0] || 0) | 0, (parts[1] || 0) | 0, (parts[2] || 0) | 0];
  }
  const h = s.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const blend = (a: string, b: string, k: number): string => {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * Math.max(0, Math.min(1, k)));
  return `rgb(${mix(r1, r2)},${mix(g1, g2)},${mix(b1, b2)})`;
};

export const withAlpha = (color: string, a: number): string => {
  if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `,${a})`);
  const [r, g, b] = hexToRgb(color);
  return `rgba(${r},${g},${b},${a})`;
};

/** Stable 0..1 hash. Same input, same output - scenery never flickers. */
const h1 = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/* ---------------------------------------------------------- background --- */

export interface BackdropOptions {
  width: number;
  height: number;
  groundY: number;
  scrollX: number;
  time: number;
  pal: Pal;
  theme: string;
  /** 0 = still, 1 = full animation (reduced-motion turns this off). */
  motion: number;
  /**
   * 0 = broad daylight (windows are just glass), 1 = dark enough for lamps.
   * Derived from the time of day, because a city at noon with every window
   * blazing looks like a switched-on film set.
   */
  lamp?: number;
}

/** Big, rounded, inked hills / towers for one depth plane. */
const drawFarHills = (
  ctx: CanvasRenderingContext2D,
  o: BackdropOptions,
  parallax: number,
  color: string,
  alpha: number,
  height: number,
  baseline: number,
  seed: number,
) => {
  const span = 520;
  const shift = o.scrollX * parallax;
  const firstSlot = Math.floor(shift / span) - 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const count = Math.ceil(o.width / span) + 3;
  for (let k = 0; k < count; k++) {
    const i = firstSlot + k;
    const r = h1(seed + i * 3.77);
    const r2 = h1(seed + i * 8.13);
    const w = 300 + r * 260;
    const h = height * (0.62 + r2 * 0.5);
    const x = i * span - shift + r * 90;
    const y = baseline - h;
    // A soft, rounded hill: a wide arc rather than a triangle, so the horizon
    // reads as land and not as a graph.
    ctx.beginPath();
    ctx.moveTo(x - 40, baseline);
    ctx.bezierCurveTo(x + w * 0.1, y + h * 0.1, x + w * 0.9, y + h * 0.1, x + w + 40, baseline);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
};

/** Rounded cartoon towers for the city family. */
/**
 * Cartoon city: rounded towers with a lit face, a shaded side and an inked rim.
 *
 * The old version was a flat rounded rectangle filled with one colour, with a
 * window grid on top. Next to the meadow's layered trees it read as paper
 * cut-outs pasted on a backdrop - no light direction, no outline, no depth -
 * which is exactly what the player noticed in the industrial chapter. Every
 * volume now gets:
 *
 *   - an inked outline, matching the tree line's thick contour
 *   - a lit left face and a shaded right side, from the same sun as the sky
 *   - a roof edge highlight so the silhouette reads against the sky
 *   - windows that sit inside the lit face, never on the shaded edge
 */
/**
 * City block geometry. Shared with the chimney smoke, which has to land on the
 * exact same rooftop, so this lives outside the draw call.
 *
 * The slots are deliberately tighter and the towers wider than a lone slab:
 * a skyline only reads as a city when the buildings crowd each other and
 * overlap. Evenly spaced rectangles with sky between them read as a bar chart,
 * which is what the industrial chapter looked like before.
 */
const CITY_SPAN = 232;
const cityWidth = (r1: number) => 128 + r1 * 96;
const cityHeight = (r2: number) => 96 + r2 * 236;
const cityOffset = (r1: number) => r1 * 26;

const drawFarTowers = (
  ctx: CanvasRenderingContext2D,
  o: BackdropOptions,
  parallax: number,
  color: string,
  alpha: number,
  baseline: number,
  seed: number,
  detail: number,
) => {
  const span = CITY_SPAN;
  // World-anchored window: a building's shape comes from its world slot, never
  // from the loop counter, or the whole skyline swaps when the offset wraps.
  const shift = o.scrollX * parallax;
  const firstSlot = Math.floor(shift / span) - 1;
  const count = Math.ceil(o.width / span) + 3;
  const ink = withAlpha(o.pal.ink, 0.3 + detail * 0.14);
  // Far layers stay soft: the outline fades out with distance so the skyline
  // has atmospheric perspective instead of a uniform sticker edge.
  const rim = withAlpha(o.pal.ink, 0.1 + detail * 0.2);
  // Volume from the sun, not from darkness: the lit face picks up the sun's own
  // colour, and the shaded side is only mildly darker than the base. Building a
  // tower by multiplying its colour toward the ink turns it into a black slab
  // the moment the palette is warm and mid-dark, which is what happened in the
  // sunset industrial chapter.
  // Light comes from the sun, so the lit face is the base colour pulled toward
  // the sun's own hue, and the shaded side is pulled toward the sky - never
  // toward black. A wall in shadow on a sunset evening reflects the sky.
  // The sun in this backdrop sits in the upper RIGHT (see drawBackdrop), so the
  // right face is the lit one and the left third falls into shadow. Getting the
  // side wrong is what made the skyline read as grey cardboard: the eye trusts
  // the direction of the light before it trusts any amount of detail.
  //
  // Shadow is the wall reflecting the sky, not the wall turned black - on a
  // sunset evening that means a cool violet-grey, which is also what separates
  // the planes from each other. Only the base of the wall meets the ink, and
  // only a little.
  // Three tones off one base: the sun-facing wall picks up the sun's own warmth,
  // the shadowed wall drops toward the ink, and only the outermost edge gets a
  // hot rim. Every tone is a mix of the SAME base, so the plane keeps the value
  // the ladder gave it - the light model adds form, it does not add brightness.
  // (Blending every wall toward white is what flattened the earlier attempt
  // into one lavender wash with no silhouette left.)
  const lit = blend(color, o.pal.sun, 0.2 + detail * 0.04);
  const shade = blend(color, o.pal.ink, 0.12);
  const shadeDark = blend(color, o.pal.ink, 0.3);
  // The recessed crown sits behind the body, so it is always a shade deeper.
  const crownBody = blend(color, o.pal.ink, 0.2);
  // Hot rim where the wall turns into the sun.
  const bounce = blend(color, o.pal.sunCore, 0.34 + detail * 0.06);

  ctx.save();
  ctx.globalAlpha = alpha;
  for (let k = 0; k < count; k++) {
    const i = firstSlot + k;
    const r1 = h1(seed + i * 3.11);
    const r2 = h1(seed + i * 6.9 + 4);
    const r3 = h1(seed + i * 11.3 + 9);
    const w = cityWidth(r1);
    const h = cityHeight(r2);
    const x = i * span - shift + cityOffset(r1);
    const y = baseline - h;
    if (x + w < -80 || x > o.width + 80) continue;

    // A body plus a slightly narrower crown, so the skyline has a silhouette
    // rather than one flat top per building.
    const hasCrown = r3 > 0.45;
    const cw = w * (0.42 + r2 * 0.26);
    const ch = 18 + r1 * 30;
    const bodyTop = y;
    const crownTop = hasCrown ? y - ch : y;
    const r = Math.min(16, w * 0.22);

    const shape = (top: number, width: number, left: number, radius: number) => {
      ctx.beginPath();
      ctx.moveTo(left, baseline);
      ctx.lineTo(left, top + radius);
      ctx.quadraticCurveTo(left, top, left + radius, top);
      ctx.lineTo(left + width - radius, top);
      ctx.quadraticCurveTo(left + width, top, left + width, top + radius);
      ctx.lineTo(left + width, baseline);
      ctx.closePath();
    };

    // Shadowed left face first, then the sunlit right face on top of it, so the
    // two tones meet on a soft edge instead of a hard seam.
    shape(bodyTop, w, x, r);
    ctx.fillStyle = shadeDark;
    ctx.fill();
    ctx.save();
    shape(bodyTop, w, x, r);
    ctx.clip();
    const wall = ctx.createLinearGradient(x, bodyTop, x + w, bodyTop);
    wall.addColorStop(0, shadeDark);
    wall.addColorStop(0.22, shade);
    wall.addColorStop(0.72, lit);
    wall.addColorStop(1, bounce);
    ctx.fillStyle = wall;
    ctx.fillRect(x, bodyTop, w, h + 4);
    // A little sky bounce in the deepest shadow keeps the dark side from
    // reading as an unlit hole.
    const fall = ctx.createLinearGradient(x, bodyTop, x + w * 0.3, bodyTop);
    fall.addColorStop(0, withAlpha(o.pal.skyMid, 0.22));
    fall.addColorStop(1, withAlpha(o.pal.skyMid, 0));
    ctx.fillStyle = fall;
    ctx.fillRect(x, bodyTop, w * 0.3, h + 4);
    const sky = ctx.createLinearGradient(0, bodyTop, 0, baseline);
    sky.addColorStop(0, withAlpha(o.pal.sunCore, 0.1));
    sky.addColorStop(0.45, withAlpha(o.pal.sunCore, 0));
    sky.addColorStop(1, withAlpha(o.pal.ink, 0.08));
    ctx.fillStyle = sky;
    ctx.fillRect(x, bodyTop, w, h + 4);
    ctx.restore();

    const cx0 = x + (w - cw) / 2;
    if (hasCrown) {
      shape(crownTop, cw, cx0, 10);
      ctx.fillStyle = crownBody;
      ctx.fill();
      ctx.save();
      shape(crownTop, cw, cx0, 10);
      ctx.clip();
      const crownWall = ctx.createLinearGradient(cx0, crownTop, cx0 + cw, crownTop);
      crownWall.addColorStop(0, blend(crownBody, o.pal.ink, 0.16));
      crownWall.addColorStop(0.7, crownBody);
      crownWall.addColorStop(1, blend(crownBody, o.pal.sun, 0.3));
      ctx.fillStyle = crownWall;
      ctx.fillRect(cx0, crownTop, cw, ch + 6);
      ctx.restore();
      // Roof lip: a bright edge that separates the crown from the sky.
      ctx.fillStyle = withAlpha(o.pal.sunCore, 0.34);
      ctx.fillRect(cx0 + 2, crownTop + 1.5, cw - 4, 2);
    }

    // Outline the silhouette as one path so the crown and body read as a
    // single building instead of two stacked boxes.
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2 + detail;
    ctx.lineJoin = 'round';
    if (hasCrown) {
      ctx.beginPath();
      ctx.moveTo(x, baseline);
      ctx.lineTo(x, bodyTop + r);
      ctx.quadraticCurveTo(x, bodyTop, x + r, bodyTop);
      ctx.lineTo(cx0, bodyTop);
      ctx.lineTo(cx0, crownTop + 10);
      ctx.quadraticCurveTo(cx0, crownTop, cx0 + 10, crownTop);
      ctx.lineTo(cx0 + cw - 10, crownTop);
      ctx.quadraticCurveTo(cx0 + cw, crownTop, cx0 + cw, crownTop + 10);
      ctx.lineTo(cx0 + cw, bodyTop);
      ctx.lineTo(x + w - r, bodyTop);
      ctx.quadraticCurveTo(x + w, bodyTop, x + w, bodyTop + r);
      ctx.lineTo(x + w, baseline);
    } else {
      shape(bodyTop, w, x, r);
    }
    ctx.stroke();

    // Lit roof edge.
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.34, bodyTop + 1);
    ctx.lineTo(x + w - r, bodyTop + 1);
    ctx.stroke();

    if (hasCrown && r1 > 0.55) {
      // Antenna with a blinking tip light - the one moving detail far away.
      ctx.strokeStyle = withAlpha(o.pal.ink, 0.45 + detail * 0.2);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, crownTop);
      ctx.lineTo(x + w / 2, crownTop - 22);
      ctx.stroke();
      const blink = 0.5 + 0.5 * Math.sin(o.time * 2.4 + i * 1.7);
      ctx.globalAlpha = alpha * (0.3 + blink * 0.7);
      ctx.fillStyle = '#ff7a7a';
      ctx.beginPath();
      ctx.arc(x + w / 2, crownTop - 24, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
    }

    // Warm windows, kept inside the lit face. They breathe on a slow cycle so
    // the skyline feels inhabited without strobing.
    if (detail > 0) {
      const cols = Math.max(2, Math.floor(w / 24));
      const rows = Math.max(2, Math.floor(h / 30));
      const cwid = w / cols;
      const chei = h / rows;
      for (let rr = 0; rr < rows; rr++) {
        for (let cc = 0; cc < cols; cc++) {
          if (cc === 0) continue; // leave the shaded edge clean
          const base = h1(seed + i * 2.3 + rr * 1.7 + cc * 0.93);
          // Most windows are dark. A fully lit facade reads as graph paper;
          // a scattered handful reads as a city where people live.
          if (base < 0.58) continue;
          // Each window fades in and out on its own long period.
          const flicker = 0.62 + 0.38 * Math.sin(o.time * (0.5 + base) + base * 30);
          // A lit window is a lamp at dusk, so it is a warm pane with a soft
          // halo around it. A plain pale square reads as a gap in the wall.
          // A little per-window jitter: a perfect grid is the one thing that
          // makes a cartoon city look machine-drawn.
          const jx = (h1(base * 91 + cc) - 0.5) * cwid * 0.12;
          const jy = (h1(base * 57 + rr) - 0.5) * chei * 0.1;
          const wx = x + cc * cwid + cwid * 0.24 + jx;
          const wy = y + rr * chei + chei * 0.26 + jy;
          const ww = cwid * 0.46;
          const wh = chei * 0.4;
          const lamp = o.lamp ?? 1;
          const warm = base > 0.82 ? o.pal.accent : '#ffd98a';
          // Daylight: the pane is plain dark glass, no halo, no glow.
          if (lamp < 0.5) {
            ctx.globalAlpha = alpha * 0.16;
            ctx.fillStyle = o.pal.ink;
            ctx.beginPath();
            ctx.roundRect(
              x + cc * cwid + cwid * 0.24,
              y + rr * chei + chei * 0.26,
              cwid * 0.46,
              chei * 0.4,
              1.5,
            );
            ctx.fill();
            continue;
          }
          ctx.globalAlpha = alpha * (0.14 + flicker * 0.2);
          ctx.fillStyle = warm;
          ctx.beginPath();
          ctx.roundRect(wx - ww * 0.6, wy - wh * 0.6, ww * 2.2, wh * 2.2, 4);
          ctx.fill();
          ctx.globalAlpha = alpha * (0.78 + flicker * 0.22);
          // Drawn opaque and faded only by globalAlpha - never by alpha inside
          // its own colour, which stacked two transparencies into grey.
          ctx.fillStyle = warm;
          ctx.beginPath();
          ctx.roundRect(wx, wy, ww, wh, 1.5);
          ctx.fill();
        }
      }
      ctx.globalAlpha = alpha;
    }
  }
  ctx.restore();
};

/**
 * A layered tree line. Two silhouettes share the strip: a round, friendly
 * broadleaf and a stacked pine. Both are built from overlapping arcs with a
 * visible trunk, because a single triangle reads as a traffic cone.
 */
const drawTreeLine = (
  ctx: CanvasRenderingContext2D,
  o: BackdropOptions,
  parallax: number,
  color: string,
  alpha: number,
  baseline: number,
  seed: number,
  scale: number,
) => {
  // World-anchored slots. Hashing the loop index meant every tree changed
  // species the moment the parallax offset wrapped - the background visibly
  // swapping mid-level as the player ran.
  const span = 200;
  const shift = o.scrollX * parallax;
  const firstSlot = Math.floor(shift / span) - 1;
  const count = Math.ceil(o.width / span) + 3;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  for (let k = 0; k < count; k++) {
    const i = firstSlot + k;
    const r1 = h1(seed + i * 2.71);
    const r2 = h1(seed + i * 7.91 + 3);
    const r3 = h1(seed + i * 11.7 + 8);
    const pine = r3 > 0.45;
    const hBase = (74 + r1 * 74) * scale;
    const wBase = (36 + r2 * 26) * scale;
    const x = i * span - shift + r1 * 70 + wBase * 0.5;
    if (x + wBase < -60 || x - wBase > o.width + 60) continue;
    // Trees used to sway on a per-index sine. In a parallax layer that is real
    // scrolling, a whole tree line leaning back and forth reads as the screen
    // wobbling, so the trunks are anchored now. A fixed lean per tree still
    // keeps the line from looking ruler-straight.
    const sway = (r1 - 0.5) * 3.2;

    // Trunk.
    ctx.lineWidth = 7 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, baseline);
    ctx.quadraticCurveTo(x + sway * 0.4, baseline - hBase * 0.22, x + sway, baseline - hBase * 0.4);
    ctx.stroke();

    if (pine) {
      // Three stacked, rounded boughs, each wider than the one above.
      for (let tier = 0; tier < 3; tier++) {
        const ty = baseline - hBase * (0.38 + tier * 0.22);
        const tw = wBase * (1.15 - tier * 0.26);
        const th = hBase * 0.32;
        ctx.beginPath();
        ctx.moveTo(x + sway - tw, ty + th);
        ctx.quadraticCurveTo(x + sway - tw * 0.55, ty + th * 0.15, x + sway, ty - th * 0.45);
        ctx.quadraticCurveTo(x + sway + tw * 0.55, ty + th * 0.15, x + sway + tw, ty + th);
        // Rounded underside so the bough has weight.
        ctx.quadraticCurveTo(x + sway, ty + th * 1.22, x + sway - tw, ty + th);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // A round crown: one big blob plus two side lobes, slightly squashed.
      const cy = baseline - hBase * (0.62 + r2 * 0.1);
      const cr = wBase * 0.92;
      ctx.beginPath();
      ctx.ellipse(x + sway, cy, cr, cr * 0.86, 0, 0, Math.PI * 2);
      ctx.ellipse(x + sway - cr * 0.72, cy + cr * 0.3, cr * 0.6, cr * 0.52, 0, 0, Math.PI * 2);
      ctx.ellipse(x + sway + cr * 0.74, cy + cr * 0.26, cr * 0.58, cr * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
};

/** Rolling sand / snow dunes. */
const drawDunes = (
  ctx: CanvasRenderingContext2D,
  o: BackdropOptions,
  parallax: number,
  color: string,
  alpha: number,
  baseline: number,
  seed: number,
  amp: number,
) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-20, o.height);
  for (let x = -20; x <= o.width + 40; x += 12) {
    const wx = x + o.scrollX * parallax;
    const y = baseline - Math.sin(wx * 0.0042 + seed) * amp - Math.cos(wx * 0.0091 + seed * 2) * amp * 0.42;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(o.width + 20, o.height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

/**
 * A flat, wide cartoon cloud. One silhouette, one body tone and one soft
 * underside band - a few overlapping circles read as a cluster of bubbles,
 * which is why this is a single merged shape.
 */
const drawToonCloud = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  pal: Pal,
  seed: number,
) => {
  const wobble = (h1(seed * 3.9) - 0.5) * 10;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  // Shadow tone slightly below the body, then the body on top.
  const blob = (dy: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(-104, 18 + dy);
    ctx.bezierCurveTo(-104, -2 + dy, -74, -8 + dy, -58, -6 + dy);
    ctx.bezierCurveTo(-56, -30 + dy, -20, -36 + dy, -6, -20 + dy);
    ctx.bezierCurveTo(10, -44 + dy, 54, -38 + dy, 58, -10 + dy);
    ctx.bezierCurveTo(84, -12 + dy, 104, 0 + dy, 104, 18 + dy);
    ctx.closePath();
    ctx.fill();
  };
  blob(3 + wobble * 0.1, pal.cloudShade);
  blob(0, pal.cloud);
  ctx.restore();
};

/**
 * Chimney smoke: a short trail of soft puffs that lifts, widens and fades.
 *
 * It is the one thing in the city that moves upward, which is what makes a
 * skyline read as inhabited instead of as a still image with a camera panning
 * over it. Drawn deterministically from time, so it costs nothing and cannot
 * drift out of sync with the rest of the scene.
 */
const drawSmoke = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  scale: number,
  tint: string,
) => {
  ctx.save();
  for (let i = 0; i < 6; i++) {
    // Each puff starts a little later, rises a little further and spreads a
    // little wider, so the column leans and dissolves as it climbs. A puff's
    // life also wraps slightly off-phase, which keeps the plume continuous
    // instead of popping back to the chimney.
    const life = ((t * 0.17 + i * 0.167) % 1);
    const rise = life * 96 * scale;
    const drift = Math.sin(life * 2.4 + i) * 13 * scale + life * 30 * scale;
    const r = (6 + life * 20) * scale;
    // Thick at the chimney, gone by the top: a plume, not a string of beads.
    const alpha = (1 - life) * (1 - life) * 0.5;
    if (alpha <= 0.01) continue;
    ctx.fillStyle = withAlpha(tint, alpha);
    ctx.beginPath();
    ctx.arc(x + drift, y - rise, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

/**
 * The whole stage backdrop: sky, sun, clouds, three parallax planes and the
 * inked foreground frame. Drawn under every gameplay layer.
 */
export const drawBackdrop = (ctx: CanvasRenderingContext2D, o: BackdropOptions) => {
  const { width, height, groundY, pal } = o;
  const fam = familyForTheme(o.theme);
  const motion = o.motion;

  // --- sky ---------------------------------------------------------------
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, pal.skyTop);
  sky.addColorStop(0.55, pal.skyMid);
  sky.addColorStop(1, pal.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Sun / moon: one soft halo plus a flat, bright disc. A single light source
  // for the whole scene is what makes the art feel lit instead of painted.
  const sunX = width * (pal.night ? 0.78 : 0.71);
  const sunY = height * (pal.night ? 0.19 : 0.22);
  const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, height * 0.42);
  halo.addColorStop(0, withAlpha(pal.sun, pal.night ? 0.22 : 0.3));
  halo.addColorStop(0.45, withAlpha(pal.sun, 0.06));
  halo.addColorStop(1, withAlpha(pal.sun, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);

  if (pal.night) {
    // A cartoon crescent: bright disc, then a sky-coloured bite taken out of
    // the upper right. Drawing it with fills (instead of composite modes)
    // keeps it portable and bug-free in every browser.
    const mr = 40;
    ctx.fillStyle = pal.sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.skyTop;
    ctx.beginPath();
    ctx.arc(sunX + 17, sunY - 11, mr * 0.92, 0, Math.PI * 2);
    ctx.fill();
    // A couple of faint craters on the lit sliver.
    ctx.fillStyle = withAlpha('#b9c6dd', 0.35);
    ctx.beginPath();
    ctx.arc(sunX - 18, sunY + 8, 5, 0, Math.PI * 2);
    ctx.arc(sunX - 9, sunY + 22, 3.4, 0, Math.PI * 2);
    ctx.arc(sunX - 24, sunY - 8, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = pal.sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 46, 0, Math.PI * 2);
    ctx.fill();
    // Outer ring of the disc: a slightly warmer edge, no outline.
    ctx.strokeStyle = withAlpha(pal.sun, 0.9);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 46, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --- stars -------------------------------------------------------------
  if (pal.starfield) {
    ctx.save();
    for (let layer = 0; layer < 2; layer++) {
      const size = 0.9 + layer * 0.8;
      const drift = o.time * (1.4 + layer * 2.4) * motion;
      for (let i = 0; i < 34; i++) {
        const seed = i + layer * 61;
        const sx = (((h1(seed) * width + drift) % width) + width) % width;
        const sy = h1(seed * 2.17 + 5) * height * 0.55;
        const twinkle = 0.55 + 0.45 * Math.sin(o.time * (1.2 + h1(seed * 3.1)) + seed);
        ctx.fillStyle = `rgba(255,255,255,${(0.35 + layer * 0.2) * twinkle})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // --- clouds ------------------------------------------------------------
  ctx.save();
  const cloudSpan = width + 520;
  const clouds: Array<[number, number, number]> = [
    [0.08, 0.2, 0.85],
    [0.5, 0.31, 0.6],
    [0.76, 0.15, 0.72],
  ];
  clouds.forEach(([start, yPct, scale], i) => {
    const speed = 7 + i * 3.1;
    const x = ((((start * cloudSpan + o.time * speed * motion) % cloudSpan) + cloudSpan) % cloudSpan) - 180;
    drawToonCloud(ctx, x, height * yPct, scale * 0.92, pal, i);
  });
  ctx.restore();

  // --- depth planes ------------------------------------------------------
  const horizon = groundY - 120;
  const isCity = fam === 'city' || fam === 'space' || fam === 'night';
  const isOpen = fam === 'meadow' || fam === 'forest';

  // City towers cannot use the plain far/mid/near silhouettes the tree line
  // uses. A tree is a thin shape, so a dark tone reads as depth; a building is
  // a huge filled rectangle, so the same tone reads as a black slab pasted over
  // the sky - which is exactly what the industrial chapter looked like.
  //
  // The fix is not to make the towers pale. A pale tower on a pale sky has no
  // silhouette at all, which is the other way this backdrop died: the whole
  // skyline dissolved into the sunset as one lavender wash. What the meadow
  // does, and what works here, is a firm value ladder with rising saturation -
  // bright and desaturated at the back, deep and saturated at the front - so
  // each plane is legible against the one behind it at any time of day.
  //
  // The ladder is built from the family's own far/mid/near, pushed a stop in
  // each direction, then re-lit only by the sky's warmth (not by its
  // brightness) so the city stays part of the sunset without bleaching out.
  // A touch of haze on the farthest plane only: atmosphere, not bleaching.
  const cityFar = blend(pal.haze, pal.far, 0.72);
  const cityMid = pal.mid;
  const cityNear = pal.near;

  // Plane 1: the pale, far silhouette. Barely darker than the sky.
  if (isCity) {
    drawFarTowers(ctx, o, 0.03, cityFar, 0.8, horizon + 30, 13, 0);
  } else if (isOpen) {
    drawFarHills(ctx, o, 0.03, pal.far, 0.8, 240, horizon + 40, 17);
  } else {
    drawDunes(ctx, o, 0.03, pal.far, 0.8, horizon + 40, 1.7, 46);
  }

  // Plane 2: the readable middle distance.
  if (isCity) {
    drawFarTowers(ctx, o, 0.075, cityMid, 0.92, horizon + 90, 41, 1);
  } else if (isOpen) {
    drawTreeLine(ctx, o, 0.06, pal.mid, 0.9, horizon + 80, 23, 1);
    drawFarHills(ctx, o, 0.05, pal.mid, 0.9, 190, horizon + 96, 31);
  } else {
    drawDunes(ctx, o, 0.07, pal.mid, 0.9, horizon + 96, 4.3, 62);
  }

  // Wildlife on the middle plane: dark silhouettes that hop and peck along the
  // far ground. Drawn after this plane but before the near tree line, so the
  // closest trees can partially occlude them - that overlap is what sells the
  // depth. They are deliberately faint: a background animal must never be
  // mistaken for an enemy.
  // Seated on the crest of the middle ridge - above the near tree caps, so
  // they read against open sky instead of being swallowed by the tree line.
  // In an open landscape the far ridge is a real surface, so wildlife is seated
  // on it. A city has no ridge there - only sky between towers - and a pigeon
  // sitting at ridge height reads as a bird stuck in mid-air, which is exactly
  // how the industrial chapter looked. Street level is the honest seat for a
  // city: the animals show through the gaps between the near towers, crossing
  // the plaza behind the cat instead of hovering above it.
  drawBackgroundCritters(ctx, o, isCity ? groundY - 10 : groundY - 146);

  // Atmospheric haze where the planes meet the ground.
  const haze = ctx.createLinearGradient(0, horizon - 90, 0, groundY + 10);
  haze.addColorStop(0, withAlpha(pal.haze, 0));
  haze.addColorStop(0.55, withAlpha(pal.haze, (pal.night ? 0.12 : 0.16)));
  haze.addColorStop(1, withAlpha(pal.haze, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 90, width, groundY - horizon + 100);

  // Plane 3: the near, saturated silhouette that frames the playfield.
  if (isCity) {
    drawFarTowers(ctx, o, 0.14, cityNear, 1, groundY + 6, 73, 2);
    // Chimneys on the near skyline: the one upward motion in the frame, which
    // is what stops the city reading as a static backdrop sliding past.
    const smokeShift = o.scrollX * 0.14;
    const smokeFirst = Math.floor(smokeShift / CITY_SPAN) - 1;
    const smokeCount = Math.ceil(o.width / CITY_SPAN) + 3;
    for (let k = 0; k < smokeCount; k++) {
      const slot = smokeFirst + k;
      const r1 = h1(73 + slot * 3.11);
      const r2 = h1(73 + slot * 6.9 + 4);
      // Only the tallest towers get a chimney, and only some of them.
      if (r2 < 0.72) continue;
      const bw = cityWidth(r1);
      const bh = cityHeight(r2);
      const bx = slot * CITY_SPAN - smokeShift + cityOffset(r1);
      if (bx < -140 || bx > o.width + 140) continue;
      const top = groundY + 6 - bh;
      // Dusty violet-grey, not the sky's own haze. Tinting the plume with the
      // haze colour made it literally invisible against a haze-coloured sky.
      drawSmoke(
        ctx,
        bx + bw * 0.32,
        top - 4,
        o.time + slot * 3.1,
        1,
        blend(pal.ink, pal.haze, 0.52),
      );
    }
  } else if (isOpen) {
    // Two bands of trees: a darker, closer row and a lighter one behind it,
    // both seated below the horizon so they frame the route instead of
    // competing with the cat.
    drawTreeLine(ctx, o, 0.1, blend(pal.near, pal.haze, 0.3), 0.95, groundY + 6, 47, 1.05);
    drawTreeLine(ctx, o, 0.15, pal.near, 1, groundY + 26, 59, 1.3);
  } else {
    drawDunes(ctx, o, 0.15, pal.near, 1, groundY + 14, 7.1, 78);
  }

  // Ground line: a soft inked strip that seats the whole scene.
  ctx.fillStyle = withAlpha(pal.ink, pal.night ? 0.5 : 0.28);
  ctx.fillRect(0, groundY - 3, width, 4);
};

/* ------------------------------------------------------- background life --- */

/** Which critters belong to a biome. They are pure silhouettes, so only the
    outline matters - a rabbit reads by its ears, a squirrel by its tail. */
const CRITTERS_BY_FAMILY: Record<Family, string[]> = {
  meadow: ['rabbit', 'squirrel', 'dog'],
  forest: ['rabbit', 'deer', 'squirrel'],
  city: ['cat', 'pigeon', 'dog'],
  night: ['cat', 'owl', 'bat'],
  snow: ['rabbit', 'deer', 'fox'],
  desert: ['dog', 'fox', 'bird'],
  lava: ['bat', 'fox', 'bird'],
  space: ['cat', 'bird', 'bat'],
  ice: ['rabbit', 'fox', 'bird'],
};

const drawCritter = (
  ctx: CanvasRenderingContext2D,
  kind: string,
  x: number,
  y: number,
  s: number,
  bob: number,
) => {
  ctx.beginPath();
  switch (kind) {
    case 'rabbit': {
      // Body, then two long ears that keep a tiny bit of lag from `bob`.
      ctx.ellipse(x, y - 9 * s, 8 * s, 9 * s, 0, 0, Math.PI * 2);
      const ear = 2 + bob * 1.5;
      ctx.moveTo(x - 4 * s, y - 16 * s);
      ctx.ellipse(x - 4 * s, y - (22 + ear) * s, 2.4 * s, 7 * s, 0.16, 0, Math.PI * 2);
      ctx.moveTo(x + 3 * s, y - 16 * s);
      ctx.ellipse(x + 3 * s, y - (22 + ear) * s, 2.4 * s, 7 * s, -0.16, 0, Math.PI * 2);
      break;
    }
    case 'squirrel': {
      ctx.ellipse(x, y - 7 * s, 6 * s, 7.5 * s, 0, 0, Math.PI * 2);
      // The tail is one big curl behind the body: the whole silhouette.
      ctx.moveTo(x + 5 * s, y - 6 * s);
      ctx.bezierCurveTo(
        x + 22 * s, y - 8 * s,
        x + 20 * s, y - 26 * s,
        x + 9 * s, y - 22 * s,
      );
      ctx.bezierCurveTo(
        x + 15 * s, y - 18 * s,
        x + 14 * s, y - 9 * s,
        x + 5 * s, y - 6 * s,
      );
      break;
    }
    case 'deer': {
      ctx.ellipse(x, y - 12 * s, 11 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 10 * s, y - 24 * s, 4.5 * s, 5 * s, 0.2, 0, Math.PI * 2);
      ctx.moveTo(x - 12 * s, y - 28 * s);
      ctx.lineTo(x - 16 * s, y - 36 * s);
      ctx.lineTo(x - 14 * s, y - 37 * s);
      ctx.lineTo(x - 10 * s, y - 29 * s);
      break;
    }
    case 'cat': {
      ctx.ellipse(x, y - 8 * s, 9 * s, 7 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 8 * s, y - 16 * s, 5 * s, 4.5 * s, 0, 0, Math.PI * 2);
      ctx.moveTo(x + 5 * s, y - 19 * s);
      ctx.lineTo(x + 6 * s, y - 24 * s);
      ctx.lineTo(x + 9 * s, y - 20 * s);
      ctx.moveTo(x + 10 * s, y - 20 * s);
      ctx.lineTo(x + 13 * s, y - 24 * s);
      ctx.lineTo(x + 13 * s, y - 18 * s);
      // Tail: an upward hook.
      ctx.moveTo(x - 8 * s, y - 8 * s);
      ctx.quadraticCurveTo(x - 18 * s, y - 10 * s, x - 15 * s, y - 20 * s);
      ctx.quadraticCurveTo(x - 13 * s, y - 12 * s, x - 7 * s, y - 6 * s);
      break;
    }
    case 'dog': {
      ctx.ellipse(x, y - 9 * s, 10 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 9 * s, y - 19 * s, 5 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.moveTo(x + 6 * s, y - 23 * s);
      ctx.ellipse(x + 5 * s, y - 20 * s, 2 * s, 4 * s, 0.35, 0, Math.PI * 2);
      ctx.moveTo(x - 9 * s, y - 10 * s);
      ctx.quadraticCurveTo(x - 17 * s, y - 22 * s, x - 20 * s, y - 16 * s);
      break;
    }
    case 'fox': {
      ctx.ellipse(x, y - 7 * s, 9 * s, 6.5 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 8 * s, y - 15 * s, 4.5 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.moveTo(x + 5 * s, y - 18 * s);
      ctx.lineTo(x + 4 * s, y - 23 * s);
      ctx.lineTo(x + 8 * s, y - 19 * s);
      // Big brush tail.
      ctx.moveTo(x - 7 * s, y - 8 * s);
      ctx.quadraticCurveTo(x - 20 * s, y - 14 * s, x - 16 * s, y - 1 * s);
      ctx.quadraticCurveTo(x - 14 * s, y - 8 * s, x - 6 * s, y - 5 * s);
      break;
    }
    case 'owl': {
      ctx.ellipse(x, y - 10 * s, 8 * s, 9 * s, 0, 0, Math.PI * 2);
      ctx.moveTo(x - 5 * s, y - 18 * s);
      ctx.lineTo(x - 8 * s, y - 25 * s);
      ctx.lineTo(x - 1 * s, y - 19 * s);
      ctx.moveTo(x + 5 * s, y - 18 * s);
      ctx.lineTo(x + 8 * s, y - 25 * s);
      ctx.lineTo(x + 1 * s, y - 19 * s);
      break;
    }
    case 'bat': {
      const flap = 3 + bob * 6;
      ctx.ellipse(x, y - 14 * s, 4 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.moveTo(x - 3 * s, y - 16 * s);
      ctx.quadraticCurveTo(x - 14 * s, y - (20 + flap) * s, x - 17 * s, y - 12 * s);
      ctx.quadraticCurveTo(x - 9 * s, y - 14 * s, x - 3 * s, y - 11 * s);
      ctx.moveTo(x + 3 * s, y - 16 * s);
      ctx.quadraticCurveTo(x + 14 * s, y - (20 + flap) * s, x + 17 * s, y - 12 * s);
      ctx.quadraticCurveTo(x + 9 * s, y - 14 * s, x + 3 * s, y - 11 * s);
      break;
    }
    case 'bird':
    case 'pigeon': {
      const hop = bob * 1.5;
      ctx.ellipse(x, y - (7 + hop) * s, 7 * s, 5.5 * s, -0.15, 0, Math.PI * 2);
      ctx.ellipse(x + 6 * s, y - (12 + hop) * s, 3.4 * s, 3.4 * s, 0, 0, Math.PI * 2);
      ctx.moveTo(x + 9 * s, y - (12 + hop) * s);
      ctx.lineTo(x + 14 * s, y - (13 + hop) * s);
      ctx.lineTo(x + 9 * s, y - (10.5 + hop) * s);
      break;
    }
    default: {
      ctx.ellipse(x, y - 7 * s, 7 * s, 6 * s, 0, 0, Math.PI * 2);
    }
  }
  ctx.fill();
};

/**
 * Background wildlife: dark, semi-transparent silhouettes that hop, peck and
 * idle on the far ground line. They exist to make the world feel inhabited,
 * so they sit behind the haze, keep roughly 18 % opacity and never come
 * closer than the middle distance - a background animal must never be
 * mistaken for an enemy the cat has to dodge.
 */
export const drawBackgroundCritters = (
  ctx: CanvasRenderingContext2D,
  o: BackdropOptions,
  seatY: number,
) => {
  const pal = o.pal;
  const fam = familyForTheme(o.theme);
  const kinds = CRITTERS_BY_FAMILY[fam] || CRITTERS_BY_FAMILY.meadow;
  const span = 300;
  const shift = o.scrollX * 0.085;
  const firstSlot = Math.floor(shift / span) - 1;
  const baseY = seatY;
  const count = Math.ceil(o.width / span) + 2;

  ctx.save();
  ctx.fillStyle = withAlpha(pal.ink, pal.night ? 0.44 : 0.3);
  for (let k = 0; k < count; k++) {
    const i = firstSlot + k;
    const seed = h1(i * 3.7 + 11);
    const kind = kinds[Math.floor(seed * kinds.length) % kinds.length];
    const x = i * span - shift + seed * 190;
    const s = 1.05 + h1(i * 8.1 + 5) * 0.35;
    // A slow idle cycle: rabbits hop twice, then sit still. Motion is scaled
    // by o.motion so reduced-motion players get a still scene.
    const t = o.time * 0.9 + seed * 12;
    const bob = Math.max(0, Math.sin(t * 2.2)) * o.motion;
    const drift = Math.sin(t * 0.35) * 6 * o.motion;
    const grounded = !(kind === 'bat' || kind === 'bird' || kind === 'owl');
    drawCritter(
      ctx,
      kind,
      x + drift,
      grounded ? baseY : baseY - 130 - seed * 40,
      s,
      bob,
    );
  }
  ctx.restore();
};

/**
 * The earth band under the playfield. Ground slabs are drawn on top of this,
 * so a pit chasm cuts a clean hole and the bottom of the screen is never
 * transparent (which used to show the page behind the canvas as a grey bar).
 */
export const drawEarth = (
  ctx: CanvasRenderingContext2D,
  groundY: number,
  height: number,
  width: number,
  pal: Pal,
) => {
  const grad = ctx.createLinearGradient(0, groundY, 0, height);
  grad.addColorStop(0, pal.groundBody);
  grad.addColorStop(0.35, pal.groundDeep);
  grad.addColorStop(1, blend(pal.groundDeep, pal.ink, 0.55));
  ctx.fillStyle = grad;
  ctx.fillRect(0, groundY, width, height - groundY);
};

/* ----------------------------------------------------------- platforms --- */

export interface GroundOpts {
  x: number;
  y: number;
  width: number;
  height: number;
  pal: Pal;
  /** Grass fringe on the top edge (static - see drawGrassCap). */
  grass: boolean;
  /** Snow / sand cap instead of grass. */
  cap: 'grass' | 'snow' | 'sand' | 'stone' | 'metal' | 'lava';
  time: number;
  /** Deterministic seed so decoration never moves between frames. */
  seed: number;
  /** Kept for the moving-platform and boss-call sites; the ground itself is still. */
  motion?: number;
  /** Camera scroll, so grass blades keep their shape in world space. */
  scrollX?: number;
  /** Neon edge accent for boss walkways and city routes. */
  neon?: string;
}

const INK_W = 3;

/**
 * Grass fringe along the top edge of a ground slab.
 *
 * The style is lifted from the live-run card on the home screen, which the
 * player pointed at as the look they wanted: a thin turf line, then a row of
 * fine, pale, tapering blades that barely rise above it. The old fringe was
 * the opposite - thick dark strokes with pink wildflowers on top - which read
 * as a hedge sitting in front of the level instead of a lawn the cat stands in.
 *
 * The blades are laid out in WORLD space on purpose. They used to be spaced
 * from the screen x and hashed from it too, so every camera pan re-rolled the
 * whole fringe: it boiled and sparkled while the cat ran, which was reported
 * as the grass moving and hurting the eyes. A blade now keeps its shape for
 * the whole level and only slides with the ground.
 */
const GRASS_SPACING = 8;

const drawGrassCap = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  pal: Pal,
  seed: number,
  /** World x of the slab's left edge. Blade shapes are hashed from this. */
  worldLeft: number,
  /** World x currently shown at screen x = 0 (the camera scroll). */
  scrollX: number,
) => {
  // A thin lit turf line, the way the menu card edges its ground. It sits just
  // above the slab so the grass reads as growing out of it.
  ctx.save();
  ctx.strokeStyle = withAlpha(pal.grass, 0.75);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y + 0.7);
  ctx.lineTo(x + width, y + 0.7);
  ctx.stroke();

  // Fine blades, drawn from world positions so none of them ever re-roll.
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.3;
  const base = withAlpha(pal.grass, 0.85);
  const firstWorld = worldLeft + Math.floor((scrollX - 8 - worldLeft) / GRASS_SPACING) * GRASS_SPACING;
  const lastWorld = worldLeft + width + 8;
  for (let wx = firstWorld; wx < lastWorld; wx += GRASS_SPACING) {
    const gx = wx - scrollX;
    if (gx < -8 || gx > 1280 + 8) continue;
    // Two independent hashes: height and lean. The lean is fixed per blade, so
    // the lawn looks wind-combed while not a single pixel of it changes.
    const hh = h1(wx * 0.37 + seed);
    const lean = (h1(wx * 0.71 + seed) - 0.5) * 3.2;
    const blade = 3.2 + hh * 4.6;
    ctx.strokeStyle = hh > 0.5 ? base : withAlpha(pal.grassDark, 0.8);
    ctx.beginPath();
    ctx.moveTo(gx, y + 1);
    // Tapering tip: a shallow curve that hooks toward the lean.
    ctx.quadraticCurveTo(gx + lean * 0.3, y - blade * 0.7, gx + lean, y - blade);
    ctx.stroke();
  }
  ctx.restore();
};

/**
 * A ground slab: inked rounded body, a brighter two-tone cap and a swaying
 * grass fringe. The outline is what makes it read as a hand-drawn platform
 * instead of a rectangle.
 */
export const drawGroundSlab = (ctx: CanvasRenderingContext2D, g: GroundOpts) => {
  const { x, y, width, height, pal, cap, time, seed } = g;
  if (width <= 2) return;
  const bodyH = Math.max(height, 26);

  ctx.save();
  // Body: vertical gradient from the cap down into the deep earth.
  const body = ctx.createLinearGradient(0, y, 0, y + bodyH);
  body.addColorStop(0, pal.groundBody);
  body.addColorStop(1, pal.groundDeep);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(x, y, width, bodyH, [10, 10, 0, 0]);
  ctx.fill();

  // Cap band: a solid, saturated stripe that always sits on top.
  const capH = 13;
  ctx.fillStyle = cap === 'snow' ? '#ffffff'
    : cap === 'sand' ? pal.groundTop
      : cap === 'stone' ? blend(pal.groundBody, pal.ledge, 0.4)
        : cap === 'lava' ? blend(pal.groundBody, pal.accent, 0.35)
          : pal.groundTop;
  ctx.beginPath();
  ctx.roundRect(x, y, width, capH, [10, 10, 0, 0]);
  ctx.fill();

  // Ink outline, drawn on top of both bands so the slab silhouette is crisp.
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = INK_W;
  ctx.beginPath();
  ctx.roundRect(x + INK_W / 2, y + INK_W / 2, width - INK_W, bodyH - INK_W, [9, 9, 0, 0]);
  ctx.stroke();

  // Pebbles / soil speckles: a few darker ovals in the body.
  for (let i = 0; i < Math.min(26, Math.floor(width / 46)); i++) {
    const px = x + 20 + h1(seed + i * 3.7) * Math.max(1, width - 40);
    const py = y + 34 + h1(seed + i * 8.1) * Math.max(4, bodyH - 48);
    ctx.fillStyle = withAlpha(pal.ink, 0.14);
    ctx.beginPath();
    ctx.ellipse(px, py, 4 + h1(seed + i) * 5, 2.4 + h1(seed + i * 2) * 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (cap === 'grass') {
    // `x` is screen space; the world origin and the camera scroll put every
    // blade back on its fixed world position so nothing re-rolls while panning.
    const scrollX = g.scrollX ?? 0;
    drawGrassCap(ctx, x, y, width, pal, seed, x + scrollX, scrollX);
  } else if (cap === 'snow') {
    // Soft snow mounds along the top. Seeded on the world position so the
    // mounds do not re-roll (and visibly crawl) while the camera pans.
    const worldLeft = x + (g.scrollX ?? 0);
    for (let sx = x + 10; sx < x + width - 10; sx += 34) {
      const r = h1((worldLeft + (sx - x)) * 0.21 + seed);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(sx + 8, y + 1, 12 + r * 8, 6 + r * 4, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }
  } else if (cap === 'sand') {
    const worldLeft = x + (g.scrollX ?? 0);
    for (let sx = x + 12; sx < x + width - 12; sx += 40) {
      const r = h1((worldLeft + (sx - x)) * 0.33 + seed);
      ctx.strokeStyle = withAlpha(pal.ledgeDeep, 0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, y + 4, 6 + r * 5, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }

  // Neon rim for authored routes (boss walkway, city ledges).
  if (g.neon) {
    ctx.strokeStyle = g.neon;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 1.5);
    ctx.lineTo(x + width - 8, y + 1.5);
    ctx.stroke();
  }
  ctx.restore();
};

export interface LedgeOpts {
  x: number;
  y: number;
  width: number;
  height: number;
  pal: Pal;
  time: number;
  seed: number;
  theme: string;
  moving: boolean;
  /** Optional neon accent (moving lifts, boss platforms). */
  accent?: string;
}

/**
 * A floating cartoon ledge: a rounded plank with an inked outline, a light
 * cap and a soft drop shadow. No gradient mesh, no glow soup - the silhouette
 * does the work.
 */
export const drawLedge = (ctx: CanvasRenderingContext2D, l: LedgeOpts) => {
  const { x, y, width, height, pal, seed } = l;
  if (width <= 2) return;
  const fam = familyForTheme(l.theme);
  const h = Math.max(16, height);
  const r = Math.min(12, h * 0.5);

  ctx.save();
  // Drop shadow: a flat, offset inked shape under the plank.
  ctx.fillStyle = withAlpha(pal.ink, 0.16);
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 8, width, h * 0.9, r);
  ctx.fill();

  // Body.
  const body = ctx.createLinearGradient(0, y, 0, y + h);
  body.addColorStop(0, pal.ledge);
  body.addColorStop(0.55, pal.ledgeBody);
  body.addColorStop(1, pal.ledgeDeep);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(x, y, width, h, r);
  ctx.fill();

  // Cap highlight.
  ctx.fillStyle = pal.ledgeRim;
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 2.5, width - 6, Math.max(3, h * 0.24), r * 0.6);
  ctx.fill();

  // Ink outline.
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.roundRect(x + 1.3, y + 1.3, width - 2.6, h - 2.6, r);
  ctx.stroke();

  // Wood grain / rock seams, depending on the family.
  if (h > 18 && (fam === 'meadow' || fam === 'forest' || fam === 'city')) {
    ctx.strokeStyle = withAlpha(pal.ink, 0.2);
    ctx.lineWidth = 1.6;
    for (let i = 0; i < Math.floor(width / 54); i++) {
      const sx = x + 18 + i * 54;
      ctx.beginPath();
      ctx.moveTo(sx, y + 6);
      ctx.lineTo(sx + 10 + h1(seed + i) * 8, y + h - 4);
      ctx.stroke();
    }
  }

  // Moving lifts get a visible dash-light so the route is legible.
  if (l.moving) {
    ctx.fillStyle = l.accent || '#7ee7ff';
    for (let i = 0; i < Math.max(1, Math.floor(width / 26)); i++) {
      ctx.beginPath();
      ctx.arc(x + 13 + i * 26, y + h - 4, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
};

/* --------------------------------------------------------------- holes --- */

/** A bottomless pit drawn as a dark, inked chasm with a lit lip. */
export const drawChasm = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  pal: Pal,
) => {
  ctx.save();
  const depth = Math.max(60, height - y);
  const grad = ctx.createLinearGradient(0, y, 0, y + depth);
  grad.addColorStop(0, blend(pal.groundDeep, pal.ink, 0.5));
  grad.addColorStop(0.5, withAlpha(pal.ink, 0.95));
  grad.addColorStop(1, pal.ink);
  ctx.fillStyle = grad;
  ctx.beginPath();
  // Softened corners: the pit is a place, not a rectangle.
  ctx.roundRect(x, y - 2, width, depth + 4, [0, 0, 18, 18]);
  ctx.fill();

  // Inked lip on both sides.
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + depth);
  ctx.moveTo(x + width, y);
  ctx.lineTo(x + width, y + depth);
  ctx.stroke();

  // A couple of hanging vines / rock spikes so the drop has character.
  for (let i = 0; i < Math.max(1, Math.floor(width / 70)); i++) {
    const sx = x + 20 + h1(i * 4.1 + x * 0.01) * Math.max(1, width - 40);
    ctx.fillStyle = withAlpha(pal.groundDeep, 0.9);
    ctx.beginPath();
    ctx.moveTo(sx - 7, y);
    ctx.lineTo(sx + 7, y);
    ctx.lineTo(sx, y + 16 + h1(i * 2.3) * 26);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
};

/* -------------------------------------------------------------- pickups --- */

/** A chunky cartoon fish, drawn at (x, y) as its centre. */
export const drawToonFish = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  pal: Pal,
  scale = 1,
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(Math.sin(t * 2.2) * 0.08);
  // Tail.
  ctx.fillStyle = pal.accent2;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(-19, -8);
  ctx.lineTo(-16, 0);
  ctx.lineTo(-19, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Body.
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.ellipse(1, 0, 13, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Belly highlight.
  ctx.fillStyle = withAlpha('#ffffff', 0.45);
  ctx.beginPath();
  ctx.ellipse(0, 3, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eye.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(7, -2.5, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.arc(8, -2.5, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};
