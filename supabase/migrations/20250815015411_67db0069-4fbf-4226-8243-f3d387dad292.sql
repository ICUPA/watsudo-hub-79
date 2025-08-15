-- Fix security issues found by linter

-- 1. Enable RLS on tables that don't have it enabled
DO $$
DECLARE
    tbl RECORD;
BEGIN
    -- Find tables in public schema without RLS enabled
    FOR tbl IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND NOT EXISTS (
            SELECT 1 FROM pg_class c 
            JOIN pg_namespace n ON n.oid = c.relnamespace 
            WHERE c.relname = tablename 
            AND n.nspname = schemaname 
            AND c.relrowsecurity = true
        )
    LOOP
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', tbl.schemaname, tbl.tablename);
    END LOOP;
END $$;

-- 2. Fix function search path issues by setting proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

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
SECURITY DEFINER
SET search_path = public
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

-- 3. Add basic RLS policies for any tables that might be missing them
DO $$
DECLARE
    tables_without_policies text[] := ARRAY['vehicle_types', 'insurance_periods', 'insurance_addons', 'payment_plans'];
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY tables_without_policies
    LOOP
        -- Add read-only policy for reference tables
        EXECUTE format('DROP POLICY IF EXISTS "Allow read access" ON public.%I', tbl);
        EXECUTE format('CREATE POLICY "Allow read access" ON public.%I FOR SELECT USING (true)', tbl);
    END LOOP;
END $$;