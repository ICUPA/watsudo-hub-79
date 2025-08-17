// PWA Status Indicator Component
// Shows current PWA state and provides quick actions

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  Smartphone, 
  Wifi, 
  WifiOff, 
  Download, 
  RefreshCw, 
  Settings,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

interface PWAStatusIndicatorProps {
  showBadge?: boolean;
  showDropdown?: boolean;
  className?: string;
}

export function PWAStatusIndicator({
  showBadge = true,
  showDropdown = true,
  className = ''
}: PWAStatusIndicatorProps) {
  const { 
    isInstalled, 
    isInstallable, 
    isOffline, 
    isUpdateAvailable, 
    isLoading,
    installApp,
    updateApp,
    requestNotificationPermission,
    sendNotification,
    error 
  } = usePWA();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const getStatusIcon = () => {
    if (isLoading) {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
    
    if (isOffline) {
      return <WifiOff className="h-4 w-4 text-red-500" />;
    }
    
    if (isInstalled) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    if (isInstallable) {
      return <Download className="h-4 w-4 text-blue-500" />;
    }
    
    return <Smartphone className="h-4 w-4 text-gray-400" />;
  };

  const getStatusText = () => {
    if (isLoading) return 'Loading...';
    if (isOffline) return 'Offline';
    if (isInstalled) return 'Installed';
    if (isInstallable) return 'Installable';
    return 'Not Supported';
  };

  const getStatusColor = () => {
    if (isLoading) return 'bg-gray-100 text-gray-800';
    if (isOffline) return 'bg-red-100 text-red-800';
    if (isInstalled) return 'bg-green-100 text-green-800';
    if (isInstallable) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const handleInstall = async () => {
    try {
      await installApp();
    } catch (err) {
      console.error('Installation failed:', err);
    }
  };

  const handleUpdate = async () => {
    try {
      await updateApp();
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  const handleRequestNotifications = async () => {
    try {
      await requestNotificationPermission();
    } catch (err) {
      console.error('Notification permission request failed:', err);
    }
  };

  const handleTestNotification = async () => {
    try {
      await sendNotification('Test Notification', {
        body: 'This is a test notification from Watsudo Hub',
        tag: 'test-notification'
      });
    } catch (err) {
      console.error('Test notification failed:', err);
    }
  };

  if (!showDropdown) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {getStatusIcon()}
        {showBadge && (
          <Badge className={getStatusColor()}>
            {getStatusText()}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={`p-2 ${className}`}>
          {getStatusIcon()}
          {showBadge && (
            <Badge className={`ml-2 ${getStatusColor()}`}>
              {getStatusText()}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-64">
        {/* Status Header */}
        <div className="px-3 py-2 border-b">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <div>
              <div className="font-medium text-sm">PWA Status</div>
              <div className="text-xs text-gray-500">{getStatusText()}</div>
            </div>
          </div>
        </div>

        {/* Status Details */}
        <div className="px-3 py-2 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Installation:</span>
            <Badge variant={isInstalled ? "default" : "secondary"} className="text-xs">
              {isInstalled ? 'Installed' : 'Not Installed'}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Connection:</span>
            <Badge variant={isOffline ? "destructive" : "default"} className="text-xs">
              {isOffline ? 'Offline' : 'Online'}
            </Badge>
          </div>
          
          {isUpdateAvailable && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Updates:</span>
              <Badge variant="default" className="text-xs bg-yellow-100 text-yellow-800">
                Available
              </Badge>
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Actions */}
        {isInstallable && !isInstalled && (
          <DropdownMenuItem onClick={handleInstall} className="cursor-pointer">
            <Download className="h-4 w-4 mr-2" />
            Install App
          </DropdownMenuItem>
        )}

        {isUpdateAvailable && (
          <DropdownMenuItem onClick={handleUpdate} className="cursor-pointer">
            <RefreshCw className="h-4 w-4 mr-2" />
            Update App
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={handleRequestNotifications} className="cursor-pointer">
          <Settings className="h-4 w-4 mr-2" />
          Request Notifications
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleTestNotification} className="cursor-pointer">
          <Info className="h-4 w-4 mr-2" />
          Test Notification
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Information */}
        <div className="px-3 py-2 text-xs text-gray-500 space-y-1">
          <div>Service Worker: {('serviceWorker' in navigator) ? 'Supported' : 'Not Supported'}</div>
          <div>Push Manager: {('PushManager' in window) ? 'Supported' : 'Not Supported'}</div>
          <div>Notifications: {('Notification' in window) ? 'Supported' : 'Not Supported'}</div>
        </div>

        {/* Error Display */}
        {error && (
          <>
            <DropdownMenuSeparator />
            <div className="px-3 py-2">
              <div className="flex items-center space-x-2 text-xs text-red-600">
                <AlertCircle className="h-3 w-3" />
                <span>Error: {error}</span>
              </div>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
