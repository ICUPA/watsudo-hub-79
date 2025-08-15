-- Phase 1: Complete Database Schema
-- Fix drivers.location to proper geography type if needed
DO $$ 
BEGIN
  -- Check if location column needs to be fixed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drivers' AND column_name = 'location' 
    AND data_type != 'USER-DEFINED'
  ) THEN
    ALTER TABLE public.drivers ALTER COLUMN location TYPE geography(point,4326);
  END IF;
END $$;

-- Add missing qr_profiles table if not exists
CREATE TABLE IF NOT EXISTS public.qr_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  identifier_type text NOT NULL CHECK (identifier_type IN ('phone', 'code')),
  phone text,
  code text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on qr_profiles
ALTER TABLE public.qr_profiles ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for qr_profiles
DROP POLICY IF EXISTS "Users can manage their own QR profiles" ON public.qr_profiles;
CREATE POLICY "Users can manage their own QR profiles" 
ON public.qr_profiles FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure all timestamp update triggers exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns where missing
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_drivers_updated_at') THEN
    CREATE TRIGGER update_drivers_updated_at 
    BEFORE UPDATE ON public.drivers 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_vehicles_updated_at') THEN
    CREATE TRIGGER update_vehicles_updated_at 
    BEFORE UPDATE ON public.vehicles 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_rides_updated_at') THEN
    CREATE TRIGGER update_rides_updated_at 
    BEFORE UPDATE ON public.rides 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_insurance_quotes_updated_at') THEN
    CREATE TRIGGER update_insurance_quotes_updated_at 
    BEFORE UPDATE ON public.insurance_quotes 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_insurance_policies_updated_at') THEN
    CREATE TRIGGER update_insurance_policies_updated_at 
    BEFORE UPDATE ON public.insurance_policies 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Create or update nearby_drivers function for proper geography handling
CREATE OR REPLACE FUNCTION public.nearby_drivers(
  lat double precision, 
  lng double precision, 
  radius_km double precision DEFAULT 15.0
)
RETURNS TABLE(
  driver_id uuid,
  distance_km double precision,
  wa_phone text,
  wa_name text,
  rating numeric,
  is_active boolean,
  last_seen_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    d.id as driver_id,
    ST_Distance(d.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) / 1000 as distance_km,
    p.wa_phone,
    p.wa_name,
    d.rating,
    d.is_active,
    d.last_seen_at
  FROM public.drivers d
  JOIN public.profiles p ON p.user_id = d.user_id
  WHERE d.location IS NOT NULL
    AND d.is_active = true
    AND (d.last_seen_at IS NULL OR d.last_seen_at > now() - interval '30 minutes')
    AND ST_DWithin(
      d.location, 
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, 
      radius_km * 1000
    )
  ORDER BY distance_km ASC
  LIMIT 10;
$$;

-- Ensure storage buckets exist for QR codes
INSERT INTO storage.buckets (id, name, public) 
VALUES ('qr-codes', 'qr-codes', true)
ON CONFLICT (id) DO NOTHING;

-- Ensure storage buckets exist for vehicle documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('vehicle-docs', 'vehicle-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Add storage policies for QR codes (public read)
DROP POLICY IF EXISTS "QR codes are publicly accessible" ON storage.objects;
CREATE POLICY "QR codes are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'qr-codes');

DROP POLICY IF EXISTS "Users can upload QR codes" ON storage.objects;
CREATE POLICY "Users can upload QR codes" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'qr-codes' AND auth.uid() IS NOT NULL);

-- Add storage policies for vehicle documents (private)
DROP POLICY IF EXISTS "Users can view their own vehicle docs" ON storage.objects;
CREATE POLICY "Users can view their own vehicle docs" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'vehicle-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can upload their own vehicle docs" ON storage.objects;
CREATE POLICY "Users can upload their own vehicle docs" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'vehicle-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_drivers_location ON public.drivers USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_drivers_active_last_seen ON public.drivers (is_active, last_seen_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_qr_profiles_user_id ON public.qr_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_qr_profiles_default ON public.qr_profiles (user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides (status);
CREATE INDEX IF NOT EXISTS idx_rides_scheduled_for ON public.rides (scheduled_for) WHERE scheduled_for IS NOT NULL;