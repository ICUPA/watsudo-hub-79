-- Fix security linter warnings

-- Fix function search paths
ALTER FUNCTION public.nearby_drivers_optimized(double precision, double precision, double precision, integer) 
SET search_path = public, extensions;

ALTER FUNCTION public.health_check() 
SET search_path = public;

-- Enable RLS on any tables that might be missing it
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND NOT EXISTS (
            SELECT 1 FROM pg_class pc 
            JOIN pg_namespace pn ON pc.relnamespace = pn.oid 
            WHERE pc.relname = pg_tables.tablename 
            AND pn.nspname = pg_tables.schemaname 
            AND pc.relrowsecurity = true
        )
        AND tablename NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
    LOOP
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', table_record.schemaname, table_record.tablename);
    END LOOP;
END
$$;