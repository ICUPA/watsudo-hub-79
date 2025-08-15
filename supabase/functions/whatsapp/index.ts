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
  
  // Handle interactive button clicks
  if (interactiveId) {
    console.log(`🎯 Interactive button clicked: ${interactiveId}`);
    
    if (interactiveId === "MOBILITY") {
      await sendButtons(from, "🚕 Mobility services - Choose an option:", [
        { id: "NEARBY_DRIVERS", title: "🚗 Nearby Drivers" },
        { id: "SCHEDULE_TRIP", title: "📅 Schedule Trip" },
        { id: "ADD_VEHICLE", title: "🚙 Add Vehicle" },
        { id: "BACK_MAIN", title: "⬅️ Back to Main" }
      ]);
      return;
    }
    
    if (interactiveId === "INSURANCE") {
      await sendButtons(from, "🛡️ Insurance services - Choose an option:", [
        { id: "MOTOR_QUOTE", title: "📋 Motor Quote" },
        { id: "CERTIFICATE", title: "📜 Certificate" },
        { id: "CLAIMS", title: "🔧 Claims Support" },
        { id: "BACK_MAIN", title: "⬅️ Back to Main" }
      ]);
      return;
    }
    
    if (interactiveId === "QR") {
      await sendButtons(from, "🔳 QR Code services - Choose type:", [
        { id: "QR_PHONE", title: "📱 Phone Number" },
        { id: "QR_CODE", title: "🔢 MoMo Code" },
        { id: "QR_GENERATE", title: "⚡ Quick Generate" },
        { id: "BACK_MAIN", title: "⬅️ Back to Main" }
      ]);
      return;
    }
    
    // Handle sub-menu options
    if (interactiveId === "NEARBY_DRIVERS") {
      await sendMessage(from, "🚗 To find nearby drivers, please share your location using the attachment button (📎) → Location");
      return;
    }
    
    if (interactiveId === "SCHEDULE_TRIP") {
      await sendMessage(from, "📅 Schedule Trip:\n1. Share pickup location\n2. Share destination\n3. Choose date & time\n\nStart by sharing your pickup location!");
      return;
    }
    
    if (interactiveId === "ADD_VEHICLE") {
      await sendMessage(from, "🚙 Add Vehicle:\nPlease upload a clear photo of your vehicle's insurance certificate or registration document.");
      return;
    }
    
    if (interactiveId === "MOTOR_QUOTE") {
      await sendMessage(from, "📋 Motor Insurance Quote:\nPlease provide:\n1. Vehicle registration/plate number\n2. Vehicle make and model\n3. Desired coverage period\n\nType your vehicle details to start.");
      return;
    }
    
    if (interactiveId === "QR_PHONE") {
      await sendMessage(from, "📱 Generate QR for phone number:\nPlease send your mobile money phone number (e.g., 0788123456)");
      return;
    }
    
    if (interactiveId === "QR_CODE") {
      await sendMessage(from, "🔢 Generate QR for MoMo code:\nPlease send your merchant/agent code (4-6 digits)");
      return;
    }
    
    if (interactiveId === "BACK_MAIN") {
      await showMainMenu(from);
      return;
    }
    
    // Default for unhandled interactive IDs
    await sendMessage(from, "⚠️ This feature is under development. Please try another option.");
    await showMainMenu(from);
    return;
  }
  
  // Handle text messages and other types
  if (message.type === "text") {
    const text = message.text?.body?.toLowerCase() || "";
    
    // Check for common greetings
    if (text.includes("hi") || text.includes("hello") || text.includes("start") || text.includes("menu")) {
      await showMainMenu(from);
      return;
    }
    
    // Check if it's a phone number for QR
    if (/^(\+250|0)[7]\d{8}$/.test(text.replace(/\s/g, ""))) {
      await sendMessage(from, `📱 Phone number received: ${text}\n\nGenerating QR code for mobile money...`);
      // TODO: Generate QR code
      await sendMessage(from, "QR code generation coming soon! 🔳");
      await showMainMenu(from);
      return;
    }
    
    // Default response for text
    await sendMessage(from, "👋 Welcome! I can help you with mobility, insurance, and QR code services.");
    await showMainMenu(from);
    return;
  }
  
  // Handle location sharing
  if (message.type === "location") {
    const lat = message.location?.latitude;
    const lng = message.location?.longitude;
    await sendMessage(from, `📍 Location received: ${lat}, ${lng}\n\nSearching for nearby drivers...`);
    // TODO: Find nearby drivers
    await sendMessage(from, "Nearby drivers feature coming soon! 🚗");
    await showMainMenu(from);
    return;
  }
  
  // Handle document/image uploads
  if (message.type === "document" || message.type === "image") {
    await sendMessage(from, "📄 Document received! Processing for vehicle registration...");
    // TODO: Process document with OCR
    await sendMessage(from, "Document processing coming soon! 🚙");
    await showMainMenu(from);
    return;
  }
  
  // Default: show main menu
  await showMainMenu(from);
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