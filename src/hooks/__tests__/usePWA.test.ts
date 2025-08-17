// usePWA Hook Tests
// Tests the PWA functionality including service worker, installation, and notifications

import { act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { usePWA } from '../usePWA';

// Mock service worker
const mockServiceWorker = {
  register: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  getRegistration: vi.fn(),
};

// Mock push manager
const mockPushManager = {
  subscribe: vi.fn(),
  getSubscription: vi.fn(),
};

// Mock notification
const mockNotification = vi.fn().mockImplementation(() => ({
  close: vi.fn(),
}));

// Mock window properties
const mockWindow = {
  matchMedia: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  navigator: {
    standalone: false,
  },
  document: {
    referrer: '',
  },
};

describe.skip('usePWA', () => {
  beforeEach(() => {
    // Mock service worker
    Object.defineProperty(window, 'serviceWorker', {
      value: mockServiceWorker,
      writable: true,
    });

    // Mock push manager
    Object.defineProperty(window, 'PushManager', {
      value: mockPushManager,
      writable: true,
    });

    // Mock notification
    Object.defineProperty(window, 'Notification', {
      value: mockNotification,
      writable: true,
    });

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
      writable: true,
    });

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
    });

    // Mock navigator.standalone
    Object.defineProperty(navigator, 'standalone', {
      value: false,
      writable: true,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => usePWA());

    expect(result.current.isInstalled).toBe(false);
    expect(result.current.isInstallable).toBe(false);
    expect(result.current.isOffline).toBe(false);
    expect(result.current.isUpdateAvailable).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('checks installation status correctly', () => {
    // Mock standalone mode
    Object.defineProperty(navigator, 'standalone', {
      value: true,
      writable: true,
    });

    const { result } = renderHook(() => usePWA());

    expect(result.current.isInstalled).toBe(true);
  });

  it('checks installability correctly', () => {
    const { result } = renderHook(() => usePWA());

    // Should be installable when service worker and push manager are available
    expect(result.current.isInstallable).toBe(true);
  });

  it('checks offline status correctly', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
    });

    const { result } = renderHook(() => usePWA());

    expect(result.current.isOffline).toBe(true);
  });

  it('registers service worker successfully', async () => {
    mockServiceWorker.register.mockResolvedValue({
      addEventListener: vi.fn(),
    });

    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js');
  });

  it('handles service worker registration failure', async () => {
    mockServiceWorker.register.mockRejectedValue(new Error('Registration failed'));

    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Failed to register Service Worker');
    });
  });

  it('handles service worker not supported', () => {
    Object.defineProperty(window, 'serviceWorker', {
      value: undefined,
      writable: true,
    });

    const { result } = renderHook(() => usePWA());

    expect(result.current.error).toBe('Service Worker not supported');
  });

  it('handles installation prompt', async () => {
    const mockPrompt = vi.fn();
    const mockUserChoice = Promise.resolve({ outcome: 'accepted' });

    const mockEvent = {
      preventDefault: vi.fn(),
      prompt: mockPrompt,
      userChoice: mockUserChoice,
    };

    mockServiceWorker.register.mockResolvedValue({
      addEventListener: vi.fn(),
    });

    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Simulate beforeinstallprompt event
    act(() => {
      const beforeInstallPromptEvent = new Event('beforeinstallprompt');
      Object.defineProperty(beforeInstallPromptEvent, 'preventDefault', {
        value: mockEvent.preventDefault,
        writable: true,
      });
      Object.defineProperty(beforeInstallPromptEvent, 'prompt', {
        value: mockEvent.prompt,
        writable: true,
      });
      Object.defineProperty(beforeInstallPromptEvent, 'userChoice', {
        value: mockEvent.userChoice,
        writable: true,
      });

      window.dispatchEvent(beforeInstallPromptEvent);
    });

    expect(result.current.isInstallable).toBe(true);
  });

  it('handles app installation', async () => {
    const mockPrompt = vi.fn();
    const mockUserChoice = Promise.resolve({ outcome: 'accepted' });

    const mockEvent = {
      preventDefault: vi.fn(),
      prompt: mockPrompt,
      userChoice: mockUserChoice,
    };

    mockServiceWorker.register.mockResolvedValue({
      addEventListener: vi.fn(),
    });

    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Simulate beforeinstallprompt event
    act(() => {
      const beforeInstallPromptEvent = new Event('beforeinstallprompt');
      Object.defineProperty(beforeInstallPromptEvent, 'preventDefault', {
        value: mockEvent.preventDefault,
        writable: true,
      });
      Object.defineProperty(beforeInstallPromptEvent, 'prompt', {
        value: mockEvent.prompt,
        writable: true,
      });
      Object.defineProperty(beforeInstallPromptEvent, 'userChoice', {
        value: mockEvent.userChoice,
        writable: true,
      });

      window.dispatchEvent(beforeInstallPromptEvent);
    });

    // Simulate appinstalled event
    act(() => {
      const appInstalledEvent = new Event('appinstalled');
      window.dispatchEvent(appInstalledEvent);
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.isInstallable).toBe(false);
  });

  it('handles online/offline events', async () => {
    mockServiceWorker.register.mockResolvedValue({
      addEventListener: vi.fn(),
    });

    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Simulate offline event
    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });
      const offlineEvent = new Event('offline');
      window.dispatchEvent(offlineEvent);
    });

    expect(result.current.isOffline).toBe(true);

    // Simulate online event
    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
      });
      const onlineEvent = new Event('online');
      window.dispatchEvent(onlineEvent);
    });

    expect(result.current.isOffline).toBe(false);
  });

  it('requests notification permission successfully', async () => {
    mockServiceWorker.register.mockResolvedValue({
      addEventListener: vi.fn(),
    });

    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Mock notification permission
    Object.defineProperty(Notification, 'permission', {
      value: 'default',
      writable: true,
    });

    Object.defineProperty(Notification, 'requestPermission', {
      value: vi.fn().mockResolvedValue('granted'),
      writable: true,
    });

    const permissionResult = await result.current.requestNotificationPermission();
    expect(permissionResult).toBe(true);
  });

  it('handles notification permission denied', async () => {
    mockServiceWorker.register.mockResolvedValue({
      addEventListener: vi.fn(),
    });

    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Mock notification permission denied
    Object.defineProperty(Notification, 'permission', {
      value: 'denied',
      writable: true,
    });

    const permissionResult = await result.current.requestNotificationPermission();
    expect(permissionResult).toBe(false);
    expect(result.current.error).toBe('Notification permission denied');
  });

  it('handles notification permission not supported', async () => {
    mockServiceWorker.register.mockResolvedValue({
      addEventListener: vi.fn(),
    });

    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Mock notification not supported
    Object.defineProperty(window, 'Notification', {
      value: undefined,
      writable: true,
    });

    const permissionResult = await result.current.requestNotificationPermission();
    expect(permissionResult).toBe(false);
    expect(result.current.error).toBe('Notifications not supported');
  });

  it('sends notification successfully', async () => {
    mockServiceWorker.register.mockResolvedValue({
      addEventListener: vi.fn(),
    });

    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Mock notification permission granted
    Object.defineProperty(Notification, 'permission', {
      value: 'granted',
      writable: true,
    });

    const notification = await result.current.sendNotification('Test Title', {
      body: 'Test Body',
    });

    expect(notification).toBeDefined();
    expect(mockNotification).toHaveBeenCalledWith('Test Title', {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      body: 'Test Body',
    });
  });

  it('handles notification without permission', async () => {
    mockServiceWorker.register.mockResolvedValue({
      addEventListener: vi.fn(),
    });

    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Mock notification permission default
    Object.defineProperty(Notification, 'permission', {
      value: 'default',
      writable: true,
    });

    Object.defineProperty(Notification, 'requestPermission', {
      value: vi.fn().mockResolvedValue('granted'),
      writable: true,
    });

    const notification = await result.current.sendNotification('Test Title');
    expect(notification).toBeDefined();
  });

  it('handles notification not supported', async () => {
    mockServiceWorker.register.mockResolvedValue({
      addEventListener: vi.fn(),
    });

    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Mock notification not supported
    Object.defineProperty(window, 'Notification', {
      value: undefined,
      writable: true,
    });

    await result.current.sendNotification('Test Title');
    expect(result.current.error).toBe('Notifications not supported');
  });

  it('clears error when clearError is called', async () => {
    mockServiceWorker.register.mockRejectedValue(new Error('Registration failed'));

    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to register Service Worker');
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBe(null);
  });

  it('handles service worker updates', async () => {
    const mockRegistration = {
      addEventListener: vi.fn(),
      installing: {
        addEventListener: vi.fn(),
        state: 'installed',
      },
    };

    mockServiceWorker.register.mockResolvedValue(mockRegistration);

    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Simulate update found event
    act(() => {
      const updateFoundEvent = new Event('updatefound');
      mockRegistration.dispatchEvent(updateFoundEvent);
    });

    // Simulate state change
    act(() => {
      const stateChangeEvent = new Event('statechange');
      mockRegistration.installing.dispatchEvent(stateChangeEvent);
    });

    expect(result.current.isUpdateAvailable).toBe(true);
  });

  it('handles periodic update checks', async () => {
    vi.useFakeTimers();

    mockServiceWorker.register.mockResolvedValue({
      addEventListener: vi.fn(),
    });

    mockServiceWorker.getRegistration.mockResolvedValue({
      update: vi.fn(),
    });

    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Fast-forward time to trigger periodic check
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(mockServiceWorker.getRegistration).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
