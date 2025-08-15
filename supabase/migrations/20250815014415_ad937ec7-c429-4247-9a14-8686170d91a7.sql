-- Phase 1: Complete database schema matching the specification

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

-- Add missing insurance lookup tables with is_active flags
CREATE TABLE IF NOT EXISTS public.insurance_periods (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  days integer not null,
  is_active boolean default true
);

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

-- Insurance quotes table
CREATE TABLE IF NOT EXISTS public.insurance_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  start_date date not null,
  period_id uuid references public.insurance_periods(id),
  addons jsonb default '[]'::jsonb,
  pa_category_id uuid references public.pa_categories(id),
  status text default 'pending_backoffice',
  quote_pdf_path text,
  amount_cents bigint,
  currency text default 'RWF',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Insurance certificates table
CREATE TABLE IF NOT EXISTS public.insurance_certificates (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references public.insurance_quotes(id) on delete cascade,
  certificate_pdf_path text not null,
  issued_at timestamptz default now()
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references public.insurance_quotes(id) on delete cascade,
  method text default 'momo_ussd',
  amount_cents bigint,
  currency text default 'RWF',
  payer_phone_e164 text,
  provider_ref text,
  status text default 'received',
  raw_payload jsonb,
  created_at timestamptz default now()
);

-- Payment plans table
CREATE TABLE IF NOT EXISTS public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  description text,
  is_active boolean default true
);

-- Insert sample data for insurance lookups
INSERT INTO public.insurance_periods(label, days) VALUES
('1 Week', 7),
('1 Month', 30),
('3 Months', 90),
('1 Year', 365)
ON CONFLICT DO NOTHING;

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
ALTER TABLE public.insurance_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pa_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies for new tables
CREATE POLICY "Service can manage all driver availability" ON public.driver_availability FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY "Service can manage all ride events" ON public.ride_events FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY "Users can manage their own decoded QRs" ON public.qr_decoded FOR ALL USING (auth.uid() = user_id);

-- Insurance lookup policies (public read)
CREATE POLICY "Anyone can read insurance periods" ON public.insurance_periods FOR SELECT USING (true);
CREATE POLICY "Anyone can read addons" ON public.addons FOR SELECT USING (true);
CREATE POLICY "Anyone can read PA categories" ON public.pa_categories FOR SELECT USING (true);
CREATE POLICY "Anyone can read payment plans" ON public.payment_plans FOR SELECT USING (true);

-- Insurance business logic policies
CREATE POLICY "Service can manage all insurance quotes" ON public.insurance_quotes FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY "Users can read their own insurance quotes" ON public.insurance_quotes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can manage all certificates" ON public.insurance_certificates FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY "Service can manage all payments" ON public.payments FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);

-- Update triggers for insurance quotes
CREATE OR REPLACE FUNCTION public.touch_insurance_quotes()
RETURNS trigger LANGUAGE plpgsql AS $$ 
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END $$;

DROP TRIGGER IF EXISTS trg_touch_insurance_quotes ON public.insurance_quotes;
CREATE TRIGGER trg_touch_insurance_quotes 
  BEFORE UPDATE ON public.insurance_quotes
  FOR EACH ROW EXECUTE FUNCTION public.touch_insurance_quotes();