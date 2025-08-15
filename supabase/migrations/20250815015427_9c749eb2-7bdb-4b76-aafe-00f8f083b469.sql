-- Fix security issues more carefully - only target our own tables

-- 1. Enable RLS only on our application tables, not system tables
DO $$
DECLARE
    app_tables text[] := ARRAY[
        'profiles', 'drivers', 'vehicles', 'rides', 'ride_events', 
        'driver_availability', 'qr_generations', 'qr_decoded', 'qr_profiles',
        'insurance_quotes', 'insurance_policies', 'whatsapp_conversations', 
        'whatsapp_logs', 'whatsapp_files', 'chat_sessions'
    ];
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY app_tables
    LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = tbl AND schemaname = 'public') THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
        END IF;
    END LOOP;
END $$;

-- 2. Ensure basic read policies exist for reference tables
DO $$
DECLARE
    ref_tables text[] := ARRAY['vehicle_types', 'insurance_periods', 'insurance_addons', 'payment_plans', 'addons', 'pa_categories'];
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ref_tables
    LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = tbl AND schemaname = 'public') THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Allow read access" ON public.%I', tbl);
            EXECUTE format('CREATE POLICY "Allow read access" ON public.%I FOR SELECT USING (true)', tbl);
        END IF;
    END LOOP;
END $$;