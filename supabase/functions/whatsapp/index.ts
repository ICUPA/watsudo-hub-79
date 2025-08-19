// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno&dts";

/* ============ Config ============ */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const META_VERIFY = Deno.env.get("META_VERIFY_TOKEN") ?? "verify_me";
const META_TOKEN = Deno.env.get("META_ACCESS_TOKEN") ?? "";
const META_PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID") ?? "";
const GRAPH_VER = Deno.env.get("GRAPH_VERSION") ?? "v20.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VER}`;

/* Flow IDs */
const FLOW_TOKEN = Deno.env.get("FLOW_TOKEN") ?? "";
const FLOW_MAIN_MENU_ID = Deno.env.get("FLOW_MAIN_MENU_ID") ?? "";
const FLOW_QR_WIZARD_ID = Deno.env.get("FLOW_QR_WIZARD_ID") ?? "";
const FLOW_SCHEDULE_PAX_ID = Deno.env.get("FLOW_SCHEDULE_PAX_ID") ?? "";
const FLOW_SCHEDULE_DRV_ID = Deno.env.get("FLOW_SCHEDULE_DRV_ID") ?? "";
const FLOW_INS_START_ID = Deno.env.get("FLOW_INSURANCE_START_ID") ?? "";
const FLOW_ADD_VEHICLE_ID = Deno.env.get("FLOW_ADD_VEHICLE_ID") ?? "";

/* Domain services */
const FN_BASE = `${SUPABASE_URL}/functions/v1`;
const FN_GENERATE_QR = `${FN_BASE}/generate-qr`;
const FN_NEARBY_DRIVERS = `${FN_BASE}/nearby-drivers`;
const FN_PROCESS_VEHICLE_OCR = `${FN_BASE}/process-vehicle-ocr`;
const FN_ADMIN_API = `${FN_BASE}/admin-api`;
const FN_ADMIN_BRIDGE = `${FN_BASE}/whatsapp-admin-bridge`;

const sb = createClient(SUPABASE_URL, SRK);

/* ============ Server ============ */
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

/* ============ Router (Flow-first) ============ */
async function routeMessage(phoneNumber: string, message: any, contact: any) {
  const to = phoneNumber.replace("+", "");
  const waId = to;
  const type = message?.type;

  // Flow replies
  if (type === "interactive" && (message?.interactive?.nfm_reply?.response_json || message?.interactive?.flow?.response_json)) {
    const flow = extractFlowData(message);
    if (!flow) { await sendMainMenuFlow(to); return; }

    await sb.from("flow_submissions").insert({ wa_id: waId, kind: flow.kind ?? "UNKNOWN", payload: flow }).catch(() => {});

    switch (flow.kind) {
      case "MENU_NAV": {
        const target = String(flow.target || "").toUpperCase();
        if (target === "QR") return await sendFlow(to, FLOW_QR_WIZARD_ID, "Open QR");
        if (target === "NEARBY") {
          await saveStep(phoneNumber, "NEARBY_WAIT_LOCATION", {});
          await sendText(to, "Please share your location:\n📎 → Location → Send.");
          return;
        }
        if (target === "SCHEDULE_PAX") return await sendFlow(to, FLOW_SCHEDULE_PAX_ID, "Schedule");
        if (target === "SCHEDULE_DRV") return await sendFlow(to, FLOW_SCHEDULE_DRV_ID, "Schedule");
        if (target === "ADD_VEHICLE") {
          await saveStep(phoneNumber, "ADD_VEHICLE_WAIT_IMAGE", {});
          // optional helper screen
          if (FLOW_ADD_VEHICLE_ID) return await sendFlow(to, FLOW_ADD_VEHICLE_ID, "Add Vehicle");
          await sendText(to, "Send a clear photo of your insurance certificate here.");
          return;
        }
        if (target === "INSURANCE") return await sendFlow(to, FLOW_INS_START_ID, "Start");
        return await sendMainMenuFlow(to);
      }

      case "QR_WIZARD_SUBMIT": {
        const idType = (String(flow.identifier_type || "") as "phone" | "code");
        const rawId = String(flow.identifier_value || "");
        const amount = flow.amount === "" || flow.amount == null ? null : Number(flow.amount);

        const identifier = idType === "phone" ? normalizeRwandaPhone(rawId) : normalizeCode(rawId);
        if (idType === "phone" && !/^07\d{8}$/.test(identifier)) return await sendFlow(to, FLOW_QR_WIZARD_ID, "Fix Phone");
        if (idType === "code" && !/^\d{4,9}$/.test(identifier)) return await sendFlow(to, FLOW_QR_WIZARD_ID, "Fix Code");

        await callEdge(FN_ADMIN_API, {
          action: "set_qr_default_value",
          wa_id: waId,
          default_type: idType,
          momo_phone: idType === "phone" ? identifier : undefined,
          momo_code: idType === "code" ? identifier : undefined,
        });

        await generateAndDeliverQR(
          to,
          { identifierType: idType, identifier, amount },
          waId,
        );

        return await sendMainMenuFlow(to);
      }

      case "SCHEDULE_PASSENGER": {
        await callEdge(FN_ADMIN_BRIDGE, { event: "schedule_passenger_finalize", wa_id: waId, data: flow });
        await sendText(to, "Passenger request created. We'll notify matches.");
        return await sendMainMenuFlow(to);
      }

      case "SCHEDULE_DRIVER": {
        await callEdge(FN_ADMIN_BRIDGE, { event: "schedule_driver_finalize", wa_id: waId, data: flow });
        await sendText(to, "Driver availability published.");
        return await sendMainMenuFlow(to);
      }

      case "INS_START": {
        await callEdge(FN_ADMIN_API, { action: "insurance_flow_progress", wa_id: waId, data: flow });
        await callEdge(FN_ADMIN_API, { action: "start_insurance_quote", phone_number: phoneNumber, state: flow });
        await sendText(to, "Preparing your insurance quotation…");
        return await sendMainMenuFlow(to);
      }

      default:
        return await sendMainMenuFlow(to);
    }
  }

  // Location
  if (type === "location") {
    await handleLocationForNearby(to, message.location, waId);
    return;
  }

  // Image (OCR)
  const { data: conv } = await sb
    .from("whatsapp_conversations")
    .select("current_step")
    .eq("phone_number", phoneNumber)
    .single()
    .catch(() => ({ data: null }));

  if (type === "image" && conv?.current_step === "ADD_VEHICLE_WAIT_IMAGE") {
    const mediaId = message.image?.id;
    await startVehicleOCR(to, mediaId, waId);
    await saveStep(phoneNumber, "ADD_VEHICLE_PROCESSING", {});
    await sendText(to, "Processing document… You'll get updates here.");
    return await sendMainMenuFlow(to);
  }

  // Fallback
  return await sendMainMenuFlow(to);
}

/* ============ WABA senders ============ */
async function postWaba(payload: any) {
  const res = await fetch(`${GRAPH}/${META_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${META_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = await res.json().catch(() => ({}));
  await log("waba", "out", payload?.type, { ok: res.ok, status: res.status, result });
}

type FlowOpenOpts = {
  screen?: string | null;
  data?: Record<string, unknown> | null;
  mode?: "published" | "draft";
  action?: "data_exchange" | "navigate";
};

async function sendFlow(
  to: string,
  flowId: string,
  cta: string,
  screenOrOpts?: string | FlowOpenOpts,
  data?: Record<string, unknown> | null,
): Promise<void> {
  if (!flowId) return;

  let screen: string | undefined;
  let payloadData: Record<string, unknown> | undefined;
  let mode: "published" | "draft" = "published";
  let action: "navigate" | "data_exchange";

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

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "flow",
      header: { type: "text", text: " " },
      body: { text: " " },
      action: {
        name: "flow",
        parameters: {
          flow_message_version: "3",
          flow_token: FLOW_TOKEN,
          flow_id: flowId,
          flow_cta: cta,
          mode,
          flow_action: action,
          ...(screen ? { screen } : {}),
          ...(payloadData ? { data: payloadData } : {}),
        },
      },
    },
  };

  await postWaba(payload);
}

async function sendMainMenuFlow(to: string) {
  await sendFlow(to, FLOW_MAIN_MENU_ID, "Open Menu");
}

async function sendText(to: string, body: string) {
  await postWaba({ messaging_product: "whatsapp", to, type: "text", text: { body } });
}

/* ============ Service helpers ============ */
async function callEdge(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SRK}` },
    body: JSON.stringify(body || {}),
  });
  let data: any = null;
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data };
}

async function generateAndDeliverQR(
  to: string,
  args: { identifierType: "phone" | "code"; identifier: string; amount: number | null },
  waId: string,
) {
  const { data } = await callEdge(FN_GENERATE_QR, { wa_id: waId, ...args });
  const imageUrl = data?.image_url;
  if (imageUrl) {
    await postWaba({ messaging_product: "whatsapp", to, type: "image", image: { link: imageUrl } });
  }
}

async function handleLocationForNearby(to: string, loc: any, waId: string) {
  const { data } = await callEdge(FN_NEARBY_DRIVERS, {
    wa_id: waId,
    latitude: loc?.latitude,
    longitude: loc?.longitude,
    radius_km: Number(Deno.env.get("NEARBY_DEFAULT_RADIUS_KM") ?? 15),
  });
  const drivers = (data?.drivers || []);
  await callEdge(FN_ADMIN_BRIDGE, { event: "nearby_results", wa_id: waId, data: { drivers } });
  await sendText(to, drivers.length ? `Found ${drivers.length} nearby drivers.` : "No drivers nearby yet.");
}

async function startVehicleOCR(to: string, mediaId: string, waId: string) {
  await callEdge(FN_PROCESS_VEHICLE_OCR, { wa_id: waId, media_id: mediaId });
}

/* ============ Conversation & utils ============ */
async function upsertConversation(phoneNumber: string, message: any, contact: any) {
  const { data: existing } = await sb
    .from("whatsapp_conversations")
    .select("id,conversation_data")
    .eq("phone_number", phoneNumber)
    .maybeSingle();

  const payload = {
    last_activity_at: new Date().toISOString(),
    conversation_data: {
      ...(existing?.conversation_data ?? {}),
      last_message: getReadable(message),
      last_message_type: message.type,
      contact_name: contact?.profile?.name || null,
    },
  };

  if (existing?.id) {
    await sb.from("whatsapp_conversations").update(payload).eq("id", existing.id);
  } else {
    await sb.from("whatsapp_conversations").insert({ phone_number: phoneNumber, current_step: "MAIN_MENU", ...payload });
  }
}

async function saveStep(phoneNumber: string, step: string, data: Record<string, unknown> = {}) {
  await sb.from("whatsapp_conversations").update({
    current_step: step,
    conversation_data: data,
    last_activity_at: new Date().toISOString(),
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

function normalizeRwandaPhone(input: string) {
  const digits = input.replace(/[^\d]/g, "");
  if (/^07\d{8}$/.test(digits)) return digits;
  if (/^2507\d{8}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^7\d{8}$/.test(digits)) return `0${digits}`;
  if (/^\+?2507\d{8}$/.test(input)) return `0${input.replace(/[^\d]/g, "").slice(-9)}`;
  return digits;
}
function normalizeCode(input: string) {
  return input.replace(/[^\d]/g, "").slice(0, 9);
}

async function log(kind: string, direction: "in"|"out", message_type: string, payload: unknown) {
  try {
    await sb.from("whatsapp_logs").insert({ direction, message_type, payload, status: "ok" });
  } catch {}
}