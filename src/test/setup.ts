// Test setup file for Vitest
import { vi } from 'vitest';


// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeEach(() => {
  // Mock console methods
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  // Restore console methods
  vi.restoreAllMocks();
});

// Mock performance API for tests that need it
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
  } as Performance;
}

// Mock fetch API
global.fetch = vi.fn();

// Mock environment variables
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('NODE_ENV', 'test');

// Extend test environment with DOM and browser API mocks
import '@testing-library/jest-dom';

// Basic Service Worker mock
// Preserve original navigator properties and override serviceWorker and online status
const originalNavigator = window.navigator;
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: originalNavigator.userAgent,
    onLine: true,
    serviceWorker: {
      register: vi.fn().mockResolvedValue({ update: vi.fn(), installing: null }),
      ready: Promise.resolve({}),
      getRegistrations: vi.fn().mockResolvedValue([]),
    },
  },
  writable: true,
});

// matchMedia mock
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// beforeinstallprompt mock
// @ts-ignore
window.deferredPrompt = undefined;
window.addEventListener = ((orig) => (type: any, listener: any, options?: any) => {
  if (type === 'beforeinstallprompt') {
    // @ts-ignore
    window.__bipListener = listener;
    return;
  }
  return orig.call(window, type, listener, options);
})(window.addEventListener);

// Notification API mock
class MockNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission() {
    return Promise.resolve(this.permission);
  }
  constructor(public title: string, public options?: NotificationOptions) {}
}
Object.defineProperty(global, 'Notification', {
  value: MockNotification,
  writable: true,
});

// localStorage mock
class LocalStorageMock {
  private store: Record<string, string> = {};
  clear() { this.store = {}; }
  getItem(key: string) { return this.store[key] ?? null; }
  setItem(key: string, value: string) { this.store[key] = String(value); }
  removeItem(key: string) { delete this.store[key]; }
}
Object.defineProperty(window, 'localStorage', {
  value: new LocalStorageMock(),
  writable: true,
});

// Polyfill FormData to accept HTMLFormElement in jsdom
const NativeFormData = global.FormData;
Object.defineProperty(global, 'FormData', {
  value: class FormDataShim extends NativeFormData {
    constructor(form?: HTMLFormElement) {
      super(form instanceof HTMLFormElement ? form : undefined);
    }
  },
  writable: true,
});
