import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

/** Non-standard event Chromium fires once the app is installable. Safari and
    Firefox never send it, so everything here must degrade to "no install". */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type InstallState = {
  /** A browser install prompt is waiting for the player. */
  canInstall: boolean;
  /** Running as an installed app (standalone window or installed PWA). */
  installed: boolean;
  /** Service worker is active, which is what makes the game work offline. */
  offlineReady: boolean;
  /** Opens the browser's install prompt. Returns whether the app was installed. */
  install: () => Promise<boolean>;
};

const InstallContext = createContext<InstallState>({
  canInstall: false,
  installed: false,
  offlineReady: false,
  install: async () => false,
});

const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS reports an installed web app only through this legacy flag.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
};

export const InstallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // Keep the event: the browser asks once, and the player decides when.
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    const media = window.matchMedia?.('(display-mode: standalone)');
    const onDisplayChange = () => setInstalled(isStandalone());

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    media?.addEventListener?.('change', onDisplayChange);

    // Offline support is only real once a service worker is controlling the
    // page, so report that rather than "a worker exists".
    if ('serviceWorker' in navigator) {
      const sync = () => setOfflineReady(!!navigator.serviceWorker.controller);
      sync();
      navigator.serviceWorker.addEventListener('controllerchange', sync);
      navigator.serviceWorker.ready.then(sync).catch(() => {});
      return () => {
        window.removeEventListener('beforeinstallprompt', onPrompt);
        window.removeEventListener('appinstalled', onInstalled);
        media?.removeEventListener?.('change', onDisplayChange);
        navigator.serviceWorker.removeEventListener('controllerchange', sync);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      media?.removeEventListener?.('change', onDisplayChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return false;
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      setPromptEvent(null);
      if (outcome === 'accepted') setInstalled(true);
      return outcome === 'accepted';
    } catch {
      setPromptEvent(null);
      return false;
    }
  }, [promptEvent]);

  return (
    <InstallContext.Provider value={{ canInstall: !!promptEvent, installed, offlineReady, install }}>
      {children}
    </InstallContext.Provider>
  );
};

export const useInstall = () => useContext(InstallContext);
