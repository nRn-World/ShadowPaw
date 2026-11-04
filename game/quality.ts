/**
 * Adaptive quality. Measures real frame time, then steps the visual budget down
 * when the device cannot hold 60 fps and back up once it has recovered. The
 * switch is opt-out in Settings and never changes gameplay physics.
 */
export type QualityTier = 0 | 1 | 2; // 0 = full, 1 = balanced, 2 = lean

export interface QualityBudget {
  tier: QualityTier;
  particleLimit: number;
  weatherScale: number;
  bloom: boolean;
  atmosphere: boolean;
  cacheBackground: boolean;
}

const BUDGETS: Record<QualityTier, QualityBudget> = {
  0: { tier: 0, particleLimit: 320, weatherScale: 1, bloom: true, atmosphere: true, cacheBackground: false },
  1: { tier: 1, particleLimit: 160, weatherScale: 0.6, bloom: false, atmosphere: true, cacheBackground: false },
  2: { tier: 2, particleLimit: 80, weatherScale: 0.35, bloom: false, atmosphere: false, cacheBackground: true },
};

export const FULL_QUALITY = BUDGETS[0];

export interface QualityMonitor {
  sample: (deltaMs: number, enabled: boolean) => QualityBudget;
  reset: () => void;
  current: () => QualityBudget;
}

export const createQualityMonitor = (): QualityMonitor => {
  let ema = 1000 / 60;
  let tier: QualityTier = 0;
  let slowFor = 0;
  let fastFor = 0;

  return {
    sample(deltaMs, enabled) {
      if (!enabled) {
        tier = 0;
        slowFor = 0;
        fastFor = 0;
        return BUDGETS[tier];
      }
      // Tab throttling / alt-tab produces huge deltas; ignore them rather than
      // deciding the device is slow because someone switched windows.
      const dt = deltaMs > 0 && deltaMs < 120 ? deltaMs : 1000 / 60;
      ema = ema * 0.9 + dt * 0.1;
      const fps = 1000 / ema;
      if (fps < 45) { slowFor += dt; fastFor = 0; }
      else if (fps > 57) { fastFor += dt; slowFor = 0; }
      else { slowFor = Math.max(0, slowFor - dt); fastFor = Math.max(0, fastFor - dt); }
      // Hysteresis: 1.5 s of slow frames to step down, 8 s of clean frames to
      // step back up. That prevents a quality oscillation on a busy frame.
      if (slowFor > 1500 && tier < 2) { tier = (tier + 1) as QualityTier; slowFor = 0; }
      else if (fastFor > 8000 && tier > 0) { tier = (tier - 1) as QualityTier; fastFor = 0; }
      return BUDGETS[tier];
    },
    reset() { ema = 1000 / 60; tier = 0; slowFor = 0; fastFor = 0; },
    current() { return BUDGETS[tier]; },
  };
};
