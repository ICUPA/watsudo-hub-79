-- Fix whatsapp_logs schema and add missing indexes
DO $$
BEGIN
  -- First, check if columns exist and add them if needed
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'message_id') THEN
    ALTER TABLE public.whatsapp_logs ADD COLUMN message_id text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'phone_number') THEN
    ALTER TABLE public.whatsapp_logs ADD COLUMN phone_number text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'message_type') THEN
    ALTER TABLE public.whatsapp_logs ADD COLUMN message_type text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'message_content') THEN
    ALTER TABLE public.whatsapp_logs ADD COLUMN message_content jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'metadata') THEN
    ALTER TABLE public.whatsapp_logs ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_logs' AND column_name = 'status') THEN
    ALTER TABLE public.whatsapp_logs ADD COLUMN status text DEFAULT 'received';
  END IF;
END
$$;

-- Update payload column to be more specific
ALTER TABLE public.whatsapp_logs ALTER COLUMN payload SET DEFAULT '{}'::jsonb;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON public.whatsapp_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_direction ON public.whatsapp_logs(direction);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_message_id ON public.whatsapp_logs(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_phone ON public.whatsapp_logs(phone_number) WHERE phone_number IS NOT NULL;

-- Add unique constraint on message_id for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_logs_message_id_unique ON public.whatsapp_logs(message_id) WHERE message_id IS NOT NULL AND direction = 'in';

-- Performance indexes for other tables
CREATE INDEX IF NOT EXISTS idx_drivers_location_gist ON public.drivers USING GIST(location) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON public.rides(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);
CREATE INDEX IF NOT EXISTS idx_insurance_quotes_status_created ON public.insurance_quotes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicles_user_plate ON public.vehicles(user_id, plate) WHERE plate IS NOT NULL;

-- Add unique constraint for vehicles per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_user_plate_unique ON public.vehicles(user_id, plate) WHERE plate IS NOT NULL AND plate != '';

-- Update RLS policies to be more restrictive
DROP POLICY IF EXISTS "srv all profiles" ON public.profiles;
DROP POLICY IF EXISTS "srv all sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "srv all tables insurance" ON public.insurance_quotes;

-- Service role can do everything
CREATE POLICY "service_role_all_profiles" ON public.profiles FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_all_sessions" ON public.chat_sessions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_all_insurance" ON public.insurance_quotes FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_all_logs" ON public.whatsapp_logs FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Users can only read their own data (when authenticated)
CREATE POLICY "users_read_own_profile" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL AND id = auth.uid());
CREATE POLICY "users_read_own_sessions" ON public.chat_sessions FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());
CREATE POLICY "users_read_own_insurance" ON public.insurance_quotes FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());