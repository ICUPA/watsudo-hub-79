-- Fix RLS issues for lookup tables that need to be publicly accessible
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

-- Fix function search paths for security
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';