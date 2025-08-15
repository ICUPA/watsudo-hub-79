import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(supabaseUrl, supabaseServiceKey);

const GRAPH = "https://graph.facebook.com/v20.0";
const WABA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || Deno.env.get('META_PHONE_NUMBER_ID')!;
const WABA_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || Deno.env.get('META_ACCESS_TOKEN')!;

async function sendWhatsAppDocument(to: string, documentUrl: string, caption: string) {
  try {
    await fetch(`${GRAPH}/${WABA_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WABA_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace("+", ""),
        type: "document",
        document: {
          link: documentUrl,
          caption: caption
        }
      })
    });
  } catch (error) {
    console.error('WhatsApp send error:', error);
  }
}

async function sendWhatsAppMessage(to: string, message: string) {
  try {
    await fetch(`${GRAPH}/${WABA_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WABA_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace("+", ""),
        type: "text",
        text: { body: message }
      })
    });
  } catch (error) {
    console.error('WhatsApp send error:', error);
  }
}

async function updateChatSessionState(userId: string, state: string, context = {}) {
  await sb.from("chat_sessions")
    .update({ state, context })
    .eq("user_id", userId);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  try {
    // Insurance Quote Management
    if (req.method === "POST" && url.pathname.endsWith("/quotes/attach-pdf")) {
      const { quote_id, storage_path, amount_cents } = await req.json();
      
      // Update quote with PDF and amount
      const { data: quote, error } = await sb.from("insurance_quotes")
        .update({ 
          quote_data: { ...quote_data || {}, quote_pdf_path: storage_path, amount_cents },
          status: "quoted" 
        })
        .eq("id", quote_id)
        .select(`
          *,
          profiles!insurance_quotes_user_id_fkey(wa_phone)
        `)
        .single();

      if (error) throw error;

      // Get public URL for document
      const { data: { publicUrl } } = sb.storage
        .from("quotes")
        .getPublicUrl(storage_path);

      // Send to WhatsApp user
      const userPhone = quote.profiles?.wa_phone;
      if (userPhone) {
        await sendWhatsAppDocument(
          userPhone, 
          publicUrl, 
          `Your insurance quotation is ready. Amount: ${amount_cents / 100} RWF`
        );
        
        // Update user's chat session to decision state
        await updateChatSessionState(quote.user_id, "INS_DECIDE", { quote_id });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Certificate Issuance
    if (req.method === "POST" && url.pathname.endsWith("/quotes/issue-certificate")) {
      const { quote_id, cert_storage_path } = await req.json();
      
      // Insert certificate record
      await sb.from("insurance_certificates").insert({
        quote_id,
        certificate_pdf_path: cert_storage_path
      });

      // Update quote status
      const { data: quote } = await sb.from("insurance_quotes")
        .update({ status: "issued" })
        .eq("id", quote_id)
        .select(`
          *,
          profiles!insurance_quotes_user_id_fkey(wa_phone)
        `)
        .single();

      // Get public URL for certificate
      const { data: { publicUrl } } = sb.storage
        .from("certificates")
        .getPublicUrl(cert_storage_path);

      // Send to WhatsApp user
      const userPhone = quote?.profiles?.wa_phone;
      if (userPhone) {
        await sendWhatsAppDocument(
          userPhone,
          publicUrl,
          "Your insurance certificate is now active ✅"
        );
        
        // Reset user's chat session to main menu
        await updateChatSessionState(quote.user_id, "MAIN_MENU", {});
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Vehicle Verification
    if (req.method === "POST" && url.pathname.endsWith("/vehicles/verify")) {
      const { vehicle_id } = await req.json();
      
      const { data: vehicle } = await sb.from("vehicles")
        .update({ verified: true })
        .eq("id", vehicle_id)
        .select(`
          *,
          profiles!vehicles_user_id_fkey(wa_phone)
        `)
        .single();

      // Notify user via WhatsApp
      const userPhone = vehicle?.profiles?.wa_phone;
      if (userPhone) {
        await sendWhatsAppMessage(
          userPhone,
          `✅ Your vehicle ${vehicle.plate || 'registration'} has been verified and approved for use.`
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Driver Management
    if (req.method === "POST" && url.pathname.endsWith("/drivers/activate")) {
      const { driver_id } = await req.json();
      
      const { data: driver } = await sb.from("drivers")
        .update({ is_active: true })
        .eq("id", driver_id)
        .select(`
          *,
          profiles!drivers_user_id_fkey(wa_phone)
        `)
        .single();

      // Notify driver via WhatsApp
      const userPhone = driver?.profiles?.wa_phone;
      if (userPhone) {
        await sendWhatsAppMessage(
          userPhone,
          "🚗 You have been activated as a driver! You can now receive ride requests."
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Payment Processing
    if (req.method === "POST" && url.pathname.endsWith("/payments/process")) {
      const { quote_id, amount_cents, payer_phone, provider_ref } = await req.json();
      
      // Insert payment record
      await sb.from("payments").insert({
        quote_id,
        amount_cents,
        payer_phone_e164: payer_phone,
        provider_ref,
        status: "received"
      });

      // Update quote status
      const { data: quote } = await sb.from("insurance_quotes")
        .update({ status: "paid" })
        .eq("id", quote_id)
        .select(`
          *,
          profiles!insurance_quotes_user_id_fkey(wa_phone)
        `)
        .single();

      // Notify user
      const userPhone = quote?.profiles?.wa_phone;
      if (userPhone) {
        await sendWhatsAppMessage(
          userPhone,
          "✅ Payment received! Your insurance certificate will be issued shortly."
        );
        
        // Update session to awaiting certificate
        await updateChatSessionState(quote.user_id, "INS_ISSUED", { quote_id });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response("Not found", { status: 404 });

  } catch (error) {
    console.error('Admin API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});