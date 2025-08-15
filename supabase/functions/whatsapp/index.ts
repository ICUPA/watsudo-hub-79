// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Environment variables - try multiple possible names
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || 
                     Deno.env.get("META_VERIFY_TOKEN") || 
                     Deno.env.get("VERIFY_TOKEN") ||
                     "bd0e7b6f4a2c9d83f1e57a0c6b3d48e9"; // Temporary hardcode
const SB_URL = Deno.env.get("SUPABASE_URL");
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Debug logging at startup
console.log("🔧 WhatsApp Function Environment Status:");
console.log("WHATSAPP_VERIFY_TOKEN:", VERIFY_TOKEN ? `SET (${VERIFY_TOKEN.length} chars)` : "NOT SET");
console.log("SUPABASE_URL:", SB_URL ? "SET" : "NOT SET");
console.log("SUPABASE_SERVICE_ROLE_KEY:", SB_SERVICE ? "SET" : "NOT SET");

const sb = SB_URL && SB_SERVICE ? createClient(SB_URL, SB_SERVICE) : null;

// WhatsApp API helpers
const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || 
                     Deno.env.get("META_ACCESS_TOKEN") ||
                     "YOUR_ACCESS_TOKEN_HERE"; // Replace with actual token
const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

async function sendMainMenu(to: string) {
  if (!ACCESS_TOKEN || !PHONE_ID) {
    console.error("❌ Missing WhatsApp credentials for sending");
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "Welcome to MoveRwanda! Choose a service:" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "MOBILITY", title: "🚕 Mobility" }},
              { type: "reply", reply: { id: "INSURANCE", title: "🛡️ Insurance" }},
              { type: "reply", reply: { id: "QR", title: "🔳 QR Codes" }}
            ]
          }
        }
      })
    });

    const result = await response.json();
    console.log("📤 Main menu sent:", result);

    if (sb) {
      await sb.from("whatsapp_logs").insert({
        direction: "out",
        phone_number: to,
        message_type: "interactive",
        message_content: "Main menu",
        metadata: result
      });
    }
  } catch (error) {
    console.error("❌ Failed to send main menu:", error);
  }
}

Deno.serve(async (req) => {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(req.url);
    console.log(`📞 ${req.method} ${url.pathname}${url.search}`);

    // Debug endpoint
    if (url.pathname.endsWith('/debug')) {
      return new Response(JSON.stringify({
        verify_token: VERIFY_TOKEN ? "SET" : "NOT SET",
        access_token: ACCESS_TOKEN ? "SET" : "NOT SET", 
        phone_id: PHONE_ID ? "SET" : "NOT SET",
        supabase_url: SB_URL ? "SET" : "NOT SET",
        service_key: SB_SERVICE ? "SET" : "NOT SET"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET: webhook verification
    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      
      console.log(`🔐 Verification attempt: mode=${mode}, token=${token}, challenge=${challenge}`);
      console.log(`🔑 Expected token: ${VERIFY_TOKEN || "NOT SET"}`);
      
      if (!VERIFY_TOKEN) {
        console.error("❌ VERIFY_TOKEN not configured");
        return new Response("Webhook not configured", { 
          status: 500,
          headers: corsHeaders
        });
      }
      
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("✅ Verification successful");
        return new Response(challenge ?? "", { 
          status: 200,
          headers: corsHeaders
        });
      }
      
      console.log("❌ Verification failed");
      return new Response("Verification failed", { 
        status: 403,
        headers: corsHeaders
      });
    }

    // POST: webhook messages
    if (req.method === "POST") {
      const body = await req.json();
      console.log("📨 Incoming webhook:", JSON.stringify(body, null, 2));
      
      // Extract message data
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0]?.value;
      const message = changes?.messages?.[0];
      const contact = changes?.contacts?.[0];
      
      if (message && contact) {
        const from = contact.wa_id;
        const text = message.text?.body;
        
        console.log(`📱 Message from ${from}: "${text}"`);
        
        // Send main menu for any text message
        if (text) {
          await sendMainMenu(from);
        }
      }
      
      if (sb) {
        await sb.from("whatsapp_logs").insert({
          direction: "in",
          phone_number: contact?.wa_id || "",
          message_type: "webhook", 
          message_content: JSON.stringify(body),
          metadata: body
        });
      }

      return new Response(JSON.stringify({ status: "received" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response("Method not allowed", { 
      status: 405,
      headers: corsHeaders
    });
    
  } catch (error) {
    console.error("❌ Function error:", error);
    return new Response(`Error: ${error.message}`, { 
      status: 500,
      headers: corsHeaders
    });
  }
});