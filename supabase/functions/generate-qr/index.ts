import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

    // Normalize phone number to local format (remove +250 if present)
    const localNumber = identifier.startsWith("+250") ? `0${identifier.slice(4)}` : identifier;
    
    const ussd = type === "phone"
      ? amount 
        ? `*182*1*1*${localNumber}*${amount}#`
        : `*182*1*1*${localNumber}#`
      : amount
        ? `*182*8*1*${identifier}*${amount}#`
        : `*182*8*1*${identifier}#`;
    
    // Create tel: link for USSD launcher
    const telLink = `tel:${ussd.replace(/#/g, '%23')}`;
    
    // Generate QR code using QR Server API
    const qrSize = "300x300";
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}&data=${encodeURIComponent(telLink)}`;
    
    const qrResponse = await fetch(qrUrl);
    if (!qrResponse.ok) {
      throw new Error('Failed to generate QR code');
    }
    
    const qrBlob = await qrResponse.blob();
    const qrArrayBuffer = await qrBlob.arrayBuffer();
    const qrUint8Array = new Uint8Array(qrArrayBuffer);
    
    // Upload to Supabase Storage
    const fileName = `qr-${type}-${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('qr-codes')
      .upload(fileName, qrUint8Array, {
        contentType: 'image/png',
        upsert: false
      });

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

    // Get public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('qr-codes')
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