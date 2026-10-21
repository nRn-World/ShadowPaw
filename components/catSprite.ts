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

  // Weapon + muzzle flash
  ctx.fillStyle = '#dfe8f5';
  ctx.fillRect(9, -19, 13, 3.4);
  ctx.fillStyle = '#8fa3bd';
  ctx.fillRect(9, -16, 5, 3);
  if (shooting) {
    ctx.fillStyle = 'rgba(255,236,150,0.95)';
    ctx.beginPath();
    ctx.arc(24, -17, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(25, -17, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};
