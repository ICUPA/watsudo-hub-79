-- Fix security issues by enabling RLS and adding policies

-- Enable RLS on all new tables
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_leads ENABLE ROW LEVEL SECURITY;

-- Fix the function security issue
CREATE OR REPLACE FUNCTION public.list_nearby_drivers(lat double precision, lon double precision, radius_m integer, limit_n integer)
RETURNS table (
  driver_id uuid,
  wa_name text,
  rating numeric,
  distance_km numeric,
  eta_minutes integer
) 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  select
    d.driver_id,
    coalesce(d.wa_name,'Driver') as wa_name,
    coalesce(d.rating,5) as rating,
    (ST_DistanceSphere(d.geom::geometry, ST_MakePoint(lon, lat)) / 1000.0)::numeric(10,2) as distance_km,
    ceil( (ST_DistanceSphere(d.geom::geometry, ST_MakePoint(lon, lat)) / 1000.0) / 30 * 60 )::int as eta_minutes
  from driver_locations d
  where ST_DWithin(d.geom, ST_MakePoint(lon, lat)::geography, radius_m)
  order by distance_km asc
  limit limit_n;
$$;

-- Add RLS policies for WhatsApp flows system (service role access)
CREATE POLICY "Service role full access conversations" ON public.whatsapp_conversations
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access flow_submissions" ON public.flow_submissions 
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access qr_defaults" ON public.qr_defaults
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access driver_locations" ON public.driver_locations
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access insurance_leads" ON public.insurance_leads
FOR ALL USING (auth.role() = 'service_role');