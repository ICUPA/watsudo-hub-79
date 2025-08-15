-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.nearby_drivers(lat FLOAT, lng FLOAT, km INTEGER DEFAULT 15)
RETURNS TABLE(
  driver_id UUID,
  wa_name TEXT,
  distance_km FLOAT,
  vehicle_type TEXT,
  rating NUMERIC,
  is_online BOOLEAN
) 
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    d.id as driver_id,
    p.wa_name,
    ROUND(CAST(6371 * acos(cos(radians(lat)) * cos(radians(CAST(d.location->>'lat' AS FLOAT))) * cos(radians(CAST(d.location->>'lng' AS FLOAT)) - radians(lng)) + sin(radians(lat)) * sin(radians(CAST(d.location->>'lat' AS FLOAT)))) AS NUMERIC), 2) as distance_km,
    v.usage_type as vehicle_type,
    d.rating,
    d.is_active as is_online
  FROM drivers d
  JOIN profiles p ON p.user_id = d.user_id
  LEFT JOIN vehicles v ON v.user_id = d.user_id AND v.usage_type IN ('moto_taxi', 'cab', 'liffan', 'truck')
  WHERE d.is_active = true 
    AND d.location IS NOT NULL
    AND d.location->>'lat' IS NOT NULL
    AND d.location->>'lng' IS NOT NULL
    AND 6371 * acos(cos(radians(lat)) * cos(radians(CAST(d.location->>'lat' AS FLOAT))) * cos(radians(CAST(d.location->>'lng' AS FLOAT)) - radians(lng)) + sin(radians(lat)) * sin(radians(CAST(d.location->>'lat' AS FLOAT)))) <= km
  ORDER BY distance_km
  LIMIT 10;
$$;