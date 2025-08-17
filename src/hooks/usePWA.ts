// PWA Hook
// Manages Progressive Web App functionality including service worker, installation, and offline status

import { useState, useEffect, useCallback } from 'react';

interface PWAState {
  isInstalled: boolean;
  isInstallable: boolean;
  isOffline: boolean;
  isUpdateAvailable: boolean;
  isLoading: boolean;
  error: string | null;
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    isInstalled: false,
    isInstallable: false,
    isOffline: false,
    isUpdateAvailable: false,
    isLoading: true,
    error: null
  });

  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);

  // Check if app is installed
  const checkInstallation = useCallback(() => {
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true ||
                       document.referrer.includes('android-app://');
    
    setState(prev => ({ ...prev, isInstalled }));
  }, []);

  // Check if app can be installed
  const checkInstallability = useCallback(() => {
    const isInstallable = 'serviceWorker' in navigator && 'PushManager' in window;
    setState(prev => ({ ...prev, isInstallable }));
  }, []);

  // Check offline status
  const checkOfflineStatus = useCallback(() => {
    const isOffline = !navigator.onLine;
    setState(prev => ({ ...prev, isOffline }));
  }, []);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      setState(prev => ({ ...prev, error: 'Service Worker not supported' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setState(prev => ({ ...prev, isUpdateAvailable: true }));
            }
          });
        }
      });

      // Handle service worker updates
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Failed to register Service Worker' 
      }));
    }
  }, []);

  // Handle installation prompt
  const handleInstallPrompt = useCallback((event: Event) => {
    event.preventDefault();
    setDeferredPrompt(event as InstallPromptEvent);
    setState(prev => ({ ...prev, isInstallable: true }));
  }, []);

  // Install the app
  const installApp = useCallback(async () => {
    if (!deferredPrompt) {
      setState(prev => ({ ...prev, error: 'Installation not available' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      // Show the install prompt
      deferredPrompt.prompt();
      
      // Wait for user choice
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setState(prev => ({ ...prev, isInstalled: true, isInstallable: false }));
      } else {
        console.log('User dismissed the install prompt');
      }
      
      // Clear the deferred prompt
      setDeferredPrompt(null);
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      console.error('Installation failed:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Installation failed' 
      }));
    }
  }, [deferredPrompt]);

  // Update the app
  const updateApp = useCallback(async () => {
    if (!navigator.serviceWorker.controller) {
      setState(prev => ({ ...prev, error: 'No service worker controller' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      // Send message to service worker to skip waiting
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      
      setState(prev => ({ ...prev, isUpdateAvailable: false, isLoading: false }));
    } catch (error) {
      console.error('Update failed:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Update failed' 
      }));
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      setState(prev => ({ ...prev, error: 'Notifications not supported' }));
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      setState(prev => ({ ...prev, error: 'Notification permission denied' }));
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      setState(prev => ({ ...prev, error: 'Failed to request notification permission' }));
      return false;
    }
  }, []);

  // Send notification
  const sendNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (!('Notification' in window)) {
      setState(prev => ({ ...prev, error: 'Notifications not supported' }));
      return;
    }

    if (Notification.permission !== 'granted') {
      const granted = await requestNotificationPermission();
      if (!granted) return;
    }

    try {
      const notification = new Notification(title, {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        ...options
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      return notification;
    } catch (error) {
      console.error('Failed to send notification:', error);
      setState(prev => ({ ...prev, error: 'Failed to send notification' }));
    }
  }, [requestNotificationPermission]);

  // Initialize PWA functionality
  useEffect(() => {
    checkInstallation();
    checkInstallability();
    checkOfflineStatus();
    registerServiceWorker();

    // Listen for installation prompt
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    // Listen for online/offline events
    window.addEventListener('online', checkOfflineStatus);
    window.addEventListener('offline', checkOfflineStatus);

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      setState(prev => ({ ...prev, isInstalled: true, isInstallable: false }));
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('online', checkOfflineStatus);
      window.removeEventListener('offline', checkOfflineStatus);
    };
  }, [checkInstallation, checkInstallability, checkOfflineStatus, registerServiceWorker, handleInstallPrompt]);

  // Check for updates periodically
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const interval = setInterval(async () => {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            await registration.update();
          }
        } catch (error) {
          console.error('Update check failed:', error);
        }
      }, 60000); // Check every minute

      return () => clearInterval(interval);
    }
  }, []);

  return {
    ...state,
    installApp,
    updateApp,
    requestNotificationPermission,
    sendNotification,
    clearError: () => setState(prev => ({ ...prev, error: null }))
  };
}
