// PWA Installation Banner Component
// Prompts users to install the app as a Progressive Web App

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Download, Smartphone, Star } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

interface PWAInstallBannerProps {
  className?: string;
  showOnMobile?: boolean;
  showOnDesktop?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export function PWAInstallBanner({
  className = '',
  showOnMobile = true,
  showOnDesktop = false,
  autoHide = true,
  autoHideDelay = 10000
}: PWAInstallBannerProps) {
  const { isInstallable, isInstalled, installApp, isLoading, error } = usePWA();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if banner should be shown
    const shouldShow = isInstallable && 
                      !isInstalled && 
                      !isDismissed &&
                      ((showOnMobile && window.innerWidth <= 768) || 
                       (showOnDesktop && window.innerWidth > 768));

    setIsVisible(shouldShow);

    // Auto-hide after delay
    if (shouldShow && autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled, isDismissed, showOnMobile, showOnDesktop, autoHide, autoHideDelay]);

  // Check if banner should be hidden based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (isVisible) {
        const shouldHide = (showOnMobile && window.innerWidth > 768) || 
                          (showOnDesktop && window.innerWidth <= 768);
        
        if (shouldHide) {
          setIsVisible(false);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isVisible, showOnMobile, showOnDesktop]);

  const handleInstall = async () => {
    try {
      await installApp();
      setIsVisible(false);
    } catch (err) {
      console.error('Installation failed:', err);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
    
    // Store dismissal in localStorage
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  const handleLearnMore = () => {
    // Open PWA information page or scroll to features
    window.open('https://web.dev/progressive-web-apps/', '_blank');
  };

  // Check if user has previously dismissed the banner
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <Card className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 shadow-lg border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          {/* Icon */}
          <div className="flex-shrink-0">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-blue-600" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Install Watsudo Hub
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Get the full app experience with offline access, notifications, and more.
            </p>

            {/* Features */}
            <div className="space-y-1 mb-3">
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <Star className="h-3 w-3 text-yellow-500 fill-current" />
                <span>Offline access to your data</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <Star className="h-3 w-3 text-yellow-500 fill-current" />
                <span>Push notifications for updates</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <Star className="h-3 w-3 text-yellow-500 fill-current" />
                <span>App-like experience</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              <Button
                onClick={handleInstall}
                disabled={isLoading}
                size="sm"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Download className="h-3 w-3 mr-1" />
                    Install
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleLearnMore}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Learn More
              </Button>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
