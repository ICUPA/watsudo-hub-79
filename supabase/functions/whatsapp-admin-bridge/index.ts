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
const WABA_PHONE_ID = Deno.env.get('META_PHONE_NUMBER_ID')!;
const WABA_TOKEN = Deno.env.get('META_ACCESS_TOKEN')!;

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

async function sendWhatsAppButtons(to: string, body: string, buttons: Array<{id: string, title: string}>) {
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
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: body },
          action: {
            buttons: buttons.map(b => ({
              type: "reply",
              reply: b
            }))
          }
        }
      })
    });
  } catch (error) {
    console.error('WhatsApp send error:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  try {
    // Quote PDF attachment and customer notification
    if (req.method === "POST" && url.pathname.endsWith("/quotes/attach-pdf")) {
      const { quote_id, storage_path, amount_cents } = await req.json();
      
      // Get quote and user info
      const { data: quote } = await sb
        .from("insurance_quotes")
        .select(`
          *,
          profiles!insurance_quotes_user_id_fkey(wa_phone, wa_name)
        `)
        .eq("id", quote_id)
        .single();

      if (!quote) throw new Error("Quote not found");

      // Update quote with PDF and pricing
      const updatedQuoteData = {
        ...(quote.quote_data as any || {}),
        quote_pdf_path: storage_path,
        amount_cents
      };
      
      await sb
        .from("insurance_quotes")
        .update({ 
          quote_data: updatedQuoteData,
          status: "quoted" 
        })
        .eq("id", quote_id);

      // Get public URL for the PDF
      const { data: { publicUrl } } = sb.storage
        .from("quotes")
        .getPublicUrl(storage_path);

      // Send WhatsApp notification with quote
      const userPhone = (quote as any).profiles?.wa_phone;
      if (userPhone) {
        await sendWhatsAppMessage(
          userPhone,
          `🧾 Your insurance quotation is ready!\n\nAmount: ${(amount_cents / 100).toLocaleString()} RWF\n\nQuote: ${publicUrl}`
        );
        
        await sendWhatsAppButtons(
          userPhone,
          "What would you like to do?",
          [
            { id: "PROCEED", title: "💳 Proceed to Pay" },
            { id: "ASK_CHANGES", title: "✏️ Request Changes" },
            { id: "CANCEL", title: "❌ Cancel" }
          ]
        );

        // Update user's chat session state
        await sb
          .from("chat_sessions")
          .update({ 
            state: "INS_DECIDE", 
            context: { quote_id } 
          })
          .eq("user_id", quote.user_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Certificate issuance and delivery
    if (req.method === "POST" && url.pathname.endsWith("/quotes/issue-certificate")) {
      const { quote_id, cert_storage_path } = await req.json();
      
      // Insert certificate record
      await sb
        .from("insurance_certificates")
        .insert({
          quote_id,
          certificate_pdf_path: cert_storage_path
        });

      // Update quote status
      const { data: quote } = await sb
        .from("insurance_quotes")
        .update({ status: "issued" })
        .eq("id", quote_id)
        .select(`
          *,
          profiles!insurance_quotes_user_id_fkey(wa_phone, wa_name)
        `)
        .single();

      // Get public URL for certificate
      const { data: { publicUrl } } = sb.storage
        .from("certificates")
        .getPublicUrl(cert_storage_path);

      // Send WhatsApp notification with certificate
      const userPhone = (quote as any).profiles?.wa_phone;
      if (userPhone) {
        await sendWhatsAppMessage(
          userPhone,
          `✅ Your insurance certificate is now ACTIVE!\n\nCertificate: ${publicUrl}\n\nYour vehicle is now legally insured. Keep this certificate safe!`
        );
        
        // Reset user to main menu
        await sb
          .from("chat_sessions")
          .update({ 
            state: "MAIN_MENU", 
            context: {} 
          })
          .eq("user_id", quote.user_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Vehicle verification notification
    if (req.method === "POST" && url.pathname.endsWith("/vehicles/verify")) {
      const { vehicle_id } = await req.json();
      
      const { data: vehicle } = await sb
        .from("vehicles")
        .update({ verified: true })
        .eq("id", vehicle_id)
        .select(`
          *,
          profiles!vehicles_user_id_fkey(wa_phone, wa_name)
        `)
        .single();

      const userPhone = (vehicle as any)?.profiles?.wa_phone;
      if (userPhone) {
        await sendWhatsAppMessage(
          userPhone,
          `✅ Vehicle Verified!\n\nYour vehicle ${vehicle?.plate || 'registration'} has been verified and approved.\n\nYou can now:\n• Get insurance quotes\n• Register as a driver\n• Access all services`
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Driver activation notification
    if (req.method === "POST" && url.pathname.endsWith("/drivers/activate")) {
      const { driver_id } = await req.json();
      
      const { data: driver } = await sb
        .from("drivers")
        .update({ is_active: true })
        .eq("id", driver_id)
        .select(`
          *,
          profiles!drivers_user_id_fkey(wa_phone, wa_name)
        `)
        .single();

      const userPhone = (driver as any)?.profiles?.wa_phone;
      if (userPhone) {
        await sendWhatsAppMessage(
          userPhone,
          "🚗 Driver Activation Complete!\n\nCongratulations! You are now an active driver.\n\n✅ You can receive ride requests\n✅ Set your availability\n✅ Earn with every trip\n\nStart driving safely!"
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Payment processing notification
    if (req.method === "POST" && url.pathname.endsWith("/payments/process")) {
      const { quote_id, amount_cents, payer_phone, provider_ref } = await req.json();
      
      // Record payment
      await sb
        .from("payments")
        .insert({
          quote_id,
          amount_cents,
          payer_phone_e164: payer_phone,
          provider_ref,
          status: "received"
        });

      // Update quote status
      const { data: quote } = await sb
        .from("insurance_quotes")
        .update({ status: "paid" })
        .eq("id", quote_id)
        .select(`
          *,
          profiles!insurance_quotes_user_id_fkey(wa_phone, wa_name)
        `)
        .single();

      const userPhone = (quote as any)?.profiles?.wa_phone;
      if (userPhone) {
        await sendWhatsAppMessage(
          userPhone,
          `✅ Payment Received!\n\nThank you! Your payment of ${(amount_cents / 100).toLocaleString()} RWF has been confirmed.\n\nYour insurance certificate will be issued within 24 hours.\n\nReference: ${provider_ref}`
        );
        
        // Update session to awaiting certificate
        await sb
          .from("chat_sessions")
          .update({ 
            state: "INS_ISSUED", 
            context: { quote_id } 
          })
          .eq("user_id", quote.user_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response("Not found", { status: 404 });

  } catch (error) {
    console.error('WhatsApp Admin Bridge error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});