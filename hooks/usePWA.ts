import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined') {
      return (window as any).deferredInstallPrompt || null;
    }
    return null;
  });
  const [isInstallable, setIsInstallable] = useState(() => {
    if (typeof window !== 'undefined') {
      return !!(window as any).deferredInstallPrompt;
    }
    return false;
  });
  const canInstall = isInstallable;
  
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(display-mode: standalone)').matches ||
            (navigator as any).standalone === true;
    }
    return false;
  });

  const [isIOS, setIsIOS] = useState(() => {
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    }
    return false;
  });

  const [isOffline, setIsOffline] = useState(() => {
    if (typeof navigator !== 'undefined') {
      return !navigator.onLine;
    }
    return false;
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const customHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setDeferredPrompt(detail);
        setIsInstallable(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('pwa-beforeinstallprompt', customHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('pwa-beforeinstallprompt', customHandler);
    };
  }, []);

  useEffect(() => {
    // Handle appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // Detect offline status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup listeners
    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Trigger Native Android/Chrome prompt
  const installApp = useCallback(async () => {
    if (!deferredPrompt) {
      console.warn('[PWA_DEBUG] Instalação indisponível no momento.');
      return false;
    }

    try {
      // Show the install prompt
      await deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA_DEBUG] O usuário aceitou a instalação.');
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      } else {
        console.log('[PWA_DEBUG] O usuário rejeitou a instalação.');
        return false;
      }
    } catch (err) {
      console.error('[PWA_DEBUG] Erro ao invocar instalador:', err);
      return false;
    }
  }, [deferredPrompt]);

  return {
    isInstallable,
    canInstall,
    isInstalled,
    isIOS,
    isOffline,
    installApp,
    promptInstall: installApp
  };
}
