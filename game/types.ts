/**
 * Shared game-state types.
 *
 * The loop used to declare `type GameState = any`, which meant a typo in a
 * field name compiled fine and only showed up as a runtime bug. This module
 * describes the real shape of the state object created by `setupLevel`.
 * A small, explicitly documented `any` index signature remains for the handful
 * of legacy hot-path fields still being migrated; new fields must be declared
 * here rather than smuggled through it.
 */
import type { RunMode } from '../types';
import type { QualityBudget } from './quality';
import type { PerkDef, PerkEffect } from './perks';

export interface Rect { x: number; y: number; width: number; height: number }

export interface Platform extends Rect {
  color?: string;
  isGround?: boolean;
  solid?: boolean;
  bossArena?: boolean;
  bossWalkway?: boolean;
  chasm?: boolean;
  mover?: { axis: 'h' | 'v'; range: number; speed: number; phase: number; originX?: number; originY?: number };
}

export interface PlayerState extends Rect {
  velocityX: number;
  velocityY: number;
  speed: number;
  baseSpeed: number;
  facing: number;
  invincible: boolean;
  invincibleTimer: number;
  /** Fields below are added lazily by the physics loop; optional so the
      freshly-created state object still satisfies the interface. */
  grounded?: boolean;
  squash?: number;
  stretch?: number;
  runCycle?: number;
  isBlinking?: boolean;
  blinkTimer?: number;
  onGround?: boolean;
  [key: string]: any;
}

export interface EnemyState extends Rect {
  type: number;
  velocityX: number;
  direction?: number;
  platform: number;
  baseY?: number;
  isShadow?: boolean;
  shadowKilled?: boolean;
  nearMissed?: boolean;
  feintTimer?: number;
  hopPhase?: number;
  hover?: number;
  aggroTo?: boolean;
  shootTimer?: number;
  chargeTimer?: number;
  summoned?: boolean;
  [key: string]: any;
}

export interface BossState extends Rect {
  hp: number;
  maxHp: number;
  phase: number;
  type: string;
  name: string;
  velocityX: number;
  velocityY: number;
  platformX: number;
  platformW: number;
  groundY: number;
  tier: number;
  moveIndex: number;
  telegraph: number;
  telegraphTotal?: number;
  pendingMove: string | null;
  attackTimer: number;
  attackCooldown: number;
  projectiles: Array<Rect & { vx: number; vy: number; radius: number; life: number; color: string; kind: string }>;
  stunTimer: number;
  auraAngle: number;
  encountered: boolean;
  isMini?: boolean;
  coreExposed?: number;
  coreFlash?: number;
  shadowHitShift?: number;
  summonCooldown?: number;
}

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }

export interface GameState {
  /* Run identity ------------------------------------------------------- */
  running: boolean;
  level: number;
  runMode: RunMode;
  dailySeed: string;
  seedOffset: number;
  frame: number;
  /* Score & progression ------------------------------------------------- */
  score: number;
  lives: number;
  startLives?: number;
  ammo: number;
  xp: number;
  runLevel: number;
  xpIntoLevel: number;
  xpNeeded: number;
  combo: number;
  comboTimer: number;
  bestComboInRun: number;
  streak: number;
  bestStreak: number;
  multiplier: number;
  multiplierTimer: number;
  lastMilestoneMultiplier?: number;
  nearMisses: number;
  coinsThisLevel: number;
  fishedThisLevel: number;
  totalCollectedInLevel: number;
  fishGoal: number;
  killsThisLevel: number;
  enemiesDefeatedInRun: number;
  levelsCompletedInRun: number;
  bossDefeatedInRun: boolean;
  deathsInRun: number;
  noHit: boolean;
  /* World --------------------------------------------------------------- */
  levelLength: number;
  groundY: number;
  scrollX: number;
  gravity: number;
  friction: number;
  weather: string;
  intensity: string;
  timeOfDay: string;
  theme: string;
  layout: string;
  levelType: string;
  levelTimer: number;
  levelTimerBudget: number;
  levelSeconds: number;
  introTimer: number;
  introMax: number;
  screenShake: number;
  hitStop: number;
  slowMo: number;
  zoomPunch: number;
  shootCooldown: number;
  shield: boolean;
  buffs: Record<string, number>;
  keys: Record<number, boolean>;
  /* Entities ------------------------------------------------------------ */
  player: PlayerState;
  platforms: Platform[];
  holes: Array<Rect & { width: number }>;
  fishes: Rect[];
  enemies: EnemyState[];
  bullets: Particle[];
  enemyBullets: Particle[];
  particles: Particle[];
  floatingTexts: Array<{ x: number; y: number; text: string; life: number; color: string }>;
  toasts: Array<{ text: string; color: string; life: number; maxLife: number }>;
  hazards: Rect[];
  pickups: Rect[];
  springPads: Rect[];
  weatherParticles: Array<Record<string, number>>;
  backgroundElements: unknown[];
  jerry: Rect;
  boss: BossState | null;
  /** Opaque lightning render state owned by the canvas renderer. */
  lightning: any;
  /* New systems --------------------------------------------------------- */
  quality: QualityBudget;
  bgCache: HTMLCanvasElement | null;
  bgCacheKey: string;
  shadowCharge: number;
  shadowActive: number;
  shadowShiftId: number;
  shadowPasses: number;
  shadowShifts: number;
  checkpoints: number[];
  checkpointIndex: number;
  checkpointX: number;
  activePerks: string[];
  perkEffects: Required<PerkEffect>;
  perkOffer: PerkDef[];
  showFishWarning: boolean;
  lastStatUpdate: number;
  /* Migration escape hatch: undeclared legacy fields still compile, but every
     field above is checked. Remove only when the hot paths are fully typed. */
  [key: string]: any;
}

/** The React HUD reads a snapshot once per ~100 ms, not the live state object. */
export interface HudStats {
  ammo: number;
  shield: boolean;
  dashReady: boolean;
  dashPct: number;
  shadowCharge: number;
  shadowActive: number;
  magnet: number;
  rapid: number;
  progress: number;
  levelType: string;
  combo: number;
  runLevel: number;
  xpIntoLevel: number;
  xpNeeded: number;
  bossHp: number;
  bossMaxHp: number;
  bossName: string;
  bossVisible: boolean;
  collectedCount: number;
  fishGoal: number;
  fishDir: number;
  goalDist: number;
  levelTimer: number;
  fps?: number;
  qualityTier?: number;
  /** The live snapshot still carries a few legacy HUD fields; new ones belong
      in the list above instead of here. */
  [key: string]: any;
}
