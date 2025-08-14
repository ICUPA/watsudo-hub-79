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

interface OpenAIVisionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

async function extractVehicleDataWithOpenAI(imageUrl: string): Promise<any> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  console.log('Calling OpenAI Vision API for OCR extraction...');

  const prompt = `You are an expert at extracting vehicle information from insurance documents and vehicle registration certificates. 

Analyze this insurance certificate/document image and extract the following vehicle information in JSON format:

{
  "plate": "vehicle license plate number (e.g., RAB 123A)",
  "owner": "vehicle owner name", 
  "make": "vehicle make/brand (e.g., Toyota, Honda, Suzuki)",
  "model": "vehicle model (e.g., Corolla, Civic, Swift)",
  "year": "manufacturing year as number (e.g., 2020)",
  "vin": "vehicle identification number or chassis number",
  "insurance_provider": "insurance company name (e.g., SONARWA, SORAS)",
  "insurance_policy": "policy number",
  "insurance_expiry": "expiry date in YYYY-MM-DD format",
  "chassis_number": "chassis number if different from VIN",
  "engine_number": "engine number if available",
  "vehicle_type": "type of vehicle (motorcycle, car, truck, bus, etc.)",
  "color": "vehicle color",
  "engine_capacity": "engine capacity/displacement if available"
}

CRITICAL INSTRUCTIONS:
- Return ONLY valid JSON, no markdown, explanations, or extra text
- Use null for any field you cannot find clearly
- For dates, use YYYY-MM-DD format strictly
- For year, return as a number
- Be extremely careful with license plate extraction - this is the most important field
- Look for both French and English text (Rwanda documents may have both)
- Common insurance companies in Rwanda: SONARWA, SORAS, UAP Insurance, Prudential
- License plates usually follow format: RAA 123A, RAB 456B, etc.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Use latest vision-capable model
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1 // Low temperature for consistent extraction
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const result: OpenAIVisionResponse = await response.json();
    
    if (!result.choices || result.choices.length === 0) {
      throw new Error('No response from OpenAI');
    }

    const extractedText = result.choices[0].message.content;
    console.log('OpenAI extraction result:', extractedText);

    // Clean the response to extract just the JSON
    let jsonText = extractedText.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    // Parse the JSON response
    try {
      const extractedData = JSON.parse(jsonText);
      console.log('Successfully parsed extracted data:', extractedData);
      return extractedData;
    } catch (parseError) {
      console.error('Failed to parse OpenAI JSON response:', parseError);
      console.error('Raw response:', extractedText);
      console.error('Cleaned JSON text:', jsonText);
      throw new Error('Failed to parse extraction results - invalid JSON format');
    }

  } catch (error) {
    console.error('OpenAI Vision API error:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request
    const { file_url, user_id, usage_type }: OCRRequest = await req.json();

    console.log('=== Processing OCR Request ===');
    console.log('File URL:', file_url);
    console.log('User ID:', user_id);
    console.log('Usage type:', usage_type);

    // Validate inputs
    if (!file_url || !user_id || !usage_type) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: file_url, user_id, and usage_type are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Extract vehicle data using OpenAI Vision API
    let extractedData;
    try {
      extractedData = await extractVehicleDataWithOpenAI(file_url);
      console.log('Successfully extracted vehicle data:', extractedData);
    } catch (ocrError) {
      console.error('OCR extraction failed:', ocrError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to extract vehicle data from document. Please ensure the image is clear and contains readable vehicle/insurance information.',
          details: ocrError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate that we extracted meaningful data
    if (!extractedData || (typeof extractedData !== 'object')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No valid vehicle data could be extracted from the document' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if we have at least one key identifier
    if (!extractedData.plate && !extractedData.vin && !extractedData.chassis_number) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not extract vehicle plate, VIN, or chassis number from document. Please ensure the image is clear and contains valid vehicle identification information.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Store vehicle data
    const vehicleInsertData = {
      user_id,
      plate: extractedData.plate || null,
      make: extractedData.make || null,
      model: extractedData.model || null,
      model_year: extractedData.year || null,
      vin: extractedData.vin || extractedData.chassis_number || null,
      insurance_provider: extractedData.insurance_provider || null,
      insurance_policy: extractedData.insurance_policy || null,
      insurance_expiry: extractedData.insurance_expiry || null,
      usage_type,
      doc_url: file_url,
      verified: false, // Set to true after manual verification
      extra: {
        owner: extractedData.owner || null,
        chassis_number: extractedData.chassis_number || null,
        engine_number: extractedData.engine_number || null,
        vehicle_type: extractedData.vehicle_type || null,
        color: extractedData.color || null,
        engine_capacity: extractedData.engine_capacity || null,
        processed_at: new Date().toISOString(),
        processing_method: 'openai_vision_ocr',
        raw_extraction: extractedData,
        ocr_confidence: 'high' // OpenAI Vision generally has high confidence
      }
    };

    console.log('Inserting vehicle data:', vehicleInsertData);

    const { data: vehicleData, error: vehicleError } = await supabase
      .from('vehicles')
      .insert(vehicleInsertData)
      .select()
      .single();

    if (vehicleError) {
      console.error('Error storing vehicle data:', vehicleError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to store vehicle data in database',
          details: vehicleError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Vehicle stored successfully with ID:', vehicleData.id);

    // If usage type indicates driver role, create/update driver record
    const driverUsageTypes = ['moto_taxi', 'cab', 'liffan', 'truck', 'moto', 'taxi'];
    let driverData = null;
    
    if (driverUsageTypes.includes(usage_type.toLowerCase())) {
      console.log('Creating/updating driver record for usage type:', usage_type);
      
      try {
        // Check if driver record already exists
        const { data: existingDriver } = await supabase
          .from('drivers')
          .select('*')
          .eq('user_id', user_id)
          .maybeSingle();

        const currentVehicleTypes = existingDriver?.driver_features?.vehicle_types || [];
        const currentVehicleIds = existingDriver?.driver_features?.vehicle_ids || [];

        const driverInsertData = {
          user_id,
          is_active: true,
          driver_features: {
            vehicle_types: [...new Set([...currentVehicleTypes, usage_type])],
            can_receive_passengers: true,
            vehicle_ids: [...new Set([...currentVehicleIds, vehicleData.id])],
            last_vehicle_added: vehicleData.id
          },
          last_seen_at: new Date().toISOString()
        };

        const { data: driver, error: driverError } = await supabase
          .from('drivers')
          .upsert(driverInsertData, { onConflict: 'user_id' })
          .select()
          .single();

        if (driverError) {
          console.error('Error creating driver record:', driverError);
          // Don't fail the request, just log the error
        } else {
          console.log('Driver record created/updated with ID:', driver.id);
          driverData = driver;
        }
      } catch (driverCreateError) {
        console.error('Error in driver creation process:', driverCreateError);
        // Continue without failing the main request
      }
    }

    // Return success response
    const responseData = {
      success: true,
      data: {
        vehicle: vehicleData,
        driver: driverData,
        extracted_data: extractedData
      },
      message: `Vehicle successfully processed and ${driverData ? 'driver profile updated' : 'stored'}`
    };

    console.log('=== OCR Processing Complete ===');
    console.log('Vehicle ID:', vehicleData.id);
    console.log('Driver created:', !!driverData);

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('=== OCR Processing Error ===');
    console.error('Error details:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred during processing',
        details: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
})