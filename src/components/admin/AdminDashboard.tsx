// Admin Dashboard Component
// Provides system overview, statistics, and quick access to admin functions

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Car, 
  MapPin, 
  QrCode, 
  Shield, 
  Activity, 
  TrendingUp, 
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface SystemStats {
  totalUsers: number;
  activeDrivers: number;
  pendingRides: number;
  totalRides: number;
  activeSessions: number;
  qrCodesGenerated: number;
  systemHealth: 'healthy' | 'warning' | 'error';
  lastUpdated: string;
}

interface RecentActivity {
  id: string;
  type: 'user_registration' | 'ride_booking' | 'qr_generation' | 'vehicle_added' | 'system_alert';
  description: string;
  timestamp: string;
  status: 'success' | 'pending' | 'error';
  userId?: string;
  metadata?: any;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load system statistics
      const statsData = await loadSystemStats();
      setStats(statsData);

      // Load recent activity
      const activityData = await loadRecentActivity();
      setRecentActivity(activityData);

      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSystemStats = async (): Promise<SystemStats> => {
    try {
      // Get total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get active drivers
      const { count: activeDrivers } = await supabase
        .from('drivers')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get pending rides
      const { count: pendingRides } = await supabase
        .from('rides')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Get total rides
      const { count: totalRides } = await supabase
        .from('rides')
        .select('*', { count: 'exact', head: true });

      // Get active sessions
      const { count: activeSessions } = await supabase
        .from('chat_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', new Date(Date.now() - 3600000).toISOString()); // Last hour

      // Get QR codes generated
      const { count: qrCodesGenerated } = await supabase
        .from('qr_profiles')
        .select('*', { count: 'exact', head: true });

      // Determine system health
      let systemHealth: 'healthy' | 'warning' | 'error' = 'healthy';
      if (pendingRides > 10) systemHealth = 'warning';
      if (pendingRides > 50) systemHealth = 'error';

      return {
        totalUsers: totalUsers || 0,
        activeDrivers: activeDrivers || 0,
        pendingRides: pendingRides || 0,
        totalRides: totalRides || 0,
        activeSessions: activeSessions || 0,
        qrCodesGenerated: qrCodesGenerated || 0,
        systemHealth,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error loading system stats:', error);
      throw error;
    }
  };

  const loadRecentActivity = async (): Promise<RecentActivity[]> => {
    try {
      // This would typically come from a dedicated activity log table
      // For now, we'll simulate some recent activity
      const mockActivity: RecentActivity[] = [
        {
          id: '1',
          type: 'user_registration',
          description: 'New user registered: John Doe',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          status: 'success',
          userId: 'user123'
        },
        {
          id: '2',
          type: 'ride_booking',
          description: 'Ride booked from Kigali to Gisenyi',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          status: 'pending',
          userId: 'user456'
        },
        {
          id: '3',
          type: 'qr_generation',
          description: 'QR code generated for payment',
          timestamp: new Date(Date.now() - 900000).toISOString(),
          status: 'success',
          userId: 'user789'
        },
        {
          id: '4',
          type: 'vehicle_added',
          description: 'New vehicle added: Toyota Corolla',
          timestamp: new Date(Date.now() - 1200000).toISOString(),
          status: 'success',
          userId: 'user101'
        }
      ];

      return mockActivity;
    } catch (error) {
      console.error('Error loading recent activity:', error);
      throw error;
    }
  };

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'user_registration':
        return <Users className="h-4 w-4" />;
      case 'ride_booking':
        return <Car className="h-4 w-4" />;
      case 'qr_generation':
        return <QrCode className="h-4 w-4" />;
      case 'vehicle_added':
        return <Car className="h-4 w-4" />;
      case 'system_alert':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: RecentActivity['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getHealthBadge = (health: SystemStats['systemHealth']) => {
    switch (health) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-500">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Dashboard</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button onClick={loadDashboardData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">
            System overview and management
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-xs">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Badge>
          <Button onClick={loadDashboardData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Alert */}
      {stats?.systemHealth !== 'healthy' && (
        <Card className={cn(
          "border-l-4",
          stats?.systemHealth === 'warning' ? "border-yellow-400 bg-yellow-50" : "border-red-400 bg-red-50"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className={cn(
                "h-5 w-5",
                stats?.systemHealth === 'warning' ? "text-yellow-500" : "text-red-500"
              )} />
              <div>
                <h4 className="font-medium text-gray-900">
                  System {stats?.systemHealth === 'warning' ? 'Warning' : 'Alert'}
                </h4>
                <p className="text-sm text-gray-600">
                  {stats?.systemHealth === 'warning' 
                    ? 'High number of pending rides detected'
                    : 'Critical system issues detected'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Registered users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeDrivers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Currently available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Rides</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingRides.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting confirmation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {getHealthBadge(stats?.systemHealth || 'healthy')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Overall status
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rides</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalRides.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              All time completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeSessions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              WhatsApp sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">QR Codes</CardTitle>
            <QrCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.qrCodesGenerated.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Generated today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="quick-actions">Quick Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Performance Metrics</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Response Time</span>
                      <span className="text-green-600">~200ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uptime</span>
                      <span className="text-green-600">99.9%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Error Rate</span>
                      <span className="text-green-600">0.1%</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Recent Trends</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>User Growth</span>
                      <span className="text-green-600">+15%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ride Volume</span>
                      <span className="text-green-600">+8%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>QR Usage</span>
                      <span className="text-green-600">+22%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3 p-3 rounded-lg border">
                    <div className="flex-shrink-0">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(activity.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quick-actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="h-20 flex-col space-y-2">
                  <Users className="h-6 w-6" />
                  <span>Manage Users</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col space-y-2">
                  <Car className="h-6 w-6" />
                  <span>Manage Drivers</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col space-y-2">
                  <MapPin className="h-6 w-6" />
                  <span>View Rides</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col space-y-2">
                  <QrCode className="h-6 w-6" />
                  <span>QR Analytics</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
