/**
 * The cat, drawn once and shared by the real game canvas and the start-screen
 * demo so the menu always shows the cat the player actually controls.
 *
 * Origin is the cat's feet; the sprite is ~50 wide and ~44 tall at scale 1 and
 * faces right (pass facing -1 to mirror).
 */

export interface CatSpriteOpts {
  color: string;
  accent?: string;
  /** seconds-based clock for the run cycle and tail */
  t: number;
  running: boolean;
  jumping: boolean;
  shooting?: boolean;
  facing?: 1 | -1;
  sx?: number;
  sy?: number;
}

/** Darken a #rrggbb colour; anything else is returned unchanged. */
const shade = (hex: string, k: number) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const c = (v: number) => Math.round(v * k);
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
};

export const drawCatSprite = (ctx: CanvasRenderingContext2D, x: number, y: number, o: CatSpriteOpts) => {
  const { color, t, running, jumping, shooting = false, facing = 1, sx = 1, sy = 1 } = o;
  const eye = o.accent && o.accent.length > 4 ? o.accent : '#2bee79';
  const run = Math.sin(t * 14);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx * facing, sy);
  ctx.lineCap = 'round';

  // Tail
  ctx.strokeStyle = shade(color, 0.78);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-13, -12);
  ctx.quadraticCurveTo(-25, -16 + run * 3, -22, -26 + run * 2);
  ctx.stroke();

  // Legs
  ctx.strokeStyle = shade(color, 0.9);
  ctx.lineWidth = 4.5;
  const legSwing = jumping ? 4 : running ? run * 5 : 0;
  ctx.beginPath();
  ctx.moveTo(-5, -10);
  ctx.lineTo(-5 - legSwing, 0);
  ctx.moveTo(6, -10);
  ctx.lineTo(6 + legSwing, 0);
  ctx.stroke();

  // Body + head
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, -15, 14, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6, -26, 12.5, 11.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.beginPath();
  ctx.moveTo(-2, -35);
  ctx.lineTo(0, -44);
  ctx.lineTo(6, -36);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(11, -35);
  ctx.lineTo(16, -43);
  ctx.lineTo(17, -33);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e88fb4';
  ctx.beginPath();
  ctx.moveTo(1, -36);
  ctx.lineTo(2, -41);
  ctx.lineTo(5, -36);
  ctx.closePath();
  ctx.fill();

  // Muzzle, eyes and whiskers
  ctx.fillStyle = '#e8f4ff';
  ctx.beginPath();
  ctx.ellipse(11, -24, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0d2a18';
  ctx.beginPath();
  ctx.arc(5, -30, 3.4, 0, Math.PI * 2);
  ctx.arc(14, -30, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.arc(5.6, -30.4, 1.7, 0, Math.PI * 2);
  ctx.arc(14.6, -30.4, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff9ecb';
  ctx.beginPath();
  ctx.moveTo(9.5, -23);
  ctx.lineTo(12.5, -23);
  ctx.lineTo(11, -21);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(240,248,255,0.7)';
  ctx.lineWidth = 0.9;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(15, -24 + i * 2);
    ctx.lineTo(24, -25 + i * 3.4);
    ctx.stroke();
  }

  // Weapon + muzzle flash. It is deliberately chunky: at menu size the cat is
  // only ~90 px tall, and a thin pale rectangle read as a straw in its mouth.
  // A dark frame with a bright energy cell and a short barrel stays a blaster.
  ctx.save();
  ctx.translate(7, -21);
  // Grip, tucked under the body of the gun.
  ctx.fillStyle = '#0a1120';
  ctx.beginPath();
  ctx.roundRect(1, 5, 5, 5.5, 1.6);
  ctx.fill();
  // Main frame.
  ctx.fillStyle = '#1a2740';
  ctx.strokeStyle = '#060b16';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(0, 0.6, 16, 5.6, 2);
  ctx.fill();
  ctx.stroke();
  // Top rail highlight.
  ctx.fillStyle = '#7690b3';
  ctx.beginPath();
  ctx.roundRect(1.6, 1.5, 8.2, 1.5, 0.7);
  ctx.fill();
  // Energy cell glows in the cat's eye colour.
  ctx.fillStyle = eye;
  ctx.shadowColor = eye;
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.roundRect(10.4, 1.4, 3.4, 3.2, 0.9);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Barrel and dark muzzle ring.
  ctx.fillStyle = '#c3d8f2';
  ctx.fillRect(15.6, 2.1, 2.8, 2.6);
  ctx.fillStyle = '#0a1120';
  ctx.fillRect(18, 2.6, 1.4, 1.6);
  if (shooting) {
    const flash = 4.5 + Math.sin(t * 60) * 1.2;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,206,120,0.9)';
    ctx.beginPath();
    ctx.arc(21.5, 3.6, flash, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(22.3, 3.6, flash * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
};
