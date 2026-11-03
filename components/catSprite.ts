/**
 * Shadow Paw - the hero cat.
 *
 * A side-view, quadruped neon cat drawn as vector art. One drawing is shared by
 * the game, the attract loop, the shop preview and the menus, so the character
 * never changes between screens.
 *
 * Origin = the exact paw line (x is the body centre, y is the floor). The four
 * legs are solved with a tiny two-bone IK rig; diagonal pairs swing in
 * opposition so a walk reads as a walk, not as a sliding sticker.
 */

export interface CatSpriteOpts {
  color: string;
  accent?: string;
  /** Seconds clock for breathing, tail and blinks. */
  t: number;
  running: boolean;
  jumping: boolean;
  shooting?: boolean;
  facing?: 1 | -1;
  /** Horizontal speed in game pixels per frame. */
  speed?: number;
  /** True when a floor is under the paws. */
  grounded?: boolean;
  /** Vertical velocity, used to choose the jump / fall pose. */
  vy?: number;
  /** Distance-driven gait phase. */
  phase?: number;
  dashing?: boolean;
  blinking?: boolean;
  hurt?: boolean;
  sx?: number;
  sy?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const shade = (hex: string, k: number) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const c = (v: number) => clamp(Math.round(v * k), 0, 255);
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
};

const lighten = (hex: string, k: number) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const c = (v: number) => clamp(Math.round(v + (255 - v) * k), 0, 255);
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
};

const isBright = (hex: string) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return r * 0.299 + g * 0.587 + b * 0.114 > 120;
};

/** Two-bone IK. Returns the knee and a clamped foot target. */
const solveLeg = (
  hipX: number,
  hipY: number,
  footX: number,
  footY: number,
  upper: number,
  lower: number,
  bend: 1 | -1,
) => {
  let dx = footX - hipX;
  let dy = footY - hipY;
  let dist = Math.hypot(dx, dy);
  const max = upper + lower - 0.3;
  if (dist > max) {
    const k = max / Math.max(0.001, dist);
    dx *= k;
    dy *= k;
    dist = max;
  }
  dist = Math.max(0.001, dist);
  const base = Math.atan2(dy, dx);
  const a = Math.acos(clamp((upper * upper + dist * dist - lower * lower) / (2 * upper * dist), -1, 1));
  const kneeX = hipX + Math.cos(base + bend * a) * upper;
  const kneeY = hipY + Math.sin(base + bend * a) * upper;
  return { kneeX, kneeY, footX: hipX + dx, footY: hipY + dy };
};

interface LegStyle {
  color: string;
  width: number;
  paw: string;
  outline: string;
  far: boolean;
}

const drawLeg = (
  ctx: CanvasRenderingContext2D,
  hipX: number,
  hipY: number,
  footX: number,
  footY: number,
  upper: number,
  lower: number,
  bend: 1 | -1,
  style: LegStyle,
) => {
  const { kneeX, kneeY, footX: fx, footY: fy } = solveLeg(hipX, hipY, footX, footY, upper, lower, bend);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Dark contour, then fur stroke. The contour is what keeps a blue cat
  // readable against a blue sky.
  ctx.strokeStyle = style.outline;
  ctx.lineWidth = style.width + 2.6;
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(kneeX, kneeY);
  ctx.lineTo(fx, fy);
  ctx.stroke();

  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.beginPath();
  ctx.moveTo(hipX, hipY);
  ctx.lineTo(kneeX, kneeY);
  ctx.lineTo(fx, fy);
  ctx.stroke();

  // Paw. Bottom of the paw is exactly y = 0, the sprite origin.
  ctx.fillStyle = style.paw;
  ctx.strokeStyle = style.outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(fx + 1, -2.1, 4.3, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Toe crease.
  ctx.strokeStyle = style.outline;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(fx + 0.4, -2.3);
  ctx.lineTo(fx + 0.4, -0.8);
  ctx.stroke();

  if (!style.far) {
    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(kneeX + 1, kneeY + 1);
    ctx.lineTo(fx + 1, fy - 1.5);
    ctx.stroke();
  }
  ctx.restore();
};

export const drawCatSprite = (ctx: CanvasRenderingContext2D, x: number, y: number, o: CatSpriteOpts) => {
  const {
    color,
    t,
    running,
    jumping,
    shooting = false,
    facing = 1,
    speed = 0,
    grounded = !jumping,
    vy = 0,
    dashing = false,
    blinking = false,
    hurt = false,
    sx = 1,
    sy = 1,
  } = o;

  const accent = o.accent && isBright(o.accent) ? o.accent : '#2bee79';
  const moving = running || Math.abs(speed) > 0.35;
  const phase = o.phase ?? t * 11;
  const speedAbs = Math.abs(speed);
  const gait = moving ? clamp(speedAbs / 5.2, 0.4, 1.55) : 0;
  // Keep the paw swing modest: with four legs on a short body, a wide stride
  // fans the paws out and the silhouette stops reading as a cat.
  const stride = 2.2 + gait * 2.6;
  const lift = 1.6 + gait * 2.8;
  const outline = '#070b16';
  const furDark = shade(color, 0.58);
  const furMid = shade(color, 0.82);
  const furLight = lighten(color, 0.24);
  const paw = lighten(color, 0.12);
  const farColor = shade(color, 0.5);
  const farPaw = shade(color, 0.66);

  const air = !grounded;
  const rising = air && vy < -1.2;
  const falling = air && vy > 1.2;

  const bob = moving && grounded ? -Math.abs(Math.sin(phase)) * 1.4 : Math.sin(t * 2.2) * 0.5;
  const lean = moving && grounded ? clamp(speedAbs * 0.012, 0, 0.085) : 0;
  const headBob = moving ? Math.sin(phase * 2 + 0.5) * 0.7 : Math.sin(t * 2.2 + 0.8) * 0.4;

  // A side-view cat is a low, horizontal body on four SHORT legs. The hips sit
  // just above the belly line and the head sits at the front of the chest, so
  // the legs read as cat legs rather than stilts. The far pair is the near
  // pair shifted a few pixels back — same height, same reach — otherwise the
  // silhouette fans out into six legs.
  const frontHip = { x: 9.5, y: -16 + bob };
  const backHip = { x: -10.5, y: -15 + bob };
  const farFrontHip = { x: 6.5, y: -16 + bob };
  const farBackHip = { x: -13.5, y: -15 + bob };

  ctx.save();
  ctx.translate(x, y);
  if (facing === -1) ctx.scale(-1, 1);
  ctx.scale(sx, sy);
  if (hurt) ctx.globalAlpha = 0.85;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ---------------------------------------------------------------- tail
  // A long cat tail, curving up behind the haunch. The tip glows.
  const tailWave = Math.sin(phase * 0.8 + t * 1.6) * (moving ? 3.8 : 2.1);
  const tailLift = air ? -6 : 0;
  ctx.save();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 6.4;
  ctx.beginPath();
  ctx.moveTo(-17, -14 + bob);
  ctx.bezierCurveTo(-25, -13 + bob, -29, -20 + tailWave + tailLift, -27, -30 + tailWave * 0.7 + tailLift);
  ctx.stroke();
  ctx.strokeStyle = furMid;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-17, -14 + bob);
  ctx.bezierCurveTo(-25, -13 + bob, -29, -20 + tailWave + tailLift, -27, -30 + tailWave * 0.7 + tailLift);
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 7;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-28.6, -25.5 + tailWave * 0.65 + tailLift);
  ctx.quadraticCurveTo(-28, -28 + tailWave * 0.6 + tailLift, -27, -30 + tailWave * 0.7 + tailLift);
  ctx.stroke();
  ctx.restore();

  // --------------------------------------------------------------- legs
  const footTarget = (baseX: number, offset: number, isFront: boolean) => {
    if (dashing) return { fx: baseX - (isFront ? 3 : 5), fy: -2 - (isFront ? 1.5 : 0) };
    if (air) {
      // In the air the paws tuck under the chest instead of reaching out;
      // extended front legs read as arms, not as a cat leap.
      if (rising) return { fx: baseX + (isFront ? 0.5 : -1.5), fy: -8 - (isFront ? 1.5 : 0) };
      if (falling) return { fx: baseX + (isFront ? 1.5 : -1.5), fy: -2 };
      return { fx: baseX, fy: -5 };
    }
    if (!moving) return { fx: baseX, fy: -1.2 };
    const swing = Math.sin(phase + offset);
    const liftAmount = Math.max(0, Math.cos(phase + offset)) * lift;
    return { fx: baseX + swing * stride, fy: -1.2 - liftAmount };
  };

  // Far pair first: darker and a few pixels offset so they peek out from
  // behind the near legs, exactly like a real side view. They swing in the
  // SAME phase as their near counterpart, only a little behind it in x; a
  // half-cycle offset here is what made the cat read as a six-legged spider.
  const farFront = footTarget(6.5, Math.PI, true);
  const farBack = footTarget(-13.5, 0, false);
  drawLeg(ctx, farFrontHip.x, farFrontHip.y, farFront.fx, farFront.fy, 7.6, 7.6, 1, {
    color: farColor,
    width: 3.4,
    paw: farPaw,
    outline,
    far: true,
  });
  drawLeg(ctx, farBackHip.x, farBackHip.y, farBack.fx, farBack.fy, 8.2, 8.2, -1, {
    color: farColor,
    width: 3.7,
    paw: farPaw,
    outline,
    far: true,
  });

  // ---------------------------------------------------------------- body
  ctx.save();
  ctx.translate(0, bob);
  ctx.rotate(lean * 0.35);

  // Torso: a big, low bean that carries most of the cat's height. The back
  // line runs from the tail root to the neck; the belly sits just above the
  // paws so the short legs read as legs, not stilts.
  const bodyGrad = ctx.createLinearGradient(0, -31, 0, -10);
  bodyGrad.addColorStop(0, furLight);
  bodyGrad.addColorStop(0.42, color);
  bodyGrad.addColorStop(1, furDark);
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-18, -15);
  ctx.bezierCurveTo(-21, -25, -14, -30.5, -5, -30);
  ctx.bezierCurveTo(3, -29.5, 10, -26.5, 13, -21);
  ctx.bezierCurveTo(15, -16, 12, -11, 6, -10);
  ctx.bezierCurveTo(-2, -8.5, -12, -9.5, -16, -12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Haunch and shoulder volumes.
  ctx.fillStyle = furMid;
  ctx.beginPath();
  ctx.ellipse(-10.5, -16, 8.6, 9.2, -0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lighten(color, 0.14);
  ctx.beginPath();
  ctx.ellipse(8.8, -19, 6.2, 7.6, 0.16, 0, Math.PI * 2);
  ctx.fill();

  // Anatomy creases.
  ctx.strokeStyle = shade(color, 0.42);
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-14.5, -23);
  ctx.quadraticCurveTo(-9.5, -17, -10.5, -9);
  ctx.moveTo(10, -25);
  ctx.quadraticCurveTo(7, -19, 8, -11);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Belly highlight.
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.ellipse(-1, -11, 8.5, 2.6, 0.04, 0, Math.PI * 2);
  ctx.fill();

  // Chest fluff.
  ctx.fillStyle = furLight;
  ctx.beginPath();
  ctx.moveTo(10, -22);
  ctx.lineTo(14.2, -19.5);
  ctx.lineTo(11.2, -18);
  ctx.lineTo(14, -15.5);
  ctx.lineTo(10.4, -14.4);
  ctx.lineTo(11.6, -11.8);
  ctx.lineTo(7.8, -12.6);
  ctx.closePath();
  ctx.fill();

  // Neon rim along the back.
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.5;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 5;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-16, -25);
  ctx.bezierCurveTo(-12, -29.5, -4, -30, 2, -29);
  ctx.bezierCurveTo(6, -28.4, 10, -26, 12, -23);
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // Near pair: the legs the player actually reads.
  const nearFront = footTarget(10, Math.PI, true);
  const nearBack = footTarget(-10, 0, false);
  drawLeg(ctx, backHip.x, backHip.y, nearBack.fx, nearBack.fy, 8.6, 8.6, -1, {
    color: lighten(color, 0.05),
    width: 4.3,
    paw,
    outline,
    far: false,
  });
  drawLeg(ctx, frontHip.x, frontHip.y, nearFront.fx, nearFront.fy, 8.2, 8.2, 1, {
    color: lighten(color, 0.09),
    width: 4.2,
    paw,
    outline,
    far: false,
  });

  // ---------------------------------------------------------------- head
  // The skull sits low and directly on the front of the chest, almost ear to
  // shoulder. A long neck was what made the head look like a balloon on a
  // string rather than part of the cat.
  const headX = 15;
  const headY = -28.5 + headBob + bob;
  const blink = blinking || (!moving && Math.sin(t * 0.7) > 0.985);

  // Neck: a short, thick bridge that mostly hides behind the head and chest.
  ctx.save();
  ctx.fillStyle = furMid;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(5, -24);
  ctx.bezierCurveTo(8, -28, 12, -30, 17, -29);
  ctx.lineTo(19, -25);
  ctx.bezierCurveTo(14, -24, 10, -22, 8, -18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(headX, headY);
  ctx.rotate(lean * 0.4);

  // Ears.
  const earTwitch = Math.sin(t * 1.7 + 0.4) * 0.7;
  ctx.fillStyle = furMid;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.7;
  // Far ear.
  ctx.beginPath();
  ctx.moveTo(-5, -5);
  ctx.lineTo(-6.2 + earTwitch * 0.3, -14.5);
  ctx.lineTo(1, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Near ear.
  ctx.beginPath();
  ctx.moveTo(2.5, -7);
  ctx.lineTo(6.2 + earTwitch, -16.5);
  ctx.lineTo(9.6, -5.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Inner ear.
  ctx.fillStyle = '#e88fb4';
  ctx.beginPath();
  ctx.moveTo(4.2, -7.2);
  ctx.lineTo(6.2 + earTwitch * 0.6, -13.4);
  ctx.lineTo(8, -6.4);
  ctx.closePath();
  ctx.fill();

  // Skull.
  const headGrad = ctx.createRadialGradient(-2, -5, 1, 0, 0, 14);
  headGrad.addColorStop(0, furLight);
  headGrad.addColorStop(0.58, color);
  headGrad.addColorStop(1, furDark);
  ctx.fillStyle = headGrad;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -1.5, 9.4, 8.8, -0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cheek fluff.
  ctx.fillStyle = furLight;
  ctx.beginPath();
  ctx.moveTo(-7, 1.5);
  ctx.lineTo(-9.5, 4.5);
  ctx.lineTo(-5.5, 5);
  ctx.lineTo(-7.5, 7.5);
  ctx.lineTo(-2, 6.2);
  ctx.closePath();
  ctx.fill();

  // Muzzle: small and rounded. A big cream oval is what made the old face
  // read as a dog; a compact muzzle plus a pink nose reads as a cat.
  ctx.fillStyle = '#f3ead8';
  ctx.beginPath();
  ctx.ellipse(5.8, 2.1, 4.1, 3, 0.12, 0, Math.PI * 2);
  ctx.fill();
  // Nose.
  ctx.fillStyle = '#ff9ecb';
  ctx.strokeStyle = 'rgba(80,30,50,0.35)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(7.2, 0.5);
  ctx.lineTo(9.4, 0.5);
  ctx.lineTo(8.3, 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Mouth: a small W under the nose.
  ctx.strokeStyle = '#5a3a46';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(8.3, 2.1);
  ctx.quadraticCurveTo(8.3, 3.5, 6.9, 3.7);
  ctx.moveTo(8.3, 2.1);
  ctx.quadraticCurveTo(8.3, 3.5, 9.6, 3.5);
  ctx.stroke();

  // Whiskers.
  ctx.strokeStyle = 'rgba(245,250,255,0.62)';
  ctx.lineWidth = 0.8;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(9.6, 1.2 + i * 1.1);
    ctx.quadraticCurveTo(14, 0.2 + i * 1.8, 16.5, 0 + i * 2.9);
    ctx.stroke();
  }

  // Eyes: two, both near the front of the skull. The far eye is a little
  // smaller, which is what gives the face its three-quarter cat look.
  const eyes = [
    { x: -1.2, r: 2.35, far: true },
    { x: 5, r: 2.7, far: false },
  ];
  for (const eye of eyes) {
    if (blink) {
      ctx.strokeStyle = '#0b1020';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(eye.x - eye.r, -3.4);
      ctx.quadraticCurveTo(eye.x, -2.2, eye.x + eye.r, -3.4);
      ctx.stroke();
      continue;
    }
    // Almond eye: wider than tall and tilted, which is the single strongest
    // feline cue at this size.
    ctx.fillStyle = '#f7fbff';
    ctx.beginPath();
    ctx.ellipse(eye.x, -3.6, eye.r, eye.r * 0.72, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.ellipse(eye.x + 0.3, -3.5, eye.r * 0.76, eye.r * 0.64, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#07100d';
    ctx.beginPath();
    ctx.ellipse(eye.x + 0.4, -3.4, eye.r * 0.26, eye.r * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(eye.x - 0.1, -4.4, 0.7, 0, Math.PI * 2);
    ctx.fill();
    // Dark upper eyeliner anchors the eye to the skull.
    ctx.strokeStyle = '#0b1020';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(eye.x, -3.7, eye.r + 0.2, eye.r * 0.72, -0.08, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  }

  // Brow markings.
  ctx.strokeStyle = shade(color, 0.5);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-4, -8);
  ctx.lineTo(-1, -7.3);
  ctx.moveTo(2.6, -7.6);
  ctx.lineTo(5.4, -8.2);
  ctx.stroke();

  // Head rim light.
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.45;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 5;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(-0.5, -3.5, 8.6, Math.PI * 1.08, Math.PI * 1.72);
  ctx.stroke();
  ctx.restore();

  // ---------------------------------------------------------------- scarf
  // Neck scarf with two tails trailing over the shoulder. Drawn on top of the
  // torso so it reads as fabric, not as a painted patch.
  const scarfWave = Math.sin(phase * 0.8 + 1.2) * (moving ? 3.2 : 1.5);
  ctx.save();
  ctx.translate(7, -25 + bob);
  ctx.strokeStyle = outline;
  ctx.lineWidth = 4.8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-8, -3 + scarfWave * 0.4, -17, -1 + scarfWave);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 1.2);
  ctx.quadraticCurveTo(-7, 5 - scarfWave * 0.3, -12, 7 + scarfWave * 0.7);
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 4;
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-8, -3 + scarfWave * 0.4, -17, -1 + scarfWave);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 1.2);
  ctx.quadraticCurveTo(-7, 5 - scarfWave * 0.3, -12, 7 + scarfWave * 0.7);
  ctx.stroke();
  // Knot.
  ctx.shadowBlur = 0;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(-1.2, 0.6, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // -------------------------------------------------------------- blaster
  // A compact wrist blaster held in front of the chest. The arm connects back
  // to the shoulder, so it never looks like a floating gun.
  ctx.save();
  ctx.translate(16, -20 + bob);
  ctx.rotate(lean * 0.4);
  ctx.strokeStyle = outline;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-5, 2);
  ctx.lineTo(-1, 1.4);
  ctx.stroke();
  ctx.strokeStyle = furMid;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-5, 2);
  ctx.lineTo(-1, 1.4);
  ctx.stroke();
  ctx.fillStyle = '#121a2e';
  ctx.strokeStyle = '#050912';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-1.8, -2, 11, 4.4, 1.7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7186a8';
  ctx.beginPath();
  ctx.roundRect(0, -1.4, 6, 1.1, 0.5);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.roundRect(6.3, -1.3, 2.5, 2.4, 0.7);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#d4e2f5';
  ctx.fillRect(9.2, -0.8, 3.2, 2);
  ctx.fillStyle = '#050912';
  ctx.fillRect(12, -0.5, 1.2, 1.4);
  if (shooting) {
    const flash = 4 + Math.sin(t * 60) * 1.1;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,214,140,0.92)';
    ctx.beginPath();
    ctx.arc(14.8, 0.3, flash, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(15.5, 0.3, flash * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();

  ctx.restore();
};
