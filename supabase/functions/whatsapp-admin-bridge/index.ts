// deno-lint-ignore-file no-explicit-any
const META_TOKEN = Deno.env.get("META_ACCESS_TOKEN") ?? "";
const META_PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID") ?? "";
const GRAPH_VER = Deno.env.get("GRAPH_VERSION") ?? "v20.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VER}`;

Deno.serve(async (req) => {
  try {
    const { event, wa_id, data } = await req.json();

    if (event === "nearby_results") {
      const to = wa_id;
      const drivers = (data?.drivers ?? []) as Array<any>;
      const lines = drivers.slice(0, 10).map((d, i) =>
        `${i + 1}. ${d.wa_name || "Driver"} ~${d.distance_km}km • ETA ${d.eta_minutes}m • ★${d.rating || 5}`
      ).join("\n");
      const body = drivers.length ? `Nearby drivers:\n${lines}` : "No nearby drivers yet.";
      await sendText(to, body);
      return json({ ok: true });
    }

    // schedule_* can be broadcast to admins or stored; for now just ack
    if (event === "schedule_passenger_finalize" || event === "schedule_driver_finalize") {
      return json({ ok: true });
    }

    return json({ ok: false, error: "unknown-event" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

async function sendText(toDigits: string, body: string) {
  const payload = { messaging_product: "whatsapp", to: toDigits, type: "text", text: { body } };
  await fetch(`${GRAPH}/${META_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${META_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}