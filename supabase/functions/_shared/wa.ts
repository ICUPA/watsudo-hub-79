// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const sb = createClient(SB_URL, SB_SERVICE);

const GRAPH_VER = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VER}`;
const PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID") || Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN") || Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const APP_SECRET = Deno.env.get("META_APP_SECRET") || Deno.env.get("WHATSAPP_APP_SECRET")!;

export async function sendRaw(payload: unknown) {
  const url = `${GRAPH}/${PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  await sb.from("whatsapp_logs").insert({ 
    direction: "out", 
    phone_number: (payload as any)?.to || "",
    message_type: (payload as any)?.type || "unknown",
    message_content: JSON.stringify(payload),
    metadata: j,
    status: res.ok ? "sent" : "failed"
  });
  if (!res.ok) throw new Error(`WA send error ${res.status}: ${JSON.stringify(j)}`);
  return j;
}

export const sendText = (to: string, body: string) =>
  sendRaw({ messaging_product: "whatsapp", to, type: "text", text: { body } });

export const sendButtons = (to: string, body: string, buttons: { id: string; title: string }[]) =>
  sendRaw({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: { buttons: buttons.map(b => ({ type: "reply", reply: b })) },
    },
  });

export const sendList = (
  to: string,
  header: string,
  body: string,
  rows: { id: string; title: string; description?: string }[],
  sectionTitle = "Options",
) =>
  sendRaw({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: header },
      body: { text: body },
      action: { button: "Choose", sections: [{ title: sectionTitle, rows }] },
    },
  });

export const sendImage = (to: string, link: string, caption?: string) =>
  sendRaw({ messaging_product: "whatsapp", to, type: "image", image: { link, caption } });

export const sendDoc = (to: string, link: string, caption?: string) =>
  sendRaw({ messaging_product: "whatsapp", to, type: "document", document: { link, caption } });

/** Verify X-Hub-Signature-256 with your App Secret */
export async function verifyWebhookSignature(req: Request, bodyText: string): Promise<boolean> {
  const sig = req.headers.get("x-hub-signature-256");
  if (!sig) return false;
  const [algo, digest] = sig.split("=");
  if (algo !== "sha256" || !digest) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("HMAC", key, hexToBytes(digest), enc.encode(bodyText));
  return ok;
}

function hexToBytes(hex: string) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return arr;
}

/** Graph media fetch: GET /{media-id} → meta.url, then GET that with bearer */
export async function fetchMediaBytes(mediaId: string) {
  const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
  if (!metaRes.ok) throw new Error("media meta fetch failed");
  const meta = await metaRes.json();
  const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
  const mime = fileRes.headers.get("content-type") || "application/octet-stream";
  const bytes = new Uint8Array(await fileRes.arrayBuffer());
  return { bytes, mime };
}

/** Small helpers */
export const ok = (b: unknown = {}) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
export const bad = (m = "bad", s = 400) => new Response(m, { status: s });

/** Extract common WA fields */
export function extract(entry: any) {
  const m = entry?.changes?.[0]?.value?.messages?.[0];
  const contacts = entry?.changes?.[0]?.value?.contacts?.[0];
  const from = contacts?.wa_id ? `+${contacts.wa_id}` : undefined;
  const name = contacts?.profile?.name;
  return { m, from, name };
}

export function interactiveId(msg: any): string | undefined {
  if (msg?.type !== "interactive") return;
  const i = msg.interactive;
  if (i?.type === "button_reply") return i.button_reply?.id;
  if (i?.type === "list_reply") return i.list_reply?.id;
}

export function normalizePhone(p: string) {
  const d = p.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  if (d.startsWith("07")) return `+250${d.slice(1)}`;
  if (d.startsWith("2507")) return `+${d}`;
  return d;
}

export function buildUSSD(type: "phone" | "code", identifier: string, amount?: number) {
  if (type === "phone") {
    const local = identifier.startsWith("+250") ? `0${identifier.slice(4)}` : identifier.replace(/^\+/, "");
    return amount ? `*182*1*1*${local}*${amount}#` : `*182*1*1*${local}#`;
  } else {
    return amount ? `*182*8*1*${identifier}*${amount}#` : `*182*8*1*${identifier}#`;
  }
}

export function buildTel(ussd: string) {
  return `tel:${encodeURIComponent(ussd).replace(/%2A/g, "*")}`;
}