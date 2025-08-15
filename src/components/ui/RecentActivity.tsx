import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, Car, QrCode, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ActivityItem {
  id: string;
  type: 'vehicle_added' | 'ride_created' | 'qr_generated' | 'quote_created';
  description: string;
  timestamp: string;
  status?: string;
}

export function RecentActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentActivity();
  }, []);

  const loadRecentActivity = async () => {
    try {
      setLoading(true);
      
      // Get recent activities from multiple tables
      const [vehicles, rides, qrs, quotes] = await Promise.all([
        supabase.from("vehicles").select("id, plate, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("rides").select("id, status, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("qr_generations").select("id, amount, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("insurance_quotes").select("id, status, created_at").order("created_at", { ascending: false }).limit(5)
      ]);

      const activities: ActivityItem[] = [];

      // Add vehicle activities
      vehicles.data?.forEach(vehicle => {
        activities.push({
          id: `vehicle_${vehicle.id}`,
          type: 'vehicle_added',
          description: `Vehicle ${vehicle.plate || 'Unknown'} added`,
          timestamp: vehicle.created_at
        });
      });

      // Add ride activities
      rides.data?.forEach(ride => {
        activities.push({
          id: `ride_${ride.id}`,
          type: 'ride_created',
          description: `New ride created`,
          timestamp: ride.created_at,
          status: ride.status
        });
      });

      // Add QR activities
      qrs.data?.forEach(qr => {
        activities.push({
          id: `qr_${qr.id}`,
          type: 'qr_generated',
          description: `QR code generated${qr.amount ? ` for ${qr.amount} RWF` : ''}`,
          timestamp: qr.created_at
        });
      });

      // Add quote activities
      quotes.data?.forEach(quote => {
        activities.push({
          id: `quote_${quote.id}`,
          type: 'quote_created',
          description: `Insurance quote created`,
          timestamp: quote.created_at,
          status: quote.status
        });
      });

      // Sort by timestamp and limit to 10
      const sortedActivities = activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      setActivities(sortedActivities);
    } catch (error) {
      console.error("Error loading recent activity:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'vehicle_added': return <Car className="h-4 w-4" />;
      case 'ride_created': return <Activity className="h-4 w-4" />;
      case 'qr_generated': return <QrCode className="h-4 w-4" />;
      case 'quote_created': return <FileText className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    
    const variants: Record<string, string> = {
      pending: "default",
      confirmed: "default",
      completed: "default",
      cancelled: "destructive",
      draft: "secondary",
      quoted: "default",
      paid: "default",
      issued: "default"
    };

    return (
      <Badge variant={variants[status] as any || "default"} className="text-xs">
        {status}
      </Badge>
    );
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading recent activity...
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No recent activity
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">
                      {activity.description}
                    </p>
                    {getStatusBadge(activity.status)}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}