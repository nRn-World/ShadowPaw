
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AppView, ScoreEntry } from '../types';
import LiveRunDemo from './LiveRunDemo';
import { drawCatSprite } from './catSprite';
import { getJerryTaunt } from '../services/taunts';
import { useProgress } from '../context/ProgressContext';
import { AudioEngine } from '../services/AudioEngine';

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

const SKINS: Record<string, { name: string; color: string; accent: string; unlockHint: string }> = {
  default: { name: 'Neon Blue', color: '#4169E1', accent: '#333', unlockHint: 'Standardskinn' },
  ember: { name: 'Ember', color: '#e85d2c', accent: '#4a1d0d', unlockHint: 'Besegra 60 fiender' },
  frost: { name: 'Frost', color: '#62b7ff', accent: '#27415f', unlockHint: 'Samla 300 fiskar' },
  shadow: { name: 'Shadow', color: '#4f5d75', accent: '#141b2d', unlockHint: 'Nå combo x10' },
  aurora: { name: 'Aurora', color: '#29b88f', accent: '#0a3d33', unlockHint: 'Besegra 3 bossar' },
};

const ACHIEVEMENTS: Array<{ id: string; label: string; desc: string; icon: string }> = [
  { id: 'flawless', label: 'Felfri', desc: 'Klara en nivå utan skada', icon: 'verified' },
  { id: 'combo_10', label: 'Combo x10', desc: 'Kedja 10 aktioner', icon: 'local_fire_department' },
  { id: 'enemy_60', label: 'Jägare', desc: 'Besegra 60 fiender', icon: 'swords' },
  { id: 'fish_300', label: 'Fiskare', desc: 'Samla 300 fiskar', icon: 'set_meal' },
  { id: 'boss_3', label: 'Bossjägare', desc: 'Besegra 3 bossar', icon: 'swords' },
  { id: 'streak_20', label: 'Streak x20', desc: 'Håll en streak på 20', icon: 'bolt' },
  { id: 'close_call', label: 'Nära ögat', desc: '5 nästan-träffar i en runda', icon: 'warning' },
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

      <svg viewBox="0 0 120 120" className="animate-dizzy h-full w-full" role="img" aria-label="Skadad katt">
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
export const StartMenuView: React.FC<{
  onNavigate: (v: AppView) => void;
  onStart: (level?: number) => void;
}> = ({ onNavigate, onStart }) => {
  const [tip, setTip] = useState<string>('');
  const { progress } = useProgress();

  const gameTips = [
    'Använd dubbelhopp för att nå högre plattformar!',
    'Samla fiskar för att få ammunition!',
    'Hoppa på fiender för att besegra dem!',
    'Håll kattens fart – dash med Shift ger extra fart!',
    'Ju längre din streak håller, desto högre blir multiplikatorn!',
    'Åk förbi fiender utan att träffa – det ger bonuspoäng!',
    'Varje 10:e fisk ger dig ett mynt och ett extra skott!',
    'Klara en nivå utan att ta skada för +750 poäng!',
    'Sköldar, magneter och rapid fire gömmer sig i banorna!',
    'Turret-drönare skjuter långsamt – lär dig deras rytm!',
    'Samla fisk och besegra fiender för att fylla dagliga uppdrag!',
    'Ju högre nivå, desto snårare är ammunitionen – planera!',
    'Undvik att falla i hål – dubbelhopp räcker nästan alltid!',
    'Kombinationer ger poäng – chained-action mot fiender är starkast!',
  ];

  useEffect(() => {
    setTip(gameTips[Math.floor(Math.random() * gameTips.length)]);
    // A stable per-day seed picks the daily challenge level.
  }, []);

  const dailyDigits = progress.dailySeed.replace(/\D/g, '');
  const dailyLevel = 3 + (Number(dailyDigits || 0) % 28);
  const questsDone = progress.dailyQuests.filter((q) => q.completed).length;
  const storyLevel = Math.max(1, progress.level);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 md:py-10 animate-fade-in-up">
      <div className="grid items-center gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
        {/* ------------------------------------------------------- hero copy */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.07] px-3 py-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/90">
              Ett neonäventyr från NRN World
            </span>
          </div>

          <h1 className="mt-5 font-display text-[3.4rem] font-black uppercase leading-[0.86] tracking-tight md:text-[5.2rem]">
            <span className="block display-title">Shadow</span>
            <span className="mt-1 block paw-title">Paw</span>
          </h1>

          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/60 md:text-base">
            Neonstaden har tagit Jerry. Spring, hoppa och skjut dig genom 40+ handbyggda
            kapitel – bygg streaken, besegra bossarna och ta tillbaka natten.
          </p>

          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
            <button onClick={() => onStart(1)} className="btn-primary cta-breathe group flex-1 px-7 py-4 text-base">
              <span className="material-symbols-outlined text-2xl transition-transform duration-200 group-hover:translate-x-0.5">
                play_arrow
              </span>
              <span>Spela nu</span>
            </button>
            <button
              onClick={() => onStart(dailyLevel)}
              className="btn-ghost px-5 py-4 text-[11px] uppercase tracking-[0.14em]"
              title={`Starta direkt på nivå ${dailyLevel}`}
            >
              <span className="material-symbols-outlined text-lg text-primary">bolt</span>
              Dagens runda · nivå {dailyLevel}
            </button>
          </div>

          <div className="mt-5 grid max-w-md grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { k: 'A / D', v: 'Rör dig', icon: 'open_with' },
              { k: 'Mellanslag', v: 'Hoppa', icon: 'arrow_upward' },
              { k: 'Shift', v: 'Dash', icon: 'bolt' },
              { k: 'Klick', v: 'Skjuta', icon: 'ads_click' },
            ].map((c) => (
              <div key={c.v} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-2 py-2 text-center">
                <span className="material-symbols-outlined text-[16px] text-white/45">{c.icon}</span>
                <p className="mt-0.5 truncate text-[9px] font-black uppercase tracking-wider text-white/75">{c.k}</p>
                <p className="truncate text-[8px] font-bold uppercase tracking-wider text-white/30">{c.v}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex max-w-md items-start gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
            <span className="material-symbols-outlined text-base text-primary/80">lightbulb</span>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">Dagens tips</p>
              <p className="mt-1 text-xs leading-relaxed text-white/70">{tip}</p>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------- hero panel */}
        <div className="relative">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#050a15] shadow-[0_40px_120px_-50px_rgba(0,0,0,1)]">
            {/* Attract mode: a looping slice of real play. The cat sprints
                through the park, hops a crate, shoots a drone, crosses the
                rainy night and takes down a boss, so the first screen shows
                what the game *is* before the visitor presses anything. */}
            <div className="group/canvas relative h-52 overflow-hidden bg-[#06101f] md:h-60">
              <div className="absolute inset-0">
                <LiveRunDemo />
              </div>
              <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 backdrop-blur-md">
                <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/70">Live run</span>
              </div>
              <button
                onClick={() => onStart(1)}
                className="absolute inset-0 z-10 flex items-end justify-end p-3"
                aria-label="Spela Shadow Paw"
              >
                <span className="flex items-center gap-1 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-white/80 backdrop-blur-md transition-all duration-200 group-hover/canvas:border-primary/50 group-hover/canvas:bg-primary/20 group-hover/canvas:text-white">
                  <span className="material-symbols-outlined text-[13px] text-primary">play_arrow</span>
                  Spela själv
                </span>
              </button>
            </div>

            <div className="relative border-t border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">Nästa mål</p>
                  <p className="text-xs font-bold text-white/85">Kapitel {Math.ceil(storyLevel / 5)} · nivå {storyLevel}</p>
                </div>
                <span className="rounded-lg border border-primary/25 bg-primary/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-primary">
                  Rank {progress.level}
                </span>
              </div>
            </div>
          </div>

          {/* Career stats */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { icon: 'monetization_on', label: 'Mynt', value: progress.coins, tone: 'text-yellow-400' },
              { icon: 'local_fire_department', label: 'Bästa combo', value: progress.stats.bestCombo, tone: 'text-cyan-300' },
              { icon: 'emoji_events', label: 'Bossar', value: progress.stats.bossesDefeated, tone: 'text-orange-300' },
              { icon: 'set_meal', label: 'Fiskar', value: progress.stats.totalFishCollected, tone: 'text-sky-300' },
              { icon: 'swords', label: 'Fiender', value: progress.stats.totalEnemiesDefeated, tone: 'text-rose-300' },
              { icon: 'stars', label: 'Perfekta', value: progress.stats.perfectLevels, tone: 'text-primary' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-2 py-2">
                <div className="flex items-center gap-1">
                  <span className={`material-symbols-outlined text-[13px] ${s.tone}`}>{s.icon}</span>
                  <span className="tabular text-sm font-black text-white">{s.value}</span>
                </div>
                <p className="mt-0.5 truncate text-[8px] font-black uppercase tracking-wider text-white/30">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Daily quests */}
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-primary">task_alt</span>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/55">Dagliga uppdrag</p>
              </div>
              <button
                onClick={() => onNavigate(AppView.QUESTS)}
                className="text-[9px] font-black uppercase tracking-wider text-primary/80 transition-colors hover:text-primary"
              >
                Alla {questsDone}/{progress.dailyQuests.length} →
              </button>
            </div>
            <div className="mt-2.5 space-y-2">
              {progress.dailyQuests.map((q) => {
                const pct = Math.min(100, (q.current / Math.max(1, q.target)) * 100);
                return (
                  <div key={q.id}>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-[10px] font-bold ${q.completed ? 'text-primary' : 'text-white/60'}`}>
                        {q.description}
                      </p>
                      <span className="tabular shrink-0 text-[9px] font-black text-white/35">
                        {Math.min(q.current, q.target)}/{q.target}
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${q.completed ? 'bg-primary' : 'bg-gradient-to-r from-primary/50 to-primary'}`}
                        style={{ width: `${pct}%` }}
                      />
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
        <MenuButton icon="store" label="Butik" onClick={() => onNavigate(AppView.SHOP)} />
        <MenuButton icon="task_alt" label="Uppdrag" onClick={() => onNavigate(AppView.QUESTS)} />
        <MenuButton icon="help" label="Så spelar du" onClick={() => onNavigate(AppView.HOW_TO_PLAY)} subtle />
        <MenuButton icon="emoji_events" label="Topplista" onClick={() => onNavigate(AppView.LEADERBOARD)} subtle />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
        <button onClick={() => onNavigate(AppView.SETTINGS)} className="transition-colors hover:text-white/80">
          Inställningar
        </button>
        <span aria-hidden="true">·</span>
        <span>Neon City · 40 kapitel</span>
        <span aria-hidden="true">·</span>
        <span className="text-white/20">v2.0</span>
      </div>
    </div>
  );
};

/** SETTINGS **/
export const SettingsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { progress, updateSettings, toggleMuted, exportProgressCode, importProgressCode } = useProgress();
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
          <p className="eyebrow text-primary">System</p>
          <h1 className="mt-1 font-display text-3xl font-black uppercase tracking-tight md:text-4xl">Inställningar</h1>
          <p className="mt-1 text-xs text-white/40">Ljud, bild och säkerhetskopiering. Allt sparas lokalt.</p>
        </div>
        <button onClick={onBack} className="btn-ghost px-4 py-2.5 text-[10px] uppercase tracking-wider">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Tillbaka
        </button>
      </div>

      <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/10 bg-[#0a1220]/78 backdrop-blur-xl">
        {/* Audio Section */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-primary">equalizer</span>
            <span className="text-white font-bold text-sm uppercase tracking-wider">Audio</span>
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="settings-mute" className="text-white/80 text-sm font-medium">Ljud av/på</label>
                <span className={`text-sm font-bold ${muted ? 'text-primary-red' : 'text-primary'}`}>{muted ? 'Av' : 'På'}</span>
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
                <span className={`material-symbols-outlined text-xl ${muted ? 'text-primary-red' : 'text-primary'}`}>
                  {muted ? 'volume_off' : 'volume_up'}
                </span>
                <span className="flex-1 text-left text-sm font-semibold text-white/85">
                  {muted ? 'Allt ljud är avstängt' : 'Allt ljud spelas'}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Mute</span>
              </button>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="settings-music" className="text-white/80 text-sm font-medium">Musikvolym</label>
                <span className={`font-mono text-sm ${muted ? 'text-white/30' : 'text-primary'}`}>{muted ? '—' : `${music}%`}</span>
              </div>
              <input
                id="settings-music" aria-label="Musikvolym"
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
                <label htmlFor="settings-sfx" className="text-white/80 text-sm font-medium">Audioeffekter</label>
                <span className={`font-mono text-sm ${muted ? 'text-white/30' : 'text-primary'}`}>{muted ? '—' : `${sfx}%`}</span>
              </div>
              <input
                id="settings-sfx" aria-label="Audioeffekter"
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
                <label htmlFor="settings-ui" className="text-white/80 text-sm font-medium">UI-skala</label>
                <span className="text-primary font-mono text-sm">{Math.round(progress.settings.uiScale * 100)}%</span>
              </div>
              <input
                id="settings-ui" aria-label="UI-skala"
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
                <label htmlFor="settings-text" className="text-white/80 text-sm font-medium">Textstorlek</label>
                <span className="text-primary font-mono text-sm">{Math.round(progress.settings.textScale * 100)}%</span>
              </div>
              <input
                id="settings-text" aria-label="Textstorlek"
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
            <span className="material-symbols-outlined text-primary">fullscreen</span>
            <span className="text-white font-bold text-sm uppercase tracking-wider">Skärm</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-white/60">open_in_full</span>
              <div className="text-left">
                <p className="text-white font-medium text-sm">Helskärmsläge</p>
                <p className="text-white/40 text-xs">Maximal inlevelse</p>
              </div>
            </div>
            <div className={`w-10 h-5 rounded-full transition-colors relative ${isFullscreen ? 'bg-primary' : 'bg-white/20'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${isFullscreen ? 'left-5' : 'left-0.5'}`} />
            </div>
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
            <button onClick={() => updateSettings({ colorBlindMode: !progress.settings.colorBlindMode })} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-white">
              Färgblind: {progress.settings.colorBlindMode ? 'På' : 'Av'}
            </button>
            <button onClick={() => updateSettings({ reduceMotion: !progress.settings.reduceMotion })} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-white">
              Reducera motion: {progress.settings.reduceMotion ? 'På' : 'Av'}
            </button>
            <button onClick={() => updateSettings({ debugOverlay: !progress.settings.debugOverlay })} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-white">
              Debug HUD: {progress.settings.debugOverlay ? 'På' : 'Av'}
            </button>
          </div>
        </div>

        {/* Save Sync Section */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary">sync</span>
            <span className="text-white font-bold text-sm uppercase tracking-wider">Säkerhetskopiering</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <button
              onClick={async () => {
                const code = exportProgressCode();
                if (code) {
                  await navigator.clipboard.writeText(code);
                  setSyncMessage('Exportkod kopierad!');
                  setTimeout(() => setSyncMessage(''), 2000);
                }
              }}
              className="px-4 py-2 rounded-lg bg-primary text-[#112218] font-black text-xs uppercase"
            >
              Exportera kod
            </button>
            <button
              onClick={() => {
                const ok = importProgressCode(importCode);
                setSyncMessage(ok ? 'Progress importerad!' : 'Ogiltig kod');
                setTimeout(() => setSyncMessage(''), 2000);
              }}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white font-black text-xs uppercase"
            >
              Importera kod
            </button>
          </div>
          <textarea
            value={importCode}
            onChange={(e) => setImportCode(e.target.value)}
            placeholder="Klistra in exportkod här"
            className="w-full h-20 bg-black/30 rounded-xl border border-white/10 p-3 text-xs text-white/80"
          />
          {syncMessage && <p className="text-primary text-xs mt-2 font-bold">{syncMessage}</p>}
        </div>
      </div>

      <button
        onClick={onBack}
        className="btn-ghost mt-4 w-full py-3 text-xs uppercase tracking-wider"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Tillbaka till menyn
      </button>
    </div>
  );
};

/** HOW TO PLAY **/
export const HowToPlayView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
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
          <p className="eyebrow text-primary">Så spelar du</p>
          <h1 className="mt-1 font-display text-3xl font-black uppercase tracking-tight md:text-5xl">Handboken</h1>
          <p className="mt-2 max-w-lg text-sm text-white/50">
            Allt du behöver för att ta dig genom neonstaden, från första hoppet till sista bossen.
          </p>
        </div>
        <button onClick={onBack} className="btn-ghost px-4 py-2.5 text-[10px] uppercase tracking-wider">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Tillbaka
        </button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#0a1220]/75 p-4 backdrop-blur-md">
          <span className="material-symbols-outlined text-2xl text-primary">flag</span>
          <h2 className="mt-2 font-display text-lg font-black uppercase tracking-tight text-white">Målet</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-white/50">
            Samla <strong className="text-white/80">fiskkvoten</strong> (60–72 % av banans fiskar) och nå
            Jerry längst fram. Tar du alla fiskar väntar en bonus. Bossnivåer kräver att bossen
            besegras först. Varje nivå ger XP, mynt och poäng.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0a1220]/75 p-4 backdrop-blur-md">
          <span className="material-symbols-outlined text-2xl text-cyan-300">gamepad</span>
          <h2 className="mt-2 font-display text-lg font-black uppercase tracking-tight text-white">Kontroller</h2>
          <div className="mt-2 space-y-1.5">
            {[
              { k: 'A / D  ← →', v: 'Rör dig' },
              { k: 'Mellanslag', v: 'Hoppa · dubbelhopp' },
              { k: 'Shift', v: 'Dash' },
              { k: 'Klick / F', v: 'Skjuta' },
              { k: 'Esc / P', v: 'Paus' },
            ].map((c) => (
              <div key={c.k} className="flex items-center justify-between gap-2">
                <span className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold text-white/75">{c.k}</span>
                <span className="text-[10px] text-white/45">{c.v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 backdrop-blur-md">
          <span className="material-symbols-outlined text-2xl text-yellow-300">local_fire_department</span>
          <h2 className="mt-2 font-display text-lg font-black uppercase tracking-tight text-white">Streak</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-white/55">
            Fiskar, fiender och bonusar bygger streaken. Var fjärde aktion höjer multiplikatorn
            (upp till <strong className="text-yellow-200">x8</strong>). Skada nollställer den.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[9px] font-black text-primary">UTAN SKADA +750</span>
            <span className="rounded-md border border-yellow-300/25 bg-yellow-300/10 px-1.5 py-0.5 text-[9px] font-black text-yellow-200">NÄSTAN +75</span>
          </div>
        </div>
      </div>

      <h2 className="mt-6 text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Power-ups</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {powerups.map((p) => (
          <div key={p.name} className="rounded-xl border border-white/[0.08] bg-[#0a1220]/70 p-3">
            <span className={`material-symbols-outlined text-xl ${p.color}`}>{p.icon}</span>
            <p className="mt-1 text-[11px] font-black text-white">{p.name}</p>
            <p className="mt-0.5 text-[9px] leading-relaxed text-white/35">{p.desc}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-6 text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Fiender</h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {enemies.map((e) => (
          <div key={e.name} className="flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-[#0a1220]/70 p-3">
            <span className={`material-symbols-outlined text-xl ${e.color}`}>{e.icon}</span>
            <div>
              <p className="text-[11px] font-black text-white">{e.name}</p>
              <p className="mt-0.5 text-[9px] leading-relaxed text-white/35">{e.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-6 text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Nivåtyper</h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries(LEVEL_MODE_META).map(([key, meta]) => (
          <div key={key} className="rounded-xl border border-white/[0.08] bg-[#0a1220]/70 p-3">
            <span className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: meta.accent }}>{meta.short}</span>
            <p className="mt-1 text-[9px] leading-relaxed text-white/35">{meta.goal}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-[#0a1220]/70 p-4">
        <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">Proffstips</h2>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {[
            'Dubbelhoppet räddar liv – tryck en gång till i luften.',
            'Lär dig sentry-tornens rytm: den lyser rött precis innan skottet.',
            'Nära-träffar ger poäng – men bara en gång per fiende.',
            'Rapid fire gör dig till en kulspruta: spara den till bossen.',
            'Hämta dagliga uppdrag mellan rundorna för extra mynt.',
            'Byt skinn i butiken när du låst upp dem.',
          ].map((tip) => (
            <div key={tip} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-white/45">
              <span className="text-primary">•</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onBack} className="btn-primary mt-6 w-full max-w-xs py-3.5 text-sm">
        <span className="material-symbols-outlined text-lg">check</span>
        Jag förstår
      </button>
    </div>
  );
};

/** LEADERBOARD **/
export const LeaderboardView: React.FC<{ onBack: () => void, onPlay: () => void }> = ({ onBack, onPlay }) => {
  const [scores, setScores] = useState<ScoreEntry[]>([]);

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
          <p className="eyebrow text-primary">Rangordning</p>
          <h1 className="mt-1 font-display text-3xl font-black uppercase tracking-tight md:text-5xl">Topplista</h1>
          <p className="mt-1 text-xs text-white/40">Lokala rekord och legendariska neonlöpare.</p>
        </div>
        <button onClick={onBack} className="btn-ghost px-4 py-2.5 text-[10px] uppercase tracking-wider">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Tillbaka
        </button>
      </div>

      {userBest && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.08] p-3">
          <div className="flex size-10 items-center justify-center rounded-xl text-sm font-black text-white" style={avatarStyle(userBest.name)}>
            {initial(userBest.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-primary/60">Ditt bästa resultat</p>
            <p className="truncate text-sm font-black text-white">{userBest.name} · rank #{userBest.rank}</p>
          </div>
          <p className="tabular text-lg font-black text-primary">{userBest.score.toLocaleString()}</p>
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
              ? 'from-yellow-300/[0.14] to-yellow-300/[0.03] border-yellow-300/25'
              : place === 2
                ? 'from-slate-200/[0.10] to-white/[0.02] border-white/15'
                : 'from-orange-300/[0.10] to-white/[0.02] border-orange-300/20';
            return (
              <div key={`${s.name}-${s.rank}`} className={`flex flex-col items-center ${first ? 'w-[104px] sm:w-36' : 'w-[92px] sm:w-32'}`}>
                <p className={`mb-2 max-w-full truncate text-[11px] font-bold ${s.isUser ? 'text-primary' : 'text-white/80'}`}>
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
                  className={`mt-3 flex w-full ${plinth} flex-col items-center justify-end gap-1 rounded-t-2xl border border-b-0 bg-gradient-to-b ${tint} pb-2.5 backdrop-blur-md`}
                >
                  <span className={`tabular text-sm font-black ${s.isUser ? 'text-primary' : 'text-white/90'}`}>
                    {s.score.toLocaleString()}
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">
                    {s.isUser ? 'Du' : s.level}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full board */}
      <div className="mt-9 overflow-hidden rounded-2xl border border-white/10 bg-[#0a1220]/92 backdrop-blur-xl shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
        <div className="divide-y divide-white/[0.05]">
          {scores.map((s) => (
            <div
              key={`${s.name}-${s.score}-${s.date}`}
              className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${s.isUser ? 'bg-primary/[0.07]' : 'hover:bg-white/[0.04]'}`}
            >
              <span className={`tabular w-6 text-center text-xs font-black ${s.rank === 1 ? 'text-yellow-300' : s.rank === 2 ? 'text-slate-300' : s.rank === 3 ? 'text-orange-300' : 'text-white/30'}`}>
                {s.rank}
              </span>
              <div className={`flex size-8 items-center justify-center rounded-lg text-xs font-black text-white ${s.isUser ? 'ring-2 ring-primary/50' : ''}`} style={avatarStyle(s.name)}>
                {initial(s.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-xs font-bold ${s.isUser ? 'text-primary' : 'text-white/80'}`}>
                  {s.name} {s.isUser && <span className="text-[8px] font-black uppercase tracking-wider text-primary/60">du</span>}
                </p>
                <p className="text-[9px] text-white/30">{s.level} · {s.date}</p>
              </div>
              <p className={`tabular text-sm font-black ${s.isUser ? 'text-primary' : 'text-white/85'}`}>{s.score.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={onBack} className="btn-ghost flex-1 py-3 text-xs uppercase tracking-wider">
          Tillbaka
        </button>
        <button onClick={onPlay} className="btn-primary flex-1 py-3 text-sm">
          <span className="material-symbols-outlined text-lg">play_arrow</span>
          Spela nu
        </button>
      </div>
    </div>
  );
};

/** GAME OVER **/
export const GameOverView: React.FC<{ score: number, fishesCollected?: number, onRestart: () => void, onMenu: () => void }> = ({ score, fishesCollected = 0, onRestart, onMenu }) => {
  const [taunt, setTaunt] = useState<string>('Bättre lycka nästa gång!');
  const [name, setName] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
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
    applyRunResults({
      fishesCollected,
      enemiesDefeated: lastRun.enemiesDefeated || 0,
      levelsCompleted: lastRun.levelsCompleted || 0,
      perfectLevel: !!lastRun.perfectLevel,
      bestCombo: lastRun.bestCombo || 0,
      bossDefeated: !!lastRun.bossDefeated,
      deaths: 1,
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
    if ((lastRun.bestStreak || 0) >= 20) {
      unlockAchievement('streak_20');
    }
  }, [score, fishesCollected, coinsEarned]);

  const handleSaveScore = () => {
    if (name.trim()) {
      setIsSaved(true);
      const highScores = JSON.parse(localStorage.getItem('shadow_paw_scores') || '[]');
      highScores.push({ name: name.trim(), score, date: new Date().toLocaleDateString() });
      localStorage.setItem('shadow_paw_scores', JSON.stringify(highScores));
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
    ctx.fillText(`Poäng: ${score.toLocaleString()}`, 48, 180);
    ctx.fillText(`Fiskar: ${fishesCollected}`, 48, 240);
    ctx.fillText(`Combo: x${lastRun.bestCombo || 0}`, 48, 300);
    ctx.fillStyle = '#95a3b8';
    ctx.font = 'bold 24px Outfit, sans-serif';
    ctx.fillText('shadow-paw-game.vercel.app', 48, 430);

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `shadow-paw-score-${score}.png`;
    a.click();

    const summary = `Jag fick ${score} poäng i Shadow Paw!`;
    // The clipboard is blocked in insecure contexts and by some permission
    // settings, so a failed copy must not swallow the confirmation.
    let copied = false;
    try {
      await navigator.clipboard?.writeText(summary);
      copied = true;
    } catch {
      copied = false;
    }
    setShareMessage(copied ? 'Bild nedladdad + text kopierad!' : 'Bild nedladdad!');
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
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">Status</p>
                <p className="truncate text-xs font-black uppercase tracking-wide text-white/90">Uppdraget misslyckades</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between px-1 text-[9px] font-black uppercase tracking-wider text-white/30">
              <span>Nivåer klara</span>
              <span className="tabular text-white/70">{lastRun.levelsCompleted || 0}</span>
            </div>
            <div className="mt-1 flex items-center justify-between px-1 text-[9px] font-black uppercase tracking-wider text-white/30">
              <span>Bossar</span>
              <span className="tabular text-white/70">{lastRun.bossDefeated ? '1' : '0'}</span>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1">
              <span className="material-symbols-outlined text-sm text-red-300">sentiment_dissatisfied</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-200">Rundan är över</span>
            </span>
            {isRecord && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-300/35 bg-yellow-300/10 px-3 py-1">
                <span className="material-symbols-outlined text-sm text-yellow-300">emoji_events</span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-200">Nytt rekord</span>
              </span>
            )}
          </div>

          <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight md:text-6xl">
            Spelet <span className="text-red-400">över</span>
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/55 md:text-base">{taunt}</p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="col-span-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.14] to-transparent px-4 py-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.22em] text-primary/70">Slutpoäng</p>
                  <p className="tabular text-3xl font-black leading-none text-white md:text-4xl">{score.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">XP intjänat</p>
                  <p className="tabular text-lg font-black text-cyan-300">+{Math.floor(score / 10)}</p>
                </div>
              </div>
            </div>
            {[
              { label: 'Fiskar', value: fishesCollected, tone: 'text-sky-300', icon: 'set_meal' },
              { label: 'Bästa combo', value: lastRun.bestCombo || 0, tone: 'text-cyan-300', icon: 'local_fire_department' },
              { label: 'Bästa streak', value: lastRun.bestStreak || 0, tone: 'text-primary', icon: 'bolt' },
              { label: 'Fiender', value: lastRun.enemiesDefeated || 0, tone: 'text-orange-300', icon: 'swords' },
              { label: 'Mynt i rundan', value: `+${coinsEarned}`, tone: 'text-yellow-300', icon: 'monetization_on' },
              { label: 'Mynt totalt', value: totalCoins, tone: 'text-yellow-200', icon: 'account_balance_wallet' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-2.5 py-2">
                <span className={`material-symbols-outlined text-[14px] ${s.tone}`}>{s.icon}</span>
                <p className={`tabular mt-0.5 text-base font-black leading-none ${s.tone}`}>{s.value}</p>
                <p className="mt-1 truncate text-[8px] font-black uppercase tracking-wider text-white/30">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-yellow-300">emoji_events</span>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/45">Spara till topplistan</p>
            </div>
            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-white/30">person</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSaved}
                  placeholder="Ditt namn"
                  maxLength={15}
                  className={`w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-3 text-sm text-white placeholder-white/25 transition-colors focus:border-primary/50 focus:outline-none ${isSaved ? 'cursor-not-allowed opacity-50' : ''}`}
                />
              </div>
              <button
                onClick={handleSaveScore}
                disabled={isSaved || !name.trim()}
                className="btn-primary shrink-0 px-6 py-3 text-xs"
              >
                {isSaved ? 'Sparat!' : 'Spara'}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button onClick={onRestart} className="btn-primary flex-1 py-3.5 text-sm">
              <span className="material-symbols-outlined text-lg">replay</span>
              Spela igen
            </button>
            <button onClick={onMenu} className="btn-ghost flex-1 py-3.5 text-xs uppercase tracking-wider">
              <span className="material-symbols-outlined text-base">home</span>
              Huvudmeny
            </button>
            <button onClick={handleShareCard} className="btn-ghost flex-1 py-3.5 text-xs uppercase tracking-wider">
              <span className="material-symbols-outlined text-base text-primary">ios_share</span>
              Dela
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

  // Pausing ducks the soundtrack instead of stopping it, so resuming the run
  // does not restart the track from the top.
  const targetVolume = isMuted || isPaused ? 0 : Math.min(1, (musicVolume / 100) * 0.5);

  // Mute + slider changes ramp the live track so nothing clicks.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    const step = (targetVolume - audio.volume) / 8;
    const ramp = setInterval(() => {
      audio.volume = Math.abs(targetVolume - audio.volume) < Math.abs(step) ? targetVolume : audio.volume + step;
      if (audio.volume === targetVolume) clearInterval(ramp);
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
      const fadeStep = targetVolume / 30; // 30 steps for 3 seconds

      fadeIntervalRef.current = setInterval(() => {
        currentVolume += fadeStep;
        if (currentVolume >= targetVolume) {
          currentVolume = targetVolume;
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

// LEVEL DESIGN SYSTEM - 50 unique levels with progressive difficulty
const getLevelDesign = (level: number) => {
  const designs = [
    // Levels 1-10: Tutorial & Easy
    { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'DAY', theme: 'park', difficulty: 1 },
    { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'DAY', theme: 'suburban', difficulty: 1.2 },
    { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'NIGHT', theme: 'city', difficulty: 1.4 },
    { weather: 'REGNIGT', intensity: 'LIGHT', timeOfDay: 'DAY', theme: 'park', difficulty: 1.6 },
    { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'SUNSET', theme: 'industrial', difficulty: 1.8 },
    { weather: 'DIMMIGT', intensity: 'LIGHT', timeOfDay: 'NIGHT', theme: 'downtown', difficulty: 2.0 },
    { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'DAY', theme: 'beach', difficulty: 2.2 },
    { weather: 'SNÖIGT', intensity: 'LIGHT', timeOfDay: 'DAY', theme: 'mountain', difficulty: 2.4 },
    { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'SUNSET', theme: 'forest', difficulty: 2.6 },
    { weather: 'STORMIGT', intensity: 'LIGHT', timeOfDay: 'NIGHT', theme: 'harbor', difficulty: 2.8 },

    // Levels 11-20: Medium
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'sewers', difficulty: 3.0 },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'DAY', theme: 'alpine', difficulty: 3.3 },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'SUNSET', theme: 'construction', difficulty: 3.6 },
    { weather: 'DIMMIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'rooftops', difficulty: 3.9 },
    { weather: 'REGNIGT', intensity: 'LIGHT', timeOfDay: 'DAWN', theme: 'countryside', difficulty: 4.2 },
    { weather: 'SNÖIGT', intensity: 'LIGHT', timeOfDay: 'NIGHT', theme: 'ice_cave', difficulty: 4.5 },
    { weather: 'STORMIGT', intensity: 'LIGHT', timeOfDay: 'DAY', theme: 'power_plant', difficulty: 4.8 },
    { weather: 'DIMMIGT', intensity: 'LIGHT', timeOfDay: 'SUNSET', theme: 'abandoned', difficulty: 5.1 },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'DAY', theme: 'highway', difficulty: 5.4 },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'glacier', difficulty: 5.7 },

    // Levels 21-30: Hard
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'space_station', difficulty: 6.0 },
    { weather: 'DIMMIGT', intensity: 'HEAVY', timeOfDay: 'DAWN', theme: 'volcano', difficulty: 6.4 },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'SUNSET', theme: 'underground', difficulty: 6.8 },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'DAY', theme: 'sky_bridge', difficulty: 7.2 },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'nuclear', difficulty: 7.6 },
    { weather: 'DIMMIGT', intensity: 'HEAVY', timeOfDay: 'DAWN', theme: 'laboratory', difficulty: 8.0 },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'SUNSET', theme: 'datacenter', difficulty: 8.4 },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'arctic_base', difficulty: 8.8 },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'DAY', theme: 'warzone', difficulty: 9.2 },
    { weather: 'DIMMIGT', intensity: 'HEAVY', timeOfDay: 'DAWN', theme: 'quantum', difficulty: 9.6 },

    // Levels 31-40: Very Hard
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'hell', difficulty: 10.0 },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'SUNSET', theme: 'nightmare', difficulty: 10.5 },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'DAY', theme: 'void', difficulty: 11.0 },
    { weather: 'DIMMIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'chaos', difficulty: 11.5 },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'DAWN', theme: 'inferno', difficulty: 12.0 },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'SUNSET', theme: 'abyss', difficulty: 12.5 },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'oblivion', difficulty: 13.0 },
    { weather: 'DIMMIGT', intensity: 'HEAVY', timeOfDay: 'DAY', theme: 'pandemonium', difficulty: 13.5 },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'apocalypse', difficulty: 14.0 },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'DAWN', theme: 'armageddon', difficulty: 14.5 },

    // Levels 41-50: Extreme
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'SUNSET', theme: 'titan', difficulty: 15.0 },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'hades', difficulty: 16.0 },
    { weather: 'DIMMIGT', intensity: 'HEAVY', timeOfDay: 'DAY', theme: 'tartarus', difficulty: 17.0 },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'SUNSET', theme: 'nexus', difficulty: 18.0 },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'omega', difficulty: 19.0 },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'DAWN', theme: 'infinity', difficulty: 20.0 },
    { weather: 'DIMMIGT', intensity: 'HEAVY', timeOfDay: 'SUNSET', theme: 'transcendence', difficulty: 21.0 },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT', theme: 'enlightenment', difficulty: 22.0 },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'DAY', theme: 'ascension', difficulty: 23.0 },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'DAWN', theme: 'legendary', difficulty: 25.0 }
  ];

  return designs[Math.min(level - 1, designs.length - 1)];
};

const getDifficultyProfile = (level: number, playerRank: number) => {
  // t runs 0 -> 1 across the 50-stage campaign. The curve is deliberately
  // gentle for the first stages: level 1 is a tutorial walk, level 2 is still
  // calm, and real pressure only starts once every mechanic has been taught.
  const t = Math.min(1, Math.max(0, (level - 1) / 49));
  const ramp = Math.pow(t, 1.25);
  // Account level gives a little relief, but never turns the late game into a
  // walkover: it is capped at roughly a tenth of the total ramp.
  const rankRelief = Math.min(0.1, Math.max(0, (Math.max(1, playerRank) - 1) / 49) * 0.1);
  const effectiveRamp = Math.max(0, ramp - rankRelief);
  const variant = (level - 1) % 6;
  const variantLengthBonus = [300, 800, 1400, 500, 1000, 1800][variant];

  return {
    levelLength: Math.floor(2600 + level * 150 + effectiveRamp * 1900 + variantLengthBonus),
    // Base width of one ground segment; the generator varies this per segment.
    segmentWidth: Math.max(120, 200 - effectiveRamp * 62),
    // How much harder the level gets between its start and its goal.
    inLevelRamp: 0.2 + effectiveRamp * 1.0,
    // Level 1-2 have no pits at all, so the opening stages can never kill a
    // first-time player by accident. From level 3 the gaps grow steadily.
    holeChance: level <= 2 ? 0 : Math.min(0.36, 0.04 + effectiveRamp * 0.34),
    holeSize: Math.min(0.42, 0.1 + effectiveRamp * 0.3),
    platformCount: Math.floor(8 + level * 0.55 + effectiveRamp * 8),
    enemyCount: Math.floor(1 + Math.max(0, level - 1) * 0.6 + effectiveRamp * 4),
    enemySpeed: 1.1 + Math.max(0, level - 1) * 0.07 + effectiveRamp * 0.8,
    fishCount: Math.floor(10 + level * 0.55 + effectiveRamp * 3),
    hazardCount: level <= 3 ? 0 : Math.floor((level - 3) * 0.4 + effectiveRamp * 4),
    variant,
  };
};

/* ============================ LEVEL BLUEPRINTS ============================
   Every stage gets a structural archetype, not just a new backdrop. Two
   neighbouring levels therefore never share a silhouette: one climbs stairs,
   the next hops islands, the third balances over bridges. Level 1 is always
   the flat tutorial meadow and every fifth level is a boss arena. */

type LevelLayoutId = 'meadow' | 'stairs' | 'islands' | 'canyon' | 'bridges' | 'towers' | 'ruins' | 'gauntlet' | 'arena';

const LEVEL_LAYOUTS: LevelLayoutId[] = ['meadow', 'stairs', 'islands', 'canyon', 'bridges', 'towers', 'ruins', 'gauntlet'];

const LEVEL_LAYOUT_META: Record<LevelLayoutId, { name: string; tagline: string }> = {
  meadow: { name: 'Ängsstart', tagline: 'Breda gräsytor och låga avsatser. Lär känna katten.' },
  stairs: { name: 'Trappstaden', tagline: 'Klättra trappor, fall inte i glappen.' },
  islands: { name: 'Övärlden', tagline: 'Flytande öar över ett svart djup.' },
  canyon: { name: 'Kanjonsprickan', tagline: 'Breda klyftor som kräver dubbelhopp.' },
  bridges: { name: 'Broarna', tagline: 'Smal balansgång över avgrunden.' },
  towers: { name: 'Tornen', tagline: 'Klättra mot skyn för att nå fiskarna.' },
  ruins: { name: 'Ruinerna', tagline: 'Krossade pelare i oregelbunden rytm.' },
  gauntlet: { name: 'Prövningen', tagline: 'Tätt mellan plattformar, fiender och fällor.' },
  arena: { name: 'Bossarenan', tagline: 'En öppen arena. Bara du och bossen.' },
};

/** Structural archetype for a level. Boss stages own a flat arena, level 1
    stays a plain meadow, and everything else cycles through the eight shapes
    so the course reads differently every single stage. */
const getLevelLayout = (level: number): LevelLayoutId => {
  if (level % 5 === 0) return 'arena';
  if (level <= 1) return 'meadow';
  return LEVEL_LAYOUTS[(level - 1) % LEVEL_LAYOUTS.length];
};

/** Small deterministic PRNG so a level is rebuilt identically after a restart:
    the player can learn a course instead of re-rolling the dice. */
const makeRng = (seed: number) => {
  let s = Math.floor(Math.abs(seed)) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

const GROUND_COLOR = '#1c3a2a';
const LEDGE_COLOR = '#234832';

interface LayoutBuildArgs {
  level: number;
  layout: LevelLayoutId;
  levelLength: number;
  groundY: number;
  profile: { inLevelRamp: number; holeChance: number; holeSize: number };
  bossLevel: boolean;
}

/** Builds the solid geometry of a level: ground slabs, floating platforms and
    the pits between them. Fish, enemies and pickups are placed on top of this
    afterwards, so every layout only has to answer "where can the cat stand?". */
const buildLevelLayout = ({ level, layout, levelLength, groundY, profile, bossLevel }: LayoutBuildArgs) => {
  const rng = makeRng(level * 7919 + 17);
  const platforms: any[] = [];
  const holes: any[] = [];

  const ground = (x: number, width: number) => {
    if (width <= 4) return;
    platforms.push({ x, y: groundY, width, height: 44 + Math.round(rng() * 46), color: GROUND_COLOR, isGround: true });
  };
  const ledge = (x: number, y: number, width: number, height = 20, color = LEDGE_COLOR) => {
    if (width <= 4) return;
    platforms.push({ x, y, width, height, color });
  };
  const pit = (x: number, width: number) => {
    if (width <= 0) return;
    holes.push({ x, y: groundY, width });
  };
  // How much of each end is guaranteed safe: the cat spawns in the first
  // stretch and Jerry waits in the last one, so neither may be a death trap.
  const startSafe = bossLevel ? 820 : 760;
  const endSafe = bossLevel ? 1080 : 940;
  const end = Math.max(startSafe + 400, levelLength - endSafe);
  // Difficulty inside the level also widens pits a little as you approach Jerry.
  const pitBonus = Math.min(46, Math.floor(level * 0.6));

  // Any stretch without ground is a bottomless pit. Registering it as a hole
  // lets the renderer draw depth and a warning lip, instead of a hard black band
  // where the floor simply stops.
  const finish = () => {
    const groundGaps = () => {
      const covered = platforms
        .filter((pl) => pl.isGround)
        .map((pl) => [pl.x, pl.x + pl.width] as [number, number])
        .sort((l, r) => l[0] - r[0]);
      const gaps: Array<[number, number]> = [];
      let cursor = 0;
      for (const [start, stop] of covered) {
        if (start > cursor + 4) gaps.push([cursor, start]);
        cursor = Math.max(cursor, stop);
      }
      if (cursor < levelLength - 4) gaps.push([cursor, levelLength]);
      return gaps;
    };

    // A leap wider than the cat can clear would make the stage impossible, so
    // any leftover gap that is not already bridged by stairs, beams or floating
    // platforms gets stepping stones. Designed gaps are left untouched.
    for (const [start, stop] of groundGaps()) {
      const width = stop - start;
      if (width <= 200) continue;
      const bridged = platforms.some(
        (pl) => !pl.isGround && pl.x + pl.width > start && pl.x < stop && pl.y >= groundY - 270,
      );
      if (bridged) continue;
      for (let stoneX = start + 90; stoneX < stop - 70; stoneX += 172) {
        ledge(stoneX, groundY - 46, 96, 18);
      }
    }

    // Everything still uncovered reads as a bottomless pit: register it as a
    // hole so the renderer draws depth and a warning lip instead of a hard
    // black band where the floor simply stops.
    for (const [start, stop] of groundGaps()) {
      holes.push({ x: start, y: groundY, width: stop - start });
    }
    return { platforms, holes };
  };

  ground(0, startSafe);
  ground(levelLength - endSafe, endSafe);

  if (layout === 'arena') {
    // The boss arena is carved out later; keep the run-up flat and readable.
    ground(startSafe, end - startSafe);
    for (let x = startSafe + 300; x < end - 200; x += 560) {
      ledge(x, groundY - 96, 120);
    }
    return finish();
  }

  if (layout === 'meadow') {
    ground(startSafe, end - startSafe);
    for (let x = startSafe + 220; x < end - 220; x += 480) {
      const y = groundY - 64 - Math.round(rng() * 42);
      ledge(x, y, 140 + Math.round(rng() * 60));
      if (rng() > 0.55) ledge(x + 250, y - 58, 96);
    }
    return finish();
  }

  if (layout === 'stairs') {
    let x = startSafe;
    let climb = true;
    while (x < end - 420) {
      const steps = 3 + Math.floor(rng() * 3);
      let y = groundY - 20;
      for (let s = 0; s < steps; s++) {
        y -= 54;
        ledge(x + s * 146, y, 146, 22);
      }
      const topWidth = 170 + Math.round(rng() * 120);
      ledge(x + steps * 146, y, topWidth, 22);
      x += steps * 146 + topWidth;
      // A real pit between staircases: the stairs are the only way across.
      const gap = 84 + Math.round(rng() * 46) + Math.min(40, pitBonus);
      pit(x - 4, gap + 8);
      x += gap;
      if (climb && rng() > 0.6) {
        // Optional high reward ledge above the gap.
        ledge(x - 40, y - 92, 104);
      }
      climb = !climb;
    }
    return finish();
  }

  if (layout === 'islands') {
    let x = startSafe;
    while (x < end - 160) {
      const w = 150 + Math.round(rng() * 110);
      ground(x, Math.min(w, Math.max(80, end - x)));
      if (rng() > 0.35) {
        ledge(x + w * 0.2, groundY - 118 - Math.round(rng() * 70), 84 + Math.round(rng() * 60));
      }
      x += w;
      const gap = 88 + Math.round(rng() * 54) + Math.min(40, pitBonus);
      if (x + gap > end - 80) break;
      pit(x, gap);
      x += gap;
    }
    return finish();
  }

  if (layout === 'canyon') {
    let x = startSafe;
    while (x < end - 220) {
      const w = 240 + Math.round(rng() * 190);
      ground(x, Math.min(w, Math.max(120, end - x)));
      if (rng() > 0.55) ledge(x + 60, groundY - 108 - Math.round(rng() * 52), 104);
      x += w;
      const gap = 104 + Math.round(rng() * 44) + Math.min(46, pitBonus);
      if (x + gap > end - 80) break;
      pit(x, gap);
      x += gap;
    }
    return finish();
  }

  if (layout === 'bridges') {
    // Beams replace the floor in the middle: fall and the run is over.
    let x = startSafe;
    let y = groundY - 44;
    while (x < end - 80) {
      const w = 112 + Math.round(rng() * 52);
      ledge(x, y, Math.min(w, end - x), 18);
      x += w;
      const gap = 66 + Math.round(rng() * 44);
      if (x + gap > end - 60) break;
      pit(x - 3, gap + 6);
      x += gap;
      if (rng() > 0.5) {
        const step = rng() > 0.5 ? -58 : 58;
        y = Math.max(groundY - 250, Math.min(groundY - 30, y + step));
      }
    }
    return finish();
  }

  if (layout === 'towers') {
    ground(startSafe, end - startSafe);
    let x = startSafe + 220;
    while (x < end - 280) {
      const towerH = 110 + Math.round(rng() * 130);
      const towerW = 66 + Math.round(rng() * 26);
      // Solid pillar: the cat lands on top and hops from ledge to ledge.
      platforms.push({ x, y: groundY - towerH, width: towerW, height: towerH, color: LEDGE_COLOR });
      ledge(x - 78, groundY - 74, 68);
      ledge(x + towerW + 12, groundY - 140, 68);
      if (rng() > 0.4) ledge(x + towerW + 96, groundY - towerH + 10, 84);
      x += 260 + Math.round(rng() * 70);
      if (rng() > 0.6) {
        const gap = 96 + Math.round(rng() * 40);
        pit(x - 150, gap);
      }
    }
    return finish();
  }

  if (layout === 'ruins') {
    ground(startSafe, end - startSafe);
    let x = startSafe + 180;
    while (x < end - 200) {
      const h = 50 + Math.round(rng() * 130);
      const w = 60 + Math.round(rng() * 60);
      ledge(x, groundY - h, w, h);
      if (rng() > 0.5) ledge(x + w + 70, groundY - Math.max(70, h - 70), 74);
      x += 190 + Math.round(rng() * 90);
      if (rng() > 0.66) {
        const gap = 92 + Math.round(rng() * 36);
        pit(x - 120, gap);
      }
    }
    return finish();
  }

  // gauntlet: flat ground with a dense, tight ceiling of small platforms.
  ground(startSafe, end - startSafe);
  let gx = startSafe + 120;
  while (gx < end - 160) {
    const w = 72 + Math.round(rng() * 46);
    const y = groundY - 110 - Math.round(rng() * 120);
    ledge(gx, y, w, 18);
    if (rng() > 0.6) ledge(gx + 46, y - 62, w * 0.8, 18);
    gx += 118 + Math.round(rng() * 54);
    if (rng() > 0.75) {
      const gap = 88 + Math.round(rng() * 34);
      pit(gx - 60, gap);
    }
  }
  return finish();
};

/* ---------------------------- BOSS PROFILES ----------------------------- */

type BossPattern = 'orb' | 'burst' | 'fan' | 'sweep' | 'summon' | 'slam';

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
    moves: [['orb'], ['orb', 'burst'], ['burst', 'summon']],
  },
  // Cyber-hunden: fast, aggressive, sweeps the floor in the last phase.
  cyber_dog: {
    cooldown: 86, speed: 6.2, radius: 7, color: '#00e1ff',
    moves: [['burst'], ['burst', 'sweep'], ['burst', 'sweep', 'summon']],
  },
  // Storm-örnen: wide fans that punish standing still.
  storm_eagle: {
    cooldown: 140, speed: 4.8, radius: 8, color: '#ffe600',
    moves: [['fan'], ['fan', 'sweep'], ['fan', 'fan', 'summon']],
  },
  // Tomrums-draken: area denial and adds.
  void_dragon: {
    cooldown: 150, speed: 3.8, radius: 12, color: '#a855f7',
    moves: [['fan', 'orb'], ['fan', 'summon'], ['fan', 'summon', 'sweep']],
  },
  // Skugg-titanen: ground slams and orbs, the hardest final boss.
  shadow_titan: {
    cooldown: 164, speed: 3.2, radius: 14, color: '#ff4d6d',
    moves: [['slam', 'orb'], ['slam', 'summon'], ['slam', 'summon', 'orb']],
  },
};

/* Applies one boss signature move. Kept outside the game loop so the pattern
   logic stays readable and every boss shares the same telegraph rules. */
const fireBossAttack = (
  game: any,
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
      game.toasts.push({ text: 'BOSS TILLKALLAR HJÄLP!', color: '#ff9f43', life: 90, maxLife: 90 });
      if (game.toasts.length > 3) game.toasts.shift();
      AudioEngine.playBossRoar();
      break;
    }
    default:
      shoot(baseAngle, speedBase, profile.radius);
  }
};

const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
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
const pickLightningSpot = (game: any, canvasWidth: number) => {
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

const nextLightningDelay = (game: any) => {
  if (game.weather === 'STORMIGT') return 130 + Math.random() * 170;
  return game.intensity === 'HEAVY' ? 240 + Math.random() * 280 : 520 + Math.random() * 460;
};

const fireLightning = (game: any, x: number, y: number, canvasWidth: number, catX: number) => {
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

const updateLightning = (game: any, canvasWidth: number) => {
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

const drawLightning = (ctx: CanvasRenderingContext2D, game: any, softStrobe = false) => {
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

const getWeatherForLevel = (level: number) => {
  if (level === 1) {
    return { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'DAY' };
  }

  const weatherPresets = [
    { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'DAY' },
    { weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'SUNSET' },
    { weather: 'REGNIGT', intensity: 'LIGHT', timeOfDay: 'DAY' },
    { weather: 'REGNIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT' },
    { weather: 'STORMIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT' },
    { weather: 'SNÖIGT', intensity: 'LIGHT', timeOfDay: 'DAY' },
    { weather: 'SNÖIGT', intensity: 'HEAVY', timeOfDay: 'NIGHT' },
    { weather: 'DIMMIGT', intensity: 'LIGHT', timeOfDay: 'DAWN' },
  ] as const;

  const index = Math.floor(seededRandom(level * 17.371) * weatherPresets.length);
  const previousIndex = Math.floor(seededRandom((level - 1) * 17.371) * weatherPresets.length);
  const safeIndex = index === previousIndex ? (index + 1) % weatherPresets.length : index;

  return weatherPresets[safeIndex];
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GameState = any;

/** Fisher-Yates on a copy, so callers never mutate the theme config. */
const shuffled = <T,>(items: T[]): T[] => {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const SKY_ANIMALS = ['bird', 'pigeon', 'crow', 'seagull', 'eagle', 'bat', 'pelican', 'robot_bird'];
const WAVING_ANIMALS = ['cat', 'stray_cat', 'dog', 'rabbit', 'bear', 'alien_creature', 'cow', 'horse', 'deer'];
// Background creatures are scenery, not characters: keep them small enough
// that the cat always reads as the subject, and the skyline taller than them.
const SCALE_RANGE = { building: [0.62, 1.15] as const, animal: [0.78, 1.12] as const };

/** Gives a flying animal its own flight profile: heading, cruise speed, altitude,
    undulation and wingbeat. Every bird then flies its own line instead of
    gliding in lockstep with its neighbours. */
const assignFlightProfile = (el: BackgroundElement) => {
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

const generateBackgroundElements = (theme: string): BackgroundElement[] => {
  const elements: BackgroundElement[] = [];
  const config = getThemeConfig(theme);
  const count = 18;

  // Shuffled lanes, so the scenery is irregularly spaced instead of sitting on
  // a metronome grid that made neighbours line up like a row of clones.
  const lanes = shuffled(Array.from({ length: count }, (_, i) => (i + 0.5) * (BACKDROP_W / count)));

  for (let i = 0; i < count; i++) {
    const lane = lanes[i] + (Math.random() - 0.5) * 70;
    const roll = Math.random();

    // 60% buildings, 40% animals
    if (roll < 0.6) {
      const bType = config.buildings[Math.floor(Math.random() * config.buildings.length)];
      const color = config.buildingColors[Math.floor(Math.random() * config.buildingColors.length)];
      elements.push({
        kind: 'building',
        subtype: bType,
        lane,
        scale: 0.5 + Math.random() * 0.5,
        color,
        // Buildings stand still: they are the fixed anchor of the skyline.
        drift: 0,
      });
    } else {
      const aType = config.animals[Math.floor(Math.random() * config.animals.length)];
      const isSkyAnimal = SKY_ANIMALS.includes(aType);
      const el: BackgroundElement = {
        kind: 'animal',
        subtype: aType,
        lane,
        scale: 1.4 + Math.random() * 0.6,
        drift: 0,
        phase: Math.random() * Math.PI * 2,
        waves: WAVING_ANIMALS.includes(aType),
        isSkyAnimal,
        skyY: 0,
      };
      assignFlightProfile(el);
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
    const pool = shuffled(kind === 'building' ? config.buildings : config.animals);
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
      assignFlightProfile(el);
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
  cx: number, cy: number, scale: number, alpha: number, profile = 0, night = false
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
  ctx.shadowColor = night ? 'rgba(8, 14, 38, 0.5)' : 'rgba(64, 106, 142, 0.26)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 10;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // A broad, feathered highlight gives the cloud a sunlit, airy top.
  ctx.globalAlpha = alpha * (night ? 0.16 : 0.28);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(-32, -55, 82, 19, -0.12, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** ADVANCED 50-LEVEL PLAYABLE GAME VIEW **/
export const PlayingView: React.FC<{
  onEnd: (score: number, fishesCollected: number) => void;
  startLevel?: number;
}> = ({ onEnd, startLevel = 1 }) => {
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
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;
  // Incremented to rebuild the current level (restart) without changing which
  // level the player is on.
  const [runId, setRunId] = useState(0);
  const [showIntro, setShowIntro] = useState(true);

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
    setRunId((n) => n + 1);
  };

  // The level card introduces the stage for a beat and then fades away.
  useEffect(() => {
    setShowIntro(true);
    const timer = window.setTimeout(() => setShowIntro(false), 2300);
    return () => window.clearTimeout(timer);
  }, [currentLevel, runId]);

  // Alt-tabbing out of the game pauses it instead of letting the cat run into
  // a hazard unseen.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && gameRef.current?.running) {
        setIsPaused(true);
        isPausedRef.current = true;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const [stats, setStats] = useState({ score: 0, progress: 0, collectedCount: 0, totalFish: 0, fishGoal: 0, ammo: 5, weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'NIGHT', combo: 0, levelType: 'Classic', timer: 0, miniEvent: 'NONE', xp: 0, runLevel: 1, xpNeeded: 120, xpIntoLevel: 0, multiplier: 1, streak: 0, dashReady: true, dashPct: 1, comboTimer: 0, noHit: true, nearMisses: 0, toasts: [] as any[], bossHp: 0, bossMaxHp: 0, bossVisible: false, bossName: '', bossPhase: 0, shield: false, magnet: 0, rapid: 0, coinsRun: 0, goalDist: 0 });
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(true);
  const [combo, setCombo] = useState(0);
  const [seasonTheme] = useState(getSeasonTheme());
  const { progress, addCoins, toggleMuted } = useProgress();
  const isMuted = progress.settings.muted;

  const gameRef = useRef<any>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  // Use background music for levels 1-10. Mute + level follow the saved settings.
  useBackgroundMusic(currentLevel, isMuted, progress.settings.musicVolume, isPaused);

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

    const difficultyProfile = getDifficultyProfile(level, progress.level);
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
      Math.ceil((levelLength / ((4.6 + level * 0.08) * 60)) * 1.5 + 14 + difficultyProfile.fishCount * 0.9)
    );

    const game = {
      running: true,
      level: level,
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
      // --- Power-up layer ---
      pickups: [] as any[],
      enemyBullets: [] as any[],
      shield: false,
      buffs: { magnet: 0, rapid: 0 },
      shootCooldown: 0,
      // A short cinematic intro freezes the world for a beat while the level
      // card tells the player where they are and what to do.
      introTimer: level === 1 ? 150 : 110,
      introMax: level === 1 ? 150 : 110,
      killsThisLevel: 0,
      // --- Juice timers ---
      slowMo: 0,
      zoomPunch: 0,
      player: {
        x: 100, y: 150, width: 50, height: 70,
        velocityX: 0, velocityY: 0,
        speed: (4.6 + (level * 0.08)) * (progress.settings.uiScale < 0.95 ? 0.98 : 1),
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
        isBlinking: false, blinkTimer: 0,
        facing: 1 // 1 for right, -1 for left
      },
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
      layout: getLevelLayout(level),
      fishGoal: 0,
      lastStatUpdate: 0
    };

    // Passive perks from skill tree milestones.
    if (progress.level >= 5) game.player.speed += 0.6;
    if (progress.level >= 10) game.ammo += 2;
    if (progress.level >= 15) game.player.invincibleTimer = 20;

    // Generate background elements
    game.backgroundElements = generateBackgroundElements(theme);

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
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            speed: 0.2 + Math.random() * 0.5,
            radius: 100 + Math.random() * 150,
            opacity: 0.05 + Math.random() * 0.1,
            sway: Math.random() * Math.PI * 2
          });
        } else {
          game.weatherParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            speed: weather === 'SNÖIGT' ? (intensity === 'HEAVY' ? 1.5 + Math.random() * 2 : 1 + Math.random() * 2) : 10 + Math.random() * 5,
            length: weather === 'SNÖIGT' ? 0 : 10 + Math.random() * 20,
            radius: weather === 'SNÖIGT' ? 1.5 + Math.random() * 2.5 : 0,
            sway: Math.random() * Math.PI * 2
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
      const bias = 1 - Math.pow(Math.random(), 1 + difficultyProfile.inLevelRamp * 1.4);
      const randomSegment = 3 + Math.floor(bias * Math.max(1, game.platforms.length - 8));
      const plat = game.platforms[randomSegment];
      if (!plat) continue;

      // Skip some ground platforms but not all
      if (plat.isGround && Math.random() > 0.5) continue;

      const ex = plat.x + Math.random() * Math.max(10, plat.width - 40);
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
      const roll = Math.random();
      const enemyType = level >= 5 && roll < 0.16 ? 4 : level >= 3 && roll < 0.32 ? 3 : Math.floor(Math.random() * 3);
      const isTurret = enemyType === 3;
      game.enemies.push({
        x: ex, y: plat.y - 40, width: 40, height: 40,
        velocityX: isTurret ? 0 : difficultyProfile.enemySpeed * depthRamp * (Math.random() > 0.5 ? 1 : -1),
        direction: 1, platform: randomSegment, type: enemyType,
        shootTimer: 70 + Math.floor(Math.random() * 70),
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
        'rat_king': 'RÅTTE-KUNG',
        'cyber_dog': 'CYBER-HUND',
        'storm_eagle': 'STORM-ÖRN',
        'void_dragon': 'TOMRUMS-DRAKEN',
        'shadow_titan': 'SKUGG-TITAN'
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
      const randomPlatIndex = Math.floor(Math.random() * game.platforms.length);
      const plat = game.platforms[randomPlatIndex];

      // 30% flying coins, 70% on/near platforms
      const isFlying = flyingItems && Math.random() > 0.7;

      let fx, fy;
      if (isFlying) {
        // Flying coins - but reachable with double jump!
        // Max height from ground with double jump is about 250px
        fx = 200 + Math.random() * (levelLength - 400);
        // Keep flying coins reachable - not too high!
        fy = canvas.height - 280 + Math.random() * 100;
      } else {
        // On platforms - just above the platform
        fx = plat.x + 10 + Math.random() * (plat.width - 30);
        // Just above the platform - always reachable
        fy = plat.y - 30 - Math.random() * 30;
      }

      // Keep everything reachable
      fy = Math.max(canvas.height - 300, Math.min(fy, canvas.height - 60));
      // Never spawn on top of the cat: the first frame of a level must not
      // silently hand the player a fish they never went and got.
      const clampedFx = Math.max(260, Math.min(fx, levelLength - 50));

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

      if (!fishCollision && !fishTooClose) {
        game.fishes.push({
          x: clampedFx,
          y: fy,
          width: 24,
          height: 14,
          collected: false,
          isFlying: isFlying,
          hoverOffset: Math.random() * Math.PI * 2,
          baseY: fy
        });
        placedFish++;
      }
    }

    // The level goal is a quota, not a full sweep: hunting the last three fish
    // across a long course is busywork, and a fish that lands somewhere awkward
    // used to make a stage outright unwinnable. Collecting everything still pays
    // a perfect-catch bonus, so completionists are rewarded either way.
    game.fishGoal = Math.max(5, Math.min(game.fishes.length, Math.ceil(game.fishes.length * (level <= 2 ? 0.6 : 0.72))));

    // Add fun hazards to keep levels unique and less repetitive.
    const hazardCount = levelMode === 'Boss Battle'
      ? 0
      : (levelMode === 'Survival' ? Math.floor(difficultyProfile.hazardCount * 1.15) : difficultyProfile.hazardCount);
    let hazardAttempts = 0;
    while (game.hazards.length < hazardCount && hazardAttempts < hazardCount * 20) {
      hazardAttempts++;
      // Like enemies, hazards cluster toward the far end of the level.
      const bias = 1 - Math.pow(Math.random(), 1 + difficultyProfile.inLevelRamp * 1.2);
      const randomPlatIndex = 4 + Math.floor(bias * Math.max(1, game.platforms.length - 10));
      const plat = game.platforms[randomPlatIndex];
      if (!plat || plat.width < 80) continue;

      const hx = plat.x + 10 + Math.random() * Math.max(10, plat.width - 70);
      if (hx < 450 || hx > levelLength - 400) continue;

      // Keep boss arenas readable and free of unrelated hazard clutter.
      if (level % 5 === 0 && hx > levelLength - 1500) continue;
      const tooClose = game.hazards.some((h: any) => Math.abs(h.x - hx) < 180);
      if (tooClose) continue;

      // Never stack a hazard on top of an enemy patrol spot: it turns the level
      // into an unavoidable hit.
      const onEnemy = game.enemies.some((e: any) => Math.abs(e.x - hx) < 90 && Math.abs(e.y - (plat.y - 40)) < 70);
      if (onEnemy) continue;

      const hazardRoll = Math.random();
      if (difficultyProfile.variant % 2 === 0 && hazardRoll < 0.45) {
        game.hazards.push({
          type: 'movingSaw',
          x: hx,
          baseX: hx,
          y: plat.y - 24,
          width: 28,
          height: 28,
          range: 35 + Math.random() * 50,
          phase: Math.random() * Math.PI * 2,
          speed: 0.03 + Math.random() * 0.04,
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
          active: Math.random() > 0.4,
          timer: 70 + Math.floor(Math.random() * 60),
          onDuration: 60 + Math.floor(Math.random() * 70),
          offDuration: 70 + Math.floor(Math.random() * 90),
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
      const pool = candidatePlatforms[Math.floor(Math.random() * candidatePlatforms.length)];
      const pxx = pool.x + 30 + Math.random() * Math.max(10, pool.width - 60);
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
        hover: Math.random() * Math.PI * 2,
        spin: Math.random() * Math.PI * 2,
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
          hover: Math.random() * Math.PI * 2,
          spin: Math.random() * Math.PI * 2,
          arena: true,
        });
      });
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
      if (progress.settings.haptics && navigator.vibrate) navigator.vibrate(12);
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
      if (progress.settings.haptics && navigator.vibrate) navigator.vibrate(9);
      AudioEngine.playJump();
    }
  };

  const triggerJump = () => {
    requestJump();
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
    if (progress.settings.haptics && navigator.vibrate) navigator.vibrate(18);
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

    const multiplierBonus = Math.round(baseScore * (game.multiplier - 1) * 0.5);
    const comboBonus = Math.min(100, Math.max(0, (game.combo - 1) * 6));
    if (comboBonus > 0) {
      game.floatingTexts.push({ x, y: y - 18, text: `COMBO x${game.combo} +${comboBonus}`, life: 35, color: '#7ef7c2' });
    }
    if (multiplierBonus > 0) {
      game.floatingTexts.push({ x, y: y - 44, text: `x${game.multiplier} MULTIPLIER +${multiplierBonus}`, life: 45, color: '#ffd166' });
    }
    if (game.multiplier > 1 && game.multiplier !== (game.lastMilestoneMultiplier || 1)) {
      game.lastMilestoneMultiplier = game.multiplier;
      AudioEngine.playCombo(game.multiplier);
      pushToast(game, `MULTIPLIKATOR x${game.multiplier}`, '#ffd166');
    }
    game.score += baseScore + comboBonus + multiplierBonus;
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
      pushToast(game, `NIVÅ ${game.runLevel}! +2 SKOTT`, '#2bee79');
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

  const persistRunSummary = (game: any, perfectLevel: boolean) => {
    localStorage.setItem('shadow_paw_last_run', JSON.stringify({
      enemiesDefeated: game.enemiesDefeatedInRun || 0,
      levelsCompleted: game.levelsCompletedInRun || 0,
      bestCombo: game.bestComboInRun || 0,
      bossDefeated: game.bossDefeatedInRun || false,
      perfectLevel,
      bestStreak: game.bestStreak || 0,
      nearMisses: game.nearMisses || 0,
      noHit: !!game.noHit,
      runLevel: game.runLevel || 1,
      coins: game.coinsThisLevel || 0,
    }));
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
      pushToast(game, 'SKÖLDEN TOG SMÄLLEN!', '#7ee7ff');
      if (progress.settings.haptics && navigator.vibrate) navigator.vibrate(20);
      AudioEngine.playShieldBreak();
      return 'shielded';
    }

    game.lives--;
    p.invincible = true;
    // Long enough to actually escape contact: the old 1.6s window could expire
    // while the cat was still pressed against the same enemy or wall.
    p.invincibleTimer = 120;
    p.velocityY = Math.min(p.velocityY, -lift - 1.5);
    p.velocityX = -p.facing * 7;
    game.combo = 0;
    game.streak = 0;
    game.multiplier = 1;
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
    if (progress.settings.haptics && navigator.vibrate) navigator.vibrate(35);
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
        label = 'SKÖLD AKTIVERAD';
        color = '#7ee7ff';
        break;
      case 'magnet':
        game.buffs.magnet = 620;
        label = 'FISKMAGNET · 10s';
        color = '#ffd166';
        break;
      case 'rapid':
        game.buffs.rapid = 540;
        label = 'RAPID ELD · 9s';
        color = '#ff8f6b';
        break;
      case 'heart':
        game.lives = Math.min(6, game.lives + 1);
        label = '+1 LIV';
        color = '#ff5f8a';
        break;
      case 'ammo':
        game.ammo += 6;
        game.score += 50;
        label = '+6 SKOTT';
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

  const startNextLevel = () => {
    setShowLevelComplete(false);
    setLevelSummary(null);
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
    if (!rapid && game.ammo <= 0) return;
    const playerCenterX = game.player.x + game.player.width / 2;
    const playerCenterY = game.player.y + game.player.height / 2;

    let dx, dy;
    if (targetX !== null && targetY !== null) {
      dx = targetX - (playerCenterX - game.scrollX);
      dy = targetY - playerCenterY;
    } else {
      // Shoot framåt i den riktning katten tittar om ingen koordinat ges
      dx = game.player.facing * 500;
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
        x: playerCenterX,
        y: playerCenterY,
        vx: Math.cos(angle) * bulletSpeed,
        vy: Math.sin(angle) * bulletSpeed,
        radius: rapid ? 7 : 6,
        life: 110,
        tint: rapid ? '#7ee7ff' : '#ff4d4d',
      });
    });
    game.shootCooldown = rapid ? 6 : 10;
    if (!rapid) game.ammo--;
    if (progress.settings.haptics && navigator.vibrate) navigator.vibrate(8);
    AudioEngine.playShoot();
  };

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
    gameRef.current = game;
    // Debug handles the automated play-test uses to inspect live state and jump
    // between stages. They expose nothing the player can abuse in a local game.
    (window as any).__SP = game;
    (window as any).__SP_NEXT = startNextLevel;

    const handleKeyDown = (e: KeyboardEvent) => setKeyState(e.keyCode, true);
    const handleKeyUp = (e: KeyboardEvent) => setKeyState(e.keyCode, false);
    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
      fireBullet(mouseX, mouseY);
    };

    // Touch controls for mobile
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const touchX = (touch.clientX - rect.left) * (canvas.width / rect.width);
      const touchY = (touch.clientY - rect.top) * (canvas.height / rect.height);

      // Jump on left half of screen
      if (touchX < canvas.width / 2) {
        triggerJump();
      } else {
        // Shoot on right half of screen
        fireBullet(touchX, touchY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const touchX = (touch.clientX - rect.left) * (canvas.width / rect.width);

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

      // Level clock (used for the results card, independent of the Speed Run
      // countdown).
      game.levelSeconds = (game.levelSeconds || 0) + 1 / 60;
      // Accessibility: motion-sensitive players can turn off shake and punch-in.
      if (progress.settings.reduceMotion) {
        game.screenShake = 0;
        game.zoomPunch = 0;
      }

      // Player Logic
      const p = game.player;
      const gravityMod = game.miniEvent.active && game.miniEvent.type === 'LOW_GRAVITY' ? 0.65 : 1;
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
        const accel = p.onGround ? 1.15 : 0.7;
        const friction = p.onGround ? game.friction : 0.965;
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

      if (game.miniEvent.active && game.miniEvent.type === 'WIND') {
        p.velocityX += Math.sin(Date.now() / 250) * 0.2;
      }

      // Clamp to level bounds so the cat can't run out of the world.
      p.x = Math.max(0, Math.min(p.x, game.levelLength - p.width));

      // Buffered jump + coyote time
      if (p.jumpBuffer > 0) p.jumpBuffer--;
      if (p.coyoteTimer > 0) p.coyoteTimer--;
      if (p.jumpBuffer > 0 && (p.onGround || p.coyoteTimer > 0)) {
        tryPerformJump(game);
        p.jumpBuffer = 0;
      } else if (p.jumpBuffer > 0 && p.isJumping && p.canDoubleJump && !p.hasDoubleJumped && p.velocityY > -2) {
        tryPerformJump(game);
        p.jumpBuffer = 0;
      }

      p.x += p.velocityX;
      p.y += p.velocityY;

      // Squash and stretch relax back toward neutral.
      p.squash += (1 - p.squash) * 0.12;
      p.stretch += (1 - p.stretch) * 0.12;
      if (Math.abs(p.velocityX) > 0.4) p.runCycle += 0.28;

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
          if (e.x < b.x + b.radius && e.x + e.width > b.x - b.radius && e.y < b.y + b.radius && e.y + e.height > b.y - b.radius) {
            e.x = -1000; b.life = 0;
            registerCombo(game, 200, e.x, e.y);
            grantXp(game, 25);
            awardCoins(game, 3);
            game.enemiesDefeatedInRun = (game.enemiesDefeatedInRun || 0) + 1;
            game.killsThisLevel = (game.killsThisLevel || 0) + 1;
            AudioEngine.playExplosion();

            // Explosion particles
            for (let i = 0; i < 15; i++) {
              game.particles.push({
                x: e.x + e.width / 2, y: e.y + e.height / 2,
                vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
                life: 30, color: '#ff2222', size: Math.random() * 4 + 2
              });
            }
            // Floating score text
            game.floatingTexts.push({ x: e.x, y: e.y, text: '+200', life: 40, color: '#ff2222' });
          }
        });

        if (game.boss && game.boss.hp > 0) {
          const boss = game.boss;
          if (boss.x < b.x + b.radius && boss.x + boss.width > b.x - b.radius && boss.y < b.y + b.radius && boss.y + boss.height > b.y - b.radius) {
            b.life = 0;
            boss.hp--;
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
            game.floatingTexts.push({ x: boss.x + boss.width/2, y: boss.y - 10, text: `BOSS HP ${boss.hp}/${boss.maxHp}`, life: 30, color: '#ff6b6b' });
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
              pushToast(game, `${boss.name} BESEGRAD! +${50 + boss.phase * 20} MYNT`, '#ff9f43');
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
          pushToast(game, 'TIDEN UTE! -1 LIV', '#ff8888');
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
            if (!wasOnGround) {
              // Landing squash + dust so the moment reads clearly.
              game.player.squash = 1 + Math.min(0.5, impactSpeed * 0.04);
              game.player.stretch = 0.78;
              for (let i = 0; i < 8; i++) {
                game.particles.push({
                  x: game.player.x + game.player.width / 2 + (Math.random() - 0.5) * 30,
                  y: game.player.y + game.player.height,
                  vx: (Math.random() - 0.5) * 4,
                  vy: -Math.random() * 1.5,
                  life: 18, color: 'rgba(220,230,220,0.8)', size: Math.random() * 3 + 1
                });
              }
            }
            break; // Found a platform, stop checking
          }
        }
      }
      if (!game.player.onGround && wasOnGround) {
        game.player.coyoteTimer = 7;
      }

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
            game.score += 75;
            game.floatingTexts.push({ x: e.x, y: e.y - 20, text: 'NÄSTAN! +75', life: 40, color: '#7ef7c2' });
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
            e.x += e.velocityX;
            if (e.x < p.x || e.x + e.width > p.x + p.width) e.velocityX *= -1;
          }
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

            if (isFalling && isAboveEnemy && playerBottom < enemyTop + 20) {
              // Player jumps on enemy - defeat enemy!
            const enemyCenterXBeforeRemove = e.x + e.width / 2;
            const enemyCenterYBeforeRemove = e.y + e.height / 2;
            e.x = -1000;
            registerCombo(game, 200, enemyCenterXBeforeRemove, enemyCenterYBeforeRemove);
            grantXp(game, 25);
            awardCoins(game, 2);
            game.enemiesDefeatedInRun = (game.enemiesDefeatedInRun || 0) + 1;
            game.killsThisLevel = (game.killsThisLevel || 0) + 1;
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
          pushToast(game, `BOSS INKOMMER · ${boss.name}`, '#ff9f43');
          game.screenShake = Math.max(game.screenShake, 14);
          game.slowMo = 24;
          game.zoomPunch = 16;
          AudioEngine.playBossRoar();
        }
        boss.auraAngle = (boss.auraAngle || 0) + 0.05;
        
        // Beräkna fas baserat på HP
        const hpPct = boss.hp / boss.maxHp;
        const newPhase = hpPct > 0.6 ? 0 : hpPct > 0.3 ? 1 : 2;
        if (newPhase > boss.phase) {
          boss.phase = newPhase;
          game.screenShake = 20;
          game.slowMo = 30;
          pushToast(game, `${boss.name} FAS ${boss.phase + 1}!`, '#ff6b35');
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
              boss.telegraph = Math.max(12, 26 - (boss.tier || 1) * 2);
              AudioEngine.playBossRoar();
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
        game.lives--;
        game.noHit = false;
        game.slowMo = 10;
        game.screenShake = 12;
        const safePlatforms = game.platforms
          .filter((pl: any) => pl.isGround && pl.x < game.player.x + 20 && !pl.chasm)
          .sort((a: any, b: any) => b.x - a.x);
        const safe = safePlatforms[0];
        game.player.x = safe ? safe.x + Math.min(safe.width - game.player.width / 2, Math.max(game.player.width / 2, safe.width / 2)) : 160;
        game.player.y = (safe ? safe.y : game.groundY) - game.player.height - 30;
        game.player.velocityY = 0;
        game.player.velocityX = 0;
        game.player.invincible = true;
        game.player.invincibleTimer = 70;
        AudioEngine.playLifeLost();
        pushToast(game, '-1 LIV · TILLBAKA PÅ SPÅRET', '#ff8888');
        if (game.lives <= 0) endRun(game, 'hole');
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
          if (game.buffs.magnet > 0) {
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
            AudioEngine.playCoin(game.streak || 0);
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
              pushToast(game, '+5 MYNT! +1 SKOTT!', '#ffd700');
              game.floatingTexts.push({ x: f.x, y: f.y - 30, text: '+5 MYNT! +1 SKOTT!', life: 60, color: '#ffd700' });
            }

            // Floating score text
            game.floatingTexts.push({ x: f.x, y: f.y, text: '+50', life: 40, color: '#ffd700' });
          }
        }
      });

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

      // Background - neon sky driven by time of day and season
      const now = Date.now();
      const timeSec = now / 1000;
      const isNight = game.timeOfDay === 'NIGHT';
      // Night keeps its moody seasonal mood; every daylight sky is a bright,
      // cheerful blue so sunny levels never read as a drab orange wash.
      // Daylight keeps a saturated blue at the top and only softens near the
      // horizon; a uniformly pale sky was what made the sunny stages look foggy.
      const seasonPalette: Record<string, { night: [string, string, string]; day: [string, string, string] }> = {
        winter: { night: ['#0b1a3a', '#1b2f5c', '#3a6ea5'], day: ['#57b2e0', '#9ed6f2', '#dceffb'] },
        spring: { night: ['#0d2b2a', '#134a3f', '#2b8a6f'], day: ['#2ba3e6', '#74c9f2', '#bce7fb'] },
        summer: { night: ['#0a1f3d', '#123a6b', '#2f7fb8'], day: ['#1596dd', '#5fc2f0', '#b2e2fa'] },
        autumn: { night: ['#2b1430', '#4a1f3d', '#8a3b4a'], day: ['#2fa5e0', '#79cbf1', '#bfe9fb'] },
      };
      const palette = seasonPalette[seasonTheme] || seasonPalette.summer;
      const base = isNight ? palette.night : palette.day;

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, base[0]);
      gradient.addColorStop(0.5, base[1]);
      gradient.addColorStop(1, base[2]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Sun glow, placed opposite the light direction for a lit-from-the-side look.
      const sunX = canvas.width * 0.78;
      const sunY = canvas.height * 0.2;
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, canvas.height * 0.55);
      // Daylight glow stays near-white; a warm amber wash desaturated the blue sky.
      sunGlow.addColorStop(0, isNight ? 'rgba(180,200,255,0.22)' : 'rgba(255,252,232,0.32)');
      sunGlow.addColorStop(0.45, isNight ? 'rgba(120,150,220,0.07)' : 'rgba(255,246,214,0.12)');
      sunGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Visible sun / moon disc, softened by the halo above. Having a real
      // light source gives the whole scene direction and depth.
      ctx.save();
      ctx.globalAlpha = isNight ? 0.9 : 0.85;
      const disc = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 46);
      disc.addColorStop(0, isNight ? '#eef4ff' : '#fffbe8');
      disc.addColorStop(0.55, isNight ? 'rgba(214,228,255,0.95)' : 'rgba(255,246,206,0.95)');
      disc.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 46, 0, Math.PI * 2);
      ctx.fill();
      if (isNight) {
        // A couple of craters keep the moon from reading as a white hole.
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#8796b8';
        ctx.beginPath();
        ctx.arc(sunX - 10, sunY - 6, 8, 0, Math.PI * 2);
        ctx.arc(sunX + 9, sunY + 8, 5.5, 0, Math.PI * 2);
        ctx.arc(sunX + 4, sunY - 14, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Neon horizon glow behind the skyline
      const horizonGlow = ctx.createRadialGradient(
        canvas.width / 2, canvas.height - 60, 0,
        canvas.width / 2, canvas.height - 60, canvas.width * 0.7
      );
      const glowAlpha = isNight ? 0.26 : 0.1;
      horizonGlow.addColorStop(0, `rgba(43, 238, 121, ${glowAlpha})`);
      horizonGlow.addColorStop(0.5, 'rgba(43, 238, 121, 0.05)');
      horizonGlow.addColorStop(1, 'rgba(43, 238, 121, 0)');
      ctx.fillStyle = horizonGlow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Deterministic hash, so the sky looks randomly scattered instead of a
      // regular lattice of evenly spaced dots.
      const skyHash = (n: number) => {
        const s = Math.sin(n * 127.1) * 43758.5453;
        return s - Math.floor(s);
      };

      if (isNight) {
        // Starfield, three depths. It drifts on its own slow clock - the cat
        // running across the level must not drag the stars along.
        const span = canvas.width + 60;
        for (let layer = 0; layer < 3; layer++) {
          const size = 0.5 + layer * 0.45;
          const drift = timeSec * (1.2 + layer * 2.2);
          for (let i = 0; i < 42; i++) {
            const seed = i + layer * 97;
            const sx = ((((skyHash(seed) * span + drift) % span) + span) % span) - 30;
            const sy = skyHash(seed * 2.31 + 7) * canvas.height * 0.62;
            if (sx < -10 || sx > canvas.width + 10) continue;
            // Gentle twinkle keeps the field alive without pulsing.
            const twinkle = 0.72 + 0.28 * Math.sin(timeSec * (1.1 + skyHash(seed * 5.7)) * 2 + seed);
            ctx.fillStyle = `rgba(255,255,255,${(0.2 + layer * 0.16) * twinkle})`;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Clouds live in every sky - bright white by day, moonlit silver-blue at
      // night. Fewer, larger formations with varied profiles and clear depth;
      // their gentle wind drift is time-based, never tied to the player's camera.
      const cloudSpan = canvas.width + 440;
      // Smaller, softer clouds: at full scale three of them filled the whole
      // sky and made the level look like a screensaver.
      const clouds = [
        { scale: 0.5, y: 176, alpha: isNight ? 0.6 : 0.9 },
        { scale: 0.34, y: 104, alpha: isNight ? 0.44 : 0.72 },
        { scale: 0.58, y: 148, alpha: isNight ? 0.64 : 0.92 },
        { scale: 0.4, y: 112, alpha: isNight ? 0.48 : 0.78 },
      ];
      clouds.forEach((cloud, i) => {
        const drift = timeSec * 8;
        const x = ((((i * canvas.width / 3 + drift) % cloudSpan) + cloudSpan) % cloudSpan) - 110;
        drawCloud(ctx, x, cloud.y, cloud.scale, cloud.alpha, i, isNight);
      });

      // Distant land: two soft ridgelines with a very slow parallax drift. They
      // give the horizon depth and stop the sky from meeting the ground in one
      // hard line when the city silhouettes are sparse.
      ctx.save();
      const ridgeBase = game.groundY ?? canvas.height - 96;
      const ridges: Array<[number, string, number, number, number]> = [
        [0.045, isNight ? '#0a1a2b' : '#7fb4c9', 150, 0.0035, 30],
        [0.09, isNight ? '#0d2438' : '#659cb5', 92, 0.0062, 18],
      ];
      ridges.forEach(([parallax, color, height, freq, amp], layer) => {
        ctx.globalAlpha = isNight ? 0.55 : 0.38;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-20, canvas.height);
        for (let x = -20; x <= canvas.width + 40; x += 16) {
          const wx = x + game.scrollX * parallax;
          const y = ridgeBase - height - Math.sin(wx * freq) * amp - Math.cos(wx * freq * 2.1 + layer) * amp * 0.45;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(canvas.width + 20, canvas.height);
        ctx.closePath();
        ctx.fill();
      });
      // Atmospheric haze so the ridgelines fade into the sky rather than
      // reading as solid cut-outs.
      const haze = ctx.createLinearGradient(0, ridgeBase - 230, 0, ridgeBase - 20);
      haze.addColorStop(0, isNight ? 'rgba(20,40,70,0)' : 'rgba(255,255,255,0)');
      haze.addColorStop(1, isNight ? 'rgba(30,60,95,0.5)' : 'rgba(236,250,255,0.3)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = haze;
      ctx.fillRect(0, ridgeBase - 230, canvas.width, 210);
      ctx.restore();

      // Depth layer: a far skyline (urban chapters) or treeline (green chapters)
      // with slow parallax. It sits behind the hand-placed scenery and gives the
      // horizon several planes instead of one painted backdrop.
      {
        const themeName = String(game.theme || '');
        const urbanTheme = /city|downtown|industrial|construction|rooftop|power|highway|space|data|warzone|quantum|harbor|sewer|nuclear|laboratory|underground|roof/.test(themeName);
        const drawDepthLayer = (parallax: number, baseH: number, alpha: number, seedBase: number, color: string) => {
          const span = 240;
          const offset = ((game.scrollX * parallax) % span + span) % span;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = color;
          for (let i = -1; i < Math.ceil(canvas.width / span) + 2; i++) {
            const r1 = skyHash(seedBase + i * 3.7);
            const r2 = skyHash(seedBase + i * 7.1 + 5);
            const w = 46 + r1 * 84;
            const h = baseH * (0.3 + r2 * 0.55);
            const x = i * span - offset + r1 * 60;
            const y = ridgeBase - h;
            if (urbanTheme) {
              ctx.fillRect(x, y, w, h);
              if (r2 > 0.65) ctx.fillRect(x + w * 0.2, y - 14, 3, 14);
              if (r1 > 0.55) ctx.fillRect(x + w * 0.55, y - 22, w * 0.25, 22);
            } else {
              // Distant pines stand ON the horizon: a trunk plus three stacked
              // canopy tiers. The old single triangle floated above the ridge
              // and read as a pale ghost shape behind the playfield.
              const baseY = ridgeBase - 2;
              const treeH = h * 0.86;
              ctx.fillRect(x + w * 0.5 - Math.max(1.5, w * 0.03), baseY - treeH * 0.22, Math.max(3, w * 0.06), treeH * 0.22);
              for (let tier = 0; tier < 3; tier++) {
                const tierTop = baseY - treeH * (1 - tier * 0.3);
                const tierBase = baseY - treeH * (0.38 - tier * 0.13);
                const tierW = w * (0.52 + tier * 0.26);
                ctx.beginPath();
                ctx.moveTo(x + w * 0.5, tierTop);
                ctx.lineTo(x + w * 0.5 + tierW / 2, tierBase);
                ctx.lineTo(x + w * 0.5 - tierW / 2, tierBase);
                ctx.closePath();
                ctx.fill();
              }
            }
          }
          ctx.globalAlpha = 1;
        };
        drawDepthLayer(0.025, 260, isNight ? 0.62 : 0.2, 11, isNight ? '#071224' : '#6ba0b8');
        drawDepthLayer(0.065, 190, isNight ? 0.72 : 0.22, 47, isNight ? '#0a1830' : '#578ba5');
      }

      // Scenery has two layers. Buildings are the fixed skyline and stay in
      // screen space; animals - on the ground and in the sky - are anchored in
      // the level and scroll against game.scrollX like the platforms, so the
      // cat's movement can never drag one along with it.
      ctx.save();
      // Two depth layers. The skyline rests in the distance while the animals
      // stand in front of it - they are nearer the cat, so they are painted
      // last and drawn solid instead of as faint as the far-off buildings.
      const sceneryLayers: Array<[number, any[]]> = [
        [0.55, game.backgroundElements.filter((el: any) => el.kind === 'building')],
        [0.8, game.backgroundElements.filter((el: any) => el.kind !== 'building')],
      ];
      sceneryLayers.forEach(([layerAlpha, elements]) => {
        ctx.globalAlpha = layerAlpha;
        elements.forEach((el: any) => {
        const span = canvas.width + 500;
        const baseGround = game.groundY ?? canvas.height - 96;
        const groundY = baseGround;
        const s = el.scale;

        if (el.isSkyAnimal) {
          // Flying animals are anchored in the LEVEL, not in the viewport. The
          // camera shifts them exactly as much as it shifts the ground, so the
          // cat's movement can never drag a bird along with it. The strip they
          // roam is wider than the screen, so birds are regularly off screen
          // instead of hovering in view forever.
          const dir = el.dir ?? 1;
          const speed = el.speed ?? 32;
          const worldX = (el.worldX ?? el.lane) + dir * timeSec * speed - game.scrollX;
          const sx = ((((worldX % SKY_WORLD_W) + SKY_WORLD_W) % SKY_WORLD_W)) - 300;
          if (sx < -360 || sx > canvas.width + 360) return;

          // Undulation plus a slow climb/dive, so each bird traces a real,
          // slightly different flight path instead of a straight line.
          const bob = Math.sin(timeSec * el.bobFreq + el.phase) * el.bobAmp;
          const drift = Math.sin(timeSec * 0.21 + el.phase * 0.5) * 34;
          const flyY = groundY + el.skyY + bob + drift;
          // Nose follows the path: banks with the undulation and the climb.
          const pitch = el.pitch + Math.cos(timeSec * el.bobFreq + el.phase) * 0.12;

          ctx.save();
          ctx.translate(sx, flyY);
          // Facing travels with the heading, so a bird flying left is mirrored.
          ctx.scale(dir, 1);
          // Rotate around the body centre rather than the feet, so the pitch
          // reads as banking instead of the whole bird swinging sideways.
          ctx.translate(0, -24 * s);
          // Mirroring flips the sign of a rotation, so negate the pitch when the
          // bird is heading left to keep climbing and diving consistent.
          ctx.rotate(dir === -1 ? -pitch : pitch);
          ctx.translate(0, 24 * s);
        } else if (el.kind === 'animal') {
          // Ground animals are anchored in the LEVEL, not in the viewport. Their
          // screen x is a real world position minus the camera, exactly like the
          // platforms, so the cat's movement can never drag one along. Pinning
          // them to el.lane was what made them look like they followed the cat.
          const worldX = (el.worldX ?? el.lane) - game.scrollX;
          const sx = ((((worldX % GROUND_WORLD_W) + GROUND_WORLD_W) % GROUND_WORLD_W)) - 300;
          if (sx < -360 || sx > canvas.width + 360) return;
          ctx.save();
          ctx.translate(sx, groundY);
        } else {
          // Buildings are the fixed backdrop skyline: they deliberately stay put
          // in screen space so the horizon never slides when the cat runs.
          const sx = ((((el.lane % span) + span) % span)) - 250;
          if (sx < -300 || sx > canvas.width + 300) return;
          ctx.save();
          ctx.translate(sx, groundY);
        }

        if (el.kind === 'building') {
          const c = el.color;
          switch (el.subtype) {
            case 'skyscraper': {
              const w = 60 * s, h = 220 * s;
              ctx.fillStyle = c;
              ctx.fillRect(-w / 2, -h, w, h);
              ctx.fillStyle = 'rgba(255,255,180,0.5)';
              for (let wy = -h + 10 * s; wy < -10 * s; wy += 22 * s) {
                for (let wx = -w / 2 + 6 * s; wx < w / 2 - 6 * s; wx += 16 * s) {
                  ctx.fillRect(wx, wy, 8 * s, 12 * s);
                }
              }
              break;
            }
            case 'apartment': {
              const w = 80 * s, h = 120 * s;
              ctx.fillStyle = c;
              ctx.fillRect(-w / 2, -h, w, h);
              ctx.fillStyle = 'rgba(255,255,150,0.45)';
              for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 3; col++) {
                  ctx.fillRect(-w / 2 + 10 * s + col * 22 * s, -h + 15 * s + row * 26 * s, 12 * s, 16 * s);
                }
              }
              break;
            }
            case 'house': {
              const w = 70 * s, h = 60 * s;
              ctx.fillStyle = c;
              ctx.fillRect(-w / 2, -h, w, h);
              ctx.fillStyle = '#8B3A3A';
              ctx.beginPath();
              ctx.moveTo(-w / 2 - 5 * s, -h);
              ctx.lineTo(0, -h - 35 * s);
              ctx.lineTo(w / 2 + 5 * s, -h);
              ctx.closePath(); ctx.fill();
              ctx.fillStyle = 'rgba(255,255,150,0.6)';
              ctx.fillRect(-w / 2 + 10 * s, -h + 12 * s, 18 * s, 20 * s);
              ctx.fillRect(w / 2 - 28 * s, -h + 12 * s, 18 * s, 20 * s);
              ctx.fillStyle = '#5a3a1a';
              ctx.fillRect(-8 * s, -h + h - 26 * s, 16 * s, 26 * s);
              break;
            }
            case 'barn': {
              const w = 90 * s, h = 80 * s;
              ctx.fillStyle = '#a03020';
              ctx.fillRect(-w / 2, -h, w, h);
              ctx.fillStyle = '#802010';
              ctx.beginPath();
              ctx.moveTo(-w / 2, -h);
              ctx.lineTo(0, -h - 40 * s);
              ctx.lineTo(w / 2, -h);
              ctx.closePath(); ctx.fill();
              ctx.fillStyle = 'rgba(0,0,0,0.3)';
              ctx.fillRect(-15 * s, -55 * s, 30 * s, 55 * s);
              break;
            }
            case 'windmill': {
              const h = 100 * s;
              ctx.fillStyle = c;
              ctx.beginPath();
              ctx.moveTo(-12 * s, 0); ctx.lineTo(-18 * s, -h); ctx.lineTo(18 * s, -h); ctx.lineTo(12 * s, 0);
              ctx.closePath(); ctx.fill();
              ctx.fillStyle = '#c8b060';
              for (let a = 0; a < 4; a++) {
                ctx.save();
                ctx.translate(0, -h);
                ctx.rotate(a * Math.PI / 2 + now / 2000);
                ctx.fillRect(-4 * s, -35 * s, 8 * s, 35 * s);
                ctx.restore();
              }
              break;
            }
            case 'lighthouse': {
              const w = 28 * s, h = 130 * s;
              ctx.fillStyle = '#f0f0f0';
              ctx.fillRect(-w / 2, -h, w, h);
              for (let i = 0; i < 5; i++) {
                ctx.fillStyle = i % 2 === 0 ? '#cc3333' : '#f0f0f0';
                ctx.fillRect(-w / 2, -h + i * 26 * s, w, 13 * s);
              }
              ctx.fillStyle = '#ffff88';
              ctx.beginPath();
              ctx.arc(0, -h - 10 * s, 14 * s, 0, Math.PI * 2);
              ctx.fill();
              break;
            }
            case 'factory': {
              const w = 100 * s, h = 70 * s;
              ctx.fillStyle = c;
              ctx.fillRect(-w / 2, -h, w, h);
              ctx.fillStyle = '#888';
              ctx.fillRect(-w / 2 + 10 * s, -h - 60 * s, 18 * s, 60 * s);
              ctx.fillRect(w / 2 - 28 * s, -h - 45 * s, 18 * s, 45 * s);
              ctx.fillStyle = 'rgba(200,200,200,0.4)';
              ctx.beginPath();
              ctx.ellipse(-w / 2 + 19 * s, -h - 60 * s, 14 * s, 20 * s, 0, 0, Math.PI * 2);
              ctx.fill();
              break;
            }
            case 'crane': {
              ctx.fillStyle = '#e8b830';
              ctx.fillRect(-6 * s, -200 * s, 12 * s, 200 * s);
              ctx.fillRect(-6 * s, -200 * s, 90 * s, 10 * s);
              ctx.fillRect(60 * s, -200 * s, 8 * s, 60 * s);
              ctx.strokeStyle = '#c8a020';
              ctx.lineWidth = 2 * s;
              ctx.beginPath();
              ctx.moveTo(0, -195 * s); ctx.lineTo(65 * s, -143 * s);
              ctx.stroke();
              break;
            }
            case 'water_tower': {
              ctx.fillStyle = c;
              ctx.beginPath();
              ctx.ellipse(0, -90 * s, 30 * s, 35 * s, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#5a4a3a';
              for (let i = -2; i <= 2; i++) {
                ctx.fillRect(i * 12 * s - 3 * s, -55 * s, 6 * s, 55 * s);
              }
              break;
            }
            case 'cabin': {
              const w = 65 * s, h = 55 * s;
              ctx.fillStyle = '#8B6340';
              ctx.fillRect(-w / 2, -h, w, h);
              ctx.fillStyle = '#5a3010';
              for (let i = 0; i < 5; i++) {
                ctx.fillRect(-w / 2, -h + i * 11 * s, w, 5 * s);
              }
              ctx.fillStyle = '#5a3a1a';
              ctx.beginPath();
              ctx.moveTo(-w / 2 - 5 * s, -h); ctx.lineTo(0, -h - 28 * s); ctx.lineTo(w / 2 + 5 * s, -h);
              ctx.closePath(); ctx.fill();
              break;
            }
            case 'billboard': {
              ctx.fillStyle = '#444';
              ctx.fillRect(-4 * s, -120 * s, 8 * s, 120 * s);
              ctx.fillStyle = '#fff';
              ctx.fillRect(-45 * s, -120 * s, 90 * s, 55 * s);
              ctx.fillStyle = ['#ff4444', '#4444ff', '#44aa44', '#ffaa00'][Math.floor(el.x / 100) % 4];
              ctx.fillRect(-40 * s, -115 * s, 80 * s, 45 * s);
              break;
            }
            default: {
              // Generic box building
              const w = 50 * s, h = 80 * s;
              ctx.fillStyle = c;
              ctx.fillRect(-w / 2, -h, w, h);
              break;
            }
          }
        } else {
          // Animals — larger scale, clear outlines, waving arm for friendly ones
          const bounce = Math.sin(now / 500 + el.phase) * 4 * s;
          const waveArm = el.waves ? Math.sin(now / 300 + el.phase) * 0.9 - 0.3 : 0;
          ctx.translate(0, bounce);

          // Helper: outline stroke for clarity
          const outline = (color: string) => { ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2.5 * s; ctx.stroke(); ctx.fillStyle = color; ctx.fill(); };
          const outlineFill = (color: string) => { ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2 * s; ctx.stroke(); };

          // Friendly animals wave with a real limb: a rounded arm that ends in a
          // palm with three fingers. Drawn inside the arm's translated and
          // rotated space, so the hand stays on the end of the arm as it swings.
          // Before this the arm was a thin wedge that tapered to a point, which
          // read as a bare stick with no hand at all.
          const wavingArm = (len: number, color: string) => {
            const tipX = len, tipY = -len * 0.7;
            const dir = Math.atan2(tipY, tipX);
            const thick = 5.5 * s;
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(tipX, tipY);
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = thick + 2.5 * s; ctx.stroke();
            ctx.strokeStyle = color; ctx.lineWidth = thick; ctx.stroke();

            const r = 5.5 * s;
            const hx = tipX + Math.cos(dir) * r * 0.7;
            const hy = tipY + Math.sin(dir) * r * 0.7;
            for (let f = -1; f <= 1; f++) {
              const a = dir + f * 0.45;
              ctx.beginPath();
              ctx.moveTo(hx + Math.cos(a) * r * 0.25, hy + Math.sin(a) * r * 0.25);
              ctx.lineTo(hx + Math.cos(a) * r * 1.85, hy + Math.sin(a) * r * 1.85);
              ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = r * 1.05; ctx.stroke();
              ctx.strokeStyle = color; ctx.lineWidth = r * 0.55; ctx.stroke();
            }
            ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2);
            ctx.fillStyle = color; ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = Math.max(1.6, r * 0.2); ctx.stroke();
          };

          // A real bird wing seen from the side: it sweeps back from the shoulder
          // to a rounded tip. The trailing edge is scalloped into three feather
          // steps instead of being one straight cut, so it reads as plumage and
          // not as a paper triangle. The wing is drawn in local space with the
          // shoulder at the origin, extending towards -x (the bird faces +x), so
          // each caller can translate and rotate it as the bird flaps.
          const drawBirdWing = (L: number, col: string) => {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            // Leading edge: a shallow rise, then a long run out to the tip. The
            // wing is kept slim - a real wing seen from the side is far longer
            // than it is deep, and a tall rounded shape reads as a shell.
            ctx.quadraticCurveTo(-L * 0.5, -L * 0.24, -L, -L * 0.02);
            // Rounded tip.
            ctx.quadraticCurveTo(-L * 0.9, L * 0.13, -L * 0.74, L * 0.1);
            // Trailing edge: three shallow feather scallops back to the shoulder.
            ctx.quadraticCurveTo(-L * 0.6, L * 0.2, -L * 0.46, L * 0.1);
            ctx.quadraticCurveTo(-L * 0.3, L * 0.19, -L * 0.16, L * 0.08);
            ctx.quadraticCurveTo(-L * 0.07, L * 0.13, 0, L * 0.03);
            ctx.closePath();
            outlineFill(col);
          };

          switch (el.subtype) {

            case 'cat': case 'stray_cat': case 'space_cat': {
              const bc = el.subtype === 'space_cat' ? '#b0b8cc' : el.subtype === 'stray_cat' ? '#aa8866' : '#778899';
              // Body
              ctx.beginPath(); ctx.ellipse(0, -28 * s, 16 * s, 20 * s, 0, 0, Math.PI * 2); outlineFill(bc);
              // Head
              ctx.beginPath(); ctx.ellipse(0, -54 * s, 14 * s, 13 * s, 0, 0, Math.PI * 2); outlineFill(bc);
              // Ears
              ctx.beginPath(); ctx.moveTo(-12 * s, -64 * s); ctx.lineTo(-16 * s, -78 * s); ctx.lineTo(-4 * s, -64 * s); outlineFill('#cc9966');
              ctx.beginPath(); ctx.moveTo(12 * s, -64 * s); ctx.lineTo(16 * s, -78 * s); ctx.lineTo(4 * s, -64 * s); outlineFill('#cc9966');
              // Eyes
              ctx.beginPath(); ctx.arc(-5 * s, -55 * s, 4 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.beginPath(); ctx.arc(5 * s, -55 * s, 4 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = '#33cc33'; ctx.beginPath(); ctx.arc(-5 * s, -55 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#33cc33'; ctx.beginPath(); ctx.arc(5 * s, -55 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(-5 * s, -55 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(5 * s, -55 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              // Nose + smile
              ctx.fillStyle = '#ff88aa'; ctx.beginPath(); ctx.arc(0, -51 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.arc(-3 * s, -49 * s, 3 * s, 0, Math.PI); ctx.stroke();
              ctx.beginPath(); ctx.arc(3 * s, -49 * s, 3 * s, 0, Math.PI); ctx.stroke();
              // Whiskers
              ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.2 * s;
              ctx.beginPath(); ctx.moveTo(-3 * s, -51 * s); ctx.lineTo(-18 * s, -50 * s); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(-3 * s, -51 * s); ctx.lineTo(-18 * s, -53 * s); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(3 * s, -51 * s); ctx.lineTo(18 * s, -50 * s); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(3 * s, -51 * s); ctx.lineTo(18 * s, -53 * s); ctx.stroke();
              // Left arm (static)
              ctx.beginPath(); ctx.moveTo(-14 * s, -36 * s); ctx.lineTo(-22 * s, -22 * s); ctx.lineTo(-14 * s, -18 * s); outlineFill(bc);
              // Right arm WAVING
              ctx.save(); ctx.translate(14 * s, -36 * s); ctx.rotate(waveArm);
              wavingArm(20 * s, bc);
              ctx.restore();
              // Tail
              ctx.strokeStyle = bc; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(-14 * s, -14 * s); ctx.quadraticCurveTo(-32 * s, 0 * s, -26 * s, 16 * s); ctx.stroke();
              ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5 * s;
              ctx.beginPath(); ctx.moveTo(-14 * s, -14 * s); ctx.quadraticCurveTo(-32 * s, 0 * s, -26 * s, 16 * s); ctx.stroke();
              break;
            }

            case 'dog': {
              // Body
              ctx.beginPath(); ctx.ellipse(0, -26 * s, 18 * s, 18 * s, 0, 0, Math.PI * 2); outlineFill('#c8943a');
              // Head
              ctx.beginPath(); ctx.ellipse(0, -52 * s, 15 * s, 14 * s, 0, 0, Math.PI * 2); outlineFill('#c8943a');
              // Floppy ears
              ctx.beginPath(); ctx.ellipse(-17 * s, -52 * s, 6 * s, 12 * s, -.4, 0, Math.PI * 2); outlineFill('#a07028');
              ctx.beginPath(); ctx.ellipse(17 * s, -52 * s, 6 * s, 12 * s, .4, 0, Math.PI * 2); outlineFill('#a07028');
              // Snout
              ctx.beginPath(); ctx.ellipse(0, -47 * s, 8 * s, 6 * s, 0, 0, Math.PI * 2); outlineFill('#e8b060');
              // Nose
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.ellipse(0, -50 * s, 4 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
              // Eyes
              ctx.beginPath(); ctx.arc(-6 * s, -56 * s, 4.5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.beginPath(); ctx.arc(6 * s, -56 * s, 4.5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = '#5533aa'; ctx.beginPath(); ctx.arc(-6 * s, -56 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#5533aa'; ctx.beginPath(); ctx.arc(6 * s, -56 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(-6 * s, -56 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(6 * s, -56 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              // Tongue
              ctx.fillStyle = '#ff6688'; ctx.beginPath(); ctx.ellipse(0, -43 * s, 4 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
              // Arms
              ctx.beginPath(); ctx.moveTo(-16 * s, -34 * s); ctx.lineTo(-26 * s, -18 * s); ctx.lineTo(-18 * s, -14 * s); outlineFill('#c8943a');
              // Waving arm
              ctx.save(); ctx.translate(16 * s, -34 * s); ctx.rotate(waveArm);
              wavingArm(26 * s, '#c8943a');
              ctx.restore();
              // Tail wagging
              const dogTailWag = Math.sin(now / 150 + el.phase) * 0.7;
              ctx.strokeStyle = '#a07028'; ctx.lineWidth = 6 * s; ctx.lineCap = 'round';
              ctx.save(); ctx.translate(-16 * s, -20 * s); ctx.rotate(dogTailWag);
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-18 * s, -10 * s, -14 * s, 8 * s); ctx.stroke();
              ctx.restore();
              break;
            }

            case 'rabbit': {
              // Body
              ctx.beginPath(); ctx.ellipse(0, -26 * s, 16 * s, 20 * s, 0, 0, Math.PI * 2); outlineFill('#e8ddd0');
              // Head
              ctx.beginPath(); ctx.ellipse(0, -52 * s, 13 * s, 13 * s, 0, 0, Math.PI * 2); outlineFill('#e8ddd0');
              // Long ears
              ctx.beginPath(); ctx.ellipse(-7 * s, -72 * s, 5 * s, 20 * s, -.15, 0, Math.PI * 2); outlineFill('#e8ddd0');
              ctx.beginPath(); ctx.ellipse(7 * s, -72 * s, 5 * s, 20 * s, .15, 0, Math.PI * 2); outlineFill('#e8ddd0');
              ctx.fillStyle = '#ffb0c0'; ctx.beginPath(); ctx.ellipse(-7 * s, -72 * s, 2.5 * s, 16 * s, -.15, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#ffb0c0'; ctx.beginPath(); ctx.ellipse(7 * s, -72 * s, 2.5 * s, 16 * s, .15, 0, Math.PI * 2); ctx.fill();
              // Eyes
              ctx.beginPath(); ctx.arc(-5 * s, -53 * s, 4 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.beginPath(); ctx.arc(5 * s, -53 * s, 4 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = '#ff3366'; ctx.beginPath(); ctx.arc(-5 * s, -53 * s, 2.3 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#ff3366'; ctx.beginPath(); ctx.arc(5 * s, -53 * s, 2.3 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(-5 * s, -53 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(5 * s, -53 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              // Nose
              ctx.fillStyle = '#ff7799'; ctx.beginPath(); ctx.arc(0, -49 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              // Smile
              ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5 * s;
              ctx.beginPath(); ctx.arc(-2.5 * s, -47 * s, 2.5 * s, 0, Math.PI); ctx.stroke();
              ctx.beginPath(); ctx.arc(2.5 * s, -47 * s, 2.5 * s, 0, Math.PI); ctx.stroke();
              // Left arm
              ctx.beginPath(); ctx.moveTo(-14 * s, -34 * s); ctx.lineTo(-22 * s, -20 * s); ctx.lineTo(-14 * s, -16 * s); outlineFill('#e8ddd0');
              // Waving arm
              ctx.save(); ctx.translate(14 * s, -34 * s); ctx.rotate(waveArm);
              wavingArm(23 * s, '#e8ddd0');
              ctx.restore();
              // Fluffy tail
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(-2 * s, -8 * s, 8 * s, 0, Math.PI * 2); ctx.fill();
              ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.5 * s; ctx.stroke();
              break;
            }

            case 'bear': {
              // Body
              ctx.beginPath(); ctx.ellipse(0, -28 * s, 22 * s, 24 * s, 0, 0, Math.PI * 2); outlineFill('#6a4020');
              // Head
              ctx.beginPath(); ctx.ellipse(0, -58 * s, 18 * s, 17 * s, 0, 0, Math.PI * 2); outlineFill('#6a4020');
              // Round ears
              ctx.beginPath(); ctx.arc(-14 * s, -73 * s, 8 * s, 0, Math.PI * 2); outlineFill('#6a4020');
              ctx.beginPath(); ctx.arc(14 * s, -73 * s, 8 * s, 0, Math.PI * 2); outlineFill('#6a4020');
              ctx.fillStyle = '#c8a080'; ctx.beginPath(); ctx.arc(-14 * s, -73 * s, 4.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#c8a080'; ctx.beginPath(); ctx.arc(14 * s, -73 * s, 4.5 * s, 0, Math.PI * 2); ctx.fill();
              // Snout
              ctx.beginPath(); ctx.ellipse(0, -53 * s, 9 * s, 7 * s, 0, 0, Math.PI * 2); outlineFill('#c8a080');
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.ellipse(0, -57 * s, 5 * s, 3.5 * s, 0, 0, Math.PI * 2); ctx.fill();
              // Eyes
              ctx.beginPath(); ctx.arc(-7 * s, -61 * s, 5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.beginPath(); ctx.arc(7 * s, -61 * s, 5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(-7 * s, -61 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(7 * s, -61 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(-5.5 * s, -62.5 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(8.5 * s, -62.5 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              // Friendly smile
              ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2 * s; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.arc(0, -50 * s, 5 * s, 0, Math.PI); ctx.stroke();
              // Left arm
              ctx.beginPath(); ctx.moveTo(-20 * s, -36 * s); ctx.lineTo(-30 * s, -18 * s); ctx.lineTo(-20 * s, -14 * s); outlineFill('#6a4020');
              // WAVING arm
              ctx.save(); ctx.translate(20 * s, -36 * s); ctx.rotate(waveArm);
              wavingArm(30 * s, '#6a4020');
              ctx.restore();
              break;
            }

            case 'deer': {
              ctx.beginPath(); ctx.ellipse(0, -26 * s, 14 * s, 18 * s, 0, 0, Math.PI * 2); outlineFill('#c87840');
              ctx.beginPath(); ctx.ellipse(0, -50 * s, 11 * s, 12 * s, 0, 0, Math.PI * 2); outlineFill('#c87840');
              // Antlers
              ctx.strokeStyle = '#7B3A10'; ctx.lineWidth = 3.5 * s; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(-6 * s, -60 * s); ctx.lineTo(-10 * s, -78 * s); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(-10 * s, -78 * s); ctx.lineTo(-16 * s, -70 * s); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(-10 * s, -78 * s); ctx.lineTo(-5 * s, -70 * s); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(6 * s, -60 * s); ctx.lineTo(10 * s, -78 * s); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(10 * s, -78 * s); ctx.lineTo(16 * s, -70 * s); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(10 * s, -78 * s); ctx.lineTo(5 * s, -70 * s); ctx.stroke();
              // White belly
              ctx.beginPath(); ctx.ellipse(0, -28 * s, 8 * s, 12 * s, 0, 0, Math.PI * 2); outlineFill('#f0e0c8');
              // Eyes
              ctx.beginPath(); ctx.arc(-5 * s, -51 * s, 4 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.beginPath(); ctx.arc(5 * s, -51 * s, 4 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = '#4a2800'; ctx.beginPath(); ctx.arc(-5 * s, -51 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#4a2800'; ctx.beginPath(); ctx.arc(5 * s, -51 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(-4 * s, -52 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(6 * s, -52 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
              // Nose
              ctx.fillStyle = '#cc5533'; ctx.beginPath(); ctx.arc(0, -46 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
              // WAVING arm/leg
              ctx.save(); ctx.translate(12 * s, -30 * s); ctx.rotate(waveArm);
              wavingArm(22 * s, '#c87840');
              ctx.restore();
              break;
            }

            case 'cow': {
              ctx.beginPath(); ctx.ellipse(0, -24 * s, 22 * s, 20 * s, 0, 0, Math.PI * 2); outlineFill('#f5f5f0');
              // Black patches
              ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(-8 * s, -30 * s, 8 * s, 7 * s, -.3, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(10 * s, -18 * s, 7 * s, 6 * s, .2, 0, Math.PI * 2); ctx.fill();
              // Head
              ctx.beginPath(); ctx.ellipse(0, -50 * s, 14 * s, 13 * s, 0, 0, Math.PI * 2); outlineFill('#f5f5f0');
              // Ears
              ctx.beginPath(); ctx.ellipse(-16 * s, -50 * s, 5 * s, 8 * s, 0, 0, Math.PI * 2); outlineFill('#f5f5f0');
              ctx.beginPath(); ctx.ellipse(16 * s, -50 * s, 5 * s, 8 * s, 0, 0, Math.PI * 2); outlineFill('#f5f5f0');
              ctx.fillStyle = '#ffaabb'; ctx.beginPath(); ctx.ellipse(-16 * s, -50 * s, 3 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#ffaabb'; ctx.beginPath(); ctx.ellipse(16 * s, -50 * s, 3 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
              // Snout
              ctx.beginPath(); ctx.ellipse(0, -45 * s, 8 * s, 6 * s, 0, 0, Math.PI * 2); outlineFill('#ffccaa');
              ctx.fillStyle = '#885533'; ctx.beginPath(); ctx.arc(-3 * s, -46 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#885533'; ctx.beginPath(); ctx.arc(3 * s, -46 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
              // Eyes
              ctx.beginPath(); ctx.arc(-6 * s, -54 * s, 4.5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.beginPath(); ctx.arc(6 * s, -54 * s, 4.5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = '#553300'; ctx.beginPath(); ctx.arc(-6 * s, -54 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#553300'; ctx.beginPath(); ctx.arc(6 * s, -54 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(-5 * s, -55 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(7 * s, -55 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
              // WAVING arm
              ctx.save(); ctx.translate(18 * s, -30 * s); ctx.rotate(waveArm);
              wavingArm(23 * s, '#f5f5f0');
              ctx.restore();
              break;
            }

            case 'horse': {
              ctx.beginPath(); ctx.ellipse(0, -26 * s, 22 * s, 18 * s, 0, 0, Math.PI * 2); outlineFill('#9B5c30');
              ctx.beginPath(); ctx.ellipse(18 * s, -44 * s, 10 * s, 18 * s, .2, 0, Math.PI * 2); outlineFill('#9B5c30');
              // Mane
              ctx.fillStyle = '#6a3010'; ctx.beginPath(); ctx.moveTo(10 * s, -55 * s); ctx.quadraticCurveTo(20 * s, -65 * s, 22 * s, -55 * s); ctx.quadraticCurveTo(18 * s, -52 * s, 14 * s, -55 * s); ctx.fill();
              // Eye
              ctx.beginPath(); ctx.arc(22 * s, -46 * s, 5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = '#332200'; ctx.beginPath(); ctx.arc(22 * s, -46 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(23 * s, -47 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              // Nostril
              ctx.fillStyle = '#7a3010'; ctx.beginPath(); ctx.ellipse(26 * s, -40 * s, 3 * s, 2 * s, .3, 0, Math.PI * 2); ctx.fill();
              // Tail
              ctx.strokeStyle = '#6a3010'; ctx.lineWidth = 6 * s; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(-20 * s, -22 * s); ctx.quadraticCurveTo(-36 * s, -10 * s, -30 * s, 12 * s); ctx.stroke();
              // WAVING front leg
              ctx.save(); ctx.translate(16 * s, -26 * s); ctx.rotate(waveArm * 0.6);
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10 * s, 20 * s); ctx.lineTo(4 * s, 20 * s); outlineFill('#9B5c30');
              // Rounded hoof on the raised leg - a horse has no fingers to wave with.
              ctx.beginPath(); ctx.ellipse(7 * s, 20 * s, 6.5 * s, 5 * s, 0.22, 0, Math.PI * 2); outlineFill('#5a3418');
              ctx.restore();
              break;
            }

            case 'bird': case 'pigeon': {
              const bCol = el.subtype === 'pigeon' ? '#9090a0' : '#4466aa';
              const bDark = el.subtype === 'pigeon' ? '#70707e' : '#32508c';
              const wingFlap = Math.sin((now / 180) * (el.flapRate ?? 1) + el.phase) * 0.7;
              // Tail feathers, tucked in behind the body.
              ctx.beginPath(); ctx.moveTo(-9 * s, -22 * s); ctx.lineTo(-27 * s, -18 * s); ctx.lineTo(-24 * s, -11 * s); ctx.lineTo(-8 * s, -18 * s); ctx.closePath(); outlineFill(bDark);
              // Far wing: behind the body, darker and smaller, so the pair reads with depth.
              ctx.save(); ctx.translate(-5 * s, -27 * s); ctx.rotate(-0.28 - wingFlap * 0.5); drawBirdWing(19 * s, bDark); ctx.restore();
              // Body + head
              ctx.beginPath(); ctx.ellipse(0, -22 * s, 13 * s, 9 * s, 0, 0, Math.PI * 2); outlineFill(bCol);
              ctx.beginPath(); ctx.ellipse(12 * s, -26 * s, 9 * s, 8 * s, 0, 0, Math.PI * 2); outlineFill(bCol);
              // Beak
              ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.moveTo(20 * s, -26 * s); ctx.lineTo(28 * s, -24 * s); ctx.lineTo(20 * s, -22 * s); ctx.fill();
              // Eye
              ctx.beginPath(); ctx.arc(15 * s, -28 * s, 4 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(15 * s, -28 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(16 * s, -29 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
              // Near wing: in front of the body, driving the flap.
              ctx.save(); ctx.translate(2 * s, -29 * s); ctx.rotate(-0.05 + wingFlap * 0.8); drawBirdWing(25 * s, bCol); ctx.restore();
              break;
            }

            case 'crow': {
              const cFlap = Math.sin((now / 200) * (el.flapRate ?? 1) + el.phase) * 0.6;
              // Tail
              ctx.beginPath(); ctx.moveTo(-9 * s, -22 * s); ctx.lineTo(-26 * s, -18 * s); ctx.lineTo(-23 * s, -11 * s); ctx.lineTo(-8 * s, -18 * s); ctx.closePath(); outlineFill('#12121f');
              // Far wing
              ctx.save(); ctx.translate(-5 * s, -27 * s); ctx.rotate(-0.28 - cFlap * 0.5); drawBirdWing(18 * s, '#12121f'); ctx.restore();
              // Body + head
              ctx.beginPath(); ctx.ellipse(0, -22 * s, 12 * s, 8 * s, 0, 0, Math.PI * 2); outlineFill('#1a1a2a');
              ctx.beginPath(); ctx.ellipse(11 * s, -26 * s, 8 * s, 7 * s, 0, 0, Math.PI * 2); outlineFill('#1a1a2a');
              ctx.fillStyle = '#223333'; ctx.beginPath(); ctx.moveTo(18 * s, -26 * s); ctx.lineTo(26 * s, -25 * s); ctx.lineTo(18 * s, -23 * s); ctx.fill();
              ctx.beginPath(); ctx.arc(14 * s, -28 * s, 3.5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = '#2255ff'; ctx.beginPath(); ctx.arc(14 * s, -28 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(14 * s, -28 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
              // Near wing
              ctx.save(); ctx.translate(2 * s, -29 * s); ctx.rotate(-0.05 + cFlap * 0.8); drawBirdWing(24 * s, '#1a1a2a'); ctx.restore();
              break;
            }

            case 'seagull': {
              const sgFlap = Math.sin((now / 210) * (el.flapRate ?? 1) + el.phase) * 0.65;
              // Tail
              ctx.beginPath(); ctx.moveTo(-9 * s, -22 * s); ctx.lineTo(-26 * s, -18 * s); ctx.lineTo(-23 * s, -11 * s); ctx.lineTo(-8 * s, -18 * s); ctx.closePath(); outlineFill('#d8d8e2');
              // Far wing
              ctx.save(); ctx.translate(-5 * s, -27 * s); ctx.rotate(-0.28 - sgFlap * 0.5); drawBirdWing(19 * s, '#d8d8e2'); ctx.restore();
              // Body + head
              ctx.beginPath(); ctx.ellipse(0, -22 * s, 12 * s, 8 * s, 0, 0, Math.PI * 2); outlineFill('#f8f8ff');
              ctx.beginPath(); ctx.ellipse(11 * s, -26 * s, 9 * s, 8 * s, 0, 0, Math.PI * 2); outlineFill('#f8f8ff');
              ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.moveTo(19 * s, -25 * s); ctx.lineTo(27 * s, -23 * s); ctx.lineTo(19 * s, -21 * s); ctx.fill();
              ctx.beginPath(); ctx.arc(14 * s, -28 * s, 4 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = '#ff8800'; ctx.beginPath(); ctx.arc(14 * s, -28 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
              // Near wing
              ctx.save(); ctx.translate(2 * s, -29 * s); ctx.rotate(-0.05 + sgFlap * 0.8); drawBirdWing(25 * s, '#f0f0f6'); ctx.restore();
              break;
            }

            case 'owl': {
              ctx.beginPath(); ctx.ellipse(0, -28 * s, 14 * s, 20 * s, 0, 0, Math.PI * 2); outlineFill('#9a7a30');
              // Ear tufts
              ctx.beginPath(); ctx.moveTo(-10 * s, -46 * s); ctx.lineTo(-14 * s, -58 * s); ctx.lineTo(-5 * s, -46 * s); outlineFill('#7a5a20');
              ctx.beginPath(); ctx.moveTo(10 * s, -46 * s); ctx.lineTo(14 * s, -58 * s); ctx.lineTo(5 * s, -46 * s); outlineFill('#7a5a20');
              // Face disc
              ctx.beginPath(); ctx.arc(0, -34 * s, 12 * s, 0, Math.PI * 2); outlineFill('#f5e8a0');
              // Eyes — big
              ctx.beginPath(); ctx.arc(-5 * s, -35 * s, 6.5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.beginPath(); ctx.arc(5 * s, -35 * s, 6.5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = '#ff8800'; ctx.beginPath(); ctx.arc(-5 * s, -35 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#ff8800'; ctx.beginPath(); ctx.arc(5 * s, -35 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(-5 * s, -35 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(5 * s, -35 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(-3.5 * s, -37 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(6.5 * s, -37 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              // Beak
              ctx.fillStyle = '#cc8800'; ctx.beginPath(); ctx.moveTo(0, -29 * s); ctx.lineTo(-3.5 * s, -25 * s); ctx.lineTo(3.5 * s, -25 * s); ctx.fill();
              // Wings open slightly
              ctx.beginPath(); ctx.moveTo(-12 * s, -28 * s); ctx.lineTo(-28 * s, -14 * s); ctx.lineTo(-18 * s, -6 * s); outlineFill('#9a7a30');
              ctx.beginPath(); ctx.moveTo(12 * s, -28 * s); ctx.lineTo(28 * s, -14 * s); ctx.lineTo(18 * s, -6 * s); outlineFill('#9a7a30');
              break;
            }

            case 'eagle': {
              const eagleWing = Math.sin((now / 400) * (el.flapRate ?? 1) + el.phase) * 0.25;
              // Far wing: broad, behind the body.
              ctx.save(); ctx.translate(-7 * s, -35 * s); ctx.rotate(-0.24 - eagleWing * 0.7); drawBirdWing(30 * s, '#3a1e00'); ctx.restore();
              // Body
              ctx.beginPath(); ctx.ellipse(0, -26 * s, 16 * s, 20 * s, 0, 0, Math.PI * 2); outlineFill('#5a3010');
              // Tail
              ctx.beginPath(); ctx.moveTo(-10 * s, -14 * s); ctx.lineTo(-30 * s, -8 * s); ctx.lineTo(-27 * s, 2 * s); ctx.lineTo(-9 * s, -6 * s); ctx.closePath(); outlineFill('#4a2800');
              // White head + hooked beak
              ctx.beginPath(); ctx.ellipse(12 * s, -46 * s, 10 * s, 11 * s, 0, 0, Math.PI * 2); outlineFill('#5a3010');
              ctx.beginPath(); ctx.arc(12 * s, -48 * s, 7 * s, 0, Math.PI * 2); outlineFill('#f8f8f8');
              ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.moveTo(18 * s, -46 * s); ctx.lineTo(26 * s, -44 * s); ctx.lineTo(22 * s, -42 * s); ctx.closePath(); ctx.fill();
              ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(14 * s, -49 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(14 * s, -49 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(15 * s, -50 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
              // Near wing: broad, in front, gently soaring.
              ctx.save(); ctx.translate(4 * s, -37 * s); ctx.rotate(-0.02 + eagleWing * 0.7); drawBirdWing(34 * s, '#4a2800'); ctx.restore();
              break;
            }

            case 'squirrel': {
              ctx.beginPath(); ctx.ellipse(0, -26 * s, 10 * s, 15 * s, 0, 0, Math.PI * 2); outlineFill('#c87030');
              ctx.beginPath(); ctx.ellipse(0, -44 * s, 9 * s, 10 * s, 0, 0, Math.PI * 2); outlineFill('#c87030');
              // Ears
              ctx.beginPath(); ctx.arc(-6 * s, -52 * s, 4.5 * s, 0, Math.PI * 2); outlineFill('#c87030');
              ctx.beginPath(); ctx.arc(6 * s, -52 * s, 4.5 * s, 0, Math.PI * 2); outlineFill('#c87030');
              // Eyes
              ctx.beginPath(); ctx.arc(-4 * s, -45 * s, 3.5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.beginPath(); ctx.arc(4 * s, -45 * s, 3.5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(-4 * s, -45 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(4 * s, -45 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(-3 * s, -46 * s, 0.8 * s, 0, Math.PI * 2); ctx.fill();
              // Nose
              ctx.fillStyle = '#cc5533'; ctx.beginPath(); ctx.arc(0, -42 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
              // Bushy tail
              ctx.fillStyle = '#c87030'; ctx.strokeStyle = '#a05820'; ctx.lineWidth = 10 * s; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(8 * s, -22 * s); ctx.quadraticCurveTo(30 * s, -16 * s, 22 * s, 8 * s); ctx.stroke();
              ctx.strokeStyle = '#d99040'; ctx.lineWidth = 5 * s;
              ctx.beginPath(); ctx.moveTo(8 * s, -22 * s); ctx.quadraticCurveTo(30 * s, -16 * s, 22 * s, 8 * s); ctx.stroke();
              // Arm holding nut
              ctx.beginPath(); ctx.moveTo(-8 * s, -32 * s); ctx.lineTo(-14 * s, -22 * s); ctx.lineTo(-8 * s, -18 * s); outlineFill('#c87030');
              ctx.fillStyle = '#885500'; ctx.beginPath(); ctx.arc(-14 * s, -20 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
              break;
            }

            case 'fox': {
              ctx.beginPath(); ctx.ellipse(0, -24 * s, 14 * s, 18 * s, 0, 0, Math.PI * 2); outlineFill('#e06820');
              ctx.fillStyle = '#f8f0e0'; ctx.beginPath(); ctx.ellipse(0, -22 * s, 7 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.ellipse(0, -46 * s, 11 * s, 12 * s, 0, 0, Math.PI * 2); outlineFill('#e06820');
              // Triangle ears
              ctx.beginPath(); ctx.moveTo(-10 * s, -54 * s); ctx.lineTo(-14 * s, -68 * s); ctx.lineTo(-3 * s, -54 * s); outlineFill('#e06820');
              ctx.beginPath(); ctx.moveTo(10 * s, -54 * s); ctx.lineTo(14 * s, -68 * s); ctx.lineTo(3 * s, -54 * s); outlineFill('#e06820');
              ctx.fillStyle = '#cc4411'; ctx.beginPath(); ctx.moveTo(-9 * s, -55 * s); ctx.lineTo(-12 * s, -65 * s); ctx.lineTo(-4 * s, -55 * s); ctx.fill();
              ctx.fillStyle = '#cc4411'; ctx.beginPath(); ctx.moveTo(9 * s, -55 * s); ctx.lineTo(12 * s, -65 * s); ctx.lineTo(4 * s, -55 * s); ctx.fill();
              // Snout
              ctx.beginPath(); ctx.ellipse(0, -42 * s, 6 * s, 5 * s, 0, 0, Math.PI * 2); outlineFill('#f8e8d0');
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(0, -45 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              // Eyes
              ctx.beginPath(); ctx.arc(-5 * s, -49 * s, 4.5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.beginPath(); ctx.arc(5 * s, -49 * s, 4.5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = '#cc8800'; ctx.beginPath(); ctx.arc(-5 * s, -49 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#cc8800'; ctx.beginPath(); ctx.arc(5 * s, -49 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(-5 * s, -49 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(5 * s, -49 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
              // Fluffy tail
              ctx.strokeStyle = '#e06820'; ctx.lineWidth = 10 * s; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(-12 * s, -14 * s); ctx.quadraticCurveTo(-34 * s, -2 * s, -28 * s, 18 * s); ctx.stroke();
              ctx.strokeStyle = 'white'; ctx.lineWidth = 4 * s;
              ctx.beginPath(); ctx.moveTo(-26 * s, 8 * s); ctx.quadraticCurveTo(-30 * s, 14 * s, -28 * s, 18 * s); ctx.stroke();
              break;
            }

            case 'rat': {
              ctx.beginPath(); ctx.ellipse(0, -18 * s, 12 * s, 10 * s, 0, 0, Math.PI * 2); outlineFill('#8a8070');
              ctx.beginPath(); ctx.ellipse(9 * s, -30 * s, 8 * s, 8 * s, 0, 0, Math.PI * 2); outlineFill('#8a8070');
              // Big round ears
              ctx.beginPath(); ctx.arc(-3 * s, -36 * s, 6 * s, 0, Math.PI * 2); outlineFill('#b89080');
              ctx.beginPath(); ctx.arc(9 * s, -36 * s, 6 * s, 0, Math.PI * 2); outlineFill('#b89080');
              ctx.fillStyle = '#ffaabb'; ctx.beginPath(); ctx.arc(-3 * s, -36 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#ffaabb'; ctx.beginPath(); ctx.arc(9 * s, -36 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill();
              // Eyes
              ctx.beginPath(); ctx.arc(6 * s, -31 * s, 4 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.beginPath(); ctx.arc(12 * s, -32 * s, 4 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = '#ff2244'; ctx.beginPath(); ctx.arc(6 * s, -31 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#ff2244'; ctx.beginPath(); ctx.arc(12 * s, -32 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(6 * s, -31 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(12 * s, -32 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              // Long nose
              ctx.fillStyle = '#cc8877'; ctx.beginPath(); ctx.arc(16 * s, -29 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
              // Whiskers
              ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1 * s;
              ctx.beginPath(); ctx.moveTo(14 * s, -29 * s); ctx.lineTo(26 * s, -27 * s); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(14 * s, -29 * s); ctx.lineTo(26 * s, -31 * s); ctx.stroke();
              // Tail
              ctx.strokeStyle = '#9a8070'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(-11 * s, -14 * s); ctx.quadraticCurveTo(-26 * s, -2 * s, -22 * s, 12 * s); ctx.stroke();
              break;
            }

            case 'bat': {
              const batFlap = Math.sin((now / 120) * (el.flapRate ?? 1) + el.phase);
              ctx.beginPath(); ctx.ellipse(0, -36 * s, 10 * s, 12 * s, 0, 0, Math.PI * 2); outlineFill('#553366');
              // Ears
              ctx.beginPath(); ctx.moveTo(-7 * s, -46 * s); ctx.lineTo(-11 * s, -58 * s); ctx.lineTo(-2 * s, -46 * s); outlineFill('#442255');
              ctx.beginPath(); ctx.moveTo(7 * s, -46 * s); ctx.lineTo(11 * s, -58 * s); ctx.lineTo(2 * s, -46 * s); outlineFill('#442255');
              // Glowing eyes
              ctx.fillStyle = '#ff2222'; ctx.beginPath(); ctx.arc(-4 * s, -38 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#ff2222'; ctx.beginPath(); ctx.arc(4 * s, -38 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#ff8888'; ctx.beginPath(); ctx.arc(-4 * s, -38 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#ff8888'; ctx.beginPath(); ctx.arc(4 * s, -38 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
              // Wings
              ctx.save(); ctx.translate(-8 * s, -36 * s); ctx.rotate(-batFlap * 0.8 - 0.3);
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-32 * s, -10 * s); ctx.quadraticCurveTo(-28 * s, 5 * s, -20 * s, 6 * s); ctx.closePath(); outlineFill('#442255');
              ctx.restore();
              ctx.save(); ctx.translate(8 * s, -36 * s); ctx.rotate(batFlap * 0.8 + 0.3);
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(32 * s, -10 * s); ctx.quadraticCurveTo(28 * s, 5 * s, 20 * s, 6 * s); ctx.closePath(); outlineFill('#442255');
              ctx.restore();
              // Little fangs
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.moveTo(-3 * s, -28 * s); ctx.lineTo(-1.5 * s, -24 * s); ctx.lineTo(0, -28 * s); ctx.fill();
              ctx.beginPath(); ctx.moveTo(3 * s, -28 * s); ctx.lineTo(1.5 * s, -24 * s); ctx.lineTo(0, -28 * s); ctx.fill();
              break;
            }

            case 'crab': {
              ctx.beginPath(); ctx.ellipse(0, -14 * s, 18 * s, 12 * s, 0, 0, Math.PI * 2); outlineFill('#dd4422');
              // Eyes on stalks
              ctx.fillStyle = '#cc3311'; ctx.fillRect(-10 * s, -20 * s, 4 * s, 8 * s); ctx.fillRect(6 * s, -20 * s, 4 * s, 8 * s);
              ctx.beginPath(); ctx.arc(-8 * s, -22 * s, 5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.beginPath(); ctx.arc(8 * s, -22 * s, 5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(-8 * s, -22 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(8 * s, -22 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
              // Claws
              const clawSnap = Math.sin(now / 300 + el.phase) * 0.4;
              ctx.save(); ctx.translate(-22 * s, -12 * s); ctx.rotate(clawSnap - 0.3);
              ctx.beginPath(); ctx.ellipse(0, 0, 10 * s, 7 * s, 0, 0, Math.PI * 2); outlineFill('#ee5533');
              ctx.restore();
              ctx.save(); ctx.translate(22 * s, -12 * s); ctx.rotate(-clawSnap + 0.3);
              ctx.beginPath(); ctx.ellipse(0, 0, 10 * s, 7 * s, 0, 0, Math.PI * 2); outlineFill('#ee5533');
              ctx.restore();
              // Legs
              ctx.strokeStyle = '#cc3322'; ctx.lineWidth = 3 * s;
              for (let leg = -2; leg <= 2; leg++) {
                if (leg === 0) continue;
                ctx.beginPath(); ctx.moveTo(leg * 7 * s, -10 * s); ctx.lineTo(leg * 11 * s, 2 * s); ctx.stroke();
              }
              break;
            }

            case 'seal': {
              ctx.beginPath(); ctx.ellipse(0, -18 * s, 22 * s, 14 * s, .15, 0, Math.PI * 2); outlineFill('#7090a0');
              ctx.beginPath(); ctx.ellipse(18 * s, -14 * s, 10 * s, 7 * s, -.2, 0, Math.PI * 2); outlineFill('#7090a0');
              // Head
              ctx.beginPath(); ctx.ellipse(-14 * s, -28 * s, 13 * s, 12 * s, 0, 0, Math.PI * 2); outlineFill('#8898a8');
              // Big round eyes
              ctx.beginPath(); ctx.arc(-18 * s, -30 * s, 6 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.beginPath(); ctx.arc(-10 * s, -30 * s, 6 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(-18 * s, -30 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(-10 * s, -30 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(-17 * s, -32 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(-9 * s, -32 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
              // Nose
              ctx.fillStyle = '#cc8899'; ctx.beginPath(); ctx.arc(-6 * s, -26 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
              // Whiskers
              ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.2 * s;
              ctx.beginPath(); ctx.moveTo(-6 * s, -26 * s); ctx.lineTo(6 * s, -24 * s); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(-6 * s, -26 * s); ctx.lineTo(6 * s, -28 * s); ctx.stroke();
              // Flipper WAVING
              ctx.save(); ctx.translate(-14 * s, -20 * s); ctx.rotate(waveArm * 0.7);
              ctx.beginPath(); ctx.ellipse(-12 * s, 0, 12 * s, 5 * s, -.4, 0, Math.PI * 2); outlineFill('#7090a0');
              ctx.restore();
              break;
            }

            case 'pelican': {
              ctx.beginPath(); ctx.ellipse(0, -22 * s, 16 * s, 12 * s, 0, 0, Math.PI * 2); outlineFill('#f8f4ee');
              ctx.beginPath(); ctx.ellipse(14 * s, -32 * s, 9 * s, 10 * s, 0, 0, Math.PI * 2); outlineFill('#f8f4ee');
              // Long beak
              ctx.fillStyle = '#ddaa20'; ctx.beginPath(); ctx.moveTo(20 * s, -30 * s); ctx.lineTo(40 * s, -28 * s); ctx.lineTo(38 * s, -24 * s); ctx.lineTo(20 * s, -26 * s); ctx.closePath(); ctx.fill();
              ctx.fillStyle = '#ffcc44'; ctx.beginPath(); ctx.ellipse(30 * s, -26 * s, 8 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
              // Eye
              ctx.beginPath(); ctx.arc(16 * s, -34 * s, 5 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = '#223300'; ctx.beginPath(); ctx.arc(16 * s, -34 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(17 * s, -35 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              // Wing
              const pelFlap = Math.sin((now / 190) * (el.flapRate ?? 1) + el.phase) * 0.55;
              ctx.save(); ctx.translate(-12 * s, -24 * s); ctx.rotate(-pelFlap - 0.15);
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30 * s, -8 * s); ctx.lineTo(-22 * s, 6 * s); outlineFill('#e0dcd8');
              ctx.restore();
              break;
            }

            case 'alien_creature': {
              // Green glowing body
              ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 12 * s;
              ctx.beginPath(); ctx.ellipse(0, -30 * s, 15 * s, 22 * s, 0, 0, Math.PI * 2); outlineFill('#22dd66');
              ctx.shadowBlur = 0;
              // Big head
              ctx.beginPath(); ctx.ellipse(0, -58 * s, 16 * s, 16 * s, 0, 0, Math.PI * 2); outlineFill('#22dd66');
              // Huge alien eyes
              ctx.beginPath(); ctx.arc(-7 * s, -60 * s, 7 * s, 0, Math.PI * 2); outlineFill('#001100');
              ctx.beginPath(); ctx.arc(7 * s, -60 * s, 7 * s, 0, Math.PI * 2); outlineFill('#001100');
              ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(-7 * s, -60 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(7 * s, -60 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(-7 * s, -60 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(7 * s, -60 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(-5.5 * s, -62 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(8.5 * s, -62 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
              // Antennae
              ctx.strokeStyle = '#22dd66'; ctx.lineWidth = 2.5 * s;
              ctx.beginPath(); ctx.moveTo(-6 * s, -73 * s); ctx.lineTo(-10 * s, -84 * s); ctx.stroke();
              ctx.fillStyle = '#ff44ff'; ctx.beginPath(); ctx.arc(-10 * s, -84 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.moveTo(6 * s, -73 * s); ctx.lineTo(10 * s, -84 * s); ctx.stroke();
              ctx.fillStyle = '#ff44ff'; ctx.beginPath(); ctx.arc(10 * s, -84 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
              // Slit mouth
              ctx.strokeStyle = '#001100'; ctx.lineWidth = 2 * s;
              ctx.beginPath(); ctx.arc(0, -52 * s, 5 * s, 0.2, Math.PI - 0.2); ctx.stroke();
              // WAVING 3-fingered hand
              ctx.save(); ctx.translate(14 * s, -42 * s); ctx.rotate(waveArm);
              wavingArm(23 * s, '#22dd66');
              ctx.restore();
              break;
            }

            case 'goat': {
              ctx.beginPath(); ctx.ellipse(0, -22 * s, 16 * s, 14 * s, 0, 0, Math.PI * 2); outlineFill('#d8d0b8');
              ctx.beginPath(); ctx.ellipse(10 * s, -38 * s, 10 * s, 12 * s, 0, 0, Math.PI * 2); outlineFill('#d8d0b8');
              // Curved horns
              ctx.strokeStyle = '#8a7a60'; ctx.lineWidth = 3.5 * s; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(6 * s, -48 * s); ctx.quadraticCurveTo(2 * s, -60 * s, 10 * s, -58 * s); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(14 * s, -48 * s); ctx.quadraticCurveTo(18 * s, -60 * s, 10 * s, -58 * s); ctx.stroke();
              // Eyes
              ctx.beginPath(); ctx.arc(7 * s, -40 * s, 4 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.beginPath(); ctx.arc(14 * s, -40 * s, 4 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = '#886600'; ctx.beginPath(); ctx.arc(7 * s, -40 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#886600'; ctx.beginPath(); ctx.arc(14 * s, -40 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(7 * s, -40 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(14 * s, -40 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              // Beard
              ctx.fillStyle = '#e8e0c8'; ctx.beginPath(); ctx.ellipse(10 * s, -30 * s, 4 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
              break;
            }

            case 'snake': {
              const snakeWiggle = Math.sin(now / 300 + el.phase);
              ctx.strokeStyle = '#2a7a2a'; ctx.lineWidth = 14 * s; ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(-30 * s, -10 * s);
              ctx.quadraticCurveTo(-10 * s, -10 * s + 18 * s * snakeWiggle, 10 * s, -10 * s);
              ctx.quadraticCurveTo(22 * s, -10 * s - 14 * s * snakeWiggle, 30 * s, -10 * s);
              ctx.stroke();
              ctx.strokeStyle = '#3a9a3a'; ctx.lineWidth = 8 * s;
              ctx.beginPath();
              ctx.moveTo(-30 * s, -10 * s);
              ctx.quadraticCurveTo(-10 * s, -10 * s + 18 * s * snakeWiggle, 10 * s, -10 * s);
              ctx.quadraticCurveTo(22 * s, -10 * s - 14 * s * snakeWiggle, 30 * s, -10 * s);
              ctx.stroke();
              // Head
              ctx.beginPath(); ctx.arc(32 * s, -10 * s, 9 * s, 0, Math.PI * 2); outlineFill('#2a7a2a');
              ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(35 * s, -13 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(35 * s, -13 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
              // Forked tongue
              ctx.strokeStyle = '#ff2222'; ctx.lineWidth = 2 * s;
              ctx.beginPath(); ctx.moveTo(40 * s, -9 * s); ctx.lineTo(48 * s, -7 * s); ctx.moveTo(40 * s, -9 * s); ctx.lineTo(48 * s, -11 * s); ctx.stroke();
              // Pattern
              ctx.fillStyle = '#1a5a1a';
              for (let p2 = -2; p2 <= 2; p2++) {
                ctx.beginPath(); ctx.ellipse(p2 * 14 * s, -10 * s + Math.sin((p2 + el.phase) * 2) * snakeWiggle * 16 * s, 4 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
              }
              break;
            }

            case 'lizard': {
              ctx.beginPath(); ctx.ellipse(0, -16 * s, 16 * s, 8 * s, 0, 0, Math.PI * 2); outlineFill('#7a9a20');
              // Spiny back
              ctx.fillStyle = '#5a7a10';
              for (let sp = -3; sp <= 3; sp++) {
                ctx.beginPath(); ctx.moveTo(sp * 5 * s, -22 * s); ctx.lineTo(sp * 5 * s - 3 * s, -30 * s); ctx.lineTo(sp * 5 * s + 3 * s, -30 * s); ctx.fill();
              }
              // Head
              ctx.beginPath(); ctx.ellipse(16 * s, -18 * s, 10 * s, 7 * s, 0, 0, Math.PI * 2); outlineFill('#7a9a20');
              ctx.beginPath(); ctx.arc(22 * s, -20 * s, 4 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = '#ff8800'; ctx.beginPath(); ctx.arc(22 * s, -20 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(22 * s, -20 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              // Tongue
              ctx.strokeStyle = '#ff2222'; ctx.lineWidth = 2 * s;
              ctx.beginPath(); ctx.moveTo(25 * s, -17 * s); ctx.lineTo(32 * s, -15 * s); ctx.moveTo(25 * s, -17 * s); ctx.lineTo(32 * s, -19 * s); ctx.stroke();
              // Tail
              ctx.strokeStyle = '#7a9a20'; ctx.lineWidth = 7 * s; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(-14 * s, -14 * s); ctx.quadraticCurveTo(-28 * s, -8 * s, -24 * s, 8 * s); ctx.stroke();
              break;
            }

            case 'rooster': {
              ctx.beginPath(); ctx.ellipse(0, -28 * s, 14 * s, 20 * s, 0, 0, Math.PI * 2); outlineFill('#b84820');
              // Tail feathers
              ctx.fillStyle = '#ff6600';
              ctx.beginPath(); ctx.moveTo(-12 * s, -34 * s); ctx.quadraticCurveTo(-28 * s, -40 * s, -26 * s, -24 * s); ctx.fill();
              ctx.fillStyle = '#ffcc00';
              ctx.beginPath(); ctx.moveTo(-10 * s, -36 * s); ctx.quadraticCurveTo(-30 * s, -38 * s, -26 * s, -22 * s); ctx.fill();
              ctx.fillStyle = '#ff3300';
              ctx.beginPath(); ctx.moveTo(-14 * s, -32 * s); ctx.quadraticCurveTo(-26 * s, -44 * s, -22 * s, -26 * s); ctx.fill();
              // Head
              ctx.beginPath(); ctx.ellipse(8 * s, -48 * s, 11 * s, 11 * s, 0, 0, Math.PI * 2); outlineFill('#b84820');
              // Red comb
              ctx.fillStyle = '#ff2200';
              ctx.beginPath(); ctx.moveTo(4 * s, -58 * s); ctx.lineTo(0, -68 * s); ctx.lineTo(6 * s, -62 * s); ctx.lineTo(10 * s, -70 * s); ctx.lineTo(14 * s, -60 * s); ctx.lineTo(16 * s, -58 * s); ctx.fill();
              // Wattle
              ctx.fillStyle = '#ff3322'; ctx.beginPath(); ctx.ellipse(6 * s, -42 * s, 4 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
              // Beak
              ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.moveTo(16 * s, -47 * s); ctx.lineTo(24 * s, -46 * s); ctx.lineTo(16 * s, -44 * s); ctx.fill();
              // Eye
              ctx.beginPath(); ctx.arc(12 * s, -50 * s, 4 * s, 0, Math.PI * 2); outlineFill('white');
              ctx.fillStyle = '#ff8800'; ctx.beginPath(); ctx.arc(12 * s, -50 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(12 * s, -50 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
              break;
            }

            case 'robot_bird': {
              ctx.shadowColor = '#00ccff'; ctx.shadowBlur = 10 * s;
              ctx.beginPath(); ctx.ellipse(0, -22 * s, 13 * s, 9 * s, 0, 0, Math.PI * 2); outlineFill('#8898b0');
              ctx.beginPath(); ctx.ellipse(12 * s, -28 * s, 11 * s, 10 * s, 0, 0, Math.PI * 2); outlineFill('#8898b0');
              ctx.shadowBlur = 0;
              // Visor
              ctx.fillStyle = '#00ccff'; ctx.beginPath(); ctx.rect(8 * s, -34 * s, 8 * s, 5 * s); ctx.fill();
              // Beak
              ctx.fillStyle = '#aabbcc'; ctx.beginPath(); ctx.moveTo(21 * s, -28 * s); ctx.lineTo(30 * s, -26 * s); ctx.lineTo(21 * s, -24 * s); ctx.fill();
              // Panel lines
              ctx.strokeStyle = '#6688aa'; ctx.lineWidth = 1.5 * s;
              ctx.beginPath(); ctx.moveTo(-5 * s, -18 * s); ctx.lineTo(-5 * s, -26 * s); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(0, -18 * s); ctx.lineTo(0, -26 * s); ctx.stroke();
              // Mechanical wings
              const mWing = Math.sin((now / 200) * (el.flapRate ?? 1) + el.phase) * 0.5;
              ctx.save(); ctx.translate(-10 * s, -22 * s); ctx.rotate(-mWing);
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-26 * s, -6 * s); ctx.lineTo(-22 * s, 6 * s); outlineFill('#7090a8');
              ctx.fillStyle = '#003355'; ctx.fillRect(-18 * s, -4 * s, 6 * s, 3 * s); ctx.fillRect(-12 * s, -4 * s, 6 * s, 3 * s);
              ctx.restore();
              break;
            }

            default: { break; }
          }

          // ── Universal legs / feet for ALL ground animals ──────────────────
          if (!el.isSkyAnimal) {
            const legWalk = Math.sin(now / 280 + el.phase);
            const legColor = el.subtype === 'cat' || el.subtype === 'stray_cat' || el.subtype === 'space_cat' ? '#778899'
              : el.subtype === 'dog' ? '#c8943a'
                : el.subtype === 'rabbit' ? '#e8ddd0'
                  : el.subtype === 'bear' ? '#5a3010'
                    : el.subtype === 'deer' ? '#c87840'
                      : el.subtype === 'cow' ? '#f5f5f0'
                        : el.subtype === 'horse' ? '#9B5c30'
                          : el.subtype === 'fox' ? '#e06820'
                            : el.subtype === 'squirrel' ? '#c87030'
                              : el.subtype === 'goat' ? '#d8d0b8'
                                : el.subtype === 'rooster' ? '#b84820'
                                  : el.subtype === 'alien_creature' ? '#22dd66'
                                    : el.subtype === 'rat' ? '#8a8070'
                                      : el.subtype === 'owl' ? '#9a7a30'
                                        : '#888877';

            const legW = 5 * s;
            const footW = 8 * s;
            const footH = 4 * s;

            if (['cat', 'stray_cat', 'space_cat', 'rabbit', 'squirrel', 'rat', 'alien_creature'].includes(el.subtype)) {
              // Bipedal — 2 legs
              const leftLeg = legWalk * 8 * s;
              const rightLeg = -legWalk * 8 * s;
              // Left leg
              ctx.fillStyle = legColor;
              ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5 * s;
              ctx.beginPath(); ctx.roundRect(-8 * s, -14 * s + leftLeg, legW, 14 * s, 2 * s); ctx.fill(); ctx.stroke();
              // Left foot
              ctx.beginPath(); ctx.ellipse(-6 * s, leftLeg, footW, footH, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
              // Right leg
              ctx.beginPath(); ctx.roundRect(3 * s, -14 * s + rightLeg, legW, 14 * s, 2 * s); ctx.fill(); ctx.stroke();
              // Right foot
              ctx.beginPath(); ctx.ellipse(5 * s, rightLeg, footW, footH, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

            } else if (['bear', 'cow', 'goat', 'deer'].includes(el.subtype)) {
              // Quadruped — 4 thick legs with hooves
              const fl = legWalk * 6 * s;
              const rl = -legWalk * 6 * s;
              const legH = 18 * s;
              const hoof = el.subtype === 'cow' || el.subtype === 'goat' || el.subtype === 'deer' ? '#333' : '#4a2800';
              // Front-left
              ctx.fillStyle = legColor; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5 * s;
              ctx.beginPath(); ctx.roundRect(-16 * s, -legH + fl, legW + 2 * s, legH, 2 * s); ctx.fill(); ctx.stroke();
              ctx.fillStyle = hoof; ctx.beginPath(); ctx.ellipse(-14 * s, fl, 7 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
              // Front-right
              ctx.fillStyle = legColor;
              ctx.beginPath(); ctx.roundRect(-6 * s, -legH + rl, legW + 2 * s, legH, 2 * s); ctx.fill(); ctx.stroke();
              ctx.fillStyle = hoof; ctx.beginPath(); ctx.ellipse(-4 * s, rl, 7 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
              // Back-left
              ctx.fillStyle = legColor;
              ctx.beginPath(); ctx.roundRect(4 * s, -legH + rl, legW + 2 * s, legH, 2 * s); ctx.fill(); ctx.stroke();
              ctx.fillStyle = hoof; ctx.beginPath(); ctx.ellipse(6 * s, rl, 7 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
              // Back-right
              ctx.fillStyle = legColor;
              ctx.beginPath(); ctx.roundRect(14 * s, -legH + fl, legW + 2 * s, legH, 2 * s); ctx.fill(); ctx.stroke();
              ctx.fillStyle = hoof; ctx.beginPath(); ctx.ellipse(16 * s, fl, 7 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();

            } else if (['horse'].includes(el.subtype)) {
              // Horse — 4 long legs
              const fl = legWalk * 8 * s;
              const rl = -legWalk * 8 * s;
              const legH = 26 * s;
              ctx.fillStyle = '#9B5c30'; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5 * s;
              for (const [ox, phase] of [[-18 * s, fl], [-8 * s, rl], [6 * s, rl], [16 * s, fl]] as [number, number][]) {
                ctx.beginPath(); ctx.roundRect(ox, -legH + phase, 6 * s, legH, 2 * s); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#333'; ctx.beginPath(); ctx.ellipse(ox + 3 * s, phase, 7 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#9B5c30';
              }

            } else if (['dog', 'fox'].includes(el.subtype)) {
              // Dog/fox — 4 legs
              const fl = legWalk * 6 * s;
              const rl = -legWalk * 6 * s;
              const legH = 16 * s;
              const fc = el.subtype === 'fox' ? '#e06820' : '#c8943a';
              ctx.fillStyle = fc; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5 * s;
              for (const [ox, phase] of [[-12 * s, fl], [-4 * s, rl], [4 * s, rl], [12 * s, fl]] as [number, number][]) {
                ctx.beginPath(); ctx.roundRect(ox, -legH + phase, 5 * s, legH, 2 * s); ctx.fill(); ctx.stroke();
                // Paw
                ctx.beginPath(); ctx.ellipse(ox + 2.5 * s, phase, 6 * s, 3.5 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                // Toes
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                for (let t = -2; t <= 2; t += 2) {
                  ctx.beginPath(); ctx.arc(ox + 2.5 * s + t * 2 * s, phase - 1 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
                }
                ctx.fillStyle = fc;
              }

            } else if (el.subtype === 'rooster') {
              // Rooster — 2 scaly legs + claws
              const fl = legWalk * 7 * s;
              const rl = -legWalk * 7 * s;
              ctx.fillStyle = '#ddaa20'; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5 * s;
              // Left leg (thigh + shin)
              ctx.beginPath(); ctx.roundRect(-8 * s, -16 * s + fl, 5 * s, 10 * s, 1 * s); ctx.fill(); ctx.stroke();
              ctx.beginPath(); ctx.roundRect(-9 * s, -6 * s + fl, 4 * s, 8 * s, 1 * s); ctx.fill(); ctx.stroke();
              // Left claws
              ctx.strokeStyle = '#997700'; ctx.lineWidth = 1.5 * s; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(-8 * s, fl); ctx.lineTo(-16 * s, fl + 4 * s); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(-8 * s, fl); ctx.lineTo(-8 * s, fl + 6 * s); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(-8 * s, fl); ctx.lineTo(-2 * s, fl + 4 * s); ctx.stroke();
              // Right leg
              ctx.fillStyle = '#ddaa20'; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5 * s;
              ctx.beginPath(); ctx.roundRect(3 * s, -16 * s + rl, 5 * s, 10 * s, 1 * s); ctx.fill(); ctx.stroke();
              ctx.beginPath(); ctx.roundRect(2 * s, -6 * s + rl, 4 * s, 8 * s, 1 * s); ctx.fill(); ctx.stroke();
              ctx.strokeStyle = '#997700'; ctx.lineWidth = 1.5 * s; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(3 * s, rl); ctx.lineTo(-5 * s, rl + 4 * s); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(3 * s, rl); ctx.lineTo(3 * s, rl + 6 * s); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(3 * s, rl); ctx.lineTo(10 * s, rl + 4 * s); ctx.stroke();

            } else if (['owl'].includes(el.subtype)) {
              // Owl — perch talons
              ctx.fillStyle = '#cc8800'; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5 * s;
              ctx.beginPath(); ctx.roundRect(-5 * s, -8 * s, 4 * s, 8 * s, 1 * s); ctx.fill(); ctx.stroke();
              ctx.beginPath(); ctx.roundRect(1 * s, -8 * s, 4 * s, 8 * s, 1 * s); ctx.fill(); ctx.stroke();
              ctx.strokeStyle = '#996600'; ctx.lineWidth = 2 * s; ctx.lineCap = 'round';
              for (const [bx, by] of [[-8 * s, 2 * s], [-5 * s, 4 * s], [-2 * s, 2 * s], [1 * s, 2 * s], [4 * s, 4 * s], [7 * s, 2 * s]] as [number, number][]) {
                ctx.beginPath(); ctx.moveTo(bx > 0 ? 3 * s : -3 * s, by - 2 * s); ctx.lineTo(bx, by); ctx.stroke();
              }

            } else if (['snake', 'lizard', 'crab', 'seal'].includes(el.subtype)) {
              // No legs needed — they crawl/slither/flipper
            } else {
              // Generic 2 legs fallback
              const fl = legWalk * 6 * s;
              const rl = -legWalk * 6 * s;
              ctx.fillStyle = legColor; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5 * s;
              ctx.beginPath(); ctx.roundRect(-7 * s, -14 * s + fl, 5 * s, 14 * s, 2 * s); ctx.fill(); ctx.stroke();
              ctx.beginPath(); ctx.ellipse(-5 * s, fl, 7 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
              ctx.beginPath(); ctx.roundRect(2 * s, -14 * s + rl, 5 * s, 14 * s, 2 * s); ctx.fill(); ctx.stroke();
              ctx.beginPath(); ctx.ellipse(4 * s, rl, 7 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            }
          }
        }
        ctx.restore();
        });
      });
      ctx.globalAlpha = 1;
      ctx.restore();

      // Solid earth below the ground line, so the area under the slabs reads as
      // ground instead of leaking the bright sky through the gaps.
      const earthGrad = ctx.createLinearGradient(0, game.groundY, 0, canvas.height);
      // Soil, not sky-blue: the band under the turf used to read as a black void
      // with a green stripe above it.
      earthGrad.addColorStop(0, '#2b1d13');
      earthGrad.addColorStop(0.45, '#1a1109');
      earthGrad.addColorStop(1, '#080506');
      ctx.fillStyle = earthGrad;
      ctx.fillRect(0, game.groundY, canvas.width, canvas.height - game.groundY);
      // Faint horizontal strata give the soil some scale.
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#000000';
      for (let sy = game.groundY + 18; sy < canvas.height; sy += 26) {
        ctx.fillRect(0, sy, canvas.width, 1.5);
      }
      ctx.restore();

      // Platforms - dark neon slabs with a glowing top edge
      game.platforms.forEach(plat => {
        const platX = plat.x - game.scrollX;
        const platY = plat.y;
        if (platX + plat.width > 0 && platX < canvas.width) {
          if (plat.isGround && !plat.bossWalkway) {
            // Mark/marknivå: gräs + jord
            const gGrad = ctx.createLinearGradient(platX, platY, platX, platY + plat.height);
            // Väder-anpassat utseende
            if (game.weather === 'SNÖIGT') {
              gGrad.addColorStop(0, '#e8f4ff');   // Snö
              gGrad.addColorStop(0.15, '#aac8e8'); // Is
              gGrad.addColorStop(0.3, '#667788');  // Frusen jord
              gGrad.addColorStop(1, '#445566');    // Djup jord
            } else if (game.timeOfDay === 'NIGHT') {
              gGrad.addColorStop(0, '#2a4a32');   // Nattgräs
              gGrad.addColorStop(0.2, '#1a3422'); // Mörk yta
              gGrad.addColorStop(1, '#0a1a10');   // Djup jord
            } else {
              gGrad.addColorStop(0, '#6cc44f');   // Ljust gräs
              gGrad.addColorStop(0.16, '#3a7a2c'); // Gräs
              gGrad.addColorStop(0.34, '#4a3418'); // Jord
              gGrad.addColorStop(1, '#241608');   // Djup jord
            }
            ctx.fillStyle = gGrad;
          } else if (!plat.bossArena) {
            // Luftplattform: sten/trä look
            const pGrad = ctx.createLinearGradient(platX, platY, platX, platY + plat.height);
            pGrad.addColorStop(0, '#4a8a5a');  // Ljus kant
            pGrad.addColorStop(0.3, '#2a5a3a');
            pGrad.addColorStop(1, '#1a3a25');
            ctx.fillStyle = pGrad;
          } else {
            const arenaGrad = ctx.createLinearGradient(platX, platY, platX, platY + plat.height);
            arenaGrad.addColorStop(0, '#815735');
            arenaGrad.addColorStop(0.35, '#4b392e');
            arenaGrad.addColorStop(1, '#262431');
            ctx.fillStyle = arenaGrad;
          }
          ctx.beginPath();
          ctx.roundRect(platX, platY, plat.width, plat.height, plat.isGround ? 0 : 4);
          ctx.fill();            // Turf detail: lit rim, a shadow just beneath it, and deterministic
          // speckles/flowers. A flat green band was the least finished-looking
          // part of the scene.
          if (plat.isGround && !plat.bossWalkway && !plat.bossArena) {
            const groundNight = game.timeOfDay === 'NIGHT';
            const groundSnow = game.weather === 'SNÖIGT';
            ctx.fillStyle = groundSnow
              ? 'rgba(255,255,255,0.9)'
              : groundNight ? 'rgba(96,196,132,0.6)' : 'rgba(196,255,150,0.8)';
            ctx.fillRect(platX, platY, plat.width, 2);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(platX, platY + 2, plat.width, 5);
            const startX = Math.max(platX, -30);
            const endX = Math.min(platX + plat.width, canvas.width + 30);
            for (let gx = Math.floor(startX / 22) * 22; gx < endX; gx += 22) {
              const r = skyHash(gx * 0.37 + 11);
              if (groundSnow) {
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.fillRect(gx + r * 10, platY + 8 + r * 10, 2, 2);
              } else if (groundNight) {
                ctx.fillStyle = 'rgba(120,220,160,0.35)';
                ctx.fillRect(gx + r * 10, platY + 9 + r * 14, 2, 2);
              } else if (r > 0.8) {
                ctx.fillStyle = r > 0.93 ? '#ffe08a' : r > 0.86 ? '#ffa8d4' : '#fff6f6';
                ctx.beginPath();
                ctx.arc(gx + r * 10, platY + 9 + r * 5, 1.9, 0, Math.PI * 2);
                ctx.fill();
              } else {
                ctx.fillStyle = 'rgba(0,0,0,0.14)';
                ctx.fillRect(gx + r * 12, platY + 12 + r * 18, 2.5, 1.5);
              }
            }
          }

          // Grass fringe on solid ground. Deterministic sine-based blades keep
          // the edge organic without per-frame random flicker.
          if (plat.isGround && !plat.bossWalkway && !plat.bossArena) {
            const night = game.timeOfDay === 'NIGHT';
            ctx.strokeStyle = game.weather === 'SNÖIGT'
              ? 'rgba(235,248,255,0.9)'
              : night ? 'rgba(74,160,108,0.85)' : 'rgba(120,214,96,0.9)';
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            const start = Math.max(platX + 3, -4);
            const end = Math.min(platX + plat.width - 2, canvas.width + 4);
            for (let gx = start; gx < end; gx += 8) {
              const blade = 3 + (Math.sin(gx * 0.63) + 1) * 3.6;
              ctx.beginPath();
              ctx.moveTo(gx, platY + 1);
              ctx.quadraticCurveTo(gx + Math.sin(gx * 0.31) * 2, platY - blade * 0.6, gx + Math.sin(gx * 0.31) * 3, platY - blade);
              ctx.stroke();
            }
          }

          // Kant-highlight (top edge)
          if (!plat.isGround || plat.y < game.groundY) {
            ctx.fillStyle = plat.bossArena ? '#ffd18a' : plat.bossWalkway ? '#53e5a0' : 'rgba(255,255,255,0.15)';
            ctx.fillRect(platX, platY, plat.width, plat.bossArena || plat.bossWalkway ? 4 : 2);
          }
          if (plat.bossWalkway) {
            ctx.save();
            ctx.globalAlpha = 0.28;
            ctx.fillStyle = '#20d98a';
            ctx.fillRect(platX, platY + 4, plat.width, plat.height - 4);
            ctx.restore();
          }
          if (plat.bossArena) {
            ctx.save();
            ctx.shadowColor = '#ff9f43';
            ctx.shadowBlur = 16;
            ctx.strokeStyle = 'rgba(255, 159, 67, 0.72)';
            ctx.lineWidth = 2;
            ctx.strokeRect(platX + 2, platY + 2, plat.width - 4, plat.height - 3);
            ctx.restore();
          }

          // Floating platforms get a neon underglow and a soft drop shadow, so
          // they read as hovering rather than pasted onto the sky.
          if (!plat.isGround) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.shadowColor = plat.bossArena ? '#ff9f43' : '#2bee79';
            ctx.shadowBlur = 18;
            ctx.fillStyle = plat.bossArena ? 'rgba(255,159,67,0.5)' : 'rgba(43,238,121,0.45)';
            ctx.beginPath();
            ctx.roundRect(platX + 10, platY + plat.height - 1, Math.max(0, plat.width - 20), 2.5, 2);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.beginPath();
            ctx.ellipse(platX + plat.width / 2, platY + plat.height + 7, plat.width * 0.42, 4, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      // Draw holes (chasms)
      game.holes.forEach(hole => {
        const hx = hole.x - game.scrollX;
        if (hx + hole.width <= 0 || hx >= canvas.width) return;
        const holeDepth = canvas.height - hole.y;
        // A deep blue-black wall instead of flat black, so a pit reads as depth
        // rather than as a cut-out where the ground simply stops.
        const pitGrad = ctx.createLinearGradient(0, hole.y, 0, hole.y + holeDepth);
        pitGrad.addColorStop(0, '#22344d');
        pitGrad.addColorStop(0.28, '#142033');
        pitGrad.addColorStop(0.68, '#0a1220');
        pitGrad.addColorStop(1, '#05080f');
        ctx.fillStyle = pitGrad;
        ctx.fillRect(hx, hole.y, hole.width, holeDepth);
        // Rock strata on the back wall: a few faint bands stop the chasm from
        // reading as an empty rectangle.
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = '#7f9fc4';
        ctx.lineWidth = 1;
        for (let band = 1; band <= 3; band++) {
          const bandY = hole.y + (holeDepth * band) / 4;
          ctx.beginPath();
          ctx.moveTo(hx, bandY);
          ctx.lineTo(hx + hole.width, bandY + 2);
          ctx.stroke();
        }
        ctx.restore();
        // Fog pooling at the bottom hides the hard edge of the canvas.
        const pitFog = ctx.createLinearGradient(0, hole.y + holeDepth * 0.45, 0, hole.y + holeDepth);
        pitFog.addColorStop(0, 'rgba(130,180,255,0)');
        pitFog.addColorStop(1, 'rgba(130,180,255,0.28)');
        ctx.fillStyle = pitFog;
        ctx.fillRect(hx, hole.y, hole.width, holeDepth);
        // Rim light on both lips so the ledge is readable before the drop.
        ctx.save();
        ctx.shadowColor = 'rgba(255, 90, 90, 0.9)';
        ctx.shadowBlur = 14;
        ctx.fillStyle = 'rgba(255,140,120,0.8)';
        ctx.fillRect(hx - 1, hole.y - 2, 4, 12);
        ctx.fillRect(hx + hole.width - 3, hole.y - 2, 4, 12);
        ctx.restore();
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
      game.enemies.forEach(e => {
        if (e.x < -500) return;

        const ex = e.x - game.scrollX;
        const ey = e.y;
        const ew = e.width;
        const eh = e.height;

        // Ground shadow for enemies
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.ellipse(ex + ew / 2, ey + eh + 2, ew * 0.45, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        if (e.type === 0) { // Dog enemy - Bulldog with spiked collar and jowls
          const dogFacing = e.velocityX >= 0 ? 1 : -1;
          const trot = Math.sin(Date.now() / 90) * 3;

          // Muscular dog body
          const dogGrad = ctx.createLinearGradient(ex, ey, ex, ey + eh);
          dogGrad.addColorStop(0, '#8B2500');
          dogGrad.addColorStop(0.6, '#5C1800');
          dogGrad.addColorStop(1, '#3B0E00');
          ctx.fillStyle = dogGrad;
          ctx.beginPath();
          ctx.ellipse(ex + ew / 2, ey + eh * 0.58, ew * 0.44, eh * 0.38, 0, 0, Math.PI * 2);
          ctx.fill();

          // Bulldog Head
          ctx.fillStyle = '#6E1D00';
          ctx.beginPath();
          ctx.arc(ex + ew / 2 + dogFacing * 4, ey + eh * 0.32, ew * 0.34, 0, Math.PI * 2);
          ctx.fill();

          // Spiked Collar (rött halsband med silverspikar)
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.ellipse(ex + ew / 2, ey + eh * 0.52, ew * 0.36, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f1f5f9';
          for (let sp = -2; sp <= 2; sp++) {
            ctx.beginPath();
            ctx.arc(ex + ew / 2 + sp * 8, ey + eh * 0.52, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Floppy dark ears
          ctx.fillStyle = '#3a1005';
          ctx.beginPath();
          ctx.ellipse(ex + ew / 2 - 12, ey + eh * 0.22, 6, 11, -0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(ex + ew / 2 + 12, ey + eh * 0.22, 6, 11, 0.3, 0, Math.PI * 2);
          ctx.fill();

          // Angry Eyes
          ctx.fillStyle = '#fef08a';
          ctx.beginPath(); ctx.arc(ex + ew / 2 - 8, ey + eh * 0.28, 5.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(ex + ew / 2 + 8, ey + eh * 0.28, 5.5, 0, Math.PI * 2); ctx.fill();
          // Pupils looking at cat
          ctx.fillStyle = '#000000';
          ctx.beginPath(); ctx.arc(ex + ew / 2 - 8 + dogFacing * 2, ey + eh * 0.28, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(ex + ew / 2 + 8 + dogFacing * 2, ey + eh * 0.28, 2.5, 0, Math.PI * 2); ctx.fill();

          // Big Bulldog Snout & Jowls
          ctx.fillStyle = '#4a1400';
          ctx.beginPath();
          ctx.ellipse(ex + ew / 2 + dogFacing * 6, ey + eh * 0.4, 10, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          // Black nose
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(ex + ew / 2 + dogFacing * 6, ey + eh * 0.36, 4, 0, Math.PI * 2);
          ctx.fill();

          // Bottom Canine Teeth (underbett)
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(ex + ew / 2 + dogFacing * 2, ey + eh * 0.44);
          ctx.lineTo(ex + ew / 2 + dogFacing * 4, ey + eh * 0.38);
          ctx.lineTo(ex + ew / 2 + dogFacing * 6, ey + eh * 0.44);
          ctx.closePath();
          ctx.fill();

          // Bulldog running legs
          ctx.fillStyle = '#5C1800';
          ctx.beginPath();
          ctx.arc(ex + ew * 0.25, ey + eh - 3 + trot, 6, 0, Math.PI * 2);
          ctx.arc(ex + ew * 0.75, ey + eh - 3 - trot, 6, 0, Math.PI * 2);
          ctx.fill();

        } else if (e.type === 1) { // Mouse enemy - Ninja rat with red headband
          const ratFacing = e.velocityX >= 0 ? 1 : -1;
          const trot = Math.sin(Date.now() / 70) * 3;

          // Tail
          ctx.strokeStyle = '#f472b6';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          const tailWiggle = Math.sin(Date.now() / 100) * 6;
          ctx.beginPath();
          ctx.moveTo(ex + (ratFacing > 0 ? 6 : ew - 6), ey + eh * 0.7);
          ctx.quadraticCurveTo(
            ex + (ratFacing > 0 ? -18 : ew + 18), ey + eh * 0.7 + tailWiggle,
            ex + (ratFacing > 0 ? -12 : ew + 12), ey + eh * 0.4
          );
          ctx.stroke();

          // Gray Body
          const mouseGrad = ctx.createLinearGradient(ex, ey, ex, ey + eh);
          mouseGrad.addColorStop(0, '#94a3b8');
          mouseGrad.addColorStop(1, '#475569');
          ctx.fillStyle = mouseGrad;
          ctx.beginPath();
          ctx.ellipse(ex + ew / 2, ey + eh * 0.55, ew * 0.42, eh * 0.38, 0, 0, Math.PI * 2);
          ctx.fill();

          // Big Round Ears with pink inside
          ctx.fillStyle = '#64748b';
          ctx.beginPath(); ctx.arc(ex + ew / 2 - 10, ey + eh * 0.22, 9, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(ex + ew / 2 + 10, ey + eh * 0.22, 9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#f472b6';
          ctx.beginPath(); ctx.arc(ex + ew / 2 - 10, ey + eh * 0.22, 5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(ex + ew / 2 + 10, ey + eh * 0.22, 5, 0, Math.PI * 2); ctx.fill();

          // Red Ninja Bandana on head
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(ex + ew * 0.15, ey + eh * 0.25, ew * 0.7, 7);
          // Bandana knot ribbons flying behind
          const ribbonX = ratFacing > 0 ? ex + 4 : ex + ew - 4;
          const ribbonWave = Math.sin(Date.now() / 120) * 4;
          ctx.beginPath();
          ctx.moveTo(ribbonX, ey + eh * 0.28);
          ctx.lineTo(ribbonX - ratFacing * 14, ey + eh * 0.22 + ribbonWave);
          ctx.lineTo(ribbonX - ratFacing * 16, ey + eh * 0.34 + ribbonWave);
          ctx.closePath();
          ctx.fill();

          // Glowing Angry Red Eyes
          ctx.fillStyle = '#ef4444';
          ctx.beginPath(); ctx.arc(ex + ew / 2 - 6, ey + eh * 0.38, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(ex + ew / 2 + 6, ey + eh * 0.38, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fef08a';
          ctx.beginPath(); ctx.arc(ex + ew / 2 - 6 + ratFacing, ey + eh * 0.38, 1.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(ex + ew / 2 + 6 + ratFacing, ey + eh * 0.38, 1.5, 0, Math.PI * 2); ctx.fill();

          // Sharp Buck Teeth
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(ex + ew / 2 - 3, ey + eh * 0.52, 2.5, 5);
          ctx.fillRect(ex + ew / 2 + 0.5, ey + eh * 0.52, 2.5, 5);

          // Little paws
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.arc(ex + ew * 0.3, ey + eh - 2 + trot, 4, 0, Math.PI * 2);
          ctx.arc(ex + ew * 0.7, ey + eh - 2 - trot, 4, 0, Math.PI * 2);
          ctx.fill();

        } else if (e.type === 2) { // Spike ball - Floating mechanical saw drone
          const radius = ew / 2;
          const spin = Date.now() / 150;
          const pulse = (Math.sin(Date.now() / 100) + 1) / 2;

          // Glowing warning aura
          ctx.save();
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 14 + pulse * 8;
          ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
          ctx.beginPath();
          ctx.arc(ex + radius, ey + radius, radius + 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Rotating Razor Spikes
          ctx.fillStyle = '#dc2626';
          const spikeCount = 8;
          for (let i = 0; i < spikeCount; i++) {
            const angle = (i * 2 * Math.PI) / spikeCount + spin;
            const spikeLength = radius * 0.75;

            ctx.beginPath();
            ctx.moveTo(
              ex + radius + Math.cos(angle - 0.2) * (radius * 0.8),
              ey + radius + Math.sin(angle - 0.2) * (radius * 0.8)
            );
            ctx.lineTo(
              ex + radius + Math.cos(angle) * (radius + spikeLength),
              ey + radius + Math.sin(angle) * (radius + spikeLength)
            );
            ctx.lineTo(
              ex + radius + Math.cos(angle + 0.2) * (radius * 0.8),
              ey + radius + Math.sin(angle + 0.2) * (radius * 0.8)
            );
            ctx.closePath();
            ctx.fill();
          }

          // Metallic Outer Shell
          const metalGrad = ctx.createRadialGradient(ex + radius - 4, ey + radius - 4, 2, ex + radius, ey + radius, radius);
          metalGrad.addColorStop(0, '#64748b');
          metalGrad.addColorStop(0.6, '#334155');
          metalGrad.addColorStop(1, '#0f172a');
          ctx.fillStyle = metalGrad;
          ctx.beginPath();
          ctx.arc(ex + radius, ey + radius, radius * 0.85, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Pulsating Glowing Core (Evil Red Eye)
          ctx.save();
          ctx.shadowColor = '#ff0033';
          ctx.shadowBlur = 12;
          ctx.fillStyle = `rgba(255, ${Math.floor(40 + pulse * 60)}, 40, 1)`;
          ctx.beginPath();
          ctx.arc(ex + radius, ey + radius, radius * 0.38, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ex + radius - 2, ey + radius - 2, radius * 0.12, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (e.type === 3) {
          // Sentry turret: a low armoured pod on a tripod, with a scanning eye
          // that turns red just before it fires.
          const cx = ex + ew / 2;
          const cy = ey + eh * 0.52;
          const winding = (e.shootTimer ?? 99) < 34;
          const eyeColor = winding ? '#ff3b3b' : '#ffb703';

          // Tripod legs
          ctx.strokeStyle = '#2b3546';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          [-1, 0, 1].forEach((leg) => {
            ctx.beginPath();
            ctx.moveTo(cx + leg * 4, cy + 8);
            ctx.lineTo(cx + leg * 13, ey + eh - 1);
            ctx.stroke();
          });

          // Armoured pod
          const podGrad = ctx.createLinearGradient(cx, cy - 16, cx, cy + 14);
          podGrad.addColorStop(0, '#5b6b85');
          podGrad.addColorStop(0.55, '#303b4e');
          podGrad.addColorStop(1, '#161d29');
          ctx.fillStyle = podGrad;
          ctx.beginPath();
          ctx.roundRect(cx - 16, cy - 14, 32, 28, 9);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Shoulder plates + antenna
          ctx.fillStyle = '#3d4a60';
          ctx.beginPath();
          ctx.roundRect(cx - 20, cy - 6, 7, 12, 3);
          ctx.roundRect(cx + 13, cy - 6, 7, 12, 3);
          ctx.fill();
          ctx.strokeStyle = '#7d8ba3';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx + 11, cy - 14);
          ctx.lineTo(cx + 15, cy - 24);
          ctx.stroke();
          ctx.fillStyle = '#ff4d4d';
          ctx.beginPath();
          ctx.arc(cx + 15, cy - 25, 2.4, 0, Math.PI * 2);
          ctx.fill();

          // Eye lens, glowing stronger while charging
          ctx.save();
          ctx.shadowColor = eyeColor;
          ctx.shadowBlur = winding ? 18 : 8;
          ctx.fillStyle = eyeColor;
          ctx.beginPath();
          ctx.arc(cx, cy, winding ? 6.2 : 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1a0d05';
          ctx.beginPath();
          ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(cx, cy, winding ? 9.5 : 8, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Charger beetle: wide, low, with a glowing horn and splayed legs.
          const charging = (e.chargeTimer ?? 0) > 0;
          const facing = e.velocityX >= 0 ? 1 : -1;
          const cx = ex + ew / 2;
          const baseY = ey + eh;
          const shell = ctx.createLinearGradient(cx, ey + 8, cx, baseY);
          if (charging) {
            shell.addColorStop(0, '#ff7b5a');
            shell.addColorStop(0.55, '#c0392b');
            shell.addColorStop(1, '#5a120c');
          } else {
            shell.addColorStop(0, '#8b5cf6');
            shell.addColorStop(0.5, '#6d28d9');
            shell.addColorStop(1, '#2e1065');
          }
          // Legs
          ctx.strokeStyle = '#1e1b4b';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          [-1, 1].forEach((side) => {
            for (let i = 0; i < 2; i++) {
              ctx.beginPath();
              ctx.moveTo(cx + side * (6 + i * 8), ey + eh * 0.62);
              ctx.lineTo(cx + side * (16 + i * 8), baseY - 2);
              ctx.stroke();
            }
          });
          // Shell
          ctx.save();
          ctx.shadowColor = charging ? '#ff5f3b' : '#7c3aed';
          ctx.shadowBlur = charging ? 22 : 8;
          ctx.fillStyle = shell;
          ctx.beginPath();
          ctx.ellipse(cx, ey + eh * 0.55, ew * 0.52, eh * 0.42, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 2;
          ctx.stroke();
          // Shell seam + spots
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx, ey + eh * 0.2);
          ctx.lineTo(cx, ey + eh * 0.58);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath();
          ctx.arc(cx - 7, ey + eh * 0.36, 2.4, 0, Math.PI * 2);
          ctx.arc(cx + 7, ey + eh * 0.33, 2, 0, Math.PI * 2);
          ctx.fill();
          // Head + glowing horn pointing at the direction of travel
          ctx.fillStyle = charging ? '#ffb4a2' : '#3b2b63';
          ctx.beginPath();
          ctx.arc(cx + facing * 14, ey + eh * 0.62, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 1.8;
          ctx.stroke();
          ctx.fillStyle = charging ? '#fff1a8' : '#fbbf24';
          ctx.beginPath();
          ctx.moveTo(cx + facing * 20, ey + eh * 0.56);
          ctx.lineTo(cx + facing * 34, ey + eh * 0.32);
          ctx.lineTo(cx + facing * 18, ey + eh * 0.44);
          ctx.closePath();
          ctx.fill();
          // Eyes
          ctx.fillStyle = charging ? '#fff' : '#fca5a5';
          ctx.beginPath();
          ctx.arc(cx + facing * 17, ey + eh * 0.6, 2.4, 0, Math.PI * 2);
          ctx.fill();
          // Telegraph ring while winding up
          if (charging) {
            ctx.strokeStyle = 'rgba(255,90,60,0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, ey + eh * 0.55, ew * 0.68 + Math.sin(Date.now() / 70) * 3, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
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
          const t = 1 - boss.telegraph / Math.max(1, Math.round(26 - (boss.tier || 1) * 2));
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
        
        // Boss-hälsobar (stor, prominant)
        const hpBarW = Math.min(400, bw * 3);
        const hpBarX = bx + bw/2 - hpBarW/2;
        const hpBarY = by - 28;
        
        // Boss-namn
        ctx.font = 'bold 14px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = phaseColor;
        ctx.shadowColor = phaseColor;
        ctx.shadowBlur = 8;
        ctx.fillText(boss.name, bx + bw/2, hpBarY - 6);
        ctx.shadowBlur = 0;
        
        // HP-bar bakgrund
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.roundRect(hpBarX - 2, hpBarY, hpBarW + 4, 14, 7);
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
        ctx.roundRect(hpBarX, hpBarY + 1, Math.max(0, hpBarW * hpPct), 12, 6);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // HP-text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${boss.hp}/${boss.maxHp}`, hpBarX + hpBarW/2, hpBarY + 10);
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
        const halo = ctx.createRadialGradient(fx2, fy2, 1, fx2, fy2, 26);
        halo.addColorStop(0, 'rgba(255, 216, 120, 0.5)');
        halo.addColorStop(0.5, 'rgba(255, 186, 72, 0.18)');
        halo.addColorStop(1, 'rgba(255, 186, 72, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(fx2, fy2, 26, 0, Math.PI * 2);
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
          if (fullCatchBonus > 0) pushToast(game, `ALLA FISKAR! +${fullCatchBonus}`, '#ffd166');
          if (noHitBonus > 0) pushToast(game, 'OHIT! +750', '#2bee79');
          if (nearMissBonus > 0) pushToast(game, `${game.nearMisses} NÄSTAN! +${nearMissBonus}`, '#7ef7c2');
          awardCoins(game, 25 + (perfectLevel ? 15 : 0) + (game.noHit ? 15 : 0));
          grantXp(game, 150);
          persistRunSummary(game, perfectLevel);
          setTotalScore(game.score);
          AudioEngine.playLevelUp();
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
          };
          setLevelSummary({ ...summary, grade: getGrade(summary) });
          AudioEngine.playGrade();
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
        ctx.fillText('RÄDDAS! ⭐', jxs + jw2/2, jy2 - 18 + textBob);
        ctx.shadowBlur = 0;
      }
      if (game.showFishWarning) {
        ctx.fillStyle = '#ee2b2b'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
        const needBoss = game.boss && game.boss.hp > 0;
        const missingFish = Math.max(0, (game.fishGoal ?? game.fishes.length) - collectedCountInFrame);
        ctx.fillText(needBoss ? `BESEGRA BOSS · ${missingFish} FISKAR KVAR` : `SAMLA ${missingFish} FISKAR TILL!`, jx + jw / 2, jy - 15);
      }

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
        ctx.fillStyle = '#2bee79';
        ctx.beginPath();
        ctx.ellipse(t.x - game.scrollX - pw / 2, t.y - ph / 2, pw * 0.42, ph * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Contact shadow keeps the cat glued to the platform instead of floating.
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.26)';
      ctx.beginPath();
      ctx.ellipse(px + pw / 2, py + ph + 3, pw * 0.46, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      if (game.player.invincible) ctx.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 50);
      // Same cat as the start-screen demo (components/catSprite.ts). Scaled per
      // axis from the hitbox so squash and stretch still show.
      drawCatSprite(ctx, px + pw / 2, py + ph, {
        color: game.player.color,
        accent: game.player.accent,
        t: Date.now() / 1000,
        running: Math.abs(game.player.velocityX) > 0.4 && game.player.onGround,
        jumping: !game.player.onGround,
        facing: game.player.facing === -1 ? -1 : 1,
        sx: pw / 40,
        sy: ph / 56,
      });
      ctx.restore();

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
      } else {
        grade.addColorStop(0, 'rgba(255,236,190,0.055)');
        grade.addColorStop(0.5, 'rgba(255,255,255,0)');
        grade.addColorStop(1, 'rgba(10,45,95,0.07)');
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
      vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Lightning is drawn in world space, underneath the rain, so the drops
      // read as falling in front of a strike behind them.
      drawLightning(ctx, game, progress.settings.reduceMotion);

      // Weather Particles Rendering
      if (game.weather === 'REGNIGT' || game.weather === 'STORMIGT') {
        ctx.strokeStyle = game.timeOfDay === 'DAY' ? 'rgba(100, 100, 150, 0.4)' : 'rgba(174, 194, 224, 0.5)';
        ctx.lineWidth = 1;
        game.weatherParticles.forEach((p: any) => {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 2, p.y + p.length);
          ctx.stroke();
        });
      } else if (game.weather === 'SNÖIGT') {
        ctx.fillStyle = game.timeOfDay === 'DAY' ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.9)';
        game.weatherParticles.forEach((p: any) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (game.weather === 'DIMMIGT') {
        game.weatherParticles.forEach((p: any) => {
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
        const wash = (game.timeOfDay === 'DAY' ? 0.13 : 0.26) * (progress.settings.reduceMotion ? 0.4 : 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(150, 185, 255, ${0.12 * f})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        ctx.fillStyle = `rgba(232, 242, 255, ${wash * f})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.restore();

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
  const stackControlsAtBottom = isMobile && !isFullscreen && touchControlsVisible;

  return (
    <div
      className={`flex w-full flex-col items-center overflow-hidden animate-fade-in-up ${
        isFullscreen
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
          height: isFullscreen
            ? '100dvh'
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
                    {lives <= 0 && <span className="text-[10px] font-black text-primary-red">TOMT</span>}
                    {lives > 6 && <span className="ml-1 text-[10px] font-black text-[#ff9db0]">+{lives - 6}</span>}
                  </span>
                </div>
                {stats.shield && (
                  <span className="hud-chip border-cyan-300/45 bg-cyan-300/10 text-cyan-200" title="Sköld aktiv">
                    <span className="material-symbols-outlined text-[14px]">shield</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <div className={`hud-chip ${stats.ammo <= 0 ? 'border-[#ff5f7a]/60 bg-[#ff5f7a]/10 animate-pulse' : ''}`}>
                  <span className="material-symbols-outlined text-[15px] text-[#ff9d9d]">bolt</span>
                  <span className={`tabular text-xs font-black ${stats.ammo <= 0 ? 'text-[#ff8b8b]' : 'text-white'}`}>{stats.ammo}</span>
                  <span className="hidden text-[8px] font-black uppercase tracking-wider text-white/35 sm:inline">skott</span>
                </div>
                <div className={`hud-chip relative hidden overflow-hidden sm:inline-flex ${stats.dashReady ? 'border-primary/50 text-primary' : 'text-white/40'}`}>
                  <span className="material-symbols-outlined text-[15px]">bolt</span>
                  <span className="text-[10px] font-black tracking-wider">DASH</span>
                  <span
                    className="absolute inset-x-0 bottom-0 h-[2px] bg-primary transition-[width] duration-150"
                    style={{ width: `${stats.dashPct * 100}%` }}
                  />
                </div>
              </div>

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
                    <span className="tabular text-[13px] font-black leading-none text-white md:text-[15px]">NIVÅ {currentLevel}</span>
                    <span
                      className={`truncate text-[9px] font-black uppercase tracking-[0.2em] ${isMobile ? 'hidden' : 'hidden sm:inline'}`}
                      style={{ color: (LEVEL_MODE_META[stats.levelType] || LEVEL_MODE_META.Classic).accent }}
                    >
                      {(LEVEL_MODE_META[stats.levelType] || LEVEL_MODE_META.Classic).short}
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
                  <span className="truncate">{(CHAPTER_NAMES[(Math.max(1, currentLevel) - 1) % CHAPTER_NAMES.length] || 'Neon City')}</span>
                  <span className="tabular shrink-0">RANK {stats.runLevel} · {stats.xpIntoLevel}/{stats.xpNeeded} XP</span>
                </div>
              </div>

              {stats.combo > 1 && (
                <div className="w-full max-w-[260px] rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-md">
                  <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.16em]">
                    <span className="text-white/55">Combo</span>
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
                  Multiplikator x{stats.multiplier} · streak {stats.streak}
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
                  title={`Fiskar: ${stats.collectedCount} av ${stats.totalFish} (m\u00e5l ${stats.fishGoal})`}
                >
                  <span className="material-symbols-outlined text-[15px] text-primary">set_meal</span>
                  <span className="tabular text-xs font-black">
                    {Math.min(stats.collectedCount, stats.fishGoal)}/{stats.fishGoal}
                    {stats.collectedCount >= stats.fishGoal && stats.collectedCount < stats.totalFish && (
                      <span className="ml-1 text-[9px] text-primary/70">{stats.collectedCount}/{stats.totalFish}</span>
                    )}
                  </span>
                </div>
                <div className={`hud-chip border-yellow-500/25 bg-yellow-500/10 ${isMobile ? 'hidden' : 'hidden sm:inline-flex'}`}>
                  <span className="material-symbols-outlined text-[15px] text-yellow-400">monetization_on</span>
                  <span className="tabular text-xs font-black text-yellow-300">{progress.coins}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className={`hud-chip ${isMobile ? 'hidden' : 'hidden sm:inline-flex'}`} title="Väder">
                  <span
                    className={`material-symbols-outlined text-[15px] ${
                      stats.weather === 'SOLIGT'
                        ? stats.timeOfDay === 'DAY' ? 'text-orange-400' : 'text-yellow-400'
                        : stats.weather === 'REGNIGT' ? 'text-blue-400'
                        : stats.weather === 'SNÖIGT' ? 'text-white'
                        : stats.weather === 'DIMMIGT' ? 'text-gray-300' : 'text-purple-400'
                    }`}
                  >
                    {stats.weather === 'SOLIGT'
                      ? stats.timeOfDay === 'DAY' ? 'sunny' : 'nightlight'
                      : stats.weather === 'REGNIGT' ? 'rainy'
                      : stats.weather === 'SNÖIGT' ? 'ac_unit'
                      : stats.weather === 'DIMMIGT' ? 'foggy' : 'thunderstorm'}
                  </span>
                  {stats.noHit && (
                    <span className="material-symbols-outlined text-[13px] text-primary" title="Inga skador ännu">verified</span>
                  )}
                  {stats.nearMisses > 0 && (
                    <span className="tabular text-[9px] font-black text-white/60" title="Nästan-träffar">{stats.nearMisses}</span>
                  )}
                </div>

                {stats.levelType === 'Speed Run' && (
                  <div className="hud-chip border-orange-400/35 bg-orange-400/10 sm:inline-flex">
                    <span className="material-symbols-outlined text-[15px] text-orange-300">timer</span>
                    <span className="tabular text-xs font-black text-orange-200">{Math.ceil(stats.timer)}s</span>
                  </div>
                )}

                <div className="pointer-events-auto flex items-center gap-1">
                  <button
                    onClick={toggleMuted}
                    aria-pressed={isMuted}
                    aria-label={isMuted ? 'Slå på ljudet' : 'Stäng av ljudet'}
                    title={isMuted ? 'Slå på ljudet' : 'Stäng av ljudet'}
                    className={`hud-icon hidden sm:inline-flex ${isMuted ? 'text-primary-red' : 'text-white/65'}`}
                  >
                    <span className="material-symbols-outlined text-[17px]">
                      {isMuted ? 'volume_off' : 'volume_up'}
                    </span>
                  </button>
                  <button onClick={togglePause} aria-label="Pausa" title="Pausa (Esc)" className="hud-icon text-white/65">
                    <span className="material-symbols-outlined text-[17px]">pause</span>
                  </button>
                  <button onClick={toggleFullscreen} aria-label="Helskärm" title="Helskärm" className={`hud-icon text-white/65 ${isMobile ? 'hidden' : 'hidden sm:inline-flex'}`}>
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
                {(CHAPTER_NAMES[(Math.max(1, currentLevel) - 1) % CHAPTER_NAMES.length] || 'Neon City')}
              </p>
              <h2 className="mt-2 text-5xl font-black uppercase leading-none tracking-tight text-white md:text-6xl">
                Nivå {currentLevel}
              </h2>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span
                  className="h-1 w-8 rounded-full"
                  style={{ background: (LEVEL_MODE_META[stats.levelType] || LEVEL_MODE_META.Classic).accent }}
                />
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/75">
                  {(LEVEL_MODE_META[stats.levelType] || LEVEL_MODE_META.Classic).label}
                </p>
                <span
                  className="h-1 w-8 rounded-full"
                  style={{ background: (LEVEL_MODE_META[stats.levelType] || LEVEL_MODE_META.Classic).accent }}
                />
              </div>
              <p className="mt-2 text-xs font-medium text-white/50">
                {(LEVEL_MODE_META[stats.levelType] || LEVEL_MODE_META.Classic).goal}
              </p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                {LEVEL_LAYOUT_META[getLevelLayout(currentLevel)].name}
              </p>
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
              <p className="eyebrow text-primary">Spelet pausat</p>
              <h2 className="mt-1 font-display text-3xl font-black uppercase tracking-tight text-white">Andhämtning</h2>
              <p className="mt-1 text-xs font-medium text-white/45">
                Nivå {currentLevel} · {(LEVEL_MODE_META[stats.levelType] || LEVEL_MODE_META.Classic).label} · {stats.progress}% klart
              </p>

              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { label: 'Liv', value: lives, tone: 'text-[#ff7f9b]' },
                  { label: 'Fiskar', value: `${stats.collectedCount}/${stats.totalFish}`, tone: 'text-primary' },
                  { label: 'Poäng', value: stats.score.toLocaleString(), tone: 'text-white' },
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
                  Fortsätt
                </button>
                <button onClick={restartCurrentLevel} className="btn-ghost w-full py-3 text-xs uppercase tracking-wider">
                  <span className="material-symbols-outlined text-base">restart_alt</span>
                  Starta om nivån
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={toggleMuted} className="btn-ghost py-3 text-xs uppercase tracking-wider">
                    <span className="material-symbols-outlined text-base">{isMuted ? 'volume_off' : 'volume_up'}</span>
                    {isMuted ? 'Ljud av' : 'Ljud på'}
                  </button>
                  <button
                    onClick={() => { togglePause(); onEnd(totalScore, gameRef.current?.totalCollectedInLevel ?? 0); }}
                    className="btn-ghost py-3 text-xs uppercase tracking-wider"
                  >
                    <span className="material-symbols-outlined text-base">logout</span>
                    Avsluta
                  </button>
                </div>
              </div>

              <p className="mt-4 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-white/25">
                {isTouchDevice ? 'Pausknappen sitter i hörnet' : 'Esc eller P för att fortsätta'}
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
                ⚔️ {stats.bossName || 'BOSS'} – FAS {(stats.bossPhase || 0) + 1}
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

        {/* Objective pill: one always-current sentence that tells the player what
            to do next, so a run never stalls on a full fish counter. */}
        {!showLevelComplete && !isPaused && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center px-2">
            <div className="hud-panel flex items-center gap-2 px-3 py-1.5">
              <span className="material-symbols-outlined text-[15px] text-primary">
                {stats.bossHp > 0 ? 'swords' : stats.collectedCount >= stats.fishGoal ? 'near_me' : 'set_meal'}
              </span>
              <span className="max-w-[60vw] truncate text-[10px] font-black uppercase tracking-[0.14em] text-white/80">
                {stats.bossHp > 0
                  ? `Besegra ${stats.bossName || 'bossen'}`
                  : stats.collectedCount >= stats.fishGoal
                    ? `Spring till Jerry · ${stats.goalDist} m`
                    : `Samla ${Math.max(0, stats.fishGoal - stats.collectedCount)} fiskar till`}
              </span>
              {stats.collectedCount >= stats.fishGoal && (
                <span className="tabular rounded-md bg-primary/15 px-1.5 py-0.5 text-[9px] font-black text-primary">MÅL</span>
              )}
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
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
              <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#101a2c] to-[#060b16] p-5 shadow-[0_40px_120px_-40px_rgba(0,0,0,1)] md:p-7">
                {/* Accent light behind the grade */}
                <div
                  className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full blur-3xl"
                  style={{ background: gradeTone.glow, opacity: 0.35 }}
                  aria-hidden="true"
                />

                <div className="relative flex items-start gap-4">
                  <div
                    className="flex size-20 shrink-0 flex-col items-center justify-center rounded-2xl border-2 md:size-24"
                    style={{ borderColor: gradeTone.ring, boxShadow: `0 0 32px ${gradeTone.glow}`, background: 'rgba(255,255,255,0.03)' }}
                  >
                    <span className="font-display text-4xl font-black leading-none md:text-5xl" style={{ color: gradeTone.text }}>{grade}</span>
                    <span className="mt-1 text-[8px] font-black uppercase tracking-[0.2em] text-white/40">Betyg</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow text-primary">Nivå {currentLevel} klar</p>
                    <h2 className="mt-1 font-display text-2xl font-black uppercase leading-tight tracking-tight text-white md:text-3xl">
                      Snyggt jobbat!
                    </h2>
                    <div className="mt-1.5 flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="material-symbols-outlined text-lg"
                          style={{
                            color: i < stars ? gradeTone.ring : 'rgba(255,255,255,0.12)',
                            filter: i < stars ? `drop-shadow(0 0 6px ${gradeTone.glow})` : 'none',
                          }}
                        >
                          star
                        </span>
                      ))}
                      <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                        {(LEVEL_MODE_META[levelSummary.levelType] || LEVEL_MODE_META.Classic).short} · {levelSummary.time}s
                      </span>
                    </div>
                  </div>
                </div>

                <div className="relative mt-5 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Poäng', value: levelSummary.score.toLocaleString(), tone: 'text-primary' },
                    { label: 'Mynt', value: `+${levelSummary.coins}`, tone: 'text-yellow-300' },
                    { label: 'Fiender', value: levelSummary.kills || 0, tone: 'text-orange-200' },
                    { label: 'Bästa streak', value: levelSummary.streak, tone: 'text-cyan-300' },
                    { label: 'Nästan', value: levelSummary.nearMisses, tone: 'text-[#7ef7c2]' },
                    { label: 'Runnivå', value: levelSummary.runLevel, tone: 'text-white' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.04] px-2 py-2.5 text-center">
                      <p className={`tabular text-lg font-black leading-none ${s.tone}`}>{s.value}</p>
                      <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-white/35">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className={`relative mt-3 flex items-center justify-center gap-2 rounded-2xl border p-2.5 ${levelSummary.noHit ? 'border-primary/40 bg-primary/10' : 'border-white/10 bg-white/[0.03]'}`}>
                  <span className={`material-symbols-outlined text-base ${levelSummary.noHit ? 'text-primary' : 'text-white/35'}`}>verified</span>
                  <span className={`text-[11px] font-black uppercase tracking-wider ${levelSummary.noHit ? 'text-primary' : 'text-white/45'}`}>
                    {levelSummary.noHit ? 'Felfri · utan skada +750' : levelSummary.perfect ? 'Perfekt nivå +500' : 'Nivå avklarad'}
                  </span>
                </div>

                <div className="relative mt-4 flex flex-col gap-2 sm:flex-row">
                  <button onClick={startNextLevel} className="btn-primary w-full py-3.5 text-sm md:text-base">
                    <span className="material-symbols-outlined text-xl">arrow_forward</span>
                    {currentLevel % 5 === 4 ? `Bosskamp · nivå ${currentLevel + 1}` : `Nästa nivå · ${currentLevel + 1}`}
                  </button>
                  <button
                    onClick={() => onEnd(totalScore, gameRef.current?.totalCollectedInLevel ?? 0)}
                    className="btn-ghost w-full py-3.5 text-xs uppercase tracking-wider sm:w-auto sm:px-6"
                  >
                    Avsluta
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
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">Spela i landskap</span>
          <span className="max-w-[210px] text-[10px] leading-relaxed text-white/35">
            Vrid telefonen för full bredd på banan – då hamnar styrknapparna under tummarna.
          </span>
        </button>
      )}

      {/* TOUCH CONTROLS - UNDER spelrutan */}
      {isTouchDevice && !showLevelComplete && (
        <div
          className={`flex w-full max-w-4xl shrink-0 items-center justify-between px-3 py-1 select-none pointer-events-auto lg:px-4 lg:py-2 ${
            stackControlsAtBottom ? 'mt-auto' : ''
          }`}
        >
          {/* Vänster sida: Styrning (Move vänster/höger) */}
          <div className="flex items-center gap-3">
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
          <div className="flex items-center gap-3">
            {/* Hopp-knapp */}
            <button
              className="size-16 lg:size-20 bg-primary/20 backdrop-blur-md rounded-full flex flex-col items-center justify-center border-4 border-primary/40 border-b-8 border-b-black/40 text-white shadow-2xl active:translate-y-2 active:border-b-0 active:bg-primary/60 transition-all group"
              onTouchStart={(e) => { e.preventDefault(); requestJump(); }}
              onTouchEnd={(e) => { e.preventDefault(); releaseJump(); }}
            >
              <span className="material-symbols-outlined text-3xl group-active:scale-110 transition-transform">arrow_upward</span>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-90">HOPPA</span>
            </button>

            {/* Dash-knapp */}
            <button
              className="size-12 sm:size-14 lg:size-16 bg-cyan-400/20 backdrop-blur-md rounded-full flex flex-col items-center justify-center border-4 border-cyan-300/40 border-b-8 border-b-black/40 text-white shadow-2xl active:translate-y-2 active:border-b-0 active:bg-cyan-300/60 transition-all group"
              onTouchStart={(e) => { e.preventDefault(); triggerDash(); }}
            >
              <span className="material-symbols-outlined text-2xl group-active:scale-110 transition-transform">bolt</span>
              <span className="text-[9px] font-black uppercase tracking-widest opacity-90">DASH</span>
            </button>

            {/* Shoot-knapp */}
            <button
              className="size-16 lg:size-20 bg-primary-red/30 backdrop-blur-md rounded-full flex flex-col items-center justify-center border-4 border-primary-red/50 border-b-8 border-b-black/40 text-white shadow-2xl active:translate-y-2 active:border-b-0 active:bg-primary-red/60 transition-all group"
              onTouchStart={(e) => { e.preventDefault(); fireBullet(); }}
            >
              <span className="material-symbols-outlined text-3xl group-active:scale-110 transition-transform">bolt</span>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-90">SKJUT</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/** SHOP VIEW **/
export const ShopView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { progress, buyUpgrade, equipSkin } = useProgress();
  const [message, setMessage] = useState('');

  const handleBuy = (type: 'maxAmmo' | 'jumpPower' | 'speed', cost: number) => {
    if (buyUpgrade(type, cost)) {
      setMessage('Uppgradering köpt!');
      AudioEngine.playPowerup();
    } else {
      setMessage('Inte tillräckligt med mynt!');
    }
    setTimeout(() => setMessage(''), 2200);
  };

  const upgrades: Array<{
    type: 'maxAmmo' | 'jumpPower' | 'speed';
    icon: string;
    title: string;
    desc: string;
    cost: number;
    value: string;
    gain: string;
    tone: string;
    ring: string;
  }> = [
    {
      type: 'maxAmmo', icon: 'battery_charging_full', title: 'Ammokapacitet',
      desc: 'Fler skott innan du måste hitta en ammolåda.',
      cost: 500, value: `${progress.upgrades.maxAmmo.toFixed(0)} skott`, gain: '+1 skott',
      tone: 'text-sky-300', ring: 'border-sky-400/25 bg-sky-400/10',
    },
    {
      type: 'jumpPower', icon: 'rocket_launch', title: 'Hoppkraft',
      desc: 'Högre hopp och längre dubbelhopp – når nya plattformar.',
      cost: 750, value: progress.upgrades.jumpPower.toFixed(1), gain: '+0.5 kraft',
      tone: 'text-emerald-300', ring: 'border-emerald-400/25 bg-emerald-400/10',
    },
    {
      type: 'speed', icon: 'speed', title: 'Sprint',
      desc: 'Snabbare markfart så du hinner före farorna.',
      cost: 1000, value: progress.upgrades.speed.toFixed(1), gain: '+0.5 fart',
      tone: 'text-violet-300', ring: 'border-violet-400/25 bg-violet-400/10',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl animate-fade-in-up px-4 py-6 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">Butik</p>
          <h1 className="mt-1 font-display text-3xl font-black uppercase tracking-tight md:text-5xl">Uppgraderingar</h1>
          <p className="mt-2 max-w-md text-sm text-white/50">Bygg din katt starkare med mynt du samlar i banorna.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-yellow-400/25 bg-yellow-400/10 px-3.5 py-2">
            <span className="material-symbols-outlined text-xl text-yellow-300">monetization_on</span>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-yellow-200/60">Dina mynt</p>
              <p className="tabular text-lg font-black leading-none text-yellow-200">{progress.coins}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-3.5 py-2">
            <span className="material-symbols-outlined text-xl text-primary">military_tech</span>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-primary/60">Rank</p>
              <p className="tabular text-lg font-black leading-none text-primary">{progress.level}</p>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-center text-xs font-bold text-primary animate-fade-in-up">
          {message}
        </div>
      )}

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {upgrades.map((u) => {
          const affordable = progress.coins >= u.cost;
          return (
            <div key={u.type} className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a1220]/75 p-4 backdrop-blur-md">
              <div className={`flex size-11 items-center justify-center rounded-xl border ${u.ring}`}>
                <span className={`material-symbols-outlined text-xl ${u.tone}`}>{u.icon}</span>
              </div>
              <h3 className="mt-3 font-display text-lg font-black uppercase tracking-tight text-white">{u.title}</h3>
              <p className="mt-1 min-h-[2.5rem] text-[11px] leading-relaxed text-white/45">{u.desc}</p>
              <div className="mt-2 flex items-center justify-between rounded-lg border border-white/[0.07] bg-black/25 px-2.5 py-1.5">
                <span className="text-[8px] font-black uppercase tracking-wider text-white/35">Nuvarande</span>
                <span className="tabular text-xs font-black text-white/85">{u.value}</span>
              </div>
              <button
                onClick={() => handleBuy(u.type, u.cost)}
                disabled={!affordable}
                className={`mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
                  affordable
                    ? 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/25'
                    : 'cursor-not-allowed border-white/10 bg-white/5 text-white/30'
                }`}
              >
                <span className="material-symbols-outlined text-base">monetization_on</span>
                {u.cost}
                <span className="text-[9px] font-bold text-white/35">· {u.gain}</span>
              </button>
              {!affordable && (
                <p className="mt-1.5 text-center text-[8px] font-bold uppercase tracking-wider text-white/25">
                  Saknas {u.cost - progress.coins} mynt
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Perks */}
      <div className="mt-5 rounded-2xl border border-white/10 bg-[#0a1220]/72 p-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-primary">auto_awesome</span>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">Passiva förmåner</h2>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { level: 5, label: 'Smidiga tassar', desc: '+fart', icon: 'directions_run' },
            { level: 10, label: 'Ammoeffektiv', desc: '+2 skott per nivå', icon: 'bolt' },
            { level: 15, label: 'Vaksintinkt', desc: 'Startar med sköld', icon: 'shield' },
          ].map((perk) => {
            const unlocked = progress.level >= perk.level;
            return (
              <div
                key={perk.level}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
                  unlocked ? 'border-primary/30 bg-primary/[0.08]' : 'border-white/[0.07] bg-black/20'
                }`}
              >
                <span className={`material-symbols-outlined text-base ${unlocked ? 'text-primary' : 'text-white/25'}`}>
                  {unlocked ? perk.icon : 'lock'}
                </span>
                <div className="min-w-0">
                  <p className={`truncate text-[11px] font-black ${unlocked ? 'text-white' : 'text-white/35'}`}>{perk.label}</p>
                  <p className="truncate text-[9px] text-white/30">Nivå {perk.level} · {perk.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skins */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">Skinn</h2>
          <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">
            {progress.unlockedSkins.length}/{Object.keys(SKINS).length} upplåsta
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(SKINS).map(([id, skin]) => {
            const unlocked = progress.unlockedSkins.includes(id);
            const equipped = progress.equippedSkin === id;
            return (
              <button
                key={id}
                onClick={() => unlocked && equipSkin(id)}
                disabled={!unlocked}
                className={`group relative overflow-hidden rounded-2xl border p-3 text-left transition-all ${
                  equipped
                    ? 'border-primary/50 bg-primary/[0.1]'
                    : unlocked
                      ? 'border-white/10 bg-white/[0.035] hover:border-white/20'
                      : 'cursor-not-allowed border-white/[0.06] bg-black/20'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/20"
                    style={{
                      background: `radial-gradient(circle at 35% 30%, ${skin.color}, #0b1020 160%)`,
                      boxShadow: equipped ? `0 0 18px ${skin.color}88` : 'none',
                    }}
                  >
                    {!unlocked && <span className="material-symbols-outlined text-[14px] text-white/70">lock</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-xs font-black ${unlocked ? 'text-white' : 'text-white/40'}`}>{skin.name}</p>
                    <p className="truncate text-[9px] text-white/30">{unlocked ? (equipped ? 'Aktivt skinn' : 'Upplåst') : skin.unlockHint}</p>
                  </div>
                  {equipped && (
                    <span className="material-symbols-outlined text-base text-primary">check_circle</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <button onClick={onBack} className="btn-ghost mt-6 w-full py-3 text-xs uppercase tracking-wider">
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Tillbaka
      </button>
    </div>
  );
};

/** QUESTS VIEW **/
export const QuestsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { progress, claimQuestReward } = useProgress();
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
        className={`rounded-2xl border p-3.5 transition-colors ${
          quest.completed
            ? tone === 'daily' ? 'border-primary/30 bg-[#0c1f18]/85' : 'border-yellow-400/30 bg-[#1d1a0b]/85'
            : 'border-white/[0.08] bg-[#0a1220]/75'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${quest.completed ? (tone === 'daily' ? 'bg-primary/20' : 'bg-yellow-400/20') : 'bg-white/[0.05]'}`}>
            <span className={`material-symbols-outlined text-lg ${quest.completed ? (tone === 'daily' ? 'text-primary' : 'text-yellow-300') : 'text-white/30'}`}>
              {quest.completed ? 'check_circle' : tone === 'daily' ? 'radio_button_unchecked' : 'pending'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-xs font-bold ${quest.completed ? 'text-white' : 'text-white/70'}`}>{quest.description}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${tone === 'daily' ? 'bg-gradient-to-r from-primary/60 to-primary' : 'bg-gradient-to-r from-yellow-500/60 to-yellow-300'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="tabular shrink-0 text-[9px] font-black text-white/40">{Math.min(quest.current, quest.target)}/{quest.target}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className={`tabular text-xs font-black ${tone === 'daily' ? 'text-yellow-300' : 'text-yellow-200'}`}>+{quest.reward}</p>
            {quest.completed && !quest.claimed && (
              <button
                onClick={() => claimQuestReward(quest.id)}
                className={`mt-1 rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                  tone === 'daily' ? 'bg-primary text-[#06210f]' : 'bg-yellow-300 text-[#241a02]'
                }`}
              >
                Hämta
              </button>
            )}
            {quest.claimed && (
              <span className="mt-1 inline-block rounded-lg bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white/35">
                Hämtad
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
          <p className="eyebrow text-primary">Uppdrag</p>
          <h1 className="mt-1 font-display text-3xl font-black uppercase tracking-tight md:text-5xl">Dagligt & veckans</h1>
          <p className="mt-2 max-w-md text-sm text-white/50">Utmaningar som roterar automatiskt. Hämta belöningen när du är klar.</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-primary/25 bg-primary/[0.08] px-4 py-2.5">
          <span className="material-symbols-outlined text-xl text-primary">military_tech</span>
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-primary/60">Rank {progress.level}</p>
            <p className="tabular text-sm font-black leading-none text-white">{progress.xp} XP</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-[#0a1220]/72 p-3 backdrop-blur-md">
        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-white/40">
          <span>Nästa rank</span>
          <span className="tabular">{xpLeft} XP kvar</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-primary/60 via-primary to-cyan-300" style={{ width: `${xpInto / 10}%` }} />
        </div>
      </div>

      <div className="mt-6 grid gap-2 lg:grid-cols-2 lg:gap-4">
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">Dagliga</h2>
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">{dailyDone}/{progress.dailyQuests.length} klara</span>
          </div>
          <div className="mt-2.5 space-y-2">
            {progress.dailyQuests.map((q) => renderQuest(q, 'daily'))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">Veckans</h2>
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/25">{weeklyDone}/{progress.weeklyQuests.length} klara</span>
          </div>
          <div className="mt-2.5 space-y-2">
            {progress.weeklyQuests.map((q) => renderQuest(q, 'weekly'))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0a1220]/72 p-4 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-primary">workspace_premium</span>
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">Prestationer</h2>
          </div>
          <p className="mt-1 text-[10px] text-white/35">
            {progress.achievements.length} av {ACHIEVEMENTS.length} upplåsta
          </p>
          <div className="mt-3 space-y-1.5">
            {ACHIEVEMENTS.map((a) => {
              const unlocked = progress.achievements.includes(a.id);
              return (
                <div key={a.id} className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${unlocked ? 'border-primary/30 bg-primary/[0.07]' : 'border-white/[0.06] bg-black/20'}`}>
                  <span className={`material-symbols-outlined text-base ${unlocked ? 'text-primary' : 'text-white/20'}`}>{unlocked ? a.icon : 'lock'}</span>
                  <div className="min-w-0">
                    <p className={`truncate text-[11px] font-black ${unlocked ? 'text-white' : 'text-white/35'}`}>{a.label}</p>
                    <p className="truncate text-[9px] text-white/25">{a.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <button onClick={onBack} className="btn-ghost mt-6 w-full py-3 text-xs uppercase tracking-wider">
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Tillbaka
      </button>
    </div>
  );
};
