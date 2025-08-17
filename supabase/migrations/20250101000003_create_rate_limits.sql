-- Create rate_limits table for abuse prevention
-- This table implements token bucket rate limiting per user and globally

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- 'user:123' or 'global:whatsapp'
  bucket_type TEXT NOT NULL, -- 'whatsapp', 'ocr', 'qr', 'api'
  tokens_remaining INTEGER NOT NULL DEFAULT 100,
  last_refill TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  refill_rate INTEGER NOT NULL DEFAULT 100, -- tokens per refill
  refill_interval_ms BIGINT NOT NULL DEFAULT 60000, -- refill every minute
  max_tokens INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on identifier + bucket_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_identifier_bucket 
ON public.rate_limits(identifier, bucket_type);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_last_refill ON public.rate_limits(last_refill);
CREATE INDEX IF NOT EXISTS idx_rate_limits_bucket_type ON public.rate_limits(bucket_type);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Service can manage all rate limits"
ON public.rate_limits
FOR ALL
USING (auth.role() = 'service_role');

-- Create function to check and consume rate limit tokens
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_bucket_type TEXT,
  p_tokens_required INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_record RECORD;
  v_now TIMESTAMP WITH TIME ZONE := now();
  v_tokens_to_add INTEGER;
  v_new_tokens INTEGER;
BEGIN
  -- Get or create rate limit record
  SELECT * INTO v_record 
  FROM public.rate_limits 
  WHERE identifier = p_identifier AND bucket_type = p_bucket_type;
  
  IF NOT FOUND THEN
    -- Create new rate limit record
    INSERT INTO public.rate_limits (identifier, bucket_type, tokens_remaining, last_refill)
    VALUES (p_identifier, p_bucket_type, 100, v_now)
    RETURNING * INTO v_record;
  END IF;
  
  -- Calculate tokens to add based on time passed
  v_tokens_to_add := FLOOR(
    EXTRACT(EPOCH FROM (v_now - v_record.last_refill)) * 1000 / v_record.refill_interval_ms
  ) * v_record.refill_rate;
  
  -- Calculate new token count (capped at max_tokens)
  v_new_tokens := LEAST(
    v_record.tokens_remaining + v_tokens_to_add,
    v_record.max_tokens
  );
  
  -- Check if we have enough tokens
  IF v_new_tokens < p_tokens_required THEN
    RETURN FALSE; -- Rate limited
  END IF;
  
  -- Consume tokens and update record
  UPDATE public.rate_limits 
  SET 
    tokens_remaining = v_new_tokens - p_tokens_required,
    last_refill = v_now,
    updated_at = v_now
  WHERE id = v_record.id;
  
  RETURN TRUE; -- Allowed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get rate limit status
CREATE OR REPLACE FUNCTION public.get_rate_limit_status(
  p_identifier TEXT,
  p_bucket_type TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_record RECORD;
  v_now TIMESTAMP WITH TIME ZONE := now();
  v_tokens_to_add INTEGER;
  v_new_tokens INTEGER;
BEGIN
  SELECT * INTO v_record 
  FROM public.rate_limits 
  WHERE identifier = p_identifier AND bucket_type = p_bucket_type;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'identifier', p_identifier,
      'bucket_type', p_bucket_type,
      'tokens_remaining', 100,
      'max_tokens', 100,
      'refill_rate', 100,
      'refill_interval_ms', 60000,
      'last_refill', v_now,
      'next_refill', v_now + interval '1 minute'
    );
  END IF;
  
  -- Calculate tokens to add based on time passed
  v_tokens_to_add := FLOOR(
    EXTRACT(EPOCH FROM (v_now - v_record.last_refill)) * 1000 / v_record.refill_interval_ms
  ) * v_record.refill_rate;
  
  -- Calculate new token count (capped at max_tokens)
  v_new_tokens := LEAST(
    v_record.tokens_remaining + v_tokens_to_add,
    v_record.max_tokens
  );
  
  RETURN jsonb_build_object(
    'identifier', v_record.identifier,
    'bucket_type', v_record.bucket_type,
    'tokens_remaining', v_new_tokens,
    'max_tokens', v_record.max_tokens,
    'refill_rate', v_record.refill_rate,
    'refill_interval_ms', v_record.refill_interval_ms,
    'last_refill', v_record.last_refill,
    'next_refill', v_record.last_refill + (v_record.refill_interval_ms || ' milliseconds')::interval
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_rate_limit_status(TEXT, TEXT) TO service_role;

-- Insert default rate limit configurations
INSERT INTO public.rate_limits (identifier, bucket_type, tokens_remaining, refill_rate, refill_interval_ms, max_tokens) VALUES
  ('global:whatsapp', 'whatsapp', 1000, 1000, 60000, 1000), -- 1000 messages per minute globally
  ('global:ocr', 'ocr', 100, 100, 60000, 100), -- 100 OCR requests per minute globally
  ('global:qr', 'qr', 500, 500, 60000, 500), -- 500 QR generations per minute globally
  ('global:api', 'api', 2000, 2000, 60000, 2000) -- 2000 API calls per minute globally
ON CONFLICT (identifier, bucket_type) DO NOTHING;
