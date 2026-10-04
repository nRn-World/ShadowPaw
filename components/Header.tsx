
import React from 'react';
import { AppView } from '../types';
import { useProgress } from '../context/ProgressContext';

interface HeaderProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

const NAV_ITEMS: { view: AppView; icon: string; label: string }[] = [
  { view: AppView.START, icon: 'home', label: 'Hem' },
  { view: AppView.SHOP, icon: 'store', label: 'Butik' },
  { view: AppView.QUESTS, icon: 'task_alt', label: 'Uppdrag' },
  { view: AppView.LEADERBOARD, icon: 'emoji_events', label: 'Topplista' },
];

const Header: React.FC<HeaderProps> = ({ currentView, onNavigate }) => {
  const isActive = (view: AppView) => currentView === view;
  const { progress, toggleMuted } = useProgress();
  const muted = progress.settings.muted;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#04060f]/70 backdrop-blur-2xl">
      {/* Hairline highlight along the top edge. */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Brand */}
          <button
            onClick={() => onNavigate(AppView.START)}
            className="group flex shrink-0 items-center gap-2.5"
            aria-label="Till startsidan"
          >
            <span className="relative flex size-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 transition-all duration-200 group-hover:border-primary/50 group-hover:bg-primary/20">
              <span
                className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                style={{ boxShadow: '0 0 18px rgba(43,238,121,0.55)' }}
              />
              <span className="material-symbols-outlined relative text-primary text-lg">pets</span>
            </span>
            <span className="hidden text-left leading-none sm:block">
              <span className="block font-display text-sm font-black tracking-[0.18em] text-white">SHADOW PAW</span>
              <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.22em] text-white/35">
                NRN World
              </span>
            </span>
          </button>

          {/* Coins on small screens */}
          <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1.5 sm:hidden">
            <span className="material-symbols-outlined text-sm text-yellow-500">monetization_on</span>
            <span className="tabular text-sm font-black text-yellow-400">{progress.coins}</span>
          </div>

          {/* Navigation */}
          <nav className="hidden items-center gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavButton
                key={item.view}
                active={isActive(item.view)}
                onClick={() => onNavigate(item.view)}
                icon={item.icon}
                label={item.label}
              />
            ))}
          </nav>

          {/* Right side */}
          <div className="flex shrink-0 items-center gap-2">
            {/* One button mutes/unmutes music and every sound effect at once. */}
            <button
              onClick={toggleMuted}
              aria-pressed={muted}
              aria-label={muted ? 'Slå på ljudet' : 'Stäng av ljudet'}
              title={muted ? 'Slå på ljudet' : 'Stäng av ljudet'}
              className={`relative flex size-9 items-center justify-center rounded-xl border transition-all duration-200 ${
                muted
                  ? 'border-primary-red/40 bg-primary-red/10 text-primary-red hover:bg-primary-red/20'
                  : 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/20'
              }`}
            >
              {muted && (
                <span
                  className="absolute inset-0 rounded-xl"
                  style={{ boxShadow: '0 0 16px rgba(255,77,109,0.45)' }}
                  aria-hidden="true"
                />
              )}
              <span className="material-symbols-outlined relative text-lg">
                {muted ? 'volume_off' : 'volume_up'}
              </span>
            </button>
            <div className="hidden items-center gap-1.5 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1.5 sm:flex">
              <span className="material-symbols-outlined text-sm text-yellow-500">monetization_on</span>
              <span className="tabular text-sm font-black text-yellow-400">{progress.coins}</span>
            </div>

            <div className="hidden items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-2.5 py-1.5 sm:flex">
              <span className="material-symbols-outlined text-xs text-primary">military_tech</span>
              <span className="tabular text-xs font-black text-primary">{progress.level}</span>
            </div>

            {currentView !== AppView.START && (
              <button onClick={() => onNavigate(AppView.PLAYING)} className="btn-primary px-4 py-2 text-[13px] sm:px-5">
                <span className="material-symbols-outlined text-base">play_arrow</span>
                <span className="hidden sm:inline">Spela</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-all duration-200 ${
      active ? 'text-white' : 'text-white/50 hover:bg-white/[0.06] hover:text-white/85'
    }`}
  >
    {active && (
      <span className="absolute inset-0 rounded-xl border border-white/10 bg-white/[0.08]" aria-hidden="true" />
    )}
    <span
      className={`material-symbols-outlined relative text-lg transition-colors duration-200 ${active ? 'text-primary' : ''}`}
    >
      {icon}
    </span>
    <span className="relative hidden lg:inline">{label}</span>
  </button>
);

export default Header;