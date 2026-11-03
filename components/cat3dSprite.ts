/**
 * The 3D cat as a Canvas 2D sprite.
 *
 * scripts/render-cat-sprites.mjs bakes public/sprites/cat_<pose>_<angle>.png
 * from the toon cat sculpt. This module picks the right frame for the moment
 * and blits it, so the game loop never touches WebGL.
 *
 * Angles run from -3 to 4 (8 steps, 45 degrees apart). The sculpt faces +Z, so
 * angle 2 is the profile view the game draws when the cat runs right.
 */

export const SPRITE_POSES = ['idle', 'run', 'jump'] as const;
export type SpritePose = (typeof SPRITE_POSES)[number];

const ANGLES = [-3, -2, -1, 0, 1, 2, 3, 4];
const ANGLE_STEP = Math.PI / 4;

const spriteUrl = (pose: SpritePose, angle: number) => `sprites/cat_${pose}_${angle}.png`;

const cache = new Map<string, HTMLImageElement>();
let loaded = false;

/** Starts (and caches) the download. Safe to call from every level start. */
export const preloadCat3DSprites = () => {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  for (const pose of SPRITE_POSES) {
    for (const angle of ANGLES) {
      const key = `${pose}_${angle}`;
      const img = new Image();
      img.decoding = 'async';
      img.src = spriteUrl(pose, angle);
      cache.set(key, img);
    }
  }
};

export const cat3DSpritesReady = () => {
  if (!loaded) return false;
  for (const img of cache.values()) if (!img.complete || img.naturalWidth === 0) return false;
  return true;
};

/** True once every frame has decoded, which is when the 3D cat can take over. */
export const isCat3DSpriteSetReady = () => cat3DSpritesReady();

/** A single decoded frame, for menu previews. Returns null until it is ready. */
export const getCat3DFrame = (pose: SpritePose, angle = 2): HTMLImageElement | null => {
  const img = cache.get(`${pose}_${angle}`);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
};

/**
 * A side-on platformer should only ever show side-on frames: front and back
 * views of a walk read as the cat moonwalking.
 *
 * The bake turns the sculpt 45 degrees per angle step, so angle 2 is the
 * profile with the nose to the right - the direction the unflipped sprite is
 * drawn in. 1 and 3 are the three-quarter views either side of it; 0 and 4
 * look straight at the camera.
 */
const SIDE_ANGLES = [2, 1, 3] as const;

const frameForAngle = (viewAngle: number) => {
  const t = ((viewAngle / (Math.PI * 2)) % 1 + 1) % 1;
  return SIDE_ANGLES[Math.round(t * SIDE_ANGLES.length) % SIDE_ANGLES.length];
};

/**
 * Draw the 3D cat standing on (x, y) - the feet - inside a box roughly
 * `w` x `h` pixels, mirroring the contract of drawCatSprite.
 *
 * `viewAngle` comes from the game: 0 when the camera looks at the cat from the
 * side (the usual platformer view). The game passes a slowly changing value as
 * the level scrolls so the cat appears to turn, which is what sells the 3D.
 */
export const drawCat3DSprite = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: {
    pose: SpritePose;
    /** Radians, camera orbit around the cat. */
    viewAngle: number;
    facing?: 1 | -1;
    w: number;
    h: number;
  },
) => {
  const { pose, viewAngle, facing = 1, w, h } = opts;
  const angle = frameForAngle(viewAngle);
  const img = cache.get(`${pose}_${angle}`);
  if (!img || !img.complete || img.naturalWidth === 0) return false;

  // The bake frames the whole sculpt with a little air; the hitbox is what the
  // player sees, so scale the art to sit inside it.
  const drawH = h * 1.12;
  const drawW = drawH * (img.naturalWidth / img.naturalHeight);

  ctx.save();
  ctx.translate(x, y);
  if (facing === -1) ctx.scale(-1, 1);
  // Feet sit on the floor; the bake is centred, so lift by half its height.
  ctx.drawImage(img, -drawW / 2, -drawH, drawW, drawH);
  ctx.restore();
  return true;
};
