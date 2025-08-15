-- Fix RLS security issues by enabling RLS on all public tables that need it

-- Enable RLS on all public tables that might be missing it
DO $$
DECLARE
    table_name text;
BEGIN
    -- Get all tables in public schema and enable RLS if not already enabled
    FOR table_name IN 
        SELECT t.tablename 
        FROM pg_tables t 
        WHERE t.schemaname = 'public' 
        AND NOT EXISTS (
            SELECT 1 FROM pg_policies p 
            WHERE p.schemaname = 'public' 
            AND p.tablename = t.tablename
        )
        AND t.tablename NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        -- Add a default restrictive policy for service role only
        EXECUTE format('CREATE POLICY "service_role_only_%s" ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')', table_name, table_name);
    END LOOP;
END
$$;

-- Ensure all lookup tables have proper read access
DROP POLICY IF EXISTS "public_read_insurance_periods" ON public.insurance_periods;
CREATE POLICY "public_read_insurance_periods" ON public.insurance_periods FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_addons" ON public.addons;  
CREATE POLICY "public_read_addons" ON public.addons FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_pa_categories" ON public.pa_categories;
CREATE POLICY "public_read_pa_categories" ON public.pa_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_vehicle_types" ON public.vehicle_types;
CREATE POLICY "public_read_vehicle_types" ON public.vehicle_types FOR SELECT USING (true);

DROP POLICY IF EXISTS "public_read_payment_plans" ON public.payment_plans;
CREATE POLICY "public_read_payment_plans" ON public.payment_plans FOR SELECT USING (true);

-- Fix search path for existing functions
ALTER FUNCTION public.handle_new_user() SET search_path = public, auth;
ALTER FUNCTION public.get_current_user_role() SET search_path = public;