// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?target=deno&dts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MAX = Number(Deno.env.get("NEARBY_MAX_RESULTS") ?? 10);

const sb = createClient(SUPABASE_URL, SRK);

Deno.serve(async (req) => {
  try {
    const { latitude, longitude, radius_km = 15 } = await req.json();
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return json({ ok: false, error: "lat/lon required" }, 400);
    }

    const { data, error } = await sb.rpc("list_nearby_drivers", {
      lat: latitude,
      lon: longitude,
      radius_m: radius_km * 1000,
      limit_n: MAX,
    });

    if (error) throw error;
    return json({ ok: true, drivers: data ?? [] });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}