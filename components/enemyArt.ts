/**
 * Cartoon enemy art.
 *
 * The enemies used to be drawn with thin gradients, soft glows and no outline,
 * which made them look like stock clip-art pasted next to the hand-drawn hero.
 * Every enemy here follows the same rules as the cat: a thick warm outline, two
 * flat body tones plus one highlight, a big readable eye and a squash-and-
 * stretch idle. Types map to the existing behaviour in game/enemies.ts:
 *
 *   0 hound      1 skittish (rabbit-fox)   2 hopper (frog)
 *   3 turret     4 charger (beetle)        5 hover drone
 */

export interface EnemyArtOpts {
  type: number;
  /** Top-left of the hitbox, already converted to screen space. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Clock in ms. */
  now: number;
  facing: 1 | -1;
  /** Short telegraph flags owned by the simulation. */
  charging?: boolean;
  winding?: boolean;
  aggro?: boolean;
  /** Used to pick the charge colour on the beetle and the eye on the turret. */
  flash?: number;
}

const INK = '#241a2e';

const ink = (ctx: CanvasRenderingContext2D, width = 3) => {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
};

/** Soft elliptical contact shadow. */
const groundShadow = (ctx: CanvasRenderingContext2D, cx: number, y: number, w: number) => {
  ctx.fillStyle = 'rgba(20, 12, 30, 0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, y, w * 0.46, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
};

/** Big cartoon eye: white sclera, coloured iris, ink pupil, one specular dot. */
const toonEye = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  iris: string,
  lookX = 0,
  lookY = 0,
) => {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, Math.max(1.4, r * 0.28));
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(x + lookX * r * 0.28, y + lookY * r * 0.28, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + lookX * r * 0.34, y + lookY * r * 0.34, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
};

/**
 * A cartoon hound: barrel body, heavy brow, floppy ears and a spiked collar.
 * Trot is driven by the clock so a stopped hound still breathes.
 */
export const drawHound = (ctx: CanvasRenderingContext2D, o: EnemyArtOpts) => {
  const { x, y, w, h, now, facing } = o;
  const cx = x + w / 2;
  const baseY = y + h;
  const t = now / 1000;
  const trot = Math.sin(now / 95) * 2.4;
  const breath = Math.sin(t * 2.2) * 1.2;

  ctx.save();
  groundShadow(ctx, cx, baseY + 2, w);

  // Tail: a stubby curl that wags faster when the hound is chasing.
  ctx.strokeStyle = '#3a2418';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - facing * (w * 0.34), baseY - h * 0.5);
  ctx.quadraticCurveTo(
    cx - facing * (w * 0.56),
    baseY - h * 0.62 + Math.sin(now / 120) * 5,
    cx - facing * (w * 0.5),
    baseY - h * 0.78,
  );
  ctx.stroke();

  // Legs (two visible paws, stepping in place while trotting).
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side, i) => {
    ctx.beginPath();
    ctx.moveTo(cx + side * w * 0.2, baseY - h * 0.34);
    ctx.lineTo(cx + side * w * 0.22, baseY - 2 + (i ? trot : -trot));
    ctx.stroke();
  });

  // Body: one fat rounded barrel.
  const body = ctx.createLinearGradient(cx, y + h * 0.3, cx, baseY - 4);
  body.addColorStop(0, '#9a5a3a');
  body.addColorStop(0.6, '#6f3d26');
  body.addColorStop(1, '#4a2517');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx - facing * 2, baseY - h * 0.46 + breath, w * 0.44, h * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, 3);

  // Chest patch, so the silhouette is not one flat blob.
  ctx.fillStyle = '#c98d63';
  ctx.beginPath();
  ctx.ellipse(cx + facing * w * 0.2, baseY - h * 0.4, w * 0.2, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head.
  const headX = cx + facing * w * 0.3;
  const headY = y + h * 0.3 + breath * 0.5;
  ctx.fillStyle = '#7d4529';
  ctx.beginPath();
  ctx.ellipse(headX, headY, w * 0.29, h * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, 3);

  // Snout.
  ctx.fillStyle = '#c98d63';
  ctx.beginPath();
  ctx.ellipse(headX + facing * w * 0.17, headY + h * 0.08, w * 0.16, h * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, 2.4);
  // Nose.
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(headX + facing * w * 0.3, headY + h * 0.2, 4.4, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Floppy ears.
  [-1, 1].forEach((side) => {
    ctx.fillStyle = side > 0 ? '#5a3119' : '#6b3a1f';
    ctx.beginPath();
    ctx.ellipse(headX - side * w * 0.16, headY - h * 0.12, w * 0.11, h * 0.2, side * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ink(ctx, 2.2);
  });

  // Angry brow + eyes.
  toonEye(ctx, headX + facing * w * 0.05, headY - h * 0.02, Math.max(4.6, w * 0.11), '#ffcf5c', facing, 0.35);
  toonEye(ctx, headX + facing * w * 0.2, headY, Math.max(4, w * 0.09), '#ffcf5c', facing, 0.35);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(headX - w * 0.06, headY - h * 0.16);
  ctx.lineTo(headX + facing * w * 0.3, headY - h * 0.06);
  ctx.stroke();

  // Spiked collar.
  ctx.strokeStyle = '#e63946';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(headX - facing * w * 0.1, headY + h * 0.2);
  ctx.lineTo(headX - facing * w * 0.32, headY + h * 0.3);
  ctx.stroke();
  ctx.fillStyle = '#e8eef7';
  for (let i = 0; i < 3; i++) {
    const sx = headX - facing * (w * 0.12 + i * w * 0.07);
    const sy = headY + h * (0.16 + i * 0.05);
    ctx.beginPath();
    ctx.moveTo(sx, sy - 3);
    ctx.lineTo(sx + 2.6, sy + 3.5);
    ctx.lineTo(sx - 2.6, sy + 3.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
};

/** A skittish fox-rabbit: long ears, quick feet, wide eyes. */
export const drawSkittish = (ctx: CanvasRenderingContext2D, o: EnemyArtOpts) => {
  const { x, y, w, h, now, facing } = o;
  const cx = x + w / 2;
  const baseY = y + h;
  const t = now / 1000;
  const hop = Math.abs(Math.sin(now / 210)) * 3;
  const earTwitch = Math.sin(t * 3.1) * 0.12;

  ctx.save();
  groundShadow(ctx, cx, baseY + 2, w * 0.9);

  // Ears behind the head, one flicking.
  [-1, 1].forEach((side) => {
    ctx.save();
    ctx.translate(cx + side * w * 0.12, y + h * 0.36);
    ctx.rotate(side * 0.12 + (side > 0 ? earTwitch : 0));
    ctx.fillStyle = side > 0 ? '#e8622f' : '#d4551f';
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.26, w * 0.1, h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ink(ctx, 2.4);
    ctx.fillStyle = '#ffc4a8';
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.26, w * 0.055, h * 0.21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Legs.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(cx + side * w * 0.14, baseY - h * 0.3);
    ctx.lineTo(cx + side * w * 0.2, baseY - 2);
    ctx.stroke();
  });

  // Body, pear shaped.
  const body = ctx.createLinearGradient(cx, y + h * 0.4, cx, baseY - 4);
  body.addColorStop(0, '#ff8a4c');
  body.addColorStop(0.65, '#e8622f');
  body.addColorStop(1, '#b3441a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx, baseY - h * 0.36 - hop, w * 0.34, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, 3);

  // Cream belly.
  ctx.fillStyle = '#ffe6d2';
  ctx.beginPath();
  ctx.ellipse(cx + facing * w * 0.06, baseY - h * 0.28 - hop, w * 0.18, h * 0.19, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head.
  const headY = y + h * 0.3 - hop;
  ctx.fillStyle = '#f2712f';
  ctx.beginPath();
  ctx.ellipse(cx + facing * w * 0.06, headY, w * 0.26, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, 3);
  // Muzzle + nose.
  ctx.fillStyle = '#ffe6d2';
  ctx.beginPath();
  ctx.ellipse(cx + facing * w * 0.2, headY + h * 0.06, w * 0.13, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx + facing * w * 0.3, headY + h * 0.04, 2.8, 0, Math.PI * 2);
  ctx.fill();

  // Wide, startled eyes.
  toonEye(ctx, cx + facing * w * 0.02, headY - h * 0.04, Math.max(4.6, w * 0.1), '#2b8fd8', facing, 0.2);
  toonEye(ctx, cx + facing * w * 0.18, headY - h * 0.05, Math.max(4.2, w * 0.09), '#2b8fd8', facing, 0.2);

  // Tail with a white tip.
  ctx.fillStyle = '#d4551f';
  ctx.beginPath();
  ctx.ellipse(cx - facing * w * 0.4, baseY - h * 0.4 - hop, w * 0.16, h * 0.12, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, 2.4);
  ctx.fillStyle = '#fff6ee';
  ctx.beginPath();
  ctx.arc(cx - facing * w * 0.48, baseY - h * 0.46 - hop, w * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** A hopper frog: squat, springy, with a wide grin. */
export const drawHopper = (ctx: CanvasRenderingContext2D, o: EnemyArtOpts) => {
  const { x, y, w, h, now, facing } = o;
  const cx = x + w / 2;
  const baseY = y + h;
  const squash = Math.sin(now / 260);
  const sy = 1 - squash * 0.08;
  const sx = 1 + squash * 0.1;

  ctx.save();
  groundShadow(ctx, cx, baseY + 2, w * 0.95);
  ctx.translate(cx, baseY);
  ctx.scale(sx, sy);

  // Back legs, bent and ready.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(side * w * 0.2, -h * 0.34);
    ctx.quadraticCurveTo(side * w * 0.42, -h * 0.28, side * w * 0.34, -2);
    ctx.stroke();
  });

  // Body: a wide dome.
  const body = ctx.createLinearGradient(0, -h, 0, 0);
  body.addColorStop(0, '#7be08a');
  body.addColorStop(0.6, '#3fb457');
  body.addColorStop(1, '#1f7a3c');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.42, w * 0.46, h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, 3);

  // Pale belly.
  ctx.fillStyle = '#dcffd0';
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.26, w * 0.28, h * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes on top of the head: the classic frog read.
  const eyeY = -h * 0.74;
  [-1, 1].forEach((side) => {
    ctx.fillStyle = '#5fce74';
    ctx.beginPath();
    ctx.arc(side * w * 0.2, eyeY, w * 0.19, 0, Math.PI * 2);
    ctx.fill();
    ink(ctx, 2.6);
    toonEye(ctx, side * w * 0.2, eyeY, w * 0.12, '#ffd166', facing * 0.6, 0.3);
  });

  // Grin.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.arc(facing * w * 0.04, -h * 0.36, w * 0.24, 0.18 * Math.PI, 0.82 * Math.PI);
  ctx.stroke();
  ctx.restore();
};

/** An armoured sentry pod on a tripod, with a scanning eye. */
export const drawTurret = (ctx: CanvasRenderingContext2D, o: EnemyArtOpts) => {
  const { x, y, w, h, now, winding } = o;
  const cx = x + w / 2;
  const baseY = y + h;
  const cy = y + h * 0.5;
  const eye = winding ? '#ff3b3b' : '#59d2ff';
  const pulse = 0.5 + 0.5 * Math.sin(now / (winding ? 70 : 260));

  ctx.save();
  groundShadow(ctx, cx, baseY + 2, w);
  // Tripod.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  [-1, 0, 1].forEach((leg) => {
    ctx.beginPath();
    ctx.moveTo(cx + leg * 4, cy + 8);
    ctx.lineTo(cx + leg * 15, baseY - 1);
    ctx.stroke();
  });
  // Pod.
  const pod = ctx.createLinearGradient(cx, cy - 16, cx, cy + 14);
  pod.addColorStop(0, '#8fa3c4');
  pod.addColorStop(0.55, '#5a6b88');
  pod.addColorStop(1, '#2d3648');
  ctx.fillStyle = pod;
  ctx.beginPath();
  ctx.roundRect(cx - 17, cy - 15, 34, 30, 12);
  ctx.fill();
  ink(ctx, 3);
  // Shoulder fins.
  ctx.fillStyle = '#7386a6';
  ctx.beginPath();
  ctx.roundRect(cx - 23, cy - 6, 8, 13, 4);
  ctx.roundRect(cx + 15, cy - 6, 8, 13, 4);
  ctx.fill();
  ink(ctx, 2.2);
  // Eye.
  ctx.save();
  ctx.shadowColor = eye;
  ctx.shadowBlur = winding ? 20 : 10;
  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.arc(cx, cy, winding ? 7 : 5.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx + Math.sin(now / 420) * 1.6, cy, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.stroke();
  // Warning ring while winding up.
  if (winding) {
    ctx.strokeStyle = `rgba(255,70,70,${0.35 + pulse * 0.5})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cx, cy, 15 + pulse * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
};

/** A charger beetle: purple shell, glowing horn, legs that scuttle. */
export const drawCharger = (ctx: CanvasRenderingContext2D, o: EnemyArtOpts) => {
  const { x, y, w, h, now, facing, charging } = o;
  const cx = x + w / 2;
  const baseY = y + h;
  const scuttle = Math.sin(now / 55) * 2;

  ctx.save();
  groundShadow(ctx, cx, baseY + 2, w);
  // Legs.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.4;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + side * (7 + i * 8), y + h * 0.55);
      ctx.lineTo(cx + side * (17 + i * 8), baseY - 2 + (i ? scuttle : -scuttle));
      ctx.stroke();
    }
  });
  // Shell.
  const shell = ctx.createLinearGradient(cx, y + 4, cx, baseY);
  if (charging) {
    shell.addColorStop(0, '#ff9e7a');
    shell.addColorStop(0.55, '#e2452f');
    shell.addColorStop(1, '#7a1710');
  } else {
    shell.addColorStop(0, '#a98bff');
    shell.addColorStop(0.55, '#7c3aed');
    shell.addColorStop(1, '#3b1e78');
  }
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.56, w * 0.52, h * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, 3);
  // Shell seam and spots.
  ctx.strokeStyle = 'rgba(20,10,30,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, y + h * 0.14);
  ctx.lineTo(cx, y + h * 0.5);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(cx - 8, y + h * 0.34, 2.6, 0, Math.PI * 2);
  ctx.arc(cx + 9, y + h * 0.3, 2.2, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  const headX = cx + facing * w * 0.36;
  ctx.fillStyle = charging ? '#ffd0bd' : '#4a3382';
  ctx.beginPath();
  ctx.arc(headX, y + h * 0.6, w * 0.19, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, 2.4);
  // Horn.
  ctx.fillStyle = charging ? '#fff3a8' : '#ffd166';
  ctx.beginPath();
  ctx.moveTo(headX + facing * 4, y + h * 0.5);
  ctx.lineTo(headX + facing * w * 0.34, y + h * 0.26);
  ctx.lineTo(headX + facing * 2, y + h * 0.4);
  ctx.closePath();
  ctx.fill();
  ink(ctx, 2);
  // Eye.
  toonEye(ctx, headX + facing * 2, y + h * 0.62, Math.max(3.6, w * 0.09), charging ? '#ffffff' : '#ffb3c1', facing, 0);
  if (charging) {
    ctx.strokeStyle = `rgba(255,90,60,${0.45 + 0.35 * Math.sin(now / 70)})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(cx, y + h * 0.55, w * 0.7 + Math.sin(now / 70) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
};

/** A hovering drone: two rotors, a rounded pod and one big scanning eye. */
export const drawDrone = (ctx: CanvasRenderingContext2D, o: EnemyArtOpts) => {
  const { x, y, w, h, now, aggro } = o;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const spin = now / 26;
  const bob = Math.sin(now / 320) * 2;
  const eye = aggro ? '#ff4060' : '#59d2ff';

  ctx.save();
  ctx.translate(0, bob);
  // Rotor arms + blades.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    const rx = cx + side * w * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx + side * w * 0.16, cy - h * 0.1);
    ctx.lineTo(rx, y + 4);
    ctx.stroke();
    ctx.save();
    ctx.translate(rx, y + 4);
    ctx.rotate(spin * (side > 0 ? 1 : -1));
    ctx.strokeStyle = 'rgba(190,220,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(11, 0);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#4a5a78';
    ctx.beginPath();
    ctx.arc(rx, y + 4, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ink(ctx, 1.8);
  });
  // Pod.
  const pod = ctx.createLinearGradient(cx, cy - h * 0.4, cx, cy + h * 0.5);
  pod.addColorStop(0, '#dbe6f7');
  pod.addColorStop(0.5, '#8fa3c4');
  pod.addColorStop(1, '#46536d');
  ctx.fillStyle = pod;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, w * 0.36, h * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ink(ctx, 3);
  // Eye.
  ctx.save();
  ctx.shadowColor = eye;
  ctx.shadowBlur = aggro ? 18 : 9;
  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.arc(cx, cy, 5.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx + Math.sin(spin / 30) * 1.6, cy, 2.2, 0, Math.PI * 2);
  ctx.fill();
  // Belly light and antenna.
  ctx.fillStyle = aggro ? '#ff4060' : '#2bee79';
  ctx.beginPath();
  ctx.arc(cx - w * 0.34, cy + h * 0.28, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** One entry point: picks the right cartoon enemy for a simulation type. */
export const drawCartoonEnemy = (ctx: CanvasRenderingContext2D, o: EnemyArtOpts) => {
  switch (o.type) {
    case 0: drawHound(ctx, o); break;
    case 1: drawSkittish(ctx, o); break;
    case 2: drawHopper(ctx, o); break;
    case 3: drawTurret(ctx, o); break;
    case 5: drawDrone(ctx, o); break;
    default: drawCharger(ctx, o); break;
  }
};
