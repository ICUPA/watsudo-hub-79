import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MaintenanceTask {
  name: string;
  description: string;
  execute: () => Promise<void>;
}

class MaintenanceWorker {
  private supabase: any;
  private logger: any;

  constructor() {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    this.logger = {
      info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data || ""),
      warn: (message: string, data?: any) => console.warn(`[WARN] ${message}`, data || ""),
      error: (message: string, data?: any) => console.error(`[ERROR] ${message}`, data || ""),
    };
  }

  // Clean up old WhatsApp logs (older than 90 days)
  private async cleanupWhatsAppLogs(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const { data, error } = await this.supabase
        .from("whatsapp_logs")
        .delete()
        .lt("created_at", cutoffDate.toISOString())
        .select("id");

      if (error) {
        throw error;
      }

      const deletedCount = data?.length || 0;
      this.logger.info(`Cleaned up ${deletedCount} old WhatsApp logs`);

      // Record metric
      await this.supabase.rpc("increment_metric", {
        p_metric_name: "maintenance.whatsapp_logs_cleaned",
        p_increment: deletedCount,
        p_labels: { "task": "cleanup_whatsapp_logs" }
      });
    } catch (error) {
      this.logger.error("Failed to cleanup WhatsApp logs", { error: error.message });
      throw error;
    }
  }

  // Clean up old OCR jobs (older than 30 days)
  private async cleanupOldOCRJobs(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      const { data, error } = await this.supabase
        .from("vehicle_ocr_jobs")
        .delete()
        .lt("created_at", cutoffDate.toISOString())
        .in("status", ["completed", "failed"])
        .select("id");

      if (error) {
        throw error;
      }

      const deletedCount = data?.length || 0;
      this.logger.info(`Cleaned up ${deletedCount} old OCR jobs`);

      // Record metric
      await this.supabase.rpc("increment_metric", {
        p_metric_name: "maintenance.ocr_jobs_cleaned",
        p_increment: deletedCount,
        p_labels: { "task": "cleanup_ocr_jobs" }
      });
    } catch (error) {
      this.logger.error("Failed to cleanup old OCR jobs", { error: error.message });
      throw error;
    }
  }

  // Clean up old system metrics (older than 7 days)
  private async cleanupOldMetrics(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);

      const { data, error } = await this.supabase
        .from("system_metrics")
        .delete()
        .lt("timestamp", cutoffDate.toISOString())
        .select("id");

      if (error) {
        throw error {
          throw error;
        }
      }

      const deletedCount = data?.length || 0;
      this.logger.info(`Cleaned up ${deletedCount} old system metrics`);

      // Record metric
      await this.supabase.rpc("increment_metric", {
        p_metric_name: "maintenance.metrics_cleaned",
        p_increment: deletedCount,
        p_labels: { "task": "cleanup_metrics" }
      });
    } catch (error) {
      this.logger.error("Failed to cleanup old metrics", { error: error.message });
      throw error;
    }
  }

  // Clean up old rate limit records (older than 1 day)
  private async cleanupOldRateLimits(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 1);

      const { data, error } = await this.supabase
        .from("rate_limits")
        .delete()
        .lt("updated_at", cutoffDate.toISOString())
        .neq("identifier", "global:whatsapp") // Keep global limits
        .neq("identifier", "global:ocr")
        .neq("identifier", "global:qr")
        .neq("identifier", "global:api")
        .select("id");

      if (error) {
        throw error;
      }

      const deletedCount = data?.length || 0;
      this.logger.info(`Cleaned up ${deletedCount} old rate limit records`);

      // Record metric
      await this.supabase.rpc("increment_metric", {
        p_metric_name: "maintenance.rate_limits_cleaned",
        p_increment: deletedCount,
        p_labels: { "task": "cleanup_rate_limits" }
      });
    } catch (error) {
      this.logger.error("Failed to cleanup old rate limits", { error: error.message });
      throw error;
    }
  }

  // Clean up old inbound events (older than 7 days)
  private async cleanupOldInboundEvents(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);

      const { data, error } = await this.supabase
        .from("inbound_events")
        .delete()
        .lt("created_at", cutoffDate.toISOString())
        .select("id");

      if (error) {
        throw error;
      }

      const deletedCount = data?.length || 0;
      this.logger.info(`Cleaned up ${deletedCount} old inbound events`);

      // Record metric
      await this.supabase.rpc("increment_metric", {
        p_metric_name: "maintenance.inbound_events_cleaned",
        p_increment: deletedCount,
        p_labels: { "task": "cleanup_inbound_events" }
      });
    } catch (error) {
      this.logger.error("Failed to cleanup old inbound events", { error: error.message });
      throw error;
    }
  }

  // Update system uptime metric
  private async updateSystemUptime(): Promise<void> {
    try {
      const startTime = new Date("2025-01-01T00:00:00Z"); // System start time
      const uptimeSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000);

      await this.supabase.rpc("set_gauge_metric", {
        p_metric_name: "system.uptime_seconds",
        p_value: uptimeSeconds,
        p_unit: "seconds",
        p_labels: { "component": "maintenance_worker" }
      });

      this.logger.info(`Updated system uptime: ${uptimeSeconds} seconds`);
    } catch (error) {
      this.logger.error("Failed to update system uptime", { error: error.message });
      // Don't throw for uptime updates
    }
  }

  // Get maintenance tasks
  private getMaintenanceTasks(): MaintenanceTask[] {
    return [
      {
        name: "cleanup_whatsapp_logs",
        description: "Clean up WhatsApp logs older than 90 days",
        execute: () => this.cleanupWhatsAppLogs()
      },
      {
        name: "cleanup_ocr_jobs",
        description: "Clean up completed/failed OCR jobs older than 30 days",
        execute: () => this.cleanupOldOCRJobs()
      },
      {
        name: "cleanup_metrics",
        description: "Clean up system metrics older than 7 days",
        execute: () => this.cleanupOldMetrics()
      },
      {
        name: "cleanup_rate_limits",
        description: "Clean up old rate limit records older than 1 day",
        execute: () => this.cleanupOldRateLimits()
      },
      {
        name: "cleanup_inbound_events",
        description: "Clean up old inbound events older than 7 days",
        execute: () => this.cleanupOldInboundEvents()
      },
      {
        name: "update_uptime",
        description: "Update system uptime metric",
        execute: () => this.updateSystemUptime()
      }
    ];
  }

  // Execute all maintenance tasks
  async executeMaintenance(): Promise<{ success: boolean; results: any[] }> {
    const startTime = Date.now();
    const tasks = this.getMaintenanceTasks();
    const results: any[] = [];

    this.logger.info(`Starting maintenance with ${tasks.length} tasks`);

    for (const task of tasks) {
      const taskStartTime = Date.now();
      try {
        await task.execute();
        const duration = Date.now() - taskStartTime;
        
        results.push({
          name: task.name,
          description: task.description,
          status: "success",
          duration_ms: duration
        });

        this.logger.info(`Task completed: ${task.name}`, { duration_ms: duration });
      } catch (error) {
        const duration = Date.now() - taskStartTime;
        
        results.push({
          name: task.name,
          description: task.description,
          status: "failed",
          error: error.message,
          duration_ms: duration
        });

        this.logger.error(`Task failed: ${task.name}`, { error: error.message, duration_ms: duration });
      }
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.status === "success").length;
    const failureCount = results.filter(r => r.status === "failed").length;

    this.logger.info(`Maintenance completed`, {
      total_duration_ms: totalDuration,
      success_count: successCount,
      failure_count: failureCount
    });

    // Record maintenance metrics
    await this.supabase.rpc("increment_metric", {
      p_metric_name: "maintenance.executions",
      p_increment: 1,
      p_labels: { "status": failureCount === 0 ? "success" : "partial" }
    });

    await this.supabase.rpc("record_histogram_metric", {
      p_metric_name: "maintenance.duration_ms",
      p_value: totalDuration,
      p_unit: "ms",
      p_labels: { "worker": "maintenance_worker" }
    });

    return {
      success: failureCount === 0,
      results
    };
  }
}

// Health check handler
async function handleHealthCheck(): Promise<Response> {
  return new Response(
    JSON.stringify({
      ok: true,
      service: "maintenance_worker",
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

    // Manual maintenance trigger (POST)
    if (req.method === "POST") {
      const worker = new MaintenanceWorker();
      const result = await worker.executeMaintenance();

      return new Response(
        JSON.stringify({
          ok: result.success,
          message: result.success ? "Maintenance completed successfully" : "Maintenance completed with errors",
          results: result.results,
          timestamp: new Date().toISOString()
        }),
        {
          status: result.success ? 200 : 207, // 207 Multi-Status for partial success
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
        message: "Maintenance Worker - Use POST to trigger maintenance or GET /health for health check",
        endpoints: {
          "GET /health": "Health check",
          "POST /": "Trigger maintenance"
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
    console.error("Maintenance worker error:", error);
    
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
