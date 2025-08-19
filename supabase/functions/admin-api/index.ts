// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno&dts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const sb = createClient(SUPABASE_URL, SRK);

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "set_qr_default_value") {
      const { wa_id, default_type, momo_phone, momo_code } = body;
      await sb.from("qr_defaults").upsert({
        wa_id, default_type, momo_phone: momo_phone ?? null, momo_code: momo_code ?? null, updated_at: new Date().toISOString(),
      });
      return json({ ok: true });
    }

    if (action === "set_qr_default_type") {
      const { wa_id, default_type } = body;
      await sb.from("qr_defaults").upsert({ wa_id, default_type, updated_at: new Date().toISOString() });
      return json({ ok: true });
    }

    if (action === "get_qr_default") {
      const { wa_id } = body;
      const { data } = await sb.from("qr_defaults").select("*").eq("wa_id", wa_id).maybeSingle();
      return json({ ok: true, data });
    }

    if (action === "insurance_flow_progress") {
      // no-op, just acknowledge progress
      return json({ ok: true });
    }

    if (action === "start_insurance_quote") {
      const { phone_number, state } = body;
      await sb.from("insurance_leads").insert({ phone_number, state, status: "new" });
      return json({ ok: true });
    }

    return json({ ok: false, error: "unknown-action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}