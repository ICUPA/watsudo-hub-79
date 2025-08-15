-- Phase 1: Complete database schema matching the specification (fixed)

-- Extensions (if not already present)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fix drivers.location column to use PostGIS geography type
ALTER TABLE public.drivers 
DROP COLUMN IF EXISTS location;
ALTER TABLE public.drivers 
ADD COLUMN location geography(point,4326);
CREATE INDEX IF NOT EXISTS idx_drivers_geo ON public.drivers USING gist (location);

-- Add missing driver_availability table
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

-- Add missing ride_events table for lifecycle tracking
CREATE TABLE IF NOT EXISTS public.ride_events (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid references public.rides(id) on delete cascade,
  event text not null, -- created|driver_confirm|driver_reject|start|arrive|complete|cancel
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Add missing qr_decoded table for scan flow
CREATE TABLE IF NOT EXISTS public.qr_decoded (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  raw_text text not null,
  ussd text,
  created_at timestamptz default now()
);

-- Fix existing insurance_periods table by adding missing days column
ALTER TABLE public.insurance_periods 
ADD COLUMN IF NOT EXISTS days integer;

-- Update existing insurance_periods records with proper days values
UPDATE public.insurance_periods 
SET days = CASE 
  WHEN label LIKE '%week%' OR label LIKE '%Week%' THEN 7
  WHEN label LIKE '%month%' OR label LIKE '%Month%' OR months = 1 THEN 30
  WHEN months = 3 THEN 90
  WHEN months = 12 THEN 365
  ELSE 30
END
WHERE days IS NULL;

-- Add missing insurance lookup tables with is_active flags
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

-- Payment plans table
CREATE TABLE IF NOT EXISTS public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  description text,
  is_active boolean default true
);

-- Insert sample data for insurance lookups
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

INSERT INTO public.payment_plans(label, description) VALUES
('Full Payment', 'Pay the full amount at once'),
('2 Installments', 'Pay in 2 equal installments'),
('3 Installments', 'Pay in 3 equal installments')
ON CONFLICT DO NOTHING;

-- Storage buckets for quotes and certificates
INSERT INTO storage.buckets (id, name, public) VALUES 
('quotes', 'quotes', false),
('certificates', 'certificates', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on new tables
ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_decoded ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pa_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies for new tables
CREATE POLICY "Service can manage all driver availability" ON public.driver_availability FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY "Service can manage all ride events" ON public.ride_events FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY "Users can manage their own decoded QRs" ON public.qr_decoded FOR ALL USING (auth.uid() = user_id);

-- Insurance lookup policies (public read)
CREATE POLICY "Anyone can read addons" ON public.addons FOR SELECT USING (true);
CREATE POLICY "Anyone can read PA categories" ON public.pa_categories FOR SELECT USING (true);
CREATE POLICY "Anyone can read payment plans" ON public.payment_plans FOR SELECT USING (true);

-- Insurance business logic policies
CREATE POLICY "Service can manage all payments" ON public.payments FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);