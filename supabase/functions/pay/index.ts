// supabase/functions/pay/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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

serve(() =>
  new Response(HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300" // 5 minutes
    },
  }),
);