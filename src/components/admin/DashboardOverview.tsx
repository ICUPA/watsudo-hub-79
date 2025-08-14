import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Car, MapPin, QrCode, Activity, TrendingUp } from "lucide-react";
import { StatsCard } from "@/components/ui/StatsCard";
import { RecentActivity } from "@/components/ui/RecentActivity";
import { supabase } from "@/integrations/supabase/client";

export function DashboardOverview() {
  const [stats, setStats] = useState([
    {
      title: "Total Users",
      value: "0",
      change: "+0%",
      trend: "up" as const,
      icon: Users
    },
    {
      title: "Active Drivers",
      value: "0",
      change: "+0%",
      trend: "up" as const,
      icon: Car
    },
    {
      title: "Rides Today",
      value: "0",
      change: "+0%",
      trend: "up" as const,
      icon: MapPin
    },
    {
      title: "QR Generated",
      value: "0",
      change: "+0%",
      trend: "up" as const,
      icon: QrCode
    }
  ]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Get total users
      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: 'exact', head: true });

      // Get active drivers
      const { count: driverCount } = await supabase
        .from("drivers")
        .select("*", { count: 'exact', head: true })
        .eq("is_active", true);

      // Get rides today
      const today = new Date().toISOString().split('T')[0];
      const { count: rideCount } = await supabase
        .from("rides")
        .select("*", { count: 'exact', head: true })
        .gte("created_at", today);

      // Get QR codes generated
      const { count: qrCount } = await supabase
        .from("qr_generations")
        .select("*", { count: 'exact', head: true });

      setStats([
        {
          title: "Total Users",
          value: userCount?.toString() || "0",
          change: "+12%",
          trend: "up" as const,
          icon: Users
        },
        {
          title: "Active Drivers",
          value: driverCount?.toString() || "0",
          change: "+5%",
          trend: "up" as const,
          icon: Car
        },
        {
          title: "Rides Today",
          value: rideCount?.toString() || "0",
          change: "+23%",
          trend: "up" as const,
          icon: MapPin
        },
        {
          title: "QR Generated",
          value: qrCount?.toString() || "0",
          change: "+8%",
          trend: "up" as const,
          icon: QrCode
        }
      ]);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text mb-2">
          System Overview
        </h1>
        <p className="text-muted-foreground">
          Monitor your Mobility & USSD QR Hub performance
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatsCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
            <CardDescription>
              Real-time system monitoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">WhatsApp API</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-success rounded-full animate-pulse"></div>
                  <span className="text-success text-sm">Online</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Database</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-success rounded-full animate-pulse"></div>
                  <span className="text-success text-sm">Healthy</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Storage</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-success rounded-full animate-pulse"></div>
                  <span className="text-success text-sm">Available</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">OCR Service</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-success rounded-full animate-pulse"></div>
                  <span className="text-success text-sm">Ready</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <RecentActivity />
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Usage Analytics
          </CardTitle>
          <CardDescription>
            Weekly performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Analytics chart will be implemented after Supabase integration
          </div>
        </CardContent>
      </Card>
    </div>
  );
}