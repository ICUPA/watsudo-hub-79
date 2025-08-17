// PWAInstallBanner Component Tests
// Tests the PWA installation banner functionality

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { PWAInstallBanner } from '../PWAInstallBanner';

// Mock usePWA hook
vi.mock('@/hooks/usePWA', () => ({
  usePWA: vi.fn(),
}));

import * as usePWAHook from '../../../hooks/usePWA';

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

describe.skip('PWAInstallBanner', () => {
  const mockUsePWA = vi.mocked(usePWAHook.usePWA);

  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });

    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      value: 768,
      writable: true,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders when PWA is installable and not installed', () => {
    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    render(<PWAInstallBanner />);
    
    expect(screen.getByText('Install Watsudo Hub')).toBeInTheDocument();
    expect(screen.getByText('Get the full app experience with offline access, notifications, and more.')).toBeInTheDocument();
    expect(screen.getByText('Install')).toBeInTheDocument();
    expect(screen.getByText('Learn More')).toBeInTheDocument();
  });

  it('does not render when PWA is not installable', () => {
    mockUsePWA.mockReturnValue({
      isInstallable: false,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    const { container } = render(<PWAInstallBanner />);
    
    expect(container.firstChild).toBeNull();
  });

  it('does not render when PWA is already installed', () => {
    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: true,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    const { container } = render(<PWAInstallBanner />);
    
    expect(container.firstChild).toBeNull();
  });

  it('does not render when previously dismissed', () => {
    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    // Mock localStorage to return dismissed state
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn().mockReturnValue('true'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });

    const { container } = render(<PWAInstallBanner />);
    
    expect(container.firstChild).toBeNull();
  });

  it('shows on mobile devices', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 375,
      writable: true,
    });

    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    render(<PWAInstallBanner showOnMobile={true} showOnDesktop={false} />);
    
    expect(screen.getByText('Install Watsudo Hub')).toBeInTheDocument();
  });

  it('shows on desktop devices', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      writable: true,
    });

    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    render(<PWAInstallBanner showOnMobile={false} showOnDesktop={true} />);
    
    expect(screen.getByText('Install Watsudo Hub')).toBeInTheDocument();
  });

  it('hides on mobile when showOnMobile is false', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 375,
      writable: true,
    });

    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    const { container } = render(<PWAInstallBanner showOnMobile={false} showOnDesktop={true} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('hides on desktop when showOnDesktop is false', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      writable: true,
    });

    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    const { container } = render(<PWAInstallBanner showOnMobile={true} showOnDesktop={false} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('auto-hides after specified delay', async () => {
    vi.useFakeTimers();

    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    const { container } = render(<PWAInstallBanner autoHide={true} autoHideDelay={5000} />);
    
    expect(screen.getByText('Install Watsudo Hub')).toBeInTheDocument();

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });

    vi.useRealTimers();
  });

  it('does not auto-hide when autoHide is false', async () => {
    vi.useFakeTimers();

    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    render(<PWAInstallBanner autoHide={false} autoHideDelay={5000} />);
    
    expect(screen.getByText('Install Watsudo Hub')).toBeInTheDocument();

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('Install Watsudo Hub')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('handles install button click', async () => {
    const mockInstallApp = vi.fn();
    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: mockInstallApp,
      isLoading: false,
      error: null,
    });

    render(<PWAInstallBanner />);
    
    const installButton = screen.getByText('Install');
    fireEvent.click(installButton);
    
    expect(mockInstallApp).toHaveBeenCalled();
  });

  it('handles learn more button click', () => {
    const mockOpen = vi.fn();
    Object.defineProperty(window, 'open', {
      value: mockOpen,
      writable: true,
    });

    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    render(<PWAInstallBanner />);
    
    const learnMoreButton = screen.getByText('Learn More');
    fireEvent.click(learnMoreButton);
    
    expect(mockOpen).toHaveBeenCalledWith('https://web.dev/progressive-web-apps/', '_blank');
  });

  it('handles dismiss button click', () => {
    const mockSetItem = vi.fn();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: mockSetItem,
        removeItem: vi.fn(),
      },
      writable: true,
    });

    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    const { container } = render(<PWAInstallBanner />);
    
    const dismissButton = screen.getByLabelText('Dismiss banner');
    fireEvent.click(dismissButton);
    
    expect(mockSetItem).toHaveBeenCalledWith('pwa-banner-dismissed', 'true');
    expect(container.firstChild).toBeNull();
  });

  it('shows loading state on install button', () => {
    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: true,
      error: null,
    });

    render(<PWAInstallBanner />);
    
    const installButton = screen.getByRole('button', { name: /install/i });
    expect(installButton).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays error message when error occurs', () => {
    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: 'Installation failed',
    });

    render(<PWAInstallBanner />);
    
    expect(screen.getByText('Installation failed')).toBeInTheDocument();
  });

  it('displays PWA features list', () => {
    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    render(<PWAInstallBanner />);
    
    expect(screen.getByText('Available Offline')).toBeInTheDocument();
    expect(screen.getByText('Offline access to your data')).toBeInTheDocument();
    expect(screen.getByText('Push notifications for updates')).toBeInTheDocument();
    expect(screen.getByText('App-like experience')).toBeInTheDocument();
  });

  it('handles window resize events', async () => {
    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    const { container } = render(<PWAInstallBanner showOnMobile={true} showOnDesktop={false} />);
    
    expect(screen.getByText('Install Watsudo Hub')).toBeInTheDocument();

    // Simulate resize to desktop
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
        writable: true,
      });
      window.dispatchEvent(new Event('resize'));
    });

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('applies custom className', () => {
    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    const { container } = render(<PWAInstallBanner className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('handles multiple banner instances', () => {
    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    const { container: container1 } = render(<PWAInstallBanner />);
    const { container: container2 } = render(<PWAInstallBanner />);
    
    expect(container1.firstChild).toBeInTheDocument();
    expect(container2.firstChild).toBeInTheDocument();
  });

  it('cleans up event listeners on unmount', () => {
    const mockRemoveEventListener = vi.fn();
    Object.defineProperty(window, 'removeEventListener', {
      value: mockRemoveEventListener,
      writable: true,
    });

    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: null,
    });

    const { unmount } = render(<PWAInstallBanner />);
    
    unmount();
    
    expect(mockRemoveEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('handles edge case with no PWA support', () => {
    mockUsePWA.mockReturnValue({
      isInstallable: false,
      isInstalled: false,
      installApp: vi.fn(),
      isLoading: false,
      error: 'PWA not supported',
    });

    const { container } = render(<PWAInstallBanner />);
    
    expect(container.firstChild).toBeNull();
  });

  it('handles rapid state changes', async () => {
    const mockInstallApp = vi.fn();
    
    mockUsePWA.mockReturnValue({
      isInstallable: true,
      isInstalled: false,
      installApp: mockInstallApp,
      isLoading: false,
      error: null,
    });

    const { rerender } = render(<PWAInstallBanner />);
    
    expect(screen.getByText('Install Watsudo Hub')).toBeInTheDocument();

    // Rapidly change state
    mockUsePWA.mockReturnValue({
      isInstallable: false,
      isInstalled: false,
      installApp: mockInstallApp,
      isLoading: false,
      error: null,
    });

    rerender(<PWAInstallBanner />);
    
    expect(screen.queryByText('Install Watsudo Hub')).not.toBeInTheDocument();
  });
});
