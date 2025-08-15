-- Production refactor: Fix schema issues and add performance indexes (v2)

-- Update whatsapp_logs schema to match actual usage
ALTER TABLE public.whatsapp_logs 
ADD COLUMN IF NOT EXISTS message_content text,
ADD COLUMN IF NOT EXISTS message_id text;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_drivers_location ON public.drivers USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_drivers_active_seen ON public.drivers (is_active, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON public.rides (created_at);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides (status);
CREATE INDEX IF NOT EXISTS idx_insurance_quotes_status_created ON public.insurance_quotes (status, created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON public.whatsapp_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_message_id ON public.whatsapp_logs (message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_phone_direction ON public.whatsapp_logs (phone_number, direction);

-- Add unique constraints for data integrity where safe
DO $$
BEGIN
  -- Only add unique constraint if not already exists and data allows it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'vehicles' AND constraint_name = 'unique_user_plate'
  ) THEN
    ALTER TABLE public.vehicles 
    ADD CONSTRAINT unique_user_plate UNIQUE (user_id, plate) DEFERRABLE INITIALLY DEFERRED;
  END IF;
EXCEPTION
  WHEN others THEN
    -- Ignore if constraint would fail due to existing data
    NULL;
END
$$;

-- Create canonical storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('qr', 'qr', true),
  ('vehicle_docs', 'vehicle_docs', false),
  ('quotes', 'quotes', false),
  ('certificates', 'certificates', false)
ON CONFLICT (id) DO NOTHING;

-- Drop and recreate storage policies to ensure clean state
DO $$
DECLARE
  policy_name text;
BEGIN
  -- Drop existing QR policies
  FOR policy_name IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
    AND policyname LIKE '%QR%' OR policyname LIKE '%qr%'
  LOOP
    EXECUTE format('DROP POLICY "%s" ON storage.objects', policy_name);
  END LOOP;
  
  -- Drop existing vehicle docs policies
  FOR policy_name IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
    AND policyname LIKE '%vehicle%'
  LOOP
    EXECUTE format('DROP POLICY "%s" ON storage.objects', policy_name);
  END LOOP;
END
$$;

-- Create storage policies for qr bucket (public)
CREATE POLICY "QR codes public read access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'qr');

CREATE POLICY "Service role QR management" 
ON storage.objects FOR ALL 
USING (bucket_id = 'qr' AND auth.role() = 'service_role') 
WITH CHECK (bucket_id = 'qr' AND auth.role() = 'service_role');

-- Create storage policies for vehicle_docs bucket (private)
CREATE POLICY "User vehicle docs access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'vehicle_docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Service role vehicle docs management" 
ON storage.objects FOR ALL 
USING (bucket_id = 'vehicle_docs' AND auth.role() = 'service_role') 
WITH CHECK (bucket_id = 'vehicle_docs' AND auth.role() = 'service_role');

-- Create storage policies for quotes bucket (private)
CREATE POLICY "Service role quotes management" 
ON storage.objects FOR ALL 
USING (bucket_id = 'quotes' AND auth.role() = 'service_role') 
WITH CHECK (bucket_id = 'quotes' AND auth.role() = 'service_role');

-- Create storage policies for certificates bucket (private)
CREATE POLICY "Service role certificates management" 
ON storage.objects FOR ALL 
USING (bucket_id = 'certificates' AND auth.role() = 'service_role') 
WITH CHECK (bucket_id = 'certificates' AND auth.role() = 'service_role');

-- Function to get nearby drivers with better performance
CREATE OR REPLACE FUNCTION public.nearby_drivers_optimized(
  lat double precision, 
  lng double precision, 
  km double precision DEFAULT 15,
  limit_count integer DEFAULT 10
)
RETURNS TABLE(
  driver_id uuid, 
  distance_km double precision, 
  wa_phone text, 
  wa_name text,
  rating numeric,
  total_trips integer
)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT 
    d.id as driver_id,
    ST_Distance(d.location::geometry, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geometry) / 1000 as distance_km,
    p.wa_phone, 
    p.wa_name,
    d.rating,
    d.total_trips
  FROM public.drivers d
  JOIN public.profiles p ON p.id = d.user_id
  WHERE d.location IS NOT NULL
    AND d.is_active = true
    AND (now() - COALESCE(d.last_seen_at, now())) < interval '30 minutes'
    AND ST_DWithin(
      d.location::geography, 
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, 
      km * 1000
    )
  ORDER BY distance_km ASC
  LIMIT limit_count;
$$;

-- Health check function for monitoring
CREATE OR REPLACE FUNCTION public.health_check()
RETURNS jsonb
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'status', 'healthy',
    'timestamp', now(),
    'database_version', version(),
    'total_users', (SELECT count(*) FROM public.profiles),
    'active_drivers', (SELECT count(*) FROM public.drivers WHERE is_active = true),
    'pending_rides', (SELECT count(*) FROM public.rides WHERE status = 'pending')
  );
$$;