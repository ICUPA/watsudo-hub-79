import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Database, Server, Wifi, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'checking';
  message: string;
  lastCheck: Date;
  icon: React.ComponentType<{ className?: string }>;
}

export function SystemHealth() {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([
    {
      name: "Database",
      status: 'checking',
      message: "Checking connection...",
      lastCheck: new Date(),
      icon: Database
    },
    {
      name: "WhatsApp API",
      status: 'checking', 
      message: "Checking webhook...",
      lastCheck: new Date(),
      icon: Wifi
    },
    {
      name: "Storage",
      status: 'checking',
      message: "Checking buckets...",
      lastCheck: new Date(),
      icon: Server
    },
    {
      name: "Edge Functions",
      status: 'checking',
      message: "Checking functions...",
      lastCheck: new Date(),
      icon: Activity
    }
  ]);

  useEffect(() => {
    checkSystemHealth();
    const interval = setInterval(checkSystemHealth, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const checkSystemHealth = async () => {
    const checks = [...healthChecks];

    // Check Database
    try {
      const { error } = await supabase.from("profiles").select("id").limit(1);
      checks[0] = {
        ...checks[0],
        status: error ? 'error' : 'healthy',
        message: error ? error.message : "Database connected",
        lastCheck: new Date()
      };
    } catch (error) {
      checks[0] = {
        ...checks[0],
        status: 'error',
        message: "Database connection failed",
        lastCheck: new Date()
      };
    }

    // Check WhatsApp API (via edge function ping)
    try {
      const { error } = await supabase.functions.invoke('whatsapp', {
        body: { ping: true }
      });
      checks[1] = {
        ...checks[1],
        status: error ? 'warning' : 'healthy',
        message: error ? "Webhook may be down" : "Webhook responding",
        lastCheck: new Date()
      };
    } catch (error) {
      checks[1] = {
        ...checks[1],
        status: 'warning',
        message: "Cannot reach webhook",
        lastCheck: new Date()
      };
    }

    // Check Storage
    try {
      const { data, error } = await supabase.storage.listBuckets();
      checks[2] = {
        ...checks[2],
        status: error ? 'error' : 'healthy',
        message: error ? error.message : `${data?.length || 0} buckets available`,
        lastCheck: new Date()
      };
    } catch (error) {
      checks[2] = {
        ...checks[2],
        status: 'error',
        message: "Storage unavailable",
        lastCheck: new Date()
      };
    }

    // Check Edge Functions
    try {
      const { error } = await supabase.functions.invoke('whatsapp', {
        body: { health: true }
      });
      checks[3] = {
        ...checks[3],
        status: error ? 'warning' : 'healthy',
        message: error ? "Some functions may be down" : "Functions operational",
        lastCheck: new Date()
      };
    } catch (error) {
      checks[3] = {
        ...checks[3],
        status: 'warning',
        message: "Edge functions unreachable",
        lastCheck: new Date()
      };
    }

    setHealthChecks(checks);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-success';
      case 'warning': return 'text-warning';
      case 'error': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return CheckCircle;
      case 'warning': 
      case 'error': return AlertCircle;
      default: return Activity;
    }
  };

  const overallStatus = healthChecks.every(check => check.status === 'healthy') ? 'healthy' :
    healthChecks.some(check => check.status === 'error') ? 'error' : 'warning';

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={overallStatus === 'healthy' ? 'default' : 'destructive'}>
              {overallStatus === 'healthy' ? 'All Systems Operational' : 
               overallStatus === 'error' ? 'Issues Detected' : 'Some Warnings'}
            </Badge>
            <Button variant="outline" size="sm" onClick={checkSystemHealth}>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {healthChecks.map((check) => {
            const StatusIcon = getStatusIcon(check.status);
            const ServiceIcon = check.icon;
            
            return (
              <div key={check.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ServiceIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{check.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {check.message}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon className={`h-4 w-4 ${getStatusColor(check.status)}`} />
                  <div className="text-xs text-muted-foreground">
                    {check.lastCheck.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}