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
