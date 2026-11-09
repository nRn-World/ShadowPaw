
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AppView, ScoreEntry, RunMode } from '../types';
import LiveRunDemo from './LiveRunDemo';
import { drawCatSprite } from './catSprite';

import CatPreview from './CatPreview';
import { drawAtmosphere, drawBloom } from './worldArt';
import {
  drawBackdrop, drawGroundSlab, drawLedge, drawChasm, drawEarth,
  paletteFor, familyForTheme, blend, withAlpha,
} from './cartoonWorld';
import { getJerryTaunt } from '../services/taunts';
import { useProgress, isReducedMotion } from '../context/ProgressContext';
import { useInstall } from '../context/InstallContext';
import { AudioEngine } from '../services/AudioEngine';
import { useT, tr, renderRich, LanguageButtons } from '../i18n';
import {
  loadGhost, saveGhost, loadDailyScores, recordDailyScore,
  readDailyStreak, touchDailyStreak,
} from '../game/daily';
import { getTopDeathCause, getMostDangerousLevel, type DeathCause } from '../game/telemetry';
import { PERK_BY_ID, combinePerkEffects, offerPerks, type PerkDef } from '../game/perks';
import { SHADOW_ENEMY_TYPE, updateEnemyMotion, drawShadowWraith } from '../game/enemies';
import { haptic } from '../game/haptics';
import {
  getLevelTwist, twistPhysics, pickEvent, EVENTS, TWISTS,
  type ActiveEvent, type EventId,
} from '../game/twists';
import { createQualityMonitor, FULL_QUALITY } from '../game/quality';
import type { GameState, HudStats } from '../game/types';
import { ShadowShiftMeter, ObjectivePill } from './GameHud';
import { drawCartoonEnemy } from './enemyArt';
import { drawCheckpointBeacons, drawGhost } from './gameRender';
import {
  getLevelDesign, getDifficultyProfile, getLevelLayout, LEVEL_LAYOUT_META,
  buildLevelLayout, makeRng, getWeatherForLevel, seededRandom,
  GROUND_COLOR, hashSeed, getDailySeed, dailyLevelFromSeed,
  getCheckpoints,
} from '../game/level';

/** Permanent cinematic crop for the stage. Kept as one constant so the render
    transform and the pointer→world conversion can never drift apart. */
const STAGE_ZOOM = 1.14;

const getSeasonTheme = () => {
  const month = new Date().getMonth();
  if (month === 11 || month <= 1) return 'winter';
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  return 'autumn';
};

/** Human-facing labels and goals for the five level modes. Kept in one place
    so the intro card, HUD and results screen always agree. */
const LEVEL_MODE_META: Record<string, { label: string; short: string; goal: string; accent: string }> = {
  Classic: { label: 'Klassisk runda', short: 'KLASSISK', goal: 'Nå fiskkvoten och rädda Jerry', accent: '#2bee79' },
  Collection: { label: 'Insamling', short: 'INSAMLING', goal: 'Extra många fiskar · varje fisk ger mynt', accent: '#ffd166' },
  Survival: { label: 'Överlevnad', short: 'ÖVERLEVNAD', goal: 'Tätare faror · håll streaken vid liv', accent: '#ff8f6b' },
  'Speed Run': { label: 'Tidsjakt', short: 'TIDSJAKT', goal: 'Klockan tickar · varje fisk köper tid', accent: '#7ee7ff' },
  'Boss Battle': { label: 'Bosskamp', short: 'BOSSKAMP', goal: 'Besegra bossen och samla fiskarna', accent: '#ff5f8a' },
};

const CHAPTER_NAMES = [
  'Neon City', 'Regnzonen', 'Höghusen', 'Skogsbrynet', 'Industrihamnen',
  'Snögränsen', 'Kraftverket', 'Övergivna kvarter', 'Motorvägen', 'Glaciären',
  'Rymdstationen', 'Vulkanen', 'Underjorden', 'Himmelsbron', 'Kärnkraften',
  'Laboratoriet', 'Datacentret', 'Arktis', 'Krigszonen', 'Kvantskiftet',
  'Inferno', 'Mardrömmen', 'Tomrummet', 'Kaoset', 'Askfallet',
  'Avgrunden', 'Glömskan', 'Pandemonium', 'Apokalypsen', 'Harmagedon',
  'Titanen', 'Hades', 'Tartaros', 'Nexus', 'Omega',
  'Oändligheten', 'Transcendens', 'Upplysningen', 'Uppstigningen', 'Legenden',
];

/** Display name for the place a level actually takes place in. The chapter list
    above is a narrative grouping, but the level card used to print "Neon City"
    over a sunny meadow; this maps the stage's own theme to the right name. */
const THEME_PLACE_NAMES: Record<string, string> = {
  park: 'Parken',
  suburban: 'Förstaden',
  city: 'Storstaden',
  downtown: 'Citykärnan',
  industrial: 'Industrin',
  construction: 'Bygget',
  beach: 'Stranden',
  mountain: 'Fjället',
  forest: 'Skogen',
  harbor: 'Hamnen',
  sewers: 'Kloakerna',
  alpine: 'Högfjället',
  rooftops: 'Taken',
  countryside: 'Landsbygden',
  ice_cave: 'Isgrottan',
  glacier: 'Glaciären',
  arctic_base: 'Arktis',
  power_plant: 'Kraftverket',
  nuclear: 'Kärnkraften',
  datacenter: 'Datacentret',
  laboratory: 'Laboratoriet',
  quantum: 'Kvantskiftet',
  abandoned: 'Övergivna kvarter',
  highway: 'Motorvägen',
  warzone: 'Krigszonen',
  underground: 'Underjorden',
  sky_bridge: 'Himmelsbron',
  space_station: 'Rymdstationen',
  volcano: 'Vulkanen',
  hell: 'Inferno',
  inferno: 'Askfallet',
  hades: 'Hades',
  tartarus: 'Tartaros',
  void: 'Tomrummet',
  abyss: 'Avgrunden',
  oblivion: 'Glömskan',
  nightmare: 'Mardrömmen',
  chaos: 'Kaoset',
  pandemonium: 'Pandemonium',
  apocalypse: 'Apokalypsen',
  armageddon: 'Harmagedon',
  titan: 'Titanen',
  nexus: 'Nexus',
  omega: 'Omega',
  infinity: 'Oändligheten',
  transcendence: 'Transcendens',
  enlightenment: 'Upplysningen',
  ascension: 'Uppstigningen',
  legendary: 'Legenden',
};

/** Place name for a stage, falling back to the chapter grouping. */
const placeForLevel = (level: number, theme?: string): string => {
  const direct = theme ? THEME_PLACE_NAMES[String(theme).toLowerCase()] : undefined;
  if (direct) return direct;
  return CHAPTER_NAMES[(Math.max(1, level) - 1) % CHAPTER_NAMES.length] || 'Neon City';
};

const SKINS: Record<string, { name: string; color: string; accent: string; unlockHint: string; original?: boolean }> = {
  // The default skin shows the baked art in its own colours (no tint), so the
  // cat looks exactly like the source artwork instead of a recoloured variant.
  default: { name: 'Original', color: '#4169E1', accent: '#2bee79', unlockHint: 'Standardskinn', original: true },
  ember: { name: 'Ember', color: '#e85d2c', accent: '#ffcf6b', unlockHint: 'Besegra 60 fiender' },
  frost: { name: 'Frost', color: '#62b7ff', accent: '#9df3ff', unlockHint: 'Samla 300 fiskar' },
  shadow: { name: 'Shadow', color: '#4f5d75', accent: '#b07cff', unlockHint: 'Nå combo x10' },
  umbra: { name: 'Umbra', color: '#6d28d9', accent: '#d8b4fe', unlockHint: 'Använd skuggskifte' },
  aurora: { name: 'Aurora', color: '#29b88f', accent: '#5ffbd0', unlockHint: 'Besegra 3 bossar' },
};

const ACHIEVEMENTS: Array<{ id: string; label: string; desc: string; icon: string }> = [
  { id: 'flawless', label: 'Felfri', desc: 'Klara en nivå utan skada', icon: 'verified' },
  { id: 'combo_10', label: 'Combo x10', desc: 'Kedja 10 aktioner', icon: 'local_fire_department' },
  { id: 'enemy_60', label: 'Jägare', desc: 'Besegra 60 fiender', icon: 'swords' },
  { id: 'fish_300', label: 'Fiskare', desc: 'Samla 300 fiskar', icon: 'set_meal' },
  { id: 'boss_3', label: 'Bossjägare', desc: 'Besegra 3 bossar', icon: 'swords' },
  { id: 'streak_20', label: 'Streak x20', desc: 'Håll en streak på 20', icon: 'bolt' },
  { id: 'close_call', label: 'Nära ögat', desc: '5 nästan-träffar i en runda', icon: 'warning' },
  { id: 'shadow_shift', label: 'Skuggtass', desc: 'Använd skuggskifte för första gången', icon: 'dark_mode' },
];


/** Compact stat tile used across the menus. */
const StatTile: React.FC<{ icon: string; label: string; value: React.ReactNode; tone: string; glow: string }> = ({
  icon,
  label,
  value,
  tone,
  glow,
}) => (
  <div
    className="card-premium px-2 py-3 transition-colors duration-200 hover:border-white/20"
    style={{ background: `linear-gradient(180deg, ${glow} 0%, rgba(255,255,255,0.02) 100%)` }}
  >
    <span className={`material-symbols-outlined text-base ${tone}`}>{icon}</span>
    <p className={`tabular mt-0.5 text-lg font-black ${tone}`}>{value}</p>
    <p className="eyebrow mt-0.5">{label}</p>
  </div>
);

/** Secondary menu action with an icon, a label and an optional accent bar. */
const MenuButton: React.FC<{
  icon: string;
  label: string;
  onClick: () => void;
  subtle?: boolean;
  accent?: string;
}> = ({ icon, label, onClick, subtle, accent }) => (
  <button
    onClick={onClick}
    className={`group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-3 font-bold uppercase tracking-wide transition-all duration-200 active:scale-[0.98] sm:gap-2.5 sm:px-4 sm:tracking-wider ${
      subtle ? 'py-3 text-[12px] text-white/70 sm:text-sm' : 'py-4 text-white'
    } card-premium card-premium-hover`}
  >
    {accent && (
      <span
        className="absolute inset-y-0 left-0 w-1 opacity-70 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: accent }}
      />
    )}
    <span className={`material-symbols-outlined transition-transform duration-200 group-hover:scale-110 ${subtle ? 'text-[20px] text-white/50' : 'text-[22px] text-primary'}`}>
      {icon}
    </span>
    <span className="truncate">{label}</span>
  </button>
);

/** Dazed cat shown on the game over screen. Same visual language as the hero
    mark, so the mascot stays consistent across the game. */
const InjuredCatVisual: React.FC = () => (
  <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
    <div className="relative size-64 md:size-80">
      {/* Orbiting stars */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 animate-stars-orbit">
        <svg viewBox="0 0 200 200" className="h-32 w-32 md:h-40 md:w-40">
          <g fill="#fbbf24">
            <circle cx="100" cy="14" r="6" opacity="0.95" />
            <circle cx="170" cy="100" r="4" opacity="0.7" />
            <circle cx="100" cy="186" r="5" opacity="0.85" />
            <circle cx="30" cy="100" r="4" opacity="0.6" />
          </g>
        </svg>
      </div>

      <svg viewBox="0 0 120 120" className="animate-dizzy h-full w-full" role="img" aria-label="Cat">
        <defs>
          <radialGradient id="hurtBody" cx="38%" cy="30%" r="78%">
            <stop offset="0%" stopColor="#6d92ff" />
            <stop offset="60%" stopColor="#3a5fd8" />
            <stop offset="100%" stopColor="#22368f" />
          </radialGradient>
          <clipPath id="headClip">
            <circle cx="60" cy="64" r="36" />
          </clipPath>
        </defs>

        <path d="M28 34 L36 8 L56 26 Z" fill="#1b2f7a" />
        <path d="M92 34 L84 8 L64 26 Z" fill="#1b2f7a" />
        <circle cx="60" cy="64" r="36" fill="url(#hurtBody)" stroke="#141f4d" strokeWidth="1.5" />

        {/* Swirly + X eyes */}
        <g clipPath="url(#headClip)">
          <circle cx="45" cy="59" r="10" fill="#f8fafc" />
          <circle cx="75" cy="59" r="10" fill="#f8fafc" />
          <path d="M45 51 A8 8 0 0 1 53 59 A8 8 0 0 1 45 67" stroke="#22c55e" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M70 54 L80 64 M80 54 L70 64" stroke="#0b1a3a" strokeWidth="3.4" strokeLinecap="round" />
        </g>

        <path d="M60 72 L66 78 L54 78 Z" fill="#f472b6" />
        {/* Frowning mouth */}
        <path d="M48 88 Q60 80 72 88" stroke="#0b1a3a" strokeWidth="2.6" fill="none" strokeLinecap="round" />

        {/* Bandage across the forehead */}
        <g transform="rotate(-18 60 40)">
          <rect x="24" y="26" width="72" height="19" rx="5" fill="#f8fafc" />
          <rect x="24" y="26" width="72" height="19" rx="5" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
          <circle cx="84" cy="35.5" r="3.4" fill="#dc2626" opacity="0.7" />
        </g>
      </svg>
    </div>

    <style>{`
      @keyframes dizzy {
        0%, 100% { transform: rotate(-3deg) translateY(0); }
        50% { transform: rotate(3deg) translateY(-10px); }
      }
      @keyframes stars-orbit {
        from { transform: translateX(-50%) rotate(0deg); }
        to { transform: translateX(-50%) rotate(360deg); }
      }
      .animate-dizzy { animation: dizzy 4s ease-in-out infinite; }
      .animate-stars-orbit { animation: stars-orbit 7s linear infinite; }
    `}</style>
  </div>
);

/** START MENU **/
/** The attract-mode card on the start screen: a live slice of play, the next
    story goal and the player's rank. It renders once in the mobile flow and
    once in the desktop hero column, so both share this single definition. */
const HeroShowcase: React.FC<{ storyLevel: number; rank: number }> = ({ storyLevel, rank }) => {
  const t = useT();
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#050a15] shadow-[0_40px_120px_-50px_rgba(0,0,0,1)]">
      {/* Attract mode: a real gameplay clip recorded from the game itself. The
          cat sprints through a level, hops crates, shoots drones and grabs fish,
          so the first screen shows how Shadow Paw actually plays before the
          visitor presses anything. */}
      <div className="group/canvas relative h-52 overflow-hidden bg-[#0d1b2c] md:h-60">
        <div className="absolute inset-0">
          {/* The attract loop is drawn live in the same cartoon style as the
              game, so the first thing a visitor sees is the real art
              direction instead of a recording of an older build. */}
          <LiveRunDemo />
        </div>
        <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 backdrop-blur-md">
          <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/70">{t('Live run')}</span>
        </div>
      </div>

      <div className="relative border-t border-white/10 bg-white/[0.02] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">{t('Nästa mål')}</p>
            <p className="text-xs font-bold text-white/85">{t('Kapitel {c} · nivå {n}', { c: Math.ceil(storyLevel / 5), n: storyLevel })}</p>
          </div>
          <span className="rounded-lg border border-primary/25 bg-primary/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-primary">
            {t('Rank {n}', { n: rank })}
          </span>
        </div>
      </div>
    </div>
  );
};

export const StartMenuView: React.FC<{
  onNavigate: (v: AppView) => void;
  onStart: (level?: number, mode?: RunMode) => void;
}> = ({ onNavigate, onStart }) => {
  const { progress } = useProgress();
  const t = useT();

  // Use the same padded local-date seed that setupLevel and the ghost/board
  // use, so the level on the button is exactly the course that gets loaded.
  const todaySeed = getDailySeed();
  const dailyLevel = dailyLevelFromSeed(todaySeed);
  const questsDone = progress.dailyQuests.filter((q) => q.completed).length;
  // Campaign progress, not account rank: these are different things, and the
  // card used to promise chapter 1 forever even after clearing a dozen levels.
  const storyLevel = progress.campaignLevel;
  const clearedLevels = Math.min(40, Math.max(0, storyLevel - 1));
  // A first visit deserves a way in, not six zeroes.
  const hasPlayed =
    clearedLevels > 0 ||
    progress.stats.totalFishCollected > 0 ||
    progress.stats.totalEnemiesDefeated > 0 ||
    progress.stats.bossesDefeated > 0 ||
    progress.stats.perfectLevels > 0;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 md:py-10 animate-fade-in-up">
      <div className="grid items-center gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
        {/* ------------------------------------------------------- hero copy */}
        <div>
          <img
            src="./icon.svg"
            alt=""
            className="size-11 shrink-0 rounded-[13px] ring-1 ring-white/10 shadow-[0_12px_34px_-16px_rgba(43,238,121,0.85)]"
          />

          <h1 className="mt-5 font-display text-[3.4rem] font-black uppercase leading-[0.86] tracking-tight md:text-[5.2rem]">
            <span className="block display-title">Shadow</span>
            <span className="mt-1 block paw-title">Paw</span>
          </h1>

          <div className="mt-5 lg:hidden">
            <HeroShowcase storyLevel={storyLevel} rank={progress.level} />
          </div>

          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/60 md:text-base">
            {t('Neonstaden har tagit Jerry. Spring, hoppa och skjut dig genom 40+ handbyggda kapitel – bygg streaken, besegra bossarna och ta tillbaka natten.')}
          </p>

          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
            <button onClick={() => onStart(1)} className="toon-btn toon-btn-green cta-breathe group flex-1 px-7 py-4 text-base">
              <span className="material-symbols-outlined text-2xl transition-transform duration-200 group-hover:translate-x-0.5">
                play_arrow
              </span>
              <span>{t('Spela nu')}</span>
            </button>
            <button
              onClick={() => onStart(dailyLevel, 'daily')}
              className="toon-btn px-5 py-4 text-[11px] uppercase tracking-[0.14em]"
              title={t('Starta direkt på nivå {n}', { n: dailyLevel })}
            >
              <span className="material-symbols-outlined text-lg text-primary">bolt</span>
              {t('Dagens runda · nivå {n}', { n: dailyLevel })}
            </button>
          </div>

          <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row">
            {storyLevel > 1 && (
              <button
                onClick={() => onStart(storyLevel)}
                className="toon-btn group flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] text-[#0c3a20] sm:flex-1 sm:justify-start"
              >
                <span className="material-symbols-outlined text-base transition-transform duration-200 group-hover:translate-x-0.5">resume</span>
                {t('Fortsätt · nivå {n}', { n: storyLevel })}
              </button>
            )}
            <button
              onClick={() => onNavigate(AppView.LEVELS)}
              className="toon-btn group flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] sm:flex-1 sm:justify-start"
            >
              <span className="material-symbols-outlined text-base transition-transform duration-200 group-hover:translate-x-0.5">map</span>
              {t('Kapitelkarta · {a}/{b}', {
                a: Math.min(40, Math.max(0, storyLevel - 1)),
                b: 40,
              })}
            </button>
          </div>

          {/* Shared daily seed: everyone gets the same course on the same date.
              The board and streak are local-only, so no account is needed. */}
          <div className="toon-card-dark mt-3 px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-primary">calendar_today</span>
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/70">{t('Dagens runda · {d}', { d: todaySeed })}</span>
              </span>
              <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-primary">
                <span className="material-symbols-outlined text-sm">local_fire_department</span>
                {t('Streak {n}', { n: readDailyStreak().count })}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              {loadDailyScores(todaySeed).length === 0 ? (
                <span className="text-[10px] text-white/40">{t('Inga rundor än – bli först på dagens topp 3!')}</span>
              ) : loadDailyScores(todaySeed).slice(0, 3).map((e, i) => (
                <span key={i} className="tabular text-[11px] font-black text-white/65">
                  <span className="text-primary">#{i + 1}</span> {e.score.toLocaleString()}
                  <span className="ml-1 text-[9px] font-bold text-white/30">{t('nivå {n}', { n: e.level })}</span>
                </span>
              ))}
            </div>
          </div>

        </div>

        {/* ----------------------------------------------------- hero panel */}
        <div className="relative">
          <div className="hidden lg:block">
            <HeroShowcase storyLevel={storyLevel} rank={progress.level} />
          </div>

          {/* Career stats: three numbers that mean something. A first visit gets
              a way in instead, because six zeroes say nothing about the game. */}
          {hasPlayed ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { icon: 'monetization_on', label: t('Mynt'), value: progress.coins, tone: 'text-yellow-400' },
                { icon: 'local_fire_department', label: t('Bästa combo'), value: progress.stats.bestCombo, tone: 'text-cyan-300' },
                { icon: 'set_meal', label: t('Fiskar'), value: progress.stats.totalFishCollected, tone: 'text-sky-300' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border-2 border-[#0a0f20] bg-[#1b2447] px-2 py-2 shadow-[0_3px_0_0_#0a0f20]">
                  <div className="flex items-center gap-1">
                    <span className={`material-symbols-outlined text-[13px] ${s.tone}`}>{s.icon}</span>
                    <span className="tabular text-sm font-black text-white">{s.value}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] font-black uppercase tracking-wider text-white/40">{s.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <button
              onClick={() => onNavigate(AppView.HOW_TO_PLAY)}
              className="toon-card-dark group mt-3 flex w-full items-center gap-3 p-3.5 text-left transition-transform hover:-translate-y-0.5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#0c3a20] bg-[#8ff5b6] text-[#0c3a20] shadow-[0_3px_0_0_#0c3a20]">
                <span className="material-symbols-outlined text-[19px]">sports_esports</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-primary/80">{t('Så spelar du')}</span>
                <span className="mt-1 block text-xs leading-snug text-white/50">
                  {t('Spring, hoppa och skjut – allt du behöver på 30 sekunder.')}
                </span>
              </span>
              <span className="material-symbols-outlined shrink-0 text-white/25 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary">chevron_right</span>
            </button>
          )}

          {/* Daily quests */}
          <div className="toon-card-dark mt-3 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-primary">task_alt</span>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/70">{t('Dagliga uppdrag')}</p>
              </div>
              <button
                onClick={() => onNavigate(AppView.QUESTS)}
                className="text-[9px] font-black uppercase tracking-wider text-primary/80 transition-colors hover:text-primary"
              >
                {t('Alla {a}/{b} →', { a: questsDone, b: progress.dailyQuests.length })}
              </button>
            </div>
            <div className="mt-2.5 space-y-2">
              {progress.dailyQuests.map((q) => {
                const pct = Math.min(100, (q.current / Math.max(1, q.target)) * 100);
                return (
                  <div key={q.id}>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-[10px] font-bold ${q.completed ? 'text-primary' : 'text-white/60'}`}>
                        {t(q.description)}
                      </p>
                      <span className="tabular shrink-0 text-[9px] font-black text-white/35">
                        {Math.min(q.current, q.target)}/{q.target}
                      </span>
                    </div>
                    <div className="toon-bar mt-1.5">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------- footer nav */}
      <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        <MenuButton icon="store" label={t('Butik')} onClick={() => onNavigate(AppView.SHOP)} />
        <MenuButton icon="task_alt" label={t('Uppdrag')} onClick={() => onNavigate(AppView.QUESTS)} />
        <MenuButton icon="help" label={t('Så spelar du')} onClick={() => onNavigate(AppView.HOW_TO_PLAY)} subtle />
        <MenuButton icon="emoji_events" label={t('Topplista')} onClick={() => onNavigate(AppView.LEADERBOARD)} subtle />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
        <button onClick={() => onNavigate(AppView.SETTINGS)} className="transition-colors hover:text-white/80">
          {t('Inställningar')}
        </button>
        <span aria-hidden="true">·</span>
        <span>{t('Neon City · 40 kapitel')}</span>
        <span aria-hidden="true">·</span>
        <span className="text-white/20">v2.0</span>
      </div>
    </div>
  );
};

/** SETTINGS **/
/** The chunky comic toggle used across Settings: a two-tone track plus an
    outlined knob, so an on/off state reads at a glance. */
const ToonSwitch: React.FC<{ on: boolean }> = ({ on }) => (
  <span
    className={`relative h-6 w-11 shrink-0 rounded-full border-2 transition-colors ${
      on ? 'border-[#0c3a20] bg-[#8ff5b6]' : 'border-[#12182b]/35 bg-[#12182b]/15'
    }`}
    aria-hidden="true"
  >
    <span
      className={`absolute top-[1px] size-[18px] rounded-full border-2 transition-all duration-200 ${
        on ? 'left-[22px] border-[#0c3a20] bg-white' : 'left-[1px] border-[#12182b]/40 bg-white'
      }`}
    />
  </span>
);

export const SettingsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { progress, updateSettings, toggleMuted, exportProgressCode, importProgressCode } = useProgress();
  const { canInstall, installed, offlineReady, install } = useInstall();
  const t = useT();
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [importCode, setImportCode] = useState('');
  const [syncMessage, setSyncMessage] = useState('');

  const { muted, musicVolume: music, sfxVolume: sfx } = progress.settings;

  // The app-level audio effect already applies mute + SFX volume everywhere;
  // these two only push the live menu music element while Settings is open.
  useEffect(() => {
    document.querySelectorAll<HTMLAudioElement>('audio[data-menu-music]').forEach((a) => {
      a.volume = muted ? 0 : Math.min(1, (music / 100) * 0.5);
    });
  }, [music, muted]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else document.exitFullscreen?.();
  };

  return (
    <div className="mx-auto w-full max-w-2xl animate-fade-in-up px-4 py-6 md:py-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-primary">{t('System')}</p>
          <h1 className="mt-1 font-display text-3xl font-black uppercase tracking-tight md:text-4xl">{t('Inställningar')}</h1>
          <p className="mt-1 text-xs font-semibold text-white/55">{t('Ljud, bild och säkerhetskopiering. Allt sparas lokalt.')}</p>
        </div>
        <button onClick={onBack} className="btn-ghost px-4 py-2.5 text-[10px] uppercase tracking-wider">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {t('Tillbaka')}
        </button>
      </div>

      <div className="toon-card divide-y-2 divide-[#12182b]/12 overflow-hidden p-0">
        {/* Language */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#0f8a3c]">language</span>
            <span className="text-[#12182b] font-black text-sm uppercase tracking-wider">{t('Språk')}</span>
          </div>
          <LanguageButtons />
        </div>

        {/* Audio Section */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-[#0f8a3c]">equalizer</span>
            <span className="text-[#12182b] font-black text-sm uppercase tracking-wider">{t('Audio')}</span>
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="settings-mute" className="text-[#12182b]/75 text-sm font-bold">{t('Ljud av/på')}</label>
                <span className={`text-sm font-black ${muted ? 'text-[#c81e3a]' : 'text-[#0f8a3c]'}`}>{muted ? t('Av') : t('På')}</span>
              </div>
              <button
                id="settings-mute" type="button"
                role="switch" aria-checked={!muted}
                onClick={toggleMuted}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-200 ${
                  muted
                    ? 'border-primary-red/40 bg-primary-red/10 hover:bg-primary-red/20'
                    : 'border-primary/25 bg-primary/10 hover:bg-primary/20'
                }`}
              >
                <span className={`material-symbols-outlined text-xl ${muted ? 'text-[#c81e3a]' : 'text-[#0f8a3c]'}`}>
                  {muted ? 'volume_off' : 'volume_up'}
                </span>
                <span className="flex-1 text-left text-sm font-black text-[#12182b]">
                  {muted ? t('Allt ljud är avstängt') : t('Allt ljud spelas')}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#12182b]/45">{t('Mute')}</span>
              </button>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="settings-music" className="text-[#12182b]/75 text-sm font-bold">{t('Musikvolym')}</label>
                <span className={`font-mono text-sm font-black ${muted ? 'text-[#12182b]/35' : 'text-[#0f8a3c]'}`}>{muted ? '—' : `${music}%`}</span>
              </div>
              <input
                id="settings-music" aria-label={t('Musikvolym')}
                type="range" min="0" max="100" value={music}
                onChange={(e) => updateSettings({ musicVolume: Number(e.target.value) })}
                className="w-full h-4"
                style={{
                  background: `linear-gradient(to right, rgb(43 238 121) ${music}%, rgba(255,255,255,0.12) ${music}%)`,
                  backgroundSize: '100% 0.5rem',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="settings-sfx" className="text-[#12182b]/75 text-sm font-bold">{t('Audioeffekter')}</label>
                <span className={`font-mono text-sm font-black ${muted ? 'text-[#12182b]/35' : 'text-[#0f8a3c]'}`}>{muted ? '—' : `${sfx}%`}</span>
              </div>
              <input
                id="settings-sfx" aria-label={t('Audioeffekter')}
                type="range" min="0" max="100" value={sfx}
                onChange={(e) => updateSettings({ sfxVolume: Number(e.target.value) })}
                className="w-full h-4"
                style={{
                  background: `linear-gradient(to right, rgb(43 238 121) ${sfx}%, rgba(255,255,255,0.12) ${sfx}%)`,
                  backgroundSize: '100% 0.5rem',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="settings-ui" className="text-[#12182b]/75 text-sm font-bold">{t('UI-skala')}</label>
                <span className="text-[#0f8a3c] font-mono text-sm font-black">{Math.round(progress.settings.uiScale * 100)}%</span>
              </div>
              <input
                id="settings-ui" aria-label={t('UI-skala')}
                type="range" min="80" max="120" value={Math.round(progress.settings.uiScale * 100)}
                onChange={(e) => updateSettings({ uiScale: Number(e.target.value) / 100 })}
                className="w-full h-4"
                style={{
                  background: `linear-gradient(to right, rgb(43 238 121) ${((progress.settings.uiScale * 100 - 80) / 40) * 100}%, rgba(255,255,255,0.12) ${((progress.settings.uiScale * 100 - 80) / 40) * 100}%)`,
                  backgroundSize: '100% 0.5rem',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="settings-text" className="text-[#12182b]/75 text-sm font-bold">{t('Textstorlek')}</label>
                <span className="text-[#0f8a3c] font-mono text-sm font-black">{Math.round(progress.settings.textScale * 100)}%</span>
              </div>
              <input
                id="settings-text" aria-label={t('Textstorlek')}
                type="range" min="90" max="130" value={Math.round(progress.settings.textScale * 100)}
                onChange={(e) => updateSettings({ textScale: Number(e.target.value) / 100 })}
                className="w-full h-4"
                style={{
                  background: `linear-gradient(to right, rgb(43 238 121) ${((progress.settings.textScale * 100 - 90) / 40) * 100}%, rgba(255,255,255,0.12) ${((progress.settings.textScale * 100 - 90) / 40) * 100}%)`,
                  backgroundSize: '100% 0.5rem',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
            </div>
          </div>
        </div>

        {/* Display Section */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#0f8a3c]">fullscreen</span>
            <span className="text-[#12182b] font-black text-sm uppercase tracking-wider">{t('Skärm')}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="w-full flex items-center justify-between rounded-xl border-2 border-[#12182b]/20 bg-[#12182b]/[0.04] p-4 transition-colors hover:bg-[#12182b]/[0.07]"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#12182b]/55">open_in_full</span>
              <div className="text-left">
                <p className="text-[#12182b] font-black text-sm">{t('Helskärmsläge')}</p>
                <p className="text-[#12182b]/50 text-xs font-semibold">{t('Maximal inlevelse')}</p>
              </div>
            </div>
            <ToonSwitch on={isFullscreen} />
          </button>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button onClick={() => updateSettings({ colorBlindMode: !progress.settings.colorBlindMode })} className="toon-btn px-3 py-2 text-xs">
              {t('Färgblind: {v}', { v: progress.settings.colorBlindMode ? t('På') : t('Av') })}
            </button>
            <button onClick={() => updateSettings({ debugOverlay: !progress.settings.debugOverlay })} className="toon-btn px-3 py-2 text-xs">
              {t('Debug HUD: {v}', { v: progress.settings.debugOverlay ? t('På') : t('Av') })}
            </button>
          </div>

          {/* Reduced motion follows the device until the player chooses. Auto is
              the default so a phone that already asks for less animation is
              respected without anyone digging into this menu. */}
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#0f8a3c]">motion_photos_off</span>
              <span className="text-sm font-black text-[#12182b]">{t('Reducera motion: {v}', { v: progress.settings.reduceMotion === 'system' ? t('Automatiskt') : progress.settings.reduceMotion ? t('På') : t('Av') })}</span>
            </div>
            <p className="mt-1 text-[11px] font-semibold leading-relaxed text-[#12182b]/50">{t('Följer din systeminställning på enheten')}</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5" role="group" aria-label={t('Reducera motion: {v}', { v: '' }).replace(/:\s*$/, '')}>
              {([
                { value: 'system' as const, label: t('Automatiskt') },
                { value: true as const, label: t('På') },
                { value: false as const, label: t('Av') },
              ]).map((opt) => {
                const active = progress.settings.reduceMotion === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updateSettings({ reduceMotion: opt.value })}
                    className={`rounded-lg border-2 px-2 py-2 text-[11px] font-black uppercase tracking-wider transition-colors ${
                      active ? 'border-[#0c3a20] bg-[#8ff5b6] text-[#0c3a20] shadow-[0_2px_0_0_#0c3a20]' : 'border-[#12182b]/20 bg-white text-[#12182b]/60 hover:bg-white/70'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Haptics already fired on seven places in the game; until now there
              was no way to turn the buzz off on a phone that was asked to. */}
          <button
            onClick={() => updateSettings({ haptics: !progress.settings.haptics })}
            aria-pressed={progress.settings.haptics}
            className="mt-2 flex w-full items-center justify-between rounded-xl border-2 border-[#12182b]/20 bg-[#12182b]/[0.04] px-3 py-2.5 transition-colors hover:bg-[#12182b]/[0.07]"
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#12182b]/55">vibration</span>
              <span className="text-xs font-black text-[#12182b]">{t('Vibration: {v}', { v: progress.settings.haptics ? t('På') : t('Av') })}</span>
            </span>
            <ToonSwitch on={progress.settings.haptics} />
          </button>

          {/* Difficulty scales hazards, enemy pressure and the fish quota, but
              never rewards or shop prices: an accessibility dial, not a boost. */}
          <div className="mt-4 rounded-xl border-2 border-[#12182b]/20 bg-[#12182b]/[0.04] p-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#0f8a3c]">tune</span>
              <span className="text-sm font-black text-[#12182b]">{t('Svårighetsgrad')}</span>
            </div>
            <p className="mt-1 text-[11px] font-semibold leading-relaxed text-[#12182b]/50">{t('Påverkar gropar, fiender och tidsgränser – inte belöningar.')}</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5" role="group" aria-label={t('Svårighetsgrad')}>
              {([
                { value: 'easy' as const, label: t('Avslappnat'), hint: t('Färre gropar, lugnare fiender') },
                { value: 'normal' as const, label: t('Normal'), hint: t('Den tänkta utmaningen') },
                { value: 'hard' as const, label: t('Utmaning'), hint: t('Tätare faror, kortare tid') },
              ]).map((opt) => {
                const active = progress.settings.difficulty === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.hint}
                    aria-pressed={active}
                    onClick={() => updateSettings({ difficulty: opt.value })}
                    className={`rounded-lg border-2 px-2 py-2 text-[11px] font-black uppercase tracking-wider transition-colors ${
                      active ? 'border-[#0c3a20] bg-[#8ff5b6] text-[#0c3a20] shadow-[0_2px_0_0_#0c3a20]' : 'border-[#12182b]/20 bg-white text-[#12182b]/60 hover:bg-white/70'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quality + audio switches. Both are opt-out, and both degrade
              gracefully on devices that cannot measure fps or pan audio. */}
          {([
            { key: 'autoQuality' as const, icon: 'speed', label: t('Auto-prestanda'), desc: t('Sänker effekter automatiskt om bildfrekvensen dippar') },
            { key: 'cinematicEffects' as const, icon: 'flare', label: t('Filmiska effekter'), desc: t('Bloom och atmosfäriskt ljus – stäng av för maximal bildfrekvens') },
            { key: 'adaptiveAudio' as const, icon: 'graphic_eq', label: t('Adaptivt ljud'), desc: t('Mjuka tonlager som följer kombon och riktade ljudeffekter') },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => updateSettings({ [opt.key]: !progress.settings[opt.key] })}
              aria-pressed={progress.settings[opt.key]}
              className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl border-2 border-[#12182b]/20 bg-[#12182b]/[0.04] px-3 py-2.5 text-left transition-colors hover:bg-[#12182b]/[0.07]"
            >
              <span className="flex min-w-0 items-start gap-2">
                <span className="material-symbols-outlined text-base text-[#12182b]/55">{opt.icon}</span>
                <span>
                  <span className="block text-xs font-black text-[#12182b]">{opt.label}</span>
                  <span className="block text-[10px] font-semibold leading-relaxed text-[#12182b]/45">{opt.desc}</span>
                </span>
              </span>
              <ToonSwitch on={!!progress.settings[opt.key]} />
            </button>
          ))}
        </div>

        {/* Save Sync Section */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#0f8a3c]">sync</span>
            <span className="text-[#12182b] font-black text-sm uppercase tracking-wider">{t('Säkerhetskopiering')}</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <button
              onClick={async () => {
                const code = exportProgressCode();
                if (!code) return;
                // Clipboard access is denied in insecure contexts and by some
                // browser settings; report it instead of throwing into the void.
                try {
                  await navigator.clipboard.writeText(code);
                  setSyncMessage(t('Exportkod kopierad!'));
                } catch {
                  setImportCode(code);
                  setSyncMessage(t('Kunde inte kopiera – koden ligger i fältet.'));
                }
                setTimeout(() => setSyncMessage(''), 2600);
              }}
              className="toon-btn toon-btn-green px-4 py-2 text-xs uppercase"
            >
              {t('Exportera kod')}
            </button>
            <button
              onClick={() => {
                const ok = importProgressCode(importCode);
                setSyncMessage(ok ? t('Progress importerad!') : t('Ogiltig kod'));
                setTimeout(() => setSyncMessage(''), 2000);
              }}
              className="toon-btn px-4 py-2 text-xs uppercase"
            >
              {t('Importera kod')}
            </button>
          </div>
          <textarea
            value={importCode}
            onChange={(e) => setImportCode(e.target.value)}
            placeholder={t('Klistra in exportkod här')}
            className="w-full h-20 rounded-xl border-2 border-[#12182b]/25 bg-white p-3 text-xs font-semibold text-[#12182b]"
          />
          {syncMessage && <p className="mt-2 text-xs font-black text-[#0f8a3c]">{syncMessage}</p>}
        </div>

        {/* Install / offline. Shown on every device so the state is honest:
            "ready to play offline" only appears once the worker controls the
            page, and the install button only when the browser offers one. */}
        <div className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#0f8a3c]">install_mobile</span>
            <span className="text-sm font-black uppercase tracking-wider text-[#12182b]">{t('Installera appen')}</span>
          </div>
          <p className="mb-3 text-xs font-semibold leading-relaxed text-[#12182b]/50">
            {t('Spela i helskärm utan adressfält och fungera offline')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {installed ? (
              <span className="inline-flex items-center gap-2 rounded-lg border-2 border-[#0c3a20] bg-[#c9fbd9] px-3 py-2 text-xs font-black uppercase tracking-wider text-[#0c3a20]">
                <span className="material-symbols-outlined text-base">check_circle</span>
                {t('Redan installerad')}
              </span>
            ) : canInstall ? (
              <button
                onClick={async () => { await install(); }}
                className="toon-btn toon-btn-green px-4 py-2 text-xs uppercase tracking-wider"
              >
                {t('Installera')}
              </button>
            ) : null}
            <span
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold ${
                offlineReady ? 'border-[#12182b]/25 bg-[#c8ecff] text-[#12182b]' : 'border-[#12182b]/20 bg-white text-[#12182b]/45'
              }`}
            >
              <span className="material-symbols-outlined text-base">{offlineReady ? 'cloud_done' : 'cloud_off'}</span>
              {offlineReady ? t('Redo att spela utan nät') : t('Förbereder…')}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={onBack}
        className="btn-ghost mt-4 w-full py-3 text-xs uppercase tracking-wider"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        {t('Tillbaka till menyn')}
      </button>
    </div>
  );
};

/** HOW TO PLAY **/
export const HowToPlayView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const t = useT();
  const powerups = [
    { icon: 'shield', name: 'Sköld', color: 'text-cyan-300', ring: 'border-cyan-300/30 bg-cyan-300/10', desc: 'Tar emot nästa smäll åt dig.' },
    { icon: 'attractions', name: 'Fiskmagnet', color: 'text-yellow-300', ring: 'border-yellow-300/30 bg-yellow-300/10', desc: 'Drar fiskar till dig i 10 sekunder.' },
    { icon: 'local_fire_department', name: 'Rapid fire', color: 'text-orange-300', ring: 'border-orange-300/30 bg-orange-300/10', desc: 'Tredubbel eld utan ammokostnad i 9 sekunder.' },
    { icon: 'favorite', name: 'Hjärta', color: 'text-rose-300', ring: 'border-rose-300/30 bg-rose-300/10', desc: 'Ger ett extra liv, upp till sex.' },
    { icon: 'bolt', name: 'Ammolåda', color: 'text-indigo-300', ring: 'border-indigo-300/30 bg-indigo-300/10', desc: 'Sex skott. Dyker upp igen i bossarenan.' },
  ];

  const enemies = [
    { icon: 'pets', name: 'Vakthund & råtta', color: 'text-orange-300', desc: 'Patrullerar plattformar. Hoppa på dem eller skjut.' },
    { icon: 'cyclone', name: 'Sågdrönare', color: 'text-red-300', desc: 'Roterande taggar – håll avstånd.' },
    { icon: 'smart_toy', name: 'Sentry-torn', color: 'text-amber-300', desc: 'Står still och skjuter långsamma projektiler. Rör dig i sidled.' },
    { icon: 'bug_report', name: 'Laddare', color: 'text-violet-300', desc: 'Lyser rött innan de rusar. Hoppa över eller dasha undan.' },
    { icon: 'military_tech', name: 'Bossar', color: 'text-pink-300', desc: 'Var femte nivå. Tre faser, nya attacker och unik design.' },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl animate-fade-in-up px-4 py-6 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">{t('Så spelar du')}</p>
          <h1 className="toon-title mt-1 font-display text-3xl font-black uppercase tracking-tight md:text-5xl">{t('Handboken')}</h1>
          <p className="mt-2 max-w-lg text-sm font-semibold text-white/60">
            {t('Allt du behöver för att ta dig genom neonstaden, från första hoppet till sista bossen.')}
          </p>
        </div>
        <button onClick={onBack} className="btn-ghost px-4 py-2.5 text-[10px] uppercase tracking-wider">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {t('Tillbaka')}
        </button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="toon-card p-4">
          <span className="flex size-10 items-center justify-center rounded-xl border-2 border-[#0c3a20] bg-[#8ff5b6] text-[#0c3a20] shadow-[0_3px_0_0_#0c3a20]">
            <span className="material-symbols-outlined text-xl">flag</span>
          </span>
          <h2 className="mt-2 font-display text-lg font-black uppercase tracking-tight text-[#12182b]">{t('Målet')}</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-[#12182b]/60">
            {renderRich(t('Samla <b>fiskkvoten</b> (60–72 % av banans fiskar) och nå Jerry längst fram. Tar du alla fiskar väntar en bonus. Bossnivåer kräver att bossen besegras först. Varje nivå ger XP, mynt och poäng.'), 'font-black text-[#12182b]')}
          </p>
        </div>
        <div className="toon-card p-4">
          <span className="flex size-10 items-center justify-center rounded-xl border-2 border-[#0a3550] bg-[#bdeaff] text-[#0a3550] shadow-[0_3px_0_0_#0a3550]">
            <span className="material-symbols-outlined text-xl">gamepad</span>
          </span>
          <h2 className="mt-2 font-display text-lg font-black uppercase tracking-tight text-[#12182b]">{t('Kontroller')}</h2>
          <div className="mt-2 space-y-1.5">
            {[
              { k: 'A / D  ← →', v: 'Rör dig' },
              { k: 'Mellanslag', v: 'Hoppa · dubbelhopp' },
              { k: 'Shift · → → / D D', v: 'Dash' },
              { k: 'E / Q', v: 'Skuggskifte' },
              { k: 'Klick / F', v: 'Skjuta' },
              { k: 'Esc / P', v: 'Paus' },
            ].map((c) => (
              <div key={c.k} className="flex items-center justify-between gap-2">
                <span className="rounded-md border-2 border-[#12182b]/35 bg-white px-1.5 py-0.5 text-[9px] font-black text-[#12182b]/80">{t(c.k)}</span>
                <span className="text-[10px] font-semibold text-[#12182b]/55">{t(c.v)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="toon-card p-4">
          <span className="flex size-10 items-center justify-center rounded-xl border-2 border-[#6b4708] bg-[#ffe58a] text-[#6b4708] shadow-[0_3px_0_0_#6b4708]">
            <span className="material-symbols-outlined text-xl">local_fire_department</span>
          </span>
          <h2 className="mt-2 font-display text-lg font-black uppercase tracking-tight text-[#12182b]">{t('Streak')}</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-[#12182b]/60">
            {renderRich(t('Fiskar, fiender och bonusar bygger streaken. Var fjärde aktion höjer multiplikatorn (upp till <b>x8</b>). Skada nollställer den.'), 'font-black text-[#0f8a3c]')}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-md border-2 border-[#0c3a20] bg-[#c9fbd9] px-1.5 py-0.5 text-[9px] font-black text-[#0c3a20]">{t('UTAN SKADA +750')}</span>
            <span className="rounded-md border-2 border-[#6b4708] bg-[#ffe58a] px-1.5 py-0.5 text-[9px] font-black text-[#6b4708]">{t('NÄSTAN +75')}</span>
          </div>
        </div>
      </div>

      {/* The one mechanic that is uniquely Shadow Paw, given its own card. */}
      <div className="toon-card mt-3 bg-[linear-gradient(180deg,#efe4ff_0%,#e3ecff_100%)] p-4 md:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border-2 border-[#3c1a63] bg-[#c9a4ff] text-[#2a1145] shadow-[0_3px_0_0_#3c1a63]">
            <span className="material-symbols-outlined text-2xl">dark_mode</span>
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6b2fb0]">{t('Signaturförmåga')}</p>
            <h2 className="mt-0.5 font-display text-xl font-black uppercase tracking-tight text-[#12182b]">{t('Skuggskifte')}</h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[#12182b]/60">
              {renderRich(t('Fiskar, besegrade fiender och <b>nästan-träffar</b> laddar mätaren. Vid 100 % trycker du <b>E</b> eller på mätaren: i fyra sekunder är katten osårbar, snabbare, drar till sig fiskar, ger 75 % extra poäng och <b>löser upp fiender</b> bara genom att springa igenom dem.'), 'font-black text-[#3c1a63]')}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[t('Osårbar'), t('+30 % fart'), t('Fiskmagnet'), t('+75 % poäng'), t('Skuggpass +300')].map((chip) => (
                <span key={chip} className="rounded-md border-2 border-[#3c1a63]/30 bg-white px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#3c1a63]">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* The campaign's two variety systems, side by side: a stage-long rule
          and a short telegraphed surprise. Both are read from the same data the
          game loop uses, so the handbook can never drift from the code. */}
      <h2 className="mt-6 text-[10px] font-black uppercase tracking-[0.22em] text-white/55">{t('Banor med egen regel')}</h2>
      <p className="mt-1 max-w-2xl text-[11px] font-semibold leading-relaxed text-white/45">
        {t('Nivåns twist visas i HUD:en och på kortet innan start – lär dig den och vänd den till din fördel.')}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Object.values(TWISTS).filter((tw) => tw.id !== 'none').map((tw) => (
          <div key={tw.id} className="rounded-xl border-2 border-[#0a0f20] bg-[#1b2447] p-3 shadow-[0_3px_0_0_#0a0f20]">
            <span className="material-symbols-outlined text-xl" style={{ color: tw.accent }}>{tw.icon}</span>
            <p className="mt-1 text-[11px] font-black text-white">{t(tw.name)}</p>
            <p className="mt-0.5 text-[9px] leading-relaxed text-white/45">{t(tw.detail)}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-6 text-[10px] font-black uppercase tracking-[0.22em] text-white/55">{t('Plötsliga händelser')}</h2>
      <p className="mt-1 max-w-2xl text-[11px] font-semibold leading-relaxed text-white/45">
        {t('Då och då avbryts en bana av en telegraferad överraskning. Varningen syns innan – reagera, överlev, få bonus.')}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {Object.values(EVENTS).map((ev) => (
          <div key={ev.id} className="rounded-xl border-2 border-[#0a0f20] bg-[#1b2447] p-3 shadow-[0_3px_0_0_#0a0f20]">
            <span className="material-symbols-outlined text-xl" style={{ color: ev.accent }}>{ev.icon}</span>
            <p className="mt-1 text-[11px] font-black text-white">{t(ev.name)}</p>
            <p className="mt-0.5 text-[9px] leading-relaxed text-white/45">{t(ev.detail)}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/30">
        {t('Ingen twist på bossbanor – bossen är utmaningen.')}
      </p>

      <h2 className="mt-6 text-[10px] font-black uppercase tracking-[0.22em] text-white/55">{t('Power-ups')}</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {powerups.map((p) => (
          <div key={p.name} className="rounded-xl border-2 border-[#0a0f20] bg-[#1b2447] p-3 shadow-[0_3px_0_0_#0a0f20]">
            <span className={`material-symbols-outlined text-xl ${p.color}`}>{p.icon}</span>
            <p className="mt-1 text-[11px] font-black text-white">{t(p.name)}</p>
            <p className="mt-0.5 text-[9px] leading-relaxed text-white/45">{t(p.desc)}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-6 text-[10px] font-black uppercase tracking-[0.22em] text-white/55">{t('Fiender')}</h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {enemies.map((e) => (
          <div key={e.name} className="flex items-start gap-2.5 rounded-xl border-2 border-[#0a0f20] bg-[#1b2447] p-3 shadow-[0_3px_0_0_#0a0f20]">
            <span className={`material-symbols-outlined text-xl ${e.color}`}>{e.icon}</span>
            <div>
              <p className="text-[11px] font-black text-white">{t(e.name)}</p>
              <p className="mt-0.5 text-[9px] leading-relaxed text-white/45">{t(e.desc)}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-6 text-[10px] font-black uppercase tracking-[0.22em] text-white/55">{t('Nivåtyper')}</h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries(LEVEL_MODE_META).map(([key, meta]) => (
          <div key={key} className="rounded-xl border-2 border-[#0a0f20] bg-[#1b2447] p-3 shadow-[0_3px_0_0_#0a0f20]">
            <span className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: meta.accent }}>{t(meta.short)}</span>
            <p className="mt-1 text-[9px] leading-relaxed text-white/45">{t(meta.goal)}</p>
          </div>
        ))}
      </div>

      <div className="toon-card-dark mt-6 p-4">
        <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">{t('Proffstips')}</h2>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {[
            'Dubbelhoppet räddar liv – tryck en gång till i luften.',
            'Lär dig sentry-tornens rytm: den lyser rött precis innan skottet.',
            'Nära-träffar ger poäng – men bara en gång per fiende.',
            'Rapid fire gör dig till en kulspruta: spara den till bossen.',
            'Hämta dagliga uppdrag mellan rundorna för extra mynt.',
            'Byt skinn i butiken när du låst upp dem.',
            'Skuggskiftet laddas snabbast av nära-träffar: våga springa tätt förbi farorna.',
          ].map((tip) => (
            <div key={tip} className="flex items-start gap-1.5 text-[10px] font-semibold leading-relaxed text-white/55">
              <span className="text-primary">•</span>
              <span>{t(tip)}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onBack} className="toon-btn toon-btn-green mt-6 w-full max-w-xs py-3.5 text-sm">
        <span className="material-symbols-outlined text-lg">check</span>
        {t('Jag förstår')}
      </button>
    </div>
  );
};

/** LEADERBOARD **/
export const LeaderboardView: React.FC<{ onBack: () => void, onPlay: () => void }> = ({ onBack, onPlay }) => {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const t = useT();
  const lvl = (label: string) => t('Nivå {n}', { n: label.replace(/\D/g, '') });
  const dt = (d: string) => d.replace('okt', t('okt'));

  useEffect(() => {
    // Offline-friendly ghosts so the board is never empty for a new player.
    // Avatars are generated locally from initials instead of loading remote
    // images, so the page makes no third-party requests.
    const mockScores: ScoreEntry[] = [
      { rank: 1, name: 'ShadowNinja', score: 50400, level: 'Nivå 42', date: '24 okt', avatar: '' },
      { rank: 2, name: 'NeonHunter', score: 48200, level: 'Nivå 40', date: '23 okt', avatar: '' },
      { rank: 3, name: 'CyberCat', score: 45000, level: 'Nivå 38', date: '22 okt', avatar: '' },
      { rank: 4, name: 'GhostPaw', score: 42100, level: 'Nivå 35', date: '21 okt', avatar: '' },
      { rank: 5, name: 'NeonBlade', score: 38950, level: 'Nivå 32', date: '20 okt', avatar: '' },
      { rank: 6, name: 'PixelPaw', score: 35400, level: 'Nivå 30', date: '19 okt', avatar: '' },
      { rank: 7, name: 'NightRunner', score: 31200, level: 'Nivå 27', date: '18 okt', avatar: '' },
      { rank: 8, name: 'TurboTom', score: 27650, level: 'Nivå 24', date: '17 okt', avatar: '' },
      { rank: 9, name: 'ShadowFox', score: 24300, level: 'Nivå 21', date: '16 okt', avatar: '' },
    ];

    const savedScoresData = localStorage.getItem('shadow_paw_scores');
    let savedScores: { name: string; score: number; date: string }[] = [];
    if (savedScoresData) {
      try {
        savedScores = JSON.parse(savedScoresData);
      } catch {
        savedScores = [];
      }
    }

    const userScores: ScoreEntry[] = savedScores.map((s) => ({
      rank: 0,
      name: s.name,
      score: s.score,
      level: `Nivå ${Math.floor(s.score / 1000) || 1}`,
      date: s.date,
      avatar: '',
      isUser: true,
    }));

    const combined = [...mockScores, ...userScores].sort((a, b) => b.score - a.score);
    setScores(combined.map((s, idx) => ({ ...s, rank: idx + 1 })).slice(0, 20));
  }, []);

  const initial = (name: string) => (name.trim()[0] || '?').toUpperCase();
  const hueFor = (name: string) => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return h;
  };
  const avatarStyle = (name: string) => ({
    background: `linear-gradient(135deg, hsl(${hueFor(name)} 70% 55%), hsl(${(hueFor(name) + 40) % 360} 65% 35%))`,
  });

  const userBest = scores.filter((s) => s.isUser).sort((a, b) => b.score - a.score)[0];

  return (
    <div className="mx-auto w-full max-w-3xl animate-fade-in-up px-4 py-6 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-primary">{t('Rangordning')}</p>
          <h1 className="toon-title mt-1 font-display text-3xl font-black uppercase tracking-tight md:text-5xl">{t('Topplista')}</h1>
          <p className="mt-1 text-xs font-semibold text-white/50">{t('Lokala rekord och legendariska neonlöpare.')}</p>
        </div>
        <button onClick={onBack} className="toon-btn px-4 py-2.5 text-[10px] uppercase tracking-wider">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {t('Tillbaka')}
        </button>
      </div>

      {userBest && (
        <div className="toon-card mt-6 flex items-center gap-3 p-3">
          <div className="flex size-10 items-center justify-center rounded-xl text-sm font-black text-white" style={avatarStyle(userBest.name)}>
            {initial(userBest.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#0f8a3c]">{t('Ditt bästa resultat')}</p>
            <p className="truncate text-sm font-black text-[#12182b]">{t('{name} · rank #{n}', { name: userBest.name, n: userBest.rank })}</p>
          </div>
          <p className="tabular text-lg font-black text-[#0f8a3c]">{userBest.score.toLocaleString()}</p>
        </div>
      )}

      {/* Podium */}
      {scores.length >= 3 && (
        <div className="mt-8 flex items-end justify-center gap-2 sm:gap-4">
          {[scores[1], scores[0], scores[2]].map((s) => {
            const place = s.rank;
            const first = place === 1;
            const size = first ? 'size-[74px]' : 'size-14';
            const ring = first
              ? 'ring-[3px] ring-yellow-300/70'
              : place === 2
                ? 'ring-2 ring-slate-200/45'
                : 'ring-2 ring-orange-300/45';
            const glow = first ? 'shadow-[0_0_50px_-6px_rgba(255,214,102,0.6)]' : '';
            const plinth = first ? 'h-32' : place === 2 ? 'h-24' : 'h-20';
            const tone = first ? 'text-yellow-300' : place === 2 ? 'text-slate-200' : 'text-orange-300';
            const tint = first
              ? 'from-[#ffe58a] to-[#ffbe3d] border-[#6b4708] text-[#2a1c00] shadow-[0_4px_0_0_#6b4708]'
              : place === 2
                ? 'from-[#f2f6ff] to-[#c9d6ef] border-[#12182b] text-[#12182b] shadow-[0_4px_0_0_#12182b]'
                : 'from-[#ffcfa8] to-[#f79e63] border-[#7a3c14] text-[#3d1c04] shadow-[0_4px_0_0_#7a3c14]';
            return (
              <div key={`${s.name}-${s.rank}`} className={`flex flex-col items-center ${first ? 'w-[104px] sm:w-36' : 'w-[92px] sm:w-32'}`}>
                <p className={`mb-2 max-w-full truncate text-[11px] font-black ${s.isUser ? 'text-primary' : 'text-white/85'}`}>
                  {s.name}
                </p>
                <div className="relative">
                  {first && (
                    <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full border border-yellow-300/40 bg-[#0d1522] shadow-[0_0_16px_rgba(255,214,102,0.35)]">
                      <span className="material-symbols-outlined text-[14px] text-yellow-300">workspace_premium</span>
                    </span>
                  )}
                  <div
                    className={`flex ${size} items-center justify-center rounded-full ${first ? 'text-2xl' : 'text-xl'} font-black text-white ${ring} ${glow}`}
                    style={avatarStyle(s.name)}
                  >
                    {initial(s.name)}
                  </div>
                  <span className={`absolute -bottom-1.5 left-1/2 flex size-5 -translate-x-1/2 items-center justify-center rounded-full bg-[#080e1a] text-[9px] font-black ring-1 ring-white/20 ${tone}`}>
                    {place}
                  </span>
                </div>
                <div
                  className={`mt-3 flex w-full ${plinth} flex-col items-center justify-end gap-1 rounded-t-2xl border-2 border-b-0 bg-gradient-to-b ${tint} pb-2.5`}
                >
                  <span className={`tabular text-sm font-black ${s.isUser ? 'text-[#0f8a3c]' : ''}`}>
                    {s.score.toLocaleString()}
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-[0.18em] opacity-60">
                    {s.isUser ? t('Du') : lvl(s.level)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full board */}
      <div className="toon-card mt-9 overflow-hidden p-0">
        <div className="divide-y-2 divide-[#12182b]/10">
          {scores.map((s) => (
            <div
              key={`${s.name}-${s.score}-${s.date}`}
              className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${s.isUser ? 'bg-[#c9fbd9]' : 'hover:bg-[#12182b]/[0.04]'}`}
            >
              <span className={`tabular w-6 text-center text-xs font-black ${s.rank === 1 ? 'text-[#b57b00]' : s.rank === 2 ? 'text-[#5b6b85]' : s.rank === 3 ? 'text-[#b3551d]' : 'text-[#12182b]/35'}`}>
                {s.rank}
              </span>
              <div className={`flex size-8 items-center justify-center rounded-lg text-xs font-black text-white ${s.isUser ? 'ring-2 ring-primary/50' : ''}`} style={avatarStyle(s.name)}>
                {initial(s.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-xs font-black ${s.isUser ? 'text-[#0c3a20]' : 'text-[#12182b]'}`}>
                  {s.name} {s.isUser && <span className="text-[8px] font-black uppercase tracking-wider text-[#0f8a3c]">{t('du')}</span>}
                </p>
                <p className="text-[9px] font-semibold text-[#12182b]/45">{lvl(s.level)} · {dt(s.date)}</p>
              </div>
              <p className={`tabular text-sm font-black ${s.isUser ? 'text-[#0c3a20]' : 'text-[#12182b]'}`}>{s.score.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={onBack} className="toon-btn flex-1 py-3 text-xs uppercase tracking-wider">
          {t('Tillbaka')}
        </button>
        <button onClick={onPlay} className="toon-btn toon-btn-green flex-1 py-3 text-sm">
          <span className="material-symbols-outlined text-lg">play_arrow</span>
          {t('Spela nu')}
        </button>
      </div>
    </div>
  );
};

/** GAME OVER **/
export const GameOverView: React.FC<{ score: number, fishesCollected?: number, onRestart: () => void, onMenu: () => void }> = ({ score, fishesCollected = 0, onRestart, onMenu }) => {
  const t = useT();
  const [taunt, setTaunt] = useState<string>(() => tr('Bättre lycka nästa gång!'));
  const [name, setName] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [deathTip, setDeathTip] = useState('');
  const [dailyResult, setDailyResult] = useState<{ rank: number; streak: number; best: number } | null>(null);
  const recordedRef = React.useRef(false);
  const { progress, addXP, applyRunResults, unlockAchievement, unlockSkin } = useProgress();
  const lastRun = (() => {
    try {
      return JSON.parse(localStorage.getItem('shadow_paw_last_run') || '{}');
    } catch {
      return {};
    }
  })();

  // Coins are already awarded live during play, so this screen only tallies XP.
  const coinsEarned = lastRun.coins || 0;
  const totalCoins = progress.coins;
  const storedBest = (() => {
    try {
      const scores = JSON.parse(localStorage.getItem('shadow_paw_scores') || '[]');
      return Math.max(0, ...scores.map((s: { score: number }) => s.score));
    } catch {
      return 0;
    }
  })();
  const bestScore = Math.max(score, storedBest);
  // "New record" must mean the run beat the stored best, not that it equals the
  // maximum that already includes this score.
  const isRecord = score > storedBest && score > 0;

  useEffect(() => {
    setTaunt(getJerryTaunt(score));
    addXP(Math.floor(score / 10));
    // Turn local death telemetry into one concrete, non-nagging tip.
    const cause: DeathCause | null = getTopDeathCause();
    const level = getMostDangerousLevel();
    const tips: Record<DeathCause, string> = {
      hole: t('VANLIGASTE ORSAK: fallet. Använd dubbelhoppet tidigare och leta efter de cyanfärgade kontrollpunkterna.'),
      enemy: t('VANLIGASTE ORSAK: fiender. Hoppa på dem, eller spara Skuggskiftet till en trång passage.'),
      hazard: t('VANLIGASTE ORSAK: fällor. Stanna upp och läs mönstret innan du rusar vidare.'),
      timer: t('VANLIGASTE ORSAK: tiden. Fiskar ger extra sekunder – ta dem i kombo för att spara tid.'),
      boss: t('VANLIGASTE ORSAK: bossar. Vänta på attacken; kärnan lyser bara precis efteråt.'),
    };
    setDeathTip(cause
      ? `${tips[cause]}${level ? ' ' + t('Nivå {n} är din tuffaste.', { n: level }) : ''}`
      : t('Spela en runda till så visar vi vad som är din vanligaste orsak till att fastna.'));

    // Daily runs post to a local board and extend the consecutive-day streak.
    if (!recordedRef.current && lastRun.runMode === 'daily' && lastRun.dailySeed) {
      recordedRef.current = true;
      const rank = recordDailyScore(lastRun.dailySeed, score, lastRun.level || 1);
      const streak = touchDailyStreak(lastRun.dailySeed);
      const board = loadDailyScores(lastRun.dailySeed);
      setDailyResult({ rank, streak: streak.count, best: board[0]?.score || score });
    }
    applyRunResults({
      fishesCollected,
      enemiesDefeated: lastRun.enemiesDefeated || 0,
      levelsCompleted: lastRun.levelsCompleted || 0,
      perfectLevel: !!lastRun.perfectLevel,
      bestCombo: lastRun.bestCombo || 0,
      bossDefeated: !!lastRun.bossDefeated,
      // Lives actually lost this run. A quit from the pause menu costs none,
      // and an enemy hit is as real a death as a fall in the pit.
      deaths: lastRun.deaths || 0,
      // Near misses are this game's version of a shadow pass: skimming a hazard
      // without touching it. They feed the weekly quest and the lifetime stat.
      shadowPasses: lastRun.nearMisses || 0,
    });

    if ((lastRun.bestCombo || 0) >= 10) {
      unlockAchievement('combo_10');
      unlockSkin('shadow');
    }
    if ((progress.stats.totalEnemiesDefeated + (lastRun.enemiesDefeated || 0)) >= 60) {
      unlockAchievement('enemy_60');
      unlockSkin('ember');
    }
    if ((progress.stats.totalFishCollected + fishesCollected) >= 300) {
      unlockAchievement('fish_300');
      unlockSkin('frost');
    }
    if ((progress.stats.bossesDefeated + (lastRun.bossDefeated ? 1 : 0)) >= 3) {
      unlockAchievement('boss_3');
      unlockSkin('aurora');
    }
    if (lastRun.noHit) {
      unlockAchievement('flawless');
    }
    if ((lastRun.nearMisses || 0) >= 5) {
      unlockAchievement('close_call');
    }
    if ((lastRun.shadowShifts || 0) >= 1) {
      unlockAchievement('shadow_shift');
      unlockSkin('umbra');
    }
    if ((lastRun.bestStreak || 0) >= 20) {
      unlockAchievement('streak_20');
    }
  }, [score, fishesCollected, coinsEarned]);

  const handleSaveScore = () => {
    if (!name.trim()) return;
    try {
      const raw = JSON.parse(localStorage.getItem('shadow_paw_scores') || '[]');
      const highScores = Array.isArray(raw) ? raw : [];
      highScores.push({ name: name.trim(), score, date: new Date().toLocaleDateString() });
      localStorage.setItem('shadow_paw_scores', JSON.stringify(highScores));
      setIsSaved(true);
    } catch {
      // Show the field again rather than claiming a save that did not happen.
      setIsSaved(false);
    }
  };

  const handleShareCard = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grd.addColorStop(0, '#08111f');
    grd.addColorStop(1, '#142b19');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#2bee79';
    ctx.font = 'bold 56px Outfit, sans-serif';
    ctx.fillText('SHADOW PAW', 48, 90);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px Outfit, sans-serif';
    ctx.fillText(t('Poäng: {n}', { n: score.toLocaleString() }), 48, 180);
    ctx.fillText(t('Fiskar: {n}', { n: fishesCollected }), 48, 240);
    ctx.fillText(`Combo: x${lastRun.bestCombo || 0}`, 48, 300);
    ctx.fillStyle = '#95a3b8';
    ctx.font = 'bold 24px Outfit, sans-serif';
    ctx.fillText('shadow-paw-game.vercel.app', 48, 430);

    const summary = t('Jag fick {n} poäng i Shadow Paw!', { n: score });

    // Phones already have a share sheet that reaches every app the player
    // uses. Hand it the actual picture instead of only downloading a file into
    // a folder most people never open.
    const shareSupported = typeof navigator !== 'undefined'
      && typeof navigator.canShare === 'function'
      && typeof navigator.share === 'function';
    let file: File | null = null;
    if (shareSupported) {
      try {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const candidate = new File([blob], `shadow-paw-score-${score}.png`, { type: 'image/png' });
          // canShare with the file is the only reliable test: Safari exposes
          // share() but rejects files it cannot handle.
          if (navigator.canShare({ files: [candidate] })) file = candidate;
        }
      } catch {
        file = null;
      }
    }

    if (file) {
      try {
        await navigator.share({ files: [file], text: summary, title: 'Shadow Paw' });
        // No confirmation here: the share sheet is its own feedback, and the
        // text would linger for a while after the player switches apps.
        return;
      } catch (err) {
        // AbortError means the player closed the sheet on purpose - don't nag.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Anything else (no permission, unsupported target) falls back below.
      }
    }

    // Desktop and browsers without a file share sheet: download the card, then
    // copy the text so the whole result is still one paste away.
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `shadow-paw-score-${score}.png`;
    a.click();

    // The clipboard is blocked in insecure contexts and by some permission
    // settings, so a failed copy must not swallow the confirmation.
    let copied = false;
    try {
      await navigator.clipboard?.writeText(summary);
      copied = true;
    } catch {
      copied = false;
    }
    setShareMessage(copied ? t('Bild nedladdad + text kopierad!') : t('Bild nedladdad!'));
    setTimeout(() => setShareMessage(''), 2500);
  };

  return (
    <div className="relative mx-auto w-full max-w-5xl px-4 py-6 md:py-10 animate-fade-in-up">
      {/* Scrim: this screen is dense with small text, so the skyline behind it
          is dimmed rather than left to fight the labels for contrast. */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#04060f]/70 via-[#04060f]/55 to-[#04060f]/85" />
      <div className="grid gap-6 md:grid-cols-[300px_1fr] md:gap-8">
        {/* Mascot panel */}
        <div className="relative self-start overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#101a2c] to-[#05080f] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
          <div className="relative flex h-64 items-center justify-center overflow-hidden md:h-72">
            <div className="absolute inset-0 bg-[radial-gradient(90%_80%_at_50%_100%,rgba(238,43,43,0.18)_0%,transparent_65%)]" />
            <InjuredCatVisual />
          </div>
          <div className="relative border-t border-white/10 p-3">
            <div className="flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/[0.07] px-3 py-2">
              <span className="material-symbols-outlined text-base text-red-300">warning</span>
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">{t('Status')}</p>
                <p className="truncate text-xs font-black uppercase tracking-wide text-white/90">{t('Uppdraget misslyckades')}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between px-1 text-[9px] font-black uppercase tracking-wider text-white/30">
              <span>{t('Nivåer klara')}</span>
              <span className="tabular text-white/70">{lastRun.levelsCompleted || 0}</span>
            </div>
            <div className="mt-1 flex items-center justify-between px-1 text-[9px] font-black uppercase tracking-wider text-white/30">
              <span>{t('Bossar')}</span>
              <span className="tabular text-white/70">{lastRun.bossDefeated ? '1' : '0'}</span>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1">
              <span className="material-symbols-outlined text-sm text-red-300">sentiment_dissatisfied</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-200">{t('Rundan är över')}</span>
            </span>
            {isRecord && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-300/35 bg-yellow-300/10 px-3 py-1">
                <span className="material-symbols-outlined text-sm text-yellow-300">emoji_events</span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-200">{t('Nytt rekord')}</span>
              </span>
            )}
          </div>

          <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight md:text-6xl">
            {renderRich(t('Spelet <b>över</b>'), 'text-red-400')}
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/55 md:text-base">{taunt}</p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="col-span-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.14] to-transparent px-4 py-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.22em] text-primary/70">{t('Slutpoäng')}</p>
                  <p className="tabular text-3xl font-black leading-none text-white md:text-4xl">{score.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">{t('XP intjänat')}</p>
                  <p className="tabular text-lg font-black text-cyan-300">+{Math.floor(score / 10)}</p>
                </div>
              </div>
            </div>
            {[
              { label: t('Fiskar'), value: fishesCollected, tone: 'text-sky-300', icon: 'set_meal' },
              { label: t('Bästa combo'), value: lastRun.bestCombo || 0, tone: 'text-cyan-300', icon: 'local_fire_department' },
              { label: t('Bästa streak'), value: lastRun.bestStreak || 0, tone: 'text-primary', icon: 'bolt' },
              { label: t('Fiender'), value: lastRun.enemiesDefeated || 0, tone: 'text-orange-300', icon: 'swords' },
              { label: t('Mynt i rundan'), value: `+${coinsEarned}`, tone: 'text-yellow-300', icon: 'monetization_on' },
              { label: t('Mynt totalt'), value: totalCoins, tone: 'text-yellow-200', icon: 'account_balance_wallet' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-2.5 py-2">
                <span className={`material-symbols-outlined text-[14px] ${s.tone}`}>{s.icon}</span>
                <p className={`tabular mt-0.5 text-base font-black leading-none ${s.tone}`}>{s.value}</p>
                <p className="mt-1 truncate text-[8px] font-black uppercase tracking-wider text-white/30">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Local death-cause telemetry becomes actionable advice, and daily
              runs show their rank and streak without any server round-trip. */}
          {deathTip && (
            <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05] p-3.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-cyan-300">lightbulb</span>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200/70">{t('Tips från dina rundor')}</p>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-white/70">{deathTip}</p>
            </div>
          )}

          {dailyResult && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: t('Dagens placering'), value: dailyResult.rank ? `#${dailyResult.rank}` : '–' },
                { label: t('Daglig streak'), value: `${dailyResult.streak} ${t('dagar')}` },
                { label: t('Dagens bästa'), value: dailyResult.best.toLocaleString() },
              ].map((d) => (
                <div key={d.label} className="rounded-xl border border-primary/20 bg-primary/[0.06] px-2.5 py-2">
                  <p className="tabular truncate text-base font-black text-primary">{d.value}</p>
                  <p className="mt-0.5 truncate text-[8px] font-black uppercase tracking-wider text-white/35">{d.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-yellow-300">emoji_events</span>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/45">{t('Spara till topplistan')}</p>
            </div>
            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-white/30">person</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSaved}
                  placeholder={t('Ditt namn')}
                  maxLength={15}
                  className={`w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-3 text-sm text-white placeholder-white/25 transition-colors focus:border-primary/50 focus:outline-none ${isSaved ? 'cursor-not-allowed opacity-50' : ''}`}
                />
              </div>
              <button
                onClick={handleSaveScore}
                disabled={isSaved || !name.trim()}
                className="btn-primary shrink-0 px-6 py-3 text-xs"
              >
                {isSaved ? t('Sparat!') : t('Spara')}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button onClick={onRestart} className="btn-primary flex-1 py-3.5 text-sm">
              <span className="material-symbols-outlined text-lg">replay</span>
              {t('Spela igen')}
            </button>
            <button onClick={onMenu} className="btn-ghost flex-1 py-3.5 text-xs uppercase tracking-wider">
              <span className="material-symbols-outlined text-base">home</span>
              {t('Huvudmeny')}
            </button>
            <button
              onClick={handleShareCard}
              // Announced as the share sheet on phones and as a download
              // elsewhere, so a screen reader says what will actually happen.
              aria-label={typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? t('Öppna Share-meny') : t('Dela')}
              className="btn-ghost flex-1 py-3.5 text-xs uppercase tracking-wider"
            >
              <span className="material-symbols-outlined text-base text-primary">ios_share</span>
              {t('Dela')}
            </button>
          </div>
          {shareMessage && <p className="mt-3 text-center text-xs font-bold text-primary">{shareMessage}</p>}
        </div>
      </div>
    </div>
  );
};

// AUDIO MANAGER FOR BACKGROUND MUSIC
const useBackgroundMusic = (level: number, isMuted: boolean = false, musicVolume: number = 75, isPaused: boolean = false) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Boss warnings briefly duck the soundtrack via AudioEngine, so the warning
  // cue is audible over the music without muting anything permanently.
  const duckRef = useRef(1);

  // Pausing ducks the soundtrack instead of stopping it, so resuming the run
  // does not restart the track from the top.
  const targetVolume = isMuted || isPaused ? 0 : Math.min(1, (musicVolume / 100) * 0.5);

  useEffect(() => AudioEngine.onDuck((value) => {
    duckRef.current = value;
    const audio = audioRef.current;
    if (audio) audio.volume = targetVolume * value;
  }), [targetVolume]);

  // Mute + slider changes ramp the live track so nothing clicks.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    const ceiling = targetVolume * duckRef.current;
    const step = (ceiling - audio.volume) / 8;
    const ramp = setInterval(() => {
      audio.volume = Math.abs(ceiling - audio.volume) < Math.abs(step) ? ceiling : audio.volume + step;
      if (audio.volume === ceiling) clearInterval(ramp);
    }, 25);
    return () => clearInterval(ramp);
  }, [targetVolume]);

  // Handle level changes
  useEffect(() => {
    // Map any level to one of the 10 available tracks (cycles through 1-10)
    if (level >= 1) {
      const trackNumber = ((level - 1) % 10) + 1;
      const musicPath = `Sounds/Level ${trackNumber}.mp3`;

      // Create new audio element
      const audio = new Audio(musicPath);
      audio.loop = true;
      audio.volume = 0; // Start with volume 0 for fade-in

      // Play and fade in
      audio.play().catch(() => {});

      // Fade in over 3 seconds
      let currentVolume = 0;
      const ceiling = () => targetVolume * duckRef.current;
      const fadeStep = ceiling() / 30; // 30 steps for 3 seconds

      fadeIntervalRef.current = setInterval(() => {
        currentVolume += fadeStep;
        if (currentVolume >= ceiling()) {
          currentVolume = ceiling();
          if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
          }
        }
        audio.volume = currentVolume;
      }, 100);

      audioRef.current = audio;
    }

    return () => {
      // Cleanup: fade out and stop
      if (audioRef.current) {
        const audio = audioRef.current;

        // Fade out quickly
        let currentVolume = audio.volume;
        const fadeOutStep = currentVolume / 10;

        const fadeOutInterval = setInterval(() => {
          currentVolume -= fadeOutStep;
          if (currentVolume <= 0) {
            currentVolume = 0;
            audio.pause();
            audio.src = '';
            clearInterval(fadeOutInterval);
          }
          audio.volume = currentVolume;
        }, 50);
      }

      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, [level]);
};

/* ---------------------------- BOSS PROFILES ----------------------------- */

type BossPattern = 'orb' | 'burst' | 'fan' | 'sweep' | 'summon' | 'slam' | 'crossfire' | 'spiral';

const BOSS_ATTACK_PROFILES: Record<string, {
  cooldown: number;
  speed: number;
  radius: number;
  color: string;
  /** Rotation of signature attacks per phase; higher phases add pressure. */
  moves: BossPattern[][];
}> = {
  // Rått-kungen: slow heavy orbs early, then a burst plus summoned rats.
  rat_king: {
    cooldown: 116, speed: 4.3, radius: 9, color: '#ff6b35',
    moves: [['orb'], ['orb', 'burst'], ['burst', 'crossfire', 'summon', 'spiral']],
  },
  // Cyber-hunden: fast, aggressive, sweeps the floor in the last phase.
  cyber_dog: {
    cooldown: 86, speed: 6.2, radius: 7, color: '#00e1ff',
    moves: [['burst'], ['burst', 'sweep'], ['burst', 'crossfire', 'sweep', 'spiral']],
  },
  // Storm-örnen: wide fans that punish standing still.
  storm_eagle: {
    cooldown: 140, speed: 4.8, radius: 8, color: '#ffe600',
    moves: [['fan'], ['fan', 'sweep'], ['fan', 'crossfire', 'fan', 'spiral']],
  },
  // Tomrums-draken: area denial and adds.
  void_dragon: {
    cooldown: 150, speed: 3.8, radius: 12, color: '#a855f7',
    moves: [['fan', 'orb'], ['fan', 'summon'], ['fan', 'crossfire', 'summon', 'spiral']],
  },
  // Skugg-titanen: ground slams and orbs, the hardest final boss.
  shadow_titan: {
    cooldown: 164, speed: 3.2, radius: 14, color: '#ff4d6d',
    moves: [['slam', 'orb'], ['slam', 'summon'], ['slam', 'crossfire', 'spiral', 'orb']],
  },
};

/* Applies one boss signature move. Kept outside the game loop so the pattern
   logic stays readable and every boss shares the same telegraph rules. */
const fireBossAttack = (
  game: GameState,
  boss: any,
  move: BossPattern,
  profile: { speed: number; radius: number; color: string },
) => {
  const px = game.player.x + game.player.width / 2;
  const py = game.player.y + game.player.height / 2;
  const bx = boss.x + boss.width / 2;
  const by = boss.y + boss.height / 2;
  const baseAngle = Math.atan2(py - by, px - bx);
  const tier = boss.tier || 1;
  const speedBase = profile.speed + (boss.phase || 0) * 0.7 + tier * 0.18;
  const color = boss.phase === 2 ? '#ff00ff' : profile.color;

  const shoot = (angle: number, speed: number, radius: number, kind = 'orb', originY = by) => {
    boss.projectiles.push({
      x: bx,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      life: 200,
      color,
      kind,
    });
  };

  switch (move) {
    case 'orb':
      shoot(baseAngle, speedBase * 0.85, profile.radius * 1.5);
      break;
    case 'burst':
      // Three shots in a tight stream: punish standing still, reward a sidestep.
      for (let i = 0; i < 3; i++) {
        shoot(baseAngle + (i - 1) * 0.1, speedBase * (1 + i * 0.12), profile.radius);
      }
      break;
    case 'fan': {
      const count = 5 + (boss.phase || 0);
      const spread = 0.5;
      for (let i = 0; i < count; i++) {
        shoot(baseAngle + (i - (count - 1) / 2) * spread, speedBase, profile.radius * 0.9);
      }
      break;
    }
    case 'sweep': {
      // Two low shots hugging the arena floor. Jump, do not duck.
      const dir = px > bx ? 1 : -1;
      const floorY = boss.groundY + boss.height * 0.78;
      for (let i = 0; i < 2; i++) {
        shoot(dir > 0 ? 0 : Math.PI, speedBase * 1.2, profile.radius * 0.95, 'sweep', floorY + i * 8);
      }
      game.screenShake = Math.max(game.screenShake, 6);
      break;
    }
    case 'slam': {
      game.screenShake = Math.max(game.screenShake, 16);
      game.zoomPunch = 10;
      // Debris fountains up and out from the impact point.
      for (let i = 0; i < 6; i++) {
        const angle = -Math.PI + (i / 5) * Math.PI;
        shoot(angle, speedBase * 0.9, profile.radius * 0.8, 'slam');
      }
      AudioEngine.playExplosion();
      break;
    }
    case 'crossfire': {
      // Four aimed diagonals from slightly offset origins: the safe answer is
      // to move sideways, not to jump. Telegraph colour is magenta.
      for (let i = 0; i < 4; i++) {
        const angle = baseAngle + (i - 1.5) * 0.34;
        shoot(angle, speedBase * 0.95, profile.radius * 0.85, 'crossfire', by + (i % 2 ? 14 : -14));
      }
      game.screenShake = Math.max(game.screenShake, 8);
      break;
    }
    case 'spiral': {
      // A slow rotating fan. It is lethal to stand still in, but each projectile
      // has a visible gap because the ring is evenly spaced.
      const count = 8;
      const spin = (boss.moveIndex || 0) * 0.28;
      for (let i = 0; i < count; i++) {
        shoot(spin + (i / count) * Math.PI * 2, speedBase * 0.72, profile.radius * 0.75, 'spiral');
      }
      AudioEngine.playBossRoar();
      break;
    }
    case 'summon': {
      const bossPlat = game.platforms.find((p: any) => p.bossArena);
      const platIndex = bossPlat ? game.platforms.indexOf(bossPlat) : -1;
      if (platIndex >= 0) {
        const alive = game.enemies.filter(
          (e: any) => e.x > bossPlat.x - 80 && e.x < bossPlat.x + bossPlat.width + 80,
        ).length;
        for (let i = 0; i < 2 && alive + i < 4; i++) {
          const ex = bossPlat.x + 30 + Math.random() * Math.max(30, bossPlat.width - 100);
          game.enemies.push({
            x: ex,
            y: bossPlat.y - 40,
            width: 40,
            height: 40,
            velocityX: (1.3 + tier * 0.15) * (i === 0 ? -1 : 1),
            direction: 1,
            platform: platIndex,
            // Rat and hopper minions keep the arena busy without adding turrets.
            type: i === 0 ? 0 : 2,
            shootTimer: 90,
            baseY: bossPlat.y - 40,
            chargeTimer: 0,
            summoned: true,
          });
        }
      }
      game.toasts.push({ text: tr('BOSS TILLKALLAR HJÄLP!'), color: '#ff9f43', life: 90, maxLife: 90 });
      if (game.toasts.length > 3) game.toasts.shift();
      AudioEngine.playBossRoar();
      break;
    }
    default:
      shoot(baseAngle, speedBase, profile.radius);
  }
};

/** Deterministic 0..1 noise for scenery details that must never flicker. */
const skyHashNoise = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

// ---------------------------------------------------------------------------
// LIGHTNING
// ---------------------------------------------------------------------------
// Rainy stages get real strikes: a forked bolt walks down from the sky, hits a
// spot on the course, scorches it and lights the whole frame. The cat is never
// a target - a strike aimed inside the safety radius is cancelled before it
// fires, and the same rule is checked again on the exact landing frame.

type BoltPath = { dx: number[]; y: number[] };

type LightningStrike = {
  targetX: number;
  targetY: number;
  life: number;
  /** The jagged shape never changes after the strike lands, so it is rasterised
      once and blitted with an alpha each frame. Redrawing the multi-pass glow
      every frame would cost more than the rest of the scene together. */
  sprite: HTMLCanvasElement;
  spriteOffsetX: number;
  spriteOffsetY: number;
};

type LightningScorch = { x: number; y: number; life: number; maxLife: number; size: number };

type LightningState = {
  nextStrike: number;
  pending: { x: number; y: number; charge: number; total: number } | null;
  strikes: LightningStrike[];
  scorches: LightningScorch[];
  flash: number;
  lastX: number;
};

const BOLT_LIFE = 16;
// Hand-tuned strobe: lightning never fades out, it restrikes two or three times
// before it dies. Index 0 is the landing frame.
const BOLT_FLICKER = [1, 0.85, 1, 0.3, 0.95, 0.55, 0.18, 0.9, 0.45, 0.1, 0.7, 0.22, 0, 0.4, 0, 0];
const BOLT_SAFE_RADIUS = 175;

/** Recursive midpoint displacement. Straight-ish at the top, noisier towards
    the ground, and the perpendicular offset is what gives a bolt its kinks
    instead of shortening the segment. */
const boltSubdivide = (
  x1: number, y1: number, x2: number, y2: number,
  displacement: number, depth: number, originX: number,
  dxs: number[], ys: number[],
) => {
  if (depth <= 0 || dxs.length > 400) {
    dxs.push(x2 - originX);
    ys.push(y2);
    return;
  }
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const offset = (Math.random() * 2 - 1) * displacement;
  const px = mx + (-(y2 - y1) / len) * offset;
  const py = my + ((x2 - x1) / len) * offset;
  boltSubdivide(x1, y1, px, py, displacement * 0.54, depth - 1, originX, dxs, ys);
  boltSubdivide(px, py, x2, y2, displacement * 0.54, depth - 1, originX, dxs, ys);
};

/** Strokes a bolt path segment by segment so it can taper towards the tip. */
const strokeBoltPath = (
  ctx: CanvasRenderingContext2D,
  path: BoltPath,
  originScreenX: number,
  width: number,
) => {
  const count = Math.min(path.dx.length, path.y.length);
  for (let i = 0; i < count - 1; i++) {
    const t = i / Math.max(1, count - 1);
    ctx.lineWidth = Math.max(0.5, width * (1 - t * 0.45));
    ctx.beginPath();
    ctx.moveTo(originScreenX + path.dx[i], path.y[i]);
    ctx.lineTo(originScreenX + path.dx[i + 1], path.y[i + 1]);
    ctx.stroke();
  }
};

/** Rasterises a strike into a small canvas: wide bloom, mid halo, white-hot
    core. Done once per bolt, then blitted with a flicker alpha each frame. */
const rasteriseBolt = (main: BoltPath, branches: BoltPath[], brightSky = false) => {
  const paths = [main, ...branches];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  paths.forEach((path) => {
    for (let i = 0; i < path.dx.length; i++) {
      minX = Math.min(minX, path.dx[i]);
      maxX = Math.max(maxX, path.dx[i]);
      minY = Math.min(minY, path.y[i]);
      maxY = Math.max(maxY, path.y[i]);
    }
  });
  const pad = 48;
  const width = Math.ceil(maxX - minX) + pad * 2;
  const height = Math.ceil(maxY - minY) + pad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const originX = pad - minX;

    // Daytime skies are nearly as bright as the bolt, so a white channel on
    // pale blue disappears. A dark violet rim under the light gives the shape
    // its edge back, exactly like a real strike against grey daylight clouds.
    if (brightSky) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(44, 32, 88, 0.62)';
      strokeBoltPath(ctx, main, originX, 9);
      branches.forEach((b) => strokeBoltPath(ctx, b, originX, 4.5));
    }
    ctx.globalCompositeOperation = 'lighter';

    // Bloom is built from stacked wide strokes instead of shadowBlur: a blurred
    // shadow per segment costs ~40 ms to rasterise, and this reads the same.
    // A bright day sky needs a tighter halo, or the whole channel smears into
    // one white ribbon and the fork disappears.
    const layers: Array<{ width: number; branchWidth: number; style: string }> = brightSky
      ? [
          { width: 40, branchWidth: 16, style: 'rgba(150, 120, 255, 0.16)' },
          { width: 24, branchWidth: 9, style: 'rgba(176, 198, 255, 0.3)' },
          { width: 11, branchWidth: 4.6, style: 'rgba(238, 242, 255, 0.9)' },
          { width: 4, branchWidth: 1.8, style: '#ffffff' },
        ]
      : [
          { width: 52, branchWidth: 20, style: 'rgba(92, 146, 255, 0.13)' },
          { width: 34, branchWidth: 13, style: 'rgba(130, 180, 255, 0.18)' },
          { width: 21, branchWidth: 8.5, style: 'rgba(178, 210, 255, 0.32)' },
          { width: 10.5, branchWidth: 4.8, style: 'rgba(224, 238, 255, 0.72)' },
          { width: 4.2, branchWidth: 1.8, style: '#ffffff' },
        ];
    layers.forEach((layer) => {
      ctx.strokeStyle = layer.style;
      strokeBoltPath(ctx, main, originX, layer.width);
      branches.forEach((b) => strokeBoltPath(ctx, b, originX, layer.branchWidth));
    });
  }

  return { canvas, offsetX: minX - pad, offsetY: minY - pad };
};

/** A full strike: one thick forked trunk plus a few shorter forks that die out
    in the air. Stored relative to the landing point so it stays welded to the
    world while the camera scrolls. */
const createLightningStrike = (targetX: number, targetY: number, brightSky = false): LightningStrike => {
  const topX = targetX + (Math.random() - 0.5) * 260;
  const main: BoltPath = { dx: [topX - targetX], y: [-70] };
  boltSubdivide(topX, -70, targetX, targetY, 46, 6, targetX, main.dx, main.y);
  // The trunk has to end exactly on the surface it hits, not a pixel above it.
  main.dx[main.dx.length - 1] = 0;
  main.y[main.y.length - 1] = targetY;

  const branches: BoltPath[] = [];
  const branchCount = 2 + Math.floor(Math.random() * 3);
  for (let b = 0; b < branchCount; b++) {
    // Forks leave the trunk from its upper two thirds and wander off sideways.
    const idx = Math.max(1, Math.floor(main.dx.length * (0.1 + Math.random() * 0.6)));
    const sx = targetX + main.dx[idx];
    const sy = main.y[idx];
    const dir = Math.random() > 0.5 ? 1 : -1;
    const reach = 50 + Math.random() * 150;
    const ex = sx + dir * reach;
    const ey = sy + reach * (0.5 + Math.random() * 0.9);
    const path: BoltPath = { dx: [sx - targetX], y: [sy] };
    boltSubdivide(sx, sy, ex, ey, 22, 4, targetX, path.dx, path.y);
    branches.push(path);
  }

  const sprite = rasteriseBolt(main, branches, brightSky);

  return {
    targetX,
    targetY,
    life: BOLT_LIFE,
    sprite: sprite.canvas,
    spriteOffsetX: sprite.offsetX,
    spriteOffsetY: sprite.offsetY,
  };
};

/** Picks a solid spot on screen: a platform interior (never over a pit), on
    screen, off the cat and not right where the last bolt landed. */
const pickLightningSpot = (game: GameState, canvasWidth: number) => {
  const catX = game.player.x + game.player.width / 2;
  const catY = game.player.y + game.player.height / 2;
  const preferred: Array<{ x: number; y: number }> = [];
  const fallback: Array<{ x: number; y: number }> = [];
  const lastX = game.lightning?.lastX ?? -9999;

  game.platforms.forEach((plat: any) => {
    if (!plat || plat.bossWalkway) return;
    const left = plat.x - game.scrollX;
    if (left + plat.width < 80 || left > canvasWidth - 80) return;
    const x0 = Math.max(plat.x + 30, game.scrollX + 96);
    const x1 = Math.min(plat.x + plat.width - 30, game.scrollX + canvasWidth - 96);
    if (x1 - x0 < 46) return;
    for (let i = 0; i < 2; i++) {
      const x = x0 + Math.random() * (x1 - x0);
      if (Math.hypot(x - catX, plat.y - catY) < BOLT_SAFE_RADIUS) continue;
      (Math.abs(x - lastX) < 90 ? fallback : preferred).push({ x, y: plat.y });
    }
  });

  const pool = preferred.length ? preferred : fallback;
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
};

const nextLightningDelay = (game: GameState) => {
  if (game.weather === 'STORMIGT') return 130 + Math.random() * 170;
  return game.intensity === 'HEAVY' ? 240 + Math.random() * 280 : 520 + Math.random() * 460;
};

const fireLightning = (game: GameState, x: number, y: number, canvasWidth: number, catX: number) => {
  const L: LightningState = game.lightning;
  // Final gate, evaluated on the frame the bolt actually lands.
  if (Math.abs(x - catX) < BOLT_SAFE_RADIUS) return;

  L.strikes.push(createLightningStrike(x, y, game.timeOfDay === 'DAY'));
  L.lastX = x;
  L.flash = 1;
  L.scorches.push({ x, y, life: 170, maxLife: 170, size: 22 + Math.random() * 16 });
  if (L.scorches.length > 6) L.scorches.shift();

  // Sparks are thrown up from the impact and fall back through the global
  // particle system, so they inherit gravity and the additive glow for free.
  for (let i = 0; i < 14; i++) {
    game.particles.push({
      x: x + (Math.random() - 0.5) * 26,
      y: y - Math.random() * 10,
      vx: (Math.random() - 0.5) * 9,
      vy: -2 - Math.random() * 8,
      life: 26 + Math.random() * 20,
      color: ['#ffffff', '#cfe4ff', '#9dc4ff', '#e8f2ff'][Math.floor(Math.random() * 4)],
      size: 1.5 + Math.random() * 2.5,
    });
  }

  // Thunder arrives late, and quieter the further from the cat it landed.
  const distance = Math.min(1, Math.abs(x - catX) / Math.max(240, canvasWidth * 0.55));
  AudioEngine.playThunder(1 - distance * 0.55, distance * 0.85);
  game.screenShake = Math.max(game.screenShake || 0, 4 + Math.round((1 - distance) * 5));
};

const updateLightning = (game: GameState, canvasWidth: number) => {
  const L: LightningState | undefined = game.lightning;
  if (!L) return;
  const stormy = game.weather === 'STORMIGT';
  const rainy = game.weather === 'REGNIGT';
  if (!stormy && !rainy) return;

  const catX = game.player.x + game.player.width / 2;

  if (L.strikes.length) {
    L.strikes.forEach((s) => { s.life--; });
    L.strikes = L.strikes.filter((s) => s.life > 0);
  }
  if (L.scorches.length) {
    L.scorches.forEach((s) => { s.life--; });
    L.scorches = L.scorches.filter((s) => s.life > 0);
  }
  // Bright punch on the landing frames, then a slower afterglow: a lightning
  // flash is not a linear fade.
  if (L.flash > 0) L.flash = Math.max(0, L.flash - (L.flash > 0.62 ? 0.052 : 0.024));

  if (!L.pending) {
    if (L.nextStrike > 0) L.nextStrike--;
    if (L.nextStrike <= 0) {
      const spot = pickLightningSpot(game, canvasWidth);
      if (spot) L.pending = { x: spot.x, y: spot.y, charge: 0, total: 18 };
      else L.nextStrike = 90;
    }
    return;
  }

  L.pending.charge++;
  // The cat walked into the strike zone during the charge: drop it and re-aim.
  if (Math.abs(L.pending.x - catX) < BOLT_SAFE_RADIUS) {
    L.pending = null;
    L.nextStrike = 140 + Math.random() * 180;
    return;
  }
  if (L.pending.charge >= L.pending.total) {
    fireLightning(game, L.pending.x, L.pending.y, canvasWidth, catX);
    L.pending = null;
    L.nextStrike = nextLightningDelay(game);
  }
};

const drawLightning = (ctx: CanvasRenderingContext2D, game: GameState, softStrobe = false) => {
  const L: LightningState | undefined = game.lightning;
  if (!L) return;

  // Scorch marks stay on the surface after the strike has gone.
  L.scorches.forEach((s) => {
    const sx = s.x - game.scrollX;
    const fade = Math.max(0, s.life / s.maxLife);
    ctx.save();
    ctx.fillStyle = `rgba(10, 8, 16, ${0.5 * fade})`;
    ctx.beginPath();
    ctx.ellipse(sx, s.y + 2, s.size, s.size * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    // Embers along the rim, brightest right after the hit.
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(150, 200, 255, ${0.4 * fade * fade})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(sx, s.y + 2, s.size * 0.9, s.size * 0.24, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  // Charge-up: static gathers on the spot before the bolt arrives, so the
  // player can read where the strike is going to land.
  if (L.pending) {
    const p = L.pending;
    const sx = p.x - game.scrollX;
    const t = p.charge / p.total;
    const pulse = 0.35 + 0.65 * Math.abs(Math.sin(p.charge * 0.9));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(sx, p.y, 0, sx, p.y, 26 + t * 54);
    glow.addColorStop(0, `rgba(198, 224, 255, ${0.42 * pulse * (0.3 + t)})`);
    glow.addColorStop(0.5, `rgba(120, 170, 255, ${0.16 * pulse})`);
    glow.addColorStop(1, 'rgba(90, 140, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, p.y, 26 + t * 54, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + p.charge * 0.2;
      const r = 10 + t * 34;
      ctx.fillStyle = `rgba(220, 238, 255, ${0.55 * pulse})`;
      ctx.beginPath();
      ctx.arc(sx + Math.cos(a) * r, p.y - Math.abs(Math.sin(a)) * r * 0.55, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  L.strikes.forEach((strike) => {
    const frame = Math.max(0, Math.min(BOLT_FLICKER.length - 1, BOLT_LIFE - strike.life));
    // Reduce-motion users still get the bolt, just without the hard on/off
    // strobing that can be uncomfortable.
    const alpha = softStrobe ? Math.max(0.55, BOLT_FLICKER[frame]) : BOLT_FLICKER[frame];
    if (alpha <= 0) return;
    const sx = strike.targetX - game.scrollX;
    const age = (BOLT_LIFE - strike.life) / BOLT_LIFE;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // The whole forked channel, pre-rasterised, flickering as one image.
    ctx.drawImage(strike.sprite, sx + strike.spriteOffsetX, strike.spriteOffsetY);

    // Impact bloom on the surface: a hot core plus a wide spill of light
    const bloomRadius = 54 + age * 110;
    const bloom = ctx.createRadialGradient(sx, strike.targetY, 0, sx, strike.targetY, bloomRadius);
    bloom.addColorStop(0, `rgba(255, 255, 255, ${0.92 * alpha})`);
    bloom.addColorStop(0.28, `rgba(200, 224, 255, ${0.55 * alpha})`);
    bloom.addColorStop(0.62, `rgba(130, 175, 255, ${0.22 * alpha})`);
    bloom.addColorStop(1, 'rgba(110, 160, 255, 0)');
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(sx, strike.targetY, bloomRadius, 0, Math.PI * 2);
    ctx.fill();

    // Ground shock ring
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(205, 228, 255, ${0.6 * (1 - age)})`;
    ctx.lineWidth = 2.5 * (1 - age) + 0.5;
    ctx.beginPath();
    ctx.ellipse(sx, strike.targetY + 2, 12 + age * 96, 6 + age * 26, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Column of light lifting off the ground
    const column = ctx.createLinearGradient(0, strike.targetY, 0, strike.targetY - 230);
    column.addColorStop(0, `rgba(210, 232, 255, ${0.34 * alpha})`);
    column.addColorStop(1, 'rgba(160, 200, 255, 0)');
    ctx.fillStyle = column;
    ctx.fillRect(sx - 20, strike.targetY - 230, 40, 230);

    ctx.restore();
  });
};

// BACKGROUND ELEMENTS GENERATOR
const THEME_CONFIGS: Record<string, { buildings: string[], animals: string[], buildingColors: string[] }> = {
  park: { buildings: ['house', 'windmill', 'fountain'], animals: ['bird', 'rabbit', 'squirrel'], buildingColors: ['#a0c878', '#8fbc8f', '#7da87d'] },
  suburban: { buildings: ['house', 'fence', 'mailbox'], animals: ['cat', 'dog', 'bird'], buildingColors: ['#c8a46e', '#d4956a', '#b8935a'] },
  city: { buildings: ['skyscraper', 'apartment', 'billboard'], animals: ['pigeon', 'rat', 'stray_cat'], buildingColors: ['#3a5f8a', '#4a7aaa', '#2d4f7a'] },
  downtown: { buildings: ['skyscraper', 'office', 'neon_sign'], animals: ['pigeon', 'stray_cat', 'bat'], buildingColors: ['#2d3f6a', '#1e2f5a', '#3d4f7a'] },
  industrial: { buildings: ['factory', 'chimney', 'warehouse'], animals: ['rat', 'crow', 'fox'], buildingColors: ['#5a4a3a', '#6a5a4a', '#4a3a2a'] },
  construction: { buildings: ['crane', 'scaffold', 'barrel'], animals: ['crow', 'rat', 'pigeon'], buildingColors: ['#8a7a3a', '#7a6a2a', '#9a8a4a'] },
  beach: { buildings: ['lighthouse', 'beach_hut', 'palm'], animals: ['seagull', 'crab', 'pelican'], buildingColors: ['#f0e0a0', '#e8c870', '#f8f0b0'] },
  mountain: { buildings: ['cabin', 'peak', 'ski_lift'], animals: ['eagle', 'goat', 'bear'], buildingColors: ['#8a7060', '#9a8070', '#7a6050'] },
  forest: { buildings: ['cabin', 'treehouse', 'well'], animals: ['deer', 'owl', 'squirrel'], buildingColors: ['#4a7a3a', '#3a6a2a', '#5a8a4a'] },
  harbor: { buildings: ['lighthouse', 'dock', 'ship'], animals: ['seagull', 'pelican', 'seal'], buildingColors: ['#3a5a7a', '#2a4a6a', '#4a6a8a'] },
  sewers: { buildings: ['pipe', 'grate', 'ladder'], animals: ['rat', 'bat', 'lizard'], buildingColors: ['#4a5a3a', '#3a4a2a', '#5a6a4a'] },
  alpine: { buildings: ['cabin', 'snow_peak', 'chapel'], animals: ['goat', 'eagle', 'fox'], buildingColors: ['#9090a8', '#a0a0b8', '#8080a0'] },
  rooftops: { buildings: ['water_tower', 'chimney', 'antenna'], animals: ['pigeon', 'bat', 'crow'], buildingColors: ['#4a5a6a', '#3a4a5a', '#5a6a7a'] },
  countryside: { buildings: ['barn', 'windmill', 'silo'], animals: ['cow', 'horse', 'rooster'], buildingColors: ['#c8a060', '#b89050', '#d8b070'] },
  ice_cave: { buildings: ['cabin', 'lighthouse', 'windmill'], animals: ['seal', 'owl', 'fox'], buildingColors: ['#a0d8ef', '#70b0df', '#c8eaf5'] },
  glacier: { buildings: ['snow_peak', 'lighthouse', 'cabin'], animals: ['eagle', 'seal', 'fox'], buildingColors: ['#b0e0f8', '#88c8e8', '#d0f0ff'] },
  arctic_base: { buildings: ['factory', 'antenna', 'water_tower'], animals: ['fox', 'eagle', 'owl'], buildingColors: ['#7890a8', '#607890', '#90a8c0'] },
  power_plant: { buildings: ['factory', 'chimney', 'water_tower'], animals: ['rat', 'crow', 'bat'], buildingColors: ['#3a4a5a', '#5a6a7a', '#2a3a4a'] },
  nuclear: { buildings: ['factory', 'chimney', 'antenna'], animals: ['crow', 'bat', 'rat'], buildingColors: ['#2e4a3e', '#1e3a2e', '#3e5a4e'] },
  datacenter: { buildings: ['skyscraper', 'office', 'antenna'], animals: ['robot_bird', 'space_cat', 'bat'], buildingColors: ['#1a2a4a', '#0e1e3e', '#2a3a5a'] },
  laboratory: { buildings: ['office', 'antenna', 'module'], animals: ['alien_creature', 'robot_bird', 'rat'], buildingColors: ['#2a4060', '#1a3050', '#3a5070'] },
  quantum: { buildings: ['module', 'antenna', 'skyscraper'], animals: ['alien_creature', 'space_cat', 'robot_bird'], buildingColors: ['#4a2070', '#2a1050', '#6a3090'] },
  abandoned: { buildings: ['factory', 'cabin', 'water_tower'], animals: ['crow', 'fox', 'rat'], buildingColors: ['#4a4038', '#3a3028', '#5a5048'] },
  highway: { buildings: ['billboard', 'skyscraper', 'crane'], animals: ['pigeon', 'stray_cat', 'crow'], buildingColors: ['#404850', '#303840', '#505860'] },
  warzone: { buildings: ['crane', 'factory', 'billboard'], animals: ['crow', 'eagle', 'rat'], buildingColors: ['#4a3a2a', '#3a2a1a', '#5a4a3a'] },
  underground: { buildings: ['pipe', 'grate', 'module'], animals: ['bat', 'rat', 'snake'], buildingColors: ['#2a2218', '#1a1208', '#3a3228'] },
  sky_bridge: { buildings: ['antenna', 'crane', 'skyscraper'], animals: ['eagle', 'seagull', 'bird'], buildingColors: ['#5a7090', '#3a5070', '#7a90b0'] },
  space_station: { buildings: ['module', 'antenna', 'solar_panel'], animals: ['alien_creature', 'space_cat', 'robot_bird'], buildingColors: ['#3a4a6a', '#2a3a5a', '#4a5a7a'] },
  volcano: { buildings: ['lava_rock', 'ruins', 'smoke_tower'], animals: ['snake', 'lizard', 'crow'], buildingColors: ['#8a3a1a', '#7a2a0a', '#9a4a2a'] },
  hell: { buildings: ['smoke_tower', 'factory', 'chimney'], animals: ['bat', 'snake', 'crow'], buildingColors: ['#6a1010', '#4a0808', '#8a2020'] },
  inferno: { buildings: ['smoke_tower', 'chimney', 'crane'], animals: ['snake', 'lizard', 'bat'], buildingColors: ['#8a2000', '#6a1000', '#aa3000'] },
  hades: { buildings: ['ruins', 'smoke_tower', 'antenna'], animals: ['bat', 'crow', 'snake'], buildingColors: ['#500a18', '#38000e', '#701020'] },
  tartarus: { buildings: ['ruins', 'pipe', 'chimney'], animals: ['bat', 'rat', 'crow'], buildingColors: ['#300010', '#200008', '#480018'] },
  void: { buildings: ['module', 'antenna', 'skyscraper'], animals: ['alien_creature', 'bat', 'space_cat'], buildingColors: ['#1e0a38', '#120424', '#2e1250'] },
  abyss: { buildings: ['module', 'ruins', 'pipe'], animals: ['alien_creature', 'bat', 'snake'], buildingColors: ['#0a1828', '#040e1a', '#14283c'] },
  oblivion: { buildings: ['skyscraper', 'module', 'antenna'], animals: ['alien_creature', 'robot_bird', 'bat'], buildingColors: ['#181028', '#0c0818', '#241a38'] },
  nightmare: { buildings: ['smoke_tower', 'chimney', 'factory'], animals: ['bat', 'crow', 'owl'], buildingColors: ['#301030', '#200820', '#481848'] },
  chaos: { buildings: ['crane', 'smoke_tower', 'module'], animals: ['bat', 'snake', 'alien_creature'], buildingColors: ['#4a0e28', '#320618', '#68183c'] },
  pandemonium: { buildings: ['factory', 'crane', 'antenna'], animals: ['crow', 'bat', 'alien_creature'], buildingColors: ['#4a1810', '#340e08', '#642418'] },
  apocalypse: { buildings: ['crane', 'chimney', 'ruins'], animals: ['crow', 'rat', 'eagle'], buildingColors: ['#582010', '#3e1408', '#783018'] },
  armageddon: { buildings: ['smoke_tower', 'crane', 'factory'], animals: ['crow', 'bat', 'snake'], buildingColors: ['#681808', '#480e04', '#8c240e'] },
  titan: { buildings: ['skyscraper', 'lighthouse', 'antenna'], animals: ['eagle', 'alien_creature', 'bear'], buildingColors: ['#705030', '#50381e', '#906840'] },
  nexus: { buildings: ['module', 'skyscraper', 'antenna'], animals: ['space_cat', 'robot_bird', 'alien_creature'], buildingColors: ['#204060', '#102840', '#305880'] },
  omega: { buildings: ['skyscraper', 'module', 'crane'], animals: ['robot_bird', 'alien_creature', 'space_cat'], buildingColors: ['#402060', '#281040', '#603088'] },
  infinity: { buildings: ['module', 'antenna', 'lighthouse'], animals: ['space_cat', 'robot_bird', 'eagle'], buildingColors: ['#183858', '#0c2238', '#285078'] },
  transcendence: { buildings: ['skyscraper', 'antenna', 'module'], animals: ['eagle', 'space_cat', 'robot_bird'], buildingColors: ['#583070', '#3c1e50', '#784494'] },
  enlightenment: { buildings: ['lighthouse', 'windmill', 'module'], animals: ['owl', 'eagle', 'deer'], buildingColors: ['#605030', '#443820', '#806c40'] },
  ascension: { buildings: ['skyscraper', 'lighthouse', 'antenna'], animals: ['eagle', 'robot_bird', 'owl'], buildingColors: ['#306070', '#1e404c', '#448498'] },
  legendary: { buildings: ['skyscraper', 'windmill', 'module'], animals: ['eagle', 'space_cat', 'alien_creature'], buildingColors: ['#786020', '#544212', '#a0802c'] },
  default: { buildings: ['house', 'tree', 'fence'], animals: ['bird', 'rabbit', 'cat'], buildingColors: ['#607080', '#506070', '#708090'] },
};

const getThemeConfig = (theme: string) => {
  for (const key of Object.keys(THEME_CONFIGS)) {
    if (theme.includes(key)) return THEME_CONFIGS[key];
  }
  return THEME_CONFIGS.default;
};

interface BackgroundElement {
  kind: 'building' | 'animal';
  subtype: string;
  lane: number;
  scale: number;
  color?: string;
  drift?: number;
  phase?: number;
  waves?: boolean;
  isSkyAnimal?: boolean;
  skyY?: number;
  // Flight profile, only for flying animals. Each bird owns its heading, speed,
  // altitude, undulation and wingbeat so no two ever fly the same line.
  dir?: 1 | -1;
  speed?: number;
  // World-space position for flying animals. Unlike the skyline, birds live in
  // the level itself, so they scroll past and leave the screen instead of
  // hovering in the viewport forever.
  worldX?: number;
  bobAmp?: number;
  bobFreq?: number;
  pitch?: number;
  flapRate?: number;
}

// The backdrop skyline is laid out once per level in screen space. It must not
// slide just because the cat moved, so buildings ignore game.scrollX entirely.
// Animals (ground and sky) are the opposite: they live in the level itself.
const BACKDROP_W = 1780; // 1280px canvas plus the wrap-around margin

// Flying animals are the one exception: they belong to the level, not to the
// camera. This is the width of the world strip they roam, deliberately much
// wider than the canvas so birds are regularly off screen as the cat passes.
const SKY_WORLD_W = 2600;

// Ground animals belong to the level as well. They stand at a real world
// position and scroll past the camera exactly like the platforms, so walking
// forward and back never drags them along. The strip is wider than the screen
// so they can genuinely leave the view instead of hovering in it forever.
const GROUND_WORLD_W = 2600;


/** Fisher-Yates on a copy, so callers never mutate the theme config. */
const shuffled = <T,>(items: T[], rng: () => number = Math.random): T[] => {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const SKY_ANIMALS = ['bird', 'pigeon', 'crow', 'seagull', 'eagle', 'bat', 'pelican', 'robot_bird'];
const WAVING_ANIMALS = ['cat', 'stray_cat', 'dog', 'rabbit', 'bear', 'alien_creature', 'cow', 'horse', 'deer'];
// Background creatures are scenery, not characters: keep them small enough
// that the cat always reads as the subject, and the skyline taller than them.
// Ground animals are scenery, not characters: kept a little smaller than the
// cat so a fox at the edge of the screen can never read as a threat.
const SCALE_RANGE = { building: [0.62, 1.15] as const, animal: [0.6, 0.88] as const };

/** Gives a flying animal its own flight profile: heading, cruise speed, altitude,
    undulation and wingbeat. Every bird then flies its own line instead of
    gliding in lockstep with its neighbours. */
const assignFlightProfile = (el: BackgroundElement, rng: () => number = Math.random) => {
  if (!el.isSkyAnimal) {
    el.dir = 1;
    el.speed = 0;
    el.bobAmp = 0;
    el.bobFreq = 1;
    el.pitch = 0;
    el.flapRate = 1;
    // A real place in the level. Mapping the shuffled lane onto the wider
    // strip keeps the irregular spacing while giving the animal an absolute
    // position the camera scrolls against - set once, never re-rolled.
    el.worldX = el.worldX ?? ((el.lane / BACKDROP_W) * GROUND_WORLD_W);
    return;
  }
  // Real birds cross the sky at different speeds, some gliding and some fast.
  el.dir = Math.random() < 0.5 ? -1 : 1;
  el.speed = 26 + Math.random() * 46;
  // A real place in the level, spread across a strip wider than the screen, so
  // a bird is born far from the cat and drifts out of view behind it.
  el.worldX = Math.random() * SKY_WORLD_W;
  // Stay well above the cat's running lane, so birds never crowd the player.
  el.skyY = -(140 + Math.random() * 150);
  el.bobAmp = 5 + Math.random() * 11;
  el.bobFreq = 0.5 + Math.random() * 1.1;
  // A permanent climb or dive, so nobody flies on a perfectly flat line.
  el.pitch = (Math.random() - 0.5) * 0.22;
  el.flapRate = 0.75 + Math.random() * 0.8;
};

const generateBackgroundElements = (theme: string, rng: () => number = Math.random): BackgroundElement[] => {
  const elements: BackgroundElement[] = [];
  const config = getThemeConfig(theme);
  const count = 18;

  // Shuffled lanes, so the scenery is irregularly spaced instead of sitting on
  // a metronome grid that made neighbours line up like a row of clones.
  const lanes = shuffled(Array.from({ length: count }, (_, i) => (i + 0.5) * (BACKDROP_W / count)), rng);

  for (let i = 0; i < count; i++) {
    const lane = lanes[i] + (rng() - 0.5) * 70;
    const roll = rng();

    // 60% buildings, 40% animals
    if (roll < 0.6) {
      const bType = config.buildings[Math.floor(rng() * config.buildings.length)];
      const color = config.buildingColors[Math.floor(rng() * config.buildingColors.length)];
      elements.push({
        kind: 'building',
        subtype: bType,
        lane,
        scale: 0.5 + rng() * 0.5,
        color,
        // Buildings stand still: they are the fixed anchor of the skyline.
        drift: 0,
      });
    } else {
      const aType = config.animals[Math.floor(rng() * config.animals.length)];
      const isSkyAnimal = SKY_ANIMALS.includes(aType);
      const el: BackgroundElement = {
        kind: 'animal',
        subtype: aType,
        lane,
        scale: 1.4 + rng() * 0.6,
        drift: 0,
        phase: rng() * Math.PI * 2,
        waves: WAVING_ANIMALS.includes(aType),
        isSkyAnimal,
        skyY: 0,
      };
      assignFlightProfile(el, rng);
      elements.push(el);
    }
  }

  // Neighbours are defined by lane, not by array order, so sort first:
  // otherwise the lanes that actually sit next to each other on screen are
  // never compared against each other.
  elements.sort((a, b) => a.lane - b.lane);

  // Assign subtypes by cycling a shuffled pool per kind. Every repeat is then
  // exactly pool.length lanes apart, which is the widest spread the theme
  // allows - so the same animal can never stand next to itself, and three
  // copies can never end up side by side. Cycling per kind also avoids the
  // dead end a "pick something unused" pass hits when a theme only has a
  // handful of animals.
  for (const kind of ['animal', 'building'] as const) {
    const pool = shuffled(kind === 'building' ? config.buildings : config.animals, rng);
    if (!pool.length) continue;
    let idx = 0;
    for (const el of elements) {
      if (el.kind !== kind) continue;
      el.subtype = pool[idx % pool.length];
      idx++;
    }
  }

  // Recompute everything derived from the subtype, then keep neighbours
  // visibly different in size so a row never reads as clones.
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const prev = elements[i - 1];
    const next = elements[i + 1];

    if (el.kind === 'animal') {
      el.isSkyAnimal = SKY_ANIMALS.includes(el.subtype);
      el.waves = WAVING_ANIMALS.includes(el.subtype);
      assignFlightProfile(el, rng);
    }

    const [lo, hi] = SCALE_RANGE[el.kind];
    for (const other of [prev, next]) {
      if (other && Math.abs(other.scale - el.scale) < 0.3) {
        el.scale += el.scale >= other.scale ? 0.3 : -0.3;
      }
    }
    el.scale = Math.max(lo, Math.min(hi, el.scale));
  }

  return elements;
};

/** Draws a joined cumulus silhouette (not separate puffs) with soft depth.
    The four profiles vary the outline as well as the scale, so clouds read as
    weather formations rather than a row of repeated dots. */
const drawCloud = (
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, scale: number, alpha: number, profile = 0, night = false, warm = false
) => {
  const profiles = [  { puffs: [[-92, 8, 74, 48], [-42, 9, 78, 72], [30, 8, 82, 70], [96, 8, 62, 48]], base: [-162, 4, 326, 64] },
  { puffs: [[-112, 8, 62, 43], [-61, 9, 68, 62], [8, 9, 78, 59], [78, 8, 70, 64], [133, 8, 52, 43]], base: [-174, 4, 350, 61] },
  { puffs: [[-83, 8, 61, 47], [-39, 7, 68, 68], [30, 8, 78, 76], [98, 8, 66, 58]], base: [-144, 4, 292, 62] },
  { puffs: [[-112, 8, 60, 43], [-70, 8, 68, 61], [-4, 9, 66, 55], [55, 8, 70, 68], [119, 8, 66, 51]], base: [-172, 4, 344, 61] },
  ];
  const shape = profiles[profile % profiles.length];

  const silhouette = () => {
    ctx.beginPath();
    shape.puffs.forEach(([x, y, rx, ry]) => {
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    });
    const [x, y, width, height] = shape.base;
    ctx.roundRect(x, y, width, height, height / 2);
  };

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;

  silhouette();
  const body = ctx.createLinearGradient(0, -115, 0, 76);
  if (night) {
    // Moonlit cumulus: silver-blue tops fading into a deeper violet base.
    body.addColorStop(0, 'rgba(232, 240, 255, 0.95)');
    body.addColorStop(0.55, 'rgba(198, 214, 246, 0.9)');
    body.addColorStop(1, 'rgba(140, 160, 208, 0.82)');
  } else if (warm) {
    // Golden hour: the cloud is lit from below, so the warm light sits on its
    // underside while the tops cool off into the dusk sky.
    body.addColorStop(0, '#e7aac4');
    body.addColorStop(0.45, '#ffd0b4');
    body.addColorStop(1, '#ffa96f');
  } else {
    // Opaque, bright white: a translucent fill blended with the blue sky and
    // read as a dull grey lump instead of a lit cloud.
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.58, '#f8fdff');
    body.addColorStop(1, '#dceef8');
  }
  ctx.fillStyle = body;
  // A soft native drop shadow reads as a shaded underside without the hard grey
  // offset copy that made the clouds look dirty.
  ctx.shadowColor = night ? 'rgba(8, 14, 38, 0.5)' : warm ? 'rgba(120, 50, 70, 0.24)' : 'rgba(64, 106, 142, 0.26)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 10;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // A broad, feathered highlight gives the cloud a sunlit, airy top.
  ctx.globalAlpha = alpha * (night ? 0.16 : warm ? 0.2 : 0.28);
  ctx.fillStyle = warm ? '#ffe2c8' : '#ffffff';
  ctx.beginPath();
  ctx.ellipse(-32, -55, 82, 19, -0.12, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** ADVANCED 50-LEVEL PLAYABLE GAME VIEW **/
export const PlayingView: React.FC<{
  onEnd: (score: number, fishesCollected: number) => void;
  startLevel?: number;
  runMode?: RunMode;
}> = ({ onEnd, startLevel = 1, runMode = 'campaign' as RunMode }) => {
  // The game loop is started once per level. Reading onEnd through a ref keeps a
  // parent re-render (e.g. the coin counter updating after every fish) from
  // changing the loop's dependencies and restarting the whole level.
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentLevel, setCurrentLevel] = useState(() => Math.max(1, startLevel));
  const [totalScore, setTotalScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [showLevelComplete, setShowLevelComplete] = useState(false);
  const [levelSummary, setLevelSummary] = useState<any>(null);
  const [perkOffer, setPerkOffer] = useState<PerkDef[]>([]);
  const [perkChoice, setPerkChoice] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;
  // Incremented to rebuild the current level (restart) without changing which
  // level the player is on.
  const [runId, setRunId] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  // The level card is dismissible with any input. A ref keeps the game loop's
  // key handler from being rebuilt just to read a piece of UI state.
  const showIntroRef = useRef(true);
  showIntroRef.current = showIntro;

  const togglePause = useCallback(() => {
    setIsPaused(prev => {
      const next = !prev;
      isPausedRef.current = next;
      if (next) AudioEngine.playUiClick();
      return next;
    });
  }, []);

  const restartCurrentLevel = () => {
    setIsPaused(false);
    isPausedRef.current = false;
    if (gameRef.current) gameRef.current.running = false;
    // A restart is a fresh attempt, so run-wide tallies start over too.
    runTotalsRef.current = { nearMisses: 0, shadowPasses: 0, shadowShifts: 0 };
    runPerksRef.current = [];
    setPerkOffer([]);
    setPerkChoice(null);
    setRunId((n) => n + 1);
  };

  // Leaving from the pause menu ends the run just like a lost life: the
  // summary has to be written from the live game first, otherwise the game-over
  // screen showed stale numbers from the previous run.
  const quitRun = () => {
    const game = gameRef.current;
    if (game) {
      game.running = false;
      setTotalScore(game.score);
      persistRunSummary(game, false);
    }
    setIsPaused(false);
    isPausedRef.current = false;
    onEndRef.current(game?.score ?? totalScore, game?.totalCollectedInLevel ?? 0);
  };

  // The level card introduces the stage for a beat and then fades away. The
  // very first card stays a little longer because it also teaches the controls.
  // Any key or tap skips it, so a 40-level campaign never becomes 40 forced
  // waits between attempts.
  useEffect(() => {
    setShowIntro(true);
    const timer = window.setTimeout(() => setShowIntro(false), currentLevel === 1 ? 3200 : 1600);
    return () => window.clearTimeout(timer);
  }, [currentLevel, runId]);

  const skipIntro = () => {
    if (!showIntroRef.current) return;
    showIntroRef.current = false;
    setShowIntro(false);
    const g = gameRef.current;
    if (g) {
      g.introTimer = 0;
      // Spawn protection ends the moment the player takes control.
      g.player.invincible = false;
      g.player.invincibleTimer = 0;
    }
  };

  // Alt-tabbing out of the game pauses it instead of letting the cat run into
  // a hazard unseen.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && gameRef.current?.running) {
        setIsPaused(true);
        isPausedRef.current = true;
      }
    };
    // Clicking another window can swallow the keyup, leaving the cat sprinting
    // into a pit the moment the player tabs back. Dropping held keys on blur is
    // the cheap, non-intrusive half of the fix (the visibility handler pauses).
    const onBlur = () => {
      if (gameRef.current) gameRef.current.keys = {};
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const [stats, setStats] = useState<HudStats>({ score: 0, progress: 0, collectedCount: 0, totalFish: 0, fishGoal: 0, ammo: 5, weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'NIGHT', combo: 0, levelType: 'Classic', timer: 0, miniEvent: 'NONE', xp: 0, runLevel: 1, xpNeeded: 120, xpIntoLevel: 0, multiplier: 1, streak: 0, dashReady: true, dashPct: 1, comboTimer: 0, noHit: true, nearMisses: 0, shadowCharge: 0, shadowActive: 0, shadowPasses: 0, toasts: [] as any[], bossHp: 0, bossMaxHp: 0, bossVisible: false, bossName: '', bossPhase: 0, shield: false, magnet: 0, rapid: 0, coinsRun: 0, goalDist: 0, fishDir: 0 });
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(true);
  const [combo, setCombo] = useState(0);
  const [seasonTheme] = useState(getSeasonTheme());
  const { progress, addCoins, toggleMuted, advanceCampaign } = useProgress();
  const t = useT();
  const isMuted = progress.settings.muted;

  const gameRef = useRef<any>(null);
  // Run-wide tallies. `game` is rebuilt for every level, so these cannot live
  // on it: the results screen and quests need the whole run, not just the last
  // stage. A new PlayingView (keyed by start level) starts a fresh run.
  const runTotalsRef = useRef({ nearMisses: 0, shadowPasses: 0, shadowShifts: 0 });
  // Cards chosen this run survive level transitions but not a restart.
  const runPerksRef = useRef<string[]>([]);
  // One monitor per PlayingView mount; survives level changes within a run.
  const qualityRef = useRef(createQualityMonitor());
  const gameContainerRef = useRef<HTMLDivElement>(null);

  // Use background music for levels 1-10. Mute + level follow the saved settings.
  useBackgroundMusic(currentLevel, isMuted, progress.settings.musicVolume, isPaused);
  useEffect(() => {
    AudioEngine.setAdaptive(progress.settings.adaptiveAudio !== false);
  }, [progress.settings.adaptiveAudio]);

  // Handle fullscreen and ESC key
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && gameContainerRef.current) {
      const request = gameContainerRef.current.requestFullscreen?.();
      // On phones, fullscreen is only useful if the game can rotate with it.
      // Orientation lock is best-effort - desktop browsers reject it silently.
      if (request && 'orientation' in screen) {
        request
          .then(() => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
          .catch(() => {});
      }
    } else if (document.fullscreenElement) {
      (screen.orientation as unknown as { unlock?: () => void }).unlock?.();
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    // Width alone misses a phone held sideways (844x390 is wider than md), so a
    // short viewport counts as mobile too.
    const syncViewport = () => {
      setIsMobile(window.innerWidth < 768 || window.innerHeight < 520);
      setIsPortrait(window.innerHeight >= window.innerWidth);
    };
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    syncViewport();
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
    };
  }, []);

  const setupLevel = (level: number, existingScore: number, existingLives: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // One seed per level. A daily run mixes in the date so everyone gets the
    // same fresh course, while the campaign keeps its canonical, learnable
    // layout. Everything (enemies, fish, hazards, pickups, pads, scenery)
    // comes from this generator, so a retry replays the exact same stage.
    const dailySeed = getDailySeed();
    const seedOffset = runMode === 'daily' ? hashSeed(dailySeed) : 0;
    const rng = makeRng(level * 104729 + 991 + seedOffset);

    // The stage's named rule. Boss stages and the two tutorial stages get
    // `none`; the daily run mixes its date seed in so every player faces the
    // same twist on the same day.
    const twist = getLevelTwist(level, seedOffset);
    const twistPhys = twistPhysics(twist);

    const difficulty = progress.settings.difficulty || 'normal';
    const difficultyProfile = getDifficultyProfile(level, progress.level, difficulty);
    const perkEffects = combinePerkEffects(runPerksRef.current);
    const levelLength = difficultyProfile.levelLength;
    const baseLevelDesign = getLevelDesign(level);
    const randomWeather = getWeatherForLevel(level);
    const weather = randomWeather.weather;
    const intensity = randomWeather.intensity;
    const timeOfDay = randomWeather.timeOfDay;
    const theme = baseLevelDesign.theme;

    const skin = SKINS[progress.equippedSkin] || SKINS.default;
    // A predictable five-level rhythm teaches a mechanic, adds a challenge,
    // then gives each fifth level a dedicated boss encounter.
    const levelMode = level % 5 === 0
      ? 'Boss Battle'
      : (level % 5 === 1 ? 'Classic' : (level % 5 === 2 ? 'Collection' : (level % 5 === 3 ? 'Survival' : 'Speed Run')));
    // Time budget follows course length, so later speed-run stages stay fair
    // even as the route grows substantially. A Speed Run still requires every
    // fish to be collected, so each fish buys a little extra time too - the old
    // budget only counted straight-line running, which left the clock
    // unbeatable once the mandatory fish hunt was factored in.
    const speedRunTimer = Math.max(
      40,
      Math.ceil(((levelLength / ((4.6 + level * 0.08) * 60)) * 1.5 + 14 + difficultyProfile.fishCount * 0.9) * difficultyProfile.timerScale * perkEffects.timerMult)
    );

    const game = {
      running: true,
      level: level,
      runMode,
      dailySeed,
      seedOffset,
      ghostKey: `${runMode}:${level}:${seedOffset}`,
      frame: 0,
      quality: FULL_QUALITY,
      bgCache: null as HTMLCanvasElement | null,
      bgCacheKey: '',
      shadowShiftId: 0,
      ghost: null as any,
      ghostFrames: [] as any[],
      checkpoints: [] as number[],
      checkpointIndex: 0,
      checkpointX: 100,
      activePerks: [...runPerksRef.current],
      perkEffects,
      perkOffer: offerPerks(level * 31.7 + seedOffset, runPerksRef.current),
      score: existingScore,
      lives: existingLives,
      // Boss stages get enough extra shots for missed shots and a few regular
      // enemies, without turning their required fight into an ammo soft-lock.
      ammo: progress.upgrades.maxAmmo + (progress.level >= 10 ? 2 : 0) + (level % 5 === 0 ? 14 + Math.ceil(level * 0.9) : 0),
      levelLength: levelLength,
      weather: weather,
      intensity: intensity,
      timeOfDay: timeOfDay,
      scrollX: 0,
      gravity: levelMode === 'Speed Run' ? 0.75 : 0.8,
      friction: 0.85,
      levelType: levelMode,
      levelTimer: levelMode === 'Speed Run' ? speedRunTimer : 0,
      levelTimerBudget: levelMode === 'Speed Run' ? speedRunTimer : 0,
      levelSeconds: 0,
      combo: 0,
      comboTimer: 0,
      bestComboInRun: 0,
      enemiesDefeatedInRun: 0,
      levelsCompletedInRun: 0,
      bossDefeatedInRun: false,
      deathsInRun: 0,
      screenShake: 0,
      hitStop: 0,
        miniEvent: {
          // No blackout event: dimming the whole stage for a few seconds read as
          // a broken lamp rather than a mechanic, and daytime levels must stay
          // daylight. Wind and low gravity still vary the feel of a stage.
          type: level > 2 ? (['WIND', 'LOW_GRAVITY'] as const)[Math.floor(seededRandom(level * 13.5) * 2)] : 'NONE',
          active: false,
          timer: 540,
          duration: 260,
        },
      groundY: canvas.height - 96,
      lightning: {
        nextStrike: 150,
        pending: null,
        strikes: [],
        scorches: [],
        flash: 0,
        lastX: -9999,
      } as LightningState,
      weatherParticles: [] as any[],
      // --- Run progression (feeds the reward loop) ---
      xp: 0,
      runLevel: 1,
      xpIntoLevel: 0,
      xpNeeded: 120,
      streak: 0,
      bestStreak: 0,
      multiplier: 1,
      multiplierTimer: 0,
      lastMilestoneMultiplier: 1,
      toasts: [] as any[],
      noHit: true,
      nearMisses: 0,
      coinsThisLevel: 0,
      fishedThisLevel: 0,
      startLives: existingLives,
      // --- Shadow Shift: the cat's signature ability -----------------------
      // Charge comes from clean, aggressive play (fish, kills, near misses).
      // At 100 the player can dissolve into shadow for four seconds: immune to
      // every damage source, faster, drawing fish in, and defeating enemies
      // simply by passing through them.
      shadowCharge: 0,
      shadowActive: 0,
      shadowPasses: 0,
      shadowShifts: 0,
      // --- Power-up layer ---
      pickups: [] as any[],
      enemyBullets: [] as any[],
      shield: false,
      buffs: { magnet: 0, rapid: 0, goldRush: 0 },
      shootCooldown: 0,
      // Spawn protection while the level card is up. The card covers the
      // stage, so a patrolling enemy must not be able to hit a player who is
      // still reading the controls. Skipping the card ends the protection.
      introTimer: level === 1 ? 192 : 96,
      introMax: level === 1 ? 192 : 96,
      killsThisLevel: 0,
      // --- Juice timers ---
      slowMo: 0,
      zoomPunch: 0,
      player: {
        x: 100, y: 150, width: 50, height: 70,
        velocityX: 0, velocityY: 0,
        speed: (4.6 + (level * 0.08)) * (progress.settings.uiScale < 0.95 ? 0.98 : 1),
        baseSpeed: 0, // set below; Shadow Shift restores this exact value
        jumpPower: progress.upgrades.jumpPower,
        doubleJumpPower: progress.upgrades.jumpPower + 3,
        isJumping: false, canDoubleJump: true, hasDoubleJumped: false,
        // Game feel state
        onGround: false,
        coyoteTimer: 0,
        jumpBuffer: 0,
        jumpHeld: false,
        dashCharges: 1,
        dashCooldown: 0,
        dashing: 0,
        dashDir: 1,
        squash: 1,
        stretch: 1,
        trail: [] as any[],
        runCycle: 0,
        lastGroundedY: 0,
        color: skin.color, invincible: false, invincibleTimer: 0,
        accent: skin.accent,
        original: skin.original,
        isBlinking: false, blinkTimer: 0,
        wallDir: 0, wallLock: 0, wallSlideTick: 0, ridingRef: null,
        facing: 1 // 1 for right, -1 for left
      },
      springPads: [] as any[],
      jerry: { x: levelLength - 150, y: canvas.height - 96 - 50, width: 40, height: 50, rescued: false },
      platforms: [],
      holes: [],
      fishes: [],
      enemies: [],
      bullets: [],
      particles: [],
      floatingTexts: [],
      hazards: [],
      boss: null,
      keys: {} as Record<number, boolean>,
      showFishWarning: false,
      totalCollectedInLevel: 0,
      backgroundElements: [],
      theme: theme,
      twist,
      twistPhysics: twistPhys,
      // Surprise events: one slot filled by pickEvent() during the run, plus
      // the id of the last one so the same event never fires twice in a row.
      surprise: null as ActiveEvent | null,
      lastSurprise: null as EventId | null,
      surpriseSeed: level * 7.7 + 3.1,
      meteors: [] as any[],
      landRing: null as { x: number; y: number; life: number; r: number } | null,
      // Biome palette used by both the backdrop and the platform pass. Stored
      // once per level so a golden-hour tint can never drift between passes.
      worldPal: paletteFor(theme, timeOfDay),
      layout: getLevelLayout(level),
      fishGoal: 0,
      lastStatUpdate: 0,
      // Timing for the double-tap → / D dash, read in handleKeyDown.
      lastForwardTap: { code: 0, at: 0 }
    };

    // Passive perks from skill tree milestones.
    if (progress.level >= 5) game.player.speed += 0.6;
    if (progress.level >= 10) game.ammo += 2;
    if (progress.level >= 15) game.player.invincibleTimer = 20;
    // Shadow Shift temporarily raises `speed`; keep the real value to restore.
    game.player.baseSpeed = game.player.speed;
    if (perkEffects.speedMult !== 1) {
      game.player.speed *= perkEffects.speedMult;
      game.player.baseSpeed = game.player.speed;
    }
    game.player.invincible = true;
    game.player.invincibleTimer = game.introTimer;

    // Generate background elements
    // The old clip-art animals and flat billboard buildings are gone: the
    // cartoon backdrop draws its own rounded, parallax skyline and tree lines,
    // and the distant wildlife is rendered as ink silhouettes in one pass.
    game.backgroundElements = [];

    // Initialize Weather Particles
    if (weather !== 'SOLIGT') {
      let pCount = 50;
      if (weather === 'SNÖIGT') pCount = intensity === 'HEAVY' ? 200 : 50;
      else if (weather === 'REGNIGT') pCount = intensity === 'HEAVY' ? 120 : 60;
      else if (weather === 'STORMIGT') pCount = 150;
      else if (weather === 'DIMMIGT') pCount = 15; // Fewer but larger clouds

      for (let i = 0; i < pCount; i++) {
        if (weather === 'DIMMIGT') {
          game.weatherParticles.push({
            x: rng() * canvas.width,
            y: rng() * canvas.height,
            speed: 0.2 + rng() * 0.5,
            radius: 100 + rng() * 150,
            opacity: 0.05 + rng() * 0.1,
            sway: rng() * Math.PI * 2
          });
        } else {
          game.weatherParticles.push({
            x: rng() * canvas.width,
            y: rng() * canvas.height,
            speed: weather === 'SNÖIGT' ? (intensity === 'HEAVY' ? 1.5 + rng() * 2 : 1 + rng() * 2) : 10 + rng() * 5,
            length: weather === 'SNÖIGT' ? 0 : 10 + rng() * 20,
            radius: weather === 'SNÖIGT' ? 1.5 + rng() * 2.5 : 0,
            sway: rng() * Math.PI * 2
          });
        }
      }
    }

    const groundY = canvas.height - 96;
    // Parallax scenery and the boss platform follow the same ground line.
    game.groundY = groundY;
    // Each level owns a structural archetype (stairs, islands, bridges, ...)
    // so no two stages are laid out the same way, while level 1 always opens on
    // the flat tutorial meadow.
    const layout = getLevelLayout(level);
    const layoutBuild = buildLevelLayout({
      level,
      layout,
      levelLength,
      groundY,
      profile: difficultyProfile,
      bossLevel: level % 5 === 0,
      seedOffset,
    });
    game.platforms.push(...layoutBuild.platforms);
    game.holes.push(...layoutBuild.holes);
    game.layout = layout;

    // Regular platforms stop short of the boss arena; place a few clear
    // stepping stones in the approach so it is reachable without clutter.
    if (level % 5 === 0) {
      for (let i = 0; i < 4; i++) {
        const x = levelLength - 1510 + i * 150;
        game.platforms.push({
          x,
          y: groundY - (i === 3 ? 112 : 62),
          width: i === 3 ? 380 : 150,
          height: 20,
          color: '#234832',
        });
      }
    }

    // Respawn anchors on solid ground. Long levels used to send a fallen cat
    // back to whichever slab happened to be nearest, which could be far behind.
    game.checkpoints = getCheckpoints(levelLength, game.platforms, game.holes);
    game.checkpointX = 100;

    // MUCH MORE enemies - spread throughout the entire level for excitement!
    // More enemies on EVERY level, not just higher levels
    const enemyCount = levelMode === 'Boss Battle'
      ? 0
      : (levelMode === 'Survival' ? Math.floor(difficultyProfile.enemyCount * 1.3) : difficultyProfile.enemyCount);
    let enemiesPlaced = 0;
    let spawnAttempts = 0;
    const minEnemyDistance = 280;

    while (enemiesPlaced < enemyCount && spawnAttempts < 400) {
      spawnAttempts++;
      // Bias spawns toward the far half so the course builds up as you push on.
      const bias = 1 - Math.pow(rng(), 1 + difficultyProfile.inLevelRamp * 1.4);
      const randomSegment = 3 + Math.floor(bias * Math.max(1, game.platforms.length - 8));
      const plat = game.platforms[randomSegment];
      if (!plat) continue;

      // Skip some ground platforms but not all
      if (plat.isGround && rng() > 0.5) continue;

      const ex = plat.x + rng() * Math.max(10, plat.width - 40);
      // Leave the final approach readable, and reserve the boss arena for its fight.
      const finalApproachLength = level % 5 === 0 ? 1450 : 420;
      if (ex < 400 || ex > levelLength - finalApproachLength) continue;

      const tooClose = game.enemies.some(other => {
        return Math.abs(other.x - ex) < minEnemyDistance && Math.abs(other.y - (plat.y - 40)) < 80;
      });
      if (tooClose) continue;

      // Enemies deeper in the level are a touch quicker.
      const depthRamp = 1 + (ex / Math.max(1, levelLength)) * difficultyProfile.inLevelRamp * 0.35;
      // Three archetypes from the start; turrets and chargers join later so the
      // player is never introduced to every threat at once.
      const roll = rng();
      const enemyType = level >= 5 && roll < 0.16 ? 4 : level >= 3 && roll < 0.32 ? 3 : Math.floor(rng() * 3);
      const isTurret = enemyType === 3;
      game.enemies.push({
        x: ex, y: plat.y - 40, width: 40, height: 40,
        velocityX: isTurret ? 0 : difficultyProfile.enemySpeed * depthRamp * (rng() > 0.5 ? 1 : -1),
        direction: 1, platform: randomSegment, type: enemyType,
        shootTimer: 70 + Math.floor(rng() * 70),
        baseY: plat.y - 40,
        chargeTimer: 0,
      });
      enemiesPlaced++;
    }

    if (level % 5 === 0) {
      const bossTypes = ['rat_king', 'cyber_dog', 'storm_eagle', 'void_dragon', 'shadow_titan'];
      const bossTypeIndex = (Math.floor(level / 5) - 1) % bossTypes.length;
      const bossType = bossTypes[bossTypeIndex];
      const bossNames: Record<string, string> = {
        'rat_king': tr('RÅTTE-KUNG'),
        'cyber_dog': tr('CYBER-HUND'),
        'storm_eagle': tr('STORM-ÖRN'),
        'void_dragon': tr('TOMRUMS-DRAKEN'),
        'shadow_titan': tr('SKUGG-TITAN')
      };
      // A guaranteed, purpose-built arena avoids bosses spawning on random
      // floating platforms or in the middle of a level.
      const bossArenaStart = levelLength - 960;
      game.holes = game.holes.filter((hole: any) => hole.x + hole.width <= bossArenaStart || hole.x >= levelLength - 280);
      game.hazards = game.hazards.filter((hazard: any) => hazard.x < bossArenaStart || hazard.x > levelLength - 280);
      const bossPlatform = {
        x: levelLength - 720,
        y: groundY,
        width: 360,
        height: 46,
        color: GROUND_COLOR,
        isGround: true,
        bossArena: true,
        bossWalkway: true,
      };
      // The arena floor replaces the random ground slabs, so it is added after
      // they are filtered out. The approach reaches 120px further back than the
      // arena itself: without that overlap a sliver of empty sky would show
      // between the last ground slab and the arena.
      const approachStart = Math.max(0, bossArenaStart - 120);
      const bossApproach = {
        x: approachStart,
        y: groundY,
        width: bossPlatform.x - approachStart,
        height: 46,
        color: GROUND_COLOR,
        isGround: true,
        bossWalkway: true,
      };
      game.platforms = game.platforms.filter((platform: any) =>
        !platform.isGround || platform.x + platform.width <= approachStart || platform.x >= bossPlatform.x + bossPlatform.width
      );
      game.platforms.push(bossPlatform);
      game.platforms.push(bossApproach);
      // Jerry waits on the far side of the arena, so the ground behind the boss
      // platform must be solid too - otherwise the goal floats over a void.
      game.platforms.push({
        x: bossPlatform.x + bossPlatform.width,
        y: groundY,
        width: Math.max(0, levelLength - (bossPlatform.x + bossPlatform.width)),
        height: 46,
        color: GROUND_COLOR,
        isGround: true,
      });
      {
        // Boss tier rises every fifth level: the same five characters come back
        // tougher, faster and with a tighter attack rhythm each time.
        const bossTier = Math.max(1, Math.floor(level / 5));
        const totalHp = 10 + bossTier * 3 + Math.floor(level * 0.2);
        game.enemies = game.enemies.filter((enemy: any) => enemy.x < bossArenaStart || enemy.x > levelLength - 280);
        game.boss = {
          x: bossPlatform.x + (bossPlatform.width - 100) / 2,
          y: bossPlatform.y - 90,
          width: 100,
          height: 90,
          hp: totalHp,
          maxHp: totalHp,
          velocityX: 1.8 + bossTier * 0.26,
          velocityY: 0,
          platformX: bossPlatform.x,
          platformW: bossPlatform.width,
          groundY: bossPlatform.y - 90,
          phase: 0,  // 0=normal, 1=aggressive, 2=rage
          type: bossType,
          name: bossNames[bossType] || 'BOSS',
          attackTimer: BOSS_ATTACK_PROFILES[bossType].cooldown,
          attackCooldown: BOSS_ATTACK_PROFILES[bossType].cooldown,
          tier: bossTier,
          moveIndex: 0,
          telegraph: 0,
          pendingMove: null as string | null,
          summonCooldown: 0,
          projectiles: [] as any[],
          isJumping: false,
          jumpTimer: 0,
          stunTimer: 0,
          auraAngle: 0,
          dashTimer: 0,
          encountered: false,
          isMini: false,
          coreExposed: 0,
          coreFlash: 0,
        };
      }
    }

    // Miniboss on every third chapter: a shorter version of a real boss, on a
    // normal platform. It must be defeated before Jerry opens the exit, but it
    // has less HP and a gentler attack cadence than a full arena fight.
    if (level % 5 === 3) {
      const miniTypes = ['rat_king', 'cyber_dog', 'storm_eagle', 'void_dragon', 'shadow_titan'];
      const miniType = miniTypes[Math.floor(level / 5) % miniTypes.length];
      const miniNames: Record<string, string> = {
        rat_king: tr('MINIBOSS · RÅTTE-KUNG'),
        cyber_dog: tr('MINIBOSS · CYBER-HUND'),
        storm_eagle: tr('MINIBOSS · STORM-ÖRN'),
        void_dragon: tr('MINIBOSS · DRAKE'),
        shadow_titan: tr('MINIBOSS · TITAN'),
      };
      let miniPlat = game.platforms
        .filter((pl: any) => pl.isGround && pl.x > levelLength * 0.35 && pl.x + pl.width < levelLength - 350 && !pl.bossArena)
        .sort((a: any, b: any) => b.width - a.width)[0];
      // A narrow-island level can have no wide slab at all. Build a small arena
      // so the third chapter always has its miniboss encounter.
      if (!miniPlat || miniPlat.width < 220) {
        const mx = Math.round(levelLength * 0.62);
        miniPlat = {
          x: mx, y: groundY, width: 340, height: 46,
          color: GROUND_COLOR, isGround: true, miniArena: true,
        };
        game.platforms.push(miniPlat);
        game.holes = game.holes.filter((h: any) => h.x + h.width <= mx || h.x >= mx + 340);
        game.hazards = game.hazards.filter((h: any) => h.x <= mx || h.x >= mx + 340);
      }
      if (miniPlat) {
        const miniHp = 6 + Math.floor(level / 5) * 2;
        game.enemies = game.enemies.filter((en: any) =>
          en.x < miniPlat.x - 120 || en.x > miniPlat.x + miniPlat.width + 120);
        game.boss = {
          x: miniPlat.x + (miniPlat.width - 88) / 2,
          y: miniPlat.y - 78,
          width: 88, height: 78,
          hp: miniHp, maxHp: miniHp,
          velocityX: 1.35, velocityY: 0,
          platformX: miniPlat.x, platformW: miniPlat.width,
          groundY: miniPlat.y - 78,
          phase: 0, type: miniType,
          name: miniNames[miniType] || 'MINIBOSS',
          attackTimer: BOSS_ATTACK_PROFILES[miniType].cooldown + 40,
          attackCooldown: BOSS_ATTACK_PROFILES[miniType].cooldown + 40,
          tier: 1, moveIndex: 0, telegraph: 0,
          pendingMove: null as string | null,
          summonCooldown: 0, projectiles: [] as any[],
          isJumping: false, jumpTimer: 0, stunTimer: 0,
          auraAngle: 0, dashTimer: 0, encountered: false,
          isMini: true, coreExposed: 0, coreFlash: 0,
        };
      }
    }

    // MORE coins - more rewards throughout the level
    const fishCount = levelMode === 'Collection' ? Math.floor(difficultyProfile.fishCount * 1.45) : difficultyProfile.fishCount;
    let placedFish = 0;
    let fishPlacementAttempts = 0;

    // Add dynamic moving items on later levels
    // More coins - ALL reachable with double jump!
    const flyingItems = level > 3;

    // Fish should be scattered over the level, not schooled together. Each level
    // gets a minimum horizontal gap between fish, scaled so dense late levels
    // can still place all of theirs.
    const minFishGap = Math.max(46, Math.min(130, (levelLength / Math.max(1, fishCount)) * 0.75));

    while (placedFish < fishCount && fishPlacementAttempts < fishCount * 25) {
      fishPlacementAttempts++;
      const randomPlatIndex = Math.floor(rng() * game.platforms.length);
      const plat = game.platforms[randomPlatIndex];

      // 30% flying coins, 70% on/near platforms
      const isFlying = flyingItems && rng() > 0.7;

      let fx, fy;
      if (isFlying) {
        // Flying coins - but reachable with double jump!
        // Max height from ground with double jump is about 250px
        fx = 200 + rng() * (levelLength - 400);
        // Keep flying coins reachable - not too high!
        fy = canvas.height - 280 + rng() * 100;
      } else {
        // On platforms - just above the platform
        fx = plat.x + 10 + rng() * (plat.width - 30);
        // Just above the platform - always reachable
        fy = plat.y - 30 - rng() * 30;
      }

      // Keep everything reachable
      fy = Math.max(canvas.height - 300, Math.min(fy, canvas.height - 60));
      // Never spawn on top of the cat, and never beyond Jerry: a fish past
      // the goal used to force a run to the end and then all the way back.
      const clampedFx = Math.max(260, Math.min(fx, levelLength - 240));

      let fishCollision = false;
      const fishBounds = { x: clampedFx, y: fy, width: 24, height: 14 };

      // Check if fish would spawn inside a platform
      for (const p of game.platforms) {
        if (fishBounds.x < p.x + p.width && fishBounds.x + fishBounds.width > p.x &&
          fishBounds.y < p.y + p.height && fishBounds.y + fishBounds.height > p.y) {
          fishCollision = true;
          break;
        }
      }
      // Reject a spot that would bunch up against a fish we already placed. Late in
      // the attempt budget the spacing is relaxed, because placing too few fish
      // would make the level impossible to finish.
      const requiredGap = fishPlacementAttempts > fishCount * 12 ? minFishGap * 0.35 : minFishGap;
      let fishTooClose = false;
      for (const f of game.fishes) {
        if (Math.abs(f.x - clampedFx) < requiredGap) { fishTooClose = true; break; }
      }
      // A collectible over a wide chasm, or sitting in an enemy's patrol
      // square, is not a reward - it is an unavoidable hit or an impossible
      // detour. Both are rejected so the quota is always reachable.
      const overWideHole = game.holes.some((h: any) => h.width > 170 && clampedFx > h.x - 40 && clampedFx < h.x + h.width + 40);
      const onEnemy = game.enemies.some((e: any) => Math.abs(e.x - clampedFx) < 55);

      if (!fishCollision && !fishTooClose && !overWideHole && !onEnemy) {
        game.fishes.push({
          x: clampedFx,
          y: fy,
          width: 24,
          height: 14,
          collected: false,
          isFlying: isFlying,
          hoverOffset: rng() * Math.PI * 2,
          baseY: fy
        });
        placedFish++;
      }
    }

    // Last-resort fish on solid ground. The random pass can be unlucky on a
    // dense layout, and a quota larger than the number of fish that actually
    // made it onto the board would make the stage literally unwinnable.
    if (game.fishes.length < 6) {
      for (let x = 340; x < levelLength - 260 && game.fishes.length < 6; x += 180) {
        if (game.holes.some((h: any) => x > h.x - 30 && x < h.x + h.width + 30)) continue;
        if (game.fishes.some((f: any) => Math.abs(f.x - x) < 100)) continue;
        if (game.enemies.some((e: any) => Math.abs(e.x - x) < 55)) continue;
        const groundPlat = game.platforms.find((pl: any) => pl.isGround && x >= pl.x && x <= pl.x + pl.width);
        const fy = (groundPlat ? groundPlat.y : groundY) - 44;
        game.fishes.push({
          x, y: fy, width: 24, height: 14, collected: false,
          isFlying: false, hoverOffset: 0, baseY: fy,
        });
      }
    }

    // The level goal is a quota, not a full sweep: hunting the last three fish
    // across a long course is busywork. It can never exceed the fish that were
    // actually placed, however unlucky the generator was. Collecting
    // everything still pays a perfect-catch bonus.
    const quotaRatio = Math.min(0.85, (level <= 2 ? 0.6 : 0.72) * difficultyProfile.quotaScale);
    game.fishGoal = Math.min(
      game.fishes.length,
      Math.max(3, Math.ceil(game.fishes.length * quotaRatio) + perkEffects.fishGoalDelta),
    );

    // Add fun hazards to keep levels unique and less repetitive.
    const hazardCount = levelMode === 'Boss Battle'
      ? 0
      : (levelMode === 'Survival' ? Math.floor(difficultyProfile.hazardCount * 1.15) : difficultyProfile.hazardCount);
    let hazardAttempts = 0;
    while (game.hazards.length < hazardCount && hazardAttempts < hazardCount * 20) {
      hazardAttempts++;
      // Like enemies, hazards cluster toward the far end of the level.
      const bias = 1 - Math.pow(rng(), 1 + difficultyProfile.inLevelRamp * 1.2);
      const randomPlatIndex = 4 + Math.floor(bias * Math.max(1, game.platforms.length - 10));
      const plat = game.platforms[randomPlatIndex];
      if (!plat || plat.width < 80) continue;

      const hx = plat.x + 10 + rng() * Math.max(10, plat.width - 70);
      if (hx < 450 || hx > levelLength - 400) continue;

      // Keep boss arenas readable and free of unrelated hazard clutter.
      if (level % 5 === 0 && hx > levelLength - 1500) continue;
      const tooClose = game.hazards.some((h: any) => Math.abs(h.x - hx) < 180);
      if (tooClose) continue;
      // A hazard must not be dropped on a fish: that would turn a pickup into
      // a guaranteed hit and quietly remove it from the reachable quota.
      if (game.fishes.some((f: any) => Math.abs(f.x - hx) < 65)) continue;

      // Never stack a hazard on top of an enemy patrol spot: it turns the level
      // into an unavoidable hit.
      const onEnemy = game.enemies.some((e: any) => Math.abs(e.x - hx) < 90 && Math.abs(e.y - (plat.y - 40)) < 70);
      if (onEnemy) continue;

      const hazardRoll = rng();
      if (difficultyProfile.variant % 2 === 0 && hazardRoll < 0.45) {
        game.hazards.push({
          type: 'movingSaw',
          x: hx,
          baseX: hx,
          y: plat.y - 24,
          width: 28,
          height: 28,
          range: 35 + rng() * 50,
          phase: rng() * Math.PI * 2,
          speed: 0.03 + rng() * 0.04,
        });
      } else if (hazardRoll < 0.78) {
        game.hazards.push({
          type: 'spike',
          x: hx,
          y: plat.y - 16,
          width: 46,
          height: 16,
        });
      } else if (level > 4) {
        game.hazards.push({
          type: 'laser',
          x: hx + 20,
          y: Math.max(120, plat.y - 160),
          width: 10,
          height: Math.min(220, canvas.height - plat.y + 95),
          active: rng() > 0.4,
          timer: 70 + Math.floor(rng() * 60),
          onDuration: 60 + Math.floor(rng() * 70),
          offDuration: 70 + Math.floor(rng() * 90),
        });
      }
    }

    // --- Power-ups -----------------------------------------------------
    // Placed on real platforms across the level, never bunched together, so
    // finding one is a genuine detour worth taking. Every run gets a shield,
    // and the mix widens as mechanics are introduced.
    const pickupPool: string[] = level < 3
      ? ['shield', 'magnet']
      : level < 6
        ? ['shield', 'magnet', 'rapid']
        : ['shield', 'magnet', 'rapid', 'rapid', 'heart'];
    const pickupCount = Math.min(7, 2 + Math.floor(level / 3));
    let pickupAttempts = 0;
    while (game.pickups.length < pickupCount && pickupAttempts < 240) {
      pickupAttempts++;
      const candidatePlatforms = game.platforms.filter((pl: any) => !pl.bossArena && pl.width > 74);
      if (!candidatePlatforms.length) break;
      const pool = candidatePlatforms[Math.floor(rng() * candidatePlatforms.length)];
      const pxx = pool.x + 30 + rng() * Math.max(10, pool.width - 60);
      if (pxx < 500 || pxx > levelLength - (level % 5 === 0 ? 1500 : 520)) continue;
      if (game.pickups.some((pk: any) => Math.abs(pk.x - pxx) < 260)) continue;
      if (game.hazards.some((h: any) => Math.abs(h.x - pxx) < 110)) continue;
      const type = pickupPool[Math.floor(seededRandom(level * 9.7 + pickupAttempts * 3.1) * pickupPool.length)];
      game.pickups.push({
        x: pxx,
        y: pool.y - 44,
        baseY: pool.y - 44,
        width: 32,
        height: 32,
        type,
        collected: false,
        hover: rng() * Math.PI * 2,
        spin: rng() * Math.PI * 2,
      });
    }
    // Boss arenas need a reliable ammo source: the fight is unwinnable if every
    // shot is spent before the boss goes down. These crates respawn over time.
    if (level % 5 === 0) {
      const arenaX = levelLength - 960;
      [0.32, 0.72].forEach((t) => {
        game.pickups.push({
          x: arenaX + t * 540,
          y: game.groundY - 40,
          baseY: game.groundY - 40,
          width: 32,
          height: 32,
          type: 'ammo',
          collected: false,
          hover: rng() * Math.PI * 2,
          spin: rng() * Math.PI * 2,
          arena: true,
        });
      });
    }

    // --- Hovering drone patrols -------------------------------------------
    // A slow, thoroughly telegraphed air threat: it bobs on the spot until the
    // cat gets close, then drifts in. Jump-bouncing on its cap kills it, just
    // like a ground enemy, which keeps the rulebook tiny.
    if (level >= 4 && levelMode !== 'Boss Battle') {
      const droneCount = Math.min(4, 1 + Math.floor(level / 4));
      let dronesPlaced = 0;
      let droneAttempts = 0;
      while (dronesPlaced < droneCount && droneAttempts < 70) {
        droneAttempts++;
        const bias = 1 - Math.pow(rng(), 1 + difficultyProfile.inLevelRamp);
        const dsx = 560 + bias * Math.max(300, levelLength - 1500);
        if (dsx < 500 || dsx > levelLength - 900) continue;
        if (game.enemies.some((en: any) => Math.abs(en.x - dsx) < 250)) continue;
        // Keep drones and shuttle platforms clear of each other's lane.
        if (game.platforms.some((pl: any) => pl.mover && pl.mover.axis === 'h' && dsx > pl.x - 220 && dsx < pl.x + pl.width + 220)) continue;
        const dsy = game.groundY - 150 - rng() * 110;
        const anchorIdx = game.platforms.findIndex((pl: any) => dsx >= pl.x && dsx <= pl.x + pl.width);
        game.enemies.push({
          x: dsx, y: dsy, width: 40, height: 30,
          velocityX: 0, type: 5,
          platform: anchorIdx < 0 ? 0 : anchorIdx,
          baseY: dsy,
          hover: rng() * Math.PI * 2,
          aggroTo: false,
          shootTimer: 0,
          chargeTimer: 0,
        });
        dronesPlaced++;
      }
    }

    // Shadow wraiths: immune to bullets, stomps and knockback. Only a Shadow
    // Shift pass dissolves them, which gives the ability a real target.
    if (level >= 6 && levelMode !== 'Boss Battle') {
      const wraithPlats = game.platforms.filter((pl: any) =>
        pl.isGround && pl.width > 180 && pl.x > 700 &&
        pl.x + pl.width < levelLength - 520 && !pl.bossArena);
      const wraithCount = Math.min(2, 1 + Math.floor((level - 6) / 12));
      for (let wi = 0; wi < wraithCount && wraithPlats.length; wi++) {
        const plat = wraithPlats[Math.floor(rng() * wraithPlats.length)];
        const wx = plat.x + plat.width * (0.3 + rng() * 0.4);
        if (game.enemies.some((en: any) => Math.abs(en.x - wx) < 200)) continue;
        game.enemies.push({
          x: wx, y: plat.y - 44, width: 42, height: 44,
          velocityX: 0, direction: 1, type: SHADOW_ENEMY_TYPE,
          isShadow: true, platform: game.platforms.indexOf(plat),
          baseY: plat.y - 44, hover: rng() * Math.PI * 2,
          shootTimer: 0, chargeTimer: 0,
        });
      }
    }

    // --- Neon bounce pads ---------------------------------------------------
    // Spring mattresses embedded in the ground. Stepping on one flings the cat
    // skyward with a fresh double jump, which ties the high optional ledges
    // back into the route. Level 1 stays untouched: it teaches only the basics.
    const springCount = level <= 1 ? 0 : Math.min(5, 1 + Math.floor(level / 3));
    let springAttempts = 0;
    while (game.springPads.length < springCount && springAttempts < 90) {
      springAttempts++;
      const springPlats = game.platforms.filter((pl: any) =>
        pl.isGround && !pl.bossWalkway && !pl.bossArena && pl.width >= 150 &&
        pl.x > 420 && pl.x + pl.width < levelLength - (level % 5 === 0 ? 1500 : 620),
      );
      if (!springPlats.length) break;
      const plat2 = springPlats[Math.floor(rng() * springPlats.length)];
      const sxx = plat2.x + 24 + rng() * Math.max(20, plat2.width - 92);
      if (game.springPads.some((s: any) => Math.abs(s.x - sxx) < 480)) continue;
      if (game.hazards.some((h: any) => Math.abs(h.x - sxx) < 160)) continue;
      if (game.enemies.some((en: any) => Math.abs(en.x - sxx) < 170)) continue;
      if (game.pickups.some((pk: any) => Math.abs(pk.x - sxx) < 160)) continue;
      // A pad needs empty sky above it: never inside a platform body.
      if (game.platforms.some((pl: any) => !pl.isGround && pl.y < plat2.y && pl.y + pl.height > plat2.y && sxx > pl.x - 40 && sxx < pl.x + pl.width + 40)) continue;
      game.springPads.push({ x: sxx, y: plat2.y - 12, width: 46, height: 12, press: 0 });
    }

    // Garantera att nivå 1 är väldigt lätt
    if (level === 1) {
      game.holes = [];
      game.hazards = [];
      // Begränsa antalet fiender till max 2
      if (game.enemies.length > 2) {
        game.enemies = game.enemies.slice(0, 2);
      }
    }

    return game;
  };

  // Jump requests are buffered and only consumed in the loop, so an early press
  // still fires the moment the cat touches ground. Coyote time covers the
  // opposite case: walking off a ledge right before pressing still jumps.
  const requestJump = () => {
    if (!gameRef.current) return;
    gameRef.current.player.jumpBuffer = 8;
    gameRef.current.player.jumpHeld = true;
  };

  const releaseJump = () => {
    if (!gameRef.current) return;
    gameRef.current.player.jumpHeld = false;
  };

  const tryPerformJump = (game: any) => {
    const p = game.player;
    if (!p.isJumping) {
      p.velocityY = -p.jumpPower;
      p.isJumping = true;
      p.coyoteTimer = 0;
      p.stretch = 1.32;
      game.squashKick = 0;
      haptic('jump', progress.settings.haptics);
      AudioEngine.playJump();
    } else if (p.canDoubleJump && !p.hasDoubleJumped) {
      p.velocityY = -p.doubleJumpPower;
      p.hasDoubleJumped = true;
      p.stretch = 1.4;
      for (let i = 0; i < 10; i++) {
        game.particles.push({
          x: p.x + p.width / 2 + (Math.random() - 0.5) * 24,
          y: p.y + p.height,
          vx: (Math.random() - 0.5) * 3,
          vy: Math.random() * 1.5,
          life: 22, color: p.accent, size: Math.random() * 3 + 1.5
        });
      }
      haptic('doubleJump', progress.settings.haptics);
      AudioEngine.playJump();
    }
  };

  const triggerJump = () => {
    requestJump();
  };

  /**
   * A jump executed while touching a solid pillar: launch diagonally away from
   * the wall, restore the double jump and lock the task to avoid stick cycling.
   */
  const doWallJump = (game: any) => {
    const p = game.player;
    if (!p.wallDir) return false;
    p.velocityY = -p.jumpPower * 0.98;
    p.velocityX = -p.wallDir * p.speed * 1.4;
    p.facing = -p.wallDir;
    p.isJumping = true;
    p.hasDoubleJumped = false;
    p.wallLock = 10;
    p.stretch = 1.38;
    game.zoomPunch = Math.max(game.zoomPunch, 5);
    for (let i = 0; i < 9; i++) {
      game.particles.push({
        x: p.wallDir === 1 ? p.x + p.width : p.x,
        y: p.y + p.height * (0.2 + Math.random() * 0.7),
        vx: -p.wallDir * (1.2 + Math.random() * 2.4),
        vy: (Math.random() - 0.4) * 2,
        life: 20, color: 'rgba(190, 225, 255, 0.9)', size: Math.random() * 3 + 1.2,
      });
    }
    haptic('wallJump', progress.settings.haptics);
    AudioEngine.playWallJump();
    return true;
  };

  // Touch players hold the fire button during a boss fight; a single shot per
  // tap made the phone controls tiring and much weaker than mouse aiming.
  const touchShootTimer = useRef<number | null>(null);
  const startTouchShoot = () => {
    if (touchShootTimer.current !== null) return;
    fireBullet();
    touchShootTimer.current = window.setInterval(() => fireBullet(), 130);
  };
  const stopTouchShoot = () => {
    if (touchShootTimer.current === null) return;
    window.clearInterval(touchShootTimer.current);
    touchShootTimer.current = null;
  };

  const triggerDash = () => {
    const game = gameRef.current;
    if (!game || !game.running) return;
    const p = game.player;
    if (p.dashCooldown > 0 || p.dashing > 0) return;
    p.dashing = 12;
    p.dashCooldown = 45;
    p.dashDir = p.facing;
    p.velocityX = p.dashDir * p.speed * 3.4;
    p.velocityY = Math.min(p.velocityY, -1.5);
    p.squash = 1.3;
    p.stretch = 0.8;
    game.screenShake = Math.max(game.screenShake, 5);
    game.zoomPunch = 8;
    for (let i = 0; i < 14; i++) {
      game.particles.push({
        x: p.x + p.width / 2 - p.dashDir * 10,
        y: p.y + p.height / 2 + (Math.random() - 0.5) * 30,
        vx: -p.dashDir * (2 + Math.random() * 4),
        vy: (Math.random() - 0.5) * 2,
        life: 26, color: '#2bee79', size: Math.random() * 4 + 2
      });
    }
    haptic('dash', progress.settings.haptics);
    AudioEngine.playDash();
  };

  const registerCombo = (game: any, baseScore: number, x: number, y: number) => {
    game.combo = (game.combo || 0) + 1;
    game.comboTimer = 150;
    game.bestComboInRun = Math.max(game.bestComboInRun || 0, game.combo);

    // Streak feeds the visible multiplier, so fast play is worth much more.
    game.streak = (game.streak || 0) + 1;
    game.bestStreak = Math.max(game.bestStreak || 0, game.streak);
    game.multiplier = Math.min(8, 1 + Math.floor(game.streak / 4));
    game.multiplierTimer = 240;
    AudioEngine.setComboTier(Math.floor(game.combo / 3));

    const multiplierBonus = Math.round(baseScore * (game.multiplier - 1) * 0.5);
    const comboBonus = Math.min(100, Math.max(0, (game.combo - 1) * 6));
    if (comboBonus > 0) {
      game.floatingTexts.push({ x, y: y - 18, text: tr('COMBO x{n} +{b}', { n: game.combo, b: comboBonus }), life: 35, color: '#7ef7c2' });
    }
    if (multiplierBonus > 0) {
      game.floatingTexts.push({ x, y: y - 44, text: tr('x{n} MULTIPLIER +{b}', { n: game.multiplier, b: multiplierBonus }), life: 45, color: '#ffd166' });
    }
    if (game.multiplier > 1 && game.multiplier !== (game.lastMilestoneMultiplier || 1)) {
      game.lastMilestoneMultiplier = game.multiplier;
      AudioEngine.playCombo(game.multiplier);
      pushToast(game, tr('MULTIPLIKATOR x{n}', { n: game.multiplier }), '#ffd166');
    }
    // Every fifth step of the combo fires a visible ring at the pickup point,
    // so the rhythm of a clean run is something the player can feel.
    if (game.combo % 5 === 0) {
      game.screenShake = Math.max(game.screenShake, 2.5);
      game.zoomPunch = Math.max(game.zoomPunch, 3);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        game.particles.push({
          x, y,
          vx: Math.cos(a) * 3.4,
          vy: Math.sin(a) * 3.4,
          life: 18, color: i % 2 ? '#ffd166' : '#7ef7c2', size: 2.2 + Math.random() * 2,
        });
      }
    }
    // Gold Rush doubles every point source for its duration.
    const rush = game.buffs?.goldRush > 0 || game.surprise?.id === 'goldRush' ? 2 : 1;
    const gained = Math.round((baseScore + comboBonus + multiplierBonus) * (game.perkEffects?.scoreMult || 1) * rush);
    game.score += gained;
    // Shadow Shift is the payoff for a clean, fast streak: every action is
    // worth 75 % more while the cat is dissolved.
    if (game.shadowActive > 0) {
      const shadowBonus = Math.round(gained * 0.75);
      game.score += shadowBonus;
      game.floatingTexts.push({
        x, y: y - 64, text: tr('SKUGGBONUS +{n}', { n: shadowBonus }),
        life: 45, color: '#c084fc',
      });
    }
  };

  /** Awards XP and rolls a level-up, which is the core of the reward loop. */
  const grantXp = (game: any, amount: number) => {
    game.xp = (game.xp || 0) + amount;
    game.xpIntoLevel = (game.xpIntoLevel || 0) + amount;
    while (game.xpIntoLevel >= game.xpNeeded) {
      game.xpIntoLevel -= game.xpNeeded;
      game.runLevel = (game.runLevel || 1) + 1;
      game.xpNeeded = Math.round(game.xpNeeded * 1.35);
      game.ammo += 2;
      game.score += 500;
      pushToast(game, tr('NIVÅ {n}! +2 SKOTT', { n: game.runLevel }), '#2bee79');
      game.slowMo = 18;
    }
  };

  /** Queue a short celebratory banner drawn on the canvas. */
  const pushToast = (game: any, text: string, color: string) => {
    game.toasts.push({ text, color, life: 90, maxLife: 90 });
    if (game.toasts.length > 3) game.toasts.shift();
  };

  /** Coin payout helper that keeps the counter in sync with the HUD. */
  const awardCoins = (game: any, amount: number) => {
    game.coinsThisLevel = (game.coinsThisLevel || 0) + amount;
    addCoins(amount);
  };

  /* ---------------------------- SHADOW SHIFT ------------------------------
     One meter, one button, four seconds of a completely different game. It is
     deliberately earned by the things a good player already does (collect,
     defeat, skim past danger) instead of by waiting or paying. */
  const SHADOW_DURATION = 240; // frames at 60 Hz = 4 seconds

  const gainShadowCharge = (game: any, amount: number) => {
    // No charging while transformed: otherwise a dense crowd would chain
    // shifts forever and the ability would never have a downtime.
    if (!game || game.shadowActive > 0) return;
    const before = game.shadowCharge || 0;
    const scaled = Math.round(amount * (game.perkEffects?.shadowChargeMult || 1));
    game.shadowCharge = Math.min(100, before + scaled);
    if (before < 100 && game.shadowCharge >= 100) {
      pushToast(game, tr('SKUGGSKIFTE REDO · E'), '#c084fc');
      AudioEngine.playPowerup();
    }
  };

  const triggerShadowShift = () => {
    const game = gameRef.current;
    if (!game || !game.running || isPausedRef.current) return;
    if ((game.shadowCharge || 0) < 100 || game.shadowActive > 0) return;
    const p = game.player;
    game.shadowCharge = 0;
    game.shadowActive = SHADOW_DURATION;
    game.shadowShiftId = (game.shadowShiftId || 0) + 1;
    game.shadowShifts = (game.shadowShifts || 0) + 1;
    runTotalsRef.current.shadowShifts += 1;
    p.baseSpeed = p.baseSpeed || p.speed;
    p.speed = p.baseSpeed * 1.3;
    // Every damage source in the game already respects `invincible`, so the
    // transformation needs no special case in the collision rules.
    p.invincible = true;
    p.invincibleTimer = SHADOW_DURATION;
    game.slowMo = 12;
    game.zoomPunch = Math.max(game.zoomPunch || 0, 10);
    game.screenShake = Math.max(game.screenShake || 0, 7);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      game.particles.push({
        x: p.x + p.width / 2 + Math.cos(a) * 18,
        y: p.y + p.height / 2 + Math.sin(a) * 26,
        vx: Math.cos(a) * 4, vy: Math.sin(a) * 4 - 1,
        life: 34, color: i % 2 ? '#c084fc' : '#6d28d9', size: Math.random() * 3 + 2,
      });
    }
    pushToast(game, tr('SKUGGSKIFTE! · {n}s', { n: 4 }), '#c084fc');
    AudioEngine.playDash();
    AudioEngine.playPowerup();
    haptic('shadowShift', progress.settings.haptics);
  };

  /** Passing through an enemy while shifted dissolves it instead of hurting
      the cat. Uses the same reward path as a stomp, with its own colour. */
  const shadowPassKill = (game: any, e: any) => {
    const killX = e.x + e.width / 2;
    const killY = e.y + e.height / 2;
    e.x = -1000;
    e.shadowKilled = true;
    game.shadowPasses = (game.shadowPasses || 0) + 1;
    runTotalsRef.current.shadowPasses += 1;
    registerCombo(game, 300, killX, killY);
    grantXp(game, 30);
    awardCoins(game, 3);
    game.enemiesDefeatedInRun = (game.enemiesDefeatedInRun || 0) + 1;
    game.killsThisLevel = (game.killsThisLevel || 0) + 1;
    for (let i = 0; i < 18; i++) {
      game.particles.push({
        x: killX, y: killY,
        vx: (Math.random() - 0.5) * 11, vy: (Math.random() - 0.5) * 11,
        life: 32, color: i % 2 ? '#c084fc' : '#ffffff', size: Math.random() * 4 + 2,
      });
    }
    game.floatingTexts.push({ x: killX, y: killY - 12, text: tr('SKUGGPASS +300'), life: 45, color: '#c084fc' });
    game.hitStop = Math.max(game.hitStop || 0, 2);
    if (e.isShadow) {
      gainShadowCharge(game, 35);
      pushToast(game, tr('SKUGGVÅLNAD UPPLÖST · E'), '#c084fc');
      game.score += 150;
    }
    AudioEngine.playShadowPass();
    AudioEngine.playExplosion();
  };

  const persistRunSummary = (game: any, perfectLevel: boolean) => {
    try {
      localStorage.setItem('shadow_paw_last_run', JSON.stringify({
        enemiesDefeated: game.enemiesDefeatedInRun || 0,
        levelsCompleted: game.levelsCompletedInRun || 0,
        bestCombo: game.bestComboInRun || 0,
        bossDefeated: game.bossDefeatedInRun || false,
        perfectLevel,
        bestStreak: game.bestStreak || 0,
        nearMisses: Math.max(game.nearMisses || 0, runTotalsRef.current.nearMisses),
        shadowPasses: runTotalsRef.current.shadowPasses,
        shadowShifts: runTotalsRef.current.shadowShifts,
        noHit: !!game.noHit,
        runLevel: game.runLevel || 1,
        coins: game.coinsThisLevel || 0,
        deaths: game.deathsInRun || 0,
        score: game.score || 0,
        runMode: game.runMode || 'campaign',
        dailySeed: game.dailySeed || '',
        level: game.level || 1,
      }));
      // A new personal best on this exact seed becomes tomorrow's ghost.
      if (game.ghostKey && game.ghostFrames?.length) {
        saveGhost(game.ghostKey, game.score || 0, game.ghostFrames);
      }
    } catch {
      // Private browsing can reject writes; losing the summary must not stop
      // the level-complete or game-over screen from appearing.
    }
  };

  const trackDeathCause = (cause: 'enemy' | 'hazard' | 'hole' | 'timer' | 'boss') => {
    try {
      const key = 'shadow_paw_telemetry';
      const prev = JSON.parse(localStorage.getItem(key) || '{}');
      const next = {
        ...prev,
        totalRuns: (prev.totalRuns || 0) + 1,
        deathsByCause: {
          enemy: (prev.deathsByCause?.enemy || 0) + (cause === 'enemy' ? 1 : 0),
          hazard: (prev.deathsByCause?.hazard || 0) + (cause === 'hazard' ? 1 : 0),
          hole: (prev.deathsByCause?.hole || 0) + (cause === 'hole' ? 1 : 0),
          timer: (prev.deathsByCause?.timer || 0) + (cause === 'timer' ? 1 : 0),
          boss: (prev.deathsByCause?.boss || 0) + (cause === 'boss' ? 1 : 0),
        },
      };
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore telemetry failures
    }
  };

  /** Single exit path for a lost run, so every death cause is recorded and the
      same summary reaches the game-over screen. */
  const endRun = (game: any, cause: 'enemy' | 'hazard' | 'hole' | 'timer' | 'boss') => {
    if (!game.running) return;
    game.running = false;
    trackDeathCause(cause);
    persistRunSummary(game, false);
    onEndRef.current(game.score, game.totalCollectedInLevel);
  };

  /**
   * The only place the player can lose a life. Centralising it means the shield
   * power-up protects against every hazard in the game, knockback is consistent,
   * and a new damage source cannot forget to handle death.
   */
  const hurtPlayer = (game: any, cause: 'enemy' | 'hazard' | 'boss', opts?: { knock?: number; lift?: number }) => {
    const p = game.player;
    if (!p || p.invincible) return 'ignored';
    const lift = opts?.lift ?? 5;

    if (game.shield) {
      game.shield = false;
      p.invincible = true;
      p.invincibleTimer = 100;
      p.velocityY = Math.min(p.velocityY, -lift);
      p.velocityX = -p.facing * 4.5;
      game.screenShake = Math.max(game.screenShake, 10);
      game.zoomPunch = 8;
      game.slowMo = 8;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        game.particles.push({
          x: p.x + p.width / 2 + Math.cos(a) * 26,
          y: p.y + p.height / 2 + Math.sin(a) * 34,
          vx: Math.cos(a) * 4.5,
          vy: Math.sin(a) * 4.5 - 1,
          life: 30, color: i % 2 ? '#7ee7ff' : '#ffffff', size: Math.random() * 3 + 2,
        });
      }
      pushToast(game, tr('SKÖLDEN TOG SMÄLLEN!'), '#7ee7ff');
      haptic('shieldBreak', progress.settings.haptics);
      AudioEngine.playShieldBreak();
      return 'shielded';
    }

    game.lives--;
    // Counted here so every damage source (enemy, hazard, boss) reaches the
    // results screen; only fall-in-pit and the Speed Run clock used to.
    game.deathsInRun = (game.deathsInRun || 0) + 1;
    p.invincible = true;
    // Long enough to actually escape contact: the old 1.6s window could expire
    // while the cat was still pressed against the same enemy or wall.
    p.invincibleTimer = Math.max(50, 120 + (game.perkEffects?.invincibleBonus || 0));
    p.velocityY = Math.min(p.velocityY, -lift - 1.5);
    p.velocityX = -p.facing * 7;
    game.combo = 0;
    game.streak = 0;
    game.multiplier = 1;
    AudioEngine.setComboTier(0);
    game.noHit = false;
    game.slowMo = 10;
    game.zoomPunch = 14;
    game.screenShake = Math.max(game.screenShake, 14);
    for (let i = 0; i < 20; i++) {
      game.particles.push({
        x: p.x + p.width / 2, y: p.y + p.height / 2,
        vx: (Math.random() - 0.5) * 9, vy: (Math.random() - 0.5) * 9,
        life: 26, color: i % 3 ? '#ff5470' : '#ffd166', size: Math.random() * 4 + 2,
      });
    }
    haptic('damage', progress.settings.haptics);
    AudioEngine.playDamage();
    AudioEngine.playLifeLost();
    if (game.lives <= 0) endRun(game, cause);
    return game.lives <= 0 ? 'dead' : 'hurt';
  };

  /** Applies a collected power-up and returns the message shown to the player. */
  const applyPickup = (game: any, pickup: any) => {
    const p = game.player;
    let label = '';
    let color = '#7ee7ff';
    switch (pickup.type) {
      case 'shield':
        game.shield = true;
        label = tr('SKÖLD AKTIVERAD');
        color = '#7ee7ff';
        break;
      case 'magnet':
        game.buffs.magnet = 620;
        label = tr('FISKMAGNET · 10s');
        color = '#ffd166';
        break;
      case 'rapid':
        game.buffs.rapid = 540;
        label = tr('RAPID ELD · 9s');
        color = '#ff8f6b';
        break;
      case 'heart':
        game.lives = Math.min(6, game.lives + 1);
        label = tr('+1 LIV');
        color = '#ff5f8a';
        break;
      case 'ammo':
        game.ammo += 6;
        game.score += 50;
        label = tr('+6 SKOTT');
        color = '#9fb6ff';
        // Arena ammo crates are a renewable resource, so a boss fight can never
        // soft-lock with an empty gun.
        if (pickup.arena) pickup.respawn = 780;
        break;
      default:
        game.score += 100;
        label = '+100';
    }
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      game.particles.push({
        x: pickup.x + 16, y: pickup.y + 16,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 1,
        life: 26 + Math.random() * 16, color: i % 3 === 0 ? '#ffffff' : color,
        size: Math.random() * 3.5 + 1.5,
      });
    }
    game.floatingTexts.push({ x: pickup.x + 16, y: pickup.y, text: label, life: 60, color });
    pushToast(game, label, color);
    game.zoomPunch = 6;
    if (pickup.type === 'heart') AudioEngine.playHeart();
    else if (pickup.type === 'ammo') AudioEngine.playCoin(2);
    else AudioEngine.playPowerup();
  };

  /** Letter grade for a cleared level, shown on the results card. */
  const getGrade = (summary: { noHit?: boolean; nearMisses?: number; streak?: number; boss?: boolean }) => {
    let points = 0;
    if (summary.noHit) points += 2;
    if ((summary.nearMisses || 0) >= 5) points += 1;
    if ((summary.streak || 0) >= 15) points += 1;
    if (summary.boss) points += 1;
    return points >= 4 ? 'S' : points === 3 ? 'A' : points === 2 ? 'B' : 'C';
  };

  /** Clearing a stage restores a life. A 40-level campaign on a single pool of
      five lives meant one bad level 3 quietly doomed the whole run, so the
      "Continue" button was really a restart. Flawless and boss clears restore
      one extra, which makes mastery matter without removing the challenge. */
  const levelLifeBonus = (game: any) => (game?.noHit || game?.bossDefeatedInRun ? 2 : 1);

  const startNextLevel = () => {
    const finished = gameRef.current;
    setLives(Math.min(6, (finished?.lives ?? lives) + levelLifeBonus(finished)));
    setShowLevelComplete(false);
    setLevelSummary(null);
    setPerkOffer([]);
    setPerkChoice(null);
    setCurrentLevel(prev => prev + 1);
  };

  const setKeyState = (code: number, active: boolean) => {
    if (!gameRef.current) return;
    const game = gameRef.current;
    game.keys[code] = active;

    // Paus med Escape (27) eller P (80)
    if (active && [27, 80].includes(code)) {
      togglePause();
      return;
    }

    if ([32, 38, 87].includes(code)) {
      if (active) requestJump();
      else releaseJump();
    }
    if (active && [16, 75, 88].includes(code)) {
      triggerDash();
    }
    // E / Q: spend a full Shadow Shift meter.
    if (active && [69, 81].includes(code)) {
      triggerShadowShift();
    }
    // Skjut med tangentbord: F (70), J (74), Z (90), Ctrl (17)
    if (active && [70, 74, 90, 17].includes(code)) {
      fireBullet();
    }
  };

  const fireBullet = (targetX: number | null = null, targetY: number | null = null) => {
    if (!gameRef.current || !gameRef.current.running || isPausedRef.current) return;
    const game = gameRef.current;
    const rapid = game.buffs.rapid > 0;
    if (game.shootCooldown > 0) return;
    if (!rapid && game.ammo <= 0) {
      // A dry click instead of silence: the player understands the gun is empty
      // without having to read the ammo counter. The cooldown keeps a held
      // trigger from repeating the click every frame.
      game.shootCooldown = 18;
      AudioEngine.playUiClick();
      haptic('shoot', progress.settings.haptics);
      return;
    }
    const playerCenterX = game.player.x + game.player.width / 2;
    const playerCenterY = game.player.y + game.player.height / 2;
    const facing: 1 | -1 = game.player.facing === -1 ? -1 : 1;
    // Fire from the blaster the cat holds at its chest, not from the middle of
    // its body, so the bullet leaves where the muzzle flash is drawn. The
    // vector cat is drawn with its paws on the floor line, so the muzzle sits
    // a fixed offset from the paws at the current hero scale.
    const feetY = game.player.y + game.player.height;
    const facingSign: 1 | -1 = facing;
    const originX = playerCenterX + facingSign * 30;
    const originY = feetY - 34;

    let dx, dy;
    if (targetX !== null && targetY !== null) {
      dx = targetX - (originX - game.scrollX);
      dy = targetY - originY;
    } else {
      // Shoot framåt i den riktning katten tittar om ingen koordinat ges
      dx = facing * 500;
      dy = 0;
    }

    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 0.001) return;
    const bulletSpeed = rapid ? 12.5 : 10;
    // Rapid Fire turns the single shot into a three-way spread and removes the
    // ammo cost for its duration, so the power-up changes how the gun feels.
    const spread = rapid ? [-0.18, 0, 0.18] : [0];
    spread.forEach((offset) => {
      const angle = Math.atan2(dy, dx) + offset;
      game.bullets.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * bulletSpeed,
        vy: Math.sin(angle) * bulletSpeed,
        radius: rapid ? 7 : 6,
        life: 110,
        tint: rapid ? '#7ee7ff' : '#ff4d4d',
      });
    });
    game.shootCooldown = rapid ? 6 : 10;
    if (!rapid) game.ammo--;
    haptic('shoot', progress.settings.haptics);
    AudioEngine.playShoot();
  };

  // Never leave a firing interval running after the level unmounts.
  useEffect(() => () => {
    if (touchShootTimer.current !== null) window.clearInterval(touchShootTimer.current);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fixed internal resolution 1280x720
    canvas.width = 1280;
    canvas.height = 720;

    // CSS handles all scaling - object-fit keeps aspect ratio with letterboxing
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.maxWidth = '100vw';
    canvas.style.maxHeight = '100vh';
    canvas.style.objectFit = 'contain';

    const game = setupLevel(currentLevel, totalScore, lives);
    if (!game) return;
    game.ghost = loadGhost(game.ghostKey);
    gameRef.current = game;
    // Debug handles the automated play-test uses to inspect live state and jump
    // between stages. They expose nothing the player can abuse in a local game.
    (window as any).__SP = game;
    (window as any).__SP_NEXT = startNextLevel;

    // Convert a pointer position in the CSS-scaled canvas into the stage
    // coordinate system the game draws in. The base camera zoom sits between
    // those two spaces, so aiming at a drone must invert it or every shot
    // lands high and to the left.
    const screenToStage = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const sx = (clientX - rect.left) * (canvas.width / rect.width);
      const sy = (clientY - rect.top) * (canvas.height / rect.height);
      const g = gameRef.current || game;
      const focusX = g.player.x - g.scrollX + g.player.width / 2;
      const focusY = g.player.y + g.player.height / 2;
      return {
        x: (sx - focusX) / STAGE_ZOOM + focusX,
        y: (sy - focusY) / STAGE_ZOOM + focusY,
      };
    };

    // Keys the game owns: prevent the browser from scrolling the page or
    // moving focus while the player is running and jumping.
    const GAME_KEYS = new Set([16, 17, 27, 32, 37, 38, 39, 65, 68, 69, 70, 74, 75, 80, 81, 87, 88, 90]);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (GAME_KEYS.has(e.keyCode)) e.preventDefault();
      if (showIntroRef.current && e.keyCode !== 27 && e.keyCode !== 80) skipIntro();
      // Holding Esc/P fires a stream of keydown events; without this guard the
      // pause menu flickered on and off for as long as the key was held.
      if (e.repeat && (e.keyCode === 27 || e.keyCode === 80)) return;
      // A double tap on → or D fires the same dash as Shift, so sprinting ahead
      // never needs a second hand on the keyboard. Both taps must use the same
      // key, otherwise rolling from → to D would dash by accident. Facing is
      // forced forward because the movement step has not run yet this frame.
      if ((e.keyCode === 39 || e.keyCode === 68) && !e.repeat) {
        const now = performance.now();
        const lastTap = game.lastForwardTap || { code: 0, at: 0 };
        if (lastTap.code === e.keyCode && now - lastTap.at < 280) {
          if (game.player) game.player.facing = 1;
          triggerDash();
          game.lastForwardTap = { code: 0, at: 0 };
        } else {
          game.lastForwardTap = { code: e.keyCode, at: now };
        }
      }
      setKeyState(e.keyCode, true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (GAME_KEYS.has(e.keyCode)) e.preventDefault();
      setKeyState(e.keyCode, false);
    };
    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      skipIntro();
      const p = screenToStage(e.clientX, e.clientY);
      fireBullet(p.x, p.y);
    };

    // Touch controls for mobile
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      skipIntro();
      const touch = e.touches[0];
      const p = screenToStage(touch.clientX, touch.clientY);

      // Jump on left half of screen
      if (p.x < canvas.width / 2) {
        triggerJump();
      } else {
        // Shoot on right half of screen
        fireBullet(p.x, p.y);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const p = screenToStage(touch.clientX, touch.clientY);
      const touchX = p.x;

      // Move left/right based on touch position
      if (touchX < canvas.width * 0.3) {
        setKeyState(65, true); // A
        setKeyState(68, false); // D
      } else if (touchX > canvas.width * 0.7) {
        setKeyState(68, true); // D
        setKeyState(65, false); // A
      } else {
        setKeyState(65, false);
        setKeyState(68, false);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      setKeyState(65, false);
      setKeyState(68, false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousedown', handleMouseDown);

    // Add touch events for mobile
    if (isTouchDevice) {
      canvas.addEventListener('touchstart', handleTouchStart);
      canvas.addEventListener('touchmove', handleTouchMove);
      canvas.addEventListener('touchend', handleTouchEnd);
    }

    let animationId: number;
    let previousFrameTime = performance.now();
    let accumulatedTime = 0;
    // The simulation - gravity, speeds, enemy cooldowns and the level clock -
    // is tuned for exactly 60 steps per second. Driving it directly from
    // requestAnimationFrame instead ran it at the monitor's refresh rate: on a
    // 144 Hz screen everything moved about 2.4x too fast and the Speed Run
    // countdown burned 2.4 seconds per real second, so the clock expired before
    // the level could be finished. Accumulating elapsed time and running whole
    // 60 Hz steps keeps the game identical on 60, 120 and 144 Hz displays.
    const FIXED_STEP_MS = 1000 / 60;
    const simulate = () => {
      if (!game.running) return;
      if (isPausedRef.current) return;
      if (game.hitStop > 0) {
        game.hitStop--;
        return;
      }

      // Shadow Shift is a timed form. When it lapses, restore the real run
      // speed and drop the invulnerability in one place, even if a hit or a
      // shield changed the invincibility timer meanwhile.
      if (game.shadowActive > 0) {
        game.shadowActive--;
        if (game.shadowActive === 0) {
          game.player.speed = game.player.baseSpeed || game.player.speed;
          game.player.invincible = false;
          game.player.invincibleTimer = 0;
          pushToast(game, tr('SKUGAN SVINNER'), '#8b9bb4');
        } else if (game.shadowActive % 3 === 0) {
          game.player.trail.push({
            x: game.player.x + game.player.width / 2,
            y: game.player.y + game.player.height / 2,
            life: 16, maxLife: 16, shadow: true,
          });
        }
      }

      // The intro card's spawn-protection clock runs in simulation frames,
      // not wall-clock time, so it cannot expire while a tab is throttled.
      if (game.introTimer > 0) game.introTimer--;
      game.frame = (game.frame || 0) + 1;
      if (game.frame % 10 === 0) {
        const pCx = game.player.x + game.player.width / 2;
        let nearest: number | null = null;
        for (const e of game.enemies) {
          if (e.x < -500) continue;
          const d = Math.abs(e.x + e.width / 2 - pCx);
          if (d < 640 && (nearest === null || d < Math.abs(nearest))) nearest = e.x + e.width / 2 - pCx;
        }
        AudioEngine.setSfxPan(nearest === null ? 0 : Math.max(-0.75, Math.min(0.75, nearest / 480)));
      }
      // Ghost replay: one sample every four frames keeps localStorage small
      // (a 60-second level is ~900 samples) while looking smooth enough.
      if (game.frame % 4 === 0) {
        game.ghostFrames.push([
          Math.round(game.player.x), Math.round(game.player.y), game.player.facing === -1 ? -1 : 1,
        ]);
      }
      // Level clock (used for the results card, independent of the Speed Run
      // countdown).
      game.levelSeconds = (game.levelSeconds || 0) + 1 / 60;
      // Accessibility: motion-sensitive players can turn off shake and punch-in.
      if (isReducedMotion(progress.settings.reduceMotion)) {
        game.screenShake = 0;
        game.zoomPunch = 0;
      }

      // Player Logic
      const p = game.player;
      // Moving platforms step first, so a rider is carried along before physics
      // recomputes its velocity. The lift re-derives its rectangle from the
      // sine phase, which is why `baseX`/`baseY` store the resting centre.
      game.platforms.forEach((plat: any) => {
        if (!plat.mover) return;
        const mv = plat.mover;
        mv.phase += mv.speed;
        const nextX = mv.axis === 'h' ? plat.baseX + Math.sin(mv.phase) * mv.amp : plat.baseX;
        const nextY = mv.axis === 'v' ? plat.baseY + Math.sin(mv.phase) * mv.amp : plat.baseY;
        plat.moverDx = nextX - plat.x;
        plat.moverDy = nextY - plat.y;
        plat.x = nextX;
        plat.y = nextY;
      });
      if (p.ridingRef && p.ridingRef.mover) {
        p.x += p.ridingRef.moverDx || 0;
        p.y += p.ridingRef.moverDy || 0;
      }
      // Level twist + active surprise both feed the physics. The twist is a
      // constant multiplier for the whole stage; the surprise only spikes for
      // its duration.
      const tp = game.twistPhysics || { gravityMult: 1, frictionMult: 1, windAccel: 0, grip: 1 };
      const surpriseGravity = game.surprise && game.surprise.id === 'gust' ? 0.82 : 1;
      const gravityMod = tp.gravityMult * surpriseGravity;
      p.velocityY += game.gravity * gravityMod;
      if (p.velocityY > 18) p.velocityY = 18;

      // Variable jump height: releasing early cuts the rise short.
      if (!p.jumpHeld && p.velocityY < -4) {
        p.velocityY += game.gravity * 0.9;
      }

      // Dash overrides normal movement while active.
      if (p.dashing > 0) {
        p.dashing--;
        p.velocityX = p.dashDir * p.speed * 3.2;
        p.trail.push({ x: p.x + p.width / 2, y: p.y + p.height / 2, life: 14, maxLife: 14 });
      } else {
        const left = game.keys[37] || game.keys[65];
        const right = game.keys[39] || game.keys[68];
        // Acceleration + friction instead of instant velocity for weightier control.
        const accel = p.onGround ? 1.15 * (tp.grip ?? 1) : 0.7;
        // Slippery ice multiplies friction *up* (closer to 1 = less braking),
        // sticky boots pushes it *down* so the cat plants and turns.
        const friction = p.onGround
          ? (tp.frictionMult < 1 ? 1 - (1 - game.friction) * tp.frictionMult : game.friction)
          : 0.965;
        p.velocityX *= friction;
        if (left) {
          p.velocityX -= accel;
          p.facing = -1;
        }
        if (right) {
          p.velocityX += accel;
          p.facing = 1;
        }
        p.velocityX = Math.max(-p.speed, Math.min(p.speed, p.velocityX));
        // Nudge toward max speed while holding a direction, so holding is fast.
        if (left) p.velocityX = Math.max(p.velocityX, -p.speed);
        if (right) p.velocityX = Math.min(p.velocityX, p.speed);
      }

      if (p.dashCooldown > 0) p.dashCooldown--;
      p.trail = p.trail.filter((t: any) => --t.life > 0);

      // Constant wind from the twist, plus a gusting surge during the event.
      if (tp.windAccel) {
        p.velocityX += tp.windAccel * (1 + 0.35 * Math.sin(Date.now() / 340));
      }
      if (game.surprise?.id === 'gust') {
        p.velocityX += 0.075 + Math.sin(Date.now() / 180) * 0.16;
      }

      // Clamp to level bounds so the cat can't run out of the world.
      p.x = Math.max(0, Math.min(p.x, game.levelLength - p.width));

      // Buffered jump + coyote time
      if (p.jumpBuffer > 0) p.jumpBuffer--;
      if (p.coyoteTimer > 0) p.coyoteTimer--;
      if (p.jumpBuffer > 0 && (p.onGround || p.coyoteTimer > 0)) {
        tryPerformJump(game);
        p.jumpBuffer = 0;
      } else if (p.jumpBuffer > 0 && p.wallDir && p.wallLock <= 0) {
        // Touching a wall beats the air jump: the kick off is stronger and it
        // refreshes the double jump, so chimney-climbs stay possible.
        if (doWallJump(game)) p.jumpBuffer = 0;
      } else if (p.jumpBuffer > 0 && p.isJumping && p.canDoubleJump && !p.hasDoubleJumped && p.velocityY > -2) {
        tryPerformJump(game);
        p.jumpBuffer = 0;
      }

      p.x += p.velocityX;
      p.y += p.velocityY;

      // Solid pillars act as true walls: the cat is pushed back out to the side
      // it came from. That also gives wall contact, which the slide + wall kick
      // use below. Top landing is untouched - classic one-way platform rules.
      p.wallDir = 0;
      if (p.wallLock > 0) p.wallLock--;
      for (const wallPlat of game.platforms) {
        if (!wallPlat.solid) continue;
        const verticalBody = p.y + p.height > wallPlat.y + 10 && p.y < wallPlat.y + wallPlat.height - 6;
        if (!verticalBody) continue;
        const wl = wallPlat.x;
        const wr = wallPlat.x + wallPlat.width;
        if (p.x + p.width > wl && p.x < wr) {
          const prevRight = p.x + p.width - p.velocityX;
          const prevLeft = p.x - p.velocityX;
          if (prevRight <= wl + 2) {
            p.x = wl - p.width - 0.6;
            if (p.velocityX > 0) p.velocityX = 0;
            p.wallDir = 1;
          } else if (prevLeft >= wr - 2) {
            p.x = wr + 0.6;
            if (p.velocityX < 0) p.velocityX = 0;
            p.wallDir = -1;
          } else {
            // Fully inside the body (spawned or teleported): push out sideways.
            if (p.x + p.width / 2 < (wl + wr) / 2) { p.x = wl - p.width - 0.6; p.wallDir = 1; }
            else { p.x = wr + 0.6; p.wallDir = -1; }
          }
          break;
        }
      }
      // Wall slide: clawing down the face drags the fall to a crawl, dust rubs
      // off the wall, and the buffered jump becomes an away-facing wall kick.
      if (p.wallDir && !p.onGround && p.velocityY > 1.2 && p.wallLock <= 0) {
        p.velocityY = Math.min(p.velocityY, 2.4);
        p.facing = p.wallDir;
        p.wallSlideTick = ((p.wallSlideTick || 0) + 1) % 6;
        if (p.wallSlideTick === 0) {
          game.particles.push({
            x: p.wallDir === 1 ? p.x + p.width + 2 : p.x - 2,
            y: p.y + p.height * 0.35 + Math.random() * p.height * 0.5,
            vx: -p.wallDir * (0.6 + Math.random()),
            vy: 1 + Math.random(),
            life: 16, color: 'rgba(200, 225, 255, 0.8)', size: Math.random() * 2 + 1,
          });
        }
      }

      // Squash and stretch relax back toward neutral.
      p.squash += (1 - p.squash) * 0.12;
      p.stretch += (1 - p.stretch) * 0.12;
      // The gait is driven by distance travelled, not by a fixed clock: a slow
      // walk takes short steps and a sprint takes long ones, and the paws stop
      // paddling the moment the cat stops.
      if (Math.abs(p.velocityX) > 0.25) {
        p.runCycle += 0.11 + Math.abs(p.velocityX) * 0.036;
      }

      // Slow motion and zoom punch decay.
      if (game.slowMo > 0) game.slowMo--;
      if (game.zoomPunch > 0) game.zoomPunch--;

      // Blinking
      if (!game.player.isBlinking) {
        if (Math.random() < 0.008) {
          game.player.isBlinking = true;
          game.player.blinkTimer = 10;
        }
      } else {
        game.player.blinkTimer--;
        if (game.player.blinkTimer <= 0) game.player.isBlinking = false;
      }

      // Bullets
      game.bullets = game.bullets.filter((b: any) => b.life > 0);
      game.bullets.forEach((b: any) => {
        b.x += b.vx; b.y += b.vy; b.life--;
        game.enemies.forEach((e: any) => {
          // A spent bullet must not carry on through a second overlapping enemy.
          if (b.life <= 0 || e.isShadow) return;
          if (e.x < b.x + b.radius && e.x + e.width > b.x - b.radius && e.y < b.y + b.radius && e.y + e.height > b.y - b.radius) {
            // Remember where the enemy died before moving it out of the world:
            // the old code set e.x = -1000 first, so the explosion, the combo
            // text and the +200 all played 1000 px off-screen where nobody
            // could see them.
            const killX = e.x + e.width / 2;
            const killY = e.y + e.height / 2;
            e.x = -1000; b.life = 0;
            registerCombo(game, 200, killX, killY);
            grantXp(game, 25);
            awardCoins(game, 3);
            game.enemiesDefeatedInRun = (game.enemiesDefeatedInRun || 0) + 1;
            game.killsThisLevel = (game.killsThisLevel || 0) + 1;
            gainShadowCharge(game, 12);
            AudioEngine.playExplosion();

            // Explosion particles
            for (let i = 0; i < 15; i++) {
              game.particles.push({
                x: killX, y: killY,
                vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
                life: 30, color: '#ff2222', size: Math.random() * 4 + 2
              });
            }
            // Floating score text
            game.floatingTexts.push({ x: killX, y: killY, text: '+200', life: 40, color: '#ff2222' });
          }
        });

        if (game.boss && game.boss.hp > 0) {
          const boss = game.boss;
          if (boss.x < b.x + b.radius && boss.x + boss.width > b.x - b.radius && boss.y < b.y + b.radius && boss.y + boss.height > b.y - b.radius) {
            b.life = 0;
            const coreHit = boss.coreExposed > 0;
            const shadowShot = game.shadowActive > 0;
            const damage = (coreHit ? 2 : 1) * (shadowShot ? 2 : 1);
            boss.hp -= damage;
            gainShadowCharge(game, 6);
            boss.stunTimer = 8;
            game.hitStop = 2;
            game.screenShake = 10;
            // Skade-partiklar
            const bossCol = boss.phase === 0 ? '#ff6b35' : boss.phase === 1 ? '#ff2222' : '#ff00ff';
            for (let pi = 0; pi < 12; pi++) {
              game.particles.push({
                x: boss.x + boss.width/2, y: boss.y + boss.height/2,
                vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12,
                life: 25, color: bossCol, size: Math.random()*5+2
              });
            }
            game.floatingTexts.push({
              x: boss.x + boss.width / 2, y: boss.y - 10,
              text: coreHit ? tr('KÄRNTRÄFF -{n}!', { n: damage }) : tr('BOSS HP {a}/{b}', { a: boss.hp, b: boss.maxHp }),
              life: 30, color: coreHit ? '#ffd166' : '#ff6b6b',
            });
            if (coreHit) AudioEngine.playCombo(3);
            if (boss.hp <= 0) {
              registerCombo(game, 900 + boss.phase * 300, boss.x, boss.y);
              grantXp(game, 200 + boss.phase * 100);
              awardCoins(game, 50 + boss.phase * 20);
              game.bossDefeatedInRun = true;
              game.screenShake = 30;
              game.slowMo = 45;
              // Stor explosion
              for (let pi = 0; pi < 40; pi++) {
                game.particles.push({
                  x: boss.x + Math.random()*boss.width,
                  y: boss.y + Math.random()*boss.height,
                  vx: (Math.random()-0.5)*18, vy: (Math.random()-0.5)*18,
                  life: 50, color: ['#ff6b35','#ffcc00','#ff2222','#ffffff'][Math.floor(Math.random()*4)],
                  size: Math.random()*8+3
                });
              }
              pushToast(game, tr('{name} BESEGRAD! +{n} MYNT', { name: boss.name, n: 50 + boss.phase * 20 }), '#ff9f43');
              AudioEngine.playExplosion();
              AudioEngine.playLevelUp();
            }
          }
        }
      });

      // Update Particles
      game.particles = game.particles.filter((p: any) => p.life > 0);
      game.particles.forEach((p: any) => {
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.2; // gravity
        p.life--;
        p.size *= 0.95;
      });

      // Update Floating Texts
      game.floatingTexts = game.floatingTexts.filter((t: any) => t.life > 0);
      game.floatingTexts.forEach((t: any) => {
        t.y -= 1; // float up
        t.life--;
      });

      if (game.comboTimer > 0) game.comboTimer--;
      else game.combo = 0;

      // Multiplier decays on a longer window than the combo, so the reward
      // survives a couple of actions after the last pickup.
      if (game.multiplierTimer > 0) {
        game.multiplierTimer--;
      } else if (game.multiplier > 1) {
        game.multiplier = Math.max(1, game.multiplier - 1);
        game.lastMilestoneMultiplier = game.multiplier;
        game.multiplierTimer = 90;
        if (game.multiplier === 1) game.streak = 0;
      }

      // Toast lifetimes
      game.toasts = game.toasts.filter((t: any) => --t.life > 0);

      // Speed Run clock. One fixed step is exactly 1/60 s, so this counts real
      // seconds no matter what the monitor refreshes at.
      if (game.levelType === 'Speed Run') {
        game.levelTimer = Math.max(0, game.levelTimer - 1 / 60);
        if (game.levelTimer <= 0) {
          game.lives--;
          game.deathsInRun = (game.deathsInRun || 0) + 1;
          game.noHit = false;
          if (game.lives <= 0) {
            endRun(game, 'timer');
            return;
          }
          // Running out of time costs a life like any other mistake. Ending the
          // whole run here (as this used to) killed players who still had four
          // lives left, which is exactly what "I die for no reason" looked like.
          // Hand the level budget back so the fish hunt stays achievable.
          game.levelTimer = game.levelTimerBudget || 30;
          game.player.invincible = true;
          game.player.invincibleTimer = 90;
          game.screenShake = 10;
          pushToast(game, tr('TIDEN UTE! -1 LIV'), '#ff8888');
          AudioEngine.playLifeLost();
        }
      }

      if (game.miniEvent.type !== 'NONE') {
        game.miniEvent.timer--;
        if (game.miniEvent.timer <= 0) {
          game.miniEvent.active = !game.miniEvent.active;
          game.miniEvent.timer = game.miniEvent.active ? game.miniEvent.duration : 420;
        }
      }

      // Surprise events: a telegraphed, short interruption (meteor rain, gust
      // front, drone swarm, gold rush, blackout). Warned on screen long before
      // it lands, never on the tutorial stages, never during a boss fight and
      // never the same event twice in a row.
      if (game.surprise) {
        const ev = game.surprise;
        ev.timer--;
        const def = EVENTS[ev.id];
        const total = def.warning + def.duration;
        ev.progress = 1 - Math.max(0, ev.timer) / total;
        if (ev.timer <= 0) {
          game.lastSurprise = ev.id;
          game.surprise = null;
          if (ev.id === 'goldRush') game.buffs.goldRush = 0;
        }
      } else {
        const bossActive = !!game.boss && game.boss.hp > 0 && game.boss.encountered;
        const next = pickEvent(
          game.level ?? 1,
          game.frame ?? 0,
          game.surpriseSeed ?? 1,
          game.lastSurprise ?? null,
          bossActive,
        );
        if (next) {
          game.surprise = { id: next, timer: EVENTS[next].warning + EVENTS[next].duration, progress: 0 };
          const def = EVENTS[next];
          pushToast(game, tr('{name}!', { name: tr(def.name) }), def.accent);
          AudioEngine.playCheckpoint();
          haptic('checkpoint', progress.settings.haptics);
        }
      }

      // Meteor rain: burning rocks fall from the sky and burst on the ground.
      // They are a dodge puzzle, not a damage wall - the gaps are generous.
      if (game.surprise?.id === 'meteor') {
        const def = EVENTS.meteor;
        const elapsed = def.warning + def.duration - game.surprise.timer;
        if (elapsed > def.warning && game.frame % 26 === 0) {
          const mx = game.player.x + 220 + Math.random() * 420;
          game.meteors = game.meteors || [];
          game.meteors.push({ x: mx, y: -40, vy: 5 + Math.random() * 2.5, r: 12 + Math.random() * 8, life: 120 });
        }
      }
      (game.meteors || []).forEach((m: any) => {
        m.vy += 0.16;
        m.y += m.vy;
        m.life--;
        const hitGround = m.y > game.groundY - 6;
        const dx = Math.abs((m.x) - (game.player.x + game.player.width / 2));
        if (hitGround || m.life <= 0) {
          m.dead = true;
          game.screenShake = Math.max(game.screenShake, 5);
          for (let i = 0; i < 16; i++) {
            game.particles.push({
              x: m.x, y: Math.min(m.y, game.groundY),
              vx: (Math.random() - 0.5) * 8,
              vy: -Math.random() * 6,
              life: 26, color: i % 3 ? '#ff9f43' : '#ffd166',
              size: 2 + Math.random() * 3,
            });
          }
          AudioEngine.playExplosion();
        } else if (!game.player.invincible && dx < m.r + 26 && Math.abs(m.y - (game.player.y + game.player.height / 2)) < m.r + 28) {
          m.dead = true;
          hurtPlayer(game, 'hazard', { lift: 5 });
        }
      });
      if (game.meteors) game.meteors = game.meteors.filter((m: any) => !m.dead);

      // Drone swarm: three hovering drones drift in from the right edge.
      if (game.surprise?.id === 'swarm') {
        const def = EVENTS.swarm;
        const elapsed = def.warning + def.duration - game.surprise.timer;
        if (elapsed > def.warning && game.frame % 60 === 0) {
          game.enemies.push({
            x: game.player.x + 620 + Math.random() * 180,
            y: game.groundY - 170 - Math.random() * 90,
            width: 40, height: 30, velocityX: 0, type: 5,
            platform: 0, baseY: game.groundY - 170,
            hover: Math.random() * Math.PI * 2, aggroTo: true,
            shootTimer: 0, chargeTimer: 0,
          });
        }
      }


      // Weather Logic
      game.weatherParticles.forEach((p: any) => {
        if (game.weather === 'DIMMIGT') {
          p.sway += 0.01;
          p.x += Math.sin(p.sway) * 0.5 + p.speed;
          if (p.x > canvas.width + p.radius) p.x = -p.radius;
        } else {
          p.y += p.speed;
          if (game.weather === 'SNÖIGT') {
            p.sway += 0.05;
            p.x += Math.sin(p.sway) * 0.8;
          }
          if (p.y > canvas.height) {
            p.y = -20;
            p.x = Math.random() * canvas.width;
          }
        }
      });

      // Thunderstorms: aimed strikes on solid ground, never on the cat.
      updateLightning(game, canvas.width);

      // Hazard Logic
      game.hazards.forEach((h: any) => {
        if (h.type === 'movingSaw') {
          h.phase += h.speed;
          h.x = h.baseX + Math.sin(h.phase) * h.range;
        } else if (h.type === 'laser') {
          h.timer--;
          if (h.timer <= 0) {
            h.active = !h.active;
            h.timer = h.active ? h.onDuration : h.offDuration;
          }
        }
      });

      // Check if player is over a hole - if so, they fall through!
      let isOverHole = false;
      const playerFeetX = game.player.x + game.player.width / 2;
      const playerFeetY = game.player.y + game.player.height;

      game.holes.forEach(hole => {
        // Player center is within hole horizontal bounds AND at ground level
        if (playerFeetX > hole.x && playerFeetX < hole.x + hole.width &&
          playerFeetY >= hole.y - 5 && playerFeetY <= hole.y + 50) {
          isOverHole = true;
        }
      });

      // Platforms - landing sets onGround and arms coyote time for the next frame.
      const wasOnGround = game.player.onGround;
      game.player.onGround = false;
      if (!isOverHole && game.player.velocityY >= 0) {
        for (const plat of game.platforms) {
          const playerBottom = game.player.y + game.player.height;
          const playerRight = game.player.x + game.player.width;
          const playerLeft = game.player.x;

          // More lenient check - player must be horizontally overlapping AND vertically close to platform top
          if (playerRight > plat.x + 5 && playerLeft < plat.x + plat.width - 5 &&
            playerBottom >= plat.y - 5 && playerBottom <= plat.y + 25) {
            const impactSpeed = game.player.velocityY;
            game.player.y = plat.y - game.player.height;
            game.player.velocityY = 0;
            game.player.isJumping = false;
            game.player.hasDoubleJumped = false;
            game.player.onGround = true;
            game.player.coyoteTimer = 7;
            game.player.lastGroundedY = game.player.y;
            game.player.ridingRef = plat;
            if (!wasOnGround) {
              // Landing squash + dust so the moment reads clearly.
              game.player.squash = 1 + Math.min(0.5, impactSpeed * 0.04);
              game.player.stretch = 0.78;
              // A soft thump scaled by the fall. Silence on landing was the one
              // gap in the movement feedback after jump, dash and shoot.
              if (impactSpeed > 3) AudioEngine.playLand(Math.min(1.5, impactSpeed / 12));
              // Dust puff: two arcs of soft puffs kicked out to both sides,
              // lighter when the landing is soft. This is the single cheapest
              // trick that makes a jump feel like it has weight.
              const dustPal = game.worldPal || { grass: '#e8f5e0' };
              const puffs = Math.min(16, 5 + Math.round(impactSpeed * 1.4));
              for (let i = 0; i < puffs; i++) {
                const side = i % 2 === 0 ? -1 : 1;
                game.particles.push({
                  x: game.player.x + game.player.width / 2 + side * (6 + Math.random() * 16),
                  y: game.player.y + game.player.height - 2,
                  vx: side * (1.2 + Math.random() * 2.6),
                  vy: -0.6 - Math.random() * 1.6,
                  life: 14 + Math.round(Math.random() * 10),
                  color: i % 3 === 0 ? dustPal.grass : 'rgba(245,250,238,0.85)',
                  size: 1.8 + Math.random() * 3.4,
                });
              }
              // A quick expanding ring sells the impact without a shake.
              game.landRing = { x: game.player.x + game.player.width / 2, y: game.player.y + game.player.height, life: 14, r: 8 + impactSpeed * 2 };
            }
            break; // Found a platform, stop checking
          }
        }
      }
      if (!game.player.onGround && wasOnGround) {
        game.player.coyoteTimer = 7;
      }
      // A walked-off edge stops being a moving platform the cat is glued to.
      if (!game.player.onGround) game.player.ridingRef = null;

      // Neon bounce pads: stepping or landing on the disc flings the cat
      // skyward with a fresh double jump, so the optional sky ledges blend
      // back into the route without needing an upgrade.
      for (const s of game.springPads) {
        if (game.player.velocityY < 0) break;
        const feetY = game.player.y + game.player.height;
        if (feetY >= s.y - 6 && feetY <= s.y + 26 &&
          game.player.x + game.player.width > s.x + 6 && game.player.x < s.x + s.width - 6) {
          game.player.y = s.y - game.player.height;
          game.player.velocityY = -game.player.jumpPower * 1.55;
          game.player.isJumping = true;
          game.player.hasDoubleJumped = false;
          game.player.onGround = false;
          game.player.ridingRef = null;
          game.player.coyoteTimer = 0;
          game.player.squash = 0.62;
          game.player.stretch = 1.5;
          s.press = 12;
          game.zoomPunch = Math.max(game.zoomPunch, 7);
          for (let i = 0; i < 12; i++) {
            game.particles.push({
              x: s.x + s.width / 2 + (Math.random() - 0.5) * s.width,
              y: s.y,
              vx: (Math.random() - 0.5) * 6,
              vy: -Math.random() * 4 - 1,
              life: 24, color: '#7ee7ff', size: Math.random() * 3.5 + 1.5,
            });
          }
          gainShadowCharge(game, 5);
          AudioEngine.playBounce();
          haptic('bounce', progress.settings.haptics);
          break;
        }
      }
      game.springPads.forEach((s: any) => { if (s.press > 0) s.press--; });

      // Enemies - with better null safety
      game.enemies.forEach(e => {
        if (e.x < -500 || !game.platforms[e.platform]) return;

        // Near miss: passing close to a live enemy without touching it rewards the player.
        if (!e.nearMissed && !game.player.invincible) {
          const dx = Math.abs((game.player.x + game.player.width / 2) - (e.x + e.width / 2));
          const dy = Math.abs((game.player.y + game.player.height / 2) - (e.y + e.height / 2));
          if (dx < 70 && dy < 60) {
            e.nearMissed = true;
            game.nearMisses = (game.nearMisses || 0) + 1;
            runTotalsRef.current.nearMisses += 1;
            gainShadowCharge(game, 20);
            game.score += 75;
            game.floatingTexts.push({ x: e.x, y: e.y - 20, text: tr('NÄSTAN! +75'), life: 40, color: '#7ef7c2' });
            AudioEngine.playNearMiss();
          }
        }

        // Only move enemy if platform exists
        const p = game.platforms[e.platform];
        if (p) {
          if (e.type === 4) {
            // Charger: winds up, then lunges at the cat when it gets close.
            const dx = (game.player.x + game.player.width / 2) - (e.x + e.width / 2);
            const dy = Math.abs((game.player.y + game.player.height / 2) - (e.y + e.height / 2));
            if (e.chargeTimer > 0) {
              e.chargeTimer--;
              e.x += Math.sign(dx || 1) * 4.4;
            } else {
              if (Math.abs(dx) < 240 && dy < 90) {
                e.chargeTimer = 34;
                game.particles.push({ x: e.x + e.width / 2, y: e.y + e.height, vx: 0, vy: -1, life: 20, color: '#ffb703', size: 4 });
              }
              e.x += e.velocityX * 0.6;
            }
            if (e.x < p.x) { e.x = p.x; e.velocityX = Math.abs(e.velocityX); }
            if (e.x + e.width > p.x + p.width) { e.x = p.x + p.width - e.width; e.velocityX = -Math.abs(e.velocityX); }
          } else if (e.type === 5) {
            // Hover drone: bobs on station, then drifts toward the cat once it
            // is close - slow enough that the route stays readable, and it
            // respects the same one-hit-bounce top rule as every ground enemy.
            e.hover += 0.055;
            e.y += ((e.baseY + Math.sin(e.hover) * 12) - e.y) * 0.12;
            const droneDx = (game.player.x + game.player.width / 2) - (e.x + e.width / 2);
            if (Math.abs(droneDx) < 460) e.aggroTo = true;
            if (e.aggroTo) {
              e.x += Math.sign(droneDx) * (0.9 + (game.level || 1) * 0.03);
            } else {
              e.x += Math.sin(e.hover * 0.4) * 0.35;
            }
            // Never crash-land into the floor or drift through the ceiling.
            if (e.y > game.groundY - 78 - e.height) e.y = game.groundY - 78 - e.height;
            if (e.y < 70) e.y = 70;
          } else if (e.type === 3) {
            // Turret: immobile, but it aims a slow orb at the cat on a timer.
            e.shootTimer = (e.shootTimer ?? 90) - 1;
            const dx = (game.player.x + game.player.width / 2) - (e.x + e.width / 2);
            const dy = (game.player.y + game.player.height / 2) - (e.y + e.height / 2);
            if (e.shootTimer <= 0 && Math.abs(dx) < 620 && Math.abs(dy) < 300) {
              e.shootTimer = 150;
              const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
              game.enemyBullets.push({
                x: e.x + e.width / 2,
                y: e.y + e.height * 0.42,
                vx: (dx / dist) * 3.1,
                vy: (dy / dist) * 3.1,
                radius: 7,
                life: 220,
              });
              AudioEngine.playShoot();
            }
          } else {
            updateEnemyMotion(e, game, p);
          }
        }

        // Dissolved cat: touching an enemy removes it instead of hurting us.
        // This runs before the invincibility guard, which would otherwise skip
        // every collision while shifted.
        if (game.shadowActive > 0 && !e.shadowKilled && e.x > -500) {
          const sx = game.player.x + game.player.width > e.x + 3 && game.player.x < e.x + e.width - 3;
          const sy = game.player.y + game.player.height > e.y + 3 && game.player.y < e.y + e.height - 3;
          if (sx && sy) shadowPassKill(game, e);
        }

        // ONLY check collision if player is NOT invincible AND there's actual overlap
        if (!game.player.invincible) {
          // More strict collision check - must have CLEAR overlap
          const overlapX = game.player.x + game.player.width > e.x + 5 && game.player.x < e.x + e.width - 5;
          const overlapY = game.player.y + game.player.height > e.y + 5 && game.player.y < e.y + e.height - 5;

          if (overlapX && overlapY) {
            const playerBottom = game.player.y + game.player.height;
            const enemyTop = e.y;
            const enemyCenterY = e.y + e.height / 2;

            // Check if player is falling AND above enemy's center - then defeat enemy
            // Otherwise, player takes damage
            const isAboveEnemy = playerBottom < enemyCenterY;
            const isFalling = game.player.velocityY > 0;

            if (isFalling && isAboveEnemy && playerBottom < enemyTop + 20 && !e.isShadow) {
              // Player jumps on enemy - defeat enemy!
            const enemyCenterXBeforeRemove = e.x + e.width / 2;
            const enemyCenterYBeforeRemove = e.y + e.height / 2;
            e.x = -1000;
            registerCombo(game, 200, enemyCenterXBeforeRemove, enemyCenterYBeforeRemove);
            grantXp(game, 25);
            awardCoins(game, 2);
            game.enemiesDefeatedInRun = (game.enemiesDefeatedInRun || 0) + 1;
            game.killsThisLevel = (game.killsThisLevel || 0) + 1;
            gainShadowCharge(game, 14);
            game.player.velocityY = -12;
            game.zoomPunch = 5;
            AudioEngine.playExplosion();
              for (let i = 0; i < 15; i++) {
                game.particles.push({
                  x: enemyCenterXBeforeRemove, y: enemyCenterYBeforeRemove,
                  vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
                  life: 30, color: '#ff8800', size: Math.random() * 4 + 2
                });
              }
              game.floatingTexts.push({ x: enemyCenterXBeforeRemove, y: enemyCenterYBeforeRemove, text: '+200', life: 40, color: '#ff8800' });
            } else {
              // Side or underside contact costs a life unless a shield soaks it.
              hurtPlayer(game, 'enemy', { lift: 6 });
            }
          }
        }
      });

      if (game.boss && game.boss.hp > 0) {
        const boss = game.boss;
        const attackProfile = BOSS_ATTACK_PROFILES[boss.type] || BOSS_ATTACK_PROFILES.rat_king;
        if (!boss.encountered && Math.abs(boss.x - game.player.x) < canvas.width * 0.8) {
          boss.encountered = true;
          pushToast(game, tr('BOSS INKOMMER · {name}', { name: boss.name }), '#ff9f43');
          game.screenShake = Math.max(game.screenShake, 14);
          game.slowMo = 24;
          game.zoomPunch = 16;
          AudioEngine.playBossRoar();
        }
        boss.auraAngle = (boss.auraAngle || 0) + 0.05;
        if (boss.coreExposed > 0) boss.coreExposed--;
        if (boss.coreFlash > 0) boss.coreFlash--;
        
        // Beräkna fas baserat på HP
        const hpPct = boss.hp / boss.maxHp;
        const newPhase = hpPct > 0.6 ? 0 : hpPct > 0.3 ? 1 : 2;
        if (newPhase > boss.phase) {
          boss.phase = newPhase;
          game.screenShake = 20;
          game.slowMo = 30;
          pushToast(game, tr('{name} FAS {n}!', { name: boss.name, n: boss.phase + 1 }), '#ff6b35');
          AudioEngine.playBossRoar();
          game.zoomPunch = 12;
          boss.attackTimer = 30; // Kortare cooldown i högre faser
          boss.attackCooldown = Math.max(48, attackProfile.cooldown - boss.phase * 24);
        }
        
        // Stun-hantering
        if (boss.stunTimer > 0) {
          boss.stunTimer--;
        } else {
          // Rörelselogik
          const baseSpeed = boss.velocityX + boss.phase * 0.8;
          const nextBossX = boss.x + (boss.phase === 2 ? baseSpeed * 1.5 : baseSpeed);
          if (nextBossX < boss.platformX) {
            boss.x = boss.platformX;
            boss.velocityX = Math.abs(boss.velocityX);
          } else if (nextBossX + boss.width > boss.platformX + boss.platformW) {
            boss.x = boss.platformX + boss.platformW - boss.width;
            boss.velocityX = -Math.abs(boss.velocityX);
          } else {
            boss.x = nextBossX;
          }
          
          // Vertikal oscillation (extra i fas 1+)
          if (boss.phase > 0) {
            boss.y = boss.groundY + Math.sin(boss.auraAngle) * (8 + boss.phase * 6);
          }
          
          // Attack logic. Every signature move is telegraphed for a beat first,
          // so a charge-up reads clearly and can be dodged instead of guessed.
          if (boss.telegraph > 0) {
            boss.telegraph--;
            if (boss.telegraph === 0) {
              const move = (boss.pendingMove || 'orb') as BossPattern;
              boss.pendingMove = null;
              fireBossAttack(game, boss, move, attackProfile);
              // Recovery window: the core glows for 1.2 s after every attack.
              // Shots in this window deal double, which rewards aggression.
              boss.coreExposed = boss.isMini ? 52 : 72;
              boss.coreFlash = 12;
              boss.attackCooldown = Math.max(42, attackProfile.cooldown - boss.phase * 22 - (boss.tier || 1) * 3);
              boss.attackTimer = boss.attackCooldown;
            }
          } else {
            boss.attackTimer--;
            if (boss.attackTimer <= 0) {
              const moves = attackProfile.moves[boss.phase] || attackProfile.moves[0];
              const move = moves[(boss.moveIndex || 0) % moves.length] as BossPattern;
              boss.moveIndex = (boss.moveIndex || 0) + 1;
              boss.pendingMove = move;
              // Later tiers wind up faster, which is what makes the same boss
              // genuinely harder without changing its silhouette.
              // Phase 3 winds up much longer, so its new patterns read clearly.
              boss.telegraph = Math.max(12, 26 - (boss.tier || 1) * 2 + (boss.phase === 2 ? 16 : 0));
              boss.telegraphTotal = boss.telegraph;
              AudioEngine.playBossWarning();
              haptic('bossWarning', progress.settings.haptics);
            }
          }
        }
                // Uppdatera boss-projektiler
        boss.projectiles = boss.projectiles.filter((p: any) => p.life > 0);
        boss.projectiles.forEach((p: any) => {
          p.x += p.vx; p.y += p.vy;
          p.life--;
          // Kollision med spelare
          if (!game.player.invincible) {
            const dx = (game.player.x + game.player.width/2) - p.x;
            const dy = (game.player.y + game.player.height/2) - p.y;
            if (Math.sqrt(dx*dx + dy*dy) < p.radius + 20) {
              p.life = 0;
              hurtPlayer(game, 'boss', { lift: 6 });
            }
          }
        });
        
        // Shadow Shift pass: the dissolved cat can strike the boss's core for
        // double damage once per transformation, without taking a hit back.
        if (game.shadowActive > 0 && boss.shadowHitShift !== game.shadowShiftId) {
          const passX = game.player.x + game.player.width > boss.x && game.player.x < boss.x + boss.width;
          const passY = game.player.y + game.player.height > boss.y && game.player.y < boss.y + boss.height;
          if (passX && passY) {
            boss.shadowHitShift = game.shadowShiftId;
            boss.hp -= 2;
            boss.stunTimer = 18;
            boss.coreFlash = 16;
            game.hitStop = 4;
            game.screenShake = Math.max(game.screenShake, 12);
            game.floatingTexts.push({
              x: boss.x + boss.width / 2, y: boss.y,
              text: tr('SKUGGPASS -2 HP'), life: 45, color: '#c084fc',
            });
            gainShadowCharge(game, 14);
            if (boss.hp <= 0) {
              registerCombo(game, 900 + boss.phase * 300, boss.x, boss.y);
              game.bossDefeatedInRun = true;
              pushToast(game, tr('{name} BESEGRAD!', { name: boss.name }), '#ff9f43');
              AudioEngine.playExplosion();
            }
          }
        }

        // Kollision med spelaren (direktkontakt)
        if (!game.player.invincible) {
          const overlapX = game.player.x + game.player.width > boss.x && game.player.x < boss.x + boss.width;
          const overlapY = game.player.y + game.player.height > boss.y && game.player.y < boss.y + boss.height;
          if (overlapX && overlapY) {
            hurtPlayer(game, 'boss', { lift: 8 });
            boss.stunTimer = 15; // A body check staggers the boss too
          }
        }
      }

      // Hazards damage player on touch
      if (!game.player.invincible) {
        for (const h of game.hazards) {
          if (h.type === 'laser' && !h.active) continue;
          const overlapX = game.player.x + game.player.width > h.x && game.player.x < h.x + h.width;
          const overlapY = game.player.y + game.player.height > h.y && game.player.y < h.y + h.height;
          if (overlapX && overlapY) {
            hurtPlayer(game, 'hazard', { lift: 5 });
            break;
          }
        }
      }

      if (game.player.invincibleTimer > 0) game.player.invincibleTimer--;
      else game.player.invincible = false;

      // Falling into a chasm costs a life and respawns on the last safe
      // platform - not at a fixed offset that can drop the cat straight back
      // into the same hole and drain several lives in a row.
      if (game.player.y > canvas.height + 100) {
        // "Invulnerable" has to include pits: losing a life while dissolved
        // reads as a bug. The respawn still happens, it just costs nothing.
        const carriedByShadow = game.shadowActive > 0;
        if (!carriedByShadow) {
          game.lives--;
          game.deathsInRun = (game.deathsInRun || 0) + 1;
          game.noHit = false;
          AudioEngine.playLifeLost();
          pushToast(game, tr('-1 LIV · TILLBAKA PÅ SPÅRET'), '#ff8888');
        } else {
          pushToast(game, tr('SKUGGBONUS · FALLET RÄDDAT'), '#c084fc');
        }
        game.slowMo = 10;
        game.screenShake = 12;
        const anchorX = game.checkpointX && game.checkpointX > 120 ? game.checkpointX : game.player.x + 20;
        const safePlatforms = game.platforms
          .filter((pl: any) => pl.isGround && pl.x < anchorX + 30 && pl.x + pl.width > anchorX - 30 && !pl.chasm)
          .sort((a: any, b: any) => b.x - a.x);
        const safe = safePlatforms[0];
        game.player.x = safe
          ? Math.max(safe.x + 10, Math.min(anchorX, safe.x + safe.width - game.player.width - 10))
          : 160;
        game.player.y = (safe ? safe.y : game.groundY) - game.player.height - 30;
        game.player.velocityY = 0;
        game.player.velocityX = 0;
        game.player.invincible = true;
        game.player.invincibleTimer = 70;
        if (!carriedByShadow && game.lives <= 0) endRun(game, 'hole');
      }



      // Checkpoints: crossing an anchor arms a safe respawn point. Only one
      // toast per anchor, and never on the tutorial meadow.
      const nextCheckpoint = game.checkpoints?.[game.checkpointIndex || 0];
      if (nextCheckpoint !== undefined && game.player.x >= nextCheckpoint) {
        game.checkpointX = nextCheckpoint;
        game.checkpointIndex = (game.checkpointIndex || 0) + 1;
        pushToast(game, tr('CHECKPOINT!'), '#7ee7ff');
        AudioEngine.playCheckpoint();
        haptic('checkpoint', progress.settings.haptics);
        for (let i = 0; i < 12; i++) {
          game.particles.push({
            x: nextCheckpoint + (Math.random() - 0.5) * 40,
            y: game.groundY - 20 - Math.random() * 60,
            vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 3,
            life: 30, color: '#7ee7ff', size: Math.random() * 3 + 1.5,
          });
        }
      }

      // Camera: deadzone + look-ahead in the facing direction, smoothed so it never snaps.
      const desiredScroll = game.player.x - canvas.width * 0.45 + game.player.facing * 90;
      const maxScroll = Math.max(0, game.levelLength - canvas.width);
      const targetScroll = Math.max(0, Math.min(desiredScroll, maxScroll));
      const scrollDiff = targetScroll - game.scrollX;
      if (Math.abs(scrollDiff) > 90) {
        game.scrollX += scrollDiff * 0.16; // fast catch-up outside the deadzone
      } else {
        game.scrollX += scrollDiff * 0.07;
      }
      game.scrollX = Math.max(0, Math.min(game.scrollX, maxScroll));

      // Active power-up timers and the short shot cooldown.
      if (game.buffs.magnet > 0) game.buffs.magnet--;
      if (game.buffs.rapid > 0) game.buffs.rapid--;
      if (game.shootCooldown > 0) game.shootCooldown--;

      // Pickups: float in place, then trigger their buff on touch.
      game.pickups.forEach((pk: any) => {
        if (pk.collected) {
          if (pk.arena && pk.respawn > 0) {
            pk.respawn--;
            if (pk.respawn <= 0) {
              pk.collected = false;
              pk.hover = 0;
            }
          }
          return;
        }
        pk.hover += 0.045;
        pk.spin += 0.03;
        pk.y = pk.baseY + Math.sin(pk.hover) * 6;
        if (
          game.player.x < pk.x + pk.width &&
          game.player.x + game.player.width > pk.x &&
          game.player.y < pk.y + pk.height &&
          game.player.y + game.player.height > pk.y
        ) {
          pk.collected = true;
          applyPickup(game, pk);
        }
      });

      // Enemy projectiles (turrets). Slow, clearly telegraphed orbs.
      game.enemyBullets = game.enemyBullets.filter((b: any) => b.life > 0);
      game.enemyBullets.forEach((b: any) => {
        b.x += b.vx; b.y += b.vy; b.life--;
        const dx = (game.player.x + game.player.width / 2) - b.x;
        const dy = (game.player.y + game.player.height / 2) - b.y;
        if (!game.player.invincible && Math.sqrt(dx * dx + dy * dy) < b.radius + 18) {
          b.life = 0;
          hurtPlayer(game, 'enemy', { lift: 6 });
        }
      });

      // Update coin positions and check collection
      game.fishes.forEach((f: any) => {
        if (!f.collected) {
          // Fish magnet: drift nearby fish toward the cat so the pickup feels
          // like a vacuum instead of a larger hitbox.
          if (game.buffs.magnet > 0 || game.shadowActive > 0) {
            const mdx = (game.player.x + game.player.width / 2) - (f.x + f.width / 2);
            const mdy = (game.player.y + game.player.height / 2) - (f.y + f.height / 2);
            const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
            if (mdist < 300 && mdist > 1) {
              const pull = Math.min(9, 120 / mdist);
              f.x += (mdx / mdist) * pull;
              f.baseY += (mdy / mdist) * pull;
            }
          }
          // Dynamic bobbing effect
          if (f.isFlying) {
            f.hoverOffset += 0.05;
            f.y = f.baseY + Math.sin(f.hoverOffset) * 15;
          } else {
            // Even static coins bob slightly
            f.hoverOffset = (f.hoverOffset || 0) + 0.03;
            f.y = f.baseY + Math.sin(f.hoverOffset) * 5;
          }

          // Check collision with player - collect coin
          if (game.player.x < f.x + f.width && game.player.x + game.player.width > f.x &&
            game.player.y < f.y + f.height && game.player.y + game.player.height > f.y) {            f.collected = true;
            registerCombo(game, 50, f.x, f.y);
            grantXp(game, 10);
            awardCoins(game, 2);
            game.fishedThisLevel = (game.fishedThisLevel || 0) + 1;
            game.totalCollectedInLevel++;
            gainShadowCharge(game, 7);
            // The Time Attack goal promises that every fish buys time, and the
            // intro card says so - but only the opening budget ever counted, so
            // the clock could not be refilled. Each fish now adds a little air.
            if (game.levelType === 'Speed Run' && game.levelTimer > 0) {
              game.levelTimer = Math.min(
                game.levelTimer + 1.8,
                (game.levelTimerBudget || 60) + 40,
              );
              game.floatingTexts.push({ x: f.x, y: f.y - 16, text: '+1.8s', life: 40, color: '#7ee7ff' });
            }
            AudioEngine.playCoin(game.streak || 0);
            haptic('collect', progress.settings.haptics);
            // Small coin pop so collection feels physical.
            for (let i = 0; i < 6; i++) {
              game.particles.push({
                x: f.x + 12, y: f.y + 7,
                vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 3 - 1,
                life: 20, color: '#ffd166', size: Math.random() * 3 + 1.5
              });
            }

            // Every 10 fish = bonus coins + ammo.
            if (game.totalCollectedInLevel % 10 === 0) {
              game.ammo += 1;
              awardCoins(game, 5);
              pushToast(game, tr('+5 MYNT! +1 SKOTT!'), '#ffd700');
              game.floatingTexts.push({ x: f.x, y: f.y - 30, text: tr('+5 MYNT! +1 SKOTT!'), life: 60, color: '#ffd700' });
            }

            // Floating score text
            game.floatingTexts.push({ x: f.x, y: f.y, text: '+50', life: 40, color: '#ffd700' });
          }
        }
      });

      // Auto-quality: drop the oldest particles rather than paying to draw a
      // thousand sparks on a phone that is already struggling.
      const q = game.quality || FULL_QUALITY;
      if (game.particles.length > q.particleLimit) {
        game.particles.splice(0, game.particles.length - q.particleLimit);
      }
      const weatherBudget = Math.ceil(game.weatherParticles.length * q.weatherScale);

      // --- DRAWING ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // One camera transform for shake and impact zoom. The zoom is centred on
      // the cat so a hit or a dash punches in on the action instead of the frame.
      ctx.save();
      const applyScreenShake = game.screenShake > 0;
      if (applyScreenShake) {
        game.screenShake--;
        const shakeMag = Math.min(12, 3 + game.screenShake * 0.35);
        const shakeX = (Math.random() - 0.5) * shakeMag;
        const shakeY = (Math.random() - 0.5) * shakeMag;
        ctx.translate(shakeX, shakeY);
      }
      if (game.zoomPunch > 0) {
        const zoom = 1 + game.zoomPunch * 0.0035;
        const focusX = game.player.x - game.scrollX + game.player.width / 2;
        const focusY = game.player.y + game.player.height / 2;
        ctx.translate(focusX, focusY);
        ctx.scale(zoom, zoom);
        ctx.translate(-focusX, -focusY);
      }
      // A permanent 1.14x camera crop. The old stage showed so much sky that
      // the cat read as a speck; this keeps the action large and cinematic
      // without changing the 1280x720 simulation or the HUD layout.
      {
        const focusX = game.player.x - game.scrollX + game.player.width / 2;
        const focusY = game.player.y + game.player.height / 2;
        ctx.translate(focusX, focusY);
        ctx.scale(STAGE_ZOOM, STAGE_ZOOM);
        ctx.translate(-focusX, -focusY);
      }

      // ------------------------------------------------------------------
      // Cartoon backdrop. One palette per chapter family (meadow, forest,
      // snow, desert, lava, city, space), three parallax planes with real
      // atmospheric perspective, thick warm outlines and a single sun that
      // also lights the ground. This replaced a hazy cyberpunk sky that
      // flattened every chapter into the same blue-grey wash.
      // ------------------------------------------------------------------
      const now = Date.now();
      const timeSec = now / 1000;
      const timePhase: 'night' | 'sunset' | 'dawn' | 'day' =
        game.timeOfDay === 'NIGHT' ? 'night'
          : game.timeOfDay === 'SUNSET' ? 'sunset'
            : game.timeOfDay === 'DAWN' ? 'dawn'
              : 'day';
      const isNight = timePhase === 'night';
      const isGolden = timePhase === 'sunset' || timePhase === 'dawn';
      const reduceNow = isReducedMotion(progress.settings.reduceMotion);
      const worldPal = game.worldPal;
      // Golden hour warms the family palette instead of swapping the sky out,
      // so a sunset meadow still reads as a meadow.
      if (isGolden && !isNight) {
        worldPal.skyTop = blend(worldPal.skyTop, '#6a4a8a', 0.38);
        worldPal.skyMid = blend(worldPal.skyMid, '#ffb27a', 0.42);
        worldPal.skyLow = blend(worldPal.skyLow, '#ffd9a0', 0.55);
        worldPal.haze = blend(worldPal.haze, '#ffc48a', 0.5);
        worldPal.sun = '#ffc46b';
      }
      if (isNight && !worldPal.night) worldPal.starfield = true;
      const backdropOpts = {
        width: canvas.width,
        height: canvas.height,
        groundY: game.groundY ?? canvas.height - 96,
        scrollX: game.scrollX,
        time: timeSec,
        pal: worldPal,
        theme: String(game.theme || ''),
        motion: reduceNow ? 0.25 : 1,
      };
      drawBackdrop(ctx, backdropOpts);
      // Solid earth under the playfield. Without this the area below the last
      // ground slab was transparent and the page background showed through as
      // a grey band; with it, a chasm reads as a hole cut into the world.
      drawEarth(ctx, backdropOpts.groundY, canvas.height, canvas.width, worldPal);

      // Platforms - chunky cartoon slabs and planks. Every shape is a
      // rounded, inked body with a saturated cap; that outline is what keeps
      // the cat readable against the sky. The cap follows the biome, so a snow
      // chapter gets snow, a desert gets sand and a meadow gets swaying grass.
      const fam = familyForTheme(String(game.theme || ''));
      const capStyle: 'grass' | 'snow' | 'sand' | 'stone' | 'metal' | 'lava' =
        fam === 'snow' || fam === 'ice' ? 'snow'
          : fam === 'desert' ? 'sand'
            : fam === 'lava' ? 'lava'
              : fam === 'space' ? 'metal'
                : fam === 'city' && game.timeOfDay === 'NIGHT' ? 'stone'
                  : 'grass';
      game.platforms.forEach((plat: any, platIndex: number) => {
        const platX = plat.x - game.scrollX;
        if (platX + plat.width < -40 || platX > canvas.width + 40) return;
        const platY = plat.y;

        if (plat.bossArena) {
          drawGroundSlab(ctx, {
            x: platX, y: platY, width: plat.width, height: plat.height,
            pal: {
              ...worldPal,
              groundTop: blend(worldPal.groundTop, '#ffb347', 0.55),
              groundBody: blend(worldPal.groundBody, '#8a4a2a', 0.45),
            },
            grass: false, cap: 'stone', time: timeSec,
            seed: platIndex * 31, motion: reduceNow ? 0.2 : 1,
          });
          ctx.save();
          ctx.strokeStyle = withAlpha('#ffb347', 0.7);
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(platX + 6, platY + 2);
          ctx.lineTo(platX + plat.width - 6, platY + 2);
          ctx.stroke();
          ctx.restore();
        } else if (plat.isGround && !plat.bossWalkway) {
          drawGroundSlab(ctx, {
            x: platX, y: platY, width: plat.width, height: plat.height,
            pal: worldPal, grass: true, cap: capStyle, time: timeSec,
            seed: platIndex * 17.3, motion: reduceNow ? 0.2 : 1,
          });
        } else {
          // Floating ledges, bridges, moving lifts and boss walkways.
          drawLedge(ctx, {
            x: platX, y: platY, width: plat.width, height: plat.height,
            pal: worldPal, time: timeSec, seed: platIndex * 9.1,
            theme: String(game.theme || ''), moving: !!plat.mover,
            accent: plat.bossWalkway ? '#53e5a0' : undefined,
          });
          if (plat.bossWalkway) {
            ctx.save();
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#20d98a';
            ctx.fillRect(platX + 3, platY + 4, plat.width - 6, plat.height - 6);
            ctx.restore();
          }
          if (plat.mover) {
            // Dashed rail so a lift lane is legible before the lift arrives.
            ctx.save();
            ctx.strokeStyle = withAlpha(worldPal.accent2, 0.45);
            ctx.lineWidth = 2.5;
            ctx.setLineDash([7, 10]);
            ctx.lineDashOffset = -timeSec * 26;
            ctx.beginPath();
            if (plat.mover.axis === 'h') {
              ctx.moveTo(plat.baseX - plat.mover.amp - game.scrollX, plat.baseY + plat.height / 2);
              ctx.lineTo(plat.baseX + plat.mover.amp - game.scrollX, plat.baseY + plat.height / 2);
            } else {
              const railCx = plat.baseX - game.scrollX + plat.width / 2;
              ctx.moveTo(railCx, plat.baseY - plat.mover.amp);
              ctx.lineTo(railCx, plat.baseY + plat.mover.amp + plat.height);
            }
            ctx.stroke();
            ctx.restore();
          }
        }
      });

      // Chasms: inked, deep and rounded, with a lit lip and hanging rock
      // spikes. A drawing with depth, not a black rectangle.
      game.holes.forEach((hole: any) => {
        const hx = hole.x - game.scrollX;
        if (hx + hole.width <= 0 || hx >= canvas.width) return;
        drawChasm(ctx, hx, hole.y, hole.width, canvas.height - hole.y, worldPal);
      });

      // Hazards
      game.hazards.forEach((h: any) => {
        const hx = h.x - game.scrollX;
        if (hx + h.width < -40 || hx > canvas.width + 40) return;

        if (h.type === 'spike') {
          ctx.fillStyle = '#cc2b2b';
          const spikeCount = 4;
          const spikeW = h.width / spikeCount;
          for (let i = 0; i < spikeCount; i++) {
            ctx.beginPath();
            ctx.moveTo(hx + i * spikeW, h.y + h.height);
            ctx.lineTo(hx + i * spikeW + spikeW / 2, h.y);
            ctx.lineTo(hx + (i + 1) * spikeW, h.y + h.height);
            ctx.closePath();
            ctx.fill();
          }
        } else if (h.type === 'movingSaw') {
          const cx = hx + h.width / 2;
          const cy = h.y + h.height / 2;
          const radius = h.width / 2;
          ctx.fillStyle = '#9aa3b2';
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#d7dde8';
          ctx.lineWidth = 2;
          for (let i = 0; i < 8; i++) {
            const angle = i * (Math.PI / 4) + h.phase;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * radius * 0.6, cy + Math.sin(angle) * radius * 0.6);
            ctx.lineTo(cx + Math.cos(angle) * (radius + 8), cy + Math.sin(angle) * (radius + 8));
            ctx.stroke();
          }
        } else if (h.type === 'laser') {
          ctx.fillStyle = '#2b2b2b';
          ctx.fillRect(hx - 3, h.y, 16, 8);
          if (h.active) {
            ctx.fillStyle = 'rgba(255, 40, 40, 0.7)';
            ctx.fillRect(hx, h.y + 8, h.width, h.height - 8);
            ctx.strokeStyle = '#ff8c8c';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(hx + h.width / 2, h.y + 8);
            ctx.lineTo(hx + h.width / 2, h.y + h.height);
            ctx.stroke();
          }
        }
      });

      drawCheckpointBeacons(ctx, game, canvas.width);

      // Neon bounce pads: an embedded spring mattress with a cyan disc that
      // compresses for a few frames after use, plus a bobbing chevron hint.
      game.springPads.forEach((s: any) => {
        const sx = s.x - game.scrollX;
        if (sx + s.width < -24 || sx > canvas.width + 24) return;
        const gotPress = s.press > 0 ? Math.max(0.3, s.press / 12) : 1;
        const discTop = s.y + 12 - 12 * gotPress;
        // Base plate sunk into the ground
        ctx.fillStyle = '#1d2a3d';
        ctx.beginPath();
        ctx.roundRect(sx - 5, s.y + 6, s.width + 10, 9, 3);
        ctx.fill();
        // Coil
        ctx.strokeStyle = '#5a7ea6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx + 8, s.y + 9);
        ctx.lineTo(sx + s.width - 8, s.y + 6);
        ctx.lineTo(sx + 8, s.y + 3);
        ctx.stroke();
        // Disc (squashes down when pressed)
        ctx.save();
        ctx.shadowColor = '#2bd8ee';
        ctx.shadowBlur = 10;
        const padGrad = ctx.createLinearGradient(sx, discTop, sx, s.y + 12);
        padGrad.addColorStop(0, gotPress < 1 ? '#ffffff' : '#7ff3ff');
        padGrad.addColorStop(1, '#1a8fa3');
        ctx.fillStyle = padGrad;
        ctx.beginPath();
        ctx.roundRect(sx, discTop, s.width, 10, 5);
        ctx.fill();
        ctx.restore();
        // Upward chevron hint: pulses until the pad is used.
        if (s.press === 0) {
          const hint = Math.sin(Date.now() / 260) * 2;
          ctx.strokeStyle = 'rgba(126, 231, 255, 0.7)';
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sx + s.width / 2 - 7, s.y - 15 - hint * 0.5);
          ctx.lineTo(sx + s.width / 2, s.y - 21 - hint);
          ctx.lineTo(sx + s.width / 2 + 7, s.y - 15 - hint * 0.5);
          ctx.stroke();
        }
      });

      // Bullets - a glowing core with a short motion trail. Rapid-fire shots are
      // icy cyan so the temporary weapon state is obvious at a glance.
      ctx.globalCompositeOperation = 'lighter';
      game.bullets.forEach((b: any) => {
        const bx = b.x - game.scrollX;
        const tint = b.tint || '#ff4d4d';
        ctx.fillStyle = tint;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.ellipse(bx - b.vx * 1.6, b.y - b.vy * 1.6, b.radius * 2.4, b.radius * 1.2, Math.atan2(b.vy, b.vx), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = tint;
        ctx.beginPath(); ctx.arc(bx, b.y, b.radius * 1.45, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(bx, b.y, b.radius * 0.6, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // Enemies - Detailed premium enemies with ground shadows and animations
      // Enemies - the same cartoon language as the hero: thick warm outlines,
      // two flat body tones, a big readable eye and an idle animation. These
      // replaced glossy gradient props that looked like clip-art next to the
      // hand-drawn cat.
      game.enemies.forEach((e: any) => {
        if (e.x < -500) return;
        const ex = e.x - game.scrollX;
        const ey = e.y;
        const ew = e.width;
        const eh = e.height;
        if (ex + ew < -80 || ex > canvas.width + 80) return;

        if (e.isShadow) {
          drawShadowWraith(ctx, ex, ey, ew, eh, Date.now());
          return;
        }

        drawCartoonEnemy(ctx, {
          type: e.type,
          x: ex,
          y: ey,
          w: ew,
          h: eh,
          now: Date.now(),
          facing: (e.velocityX ?? e.direction ?? 1) >= 0 ? 1 : -1,
          charging: (e.chargeTimer ?? 0) > 0,
          winding: (e.shootTimer ?? 99) < 34,
          aggro: !!e.aggroTo,
        });
      });

      // Enemy projectiles: slow glowing orbs with a readable core.
      game.enemyBullets.forEach((b: any) => {
        const bx = b.x - game.scrollX;
        ctx.save();
        ctx.shadowColor = '#ff7a3d';
        ctx.shadowBlur = 16;
        ctx.fillStyle = 'rgba(255, 122, 61, 0.85)';
        ctx.beginPath();
        ctx.arc(bx, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff3d6';
        ctx.beginPath();
        ctx.arc(bx, b.y, b.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      if (game.boss && game.boss.hp > 0) {
        const boss = game.boss;
        const bx = boss.x - game.scrollX;
        const by = boss.y;
        const bw = boss.width;
        const bh = boss.height;
        const hpPct = boss.hp / boss.maxHp;
        const phaseColors = ['#ff6b35', '#ff2222', '#ff00ff'];
        const phaseColor = phaseColors[boss.phase] || '#ff6b35';
        
        // Rita boss-projektiler
        if (boss.projectiles) {
          boss.projectiles.forEach((p: any) => {
            const alpha = Math.min(1, p.life / 30);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 12;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x - game.scrollX, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(p.x - game.scrollX, p.y, p.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });
        }
        
        // Aura-effekt
        ctx.save();
        ctx.globalAlpha = 0.3 + 0.1 * Math.sin(boss.auraAngle || 0);
        const auraGrad = ctx.createRadialGradient(bx + bw/2, by + bh/2, 0, bx + bw/2, by + bh/2, bw * 0.8);
        auraGrad.addColorStop(0, phaseColor);
        auraGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.ellipse(bx + bw/2, by + bh/2, bw * 0.8, bh * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // Telegraph: an expanding warning ring tells the player a signature move
        // is about to fire, so damage always feels earned.
        if (boss.telegraph > 0) {
          ctx.save();
          const total = boss.telegraphTotal || Math.max(1, Math.round(26 - (boss.tier || 1) * 2));
          const t = Math.max(0, Math.min(1, 1 - boss.telegraph / total));
          ctx.globalAlpha = 0.25 + 0.45 * t;
          ctx.strokeStyle = boss.phase === 2 ? '#ff00ff' : '#ffd166';
          ctx.lineWidth = 3;
          ctx.shadowColor = ctx.strokeStyle;
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(bx + bw / 2, by + bh / 2, bw * (0.5 + t * 0.55), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Boss-kropp baserat på typ
        ctx.save();
        if (boss.stunTimer > 0) {
          ctx.globalAlpha = 0.7 + 0.3 * Math.sin(Date.now() / 50);
        }
        
        // Stun-flash (vit blixt)
        const fillColor = boss.stunTimer > 0 ? '#ffffff' : phaseColor;
        
        // Boss-kropp baserat på boss.type
        const bType = boss.type || 'rat_king';
        const pdx = (game.player.x + game.player.width/2) - (boss.x + bw/2);
        const pdy = (game.player.y + game.player.height/2) - (boss.y + bh/2);
        const pAngle = Math.atan2(pdy, pdx);
        const eyeGlowColor = boss.phase === 2 ? '#ff00ff' : boss.phase === 1 ? '#ff2222' : '#ffaa00';

        if (bType === 'rat_king') {
          // --- RÅTTE-KUNG: Royal Rat Boss ---
          // Svans (lång piskande råttsvans)
          const tailWhip = Math.sin(Date.now() / 150) * 16;
          ctx.strokeStyle = '#d48898';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(bx + (boss.velocityX > 0 ? 10 : bw - 10), by + bh * 0.75);
          ctx.bezierCurveTo(
            bx + (boss.velocityX > 0 ? -35 : bw + 35), by + bh * 0.85 + tailWhip,
            bx + (boss.velocityX > 0 ? -50 : bw + 50), by + bh * 0.5 - tailWhip,
            bx + (boss.velocityX > 0 ? -30 : bw + 30), by + bh * 0.25
          );
          ctx.stroke();

          // Kropp (oval mörkbrun päls)
          const ratGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
          ratGrad.addColorStop(0, boss.phase === 2 ? '#882244' : '#4a3832');
          ratGrad.addColorStop(0.6, boss.phase === 2 ? '#551128' : '#322520');
          ratGrad.addColorStop(1, '#1e1410');
          ctx.fillStyle = ratGrad;
          ctx.beginPath();
          ctx.ellipse(bx + bw/2, by + bh * 0.55, bw * 0.44, bh * 0.42, 0, 0, Math.PI * 2);
          ctx.fill();

          // Ljusare mage
          ctx.fillStyle = '#b89488';
          ctx.beginPath();
          ctx.ellipse(bx + bw/2, by + bh * 0.6, bw * 0.26, bh * 0.28, 0, 0, Math.PI * 2);
          ctx.fill();

          // Råttöron
          ctx.fillStyle = '#684840';
          ctx.beginPath(); ctx.arc(bx + bw * 0.25, by + bh * 0.2, 14, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(bx + bw * 0.75, by + bh * 0.2, 14, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#d48898';
          ctx.beginPath(); ctx.arc(bx + bw * 0.25, by + bh * 0.2, 8, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(bx + bw * 0.75, by + bh * 0.2, 8, 0, Math.PI * 2); ctx.fill();

          // Råttans huvud & nos
          ctx.fillStyle = ratGrad;
          ctx.beginPath();
          ctx.ellipse(bx + bw/2, by + bh * 0.35, bw * 0.34, bh * 0.26, 0, 0, Math.PI * 2);
          ctx.fill();

          // Nos (spetsig)
          ctx.fillStyle = '#e88898';
          ctx.beginPath();
          ctx.arc(bx + bw/2, by + bh * 0.45, 6, 0, Math.PI * 2);
          ctx.fill();

          // Råttänder (stora gula tänder)
          ctx.fillStyle = '#ffe890';
          ctx.fillRect(bx + bw/2 - 5, by + bh * 0.48, 4, 9);
          ctx.fillRect(bx + bw/2 + 1, by + bh * 0.48, 4, 9);

          // Morrhår
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(bx + bw/2 - 8, by + bh * 0.44); ctx.lineTo(bx - 12, by + bh * 0.4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bx + bw/2 - 8, by + bh * 0.46); ctx.lineTo(bx - 10, by + bh * 0.48); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bx + bw/2 + 8, by + bh * 0.44); ctx.lineTo(bx + bw + 12, by + bh * 0.4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bx + bw/2 + 8, by + bh * 0.46); ctx.lineTo(bx + bw + 10, by + bh * 0.48); ctx.stroke();

          // Gyllene Kungakrona på huvudet!
          ctx.save();
          ctx.translate(bx + bw/2, by + bh * 0.12);
          ctx.fillStyle = '#ffd700';
          ctx.strokeStyle = '#c49a00';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-22, 4);
          ctx.lineTo(-22, -18);
          ctx.lineTo(-11, -8);
          ctx.lineTo(0, -24);
          ctx.lineTo(11, -8);
          ctx.lineTo(22, -18);
          ctx.lineTo(22, 4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Rubiner på kronans spetsar
          ctx.fillStyle = '#ff2222';
          ctx.beginPath(); ctx.arc(-22, -18, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(0, -24, 4.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(22, -18, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.restore();

        } else if (bType === 'cyber_dog') {
          // --- CYBER-HUND: Mechanical Cyber Hound ---
          // Jet-pack flammor bakpå
          const thrustFlicker = Math.random() * 8;
          ctx.save();
          ctx.fillStyle = 'rgba(0, 200, 255, 0.8)';
          ctx.shadowColor = '#00e1ff';
          ctx.shadowBlur = 16;
          const thrusterX = boss.velocityX > 0 ? bx - 14 : bx + bw + 14;
          ctx.beginPath();
          ctx.ellipse(thrusterX, by + bh * 0.45, 12 + thrustFlicker, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(thrusterX, by + bh * 0.45, 6, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Metallkropp med pansarplåtar
          const cyberGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
          cyberGrad.addColorStop(0, '#3a4454');
          cyberGrad.addColorStop(0.5, '#222834');
          cyberGrad.addColorStop(1, '#121620');
          ctx.fillStyle = cyberGrad;
          ctx.beginPath();
          ctx.roundRect(bx + 8, by + 12, bw - 16, bh - 20, 14);
          ctx.fill();
          ctx.strokeStyle = '#00e1ff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Neon-kretsbanor över kroppen
          ctx.strokeStyle = boss.phase === 2 ? '#ff00ff' : '#00e1ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx + 16, by + bh * 0.5);
          ctx.lineTo(bx + bw * 0.45, by + bh * 0.5);
          ctx.lineTo(bx + bw * 0.6, by + bh * 0.7);
          ctx.lineTo(bx + bw - 20, by + bh * 0.7);
          ctx.stroke();

          // Robothuvud
          ctx.fillStyle = '#2d3544';
          ctx.beginPath();
          ctx.roundRect(bx + bw * 0.15, by + bh * 0.15, bw * 0.7, bh * 0.4, 10);
          ctx.fill();
          ctx.stroke();

          // Spetsiga stålöron
          ctx.fillStyle = '#1c222e';
          ctx.beginPath();
          ctx.moveTo(bx + bw * 0.2, by + bh * 0.18);
          ctx.lineTo(bx + bw * 0.1, by - 12);
          ctx.lineTo(bx + bw * 0.35, by + bh * 0.16);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(bx + bw * 0.8, by + bh * 0.18);
          ctx.lineTo(bx + bw * 0.9, by - 12);
          ctx.lineTo(bx + bw * 0.65, by + bh * 0.16);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Digital scanning-visir (cyborg-ögon)
          const visorPulse = (Math.sin(Date.now() / 100) + 1) / 2;
          ctx.save();
          ctx.shadowColor = boss.phase === 2 ? '#ff0055' : '#00e1ff';
          ctx.shadowBlur = 18;
          ctx.fillStyle = boss.phase === 2 ? '#ff0055' : '#00e1ff';
          ctx.fillRect(bx + bw * 0.25, by + bh * 0.26, bw * 0.5, 10);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(bx + bw * 0.25 + visorPulse * (bw * 0.5 - 8), by + bh * 0.26, 8, 10);
          ctx.restore();

        } else if (bType === 'storm_eagle') {
          // --- STORM-ÖRN: Flying Thunder Raptor ---
          const wingFlap = Math.sin(Date.now() / 120) * 22;
          // Stora majestätiska vingar
          ctx.save();
          ctx.fillStyle = '#2a3a5e';
          ctx.strokeStyle = '#6ab4ff';
          ctx.lineWidth = 2.5;
          // Vänster vinge
          ctx.beginPath();
          ctx.moveTo(bx + bw * 0.2, by + bh * 0.4);
          ctx.quadraticCurveTo(bx - 40, by + bh * 0.1 - wingFlap, bx - 60, by + bh * 0.5 - wingFlap);
          ctx.lineTo(bx - 30, by + bh * 0.6);
          ctx.lineTo(bx + bw * 0.25, by + bh * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Höger vinge
          ctx.beginPath();
          ctx.moveTo(bx + bw * 0.8, by + bh * 0.4);
          ctx.quadraticCurveTo(bx + bw + 40, by + bh * 0.1 - wingFlap, bx + bw + 60, by + bh * 0.5 - wingFlap);
          ctx.lineTo(bx + bw + 30, by + bh * 0.6);
          ctx.lineTo(bx + bw * 0.75, by + bh * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // Fjäderkropp
          const eagleGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
          eagleGrad.addColorStop(0, '#364b73');
          eagleGrad.addColorStop(0.5, '#1e2d4a');
          eagleGrad.addColorStop(1, '#0e1828');
          ctx.fillStyle = eagleGrad;
          ctx.beginPath();
          ctx.ellipse(bx + bw/2, by + bh * 0.55, bw * 0.38, bh * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();

          // Vitt örnhuvud
          ctx.fillStyle = '#f0f4ff';
          ctx.beginPath();
          ctx.ellipse(bx + bw/2, by + bh * 0.28, bw * 0.3, bh * 0.24, 0, 0, Math.PI * 2);
          ctx.fill();

          // Vass krökt guldnäbb
          ctx.fillStyle = '#ffaa00';
          ctx.beginPath();
          const beakDir = boss.velocityX > 0 ? 1 : -1;
          ctx.moveTo(bx + bw/2, by + bh * 0.24);
          ctx.lineTo(bx + bw/2 + beakDir * 32, by + bh * 0.32);
          ctx.lineTo(bx + bw/2 + beakDir * 12, by + bh * 0.42);
          ctx.closePath();
          ctx.fill();

          // Blixtgnistor runt örnen
          if (Math.random() < 0.6) {
            ctx.strokeStyle = '#ffe600';
            ctx.lineWidth = 2;
            const sx = bx + Math.random() * bw;
            const sy = by + Math.random() * bh;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + (Math.random() - 0.5) * 25, sy + (Math.random() - 0.5) * 25);
            ctx.stroke();
          }

        } else if (bType === 'void_dragon') {
          // --- TOMRUMS-DRAKEN: Void Drake ---
          // Horn på huvudet
          ctx.fillStyle = '#1c0828';
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx + bw * 0.25, by + bh * 0.2);
          ctx.quadraticCurveTo(bx - 15, by - 15, bx + bw * 0.1, by - 28);
          ctx.quadraticCurveTo(bx + bw * 0.2, by - 10, bx + bw * 0.35, by + bh * 0.16);
          ctx.fill(); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(bx + bw * 0.75, by + bh * 0.2);
          ctx.quadraticCurveTo(bx + bw + 15, by - 15, bx + bw * 0.9, by - 28);
          ctx.quadraticCurveTo(bx + bw * 0.8, by - 10, bx + bw * 0.65, by + bh * 0.16);
          ctx.fill(); ctx.stroke();

          // Drakvingar
          const dWing = Math.sin(Date.now() / 180) * 12;
          ctx.fillStyle = 'rgba(100, 20, 140, 0.75)';
          ctx.beginPath();
          ctx.moveTo(bx + bw * 0.3, by + bh * 0.4);
          ctx.lineTo(bx - 45, by + bh * 0.1 - dWing);
          ctx.lineTo(bx - 30, by + bh * 0.45);
          ctx.lineTo(bx - 15, by + bh * 0.35);
          ctx.lineTo(bx + bw * 0.3, by + bh * 0.55);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(bx + bw * 0.7, by + bh * 0.4);
          ctx.lineTo(bx + bw + 45, by + bh * 0.1 - dWing);
          ctx.lineTo(bx + bw + 30, by + bh * 0.45);
          ctx.lineTo(bx + bw + 15, by + bh * 0.35);
          ctx.lineTo(bx + bw * 0.7, by + bh * 0.55);
          ctx.fill();

          // Drakens kropp med obsidianfjäll
          const voidGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
          voidGrad.addColorStop(0, '#3b0764');
          voidGrad.addColorStop(0.5, '#1e0533');
          voidGrad.addColorStop(1, '#0b0014');
          ctx.fillStyle = voidGrad;
          ctx.beginPath();
          ctx.roundRect(bx + 10, by + 12, bw - 20, bh - 16, 18);
          ctx.fill();
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Swirling void core i bröstet
          ctx.save();
          const coreRot = Date.now() / 300;
          ctx.translate(bx + bw/2, by + bh * 0.6);
          ctx.rotate(coreRot);
          ctx.fillStyle = '#c084fc';
          ctx.shadowColor = '#d8b4fe';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

        } else {
          // --- SKUGG-TITAN / DEFAULT: Ancient Shadow Titan ---
          // Skrovlig basaltsten-kropp med sprickor
          const titanGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
          titanGrad.addColorStop(0, '#363840');
          titanGrad.addColorStop(0.5, '#222329');
          titanGrad.addColorStop(1, '#111215');
          ctx.fillStyle = titanGrad;
          ctx.beginPath();
          ctx.roundRect(bx + 6, by + 8, bw - 12, bh - 12, 12);
          ctx.fill();
          ctx.strokeStyle = phaseColor;
          ctx.lineWidth = 3;
          ctx.stroke();

          // Glödande runiska sprickor
          ctx.strokeStyle = phaseColor;
          ctx.lineWidth = 2;
          ctx.shadowColor = phaseColor;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(bx + bw * 0.5, by + 16);
          ctx.lineTo(bx + bw * 0.45, by + bh * 0.35);
          ctx.lineTo(bx + bw * 0.6, by + bh * 0.55);
          ctx.lineTo(bx + bw * 0.5, by + bh * 0.85);
          ctx.moveTo(bx + bw * 0.45, by + bh * 0.35);
          ctx.lineTo(bx + bw * 0.25, by + bh * 0.45);
          ctx.moveTo(bx + bw * 0.6, by + bh * 0.55);
          ctx.lineTo(bx + bw * 0.8, by + bh * 0.6);
          ctx.stroke();

          // Svävande sten-knytnävar på sidorna
          const fistBob = Math.sin(Date.now() / 250) * 8;
          ctx.fillStyle = '#2a2b33';
          ctx.beginPath();
          ctx.roundRect(bx - 18, by + bh * 0.4 + fistBob, 18, 26, 6);
          ctx.fill(); ctx.stroke();
          ctx.beginPath();
          ctx.roundRect(bx + bw, by + bh * 0.4 - fistBob, 18, 26, 6);
          ctx.fill(); ctx.stroke();
        }

        // --- Bossens onda ögon (för alla bossar) ---
        if (bType !== 'cyber_dog') {
          const eyeY = by + bh * 0.3;
          ctx.fillStyle = 'white';
          ctx.beginPath(); ctx.arc(bx + bw * 0.3, eyeY, 11, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(bx + bw * 0.7, eyeY, 11, 0, Math.PI * 2); ctx.fill();
          // Pupill (följer spelaren)
          ctx.fillStyle = eyeGlowColor;
          ctx.shadowColor = eyeGlowColor;
          ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(bx + bw*0.3 + Math.cos(pAngle)*5, eyeY + Math.sin(pAngle)*5, 6, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(bx + bw*0.7 + Math.cos(pAngle)*5, eyeY + Math.sin(pAngle)*5, 6, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = 'black';
          ctx.beginPath(); ctx.arc(bx + bw*0.3 + Math.cos(pAngle)*5, eyeY + Math.sin(pAngle)*5, 2.5, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(bx + bw*0.7 + Math.cos(pAngle)*5, eyeY + Math.sin(pAngle)*5, 2.5, 0, Math.PI*2); ctx.fill();
          ctx.shadowBlur = 0;
        }
        
        ctx.restore();
        
        // The boss also carries a compact world-space nameplate so its health
        // reads while the camera is locked on the fight. It is deliberately
        // slim: the full-width bar at the top of the screen already carries the
        // numbers, and the old 400 px duplicate covered the boss art.
        // Exposed core: the reward window right after an attack. It glows gold
        // and literally shows the weak point the player should shoot.
        if (boss.coreExposed > 0 || boss.coreFlash > 0) {
          const glow = boss.coreFlash > 0 ? 1 : 0.45 + 0.3 * Math.sin((boss.auraAngle || 0) * 3);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = glow;
          const cx = bx + bw / 2;
          const cy = by + bh * 0.5;
          const core = ctx.createRadialGradient(cx, cy, 2, cx, cy, bw * 0.42);
          core.addColorStop(0, '#ffffff');
          core.addColorStop(0.32, '#ffd166');
          core.addColorStop(1, 'rgba(255,120,0,0)');
          ctx.fillStyle = core;
          ctx.beginPath();
          ctx.arc(cx, cy, bw * 0.42, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          if (boss.coreExposed > 0) {
            ctx.save();
            ctx.font = 'bold 10px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffe6a3';
            ctx.fillText(tr('KÄRNAN BLOTTAD · DUBBEL SKADA'), bx + bw / 2, by - 36);
            ctx.restore();
          }
        }

        // Phase 3 spells out which pattern is charging, on top of the ring.
        if (boss.telegraph > 0 && boss.pendingMove) {
          ctx.save();
          ctx.font = 'bold 11px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = boss.phase === 2 ? '#ff7bff' : '#ffd166';
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = 10;
          ctx.fillText(tr('VARNING · {m}', { m: boss.pendingMove.toUpperCase() }), bx + bw / 2, by + bh + 24);
          ctx.restore();
        }

        const hpBarW = Math.min(230, bw * 2.2);
        const hpBarX = bx + bw / 2 - hpBarW / 2;
        const hpBarY = by - 30;
        const plateW = hpBarW + 28;

        ctx.save();
        ctx.fillStyle = 'rgba(6, 10, 20, 0.62)';
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx + bw / 2 - plateW / 2, hpBarY - 20, plateW, 35, 9);
        ctx.fill();
        ctx.stroke();

        // Boss name, on its own line above the bar.
        ctx.font = 'bold 12px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = phaseColor;
        ctx.shadowColor = phaseColor;
        ctx.shadowBlur = 8;
        ctx.fillText(boss.name, bx + bw / 2, hpBarY - 8);
        ctx.shadowBlur = 0;

        // HP-bar background
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.roundRect(hpBarX, hpBarY, hpBarW, 8, 4);
        ctx.fill();

        // HP-bar gradient
        const hpGrad = ctx.createLinearGradient(hpBarX, 0, hpBarX + hpBarW, 0);
        hpGrad.addColorStop(0, '#ff2222');
        hpGrad.addColorStop(0.5, phaseColor);
        hpGrad.addColorStop(1, '#ffaa00');
        ctx.fillStyle = hpGrad;
        ctx.shadowColor = phaseColor;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.roundRect(hpBarX + 1, hpBarY + 1, Math.max(0, (hpBarW - 2) * hpPct), 6, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Draw Fishes (Yellow/Gold Fish) - Now drawn after background and platforms
      game.fishes.forEach((f: any) => {
        if (f.collected) return;

        const fxs = f.x - game.scrollX;

        // Skip if off screen
        if (fxs < -50 || fxs > canvas.width + 50) return;

        const fx = fxs;
        const fy = f.y;
        const fw = f.width;
        const fh = f.height;

        // Golden koi collectible: warm body gradient, waving tail and a soft
        // halo. It has to read instantly against bright skies and dark caves.
        const fx2 = fx + fw / 2;
        const fy2 = fy + fh / 2;
        const swim = Math.sin(Date.now() / 260 + (f.hoverOffset || 0)) * 0.16;

        ctx.save();
        // Halo
        // Pulsing neon bloom so the pickup glows instead of just sitting there.
        const haloR = 32 + Math.sin(Date.now() / 340 + (f.hoverOffset || 0)) * 4;
        const halo = ctx.createRadialGradient(fx2, fy2, 1, fx2, fy2, haloR);
        halo.addColorStop(0, 'rgba(255, 226, 140, 0.65)');
        halo.addColorStop(0.5, 'rgba(255, 186, 72, 0.24)');
        halo.addColorStop(1, 'rgba(255, 186, 72, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(fx2, fy2, haloR, 0, Math.PI * 2);
        ctx.fill();

        ctx.translate(fx2, fy2);
        ctx.rotate(swim);

        // Tail fin, a two-lobed fan that trails the body.
        ctx.beginPath();
        ctx.moveTo(-fw * 0.36, 0);
        ctx.quadraticCurveTo(-fw * 0.72, -fh * 0.95, -fw * 0.95, -fh * 0.22);
        ctx.quadraticCurveTo(-fw * 0.62, 0, -fw * 0.95, fh * 0.62);
        ctx.quadraticCurveTo(-fw * 0.7, fh * 0.9, -fw * 0.36, 0);
        ctx.closePath();
        const tailGrad = ctx.createLinearGradient(-fw * 0.9, 0, -fw * 0.3, 0);
        tailGrad.addColorStop(0, '#ffcf6b');
        tailGrad.addColorStop(1, '#ff9d3c');
        ctx.fillStyle = tailGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,60,10,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Dorsal fin
        ctx.fillStyle = '#ffbe55';
        ctx.beginPath();
        ctx.moveTo(-fw * 0.06, -fh * 0.52);
        ctx.quadraticCurveTo(fw * 0.16, -fh * 1.05, fw * 0.3, -fh * 0.42);
        ctx.closePath();
        ctx.fill();

        // Body
        const bodyGrad = ctx.createLinearGradient(0, -fh * 0.6, 0, fh * 0.6);
        bodyGrad.addColorStop(0, '#fff3c4');
        bodyGrad.addColorStop(0.42, '#ffd166');
        bodyGrad.addColorStop(0.8, '#ff9f1c');
        bodyGrad.addColorStop(1, '#f0791a');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, fw * 0.52, fh * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(130,70,10,0.4)';
        ctx.lineWidth = 1.1;
        ctx.stroke();

        // Belly highlight
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.ellipse(fw * 0.06, fh * 0.22, fw * 0.3, fh * 0.18, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#fffdf4';
        ctx.beginPath();
        ctx.arc(fw * 0.26, -fh * 0.2, 3.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#241505';
        ctx.beginPath();
        ctx.arc(fw * 0.29, -fh * 0.2, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(fw * 0.3, -fh * 0.26, 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Scale arcs, subtle
        ctx.strokeStyle = 'rgba(170,90,10,0.28)';
        ctx.lineWidth = 0.9;
        for (let s = 0; s < 2; s++) {
          ctx.beginPath();
          ctx.arc(-fw * 0.02 - s * 5, 0, fh * 0.42, -0.9, 0.9);
          ctx.stroke();
        }

        // Tiny sparkle
        const sp = (Math.sin(Date.now() / 320 + (f.hoverOffset || 0)) + 1) / 2;
        ctx.fillStyle = `rgba(255,255,255,${0.35 + sp * 0.55})`;
        ctx.beginPath();
        ctx.arc(fw * 0.1, -fh * 0.5, 1.2 + sp, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Power-up pickups. Each type has its own colour and glyph so it can be
      // identified from a distance; a soft ground pad anchors it in the world.
      game.pickups.forEach((pk: any) => {
        if (pk.collected) return;
        const pkx = pk.x - game.scrollX;
        if (pkx < -60 || pkx > canvas.width + 60) return;
        const pky = pk.y;
        const cx = pkx + pk.width / 2;
        const cy = pky + pk.height / 2;
        const palette: Record<string, [string, string]> = {
          shield: ['#7ee7ff', '#2b8bd8'],
          magnet: ['#ffd166', '#e09b24'],
          rapid: ['#ff9d6b', '#e85d2c'],
          heart: ['#ff7fa2', '#d93a63'],
          ammo: ['#a8b8ff', '#5566d8'],
        };
        const [light, dark] = palette[pk.type] || palette.shield;

        // Ground glow pad
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(pk.hover * 2);
        const pad = ctx.createRadialGradient(cx, pky + pk.height + 4, 0, cx, pky + pk.height + 4, 30);
        pad.addColorStop(0, light);
        pad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pad;
        ctx.beginPath();
        ctx.ellipse(cx, pky + pk.height + 4, 30, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Orbiting sparkle ring
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(pk.spin * 0.4);
        ctx.strokeStyle = light;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Capsule body
        ctx.save();
        ctx.translate(cx, cy);
        ctx.shadowColor = light;
        ctx.shadowBlur = 18;
        const body = ctx.createLinearGradient(0, -16, 0, 16);
        body.addColorStop(0, light);
        body.addColorStop(1, dark);
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.roundRect(-16, -16, 32, 32, 11);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Glossy top highlight
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath();
        ctx.roundRect(-11, -12, 22, 9, 5);
        ctx.fill();

        // Glyphs, drawn from primitives (no font dependency on canvas). White
        // on the saturated capsule reads far better than a dark cut-out.
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(8,16,30,0.55)';
        ctx.shadowBlur = 3;
        if (pk.type === 'shield') {
          ctx.beginPath();
          ctx.moveTo(0, -10);
          ctx.lineTo(9, -6);
          ctx.lineTo(9, 2);
          ctx.quadraticCurveTo(9, 9, 0, 12);
          ctx.quadraticCurveTo(-9, 9, -9, 2);
          ctx.lineTo(-9, -6);
          ctx.closePath();
          ctx.fill();
        } else if (pk.type === 'magnet') {
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(0, 1, 8, Math.PI, 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-8, 1); ctx.lineTo(-8, 9);
          ctx.moveTo(8, 1); ctx.lineTo(8, 9);
          ctx.stroke();
        } else if (pk.type === 'rapid') {
          ctx.beginPath();
          ctx.moveTo(3, -11);
          ctx.lineTo(-7, 1);
          ctx.lineTo(-1, 1);
          ctx.lineTo(-3, 11);
          ctx.lineTo(8, -2);
          ctx.lineTo(2, -2);
          ctx.closePath();
          ctx.fill();
        } else if (pk.type === 'heart') {
          ctx.beginPath();
          ctx.moveTo(0, 9);
          ctx.bezierCurveTo(-13, 0, -8, -10, 0, -4);
          ctx.bezierCurveTo(8, -10, 13, 0, 0, 9);
          ctx.fill();
        } else {
          // Ammo crate: two stacked slugs
          ctx.roundRect(-7, -8, 14, 16, 3);
          ctx.fill();
          ctx.fillStyle = light;
          ctx.fillRect(-4, -5, 3, 10);
          ctx.fillRect(1, -5, 3, 10);
        }
        ctx.restore();
      });

      // Draw coins - count collected
      let collectedCountInFrame = 0;
      game.fishes.forEach((f: any) => {
        if (f.collected) collectedCountInFrame++;
      });

      // Goal Logic - check if player can complete level
      const allFishesCollected = collectedCountInFrame === game.fishes.length;
      const fishGoalMet = collectedCountInFrame >= (game.fishGoal ?? game.fishes.length);
      const bossCleared = !game.boss || game.boss.hp <= 0;
      const overlapsGoal = game.player.x < game.jerry.x + game.jerry.width && game.player.x + game.player.width > game.jerry.x && game.player.y < game.jerry.y + game.jerry.height && game.player.y + game.player.height > game.jerry.y;
      if (overlapsGoal) {
        if (fishGoalMet && bossCleared) {
          game.running = false;
          // Compared against the lives this level started with, not the React
          // copy captured when the loop was created (which never updated).
          const perfectLevel = game.lives === (game.startLives ?? game.lives);
          const perfectBonus = perfectLevel ? 500 : 0;
          const noHitBonus = game.noHit ? 750 : 0;
          const nearMissBonus = (game.nearMisses || 0) * 25;
          // Every fish on the board is worth reaching for even after the quota
          // is met, so a clean sweep still feels like a win.
          const fullCatchBonus = allFishesCollected ? 400 : 0;
          game.levelsCompletedInRun = (game.levelsCompletedInRun || 0) + 1;
          game.score += 1000 + perfectBonus + noHitBonus + nearMissBonus + fullCatchBonus;
          if (fullCatchBonus > 0) pushToast(game, tr('ALLA FISKAR! +{n}', { n: fullCatchBonus }), '#ffd166');
          if (noHitBonus > 0) pushToast(game, tr('OHIT! +750'), '#2bee79');
          if (nearMissBonus > 0) pushToast(game, tr('{a} NÄSTAN! +{b}', { a: game.nearMisses, b: nearMissBonus }), '#7ef7c2');
          awardCoins(game, 25 + (perfectLevel ? 15 : 0) + (game.noHit ? 15 : 0));
          grantXp(game, 150);
          persistRunSummary(game, perfectLevel);
          setTotalScore(game.score);
          AudioEngine.playLevelUp();
          haptic('levelUp', progress.settings.haptics);
          const summary = {
            score: game.score,
            perfect: perfectLevel,
            noHit: !!game.noHit,
            nearMisses: game.nearMisses || 0,
            streak: game.bestStreak || 0,
            runLevel: game.runLevel || 1,
            coins: game.coinsThisLevel || 0,
            boss: !!game.bossDefeatedInRun,
            kills: game.killsThisLevel || 0,
            time: Math.round((game.levelSeconds || 0)),
            levelType: game.levelType,
            lifeBonus: levelLifeBonus(game),
          };
          setLevelSummary({ ...summary, grade: getGrade(summary) });
          // Seeded offer: restarting this level always shows the same 3 cards.
          setPerkOffer(game.perkOffer || []);
          setPerkChoice(null);
          AudioEngine.playGrade();
          // Normal runs and the Continue entry advance the campaign checkpoint;
          // a quick Daily Run from level 29 must not unlock the whole story. The
          // guard lives in the progress context, where the live checkpoint is.
          advanceCampaign(currentLevel + 1, startLevel);
          setShowLevelComplete(true);
        }
        else { game.showFishWarning = true; }
      } else { game.showFishWarning = false; }

      // Goal - Detailed Jerry the mouse (Tom & Jerry style)
      const jx = game.jerry.x - game.scrollX; const jy = game.jerry.y; const jw = game.jerry.width; const jh = game.jerry.height;

      // Jerry - Animerad söt mus
      const jerryBounce = Math.sin(Date.now() / 300) * 4; // Hoppar upp och ner
      const jxs = game.jerry.x - game.scrollX;
      const jy2 = game.jerry.y + jerryBounce;
      const jw2 = game.jerry.width;
      const jh2 = game.jerry.height;

      if (jxs > -60 && jxs < canvas.width + 60) {
        // Guldgul aura
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.15 * Math.sin(Date.now() / 200);
        const jerryAura = ctx.createRadialGradient(jxs + jw2/2, jy2 + jh2/2, 0, jxs + jw2/2, jy2 + jh2/2, 50);
        jerryAura.addColorStop(0, '#ffd700');
        jerryAura.addColorStop(1, 'transparent');
        ctx.fillStyle = jerryAura;
        ctx.beginPath();
        ctx.arc(jxs + jw2/2, jy2 + jh2/2, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // Kropp (oval, mörk orange-brun)
        ctx.fillStyle = '#c47a2a';
        ctx.beginPath();
        ctx.ellipse(jxs + jw2/2, jy2 + jh2/2, jw2/2, jh2/2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Mage (ljusare)
        ctx.fillStyle = '#e8a060';
        ctx.beginPath();
        ctx.ellipse(jxs + jw2/2, jy2 + jh2/2 + 4, jw2/3, jh2/3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Huvud
        ctx.fillStyle = '#c47a2a';
        ctx.beginPath();
        ctx.arc(jxs + jw2/2, jy2 + jh2 * 0.22, jw2 * 0.38, 0, Math.PI * 2);
        ctx.fill();
        
        // Öron (stora, runda)
        ctx.fillStyle = '#c47a2a';
        ctx.beginPath();
        ctx.ellipse(jxs + jw2 * 0.25, jy2 + jh2 * 0.05, jw2 * 0.2, jh2 * 0.22, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(jxs + jw2 * 0.75, jy2 + jh2 * 0.05, jw2 * 0.2, jh2 * 0.22, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e89080';
        ctx.beginPath();
        ctx.ellipse(jxs + jw2 * 0.25, jy2 + jh2 * 0.05, jw2 * 0.12, jh2 * 0.15, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(jxs + jw2 * 0.75, jy2 + jh2 * 0.05, jw2 * 0.12, jh2 * 0.15, 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        // Ögon (stora, glada)
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(jxs + jw2 * 0.38, jy2 + jh2 * 0.22, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(jxs + jw2 * 0.62, jy2 + jh2 * 0.22, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222244';
        ctx.beginPath(); ctx.arc(jxs + jw2 * 0.38, jy2 + jh2 * 0.22, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(jxs + jw2 * 0.62, jy2 + jh2 * 0.22, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(jxs + jw2 * 0.39, jy2 + jh2 * 0.20, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(jxs + jw2 * 0.63, jy2 + jh2 * 0.20, 1.5, 0, Math.PI * 2); ctx.fill();
        
        // Nos (rosa, liten)
        ctx.fillStyle = '#cc7799';
        ctx.beginPath(); ctx.arc(jxs + jw2/2, jy2 + jh2 * 0.3, 2.5, 0, Math.PI * 2); ctx.fill();
        
        // Morrhår
        ctx.strokeStyle = 'rgba(100,70,40,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(jxs + jw2 * 0.32, jy2 + jh2 * 0.3); ctx.lineTo(jxs + jw2 * 0.05, jy2 + jh2 * 0.27); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(jxs + jw2 * 0.32, jy2 + jh2 * 0.31); ctx.lineTo(jxs + jw2 * 0.05, jy2 + jh2 * 0.33); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(jxs + jw2 * 0.68, jy2 + jh2 * 0.3); ctx.lineTo(jxs + jw2 * 0.95, jy2 + jh2 * 0.27); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(jxs + jw2 * 0.68, jy2 + jh2 * 0.31); ctx.lineTo(jxs + jw2 * 0.95, jy2 + jh2 * 0.33); ctx.stroke();
        
        // Svans
        ctx.strokeStyle = '#b06020';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        const tailWig = Math.sin(Date.now() / 200) * 8;
        ctx.beginPath();
        ctx.moveTo(jxs + jw2, jy2 + jh2 * 0.7);
        ctx.bezierCurveTo(jxs + jw2 + 15, jy2 + jh2 * 0.8 + tailWig, jxs + jw2 + 20, jy2 + jh2 * 0.5, jxs + jw2 + 10, jy2 + jh2 * 0.3);
        ctx.stroke();
        
        // "RÄDDAS!" text med animation
        const textBob = Math.sin(Date.now() / 400) * 3;
        ctx.font = 'bold 11px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffa500';
        ctx.shadowBlur = 8;
        ctx.fillText(tr('RÄDDAS! ⭐'), jxs + jw2/2, jy2 - 18 + textBob);
        ctx.shadowBlur = 0;
      }
      if (game.showFishWarning) {
        ctx.fillStyle = '#ee2b2b'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
        const needBoss = game.boss && game.boss.hp > 0;
        const missingFish = Math.max(0, (game.fishGoal ?? game.fishes.length) - collectedCountInFrame);
        ctx.fillText(
          needBoss
            ? tr('BESEGRA BOSS · {n} FISKAR KVAR', { n: missingFish })
            : tr('SAMLA {n} FISKAR TILL!', { n: missingFish }),
          jx + jw / 2,
          jy - 15,
        );
      }

      drawGhost(ctx, game);

      // Meteors: a burning rock with a long tail, drawn in world space so it
      // reads as a physical object falling through the level.
      (game.meteors || []).forEach((m: any) => {
        const mx = m.x - game.scrollX;
        if (mx < -120 || mx > canvas.width + 120) return;
        ctx.save();
        const tail = ctx.createLinearGradient(mx, m.y - 90, mx, m.y);
        tail.addColorStop(0, 'rgba(255,120,40,0)');
        tail.addColorStop(1, 'rgba(255,190,90,0.85)');
        ctx.strokeStyle = tail;
        ctx.lineWidth = m.r * 1.15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(mx - 6, m.y - 90);
        ctx.lineTo(mx, m.y);
        ctx.stroke();
        ctx.fillStyle = '#ff8f43';
        ctx.strokeStyle = '#3a1a10';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(mx, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(mx - m.r * 0.25, m.y - m.r * 0.25, m.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Player
      // Squash and stretch scale around the cat's feet so it never floats off the floor.
      const bodyScaleY = game.player.squash * game.player.stretch;
      const bodyScaleX = 1 / Math.max(0.35, bodyScaleY);
      const pw = game.player.width * bodyScaleX;
      const ph = game.player.height * bodyScaleY;
      const px = game.player.x - game.scrollX - (pw - game.player.width) / 2;
      const py = game.player.y + (game.player.height - ph);

      // Dash afterimages
      game.player.trail.forEach((t: any) => {
        const alpha = (t.life / t.maxLife) * 0.35;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = t.shadow ? '#a855f7' : '#2bee79';
        ctx.beginPath();
        ctx.ellipse(t.x - game.scrollX - pw / 2, t.y - ph / 2, pw * 0.42, ph * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Landing ring: a thin, expanding ellipse that fades in a quarter second.
      if (game.landRing && game.landRing.life > 0) {
        const lr = game.landRing;
        lr.life--;
        const k = 1 - lr.life / 14;
        ctx.save();
        ctx.globalAlpha = (1 - k) * 0.55;
        ctx.strokeStyle = worldPal.groundRim;
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath();
        ctx.ellipse(lr.x - game.scrollX, lr.y, lr.r * (0.5 + k * 1.6), lr.r * (0.14 + k * 0.4), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Contact shadow keeps the cat glued to the platform instead of floating.
      // Only drawn while the cat is actually on the ground/grass - it must not
      // linger under the cat mid-jump.
      if (game.player.onGround) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.26)';
        ctx.beginPath();
        // Sized to the atlas cat's drawn width (66 px) rather than the hitbox.
        ctx.ellipse(px + pw / 2, py + ph + 3, 33, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      const shifted = game.shadowActive > 0;
      if (shifted) ctx.globalAlpha = 0.84;
      else if (game.player.invincible) ctx.globalAlpha = 0.55 + 0.45 * Math.sin(Date.now() / 55);
      // One hero cat everywhere: the same articulated cartoon drawing as the
      // menus, the shop and the attract loop. The origin is the paw line
      // (py + ph), so the cat stands on the exact top of the platform.
      //
      // The baked 3D render that used to be drawn here was dark, low-contrast
      // and nearly the same value as the new ground, so the hero read as a
      // smudge at the bottom of the screen. The vector cat is the deliberate
      // art direction: thick outlines, big eyes, bright fur - it pops against
      // every biome.
      const catFacing: 1 | -1 = game.player.facing === -1 ? -1 : 1;
      const catGrounded = !!game.player.onGround;
      const catSpeed = game.player.velocityX || 0;
      const catScale = 1.42;
      drawCatSprite(ctx, px + pw / 2, py + ph, {
        color: shifted ? '#8b5cf6' : game.player.color,
        accent: shifted ? '#f3e8ff' : game.player.accent,
        t: Date.now() / 1000,
        running: Math.abs(catSpeed) > 0.4 && catGrounded,
        jumping: !catGrounded,
        grounded: catGrounded,
        speed: catSpeed,
        vy: game.player.velocityY || 0,
        phase: game.player.runCycle || 0,
        dashing: (game.player.dashing || 0) > 0,
        blinking: !!game.player.isBlinking,
        // The blaster flashes for a few frames after each shot.
        shooting: (game.shootCooldown || 0) > 6,
        facing: catFacing,
        // The drawing is about 46 x 46 at scale 1 (paws at y = 0, ear tips at
        // y = -46). Scale it up so the hero has real presence inside the same
        // 50 x 70 hitbox - the collision code is untouched.
        sx: catScale,
        sy: catScale * 1.04,
      });
      ctx.restore();

      // Shadow Shift reads as a different character, not just a HUD number:
      // a violet bloom, a broken orbit ring and a fading purple afterimage.
      if (shifted) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 110);
        const gx = px + pw / 2;
        const gy = py + ph / 2;
        ctx.save();
        const glow = ctx.createRadialGradient(gx, gy, 3, gx, gy, 78 + pulse * 12);
        glow.addColorStop(0, 'rgba(168, 85, 247, 0.5)');
        glow.addColorStop(0.55, 'rgba(109, 40, 217, 0.18)');
        glow.addColorStop(1, 'rgba(109, 40, 217, 0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(gx, gy, 90 + pulse * 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `rgba(216, 180, 254, ${0.45 + pulse * 0.45})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([9, 6]);
        ctx.lineDashOffset = -Date.now() / 40;
        ctx.beginPath();
        ctx.ellipse(gx, gy, pw * 1.05, ph * 0.82, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Buff auras. Shield is a solid bubble; magnet and rapid fire get a thin
      // coloured ring that pulses so the active timers are readable in-world.
      if (game.shield) {
        ctx.save();
        const shieldPulse = 0.5 + 0.2 * Math.sin(Date.now() / 180);
        ctx.strokeStyle = `rgba(126, 231, 255, ${shieldPulse + 0.25})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#7ee7ff';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.ellipse(px + pw / 2, py + ph / 2, pw * 0.86, ph * 0.66, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(126, 231, 255, ${0.06 + 0.03 * Math.sin(Date.now() / 220)})`;
        ctx.fill();
        ctx.restore();
      }
      if (game.buffs.magnet > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.55)';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 7]);
        ctx.lineDashOffset = -Date.now() / 90;
        ctx.beginPath();
        ctx.ellipse(px + pw / 2, py + ph / 2, pw * 0.95, ph * 0.75, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (game.buffs.rapid > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 157, 107, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = Date.now() / 70;
        ctx.beginPath();
        ctx.ellipse(px + pw / 2, py + ph / 2, pw * 1.02, ph * 0.8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Draw Particles
      ctx.globalCompositeOperation = 'lighter';
      game.particles.forEach((p: any) => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x - game.scrollX, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';

      // Draw Floating Texts
      ctx.font = 'bold 24px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      game.floatingTexts.forEach((t: any) => {
        ctx.fillStyle = t.color;
        ctx.globalAlpha = Math.min(1, t.life / 25);
        ctx.fillText(t.text, t.x - game.scrollX, t.y);
      });
      ctx.globalAlpha = 1;

      // In-canvas celebration toasts
      game.toasts.forEach((t: any, i: number) => {
        const lifePct = t.life / t.maxLife;
        const pop = lifePct > 0.85 ? (1 - lifePct) / 0.15 : 1;
        const alpha = lifePct < 0.25 ? lifePct / 0.25 : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        // Below the HTML HUD and boss bar, so celebration banners never sit on
        // top of the health bar during a boss fight.
        ctx.translate(canvas.width / 2, canvas.height * 0.34 + i * 44);
        ctx.scale(0.9 + pop * 0.1, 0.9 + pop * 0.1);
        ctx.font = 'bold 26px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        const w = ctx.measureText(t.text).width + 44;
        ctx.fillStyle = 'rgba(6, 10, 24, 0.82)';
        ctx.beginPath();
        const r = 14;
        const x0 = -w / 2, y0 = -22, ww = w, hh = 40;
        ctx.moveTo(x0 + r, y0);
        ctx.lineTo(x0 + ww - r, y0); ctx.quadraticCurveTo(x0 + ww, y0, x0 + ww, y0 + r);
        ctx.lineTo(x0 + ww, y0 + hh - r); ctx.quadraticCurveTo(x0 + ww, y0 + hh, x0 + ww - r, y0 + hh);
        ctx.lineTo(x0 + r, y0 + hh); ctx.quadraticCurveTo(x0, y0 + hh, x0, y0 + hh - r);
        ctx.lineTo(x0, y0 + r); ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
        ctx.fill();
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, 0, 7);
        ctx.restore();
      });

      // Cinematic grade: warm light from the sun side, cool shadow on the
      // opposite edge. A single overlay pass ties all the hand-drawn elements
      // into one palette without dimming the action.
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      const grade = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      if (isNight) {
        grade.addColorStop(0, 'rgba(90,130,220,0.10)');
        grade.addColorStop(0.55, 'rgba(20,30,80,0.02)');
        grade.addColorStop(1, 'rgba(5,10,30,0.18)');
      } else if (isGolden) {
        // Warm light pours in from the sun side; the opposite corner cools to
        // violet. This is the pass that makes the whole frame feel like dusk.
        grade.addColorStop(0, 'rgba(255,170,110,0.16)');
        grade.addColorStop(0.55, 'rgba(255,210,160,0.03)');
        grade.addColorStop(1, 'rgba(60,20,80,0.16)');
      } else {
        // Cyan-to-magenta wash keeps daylight stages inside the neon palette.
        grade.addColorStop(0, 'rgba(120,235,255,0.06)');
        grade.addColorStop(0.5, 'rgba(255,255,255,0)');
        grade.addColorStop(1, 'rgba(170,90,255,0.07)');
      }
      ctx.fillStyle = grade;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Vignette so the eye lands on the cat
      const vignette = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.35,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.85
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Lightning is drawn in world space, underneath the rain, so the drops
      // read as falling in front of a strike behind them.
      drawLightning(ctx, game, isReducedMotion(progress.settings.reduceMotion));

      // Weather Particles Rendering
      if (game.weather === 'REGNIGT' || game.weather === 'STORMIGT') {
        ctx.strokeStyle = game.timeOfDay === 'DAY' ? 'rgba(100, 100, 150, 0.4)' : 'rgba(174, 194, 224, 0.5)';
        ctx.lineWidth = 1;
        game.weatherParticles.slice(0, weatherBudget).forEach((p: any) => {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 2, p.y + p.length);
          ctx.stroke();
        });
      } else if (game.weather === 'SNÖIGT') {
        ctx.fillStyle = game.timeOfDay === 'DAY' ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.9)';
        game.weatherParticles.slice(0, weatherBudget).forEach((p: any) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (game.weather === 'DIMMIGT') {
        game.weatherParticles.slice(0, weatherBudget).forEach((p: any) => {
          const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
          const fogColor = game.timeOfDay === 'DAY' ? '255, 255, 255' : '200, 200, 200';
          grd.addColorStop(0, `rgba(${fogColor}, ${p.opacity})`);
          grd.addColorStop(1, `rgba(${fogColor}, 0)`);
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        });
        // Extra overlay for haze
        ctx.fillStyle = game.timeOfDay === 'DAY' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // The strike lights the whole frame, rain included, then falls away.
      if (game.lightning && game.lightning.flash > 0) {
        const f = game.lightning.flash;
        // A day sky is already near white, so it takes a much lighter wash to
        // read as a flash instead of fogging the whole frame.
        const wash = (game.timeOfDay === 'DAY' ? 0.13 : 0.26) * (isReducedMotion(progress.settings.reduceMotion) ? 0.4 : 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(150, 185, 255, ${0.12 * f})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        ctx.fillStyle = `rgba(232, 242, 255, ${wash * f})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Fireflies on night stages. They drift against the camera at half speed,
      // so they read as a near layer without ever hinting at a collision. Their
      // soft pulse gives the empty night sky something alive to watch.
      if (isNight && !isReducedMotion(progress.settings.reduceMotion)) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const span = canvas.width + 240;
        for (let i = 0; i < 26; i++) {
          const drift = timeSec * (6 + skyHashNoise(i * 3.3) * 14);
          const world = i * 173 + drift + Math.sin(timeSec * 0.7 + i) * 28;
          const sx = (((world - game.scrollX * 0.45) % span) + span) % span - 120;
          const sy = game.groundY - 24 - skyHashNoise(i * 7.1) * 205 + Math.sin(timeSec * 1.3 + i * 2) * 12;
          const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(timeSec * 1.8 + i));
          ctx.fillStyle = `rgba(180, 255, 140, ${0.18 * pulse})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 3.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(224, 255, 180, ${0.85 * pulse})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.restore();

      // Bright-pass bloom first, then the filmic grade on top. The bloom is
      // what makes the neon windows, fish and muzzle flashes feel like light
      // rather than paint.
      const cinematic = progress.settings.cinematicEffects !== false;
      if (q.bloom && cinematic && !isReducedMotion(progress.settings.reduceMotion)) {
        drawBloom(ctx, canvas, isNight ? 0.18 : 0.1);
      }

      // Screen-space finish: volumetric light, ground mist, vignette and a
      // whisper of grain. It sits under the HTML HUD, so the interface keeps
      // its crisp contrast while the world gains a filmic grade.
      if (q.atmosphere && cinematic) {
        drawAtmosphere(ctx, {
          width: canvas.width,
          height: canvas.height,
          time: timeSec,
          isNight,
          isGolden,
          weather: game.weather,
          reducedMotion: isReducedMotion(progress.settings.reduceMotion),
          groundY: game.groundY,
        });
      }

      // Throttle React state updates to prevent infinite loops and improve performance
      if (Date.now() - game.lastStatUpdate > 250) {
        setStats({
          score: game.score, progress: Math.min(100, Math.floor((game.player.x / game.levelLength) * 100)),
          collectedCount: collectedCountInFrame, totalFish: game.fishes.length, fishGoal: game.fishGoal ?? game.fishes.length, ammo: game.ammo,
          weather: game.weather,
          intensity: game.intensity,
          timeOfDay: game.timeOfDay,
          combo: game.combo || 0,
          levelType: game.levelType,
          timer: game.levelTimer || 0,
          miniEvent: game.miniEvent?.active ? game.miniEvent.type : 'NONE',
          twist: game.twist?.id || 'none',
          twistAccent: game.twist?.accent || '#7ee7ff',
          surprise: game.surprise ? game.surprise.id : null,
          surpriseName: game.surprise ? EVENTS[game.surprise.id].name : '',
          surpriseIcon: game.surprise ? EVENTS[game.surprise.id].icon : 'bolt',
          surpriseAccent: game.surprise ? EVENTS[game.surprise.id].accent : '#7ee7ff',
          surpriseProgress: game.surprise ? game.surprise.progress : 0,
          xp: game.xp || 0,
          runLevel: game.runLevel || 1,
          xpNeeded: game.xpNeeded || 120,
          multiplier: game.multiplier || 1,
          streak: game.streak || 0,
          dashReady: game.player.dashCooldown <= 0,
          dashPct: Math.max(0, 1 - game.player.dashCooldown / 45),
          comboTimer: game.comboTimer || 0,
          noHit: !!game.noHit,
          nearMisses: game.nearMisses || 0,
          shadowCharge: game.shadowCharge || 0,
          shadowActive: game.shadowActive || 0,
          shadowPasses: game.shadowPasses || 0,
          toasts: game.toasts || [],
          bossHp: game.boss?.hp || 0,
          bossMaxHp: game.boss?.maxHp || 0,
          bossVisible: !!game.boss && game.boss.hp > 0 && Math.abs(game.boss.x - game.player.x) < canvas.width * 0.8,
          bossName: game.boss?.name || '',
          bossPhase: game.boss?.phase || 0,
          xpIntoLevel: game.xpIntoLevel || 0,
          shield: !!game.shield,
          magnet: game.buffs?.magnet || 0,
          rapid: game.buffs?.rapid || 0,
          coinsRun: game.coinsThisLevel || 0,
          goalDist: Math.max(0, Math.round((game.jerry.x - game.player.x) / 40)),
          // Side of the nearest uncollected fish (-1 behind, 1 ahead, 0 none), so a missed fish is findable.
          fishDir: (() => {
            let best: any = null;
            for (const f of game.fishes) if (!f.collected && (!best || Math.abs(f.x - game.player.x) < Math.abs(best.x - game.player.x))) best = f;
            return best ? (best.x < game.player.x - 40 ? -1 : best.x > game.player.x + 40 ? 1 : 0) : 0;
          })(),
        });
        setLives(game.lives);
        setTotalScore(game.score);
        setCombo(game.combo || 0);
        game.lastStatUpdate = Date.now();
      }
    };

    const loop = (now: number) => {
      if (!game.running) return;
      const elapsed = now - previousFrameTime;
      previousFrameTime = now;
      game.quality = qualityRef.current.sample(elapsed, progress.settings.autoQuality !== false);
      // Cap the debt at a few steps so a stalled frame or a backgrounded tab
      // cannot make the level fast-forward when it resumes.
      accumulatedTime = Math.min(accumulatedTime + Math.max(0, elapsed), FIXED_STEP_MS * 5);
      while (accumulatedTime >= FIXED_STEP_MS) {
        accumulatedTime -= FIXED_STEP_MS;
        simulate();
        if (!game.running) return;
      }
      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);

    return () => {
      game.running = false;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousedown', handleMouseDown);

      if (isTouchDevice) {
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
      }

      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevel, isTouchDevice, runId]);

  // Room the on-screen buttons need. The stage has to shrink by exactly this
  // much, otherwise the controls get pushed under the fold and a landscape
  // phone has no way to move at all.
  const touchControlsVisible = isTouchDevice && !showLevelComplete;
  // Includes the row's own padding and the gap above it, so the stage can use
  // every remaining pixel without the flexbox shrinking it behind our back.
  const reservedForControls = touchControlsVisible ? (isPortrait ? 152 : 84) : 12;
  // A portrait phone letterboxes the 16:9 stage, so centring it would leave the
  // thumb buttons floating in the middle of the screen. Pin the stage to the
  // top and let the controls sit at the bottom where thumbs expect them.
  // A phone turned sideways gets the whole screen: stage fills it and the
  // buttons float over the corners instead of eating a strip underneath.
  const immersive = isFullscreen || (isTouchDevice && isMobile && !isPortrait);
  const stackControlsAtBottom = isMobile && !immersive && touchControlsVisible;

  return (
    <div
      dir="ltr"
      className={`flex w-full flex-col items-center overflow-hidden animate-fade-in-up ${
        immersive
          ? 'fixed inset-0 z-[100] justify-center gap-3 bg-background-dark px-2 py-2 md:gap-5 md:py-4'
          : isMobile
            ? `h-[100dvh] gap-1.5 px-1 ${stackControlsAtBottom ? 'justify-start pt-2 pb-1' : 'justify-center py-1'}`
            : 'min-h-[calc(100dvh-4rem)] justify-center gap-3 px-2 py-2 md:gap-5 md:py-4'
      }`}
      style={{ fontSize: `${progress.settings.textScale}em`, transform: `scale(${progress.settings.uiScale})`, transformOrigin: 'top center' }}
    >
      {/* GAME AREA */}
      <div
        ref={gameContainerRef}
        className="relative mx-auto aspect-video w-auto max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black transition-all duration-500 md:rounded-[2rem]"
        style={{
          // Fill the available viewport height without ever exceeding the
          // screen width, so the stage never leaves a dead gap underneath.
          height: immersive
            ? 'min(100dvh, calc(100vw * 9 / 16))'
            : isMobile
              ? `min(calc(100dvh - ${reservedForControls}px), calc((100vw - 0.5rem) * 9 / 16))`
              : 'min(78vh, calc((100vw - 2rem) * 9 / 16))',
          boxShadow: '0 0 0 1px rgba(43,238,121,0.15), 0 30px 90px -30px rgba(0,0,0,0.9), 0 0 80px -30px rgba(43,238,121,0.5)',
        }}
      >

        {/* HUD — compact glass panels that stay readable over any scene */}
        <div className="absolute top-0 left-0 right-0 z-20 px-1.5 py-1.5 pointer-events-none md:px-3 md:py-2.5">
          <div className="flex items-start justify-between gap-2">
            {/* LEFT: vitals, weapon, live buffs */}
            <div className="flex flex-col gap-1.5">
              <div className="hud-panel flex items-center gap-2 px-2.5 py-1.5">
                <div className="flex items-center gap-[1px]">
                  {/* Phones get a compact heart + count; wide screens show the
                      full row of hearts. */}
                  <span className="flex items-center gap-0.5 sm:hidden">
                    <span className="material-symbols-outlined text-[15px] text-[#ff5f7a]">favorite</span>
                    <span className="tabular text-xs font-black text-[#ff8fa3]">{Math.max(0, lives)}</span>
                  </span>
                  <span className="hidden items-center gap-[1px] sm:flex">
                    {Array.from({ length: Math.min(6, Math.max(lives, 0)) }).map((_, i) => (
                      <span
                        key={i}
                        className="material-symbols-outlined text-[15px] text-[#ff5f7a]"
                        style={{ filter: 'drop-shadow(0 0 5px rgba(255,70,100,0.8))' }}
                      >
                        favorite
                      </span>
                    ))}
                    {lives <= 0 && <span className="text-[10px] font-black text-primary-red">{t('TOMT')}</span>}
                    {lives > 6 && <span className="ml-1 text-[10px] font-black text-[#ff9db0]">+{lives - 6}</span>}
                  </span>
                </div>
                {stats.shield && (
                  <span className="hud-chip border-cyan-300/45 bg-cyan-300/10 text-cyan-200" title={t('Sköld aktiv')}>
                    <span className="material-symbols-outlined text-[14px]">shield</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <div className={`hud-chip ${stats.ammo <= 0 ? 'border-[#ff5f7a]/60 bg-[#ff5f7a]/10 animate-pulse' : ''}`}>
                  <span className="material-symbols-outlined text-[15px] text-[#ff9d9d]">bolt</span>
                  <span className={`tabular text-xs font-black ${stats.ammo <= 0 ? 'text-[#ff8b8b]' : 'text-white'}`}>{stats.ammo}</span>
                  <span className="hidden text-[8px] font-black uppercase tracking-wider text-white/35 sm:inline">{t('skott')}</span>
                </div>
                <div className={`hud-chip relative hidden overflow-hidden sm:inline-flex ${stats.dashReady ? 'border-primary/50 text-primary' : 'text-white/40'}`}>
                  <span className="material-symbols-outlined text-[15px]">bolt</span>
                  <span className="text-[10px] font-black tracking-wider">{t('DASH')}</span>
                  <span
                    className="absolute inset-x-0 bottom-0 h-[2px] bg-primary transition-[width] duration-150"
                    style={{ width: `${stats.dashPct * 100}%` }}
                  />
                </div>
              </div>

              <ShadowShiftMeter
                stats={stats}
                isTouchDevice={isTouchDevice}
                onTrigger={triggerShadowShift}
              />

              {(stats.magnet > 0 || stats.rapid > 0) && (
                <div className="flex items-center gap-1">
                  {stats.magnet > 0 && (
                    <span className="hud-chip border-yellow-300/40 bg-yellow-300/10 text-yellow-200">
                      <span className="material-symbols-outlined text-[13px]">attractions</span>
                      <span className="tabular text-[10px] font-black">{Math.ceil(stats.magnet / 60)}s</span>
                    </span>
                  )}
                  {stats.rapid > 0 && (
                    <span className="hud-chip border-orange-300/40 bg-orange-300/10 text-orange-200">
                      <span className="material-symbols-outlined text-[13px]">local_fire_department</span>
                      <span className="tabular text-[10px] font-black">{Math.ceil(stats.rapid / 60)}s</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* CENTER: stage, progress, combo */}
            <div className="flex-1 max-w-[420px] flex flex-col items-center gap-1.5">
              <div className="hud-panel w-full px-2.5 py-2 md:px-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="tabular text-[13px] font-black leading-none text-white md:text-[15px]">{t('NIVÅ {n}', { n: currentLevel })}</span>
                    <span
                      className={`truncate text-[9px] font-black uppercase tracking-[0.2em] ${isMobile ? 'hidden' : 'hidden sm:inline'}`}
                      style={{ color: (LEVEL_MODE_META[stats.levelType] || LEVEL_MODE_META.Classic).accent }}
                    >
                      {t((LEVEL_MODE_META[stats.levelType] || LEVEL_MODE_META.Classic).short)}
                    </span>
                  </div>
                  <span className="tabular text-[10px] font-black text-white/55">{stats.progress}%</span>
                </div>
                <div className="mt-1.5 flex h-1.5 gap-[2px] overflow-hidden rounded-full">
                  {Array.from({ length: 14 }).map((_, i) => {
                    const filled = stats.progress >= ((i + 1) / 14) * 100 - 0.5;
                    return (
                      <span
                        key={i}
                        className={`flex-1 rounded-[2px] transition-colors duration-300 ${filled ? 'bg-primary' : 'bg-white/12'}`}
                        style={filled ? { boxShadow: '0 0 8px rgba(43,238,121,0.6)' } : undefined}
                      />
                    );
                  })}
                </div>
                <div className={`mt-1 items-center justify-between gap-2 text-[8.5px] font-bold uppercase tracking-[0.14em] text-white/40 ${isMobile ? 'hidden' : 'hidden sm:flex'}`}>
                  <span className="truncate">{t(placeForLevel(currentLevel, gameRef.current?.theme))}</span>
                  <span className="tabular shrink-0">{t('RANK {r} · {a}/{b} XP', { r: stats.runLevel, a: stats.xpIntoLevel, b: stats.xpNeeded })}</span>
                </div>
              </div>

              {/* This stage's named rule, always visible while it is active. */}
              {stats.twist && stats.twist !== 'none' && (
                <div
                  className="flex w-full max-w-[300px] items-center gap-1.5 rounded-full border bg-black/50 px-2.5 py-1 backdrop-blur-md"
                  style={{ borderColor: `${stats.twistAccent}55` }}
                  title={t((TWISTS[stats.twist as keyof typeof TWISTS] || TWISTS.none).detail)}
                >
                  <span
                    className="material-symbols-outlined text-[14px]"
                    style={{ color: stats.twistAccent }}
                  >
                    {(TWISTS[stats.twist as keyof typeof TWISTS] || TWISTS.none).icon}
                  </span>
                  <span
                    className="truncate text-[9px] font-black uppercase tracking-[0.16em]"
                    style={{ color: stats.twistAccent }}
                  >
                    {t((TWISTS[stats.twist as keyof typeof TWISTS] || TWISTS.none).name)}
                  </span>
                </div>
              )}
              {/* A surprise event, with the warning spelled out before it lands. */}
              {stats.surprise && (
                <div
                  className="animate-pulse flex w-full max-w-[320px] items-center gap-2 rounded-full border bg-black/65 px-3 py-1 backdrop-blur-md"
                  style={{ borderColor: `${stats.surpriseAccent}99`, boxShadow: `0 0 22px ${stats.surpriseAccent}44` }}
                >
                  <span className="material-symbols-outlined text-[15px]" style={{ color: stats.surpriseAccent }}>
                    {stats.surpriseIcon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: stats.surpriseAccent }}>
                      {t(stats.surpriseName)}
                    </span>
                    <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-white/15">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${Math.round((stats.surpriseProgress || 0) * 100)}%`, background: stats.surpriseAccent }}
                      />
                    </span>
                  </span>
                </div>
              )}
              {stats.combo > 1 && (
                <div className="w-full max-w-[260px] rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-md">
                  <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.16em]">
                    <span className="text-white/55">{t('Combo')}</span>
                    <span className="tabular text-primary">x{stats.combo}</span>
                  </div>
                  <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-primary to-yellow-300"
                      style={{ width: `${Math.min(100, (stats.comboTimer / 150) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {stats.multiplier > 1 && (
                <div
                  className="rounded-full border border-yellow-400/40 bg-black/55 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-yellow-300 backdrop-blur-md"
                  style={{ boxShadow: '0 0 18px rgba(255,209,102,0.28)' }}
                >
                  {t('Multiplikator x{m} · streak {s}', { m: stats.multiplier, s: stats.streak })}
                </div>
              )}
            </div>

            {/* RIGHT: resources and controls */}
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <div
                  className={`hud-chip ${
                    stats.collectedCount >= stats.fishGoal ? 'border-primary/60 bg-primary/10 text-primary' : 'text-white'
                  }`}
                  title={t('Fiskar: {a} av {b} (mål {c})', { a: stats.collectedCount, b: stats.totalFish, c: stats.fishGoal })}
                >
                  <span className="material-symbols-outlined text-[15px] text-primary">set_meal</span>
                  <span className="tabular text-xs font-black">
                    {Math.min(stats.collectedCount, stats.fishGoal)}/{stats.fishGoal}
                  </span>
                  {/* Past the quota every extra fish is optional, so it gets its
                      own faint counter instead of being glued to the quota. */}
                  {stats.collectedCount > stats.fishGoal && stats.collectedCount <= stats.totalFish && (
                    <span className="tabular ml-1 text-[9px] font-black text-primary/70">
                      +{stats.collectedCount - stats.fishGoal}
                    </span>
                  )}
                </div>
                <div className={`hud-chip border-yellow-500/25 bg-yellow-500/10 ${isMobile ? 'hidden' : 'hidden sm:inline-flex'}`}>
                  <span className="material-symbols-outlined text-[15px] text-yellow-400">monetization_on</span>
                  <span className="tabular text-xs font-black text-yellow-300">{progress.coins}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className={`hud-chip ${isMobile ? 'hidden' : 'hidden sm:inline-flex'}`} title={t('Väder')}>
                  <span
                    className={`material-symbols-outlined text-[15px] ${
                      stats.weather === 'SOLIGT'
                        ? stats.timeOfDay === 'DAY' ? 'text-orange-400' : stats.timeOfDay === 'NIGHT' ? 'text-yellow-400' : 'text-orange-300'
                        : stats.weather === 'REGNIGT' ? 'text-blue-400'
                        : stats.weather === 'SNÖIGT' ? 'text-white'
                        : stats.weather === 'DIMMIGT' ? 'text-gray-300' : 'text-purple-400'
                    }`}
                  >
                    {stats.weather === 'SOLIGT'
                      ? stats.timeOfDay === 'DAY' ? 'sunny' : stats.timeOfDay === 'NIGHT' ? 'nightlight' : 'wb_twilight'
                      : stats.weather === 'REGNIGT' ? 'rainy'
                      : stats.weather === 'SNÖIGT' ? 'ac_unit'
                      : stats.weather === 'DIMMIGT' ? 'foggy' : 'thunderstorm'}
                  </span>
                  {stats.noHit && (
                    <span className="material-symbols-outlined text-[13px] text-primary" title={t('Inga skador ännu')}>verified</span>
                  )}
                  {stats.nearMisses > 0 && (
                    <span className="tabular text-[9px] font-black text-white/60" title={t('Nästan-träffar')}>{stats.nearMisses}</span>
                  )}
                </div>

                {stats.levelType === 'Speed Run' && (
                  <div
                    className={`hud-chip sm:inline-flex ${
                      stats.timer <= 10
                        ? 'animate-pulse border-red-400/60 bg-red-500/20'
                        : 'border-orange-400/35 bg-orange-400/10'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[15px] ${stats.timer <= 10 ? 'text-red-300' : 'text-orange-300'}`}>timer</span>
                    <span className={`tabular text-xs font-black ${stats.timer <= 10 ? 'text-red-200' : 'text-orange-200'}`}>
                      {Math.ceil(stats.timer)}s
                    </span>
                  </div>
                )}

                <div className="pointer-events-auto flex items-center gap-1">
                  <button
                    onClick={toggleMuted}
                    aria-pressed={isMuted}
                    aria-label={isMuted ? t('Slå på ljudet') : t('Stäng av ljudet')}
                    title={isMuted ? t('Slå på ljudet') : t('Stäng av ljudet')}
                    className={`hud-icon hidden sm:inline-flex ${isMuted ? 'text-primary-red' : 'text-white/65'}`}
                  >
                    <span className="material-symbols-outlined text-[17px]">
                      {isMuted ? 'volume_off' : 'volume_up'}
                    </span>
                  </button>
                  <button onClick={togglePause} aria-label={t('Pausa')} title={t('Pausa (Esc)')} className="hud-icon text-white/65">
                    <span className="material-symbols-outlined text-[17px]">pause</span>
                  </button>
                  <button onClick={toggleFullscreen} aria-label={t('Helskärm')} title={t('Helskärm')} className={`hud-icon text-white/65 ${isMobile ? 'hidden' : 'hidden sm:inline-flex'}`}>
                    <span className="material-symbols-outlined text-[17px]">
                      {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Level intro card: a two-second cinematic title so each stage feels
            like a place rather than a continuation of the last one. */}
        {showIntro && !showLevelComplete && !isPaused && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-4">
            <div className="level-intro-card animate-level-intro text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.35em] text-primary/80">
                {t(placeForLevel(currentLevel, gameRef.current?.theme))}
              </p>
              <h2 className="mt-2 text-5xl font-black uppercase leading-none tracking-tight text-white md:text-6xl">
                {t('Nivå {n}', { n: currentLevel })}
              </h2>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span
                  className="h-1 w-8 rounded-full"
                  style={{ background: (LEVEL_MODE_META[stats.levelType] || LEVEL_MODE_META.Classic).accent }}
                />
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/75">
                  {t((LEVEL_MODE_META[stats.levelType] || LEVEL_MODE_META.Classic).label)}
                </p>
                <span
                  className="h-1 w-8 rounded-full"
                  style={{ background: (LEVEL_MODE_META[stats.levelType] || LEVEL_MODE_META.Classic).accent }}
                />
              </div>
              <p className="mt-2 text-xs font-medium text-white/50">
                {t((LEVEL_MODE_META[stats.levelType] || LEVEL_MODE_META.Classic).goal)}
              </p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                {t(LEVEL_LAYOUT_META[getLevelLayout(currentLevel)].name)}
              </p>
              {gameRef.current?.twist && gameRef.current.twist.id !== 'none' && (
                <div
                  className="mx-auto mt-3 flex max-w-[300px] items-center gap-2 rounded-2xl border px-3 py-1.5"
                  style={{
                    borderColor: `${gameRef.current.twist.accent}66`,
                    background: `${gameRef.current.twist.accent}14`,
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ color: gameRef.current.twist.accent }}>
                    {gameRef.current.twist.icon}
                  </span>
                  <span className="text-left">
                    <span className="block text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: gameRef.current.twist.accent }}>
                      {t('Dagens regel · {n}', { n: t(gameRef.current.twist.name) })}
                    </span>
                    <span className="block text-[10px] font-medium leading-tight text-white/55">
                      {t(gameRef.current.twist.detail)}
                    </span>
                  </span>
                </div>
              )}
              <p className="mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-primary/70">
                {isTouchDevice ? t('Tryck för att börja') : t('Tryck valfri tangent för att börja')}
              </p>
              {currentLevel === 1 && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-white/10 pt-3 text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">
                  {(isTouchDevice
                    ? [
                        ['arrow_back', t('Gå')],
                        ['arrow_upward', t('Hoppa')],
                        ['bolt', t('Skjut')],
                        ['dark_mode', t('Skift · mätaren')],
                      ]
                    : [
                        ['keyboard', t('A / D · gå')],
                        ['arrow_upward', t('Space · hoppa')],
                        ['my_location', t('F · skjut')],
                        ['bolt', t('Shift · dash')],
                        ['dark_mode', t('E · skuggskifte')],
                      ]
                  ).map(([icon, label]) => (
                    <span key={label} className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-primary/70">{icon}</span>
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pause menu */}
        {isPaused && !showLevelComplete && createPortal(
          // Portalled to the body: the stage box is transform-scaled and clips
          // its children, so a phone's small letterboxed canvas would cut the
          // pause card in half.
          // Scroll container + centred wrapper: a landscape phone has less
          // height than the card, and centring a child inside an overflowing
          // flex box makes its top unreachable.
          <div className="fixed inset-0 z-[120] overflow-y-auto bg-[#04060f]/80 p-4 backdrop-blur-xl animate-fade-in-up">
            <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)]">
              <p className="eyebrow text-primary">{t('Spelet pausat')}</p>
              <h2 className="mt-1 font-display text-3xl font-black uppercase tracking-tight text-white">{t('Andhämtning')}</h2>
              <p className="mt-1 text-xs font-medium text-white/45">
                {t('Nivå {n} · {m} · {p}% klart', { n: currentLevel, m: t((LEVEL_MODE_META[stats.levelType] || LEVEL_MODE_META.Classic).label), p: stats.progress })}
              </p>

              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { label: t('Liv'), value: lives, tone: 'text-[#ff7f9b]' },
                  { label: t('Fiskar'), value: `${stats.collectedCount}/${stats.totalFish}`, tone: 'text-primary' },
                  { label: t('Poäng'), value: stats.score.toLocaleString(), tone: 'text-white' },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.04] px-2 py-2 text-center">
                    <p className={`tabular text-base font-black ${s.tone}`}>{s.value}</p>
                    <p className="text-[8px] font-black uppercase tracking-widest text-white/35">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <button onClick={togglePause} className="btn-primary w-full py-3.5 text-sm">
                  <span className="material-symbols-outlined text-lg">play_arrow</span>
                  {t('Fortsätt')}
                </button>
                <button onClick={restartCurrentLevel} className="btn-ghost w-full py-3 text-xs uppercase tracking-wider">
                  <span className="material-symbols-outlined text-base">restart_alt</span>
                  {t('Starta om nivån')}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={toggleMuted} className="btn-ghost py-3 text-xs uppercase tracking-wider">
                    <span className="material-symbols-outlined text-base">{isMuted ? 'volume_off' : 'volume_up'}</span>
                    {isMuted ? t('Ljud av') : t('Ljud på')}
                  </button>
                  <button
                    onClick={quitRun}
                    className="btn-ghost py-3 text-xs uppercase tracking-wider"
                  >
                    <span className="material-symbols-outlined text-base">logout</span>
                    {t('Avsluta')}
                  </button>
                </div>
              </div>

              <p className="mt-4 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-white/25">
                {isTouchDevice ? t('Pausknappen sitter i hörnet') : t('Esc eller P för att fortsätta')}
              </p>
            </div>
            </div>
          </div>,
          document.body,
        )}

        {progress.settings.debugOverlay && (
          <div className="absolute top-8 left-0 right-0 z-20 text-[10px] text-white/70 bg-black/40 px-3 py-1 pointer-events-none">
            MODE {stats.levelType} | EVENT {stats.miniEvent} | COMBO x{combo} | WEATHER {stats.weather} | THEME {seasonTheme}
          </div>
        )}

        {/* Boss HP Bar - Large prominent bar shown during boss fights */}
        {stats.bossVisible && stats.bossHp > 0 && stats.bossMaxHp > 0 && (
          <div className="absolute top-[86px] left-1/2 z-20 w-full max-w-xs -translate-x-1/2 px-3 pointer-events-none md:top-[96px]">
            <div
              className="rounded-xl bg-black/80 backdrop-blur-md border border-red-500/40 px-3 py-2 text-center"
              style={{ boxShadow: '0 0 24px rgba(255,50,30,0.4)' }}
            >
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
                stats.bossPhase >= 2 ? 'text-pink-400' : stats.bossPhase === 1 ? 'text-red-400' : 'text-orange-400'
              }`}>
                ⚔️ {t('{name} – FAS {n}', { name: stats.bossName || t('BOSS'), n: (stats.bossPhase || 0) + 1 })}
              </p>
              <div className="h-3 w-full rounded-full bg-black/50 overflow-hidden border border-white/10">
                <div
                  className="h-full rounded-full transition-[width] duration-200"
                  style={{
                    width: `${Math.max(0, (stats.bossHp / Math.max(1, stats.bossMaxHp)) * 100)}%`,
                    background: stats.bossPhase >= 2
                      ? 'linear-gradient(90deg, #aa00aa, #ff00ff)'
                      : stats.bossPhase === 1
                        ? 'linear-gradient(90deg, #880000, #ff2222)'
                        : 'linear-gradient(90deg, #882200, #ff6b35)',
                    boxShadow: stats.bossPhase >= 2
                      ? '0 0 12px rgba(255,0,255,0.8)'
                      : '0 0 12px rgba(255,80,20,0.8)',
                  }}
                />
              </div>
              <p className="text-[9px] text-white/50 font-bold mt-0.5 tabular-nums">
                {stats.bossHp} / {stats.bossMaxHp}
              </p>
            </div>
          </div>
        )}

        {!showLevelComplete && !isPaused && <ObjectivePill stats={stats} />}

        <canvas
          ref={canvasRef}
          role="img"
          aria-label={t('Spelplan: katten, fiskarna, fienden och Jerry')}
          className="w-full h-full max-w-full max-h-full object-contain cursor-crosshair bg-[#102217]"
          style={{ filter: progress.settings.colorBlindMode ? 'contrast(1.15) saturate(0.85)' : 'none' }}
        />
        {/* Cinematic edge shading: settles the frame and separates the stage
            from the page chrome without touching the artwork itself. */}
        <div
          className="pointer-events-none absolute inset-0 z-10 rounded-[inherit]"
          aria-hidden="true"
          style={{ boxShadow: 'inset 0 0 70px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.08)' }}
        />

        {showLevelComplete && levelSummary && (() => {
          const grade = levelSummary.grade || 'C';
          const gradeTone = grade === 'S'
            ? { ring: '#ffd166', text: '#ffe6a3', glow: 'rgba(255,209,102,0.55)' }
            : grade === 'A'
              ? { ring: '#2bee79', text: '#b6ffd4', glow: 'rgba(43,238,121,0.5)' }
              : grade === 'B'
                ? { ring: '#7ee7ff', text: '#c9f6ff', glow: 'rgba(126,231,255,0.45)' }
                : { ring: '#a8b3c7', text: '#e2e8f0', glow: 'rgba(168,179,199,0.35)' };
          const stars = grade === 'S' || grade === 'A' ? 3 : grade === 'B' ? 2 : 1;
          return createPortal(<div className="fixed inset-0 z-[120] overflow-y-auto bg-[#04060f]/88 p-3 backdrop-blur-lg md:p-6 animate-fade-in-up">
            <div className="flex min-h-full items-center justify-center">
              <div className="toon-card relative w-full max-w-md overflow-hidden rounded-[1.75rem] p-5 md:p-7">
                {/* Accent light behind the grade */}
                <div
                  className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full blur-3xl"
                  style={{ background: gradeTone.glow, opacity: 0.35 }}
                  aria-hidden="true"
                />

                <div className="relative flex items-start gap-4">
                  <div
                    className="flex size-20 shrink-0 flex-col items-center justify-center rounded-2xl border-[3px] border-[#12182b] md:size-24"
                    style={{ background: gradeTone.ring, boxShadow: '0 4px 0 0 #12182b' }}
                  >
                    <span className="font-display text-4xl font-black leading-none text-[#12182b] md:text-5xl">{grade}</span>
                    <span className="mt-1 text-[8px] font-black uppercase tracking-[0.2em] text-[#12182b]/60">{t('Betyg')}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0f8a3c]">{t('Nivå {n} klar', { n: currentLevel })}</p>
                    <h2 className="mt-1 font-display text-2xl font-black uppercase leading-tight tracking-tight text-[#12182b] md:text-3xl">
                      {t('Snyggt jobbat!')}
                    </h2>
                    <div className="mt-1.5 flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="material-symbols-outlined text-lg"
                          style={{
                            color: i < stars ? gradeTone.ring : 'rgba(18,24,43,0.18)',
                            WebkitTextStroke: i < stars ? '1.5px #12182b' : undefined,
                          }}
                        >
                          star
                        </span>
                      ))}
                      <span className="ml-1 text-[10px] font-black uppercase tracking-wider text-[#12182b]/50">
                        {t((LEVEL_MODE_META[levelSummary.levelType] || LEVEL_MODE_META.Classic).short)} · {levelSummary.time}s
                      </span>
                    </div>
                  </div>
                </div>

                <div className="relative mt-5 grid grid-cols-3 gap-2">
                  {[
                    { label: t('Poäng'), value: levelSummary.score.toLocaleString(), tone: 'text-primary' },
                    { label: t('Mynt'), value: `+${levelSummary.coins}`, tone: 'text-yellow-300' },
                    { label: t('Fiender'), value: levelSummary.kills || 0, tone: 'text-orange-200' },
                    { label: t('Bästa streak'), value: levelSummary.streak, tone: 'text-cyan-300' },
                    { label: t('Nästan'), value: levelSummary.nearMisses, tone: 'text-[#7ef7c2]' },
                    { label: t('Runnivå'), value: levelSummary.runLevel, tone: 'text-white' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl border-2 border-[#12182b]/25 bg-[#12182b]/[0.05] px-2 py-2.5 text-center">
                      <p className={`tabular text-lg font-black leading-none text-[#12182b]`}>{s.value}</p>
                      <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-[#12182b]/45">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className={`relative mt-3 flex items-center justify-center gap-2 rounded-2xl border-2 p-2.5 ${levelSummary.noHit ? 'border-[#0c3a20] bg-[#c9fbd9] text-[#0c3a20]' : 'border-[#12182b]/20 bg-[#12182b]/[0.04] text-[#12182b]/55'}`}>
                  <span className="material-symbols-outlined text-base">verified</span>
                  <span className="text-[11px] font-black uppercase tracking-wider">
                    {levelSummary.noHit ? t('Felfri · utan skada +750') : levelSummary.perfect ? t('Perfekt nivå +500') : t('Nivå avklarad')}
                  </span>
                </div>

                {levelSummary.lifeBonus > 0 && (
                  <p className="relative mt-2 flex items-center justify-center gap-1 text-center text-[10px] font-black uppercase tracking-widest text-[#7ef7c2]">
                    <span className="material-symbols-outlined text-[13px]">favorite</span>
                    {t('+{n} liv inför nästa nivå', { n: levelSummary.lifeBonus })}
                  </p>
                )}

                {/* Risk/reward: one of three seeded cards. Every option has a
                    cost, so this is a build decision, not a free upgrade. */}
                {perkOffer.length > 0 && (
                  <div className="relative mt-4 rounded-2xl border-2 border-[#12182b]/20 bg-[#12182b]/[0.04] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-primary">style</span>
                        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#12182b]/60">{t('Välj ett kort inför nästa nivå')}</span>
                      </span>
                      {perkChoice && <span className="text-[9px] font-black uppercase tracking-wider text-[#0f8a3c]">{t('Låst för rundan')}</span>}
                    </div>
                    <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {perkOffer.map((perk) => {
                        const active = perkChoice === perk.id;
                        return (
                          <button
                            key={perk.id}
                            type="button"
                            disabled={!!perkChoice}
                            aria-pressed={active}
                            onClick={() => {
                              setPerkChoice(perk.id);
                              runPerksRef.current = [...runPerksRef.current, perk.id];
                              AudioEngine.playUiClick();
                            }}
                            className={`flex min-h-[104px] flex-col items-start gap-1 rounded-xl border-2 p-2.5 text-left transition-all ${
                              active
                                ? 'border-[#0c3a20] bg-[#c9fbd9] shadow-[0_3px_0_0_#0c3a20]'
                                : perkChoice
                                  ? 'cursor-not-allowed border-[#12182b]/15 bg-white/40 opacity-45'
                                  : 'border-[#12182b]/20 bg-white hover:-translate-y-0.5'
                            }`}
                          >
                            <span className="material-symbols-outlined text-lg" style={{ color: perk.color }}>{perk.icon}</span>
                            <span className="text-[11px] font-black uppercase tracking-wide text-[#12182b]">{t(perk.name)}</span>
                            <span className="text-[10px] leading-snug text-[#12182b]/55">{t(perk.desc)}</span>
                          </button>
                        );
                      })}
                    </div>
                    {runPerksRef.current.length > 0 && (
                      <p className="mt-2 truncate text-[9px] uppercase tracking-wider text-[#12182b]/40">
                        {t('Aktiva kort: {n}', { n: runPerksRef.current.length })}
                        {' · '}{runPerksRef.current.map((id) => t(PERK_BY_ID[id]?.name || id)).join(' · ')}
                      </p>
                    )}
                  </div>
                )}

                <div className="relative mt-4 flex flex-col gap-2 sm:flex-row">
                  <button onClick={startNextLevel} className="toon-btn toon-btn-green w-full py-3.5 text-sm md:text-base">
                    <span className="material-symbols-outlined text-xl">arrow_forward</span>
                    {currentLevel % 5 === 4 ? t('Bosskamp · nivå {n}', { n: currentLevel + 1 }) : t('Nästa nivå · {n}', { n: currentLevel + 1 })}
                  </button>
                  <button
                    onClick={() => onEnd(totalScore, gameRef.current?.totalCollectedInLevel ?? 0)}
                    className="toon-btn w-full py-3.5 text-xs uppercase tracking-wider sm:w-auto sm:px-6"
                  >
                    {t('Avsluta')}
                  </button>
                </div>
              </div>
            </div>
            </div>,
            document.body,
          );
        })()}
      </div>

      {/* Phones: the stage is letterboxed in portrait, so the empty half of the
          screen carries the landscape hint instead of dead space. */}
      {isMobile && isPortrait && !showLevelComplete && !isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className={`flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-5 text-center transition-colors active:bg-white/[0.06] ${
            stackControlsAtBottom ? 'my-auto' : 'mt-1'
          }`}
        >
          <span className="material-symbols-outlined text-3xl text-primary">screen_rotation</span>
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">{t('Spela i helskärm')}</span>
          <span className="max-w-[210px] text-[10px] leading-relaxed text-white/35">
            {t('Vrid telefonen för att spela i helskärm – banan fyller hela skärmen och knapparna ligger ovanpå.')}
          </span>
        </button>
      )}

      {/* TOUCH CONTROLS - UNDER spelrutan */}
      {isTouchDevice && !showLevelComplete && (
        <div
          className={`flex w-full shrink-0 items-center justify-between select-none ${
            immersive
              ? 'pointer-events-none fixed inset-x-0 bottom-0 z-[110] px-4 pb-3'
              : `max-w-4xl pointer-events-auto px-3 py-1 lg:px-4 lg:py-2 ${stackControlsAtBottom ? 'mt-auto' : ''}`
          }`}
        >
          {/* Vänster sida: Styrning (Move vänster/höger) */}
          <div className="pointer-events-auto flex items-center gap-3">
            <button
              className="size-14 lg:size-16 bg-[#16291e]/90 backdrop-blur-md rounded-2xl flex items-center justify-center border-b-4 border-black/60 shadow-xl active:translate-y-1 active:border-b-0 active:bg-primary/40 transition-all group"
              onTouchStart={(e) => { e.preventDefault(); setKeyState(65, true); }}
              onTouchEnd={(e) => { e.preventDefault(); setKeyState(65, false); }}
            >
              <span className="material-symbols-outlined text-3xl text-white group-active:text-primary">arrow_back</span>
            </button>
            <button
              className="size-14 lg:size-16 bg-[#16291e]/90 backdrop-blur-md rounded-2xl flex items-center justify-center border-b-4 border-black/60 shadow-xl active:translate-y-1 active:border-b-0 active:bg-primary/40 transition-all group"
              onTouchStart={(e) => { e.preventDefault(); setKeyState(68, true); }}
              onTouchEnd={(e) => { e.preventDefault(); setKeyState(68, false); }}
            >
              <span className="material-symbols-outlined text-3xl text-white group-active:text-primary">arrow_forward</span>
            </button>
          </div>

          {/* Höger sida: Handlingar (Jump/Shoot) */}
          <div className="pointer-events-auto flex items-center gap-3">
            {/* Hopp-knapp */}
            <button
              className="size-16 lg:size-20 bg-primary/20 backdrop-blur-md rounded-full flex flex-col items-center justify-center border-4 border-primary/40 border-b-8 border-b-black/40 text-white shadow-2xl active:translate-y-2 active:border-b-0 active:bg-primary/60 transition-all group"
              onTouchStart={(e) => { e.preventDefault(); requestJump(); }}
              onTouchEnd={(e) => { e.preventDefault(); releaseJump(); }}
            >
              <span className="material-symbols-outlined text-3xl group-active:scale-110 transition-transform">arrow_upward</span>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-90">{t('HOPPA')}</span>
            </button>

            {/* Dash-knapp */}
            <button
              className="size-12 sm:size-14 lg:size-16 bg-cyan-400/20 backdrop-blur-md rounded-full flex flex-col items-center justify-center border-4 border-cyan-300/40 border-b-8 border-b-black/40 text-white shadow-2xl active:translate-y-2 active:border-b-0 active:bg-cyan-300/60 transition-all group"
              onTouchStart={(e) => { e.preventDefault(); triggerDash(); }}
            >
              <span className="material-symbols-outlined text-2xl group-active:scale-110 transition-transform">bolt</span>
              <span className="text-[9px] font-black uppercase tracking-widest opacity-90">{t('DASH')}</span>
            </button>

            {/* Shoot-knapp */}
            <button
              className="size-16 lg:size-20 bg-primary-red/30 backdrop-blur-md rounded-full flex flex-col items-center justify-center border-4 border-primary-red/50 border-b-8 border-b-black/40 text-white shadow-2xl active:translate-y-2 active:border-b-0 active:bg-primary-red/60 transition-all group"
              onTouchStart={(e) => { e.preventDefault(); startTouchShoot(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopTouchShoot(); }}
              onTouchCancel={stopTouchShoot}
            >
              {/* The dash button uses a bolt too; the shot needs its own mark
                  or the two thumbs buttons look identical. */}
              <span className="material-symbols-outlined text-3xl group-active:scale-110 transition-transform">my_location</span>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-90">{t('SKJUT')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/** SHOP VIEW **/
type ShopTab = 'upgrades' | 'skins' | 'perks';

export const ShopView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { progress, buyUpgrade, equipSkin } = useProgress();
  const t = useT();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [tab, setTab] = useState<ShopTab>('upgrades');
  const [preview, setPreview] = useState<string>(progress.equippedSkin);

  const flash = (text: string, ok: boolean) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 2200);
  };

  const handleBuy = (type: 'maxAmmo' | 'jumpPower' | 'speed', cost: number) => {
    if (buyUpgrade(type, cost)) {
      flash(t('Uppgradering köpt!'), true);
      AudioEngine.playPowerup();
    } else {
      flash(t('Inte tillräckligt med mynt!'), false);
    }
  };

  const upgrades: Array<{
    type: 'maxAmmo' | 'jumpPower' | 'speed';
    icon: string;
    title: string;
    short: string;
    desc: string;
    cost: number;
    now: number;
    step: number;
    unit: string;
    digits: number;
    tone: string;
  }> = [
    { type: 'maxAmmo', icon: 'battery_charging_full', title: 'Ammokapacitet', short: 'Ammo', desc: 'Fler skott innan du måste hitta en ammolåda.', cost: 500, now: progress.upgrades.maxAmmo, step: 1, unit: 'skott', digits: 0, tone: 'text-sky-300' },
    { type: 'jumpPower', icon: 'rocket_launch', title: 'Hoppkraft', short: 'Hopp', desc: 'Högre hopp och längre dubbelhopp.', cost: 750, now: progress.upgrades.jumpPower, step: 0.5, unit: '', digits: 1, tone: 'text-emerald-300' },
    { type: 'speed', icon: 'speed', title: 'Sprint', short: 'Fart', desc: 'Snabbare markfart så du hinner före farorna.', cost: 1000, now: progress.upgrades.speed, step: 0.5, unit: '', digits: 1, tone: 'text-violet-300' },
  ];

  const skinEntries = Object.entries(SKINS);
  const shown = SKINS[preview] ?? SKINS.default;
  const shownUnlocked = progress.unlockedSkins.includes(preview);
  const shownEquipped = progress.equippedSkin === preview;

  const tabs: Array<{ id: ShopTab; label: string; icon: string }> = [
    { id: 'upgrades', label: 'Uppgraderingar', icon: 'bolt' },
    { id: 'skins', label: 'Skinn', icon: 'palette' },
    { id: 'perks', label: 'Förmåner', icon: 'auto_awesome' },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl animate-fade-in-up px-4 py-5 md:py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-primary">{t('Butik')}</p>
          <h1 className="toon-title mt-1 font-display text-2xl font-black uppercase tracking-tight md:text-4xl">{t('Kattens verkstad')}</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border-[2.5px] border-[#6b4708] bg-gradient-to-b from-[#ffe58a] to-[#ffbe3d] py-1.5 pl-2.5 pr-4 text-[#2a1c00] shadow-[0_4px_0_0_#6b4708]">
          <span className="material-symbols-outlined text-xl">monetization_on</span>
          <span className="tabular text-lg font-black leading-none">{progress.coins}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Studio: the cat as it will look in the game */}
        <aside className="toon-card-dark overflow-hidden lg:sticky lg:top-20 lg:self-start">
          <div className="relative flex h-56 items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#8fd8ff_0%,#c6efff_52%,#eafaf0_72%,#d6f3c4_100%)] lg:h-64">
            {/* A tiny meadow so the preview reads as a stage, not a black box. */}
            <div className="absolute -bottom-6 left-1/2 h-24 w-[130%] -translate-x-1/2 rounded-[50%] bg-[#7ed957] shadow-[0_-3px_0_0_#3d8b2f]" aria-hidden="true" />
            <div className="absolute left-3 top-3 size-7 rounded-full bg-[#ffe98a] shadow-[0_0_0_3px_#f6c94a]" aria-hidden="true" />
            <CatPreview color={shown.color} accent={shown.accent} original={shown.original} width={220} height={150} scale={2.2} animated className="max-w-full" />
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-display text-base font-black uppercase tracking-tight text-white">{shown.name}</p>
                <p className="truncate text-[10px] text-white/45">
                  {shownEquipped ? t('Aktivt skinn') : shownUnlocked ? t('Upplåst') : t(shown.unlockHint)}
                </p>
              </div>
              {shownUnlocked && !shownEquipped && (
                <button
                  onClick={() => equipSkin(preview)}
                  className="toon-btn toon-btn-green shrink-0 px-3.5 py-1.5 text-[10px] uppercase tracking-wider"
                >
                  {t('Utrusta')}
                </button>
              )}
              {!shownUnlocked && <span className="material-symbols-outlined text-lg text-white/30">lock</span>}
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-3 text-center">
              {upgrades.map((u) => (
                <div key={u.type}>
                  <span className={`material-symbols-outlined text-base ${u.tone}`}>{u.icon}</span>
                  <p className="tabular text-sm font-black text-white">{u.now.toFixed(u.digits)}</p>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-white/35">{t(u.short)}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Market */}
        <section className="min-w-0">
          <div role="tablist" className="flex gap-1.5 rounded-full border-[2.5px] border-[#0a0f20] bg-[#0a0f20]/70 p-1.5">
            {tabs.map((tb) => (
              <button
                key={tb.id}
                role="tab"
                aria-selected={tab === tb.id}
                onClick={() => setTab(tb.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[10px] font-black uppercase tracking-wider transition-all sm:text-[11px] ${
                  tab === tb.id
                    ? 'border-2 border-[#0c3a20] bg-gradient-to-b from-[#5cfa9e] to-[#22cf66] text-[#06210f] shadow-[0_3px_0_0_#0c3a20]'
                    : 'border-2 border-transparent text-white/55 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined hidden text-base sm:inline">{tb.icon}</span>
                {t(tb.label)}
              </button>
            ))}
          </div>

          {message && (
            <div className={`mt-3 rounded-xl border px-4 py-2 text-center text-xs font-bold animate-fade-in-up ${message.ok ? 'border-primary/30 bg-primary/10 text-primary' : 'border-red-400/30 bg-red-400/10 text-red-300'}`}>
              {message.text}
            </div>
          )}

          {tab === 'upgrades' && (
            <ul className="toon-card mt-3 divide-y-2 divide-[#12182b]/15 overflow-hidden p-0">
              {upgrades.map((u) => {
                const affordable = progress.coins >= u.cost;
                return (
                  <li key={u.type} className="flex items-center gap-3 p-3.5 sm:gap-4 sm:p-4">
                    <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border-2 border-[#12182b] bg-[#e6ecff] shadow-[0_3px_0_0_#12182b] ${u.tone}`}>
                      <span className="material-symbols-outlined text-2xl">{u.icon}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-[#12182b]">{t(u.title)}</p>
                      <p className="truncate text-[11px] font-semibold text-[#12182b]/55">{t(u.desc)}</p>
                      <p className="tabular mt-1 text-[11px] font-black text-[#12182b]/70">
                        {u.now.toFixed(u.digits)}{u.unit ? ' ' + t(u.unit) : ''} <span className="text-[#0f8a3c]">→ {(u.now + u.step).toFixed(u.digits)}{u.unit ? ' ' + t(u.unit) : ''}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleBuy(u.type, u.cost)}
                      disabled={!affordable}
                      className={`toon-btn shrink-0 px-3.5 py-2 text-xs ${
                        affordable ? 'toon-btn-gold' : 'border-[#12182b]/30 bg-[#12182b]/10 text-[#12182b]/40 !shadow-none'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">monetization_on</span>
                      {u.cost}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {tab === 'skins' && (
            <>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-white/30">
                {t('{a}/{b} upplåsta · tryck för förhandsvisning', { a: progress.unlockedSkins.length, b: skinEntries.length })}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {skinEntries.map(([id, skin]) => {
                  const unlocked = progress.unlockedSkins.includes(id);
                  const equipped = progress.equippedSkin === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setPreview(id)}
                      className={`relative overflow-hidden rounded-2xl border-2 p-2 text-left transition-all ${
                        preview === id
                          ? 'border-[#0c3a20] bg-[#c9fbd9] shadow-[0_4px_0_0_#0c3a20]'
                          : 'border-[#0a0f20] bg-[#1b2447] shadow-[0_3px_0_0_#0a0f20] hover:-translate-y-0.5'
                      }`}
                    >
                      <div className={`flex justify-center rounded-xl bg-black/25 pt-2 ${unlocked ? '' : 'opacity-60 grayscale'}`}>
                        <CatPreview color={skin.color} accent={skin.accent} original={skin.original} width={92} height={74} scale={1.1} />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-1 px-1">
                        <p className={`truncate text-xs font-black ${preview === id ? 'text-[#0c3a20]' : unlocked ? 'text-white' : 'text-white/40'}`}>{skin.name}</p>
                        {equipped ? (
                          <span className={`material-symbols-outlined text-base ${preview === id ? 'text-[#0c3a20]' : 'text-primary'}`}>check_circle</span>
                        ) : !unlocked ? (
                          <span className="material-symbols-outlined text-sm text-white/30">lock</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'perks' && (
            <ul className="toon-card mt-3 divide-y-2 divide-[#12182b]/15 overflow-hidden p-0">
              {[
                { level: 5, label: 'Smidiga tassar', desc: 'Lite mer fart', icon: 'directions_run' },
                { level: 10, label: 'Ammoeffektiv', desc: '+2 skott per nivå', icon: 'bolt' },
                { level: 15, label: 'Vaksintinkt', desc: 'Startar med sköld', icon: 'shield' },
              ].map((perk) => {
                const unlocked = progress.level >= perk.level;
                return (
                  <li key={perk.level} className="flex items-center gap-3 p-3.5 sm:p-4">
                    <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border-2 ${unlocked ? 'border-[#0c3a20] bg-[#8ff5b6] text-[#0c3a20] shadow-[0_3px_0_0_#0c3a20]' : 'border-[#12182b]/25 bg-[#12182b]/10 text-[#12182b]/35'}`}>
                      <span className="material-symbols-outlined text-2xl">{unlocked ? perk.icon : 'lock'}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-black ${unlocked ? 'text-[#12182b]' : 'text-[#12182b]/40'}`}>{t(perk.label)}</p>
                      <p className="truncate text-[11px] font-semibold text-[#12182b]/45">{t(perk.desc)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border-2 px-3 py-1 text-[10px] font-black uppercase tracking-wider ${unlocked ? 'border-[#0c3a20] bg-[#8ff5b6] text-[#0c3a20]' : 'border-[#12182b]/20 bg-[#12182b]/10 text-[#12182b]/40'}`}>
                      {unlocked ? t('Aktiv') : t('Rank {n}', { n: perk.level })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <button onClick={onBack} className="toon-btn mt-4 w-full py-3 text-xs uppercase tracking-wider">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            {t('Tillbaka')}
          </button>
        </section>
      </div>
    </div>
  );
};

/** QUESTS VIEW **/
export const QuestsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { progress, claimQuestReward } = useProgress();
  const t = useT();
  const xpInto = progress.xp % 1000;
  const xpLeft = 1000 - xpInto;
  const dailyDone = progress.dailyQuests.filter((q) => q.completed).length;
  const weeklyDone = progress.weeklyQuests.filter((q) => q.completed).length;

  const renderQuest = (
    quest: { id: string; description: string; target: number; current: number; reward: number; completed: boolean; claimed: boolean },
    tone: 'daily' | 'weekly'
  ) => {
    const accent = tone === 'daily' ? 'primary' : 'yellow';
    const pct = Math.min(100, (quest.current / Math.max(1, quest.target)) * 100);
    return (
      <div
        key={quest.id}
        className={`rounded-2xl border-2 p-3.5 transition-transform ${
          quest.completed
            ? 'border-[#0c3a20] bg-[#c9fbd9] text-[#0c3a20] shadow-[0_3px_0_0_#0c3a20]'
            : 'border-[#0a0f20] bg-[#1b2447] text-white shadow-[0_3px_0_0_#0a0f20]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl border-2 ${quest.completed ? 'border-[#0c3a20] bg-white/70 text-[#0c3a20]' : 'border-[#0a0f20] bg-white/[0.06] text-white/40'}`}>
            <span className="material-symbols-outlined text-lg">
              {quest.completed ? 'check_circle' : tone === 'daily' ? 'radio_button_unchecked' : 'pending'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-xs font-black ${quest.completed ? 'text-[#0c3a20]' : 'text-white/80'}`}>{t(quest.description)}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className={`toon-bar flex-1 ${quest.completed ? 'opacity-70' : ''}`}>
                <span
                  style={{
                    width: `${pct}%`,
                    background: tone === 'daily' ? undefined : 'linear-gradient(180deg,#ffe58a,#ffbe3d)',
                  }}
                />
              </div>
              <span className={`tabular shrink-0 text-[9px] font-black ${quest.completed ? 'text-[#0c3a20]/70' : 'text-white/45'}`}>{Math.min(quest.current, quest.target)}/{quest.target}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className={`tabular text-xs font-black ${quest.completed ? 'text-[#0c3a20]' : 'text-yellow-300'}`}>+{quest.reward}</p>
            {quest.completed && !quest.claimed && (
              <button
                onClick={() => claimQuestReward(quest.id)}
                className={`toon-btn mt-1 px-2.5 py-1 text-[9px] uppercase tracking-wider ${
                  tone === 'daily' ? 'toon-btn-green' : 'toon-btn-gold'
                }`}
              >
                {t('Hämta')}
              </button>
            )}
            {quest.claimed && (
              <span className="mt-1 inline-block rounded-lg border-2 border-[#0c3a20]/30 bg-[#0c3a20]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#0c3a20]/60">
                {t('Hämtad')}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-4xl animate-fade-in-up px-4 py-6 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">{t('Uppdrag')}</p>
          <h1 className="toon-title mt-1 font-display text-3xl font-black uppercase tracking-tight md:text-5xl">{t('Dagligt & veckans')}</h1>
          <p className="mt-2 max-w-md text-sm font-semibold text-white/60">{t('Utmaningar som roterar automatiskt. Hämta belöningen när du är klar.')}</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border-[2.5px] border-[#0c3a20] bg-gradient-to-b from-[#5cfa9e] to-[#22cf66] px-4 py-2.5 text-[#06210f] shadow-[0_4px_0_0_#0c3a20]">
          <span className="material-symbols-outlined text-xl">military_tech</span>
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-70">{t('Rank {n}', { n: progress.level })}</p>
            <p className="tabular text-sm font-black leading-none">{t('{n} XP', { n: progress.xp })}</p>
          </div>
        </div>
      </div>

      <div className="toon-card-dark mt-5 p-3.5">
        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-white/70">
          <span>{t('Nästa rank')}</span>
          <span className="tabular">{t('{n} XP kvar', { n: xpLeft })}</span>
        </div>
        <div className="toon-bar mt-2">
          <span style={{ width: `${xpInto / 10}%` }} />
        </div>
      </div>

      <div className="mt-6 grid gap-2 lg:grid-cols-2 lg:gap-4">
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">{t('Dagliga')}</h2>
            <span className="text-[9px] font-black uppercase tracking-wider text-white/30">{t('{a}/{b} klara', { a: dailyDone, b: progress.dailyQuests.length })}</span>
          </div>
          <div className="mt-2.5 space-y-2">
            {progress.dailyQuests.map((q) => renderQuest(q, 'daily'))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">{t('Veckans')}</h2>
            <span className="text-[9px] font-black uppercase tracking-wider text-white/30">{t('{a}/{b} klara', { a: weeklyDone, b: progress.weeklyQuests.length })}</span>
          </div>
          <div className="mt-2.5 space-y-2">
            {progress.weeklyQuests.map((q) => renderQuest(q, 'weekly'))}
          </div>
        </section>

        <section className="toon-card-dark self-start p-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-primary">workspace_premium</span>
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">{t('Prestationer')}</h2>
          </div>
          <p className="mt-1 text-[10px] font-semibold text-white/40">
            {t('{a} av {b} upplåsta', { a: progress.achievements.length, b: ACHIEVEMENTS.length })}
          </p>
          <div className="mt-3 space-y-1.5">
            {ACHIEVEMENTS.map((a) => {
              const unlocked = progress.achievements.includes(a.id);
              return (
                <div key={a.id} className={`flex items-center gap-2.5 rounded-xl border-2 px-2.5 py-2 ${unlocked ? 'border-[#0c3a20] bg-[#c9fbd9] text-[#0c3a20]' : 'border-[#0a0f20] bg-black/25'}`}>
                  <span className={`material-symbols-outlined text-base ${unlocked ? 'text-[#0c3a20]' : 'text-white/25'}`}>{unlocked ? a.icon : 'lock'}</span>
                  <div className="min-w-0">
                    <p className={`truncate text-[11px] font-black ${unlocked ? 'text-[#0c3a20]' : 'text-white/40'}`}>{t(a.label)}</p>
                    <p className={`truncate text-[9px] ${unlocked ? 'text-[#0c3a20]/65' : 'text-white/30'}`}>{t(a.desc)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <button onClick={onBack} className="toon-btn mt-6 w-full py-3 text-xs uppercase tracking-wider">
        <span className="material-symbols-outlined text-base">arrow_back</span>
        {t('Tillbaka')}
      </button>
    </div>
  );
};
