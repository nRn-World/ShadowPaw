
import React, { useState, useEffect, useRef } from 'react';
import { AppView, ScoreEntry } from '../types';
import { getJerryTaunt } from '../services/geminiService';
import { useProgress } from '../context/ProgressContext';
import { AudioEngine } from '../services/AudioEngine';

const getSeasonTheme = () => {
  const month = new Date().getMonth();
  if (month === 11 || month <= 1) return 'winter';
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  return 'autumn';
};

const SKINS: Record<string, { name: string; color: string; accent: string; unlockHint: string }> = {
  default: { name: 'Neon Blue', color: '#4169E1', accent: '#333', unlockHint: 'Default' },
  ember: { name: 'Ember', color: '#e85d2c', accent: '#4a1d0d', unlockHint: 'Defeat 60 enemies' },
  frost: { name: 'Frost', color: '#62b7ff', accent: '#27415f', unlockHint: 'Collect 300 fish' },
  shadow: { name: 'Shadow', color: '#4f5d75', accent: '#141b2d', unlockHint: 'Reach combo x10' },
  aurora: { name: 'Aurora', color: '#29b88f', accent: '#0a3d33', unlockHint: 'Beat 3 bosses' },
};

/** Hero cat mark. Inline SVG keeps it crisp at any size and matches the
    in-game character (blue body, green eyes, pink nose) without clip-path hacks. */
const CatMenuIcon: React.FC = () => {
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    let timeoutId: number;

    const scheduleBlink = () => {
      const nextBlinkDelay = Math.random() * 5000 + 2000;
      timeoutId = window.setTimeout(() => {
        setIsBlinking(true);
        window.setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 150);
      }, nextBlinkDelay);
    };

    scheduleBlink();
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <svg
      viewBox="0 0 120 120"
      className="h-24 w-24 md:h-32 md:w-32"
      role="img"
      aria-label="Shadow Paw"
    >
      <defs>
        <radialGradient id="catBody" cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#6d92ff" />
          <stop offset="60%" stopColor="#4169E1" />
          <stop offset="100%" stopColor="#2743a8" />
        </radialGradient>
      </defs>

      {/* Ears */}
      <path d="M28 34 L36 8 L56 26 Z" fill="#2743a8" />
      <path d="M92 34 L84 8 L64 26 Z" fill="#2743a8" />
      <path d="M33 32 L38 16 L49 27 Z" fill="#8f6bb8" />
      <path d="M87 32 L82 16 L71 27 Z" fill="#8f6bb8" />

      {/* Head */}
      <circle cx="60" cy="64" r="36" fill="url(#catBody)" stroke="#1b2f7a" strokeWidth="1.5" />

      {/* Eyes */}
      {isBlinking ? (
        <>
          <path d="M38 60 Q45 66 52 60" stroke="#0b1a3a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M68 60 Q75 66 82 60" stroke="#0b1a3a" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="45" cy="59" r="9" fill="#f8fafc" />
          <circle cx="75" cy="59" r="9" fill="#f8fafc" />
          <circle cx="45" cy="60" r="5" fill="#22c55e" />
          <circle cx="75" cy="60" r="5" fill="#22c55e" />
          <circle cx="45" cy="60" r="2.2" fill="#05240f" />
          <circle cx="75" cy="60" r="2.2" fill="#05240f" />
          <circle cx="47" cy="56.5" r="1.6" fill="#ffffff" />
          <circle cx="77" cy="56.5" r="1.6" fill="#ffffff" />
        </>
      )}

      {/* Nose */}
      <path d="M60 70 L66 76 L54 76 Z" fill="#f472b6" />

      {/* Mouth */}
      <path
        d="M60 76 L60 80 M60 80 Q55 85 50 80 M60 80 Q65 85 70 80"
        stroke="#0b1a3a"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />

      {/* Whiskers - grow from the muzzle beside the nose and fan out level to
          downwards, kept clear of the eyes above them. */}
      <g stroke="#cbd5f5" strokeWidth="2" strokeLinecap="round" opacity="0.9" fill="none">
        <path d="M52 74 Q34 72 20 70" />
        <path d="M51 79 Q32 79 16 79" />
        <path d="M52 84 Q34 86 20 90" />
        <path d="M68 74 Q86 72 100 70" />
        <path d="M69 79 Q88 79 104 79" />
        <path d="M68 84 Q86 86 100 90" />
      </g>
    </svg>
  );
};

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
    className={`group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-4 font-bold uppercase tracking-wider transition-all duration-200 active:scale-[0.98] ${
      subtle ? 'py-3 text-sm text-white/70' : 'py-4 text-white'
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
export const StartMenuView: React.FC<{ onNavigate: (v: AppView) => void }> = ({ onNavigate }) => {
  const [tip, setTip] = useState<string>("");
  const { progress } = useProgress();

  const gameTips = [
    "Använd dubbelhopp för att nå högre plattformar!",
    "Samla fiskar för att få ammunition!",
    "Hoppa på fiender för att besegra dem!",
    "Håll kattens fart – dash med Shift ger extra fart!",
    "Ju längre din streak håller, desto högre blir multiplikatorn!",
    "Åk förbi fiender utan att träffa – det ger bonuspoäng!",
    "Varje 10:e fisk ger dig en mynt och ett extra skott!",
    "Klara en nivå utan att ta skada för +750 poäng!",
    "Rör dig nära fiender för nästan-träffar – de ger extra poäng!",
    "Samla fisk och besegra fiender för att fylla dagliga uppdrag!",
    "Ju högre nivå, desto snårare är ammunitionen – planera!",
    "Kontrollera allt från början av din hoppning för maximal höjd!",
    "Undvik att falla i hål – dubbelhopp räcker nästan alltid!",
    "Kombinationer ger poäng – chained-action mot fiender är starkast!"
  ];

  useEffect(() => {
    const randomTip = gameTips[Math.floor(Math.random() * gameTips.length)];
    setTip(randomTip);
  }, []);

  return (
    <div className="w-full min-h-[70vh] flex flex-col items-center justify-center px-4 py-8 md:py-12 animate-fade-in-up">
      <div className="mb-5 md:mb-7">
        <CatMenuIcon />
      </div>

      <div className="w-full max-w-xl text-center">
        <h1 className="display-title text-4xl md:text-7xl">
          Shadow <span className="text-primary">Paw</span>
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/55 md:text-base">
          Snabba dig genom neonstaden. Rädda Jerry. Bygg din streak.
        </p>

        {/* Hero stats */}
        <div className="mt-6 grid grid-cols-3 gap-2.5">
          <StatTile icon="monetization_on" label="Mynt" value={progress.coins} tone="text-yellow-400" glow="rgba(250,204,21,0.16)" />
          <StatTile icon="military_tech" label="Nivå" value={progress.level} tone="text-primary" glow="rgba(43,238,121,0.16)" />
          <StatTile icon="local_fire_department" label="Bästa combo" value={progress.stats.bestCombo} tone="text-cyan-300" glow="rgba(103,232,249,0.16)" />
        </div>

        {/* Career stats */}
        <div className="mt-2.5 grid grid-cols-3 gap-2.5">
          {[
            { v: progress.stats.totalFishCollected, l: 'Fiskar' },
            { v: progress.stats.totalEnemiesDefeated, l: 'Fiender' },
            { v: progress.stats.perfectLevels, l: 'Perfekta' },
          ].map((s) => (
            <div key={s.l} className="card-premium px-2 py-2.5">
              <p className="tabular text-sm font-black text-white">{s.v}</p>
              <p className="eyebrow mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Primary action */}
        <button
          onClick={() => onNavigate(AppView.PLAYING)}
          className="btn-primary group mt-6 w-full px-8 py-5 text-lg"
        >
          <span className="material-symbols-outlined text-[30px] transition-transform duration-200 group-hover:scale-110">play_arrow</span>
          <span>Spela</span>
        </button>

        {/* Secondary actions */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <MenuButton icon="store" label="Butik" onClick={() => onNavigate(AppView.SHOP)} />
          <MenuButton icon="task_alt" label="Uppdrag" onClick={() => onNavigate(AppView.QUESTS)} />
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <MenuButton icon="help" label="Så spelar du" onClick={() => onNavigate(AppView.HOW_TO_PLAY)} subtle />
          <MenuButton icon="emoji_events" label="Topplista" onClick={() => onNavigate(AppView.LEADERBOARD)} subtle />
        </div>

        {/* Tip */}
        <div className="card-premium mt-4 p-4 text-left">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-primary">lightbulb</span>
            <p className="eyebrow">Dagens tips</p>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/80">{tip}</p>
        </div>

        {/* Controls cheatsheet */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {[
            { k: 'A / D', v: 'Rör dig' },
            { k: 'Mellanslag', v: 'Hoppa' },
            { k: 'Shift', v: 'Dash' },
            { k: 'Klick', v: 'Skjuta' },
          ].map((c) => (
            <span key={c.k} className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/45">
              <span className="text-white/80">{c.k}</span> {c.v}
            </span>
          ))}
        </div>

        <button
          onClick={() => onNavigate(AppView.SETTINGS)}
          className="mt-5 text-white/70 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
        >
          Inställningar
        </button>
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
    <div className="w-full max-w-xl mx-auto animate-fade-in-up py-8 md:py-12 px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-3">
          <span className="material-symbols-outlined text-primary text-sm">settings</span>            <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest">System</span>
            <span className="text-white/30 text-[10px] ml-2"> Dra slidarna för att justera</span>
        </div>
        <h1 className="display-title text-3xl md:text-4xl">Inställningar</h1>
      </div>

      <div className="glass-card rounded-2xl border border-white/10 divide-y divide-white/5">
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
        className="w-full mt-6 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors"
      >
        <span className="material-symbols-outlined">arrow_back</span>
        Tillbaka till menyn
      </button>
    </div>
  );
};

/** HOW TO PLAY **/
export const HowToPlayView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in-up py-8 md:py-12 px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-3">
          <span className="material-symbols-outlined text-primary text-sm">school</span>
          <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Så spelar du</span>
        </div>
        <h1 className="display-title text-3xl md:text-4xl">Hur man spelar</h1>
        <p className="mt-2 text-white/70 text-sm">Lär dig grunderna för att dominera neonstaden</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card-premium p-5">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <span className="material-symbols-outlined text-primary text-2xl">flag</span>
          </div>
          <h3 className="text-white font-bold text-lg uppercase mb-2">Målet</h3>
          <p className="text-white/60 text-sm leading-relaxed">Ta dig genom staden, samla alla fiskar och nå Jerry. Undvik fiender och faror – varje nivå ger XP, mynt och högre poäng.</p>
        </div>

        <div className="card-premium p-5">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <span className="material-symbols-outlined text-primary text-2xl">gamepad</span>
          </div>
          <h3 className="text-white font-bold text-lg uppercase mb-2">Kontroller</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded bg-white/10 text-white/80 text-xs font-mono">A / D</span>
              <span className="text-white/60">Rör dig</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded bg-white/10 text-white/80 text-xs font-mono">Mellanslag / W</span>
              <span className="text-white/60">Hoppa (håll för högre hopp, tryck igen för dubbelhopp)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded bg-white/10 text-white/80 text-xs font-mono">Shift</span>
              <span className="text-white/60">Dash – snabb burst i riktningen du tittar</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded bg-white/10 text-white/80 text-xs font-mono">Klick</span>
              <span className="text-white/60">Skjuta (kostar ammunition)</span>
            </div>
          </div>
        </div>

        <div className="card-premium border-primary/25 p-5">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-yellow-400/25 bg-yellow-400/10">
            <span className="material-symbols-outlined text-yellow-400 text-2xl">local_fire_department</span>
          </div>
          <h3 className="text-white font-bold text-lg uppercase mb-2">Streak &amp; Multiplikator</h3>
          <p className="text-white/60 text-sm leading-relaxed mb-2">
            Varje fisk, fiender och bonus bygger din streak. Var 4:e i streak stiger multiplikatorn (upp till x8) och ger extra poäng p\u00e5 allt du g\u00f6r. Streaken tapas om du tar skada eller om den g\u00e5r ut.
          </p>
          <ul className="text-white/60 text-sm space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Bonusar: <strong className="text-white/80">OHIT +750</strong>, <strong className="text-white/80">PERFEKT +500</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>\u00c5k f\u00f6rbi fiender utan att r\u00f6ra dem = <strong className="text-white/80">N\u00c4STAN! +75</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>XP fyller din runniv\u00e5 – varje niv\u00e5 ger +2 skott</span>
            </li>
          </ul>
        </div>

        <div className="card-premium p-5">
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <span className="material-symbols-outlined text-primary text-2xl">stars</span>
          </div>
          <h3 className="text-white font-bold text-lg uppercase mb-2">Proffstips</h3>
          <ul className="text-white/60 text-sm space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Dubbelhopp räddar liv</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Skjut fiender p\u00e5 avst\u00e5nd \u2014 du sparar n\u00e4ra skott</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>Samla alla fiskar innan du n\u00e5r Jerry</span>
            </li>
          </ul>
        </div>
      </div>

      <button
        onClick={onBack}
        className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-[#112218] font-black uppercase tracking-wider hover:bg-primary/90 transition-colors"
      >
        <span className="material-symbols-outlined">check</span>
        Jag förstår
      </button>
    </div>
  );
};

/** LEADERBOARD **/
export const LeaderboardView: React.FC<{ onBack: () => void, onPlay: () => void }> = ({ onBack, onPlay }) => {
  const [scores, setScores] = useState<ScoreEntry[]>([]);

  useEffect(() => {
    const mockScores: ScoreEntry[] = [
      { rank: 1, name: 'ShadowNinja', score: 50400, level: 'Nivå 42', date: '24 okt', avatar: 'https://picsum.photos/seed/ShadowNinja/50/50' },
      { rank: 2, name: 'NeonHunter', score: 48200, level: 'Nivå 40', date: '23 okt', avatar: 'https://picsum.photos/seed/NeonHunter/50/50' },
      { rank: 3, name: 'CyberCat', score: 45000, level: 'Nivå 38', date: '22 okt', avatar: 'https://picsum.photos/seed/CyberCat/50/50' },
      { rank: 4, name: 'GhostPaw', score: 42100, level: 'Nivå 35', date: '21 okt', avatar: 'https://picsum.photos/seed/GhostPaw/50/50' },
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
      avatar: `https://picsum.photos/seed/${s.name}/50/50`,
      isUser: true
    }));

    const combined = [...mockScores, ...userScores].sort((a, b) => b.score - a.score);
    const finalScores = combined.map((s, idx) => ({ ...s, rank: idx + 1 })).slice(0, 15);
    setScores(finalScores);
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto animate-fade-in-up py-8 md:py-12 px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-3">
          <span className="material-symbols-outlined text-primary text-sm">emoji_events</span>
          <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Rangordning</span>
        </div>
        <h1 className="display-title text-3xl md:text-4xl">Topplista</h1>
        <p className="mt-2 text-white/70 text-sm">Se vem som är mästaren av neonstaden</p>
      </div>

      {/* Top 3 Podium */}
      {scores.length >= 3 && (
        <div className="flex items-end justify-center gap-4 mb-8">
          {/* 2nd Place */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-slate-400 ring-4 ring-white/10 mb-2 overflow-hidden">
              <img src={scores[1].avatar} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="w-20 h-24 glass-card rounded-t-xl border border-white/10 flex flex-col items-center justify-end pb-2">
              <span className="text-slate-400 font-black text-xl">2</span>
            </div>
          </div>
          {/* 1st Place */}
          <div className="flex flex-col items-center -mt-2">
            <div className="w-20 h-20 rounded-full bg-yellow-500 ring-4 ring-yellow-500/30 mb-2 overflow-hidden">
              <img src={scores[0].avatar} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="w-24 h-32 glass-card rounded-t-xl border border-yellow-500/30 flex flex-col items-center justify-end pb-2 bg-yellow-500/5">
              <span className="text-yellow-500 font-black text-3xl">1</span>
            </div>
          </div>
          {/* 3rd Place */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-orange-700 ring-4 ring-white/10 mb-2 overflow-hidden">
              <img src={scores[2].avatar} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="w-20 h-20 glass-card rounded-t-xl border border-white/10 flex flex-col items-center justify-end pb-2">
              <span className="text-orange-700 font-black text-xl">3</span>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard List */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto">
          {scores.map((s) => (
            <div
              key={`${s.name}-${s.score}-${s.date}`}
              className={`flex items-center gap-4 p-4 border-b border-white/5 ${s.isUser ? 'bg-primary/5' : 'hover:bg-white/5'} transition-colors`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${s.rank === 1 ? 'bg-yellow-500/20 text-yellow-500' :
                s.rank === 2 ? 'bg-slate-400/20 text-slate-400' :
                  s.rank === 3 ? 'bg-orange-700/20 text-orange-700' :
                    'bg-white/5 text-white/40'
                }`}>
                {s.rank}
              </div>
              <img src={s.avatar} alt="" className="w-10 h-10 rounded-xl object-cover" />
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm truncate ${s.isUser ? 'text-primary' : 'text-white'}`}>{s.name}</p>
                <p className="text-white/40 text-xs">{s.level}</p>
              </div>
              <div className="text-right">
                <p className={`font-black text-lg ${s.isUser ? 'text-primary' : 'text-white'}`}>{s.score.toLocaleString()}</p>
                <p className="text-white/30 text-xs">{s.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors"
        >
          Tillbaka
        </button>
        <button
          onClick={onPlay}
          className="flex-1 py-3 rounded-xl bg-primary text-[#112218] font-black uppercase tracking-wider hover:bg-primary/90 transition-colors"
        >
          Spela nu
        </button>
      </div>
    </div>
  );
};

/** GAME OVER **/
export const GameOverView: React.FC<{ score: number, fishesCollected?: number, onRestart: () => void, onMenu: () => void }> = ({ score, fishesCollected = 0, onRestart, onMenu }) => {
  const [taunt, setTaunt] = useState<string>("Bättre lycka nästa gång!");
  const [name, setName] = useState("");
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

  useEffect(() => {
    getJerryTaunt(score).then(setTaunt);
    addXP(Math.floor(score / 10));
    applyRunResults({
      fishesCollected,
      enemiesDefeated: lastRun.enemiesDefeated || 0,
      levelsCompleted: lastRun.levelsCompleted || 0,
      perfectLevel: !!lastRun.perfectLevel,
      bestCombo: lastRun.bestCombo || 0,
      bossDefeated: !!lastRun.bossDefeated,
      deaths: 1,
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
    await navigator.clipboard.writeText(summary);
    setShareMessage('Bild nedladdad + text kopierad!');
    setTimeout(() => setShareMessage(''), 2500);
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8 md:py-12 px-4 animate-fade-in-up max-h-[calc(100vh-110px)] overflow-y-auto overscroll-contain pb-24">
      {/* Header Section */}
      <div className="mb-8 md:mb-10 grid grid-cols-1 md:grid-cols-[360px_1fr] gap-6 md:gap-8 items-center">
        <div className="glass-card rounded-3xl border border-white/10 overflow-hidden">
          <div className="relative aspect-square bg-gradient-to-b from-black/25 to-black/60">
            <InjuredCatVisual />
          </div>
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 border border-white/10">
              <span className="material-symbols-outlined text-white/60 text-base">warning</span>
              <div className="min-w-0">
                <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Status</p>
                <p className="text-white font-black uppercase tracking-wide truncate">Uppdraget misslyckades</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-red/10 border border-primary-red/20 mb-4">
            <span className="material-symbols-outlined text-primary-red text-lg">sentiment_dissatisfied</span>
            <span className="text-white text-xs font-bold uppercase tracking-widest">Uppdraget misslyckades</span>
          </div>
          <h1 className="text-white text-5xl md:text-7xl font-black uppercase tracking-tight">
            Spelet <span className="text-primary-red">över</span>
          </h1>
          <p className="mt-4 text-white text-base md:text-lg max-w-lg mx-auto">
            {taunt}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile icon="flag" label="Poäng" value={score.toLocaleString()} tone="text-white" glow="rgba(43,238,121,0.14)" />
        <StatTile
          icon="emoji_events"
          label="Bästa"
          value={(() => {
            try {
              const scores = JSON.parse(localStorage.getItem('shadow_paw_scores') || '[]');
              return Math.max(score, ...scores.map((s: { score: number }) => s.score), 0).toLocaleString();
            } catch {
              return score.toLocaleString();
            }
          })()}
          tone="text-yellow-400"
          glow="rgba(250,204,21,0.14)"
        />
        <StatTile icon="set_meal" label="Fiskar" value={fishesCollected} tone="text-sky-300" glow="rgba(125,211,252,0.14)" />
        <StatTile icon="attach_money" label="Mynt denna runda" value={`+${coinsEarned}`} tone="text-primary" glow="rgba(43,238,121,0.16)" />
        <StatTile icon="monetization_on" label="Mynt totalt" value={totalCoins} tone="text-yellow-400" glow="rgba(250,204,21,0.14)" />
        <StatTile icon="military_tech" label="XP" value={`+${Math.floor(score / 10)}`} tone="text-cyan-300" glow="rgba(103,232,249,0.14)" />
      </div>

      {/* High Score Section */}
      <div className="card-premium mb-8 p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
            <span className="text-[#112218] text-xl">🏆</span>
          </div>
          <div>
            <h3 className="text-white font-black text-lg uppercase">Nytt rekord!</h3>
            <p className="text-white/50 text-xs font-medium">Spara ditt resultat till topplistan</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/40">person</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaved}
              placeholder="Ange ditt namn"
              maxLength={15}
              className={`w-full rounded-xl border border-white/10 bg-white/[0.04] py-4 pl-12 pr-4 text-white placeholder-white/30 transition-colors focus:border-primary/50 focus:outline-none ${isSaved ? 'cursor-not-allowed opacity-50' : ''}`}
            />
          </div>
          <button
            onClick={handleSaveScore}
            disabled={isSaved || !name.trim()}
            className="btn-primary whitespace-nowrap px-8 py-4 text-sm"
          >
            {isSaved ? 'Sparat!' : 'Spara'}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button onClick={handleShareCard} className="btn-ghost flex-1 py-4 text-lg uppercase">
          <span className="material-symbols-outlined text-primary">ios_share</span>
          Dela poäng
        </button>
        <button onClick={onRestart} className="btn-primary flex-1 py-4 text-lg">
          <span className="material-symbols-outlined text-xl">replay</span>
          Spela igen
        </button>
        <button onClick={onMenu} className="btn-ghost flex-1 py-4 text-lg uppercase">
          <span className="material-symbols-outlined">home</span>
          Huvudmeny
        </button>
      </div>
      {shareMessage && <p className="text-center text-primary text-sm font-bold mt-4">{shareMessage}</p>}
    </div>
  );
};

// AUDIO MANAGER FOR BACKGROUND MUSIC
const useBackgroundMusic = (level: number, isMuted: boolean = false, musicVolume: number = 75) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const targetVolume = isMuted ? 0 : Math.min(1, (musicVolume / 100) * 0.5);

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
  const normalizedLevel = Math.min(1, Math.max(0, (level - 1) / 49));
  // Keep early levels truly welcoming; late-game rank adds only a modest
  // challenge so upgrades never make the opening impossible for new players.
  const levelRamp = Math.pow(normalizedLevel, 1.55);
  const adjustedPlayerRank = Math.max(1, playerRank - Math.floor((level - 1) / 3));
  const normalizedRank = Math.min(1, Math.max(0, (adjustedPlayerRank - 1) / 49));

  // A curved ramp preserves easy onboarding and steadily expands challenge.
  const ramp = levelRamp;
  const rankBonus = Math.pow(normalizedRank, 1.2);
  const variant = (level - 1) % 6;
  const variantLengthBonus = [300, 800, 1400, 500, 1000, 1800][variant];

  return {
    levelLength: Math.floor(2400 + level * 320 + ramp * 2600 + variantLengthBonus),
    // Base width of one ground segment; the generator varies this per segment.
    segmentWidth: Math.max(118, 195 - level * 1.15 - ramp * 58),
    // How much harder the level gets between its start and its goal.
    inLevelRamp: 0.25 + ramp * 0.95 + rankBonus * 0.1,
    holeChance: Math.min(0.4, 0.005 + ramp * 0.3 + rankBonus * 0.06),
    holeSize: Math.min(0.44, 0.11 + ramp * 0.31),
    platformCount: Math.floor(9 + level * 0.8 + ramp * 7),
    enemyCount: Math.floor(1 + level * 0.58 + ramp * 5),
    enemySpeed: 1.15 + level * 0.065 + ramp * 1.0,
    fishCount: Math.floor(12 + level * 0.8 + ramp * 4),
    hazardCount: Math.floor(Math.max(0, level - 3) * 0.38 + ramp * 5),
    variant,
  };
};

const BOSS_ATTACK_PROFILES: Record<string, { cooldown: number; speed: number; radius: number; fan: boolean; color: string }> = {
  rat_king: { cooldown: 120, speed: 4.3, radius: 9, fan: false, color: '#ff6b35' },
  cyber_dog: { cooldown: 88, speed: 6.2, radius: 7, fan: false, color: '#00e1ff' },
  storm_eagle: { cooldown: 148, speed: 4.8, radius: 8, fan: true, color: '#ffe600' },
  void_dragon: { cooldown: 164, speed: 3.8, radius: 12, fan: false, color: '#a855f7' },
  shadow_titan: { cooldown: 186, speed: 3.2, radius: 14, fan: false, color: '#ff4d6d' },
};

const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
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
const SCALE_RANGE = { building: [0.5, 1.0] as const, animal: [1.4, 2.0] as const };

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
export const PlayingView: React.FC<{ onEnd: (score: number, fishesCollected: number) => void }> = ({ onEnd }) => {
  // The game loop is started once per level. Reading onEnd through a ref keeps a
  // parent re-render (e.g. the coin counter updating after every fish) from
  // changing the loop's dependencies and restarting the whole level.
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [showLevelComplete, setShowLevelComplete] = useState(false);
  const [levelSummary, setLevelSummary] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;

  const togglePause = () => {
    setIsPaused(prev => {
      const next = !prev;
      isPausedRef.current = next;
      return next;
    });
  };

  const restartCurrentLevel = () => {
    setIsPaused(false);
    isPausedRef.current = false;
    // Trigger re-setup of current level
    setCurrentLevel(prev => prev);
    if (gameRef.current) {
      gameRef.current.running = false;
    }
    // Force re-render of level
    setTimeout(() => {
      setCurrentLevel(prev => prev);
    }, 50);
  };

  const [stats, setStats] = useState({ score: 0, progress: 0, collectedCount: 0, totalFish: 0, ammo: 5, weather: 'SOLIGT', intensity: 'LIGHT', timeOfDay: 'NIGHT', combo: 0, levelType: 'Classic', timer: 0, miniEvent: 'NONE', xp: 0, runLevel: 1, xpNeeded: 120, multiplier: 1, streak: 0, dashReady: true, noHit: true, nearMisses: 0, toasts: [] as any[], bossHp: 0, bossMaxHp: 0, bossVisible: false, bossName: '', bossPhase: 0 });
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [isMobile, setIsMobile] = useState(false);
  const [combo, setCombo] = useState(0);
  const [seasonTheme] = useState(getSeasonTheme());
  const { progress, addCoins, toggleMuted } = useProgress();
  const isMuted = progress.settings.muted;

  const gameRef = useRef<any>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  // Use background music for levels 1-10. Mute + level follow the saved settings.
  useBackgroundMusic(currentLevel, isMuted, progress.settings.musicVolume);

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
      gameContainerRef.current.requestFullscreen();
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    setIsMobile(window.innerWidth < 768);
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
          type: level > 2 ? ['WIND', 'LOW_GRAVITY', 'BLACKOUT'][Math.floor(seededRandom(level * 13.5) * 3)] : 'NONE',
          active: false,
          timer: 540,
          duration: 260,
        },
      flashTimer: 0,
      groundY: canvas.height - 96,
      lightningBolts: [],
      bolts: [], // Current active lightning bolts
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

    // Ground is assembled from slabs of visibly different sizes: wide safe runs,
    // narrow pillars and, deeper in the level, real chasms that have to be
    // jumped. Both the sizes and the danger ramp up the further you get, so the
    // course visibly tightens the closer Jerry is.
    const groundY = canvas.height - 96;
    // Parallax scenery and the boss platform follow the same ground line.
    game.groundY = groundY;
    const baseSegment = difficultyProfile.segmentWidth;
    type GroundSeg = { x: number; width: number; along: number; chasm: boolean };
    const groundSegments: GroundSeg[] = [];
    let groundX = 0;
    let guard = 0;
    while (groundX < levelLength && guard < 400) {
      guard++;
      const along = groundX / Math.max(1, levelLength);
      // Later in the level the slabs get tighter overall.
      const ramp = along * difficultyProfile.inLevelRamp;
      const narrowest = Math.max(66, baseSegment * (0.44 + ramp * 0.22));
      const widest = Math.max(narrowest + 30, baseSegment * (1.95 - ramp * 0.6));

      const roll = Math.random();
      const width = roll < 0.28
        ? narrowest + Math.random() * narrowest * 0.3                                   // narrow pillar
        : roll < 0.82
          ? narrowest + Math.random() * (widest - narrowest)                            // medium
          : widest - Math.random() * (widest - narrowest) * 0.28;                      // wide safe run

      // A chasm replaces the slab entirely. Its width is capped to what a jump
      // (or a dash) can realistically clear, so it stays fair but scary.
      const chasmChance = Math.max(0, ramp - 0.35) * 0.3;
      const chasm = width > 92 && Math.random() < chasmChance;

      groundSegments.push({ x: groundX, width, along, chasm });
      groundX += width;
    }

    groundSegments.forEach((seg) => {
      const ramp = seg.along * difficultyProfile.inLevelRamp;
      // The first and last stretch stay readable so the level never opens or
      // ends on an unfair trap.
      const safeZone = seg.x < 620 || seg.x > levelLength - 900;
      // Slabs are drawn with different depths so the size variation is readable.
      const depth = 38 + Math.round(Math.random() * 54);

      if (!safeZone && seg.chasm) {
        const chasmWidth = Math.min(seg.width * 0.72, 62 + ramp * 78);
        game.holes.push({ x: seg.x + (seg.width - chasmWidth) / 2, width: chasmWidth, y: groundY });
        // Ledges on both sides so the chasm can be jumped from and landed on.
        const sideWidth = (seg.width - chasmWidth) / 2;
        if (sideWidth > 1) {
          game.platforms.push({ x: seg.x, y: groundY, width: sideWidth, height: depth, color: '#1c3a2a', isGround: true });
          game.platforms.push({ x: seg.x + sideWidth + chasmWidth, y: groundY, width: sideWidth, height: depth, color: '#1c3a2a', isGround: true });
        }
        return;
      }

      const holeChance = difficultyProfile.holeChance * (0.45 + ramp * 1.6);
      // A slab needs enough width left over for two standable ledges.
      const canSplit = seg.width > 110;

      if (!safeZone && canSplit && Math.random() < holeChance) {
        const holeWidth = Math.min(
          seg.width * 0.72,
          seg.width * (difficultyProfile.holeSize + ramp * 0.18)
        );
        const holeOffset = (seg.width - holeWidth) / 2;

        game.holes.push({ x: seg.x + holeOffset, width: holeWidth, y: groundY });
        if (holeOffset > 1) {
          game.platforms.push({ x: seg.x, y: groundY, width: holeOffset, height: depth, color: '#1c3a2a', isGround: true });
        }
        const rightWidth = seg.width - holeOffset - holeWidth;
        if (rightWidth > 1) {
          game.platforms.push({ x: seg.x + holeOffset + holeWidth, y: groundY, width: rightWidth, height: depth, color: '#1c3a2a', isGround: true });
        }
        return;
      }

      game.platforms.push({ x: seg.x, y: groundY, width: seg.width, height: depth, color: '#1c3a2a', isGround: true });
    });

    // MANY MORE platforms - but ALL reachable with double jump!
    const platCount = difficultyProfile.platformCount;
    // Maximum height player can reach with double jump is about 250px
    const maxJumpHeight = 250;
    const minGap = Math.max(55, 130 - (level * 0.8));

    for (let i = 0; i < platCount; i++) {
      let attempts = 0;
      let validPos = false;
      let px = 0;
      let py = 0;
      // Later platforms in the level are placed in tighter clusters.
      const ramp = (i / Math.max(1, platCount)) * difficultyProfile.inLevelRamp;
      // Vary platform widths for more interesting gameplay
      const widthVariation = Math.random();
      // Three clearly distinct sizes so the skyline reads at a glance.
      let pw = widthVariation > 0.78 ? 70 : (widthVariation > 0.42 ? 112 : 168);
      // Platforms shrink as the game gets harder, so landing gets tighter.
      pw = Math.max(44, pw - (level * 0.8) - ramp * 16);
      // Heights vary too, which makes gaps between platforms easier to read.
      const ph = widthVariation > 0.78 ? 16 : 22;

      while (!validPos && attempts < 50) {
        attempts++;
        // Spread platforms throughout the ENTIRE level, weighted to the back half.
        const platBias = 1 - Math.pow(Math.random(), 1 + difficultyProfile.inLevelRamp * 0.8);
        const platformEndBuffer = level % 5 === 0 ? 1400 : 700;
        px = 300 + platBias * Math.max(100, levelLength - platformEndBuffer);

        // ALL platforms must be reachable - not too high!
        // Keep platforms in the lower section of screen so double jump can reach
        const minPy = Math.max(50, canvas.height - 280);
        py = minPy + Math.random() * (canvas.height - 100 - minPy);

        // Ensure vertical variation - but always reachable!
        if (i > 0 && Math.random() < 0.4) {
          // Only go up by max jump height
          const prevY = game.platforms[game.platforms.length - 1].y;
          py = Math.max(minPy, Math.min(prevY - 50 - Math.random() * 100, canvas.height - 100));
        }

        const bufferX = minGap;
        const bufferY = 50;
        const hasCollision = game.platforms.some(oldP => {
          return (px < oldP.x + oldP.width + bufferX && px + pw + bufferX > oldP.x && py < oldP.y + oldP.height + bufferY && py + ph + bufferY > oldP.y);
        });
        if (!hasCollision) validPos = true;
      }
      if (validPos) {
        game.platforms.push({ x: px, y: py, width: pw, height: ph, color: '#234832' });
      }
    }

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
      const enemyType = Math.floor(Math.random() * 3);
      game.enemies.push({
        x: ex, y: plat.y - 40, width: 40, height: 40,
        velocityX: difficultyProfile.enemySpeed * depthRamp * (Math.random() > 0.5 ? 1 : -1),
        direction: 1, platform: randomSegment, type: enemyType
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
        height: 18,
        color: '#234832',
        isGround: false,          bossArena: true,
          bossWalkway: true,

      };
      game.platforms.push(bossPlatform);
      const bossApproach = {
        x: bossArenaStart,
        y: groundY,
        width: bossPlatform.x - bossArenaStart,
        height: 28,
        color: '#1c3a2a',
        isGround: true,
        bossWalkway: true,
      };
      game.platforms = game.platforms.filter((platform: any) =>
        !platform.isGround || platform.x + platform.width <= bossArenaStart || platform.x >= bossPlatform.x + bossPlatform.width
      );
      game.platforms.push(bossApproach);
      {
        const totalHp = 10 + Math.floor(level * 0.6);
        game.enemies = game.enemies.filter((enemy: any) => enemy.x < bossArenaStart || enemy.x > levelLength - 280);
        game.boss = {
          x: bossPlatform.x + (bossPlatform.width - 100) / 2,
          y: bossPlatform.y - 90,
          width: 100,
          height: 90,
          hp: totalHp,
          maxHp: totalHp,
          velocityX: 2.0 + level * 0.04,
          velocityY: 0,
          platformX: bossPlatform.x,
          platformW: bossPlatform.width,
          groundY: bossPlatform.y - 90,
          phase: 0,  // 0=normal, 1=aggressive, 2=rage
          type: bossType,
          name: bossNames[bossType] || 'BOSS',
          attackTimer: BOSS_ATTACK_PROFILES[bossType].cooldown,
          attackCooldown: BOSS_ATTACK_PROFILES[bossType].cooldown,
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
      const clampedFx = Math.max(50, Math.min(fx, levelLength - 50));

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
    if (!gameRef.current || !gameRef.current.running) return;
    const game = gameRef.current;
    if (game.ammo <= 0) return;
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
    const bulletSpeed = 10;
    game.bullets.push({
      x: playerCenterX, y: playerCenterY, vx: (dx / distance) * bulletSpeed, vy: (dy / distance) * bulletSpeed, radius: 6, life: 100
    });
    game.ammo--;
    if (progress.settings.haptics && navigator.vibrate) navigator.vibrate(8);
    AudioEngine.playShoot();
  };

  // Helper function to generate a lightning bolt structure
  const createLightningBolt = (startX: number, canvasHeight: number) => {
    const points = [];
    let curX = startX;
    let curY = 0;
    points.push({ x: curX, y: curY });
    while (curY < canvasHeight * 0.8) {
      curX += (Math.random() - 0.5) * 60;
      curY += Math.random() * 40 + 10;
      points.push({ x: curX, y: curY });
    }
    return points;
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
      if (game.hitStop > 0) {
        game.hitStop--;
        return;
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
            awardCoins(game, 2);
            game.enemiesDefeatedInRun = (game.enemiesDefeatedInRun || 0) + 1;
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
            game.running = false;
            trackDeathCause('timer');
            persistRunSummary(game, false);
            onEndRef.current(game.score, game.totalCollectedInLevel);
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

      if (game.weather === 'STORMIGT') {
        if (game.flashTimer > 0) game.flashTimer--;
        else game.bolts = []; // Clear bolts when flash ends

        if (Math.random() < 0.005) {
          game.flashTimer = 8;
          // Generate 1-2 bolts for the visual
          const boltCount = Math.floor(Math.random() * 2) + 1;
          game.bolts = [];
          for (let i = 0; i < boltCount; i++) {
            game.bolts.push(createLightningBolt(Math.random() * canvas.width, canvas.height));
          }
        }
      } else if (game.weather === 'REGNIGT' && game.intensity === 'HEAVY') {
        // Subtle thunder for heavy rain
        if (game.flashTimer > 0) game.flashTimer--;
        if (Math.random() < 0.002) game.flashTimer = 4;
      }

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
          e.x += e.velocityX;
          if (e.x < p.x || e.x + e.width > p.x + p.width) e.velocityX *= -1;
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
              // Player touched enemy from side or below - die
              game.lives--;
              game.player.invincible = true;
              game.player.invincibleTimer = 90;
              game.player.x = Math.max(100, game.player.x - 150);
              game.player.y = Math.max(50, game.player.y - 50);
              game.player.velocityY = 0;
              game.combo = 0;
              game.noHit = false;
              game.slowMo = 10;
              game.zoomPunch = 12;
              for (let i = 0; i < 18; i++) {
                game.particles.push({
                  x: game.player.x + game.player.width / 2, y: game.player.y + game.player.height / 2,
                  vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
                  life: 26, color: '#ff5470', size: Math.random() * 4 + 2
                });
              }
              AudioEngine.playDamage();
              AudioEngine.playLifeLost();
              if (game.lives <= 0) {
                game.running = false;
                trackDeathCause('enemy');
                persistRunSummary(game, false);
                onEndRef.current(game.score, game.totalCollectedInLevel);
              }
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
          game.screenShake = Math.max(game.screenShake, 5);
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
          
          // Attacklogik
          boss.attackTimer--;
          if (boss.attackTimer <= 0) {
            boss.attackTimer = boss.attackCooldown;
            const px = game.player.x + game.player.width / 2;
            const py = game.player.y + game.player.height / 2;
            const bx = boss.x + boss.width / 2;
            const by = boss.y + boss.height / 2;
            const dx = px - bx;
            const dy = py - by;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Skjut projektiler mot spelaren
            // Every boss has a readable signature: the eagle fans shots, the
            // cyber hound fires quickly, and heavier bosses launch slower orbs.
            const projCount = attackProfile.fan ? 3 : boss.phase + 1;
            const spread = projCount > 1 ? (boss.type === 'storm_eagle' ? 0.38 : 0.24) : 0;
            for (let pi = 0; pi < projCount; pi++) {
              const angle = Math.atan2(dy, dx) + (pi - (projCount - 1) / 2) * spread;
              const speed = attackProfile.speed + boss.phase * 0.8;
              boss.projectiles.push({
                x: bx, y: by,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: attackProfile.radius, life: 180,
                color: boss.phase === 2 ? '#ff00ff' : attackProfile.color
              });
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
              game.lives--;
              game.player.invincible = true;
              game.player.invincibleTimer = 90;
              game.combo = 0;
              game.noHit = false;
              game.screenShake = 12;
              game.slowMo = 10;
              AudioEngine.playDamage();
              AudioEngine.playLifeLost();
              if (game.lives <= 0) {
                game.running = false;
                trackDeathCause('boss');
                persistRunSummary(game, false);
                onEndRef.current(game.score, game.totalCollectedInLevel);
              }
            }
          }
        });
        
        // Kollision med spelaren (direktkontakt)
        if (!game.player.invincible) {
          const overlapX = game.player.x + game.player.width > boss.x && game.player.x < boss.x + boss.width;
          const overlapY = game.player.y + game.player.height > boss.y && game.player.y < boss.y + boss.height;
          if (overlapX && overlapY) {
            game.lives--;
            game.player.invincible = true;
            game.player.invincibleTimer = 110;
            game.player.x = Math.max(100, game.player.x - 190);
            game.player.y = Math.max(60, game.player.y - 45);
            game.player.velocityY = -5;
            game.combo = 0;
            game.noHit = false;
            game.screenShake = 14;
            game.slowMo = 12;
            boss.stunTimer = 15; // Boss stun vid träff
            if (progress.settings.haptics && navigator.vibrate) navigator.vibrate(35);
            AudioEngine.playDamage();
            AudioEngine.playLifeLost();
            if (game.lives <= 0) {
              game.running = false;
              trackDeathCause('boss');
              persistRunSummary(game, false);
              onEndRef.current(game.score, game.totalCollectedInLevel);
            }
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
            game.lives--;
            game.player.invincible = true;
            game.player.invincibleTimer = 90;
            game.player.x = Math.max(100, game.player.x - 170);
            game.player.y = Math.max(60, game.player.y - 45);
            game.player.velocityY = -3;
            game.combo = 0;
            game.noHit = false;
            game.slowMo = 10;
            game.zoomPunch = 12;
            for (let i = 0; i < 16; i++) {
              game.particles.push({
                x: game.player.x + game.player.width / 2, y: game.player.y + game.player.height / 2,
                vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
                life: 24, color: '#ff8c00', size: Math.random() * 4 + 2
              });
            }
            if (progress.settings.haptics && navigator.vibrate) navigator.vibrate(26);
            AudioEngine.playDamage();
            AudioEngine.playLifeLost();
            if (game.lives <= 0) {
              game.running = false;
              trackDeathCause('hazard');
              persistRunSummary(game, false);
              onEndRef.current(game.score, game.totalCollectedInLevel);
            }
            break;
          }
        }
      }

      if (game.player.invincibleTimer > 0) game.player.invincibleTimer--;
      else game.player.invincible = false;

      // Only die if falling into hole - with bigger buffer
      if (game.player.y > canvas.height + 100) {
        game.lives--;
        game.noHit = false;
        game.slowMo = 10;
        game.player.x = Math.max(100, game.player.x - 200);
        game.player.y = 100;
        game.player.velocityY = 0;
        AudioEngine.playLifeLost();
        if (game.lives <= 0) {
          game.running = false;
          trackDeathCause('hole');
          persistRunSummary(game, false);
          onEndRef.current(game.score, game.totalCollectedInLevel);
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

      // Update coin positions and check collection
      game.fishes.forEach((f: any) => {
        if (!f.collected) {
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
            awardCoins(game, 1);
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

      const applyScreenShake = game.screenShake > 0;
      if (applyScreenShake) {
        game.screenShake--;
        const shakeX = (Math.random() - 0.5) * 8;
        const shakeY = (Math.random() - 0.5) * 8;
        ctx.save();
        ctx.translate(shakeX, shakeY);
      }

      // Background - neon sky driven by time of day and season
      const now = Date.now();
      const timeSec = now / 1000;
      const isNight = game.timeOfDay === 'NIGHT';
      // Night keeps its moody seasonal mood; every daylight sky is a bright,
      // cheerful blue so sunny levels never read as a drab orange wash.
      const seasonPalette: Record<string, { night: [string, string, string]; day: [string, string, string] }> = {
        winter: { night: ['#0b1a3a', '#1b2f5c', '#3a6ea5'], day: ['#9ad4ee', '#bfe4f6', '#e2f3fc'] },
        spring: { night: ['#0d2b2a', '#134a3f', '#2b8a6f'], day: ['#5cc2f0', '#96dcf6', '#cdeefe'] },
        summer: { night: ['#0a1f3d', '#123a6b', '#2f7fb8'], day: ['#33b4ef', '#7dd0f4', '#bde7fb'] },
        autumn: { night: ['#2b1430', '#4a1f3d', '#8a3b4a'], day: ['#5cc0ec', '#8ed4f3', '#c2e9fa'] },
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
      const clouds = [
        { scale: 0.68, y: 180, alpha: isNight ? 0.66 : 0.94 },
        { scale: 0.48, y: 112, alpha: isNight ? 0.5 : 0.82 },
        { scale: 0.78, y: 154, alpha: isNight ? 0.7 : 0.95 },
        { scale: 0.56, y: 118, alpha: isNight ? 0.53 : 0.86 },
      ];
      clouds.forEach((cloud, i) => {
        const drift = timeSec * 8;
        const x = ((((i * canvas.width / 3 + drift) % cloudSpan) + cloudSpan) % cloudSpan) - 110;
        drawCloud(ctx, x, cloud.y, cloud.scale, cloud.alpha, i, isNight);
      });

      // Scenery has two layers. Buildings are the fixed skyline and stay in
      // screen space; animals - on the ground and in the sky - are anchored in
      // the level and scroll against game.scrollX like the platforms, so the
      // cat's movement can never drag one along with it.
      ctx.save();
      // Two depth layers. The skyline rests in the distance while the animals
      // stand in front of it - they are nearer the cat, so they are painted
      // last and drawn solid instead of as faint as the far-off buildings.
      const sceneryLayers: Array<[number, any[]]> = [
        [0.5, game.backgroundElements.filter((el: any) => el.kind === 'building')],
        [0.92, game.backgroundElements.filter((el: any) => el.kind !== 'building')],
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
      earthGrad.addColorStop(0, '#101d2e');
      earthGrad.addColorStop(1, '#05080f');
      ctx.fillStyle = earthGrad;
      ctx.fillRect(0, game.groundY, canvas.width, canvas.height - game.groundY);

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
              gGrad.addColorStop(0, '#4a8a3a');   // Ljust gräs
              gGrad.addColorStop(0.18, '#2a5a22'); // Gräs
              gGrad.addColorStop(0.35, '#3a2a15'); // Jord
              gGrad.addColorStop(1, '#1a100a');   // Djup jord
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
          ctx.fill();

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

          // Skugga under luftplattform
          if (!plat.isGround) {
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(platX + 4, platY + plat.height, plat.width - 8, 6);
          }
        }
      });

      // Draw holes (black gaps)
      game.holes.forEach(hole => {
        const hx = hole.x - game.scrollX;
        if (hx + hole.width <= 0 || hx >= canvas.width) return;
        const holeDepth = canvas.height - hole.y;
        ctx.fillStyle = '#000308';
        ctx.fillRect(hx, hole.y, hole.width, holeDepth);
        // Soft inner shading so the gap reads as depth rather than a flat hole.
        const holeGrad = ctx.createLinearGradient(0, hole.y, 0, hole.y + holeDepth);
        holeGrad.addColorStop(0, 'rgba(0,0,0,0)');
        holeGrad.addColorStop(0.35, 'rgba(20,30,45,0.55)');
        holeGrad.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = holeGrad;
        ctx.fillRect(hx, hole.y, hole.width, holeDepth);
        // Warning glow on the lips of the gap.
        ctx.save();
        ctx.shadowColor = 'rgba(255, 90, 90, 0.9)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = 'rgba(255,120,120,0.55)';
        ctx.fillRect(hx, hole.y, 2, 10);
        ctx.fillRect(hx + hole.width - 2, hole.y, 2, 10);
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

      // Bullets - Bright Red color
      ctx.globalCompositeOperation = 'source-over';
      game.bullets.forEach((b: any) => {
        const bx = b.x - game.scrollX;

        // Outer red glow
        ctx.fillStyle = '#FF0000';
        ctx.beginPath(); ctx.arc(bx, b.y, b.radius * 2, 0, Math.PI * 2); ctx.fill();

        // Inner bright red
        ctx.fillStyle = '#FF4444';
        ctx.beginPath(); ctx.arc(bx, b.y, b.radius * 1.3, 0, Math.PI * 2); ctx.fill();

        // White center
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(bx, b.y, b.radius * 0.5, 0, Math.PI * 2); ctx.fill();
      });

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

        } else { // Spike ball - Floating mechanical saw drone with pulsating core
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
        }
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

        // Fish body: brushed silver with a lit top edge and a cool belly.
        const bodyGrad = ctx.createLinearGradient(fx, fy, fx, fy + fh);
        bodyGrad.addColorStop(0, '#ffffff');
        bodyGrad.addColorStop(0.35, '#dee7f1');
        bodyGrad.addColorStop(0.72, '#a7b7c9');
        bodyGrad.addColorStop(1, '#e9f0f8');
        ctx.fillStyle = bodyGrad;

        // Fish body - ellipse shape
        ctx.beginPath();
        ctx.ellipse(fx + fw / 2, fy + fh / 2, fw / 2, fh / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Fish tail
        ctx.fillStyle = '#b0bfd1';
        ctx.beginPath();
        ctx.moveTo(fx, fy + fh / 2);
        ctx.lineTo(fx - fh / 2, fy);
        ctx.lineTo(fx - fh / 2, fy + fh);
        ctx.closePath();
        ctx.fill();

        // Fish eye
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(fx + fw * 0.7, fy + fh * 0.4, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(fx + fw * 0.7, fy + fh * 0.4, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Fish fin on top
        ctx.fillStyle = '#cdd9e7';
        ctx.beginPath();
        ctx.moveTo(fx + fw / 2, fy);
        ctx.lineTo(fx + fw / 2 + 5, fy - 5);
        ctx.lineTo(fx + fw / 2 - 5, fy);
        ctx.closePath();
        ctx.fill();
      });

      // Draw coins - count collected
      let collectedCountInFrame = 0;
      game.fishes.forEach((f: any) => {
        if (f.collected) collectedCountInFrame++;
      });

      // Goal Logic - check if player can complete level
      const allFishesCollected = collectedCountInFrame === game.fishes.length;
      const bossCleared = !game.boss || game.boss.hp <= 0;
      const overlapsGoal = game.player.x < game.jerry.x + game.jerry.width && game.player.x + game.player.width > game.jerry.x && game.player.y < game.jerry.y + game.jerry.height && game.player.y + game.player.height > game.jerry.y;
      if (overlapsGoal) {
        if (allFishesCollected && bossCleared) {
          game.running = false;
          const perfectLevel = game.lives === lives;
          const perfectBonus = perfectLevel ? 500 : 0;
          const noHitBonus = game.noHit ? 750 : 0;
          const nearMissBonus = (game.nearMisses || 0) * 25;
          game.levelsCompletedInRun = (game.levelsCompletedInRun || 0) + 1;
          game.score += 1000 + perfectBonus + noHitBonus + nearMissBonus;
          if (noHitBonus > 0) pushToast(game, 'OHIT! +750', '#2bee79');
          if (nearMissBonus > 0) pushToast(game, `${game.nearMisses} NÄSTAN! +${nearMissBonus}`, '#7ef7c2');
          awardCoins(game, 15 + (perfectLevel ? 10 : 0) + (game.noHit ? 10 : 0));
          grantXp(game, 150);
          persistRunSummary(game, perfectLevel);
          setTotalScore(game.score);
          AudioEngine.playLevelUp();
          setLevelSummary({
            score: game.score,
            perfect: perfectLevel,
            noHit: !!game.noHit,
            nearMisses: game.nearMisses || 0,
            streak: game.bestStreak || 0,
            runLevel: game.runLevel || 1,
            coins: game.coinsThisLevel || 0,
          });
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
        ctx.fillText(needBoss ? 'BESEGRA BOSS + SAMLA FISK!' : 'SAMLA ALLA FISKAR FÖRST!', jx + jw / 2, jy - 15);
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

      ctx.save();
      if (game.player.invincible) ctx.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 50);

      // Kattens svans - Ritas bakom kroppen för att se ut som en riktig svans
      const isMovingRight = game.player.facing === 1;
      const tailX = isMovingRight ? px + 5 : px + pw - 5;
      const tailDir = isMovingRight ? -1 : 1;
      const tailWiggle = Math.sin(Date.now() / 150) * 5;

      ctx.strokeStyle = game.player.color; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tailX, py + ph * 0.7);
      ctx.bezierCurveTo(
        tailX + tailDir * 25, py + ph * 0.8 + tailWiggle,
        tailX + tailDir * 35, py + ph * 0.4 - tailWiggle,
        tailX + tailDir * 15, py + ph * 0.2
      );
      ctx.stroke();

      // Kropp (Ellipse) with neon rim light
      ctx.save();
      ctx.shadowColor = game.player.color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = game.player.color; ctx.beginPath(); ctx.ellipse(px + pw / 2, py + ph / 2, pw / 2, ph / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Öron (Trianglar med rosa inneröra)
      ctx.fillStyle = game.player.color;
      ctx.beginPath(); ctx.moveTo(px + 4, py + 16); ctx.lineTo(px - 6, py - 12); ctx.lineTo(px + 22, py + 4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + pw - 4, py + 16); ctx.lineTo(px + pw + 6, py - 12); ctx.lineTo(px + pw - 22, py + 4); ctx.closePath(); ctx.fill();
      // Inneröra (söt rosa)
      ctx.fillStyle = '#ff9ebb';
      ctx.beginPath(); ctx.moveTo(px + 6, py + 14); ctx.lineTo(px - 2, py - 6); ctx.lineTo(px + 18, py + 6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + pw - 6, py + 14); ctx.lineTo(px + pw + 2, py - 6); ctx.lineTo(px + pw - 18, py + 6); ctx.closePath(); ctx.fill();

      // Ögon med blink-logik & pupillriktning i rörelseriktningen
      const lookOffset = (game.player.facing || 1) * 2.5;
      if (game.player.isBlinking) {
        ctx.strokeStyle = game.player.accent; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px + pw * 0.22, py + ph * 0.4); ctx.lineTo(px + pw * 0.42, py + ph * 0.4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + pw * 0.58, py + ph * 0.4); ctx.lineTo(px + pw * 0.78, py + ph * 0.4); ctx.stroke();
      } else {
        // Vit ögonvita
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(px + pw * 0.34, py + ph * 0.4, 8.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + pw * 0.66, py + ph * 0.4, 8.5, 0, Math.PI * 2); ctx.fill();
        // Iris (kattens accentfärg)
        ctx.fillStyle = game.player.accent || '#2bee79';
        ctx.beginPath(); ctx.arc(px + pw * 0.34 + lookOffset, py + ph * 0.4, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + pw * 0.66 + lookOffset, py + ph * 0.4, 5, 0, Math.PI * 2); ctx.fill();
        // Pupill (svart kattöga)
        ctx.fillStyle = '#060a12';
        ctx.beginPath(); ctx.ellipse(px + pw * 0.34 + lookOffset, py + ph * 0.4, 2.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(px + pw * 0.66 + lookOffset, py + ph * 0.4, 2.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
        // Ljusblänk i ögonen
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(px + pw * 0.34 + lookOffset - 1.5, py + ph * 0.38 - 1.5, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + pw * 0.66 + lookOffset - 1.5, py + ph * 0.38 - 1.5, 1.8, 0, Math.PI * 2); ctx.fill();
      }

      // Nos
      ctx.fillStyle = '#ff88aa'; ctx.beginPath(); ctx.arc(px + pw * 0.5, py + ph * 0.55, 6, 0, Math.PI * 2); ctx.fill();

      // Morrhår
      ctx.fillStyle = 'black';
      // Whiskers sprout from the whisker pads at the edges of the nose, then fan
      // out level-to-downwards across the cheeks. The roots sit at the nose
      // (pw * 0.39 / 0.61) rather than out on the cheeks, and stay below the eyes
      // so they never cross the face. Each one is a fine taper - thin at the root,
      // barely wider at the tip - so it reads as a whisker, not a bar.
      const noseY = py + ph * 0.55;
      const whisker = (rootX: number, tipX: number, rootY: number, tipY: number) => [
        { x: rootX, y: rootY - 0.45 },
        { x: rootX, y: rootY + 0.45 },
        { x: tipX, y: tipY + 0.95 },
        { x: tipX, y: tipY - 0.95 },
      ];
      const wl1 = whisker(px + pw * 0.39, px - 6, noseY + ph * 0.05, noseY + ph * 0.03);
      const wl2 = whisker(px + pw * 0.38, px - 7, noseY + ph * 0.12, noseY + ph * 0.13);
      const wl3 = whisker(px + pw * 0.39, px - 6, noseY + ph * 0.19, noseY + ph * 0.24);
      const wr1 = whisker(px + pw * 0.61, px + pw + 6, noseY + ph * 0.05, noseY + ph * 0.03);
      const wr2 = whisker(px + pw * 0.62, px + pw + 7, noseY + ph * 0.12, noseY + ph * 0.13);
      const wr3 = whisker(px + pw * 0.61, px + pw + 6, noseY + ph * 0.19, noseY + ph * 0.24);
      const drawPolygon = (pts: any[]) => {
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath(); ctx.fill();
      };
      drawPolygon(wl1); drawPolygon(wl2); drawPolygon(wl3); drawPolygon(wr1); drawPolygon(wr2); drawPolygon(wr3);

      // Mun
      ctx.strokeStyle = 'black'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + pw * 0.5, py + ph * 0.55 + 6); ctx.lineTo(px + pw * 0.5, py + ph * 0.65); ctx.stroke(); ctx.beginPath(); ctx.arc(px + pw * 0.4, py + ph * 0.65, 5, 0, Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(px + pw * 0.6, py + ph * 0.65, 5, 0, Math.PI); ctx.stroke();

      // Tassar - Animerade spring-tassar med söta rosa trampdynor!
      const isMoving = Math.abs(game.player.velocityX) > 0.4 && game.player.onGround;
      const pawTrot1 = isMoving ? Math.sin(Date.now() / 70) * 4 : 0;
      const pawTrot2 = isMoving ? -Math.sin(Date.now() / 70) * 4 : 0;

      // Vänster tass
      ctx.fillStyle = game.player.color;
      ctx.beginPath();
      ctx.ellipse(px + 14, py + ph - 2 + pawTrot1, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Höger tass
      ctx.beginPath();
      ctx.ellipse(px + pw - 14, py + ph - 2 + pawTrot2, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rosa trampdynor (paw pads)
      ctx.fillStyle = '#ff9ebb';
      ctx.beginPath();
      ctx.arc(px + 14, py + ph - 1 + pawTrot1, 3.5, 0, Math.PI * 2);
      ctx.arc(px + pw - 14, py + ph - 1 + pawTrot2, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

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
        ctx.translate(canvas.width / 2, 96 + i * 40);
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

      // Vignette so the eye lands on the cat
      const vignette = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.35,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.85
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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

      if (game.miniEvent.active && game.miniEvent.type === 'BLACKOUT') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (applyScreenShake) ctx.restore();

      // Throttle React state updates to prevent infinite loops and improve performance
      if (Date.now() - game.lastStatUpdate > 250) {
        setStats({
          score: game.score, progress: Math.min(100, Math.floor((game.player.x / game.levelLength) * 100)),
          collectedCount: collectedCountInFrame, totalFish: game.fishes.length, ammo: game.ammo,
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
          noHit: !!game.noHit,
          nearMisses: game.nearMisses || 0,
          toasts: game.toasts || [],
          bossHp: game.boss?.hp || 0,
          bossMaxHp: game.boss?.maxHp || 0,
          bossVisible: !!game.boss && game.boss.hp > 0 && Math.abs(game.boss.x - game.player.x) < canvas.width * 0.8,
          bossName: game.boss?.name || '',
          bossPhase: game.boss?.phase || 0,
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
  }, [currentLevel, isTouchDevice]);

  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-3 overflow-hidden px-2 py-2 animate-fade-in-up md:gap-5 md:py-4 ${isFullscreen ? 'fixed inset-0 z-[100] bg-background-dark' : 'min-h-[calc(100dvh-4rem)]'}`}
      style={{ fontSize: `${progress.settings.textScale}em`, transform: `scale(${progress.settings.uiScale})`, transformOrigin: 'top center' }}
    >
      {/* GAME AREA */}
      <div
        ref={gameContainerRef}
        className="relative mx-auto aspect-video w-auto max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black transition-all duration-500 md:rounded-[2rem]"
        style={{
          // Fill the available viewport height without ever exceeding the
          // screen width, so the stage never leaves a dead gap underneath.
          height: 'min(78vh, calc((100vw - 2rem) * 9 / 16))',
          boxShadow: '0 0 0 1px rgba(43,238,121,0.15), 0 30px 90px -30px rgba(0,0,0,0.9), 0 0 80px -30px rgba(43,238,121,0.5)',
        }}
      >

        {/* HUD - modern overlay with reward feedback */}
        <div className="absolute top-0 left-0 right-0 z-20 px-2 md:px-4 py-2 md:py-3 pointer-events-none">
          <div className="flex items-start justify-between gap-2">
            {/* Left cluster: lives, ammo, dash */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 rounded-xl bg-black/55 backdrop-blur-md border border-white/10 px-2.5 py-1.5">
                {Array.from({ length: Math.max(lives, 0) }).map((_, i) => (
                  <span key={i} className="material-symbols-outlined text-primary-red text-base" style={{ filter: 'drop-shadow(0 0 6px rgba(238,43,43,0.7))' }}>favorite</span>
                ))}
                {lives <= 0 && <span className="text-xs font-black text-primary-red">INGA LIV</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`flex items-center gap-1 rounded-xl bg-black/55 backdrop-blur-md border px-2.5 py-1.5 transition-colors ${stats.ammo <= 0 ? 'border-primary-red/60 animate-pulse' : 'border-white/10'}`}>
                  <span className="material-symbols-outlined text-[#ff8888] text-base">bolt</span>
                  <span className={`text-sm font-black ${stats.ammo <= 0 ? 'text-primary-red' : 'text-white'}`}>{stats.ammo}</span>
                </div>
                <div className={`flex items-center gap-1 rounded-xl bg-black/55 backdrop-blur-md border px-2.5 py-1.5 transition-all ${stats.dashReady ? 'border-primary/50' : 'border-white/10 opacity-50'}`}>
                  <span className="material-symbols-outlined text-primary text-base">bolt</span>
                  <span className="text-sm font-black text-primary">DASH</span>
                </div>
              </div>
            </div>

            {/* Center: level progress + XP bar */}
            <div className="flex-1 max-w-md flex flex-col items-center gap-1.5">
              <div className="w-full rounded-xl bg-black/55 backdrop-blur-md border border-white/10 px-3 py-1.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider mb-1">
                  <span className="text-primary">NIVÅ {currentLevel}</span>
                  <span className="text-white/70">{stats.progress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-[width] duration-300"
                    style={{ width: `${stats.progress}%`, boxShadow: '0 0 10px rgba(43,238,121,0.7)' }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
                  <span className="text-white/50">Runnivå {stats.runLevel}</span>
                  <span className="text-white/50">{stats.xp}/{stats.xpNeeded} XP</span>
                </div>
                <div className="mt-0.5 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400/70 to-cyan-300 transition-[width] duration-300"
                    style={{ width: `${Math.min(100, (stats.xp / Math.max(1, stats.xpNeeded)) * 100)}%` }}
                  />
                </div>
              </div>
              {currentLevel % 5 === 0 && (
                <div className="flex items-center gap-1.5 rounded-full border border-orange-400/35 bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-orange-200 shadow-[0_0_18px_rgba(255,140,60,0.18)]">
                  <span aria-hidden="true">⚔</span>
                  <span>Bossarena · boss {Math.floor(currentLevel / 5)}</span>
                </div>
              )}
              {stats.multiplier > 1 && (
                <div
                  className="rounded-full bg-black/55 backdrop-blur-md border border-yellow-400/40 px-3 py-1 text-xs font-black text-yellow-300 animate-pulse"
                  style={{ boxShadow: '0 0 18px rgba(255,209,102,0.35)' }}
                >
                  MULTIPLIKATOR x{stats.multiplier} · STREAK {stats.streak}
                </div>
              )}
            </div>

            {/* Right cluster: fish, coins, weather, controls */}
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <div className={`flex items-center gap-1 rounded-xl bg-black/55 backdrop-blur-md border px-2.5 py-1.5 ${stats.collectedCount === stats.totalFish ? 'border-primary/60' : 'border-white/10'}`}>
                  <span className="material-symbols-outlined text-primary text-base">set_meal</span>
                  <span className={`text-sm font-black ${stats.collectedCount === stats.totalFish ? 'text-primary' : 'text-white'}`}>
                    {stats.collectedCount}/{stats.totalFish}
                  </span>
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-black/55 backdrop-blur-md border border-yellow-500/20 px-2.5 py-1.5">
                  <span className="material-symbols-outlined text-yellow-500 text-base">monetization_on</span>
                  <span className="text-sm font-black text-yellow-400">{progress.coins}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <div className="flex items-center gap-1 rounded-xl bg-black/55 backdrop-blur-md border border-white/10 px-2.5 py-1.5">
                  <span className={`material-symbols-outlined text-base ${stats.weather === 'SOLIGT' ? (stats.timeOfDay === 'DAY' ? 'text-orange-400' : 'text-yellow-400') : (stats.weather === 'REGNIGT' ? 'text-blue-400' : (stats.weather === 'SNÖIGT' ? 'text-white' : (stats.weather === 'DIMMIGT' ? 'text-gray-400' : 'text-purple-400')))}`}>
                    {stats.weather === 'SOLIGT' ? (stats.timeOfDay === 'DAY' ? 'sunny' : 'nightlight') : (stats.weather === 'REGNIGT' ? 'rainy' : (stats.weather === 'SNÖIGT' ? 'ac_unit' : (stats.weather === 'DIMMIGT' ? 'foggy' : 'thunderstorm')))}
                  </span>
                  {stats.noHit && <span className="material-symbols-outlined text-primary text-base" title="Inga skador">verified</span>}
                  {stats.nearMisses > 0 && <span className="text-[10px] font-black text-white/70">{stats.nearMisses}</span>}
                </div>
                {stats.levelType === 'Speed Run' && (
                  <div className="flex items-center gap-1 rounded-xl bg-black/55 backdrop-blur-md border border-orange-400/30 px-2.5 py-1.5">
                    <span className="material-symbols-outlined text-orange-300 text-base">timer</span>
                    <span className="text-sm font-black text-orange-300">{Math.ceil(stats.timer)}s</span>
                  </div>
                )}
                <button
                  onClick={toggleMuted}
                  aria-pressed={isMuted}
                  aria-label={isMuted ? 'Slå på ljudet' : 'Stäng av ljudet'}
                  title={isMuted ? 'Slå på ljudet' : 'Stäng av ljudet'}
                  className={`flex items-center rounded-xl bg-black/55 backdrop-blur-md border px-2 py-1.5 hover:scale-110 transition-transform ${
                    isMuted ? 'border-primary-red/40' : 'border-white/10'
                  }`}
                >
                  <span className={`material-symbols-outlined text-base ${isMuted ? 'text-primary-red' : 'text-white/70'}`}>
                    {isMuted ? 'volume_off' : 'volume_up'}
                  </span>
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center rounded-xl bg-black/55 backdrop-blur-md border border-white/10 px-2 py-1.5 hover:scale-110 transition-transform"
                >
                  <span className="material-symbols-outlined text-base text-white/70">
                    {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {progress.settings.debugOverlay && (
          <div className="absolute top-8 left-0 right-0 z-20 text-[10px] text-white/70 bg-black/40 px-3 py-1 pointer-events-none">
            MODE {stats.levelType} | EVENT {stats.miniEvent} | COMBO x{combo} | WEATHER {stats.weather} | THEME {seasonTheme}
          </div>
        )}

        {/* Boss HP Bar - Large prominent bar shown during boss fights */}
        {stats.bossVisible && stats.bossHp > 0 && stats.bossMaxHp > 0 && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-full max-w-xs px-3">
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

        {/* Mobile Touch Controls Overlay */}
        {isTouchDevice && (
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center pointer-events-auto">
              <div className="bg-black/50 backdrop-blur-sm rounded-2xl px-4 py-2 border border-white/20">
                <p className="text-white/80 text-xs font-medium">Vänster: Jump</p>
                <p className="text-white/80 text-xs font-medium">Höger: Shoota</p>
                <p className="text-white/80 text-xs font-medium">Svep: Rörelse</p>
              </div>
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="w-full h-full max-w-full max-h-full object-contain cursor-crosshair bg-[#102217]"
          style={{ filter: progress.settings.colorBlindMode ? 'contrast(1.15) saturate(0.85)' : 'none' }}
        />

        {showLevelComplete && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 md:p-6 animate-fade-in-up z-50 overflow-y-auto">
            <span className="material-symbols-outlined text-4xl md:text-7xl text-primary mb-1 md:mb-3" style={{ filter: 'drop-shadow(0 0 20px rgba(43,238,121,0.6))' }}>stars</span>
            {/* Inter, not Outfit: Outfit draws the ring of "Å" so small it reads as "Ä".
                tracking-normal + leading-tight need the space between the words. */}
            <h2 className="display-title mb-3 text-center font-sans text-2xl leading-tight tracking-normal md:mb-5 md:text-4xl">Nivå {currentLevel} klar!</h2>

            {levelSummary && (
              <div className="w-full max-w-md grid grid-cols-2 gap-2 mb-4 md:mb-6">
                <div className="col-span-2 rounded-2xl bg-white/5 border border-white/10 p-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Poäng</p>
                  <p className="text-3xl md:text-4xl font-black text-primary tabular-nums">{levelSummary.score.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/50">Mynt</p>
                  <p className="text-lg font-black text-yellow-400 tabular-nums">+{levelSummary.coins}</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/50">Runnivå</p>
                  <p className="text-lg font-black text-cyan-300 tabular-nums">{levelSummary.runLevel}</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/50">Bästa streak</p>
                  <p className="text-lg font-black text-primary tabular-nums">{levelSummary.streak}</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/50">Nästan-träffar</p>
                  <p className="text-lg font-black text-[#7ef7c2] tabular-nums">{levelSummary.nearMisses}</p>
                </div>
                <div className={`col-span-2 flex items-center justify-center gap-2 rounded-xl p-2.5 border ${levelSummary.noHit ? 'bg-primary/10 border-primary/40' : 'bg-white/5 border-white/10'}`}>
                  <span className={`material-symbols-outlined text-base ${levelSummary.noHit ? 'text-primary' : 'text-white/40'}`}>verified</span>
                  <span className={`text-xs font-black uppercase tracking-wider ${levelSummary.noHit ? 'text-primary' : 'text-white/50'}`}>
                    {levelSummary.noHit ? 'Utan skada +750' : levelSummary.perfect ? 'Perfekt nivå +500' : 'Nivå avslutad'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 md:gap-3 w-full max-w-xs md:max-w-md">
              <button onClick={startNextLevel} className="bg-primary text-[#112218] px-8 md:px-12 py-3.5 md:py-4 rounded-full font-black text-base md:text-xl hover:scale-105 active:scale-[0.98] transition-transform shadow-[0_0_30px_rgba(43,238,121,0.35)] border-2 border-primary/80 w-full">
                {currentLevel % 5 === 4
                  ? `BOSSKAMP · NIVÅ ${currentLevel + 1}`
                  : `NÄSTA NIVÅ (${currentLevel + 1})`}
              </button>
              <button onClick={() => onEnd(totalScore, gameRef.current?.totalCollectedInLevel ?? 0)} className="bg-white/10 text-white px-6 md:px-8 py-3 md:py-4 rounded-full font-bold hover:bg-white/20 transition-all text-sm md:text-base w-full border border-white/20">Avsluta</button>
            </div>
          </div>
        )}
      </div>

      {/* TOUCH CONTROLS - UNDER spelrutan */}
      {isTouchDevice && !showLevelComplete && (
        <div className="flex w-full max-w-4xl justify-between items-center px-4 py-2 mt-auto select-none pointer-events-auto">
          {/* Vänster sida: Styrning (Move vänster/höger) */}
          <div className="flex items-center gap-3">
            <button
              className="size-14 md:size-16 bg-[#16291e]/90 backdrop-blur-md rounded-2xl flex items-center justify-center border-b-4 border-black/60 shadow-xl active:translate-y-1 active:border-b-0 active:bg-primary/40 transition-all group"
              onTouchStart={(e) => { e.preventDefault(); setKeyState(65, true); }}
              onTouchEnd={(e) => { e.preventDefault(); setKeyState(65, false); }}
            >
              <span className="material-symbols-outlined text-3xl text-white group-active:text-primary">arrow_back</span>
            </button>
            <button
              className="size-14 md:size-16 bg-[#16291e]/90 backdrop-blur-md rounded-2xl flex items-center justify-center border-b-4 border-black/60 shadow-xl active:translate-y-1 active:border-b-0 active:bg-primary/40 transition-all group"
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
              className="size-16 md:size-20 bg-primary/20 backdrop-blur-md rounded-full flex flex-col items-center justify-center border-4 border-primary/40 border-b-8 border-b-black/40 text-white shadow-2xl active:translate-y-2 active:border-b-0 active:bg-primary/60 transition-all group"
              onTouchStart={(e) => { e.preventDefault(); requestJump(); }}
              onTouchEnd={(e) => { e.preventDefault(); releaseJump(); }}
            >
              <span className="material-symbols-outlined text-3xl group-active:scale-110 transition-transform">arrow_upward</span>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-90">HOPPA</span>
            </button>

            {/* Dash-knapp */}
            <button
              className="size-14 md:size-16 bg-cyan-400/20 backdrop-blur-md rounded-full flex flex-col items-center justify-center border-4 border-cyan-300/40 border-b-8 border-b-black/40 text-white shadow-2xl active:translate-y-2 active:border-b-0 active:bg-cyan-300/60 transition-all group"
              onTouchStart={(e) => { e.preventDefault(); triggerDash(); }}
            >
              <span className="material-symbols-outlined text-2xl group-active:scale-110 transition-transform">bolt</span>
              <span className="text-[9px] font-black uppercase tracking-widest opacity-90">DASH</span>
            </button>

            {/* Shoot-knapp */}
            <button
              className="size-16 md:size-20 bg-primary-red/30 backdrop-blur-md rounded-full flex flex-col items-center justify-center border-4 border-primary-red/50 border-b-8 border-b-black/40 text-white shadow-2xl active:translate-y-2 active:border-b-0 active:bg-primary-red/60 transition-all group"
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
    } else {
      setMessage('Inte tillräckligt med mynt!');
    }
    setTimeout(() => setMessage(''), 2000);
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in-up py-8 md:py-12 px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-3">
          <span className="material-symbols-outlined text-primary text-sm">store</span>            <span className="text-primary text-[10px] font-bold uppercase tracking-widest">Butik</span>
        </div>
        <h1 className="display-title text-3xl md:text-4xl">Uppgraderingar</h1>
        <p className="mt-2 text-white/70 text-sm">Förbättra din katt med neon-teknologi</p>
      </div>

      {/* Coins Display */}
      <div className="glass-card rounded-2xl p-4 mb-6 border border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-yellow-500">monetization_on</span>
            </div>
            <div>
              <p className="text-white/60 text-xs uppercase tracking-widest">Dina mynt</p>
              <p className="text-white text-xl font-black">{progress.coins}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-xs uppercase tracking-widest">Nivå</p>
            <p className="text-white text-xl font-black">{progress.level}</p>
          </div>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-xl bg-primary/20 border border-primary/30 text-center text-white font-medium">
          {message}
        </div>
      )}

      {/* Skill Tree Light */}
      <div className="glass-card rounded-2xl p-5 mb-6 border border-primary/20 bg-primary/5">
        <h3 className="text-white font-bold uppercase mb-2">Förmåner</h3>
        <p className="text-white/60 text-xs mb-3">Passiva förmåner låses upp automatiskt med din nivå.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className={`rounded-lg p-3 border ${progress.level >= 5 ? 'border-primary/40 bg-primary/10 text-white' : 'border-white/10 text-white/50'}`}>Nivå 5: Smidiga tassar (+fart)</div>
          <div className={`rounded-lg p-3 border ${progress.level >= 10 ? 'border-primary/40 bg-primary/10 text-white' : 'border-white/10 text-white/50'}`}>Nivå 10: Ammoeffektiv</div>
          <div className={`rounded-lg p-3 border ${progress.level >= 15 ? 'border-primary/40 bg-primary/10 text-white' : 'border-white/10 text-white/50'}`}>Nivå 15: Vaksintinkt</div>
        </div>
      </div>

      {/* Upgrades */}
      <div className="space-y-4">
        {/* Max Ammo */}<div className="card-premium card-premium-hover p-5">
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10">
              <span className="material-symbols-outlined text-blue-400">battery_full</span>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold uppercase">Max ammunition</h3>
              <p className="text-white/50 text-xs">Fler skott innan omladdning</p>
              <p className="tabular mt-1 text-sm font-bold text-white/85">Nuvarande: {progress.upgrades.maxAmmo.toFixed(0)}</p>
              <button
                onClick={() => handleBuy('maxAmmo', 500)}
                disabled={progress.coins < 500}
                className="mt-2.5 rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-300 transition-all duration-200 hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Köp (500 mynt)
              </button>
            </div>
          </div>
        </div>

        {/* Jump Power */}<div className="card-premium card-premium-hover p-5">
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10">
              <span className="material-symbols-outlined text-green-400">rocket</span>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold uppercase">Hoppkraft</h3>
              <p className="text-white/50 text-xs">Högre hopp</p>
              <p className="tabular mt-1 text-sm font-bold text-white/85">Nuvarande: {progress.upgrades.jumpPower.toFixed(1)}</p>
              <button
                onClick={() => handleBuy('jumpPower', 750)}
                disabled={progress.coins < 750}
                className="mt-2.5 rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-300 transition-all duration-200 hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Köp (750 mynt)
              </button>
            </div>
          </div>
        </div>

        {/* Speed */}<div className="card-premium card-premium-hover p-5">
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10">
              <span className="material-symbols-outlined text-purple-400">speed</span>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold uppercase">Fart</h3>
              <p className="text-white/50 text-xs">Snabbare rörelse</p>
              <p className="tabular mt-1 text-sm font-bold text-white/85">Nuvarande: {progress.upgrades.speed.toFixed(1)}</p>
              <button
                onClick={() => handleBuy('speed', 1000)}
                disabled={progress.coins < 1000}
                className="mt-2.5 rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-300 transition-all duration-200 hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Köp (1000 mynt)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Skins */}
      <div className="glass-card rounded-2xl p-5 mt-6 border border-white/10">
        <h3 className="text-white font-bold uppercase mb-3">Skinn</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(SKINS).map(([id, skin]) => {
            const unlocked = progress.unlockedSkins.includes(id);
            const equipped = progress.equippedSkin === id;
            return (
              <div key={id} className={`rounded-xl p-3 border ${equipped ? 'border-primary/50 bg-primary/10' : 'border-white/10 bg-black/20'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-white font-bold text-sm">{skin.name}</p>
                    <p className="text-white/50 text-xs">{unlocked ? 'Upplåst' : skin.unlockHint}</p>
                  </div>
                  <div className="w-7 h-7 rounded-full border border-white/20" style={{ backgroundColor: skin.color }} />
                </div>
                <button
                  onClick={() => unlocked && equipSkin(id)}
                  disabled={!unlocked || equipped}
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 text-white disabled:opacity-40"
                >
                  {equipped ? 'Aktiv' : 'Utrusta'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={onBack}
        className="w-full mt-6 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors"
      >
        <span className="material-symbols-outlined">arrow_back</span>
        Tillbaka
      </button>
    </div>
  );
};

/** QUESTS VIEW **/
export const QuestsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { progress, claimQuestReward } = useProgress();

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in-up py-8 md:py-12 px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-3">
          <span className="material-symbols-outlined text-primary text-sm">task_alt</span>            <span className="text-primary text-[10px] font-bold uppercase tracking-widest">Uppdrag</span>
        </div>
        <h1 className="display-title text-3xl md:text-4xl">Dagliga + Veckans</h1>
        <p className="mt-2 text-white/70 text-sm">Gratis utmaningar som roterar automatiskt</p>
      </div>

      {/* XP Progress */}
      <div className="glass-card rounded-2xl p-4 mb-6 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">military_tech</span>
            <span className="text-white font-bold">Nivå {progress.level}</span>
          </div>            <span className="text-white/60 text-sm">{progress.xp} XP</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${(progress.xp % 1000) / 10}%` }}
          />
        </div>
        <p className="text-white/40 text-xs mt-2">{1000 - (progress.xp % 1000)} XP till nästa nivå</p>
      </div>

      {/* Daily Quests */}
      <h3 className="text-white/80 font-bold uppercase tracking-wider text-xs mb-3">Dagliga</h3>
      <div className="space-y-4">
        {progress.dailyQuests.map((quest) => (
          <div
            key={quest.id}
            className={`glass-card rounded-2xl p-5 border ${quest.completed ? 'border-primary/30 bg-primary/5' : 'border-white/10'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${quest.completed ? 'bg-primary/20' : 'bg-white/5'}`}>
                <span className={`material-symbols-outlined ${quest.completed ? 'text-primary' : 'text-white/40'}`}>
                  {quest.completed ? 'check_circle' : 'radio_button_unchecked'}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold">{quest.description}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, (quest.current / quest.target) * 100)}%` }}
                    />
                  </div>
                  <span className="text-white/60 text-xs">{quest.current}/{quest.target}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-yellow-500 font-black">+{quest.reward} 🪙</p>
                {quest.completed && !quest.claimed && (
                  <button
                    onClick={() => claimQuestReward(quest.id)}
                    className="mt-1 px-3 py-1 rounded-lg bg-primary text-[#112218] text-xs font-bold"
                  >
                    Hämta
                  </button>
                )}
                {quest.claimed && (
                  <span className="mt-1 px-3 py-1 rounded-lg bg-white/10 text-white/40 text-xs font-bold">Hämtad</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Weekly Quests */}
      <h3 className="text-white/80 font-bold uppercase tracking-wider text-xs mt-6 mb-3">Veckans</h3>
      <div className="space-y-4">
        {progress.weeklyQuests.map((quest) => (
          <div
            key={quest.id}
            className={`glass-card rounded-2xl p-5 border ${quest.completed ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-white/10'}`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${quest.completed ? 'bg-yellow-500/20' : 'bg-white/5'}`}>
                <span className={`material-symbols-outlined ${quest.completed ? 'text-yellow-400' : 'text-white/40'}`}>
                  {quest.completed ? 'workspace_premium' : 'pending'}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold">{quest.description}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${Math.min(100, (quest.current / quest.target) * 100)}%` }} />
                  </div>
                  <span className="text-white/60 text-xs">{quest.current}/{quest.target}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-yellow-500 font-black">+{quest.reward} 🪙</p>
                {quest.completed && !quest.claimed && (
                  <button onClick={() => claimQuestReward(quest.id)} className="mt-1 px-3 py-1 rounded-lg bg-yellow-400 text-[#1a1f2a] text-xs font-black">
                    Hämta
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Achievements + skins */}
      <div className="glass-card rounded-2xl p-5 border border-white/10 mt-6">
        <h3 className="text-white font-bold uppercase tracking-wider text-xs mb-3">Prestationer & skinn</h3>
        <p className="text-white/60 text-xs mb-3">Upplåst: {progress.achievements.length} prestationer, {progress.unlockedSkins.length} skinn</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(SKINS).map(([id, skin]) => (
            <div key={id} className={`rounded-xl border p-3 ${progress.unlockedSkins.includes(id) ? 'border-primary/30 bg-primary/5' : 'border-white/10 bg-black/20'}`}>
              <p className="text-white font-bold text-sm">{skin.name}</p>
              <p className="text-white/60 text-xs">{progress.unlockedSkins.includes(id) ? 'Unlocked' : skin.unlockHint}</p>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onBack}
        className="w-full mt-6 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors"
      >
        <span className="material-symbols-outlined">arrow_back</span>
        Tillbaka
      </button>
    </div>
  );
};
