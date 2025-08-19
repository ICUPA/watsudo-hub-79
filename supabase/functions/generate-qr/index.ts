// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno&dts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const sb = createClient(SUPABASE_URL, SRK);

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { wa_id, identifierType, identifier, amount } = body as {
      wa_id: string;
      identifierType: "phone" | "code";
      identifier: string;
      amount: number | null;
    };

    const payload = encodeURIComponent(JSON.stringify({ t: identifierType, v: identifier, a: amount ?? "" }));
    // Simple, fast QR as PNG 512x512
    const image_url = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${payload}`;

    await sb.from("whatsapp_logs").insert({
      direction: "out",
      message_type: "qr",
      phone_number: wa_id,
      payload: { identifierType, identifier, amount, image_url },
      status: "ok",
    });

    return json({ ok: true, image_url });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}