import React, { useEffect, useRef, useState } from 'react';
import { useProgress } from '../context/ProgressContext';
import { drawCatSprite } from './catSprite';
import { useT, tr } from '../i18n';

/**
 * Attract mode for the start screen: a short, looping "live run" that shows
 * what the game actually is - the cat sprinting through a park, hopping a
 * crate, shooting a drone, then a rainy night stretch and a boss fight - before
 * it fades back to the park.
 *
 * It is a hand-drawn canvas loop rather than the real engine on purpose: the
 * engine expects a full level, input and audio, and a 20 second demo must never
 * fight the player for the GPU while the menu is open. Nothing here is
 * gameplay-affecting, and it pauses when scrolled out of view.
 */

const W = 480;
const H = 270;
const GROUND_Y = 208;
const CAT_X = 118;
const LOOP_SECONDS = 21;

type SceneKind = 'park' | 'rain' | 'boss';

interface Scene {
  until: number;
  kind: SceneKind;
  label: string;
  sky: [string, string, string];
  hill: string;
  mid: string;
  ground: [string, string];
  accent: string;
}

const SCENES: Scene[] = [
  {
    until: 7,
    kind: 'park',
    label: 'PARKEN',
    sky: ['#0b4770', '#3a9ed4', '#a7e0f5'],
    hill: '#3d86ab',
    mid: '#2c6e8e',
    ground: ['#5cb84e', '#27531f'],
    accent: '#2bee79',
  },
  {
    until: 13,
    kind: 'rain',
    label: 'REGZONEN',
    sky: ['#16233f', '#36466f', '#665074'],
    hill: '#2b3c5c',
    mid: '#22324c',
    ground: ['#2f5f40', '#0d1f15'],
    accent: '#7ee7ff',
  },
  {
    until: LOOP_SECONDS,
    kind: 'boss',
    label: 'BOSSFIGHT',
    sky: ['#2a1436', '#743544', '#cf7448'],
    hill: '#42202f',
    mid: '#2c1520',
    ground: ['#362718', '#120c07'],
    accent: '#ff8f6b',
  },
];

// Scripted beats. Crate beats are the moment the obstacle reaches the cat, so
// the jump is scheduled slightly before it; shot beats are when the trigger is
// pulled and the hit lands a moment later.
const CRATES = [2.4, 5.6, 8.2, 11.9];
const JUMPS = CRATES.map((t) => t - 0.22);
const FISH = [1.2, 9.0, 18.2];
const DRONES = [4.0, 10.4];
const SHOTS = [3.7, 10.1, 14.0, 14.8, 15.6, 18.9];
const BOSS_APPEARS = 13.2;
// The third shot leaves the gun at 15.6 and needs ~0.45 s to cross to the
// boss, so the fight is decided at 16.05 - not when the trigger is pulled.
const BOSS_DIES = 16.1;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Height of the cat above the ground for a given time, if it is jumping. */
const jumpOffset = (t: number) => {
  for (const start of JUMPS) {
    const p = (t - start) / 0.82;
    if (p >= 0 && p <= 1) return -Math.sin(p * Math.PI) * 58;
  }
  return 0;
};

const drawSky = (ctx: CanvasRenderingContext2D, scene: Scene) => {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, scene.sky[0]);
  g.addColorStop(0.55, scene.sky[1]);
  g.addColorStop(1, scene.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
};

const drawSun = (ctx: CanvasRenderingContext2D, scene: Scene) => {
  const night = scene.kind !== 'park';
  const x = scene.kind === 'boss' ? 372 : 386;
  const y = scene.kind === 'boss' ? 92 : 52;
  const halo = ctx.createRadialGradient(x, y, 0, x, y, 74);
  halo.addColorStop(0, night ? 'rgba(190,205,255,0.35)' : 'rgba(255,252,226,0.55)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - 80, y - 80, 160, 160);
  ctx.fillStyle = night ? '#e8f0ff' : '#fffbe6';
  ctx.beginPath();
  ctx.arc(x, y, night ? 15 : 18, 0, Math.PI * 2);
  ctx.fill();
};

const drawHills = (ctx: CanvasRenderingContext2D, scene: Scene, t: number) => {
  const drift = (t * 10) % W;
  ctx.fillStyle = scene.hill;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(-20, GROUND_Y);
  for (let x = -20; x <= W + 30; x += 12) {
    const wx = x + drift;
    const y = GROUND_Y - 34 - Math.sin(wx * 0.018) * 16 - Math.cos(wx * 0.041) * 8;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 30, GROUND_Y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = scene.mid;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(-20, GROUND_Y);
  for (let x = -20; x <= W + 30; x += 10) {
    const wx = x + drift * 2.2;
    const y = GROUND_Y - 14 - Math.sin(wx * 0.03 + 1.4) * 9 - Math.cos(wx * 0.07) * 5;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 30, GROUND_Y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
};

const drawSkyline = (ctx: CanvasRenderingContext2D, scene: Scene, t: number) => {
  if (scene.kind === 'park') {
    // A couple of pines to make the park read as a park.
    ctx.fillStyle = scene.mid;
    for (let i = 0; i < 5; i++) {
      const x = ((i * 121 - t * 12) % (W + 80) + W + 80) % (W + 80) - 40;
      const base = GROUND_Y + 2;
      const h = 46 + (i % 3) * 16;
      ctx.globalAlpha = 0.5;
      for (let tier = 0; tier < 3; tier++) {
        const top = base - h * (1 - tier * 0.28);
        const bot = base - h * (0.34 - tier * 0.1);
        const half = 9 + tier * 5;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x + half, bot);
        ctx.lineTo(x - half, bot);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    return;
  }
  // City silhouettes with a few lit windows, drifting slowly.
  for (let i = 0; i < 9; i++) {
    const span = W + 70;
    const x = ((i * 67 - t * (scene.kind === 'boss' ? 16 : 9)) % span + span) % span - 30;
    const h = 46 + ((i * 37) % 70);
    ctx.fillStyle = scene.mid;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x, GROUND_Y - h, 30 + (i % 3) * 12, h);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = scene.accent;
    for (let wy = GROUND_Y - h + 8; wy < GROUND_Y - 8; wy += 14) {
      if ((i + wy) % 3 === 0) ctx.fillRect(x + 5, wy, 5, 5);
    }
  }
  ctx.globalAlpha = 1;
};

const drawGround = (ctx: CanvasRenderingContext2D, scene: Scene, t: number) => {
  const g = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  g.addColorStop(0, scene.ground[0]);
  g.addColorStop(0.16, scene.ground[1]);
  g.addColorStop(0.36, scene.kind === 'park' ? '#3f2c17' : scene.kind === 'rain' ? '#1a2a20' : '#2a1d12');
  g.addColorStop(1, scene.kind === 'park' ? '#160f09' : '#0a0c0e');
  ctx.fillStyle = g;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  // Lit turf edge plus rolling blades that scroll with the run.
  ctx.fillStyle = scene.kind === 'park' ? 'rgba(212,255,170,0.9)' : scene.kind === 'rain' ? 'rgba(120,220,170,0.55)' : 'rgba(255,190,140,0.6)';
  ctx.fillRect(0, GROUND_Y, W, 1.6);
  ctx.strokeStyle = scene.kind === 'park' ? 'rgba(120,214,96,0.85)' : 'rgba(90,190,140,0.5)';
  ctx.lineWidth = 1.2;
  const offset = (t * 92) % 8;
  for (let x = -8; x < W + 8; x += 8) {
    const bx = x - offset;
    const blade = 3 + (Math.sin((bx + t * 92) * 0.6) + 1) * 2.6;
    ctx.beginPath();
    ctx.moveTo(bx, GROUND_Y + 1);
    ctx.quadraticCurveTo(bx + 1.5, GROUND_Y - blade * 0.6, bx + 3, GROUND_Y - blade);
    ctx.stroke();
  }
};

const drawCrate = (ctx: CanvasRenderingContext2D, x: number, scene: Scene) => {
  const w = 30;
  const h = 30;
  const y = GROUND_Y - h;
  ctx.fillStyle = '#3b2a19';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#8a6134';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 3);
  ctx.lineTo(x + w - 3, y + h - 3);
  ctx.moveTo(x + w - 3, y + 3);
  ctx.lineTo(x + 3, y + h - 3);
  ctx.strokeStyle = 'rgba(190,140,80,0.55)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = scene.accent;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(x, y, w, 2);
  ctx.globalAlpha = 1;
};

const drawFish = (ctx: CanvasRenderingContext2D, x: number, y: number, taken: boolean) => {
  if (taken) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffb648';
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(-13, -4);
  ctx.lineTo(-13, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a2a12';
  ctx.beginPath();
  ctx.arc(4, -1.2, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawDrone = (ctx: CanvasRenderingContext2D, x: number, y: number, alive: boolean, hitAt: number) => {
  if (!alive) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - hitAt * 1.6);
    ctx.strokeStyle = '#ff8f6b';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
      ctx.lineTo(x + Math.cos(a) * (12 + hitAt * 26), y + Math.sin(a) * (12 + hitAt * 26));
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#2a2f45';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff5f7a';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#ff5f7a';
  ctx.beginPath();
  ctx.arc(2.5, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,95,122,0.55)';
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

const drawCat = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, jumping: boolean, shooting: boolean) => {
  ctx.save();
  ctx.translate(x, y);
  // Feet stay planted at the origin, so scaling up does not lift the cat off
  // the ground; it just makes the sprite readable at hero-card size.
  ctx.scale(1.25, 1.25);
  // A one-pixel body bob is what sells "running" at this size.
  if (!jumping) ctx.translate(0, -Math.abs(Math.sin(t * 14)) * 1.8);
  // Shadow shrinks while airborne.
  const lift = Math.max(0, -y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(2, -lift - 1, 17 - Math.min(8, lift * 0.1), 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  drawCatSprite(ctx, 0, 0, { color: '#4169E1', t, running: true, jumping, shooting });
  ctx.restore();
};

const drawBoss = (ctx: CanvasRenderingContext2D, t: number, hp: number, dead: boolean) => {
  const x = 372;
  const y = GROUND_Y - 44;
  if (dead) {
    const p = clamp01((t - BOSS_DIES) / 0.9);
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = '#ffcf6b';
    ctx.lineWidth = 3;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (12 + p * 30), y + Math.sin(a) * (12 + p * 30));
      ctx.lineTo(x + Math.cos(a) * (30 + p * 70), y + Math.sin(a) * (30 + p * 70));
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  const bob = Math.sin(t * 3) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(1.08, 1.08);
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 44 - bob, 34, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hull
  ctx.fillStyle = '#5a2a34';
  ctx.beginPath();
  ctx.roundRect(-30, -6, 60, 50, 12);
  ctx.fill();
  ctx.strokeStyle = '#ff8f6b';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Head + horn
  ctx.fillStyle = '#6d3440';
  ctx.beginPath();
  ctx.roundRect(-22, -32, 44, 30, 9);
  ctx.fill();
  ctx.strokeStyle = '#ffb08f';
  ctx.stroke();
  ctx.fillStyle = '#ffcf6b';
  ctx.beginPath();
  ctx.moveTo(-20, -32);
  ctx.lineTo(-28, -46);
  ctx.lineTo(-10, -34);
  ctx.closePath();
  ctx.fill();
  // Eyes
  const glow = 0.6 + 0.4 * Math.sin(t * 8);
  ctx.fillStyle = `rgba(255,80,60,${glow})`;
  ctx.beginPath();
  ctx.arc(-9, -18, 4.6, 0, Math.PI * 2);
  ctx.arc(9, -18, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd7cf';
  ctx.beginPath();
  ctx.arc(-9, -18, 1.8, 0, Math.PI * 2);
  ctx.arc(9, -18, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Boss health bar, so a viewer instantly reads "boss fight". It lives below
  // the top edge on purpose: the hero card is wider than 16:9 and crops sky.
  const barW = 132;
  const barX = x - barW / 2;
  const barY = 74;
  ctx.fillStyle = 'rgba(6,10,18,0.72)';
  ctx.beginPath();
  ctx.roundRect(barX - 4, barY - 4, barW + 8, 16, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,143,107,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const health = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  health.addColorStop(0, '#ff4d6d');
  health.addColorStop(1, '#ffb26b');
  ctx.fillStyle = health;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW * clamp01(hp / 100), 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = 'bold 7px Outfit, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(tr('BOSS · SKUGGHUNDEN'), barX - 2, barY - 8);
};

const LiveRunDemo: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { progress } = useProgress();
  const t = useT();
  const lang = progress.settings.language;
  const reduceMotion = progress.settings.reduceMotion;
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setSupported(false);
      return;
    }

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    let frame = 0;
    let start = performance.now();
    let running = true;
    let disposed = false;

    const render = (elapsed: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const t = elapsed % LOOP_SECONDS;
      const scene = SCENES.find((s) => t < s.until) ?? SCENES[SCENES.length - 1];

      drawSky(ctx, scene);
      drawSun(ctx, scene);
      drawHills(ctx, scene, t);
      drawSkyline(ctx, scene, t);
      drawGround(ctx, scene, t);

      // Crates scroll towards the hunter; x is fixed at the beat they reach it.
      CRATES.forEach((beat) => {
        const x = CAT_X + 30 + (beat - t) * 96;
        if (x > -40 && x < W + 40) drawCrate(ctx, x, scene);
      });

      FISH.forEach((beat) => {
        const x = CAT_X + 60 + (beat - t) * 96;
        const y = GROUND_Y - 46 + Math.sin(t * 3 + beat) * 4;
        if (x > -20 && x < W + 20) drawFish(ctx, x, y, t > beat);
      });

      DRONES.forEach((beat, i) => {
        const x = CAT_X + 150 + (beat - t) * 40;
        const alive = t < beat;
        const hitAge = Math.max(0, t - beat);
        if (x > -30 && x < W + 30) drawDrone(ctx, x, GROUND_Y - 58 - (i % 2) * 10, alive, hitAge);
      });

      const bossHp = t < 14.45 ? 100 : t < 15.25 ? 70 : t < BOSS_DIES ? 40 : 0;
      if (t >= BOSS_APPEARS) drawBoss(ctx, t, bossHp, t > BOSS_DIES);

      // Bullets: every shot travels for ~0.42 s, which lines the impact up with
      // the drone/boss beats above.
      SHOTS.forEach((shot) => {
        const age = t - shot;
        if (age < 0 || age > 0.5) return;
        const bx = CAT_X + 26 + age * 520;
        const by = GROUND_Y - 20;
        ctx.fillStyle = 'rgba(180,255,220,0.95)';
        ctx.beginPath();
        ctx.ellipse(bx, by, 6, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(43,238,121,0.35)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx - 16, by);
        ctx.lineTo(bx, by);
        ctx.stroke();
      });

      const jump = jumpOffset(t);
      const shooting = SHOTS.some((s) => t >= s && t < s + 0.12);
      drawCat(ctx, CAT_X, GROUND_Y + jump, t, jump !== 0, shooting);

      // Rain, only in the night stretch.
      if (scene.kind === 'rain') {
        ctx.strokeStyle = 'rgba(170,200,255,0.4)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 46; i++) {
          const x = (i * 53 + t * 40) % W;
          const y = (i * 97 + t * 360) % (GROUND_Y + 10);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 2, y + 9);
          ctx.stroke();
        }
      }

      // Scene label + a soft vignette so the card feels like a viewfinder.
      // Inset from the edge: the hero card crops a few pixels left and right on
      // narrow screens, which used to bite the first letter off the label.
      ctx.fillStyle = 'rgba(4,8,16,0.6)';
      ctx.beginPath();
      ctx.roundRect(24, H - 34, 96, 22, 11);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = scene.accent;
      ctx.beginPath();
      ctx.arc(36, H - 23, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(tr(scene.label), 45, H - 19);

      if (t > BOSS_DIES + 0.5 && t < 19.8) {
        const p = clamp01((t - BOSS_DIES - 0.5) / 0.4);
        ctx.globalAlpha = p;
        ctx.fillStyle = '#0a1220';
        ctx.beginPath();
        ctx.roundRect(W / 2 - 62, 96, 124, 34, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(43,238,121,0.5)';
        ctx.stroke();
        ctx.fillStyle = '#2bee79';
        ctx.font = 'bold 13px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(tr('BOSS BESEGRAD'), W / 2, 118);
        ctx.globalAlpha = 1;
      }

      const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

      // Cross-fade the top of every scene change so cuts never jar.
      const since = scene === SCENES[0] ? t : t - (SCENES[SCENES.indexOf(scene) - 1]?.until ?? 0);
      if (since < 0.5) {
        ctx.fillStyle = `rgba(6,10,20,${1 - since / 0.5})`;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.textAlign = 'left';
    };

    if (reduceMotion) {
      render(3.0);
      return;
    }

    const tick = (now: number) => {
      if (disposed) return;
      if (running) render((now - start) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onVisibility = () => {
      running = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibility);

    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          running = entries.some((e) => e.isIntersecting) && !document.hidden;
        }, { threshold: 0.05 })
      : null;
    observer?.observe(canvas);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
    };
  }, [reduceMotion, lang]);

  if (!supported) return null;

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      // The card is wider than 16:9; cover from the bottom keeps the ground
      // and the cat in frame and crops sky instead of squashing the drawing.
      style={{ display: 'block', objectFit: 'cover', objectPosition: 'center bottom' }}
      aria-label={t('Demoloop: katten springer, hoppar, skjuter och besegrar en boss')}
      role="img"
    />
  );
};

export default LiveRunDemo;
