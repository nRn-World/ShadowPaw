/**
 * Small, self-contained canvas render modules extracted from the gameplay
 * view. They take a CanvasRenderingContext2D and a GameState snapshot, so the
 * drawing rules can be changed without touching the simulation.
 */
import { drawCatSprite } from './catSprite';
import type { GameState } from '../game/types';

/** Checkpoint beacons: unreached ones are dim, a reached one burns cyan so the
    player can see exactly where a fall will put them back. */
export const drawCheckpointBeacons = (
  ctx: CanvasRenderingContext2D,
  game: GameState,
  canvasWidth: number,
) => {
  (game.checkpoints || []).forEach((cx, i) => {
    const sx = cx - game.scrollX;
    if (sx < -40 || sx > canvasWidth + 40) return;
    const reached = i < (game.checkpointIndex || 0);
    ctx.save();
    ctx.globalAlpha = reached ? 1 : 0.5;
    ctx.strokeStyle = reached ? '#7ee7ff' : '#93a8bd';
    ctx.fillStyle = reached ? '#7ee7ff' : '#93a8bd';
    ctx.lineWidth = 2;
    ctx.shadowColor = reached ? '#7ee7ff' : 'transparent';
    ctx.shadowBlur = reached ? 12 : 0;
    ctx.beginPath();
    ctx.moveTo(sx, game.groundY);
    ctx.lineTo(sx, game.groundY - 58);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx, game.groundY - 58);
    ctx.lineTo(sx + 24, game.groundY - 49);
    ctx.lineTo(sx, game.groundY - 40);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
};

/** Ghost of the best run on this exact seed. Drawn under the live cat so it
    reads as a pace-setter, never as an obstacle. */
export const drawGhost = (ctx: CanvasRenderingContext2D, game: GameState) => {
  if (!game.ghost?.frames) return;
  const gf = game.ghost.frames[Math.floor((game.frame || 0) / 4)];
  if (!gf) return;
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.globalCompositeOperation = 'lighter';
  drawCatSprite(ctx, gf[0] + 25 - game.scrollX, gf[1] + 70, {
    color: '#a855f7', accent: '#e9d5ff', t: Date.now() / 1000,
    running: false, jumping: false, grounded: true, speed: 0, vy: 0,
    phase: 0, dashing: false, blinking: false, shooting: false,
    facing: gf[2] === -1 ? -1 : 1, sx: 0.9, sy: 1.1,
  });
  ctx.restore();
};

/** Blackout: the stage goes dark except for a lantern glow around the cat.
    The event was physics-only before, which meant the player was told "the
    lights go out" and nothing happened. Drawn after the grade so it really
    does read as a power cut, and the glow keeps the cat findable. */
export const drawBlackout = (
  ctx: CanvasRenderingContext2D,
  game: GameState,
  o: { width: number; height: number; strength: number },
) => {
  const k = Math.max(0, Math.min(1, o.strength));
  if (k <= 0.01) return;
  const px = (game.player?.x ?? 0) - game.scrollX + (game.player?.width ?? 40) / 2;
  const py = (game.player?.y ?? 0) + (game.player?.height ?? 40) / 2;

  ctx.save();
  // Dim the whole frame, then punch a hole with a radial gradient around the
  // cat. Using one radial fill (opaque at the edges, clear at the centre) is
  // cheaper and softer than an even-odd clip.
  const r = 210;
  const g = ctx.createRadialGradient(px + 20, py, 24, px + 20, py, r);
  g.addColorStop(0, `rgba(4,6,14,${0.06 * k})`);
  g.addColorStop(0.45, `rgba(4,6,14,${0.55 * k})`);
  g.addColorStop(1, `rgba(4,6,14,${0.92 * k})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, o.width, o.height);

  // Warm lantern halo around the cat, so a silhouette against a black stage
  // still reads as a character rather than a hole in the screen.
  const halo = ctx.createRadialGradient(px, py, 4, px, py, 120);
  halo.addColorStop(0, `rgba(255,225,150,${0.30 * k})`);
  halo.addColorStop(0.5, `rgba(255,190,110,${0.10 * k})`);
  halo.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(px, py, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** Gold rush: coins and sparkles lift off the stage while the multiplier is on.
    Cheap, deterministic-by-time particles, so it costs nothing to run every
    frame and never allocates. */
export const drawGoldRush = (
  ctx: CanvasRenderingContext2D,
  game: GameState,
  o: { width: number; height: number; strength: number; time: number },
) => {
  const k = Math.max(0, Math.min(1, o.strength));
  if (k <= 0.01) return;
  const t = o.time;
  ctx.save();
  ctx.globalAlpha = 0.9 * k;

  // A warm wash over the whole frame keeps the effect visible even if every
  // spark is off-screen.
  const wash = ctx.createLinearGradient(0, 0, 0, o.height);
  wash.addColorStop(0, 'rgba(255,209,102,0.16)');
  wash.addColorStop(0.6, 'rgba(255,180,60,0.05)');
  wash.addColorStop(1, 'rgba(255,209,102,0.12)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, o.width, o.height);

  const COINS = 22;
  for (let i = 0; i < COINS; i++) {
    // Golden-ratio spacing scatters the coins without a random table.
    const phase = (i * 0.61803398875 + t * 0.08) % 1;
    const x = ((i * 137.5) % o.width + phase * 40) - game.scrollX * (0.25 + (i % 3) * 0.15);
    const wrapped = ((x % o.width) + o.width) % o.width;
    const y = o.height - phase * (o.height * 0.9);
    const spin = Math.sin(t * 4 + i) ;
    const r = 5 + (i % 3) * 2;
    ctx.save();
    ctx.translate(wrapped, y);
    ctx.globalAlpha = 0.85 * k * Math.sin(phase * Math.PI);
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#6b4708';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // A spinning coin reads as an ellipse that narrows, not a rotating disc.
    ctx.ellipse(0, 0, Math.abs(spin) * r + 1.5, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Sparkle ticks in the corners of the playfield.
  for (let i = 0; i < 10; i++) {
    const a = t * 0.7 + i * 0.9;
    const x = o.width * (0.1 + 0.8 * ((Math.sin(a * 0.7 + i) + 1) / 2));
    const y = o.height * (0.08 + 0.34 * ((Math.cos(a * 0.5 + i * 1.3) + 1) / 2));
    const s = 3 + 2 * Math.abs(Math.sin(a * 2));
    ctx.globalAlpha = k * (0.4 + 0.5 * Math.abs(Math.sin(a * 1.7)));
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.4, y - s * 0.4);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x + s * 0.4, y + s * 0.4);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.4, y + s * 0.4);
    ctx.lineTo(x - s, y);
    ctx.lineTo(x - s * 0.4, y - s * 0.4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
};
