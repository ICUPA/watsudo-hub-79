// WhatsApp Business API webhook function with full flow implementation
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
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const sb = SB_URL && SB_SERVICE ? createClient(SB_URL, SB_SERVICE) : null;

// Conversation states
const STATES = {
  MAIN_MENU: 'main_menu',
  // QR Flow
  QR_ENTRY: 'qr_entry',
  QR_ENTER_PHONE: 'qr_enter_phone',
  QR_ENTER_CODE: 'qr_enter_code',
  QR_AMOUNT_MODE: 'qr_amount_mode',
  QR_ENTER_AMOUNT: 'qr_enter_amount',
  // Mobility Flow
  MOBILITY_MENU: 'mobility_menu',
  ND_VEHICLE_TYPE: 'nd_vehicle_type',
  ND_LOCATION: 'nd_location',
  ND_DRIVER_LIST: 'nd_driver_list',
  ST_ROLE: 'st_role',
  ST_VEHICLE_TYPE: 'st_vehicle_type',
  ST_PICKUP: 'st_pickup',
  ST_DROPOFF: 'st_dropoff',
  ST_DATETIME: 'st_datetime',
  AV_USAGE_TYPE: 'av_usage_type',
  AV_UPLOAD_DOC: 'av_upload_doc',
  // Insurance Flow
  INS_MENU: 'ins_menu',
  INS_CHECK_VEHICLE: 'ins_check_vehicle',
  INS_UPLOAD_DOCS: 'ins_upload_docs',
  INS_START_DATE: 'ins_start_date',
  INS_PERIOD: 'ins_period',
  INS_ADDONS: 'ins_addons',
  INS_SUMMARY: 'ins_summary'
};

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

async function sendList(to: string, text: string, buttonText: string, sections: any[]) {
  const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: text },
        action: {
          button: buttonText,
          sections: sections
        }
      }
    })
  });
  return await response.json();
}

async function sendImage(to: string, imageUrl: string, caption?: string) {
  const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "image",
      image: {
        link: imageUrl,
        caption: caption
      }
    })
  });
  return await response.json();
}

// User and session management
async function getOrCreateUser(phone: string, name?: string) {
  if (!sb) throw new Error("Supabase not initialized");
  
  // Clean phone number
  const cleanPhone = phone.startsWith('+') ? phone : `+${phone}`;
  
  // Find or create user profile
  let { data: profile } = await sb
    .from('profiles')
    .select('*')
    .eq('wa_phone', cleanPhone)
    .single();
    
  if (!profile) {
    const { data: newProfile } = await sb
      .from('profiles')
      .insert({
        wa_phone: cleanPhone,
        wa_name: name || 'User'
      })
      .select()
      .single();
    profile = newProfile;
  }
  
  return profile;
}

async function getOrCreateSession(userId: string, phone: string) {
  if (!sb) throw new Error("Supabase not initialized");
  
  let { data: session } = await sb
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .single();
    
  if (!session) {
    const { data: newSession } = await sb
      .from('chat_sessions')
      .insert({
        user_id: userId,
        state: STATES.MAIN_MENU,
        context: {}
      })
      .select()
      .single();
    session = newSession;
  }
  
  return session;
}

async function updateSession(sessionId: string, state: string, context: any) {
  if (!sb) return;
  await sb
    .from('chat_sessions')
    .update({ state, context, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}

// QR Code generation
async function generateQRCode(phone: string, amount?: number) {
  // Clean phone number for USSD (local format)
  const localPhone = phone.startsWith('+250') ? `0${phone.slice(4)}` : phone.replace('+', '');
  
  // Build USSD string
  const ussd = amount 
    ? `*182*1*1*${localPhone}*${amount}#`
    : `*182*1*1*${localPhone}#`;
    
  // Generate QR code
  const qrDataUrl = await toDataURL(ussd, { 
    errorCorrectionLevel: 'H',
    margin: 2,
    scale: 8 
  });
  
  // Convert to bytes for storage
  const qrBytes = base64.decode(qrDataUrl.split(',')[1]);
  
  if (!sb) throw new Error("Supabase not initialized");
  
  // Store in qr-codes bucket
  const fileName = `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
  const { data: uploadData, error } = await sb.storage
    .from('qr-codes')
    .upload(fileName, qrBytes, {
      contentType: 'image/png',
      upsert: true
    });
    
  if (error) throw error;
  
  // Get public URL
  const { data: urlData } = sb.storage
    .from('qr-codes')
    .getPublicUrl(fileName);
    
  return {
    imageUrl: urlData.publicUrl,
    ussd,
    telLink: `tel:${ussd.replace(/#/g, '%23')}`
  };
}

// Vehicle OCR processing
async function processVehicleDocument(mediaId: string) {
  if (!OPENAI_API_KEY) throw new Error("OpenAI API key not configured");
  
  // Download media from WhatsApp
  const mediaResponse = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
  });
  const mediaData = await mediaResponse.json();
  
  const fileResponse = await fetch(mediaData.url, {
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
  });
  const fileBytes = await fileResponse.arrayBuffer();
  
  // Upload to documents bucket
  if (!sb) throw new Error("Supabase not initialized");
  
  const fileName = `vehicle_doc_${Date.now()}.${mediaData.mime_type?.includes('pdf') ? 'pdf' : 'jpg'}`;
  await sb.storage
    .from('documents')
    .upload(fileName, fileBytes, {
      contentType: mediaData.mime_type,
      upsert: true
    });
    
  // Get signed URL for OCR
  const { data: signedUrl } = await sb.storage
    .from('documents')
    .createSignedUrl(fileName, 300);
    
  // OCR with OpenAI
  const ocrResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract vehicle information from this document. Return ONLY a JSON object with: plate, vin, make, model, model_year, insurance_provider, insurance_policy, insurance_expiry (YYYY-MM-DD format).'
          },
          {
            type: 'image_url',
            image_url: { url: signedUrl!.signedUrl }
          }
        ]
      }],
      max_tokens: 500
    })
  });
  
  const ocrResult = await ocrResponse.json();
  const extractedText = ocrResult.choices?.[0]?.message?.content || '{}';
  
  try {
    return JSON.parse(extractedText);
  } catch {
    return {};
  }
}

// Main menu
async function showMainMenu(to: string) {
  await sendButtons(to, "Welcome to Mobility Hub! Choose a service:", [
    { id: "MOBILITY", title: "🚕 Mobility" },
    { id: "INSURANCE", title: "🛡️ Insurance" },
    { id: "QR", title: "🔳 QR Codes" }
  ]);
}

// Flow handlers
async function handleQRFlow(to: string, session: any, message: any, interactiveId?: string) {
  const context = session.context || {};
  
  switch (session.state) {
    case STATES.QR_ENTRY:
      // Check if user has MoMo info on file
      const profile = await sb!.from('profiles').select('*').eq('id', session.user_id).single();
      if (profile.data?.default_momo_phone) {
        await sendButtons(to, "Choose amount mode:", [
          { id: "QR_WITH_AMOUNT", title: "📊 With Amount" },
          { id: "QR_NO_AMOUNT", title: "💳 No Amount" },
          { id: "QR_CHANGE_PHONE", title: "📱 Change Phone" }
        ]);
        await updateSession(session.id, STATES.QR_AMOUNT_MODE, { phone: profile.data.default_momo_phone });
      } else {
        await sendMessage(to, "📱 Please send your MoMo phone number (format: 0788123456):");
        await updateSession(session.id, STATES.QR_ENTER_PHONE, {});
      }
      break;
      
    case STATES.QR_ENTER_PHONE:
      if (message.type === 'text') {
        const phone = message.text.body.trim();
        if (/^(\+250|0)[7]\d{8}$/.test(phone)) {
          // Save phone to profile
          await sb!.from('profiles').update({ default_momo_phone: phone }).eq('id', session.user_id);
          await sendButtons(to, "Choose amount mode:", [
            { id: "QR_WITH_AMOUNT", title: "📊 With Amount" },
            { id: "QR_NO_AMOUNT", title: "💳 No Amount" }
          ]);
          await updateSession(session.id, STATES.QR_AMOUNT_MODE, { phone });
        } else {
          await sendMessage(to, "❌ Invalid phone format. Please use: 0788123456 or +250788123456");
        }
      }
      break;
      
    case STATES.QR_AMOUNT_MODE:
      if (interactiveId === "QR_WITH_AMOUNT") {
        await sendList(to, "Select amount or choose custom:", "Select Amount", [{
          title: "Quick Amounts",
          rows: [
            { id: "QR_1000", title: "1,000 RWF" },
            { id: "QR_2000", title: "2,000 RWF" },
            { id: "QR_5000", title: "5,000 RWF" },
            { id: "QR_CUSTOM", title: "💰 Custom Amount" }
          ]
        }]);
        await updateSession(session.id, STATES.QR_ENTER_AMOUNT, context);
      } else if (interactiveId === "QR_NO_AMOUNT") {
        const qr = await generateQRCode(context.phone);
        await sendImage(to, qr.imageUrl, `🔳 QR Code generated!\n\nUSSD: ${qr.ussd}\nTap to dial: ${qr.telLink}`);
        await sendButtons(to, "What's next?", [
          { id: "QR_ANOTHER", title: "🔄 Generate Another" },
          { id: "HOME", title: "🏠 Main Menu" }
        ]);
        await updateSession(session.id, STATES.MAIN_MENU, {});
      }
      break;
      
    case STATES.QR_ENTER_AMOUNT:
      if (interactiveId?.startsWith("QR_")) {
        const amount = interactiveId === "QR_1000" ? 1000 : 
                     interactiveId === "QR_2000" ? 2000 : 
                     interactiveId === "QR_5000" ? 5000 : null;
        
        if (amount || interactiveId === "QR_CUSTOM") {
          if (interactiveId === "QR_CUSTOM") {
            await sendMessage(to, "💰 Enter the amount (numbers only):");
            return;
          }
          
          const qr = await generateQRCode(context.phone, amount);
          await sendImage(to, qr.imageUrl, `🔳 QR Code generated!\n\nAmount: ${amount} RWF\nUSSD: ${qr.ussd}\nTap to dial: ${qr.telLink}`);
          await sendButtons(to, "What's next?", [
            { id: "QR_ANOTHER", title: "🔄 Generate Another" },
            { id: "HOME", title: "🏠 Main Menu" }
          ]);
          await updateSession(session.id, STATES.MAIN_MENU, {});
        }
      } else if (message.type === 'text') {
        const amount = parseInt(message.text.body.trim());
        if (!isNaN(amount) && amount > 0) {
          const qr = await generateQRCode(context.phone, amount);
          await sendImage(to, qr.imageUrl, `🔳 QR Code generated!\n\nAmount: ${amount} RWF\nUSSD: ${qr.ussd}\nTap to dial: ${qr.telLink}`);
          await sendButtons(to, "What's next?", [
            { id: "QR_ANOTHER", title: "🔄 Generate Another" },
            { id: "HOME", title: "🏠 Main Menu" }
          ]);
          await updateSession(session.id, STATES.MAIN_MENU, {});
        } else {
          await sendMessage(to, "❌ Please enter a valid amount (numbers only):");
        }
      }
      break;
  }
  
  // Handle common QR actions
  if (interactiveId === "QR_ANOTHER") {
    await updateSession(session.id, STATES.QR_ENTRY, {});
    await handleQRFlow(to, { ...session, state: STATES.QR_ENTRY }, message);
  }
}

async function handleMobilityFlow(to: string, session: any, message: any, interactiveId?: string) {
  const context = session.context || {};
  
  switch (session.state) {
    case STATES.MOBILITY_MENU:
      if (interactiveId === "NEARBY_DRIVERS") {
        // Get vehicle types from database
        const { data: vehicleTypes } = await sb!.from('vehicle_types').select('*');
        if (vehicleTypes?.length) {
          await sendList(to, "Select vehicle type:", "Choose Type", [{
            title: "Vehicle Types",
            rows: vehicleTypes.map(vt => ({
              id: `VT_${vt.id}`,
              title: vt.label,
              description: vt.code
            }))
          }]);
          await updateSession(session.id, STATES.ND_VEHICLE_TYPE, {});
        } else {
          await sendMessage(to, "📍 Please share your location to find nearby drivers:");
          await updateSession(session.id, STATES.ND_LOCATION, {});
        }
      } else if (interactiveId === "SCHEDULE_TRIP") {
        await sendButtons(to, "Choose your role:", [
          { id: "ST_PASSENGER", title: "👤 Passenger" },
          { id: "ST_DRIVER", title: "🚗 Driver" }
        ]);
        await updateSession(session.id, STATES.ST_ROLE, {});
      } else if (interactiveId === "ADD_VEHICLE") {
        const { data: vehicleTypes } = await sb!.from('vehicle_types').select('*');
        if (vehicleTypes?.length) {
          await sendList(to, "Select vehicle usage type:", "Choose Usage", [{
            title: "Usage Types",
            rows: vehicleTypes.map(vt => ({
              id: `USAGE_${vt.id}`,
              title: vt.label,
              description: vt.code
            }))
          }]);
          await updateSession(session.id, STATES.AV_USAGE_TYPE, {});
        }
      }
      break;
      
    case STATES.ND_VEHICLE_TYPE:
      if (interactiveId?.startsWith("VT_")) {
        const vehicleTypeId = interactiveId.replace("VT_", "");
        await sendMessage(to, "📍 Please share your location to find nearby drivers:");
        await updateSession(session.id, STATES.ND_LOCATION, { vehicleTypeId });
      }
      break;
      
    case STATES.ND_LOCATION:
      if (message.type === 'location') {
        const lat = message.location.latitude;
        const lng = message.location.longitude;
        
        // Query nearby drivers
        const { data: drivers } = await sb!.rpc('nearby_drivers', { lat, lng, km: 15 });
        
        if (drivers?.length) {
          await sendList(to, `Found ${drivers.length} nearby drivers:`, "Select Driver", [{
            title: "Available Drivers",
            rows: drivers.slice(0, 10).map((driver: any, index: number) => ({
              id: `DRIVER_${driver.driver_id}`,
              title: `#${index + 1} ${driver.wa_name || 'Driver'}`,
              description: `${driver.distance_km}km • ${driver.vehicle_type || 'Vehicle'} • ⭐${driver.rating || '5.0'}`
            }))
          }]);
          await updateSession(session.id, STATES.ND_DRIVER_LIST, { lat, lng, drivers });
        } else {
          await sendMessage(to, "❌ No drivers found nearby. Try again later or expand search area.");
          await showMainMenu(to);
          await updateSession(session.id, STATES.MAIN_MENU, {});
        }
      }
      break;
      
    case STATES.AV_USAGE_TYPE:
      if (interactiveId?.startsWith("USAGE_")) {
        const usageTypeId = interactiveId.replace("USAGE_", "");
        await sendMessage(to, "📄 Please upload your vehicle's insurance certificate or registration document (photo or PDF):");
        await updateSession(session.id, STATES.AV_UPLOAD_DOC, { usageTypeId });
      }
      break;
      
    case STATES.AV_UPLOAD_DOC:
      if (message.type === 'document' || message.type === 'image') {
        const mediaId = message.document?.id || message.image?.id;
        if (mediaId) {
          await sendMessage(to, "🔄 Processing document...");
          try {
            const extracted = await processVehicleDocument(mediaId);
            
            // Save vehicle to database
            const { error } = await sb!.from('vehicles').insert({
              user_id: session.user_id,
              usage_type: context.usageTypeId,
              plate: extracted.plate,
              vin: extracted.vin,
              make: extracted.make,
              model: extracted.model,
              model_year: extracted.model_year,
              insurance_provider: extracted.insurance_provider,
              insurance_policy: extracted.insurance_policy,
              insurance_expiry: extracted.insurance_expiry,
              extra: extracted
            });
            
            if (!error) {
              await sendMessage(to, `✅ Vehicle registered successfully!\n\nPlate: ${extracted.plate || 'Not detected'}\nMake/Model: ${extracted.make || ''} ${extracted.model || ''}\nYear: ${extracted.model_year || 'Not detected'}`);
            } else {
              await sendMessage(to, "❌ Error saving vehicle. Please try again.");
            }
          } catch (error) {
            await sendMessage(to, "❌ Error processing document. Please try again with a clearer image.");
          }
          
          await showMainMenu(to);
          await updateSession(session.id, STATES.MAIN_MENU, {});
        }
      }
      break;
  }
}

// Process incoming messages with state management
async function processMessage(from: string, message: any, interactiveId?: string, contactName?: string) {
  console.log(`Processing message from ${from}, type: ${message.type}, interactive: ${interactiveId}`);
  
  try {
    // Get or create user and session
    const user = await getOrCreateUser(from, contactName);
    const session = await getOrCreateSession(user.id, from);
    
    // Handle global navigation
    if (interactiveId === "HOME") {
      await showMainMenu(from);
      await updateSession(session.id, STATES.MAIN_MENU, {});
      return;
    }
    
    // Handle main menu
    if (session.state === STATES.MAIN_MENU || interactiveId === "MOBILITY" || interactiveId === "INSURANCE" || interactiveId === "QR") {
      if (interactiveId === "MOBILITY") {
        await sendButtons(from, "🚕 Mobility services:", [
          { id: "NEARBY_DRIVERS", title: "🚗 Nearby Drivers" },
          { id: "SCHEDULE_TRIP", title: "📅 Schedule Trip" },
          { id: "ADD_VEHICLE", title: "🚙 Add Vehicle" },
          { id: "HOME", title: "🏠 Main Menu" }
        ]);
        await updateSession(session.id, STATES.MOBILITY_MENU, {});
        return;
      }
      
      if (interactiveId === "QR") {
        await updateSession(session.id, STATES.QR_ENTRY, {});
        await handleQRFlow(from, { ...session, state: STATES.QR_ENTRY }, message);
        return;
      }
      
      if (interactiveId === "INSURANCE") {
        await sendMessage(from, "🛡️ Insurance services coming soon! This will include motor insurance quotes, certificates, and claims support.");
        await showMainMenu(from);
        return;
      }
      
      // Show main menu for greetings or unknown messages
      if (message.type === 'text') {
        const text = message.text?.body?.toLowerCase() || "";
        if (text.includes("hi") || text.includes("hello") || text.includes("start") || text.includes("menu")) {
          await showMainMenu(from);
          return;
        }
      }
      
      await showMainMenu(from);
      return;
    }
    
    // Route to specific flows based on current state
    if (session.state.startsWith('qr_') || session.state === STATES.QR_ENTRY) {
      await handleQRFlow(from, session, message, interactiveId);
    } else if (session.state.startsWith('mobility_') || session.state.startsWith('nd_') || session.state.startsWith('st_') || session.state.startsWith('av_') || session.state === STATES.MOBILITY_MENU) {
      await handleMobilityFlow(from, session, message, interactiveId);
    } else {
      // Default: show main menu
      await showMainMenu(from);
      await updateSession(session.id, STATES.MAIN_MENU, {});
    }
    
  } catch (error) {
    console.error("Error in processMessage:", error);
    await sendMessage(from, "❌ Sorry, something went wrong. Please try again.");
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
          await processMessage(from, message, interactiveId, contact.profile?.name);
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