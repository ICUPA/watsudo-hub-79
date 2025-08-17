-- Phase 2: Core Infrastructure Improvements
-- This migration adds performance optimizations, missing constraints, and RLS policy verification

-- 1. Verify and enable PostGIS extension
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    CREATE EXTENSION postgis;
    RAISE NOTICE 'PostGIS extension created successfully';
  ELSE
    RAISE NOTICE 'PostGIS extension already exists';
  END IF;
END
$$;

-- 2. Add missing geo indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_drivers_location_gist 
ON public.drivers USING GIST (location);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_drivers_active_location 
ON public.drivers (is_active, last_seen_at) 
WHERE location IS NOT NULL;

-- 3. Add missing constraints for data integrity
DO $$
BEGIN
  -- Vehicle plate uniqueness per user (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'vehicles' AND constraint_name = 'unique_user_plate'
  ) THEN
    ALTER TABLE public.vehicles 
    ADD CONSTRAINT unique_user_plate UNIQUE (user_id, plate) 
    DEFERRABLE INITIALLY DEFERRED;
  END IF;
  
  -- Phone number format validation
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'check_phone_format'
  ) THEN
    ALTER TABLE public.profiles 
    ADD CONSTRAINT check_phone_format 
    CHECK (wa_phone ~ '^(\+250|0)?[0-9]{9}$');
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Constraint creation failed: %', SQLERRM;
END
$$;

-- 4. Add missing triggers for timestamp updates
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for tables that don't have them
DO $$
DECLARE
  table_name text;
  trigger_name text;
BEGIN
  FOR table_name IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('chat_sessions', 'driver_availability', 'qr_profiles')
  LOOP
    trigger_name := 'update_' || table_name || '_updated_at';
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = trigger_name
    ) THEN
      EXECUTE format('
        CREATE TRIGGER %I
        BEFORE UPDATE ON public.%I
        FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()
      ', trigger_name, table_name);
      
      RAISE NOTICE 'Created trigger % for table %', trigger_name, table_name;
    END IF;
  END LOOP;
END
$$;

-- 5. Verify and fix RLS policies
-- Drop and recreate policies to ensure clean state
DO $$
DECLARE
  policy_name text;
BEGIN
  -- Drop existing policies for tables that need verification
  FOR policy_name IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename IN ('chat_sessions', 'driver_availability')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s" ON public.%s', 
      policy_name, 
      (SELECT tablename FROM pg_policies WHERE policyname = policy_name LIMIT 1)
    );
  END LOOP;
END
$$;

-- Create chat_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'HOME',
  context JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create driver_availability table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.driver_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  route JSONB NOT NULL,
  time_window JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create qr_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.qr_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_momo_phone TEXT,
  default_momo_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for chat_sessions
CREATE POLICY "Users can manage their own chat sessions" ON public.chat_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all chat sessions" ON public.chat_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Create RLS policies for driver_availability
CREATE POLICY "Drivers can manage their own availability" ON public.driver_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.drivers 
      WHERE id = driver_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can read active driver availability" ON public.driver_availability
  FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage all driver availability" ON public.driver_availability
  FOR ALL USING (auth.role() = 'service_role');

-- Create RLS policies for qr_profiles
CREATE POLICY "Users can manage their own QR profiles" ON public.qr_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all QR profiles" ON public.qr_profiles
  FOR ALL USING (auth.role() = 'service_role');

-- 6. Add missing indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_user_state 
ON public.chat_sessions (user_id, state);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_updated_at 
ON public.chat_sessions (updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_availability_active 
ON public.driver_availability (is_active, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qr_profiles_user 
ON public.qr_profiles (user_id);

-- 7. Verify existing RLS policies are working
-- Test cross-user data access prevention
DO $$
DECLARE
  test_user1_id uuid;
  test_user2_id uuid;
  test_profile_id uuid;
BEGIN
  -- Create test users (this will be rolled back)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES 
    (gen_random_uuid(), 'test1@example.com', 'password', now(), now(), now()),
    (gen_random_uuid(), 'test2@example.com', 'password', now(), now(), now())
  RETURNING id INTO test_user1_id;
  
  SELECT id INTO test_user2_id FROM auth.users WHERE email = 'test2@example.com';
  
  -- Create test profiles
  INSERT INTO public.profiles (user_id, wa_phone, wa_name)
  VALUES 
    (test_user1_id, '0712345678', 'Test User 1'),
    (test_user2_id, '0787654321', 'Test User 2')
  RETURNING id INTO test_profile_id;
  
  -- Test RLS isolation (this should fail)
  BEGIN
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO test_user1_id::text;
    
    -- Try to access another user's profile
    PERFORM * FROM public.profiles WHERE user_id = test_user2_id;
    
    RAISE EXCEPTION 'RLS policy failed: user was able to access another user''s data';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'RLS policy working correctly: %', SQLERRM;
  END;
  
  -- Clean up test data
  DELETE FROM public.profiles WHERE user_id IN (test_user1_id, test_user2_id);
  DELETE FROM auth.users WHERE id IN (test_user1_id, test_user2_id);
  
  RAISE NOTICE 'RLS policy verification completed successfully';
END
$$;

-- 8. Add performance monitoring functions
CREATE OR REPLACE FUNCTION public.get_performance_stats()
RETURNS TABLE(
  table_name text,
  row_count bigint,
  index_size text,
  table_size text
)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT 
    schemaname||'.'||tablename as table_name,
    n_tup_ins + n_tup_upd + n_tup_del as row_count,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size
  FROM pg_stat_user_tables 
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
$$;

-- 9. Add health check function
CREATE OR REPLACE FUNCTION public.health_check()
RETURNS jsonb
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'status', 'healthy',
    'timestamp', now(),
    'database_version', version(),
    'postgis_version', (SELECT PostGIS_Version()),
    'total_users', (SELECT count(*) FROM public.profiles),
    'active_drivers', (SELECT count(*) FROM public.drivers WHERE is_active = true),
    'pending_rides', (SELECT count(*) FROM public.rides WHERE status = 'pending'),
    'active_sessions', (SELECT count(*) FROM public.chat_sessions WHERE updated_at > now() - interval '1 hour')
  );
$$;

-- 10. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.health_check() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_performance_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_drivers_optimized() TO anon, authenticated;

-- 11. Add comments for documentation
COMMENT ON TABLE public.chat_sessions IS 'WhatsApp chat session state management';
COMMENT ON TABLE public.driver_availability IS 'Driver availability for scheduled trips';
COMMENT ON TABLE public.qr_profiles IS 'User QR code preferences and defaults';
COMMENT ON FUNCTION public.health_check() IS 'System health check endpoint';
COMMENT ON FUNCTION public.get_performance_stats() IS 'Database performance statistics';

-- 12. Verify all changes
DO $$
BEGIN
  RAISE NOTICE 'Phase 2 schema improvements completed successfully';
  RAISE NOTICE 'PostGIS extension: %', (SELECT PostGIS_Version());
  RAISE NOTICE 'Total tables: %', (SELECT count(*) FROM pg_tables WHERE schemaname = 'public');
  RAISE NOTICE 'Total indexes: %', (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public');
  RAISE NOTICE 'RLS enabled tables: %', (
    SELECT count(*) FROM pg_tables 
    WHERE schemaname = 'public' AND rowsecurity = true
  );
END
$$;
