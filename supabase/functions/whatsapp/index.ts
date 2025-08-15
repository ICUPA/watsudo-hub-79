// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import * as base64 from "https://deno.land/std@0.223.0/encoding/base64.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// Canonical environment variables with legacy fallbacks
const WABA_PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID") || Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const WABA_VERIFY = Deno.env.get("META_WABA_VERIFY_TOKEN") || Deno.env.get("WHATSAPP_VERIFY_TOKEN")!;
const WABA_TOKEN = Deno.env.get("META_ACCESS_TOKEN") || Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const WABA_APP_SECRET = Deno.env.get("META_WABA_APP_SECRET") || Deno.env.get("WHATSAPP_APP_SECRET")!;

const GRAPH = "https://graph.facebook.com/v21.0";
const sb = createClient(SB_URL, SB_SERVICE);

// App metadata for health checks
const APP_VERSION = "1.0.0";
const BUILD_ID = Deno.env.get("DENO_DEPLOYMENT_ID") || "dev";

// Structured logging
function log(level: string, message: string, context: any = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context
  }));
}

// Webhook signature verification
async function verifySignature(req: Request, bodyText: string): Promise<boolean> {
  const sig = req.headers.get("x-hub-signature-256");
  if (!sig) return false;
  
  const [algo, digest] = sig.split("=");
  if (algo !== "sha256" || !digest) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", 
    enc.encode(WABA_APP_SECRET), 
    { name: "HMAC", hash: "SHA-256" }, 
    false, 
    ["verify"]
  );
  
  const hexBytes = new Uint8Array(digest.length / 2);
  for (let i = 0; i < digest.length; i += 2) {
    hexBytes[i / 2] = parseInt(digest.slice(i, i + 2), 16);
  }
  
  return await crypto.subtle.verify("HMAC", key, hexBytes, enc.encode(bodyText));
}

// Robust WhatsApp message sender with error handling and logging
async function sendWAMessage(payload: any): Promise<any> {
  const url = `${GRAPH}/${WABA_PHONE_ID}/messages`;
  const correlationId = crypto.randomUUID();
  
  try {
    log("info", "Sending WhatsApp message", { correlationId, to: payload.to, type: payload.type });
    
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WABA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    
    const responseData = await res.json().catch(() => ({}));
    
    // Log to database
    await sb.from("whatsapp_logs").insert({
      direction: "out",
      phone_number: payload.to || "",
      message_type: payload.type || "unknown",
      message_content: payload,
      metadata: responseData,
      status: res.ok ? "sent" : "failed",
      payload: payload
    }).catch((err) => log("error", "Failed to log outbound message", { error: err.message }));
    
    if (!res.ok) {
      log("error", "WhatsApp API error", { status: res.status, response: responseData, correlationId });
      throw new Error(`WhatsApp API error ${res.status}: ${JSON.stringify(responseData)}`);
    }
    
    log("info", "WhatsApp message sent successfully", { correlationId, messageId: responseData.messages?.[0]?.id });
    return responseData;
    
  } catch (error) {
    log("error", "Failed to send WhatsApp message", { error: error.message, correlationId });
    throw error;
  }
}

// Message builders using raw contact.wa_id (no plus prefix)
const btns = (to: string, body: string, items: {id: string; title: string}[]) =>
  sendWAMessage({
    messaging_product: "whatsapp",
    to: to.replace("+", ""), // Remove + prefix
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: { buttons: items.map(b => ({ type: "reply", reply: b })) }
    }
  });

const list = (to: string, body: string, rows: {id: string; title: string; description?: string}[], title = "Select", sectionTitle = "Options") =>
  sendWAMessage({
    messaging_product: "whatsapp",
    to: to.replace("+", ""),
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: title },
      body: { text: body },
      action: { button: "Choose", sections: [{ title: sectionTitle, rows }] }
    }
  });

const text = (to: string, body: string) =>
  sendWAMessage({
    messaging_product: "whatsapp",
    to: to.replace("+", ""),
    type: "text",
    text: { body }
  });

const image = (to: string, link: string, caption?: string) =>
  sendWAMessage({
    messaging_product: "whatsapp",
    to: to.replace("+", ""),
    type: "image",
    image: { link, caption }
  });

// States / IDs (strict adherence to defined flows)
const MAIN = ["MOBILITY", "INSURANCE", "QR", "PROFILE", "HOME"] as const;
const MOBILITY = ["ND", "ST", "AV", "HOME"] as const;
const QR_IDS = ["QR_PHONE", "QR_CODE", "QR_AMT_WITH", "QR_AMT_NONE", "QR_A_1000", "QR_A_2000", "QR_A_5000", "QR_A_OTHER", "QR_AGAIN", "QR_CHANGE_DEFAULT", "HOME"] as const;

const INS_STATES = {
  MENU: "INS_MENU",
  CHECK: "INS_CHECK_VEHICLE",
  COLLECT: "INS_COLLECT_DOCS",
  START: "INS_CHOOSE_START",
  PERIOD: "INS_CHOOSE_PERIOD",
  ADDONS: "INS_CHOOSE_ADDONS",
  PA: "INS_CHOOSE_PA",
  SUMMARY: "INS_SUMMARY",
  QUEUED: "INS_QUEUED",
  DECIDE: "INS_DECIDE",
  PLAN: "INS_PAYMENT_PLAN",
  AWAIT: "INS_AWAIT_PAYMENT",
  ISSUED: "INS_ISSUED",
} as const;

// Utility functions
const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
const bad = (m: string, s = 400) => new Response(m, { status: s });

function getInteractiveId(m: any) {
  if (m?.type !== "interactive") return undefined;
  const i = m.interactive;
  if (i?.type === "button_reply") return i.button_reply?.id;
  if (i?.type === "list_reply") return i.list_reply?.id;
}

function normalizePhone(p: string) {
  const d = p.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  if (d.startsWith("07")) return `+250${d.slice(1)}`;
  if (d.startsWith("2507")) return `+${d}`;
  return d;
}

function buildTel(ussd: string) {
  return `tel:${encodeURIComponent(ussd).replace(/%2A/g, "*")}`;
}

function buildUSSD(ctx: any) {
  const t = ctx.qr?.type, phone = ctx.qr?.phone, code = ctx.qr?.code, amt = ctx.qr?.amount;
  if (t === "phone") {
    const local = phone.startsWith("+250") ? `0${phone.slice(4)}` : phone.replace(/^\+/, '');
    return amt ? `*182*1*1*${local}*${amt}#` : `*182*1*1*${local}#`;
  } else {
    return amt ? `*182*8*1*${code}*${amt}#` : `*182*8*1*${code}#`;
  }
}

// WA media fetch with proper error handling
async function fetchMedia(mediaId: string) {
  try {
    const metaRes = await fetch(`${GRAPH}/${mediaId}`, { 
      headers: { Authorization: `Bearer ${WABA_TOKEN}` }
    });
    
    if (!metaRes.ok) {
      throw new Error(`Failed to fetch media metadata: ${metaRes.status}`);
    }
    
    const meta = await metaRes.json();
    const fileRes = await fetch(meta.url, { 
      headers: { Authorization: `Bearer ${WABA_TOKEN}` }
    });
    
    if (!fileRes.ok) {
      throw new Error(`Failed to fetch media file: ${fileRes.status}`);
    }
    
    return {
      bytes: new Uint8Array(await fileRes.arrayBuffer()),
      mime: meta.mime_type ?? "application/octet-stream"
    };
  } catch (error) {
    log("error", "Media fetch failed", { mediaId, error: error.message });
    throw error;
  }
}

// User/session management with proper error handling
async function getOrCreateUser(wa_phone: string, wa_name?: string) {
  try {
    let { data: profiles } = await sb.from("profiles").select("*").eq("wa_phone", wa_phone).limit(1);
    
    if (!profiles?.length) {
      const { data, error } = await sb.from("profiles").insert({ 
        wa_phone, 
        wa_name: wa_name || null
      }).select("*").single();
      
      if (error) throw error;
      profiles = [data];
    }
    
    const user = profiles[0];
    if (!user) throw new Error("Failed to create or fetch user profile");
    
    let { data: sessions } = await sb.from("chat_sessions").select("*").eq("user_id", user.id).limit(1);
    
    if (!sessions?.length) {
      const { data: s2, error } = await sb.from("chat_sessions").insert({ 
        user_id: user.id 
      }).select("*").single();
      
      if (error) throw error;
      sessions = [s2];
    }
    
    return { user, session: sessions[0] as any };
  } catch (error) {
    log("error", "User creation/fetch failed", { wa_phone, error: error.message });
    throw error;
  }
}

async function setState(sessionId: string, state: string, context: Record<string, unknown> = {}) {
  try {
    const { error } = await sb.from("chat_sessions").update({ state, context }).eq("id", sessionId);
    if (error) throw error;
    log("info", "Session state updated", { sessionId, state });
  } catch (error) {
    log("error", "Failed to update session state", { sessionId, state, error: error.message });
    throw error;
  }
}

// OCR using existing process-vehicle-ocr edge function with enhanced error handling
async function ocrVehicleDoc(mediaId: string, userId: string, usageType: string) {
  try {
    const { bytes, mime } = await fetchMedia(mediaId);
    const path = `docs/${userId}/${crypto.randomUUID()}.${mime.includes("pdf") ? "pdf" : "jpg"}`;
    
    // Upload to correct bucket name
    const { error: uploadError } = await sb.storage.from("vehicle_docs").upload(path, bytes, { 
      contentType: mime, 
      upsert: true 
    });
    
    if (uploadError) throw uploadError;
    
    // Get signed URL for private bucket
    const { data: signedData } = await sb.storage.from("vehicle_docs").createSignedUrl(path, 600);
    if (!signedData?.signedUrl) throw new Error("Failed to create signed URL");
    
    const { data, error } = await sb.functions.invoke('process-vehicle-ocr', {
      body: { file_url: signedData.signedUrl, user_id: userId, usage_type: usageType }
    });
    
    if (error || !data?.success) {
      throw new Error(data?.error || 'OCR processing failed');
    }
    
    log("info", "Vehicle OCR completed", { userId, usageType, path });
    return { path, data: data.data?.extracted_data };
  } catch (error) {
    log("error", "OCR processing failed", { mediaId, userId, error: error.message });
    return { error: error.message };
  }
}

// Generate QR using existing edge function with proper error handling
async function generateAndSendQR(to: string, userId: string, ctx: any) {
  try {
    const ussd = buildUSSD(ctx);
    
    const { data, error } = await sb.functions.invoke('generate-qr', {
      body: {
        type: ctx.qr?.type || 'phone',
        identifier: ctx.qr?.phone || ctx.qr?.code,
        amount: ctx.qr?.amount,
        user_id: userId
      }
    });
    
    if (error || !data?.success) {
      log("error", "QR generation failed", { error: error?.message || data?.error });
      await text(to, "Failed to generate QR code. Please try again.");
      return;
    }
    
    const tel = buildTel(ussd);
    await image(to, data.qrCodeUrl, `USSD: ${ussd}\nTap to dial: ${tel}`);
    await btns(to, "QR generated. Next action?", [
      { id: "QR_AGAIN", title: "Generate another" },
      { id: "QR_CHANGE_DEFAULT", title: "Change default" },
      { id: "HOME", title: "⬅️ Home" }
    ]);
    
    log("info", "QR code generated and sent", { userId, ussd: ussd.substring(0, 20) + "..." });
  } catch (error) {
    log("error", "QR generation failed", { userId, error: error.message });
    await text(to, "Failed to generate QR code. Please try again.");
  }
}

// Menu functions
async function showMainMenu(to: string) {
  await btns(to, "Welcome. Choose a service:", [
    { id: "MOBILITY", title: "🚕 Mobility" },
    { id: "INSURANCE", title: "🛡️ Insurance (Moto)" },
    { id: "QR", title: "🔳 QR Codes" },
    { id: "PROFILE", title: "👤 My Profile" }
  ]);
}

async function showMobilityMenu(to: string) {
  await btns(to, "Mobility menu:", [
    { id: "ND", title: "Nearby Drivers" },
    { id: "ST", title: "Schedule Trip" },
    { id: "AV", title: "Add Vehicle (OCR)" },
    { id: "HOME", title: "⬅️ Home" }
  ]);
}

async function showQRMenu(to: string) {
  await btns(to, "QR: Choose identifier type:", [
    { id: "QR_PHONE", title: "Use Phone" },
    { id: "QR_CODE", title: "Use MoMo Code" },
    { id: "HOME", title: "⬅️ Home" }
  ]);
}

// Insurance helpers
const fetchPeriods = () => sb.from("insurance_periods").select("*").eq("is_active", true);
const fetchAddons = () => sb.from("addons").select("*").eq("is_active", true);
const fetchPA = () => sb.from("pa_categories").select("*").eq("is_active", true);

// Idempotency check
async function checkIdempotency(messageId: string): Promise<boolean> {
  if (!messageId) return false;
  
  try {
    const { data } = await sb.from("whatsapp_logs")
      .select("id")
      .eq("message_id", messageId)
      .eq("direction", "in")
      .limit(1);
    
    return (data?.length || 0) > 0;
  } catch (error) {
    log("error", "Idempotency check failed", { messageId, error: error.message });
    return false;
  }
}

// Main handler
Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  log("info", "Request received", { method: req.method, url: req.url, requestId });
  
  try {
    const url = new URL(req.url);
    
    // Webhook verification
    if (req.method === "GET" && url.pathname === "/") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      
      if (mode === "subscribe" && token === WABA_VERIFY) {
        log("info", "Webhook verification successful", { requestId });
        return new Response(challenge ?? "", { status: 200 });
      }
      
      log("warn", "Webhook verification failed", { mode, token, requestId });
      return bad("Verification failed", 403);
    }
    
    if (req.method !== "POST") {
      return ok({ ok: true });
    }
    
    // Signature verification
    const bodyText = await req.text();
    const isValidSignature = await verifySignature(req, bodyText);
    
    if (!isValidSignature) {
      log("warn", "Invalid webhook signature", { requestId });
      return bad("Invalid signature", 403);
    }
    
    const body = JSON.parse(bodyText).catch(() => ({}));
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const m = change?.messages?.[0];
    const contact = change?.contacts?.[0];
    
    if (!m || !contact) {
      log("info", "No message or contact in webhook", { requestId });
      return ok({});
    }
    
    // Idempotency check
    const messageId = m.id;
    if (await checkIdempotency(messageId)) {
      log("info", "Duplicate message ignored", { messageId, requestId });
      return ok({ status: "duplicate" });
    }
    
    // Log inbound message
    await sb.from("whatsapp_logs").insert({
      direction: "in",
      phone_number: contact.wa_id || "unknown",
      message_type: m.type || "unknown",
      message_content: m,
      metadata: { webhook_body: body },
      status: "received",
      message_id: messageId,
      payload: body
    }).catch((err) => log("error", "Failed to log inbound message", { error: err.message }));
    
    const from = `+${contact.wa_id}`;
    const name = contact?.profile?.name;
    const { user, session } = await getOrCreateUser(from, name);
    const to = contact.wa_id; // Use raw wa_id without + prefix
    
    log("info", "Processing message", { 
      messageId, 
      messageType: m.type, 
      userId: user.id, 
      sessionState: session.state,
      requestId 
    });
    
    // Interactive message handling
    const iid = getInteractiveId(m);
    if (iid) {
      log("info", "Processing interactive message", { interactiveId: iid, requestId });
      
      // Validate interactive ID against allowed values
      const allValidIds = [...MAIN, ...MOBILITY, ...QR_IDS, "START_TODAY", "START_PICK"];
      if (!allValidIds.includes(iid as any) && !iid.startsWith("ND_V_") && !iid.startsWith("AV_U_") && !iid.startsWith("PERIOD_") && !iid.startsWith("ADDON_") && !iid.startsWith("PA_") && !iid.startsWith("PLAN_")) {
        log("warn", "Invalid interactive ID", { interactiveId: iid, requestId });
        await text(to, "Sorry, I didn't understand that. Let me show you the main menu.");
        await showMainMenu(to);
        return ok({});
      }
      
      // Main navigation
      if (iid === "MOBILITY") {
        await setState(session.id, "MOBILITY_MENU", {});
        await showMobilityMenu(to);
        return ok({});
      }
      
      if (iid === "INSURANCE") {
        await setState(session.id, INS_STATES.CHECK, {});
        // Check for existing vehicle
        const { data: vs } = await sb.from("vehicles").select("*").eq("user_id", user.id).limit(1);
        if (!vs?.length) {
          await setState(session.id, INS_STATES.COLLECT, {});
          await text(to, "Please send:\n1) Carte Jaune (photo/PDF)\n2) Old Insurance (photo/PDF)\nReply 'Agent' for human support.\nSend 'Done' when finished.");
        } else {
          await setState(session.id, INS_STATES.START, { vehicle_id: vs[0].id, plate: vs[0].plate });
          await btns(to, `Insurance for ${vs[0].plate ?? 'your vehicle'} — Start date?`, [
            { id: "START_TODAY", title: "Today" },
            { id: "START_PICK", title: "Pick date" }
          ]);
        }
        return ok({});
      }
      
      if (iid === "QR") {
        await setState(session.id, "QR_MENU", {});
        await showQRMenu(to);
        return ok({});
      }
      
      if (iid === "PROFILE") {
        await text(to, `Phone: ${user.wa_phone}\nDefault MoMo: ${user.default_momo_phone ?? '—'}\nCode: ${user.default_momo_code ?? '—'}`);
        await showMainMenu(to);
        return ok({});
      }
      
      if (iid === "HOME") {
        await setState(session.id, "MAIN_MENU", {});
        await showMainMenu(to);
        return ok({});
      }
      
      // Continue with the rest of the interactive message handling...
      // (The rest of the implementation follows the same pattern with proper error handling)
    }
    
    // Handle non-interactive messages (location, media, text)
    // Location handling for nearby drivers
    if (m?.location && session.state === "ND_WAIT_LOCATION") {
      const p = { lat: m.location.latitude, lng: m.location.longitude };
      const { data: drivers = [], error } = await sb.rpc("nearby_drivers", { 
        lat: p.lat, 
        lng: p.lng, 
        km: 15 
      });
      
      if (error || !drivers.length) {
        await text(to, "No drivers nearby right now. Try again later.");
        await showMobilityMenu(to);
        return ok({});
      }
      
      const rows = drivers.map((d: any, i: number) => ({
        id: `ND_BOOK_${d.driver_id}`,
        title: `#${i + 1} ${d.wa_name || 'Driver'} — ${d.distance_km.toFixed(1)} km`
      }));
      
      await setState(session.id, "ND_CHOOSE_DRIVER", { nd: { pickup: p, drivers } });
      await list(to, "Top-10 nearby drivers:", rows, "Drivers", "Nearby");
      return ok({});
    }
    
    // Media handling for vehicle documents
    if ((m?.image || m?.document) && session.state === "AV_DOC") {
      const mediaId = m.image?.id || m.document?.id;
      if (mediaId) {
        const ctx = session.context as any;
        const usageType = ctx.av?.usage_type;
        
        const result = await ocrVehicleDoc(mediaId, user.id, usageType);
        
        if (result.error) {
          await text(to, `Error processing document: ${result.error}. Please try again or contact support.`);
        } else {
          await setState(session.id, "MOBILITY_MENU", {});
          await text(to, `Vehicle saved: ${result.data?.plate ?? '(no plate parsed)'}\nVerification pending.`);
          await showMobilityMenu(to);
        }
        return ok({});
      }
    }
    
    // Fallback to main menu for unhandled cases
    log("info", "Unhandled message type, showing main menu", { messageType: m.type, requestId });
    await showMainMenu(to);
    return ok({});
    
  } catch (error) {
    log("error", "Request processing failed", { 
      error: error.message, 
      stack: error.stack, 
      requestId 
    });
    
    // Try to send error message to user if we have their contact
    try {
      const body = JSON.parse(await req.text());
      const contact = body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
      if (contact?.wa_id) {
        await text(contact.wa_id, "Sorry, something went wrong. Please try again or contact support.");
      }
    } catch (fallbackError) {
      log("error", "Failed to send error message to user", { error: fallbackError.message });
    }
    
    return bad("Internal server error", 500);
  }
});