import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Query nearby active drivers using PostGIS
    const { data: drivers, error } = await sb.rpc('nearby_drivers', {
      lat: latitude,
      lng: longitude,
      km: radius_km
    });

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log('Found drivers:', drivers?.length || 0);

    // Filter by vehicle type if specified
    let filteredDrivers = drivers || [];
    if (vehicle_type) {
      const { data: driverVehicles } = await sb
        .from('drivers')
        .select(`
          id,
          driver_features,
          profiles!drivers_user_id_fkey(wa_phone, wa_name)
        `)
        .in('id', filteredDrivers.map(d => d.driver_id));

      filteredDrivers = filteredDrivers.filter(driver => {
        const driverData = driverVehicles?.find(dv => dv.id === driver.driver_id);
        const vehicleTypes = driverData?.driver_features?.vehicle_types || [];
        return vehicleTypes.includes(vehicle_type);
      });
    }

    // Format response
    const formattedDrivers = filteredDrivers.map(driver => ({
      driver_id: driver.driver_id,
      distance_km: Math.round(driver.distance_km * 10) / 10,
      wa_phone: driver.wa_phone,
      wa_name: driver.wa_name || 'Driver',
      rating: 5.0, // Default rating
      eta_minutes: Math.ceil(driver.distance_km * 2) // Rough estimate
    }));

    return new Response(JSON.stringify({
      success: true,
      drivers: formattedDrivers.slice(0, 10), // Limit to top 10
      total_found: formattedDrivers.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

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