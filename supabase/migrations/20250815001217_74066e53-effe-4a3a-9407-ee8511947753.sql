-- Create chat_sessions table for conversation state management
CREATE TABLE public.chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  state TEXT NOT NULL DEFAULT 'main_menu',
  context JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for chat_sessions
CREATE POLICY "Service can manage all chat sessions" 
ON public.chat_sessions 
FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Users can manage their own chat sessions" 
ON public.chat_sessions 
FOR ALL 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_chat_sessions_updated_at
BEFORE UPDATE ON public.chat_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_state ON public.chat_sessions(state);

-- Create nearby_drivers RPC function for location-based queries
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