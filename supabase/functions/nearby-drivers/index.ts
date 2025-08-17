import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "../_shared/wa.ts"; // placeholder import for future use

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude, radius_km = 15, vehicle_type } = await req.json();

    console.log('Searching for drivers:', { latitude, longitude, radius_km, vehicle_type });

    // Query nearby drivers via PostGIS RPC
    const { data: drivers, error: rpcError } = await sb.rpc('nearby_drivers', {
      lat: latitude,
      lng: longitude,
      km: radius_km
    });
    if (rpcError) throw rpcError;

    // Simplified formatting
    const formatted = (drivers || []).map(d => ({
      driver_id: d.driver_id,
      distance_km: Math.round(d.distance_km * 10) / 10,
      eta_minutes: Math.ceil(d.distance_km * 2)
    }));
    
    return new Response(
      JSON.stringify({ success: true, drivers: formatted.slice(0, 10), total_found: formatted.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Nearby drivers error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
