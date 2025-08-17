-- Create system_metrics table for performance monitoring
-- This table tracks system performance, health, and business metrics

CREATE TABLE IF NOT EXISTS public.system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_unit TEXT, -- 'count', 'ms', 'percentage', 'bytes'
  metric_type TEXT NOT NULL, -- 'counter', 'gauge', 'histogram'
  labels JSONB DEFAULT '{}', -- Additional context like user_id, function_name, etc.
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_metrics_metric_name ON public.system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON public.system_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_metrics_metric_type ON public.system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_labels ON public.system_metrics USING GIN(labels);

-- Enable RLS
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Service can manage all system metrics"
ON public.system_metrics
FOR ALL
USING (auth.role() = 'service_role');

-- Create function to increment a counter metric
CREATE OR REPLACE FUNCTION public.increment_metric(
  p_metric_name TEXT,
  p_increment NUMERIC DEFAULT 1,
  p_labels JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.system_metrics (metric_name, metric_value, metric_unit, metric_type, labels)
  VALUES (p_metric_name, p_increment, 'count', 'counter', p_labels);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to set a gauge metric
CREATE OR REPLACE FUNCTION public.set_gauge_metric(
  p_metric_name TEXT,
  p_value NUMERIC,
  p_unit TEXT DEFAULT 'count',
  p_labels JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.system_metrics (metric_name, metric_value, metric_unit, metric_type, labels)
  VALUES (p_metric_name, p_value, p_unit, 'gauge', p_labels);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to record a histogram metric
CREATE OR REPLACE FUNCTION public.record_histogram_metric(
  p_metric_name TEXT,
  p_value NUMERIC,
  p_unit TEXT DEFAULT 'ms',
  p_labels JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.system_metrics (metric_name, metric_value, metric_unit, metric_type, labels)
  VALUES (p_metric_name, p_value, p_unit, 'histogram', p_labels);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get metric summary
CREATE OR REPLACE FUNCTION public.get_metric_summary(
  p_metric_name TEXT,
  p_since TIMESTAMP WITH TIME ZONE DEFAULT now() - interval '1 hour'
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'metric_name', p_metric_name,
    'since', p_since,
    'count', COUNT(*),
    'sum', COALESCE(SUM(metric_value), 0),
    'avg', COALESCE(AVG(metric_value), 0),
    'min', COALESCE(MIN(metric_value), 0),
    'max', COALESCE(MAX(metric_value), 0),
    'latest', COALESCE(MAX(timestamp), p_since)
  ) INTO v_result
  FROM public.system_metrics
  WHERE metric_name = p_metric_name 
    AND timestamp >= p_since;
  
  RETURN COALESCE(v_result, jsonb_build_object(
    'metric_name', p_metric_name,
    'since', p_since,
    'count', 0,
    'sum', 0,
    'avg', 0,
    'min', 0,
    'max', 0,
    'latest', p_since
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get metrics by type
CREATE OR REPLACE FUNCTION public.get_metrics_by_type(
  p_metric_type TEXT,
  p_since TIMESTAMP WITH TIME ZONE DEFAULT now() - interval '1 hour'
)
RETURNS TABLE(
  metric_name TEXT,
  metric_value NUMERIC,
  metric_unit TEXT,
  labels JSONB,
  timestamp TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sm.metric_name,
    sm.metric_value,
    sm.metric_unit,
    sm.labels,
    sm.timestamp
  FROM public.system_metrics sm
  WHERE sm.metric_type = p_metric_type 
    AND sm.timestamp >= p_since
  ORDER BY sm.timestamp DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_metric(TEXT, NUMERIC, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_gauge_metric(TEXT, NUMERIC, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_histogram_metric(TEXT, NUMERIC, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_metric_summary(TEXT, TIMESTAMP WITH TIME ZONE) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_metrics_by_type(TEXT, TIMESTAMP WITH TIME ZONE) TO service_role;

-- Insert initial system metrics
INSERT INTO public.system_metrics (metric_name, metric_value, metric_unit, metric_type, labels) VALUES
  ('system.startup', 1, 'count', 'counter', '{"component": "database"}'),
  ('system.uptime_seconds', 0, 'seconds', 'gauge', '{"component": "database"}'),
  ('whatsapp.messages_received', 0, 'count', 'counter', '{"direction": "inbound"}'),
  ('whatsapp.messages_sent', 0, 'count', 'counter', '{"direction": "outbound"}'),
  ('ocr.jobs_processed', 0, 'count', 'counter', '{"status": "success"}'),
  ('ocr.jobs_failed', 0, 'count', 'counter', '{"status": "failed"}'),
  ('qr.codes_generated', 0, 'count', 'counter', '{"status": "success"}'),
  ('api.response_time_ms', 0, 'ms', 'histogram', '{"endpoint": "webhook"}')
ON CONFLICT DO NOTHING;
