// OCR Worker Edge Function
// Processes queued vehicle OCR jobs asynchronously to avoid blocking webhook responses

import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
const wabaPhoneId = Deno.env.get('META_PHONE_NUMBER_ID') || Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!;
const wabaToken = Deno.env.get('META_ACCESS_TOKEN') || Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface OCRJob {
  id: string;
  user_id: string;
  media_id: string;
  usage_type: string;
  status: string;
  attempts: number;
  max_attempts: number;
}

interface UserProfile {
  wa_phone: string;
  wa_name?: string;
}

// Send WhatsApp message
async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${wabaPhoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${wabaToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/^\+/, ""), // Remove + prefix for WhatsApp API
        type: "text",
        text: { body: message }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('WhatsApp API error:', response.status, errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    return false;
  }
}

// Fetch media from WhatsApp
async function fetchMedia(mediaId: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    // Get media metadata
    const metaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${wabaToken}` } }
    );

    if (!metaResponse.ok) {
      throw new Error(`Failed to fetch media metadata: ${metaResponse.status}`);
    }

    const metadata = await metaResponse.json();
    
    // Download media file
    const fileResponse = await fetch(metadata.url, {
      headers: { Authorization: `Bearer ${wabaToken}` }
    });

    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch media file: ${fileResponse.status}`);
    }

    return {
      bytes: new Uint8Array(await fileResponse.arrayBuffer()),
      mime: metadata.mime_type ?? "application/octet-stream"
    };
  } catch (error) {
    console.error('Media fetch failed:', error);
    return null;
  }
}

// Extract vehicle data using OpenAI Vision API
async function extractVehicleDataWithOpenAI(imageUrl: string): Promise<any> {
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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    // Parse JSON response
    try {
      return JSON.parse(content);
    } catch (parseError) {
      throw new Error(`Failed to parse OpenAI response as JSON: ${content.substring(0, 200)}...`);
    }
  } catch (error) {
    console.error('OpenAI API call failed:', error);
    throw error;
  }
}

// Process a single OCR job
async function processOCRJob(job: OCRJob): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    console.log(`Processing OCR job ${job.id} for user ${job.user_id}`);

    // Update job status to processing
    await supabase
      .from('vehicle_ocr_jobs')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    // Fetch media from WhatsApp
    const media = await fetchMedia(job.media_id);
    if (!media) {
      throw new Error('Failed to fetch media from WhatsApp');
    }

    // Upload to storage
    const path = `${job.user_id}/${crypto.randomUUID()}.${media.mime.includes("pdf") ? "pdf" : "jpg"}`;
    const { error: uploadError } = await supabase.storage
      .from("vehicle_docs")
      .upload(path, media.bytes, { 
        contentType: media.mime, 
        upsert: true 
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Get signed URL for OCR processing
    const { data: signedData } = await supabase.storage
      .from("vehicle_docs")
      .createSignedUrl(path, 600);

    if (!signedData?.signedUrl) {
      throw new Error('Failed to create signed URL');
    }

    // Extract vehicle data using OpenAI
    const extractedData = await extractVehicleDataWithOpenAI(signedData.signedUrl);

    // Store vehicle data
    const vehicleData = {
      user_id: job.user_id,
      plate: extractedData.plate || null,
      make: extractedData.make || null,
      model: extractedData.model || null,
      model_year: extractedData.year || null,
      vin: extractedData.vin || extractedData.chassis_number || null,
      insurance_provider: extractedData.insurance_provider || null,
      insurance_policy: extractedData.insurance_policy || null,
      insurance_expiry: extractedData.insurance_expiry || null,
      usage_type: job.usage_type,
      doc_url: path,
      verified: false,
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
        ocr_confidence: 'high'
      }
    };

    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .insert(vehicleData)
      .select()
      .single();

    if (vehicleError) {
      throw new Error(`Failed to store vehicle: ${vehicleError.message}`);
    }

    // Update job as completed
    await supabase
      .from('vehicle_ocr_jobs')
      .update({ 
        status: 'completed',
        result_data: { vehicle_id: vehicle.id, extracted_data: extractedData },
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    console.log(`OCR job ${job.id} completed successfully`);
    return { success: true, data: { vehicle_id: vehicle.id, extracted_data: extractedData } };

  } catch (error) {
    console.error(`OCR job ${job.id} failed:`, error);

    // Update job as failed
    const newAttempts = job.attempts + 1;
    const shouldRetry = newAttempts < job.max_attempts;
    
    await supabase
      .from('vehicle_ocr_jobs')
      .update({ 
        status: shouldRetry ? 'pending' : 'failed',
        attempts: newAttempts,
        error_message: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    return { 
      success: false, 
      error: error.message,
      data: { shouldRetry, attempts: newAttempts }
    };
  }
}

// Get user profile for WhatsApp notification
async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('wa_phone, wa_name')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return null;
  }
}

// Main handler
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'POST') {
      // Manual job processing (for testing)
      const { job_id } = await req.json();
      if (job_id) {
        const { data: job } = await supabase
          .from('vehicle_ocr_jobs')
          .select('*')
          .eq('id', job_id)
          .single();

        if (!job) {
          return new Response(
            JSON.stringify({ error: 'Job not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const result = await processOCRJob(job);
        
        // Send WhatsApp notification
        if (result.success) {
          const profile = await getUserProfile(job.user_id);
          if (profile?.wa_phone) {
            const plate = result.data?.extracted_data?.plate || 'unknown';
            await sendWhatsAppMessage(
              profile.wa_phone,
              `✅ Vehicle document processed successfully!\n\nPlate: ${plate}\nMake: ${result.data?.extracted_data?.make || 'N/A'}\nModel: ${result.data?.extracted_data?.model || 'N/A'}\n\nYour vehicle has been added to your profile.`
            );
          }
        } else if (!result.data?.shouldRetry) {
          // Final failure - notify user
          const profile = await getUserProfile(job.user_id);
          if (profile?.wa_phone) {
            await sendWhatsAppMessage(
              profile.wa_phone,
              `❌ Failed to process vehicle document after multiple attempts.\n\nError: ${result.error}\n\nPlease try again with a clearer image or contact support.`
            );
          }
        }

        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get pending jobs
    const { data: pendingJobs, error } = await supabase
      .from('vehicle_ocr_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('attempts', 2) // Only process jobs with <= 2 attempts
      .order('created_at', { ascending: true })
      .limit(5); // Process max 5 jobs per run

    if (error) {
      throw error;
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending jobs', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${pendingJobs.length} pending OCR jobs`);

    // Process jobs
    const results = [];
    for (const job of pendingJobs) {
      const result = await processOCRJob(job);
      results.push({ job_id: job.id, ...result });

      // Send WhatsApp notifications
      if (result.success) {
        const profile = await getUserProfile(job.user_id);
        if (profile?.wa_phone) {
          const plate = result.data?.extracted_data?.plate || 'unknown';
          await sendWhatsAppMessage(
            profile.wa_phone,
            `✅ Vehicle document processed successfully!\n\nPlate: ${plate}\nMake: ${result.data?.extracted_data?.make || 'N/A'}\nModel: ${result.data?.extracted_data?.model || 'N/A'}\n\nYour vehicle has been added to your profile.`
          );
        }
      } else if (!result.data?.shouldRetry) {
        // Final failure - notify user
        const profile = await getUserProfile(job.user_id);
        if (profile?.wa_phone) {
          await sendWhatsAppMessage(
            profile.wa_phone,
            `❌ Failed to process vehicle document after multiple attempts.\n\nError: ${result.error}\n\nPlease try again with a clearer image or contact support.`
          );
        }
      }

      // Small delay between jobs to avoid overwhelming APIs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return new Response(
      JSON.stringify({ 
        message: 'OCR jobs processed', 
        processed: results.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('OCR worker error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
