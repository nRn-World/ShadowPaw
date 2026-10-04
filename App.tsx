
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Header from './components/Header';
import { StartMenuView, SettingsView, HowToPlayView, LeaderboardView, GameOverView, ShopView, QuestsView, PlayingView } from './components/Views';
import { AppView } from './types';
import { ProgressProvider, useProgress } from './context/ProgressContext';
import { AudioEngine } from './services/AudioEngine';

const MENU_VIEWS = [AppView.START, AppView.SETTINGS, AppView.HOW_TO_PLAY, AppView.LEADERBOARD, AppView.SHOP, AppView.QUESTS, AppView.GAME_OVER];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.START);
  const [lastScore, setLastScore] = useState(0);
  const [lastFishesCollected, setLastFishesCollected] = useState(0);
  const menuMusicRef = useRef<HTMLAudioElement | null>(null);
  const { progress } = useProgress();
  const { muted, musicVolume } = progress.settings;

  const getMusicVolume = () => (muted ? 0 : Math.min(1, (musicVolume / 100) * 0.5));

  // One global audio state: every SFX in the game honours mute + the SFX slider.
  useEffect(() => {
    AudioEngine.setVolume(progress.settings.sfxVolume / 100);
    AudioEngine.setMuted(muted);
  }, [muted, progress.settings.sfxVolume]);

  useEffect(() => {
    const shouldPlayMusic = MENU_VIEWS.includes(currentView);

    if (shouldPlayMusic && !menuMusicRef.current) {
      const audio = new Audio('Sounds/Effects/meny.mp3');
      audio.dataset.menuMusic = 'true';
      audio.loop = true;
      audio.volume = 0;
      audio.play().catch(() => {});
      const maxVolume = getMusicVolume();
      let vol = 0;
      const fadeIn = setInterval(() => {
        vol = Math.min(maxVolume, vol + 0.02);
        audio.volume = vol;
        if (vol >= maxVolume) clearInterval(fadeIn);
      }, 80);
      menuMusicRef.current = audio;
    } else if (!shouldPlayMusic && menuMusicRef.current) {
      const a = menuMusicRef.current;
      let v = a.volume;
      const fadeOut = setInterval(() => {
        v = Math.max(0, v - 0.05);
        a.volume = v;
        if (v <= 0) { a.pause(); a.src = ''; clearInterval(fadeOut); }
      }, 50);
      menuMusicRef.current = null;
    } else if (menuMusicRef.current) {
      // Mute / slider changes ramp the live element so it never clicks.
      const a = menuMusicRef.current;
      const target = getMusicVolume();
      const step = (target - a.volume) / 8;
      const ramp = setInterval(() => {
        a.volume = Math.abs(target - a.volume) < Math.abs(step) ? target : a.volume + step;
        if (a.volume === target) clearInterval(ramp);
      }, 25);
    }
  }, [currentView, muted, musicVolume]);

  useEffect(() => {
    const isPlaying = currentView === AppView.PLAYING;
    document.body.style.overflowY = isPlaying ? 'hidden' : 'auto';
    document.body.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflowY = 'auto';
      document.body.style.overflowX = 'hidden';
    };
  }, [currentView]);

  // Memoised so a progress update (coins from every fish) does not hand the
  // views a new callback identity on every render.
  const handleNavigate = useCallback((view: AppView) => {
    setCurrentView(view);
  }, []);

  const handleGameEnd = useCallback((score: number, fishesCollected: number) => {
    setLastScore(score);
    setLastFishesCollected(fishesCollected);
    setCurrentView(AppView.GAME_OVER);
  }, []);

  const renderView = () => {
    switch (currentView) {
      case AppView.START:
        return <StartMenuView onNavigate={handleNavigate} />;
      case AppView.SETTINGS:
        return <SettingsView onBack={() => handleNavigate(AppView.START)} />;
      case AppView.HOW_TO_PLAY:
        return <HowToPlayView onBack={() => handleNavigate(AppView.START)} />;
      case AppView.LEADERBOARD:
        return <LeaderboardView onBack={() => handleNavigate(AppView.START)} onPlay={() => handleNavigate(AppView.PLAYING)} />;
      case AppView.PLAYING:
        return <PlayingView onEnd={handleGameEnd} />;
      case AppView.GAME_OVER:
        return <GameOverView score={lastScore} fishesCollected={lastFishesCollected} onRestart={() => handleNavigate(AppView.PLAYING)} onMenu={() => handleNavigate(AppView.START)} />;
      case AppView.SHOP:
        return <ShopView onBack={() => handleNavigate(AppView.START)} />;
      case AppView.QUESTS:
        return <QuestsView onBack={() => handleNavigate(AppView.START)} />;
      default:
        return <StartMenuView onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col bg-background-dark overflow-x-hidden">
      {/* Night city skyline. The photo is self-hosted (public/city-bg.jpg) so the
          menus never wait on a remote host, and the CSS backdrop grades it to the
          game's neon palette on top. */}
      <div className="app-backdrop" aria-hidden="true">
        <img src="/city-bg.jpg" alt="" className="app-city-photo" />
        <div className="app-backdrop-stars" />
        <div className="app-vignette" />
      </div>

      <Header currentView={currentView} onNavigate={handleNavigate} />

      <main className="relative z-10 flex-1 flex flex-col items-center px-4 pb-16">
        {renderView()}
      </main>
    </div>
  );
};

const WrappedApp: React.FC = () => (
  <ProgressProvider>
    <App />
  </ProgressProvider>
);

export default WrappedApp;
