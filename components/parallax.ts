/**
 * Parallax scrolling maths, kept separate from the drawing code so it can be
 * unit-tested without a canvas.
 *
 * The rule that matters here: a piece of scenery is identified by its WORLD
 * slot, never by its position in the loop that draws it. A layer is drawn as
 * "the few spans of scenery that fit on screen", and the loop index naturally
 * counts from 0 at the left edge of the viewport. Hashing that index means the
 * scenery identity changes the moment the parallax offset wraps, so every tree,
 * hill, tower and critter swaps shape at once - which the player sees as the
 * background changing in the middle of a level.
 */

/** A deterministic 0..1 hash. Same input, same output - scenery never flickers. */
export const hash01 = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export interface LayerWindow {
  /** World slot index of the leftmost span to draw. */
  firstSlot: number;
  /** How many spans to draw to fill the viewport. */
  count: number;
  /** Pixels of this layer that have scrolled past the origin. */
  shift: number;
}

/**
 * Which world slots of a repeating layer are visible at a given camera scroll.
 *
 * `span` is the layer's repeat width in world pixels and `parallax` scales the
 * camera scroll, so a distant layer moves slower than the ground.
 */
export const layerWindow = (
  scrollX: number,
  parallax: number,
  span: number,
  viewportWidth: number,
  leadIn = 1,
  tail = 3,
): LayerWindow => {
  const shift = scrollX * parallax;
  const firstSlot = Math.floor(shift / span) - leadIn;
  const count = Math.ceil(viewportWidth / span) + leadIn + tail;
  return { firstSlot, count, shift };
};

/**
 * Screen x of a world slot's origin. The slot keeps the same identity no matter
 * where the camera is: only its screen position moves.
 */
export const slotToScreen = (slot: number, span: number, shift: number): number =>
  slot * span - shift;
