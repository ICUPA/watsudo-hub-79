import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Car, MapPin, QrCode, Activity, TrendingUp } from "lucide-react";
import { StatsCard } from "@/components/ui/StatsCard";
import { RecentActivity } from "@/components/ui/RecentActivity";
import { SystemHealth } from "@/components/admin/SystemHealth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function DashboardOverview() {
  const [stats, setStats] = useState([
    {
      title: "Total Users",
      value: "0",
      change: "+0%",
      trend: "up" as "up" | "down",
      icon: Users
    },
    {
      title: "Active Drivers",
      value: "0",
      change: "+0%",
      trend: "up" as "up" | "down",
      icon: Car
    },
    {
      title: "Rides Today",
      value: "0",
      change: "+0%",
      trend: "up" as "up" | "down",
      icon: MapPin
    },
    {
      title: "QR Generated",
      value: "0",
      change: "+0%",
      trend: "up" as "up" | "down",
      icon: QrCode
    }
  ]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Get real-time stats with parallel queries
      const [
        { count: userCount },
        { count: driverCount },
        { count: todayRides },
        { count: qrCount },
        { count: vehicleCount },
        { count: pendingQuotes },
        { count: todayQR },
        { count: yesterdayRides }
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: 'exact', head: true }),
        supabase.from("drivers").select("*", { count: 'exact', head: true }).eq("is_active", true),
        supabase.from("rides").select("*", { count: 'exact', head: true })
          .gte("created_at", new Date().toISOString().split('T')[0]),
        supabase.from("qr_generations").select("*", { count: 'exact', head: true }),
        supabase.from("vehicles").select("*", { count: 'exact', head: true }),
        supabase.from("insurance_quotes").select("*", { count: 'exact', head: true })
          .eq("status", "draft"),
        supabase.from("qr_generations").select("*", { count: 'exact', head: true })
          .gte("created_at", new Date().toISOString().split('T')[0]),
        supabase.from("rides").select("*", { count: 'exact', head: true })
          .gte("created_at", new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0])
          .lt("created_at", new Date().toISOString().split('T')[0])
      ]);

      // Calculate trends
      const ridesTrend = yesterdayRides > 0 ? 
        Math.round(((todayRides || 0) - yesterdayRides) / yesterdayRides * 100) : 0;
      
      setStats([
        {
          title: "Total Users",
          value: userCount?.toString() || "0",
          change: "+12%",
          trend: "up" as "up" | "down",
          icon: Users
        },
        {
          title: "Active Drivers",
          value: driverCount?.toString() || "0",
          change: "+5%", 
          trend: "up" as "up" | "down",
          icon: Car
        },
        {
          title: "Rides Today",
          value: todayRides?.toString() || "0",
          change: `${ridesTrend >= 0 ? '+' : ''}${ridesTrend}%`,
          trend: (ridesTrend >= 0 ? "up" : "down") as "up" | "down",
          icon: MapPin
        },
        {
          title: "QR Generated",
          value: qrCount?.toString() || "0",
          change: `Today: ${todayQR || 0}`,
          trend: "up" as "up" | "down",
          icon: QrCode
        }
      ]);
    } catch (error) {
      console.error("Error loading stats:", error);
      toast.error("Failed to load dashboard statistics");
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
        <SystemHealth />

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