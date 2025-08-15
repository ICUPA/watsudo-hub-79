// WhatsApp Business API webhook function
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import * as base64 from "https://deno.land/std@0.223.0/encoding/base64.ts";
import { toDataURL } from "https://deno.land/x/qrcode@v2.0.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Environment variables
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "bd0e7b6f4a2c9d83f1e57a0c6b3d48e9";
const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "EAAGHrMn6uugBO9xlSTNU1FsbnZB7AnBLCvTlgZCYQDZC8OZA7q3nrtxpxn3VgHiT8o9KbKQIyoPNrESHKZCq2c9B9lvNr2OsT8YDBewaDD1OzytQd74XlmSOgxZAVL6TEQpDT43zZCZBwQg9AZA5QPeksUVzmAqTaoNyIIaaqSvJniVmn6dW1rw88dbZAyR6VZBMTTpjQZDZD";
const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const SB_URL = Deno.env.get("SUPABASE_URL");
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const sb = SB_URL && SB_SERVICE ? createClient(SB_URL, SB_SERVICE) : null;

// WhatsApp API helpers
async function sendMessage(to: string, text: string) {
  const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "text", 
      text: { body: text }
    })
  });
  return await response.json();
}

async function sendButtons(to: string, text: string, buttons: {id: string, title: string}[]) {
  const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: text },
        action: { buttons: buttons.map(b => ({ type: "reply", reply: b })) }
      }
    })
  });
  return await response.json();
}

// Main menu
async function showMainMenu(to: string) {
  await sendButtons(to, "Welcome to Mobility Hub! Choose a service:", [
    { id: "MOBILITY", title: "🚕 Mobility" },
    { id: "INSURANCE", title: "🛡️ Insurance" },
    { id: "QR", title: "🔳 QR Codes" }
  ]);
}

// Process incoming messages
async function processMessage(from: string, message: any, interactiveId?: string) {
  console.log(`Processing message from ${from}, type: ${message.type}, interactive: ${interactiveId}`);
  
  // Main menu navigation
  if (interactiveId === "MOBILITY") {
    await sendMessage(from, "🚕 Mobility services:\n- Nearby drivers\n- Schedule trips\n- Add vehicles\n\nComing soon!");
    await showMainMenu(from);
    return;
  }
  
  if (interactiveId === "INSURANCE") {
    await sendMessage(from, "🛡️ Insurance services:\n- Motor insurance quotes\n- Certificate issuance\n- Claims support\n\nComing soon!");
    await showMainMenu(from);
    return;
  }
  
  if (interactiveId === "QR") {
    await sendMessage(from, "🔳 QR Code services:\n- Generate payment QR codes\n- USSD shortcuts\n- Mobile money integration\n\nComing soon!");
    await showMainMenu(from);
    return;
  }
  
  // Default: show main menu for any text message
  if (message.type === "text") {
    await showMainMenu(from);
  }
}

// Main function
Deno.serve(async (req) => {
  try {
    console.log(`📥 ${req.method} ${req.url}`);

    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(req.url);

    // Debug endpoint
    if (url.pathname.endsWith('/debug')) {
      return new Response(JSON.stringify({
        status: "WhatsApp function is running",
        timestamp: new Date().toISOString(),
        config: {
          hasVerifyToken: !!VERIFY_TOKEN,
          hasAccessToken: !!ACCESS_TOKEN,
          hasPhoneId: !!PHONE_ID,
          hasSupabaseUrl: !!SB_URL,
          hasServiceKey: !!SB_SERVICE
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Webhook verification
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      
      console.log(`🔐 Verification: mode=${mode}, token=${token ? 'SET' : 'MISSING'}`);
      
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log("✅ Verification successful");
        return new Response(challenge || "", { status: 200, headers: corsHeaders });
      }
      
      console.log("❌ Verification failed");
      return new Response("Verification failed", { status: 403, headers: corsHeaders });
    }

    // Process webhook messages
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      console.log("📨 Webhook payload:", JSON.stringify(body, null, 2));
      
      // Log to database
      if (sb) {
        try {
          await sb.from("whatsapp_logs").insert({ 
            direction: "in", 
            payload: body 
          });
        } catch (logError) {
          console.error("⚠️ Failed to log:", logError);
        }
      }

      // Process messages
      const entry = body?.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const message = change?.messages?.[0];
      const contact = change?.contacts?.[0];
      
      if (message && contact) {
        const from = contact.wa_id;
        
        // Extract interactive ID
        const interactiveId = message.interactive?.type === "button_reply" 
          ? message.interactive.button_reply?.id
          : message.interactive?.type === "list_reply"
          ? message.interactive.list_reply?.id
          : undefined;
        
        try {
          await processMessage(from, message, interactiveId);
          console.log("✅ Message processed");
        } catch (processError) {
          console.error("❌ Process error:", processError);
        }
      }

      return new Response(JSON.stringify({ status: "received" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    
  } catch (error) {
    console.error("💥 Function error:", error);
    return new Response(`Error: ${error.message}`, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});