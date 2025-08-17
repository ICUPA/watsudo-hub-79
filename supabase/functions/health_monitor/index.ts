import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  details?: any;
  error?: string;
}

interface SystemHealth {
  overall: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

class HealthMonitor {
  private supabase: any;
  private logger: any;

  constructor() {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    this.logger = {
      info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data || ""),
      warn: (message: string, data?: any) => console.warn(`[WARN] ${message}`, data || ""),
      error: (message: string, data?: string) => console.error(`[ERROR] ${message}`, data || ""),
    };
  }

  // Check database connectivity
  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    try {
      const { data, error } = await this.supabase
        .from("system_metrics")
        .select("count(*)")
        .limit(1);

      if (error) throw error;

      const responseTime = Date.now() - startTime;
      return {
        name: "database",
        status: "healthy",
        responseTime,
        details: { record_count: data?.[0]?.count || 0 }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: "database",
        status: "unhealthy",
        responseTime,
        error: error.message
      };
    }
  }

  // Check WhatsApp webhook status
  private async checkWhatsAppWebhook(): Promise<HealthCheck> {
    const startTime = Date.now();
    try {
      // Check recent WhatsApp logs
      const { data, error } = await this.supabase
        .from("whatsapp_logs")
        .select("created_at, status")
        .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const responseTime = Date.now() - startTime;
      const recentMessages = data?.length || 0;
      const failedMessages = data?.filter((log: any) => log.status === "failed").length || 0;
      const failureRate = recentMessages > 0 ? (failedMessages / recentMessages) * 100 : 0;

      let status: "healthy" | "degraded" | "unhealthy" = "healthy";
      if (failureRate > 20) status = "unhealthy";
      else if (failureRate > 5) status = "degraded";

      return {
        name: "whatsapp_webhook",
        status,
        responseTime,
        details: {
          recent_messages: recentMessages,
          failed_messages: failedMessages,
          failure_rate: failureRate.toFixed(2) + "%"
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: "whatsapp_webhook",
        status: "unhealthy",
        responseTime,
        error: error.message
      };
    }
  }

  // Check OCR worker status
  private async checkOCRWorker(): Promise<HealthCheck> {
    const startTime = Date.now();
    try {
      // Check recent OCR jobs
      const { data, error } = await this.supabase
        .from("vehicle_ocr_jobs")
        .select("status, created_at")
        .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const responseTime = Date.now() - startTime;
      const recentJobs = data?.length || 0;
      const pendingJobs = data?.filter((job: any) => job.status === "pending").length || 0;
      const failedJobs = data?.filter((job: any) => job.status === "failed").length || 0;
      const successRate = recentJobs > 0 ? ((recentJobs - failedJobs) / recentJobs) * 100 : 0;

      let status: "healthy" | "degraded" | "unhealthy" = "healthy";
      if (successRate < 80) status = "unhealthy";
      else if (successRate < 95) status = "degraded";

      return {
        name: "ocr_worker",
        status,
        responseTime,
        details: {
          recent_jobs: recentJobs,
          pending_jobs: pendingJobs,
          failed_jobs: failedJobs,
          success_rate: successRate.toFixed(2) + "%"
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: "ocr_worker",
        status: "unhealthy",
        responseTime,
        error: error.message
      };
    }
  }

  // Check system metrics
  private async checkSystemMetrics(): Promise<HealthCheck> {
    const startTime = Date.now();
    try {
      // Get system metrics summary
      const { data, error } = await this.supabase
        .from("system_metrics")
        .select("metric_name, metric_value, metric_type")
        .gte("timestamp", new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .in("metric_name", [
          "whatsapp.messages_received",
          "whatsapp.messages_sent",
          "ocr.jobs_processed",
          "ocr.jobs_failed"
        ]);

      if (error) throw error;

      const responseTime = Date.now() - startTime;
      const metrics = data?.reduce((acc: any, metric: any) => {
        acc[metric.metric_name] = metric.metric_value;
        return acc;
      }, {}) || {};

      return {
        name: "system_metrics",
        status: "healthy",
        responseTime,
        details: {
          messages_received: metrics["whatsapp.messages_received"] || 0,
          messages_sent: metrics["whatsapp.messages_sent"] || 0,
          ocr_processed: metrics["ocr.jobs_processed"] || 0,
          ocr_failed: metrics["ocr.jobs_failed"] || 0
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: "system_metrics",
        status: "unhealthy",
        responseTime,
        error: error.message
      };
    }
  }

  // Check rate limiting status
  private async checkRateLimiting(): Promise<HealthCheck> {
    const startTime = Date.now();
    try {
      // Check global rate limits
      const { data, error } = await this.supabase
        .from("rate_limits")
        .select("identifier, bucket_type, tokens_remaining, max_tokens")
        .like("identifier", "global:%");

      if (error) throw error;

      const responseTime = Date.now() - startTime;
      const rateLimits = data?.reduce((acc: any, limit: any) => {
        acc[limit.bucket_type] = {
          remaining: limit.tokens_remaining,
          max: limit.max_tokens,
          utilization: ((limit.max_tokens - limit.tokens_remaining) / limit.max_tokens * 100).toFixed(2) + "%"
        };
        return acc;
      }, {}) || {};

      return {
        name: "rate_limiting",
        status: "healthy",
        responseTime,
        details: rateLimits
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: "rate_limiting",
        status: "unhealthy",
        responseTime,
        error: error.message
      };
    }
  }

  // Check feature flags
  private async checkFeatureFlags(): Promise<HealthCheck> {
    const startTime = Date.now();
    try {
      // Check feature flags status
      const { data, error } = await this.supabase
        .from("feature_flags")
        .select("flag_name, is_enabled, rollout_percentage")
        .eq("is_enabled", true);

      if (error) throw error;

      const responseTime = Date.now() - startTime;
      const enabledFlags = data?.length || 0;
      const totalFlags = data?.length || 0;

      return {
        name: "feature_flags",
        status: "healthy",
        responseTime,
        details: {
          enabled_flags: enabledFlags,
          total_flags: totalFlags,
          flags: data?.map((flag: any) => ({
            name: flag.flag_name,
            rollout: flag.rollout_percentage + "%"
          })) || []
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: "feature_flags",
        status: "unhealthy",
        responseTime,
        error: error.message
      };
    }
  }

  // Execute all health checks
  async executeHealthChecks(): Promise<SystemHealth> {
    const startTime = Date.now();
    const checks = [
      await this.checkDatabase(),
      await this.checkWhatsAppWebhook(),
      await this.checkOCRWorker(),
      await this.checkSystemMetrics(),
      await this.checkRateLimiting(),
      await this.checkFeatureFlags()
    ];

    const totalDuration = Date.now() - startTime;
    const healthyCount = checks.filter(c => c.status === "healthy").length;
    const degradedCount = checks.filter(c => c.status === "degraded").length;
    const unhealthyCount = checks.filter(c => c.status === "unhealthy").length;

    let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (unhealthyCount > 0) overallStatus = "unhealthy";
    else if (degradedCount > 0) overallStatus = "degraded";

    // Record health check metrics
    try {
      await this.supabase.rpc("increment_metric", "health.checks_executed", 1, {
        status: overallStatus,
        total_checks: checks.length
      });

      await this.supabase.rpc("record_histogram_metric", "health.check_duration_ms", totalDuration, "ms", {
        component: "health_monitor"
      });
    } catch (error) {
      this.logger.warn("Failed to record health check metrics", error.message);
    }

    return {
      overall: overallStatus,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      checks,
      summary: {
        total: checks.length,
        healthy: healthyCount,
        degraded: degradedCount,
        unhealthy: unhealthyCount
      }
    };
  }
}

// Health check handler
async function handleHealthCheck(): Promise<Response> {
  return new Response(
    JSON.stringify({
      ok: true,
      service: "health_monitor",
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    }
  );
}

// Main handler
Deno.serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    // Health check endpoint
    if (req.method === "GET" && url.pathname.endsWith("/health")) {
      return await handleHealthCheck();
    }

    // Comprehensive health check (GET /)
    if (req.method === "GET") {
      const monitor = new HealthMonitor();
      const health = await monitor.executeHealthChecks();

      const statusCode = health.overall === "healthy" ? 200 : 
                        health.overall === "degraded" ? 200 : 503;

      return new Response(
        JSON.stringify(health),
        {
          status: statusCode,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
    }

    // Default response
    return new Response(
      JSON.stringify({
        ok: true,
        message: "Health Monitor - Use GET for health check or GET /health for service health",
        endpoints: {
          "GET /": "Comprehensive system health check",
          "GET /health": "Service health check"
        }
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      }
    );

  } catch (error) {
    console.error("Health monitor error:", error);
    
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      }
    );
  }
});
