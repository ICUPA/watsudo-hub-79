-- Create feature_flags table for feature toggling
-- This table allows gradual rollout and environment-based feature control

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name TEXT NOT NULL UNIQUE,
  flag_description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INTEGER NOT NULL DEFAULT 0, -- 0-100, percentage of users who see the feature
  environments TEXT[] NOT NULL DEFAULT '{development}', -- Which environments this flag applies to
  user_groups TEXT[] DEFAULT '{}', -- Specific user groups (e.g., ['beta_users', 'admin'])
  conditions JSONB DEFAULT '{}', -- Additional conditions (e.g., {"min_app_version": "1.2.0"})
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON public.feature_flags(flag_name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON public.feature_flags(is_enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flags_environments ON public.feature_flags USING GIN(environments);
CREATE INDEX IF NOT EXISTS idx_feature_flags_user_groups ON public.feature_flags USING GIN(user_groups);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Service can manage all feature flags"
ON public.feature_flags
FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Users can read enabled feature flags"
ON public.feature_flags
FOR SELECT
USING (is_enabled = true);

-- Create function to check if a feature flag is enabled for a user
CREATE OR REPLACE FUNCTION public.is_feature_enabled(
  p_flag_name TEXT,
  p_user_id UUID DEFAULT NULL,
  p_environment TEXT DEFAULT 'production',
  p_user_groups TEXT[] DEFAULT '{}',
  p_app_version TEXT DEFAULT '1.0.0'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_flag RECORD;
  v_user_hash NUMERIC;
  v_rollout_enabled BOOLEAN;
BEGIN
  -- Get the feature flag
  SELECT * INTO v_flag
  FROM public.feature_flags
  WHERE flag_name = p_flag_name;
  
  IF NOT FOUND THEN
    RETURN false; -- Flag doesn't exist
  END IF;
  
  -- Check if flag is globally enabled
  IF NOT v_flag.is_enabled THEN
    RETURN false;
  END IF;
  
  -- Check if flag applies to current environment
  IF NOT (p_environment = ANY(v_flag.environments)) THEN
    RETURN false;
  END IF;
  
  -- Check user group restrictions
  IF array_length(v_flag.user_groups, 1) > 0 THEN
    IF NOT (v_flag.user_groups && p_user_groups) THEN
      RETURN false; -- User not in required groups
    END IF;
  END IF;
  
  -- Check additional conditions
  IF v_flag.conditions ? 'min_app_version' THEN
    IF p_app_version < (v_flag.conditions->>'min_app_version') THEN
      RETURN false; -- App version too old
    END IF;
  END IF;
  
  -- Check rollout percentage
  IF v_flag.rollout_percentage = 0 THEN
    RETURN false; -- 0% rollout
  ELSIF v_flag.rollout_percentage = 100 THEN
    RETURN true; -- 100% rollout
  ELSE
    -- Calculate user hash for consistent rollout
    IF p_user_id IS NOT NULL THEN
      v_user_hash := (p_user_id::text || p_flag_name)::text::bit(64)::bigint;
      v_rollout_enabled := (v_user_hash % 100) < v_flag.rollout_percentage;
      RETURN v_rollout_enabled;
    ELSE
      -- No user ID, use random rollout
      RETURN random() < (v_flag.rollout_percentage::float / 100.0);
    END IF;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get all enabled features for a user
CREATE OR REPLACE FUNCTION public.get_enabled_features(
  p_user_id UUID DEFAULT NULL,
  p_environment TEXT DEFAULT 'production',
  p_user_groups TEXT[] DEFAULT '{}',
  p_app_version TEXT DEFAULT '1.0.0'
)
RETURNS TABLE(
  flag_name TEXT,
  flag_description TEXT,
  rollout_percentage INTEGER,
  conditions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ff.flag_name,
    ff.flag_description,
    ff.rollout_percentage,
    ff.conditions
  FROM public.feature_flags ff
  WHERE ff.is_enabled = true
    AND (p_environment = ANY(ff.environments))
    AND (
      array_length(ff.user_groups, 1) IS NULL 
      OR ff.user_groups && p_user_groups
    )
    AND (
      NOT (ff.conditions ? 'min_app_version')
      OR p_app_version >= (ff.conditions->>'min_app_version')
    )
    AND (
      ff.rollout_percentage = 100
      OR (
        p_user_id IS NOT NULL 
        AND ((p_user_id::text || ff.flag_name)::text::bit(64)::bigint % 100) < ff.rollout_percentage
      )
      OR (
        p_user_id IS NULL 
        AND random() < (ff.rollout_percentage::float / 100.0)
      )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(TEXT, UUID, TEXT, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(TEXT, UUID, TEXT, TEXT[], TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_enabled_features(UUID, TEXT, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_enabled_features(UUID, TEXT, TEXT[], TEXT) TO service_role;

-- Insert default feature flags
INSERT INTO public.feature_flags (flag_name, flag_description, is_enabled, rollout_percentage, environments, user_groups) VALUES
  ('ocr_processing', 'Enable OCR processing for vehicle documents', true, 100, '{development,staging,production}', '{}'),
  ('nearby_drivers', 'Enable nearby drivers functionality', true, 100, '{development,staging,production}', '{}'),
  ('qr_generation', 'Enable QR code generation', true, 100, '{development,staging,production}', '{}'),
  ('whatsapp_webhook', 'Enable WhatsApp webhook processing', true, 100, '{development,staging,production}', '{}'),
  ('advanced_maps', 'Enable advanced Google Maps features', false, 50, '{development,staging}', '{beta_users}'),
  ('offline_support', 'Enable offline PWA functionality', false, 25, '{development}', '{beta_users}'),
  ('real_time_updates', 'Enable real-time updates via WebSocket', false, 0, '{development}', '{admin}')
ON CONFLICT (flag_name) DO NOTHING;
