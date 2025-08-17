// Enhanced Ride Management Component
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import * as base64 from "https://deno.land/std@0.223.0/encoding/base64.ts";
import { 
  WhatsAppClient, 
  WALogger,
  normalizePhone, 
  buildUSSD, 
  buildTelLink, 
  getInteractiveId,
  isValidFlowId 
} from "../_shared/wa.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// Canonical environment variables (with fallbacks) and runtime settings
const META_WABA_ID = Deno.env.get("META_WABA_ID")!;
const TIMEZONE = Deno.env.get("TIMEZONE") || "Africa/Kigali";

// Canonical WhatsApp variables with legacy fallbacks
const WABA_PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID") || Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const WABA_VERIFY = Deno.env.get("META_WABA_VERIFY_TOKEN") || Deno.env.get("WHATSAPP_VERIFY_TOKEN")!;
const WABA_TOKEN = Deno.env.get("META_ACCESS_TOKEN") || Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const WABA_APP_SECRET = Deno.env.get("META_WABA_APP_SECRET") || Deno.env.get("WHATSAPP_APP_SECRET")!;

// App metadata for health checks
const APP_VERSION = "1.0.0";
const BUILD_ID = Deno.env.get("DENO_DEPLOYMENT_ID") || "dev";

const sb = createClient(SB_URL, SB_SERVICE);

// Structured logging implementation
const logger: WALogger = {
  log: (level: string, message: string, context: any = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      app_version: APP_VERSION,
      build_id: BUILD_ID,
      ...context
    }));
  }
};

// Initialize WhatsApp client
const waClient = new WhatsAppClient(WABA_PHONE_ID, WABA_TOKEN, WABA_APP_SECRET, sb, logger);

// State constants - strict flow control
const STATES = {
  MAIN_MENU: "MAIN_MENU",
  MOBILITY_MENU: "MOBILITY_MENU",
  INS_CHECK_VEHICLE: "INS_CHECK_VEHICLE",
  INS_COLLECT_DOCS: "INS_COLLECT_DOCS",
  INS_CHOOSE_START: "INS_CHOOSE_START",
  INS_CHOOSE_PERIOD: "INS_CHOOSE_PERIOD",
  INS_CHOOSE_ADDONS: "INS_CHOOSE_ADDONS",
  INS_CHOOSE_PA: "INS_CHOOSE_PA",
  INS_SUMMARY: "INS_SUMMARY",
  ND_SELECT_TYPE: "ND_SELECT_TYPE",
  ND_WAIT_LOCATION: "ND_WAIT_LOCATION",
  ND_CHOOSE_DRIVER: "ND_CHOOSE_DRIVER",
  ST_ROLE: "ST_ROLE",
  AV_USAGE: "AV_USAGE",
  AV_DOC: "AV_DOC",
  QR_MENU: "QR_MENU",
  QR_PHONE: "QR_PHONE",
  QR_CODE: "QR_CODE",
  QR_AMOUNT_MODE: "QR_AMOUNT_MODE",
  QR_AMOUNT_INPUT: "QR_AMOUNT_INPUT",
  QR_GENERATE: "QR_GENERATE"
} as const;

// User and session management
async function getOrCreateUser(phone: string, name?: string) {
  try {
    // Try to find existing user by phone
    let { data: user } = await sb
      .from("profiles")
      .select("*")
      .eq("wa_phone", phone)
      .single();

    if (!user) {
      // Create new user
      const { data: newUser, error: createError } = await sb
        .from("profiles")
        .insert({
          wa_phone: phone,
          wa_name: name || "WhatsApp User",
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) throw createError;
      user = newUser;
      logger.log("info", "Created new user", { userId: user.id, phone });
    }

    // Get or create chat session
    let { data: session } = await sb
      .from("chat_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!session) {
      const { data: newSession, error: sessionError } = await sb
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          state: STATES.MAIN_MENU,
          context: {},
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      session = newSession;
      logger.log("info", "Created new chat session", { sessionId: session.id, userId: user.id });
    }

    return { user, session };
  } catch (error) {
    logger.log("error", "Failed to get/create user", { error: error.message, phone });
    throw error;
  }
}

async function setState(sessionId: string, state: string, context: any = {}) {
  try {
    await sb
      .from("chat_sessions")
      .update({ 
        state, 
        context: { ...context, updated_at: new Date().toISOString() },
        updated_at: new Date().toISOString()
      })
      .eq("id", sessionId);
  } catch (error) {
    logger.log("error", "Failed to update session state", { sessionId, state, error: error.message });
    throw error;
  }
}

// Fast-ack media processing - don't block webhook
async function queueMediaForOCR(mediaId: string, userId: string, usageType: string, from: string) {
  try {
    // Send immediate response to user
    await waClient.sendText(from, "✅ Received your document. Processing...");
    
    // Queue OCR job in database
    await sb.from("vehicle_ocr_jobs").insert({
      user_id: userId,
      media_id: mediaId,
      usage_type: usageType,
      status: "pending",
      attempts: 0,
      created_at: new Date().toISOString()
    });
    
    logger.log("info", "Media queued for OCR", { mediaId, userId, usageType });
    return { success: true };
  } catch (error) {
    logger.log("error", "Failed to queue media for OCR", { mediaId, userId, error: error.message });
    return { success: false, error: error.message };
  }
}

// OCR processing using existing edge function (now async)
async function processVehicleOCR(mediaId: string, userId: string, usageType: string) {
  try {
    const { bytes, mime } = await waClient.fetchMedia(mediaId);
    const path = `${userId}/${crypto.randomUUID()}.${mime.includes("pdf") ? "pdf" : "jpg"}`;
    
    // Upload to vehicle_docs bucket
    const { error: uploadError } = await sb.storage.from("vehicle_docs").upload(path, bytes, { 
      contentType: mime, 
      upsert: true 
    });
    
    if (uploadError) throw uploadError;
    
    // Get signed URL for OCR processing
    const { data: signedData } = await sb.storage.from("vehicle_docs").createSignedUrl(path, 600);
    if (!signedData?.signedUrl) throw new Error("Failed to create signed URL");
    
    const { data, error } = await sb.functions.invoke('process-vehicle-ocr', {
      body: { file_url: signedData.signedUrl, user_id: userId, usage_type: usageType }
    });
    
    if (error || !data?.success) {
      throw new Error(data?.error || 'OCR processing failed');
    }
    
    logger.log("info", "Vehicle OCR completed", { userId, usageType, path });
    return { success: true, data: data.data?.extracted_data, path };
  } catch (error) {
    logger.log("error", "OCR processing failed", { mediaId, userId, error: error.message });
    return { success: false, error: error.message };
  }
}

// QR generation using existing edge function  
async function generateAndSendQR(to: string, userId: string, ctx: any) {
  try {
    const { data, error } = await sb.functions.invoke('generate-qr', {
      body: {
        type: ctx.qr?.type || 'phone',
        identifier: ctx.qr?.phone || ctx.qr?.code,
        amount: ctx.qr?.amount,
        user_id: userId
      }
    });
    
    if (error || !data?.success) {
      logger.log("error", "QR generation failed", { error: error?.message || data?.error });
      await waClient.sendText(to, "Failed to generate QR code. Please try again.");
      return;
    }

    const ussd = buildUSSD(ctx.qr?.type || 'phone', ctx.qr?.phone || ctx.qr?.code, ctx.qr?.amount);
    const tel = buildTelLink(ussd);
    
    await waClient.sendImage(to, data.qrCodeUrl, `USSD: ${ussd}\nTap to dial: ${tel}`);
    await waClient.sendButtons(to, "QR generated. Next action?", [
      { id: "QR_AGAIN", title: "Generate another" },
      { id: "QR_CHANGE_DEFAULT", title: "Change default" },
      { id: "HOME", title: "⬅️ Home" }
    ]);
    
    logger.log("info", "QR code generated and sent", { userId, ussd: ussd.substring(0, 20) + "..." });
  } catch (error) {
    logger.log("error", "QR generation failed", { userId, error: error.message });
    await waClient.sendText(to, "Failed to generate QR code. Please try again.");
  }
}

// Menu functions
async function showMainMenu(to: string) {
  await waClient.sendButtons(to, "Welcome. Choose a service:", [
    { id: "MOBILITY", title: "🚕 Mobility" },
    { id: "INSURANCE", title: "🛡️ Insurance (Moto)" },
    { id: "QR", title: "🔳 QR Codes" },
    { id: "PROFILE", title: "👤 My Profile" }
  ]);
}

async function showMobilityMenu(to: string) {
  await waClient.sendButtons(to, "Mobility menu:", [
    { id: "ND", title: "Nearby Drivers" },
    { id: "ST", title: "Schedule Trip" },
    { id: "AV", title: "Add Vehicle (OCR)" },
    { id: "HOME", title: "⬅️ Home" }
  ]);
}

async function showQRMenu(to: string) {
  await waClient.sendButtons(to, "QR: Choose identifier type:", [
    { id: "QR_PHONE", title: "Use Phone" },
    { id: "QR_CODE", title: "Use MoMo Code" },
    { id: "HOME", title: "⬅️ Home" }
  ]);
}

// Insurance data fetching
async function fetchPeriods() {
  try {
    const { data, error } = await sb.from("insurance_periods").select("*").order("days");
    if (error) throw error;
    return { data: data || [] };
  } catch (error) {
    logger.log("error", "Failed to fetch insurance periods", { error: error.message });
    return { data: [] };
  }
}

async function fetchAddons() {
  try {
    const { data, error } = await sb.from("insurance_addons").select("*");
    if (error) throw error;
    return { data: data || [] };
  } catch (error) {
    logger.log("error", "Failed to fetch insurance addons", { error: error.message });
    return { data: [] };
  }
}

async function fetchPA() {
  try {
    const { data, error } = await sb.from("insurance_pa_categories").select("*");
    if (error) throw error;
    return { data: data || [] };
  } catch (error) {
    logger.log("error", "Failed to fetch PA categories", { error: error.message });
    return { data: [] };
  }
}

async function handleHealthCheck(): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      build_id: BUILD_ID,
      environment: "production"
    }),
    { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    }
  );
}

// Main handler with comprehensive error handling
Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  logger.log("info", "Request received", { method: req.method, url: req.url, requestId });
  
  try {
    const url = new URL(req.url);
    
    // Health check endpoint - accept on any path
    if (req.method === "GET" && url.pathname.endsWith("/health")) {
      return await handleHealthCheck();
    }
    
    // Webhook verification - accept on ANY path (not just "/")
    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      
      if (mode === "subscribe" && token === WABA_VERIFY) {
        logger.log("info", "Webhook verification successful", { requestId, path: url.pathname });
        return new Response(challenge ?? "", { 
          status: 200, 
          headers: { "Content-Type": "text/plain" } 
        });
      }
      
      logger.log("warn", "Webhook verification failed", { mode, token, requestId, path: url.pathname });
      return new Response("Verification failed", { status: 403 });
    }
    
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: true }), { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
      });
    }
    
    // Get raw body for signature verification
    const bodyText = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    
    // Verify webhook signature
    const isValidSignature = await waClient.verifySignature(signature || "", bodyText);
    if (!isValidSignature) {
      logger.log("warn", "Invalid webhook signature", { requestId, signature });
      return new Response("Invalid signature", { status: 403 });
    }
    
    // Global rate limiting check
    const globalRateLimit = await sb.rpc("check_rate_limit", "global:whatsapp", "whatsapp", 1);
    if (!globalRateLimit) {
      logger.log("warn", "Global rate limit exceeded", { requestId });
      return new Response("Rate limit exceeded", { status: 429 });
    }
    
    const body = JSON.parse(bodyText);
    
    // Process ALL entries and changes (not just [0])
    const entries = body?.entry || [];
    let hasProcessedMessage = false;
    
    for (const entry of entries) {
      const changes = entry?.changes || [];
      
      for (const change of changes) {
        const messages = change?.value?.messages || [];
        const contacts = change?.value?.contacts || [];
        
        // Process each message
        for (const m of messages) {
          const contact = contacts.find((c: any) => c.wa_id === m.from);
          
          if (!m || !contact) {
            logger.log("info", "Skipping message without contact", { requestId, messageId: m?.id });
            continue;
          }
          
          // Idempotency check using inbound_events table
          const messageId = m.id;
          const { data: isNewEvent } = await sb.rpc("check_and_insert_inbound_event", 
            messageId, 
            contact.wa_id || "unknown", 
            m.type || "unknown", 
            { message: m, contact: contact }
          );
          
          if (!isNewEvent) {
            logger.log("info", "Duplicate message ignored", { messageId, requestId });
            continue;
          }
          
          // Log inbound message
          try {
            await sb.from("whatsapp_logs").insert({
              direction: "in",
              phone_number: contact.wa_id || "unknown",
              message_type: m.type || "unknown",
              message_content: JSON.stringify(m),
              metadata: { webhook_body: body, request_id: requestId },
              status: "received",
              message_id: messageId,
              payload: body
            });
            
            // Record metrics
            await sb.rpc("increment_metric", "whatsapp.messages_received", 1, {
              direction: "inbound",
              message_type: m.type || "unknown",
              user_id: user?.id
            });
          } catch (err) {
            logger.log("error", "Failed to log inbound message", { error: err.message });
          }
          
          const from = `+${contact.wa_id}`;
          const { user, session } = await getOrCreateUser(from, contact?.profile?.name);
          const to = contact.wa_id; // Use raw wa_id for WhatsApp API
          
          // Per-user rate limiting check
          const userRateLimit = await sb.rpc("check_rate_limit", `user:${user.id}`, "whatsapp", 1);
          if (!userRateLimit) {
            logger.log("warn", "User rate limit exceeded", { userId: user.id, requestId });
            await waClient.sendText(to, "You're sending messages too quickly. Please wait a moment before sending another message.");
            continue;
          }
          
          logger.log("info", "Processing message", { 
            messageId, 
            messageType: m.type, 
            userId: user.id, 
            sessionState: session.state,
            requestId 
          });
          
          // Interactive message handling
          const iid = getInteractiveId(m);
          if (iid) {
            logger.log("info", "Processing interactive message", { interactiveId: iid, requestId });
            
            // Validate interactive ID
            if (!isValidFlowId(iid)) {
              logger.log("warn", "Invalid interactive ID", { interactiveId: iid, requestId });
              await waClient.sendText(to, "Sorry, I didn't understand that. Let me show you the main menu.");
              await setState(session.id, STATES.MAIN_MENU, {});
              await showMainMenu(to);
              hasProcessedMessage = true;
              continue;
            }
            
            // Main navigation
            if (iid === "MOBILITY") {
              await setState(session.id, STATES.MOBILITY_MENU, {});
              await showMobilityMenu(to);
              hasProcessedMessage = true;
              continue;
            }
            
            if (iid === "INSURANCE") {
              // Start insurance flow: check for an existing vehicle
              await setState(session.id, STATES.INS_CHECK_VEHICLE, {});
              const { data: vehicles, error: vehErr } = await sb
                .from("vehicles")
                .select("id,plate")
                .eq("user_id", user.id)
                .limit(1);
              if (vehErr) throw vehErr;
              if (!vehicles?.length) {
                await setState(session.id, STATES.INS_COLLECT_DOCS, {});
                await waClient.sendText(
                  to,
                  "📄 Please send vehicle documents (Carte Jaune + Old Insurance). Reply 'Agent' or 'Done' when ready."
                );
              } else {
                const v = vehicles[0];
                await setState(
                  session.id,
                  STATES.INS_CHOOSE_START,
                  { vehicle_id: v.id, plate: v.plate }
                );
                await waClient.sendButtons(
                  to,
                  `Insurance for ${v.plate} — Choose start:`,
                  [
                    { id: "START_TODAY", title: "Today" },
                    { id: "START_PICK", title: "Pick Date" }
                  ]
                );
              }
              hasProcessedMessage = true;
              continue;
            }
            
            if (iid === "QR") {
              await setState(session.id, STATES.QR_MENU, {});
              await showQRMenu(to);
              hasProcessedMessage = true;
              continue;
            }
            
            if (iid === "PROFILE") {
              await waClient.sendText(to, `Phone: ${user.wa_phone}\nDefault MoMo: ${user.default_momo_phone ?? '—'}\nCode: ${user.default_momo_code ?? '—'}`);
              await setState(session.id, STATES.MAIN_MENU, {});
              await showMainMenu(to);
              hasProcessedMessage = true;
              continue;
            }
            
            if (iid === "HOME") {
              await setState(session.id, STATES.MAIN_MENU, {});
              await showMainMenu(to);
              hasProcessedMessage = true;
              continue;
            }
            
            // Mobility flows
            if (iid === "ND") {
              await setState(session.id, STATES.ND_SELECT_TYPE, {});
              const { data: types } = await sb.from("vehicle_types").select("*");
              await waClient.sendList(to, "Choose vehicle type:", (types || []).map((t: any) => ({
                id: `ND_V_${t.code}`, 
                title: t.label
              })), "Vehicle Types", "Nearby");
              hasProcessedMessage = true;
              continue;
            }
            
            if (iid === "ST") {
              await setState(session.id, STATES.ST_ROLE, {});
              await waClient.sendButtons(to, "Schedule Trip: choose role", [
                { id: "ST_ROLE_PAX", title: "Passenger" },
                { id: "ST_ROLE_DRV", title: "Driver" },
                { id: "MOBILITY", title: "⬅️ Back" }
              ]);
              hasProcessedMessage = true;
              continue;
            }
            
            if (iid === "AV") {
              await setState(session.id, STATES.AV_USAGE, {});
              const { data: vtypes } = await sb.from("vehicle_types").select("*");
              await waClient.sendList(to, "Usage type:", (vtypes || []).map((t: any) => ({
                id: `AV_U_${t.code}`, 
                title: t.label
              })), "Usage Types", "Add Vehicle");
              hasProcessedMessage = true;
              continue;
            }

            if (iid.startsWith("ND_V_")) {
              const vt = iid.replace("ND_V_", "");
              await setState(session.id, STATES.ND_WAIT_LOCATION, { nd: { vehicle_type: vt } });
              await waClient.sendText(to, "Share your pickup location (Attach → Location).");
              hasProcessedMessage = true;
              continue;
            }
            
            if (iid.startsWith("AV_U_")) {
              const usage = iid.replace("AV_U_", "");
              await setState(session.id, STATES.AV_DOC, { av: { usage_type: usage } });
              await waClient.sendText(to, "Upload insurance certificate (photo or PDF).");
              hasProcessedMessage = true;
              continue;
            }

            // QR flows
            if (iid === "QR_PHONE") {
              await setState(session.id, STATES.QR_PHONE, { qr: { type: "phone" } });
              if (!user.default_momo_phone) {
                await waClient.sendText(to, "Enter MoMo phone (07xxxxxxxx or +2507…)");
              } else {
                await setState(session.id, STATES.QR_AMOUNT_MODE, { qr: { type: "phone", phone: user.default_momo_phone } });
                await waClient.sendButtons(to, "Amount mode:", [
                  { id: "QR_AMT_WITH", title: "With amount" },
                  { id: "QR_AMT_NONE", title: "No amount" },
                  { id: "QR", title: "⬅️ Back" }
                ]);
              }
              hasProcessedMessage = true;
              continue;
            }
            
            if (iid === "QR_CODE") {
              await setState(session.id, STATES.QR_CODE, { qr: { type: "code" } });
              if (!user.default_momo_code) {
                await waClient.sendText(to, "Enter MoMo merchant code (4–9 digits):");
              } else {
                await setState(session.id, STATES.QR_AMOUNT_MODE, { qr: { type: "code", code: user.default_momo_code } });
                await waClient.sendButtons(to, "Amount mode:", [
                  { id: "QR_AMT_WITH", title: "With amount" },
                  { id: "QR_AMT_NONE", title: "No amount" },
                  { id: "QR", title: "⬅️ Back" }
                ]);
              }
              hasProcessedMessage = true;
              continue;
            }
            
            if (iid === "QR_AMT_WITH") {
              await setState(session.id, STATES.QR_AMOUNT_INPUT, { qr: { ...(session.context as any).qr } });
              await waClient.sendList(to, "Quick pick:", [
                { id: "QR_A_1000", title: "1,000" },
                { id: "QR_A_2000", title: "2,000" },
                { id: "QR_A_5000", title: "5,000" },
                { id: "QR_A_OTHER", title: "Other amount" }
              ], "Amounts", "Pick amount");
              hasProcessedMessage = true;
              continue;
            }
            
            if (iid === "QR_AMT_NONE") {
              const ctx = session.context as any;
              ctx.qr = { ...(ctx.qr || {}), amount: null };
              await setState(session.id, STATES.QR_GENERATE, ctx);
              await generateAndSendQR(to, session.user_id, ctx);
              hasProcessedMessage = true;
              continue;
            }
            
            if (["QR_A_1000", "QR_A_2000", "QR_A_5000"].includes(iid)) {
              const amt = iid === "QR_A_1000" ? 1000 : iid === "QR_A_2000" ? 2000 : 5000;
              const ctx = session.context as any;
              ctx.qr = { ...(ctx.qr || {}), amount: amt };
              await setState(session.id, STATES.QR_GENERATE, ctx);
              await generateAndSendQR(to, session.user_id, ctx);
              hasProcessedMessage = true;
              continue;
            }
            
            if (iid === "QR_A_OTHER") {
              await waClient.sendText(to, "Enter amount (>0):");
              hasProcessedMessage = true;
              continue;
            }
            
            if (iid === "QR_AGAIN") {
              await showQRMenu(to);
              hasProcessedMessage = true;
              continue;
            }
            
            if (iid === "QR_CHANGE_DEFAULT") {
              const ctx = session.context as any;
              if (ctx.qr?.type === "phone") {
                await setState(session.id, STATES.QR_PHONE, { qr: { type: "phone" } });
                await waClient.sendText(to, "Enter new default MoMo phone:");
              } else {
                await setState(session.id, STATES.QR_CODE, { qr: { type: "code" } });
                await waClient.sendText(to, "Enter new default MoMo code (4–9 digits):");
              }
              hasProcessedMessage = true;
              continue;
            }

            // Insurance flows
            if (session.state === STATES.INS_CHOOSE_START) {
              if (iid === "START_TODAY") {
                const ctx = { ...(session.context || {}), start_date: new Date().toISOString().slice(0, 10) };
                await setState(session.id, STATES.INS_CHOOSE_PERIOD, ctx);
                const { data: periods = [] } = await fetchPeriods();
                await waClient.sendList(to, "Choose duration", periods.map((p: any) => ({
                  id: `PERIOD_${p.id}`, 
                  title: p.label, 
                  description: `${p.days} days`
                })), "Period", "Available");
                hasProcessedMessage = true;
                continue;
              }
              if (iid === "START_PICK") {
                await waClient.sendText(to, "Send date as YYYY-MM-DD:");
                hasProcessedMessage = true;
                continue;
              }
            }
            
            if (session.state === STATES.INS_CHOOSE_PERIOD && iid.startsWith("PERIOD_")) {
              const ctx = { ...(session.context || {}), period_id: iid.replace("PERIOD_", "") };
              await setState(session.id, STATES.INS_CHOOSE_ADDONS, ctx);
              const { data: addons = [] } = await fetchAddons();
              await waClient.sendList(to, "Pick add-ons (send 'Done' to continue)", addons.map((a: any) => ({
                id: `ADDON_${a.id}`, 
                title: a.label, 
                description: a.code
              })), "Add-ons", "Available");
              hasProcessedMessage = true;
              continue;
            }
          }
          
          // Text input handling for various states
          if (m?.text?.body) {
            const t = m.text.body.trim();
            
            if (session.state === STATES.QR_PHONE) {
              const phone = normalizePhone(t);
              await sb.from("profiles").update({ default_momo_phone: phone }).eq("id", user.id);
              await setState(session.id, STATES.QR_AMOUNT_MODE, { qr: { type: "phone", phone } });
              await waClient.sendButtons(to, "Amount mode:", [
                { id: "QR_AMT_WITH", title: "With amount" },
                { id: "QR_AMT_NONE", title: "No amount" },
                { id: "QR", title: "⬅️ Back" }
              ]);
              hasProcessedMessage = true;
              continue;
            }
            
            if (session.state === STATES.QR_CODE) {
              if (!/^\d{4,9}$/.test(t)) {
                await waClient.sendText(to, "Invalid code. Enter 4–9 digits:");
                hasProcessedMessage = true;
                continue;
              }
              await sb.from("profiles").update({ default_momo_code: t }).eq("id", user.id);
              await setState(session.id, STATES.QR_AMOUNT_MODE, { qr: { type: "code", code: t } });
              await waClient.sendButtons(to, "Amount mode:", [
                { id: "QR_AMT_WITH", title: "With amount" },
                { id: "QR_AMT_NONE", title: "No amount" },
                { id: "QR", title: "⬅️ Back" }
              ]);
              hasProcessedMessage = true;
              continue;
            }
            
            if (session.state === STATES.QR_AMOUNT_INPUT) {
              const amt = parseInt(t.replace(/[^\d]/g, ''), 10);
              if (!amt || amt <= 0) {
                await waClient.sendText(to, "Amount must be > 0. Enter again:");
                hasProcessedMessage = true;
                continue;
              }
              const ctx = (await sb.from("chat_sessions").select("context").eq("id", session.id).single()).data!.context as any;
              ctx.qr = { ...(ctx.qr || {}), amount: amt };
              await setState(session.id, STATES.QR_GENERATE, ctx);
              await generateAndSendQR(to, session.user_id, ctx);
              hasProcessedMessage = true;
              continue;
            }
            
            if (session.state === STATES.INS_COLLECT_DOCS) {
              if (t.toLowerCase() === "agent") {
                await waClient.sendText(to, "A human agent will join shortly. Please describe the issue.");
                hasProcessedMessage = true;
                continue;
              }
              if (t.toLowerCase() === "done") {
                await setState(session.id, STATES.INS_CHOOSE_START, {});
                await waClient.sendButtons(to, "Start date?", [
                  { id: "START_TODAY", title: "Today" },
                  { id: "START_PICK", title: "Pick date" }
                ]);
                hasProcessedMessage = true;
                continue;
              }
            }
            
            if (session.state === STATES.INS_CHOOSE_START && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
              const ctx = { ...(session.context || {}), start_date: t };
              await setState(session.id, STATES.INS_CHOOSE_PERIOD, ctx);
              const { data: periods = [] } = await fetchPeriods();
              await waClient.sendList(to, "Choose duration", periods.map((p: any) => ({
                id: `PERIOD_${p.id}`, 
                title: p.label, 
                description: `${p.days} days`
              })), "Period", "Available");
              hasProcessedMessage = true;
              continue;
            }
            
            if (session.state === STATES.INS_CHOOSE_ADDONS && t.toLowerCase() === "done") {
              const c = session.context as any;
              const { data: ads = [] } = await fetchAddons();
              const pa = ads.find((a: any) => a.code?.toLowerCase() === 'pa');
              if (pa && c.addons?.includes(pa.id)) {
                await setState(session.id, STATES.INS_CHOOSE_PA, c);
                const { data: cats = [] } = fetchPA();
                await waClient.sendList(to, "Personal Accident category", cats.map((p: any) => ({
                  id: `PA_${p.id}`, 
                  title: p.label
                })), "PA", "Categories");
              } else {
                await setState(session.id, STATES.INS_SUMMARY, c);
                await waClient.sendButtons(to, "Summary → Continue?", [
                  { id: "SUM_CONTINUE", title: "Continue" },
                  { id: "CANCEL", title: "Cancel" }
                ]);
              }
              hasProcessedMessage = true;
              continue;
            }
            
            // FALLBACK: Any text message in unknown state gets main menu
            if (!hasProcessedMessage) {
              logger.log("info", "Text message in unknown state, showing main menu", { 
                text: t.substring(0, 50), 
                state: session.state, 
                requestId 
              });
              await setState(session.id, STATES.MAIN_MENU, {});
              await showMainMenu(to);
              hasProcessedMessage = true;
              continue;
            }
          }

          // Handle non-interactive messages (location, media, text)
          if (m?.location && session.state === STATES.ND_WAIT_LOCATION) {
            const p = { lat: m.location.latitude, lng: m.location.longitude };
            const { data: drivers = [], error } = await sb.rpc("nearby_drivers_optimized", { 
              lat: p.lat, 
              lng: p.lng, 
              km: 15 
            });
            
            if (error || !drivers.length) {
              await waClient.sendText(to, "No drivers nearby right now. Try again later.");
              await setState(session.id, STATES.MOBILITY_MENU, {});
              await showMobilityMenu(to);
            } else {
              const rows = drivers.map((d: any, i: number) => ({
                id: `ND_BOOK_${d.driver_id}`,
                title: `#${i + 1} ${d.wa_name || 'Driver'} — ${d.distance_km.toFixed(1)} km`
              }));
              
              await setState(session.id, STATES.ND_CHOOSE_DRIVER, { nd: { pickup: p, drivers } });
              await waClient.sendList(to, "Top-10 nearby drivers:", rows, "Drivers", "Nearby");
            }
            hasProcessedMessage = true;
            continue;
          }
          
          // Media handling for vehicle documents - FAST ACK
          if ((m?.image || m?.document) && session.state === STATES.AV_DOC) {
            const mediaId = m.image?.id || m.document?.id;
            if (mediaId) {
              const ctx = session.context as any;
              const usageType = ctx.av?.usage_type;
              
              // Queue for async processing - don't block webhook
              await queueMediaForOCR(mediaId, user.id, usageType, to);
              hasProcessedMessage = true;
              continue;
            }
          }
        }
      }
    }
    
    // If no messages were processed, return success anyway
    if (!hasProcessedMessage) {
      logger.log("info", "No actionable messages in webhook", { requestId });
    }
    
    return new Response(JSON.stringify({ ok: true }), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    });
    
  } catch (error) {
    logger.log("error", "Request processing failed", { 
      error: error.message, 
      stack: error.stack, 
      requestId 
    });
    
    // Try to send error message to user if we have their contact
    try {
      const body = JSON.parse(await req.text());
      const contact = body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
      if (contact?.wa_id) {
        await waClient.sendText(contact.wa_id, "Sorry, something went wrong. Please try again or contact support.");
      }
    } catch (fallbackError) {
      logger.log("error", "Failed to send error message to user", { error: fallbackError.message });
    }
    
    return new Response("Internal server error", { status: 500 });
  }
});
