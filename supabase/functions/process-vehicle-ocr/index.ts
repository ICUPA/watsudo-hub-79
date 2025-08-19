// deno-lint-ignore-file no-explicit-any
const META_TOKEN = Deno.env.get("META_ACCESS_TOKEN") ?? "";
const GRAPH_VER = Deno.env.get("GRAPH_VERSION") ?? "v20.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VER}`;
const OCR_API_KEY = Deno.env.get("OCR_API_KEY") ?? "";

Deno.serve(async (req) => {
  try {
    const { media_id } = await req.json();

    // 1) resolve media URL
    const meta1 = await fetch(`${GRAPH}/${media_id}`, {
      headers: { Authorization: `Bearer ${META_TOKEN}` },
    });
    const info = await meta1.json();
    const url = info?.url;
    if (!url) return json({ ok: false, error: "no-media-url" }, 400);

    // 2) download binary
    const imgRes = await fetch(url, { headers: { Authorization: `Bearer ${META_TOKEN}` } });
    const blob = await imgRes.arrayBuffer();

    // 3) OCR
    let ocrText = "";
    if (OCR_API_KEY) {
      const form = new FormData();
      form.append("apikey", OCR_API_KEY);
      form.append("language", "eng");
      form.append("isTable", "true");
      form.append("file", new Blob([blob]), "doc.jpg");

      const ocrRes = await fetch("https://api.ocr.space/parse/image", { method: "POST", body: form });
      const ocrJson = await ocrRes.json();
      ocrText = ocrJson?.ParsedResults?.[0]?.ParsedText ?? "";
    } else {
      ocrText = "(OCR disabled; set OCR_API_KEY)";
    }

    return json({ ok: true, text: ocrText });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}