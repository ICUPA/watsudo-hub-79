-- First check the current whatsapp_logs structure and fix it properly
-- The table appears to already have the needed columns from the error message

-- Ensure the table structure is correct
DO $$
BEGIN
  -- Check if payload column exists and add it if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'payload') THEN
    ALTER TABLE public.whatsapp_logs ADD COLUMN payload jsonb DEFAULT '{}'::jsonb;
  END IF;
  
  -- Add message_id column if it doesn't exist (for idempotency)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'message_id') THEN
    ALTER TABLE public.whatsapp_logs ADD COLUMN message_id text;
  END IF;
END
$$;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON public.whatsapp_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_direction ON public.whatsapp_logs(direction);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_message_id ON public.whatsapp_logs(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_phone ON public.whatsapp_logs(phone_number) WHERE phone_number IS NOT NULL;

-- Add unique constraint on message_id for idempotency (inbound messages only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_logs_message_id_unique ON public.whatsapp_logs(message_id) WHERE message_id IS NOT NULL AND direction = 'in';

-- Performance indexes for other critical tables
CREATE INDEX IF NOT EXISTS idx_drivers_location_gist ON public.drivers USING GIST(location) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON public.rides(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);
CREATE INDEX IF NOT EXISTS idx_insurance_quotes_status_created ON public.insurance_quotes(status, created_at DESC);

-- Add unique constraint for vehicles per user (if plate exists)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_user_plate_unique ON public.vehicles(user_id, plate) WHERE plate IS NOT NULL AND plate != '';

-- Update RLS policies to be production-ready
DROP POLICY IF EXISTS "service_role_all_logs" ON public.whatsapp_logs;
CREATE POLICY "service_role_all_logs" ON public.whatsapp_logs FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');