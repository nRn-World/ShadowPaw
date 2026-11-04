import type { GameState } from './types';

/**
 * Enemy behaviour + the shadow-only wraith. Kept out of the render/loop
 * monolith so the three basic archetypes can be tuned (and unit-tested)
 * independently of drawing.
 */

export const SHADOW_ENEMY_TYPE = 6;

/**
 * Types 0–2 used to share one identical patrol. Each now reads differently:
 *   0 Hound   – steady patrol that breaks into a chase when the cat is close.
 *   1 Skittish – freezes, then darts the *other* way when approached; bait it.
 *   2 Hopper  – stationary lane but hops on a fixed rhythm; time the jump.
 * Movement is clamped to the owning platform so no archetype can wander into
 * a pit and disappear.
 */
export const updateEnemyMotion = (e: any, game: GameState, platform: any) => {
  if (!platform) return;
  const playerCx = game.player.x + game.player.width / 2;
  const dx = playerCx - (e.x + e.width / 2);
  const dy = Math.abs((game.player.y + game.player.height / 2) - (e.y + e.height / 2));
  const baseSpeed = Math.abs(e.velocityX) || 1;
  const clampToPlatform = () => {
    if (e.isFlying) return;
    if (e.x < platform.x) { e.x = platform.x; e.velocityX = Math.abs(e.velocityX); e.direction = 1; }
    if (e.x + e.width > platform.x + platform.width) {
      e.x = platform.x + platform.width - e.width;
      e.velocityX = -Math.abs(e.velocityX);
      e.direction = -1;
    }
  };

  switch (e.type) {
    case 0: {
      // Hound: a readable acceleration, never an instant teleport.
      const chasing = Math.abs(dx) < 230 && dy < 110;
      const speed = baseSpeed * (chasing ? 1.5 : 1);
      if (chasing) e.direction = Math.sign(dx) || 1;
      e.x += e.direction * speed;
      e.velocityX = Math.abs(e.velocityX) * (e.direction || 1);
      clampToPlatform();
      break;
    }
    case 1: {
      // Skittish: a short freeze is the telegraph, then a fast retreat.
      if (e.feintTimer > 0) {
        e.feintTimer--;
        if (e.feintTimer === 0) {
          e.direction = -Math.sign(dx) || 1;
          e.velocityX = Math.abs(e.velocityX) * e.direction;
        }
        break;
      }
      if (Math.abs(dx) < 170 && dy < 100) {
        e.feintTimer = 26;
        break;
      }
      e.x += e.velocityX * 0.72;
      if (e.x < platform.x || e.x + e.width > platform.x + platform.width) {
        e.velocityX *= -1;
        e.direction = e.velocityX >= 0 ? 1 : -1;
      }
      clampToPlatform();
      break;
    }
    case 2: {
      // Hopper: vertical rhythm over a tiny horizontal drift.
      e.hopPhase = (e.hopPhase || 0) + 0.075;
      const hop = Math.max(0, Math.sin(e.hopPhase)) * 15;
      e.y = (e.baseY ?? e.y) - hop;
      e.x += Math.sin(e.hopPhase * 0.33) * 0.6;
      clampToPlatform();
      break;
    }
    case SHADOW_ENEMY_TYPE: {
      // Wraith: mirrors the cat's horizontal position at a distance, so it can
      // only be removed by a Shadow Shift pass, never out-run or shot.
      e.hover = (e.hover || 0) + 0.045;
      e.y = (e.baseY ?? e.y) + Math.sin(e.hover) * 7;
      const target = Math.sign(dx) || 1;
      e.x += target * Math.min(1.15, Math.abs(dx) * 0.012);
      e.velocityX = target * 1.15;
      clampToPlatform();
      break;
    }
    default:
      e.x += e.velocityX;
      if (e.x < platform.x || e.x + e.width > platform.x + platform.width) e.velocityX *= -1;
  }
};

/** A violet, translucent wraith. Its lack of eyes/outline is deliberate: it
    should read as something the normal rules cannot touch. */
export const drawShadowWraith = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, time: number,
) => {
  ctx.save();
  ctx.globalAlpha = 0.82;
  const pulse = 0.7 + Math.sin(time * 0.004) * 0.3;
  ctx.shadowColor = '#a855f7';
  ctx.shadowBlur = 22 * pulse;
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, 'rgba(216,180,254,0.95)');
  grad.addColorStop(0.55, 'rgba(126,34,206,0.85)');
  grad.addColorStop(1, 'rgba(30,10,50,0.15)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.quadraticCurveTo(x - 6, y + h * 0.45, x + w * 0.18, y + h * 0.12);
  ctx.quadraticCurveTo(x + w * 0.5, y - 5, x + w * 0.82, y + h * 0.12);
  ctx.quadraticCurveTo(x + w + 6, y + h * 0.45, x + w, y + h);
  // Three trailing wisps instead of feet.
  for (let i = 1; i <= 3; i++) {
    const px = x + (w * i) / 4;
    ctx.quadraticCurveTo(px - 5, y + h + 8 * pulse, px, y + h);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#f5d0fe';
  ctx.beginPath();
  ctx.arc(x + w * 0.36, y + h * 0.38, 2.6, 0, Math.PI * 2);
  ctx.arc(x + w * 0.64, y + h * 0.38, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};
