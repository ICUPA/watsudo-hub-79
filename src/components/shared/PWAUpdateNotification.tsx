// PWA Update Notification Component
// Alerts users when a new version of the app is available

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, X, Info, Download } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

interface PWAUpdateNotificationProps {
  className?: string;
  autoHide?: boolean;
  autoHideDelay?: number;
  showReloadButton?: boolean;
}

export function PWAUpdateNotification({
  className = '',
  autoHide = false,
  autoHideDelay = 30000,
  showReloadButton = true
}: PWAUpdateNotificationProps) {
  const { isUpdateAvailable, updateApp, isLoading, error } = usePWA();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (isUpdateAvailable && !isDismissed) {
      setIsVisible(true);

      // Auto-hide after delay if enabled
      if (autoHide) {
        const timer = setTimeout(() => {
          setIsVisible(false);
        }, autoHideDelay);

        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [isUpdateAvailable, isDismissed, autoHide, autoHideDelay]);

  const handleUpdate = async () => {
    try {
      await updateApp();
      // The page will reload automatically after update
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
    
    // Store dismissal in localStorage
    localStorage.setItem('pwa-update-dismissed', 'true');
  };

  // Check if user has previously dismissed the update notification
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-update-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  // Reset dismissal when update becomes available
  useEffect(() => {
    if (isUpdateAvailable) {
      setIsDismissed(false);
      localStorage.removeItem('pwa-update-dismissed');
    }
  }, [isUpdateAvailable]);

  if (!isVisible) {
    return null;
  }

  return (
    <Card className={`fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 shadow-lg border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          {/* Icon */}
          <div className="flex-shrink-0">
            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
              <Download className="h-5 w-5 text-green-600" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Update Available
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              A new version of Watsudo Hub is available with improvements and bug fixes.
            </p>

            {/* Update Info */}
            <div className="space-y-1 mb-3">
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <Info className="h-3 w-3 text-blue-500" />
                <span>Update will be applied automatically</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <Info className="h-3 w-3 text-blue-500" />
                <span>Your data will be preserved</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              <Button
                onClick={handleUpdate}
                disabled={isLoading}
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Update Now
                  </>
                )}
              </Button>
              
              {showReloadButton && (
                <Button
                  onClick={handleReload}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Reload
                </Button>
              )}
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Dismiss notification"
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

        {/* Progress Indicator */}
        {isLoading && (
          <div className="mt-3">
            <div className="flex items-center space-x-2 text-xs text-green-700">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
              <span>Updating app...</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
