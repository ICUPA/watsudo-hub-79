-- Create inbound_events table for idempotency tracking
-- This table prevents duplicate processing of WhatsApp messages

CREATE TABLE IF NOT EXISTS public.inbound_events (
  id BIGSERIAL PRIMARY KEY,
  wa_message_id TEXT NOT NULL UNIQUE,
  from_phone TEXT NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inbound_events_wa_message_id ON public.inbound_events(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_inbound_events_from_phone ON public.inbound_events(from_phone);
CREATE INDEX IF NOT EXISTS idx_inbound_events_created_at ON public.inbound_events(created_at);

-- Enable RLS
ALTER TABLE public.inbound_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Service can manage all inbound events"
ON public.inbound_events
FOR ALL
USING (auth.role() = 'service_role');

-- Create function to check and insert idempotently
CREATE OR REPLACE FUNCTION public.check_and_insert_inbound_event(
  p_wa_message_id TEXT,
  p_from_phone TEXT,
  p_type TEXT,
  p_payload JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Try to insert the event
  INSERT INTO public.inbound_events (wa_message_id, from_phone, type, payload)
  VALUES (p_wa_message_id, p_from_phone, p_type, p_payload)
  ON CONFLICT (wa_message_id) DO NOTHING;
  
  -- Return true if this was a new event (not a duplicate)
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_and_insert_inbound_event(TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_insert_inbound_event(TEXT, TEXT, TEXT, JSONB) TO service_role;
