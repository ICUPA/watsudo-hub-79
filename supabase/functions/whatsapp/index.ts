// deno-lint-ignore-file no-explicit-any
import { sb, ok, bad, sendText, sendButtons, sendList, sendImage, fetchMediaBytes, verifyWebhookSignature, extract, interactiveId, normalizePhone, buildUSSD, buildTel } from "../_shared/wa.ts";
import * as base64 from "https://deno.land/std@0.223.0/encoding/base64.ts";
import QRCode from "https://deno.land/x/qrcode@v2.0.0/mod.ts";

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

// Debug logging at startup
console.log("🔧 WhatsApp Function Environment Status:");
console.log("WHATSAPP_VERIFY_TOKEN:", VERIFY_TOKEN ? `SET (${VERIFY_TOKEN.length} chars)` : "NOT SET");
console.log("SUPABASE_URL:", Deno.env.get("SUPABASE_URL") ? "SET" : "NOT SET");
console.log("SUPABASE_SERVICE_ROLE_KEY:", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? "SET" : "NOT SET");

/** Main menu structure */
const MAIN_MENU = [
  { id: "MOBILITY", title: "🚕 Mobility" },
  { id: "INSURANCE", title: "🛡️ Insurance (Moto)" },
  { id: "QR", title: "🔳 QR Codes" },
  { id: "PROFILE", title: "👤 My Profile" },
];

async function mainMenu(to: string) {
  await sendButtons(to, "Welcome to MoveRwanda! Choose a service:", MAIN_MENU);
}

async function generateAndSendQR(to: string, userId: string, ctx: any) {
  const ussd = buildUSSD(ctx.qr.type, ctx.qr.type === "phone" ? ctx.qr.phone : ctx.qr.code, ctx.qr.amount);
  const dataUrl = await QRCode.toDataURL(ussd, { errorCorrectionLevel: "H", margin: 2, scale: 8 });
  const bytes = base64.decode(dataUrl.split(",")[1]);
  const path = `qr/${userId}/${crypto.randomUUID()}.png`;
  const up = await sb.storage.from("qr-codes").upload(path, bytes, { contentType: "image/png", upsert: true });
  if (up.error) throw up.error;

  await sb.from("qr_generations").insert({
    user_id: userId,
    profile_id: ctx.qr?.profile_id ?? null,
    amount: ctx.qr?.amount ?? null,
    ussd,
    file_path: path,
  });

  const publicUrl = `${Deno.env.get("SUPABASE_URL")!}/storage/v1/object/public/qr-codes/${path}`;
  const tel = buildTel(ussd);

  await sendImage(to, publicUrl, `USSD: ${ussd}\nTap to dial: ${tel}`);
  await sendButtons(to, "QR generated. Next action?", [
    { id: "QR_AGAIN", title: "Generate another" },
    { id: "QR_CHANGE_DEFAULT", title: "Change default" },
    { id: "HOME", title: "⬅️ Home" },
  ]);
}

/** User/session helpers */
async function getOrCreateUser(wa_phone: string, wa_name?: string) {
  let { data: profiles } = await sb.from("profiles").select("*").eq("wa_phone", wa_phone).limit(1);
  if (!profiles?.length) {
    const { data } = await sb.from("profiles").insert({ wa_phone, wa_name }).select("*").single();
    profiles = [data];
  }
  const user = profiles[0];
  let { data: sessions } = await sb.from("chat_sessions").select("*").eq("user_id", user.id).limit(1);
  if (!sessions?.length) {
    const { data: s2 } = await sb.from("chat_sessions").insert({ user_id: user.id }).select("*").single();
    sessions = [s2];
  }
  return { user, session: sessions[0] as any };
}

async function setState(sessionId: string, state: string, context: Record<string, unknown> = {}) {
  await sb.from("chat_sessions").update({ state, context }).eq("id", sessionId);
}

/** Interactive message router */
async function routeInteractive(to: string, id: string, user: any, session: any) {
  // Main menu navigation
  if (id === "MOBILITY") {
    await setState(session.id, "MOBILITY_MENU", {});
    await sendButtons(to, "Mobility menu:", [
      { id: "ND", title: "Nearby Drivers" },
      { id: "ST", title: "Schedule Trip" },
      { id: "AV", title: "Add Vehicle (OCR)" },
      { id: "HOME", title: "⬅️ Home" },
    ]);
    return;
  }
  
  if (id === "INSURANCE") {
    await setState(session.id, "INS_CHECK_VEHICLE", {});
    const { data: vs } = await sb.from("vehicles").select("*").eq("user_id", user.id).limit(1);
    if (!vs?.length) {
      await setState(session.id, "INS_COLLECT_DOCS", {});
      await sendText(to, "Please send:\n1) Carte Jaune (photo/PDF)\n2) Old Insurance (photo/PDF)\nReply 'Agent' for human support.\nSend 'Done' when finished.");
    } else {
      await setState(session.id, "INS_CHOOSE_START", { vehicle_id: vs[0].id, plate: vs[0].plate });
      await sendButtons(to, `Insurance for ${vs[0].plate ?? "your vehicle"} — Start date?`, [
        { id: "START_TODAY", title: "Today" },
        { id: "START_PICK", title: "Pick date" },
      ]);
    }
    return;
  }
  
  if (id === "QR") {
    await setState(session.id, "QR_MENU", {});
    await sendButtons(to, "QR: Choose identifier type:", [
      { id: "QR_PHONE", title: "Use Phone" },
      { id: "QR_CODE", title: "Use MoMo Code" },
      { id: "HOME", title: "⬅️ Home" },
    ]);
    return;
  }
  
  if (id === "PROFILE") {
    await sendText(to, `Phone: ${user.wa_phone}\nDefault MoMo: ${user.default_momo_phone ?? "—"} / Code: ${user.default_momo_code ?? "—"}`);
    await mainMenu(to);
    return;
  }
  
  if (id === "HOME") {
    await setState(session.id, "MAIN_MENU", {});
    await mainMenu(to);
    return;
  }

  // Mobility flows
  if (id === "ND") {
    await setState(session.id, "ND_SELECT_TYPE", {});
    const { data: types } = await sb.from("vehicle_types").select("*");
    await sendList(to, "Vehicle Types", "Choose vehicle type:", (types || []).map((t: any) => ({ id: `ND_V_${t.code}`, title: t.label })));
    return;
  }
  
  if (id.startsWith("ND_V_")) {
    const vt = id.replace("ND_V_", "");
    await setState(session.id, "ND_WAIT_LOCATION", { nd: { vehicle_type: vt } });
    await sendText(to, "Share your pickup location (Attach → Location).");
    return;
  }

  if (id === "AV") {
    await setState(session.id, "AV_USAGE", {});
    const { data: vtypes } = await sb.from("vehicle_types").select("*");
    await sendList(to, "Usage Types", "Pick usage:", (vtypes || []).map((t: any) => ({ id: `AV_U_${t.code}`, title: t.label })));
    return;
  }
  
  if (id.startsWith("AV_U_")) {
    const usage = id.replace("AV_U_", "");
    await setState(session.id, "AV_DOC", { av: { usage_type: usage } });
    await sendText(to, "Upload insurance certificate (photo or PDF).");
    return;
  }

  // QR flows
  if (id === "QR_PHONE") {
    await setState(session.id, "QR_PHONE", { qr: { type: "phone" } });
    if (!user.default_momo_phone) return sendText(to, "Enter MoMo phone (07xxxxxxxx or +2507…):");
    await setState(session.id, "QR_AMOUNT_MODE", { qr: { type: "phone", phone: user.default_momo_phone } });
    return sendButtons(to, "Amount mode:", [
      { id: "QR_AMT_WITH", title: "With amount" },
      { id: "QR_AMT_NONE", title: "No amount" },
      { id: "QR", title: "⬅️ Back" },
    ]);
  }
  
  if (id === "QR_CODE") {
    await setState(session.id, "QR_CODE", { qr: { type: "code" } });
    if (!user.default_momo_code) return sendText(to, "Enter MoMo merchant code (4–9 digits):");
    await setState(session.id, "QR_AMOUNT_MODE", { qr: { type: "code", code: user.default_momo_code } });
    return sendButtons(to, "Amount mode:", [
      { id: "QR_AMT_WITH", title: "With amount" },
      { id: "QR_AMT_NONE", title: "No amount" },
      { id: "QR", title: "⬅️ Back" },
    ]);
  }
  
  if (id === "QR_AMT_WITH") {
    await setState(session.id, "QR_AMOUNT_INPUT", { qr: { ...(session.context as any).qr } });
    return sendList(to, "Amounts", "Quick pick:", [
      { id: "QR_A_1000", title: "1,000" },
      { id: "QR_A_2000", title: "2,000" },
      { id: "QR_A_5000", title: "5,000" },
      { id: "QR_A_OTHER", title: "Other amount" },
    ]);
  }
  
  if (id === "QR_AMT_NONE") {
    const ctx = session.context as any;
    ctx.qr = { ...(ctx.qr || {}), amount: null };
    await setState(session.id, "QR_GENERATE", ctx);
    return generateAndSendQR(to, session.user_id, ctx);
  }
  
  if (["QR_A_1000", "QR_A_2000", "QR_A_5000"].includes(id)) {
    const amt = id === "QR_A_1000" ? 1000 : id === "QR_A_2000" ? 2000 : 5000;
    const ctx = session.context as any;
    ctx.qr = { ...(ctx.qr || {}), amount: amt };
    await setState(session.id, "QR_GENERATE", ctx);
    return generateAndSendQR(to, session.user_id, ctx);
  }
  
  if (id === "QR_A_OTHER") return sendText(to, "Enter amount (>0):");
  
  if (id === "QR_AGAIN") return sendButtons(to, "QR: Choose identifier type:", [
    { id: "QR_PHONE", title: "Use Phone" },
    { id: "QR_CODE", title: "Use MoMo Code" },
    { id: "HOME", title: "⬅️ Home" },
  ]);
  
  if (id === "QR_CHANGE_DEFAULT") {
    const ctx = session.context as any;
    if (ctx.qr?.type === "phone") {
      await setState(session.id, "QR_PHONE", { qr: { type: "phone" } });
      return sendText(to, "Enter new default MoMo phone:");
    } else {
      await setState(session.id, "QR_CODE", { qr: { type: "code" } });
      return sendText(to, "Enter new default MoMo code (4–9 digits):");
    }
  }

  // Insurance decisions
  if (id === "START_TODAY") {
    const today = new Date().toISOString().split('T')[0];
    const ctx = { ...(session.context || {}), start_date: today };
    await setState(session.id, "INS_CHOOSE_PERIOD", ctx);
    const { data: periods = [] } = await sb.from("insurance_periods").select("*");
    await sendList(to, "Period", "Choose duration", periods.map((p: any) => ({ 
      id: `PERIOD_${p.id}`, 
      title: p.label 
    })), "Available");
    return;
  }
  
  if (id === "START_PICK") {
    await setState(session.id, "INS_START_DATE_INPUT", session.context);
    await sendText(to, "Enter start date (YYYY-MM-DD format):");
    return;
  }
  
  if (id.startsWith("PERIOD_")) {
    const periodId = id.replace("PERIOD_", "");
    const ctx = { ...(session.context || {}), period_id: periodId };
    await setState(session.id, "INS_CHOOSE_ADDONS", ctx);
    const { data: addons = [] } = await sb.from("insurance_addons").select("*").eq("is_active", true);
    await sendList(to, "Add-ons", "Select additional coverage:", addons.map((a: any) => ({ 
      id: `ADDON_${a.id}`, 
      title: a.name,
      description: `${a.price} RWF`
    })), "Coverage");
    return;
  }

  // Handle driver booking
  if (id.startsWith("ND_BOOK_")) {
    const driverId = id.replace("ND_BOOK_", "");
    const ctx = session.context as any;
    const driver = ctx.nd?.drivers?.find((d: any) => d.driver_id === driverId);
    if (driver) {
      await setState(session.id, "ND_CONFIRM_BOOKING", { ...ctx, selected_driver: driver });
      await sendText(to, `Driver: ${driver.wa_name}\nDistance: ${driver.distance_km} km\nRating: ${driver.rating}/5`);
      await sendButtons(to, "Confirm booking?", [
        { id: "ND_CONFIRM_YES", title: "✅ Book Now" },
        { id: "ND_CONFIRM_NO", title: "❌ Cancel" },
        { id: "ND", title: "⬅️ Choose Another" },
      ]);
    }
    return;
  }
  
  if (id === "ND_CONFIRM_YES") {
    const ctx = session.context as any;
    const { data: ride } = await sb.from("rides").insert({
      passenger_user_id: user.id,
      driver_user_id: ctx.selected_driver.driver_id,
      pickup: ctx.nd.pickup,
      status: "pending"
    }).select("*").single();
    
    await sendText(to, `✅ Ride booked! ID: ${ride.id}\nDriver will be notified.`);
    await mainMenu(to);
    return;
  }
}

/** HTTP entry point */
Deno.serve(async (req) => {
  const url = new URL(req.url);

  // GET: webhook verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    
    console.log(`🔐 Verification attempt: mode=${mode}, token=${token}, challenge=${challenge}`);
    console.log(`🔑 Expected token: ${VERIFY_TOKEN || "NOT SET"}`);
    
    if (!VERIFY_TOKEN) {
      console.error("❌ VERIFY_TOKEN not configured");
      return bad("Webhook not configured", 500);
    }
    
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Verification successful");
      return new Response(challenge ?? "", { status: 200 });
    }
    
    console.log("❌ Verification failed");
    return bad("Verification failed", 403);
  }

  // POST: webhook events
  if (req.method !== "POST") return ok({ ok: true });

  const bodyText = await req.text();
  const valid = await verifyWebhookSignature(req, bodyText).catch(() => false);
  if (!valid) return bad("invalid signature", 403);

  const body = JSON.parse(bodyText);
  console.log("📨 Incoming webhook payload:", JSON.stringify(body, null, 2));
  
  await sb.from("whatsapp_logs").insert({ 
    direction: "in", 
    phone_number: "",
    message_type: "webhook",
    message_content: JSON.stringify(body),
    metadata: body
  });
  
  const entry = body?.entry?.[0];
  const { m: msg, from: to, name } = extract(entry);
  if (!msg || !to) return ok();

  console.log(`🔄 Processing message: { from: "${to}", type: "${msg.type}", timestamp: "${msg.timestamp}" }`);

  // User/session management
  const { user, session } = await getOrCreateUser(to, name);
  console.log(`👤 User: ${user.wa_name || "Unknown"} (${user.wa_phone})`);

  // Interactive button/list taps
  const iid = interactiveId(msg);
  if (iid) {
    console.log(`🔘 Interactive ID: ${iid}`);
    await routeInteractive(to, iid, user, session);
    return ok({ status: "interactive" });
  }

  // Location messages for nearby drivers
  if (msg.location && session.state === "ND_WAIT_LOCATION") {
    const p = { lat: msg.location.latitude, lng: msg.location.longitude };
    console.log(`📍 Location received: ${p.lat}, ${p.lng}`);
    
    const { data: drivers = [] } = await sb.rpc("nearby_drivers", { lat: p.lat, lng: p.lng, km: 15 });
    if (!drivers.length) {
      await sendText(to, "No drivers nearby right now. Try again later.");
      await sendButtons(to, "Mobility menu:", [
        { id: "ND", title: "Nearby Drivers" },
        { id: "ST", title: "Schedule Trip" },
        { id: "AV", title: "Add Vehicle (OCR)" },
        { id: "HOME", title: "⬅️ Home" },
      ]);
      return ok();
    }
    
    const rows = drivers.slice(0, 10).map((d: any, i: number) => ({
      id: `ND_BOOK_${d.driver_id}`,
      title: `#${i + 1} ${d.wa_name || "Driver"} — ${d.distance_km.toFixed(1)} km`,
    }));
    
    await setState(session.id, "ND_CHOOSE_DRIVER", { nd: { pickup: p, drivers } });
    await sendList(to, "Drivers", "Top nearby drivers:", rows, "Available");
    return ok();
  }

  // Media uploads (images, documents)
  if (msg.image || msg.document) {
    const mediaId = msg.image?.id || msg.document?.id;
    if (mediaId) {
      console.log(`📎 Media received: ${mediaId}`);
      try {
        const { bytes, mime } = await fetchMediaBytes(mediaId);
        const ext = mime.includes("pdf") ? "pdf" : "jpg";
        const objectPath = `docs/${user.id}/${crypto.randomUUID()}.${ext}`;
        const up = await sb.storage.from("documents").upload(objectPath, bytes, { contentType: mime, upsert: true });
        
        if (!up.error) {
          await sendText(to, "Document received ✅");
          
          // Store file record
          await sb.from("whatsapp_files").insert({
            phone_number: to,
            user_id: user.id,
            file_type: msg.image ? "image" : "document",
            file_url: objectPath,
            mime_type: mime,
            file_size: bytes.length,
            purpose: session.state.includes("AV") ? "vehicle_ocr" : "insurance_docs"
          });
        }
      } catch (error) {
        console.error("Media processing error:", error);
        await sendText(to, "Failed to process document. Please try again.");
      }
    }
    return ok();
  }

  // Text message handling
  if (msg.text?.body) {
    const t = msg.text.body.trim();
    console.log(`💬 Text message: "${t}"`);
    
    // QR phone input
    if (session.state === "QR_PHONE") {
      const phone = normalizePhone(t);
      await sb.from("profiles").update({ default_momo_phone: phone }).eq("id", user.id);
      await setState(session.id, "QR_AMOUNT_MODE", { qr: { type: "phone", phone } });
      await sendButtons(to, "Amount mode:", [
        { id: "QR_AMT_WITH", title: "With amount" },
        { id: "QR_AMT_NONE", title: "No amount" },
        { id: "QR", title: "⬅️ Back" },
      ]);
      return ok();
    }
    
    // QR code input
    if (session.state === "QR_CODE") {
      if (!/^\d{4,9}$/.test(t)) {
        await sendText(to, "Invalid code. Enter 4–9 digits:");
        return ok();
      }
      await sb.from("profiles").update({ default_momo_code: t }).eq("id", user.id);
      await setState(session.id, "QR_AMOUNT_MODE", { qr: { type: "code", code: t } });
      await sendButtons(to, "Amount mode:", [
        { id: "QR_AMT_WITH", title: "With amount" },
        { id: "QR_AMT_NONE", title: "No amount" },
        { id: "QR", title: "⬅️ Back" },
      ]);
      return ok();
    }
    
    // QR amount input
    if (session.state === "QR_AMOUNT_INPUT") {
      const amt = parseInt(t.replace(/[^\d]/g, ""), 10);
      if (!amt || amt <= 0) {
        await sendText(to, "Amount must be > 0. Enter again:");
        return ok();
      }
      const ctx = session.context as any;
      ctx.qr = { ...(ctx.qr || {}), amount: amt };
      await setState(session.id, "QR_GENERATE", ctx);
      await generateAndSendQR(to, user.id, ctx);
      return ok();
    }
    
    // Insurance document collection
    if (session.state === "INS_COLLECT_DOCS") {
      if (t.toLowerCase() === "agent") {
        await sendText(to, "A human agent will join shortly. Please describe the issue.");
      } else if (t.toLowerCase() === "done") {
        await setState(session.id, "INS_CHOOSE_START", {});
        await sendButtons(to, "Start date?", [
          { id: "START_TODAY", title: "Today" },
          { id: "START_PICK", title: "Pick date" },
        ]);
      } else {
        await sendText(to, "Send more documents or reply 'Done' to continue.");
      }
      return ok();
    }
    
    // Insurance start date input
    if (session.state === "INS_START_DATE_INPUT" && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const ctx = { ...(session.context || {}), start_date: t };
      await setState(session.id, "INS_CHOOSE_PERIOD", ctx);
      const { data: periods = [] } = await sb.from("insurance_periods").select("*");
      await sendList(to, "Period", "Choose duration", periods.map((p: any) => ({ 
        id: `PERIOD_${p.id}`, 
        title: p.label 
      })), "Available");
      return ok();
    }
  }

  // Default: show main menu
  await mainMenu(to);
  return ok();
});