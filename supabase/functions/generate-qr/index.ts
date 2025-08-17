import { serve } from "https://deno.land/std@0.223.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { normalizePhone, buildUSSD, buildTelLink } from "../_shared/wa.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface QRRequest {
  type: "phone" | "code";
  identifier: string;
  amount?: number;
  user_id: string;
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

    const { type, identifier, amount, user_id }: QRRequest = await req.json();

    console.log('Generating QR code:', { type, identifier, amount, user_id });

    // Build USSD code and tel: link
    const phone = type === "phone" ? normalizePhone(identifier) : identifier;
    const ussd = buildUSSD(type, phone, amount);
    const telLink = buildTelLink(ussd);
    
    // Generate QR code using QR Server API
    // Generate QR code image from public API
    const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(telLink)}`;
    const qrRes = await fetch(apiUrl);
    if (!qrRes.ok) throw new Error('Failed to generate QR code');
    const bytes = new Uint8Array(await qrRes.arrayBuffer());

    // Upload to canonical public bucket 'qr'
    const fileName = `qr-${type}-${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('qr')
      .upload(fileName, bytes, { contentType: 'image/png' });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload QR code');
    }

    console.log('QR code uploaded:', uploadData.path);

    // Save to database
    const { data: qrData, error: dbError } = await supabase
      .from('qr_generations')
      .insert({
        user_id,
        ussd,
        file_path: uploadData.path,
        amount,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to save QR generation record');
    }

    // Build public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('qr')
      .getPublicUrl(uploadData.path);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: qrData.id,
          ussd,
          telLink,
          qrCodeUrl: publicUrl,
          amount,
          type,
          identifier: localNumber
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in generate-qr function:', error);
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
