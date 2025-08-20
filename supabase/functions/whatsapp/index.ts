// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno&dts";

/* ===== Core ===== */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const META_VERIFY = Deno.env.get("META_WABA_VERIFY_TOKEN") ?? "verify_me";
const META_TOKEN = Deno.env.get("META_ACCESS_TOKEN") ?? "";
const META_PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID") ?? "";
const BOT_WA_E164 = Deno.env.get("BOT_WA_E164") ?? "";  // e.g. 2507xxxxxxx
const GRAPH = "https://graph.facebook.com/v20.0";

/* Flows (IDs from Manager) */
const FLOW = {
  MAIN_MENU: Deno.env.get("FLOW_MAIN_MENU_ID") ?? "",
  QR_WIZARD: Deno.env.get("FLOW_QR_WIZARD_ID") ?? "",
  SCHEDULE_PAX: Deno.env.get("FLOW_SCHEDULE_PAX_ID") ?? "",
  SCHEDULE_DRV: Deno.env.get("FLOW_SCHEDULE_DRV_ID") ?? "",
  INS_START: Deno.env.get("FLOW_INSURANCE_START_ID") ?? "",
  ADD_VEHICLE: Deno.env.get("FLOW_ADD_VEHICLE_ID") ?? "",
  BASKET_VIEW: Deno.env.get("FLOW_BASKET_VIEW_ID") ?? "",

  MY_BASKETS: Deno.env.get("FLOW_MY_BASKETS_ID") ?? "",
  NOTIFICATIONS: Deno.env.get("FLOW_NOTIFICATIONS_ID") ?? "",
  HISTORY: Deno.env.get("FLOW_CONTRIB_HISTORY_ID") ?? "",
  INVITE: Deno.env.get("FLOW_INVITE_MEMBERS_ID") ?? "",
  SUPPORT: Deno.env.get("FLOW_SUPPORT_ID") ?? "",
  PROFILE: Deno.env.get("FLOW_PROFILE_ID") ?? "",

  ADMIN_QUEUE: Deno.env.get("FLOW_ADMIN_QUEUE_PICKER_ID") ?? "",
  ADMIN_MODERATE: Deno.env.get("FLOW_ADMIN_MODERATE_ITEM_ID") ?? "",
  ADMIN_LOOKUP: Deno.env.get("FLOW_ADMIN_USER_LOOKUP_ID") ?? "",
  ADMIN_NOTICE: Deno.env.get("FLOW_ADMIN_NOTICE_ID") ?? "",

  QUOTE_DECISION: Deno.env.get("FLOW_QUOTE_DECISION_ID") ?? "",
  INS_CLAIM: Deno.env.get("FLOW_INS_CLAIM_INTAKE_ID") ?? "",
  DRIVER_ONBOARD: Deno.env.get("FLOW_DRIVER_ONBOARD_ID") ?? "",
  REPORT_TRIP: Deno.env.get("FLOW_REPORT_TRIP_ID") ?? "",
};
const FLOW_TOKEN = Deno.env.get("FLOW_TOKEN") ?? ""; // optional

/* Existing services (yours) */
const FN_BASE = `${SUPABASE_URL}/functions/v1`;
const FN_GENERATE_QR = `${FN_BASE}/generate-qr`;
const FN_NEARBY_DRIVERS = `${FN_BASE}/nearby-drivers`;
const FN_PROCESS_VEHICLE_OCR = `${FN_BASE}/process-vehicle-ocr`;

/* New services (in this bundle) */
const FN_BASKETS_API = `${FN_BASE}/baskets-api`;
const FN_ADMIN_API   = `${FN_BASE}/admin-api`;

const sb = createClient(SUPABASE_URL, SRK);

/* ===== Server ===== */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === META_VERIFY) {
      return new Response(challenge, { status: 200, headers: { ...CORS, "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403, headers: CORS });
  }

  if (req.method === "POST") {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    await log("webhook", "in", "webhook", body);

    try {
      const entries = body?.entry ?? [];
      for (const e of entries) {
        const changes = e?.changes ?? [];
        for (const c of changes) {
          const v = c?.value;
          const msgs = v?.messages ?? [];
          const contacts = v?.contacts ?? [];
          for (const m of msgs) {
            const phone = `+${m.from}`;
            const contact = contacts.find((k: any) => k.wa_id === m.from);
            await upsertUser(m.from);
            await upsertConversation(phone, m, contact);
            await routeMessage(phone, m, contact);
          }
        }
      }
    } catch (err) {
      await log("error", "in", "exception", { err: String(err) });
    }
    return new Response("OK", { status: 200, headers: { ...CORS, "Content-Type": "text/plain" } });
  }

  return new Response("Method not allowed", { status: 405, headers: CORS });
});

/* ===== Router ===== */
async function routeMessage(phoneNumber: string, message: any, contact: any) {
  const to = phoneNumber.replace("+", ""); // digits only
  const waId = to;
  const type = message?.type;

  // FLOW reply (data_exchange or navigate)
  if (type === "interactive" && (message?.interactive?.nfm_reply?.response_json || message?.interactive?.flow?.response_json)) {
    const flow = extractFlowData(message) || {};
    const kind = String(flow.kind || "").toUpperCase();

    // store submission (ignore if table missing)
    await sb.from("flow_submissions" as any).insert({ wa_id: waId, kind, payload: flow }).catch(() => {});

    switch (kind) {
      /* ==== MAIN MENU NAV ==== */
      case "MENU_NAV": {
        const target = String(flow.target || "").toUpperCase();
        if (target === "QR") return sendFlow(to, FLOW.QR_WIZARD, "Open QR");
        if (target === "NEARBY") {
          await sendText(to, "Share your location: tap 📎 → Location → Send.");
          return;
        }
        if (target === "SCHEDULE_PAX") return sendFlow(to, FLOW.SCHEDULE_PAX, "Passenger");
        if (target === "SCHEDULE_DRV") return sendFlow(to, FLOW.SCHEDULE_DRV, "Driver");
        if (target === "ADD_VEHICLE") return sendFlow(to, FLOW.ADD_VEHICLE, "Add Vehicle");
        if (target === "INSURANCE") return sendFlow(to, FLOW.INS_START, "Start Insurance");
        /* Extras (menu-first architecture) */
        if (target === "BASKETS") return sendFlow(to, FLOW.MY_BASKETS, "My Baskets");
        if (target === "PROFILE") return sendFlow(to, FLOW.PROFILE, "Profile");
        if (target === "SUPPORT") return sendFlow(to, FLOW.SUPPORT, "Support");
        return sendFlow(to, FLOW.MAIN_MENU, "Open Menu");
      }

      /* ==== QR WIZARD ==== */
      case "QR_WIZARD_SUBMIT": {
        const raw = String(flow.identifier || flow.identifier_value || flow.phone || flow.code || "");
        const isPhone = /^(\+?250)?7\d{8}$|^07\d{8}$/.test(raw);
        const idType: "phone"|"code" = isPhone ? "phone" : "code";
        const identifier = isPhone ? normalizeRwandaPhone(raw) : normalizeCode(raw);
        const amount = flow.amount == null || flow.amount === "" ? null : Number(flow.amount);
        if (idType === "phone" && !/^07\d{8}$/.test(identifier)) return sendFlow(to, FLOW.QR_WIZARD, "Fix Phone");
        if (idType === "code"  && !/^\d{4,9}$/.test(identifier)) return sendFlow(to, FLOW.QR_WIZARD, "Fix Code");
        await generateAndDeliverQR(to, { identifierType: idType, identifier, amount }, waId);
        return sendFlow(to, FLOW.MAIN_MENU, "Open Menu");
      }

      /* ==== BASKETS - CREATOR ==== */
      case "CREATE_BASKET": {
        const payload = {
          name: String(flow.name || "").trim(),
          type_key: String(flow.type_key || flow.type || "personal"),
          period_key: String(flow.period_key || flow.period || null),
          collector_choice: String(flow.collector_choice || "mine"), // 'mine'|'other'
          collector_momo: String(flow.collector_momo || ""),
          wa_id: waId
        };
        const { data } = await call(FN_BASKETS_API, { action: "create_basket", ...payload });
        const link = data?.deep_link || "";
        await sendText(to, `Basket created: ${data?.name}\nStatus: private\nShare link:\n${link}`);
        return sendFlow(to, FLOW.MY_BASKETS, "My Baskets");
      }

      case "REQUEST_PUBLIC": {
        const basket_id = String(flow.basket_id || "");
        await call(FN_BASKETS_API, { action: "request_public", basket_id, wa_id: waId });
        await sendText(to, "Request sent. We will notify you when approved.");
        return;
      }

      case "INVITE_MEMBERS": {
        const basket_id = String(flow.basket_id || "");
        const { data } = await call(FN_BASKETS_API, { action: "invite_link", basket_id, wa_id: waId, bot_e164: BOT_WA_E164 });
        await sendText(to, `Share this link:\n${data?.deep_link}\n\nUSSD:\n${data?.ussd}`);
        return;
      }

      case "MY_BASKETS": {
        // Flow should call data_exchange and you can re-open list; here send a simple ack
        return sendFlow(to, FLOW.MY_BASKETS, "My Baskets");
      }

      case "NOTIFICATIONS_UPDATE": {
        const basket_id = String(flow.basket_id || "");
        const enabled = !!(flow.enabled ?? true);
        const freq = String(flow.frequency || "monthly");
        await call(FN_BASKETS_API, { action: "toggle_reminder", basket_id, enabled, frequency: freq, wa_id: waId });
        await sendText(to, `Reminders ${enabled ? "enabled" : "disabled"} (${freq}).`);
        return;
      }

      case "CONTRIB_DECLARE": {
        const token = String(flow.token || "");
        const amount = Number(flow.amount || 0);
        const note = String(flow.note || "");
        const { data } = await call(FN_BASKETS_API, { action: "declare_contribution", token, amount, note, wa_id: waId });
        // Notify creator via admin-api to show Approve/Reject
        await call(FN_ADMIN_API, { action: "notify_contribution_pending", contribution_id: data?.contribution_id });
        await sendText(to, "Thanks! Awaiting creator approval.");
        return;
      }

      case "VIEW_MEMBERS": {
        const token = String(flow.token || "");
        const { data } = await call(FN_BASKETS_API, { action: "view_members", token });
        const lines = (data?.members || []).map((m: any) => `• Member ${m.anon_code} — RWF ${formatAmount(m.total)}`);
        await sendText(to, `Members (anonymous):\n${lines.join("\n") || "No members yet."}\nTotal: RWF ${formatAmount(data?.total || 0)}`);
        return;
      }

      case "PROFILE_SAVE": {
        const momo = String(flow.momo || "").trim();
        const lang = String(flow.language || "en");
        const notify = String(flow.notify || "on") === "on";
        await call(FN_BASKETS_API, { action: "save_profile", wa_id: waId, momo, language: lang, notify });
        await sendText(to, "Profile updated.");
        return sendFlow(to, FLOW.MAIN_MENU, "Open Menu");
      }

      /* ==== SUPPORT / REPORT ==== */
      case "SUPPORT_TICKET": {
        await call(FN_ADMIN_API, { action: "create_ticket", wa_id: waId, topic: flow.topic, text: flow.text });
        await sendText(to, "Thanks. Our team will review and respond.");
        return;
      }

      /* ==== ADMIN (from WhatsApp) ==== */
      case "ADMIN_QUEUE_PICK": {
        return sendFlow(to, FLOW.ADMIN_MODERATE, "Open Item", { screen: "MODERATE", data: { queue_id: flow.queue_id } });
      }
      case "ADMIN_MODERATE": {
        await call(FN_ADMIN_API, { action: "moderate", decision: flow.decision, queue_id: flow.queue_id, note: flow.note, wa_id: waId });
        await sendText(to, "Saved.");
        return sendFlow(to, FLOW.ADMIN_QUEUE, "Back to Queue");
      }

      /* ==== INSURANCE / MOBILITY extras ==== */
      case "CLAIM_INTAKE": {
        await call(FN_ADMIN_API, { action: "insurance_claim_intake", wa_id: waId, data: flow });
        await sendText(to, "Claim submitted. We'll update you.");
        return;
      }
      case "DRIVER_ONBOARD": {
        await call(FN_ADMIN_API, { action: "driver_onboard", wa_id: waId, data: flow });
        await sendText(to, "Thanks! Your driver profile is pending review.");
        return;
      }
      case "REPORT_TRIP": {
        await call(FN_ADMIN_API, { action: "report_trip", wa_id: waId, data: flow });
        await sendText(to, "Report received. Safety team will review.");
        return;
      }

      default:
        return sendFlow(to, FLOW.MAIN_MENU, "Open Menu");
    }
  }

  // LOCATION (flows can't capture GPS)
  if (type === "location") {
    await handleLocationForNearby(to, message.location, waId);
    return;
  }

  // IMAGE → OCR (Add Vehicle)
  const { data: conv } = await sb.from("whatsapp_conversations").select("current_step").eq("phone_number", phoneNumber).maybeSingle();
  if (type === "image" && conv?.current_step === "ADD_VEHICLE_WAIT_IMAGE") {
    const mediaId = message.image?.id;
    await startVehicleOCR(to, mediaId, waId);
    await saveStep(phoneNumber, "ADD_VEHICLE_PROCESSING", {});
    await sendText(to, "Processing document… You'll get updates here.");
    return;
  }

  // Deep link handler: "/basket <token>"
  const txt = (message?.text?.body || "").trim();
  const m = /^\/basket\s+([A-Za-z0-9_-]{6,})$/i.exec(txt);
  if (m) {
    const token = m[1];
    const { data } = await call(FN_BASKETS_API, { action: "basket_landing", token, bot_e164: BOT_WA_E164 });
    const warn = data?.warning || "Only contribute to people you trust.";
    await sendText(to,
      `Basket: ${data?.name}\nType: ${data?.type_label}${data?.period_label ? " • " + data?.period_label : ""}\nCreator: ${data?.creator_phone}\n\nUSSD: ${data?.ussd}\n\n${warn}`);
    return sendFlow(to, FLOW.BASKET_VIEW || FLOW.MY_BASKETS, "Basket");
  }

  // Greetings → Main menu
  if (/^(hi|hello|menu|start|home|hey|salut|hola)$/i.test(txt)) {
    return sendFlow(to, FLOW.MAIN_MENU, "Open Menu");
  }

  // Fallback
  return sendFlow(to, FLOW.MAIN_MENU, "Open Menu");
}

/* ===== WABA helpers ===== */
async function postWaba(payload: any) {
  const res = await fetch(`${GRAPH}/${META_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${META_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await res.json().catch(() => ({}));
  await log("waba", "out", payload?.type, { ok: res.ok, status: res.status, result });
}

type FlowOpenOpts = { screen?: string|null; data?: Record<string, unknown>|null; mode?: "published"|"draft"; action?: "data_exchange"|"navigate" };
async function sendFlow(to: string, flowId: string, cta: string, screenOrOpts?: string|FlowOpenOpts, data?: Record<string, unknown>|null) {
  if (!flowId) return;
  let screen: string | undefined;
  let payloadData: Record<string, unknown> | undefined;
  let mode: "published"|"draft" = "published";
  let action: "navigate"|"data_exchange";

  if (typeof screenOrOpts === "string" || screenOrOpts === undefined) {
    screen = typeof screenOrOpts === "string" ? screenOrOpts : undefined;
    payloadData = data ?? undefined;
    action = screen ? "navigate" : "data_exchange";
  } else {
    screen = screenOrOpts.screen ?? undefined;
    payloadData = (screenOrOpts.data ?? undefined) as any;
    mode = screenOrOpts.mode ?? "published";
    action = screenOrOpts.action ?? (screen ? "navigate" : "data_exchange");
  }

  const params: any = {
    flow_message_version: "3",
    flow_id: flowId,
    flow_cta: cta,
    mode,
    flow_action: action,
    ...(screen ? { screen } : {}),
    ...(payloadData ? { data: payloadData } : {})
  };
  if (FLOW_TOKEN) params.flow_token = FLOW_TOKEN;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "flow",
      header: { type: "text", text: " " },
      body:   { text: " " },
      action: { name: "flow", parameters: params }
    }
  };
  await postWaba(payload);
}

async function sendText(to: string, body: string) {
  await postWaba({ messaging_product: "whatsapp", to, type: "text", text: { body } });
}

/* ===== Workflow calls ===== */
async function call(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SRK}` },
    body: JSON.stringify(body || {})
  });
  let data: any = null;
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data };
}

async function generateAndDeliverQR(to: string, args: { identifierType: "phone"|"code"; identifier: string; amount: number|null }, waId: string) {
  const { data } = await call(FN_GENERATE_QR, { wa_id: waId, ...args });
  const imageUrl = data?.image_url;
  if (imageUrl) {
    await postWaba({ messaging_product: "whatsapp", to, type: "image", image: { link: imageUrl } });
  }
}

async function handleLocationForNearby(to: string, loc: any, waId: string) {
  const { data } = await call(FN_NEARBY_DRIVERS, {
    wa_id: waId, latitude: loc?.latitude, longitude: loc?.longitude, radius_km: 15
  });
  const drivers = (data?.drivers || []).slice(0,10);
  if (!drivers.length) return sendText(to, "No drivers nearby yet. Try again in a moment.");
  const lines = drivers.map((d: any) => `• ${d.wa_name || "Driver"} ~${d.distance_km}km (ETA ${d.eta_minutes}m)`);
  return sendText(to, "Nearby Drivers:\n" + lines.join("\n"));
}

async function startVehicleOCR(to: string, mediaId: string, waId: string) {
  await call(FN_PROCESS_VEHICLE_OCR, { wa_id: waId, media_id: mediaId });
}

/* ===== Conversation & Users ===== */
async function upsertUser(waDigits: string) {
  const wa_id = waDigits;
  const { data } = await sb.from("users").select("id,anon_code").eq("wa_id", wa_id).maybeSingle();
  if (data?.id) return;
  const anon = Math.floor(100000 + Math.random()*900000).toString();
  await sb.from("users").insert({ wa_id, anon_code: anon }).catch(()=>{});
}

async function upsertConversation(phoneNumber: string, message: any, contact: any) {
  const { data: existing } = await sb.from("whatsapp_conversations" as any)
    .select("id,conversation_data").eq("phone_number", phoneNumber).maybeSingle();
  const payload = {
    last_activity_at: new Date().toISOString(),
    conversation_data: {
      ...(existing?.conversation_data ?? {}),
      last_message: getReadable(message),
      last_message_type: message.type,
      contact_name: contact?.profile?.name || null
    }
  };
  if (existing?.id) await sb.from("whatsapp_conversations" as any).update(payload).eq("id", existing.id);
  else await sb.from("whatsapp_conversations" as any).insert({ phone_number: phoneNumber, current_step: "MAIN_MENU", ...payload });
}
async function saveStep(phoneNumber: string, step: string, data: Record<string, unknown>) {
  await sb.from("whatsapp_conversations" as any).update({
    current_step: step, conversation_data: data, last_activity_at: new Date().toISOString()
  }).eq("phone_number", phoneNumber);
}
function getReadable(m: any) {
  if (m.type === "text") return m.text?.body || "";
  if (m.type === "interactive") return m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "Interactive";
  if (m.type === "location") return "Location";
  if (m.type === "image") return "Image";
  return m.type;
}
function extractFlowData(m: any) {
  try {
    const raw = m?.interactive?.nfm_reply?.response_json || m?.interactive?.flow?.response_json;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

/* ===== Normalizers / utils ===== */
function normalizeRwandaPhone(input: string) {
  const digits = input.replace(/[^\d]/g, "");
  if (/^07\d{8}$/.test(digits)) return digits;
  if (/^2507\d{8}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^7\d{8}$/.test(digits)) return `0${digits}`;
  if (/^\+?2507\d{8}$/.test(input)) return `0${input.replace(/[^\d]/g, "").slice(-9)}`;
  return digits;
}
function normalizeCode(input: string) { return input.replace(/[^\d]/g, "").slice(0,9); }
function formatAmount(n: number) { return (Math.round((n||0) as number)).toLocaleString("en-US"); }

async function log(kind: string, direction: "in"|"out", message_type: string, payload: unknown) {
  try { await sb.from("whatsapp_logs" as any).insert({ direction, message_type, payload, status: "ok" }); } catch {}
}