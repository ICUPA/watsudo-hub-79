// supabase/functions/pay/index.ts

const TEL = "tel:*182*8*1*669900%23"; // *182*8*1*669900# with # encoded as %23

const HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Pay with MTN MoMo</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body{font-family:system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         margin:0;min-height:100svh;display:flex;align-items:center;justify-content:center;background:#fff}
    a.btn{display:inline-block;padding:14px 18px;font-size:18px;text-decoration:none;border:1px solid #222;border-radius:12px}
  </style>
</head>
<body>
  <a class="btn" href="${TEL}">Pay with MoMo</a>
</body>
</html>`;

Deno.serve(async (req) => {
  return new Response(HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
});