import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OCRRequest {
  file_url: string;
  user_id: string;
  usage_type: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { file_url, user_id, usage_type }: OCRRequest = await req.json();

    console.log('Processing vehicle OCR:', { file_url, user_id, usage_type });

    // In a real implementation, this would use OCR services like:
    // - Google Cloud Vision API
    // - AWS Textract
    // - Azure Computer Vision
    // For now, we'll simulate OCR extraction

    // Simulated OCR extraction (replace with real OCR service)
    const mockOCRData = {
      plate: `RAB ${Math.floor(Math.random() * 900) + 100}A`,
      owner: "John Doe",
      insurer: "SONARWA",
      policy_number: `POL${Math.floor(Math.random() * 900000) + 100000}`,
      make: "Toyota",
      model: "Corolla",
      year: 2020 + Math.floor(Math.random() * 4),
      vin: `1HGBH41JXMN${Math.floor(Math.random() * 900000) + 100000}`,
      insurance_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };

    // Create vehicle record
    const { data: vehicleData, error: vehicleError } = await supabase
      .from('vehicles')
      .insert({
        user_id,
        usage_type,
        plate: mockOCRData.plate,
        vin: mockOCRData.vin,
        make: mockOCRData.make,
        model: mockOCRData.model,
        model_year: mockOCRData.year,
        insurance_provider: mockOCRData.insurer,
        insurance_policy: mockOCRData.policy_number,
        insurance_expiry: mockOCRData.insurance_expiry,
        doc_url: file_url,
        verified: false,
        extra: {
          ocr_extracted: true,
          ocr_confidence: 0.95
        }
      })
      .select()
      .single();

    if (vehicleError) {
      console.error('Error creating vehicle:', vehicleError);
      throw new Error('Failed to create vehicle record');
    }

    console.log('Vehicle created:', vehicleData.id);

    // If the usage type is for drivers, create driver record
    const driverTypes = ['moto', 'cab', 'liffan', 'truck'];
    if (driverTypes.includes(usage_type)) {
      const { error: driverError } = await supabase
        .from('drivers')
        .insert({
          user_id,
          is_active: true,
          rating: 0.0,
          total_trips: 0,
          driver_features: {
            vehicle_types: [usage_type]
          }
        });

      if (driverError && driverError.code !== '23505') { // Ignore duplicate key error
        console.error('Error creating driver:', driverError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          vehicle: vehicleData,
          extracted_data: mockOCRData
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in process-vehicle-ocr function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
})