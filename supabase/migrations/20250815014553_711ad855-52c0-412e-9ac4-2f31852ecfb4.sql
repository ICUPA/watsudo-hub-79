-- Complete minimal database schema completion

-- Extensions (if not already present)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fix drivers.location column to use PostGIS geography type (only if needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drivers' AND column_name = 'location' 
    AND data_type = 'USER-DEFINED' AND udt_name = 'geography'
  ) THEN
    ALTER TABLE public.drivers DROP COLUMN IF EXISTS location;
    ALTER TABLE public.drivers ADD COLUMN location geography(point,4326);
    CREATE INDEX IF NOT EXISTS idx_drivers_geo ON public.drivers USING gist (location);
  END IF;
END $$;

-- Add missing tables only if they don't exist
CREATE TABLE IF NOT EXISTS public.driver_availability (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references public.drivers(id) on delete cascade,
  origin geography(point,4326),
  dest geography(point,4326),
  window_start timestamptz not null,
  window_end timestamptz not null,
  notes text,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.ride_events (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid references public.rides(id) on delete cascade,
  event text not null, -- created|driver_confirm|driver_reject|start|arrive|complete|cancel
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS public.qr_decoded (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  raw_text text not null,
  ussd text,
  created_at timestamptz default now()
);

-- Fix existing insurance_periods table by adding missing days column if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'insurance_periods' AND column_name = 'days'
  ) THEN
    ALTER TABLE public.insurance_periods ADD COLUMN days integer;
    
    -- Update existing records
    UPDATE public.insurance_periods 
    SET days = CASE 
      WHEN label LIKE '%week%' OR label LIKE '%Week%' THEN 7
      WHEN label LIKE '%month%' OR label LIKE '%Month%' OR months = 1 THEN 30
      WHEN months = 3 THEN 90
      WHEN months = 12 THEN 365
      ELSE 30
    END
    WHERE days IS NULL;
  END IF;
END $$;

-- Add missing insurance lookup tables only if they don't exist
CREATE TABLE IF NOT EXISTS public.addons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  label text not null,
  is_multi boolean default true,
  is_active boolean default true
);

CREATE TABLE IF NOT EXISTS public.pa_categories (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  is_active boolean default true
);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
('quotes', 'quotes', false),
('certificates', 'certificates', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on new tables (skip if already enabled)
DO $$
BEGIN
  ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.ride_events ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.qr_decoded ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.pa_categories ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Create RLS policies (only if they don't exist)
DO $$
BEGIN
  CREATE POLICY "Service can manage all driver availability" ON public.driver_availability FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Service can manage all ride events" ON public.ride_events FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can manage their own decoded QRs" ON public.qr_decoded FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Anyone can read addons" ON public.addons FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Anyone can read PA categories" ON public.pa_categories FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Insert sample data safely
INSERT INTO public.addons(code, label) VALUES
('third_party', 'Third Party'),
('comesa', 'COMESA'),
('pa', 'Personal Accident')
ON CONFLICT DO NOTHING;

INSERT INTO public.pa_categories(label) VALUES
('Basic'),
('Premium'),
('Comprehensive')
ON CONFLICT DO NOTHING;